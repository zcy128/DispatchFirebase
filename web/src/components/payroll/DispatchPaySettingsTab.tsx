import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, Save, RotateCcw, CheckCircle2, AlertCircle, HelpCircle, Shield, User, HeartHandshake, Stethoscope } from 'lucide-react';
import { DispatchPayrollSettings, RolePayrollRateSetting } from '../../types/dispatch';
import { DispatchService } from '../../services/dispatchService';

const DEFAULT_SETTINGS: DispatchPayrollSettings = {
  driver: {
    role: 'driver',
    roleLabel: 'Driver',
    partialPayRate: 25.0,
    doublePartialPayRate: 50.0,
    defaultEiHours: 3.0,
    noPayRate: 0.0,
    noPayEiHours: 0.0,
  },
  attendant: {
    role: 'attendant',
    roleLabel: 'Attendant',
    partialPayRate: 20.0,
    doublePartialPayRate: 40.0,
    defaultEiHours: 2.0,
    noPayRate: 0.0,
    noPayEiHours: 0.0,
  },
  nurse: {
    role: 'nurse',
    roleLabel: 'Nurse / LPN',
    partialPayRate: 30.0,
    doublePartialPayRate: 60.0,
    defaultEiHours: 3.0,
    noPayRate: 0.0,
    noPayEiHours: 0.0,
  },
};

export const DispatchPaySettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<DispatchPayrollSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DispatchService.getPayrollSettings();
      if (data && data.driver) {
        setSettings({
          driver: { ...DEFAULT_SETTINGS.driver, ...data.driver },
          attendant: { ...DEFAULT_SETTINGS.attendant, ...data.attendant },
          nurse: { ...DEFAULT_SETTINGS.nurse, ...data.nurse },
          updatedAt: data.updatedAt,
        });
      }
    } catch (err) {
      console.error('Failed to load dispatch payroll settings:', err);
      setError('Failed to load dispatch payroll settings. Falling back to presets.');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (
    role: 'driver' | 'attendant' | 'nurse',
    field: keyof RolePayrollRateSetting,
    value: number
  ) => {
    setSettings((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value,
      },
    }));
    setSavedSuccess(false);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset dispatch payroll rates to default settings?')) {
      setSettings(DEFAULT_SETTINGS);
      setSavedSuccess(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await DispatchService.savePayrollSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to save dispatch payroll settings:', err);
      setError((err as Error).message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <DollarSign className="w-8 h-8 animate-pulse mx-auto mb-2 text-amber-500" />
        <p className="text-sm">Loading dispatch payroll settings...</p>
      </div>
    );
  }

  const roleConfigs = [
    {
      key: 'driver' as const,
      title: 'Bus Driver Rates',
      icon: User,
      color: 'blue',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    },
    {
      key: 'attendant' as const,
      title: 'Attendant Rates',
      icon: HeartHandshake,
      color: 'emerald',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    {
      key: 'nurse' as const,
      title: 'Nurse / LPN Rates',
      icon: Stethoscope,
      color: 'purple',
      badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Informational Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-sm">Dispatch Payroll Comment Settings</p>
          <p>
            Configure default Partial Pay, Double Partial Pay, and Employment Insurance (EI) hours for daily dispatch shifts. When a dispatcher assigns crew or overrides rates in the Dispatch Workbench, these standard rates are automatically offered in the Dispatch Payroll Comment selector.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-bold">Dispatch payroll settings saved successfully!</span>
        </div>
      )}

      {/* 3 Role Rate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {roleConfigs.map(({ key, title, icon: Icon, badgeClass }) => {
          const roleData = settings[key];
          return (
            <div
              key={key}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 hover:border-amber-300 dark:hover:border-slate-700 transition"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h4>
                    <p className="text-[11px] text-slate-400 capitalize">{roleData.roleLabel}</p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                  Configured
                </span>
              </div>

              {/* Partial Pay Field */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Partial Pay (PD)
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={roleData.partialPayRate}
                    onChange={(e) =>
                      handleFieldChange(key, 'partialPayRate', parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400">Standard single partial run compensation</p>
              </div>

              {/* Double Partial Pay Field */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Double Partial Pay (DD)
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={roleData.doublePartialPayRate}
                    onChange={(e) =>
                      handleFieldChange(key, 'doublePartialPayRate', parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400">Combined double partial run compensation</p>
              </div>

              {/* Default EI Hours Field */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Default EI Hours
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={roleData.defaultEiHours}
                    onChange={(e) =>
                      handleFieldChange(key, 'defaultEiHours', parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="0.0"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400">Insurable hours reported for this role</p>
              </div>

              {/* Preview Dropdown Options */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-400 block uppercase tracking-wider text-[10px]">
                  Dropdown Option Preview:
                </span>
                <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold">
                    PD ${roleData.partialPayRate.toFixed(2)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
                    DD ${roleData.doublePartialPayRate.toFixed(2)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
                    NP ($0.00)
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                    F (Flat)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Static Rule Note: No Pay & Flat Rate */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-500" />
          <span>Standard Dispatch Rate Codes</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">No Pay (NP)</span>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Rate is set to <strong>$0.00</strong> and EI Hours to <strong>0.0h</strong>. Used for cancellations, unworked shifts, or non-billable dispatch assignments.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">Flat Rate (F)</span>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Allows the dispatcher to input a custom fixed dollar rate and custom EI hours directly from the Dispatch Workbench for special operational cases.
            </p>
          </div>
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleResetDefaults}
          className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-800"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Defaults</span>
        </button>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm hover:shadow transition flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Dispatch Settings'}</span>
        </button>
      </div>
    </form>
  );
};
