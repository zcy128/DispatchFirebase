import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Clock,
  UserCheck,
  AlertCircle,
  FileSpreadsheet,
  Bus,
  CheckCircle2,
  Pencil,
  ShieldCheck,
  Receipt,
  X,
} from 'lucide-react';
import { PayrollDepartmentLogRecord } from '../types/dispatch';
import { DispatchService } from '../services/dispatchService';
import { useAuth } from '../contexts/AuthContext';
import { getLocalTodayString, addDaysToDateString } from '../utils/dateUtils';
import { logDispatchAction } from '../utils/dispatchLogger';
import { PayrollDeptLogEditModal } from '../components/payroll/PayrollDeptLogEditModal';

const formatModifiedAt = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr;
    }
    return d.toLocaleString('en-CA', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

interface PayrollDepartmentLogViewProps {
  initialDate?: string;
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
}

const isSpareDriverRecord = (item: PayrollDepartmentLogRecord) => {
  const rateSource = (item.rateSource || '').toLowerCase();
  const rateDescription = (item.rateDescription || '').toLowerCase();
  const dispatcherComments = (item.dispatcherComments || '').toLowerCase();
  const payrollNotes = (item.payrollNotes || '').toLowerCase();
  return (
    rateSource.includes('spare') ||
    rateDescription.includes('spare') ||
    dispatcherComments.includes('spare') ||
    payrollNotes.includes('spare')
  );
};

export const PayrollDepartmentLogView = memo(function PayrollDepartmentLogView({
  initialDate,
  onSelectEmployee,
}: PayrollDepartmentLogViewProps) {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Payroll Staff';

  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || getLocalTodayString()
  );
  const [logs, setLogs] = useState<PayrollDepartmentLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Keep track of data signature to prevent unnecessary re-renders and flicker
  const prevSignatureRef = useRef<string>('');

  const updateLogsIfChanged = (newLogs: PayrollDepartmentLogRecord[]) => {
    const safeList = Array.isArray(newLogs) ? newLogs : [];
    const sig = safeList.map(i => `${i.id}_${i.payAmount}_${i.eiHours}_${i.status}_${i.updatedAt}`).join('|');
    if (sig !== prevSignatureRef.current) {
      prevSignatureRef.current = sig;
      setLogs(safeList);
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'attendant' | 'regular_driver' | 'spare_driver'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | 'routes' | 'charter'>('all');

  // Sync state
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Modal State
  const [editingLog, setEditingLog] = useState<PayrollDepartmentLogRecord | null>(null);

  // Fetch data & subscribe to real-time updates
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Real-time subscription as the primary reactive source
    const unsubscribe = DispatchService.subscribeToPayrollDepartmentLogs(
      selectedDate,
      (updatedList) => {
        updateLogsIfChanged(updatedList);
        setLoading(false);
      },
      (err) => {
        console.warn('Realtime payroll log subscription error, fallback to REST:', err);
        DispatchService.listPayrollDepartmentLogs(selectedDate ? { date: selectedDate } : undefined)
          .then((records) => {
            updateLogsIfChanged(records);
            setLoading(false);
          })
          .catch((fetchErr) => {
            console.error('Failed to load payroll department logs:', fetchErr);
            setError('Failed to fetch payroll department records.');
            setLoading(false);
          });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedDate]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const records = await DispatchService.listPayrollDepartmentLogs(
        selectedDate ? { date: selectedDate } : undefined
      );
      updateLogsIfChanged(records);
    } catch (err) {
      console.error('Failed to refresh payroll department logs:', err);
      setError('Failed to refresh records.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => {
    setSelectedDate(addDaysToDateString(selectedDate, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(addDaysToDateString(selectedDate, 1));
  };

  const handleToday = () => {
    setSelectedDate(getLocalTodayString());
  };

  const handleSyncFromDailyDispatch = async () => {
    try {
      setSyncing(true);
      setSyncFeedback(null);
      const res = await DispatchService.syncCleanPayrollsForDate(selectedDate);

      void logDispatchAction({
        date: selectedDate,
        type: 'Payroll Synced',
        detail: `Finance synced daily dispatch payroll records for ${selectedDate} (${res.synced} clean records synced)`,
        user: actorName,
      });

      setSyncFeedback({
        type: 'success',
        message: `Successfully synchronized ${res.synced} clean record(s) from daily dispatch for ${selectedDate}.`,
      });
    } catch (err) {
      console.error('Failed to sync payroll from daily dispatch:', err);
      setSyncFeedback({
        type: 'error',
        message: 'Failed to sync from daily dispatch: ' + (err as Error).message,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenEdit = (rec: PayrollDepartmentLogRecord) => {
    setEditingLog(rec);
  };

  const closeEditModal = useCallback(() => setEditingLog(null), []);

  const applyLogUpdate = useCallback((updated: PayrollDepartmentLogRecord) => {
    setLogs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const searchTerm = deferredSearchQuery.trim().toLowerCase();
    const statusTerm = statusFilter === 'all' ? '' : statusFilter.toLowerCase();

    return logs.filter((item) => {
      const isCharterItem = Boolean(item.isCharter || item.shiftType === 'CHARTER');
      if (sourceTypeFilter === 'charter' && !isCharterItem) {
        return false;
      }
      if (sourceTypeFilter === 'routes' && isCharterItem) {
        return false;
      }
      if (roleFilter !== 'all') {
        const itemRole = (item.role || '').toLowerCase();
        if (roleFilter === 'attendant') {
          if (itemRole !== 'attendant') return false;
        } else if (roleFilter === 'driver') {
          if (itemRole !== 'driver') return false;
        } else if (roleFilter === 'spare_driver') {
          if (itemRole !== 'driver' || !isSpareDriverRecord(item)) return false;
        } else if (roleFilter === 'regular_driver') {
          if (itemRole !== 'driver' || isSpareDriverRecord(item)) return false;
        }
      }
      if (statusTerm) {
        const itemStatus = (item.status || 'approved').toLowerCase();
        if (statusTerm === 'pending_review') {
          if (itemStatus !== 'pending_review' && itemStatus !== 'pending') return false;
        } else if (itemStatus !== statusTerm) {
          return false;
        }
      }
      if (searchTerm) {
        const routeMatch = (item.routeNo || '').toLowerCase().includes(searchTerm);
        const nameMatch = (item.employeeName || '').toLowerCase().includes(searchTerm);
        const empIdMatch = (item.employeeId || '').toLowerCase().includes(searchTerm);
        const unitMatch = (item.unitNumber || '').toLowerCase().includes(searchTerm);
        const notesMatch = (item.payrollNotes || '').toLowerCase().includes(searchTerm);
        const commentsMatch = (item.dispatcherComments || '').toLowerCase().includes(searchTerm);
        const clientMatch = (item.clientName || '').toLowerCase().includes(searchTerm);
        if (!routeMatch && !nameMatch && !empIdMatch && !unitMatch && !notesMatch && !commentsMatch && !clientMatch) {
          return false;
        }
      }
      return true;
    });
  }, [logs, sourceTypeFilter, roleFilter, statusFilter, deferredSearchQuery]);

  // Day-level KPI cards (all records for selected date)
  const stats = useMemo(() => {
    let totalPay = 0;
    let totalEiHours = 0;
    let approvedCount = 0;
    let processedCount = 0;
    let paidCount = 0;
    let pendingOrHoldCount = 0;

    for (const r of logs) {
      totalPay += r.payAmount || 0;
      totalEiHours += r.eiHours || 0;
      const s = (r.status || 'approved').toLowerCase();
      if (s === 'paid') {
        paidCount++;
      } else if (s === 'processed') {
        processedCount++;
      } else if (s === 'on_hold' || s === 'pending_review' || s === 'pending' || s === 'draft' || s === 'rejected') {
        pendingOrHoldCount++;
      } else {
        approvedCount++;
      }
    }

    return {
      totalPay,
      totalEiHours,
      totalRecords: logs.length,
      approvedCount,
      processedCount,
      paidCount,
      pendingOrHoldCount,
    };
  }, [logs]);

  // Footer totals for the currently filtered table rows
  const filteredTotals = useMemo(() => {
    let totalPay = 0;
    let totalEiHours = 0;
    for (const r of filteredLogs) {
      totalPay += r.payAmount || 0;
      totalEiHours += r.eiHours || 0;
    }
    return {
      totalPay: Number(totalPay.toFixed(2)),
      totalEiHours: Number(totalEiHours.toFixed(1)),
    };
  }, [filteredLogs]);

  // Virtual scrolling container for large payroll logs
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  // Export to Excel / CSV with UTF-8 BOM
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;

    const headers = [
      'Date',
      'Route No',
      'Route Name',
      'Shift Type',
      'Role',
      'Employee ID',
      'Employee Name',
      'Unit Number',
      'Check-in Time',
      'Check-out Time',
      'Pay Option',
      'Dispatch Rate ($)',
      'Finance Pay Amount ($)',
      'Dispatch EI Hours',
      'Finance EI Hours',
      'Rate Source',
      'Dispatch Comments',
      'Finance Payroll Notes',
      'Status',
      'Approved By',
      'Synced At',
      'Last Modified By',
      'Last Modified At',
    ];

    const rows = filteredLogs.map((r) => [
      `"${r.dispatchDate}"`,
      `"${(r.routeNo || '').replace(/"/g, '""')}"`,
      `"${(r.routeName || '').replace(/"/g, '""')}"`,
      `"${(r.shiftType || '').replace(/"/g, '""')}"`,
      `"${(r.role || '').toUpperCase()}"`,
      `"${(r.employeeId || '').replace(/"/g, '""')}"`,
      `"${(r.employeeName || '').replace(/"/g, '""')}"`,
      `"${(r.unitNumber || '').replace(/"/g, '""')}"`,
      `"${(r.checkInTime || '').replace(/"/g, '""')}"`,
      `"${(r.checkOutTime || '').replace(/"/g, '""')}"`,
      `"${(r.payOption || 'STANDARD').replace(/"/g, '""')}"`,
      (r.originalPayRate || 0).toFixed(2),
      (r.payAmount || 0).toFixed(2),
      (r.originalEiHours || 0).toFixed(1),
      (r.eiHours || 0).toFixed(1),
      `"${(r.rateSource || '').replace(/"/g, '""')}"`,
      `"${(r.dispatcherComments || '').replace(/"/g, '""')}"`,
      `"${(r.payrollNotes || '').replace(/"/g, '""')}"`,
      `"${(r.status || 'approved').toUpperCase()}"`,
      `"${(r.approvedBy || '').replace(/"/g, '""')}"`,
      `"${(r.syncedAt || '').replace(/"/g, '""')}"`,
      `"${(r.updatedBy || r.approvedBy || 'System').replace(/"/g, '""')}"`,
      `"${(r.updatedAt || r.syncedAt || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Finance_Payroll_Log_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || 'approved').toLowerCase();
    switch (s) {
      case 'paid':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            Paid
          </span>
        );
      case 'processed':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
            Processed
          </span>
        );
      case 'on_hold':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            On Hold
          </span>
        );
      case 'pending_review':
      case 'pending':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700">
            Pending Review
          </span>
        );
      case 'draft':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
            Draft
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
            Approved (Ready)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Payroll Department Log
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Finance & Payroll Department Records. Only approved dispatch shifts with rate greater than zero appear here.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncFromDailyDispatch}
            disabled={syncing || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold text-xs transition-colors shadow-xs disabled:opacity-50"
            title="Sync routine and clean payroll records from daily dispatch for this date"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync from Daily Dispatch'}</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs transition-all hover:shadow"
            title="Export filtered records to Microsoft Excel format"
          >
            <Download className="w-4 h-4" />
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Message */}
      {syncFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Date Navigation & Filters Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Date Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-all"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
              />
            </div>
            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-all"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search route, employee, unit, notes..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={sourceTypeFilter}
              onChange={(e) => setSourceTypeFilter(e.target.value as 'all' | 'routes' | 'charter')}
              className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="all">All Shifts & Trips</option>
              <option value="routes">Route Shifts Only</option>
              <option value="charter">Charter Trips Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="all">All Roles</option>
              <option value="driver">All Drivers</option>
              <option value="regular_driver">Regular Drivers</option>
              <option value="spare_driver">Spare Drivers</option>
              <option value="attendant">Attendants Only</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved (Ready)</option>
            <option value="processed">Processed</option>
            <option value="paid">Paid</option>
            <option value="on_hold">On Hold</option>
            <option value="pending_review">Pending Review</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Finance Payroll</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              ${stats.totalPay.toFixed(2)}
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Synced Liabilities</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total EI Hours</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.totalEiHours.toFixed(1)} hrs
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Employment Insurance
            </p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved & Ready</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.approvedCount}
            </h3>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Awaiting payroll processing
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Review / Draft</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.pendingOrHoldCount}
            </h3>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {stats.processedCount} Processed • {stats.paidCount} Paid
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
          <table className="w-full text-left text-sm table-fixed min-w-[1470px] border-collapse">
            <colgroup>
              <col style={{ width: '150px' }} /> {/* Route & Shift */}
              <col style={{ width: '80px' }} />  {/* Role */}
              <col style={{ width: '180px' }} /> {/* Employee */}
              <col style={{ width: '80px' }} />  {/* Unit # */}
              <col style={{ width: '140px' }} /> {/* Check-in / Out */}
              <col style={{ width: '100px' }} /> {/* Dispatch Rate */}
              <col style={{ width: '110px' }} /> {/* Pay Amount */}
              <col style={{ width: '80px' }} />  {/* EI Hours */}
              <col style={{ width: '160px' }} /> {/* Dispatch Comments */}
              <col style={{ width: '160px' }} /> {/* Payroll Notes */}
              <col style={{ width: '90px' }} />  {/* Status */}
              <col style={{ width: '160px' }} /> {/* Modified By / At */}
              <col style={{ width: '70px' }} />  {/* Action */}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 shadow-2xs">
              <tr>
                <th className="py-3.5 px-4">Route & Shift</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Unit #</th>
                <th className="py-3.5 px-4">Check-in / Out</th>
                <th className="py-3.5 px-4 text-right">Dispatch Rate</th>
                <th className="py-3.5 px-4 text-right">Pay Amount ($)</th>
                <th className="py-3.5 px-4 text-right">EI Hours</th>
                <th className="py-3.5 px-4">Dispatch Comments</th>
                <th className="py-3.5 px-4">Payroll Notes</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-left">Modified By / At</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                      <span>Loading payroll department records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto text-slate-500">
                      <div className="p-3.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <Receipt className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          No Payroll Records for this Date
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Shifts appear here automatically once checked out without comments (or after dispatcher approval) with pay rate greater than zero.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={13} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const rec = filteredLogs[virtualRow.index];
                    if (!rec) return null;
                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Route & Shift */}
                    <td className="py-3.5 px-4">
                      <div
                        className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white truncate"
                        title={[rec.routeNo, rec.routeName, rec.clientName].filter(Boolean).join(' · ')}
                      >
                        <span className="truncate">{rec.routeNo}</span>
                        {rec.isCharter || rec.shiftType === 'CHARTER' ? (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            CHARTER
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-sans">
                            {rec.shiftType}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      {rec.role === 'driver' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <Bus className="w-3 h-3" />
                          <span>Driver</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <UserCheck className="w-3 h-3" />
                          <span>Attendant</span>
                        </span>
                      )}
                    </td>

                    {/* Employee */}
                    <td className="py-3.5 px-4">
                      {onSelectEmployee && (rec.employeeId || rec.employeeName) ? (
                        <button
                          type="button"
                          onClick={() => onSelectEmployee(rec.employeeId, rec.employeeName)}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-300 hover:underline transition text-left"
                          title="View employee details"
                        >
                          {rec.employeeName}
                        </button>
                      ) : (
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {rec.employeeName}
                        </div>
                      )}
                      {rec.employeeId && (
                        <div className="text-[11px] font-mono text-slate-400">
                          ID: {rec.employeeId}
                        </div>
                      )}
                    </td>

                    {/* Unit # */}
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {rec.unitNumber || '-'}
                    </td>

                    {/* Check-in / Out Time */}
                    <td className="py-3.5 px-4 text-xs font-mono">
                      <div className="text-slate-700 dark:text-slate-300">
                        In: {rec.checkInTime || '-'}
                      </div>
                      <div className="text-slate-400">
                        Out: {rec.checkOutTime || '-'}
                      </div>
                    </td>

                    {/* Original Dispatch Rate */}
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400">
                      ${(rec.originalPayRate || 0).toFixed(2)}
                    </td>

                    {/* Finance Pay Amount */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                        ${(rec.payAmount || 0).toFixed(2)}
                      </span>
                    </td>

                    {/* EI Hours */}
                    <td className="py-3.5 px-4 text-right font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(rec.eiHours || 0).toFixed(1)} hrs
                    </td>

                    {/* Dispatch Comments */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 max-w-[140px] truncate" title={rec.dispatcherComments || ''}>
                      {rec.dispatcherComments || '-'}
                    </td>

                    {/* Payroll Notes */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300 max-w-[140px] truncate" title={rec.payrollNotes || ''}>
                      {rec.payrollNotes ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {rec.payrollNotes}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(rec.status)}
                    </td>

                    {/* Last Modified */}
                    <td className="py-3.5 px-4 text-xs font-mono">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {rec.updatedBy || rec.approvedBy || 'System'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatModifiedAt(rec.updatedAt || rec.syncedAt)}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleOpenEdit(rec)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium transition-colors shadow-xs"
                        title="Edit rate, hours, or internal notes"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={13} />
                </tr>
              )}
            </>
          )}
        </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {!loading && filteredLogs.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/75 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-800 dark:text-slate-200">{filteredLogs.length}</span> of{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">{logs.length}</span> records for{' '}
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{selectedDate}</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span>
                Total Amount: <span className="font-bold text-emerald-600 dark:text-emerald-400">${filteredTotals.totalPay.toFixed(2)}</span>
              </span>
              <span>
                Total Hours: <span className="font-bold text-slate-800 dark:text-slate-200">{filteredTotals.totalEiHours.toFixed(1)} hrs</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {editingLog && (
        <PayrollDeptLogEditModal
          key={editingLog.id}
          log={editingLog}
          actorName={actorName}
          onClose={closeEditModal}
          onUpdated={applyLogUpdate}
        />
      )}
    </div>
  );
});
