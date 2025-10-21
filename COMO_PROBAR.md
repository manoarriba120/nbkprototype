# 🧪 Cómo Probar el Sistema

## Opción 1: Script Interactivo (Recomendado)

### Paso 1: Asegúrate de que el servidor esté corriendo

```bash
npm start
```

Deberías ver:
```
╔═══════════════════════════════════════════════╗
║   NBK - Sistema de Descarga SAT               ║
║   Servidor corriendo en puerto 3000           ║
║   http://localhost:3000                       ║
╚═══════════════════════════════════════════════╝
```

### Paso 2: Ejecuta el script de prueba

Abre **otra terminal** y ejecuta:

```bash
node test-completo.js
```

Verás un menú interactivo:

```
╔═══════════════════════════════════════════════════════════╗
║         PRUEBA DEL SISTEMA DE DESCARGA SAT               ║
╚═══════════════════════════════════════════════════════════╝

Selecciona qué deseas probar:

1. 🔐 Autenticación con e.firma
2. 📥 Descargar facturas (con respaldo automático)
3. 📊 Ver empresas con facturas guardadas
4. 📋 Consultar facturas de una empresa
5. 📈 Ver estadísticas de una empresa
6. 🔍 Buscar factura por UUID
7. 📄 Ver facturas vigentes
8. 💼 Ver nóminas
9. 🧪 Clasificar facturas ya descargadas
10. ✅ Verificar estado de una factura en el SAT
11. 🏢 Subir constancia de situación fiscal
0. ❌ Salir
```

---

## Opción 2: Pruebas con cURL (Rápidas)

### 1. Verificar que el servidor funciona

```bash
curl http://localhost:3000/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 123.456
}
```

---

### 2. Autenticación con e.firma

```bash
curl -X POST http://localhost:3000/api/auth-ws/login-efirma \
  -F "certificate=@/ruta/a/tu/certificado.cer" \
  -F "key=@/ruta/a/tu/llave.key" \
  -F "password=tu_contraseña"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Autenticación exitosa con e.firma",
  "session": {
    "rfc": "XAXX010101000",
    "authenticated": true,
    "authMethod": "efirma",
    "timestamp": "2024-01-20T10:30:00.000Z",
    "certValidUntil": "2026-01-20T10:30:00.000Z"
  }
}
```

---

### 3. Verificar sesión

```bash
curl http://localhost:3000/api/auth-ws/session
```

---

### 4. Descargar facturas CON respaldo automático

```bash
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31",
    "clasificar": true,
    "verificarEstado": false,
    "guardarRespaldo": true
  }'
```

**Esto va a:**
1. ✅ Descargar facturas del SAT
2. ✅ Clasificarlas por tipo y estado
3. ✅ **Guardarlas automáticamente en la base de datos**
4. ✅ Generar estadísticas

**Respuesta esperada:**
```json
{
  "success": true,
  "rfc": "XAXX010101000",
  "archivosDescargados": 150,
  "clasificacion": {
    "vigentes": 145,
    "cancelados": 5,
    "nomina": 20
  },
  "respaldo": {
    "guardadas": 145,
    "actualizadas": 5,
    "errores": 0
  }
}
```

---

### 5. Ver empresas con facturas guardadas

```bash
curl http://localhost:3000/api/facturas/empresas
```

**Respuesta esperada:**
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
    }
  ],
  "total": 1
}
```

---

### 6. Consultar facturas de una empresa

```bash
curl "http://localhost:3000/api/facturas/XAXX010101000?limit=10"
```

---

### 7. Ver estadísticas de una empresa

```bash
curl http://localhost:3000/api/facturas/XAXX010101000/estadisticas
```

**Respuesta esperada:**
```json
{
  "success": true,
  "rfc": "XAXX010101000",
  "estadisticas": {
    "total": 150,
    "vigentes": 145,
    "cancelados": 5,
    "porTipo": {
      "ingreso": 125,
      "egreso": 5,
      "nomina": 20,
      "traslado": 0,
      "pago": 0
    },
    "totales": {
      "vigentes": 145000.00,
      "cancelados": 5000.00,
      "total": 150000.00
    }
  }
}
```

---

### 8. Ver solo facturas vigentes

```bash
curl "http://localhost:3000/api/facturas/XAXX010101000/vigentes?limit=10"
```

---

### 9. Ver solo nóminas

```bash
curl "http://localhost:3000/api/facturas/XAXX010101000/nomina"
```

---

### 10. Buscar una factura por UUID

```bash
curl http://localhost:3000/api/facturas/XAXX010101000/uuid/12345678-1234-1234-1234-123456789012
```

---

### 11. Descargar XML de una factura

```bash
curl -O http://localhost:3000/api/facturas/XAXX010101000/descargar/12345678-1234-1234-1234-123456789012
```

---

### 12. Subir constancia de situación fiscal

```bash
curl -X POST http://localhost:3000/api/companies/extract-constancia \
  -F "constancia=@/ruta/a/constancia.pdf"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "rfc": "XAXX010101000",
    "razonSocial": "EMPRESA DEMO SA DE CV",
    "regimen": "601 - General de Ley Personas Morales",
    "domicilioFiscal": "Calle 123, Col. Centro, Ciudad",
    "codigoPostal": "12345",
    "giro": "Servicios profesionales"
  },
  "message": "Datos extraídos correctamente de la Constancia Fiscal"
}
```

---

## Opción 3: Pruebas con Postman

### Importar colección

Puedes usar estos endpoints en Postman:

1. **Auth WS Login**: `POST http://localhost:3000/api/auth-ws/login-efirma`
2. **Descargar Emitidas**: `POST http://localhost:3000/api/download-ws/emitidas`
3. **Listar Empresas**: `GET http://localhost:3000/api/facturas/empresas`
4. **Ver Facturas**: `GET http://localhost:3000/api/facturas/{RFC}`
5. **Estadísticas**: `GET http://localhost:3000/api/facturas/{RFC}/estadisticas`

---

## 📁 Verificar Archivos Guardados

Después de descargar facturas, verifica:

### 1. Archivos XML descargados

```bash
ls downloads/XAXX010101000/emitidas/*/
```

Deberías ver carpetas organizadas:
```
downloads/XAXX010101000/emitidas/1705320600000/
├── vigentes/
│   ├── ingreso/
│   ├── nomina/
│   └── ...
├── cancelados/
└── reporte_clasificacion.json
```

### 2. Base de datos de facturas

```bash
ls data/facturas/
```

Deberías ver:
```
XAXX010101000.json
```

### 3. XMLs en respaldo

```bash
ls data/xmls/XAXX010101000/
```

Deberías ver archivos XML guardados:
```
UUID-001.xml
UUID-002.xml
...
```

---

## 🎯 Flujo Completo de Prueba

### Escenario: Descargar y consultar facturas

```bash
# 1. Autenticarse
curl -X POST http://localhost:3000/api/auth-ws/login-efirma \
  -F "certificate=@certificado.cer" \
  -F "key=@llave.key" \
  -F "password=mi_contraseña"

# 2. Descargar facturas (guarda automáticamente)
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31"
  }'

# Esperar a que termine...

# 3. Ver empresas guardadas
curl http://localhost:3000/api/facturas/empresas

# 4. Ver estadísticas
curl http://localhost:3000/api/facturas/XAXX010101000/estadisticas

# 5. Ver facturas vigentes
curl http://localhost:3000/api/facturas/XAXX010101000/vigentes

# 6. Ver solo nóminas
curl http://localhost:3000/api/facturas/XAXX010101000/nomina
```

---

## ⚠️ Requisitos para Probar

### Para descargar facturas del SAT necesitas:

1. **Certificado e.firma (.cer)**
2. **Llave privada (.key)**
3. **Contraseña de la llave**

Estos archivos se obtienen en el SAT.

### Para otras pruebas:

Si no tienes e.firma, puedes:

1. ✅ Ver la estructura de la BD (después de tener facturas)
2. ✅ Consultar facturas guardadas
3. ✅ Ver estadísticas
4. ✅ Probar endpoints de consulta
5. ✅ Subir constancia fiscal (solo PDF)

---

## 📊 Verificar que TODO Funciona

### Checklist:

- [ ] Servidor inicia correctamente (`npm start`)
- [ ] Health check responde (`curl http://localhost:3000/api/health`)
- [ ] Autenticación funciona (con e.firma válida)
- [ ] Descarga de facturas funciona
- [ ] Clasificación automática funciona
- [ ] **Respaldo automático guarda en data/facturas/**
- [ ] **Respaldo automático guarda XMLs en data/xmls/**
- [ ] Consulta de empresas funciona
- [ ] Consulta de facturas funciona
- [ ] Estadísticas se calculan correctamente
- [ ] Filtros funcionan (vigentes, nómina, etc.)
- [ ] Constancia fiscal se procesa correctamente

---

## 🐛 Solución de Problemas

### Error: "El servidor no está corriendo"

```bash
# Asegúrate de iniciar el servidor primero
npm start
```

### Error: "Certificado no vigente"

Tu certificado e.firma expiró. Renuévalo en el SAT.

### Error: "Contraseña incorrecta"

Verifica la contraseña de tu llave privada.

### Error: "No hay facturas guardadas"

Primero debes descargar facturas (opción 2).

### Los archivos no se guardan

Verifica que las carpetas existan:
```bash
mkdir -p data/facturas data/xmls data/indices
```

---

## 📝 Logs del Servidor

Para ver qué está haciendo el servidor:

```bash
# En la terminal donde corre npm start
# Verás logs como:

🔐 Autenticando con e.firma...
✓ Autenticado exitosamente: XAXX010101000

📥 Solicitando descarga de CFDIs emitidas...
✓ Solicitud creada: 12345-67890-abcde

⏳ Esperando procesamiento del SAT...
✓ Solicitud procesada correctamente

📦 Descargando 1 paquete(s)...
✓ Paquete descargado: 150 archivos XML

📊 Analizando 150 archivos XML...
✓ Análisis completo: 150/150 procesados

💾 Guardando respaldo en base de datos...
✓ Respaldo completado:
  Total: 150
  Nuevas: 145
  Actualizadas: 5
```

---

## 🎉 ¡Listo para Probar!

Elige tu método preferido:
- **Método 1:** Script interactivo (`node test-completo.js`)
- **Método 2:** cURL directo
- **Método 3:** Postman

**¡El respaldo automático está activado por defecto!**

Cada vez que descargues facturas, se guardarán automáticamente en `data/facturas/` y `data/xmls/`.
