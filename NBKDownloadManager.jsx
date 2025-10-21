import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  CalendarRange,
  CalendarDays,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  Loader2,
  FileCheck,
  AlertTriangle,
  Filter,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

// Utility Functions
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const getMonthName = (month) => {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return months[month];
};

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const getMonthsBetween = (startDate, endDate) => {
  const months = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    months.push({
      year: current.getFullYear(),
      month: current.getMonth(),
      label: `${getMonthName(current.getMonth())} ${current.getFullYear()}`
    });
    current.setMonth(current.getMonth() + 1);
  }

  return months;
};

const splitIntoMonthlyRequests = (startDate, endDate) => {
  const requests = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);

  while (current <= end) {
    const monthStart = new Date(current);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    const requestEnd = monthEnd < end ? monthEnd : end;

    requests.push({
      id: `${formatDate(monthStart)}_${formatDate(requestEnd)}`,
      startDate: formatDate(monthStart),
      endDate: formatDate(requestEnd),
      label: `${monthStart.getDate()} ${getMonthName(monthStart.getMonth())} - ${requestEnd.getDate()} ${getMonthName(requestEnd.getMonth())} ${requestEnd.getFullYear()}`
    });

    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return requests;
};

// Calendar Component for Specific Days Selection
const CalendarPicker = ({ selectedDates, onDateToggle }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const isDateSelected = (day) => {
    const dateStr = formatDate(new Date(year, month, day));
    return selectedDates.includes(dateStr);
  };

  const handleDateClick = (day) => {
    const dateStr = formatDate(new Date(year, month, day));
    onDateToggle(dateStr);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronDown className="w-5 h-5 rotate-90" />
        </button>
        <h3 className="text-lg font-semibold text-gray-900">
          {getMonthName(month)} {year}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronDown className="w-5 h-5 -rotate-90" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}

        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {days.map((day) => {
          const selected = isDateSelected(day);
          const isPast = new Date(year, month, day) < new Date().setHours(0, 0, 0, 0);

          return (
            <button
              key={day}
              onClick={() => !isPast && handleDateClick(day)}
              disabled={isPast}
              className={`aspect-square flex items-center justify-center rounded-lg text-sm transition ${
                selected
                  ? 'bg-indigo-600 text-white font-semibold'
                  : isPast
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Month Grid Selector
const MonthGridSelector = ({ selectedMonths, onMonthToggle, currentYear, onYearChange }) => {
  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const isMonthSelected = (month) => {
    return selectedMonths.some(m => m.year === currentYear && m.month === month);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Año:</label>
        <select
          value={currentYear}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {months.map((month) => {
          const selected = isMonthSelected(month);
          const isPast = new Date(currentYear, month + 1, 0) < new Date();

          return (
            <button
              key={month}
              onClick={() => isPast && onMonthToggle({ year: currentYear, month })}
              disabled={!isPast}
              className={`py-3 px-4 rounded-lg font-medium text-sm transition ${
                selected
                  ? 'bg-indigo-600 text-white'
                  : isPast
                  ? 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-200'
              }`}
            >
              {getMonthName(month)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Main Download Manager Component
const NBKDownloadManager = () => {
  // CFDI Type State
  const [cfdiType, setCfdiType] = useState('emitidos');

  // Period Mode State
  const [periodMode, setPeriodMode] = useState('range'); // 'specific', 'range', 'months', 'year'

  // Specific Days Mode
  const [selectedDates, setSelectedDates] = useState([]);

  // Range Mode
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Months Mode
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [monthYear, setMonthYear] = useState(new Date().getFullYear());

  // Year Mode
  const [selectedYear, setSelectedYear] = useState('');

  // Advanced Options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rfcFilter, setRfcFilter] = useState('');
  const [documentType, setDocumentType] = useState('todos');
  const [documentStatus, setDocumentStatus] = useState('todos');

  // Download State
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentRequest, setCurrentRequest] = useState(0);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [logs, setLogs] = useState([]);

  // Computed Requests
  const requests = useMemo(() => {
    if (periodMode === 'specific' && selectedDates.length > 0) {
      return selectedDates.sort().map(date => ({
        id: date,
        startDate: date,
        endDate: date,
        label: new Date(date).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      }));
    }

    if (periodMode === 'range' && startDate && endDate) {
      return splitIntoMonthlyRequests(startDate, endDate);
    }

    if (periodMode === 'months' && selectedMonths.length > 0) {
      return selectedMonths.map(({ year, month }) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        return {
          id: `${year}-${month}`,
          startDate: formatDate(start),
          endDate: formatDate(end),
          label: `${getMonthName(month)} ${year}`
        };
      });
    }

    if (periodMode === 'year' && selectedYear) {
      const months = [];
      for (let month = 0; month < 12; month++) {
        const start = new Date(selectedYear, month, 1);
        const end = new Date(selectedYear, month + 1, 0);
        months.push({
          id: `${selectedYear}-${month}`,
          startDate: formatDate(start),
          endDate: formatDate(end),
          label: `${getMonthName(month)} ${selectedYear}`
        });
      }
      return months;
    }

    return [];
  }, [periodMode, selectedDates, startDate, endDate, selectedMonths, selectedYear]);

  // Estimated XMLs
  const estimatedXMLs = requests.length * 50; // Rough estimate

  // Handlers
  const handleDateToggle = (date) => {
    setSelectedDates(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const handleMonthToggle = (month) => {
    setSelectedMonths(prev => {
      const exists = prev.some(m => m.year === month.year && m.month === month.month);
      return exists
        ? prev.filter(m => !(m.year === month.year && m.month === month.month))
        : [...prev, month];
    });
  };

  const handleRemoveDate = (date) => {
    setSelectedDates(prev => prev.filter(d => d !== date));
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-MX');
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const simulateDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setCurrentRequest(0);
    setDownloadedCount(0);
    setLogs([]);

    addLog('Iniciando proceso de descarga de CFDI', 'success');
    addLog(`Total de solicitudes a realizar: ${requests.length}`, 'info');

    for (let i = 0; i < requests.length; i++) {
      if (isPaused) {
        addLog('Descarga pausada', 'warning');
        while (isPaused) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        addLog('Descarga reanudada', 'success');
      }

      const request = requests[i];
      setCurrentRequest(i + 1);

      addLog(`Solicitando CFDIs: ${request.label}`, 'info');

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      addLog(`Autenticando con SAT...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 800));

      addLog(`Descargando XMLs del periodo...`, 'info');

      // Simulate downloading XMLs
      const xmlsInPeriod = Math.floor(Math.random() * 30) + 20;
      for (let j = 0; j < xmlsInPeriod; j++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setDownloadedCount(prev => prev + 1);
        setDownloadProgress(((i * 100 / requests.length) + ((j + 1) / xmlsInPeriod) * (100 / requests.length)));
      }

      addLog(`✓ Descargados ${xmlsInPeriod} XMLs del periodo ${request.label}`, 'success');

      // Delay between requests to avoid SAT rate limiting
      if (i < requests.length - 1) {
        addLog('Esperando antes de la siguiente solicitud...', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    addLog(`🎉 Proceso completado. Total de XMLs descargados: ${downloadedCount}`, 'success');
    setIsDownloading(false);
    setDownloadProgress(100);
  };

  const handleStartDownload = () => {
    if (requests.length === 0) {
      addLog('No hay periodos seleccionados', 'error');
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmDownload = () => {
    setShowConfirmModal(false);
    simulateDownload();
  };

  const handlePauseResume = () => {
    setIsPaused(prev => !prev);
  };

  const handleReset = () => {
    setIsDownloading(false);
    setIsPaused(false);
    setDownloadProgress(0);
    setCurrentRequest(0);
    setDownloadedCount(0);
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Descarga de CFDI
          </h1>
          <p className="text-gray-600">
            Seleccione los periodos y configure los filtros para descargar sus comprobantes fiscales
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* CFDI Type Selector */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                Tipo de CFDI
              </h2>

              <div className="space-y-3">
                {[
                  { value: 'emitidos', label: 'Emitidos', description: 'Facturas que tu empresa ha emitido a clientes' },
                  { value: 'recibidos', label: 'Recibidos', description: 'Facturas que has recibido de proveedores' },
                  { value: 'todos', label: 'Todos', description: 'Emitidos y recibidos en un solo proceso' }
                ].map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
                      cfdiType === type.value
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cfdiType"
                      value={type.value}
                      checked={cfdiType === type.value}
                      onChange={(e) => setCfdiType(e.target.value)}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-semibold text-gray-900">{type.label}</div>
                      <div className="text-sm text-gray-600">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Period Selector */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                Selección de Periodo
              </h2>

              {/* Period Mode Tabs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                {[
                  { value: 'specific', label: 'Días específicos', icon: CalendarDays },
                  { value: 'range', label: 'Rango', icon: CalendarRange },
                  { value: 'months', label: 'Meses', icon: Calendar },
                  { value: 'year', label: 'Año completo', icon: Calendar }
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setPeriodMode(value)}
                    className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg border-2 transition ${
                      periodMode === value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-xs font-medium text-center">{label}</span>
                  </button>
                ))}
              </div>

              {/* Period Mode Content */}
              <div className="space-y-4">
                {periodMode === 'specific' && (
                  <>
                    <CalendarPicker
                      selectedDates={selectedDates}
                      onDateToggle={handleDateToggle}
                    />

                    {selectedDates.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Días seleccionados ({selectedDates.length}):
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {selectedDates.sort().map(date => (
                            <div
                              key={date}
                              className="flex items-center bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm"
                            >
                              <span>{new Date(date).toLocaleDateString('es-MX')}</span>
                              <button
                                onClick={() => handleRemoveDate(date)}
                                className="ml-2 hover:text-indigo-900"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {periodMode === 'range' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha de inicio
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        max={formatDate(new Date())}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha de fin
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        max={formatDate(new Date())}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {startDate && endDate && (
                      <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-700 flex items-start">
                          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          El SAT limita cada solicitud a 1 mes. Tu rango se dividirá en {requests.length} solicitud(es).
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {periodMode === 'months' && (
                  <MonthGridSelector
                    selectedMonths={selectedMonths}
                    onMonthToggle={handleMonthToggle}
                    currentYear={monthYear}
                    onYearChange={setMonthYear}
                  />
                )}

                {periodMode === 'year' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleccionar año
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Seleccione un año</option>
                      {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>

                    {selectedYear && (
                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm text-amber-700 flex items-start">
                          <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          Se realizarán 12 solicitudes (una por mes). Esto puede tardar varios minutos.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Options */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 mb-4"
              >
                <span className="flex items-center">
                  <Filter className="w-5 h-5 mr-2 text-indigo-600" />
                  Opciones Avanzadas
                </span>
                {showAdvanced ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-2 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filtrar por RFC específico
                    </label>
                    <input
                      type="text"
                      value={rfcFilter}
                      onChange={(e) => setRfcFilter(e.target.value.toUpperCase())}
                      placeholder="RFC del emisor o receptor"
                      maxLength={13}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Opcional: filtra solo facturas de/para este RFC
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de comprobante
                    </label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="todos">Todos los tipos</option>
                      <option value="ingreso">Ingreso</option>
                      <option value="egreso">Egreso</option>
                      <option value="traslado">Traslado</option>
                      <option value="nomina">Nómina</option>
                      <option value="pago">Pago</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estado del comprobante
                    </label>
                    <select
                      value={documentStatus}
                      onChange={(e) => setDocumentStatus(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="todos">Todos los estados</option>
                      <option value="vigente">Vigente</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Download Logs */}
            {logs.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileCheck className="w-5 h-5 mr-2 text-indigo-600" />
                  Registro de actividad
                </h3>

                <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={`mb-1 ${
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-green-400' :
                        log.type === 'warning' ? 'text-yellow-400' :
                        'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Summary & Actions */}
          <div className="space-y-6">
            {/* Requests Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-indigo-600" />
                Solicitudes por realizar
              </h3>

              {requests.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Selecciona un periodo para continuar</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {requests.map((req, i) => (
                      <div key={req.id} className="flex items-start p-3 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-semibold mr-3">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{req.label}</p>
                          <p className="text-xs text-gray-500">{req.startDate} → {req.endDate}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total de solicitudes:</span>
                      <span className="font-semibold text-gray-900">{requests.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">XMLs estimados:</span>
                      <span className="font-semibold text-gray-900">~{estimatedXMLs}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tiempo estimado:</span>
                      <span className="font-semibold text-gray-900">
                        ~{Math.ceil(requests.length * 1.5)} min
                      </span>
                    </div>
                  </div>

                  {requests.length > 5 && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-700 flex items-start">
                        <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        Proceso extenso. Se recomienda mantener la sesión activa durante toda la descarga.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Download Progress */}
            {isDownloading && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Progreso de descarga
                </h3>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Solicitud {currentRequest} de {requests.length}</span>
                      <span className="font-semibold text-indigo-600">{Math.round(downloadProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
                    <div className="flex items-center">
                      <Download className="w-5 h-5 text-indigo-600 mr-2" />
                      <div>
                        <div className="text-2xl font-bold text-indigo-600">{downloadedCount}</div>
                        <div className="text-xs text-gray-600">XMLs descargados</div>
                      </div>
                    </div>
                    <Loader2 className={`w-8 h-8 text-indigo-600 ${isPaused ? '' : 'animate-spin'}`} />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handlePauseResume}
                      className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition flex items-center justify-center"
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
              </div>
            )}

            {/* Action Buttons */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              {!isDownloading ? (
                <button
                  onClick={handleStartDownload}
                  disabled={requests.length === 0}
                  className={`w-full py-4 rounded-lg font-semibold text-white transition flex items-center justify-center ${
                    requests.length === 0
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Iniciar Descarga
                </button>
              ) : downloadProgress === 100 ? (
                <button
                  onClick={handleReset}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-white transition flex items-center justify-center"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Nueva Descarga
                </button>
              ) : null}

              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p>• El SAT limita cada solicitud a 1 mes máximo</p>
                <p>• Se recomienda esperar 2-3 segundos entre solicitudes</p>
                <p>• Los XMLs se guardan automáticamente en Firebase Storage</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Confirmar descarga
            </h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tipo de CFDI:</span>
                <span className="text-sm font-semibold text-gray-900 capitalize">{cfdiType}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Solicitudes:</span>
                <span className="text-sm font-semibold text-gray-900">{requests.length}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">XMLs estimados:</span>
                <span className="text-sm font-semibold text-gray-900">~{estimatedXMLs}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tiempo estimado:</span>
                <span className="text-sm font-semibold text-gray-900">~{Math.ceil(requests.length * 1.5)} minutos</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-blue-700 flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                Mantén esta ventana abierta durante todo el proceso. Las descargas se reanudarán automáticamente en caso de error.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDownload}
                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold text-white transition"
              >
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NBKDownloadManager;