import React, { useState, useEffect } from 'react';
import { BusRoute, BusRouteShift, RouteStop, formatOpDays, getShiftBadgeStyle, isAutoMarryupEnabled } from '../../types/route';
import { Student } from '../../types/student';
import { RouteService } from '../../services/routeService';
import { useAuth } from '../../contexts/AuthContext';
import { RouteAuditService } from '../../services/routeAuditService';
import { RouteChangeFieldDiff } from '../../types/routeAudit';
import { RouteAuditHistoryPanel } from './RouteAuditHistoryPanel';
import {
  X,
  Bus,
  Clock,
  School as SchoolIcon,
  User,
  Phone,
  Building2,
  Navigation,
  Shield,
  Edit3,
  Pencil,
  History
} from 'lucide-react';
import { ShiftEditModal } from './ShiftEditModal';
import { StopEditModal } from './StopEditModal';
import { ShiftGoogleMapView } from './ShiftGoogleMapView';

interface RouteDetailDrawerProps {
  route: BusRoute | null;
  studentsMap: Record<number, Student>;
  onClose: () => void;
  onSelectStudent?: (student: Student) => void;
  onAssignCrew?: (route: BusRoute) => void;
  onRouteUpdated?: (route: BusRoute) => void;
  initialTab?: 'itinerary' | 'audit';
}

export const RouteDetailDrawer: React.FC<RouteDetailDrawerProps> = ({
  route,
  studentsMap,
  onClose,
  onSelectStudent,
  onAssignCrew,
  onRouteUpdated,
  initialTab = 'itinerary'
}) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'itinerary' | 'audit'>(initialTab);
  const [shifts, setShifts] = useState<BusRouteShift[]>([]);
  const [activeShiftId, setActiveShiftId] = useState<string>('');
  const [editingShift, setEditingShift] = useState<BusRouteShift | null>(null);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [loadingShifts, setLoadingShifts] = useState<boolean>(false);
  const [drawerMode, setDrawerMode] = useState<'stops' | 'map'>('stops');

  const handleSaveShift = async (shiftId: string, updates: Partial<BusRouteShift>) => {
    const targetShift = shifts.find((r) => r.id === shiftId);

    await RouteService.updateShift(shiftId, updates);
    if (route) {
      const refreshed = await RouteService.getShiftsForRoute(route.id);
      setShifts(refreshed);

      // Audit Log: Shift Changes
      if (targetShift) {
        const diffs: RouteChangeFieldDiff[] = [];
        if (updates.runDays !== undefined && updates.runDays !== targetShift.runDays) {
          diffs.push({ field: 'runDays', fieldLabel: 'Operating Days', oldValue: targetShift.runDays, newValue: updates.runDays });
        }
        if (updates.active !== undefined && updates.active !== targetShift.active) {
          diffs.push({ field: 'active', fieldLabel: 'Active Status', oldValue: targetShift.active, newValue: updates.active });
        }
        if (updates.effectiveDate !== undefined && updates.effectiveDate !== targetShift.effectiveDate) {
          diffs.push({ field: 'effectiveDate', fieldLabel: 'Effective Date', oldValue: targetShift.effectiveDate, newValue: updates.effectiveDate });
        }
        if (updates.retireDate !== undefined && updates.retireDate !== targetShift.retireDate) {
          diffs.push({ field: 'retireDate', fieldLabel: 'Retire Date', oldValue: targetShift.retireDate, newValue: updates.retireDate });
        }

        if (diffs.length > 0) {
          const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
          const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
          const actorRole = currentUser?.role || 'dispatcher';
          const actorEmail = currentUser?.email || undefined;

          RouteAuditService.logRouteChange({
            routeId: route.id,
            routeNo: route.routeNo,
            routeName: route.routeName,
            category: 'shift',
            action: 'update',
            shiftId,
            shiftType: targetShift.shiftType,
            summary: `Updated ${targetShift.shiftType} Shift schedule: ${diffs.map((d) => `${d.fieldLabel} (${d.oldValue || 'None'} -> ${d.newValue || 'None'})`).join(', ')}`,
            diffs,
            userId: actorId,
            userName: actorName,
            userEmail: actorEmail,
            userRole: actorRole
          }).catch((err) => console.warn('[RouteDetailDrawer] Shift audit warning:', err));
        }
      }

      if (onRouteUpdated) {
        const updatedShifts = (route.shifts || []).map((s) => {
          if ((targetShift && s.shiftType === targetShift.shiftType) || (targetShift && s.shiftId === targetShift.shiftId)) {
            return {
              ...s,
              runDays: updates.runDays !== undefined ? updates.runDays : s.runDays,
            };
          }
          return s;
        });
        onRouteUpdated({
          ...route,
          shifts: updatedShifts
        });
      }
    }
  };

  const handleSaveStop = async (shiftId: string, updatedStop: RouteStop) => {
    const targetShift = shifts.find((s) => s.id === shiftId);
    if (!targetShift) return;

    const oldStop = targetShift.stops?.find((s) => s.stopId === updatedStop.stopId);

    const updatedStops = (targetShift.stops || []).map((s) =>
      s.stopId === updatedStop.stopId ? updatedStop : s
    );

    await RouteService.updateShift(shiftId, {
      stops: updatedStops,
    });

    // Audit Log: Stop Changes
    if (route) {
      const diffs: RouteChangeFieldDiff[] = [];
      if (oldStop) {
        if (oldStop.pullawayTime !== updatedStop.pullawayTime) {
          diffs.push({ field: 'pullawayTime', fieldLabel: 'Pullaway Time', oldValue: oldStop.pullawayTime, newValue: updatedStop.pullawayTime });
        }
        if (oldStop.stopLocation !== updatedStop.stopLocation) {
          diffs.push({ field: 'stopLocation', fieldLabel: 'Stop Location', oldValue: oldStop.stopLocation, newValue: updatedStop.stopLocation });
        }
        if (oldStop.stopType !== updatedStop.stopType) {
          diffs.push({ field: 'stopType', fieldLabel: 'Stop Type', oldValue: oldStop.stopType, newValue: updatedStop.stopType });
        }
        if (oldStop.runDays !== updatedStop.runDays) {
          diffs.push({ field: 'runDays', fieldLabel: 'Operating Days', oldValue: oldStop.runDays, newValue: updatedStop.runDays });
        }
        if (oldStop.effectiveDate !== updatedStop.effectiveDate) {
          diffs.push({ field: 'effectiveDate', fieldLabel: 'Effective Date', oldValue: oldStop.effectiveDate, newValue: updatedStop.effectiveDate });
        }
        if (oldStop.retireDate !== updatedStop.retireDate) {
          diffs.push({ field: 'retireDate', fieldLabel: 'Retire Date', oldValue: oldStop.retireDate, newValue: updatedStop.retireDate });
        }
        if ((oldStop.comment || '') !== (updatedStop.comment || '')) {
          diffs.push({ field: 'comment', fieldLabel: 'Comment', oldValue: oldStop.comment || '', newValue: updatedStop.comment || '' });
        }
      }

      if (diffs.length > 0) {
        const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
        const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
        const actorRole = currentUser?.role || 'dispatcher';
        const actorEmail = currentUser?.email || undefined;

        RouteAuditService.logRouteChange({
          routeId: route.id,
          routeNo: route.routeNo,
          routeName: route.routeName,
          category: 'stop',
          action: 'update',
          shiftId,
          shiftType: targetShift.shiftType,
          stopId: updatedStop.stopId,
          stopSequence: updatedStop.sequence,
          stopLocation: updatedStop.stopLocation,
          summary: `Modified Stop #${updatedStop.sequence} (${updatedStop.stopLocation}): ${diffs.map((d) => `${d.fieldLabel} (${d.oldValue || 'None'} -> ${d.newValue || 'None'})`).join(', ')}`,
          diffs,
          userId: actorId,
          userName: actorName,
          userEmail: actorEmail,
          userRole: actorRole
        }).catch((err) => console.warn('[RouteDetailDrawer] Stop audit warning:', err));
      }

      const refreshed = await RouteService.getShiftsForRoute(route.id);
      setShifts(refreshed);
    }
  };

  useEffect(() => {
    if (route) {
      setLoadingShifts(true);
      RouteService.getShiftsForRoute(route.id)
        .then((data) => {
          setShifts(data);
          if (data.length > 0) {
            setActiveShiftId(data[0].id);
          }
        })
        .catch((err) => {
          console.error('Failed loading shifts:', err);
        })
        .finally(() => {
          setLoadingShifts(false);
        });
    } else {
      setShifts([]);
      setActiveShiftId('');
    }
  }, [route]);

  if (!route) return null;

  const currentShift = shifts.find((s) => s.id === activeShiftId) || shifts[0];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 text-slate-100 h-full overflow-y-auto shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/90 sticky top-0 backdrop-blur z-10 gap-2">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-lg sm:text-xl shadow-lg shadow-amber-500/20 shrink-0">
                <Bus className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{route.routeNo}</h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                      route.active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {route.active ? 'Active' : 'Inactive'}
                  </span>
                  {route.schoolBoardCode && (
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                      {route.schoolBoardCode}
                    </span>
                  )}
                  {isAutoMarryupEnabled(route) ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Auto Marryup
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      No Marryup
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium truncate">{route.routeName}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 mt-1">
                  <span className="flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{route.yardName || 'HQ-Central'}</span>
                  </span>
                  <span>•</span>
                  <span>{route.totalStops} Stops</span>
                  <span>•</span>
                  <span>{route.totalStudents} Riders</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Tabs: Itinerary vs Audit History */}
          <div className="flex items-center space-x-2 px-4 sm:px-6 pt-3 border-b border-slate-800 bg-slate-900/90">
            <button
              type="button"
              onClick={() => setActiveTab('itinerary')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
                activeTab === 'itinerary'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Shift Itinerary & Stops</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
                activeTab === 'audit'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Route Audit & Change History</span>
            </button>
          </div>

          {activeTab === 'audit' ? (
            <div className="p-4 sm:p-6">
              <RouteAuditHistoryPanel
                routeId={route.id}
                routeNo={route.routeNo}
                routeName={route.routeName}
              />
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Crew Assignment Header & Action */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Assigned Crew & Fleet Unit
                </span>
                {onAssignCrew && (
                  <button
                    onClick={() => onAssignCrew(route)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Assign / Edit Crew</span>
                  </button>
                )}
              </div>

              {/* Crew Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Driver */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Driver</div>
                    <div className="font-bold text-white text-xs sm:text-sm truncate">
                      {route.driverName || 'Unassigned'}
                    </div>
                    {route.driverPhone && (
                      <a
                        href={`tel:${route.driverPhone}`}
                        className="text-amber-400 hover:underline text-[11px] font-mono flex items-center space-x-1 mt-0.5"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{route.driverPhone}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Attendant */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Attendant</div>
                    <div className="font-bold text-white text-xs sm:text-sm truncate">
                      {route.attendantName || 'None'}
                    </div>
                    {route.attendantPhone ? (
                      <a
                        href={`tel:${route.attendantPhone}`}
                        className="text-indigo-400 hover:underline text-[11px] font-mono flex items-center space-x-1 mt-0.5"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{route.attendantPhone}</span>
                      </a>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic mt-0.5">No monitor</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Shift Tabs (AM, NOON, PM, etc.) */}
            <div>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
                {shifts.map((s) => {
                  const opDays = formatOpDays(s.runDays);
                  const isSelected = s.id === currentShift?.id;
                  const isEarly = opDays === '----F' || s.shiftType.toUpperCase().includes('NOON');
                  const badgeStyle = getShiftBadgeStyle(s.shiftType, opDays);

                  return (
                    <div
                      key={s.id}
                      className={`inline-flex items-center rounded-xl p-0.5 border transition ${
                        isSelected
                          ? isEarly
                            ? 'bg-purple-500/20 border-purple-400/50'
                            : 'bg-amber-500/10 border-amber-400/50'
                          : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveShiftId(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 ${
                          isSelected
                            ? isEarly
                              ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                              : 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isSelected ? (isEarly ? 'bg-white' : 'bg-slate-950') : badgeStyle.dot}`} />
                        <span>
                          {s.shiftType}
                          {isEarly ? ' (Fri Early)' : ''}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-black/20 text-white font-bold'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {s.firstStopTime} - {s.lastStopTime}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1 rounded ${
                            isEarly
                              ? 'bg-purple-500/30 text-purple-200 font-bold'
                              : 'opacity-70'
                          }`}
                        >
                          {opDays}
                        </span>
                        {s.active === false && (
                          <span className="text-[10px] px-1 rounded bg-rose-500/20 text-rose-300 font-semibold">
                            Inactive
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingShift(s);
                        }}
                        title={`Edit ${s.shiftType} Shift`}
                        className={`px-1.5 py-1.5 mr-0.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition ${
                          isSelected ? (isEarly ? 'text-white hover:bg-purple-400/40' : 'text-slate-900 hover:bg-amber-400/50') : ''
                        }`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stops Timeline */}
            <div className="space-y-4">
              {currentShift?.isCustomCrew && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-[10px]">
                      Shift Specific Crew
                    </span>
                    <span>
                      Driver: <strong className="text-white">{currentShift.driverName || 'Unassigned'}</strong>
                      {currentShift.attendantName ? ` • Monitor: ${currentShift.attendantName}` : ''}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                  <Navigation className="w-4 h-4 text-amber-400" />
                  <span>
                    Shift Itinerary ({currentShift?.stops?.length || 0} Ordered Stops)
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* View Mode Toggle: Timeline vs Google Map */}
                  <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setDrawerMode('stops')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                        drawerMode === 'stops'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>Timeline</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerMode('map')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                        drawerMode === 'map'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Google Map</span>
                    </button>
                  </div>

                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                    Runs: {formatOpDays(currentShift?.runDays)}
                  </span>
                </div>
              </div>

              {drawerMode === 'map' ? (
                <ShiftGoogleMapView
                  shift={currentShift}
                  route={route}
                  studentsMap={studentsMap}
                  showBus={false}
                  onSelectStudent={onSelectStudent}
                  onUpdateShift={(updatedShift) => {
                    if (updatedShift) {
                      setShifts((prev) =>
                        prev.map((s) => (s.id === updatedShift.id ? updatedShift : s))
                      );
                    }
                  }}
                  height="520px"
                />
              ) : loadingShifts ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-xs">Loading shift itinerary and stops...</div>
                </div>
              ) : currentShift && currentShift.stops && currentShift.stops.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                  {currentShift.stops.map((stop: RouteStop) => {
                    const isSchool =
                      stop.stopType === 'SchoolDropoff' || stop.stopType === 'SchoolPickup';

                    return (
                      <div key={stop.stopId} className="relative group">
                        {/* Timeline Node Icon */}
                        <div
                          className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                            isSchool
                              ? 'bg-sky-500 border-sky-300 text-white'
                              : 'bg-amber-500 border-amber-300 text-slate-950'
                          }`}
                        >
                          {stop.sequence}
                        </div>

                        {/* Stop Card */}
                        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-2 hover:border-slate-700 transition">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-white text-xs sm:text-sm flex items-center space-x-2">
                                <span>{stop.stopLocation}</span>
                                {isSchool && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center space-x-1">
                                    <SchoolIcon className="w-3 h-3" />
                                    <span>School</span>
                                  </span>
                                )}
                              </div>
                              {stop.schoolName && !isSchool && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Destined for: {stop.schoolName}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-2">
                              {/* Pullaway Time Badge */}
                              <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 font-mono text-xs font-bold flex-shrink-0">
                                <Clock className="w-3 h-3 mr-1" />
                                <span>{stop.pullawayTime}</span>
                              </div>

                              {/* Edit Stop Action */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStop(stop);
                                }}
                                title={`Edit Stop #${stop.sequence}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Stop Type Tag & Dates */}
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            <span>{stop.stopType}</span>
                            {(stop.effectiveDate || stop.retireDate) && (
                              <div className="flex items-center space-x-2 font-mono text-[10px] normal-case">
                                {stop.effectiveDate && (
                                  <span className="text-emerald-400">Eff: {stop.effectiveDate}</span>
                                )}
                                {stop.retireDate && (
                                  <span className="text-rose-400">Ret: {stop.retireDate}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Assigned Students (with Single Source of Truth Phone Resolution) */}
                          {stop.assignedStudents && stop.assignedStudents.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/60 space-y-2">
                              <div className="text-[11px] font-bold text-slate-400 flex items-center space-x-1">
                                <span>Boarding Students ({stop.assignedStudents.length})</span>
                              </div>

                              <div className="space-y-1.5">
                                {stop.assignedStudents.map((stu) => {
                                  // Look up in-memory studentsMap for real-time phone & contact
                                  const master = studentsMap[stu.studentId];
                                  const phone = master?.studentPhone;
                                  const parent = master?.contacts?.find((c) => c.primaryContact) || master?.contacts?.[0];

                                  return (
                                    <div
                                      key={stu.studentId}
                                      onClick={() => master && onSelectStudent && onSelectStudent(master)}
                                      className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-amber-500/40 transition cursor-pointer"
                                    >
                                      <div>
                                        <div className="font-bold text-white text-xs flex items-center space-x-1.5">
                                          <span>{stu.studentName}</span>
                                          <span className="text-[10px] font-mono text-slate-500">
                                            #{stu.studentNo}
                                          </span>
                                          {master?.grade && (
                                            <span className="text-[10px] text-indigo-400 font-semibold">
                                              (Gr. {master.grade})
                                            </span>
                                          )}
                                        </div>

                                        {/* Parent Contact Name */}
                                        {parent && (
                                          <div className="text-[11px] text-slate-400 mt-0.5">
                                            Parent: {parent.contactName} ({parent.relationship})
                                          </div>
                                        )}
                                      </div>

                                      {/* Real-time Dynamic Phone Link */}
                                      <div className="flex items-center space-x-2">
                                        {(phone || parent?.mobilePhone) ? (
                                          <a
                                            href={`tel:${phone || parent?.mobilePhone}`}
                                            onClick={(e) => e.stopPropagation()}
                                            title="Call student/parent"
                                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-xs flex items-center space-x-1 hover:bg-amber-500 hover:text-slate-950 transition font-semibold"
                                          >
                                            <Phone className="w-3 h-3" />
                                            <span>{phone || parent?.mobilePhone}</span>
                                          </a>
                                        ) : (
                                          <span className="text-[11px] text-slate-600 italic">No Phone</span>
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
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
                  No stops found for this shift.
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
          >
            Close Itinerary
          </button>
        </div>
      </div>

      {/* Edit Shift Modal */}
      <ShiftEditModal
        isOpen={!!editingShift}
        shift={editingShift}
        onClose={() => setEditingShift(null)}
        onSave={handleSaveShift}
      />

      {/* Edit Stop Modal */}
      <StopEditModal
        isOpen={!!editingStop}
        shift={currentShift}
        stop={editingStop}
        onClose={() => setEditingStop(null)}
        onSave={handleSaveStop}
      />
    </div>
  );
};
