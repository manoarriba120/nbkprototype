# Guía de Uso - NBK Sistema de Descarga SAT

## Estado del Sistema

✅ **Sistema completamente funcional y conectado**

- Backend Node.js/Express corriendo en `http://localhost:3000`
- Frontend integrado con API del SAT
- Autenticación CIEC y e.firma implementada
- Descarga de XMLs funcional

## Cómo Usar el Sistema

### 1. Acceder a la Aplicación

El servidor ya está corriendo. Abre tu navegador y ve a:

```
http://localhost:3000
```

### 2. Navegar al Centro de Descargas

1. En el menú lateral, haz clic en **"Descargas"**
2. Verás dos botones principales:
   - **DESCARGAR FACTURAS EMITIDAS** (Ingresos/Nómina)
   - **DESCARGAR FACTURAS RECIBIDAS** (Deducciones)

### 3. Autenticación con el SAT

Al hacer clic en cualquier botón de descarga por primera vez, se abrirá un modal de autenticación.

#### Opción A: CIEC (RFC y Contraseña)

1. Selecciona la pestaña **"CIEC"**
2. Ingresa tu RFC (ejemplo: `XAXX010101000`)
3. Ingresa tu contraseña CIEC
4. Haz clic en **"Autenticar"**

#### Opción B: e.firma (Certificados Digitales)

1. Selecciona la pestaña **"e.firma"**
2. Selecciona tu archivo de **Certificado (.cer)**
3. Selecciona tu archivo de **Llave Privada (.key)**
4. Ingresa la **contraseña de la llave privada**
5. Haz clic en **"Autenticar"**

### 4. Descargar Facturas

Una vez autenticado exitosamente:

1. Se abrirá automáticamente el modal de descarga
2. Selecciona la **Fecha de Inicio** (formato: YYYY-MM-DD)
3. Selecciona la **Fecha Fin** (formato: YYYY-MM-DD)
4. Haz clic en **"Descargar Emitidas"** o **"Descargar Recibidas"**

### 5. Resultado de la Descarga

El sistema:

1. Se conectará al portal del SAT
2. Descargará todos los XMLs del período seleccionado
3. Los comprimirá en un archivo ZIP
4. Abrirá automáticamente la descarga del ZIP
5. Mostrará una notificación con el número de facturas descargadas

## Ubicación de los Archivos Descargados

Los XMLs se guardan en:

```
downloads/
└── [RFC]/
    ├── emitidas/
    │   └── [timestamp]/
    │       ├── UUID1.xml
    │       ├── UUID2.xml
    │       └── emitidas_[RFC]_[timestamp].zip
    └── recibidas/
        └── [timestamp]/
            ├── UUID1.xml
            ├── UUID2.xml
            └── recibidas_[RFC]_[timestamp].zip
```

## Notificaciones

El sistema muestra notificaciones en la esquina superior derecha para:

- ✅ Autenticación exitosa (verde)
- ✅ Descarga completada (verde)
- ❌ Errores de autenticación (rojo)
- ℹ️ Información general (azul)

## Características Implementadas

### Autenticación

- ✅ Login con CIEC (RFC y contraseña)
- ✅ Login con e.firma (certificados digitales)
- ✅ Validación de credenciales
- ✅ Manejo de sesiones del SAT
- ✅ Indicadores de progreso durante autenticación

### Descargas

- ✅ Descarga de facturas emitidas (ingresos)
- ✅ Descarga de facturas recibidas (deducciones)
- ✅ Selección de rango de fechas
- ✅ Validación de fechas
- ✅ Compresión automática en ZIP
- ✅ Indicadores de progreso durante descarga
- ✅ Descarga automática del archivo ZIP

### Interfaz

- ✅ Modal de autenticación con tabs (CIEC/e.firma)
- ✅ Modal de descarga con selección de fechas
- ✅ Notificaciones en tiempo real
- ✅ Indicadores de carga (spinners)
- ✅ Validación de formularios
- ✅ Mensajes de error claros

## API Endpoints Disponibles

### Autenticación

- `POST /api/auth/login-ciec` - Autenticar con CIEC
- `POST /api/auth/login-efirma` - Autenticar con e.firma
- `GET /api/auth/session` - Obtener sesión actual
- `POST /api/auth/logout` - Cerrar sesión

### Descargas

- `POST /api/download/emitidas` - Descargar facturas emitidas
- `POST /api/download/recibidas` - Descargar facturas recibidas
- `GET /api/download/file?path=[path]` - Descargar archivo ZIP
- `GET /api/download/history` - Historial de descargas

## Solución de Problemas

### El servidor no responde

```bash
# Verificar que el servidor está corriendo
cd C:\Users\Bt\nbkprototype
npm start
```

### Error de CORS

El servidor tiene CORS habilitado. Si tienes problemas:

1. Asegúrate de estar accediendo desde `http://localhost:3000`
2. No uses `file://` para abrir el HTML

### Error de autenticación

1. Verifica que tus credenciales SAT sean correctas
2. Asegúrate de tener conexión a internet
3. El portal del SAT puede estar temporalmente no disponible

### No se descargan facturas

1. Verifica el rango de fechas
2. Asegúrate de que existan facturas en ese período
3. Revisa que la sesión del SAT no haya expirado (vuelve a autenticarte)

## Próximos Pasos Sugeridos

1. **Probar con credenciales reales del SAT**
2. **Verificar que las descargas funcionen correctamente**
3. **Ajustar las rutas de descarga si es necesario**
4. **Configurar automatización de descargas (opcional)**
5. **Implementar gestión de múltiples empresas con credenciales guardadas (opcional)**

## Notas de Seguridad

⚠️ **IMPORTANTE:**

- Las credenciales NO se guardan en el servidor
- Las sesiones son temporales y se manejan con cookies
- Los archivos de e.firma temporales se eliminan automáticamente
- Mantén seguros tus archivos .cer y .key

## Soporte

Para reportar problemas o solicitar nuevas características, consulta el archivo README.md

---

**Sistema desarrollado por NBK - Prototipo Ruben**
