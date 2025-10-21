import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';

// pdf-parse es CommonJS, necesitamos usar createRequire
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

/**
 * Servicio de Extracción de Datos de Constancia de Situación Fiscal (SAT)
 *
 * Este servicio extrae automáticamente datos de PDFs de CSF del SAT
 * con múltiples estrategias de parsing y validación robusta.
 */

/**
 * Valida que el archivo sea un PDF válido
 * @param {Buffer} buffer - Buffer del archivo
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validatePDF(buffer) {
    try {
        // Verificar que el buffer no esté vacío
        if (!buffer || buffer.length === 0) {
            return { valid: false, error: 'El archivo está vacío' };
        }

        // Verificar tamaño mínimo (100 bytes)
        if (buffer.length < 100) {
            return { valid: false, error: 'El archivo es demasiado pequeño para ser un PDF válido' };
        }

        // Verificar tamaño máximo (20MB)
        if (buffer.length > 20 * 1024 * 1024) {
            return { valid: false, error: 'El archivo excede el tamaño máximo permitido (20MB)' };
        }

        // Verificar cabecera PDF (debe comenzar con %PDF-)
        const header = buffer.toString('utf-8', 0, 5);
        if (!header.startsWith('%PDF-')) {
            return { valid: false, error: 'El archivo no es un PDF válido (cabecera incorrecta)' };
        }

        // Verificar versión PDF (1.0 a 2.0)
        const version = buffer.toString('utf-8', 5, 8);
        const versionNum = parseFloat(version);
        if (isNaN(versionNum) || versionNum < 1.0 || versionNum > 2.0) {
            return { valid: false, error: 'Versión de PDF no soportada' };
        }

        return { valid: true };
    } catch (error) {
        return { valid: false, error: `Error validando PDF: ${error.message}` };
    }
}

/**
 * Extrae texto del PDF usando pdf-parse
 * @param {Buffer} buffer - Buffer del PDF
 * @returns {Promise<string>} - Texto extraído
 */
async function extractTextFromPDF(buffer) {
    try {
        // Convertir Buffer a Uint8Array (requerido por pdf-parse v2.4.3)
        const uint8Array = new Uint8Array(buffer);

        // Crear instancia del parser
        const parser = new PDFParse(uint8Array);

        // Cargar el PDF
        await parser.load();

        // Extraer texto - getText() devuelve un objeto con páginas
        const textData = await parser.getText();

        // Convertir a string
        let text = '';
        if (typeof textData === 'string') {
            text = textData;
        } else if (textData && typeof textData === 'object') {
            // Si es un objeto con páginas, concatenar todo el texto
            if (Array.isArray(textData.pages)) {
                text = textData.pages.map(page => page.text || '').join('\n');
            } else if (textData.text) {
                text = textData.text;
            } else {
                // Intentar convertir a string
                text = JSON.stringify(textData);
            }
        }

        if (!text || text.trim().length === 0) {
            throw new Error('No se pudo extraer texto del PDF');
        }

        // LOG: Guardar el texto extraído para debugging
        console.log('[PDF DEBUG] Texto extraído (primeros 1500 caracteres):');
        console.log('='.repeat(80));
        console.log(text.substring(0, 1500));
        console.log('='.repeat(80));

        return text;
    } catch (error) {
        // Errores comunes y sus soluciones
        if (error.message.includes('Invalid PDF')) {
            throw new Error('El PDF está corrupto o tiene un formato inválido');
        } else if (error.message.includes('encrypted')) {
            throw new Error('El PDF está protegido con contraseña. Por favor, proporcione un PDF sin protección');
        } else if (error.message.includes('password')) {
            throw new Error('El PDF requiere contraseña para abrirse');
        } else {
            throw new Error(`Error al leer el PDF: ${error.message}`);
        }
    }
}

/**
 * Limpia y normaliza texto extraído
 * @param {string} text - Texto a limpiar
 * @returns {string} - Texto limpio
 */
function cleanText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extrae RFC usando múltiples patrones
 * @param {string} text - Texto del PDF
 * @returns {string} - RFC extraído o cadena vacía
 */
function extractRFC(text) {
    // Patrones de RFC (persona moral y persona física)
    const patterns = [
        // Patrón con etiqueta "RFC:" o "R.F.C.:"
        /(?:RFC|R\.F\.C\.)[\s:]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
        // Patrón con "Clave del Registro Federal"
        /Clave\s+del\s+Registro\s+Federal[\s\S]{0,50}?([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i,
        // Patrón standalone (RFC en formato válido)
        /\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/,
        // Patrón con espacios o guiones
        /([A-ZÑ&]{3,4}[\s-]?\d{6}[\s-]?[A-Z0-9]{3})/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            // Limpiar espacios y guiones
            const rfc = match[1].replace(/[\s-]/g, '').toUpperCase();
            // Validar formato
            if (/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
                return rfc;
            }
        }
    }

    return '';
}

/**
 * Extrae nombre/razón social usando múltiples patrones
 * @param {string} text - Texto del PDF
 * @returns {string} - Nombre/razón social o cadena vacía
 */
function extractRazonSocial(text) {
    const patterns = [
        // Patrón "Nombre:" seguido del valor
        /Nombre[\s:]+([^\n]+?)(?=\n|RFC|Denominación|Régimen)/i,
        // Patrón "Denominación o Razón Social:"
        /Denominación\s+o\s+Razón\s+Social[\s:]+([^\n]+?)(?=\n|RFC|Régimen)/i,
        // Patrón "Denominación:"
        /Denominación[\s:]+([^\n]+?)(?=\n|RFC|Nombre|Régimen)/i,
        // Patrón "Razón Social:"
        /Razón\s+Social[\s:]+([^\n]+?)(?=\n|RFC|Régimen)/i,
        // Patrón genérico después de "Nombre" o "Denominación"
        /(?:Nombre|Denominación)[\s\S]{0,30}?:\s*([A-ZÑ&\s]+(?:\s+[A-Z\.]+)*)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const nombre = cleanText(match[1]);
            // Filtrar si es muy corto o contiene números (probablemente no es un nombre)
            if (nombre.length > 3 && !/^\d+$/.test(nombre)) {
                return nombre.substring(0, 250); // Limitar longitud
            }
        }
    }

    return '';
}

/**
 * Extrae régimen fiscal usando múltiples patrones
 * @param {string} text - Texto del PDF
 * @returns {string} - Régimen fiscal o cadena vacía
 */
function extractRegimen(text) {
    const patterns = [
        // Patrón para tabla de regímenes con "Fecha Inicio Fecha Fin"
        /Regímenes:[\s\S]*?Régimen\s+Fecha\s+Inicio\s+Fecha\s+Fin\s*\n\s*([^\n]+?)(?:\s+\d{2}\/\d{2}\/\d{4}|\n)/i,
        // Patrón para "Régimen General de Ley Personas Morales"
        /Régimen\s+General\s+de\s+Ley\s+Personas\s+Mo(?:rales)?/i,
        // Patrón "Régimen:" con código y descripción
        /Régimen[\s\S]{0,20}?(\d{3}[\s-]+[^\n]+?)(?=\n|Fecha|Domicilio|Inicio)/i,
        // Patrón múltiples regímenes
        /Régimen[\s\S]{0,30}?((?:\d{3}[\s-]+[^\n]+?\n?)+?)(?=\n\n|Domicilio|Obligaciones)/i,
        // Patrón simplificado
        /Régimen[\s:]+([^\n]+?)(?=\n|Fecha)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let regimen = match[1] || match[0];

            regimen = regimen
                .replace(/Regímenes:/g, '')
                .replace(/Régimen\s+Fecha\s+Inicio\s+Fecha\s+Fin/g, '')
                .replace(/\n/g, ', ')
                .replace(/\s+/g, ' ')
                .trim();

            // Si hay múltiples regímenes, separarlos correctamente
            regimen = regimen.replace(/(\d{3})\s*-\s*/g, '\n$1 - ').trim();

            if (regimen.length > 5) {
                return regimen.substring(0, 500); // Limitar longitud
            }
        }
    }

    return '';
}

/**
 * Extrae domicilio fiscal usando múltiples patrones
 * @param {string} text - Texto del PDF
 * @returns {string} - Domicilio fiscal o cadena vacía
 */
function extractDomicilio(text) {
    // Primero intentar con el formato estructurado del SAT
    const structuredPattern = /Datos\s+del\s+domicilio\s+registrado[\s\S]*?Tipo\s+de\s+Vialidad:\s*([^\n]+)\s*Nombre\s+de\s+Vialidad:\s*([^\n]+)\s*Número\s+Exterior:\s*([^\n]+)\s*(?:Número\s+Interior:\s*([^\n]+)\s*)?Nombre\s+de\s+la\s+Colonia:\s*([^\n]+)\s*(?:Nombre\s+de\s+la\s+Localidad:\s*([^\n]+)\s*)?Nombre\s+del\s+Municipio[^:]*:\s*([^\n]+)\s*Nombre\s+de\s+la\s+Entidad\s+Federativa:\s*([^\n]+)/i;

    const structMatch = text.match(structuredPattern);
    if (structMatch) {
        const [_, tipoVial, nombreVial, numExt, numInt, colonia, localidad, municipio, entidad] = structMatch;

        let domicilio = `${tipoVial} ${nombreVial} ${numExt}`;
        if (numInt && numInt.trim() && numInt.trim() !== '') {
            domicilio += ` INT ${numInt.trim()}`;
        }
        domicilio += `, ${colonia}, ${municipio}, ${entidad}`;

        return domicilio.replace(/\s+/g, ' ').trim().substring(0, 300);
    }

    // Patrones alternativos
    const patterns = [
        // Patrón "Domicilio Fiscal:" hasta el siguiente campo
        /Domicilio\s+(?:Fiscal|Registrado)[\s:]+(.+?)(?=\n\n|Código\s+Postal|C\.P\.|Actividad|Régimen|Obligaciones)/is,
        // Patrón simplificado
        /Domicilio[\s:]+(.+?)(?=\nCódigo|Actividad|Régimen)/is,
        // Patrón con "Ubicación"
        /Ubicación[\s:]+(.+?)(?=\n\n|Código)/is
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            let domicilio = match[1]
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Limpiar contenido que no es parte del domicilio
            domicilio = domicilio.replace(/Código\s+Postal.*$/i, '').trim();

            if (domicilio.length > 10) {
                return domicilio.substring(0, 300);
            }
        }
    }

    return '';
}

/**
 * Extrae código postal
 * @param {string} text - Texto del PDF
 * @returns {string} - Código postal o cadena vacía
 */
function extractCodigoPostal(text) {
    const patterns = [
        /Código\s+Postal[\s:]+(\d{5})/i,
        /C\.P\.[\s:]*(\d{5})/i,
        /CP[\s:]+(\d{5})/i,
        /\b(\d{5})\b/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return '';
}

/**
 * Extrae fecha de emisión
 * @param {string} text - Texto del PDF
 * @returns {string} - Fecha de emisión o cadena vacía
 */
function extractFechaEmision(text) {
    const patterns = [
        // Fecha con etiqueta "Fecha de emisión"
        /Fecha\s+de\s+emisión[\s:]+(\d{2}\/\d{2}\/\d{4})/i,
        // Fecha con etiqueta "Fecha"
        /Fecha[\s:]+(\d{2}\/\d{2}\/\d{4})/i,
        // Fecha en formato DD/MM/YYYY
        /(\d{2}\/\d{2}\/\d{4})/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return '';
}

/**
 * Extrae actividad económica/giro
 * @param {string} text - Texto del PDF
 * @returns {string} - Actividad económica o cadena vacía
 */
function extractActividad(text) {
    const patterns = [
        /Actividad\s+Económica[\s:]+(.+?)(?=\n\n|Fecha|Régimen)/is,
        /Actividades?\s+Económicas?[\s:]+(.+?)(?=\n\n|Fecha)/is,
        /Giro[\s:]+(.+?)(?=\n|Fecha)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const actividad = match[1]
                .replace(/\n/g, ', ')
                .replace(/\s+/g, ' ')
                .trim();

            return actividad.substring(0, 500);
        }
    }

    return '';
}

/**
 * Extrae el status del contribuyente (ACTIVO/INACTIVO)
 * @param {string} text - Texto del PDF
 * @returns {string} - Status del contribuyente
 */
function extractStatus(text) {
    const patterns = [
        /Estatus\s+en\s+el\s+padrón:\s*(ACTIVO|INACTIVO|SUSPENDIDO)/i,
        /Estado:\s*(ACTIVO|INACTIVO|SUSPENDIDO)/i,
        /Status:\s*(ACTIVO|INACTIVO|SUSPENDIDO)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].toUpperCase();
        }
    }

    return '';
}

/**
 * Extrae todos los datos de la Constancia de Situación Fiscal
 * @param {Buffer} pdfBuffer - Buffer del PDF
 * @returns {Promise<Object>} - Datos extraídos
 */
export async function extractConstanciaData(pdfBuffer) {
    try {
        // 1. Validar el PDF
        const validation = validatePDF(pdfBuffer);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // 2. Extraer texto del PDF
        const rawText = await extractTextFromPDF(pdfBuffer);

        if (!rawText || rawText.length < 50) {
            throw new Error('El PDF no contiene suficiente texto. Podría ser un PDF escaneado (imagen) en lugar de texto');
        }

        // 3. Verificar que sea una Constancia de Situación Fiscal
        const isCSF = /constancia\s+de\s+situación\s+fiscal/i.test(rawText) ||
                      /servicio\s+de\s+administración\s+tributaria/i.test(rawText) ||
                      /SAT/i.test(rawText);

        if (!isCSF) {
            console.warn('Advertencia: El PDF no parece ser una Constancia de Situación Fiscal del SAT');
        }

        // 4. Extraer datos usando múltiples estrategias
        const extractedData = {
            rfc: extractRFC(rawText),
            razonSocial: extractRazonSocial(rawText),
            nombreCorto: '',
            regimen: extractRegimen(rawText),
            domicilioFiscal: extractDomicilio(rawText),
            codigoPostal: extractCodigoPostal(rawText),
            fechaEmision: extractFechaEmision(rawText),
            giro: extractActividad(rawText),
            status: extractStatus(rawText)
        };

        // 5. Generar nombre corto
        if (extractedData.razonSocial) {
            extractedData.nombreCorto = extractedData.razonSocial.substring(0, 50);
        }

        // 6. Validar que se hayan extraído datos mínimos
        if (!extractedData.rfc && !extractedData.razonSocial) {
            // Log para debugging
            console.error('No se pudieron extraer datos básicos. Texto del PDF:', rawText.substring(0, 500));
            throw new Error('No se pudieron extraer datos del PDF. Verifique que sea una Constancia de Situación Fiscal válida del SAT');
        }

        // 7. Validar RFC si fue extraído
        if (extractedData.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(extractedData.rfc)) {
            console.warn(`RFC extraído con formato inválido: ${extractedData.rfc}`);
        }

        return {
            success: true,
            data: extractedData,
            metadata: {
                pdfSize: pdfBuffer.length,
                textLength: rawText.length,
                isCSF,
                extractedFields: Object.keys(extractedData).filter(key => extractedData[key] && extractedData[key] !== '')
            }
        };

    } catch (error) {
        console.error('Error en extractConstanciaData:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

/**
 * Extrae datos de un archivo PDF desde una ruta
 * @param {string} filePath - Ruta al archivo PDF
 * @returns {Promise<Object>} - Datos extraídos
 */
export async function extractFromFile(filePath) {
    try {
        // Verificar que el archivo existe
        const exists = await fs.pathExists(filePath);
        if (!exists) {
            throw new Error('El archivo no existe');
        }

        // Leer el archivo
        const buffer = await fs.readFile(filePath);

        // Extraer datos
        return await extractConstanciaData(buffer);

    } catch (error) {
        console.error('Error en extractFromFile:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

export default {
    validatePDF,
    extractConstanciaData,
    extractFromFile
};
