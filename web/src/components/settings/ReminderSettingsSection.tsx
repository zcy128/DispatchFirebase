import React, { memo, useEffect, useState } from 'react';
import {
  getCheckInReminderSettings,
  saveCheckInReminderSettings,
} from '../../services/dispatchSettingsApi';
import { CheckInReminderSettings } from '../../types/dispatch';
import { useScheduledReset } from './useScheduledReset';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  RotateCcw,
  Save,
  Wrench
} from 'lucide-react';

export const ReminderSettingsSection = memo(function ReminderSettingsSection() {
  const scheduleReset = useScheduledReset();
  const [reminderSettings, setReminderSettings] = useState<CheckInReminderSettings>({
    enabled: true,
    reminderGraceMinutes: 20,
    pretripReminderGraceMinutes: 60,
    reminderWindowStart: '06:00',
    reminderWindowEnd: '18:00',
  });
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  useEffect(() => {
    getCheckInReminderSettings()
      .then((settings) => {
        setReminderSettings({
          enabled: settings.enabled ?? true,
          reminderGraceMinutes: settings.reminderGraceMinutes || 20,
          pretripReminderGraceMinutes: settings.pretripReminderGraceMinutes || 60,
          reminderWindowStart: settings.reminderWindowStart || '06:00',
          reminderWindowEnd: settings.reminderWindowEnd || '18:00',
          updatedAt: settings.updatedAt,
        });
      })
      .catch((err) => console.error('Failed to load check-in reminder settings in SettingsView:', err));
  }, []);

  const handleSaveReminderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setReminderSaving(true);
    setReminderStatus(null);
    setReminderError(null);
    try {
      const saved = await saveCheckInReminderSettings({
        ...reminderSettings,
        reminderGraceMinutes: Math.max(1, Math.min(180, Number(reminderSettings.reminderGraceMinutes) || 20)),
        pretripReminderGraceMinutes: Math.max(1, Math.min(240, Number(reminderSettings.pretripReminderGraceMinutes) || 60)),
      });
      setReminderSettings(saved);
      setReminderStatus('Reminder settings saved successfully');
      scheduleReset(() => setReminderStatus(null), 3500);
    } catch (err: any) {
      setReminderError(err.message || 'Failed to save settings');
    } finally {
      setReminderSaving(false);
    }
  };

  return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Crew Check-in FCM Reminders</h2>
              <p className="text-xs text-slate-400">
                Automated push notification policy for overdue driver & attendant check-ins
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {reminderSettings.reminderGraceMinutes} min grace period
          </span>
        </div>

        <form onSubmit={handleSaveReminderSettings} className="space-y-4 pt-1">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div>
              <span className="text-xs font-bold text-white block">Automated FCM Push Delivery</span>
              <span className="text-[11px] text-slate-400">
                Send push notifications via Google Cloud Scheduler (Mon-Fri 06:00 - 18:00)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={reminderSettings.enabled}
                onChange={(e) => setReminderSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Grace Minutes selector */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Overdue Check-in Grace Period
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              Reminder is sent when clock reaches scheduled check-in time plus this grace period. Default is 20 minutes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[10, 15, 20, 25, 30, 45].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setReminderSettings((prev) => ({ ...prev, reminderGraceMinutes: m }))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    reminderSettings.reminderGraceMinutes === m
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m} min {m === 20 ? '(Default)' : ''}
                </button>
              ))}
            </div>
            <div className="pt-2 flex items-center gap-3">
              <span className="text-xs text-slate-400">Custom minutes:</span>
              <input
                type="number"
                min="1"
                max="180"
                value={reminderSettings.reminderGraceMinutes}
                onChange={(e) => setReminderSettings((prev) => ({ ...prev, reminderGraceMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-24 px-3 py-1 text-xs font-mono rounded-lg border border-slate-700 bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Vehicle Pre-Trip Inspection Grace Period */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-400" />
                Vehicle Pre-Trip Inspection Reminder
              </label>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {reminderSettings.pretripReminderGraceMinutes ?? 60} min after check-in
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sends an FCM push reminder to the driver if pre-trip inspection for the shift vehicle has not been completed within this time after scheduled check-in. Default is 60 minutes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setReminderSettings((prev) => ({ ...prev, pretripReminderGraceMinutes: m }))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    (reminderSettings.pretripReminderGraceMinutes ?? 60) === m
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m} min {m === 60 ? '(Default)' : ''}
                </button>
              ))}
            </div>
            <div className="pt-2 flex items-center gap-3">
              <span className="text-xs text-slate-400">Custom minutes:</span>
              <input
                type="number"
                min="1"
                max="240"
                value={reminderSettings.pretripReminderGraceMinutes ?? 60}
                onChange={(e) => setReminderSettings((prev) => ({ ...prev, pretripReminderGraceMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-24 px-3 py-1 text-xs font-mono rounded-lg border border-slate-700 bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Window & Safety Notice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-amber-400 block font-bold text-[11px]">Daily Window (06:00 - 18:00)</span>
              <span className="text-slate-400 text-[11px] block">
                Evaluates shifts on weekdays during service hours. Outside this window, reminders sleep automatically.
              </span>
            </div>
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-emerald-400 block font-bold text-[11px]">Strict Idempotency</span>
              <span className="text-slate-400 text-[11px] block">
                Reminders are sent at most once per driver/vehicle per shift to prevent spam.
              </span>
            </div>
          </div>

          {/* Submit & Status */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={reminderSaving}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{reminderSaving ? 'Saving...' : 'Save Reminder Settings'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReminderSettings({
                    enabled: true,
                    reminderGraceMinutes: 20,
                    pretripReminderGraceMinutes: 60,
                    reminderWindowStart: '06:00',
                    reminderWindowEnd: '18:00',
                  });
                  setReminderStatus(null);
                  setReminderError(null);
                }}
                disabled={reminderSaving}
                className="px-3 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {reminderStatus && (
              <span className="text-xs text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{reminderStatus}</span>
              </span>
            )}
            {reminderError && (
              <span className="text-xs text-rose-400 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{reminderError}</span>
              </span>
            )}
          </div>
        </form>
      </div>
  );
});
