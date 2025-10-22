import express from 'express';
import satWebServiceV2 from '../services/satWebServiceV2.js';
import xmlAnalyzer from '../services/xmlAnalyzer.js';
import facturaStorage from '../services/facturaStorage.js';
import path from 'path';
import fs from 'fs-extra';

const router = express.Router();

/**
 * POST /api/download-ws/emitidas
 * Descargar facturas emitidas usando Web Service del SAT
 */
router.post('/emitidas', async (req, res) => {
    try {
        // Verificar sesión
        if (!satWebServiceV2.isAuthenticated()) {
            return res.status(401).json({
                success: false,
                error: 'No hay sesión activa. Debe autenticarse con e.firma primero.'
            });
        }

        const { fechaInicio, fechaFin } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                success: false,
                error: 'Fecha de inicio y fecha fin son requeridas (formato: YYYY-MM-DD)'
            });
        }

        const session = satWebServiceV2.getSession();
        const rfc = session.rfc;

        // Crear directorio para esta descarga
        const timestamp = Date.now();
        const downloadPath = path.join(
            process.env.DOWNLOAD_PATH || './downloads',
            rfc,
            'emitidas',
            timestamp.toString()
        );
        await fs.ensureDir(downloadPath);

        // Iniciar descarga masiva en background
        console.log(`\n🚀 Iniciando descarga masiva de facturas emitidas para ${rfc}`);
        console.log(`   Período: ${fechaInicio} - ${fechaFin}\n`);

        // Realizar descarga completa
        const result = await satWebServiceV2.descargarMasivo('emitidas', fechaInicio, fechaFin, downloadPath);

        if (!result.success) {
            return res.status(500).json(result);
        }

        // Opción: Clasificar automáticamente
        const { clasificar = true, verificarEstado = false, guardarRespaldo = true } = req.body;

        let clasificacion = null;
        let respaldo = null;

        if (clasificar && result.total > 0) {
            console.log('\n📊 Clasificando facturas...\n');
            clasificacion = await xmlAnalyzer.procesarCompleto(downloadPath, {
                verificarEstado: verificarEstado,
                organizarPorClasificacion: true,
                generarReporteJSON: true,
                delayVerificacion: 500
            });

            // Guardar respaldo automático en base de datos
            if (guardarRespaldo && clasificacion.success) {
                console.log('\n💾 Guardando respaldo en base de datos...\n');
                respaldo = await facturaStorage.guardarFacturasLote(
                    rfc,
                    clasificacion.analisis,
                    downloadPath
                );
            }
        }

        res.json({
            success: true,
            rfc,
            tipo: 'emitidas',
            fechaInicio,
            fechaFin,
            idSolicitud: result.idSolicitud,
            numeroCFDIs: result.numeroCFDIs,
            paquetes: result.paquetes,
            archivosDescargados: result.total,
            archivos: result.archivos.map(a => ({
                filename: a.filename,
                size: a.size
            })),
            downloadPath,
            clasificacion: clasificacion ? {
                vigentes: clasificacion.analisis?.porEstado.vigente.length || 0,
                cancelados: clasificacion.analisis?.porEstado.cancelado.length || 0,
                nomina: clasificacion.analisis?.porTipo.nomina.length || 0,
                reporte: clasificacion.reporte
            } : null,
            respaldo: respaldo ? {
                guardadas: respaldo.guardadas,
                actualizadas: respaldo.actualizadas,
                errores: respaldo.errores,
                estadisticas: respaldo.estadisticas
            } : null
        });

    } catch (error) {
        console.error('Error en descarga de emitidas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/download-ws/recibidas
 * Descargar facturas recibidas usando Web Service del SAT
 */
router.post('/recibidas', async (req, res) => {
    try {
        // Verificar sesión
        if (!satWebServiceV2.isAuthenticated()) {
            return res.status(401).json({
                success: false,
                error: 'No hay sesión activa. Debe autenticarse con e.firma primero.'
            });
        }

        const { fechaInicio, fechaFin } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                success: false,
                error: 'Fecha de inicio y fecha fin son requeridas (formato: YYYY-MM-DD)'
            });
        }

        const session = satWebServiceV2.getSession();
        const rfc = session.rfc;

        // Crear directorio para esta descarga
        const timestamp = Date.now();
        const downloadPath = path.join(
            process.env.DOWNLOAD_PATH || './downloads',
            rfc,
            'recibidas',
            timestamp.toString()
        );
        await fs.ensureDir(downloadPath);

        console.log(`\n🚀 Iniciando descarga masiva de facturas recibidas para ${rfc}`);
        console.log(`   Período: ${fechaInicio} - ${fechaFin}\n`);

        // Realizar descarga completa
        const result = await satWebServiceV2.descargarMasivo('recibidas', fechaInicio, fechaFin, downloadPath);

        if (!result.success) {
            return res.status(500).json(result);
        }

        // Opción: Clasificar automáticamente
        const { clasificar = true, verificarEstado = false, guardarRespaldo = true } = req.body;

        let clasificacion = null;
        let respaldo = null;

        if (clasificar && result.total > 0) {
            console.log('\n📊 Clasificando facturas...\n');
            clasificacion = await xmlAnalyzer.procesarCompleto(downloadPath, {
                verificarEstado: verificarEstado,
                organizarPorClasificacion: true,
                generarReporteJSON: true,
                delayVerificacion: 500
            });

            // Guardar respaldo automático en base de datos
            if (guardarRespaldo && clasificacion.success) {
                console.log('\n💾 Guardando respaldo en base de datos...\n');
                respaldo = await facturaStorage.guardarFacturasLote(
                    rfc,
                    clasificacion.analisis,
                    downloadPath
                );
            }
        }

        res.json({
            success: true,
            rfc,
            tipo: 'recibidas',
            fechaInicio,
            fechaFin,
            idSolicitud: result.idSolicitud,
            numeroCFDIs: result.numeroCFDIs,
            paquetes: result.paquetes,
            archivosDescargados: result.total,
            archivos: result.archivos.map(a => ({
                filename: a.filename,
                size: a.size
            })),
            downloadPath,
            clasificacion: clasificacion ? {
                vigentes: clasificacion.analisis?.porEstado.vigente.length || 0,
                cancelados: clasificacion.analisis?.porEstado.cancelado.length || 0,
                nomina: clasificacion.analisis?.porTipo.nomina.length || 0,
                reporte: clasificacion.reporte
            } : null,
            respaldo: respaldo ? {
                guardadas: respaldo.guardadas,
                actualizadas: respaldo.actualizadas,
                errores: respaldo.errores,
                estadisticas: respaldo.estadisticas
            } : null
        });

    } catch (error) {
        console.error('Error en descarga de recibidas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/download-ws/solicitar
 * Crear solicitud de descarga (paso 1)
 */
router.post('/solicitar', async (req, res) => {
    try {
        if (!satWebServiceV2.isAuthenticated()) {
            return res.status(401).json({
                success: false,
                error: 'No hay sesión activa'
            });
        }

        const { tipo, fechaInicio, fechaFin, rfcReceptor, rfcEmisor } = req.body;

        if (!tipo || !fechaInicio || !fechaFin) {
            return res.status(400).json({
                success: false,
                error: 'Tipo, fecha de inicio y fecha fin son requeridos'
            });
        }

        const result = await satWebServiceV2.solicitarDescarga(
            tipo,
            fechaInicio,
            fechaFin,
            rfcReceptor,
            rfcEmisor
        );

        res.json(result);

    } catch (error) {
        console.error('Error solicitando descarga:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/download-ws/verificar/:idSolicitud
 * Verificar estado de solicitud (paso 2)
 */
router.get('/verificar/:idSolicitud', async (req, res) => {
    try {
        if (!satWebServiceV2.isAuthenticated()) {
            return res.status(401).json({
                success: false,
                error: 'No hay sesión activa'
            });
        }

        const { idSolicitud } = req.params;
        const result = await satWebServiceV2.verificarSolicitud(idSolicitud);

        res.json(result);

    } catch (error) {
        console.error('Error verificando solicitud:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/download-ws/descargar-paquete
 * Descargar paquete específico (paso 3)
 */
router.post('/descargar-paquete', async (req, res) => {
    try {
        if (!satWebServiceV2.isAuthenticated()) {
            return res.status(401).json({
                success: false,
                error: 'No hay sesión activa'
            });
        }

        const { idPaquete, outputPath } = req.body;

        if (!idPaquete) {
            return res.status(400).json({
                success: false,
                error: 'ID de paquete es requerido'
            });
        }

        const session = satWebServiceV2.getSession();
        const rfc = session.rfc;

        const downloadPath = outputPath || path.join(
            process.env.DOWNLOAD_PATH || './downloads',
            rfc,
            'paquetes',
            Date.now().toString()
        );

        const result = await satWebServiceV2.descargarPaquete(idPaquete, downloadPath);

        if (result.success) {
            res.json({
                ...result,
                downloadPath
            });
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('Error descargando paquete:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/download-ws/clasificar
 * Clasificar XMLs ya descargados
 */
router.post('/clasificar', async (req, res) => {
    try {
        const { directorio, verificarEstado = true } = req.body;

        if (!directorio) {
            return res.status(400).json({
                success: false,
                error: 'Directorio es requerido'
            });
        }

        // Verificar que el directorio existe
        const exists = await fs.pathExists(directorio);
        if (!exists) {
            return res.status(404).json({
                success: false,
                error: 'Directorio no encontrado'
            });
        }

        console.log(`\n📊 Clasificando facturas en: ${directorio}\n`);

        const resultado = await xmlAnalyzer.procesarCompleto(directorio, {
            verificarEstado: verificarEstado,
            organizarPorClasificacion: true,
            generarReporteJSON: true,
            delayVerificacion: 500
        });

        if (resultado.success) {
            res.json({
                success: true,
                directorio,
                resumen: {
                    total: resultado.analisis.total,
                    analizados: resultado.analisis.analizados,
                    errores: resultado.analisis.errores
                },
                porTipo: {
                    ingreso: resultado.analisis.porTipo.ingreso.length,
                    egreso: resultado.analisis.porTipo.egreso.length,
                    traslado: resultado.analisis.porTipo.traslado.length,
                    nomina: resultado.analisis.porTipo.nomina.length,
                    pago: resultado.analisis.porTipo.pago.length
                },
                porEstado: {
                    vigente: resultado.analisis.porEstado.vigente.length,
                    cancelado: resultado.analisis.porEstado.cancelado.length,
                    noVerificado: resultado.analisis.porEstado.noVerificado.length
                },
                reporte: resultado.reporte
            });
        } else {
            res.status(500).json(resultado);
        }

    } catch (error) {
        console.error('Error clasificando facturas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/download-ws/verificar-estado
 * Verificar estado de un XML en el SAT
 */
router.post('/verificar-estado', async (req, res) => {
    try {
        const { uuid, rfcEmisor, rfcReceptor, total } = req.body;

        if (!uuid || !rfcEmisor || !rfcReceptor || total === undefined) {
            return res.status(400).json({
                success: false,
                error: 'UUID, RFC Emisor, RFC Receptor y Total son requeridos'
            });
        }

        const resultado = await xmlAnalyzer.verificarEstadoSAT(uuid, rfcEmisor, rfcReceptor, total);
        res.json(resultado);

    } catch (error) {
        console.error('Error verificando estado:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/download-ws/analizar-xml
 * Analizar un archivo XML específico
 */
router.post('/analizar-xml', async (req, res) => {
    try {
        const { xmlPath } = req.body;

        if (!xmlPath) {
            return res.status(400).json({
                success: false,
                error: 'Ruta del XML es requerida'
            });
        }

        const exists = await fs.pathExists(xmlPath);
        if (!exists) {
            return res.status(404).json({
                success: false,
                error: 'Archivo XML no encontrado'
            });
        }

        const resultado = await xmlAnalyzer.analizarXML(xmlPath);
        res.json(resultado);

    } catch (error) {
        console.error('Error analizando XML:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
