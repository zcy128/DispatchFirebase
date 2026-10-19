import React, { useState, useEffect, useMemo } from 'react';
import {
  EntityOperationLog,
  EntityOperationLogFilter,
  EntityOperationAction,
  EntityTargetType
} from '../../types/entityOperationLog';
import { EntityOperationLogService } from '../../services/entityOperationLogService';
import {
  History,
  Search,
  PlusCircle,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  GraduationCap,
  Bus,
  RefreshCw,
  Clock
} from 'lucide-react';

interface EntityOperationLogPanelProps {
  targetType?: EntityTargetType | 'all';
  targetId?: string;
  targetIdentifier?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const EntityOperationLogPanel: React.FC<EntityOperationLogPanelProps> = ({
  targetType = 'all',
  targetId,
  targetIdentifier,
  title,
  subtitle,
  compact = false
}) => {
  const [logs, setLogs] = useState<EntityOperationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [actionFilter, setActionFilter] = useState<EntityOperationAction | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<EntityTargetType | 'all'>(targetType);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedActor, setSelectedActor] = useState<string>('');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTypeFilter(targetType);
  }, [targetType]);

  // Subscribe to real-time logs
  useEffect(() => {
    setLoading(true);
    const filter: EntityOperationLogFilter = {};
    if (targetId) filter.targetId = targetId;
    if (targetIdentifier) filter.targetIdentifier = targetIdentifier;

    const unsub = EntityOperationLogService.subscribeToLogs(
      filter,
      (updatedLogs) => {
        setLogs(updatedLogs);
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsub();
  }, [targetId, targetIdentifier]);

  const handleRefresh = () => {
    setRefreshing(true);
    const filter: EntityOperationLogFilter = {};
    if (targetId) filter.targetId = targetId;
    if (targetIdentifier) filter.targetIdentifier = targetIdentifier;

    const unsub = EntityOperationLogService.subscribeToLogs(filter, (updatedLogs) => {
      setLogs(updatedLogs);
      setRefreshing(false);
      unsub();
    });
  };

  // Extract unique actors for filter dropdown
  const uniqueActors = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((log) => {
      if (log.actor?.userId) {
        map.set(log.actor.userId, `${log.actor.userName} (${log.actor.userRole || 'User'})`);
      }
    });
    return Array.from(map.entries()).map(([userId, label]) => ({ userId, label }));
  }, [logs]);

  // Filtered log list
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Type filter
      if (typeFilter !== 'all' && log.targetType !== typeFilter) {
        return false;
      }

      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }

      // Actor filter
      if (selectedActor && log.actor?.userId !== selectedActor) {
        return false;
      }

      // Keyword search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = log.targetName.toLowerCase().includes(q);
        const matchIdentifier = log.targetIdentifier.toLowerCase().includes(q);
        const matchSummary = log.summary.toLowerCase().includes(q);
        const matchActor =
          log.actor.userName.toLowerCase().includes(q) ||
          (log.actor.userRole && log.actor.userRole.toLowerCase().includes(q));
        const matchDiff = log.diffs?.some(
          (d) =>
            d.fieldLabel.toLowerCase().includes(q) ||
            String(d.oldValue).toLowerCase().includes(q) ||
            String(d.newValue).toLowerCase().includes(q)
        );

        if (!matchName && !matchIdentifier && !matchSummary && !matchActor && !matchDiff) {
          return false;
        }
      }

      return true;
    });
  }, [logs, typeFilter, actionFilter, selectedActor, searchQuery]);

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

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = [
      'Timestamp',
      'Target Type',
      'Target ID',
      'Target Identifier',
      'Target Name',
      'Action',
      'Summary',
      'Operator Name',
      'Operator Role',
      'Operator Email',
      'Field Diffs'
    ];

    const rows = filteredLogs.map((log) => {
      const diffString = (log.diffs || [])
        .map((d) => `${d.fieldLabel}: [${String(d.oldValue)}] -> [${String(d.newValue)}]`)
        .join('; ');
      return [
        `"${log.timestamp}"`,
        `"${log.targetType}"`,
        `"${log.targetId}"`,
        `"${log.targetIdentifier}"`,
        `"${log.targetName.replace(/"/g, '""')}"`,
        `"${log.action}"`,
        `"${log.summary.replace(/"/g, '""')}"`,
        `"${log.actor.userName.replace(/"/g, '""')}"`,
        `"${log.actor.userRole || ''}"`,
        `"${log.actor.userEmail || ''}"`,
        `"${diffString.replace(/"/g, '""')}"`
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute(
      'download',
      `operation_audit_${targetType}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`space-y-4 ${compact ? '' : 'p-4 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm'}`}>
      {/* Top Banner & Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>{title || 'Operation & Change History'}</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {filteredLogs.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {subtitle || 'Audit records with field-level change history and user identification'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh logs"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Freeform Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search records or diffs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Target Type Filter (if not fixed in props) */}
        {targetType === 'all' && (
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Entity Types</option>
              <option value="student">Students Only</option>
              <option value="vehicle">Vehicles Only</option>
            </select>
          </div>
        )}

        {/* Action Filter */}
        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as any)}
            className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All Actions (Create/Edit/Delete)</option>
            <option value="create">Created Only</option>
            <option value="update">Updated / Modified Only</option>
            <option value="delete">Deleted Only</option>
          </select>
        </div>

        {/* Operator / User Filter */}
        <div>
          <select
            value={selectedActor}
            onChange={(e) => setSelectedActor(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">All Operators / Users</option>
            {uniqueActors.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log Entries Timeline */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span>Loading operation history...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-10 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl p-6">
          <History className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-400">No operation logs found</p>
          <p className="text-[11px] text-slate-500 mt-1">
            No creation, modification, or deletion events match the selected criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogIds.has(log.id);
            const hasDiffs = log.diffs && log.diffs.length > 0;

            const isCreate = log.action === 'create';
            const isUpdate = log.action === 'update';

            const actionColor = isCreate
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : isUpdate
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30';

            const actionIcon = isCreate ? (
              <PlusCircle className="w-3.5 h-3.5" />
            ) : isUpdate ? (
              <Edit3 className="w-3.5 h-3.5" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            );

            const isStudent = log.targetType === 'student';

            return (
              <div
                key={log.id}
                className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 transition space-y-3 shadow-sm"
              >
                {/* Header row: Action Badge, Target Info, Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${actionColor}`}
                    >
                      {actionIcon}
                      <span className="uppercase tracking-wider">{log.action}</span>
                    </span>

                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {isStudent ? (
                        <GraduationCap className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <Bus className="w-3 h-3 text-amber-400" />
                      )}
                      <span>
                        {isStudent ? 'Student' : 'Vehicle'} #{log.targetIdentifier}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* Target Name & Summary */}
                <div>
                  <div className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
                    <span>{log.targetName}</span>
                    <span className="text-xs font-normal text-slate-400">({log.targetId})</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                    {log.summary}
                  </p>
                </div>

                {/* Actor / Operator Information Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-[10px]">
                      {log.actor.userName ? log.actor.userName[0].toUpperCase() : 'U'}
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-slate-200">{log.actor.userName}</span>
                      {log.actor.userRole && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.actor.userRole}
                        </span>
                      )}
                      {log.actor.userEmail && (
                        <span className="text-[11px] text-slate-500 hidden sm:inline">
                          ({log.actor.userEmail})
                        </span>
                      )}
                    </div>
                  </div>

                  {hasDiffs && (
                    <button
                      onClick={() => toggleExpand(log.id)}
                      className="flex items-center space-x-1 text-xs font-semibold text-sky-400 hover:text-sky-300 transition"
                    >
                      <span>
                        {isExpanded ? 'Hide' : 'View'} Changed Fields ({log.diffs?.length})
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Field-by-Field Diff Details */}
                {hasDiffs && isExpanded && (
                  <div className="pt-2 border-t border-slate-800/60 space-y-2 animate-in fade-in duration-150">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Field Modification Details:
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {log.diffs?.map((diff, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
                        >
                          <div className="font-semibold text-amber-300 flex items-center justify-between">
                            <span>{diff.fieldLabel}</span>
                            <span className="text-[10px] font-mono text-slate-500 font-normal">
                              ({diff.field})
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] mt-1">
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 text-rose-300">
                              <span className="font-bold text-rose-400 block text-[10px] uppercase">
                                Previous Value:
                              </span>
                              <span className="break-words font-mono">
                                {diff.oldValue === undefined || diff.oldValue === ''
                                  ? '(empty)'
                                  : String(diff.oldValue)}
                              </span>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-emerald-300">
                              <span className="font-bold text-emerald-400 block text-[10px] uppercase">
                                New Value:
                              </span>
                              <span className="break-words font-mono">
                                {diff.newValue === undefined || diff.newValue === ''
                                  ? '(empty)'
                                  : String(diff.newValue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
