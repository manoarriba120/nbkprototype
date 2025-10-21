import express from 'express';
import satService from '../services/satService.js';
import path from 'path';
import fs from 'fs-extra';
import JSZip from 'jszip';

const router = express.Router();

/**
 * POST /api/download/emitidas
 * Descargar facturas emitidas
 */
router.post('/emitidas', async (req, res) => {
    try {
        // Verificar sesión
        if (!satService.isAuthenticated()) {
            return res.status(401).json({
                success: false,
                error: 'No hay sesión activa. Debe autenticarse primero.'
            });
        }

        const { fechaInicio, fechaFin, formato = 'zip' } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                success: false,
                error: 'Fecha de inicio y fecha fin son requeridas'
            });
        }

        const session = satService.getSession();
        const rfc = session.rfc;

        // Crear directorio para esta descarga
        const timestamp = Date.now();
        const downloadPath = path.join(process.env.DOWNLOAD_PATH || './downloads', rfc, 'emitidas', timestamp.toString());
        await fs.ensureDir(downloadPath);

        // Realizar descarga
        const result = await satService.downloadEmitidas(rfc, fechaInicio, fechaFin, downloadPath);

        if (!result.success) {
            return res.status(500).json(result);
        }

        // Si se solicita ZIP, comprimir los archivos
        if (formato === 'zip' && result.facturas.length > 0) {
            const zip = new JSZip();

            for (const factura of result.facturas) {
                const xmlContent = await fs.readFile(factura.filepath);
                zip.file(factura.filename, xmlContent);
            }

            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            const zipPath = path.join(downloadPath, `emitidas_${rfc}_${timestamp}.zip`);
            await fs.writeFile(zipPath, zipBuffer);

            res.json({
                ...result,
                zipFile: zipPath,
                downloadUrl: `/api/download/file?path=${encodeURIComponent(zipPath)}`
            });
        } else {
            res.json(result);
        }

    } catch (error) {
        console.error('Error en descarga de emitidas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/download/recibidas
 * Descargar facturas recibidas
 */
router.post('/recibidas', async (req, res) => {
    try {
        // Verificar sesión
        if (!satService.isAuthenticated()) {
            return res.status(401).json({
                success: false,
                error: 'No hay sesión activa. Debe autenticarse primero.'
            });
        }

        const { fechaInicio, fechaFin, formato = 'zip' } = req.body;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                success: false,
                error: 'Fecha de inicio y fecha fin son requeridas'
            });
        }

        const session = satService.getSession();
        const rfc = session.rfc;

        // Crear directorio para esta descarga
        const timestamp = Date.now();
        const downloadPath = path.join(process.env.DOWNLOAD_PATH || './downloads', rfc, 'recibidas', timestamp.toString());
        await fs.ensureDir(downloadPath);

        // Realizar descarga
        const result = await satService.downloadRecibidas(rfc, fechaInicio, fechaFin, downloadPath);

        if (!result.success) {
            return res.status(500).json(result);
        }

        // Si se solicita ZIP, comprimir los archivos
        if (formato === 'zip' && result.facturas.length > 0) {
            const zip = new JSZip();

            for (const factura of result.facturas) {
                const xmlContent = await fs.readFile(factura.filepath);
                zip.file(factura.filename, xmlContent);
            }

            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            const zipPath = path.join(downloadPath, `recibidas_${rfc}_${timestamp}.zip`);
            await fs.writeFile(zipPath, zipBuffer);

            res.json({
                ...result,
                zipFile: zipPath,
                downloadUrl: `/api/download/file?path=${encodeURIComponent(zipPath)}`
            });
        } else {
            res.json(result);
        }

    } catch (error) {
        console.error('Error en descarga de recibidas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/download/file
 * Descargar archivo ZIP generado
 */
router.get('/file', async (req, res) => {
    try {
        const { path: filePath } = req.query;

        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: 'Path de archivo es requerido'
            });
        }

        // Verificar que el archivo existe
        const exists = await fs.pathExists(filePath);

        if (!exists) {
            return res.status(404).json({
                success: false,
                error: 'Archivo no encontrado'
            });
        }

        // Enviar archivo
        res.download(filePath, path.basename(filePath), (err) => {
            if (err) {
                console.error('Error enviando archivo:', err);
                res.status(500).json({
                    success: false,
                    error: 'Error al enviar archivo'
                });
            }
        });

    } catch (error) {
        console.error('Error descargando archivo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/download/history
 * Obtener historial de descargas
 */
router.get('/history', async (req, res) => {
    try {
        if (!satService.isAuthenticated()) {
            return res.status(401).json({
                success: false,
                error: 'No hay sesión activa'
            });
        }

        const session = satService.getSession();
        const rfc = session.rfc;

        const downloadBasePath = path.join(process.env.DOWNLOAD_PATH || './downloads', rfc);

        const history = {
            emitidas: [],
            recibidas: []
        };

        // Buscar descargas emitidas
        const emitidasPath = path.join(downloadBasePath, 'emitidas');
        if (await fs.pathExists(emitidasPath)) {
            const dirs = await fs.readdir(emitidasPath);
            for (const dir of dirs) {
                const dirPath = path.join(emitidasPath, dir);
                const stats = await fs.stat(dirPath);
                if (stats.isDirectory()) {
                    const files = await fs.readdir(dirPath);
                    const zipFile = files.find(f => f.endsWith('.zip'));

                    history.emitidas.push({
                        timestamp: parseInt(dir),
                        fecha: new Date(parseInt(dir)).toISOString(),
                        archivos: files.filter(f => f.endsWith('.xml')).length,
                        zipFile: zipFile ? path.join(dirPath, zipFile) : null
                    });
                }
            }
        }

        // Buscar descargas recibidas
        const recibidasPath = path.join(downloadBasePath, 'recibidas');
        if (await fs.pathExists(recibidasPath)) {
            const dirs = await fs.readdir(recibidasPath);
            for (const dir of dirs) {
                const dirPath = path.join(recibidasPath, dir);
                const stats = await fs.stat(dirPath);
                if (stats.isDirectory()) {
                    const files = await fs.readdir(dirPath);
                    const zipFile = files.find(f => f.endsWith('.zip'));

                    history.recibidas.push({
                        timestamp: parseInt(dir),
                        fecha: new Date(parseInt(dir)).toISOString(),
                        archivos: files.filter(f => f.endsWith('.xml')).length,
                        zipFile: zipFile ? path.join(dirPath, zipFile) : null
                    });
                }
            }
        }

        res.json({
            success: true,
            rfc,
            history
        });

    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
