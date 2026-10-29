import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
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
  const { isFrench } = useI18n();
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  // Active Log Category
  const [activeCategory, setActiveCategory] = useState<AuditLogCategory>('dispatch');

  // Date Range: Default is today, with strict 7-day maximum restriction
  const today = getLocalTodayString();
  const defaultFrom = today; // Default is today

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
    if (!newFrom) return;
    setDateFrom(newFrom);

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
      setRangeWarning(
        isFrench
          ? 'La période a été ajustée automatiquement à la limite maximale autorisée de 7 jours.'
          : 'Date range automatically adjusted to maximum permitted limit of 7 days.'
      );
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
      setRangeWarning(
        isFrench
          ? 'La période a été ajustée automatiquement à la limite maximale autorisée de 7 jours.'
          : 'Date range automatically adjusted to maximum permitted limit of 7 days.'
      );
    } else {
      setDateTo(newTo);
      setRangeWarning(null);
    }
  };

  const handleApplyPreset = (days: number) => {
    const currentToday = getLocalTodayString();
    if (days === 1) {
      setDateFrom(currentToday);
      setDateTo(currentToday);
    } else {
      const newFrom = addDaysToDateString(currentToday, -(days - 1));
      setDateFrom(newFrom);
      setDateTo(currentToday);
    }
    setRangeWarning(null);
  };

  // Subscribe to real-time logs across the 5 categories
  useEffect(() => {
    if (!isAdmin) return;

    setLoading(true);

    // Collect dates in [dateFrom, dateTo] (up to 7 days)
    const dates: string[] = [];
    let cur = dateFrom;
    while (cur <= dateTo && dates.length < 8) {
      dates.push(cur);
      cur = addDaysToDateString(cur, 1);
    }

    let isSubscribed = true;

    // 1. Dispatch Logs across the selected dates
    Promise.all(dates.map((d) => DispatchService.listChangeLogs(d, { scope: 'all' })))
      .then((results) => {
        if (!isSubscribed) return;
        const allLogs: DispatchChangeLog[] = [];
        const seen = new Set<string>();
        results.forEach((dayLogs) => {
          if (Array.isArray(dayLogs)) {
            dayLogs.forEach((l) => {
              const uid = l.id || `${l.dispatchDate}-${l.timestamp}-${l.detail}`;
              if (!seen.has(uid)) {
                seen.add(uid);
                allLogs.push(l);
              }
            });
          }
        });
        allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setDispatchLogs(allLogs);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dispatch logs for range:', err);
        if (isSubscribed) setLoading(false);
      });

    // If today is in dates, maintain real-time listener for today's logs
    let unsubToday = () => {};
    if (dates.includes(today)) {
      unsubToday = DispatchService.subscribeToChangeLogs(
        today,
        (todayLogs) => {
          if (!isSubscribed) return;
          setDispatchLogs((prev) => {
            const map = new Map<string, DispatchChangeLog>();
            prev.filter((l) => l.dispatchDate !== today).forEach((l) => {
              map.set(l.id || `${l.dispatchDate}-${l.timestamp}-${l.detail}`, l);
            });
            todayLogs.forEach((l) => {
              map.set(l.id || `${l.dispatchDate}-${l.timestamp}-${l.detail}`, l);
            });
            const merged = Array.from(map.values());
            merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            return merged;
          });
        },
        () => {}
      );
    }

    // 2. Route Logs
    const unsubRoute = RouteAuditService.subscribeToAllLogs((logs) => {
      if (isSubscribed) setRouteLogs(logs);
    });

    // 3. Master Entity Logs
    const unsubMaster = EntityOperationLogService.subscribeToLogs(
      {},
      (logs) => {
        if (isSubscribed) setMasterLogs(logs);
      }
    );

    // 4. Payroll Logs
    const unsubPayroll = PayrollOperationLogService.subscribeToLogs(
      {},
      (logs) => {
        if (isSubscribed) setPayrollLogs(logs);
      }
    );

    // 5. Safety Logs
    const unsubSafety = OperationalSafetyLogService.subscribeToLogs(
      {},
      (logs) => {
        if (isSubscribed) setSafetyLogs(logs);
      }
    );

    return () => {
      isSubscribed = false;
      unsubToday();
      unsubRoute();
      unsubMaster();
      unsubPayroll();
      unsubSafety();
    };
  }, [isAdmin, dateFrom, dateTo, today]);

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

  // Filter 5: Safety Logs
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
          log.targetIdentifier.toLowerCase().includes(q) ||
          log.targetId.toLowerCase().includes(q);
        const matchSummary = log.summary.toLowerCase().includes(q);
        const matchActor = log.actor.userName.toLowerCase().includes(q);
        const matchModule = log.module.toLowerCase().includes(q);
        const matchDiff = log.diffs?.some(
          (diff) =>
            diff.fieldLabel.toLowerCase().includes(q) ||
            String(diff.oldValue).toLowerCase().includes(q) ||
            String(diff.newValue).toLowerCase().includes(q)
        );
        if (!matchTarget && !matchSummary && !matchActor && !matchModule && !matchDiff) {
          return false;
        }
      }
      return true;
    });
  }, [safetyLogs, dateFrom, dateTo, selectedActor, selectedAction, searchQuery]);

  // Distinct actors for dropdown filtering
  const activeActors = useMemo(() => {
    const set = new Set<string>();
    switch (activeCategory) {
      case 'dispatch':
        dispatchLogs.forEach((l) => l.user && set.add(l.user));
        break;
      case 'routes':
        routeLogs.forEach((l) => l.userName && set.add(l.userName));
        break;
      case 'master':
        masterLogs.forEach((l) => l.actor?.userName && set.add(l.actor.userName));
        break;
      case 'payroll':
        payrollLogs.forEach((l) => l.actor?.userName && set.add(l.actor.userName));
        break;
      case 'safety':
        safetyLogs.forEach((l) => l.actor?.userName && set.add(l.actor.userName));
        break;
    }
    return Array.from(set).sort();
  }, [activeCategory, dispatchLogs, routeLogs, masterLogs, payrollLogs, safetyLogs]);

  // Export to CSV for active category
  const handleExportCSV = () => {
    let rows: string[][] = [];
    let filename = `audit_${activeCategory}_${dateFrom}_to_${dateTo}.csv`;

    switch (activeCategory) {
      case 'dispatch':
        rows = [
          ['Type', 'Route', 'Shift', 'Date', 'Time', 'Detail', 'User'],
          ...filteredDispatchLogs.map((l) => [
            `"${l.type}"`,
            `"${l.routeNo || ''}"`,
            `"${l.shiftType || ''}"`,
            `"${l.dispatchDate || ''}"`,
            `"${l.time || ''}"`,
            `"${(l.detail || '').replace(/"/g, '""')}"`,
            `"${l.user || ''}"`,
          ]),
        ];
        break;
      case 'routes':
        rows = [
          ['ID', 'Timestamp', 'Route No', 'Category', 'Action', 'Summary', 'User', 'Diffs'],
          ...filteredRouteLogs.map((l) => [
            `"${l.id}"`,
            `"${l.timestamp}"`,
            `"${l.routeNo || ''}"`,
            `"${l.category}"`,
            `"${l.action}"`,
            `"${l.summary.replace(/"/g, '""')}"`,
            `"${l.userName} (${l.userRole})"`,
            `"${(l.diffs || []).map((d) => `${d.fieldLabel}: ${d.oldValue} -> ${d.newValue}`).join('; ').replace(/"/g, '""')}"`,
          ]),
        ];
        break;
      case 'master':
        rows = [
          ['ID', 'Timestamp', 'Target Type', 'Target ID', 'Target Name', 'Action', 'Summary', 'Actor'],
          ...filteredMasterLogs.map((l) => [
            `"${l.id}"`,
            `"${l.timestamp}"`,
            `"${l.targetType}"`,
            `"${l.targetIdentifier}"`,
            `"${l.targetName}"`,
            `"${l.action}"`,
            `"${l.summary.replace(/"/g, '""')}"`,
            `"${l.actor.userName} (${l.actor.userRole})"`,
          ]),
        ];
        break;
      case 'payroll':
        rows = [
          ['ID', 'Timestamp', 'Category', 'Target', 'Action', 'Amount', 'Summary', 'Actor'],
          ...filteredPayrollLogs.map((l) => [
            `"${l.id}"`,
            `"${l.timestamp}"`,
            `"${l.category}"`,
            `"${l.targetIdentifier}"`,
            `"${l.action}"`,
            `"${l.amount !== undefined ? l.amount : ''}"`,
            `"${l.summary.replace(/"/g, '""')}"`,
            `"${l.actor.userName} (${l.actor.userRole})"`,
          ]),
        ];
        break;
      case 'safety':
        rows = [
          ['ID', 'Timestamp', 'Module', 'Target ID', 'Action', 'Severity', 'Summary', 'Actor'],
          ...filteredSafetyLogs.map((l) => [
            `"${l.id}"`,
            `"${l.timestamp}"`,
            `"${l.module}"`,
            `"${l.targetIdentifier}"`,
            `"${l.action}"`,
            `"${l.severity || ''}"`,
            `"${l.summary.replace(/"/g, '""')}"`,
            `"${l.actor.userName} (${l.actor.userRole})"`,
          ]),
        ];
        break;
    }

    if (rows.length === 0) return;
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
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
        <h2 className="text-xl font-bold text-white tracking-tight">
          {isFrench ? 'Accès restreint' : 'Access Restricted'}
        </h2>
        <p className="text-sm text-slate-400 max-w-md mt-2">
          {isFrench
            ? 'Les journaux d\'audit système sont strictement réservés aux administrateurs. Votre compte actuel n\'a pas l\'autorisation de consulter l\'historique des modifications opérationnelles.'
            : 'System Audit Logs are strictly restricted to administrators. Your current account does not have authorization to view operational change histories.'}
        </p>
      </div>
    );
  }

  const selectedDaysCount = calculateDaysDiff(dateFrom, dateTo);

  // Virtual scrolling container for 1,000+ audit logs
  const logContainerRef = useRef<HTMLDivElement>(null);

  const activeLogsCount = useMemo(() => {
    switch (activeCategory) {
      case 'dispatch': return filteredDispatchLogs.length;
      case 'routes': return filteredRouteLogs.length;
      case 'master': return filteredMasterLogs.length;
      case 'payroll': return filteredPayrollLogs.length;
      case 'safety': return filteredSafetyLogs.length;
      default: return 0;
    }
  }, [activeCategory, filteredDispatchLogs.length, filteredRouteLogs.length, filteredMasterLogs.length, filteredPayrollLogs.length, filteredSafetyLogs.length]);

  const logVirtualizer = useVirtualizer({
    count: activeLogsCount,
    getScrollElement: () => logContainerRef.current,
    estimateSize: () => 140,
    overscan: 6,
  });

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
              {isFrench ? 'Journaux d\'audit et d\'opérations système' : 'System Audit & Operation Logs'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isFrench
                ? 'Pistes d\'audit de conformité sur 5 modules opérationnels (Fenêtre max. de 7 jours, défaut : aujourd\'hui)'
                : 'Comprehensive compliance audit trails across 5 operational modules (Max 7-day query window, default: today)'}
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
            <span>{isFrench ? 'Actualiser' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={activeLogsCount === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Exporter CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Date Range Selection Bar with Max 7 Days Constraint & Default Today */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>
              {isFrench
                ? 'Fenêtre d\'audit (Maximum 7 jours autorisés)'
                : 'Audit Query Window (Maximum 7 Days Allowed)'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                selectedDaysCount > 7
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isFrench
                ? `Fenêtre active : ${selectedDaysCount} ${selectedDaysCount === 1 ? 'jour' : 'jours'} / 7 max`
                : `Active Window: ${selectedDaysCount} ${selectedDaysCount === 1 ? 'day' : 'days'} / 7 max`}
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
                {isFrench ? 'Date de début (Du)' : 'Start Date (From)'}
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
                {isFrench ? 'Date de fin (Au)' : 'End Date (To)'}
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

          {/* Quick Presets with Today as the prominent default */}
          <div className="flex items-center space-x-2 pt-1 md:pt-0">
            <span className="text-xs text-slate-400 font-medium mr-1">
              {isFrench ? 'Préréglages :' : 'Presets:'}
            </span>
            <button
              type="button"
              onClick={() => handleApplyPreset(1)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition font-semibold ${
                selectedDaysCount === 1 && dateTo === today
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {isFrench ? 'Aujourd\'hui (Défaut)' : 'Today (Default)'}
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(3)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                selectedDaysCount === 3 && dateTo === today
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-semibold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {isFrench ? '3 derniers jours' : 'Past 3 Days'}
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(7)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                selectedDaysCount === 7 && dateTo === today
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-bold'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold'
              }`}
            >
              {isFrench ? '7 derniers jours (Max)' : 'Past 7 Days (Max)'}
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
          <span>{isFrench ? '1. Opérations de régulation' : '1. Daily Dispatch Logs'}</span>
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
          <span>{isFrench ? '2. Circuits & Horaires' : '2. Route & Stops Audit'}</span>
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
          <span>{isFrench ? '3. Référentiel Élèves & Véhicules' : '3. Student & Vehicle Master'}</span>
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
          <span>{isFrench ? '4. Opérations de paie' : '4. Payroll Operations'}</span>
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
          <span>{isFrench ? '5. Sécurité & Opérations terrain' : '5. Safety & Field Operations'}</span>
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
            <span>
              {isFrench
                ? 'Recherche & Filtres dans le module sélectionné'
                : 'Search & Filter In Selected Module'}
            </span>
          </div>
          {(searchQuery || selectedActor || selectedAction !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
            >
              {isFrench ? 'Réinitialiser' : 'Reset Filters'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder={isFrench ? 'Rechercher par intervenant, circuit, ID ou détail...' : 'Search content, summary, ID, or diff...'}
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
              <option value="">{isFrench ? 'Tous les utilisateurs / intervenants' : 'All Operators / Users'}</option>
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
              <option value="all">{isFrench ? 'Toutes les actions & catégories' : 'All Actions & Categories'}</option>
              {activeCategory === 'dispatch' && (
                <>
                  <option value="Driver Replacement">{isFrench ? 'Remplacement chauffeur' : 'Driver Replacement'}</option>
                  <option value="Vehicle Replacement">{isFrench ? 'Remplacement véhicule' : 'Vehicle Replacement'}</option>
                  <option value="Split Shift">{isFrench ? 'Scission de trajet' : 'Split Shift'}</option>
                  <option value="Student Absence">{isFrench ? 'Absence élève' : 'Student Absence'}</option>
                  <option value="Stop Arrival">{isFrench ? 'Arrivée à l\'arrêt' : 'Stop Arrival'}</option>
                </>
              )}
              {activeCategory === 'routes' && (
                <>
                  <option value="route">{isFrench ? 'Paramètres circuit' : 'Route Settings'}</option>
                  <option value="shift">{isFrench ? 'Horaires trajets' : 'Shift Schedules'}</option>
                  <option value="stop">{isFrench ? 'Itinéraire arrêts' : 'Stop Itinerary'}</option>
                  <option value="student">{isFrench ? 'Affectation élèves' : 'Student Rider Allocations'}</option>
                </>
              )}
              {activeCategory === 'master' && (
                <>
                  <option value="create">{isFrench ? 'Créations' : 'Created Records'}</option>
                  <option value="update">{isFrench ? 'Modifications' : 'Updated Records'}</option>
                  <option value="delete">{isFrench ? 'Suppressions' : 'Deleted Records'}</option>
                  <option value="student">{isFrench ? 'Élèves seulement' : 'Students Only'}</option>
                  <option value="vehicle">{isFrench ? 'Véhicules seulement' : 'Vehicles Only'}</option>
                </>
              )}
              {activeCategory === 'payroll' && (
                <>
                  <option value="base_rate">{isFrench ? 'Taux de base' : 'Base Rates'}</option>
                  <option value="custom_rate">{isFrench ? 'Taux personnalisés' : 'Custom Override Rates'}</option>
                  <option value="dispatch_payroll">{isFrench ? 'Paie régulation' : 'Dispatch Shift Payrolls'}</option>
                  <option value="finance_payroll">{isFrench ? 'Paie comptabilité' : 'Finance Department Logs'}</option>
                  <option value="approve">{isFrench ? 'Approbations' : 'Approvals'}</option>
                  <option value="reject">{isFrench ? 'Rejets' : 'Rejections'}</option>
                </>
              )}
              {activeCategory === 'safety' && (
                <>
                  <option value="time_off">{isFrench ? 'Demandes de congé' : 'Time Off Requests'}</option>
                  <option value="vehicle_defect">{isFrench ? 'Défectuosités véhicules' : 'Vehicle Defects'}</option>
                  <option value="hazard_report">{isFrench ? 'Évaluations des dangers' : 'Hazard Assessments'}</option>
                  <option value="student_incident">{isFrench ? 'Incidents élèves' : 'Student Incidents'}</option>
                  <option value="approve">{isFrench ? 'Approuvé' : 'Approved'}</option>
                  <option value="resolve">{isFrench ? 'Résolu' : 'Resolved'}</option>
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
          <span>{isFrench ? 'Chargement des journaux d\'audit...' : 'Loading audit log records...'}</span>
        </div>
      ) : activeLogsCount === 0 ? (
        <div className="py-12 text-center bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <History className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-slate-400">
            {isFrench
              ? 'Aucun enregistrement d\'audit trouvé pour cette période'
              : 'No audit records found in this range'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {isFrench
              ? `Ajustez votre période de 7 jours (${dateFrom} au ${dateTo}) ou réinitialisez les filtres.`
              : `Try adjusting your 7-day date window (${dateFrom} to ${dateTo}) or clearing search filters.`}
          </p>
        </div>
      ) : (
        <div ref={logContainerRef} className="overflow-y-auto max-h-[calc(100vh-270px)] pr-1">
          <div
            style={{
              height: `${logVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {logVirtualizer.getVirtualItems().map((virtualRow) => {
              const idx = virtualRow.index;
              return (
                <div
                  key={`${activeCategory}-${idx}`}
                  data-index={idx}
                  ref={logVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '12px',
                  }}
                >
                  {/* CATEGORY 1: Daily Dispatch Logs */}
                  {activeCategory === 'dispatch' && (() => {
                    const log = filteredDispatchLogs[idx];
                    if (!log) return null;
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2 shadow-sm">
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
                            <span className="font-semibold text-slate-300">
                              {isFrench ? 'Opérateur :' : 'Operator:'} {log.user}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* CATEGORY 2: Route & Stops Audit Logs */}
                  {activeCategory === 'routes' && (() => {
                    const log = filteredRouteLogs[idx];
                    if (!log) return null;
                    const isExpanded = expandedLogIds.has(log.id);
                    const hasDiffs = log.diffs && log.diffs.length > 0;
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm">
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
                              <span>
                                {isExpanded
                                  ? (isFrench ? 'Masquer les écarts' : 'Hide Diffs')
                                  : (isFrench ? 'Voir les écarts' : 'View Diffs')}{' '}
                                ({log.diffs?.length})
                              </span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {hasDiffs && isExpanded && (
                          <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                            {log.diffs?.map((diff, i) => (
                              <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                                <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
                                <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || (isFrench ? 'aucun' : 'none'))}</span>
                                <span className="text-emerald-400 font-bold">{String(diff.newValue || (isFrench ? 'aucun' : 'none'))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* CATEGORY 3: Student & Vehicle Master Logs */}
                  {activeCategory === 'master' && (() => {
                    const log = filteredMasterLogs[idx];
                    if (!log) return null;
                    const isExpanded = expandedLogIds.has(log.id);
                    const hasDiffs = log.diffs && log.diffs.length > 0;
                    const isStudent = log.targetType === 'student';
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm">
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
                              {isStudent ? (isFrench ? 'Élève' : 'Student') : (isFrench ? 'Véhicule' : 'Vehicle')} #{log.targetIdentifier}
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
                              <span>
                                {isExpanded
                                  ? (isFrench ? 'Masquer les écarts' : 'Hide Diffs')
                                  : (isFrench ? 'Voir les écarts' : 'View Diffs')}{' '}
                                ({log.diffs?.length})
                              </span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {hasDiffs && isExpanded && (
                          <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                            {log.diffs?.map((diff, i) => (
                              <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                                <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
                                <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || (isFrench ? 'aucun' : 'none'))}</span>
                                <span className="text-emerald-400 font-bold">{String(diff.newValue || (isFrench ? 'aucun' : 'none'))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* CATEGORY 4: Payroll Operation Logs */}
                  {activeCategory === 'payroll' && (() => {
                    const log = filteredPayrollLogs[idx];
                    if (!log) return null;
                    const isExpanded = expandedLogIds.has(log.id);
                    const hasDiffs = log.diffs && log.diffs.length > 0;
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm">
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
                              <span>
                                {isExpanded
                                  ? (isFrench ? 'Masquer les écarts' : 'Hide Diffs')
                                  : (isFrench ? 'Voir les écarts' : 'View Diffs')}{' '}
                                ({log.diffs?.length})
                              </span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {hasDiffs && isExpanded && (
                          <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                            {log.diffs?.map((diff, i) => (
                              <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                                <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
                                <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || (isFrench ? 'aucun' : 'none'))}</span>
                                <span className="text-emerald-400 font-bold">{String(diff.newValue || (isFrench ? 'aucun' : 'none'))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* CATEGORY 5: Safety & Operational Logs */}
                  {activeCategory === 'safety' && (() => {
                    const log = filteredSafetyLogs[idx];
                    if (!log) return null;
                    const isExpanded = expandedLogIds.has(log.id);
                    const hasDiffs = log.diffs && log.diffs.length > 0;
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm">
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
                              <span>
                                {isExpanded
                                  ? (isFrench ? 'Masquer les écarts' : 'Hide Diffs')
                                  : (isFrench ? 'Voir les écarts' : 'View Diffs')}{' '}
                                ({log.diffs?.length})
                              </span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {hasDiffs && isExpanded && (
                          <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                            {log.diffs?.map((diff, i) => (
                              <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                                <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
                                <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || (isFrench ? 'aucun' : 'none'))}</span>
                                <span className="text-emerald-400 font-bold">{String(diff.newValue || (isFrench ? 'aucun' : 'none'))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
