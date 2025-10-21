# NBK - Sistema de Descarga Masiva SAT

Sistema completo para descarga masiva de CFDIs (Facturas) del portal del SAT en México.

## 🚀 Características

- ✅ Autenticación con **CIEC** (RFC y contraseña)
- ✅ Autenticación con **e.firma** (certificados digitales)
- ✅ Descarga de **Facturas Emitidas** (Ingresos/Nómina)
- ✅ Descarga de **Facturas Recibidas** (Deducciones)
- ✅ Compresión automática en ZIP
- ✅ Historial de descargas
- ✅ Gestión de múltiples empresas
- ✅ Interfaz web minimalista

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

### 2. Autenticación

#### Opción A: CIEC (RFC y Contraseña)

**API:**
```bash
POST /api/auth/login-ciec
Content-Type: application/json

{
  "rfc": "XAXX010101000",
  "password": "tu_contraseña_ciec"
}
```

**Interfaz Web:**
1. Ve a la sección "Centro de Descargas"
2. Haz clic en "Configurar Credenciales"
3. Selecciona "CIEC"
4. Ingresa tu RFC y contraseña
5. Haz clic en "Autenticar"

#### Opción B: e.firma (Certificados Digitales)

**API:**
```bash
POST /api/auth/login-efirma
Content-Type: multipart/form-data

certificate: [archivo .cer]
key: [archivo .key]
password: contraseña_de_la_llave_privada
```

**Interfaz Web:**
1. Ve a la sección "Centro de Descargas"
2. Haz clic en "Configurar Credenciales"
3. Selecciona "e.firma"
4. Sube tu archivo .cer (certificado)
5. Sube tu archivo .key (llave privada)
6. Ingresa la contraseña de la llave privada
7. Haz clic en "Autenticar"

### 3. Descargar Facturas

Una vez autenticado, puedes descargar facturas:

#### Facturas Emitidas (Ingresos)

**API:**
```bash
POST /api/download/emitidas
Content-Type: application/json

{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "formato": "zip"
}
```

**Interfaz Web:**
1. Haz clic en "DESCARGAR FACTURAS EMITIDAS"
2. Selecciona el rango de fechas
3. Haz clic en "Descargar"
4. Se descargará un archivo ZIP con todos los XMLs

#### Facturas Recibidas (Deducciones)

**API:**
```bash
POST /api/download/recibidas
Content-Type: application/json

{
  "fechaInicio": "2024-01-01",
  "fechaFin": "2024-01-31",
  "formato": "zip"
}
```

**Interfaz Web:**
1. Haz clic en "DESCARGAR FACTURAS RECIBIDAS"
2. Selecciona el rango de fechas
3. Haz clic en "Descargar"
4. Se descargará un archivo ZIP con todos los XMLs

## 📁 Estructura de Archivos

Los archivos descargados se organizan automáticamente:

```
downloads/
├── [RFC]/
│   ├── emitidas/
│   │   ├── [timestamp]/
│   │   │   ├── UUID1.xml
│   │   │   ├── UUID2.xml
│   │   │   └── emitidas_[RFC]_[timestamp].zip
│   └── recibidas/
│       └── [timestamp]/
│           ├── UUID1.xml
│           ├── UUID2.xml
│           └── recibidas_[RFC]_[timestamp].zip
```

## 🔌 API Endpoints

### Autenticación

- `POST /api/auth/login-ciec` - Login con CIEC
- `POST /api/auth/login-efirma` - Login con e.firma
- `GET /api/auth/session` - Obtener sesión actual
- `POST /api/auth/logout` - Cerrar sesión

### Descargas

- `POST /api/download/emitidas` - Descargar facturas emitidas
- `POST /api/download/recibidas` - Descargar facturas recibidas
- `GET /api/download/file?path=[path]` - Descargar archivo específico
- `GET /api/download/history` - Obtener historial de descargas

### Empresas

- `GET /api/companies` - Listar empresas
- `POST /api/companies` - Agregar empresa
- `PUT /api/companies/:rfc` - Actualizar empresa
- `DELETE /api/companies/:rfc` - Eliminar empresa

### Sistema

- `GET /api/health` - Estado del servidor

## ⚠️ Notas Importantes

1. **Sesión del SAT**: Las sesiones del SAT tienen un tiempo de expiración. Si recibes errores de autenticación, vuelve a iniciar sesión.

2. **Límites del SAT**: El portal del SAT puede tener límites en la cantidad de facturas que puedes descargar por solicitud. Si tienes muchas facturas, el sistema las descargará en lotes.

3. **Seguridad**:
   - Nunca compartas tus credenciales CIEC
   - Mantén seguros tus archivos de e.firma (.cer y .key)
   - Los archivos temporales de e.firma se eliminan automáticamente después de la autenticación

4. **Formato de Fechas**: Usa el formato `YYYY-MM-DD` para las fechas (ejemplo: `2024-01-15`)

## 🐛 Solución de Problemas

### Error: "No hay sesión activa"
- Solución: Vuelve a autenticarte usando CIEC o e.firma

### Error: "Credenciales inválidas"
- Verifica que tu RFC y contraseña sean correctos
- Si usas e.firma, verifica que la contraseña de la llave privada sea correcta

### Error: "No se encontraron facturas"
- Verifica el rango de fechas
- Asegúrate de que existan facturas en ese período

### El servidor no inicia
- Verifica que el puerto 3000 esté disponible
- Ejecuta `npm install` para asegurarte de que todas las dependencias estén instaladas

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
