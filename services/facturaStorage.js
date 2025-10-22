import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

/**
 * Servicio de almacenamiento persistente de facturas por empresa
 * Guarda facturas en JSON estructurado con índices para búsqueda rápida
 */
class FacturaStorage {
    constructor() {
        this.dataDir = './data/facturas';
        this.indexDir = './data/indices';
        this.xmlDir = './data/xmls';
        this.init();
    }

    /**
     * Inicializar estructura de directorios
     */
    async init() {
        await fs.ensureDir(this.dataDir);
        await fs.ensureDir(this.indexDir);
        await fs.ensureDir(this.xmlDir);
    }

    /**
     * Generar ID único para factura
     */
    generarID(rfc, uuid) {
        return crypto.createHash('md5').update(`${rfc}:${uuid}`).digest('hex');
    }

    /**
     * Obtener ruta del archivo de empresa
     */
    getRutaEmpresa(rfc) {
        return path.join(this.dataDir, `${rfc}.json`);
    }

    /**
     * Obtener ruta del índice
     */
    getRutaIndice(rfc, tipo) {
        return path.join(this.indexDir, `${rfc}_${tipo}.json`);
    }

    /**
     * Obtener ruta para XML
     */
    getRutaXML(rfc, uuid) {
        const empresaDir = path.join(this.xmlDir, rfc);
        return path.join(empresaDir, `${uuid}.xml`);
    }

    /**
     * Guardar factura completa (análisis + XML)
     */
    async guardarFactura(rfc, analisisFactura, xmlContent = null) {
        try {
            const facturaID = this.generarID(rfc, analisisFactura.uuid);

            // Preparar datos de la factura
            const factura = {
                id: facturaID,
                uuid: analisisFactura.uuid,
                rfc: rfc,
                version: analisisFactura.version,
                tipo: analisisFactura.tipoDeComprobante,
                tipoClasificacion: analisisFactura.tipoClasificacion,
                esNomina: analisisFactura.esNomina,
                fecha: analisisFactura.fecha,
                total: analisisFactura.total,
                subTotal: analisisFactura.subTotal,
                moneda: analisisFactura.moneda,
                metodoPago: analisisFactura.metodoPago,
                formaPago: analisisFactura.formaPago,
                emisor: analisisFactura.emisor,
                receptor: analisisFactura.receptor,
                conceptos: analisisFactura.conceptos,
                estadoSAT: analisisFactura.estadoSAT || {
                    estado: 'No Verificado',
                    esVigente: false,
                    esCancelado: false
                },
                xmlPath: null,
                guardadoEn: new Date().toISOString(),
                actualizadoEn: new Date().toISOString()
            };

            // Guardar XML si se proporciona
            if (xmlContent) {
                const xmlPath = this.getRutaXML(rfc, analisisFactura.uuid);
                await fs.ensureDir(path.dirname(xmlPath));
                await fs.writeFile(xmlPath, xmlContent);
                factura.xmlPath = xmlPath;
            }

            // Cargar datos existentes de la empresa
            const rutaEmpresa = this.getRutaEmpresa(rfc);
            let datosEmpresa = {
                rfc: rfc,
                facturas: {},
                estadisticas: {
                    total: 0,
                    vigentes: 0,
                    cancelados: 0,
                    porTipo: {
                        ingreso: 0,
                        egreso: 0,
                        traslado: 0,
                        nomina: 0,
                        pago: 0
                    }
                },
                actualizadoEn: new Date().toISOString()
            };

            if (await fs.pathExists(rutaEmpresa)) {
                datosEmpresa = await fs.readJSON(rutaEmpresa);
            }

            // Actualizar o agregar factura
            const esNueva = !datosEmpresa.facturas[facturaID];
            datosEmpresa.facturas[facturaID] = factura;
            datosEmpresa.actualizadoEn = new Date().toISOString();

            // Recalcular estadísticas
            datosEmpresa.estadisticas = this.calcularEstadisticas(datosEmpresa.facturas);

            // Guardar datos actualizados
            await fs.writeJSON(rutaEmpresa, datosEmpresa, { spaces: 2 });

            // Actualizar índices
            await this.actualizarIndices(rfc, factura);

            return {
                success: true,
                facturaID,
                esNueva,
                factura,
                estadisticas: datosEmpresa.estadisticas
            };

        } catch (error) {
            console.error('Error guardando factura:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Guardar múltiples facturas (lote)
     */
    async guardarFacturasLote(rfc, analisisResultados, xmlDir = null) {
        try {
            console.log(`\n💾 Guardando facturas en respaldo para ${rfc}...`);

            const resultados = {
                total: 0,
                guardadas: 0,
                actualizadas: 0,
                errores: 0,
                detalles: []
            };

            // Procesar todas las facturas del análisis
            const todasFacturas = [
                ...analisisResultados.porEstado.vigente,
                ...analisisResultados.porEstado.cancelado,
                ...analisisResultados.porEstado.noVerificado || []
            ];

            resultados.total = todasFacturas.length;

            for (const factura of todasFacturas) {
                let xmlContent = null;

                // Leer XML si existe
                if (factura.xmlPath && await fs.pathExists(factura.xmlPath)) {
                    xmlContent = await fs.readFile(factura.xmlPath, 'utf-8');
                } else if (xmlDir && factura.fileName) {
                    const xmlPath = path.join(xmlDir, factura.fileName);
                    if (await fs.pathExists(xmlPath)) {
                        xmlContent = await fs.readFile(xmlPath, 'utf-8');
                    }
                }

                const resultado = await this.guardarFactura(rfc, factura, xmlContent);

                if (resultado.success) {
                    if (resultado.esNueva) {
                        resultados.guardadas++;
                    } else {
                        resultados.actualizadas++;
                    }
                    resultados.detalles.push({
                        uuid: factura.uuid,
                        tipo: factura.tipoClasificacion,
                        estado: factura.estadoSAT?.estado || 'No Verificado',
                        guardado: true
                    });
                } else {
                    resultados.errores++;
                    resultados.detalles.push({
                        uuid: factura.uuid,
                        error: resultado.error,
                        guardado: false
                    });
                }
            }

            console.log(`✓ Respaldo completado:`);
            console.log(`  Total: ${resultados.total}`);
            console.log(`  Nuevas: ${resultados.guardadas}`);
            console.log(`  Actualizadas: ${resultados.actualizadas}`);
            console.log(`  Errores: ${resultados.errores}\n`);

            // Actualizar estadísticas en companies.json
            await this.actualizarStatsEmpresa(rfc);

            // Obtener estadísticas finales
            const statsFinales = await this.obtenerEstadisticas(rfc);

            return {
                success: true,
                ...resultados,
                estadisticas: statsFinales
            };

        } catch (error) {
            console.error('Error guardando lote:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calcular estadísticas de facturas
     */
    calcularEstadisticas(facturas) {
        const stats = {
            total: 0,
            vigentes: 0,
            cancelados: 0,
            noVerificados: 0,
            porTipo: {
                ingreso: 0,
                egreso: 0,
                traslado: 0,
                nomina: 0,
                pago: 0
            },
            totales: {
                vigentes: 0,
                cancelados: 0,
                total: 0
            }
        };

        for (const factura of Object.values(facturas)) {
            stats.total++;

            // Contar por estado
            if (factura.estadoSAT?.esVigente) {
                stats.vigentes++;
                stats.totales.vigentes += factura.total || 0;
            } else if (factura.estadoSAT?.esCancelado) {
                stats.cancelados++;
                stats.totales.cancelados += factura.total || 0;
            } else {
                stats.noVerificados++;
            }

            // Contar por tipo
            if (factura.esNomina) {
                stats.porTipo.nomina++;
            } else {
                const tipo = factura.tipoClasificacion.toLowerCase();
                if (stats.porTipo[tipo] !== undefined) {
                    stats.porTipo[tipo]++;
                }
            }

            stats.totales.total += factura.total || 0;
        }

        return stats;
    }

    /**
     * Actualizar índices para búsqueda rápida
     */
    async actualizarIndices(rfc, factura) {
        try {
            // Índice por fecha
            const anio = factura.fecha.substring(0, 4);
            const mes = factura.fecha.substring(5, 7);
            const indiceFecha = await this.cargarIndice(rfc, `fecha_${anio}_${mes}`);

            if (!indiceFecha[factura.id]) {
                indiceFecha[factura.id] = {
                    uuid: factura.uuid,
                    fecha: factura.fecha,
                    total: factura.total,
                    tipo: factura.tipoClasificacion
                };
                await this.guardarIndice(rfc, `fecha_${anio}_${mes}`, indiceFecha);
            }

            // Índice por tipo
            const indiceTipo = await this.cargarIndice(rfc, `tipo_${factura.tipo}`);
            if (!indiceTipo[factura.id]) {
                indiceTipo[factura.id] = {
                    uuid: factura.uuid,
                    fecha: factura.fecha,
                    total: factura.total
                };
                await this.guardarIndice(rfc, `tipo_${factura.tipo}`, indiceTipo);
            }

            // Índice de UUIDs (mapeo rápido)
            const indiceUUID = await this.cargarIndice(rfc, 'uuids');
            indiceUUID[factura.uuid] = factura.id;
            await this.guardarIndice(rfc, 'uuids', indiceUUID);

        } catch (error) {
            console.error('Error actualizando índices:', error.message);
        }
    }

    /**
     * Cargar índice
     */
    async cargarIndice(rfc, tipo) {
        const rutaIndice = this.getRutaIndice(rfc, tipo);
        if (await fs.pathExists(rutaIndice)) {
            return await fs.readJSON(rutaIndice);
        }
        return {};
    }

    /**
     * Guardar índice
     */
    async guardarIndice(rfc, tipo, datos) {
        const rutaIndice = this.getRutaIndice(rfc, tipo);
        await fs.writeJSON(rutaIndice, datos);
    }

    /**
     * Obtener todas las facturas de una empresa
     */
    async obtenerFacturasEmpresa(rfc, filtros = {}) {
        try {
            const rutaEmpresa = this.getRutaEmpresa(rfc);

            if (!await fs.pathExists(rutaEmpresa)) {
                return {
                    success: true,
                    rfc,
                    facturas: [],
                    estadisticas: {
                        total: 0,
                        vigentes: 0,
                        cancelados: 0,
                        porTipo: {}
                    }
                };
            }

            const datosEmpresa = await fs.readJSON(rutaEmpresa);
            let facturas = Object.values(datosEmpresa.facturas);

            // Aplicar filtros
            if (filtros.tipo) {
                facturas = facturas.filter(f => f.tipo === filtros.tipo || f.tipoClasificacion === filtros.tipo);
            }

            if (filtros.esNomina !== undefined) {
                facturas = facturas.filter(f => f.esNomina === filtros.esNomina);
            }

            if (filtros.estado) {
                if (filtros.estado === 'vigente') {
                    facturas = facturas.filter(f => f.estadoSAT?.esVigente);
                } else if (filtros.estado === 'cancelado') {
                    facturas = facturas.filter(f => f.estadoSAT?.esCancelado);
                }
            }

            if (filtros.fechaInicio && filtros.fechaFin) {
                facturas = facturas.filter(f => {
                    return f.fecha >= filtros.fechaInicio && f.fecha <= filtros.fechaFin;
                });
            }

            if (filtros.emisor) {
                facturas = facturas.filter(f => f.emisor.rfc === filtros.emisor);
            }

            if (filtros.receptor) {
                facturas = facturas.filter(f => f.receptor.rfc === filtros.receptor);
            }

            // Ordenar por fecha (más reciente primero)
            facturas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            // Paginación
            const page = filtros.page || 1;
            const limit = filtros.limit || 100;
            const inicio = (page - 1) * limit;
            const fin = inicio + limit;
            const facturasPaginadas = facturas.slice(inicio, fin);

            return {
                success: true,
                rfc,
                facturas: facturasPaginadas,
                total: facturas.length,
                page,
                limit,
                totalPages: Math.ceil(facturas.length / limit),
                estadisticas: datosEmpresa.estadisticas
            };

        } catch (error) {
            console.error('Error obteniendo facturas:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Buscar factura por UUID
     */
    async buscarPorUUID(rfc, uuid) {
        try {
            // Buscar en índice de UUIDs
            const indiceUUID = await this.cargarIndice(rfc, 'uuids');
            const facturaID = indiceUUID[uuid];

            if (!facturaID) {
                return {
                    success: false,
                    error: 'Factura no encontrada'
                };
            }

            const rutaEmpresa = this.getRutaEmpresa(rfc);
            const datosEmpresa = await fs.readJSON(rutaEmpresa);
            const factura = datosEmpresa.facturas[facturaID];

            if (!factura) {
                return {
                    success: false,
                    error: 'Factura no encontrada'
                };
            }

            return {
                success: true,
                factura
            };

        } catch (error) {
            console.error('Error buscando factura:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener XML de una factura
     */
    async obtenerXML(rfc, uuid) {
        try {
            const xmlPath = this.getRutaXML(rfc, uuid);

            if (!await fs.pathExists(xmlPath)) {
                return {
                    success: false,
                    error: 'XML no encontrado'
                };
            }

            const xmlContent = await fs.readFile(xmlPath, 'utf-8');

            return {
                success: true,
                uuid,
                xmlContent,
                xmlPath
            };

        } catch (error) {
            console.error('Error obteniendo XML:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener estadísticas de una empresa
     */
    async obtenerEstadisticas(rfc) {
        try {
            const rutaEmpresa = this.getRutaEmpresa(rfc);

            if (!await fs.pathExists(rutaEmpresa)) {
                return {
                    success: true,
                    rfc,
                    estadisticas: {
                        total: 0,
                        vigentes: 0,
                        cancelados: 0,
                        porTipo: {}
                    }
                };
            }

            const datosEmpresa = await fs.readJSON(rutaEmpresa);

            return {
                success: true,
                rfc,
                estadisticas: datosEmpresa.estadisticas,
                actualizadoEn: datosEmpresa.actualizadoEn
            };

        } catch (error) {
            console.error('Error obteniendo estadísticas:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Listar todas las empresas con facturas
     */
    async listarEmpresas() {
        try {
            const archivos = await fs.readdir(this.dataDir);
            const empresas = [];

            for (const archivo of archivos) {
                if (archivo.endsWith('.json')) {
                    const rfc = archivo.replace('.json', '');
                    const rutaEmpresa = this.getRutaEmpresa(rfc);
                    const datosEmpresa = await fs.readJSON(rutaEmpresa);

                    empresas.push({
                        rfc,
                        totalFacturas: datosEmpresa.estadisticas.total,
                        vigentes: datosEmpresa.estadisticas.vigentes,
                        cancelados: datosEmpresa.estadisticas.cancelados,
                        actualizadoEn: datosEmpresa.actualizadoEn
                    });
                }
            }

            return {
                success: true,
                empresas,
                total: empresas.length
            };

        } catch (error) {
            console.error('Error listando empresas:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Eliminar factura
     */
    async eliminarFactura(rfc, uuid) {
        try {
            const indiceUUID = await this.cargarIndice(rfc, 'uuids');
            const facturaID = indiceUUID[uuid];

            if (!facturaID) {
                return {
                    success: false,
                    error: 'Factura no encontrada'
                };
            }

            const rutaEmpresa = this.getRutaEmpresa(rfc);
            const datosEmpresa = await fs.readJSON(rutaEmpresa);

            delete datosEmpresa.facturas[facturaID];
            delete indiceUUID[uuid];

            // Recalcular estadísticas
            datosEmpresa.estadisticas = this.calcularEstadisticas(datosEmpresa.facturas);
            datosEmpresa.actualizadoEn = new Date().toISOString();

            await fs.writeJSON(rutaEmpresa, datosEmpresa, { spaces: 2 });
            await this.guardarIndice(rfc, 'uuids', indiceUUID);

            // Eliminar XML
            const xmlPath = this.getRutaXML(rfc, uuid);
            if (await fs.pathExists(xmlPath)) {
                await fs.unlink(xmlPath);
            }

            return {
                success: true,
                message: 'Factura eliminada correctamente'
            };

        } catch (error) {
            console.error('Error eliminando factura:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Exportar todas las facturas de una empresa a JSON
     */
    async exportarEmpresa(rfc, outputPath) {
        try {
            const rutaEmpresa = this.getRutaEmpresa(rfc);

            if (!await fs.pathExists(rutaEmpresa)) {
                return {
                    success: false,
                    error: 'Empresa no encontrada'
                };
            }

            const datosEmpresa = await fs.readJSON(rutaEmpresa);
            const exportPath = outputPath || `./exports/${rfc}_export_${Date.now()}.json`;

            await fs.ensureDir(path.dirname(exportPath));
            await fs.writeJSON(exportPath, datosEmpresa, { spaces: 2 });

            return {
                success: true,
                exportPath,
                totalFacturas: datosEmpresa.estadisticas.total
            };

        } catch (error) {
            console.error('Error exportando empresa:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener estadísticas de una empresa
     */
    async obtenerEstadisticas(rfc) {
        try {
            const rutaEmpresa = this.getRutaEmpresa(rfc);

            if (!await fs.pathExists(rutaEmpresa)) {
                return null;
            }

            const datosEmpresa = await fs.readJSON(rutaEmpresa);
            return datosEmpresa.estadisticas;
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error.message);
            return null;
        }
    }

    /**
     * Obtener estadísticas filtradas por período (mes/año)
     */
    async obtenerEstadisticasPorPeriodo(rfc, año, mes = null) {
        try {
            const rutaEmpresa = this.getRutaEmpresa(rfc);

            if (!await fs.pathExists(rutaEmpresa)) {
                return {
                    success: false,
                    error: 'Empresa no encontrada'
                };
            }

            const datosEmpresa = await fs.readJSON(rutaEmpresa);
            let facturas = Object.values(datosEmpresa.facturas);

            // Filtrar por año y mes
            facturas = facturas.filter(f => {
                const fechaFactura = new Date(f.fecha);
                const añoFactura = fechaFactura.getFullYear();
                const mesFactura = fechaFactura.getMonth() + 1; // 1-12

                if (mes) {
                    // Filtrar por mes específico
                    return añoFactura === parseInt(año) && mesFactura === parseInt(mes);
                } else {
                    // Filtrar solo por año
                    return añoFactura === parseInt(año);
                }
            });

            // Calcular estadísticas del período
            let totalIngresos = 0;
            let totalDeducciones = 0;
            let vigentes = 0;
            let canceladas = 0;

            for (const factura of facturas) {
                const esCancelada = factura.estadoSAT?.esCancelado === true;

                if (esCancelada) {
                    canceladas++;
                } else {
                    vigentes++;
                    const tipoLower = factura.tipoClasificacion?.toLowerCase() || '';

                    if (tipoLower === 'ingreso' && !factura.esNomina && factura.tipo !== 'P') {
                        totalIngresos += factura.subTotal || factura.total || 0;
                    } else if (tipoLower === 'egreso') {
                        totalDeducciones += factura.subTotal || factura.total || 0;
                    }
                }
            }

            return {
                success: true,
                rfc,
                año,
                mes,
                estadisticas: {
                    total: facturas.length,
                    vigentes,
                    canceladas,
                    ingresos: totalIngresos,
                    deducciones: totalDeducciones
                }
            };

        } catch (error) {
            console.error('Error obteniendo estadísticas por período:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener lista de clientes y proveedores de una empresa
     */
    async obtenerClientesYProveedores(rfc, año = null, mes = null) {
        try {
            const rutaEmpresa = this.getRutaEmpresa(rfc);

            if (!await fs.pathExists(rutaEmpresa)) {
                return {
                    success: false,
                    error: 'Empresa no encontrada'
                };
            }

            const datosEmpresa = await fs.readJSON(rutaEmpresa);
            let facturas = Object.values(datosEmpresa.facturas);

            // Filtrar por año y mes si se especifica
            if (año) {
                facturas = facturas.filter(f => {
                    const fechaFactura = new Date(f.fecha);
                    const añoFactura = fechaFactura.getFullYear();
                    const mesFactura = fechaFactura.getMonth() + 1;

                    if (mes) {
                        return añoFactura === parseInt(año) && mesFactura === parseInt(mes);
                    } else {
                        return añoFactura === parseInt(año);
                    }
                });
            }

            // Mapas para almacenar clientes y proveedores únicos
            const clientesMap = new Map();
            const proveedoresMap = new Map();

            for (const factura of facturas) {
                // Solo contar facturas vigentes
                if (factura.estadoSAT?.esCancelado) continue;

                const tipoLower = factura.tipoClasificacion?.toLowerCase() || '';

                // Si es factura emitida (ingreso), el receptor es el cliente
                if (tipoLower === 'ingreso' && !factura.esNomina && factura.tipo !== 'P') {
                    const rfcCliente = factura.receptor?.rfc;
                    if (rfcCliente && rfcCliente !== rfc) {
                        if (!clientesMap.has(rfcCliente)) {
                            clientesMap.set(rfcCliente, {
                                rfc: rfcCliente,
                                nombre: factura.receptor.nombre || 'Sin nombre',
                                totalFacturas: 0,
                                totalMonto: 0
                            });
                        }
                        const cliente = clientesMap.get(rfcCliente);
                        cliente.totalFacturas++;
                        cliente.totalMonto += factura.subTotal || factura.total || 0;
                    }
                }

                // Si es factura recibida (egreso), el emisor es el proveedor
                if (tipoLower === 'egreso') {
                    const rfcProveedor = factura.emisor?.rfc;
                    if (rfcProveedor && rfcProveedor !== rfc) {
                        if (!proveedoresMap.has(rfcProveedor)) {
                            proveedoresMap.set(rfcProveedor, {
                                rfc: rfcProveedor,
                                nombre: factura.emisor.nombre || 'Sin nombre',
                                totalFacturas: 0,
                                totalMonto: 0
                            });
                        }
                        const proveedor = proveedoresMap.get(rfcProveedor);
                        proveedor.totalFacturas++;
                        proveedor.totalMonto += factura.subTotal || factura.total || 0;
                    }
                }
            }

            // Convertir a arrays y ordenar por monto descendente
            const clientes = Array.from(clientesMap.values())
                .sort((a, b) => b.totalMonto - a.totalMonto);

            const proveedores = Array.from(proveedoresMap.values())
                .sort((a, b) => b.totalMonto - a.totalMonto);

            // Calcular totales
            const montoTotalClientes = clientes.reduce((sum, c) => sum + c.totalMonto, 0);
            const montoTotalProveedores = proveedores.reduce((sum, p) => sum + p.totalMonto, 0);

            // Agregar porcentaje a cada cliente
            clientes.forEach(cliente => {
                cliente.porcentaje = montoTotalClientes > 0
                    ? (cliente.totalMonto / montoTotalClientes) * 100
                    : 0;
            });

            // Agregar porcentaje a cada proveedor
            proveedores.forEach(proveedor => {
                proveedor.porcentaje = montoTotalProveedores > 0
                    ? (proveedor.totalMonto / montoTotalProveedores) * 100
                    : 0;
            });

            return {
                success: true,
                rfc,
                clientes,
                proveedores,
                totales: {
                    totalClientes: clientes.length,
                    totalProveedores: proveedores.length,
                    montoTotalClientes,
                    montoTotalProveedores
                }
            };

        } catch (error) {
            console.error('Error obteniendo clientes y proveedores:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Limpiar datos de empresa si no tiene facturas
     */
    async limpiarEmpresaSinFacturas(rfc) {
        try {
            const rutaEmpresa = this.getRutaEmpresa(rfc);

            // Si no existe el archivo o está vacío, resetear stats
            if (!await fs.pathExists(rutaEmpresa)) {
                await this.resetearStatsEmpresa(rfc);
                return { success: true, limpiado: true };
            }

            const datosEmpresa = await fs.readJSON(rutaEmpresa);
            const numFacturas = Object.keys(datosEmpresa.facturas || {}).length;

            // Si no hay facturas, resetear
            if (numFacturas === 0) {
                await this.resetearStatsEmpresa(rfc);
                return { success: true, limpiado: true };
            }

            return { success: true, limpiado: false };
        } catch (error) {
            console.error('Error limpiando empresa:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Resetear stats de empresa a cero
     */
    async resetearStatsEmpresa(rfc) {
        try {
            const companiesPath = './data/companies.json';

            if (!await fs.pathExists(companiesPath)) {
                return;
            }

            const companiesData = await fs.readJSON(companiesPath);
            const empresaIndex = companiesData.companies.findIndex(c => c.rfc === rfc);

            if (empresaIndex !== -1) {
                companiesData.companies[empresaIndex].stats = {
                    totalXMLs: 0,
                    xmlsThisMonth: 0,
                    totalEmitidos: 0,
                    totalRecibidos: 0,
                    ingresos: 0,
                    deducciones: 0
                };

                await fs.writeJSON(companiesPath, companiesData, { spaces: 2 });
                console.log(`✓ Stats reseteados para ${rfc}`);
            }
        } catch (error) {
            console.error('Error reseteando stats:', error.message);
        }
    }

    /**
     * Actualizar stats de empresa en companies.json
     */
    async actualizarStatsEmpresa(rfc) {
        try {
            const companiesPath = './data/companies.json';

            // Leer estadísticas de facturas
            const stats = await this.obtenerEstadisticas(rfc);
            if (!stats) {
                console.warn(`No se encontraron estadísticas para RFC: ${rfc}`);
                return;
            }

            // Leer companies.json
            if (!await fs.pathExists(companiesPath)) {
                console.warn('No existe companies.json');
                return;
            }

            const companiesData = await fs.readJSON(companiesPath);
            const empresaIndex = companiesData.companies.findIndex(c => c.rfc === rfc);

            if (empresaIndex === -1) {
                console.warn(`Empresa con RFC ${rfc} no encontrada en companies.json`);
                return;
            }

            // Calcular ingresos y deducciones
            let totalIngresos = 0;
            let totalDeducciones = 0;

            const rutaEmpresa = this.getRutaEmpresa(rfc);
            const datosEmpresa = await fs.readJSON(rutaEmpresa);

            for (const factura of Object.values(datosEmpresa.facturas)) {
                // Contar facturas VIGENTES o NO VERIFICADAS (asumir vigentes por defecto)
                // Solo excluir las explícitamente CANCELADAS
                const esCancelada = factura.estadoSAT?.esCancelado === true;

                if (!esCancelada) {
                    const tipoLower = factura.tipoClasificacion?.toLowerCase() || '';

                    // Excluir complementos de pago y nóminas de los ingresos
                    // Usar SUBTOTAL en lugar de total (sin IVA)
                    if (tipoLower === 'ingreso' && !factura.esNomina && factura.tipo !== 'P') {
                        totalIngresos += factura.subTotal || factura.total || 0;
                    } else if (tipoLower === 'egreso') {
                        totalDeducciones += factura.subTotal || factura.total || 0;
                    }
                }
            }

            // Actualizar stats
            companiesData.companies[empresaIndex].stats = {
                totalXMLs: stats.total || 0,
                xmlsThisMonth: companiesData.companies[empresaIndex].stats?.xmlsThisMonth || 0, // Esto requeriría lógica adicional
                totalEmitidos: stats.porTipo.ingreso + stats.porTipo.nomina + stats.porTipo.pago || 0,
                totalRecibidos: stats.porTipo.egreso + stats.porTipo.traslado || 0,
                ingresos: totalIngresos,
                deducciones: totalDeducciones
            };

            // Guardar
            await fs.writeJSON(companiesPath, companiesData, { spaces: 2 });
            console.log(`✓ Stats actualizados en companies.json para ${rfc}`);
            console.log(`  Total XMLs: ${stats.total}`);
            console.log(`  Ingresos: $${totalIngresos.toFixed(2)}`);
            console.log(`  Deducciones: $${totalDeducciones.toFixed(2)}\n`);

        } catch (error) {
            console.error('Error actualizando stats en companies.json:', error.message);
        }
    }
}

export default new FacturaStorage();
