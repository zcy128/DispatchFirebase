import React, { useState, useEffect, useMemo, useRef, useDeferredValue, useId, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AssignmentHistoryService, isColdRecord } from '../services/assignmentHistoryService';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import {
  AssignmentHistoryRecord,
  AssignmentAction
} from '../types/assignmentHistory';
import {
  History,
  Search,
  Filter,
  UserCheck,
  UserX,
  Bus,
  Truck,
  Clock,
  ArrowRightLeft,
  RefreshCw,
  Download,
  CheckCircle2,
  User,
  Navigation,
  GraduationCap,
  Info
} from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

// Lazy-load heavy subpanels to optimize initial chunk bundle size per Vercel best practices
const RouteAuditHistoryPanel = React.lazy(() =>
  import('../components/routes/RouteAuditHistoryPanel').then((m) => ({ default: m.RouteAuditHistoryPanel }))
);
const EntityOperationLogPanel = React.lazy(() =>
  import('../components/common/EntityOperationLogPanel').then((m) => ({ default: m.EntityOperationLogPanel }))
);

export const AssignmentTrackingView: React.FC = () => {
  const { isFrench } = useI18n();
  const [history, setHistory] = useState<AssignmentHistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Time Range: '1year' (live data <= 1 year) | 'all' (cold storage in BigQuery > 1 year)
  const [timeRange, setTimeRange] = useState<'1year' | 'all'>('1year');

  // Active Tab: 'all' | 'driver_route' | 'driver_vehicle' | 'route_modifications' | 'entity_operations'
  const [activeTab, setActiveTab] = useState<'all' | 'driver_route' | 'driver_vehicle' | 'route_modifications' | 'entity_operations'>('all');

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedRouteNo, setSelectedRouteNo] = useState<string>('');
  const [selectedUnitNumber, setSelectedUnitNumber] = useState<string>('');
  const [selectedDispatcher, setSelectedDispatcher] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<AssignmentAction | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const keywordsId = useId();
  const driverFilterId = useId();
  const routeFilterId = useId();
  const vehicleFilterId = useId();
  const dispatcherFilterId = useId();
  const actionFilterId = useId();
  const dateFilterId = useId();

  const isArchivedDate = (effectiveDate?: string, timestamp?: string) => {
    return isColdRecord(effectiveDate, timestamp);
  };

  const loadHistory = async (targetQuery?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q && !selectedDriverId && !selectedRouteNo && !selectedUnitNumber && !selectedDate) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await AssignmentHistoryService.listHistory({
        timeRange,
        type: activeTab !== 'route_modifications' && activeTab !== 'entity_operations' ? activeTab : 'all',
        action: selectedAction,
        driverId: selectedDriverId,
        routeNo: selectedRouteNo,
        unitNumber: selectedUnitNumber,
        searchQuery: q,
        dateFrom: selectedDate,
        dateTo: selectedDate,
      });
      setHistory(data);
    } catch (err) {
      console.error('Failed to load assignment history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Deferred search query to keep typing responsive at 60fps (Vercel rerender-use-deferred-value)
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Subscribe to real-time events (<= 1 year live data)
  // Decoupled from dropdown filter changes to prevent tearing down Firestore listeners (Vercel client-event-listeners)
  useEffect(() => {
    if (timeRange !== '1year') return;
    setLoading(true);
    const unsubscribe = AssignmentHistoryService.subscribeToHistory(
      (records) => {
        setHistory(records);
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [timeRange]);

  useEffect(() => {
    if (timeRange !== 'all') return;
    const handle = window.setTimeout(() => {
      loadHistory();
    }, 300);
    return () => window.clearTimeout(handle);
  }, [timeRange, searchQuery, activeTab, selectedAction, selectedDriverId, selectedRouteNo, selectedUnitNumber, selectedDate]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    if (timeRange === '1year') {
      const records = await AssignmentHistoryService.listHistory({ timeRange: '1year' });
      setHistory(records);
    } else {
      await loadHistory();
    }
    setRefreshing(false);
  };

  // Single-pass extraction for historical filter dropdown options (Vercel js-combine-iterations)
  const { historicalDrivers, historicalDispatchers, historicalRoutes, historicalVehicles } = useMemo(() => {
    const driversMap = new Map<string, string>();
    const dispatchersSet = new Set<string>();
    const routesSet = new Set<string>();
    const vehiclesSet = new Set<string>();

    for (const h of history) {
      if (h.driverId) driversMap.set(h.driverId, h.driverName);
      const actor = h.dispatcherName || h.assignedBy;
      if (actor) dispatchersSet.add(actor);
      if (h.routeNo) routesSet.add(h.routeNo);
      if (h.unitNumber) vehiclesSet.add(h.unitNumber);
    }

    return {
      historicalDrivers: Array.from(driversMap.entries()).map(([id, name]) => ({ id, name })),
      historicalDispatchers: Array.from(dispatchersSet).sort(),
      historicalRoutes: Array.from(routesSet).sort(),
      historicalVehicles: Array.from(vehiclesSet).sort(),
    };
  }, [history]);

  // Filtered records evaluated with deferred search query
  const filteredRecords = useMemo(() => {
    return history.filter((rec) => {
      // Type / Tab filter
      if (activeTab !== 'all' && rec.type !== activeTab) {
        return false;
      }

      // Action filter
      if (selectedAction !== 'all' && rec.action !== selectedAction) {
        return false;
      }

      // Driver filter
      if (selectedDriverId && rec.driverId !== selectedDriverId) {
        return false;
      }

      // Route filter
      if (selectedRouteNo && rec.routeNo !== selectedRouteNo) {
        return false;
      }

      // Vehicle filter
      if (selectedUnitNumber && rec.unitNumber !== selectedUnitNumber) {
        return false;
      }

      // Dispatcher filter
      if (selectedDispatcher) {
        const actor = rec.dispatcherName || rec.assignedBy || '';
        if (!actor.toLowerCase().includes(selectedDispatcher.toLowerCase())) {
          return false;
        }
      }

      // Date filter
      if (selectedDate && rec.effectiveDate !== selectedDate) {
        return false;
      }

      // Freeform Search using deferred query to prevent input stutter
      if (deferredSearchQuery.trim()) {
        const q = deferredSearchQuery.trim().toLowerCase();
        const match =
          rec.driverName.toLowerCase().includes(q) ||
          rec.driverId.toLowerCase().includes(q) ||
          (rec.routeNo && rec.routeNo.toLowerCase().includes(q)) ||
          (rec.routeName && rec.routeName.toLowerCase().includes(q)) ||
          (rec.unitNumber && rec.unitNumber.toLowerCase().includes(q)) ||
          (rec.reason && rec.reason.toLowerCase().includes(q)) ||
          (rec.assignedBy && rec.assignedBy.toLowerCase().includes(q)) ||
          (rec.dispatcherName && rec.dispatcherName.toLowerCase().includes(q)) ||
          (rec.dispatcherId && rec.dispatcherId.toLowerCase().includes(q)) ||
          (rec.dispatcherRole && rec.dispatcherRole.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [
    history,
    activeTab,
    selectedAction,
    selectedDriverId,
    selectedRouteNo,
    selectedUnitNumber,
    selectedDispatcher,
    selectedDate,
    deferredSearchQuery
  ]);

  // Single-pass aggregate stats calculation (Vercel js-combine-iterations)
  const stats = useMemo(() => {
    let routeAssignments = 0;
    let routeUnassignments = 0;
    let vehicleAssignments = 0;
    let vehicleUnassignments = 0;
    let activeCurrentHolds = 0;

    for (const r of filteredRecords) {
      if (r.isCurrent) activeCurrentHolds++;
      if (r.type === 'driver_route') {
        if (r.action === 'assign') routeAssignments++;
        else if (r.action === 'unassign') routeUnassignments++;
      } else if (r.type === 'driver_vehicle') {
        if (r.action === 'assign') vehicleAssignments++;
        else if (r.action === 'unassign') vehicleUnassignments++;
      }
    }

    return {
      total: filteredRecords.length,
      routeAssignments,
      routeUnassignments,
      vehicleAssignments,
      vehicleUnassignments,
      activeCurrentHolds
    };
  }, [filteredRecords]);

  // Virtual scrolling for 1,000+ assignment tracking records
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredRecords.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      'Timestamp',
      'Effective Date',
      'Type',
      'Action',
      'Driver Name',
      'Driver ID',
      'Route No',
      'Route Name',
      'Unit Number',
      'Status',
      'Reason',
      'Assigned By (Dispatcher)',
      'Dispatcher ID',
      'Dispatcher Role'
    ];
    const rows = filteredRecords.map((r) => [
      `"${r.timestamp}"`,
      `"${r.effectiveDate}"`,
      `"${r.type === 'driver_route' ? 'Driver-to-Route' : 'Driver-to-Vehicle'}"`,
      `"${r.action}"`,
      `"${r.driverName}"`,
      `"${r.driverId}"`,
      `"${r.routeNo || ''}"`,
      `"${r.routeName || ''}"`,
      `"${r.unitNumber || ''}"`,
      `"${r.isCurrent ? 'Currently Active' : 'Completed/Ended'}"`,
      `"${r.reason || ''}"`,
      `"${r.dispatcherName || r.assignedBy || ''}"`,
      `"${r.dispatcherId || ''}"`,
      `"${r.dispatcherRole || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `assignment_tracking_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDriverId('');
    setSelectedRouteNo('');
    setSelectedUnitNumber('');
    setSelectedDispatcher('');
    setSelectedAction('all');
    setSelectedDate('');
  };

  return (
    <PageShell>
      {/* Header Banner */}
      <PageHeader
        title="Assignment Lifecycle & Audit Tracking"
        subtitle="Historical timeline of driver-to-route assignments, unassignments, and vehicle allocations"
        icon={
          <div aria-hidden="true" className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
        }
        actions={
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="min-h-[32px] flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <RefreshCw aria-hidden="true" className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
              className="min-h-[32px] flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <Download aria-hidden="true" className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
            Total Audit Events
          </span>
          <div className="text-2xl font-black text-white mt-1">{stats.total}</div>
          <span className="text-[11px] text-slate-400">Events matching active filters</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-sky-400 block tracking-wider">
            Route Assigned / Released
          </span>
          <div className="text-2xl font-black text-sky-400 mt-1 flex items-center space-x-2">
            <span>+{stats.routeAssignments}</span>
            <span className="text-slate-500 text-lg">/</span>
            <span className="text-rose-400">-{stats.routeUnassignments}</span>
          </div>
          <span className="text-[11px] text-slate-400">Driver ↔ Route allocations</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-amber-400 block tracking-wider">
            Vehicle Assigned / Released
          </span>
          <div className="text-2xl font-black text-amber-400 mt-1 flex items-center space-x-2">
            <span>+{stats.vehicleAssignments}</span>
            <span className="text-slate-500 text-lg">/</span>
            <span className="text-rose-400">-{stats.vehicleUnassignments}</span>
          </div>
          <span className="text-[11px] text-slate-400">Driver ↔ Vehicle allocations</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-emerald-400 block tracking-wider">
            Active Current Holds
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center space-x-1.5">
            <CheckCircle2 aria-hidden="true" className="w-5 h-5" />
            <span>{stats.activeCurrentHolds}</span>
          </div>
          <span className="text-[11px] text-slate-400">Ongoing active assignments</span>
        </div>
      </div>

      {/* Primary Category Switcher Tabs */}
      <div role="group" aria-label="Audit tracking categories" className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          aria-pressed={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          className={`min-h-[36px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            activeTab === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <History aria-hidden="true" className="w-4 h-4" />
          <span>All Assignments & Life-Cycles</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'driver_route'}
          onClick={() => setActiveTab('driver_route')}
          className={`min-h-[36px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            activeTab === 'driver_route'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Bus aria-hidden="true" className="w-4 h-4" />
          <span>Driver ↔ Route Tracking</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'driver_vehicle'}
          onClick={() => setActiveTab('driver_vehicle')}
          className={`min-h-[36px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            activeTab === 'driver_vehicle'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Truck aria-hidden="true" className="w-4 h-4" />
          <span>Driver ↔ Vehicle Tracking</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'route_modifications'}
          onClick={() => setActiveTab('route_modifications')}
          className={`min-h-[36px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            activeTab === 'route_modifications'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Navigation aria-hidden="true" className="w-4 h-4" />
          <span>Route, Shift & Stop Changes</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'entity_operations'}
          onClick={() => setActiveTab('entity_operations')}
          className={`min-h-[36px] flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            activeTab === 'entity_operations'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <GraduationCap aria-hidden="true" className="w-4 h-4" />
          <span>Student & Vehicle Audit Logs</span>
        </button>
      </div>

      {activeTab === 'route_modifications' ? (
        <Suspense
          fallback={
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />
              Loading route audit logs...
            </div>
          }
        >
          <RouteAuditHistoryPanel />
        </Suspense>
      ) : activeTab === 'entity_operations' ? (
        <Suspense
          fallback={
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />
              Loading entity operations audit...
            </div>
          }
        >
          <EntityOperationLogPanel
            targetType="all"
            title="Student & Vehicle Fleet Operations Audit"
            subtitle="Comprehensive audit trail tracking creates, updates, and deletes for students and fleet vehicles"
          />
        </Suspense>
      ) : (
        <>
          {/* Multi-Faceted Query & Filter Bar */}
      <search aria-label="Filter assignment audit records" className="block bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-2.5 gap-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Filter aria-hidden="true" className="w-4 h-4 text-amber-400" />
            <span>Targeted History Query</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Time Range Filter (1-Year Live vs All History BigQuery) */}
            <div role="group" aria-label={isFrench ? 'Plage temporelle' : 'Time range'} className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                aria-pressed={timeRange === '1year'}
                onClick={() => setTimeRange('1year')}
                className={`min-h-[28px] px-3 py-1.5 rounded-lg text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                  timeRange === '1year'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⏱️ {isFrench ? 'En direct (≤1 an)' : 'Live (≤1 Year)'}
              </button>
              <button
                type="button"
                aria-pressed={timeRange === 'all'}
                onClick={() => setTimeRange('all')}
                className={`min-h-[28px] px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                  timeRange === 'all'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🧊 {isFrench ? 'Tout l\'historique (Archive BigQuery)' : 'All History (BigQuery Archive)'}</span>
              </button>
            </div>

            {(searchQuery || selectedDriverId || selectedRouteNo || selectedUnitNumber || selectedAction !== 'all' || selectedDate) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[28px] px-2 rounded text-[11px] font-semibold text-rose-400 hover:text-rose-300 ml-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                {isFrench ? 'Réinitialiser les filtres' : 'Reset Filters'}
              </button>
            )}
          </div>
        </div>

        {/* 5-Year Safe Scan Notice Banner */}
        {timeRange === 'all' && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs text-amber-300">
            <Info aria-hidden="true" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-200 flex items-center gap-1.5">
                <span>{isFrench ? 'Mode Tout l\'historique (Archive froide BigQuery)' : 'All History Mode (BigQuery Cold Archive)'}</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium border border-amber-500/30">
                  {isFrench ? 'Recherche sécurisée 5 ans' : '5-Year Safe Scan'}
                </span>
              </div>
              <p className="text-slate-300">
                {isFrench
                  ? 'Les affectations en direct couvrent la dernière année. Les données plus anciennes sont archivées dans BigQuery (jusqu\'à 5 ans). Pour éviter une analyse complète, veuillez saisir un nom de chauffeur, matricule, route, véhicule ou mot-clé.'
                  : 'Live assignment lifecycle records cover the most recent 1 year. Older data is stored in BigQuery cold archives (up to 5 years). To prevent unbounded full-table scans, please enter a driver name, employee ID, route #, vehicle unit #, or keyword.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Freeform Search */}
          <div>
            <label htmlFor={keywordsId} className="block text-[11px] font-semibold text-slate-400 mb-1">Keywords</label>
            <div className="relative">
              <Search aria-hidden="true" className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                id={keywordsId}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Driver, route, bus..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-base sm:text-xs text-white placeholder-slate-500 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              />
            </div>
          </div>

          {/* Driver Select */}
          <div>
            <label htmlFor={driverFilterId} className="block text-[11px] font-semibold text-slate-400 mb-1">Query by Driver</label>
            <select
              id={driverFilterId}
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <option value="">All Drivers</option>
              {historicalDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.id})
                </option>
              ))}
            </select>
          </div>

          {/* Route Select */}
          <div>
            <label htmlFor={routeFilterId} className="block text-[11px] font-semibold text-slate-400 mb-1">Query by Route</label>
            <select
              id={routeFilterId}
              value={selectedRouteNo}
              onChange={(e) => setSelectedRouteNo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 font-mono"
            >
              <option value="">All Routes</option>
              {historicalRoutes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Select */}
          <div>
            <label htmlFor={vehicleFilterId} className="block text-[11px] font-semibold text-slate-400 mb-1">Query by Vehicle</label>
            <select
              id={vehicleFilterId}
              value={selectedUnitNumber}
              onChange={(e) => setSelectedUnitNumber(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 font-mono"
            >
              <option value="">All Vehicles</option>
              {historicalVehicles.map((u) => (
                <option key={u} value={u}>
                  Unit #{u}
                </option>
              ))}
            </select>
          </div>

          {/* Dispatcher Select */}
          <div>
            <label htmlFor={dispatcherFilterId} className="block text-[11px] font-semibold text-slate-400 mb-1">Changed by Dispatcher</label>
            <select
              id={dispatcherFilterId}
              value={selectedDispatcher}
              onChange={(e) => setSelectedDispatcher(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <option value="">All Dispatchers</option>
              {historicalDispatchers.map((disp) => (
                <option key={disp} value={disp}>
                  {disp}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label htmlFor={actionFilterId} className="block text-[11px] font-semibold text-slate-400 mb-1">Lifecycle Action</label>
            <select
              id={actionFilterId}
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <option value="all">All Actions</option>
              <option value="assign">Assigned (+)</option>
              <option value="unassign">Unassigned / Released (-)</option>
              <option value="reassign">Reassigned (⇄)</option>
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label htmlFor={dateFilterId} className="block text-[11px] font-semibold text-slate-400 mb-1">Effective Date</label>
            <input
              id={dateFilterId}
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-white focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            />
          </div>
        </div>
      </search>

      {/* Main Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Assignment Audit Records
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
              {filteredRecords.length} found
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Real-time assignment synchronization
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />
            Loading assignment timeline...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            {timeRange === 'all' && !searchQuery.trim() && !selectedDriverId && !selectedRouteNo && !selectedUnitNumber && !selectedDate && selectedAction === 'all' ? (
              <>
                <Search className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-200">
                  {isFrench ? 'Rechercher dans les archives d\'affectation' : 'Search Historical Assignment Archives'}
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isFrench
                    ? 'Mode Tout l\'historique actif. Entrez un chauffeur, matricule, route, véhicule ou mot-clé pour interroger les archives BigQuery.'
                    : 'Currently in All History mode. Enter a driver, employee ID, route, vehicle #, or keyword to query BigQuery archives older than 1 year.'}
                </p>
              </>
            ) : (
              <>
                <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">
                  {isFrench ? 'Aucun enregistrement d\'affectation trouvé' : 'No assignment records found'}
                </p>
                <p className="text-xs text-slate-500">
                  {isFrench ? 'Ajustez vos filtres de chauffeur, route ou véhicule ci-dessus.' : 'Try adjusting your driver, route, or vehicle query filters above.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div ref={tableContainerRef} tabIndex={0} role="region" aria-label="Assignment audit records table" className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
            <table className="w-full text-left border-collapse table-fixed min-w-[1150px]">
              <caption className="sr-only">Assignment lifecycle and audit records</caption>
              <colgroup>
                <col style={{ width: '160px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ minWidth: '160px' }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 shadow-xs">
                <tr>
                  <th scope="col" className="py-3 px-4">Effective Timeline</th>
                  <th scope="col" className="py-3 px-4">Assignment Category</th>
                  <th scope="col" className="py-3 px-4">Action</th>
                  <th scope="col" className="py-3 px-4">Driver Profile</th>
                  <th scope="col" className="py-3 px-4">Assigned Target (Route / Bus)</th>
                  <th scope="col" className="py-3 px-4">Current Status</th>
                  <th scope="col" className="py-3 px-4">Changed by Dispatcher</th>
                  <th scope="col" className="py-3 px-4">Assignment Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={8} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const rec = filteredRecords[virtualRow.index];
                  if (!rec) return null;
                  const isRoute = rec.type === 'driver_route';
                  const isAssign = rec.action === 'assign';
                  const isUnassign = rec.action === 'unassign';
                  const timeStr = rec.timestamp.includes('T')
                    ? rec.timestamp.split('T')[1].slice(0, 5)
                    : '';
                  const dispatcherDisplayName = rec.dispatcherName || rec.assignedBy || 'Dispatcher';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors h-16">
                      {/* Timeline */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-white font-mono font-medium">{rec.effectiveDate}</span>
                          {isArchivedDate(rec.effectiveDate, rec.timestamp) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap">
                              🧊 {isFrench ? 'Archive BigQuery (>1 an)' : 'BigQuery Archive (>1y)'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Logged: {timeStr}</span>
                        </div>
                      </td>

                      {/* Assignment Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isRoute ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <Bus className="w-3.5 h-3.5" />
                            <span>Driver ↔ Route</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Truck className="w-3.5 h-3.5" />
                            <span>Driver ↔ Vehicle</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAssign ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Assigned</span>
                          </span>
                        ) : isUnassign ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <UserX className="w-3.5 h-3.5" />
                            <span>Unassigned / Released</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Reassigned</span>
                          </span>
                        )}
                      </td>

                      {/* Driver */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{rec.driverName}</div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          ID: {rec.driverId}
                        </span>
                      </td>

                      {/* Target (Route / Bus) */}
                      <td className="py-3.5 px-4">
                        {isRoute && rec.routeNo ? (
                          <div>
                            <span className="font-mono font-bold text-amber-300 text-xs">
                              {rec.routeNo}
                            </span>
                            {rec.routeName && (
                              <div className="text-[11px] text-slate-400 truncate max-w-xs" title={rec.routeName}>
                                {rec.routeName}
                              </div>
                            )}
                            {rec.unitNumber && (
                              <span className="text-[10px] text-slate-500 block font-mono">
                                Attached Bus: Unit #{rec.unitNumber}
                              </span>
                            )}
                          </div>
                        ) : rec.unitNumber ? (
                          <div>
                            <span className="font-mono font-bold text-amber-300 text-xs">
                              Unit #{rec.unitNumber}
                            </span>
                            {rec.plateNumber && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                Plate: {rec.plateNumber}
                              </span>
                            )}
                            {rec.routeNo && (
                              <span className="text-[10px] text-sky-400 block font-mono">
                                On Route: {rec.routeNo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>

                      {/* Current Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {rec.isCurrent ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Active Standing</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>Ended {rec.endDate ? `(${rec.endDate})` : ''}</span>
                          </span>
                        )}
                      </td>

                      {/* Changed by Dispatcher */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[10px] text-amber-400 font-bold shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-white block text-xs">
                              {dispatcherDisplayName}
                            </span>
                            <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-mono">
                              {rec.dispatcherRole && (
                                <span className="uppercase text-amber-400/90 font-bold">
                                  [{rec.dispatcherRole}]
                                </span>
                              )}
                              {rec.dispatcherId && <span>{rec.dispatcherId}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Assignment Reason */}
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] text-slate-200">{rec.reason || 'Routine Assignment'}</div>
                        {rec.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5 italic">
                            {rec.notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={8} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}
    </PageShell>
  );
};
