import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save, AlertCircle } from 'lucide-react';
import { DispatchShift, DispatchPayrollSettings } from '../../types/dispatch';
import { DispatchService } from '../../services/dispatchService';
import { Employee } from '../../types/employee';
import { useAuth } from '../../contexts/AuthContext';
import { logDispatchAction } from '../../utils/dispatchLogger';

interface DispatchPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: DispatchShift | null;
  employees?: Employee[];
  payrollSettings?: DispatchPayrollSettings | null;
  onShiftUpdated: (updatedShift: DispatchShift) => void;
}

export const DispatchPayrollModal: React.FC<DispatchPayrollModalProps> = ({
  isOpen,
  onClose,
  shift,
  employees = [],
  payrollSettings: initialSettings,
  onShiftUpdated,
}) => {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  if (!isOpen || !shift) return null;

  const [settings, setSettings] = useState<DispatchPayrollSettings | null>(initialSettings || null);
  const [driverOption, setDriverOption] = useState<string>(shift.driverPayOption || '');
  const [driverCustomAmount, setDriverCustomAmount] = useState<string>(
    shift.driverPayAmount !== undefined && shift.driverPayAmount !== null ? String(shift.driverPayAmount) : ''
  );
  const [driverCustomHours, setDriverCustomHours] = useState<string>(
    shift.driverEiHours !== undefined && shift.driverEiHours !== null ? String(shift.driverEiHours) : ''
  );

  const [attendantOption, setAttendantOption] = useState<string>(shift.attendantPayOption || '');
  const [attendantCustomAmount, setAttendantCustomAmount] = useState<string>(
    shift.attendantPayAmount !== undefined && shift.attendantPayAmount !== null ? String(shift.attendantPayAmount) : ''
  );
  const [attendantCustomHours, setAttendantCustomHours] = useState<string>(
    shift.attendantEiHours !== undefined && shift.attendantEiHours !== null ? String(shift.attendantEiHours) : ''
  );

  const [nurseOption, setNurseOption] = useState<string>(shift.nursePayOption || '');
  const [nurseCustomAmount, setNurseCustomAmount] = useState<string>(
    shift.nursePayAmount !== undefined && shift.nursePayAmount !== null ? String(shift.nursePayAmount) : ''
  );
  const [nurseCustomHours, setNurseCustomHours] = useState<string>(
    shift.nurseEiHours !== undefined && shift.nurseEiHours !== null ? String(shift.nurseEiHours) : ''
  );
  const [nurseName, setNurseName] = useState<string>(shift.nurseName || '');

  const [payrollComments, setPayrollComments] = useState<string>(shift.payrollComments || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings if not provided
  useEffect(() => {
    if (!settings) {
      DispatchService.getPayrollSettings()
        .then((s) => setSettings(s))
        .catch((err) => console.error('Failed to load dispatch payroll settings:', err));
    }
  }, [settings]);

  // Active rate constants from settings or default fallback
  const driverPD = settings?.driver?.partialPayRate ?? 25;
  const driverDD = settings?.driver?.doublePartialPayRate ?? 50;
  const driverEI = settings?.driver?.defaultEiHours ?? 3;

  const attendantPD = settings?.attendant?.partialPayRate ?? 20;
  const attendantDD = settings?.attendant?.doublePartialPayRate ?? 40;
  const attendantEI = settings?.attendant?.defaultEiHours ?? 2;

  const nursePD = settings?.nurse?.partialPayRate ?? 30;
  const nurseDD = settings?.nurse?.doublePartialPayRate ?? 60;
  const nurseEI = settings?.nurse?.defaultEiHours ?? 3;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Calculate driver pay & hours
      let driverPayAmount: number | undefined = undefined;
      let driverEiHours: number | undefined = undefined;
      if (driverOption === 'PD') {
        driverPayAmount = driverPD;
        driverEiHours = driverEI;
      } else if (driverOption === 'DD') {
        driverPayAmount = driverDD;
        driverEiHours = driverEI;
      } else if (driverOption === 'NP') {
        driverPayAmount = 0;
        driverEiHours = 0;
      } else if (driverOption === 'F') {
        driverPayAmount = driverCustomAmount !== '' ? parseFloat(driverCustomAmount) : 0;
        driverEiHours = driverCustomHours !== '' ? parseFloat(driverCustomHours) : 0;
      }

      // Calculate attendant pay & hours
      let attendantPayAmount: number | undefined = undefined;
      let attendantEiHours: number | undefined = undefined;
      if (attendantOption === 'PD') {
        attendantPayAmount = attendantPD;
        attendantEiHours = attendantEI;
      } else if (attendantOption === 'DD') {
        attendantPayAmount = attendantDD;
        attendantEiHours = attendantEI;
      } else if (attendantOption === 'NP') {
        attendantPayAmount = 0;
        attendantEiHours = 0;
      } else if (attendantOption === 'F') {
        attendantPayAmount = attendantCustomAmount !== '' ? parseFloat(attendantCustomAmount) : 0;
        attendantEiHours = attendantCustomHours !== '' ? parseFloat(attendantCustomHours) : 0;
      }

      // Calculate nurse pay & hours
      let nursePayAmount: number | undefined = undefined;
      let nurseEiHours: number | undefined = undefined;
      if (nurseOption === 'PD') {
        nursePayAmount = nursePD;
        nurseEiHours = nurseEI;
      } else if (nurseOption === 'DD') {
        nursePayAmount = nurseDD;
        nurseEiHours = nurseEI;
      } else if (nurseOption === 'NP') {
        nursePayAmount = 0;
        nurseEiHours = 0;
      } else if (nurseOption === 'F') {
        nursePayAmount = nurseCustomAmount !== '' ? parseFloat(nurseCustomAmount) : 0;
        nurseEiHours = nurseCustomHours !== '' ? parseFloat(nurseCustomHours) : 0;
      }

      const updateData: Partial<DispatchShift> = {
        driverPayOption: driverOption || undefined,
        driverPayAmount,
        driverEiHours,
        attendantPayOption: attendantOption || undefined,
        attendantPayAmount,
        attendantEiHours,
        nurseName: nurseName || undefined,
        nursePayOption: nurseOption || undefined,
        nursePayAmount,
        nurseEiHours,
        payrollComments: payrollComments || undefined,
      };

      const updated = await DispatchService.updateShift(shift.id, updateData);

      await logDispatchAction({
        date: shift.dispatchDate,
        type: 'Payroll Comments',
        detail: `Update Payroll Comments: ${payrollComments || 'Updated pay options'} [Driver Pay: ${driverOption || 'Std'}, Attendant Pay: ${attendantOption || 'Std'}]`,
        shift,
        user: actorName,
      });

      onShiftUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Failed to save dispatch payroll comment:', err);
      setError((err as Error).message || 'Failed to save payroll comments');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header matching image title */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Dispatch Payroll Comment</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              {shift.routeNo} • {shift.shiftType} ({shift.dispatchDate})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="m-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Row 1: Driver */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Driver</span>
                <span className="text-xs font-normal text-slate-500">
                  ({shift.driverName || 'No Driver Assigned'})
                </span>
              </label>
            </div>
            <select
              value={driverOption}
              onChange={(e) => setDriverOption(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="">-- Standard Route Pay --</option>
              <option value="PD">PD ${driverPD.toFixed(2)} (Partial Pay, {driverEI}h)</option>
              <option value="DD">DD ${driverDD.toFixed(2)} (Double Partial Pay, {driverEI}h)</option>
              <option value="NP">No Pay ($0.00, 0h)</option>
              <option value="F">F (Custom Flat Rate)</option>
            </select>

            {driverOption === 'F' && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Flat Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 25.00"
                    value={driverCustomAmount}
                    onChange={(e) => setDriverCustomAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">EI Hours (h)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 3.0"
                    value={driverCustomHours}
                    onChange={(e) => setDriverCustomHours(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Attendant */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Attendant</span>
                <span className="text-xs font-normal text-slate-500">
                  ({shift.attendantName || 'No Attendant Assigned'})
                </span>
              </label>
            </div>
            <select
              value={attendantOption}
              onChange={(e) => setAttendantOption(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="">-- Standard Route Pay --</option>
              <option value="PD">PD ${attendantPD.toFixed(2)} (Partial Pay, {attendantEI}h)</option>
              <option value="DD">DD ${attendantDD.toFixed(2)} (Double Partial Pay, {attendantEI}h)</option>
              <option value="NP">No Pay ($0.00, 0h)</option>
              <option value="F">F (Custom Flat Rate)</option>
            </select>

            {attendantOption === 'F' && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Flat Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 20.00"
                    value={attendantCustomAmount}
                    onChange={(e) => setAttendantCustomAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">EI Hours (h)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 2.0"
                    value={attendantCustomHours}
                    onChange={(e) => setAttendantCustomHours(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row 3: LPN (Nurse) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>LPN (Nurse)</span>
              </label>
              {nurseOption && (
                <div className="flex items-center gap-1">
                  <select
                    value={nurseName}
                    onChange={(e) => setNurseName(e.target.value)}
                    className="px-2 py-0.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white max-w-[150px]"
                  >
                    <option value="">-- Select LPN --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={`${emp.firstName} ${emp.lastName}`}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or type name"
                    value={nurseName}
                    onChange={(e) => setNurseName(e.target.value)}
                    className="px-2 py-0.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-28"
                  />
                </div>
              )}
            </div>
            <select
              value={nurseOption}
              onChange={(e) => setNurseOption(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="">-- No LPN / Standard Pay --</option>
              <option value="PD">PD ${nursePD.toFixed(2)} (Partial Pay, {nurseEI}h)</option>
              <option value="DD">DD ${nurseDD.toFixed(2)} (Double Partial Pay, {nurseEI}h)</option>
              <option value="NP">No Pay ($0.00, 0h)</option>
              <option value="F">F (Custom Flat Rate)</option>
            </select>

            {nurseOption === 'F' && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">Flat Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 30.00"
                    value={nurseCustomAmount}
                    onChange={(e) => setNurseCustomAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500">EI Hours (h)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 3.0"
                    value={nurseCustomHours}
                    onChange={(e) => setNurseCustomHours(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row 4: Payroll Comment / Notes */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Payroll Notes / Special Authorization
            </label>
            <input
              type="text"
              placeholder="e.g. Authorized by Supervisor for double run"
              value={payrollComments}
              onChange={(e) => setPayrollComments(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Payroll Comment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
