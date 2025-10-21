import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader, Building2, Save } from 'lucide-react';
import axios from 'axios';

/**
 * Modal para agregar una nueva empresa
 * Incluye upload de PDF de Constancia de Situación Fiscal
 */
const NBKAddCompanyModal = ({ isOpen, onClose, onCompanyAdded, apiUrl = 'http://localhost:3000' }) => {
  const [step, setStep] = useState(1); // 1: Upload PDF, 2: Form
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [formData, setFormData] = useState({
    rfc: '',
    razonSocial: '',
    nombreCorto: '',
    pseudonimo: '',
    regimen: '',
    domicilioFiscal: '',
    codigoPostal: '',
    giro: '',
    status: '',
    nivel: 'Básico'
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setError(null);
    setFormData({
      rfc: '',
      razonSocial: '',
      nombreCorto: '',
      pseudonimo: '',
      regimen: '',
      domicilioFiscal: '',
      codigoPostal: '',
      giro: '',
      status: '',
      nivel: 'Básico'
    });
    onClose();
  };

  const validateFile = (file) => {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'Solo se permiten archivos PDF' };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { valid: false, error: 'El archivo excede 20MB' };
    }
    return { valid: true };
  };

  const handleFileSelect = (selectedFile) => {
    setError(null);
    const validation = validateFile(selectedFile);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setFile(selectedFile);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

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

  const handleUploadPDF = async () => {
    if (!file) {
      setError('Por favor selecciona un archivo PDF');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('constancia', file);

      const response = await axios.post(
        `${apiUrl}/api/companies/extract-constancia`,
        formDataUpload,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );

      if (response.data.success) {
        // Auto-llenar formulario con datos extraídos
        const extracted = response.data.data;
        setFormData({
          rfc: extracted.rfc || '',
          razonSocial: extracted.razonSocial || '',
          nombreCorto: extracted.nombreCorto || extracted.razonSocial?.substring(0, 50) || '',
          pseudonimo: extracted.nombreCorto || extracted.razonSocial?.substring(0, 30) || '',
          regimen: extracted.regimen || '',
          domicilioFiscal: extracted.domicilioFiscal || '',
          codigoPostal: extracted.codigoPostal || '',
          giro: extracted.giro || '',
          status: extracted.status || 'active',
          nivel: 'Básico'
        });

        // Ir al siguiente paso
        setStep(2);
      } else {
        throw new Error(response.data.error || 'Error al procesar el PDF');
      }
    } catch (err) {
      console.error('Error:', err);
      let errorMessage = 'Error al procesar el PDF';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveCompany = async () => {
    // Validar campos requeridos
    if (!formData.rfc || !formData.razonSocial) {
      setError('RFC y Razón Social son requeridos');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await axios.post(
        `${apiUrl}/api/companies`,
        formData,
        { timeout: 10000 }
      );

      if (response.data.success) {
        // Notificar al componente padre
        if (onCompanyAdded) {
          onCompanyAdded(response.data.company);
        }
        handleClose();
      } else {
        throw new Error(response.data.error || 'Error al guardar la empresa');
      }
    } catch (err) {
      console.error('Error:', err);
      let errorMessage = 'Error al guardar la empresa';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const skipPDF = () => {
    setStep(2);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 1 ? 'Subir Constancia Fiscal' : 'Agregar Empresa'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Upload PDF */}
          {step === 1 && (
            <div>
              <p className="text-gray-600 mb-6">
                Sube tu Constancia de Situación Fiscal del SAT para extraer automáticamente los datos de tu empresa.
              </p>

              {/* Drag & Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-4 ${
                  dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
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
                      id="pdf-input"
                    />
                    <label
                      htmlFor="pdf-input"
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
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="p-1 hover:bg-gray-100 rounded"
                      disabled={uploading}
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {file && (
                  <button
                    onClick={handleUploadPDF}
                    disabled={uploading}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Procesando PDF...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Extraer datos del PDF
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={skipPDF}
                  disabled={uploading}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Llenar manualmente
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Form */}
          {step === 2 && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Datos extraídos correctamente</p>
                  <p className="text-sm text-blue-600">
                    Revisa y edita la información antes de guardar
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* RFC */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    RFC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="rfc"
                    value={formData.rfc}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </div>

                {/* Razón Social */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razón Social <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="razonSocial"
                    value={formData.razonSocial}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Nombre Corto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Corto
                  </label>
                  <input
                    type="text"
                    name="nombreCorto"
                    value={formData.nombreCorto}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Pseudonimo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pseudónimo
                  </label>
                  <input
                    type="text"
                    name="pseudonimo"
                    value={formData.pseudonimo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Régimen Fiscal */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Régimen Fiscal
                  </label>
                  <textarea
                    name="regimen"
                    value={formData.regimen}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Domicilio Fiscal */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domicilio Fiscal
                  </label>
                  <textarea
                    name="domicilioFiscal"
                    value={formData.domicilioFiscal}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Código Postal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    name="codigoPostal"
                    value={formData.codigoPostal}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Nivel */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel
                  </label>
                  <select
                    name="nivel"
                    value={formData.nivel}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Básico">Básico</option>
                    <option value="Premium">Premium</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                {/* Giro */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giro / Actividad Económica
                  </label>
                  <textarea
                    name="giro"
                    value={formData.giro}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  disabled={saving}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleSaveCompany}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Agregar Empresa
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NBKAddCompanyModal;
