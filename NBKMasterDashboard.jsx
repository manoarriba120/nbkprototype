import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref as storageRef, getMetadata } from 'firebase/storage';
import { getFirestore, collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import {
  Home,
  Download,
  FileText,
  Calendar,
  Settings,
  Zap,
  Activity,
  Database,
  HardDrive,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  Menu,
  X,
  Bell,
  User,
  LogOut,
  Wifi,
  WifiOff,
  Clock,
  BarChart3,
  PieChart,
  Users,
  Building2,
  DollarSign,
  FileDown,
  Upload,
  Archive,
  Trash2,
  RefreshCw,
  Filter,
  Eye,
  PlayCircle,
  Command,
  Loader2,
  AlertTriangle,
  CheckSquare,
  Target,
  Gauge,
  Layers,
  Cloud,
  CloudOff,
  Save,
  Share2,
  ExternalLink
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
const auth = getAuth(app);
const storage = getStorage(app);
const firestore = getFirestore(app);

// Constants
const RFC = 'XAXX010101000';
const CACHE_VERSION = '1.0.0';
const STORAGE_LIMIT_GB = 10;

// IndexedDB Helper
class IndexedDBCache {
  constructor(dbName = 'nbk_cache', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'uuid' });
        }

        if (!db.objectStoreNames.contains('xmls')) {
          db.createObjectStore('xmls', { keyPath: 'uuid' });
        }

        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'id' });
        }
      };
    });
  }

  async get(storeName, key) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Utility Functions
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

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatDateTime = (dateString) => {
  return new Date(dateString).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Command Palette Component
const CommandPalette = ({ isOpen, onClose, onCommand }) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  const commands = [
    { id: 'quick_download', label: 'Descarga rápida (último mes)', icon: Download, category: 'Descargas' },
    { id: 'custom_download', label: 'Nueva descarga personalizada', icon: FileDown, category: 'Descargas' },
    { id: 'schedule_download', label: 'Programar descarga', icon: Calendar, category: 'Descargas' },
    { id: 'sync_now', label: 'Sincronizar ahora', icon: RefreshCw, category: 'Descargas' },
    { id: 'view_files', label: 'Ver archivos descargados', icon: FileText, category: 'Navegación' },
    { id: 'view_automation', label: 'Ver automatización', icon: Zap, category: 'Navegación' },
    { id: 'view_analytics', label: 'Ver análisis', icon: BarChart3, category: 'Navegación' },
    { id: 'export_month', label: 'Exportar mes actual', icon: Upload, category: 'Exportar' },
    { id: 'export_excel', label: 'Exportar a Excel', icon: FileDown, category: 'Exportar' },
    { id: 'backup', label: 'Crear respaldo', icon: Archive, category: 'Exportar' },
    { id: 'settings', label: 'Configuración', icon: Settings, category: 'Sistema' },
    { id: 'clear_cache', label: 'Limpiar caché', icon: Trash2, category: 'Sistema' }
  ];

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20 px-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar comando..."
              className="w-full pl-10 pr-4 py-3 border-0 focus:ring-0 text-lg"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {Object.entries(
            filteredCommands.reduce((acc, cmd) => {
              if (!acc[cmd.category]) acc[cmd.category] = [];
              acc[cmd.category].push(cmd);
              return acc;
            }, {})
          ).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                {category}
              </div>
              {cmds.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    onCommand(cmd.id);
                    onClose();
                  }}
                  className="w-full px-4 py-3 flex items-center hover:bg-gray-50 transition"
                >
                  <cmd.icon className="w-5 h-5 text-gray-400 mr-3" />
                  <span className="text-gray-900">{cmd.label}</span>
                </button>
              ))}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-2" />
              <p>No se encontraron comandos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
const NBKMasterDashboard = () => {
  // Navigation State
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // System State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [satConnected, setSatConnected] = useState(true);
  const [firebaseConnected, setFirebaseConnected] = useState(true);
  const [loading, setLoading] = useState(true);

  // Data State
  const [stats, setStats] = useState({
    totalXMLs: 0,
    storageUsed: 0,
    storageLimit: STORAGE_LIMIT_GB * 1024 * 1024 * 1024,
    lastSync: null,
    xmlsThisMonth: 0,
    totalAmount: 0,
    avgAmount: 0,
    downloadSpeed: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingSyncs, setUpcomingSyncs] = useState([]);
  const [systemHealth, setSystemHealth] = useState({
    sat: 'healthy',
    firebase: 'healthy',
    cache: 'healthy',
    errors: []
  });

  const [analytics, setAnalytics] = useState({
    topEmisores: [],
    topReceptores: [],
    monthlyTrend: [],
    typeDistribution: {}
  });

  // UI State
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Cache
  const cacheRef = useRef(new IndexedDBCache());

  // Initialize
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize IndexedDB
      await cacheRef.current.init();

      // Load cached data
      await loadCachedData();

      // Load fresh data
      await loadData();

      setLoading(false);
    } catch (error) {
      console.error('Initialization error:', error);
      setLoading(false);
    }
  };

  // Load data from cache
  const loadCachedData = async () => {
    try {
      const cachedStats = await cacheRef.current.get('stats', 'main');
      if (cachedStats) {
        setStats(cachedStats.data);
      }
    } catch (error) {
      console.error('Cache load error:', error);
    }
  };

  // Load fresh data
  const loadData = async () => {
    try {
      // Simulate loading data from Firestore
      const mockStats = {
        totalXMLs: 1247,
        storageUsed: 2.3 * 1024 * 1024 * 1024, // 2.3 GB
        storageLimit: STORAGE_LIMIT_GB * 1024 * 1024 * 1024,
        lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        xmlsThisMonth: 156,
        totalAmount: 2456789.50,
        avgAmount: 15723.65,
        downloadSpeed: 45.2
      };

      setStats(mockStats);

      // Cache the data
      await cacheRef.current.put('stats', {
        id: 'main',
        data: mockStats,
        timestamp: Date.now()
      });

      // Load recent activity
      setRecentActivity([
        { id: 1, type: 'download', description: 'Descargados 45 XMLs de Enero 2024', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
        { id: 2, type: 'sync', description: 'Sincronización automática completada', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { id: 3, type: 'export', description: 'Exportación a Excel generada', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() }
      ]);

      // Load upcoming syncs
      setUpcomingSyncs([
        { id: 1, name: 'Sync Diario', nextRun: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() },
        { id: 2, name: 'Backup Semanal', nextRun: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() }
      ]);

      // Load analytics
      setAnalytics({
        topEmisores: [
          { rfc: 'ABC123456789', nombre: 'Proveedor Principal SA', total: 456789.50, count: 234 },
          { rfc: 'DEF987654321', nombre: 'Servicios Corporativos', total: 234567.80, count: 156 },
          { rfc: 'GHI456789123', nombre: 'Distribuidora XYZ', total: 178945.30, count: 98 }
        ],
        topReceptores: [
          { rfc: 'JKL789456123', nombre: 'Cliente Mayor SA', total: 678945.20, count: 345 },
          { rfc: 'MNO321654987', nombre: 'Empresa Asociada', total: 456123.50, count: 234 }
        ],
        monthlyTrend: [
          { month: 'Ene', amount: 234567, count: 145 },
          { month: 'Feb', amount: 345678, count: 178 },
          { month: 'Mar', amount: 456789, count: 203 }
        ],
        typeDistribution: {
          'Ingreso': 65,
          'Egreso': 25,
          'Traslado': 5,
          'Nómina': 3,
          'Pago': 2
        }
      });

    } catch (error) {
      console.error('Data load error:', error);
    }
  };

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }

      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowFloatingMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle commands
  const handleCommand = (commandId) => {
    switch (commandId) {
      case 'quick_download':
        addNotification('Iniciando descarga rápida...', 'info');
        break;
      case 'custom_download':
        setCurrentView('download');
        break;
      case 'schedule_download':
        setCurrentView('automation');
        break;
      case 'sync_now':
        handleSyncNow();
        break;
      case 'view_files':
        setCurrentView('files');
        break;
      case 'view_automation':
        setCurrentView('automation');
        break;
      case 'view_analytics':
        setCurrentView('analytics');
        break;
      case 'export_month':
        handleExportMonth();
        break;
      case 'export_excel':
        handleExportExcel();
        break;
      case 'backup':
        handleBackup();
        break;
      case 'settings':
        setCurrentView('settings');
        break;
      case 'clear_cache':
        handleClearCache();
        break;
      default:
        break;
    }
  };

  // Actions
  const handleSyncNow = () => {
    addNotification('Sincronización iniciada', 'success');
    // Simulate sync
    setTimeout(() => {
      addNotification('Sincronización completada - 23 XMLs nuevos', 'success');
      loadData();
    }, 3000);
  };

  const handleExportMonth = () => {
    addNotification('Generando reporte mensual...', 'info');
    setTimeout(() => {
      addNotification('Reporte descargado exitosamente', 'success');
    }, 2000);
  };

  const handleExportExcel = () => {
    addNotification('Exportando a Excel...', 'info');
    setTimeout(() => {
      addNotification('Excel generado exitosamente', 'success');
    }, 2000);
  };

  const handleBackup = () => {
    addNotification('Creando respaldo completo...', 'info');
    setTimeout(() => {
      addNotification('Respaldo completado - 2.3 GB', 'success');
    }, 3000);
  };

  const handleClearCache = async () => {
    try {
      await cacheRef.current.clear('metadata');
      await cacheRef.current.clear('xmls');
      addNotification('Caché limpiado exitosamente', 'success');
    } catch (error) {
      addNotification('Error al limpiar caché', 'error');
    }
  };

  const addNotification = (message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [notification, ...prev].slice(0, 5));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando NBK...</p>
        </div>
      </div>
    );
  }

  const storagePercentage = (stats.storageUsed / stats.storageLimit) * 100;

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            {sidebarOpen ? (
              <>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="ml-2 font-bold text-gray-900">NBK</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1 hover:bg-gray-100 rounded mx-auto"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {[
              { id: 'dashboard', icon: Home, label: 'Dashboard' },
              { id: 'download', icon: Download, label: 'Descargas' },
              { id: 'files', icon: FileText, label: 'Archivos' },
              { id: 'automation', icon: Zap, label: 'Automatización' },
              { id: 'analytics', icon: BarChart3, label: 'Análisis' },
              { id: 'settings', icon: Settings, label: 'Configuración' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center px-3 py-2 rounded-lg transition ${
                  currentView === item.id
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {sidebarOpen && <span className="ml-3">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* User */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              {sidebarOpen && (
                <div className="ml-3 flex-1">
                  <div className="text-sm font-semibold text-gray-900">Admin</div>
                  <div className="text-xs text-gray-500">{RFC}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">
              {currentView === 'dashboard' && 'Dashboard Ejecutivo'}
              {currentView === 'download' && 'Centro de Descargas'}
              {currentView === 'files' && 'Gestor de Archivos'}
              {currentView === 'automation' && 'Automatización'}
              {currentView === 'analytics' && 'Análisis y Reportes'}
              {currentView === 'settings' && 'Configuración'}
            </h1>

            {/* Online/Offline Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  Offline
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Command Palette Button */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
            >
              <Command className="w-4 h-4" />
              <span className="hidden md:inline">Comandos</span>
              <kbd className="hidden md:inline px-2 py-1 bg-white rounded text-xs">⌘K</kbd>
            </button>

            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition">
              <Bell className="w-5 h-5 text-gray-600" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={loadData}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </header>

        {/* Notifications Toast */}
        <div className="fixed top-20 right-6 z-40 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-lg shadow-lg border-l-4 p-4 flex items-start gap-3 animate-slide-in ${
                notification.type === 'success' ? 'border-green-500' :
                notification.type === 'error' ? 'border-red-500' :
                notification.type === 'warning' ? 'border-yellow-500' :
                'border-blue-500'
              }`}
            >
              {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
              {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
              {notification.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
              {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{notification.message}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {currentView === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <FileText className="w-10 h-10 opacity-80" />
                    <TrendingUp className="w-6 h-6 opacity-60" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{stats.totalXMLs.toLocaleString()}</div>
                  <div className="text-indigo-100 text-sm">XMLs Almacenados</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <DollarSign className="w-10 h-10 opacity-80" />
                    <BarChart3 className="w-6 h-6 opacity-60" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{formatCurrency(stats.totalAmount)}</div>
                  <div className="text-green-100 text-sm">Total Facturado</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <Calendar className="w-10 h-10 opacity-80" />
                    <CheckCircle2 className="w-6 h-6 opacity-60" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{stats.xmlsThisMonth}</div>
                  <div className="text-purple-100 text-sm">XMLs Este Mes</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <HardDrive className="w-10 h-10 opacity-80" />
                    <Database className="w-6 h-6 opacity-60" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{formatBytes(stats.storageUsed)}</div>
                  <div className="text-orange-100 text-sm">Almacenamiento</div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* System Health */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-indigo-600" />
                      Salud del Sistema
                    </h2>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${satConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <div className="font-medium text-gray-900">Conexión SAT</div>
                            <div className="text-sm text-gray-500">
                              {satConnected ? 'Conectado y activo' : 'Desconectado'}
                            </div>
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${firebaseConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <div className="font-medium text-gray-900">Firebase Storage</div>
                            <div className="text-sm text-gray-500">
                              {firebaseConnected ? 'Operativo' : 'Inactivo'}
                            </div>
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-3" />
                          <div>
                            <div className="font-medium text-gray-900">Última Sincronización</div>
                            <div className="text-sm text-gray-500">
                              {formatDateTime(stats.lastSync)}
                            </div>
                          </div>
                        </div>
                        <Clock className="w-5 h-5 text-gray-400" />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-3" />
                          <div>
                            <div className="font-medium text-gray-900">Velocidad de Descarga</div>
                            <div className="text-sm text-gray-500">
                              {stats.downloadSpeed} XMLs/minuto
                            </div>
                          </div>
                        </div>
                        <Gauge className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Storage Widget */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                        <HardDrive className="w-5 h-5 mr-2 text-indigo-600" />
                        Almacenamiento
                      </h2>
                      <span className="text-sm text-gray-500">
                        {formatBytes(stats.storageUsed)} / {formatBytes(stats.storageLimit)}
                      </span>
                    </div>

                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-4 rounded-full transition-all duration-500 ${
                            storagePercentage > 80 ? 'bg-red-500' :
                            storagePercentage > 60 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${storagePercentage}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-gray-600">
                          {Math.round(storagePercentage)}% usado
                        </span>
                        <span className="text-gray-600">
                          {formatBytes(stats.storageLimit - stats.storageUsed)} disponibles
                        </span>
                      </div>
                    </div>

                    {storagePercentage > 80 && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-700 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Almacenamiento casi lleno. Considera aumentar el límite o eliminar XMLs antiguos.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Top Emisores */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Users className="w-5 h-5 mr-2 text-indigo-600" />
                      Principales Emisores
                    </h2>

                    <div className="space-y-3">
                      {analytics.topEmisores.map((emisor, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{emisor.nombre}</div>
                            <div className="text-sm text-gray-500 font-mono">{emisor.rfc}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">{formatCurrency(emisor.total)}</div>
                            <div className="text-sm text-gray-500">{emisor.count} CFDIs</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Recent Activity */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-indigo-600" />
                      Actividad Reciente
                    </h2>

                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0">
                            {activity.type === 'download' && <Download className="w-5 h-5 text-blue-600" />}
                            {activity.type === 'sync' && <RefreshCw className="w-5 h-5 text-green-600" />}
                            {activity.type === 'export' && <Upload className="w-5 h-5 text-purple-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{activity.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDateTime(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming Syncs */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                      Próximas Sincronizaciones
                    </h2>

                    <div className="space-y-3">
                      {upcomingSyncs.map((sync) => (
                        <div key={sync.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{sync.name}</div>
                            <div className="text-sm text-gray-500">
                              {formatDateTime(sync.nextRun)}
                            </div>
                          </div>
                          <Clock className="w-5 h-5 text-gray-400" />
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentView('automation')}
                      className="w-full mt-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg font-medium transition"
                    >
                      Ver Todas
                    </button>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-indigo-600" />
                      Acciones Rápidas
                    </h2>

                    <div className="space-y-2">
                      <button
                        onClick={() => handleCommand('sync_now')}
                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center justify-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sincronizar Ahora
                      </button>

                      <button
                        onClick={() => handleCommand('export_month')}
                        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center justify-center"
                      >
                        <FileDown className="w-4 h-4 mr-2" />
                        Exportar Mes
                      </button>

                      <button
                        onClick={() => handleCommand('backup')}
                        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center justify-center"
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Crear Backup
                      </button>

                      <button
                        onClick={() => setCurrentView('analytics')}
                        className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition flex items-center justify-center"
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Ver Análisis
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView !== 'dashboard' && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {currentView === 'download' && <Download className="w-8 h-8 text-gray-400" />}
                  {currentView === 'files' && <FileText className="w-8 h-8 text-gray-400" />}
                  {currentView === 'automation' && <Zap className="w-8 h-8 text-gray-400" />}
                  {currentView === 'analytics' && <BarChart3 className="w-8 h-8 text-gray-400" />}
                  {currentView === 'settings' && <Settings className="w-8 h-8 text-gray-400" />}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {currentView === 'download' && 'Centro de Descargas'}
                  {currentView === 'files' && 'Gestor de Archivos'}
                  {currentView === 'automation' && 'Automatización'}
                  {currentView === 'analytics' && 'Análisis y Reportes'}
                  {currentView === 'settings' && 'Configuración'}
                </h3>
                <p className="text-gray-600 mb-6">
                  Esta vista integraría el componente correspondiente del sistema.
                </p>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition"
                >
                  Volver al Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-30">
        {showFloatingMenu && (
          <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl p-2 space-y-1 min-w-[200px]">
            <button
              onClick={() => {
                handleCommand('quick_download');
                setShowFloatingMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition flex items-center"
            >
              <Download className="w-5 h-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-900">Descarga rápida</span>
            </button>
            <button
              onClick={() => {
                handleCommand('custom_download');
                setShowFloatingMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition flex items-center"
            >
              <FileDown className="w-5 h-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-900">Descarga personalizada</span>
            </button>
            <button
              onClick={() => {
                handleCommand('schedule_download');
                setShowFloatingMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition flex items-center"
            >
              <Calendar className="w-5 h-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-900">Programar descarga</span>
            </button>
            <button
              onClick={() => {
                handleCommand('sync_now');
                setShowFloatingMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition flex items-center"
            >
              <RefreshCw className="w-5 h-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-900">Sincronizar ahora</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setShowFloatingMenu(!showFloatingMenu)}
          className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        >
          {showFloatingMenu ? (
            <X className="w-6 h-6" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onCommand={handleCommand}
      />
    </div>
  );
};

export default NBKMasterDashboard;