import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
  | 'dispatch'
  | 'routes'
  | 'master'
  | 'payroll'
  | 'safety';

const AUDIT_LOG_LIMIT = 2000;

type LoadedRanges = Partial<Record<AuditLogCategory, string>>;

type AuditFeed =
  | { category: 'dispatch'; logs: DispatchChangeLog[] }
  | { category: 'routes'; logs: RouteChangeLog[] }
  | { category: 'master'; logs: EntityOperationLog[] }
  | { category: 'payroll'; logs: PayrollOperationLog[] }
  | { category: 'safety'; logs: OperationalSafetyLog[] };

interface FieldDiff {
  fieldLabel?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

const localDay = (iso?: string): string => {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
};

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

const csvCell = (value: string) => {
  const raw = value || '';
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

const diffMatches = (diffs: FieldDiff[] | undefined, keyword: string): boolean => {
  if (!diffs || diffs.length === 0) return false;
  return diffs.some((diff) =>
    (diff.fieldLabel || '').toLowerCase().includes(keyword) ||
    String(diff.oldValue).toLowerCase().includes(keyword) ||
    String(diff.newValue).toLowerCase().includes(keyword)
  );
};

const AuditDiffList = memo(function AuditDiffList({
  diffs,
  isFrench,
}: {
  diffs: FieldDiff[];
  isFrench: boolean;
}) {
  const emptyLabel = isFrench ? 'aucun' : 'none';
  return (
    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
      {diffs.map((diff, index) => (
        <div key={`${diff.fieldLabel || 'field'}-${index}`} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
          <span className="font-semibold text-amber-300">{diff.fieldLabel}: </span>
          <span className="text-rose-400 line-through mr-2">{String(diff.oldValue || emptyLabel)}</span>
          <span className="text-emerald-400 font-bold">{String(diff.newValue || emptyLabel)}</span>
        </div>
      ))}
    </div>
  );
});

const DiffToggle = memo(function DiffToggle({
  expanded,
  count,
  isFrench,
  onToggle,
}: {
  expanded: boolean;
  count: number;
  isFrench: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300"
    >
      <span>
        {expanded
          ? (isFrench ? 'Masquer les écarts' : 'Hide Diffs')
          : (isFrench ? 'Voir les écarts' : 'View Diffs')}{' '}
        ({count})
      </span>
      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
    </button>
  );
});

const DispatchAuditCard = memo(function DispatchAuditCard({
  log,
  isFrench,
}: {
  log: DispatchChangeLog;
  isFrench: boolean;
}) {
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
});

const RouteAuditCard = memo(function RouteAuditCard({
  log,
  expanded,
  isFrench,
  onToggle,
}: {
  log: RouteChangeLog;
  expanded: boolean;
  isFrench: boolean;
  onToggle: (id: string) => void;
}) {
  const diffs = log.diffs || [];
  const hasDiffs = diffs.length > 0;
  const toggle = useCallback(() => onToggle(log.id), [onToggle, log.id]);
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
          <DiffToggle expanded={expanded} count={diffs.length} isFrench={isFrench} onToggle={toggle} />
        )}
      </div>
      {hasDiffs && expanded && <AuditDiffList diffs={diffs} isFrench={isFrench} />}
    </div>
  );
});

const MasterAuditCard = memo(function MasterAuditCard({
  log,
  expanded,
  isFrench,
  onToggle,
}: {
  log: EntityOperationLog;
  expanded: boolean;
  isFrench: boolean;
  onToggle: (id: string) => void;
}) {
  const diffs = log.diffs || [];
  const hasDiffs = diffs.length > 0;
  const isStudent = log.targetType === 'student';
  const toggle = useCallback(() => onToggle(log.id), [onToggle, log.id]);
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
          <span className="font-semibold text-slate-300">{log.actor?.userName || '—'}</span>
          {log.actor?.userRole && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {log.actor.userRole}
            </span>
          )}
        </div>
        {hasDiffs && (
          <DiffToggle expanded={expanded} count={diffs.length} isFrench={isFrench} onToggle={toggle} />
        )}
      </div>
      {hasDiffs && expanded && <AuditDiffList diffs={diffs} isFrench={isFrench} />}
    </div>
  );
});

const PayrollAuditCard = memo(function PayrollAuditCard({
  log,
  expanded,
  isFrench,
  onToggle,
}: {
  log: PayrollOperationLog;
  expanded: boolean;
  isFrench: boolean;
  onToggle: (id: string) => void;
}) {
  const diffs = log.diffs || [];
  const hasDiffs = diffs.length > 0;
  const toggle = useCallback(() => onToggle(log.id), [onToggle, log.id]);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {(log.category || 'payroll').split('_').join(' ')} • {log.action}
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
          <span className="font-semibold text-slate-300">{log.actor?.userName || '—'}</span>
          {log.actor?.userRole && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {log.actor.userRole}
            </span>
          )}
        </div>
        {hasDiffs && (
          <DiffToggle expanded={expanded} count={diffs.length} isFrench={isFrench} onToggle={toggle} />
        )}
      </div>
      {hasDiffs && expanded && <AuditDiffList diffs={diffs} isFrench={isFrench} />}
    </div>
  );
});

const SafetyAuditCard = memo(function SafetyAuditCard({
  log,
  expanded,
  isFrench,
  onToggle,
}: {
  log: OperationalSafetyLog;
  expanded: boolean;
  isFrench: boolean;
  onToggle: (id: string) => void;
}) {
  const diffs = log.diffs || [];
  const hasDiffs = diffs.length > 0;
  const toggle = useCallback(() => onToggle(log.id), [onToggle, log.id]);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
            {(log.module || 'safety').split('_').join(' ')} • {log.action}
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
          <span className="font-semibold text-slate-300">{log.actor?.userName || '—'}</span>
          {log.actor?.userRole && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {log.actor.userRole}
            </span>
          )}
        </div>
        {hasDiffs && (
          <DiffToggle expanded={expanded} count={diffs.length} isFrench={isFrench} onToggle={toggle} />
        )}
      </div>
      {hasDiffs && expanded && <AuditDiffList diffs={diffs} isFrench={isFrench} />}
    </div>
  );
});

const AuditLogScroller = memo(function AuditLogScroller({
  feed,
  expandedIds,
  isFrench,
  onToggle,
}: {
  feed: AuditFeed;
  expandedIds: Set<string>;
  isFrench: boolean;
  onToggle: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logs = feed.logs;
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 140,
    overscan: 6,
    getItemKey: (index) => logs[index]?.id ?? index,
  });

  return (
    <div ref={containerRef} className="overflow-y-auto max-h-[calc(100vh-270px)] pr-1">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const index = virtualRow.index;
          let card: React.ReactNode = null;
          if (feed.category === 'dispatch') {
            const log = feed.logs[index];
            if (log) card = <DispatchAuditCard log={log} isFrench={isFrench} />;
          } else if (feed.category === 'routes') {
            const log = feed.logs[index];
            if (log) {
              card = (
                <RouteAuditCard
                  log={log}
                  expanded={expandedIds.has(log.id)}
                  isFrench={isFrench}
                  onToggle={onToggle}
                />
              );
            }
          } else if (feed.category === 'master') {
            const log = feed.logs[index];
            if (log) {
              card = (
                <MasterAuditCard
                  log={log}
                  expanded={expandedIds.has(log.id)}
                  isFrench={isFrench}
                  onToggle={onToggle}
                />
              );
            }
          } else if (feed.category === 'payroll') {
            const log = feed.logs[index];
            if (log) {
              card = (
                <PayrollAuditCard
                  log={log}
                  expanded={expandedIds.has(log.id)}
                  isFrench={isFrench}
                  onToggle={onToggle}
                />
              );
            }
          } else {
            const log = feed.logs[index];
            if (log) {
              card = (
                <SafetyAuditCard
                  log={log}
                  expanded={expandedIds.has(log.id)}
                  isFrench={isFrench}
                  onToggle={onToggle}
                />
              );
            }
          }

          return (
            <div
              key={logs[index]?.id ?? index}
              data-index={index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '12px',
              }}
            >
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const collectDates = (dateFrom: string, dateTo: string): string[] => {
  const dates: string[] = [];
  let cursor = dateFrom;
  while (cursor <= dateTo && dates.length < 8) {
    dates.push(cursor);
    cursor = addDaysToDateString(cursor, 1);
  }
  return dates;
};

export const AuditLogsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  const [activeCategory, setActiveCategory] = useState<AuditLogCategory>('dispatch');
  const [today, setToday] = useState(getLocalTodayString);
  const [dateFrom, setDateFrom] = useState(getLocalTodayString);
  const [dateTo, setDateTo] = useState(getLocalTodayString);
  const [rangeWarning, setRangeWarning] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActor, setSelectedActor] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(() => new Set());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedRange, setLoadedRange] = useState<LoadedRanges>({});

  const [dispatchLogs, setDispatchLogs] = useState<DispatchChangeLog[]>([]);
  const [routeLogs, setRouteLogs] = useState<RouteChangeLog[]>([]);
  const [masterLogs, setMasterLogs] = useState<EntityOperationLog[]>([]);
  const [payrollLogs, setPayrollLogs] = useState<PayrollOperationLog[]>([]);
  const [safetyLogs, setSafetyLogs] = useState<OperationalSafetyLog[]>([]);

  const requestSeqRef = useRef(0);
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      const next = getLocalTodayString();
      setToday((current) => (current === next ? current : next));
    }, 60000);
    return () => window.clearInterval(timerId);
  }, []);

  const handleDateFromChange = (newFrom: string) => {
    if (!newFrom) return;
    setDateFrom(newFrom);

    if (dateTo < newFrom) {
      setDateTo(newFrom);
      setRangeWarning(null);
      return;
    }

    const diffDays = calculateDaysDiff(newFrom, dateTo);
    if (diffDays > 7) {
      setDateTo(addDaysToDateString(newFrom, 6));
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
      setDateFrom(addDaysToDateString(newTo, -6));
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
      setDateFrom(addDaysToDateString(currentToday, -(days - 1)));
      setDateTo(currentToday);
    }
    setRangeWarning(null);
  };

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    const category = activeCategory;
    const rangeKey = `${dateFrom}|${dateTo}`;
    const bounds = { dateFrom, dateTo, limitCount: AUDIT_LOG_LIMIT };
    const todayInRange = today >= dateFrom && today <= dateTo;
    setLoading(true);

    let unsubscribe = () => {};
    const isCurrent = () => seq === requestSeqRef.current;
    const finish = () => {
      if (!isCurrent()) return;
      setLoadedRange((prev) => (prev[category] === rangeKey ? prev : { ...prev, [category]: rangeKey }));
      setLoading(false);
      setRefreshing(false);
    };
    const logIdentity = (entry: DispatchChangeLog) => entry.id || `${entry.dispatchDate}-${entry.timestamp}-${entry.detail}`;

    if (category === 'dispatch') {
      let detailReady = false;
      if (todayInRange) {
        unsubscribe = DispatchService.subscribeToChangeLogs(
          today,
          (todayLogs) => {
            if (!isCurrent() || todayLogs.length === 0) return;
            detailReady = true;
            setDispatchLogs((prev) => {
              const others = prev.filter((entry) => entry.dispatchDate !== today);
              const seen = new Set(others.map(logIdentity));
              const merged = [...others];
              todayLogs.forEach((entry) => {
                const uid = logIdentity(entry);
                if (seen.has(uid)) return;
                seen.add(uid);
                merged.push(entry);
              });
              merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              return merged;
            });
            finish();
          },
          (err) => {
            console.error('Failed to subscribe to dispatch audit logs:', err);
          },
          { scope: 'detail' }
        );
      }

      Promise.all(collectDates(dateFrom, dateTo).map((day) => DispatchService.listChangeLogs(day, { scope: 'all' })))
        .then((results) => {
          if (!isCurrent()) return;
          const allLogs: DispatchChangeLog[] = [];
          const seen = new Set<string>();
          results.forEach((dayLogs) => {
            if (!Array.isArray(dayLogs)) return;
            dayLogs.forEach((entry) => {
              const uid = logIdentity(entry);
              if (seen.has(uid)) return;
              seen.add(uid);
              allLogs.push(entry);
            });
          });
          allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          if (detailReady) {
            setDispatchLogs((prev) => {
              const liveToday = prev.filter((entry) => entry.dispatchDate === today);
              const rest = allLogs.filter((entry) => entry.dispatchDate !== today);
              const merged = [...liveToday, ...rest];
              merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              return merged;
            });
          } else {
            setDispatchLogs(allLogs);
          }
          finish();
        })
        .catch((err) => {
          console.error('Failed to load dispatch logs for range:', err);
          if (!isCurrent()) return;
          if (detailReady) {
            finish();
            return;
          }
          setLoading(false);
          setRefreshing(false);
        });
    } else if (category === 'routes') {
      unsubscribe = RouteAuditService.subscribeToAllLogs(
        (logs) => {
          if (!isCurrent()) return;
          setRouteLogs(logs);
          finish();
        },
        (err) => {
          console.error('Failed to subscribe to route audit logs:', err);
          if (!isCurrent()) return;
          setLoading(false);
          setRefreshing(false);
        },
        bounds
      );
    } else if (category === 'master') {
      unsubscribe = EntityOperationLogService.subscribeToLogs(
        {},
        (logs) => {
          if (!isCurrent()) return;
          setMasterLogs(logs);
          finish();
        },
        (err) => {
          console.error('Failed to subscribe to master audit logs:', err);
          if (!isCurrent()) return;
          setLoading(false);
          setRefreshing(false);
        },
        bounds
      );
    } else if (category === 'payroll') {
      unsubscribe = PayrollOperationLogService.subscribeToLogs(
        {},
        (logs) => {
          if (!isCurrent()) return;
          setPayrollLogs(logs);
          finish();
        },
        (err) => {
          console.error('Failed to subscribe to payroll audit logs:', err);
          if (!isCurrent()) return;
          setLoading(false);
          setRefreshing(false);
        },
        bounds
      );
    } else {
      unsubscribe = OperationalSafetyLogService.subscribeToLogs(
        {},
        (logs) => {
          if (!isCurrent()) return;
          setSafetyLogs(logs);
          finish();
        },
        (err) => {
          console.error('Failed to subscribe to safety audit logs:', err);
          if (!isCurrent()) return;
          setLoading(false);
          setRefreshing(false);
        },
        bounds
      );
    }

    return () => {
      requestSeqRef.current += 1;
      unsubscribe();
    };
  }, [isAdmin, activeCategory, dateFrom, dateTo, today, reloadKey]);

  const handleRefresh = () => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedActor('');
    setSelectedAction('all');
  };

  const rangeKey = `${dateFrom}|${dateTo}`;
  const dispatchReady = loadedRange.dispatch === rangeKey;
  const routesReady = loadedRange.routes === rangeKey;
  const masterReady = loadedRange.master === rangeKey;
  const payrollReady = loadedRange.payroll === rangeKey;
  const safetyReady = loadedRange.safety === rangeKey;
  const keyword = deferredSearch.trim().toLowerCase();
  const actorQuery = selectedActor.trim().toLowerCase();

  const filteredDispatchLogs = useMemo(() => {
    if (!dispatchReady) return [];
    return dispatchLogs.filter((log) => {
      const day = log.dispatchDate || '';
      if (day && (day < dateFrom || day > dateTo)) return false;
      if (actorQuery && log.user && !log.user.toLowerCase().includes(actorQuery)) return false;
      if (selectedAction !== 'all' && log.type !== selectedAction) return false;
      if (keyword) {
        const matched = [log.routeNo, log.shiftType, log.type, log.detail, log.user].some((value) =>
          (value || '').toLowerCase().includes(keyword)
        );
        if (!matched) return false;
      }
      return true;
    });
  }, [dispatchReady, dispatchLogs, dateFrom, dateTo, actorQuery, selectedAction, keyword]);

  const filteredRouteLogs = useMemo(() => {
    if (!routesReady) return [];
    return routeLogs.filter((log) => {
      const day = localDay(log.timestamp);
      if (day && (day < dateFrom || day > dateTo)) return false;
      if (selectedActor && log.userId !== selectedActor && log.userName !== selectedActor) return false;
      if (selectedAction !== 'all' && log.action !== selectedAction && log.category !== selectedAction) return false;
      if (keyword) {
        const matched =
          (log.routeNo || '').toLowerCase().includes(keyword) ||
          (log.routeName || '').toLowerCase().includes(keyword) ||
          (log.summary || '').toLowerCase().includes(keyword) ||
          (log.userName || '').toLowerCase().includes(keyword) ||
          diffMatches(log.diffs, keyword);
        if (!matched) return false;
      }
      return true;
    });
  }, [routesReady, routeLogs, dateFrom, dateTo, selectedActor, selectedAction, keyword]);

  const filteredMasterLogs = useMemo(() => {
    if (!masterReady) return [];
    return masterLogs.filter((log) => {
      const day = localDay(log.timestamp);
      if (day && (day < dateFrom || day > dateTo)) return false;
      if (selectedActor && log.actor?.userId !== selectedActor && log.actor?.userName !== selectedActor) return false;
      if (selectedAction !== 'all' && log.action !== selectedAction && log.targetType !== selectedAction) return false;
      if (keyword) {
        const matched =
          (log.targetName || '').toLowerCase().includes(keyword) ||
          (log.targetIdentifier || '').toLowerCase().includes(keyword) ||
          (log.targetId || '').toLowerCase().includes(keyword) ||
          (log.summary || '').toLowerCase().includes(keyword) ||
          (log.actor?.userName || '').toLowerCase().includes(keyword) ||
          diffMatches(log.diffs, keyword);
        if (!matched) return false;
      }
      return true;
    });
  }, [masterReady, masterLogs, dateFrom, dateTo, selectedActor, selectedAction, keyword]);

  const filteredPayrollLogs = useMemo(() => {
    if (!payrollReady) return [];
    return payrollLogs.filter((log) => {
      const day = localDay(log.timestamp);
      if (day && (day < dateFrom || day > dateTo)) return false;
      if (selectedActor && log.actor?.userId !== selectedActor && log.actor?.userName !== selectedActor) return false;
      if (selectedAction !== 'all' && log.action !== selectedAction && log.category !== selectedAction) return false;
      if (keyword) {
        const matched =
          (log.targetName || '').toLowerCase().includes(keyword) ||
          (log.targetIdentifier || '').toLowerCase().includes(keyword) ||
          (log.targetId || '').toLowerCase().includes(keyword) ||
          (log.summary || '').toLowerCase().includes(keyword) ||
          (log.actor?.userName || '').toLowerCase().includes(keyword) ||
          diffMatches(log.diffs, keyword);
        if (!matched) return false;
      }
      return true;
    });
  }, [payrollReady, payrollLogs, dateFrom, dateTo, selectedActor, selectedAction, keyword]);

  const filteredSafetyLogs = useMemo(() => {
    if (!safetyReady) return [];
    return safetyLogs.filter((log) => {
      const day = localDay(log.timestamp);
      if (day && (day < dateFrom || day > dateTo)) return false;
      if (selectedActor && log.actor?.userId !== selectedActor && log.actor?.userName !== selectedActor) return false;
      if (selectedAction !== 'all' && log.action !== selectedAction && log.module !== selectedAction) return false;
      if (keyword) {
        const matched =
          (log.targetIdentifier || '').toLowerCase().includes(keyword) ||
          (log.targetId || '').toLowerCase().includes(keyword) ||
          (log.summary || '').toLowerCase().includes(keyword) ||
          (log.actor?.userName || '').toLowerCase().includes(keyword) ||
          (log.module || '').toLowerCase().includes(keyword) ||
          diffMatches(log.diffs, keyword);
        if (!matched) return false;
      }
      return true;
    });
  }, [safetyReady, safetyLogs, dateFrom, dateTo, selectedActor, selectedAction, keyword]);

  const activeActors = useMemo(() => {
    const names = new Set<string>();
    if (activeCategory === 'dispatch' && dispatchReady) {
      dispatchLogs.forEach((log) => log.user && names.add(log.user));
    } else if (activeCategory === 'routes' && routesReady) {
      routeLogs.forEach((log) => log.userName && names.add(log.userName));
    } else if (activeCategory === 'master' && masterReady) {
      masterLogs.forEach((log) => log.actor?.userName && names.add(log.actor.userName));
    } else if (activeCategory === 'payroll' && payrollReady) {
      payrollLogs.forEach((log) => log.actor?.userName && names.add(log.actor.userName));
    } else if (activeCategory === 'safety' && safetyReady) {
      safetyLogs.forEach((log) => log.actor?.userName && names.add(log.actor.userName));
    }
    return Array.from(names).sort();
  }, [
    activeCategory,
    dispatchReady,
    routesReady,
    masterReady,
    payrollReady,
    safetyReady,
    dispatchLogs,
    routeLogs,
    masterLogs,
    payrollLogs,
    safetyLogs,
  ]);

  const feed = useMemo<AuditFeed>(() => {
    switch (activeCategory) {
      case 'dispatch':
        return { category: 'dispatch', logs: filteredDispatchLogs };
      case 'routes':
        return { category: 'routes', logs: filteredRouteLogs };
      case 'master':
        return { category: 'master', logs: filteredMasterLogs };
      case 'payroll':
        return { category: 'payroll', logs: filteredPayrollLogs };
      default:
        return { category: 'safety', logs: filteredSafetyLogs };
    }
  }, [activeCategory, filteredDispatchLogs, filteredRouteLogs, filteredMasterLogs, filteredPayrollLogs, filteredSafetyLogs]);

  const activeReady = loadedRange[activeCategory] === rangeKey;
  const activeLogsCount = feed.logs.length;
  const selectedDaysCount = calculateDaysDiff(dateFrom, dateTo);

  const handleExportCSV = () => {
    let rows: string[][] = [];
    const filename = `audit_${activeCategory}_${dateFrom}_to_${dateTo}.csv`;

    switch (activeCategory) {
      case 'dispatch':
        rows = [
          ['Type', 'Route', 'Shift', 'Date', 'Time', 'Detail', 'User'],
          ...filteredDispatchLogs.map((log) => [
            csvCell(log.type),
            csvCell(log.routeNo || ''),
            csvCell(log.shiftType || ''),
            csvCell(log.dispatchDate || ''),
            csvCell(log.time || ''),
            csvCell(log.detail || ''),
            csvCell(log.user || ''),
          ]),
        ];
        break;
      case 'routes':
        rows = [
          ['ID', 'Timestamp', 'Route No', 'Category', 'Action', 'Summary', 'User', 'Diffs'],
          ...filteredRouteLogs.map((log) => [
            csvCell(log.id),
            csvCell(log.timestamp),
            csvCell(log.routeNo || ''),
            csvCell(log.category),
            csvCell(log.action),
            csvCell(log.summary || ''),
            csvCell(`${log.userName} (${log.userRole})`),
            csvCell((log.diffs || []).map((diff) => `${diff.fieldLabel}: ${diff.oldValue} -> ${diff.newValue}`).join('; ')),
          ]),
        ];
        break;
      case 'master':
        rows = [
          ['ID', 'Timestamp', 'Target Type', 'Target ID', 'Target Name', 'Action', 'Summary', 'Actor'],
          ...filteredMasterLogs.map((log) => [
            csvCell(log.id),
            csvCell(log.timestamp),
            csvCell(log.targetType),
            csvCell(log.targetIdentifier),
            csvCell(log.targetName),
            csvCell(log.action),
            csvCell(log.summary || ''),
            csvCell(`${log.actor?.userName || ''} (${log.actor?.userRole || ''})`),
          ]),
        ];
        break;
      case 'payroll':
        rows = [
          ['ID', 'Timestamp', 'Category', 'Target', 'Action', 'Amount', 'Summary', 'Actor'],
          ...filteredPayrollLogs.map((log) => [
            csvCell(log.id),
            csvCell(log.timestamp),
            csvCell(log.category),
            csvCell(log.targetIdentifier),
            csvCell(log.action),
            csvCell(log.amount !== undefined ? log.amount.toFixed(2) : ''),
            csvCell(log.summary || ''),
            csvCell(`${log.actor?.userName || ''} (${log.actor?.userRole || ''})`),
          ]),
        ];
        break;
      case 'safety':
        rows = [
          ['ID', 'Timestamp', 'Module', 'Target ID', 'Action', 'Severity', 'Summary', 'Actor'],
          ...filteredSafetyLogs.map((log) => [
            csvCell(log.id),
            csvCell(log.timestamp),
            csvCell(log.module),
            csvCell(log.targetIdentifier),
            csvCell(log.action),
            csvCell(log.severity || ''),
            csvCell(log.summary || ''),
            csvCell(`${log.actor?.userName || ''} (${log.actor?.userRole || ''})`),
          ]),
        ];
        break;
    }

    if (rows.length <= 1) return;
    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  const countLabel = (ready: boolean, count: number) => (ready ? String(count) : '–');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
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
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{isFrench ? 'Actualiser' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!activeReady || activeLogsCount === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Exporter CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

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

        {rangeWarning ? (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center space-x-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{rangeWarning}</span>
          </div>
        ) : null}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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

      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
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
            {countLabel(dispatchReady, filteredDispatchLogs.length)}
          </span>
        </button>
        <button
          type="button"
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
            {countLabel(routesReady, filteredRouteLogs.length)}
          </span>
        </button>
        <button
          type="button"
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
            {countLabel(masterReady, filteredMasterLogs.length)}
          </span>
        </button>
        <button
          type="button"
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
            {countLabel(payrollReady, filteredPayrollLogs.length)}
          </span>
        </button>
        <button
          type="button"
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
            {countLabel(safetyReady, filteredSafetyLogs.length)}
          </span>
        </button>
      </div>

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
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
            >
              {isFrench ? 'Réinitialiser' : 'Reset Filters'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      {!activeReady && loading ? (
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
        <AuditLogScroller
          key={activeCategory}
          feed={feed}
          expandedIds={expandedLogIds}
          isFrench={isFrench}
          onToggle={toggleExpand}
        />
      )}
    </div>
  );
};
