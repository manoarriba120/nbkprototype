import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Loader } from 'lucide-react';
import axios from 'axios';

/**
 * Componente para subir y extraer datos de Constancia de Situación Fiscal (SAT)
 *
 * Uso:
 * <NBKConstanciaUpload
 *   onDataExtracted={(data) => console.log(data)}
 *   onError={(error) => console.error(error)}
 *   apiUrl="http://localhost:3000"
 * />
 */
const NBKConstanciaUpload = ({
    onDataExtracted,
    onError,
    apiUrl = 'http://localhost:3000',
    autoFillForm = true
}) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [extractedData, setExtractedData] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    // Validar archivo PDF en el cliente
    const validateFile = (file) => {
        // Validar tipo
        if (file.type !== 'application/pdf') {
            return { valid: false, error: 'Solo se permiten archivos PDF' };
        }

        // Validar tamaño (máximo 20MB)
        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
            return { valid: false, error: 'El archivo excede el tamaño máximo permitido (20MB)' };
        }

        // Validar tamaño mínimo
        if (file.size < 100) {
            return { valid: false, error: 'El archivo es demasiado pequeño para ser un PDF válido' };
        }

        return { valid: true };
    };

    // Manejar selección de archivo
    const handleFileSelect = (selectedFile) => {
        setError(null);
        setSuccess(false);
        setExtractedData(null);

        const validation = validateFile(selectedFile);
        if (!validation.valid) {
            setError(validation.error);
            return;
        }

        setFile(selectedFile);
    };

    // Manejar cambio en input de archivo
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    };

    // Manejar drag & drop
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    // Subir y procesar PDF
    const handleUpload = async () => {
        if (!file) {
            setError('Por favor selecciona un archivo PDF');
            return;
        }

        setUploading(true);
        setError(null);
        setSuccess(false);

        try {
            // Crear FormData
            const formData = new FormData();
            formData.append('constancia', file);

            // Enviar al backend
            const response = await axios.post(
                `${apiUrl}/api/companies/extract-constancia`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    timeout: 30000 // 30 segundos timeout
                }
            );

            if (response.data.success) {
                setSuccess(true);
                setExtractedData(response.data.data);

                // Callback con los datos extraídos
                if (onDataExtracted) {
                    onDataExtracted(response.data.data);
                }

                console.log('Datos extraídos:', response.data.data);
                console.log('Metadata:', response.data.metadata);
            } else {
                throw new Error(response.data.error || 'Error al procesar el PDF');
            }

        } catch (err) {
            console.error('Error al subir PDF:', err);

            let errorMessage = 'Error al procesar el PDF';

            if (err.response) {
                // Error del servidor
                errorMessage = err.response.data?.error || err.response.data?.message || errorMessage;
            } else if (err.request) {
                // No se recibió respuesta
                errorMessage = 'No se pudo conectar con el servidor. Verifica que esté corriendo.';
            } else {
                // Otro error
                errorMessage = err.message;
            }

            setError(errorMessage);

            // Callback de error
            if (onError) {
                onError(errorMessage);
            }
        } finally {
            setUploading(false);
        }
    };

    // Resetear componente
    const handleReset = () => {
        setFile(null);
        setError(null);
        setSuccess(false);
        setExtractedData(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Formatear tamaño de archivo
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Subir Constancia de Situación Fiscal
            </h2>

            {/* Área de drag & drop */}
            <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />

                {!file ? (
                    <>
                        <p className="text-gray-600 mb-2">
                            Arrastra tu PDF aquí o haz clic para seleccionar
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="hidden"
                            id="file-input"
                        />
                        <label
                            htmlFor="file-input"
                            className="inline-block px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            Seleccionar archivo
                        </label>
                    </>
                ) : (
                    <div className="flex items-center justify-between bg-white p-4 rounded border border-gray-200">
                        <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-blue-500" />
                            <div className="text-left">
                                <p className="font-medium text-gray-800">{file.name}</p>
                                <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleReset}
                            className="p-1 hover:bg-gray-100 rounded"
                            disabled={uploading}
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                )}
            </div>

            {/* Botón de procesar */}
            {file && !success && (
                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full mt-4 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {uploading ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Procesando PDF...
                        </>
                    ) : (
                        <>
                            <Upload className="w-5 h-5" />
                            Extraer datos del PDF
                        </>
                    )}
                </button>
            )}

            {/* Mensaje de error */}
            {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-red-800">Error</p>
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                </div>
            )}

            {/* Mensaje de éxito */}
            {success && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3 mb-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-green-800">Datos extraídos correctamente</p>
                            <p className="text-sm text-green-600">
                                Se han extraído los datos de la Constancia de Situación Fiscal
                            </p>
                        </div>
                    </div>

                    {/* Mostrar datos extraídos */}
                    {extractedData && (
                        <div className="mt-4 space-y-2 text-sm">
                            {extractedData.rfc && (
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">RFC:</span>
                                    <span className="text-gray-900">{extractedData.rfc}</span>
                                </div>
                            )}
                            {extractedData.razonSocial && (
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">Razón Social:</span>
                                    <span className="text-gray-900 text-right ml-4">
                                        {extractedData.razonSocial}
                                    </span>
                                </div>
                            )}
                            {extractedData.regimen && (
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">Régimen:</span>
                                    <span className="text-gray-900 text-right ml-4">
                                        {extractedData.regimen}
                                    </span>
                                </div>
                            )}
                            {extractedData.domicilioFiscal && (
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">Domicilio:</span>
                                    <span className="text-gray-900 text-right ml-4">
                                        {extractedData.domicilioFiscal}
                                    </span>
                                </div>
                            )}
                            {extractedData.fechaEmision && (
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">Fecha de Emisión:</span>
                                    <span className="text-gray-900">{extractedData.fechaEmision}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Botón para subir otro */}
                    <button
                        onClick={handleReset}
                        className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        Subir otra constancia
                    </button>
                </div>
            )}

            {/* Información adicional */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> Solo se aceptan archivos PDF de Constancia de Situación Fiscal
                    del SAT con texto extraíble. El tamaño máximo es de 20MB.
                </p>
            </div>
        </div>
    );
};

export default NBKConstanciaUpload;
