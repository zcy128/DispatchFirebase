import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Calendar as CalendarIcon,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  User,
  Radio,
  AlertCircle
} from 'lucide-react';
import { DispatchChangeLog } from '../types/dispatch';
import { DispatchService } from '../services/dispatchService';
import { getLocalTodayString } from '../utils/dateUtils';

interface DispatchChangeLogViewProps {
  initialDate?: string;
  onNavigateToDispatch?: (date: string) => void;
}

export const DispatchChangeLogView: React.FC<DispatchChangeLogViewProps> = ({
  initialDate,
  onNavigateToDispatch,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getLocalTodayString());
  const [logs, setLogs] = useState<DispatchChangeLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [routeFilter, setRouteFilter] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Load / Subscribe to change logs for selectedDate
  useEffect(() => {
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    const unsubscribe = DispatchService.subscribeToChangeLogs(
      selectedDate,
      (updatedLogs) => {
        setLogs(updatedLogs);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe to change logs:', err);
        setError('Failed to load dispatch change logs');
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedDate]);

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const data = await DispatchService.listChangeLogs(selectedDate);
      setLogs(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh logs');
    } finally {
      setLoading(false);
    }
  };

  // Distinct types for column filter dropdown
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.type) set.add(log.type);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Distinct shifts for column filter dropdown
  const availableShifts = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.shiftType) set.add(log.shiftType);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Global search
      if (globalSearch.trim()) {
        const query = globalSearch.toLowerCase().trim();
        const matchesGlobal =
          (log.routeNo && log.routeNo.toLowerCase().includes(query)) ||
          (log.shiftType && log.shiftType.toLowerCase().includes(query)) ||
          (log.type && log.type.toLowerCase().includes(query)) ||
          (log.detail && log.detail.toLowerCase().includes(query)) ||
          (log.time && log.time.toLowerCase().includes(query)) ||
          (log.user && log.user.toLowerCase().includes(query));
        if (!matchesGlobal) return false;
      }

      // Route column filter
      if (routeFilter.trim()) {
        const rQuery = routeFilter.toLowerCase().trim();
        if (!log.routeNo || !log.routeNo.toLowerCase().includes(rQuery)) {
          return false;
        }
      }

      // Shift column filter
      if (shiftFilter.trim()) {
        if (log.shiftType !== shiftFilter && !log.shiftType?.toLowerCase().includes(shiftFilter.toLowerCase())) {
          return false;
        }
      }

      // Type column filter
      if (typeFilter.trim()) {
        if (log.type !== typeFilter && !log.type?.toLowerCase().includes(typeFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [logs, globalSearch, routeFilter, shiftFilter, typeFilter]);

  // Paginated items
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;

  // Export to Excel / CSV with UTF-8 BOM
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Route', 'Shift', 'Type', 'Detail', 'Time', 'User'];
    const rows = filteredLogs.map((log) => [
      `"${(log.routeNo || '').replace(/"/g, '""')}"`,
      `"${(log.shiftType || '').replace(/"/g, '""')}"`,
      `"${(log.type || '').replace(/"/g, '""')}"`,
      `"${(log.detail || '').replace(/"/g, '""')}"`,
      `"${(log.time || '').replace(/"/g, '""')}"`,
      `"${(log.user || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
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

  // Badge styling helper for Type
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'Assignment Updated':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'Dispatch Comments':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      case 'Payroll Comments':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'TCS Check-in/out':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800';
      case 'Stop Arrival':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800';
      case 'Student Boarding':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';
      case 'Shift Split':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-300 dark:border-violet-800';
      case 'Parent Notification':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Navigation */}
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

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Selector + Read button */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center px-2 text-slate-500 dark:text-slate-400">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden py-1 pr-2"
              />
              <button
                type="button"
                onClick={handleManualRefresh}
                title="Read records for selected date"
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Read</span>
              </button>
            </div>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-medium rounded-lg shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>

            {/* Global Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Column-level Sub-header Filter Inputs */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-3">
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">
            <Filter className="w-3.5 h-3.5 mr-1" />
            Filters:
          </div>

          {/* Route Filter */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5">Route:</span>
            <input
              type="text"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              placeholder="All routes"
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden w-24"
            />
          </div>

          {/* Shift Filter */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5">Shift:</span>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="" className="dark:bg-slate-900">All Shifts</option>
              {availableShifts.map((s) => (
                <option key={s} value={s} className="dark:bg-slate-900">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer max-w-[200px]"
            >
              <option value="" className="dark:bg-slate-900">All Types</option>
              {availableTypes.map((t) => (
                <option key={t} value={t} className="dark:bg-slate-900">
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
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
            Total entries: <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredLogs.length}</span>
            {logs.length !== filteredLogs.length && ` (filtered from ${logs.length})`}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Container */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 z-10 select-none">
                <tr>
                  <th className="py-3 px-4 font-semibold w-[100px]">Route</th>
                  <th className="py-3 px-4 font-semibold w-[100px]">Shift</th>
                  <th className="py-3 px-4 font-semibold w-[180px]">Type</th>
                  <th className="py-3 px-4 font-semibold min-w-[320px]">Detail</th>
                  <th className="py-3 px-4 font-semibold w-[220px]">Time</th>
                  <th className="py-3 px-4 font-semibold w-[160px]">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && logs.length === 0 ? (
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
                          No change logs found for this date.
                        </span>
                        <span className="text-xs text-slate-400">
                          Operations performed on this day will be automatically recorded here.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Route */}
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">
                        {log.routeNo || '-'}
                      </td>

                      {/* Shift */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {log.shiftType || '-'}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getTypeBadgeClass(
                            log.type
                          )}`}
                        >
                          {log.type}
                        </span>
                      </td>

                      {/* Detail */}
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                        {log.detail}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs font-mono">
                        {log.time}
                      </td>

                      {/* User */}
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[130px] font-medium" title={log.user}>
                            {log.user}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.min(currentPage * pageSize, filteredLogs.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredLogs.length}</span> entries
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Previous
              </button>
              <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
