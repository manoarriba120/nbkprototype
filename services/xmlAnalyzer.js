import xml2js from 'xml2js';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

/**
 * Servicio para analizar, clasificar y verificar XMLs de CFDIs
 */
class XMLAnalyzer {
    constructor() {
        // URL del Web Service de verificación del SAT
        this.verificacionURL = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
        this.parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: true
        });
    }

    /**
     * Analizar XML y extraer información completa
     */
    async analizarXML(xmlPath) {
        try {
            const xmlContent = await fs.readFile(xmlPath, 'utf-8');
            const result = await this.parser.parseStringPromise(xmlContent);

            // Obtener el nodo raíz del comprobante
            const comprobante = result['cfdi:Comprobante'] || result['Comprobante'];

            if (!comprobante) {
                throw new Error('XML inválido: No se encontró nodo Comprobante');
            }

            // Extraer datos básicos
            const uuid = this.extraerUUID(comprobante);
            const tipoDeComprobante = comprobante.TipoDeComprobante || comprobante.tipoDeComprobante || 'I';
            const version = comprobante.Version || comprobante.version || '3.3';

            // Extraer emisor y receptor
            const emisor = comprobante['cfdi:Emisor'] || comprobante.Emisor || {};
            const receptor = comprobante['cfdi:Receptor'] || comprobante.Receptor || {};

            // Extraer conceptos para determinar si es nómina
            const conceptos = comprobante['cfdi:Conceptos'] || comprobante.Conceptos || {};
            const conceptoArray = Array.isArray(conceptos['cfdi:Concepto'] || conceptos.Concepto)
                ? (conceptos['cfdi:Concepto'] || conceptos.Concepto)
                : [(conceptos['cfdi:Concepto'] || conceptos.Concepto)];

            // Verificar complementos para detectar nómina
            const complemento = comprobante['cfdi:Complemento'] || comprobante.Complemento || {};
            const esNomina = this.esComprobanteDeNomina(complemento, tipoDeComprobante);

            // Clasificar tipo de comprobante
            const tipoClasificacion = this.clasificarTipoComprobante(tipoDeComprobante);

            const analisis = {
                uuid,
                version,
                tipoDeComprobante,
                tipoClasificacion,
                esNomina,
                fecha: comprobante.Fecha || comprobante.fecha,
                total: parseFloat(comprobante.Total || comprobante.total || 0),
                subTotal: parseFloat(comprobante.SubTotal || comprobante.subTotal || 0),
                moneda: comprobante.Moneda || comprobante.moneda || 'MXN',
                metodoPago: comprobante.MetodoPago || comprobante.metodoPago,
                formaPago: comprobante.FormaPago || comprobante.formaPago,
                emisor: {
                    rfc: emisor.Rfc || emisor.rfc,
                    nombre: emisor.Nombre || emisor.nombre,
                    regimenFiscal: emisor.RegimenFiscal || emisor.regimenFiscal
                },
                receptor: {
                    rfc: receptor.Rfc || receptor.rfc,
                    nombre: receptor.Nombre || receptor.nombre,
                    usoCFDI: receptor.UsoCFDI || receptor.usoCFDI
                },
                conceptos: conceptoArray.map(c => ({
                    descripcion: c.Descripcion || c.descripcion,
                    cantidad: parseFloat(c.Cantidad || c.cantidad || 1),
                    valorUnitario: parseFloat(c.ValorUnitario || c.valorUnitario || 0),
                    importe: parseFloat(c.Importe || c.importe || 0)
                })),
                xmlPath,
                fileName: path.basename(xmlPath)
            };

            return {
                success: true,
                analisis
            };

        } catch (error) {
            console.error('Error analizando XML:', error.message);
            return {
                success: false,
                error: error.message,
                xmlPath
            };
        }
    }

    /**
     * Extraer UUID del XML (TimbreFiscalDigital)
     */
    extraerUUID(comprobante) {
        try {
            const complemento = comprobante['cfdi:Complemento'] || comprobante.Complemento || {};
            const timbre = complemento['tfd:TimbreFiscalDigital'] ||
                          complemento.TimbreFiscalDigital ||
                          complemento['tfd:TimbreFiscalDigital'];

            if (timbre) {
                return timbre.UUID || timbre.uuid;
            }

            return null;
        } catch (error) {
            console.error('Error extrayendo UUID:', error.message);
            return null;
        }
    }

    /**
     * Determinar si es comprobante de nómina
     */
    esComprobanteDeNomina(complemento, tipoDeComprobante) {
        // Verificar si tiene complemento de nómina
        if (complemento['nomina12:Nomina'] ||
            complemento['nomina:Nomina'] ||
            complemento.Nomina) {
            return true;
        }

        // También puede ser tipo 'N' (Nómina)
        if (tipoDeComprobante === 'N') {
            return true;
        }

        return false;
    }

    /**
     * Clasificar tipo de comprobante según clave
     */
    clasificarTipoComprobante(tipo) {
        const tipos = {
            'I': 'Ingreso',
            'E': 'Egreso',
            'T': 'Traslado',
            'N': 'Nómina',
            'P': 'Pago'
        };

        return tipos[tipo] || 'Desconocido';
    }

    /**
     * Verificar estado del CFDI en el SAT (Vigente o Cancelado)
     * Usando el Web Service de consulta del SAT
     */
    async verificarEstadoSAT(uuid, rfcEmisor, rfcReceptor, total) {
        try {
            // Formatear el total con 6 decimales como requiere el SAT
            const totalFormateado = parseFloat(total).toFixed(6);

            // Construir la expresión impresa (cadena de consulta)
            const expresionImpresa = `?re=${rfcEmisor}&rr=${rfcReceptor}&tt=${totalFormateado}&id=${uuid}`;

            // SOAP envelope para consulta de estado
            const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
    <soap:Header/>
    <soap:Body>
        <tem:Consulta>
            <tem:expresionImpresa><![CDATA[${expresionImpresa}]]></tem:expresionImpresa>
        </tem:Consulta>
    </soap:Body>
</soap:Envelope>`;

            const response = await axios.post(this.verificacionURL, soapEnvelope, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/IConsultaCFDIService/Consulta'
                },
                timeout: 10000
            });

            // Parsear respuesta
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);

            const consultaResult = result['s:Envelope']['s:Body']['ConsultaResponse']['ConsultaResult'];
            const estado = consultaResult['a:Estado'];
            const codigoEstatus = consultaResult['a:CodigoEstatus'];

            // Códigos del SAT:
            // S - Comprobante obtenido satisfactoriamente (VIGENTE)
            // N - Comprobante no encontrado
            // C - Comprobante cancelado

            let estadoFinal = 'Desconocido';
            let esCancelado = false;
            let esVigente = false;

            if (codigoEstatus === 'S') {
                estadoFinal = 'Vigente';
                esVigente = true;
            } else if (codigoEstatus === 'C') {
                estadoFinal = 'Cancelado';
                esCancelado = true;
            } else if (codigoEstatus === 'N') {
                estadoFinal = 'No Encontrado';
            }

            return {
                success: true,
                uuid,
                estado: estadoFinal,
                codigoEstatus,
                esVigente,
                esCancelado,
                estatusCancelacion: consultaResult['a:EstatusCancelacion'] || 'N/A',
                validacionEFOS: consultaResult['a:ValidacionEFOS'] || 'N/A'
            };

        } catch (error) {
            console.error(`Error verificando estado del UUID ${uuid}:`, error.message);
            return {
                success: false,
                uuid,
                error: error.message,
                estado: 'Error',
                esVigente: false,
                esCancelado: false
            };
        }
    }

    /**
     * Analizar y clasificar múltiples XMLs
     */
    async analizarDirectorio(dirPath) {
        try {
            const archivos = await fs.readdir(dirPath);
            const xmls = archivos.filter(f => f.toLowerCase().endsWith('.xml'));

            console.log(`\n📊 Analizando ${xmls.length} archivos XML...`);

            const resultados = {
                total: xmls.length,
                analizados: 0,
                errores: 0,
                porTipo: {
                    ingreso: [],
                    egreso: [],
                    traslado: [],
                    nomina: [],
                    pago: []
                },
                porEstado: {
                    vigente: [],
                    cancelado: [],
                    noVerificado: []
                }
            };

            for (let i = 0; i < xmls.length; i++) {
                const xmlFile = xmls[i];
                const xmlPath = path.join(dirPath, xmlFile);

                console.log(`   [${i + 1}/${xmls.length}] Analizando: ${xmlFile}`);

                const analisis = await this.analizarXML(xmlPath);

                if (analisis.success) {
                    resultados.analizados++;
                    const data = analisis.analisis;

                    // Clasificar por tipo
                    if (data.esNomina) {
                        resultados.porTipo.nomina.push(data);
                    } else {
                        const tipoKey = data.tipoClasificacion.toLowerCase();
                        if (resultados.porTipo[tipoKey]) {
                            resultados.porTipo[tipoKey].push(data);
                        }
                    }

                    // Por ahora, marcar como no verificado
                    resultados.porEstado.noVerificado.push(data);

                } else {
                    resultados.errores++;
                }
            }

            console.log(`\n✓ Análisis completo: ${resultados.analizados}/${resultados.total} procesados\n`);

            return {
                success: true,
                resultados
            };

        } catch (error) {
            console.error('Error analizando directorio:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verificar estado de múltiples XMLs en el SAT
     */
    async verificarEstadoMultiple(analisisResultados, opciones = {}) {
        const { delay = 500, maxConcurrent = 5 } = opciones;

        console.log(`\n🔍 Verificando estado en el SAT...`);
        console.log(`   Total a verificar: ${analisisResultados.porEstado.noVerificado.length}`);
        console.log(`   Delay entre consultas: ${delay}ms\n`);

        const noVerificados = analisisResultados.porEstado.noVerificado;
        const vigentes = [];
        const cancelados = [];
        const errores = [];

        for (let i = 0; i < noVerificados.length; i++) {
            const factura = noVerificados[i];

            if (!factura.uuid) {
                console.log(`   [${i + 1}/${noVerificados.length}] ⚠️  Sin UUID: ${factura.fileName}`);
                errores.push(factura);
                continue;
            }

            console.log(`   [${i + 1}/${noVerificados.length}] Verificando: ${factura.uuid.substring(0, 8)}...`);

            const estadoSAT = await this.verificarEstadoSAT(
                factura.uuid,
                factura.emisor.rfc,
                factura.receptor.rfc,
                factura.total
            );

            // Agregar información de estado a la factura
            factura.estadoSAT = estadoSAT;

            if (estadoSAT.success) {
                if (estadoSAT.esVigente) {
                    vigentes.push(factura);
                    console.log(`      ✓ VIGENTE`);
                } else if (estadoSAT.esCancelado) {
                    cancelados.push(factura);
                    console.log(`      ✗ CANCELADO`);
                } else {
                    errores.push(factura);
                    console.log(`      ? ${estadoSAT.estado}`);
                }
            } else {
                errores.push(factura);
                console.log(`      ⚠️  Error: ${estadoSAT.error}`);
            }

            // Delay para no saturar el servicio del SAT
            if (i < noVerificados.length - 1) {
                await this.sleep(delay);
            }
        }

        // Actualizar resultados
        analisisResultados.porEstado.vigente = vigentes;
        analisisResultados.porEstado.cancelado = cancelados;
        analisisResultados.porEstado.noVerificado = errores;

        console.log(`\n✓ Verificación completa:`);
        console.log(`   Vigentes: ${vigentes.length}`);
        console.log(`   Cancelados: ${cancelados.length}`);
        console.log(`   Errores: ${errores.length}\n`);

        return {
            success: true,
            vigentes: vigentes.length,
            cancelados: cancelados.length,
            errores: errores.length
        };
    }

    /**
     * Organizar archivos por clasificación
     */
    async organizarArchivos(analisisResultados, baseOutputPath) {
        try {
            console.log('\n📁 Organizando archivos...\n');

            const estructura = {
                vigentes: {
                    ingreso: path.join(baseOutputPath, 'vigentes', 'ingreso'),
                    egreso: path.join(baseOutputPath, 'vigentes', 'egreso'),
                    traslado: path.join(baseOutputPath, 'vigentes', 'traslado'),
                    nomina: path.join(baseOutputPath, 'vigentes', 'nomina'),
                    pago: path.join(baseOutputPath, 'vigentes', 'pago')
                },
                cancelados: {
                    ingreso: path.join(baseOutputPath, 'cancelados', 'ingreso'),
                    egreso: path.join(baseOutputPath, 'cancelados', 'egreso'),
                    traslado: path.join(baseOutputPath, 'cancelados', 'traslado'),
                    nomina: path.join(baseOutputPath, 'cancelados', 'nomina'),
                    pago: path.join(baseOutputPath, 'cancelados', 'pago')
                }
            };

            // Crear directorios
            for (const estado of Object.values(estructura)) {
                for (const dir of Object.values(estado)) {
                    await fs.ensureDir(dir);
                }
            }

            const movidos = {
                vigentes: 0,
                cancelados: 0
            };

            // Organizar vigentes
            for (const factura of analisisResultados.porEstado.vigente) {
                const tipoKey = factura.esNomina ? 'nomina' : factura.tipoClasificacion.toLowerCase();
                const destDir = estructura.vigentes[tipoKey] || estructura.vigentes.ingreso;
                const destPath = path.join(destDir, factura.fileName);

                await fs.copy(factura.xmlPath, destPath, { overwrite: true });
                movidos.vigentes++;
            }

            // Organizar cancelados
            for (const factura of analisisResultados.porEstado.cancelado) {
                const tipoKey = factura.esNomina ? 'nomina' : factura.tipoClasificacion.toLowerCase();
                const destDir = estructura.cancelados[tipoKey] || estructura.cancelados.ingreso;
                const destPath = path.join(destDir, factura.fileName);

                await fs.copy(factura.xmlPath, destPath, { overwrite: true });
                movidos.cancelados++;
            }

            console.log(`✓ Archivos organizados:`);
            console.log(`   Vigentes: ${movidos.vigentes}`);
            console.log(`   Cancelados: ${movidos.cancelados}\n`);

            return {
                success: true,
                estructura,
                movidos
            };

        } catch (error) {
            console.error('Error organizando archivos:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generar reporte de clasificación
     */
    async generarReporte(analisisResultados, outputPath) {
        try {
            const reporte = {
                fecha: new Date().toISOString(),
                resumen: {
                    total: analisisResultados.total,
                    analizados: analisisResultados.analizados,
                    errores: analisisResultados.errores
                },
                porTipo: {
                    ingreso: analisisResultados.porTipo.ingreso.length,
                    egreso: analisisResultados.porTipo.egreso.length,
                    traslado: analisisResultados.porTipo.traslado.length,
                    nomina: analisisResultados.porTipo.nomina.length,
                    pago: analisisResultados.porTipo.pago.length
                },
                porEstado: {
                    vigente: analisisResultados.porEstado.vigente.length,
                    cancelado: analisisResultados.porEstado.cancelado.length,
                    noVerificado: analisisResultados.porEstado.noVerificado.length
                },
                totales: {
                    vigentes: {
                        total: analisisResultados.porEstado.vigente.reduce((sum, f) => sum + f.total, 0),
                        subtotal: analisisResultados.porEstado.vigente.reduce((sum, f) => sum + f.subTotal, 0)
                    },
                    cancelados: {
                        total: analisisResultados.porEstado.cancelado.reduce((sum, f) => sum + f.total, 0),
                        subtotal: analisisResultados.porEstado.cancelado.reduce((sum, f) => sum + f.subTotal, 0)
                    }
                },
                detalles: {
                    vigentes: analisisResultados.porEstado.vigente.map(f => ({
                        uuid: f.uuid,
                        fecha: f.fecha,
                        emisor: f.emisor.rfc,
                        receptor: f.receptor.rfc,
                        total: f.total,
                        tipo: f.tipoClasificacion,
                        esNomina: f.esNomina
                    })),
                    cancelados: analisisResultados.porEstado.cancelado.map(f => ({
                        uuid: f.uuid,
                        fecha: f.fecha,
                        emisor: f.emisor.rfc,
                        receptor: f.receptor.rfc,
                        total: f.total,
                        tipo: f.tipoClasificacion,
                        esNomina: f.esNomina
                    }))
                }
            };

            const reportePath = path.join(outputPath, 'reporte_clasificacion.json');
            await fs.writeJSON(reportePath, reporte, { spaces: 2 });

            console.log(`\n📄 Reporte generado: ${reportePath}\n`);

            return {
                success: true,
                reportePath,
                reporte
            };

        } catch (error) {
            console.error('Error generando reporte:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Proceso completo: analizar, verificar y organizar
     */
    async procesarCompleto(dirPath, opciones = {}) {
        const {
            verificarEstado = true,
            organizarPorClasificacion = true,
            generarReporteJSON = true,
            delayVerificacion = 500
        } = opciones;

        console.log('\n╔═══════════════════════════════════════════════════╗');
        console.log('║  PROCESAMIENTO COMPLETO DE FACTURAS              ║');
        console.log('╚═══════════════════════════════════════════════════╝\n');

        // Paso 1: Analizar XMLs
        const analisis = await this.analizarDirectorio(dirPath);
        if (!analisis.success) {
            return analisis;
        }

        // Paso 2: Verificar estado en SAT
        if (verificarEstado) {
            await this.verificarEstadoMultiple(analisis.resultados, {
                delay: delayVerificacion
            });
        }

        // Paso 3: Organizar archivos
        if (organizarPorClasificacion) {
            await this.organizarArchivos(analisis.resultados, dirPath);
        }

        // Paso 4: Generar reporte
        let reporte = null;
        if (generarReporteJSON) {
            reporte = await this.generarReporte(analisis.resultados, dirPath);
        }

        return {
            success: true,
            analisis: analisis.resultados,
            reporte: reporte?.reporte
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default new XMLAnalyzer();
