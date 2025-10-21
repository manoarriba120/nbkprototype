import express from 'express';
import satService from '../services/satService.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configurar multer para subir archivos de e.firma
const upload = multer({
    dest: 'temp/',
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.cer' || ext === '.key') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos .cer y .key'));
        }
    }
});

/**
 * POST /api/auth/login-ciec
 * Autenticación con CIEC (RFC y contraseña)
 */
router.post('/login-ciec', async (req, res) => {
    try {
        const { rfc, password } = req.body;

        if (!rfc || !password) {
            return res.status(400).json({
                success: false,
                error: 'RFC y contraseña son requeridos'
            });
        }

        const result = await satService.loginWithCIEC(rfc, password);

        if (result.success) {
            res.json(result);
        } else {
            res.status(401).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/auth/login-efirma
 * Autenticación con e.firma (certificado y clave privada)
 */
router.post('/login-efirma', upload.fields([
    { name: 'certificate', maxCount: 1 },
    { name: 'key', maxCount: 1 }
]), async (req, res) => {
    try {
        const { password } = req.body;

        if (!req.files || !req.files.certificate || !req.files.key) {
            return res.status(400).json({
                success: false,
                error: 'Certificado y clave privada son requeridos'
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                error: 'Contraseña de la clave privada es requerida'
            });
        }

        const certificatePath = req.files.certificate[0].path;
        const keyPath = req.files.key[0].path;

        const result = await satService.loginWithEFirma(certificatePath, keyPath, password);

        if (result.success) {
            res.json(result);
        } else {
            res.status(401).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/auth/session
 * Obtener información de la sesión actual
 */
router.get('/session', (req, res) => {
    const session = satService.getSession();

    if (session) {
        res.json({
            success: true,
            session
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'No hay sesión activa'
        });
    }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
router.post('/logout', async (req, res) => {
    try {
        const result = await satService.logout();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
