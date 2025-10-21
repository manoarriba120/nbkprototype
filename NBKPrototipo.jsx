import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getMetadata } from 'firebase/storage';
import { FileKey, FileCheck, AlertCircle, CheckCircle2, XCircle, Upload, User, Building2 } from 'lucide-react';

// Firebase Configuration
const __firebase_config = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const __app_id = "nbk-prototipo-ruben";
const __initial_auth_token = "SIMULATED_CUSTOM_TOKEN";

// Initialize Firebase
const app = initializeApp(__firebase_config, __app_id);
const auth = getAuth(app);
const storage = getStorage(app);

// SAT Context
const SATContext = createContext();

const useSAT = () => {
  const context = useContext(SATContext);
  if (!context) throw new Error('useSAT must be used within SATProvider');
  return context;
};

// RFC Validation
const validateRFC = (rfc) => {
  const rfcPattern = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
  return rfcPattern.test(rfc.toUpperCase());
};

// SAT Provider Component
const SATProvider = ({ children }) => {
  const [credentials, setCredentials] = useState({
    rfc: '',
    fielKey: null,
    fielCer: null,
    password: ''
  });
  const [satConnected, setSatConnected] = useState(false);
  const [satToken, setSatToken] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [downloadHistory, setDownloadHistory] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('nbk_sat_config');
    const savedHistory = localStorage.getItem('nbk_download_history');

    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setCredentials(prev => ({ ...prev, rfc: config.rfc || '' }));
        if (config.satConnected) {
          setSatConnected(true);
          setSatToken(config.satToken);
        }
      } catch (e) {
        console.error('Error loading config:', e);
      }
    }

    if (savedHistory) {
      try {
        setDownloadHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading history:', e);
      }
    }
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Save to localStorage when credentials change
  useEffect(() => {
    if (credentials.rfc && satConnected) {
      localStorage.setItem('nbk_sat_config', JSON.stringify({
        rfc: credentials.rfc,
        satConnected,
        satToken,
        lastUpdated: new Date().toISOString()
      }));
    }
  }, [credentials.rfc, satConnected, satToken]);

  // Save history to localStorage
  useEffect(() => {
    if (downloadHistory.length > 0) {
      localStorage.setItem('nbk_download_history', JSON.stringify(downloadHistory));
    }
  }, [downloadHistory]);

  // Initialize Firebase Storage Structure
  const initializeStorageStructure = async (rfc) => {
    const currentYear = new Date().getFullYear();
    const folders = [];

    for (let year = 2020; year <= currentYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString().padStart(2, '0');
        folders.push(`xmls/${rfc}/${year}/${monthStr}/`);
      }
    }

    return folders;
  };

  // Save XML to Firebase Storage
  const saveXMLToStorage = async (xmlFile, metadata = {}) => {
    if (!credentials.rfc) {
      throw new Error('RFC no configurado');
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const timestamp = Date.now();

    const filePath = `xmls/${credentials.rfc}/${year}/${month}/${timestamp}_${xmlFile.name}`;
    const storageRef = ref(storage, filePath);

    const fullMetadata = {
      customMetadata: {
        rfc: credentials.rfc,
        uploadDate: date.toISOString(),
        year: year.toString(),
        month: month,
        ...metadata
      }
    };

    await uploadBytes(storageRef, xmlFile, fullMetadata);

    // Add to download history
    const historyEntry = {
      fileName: xmlFile.name,
      path: filePath,
      uploadDate: date.toISOString(),
      size: xmlFile.size
    };

    setDownloadHistory(prev => [historyEntry, ...prev].slice(0, 50));

    return { path: filePath, metadata: fullMetadata };
  };

  // Validate FIEL with SAT (Simulated)
  const validateWithSAT = async () => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate validation
    if (credentials.rfc && credentials.fielKey && credentials.fielCer && credentials.password) {
      const simulatedToken = `SAT_TOKEN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSatToken(simulatedToken);
      setSatConnected(true);

      // Initialize storage structure
      await initializeStorageStructure(credentials.rfc);

      // Authenticate with Firebase using simulated custom token
      try {
        await signInWithCustomToken(auth, __initial_auth_token);
      } catch (error) {
        console.warn('Firebase auth simulation:', error.message);
      }

      return { success: true, token: simulatedToken };
    }

    throw new Error('Credenciales incompletas');
  };

  const value = {
    credentials,
    setCredentials,
    satConnected,
    setSatConnected,
    satToken,
    validateWithSAT,
    saveXMLToStorage,
    downloadHistory,
    firebaseUser
  };

  return <SATContext.Provider value={value}>{children}</SATContext.Provider>;
};

// Header Component
const Header = () => {
  const { credentials, satConnected } = useSAT();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white rounded-lg p-2">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">NBK - Descarga CFDI SAT</h1>
              <p className="text-xs text-gray-500">Prototipo Ruben</p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {credentials.rfc && (
              <div className="flex items-center space-x-2 bg-gray-50 px-4 py-2 rounded-lg">
                <Building2 className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-900">{credentials.rfc}</span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              {satConnected ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm text-gray-600">
                {satConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-gray-600">
              <User className="w-5 h-5" />
              <span className="text-sm">Admin</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

// Configuration Form Component
const ConfigurationForm = () => {
  const { credentials, setCredentials, validateWithSAT, satConnected } = useSAT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rfcError, setRfcError] = useState('');

  const handleRFCChange = (e) => {
    const value = e.target.value.toUpperCase();
    setCredentials(prev => ({ ...prev, rfc: value }));

    if (value && !validateRFC(value)) {
      setRfcError('RFC inválido. Formato: XXX(X)000000XXX');
    } else {
      setRfcError('');
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setCredentials(prev => ({ ...prev, [type]: file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateRFC(credentials.rfc)) {
      setError('RFC inválido');
      return;
    }

    if (!credentials.fielKey || !credentials.fielCer) {
      setError('Debe cargar ambos archivos FIEL (.key y .cer)');
      return;
    }

    if (!credentials.password) {
      setError('Debe ingresar la contraseña de la FIEL');
      return;
    }

    setLoading(true);

    try {
      const result = await validateWithSAT();
      setSuccess(`¡Conexión exitosa con SAT! Token: ${result.token.substring(0, 20)}...`);
    } catch (err) {
      setError(err.message || 'Error al validar con SAT');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Configuración Inicial
          </h2>
          <p className="text-gray-600">
            Configure sus credenciales para conectarse al portal del SAT
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* RFC Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RFC de la Empresa
            </label>
            <input
              type="text"
              value={credentials.rfc}
              onChange={handleRFCChange}
              placeholder="XAXX010101000"
              maxLength={13}
              className={`w-full px-4 py-3 border ${rfcError ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition`}
              disabled={satConnected}
            />
            {rfcError && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {rfcError}
              </p>
            )}
          </div>

          {/* FIEL Files */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo .KEY (FIEL)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".key"
                  onChange={(e) => handleFileChange(e, 'fielKey')}
                  className="hidden"
                  id="fielKey"
                  disabled={satConnected}
                />
                <label
                  htmlFor="fielKey"
                  className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed ${credentials.fielKey ? 'border-green-300 bg-green-50' : 'border-gray-300'} rounded-lg cursor-pointer hover:border-indigo-400 transition ${satConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {credentials.fielKey ? (
                    <>
                      <FileCheck className="w-5 h-5 text-green-600 mr-2" />
                      <span className="text-sm text-green-700">{credentials.fielKey.name}</span>
                    </>
                  ) : (
                    <>
                      <FileKey className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">Seleccionar .KEY</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo .CER (FIEL)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".cer"
                  onChange={(e) => handleFileChange(e, 'fielCer')}
                  className="hidden"
                  id="fielCer"
                  disabled={satConnected}
                />
                <label
                  htmlFor="fielCer"
                  className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed ${credentials.fielCer ? 'border-green-300 bg-green-50' : 'border-gray-300'} rounded-lg cursor-pointer hover:border-indigo-400 transition ${satConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {credentials.fielCer ? (
                    <>
                      <FileCheck className="w-5 h-5 text-green-600 mr-2" />
                      <span className="text-sm text-green-700">{credentials.fielCer.name}</span>
                    </>
                  ) : (
                    <>
                      <FileKey className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">Seleccionar .CER</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña de la FIEL
            </label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              disabled={satConnected}
            />
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || satConnected}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition flex items-center justify-center ${
              satConnected
                ? 'bg-green-600 cursor-not-allowed'
                : loading
                ? 'bg-indigo-400 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Validando con SAT...
              </>
            ) : satConnected ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Conectado al SAT
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Validar con SAT
              </>
            )}
          </button>
        </form>
      </div>

      {/* Connection Status Card */}
      {satConnected && (
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Conexión</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Estado SAT:</span>
              <span className="flex items-center text-sm font-medium text-green-600">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Conectado
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">RFC Configurado:</span>
              <span className="text-sm font-mono text-gray-900">{credentials.rfc}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Carpeta Storage:</span>
              <span className="text-sm font-mono text-gray-600">/xmls/{credentials.rfc}/</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App Component
const NBKPrototipo = () => {
  return (
    <SATProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ConfigurationForm />
        </main>
      </div>
    </SATProvider>
  );
};

export default NBKPrototipo;