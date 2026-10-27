import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Users,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  Bus,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Pencil,
  X,
  Lock,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { DispatchPayrollRecord, ApproveDispatchPayrollPayload } from '../../types/dispatch';
import { DispatchService } from '../../services/dispatchService';
import { useAuth } from '../../contexts/AuthContext';
import { getLocalTodayString, addDaysToDateString } from '../../utils/dateUtils';
import { logDispatchAction } from '../../utils/dispatchLogger';

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

interface DispatchDailyPayrollTabProps {
  initialDate?: string;
  onNavigateToFinanceLog?: () => void;
}

export const DispatchDailyPayrollTab: React.FC<DispatchDailyPayrollTabProps> = ({
  initialDate,
  onNavigateToFinanceLog,
}) => {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
  const isDispatcherOrAdmin = currentUser?.role === 'dispatcher' || currentUser?.role === 'admin';

  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || getLocalTodayString()
  );
  const [payrolls, setPayrolls] = useState<DispatchPayrollRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Category filter: Two primary categories + dedicated Charter category
  const [category, setCategory] = useState<'all' | 'with_comments' | 'without_comments' | 'charter'>('all');

  // Additional Filters
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'attendant'>('all');
  const [payOptionFilter, setPayOptionFilter] = useState<string>('all');

  // Review & Edit Modal State
  const [editingPayroll, setEditingPayroll] = useState<DispatchPayrollRecord | null>(null);
  const [editPayRate, setEditPayRate] = useState<number>(0);
  const [editEiHours, setEditEiHours] = useState<number>(0);
  const [editPayOption, setEditPayOption] = useState<string>('STANDARD');
  const [editComments, setEditComments] = useState<string>('');
  const [savingAction, setSavingAction] = useState<boolean>(false);

  // Load dispatch payrolls and subscribe to real-time updates
  useEffect(() => {
    setLoading(true);
    setError(null);

    DispatchService.listDispatchPayrolls(selectedDate)
      .then((records) => {
        setPayrolls(Array.isArray(records) ? records : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dispatch payrolls:', err);
        setError('Failed to fetch dispatch payrolls for the selected date.');
        setLoading(false);
      });

    const unsubscribe = DispatchService.subscribeToDispatchPayrolls(
      selectedDate,
      (updatedList) => {
        setPayrolls(updatedList);
        setLoading(false);
      },
      (err) => {
        console.warn('Realtime payroll subscription error, using polled data:', err);
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
      const records = await DispatchService.listDispatchPayrolls(selectedDate);
      setPayrolls(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error('Error refreshing dispatch payrolls:', err);
      setError('Failed to refresh dispatch payroll records.');
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

  // Quick 1-click Approve
  const handleQuickApprove = async (rec: DispatchPayrollRecord) => {
    try {
      setSavingAction(true);
      const payload: ApproveDispatchPayrollPayload = {
        approvedBy: actorName,
        payRate: rec.payRate,
        eiHours: rec.eiHours,
        payOption: rec.payOption,
        payrollComments: rec.payrollComments,
      };
      const updated = await DispatchService.approveDispatchPayroll(rec.id, payload);
      setPayrolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      await logDispatchAction({
        date: rec.dispatchDate,
        type: 'Payroll Approved',
        detail: `Quick-approved payroll for ${rec.employeeName} (${rec.role}): $${rec.payRate.toFixed(2)} (${rec.eiHours}h EI)`,
        shift: { id: rec.shiftId, routeNo: rec.routeNo, shiftType: rec.shiftType },
        user: actorName,
      });
    } catch (err) {
      alert('Approval failed: ' + (err as Error).message);
    } finally {
      setSavingAction(false);
    }
  };

  // Quick 1-click Reject
  const handleQuickReject = async (rec: DispatchPayrollRecord) => {
    if (!window.confirm(`Are you sure you want to reject payroll for ${rec.employeeName}? It will not be sent to Finance.`)) {
      return;
    }
    try {
      setSavingAction(true);
      const updated = await DispatchService.rejectDispatchPayroll(rec.id, {
        rejectedBy: actorName,
        reason: 'Rejected by Dispatcher',
      });
      setPayrolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      await logDispatchAction({
        date: rec.dispatchDate,
        type: 'Payroll Rejected',
        detail: `Quick-rejected payroll for ${rec.employeeName} (${rec.role})`,
        shift: { id: rec.shiftId, routeNo: rec.routeNo, shiftType: rec.shiftType },
        user: actorName,
      });
    } catch (err) {
      alert('Rejection failed: ' + (err as Error).message);
    } finally {
      setSavingAction(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (rec: DispatchPayrollRecord) => {
    setEditingPayroll(rec);
    setEditPayRate(rec.payRate);
    setEditEiHours(rec.eiHours);
    setEditPayOption(rec.payOption || 'STANDARD');
    setEditComments(rec.payrollComments || '');
  };

  // Save Modal as Approved / Updated
  const handleSaveModalApprove = async () => {
    if (!editingPayroll) return;
    try {
      setSavingAction(true);
      const isAlreadyApproved = editingPayroll.status === 'approved';
      const payload: ApproveDispatchPayrollPayload = {
        approvedBy: actorName,
        payRate: Number(editPayRate),
        eiHours: Number(editEiHours),
        payOption: editPayOption,
        payrollComments: editComments,
      };
      const updated = await DispatchService.approveDispatchPayroll(editingPayroll.id, payload);
      setPayrolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      const changes: string[] = [];
      if (editingPayroll.payRate !== Number(editPayRate)) {
        changes.push(`Rate: $${editingPayroll.payRate.toFixed(2)} -> $${Number(editPayRate).toFixed(2)}`);
      }
      if (editingPayroll.eiHours !== Number(editEiHours)) {
        changes.push(`EI: ${editingPayroll.eiHours}h -> ${Number(editEiHours)}h`);
      }
      if (editingPayroll.payOption !== editPayOption) {
        changes.push(`Option: ${editingPayroll.payOption} -> ${editPayOption}`);
      }
      if (editComments && editComments !== editingPayroll.payrollComments) {
        changes.push(`Comments: "${editComments}"`);
      }

      const logType = isAlreadyApproved ? 'Payroll Modified' : 'Payroll Approved';
      const detailStr = changes.length > 0
        ? `${isAlreadyApproved ? 'Modified' : 'Approved'} payroll for ${editingPayroll.employeeName} (${editingPayroll.role}): [${changes.join(', ')}]`
        : `Approved payroll for ${editingPayroll.employeeName} (${editingPayroll.role}): $${editingPayroll.payRate.toFixed(2)}`;

      await logDispatchAction({
        date: editingPayroll.dispatchDate,
        type: logType,
        detail: detailStr,
        shift: { id: editingPayroll.shiftId, routeNo: editingPayroll.routeNo, shiftType: editingPayroll.shiftType },
        user: actorName,
      });

      setEditingPayroll(null);
    } catch (err) {
      alert('Failed to approve: ' + (err as Error).message);
    } finally {
      setSavingAction(false);
    }
  };

  // Save Modal as Rejected
  const handleSaveModalReject = async () => {
    if (!editingPayroll) return;
    try {
      setSavingAction(true);
      const updated = await DispatchService.rejectDispatchPayroll(editingPayroll.id, {
        rejectedBy: actorName,
        reason: editComments || 'Rejected by Dispatcher',
      });
      setPayrolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      await logDispatchAction({
        date: editingPayroll.dispatchDate,
        type: 'Payroll Rejected',
        detail: `Rejected payroll for ${editingPayroll.employeeName} (${editingPayroll.role})${editComments ? ` (Reason: ${editComments})` : ''}`,
        shift: { id: editingPayroll.shiftId, routeNo: editingPayroll.routeNo, shiftType: editingPayroll.shiftType },
        user: actorName,
      });

      setEditingPayroll(null);
    } catch (err) {
      alert('Failed to reject: ' + (err as Error).message);
    } finally {
      setSavingAction(false);
    }
  };

  // Filtered list
  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((item) => {
      const isCharterItem = Boolean(item.isCharter || item.shiftType === 'CHARTER');
      const isNeedsReviewItem = item.status === 'pending_approval' || Boolean(item.hasComments || (item.payrollComments && item.payrollComments.trim() !== ''));

      // Category filter (All vs Needs Review vs Clean vs Charter)
      if (category === 'charter') {
        if (!isCharterItem) return false;
      } else if (category === 'with_comments') {
        if (!isNeedsReviewItem) return false;
      } else if (category === 'without_comments') {
        if (isNeedsReviewItem) return false;
      }

      // Role filter
      if (roleFilter !== 'all' && (item.role || '').toLowerCase() !== roleFilter) {
        return false;
      }
      // Pay Option filter
      if (payOptionFilter !== 'all' && (item.payOption || 'STANDARD') !== payOptionFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const routeMatch = (item.routeNo || '').toLowerCase().includes(q);
        const nameMatch = (item.employeeName || '').toLowerCase().includes(q);
        const empIdMatch = (item.employeeId || '').toLowerCase().includes(q);
        const unitMatch = (item.unitNumber || '').toLowerCase().includes(q);
        const commentMatch = (item.payrollComments || '').toLowerCase().includes(q);
        const sourceMatch = (item.rateSource || '').toLowerCase().includes(q);
        const clientMatch = (item.clientName || '').toLowerCase().includes(q);
        if (!routeMatch && !nameMatch && !empIdMatch && !unitMatch && !commentMatch && !sourceMatch && !clientMatch) {
          return false;
        }
      }
      return true;
    });
  }, [payrolls, category, roleFilter, payOptionFilter, searchQuery]);

  // Virtual scrolling for 1,000+ daily dispatch payroll items
  const payrollTableContainerRef = useRef<HTMLDivElement>(null);
  const payrollVirtualizer = useVirtualizer({
    count: filteredPayrolls.length,
    getScrollElement: () => payrollTableContainerRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const virtualPayrolls = payrollVirtualizer.getVirtualItems();
  const payrollPaddingTop = virtualPayrolls.length > 0 ? virtualPayrolls[0]?.start || 0 : 0;
  const payrollPaddingBottom = virtualPayrolls.length > 0
    ? payrollVirtualizer.getTotalSize() - (virtualPayrolls[virtualPayrolls.length - 1]?.end || 0)
    : 0;

  // Counts for category badges (aligned with pending approval & comments)
  const withCommentsCount = useMemo(() => {
    return payrolls.filter((p) => p.status === 'pending_approval' || Boolean(p.hasComments || (p.payrollComments && p.payrollComments.trim() !== ''))).length;
  }, [payrolls]);

  const withoutCommentsCount = useMemo(() => {
    return payrolls.filter((p) => p.status !== 'pending_approval' && !p.hasComments && (!p.payrollComments || p.payrollComments.trim() === '')).length;
  }, [payrolls]);

  const charterCount = useMemo(() => {
    return payrolls.filter((p) => Boolean(p.isCharter || p.shiftType === 'CHARTER')).length;
  }, [payrolls]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let totalPay = 0;
    let totalEiHours = 0;
    let driversCount = 0;
    let attendantsCount = 0;
    let pendingApprovalCount = 0;
    let syncedToFinanceCount = 0;

    for (const r of payrolls) {
      totalPay += r.payRate || 0;
      totalEiHours += r.eiHours || 0;
      if (r.role === 'driver') driversCount++;
      if (r.role === 'attendant') attendantsCount++;

      if (r.status === 'pending_approval' || Boolean(r.hasComments || (r.payrollComments && r.payrollComments.trim() !== ''))) pendingApprovalCount++;
      if (r.syncedToFinance) syncedToFinanceCount++;
    }

    return {
      totalPay,
      totalEiHours,
      totalCrew: payrolls.length,
      driversCount,
      attendantsCount,
      pendingApprovalCount,
      syncedToFinanceCount,
    };
  }, [payrolls]);

  // Export to Excel / CSV with UTF-8 BOM
  const handleExportExcel = () => {
    if (filteredPayrolls.length === 0) return;

    const headers = [
      'Date',
      'Route No',
      'Shift Type',
      'Role',
      'Employee ID',
      'Employee Name',
      'Unit Number',
      'Check-in Time',
      'Check-out Time',
      'Has Comments',
      'Pay Option',
      'Pay Rate ($)',
      'EI Hours',
      'Rate Source',
      'Payroll Comments',
      'Status',
      'Synced To Finance',
      'Approved By',
      'Last Modified By',
      'Last Modified At',
    ];

    const rows = filteredPayrolls.map((r) => [
      `"${r.dispatchDate}"`,
      `"${(r.routeNo || '').replace(/"/g, '""')}"`,
      `"${(r.shiftType || '').replace(/"/g, '""')}"`,
      `"${(r.role || '').toUpperCase()}"`,
      `"${(r.employeeId || '').replace(/"/g, '""')}"`,
      `"${(r.employeeName || '').replace(/"/g, '""')}"`,
      `"${(r.unitNumber || '').replace(/"/g, '""')}"`,
      `"${(r.checkInTime || '').replace(/"/g, '""')}"`,
      `"${(r.checkOutTime || '').replace(/"/g, '""')}"`,
      r.hasComments ? 'YES' : 'NO',
      `"${(r.payOption || 'STANDARD').replace(/"/g, '""')}"`,
      (r.payRate || 0).toFixed(2),
      (r.eiHours || 0).toFixed(1),
      `"${(r.rateSource || '').replace(/"/g, '""')}"`,
      `"${(r.payrollComments || '').replace(/"/g, '""')}"`,
      `"${(r.status || 'pending').toUpperCase()}"`,
      r.syncedToFinance ? 'YES' : 'NO',
      `"${(r.approvedBy || '').replace(/"/g, '""')}"`,
      `"${(r.updatedBy || r.approvedBy || r.rejectedBy || 'System').replace(/"/g, '""')}"`,
      `"${(r.updatedAt || r.approvedAt || r.rejectedAt || r.createdAt || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Dispatch_Payroll_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (rec: DispatchPayrollRecord) => {
    const s = (rec.status || 'pending').toLowerCase();
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
          <XCircle className="w-3 h-3" />
          <span>Rejected</span>
        </span>
      );
    }
    if (s === 'pending_approval') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
          <AlertCircle className="w-3 h-3" />
          <span>Needs Review</span>
        </span>
      );
    }
    if (s === 'approved') {
      if (rec.syncedToFinance) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            <CheckCircle2 className="w-3 h-3" />
            <span>Synced to Finance</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <CheckCircle2 className="w-3 h-3" />
          <span>Approved ($0 Rate)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
        <Clock className="w-3 h-3" />
        <span>Pending Checkout</span>
      </span>
    );
  };

  // If user is not dispatcher or admin, show restricted notice
  if (!isDispatcherOrAdmin) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center max-w-xl mx-auto space-y-4 my-8">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Daily Dispatch Payroll Restricted
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This workbench is restricted to Dispatchers for reviewing crew comments and approving shift liabilities.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          If you belong to the Payroll or Finance Department, please view and adjust confirmed payroll records in the Payroll Department Log.
        </p>
        {onNavigateToFinanceLog && (
          <div className="pt-2">
            <button
              onClick={onNavigateToFinanceLog}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs transition-all"
            >
              <span>Go to Payroll Department Log</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar: Date Picker + Quick Actions */}
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
              <Calendar className="w-4 h-4 text-amber-500" />
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

        {/* Action Buttons: Export & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors shadow-xs disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredPayrolls.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export filtered records to Microsoft Excel format"
          >
            <Download className="w-4 h-4" />
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Dispatch Payroll</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              ${stats.totalPay.toFixed(2)}
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{stats.syncedToFinanceCount} Synced to Finance</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Needs Review (Comments)</p>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {stats.pendingApprovalCount}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Requires Dispatcher approval
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Crew Checked In</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.totalCrew}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {stats.driversCount} Drivers • {stats.attendantsCount} Attendants
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Users className="w-6 h-6" />
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
      </div>

      {/* TWO PRIMARY CATEGORIES TAB BAR */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          onClick={() => setCategory('all')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors ${
            category === 'all'
              ? 'bg-white dark:bg-slate-900 border-t border-l border-r border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>All Records</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {payrolls.length}
          </span>
        </button>

        <button
          onClick={() => setCategory('with_comments')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors ${
            category === 'with_comments'
              ? 'bg-white dark:bg-slate-900 border-t border-l border-r border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
          <span>Needs Review (Comments)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
            {withCommentsCount}
          </span>
        </button>

        <button
          onClick={() => setCategory('without_comments')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors ${
            category === 'without_comments'
              ? 'bg-white dark:bg-slate-900 border-t border-l border-r border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Without Comments (Clean / Auto)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
            {withoutCommentsCount}
          </span>
        </button>

        <button
          onClick={() => setCategory('charter')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors ${
            category === 'charter'
              ? 'bg-white dark:bg-slate-900 border-t border-l border-r border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-indigo-500" />
          <span>Charter Trips</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold">
            {charterCount}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by route, employee name, ID, unit #..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'driver' | 'attendant')}
              className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="all">All Roles</option>
              <option value="driver">Drivers Only</option>
              <option value="attendant">Attendants Only</option>
            </select>
          </div>

          <select
            value={payOptionFilter}
            onChange={(e) => setPayOptionFilter(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="all">All Pay Options</option>
            <option value="STANDARD">Standard Rate</option>
            <option value="PD">PD (Partial Day)</option>
            <option value="DD">DD (Double Partial)</option>
            <option value="NP">NP (No Pay)</option>
            <option value="F">F (Fixed Override)</option>
          </select>
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
        <div ref={payrollTableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
          <table className="w-full text-left text-sm min-w-[1100px] border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '160px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ minWidth: '200px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 shadow-xs">
              <tr>
                <th className="py-3.5 px-4">Route & Shift</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Check-in / Out</th>
                <th className="py-3.5 px-4 text-right">Pay Rate</th>
                <th className="py-3.5 px-4 text-right">EI Hours</th>
                <th className="py-3.5 px-4">Crew Comments</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-left">Modified By / At</th>
                <th className="py-3.5 px-4 text-center">Dispatcher Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span>Loading dispatch payroll records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPayrolls.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto text-slate-500">
                      <div className="p-3.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <UserCheck className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          No Dispatch Payrolls in this View
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Records are created on check-in. When crew check out without comments, they are automatically sent to Finance. With comments, they await your approval.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {payrollPaddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${payrollPaddingTop}px`, padding: 0, border: 0 }} colSpan={10} />
                    </tr>
                  )}
                  {virtualPayrolls.map((virtualRow) => {
                    const rec = filteredPayrolls[virtualRow.index];
                    if (!rec) return null;
                  const hasComm = Boolean(rec.hasComments || (rec.payrollComments && rec.payrollComments.trim() !== ''));
                    const isNeedsReviewRec = rec.status === 'pending_approval' || hasComm;
                  return (
                    <tr
                      key={rec.id}
                      className={`h-16 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                        isNeedsReviewRec && rec.status === 'pending_approval' ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Route & Shift */}
                      <td className="py-2.5 px-4 align-middle h-16">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {rec.routeNo}
                          </span>
                          {rec.isCharter || rec.shiftType === 'CHARTER' ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              CHARTER
                            </span>
                          ) : (
                            <span className="text-[11px] px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {rec.shiftType}
                            </span>
                          )}
                        </div>
                        {(rec.routeName || rec.clientName) && (
                          <div className="text-xs text-slate-500 truncate max-w-[150px]" title={rec.routeName || rec.clientName}>
                            {rec.routeName || rec.clientName}
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-2.5 px-4 align-middle h-16">
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
                      <td className="py-2.5 px-4 align-middle h-16">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {rec.employeeName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Unit: {rec.unitNumber || '-'}
                        </div>
                      </td>

                      {/* Check-in / Check-out */}
                      <td className="py-2.5 px-4 align-middle h-16 text-xs font-mono">
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <span>In: {rec.checkInTime || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <span>Out: {rec.checkOutTime || '-'}</span>
                        </div>
                      </td>

                      {/* Pay Rate */}
                      <td className="py-2.5 px-4 align-middle h-16 text-right">
                        <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                          ${(rec.payRate || 0).toFixed(2)}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {rec.payOption}
                        </div>
                      </td>

                      {/* EI Hours */}
                      <td className="py-2.5 px-4 align-middle h-16 text-right font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {(rec.eiHours || 0).toFixed(1)} hrs
                      </td>

                      {/* Crew Comments */}
                      <td className="py-2.5 px-4 align-middle h-16">
                        {hasComm ? (
                          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 max-w-[200px]">
                            <div className="font-bold flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                              <MessageSquare className="w-3 h-3" />
                              <span>Crew Comment:</span>
                            </div>
                            <div className="truncate" title={rec.payrollComments}>
                              {rec.payrollComments}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No comments</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4 align-middle h-16 text-center">
                        {getStatusBadge(rec)}
                      </td>

                      {/* Last Modified */}
                      <td className="py-2.5 px-4 align-middle h-16 text-xs font-mono">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {rec.updatedBy || rec.approvedBy || rec.rejectedBy || 'System'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatModifiedAt(rec.updatedAt || rec.approvedAt || rec.rejectedAt || rec.createdAt)}
                        </div>
                      </td>

                      {/* Dispatcher Actions */}
                      <td className="py-2.5 px-4 align-middle h-16 text-center">
                        <div className="inline-flex items-center gap-1">
                          {rec.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleQuickApprove(rec)}
                                disabled={savingAction}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                                title="Approve & Send to Finance"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleQuickReject(rec)}
                                disabled={savingAction}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold border border-rose-200 transition-colors"
                                title="Reject"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleOpenEditModal(rec)}
                            disabled={savingAction}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Rate, Hours or Comments"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                  {payrollPaddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${payrollPaddingBottom}px`, padding: 0, border: 0 }} colSpan={10} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {!loading && filteredPayrolls.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/75 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-800 dark:text-slate-200">{filteredPayrolls.length}</span> of{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">{payrolls.length}</span> records for{' '}
              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{selectedDate}</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span>
                Total Amount: <span className="font-bold text-emerald-600 dark:text-emerald-400">${stats.totalPay.toFixed(2)}</span>
              </span>
              <span>
                Total Hours: <span className="font-bold text-slate-800 dark:text-slate-200">{stats.totalEiHours.toFixed(1)} hrs</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* DISPATCHER EDIT & APPROVAL MODAL */}
      {editingPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Review & Approve Dispatch Payroll
                </h3>
              </div>
              <button
                onClick={() => setEditingPayroll(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>Route: <strong>{editingPayroll.routeNo}</strong> ({editingPayroll.shiftType})</span>
                  <span>Role: <strong className="capitalize">{editingPayroll.role}</strong></span>
                </div>
                <div className="flex justify-between">
                  <span>Employee: <strong>{editingPayroll.employeeName}</strong></span>
                  <span>Check-in / Out: <strong>{editingPayroll.checkInTime || '-'} / {editingPayroll.checkOutTime || '-'}</strong></span>
                </div>
              </div>

              {/* Crew Comments Highlight */}
              {editingPayroll.payrollComments && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
                  <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                    <MessageSquare className="w-4 h-4" />
                    <span>Crew Member Submitted Comments:</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 italic">
                    "{editingPayroll.payrollComments}"
                  </p>
                </div>
              )}

              {/* Pay Option */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pay Option
                </label>
                <select
                  value={editPayOption}
                  onChange={(e) => setEditPayOption(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden"
                >
                  <option value="STANDARD">STANDARD (Route Shift Rate)</option>
                  <option value="PD">PD (Partial Day Override)</option>
                  <option value="DD">DD (Double Partial Override)</option>
                  <option value="NP">NP (No Pay - $0, Not Sent to Finance)</option>
                  <option value="F">F (Fixed Custom Amount)</option>
                </select>
              </div>

              {/* Pay Rate */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pay Rate ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPayRate}
                  onChange={(e) => setEditPayRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* EI Hours */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Insurable EI Hours
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editEiHours}
                  onChange={(e) => setEditEiHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Dispatcher Comments */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dispatcher Review Comments
                </label>
                <textarea
                  rows={2}
                  value={editComments}
                  onChange={(e) => setEditComments(e.target.value)}
                  placeholder="Review notes, e.g. Approved overtime, weather delay confirmed..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/75 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSaveModalReject}
                disabled={savingAction}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
              >
                Reject Record
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPayroll(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalApprove}
                  disabled={savingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{savingAction ? 'Saving...' : 'Approve & Sync to Finance'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
