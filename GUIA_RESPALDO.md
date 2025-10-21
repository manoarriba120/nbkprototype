# 💾 Guía de Sistema de Respaldo Automático

## Descripción

El sistema guarda automáticamente todas las facturas descargadas en una **base de datos por empresa**, creando un respaldo persistente que permite:

- ✅ Consultar facturas sin tener los archivos XML
- ✅ Búsqueda rápida por UUID, fecha, tipo, etc.
- ✅ Estadísticas en tiempo real por empresa
- ✅ Respaldo seguro de XMLs
- ✅ Acceso mediante API REST
- ✅ Organización automática por empresa (RFC)

---

## 🏗️ Estructura de Datos

### Por Empresa (RFC)

Cada empresa tiene su propio archivo de datos:

```
data/
├── facturas/
│   ├── XAXX010101000.json      ← Datos de empresa 1
│   ├── XEXX010101000.json      ← Datos de empresa 2
│   └── ...
│
├── xmls/
│   ├── XAXX010101000/
│   │   ├── UUID-001.xml
│   │   ├── UUID-002.xml
│   │   └── ...
│   └── XEXX010101000/
│       └── ...
│
└── indices/
    ├── XAXX010101000_uuids.json
    ├── XAXX010101000_fecha_2024_01.json
    └── ...
```

### Estructura del Archivo JSON

```json
{
  "rfc": "XAXX010101000",
  "facturas": {
    "abc123...": {
      "id": "abc123...",
      "uuid": "12345678-1234-1234-1234-123456789012",
      "version": "3.3",
      "tipo": "I",
      "tipoClasificacion": "Ingreso",
      "esNomina": false,
      "fecha": "2024-01-15T10:30:00",
      "total": 1160.00,
      "subTotal": 1000.00,
      "moneda": "MXN",
      "emisor": {
        "rfc": "XAXX010101000",
        "nombre": "EMPRESA DEMO SA DE CV"
      },
      "receptor": {
        "rfc": "XEXX010101000",
        "nombre": "CLIENTE DEMO"
      },
      "estadoSAT": {
        "estado": "Vigente",
        "esVigente": true,
        "esCancelado": false
      },
      "xmlPath": "./data/xmls/XAXX010101000/UUID-123.xml",
      "guardadoEn": "2024-01-20T10:30:00.000Z"
    }
  },
  "estadisticas": {
    "total": 150,
    "vigentes": 145,
    "cancelados": 5,
    "porTipo": {
      "ingreso": 125,
      "egreso": 5,
      "nomina": 20
    },
    "totales": {
      "vigentes": 145000.00,
      "cancelados": 5000.00
    }
  }
}
```

---

## 🚀 Uso Automático

### Descarga con Respaldo Automático

Por defecto, el respaldo está **activado automáticamente**:

```bash
# Al descargar, automáticamente se guarda en BD
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31"
  }'
```

**Respuesta incluye información del respaldo:**
```json
{
  "success": true,
  "archivosDescargados": 150,
  "respaldo": {
    "guardadas": 145,
    "actualizadas": 5,
    "errores": 0,
    "estadisticas": {
      "total": 150,
      "vigentes": 145,
      "cancelados": 5
    }
  }
}
```

### Desactivar Respaldo (Opcional)

```bash
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31",
    "guardarRespaldo": false
  }'
```

---

## 📋 Endpoints de Consulta

### 1. Listar Empresas

```bash
GET /api/facturas/empresas
```

**Respuesta:**
```json
{
  "success": true,
  "empresas": [
    {
      "rfc": "XAXX010101000",
      "totalFacturas": 150,
      "vigentes": 145,
      "cancelados": 5,
      "actualizadoEn": "2024-01-20T10:30:00.000Z"
    },
    {
      "rfc": "XEXX010101000",
      "totalFacturas": 85,
      "vigentes": 80,
      "cancelados": 5,
      "actualizadoEn": "2024-01-19T15:20:00.000Z"
    }
  ],
  "total": 2
}
```

---

### 2. Obtener Facturas de una Empresa

```bash
GET /api/facturas/{RFC}
```

**Ejemplo:**
```bash
curl http://localhost:3000/api/facturas/XAXX010101000
```

**Parámetros de query opcionales:**
- `tipo` - Filtrar por tipo (I, E, T, N, P)
- `estado` - Filtrar por estado (vigente, cancelado)
- `esNomina` - Solo nóminas (true/false)
- `fechaInicio` - Fecha inicio (YYYY-MM-DD)
- `fechaFin` - Fecha fin (YYYY-MM-DD)
- `emisor` - RFC del emisor
- `receptor` - RFC del receptor
- `page` - Número de página (default: 1)
- `limit` - Facturas por página (default: 100)

**Ejemplo con filtros:**
```bash
curl "http://localhost:3000/api/facturas/XAXX010101000?estado=vigente&esNomina=true&page=1&limit=50"
```

**Respuesta:**
```json
{
  "success": true,
  "rfc": "XAXX010101000",
  "facturas": [
    {
      "uuid": "...",
      "fecha": "2024-01-15T10:30:00",
      "total": 1160.00,
      "tipo": "Ingreso",
      "esNomina": false,
      "estadoSAT": {
        "estado": "Vigente",
        "esVigente": true
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 100,
  "totalPages": 2,
  "estadisticas": {
    "total": 150,
    "vigentes": 145,
    "cancelados": 5
  }
}
```

---

### 3. Obtener Estadísticas de una Empresa

```bash
GET /api/facturas/{RFC}/estadisticas
```

**Ejemplo:**
```bash
curl http://localhost:3000/api/facturas/XAXX010101000/estadisticas
```

**Respuesta:**
```json
{
  "success": true,
  "rfc": "XAXX010101000",
  "estadisticas": {
    "total": 150,
    "vigentes": 145,
    "cancelados": 5,
    "noVerificados": 0,
    "porTipo": {
      "ingreso": 125,
      "egreso": 5,
      "traslado": 0,
      "nomina": 20,
      "pago": 0
    },
    "totales": {
      "vigentes": 145000.00,
      "cancelados": 5000.00,
      "total": 150000.00
    }
  },
  "actualizadoEn": "2024-01-20T10:30:00.000Z"
}
```

---

### 4. Buscar Factura por UUID

```bash
GET /api/facturas/{RFC}/uuid/{UUID}
```

**Ejemplo:**
```bash
curl http://localhost:3000/api/facturas/XAXX010101000/uuid/12345678-1234-1234-1234-123456789012
```

**Respuesta:**
```json
{
  "success": true,
  "factura": {
    "uuid": "12345678-1234-1234-1234-123456789012",
    "version": "3.3",
    "tipo": "I",
    "tipoClasificacion": "Ingreso",
    "fecha": "2024-01-15T10:30:00",
    "total": 1160.00,
    "emisor": {
      "rfc": "XAXX010101000",
      "nombre": "EMPRESA DEMO SA DE CV"
    },
    "receptor": {
      "rfc": "XEXX010101000",
      "nombre": "CLIENTE DEMO"
    },
    "estadoSAT": {
      "estado": "Vigente",
      "esVigente": true,
      "esCancelado": false
    },
    "xmlPath": "./data/xmls/..."
  }
}
```

---

### 5. Obtener XML de una Factura

```bash
GET /api/facturas/{RFC}/xml/{UUID}
```

**Ejemplo:**
```bash
curl http://localhost:3000/api/facturas/XAXX010101000/xml/12345678-1234-1234-1234-123456789012
```

**Respuesta:** Contenido XML puro

---

### 6. Descargar XML de una Factura

```bash
GET /api/facturas/{RFC}/descargar/{UUID}
```

**Ejemplo:**
```bash
curl -O http://localhost:3000/api/facturas/XAXX010101000/descargar/12345678-1234-1234-1234-123456789012
```

**Resultado:** Descarga el archivo `{UUID}.xml`

---

### 7. Solo Facturas Vigentes

```bash
GET /api/facturas/{RFC}/vigentes
```

**Ejemplo:**
```bash
curl http://localhost:3000/api/facturas/XAXX010101000/vigentes?page=1&limit=50
```

---

### 8. Solo Facturas Canceladas

```bash
GET /api/facturas/{RFC}/canceladas
```

---

### 9. Solo Nóminas

```bash
GET /api/facturas/{RFC}/nomina
```

**Ejemplo:**
```bash
curl http://localhost:3000/api/facturas/XAXX010101000/nomina
```

---

### 10. Exportar Empresa Completa

```bash
GET /api/facturas/{RFC}/exportar
```

**Ejemplo:**
```bash
curl -O http://localhost:3000/api/facturas/XAXX010101000/exportar
```

**Resultado:** Descarga JSON completo con todas las facturas

---

### 11. Eliminar una Factura

```bash
DELETE /api/facturas/{RFC}/uuid/{UUID}
```

**Ejemplo:**
```bash
curl -X DELETE http://localhost:3000/api/facturas/XAXX010101000/uuid/12345678-1234-1234-1234-123456789012
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Dashboard de Empresa

```javascript
// 1. Obtener estadísticas
const stats = await fetch('http://localhost:3000/api/facturas/XAXX010101000/estadisticas');
const data = await stats.json();

console.log(`Total de facturas: ${data.estadisticas.total}`);
console.log(`Vigentes: ${data.estadisticas.vigentes}`);
console.log(`Canceladas: ${data.estadisticas.cancelados}`);
console.log(`Nóminas: ${data.estadisticas.porTipo.nomina}`);
console.log(`Total en facturas vigentes: $${data.estadisticas.totales.vigentes.toFixed(2)}`);
```

---

### Ejemplo 2: Listar Facturas del Mes

```javascript
// Obtener facturas de enero 2024
const response = await fetch(
  'http://localhost:3000/api/facturas/XAXX010101000?' +
  'fechaInicio=2024-01-01&fechaFin=2024-01-31&estado=vigente'
);

const data = await response.json();
console.log(`Facturas de enero: ${data.facturas.length}`);

data.facturas.forEach(f => {
  console.log(`${f.fecha} - ${f.receptor.nombre} - $${f.total}`);
});
```

---

### Ejemplo 3: Buscar una Factura Específica

```javascript
const uuid = '12345678-1234-1234-1234-123456789012';
const response = await fetch(
  `http://localhost:3000/api/facturas/XAXX010101000/uuid/${uuid}`
);

const data = await response.json();

if (data.success) {
  console.log('Factura encontrada:');
  console.log(`  Fecha: ${data.factura.fecha}`);
  console.log(`  Total: $${data.factura.total}`);
  console.log(`  Estado: ${data.factura.estadoSAT.estado}`);
} else {
  console.log('Factura no encontrada');
}
```

---

### Ejemplo 4: Descargar Nóminas del Año

```javascript
const response = await fetch(
  'http://localhost:3000/api/facturas/XAXX010101000/nomina?' +
  'fechaInicio=2024-01-01&fechaFin=2024-12-31'
);

const data = await response.json();

console.log(`Total de nóminas del año: ${data.total}`);

for (const nomina of data.facturas) {
  // Descargar XML de cada nómina
  const xmlUrl = `http://localhost:3000/api/facturas/XAXX010101000/descargar/${nomina.uuid}`;
  console.log(`Descargando: ${nomina.uuid}.xml`);
}
```

---

## 🔄 Actualización Automática

El sistema actualiza automáticamente:

### Al Descargar Nuevas Facturas
```
1. Descarga XMLs del SAT
2. Analiza y clasifica
3. Guarda en base de datos
4. Actualiza estadísticas
5. Crea índices para búsqueda rápida
```

### Si una Factura Ya Existe
- Se actualiza la información
- Se mantiene el XML original
- Se actualizan estadísticas
- Se registra fecha de actualización

---

## 📊 Beneficios del Sistema

### 1. Acceso Rápido
```
Búsqueda por UUID: < 1ms (índice)
Consulta de empresa: < 10ms
Estadísticas: Precalculadas
```

### 2. Respaldo Seguro
```
✅ XMLs guardados en disco
✅ Datos JSON estructurados
✅ Índices para búsqueda rápida
✅ Versionado automático
```

### 3. Sin Dependencias Externas
```
❌ No requiere MySQL
❌ No requiere PostgreSQL
❌ No requiere MongoDB
✅ Solo archivos JSON + XMLs
```

### 4. Portable
```
✅ Copiar carpeta data/ = Respaldo completo
✅ Funciona en cualquier sistema
✅ Fácil de respaldar
```

---

## ⚙️ Configuración

### Directorios (por defecto)

```javascript
// En facturaStorage.js
this.dataDir = './data/facturas';    // Datos JSON por empresa
this.indexDir = './data/indices';    // Índices de búsqueda
this.xmlDir = './data/xmls';         // XMLs guardados
```

### Personalizar

```javascript
import facturaStorage from './services/facturaStorage.js';

// Cambiar directorios
facturaStorage.dataDir = './mi_carpeta/facturas';
facturaStorage.xmlDir = './mi_carpeta/xmls';
```

---

## 🔍 Búsqueda y Filtros

### Por Fecha
```bash
curl "http://localhost:3000/api/facturas/XAXX010101000?fechaInicio=2024-01-01&fechaFin=2024-01-31"
```

### Por Tipo
```bash
curl "http://localhost:3000/api/facturas/XAXX010101000?tipo=I"  # Ingresos
curl "http://localhost:3000/api/facturas/XAXX010101000?tipo=N"  # Nómina
```

### Por Estado
```bash
curl "http://localhost:3000/api/facturas/XAXX010101000?estado=vigente"
curl "http://localhost:3000/api/facturas/XAXX010101000?estado=cancelado"
```

### Solo Nómina
```bash
curl "http://localhost:3000/api/facturas/XAXX010101000?esNomina=true"
```

### Combinado
```bash
curl "http://localhost:3000/api/facturas/XAXX010101000?estado=vigente&esNomina=true&fechaInicio=2024-01-01&fechaFin=2024-12-31"
```

---

## 📦 Respaldo y Exportación

### Exportar Empresa Completa

```bash
curl -O http://localhost:3000/api/facturas/XAXX010101000/exportar
```

**Resultado:** `XAXX010101000_export_1705320600000.json`

### Importar a Otra Instalación

1. Copiar carpeta `data/` completa
2. Listo - el sistema lee automáticamente

---

## 🛡️ Seguridad

### Recomendaciones:

1. **No exponer públicamente** - Solo acceso interno
2. **Respaldar carpeta `data/`** periódicamente
3. **Proteger con autenticación** (próxima versión)
4. **Limitar acceso por IP** si es necesario

---

## 📝 Resumen

**El sistema de respaldo automático:**

✅ Se activa automáticamente al descargar facturas
✅ Guarda TODO: datos + XMLs
✅ Organiza por empresa (RFC)
✅ Permite consultas rápidas vía API
✅ Mantiene estadísticas actualizadas
✅ Separa vigentes/canceladas/nómina
✅ Permite búsqueda por múltiples criterios
✅ Exporta/importa fácilmente
✅ Sin dependencias de BD externas

**Ubicación de datos:**
```
./data/facturas/  ← Datos JSON por empresa
./data/xmls/      ← XMLs originales
./data/indices/   ← Índices de búsqueda
```

**Consultas principales:**
```
GET /api/facturas/empresas              ← Listar empresas
GET /api/facturas/{RFC}                 ← Facturas de empresa
GET /api/facturas/{RFC}/estadisticas    ← Estadísticas
GET /api/facturas/{RFC}/vigentes        ← Solo vigentes
GET /api/facturas/{RFC}/nomina          ← Solo nóminas
```

¡El respaldo está activado por defecto y funciona automáticamente! 🎉
