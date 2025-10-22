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
        // URLs oficiales del Web Service del SAT - Descarga Masiva v1.5 (mayo 2025)
        // Endpoints en producción clouda.sat.gob.mx
        this.wsdlAutenticacion = 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc';
        this.wsdlSolicitud = 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc';
        this.wsdlVerificacion = 'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc';
        this.wsdlDescarga = 'https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc';

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
            let privateKey = null;
            let lastError = null;

            // Método 1: Intentar como DER binario encriptado (formato estándar del SAT)
            try {
                const keyDer = forge.util.createBuffer(keyBuffer);
                const keyAsn1 = forge.asn1.fromDer(keyDer);
                privateKey = forge.pki.decryptRsaPrivateKey(keyAsn1, password);
                if (privateKey) {
                    console.log('✓ Llave privada desencriptada (formato DER)');
                }
            } catch (e1) {
                lastError = e1;
            }

            // Método 2: Intentar como PEM encriptado
            if (!privateKey) {
                try {
                    const keyPem = keyBuffer.toString('utf8');
                    if (keyPem.includes('BEGIN ENCRYPTED PRIVATE KEY') || keyPem.includes('BEGIN RSA PRIVATE KEY')) {
                        privateKey = forge.pki.decryptRsaPrivateKey(keyPem, password);
                        if (privateKey) {
                            console.log('✓ Llave privada desencriptada (formato PEM)');
                        }
                    }
                } catch (e2) {
                    lastError = e2;
                }
            }

            // Método 3: Intentar convertir DER a PEM y luego desencriptar
            if (!privateKey) {
                try {
                    const keyDer = forge.util.createBuffer(keyBuffer);
                    const keyAsn1 = forge.asn1.fromDer(keyDer);

                    // Crear estructura PKCS#8 encriptada
                    const encryptedPrivateKeyInfo = forge.pki.wrapRsaPrivateKey(keyAsn1);
                    const pem = forge.pki.encryptedPrivateKeyToPem(encryptedPrivateKeyInfo);

                    privateKey = forge.pki.decryptRsaPrivateKey(pem, password);
                    if (privateKey) {
                        console.log('✓ Llave privada desencriptada (formato DER→PEM)');
                    }
                } catch (e3) {
                    lastError = e3;
                }
            }

            // Método 4: Intentar como PKCS#8 encriptado con desencriptación manual
            if (!privateKey) {
                try {
                    const keyDer = forge.util.createBuffer(keyBuffer);
                    const keyAsn1 = forge.asn1.fromDer(keyDer);

                    // Desencriptar PKCS#8 EncryptedPrivateKeyInfo
                    const encryptedPrivateKeyInfo = forge.pki.decryptPrivateKeyInfo(keyAsn1, password);
                    if (encryptedPrivateKeyInfo) {
                        privateKey = forge.pki.privateKeyFromAsn1(encryptedPrivateKeyInfo);
                        if (privateKey) {
                            console.log('✓ Llave privada desencriptada (formato PKCS#8 EncryptedPrivateKeyInfo)');
                        }
                    }
                } catch (e4) {
                    lastError = e4;
                }
            }

            // Método 5: Intentar leer como PrivateKeyInfo sin encriptar
            if (!privateKey) {
                try {
                    const keyDer = forge.util.createBuffer(keyBuffer);
                    const keyAsn1 = forge.asn1.fromDer(keyDer);

                    // Intentar como PrivateKeyInfo (PKCS#8 sin encriptar)
                    privateKey = forge.pki.privateKeyFromAsn1(keyAsn1);
                    if (privateKey) {
                        console.log('✓ Llave privada leída (formato PKCS#8)');
                    }
                } catch (e5) {
                    lastError = e5;
                }
            }

            if (!privateKey) {
                console.error('❌ Todos los métodos de desencriptación fallaron');
                console.error('Último error:', lastError?.message);
                throw new Error('Contraseña incorrecta o formato de llave no válido. Verifica que: (1) La contraseña sea correcta, (2) El archivo .key sea válido, (3) El archivo .key corresponda al certificado .cer');
            }

            // Extraer RFC del certificado
            // El RFC en los certificados del SAT está en el OID 2.5.4.45 (x500UniqueIdentifier)
            // o en algunos casos en el campo serialNumber del subject
            const subject = cert.subject.attributes;
            let rfc = null;

            // Primero buscar en x500UniqueIdentifier (OID 2.5.4.45)
            for (const attr of subject) {
                if (attr.type === '2.5.4.45' || attr.shortName === 'x500UniqueIdentifier') {
                    rfc = attr.value.replace(/\s/g, '').toUpperCase();
                    break;
                }
            }

            // Si no se encuentra, buscar en serialNumber (algunos certificados antiguos)
            if (!rfc) {
                for (const attr of subject) {
                    if (attr.shortName === 'serialNumber' || attr.name === 'serialNumber') {
                        // El serialNumber puede contener RFC/CURP separados por /
                        // Ejemplo: BCO240821BG5/CACG631117C92
                        let value = attr.value.replace(/\s/g, '').toUpperCase();

                        // Si contiene /, tomar solo la primera parte (RFC)
                        if (value.includes('/')) {
                            value = value.split('/')[0];
                        }

                        // Validar que tenga formato de RFC (12-13 caracteres alfanuméricos)
                        if (/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3}$/.test(value)) {
                            rfc = value;
                            break;
                        }
                    }
                }
            }

            // Si aún no se encuentra, intentar extraer del CN (Common Name)
            if (!rfc) {
                for (const attr of subject) {
                    if (attr.shortName === 'CN' || attr.name === 'commonName') {
                        const cn = attr.value;
                        // El CN a veces contiene el RFC entre paréntesis o al final
                        const rfcMatch = cn.match(/\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3})\b/);
                        if (rfcMatch) {
                            rfc = rfcMatch[1].toUpperCase();
                            break;
                        }
                    }
                }
            }

            if (!rfc) {
                // Mostrar todos los atributos del certificado para debugging
                console.log('Atributos del certificado encontrados:');
                subject.forEach(attr => {
                    console.log(`  - ${attr.name || attr.shortName} (${attr.type}): ${attr.value}`);
                });
                throw new Error('No se pudo extraer el RFC del certificado. Verifique que sea un certificado válido de e.firma del SAT.');
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

            // Extraer solo el RFC (sin CURP si existe)
            const rfcSolo = rfc.includes('/') ? rfc.split('/')[0] : rfc;

            this.session = {
                rfc: rfcSolo.toUpperCase(),
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
        if (!this.certificate || !this.privateKey) {
            throw new Error('No hay certificado o llave privada cargados');
        }

        const timestamp = new Date().toISOString();

        // Crear el SOAP Body sin firmar
        const bodyContent = soapBody.trim();

        // Crear la firma del body content
        const md = forge.md.sha256.create();
        md.update(bodyContent, 'utf8');
        const signature = this.privateKey.sign(md);
        const signatureB64 = forge.util.encode64(signature);

        // Obtener el certificado en base64
        const certB64 = forge.util.encode64(this.certificateDer);

        // Crear SOAP envelope con firma WS-Security
        const soap = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
    <s:Header>
        <o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
            <u:Timestamp u:Id="_0" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
                <u:Created>${timestamp}</u:Created>
                <u:Expires>${new Date(Date.now() + 300000).toISOString()}</u:Expires>
            </u:Timestamp>
            <o:BinarySecurityToken u:Id="uuid-${this.generateUUID()}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${certB64}</o:BinarySecurityToken>
            <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
                <SignedInfo>
                    <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                    <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
                    <Reference URI="#_0">
                        <Transforms>
                            <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                        </Transforms>
                        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                        <DigestValue>${signatureB64}</DigestValue>
                    </Reference>
                </SignedInfo>
                <SignatureValue>${signatureB64}</SignatureValue>
                <KeyInfo>
                    <o:SecurityTokenReference>
                        <o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#uuid-${this.generateUUID()}"/>
                    </o:SecurityTokenReference>
                </KeyInfo>
            </Signature>
        </o:Security>
    </s:Header>
    <s:Body>
        ${bodyContent}
    </s:Body>
</s:Envelope>`;

        return soap;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
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

            // Versión 1.5 del SAT - Operaciones específicas por tipo
            const rfcSolicitante = this.session.rfc;

            // Determinar operación y SOAPAction según tipo (nombres oficiales del WSDL)
            const operacion = tipo === 'emitidas' ? 'SolicitaDescargaEmitidos' : 'SolicitaDescargaRecibidos';
            const soapAction = `http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/${operacion}`;

            // Construir parámetros según tipo
            let rfcEmisorParam = rfcEmisor || (tipo === 'emitidas' ? rfcSolicitante : '');
            let rfcReceptorParam = rfcReceptor || (tipo === 'recibidas' ? rfcSolicitante : '');

            // Crear XML de solicitud según especificación del SAT v1.5
            // NOTA: TipoSolicitud ya no se usa en v1.5, se especifica en el nombre de la operación
            let atributoRfcEmisor = rfcEmisorParam ? ` RfcEmisor="${rfcEmisorParam}"` : '';
            let atributoRfcReceptor = rfcReceptorParam ? ` RfcReceptor="${rfcReceptorParam}"` : '';

            const solicitudXML = `<des:${operacion}>
    <des:solicitud FechaInicial="${fechaInicioSAT}" FechaFinal="${fechaFinSAT}"${atributoRfcEmisor}${atributoRfcReceptor}/>
</des:${operacion}>`;

            // Crear SOAP envelope
            const soapEnvelope = this.createSignedSOAP(solicitudXML);

            // DEBUG: Mostrar XML que se enviará
            console.log('\n📤 XML SOAP que se enviará al SAT:');
            console.log('─'.repeat(60));
            console.log(soapEnvelope);
            console.log('─'.repeat(60));

            // Enviar solicitud al endpoint de solicitud del SAT
            const response = await this.client.post(this.wsdlSolicitud, soapEnvelope, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': soapAction
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

            // Mostrar detalles del error si está disponible
            if (error.response) {
                console.error('📋 Detalles del error del SAT:');
                console.error('   Status:', error.response.status);
                console.error('   Headers:', JSON.stringify(error.response.headers, null, 2));
                console.error('   Data:', typeof error.response.data === 'string'
                    ? error.response.data.substring(0, 500)
                    : JSON.stringify(error.response.data, null, 2));
            }

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
                    'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/DescargaMasivaTerceros/IVerificaSolicitudDescarga'
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
                    'SOAPAction': 'http://DescargaMasivaTerceros.sat.gob.mx/DescargaMasivaTerceros/IDescargar'
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
