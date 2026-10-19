import React, { useState, useEffect, useMemo } from 'react';
import { RouteChangeLog, RouteChangeCategory } from '../../types/routeAudit';
import { RouteAuditService } from '../../services/routeAuditService';
import {
  History,
  Filter,
  Search,
  User,
  Clock,
  MapPin,
  GraduationCap,
  Bus,
  Shield,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface RouteAuditHistoryPanelProps {
  routeId?: string;
  routeNo?: string;
  routeName?: string;
}

export const RouteAuditHistoryPanel: React.FC<RouteAuditHistoryPanelProps> = ({
  routeId,
  routeNo,
  routeName
}) => {
  const [logs, setLogs] = useState<RouteChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<RouteChangeCategory | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [routeFilter, setRouteFilter] = useState<string>(routeNo || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    let unsubscribe: () => void;
    if (routeId && routeId !== 'all') {
      unsubscribe = RouteAuditService.subscribeToRouteLogs(routeId, (updated) => {
        setLogs(updated);
        setLoading(false);
      });
    } else {
      unsubscribe = RouteAuditService.subscribeToAllLogs((updated) => {
        setLogs(updated);
        setLoading(false);
      });
    }

    return () => unsubscribe();
  }, [routeId]);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();
    logs.forEach((l) => {
      if (l.userId && !map.has(l.userId)) {
        map.set(l.userId, { id: l.userId, name: l.userName || l.userId, role: l.userRole });
      }
    });
    return Array.from(map.values());
  }, [logs]);

  const uniqueRoutes = useMemo(() => {
    const map = new Map<string, { routeId: string; routeNo: string }>();
    logs.forEach((l) => {
      if (l.routeNo && !map.has(l.routeNo)) {
        map.set(l.routeNo, { routeId: l.routeId, routeNo: l.routeNo });
      }
    });
    return Array.from(map.values());
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
      if (userFilter !== 'all' && log.userId !== userFilter) return false;
      if (!routeId && routeFilter !== 'all' && log.routeNo !== routeFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchSummary = log.summary.toLowerCase().includes(q);
        const matchUser = (log.userName || '').toLowerCase().includes(q);
        const matchStudent = (log.studentName || '').toLowerCase().includes(q);
        const matchStop = (log.stopLocation || '').toLowerCase().includes(q);
        const matchShift = (log.shiftType || '').toLowerCase().includes(q);
        const matchRoute = log.routeNo.toLowerCase().includes(q);
        if (!matchSummary && !matchUser && !matchStudent && !matchStop && !matchShift && !matchRoute) {
          return false;
        }
      }

      return true;
    });
  }, [logs, categoryFilter, userFilter, routeFilter, routeId, searchTerm]);

  const getCategoryBadge = (category: RouteChangeCategory) => {
    switch (category) {
      case 'shift':
        return {
          label: 'Shift',
          icon: Clock,
          className: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        };
      case 'stop':
        return {
          label: 'Stop',
          icon: MapPin,
          className: 'bg-sky-500/10 text-sky-400 border-sky-500/30'
        };
      case 'student':
        return {
          label: 'Student',
          icon: GraduationCap,
          className: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
        };
      case 'crew':
        return {
          label: 'Crew',
          icon: Shield,
          className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
        };
      case 'route':
      default:
        return {
          label: 'Route',
          icon: Bus,
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        };
    }
  };

  const formatLogDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Route Audit Trail {routeName ? `— ${routeName}` : routeNo ? `(${routeNo})` : ''}
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
              {filteredLogs.length} Records
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by user, stop, student, or summary..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Filter Badges & Dropdown */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center space-x-1 text-slate-400 text-[11px] font-medium mr-1">
            <Filter className="w-3 h-3" />
            <span>Category:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'all', label: 'All Changes' },
                { key: 'shift', label: 'Shifts' },
                { key: 'stop', label: 'Stops' },
                { key: 'student', label: 'Students' },
                { key: 'crew', label: 'Crew' },
                { key: 'route', label: 'Route Settings' }
              ] as const
            ).map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  categoryFilter === cat.key
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {uniqueRoutes.length > 1 && !routeId && (
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-400 text-[11px]">Route:</span>
              <select
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Routes ({uniqueRoutes.length})</option>
                {uniqueRoutes.map((r) => (
                  <option key={r.routeNo} value={r.routeNo}>
                    {r.routeNo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {uniqueUsers.length > 0 && (
            <div className="sm:ml-auto flex items-center space-x-1.5 text-xs">
              <span className="text-slate-400 text-[11px]">Changed by:</span>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Users ({uniqueUsers.length})</option>
                {uniqueUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.role ? `(${u.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Audit Log Timeline */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 space-y-2">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs">Loading route change history...</div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No modification logs match filters</p>
          <p className="text-xs text-slate-500">
            Edits made to shifts, stops, students, and route parameters will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const badge = getCategoryBadge(log.category);
            const IconComponent = badge.icon;
            const isExpanded = !!expandedLogIds[log.id];
            const hasDiffs = log.diffs && log.diffs.length > 0;

            return (
              <div
                key={log.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-slate-700 transition shadow-sm"
              >
                {/* Header Row: Category Badge, Timestamp, and User Actor */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${badge.className}`}
                    >
                      <IconComponent className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>

                    {log.shiftType && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Shift: {log.shiftType}
                      </span>
                    )}

                    {log.stopSequence !== undefined && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                        Stop #{log.stopSequence}
                      </span>
                    )}

                    {log.studentName && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                        Student: {log.studentName}
                      </span>
                    )}
                  </div>

                  {/* Actor details (Who changed it) */}
                  <div className="flex items-center space-x-2 text-xs">
                    <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                        <User className="w-3 h-3" />
                      </div>
                      <span className="font-bold text-white text-xs">{log.userName}</span>
                      {log.userRole && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          {log.userRole}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatLogDate(log.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Summary description */}
                <div className="text-xs text-slate-200 font-medium leading-relaxed">
                  {log.summary}
                </div>

                {/* Field Differences (Before vs After) */}
                {hasDiffs && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => toggleExpand(log.id)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1"
                    >
                      <span>{isExpanded ? 'Hide Changed Fields' : `View Changed Fields (${log.diffs?.length})`}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="text-slate-500 font-semibold border-b border-slate-800 pb-1">
                              <th className="pb-1.5 pr-3">Attribute</th>
                              <th className="pb-1.5 px-3">Previous Value</th>
                              <th className="pb-1.5 px-3 w-6 text-center"></th>
                              <th className="pb-1.5 pl-3">Updated Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {log.diffs?.map((d, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/40">
                                <td className="py-1.5 pr-3 text-slate-300 font-sans font-medium">
                                  {d.fieldLabel || d.field}
                                </td>
                                <td className="py-1.5 px-3 text-rose-300 bg-rose-950/20 rounded">
                                  {d.oldValue !== undefined && d.oldValue !== ''
                                    ? String(d.oldValue)
                                    : '— (None)'}
                                </td>
                                <td className="py-1.5 px-2 text-center text-slate-500">
                                  <ArrowRight className="w-3 h-3 mx-auto" />
                                </td>
                                <td className="py-1.5 pl-3 text-emerald-300 bg-emerald-950/20 rounded">
                                  {d.newValue !== undefined && d.newValue !== ''
                                    ? String(d.newValue)
                                    : '— (Cleared)'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
