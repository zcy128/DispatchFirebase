import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  History,
  Calendar as CalendarIcon,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  User,
  Radio,
  AlertCircle,
  Database,
  Globe,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { DispatchChangeLog } from '../types/dispatch';
import { DispatchService } from '../services/dispatchService';
import { getLocalTodayString } from '../utils/dateUtils';

interface DispatchChangeLogViewProps {
  initialDate?: string;
  onNavigateToDispatch?: (date: string) => void;
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  'Assignment Updated':
    'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  'Dispatch Comments':
    'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800',
  'Payroll Comments':
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  'TCS Check-in/out':
    'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800',
  'Stop Arrival':
    'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800',
  'Student Boarding':
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
  'Shift Split':
    'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-300 dark:border-violet-800',
  'Parent Notification':
    'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800',
};

const DEFAULT_TYPE_BADGE =
  'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';

const getTypeBadgeClass = (type: string) => TYPE_BADGE_CLASS[type] || DEFAULT_TYPE_BADGE;

/** Prevent CSV formula injection when Excel opens exported cells. */
const csvCell = (value: string) => {
  const raw = value || '';
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

interface ChangeLogRowProps {
  log: DispatchChangeLog;
  virtualIndex: number;
  measureRef: (node: HTMLTableRowElement | null) => void;
}

const ChangeLogRow = memo(function ChangeLogRow({
  log,
  virtualIndex,
  measureRef,
}: ChangeLogRowProps) {
  return (
    <tr
      data-index={virtualIndex}
      ref={measureRef}
      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '52px' }}
    >
      <td
        className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 truncate"
        title={log.routeNo || '-'}
      >
        {log.routeNo || '-'}
      </td>
      <td className="py-3 px-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {log.shiftType || '-'}
        </span>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getTypeBadgeClass(
            log.type
          )}`}
        >
          {log.type}
        </span>
      </td>
      <td
        className="py-3 px-4 text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap line-clamp-4"
        title={log.detail}
      >
        {log.detail}
      </td>
      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs font-mono">
        {log.time}
      </td>
      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
        <div className="flex items-center space-x-1.5">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate max-w-[130px] font-medium" title={log.user}>
            {log.user}
          </span>
        </div>
      </td>
    </tr>
  );
});

export const DispatchChangeLogView: React.FC<DispatchChangeLogViewProps> = ({
  initialDate,
  onNavigateToDispatch,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || getLocalTodayString()
  );
  const [logs, setLogs] = useState<DispatchChangeLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Targeted database query state (Tiered logging) — store as primitives for stable effect deps
  const [targetRoute, setTargetRoute] = useState<string>('');
  const [targetEmployee, setTargetEmployee] = useState<string>('');
  const [filterRouteNo, setFilterRouteNo] = useState<string | undefined>(undefined);
  const [filterEmployee, setFilterEmployee] = useState<string | undefined>(undefined);
  const [filterScope, setFilterScope] = useState<string | undefined>(undefined);

  const hasActiveFilter = Boolean(filterRouteNo || filterEmployee || filterScope);

  // In-memory filters (applied on top of currently fetched logs)
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [routeFilter, setRouteFilter] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const deferredGlobalSearch = useDeferredValue(globalSearch);
  const deferredRouteFilter = useDeferredValue(routeFilter);

  // Check if selected date is older than 7 days (Cold Data archived to BigQuery)
  const isColdDate = useMemo(() => {
    if (!selectedDate) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return selectedDate < cutoff.toISOString().slice(0, 10);
  }, [selectedDate]);

  const requestSeqRef = useRef(0);

  // Load / Subscribe to change logs for selectedDate & filter primitives
  useEffect(() => {
    if (!selectedDate) {
      setLogs([]);
      setLoading(false);
      setError(null);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    setLogs([]);

    const filterParams =
      filterRouteNo || filterEmployee || filterScope
        ? {
            routeNo: filterRouteNo,
            employee: filterEmployee,
            scope: filterScope,
          }
        : undefined;

    const unsubscribe = DispatchService.subscribeToChangeLogs(
      selectedDate,
      (updatedLogs) => {
        if (seq !== requestSeqRef.current) return;
        setLogs(updatedLogs);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (seq !== requestSeqRef.current) return;
        console.error('Failed to subscribe to change logs:', err);
        setError('Failed to load dispatch change logs');
        setLoading(false);
      },
      filterParams
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedDate, filterRouteNo, filterEmployee, filterScope]);

  const handleManualRefresh = useCallback(async () => {
    if (!selectedDate) return;
    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const filterParams =
        filterRouteNo || filterEmployee || filterScope
          ? {
              routeNo: filterRouteNo,
              employee: filterEmployee,
              scope: filterScope,
            }
          : undefined;
      const data = await DispatchService.listChangeLogs(selectedDate, filterParams);
      if (seq !== requestSeqRef.current) return;
      setLogs(data);
      setError(null);
    } catch (err: any) {
      if (seq !== requestSeqRef.current) return;
      setError(err?.message || 'Failed to refresh logs');
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [selectedDate, filterRouteNo, filterEmployee, filterScope]);

  const handleSearchTargeted = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const r = targetRoute.trim();
    const emp = targetEmployee.trim();
    if (!r && !emp) {
      setFilterRouteNo(undefined);
      setFilterEmployee(undefined);
      setFilterScope(undefined);
      return;
    }
    setFilterRouteNo(r || undefined);
    setFilterEmployee(emp || undefined);
    setFilterScope(undefined);
  };

  const handleResetToGlobal = useCallback(() => {
    setTargetRoute('');
    setTargetEmployee('');
    setFilterRouteNo(undefined);
    setFilterEmployee(undefined);
    setFilterScope(undefined);
  }, []);

  const handleLoadAllLogs = useCallback(() => {
    setFilterRouteNo(undefined);
    setFilterEmployee(undefined);
    setFilterScope('all');
  }, []);

  const handleDateChange = (value: string) => {
    if (!value) return;
    setSelectedDate(value);
  };

  // Leave reviews belong on Time Off, not this dispatch audit.
  const operationalLogs = useMemo(
    () => logs.filter((log) => log.type !== 'Time Off Review'),
    [logs]
  );

  const hasColumnFilter = Boolean(
    deferredGlobalSearch.trim() ||
      deferredRouteFilter.trim() ||
      shiftFilter.trim() ||
      typeFilter.trim()
  );

  // Distinct types + shifts in one pass
  const { availableTypes, availableShifts } = useMemo(() => {
    const types = new Set<string>();
    const shifts = new Set<string>();
    for (const log of operationalLogs) {
      if (log.type) types.add(log.type);
      if (log.shiftType) shifts.add(log.shiftType);
    }
    return {
      availableTypes: Array.from(types).sort(),
      availableShifts: Array.from(shifts).sort(),
    };
  }, [operationalLogs]);

  // Filtered logs (deferred text inputs keep typing responsive)
  const filteredLogs = useMemo(() => {
    const q = deferredGlobalSearch.trim().toLowerCase();
    const rq = deferredRouteFilter.trim().toLowerCase();
    const sq = shiftFilter.trim().toLowerCase();
    const tq = typeFilter.trim().toLowerCase();

    return operationalLogs.filter((log) => {
      if (q) {
        const matchesGlobal =
          (log.routeNo && log.routeNo.toLowerCase().includes(q)) ||
          (log.shiftType && log.shiftType.toLowerCase().includes(q)) ||
          (log.type && log.type.toLowerCase().includes(q)) ||
          (log.detail && log.detail.toLowerCase().includes(q)) ||
          (log.time && log.time.toLowerCase().includes(q)) ||
          (log.user && log.user.toLowerCase().includes(q));
        if (!matchesGlobal) return false;
      }

      if (rq) {
        if (!log.routeNo || !log.routeNo.toLowerCase().includes(rq)) return false;
      }

      if (sq) {
        if (log.shiftType !== shiftFilter && !log.shiftType?.toLowerCase().includes(sq)) {
          return false;
        }
      }

      if (tq) {
        if (log.type !== typeFilter && !log.type?.toLowerCase().includes(tq)) {
          return false;
        }
      }

      return true;
    });
  }, [
    operationalLogs,
    deferredGlobalSearch,
    deferredRouteFilter,
    shiftFilter,
    typeFilter,
  ]);

  // Virtual scrolling container for 1,000+ dispatch change logs
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  // Export to Excel / CSV with UTF-8 BOM
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Route', 'Shift', 'Type', 'Detail', 'Time', 'User'];
    const rows = filteredLogs.map((log) => [
      csvCell(log.routeNo || ''),
      csvCell(log.shiftType || ''),
      csvCell(log.type || ''),
      csvCell(log.detail || ''),
      csvCell(log.time || ''),
      csvCell(log.user || ''),
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Dispatch_Change_Log_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 rounded-xl shadow-xs">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Dispatch Change Log
                </h1>
                {onNavigateToDispatch && (
                  <button
                    type="button"
                    onClick={() => onNavigateToDispatch(selectedDate)}
                    className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5 mr-1" />
                    Open Workbench
                  </button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Audit trail and operational history for dispatch shifts and crew updates
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center px-2 text-slate-500 dark:text-slate-400">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden py-1 pr-2"
              />
              {isColdDate && (
                <span
                  title="Records older than 7 days are archived in Google BigQuery cold storage"
                  className="px-1.5 py-0.5 mr-1.5 rounded text-[10px] font-semibold bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 whitespace-nowrap"
                >
                  BigQuery Cold
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  void handleManualRefresh();
                }}
                title="Read records for selected date"
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Read</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-medium rounded-lg shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl border">
          <form
            onSubmit={handleSearchTargeted}
            className="flex flex-wrap items-center gap-2.5 flex-1"
          >
            <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300 mr-1">
              <Database className="w-4 h-4 mr-1.5 text-blue-600 dark:text-blue-400" />
              <span>Query DB:</span>
            </div>

            <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500">
              <span className="text-xs text-slate-400 mr-1.5">Route:</span>
              <input
                type="text"
                value={targetRoute}
                onChange={(e) => setTargetRoute(e.target.value)}
                placeholder="e.g. 101"
                className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden w-20"
              />
            </div>

            <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500">
              <span className="text-xs text-slate-400 mr-1.5">Employee:</span>
              <input
                type="text"
                value={targetEmployee}
                onChange={(e) => setTargetEmployee(e.target.value)}
                placeholder="Name or ID"
                className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden w-28"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search DB</span>
            </button>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetToGlobal}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Global</span>
              </button>
            )}

            {filterScope !== 'all' && (
              <button
                type="button"
                onClick={handleLoadAllLogs}
                title="Load all logs for this date including all shifts (heavy)"
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors ml-auto"
              >
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <span>Load All Shift Logs</span>
              </button>
            )}
          </form>
        </div>

        <div className="mt-2.5 px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 border">
          {!hasActiveFilter ? (
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
              <Globe className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                <strong className="text-slate-800 dark:text-slate-200">
                  Global Operations Mode (Default):
                </strong>{' '}
                Showing high-level system logs (e.g. Day Sheet Generated/Deleted, locks, batch
                assignments). Enter a <strong>Route</strong> or <strong>Employee</strong> above to
                read specific shift logs from database.
                {isColdDate && (
                  <span className="ml-2 text-sky-600 dark:text-sky-400 font-medium">
                    (Historical data sourced from BigQuery cold storage)
                  </span>
                )}
              </span>
            </div>
          ) : filterScope === 'all' ? (
            <div className="flex items-center justify-between w-full text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 -m-3 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>All Logs View:</strong> Displaying all shift, stop, check-in, and student
                  logs for {selectedDate}.
                  {isColdDate && ' (Sourced from BigQuery historical dataset)'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetToGlobal}
                className="font-medium underline hover:no-underline text-xs shrink-0"
              >
                Back to Global Ops
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 -m-3 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Targeted DB Query:</strong> Showing logs for{' '}
                  {filterRouteNo && (
                    <span className="font-semibold mr-2">Route #{filterRouteNo}</span>
                  )}
                  {filterEmployee && (
                    <span className="font-semibold">Employee: {filterEmployee}</span>
                  )}{' '}
                  ({operationalLogs.length} found)
                  {isColdDate && (
                    <span className="ml-2 text-sky-600 dark:text-sky-400">(via BigQuery)</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetToGlobal}
                className="font-medium underline hover:no-underline text-xs shrink-0"
              >
                Back to Global Ops
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-3">
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">
            <Filter className="w-3.5 h-3.5 mr-1" />
            Quick In-memory Filters:
          </div>

          <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5">Route:</span>
            <input
              type="text"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              placeholder="Filter..."
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden w-20"
            />
          </div>

          <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5">Shift:</span>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="" className="dark:bg-slate-900">
                All Shifts
              </option>
              {availableShifts.map((s) => (
                <option key={s} value={s} className="dark:bg-slate-900">
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer max-w-[200px]"
            >
              <option value="" className="dark:bg-slate-900">
                All Types
              </option>
              {availableTypes.map((t) => (
                <option key={t} value={t} className="dark:bg-slate-900">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[160px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search loaded logs..."
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          {(routeFilter || shiftFilter || typeFilter || globalSearch) && (
            <button
              type="button"
              onClick={() => {
                setRouteFilter('');
                setShiftFilter('');
                setTypeFilter('');
                setGlobalSearch('');
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-1"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            Total entries:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {filteredLogs.length}
            </span>
            {operationalLogs.length !== filteredLogs.length &&
              ` (filtered from ${operationalLogs.length})`}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col h-full">
          <div
            ref={tableContainerRef}
            className={`flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] ${
              loading && operationalLogs.length > 0 ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <table className="w-full text-left border-collapse text-xs sm:text-sm table-fixed min-w-[1100px]">
              <colgroup>
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ minWidth: '320px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '160px' }} />
              </colgroup>
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 z-10 select-none shadow-2xs">
                <tr>
                  <th className="py-3 px-4 font-semibold">Route</th>
                  <th className="py-3 px-4 font-semibold">Shift</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Detail</th>
                  <th className="py-3 px-4 font-semibold">Time</th>
                  <th className="py-3 px-4 font-semibold">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && operationalLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="text-sm">Loading change logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <History className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          {hasColumnFilter
                            ? 'No loaded logs match the current filters.'
                            : hasActiveFilter
                              ? 'No change logs matched the specified Route / Employee query.'
                              : 'No global dispatch operations found for this date.'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {hasColumnFilter ? (
                            'Clear the route, shift, type, or search filters to see the loaded rows.'
                          ) : hasActiveFilter ? (
                            <button
                              type="button"
                              onClick={handleResetToGlobal}
                              className="text-blue-500 hover:underline"
                            >
                              Return to global dispatch operations
                            </button>
                          ) : (
                            'High-volume shift logs are hidden by default. Query a specific Route or Employee above to inspect shift activity.'
                          )}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {paddingTop > 0 && (
                      <tr>
                        <td
                          style={{ height: `${paddingTop}px`, padding: 0, border: 0 }}
                          colSpan={6}
                        />
                      </tr>
                    )}
                    {virtualRows.map((virtualRow) => {
                      const log = filteredLogs[virtualRow.index];
                      if (!log) return null;
                      return (
                        <ChangeLogRow
                          key={log.id}
                          log={log}
                          virtualIndex={virtualRow.index}
                          measureRef={rowVirtualizer.measureElement}
                        />
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr>
                        <td
                          style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }}
                          colSpan={6}
                        />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {filteredLogs.length}
              </span>{' '}
              {filteredLogs.length === 1 ? 'entry' : 'entries'}
              {operationalLogs.length !== filteredLogs.length &&
                ` (filtered from ${operationalLogs.length})`}
            </div>
            <div className="text-slate-400 dark:text-slate-500 text-[11px] font-medium">
              Virtual Scrolling Enabled
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
