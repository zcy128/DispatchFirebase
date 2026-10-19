import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BusRoute, BusRouteShift, RouteStop } from '../../types/route';
import { useI18n } from '../../contexts/I18nContext';
import { RouteSettingsService, RouteOptimizationSettings } from '../../services/routeSettingsService';
import { EmployeeService } from '../../services/employeeService';
import { Employee } from '../../types/employee';
import {
  optimizeStopSequence,
  recalculateStopTimes,
  calculateTotalRouteDistance,
  OptimizationResult
} from '../../utils/routeOptimizer';
import {
  Zap,
  TrendingDown,
  Clock,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Home,
  School,
  X,
  ChevronUp,
  ChevronDown,
  Lock,
  RotateCcw
} from 'lucide-react';

interface OptimizeRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: BusRouteShift;
  route: BusRoute;
  onApplyOptimizedStops: (optimizedStops: RouteStop[]) => Promise<void>;
}

export const OptimizeRouteModal: React.FC<OptimizeRouteModalProps> = ({
  isOpen,
  onClose,
  shift,
  route,
  onApplyOptimizedStops
}) => {
  const { t } = useI18n();

  const [settings, setSettings] = useState<RouteOptimizationSettings>({
    defaultStopDwellMinutes: 3,
    averageSpeedKmH: 30,
    recalculateTimesDefault: true,
    includeDriverHomeDefault: false
  });

  const [driver, setDriver] = useState<Employee | null>(null);
  const [includeDriverHome, setIncludeDriverHome] = useState(false);
  const [recalculateTimes, setRecalculateTimes] = useState(true);

  // Editable working copy of optimized stops to allow manual up/down overrides
  const [workingStops, setWorkingStops] = useState<RouteStop[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Original stops sorted by sequence
  const originalStops = useMemo(() => {
    return [...(shift?.stops || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }, [shift]);

  // Load settings & driver info on mount
  useEffect(() => {
    if (!isOpen) return;

    RouteSettingsService.getSettings()
      .then((s) => {
        setSettings(s);
        setRecalculateTimes(s.recalculateTimesDefault);
        setIncludeDriverHome(s.includeDriverHomeDefault);
      })
      .catch(console.error);

    const driverId = shift?.driverId || route?.driverId;
    if (driverId) {
      EmployeeService.list()
        .then((emps) => {
          const match = emps.find(
            (e) => e.id === driverId || e.employeeNumber === driverId || String(e.employeeId) === driverId
          );
          if (match) setDriver(match);
        })
        .catch(console.error);
    }
  }, [isOpen, shift, route]);

  // Compute driver coords if available
  const driverCoords = useMemo(() => {
    if (driver?.lat && driver?.lng) {
      return { lat: driver.lat, lng: driver.lng };
    }
    return null;
  }, [driver]);

  // Run the initial 2-Opt optimization
  const initialOptimizationResult = useMemo<OptimizationResult>(() => {
    return optimizeStopSequence(originalStops, {
      shiftType: shift?.shiftType || 'AM',
      driverCoords,
      includeDriverHome: includeDriverHome && !!driverCoords,
      recalculateTimes,
      dwellMinutes: settings.defaultStopDwellMinutes,
      averageSpeedKmH: settings.averageSpeedKmH,
      schoolBoardOrRouteName: route?.schoolBoardCode || route?.routeName
    });
  }, [originalStops, shift?.shiftType, driverCoords, includeDriverHome, recalculateTimes, settings, route]);

  // Sync workingStops when optimization result changes
  useEffect(() => {
    setWorkingStops(initialOptimizationResult.optimizedStops);
  }, [initialOptimizationResult]);

  // Re-calculate metrics live based on current workingStops
  const currentMetrics = useMemo(() => {
    const origDist = initialOptimizationResult.originalDistanceMeters;
    const currentDist = calculateTotalRouteDistance(workingStops, route?.schoolBoardCode || route?.routeName);
    const saved = Math.max(0, origDist - currentDist);
    const pct = origDist > 0 ? Math.round((saved / origDist) * 1000) / 10 : 0;
    const origDur = initialOptimizationResult.originalDurationMinutes;
    const curDur =
      Math.round((currentDist / 1000 / settings.averageSpeedKmH) * 60) +
      workingStops.length * settings.defaultStopDwellMinutes;

    return {
      originalDistanceKm: Math.round((origDist / 1000) * 10) / 10,
      currentDistanceKm: Math.round((currentDist / 1000) * 10) / 10,
      savedDistanceKm: Math.round((saved / 1000) * 10) / 10,
      savingsPercentage: pct,
      originalDurationMin: origDur,
      currentDurationMin: curDur
    };
  }, [workingStops, initialOptimizationResult, settings, route]);

  // Manual Move Up: swap stop at index with index - 1
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const nextStops = [...workingStops];
    const temp = nextStops[index - 1];
    nextStops[index - 1] = nextStops[index];
    nextStops[index] = temp;

    if (recalculateTimes) {
      const recalculated = recalculateStopTimes(
        nextStops,
        settings.defaultStopDwellMinutes,
        settings.averageSpeedKmH,
        route?.schoolBoardCode || route?.routeName,
        shift?.shiftType
      );
      setWorkingStops(recalculated);
    } else {
      setWorkingStops(nextStops.map((s, idx) => ({ ...s, sequence: idx + 1 })));
    }
  };

  // Manual Move Down: swap stop at index with index + 1
  const handleMoveDown = (index: number) => {
    if (index >= workingStops.length - 1) return;
    const nextStops = [...workingStops];
    const temp = nextStops[index + 1];
    nextStops[index + 1] = nextStops[index];
    nextStops[index] = temp;

    if (recalculateTimes) {
      const recalculated = recalculateStopTimes(
        nextStops,
        settings.defaultStopDwellMinutes,
        settings.averageSpeedKmH,
        route?.schoolBoardCode || route?.routeName,
        shift?.shiftType
      );
      setWorkingStops(recalculated);
    } else {
      setWorkingStops(nextStops.map((s, idx) => ({ ...s, sequence: idx + 1 })));
    }
  };

  // Reset to initial 2-Opt result
  const handleResetToAuto = () => {
    setWorkingStops(initialOptimizationResult.optimizedStops);
  };

  // Apply and save
  const handleApply = async () => {
    setIsApplying(true);
    setError(null);
    try {
      await onApplyOptimizedStops(workingStops);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to apply optimized sequence');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>{t.stops.optimizeModalTitle}</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {shift.shiftType} Shift • {route.routeNo}
                </span>
              </h3>
              <p className="text-xs text-slate-400">{t.stops.optimizeModalSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI Metrics Comparison Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Distance Comparison Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1 relative overflow-hidden">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>Total Transit Distance</span>
                <Navigation className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-mono font-bold text-emerald-400">
                  {currentMetrics.currentDistanceKm} km
                </span>
                <span className="text-xs font-mono text-slate-500 line-through">
                  {currentMetrics.originalDistanceKm} km
                </span>
              </div>
              <div className="text-[11px] font-semibold text-emerald-400 flex items-center space-x-1">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>
                  Saved {currentMetrics.savedDistanceKm} km ({currentMetrics.savingsPercentage}%)
                </span>
              </div>
            </div>

            {/* Duration Estimation Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>Estimated Shift Duration</span>
                <Clock className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-mono font-bold text-sky-400">
                  ~{currentMetrics.currentDurationMin} min
                </span>
                <span className="text-xs font-mono text-slate-500 line-through">
                  ~{currentMetrics.originalDurationMin} min
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Includes {settings.defaultStopDwellMinutes} min dwell time per stop
              </div>
            </div>

            {/* Algorithm Info Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>Optimizer Engine</span>
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xs font-bold text-slate-200">
                Constrained 2-Opt Geometric TSP
              </div>
              <div className="text-[11px] text-slate-500">
                Zero external API cost • Un-crosses zigzag routes locally
              </div>
            </div>
          </div>

          {/* Interactive Options Bar */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Recalculate Departure Times Option */}
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recalculateTimes}
                  onChange={(e) => setRecalculateTimes(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    {t.stops.recalculateTimesLabel}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {t.stops.recalculateTimesHelp} ({settings.defaultStopDwellMinutes}m dwell)
                  </span>
                </div>
              </label>

              {/* Driver Home Anchor Option */}
              {driver && (
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeDriverHome}
                    onChange={(e) => setIncludeDriverHome(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block flex items-center gap-1">
                      <Home className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t.stops.includeDriverHomeLabel}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {driver.fullName} ({driver.personalAddress || 'Home Address'})
                    </span>
                  </div>
                </label>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetToAuto}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Auto TSP</span>
            </button>
          </div>

          {/* Sequence Comparison Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Original Sequence */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>{t.stops.originalSequence} ({originalStops.length} stops)</span>
                <span className="text-slate-500 font-mono normal-case">{currentMetrics.originalDistanceKm} km</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {originalStops.map((stop, idx) => {
                  const isSchool = stop.stopType === 'SchoolDropoff' || stop.stopType === 'SchoolPickup';
                  const studentName = stop.assignedStudents?.[0]?.studentName;

                  return (
                    <div
                      key={stop.stopId || idx}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between space-x-3 text-xs"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 font-mono text-[11px] font-bold text-slate-400 flex items-center justify-center shrink-0">
                          {stop.sequence || idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-300 truncate flex items-center space-x-1.5">
                            {isSchool ? (
                              <School className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : null}
                            <span>{isSchool ? stop.schoolName || stop.stopLocation : studentName || stop.stopLocation}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{stop.stopLocation}</div>
                        </div>
                      </div>

                      <span className="font-mono text-slate-400 font-semibold shrink-0">
                        {stop.pullawayTime || '--:--'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Suggested Optimized Sequence (with manual reordering) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <span className="flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>{t.stops.suggestedSequence}</span>
                </span>
                <span className="text-emerald-400 font-mono normal-case font-bold">
                  {currentMetrics.currentDistanceKm} km (-{currentMetrics.savingsPercentage}%)
                </span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {workingStops.map((stop, idx) => {
                  const isSchool = stop.stopType === 'SchoolDropoff' || stop.stopType === 'SchoolPickup';
                  const studentName = stop.assignedStudents?.[0]?.studentName;
                  const isFirst = idx === 0;
                  const isLast = idx === workingStops.length - 1;

                  return (
                    <div
                      key={stop.stopId || idx}
                      className={`p-3 rounded-xl border flex items-center justify-between space-x-3 text-xs transition ${
                        isSchool
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : 'bg-emerald-950/20 border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate flex items-center space-x-1.5">
                            {isSchool ? (
                              <School className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : null}
                            <span>{isSchool ? stop.schoolName || stop.stopLocation : studentName || stop.stopLocation}</span>
                            {isSchool && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Anchor</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{stop.stopLocation}</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="font-mono text-emerald-300 font-bold">
                          {stop.pullawayTime || '--:--'}
                        </span>

                        {/* Manual Move Up / Move Down Buttons (Parent Special Request Overrides) */}
                        <div className="flex flex-col space-y-0.5">
                          <button
                            type="button"
                            title={t.stops.moveUp}
                            disabled={isFirst || (isSchool && isFirst)}
                            onClick={() => handleMoveUp(idx)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            title={t.stops.moveDown}
                            disabled={isLast || (isSchool && isLast)}
                            onClick={() => handleMoveDown(idx)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Click ▲ / ▼ on any stop to manually adjust order for special requests.
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              {t.stops.cancel}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>{isApplying ? t.stops.optimizingStatus : t.stops.applyOptimizedOrder}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
