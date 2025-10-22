import express from 'express';
import satWebServiceV2 from '../services/satWebServiceV2.js';
import solicitudCache from '../services/solicitudCache.js';

const router = express.Router();

/**
 * POST /api/batch/descargar-multiple
 * Descargar facturas para múltiples empresas de manera eficiente
 */
router.post('/descargar-multiple', async (req, res) => {
    try {
        const { empresas, fechaInicio, fechaFin, tipo = 'emitidas' } = req.body;

        if (!empresas || !Array.isArray(empresas) || empresas.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de empresas con sus certificados'
            });
        }

        console.log(`\n📦 Iniciando descarga por lotes para ${empresas.length} empresas\n`);

        const resultados = [];
        let exitosas = 0;
        let fallidas = 0;
        let reutilizadas = 0;

        for (let i = 0; i < empresas.length; i++) {
            const empresa = empresas[i];
            console.log(`\n[${i + 1}/${empresas.length}] Procesando: ${empresa.rfc}`);

            try {
                // Autenticar con e.firma
                const auth = await satWebServiceV2.loginWithEFirma(
                    empresa.certificadoPath,
                    empresa.keyPath,
                    empresa.password
                );

                if (!auth.success) {
                    throw new Error(auth.error);
                }

                // Verificar si ya existe una solicitud en caché
                const solicitudEnCache = await solicitudCache.buscarSolicitud(
                    empresa.rfc,
                    tipo,
                    fechaInicio,
                    fechaFin
                );

                if (solicitudEnCache) {
                    console.log(`  ♻️  Solicitud en caché - No consume cuota SAT`);
                    reutilizadas++;
                }

                // Realizar descarga
                const resultado = await satWebServiceV2.descargarMasivo(
                    tipo,
                    fechaInicio,
                    fechaFin,
                    `./downloads/${empresa.rfc}/temp_${tipo}`
                );

                if (resultado.success) {
                    exitosas++;
                    resultados.push({
                        rfc: empresa.rfc,
                        success: true,
                        total: resultado.total || 0,
                        mensaje: resultado.mensaje,
                        reutilizada: !!solicitudEnCache
                    });
                } else {
                    fallidas++;
                    resultados.push({
                        rfc: empresa.rfc,
                        success: false,
                        error: resultado.error
                    });
                }

                // Cerrar sesión
                satWebServiceV2.logout();

                // Pequeña pausa entre empresas para no saturar el SAT
                if (i < empresas.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                fallidas++;
                resultados.push({
                    rfc: empresa.rfc,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log(`\n✅ Descarga por lotes completada:`);
        console.log(`   Exitosas: ${exitosas}`);
        console.log(`   Fallidas: ${fallidas}`);
        console.log(`   Reutilizadas: ${reutilizadas} (ahorro de cuota)\n`);

        res.json({
            success: true,
            resumen: {
                total: empresas.length,
                exitosas,
                fallidas,
                reutilizadas
            },
            resultados
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/batch/estadisticas-cache
 * Obtener estadísticas del caché de solicitudes
 */
router.get('/estadisticas-cache', async (req, res) => {
    try {
        const stats = await solicitudCache.obtenerEstadisticas();
        const solicitudes = await solicitudCache.listarSolicitudes();

        res.json({
            success: true,
            estadisticas: stats,
            solicitudes: solicitudes.map(s => ({
                rfc: s.rfc,
                tipo: s.tipo,
                periodo: `${s.fechaInicio.split(' ')[0]} a ${s.fechaFin.split(' ')[0]}`,
                edad: `${s.edad} horas`,
                valida: s.valida,
                idSolicitud: s.idSolicitud
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/batch/limpiar-cache
 * Limpiar solicitudes expiradas del caché
 */
router.post('/limpiar-cache', async (req, res) => {
    try {
        await solicitudCache.limpiarExpiradas();

        res.json({
            success: true,
            mensaje: 'Caché limpiado exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/batch/estrategia-periodos
 * Generar estrategia de descarga por períodos mensuales
 */
router.post('/estrategia-periodos', async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fechaInicio y fechaFin'
            });
        }

        // Dividir el período en meses
        const periodos = [];
        let inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        while (inicio < fin) {
            const finMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
            const finPeriodo = finMes < fin ? finMes : fin;

            periodos.push({
                inicio: inicio.toISOString().split('T')[0],
                fin: finPeriodo.toISOString().split('T')[0],
                descripcion: inicio.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })
            });

            inicio = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
        }

        res.json({
            success: true,
            periodos,
            total: periodos.length,
            recomendacion: periodos.length > 3
                ? 'Se recomienda descargar por períodos mensuales para optimizar el uso de cuota SAT'
                : 'El período es corto, puede descargarse en una sola solicitud'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
