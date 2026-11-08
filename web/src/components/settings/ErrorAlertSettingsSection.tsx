import React, { memo, useEffect, useState } from 'react';
import {
  getErrorAlertSettings,
  saveErrorAlertSettings,
  ErrorAlertSettings,
} from '../../services/clientErrorReporter';
import { useScheduledReset } from './useScheduledReset';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Save,
} from 'lucide-react';

const ALERT_PAGES: Array<{ id: string; label: string }> = [
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'charter', label: 'Charter' },
  { id: 'routes', label: 'Routes' },
  { id: 'students', label: 'Students' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'hazards', label: 'Hazard Reports' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'time_off', label: 'Time Off' },
  { id: 'pretrip_checks', label: 'Pre-Trip Inspections' },
  { id: 'vehicle_signouts', label: 'Vehicle Handover' },
];

const DEFAULT_PAGES: Record<string, boolean> = Object.fromEntries(
  ALERT_PAGES.map((p) => [p.id, false])
);

function parseRecipients(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export const ErrorAlertSettingsSection = memo(function ErrorAlertSettingsSection() {
  const scheduleReset = useScheduledReset();
  const [recipientsText, setRecipientsText] = useState('');
  const [pages, setPages] = useState<Record<string, boolean>>({ ...DEFAULT_PAGES });
  const [throttleMinutes, setThrottleMinutes] = useState(5);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getErrorAlertSettings()
      .then((settings: ErrorAlertSettings) => {
        setRecipientsText((settings.recipients || []).join('\n'));
        setPages({ ...DEFAULT_PAGES, ...(settings.pages || {}) });
        setThrottleMinutes(settings.throttleMinutes > 0 ? settings.throttleMinutes : 5);
      })
      .catch((err) => {
        console.error('Failed to load error alert settings:', err);
        // Keep editable defaults so Settings remains usable if the API is mid-restart.
        setRecipientsText('');
        setPages({ ...DEFAULT_PAGES });
        setThrottleMinutes(5);
        const detail = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load error alert settings: ${detail}`);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const saved = await saveErrorAlertSettings({
        recipients: parseRecipients(recipientsText),
        pages,
        throttleMinutes: Math.max(1, Math.min(60, Number(throttleMinutes) || 5)),
      });
      setRecipientsText((saved.recipients || []).join('\n'));
      setPages({ ...DEFAULT_PAGES, ...(saved.pages || {}) });
      setThrottleMinutes(saved.throttleMinutes > 0 ? saved.throttleMinutes : 5);
      setStatus('Error alert settings saved successfully');
      scheduleReset(() => setStatus(null), 3500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save error alert settings';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const togglePage = (id: string) => {
    setPages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Client Error Email Alerts</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Log every failed web read/write, and email selected pages to the recipients below.
            Matching errors are throttled so the same failure only emails once every few minutes.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading error alert settings...</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Alert recipients
            </label>
            <textarea
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              rows={3}
              placeholder={'ops@example.com\ndispatch@example.com'}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              One email per line, or separate with commas.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Pages that send email
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALERT_PAGES.map((page) => (
                <label
                  key={page.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 cursor-pointer hover:border-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={!!pages[page.id]}
                    onChange={() => togglePage(page.id)}
                    className="rounded border-slate-600 text-rose-500 focus:ring-rose-500/40"
                  />
                  <span>{page.label}</span>
                  <span className="ml-auto text-[10px] font-mono text-slate-500">{page.id}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="max-w-[180px]">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Throttle (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={throttleMinutes}
              onChange={(e) => setThrottleMinutes(Number(e.target.value) || 5)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>

          {status && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{status}</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-500/30 hover:bg-rose-500/30 text-sm font-semibold disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save error alerts'}
          </button>
        </form>
      )}
    </section>
  );
});
