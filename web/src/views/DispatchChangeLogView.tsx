import React, {
  memo,
  useCallback,
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import { useRegisterPageAIContext } from '../contexts/AIContext';
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
import { useDispatchChangeLogsQuery } from '../features/dispatch';
import { getLocalTodayString } from '../utils/dateUtils';

interface DispatchChangeLogViewProps {
  initialDate?: string;
  onNavigateToDispatch?: (date: string) => void;
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  'Assignment Updated':
    'bg-amber-500/15  text-amber-300 ',
  'Dispatch Comments':
    'bg-purple-500/15  text-purple-300 ',
  'Payroll Comments':
    'bg-emerald-500/15  text-emerald-300 ',
  'TCS Check-in/out':
    'bg-sky-500/15  text-sky-300 ',
  'Stop Arrival':
    'bg-teal-500/15  text-teal-300 ',
  'Student Boarding':
    'bg-indigo-500/15  text-indigo-300 ',
  'Shift Split':
    'bg-violet-100  text-violet-300 ',
  'Parent Notification':
    'bg-rose-500/15  text-rose-300 ',
};

const DEFAULT_TYPE_BADGE =
  'bg-slate-800 bg-slate-800 text-slate-300 border-slate-700';

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
      className="hover:bg-slate-800/40 transition-colors"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '52px' }}
    >
      <td
        className="py-3 px-4 font-semibold text-slate-100 truncate"
        title={log.routeNo || '-'}
      >
        {log.routeNo || '-'}
      </td>
      <td className="py-3 px-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
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
        className="py-3 px-4 text-slate-300 leading-relaxed break-words whitespace-pre-wrap line-clamp-4"
        title={log.detail}
      >
        {log.detail}
      </td>
      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-xs font-mono">
        {log.time}
      </td>
      <td className="py-3 px-4 text-slate-200">
        <div className="flex items-center space-x-1.5">
          <User aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
  useRegisterPageAIContext('dispatch_log', { selectedDate });
  const targetRouteId = useId();
  const targetEmployeeId = useId();
  const routeFilterId = useId();
  const shiftFilterId = useId();
  const typeFilterId = useId();
  // Targeted database query state (Tiered logging) — store as primitives for stable effect deps
  const [targetRoute, setTargetRoute] = useState<string>('');
  const [targetEmployee, setTargetEmployee] = useState<string>('');
  const [filterRouteNo, setFilterRouteNo] = useState<string | undefined>(undefined);
  const [filterEmployee, setFilterEmployee] = useState<string | undefined>(undefined);
  const [filterScope, setFilterScope] = useState<string | undefined>(undefined);

  const hasActiveFilter = Boolean(filterRouteNo || filterEmployee || filterScope);

  const {
    logs,
    loading,
    error,
    refresh: handleManualRefresh,
  } = useDispatchChangeLogsQuery(selectedDate, {
    routeNo: filterRouteNo,
    employee: filterEmployee,
    scope: filterScope,
  });

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
    <PageShell className="text-slate-100">
      {/* Top Header Card */}
      <PageHeader
        title="Dispatch Change Log"
        subtitle="Audit trail and operational history for dispatch shifts and crew updates"
        icon={
          <div aria-hidden="true" className="p-2 bg-blue-950/70 text-blue-400 rounded-xl border border-blue-500/20">
            <History className="w-5 h-5" />
          </div>
        }
        badge={
          onNavigateToDispatch ? (
            <button
              type="button"
              onClick={() => onNavigateToDispatch(selectedDate)}
              className="min-h-[28px] inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <Radio aria-hidden="true" className="w-3.5 h-3.5 mr-1" />
              Open Workbench
            </button>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700">
              <div aria-hidden="true" className="flex items-center px-2 text-slate-400">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <input
                type="date"
                aria-label="Select change log date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-base sm:text-sm font-medium text-slate-200 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 py-1 pr-2"
              />
              {isColdDate && (
                <span
                  title="Records older than 7 days are archived in Google BigQuery cold storage"
                  className="px-1.5 py-0.5 mr-1.5 rounded text-[10px] font-semibold bg-sky-950/70 text-sky-300 border border-sky-800 whitespace-nowrap"
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
                className="min-h-[28px] inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <RefreshCw aria-hidden="true" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Read</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredLogs.length === 0}
              className="min-h-[32px] inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-medium rounded-lg shadow-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              <FileSpreadsheet aria-hidden="true" className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>
          </div>
        }
      >

        <search aria-label="Query dispatch change logs from database" className="mt-4 pt-3 border-t border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-800 p-3 rounded-xl border">
          <form
            onSubmit={handleSearchTargeted}
            className="flex flex-wrap items-center gap-2.5 flex-1"
          >
            <div className="flex items-center text-xs font-semibold text-slate-300 mr-1">
              <Database aria-hidden="true" className="w-4 h-4 mr-1.5" />
              <span>Query DB:</span>
            </div>

            <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500">
              <label htmlFor={targetRouteId} className="text-xs text-slate-400 mr-1.5">Route:</label>
              <input
                id={targetRouteId}
                type="text"
                value={targetRoute}
                onChange={(e) => setTargetRoute(e.target.value)}
                placeholder="e.g. 101"
                className="bg-transparent text-base sm:text-xs text-slate-200 focus:outline-none w-20"
              />
            </div>

            <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500">
              <label htmlFor={targetEmployeeId} className="text-xs text-slate-400 mr-1.5">Employee:</label>
              <input
                id={targetEmployeeId}
                type="text"
                value={targetEmployee}
                onChange={(e) => setTargetEmployee(e.target.value)}
                placeholder="Name or ID"
                className="bg-transparent text-base sm:text-xs text-slate-200 focus:outline-none w-28"
              />
            </div>

            <button
              type="submit"
              className="min-h-[28px] inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <Search aria-hidden="true" className="w-3.5 h-3.5" />
              <span>Search DB</span>
            </button>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetToGlobal}
                className="min-h-[28px] inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Reset to Global</span>
              </button>
            )}

            {filterScope !== 'all' && (
              <button
                type="button"
                onClick={handleLoadAllLogs}
                title="Load all logs for this date including all shifts (heavy)"
                className="min-h-[28px] inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-white hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <Layers aria-hidden="true" className="w-3.5 h-3.5 text-amber-500" />
                <span>Load All Shift Logs</span>
              </button>
            )}
          </form>
        </search>

        <div className="mt-2.5 px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 border">
          {!hasActiveFilter ? (
            <div className="flex items-center space-x-2 text-slate-400">
              <Globe aria-hidden="true" className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                <strong className="text-slate-200">
                  Global Operations Mode (Default):
                </strong>{' '}
                Showing high-level system logs (e.g. Day Sheet Generated/Deleted, locks, batch
                assignments). Enter a <strong>Route</strong> or <strong>Employee</strong> above to
                read specific shift logs from database.
                {isColdDate && (
                  <span className="ml-2 font-medium">
                    (Historical data sourced from BigQuery cold storage)
                  </span>
                )}
              </span>
            </div>
          ) : filterScope === 'all' ? (
            <div className="flex items-center justify-between w-full -m-3 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle aria-hidden="true" className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>All Logs View:</strong> Displaying all shift, stop, check-in, and student
                  logs for {selectedDate}.
                  {isColdDate && ' (Sourced from BigQuery historical dataset)'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetToGlobal}
                className="min-h-[24px] px-1.5 rounded font-medium underline hover:no-underline text-xs shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                Back to Global Ops
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full -m-3 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <Database aria-hidden="true" className="w-4 h-4 text-blue-600 shrink-0" />
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
                    <span className="ml-2">(via BigQuery)</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetToGlobal}
                className="min-h-[24px] px-1.5 rounded font-medium underline hover:no-underline text-xs shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                Back to Global Ops
              </button>
            </div>
          )}
        </div>

        <search aria-label="Filter loaded change logs" className="mt-3 pt-3 border-t border-slate-700 flex flex-wrap items-center gap-3">
          <div className="flex items-center text-xs text-slate-400 font-medium mr-1">
            <Filter aria-hidden="true" className="w-3.5 h-3.5 mr-1" />
            Quick In-memory Filters:
          </div>

          <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500">
            <label htmlFor={routeFilterId} className="text-xs text-slate-200 mr-1.5">Route:</label>
            <input
              id={routeFilterId}
              type="text"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              placeholder="Filter..."
              className="bg-transparent text-base sm:text-xs text-slate-200 focus:outline-none w-20"
            />
          </div>

          <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500">
            <label htmlFor={shiftFilterId} className="text-xs text-slate-200 mr-1.5">Shift:</label>
            <select
              id={shiftFilterId}
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="bg-transparent text-base sm:text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">
                All Shifts
              </option>
              {availableShifts.map((s) => (
                <option key={s} value={s} className="bg-slate-900">
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500">
            <label htmlFor={typeFilterId} className="text-xs text-slate-200 mr-1.5">Type:</label>
            <select
              id={typeFilterId}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-base sm:text-xs text-slate-200 focus:outline-none cursor-pointer max-w-[200px]"
            >
              <option value="" className="bg-slate-900">
                All Types
              </option>
              {availableTypes.map((t) => (
                <option key={t} value={t} className="bg-slate-900">
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[160px]">
            <Search aria-hidden="true" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search loaded logs"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search loaded logs..."
              className="w-full pl-8 pr-2.5 py-1 text-base sm:text-xs bg-slate-800 border border-slate-700 rounded-md focus:border-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 transition-colors"
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
              className="min-h-[24px] text-xs hover:underline px-1.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto text-xs text-slate-400">
            Total entries:{' '}
            <span className="font-semibold text-slate-200">
              {filteredLogs.length}
            </span>
            {operationalLogs.length !== filteredLogs.length &&
              ` (filtered from ${operationalLogs.length})`}
          </div>
        </search>
      </PageHeader>

      {error && (
        <div role="alert" className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg border flex items-center gap-2 text-xs">
          <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col h-full">
          <div
            ref={tableContainerRef}
            tabIndex={0}
            role="region"
            aria-label="Dispatch change log table"
            className={`flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
              loading && operationalLogs.length > 0 ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <table className="w-full text-left border-collapse text-xs sm:text-sm table-fixed min-w-[1100px]">
              <caption className="sr-only">Dispatch change log entries for {selectedDate}</caption>
              <colgroup>
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ minWidth: '320px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '160px' }} />
              </colgroup>
              <thead className="sticky top-0 bg-slate-800 text-slate-200 border-b border-slate-700 z-10 select-none shadow-2xs">
                <tr>
                  <th scope="col" className="py-3 px-4 font-semibold">Route</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Shift</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Type</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Detail</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Time</th>
                  <th scope="col" className="py-3 px-4 font-semibold">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && operationalLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw aria-hidden="true" className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="text-sm">Loading change logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <History aria-hidden="true" className="w-8 h-8" />
                        <span className="text-sm font-medium text-slate-400">
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
                              className="min-h-[24px] px-1 rounded text-blue-500 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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

          <div className="p-3 bg-slate-800/60 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-200">
                {filteredLogs.length}
              </span>{' '}
              {filteredLogs.length === 1 ? 'entry' : 'entries'}
              {operationalLogs.length !== filteredLogs.length &&
                ` (filtered from ${operationalLogs.length})`}
            </div>
            <div className="text-slate-400 text-slate-500 text-[11px] font-medium">
              Virtual Scrolling Enabled
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
};


