import React, { useState, useRef, useMemo, useDeferredValue, useEffect, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BusRoute, BusRouteShift, RouteStats, formatOpDays, getShiftBadgeStyle, isAutoMarryupEnabled } from '../types/route';
import { Student } from '../types/student';
import { School } from '../types/school';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import { Yard } from '../types/yard';
import { RouteService } from '../services/routeService';
import { RouteInlineDetail } from '../components/routes/RouteInlineDetail';
import { RouteEditModal } from '../components/routes/RouteEditModal';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import { useRegisterPageAIContext } from '../contexts/AIContext';
import { useAuth } from '../contexts/AuthContext';
import { RouteAuditService } from '../services/routeAuditService';
import {
  RouteFixFilter,
  countRouteFixIssues,
  matchesRouteFixFilter,
} from '../utils/routeFixFilterUtils';
import {
  RouteAuditFilter,
  RouteAuditIssue,
  RouteAuditResult,
  buildFixedShiftStopsForMissingSchoolStudents,
  matchesRouteAuditFilter,
  runRouteAudit,
} from '../utils/routeAuditUtils';
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
  History,
  AlertTriangle,
  Wrench
} from 'lucide-react';

interface RouteListViewProps {
  routes: BusRoute[];
  stats: RouteStats;
  studentsMap: Record<number, Student>;
  schools: School[];
  yards: Yard[];
  employees: Employee[];
  vehicles?: Vehicle[];
  loading?: boolean;
  onRefresh?: () => void;
  onSelectRoute: (route: BusRoute) => void;
  onSelectStudent?: (student: Student) => void;
  onSelectStudentId?: (studentId: number, initialTab?: 'profile' | 'stops') => void;
  onEditStudentStops?: (studentId: number) => void;
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
  onSelectVehicle?: (vehicleId?: number, unitNumber?: string) => void;
  onAssignCrew?: (route: BusRoute) => void;
  onRouteUpdated?: (route: BusRoute) => void;
}

const AUDIT_FILTER_OPTIONS: Array<{
  key: RouteAuditFilter;
  label: string;
  countKey?: keyof import('../utils/routeAuditUtils').RouteAuditSummary['counts'];
  tone: 'neutral' | 'rose' | 'sky';
}> = [
  { key: 'ALL', label: 'All', tone: 'neutral' },
  { key: 'ANY_ISSUE', label: 'All Audit Issues', countKey: 'anyIssue', tone: 'rose' },
  { key: 'EMPTY_STOP', label: 'Empty Stops', countKey: 'EMPTY_STOP', tone: 'rose' },
  { key: 'SCHOOL_STOP_MISSING_STUDENT', label: 'School Stop Missing Student', countKey: 'SCHOOL_STOP_MISSING_STUDENT', tone: 'rose' },
  { key: 'SCHOOL_STOP_MISMATCH', label: 'Home Stop Missing Student', countKey: 'SCHOOL_STOP_MISMATCH', tone: 'rose' },
  { key: 'DUPLICATE_STUDENT_IN_ROUTE', label: 'Duplicate Student (Route)', countKey: 'DUPLICATE_STUDENT_IN_ROUTE', tone: 'rose' },
  { key: 'CROSS_SHIFT_DUPLICATE_STUDENT', label: 'Same-Day Multi-Shift', countKey: 'CROSS_SHIFT_DUPLICATE_STUDENT', tone: 'rose' },
  { key: 'MULTI_ROUTE_TIME_CONFLICT', label: 'Crew/Vehicle Time Conflict', countKey: 'MULTI_ROUTE_TIME_CONFLICT', tone: 'rose' },
  { key: 'INACTIVE_CREW_OR_VEHICLE', label: 'Inactive Crew/Vehicle', countKey: 'INACTIVE_CREW_OR_VEHICLE', tone: 'rose' },
  { key: 'MULTI_ROUTE_SHARED', label: 'Crew/Vehicle ≥2 Routes', countKey: 'MULTI_ROUTE_SHARED', tone: 'sky' },
];

function RouteAuditIssuesPanel({
  route,
  auditResult,
  ignoringKeys,
  fixingKeys,
  fixingAllRoute,
  onToggleIgnore,
  onFixMissingSchoolStudent,
  onFixAllMissingSchoolStudentsForRoute,
  onSelectStudentStops,
}: {
  route: BusRoute;
  auditResult?: RouteAuditResult;
  ignoringKeys: Record<string, boolean>;
  fixingKeys: Record<string, boolean>;
  fixingAllRoute: boolean;
  onToggleIgnore: (route: BusRoute, studentId: number, ignore: boolean) => void;
  onFixMissingSchoolStudent: (issue: RouteAuditIssue) => void;
  onFixAllMissingSchoolStudentsForRoute: (routeId: string) => void;
  onSelectStudentStops?: (studentId: number) => void;
}) {
  if (!auditResult) return null;
  const { issues, ignoredIssues, isMultiRouteShared, sharedReasons } = auditResult;
  if (issues.length === 0 && ignoredIssues.length === 0 && !isMultiRouteShared) {
    return null;
  }

  const missingSchoolCount = issues.filter((i) => i.type === 'SCHOOL_STOP_MISSING_STUDENT').length;

  const renderIssueMessage = (issue: RouteAuditIssue) => {
    if (issue.studentId && issue.studentName && onSelectStudentStops) {
      const quoted = `"${issue.studentName}"`;
      const idx = issue.message.indexOf(quoted);
      if (idx >= 0) {
        const before = issue.message.slice(0, idx);
        const after = issue.message.slice(idx + quoted.length);
        return (
          <span className="text-slate-200 break-words">
            {before}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectStudentStops(issue.studentId!);
              }}
              className="font-bold text-amber-300 underline decoration-dotted hover:text-amber-200 cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              title="Click to view student's Stops tab"
            >
              {quoted}
            </button>
            {after}
          </span>
        );
      }
    }
    return <span className="text-slate-200 break-words">{issue.message}</span>;
  };

  return (
    <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/90 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Route Audit Diagnostics</span>
          {issues.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
              {issues.length} active {issues.length === 1 ? 'issue' : 'issues'}
            </span>
          )}
          {ignoredIssues.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {ignoredIssues.length} ignored
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {missingSchoolCount > 0 && (
            <button
              type="button"
              disabled={fixingAllRoute}
              onClick={(e) => {
                e.stopPropagation();
                onFixAllMissingSchoolStudentsForRoute(route.id);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition disabled:opacity-50"
            >
              <Wrench className="w-3 h-3" />
              <span>{fixingAllRoute ? 'Fixing...' : `Fix School Stops (${missingSchoolCount})`}</span>
            </button>
          )}
          {isMultiRouteShared && (
            <div className="text-[11px] text-sky-300 bg-sky-500/10 border border-sky-500/25 px-2.5 py-0.5 rounded-lg">
              Shared Crew/Vehicle: {sharedReasons.join(' • ')}
            </div>
          )}
        </div>
      </div>

      {issues.length > 0 && (
        <div className="space-y-1.5">
          {issues.map((issue: RouteAuditIssue) => {
            const ignoreKey = issue.studentId !== undefined ? `${route.id}:${issue.studentId}` : '';
            const isIgnoreBusy = ignoreKey ? !!ignoringKeys[ignoreKey] : false;
            const isFixBusy = !!fixingKeys[issue.id];
            return (
              <div
                key={issue.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-950/30 border border-rose-500/25 text-xs"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                    {issue.type.replace(/_/g, ' ')}
                  </span>
                  {renderIssueMessage(issue)}
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                  {issue.type === 'SCHOOL_STOP_MISSING_STUDENT' && (
                    <button
                      type="button"
                      disabled={isFixBusy || fixingAllRoute}
                      onClick={(e) => {
                        e.stopPropagation();
                        onFixMissingSchoolStudent(issue);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition disabled:opacity-50"
                    >
                      <Wrench className="w-3 h-3" />
                      <span>{isFixBusy ? 'Fixing...' : 'Fix School Stop'}</span>
                    </button>
                  )}
                  {issue.canIgnore && issue.studentId !== undefined && (
                    <button
                      type="button"
                      disabled={isIgnoreBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleIgnore(route, issue.studentId!, true);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition disabled:opacity-50"
                    >
                      {isIgnoreBusy ? 'Saving...' : 'Ignore (Shared Custody)'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ignoredIssues.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {ignoredIssues.map((issue: RouteAuditIssue) => {
            const ignoreKey = issue.studentId !== undefined ? `${route.id}:${issue.studentId}` : '';
            const isBusy = ignoreKey ? !!ignoringKeys[ignoreKey] : false;
            return (
              <div
                key={issue.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                    IGNORED
                  </span>
                  <span className="break-words">{issue.message}</span>
                </div>
                {issue.studentId !== undefined && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleIgnore(route, issue.studentId!, false);
                    }}
                    className="self-start sm:self-center shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
                  >
                    {isBusy ? 'Saving...' : 'Restore Warning'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const RouteListView = memo(function RouteListView({
  routes,
  stats,
  studentsMap,
  schools,
  yards,
  employees,
  vehicles = [],
  onRefresh,
  onSelectRoute,
  onSelectStudent,
  onSelectStudentId,
  onEditStudentStops,
  onSelectEmployee,
  onSelectVehicle,
  onAssignCrew,
  onRouteUpdated
}: RouteListViewProps) {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [boardFilter, setBoardFilter] = useState('ALL');
  const [yardFilter, setYardFilter] = useState('ALL');
  useRegisterPageAIContext('routes', { yardFilter });
  const [opDaysFilter, setOpDaysFilter] = useState('ALL'); // ALL, MTWRF, ----F, MTWR-
  const [marryupFilter, setMarryupFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [fixFilter, setFixFilter] = useState<RouteFixFilter>('ALL');
  const [auditFilter, setAuditFilter] = useState<RouteAuditFilter>('ALL');
  const [allShifts, setAllShifts] = useState<BusRouteShift[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [ignoringKeys, setIgnoringKeys] = useState<Record<string, boolean>>({});
  const [fixingSchoolStopKeys, setFixingSchoolStopKeys] = useState<Record<string, boolean>>({});
  const [fixingAllSchoolStops, setFixingAllSchoolStops] = useState(false);
  const [fixingRouteSchoolStops, setFixingRouteSchoolStops] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRouteIds, setExpandedRouteIds] = useState<Record<string, boolean>>({});
  const [editingRoute, setEditingRoute] = useState<BusRoute | null>(null);
  const [togglingRouteIds, setTogglingRouteIds] = useState<Record<string, boolean>>({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const loadAuditShifts = useCallback(async () => {
    setAuditLoading(true);
    try {
      const list = await RouteService.getAllShifts();
      setAllShifts(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('[RouteListView] Failed to load shifts for audit:', err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAuditShifts();
  }, [loadAuditShifts]);

  const auditSummary = useMemo(
    () => runRouteAudit({ routes, shifts: allShifts, employees, vehicles, schools }),
    [routes, allShifts, employees, vehicles, schools]
  );

  const handleToggleIgnoreDuplicateStudent = useCallback(
    async (route: BusRoute, studentId: number, ignore: boolean) => {
      const key = `${route.id}:${studentId}`;
      if (ignoringKeys[key]) return;
      setIgnoringKeys((prev) => ({ ...prev, [key]: true }));
      try {
        const current = route.ignoredDuplicateStudentIds || [];
        const nextIds = ignore
          ? Array.from(new Set([...current, studentId]))
          : current.filter((id) => id !== studentId);
        const updated = await RouteService.updateRoute(route.id, {
          ignoredDuplicateStudentIds: nextIds,
        });
        onRouteUpdated?.({ ...route, ...updated, ignoredDuplicateStudentIds: nextIds });
      } catch (err: any) {
        alert(`Failed to update ignore flag: ${err?.message || 'Unknown error'}`);
      } finally {
        setIgnoringKeys((prev) => ({ ...prev, [key]: false }));
      }
    },
    [ignoringKeys, onRouteUpdated]
  );

  const handleFixMissingSchoolStudent = useCallback(
    async (issue: RouteAuditIssue) => {
      if (!issue.shiftId || issue.studentId === undefined || fixingSchoolStopKeys[issue.id]) return;
      const shift = allShifts.find((s) => s.id === issue.shiftId);
      if (!shift) return;

      const nextStops = buildFixedShiftStopsForMissingSchoolStudents(
        shift,
        [issue.studentId],
        studentsMap,
        undefined,
        schools
      );
      if (!nextStops) return;

      setFixingSchoolStopKeys((prev) => ({ ...prev, [issue.id]: true }));
      try {
        const updated = await RouteService.updateShift(shift.id, { stops: nextStops });
        setAllShifts((prev) =>
          prev.map((s) => (s.id === shift.id ? { ...s, ...updated, stops: nextStops } : s))
        );
      } catch (err: any) {
        alert(`Failed to fix school stop: ${err?.message || 'Unknown error'}`);
      } finally {
        setFixingSchoolStopKeys((prev) => ({ ...prev, [issue.id]: false }));
      }
    },
    [allShifts, fixingSchoolStopKeys, schools, studentsMap]
  );

  const handleFixAllMissingSchoolStudents = useCallback(
    async (targetRouteId?: string) => {
      const issuesToFix: RouteAuditIssue[] = [];
      for (const res of auditSummary.byRouteId.values()) {
        if (targetRouteId && res.routeId !== targetRouteId) continue;
        for (const issue of res.issues) {
          if (issue.type === 'SCHOOL_STOP_MISSING_STUDENT' && issue.shiftId && issue.studentId !== undefined) {
            issuesToFix.push(issue);
          }
        }
      }
      if (issuesToFix.length === 0) return;

      const byShiftId = new Map<string, number[]>();
      for (const issue of issuesToFix) {
        const list = byShiftId.get(issue.shiftId!) || [];
        list.push(issue.studentId!);
        byShiftId.set(issue.shiftId!, list);
      }

      if (targetRouteId) {
        setFixingRouteSchoolStops((prev) => ({ ...prev, [targetRouteId]: true }));
      } else {
        setFixingAllSchoolStops(true);
      }

      try {
        const updatedShiftsById = new Map<string, BusRouteShift>();
        for (const [shiftId, studentIds] of byShiftId.entries()) {
          const shift = allShifts.find((s) => s.id === shiftId);
          if (!shift) continue;
          const nextStops = buildFixedShiftStopsForMissingSchoolStudents(
            shift,
            studentIds,
            studentsMap,
            undefined,
            schools
          );
          if (!nextStops) continue;
          const updated = await RouteService.updateShift(shift.id, { stops: nextStops });
          updatedShiftsById.set(shift.id, { ...shift, ...updated, stops: nextStops });
        }
        if (updatedShiftsById.size > 0) {
          setAllShifts((prev) => prev.map((s) => updatedShiftsById.get(s.id) || s));
        }
      } catch (err: any) {
        alert(`Failed to fix school stops: ${err?.message || 'Unknown error'}`);
      } finally {
        if (targetRouteId) {
          setFixingRouteSchoolStops((prev) => ({ ...prev, [targetRouteId]: false }));
        } else {
          setFixingAllSchoolStops(false);
        }
      }
    },
    [allShifts, auditSummary.byRouteId, schools, studentsMap]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([onRefresh ? onRefresh() : Promise.resolve(), loadAuditShifts()]);
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
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

  const deferredSearch = useDeferredValue(searchTerm);

  const { uniqueBoards, uniqueYards } = useMemo(() => {
    const boards = new Set<string>();
    const yardNames = new Set<string>();
    for (const route of routes) {
      if (route.schoolBoardCode) boards.add(route.schoolBoardCode);
      if (route.yardName) yardNames.add(route.yardName);
    }
    return {
      uniqueBoards: Array.from(boards),
      uniqueYards: Array.from(yardNames),
    };
  }, [routes]);

  const fixCounts = useMemo(() => countRouteFixIssues(routes), [routes]);

  const filteredRoutes = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return routes.filter((r) => {
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
      if (!matchesRouteFixFilter(r, fixFilter)) {
        return false;
      }
      if (!matchesRouteAuditFilter(r.id, auditSummary, auditFilter)) {
        return false;
      }

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

      if (term) {
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
  }, [routes, boardFilter, yardFilter, marryupFilter, fixFilter, auditFilter, auditSummary, opDaysFilter, deferredSearch]);
  const totalExpanded = Object.values(expandedRouteIds).filter(Boolean).length;

  // Virtual scrolling containers for 1,000+ routes
  const routeTableContainerRef = useRef<HTMLDivElement>(null);
  const routeMobileContainerRef = useRef<HTMLDivElement>(null);

  const routeTableVirtualizer = useVirtualizer({
    count: filteredRoutes.length,
    getScrollElement: () => routeTableContainerRef.current,
    estimateSize: (index) => {
      const r = filteredRoutes[index];
      return expandedRouteIds[r?.id] ? 380 : 68;
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
    <PageShell>
      <PageHeader
        title="Routes"
        subtitle="Active school bus routes, shifts, marry-up assignments, and daily run schedules."
        actions={
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={totalExpanded > 0 ? collapseAll : expandAll}
              className="min-h-[28px] px-3 sm:px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <Layers aria-hidden="true" className="w-3.5 h-3.5 text-amber-400" />
              <span>{totalExpanded > 0 ? 'Collapse All' : 'Expand All'}</span>
            </button>

            {onRefresh && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh routes from cloud"
                title="Refresh routes from cloud"
                className="min-h-[28px] px-3 sm:px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <RefreshCw aria-hidden="true" className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>
        }
      >
        {/* Top Search & Filter Bar */}
        <search aria-label="Filter routes" className="block space-y-3">
          <div className="relative">
            <Search aria-hidden="true" className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search routes by route number, school, driver, or bus unit"
              placeholder="Search by route (e.g. OCDSB-001), school, assigned driver, bus unit #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-base sm:text-sm text-white focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 transition placeholder:text-slate-500"
            />
          </div>

        {/* Mobile Filter Toggle Button */}
        <div className="flex md:hidden items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            aria-expanded={showMobileFilters}
            aria-controls="route-filter-controls"
            className="min-h-[28px] px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold flex items-center gap-1.5 text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <SlidersHorizontal aria-hidden="true" className="w-3.5 h-3.5 text-amber-400" />
            <span>Search & Filters</span>
            {(boardFilter !== 'ALL' || yardFilter !== 'ALL' || marryupFilter !== 'ALL' || fixFilter !== 'ALL' || opDaysFilter !== 'ALL') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
            )}
            <ChevronDown aria-hidden="true" className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
          </button>

          {(boardFilter !== 'ALL' || yardFilter !== 'ALL' || marryupFilter !== 'ALL' || fixFilter !== 'ALL' || auditFilter !== 'ALL' || opDaysFilter !== 'ALL' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setBoardFilter('ALL');
                setYardFilter('ALL');
                setMarryupFilter('ALL');
                setFixFilter('ALL');
                setAuditFilter('ALL');
                setOpDaysFilter('ALL');
                setSearchTerm('');
              }}
              className="min-h-[28px] px-2 text-xs text-rose-400 hover:underline font-semibold rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div id="route-filter-controls" className={`pt-2 border-t border-slate-800/80 text-xs ${showMobileFilters ? 'flex flex-col space-y-2.5' : 'hidden md:flex'} md:flex-row md:flex-wrap md:items-center gap-2`}>
          <div className="flex items-center space-x-1.5 text-slate-400 mr-2 font-medium">
            <Filter aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Filter by:</span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full md:w-auto">
            {/* School Board Filter */}
            <select
              aria-label="Filter by school board"
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-slate-200 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 w-full sm:w-auto"
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
              aria-label="Filter by yard"
              value={yardFilter}
              onChange={(e) => setYardFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-slate-200 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 w-full sm:w-auto"
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
              aria-label="Filter by auto marryup"
              value={marryupFilter}
              onChange={(e) => setMarryupFilter(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-slate-200 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 w-full sm:w-auto"
            >
              <option value="ALL">All Marryup</option>
              <option value="ENABLED">Auto Marryup</option>
              <option value="DISABLED">No Auto Marryup</option>
            </select>

            {/* Needs Fix Filter */}
            <select
              aria-label="Filter by crew and vehicle status"
              value={fixFilter}
              onChange={(e) => setFixFilter(e.target.value as RouteFixFilter)}
              className={`border rounded-xl px-2.5 py-1.5 text-base sm:text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 w-full sm:w-auto ${
                fixFilter !== 'ALL' && fixFilter !== 'COMPLETE'
                  ? 'bg-rose-950/60 border-rose-500/60 text-rose-200 focus:border-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-200 focus:border-amber-500'
              }`}
            >
              <option value="ALL">All Crew & Vehicle</option>
              <option value="NEEDS_FIX">Needs Fix ({fixCounts.needsFix})</option>
              <option value="MISSING_DRIVER">Missing Driver ({fixCounts.missingDriver})</option>
              <option value="MISSING_VEHICLE">Missing Vehicle ({fixCounts.missingVehicle})</option>
              <option value="MISSING_BOTH">Missing Both ({fixCounts.missingBoth})</option>
              <option value="COMPLETE">Fully Assigned ({fixCounts.complete})</option>
            </select>
          </div>

          {/* Op Days Filter (Weekdays vs Friday Early Dismissal) */}
          <div role="group" aria-label="Filter by operating days" className="flex flex-wrap items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              aria-pressed={opDaysFilter === 'ALL'}
              onClick={() => setOpDaysFilter('ALL')}
              className={`min-h-[28px] px-2 py-1 rounded-lg text-[11px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                opDaysFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Op Days
            </button>
            <button
              type="button"
              aria-pressed={opDaysFilter === 'MTWRF'}
              onClick={() => setOpDaysFilter('MTWRF')}
              className={`min-h-[28px] px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                opDaysFilter === 'MTWRF'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              MTWRF
            </button>
            <button
              type="button"
              aria-pressed={opDaysFilter === '----F'}
              onClick={() => setOpDaysFilter('----F')}
              className={`min-h-[28px] px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition flex items-center space-x-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                opDaysFilter === '----F'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-purple-400 hover:bg-purple-500/10'
              }`}
            >
              <Calendar aria-hidden="true" className="w-3 h-3" />
              <span>----F (Fri Early)</span>
            </button>
            <button
              type="button"
              aria-pressed={opDaysFilter === 'MTWR-'}
              onClick={() => setOpDaysFilter('MTWR-')}
              className={`min-h-[28px] px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                opDaysFilter === 'MTWR-'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-sky-400 hover:bg-sky-500/10'
              }`}
            >
              MTWR-
            </button>
          </div>

          <button
            type="button"
            onClick={() => setFixFilter((prev) => (prev === 'NEEDS_FIX' ? 'ALL' : 'NEEDS_FIX'))}
            aria-pressed={fixFilter === 'NEEDS_FIX'}
            className={`min-h-[28px] px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center space-x-1 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
              fixFilter === 'NEEDS_FIX'
                ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                : fixCounts.needsFix > 0
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <AlertTriangle aria-hidden="true" className="w-3 h-3" />
            <span>Needs Fix ({fixCounts.needsFix})</span>
          </button>

          {(boardFilter !== 'ALL' || yardFilter !== 'ALL' || marryupFilter !== 'ALL' || fixFilter !== 'ALL' || auditFilter !== 'ALL' || opDaysFilter !== 'ALL' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setBoardFilter('ALL');
                setYardFilter('ALL');
                setMarryupFilter('ALL');
                setFixFilter('ALL');
                setAuditFilter('ALL');
                setOpDaysFilter('ALL');
                setSearchTerm('');
              }}
              className="hidden md:inline-flex items-center min-h-[28px] px-2 text-xs text-rose-400 hover:underline ml-auto font-medium rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Clear Filters
            </button>
          )}
        </div>
      </search>
      </PageHeader>

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

      {/* Route Audit & Multi-Route Quick Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Route Audit & Quick Filters</span>
            {auditLoading && (
              <span className="text-[11px] font-normal text-slate-400">Scanning shifts...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {auditSummary.counts.SCHOOL_STOP_MISSING_STUDENT > 0 && (
              <button
                type="button"
                onClick={() => void handleFixAllMissingSchoolStudents()}
                disabled={fixingAllSchoolStops || auditLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition disabled:opacity-50"
              >
                <Wrench className="w-3 h-3" />
                <span>
                  {fixingAllSchoolStops
                    ? 'Fixing School Stops...'
                    : `Fix All School Stops (${auditSummary.counts.SCHOOL_STOP_MISSING_STUDENT})`}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadAuditShifts()}
              disabled={auditLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${auditLoading ? 'animate-spin' : ''}`} />
              <span>Re-run Audit</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {AUDIT_FILTER_OPTIONS.map((opt) => {
            const count = opt.countKey ? auditSummary.counts[opt.countKey] : undefined;
            const isActive = auditFilter === opt.key;
            const activeStyle =
              opt.tone === 'sky'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : opt.tone === 'rose'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            const countBadgeStyle =
              opt.tone === 'sky'
                ? 'bg-sky-500/25 text-sky-200'
                : count && count > 0
                ? 'bg-rose-500/25 text-rose-200'
                : 'bg-slate-700/80 text-slate-400';

            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setAuditFilter(isActive && opt.key !== 'ALL' ? 'ALL' : opt.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                  isActive
                    ? activeStyle
                    : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                {count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${countBadgeStyle}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
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
            <div ref={routeTableContainerRef} tabIndex={0} role="region" aria-label="Route network table" className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
              <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1100px]">
                <caption className="sr-only">Route network directory</caption>
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[11px] shadow-xs">
                  <tr>
                    <th scope="col" className="py-3 px-3 w-12 text-center"><span className="sr-only">Expand</span><span aria-hidden="true">#</span></th>
                    <th scope="col" className="py-3 px-4">Route Info</th>
                    <th scope="col" className="py-3 px-4">Board & Yard</th>
                    <th scope="col" className="py-3 px-4">Assigned Crew</th>
                    <th scope="col" className="py-3 px-4">Operational Shifts (Op Days)</th>
                    <th scope="col" className="py-3 px-4 text-center">Stops / Riders</th>
                    <th scope="col" className="py-3 px-4 text-right">Actions</th>
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
                    const auditResult = auditSummary.byRouteId.get(r.id);

                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onClick={() => toggleRouteExpand(r.id)}
                          className={`hover:bg-slate-800/40 transition cursor-pointer group ${
                            isExpanded ? 'bg-slate-850/50' : ''
                          }`}
                        >
                          {/* Expand / Collapse Toggle */}
                          <td className="py-2 px-3 text-center align-middle h-[68px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRouteExpand(r.id);
                              }}
                              className={`min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1 rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                                isExpanded
                                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                              }`}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? `Collapse stops for route ${r.routeNo}` : `Expand stops for route ${r.routeNo}`}
                              title={isExpanded ? 'Collapse stops' : 'Expand stops table'}
                            >
                              {isExpanded ? (
                                <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 font-black" />
                              ) : (
                                <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>

                          {/* Route No & Name */}
                          <td className="py-2.5 px-4 align-middle h-[68px]">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xs flex-shrink-0">
                                <Bus className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-bold text-white group-hover:text-amber-400 transition flex flex-wrap items-center gap-1.5">
                                  <span>{r.routeNo}</span>
                                  {!isAutoMarryupEnabled(r) && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      No Auto Marryup
                                    </span>
                                  )}
                                  {auditResult && auditResult.issues.length > 0 && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                      {auditResult.issues.length} {auditResult.issues.length === 1 ? 'Issue' : 'Issues'}
                                    </span>
                                  )}
                                  {auditResult && auditResult.isMultiRouteShared && (
                                    <span
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                      title={auditResult.sharedReasons.join('; ')}
                                    >
                                      2+ Routes
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate" title={r.routeName}>
                                  {r.routeName}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Board & Yard */}
                          <td className="py-2.5 px-4 align-middle h-[68px]">
                            <div className="font-medium text-slate-200">
                              {r.schoolBoardCode || 'OCDSB'}
                            </div>
                            <div className="flex items-center space-x-1 text-[11px] text-slate-400 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span>{r.yardName}</span>
                            </div>
                          </td>

                          {/* Assigned Crew (Driver & Bus) */}
                          <td className="py-2.5 px-4 align-middle h-[68px]">
                            <div className="space-y-0.5">
                              <button
                                type="button"
                                disabled={!r.driverName}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (r.driverName) onSelectEmployee?.(r.driverId, r.driverName);
                                }}
                                className="font-bold text-slate-200 flex items-center space-x-1 disabled:cursor-default enabled:hover:text-amber-300 enabled:cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                title={r.driverName ? 'View driver details' : undefined}
                              >
                                <User aria-hidden="true" className="w-3.5 h-3.5 text-amber-400" />
                                <span>{r.driverName || 'Unassigned'}</span>
                              </button>
                              {r.attendantName && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectEmployee?.(r.attendantId, r.attendantName);
                                  }}
                                  className="text-[10px] text-indigo-300 flex items-center space-x-1 hover:text-indigo-200 cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                  title="View attendant details"
                                >
                                  <Shield aria-hidden="true" className="w-3 h-3 text-indigo-400" />
                                  <span>Monitor: {r.attendantName}</span>
                                </button>
                              )}
                              {r.unitNumber ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectVehicle?.(r.vehicleId, r.unitNumber);
                                  }}
                                  className="text-[10px] text-slate-300 font-mono flex items-center space-x-1 hover:text-amber-300 cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                  title={`View vehicle details: ${r.unitNumber}`}
                                >
                                  <Bus aria-hidden="true" className="w-3 h-3 text-slate-400" />
                                  <span>Unit {r.unitNumber}</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-rose-400 font-semibold flex items-center space-x-1">
                                  <AlertTriangle aria-hidden="true" className="w-3 h-3" />
                                  <span>Missing Vehicle</span>
                                </span>
                              )}
                              {r.driverPhone && (
                                <a
                                  href={`tel:${r.driverPhone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-amber-400 hover:underline font-mono text-[11px] flex items-center space-x-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                >
                                  <Phone aria-hidden="true" className="w-3 h-3" />
                                  <span>{r.driverPhone}</span>
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Operational Shifts (Dynamic Shift Badges Flow) */}
                          <td className="py-2.5 px-4 align-middle h-[68px]">
                            <div className="flex flex-wrap items-center gap-1.5">
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
                          <td className="py-2.5 px-4 text-center align-middle h-[68px]">
                            <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200">
                              <span>{r.totalStops} stops</span>
                              <span>•</span>
                              <span className="text-indigo-400">{r.totalStudents} riders</span>
                            </div>
                          </td>

                          {/* Actions (Drawer & Expand) */}
                          <td className="py-2.5 px-4 text-right align-middle h-[68px] whitespace-nowrap overflow-hidden">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Edit Route Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRoute(r);
                                }}
                                className="min-h-[28px] text-amber-400 hover:text-amber-300 font-medium text-xs px-2 py-1 rounded hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                aria-label={`Edit route ${r.routeNo}`}
                                title="Edit Route Details"
                              >
                                Edit
                              </button>

                              {/* Auto Marryup Toggle Button */}
                              <button
                                type="button"
                                onClick={(e) => handleToggleAutoMarryup(e, r)}
                                disabled={togglingRouteIds[r.id]}
                                className="min-h-[28px] text-amber-400 hover:text-amber-300 font-medium text-xs px-2 py-1 rounded hover:bg-slate-800 transition flex items-center space-x-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                aria-pressed={isAutoMarryupEnabled(r)}
                                aria-label={isAutoMarryupEnabled(r) ? `Disable Auto Marryup for route ${r.routeNo}` : `Enable Auto Marryup for route ${r.routeNo}`}
                                title={isAutoMarryupEnabled(r) ? 'Disable Auto Marryup for this route' : 'Enable Auto Marryup for this route'}
                              >
                                {togglingRouteIds[r.id] && (
                                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mr-1" />
                                )}
                                <span>{isAutoMarryupEnabled(r) ? 'Marryup ON' : 'Marryup OFF'}</span>
                              </button>

                              {onAssignCrew && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAssignCrew(r);
                                  }}
                                  className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                  aria-label={`Assign crew for route ${r.routeNo}`}
                                  title="Assign Driver, Vehicle & Attendant"
                                >
                                  <UserCheck aria-hidden="true" className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectRoute(r);
                                }}
                                className="min-h-[28px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition flex items-center space-x-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                aria-label={`Open drawer for route ${r.routeNo}`}
                                title="Open slide drawer"
                              >
                                <FileText aria-hidden="true" className="w-3.5 h-3.5 text-amber-400" />
                                <span className="hidden sm:inline">Drawer</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectRoute(r);
                                }}
                                className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                aria-label={`View audit history for route ${r.routeNo}`}
                                title="View Route Audit History"
                              >
                                <History aria-hidden="true" className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRouteExpand(r.id);
                                }}
                                className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? `Collapse stops for route ${r.routeNo}` : `Expand stops for route ${r.routeNo}`}
                              >
                                {isExpanded ? (
                                  <ChevronDown aria-hidden="true" className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <ChevronRight aria-hidden="true" className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* INLINE MASTER-DETAIL STOPS TABLE */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 border-b border-slate-800 bg-slate-950">
                              <RouteAuditIssuesPanel
                                route={r}
                                auditResult={auditResult}
                                ignoringKeys={ignoringKeys}
                                fixingKeys={fixingSchoolStopKeys}
                                fixingAllRoute={!!fixingRouteSchoolStops[r.id] || fixingAllSchoolStops}
                                onToggleIgnore={handleToggleIgnoreDuplicateStudent}
                                onFixMissingSchoolStudent={handleFixMissingSchoolStudent}
                                onFixAllMissingSchoolStudentsForRoute={(routeId) =>
                                  void handleFixAllMissingSchoolStudents(routeId)
                                }
                                onSelectStudentStops={(studentId) =>
                                  onEditStudentStops
                                    ? onEditStudentStops(studentId)
                                    : onSelectStudentId?.(studentId, 'stops')
                                }
                              />
                              <RouteInlineDetail
                                route={r}
                                studentsMap={studentsMap}
                                schools={schools}
                                employees={employees}
                                onSelectStudent={onSelectStudent}
                                onSelectStudentId={onSelectStudentId}
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
                const auditResult = auditSummary.byRouteId.get(r.id);

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
                            {auditResult && auditResult.issues.length > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                {auditResult.issues.length} {auditResult.issues.length === 1 ? 'Issue' : 'Issues'}
                              </span>
                            )}
                            {auditResult && auditResult.isMultiRouteShared && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                title={auditResult.sharedReasons.join('; ')}
                              >
                                2+ Routes
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
                          className="min-h-[28px] px-2 py-1 rounded-lg text-amber-400 hover:bg-slate-800 transition text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                          aria-label={`Edit route ${r.routeNo}`}
                          title="Edit Route"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleRouteExpand(r.id)}
                          className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? `Collapse stops for route ${r.routeNo}` : `Expand stops for route ${r.routeNo}`}
                        >
                          {isExpanded ? (
                            <ChevronDown aria-hidden="true" className="w-4 h-4 text-amber-400" />
                          ) : (
                            <ChevronRight aria-hidden="true" className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Crew row */}
                    <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <button
                          type="button"
                          disabled={!r.driverName}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (r.driverName) onSelectEmployee?.(r.driverId, r.driverName);
                          }}
                          className="font-bold text-slate-200 flex items-center space-x-1.5 disabled:cursor-default enabled:hover:text-amber-300 enabled:cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                          title={r.driverName ? 'View driver details' : undefined}
                        >
                          <User aria-hidden="true" className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{r.driverName || 'No Driver Assigned'}</span>
                        </button>
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                          {r.attendantName && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEmployee?.(r.attendantId, r.attendantName);
                              }}
                              className="hover:text-indigo-200 cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title="View attendant details"
                            >
                              Monitor: {r.attendantName}
                            </button>
                          )}
                          {r.unitNumber && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectVehicle?.(r.vehicleId, r.unitNumber);
                              }}
                              className="font-mono hover:text-amber-300 cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title={`View vehicle details: ${r.unitNumber}`}
                            >
                              Unit {r.unitNumber}
                            </button>
                          )}
                          {r.driverPhone && (
                            <a
                              href={`tel:${r.driverPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-amber-400 hover:underline font-mono rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
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
                            className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                            aria-label={`Assign crew for route ${r.routeNo}`}
                            title="Assign Driver & Vehicle"
                          >
                            <UserCheck aria-hidden="true" className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRoute(r);
                          }}
                          className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                          aria-label={`Open drawer for route ${r.routeNo}`}
                          title="Open Drawer"
                        >
                          <FileText aria-hidden="true" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRoute(r);
                          }}
                          className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                          aria-label={`View audit history for route ${r.routeNo}`}
                          title="View Route Audit History"
                        >
                          <History aria-hidden="true" className="w-4 h-4" />
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
                        className="min-h-[28px] text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 rounded px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Hide stops for route ${r.routeNo}` : `View stops for route ${r.routeNo}`}
                      >
                        <span>{isExpanded ? 'Hide Stops' : 'View Stops'}</span>
                        {isExpanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Inline Stops Detail on Mobile */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-800/80 -mx-3.5 px-1 bg-slate-950">
                        <RouteAuditIssuesPanel
                          route={r}
                          auditResult={auditResult}
                          ignoringKeys={ignoringKeys}
                          fixingKeys={fixingSchoolStopKeys}
                          fixingAllRoute={!!fixingRouteSchoolStops[r.id] || fixingAllSchoolStops}
                          onToggleIgnore={handleToggleIgnoreDuplicateStudent}
                          onFixMissingSchoolStudent={handleFixMissingSchoolStudent}
                          onFixAllMissingSchoolStudentsForRoute={(routeId) =>
                            void handleFixAllMissingSchoolStudents(routeId)
                          }
                          onSelectStudentStops={(studentId) =>
                            onEditStudentStops
                              ? onEditStudentStops(studentId)
                              : onSelectStudentId?.(studentId, 'stops')
                          }
                        />
                        <RouteInlineDetail
                          route={r}
                          studentsMap={studentsMap}
                          schools={schools}
                          employees={employees}
                          onSelectStudent={onSelectStudent}
                          onSelectStudentId={onSelectStudentId}
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
    </PageShell>
  );
});
