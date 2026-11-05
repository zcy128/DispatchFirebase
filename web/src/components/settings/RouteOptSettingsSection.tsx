import React, { memo, useEffect, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { RouteOptimizationSettings, RouteSettingsService } from '../../services/routeSettingsService';
import { useScheduledReset } from './useScheduledReset';
import {
  AlertCircle,
  CheckCircle2,
  Navigation,
  RotateCcw,
  Save
} from 'lucide-react';

export const RouteOptSettingsSection = memo(function RouteOptSettingsSection() {
  const { t } = useI18n();
  const scheduleReset = useScheduledReset();
  const [routeOptSettings, setRouteOptSettings] = useState<RouteOptimizationSettings>({
    defaultStopDwellMinutes: 3,
    averageSpeedKmH: 30,
    recalculateTimesDefault: true,
    includeDriverHomeDefault: false,
  });
  const [routeOptSaving, setRouteOptSaving] = useState(false);
  const [routeOptStatus, setRouteOptStatus] = useState<string | null>(null);
  const [routeOptError, setRouteOptError] = useState<string | null>(null);

  useEffect(() => {
    RouteSettingsService.getSettings()
      .then(setRouteOptSettings)
      .catch((err) => console.error('Failed to load route optimization settings:', err));
  }, []);

  const handleSaveRouteOptSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setRouteOptSaving(true);
    setRouteOptStatus(null);
    setRouteOptError(null);
    try {
      const saved = await RouteSettingsService.saveSettings(routeOptSettings);
      setRouteOptSettings(saved);
      setRouteOptStatus(t.stops.routeSettingsSaved || 'Route optimization settings saved successfully.');
      scheduleReset(() => setRouteOptStatus(null), 3500);
    } catch (err: any) {
      setRouteOptError(err.message || 'Failed to save route optimization settings');
    } finally {
      setRouteOptSaving(false);
    }
  };

  return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{t.stops.routeSettingsTitle}</h2>
            <p className="text-xs text-slate-400">
              Configure default stop dwell duration for boarding/alighting, urban transit speed, and sequence optimization options.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveRouteOptSettings} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Default Stop Dwell Minutes */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{t.stops.defaultDwellMinutesLabel}</span>
                <span className="font-mono text-emerald-400 font-bold">{routeOptSettings.defaultStopDwellMinutes} min</span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 8].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRouteOptSettings((prev) => ({ ...prev, defaultStopDwellMinutes: m }))}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                      routeOptSettings.defaultStopDwellMinutes === m
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={15}
                value={routeOptSettings.defaultStopDwellMinutes}
                onChange={(e) =>
                  setRouteOptSettings((prev) => ({
                    ...prev,
                    defaultStopDwellMinutes: Math.max(1, Math.min(15, parseInt(e.target.value) || 3))
                  }))
                }
                className="w-full mt-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Scheduled boarding and alighting delay allocated per stop during automatic time recomputation.
              </p>
            </div>

            {/* Average Transit Speed */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{t.stops.avgSpeedLabel}</span>
                <span className="font-mono text-emerald-400 font-bold">{routeOptSettings.averageSpeedKmH} km/h</span>
              </label>
              <div className="flex items-center gap-2">
                {[25, 30, 35, 40, 50].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRouteOptSettings((prev) => ({ ...prev, averageSpeedKmH: s }))}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                      routeOptSettings.averageSpeedKmH === s
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {s} km/h
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={15}
                max={80}
                value={routeOptSettings.averageSpeedKmH}
                onChange={(e) =>
                  setRouteOptSettings((prev) => ({
                    ...prev,
                    averageSpeedKmH: Math.max(15, Math.min(80, parseInt(e.target.value) || 30))
                  }))
                }
                className="w-full mt-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Estimated average driving speed in suburban/urban areas used for leg travel time estimations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recalculate Stop Times Default */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 flex items-start space-x-3">
              <input
                type="checkbox"
                id="recalcTimesDefault"
                checked={routeOptSettings.recalculateTimesDefault}
                onChange={(e) =>
                  setRouteOptSettings((prev) => ({
                    ...prev,
                    recalculateTimesDefault: e.target.checked
                  }))
                }
                className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="recalcTimesDefault" className="text-xs cursor-pointer select-none">
                <span className="font-bold text-slate-200 block">{t.stops.recalculateTimesLabel}</span>
                <span className="text-slate-400 text-[11px]">
                  Automatically recompute pullaway and arrival times whenever stops are reordered or moved.
                </span>
              </label>
            </div>

            {/* Include Driver Home Default */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 flex items-start space-x-3">
              <input
                type="checkbox"
                id="driverHomeDefault"
                checked={routeOptSettings.includeDriverHomeDefault}
                onChange={(e) =>
                  setRouteOptSettings((prev) => ({
                    ...prev,
                    includeDriverHomeDefault: e.target.checked
                  }))
                }
                className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="driverHomeDefault" className="text-xs cursor-pointer select-none">
                <span className="font-bold text-slate-200 block">{t.stops.includeDriverHomeLabel}</span>
                <span className="text-slate-400 text-[11px]">
                  {t.stops.includeDriverHomeHelp}
                </span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={routeOptSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{routeOptSaving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRouteOptSettings({
                    defaultStopDwellMinutes: 3,
                    averageSpeedKmH: 30,
                    recalculateTimesDefault: true,
                    includeDriverHomeDefault: false
                  });
                  setRouteOptStatus(null);
                  setRouteOptError(null);
                }}
                disabled={routeOptSaving}
                className="px-3 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {routeOptStatus && (
              <span className="text-xs text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{routeOptStatus}</span>
              </span>
            )}
            {routeOptError && (
              <span className="text-xs text-rose-400 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{routeOptError}</span>
              </span>
            )}
          </div>
        </form>
      </div>
  );
});
