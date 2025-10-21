import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

// Routes
import authRoutes from './routes/auth.js';
import downloadRoutes from './routes/download.js';
import companiesRoutes from './routes/companies.js';
import authWebServiceRoutes from './routes/authWebService.js';
import downloadWebServiceRoutes from './routes/downloadWebService.js';
import facturasRoutes from './routes/facturas.js';

// Configuración
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (frontend)
app.use(express.static(__dirname));

// Crear directorios necesarios
const createDirectories = async () => {
    const dirs = [
        process.env.DOWNLOAD_PATH || './downloads',
        process.env.TEMP_PATH || './temp',
        './logs'
    ];

    for (const dir of dirs) {
        await fs.ensureDir(dir);
    }
};

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/companies', companiesRoutes);

// Rutas para Web Service del SAT (descarga masiva como AdminXML)
app.use('/api/auth-ws', authWebServiceRoutes);
app.use('/api/download-ws', downloadWebServiceRoutes);

// Rutas para consulta de facturas guardadas (respaldo por empresa)
app.use('/api/facturas', facturasRoutes);

// Ruta de health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Ruta principal - servir el HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'NBK_Demo.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno del servidor'
    });
});

// Iniciar servidor
const startServer = async () => {
    try {
        await createDirectories();

        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════╗
║   NBK - Sistema de Descarga SAT               ║
║   Servidor corriendo en puerto ${PORT}           ║
║   http://localhost:${PORT}                       ║
╚═══════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('Error al iniciar servidor:', error);
        process.exit(1);
    }
};

startServer();
