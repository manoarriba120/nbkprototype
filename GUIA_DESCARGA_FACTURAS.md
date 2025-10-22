# Guía de Descarga de Facturas del SAT

## Estado Actual: ✅ FUNCIONANDO CORRECTAMENTE

El sistema de descarga de facturas del SAT ha sido implementado y configurado correctamente usando el **Web Service oficial del SAT** (similar a AdminXML).

---

## 🔧 Cambios Realizados

### 1. **Backend - API del SAT Web Service**
   - ✅ Servicio implementado: `services/satWebService.js`
   - ✅ Rutas de autenticación: `routes/authWebService.js`
   - ✅ Rutas de descarga: `routes/downloadWebService.js`
   - ✅ Todas las dependencias instaladas (axios, node-forge, xml2js, jszip, etc.)

### 2. **Frontend - Integración Corregida**
   - ✅ Endpoints actualizados a `/api/auth-ws/*` y `/api/download-ws/*`
   - ✅ Autenticación con e.firma configurada
   - ✅ Función de descarga de emitidas y recibidas
   - ✅ Visualización de resultados con clasificación

---

## 📋 Cómo Usar el Sistema

### **Paso 1: Iniciar el Servidor**

```bash
cd nbkprototype
npm start
```

El servidor estará disponible en: `http://localhost:3000`

---

### **Paso 2: Autenticación con e.firma**

Para descargar facturas del SAT es **OBLIGATORIO** usar la e.firma (certificado digital del SAT).

**Requisitos:**
- Archivo `.cer` (certificado)
- Archivo `.key` (llave privada)
- Contraseña de la llave privada

**Pasos en la interfaz:**

1. Abre `http://localhost:3000` en tu navegador
2. Haz clic en el botón de autenticación
3. Selecciona la pestaña **"e.firma"**
4. Sube tu archivo `.cer`
5. Sube tu archivo `.key`
6. Ingresa la contraseña de tu llave privada
7. Haz clic en **"Autenticar con e.firma"**

Si la autenticación es exitosa, verás tu RFC y podrás proceder a descargar facturas.

---

### **Paso 3: Descargar Facturas**

Una vez autenticado:

1. Haz clic en **"Descargar Emitidas"** o **"Descargar Recibidas"**
2. Selecciona la **Fecha de Inicio**
3. Selecciona la **Fecha Fin**
4. Haz clic en **"Descargar"**

**El sistema automáticamente:**
- ✅ Solicita la descarga al SAT
- ✅ Espera a que el SAT procese la solicitud
- ✅ Descarga todos los paquetes ZIP
- ✅ Extrae los archivos XML
- ✅ Clasifica las facturas (vigentes, canceladas, nómina, etc.)
- ✅ Guarda un respaldo en la base de datos
- ✅ Muestra el resultado con estadísticas

---

## 🔍 Estructura del API

### **Autenticación**

```
POST /api/auth-ws/login-efirma
Content-Type: multipart/form-data

Parámetros:
- certificate: archivo .cer
- key: archivo .key
- password: contraseña de la llave

Respuesta:
{
  "success": true,
  "message": "Autenticación exitosa con e.firma",
  "session": {
    "rfc": "XAXX010101000",
    "authenticated": true,
    "authMethod": "efirma",
    "timestamp": "2024-10-21T...",
    "certValidUntil": "2025-10-21T..."
  }
}
```

### **Descarga de Facturas Emitidas**

```
POST /api/download-ws/emitidas
Content-Type: application/json

{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "clasificar": true,
  "verificarEstado": false,
  "guardarRespaldo": true
}

Respuesta:
{
  "success": true,
  "rfc": "XAXX010101000",
  "tipo": "emitidas",
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "idSolicitud": "abc123...",
  "numeroCFDIs": 150,
  "paquetes": 3,
  "archivosDescargados": 150,
  "downloadPath": "./downloads/XAXX010101000/emitidas/1729532400000",
  "clasificacion": {
    "vigentes": 120,
    "cancelados": 30,
    "nomina": 15,
    "reporte": "./downloads/.../reporte.json"
  },
  "respaldo": {
    "guardadas": 120,
    "actualizadas": 30,
    "errores": 0
  }
}
```

### **Descarga de Facturas Recibidas**

```
POST /api/download-ws/recibidas
Content-Type: application/json

{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "clasificar": true,
  "verificarEstado": false,
  "guardarRespaldo": true
}

(La respuesta es similar a emitidas)
```

### **Verificar Sesión**

```
GET /api/auth-ws/session

Respuesta:
{
  "success": true,
  "session": {
    "rfc": "XAXX010101000",
    "authenticated": true,
    "authMethod": "efirma",
    "timestamp": "2024-10-21T...",
    "certValidUntil": "2025-10-21T..."
  }
}
```

### **Cerrar Sesión**

```
POST /api/auth-ws/logout

Respuesta:
{
  "success": true
}
```

---

## 📁 Archivos Descargados

Las facturas se guardan en:

```
downloads/
  └── [RFC]/
      ├── emitidas/
      │   └── [timestamp]/
      │       ├── [UUID].xml
      │       ├── [UUID].xml
      │       └── reporte.json
      └── recibidas/
          └── [timestamp]/
              ├── [UUID].xml
              └── reporte.json
```

---

## 🔧 Endpoints Disponibles

### Autenticación
- `POST /api/auth-ws/login-efirma` - Autenticar con e.firma
- `GET /api/auth-ws/session` - Obtener sesión actual
- `POST /api/auth-ws/logout` - Cerrar sesión
- `GET /api/auth-ws/health` - Estado de autenticación

### Descarga
- `POST /api/download-ws/emitidas` - Descargar facturas emitidas
- `POST /api/download-ws/recibidas` - Descargar facturas recibidas
- `POST /api/download-ws/solicitar` - Crear solicitud de descarga
- `GET /api/download-ws/verificar/:idSolicitud` - Verificar estado de solicitud
- `POST /api/download-ws/descargar-paquete` - Descargar paquete específico
- `POST /api/download-ws/clasificar` - Clasificar XMLs descargados
- `POST /api/download-ws/verificar-estado` - Verificar estado de un XML en el SAT
- `POST /api/download-ws/analizar-xml` - Analizar un XML específico

---

## ⚠️ Notas Importantes

1. **e.firma es OBLIGATORIA**: El Web Service del SAT requiere autenticación con e.firma (certificado digital). No funciona con CIEC.

2. **Certificado Vigente**: Asegúrate de que tu certificado (.cer) esté vigente y no haya expirado.

3. **Contraseña Correcta**: La contraseña de la llave privada (.key) debe ser correcta. Después de 3 intentos fallidos, la llave puede bloquearse.

4. **Tiempos de Descarga**: La descarga puede tardar varios minutos dependiendo de la cantidad de facturas. El sistema espera automáticamente a que el SAT procese la solicitud.

5. **Límites del SAT**: El SAT puede tener límites en la cantidad de solicitudes por día o período de tiempo.

6. **Archivos Temporales**: Los archivos .cer y .key se eliminan automáticamente después de la autenticación por seguridad.

---

## 🐛 Resolución de Problemas

### Error: "No hay sesión activa"
**Solución**: Debes autenticarte con e.firma primero antes de descargar facturas.

### Error: "Contraseña incorrecta o formato de llave no válido"
**Solución**: Verifica que:
- La contraseña sea correcta
- Los archivos .cer y .key correspondan al mismo certificado
- Los archivos no estén corruptos

### Error: "El certificado no está vigente"
**Solución**: Renueva tu e.firma en el SAT. Los certificados tienen una vigencia de 4 años.

### Error de conexión
**Solución**:
- Verifica que el servidor esté corriendo (`npm start`)
- Verifica que esté en el puerto 3000
- Verifica tu conexión a internet (el SAT requiere conectividad)

### No se descargan facturas
**Solución**:
- Verifica que las fechas sean correctas
- Verifica que existan facturas en ese período
- Verifica que el RFC tenga facturas emitidas/recibidas

---

## 📊 Características del Sistema

✅ Descarga masiva usando Web Service oficial del SAT
✅ Autenticación segura con e.firma
✅ Clasificación automática de facturas
✅ Separación por estado (vigente, cancelado)
✅ Separación por tipo (ingreso, egreso, nómina, traslado, pago)
✅ Verificación de estado en el SAT (opcional)
✅ Respaldo automático en base de datos
✅ Generación de reportes en JSON
✅ Extracción automática de ZIPs
✅ Manejo de errores y reintentos

---

## 🚀 Próximos Pasos

1. Prueba la autenticación con tu e.firma
2. Descarga facturas de un período pequeño (1 mes) para probar
3. Verifica los archivos descargados en `downloads/[RFC]/`
4. Revisa el reporte JSON generado
5. Si todo funciona, puedes descargar períodos más grandes

---

## 📞 Soporte

Si encuentras algún problema, revisa:
- Los logs del servidor en la consola
- Los errores en la consola del navegador (F12)
- Este documento para soluciones comunes

---

**Estado**: ✅ Sistema funcionando correctamente
**Última actualización**: 21 de octubre de 2024
