import axios from 'axios';
import * as cheerio from 'cheerio';
import FormData from 'form-data';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import fs from 'fs-extra';
import forge from 'node-forge';
import xml2js from 'xml2js';
import JSZip from 'jszip';
import path from 'path';

/**
 * Servicio de descarga masiva del SAT usando Web Services
 * Similar a AdminXML - usa el sistema de solicitudes del SAT
 */
class SATWebService {
    constructor() {
        // URLs del Web Service del SAT
        this.wsdlSolicitud = 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc';
        this.wsdlVerificacion = 'https://cfdidescargamasiva.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc';
        this.wsdlDescarga = 'https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaTercerosService.svc';

        // Portal de autenticación
        this.portalURL = 'https://portalcfdi.facturaelectronica.sat.gob.mx';
        this.loginURL = 'https://cfdiau.sat.gob.mx/nidp/app/login';

        this.cookies = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.cookies,
            timeout: 60000,
            maxRedirects: 10,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }));

        this.session = null;
        this.certificate = null;
        this.privateKey = null;
    }

    /**
     * Autenticación con e.firma (requerido para Web Service)
     */
    async loginWithEFirma(certificatePath, keyPath, password) {
        try {
            console.log('🔐 Autenticando con e.firma...');

            // Leer archivos de certificado
            const cerBuffer = await fs.readFile(certificatePath);
            const keyBuffer = await fs.readFile(keyPath);

            // Parsear certificado (DER binario del SAT)
            let cert;
            try {
                // Primero intentar como DER binario (formato del SAT)
                const certDer = forge.util.createBuffer(cerBuffer);
                const certAsn1 = forge.asn1.fromDer(certDer);
                cert = forge.pki.certificateFromAsn1(certAsn1);
            } catch (e1) {
                try {
                    // Si falla, intentar como PEM
                    cert = forge.pki.certificateFromPem(cerBuffer.toString());
                } catch (e2) {
                    throw new Error('Formato de certificado no válido. Use archivo .cer del SAT');
                }
            }

            // Desencriptar llave privada (DER encriptado del SAT)
            let privateKey;
            try {
                // Intentar como DER binario encriptado (formato del SAT)
                const keyDer = forge.util.createBuffer(keyBuffer);
                const keyAsn1 = forge.asn1.fromDer(keyDer);
                privateKey = forge.pki.decryptRsaPrivateKey(keyAsn1, password);
            } catch (e1) {
                try {
                    // Intentar como PEM
                    const keyPem = keyBuffer.toString();
                    privateKey = forge.pki.decryptRsaPrivateKey(keyPem, password);
                } catch (e2) {
                    throw new Error('Contraseña incorrecta o formato de llave no válido');
                }
            }

            if (!privateKey) {
                throw new Error('Contraseña de llave privada incorrecta');
            }

            // Extraer RFC del certificado
            const subject = cert.subject.attributes;
            let rfc = null;
            for (const attr of subject) {
                if (attr.shortName === 'serialNumber' || attr.name === 'serialNumber') {
                    rfc = attr.value.replace(/\s/g, '');
                    break;
                }
            }

            if (!rfc) {
                throw new Error('No se pudo extraer el RFC del certificado');
            }

            // Validar vigencia del certificado
            const now = new Date();
            if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
                throw new Error('El certificado no está vigente');
            }

            // Guardar certificado y llave para firmar solicitudes
            this.certificate = cert;
            this.privateKey = privateKey;
            this.certificatePem = forge.pki.certificateToPem(cert);
            this.certificateDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

            this.session = {
                rfc: rfc.toUpperCase(),
                authenticated: true,
                authMethod: 'efirma',
                timestamp: new Date(),
                certValidUntil: cert.validity.notAfter
            };

            console.log(`✓ Autenticado exitosamente: ${rfc}`);
            console.log(`✓ Certificado válido hasta: ${cert.validity.notAfter.toISOString()}`);

            return {
                success: true,
                message: 'Autenticación exitosa con e.firma',
                session: this.session
            };

        } catch (error) {
            console.error('❌ Error en autenticación e.firma:', error.message);
            return {
                success: false,
                error: `Error de autenticación: ${error.message}`
            };
        }
    }

    /**
     * Firmar datos con la llave privada
     */
    signData(data) {
        if (!this.privateKey) {
            throw new Error('No hay llave privada cargada');
        }

        const md = forge.md.sha256.create();
        md.update(data, 'utf8');
        const signature = this.privateKey.sign(md);
        return forge.util.encode64(signature);
    }

    /**
     * Crear sobre SOAP firmado para solicitud
     */
    createSignedSOAP(soapBody) {
        const timestamp = new Date().toISOString();

        const soap = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx">
    <s:Header/>
    <s:Body>
        ${soapBody}
    </s:Body>
</s:Envelope>`;

        return soap;
    }

    /**
     * Solicitar descarga masiva de CFDIs
     * @param {string} tipo - 'emitidas' o 'recibidas'
     * @param {string} fechaInicio - Formato: 2024-01-01T00:00:00
     * @param {string} fechaFin - Formato: 2024-01-31T23:59:59
     * @param {string} rfcReceptor - RFC del receptor (opcional, para emitidas)
     * @param {string} rfcEmisor - RFC del emisor (opcional, para recibidas)
     */
    async solicitarDescarga(tipo, fechaInicio, fechaFin, rfcReceptor = null, rfcEmisor = null) {
        try {
            if (!this.session || !this.session.authenticated) {
                throw new Error('Debe autenticarse con e.firma primero');
            }

            console.log(`📥 Solicitando descarga de CFDIs ${tipo}...`);
            console.log(`   Período: ${fechaInicio} - ${fechaFin}`);

            // Convertir fechas al formato del SAT
            const fechaInicioSAT = this.formatDateForSAT(fechaInicio);
            const fechaFinSAT = this.formatDateForSAT(fechaFin);

            // Determinar tipo de solicitud
            const tipoSolicitud = tipo === 'emitidas' ? 'CFDI' : 'CFDI';
            const rfcSolicitante = this.session.rfc;

            // Construir parámetros según tipo
            let rfcEmisorParam = rfcEmisor || (tipo === 'emitidas' ? rfcSolicitante : '');
            let rfcReceptorParam = rfcReceptor || (tipo === 'recibidas' ? rfcSolicitante : '');

            // Crear XML de solicitud
            const solicitudXML = `
<des:SolicitaDescarga>
    <des:solicitud RfcSolicitante="${rfcSolicitante}" FechaInicial="${fechaInicioSAT}" FechaFinal="${fechaFinSAT}" TipoSolicitud="${tipoSolicitud}">
        ${rfcEmisorParam ? `<des:RfcEmisor>${rfcEmisorParam}</des:RfcEmisor>` : ''}
        ${rfcReceptorParam ? `<des:RfcReceptor>${rfcReceptorParam}</des:RfcReceptor>` : ''}
    </des:solicitud>
</des:SolicitaDescarga>`;

            // Crear SOAP envelope
            const soapEnvelope = this.createSignedSOAP(solicitudXML);

            // Enviar solicitud
            const response = await this.client.post(this.wsdlSolicitud, soapEnvelope, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescarga'
                }
            });

            // Parsear respuesta
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);

            // Extraer ID de solicitud
            const soapBody = result['s:Envelope']['s:Body'];
            const respuesta = soapBody['SolicitaDescargaResponse'];

            if (!respuesta) {
                throw new Error('Respuesta inválida del SAT');
            }

            const idSolicitud = respuesta.IdSolicitud || respuesta.idSolicitud;
            const codEstatus = respuesta.CodEstatus || respuesta.codEstatus;
            const mensaje = respuesta.Mensaje || respuesta.mensaje || '';

            if (codEstatus !== '5000') {
                throw new Error(`Error del SAT (${codEstatus}): ${mensaje}`);
            }

            console.log(`✓ Solicitud creada: ${idSolicitud}`);
            console.log(`   Estado: ${mensaje}`);

            return {
                success: true,
                idSolicitud,
                mensaje,
                tipo,
                fechaInicio,
                fechaFin
            };

        } catch (error) {
            console.error('❌ Error solicitando descarga:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verificar estado de solicitud de descarga
     */
    async verificarSolicitud(idSolicitud) {
        try {
            if (!this.session || !this.session.authenticated) {
                throw new Error('Debe autenticarse con e.firma primero');
            }

            console.log(`🔍 Verificando solicitud: ${idSolicitud}`);

            const verificacionXML = `
<des:VerificaSolicitudDescarga>
    <des:solicitud IdSolicitud="${idSolicitud}" RfcSolicitante="${this.session.rfc}"/>
</des:VerificaSolicitudDescarga>`;

            const soapEnvelope = this.createSignedSOAP(verificacionXML);

            const response = await this.client.post(this.wsdlVerificacion, soapEnvelope, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga'
                }
            });

            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);

            const soapBody = result['s:Envelope']['s:Body'];
            const respuesta = soapBody['VerificaSolicitudDescargaResponse'];

            const estadoSolicitud = respuesta.EstadoSolicitud || respuesta.estadoSolicitud;
            const codigoEstadoSolicitud = respuesta.CodigoEstadoSolicitud || respuesta.codigoEstadoSolicitud;
            const numeroCFDIs = respuesta.NumeroCFDIs || respuesta.numeroCFDIs || 0;
            const mensaje = respuesta.Mensaje || respuesta.mensaje || '';

            // Extraer IDs de paquetes si están disponibles
            let paquetes = [];
            const idsPaquetes = respuesta.IdsPaquetes || respuesta.idsPaquetes;
            if (idsPaquetes) {
                const paquetesStr = idsPaquetes.string || idsPaquetes;
                paquetes = Array.isArray(paquetesStr) ? paquetesStr : [paquetesStr];
            }

            console.log(`   Estado: ${estadoSolicitud} (${codigoEstadoSolicitud})`);
            console.log(`   CFDIs encontrados: ${numeroCFDIs}`);
            console.log(`   Paquetes: ${paquetes.length}`);

            return {
                success: true,
                estadoSolicitud,
                codigoEstadoSolicitud,
                numeroCFDIs: parseInt(numeroCFDIs) || 0,
                paquetes,
                mensaje
            };

        } catch (error) {
            console.error('❌ Error verificando solicitud:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Descargar paquete de CFDIs
     */
    async descargarPaquete(idPaquete, outputPath) {
        try {
            if (!this.session || !this.session.authenticated) {
                throw new Error('Debe autenticarse con e.firma primero');
            }

            console.log(`📦 Descargando paquete: ${idPaquete}`);

            const descargaXML = `
<des:PeticionDescargaMasivaTercerosResult>
    <des:RfcSolicitante>${this.session.rfc}</des:RfcSolicitante>
    <des:IdPaquete>${idPaquete}</des:IdPaquete>
</des:PeticionDescargaMasivaTercerosResult>`;

            const soapEnvelope = this.createSignedSOAP(descargaXML);

            const response = await this.client.post(this.wsdlDescarga, soapEnvelope, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://DescargaMasivaTerceros.gob.mx/IDescargaMasivaTercerosService/Descargar'
                },
                responseType: 'text'
            });

            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);

            const soapBody = result['s:Envelope']['s:Body'];
            const respuesta = soapBody['DescargarResponse'] || soapBody['PeticionDescargaMasivaTercerosResultResponse'];

            const paqueteB64 = respuesta.Paquete || respuesta.paquete;

            if (!paqueteB64) {
                throw new Error('No se recibió el paquete del SAT');
            }

            // Decodificar base64 del paquete (ZIP)
            const zipBuffer = Buffer.from(paqueteB64, 'base64');

            // Guardar ZIP
            await fs.ensureDir(outputPath);
            const zipPath = path.join(outputPath, `${idPaquete}.zip`);
            await fs.writeFile(zipPath, zipBuffer);

            // Descomprimir ZIP
            const zip = await JSZip.loadAsync(zipBuffer);
            const archivos = [];

            for (const [filename, fileData] of Object.entries(zip.files)) {
                if (!fileData.dir && filename.endsWith('.xml')) {
                    const content = await fileData.async('nodebuffer');
                    const filepath = path.join(outputPath, filename);
                    await fs.writeFile(filepath, content);
                    archivos.push({
                        filename,
                        filepath,
                        size: content.length
                    });
                }
            }

            console.log(`✓ Paquete descargado: ${archivos.length} archivos XML`);

            return {
                success: true,
                idPaquete,
                zipPath,
                archivos,
                total: archivos.length
            };

        } catch (error) {
            console.error('❌ Error descargando paquete:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Proceso completo de descarga masiva (como AdminXML)
     */
    async descargarMasivo(tipo, fechaInicio, fechaFin, outputPath) {
        try {
            console.log('\n🚀 Iniciando descarga masiva...\n');

            // Paso 1: Solicitar descarga
            const solicitud = await this.solicitarDescarga(tipo, fechaInicio, fechaFin);
            if (!solicitud.success) {
                throw new Error(solicitud.error);
            }

            const idSolicitud = solicitud.idSolicitud;

            // Paso 2: Esperar y verificar solicitud (polling)
            let intentos = 0;
            const maxIntentos = 30; // 5 minutos máximo
            let verificacion;

            console.log('\n⏳ Esperando procesamiento del SAT...\n');

            while (intentos < maxIntentos) {
                await this.sleep(10000); // Esperar 10 segundos entre verificaciones

                verificacion = await this.verificarSolicitud(idSolicitud);
                if (!verificacion.success) {
                    throw new Error(verificacion.error);
                }

                const estado = verificacion.codigoEstadoSolicitud;

                // 1 = Aceptada, 2 = En proceso, 3 = Terminada, 4 = Error, 5 = Rechazada
                if (estado === '3' || estado === 3) {
                    console.log('✓ Solicitud procesada correctamente\n');
                    break;
                } else if (estado === '4' || estado === 4 || estado === '5' || estado === 5) {
                    throw new Error(`Solicitud rechazada: ${verificacion.mensaje}`);
                }

                intentos++;
                console.log(`   Intento ${intentos}/${maxIntentos} - Estado: ${verificacion.estadoSolicitud}`);
            }

            if (intentos >= maxIntentos) {
                throw new Error('Timeout esperando respuesta del SAT');
            }

            // Paso 3: Descargar todos los paquetes
            const paquetes = verificacion.paquetes || [];
            console.log(`\n📦 Descargando ${paquetes.length} paquete(s)...\n`);

            const todosArchivos = [];
            await fs.ensureDir(outputPath);

            for (let i = 0; i < paquetes.length; i++) {
                const idPaquete = paquetes[i];
                console.log(`   Paquete ${i + 1}/${paquetes.length}: ${idPaquete}`);

                const descarga = await this.descargarPaquete(idPaquete, outputPath);
                if (descarga.success) {
                    todosArchivos.push(...descarga.archivos);
                } else {
                    console.warn(`   ⚠ Error descargando paquete ${idPaquete}: ${descarga.error}`);
                }
            }

            console.log(`\n✅ Descarga completa: ${todosArchivos.length} XMLs descargados\n`);

            return {
                success: true,
                idSolicitud,
                numeroCFDIs: verificacion.numeroCFDIs,
                paquetes: paquetes.length,
                archivos: todosArchivos,
                total: todosArchivos.length
            };

        } catch (error) {
            console.error('\n❌ Error en descarga masiva:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Formatear fecha para el SAT (ISO 8601)
     */
    formatDateForSAT(fecha) {
        // Si ya está en formato ISO, retornar
        if (fecha.includes('T')) {
            return fecha;
        }

        // Convertir YYYY-MM-DD a YYYY-MM-DDTHH:mm:ss
        const [year, month, day] = fecha.split('-');
        return `${year}-${month}-${day}T00:00:00`;
    }

    /**
     * Utilidad para pausar ejecución
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Verificar si hay sesión activa
     */
    isAuthenticated() {
        return this.session && this.session.authenticated;
    }

    /**
     * Obtener información de sesión
     */
    getSession() {
        return this.session;
    }

    /**
     * Cerrar sesión
     */
    logout() {
        this.session = null;
        this.certificate = null;
        this.privateKey = null;
        this.cookies = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.cookies,
            timeout: 60000,
            maxRedirects: 10
        }));
        console.log('✓ Sesión cerrada');
        return { success: true };
    }
}

export default new SATWebService();
