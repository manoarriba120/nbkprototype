# 📊 Guía de Clasificación de Facturas

## Descripción

El sistema ahora clasifica automáticamente los CFDIs descargados en:

### 🔍 Por Estado (Vigente/Cancelado)
- **Vigentes** ✅ - Facturas válidas y activas en el SAT
- **Canceladas** ❌ - Facturas canceladas por el emisor

### 📝 Por Tipo de Comprobante
- **Ingreso** (I) - Facturas de venta/ingreso
- **Egreso** (E) - Notas de crédito/devoluciones
- **Traslado** (T) - Comprobantes de traslado
- **Nómina** (N) - Recibos de nómina
- **Pago** (P) - Complementos de pago

---

## 🚀 Uso Rápido

### Opción 1: Descarga y Clasificación Automática

```bash
# Descargar Y clasificar en un solo paso
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31",
    "clasificar": true,
    "verificarEstado": true
  }'
```

**Parámetros:**
- `clasificar: true` - Activa la clasificación automática
- `verificarEstado: true` - Verifica estado en el SAT (vigente/cancelado)

**Respuesta:**
```json
{
  "success": true,
  "archivosDescargados": 150,
  "downloadPath": "./downloads/XAXX010101000/emitidas/1705320600000",
  "clasificacion": {
    "vigentes": 145,
    "cancelados": 5,
    "nomina": 20,
    "reporte": {
      "resumen": {...},
      "porTipo": {...},
      "porEstado": {...},
      "totales": {...}
    }
  }
}
```

### Opción 2: Clasificar Archivos Ya Descargados

```bash
# Clasificar un directorio existente
curl -X POST http://localhost:3000/api/download-ws/clasificar \
  -H "Content-Type: application/json" \
  -d '{
    "directorio": "./downloads/XAXX010101000/emitidas/1705320600000",
    "verificarEstado": true
  }'
```

---

## 📁 Estructura de Organización

Después de la clasificación, los archivos se organizan automáticamente:

```
downloads/XAXX010101000/emitidas/1705320600000/
│
├── vigentes/
│   ├── ingreso/
│   │   ├── UUID-001.xml
│   │   ├── UUID-002.xml
│   │   └── ...
│   │
│   ├── egreso/
│   │   └── UUID-nota-credito.xml
│   │
│   ├── nomina/
│   │   ├── UUID-nomina-001.xml
│   │   ├── UUID-nomina-002.xml
│   │   └── ...
│   │
│   ├── traslado/
│   ├── pago/
│   └── ...
│
├── cancelados/
│   ├── ingreso/
│   │   └── UUID-cancelado.xml
│   │
│   ├── nomina/
│   │   └── UUID-nomina-cancelada.xml
│   │
│   └── ...
│
└── reporte_clasificacion.json  ← Reporte detallado
```

---

## 📋 Endpoints Disponibles

### 1. Descargar con Clasificación

#### `POST /api/download-ws/emitidas`
Descarga facturas emitidas y opcionalmente las clasifica

**Parámetros:**
```json
{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "clasificar": true,           // Opcional: Activar clasificación
  "verificarEstado": true        // Opcional: Verificar en SAT
}
```

#### `POST /api/download-ws/recibidas`
Descarga facturas recibidas y opcionalmente las clasifica

**Parámetros:** Mismos que emitidas

---

### 2. Clasificar Archivos Existentes

#### `POST /api/download-ws/clasificar`
Clasifica XMLs ya descargados

**Parámetros:**
```json
{
  "directorio": "./downloads/XAXX010101000/emitidas/1705320600000",
  "verificarEstado": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "directorio": "...",
  "resumen": {
    "total": 150,
    "analizados": 150,
    "errores": 0
  },
  "porTipo": {
    "ingreso": 125,
    "egreso": 5,
    "traslado": 0,
    "nomina": 20,
    "pago": 0
  },
  "porEstado": {
    "vigente": 145,
    "cancelado": 5,
    "noVerificado": 0
  },
  "reporte": {
    // Reporte completo...
  }
}
```

---

### 3. Verificar Estado Individual

#### `POST /api/download-ws/verificar-estado`
Verifica si una factura está vigente o cancelada en el SAT

**Parámetros:**
```json
{
  "uuid": "12345678-1234-1234-1234-123456789012",
  "rfcEmisor": "XAXX010101000",
  "rfcReceptor": "XEXX010101000",
  "total": 1160.00
}
```

**Respuesta:**
```json
{
  "success": true,
  "uuid": "12345678-1234-1234-1234-123456789012",
  "estado": "Vigente",
  "codigoEstatus": "S",
  "esVigente": true,
  "esCancelado": false,
  "estatusCancelacion": "N/A",
  "validacionEFOS": "200"
}
```

**Códigos de Estado:**
- `S` - Vigente (Satisfactorio)
- `C` - Cancelado
- `N` - No encontrado

---

### 4. Analizar XML Individual

#### `POST /api/download-ws/analizar-xml`
Extrae toda la información de un XML

**Parámetros:**
```json
{
  "xmlPath": "./downloads/XAXX010101000/emitidas/1705320600000/UUID-123.xml"
}
```

**Respuesta:**
```json
{
  "success": true,
  "analisis": {
    "uuid": "12345678-1234-1234-1234-123456789012",
    "version": "3.3",
    "tipoDeComprobante": "I",
    "tipoClasificacion": "Ingreso",
    "esNomina": false,
    "fecha": "2024-01-15T10:30:00",
    "total": 1160.00,
    "subTotal": 1000.00,
    "moneda": "MXN",
    "metodoPago": "PUE",
    "formaPago": "03",
    "emisor": {
      "rfc": "XAXX010101000",
      "nombre": "EMPRESA DEMO SA DE CV",
      "regimenFiscal": "601"
    },
    "receptor": {
      "rfc": "XEXX010101000",
      "nombre": "CLIENTE DEMO",
      "usoCFDI": "G03"
    },
    "conceptos": [
      {
        "descripcion": "Servicio profesional",
        "cantidad": 1,
        "valorUnitario": 1000.00,
        "importe": 1000.00
      }
    ]
  }
}
```

---

## 🔍 Proceso de Clasificación

### Paso 1: Análisis de XMLs
```
┌─────────────────────────┐
│  Analizar cada XML      │
├─────────────────────────┤
│ • Extraer UUID          │
│ • Identificar tipo      │
│ • Detectar nómina       │
│ • Leer emisor/receptor  │
│ • Calcular totales      │
└─────────────────────────┘
```

### Paso 2: Verificación en SAT (Opcional)
```
┌─────────────────────────┐
│  Verificar en SAT       │
├─────────────────────────┤
│ • Consultar UUID        │
│ • Estado: Vigente/      │
│   Cancelado             │
│ • Delay: 500ms/factura  │
└─────────────────────────┘
```

### Paso 3: Organización
```
┌─────────────────────────┐
│  Organizar Archivos     │
├─────────────────────────┤
│ • Crear estructura      │
│ • Copiar a carpetas     │
│ • Generar reporte       │
└─────────────────────────┘
```

---

## 📄 Reporte de Clasificación

El archivo `reporte_clasificacion.json` contiene:

```json
{
  "fecha": "2024-01-20T10:30:00.000Z",
  "resumen": {
    "total": 150,
    "analizados": 150,
    "errores": 0
  },
  "porTipo": {
    "ingreso": 125,
    "egreso": 5,
    "traslado": 0,
    "nomina": 20,
    "pago": 0
  },
  "porEstado": {
    "vigente": 145,
    "cancelado": 5,
    "noVerificado": 0
  },
  "totales": {
    "vigentes": {
      "total": 145000.00,
      "subtotal": 125000.00
    },
    "cancelados": {
      "total": 5000.00,
      "subtotal": 4310.34
    }
  },
  "detalles": {
    "vigentes": [
      {
        "uuid": "...",
        "fecha": "2024-01-15T10:30:00",
        "emisor": "XAXX010101000",
        "receptor": "XEXX010101000",
        "total": 1160.00,
        "tipo": "Ingreso",
        "esNomina": false
      }
    ],
    "cancelados": [...]
  }
}
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Descarga Básica Sin Clasificación

```bash
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31"
  }'
```

Resultado: XMLs descargados sin organizar

---

### Ejemplo 2: Descarga Con Clasificación (Sin Verificar Estado)

```bash
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31",
    "clasificar": true,
    "verificarEstado": false
  }'
```

Resultado: XMLs organizados por tipo (ingreso, nómina, etc.)

---

### Ejemplo 3: Descarga Completa Con Verificación

```bash
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31",
    "clasificar": true,
    "verificarEstado": true
  }'
```

Resultado: XMLs organizados por estado (vigente/cancelado) y tipo

⚠️ **Advertencia:** La verificación de estado consulta el SAT para cada factura.
- Con 100 facturas: ~50 segundos (500ms delay)
- Con 1000 facturas: ~8.3 minutos

---

### Ejemplo 4: Clasificar Archivos Antiguos

```bash
# Si ya descargaste facturas antes, puedes clasificarlas ahora
curl -X POST http://localhost:3000/api/download-ws/clasificar \
  -H "Content-Type: application/json" \
  -d '{
    "directorio": "./downloads/XAXX010101000/emitidas/1705200000000",
    "verificarEstado": true
  }'
```

---

### Ejemplo 5: Verificar Una Factura Específica

```bash
curl -X POST http://localhost:3000/api/download-ws/verificar-estado \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "A5F7B234-8C9D-4E5F-A1B2-3C4D5E6F7890",
    "rfcEmisor": "XAXX010101000",
    "rfcReceptor": "XEXX010101000",
    "total": 1160.00
  }'
```

---

## 🎯 Detección de Nómina

El sistema detecta automáticamente facturas de nómina mediante:

### 1. Tipo de Comprobante
```xml
<cfdi:Comprobante TipoDeComprobante="N">
```

### 2. Complemento de Nómina
```xml
<cfdi:Complemento>
    <nomina12:Nomina ...>
    </nomina12:Nomina>
</cfdi:Complemento>
```

Las facturas de nómina se separan en:
- `vigentes/nomina/` - Nóminas válidas
- `cancelados/nomina/` - Nóminas canceladas

---

## ⚙️ Configuración Avanzada

### Delay entre Verificaciones

Por defecto: 500ms entre consultas al SAT

Para cambiar:
```javascript
// En el código
clasificacion = await xmlAnalyzer.procesarCompleto(downloadPath, {
    verificarEstado: true,
    delayVerificacion: 1000  // 1 segundo
});
```

### Procesar Solo Análisis (Sin Verificar)

```bash
curl -X POST http://localhost:3000/api/download-ws/clasificar \
  -H "Content-Type: application/json" \
  -d '{
    "directorio": "./downloads/XAXX010101000/emitidas/1705320600000",
    "verificarEstado": false
  }'
```

Ventaja: Mucho más rápido (sin consultas al SAT)
Desventaja: No se sabe si están vigentes o canceladas

---

## 📊 Estadísticas y Reportes

### Totales por Estado

El reporte incluye sumas totales:

```json
{
  "totales": {
    "vigentes": {
      "total": 145000.00,      // Suma de todas las facturas vigentes
      "subtotal": 125000.00
    },
    "cancelados": {
      "total": 5000.00,        // Suma de facturas canceladas
      "subtotal": 4310.34
    }
  }
}
```

### Uso en Contabilidad

Las facturas canceladas **NO** deben incluirse en:
- Declaraciones fiscales
- Cálculo de impuestos
- Reportes de ingresos/egresos

Ejemplo de cálculo correcto:
```
Ingresos totales = Solo facturas vigentes
                 = $145,000.00 (no $150,000.00)
```

---

## ⚠️ Limitaciones y Consideraciones

### 1. Límites del SAT

El servicio de verificación del SAT puede:
- Rechazar solicitudes si hay demasiadas en poco tiempo
- Tener caídas temporales
- Responder lento en horas pico

**Recomendación:** Usar delay de al menos 500ms

### 2. Facturas Sin UUID

Algunas facturas antiguas pueden no tener UUID.
Estas se marcan como "No Verificado"

### 3. XMLs Corruptos

Si un XML está corrupto, se reporta en:
```json
{
  "resumen": {
    "errores": 2  // 2 XMLs no pudieron analizarse
  }
}
```

### 4. Tiempo de Procesamiento

Tiempos estimados:

| Facturas | Sin Verificar | Con Verificar SAT |
|----------|---------------|-------------------|
| 100      | ~10 segundos  | ~50 segundos      |
| 500      | ~40 segundos  | ~4 minutos        |
| 1000     | ~1.5 minutos  | ~8.3 minutos      |

---

## 🔧 Solución de Problemas

### Error: "No se pudo verificar UUID"

**Causa:** El SAT no respondió o la factura no existe

**Solución:**
- Verificar que el UUID sea correcto
- Reintentar más tarde
- Verificar manualmente en https://verificacfdi.facturaelectronica.sat.gob.mx/

### Error: "XML inválido"

**Causa:** Archivo XML corrupto o mal formado

**Solución:**
- Verificar integridad del archivo
- Re-descargar desde el SAT

### Error: "Timeout"

**Causa:** Demasiadas consultas simultáneas

**Solución:**
- Aumentar el delay entre verificaciones
- Procesar en lotes más pequeños

---

## 📝 Mejores Prácticas

### 1. Flujo Recomendado

```
1. Descargar facturas SIN clasificar
2. Revisar que se descargaron correctamente
3. Clasificar con verificarEstado=true
4. Revisar reporte JSON
5. Usar carpetas organizadas para contabilidad
```

### 2. Para Volúmenes Grandes

```bash
# Paso 1: Descargar todo
curl -X POST .../emitidas -d '{"fechaInicio":"2024-01-01","fechaFin":"2024-01-31"}'

# Paso 2: Clasificar sin verificar (rápido)
curl -X POST .../clasificar -d '{"directorio":"...","verificarEstado":false}'

# Paso 3: Verificar solo facturas importantes manualmente
curl -X POST .../verificar-estado -d '{...}'
```

### 3. Backup

Siempre mantén una copia de los XMLs originales:
```
downloads/
├── originales/     ← Backup sin tocar
└── clasificados/   ← Versión organizada
```

---

## 📞 Resumen

**Clasificación automática incluye:**
- ✅ Identificación de tipo (Ingreso, Nómina, etc.)
- ✅ Separación de nómina
- ✅ Verificación de estado (Vigente/Cancelado)
- ✅ Organización automática en carpetas
- ✅ Reporte JSON detallado
- ✅ Cálculo de totales

**Endpoints principales:**
- `POST /api/download-ws/emitidas` + `clasificar: true`
- `POST /api/download-ws/recibidas` + `clasificar: true`
- `POST /api/download-ws/clasificar`
- `POST /api/download-ws/verificar-estado`

**Resultado final:**
Facturas organizadas en `vigentes/` y `cancelados/`, con subcarpetas por tipo, más reporte detallado en JSON.
