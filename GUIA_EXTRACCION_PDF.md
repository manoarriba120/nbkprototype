# Guía de Extracción de PDF - Constancia de Situación Fiscal

## Descripción

Sistema completo de extracción automática de datos de la **Constancia de Situación Fiscal (CSF)** del SAT. Extrae automáticamente:

- ✅ RFC
- ✅ Razón Social / Nombre
- ✅ Régimen Fiscal
- ✅ Domicilio Fiscal
- ✅ Código Postal
- ✅ Fecha de Emisión
- ✅ Actividad Económica

## Características

### ✨ Backend (Node.js)

- **Validación robusta de PDF**: Verifica cabecera, tamaño, versión
- **Múltiples estrategias de extracción**: Varios patrones regex para máxima compatibilidad
- **Manejo de errores mejorado**: Mensajes claros y específicos
- **Detección automática de CSF**: Verifica que sea un documento del SAT
- **Limpieza automática**: Elimina archivos temporales
- **Logging detallado**: Tiempos de procesamiento y campos extraídos

### 🎨 Frontend (React)

- **Drag & Drop**: Arrastra archivos directamente
- **Validación en cliente**: Verifica tipo y tamaño antes de subir
- **Feedback visual**: Estados de carga, éxito y error
- **Vista previa de datos**: Muestra los datos extraídos
- **Diseño responsive**: Funciona en todos los dispositivos

## Instalación

### 1. Verificar dependencias

Todas las dependencias ya están instaladas en tu proyecto:

```bash
# Verificar package.json
cat package.json
```

Las dependencias clave son:
- `pdf-parse` (v2.4.3) - Extracción de texto de PDFs
- `multer` (v1.4.5) - Manejo de uploads
- `fs-extra` (v11.2.0) - Operaciones de archivos

### 2. Estructura de archivos

```
nbkprototype/
├── services/
│   └── pdfExtractor.js          # Servicio de extracción de PDF (NUEVO)
├── routes/
│   └── companies.js             # Endpoint /extract-constancia (ACTUALIZADO)
├── NBKConstanciaUpload.jsx      # Componente React (NUEVO)
└── temp/                        # Directorio temporal (auto-creado)
```

## Uso

### Backend - Endpoint API

**Endpoint:** `POST /api/companies/extract-constancia`

**Request:**
```bash
curl -X POST http://localhost:3000/api/companies/extract-constancia \
  -F "constancia=@/ruta/al/archivo.pdf"
```

**Response (éxito):**
```json
{
  "success": true,
  "data": {
    "rfc": "ABC123456XYZ",
    "razonSocial": "EMPRESA EJEMPLO SA DE CV",
    "nombreCorto": "EMPRESA EJEMPLO SA DE CV",
    "regimen": "601 - General de Ley Personas Morales",
    "domicilioFiscal": "CALLE EJEMPLO 123, COL. CENTRO, MEXICO",
    "codigoPostal": "06000",
    "fechaEmision": "15/01/2025",
    "giro": "Comercio al por menor"
  },
  "metadata": {
    "fileName": "constancia.pdf",
    "fileSize": 245678,
    "processingTime": "342ms",
    "extractedFields": [
      "rfc",
      "razonSocial",
      "regimen",
      "domicilioFiscal",
      "codigoPostal",
      "fechaEmision"
    ],
    "isCSF": true
  },
  "message": "Datos extraídos correctamente de la Constancia de Situación Fiscal"
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "El PDF está protegido con contraseña. Por favor, proporcione un PDF sin protección"
}
```

### Frontend - Componente React

#### Importación básica

```jsx
import NBKConstanciaUpload from './NBKConstanciaUpload';

function App() {
  const handleDataExtracted = (data) => {
    console.log('Datos extraídos:', data);
    // Aquí puedes usar los datos para llenar un formulario, etc.
  };

  const handleError = (error) => {
    console.error('Error:', error);
  };

  return (
    <NBKConstanciaUpload
      onDataExtracted={handleDataExtracted}
      onError={handleError}
      apiUrl="http://localhost:3000"
    />
  );
}
```

#### Props del componente

| Prop | Tipo | Descripción | Default |
|------|------|-------------|---------|
| `onDataExtracted` | Function | Callback cuando se extraen datos exitosamente | - |
| `onError` | Function | Callback cuando ocurre un error | - |
| `apiUrl` | String | URL del backend | `http://localhost:3000` |
| `autoFillForm` | Boolean | Auto-llenar formulario con los datos | `true` |

#### Integración con formulario

```jsx
import { useState } from 'react';
import NBKConstanciaUpload from './NBKConstanciaUpload';

function CompanyForm() {
  const [formData, setFormData] = useState({
    rfc: '',
    razonSocial: '',
    regimen: '',
    domicilioFiscal: '',
    codigoPostal: ''
  });

  const handleDataExtracted = (data) => {
    // Auto-llenar formulario con datos extraídos
    setFormData({
      rfc: data.rfc || '',
      razonSocial: data.razonSocial || '',
      regimen: data.regimen || '',
      domicilioFiscal: data.domicilioFiscal || '',
      codigoPostal: data.codigoPostal || ''
    });
  };

  return (
    <div>
      <NBKConstanciaUpload
        onDataExtracted={handleDataExtracted}
        apiUrl="http://localhost:3000"
      />

      <form>
        <input
          type="text"
          value={formData.rfc}
          onChange={(e) => setFormData({...formData, rfc: e.target.value})}
          placeholder="RFC"
        />
        {/* Más campos... */}
      </form>
    </div>
  );
}
```

## Validaciones

### Validaciones del PDF

El sistema valida automáticamente:

1. **Tipo de archivo**: Solo PDFs (application/pdf)
2. **Tamaño mínimo**: 100 bytes
3. **Tamaño máximo**: 20 MB
4. **Cabecera PDF**: Debe comenzar con `%PDF-`
5. **Versión PDF**: Entre 1.0 y 2.0
6. **Texto extraíble**: No acepta PDFs escaneados sin OCR
7. **No protegido**: Rechaza PDFs con contraseña

### Validaciones de datos extraídos

- **RFC**: Formato válido (3-4 letras + 6 dígitos + 3 caracteres)
- **Campos mínimos**: Al menos RFC o Razón Social deben ser extraídos
- **Longitud**: Limita campos para evitar datos excesivos

## Errores Comunes

### 1. "PDF parse error: no se puede leer"

**Causa**: El PDF está corrupto, protegido o es una imagen escaneada.

**Solución**:
- Verifica que el PDF se abra correctamente
- Si está protegido, elimina la contraseña
- Si es un PDF escaneado, usa uno con texto extraíble

### 2. "El PDF está protegido con contraseña"

**Causa**: El PDF tiene protección de lectura.

**Solución**:
- Abre el PDF en Adobe Reader
- Imprime a PDF sin contraseña
- Usa el nuevo PDF

### 3. "No se pudieron extraer datos del PDF"

**Causa**: El PDF no es una Constancia de Situación Fiscal o tiene formato no estándar.

**Solución**:
- Verifica que sea un PDF de CSF del SAT
- Descarga una constancia actualizada del portal del SAT

### 4. "El archivo excede el tamaño máximo"

**Causa**: El archivo es mayor a 20MB.

**Solución**:
- Comprime el PDF usando herramientas online
- La CSF del SAT generalmente pesa menos de 1MB

## Testing

### Test manual con cURL

```bash
# 1. Iniciar servidor
cd C:\Users\Bt\nbkprototype
npm start

# 2. Probar endpoint (en otra terminal)
curl -X POST http://localhost:3000/api/companies/extract-constancia \
  -F "constancia=@path/to/constancia.pdf" \
  -H "Content-Type: multipart/form-data"
```

### Test con Postman

1. Abrir Postman
2. Crear nuevo request POST: `http://localhost:3000/api/companies/extract-constancia`
3. En Body, seleccionar "form-data"
4. Agregar key: `constancia` (tipo: File)
5. Seleccionar tu PDF de constancia
6. Click en "Send"

### Test con React

```bash
# 1. Iniciar servidor backend
npm start

# 2. En tu app React, importa el componente
import NBKConstanciaUpload from './NBKConstanciaUpload';

# 3. Usa el componente en tu aplicación
<NBKConstanciaUpload
  onDataExtracted={(data) => console.log(data)}
  apiUrl="http://localhost:3000"
/>
```

## Personalización

### Agregar nuevos campos de extracción

Edita `services/pdfExtractor.js`:

```javascript
// Ejemplo: Extraer fecha de inicio de operaciones
function extractFechaInicio(text) {
    const patterns = [
        /Fecha\s+de\s+Inicio\s+de\s+Operaciones[\s:]+(\d{2}\/\d{2}\/\d{4})/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return '';
}

// Agregar a la función extractConstanciaData
const extractedData = {
    // ... campos existentes ...
    fechaInicio: extractFechaInicio(rawText)  // NUEVO
};
```

### Modificar patrones de extracción

Los patrones regex están en funciones individuales en `pdfExtractor.js`:

- `extractRFC()` - Extracción de RFC
- `extractRazonSocial()` - Extracción de nombre/razón social
- `extractRegimen()` - Extracción de régimen fiscal
- `extractDomicilio()` - Extracción de domicilio
- etc.

Cada función tiene múltiples patrones para máxima compatibilidad.

## Troubleshooting

### El servidor no inicia

```bash
# Verificar que las dependencias están instaladas
npm install

# Verificar que el puerto 3000 no esté en uso
netstat -ano | findstr :3000

# Iniciar en modo desarrollo para ver errores
npm run dev
```

### CORS errors en el frontend

Agrega en `server.js`:

```javascript
import cors from 'cors';

app.use(cors({
    origin: 'http://localhost:5173', // Tu URL de frontend
    credentials: true
}));
```

### Archivos temporales no se eliminan

Los archivos en `temp/` se eliminan automáticamente después de procesar. Si quedan archivos:

```bash
# Limpiar manualmente
rm -rf temp/*

# O en Windows
del /Q temp\*
```

## Logs y Debugging

El sistema incluye logging detallado en consola:

```
[PDF Extractor] Procesando archivo: constancia.pdf (245.67 KB)
[PDF Extractor] Extracción exitosa en 342ms
[PDF Extractor] Campos extraídos: rfc, razonSocial, regimen, domicilioFiscal, codigoPostal
```

Para ver más detalles, revisa:
- `routes/companies.js:203` - Log de inicio de procesamiento
- `routes/companies.js:242-243` - Log de extracción exitosa
- `services/pdfExtractor.js:268` - Log de errores de extracción

## Rendimiento

### Tiempos típicos de procesamiento

- PDF pequeño (< 500 KB): 200-400ms
- PDF mediano (500 KB - 2 MB): 400-800ms
- PDF grande (2-10 MB): 800-2000ms

### Optimizaciones

El sistema ya incluye:
- Validación temprana para rechazar archivos inválidos rápidamente
- Limpieza automática de archivos temporales
- Límite de tamaño (20MB) para evitar problemas de memoria
- Timeout de 30 segundos en requests

## Seguridad

### Validaciones de seguridad implementadas

- ✅ Validación de tipo de archivo (solo PDF)
- ✅ Límite de tamaño (20MB)
- ✅ Sanitización de nombres de archivo
- ✅ Eliminación automática de archivos temporales
- ✅ No se ejecuta código del PDF
- ✅ Validación de cabecera PDF

### Recomendaciones adicionales

En producción, considera:

1. **Rate limiting**: Limita requests por IP
2. **Autenticación**: Requiere login para usar el endpoint
3. **Virus scanning**: Integra antivirus para archivos subidos
4. **HTTPS**: Usa conexión segura

## Soporte

### Archivos creados/modificados

**Nuevos archivos:**
- `services/pdfExtractor.js` - Servicio de extracción
- `NBKConstanciaUpload.jsx` - Componente React
- `GUIA_EXTRACCION_PDF.md` - Esta documentación

**Archivos modificados:**
- `routes/companies.js` - Endpoint mejorado

### Obtener la Constancia de Situación Fiscal

Para probar, descarga una CSF del SAT:

1. Ingresa a https://www.sat.gob.mx/
2. Inicia sesión con tu RFC y contraseña
3. Ve a "Servicios por Internet" > "Constancia de Situación Fiscal"
4. Descarga el PDF
5. Usa ese PDF para probar la extracción

---

**Desarrollado para NBK Prototype**
Versión: 1.0.0
Última actualización: 2025-01-20
