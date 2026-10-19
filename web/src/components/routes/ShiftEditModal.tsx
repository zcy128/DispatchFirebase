import React, { useState, useEffect } from 'react';
import { Calendar, Check, X } from 'lucide-react';
import { BusRouteShift } from '../../types/route';

interface ShiftEditModalProps {
  isOpen: boolean;
  shift: BusRouteShift | null;
  onClose: () => void;
  onSave: (shiftId: string, updates: Partial<BusRouteShift>) => Promise<void>;
}

const WEEKDAY_OPTIONS = [
  { key: 'M', label: 'M · Monday' },
  { key: 'T', label: 'T · Tuesday' },
  { key: 'W', label: 'W · Wednesday' },
  { key: 'R', label: 'R · Thursday' },
  { key: 'F', label: 'F · Friday' },
];

export const ShiftEditModal: React.FC<ShiftEditModalProps> = ({
  isOpen,
  shift,
  onClose,
  onSave,
}) => {
  const [active, setActive] = useState<boolean>(true);
  const [selectedDays, setSelectedDays] = useState<string[]>(['M', 'T', 'W', 'R', 'F']);
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [retireDate, setRetireDate] = useState<string>('');
  const [applyDatesToStops, setApplyDatesToStops] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (shift) {
      setActive(shift.active !== undefined ? shift.active : true);

      const rawDays = (shift.runDays || 'MTWRF').toUpperCase();
      if (rawDays === 'WEEKDAYS' || rawDays === 'MTWRF' || rawDays === 'ALL') {
        setSelectedDays(['M', 'T', 'W', 'R', 'F']);
      } else {
        const parsed = ['M', 'T', 'W', 'R', 'F'].filter((d) => rawDays.includes(d));
        setSelectedDays(parsed.length > 0 ? parsed : ['M', 'T', 'W', 'R', 'F']);
      }

      setEffectiveDate(shift.effectiveDate || '');
      setRetireDate(shift.retireDate || '');
      setApplyDatesToStops(false);
    }
    setErrorMsg(null);
  }, [shift, isOpen]);

  if (!isOpen || !shift) return null;

  const toggleDay = (key: string) => {
    if (selectedDays.includes(key)) {
      setSelectedDays(selectedDays.filter((d) => d !== key));
    } else {
      const updated = [...selectedDays, key];
      const ordered = ['M', 'T', 'W', 'R', 'F'].filter((d) => updated.includes(d));
      setSelectedDays(ordered);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const computedDays = selectedDays.length === 5 ? 'MTWRF' : selectedDays.join('');

    const updates: Partial<BusRouteShift> = {
      active,
      runDays: computedDays || 'MTWRF',
      effectiveDate: effectiveDate || undefined,
      retireDate: retireDate || undefined,
    };

    if (applyDatesToStops && shift.stops && shift.stops.length > 0) {
      updates.stops = shift.stops.map((s) => ({
        ...s,
        effectiveDate: effectiveDate || undefined,
        retireDate: retireDate || undefined,
      }));
    }

    try {
      await onSave(shift.id, updates);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update shift';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h3 className="text-xl font-bold font-serif text-slate-900 dark:text-white">
            Edit Shift ({shift.shiftType})
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Active Switch */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium font-serif text-slate-800 dark:text-slate-200">
              Active
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => setActive(!active)}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${
                active ? 'bg-[#2c3e50]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  active ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Run Days */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Run Days
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
                    onClick={() => toggleDay(day.key)}
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
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 italic">
                * When no days are selected, shift operates on all standard weekdays (MTWRF).
              </p>
            ) : selectedDays.length < 5 ? (
              <p className="text-[11px] text-slate-500 mt-1.5 italic">
                * Operates only on: <span className="font-semibold text-amber-600 dark:text-amber-400">{selectedDays.join(', ')}</span>
              </p>
            ) : null}
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Effective Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                placeholder="Effective Date"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2c3e50] dark:focus:ring-slate-500"
              />
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* Retire Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Retire Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={retireDate}
                onChange={(e) => setRetireDate(e.target.value)}
                placeholder="Retire Date"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2c3e50] dark:focus:ring-slate-500"
              />
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* Cascade Dates to Stops Checkbox */}
          {shift.stops && shift.stops.length > 0 && (
            <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-pointer">
              <input
                type="checkbox"
                checked={applyDatesToStops}
                onChange={(e) => setApplyDatesToStops(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Cascade Effective/Retire Dates to All {shift.stops.length} Stops
                </span>
                <span className="text-slate-500 text-[11px]">
                  Synchronize each stop in this shift with the effective & retire dates entered above.
                </span>
              </div>
            </label>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-serif font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg bg-[#2c3e50] hover:bg-[#1a252f] text-white font-serif font-bold text-sm shadow transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
