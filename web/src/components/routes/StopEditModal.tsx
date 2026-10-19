import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Tag, FileText, Check } from 'lucide-react';
import { BusRouteShift, RouteStop } from '../../types/route';

interface StopEditModalProps {
  isOpen: boolean;
  shift: BusRouteShift | null;
  stop: RouteStop | null;
  onClose: () => void;
  onSave: (shiftId: string, updatedStop: RouteStop) => Promise<void>;
}

const WEEKDAY_OPTIONS = [
  { key: 'M', label: 'M' },
  { key: 'T', label: 'T' },
  { key: 'W', label: 'W' },
  { key: 'R', label: 'R' },
  { key: 'F', label: 'F' },
];

const STOP_TYPES = [
  { value: 'HomePickup', label: 'Home Pickup' },
  { value: 'SchoolDropoff', label: 'School Dropoff' },
  { value: 'SchoolPickup', label: 'School Pickup' },
  { value: 'HomeDropoff', label: 'Home Dropoff' },
];

export const StopEditModal: React.FC<StopEditModalProps> = ({
  isOpen,
  shift,
  stop,
  onClose,
  onSave,
}) => {
  const [stopLocation, setStopLocation] = useState('');
  const [pullawayTime, setPullawayTime] = useState('');
  const [stopType, setStopType] = useState('HomePickup');
  const [selectedDays, setSelectedDays] = useState<string[]>(['M', 'T', 'W', 'R', 'F']);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [retireDate, setRetireDate] = useState('');
  const [comment, setComment] = useState('');
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (stop) {
      setStopLocation(stop.stopLocation || '');
      setPullawayTime(stop.pullawayTime || '');
      setStopType(stop.stopType || 'HomePickup');

      const rawDays = (stop.runDays || shift?.runDays || 'MTWRF').toUpperCase();
      if (rawDays === 'WEEKDAYS' || rawDays === 'MTWRF' || rawDays === 'ALL') {
        setSelectedDays(['M', 'T', 'W', 'R', 'F']);
      } else {
        const parsed = ['M', 'T', 'W', 'R', 'F'].filter((d) => rawDays.includes(d));
        setSelectedDays(parsed.length > 0 ? parsed : ['M', 'T', 'W', 'R', 'F']);
      }

      setEffectiveDate(stop.effectiveDate || '');
      setRetireDate(stop.retireDate || '');
      setComment(stop.comment || '');
      setInstruction(stop.instruction || '');
    }
    setErrorMsg(null);
  }, [stop, shift, isOpen]);

  if (!isOpen || !stop || !shift) return null;

  const toggleDay = (key: string) => {
    if (selectedDays.includes(key)) {
      setSelectedDays(selectedDays.filter((d) => d !== key));
    } else {
      const updated = [...selectedDays, key];
      const ordered = ['M', 'T', 'W', 'R', 'F'].filter((d) => updated.includes(d));
      setSelectedDays(ordered);
    }
  };

  const handleMatchShiftDates = () => {
    if (shift) {
      setEffectiveDate(shift.effectiveDate || '');
      setRetireDate(shift.retireDate || '');
    }
  };

  const handleClearDates = () => {
    setEffectiveDate('');
    setRetireDate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullawayTime.trim()) {
      setErrorMsg('Pullaway time is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const computedDays = selectedDays.length === 5 ? 'MTWRF' : selectedDays.join('');

    const updated: RouteStop = {
      ...stop,
      stopLocation: stopLocation.trim(),
      pullawayTime: pullawayTime.trim(),
      stopType,
      runDays: computedDays || 'MTWRF',
      effectiveDate: effectiveDate || undefined,
      retireDate: retireDate || undefined,
      comment: comment.trim() || undefined,
      instruction: instruction.trim() || undefined,
    };

    try {
      await onSave(shift.id, updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update stop';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-mono font-bold text-sm">
              #{stop.sequence}
            </div>
            <div>
              <h3 className="text-lg font-bold font-serif text-slate-900 dark:text-white">
                Edit Stop #{stop.sequence}
              </h3>
              <p className="text-xs text-slate-500">
                Shift: {shift.shiftType} ({shift.routeNo}) • Configure schedule & dates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Stop Location / Address
            </label>
            <div className="relative">
              <input
                type="text"
                value={stopLocation}
                onChange={(e) => setStopLocation(e.target.value)}
                placeholder="Address or intersection"
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2c3e50] dark:focus:ring-slate-500"
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Time & Stop Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Pullaway Time *
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={pullawayTime}
                  onChange={(e) => setPullawayTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
                />
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Stop Type
              </label>
              <div className="relative">
                <select
                  value={stopType}
                  onChange={(e) => setStopType(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
                >
                  {STOP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Op Days / Weekdays */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Operating Days
            </label>
            <div className="flex items-center space-x-1.5">
              {WEEKDAY_OPTIONS.map((opt) => {
                const isSelected = selectedDays.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleDay(opt.key)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Effective & Retire Date Group */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>Effective & Retire Dates</span>
              </span>
              <div className="flex items-center space-x-1.5">
                {shift && (shift.effectiveDate || shift.retireDate) && (
                  <button
                    type="button"
                    onClick={handleMatchShiftDates}
                    className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Match Shift Dates
                  </button>
                )}
                {(effectiveDate || retireDate) && (
                  <button
                    type="button"
                    onClick={handleClearDates}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition ml-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Effective Date (Start)
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Retire Date (End)
                </label>
                <input
                  type="date"
                  value={retireDate}
                  onChange={(e) => setRetireDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>
            </div>

            {shift && (shift.effectiveDate || shift.retireDate) && (
              <p className="text-[11px] text-slate-400">
                Shift Dates: {shift.effectiveDate || 'None'} to {shift.retireDate || 'Ongoing'}
              </p>
            )}
          </div>

          {/* Comment / Instruction */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Comment / Special Instructions
            </label>
            <div className="relative">
              <input
                type="text"
                value={comment || instruction}
                onChange={(e) => {
                  setComment(e.target.value);
                  setInstruction(e.target.value);
                }}
                placeholder="e.g. Wait across sidewalk, turn around at church..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
              />
              <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#2c3e50] hover:bg-[#1a252f] text-white font-bold text-sm shadow transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Save Stop</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
