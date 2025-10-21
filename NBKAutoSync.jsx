import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Settings,
  Bell,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  Edit,
  Trash2,
  BarChart3,
  RefreshCw,
  Zap,
  Filter,
  Download,
  Mail,
  Smartphone,
  MessageSquare,
  TrendingUp,
  Save,
  Eye,
  EyeOff,
  PlayCircle,
  FileDown,
  List,
  ChevronRight,
  ChevronDown,
  Code,
  Link as LinkIcon,
  Send,
  Search,
  AlertTriangle
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
const firestore = getFirestore(app);

// Constants
const RFC = 'XAXX010101000';

// Utility Functions
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getNextExecutionTime = (schedule) => {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);

  let nextExec = new Date(now);
  nextExec.setHours(hours, minutes, 0, 0);

  if (schedule.frequency === 'daily') {
    if (nextExec <= now) {
      nextExec.setDate(nextExec.getDate() + 1);
    }
  } else if (schedule.frequency === 'weekly') {
    const targetDay = schedule.dayOfWeek;
    const currentDay = now.getDay();
    let daysToAdd = targetDay - currentDay;

    if (daysToAdd < 0 || (daysToAdd === 0 && nextExec <= now)) {
      daysToAdd += 7;
    }

    nextExec.setDate(nextExec.getDate() + daysToAdd);
  } else if (schedule.frequency === 'monthly') {
    nextExec.setDate(schedule.dayOfMonth);

    if (nextExec <= now) {
      nextExec.setMonth(nextExec.getMonth() + 1);
    }
  }

  return nextExec;
};

// Scheduler Service
class SchedulerService {
  constructor() {
    this.tasks = [];
    this.interval = null;
  }

  start(onExecute) {
    this.onExecute = onExecute;

    // Check every minute
    this.interval = setInterval(() => {
      this.checkTasks();
    }, 60000);

    // Initial check
    this.checkTasks();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  checkTasks() {
    const now = new Date();

    this.tasks.forEach(task => {
      if (!task.enabled) return;

      const nextExec = getNextExecutionTime(task.schedule);

      // Check if it's time to execute (within 1 minute window)
      if (Math.abs(now - nextExec) < 60000 && !task.executing) {
        this.executeTask(task);
      }
    });
  }

  async executeTask(task) {
    task.executing = true;

    try {
      if (this.onExecute) {
        await this.onExecute(task);
      }
    } catch (error) {
      console.error('Task execution error:', error);
    } finally {
      task.executing = false;
    }
  }

  addTask(task) {
    this.tasks.push(task);
  }

  removeTask(taskId) {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
  }

  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      Object.assign(task, updates);
    }
  }
}

// Main Component
const NBKAutoSync = () => {
  // Auto-sync configuration
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncConfig, setAutoSyncConfig] = useState({
    frequency: 'daily',
    time: '09:00',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1
  });

  // Scheduled tasks
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Sync history
  const [syncHistory, setSyncHistory] = useState([]);
  const [currentSync, setCurrentSync] = useState(null);

  // Notifications
  const [notificationRules, setNotificationRules] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);

  // Conditional rules
  const [downloadRules, setDownloadRules] = useState([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);

  // Logs
  const [automationLogs, setAutomationLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalXMLsDownloaded: 0,
    avgXMLsPerSync: 0
  });

  // Scheduler
  const schedulerRef = useRef(new SchedulerService());

  // Initialize
  useEffect(() => {
    loadConfiguration();
    loadSyncHistory();
    loadAutomationLogs();

    // Start scheduler
    schedulerRef.current.start(executeScheduledTask);

    return () => {
      schedulerRef.current.stop();
    };
  }, []);

  // Load configuration from localStorage
  const loadConfiguration = () => {
    const savedConfig = localStorage.getItem('nbk_autosync_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setAutoSyncEnabled(config.enabled || false);
      setAutoSyncConfig(config.config || autoSyncConfig);
    }

    const savedTasks = localStorage.getItem('nbk_scheduled_tasks');
    if (savedTasks) {
      const tasks = JSON.parse(savedTasks);
      setScheduledTasks(tasks);
      tasks.forEach(task => schedulerRef.current.addTask(task));
    }

    const savedNotifications = localStorage.getItem('nbk_notification_rules');
    if (savedNotifications) {
      setNotificationRules(JSON.parse(savedNotifications));
    }

    const savedRules = localStorage.getItem('nbk_download_rules');
    if (savedRules) {
      setDownloadRules(JSON.parse(savedRules));
    }

    const savedWebhooks = localStorage.getItem('nbk_webhooks');
    if (savedWebhooks) {
      setWebhooks(JSON.parse(savedWebhooks));
    }
  };

  // Load sync history
  const loadSyncHistory = () => {
    const saved = localStorage.getItem('nbk_sync_history');
    if (saved) {
      const history = JSON.parse(saved);
      setSyncHistory(history);
      updateStats(history);
    }
  };

  // Load automation logs
  const loadAutomationLogs = () => {
    const saved = localStorage.getItem('nbk_automation_logs');
    if (saved) {
      setAutomationLogs(JSON.parse(saved));
    }
  };

  // Save configuration
  const saveConfiguration = useCallback(() => {
    localStorage.setItem('nbk_autosync_config', JSON.stringify({
      enabled: autoSyncEnabled,
      config: autoSyncConfig
    }));
  }, [autoSyncEnabled, autoSyncConfig]);

  useEffect(() => {
    saveConfiguration();
  }, [autoSyncEnabled, autoSyncConfig, saveConfiguration]);

  // Update stats
  const updateStats = (history) => {
    const successful = history.filter(h => h.status === 'completed').length;
    const failed = history.filter(h => h.status === 'error').length;
    const totalXMLs = history.reduce((sum, h) => sum + (h.xmlsDownloaded || 0), 0);

    setStats({
      totalSyncs: history.length,
      successfulSyncs: successful,
      failedSyncs: failed,
      totalXMLsDownloaded: totalXMLs,
      avgXMLsPerSync: history.length > 0 ? Math.round(totalXMLs / history.length) : 0
    });
  };

  // Execute scheduled task
  const executeScheduledTask = async (task) => {
    addLog(`Ejecutando tarea programada: ${task.name}`, 'info', task);

    const syncRecord = {
      id: Date.now().toString(),
      taskId: task.id,
      taskName: task.name,
      startTime: new Date().toISOString(),
      status: 'in_progress',
      xmlsDownloaded: 0,
      errors: []
    };

    setCurrentSync(syncRecord);

    // Simulate download process
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate random number of XMLs downloaded
      const xmlsCount = Math.floor(Math.random() * 50) + 10;

      syncRecord.endTime = new Date().toISOString();
      syncRecord.status = 'completed';
      syncRecord.xmlsDownloaded = xmlsCount;

      // Add to history
      const newHistory = [syncRecord, ...syncHistory].slice(0, 100);
      setSyncHistory(newHistory);
      localStorage.setItem('nbk_sync_history', JSON.stringify(newHistory));

      updateStats(newHistory);

      addLog(`Tarea completada: ${task.name} - ${xmlsCount} XMLs descargados`, 'success', syncRecord);

      // Check notification rules
      checkNotificationRules(syncRecord);

      // Trigger webhooks
      triggerWebhooks('sync_completado', syncRecord);

    } catch (error) {
      syncRecord.endTime = new Date().toISOString();
      syncRecord.status = 'error';
      syncRecord.errors.push(error.message);

      const newHistory = [syncRecord, ...syncHistory].slice(0, 100);
      setSyncHistory(newHistory);
      localStorage.setItem('nbk_sync_history', JSON.stringify(newHistory));

      addLog(`Error en tarea: ${task.name} - ${error.message}`, 'error', syncRecord);

      triggerWebhooks('error_sync', syncRecord);
    } finally {
      setCurrentSync(null);
    }
  };

  // Add log entry
  const addLog = (message, type, data = null) => {
    const log = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      message,
      type,
      data
    };

    const newLogs = [log, ...automationLogs].slice(0, 500);
    setAutomationLogs(newLogs);
    localStorage.setItem('nbk_automation_logs', JSON.stringify(newLogs));
  };

  // Check notification rules
  const checkNotificationRules = (syncRecord) => {
    notificationRules.forEach(rule => {
      if (!rule.enabled) return;

      let shouldNotify = false;

      if (rule.event === 'sync_completado' && syncRecord.status === 'completed') {
        shouldNotify = true;
      } else if (rule.event === 'error_sync' && syncRecord.status === 'error') {
        shouldNotify = true;
      }

      if (shouldNotify) {
        sendNotification(rule, syncRecord);
      }
    });
  };

  // Send notification (simulated)
  const sendNotification = (rule, data) => {
    addLog(`Notificación enviada: ${rule.name} via ${rule.channel}`, 'info', { rule, data });

    // Browser notification
    if (rule.channel === 'push' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('NBK - Sincronización SAT', {
        body: `${rule.name}: ${data.taskName} completado`,
        icon: '/icon.png'
      });
    }
  };

  // Trigger webhooks
  const triggerWebhooks = (event, data) => {
    webhooks
      .filter(wh => wh.enabled && wh.events.includes(event))
      .forEach(webhook => {
        addLog(`Webhook disparado: ${webhook.name} - ${event}`, 'info', { webhook, event, data });

        // Simulate HTTP POST
        console.log('POST', webhook.url, {
          event,
          data,
          timestamp: new Date().toISOString()
        });
      });
  };

  // Task Management
  const createTask = () => {
    setEditingTask({
      id: Date.now().toString(),
      name: '',
      description: '',
      enabled: true,
      schedule: {
        frequency: 'daily',
        time: '09:00',
        dayOfWeek: 1,
        dayOfMonth: 1
      },
      downloadConfig: {
        cfdiType: 'todos',
        dateRange: 'current_month'
      }
    });
    setShowTaskModal(true);
  };

  const saveTask = () => {
    if (!editingTask.name) {
      alert('Ingresa un nombre para la tarea');
      return;
    }

    const isNew = !scheduledTasks.find(t => t.id === editingTask.id);

    let newTasks;
    if (isNew) {
      newTasks = [...scheduledTasks, editingTask];
      schedulerRef.current.addTask(editingTask);
    } else {
      newTasks = scheduledTasks.map(t => t.id === editingTask.id ? editingTask : t);
      schedulerRef.current.updateTask(editingTask.id, editingTask);
    }

    setScheduledTasks(newTasks);
    localStorage.setItem('nbk_scheduled_tasks', JSON.stringify(newTasks));

    setShowTaskModal(false);
    setEditingTask(null);

    addLog(`Tarea ${isNew ? 'creada' : 'actualizada'}: ${editingTask.name}`, 'success');
  };

  const deleteTask = (taskId) => {
    if (!confirm('¿Eliminar esta tarea programada?')) return;

    const newTasks = scheduledTasks.filter(t => t.id !== taskId);
    setScheduledTasks(newTasks);
    localStorage.setItem('nbk_scheduled_tasks', JSON.stringify(newTasks));

    schedulerRef.current.removeTask(taskId);

    addLog('Tarea eliminada', 'warning');
  };

  const executeTaskNow = (task) => {
    executeScheduledTask(task);
  };

  // Notification Management
  const createNotification = () => {
    setEditingNotification({
      id: Date.now().toString(),
      name: '',
      enabled: true,
      event: 'sync_completado',
      channel: 'inapp',
      conditions: {}
    });
    setShowNotificationModal(true);
  };

  const saveNotification = () => {
    if (!editingNotification.name) {
      alert('Ingresa un nombre para la notificación');
      return;
    }

    const isNew = !notificationRules.find(n => n.id === editingNotification.id);

    let newRules;
    if (isNew) {
      newRules = [...notificationRules, editingNotification];
    } else {
      newRules = notificationRules.map(n => n.id === editingNotification.id ? editingNotification : n);
    }

    setNotificationRules(newRules);
    localStorage.setItem('nbk_notification_rules', JSON.stringify(newRules));

    setShowNotificationModal(false);
    setEditingNotification(null);

    addLog(`Notificación ${isNew ? 'creada' : 'actualizada'}: ${editingNotification.name}`, 'success');
  };

  const deleteNotification = (id) => {
    const newRules = notificationRules.filter(n => n.id !== id);
    setNotificationRules(newRules);
    localStorage.setItem('nbk_notification_rules', JSON.stringify(newRules));

    addLog('Regla de notificación eliminada', 'warning');
  };

  // Download Rules Management
  const createRule = () => {
    setEditingRule({
      id: Date.now().toString(),
      name: '',
      enabled: true,
      type: 'include_rfc',
      value: '',
      action: 'download'
    });
    setShowRuleModal(true);
  };

  const saveRule = () => {
    if (!editingRule.name) {
      alert('Ingresa un nombre para la regla');
      return;
    }

    const isNew = !downloadRules.find(r => r.id === editingRule.id);

    let newRules;
    if (isNew) {
      newRules = [...downloadRules, editingRule];
    } else {
      newRules = downloadRules.map(r => r.id === editingRule.id ? editingRule : r);
    }

    setDownloadRules(newRules);
    localStorage.setItem('nbk_download_rules', JSON.stringify(newRules));

    setShowRuleModal(false);
    setEditingRule(null);

    addLog(`Regla ${isNew ? 'creada' : 'actualizada'}: ${editingRule.name}`, 'success');
  };

  const deleteRule = (id) => {
    const newRules = downloadRules.filter(r => r.id !== id);
    setDownloadRules(newRules);
    localStorage.setItem('nbk_download_rules', JSON.stringify(newRules));

    addLog('Regla de descarga eliminada', 'warning');
  };

  // Webhook Management
  const createWebhook = () => {
    setEditingWebhook({
      id: Date.now().toString(),
      name: '',
      url: '',
      enabled: true,
      events: ['sync_completado'],
      headers: {}
    });
    setShowWebhookModal(true);
  };

  const saveWebhook = () => {
    if (!editingWebhook.name || !editingWebhook.url) {
      alert('Completa todos los campos requeridos');
      return;
    }

    const isNew = !webhooks.find(w => w.id === editingWebhook.id);

    let newWebhooks;
    if (isNew) {
      newWebhooks = [...webhooks, editingWebhook];
    } else {
      newWebhooks = webhooks.map(w => w.id === editingWebhook.id ? editingWebhook : w);
    }

    setWebhooks(newWebhooks);
    localStorage.setItem('nbk_webhooks', JSON.stringify(newWebhooks));

    setShowWebhookModal(false);
    setEditingWebhook(null);

    addLog(`Webhook ${isNew ? 'creado' : 'actualizado'}: ${editingWebhook.name}`, 'success');
  };

  const deleteWebhook = (id) => {
    const newWebhooks = webhooks.filter(w => w.id !== id);
    setWebhooks(newWebhooks);
    localStorage.setItem('nbk_webhooks', JSON.stringify(newWebhooks));

    addLog('Webhook eliminado', 'warning');
  };

  const testWebhook = (webhook) => {
    addLog(`Probando webhook: ${webhook.name}`, 'info');

    const testData = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook from NBK' }
    };

    console.log('POST', webhook.url, testData);

    setTimeout(() => {
      addLog(`Webhook probado: ${webhook.name} - Respuesta OK (simulado)`, 'success');
    }, 1000);
  };

  // Export logs
  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Tipo', 'Mensaje'].join(','),
      ...automationLogs.map(log => [
        log.timestamp,
        log.type,
        log.message.replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nbk_automation_logs_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        addLog('Permisos de notificación otorgados', 'success');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
            <Zap className="w-8 h-8 mr-3 text-indigo-600" />
            Automatización de Descargas
          </h1>
          <p className="text-gray-600">
            Programa y automatiza la descarga de tus comprobantes fiscales
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <RefreshCw className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalSyncs}</div>
            <div className="text-sm text-gray-600">Total Sincronizaciones</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.successfulSyncs}</div>
            <div className="text-sm text-gray-600">Exitosas</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.failedSyncs}</div>
            <div className="text-sm text-gray-600">Fallidas</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <Download className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalXMLsDownloaded}</div>
            <div className="text-sm text-gray-600">XMLs Descargados</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.avgXMLsPerSync}</div>
            <div className="text-sm text-gray-600">Promedio/Sync</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Auto-Sync Configuration */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <RefreshCw className="w-5 h-5 mr-2 text-indigo-600" />
                  Sincronización Automática
                </h2>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {autoSyncEnabled ? 'Activo' : 'Inactivo'}
                  </span>
                </label>
              </div>

              {autoSyncEnabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frecuencia
                      </label>
                      <select
                        value={autoSyncConfig.frequency}
                        onChange={(e) => setAutoSyncConfig({ ...autoSyncConfig, frequency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="daily">Diaria</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensual</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora
                      </label>
                      <input
                        type="time"
                        value={autoSyncConfig.time}
                        onChange={(e) => setAutoSyncConfig({ ...autoSyncConfig, time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {autoSyncConfig.frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Día de la semana
                      </label>
                      <select
                        value={autoSyncConfig.dayOfWeek}
                        onChange={(e) => setAutoSyncConfig({ ...autoSyncConfig, dayOfWeek: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="0">Domingo</option>
                        <option value="1">Lunes</option>
                        <option value="2">Martes</option>
                        <option value="3">Miércoles</option>
                        <option value="4">Jueves</option>
                        <option value="5">Viernes</option>
                        <option value="6">Sábado</option>
                      </select>
                    </div>
                  )}

                  {autoSyncConfig.frequency === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Día del mes
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={autoSyncConfig.dayOfMonth}
                        onChange={(e) => setAutoSyncConfig({ ...autoSyncConfig, dayOfMonth: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700 flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      Próxima ejecución: {formatDate(getNextExecutionTime(autoSyncConfig))}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Scheduled Tasks */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                  Tareas Programadas
                </h2>
                <button
                  onClick={createTask}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Tarea
                </button>
              </div>

              {scheduledTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">No hay tareas programadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledTasks.map((task) => (
                    <div
                      key={task.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{task.name}</h3>
                            {task.enabled ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                Activa
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                Inactiva
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {task.schedule.frequency === 'daily' && 'Diaria'}
                              {task.schedule.frequency === 'weekly' && 'Semanal'}
                              {task.schedule.frequency === 'monthly' && 'Mensual'}
                              {' a las '}{task.schedule.time}
                            </span>
                            <span>•</span>
                            <span>Próxima: {formatDate(getNextExecutionTime(task.schedule))}</span>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => executeTaskNow(task)}
                            className="p-2 hover:bg-blue-50 rounded transition"
                            title="Ejecutar ahora"
                          >
                            <PlayCircle className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setShowTaskModal(true);
                            }}
                            className="p-2 hover:bg-gray-100 rounded transition"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-2 hover:bg-red-50 rounded transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sync History */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-indigo-600" />
                Historial de Sincronizaciones
              </h2>

              {currentSync && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin mr-3" />
                    <div>
                      <div className="font-semibold text-blue-900">Sincronización en progreso</div>
                      <div className="text-sm text-blue-700">{currentSync.taskName}</div>
                    </div>
                  </div>
                </div>
              )}

              {syncHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Activity className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">No hay sincronizaciones registradas</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {syncHistory.slice(0, 20).map((sync) => (
                    <div
                      key={sync.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {sync.status === 'completed' && (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                        {sync.status === 'error' && (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        {sync.status === 'in_progress' && (
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        )}

                        <div>
                          <div className="font-medium text-gray-900 text-sm">{sync.taskName}</div>
                          <div className="text-xs text-gray-500">{formatDate(sync.startTime)}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {sync.xmlsDownloaded} XMLs
                        </div>
                        {sync.status === 'completed' && (
                          <div className="text-xs text-green-600">Completado</div>
                        )}
                        {sync.status === 'error' && (
                          <div className="text-xs text-red-600">Error</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Notifications */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Bell className="w-5 h-5 mr-2 text-indigo-600" />
                  Notificaciones
                </h3>
                <button
                  onClick={createNotification}
                  className="p-2 hover:bg-gray-100 rounded transition"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <button
                onClick={requestNotificationPermission}
                className="w-full mb-4 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition"
              >
                Habilitar notificaciones push
              </button>

              {notificationRules.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No hay reglas configuradas
                </p>
              ) : (
                <div className="space-y-2">
                  {notificationRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        {rule.channel === 'email' && <Mail className="w-4 h-4 text-gray-400" />}
                        {rule.channel === 'push' && <Smartphone className="w-4 h-4 text-gray-400" />}
                        {rule.channel === 'inapp' && <MessageSquare className="w-4 h-4 text-gray-400" />}
                        <span className="text-sm text-gray-900">{rule.name}</span>
                      </div>
                      <button
                        onClick={() => deleteNotification(rule.id)}
                        className="p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Download Rules */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Filter className="w-5 h-5 mr-2 text-indigo-600" />
                  Reglas de Descarga
                </h3>
                <button
                  onClick={createRule}
                  className="p-2 hover:bg-gray-100 rounded transition"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {downloadRules.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No hay reglas configuradas
                </p>
              ) : (
                <div className="space-y-2">
                  {downloadRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                        <div className="text-xs text-gray-500">{rule.type}</div>
                      </div>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Webhooks */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <LinkIcon className="w-5 h-5 mr-2 text-indigo-600" />
                  Webhooks
                </h3>
                <button
                  onClick={createWebhook}
                  className="p-2 hover:bg-gray-100 rounded transition"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {webhooks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No hay webhooks configurados
                </p>
              ) : (
                <div className="space-y-2">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="p-2 bg-gray-50 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{webhook.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => testWebhook(webhook)}
                            className="p-1 hover:bg-blue-50 rounded"
                            title="Probar"
                          >
                            <Send className="w-3 h-3 text-blue-600" />
                          </button>
                          <button
                            onClick={() => deleteWebhook(webhook.id)}
                            className="p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate">{webhook.url}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logs */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <List className="w-5 h-5 mr-2 text-indigo-600" />
                  Logs
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="p-2 hover:bg-gray-100 rounded transition"
                  >
                    {showLogs ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={exportLogs}
                    className="p-2 hover:bg-gray-100 rounded transition"
                  >
                    <Download className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {showLogs && (
                <div className="bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs">
                  {automationLogs.slice(0, 50).map((log) => (
                    <div
                      key={log.id}
                      className={`mb-1 ${
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-green-400' :
                        log.type === 'warning' ? 'text-yellow-400' :
                        'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {showTaskModal && editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {scheduledTasks.find(t => t.id === editingTask.id) ? 'Editar' : 'Nueva'} Tarea Programada
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={editingTask.name}
                  onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frecuencia</label>
                  <select
                    value={editingTask.schedule.frequency}
                    onChange={(e) => setEditingTask({
                      ...editingTask,
                      schedule: { ...editingTask.schedule, frequency: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hora</label>
                  <input
                    type="time"
                    value={editingTask.schedule.time}
                    onChange={(e) => setEditingTask({
                      ...editingTask,
                      schedule: { ...editingTask.schedule, time: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de CFDI</label>
                <select
                  value={editingTask.downloadConfig.cfdiType}
                  onChange={(e) => setEditingTask({
                    ...editingTask,
                    downloadConfig: { ...editingTask.downloadConfig, cfdiType: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="todos">Todos</option>
                  <option value="emitidos">Emitidos</option>
                  <option value="recibidos">Recibidos</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editingTask.enabled}
                  onChange={(e) => setEditingTask({ ...editingTask, enabled: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm text-gray-700">Tarea activa</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setEditingTask(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveTask}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotificationModal && editingNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {notificationRules.find(n => n.id === editingNotification.id) ? 'Editar' : 'Nueva'} Notificación
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={editingNotification.name}
                  onChange={(e) => setEditingNotification({ ...editingNotification, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Evento</label>
                <select
                  value={editingNotification.event}
                  onChange={(e) => setEditingNotification({ ...editingNotification, event: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="sync_completado">Sincronización completada</option>
                  <option value="error_sync">Error en sincronización</option>
                  <option value="nuevo_xml">Nuevo XML recibido</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Canal</label>
                <select
                  value={editingNotification.channel}
                  onChange={(e) => setEditingNotification({ ...editingNotification, channel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="inapp">In-App</option>
                  <option value="push">Push</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editingNotification.enabled}
                  onChange={(e) => setEditingNotification({ ...editingNotification, enabled: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm text-gray-700">Activa</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNotificationModal(false);
                  setEditingNotification(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveNotification}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {downloadRules.find(r => r.id === editingRule.id) ? 'Editar' : 'Nueva'} Regla de Descarga
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de regla</label>
                <select
                  value={editingRule.type}
                  onChange={(e) => setEditingRule({ ...editingRule, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="include_rfc">Incluir RFC</option>
                  <option value="exclude_rfc">Excluir RFC</option>
                  <option value="min_amount">Monto mínimo</option>
                  <option value="max_amount">Monto máximo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor</label>
                <input
                  type="text"
                  value={editingRule.value}
                  onChange={(e) => setEditingRule({ ...editingRule, value: e.target.value })}
                  placeholder={editingRule.type.includes('amount') ? '0.00' : 'RFC'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editingRule.enabled}
                  onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm text-gray-700">Activa</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRuleModal(false);
                  setEditingRule(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveRule}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && editingWebhook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {webhooks.find(w => w.id === editingWebhook.id) ? 'Editar' : 'Nuevo'} Webhook
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={editingWebhook.name}
                  onChange={(e) => setEditingWebhook({ ...editingWebhook, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                <input
                  type="url"
                  value={editingWebhook.url}
                  onChange={(e) => setEditingWebhook({ ...editingWebhook, url: e.target.value })}
                  placeholder="https://api.example.com/webhook"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Eventos</label>
                <div className="space-y-2">
                  {['sync_completado', 'error_sync', 'nuevo_xml'].map(event => (
                    <label key={event} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingWebhook.events.includes(event)}
                        onChange={(e) => {
                          const events = e.target.checked
                            ? [...editingWebhook.events, event]
                            : editingWebhook.events.filter(e => e !== event);
                          setEditingWebhook({ ...editingWebhook, events });
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={editingWebhook.enabled}
                  onChange={(e) => setEditingWebhook({ ...editingWebhook, enabled: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm text-gray-700">Activo</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowWebhookModal(false);
                  setEditingWebhook(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveWebhook}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NBKAutoSync;