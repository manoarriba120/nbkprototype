import express from 'express';
import satWebService from '../services/satWebService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';

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
 * POST /api/auth-ws/login-efirma
 * Autenticación con e.firma para Web Service del SAT
 * Este método es OBLIGATORIO para usar el Web Service del SAT
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
                error: 'Certificado (.cer) y clave privada (.key) son requeridos'
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

        console.log('\n🔐 Autenticando con e.firma para Web Service del SAT...');
        console.log(`   Certificado: ${req.files.certificate[0].originalname}`);
        console.log(`   Clave: ${req.files.key[0].originalname}\n`);

        const result = await satWebService.loginWithEFirma(certificatePath, keyPath, password);

        // Eliminar archivos temporales
        try {
            await fs.unlink(certificatePath);
            await fs.unlink(keyPath);
        } catch (unlinkError) {
            console.warn('Advertencia al eliminar archivos temporales:', unlinkError.message);
        }

        if (result.success) {
            res.json(result);
        } else {
            res.status(401).json(result);
        }

    } catch (error) {
        console.error('Error en autenticación:', error);

        // Limpiar archivos temporales en caso de error
        if (req.files) {
            if (req.files.certificate) {
                try {
                    await fs.unlink(req.files.certificate[0].path);
                } catch {}
            }
            if (req.files.key) {
                try {
                    await fs.unlink(req.files.key[0].path);
                } catch {}
            }
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/auth-ws/session
 * Obtener información de la sesión actual del Web Service
 */
router.get('/session', (req, res) => {
    const session = satWebService.getSession();

    if (session) {
        res.json({
            success: true,
            session: {
                rfc: session.rfc,
                authenticated: session.authenticated,
                authMethod: session.authMethod,
                timestamp: session.timestamp,
                certValidUntil: session.certValidUntil
            }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'No hay sesión activa. Debe autenticarse con e.firma primero.'
        });
    }
});

/**
 * POST /api/auth-ws/logout
 * Cerrar sesión del Web Service
 */
router.post('/logout', (req, res) => {
    try {
        const result = satWebService.logout();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/auth-ws/health
 * Verificar estado de la autenticación
 */
router.get('/health', (req, res) => {
    const isAuth = satWebService.isAuthenticated();
    const session = satWebService.getSession();

    res.json({
        success: true,
        authenticated: isAuth,
        session: session ? {
            rfc: session.rfc,
            timestamp: session.timestamp
        } : null
    });
});

export default router;
