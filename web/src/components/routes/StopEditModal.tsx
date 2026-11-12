import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, MapPin, Tag, FileText, Check, Users, Plus, Search } from 'lucide-react';
import { BusRouteShift, RouteStop, StopStudent } from '../../types/route';
import { Student } from '../../types/student';

interface StopEditModalProps {
  isOpen: boolean;
  shift: BusRouteShift | null;
  stop: RouteStop | null;
  studentsMap?: Record<number, Student>;
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
  studentsMap,
  onClose,
  onSave,
}) => {
  const isCreate = !stop;
  const [stopLocation, setStopLocation] = useState('');
  const [pullawayTime, setPullawayTime] = useState('');
  const [stopType, setStopType] = useState('HomePickup');
  const [selectedDays, setSelectedDays] = useState<string[]>(['M', 'T', 'W', 'R', 'F']);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [retireDate, setRetireDate] = useState('');
  const [comment, setComment] = useState('');
  const [instruction, setInstruction] = useState('');
  const [assignedStudents, setAssignedStudents] = useState<StopStudent[]>([]);
  const [candidateStudentId, setCandidateStudentId] = useState<string>('');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
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
      setAssignedStudents(stop.assignedStudents ? [...stop.assignedStudents] : []);
    } else if (shift) {
      // Create mode
      setStopLocation('');
      setPullawayTime('');
      const isPM = (shift.shiftType || '').toUpperCase() === 'PM';
      setStopType(isPM ? 'SchoolPickup' : 'HomePickup');

      const rawDays = (shift.runDays || 'MTWRF').toUpperCase();
      if (rawDays === 'WEEKDAYS' || rawDays === 'MTWRF' || rawDays === 'ALL') {
        setSelectedDays(['M', 'T', 'W', 'R', 'F']);
      } else {
        const parsed = ['M', 'T', 'W', 'R', 'F'].filter((d) => rawDays.includes(d));
        setSelectedDays(parsed.length > 0 ? parsed : ['M', 'T', 'W', 'R', 'F']);
      }

      setEffectiveDate(shift.effectiveDate || '');
      setRetireDate(shift.retireDate || '');
      setComment('');
      setInstruction('');
      setAssignedStudents([]);
    }
    setCandidateStudentId('');
    setStudentSearchTerm('');
    setErrorMsg(null);
  }, [stop, shift, isOpen]);

  const availableCandidates = useMemo(() => {
    if (!studentsMap) return [];
    const assignedIds = new Set(assignedStudents.map((s) => s.studentId));
    const all = Object.values(studentsMap).filter((s) => !assignedIds.has(s.studentId));
    if (!studentSearchTerm.trim()) {
      return all.slice(0, 60);
    }
    const q = studentSearchTerm.toLowerCase();
    return all
      .filter(
        (s) =>
          (s.fullName || s.studentName || '').toLowerCase().includes(q) ||
          (s.studentNo || '').toLowerCase().includes(q) ||
          (s.schoolName || '').toLowerCase().includes(q) ||
          (s.studentAddress || '').toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [studentsMap, assignedStudents, studentSearchTerm]);

  const handleAddCandidate = () => {
    if (!candidateStudentId || !studentsMap) return;
    const stu = studentsMap[Number(candidateStudentId)];
    if (!stu) return;

    if (!assignedStudents.some((s) => s.studentId === stu.studentId)) {
      setAssignedStudents((prev) => [
        ...prev,
        {
          studentId: stu.studentId,
          studentNo: stu.studentNo,
          studentName: stu.fullName || `${stu.firstName} ${stu.lastName}`,
          schoolName: stu.schoolName
        }
      ]);
      // Prefill stop location if empty
      if (!stopLocation && stu.studentAddress) {
        setStopLocation(stu.studentAddress);
      }
    }
    setCandidateStudentId('');
  };

  const handleRemoveStudent = (studentId: number) => {
    setAssignedStudents((prev) => prev.filter((s) => s.studentId !== studentId));
  };

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

    const payload: RouteStop = isCreate
      ? {
          stopId: Date.now(),
          sequence: (shift.stops?.length || 0) + 1,
          stopLocation: stopLocation.trim(),
          pullawayTime: pullawayTime.trim(),
          stopType,
          runDays: computedDays || 'MTWRF',
          effectiveDate: effectiveDate || undefined,
          retireDate: retireDate || undefined,
          comment: comment.trim() || undefined,
          instruction: instruction.trim() || undefined,
          assignedStudents
        }
      : {
          ...stop!,
          stopLocation: stopLocation.trim(),
          pullawayTime: pullawayTime.trim(),
          stopType,
          runDays: computedDays || 'MTWRF',
          effectiveDate: effectiveDate || undefined,
          retireDate: retireDate || undefined,
          comment: comment.trim() || undefined,
          instruction: instruction.trim() || undefined,
          assignedStudents
        };

    try {
      await onSave(shift.id, payload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save stop';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-mono font-bold text-sm">
              {isCreate ? `+${(shift.stops?.length || 0) + 1}` : `#${stop?.sequence}`}
            </div>
            <div>
              <h3 className="text-lg font-bold font-serif text-slate-900 dark:text-white">
                {isCreate ? 'Add Stop to Shift' : `Edit Stop #${stop?.sequence}`}
              </h3>
              <p className="text-xs text-slate-500">
                Shift: {shift.shiftType} ({shift.routeNo || 'Route'}) • {isCreate ? 'Create standalone or shared stop' : 'Configure schedule & assigned riders'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
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
                placeholder="Address or intersection (e.g. Corner of 5th Ave & Main St)"
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
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none cursor-pointer"
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
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition border cursor-pointer ${
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

          {/* Assigned Riders Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-sky-500" />
                <span>Assigned Riders ({assignedStudents.length})</span>
              </span>
              <span className="text-[11px] text-slate-400">Multiple riders can share this stop</span>
            </div>

            {/* List of current assigned students */}
            {assignedStudents.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-1 px-1.5">
                No students currently assigned to this stop.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                {assignedStudents.map((stu) => (
                  <div
                    key={stu.studentId}
                    className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                  >
                    <span className="font-semibold">{stu.studentName}</span>
                    {stu.studentNo && (
                      <span className="font-mono text-[10px] text-slate-400">#{stu.studentNo}</span>
                    )}
                    {stu.schoolName && (
                      <span className="text-[10px] text-sky-500 truncate max-w-[100px]">
                        ({stu.schoolName})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveStudent(stu.studentId)}
                      title="Remove student from stop"
                      className="p-0.5 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add rider picker */}
            {studentsMap && (
              <div className="space-y-1.5 pt-1">
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                  <input
                    type="text"
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    placeholder="Search candidate by name, ID, or school..."
                    className="w-full pl-7 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={candidateStudentId}
                    onChange={(e) => setCandidateStudentId(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Select rider to add --</option>
                    {availableCandidates.map((c) => (
                      <option key={c.studentId} value={c.studentId}>
                        #{c.studentNo} • {c.fullName || c.studentName} ({c.schoolName || 'School'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!candidateStudentId}
                    onClick={handleAddCandidate}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-semibold flex items-center space-x-1 disabled:opacity-40 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            )}
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
                    className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Match Shift Dates
                  </button>
                )}
                {(effectiveDate || retireDate) && (
                  <button
                    type="button"
                    onClick={handleClearDates}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition ml-2 cursor-pointer"
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
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#2c3e50] hover:bg-[#1a252f] text-white font-bold text-sm shadow transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{isCreate ? 'Create Stop' : 'Save Stop'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
