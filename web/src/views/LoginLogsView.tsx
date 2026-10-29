import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { LoginLogService } from '../services/loginLogService';
import { LoginLogEntry, LoginStatus } from '../types/loginLog';
import {
  History,
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  Smartphone,
  Monitor,
  RefreshCw,
  ShieldAlert,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  Sparkles
} from 'lucide-react';

/**
 * Calendar helpers to avoid UTC timezone offsets
 */
const getTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const changeDateByDays = (dateStr: string, days: number): string => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
};

export const LoginLogsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();
  const [logs, setLogs] = useState<LoginLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Date Selection: default to today (daily logs ~1,000 records)
  const todayStr = useMemo(() => getTodayStr(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [usernameFilter, setUsernameFilter] = useState<string>('');
  const [employeeNameFilter, setEmployeeNameFilter] = useState<string>('');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [versionFilter, setVersionFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<LoginStatus | 'all'>('all');

  // Strict Admin Access Check
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  // Load and listen to logs for the selected date
  useEffect(() => {
    if (!isAdmin) return;

    setLoading(true);
    const unsubscribe = LoginLogService.subscribeToLogs(
      selectedDate,
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

    return () => unsubscribe();
  }, [isAdmin, selectedDate]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    const fetched = await LoginLogService.getLogs(selectedDate);
    setLogs(fetched);
    setRefreshing(false);
  };

  const handleRegenerateSeed = () => {
    setRefreshing(true);
    const generated = LoginLogService.regenerateMockLogs(selectedDate, 1000);
    setLogs(generated);
    setRefreshing(false);
  };

  // Recent 7 days for quick day tabs
  const recentDays = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < 7; i++) {
      list.push(changeDateByDays(todayStr, -i));
    }
    return list;
  }, [todayStr]);

  // Distinct app options for dropdown
  const availableApps = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.app) set.add(log.app);
    });
    return Array.from(set);
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Date filter (safety check)
      if (selectedDate && log.date && log.date !== selectedDate) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }

      // App filter
      if (appFilter !== 'all' && log.app.toLowerCase() !== appFilter.toLowerCase()) {
        return false;
      }

      // Version filter
      if (versionFilter.trim()) {
        const vQuery = versionFilter.trim().toLowerCase();
        if (!log.appVersion?.toLowerCase().includes(vQuery)) {
          return false;
        }
      }

      // Username filter
      if (usernameFilter.trim()) {
        const uQuery = usernameFilter.trim().toLowerCase();
        if (!log.username?.toLowerCase().includes(uQuery)) {
          return false;
        }
      }

      // Employee name filter
      if (employeeNameFilter.trim()) {
        const eQuery = employeeNameFilter.trim().toLowerCase();
        if (!log.employeeName?.toLowerCase().includes(eQuery)) {
          return false;
        }
      }

      // Global freeform search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          log.username?.toLowerCase().includes(q) ||
          log.employeeName?.toLowerCase().includes(q) ||
          log.app?.toLowerCase().includes(q) ||
          log.appVersion?.toLowerCase().includes(q) ||
          log.failureReason?.toLowerCase().includes(q) ||
          log.role?.toLowerCase().includes(q) ||
          log.deviceInfo?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [
    logs,
    selectedDate,
    statusFilter,
    appFilter,
    versionFilter,
    usernameFilter,
    employeeNameFilter,
    searchQuery
  ]);

  // Aggregate statistics for the selected date
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const successes = filteredLogs.filter((l) => l.status === 'success').length;
    const failures = filteredLogs.filter((l) => l.status === 'failure').length;
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 100;
    return { total, successes, failures, successRate };
  }, [filteredLogs]);

  // Virtual Scrolling for ~1000 daily login logs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 54, // Approximate row height in px
    overscan: 12,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Date', 'Status', 'Username', 'Employee Name', 'Role', 'App', 'Version', 'Failure Reason', 'Device Info', 'IP Address'];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.date}"`,
      `"${l.status}"`,
      `"${l.username}"`,
      `"${l.employeeName || ''}"`,
      `"${l.role || ''}"`,
      `"${l.app}"`,
      `"${l.appVersion}"`,
      `"${l.failureReason || ''}"`,
      `"${l.deviceInfo || ''}"`,
      `"${l.ipAddress || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `login_logs_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setUsernameFilter('');
    setEmployeeNameFilter('');
    setAppFilter('all');
    setVersionFilter('');
    setStatusFilter('all');
  };

  // If user is not admin, deny access immediately
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 shadow-xl">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-400 max-w-md">
          Authentication and login audit logs are restricted exclusively to administrators. Your current role does not have authorization to view this page.
        </p>
      </div>
    );
  }

  const isToday = selectedDate === todayStr;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Login Audit Logs
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Admin Exclusive
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Virtual Scrolling
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {isFrench
                  ? 'Audit de connexion (Web Hub / Driver App), volume quotidien ~1 000 événements avec défilement virtuel fluide'
                  : 'Daily user and driver authentication audit trail across Web Hub and Driver App with smooth virtual scrolling'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            title={isFrench ? 'Actualiser les journaux du jour sélectionné' : 'Refresh current day logs'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{isFrench ? 'Actualiser' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleRegenerateSeed}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-medium transition"
            title={isFrench ? 'Générer 1 000 exemples de journaux pour la date sélectionnée' : 'Simulate ~1,000 test logs for selected date'}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Simuler 1 000' : 'Simulate 1,000'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Exporter CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Date Navigation & Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Quick Date Stepper & Picker */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(changeDateByDays(selectedDate, -1))}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title={isFrench ? 'Jour précédent' : 'Previous Day'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-amber-400 absolute left-3 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <button
              onClick={() => setSelectedDate(changeDateByDays(selectedDate, 1))}
              disabled={isToday}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
              title={isFrench ? 'Jour suivant' : 'Next Day'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                isToday
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isFrench ? 'Aujourd\'hui' : 'Today'}
            </button>
          </div>

          {/* Current Date Status Badge */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">{isFrench ? 'Date d\'audit :' : 'Audit Date:'}</span>
            <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              {selectedDate}
            </span>
            <span className="text-slate-400 text-[11px]">
              ({isFrench ? 'Total' : 'Total'} <b className="text-white">{logs.length}</b> {isFrench ? 'entrées' : 'records'})
            </span>
          </div>
        </div>

        {/* Quick Date Chips (Past 7 Days) */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            {isFrench ? 'Accès rapide :' : 'Quick Jump:'}
          </span>
          {recentDays.map((d, index) => {
            const isSelected = selectedDate === d;
            let label = d.slice(5); // MM-DD
            if (index === 0) label = `${isFrench ? "Aujourd'hui" : 'Today'} (${d.slice(5)})`;
            else if (index === 1) label = `${isFrench ? 'Hier' : 'Yesterday'} (${d.slice(5)})`;

            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-800'
                }`}
              >
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards for the Selected Day */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
            {isFrench ? 'Tentatives totales' : 'Total Attempts'}
          </span>
          <div className="text-2xl font-black text-white mt-1">{stats.total}</div>
          <span className="text-[11px] text-slate-400">Captured on {selectedDate}</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-emerald-400 block tracking-wider">
            {isFrench ? 'Connexions réussies' : 'Successful Logins'}
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center space-x-1.5">
            <CheckCircle2 className="w-5 h-5" />
            <span>{stats.successes}</span>
          </div>
          <span className="text-[11px] text-slate-400">Verified identity sessions</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-rose-400 block tracking-wider">
            {isFrench ? 'Échecs / Rejets' : 'Failed Attempts'}
          </span>
          <div className="text-2xl font-black text-rose-400 mt-1 flex items-center space-x-1.5">
            <XCircle className="w-5 h-5" />
            <span>{stats.failures}</span>
          </div>
          <span className="text-[11px] text-slate-400">Rejected or invalid attempts</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-amber-400 block tracking-wider">
            {isFrench ? 'Taux de réussite' : 'Success Rate'}
          </span>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.successRate}%</div>
          <span className="text-[11px] text-slate-400">Overall ratio for this date</span>
        </div>
      </div>

      {/* Advanced Multi-Field Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Filter className="w-4 h-4 text-amber-400" />
            <span>Search & Targeted Filters</span>
          </div>
          {(searchQuery || usernameFilter || employeeNameFilter || appFilter !== 'all' || versionFilter || statusFilter !== 'all') && (
            <button
              onClick={handleClearFilters}
              className="text-[11px] font-semibold text-rose-400 hover:text-rose-300"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Freeform Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Any keyword..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Username Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Username / Email</label>
            <input
              type="text"
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              placeholder="e.g. driver1d"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Employee Name Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Employee Name</label>
            <input
              type="text"
              value={employeeNameFilter}
              onChange={(e) => setEmployeeNameFilter(e.target.value)}
              placeholder="e.g. David Miller"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* App Type Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">App Client</label>
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Apps</option>
              {availableApps.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* App Version Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">App Version</label>
            <input
              type="text"
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              placeholder="e.g. v1.2.4"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success Only</option>
              <option value="failure">Failure Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Logs Table with Virtual Scrolling */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Audit Trail Records ({selectedDate})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
              {filteredLogs.length} matching
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-sky-400 font-medium">
              <Zap className="w-3.5 h-3.5" />
              Virtual Scroll: {virtualRows.length > 0 ? `${virtualRows[0].index + 1} - ${virtualRows[virtualRows.length - 1].index + 1}` : 0} of {filteredLogs.length}
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline">Real-time sync active</span>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />
            Loading authentication logs for {selectedDate}...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">
              {isFrench ? `Aucun enregistrement de connexion pour le ${selectedDate}` : `No login records found for ${selectedDate}`}
            </p>
            <p className="text-xs text-slate-500">
              {isFrench
                ? 'Ajustez vos filtres ci-dessus ou cliquez sur "Simuler 1 000" pour générer des données de test.'
                : 'Try adjusting your date or keyword filters above, or click "Simulate 1,000" to seed test logs.'}
            </p>
          </div>
        ) : (
          <div
            ref={tableContainerRef}
            className="overflow-x-auto overflow-y-auto max-h-[640px] scrollbar-thin"
          >
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 shadow-md">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Time</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Username / Identity</th>
                  <th className="py-3 px-4 whitespace-nowrap">Employee Full Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">App & Version</th>
                  <th className="py-3 px-4 whitespace-nowrap">Role</th>
                  <th className="py-3 px-4">Details / Failure Note / Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {/* Top spacer for virtual scrolling */}
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={7} />
                  </tr>
                )}

                {/* Rendered virtual items */}
                {virtualRows.map((virtualRow) => {
                  const log = filteredLogs[virtualRow.index];
                  if (!log) return null;

                  const isSuccess = log.status === 'success';
                  const isDriverApp = log.app.toLowerCase().includes('driver');
                  const timeStr = log.timestamp.includes('T')
                    ? log.timestamp.split('T')[1].slice(0, 8)
                    : log.timestamp;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-800/40 transition-colors h-[54px]"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        <div className="text-[10px] text-slate-500">{log.date}</div>
                        <div className="text-white font-medium flex items-center space-x-1 mt-0.5">
                          <Clock className="w-3 h-3 text-amber-500/70" />
                          <span>{timeStr}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Success</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Failure</span>
                          </span>
                        )}
                      </td>

                      {/* Username */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-amber-300 font-semibold text-xs">
                          {log.username}
                        </span>
                        {log.employeeId && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            ID: {log.employeeId}
                          </span>
                        )}
                      </td>

                      {/* Employee Name */}
                      <td className="py-3 px-4 font-medium text-white">
                        {isSuccess && log.employeeName ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-amber-400 font-bold">
                              {log.employeeName.charAt(0)}
                            </div>
                            <span>{log.employeeName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">
                            {isSuccess ? '—' : 'Not Authenticated'}
                          </span>
                        )}
                      </td>

                      {/* App & Version */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-medium text-white">
                          {isDriverApp ? (
                            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-purple-400" />
                          )}
                          <span>{log.app}</span>
                        </div>
                        <span className="text-[10px] text-amber-400 font-mono block mt-0.5">
                          {log.appVersion}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.role ? (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-300">
                            {log.role}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Details / Failure Reason */}
                      <td className="py-3 px-4 text-[11px]">
                        {!isSuccess && log.failureReason ? (
                          <span className="text-rose-400 font-medium">
                            {log.failureReason}
                          </span>
                        ) : log.deviceInfo ? (
                          <span className="text-slate-400 truncate max-w-xs block" title={log.deviceInfo}>
                            {log.deviceInfo}
                          </span>
                        ) : (
                          <span className="text-emerald-400">Authorized Session</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Bottom spacer for virtual scrolling */}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={7} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
