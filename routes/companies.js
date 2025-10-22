import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import multer from 'multer';
import { extractConstanciaData, validatePDF } from '../services/pdfExtractor.js';

const router = express.Router();
const DB_PATH = './data/companies.json';

// Asegurar que existe el directorio de datos
await fs.ensureDir('./data');
await fs.ensureDir('./temp');

// Configurar multer para subir PDFs
const upload = multer({
    dest: 'temp/',
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB máximo
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'));
        }
    }
});

/**
 * GET /api/companies
 * Obtener todas las empresas
 */
router.get('/', async (req, res) => {
    try {
        const exists = await fs.pathExists(DB_PATH);

        if (!exists) {
            return res.json({
                success: true,
                companies: []
            });
        }

        const data = await fs.readJSON(DB_PATH);
        res.json({
            success: true,
            companies: data.companies || []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/companies
 * Agregar una nueva empresa
 */
router.post('/', async (req, res) => {
    try {
        const { rfc, razonSocial, nombreCorto, pseudonimo, nivel, regimen, domicilioFiscal, giro } = req.body;

        if (!rfc || !razonSocial) {
            return res.status(400).json({
                success: false,
                error: 'RFC y Razón Social son requeridos'
            });
        }

        // Leer datos existentes
        let data = { companies: [] };
        const exists = await fs.pathExists(DB_PATH);
        if (exists) {
            data = await fs.readJSON(DB_PATH);
        }

        // Verificar si ya existe
        const existingIndex = data.companies.findIndex(c => c.rfc === rfc);

        // Validar que el nivel sea 1, 2, 3 o 4
        const nivelValido = [1, 2, 3, 4].includes(parseInt(nivel)) ? parseInt(nivel) : 1;

        const newCompany = {
            id: Date.now().toString(),
            rfc,
            razonSocial,
            nombreCorto: nombreCorto || razonSocial,
            pseudonimo: pseudonimo || nombreCorto || razonSocial,
            nivel: nivelValido,
            regimen: regimen || '',
            domicilioFiscal: domicilioFiscal || '',
            giro: giro || '',
            status: 'active',
            isFavorite: false,
            createdAt: new Date().toISOString(),
            stats: {
                totalXMLs: 0,
                xmlsThisMonth: 0,
                totalEmitidos: 0,
                totalRecibidos: 0,
                ingresos: 0,
                deducciones: 0
            }
        };

        if (existingIndex >= 0) {
            data.companies[existingIndex] = { ...data.companies[existingIndex], ...newCompany };
        } else {
            data.companies.push(newCompany);
        }

        // Guardar
        await fs.writeJSON(DB_PATH, data, { spaces: 2 });

        res.json({
            success: true,
            company: newCompany
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/companies/:rfc
 * Actualizar una empresa
 */
router.put('/:rfc', async (req, res) => {
    try {
        const { rfc } = req.params;
        const updates = req.body;

        const exists = await fs.pathExists(DB_PATH);
        if (!exists) {
            return res.status(404).json({
                success: false,
                error: 'No se encontraron empresas'
            });
        }

        const data = await fs.readJSON(DB_PATH);
        const companyIndex = data.companies.findIndex(c => c.rfc === rfc);

        if (companyIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Empresa no encontrada'
            });
        }

        data.companies[companyIndex] = {
            ...data.companies[companyIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await fs.writeJSON(DB_PATH, data, { spaces: 2 });

        res.json({
            success: true,
            company: data.companies[companyIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/companies/extract-constancia
 * Extraer datos de la Constancia de Situación Fiscal (PDF)
 *
 * Este endpoint procesa PDFs de CSF del SAT y extrae automáticamente:
 * - RFC
 * - Razón Social / Nombre
 * - Régimen Fiscal
 * - Domicilio Fiscal
 * - Código Postal
 * - Fecha de Emisión
 * - Actividad Económica
 */
router.post('/extract-constancia', upload.single('constancia'), async (req, res) => {
    const startTime = Date.now();
    let pdfPath = null;

    try {
        // 1. Validar que se proporcionó un archivo
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó el archivo PDF'
            });
        }

        pdfPath = req.file.path;
        const fileName = req.file.originalname;

        console.log(`[PDF Extractor] Procesando archivo: ${fileName} (${(req.file.size / 1024).toFixed(2)} KB)`);

        // 2. Leer el archivo PDF
        let pdfBuffer;
        try {
            pdfBuffer = await fs.readFile(pdfPath);
        } catch (readError) {
            throw new Error(`No se pudo leer el archivo: ${readError.message}`);
        }

        // 3. Validar que sea un PDF válido
        const validation = validatePDF(pdfBuffer);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error
            });
        }

        // 4. Extraer datos usando el servicio mejorado
        const extractionResult = await extractConstanciaData(pdfBuffer);

        // 5. Eliminar archivo temporal
        try {
            await fs.unlink(pdfPath);
            pdfPath = null;
        } catch (unlinkError) {
            console.warn('No se pudo eliminar archivo temporal:', unlinkError.message);
        }

        // 6. Verificar resultado de la extracción
        if (!extractionResult.success) {
            return res.status(400).json({
                success: false,
                error: extractionResult.error || 'No se pudieron extraer datos del PDF'
            });
        }

        const processingTime = Date.now() - startTime;
        console.log(`[PDF Extractor] Extracción exitosa en ${processingTime}ms`);
        console.log(`[PDF Extractor] Campos extraídos: ${extractionResult.metadata.extractedFields.join(', ')}`);

        // 7. Registrar empresa automáticamente si se proporciona el nivel
        const { nivel } = req.body;
        let registeredCompany = null;

        if (nivel && extractionResult.data.rfc) {
            try {
                // Validar que el nivel sea 1, 2, 3 o 4
                const nivelValido = [1, 2, 3, 4].includes(parseInt(nivel)) ? parseInt(nivel) : 1;

                // Leer datos existentes
                let companiesData = { companies: [] };
                const dbExists = await fs.pathExists(DB_PATH);
                if (dbExists) {
                    companiesData = await fs.readJSON(DB_PATH);
                }

                // Verificar si ya existe
                const existingIndex = companiesData.companies.findIndex(c => c.rfc === extractionResult.data.rfc);

                const newCompany = {
                    id: Date.now().toString(),
                    rfc: extractionResult.data.rfc,
                    razonSocial: extractionResult.data.razonSocial || extractionResult.data.nombre,
                    nombreCorto: extractionResult.data.nombre || extractionResult.data.razonSocial,
                    pseudonimo: extractionResult.data.nombre || extractionResult.data.razonSocial,
                    nivel: nivelValido,
                    regimen: extractionResult.data.regimen || '',
                    domicilioFiscal: extractionResult.data.domicilio || '',
                    giro: extractionResult.data.actividad || '',
                    status: 'active',
                    isFavorite: false,
                    createdAt: new Date().toISOString(),
                    stats: {
                        totalXMLs: 0,
                        xmlsThisMonth: 0,
                        totalEmitidos: 0,
                        totalRecibidos: 0,
                        ingresos: 0,
                        deducciones: 0
                    }
                };

                if (existingIndex >= 0) {
                    companiesData.companies[existingIndex] = { ...companiesData.companies[existingIndex], ...newCompany };
                    console.log(`[PDF Extractor] Empresa actualizada: ${newCompany.rfc}`);
                } else {
                    companiesData.companies.push(newCompany);
                    console.log(`[PDF Extractor] Empresa registrada: ${newCompany.rfc}`);
                }

                // Guardar
                await fs.writeJSON(DB_PATH, companiesData, { spaces: 2 });
                registeredCompany = newCompany;

            } catch (regError) {
                console.error('[PDF Extractor] Error registrando empresa:', regError);
            }
        }

        // 8. Devolver datos extraídos y empresa registrada
        res.json({
            success: true,
            data: extractionResult.data,
            company: registeredCompany,
            metadata: {
                fileName,
                fileSize: req.file.size,
                processingTime: `${processingTime}ms`,
                extractedFields: extractionResult.metadata.extractedFields,
                isCSF: extractionResult.metadata.isCSF,
                registered: !!registeredCompany
            },
            message: registeredCompany
                ? 'Datos extraídos y empresa registrada correctamente'
                : 'Datos extraídos correctamente de la Constancia de Situación Fiscal'
        });

    } catch (error) {
        // Manejo de errores mejorado
        console.error('[PDF Extractor] Error:', error);

        // Eliminar archivo temporal si existe
        if (pdfPath) {
            try {
                await fs.unlink(pdfPath);
            } catch (unlinkError) {
                console.error('Error eliminando archivo temporal:', unlinkError);
            }
        }

        // Determinar código de error apropiado
        let statusCode = 500;
        let errorMessage = error.message;

        if (error.message.includes('PDF está protegido') ||
            error.message.includes('contraseña') ||
            error.message.includes('encrypted')) {
            statusCode = 400;
            errorMessage = 'El PDF está protegido con contraseña. Por favor, proporcione un PDF sin protección';
        } else if (error.message.includes('corrupto') ||
                   error.message.includes('inválido') ||
                   error.message.includes('no es un PDF')) {
            statusCode = 400;
            errorMessage = 'El archivo no es un PDF válido o está corrupto';
        } else if (error.message.includes('texto')) {
            statusCode = 400;
            errorMessage = 'El PDF no contiene texto extraíble. Podría ser un PDF escaneado (imagen)';
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * DELETE /api/companies/:rfc
 * Eliminar una empresa
 */
router.delete('/:rfc', async (req, res) => {
    try {
        const { rfc } = req.params;

        const exists = await fs.pathExists(DB_PATH);
        if (!exists) {
            return res.status(404).json({
                success: false,
                error: 'No se encontraron empresas'
            });
        }

        const data = await fs.readJSON(DB_PATH);
        const initialLength = data.companies.length;
        data.companies = data.companies.filter(c => c.rfc !== rfc);

        if (data.companies.length === initialLength) {
            return res.status(404).json({
                success: false,
                error: 'Empresa no encontrada'
            });
        }

        await fs.writeJSON(DB_PATH, data, { spaces: 2 });

        res.json({
            success: true,
            message: 'Empresa eliminada correctamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/companies/:rfc/stats/periodo
 * Obtener estadísticas por período (año o mes)
 * Query params: año (requerido), mes (opcional)
 */
router.get('/:rfc/stats/periodo', async (req, res) => {
    try {
        const { rfc } = req.params;
        const { año, mes } = req.query;

        if (!año) {
            return res.status(400).json({
                success: false,
                error: 'El parámetro año es requerido'
            });
        }

        const facturaStorage = (await import('../services/facturaStorage.js')).default;
        const resultado = await facturaStorage.obtenerEstadisticasPorPeriodo(rfc, año, mes);

        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/companies/:rfc/clientes-proveedores
 * Obtener lista de clientes y proveedores de una empresa
 * Query params: año (opcional), mes (opcional)
 */
router.get('/:rfc/clientes-proveedores', async (req, res) => {
    try {
        const { rfc } = req.params;
        const { año, mes } = req.query;

        const facturaStorage = (await import('../services/facturaStorage.js')).default;
        const resultado = await facturaStorage.obtenerClientesYProveedores(rfc, año, mes);

        res.json(resultado);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
