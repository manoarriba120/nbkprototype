/**
 * Componentes para filtros de año/mes y clientes/proveedores
 * Agregar estos componentes al NBK_Demo.html
 */

// ============================================================================
// 1. COMPONENTE DE FILTROS DE AÑO/MES
// ============================================================================

const FiltrosPeriodo = ({ empresaActiva, onPeriodoChange }) => {
    const [añoSeleccionado, setAñoSeleccionado] = React.useState(new Date().getFullYear());
    const [mesSeleccionado, setMesSeleccionado] = React.useState('');
    const [estadisticasFiltradas, setEstadisticasFiltradas] = React.useState(null);
    const [loading, setLoading] = React.useState(false);

    // Generar años disponibles (últimos 5 años)
    const años = [];
    const añoActual = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
        años.push(añoActual - i);
    }

    const meses = [
        { valor: '', label: 'Todo el año' },
        { valor: '1', label: 'Enero' },
        { valor: '2', label: 'Febrero' },
        { valor: '3', label: 'Marzo' },
        { valor: '4', label: 'Abril' },
        { valor: '5', label: 'Mayo' },
        { valor: '6', label: 'Junio' },
        { valor: '7', label: 'Julio' },
        { valor: '8', label: 'Agosto' },
        { valor: '9', label: 'Septiembre' },
        { valor: '10', label: 'Octubre' },
        { valor: '11', label: 'Noviembre' },
        { valor: '12', label: 'Diciembre' }
    ];

    // Cargar estadísticas cuando cambie el período
    React.useEffect(() => {
        if (empresaActiva) {
            cargarEstadisticasPeriodo();
        }
    }, [añoSeleccionado, mesSeleccionado, empresaActiva]);

    const cargarEstadisticasPeriodo = async () => {
        if (!empresaActiva) return;

        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                año: añoSeleccionado
            });

            if (mesSeleccionado) {
                queryParams.append('mes', mesSeleccionado);
            }

            const response = await fetch(`/api/companies/${empresaActiva.rfc}/stats/periodo?${queryParams}`);
            const data = await response.json();

            if (data.success) {
                setEstadisticasFiltradas(data.estadisticas);
                if (onPeriodoChange) {
                    onPeriodoChange(data.estadisticas);
                }
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!empresaActiva) return null;

    return (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtrar por Período</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Selector de Año */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Año
                    </label>
                    <select
                        value={añoSeleccionado}
                        onChange={(e) => setAñoSeleccionado(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        {años.map(año => (
                            <option key={año} value={año}>{año}</option>
                        ))}
                    </select>
                </div>

                {/* Selector de Mes */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mes
                    </label>
                    <select
                        value={mesSeleccionado}
                        onChange={(e) => setMesSeleccionado(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        {meses.map(mes => (
                            <option key={mes.valor} value={mes.valor}>{mes.label}</option>
                        ))}
                    </select>
                </div>

                {/* Botón de actualizar */}
                <div className="flex items-end">
                    <button
                        onClick={cargarEstadisticasPeriodo}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:bg-gray-400"
                    >
                        {loading ? 'Cargando...' : 'Actualizar'}
                    </button>
                </div>
            </div>

            {/* Mostrar resultados */}
            {estadisticasFiltradas && !loading && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600">Total XMLs</div>
                        <div className="text-2xl font-bold text-gray-900">{estadisticasFiltradas.total}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600">Vigentes</div>
                        <div className="text-2xl font-bold text-green-600">{estadisticasFiltradas.vigentes}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600">Canceladas</div>
                        <div className="text-2xl font-bold text-red-600">{estadisticasFiltradas.canceladas}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600">Ingresos</div>
                        <div className="text-xl font-bold text-blue-600">
                            ${estadisticasFiltradas.ingresos.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// 2. COMPONENTE DE CLIENTES Y PROVEEDORES
// ============================================================================

const ClientesProveedores = ({ empresaActiva }) => {
    const [datos, setDatos] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [vistaActiva, setVistaActiva] = React.useState('clientes'); // 'clientes' o 'proveedores'

    React.useEffect(() => {
        if (empresaActiva) {
            cargarClientesProveedores();
        }
    }, [empresaActiva]);

    const cargarClientesProveedores = async () => {
        if (!empresaActiva) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/companies/${empresaActiva.rfc}/clientes-proveedores`);
            const data = await response.json();

            if (data.success) {
                setDatos(data);
            }
        } catch (error) {
            console.error('Error cargando clientes/proveedores:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!empresaActiva) return null;
    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando datos...</p>
                </div>
            </div>
        );
    }

    if (!datos) return null;

    const listaActual = vistaActiva === 'clientes' ? datos.clientes : datos.proveedores;

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex">
                    <button
                        onClick={() => setVistaActiva('clientes')}
                        className={`flex-1 px-6 py-4 text-center font-medium transition ${
                            vistaActiva === 'clientes'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        Clientes ({datos.clientes.length})
                        <div className="text-sm text-gray-500 mt-1">
                            ${datos.totales.montoTotalClientes.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                        </div>
                    </button>
                    <button
                        onClick={() => setVistaActiva('proveedores')}
                        className={`flex-1 px-6 py-4 text-center font-medium transition ${
                            vistaActiva === 'proveedores'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        Proveedores ({datos.proveedores.length})
                        <div className="text-sm text-gray-500 mt-1">
                            ${datos.totales.montoTotalProveedores.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                        </div>
                    </button>
                </div>
            </div>

            {/* Lista */}
            <div className="overflow-x-auto">
                {listaActual.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        No hay {vistaActiva} registrados
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No.</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">RFC</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nombre / Razón Social</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Facturas</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Monto Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {listaActual.map((item, index) => (
                                <tr key={item.rfc} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-sm text-gray-900">{item.rfc}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{item.nombre}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{item.totalFacturas}</td>
                                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                                        ${item.totalMonto.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// INSTRUCCIONES DE INTEGRACIÓN
// ============================================================================

/*
PARA INTEGRAR EN NBK_Demo.html:

1. Agregar los componentes dentro del dashboard (después de las stats cards):

   {currentView === 'dashboard' && empresaActiva && (
       <div className="space-y-6">
           <FiltrosPeriodo
               empresaActiva={empresaActiva}
               onPeriodoChange={(stats) => console.log('Stats filtradas:', stats)}
           />

           <ClientesProveedores empresaActiva={empresaActiva} />
       </div>
   )}

2. Los componentes ya están listos para usar, solo copiar y pegar en la sección correcta.

3. UBICACIÓN EXACTA: Buscar en NBK_Demo.html la línea que dice:
   "Dashboard Ejecutivo" o "currentView === 'dashboard'"

   Y agregar los componentes después de las tarjetas de estadísticas.
*/
