import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Grid3x3,
  List,
  AlertCircle,
  CheckCircle2,
  Clock,
  HardDrive,
  FileText,
  Settings,
  Star,
  Upload,
  Download,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Calendar,
  Shield,
  Lock,
  X,
  Save,
  ChevronDown,
  Filter,
  MoreVertical,
  Pause,
  Play,
  Archive,
  AlertTriangle,
  Users,
  Zap,
  Database,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import NBKAddCompanyModal from './NBKAddCompanyModal';

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
const firestore = getFirestore(app);
const storage = getStorage(app);

// ============================================================================
// ENCRYPTION UTILITIES (Web Crypto API)
// ============================================================================
class CryptoService {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
  }

  // Generate encryption key from password
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data
  async encrypt(data, password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);

    const encrypted = await crypto.subtle.encrypt(
      { name: this.algorithm, iv: iv },
      key,
      encoder.encode(data)
    );

    // Combine salt + iv + encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...result));
  }

  // Decrypt data
  async decrypt(encryptedData, password) {
    const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encrypted = data.slice(28);

    const key = await this.deriveKey(password, salt);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv: iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error('Decryption failed - incorrect password');
    }
  }
}

const cryptoService = new CryptoService();

// ============================================================================
// COMPANY CONTEXT & STATE MANAGEMENT
// ============================================================================
const CompanyContext = createContext();

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
};

export const CompanyProvider = ({ children }) => {
  const [empresas, setEmpresas] = useState([]);
  const [empresaActiva, setEmpresaActiva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Cache for recently accessed companies
  const empresasCache = useRef(new Map());

  // Load user and companies on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadEmpresas(user.uid);
      } else {
        setEmpresas([]);
        setEmpresaActiva(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load companies from Firestore
  const loadEmpresas = async (userId) => {
    try {
      const empresasRef = collection(firestore, 'empresas');
      const q = query(empresasRef, orderBy('razonSocial', 'asc'));
      const snapshot = await getDocs(q);

      const empresasData = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        empresasData.push({
          id: docSnap.id,
          ...data,
          // Don't load full data yet, lazy load on switch
          _cached: false
        });
      }

      setEmpresas(empresasData);

      // Auto-select first company or last active
      const lastActiveRFC = localStorage.getItem('nbk_last_active_rfc');
      if (lastActiveRFC) {
        const lastActive = empresasData.find(e => e.rfc === lastActiveRFC);
        if (lastActive) {
          await switchEmpresa(lastActive.rfc);
        } else if (empresasData.length > 0) {
          await switchEmpresa(empresasData[0].rfc);
        }
      } else if (empresasData.length > 0) {
        await switchEmpresa(empresasData[0].rfc);
      }

    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  // Switch active company
  const switchEmpresa = async (rfc) => {
    try {
      // Check cache first
      if (empresasCache.current.has(rfc)) {
        const cached = empresasCache.current.get(rfc);
        setEmpresaActiva(cached);
        localStorage.setItem('nbk_last_active_rfc', rfc);
        return cached;
      }

      // Load full company data
      const empresaRef = doc(firestore, 'empresas', rfc);
      const empresaSnap = await getDoc(empresaRef);

      if (!empresaSnap.exists()) {
        throw new Error('Company not found');
      }

      const empresaData = {
        id: empresaSnap.id,
        ...empresaSnap.data(),
        _cached: true
      };

      // Load company stats
      const stats = await loadEmpresaStats(rfc);
      empresaData.stats = stats;

      // Cache it
      empresasCache.current.set(rfc, empresaData);

      // Keep only last 3 in cache
      if (empresasCache.current.size > 3) {
        const firstKey = empresasCache.current.keys().next().value;
        empresasCache.current.delete(firstKey);
      }

      setEmpresaActiva(empresaData);
      localStorage.setItem('nbk_last_active_rfc', rfc);

      return empresaData;
    } catch (error) {
      console.error('Error switching company:', error);
      throw error;
    }
  };

  // Load company statistics
  const loadEmpresaStats = async (rfc) => {
    try {
      const metadataRef = collection(firestore, 'empresas', rfc, 'cfdi_metadata');
      const snapshot = await getDocs(metadataRef);

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      let totalXMLs = 0;
      let xmlsThisMonth = 0;
      let totalEmitidos = 0;
      let totalRecibidos = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        totalXMLs++;

        const fecha = new Date(data.fecha);
        if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) {
          xmlsThisMonth++;
        }

        // Determine if emitido or recibido based on RFC
        if (data.rfcEmisor === rfc) {
          totalEmitidos++;
        } else {
          totalRecibidos++;
        }
      });

      return {
        totalXMLs,
        xmlsThisMonth,
        totalEmitidos,
        totalRecibidos
      };
    } catch (error) {
      console.error('Error loading stats:', error);
      return {
        totalXMLs: 0,
        xmlsThisMonth: 0,
        totalEmitidos: 0,
        totalRecibidos: 0
      };
    }
  };

  // Add new company
  const addEmpresa = async (empresaData) => {
    try {
      const empresaRef = doc(firestore, 'empresas', empresaData.rfc);

      // Check if already exists
      const exists = await getDoc(empresaRef);
      if (exists.exists()) {
        throw new Error('Company with this RFC already exists');
      }

      // Encrypt FIEL password
      const masterPassword = prompt('Enter master password for encryption:');
      if (!masterPassword) throw new Error('Master password required');

      const encryptedPassword = await cryptoService.encrypt(
        empresaData.fielConfig.password,
        masterPassword
      );

      const newEmpresa = {
        ...empresaData,
        fielConfig: {
          ...empresaData.fielConfig,
          password: encryptedPassword
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(empresaRef, newEmpresa);

      // Reload companies
      await loadEmpresas(currentUser.uid);

      return newEmpresa;
    } catch (error) {
      console.error('Error adding company:', error);
      throw error;
    }
  };

  // Update company
  const updateEmpresa = async (rfc, updates) => {
    try {
      const empresaRef = doc(firestore, 'empresas', rfc);

      // If updating FIEL password, encrypt it
      if (updates.fielConfig?.password) {
        const masterPassword = prompt('Enter master password for encryption:');
        if (!masterPassword) throw new Error('Master password required');

        updates.fielConfig.password = await cryptoService.encrypt(
          updates.fielConfig.password,
          masterPassword
        );
      }

      await updateDoc(empresaRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      // Clear cache
      empresasCache.current.delete(rfc);

      // Reload
      await loadEmpresas(currentUser.uid);

      // If updating active company, reload it
      if (empresaActiva?.rfc === rfc) {
        await switchEmpresa(rfc);
      }

    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  };

  // Delete company
  const deleteEmpresa = async (rfc) => {
    try {
      // Delete from Firestore
      await deleteDoc(doc(firestore, 'empresas', rfc));

      // Clear cache
      empresasCache.current.delete(rfc);

      // Reload
      await loadEmpresas(currentUser.uid);

      // If deleting active company, switch to another
      if (empresaActiva?.rfc === rfc) {
        if (empresas.length > 1) {
          const nextEmpresa = empresas.find(e => e.rfc !== rfc);
          if (nextEmpresa) {
            await switchEmpresa(nextEmpresa.rfc);
          }
        } else {
          setEmpresaActiva(null);
        }
      }

    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  };

  // Toggle favorite
  const toggleFavorite = async (rfc) => {
    try {
      const empresa = empresas.find(e => e.rfc === rfc);
      await updateEmpresa(rfc, {
        isFavorite: !empresa.isFavorite
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Reload companies
  const reloadEmpresas = async () => {
    if (currentUser) {
      empresasCache.current.clear();
      await loadEmpresas(currentUser.uid);
    }
  };

  const value = {
    empresas,
    empresaActiva,
    loading,
    switchEmpresa,
    addEmpresa,
    updateEmpresa,
    deleteEmpresa,
    toggleFavorite,
    reloadEmpresas
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getStatusBadge = (empresa) => {
  // Check FIEL expiration
  if (empresa.fielConfig?.expirationDate) {
    const daysUntilExpiry = Math.floor(
      (new Date(empresa.fielConfig.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      return { label: 'FIEL Expirada', color: 'red', icon: XCircle };
    } else if (daysUntilExpiry <= 30) {
      return { label: 'FIEL por vencer', color: 'yellow', icon: AlertTriangle };
    }
  }

  // Check storage
  if (empresa.storage) {
    const percentage = (empresa.storage.used / empresa.storage.limit) * 100;
    if (percentage > 90) {
      return { label: 'Storage lleno', color: 'red', icon: AlertCircle };
    } else if (percentage > 80) {
      return { label: 'Storage alto', color: 'yellow', icon: AlertCircle };
    }
  }

  if (empresa.status === 'suspended') {
    return { label: 'Suspendida', color: 'gray', icon: Pause };
  }

  return { label: 'Activa', color: 'green', icon: CheckCircle2 };
};

// ============================================================================
// COMPANY MANAGER COMPONENT
// ============================================================================
export const CompanyManager = () => {
  const { empresas, empresaActiva, switchEmpresa, updateEmpresa, deleteEmpresa, toggleFavorite, reloadEmpresas } = useCompany();

  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'suspended', 'expiring'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [showComparative, setShowComparative] = useState(false);
  const [compareEmpresas, setCompareEmpresas] = useState([]);

  // Filtered and sorted companies
  const filteredEmpresas = empresas.filter(empresa => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matches =
        empresa.rfc.toLowerCase().includes(search) ||
        empresa.razonSocial?.toLowerCase().includes(search) ||
        empresa.nombreCorto?.toLowerCase().includes(search);

      if (!matches) return false;
    }

    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'active' && empresa.status !== 'active') return false;
      if (filterStatus === 'suspended' && empresa.status !== 'suspended') return false;
      if (filterStatus === 'expiring') {
        const daysUntilExpiry = Math.floor(
          (new Date(empresa.fielConfig?.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilExpiry > 30 || daysUntilExpiry < 0) return false;
      }
    }

    return true;
  });

  // Sort: favorites first, then by name
  const sortedEmpresas = [...filteredEmpresas].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return (a.razonSocial || '').localeCompare(b.razonSocial || '');
  });

  const handleViewDetails = (empresa) => {
    setSelectedEmpresa(empresa);
    setShowDetailModal(true);
  };

  const handleDelete = async (rfc) => {
    if (confirm('¿Estás seguro de eliminar esta empresa? Esta acción no se puede deshacer.')) {
      try {
        await deleteEmpresa(rfc);
        alert('Empresa eliminada exitosamente');
      } catch (error) {
        alert('Error al eliminar empresa: ' + error.message);
      }
    }
  };

  const handleTogglePause = async (empresa) => {
    try {
      const newStatus = empresa.status === 'active' ? 'suspended' : 'active';
      await updateEmpresa(empresa.rfc, { status: newStatus });
    } catch (error) {
      alert('Error al cambiar estado: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestión de Empresas</h1>
              <p className="text-gray-600 mt-1">
                Administra las empresas y sus configuraciones
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowComparative(!showComparative)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Comparativa
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Empresa
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Total Empresas</div>
                  <div className="text-2xl font-bold text-gray-900">{empresas.length}</div>
                </div>
                <Building2 className="w-10 h-10 text-indigo-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Activas</div>
                  <div className="text-2xl font-bold text-green-600">
                    {empresas.filter(e => e.status === 'active').length}
                  </div>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Total XMLs</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {empresas.reduce((sum, e) => sum + (e.stats?.totalXMLs || 0), 0).toLocaleString()}
                  </div>
                </div>
                <FileText className="w-10 h-10 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Storage Total</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatBytes(empresas.reduce((sum, e) => sum + (e.storage?.used || 0), 0))}
                  </div>
                </div>
                <HardDrive className="w-10 h-10 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por RFC o razón social..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="suspended">Suspendidas</option>
                <option value="expiring">FIEL por vencer</option>
              </select>

              {/* View Mode */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded transition ${
                    viewMode === 'grid'
                      ? 'bg-white text-indigo-600 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded transition ${
                    viewMode === 'list'
                      ? 'bg-white text-indigo-600 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={reloadEmpresas}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {sortedEmpresas.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No se encontraron empresas
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterStatus !== 'all'
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Comienza agregando tu primera empresa'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition"
              >
                Agregar Primera Empresa
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedEmpresas.map((empresa) => {
              const status = getStatusBadge(empresa);
              const StatusIcon = status.icon;
              const isActive = empresaActiva?.rfc === empresa.rfc;

              return (
                <div
                  key={empresa.rfc}
                  className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition overflow-hidden ${
                    isActive ? 'ring-2 ring-indigo-600' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 relative">
                    {empresa.isFavorite && (
                      <Star className="absolute top-3 right-3 w-5 h-5 text-yellow-300 fill-yellow-300" />
                    )}
                    {isActive && (
                      <div className="absolute top-3 left-3 px-2 py-1 bg-white/20 backdrop-blur rounded text-xs text-white font-semibold">
                        ACTIVA
                      </div>
                    )}
                    <div className="flex items-center justify-center mb-4">
                      {empresa.logo ? (
                        <img src={empresa.logo} alt={empresa.nombreCorto} className="w-16 h-16 rounded-full bg-white p-2" />
                      ) : (
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-indigo-600" />
                        </div>
                      )}
                    </div>
                    <h3 className="text-white text-center font-bold text-lg mb-1">
                      {empresa.nombreCorto || empresa.razonSocial}
                    </h3>
                    <p className="text-indigo-100 text-center text-sm font-mono">
                      {empresa.rfc}
                    </p>
                  </div>

                  {/* Body */}
                  <div className="p-6">
                    {/* Status Badge */}
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                      status.color === 'green' ? 'bg-green-100 text-green-700' :
                      status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                      status.color === 'red' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">
                          {empresa.stats?.totalXMLs?.toLocaleString() || '0'}
                        </div>
                        <div className="text-xs text-gray-600">XMLs</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatBytes(empresa.storage?.used || 0)}
                        </div>
                        <div className="text-xs text-gray-600">Storage</div>
                      </div>
                    </div>

                    {/* Storage Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Almacenamiento</span>
                        <span>
                          {Math.round((empresa.storage?.used || 0) / (empresa.storage?.limit || 1) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            ((empresa.storage?.used || 0) / (empresa.storage?.limit || 1)) > 0.8
                              ? 'bg-red-500'
                              : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min(((empresa.storage?.used || 0) / (empresa.storage?.limit || 1)) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>

                    {/* Last Sync */}
                    <div className="flex items-center text-sm text-gray-600 mb-4">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Última sync: {formatDate(empresa.storage?.lastSync)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => switchEmpresa(empresa.rfc)}
                        disabled={isActive}
                        className={`flex-1 py-2 px-3 rounded-lg font-medium transition text-sm ${
                          isActive
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {isActive ? 'Activa' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleViewDetails(empresa)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => toggleFavorite(empresa.rfc)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                      >
                        <Star className={`w-4 h-4 ${empresa.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Empresa</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">RFC</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">XMLs</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Storage</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Última Sync</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedEmpresas.map((empresa) => {
                  const status = getStatusBadge(empresa);
                  const StatusIcon = status.icon;
                  const isActive = empresaActiva?.rfc === empresa.rfc;

                  return (
                    <tr key={empresa.rfc} className={`hover:bg-gray-50 ${isActive ? 'bg-indigo-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {empresa.logo ? (
                            <img src={empresa.logo} alt={empresa.nombreCorto} className="w-10 h-10 rounded-full mr-3" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                              <Building2 className="w-5 h-5 text-gray-600" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center">
                              {empresa.nombreCorto || empresa.razonSocial}
                              {empresa.isFavorite && (
                                <Star className="w-4 h-4 ml-2 text-yellow-500 fill-yellow-500" />
                              )}
                              {isActive && (
                                <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                                  ACTIVA
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{empresa.razonSocial}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-gray-900">{empresa.rfc}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900">
                          {empresa.stats?.totalXMLs?.toLocaleString() || '0'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {formatBytes(empresa.storage?.used || 0)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {Math.round((empresa.storage?.used || 0) / (empresa.storage?.limit || 1) * 100)}% usado
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{formatDate(empresa.storage?.lastSync)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          status.color === 'green' ? 'bg-green-100 text-green-700' :
                          status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          status.color === 'red' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => switchEmpresa(empresa.rfc)}
                            disabled={isActive}
                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                              isActive
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            {isActive ? 'Activa' : 'Activar'}
                          </button>
                          <button
                            onClick={() => handleViewDetails(empresa)}
                            className="p-2 hover:bg-gray-100 rounded transition"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => toggleFavorite(empresa.rfc)}
                            className="p-2 hover:bg-gray-100 rounded transition"
                            title="Favorito"
                          >
                            <Star className={`w-4 h-4 ${empresa.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />
                          </button>
                          <div className="relative group">
                            <button className="p-2 hover:bg-gray-100 rounded transition">
                              <MoreVertical className="w-4 h-4 text-gray-600" />
                            </button>
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 hidden group-hover:block z-10">
                              <button
                                onClick={() => handleTogglePause(empresa)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                              >
                                {empresa.status === 'active' ? (
                                  <>
                                    <Pause className="w-4 h-4 mr-2" />
                                    Suspender
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Activar
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(empresa.rfc)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Company Detail Modal */}
        {showDetailModal && selectedEmpresa && (
          <CompanyDetailModal
            empresa={selectedEmpresa}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedEmpresa(null);
            }}
          />
        )}

        {/* Comparative View */}
        {showComparative && (
          <ComparativeView
            empresas={empresas}
            onClose={() => setShowComparative(false)}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// COMPANY DETAIL MODAL
// ============================================================================
const CompanyDetailModal = ({ empresa, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [copied, setCopied] = useState(false);

  const copyRFC = () => {
    navigator.clipboard.writeText(empresa.rfc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 flex items-center justify-between">
          <div className="flex items-center">
            {empresa.logo ? (
              <img src={empresa.logo} alt={empresa.nombreCorto} className="w-16 h-16 rounded-full bg-white p-2 mr-4" />
            ) : (
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mr-4">
                <Building2 className="w-8 h-8 text-indigo-600" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">{empresa.razonSocial}</h2>
              <div className="flex items-center mt-1">
                <span className="text-indigo-100 font-mono">{empresa.rfc}</span>
                <button
                  onClick={copyRFC}
                  className="ml-2 p-1 hover:bg-white/20 rounded transition"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-300" />
                  ) : (
                    <Copy className="w-4 h-4 text-indigo-100" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'general', label: 'General', icon: Building2 },
              { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
              { id: 'fiel', label: 'FIEL', icon: Shield },
              { id: 'storage', label: 'Almacenamiento', icon: Database }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-3 font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-semibold text-gray-600">Nombre Corto</label>
                  <div className="mt-1 text-gray-900">{empresa.nombreCorto || 'N/A'}</div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Régimen Fiscal</label>
                  <div className="mt-1 text-gray-900">{empresa.regimen || 'N/A'}</div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Fecha de Creación</label>
                  <div className="mt-1 text-gray-900">{formatDate(empresa.createdAt?.toDate?.())}</div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Estado</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                      empresa.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {empresa.status === 'active' ? 'Activa' : 'Suspendida'}
                    </span>
                  </div>
                </div>
              </div>

              {empresa.metadata && (
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Información de Contacto</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-semibold text-gray-600">Email</label>
                      <div className="mt-1 text-gray-900">{empresa.metadata.contacto || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-600">Teléfono</label>
                      <div className="mt-1 text-gray-900">{empresa.metadata.telefono || 'N/A'}</div>
                    </div>
                  </div>
                  {empresa.metadata.notas && (
                    <div className="mt-4">
                      <label className="text-sm font-semibold text-gray-600">Notas</label>
                      <div className="mt-1 text-gray-900">{empresa.metadata.notas}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4">
                  <FileText className="w-8 h-8 text-indigo-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{empresa.stats?.totalXMLs?.toLocaleString() || '0'}</div>
                  <div className="text-sm text-gray-600">Total XMLs</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <TrendingUp className="w-8 h-8 text-green-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{empresa.stats?.totalEmitidos?.toLocaleString() || '0'}</div>
                  <div className="text-sm text-gray-600">Emitidos</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <Download className="w-8 h-8 text-blue-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{empresa.stats?.totalRecibidos?.toLocaleString() || '0'}</div>
                  <div className="text-sm text-gray-600">Recibidos</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <Calendar className="w-8 h-8 text-purple-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{empresa.stats?.xmlsThisMonth?.toLocaleString() || '0'}</div>
                  <div className="text-sm text-gray-600">Este Mes</div>
                </div>
              </div>

              {empresa.autoSync && (
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Sincronización Automática</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-600">Estado</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        empresa.autoSync.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {empresa.autoSync.enabled ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-600">Frecuencia</span>
                      <span className="font-semibold text-gray-900 capitalize">{empresa.autoSync.frequency}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Última Ejecución</span>
                      <span className="font-semibold text-gray-900">{formatDate(empresa.autoSync.lastRun)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fiel' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
                <Lock className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900">Información Sensible Encriptada</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Los datos de la FIEL están encriptados con AES-256-GCM. Se requiere la contraseña maestra para acceder.
                  </p>
                </div>
              </div>

              {empresa.fielConfig && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mr-3" />
                      <div>
                        <div className="font-semibold text-gray-900">Archivo .KEY</div>
                        <div className="text-sm text-gray-600">Configurado</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mr-3" />
                      <div>
                        <div className="font-semibold text-gray-900">Archivo .CER</div>
                        <div className="text-sm text-gray-600">Configurado</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <Lock className="w-5 h-5 text-indigo-600 mr-3" />
                      <div>
                        <div className="font-semibold text-gray-900">Contraseña</div>
                        <div className="text-sm text-gray-600">Encriptada</div>
                      </div>
                    </div>
                  </div>

                  {empresa.fielConfig.expirationDate && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Fecha de Expiración</span>
                        <span className="font-semibold text-gray-900">
                          {formatDate(empresa.fielConfig.expirationDate)}
                        </span>
                      </div>
                      {(() => {
                        const daysUntilExpiry = Math.floor(
                          (new Date(empresa.fielConfig.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <div className="mt-2">
                            {daysUntilExpiry < 0 ? (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
                                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
                                <div>
                                  <div className="font-semibold text-red-900">FIEL Expirada</div>
                                  <div className="text-sm text-red-700">Renovar inmediatamente</div>
                                </div>
                              </div>
                            ) : daysUntilExpiry <= 30 ? (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
                                <div>
                                  <div className="font-semibold text-yellow-900">FIEL por Vencer</div>
                                  <div className="text-sm text-yellow-700">Faltan {daysUntilExpiry} días</div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">Válida por {daysUntilExpiry} días más</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Uso de Almacenamiento</h3>
                  <span className="text-sm text-gray-600">
                    {formatBytes(empresa.storage?.used || 0)} / {formatBytes(empresa.storage?.limit || 0)}
                  </span>
                </div>

                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-6 rounded-full transition-all ${
                        ((empresa.storage?.used || 0) / (empresa.storage?.limit || 1)) > 0.8
                          ? 'bg-red-500'
                          : ((empresa.storage?.used || 0) / (empresa.storage?.limit || 1)) > 0.6
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(((empresa.storage?.used || 0) / (empresa.storage?.limit || 1)) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-sm text-gray-600">
                    <span>{Math.round(((empresa.storage?.used || 0) / (empresa.storage?.limit || 1)) * 100)}% utilizado</span>
                    <span>{formatBytes((empresa.storage?.limit || 0) - (empresa.storage?.used || 0))} disponibles</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4">
                  <HardDrive className="w-8 h-8 text-indigo-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{formatBytes(empresa.storage?.used || 0)}</div>
                  <div className="text-sm text-gray-600">Espacio Usado</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <Database className="w-8 h-8 text-green-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{formatBytes((empresa.storage?.limit || 0) - (empresa.storage?.used || 0))}</div>
                  <div className="text-sm text-gray-600">Espacio Disponible</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Última sincronización</span>
                  <span className="font-semibold text-gray-900">{formatDate(empresa.storage?.lastSync)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPARATIVE VIEW
// ============================================================================
const ComparativeView = ({ empresas, onClose }) => {
  const [selectedEmpresas, setSelectedEmpresas] = useState([]);

  const toggleEmpresa = (rfc) => {
    if (selectedEmpresas.includes(rfc)) {
      setSelectedEmpresas(selectedEmpresas.filter(r => r !== rfc));
    } else if (selectedEmpresas.length < 3) {
      setSelectedEmpresas([...selectedEmpresas, rfc]);
    }
  };

  const compareData = selectedEmpresas.map(rfc => empresas.find(e => e.rfc === rfc));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Comparativa de Empresas</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          {/* Selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Selecciona hasta 3 empresas para comparar
            </label>
            <div className="flex flex-wrap gap-2">
              {empresas.map((empresa) => (
                <button
                  key={empresa.rfc}
                  onClick={() => toggleEmpresa(empresa.rfc)}
                  disabled={!selectedEmpresas.includes(empresa.rfc) && selectedEmpresas.length >= 3}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedEmpresas.includes(empresa.rfc)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {empresa.nombreCorto || empresa.razonSocial}
                </button>
              ))}
            </div>
          </div>

          {/* Comparison Table */}
          {compareData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Métrica</th>
                    {compareData.map((empresa) => (
                      <th key={empresa.rfc} className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
                        {empresa.nombreCorto || empresa.razonSocial}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">RFC</td>
                    {compareData.map((empresa) => (
                      <td key={empresa.rfc} className="px-4 py-3 text-center font-mono text-sm">{empresa.rfc}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">Total XMLs</td>
                    {compareData.map((empresa) => (
                      <td key={empresa.rfc} className="px-4 py-3 text-center font-semibold">
                        {empresa.stats?.totalXMLs?.toLocaleString() || '0'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">XMLs Este Mes</td>
                    {compareData.map((empresa) => (
                      <td key={empresa.rfc} className="px-4 py-3 text-center font-semibold">
                        {empresa.stats?.xmlsThisMonth?.toLocaleString() || '0'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">Emitidos</td>
                    {compareData.map((empresa) => (
                      <td key={empresa.rfc} className="px-4 py-3 text-center font-semibold">
                        {empresa.stats?.totalEmitidos?.toLocaleString() || '0'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">Recibidos</td>
                    {compareData.map((empresa) => (
                      <td key={empresa.rfc} className="px-4 py-3 text-center font-semibold">
                        {empresa.stats?.totalRecibidos?.toLocaleString() || '0'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">Storage Usado</td>
                    {compareData.map((empresa) => (
                      <td key={empresa.rfc} className="px-4 py-3 text-center font-semibold">
                        {formatBytes(empresa.storage?.used || 0)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">% Storage</td>
                    {compareData.map((empresa) => {
                      const percentage = Math.round(((empresa.storage?.used || 0) / (empresa.storage?.limit || 1)) * 100);
                      return (
                        <td key={empresa.rfc} className="px-4 py-3 text-center">
                          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                            percentage > 80 ? 'bg-red-100 text-red-700' :
                            percentage > 60 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {percentage}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-900">Estado</td>
                    {compareData.map((empresa) => {
                      const status = getStatusBadge(empresa);
                      const StatusIcon = status.icon;
                      return (
                        <td key={empresa.rfc} className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                            status.color === 'green' ? 'bg-green-100 text-green-700' :
                            status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                            status.color === 'red' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Company Modal */}
      <NBKAddCompanyModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCompanyAdded={async (company) => {
          console.log('Nueva empresa agregada:', company);
          // Recargar lista de empresas
          await reloadEmpresas();
        }}
        apiUrl="http://localhost:3000"
      />
    </div>
  );
};

export default CompanyManager;