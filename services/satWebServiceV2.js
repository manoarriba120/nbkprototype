import { Fiel, HttpsWebClient, FielRequestBuilder, Service, QueryParameters, DateTimePeriod, RequestType, DownloadType, DownloadTypeEnum, RequestTypeEnum, RfcMatches, DocumentStatus } from '@nodecfdi/sat-ws-descarga-masiva';
import fs from 'fs-extra';
import path from 'path';
import JSZip from 'jszip';
import solicitudCache from './solicitudCache.js';

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
            // Si solo viene fecha (YYYY-MM-DD), agregar hora
            const formatearFecha = (fecha) => {
                if (fecha.includes('T')) {
                    return fecha.replace('T', ' ').substring(0, 19);
                }
                // Si es fecha sin hora, agregar hora
                return fecha + ' 00:00:00';
            };

            const fechaInicioFormateada = formatearFecha(fechaInicio);
            // Para fecha fin, usar 23:59:59 para incluir todo el día
            const fechaFinFormateada = fechaFin.includes('T')
                ? fechaFin.replace('T', ' ').substring(0, 19)
                : fechaFin + ' 23:59:59';

            const period = DateTimePeriod.createFromValues(
                fechaInicioFormateada,
                fechaFinFormateada
            );

            console.log(`   📅 Período formateado: ${fechaInicioFormateada} a ${fechaFinFormateada}`);

            // Determinar tipo de descarga (emitidas o recibidas)
            // Usar el enum para crear la instancia
            const downloadTypeValue = tipo === 'emitidas' ? 'issued' : 'received';
            const downloadType = new DownloadType(downloadTypeValue);

            // Tipo de solicitud: CFDI (XML)
            const requestType = new RequestType('xml');

            // Crear parámetros de consulta
            let queryParams = QueryParameters.create(period, downloadType, requestType);

            // NO agregamos filtro de DocumentStatus para descargar TODAS (vigentes + canceladas)
            // tanto para emitidas como para recibidas

            // Agregar filtros por RFC si se especificaron
            if (rfcEmisor || rfcReceptor) {
                const rfcFiltro = rfcEmisor || rfcReceptor || this.session.rfc;
                const rfcMatches = RfcMatches.createFromValues(rfcFiltro);
                queryParams = queryParams.withRfcMatches(rfcMatches);
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
            console.error('   Error completo:', error);

            // Extraer mensaje de error más detallado
            let errorMsg = error.message || 'Error desconocido';

            // Si es un error de la librería @nodecfdi con respuesta HTTP
            if (error.response) {
                errorMsg = `Error HTTP ${error.response.status}: ${error.response.statusText || 'Error del SAT'}`;
                if (error.response.data) {
                    console.error('   Respuesta SAT:', error.response.data);
                    errorMsg += ` - ${JSON.stringify(error.response.data)}`;
                }
            }

            return {
                success: false,
                error: errorMsg
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
            const statusRequest = verifyResult.getStatusRequest();

            // Obtener código de estado de forma segura
            let codigoEstado = null;
            try {
                // Intentar obtener el código de estado del statusRequest
                codigoEstado = statusRequest.getValue ? statusRequest.getValue() : null;
            } catch (e) {
                // Si falla, intentar obtenerlo del status
                try {
                    codigoEstado = verifyResult.getStatus().getCode ? verifyResult.getStatus().getCode() : null;
                } catch (e2) {
                    console.log('   ℹ️  No se pudo obtener código de estado');
                }
            }

            console.log(`   Estado: ${estado}`);
            if (codigoEstado) console.log(`   Código estado: ${codigoEstado}`);
            console.log(`   Status Request: ${statusRequest}`);
            console.log(`   CFDIs encontrados: ${numeroCFDIs}`);
            console.log(`   Paquetes: ${paquetes.length}`);

            // Verificar si está terminado: puede ser "Finished" o simplemente tener paquetes disponibles
            const isFinished = statusRequest.isTypeOf('Finished') ||
                              (statusRequest.isTypeOf('Accepted') && paquetes.length > 0) ||
                              (codigoEstado === 5000) || // Código 5000 = Solicitud terminada
                              (paquetes.length > 0); // Si hay paquetes, está listo

            return {
                success: true,
                estado: estado,
                isAccepted: verifyResult.getStatus().isAccepted(),
                isFinished: isFinished,
                paquetes: paquetes,
                numeroCFDIs: numeroCFDIs,
                statusRequest: statusRequest.toString(),
                codigoEstado: codigoEstado
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

            // Descomprimir ZIP y leer metadatos
            const zip = await JSZip.loadAsync(zipBuffer);
            const archivos = [];
            let metadatos = null;

            // Primero buscar archivo de metadatos (generalmente tiene un nombre específico)
            for (const [filename, file] of Object.entries(zip.files)) {
                if (!file.dir && !filename.endsWith('.xml')) {
                    // Podría ser archivo de metadatos (txt, json, etc)
                    const content = await file.async('string');
                    console.log(`📄 Archivo encontrado: ${filename}`);
                    if (content.includes('UUID') || content.includes('uuid')) {
                        metadatos = { filename, content };
                    }
                }
            }

            // Extraer XMLs
            for (const [filename, file] of Object.entries(zip.files)) {
                if (!file.dir && filename.endsWith('.xml')) {
                    const content = await file.async('nodebuffer');
                    const filePath = path.join(outputPath, filename);
                    await fs.writeFile(filePath, content);
                    archivos.push(filename);
                }
            }

            console.log(`✓ Paquete descargado: ${archivos.length} archivos XML`);
            if (metadatos) {
                console.log(`  📋 Metadatos encontrados en: ${metadatos.filename}`);
            }

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
     * Buscar solicitudes que puedan reutilizarse cuando se alcanza el límite
     */
    async buscarSolicitudesReutilizables(rfc, tipo, fechaInicio, fechaFin) {
        const solicitudes = await solicitudCache.listarSolicitudes();

        // Filtrar solicitudes del mismo RFC, tipo y que contengan el período solicitado
        const fechaInicioDate = new Date(fechaInicio);
        const fechaFinDate = new Date(fechaFin);

        return solicitudes.filter(s => {
            if (s.rfc !== rfc || s.tipo !== tipo || !s.valida) return false;

            const sInicio = new Date(s.fechaInicio);
            const sFin = new Date(s.fechaFin);

            // Verificar si la solicitud en caché cubre el período solicitado
            return sInicio <= fechaInicioDate && sFin >= fechaFinDate;
        }).sort((a, b) => a.edad - b.edad); // Ordenar por más reciente primero
    }

    /**
     * Descarga masiva completa (solicitud + verificación + descarga)
     */
    async descargaMasiva(tipo, fechaInicio, fechaFin, outputPath = './downloads') {
        try {
            console.log('\n🚀 Iniciando descarga masiva...\n');

            const rfc = this.session.rfc;
            let idSolicitud;

            // 1. Buscar solicitud existente en caché
            const solicitudEnCache = await solicitudCache.buscarSolicitud(rfc, tipo, fechaInicio, fechaFin);

            if (solicitudEnCache) {
                console.log('♻️  Reutilizando solicitud existente (ahorro de cuota SAT)\n');
                idSolicitud = solicitudEnCache.idSolicitud;
            } else {
                // 2. Crear nueva solicitud solo si no hay en caché
                console.log('📝 Creando nueva solicitud en el SAT...\n');
                const solicitud = await this.solicitarDescarga(tipo, fechaInicio, fechaFin);

                if (!solicitud.success) {
                    // Si falla por límite de solicitudes, buscar solicitudes recientes que puedan servir
                    if (solicitud.error.includes('agotado') || solicitud.error.includes('límite')) {
                        console.log('\n⚠️  Límite de solicitudes alcanzado');
                        console.log('💡 Buscando solicitudes recientes que puedan reutilizarse...\n');

                        const solicitudesRecientes = await this.buscarSolicitudesReutilizables(rfc, tipo, fechaInicio, fechaFin);
                        if (solicitudesRecientes.length > 0) {
                            console.log(`✓ Se encontraron ${solicitudesRecientes.length} solicitudes reutilizables`);
                            idSolicitud = solicitudesRecientes[0].idSolicitud;
                        } else {
                            throw new Error('Límite de solicitudes SAT alcanzado. Intente más tarde o use períodos más amplios para reutilizar solicitudes existentes.');
                        }
                    } else {
                        throw new Error(solicitud.error);
                    }
                } else {
                    idSolicitud = solicitud.idSolicitud;
                    // Guardar en caché
                    await solicitudCache.guardarSolicitud(rfc, tipo, fechaInicio, fechaFin, idSolicitud);
                }
            }

            // 2. Esperar y verificar solicitud
            console.log('\n⏳ Esperando procesamiento de solicitud...\n');

            let verificacion;
            let intentos = 0;
            const maxIntentos = 30;
            let verificacionesSinCambio = 0;
            let numeroCFDIsPrevio = 0;

            do {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
                verificacion = await this.verificarSolicitud(idSolicitud);
                intentos++;

                if (!verificacion.success) {
                    throw new Error(verificacion.error);
                }

                // Detectar si la solicitud está estancada (sin CFDIs y sin cambios)
                if (verificacion.numeroCFDIs === 0 && verificacion.paquetes.length === 0) {
                    verificacionesSinCambio++;

                    // Si después de 6 verificaciones (30 segundos) sigue sin facturas Y el código es 5004 (sin resultados), terminar
                    if (verificacionesSinCambio >= 6 && (verificacion.codigoEstado === 5004 || verificacion.codigoEstado === '5004')) {
                        console.log('⚠️  No se encontraron CFDIs en el período solicitado (código SAT: 5004 - Sin datos)');
                        return {
                            success: true,
                            mensaje: 'No se encontraron CFDIs en el período especificado',
                            archivos: [],
                            total: 0
                        };
                    }

                    // También terminar si después de 12 verificaciones (60 segundos) no hay cambios
                    if (verificacionesSinCambio >= 12) {
                        console.log('⚠️  No se encontraron CFDIs en el período solicitado (timeout sin resultados)');
                        return {
                            success: true,
                            mensaje: 'No se encontraron CFDIs en el período especificado',
                            archivos: [],
                            total: 0
                        };
                    }
                } else {
                    // Si hay CFDIs o paquetes, resetear contador
                    verificacionesSinCambio = 0;
                    numeroCFDIsPrevio = verificacion.numeroCFDIs;
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
                    archivos: [],
                    total: 0
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
            console.log(`ℹ️  Para validar estados (vigente/cancelado), ejecuta:\n   node reprocesar-facturas.js <RFC> <emitidas|recibidas>\n`);

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
