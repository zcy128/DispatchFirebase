import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { CheckInReminderSettings } from '../../types/dispatch';
import { DispatchService } from '../../services/dispatchService';

interface CheckInReminderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (settings: CheckInReminderSettings) => void;
}

const PRESET_MINUTES = [10, 15, 20, 25, 30, 45];
const PRESET_PRETRIP_MINUTES = [30, 45, 60, 90, 120];

export const CheckInReminderSettingsModal: React.FC<CheckInReminderSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Settings form state
  const [enabled, setEnabled] = useState(true);
  const [graceMinutes, setGraceMinutes] = useState(20);
  const [pretripGraceMinutes, setPretripGraceMinutes] = useState(60);
  const [windowStart, setWindowStart] = useState('06:00');
  const [windowEnd, setWindowEnd] = useState('18:00');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    DispatchService.getCheckInReminderSettings()
      .then((settings) => {
        if (!isMounted) return;
        setEnabled(settings.enabled ?? true);
        setGraceMinutes(settings.reminderGraceMinutes || 20);
        setPretripGraceMinutes(settings.pretripReminderGraceMinutes || 60);
        setWindowStart(settings.reminderWindowStart || '06:00');
        setWindowEnd(settings.reminderWindowEnd || '18:00');
        setLastUpdated(settings.updatedAt || null);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load check-in reminder settings:', err);
        // Fallback default
        setEnabled(true);
        setGraceMinutes(20);
        setPretripGraceMinutes(60);
        setWindowStart('06:00');
        setWindowEnd('18:00');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const safeMinutes = Math.max(1, Math.min(180, Number(graceMinutes) || 20));
    const safePretripMinutes = Math.max(1, Math.min(240, Number(pretripGraceMinutes) || 60));

    const payload: CheckInReminderSettings = {
      enabled,
      reminderGraceMinutes: safeMinutes,
      pretripReminderGraceMinutes: safePretripMinutes,
      reminderWindowStart: windowStart.trim() || '06:00',
      reminderWindowEnd: windowEnd.trim() || '18:00',
    };

    try {
      const saved = await DispatchService.saveCheckInReminderSettings(payload);
      setSuccessMsg('Settings saved successfully!');
      setLastUpdated(saved.updatedAt || new Date().toISOString());
      if (onSettingsSaved) {
        onSettingsSaved(saved);
      }
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save check-in reminder settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setEnabled(true);
    setGraceMinutes(20);
    setPretripGraceMinutes(60);
    setWindowStart('06:00');
    setWindowEnd('18:00');
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Crew Check-in Reminder Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure FCM push notification timing for overdue drivers & attendants
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Clock className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs">Loading reminder settings...</p>
            </div>
          ) : (
            <>
              {/* Enabled Switch */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Automated FCM Reminders
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Send push notification when crew members miss scheduled check-in
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Grace Minutes Configuration */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Late Check-in Grace Period
                  </label>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {graceMinutes} minutes overdue
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  A reminder is triggered when current time reaches scheduled check-in time + grace period.
                </p>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESET_MINUTES.map((m) => {
                    const isSelected = graceMinutes === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setGraceMinutes(m)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs'
                            : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {m} min {m === 20 ? '(Default)' : ''}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Input */}
                <div className="pt-2 flex items-center gap-3">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Custom minutes:</span>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={graceMinutes}
                    onChange={(e) => setGraceMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-400">(1 - 180 min)</span>
                </div>
              </div>

              {/* Vehicle Pre-Trip Inspection Grace Period */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    Vehicle Pre-Trip Inspection Reminder
                  </label>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {pretripGraceMinutes} min after check-in
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sends a one-time FCM push reminder to the driver if pre-trip inspection for the shift vehicle has not been submitted within this time after scheduled check-in.
                </p>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESET_PRETRIP_MINUTES.map((m) => {
                    const isSelected = pretripGraceMinutes === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPretripGraceMinutes(m)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs'
                            : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {m} min {m === 60 ? '(Default)' : ''}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Input */}
                <div className="pt-2 flex items-center gap-3">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Custom minutes:</span>
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={pretripGraceMinutes}
                    onChange={(e) => setPretripGraceMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-400">(1 - 240 min)</span>
                </div>
              </div>

              {/* Operational Reminder Window */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Operational Window (Mon - Fri)
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cloud Scheduler runs every minute during this time window.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                      Start Time (HH:mm)
                    </label>
                    <input
                      type="text"
                      value={windowStart}
                      onChange={(e) => setWindowStart(e.target.value)}
                      placeholder="06:00"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                      End Time (HH:mm)
                    </label>
                    <input
                      type="text"
                      value={windowEnd}
                      onChange={(e) => setWindowEnd(e.target.value)}
                      placeholder="18:00"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Safety & Idempotency Notice */}
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">Idempotency & Privacy Protection</div>
                  <div className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300/80">
                    Reminders are strictly sent at most once per driver/attendant per shift. Only active employees with registered FCM device tokens receive push messages.
                  </div>
                </div>
              </div>

              {/* Feedback messages */}
              {successMsg && (
                <div className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {lastUpdated && (
                <div className="text-[11px] text-slate-400 text-right">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={loading || saving}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading || saving}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
