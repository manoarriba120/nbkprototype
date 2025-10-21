import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getStorage, ref, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, orderBy, limit, startAfter } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Grid3x3,
  List,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  User,
  Building2,
  Copy,
  ExternalLink,
  CheckSquare,
  Square,
  X,
  Archive,
  FileDown,
  BarChart3,
  Folder,
  FolderOpen,
  Clock,
  HardDrive,
  TrendingUp,
  RefreshCw,
  Save,
  Settings,
  Code,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2
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

const app = initializeApp(__firebase_config);
const storage = getStorage(app);
const firestore = getFirestore(app);

// Constants
const ITEMS_PER_PAGE = 50;
const RFC = 'XAXX010101000'; // Replace with actual RFC from context

// Utility Functions
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const getComprobanteTypeLabel = (tipo) => {
  const types = {
    'I': 'Ingreso',
    'E': 'Egreso',
    'T': 'Traslado',
    'N': 'Nómina',
    'P': 'Pago'
  };
  return types[tipo] || tipo;
};

const getComprobanteColor = (tipo) => {
  const colors = {
    'I': 'bg-green-100 text-green-700',
    'E': 'bg-red-100 text-red-700',
    'T': 'bg-blue-100 text-blue-700',
    'N': 'bg-purple-100 text-purple-700',
    'P': 'bg-yellow-100 text-yellow-700'
  };
  return colors[tipo] || 'bg-gray-100 text-gray-700';
};

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// XML Formatter Component
const XMLViewer = ({ xmlContent, metadata, onClose }) => {
  const [activeTab, setActiveTab] = useState('formatted');
  const [formattedXML, setFormattedXML] = useState('');

  useEffect(() => {
    // Format XML for display
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      const serializer = new XMLSerializer();
      let formatted = serializer.serializeToString(xmlDoc);

      // Add indentation
      formatted = formatted.replace(/></g, '>\n<');
      setFormattedXML(formatted);
    } catch (error) {
      setFormattedXML(xmlContent);
    }
  }, [xmlContent]);

  const verifyInSAT = () => {
    const url = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${metadata.uuid}&re=${metadata.rfcEmisor}&rr=${metadata.rfcReceptor}&tt=${metadata.total.toFixed(6)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Visor de CFDI</h2>
            <p className="text-sm text-gray-600 font-mono mt-1">{metadata.uuid}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('formatted')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
              activeTab === 'formatted'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Code className="w-4 h-4 inline mr-2" />
            XML Formateado
          </button>
          <button
            onClick={() => setActiveTab('structured')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
              activeTab === 'structured'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 inline mr-2" />
            Vista Estructurada
          </button>
          <button
            onClick={() => setActiveTab('fiscal')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
              activeTab === 'fiscal'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Datos Fiscales
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'formatted' && (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono">
              {formattedXML}
            </pre>
          )}

          {activeTab === 'structured' && (
            <div className="space-y-6">
              {/* Comprobante Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Información del Comprobante</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Serie:</span>
                    <span className="ml-2 font-semibold">{metadata.serie || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Folio:</span>
                    <span className="ml-2 font-semibold">{metadata.folio || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fecha:</span>
                    <span className="ml-2 font-semibold">{formatDate(metadata.fecha)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Tipo:</span>
                    <span className="ml-2 font-semibold">{getComprobanteTypeLabel(metadata.tipoComprobante)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Método de Pago:</span>
                    <span className="ml-2 font-semibold">{metadata.metodoPago || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Forma de Pago:</span>
                    <span className="ml-2 font-semibold">{metadata.formaPago || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Emisor */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Emisor</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">RFC:</span>
                    <span className="ml-2 font-mono font-semibold">{metadata.rfcEmisor}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Nombre:</span>
                    <span className="ml-2 font-semibold">{metadata.nombreEmisor}</span>
                  </div>
                </div>
              </div>

              {/* Receptor */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Receptor</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">RFC:</span>
                    <span className="ml-2 font-mono font-semibold">{metadata.rfcReceptor}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Nombre:</span>
                    <span className="ml-2 font-semibold">{metadata.nombreReceptor}</span>
                  </div>
                </div>
              </div>

              {/* Montos */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Importes</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold">{formatCurrency(metadata.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-indigo-600">{formatCurrency(metadata.total)}</span>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    Moneda: {metadata.moneda}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fiscal' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">UUID del Comprobante</h3>
                <div className="flex items-center justify-between bg-white p-3 rounded border border-blue-300">
                  <code className="text-sm font-mono text-gray-900">{metadata.uuid}</code>
                  <button
                    onClick={() => copyToClipboard(metadata.uuid)}
                    className="ml-2 p-2 hover:bg-gray-100 rounded transition"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Información de Descarga</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Fecha de descarga:</span>
                    <span className="ml-2 font-semibold">{formatDate(metadata.fechaDescarga)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Ruta en Storage:</span>
                    <span className="ml-2 font-mono text-xs">{metadata.storagePath}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={verifyInSAT}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition flex items-center justify-center"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Verificar en Portal del SAT
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={() => copyToClipboard(metadata.uuid)}
            className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition flex items-center justify-center"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copiar UUID
          </button>
          <button
            onClick={verifyInSAT}
            className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center justify-center"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Verificar
          </button>
        </div>
      </div>
    </div>
  );
};

// File Manager Component
const NBKFileManager = () => {
  // View State
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [showFilters, setShowFilters] = useState(true);

  // Data State
  const [cfdiList, setCfdiList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    searchTerm: '',
    dateFrom: '',
    dateTo: '',
    comprobanteTipo: '',
    amountFrom: '',
    amountTo: '',
    status: ''
  });

  // Folder Navigation
  const [currentFolder, setCurrentFolder] = useState({ year: null, month: null });

  // Statistics
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    currentMonthFiles: 0,
    lastSync: null
  });

  // Modal State
  const [viewingXML, setViewingXML] = useState(null);
  const [xmlContent, setXmlContent] = useState('');

  // Saved Filters
  const [savedFilters, setSavedFilters] = useState([]);
  const [filterName, setFilterName] = useState('');

  // Load CFDIs from Firestore
  const loadCFDIs = useCallback(async (page = 1) => {
    setLoading(true);

    try {
      let q = query(
        collection(firestore, 'cfdi_metadata'),
        where('rfc', '==', RFC),
        orderBy('fecha', 'desc'),
        limit(ITEMS_PER_PAGE)
      );

      // Apply filters
      if (filters.dateFrom) {
        q = query(q, where('fecha', '>=', filters.dateFrom));
      }
      if (filters.dateTo) {
        q = query(q, where('fecha', '<=', filters.dateTo));
      }
      if (filters.comprobanteTipo) {
        q = query(q, where('tipoComprobante', '==', filters.comprobanteTipo));
      }

      // Pagination
      if (page > 1 && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const querySnapshot = await getDocs(q);
      const docs = [];

      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });

      // Apply client-side filters
      let filteredDocs = docs;

      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        filteredDocs = filteredDocs.filter(doc =>
          doc.uuid.toLowerCase().includes(search) ||
          doc.rfcEmisor.toLowerCase().includes(search) ||
          doc.rfcReceptor.toLowerCase().includes(search) ||
          doc.nombreEmisor?.toLowerCase().includes(search) ||
          doc.nombreReceptor?.toLowerCase().includes(search)
        );
      }

      if (filters.amountFrom) {
        filteredDocs = filteredDocs.filter(doc => doc.total >= parseFloat(filters.amountFrom));
      }

      if (filters.amountTo) {
        filteredDocs = filteredDocs.filter(doc => doc.total <= parseFloat(filters.amountTo));
      }

      setCfdiList(filteredDocs);
      setTotalItems(filteredDocs.length);

      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }

      // Update stats
      updateStats(filteredDocs);

    } catch (error) {
      console.error('Error loading CFDIs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, lastVisible]);

  // Update statistics
  const updateStats = (docs) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const currentMonthDocs = docs.filter(doc => {
      const docDate = new Date(doc.fecha);
      return docDate.getMonth() === currentMonth && docDate.getFullYear() === currentYear;
    });

    setStats({
      totalFiles: docs.length,
      totalSize: docs.reduce((sum, doc) => sum + (doc.size || 5000), 0),
      currentMonthFiles: currentMonthDocs.length,
      lastSync: new Date().toISOString()
    });
  };

  // Initial load
  useEffect(() => {
    loadCFDIs();
  }, []);

  // Reload when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadCFDIs(1);
      setCurrentPage(1);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  // Selection handlers
  const toggleSelection = (uuid) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(uuid)) {
      newSelection.delete(uuid);
    } else {
      newSelection.add(uuid);
    }
    setSelectedItems(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === cfdiList.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(cfdiList.map(item => item.uuid)));
    }
  };

  // Download single XML
  const downloadXML = async (cfdi) => {
    try {
      const storageRef = ref(storage, cfdi.storagePath);
      const url = await getDownloadURL(storageRef);

      const response = await fetch(url);
      const blob = await response.blob();

      downloadBlob(blob, `${cfdi.uuid}.xml`);
    } catch (error) {
      console.error('Error downloading XML:', error);
      alert('Error al descargar el XML');
    }
  };

  // View XML
  const viewXML = async (cfdi) => {
    try {
      const storageRef = ref(storage, cfdi.storagePath);
      const url = await getDownloadURL(storageRef);

      const response = await fetch(url);
      const text = await response.text();

      setXmlContent(text);
      setViewingXML(cfdi);
    } catch (error) {
      console.error('Error loading XML:', error);
      alert('Error al cargar el XML');
    }
  };

  // Delete single XML
  const deleteXML = async (cfdi) => {
    if (!confirm(`¿Eliminar el CFDI ${cfdi.uuid}?`)) return;

    try {
      // Delete from Storage
      const storageRef = ref(storage, cfdi.storagePath);
      await deleteObject(storageRef);

      // Delete from Firestore
      await deleteDoc(doc(firestore, 'cfdi_metadata', cfdi.id));

      // Refresh list
      loadCFDIs(currentPage);

      alert('CFDI eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting XML:', error);
      alert('Error al eliminar el CFDI');
    }
  };

  // Download selected as ZIP (simulated)
  const downloadSelectedAsZIP = async () => {
    if (selectedItems.size === 0) {
      alert('No hay archivos seleccionados');
      return;
    }

    alert(`Descargando ${selectedItems.size} archivos como ZIP (funcionalidad simulada)`);
    // In real implementation, use JSZip library
  };

  // Export to Excel
  const exportToExcel = () => {
    const selectedCFDIs = cfdiList.filter(cfdi => selectedItems.has(cfdi.uuid));

    if (selectedCFDIs.length === 0) {
      alert('No hay archivos seleccionados');
      return;
    }

    // Create CSV
    const headers = ['UUID', 'Fecha', 'RFC Emisor', 'Nombre Emisor', 'RFC Receptor', 'Nombre Receptor', 'Tipo', 'Total', 'Moneda'];
    const rows = selectedCFDIs.map(cfdi => [
      cfdi.uuid,
      cfdi.fecha,
      cfdi.rfcEmisor,
      cfdi.nombreEmisor || '',
      cfdi.rfcReceptor,
      cfdi.nombreReceptor || '',
      getComprobanteTypeLabel(cfdi.tipoComprobante),
      cfdi.total,
      cfdi.moneda
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    downloadBlob(blob, `cfdi_export_${Date.now()}.csv`);
  };

  // Delete selected
  const deleteSelected = async () => {
    if (selectedItems.size === 0) {
      alert('No hay archivos seleccionados');
      return;
    }

    if (!confirm(`¿Eliminar ${selectedItems.size} CFDIs seleccionados?`)) return;

    const selectedCFDIs = cfdiList.filter(cfdi => selectedItems.has(cfdi.uuid));

    try {
      await Promise.all(selectedCFDIs.map(async (cfdi) => {
        const storageRef = ref(storage, cfdi.storagePath);
        await deleteObject(storageRef);
        await deleteDoc(doc(firestore, 'cfdi_metadata', cfdi.id));
      }));

      setSelectedItems(new Set());
      loadCFDIs(currentPage);

      alert('CFDIs eliminados exitosamente');
    } catch (error) {
      console.error('Error deleting CFDIs:', error);
      alert('Error al eliminar algunos CFDIs');
    }
  };

  // Save current filter
  const saveCurrentFilter = () => {
    if (!filterName) {
      alert('Ingresa un nombre para el filtro');
      return;
    }

    const newFilter = {
      name: filterName,
      filters: { ...filters }
    };

    setSavedFilters([...savedFilters, newFilter]);
    setFilterName('');

    // Save to localStorage
    localStorage.setItem('nbk_saved_filters', JSON.stringify([...savedFilters, newFilter]));
  };

  // Load saved filters on mount
  useEffect(() => {
    const saved = localStorage.getItem('nbk_saved_filters');
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  // Apply saved filter
  const applySavedFilter = (savedFilter) => {
    setFilters(savedFilter.filters);
  };

  // Pagination
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      loadCFDIs(page);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Folder className="w-7 h-7 mr-3 text-indigo-600" />
                Gestor de CFDI
              </h1>
              <p className="text-sm text-gray-600 mt-1">Administra tus comprobantes fiscales digitales</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => loadCFDIs(currentPage)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition flex items-center"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>

              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded transition ${
                    viewMode === 'table'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition ${
                    viewMode === 'grid'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-indigo-600 font-medium">Total de XMLs</div>
                  <div className="text-2xl font-bold text-indigo-900 mt-1">{stats.totalFiles}</div>
                </div>
                <FileText className="w-10 h-10 text-indigo-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-green-600 font-medium">Espacio usado</div>
                  <div className="text-2xl font-bold text-green-900 mt-1">{formatBytes(stats.totalSize)}</div>
                </div>
                <HardDrive className="w-10 h-10 text-green-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-600 font-medium">Este mes</div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">{stats.currentMonthFiles}</div>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-400" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-purple-600 font-medium">Última sincronización</div>
                  <div className="text-sm font-semibold text-purple-900 mt-1">
                    {stats.lastSync ? formatDate(stats.lastSync) : 'N/A'}
                  </div>
                </div>
                <Clock className="w-10 h-10 text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="w-80 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Filter className="w-5 h-5 mr-2 text-indigo-600" />
                    Filtros
                  </h3>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-1 hover:bg-gray-100 rounded transition"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Buscar
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={filters.searchTerm}
                        onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                        placeholder="UUID, RFC, Nombre..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rango de Fechas
                    </label>
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* Comprobante Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Comprobante
                    </label>
                    <select
                      value={filters.comprobanteTipo}
                      onChange={(e) => setFilters({ ...filters, comprobanteTipo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="">Todos</option>
                      <option value="I">Ingreso</option>
                      <option value="E">Egreso</option>
                      <option value="T">Traslado</option>
                      <option value="N">Nómina</option>
                      <option value="P">Pago</option>
                    </select>
                  </div>

                  {/* Amount Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rango de Montos
                    </label>
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={filters.amountFrom}
                        onChange={(e) => setFilters({ ...filters, amountFrom: e.target.value })}
                        placeholder="Desde"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <input
                        type="number"
                        value={filters.amountTo}
                        onChange={(e) => setFilters({ ...filters, amountTo: e.target.value })}
                        placeholder="Hasta"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* Clear Filters */}
                  <button
                    onClick={() => setFilters({
                      searchTerm: '',
                      dateFrom: '',
                      dateTo: '',
                      comprobanteTipo: '',
                      amountFrom: '',
                      amountTo: '',
                      status: ''
                    })}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition text-sm"
                  >
                    Limpiar Filtros
                  </button>

                  {/* Save Filter */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Guardar Filtro Actual
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        placeholder="Nombre del filtro"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <button
                        onClick={saveCurrentFilter}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Saved Filters */}
                  {savedFilters.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Filtros Guardados
                      </label>
                      <div className="space-y-2">
                        {savedFilters.map((filter, idx) => (
                          <button
                            key={idx}
                            onClick={() => applySavedFilter(filter)}
                            className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm text-left transition"
                          >
                            {filter.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1">
            {/* Bulk Actions Bar */}
            {selectedItems.size > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckSquare className="w-5 h-5 text-indigo-600 mr-3" />
                    <span className="text-sm font-semibold text-indigo-900">
                      {selectedItems.size} archivo(s) seleccionado(s)
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={downloadSelectedAsZIP}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition text-sm flex items-center"
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Descargar ZIP
                    </button>
                    <button
                      onClick={exportToExcel}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition text-sm flex items-center"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Exportar Excel
                    </button>
                    <button
                      onClick={deleteSelected}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition text-sm flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Show Filters Button */}
            {!showFilters && (
              <button
                onClick={() => setShowFilters(true)}
                className="mb-4 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition flex items-center"
              >
                <Filter className="w-4 h-4 mr-2" />
                Mostrar Filtros
              </button>
            )}

            {/* Content */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
              ) : cfdiList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <FileText className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">No se encontraron CFDIs</p>
                  <p className="text-gray-400 text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
                </div>
              ) : viewMode === 'table' ? (
                /* Table View */
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedItems.size === cfdiList.length}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">UUID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Emisor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Receptor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {cfdiList.map((cfdi) => (
                        <tr key={cfdi.uuid} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(cfdi.uuid)}
                              onChange={() => toggleSelection(cfdi.uuid)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="text-sm font-mono text-gray-900">
                                {cfdi.uuid.substring(0, 16)}...
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(cfdi.fecha)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{cfdi.rfcEmisor}</div>
                              <div className="text-gray-500 text-xs truncate max-w-xs">
                                {cfdi.nombreEmisor || 'N/A'}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{cfdi.rfcReceptor}</div>
                              <div className="text-gray-500 text-xs truncate max-w-xs">
                                {cfdi.nombreReceptor || 'N/A'}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            {formatCurrency(cfdi.total)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getComprobanteColor(cfdi.tipoComprobante)}`}>
                              {getComprobanteTypeLabel(cfdi.tipoComprobante)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => viewXML(cfdi)}
                                className="p-2 hover:bg-gray-100 rounded transition"
                                title="Ver XML"
                              >
                                <Eye className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                onClick={() => downloadXML(cfdi)}
                                className="p-2 hover:bg-gray-100 rounded transition"
                                title="Descargar"
                              >
                                <Download className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                onClick={() => copyToClipboard(cfdi.uuid)}
                                className="p-2 hover:bg-gray-100 rounded transition"
                                title="Copiar UUID"
                              >
                                <Copy className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                onClick={() => deleteXML(cfdi)}
                                className="p-2 hover:bg-red-50 rounded transition"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                  {cfdiList.map((cfdi) => (
                    <div
                      key={cfdi.uuid}
                      className={`bg-white border-2 rounded-lg p-4 hover:shadow-md transition cursor-pointer ${
                        selectedItems.has(cfdi.uuid) ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                      }`}
                      onClick={() => toggleSelection(cfdi.uuid)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2 rounded-lg ${getComprobanteColor(cfdi.tipoComprobante)}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedItems.has(cfdi.uuid)}
                          onChange={() => toggleSelection(cfdi.uuid)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">UUID</div>
                        <div className="text-xs font-mono text-gray-900 truncate">
                          {cfdi.uuid}
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center text-sm">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-gray-600">{formatDate(cfdi.fecha)}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="font-semibold text-gray-900">{formatCurrency(cfdi.total)}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-1 rounded-full ${getComprobanteColor(cfdi.tipoComprobante)}`}>
                            {getComprobanteTypeLabel(cfdi.tipoComprobante)}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewXML(cfdi);
                              }}
                              className="p-1 hover:bg-gray-100 rounded transition"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadXML(cfdi);
                              }}
                              className="p-1 hover:bg-gray-100 rounded transition"
                            >
                              <Download className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* XML Viewer Modal */}
      {viewingXML && (
        <XMLViewer
          xmlContent={xmlContent}
          metadata={viewingXML}
          onClose={() => {
            setViewingXML(null);
            setXmlContent('');
          }}
        />
      )}
    </div>
  );
};

export default NBKFileManager;