import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getLocalTodayString,
  addDaysToDateString
} from '../utils/dateUtils';
import {
  History,
  Search,
  Filter,
  Calendar,
  Download,
  RefreshCw,
  ShieldAlert,
  Radio,
  Navigation,
  GraduationCap,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  AlertTriangle
} from 'lucide-react';

// Log Services & Types
import { DispatchService } from '../services/dispatchService';
import { DispatchChangeLog } from '../types/dispatch';

import { RouteAuditService } from '../services/routeAuditService';
import { RouteChangeLog } from '../types/routeAudit';

import { EntityOperationLogService } from '../services/entityOperationLogService';
import { EntityOperationLog } from '../types/entityOperationLog';

import { PayrollOperationLogService } from '../services/payrollOperationLogService';
import { PayrollOperationLog } from '../types/payrollOperationLog';

import { OperationalSafetyLogService } from '../services/operationalSafetyLogService';
import { OperationalSafetyLog } from '../types/operationalSafetyLog';

export type AuditLogCategory =
  | 'dispatch'  // Daily Dispatch Operations
  | 'routes'    // Route & Stop Modifications
  | 'master'    // Student & Vehicle Master CRUD
  | 'payroll'   // Payroll Operations
  | 'safety';   // Safety & Field Operations (Time off, defects, hazards, incidents)

export const AuditLogsView: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  // Active Log Category
  const [activeCategory, setActiveCategory] = useState<AuditLogCategory>('dispatch');

  // Date Range with strict 7-day maximum restriction
  const today = getLocalTodayString();
  const defaultFrom = addDaysToDateString(today, -6); // 7-day span: today - 6 to today

  const [dateFrom, setDateFrom] = useState<string>(defaultFrom);
  const [dateTo, setDateTo] = useState<string>(today);
  const [rangeWarning, setRangeWarning] = useState<string | null>(null);

  // Common Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedActor, setSelectedActor] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Log States for the 5 categories
  const [dispatchLogs, setDispatchLogs] = useState<DispatchChangeLog[]>([]);
  const [routeLogs, setRouteLogs] = useState<RouteChangeLog[]>([]);
  const [masterLogs, setMasterLogs] = useState<EntityOperationLog[]>([]);
  const [payrollLogs, setPayrollLogs] = useState<PayrollOperationLog[]>([]);
  const [safetyLogs, setSafetyLogs] = useState<OperationalSafetyLog[]>([]);

  // Calculate day difference between two dates
  const calculateDaysDiff = (from: string, to: string): number => {
    try {
      const [y1, m1, d1] = from.split('-').map(Number);
      const [y2, m2, d2] = to.split('-').map(Number);
      const time1 = new Date(y1, m1 - 1, d1).getTime();
      const time2 = new Date(y2, m2 - 1, d2).getTime();
      return Math.round((time2 - time1) / (1000 * 3600 * 24)) + 1;
    } catch {
      return 1;
    }
  };

  const handleDateFromChange = (newFrom: string) => {
    setDateFrom(newFrom);
    if (!newFrom) return;

    // If dateTo is before dateFrom, align it
    if (dateTo < newFrom) {
      setDateTo(newFrom);
      setRangeWarning(null);
      return;
    }

    // Check if range exceeds 7 days
    const diffDays = calculateDaysDiff(newFrom, dateTo);
    if (diffDays > 7) {
      const clampedTo = addDaysToDateString(newFrom, 6);
      setDateTo(clampedTo);
      setRangeWarning('Date range automatically adjusted to maximum permitted limit of 7 days.');
    } else {
      setRangeWarning(null);
    }
  };

  const handleDateToChange = (newTo: string) => {
    if (!newTo) return;

    if (newTo < dateFrom) {
      setDateFrom(newTo);
      setDateTo(newTo);
      setRangeWarning(null);
      return;
    }

    const diffDays = calculateDaysDiff(dateFrom, newTo);
    if (diffDays > 7) {
      const clampedFrom = addDaysToDateString(newTo, -6);
      setDateFrom(clampedFrom);
      setDateTo(newTo);
      setRangeWarning('Date range automatically adjusted to maximum permitted limit of 7 days.');
    } else {
      setDateTo(newTo);
      setRangeWarning(null);
    }
  };

  const handleApplyPreset = (days: number) => {
    const currentToday = getLocalTodayString();
    const newFrom = addDaysToDateString(currentToday, -(days - 1));
    setDateFrom(newFrom);
    setDateTo(currentToday);
    setRangeWarning(null);
  };

  // Subscribe to real-time logs across the 5 categories
  useEffect(() => {
    if (!isAdmin) return;

    setLoading(true);

    // 1. Dispatch Logs (load for range)
    const unsubDispatch = DispatchService.subscribeToChangeLogs(
      today,
      (todayLogs) => {
        // Collect logs for the date window
        setDispatchLogs(todayLogs);
        setLoading(false);
      },
      () => setLoading(false)
    );

    // 2. Route Logs
    const unsubRoute = RouteAuditService.subscribeToAllLogs((logs) => {
      setRouteLogs(logs);
    });

    // 3. Master Entity Logs
    const unsubMaster = EntityOperationLogService.subscribeToLogs(
      {},
      (logs) => {
        setMasterLogs(logs);
      }
    );

    // 4. Payroll Logs
    const unsubPayroll = PayrollOperationLogService.subscribeToLogs(
      {},
      (logs) => {
        setPayrollLogs(logs);
      }
    );

    // 5. Safety Logs
    const unsubSafety = OperationalSafetyLogService.subscribeToLogs(
      {},
      (logs) => {
        setSafetyLogs(logs);
      }
    );

    return () => {
      unsubDispatch();
      unsubRoute();
      unsubMaster();
      unsubPayroll();
      unsubSafety();
    };
  }, [isAdmin, today]);

  // Refresh active category
  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedActor('');
    setSelectedAction('all');
  };

  // Filter 1: Dispatch Logs
  const filteredDispatchLogs = useMemo(() => {
    return dispatchLogs.filter((log) => {
      const d = log.dispatchDate || '';
      if (d && (d < dateFrom || d > dateTo)) return false;

      if (selectedActor && log.user && !log.user.toLowerCase().includes(selectedActor.toLowerCase())) {
        return false;
      }
      if (selectedAction !== 'all' && log.type !== selectedAction) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchRoute = log.routeNo?.toLowerCase().includes(q);
        const matchShift = log.shiftType?.toLowerCase().includes(q);
        const matchType = log.type?.toLowerCase().includes(q);
        const matchDetail = log.detail?.toLowerCase().includes(q);
        const matchUser = log.user?.toLowerCase().includes(q);
        if (!matchRoute && !matchShift && !matchType && !matchDetail && !matchUser) {
          return false;
        }
      }
      return true;
    });
  }, [dispatchLogs, dateFrom, dateTo, selectedActor, selectedAction, searchQuery]);

  // Filter 2: Route Audit Logs
  const filteredRouteLogs = useMemo(() => {
    return routeLogs.filter((log) => {
      const d = log.timestamp ? log.timestamp.slice(0, 10) : '';
      if (d && (d < dateFrom || d > dateTo)) return false;

      if (selectedActor && log.userId !== selectedActor && log.userName !== selectedActor) {
        return false;
      }
      if (selectedAction !== 'all' && log.action !== selectedAction && log.category !== selectedAction) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchRoute = log.routeNo?.toLowerCase().includes(q) || log.routeName?.toLowerCase().includes(q);
        const matchSummary = log.summary?.toLowerCase().includes(q);
        const matchActor = log.userName?.toLowerCase().includes(q);
        const matchDiff = log.diffs?.some(
          (diff) =>
            diff.fieldLabel.toLowerCase().includes(q) ||
            String(diff.oldValue).toLowerCase().includes(q) ||
            String(diff.newValue).toLowerCase().includes(q)
        );
        if (!matchRoute && !matchSummary && !matchActor && !matchDiff) {
          return false;
        }
      }
      return true;
    });
  }, [routeLogs, dateFrom, dateTo, selectedActor, selectedAction, searchQuery]);

  // Filter 3: Master Entity Logs
  const filteredMasterLogs = useMemo(() => {
    return masterLogs.filter((log) => {
      const d = log.timestamp ? log.timestamp.slice(0, 10) : '';
      if (d && (d < dateFrom || d > dateTo)) return false;

      if (selectedActor && log.actor?.userId !== selectedActor && log.actor?.userName !== selectedActor) {
        return false;
      }
      if (selectedAction !== 'all' && log.action !== selectedAction && log.targetType !== selectedAction) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTarget =
          log.targetName.toLowerCase().includes(q) ||
          log.targetIdentifier.toLowerCase().includes(q) ||
          log.targetId.toLowerCase().includes(q);
        const matchSummary = log.summary.toLowerCase().includes(q);
        const matchActor = log.actor.userName.toLowerCase().includes(q);
        const matchDiff = log.diffs?.some(
          (diff) =>
            diff.fieldLabel.toLowerCase().includes(q) ||
            String(diff.oldValue).toLowerCase().includes(q) ||
            String(diff.newValue).toLowerCase().includes(q)
        );
        if (!matchTarget && !matchSummary && !matchActor && !matchDiff) {
          return false;
        }
      }
      return true;
    });
  }, [masterLogs, dateFrom, dateTo, selectedActor, selectedAction, searchQuery]);

  // Filter 4: Payroll Logs
  const filteredPayrollLogs = useMemo(() => {
    return payrollLogs.filter((log) => {
      const d = log.timestamp ? log.timestamp.slice(0, 10) : '';
      if (d && (d < dateFrom || d > dateTo)) return false;

      if (selectedActor && log.actor?.userId !== selectedActor && log.actor?.userName !== selectedActor) {
        return false;
      }
      if (selectedAction !== 'all' && log.action !== selectedAction && log.category !== selectedAction) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTarget =
          log.targetName.toLowerCase().includes(q) ||
          log.targetIdentifier.toLowerCase().includes(q) ||
          log.targetId.toLowerCase().includes(q);
        const matchSummary = log.summary.toLowerCase().includes(q);
        const matchActor = log.actor.userName.toLowerCase().includes(q);
        const matchDiff = log.diffs?.some(
          (diff) =>
            diff.fieldLabel.toLowerCase().includes(q) ||
            String(diff.oldValue).toLowerCase().includes(q) ||
            String(diff.newValue).toLowerCase().includes(q)
        );
        if (!matchTarget && !matchSummary && !matchActor && !matchDiff) {
          return false;
        }
      }
      return true;
    });
  }, [payrollLogs, dateFrom, dateTo, selectedActor, selectedAction, searchQuery]);

  // Filter 5: Safety & Operational Logs
  const filteredSafetyLogs = useMemo(() => {
    return safetyLogs.filter((log) => {
      const d = log.timestamp ? log.timestamp.slice(0, 10) : '';
      if (d && (d < dateFrom || d > dateTo)) return false;

      if (selectedActor && log.actor?.userId !== selectedActor && log.actor?.userName !== selectedActor) {
        return false;
      }
      if (selectedAction !== 'all' && log.action !== selectedAction && log.module !== selectedAction) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTarget =
          log.targetTitle.toLowerCase().includes(q) ||
          log.targetIdentifier.toLowerCase().includes(q) ||
          log.targetId.toLowerCase().includes(q);
        const matchSummary = log.summary.toLowerCase().includes(q);
        const matchActor = log.actor.userName.toLowerCase().includes(q);
        const matchDiff = log.diffs?.some(
          (diff) =>
            diff.fieldLabel.toLowerCase().includes(q) ||
            String(diff.oldValue).toLowerCase().includes(q) ||
            String(diff.newValue).toLowerCase().includes(q)
        );
        if (!matchTarget && !matchSummary && !matchActor && !matchDiff) {
          return false;
        }
      }
      return true;
    });
  }, [safetyLogs, dateFrom, dateTo, selectedActor, selectedAction, searchQuery]);

  // Distinct actors for current active log category
  const activeActors = useMemo(() => {
    const set = new Set<string>();
    if (activeCategory === 'dispatch') {
      dispatchLogs.forEach((l) => l.user && set.add(l.user));
    } else if (activeCategory === 'routes') {
      routeLogs.forEach((l) => l.userName && set.add(l.userName));
    } else if (activeCategory === 'master') {
      masterLogs.forEach((l) => l.actor?.userName && set.add(l.actor.userName));
    } else if (activeCategory === 'payroll') {
      payrollLogs.forEach((l) => l.actor?.userName && set.add(l.actor.userName));
    } else if (activeCategory === 'safety') {
      safetyLogs.forEach((l) => l.actor?.userName && set.add(l.actor.userName));
    }
    return Array.from(set).sort();
  }, [activeCategory, dispatchLogs, routeLogs, masterLogs, payrollLogs, safetyLogs]);

  // Total active records for current category
  const currentCount = useMemo(() => {
    switch (activeCategory) {
      case 'dispatch':
        return filteredDispatchLogs.length;
      case 'routes':
        return filteredRouteLogs.length;
      case 'master':
        return filteredMasterLogs.length;
      case 'payroll':
        return filteredPayrollLogs.length;
      case 'safety':
        return filteredSafetyLogs.length;
    }
  }, [
    activeCategory,
    filteredDispatchLogs.length,
    filteredRouteLogs.length,
    filteredMasterLogs.length,
    filteredPayrollLogs.length,
    filteredSafetyLogs.length
  ]);

  // Export CSV handler
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    const filename = `audit_${activeCategory}_${dateFrom}_to_${dateTo}.csv`;

    if (activeCategory === 'dispatch') {
      headers = ['Date', 'Time', 'Route', 'Shift', 'Type', 'Details', 'Operator'];
      rows = filteredDispatchLogs.map((l) => [
        `"${l.dispatchDate}"`,
        `"${l.time}"`,
        `"${l.routeNo}"`,
        `"${l.shiftType}"`,
        `"${l.type}"`,
        `"${l.detail.replace(/"/g, '""')}"`,
        `"${l.user}"`
      ]);
    } else if (activeCategory === 'routes') {
      headers = ['Timestamp', 'Route No', 'Category', 'Action', 'Summary', 'Operator', 'Role'];
      rows = filteredRouteLogs.map((l) => [
        `"${l.timestamp}"`,
        `"${l.routeNo}"`,
        `"${l.category}"`,
        `"${l.action}"`,
        `"${l.summary.replace(/"/g, '""')}"`,
        `"${l.userName}"`,
        `"${l.userRole || ''}"`
      ]);
    } else if (activeCategory === 'master') {
      headers = ['Timestamp', 'Target Type', 'ID', 'Name', 'Action', 'Summary', 'Operator', 'Role'];
      rows = filteredMasterLogs.map((l) => [
        `"${l.timestamp}"`,
        `"${l.targetType}"`,
        `"${l.targetIdentifier}"`,
        `"${l.targetName.replace(/"/g, '""')}"`,
        `"${l.action}"`,
        `"${l.summary.replace(/"/g, '""')}"`,
        `"${l.actor.userName}"`,
        `"${l.actor.userRole || ''}"`
      ]);
    } else if (activeCategory === 'payroll') {
      headers = ['Timestamp', 'Category', 'Target', 'Amount', 'Action', 'Summary', 'Operator'];
      rows = filteredPayrollLogs.map((l) => [
        `"${l.timestamp}"`,
        `"${l.category}"`,
        `"${l.targetIdentifier}"`,
        `"${l.amount ? `$${l.amount.toFixed(2)}` : ''}"`,
        `"${l.action}"`,
        `"${l.summary.replace(/"/g, '""')}"`,
        `"${l.actor.userName}"`
      ]);
    } else if (activeCategory === 'safety') {
      headers = ['Timestamp', 'Module', 'Target', 'Severity', 'Action', 'Summary', 'Operator'];
      rows = filteredSafetyLogs.map((l) => [
        `"${l.timestamp}"`,
        `"${l.module}"`,
        `"${l.targetIdentifier}"`,
        `"${l.severity || ''}"`,
        `"${l.action}"`,
        `"${l.summary.replace(/"/g, '""')}"`,
        `"${l.actor.userName}"`
      ]);
    }

    if (rows.length === 0) return;

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If user is not admin, deny access immediately
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Access Restricted</h2>
        <p className="text-sm text-slate-400 max-w-md mt-2">
          System Audit Logs are strictly restricted to administrators. Your current account does not have authorization to view operational change histories.
        </p>
      </div>
    );
  }

  const selectedDaysCount = calculateDaysDiff(dateFrom, dateTo);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              System Audit & Operation Logs
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive compliance audit trails across 5 operational modules (Max 7-day query window)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={currentCount === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Selection Bar with Max 7 Days Constraint */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Audit Query Window (Maximum 7 Days Allowed)</span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                selectedDaysCount > 7
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              Active Window: {selectedDaysCount} {selectedDaysCount === 1 ? 'day' : 'days'} / 7 max
            </span>
          </div>
        </div>

        {rangeWarning && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center space-x-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{rangeWarning}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Inputs for Date From and Date To */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Start Date (From)
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                max={today}
                className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                End Date (To)
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                min={dateFrom}
                max={today}
                className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center space-x-2 pt-1 md:pt-0">
            <span className="text-xs text-slate-400 font-medium mr-1">Presets:</span>
            <button
              onClick={() => handleApplyPreset(1)}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Today
            </button>
            <button
              onClick={() => handleApplyPreset(3)}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Past 3 Days
            </button>
            <button
              onClick={() => handleApplyPreset(7)}
              className="px-2.5 py-1 text-xs rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold transition"
            >
              Past 7 Days (Max)
            </button>
          </div>
        </div>
      </div>

      {/* The 5 Primary Log Category Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {/* 1. Daily Dispatch */}
        <button
          onClick={() => {
            setActiveCategory('dispatch');
            handleResetFilters();
          }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeCategory === 'dispatch'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>1. Daily Dispatch Logs</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-current">
            {filteredDispatchLogs.length}
          </span>
        </button>

        {/* 2. Routes & Schedules */}
        <button
          onClick={() => {
            setActiveCategory('routes');
            handleResetFilters();
          }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeCategory === 'routes'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>2. Route & Stops Audit</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-current">
            {filteredRouteLogs.length}
          </span>
        </button>

        {/* 3. Students & Vehicles Master */}
        <button
          onClick={() => {
            setActiveCategory('master');
            handleResetFilters();
          }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeCategory === 'master'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>3. Student & Vehicle Master</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-current">
            {filteredMasterLogs.length}
          </span>
        </button>

        {/* 4. Payroll Operations */}
        <button
          onClick={() => {
            setActiveCategory('payroll');
            handleResetFilters();
          }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeCategory === 'payroll'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>4. Payroll Operations</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-current">
            {filteredPayrollLogs.length}
          </span>
        </button>

        {/* 5. Safety & Operational Records */}
        <button
          onClick={() => {
            setActiveCategory('safety');
            handleResetFilters();
          }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeCategory === 'safety'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>5. Safety & Field Operations</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-current">
            {filteredSafetyLogs.length}
          </span>
        </button>
      </div>

      {/* Query Filters (Keywords, Operator, Action) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Filter className="w-4 h-4 text-amber-400" />
            <span>Search & Filter In Selected Module</span>
          </div>
          {(searchQuery || selectedActor || selectedAction !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search content, summary, ID, or diff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Operator / User Dropdown */}
          <div>
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">All Operators / Users</option>
              {activeActors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>
          </div>

          {/* Action / Category Dropdown */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Actions & Categories</option>
              {activeCategory === 'dispatch' && (
                <>
                  <option value="Driver Replacement">Driver Replacement</option>
                  <option value="Vehicle Replacement">Vehicle Replacement</option>
                  <option value="Split Shift">Split Shift</option>
                  <option value="Student Absence">Student Absence</option>
                  <option value="Stop Arrival">Stop Arrival</option>
                </>
              )}
              {activeCategory === 'routes' && (
                <>
                  <option value="route">Route Settings</option>
                  <option value="shift">Shift Schedules</option>
                  <option value="stop">Stop Itinerary</option>
                  <option value="student">Student Rider Allocations</option>
                </>
              )}
              {activeCategory === 'master' && (
                <>
                  <option value="create">Created Records</option>
                  <option value="update">Updated Records</option>
                  <option value="delete">Deleted Records</option>
                  <option value="student">Students Only</option>
                  <option value="vehicle">Vehicles Only</option>
                </>
              )}
              {activeCategory === 'payroll' && (
                <>
                  <option value="base_rate">Base Rates</option>
                  <option value="custom_rate">Custom Override Rates</option>
                  <option value="dispatch_payroll">Dispatch Shift Payrolls</option>
                  <option value="finance_payroll">Finance Department Logs</option>
                  <option value="approve">Approvals</option>
                  <option value="reject">Rejections</option>
                </>
              )}
              {activeCategory === 'safety' && (
                <>
                  <option value="time_off">Time Off Requests</option>
                  <option value="vehicle_defect">Vehicle Defects</option>
                  <option value="hazard_report">Hazard Assessments</option>
                  <option value="student_incident">Student Incidents</option>
                  <option value="approve">Approved</option>
                  <option value="resolve">Resolved</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Log Feed Display */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span>Loading audit log records...</span>
        </div>
      ) : currentCount === 0 ? (
        <div className="py-12 text-center bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <History className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-slate-400">No audit records found in this range</p>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your 7-day date window ({dateFrom} to {dateTo}) or clearing search filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* CATEGORY 1: Daily Dispatch Logs */}
          {activeCategory === 'dispatch' &&
            filteredDispatchLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {log.type}
                    </span>
                    <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {log.routeNo} ({log.shiftType})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{log.dispatchDate} {log.time}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-200 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  {log.detail}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-300">Operator: {log.user}</span>
                  </div>
                </div>
              </div>
            ))}

          {/* CATEGORY 2: Route & Stops Audit Logs */}
          {activeCategory === 'routes' &&
            filteredRouteLogs.map((log) => {
              const isExpanded = expandedLogIds.has(log.id);
              const hasDiffs = log.diffs && log.diffs.length > 0;
              return (
                <div
                  key={log.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {log.category} • {log.action}
                      </span>
                      <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {log.routeNo}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    {log.summary}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-slate-300">{log.userName}</span>
                      {log.userRole && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.userRole}
                        </span>
                      )}
                    </div>
                    {hasDiffs && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        <span>{isExpanded ? 'Hide Diffs' : 'View Diffs'} ({log.diffs?.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {hasDiffs && isExpanded && (
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                      {log.diffs?.map((diff, i) => (
                        <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                          <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
                          <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || 'none')}</span>
                          <span className="text-emerald-400 font-bold">{String(diff.newValue || 'none')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* CATEGORY 3: Student & Vehicle Master Logs */}
          {activeCategory === 'master' &&
            filteredMasterLogs.map((log) => {
              const isExpanded = expandedLogIds.has(log.id);
              const hasDiffs = log.diffs && log.diffs.length > 0;
              const isStudent = log.targetType === 'student';
              return (
                <div
                  key={log.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase border ${
                          log.action === 'create'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : log.action === 'update'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {isStudent ? 'Student' : 'Vehicle'} #{log.targetIdentifier}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold">{log.targetName}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    {log.summary}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-slate-300">{log.actor.userName}</span>
                      {log.actor.userRole && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.actor.userRole}
                        </span>
                      )}
                    </div>
                    {hasDiffs && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        <span>{isExpanded ? 'Hide Diffs' : 'View Diffs'} ({log.diffs?.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {hasDiffs && isExpanded && (
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                      {log.diffs?.map((diff, i) => (
                        <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                          <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
                          <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || 'none')}</span>
                          <span className="text-emerald-400 font-bold">{String(diff.newValue || 'none')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* CATEGORY 4: Payroll Operation Logs */}
          {activeCategory === 'payroll' &&
            filteredPayrollLogs.map((log) => {
              const isExpanded = expandedLogIds.has(log.id);
              const hasDiffs = log.diffs && log.diffs.length > 0;
              return (
                <div
                  key={log.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {log.category.replace('_', ' ')} • {log.action}
                      </span>
                      <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {log.targetIdentifier}
                      </span>
                      {log.amount !== undefined && (
                        <span className="font-mono font-bold text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          ${log.amount.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    {log.summary}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-slate-300">{log.actor.userName}</span>
                      {log.actor.userRole && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.actor.userRole}
                        </span>
                      )}
                    </div>
                    {hasDiffs && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        <span>{isExpanded ? 'Hide Diffs' : 'View Diffs'} ({log.diffs?.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {hasDiffs && isExpanded && (
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                      {log.diffs?.map((diff, i) => (
                        <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                          <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
                          <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || 'none')}</span>
                          <span className="text-emerald-400 font-bold">{String(diff.newValue || 'none')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* CATEGORY 5: Safety & Operational Logs */}
          {activeCategory === 'safety' &&
            filteredSafetyLogs.map((log) => {
              const isExpanded = expandedLogIds.has(log.id);
              const hasDiffs = log.diffs && log.diffs.length > 0;
              return (
                <div
                  key={log.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {log.module.replace('_', ' ')} • {log.action}
                      </span>
                      <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {log.targetIdentifier}
                      </span>
                      {log.severity && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
                          {log.severity}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    {log.summary}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-slate-300">{log.actor.userName}</span>
                      {log.actor.userRole && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.actor.userRole}
                        </span>
                      )}
                    </div>
                    {hasDiffs && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        <span>{isExpanded ? 'Hide Diffs' : 'View Diffs'} ({log.diffs?.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {hasDiffs && isExpanded && (
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                      {log.diffs?.map((diff, i) => (
                        <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                          <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
                          <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || 'none')}</span>
                          <span className="text-emerald-400 font-bold">{String(diff.newValue || 'none')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
