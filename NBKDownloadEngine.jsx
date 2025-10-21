import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, getMetadata as getStorageMetadata } from 'firebase/storage';
import { getFirestore, collection, doc, setDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Database,
  HardDrive,
  Clock,
  Zap,
  RefreshCw,
  AlertCircle,
  FileDown,
  Save,
  Eye,
  TrendingUp
} from 'lucide-react';

// Firebase Configuration
const __firebase_config = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(__firebase_config);
const auth = getAuth(app);
const storage = getStorage(app);
const firestore = getFirestore(app);

// Constants
const MAX_CONCURRENT_DOWNLOADS = 5;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const SAT_API_BASE = 'https://sat.api.example.com'; // Replace with actual SAT API

// Utility Functions
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDuration = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
};

// XML Parser
const parseXMLMetadata = (xmlString) => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XML parsing error');
    }

    // Extract CFDI data (namespace-aware)
    const cfdiNode = xmlDoc.querySelector('Comprobante, cfdi\\:Comprobante');
    const timbreFiscal = xmlDoc.querySelector('TimbreFiscalDigital, tfd\\:TimbreFiscalDigital');

    if (!cfdiNode) {
      throw new Error('Invalid CFDI structure');
    }

    const emisor = cfdiNode.querySelector('Emisor, cfdi\\:Emisor');
    const receptor = cfdiNode.querySelector('Receptor, cfdi\\:Receptor');

    const metadata = {
      uuid: timbreFiscal?.getAttribute('UUID') || '',
      rfcEmisor: emisor?.getAttribute('Rfc') || '',
      nombreEmisor: emisor?.getAttribute('Nombre') || '',
      rfcReceptor: receptor?.getAttribute('Rfc') || '',
      nombreReceptor: receptor?.getAttribute('Nombre') || '',
      fecha: cfdiNode.getAttribute('Fecha') || '',
      total: parseFloat(cfdiNode.getAttribute('Total') || '0'),
      subtotal: parseFloat(cfdiNode.getAttribute('SubTotal') || '0'),
      moneda: cfdiNode.getAttribute('Moneda') || 'MXN',
      tipoComprobante: cfdiNode.getAttribute('TipoDeComprobante') || '',
      serie: cfdiNode.getAttribute('Serie') || '',
      folio: cfdiNode.getAttribute('Folio') || '',
      metodoPago: cfdiNode.getAttribute('MetodoPago') || '',
      formaPago: cfdiNode.getAttribute('FormaPago') || '',
      version: cfdiNode.getAttribute('Version') || ''
    };

    return metadata;
  } catch (error) {
    console.error('Error parsing XML:', error);
    throw error;
  }
};

// SAT API Service (Simulated)
class SATService {
  constructor(credentials) {
    this.credentials = credentials;
    this.token = null;
    this.tokenExpiry = null;
  }

  async authenticate() {
    // Simulate FIEL authentication
    try {
      // In real implementation, this would:
      // 1. Load .key and .cer files
      // 2. Create digital signature
      // 3. Send to SAT API
      // 4. Receive authentication token

      await new Promise(resolve => setTimeout(resolve, 1500));

      this.token = `SAT_TOKEN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour

      return { success: true, token: this.token };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async ensureAuthenticated() {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  async requestCFDIPackage(startDate, endDate, cfdiType) {
    await this.ensureAuthenticated();

    // Simulate SAT package request
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Return simulated list of CFDIs
      const count = Math.floor(Math.random() * 50) + 10;
      const cfdis = Array.from({ length: count }, (_, i) => ({
        uuid: `${i + 1}_${Math.random().toString(36).substr(2, 32).toUpperCase()}`,
        fecha: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        downloadUrl: `${SAT_API_BASE}/cfdi/download/${i + 1}`
      }));

      return {
        success: true,
        packageId: `PKG_${Date.now()}`,
        cfdis
      };
    } catch (error) {
      throw new Error(`Failed to request CFDI package: ${error.message}`);
    }
  }

  async downloadCFDI(uuid, downloadUrl) {
    await this.ensureAuthenticated();

    try {
      // Simulate download delay
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

      // Simulate occasional failures
      if (Math.random() < 0.05) {
        throw new Error('Network error');
      }

      // Generate simulated XML content
      const xmlContent = this.generateSimulatedXML(uuid);

      return {
        success: true,
        uuid,
        content: xmlContent,
        size: xmlContent.length
      };
    } catch (error) {
      throw new Error(`Failed to download CFDI ${uuid}: ${error.message}`);
    }
  }

  generateSimulatedXML(uuid) {
    // Generate a realistic CFDI XML structure
    const total = (Math.random() * 10000 + 100).toFixed(2);
    const subtotal = (total * 0.86).toFixed(2);
    const fecha = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   Version="4.0"
                   Serie="A"
                   Folio="${Math.floor(Math.random() * 10000)}"
                   Fecha="${fecha}"
                   FormaPago="03"
                   SubTotal="${subtotal}"
                   Moneda="MXN"
                   Total="${total}"
                   TipoDeComprobante="I"
                   MetodoPago="PUE"
                   LugarExpedicion="01000">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA DEMO SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${this.credentials.rfc}" Nombre="RECEPTOR DEMO" UsoCFDI="G03" DomicilioFiscalReceptor="01000" RegimenFiscalReceptor="601"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="ACT" Descripcion="Servicio de prueba" ValorUnitario="${subtotal}" Importe="${subtotal}"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${(total - subtotal).toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${subtotal}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${(total - subtotal).toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
                              Version="1.1"
                              UUID="${uuid}"
                              FechaTimbrado="${fecha}"
                              SelloCFD="SELLO_SIMULADO"
                              NoCertificadoSAT="00001000000123456789"
                              SelloSAT="SELLO_SAT_SIMULADO"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  }
}

// Download Queue Manager
class DownloadQueue {
  constructor() {
    this.jobs = [];
    this.activeJobs = new Map();
    this.completedJobs = [];
    this.failedJobs = [];
    this.paused = false;
  }

  addJob(job) {
    this.jobs.push({
      ...job,
      status: 'pending',
      retries: 0,
      error: null,
      startTime: null,
      endTime: null
    });
  }

  addJobs(jobs) {
    jobs.forEach(job => this.addJob(job));
  }

  getNextJobs(count) {
    return this.jobs
      .filter(job => job.status === 'pending')
      .slice(0, count);
  }

  updateJob(uuid, updates) {
    const job = this.jobs.find(j => j.uuid === uuid);
    if (job) {
      Object.assign(job, updates);
    }
  }

  markCompleted(uuid, result) {
    const job = this.jobs.find(j => j.uuid === uuid);
    if (job) {
      job.status = 'completed';
      job.endTime = Date.now();
      job.result = result;
      this.completedJobs.push(job);
      this.activeJobs.delete(uuid);
    }
  }

  markFailed(uuid, error) {
    const job = this.jobs.find(j => j.uuid === uuid);
    if (job) {
      job.retries++;
      job.error = error.message;

      if (job.retries >= MAX_RETRIES) {
        job.status = 'failed';
        this.failedJobs.push(job);
        this.activeJobs.delete(uuid);
      } else {
        job.status = 'pending';
        this.activeJobs.delete(uuid);
      }
    }
  }

  setActive(uuid) {
    const job = this.jobs.find(j => j.uuid === uuid);
    if (job) {
      job.status = 'downloading';
      job.startTime = Date.now();
      this.activeJobs.set(uuid, job);
    }
  }

  getStats() {
    return {
      total: this.jobs.length,
      pending: this.jobs.filter(j => j.status === 'pending').length,
      downloading: this.activeJobs.size,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length
    };
  }

  clear() {
    this.jobs = [];
    this.activeJobs.clear();
    this.completedJobs = [];
    this.failedJobs = [];
  }

  saveToLocalStorage(key) {
    const data = {
      jobs: this.jobs,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs
    };
    localStorage.setItem(key, JSON.stringify(data));
  }

  loadFromLocalStorage(key) {
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      this.jobs = parsed.jobs || [];
      this.completedJobs = parsed.completedJobs || [];
      this.failedJobs = parsed.failedJobs || [];
    }
  }
}

// Logger
class DownloadLogger {
  constructor() {
    this.logs = [];
  }

  log(message, type = 'info', data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString('es-MX'),
      message,
      type,
      data
    };
    this.logs.push(entry);
    console.log(`[${entry.time}] [${type.toUpperCase()}] ${message}`, data || '');
  }

  info(message, data = null) {
    this.log(message, 'info', data);
  }

  success(message, data = null) {
    this.log(message, 'success', data);
  }

  warning(message, data = null) {
    this.log(message, 'warning', data);
  }

  error(message, data = null) {
    this.log(message, 'error', data);
  }

  exportLogs() {
    const blob = new Blob([JSON.stringify(this.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nbk-download-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clear() {
    this.logs = [];
  }
}

// Main Download Engine Component
const NBKDownloadEngine = () => {
  // Configuration
  const [credentials] = useState({
    rfc: 'XAXX010101000',
    fielKey: null,
    fielCer: null,
    password: 'password123'
  });

  // Download configuration
  const [downloadConfig, setDownloadConfig] = useState({
    startDate: '',
    endDate: '',
    cfdiType: 'emitidos'
  });

  // Engine state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    downloading: 0,
    completed: 0,
    failed: 0
  });

  // Performance metrics
  const [metrics, setMetrics] = useState({
    startTime: null,
    downloadSpeed: 0,
    estimatedTimeRemaining: 0,
    totalBytes: 0,
    averageFileSize: 0
  });

  // Storage info
  const [storageInfo, setStorageInfo] = useState({
    usedSpace: 0,
    fileCount: 0
  });

  // Logs
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  // Refs
  const queueRef = useRef(new DownloadQueue());
  const loggerRef = useRef(new DownloadLogger());
  const satServiceRef = useRef(null);
  const workerRef = useRef(null);

  // State for job list view
  const [viewMode, setViewMode] = useState('active'); // 'active', 'completed', 'failed'
  const [showSummary, setShowSummary] = useState(false);

  // Initialize SAT Service
  useEffect(() => {
    satServiceRef.current = new SATService(credentials);
  }, [credentials]);

  // Logger effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs([...loggerRef.current.logs]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check for duplicates in Firestore
  const checkDuplicateUUID = async (uuid) => {
    try {
      const q = query(collection(firestore, 'cfdi_metadata'), where('uuid', '==', uuid));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      loggerRef.current.warning(`Error checking duplicate: ${error.message}`);
      return false;
    }
  };

  // Save XML to Firebase Storage
  const saveXMLToStorage = async (uuid, xmlContent, metadata) => {
    try {
      const date = new Date(metadata.fecha);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      const filePath = `xmls/${credentials.rfc}/${year}/${month}/${uuid}.xml`;
      const storageRef = ref(storage, filePath);

      // Convert string to Blob
      const blob = new Blob([xmlContent], { type: 'text/xml' });

      // Upload to Storage
      await uploadBytes(storageRef, blob, {
        customMetadata: {
          uuid,
          rfcEmisor: metadata.rfcEmisor,
          rfcReceptor: metadata.rfcReceptor,
          fecha: metadata.fecha,
          total: String(metadata.total)
        }
      });

      loggerRef.current.success(`XML ${uuid} guardado en Storage`);

      return { path: filePath, url: await getDownloadURL(storageRef) };
    } catch (error) {
      loggerRef.current.error(`Error guardando XML ${uuid} en Storage: ${error.message}`);
      throw error;
    }
  };

  // Save metadata to Firestore
  const saveMetadataToFirestore = async (metadata, storagePath) => {
    try {
      const docRef = doc(firestore, 'cfdi_metadata', metadata.uuid);

      await setDoc(docRef, {
        ...metadata,
        storagePath,
        fechaDescarga: new Date().toISOString(),
        rfc: credentials.rfc
      });

      loggerRef.current.success(`Metadata de ${metadata.uuid} guardada en Firestore`);
    } catch (error) {
      loggerRef.current.error(`Error guardando metadata en Firestore: ${error.message}`);
      throw error;
    }
  };

  // Process single CFDI
  const processCFDI = async (job) => {
    const { uuid, downloadUrl } = job;

    try {
      // Check for duplicates
      const isDuplicate = await checkDuplicateUUID(uuid);
      if (isDuplicate) {
        loggerRef.current.warning(`UUID ${uuid} ya existe, omitiendo...`);
        return { skipped: true, reason: 'duplicate' };
      }

      // Download XML
      loggerRef.current.info(`Descargando XML ${uuid}...`);
      const downloadResult = await satServiceRef.current.downloadCFDI(uuid, downloadUrl);

      // Parse metadata
      loggerRef.current.info(`Procesando XML ${uuid}...`);
      const metadata = parseXMLMetadata(downloadResult.content);

      // Save to Storage
      const storageResult = await saveXMLToStorage(uuid, downloadResult.content, metadata);

      // Save metadata to Firestore
      await saveMetadataToFirestore(metadata, storageResult.path);

      // Update storage info
      setStorageInfo(prev => ({
        usedSpace: prev.usedSpace + downloadResult.size,
        fileCount: prev.fileCount + 1
      }));

      return {
        success: true,
        uuid,
        size: downloadResult.size,
        metadata,
        storagePath: storageResult.path
      };
    } catch (error) {
      loggerRef.current.error(`Error procesando CFDI ${uuid}: ${error.message}`);
      throw error;
    }
  };

  // Worker function to process jobs
  const processQueue = async () => {
    const queue = queueRef.current;

    while (!queue.paused && queue.getStats().pending > 0) {
      // Get next batch of jobs
      const availableSlots = MAX_CONCURRENT_DOWNLOADS - queue.activeJobs.size;
      if (availableSlots <= 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const nextJobs = queue.getNextJobs(availableSlots);

      // Process jobs in parallel
      const promises = nextJobs.map(async (job) => {
        queue.setActive(job.uuid);

        try {
          const result = await processCFDI(job);

          if (result.skipped) {
            queue.markCompleted(job.uuid, result);
          } else {
            queue.markCompleted(job.uuid, result);
          }
        } catch (error) {
          queue.markFailed(job.uuid, error);

          // Retry after delay if not max retries
          if (job.retries < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }

        // Update stats
        const newStats = queue.getStats();
        setStats(newStats);
        setProgress((newStats.completed / newStats.total) * 100);
      });

      await Promise.all(promises);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check if finished
    const finalStats = queue.getStats();
    if (finalStats.pending === 0 && finalStats.downloading === 0) {
      setIsRunning(false);
      loggerRef.current.success('Proceso de descarga completado');
      setShowSummary(true);

      // Calculate final metrics
      const endTime = Date.now();
      const duration = (endTime - metrics.startTime) / 1000;
      loggerRef.current.info(`Tiempo total: ${formatDuration(duration)}`);
      loggerRef.current.info(`Total descargados: ${finalStats.completed}`);
      loggerRef.current.info(`Total fallidos: ${finalStats.failed}`);
    }
  };

  // Start download
  const startDownload = async () => {
    if (!downloadConfig.startDate || !downloadConfig.endDate) {
      alert('Por favor selecciona fechas de inicio y fin');
      return;
    }

    try {
      setIsRunning(true);
      setShowSummary(false);
      loggerRef.current.clear();
      queueRef.current.clear();
      setStorageInfo({ usedSpace: 0, fileCount: 0 });

      const startTime = Date.now();
      setMetrics(prev => ({ ...prev, startTime }));

      loggerRef.current.info('Iniciando proceso de descarga...');
      loggerRef.current.info(`Periodo: ${downloadConfig.startDate} - ${downloadConfig.endDate}`);

      // Authenticate
      loggerRef.current.info('Autenticando con SAT...');
      await satServiceRef.current.authenticate();
      loggerRef.current.success('Autenticación exitosa');

      // Request CFDI package
      loggerRef.current.info('Solicitando paquete de CFDIs...');
      const packageResult = await satServiceRef.current.requestCFDIPackage(
        downloadConfig.startDate,
        downloadConfig.endDate,
        downloadConfig.cfdiType
      );

      loggerRef.current.success(`Paquete recibido: ${packageResult.cfdis.length} CFDIs`);

      // Add jobs to queue
      queueRef.current.addJobs(packageResult.cfdis);
      setStats(queueRef.current.getStats());

      // Start processing
      loggerRef.current.info('Iniciando descarga de XMLs...');
      await processQueue();

    } catch (error) {
      loggerRef.current.error(`Error en el proceso: ${error.message}`);
      setIsRunning(false);
    }
  };

  // Pause/Resume
  const togglePause = () => {
    queueRef.current.paused = !queueRef.current.paused;
    setIsPaused(queueRef.current.paused);

    if (queueRef.current.paused) {
      loggerRef.current.warning('Descarga pausada');
    } else {
      loggerRef.current.info('Descarga reanudada');
      processQueue();
    }
  };

  // Retry failed
  const retryFailed = () => {
    const queue = queueRef.current;
    queue.failedJobs.forEach(job => {
      job.status = 'pending';
      job.retries = 0;
      job.error = null;
    });
    queue.failedJobs = [];
    setStats(queue.getStats());
    loggerRef.current.info(`Reintentando ${queue.jobs.filter(j => j.status === 'pending').length} trabajos fallidos`);
    processQueue();
  };

  // Export logs
  const exportLogs = () => {
    loggerRef.current.exportLogs();
  };

  // Reset
  const reset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setProgress(0);
    queueRef.current.clear();
    setStats({ total: 0, pending: 0, downloading: 0, completed: 0, failed: 0 });
    setStorageInfo({ usedSpace: 0, fileCount: 0 });
    setShowSummary(false);
    loggerRef.current.clear();
  };

  // Get visible jobs based on view mode
  const visibleJobs = useMemo(() => {
    const queue = queueRef.current;
    switch (viewMode) {
      case 'completed':
        return queue.completedJobs;
      case 'failed':
        return queue.failedJobs;
      default:
        return queue.jobs.filter(j => j.status === 'pending' || j.status === 'downloading');
    }
  }, [viewMode, stats]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
            <Download className="w-8 h-8 mr-3 text-indigo-600" />
            Motor de Descarga SAT
          </h1>
          <p className="text-gray-600">
            Sistema de descarga masiva y almacenamiento de CFDI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Config Form */}
            {!isRunning && !showSummary && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Configuración de Descarga
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha Inicio
                      </label>
                      <input
                        type="date"
                        value={downloadConfig.startDate}
                        onChange={(e) => setDownloadConfig(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha Fin
                      </label>
                      <input
                        type="date"
                        value={downloadConfig.endDate}
                        onChange={(e) => setDownloadConfig(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de CFDI
                    </label>
                    <select
                      value={downloadConfig.cfdiType}
                      onChange={(e) => setDownloadConfig(prev => ({ ...prev, cfdiType: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="emitidos">Emitidos</option>
                      <option value="recibidos">Recibidos</option>
                      <option value="todos">Todos</option>
                    </select>
                  </div>

                  <button
                    onClick={startDownload}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition flex items-center justify-center"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Iniciar Descarga
                  </button>
                </div>
              </div>
            )}

            {/* Progress Panel */}
            {isRunning && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Progreso de Descarga
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={togglePause}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition flex items-center"
                    >
                      {isPaused ? (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Reanudar
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pausar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      {stats.completed} de {stats.total} completados
                    </span>
                    <span className="font-semibold text-indigo-600">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-500">Pendientes</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="text-xs text-gray-500">Descargando</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{stats.downloading}</div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-xs text-gray-500">Completados</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-xs text-gray-500">Fallidos</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Jobs Table */}
            {isRunning && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Estado de Archivos
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode('active')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        viewMode === 'active'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Activos
                    </button>
                    <button
                      onClick={() => setViewMode('completed')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        viewMode === 'completed'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Completados
                    </button>
                    <button
                      onClick={() => setViewMode('failed')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        viewMode === 'failed'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Fallidos
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">UUID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Reintentos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {visibleJobs.slice(0, 50).map((job) => (
                        <tr key={job.uuid} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            {job.uuid.substring(0, 20)}...
                          </td>
                          <td className="px-4 py-3">
                            {job.status === 'pending' && (
                              <span className="flex items-center text-sm text-gray-600">
                                <Clock className="w-4 h-4 mr-1" />
                                Pendiente
                              </span>
                            )}
                            {job.status === 'downloading' && (
                              <span className="flex items-center text-sm text-blue-600">
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Descargando
                              </span>
                            )}
                            {job.status === 'completed' && (
                              <span className="flex items-center text-sm text-green-600">
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Completado
                              </span>
                            )}
                            {job.status === 'failed' && (
                              <span className="flex items-center text-sm text-red-600">
                                <XCircle className="w-4 h-4 mr-1" />
                                Fallido
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {job.retries}/{MAX_RETRIES}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary */}
            {showSummary && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-center mb-6">
                  <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Descarga Completada
                  </h2>
                  <p className="text-gray-600">
                    El proceso de descarga ha finalizado
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {stats.completed}
                    </div>
                    <div className="text-sm text-gray-600">XMLs Descargados</div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-red-600 mb-1">
                      {stats.failed}
                    </div>
                    <div className="text-sm text-gray-600">Con Error</div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <HardDrive className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {formatBytes(storageInfo.usedSpace)}
                    </div>
                    <div className="text-sm text-gray-600">Espacio Utilizado</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  {stats.failed > 0 && (
                    <button
                      onClick={retryFailed}
                      className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition flex items-center justify-center"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Reintentar Fallidos
                    </button>
                  )}
                  <button
                    onClick={reset}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition flex items-center justify-center"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Nueva Descarga
                  </button>
                </div>
              </div>
            )}

            {/* Logs Panel */}
            {logs.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                    Registro de Actividad
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition flex items-center"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {showLogs ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button
                      onClick={exportLogs}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition flex items-center"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Exportar
                    </button>
                  </div>
                </div>

                {showLogs && (
                  <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs">
                    {logs.slice(-100).map((log, i) => (
                      <div
                        key={i}
                        className={`mb-1 ${
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'success' ? 'text-green-400' :
                          log.type === 'warning' ? 'text-yellow-400' :
                          'text-gray-300'
                        }`}
                      >
                        <span className="text-gray-500">[{log.time}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar - Info */}
          <div className="space-y-6">
            {/* Storage Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Database className="w-5 h-5 mr-2 text-indigo-600" />
                Almacenamiento
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <HardDrive className="w-5 h-5 text-gray-600 mr-3" />
                    <div>
                      <div className="text-sm text-gray-600">Espacio usado</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatBytes(storageInfo.usedSpace)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-gray-600 mr-3" />
                    <div>
                      <div className="text-sm text-gray-600">Archivos</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {storageInfo.fileCount}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <TrendingUp className="w-5 h-5 text-gray-600 mr-3" />
                    <div>
                      <div className="text-sm text-gray-600">Promedio/archivo</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatBytes(storageInfo.fileCount > 0 ? storageInfo.usedSpace / storageInfo.fileCount : 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-indigo-600" />
                Configuración
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Descargas paralelas:</span>
                  <span className="font-semibold text-gray-900">{MAX_CONCURRENT_DOWNLOADS}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reintentos máximos:</span>
                  <span className="font-semibold text-gray-900">{MAX_RETRIES}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delay entre reintentos:</span>
                  <span className="font-semibold text-gray-900">{RETRY_DELAY / 1000}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">RFC configurado:</span>
                  <span className="font-mono text-xs font-semibold text-gray-900">{credentials.rfc}</span>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-semibold mb-1">Notas importantes:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Los XMLs se guardan en Firebase Storage</li>
                    <li>• La metadata se indexa en Firestore</li>
                    <li>• Se detectan y omiten duplicados</li>
                    <li>• Proceso pausable y reanudable</li>
                    <li>• Reintentos automáticos en caso de error</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NBKDownloadEngine;