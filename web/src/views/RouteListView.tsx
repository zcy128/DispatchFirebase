import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BusRoute, RouteStats, formatOpDays, getShiftBadgeStyle, isAutoMarryupEnabled } from '../types/route';
import { Student } from '../types/student';
import { Yard } from '../types/yard';
import { YardService } from '../services/yardService';
import { RouteService } from '../services/routeService';
import { RouteInlineDetail } from '../components/routes/RouteInlineDetail';
import { RouteEditModal } from '../components/routes/RouteEditModal';
import { useAuth } from '../contexts/AuthContext';
import { RouteAuditService } from '../services/routeAuditService';
import {
  Search,
  Filter,
  Bus,
  Clock,
  User,
  Phone,
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Calendar,
  Layers,
  FileText,
  Shield,
  UserCheck,
  SlidersHorizontal,
  History
} from 'lucide-react';

interface RouteListViewProps {
  routes: BusRoute[];
  stats: RouteStats;
  studentsMap: Record<number, Student>;
  loading?: boolean;
  onRefresh?: () => void;
  onSelectRoute: (route: BusRoute) => void;
  onSelectStudent?: (student: Student) => void;
  onAssignCrew?: (route: BusRoute) => void;
  onRouteUpdated?: (route: BusRoute) => void;
}

export const RouteListView: React.FC<RouteListViewProps> = ({
  routes,
  stats,
  studentsMap,
  onRefresh,
  onSelectRoute,
  onSelectStudent,
  onAssignCrew,
  onRouteUpdated
}) => {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [boardFilter, setBoardFilter] = useState('ALL');
  const [yardFilter, setYardFilter] = useState('ALL');
  const [opDaysFilter, setOpDaysFilter] = useState('ALL'); // ALL, MTWRF, ----F, MTWR-
  const [marryupFilter, setMarryupFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRouteIds, setExpandedRouteIds] = useState<Record<string, boolean>>({});
  const [yards, setYards] = useState<Yard[]>([]);
  const [editingRoute, setEditingRoute] = useState<BusRoute | null>(null);
  const [togglingRouteIds, setTogglingRouteIds] = useState<Record<string, boolean>>({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    YardService.list().then(setYards).catch((err) => {
      console.warn('Failed to load yards list:', err);
    });
  }, []);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleToggleAutoMarryup = async (e: React.MouseEvent, route: BusRoute) => {
    e.stopPropagation();
    if (togglingRouteIds[route.id]) return;

    const currentEnabled = isAutoMarryupEnabled(route);
    setTogglingRouteIds((prev) => ({ ...prev, [route.id]: true }));

    try {
      await RouteService.toggleAutoMarryup(route.id, currentEnabled);

      // Audit Log: Auto Marryup Toggle
      const nextEnabled = !currentEnabled;
      const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
      const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
      const actorRole = currentUser?.role || 'dispatcher';
      const actorEmail = currentUser?.email || undefined;

      RouteAuditService.logRouteChange({
        routeId: route.id,
        routeNo: route.routeNo,
        routeName: route.routeName,
        category: 'route',
        action: 'update',
        summary: `Toggled Auto Marryup to ${nextEnabled ? 'Enabled' : 'Disabled'} for Route ${route.routeNo}`,
        diffs: [
          { field: 'autoMarryup', fieldLabel: 'Auto Marryup', oldValue: currentEnabled, newValue: nextEnabled }
        ],
        userId: actorId,
        userName: actorName,
        userEmail: actorEmail,
        userRole: actorRole
      }).catch((auditErr) => console.warn('Auto Marryup audit log warning:', auditErr));

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Failed to toggle auto marryup:', err);
    } finally {
      setTogglingRouteIds((prev) => ({ ...prev, [route.id]: false }));
    }
  };

  const handleSaveRoute = async (routeId: string, updates: Partial<BusRoute>) => {
    await RouteService.updateRoute(routeId, updates);
    if (onRefresh) {
      await onRefresh();
    }
  };

  const toggleRouteExpand = (routeId: string) => {
    setExpandedRouteIds((prev) => ({
      ...prev,
      [routeId]: !prev[routeId]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    filteredRoutes.forEach((r) => {
      all[r.id] = true;
    });
    setExpandedRouteIds(all);
  };

  const collapseAll = () => {
    setExpandedRouteIds({});
  };

  const filteredRoutes = routes.filter((r) => {
    if (boardFilter !== 'ALL' && r.schoolBoardCode !== boardFilter) {
      return false;
    }
    if (yardFilter !== 'ALL' && r.yardName !== yardFilter) {
      return false;
    }
    if (marryupFilter === 'ENABLED' && !isAutoMarryupEnabled(r)) {
      return false;
    }
    if (marryupFilter === 'DISABLED' && isAutoMarryupEnabled(r)) {
      return false;
    }

    // Op Days filter: check if any of the route's shifts match the filter
    if (opDaysFilter !== 'ALL') {
      const hasMatchingShift = r.shifts?.some((s) => {
        const op = formatOpDays(s.runDays);
        if (opDaysFilter === '----F') {
          return op.includes('F') && !op.includes('M');
        }
        if (opDaysFilter === 'MTWR-') {
          return op.includes('M') && !op.includes('F');
        }
        if (opDaysFilter === 'MTWRF') {
          return op === 'MTWRF';
        }
        return op === opDaysFilter;
      });
      if (!hasMatchingShift) {
        return false;
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchNo = r.routeNo.toLowerCase().includes(term);
      const matchName = r.routeName.toLowerCase().includes(term);
      const matchDriver = (r.driverName || '').toLowerCase().includes(term);
      const matchVehicle = (r.unitNumber || '').toLowerCase().includes(term);
      const matchYard = (r.yardName || '').toLowerCase().includes(term);
      const matchShift = r.shifts?.some(
        (s) =>
          s.shiftType.toLowerCase().includes(term) ||
          (s.schoolsServiced || '').toLowerCase().includes(term)
      );

      if (!matchNo && !matchName && !matchDriver && !matchVehicle && !matchYard && !matchShift) {
        return false;
      }
    }

    return true;
  });

  const uniqueBoards = Array.from(new Set(routes.map((r) => r.schoolBoardCode).filter(Boolean)));
  const uniqueYards = Array.from(new Set(routes.map((r) => r.yardName).filter(Boolean)));
  const totalExpanded = Object.values(expandedRouteIds).filter(Boolean).length;

  // Virtual scrolling containers for 1,000+ routes
  const routeTableContainerRef = useRef<HTMLDivElement>(null);
  const routeMobileContainerRef = useRef<HTMLDivElement>(null);

  const routeTableVirtualizer = useVirtualizer({
    count: filteredRoutes.length,
    getScrollElement: () => routeTableContainerRef.current,
    estimateSize: (index) => {
      const r = filteredRoutes[index];
      return expandedRouteIds[r?.id] ? 380 : 54;
    },
    overscan: 8,
  });

  const virtualRoutes = routeTableVirtualizer.getVirtualItems();
  const routePaddingTop = virtualRoutes.length > 0 ? virtualRoutes[0]?.start || 0 : 0;
  const routePaddingBottom = virtualRoutes.length > 0
    ? routeTableVirtualizer.getTotalSize() - (virtualRoutes[virtualRoutes.length - 1]?.end || 0)
    : 0;

  const routeMobileVirtualizer = useVirtualizer({
    count: filteredRoutes.length,
    getScrollElement: () => routeMobileContainerRef.current,
    estimateSize: (index) => {
      const r = filteredRoutes[index];
      return expandedRouteIds[r?.id] ? 450 : 160;
    },
    overscan: 5,
  });

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto">
      {/* Top Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by route (e.g. OCDSB-001), school, assigned driver, bus unit #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition placeholder:text-slate-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 self-end md:self-auto">
            <button
              onClick={totalExpanded > 0 ? collapseAll : expandAll}
              className="px-3 sm:px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>{totalExpanded > 0 ? 'Collapse All' : 'Expand All'}</span>
            </button>

            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh routes from cloud"
                className="px-3 sm:px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filter Toggle Button */}
        <div className="flex md:hidden items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold flex items-center gap-1.5 text-slate-200"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Search & Filters</span>
            {(boardFilter !== 'ALL' || yardFilter !== 'ALL' || marryupFilter !== 'ALL' || opDaysFilter !== 'ALL') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
          </button>

          {(boardFilter !== 'ALL' || yardFilter !== 'ALL' || marryupFilter !== 'ALL' || opDaysFilter !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setBoardFilter('ALL');
                setYardFilter('ALL');
                setMarryupFilter('ALL');
                setOpDaysFilter('ALL');
                setSearchTerm('');
              }}
              className="text-xs text-rose-400 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className={`pt-2 border-t border-slate-800/80 text-xs ${showMobileFilters ? 'flex flex-col space-y-2.5' : 'hidden md:flex'} md:flex-row md:flex-wrap md:items-center gap-2`}>
          <div className="flex items-center space-x-1.5 text-slate-400 mr-2 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter by:</span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full md:w-auto">
            {/* School Board Filter */}
            <select
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-auto"
            >
              <option value="ALL">All Boards ({uniqueBoards.length})</option>
              {uniqueBoards.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Yard Filter */}
            <select
              value={yardFilter}
              onChange={(e) => setYardFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-auto"
            >
              <option value="ALL">All Yards ({uniqueYards.length})</option>
              {uniqueYards.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {/* Auto Marryup Filter */}
            <select
              value={marryupFilter}
              onChange={(e) => setMarryupFilter(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 col-span-2 sm:col-span-1 w-full sm:w-auto"
            >
              <option value="ALL">All Marryup</option>
              <option value="ENABLED">Auto Marryup</option>
              <option value="DISABLED">No Auto Marryup</option>
            </select>
          </div>

          {/* Op Days Filter (Weekdays vs Friday Early Dismissal) */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
            <button
              onClick={() => setOpDaysFilter('ALL')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                opDaysFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Op Days
            </button>
            <button
              onClick={() => setOpDaysFilter('MTWRF')}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition ${
                opDaysFilter === 'MTWRF'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              MTWRF
            </button>
            <button
              onClick={() => setOpDaysFilter('----F')}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition flex items-center space-x-1 ${
                opDaysFilter === '----F'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-purple-400 hover:bg-purple-500/10'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>----F (Fri Early)</span>
            </button>
            <button
              onClick={() => setOpDaysFilter('MTWR-')}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition ${
                opDaysFilter === 'MTWR-'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-sky-400 hover:bg-sky-500/10'
              }`}
            >
              MTWR-
            </button>
          </div>

          {(boardFilter !== 'ALL' || yardFilter !== 'ALL' || marryupFilter !== 'ALL' || opDaysFilter !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setBoardFilter('ALL');
                setYardFilter('ALL');
                setMarryupFilter('ALL');
                setOpDaysFilter('ALL');
                setSearchTerm('');
              }}
              className="hidden md:inline text-xs text-rose-400 hover:underline ml-auto font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center space-x-3 sm:space-x-3.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold shrink-0">
            <Bus className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-bold text-white tracking-tight">{stats.totalRoutes}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Active Bus Routes</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center space-x-3 sm:space-x-3.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {routes.reduce((acc, r) => acc + (r.shifts?.length || 2), 0)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Total Daily Shifts</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center space-x-3 sm:space-x-3.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-bold text-white tracking-tight">{stats.assignedDrivers}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Drivers Dispatched</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center space-x-3 sm:space-x-3.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-bold text-white tracking-tight">{stats.totalStops}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Total Stops Serviced</div>
          </div>
        </div>
      </div>

      {/* Routes Master-Detail Table & Mobile Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="font-bold text-white text-sm flex items-center space-x-2">
            <span>Route Network ({filteredRoutes.length} of {routes.length})</span>
            {opDaysFilter !== 'ALL' && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono">
                Filtered: {opDaysFilter}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 flex items-center space-x-3">
            <span>Click row or + to expand stops itinerary</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-emerald-400 font-semibold hidden sm:inline">Real-time onSnapshot</span>
          </div>
        </div>

        {filteredRoutes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Bus className="w-8 h-8 mx-auto text-slate-600" />
            <div className="font-semibold text-sm">No routes match current filter criteria</div>
            <div className="text-xs text-slate-600">Try changing board, yard, or Op Days criteria</div>
          </div>
        ) : (
          <>
            {/* Desktop Table View (visible on md screens and up) */}
            <div ref={routeTableContainerRef} className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[11px] shadow-xs">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-4">Route Info</th>
                    <th className="py-3 px-4">Board & Yard</th>
                    <th className="py-3 px-4">Assigned Crew</th>
                    <th className="py-3 px-4">Operational Shifts (Op Days)</th>
                    <th className="py-3 px-4 text-center">Stops / Riders</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {routePaddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${routePaddingTop}px`, padding: 0, border: 0 }} colSpan={7} />
                    </tr>
                  )}
                  {virtualRoutes.map((virtualRow) => {
                    const r = filteredRoutes[virtualRow.index];
                    if (!r) return null;
                    const isExpanded = !!expandedRouteIds[r.id];

                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onClick={() => toggleRouteExpand(r.id)}
                          className={`hover:bg-slate-800/40 transition cursor-pointer group ${
                            isExpanded ? 'bg-slate-850/50' : ''
                          }`}
                        >
                          {/* Expand / Collapse Toggle */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRouteExpand(r.id);
                              }}
                              className={`p-1 rounded-lg border transition ${
                                isExpanded
                                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                              }`}
                              title={isExpanded ? 'Collapse stops' : 'Expand stops table'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 font-black" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>

                          {/* Route No & Name */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xs flex-shrink-0">
                                <Bus className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-bold text-white group-hover:text-amber-400 transition flex items-center space-x-2">
                                  <span>{r.routeNo}</span>
                                  {!isAutoMarryupEnabled(r) && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      No Auto Marryup
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={r.routeName}>
                                  {r.routeName}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Board & Yard */}
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-200">
                              {r.schoolBoardCode || 'OCDSB'}
                            </div>
                            <div className="flex items-center space-x-1 text-[11px] text-slate-400 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span>{r.yardName}</span>
                            </div>
                          </td>

                          {/* Assigned Crew (Driver & Bus) */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-200 flex items-center space-x-1">
                                <User className="w-3.5 h-3.5 text-amber-400" />
                                <span>{r.driverName || 'Unassigned'}</span>
                              </div>
                              {r.attendantName && (
                                <div className="text-[10px] text-indigo-300 flex items-center space-x-1">
                                  <Shield className="w-3 h-3 text-indigo-400" />
                                  <span>Monitor: {r.attendantName}</span>
                                </div>
                              )}
                              {r.driverPhone && (
                                <a
                                  href={`tel:${r.driverPhone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-amber-400 hover:underline font-mono text-[11px] flex items-center space-x-1"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{r.driverPhone}</span>
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Operational Shifts (Dynamic Shift Badges Flow) */}
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-[380px]">
                              {r.shifts && r.shifts.length > 0 ? (
                                r.shifts.map((s) => {
                                  const opDays = formatOpDays(s.runDays);
                                  const isEarly = opDays === '----F' || s.shiftType.toUpperCase().includes('NOON');
                                  const badgeStyle = getShiftBadgeStyle(s.shiftType, opDays);

                                  return (
                                    <div
                                      key={s.shiftId || s.shiftType}
                                      className={`px-2.5 py-1 rounded-xl border flex items-center space-x-1.5 text-[11px] ${
                                        badgeStyle.bg
                                      } ${badgeStyle.border} ${badgeStyle.text}`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                                      <span className="font-bold">
                                        {s.shiftType}
                                        {isEarly ? ' (Fri)' : ''}
                                      </span>
                                      <span className="font-mono text-[10px] opacity-85">
                                        {s.firstStopTime}-{s.lastStopTime}
                                      </span>
                                      <span
                                        className={`text-[9px] font-mono font-bold px-1 rounded ${
                                          isEarly
                                            ? 'bg-purple-500/40 text-purple-100'
                                            : 'bg-slate-800 text-slate-300'
                                        }`}
                                      >
                                        {opDays}
                                      </span>
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">No shifts linked</span>
                              )}
                            </div>
                          </td>

                          {/* Stops / Riders */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200">
                              <span>{r.totalStops} stops</span>
                              <span>•</span>
                              <span className="text-indigo-400">{r.totalStudents} riders</span>
                            </div>
                          </td>

                          {/* Actions (Drawer & Expand) */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Edit Route Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRoute(r);
                                }}
                                className="text-amber-400 hover:text-amber-300 font-medium text-xs px-2 py-1 rounded hover:bg-slate-800 transition"
                                title="Edit Route Details"
                              >
                                Edit
                              </button>

                              {/* Auto Marryup Toggle Button */}
                              <button
                                type="button"
                                onClick={(e) => handleToggleAutoMarryup(e, r)}
                                disabled={togglingRouteIds[r.id]}
                                className="text-amber-400 hover:text-amber-300 font-medium text-xs px-2 py-1 rounded hover:bg-slate-800 transition flex items-center space-x-1"
                                title={isAutoMarryupEnabled(r) ? 'Disable Auto Marryup for this route' : 'Enable Auto Marryup for this route'}
                              >
                                {togglingRouteIds[r.id] && (
                                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mr-1" />
                                )}
                                <span>{isAutoMarryupEnabled(r) ? 'Disable Auto Marryup' : 'Set Auto Marryup'}</span>
                              </button>

                              {onAssignCrew && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAssignCrew(r);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                                  title="Assign Driver, Vehicle & Attendant"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectRoute(r);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition flex items-center space-x-1"
                                title="Open slide drawer"
                              >
                                <FileText className="w-3.5 h-3.5 text-amber-400" />
                                <span className="hidden sm:inline">Drawer</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectRoute(r);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                                title="View Route Audit History"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRouteExpand(r.id);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* INLINE MASTER-DETAIL STOPS TABLE */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 border-b border-slate-800 bg-slate-950">
                              <RouteInlineDetail
                                route={r}
                                studentsMap={studentsMap}
                                onSelectStudent={onSelectStudent}
                                onOpenDrawer={onSelectRoute}
                                onRouteUpdated={onRouteUpdated}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {routePaddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${routePaddingBottom}px`, padding: 0, border: 0 }} colSpan={7} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (visible on phones below md) */}
            <div ref={routeMobileContainerRef} className="block md:hidden overflow-y-auto max-h-[calc(100vh-270px)]">
              <div
                style={{
                  height: `${routeMobileVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {routeMobileVirtualizer.getVirtualItems().map((virtualRow) => {
                  const r = filteredRoutes[virtualRow.index];
                  if (!r) return null;
                const isExpanded = !!expandedRouteIds[r.id];

                return (
                  <div
                    key={r.id}
                    data-index={virtualRow.index}
                    ref={routeMobileVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="p-3.5 space-y-3 bg-slate-900/60 hover:bg-slate-800/20 transition border-b border-slate-800/80">
                    {/* Header: Route No, Board, Yard, AutoMarryup, Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
                          <Bus className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold font-mono text-white text-sm">{r.routeNo}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                              {r.schoolBoardCode || 'OCDSB'}
                            </span>
                            {r.yardName && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {r.yardName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-medium truncate max-w-[210px]" title={r.routeName}>
                            {r.routeName}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRoute(r);
                          }}
                          className="px-2 py-1 rounded-lg text-amber-400 hover:bg-slate-800 transition text-xs font-semibold"
                          title="Edit Route"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleRouteExpand(r.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-amber-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Crew row */}
                    <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-slate-200 flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{r.driverName || 'No Driver Assigned'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                          {r.attendantName && <span>Monitor: {r.attendantName}</span>}
                          {r.driverPhone && (
                            <a
                              href={`tel:${r.driverPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-amber-400 hover:underline font-mono"
                            >
                              {r.driverPhone}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {onAssignCrew && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignCrew(r);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                            title="Assign Driver & Vehicle"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRoute(r);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                          title="Open Drawer"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRoute(r);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                          title="View Route Audit History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Operational Shifts Badges */}
                    {r.shifts && r.shifts.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.shifts.map((s) => {
                          const opDays = formatOpDays(s.runDays);
                          const isEarly = opDays === '----F' || s.shiftType.toUpperCase().includes('NOON');
                          const badgeStyle = getShiftBadgeStyle(s.shiftType, opDays);
                          return (
                            <div
                              key={s.shiftId || s.shiftType}
                              className={`px-2 py-0.5 rounded-lg border flex items-center space-x-1 text-[10px] ${badgeStyle.bg} ${badgeStyle.border} ${badgeStyle.text}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                              <span className="font-bold">{s.shiftType}</span>
                              <span className="font-mono opacity-85">
                                {s.firstStopTime || '--:--'}-{s.lastStopTime || '--:--'}
                              </span>
                              <span className={`px-0.5 rounded font-mono font-bold ${isEarly ? 'bg-purple-500/40 text-purple-100' : 'bg-slate-800 text-slate-300'}`}>
                                {opDays}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Summary Footer & Expand Button */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300">
                          <span>{r.totalStops} stops</span>
                          <span>•</span>
                          <span className="text-indigo-400">{r.totalStudents} riders</span>
                        </div>
                        {!isAutoMarryupEnabled(r) && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            No Marryup
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleRouteExpand(r.id)}
                        className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Hide Stops' : 'View Stops'}</span>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Inline Stops Detail on Mobile */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-800/80 -mx-3.5 px-1 bg-slate-950">
                        <RouteInlineDetail
                          route={r}
                          studentsMap={studentsMap}
                          onSelectStudent={onSelectStudent}
                          onOpenDrawer={onSelectRoute}
                          onRouteUpdated={onRouteUpdated}
                        />
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Route Edit Modal */}
      {editingRoute && (
        <RouteEditModal
          route={editingRoute}
          yards={yards}
          onClose={() => setEditingRoute(null)}
          onSave={handleSaveRoute}
        />
      )}
    </div>
  );
};
