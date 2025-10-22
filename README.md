# NBK - Sistema de Descarga Masiva SAT

Sistema completo para descarga masiva de CFDIs (Facturas) del portal del SAT en México usando el **Web Service Oficial del SAT**.

## 🚀 Características

- ✅ Autenticación con **e.firma** (certificados digitales) - **OBLIGATORIO PARA WEB SERVICE**
- ✅ Descarga masiva usando **Web Service oficial del SAT** (como AdminXML)
- ✅ Descarga de **Facturas Emitidas** (Ingresos/Nómina)
- ✅ Descarga de **Facturas Recibidas** (Deducciones)
- ✅ **Clasificación automática** de facturas (vigentes, canceladas, nómina, etc.)
- ✅ **Verificación de estado** en el SAT (opcional)
- ✅ **Respaldo automático** en base de datos
- ✅ Extracción automática de ZIPs
- ✅ Generación de reportes en JSON
- ✅ Gestión de múltiples empresas
- ✅ Interfaz web moderna y minimalista

## 📋 Requisitos

- Node.js 18 o superior
- npm o yarn

## 🔧 Instalación

1. **Instalar dependencias:**

```bash
npm install
```

2. **Configurar variables de entorno:**

El archivo `.env` ya está configurado con valores por defecto. Puedes modificarlo si es necesario.

## 🎯 Uso

### 1. Iniciar el servidor

```bash
npm start
```

O en modo desarrollo con auto-reload:

```bash
npm run dev
```

El servidor se iniciará en: **http://localhost:3000**

### 2. Autenticación con e.firma (OBLIGATORIO)

⚠️ **IMPORTANTE**: El Web Service del SAT **REQUIERE** autenticación con e.firma. No funciona con CIEC.

**Requisitos:**
- Archivo `.cer` (certificado)
- Archivo `.key` (llave privada)
- Contraseña de la llave privada
- Certificado vigente (no vencido)

**API:**
```bash
POST /api/auth-ws/login-efirma
Content-Type: multipart/form-data

certificate: [archivo .cer]
key: [archivo .key]
password: contraseña_de_la_llave_privada
```

**Respuesta:**
```json
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

**Interfaz Web:**
1. Abre `http://localhost:3000`
2. Haz clic en el botón de autenticación
3. Selecciona la pestaña **"e.firma"**
4. Sube tu archivo `.cer` (certificado)
5. Sube tu archivo `.key` (llave privada)
6. Ingresa la contraseña de la llave privada
7. Haz clic en **"Autenticar con e.firma"**

Si la autenticación es exitosa, verás tu RFC y podrás descargar facturas.

### 3. Descargar Facturas

Una vez autenticado con e.firma, puedes descargar facturas automáticamente.

#### Facturas Emitidas (Ingresos)

**API:**
```bash
POST /api/download-ws/emitidas
Content-Type: application/json

{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "clasificar": true,
  "verificarEstado": false,
  "guardarRespaldo": true
}
```

**Respuesta:**
```json
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

**Interfaz Web:**
1. Haz clic en **"Descargar Emitidas"**
2. Selecciona la **Fecha de Inicio**
3. Selecciona la **Fecha Fin**
4. Haz clic en **"Descargar"**
5. El sistema automáticamente:
   - Solicita la descarga al SAT
   - Espera el procesamiento
   - Descarga todos los paquetes
   - Extrae los XMLs
   - Clasifica las facturas
   - Guarda el respaldo
   - Muestra el resultado

#### Facturas Recibidas (Deducciones)

**API:**
```bash
POST /api/download-ws/recibidas
Content-Type: application/json

{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "clasificar": true,
  "verificarEstado": false,
  "guardarRespaldo": true
}
```

**Interfaz Web:**
1. Haz clic en **"Descargar Recibidas"**
2. Selecciona el rango de fechas
3. Haz clic en **"Descargar"**
4. El sistema procesará automáticamente todo

## 📁 Estructura de Archivos

Los archivos descargados se organizan automáticamente:

```
downloads/
├── [RFC]/
│   ├── emitidas/
│   │   └── [timestamp]/
│   │       ├── [UUID].xml
│   │       ├── [UUID].xml
│   │       ├── [paquete_id].zip
│   │       └── reporte.json
│   └── recibidas/
│       └── [timestamp]/
│           ├── [UUID].xml
│           ├── [UUID].xml
│           ├── [paquete_id].zip
│           └── reporte.json
```

Los archivos XML contienen las facturas descargadas del SAT, y el archivo `reporte.json` contiene la clasificación automática con estadísticas.

## 🔌 API Endpoints

### Autenticación (Web Service del SAT)

- `POST /api/auth-ws/login-efirma` - Autenticar con e.firma
- `GET /api/auth-ws/session` - Obtener sesión actual
- `POST /api/auth-ws/logout` - Cerrar sesión
- `GET /api/auth-ws/health` - Estado de autenticación

### Descarga (Web Service del SAT)

- `POST /api/download-ws/emitidas` - Descargar facturas emitidas (proceso completo)
- `POST /api/download-ws/recibidas` - Descargar facturas recibidas (proceso completo)
- `POST /api/download-ws/solicitar` - Crear solicitud de descarga (paso 1)
- `GET /api/download-ws/verificar/:idSolicitud` - Verificar estado de solicitud (paso 2)
- `POST /api/download-ws/descargar-paquete` - Descargar paquete específico (paso 3)
- `POST /api/download-ws/clasificar` - Clasificar XMLs ya descargados
- `POST /api/download-ws/verificar-estado` - Verificar estado de un XML en el SAT
- `POST /api/download-ws/analizar-xml` - Analizar un XML específico

### Empresas

- `GET /api/companies` - Listar empresas
- `POST /api/companies` - Agregar empresa
- `PUT /api/companies/:rfc` - Actualizar empresa
- `DELETE /api/companies/:rfc` - Eliminar empresa
- `POST /api/companies/extract-constancia` - Extraer datos de constancia de situación fiscal

### Facturas (Consulta de respaldos)

- `GET /api/facturas/:rfc` - Obtener facturas guardadas de un RFC
- `GET /api/facturas/:rfc/stats` - Estadísticas de facturas

### Sistema

- `GET /api/health` - Estado del servidor

## ⚠️ Notas Importantes

1. **e.firma es OBLIGATORIA**: El Web Service del SAT **REQUIERE** autenticación con e.firma (certificado digital). No funciona con CIEC.

2. **Certificado Vigente**: Asegúrate de que tu certificado (.cer) esté vigente y no haya expirado. Los certificados del SAT tienen una vigencia de 4 años.

3. **Contraseña Correcta**: Después de 3 intentos fallidos con la contraseña de la llave privada (.key), la llave puede bloquearse.

4. **Tiempos de Descarga**: La descarga puede tardar varios minutos dependiendo de la cantidad de facturas. El sistema espera automáticamente a que el SAT procese la solicitud (hasta 5 minutos).

5. **Límites del SAT**: El SAT puede tener límites en la cantidad de solicitudes por día o período de tiempo.

6. **Seguridad**:
   - Mantén seguros tus archivos de e.firma (.cer y .key)
   - Los archivos temporales de e.firma se eliminan automáticamente después de la autenticación
   - Las credenciales NO se almacenan en el servidor

7. **Formato de Fechas**: Usa el formato `YYYY-MM-DD` para las fechas (ejemplo: `2024-01-15`)

8. **Clasificación Automática**: Las facturas se clasifican automáticamente en:
   - **Por estado**: Vigentes, Canceladas
   - **Por tipo**: Ingreso, Egreso, Nómina, Traslado, Pago

## 🐛 Solución de Problemas

### Error: "No hay sesión activa. Debe autenticarse con e.firma primero"
**Solución**: Debes autenticarte con e.firma antes de descargar facturas.

### Error: "Contraseña incorrecta o formato de llave no válido"
**Solución**:
- Verifica que la contraseña de la llave privada sea correcta
- Verifica que los archivos .cer y .key correspondan al mismo certificado
- Asegúrate de que los archivos no estén corruptos

### Error: "El certificado no está vigente"
**Solución**: Renueva tu e.firma en el SAT. Los certificados tienen una vigencia de 4 años.

### Error: "No se pudo extraer el RFC del certificado"
**Solución**: Verifica que el archivo .cer sea un certificado válido del SAT.

### Error: "Timeout esperando respuesta del SAT"
**Solución**:
- El SAT puede estar procesando muchas solicitudes
- Espera unos minutos e intenta de nuevo
- Reduce el rango de fechas

### Error de conexión
**Solución**:
- Verifica que el servidor esté corriendo (`npm start`)
- Verifica que esté en el puerto 3000
- Verifica tu conexión a internet (el SAT requiere conectividad)

### No se descargan facturas
**Solución**:
- Verifica que las fechas sean correctas (formato: YYYY-MM-DD)
- Verifica que existan facturas en ese período
- Verifica que el RFC tenga facturas emitidas/recibidas

### El servidor no inicia
**Solución**:
- Verifica que el puerto 3000 esté disponible
- Ejecuta `npm install` para instalar todas las dependencias
- Verifica que tengas Node.js 18 o superior

## 📝 Logs

Los logs del sistema se guardan automáticamente en el directorio `logs/`:

```
logs/
├── sat-[fecha].log
└── error-[fecha].log
```

## 🔐 Seguridad

- Las contraseñas y credenciales NO se almacenan en el servidor
- Las sesiones del SAT son manejadas de forma segura con cookies
- Los archivos de e.firma temporales se eliminan automáticamente
- Los XMLs descargados se almacenan localmente en tu servidor

## 📞 Soporte

Para reportar problemas o solicitar nuevas características, crea un issue en el repositorio.

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles

---

**Nota**: Este sistema está diseñado para uso personal o empresarial. Asegúrate de cumplir con las políticas y términos de uso del SAT.
