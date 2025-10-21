import express from 'express';
import facturaStorage from '../services/facturaStorage.js';

const router = express.Router();

/**
 * GET /api/facturas/empresas
 * Listar todas las empresas con facturas guardadas
 */
router.get('/empresas', async (req, res) => {
    try {
        const resultado = await facturaStorage.listarEmpresas();
        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc
 * Obtener todas las facturas de una empresa
 */
router.get('/:rfc', async (req, res) => {
    try {
        const { rfc } = req.params;
        const filtros = {
            tipo: req.query.tipo,
            esNomina: req.query.esNomina === 'true',
            estado: req.query.estado,
            fechaInicio: req.query.fechaInicio,
            fechaFin: req.query.fechaFin,
            emisor: req.query.emisor,
            receptor: req.query.receptor,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 100
        };

        const resultado = await facturaStorage.obtenerFacturasEmpresa(rfc, filtros);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc/estadisticas
 * Obtener estadísticas de facturas de una empresa
 */
router.get('/:rfc/estadisticas', async (req, res) => {
    try {
        const { rfc } = req.params;
        const resultado = await facturaStorage.obtenerEstadisticas(rfc);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc/uuid/:uuid
 * Buscar factura por UUID
 */
router.get('/:rfc/uuid/:uuid', async (req, res) => {
    try {
        const { rfc, uuid } = req.params;
        const resultado = await facturaStorage.buscarPorUUID(rfc, uuid);

        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(404).json(resultado);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc/xml/:uuid
 * Obtener XML de una factura
 */
router.get('/:rfc/xml/:uuid', async (req, res) => {
    try {
        const { rfc, uuid } = req.params;
        const resultado = await facturaStorage.obtenerXML(rfc, uuid);

        if (resultado.success) {
            res.set('Content-Type', 'application/xml');
            res.send(resultado.xmlContent);
        } else {
            res.status(404).json(resultado);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc/descargar/:uuid
 * Descargar XML de una factura
 */
router.get('/:rfc/descargar/:uuid', async (req, res) => {
    try {
        const { rfc, uuid } = req.params;
        const resultado = await facturaStorage.obtenerXML(rfc, uuid);

        if (resultado.success) {
            res.set('Content-Type', 'application/xml');
            res.set('Content-Disposition', `attachment; filename="${uuid}.xml"`);
            res.send(resultado.xmlContent);
        } else {
            res.status(404).json(resultado);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/facturas/:rfc/uuid/:uuid
 * Eliminar una factura
 */
router.delete('/:rfc/uuid/:uuid', async (req, res) => {
    try {
        const { rfc, uuid } = req.params;
        const resultado = await facturaStorage.eliminarFactura(rfc, uuid);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc/exportar
 * Exportar todas las facturas de una empresa a JSON
 */
router.get('/:rfc/exportar', async (req, res) => {
    try {
        const { rfc } = req.params;
        const resultado = await facturaStorage.exportarEmpresa(rfc);

        if (resultado.success) {
            res.download(resultado.exportPath);
        } else {
            res.status(500).json(resultado);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc/vigentes
 * Obtener solo facturas vigentes
 */
router.get('/:rfc/vigentes', async (req, res) => {
    try {
        const { rfc } = req.params;
        const filtros = {
            estado: 'vigente',
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 100
        };

        const resultado = await facturaStorage.obtenerFacturasEmpresa(rfc, filtros);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc/canceladas
 * Obtener solo facturas canceladas
 */
router.get('/:rfc/canceladas', async (req, res) => {
    try {
        const { rfc } = req.params;
        const filtros = {
            estado: 'cancelado',
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 100
        };

        const resultado = await facturaStorage.obtenerFacturasEmpresa(rfc, filtros);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:rfc/nomina
 * Obtener solo facturas de nómina
 */
router.get('/:rfc/nomina', async (req, res) => {
    try {
        const { rfc } = req.params;
        const filtros = {
            esNomina: true,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 100
        };

        const resultado = await facturaStorage.obtenerFacturasEmpresa(rfc, filtros);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
