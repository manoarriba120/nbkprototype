# Guía de Uso - Web Service del SAT (Descarga Masiva)

## 📋 Descripción

Este sistema implementa la descarga masiva de CFDIs usando el **Web Service oficial del SAT**, similar a como funciona **AdminXML**.

**Ventajas sobre scraping web:**
- ✅ **No requiere CAPTCHA** - El Web Service no tiene CAPTCHA
- ✅ **Más confiable** - API oficial del SAT, menos propenso a cambios
- ✅ **Descarga masiva real** - Puede descargar miles de facturas
- ✅ **Formato comprimido** - Los XMLs vienen en paquetes ZIP
- ✅ **Autenticación robusta** - Usa e.firma (certificado digital)

**Limitaciones:**
- ⚠️ **Solo funciona con e.firma** - No acepta CIEC (RFC/contraseña)
- ⚠️ **Requiere certificado vigente** - El .cer y .key deben estar activos
- ⚠️ **Proceso asíncrono** - La descarga se solicita y luego se verifica

---

## 🚀 Uso Rápido

### 1. Autenticación con e.firma

```bash
curl -X POST http://localhost:3000/api/auth-ws/login-efirma \
  -F "certificate=@/ruta/a/certificado.cer" \
  -F "key=@/ruta/a/llave_privada.key" \
  -F "password=tu_contraseña_de_llave"
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Autenticación exitosa con e.firma",
  "session": {
    "rfc": "XAXX010101000",
    "authenticated": true,
    "authMethod": "efirma",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "certValidUntil": "2026-01-15T10:30:00.000Z"
  }
}
```

### 2. Descargar Facturas Emitidas

```bash
curl -X POST http://localhost:3000/api/download-ws/emitidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "rfc": "XAXX010101000",
  "tipo": "emitidas",
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "idSolicitud": "12345-67890-abcde",
  "numeroCFDIs": 150,
  "paquetes": 1,
  "archivosDescargados": 150,
  "archivos": [
    {
      "filename": "UUID-1234.xml",
      "size": 4856
    }
  ],
  "downloadPath": "./downloads/XAXX010101000/emitidas/1705320600000"
}
```

### 3. Descargar Facturas Recibidas

```bash
curl -X POST http://localhost:3000/api/download-ws/recibidas \
  -H "Content-Type: application/json" \
  -d '{
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31"
  }'
```

---

## 🔧 API Endpoints Disponibles

### Autenticación

#### `POST /api/auth-ws/login-efirma`
Autenticar con certificado e.firma (.cer y .key)

**Parámetros (multipart/form-data):**
- `certificate` (file) - Archivo .cer
- `key` (file) - Archivo .key
- `password` (string) - Contraseña de la llave privada

#### `GET /api/auth-ws/session`
Obtener información de la sesión actual

#### `POST /api/auth-ws/logout`
Cerrar sesión

#### `GET /api/auth-ws/health`
Verificar estado de autenticación

---

### Descarga Masiva (Simple)

#### `POST /api/download-ws/emitidas`
Descarga completa de facturas emitidas (todo el proceso automático)

**Parámetros (JSON):**
```json
{
  "fechaInicio": "2024-01-01",  // Formato: YYYY-MM-DD
  "fechaFin": "2024-01-31"       // Formato: YYYY-MM-DD
}
```

#### `POST /api/download-ws/recibidas`
Descarga completa de facturas recibidas (todo el proceso automático)

**Parámetros (JSON):**
```json
{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31"
}
```

---

### Descarga Masiva (Manual - 3 pasos)

Si necesitas más control sobre el proceso:

#### `POST /api/download-ws/solicitar`
**Paso 1:** Crear solicitud de descarga

**Parámetros (JSON):**
```json
{
  "tipo": "emitidas",           // "emitidas" o "recibidas"
  "fechaInicio": "2024-01-01T00:00:00",
  "fechaFin": "2024-01-31T23:59:59",
  "rfcReceptor": "XEXX010101000",  // Opcional
  "rfcEmisor": "XAXX010101000"     // Opcional
}
```

**Respuesta:**
```json
{
  "success": true,
  "idSolicitud": "12345-67890-abcde",
  "mensaje": "Solicitud Aceptada",
  "tipo": "emitidas",
  "fechaInicio": "2024-01-01T00:00:00",
  "fechaFin": "2024-01-31T23:59:59"
}
```

#### `GET /api/download-ws/verificar/:idSolicitud`
**Paso 2:** Verificar estado de la solicitud

**Respuesta:**
```json
{
  "success": true,
  "estadoSolicitud": "Terminada",
  "codigoEstadoSolicitud": "3",
  "numeroCFDIs": 150,
  "paquetes": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  ],
  "mensaje": "Solicitud procesada"
}
```

**Códigos de estado:**
- `1` - Solicitud aceptada
- `2` - En proceso
- `3` - Terminada (lista para descargar)
- `4` - Error
- `5` - Rechazada

#### `POST /api/download-ws/descargar-paquete`
**Paso 3:** Descargar paquete ZIP con XMLs

**Parámetros (JSON):**
```json
{
  "idPaquete": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "outputPath": "./downloads/mi_descarga"  // Opcional
}
```

**Respuesta:**
```json
{
  "success": true,
  "idPaquete": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "zipPath": "./downloads/XAXX010101000/paquetes/1705320600000/a1b2c3d4.zip",
  "archivos": [
    {
      "filename": "UUID-1234.xml",
      "filepath": "./downloads/.../UUID-1234.xml",
      "size": 4856
    }
  ],
  "total": 150
}
```

---

## 🔐 Requisitos de e.firma

### Archivos necesarios:

1. **Certificado (.cer)** - Archivo de certificado digital del SAT
2. **Llave privada (.key)** - Archivo de llave privada encriptada
3. **Contraseña** - Contraseña que protege la llave privada

### ¿Dónde obtener la e.firma?

La e.firma se obtiene en el SAT:
1. Acudir a cualquier módulo del SAT con identificación oficial
2. Solicitar el certificado de e.firma
3. Recibirás un archivo .cer y .key protegido con contraseña

### Validez del certificado:

- Los certificados tienen vigencia de **4 años**
- El sistema valida automáticamente la vigencia
- Si el certificado expiró, debes renovarlo en el SAT

---

## 📊 Flujo del Proceso

```
┌─────────────────────────────────────────────────────────────┐
│  PROCESO DE DESCARGA MASIVA DEL SAT                         │
└─────────────────────────────────────────────────────────────┘

1. AUTENTICACIÓN
   └─> POST /api/auth-ws/login-efirma
       └─> Cargar certificado .cer y .key
       └─> Validar vigencia
       └─> Crear sesión

2. SOLICITUD DE DESCARGA
   └─> POST /api/download-ws/solicitar
       └─> Enviar rango de fechas
       └─> SAT procesa solicitud
       └─> Recibir ID de solicitud

3. VERIFICACIÓN (Polling cada 10 segundos)
   └─> GET /api/download-ws/verificar/:idSolicitud
       └─> ¿Estado = "Terminada"?
           ├─> NO  → Esperar y verificar de nuevo
           └─> SÍ  → Continuar

4. DESCARGA DE PAQUETES
   └─> POST /api/download-ws/descargar-paquete
       └─> Descargar cada paquete ZIP
       └─> Extraer XMLs
       └─> Guardar en disco

5. COMPLETADO
   └─> XMLs listos en ./downloads/[RFC]/[tipo]/[timestamp]/
```

---

## 🎯 Ejemplos Completos

### Ejemplo en JavaScript (Node.js)

```javascript
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const API_BASE = 'http://localhost:3000/api';

async function descargarFacturas() {
  // 1. Autenticarse
  const formData = new FormData();
  formData.append('certificate', fs.createReadStream('./certificado.cer'));
  formData.append('key', fs.createReadStream('./llave.key'));
  formData.append('password', 'mi_contraseña');

  const auth = await axios.post(`${API_BASE}/auth-ws/login-efirma`, formData, {
    headers: formData.getHeaders()
  });

  console.log('Autenticado:', auth.data.session.rfc);

  // 2. Descargar facturas emitidas
  const descarga = await axios.post(`${API_BASE}/download-ws/emitidas`, {
    fechaInicio: '2024-01-01',
    fechaFin: '2024-01-31'
  });

  console.log(`Descargadas ${descarga.data.archivosDescargados} facturas`);
  console.log(`Ubicación: ${descarga.data.downloadPath}`);
}

descargarFacturas();
```

### Ejemplo en Python

```python
import requests

API_BASE = 'http://localhost:3000/api'

# 1. Autenticarse
files = {
    'certificate': open('certificado.cer', 'rb'),
    'key': open('llave.key', 'rb')
}
data = {'password': 'mi_contraseña'}

auth = requests.post(f'{API_BASE}/auth-ws/login-efirma', files=files, data=data)
print(f"Autenticado: {auth.json()['session']['rfc']}")

# 2. Descargar facturas recibidas
descarga = requests.post(f'{API_BASE}/download-ws/recibidas', json={
    'fechaInicio': '2024-01-01',
    'fechaFin': '2024-01-31'
})

result = descarga.json()
print(f"Descargadas {result['archivosDescargados']} facturas")
print(f"Ubicación: {result['downloadPath']}")
```

---

## ⚠️ Solución de Problemas

### Error: "Contraseña de llave privada incorrecta"
- Verifica que la contraseña sea correcta
- La contraseña es sensible a mayúsculas/minúsculas

### Error: "El certificado no está vigente"
- Verifica las fechas de vigencia del certificado
- Renueva tu e.firma en el SAT si expiró

### Error: "No se pudo extraer el RFC del certificado"
- Asegúrate de usar un certificado válido del SAT
- El certificado debe ser de e.firma, no de sello digital

### Error: "Timeout esperando respuesta del SAT"
- El SAT puede tardar varios minutos en procesar solicitudes grandes
- Incrementa el tiempo de espera o usa el método manual (3 pasos)

### Error: "Solicitud rechazada"
- Verifica el rango de fechas (no puede ser mayor a 1 mes en algunos casos)
- Asegúrate de que existan facturas en el período solicitado

---

## 📝 Notas Importantes

1. **Límites de descarga:**
   - El SAT tiene límites de consulta (generalmente 1 mes por solicitud)
   - Para períodos mayores, haz múltiples solicitudes

2. **Tiempo de procesamiento:**
   - Solicitudes pequeñas: 30 segundos - 2 minutos
   - Solicitudes grandes: 5 - 10 minutos

3. **Formato de fechas:**
   - Simple: `YYYY-MM-DD` (2024-01-31)
   - Completo: `YYYY-MM-DDTHH:mm:ss` (2024-01-31T23:59:59)

4. **Archivos descargados:**
   - Se guardan en: `./downloads/[RFC]/[emitidas|recibidas]/[timestamp]/`
   - Los ZIPs se conservan en el directorio
   - Los XMLs se extraen automáticamente

---

## 🆚 Comparación: Web Service vs Portal Web

| Característica | Web Service (WS) | Portal Web (Scraping) |
|----------------|------------------|----------------------|
| **CAPTCHA** | ❌ No requiere | ✅ Requiere resolución |
| **Autenticación** | e.firma solamente | CIEC o e.firma |
| **Confiabilidad** | ⭐⭐⭐⭐⭐ Alta | ⭐⭐⭐ Media |
| **Velocidad** | ⚡ Rápido (masivo) | 🐌 Lento (individual) |
| **Mantenimiento** | ✅ API estable | ⚠️ Cambios frecuentes |
| **Volumen** | Miles de facturas | Cientos de facturas |

**Recomendación:** Usa el Web Service (`/api/download-ws/*`) siempre que sea posible.

---

## 📞 Soporte

Para más información sobre el Web Service del SAT:
- [Documentación oficial del SAT](https://www.sat.gob.mx/)
- [Guía de descarga masiva](https://www.sat.gob.mx/aplicacion/operacion/31274/consulta-y-recuperacion-de-comprobantes)
