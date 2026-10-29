import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AssignmentHistoryService, isColdRecord } from '../services/assignmentHistoryService';
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
import { RouteAuditHistoryPanel } from '../components/routes/RouteAuditHistoryPanel';
import { EntityOperationLogPanel } from '../components/common/EntityOperationLogPanel';
import { useI18n } from '../contexts/I18nContext';

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

  // Subscribe to real-time events (<= 1 year live data) or load targeted archives (> 1 year)
  useEffect(() => {
    if (timeRange === '1year') {
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
    } else {
      loadHistory();
    }
  }, [timeRange, activeTab, selectedAction, selectedDriverId, selectedRouteNo, selectedUnitNumber, selectedDate]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    if (timeRange === '1year') {
      const records = await AssignmentHistoryService.getHistory('1year');
      setHistory(records);
    } else {
      await loadHistory();
    }
    setRefreshing(false);
  };

  // Unique list of drivers that have history records
  const historicalDrivers = useMemo(() => {
    const map = new Map<string, string>();
    history.forEach((h) => {
      if (h.driverId) {
        map.set(h.driverId, h.driverName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [history]);

  // Unique list of dispatchers / actors who changed assignments
  const historicalDispatchers = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => {
      const name = h.dispatcherName || h.assignedBy;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [history]);

  // Unique list of routes in history
  const historicalRoutes = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => {
      if (h.routeNo) set.add(h.routeNo);
    });
    return Array.from(set).sort();
  }, [history]);

  // Unique list of vehicles in history
  const historicalVehicles = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => {
      if (h.unitNumber) set.add(h.unitNumber);
    });
    return Array.from(set).sort();
  }, [history]);

  // Filtered records
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

      // Freeform Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
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
    searchQuery
  ]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const routeAssignments = filteredRecords.filter((r) => r.type === 'driver_route' && r.action === 'assign').length;
    const routeUnassignments = filteredRecords.filter((r) => r.type === 'driver_route' && r.action === 'unassign').length;
    const vehicleAssignments = filteredRecords.filter((r) => r.type === 'driver_vehicle' && r.action === 'assign').length;
    const vehicleUnassignments = filteredRecords.filter((r) => r.type === 'driver_vehicle' && r.action === 'unassign').length;
    return {
      total,
      routeAssignments,
      routeUnassignments,
      vehicleAssignments,
      vehicleUnassignments
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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `assignment_tracking_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Assignment Lifecycle & Audit Tracking
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical timeline of driver-to-route assignments, unassignments, and vehicle allocations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

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
            <CheckCircle2 className="w-5 h-5" />
            <span>{filteredRecords.filter((r) => r.isCurrent).length}</span>
          </div>
          <span className="text-[11px] text-slate-400">Ongoing active assignments</span>
        </div>
      </div>

      {/* Primary Category Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>All Assignments & Life-Cycles</span>
        </button>

        <button
          onClick={() => setActiveTab('driver_route')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'driver_route'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Bus className="w-4 h-4" />
          <span>Driver ↔ Route Tracking</span>
        </button>

        <button
          onClick={() => setActiveTab('driver_vehicle')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'driver_vehicle'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Driver ↔ Vehicle Tracking</span>
        </button>

        <button
          onClick={() => setActiveTab('route_modifications')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'route_modifications'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Route, Shift & Stop Changes</span>
        </button>

        <button
          onClick={() => setActiveTab('entity_operations')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'entity_operations'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Student & Vehicle Audit Logs</span>
        </button>
      </div>

      {activeTab === 'route_modifications' ? (
        <RouteAuditHistoryPanel />
      ) : activeTab === 'entity_operations' ? (
        <EntityOperationLogPanel
          targetType="all"
          title="Student & Vehicle Fleet Operations Audit"
          subtitle="Comprehensive audit trail tracking creates, updates, and deletes for students and fleet vehicles"
        />
      ) : (
        <>
          {/* Multi-Faceted Query & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-2.5 gap-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Filter className="w-4 h-4 text-amber-400" />
            <span>Targeted History Query</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Time Range Filter (1-Year Live vs All History BigQuery) */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setTimeRange('1year')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  timeRange === '1year'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⏱️ {isFrench ? 'En direct (≤1 an)' : 'Live (≤1 Year)'}
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
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
                onClick={handleResetFilters}
                className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 ml-2"
              >
                {isFrench ? 'Réinitialiser les filtres' : 'Reset Filters'}
              </button>
            )}
          </div>
        </div>

        {/* 10-Year Safe Scan Notice Banner */}
        {timeRange === 'all' && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs text-amber-300">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-200 flex items-center gap-1.5">
                <span>{isFrench ? 'Mode Tout l\'historique (Archive froide BigQuery)' : 'All History Mode (BigQuery Cold Archive)'}</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium border border-amber-500/30">
                  {isFrench ? 'Recherche sécurisée 10 ans' : '10-Year Safe Scan'}
                </span>
              </div>
              <p className="text-slate-300">
                {isFrench
                  ? 'Les affectations en direct couvrent la dernière année. Les données plus anciennes sont archivées dans BigQuery. Pour éviter une analyse complète, veuillez saisir un nom de chauffeur, matricule, route, véhicule ou mot-clé.'
                  : 'Live assignment lifecycle records cover the most recent 1 year. Older data is stored in BigQuery cold archives. To prevent unbounded full-table scans, please enter a driver name, employee ID, route #, vehicle unit #, or keyword.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Freeform Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Driver, route, bus..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Driver Select */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Query by Driver</label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
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
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Query by Route</label>
            <select
              value={selectedRouteNo}
              onChange={(e) => setSelectedRouteNo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
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
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Query by Vehicle</label>
            <select
              value={selectedUnitNumber}
              onChange={(e) => setSelectedUnitNumber(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
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
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Changed by Dispatcher</label>
            <select
              value={selectedDispatcher}
              onChange={(e) => setSelectedDispatcher(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
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
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Lifecycle Action</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Actions</option>
              <option value="assign">Assigned (+)</option>
              <option value="unassign">Unassigned / Released (-)</option>
              <option value="reassign">Reassigned (⇄)</option>
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Effective Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

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
            {timeRange === 'all' && !searchQuery.trim() && !selectedDriverId && !selectedRouteNo && !selectedUnitNumber && !selectedDate ? (
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
          <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left border-collapse table-fixed min-w-[1150px]">
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
                  <th className="py-3 px-4">Effective Timeline</th>
                  <th className="py-3 px-4">Assignment Category</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Driver Profile</th>
                  <th className="py-3 px-4">Assigned Target (Route / Bus)</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Changed by Dispatcher</th>
                  <th className="py-3 px-4">Assignment Reason</th>
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
    </div>
  );
};
