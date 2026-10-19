import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, HelpCircle, AlertCircle, Save, Check } from 'lucide-react';
import { BusRoutePayrollRate, PayrollLookups } from '../../types/payroll';

const WEEKDAY_OPTIONS = [
  { key: 'M', label: 'M · Monday' },
  { key: 'T', label: 'T · Tuesday' },
  { key: 'W', label: 'W · Wednesday' },
  { key: 'R', label: 'R · Thursday' },
  { key: 'F', label: 'F · Friday' },
];

interface CustomRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rate: Partial<BusRoutePayrollRate>) => Promise<void>;
  editingRate?: BusRoutePayrollRate | null;
  lookups: PayrollLookups;
}

export const CustomRateModal: React.FC<CustomRateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRate,
  lookups,
}) => {
  const [schoolBoardId, setSchoolBoardId] = useState<number>(5);
  const [routeId, setRouteId] = useState<number | ''>('');
  const [shiftId, setShiftId] = useState<number | ''>('');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [shiftType, setShiftType] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['M', 'T', 'W', 'R', 'F']);
  const [payRate, setPayRate] = useState<string>('45.00');
  const [eiHours, setEiHours] = useState<string>('2.50');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [retireDate, setRetireDate] = useState<string>('');
  const [neverExpires, setNeverExpires] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset form when modal opens or editingRate changes
  useEffect(() => {
    if (editingRate) {
      setSchoolBoardId(editingRate.schoolBoardId);
      setRouteId(editingRate.routeId ?? '');
      setShiftId(editingRate.shiftId ?? '');
      setEmployeeId(editingRate.employeeId ?? '');
      setJobTitle(editingRate.jobTitle ?? '');
      setShiftType(editingRate.shiftType ?? '');
      
      const rawDays = (editingRate.weekDays || 'MTWRF').toUpperCase();
      if (rawDays === 'WEEKDAYS' || rawDays === 'MTWRF' || rawDays === 'ALL') {
        setSelectedDays(['M', 'T', 'W', 'R', 'F']);
      } else {
        const parsed = ['M', 'T', 'W', 'R', 'F'].filter((d) => rawDays.includes(d));
        setSelectedDays(parsed.length > 0 ? parsed : ['M', 'T', 'W', 'R', 'F']);
      }

      setPayRate(editingRate.payRate !== undefined && editingRate.payRate !== null ? String(editingRate.payRate) : '');
      setEiHours(editingRate.eiHours !== undefined && editingRate.eiHours !== null ? String(editingRate.eiHours) : '');
      setEffectiveDate(editingRate.effectiveDate || new Date().toISOString().split('T')[0]);
      if (editingRate.retireDate) {
        setRetireDate(editingRate.retireDate);
        setNeverExpires(false);
      } else {
        setRetireDate('');
        setNeverExpires(true);
      }
      setNotes(editingRate.notes || '');
    } else {
      // Default new rate
      setSchoolBoardId(lookups.schoolBoards[0]?.schoolBoardId || 5);
      setRouteId('');
      setShiftId('');
      setEmployeeId('');
      setJobTitle('');
      setShiftType('');
      setSelectedDays(['M', 'T', 'W', 'R', 'F']);
      setPayRate('45.00');
      setEiHours('2.50');
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setRetireDate('');
      setNeverExpires(true);
      setNotes('');
    }
    setErrorMsg(null);
  }, [editingRate, isOpen, lookups]);

  if (!isOpen) return null;

  // Selected route object to list its shifts
  const selectedRoute = lookups.routes.find((r) => r.busRouteId === Number(routeId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolBoardId) {
      setErrorMsg('Please select a School Board.');
      return;
    }

    const parsedPay = parseFloat(payRate);
    if (isNaN(parsedPay) || parsedPay <= 0) {
      setErrorMsg('Please enter a valid Pay Rate.');
      return;
    }

    const parsedEi = parseFloat(eiHours);
    if (isNaN(parsedEi) || parsedEi < 0) {
      setErrorMsg('Please enter valid EI Hours.');
      return;
    }

    if (!effectiveDate) {
      setErrorMsg('Effective Date is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const sb = lookups.schoolBoards.find((b) => b.schoolBoardId === Number(schoolBoardId));
    const rt = lookups.routes.find((r) => r.busRouteId === Number(routeId));
    const emp = lookups.employees.find((m) => m.employeeId === Number(employeeId));
    const computedWeekDays = selectedDays.length === 5 ? 'MTWRF' : selectedDays.join('');

    const payload: Partial<BusRoutePayrollRate> = {
      schoolBoardId: Number(schoolBoardId),
      schoolBoardName: sb?.schoolBoardName,
      schoolBoardCode: sb?.schoolBoardCode,
      routeId: routeId !== '' ? Number(routeId) : null,
      routeNo: rt?.routeNo,
      routeName: rt?.routeName,
      shiftId: shiftId !== '' ? Number(shiftId) : null,
      employeeId: employeeId !== '' ? Number(employeeId) : null,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
      jobTitle: jobTitle || undefined,
      shiftType: shiftType || undefined,
      weekDays: computedWeekDays || 'MTWRF',
      payRate: parsedPay,
      eiHours: parsedEi,
      effectiveDate,
      retireDate: neverExpires || !retireDate ? null : retireDate,
      notes: notes.trim(),
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Failed to save payroll rate.';
      setErrorMsg(errText);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingRate ? 'Edit Custom Rate' : 'New Custom Rate'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure specific rate overrides for routes, shifts, or individual employees.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Context Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Hierarchy Rules:</span>
              <p>
                <strong>Route + Employee Override:</strong> Applies only to this employee when assigned to this route.
              </p>
              <p>
                <strong>Employee Universal Override:</strong> Leave Route blank to grant this employee a guaranteed rate across all routes.
              </p>
              <p>
                <strong>Route General Override:</strong> Leave Employee blank to apply this rate to anyone running this route.
              </p>
            </div>
          </div>

          {/* School Board */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              School Board *
            </label>
            <select
              value={schoolBoardId}
              onChange={(e) => setSchoolBoardId(Number(e.target.value))}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
            >
              {lookups.schoolBoards.map((b) => (
                <option key={b.schoolBoardId} value={b.schoolBoardId}>
                  {b.schoolBoardCode} – {b.schoolBoardName}
                </option>
              ))}
            </select>
          </div>

          {/* Route & Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Route (Optional)
              </label>
              <select
                value={routeId}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setRouteId(val);
                  setShiftId('');
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
              >
                <option value="">Any Route (Universal / Board Default)</option>
                {lookups.routes.map((r) => (
                  <option key={r.busRouteId} value={r.busRouteId}>
                    {r.routeNo} – {r.routeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Shift (Optional)
              </label>
              <select
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={!selectedRoute || selectedRoute.shifts.length === 0}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50 transition-shadow"
              >
                <option value="">Any Shift</option>
                {selectedRoute?.shifts.map((s) => (
                  <option key={s.shiftId} value={s.shiftId}>
                    Shift #{s.shiftId} ({s.shiftType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Employee & Job Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Employee (Optional)
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
              >
                <option value="">Any Employee</option>
                {lookups.employees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.lastName}, {emp.firstName} {emp.jobPosition ? `(${emp.jobPosition})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Job Title (Optional)
              </label>
              <select
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
              >
                <option value="">Any Job Title</option>
                {lookups.jobTitles.map((jt) => (
                  <option key={jt.id} value={jt.name}>
                    {jt.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Shift Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Shift Type
            </label>
            <select
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
            >
              <option value="">Any Shift Type (All Shifts)</option>
              {lookups.shiftTypes.map((st) => (
                <option key={st.id} value={st.name}>
                  {st.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Run Days (Optional) - MTWRF Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Run Days (Optional)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDays(['M', 'T', 'W', 'R', 'F'])}
                  className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  All (MTWRF)
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedDays([])}
                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {WEEKDAY_OPTIONS.map((day) => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedDays(selectedDays.filter((d) => d !== day.key));
                      } else {
                        const updated = [...selectedDays, day.key];
                        const ordered = ['M', 'T', 'W', 'R', 'F'].filter((d) => updated.includes(d));
                        setSelectedDays(ordered);
                      }
                    }}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-[#d8a427] hover:bg-[#c99520] text-slate-950 border-[#b58518] shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 stroke-[3] text-slate-950" />}
                    <span>{day.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedDays.length === 0 ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                * When no specific days are selected, rate applies to all operating weekdays (MTWRF).
              </p>
            ) : selectedDays.length < 5 ? (
              <p className="text-[11px] text-slate-500 italic">
                * Active only on: <span className="font-semibold text-amber-600 dark:text-amber-400">{selectedDays.join(', ')}</span>
              </p>
            ) : null}
          </div>

          {/* Pay Rate & EI Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Pay Rate ($ / run) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={payRate}
                  onChange={(e) => setPayRate(e.target.value)}
                  placeholder="45.00"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                EI Hours (hrs / run) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Clock className="w-4 h-4" />
                </span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  required
                  value={eiHours}
                  onChange={(e) => setEiHours(e.target.value)}
                  placeholder="2.50"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* Effective & Retire Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Effective Date *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  required
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Retire Date
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={neverExpires}
                    onChange={(e) => {
                      setNeverExpires(e.target.checked);
                      if (e.target.checked) setRetireDate('');
                    }}
                    className="rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span>Never</span>
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  disabled={neverExpires}
                  value={retireDate}
                  onChange={(e) => setRetireDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-40 transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Notes & Reason (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. High-density transit corridor bonus rate..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-400 focus:outline-none transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : editingRate ? 'Update Rate' : 'Save Rate'}
          </button>
        </div>
      </div>
    </div>
  );
};
