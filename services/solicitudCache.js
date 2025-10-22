/**
 * Sistema de caché de solicitudes del SAT
 * Permite reutilizar solicitudes existentes y evitar crear nuevas innecesariamente
 */

import fs from 'fs-extra';
import path from 'path';

class SolicitudCache {
    constructor() {
        this.cachePath = './data/solicitudes_cache.json';
    }

    /**
     * Inicializar archivo de caché
     */
    async init() {
        await fs.ensureDir('./data');
        if (!await fs.pathExists(this.cachePath)) {
            await fs.writeJSON(this.cachePath, { solicitudes: [] }, { spaces: 2 });
        }
    }

    /**
     * Generar clave única para una solicitud
     */
    generarClave(rfc, tipo, fechaInicio, fechaFin) {
        // Normalizar fechas a solo YYYY-MM-DD
        const inicio = fechaInicio.split(' ')[0];
        const fin = fechaFin.split(' ')[0];
        return `${rfc}_${tipo}_${inicio}_${fin}`;
    }

    /**
     * Buscar solicitud existente que pueda reutilizarse
     */
    async buscarSolicitud(rfc, tipo, fechaInicio, fechaFin) {
        await this.init();
        const cache = await fs.readJSON(this.cachePath);
        const clave = this.generarClave(rfc, tipo, fechaInicio, fechaFin);

        // Buscar solicitud exacta
        const solicitudExacta = cache.solicitudes.find(s =>
            s.clave === clave &&
            this.esValida(s)
        );

        if (solicitudExacta) {
            console.log(`✓ Solicitud en caché encontrada: ${solicitudExacta.idSolicitud}`);
            return solicitudExacta;
        }

        return null;
    }

    /**
     * Verificar si una solicitud aún es válida (no ha expirado)
     */
    esValida(solicitud) {
        // Las solicitudes del SAT son válidas por 72 horas
        const ahora = new Date();
        const creacion = new Date(solicitud.timestamp);
        const horasTranscurridas = (ahora - creacion) / (1000 * 60 * 60);

        return horasTranscurridas < 72;
    }

    /**
     * Guardar nueva solicitud en caché
     */
    async guardarSolicitud(rfc, tipo, fechaInicio, fechaFin, idSolicitud, metadata = {}) {
        await this.init();
        const cache = await fs.readJSON(this.cachePath);
        const clave = this.generarClave(rfc, tipo, fechaInicio, fechaFin);

        // Eliminar solicitud anterior con la misma clave si existe
        cache.solicitudes = cache.solicitudes.filter(s => s.clave !== clave);

        // Agregar nueva solicitud
        cache.solicitudes.push({
            clave,
            rfc,
            tipo,
            fechaInicio,
            fechaFin,
            idSolicitud,
            timestamp: new Date().toISOString(),
            metadata
        });

        await fs.writeJSON(this.cachePath, cache, { spaces: 2 });
        console.log(`💾 Solicitud guardada en caché: ${idSolicitud}`);
    }

    /**
     * Limpiar solicitudes expiradas
     */
    async limpiarExpiradas() {
        await this.init();
        const cache = await fs.readJSON(this.cachePath);

        const solicitudesValidas = cache.solicitudes.filter(s => this.esValida(s));
        const eliminadas = cache.solicitudes.length - solicitudesValidas.length;

        if (eliminadas > 0) {
            cache.solicitudes = solicitudesValidas;
            await fs.writeJSON(this.cachePath, cache, { spaces: 2 });
            console.log(`🗑️  ${eliminadas} solicitudes expiradas eliminadas del caché`);
        }
    }

    /**
     * Obtener estadísticas del caché
     */
    async obtenerEstadisticas() {
        await this.init();
        const cache = await fs.readJSON(this.cachePath);

        const validas = cache.solicitudes.filter(s => this.esValida(s)).length;
        const expiradas = cache.solicitudes.length - validas;

        return {
            total: cache.solicitudes.length,
            validas,
            expiradas
        };
    }

    /**
     * Listar todas las solicitudes en caché
     */
    async listarSolicitudes() {
        await this.init();
        const cache = await fs.readJSON(this.cachePath);

        return cache.solicitudes.map(s => ({
            ...s,
            valida: this.esValida(s),
            edad: this.calcularEdad(s.timestamp)
        }));
    }

    /**
     * Calcular edad de una solicitud en horas
     */
    calcularEdad(timestamp) {
        const ahora = new Date();
        const creacion = new Date(timestamp);
        const horas = (ahora - creacion) / (1000 * 60 * 60);
        return Math.floor(horas);
    }
}

const solicitudCache = new SolicitudCache();
export default solicitudCache;
