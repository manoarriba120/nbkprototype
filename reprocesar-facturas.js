/**
 * Script para reprocesar facturas existentes y actualizar base de datos
 */

import xmlAnalyzer from './services/xmlAnalyzer.js';
import facturaStorage from './services/facturaStorage.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function reprocesarFacturas(rfc, tipo) {
    console.log(`\n🔄 Reprocesando facturas ${tipo} para ${rfc}...\n`);

    const basePath = path.join(__dirname, 'downloads', rfc, tipo);

    // Leer todas las carpetas de meses
    const meses = await fs.readdir(basePath);
    console.log(`📁 Carpetas encontradas: ${meses.join(', ')}\n`);

    let todasLasFacturas = {
        porEstado: {
            vigente: [],
            cancelado: [],
            noVerificado: []
        },
        porTipo: {
            ingreso: [],
            egreso: [],
            traslado: [],
            nomina: [],
            pago: []
        },
        total: 0,
        analizados: 0,
        errores: 0
    };

    // Procesar cada mes
    for (const mes of meses) {
        const mesPath = path.join(basePath, mes);
        const stats = await fs.stat(mesPath);

        if (stats.isDirectory()) {
            console.log(`📅 Procesando mes: ${mes}`);

            const resultado = await xmlAnalyzer.procesarCompleto(mesPath, {
                verificarEstado: true,
                organizarPorClasificacion: false,
                generarReporteJSON: false,
                delayVerificacion: 100,  // Delay reducido
                maxConcurrent: 10        // 10 consultas simultáneas
            });

            if (resultado.success) {
                // Combinar resultados
                todasLasFacturas.porEstado.vigente.push(...resultado.analisis.porEstado.vigente);
                todasLasFacturas.porEstado.cancelado.push(...resultado.analisis.porEstado.cancelado);
                todasLasFacturas.porEstado.noVerificado.push(...resultado.analisis.porEstado.noVerificado);

                todasLasFacturas.total += resultado.analisis.total;
                todasLasFacturas.analizados += resultado.analisis.analizados;
            }
        }
    }

    if (todasLasFacturas.total === 0) {
        console.error('❌ No se encontraron facturas');
        return;
    }

    console.log('\n✓ Análisis completo');
    console.log(`  Vigentes: ${todasLasFacturas.porEstado.vigente.length}`);
    console.log(`  Cancelados: ${todasLasFacturas.porEstado.cancelado.length}`);
    console.log(`  No verificados: ${todasLasFacturas.porEstado.noVerificado.length}\n`);

    // Guardar en base de datos
    console.log('💾 Guardando en base de datos...\n');
    const respaldo = await facturaStorage.guardarFacturasLote(
        rfc,
        todasLasFacturas,
        basePath
    );

    if (respaldo.success) {
        console.log('\n✅ Reprocesamiento completado exitosamente!');
        console.log(`  Total: ${respaldo.total}`);
        console.log(`  Nuevas: ${respaldo.guardadas}`);
        console.log(`  Actualizadas: ${respaldo.actualizadas}`);
        console.log(`  Errores: ${respaldo.errores}\n`);
    } else {
        console.error('❌ Error guardando:', respaldo.error);
    }
}

// Ejecutar - Obtener parámetros de línea de comandos
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('❌ Uso: node reprocesar-facturas.js <RFC> <emitidas|recibidas>');
    console.error('   Ejemplo: node reprocesar-facturas.js SIL220131ME7 emitidas');
    process.exit(1);
}

const rfc = args[0];
const tipo = args[1];

if (tipo !== 'emitidas' && tipo !== 'recibidas') {
    console.error('❌ El tipo debe ser "emitidas" o "recibidas"');
    process.exit(1);
}

console.log(`📋 RFC: ${rfc}`);
console.log(`📋 Tipo: ${tipo}\n`);

reprocesarFacturas(rfc, tipo).catch(error => {
    console.error('❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
});
