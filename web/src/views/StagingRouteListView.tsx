import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bus, ChevronDown, ChevronRight, Clock, Copy, MapPin, RefreshCw, Search, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { BusPlannerService, StagingRoute, StagingShift } from '../services/busplannerService';
import { getShiftBadgeStyle } from '../types/route';
import { getPagePermission } from '../utils/permissions';

export const StagingRouteListView: React.FC = () => {
  const { isFrench } = useI18n();
  const { currentUser } = useAuth();
  const canCopy = getPagePermission(currentUser, 'staging_routes') === 'readwrite';
  const [routes, setRoutes] = useState<StagingRoute[]>([]);
  const [totals, setTotals] = useState({ routes: 0, shifts: 0, stops: 0, students: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeShift, setActiveShift] = useState<Record<string, string>>({});
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<Record<string, { text: string; error?: boolean }>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await BusPlannerService.listStagingRoutes();
      const next = list.routes || [];
      setRoutes(next);
      setTotals({
        routes: list.totalRoutes || next.length,
        shifts: list.totalShifts || 0,
        stops: list.totalStops || 0,
        students: list.totalStudents || 0,
      });
    } catch (err: any) {
      setError(err.message || (isFrench ? 'Impossible de charger les circuits staging' : 'Could not load staging routes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return routes.filter((route) => {
      if (shiftFilter !== 'ALL' && !route.shifts.some((shift) => shift.shiftType === shiftFilter)) {
        return false;
      }
      if (!term) return true;
      const haystack = [
        route.routeNo,
        route.routeName,
        route.operatorId,
        ...route.shifts.flatMap((shift) => [
          shift.shiftType,
          shift.description,
          shift.schools,
          shift.runDays,
          ...shift.stops.flatMap((stop) => [stop.location, ...stop.students.map((student) => student.name)]),
        ]),
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [routes, search, shiftFilter]);

  const copyRoute = async (route: StagingRoute) => {
    const windows = (route.applyWindows || [])
      .map((window) => `${window.effectiveDate} → ${window.applyDate} ${window.applyTime}`)
      .join(', ');
    const prompt = isFrench
      ? `Copier ${route.shifts.length} quarts, arrêts et élèves de ${route.routeNo} vers les circuits en service ? Les affectations restent inchangées.${windows ? ` Dates d'effet : ${windows}.` : ''}`
      : `Copy ${route.shifts.length} shifts, stops, and students from ${route.routeNo} into the live routes? Crew assignments stay unchanged.${windows ? ` Effective dates: ${windows}.` : ''}`;
    if (!window.confirm(prompt)) return;
    setCopyingId(route.id);
    try {
      const report = await BusPlannerService.copyStagingRoute(route.id);
      setCopyNote((prev) => ({
        ...prev,
        [route.id]: {
          text: isFrench
            ? `${report.shiftCount} quarts, ${report.stopCount} arrêts et ${report.studentCount} élèves copiés. Les affectations n'ont pas changé.`
            : report.message,
        },
      }));
    } catch (err: any) {
      setCopyNote((prev) => ({
        ...prev,
        [route.id]: { text: err.message || (isFrench ? 'Copie impossible' : 'Could not copy this route'), error: true },
      }));
    } finally {
      setCopyingId(null);
    }
  };

  // Virtual scrolling container for 1,000+ staging routes
  const stagingContainerRef = useRef<HTMLDivElement>(null);

  const stagingVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => stagingContainerRef.current,
    estimateSize: (index) => {
      const route = filtered[index];
      return expanded[route?.id] ? 360 : 68;
    },
    overscan: 6,
  });

  const openShift = (route: StagingRoute): StagingShift | undefined => {
    const selected = activeShift[route.id];
    return route.shifts.find((shift) => shift.id === selected) || route.shifts[0];
  };

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-white">
              {isFrench ? 'Circuits staging' : 'Staging Routes'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isFrench
                ? 'Lignes, quarts, arrêts et élèves lus depuis staging. Si la synchronisation est désactivée, cinq circuits d\'exemple sont recréés chaque lundi à 9 h (Ottawa). Si elle est activée, la copie automatique a lieu à 9 h la veille de la date d\'effet, ou le vendredi à 9 h si cette veille tombe un week-end. Les affectations ne sont pas modifiées.'
                : 'Routes, shifts, stops, and students from staging. While BusPlanner sync is off, five sample routes are recreated each Monday at 9:00 AM Ottawa time. While sync is on, the automatic copy runs at 9:00 AM on the day before the effective date, or Friday at 9:00 AM when that day is a weekend. Crew assignments are not changed.'}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            {isFrench ? 'Actualiser' : 'Refresh'}
          </button>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isFrench ? 'Ligne, école, arrêt ou élève' : 'Route, school, stop, or student'}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
          >
            <option value="ALL">{isFrench ? 'Tous les quarts' : 'All shifts'}</option>
            <option value="AM">AM</option>
            <option value="Midday">{isFrench ? 'Midi' : 'Midday'}</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Metric icon={<Bus className="w-4 h-4 sm:w-5 sm:h-5" />} tone="text-amber-400 bg-amber-500/10 border-amber-500/20" value={totals.routes} label={isFrench ? 'Lignes staging' : 'Staging routes'} />
        <Metric icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />} tone="text-sky-400 bg-sky-500/10 border-sky-500/20" value={totals.shifts} label={isFrench ? 'Quarts' : 'Shifts'} />
        <Metric icon={<MapPin className="w-4 h-4 sm:w-5 sm:h-5" />} tone="text-indigo-400 bg-indigo-500/10 border-indigo-500/20" value={totals.stops} label={isFrench ? 'Arrêts' : 'Stops'} />
        <Metric icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />} tone="text-emerald-400 bg-emerald-500/10 border-emerald-500/20" value={totals.students} label={isFrench ? 'Élèves' : 'Students'} />
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-800 text-sm font-bold text-white">
          {isFrench ? 'Réseau staging' : 'Staging network'} ({filtered.length} / {routes.length})
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{isFrench ? 'Chargement...' : 'Loading...'}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Bus className="w-8 h-8 mx-auto text-slate-600" />
            <div className="font-semibold text-sm">{isFrench ? 'Aucune ligne staging' : 'No staging routes'}</div>
            <p className="text-xs max-w-md mx-auto">
              {isFrench
                ? 'Lancez la synchronisation BusPlanner depuis Synchronisation externe. Les circuits en service ne sont pas modifiés.'
                : 'Run BusPlanner sync from External Sync. Live routes are not changed.'}
            </p>
          </div>
        ) : (
          <div ref={stagingContainerRef} className="overflow-y-auto max-h-[calc(100vh-270px)]">
            <div
              style={{
                height: `${stagingVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {stagingVirtualizer.getVirtualItems().map((virtualRow) => {
                const route = filtered[virtualRow.index];
                if (!route) return null;
                const isOpen = !!expanded[route.id];
                const shift = openShift(route);
                return (
                  <div
                    key={route.id}
                    data-index={virtualRow.index}
                    ref={stagingVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="border-b border-slate-800/60">
                      <div className="px-4 py-3 hover:bg-slate-800/40 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [route.id]: !prev[route.id] }))}
                      className="min-w-0 flex-1 text-left flex items-center gap-3"
                    >
                      <span className={`p-1 rounded-lg border ${isOpen ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                      <span className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Bus className="w-5 h-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-white text-sm">
                          {route.routeNo}
                          {route.simulated && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">{isFrench ? 'Exemple' : 'Sample'}</span>
                          )}
                        </span>
                        <span className="block text-xs text-slate-400 truncate">{route.routeName || route.operatorId}</span>
                        {(route.applyWindows || []).map((window) => (
                          <span key={window.effectiveDate} className="block text-[11px] text-amber-200/90">
                            {isFrench
                              ? `Effet ${window.effectiveDate} · mise à jour ${window.applyDate} à ${window.applyTime}`
                              : `Effective ${window.effectiveDate} · update ${window.applyDate} at ${window.applyTime}`}
                          </span>
                        ))}
                        {copyNote[route.id] && (
                          <span className={`block text-[11px] mt-1 ${copyNote[route.id].error ? 'text-rose-300' : 'text-emerald-300'}`}>
                            {copyNote[route.id].text}
                          </span>
                        )}
                      </span>
                      <span className="hidden md:flex flex-wrap gap-1 justify-end max-w-md">
                        {route.shifts.map((item) => {
                          const badge = getShiftBadgeStyle(item.shiftType, item.runDays);
                          return (
                            <span key={item.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.tag}`}>
                              {item.shiftType} {item.runDays} {item.firstStopTime && `· ${item.firstStopTime}`}
                            </span>
                          );
                        })}
                      </span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {route.totalStops} {isFrench ? 'arrêts' : 'stops'} · {route.totalStudents} {isFrench ? 'élèves' : 'students'}
                      </span>
                    </button>
                    {canCopy && (
                      <button
                        type="button"
                        onClick={() => copyRoute(route)}
                        disabled={copyingId === route.id || route.shifts.length === 0}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 text-[11px] font-bold hover:bg-amber-500/20 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copyingId === route.id
                          ? (isFrench ? 'Copie...' : 'Copying...')
                          : (isFrench ? 'Copier en service' : 'Copy to live')}
                      </button>
                    )}
                  </div>
                  {isOpen && shift && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {route.shifts.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveShift((prev) => ({ ...prev, [route.id]: item.id }))}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                              shift.id === item.id
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {item.shiftType} · {item.id} · {item.runDays}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-slate-400">
                        {shift.schools && <span>{shift.schools}</span>}
                        {shift.description && <span> · {shift.description}</span>}
                        {shift.effectiveDate && (
                          <span className="text-amber-200/90">
                            {isFrench
                              ? ` · Effet ${shift.effectiveDate}${shift.applyDate ? `, mise à jour ${shift.applyDate} à ${shift.applyTime || '09:00'}` : ''}`
                              : ` · Effective ${shift.effectiveDate}${shift.applyDate ? `, update ${shift.applyDate} at ${shift.applyTime || '09:00'}` : ''}`}
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto border border-slate-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950/50 text-slate-400 uppercase tracking-wider">
                            <tr>
                              <th className="py-2 px-3">#</th>
                              <th className="py-2 px-3">{isFrench ? 'Heure' : 'Time'}</th>
                              <th className="py-2 px-3">{isFrench ? 'Arrêt' : 'Stop'}</th>
                              <th className="py-2 px-3">{isFrench ? 'Type' : 'Type'}</th>
                              <th className="py-2 px-3">{isFrench ? 'Élèves' : 'Students'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70 text-slate-200">
                            {shift.stops.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-4 px-3 text-slate-500">{isFrench ? 'Aucun arrêt' : 'No stops'}</td>
                              </tr>
                            ) : shift.stops.map((stop) => (
                              <tr key={`${shift.id}-${stop.id}-${stop.sequence}`}>
                                <td className="py-2 px-3 font-mono">{stop.sequence}</td>
                                <td className="py-2 px-3 font-mono">{stop.time || '—'}</td>
                                <td className="py-2 px-3">
                                  <div className="font-medium text-white">{stop.location}</div>
                                  {stop.instruction && <div className="text-[11px] text-slate-500">{stop.instruction}</div>}
                                </td>
                                <td className="py-2 px-3">{stop.stopType}</td>
                                <td className="py-2 px-3">
                                  {stop.students.length === 0 ? (
                                    <span className="text-slate-500">—</span>
                                  ) : (
                                    <div className="space-y-0.5">
                                      {stop.students.map((student) => (
                                        <div key={`${stop.id}-${student.id}-${student.name}`}>
                                          <span className="text-white">{student.name}</span>
                                          {student.grade && <span className="text-slate-500"> · {student.grade}</span>}
                                          {student.schoolName && <span className="text-slate-500"> · {student.schoolName}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {isOpen && !shift && (
                    <div className="px-4 pb-4 text-xs text-slate-500">{isFrench ? 'Aucun quart' : 'No shifts'}</div>
                  )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function Metric({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: number; label: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center gap-3">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}>
        {icon}
      </div>
      <div>
        <div className="text-lg sm:text-xl font-bold text-white">{value}</div>
        <div className="text-[10px] sm:text-[11px] text-slate-400">{label}</div>
      </div>
    </div>
  );
}
