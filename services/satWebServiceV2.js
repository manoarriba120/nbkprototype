import { Fiel, HttpsWebClient, FielRequestBuilder, Service, QueryParameters, DateTimePeriod, RequestType, DownloadType, DownloadTypeEnum, RequestTypeEnum, RfcMatches } from '@nodecfdi/sat-ws-descarga-masiva';
import fs from 'fs-extra';
import path from 'path';
import JSZip from 'jszip';

/**
 * Servicio de descarga masiva del SAT usando la librería oficial @nodecfdi
 * Versión 1.5 del SAT (mayo 2025)
 */
class SATWebServiceV2 {
    constructor() {
        this.fiel = null;
        this.service = null;
        this.session = null;
    }

    /**
     * Autenticación con e.firma usando la librería oficial
     */
    async loginWithEFirma(certificatePath, keyPath, password) {
        try {
            console.log('🔐 Autenticando con e.firma...');

            // Leer archivos de certificado y llave
            const cerBuffer = await fs.readFile(certificatePath, 'binary');
            const keyBuffer = await fs.readFile(keyPath, 'binary');

            // Crear FIEL usando la librería oficial
            this.fiel = Fiel.create(cerBuffer, keyBuffer, password);

            // Verificar que sea una FIEL válida
            if (!this.fiel.isValid()) {
                throw new Error('El certificado no es una FIEL válida o está vencido');
            }

            // Extraer RFC del certificado
            const rfc = this.fiel.getRfc();

            // Crear servicio web
            const webClient = new HttpsWebClient();
            const requestBuilder = new FielRequestBuilder(this.fiel);
            this.service = new Service(requestBuilder, webClient);

            // Obtener fecha de validez del certificado
            const certSerial = this.fiel.getCertificateSerial();

            // Guardar sesión
            this.session = {
                rfc: rfc,
                authenticated: true,
                authMethod: 'efirma',
                timestamp: new Date(),
                certSerial: certSerial
            };

            console.log(`✓ Autenticado exitosamente: ${rfc}`);
            console.log(`✓ Certificado serial: ${certSerial}`);

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
     * Solicitar descarga masiva de CFDIs
     */
    async solicitarDescarga(tipo, fechaInicio, fechaFin, rfcReceptor = null, rfcEmisor = null) {
        try {
            if (!this.service || !this.session) {
                throw new Error('Debe autenticarse con e.firma primero');
            }

            console.log(`📥 Solicitando descarga de CFDIs ${tipo}...`);
            console.log(`   Período: ${fechaInicio} - ${fechaFin}`);

            // Crear período de tiempo (formato: YYYY-MM-DD HH:MM:SS)
            const fechaInicioFormateada = fechaInicio.replace('T', ' ').substring(0, 19);
            const fechaFinFormateada = fechaFin.replace('T', ' ').substring(0, 19);

            const period = DateTimePeriod.createFromValues(
                fechaInicioFormateada,
                fechaFinFormateada
            );

            // Determinar tipo de descarga (emitidas o recibidas)
            // Usar el enum para crear la instancia
            const downloadTypeValue = tipo === 'emitidas' ? 'issued' : 'received';
            const downloadType = new DownloadType(downloadTypeValue);

            // Tipo de solicitud: CFDI (XML)
            const requestType = new RequestType('xml');

            // Crear parámetros de consulta
            const queryParams = QueryParameters.create(period, downloadType, requestType);

            // Agregar filtros por RFC si se especificaron
            if (rfcEmisor || rfcReceptor) {
                const rfcFiltro = rfcEmisor || rfcReceptor || this.session.rfc;
                const rfcMatches = RfcMatches.createFromValues(rfcFiltro);
                queryParams.withRfcMatches(rfcMatches);
            }

            // Enviar solicitud
            const queryResult = await this.service.query(queryParams);

            if (!queryResult.getStatus().isAccepted()) {
                throw new Error(`Error en solicitud: ${queryResult.getStatus().getMessage()}`);
            }

            const idSolicitud = queryResult.getRequestId();
            console.log(`✓ Solicitud creada: ${idSolicitud}`);
            console.log(`   Estado: ${queryResult.getStatus().getMessage()}`);

            return {
                success: true,
                idSolicitud: idSolicitud,
                mensaje: queryResult.getStatus().getMessage()
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
     * Verificar estado de solicitud
     */
    async verificarSolicitud(idSolicitud) {
        try {
            if (!this.service) {
                throw new Error('Debe autenticarse con e.firma primero');
            }

            console.log(`🔍 Verificando solicitud: ${idSolicitud}`);

            const verifyResult = await this.service.verify(idSolicitud);

            const estado = verifyResult.getStatus().getMessage();
            const paquetes = verifyResult.getPackageIds();
            const numeroCFDIs = verifyResult.getNumberCfdis();

            console.log(`   Estado: ${estado}`);
            console.log(`   CFDIs encontrados: ${numeroCFDIs}`);
            console.log(`   Paquetes: ${paquetes.length}`);

            return {
                success: true,
                estado: estado,
                isAccepted: verifyResult.getStatus().isAccepted(),
                isFinished: verifyResult.getStatusRequest().isTypeOf('Finished'),
                paquetes: paquetes,
                numeroCFDIs: numeroCFDIs
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
     * Descargar paquete
     */
    async descargarPaquete(idPaquete, outputPath = './downloads') {
        try {
            if (!this.service) {
                throw new Error('Debe autenticarse con e.firma primero');
            }

            console.log(`📦 Descargando paquete: ${idPaquete}`);

            const downloadResult = await this.service.download(idPaquete);

            if (!downloadResult.getStatus().isAccepted()) {
                throw new Error(`Error al descargar: ${downloadResult.getStatus().getMessage()}`);
            }

            // Obtener contenido del paquete (ZIP en base64)
            const packageContent = downloadResult.getPackageContent();

            // Decodificar base64 a buffer
            const zipBuffer = Buffer.from(packageContent, 'base64');

            // Guardar ZIP
            await fs.ensureDir(outputPath);
            const zipPath = path.join(outputPath, `${idPaquete}.zip`);
            await fs.writeFile(zipPath, zipBuffer);

            // Descomprimir ZIP
            const zip = await JSZip.loadAsync(zipBuffer);
            const archivos = [];

            for (const [filename, file] of Object.entries(zip.files)) {
                if (!file.dir) {
                    const content = await file.async('nodebuffer');
                    const filePath = path.join(outputPath, filename);
                    await fs.writeFile(filePath, content);
                    archivos.push(filename);
                }
            }

            console.log(`✓ Paquete descargado: ${archivos.length} archivos`);

            return {
                success: true,
                zipPath: zipPath,
                archivos: archivos,
                outputPath: outputPath
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
     * Descarga masiva completa (solicitud + verificación + descarga)
     */
    async descargaMasiva(tipo, fechaInicio, fechaFin, outputPath = './downloads') {
        try {
            console.log('\n🚀 Iniciando descarga masiva...\n');

            // 1. Solicitar descarga
            const solicitud = await this.solicitarDescarga(tipo, fechaInicio, fechaFin);
            if (!solicitud.success) {
                throw new Error(solicitud.error);
            }

            const idSolicitud = solicitud.idSolicitud;

            // 2. Esperar y verificar solicitud
            console.log('\n⏳ Esperando procesamiento de solicitud...\n');

            let verificacion;
            let intentos = 0;
            const maxIntentos = 30;

            do {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
                verificacion = await this.verificarSolicitud(idSolicitud);
                intentos++;

                if (!verificacion.success) {
                    throw new Error(verificacion.error);
                }

            } while (!verificacion.isFinished && intentos < maxIntentos);

            if (!verificacion.isFinished) {
                throw new Error('Timeout: La solicitud no se completó en el tiempo esperado');
            }

            if (verificacion.paquetes.length === 0) {
                console.log('⚠️  No se encontraron CFDIs en el período solicitado');
                return {
                    success: true,
                    mensaje: 'No se encontraron CFDIs',
                    archivos: []
                };
            }

            // 3. Descargar todos los paquetes
            console.log('\n📥 Descargando paquetes...\n');

            const todosLosArchivos = [];

            for (const idPaquete of verificacion.paquetes) {
                const descarga = await this.descargarPaquete(idPaquete, outputPath);
                if (descarga.success) {
                    todosLosArchivos.push(...descarga.archivos);
                }
            }

            console.log(`\n✅ Descarga completa: ${todosLosArchivos.length} archivos descargados\n`);

            return {
                success: true,
                mensaje: `Descargados ${todosLosArchivos.length} archivos`,
                idSolicitud: idSolicitud,
                numeroCFDIs: verificacion.numeroCFDIs,
                paquetes: verificacion.paquetes,
                total: todosLosArchivos.length,
                archivos: todosLosArchivos.map(filename => ({
                    filename: filename,
                    path: path.join(outputPath, filename)
                })),
                outputPath: outputPath
            };

        } catch (error) {
            console.error('❌ Error en descarga masiva:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener sesión actual
     */
    getSession() {
        return this.session;
    }

    /**
     * Verificar si está autenticado
     */
    isAuthenticated() {
        return this.session && this.session.authenticated;
    }

    /**
     * Cerrar sesión
     */
    logout() {
        this.fiel = null;
        this.service = null;
        this.session = null;

        return {
            success: true,
            message: 'Sesión cerrada'
        };
    }

    /**
     * Alias para compatibilidad con código anterior
     */
    async descargarMasivo(tipo, fechaInicio, fechaFin, outputPath = './downloads') {
        return await this.descargaMasiva(tipo, fechaInicio, fechaFin, outputPath);
    }
}

// Exportar instancia única (singleton)
const satWebServiceV2 = new SATWebServiceV2();
export default satWebServiceV2;
