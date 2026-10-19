import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  UserX,
  AlertCircle,
  CheckCircle2,
  Search,
  Info
} from 'lucide-react';
import { DispatchShift, DispatchStopStudent } from '../../types/dispatch';
import { DispatchService } from '../../services/dispatchService';
import { useAuth } from '../../contexts/AuthContext';
import { logDispatchAction } from '../../utils/dispatchLogger';

export interface StudentAbsenceTarget {
  studentId: number;
  studentNo?: string;
  studentName: string;
  schoolName?: string;
  routeNo?: string;
}

interface RecordStudentAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts?: DispatchShift[];
  initialDate?: string;
  initialStudent?: StudentAbsenceTarget | null;
  onAbsenceRecorded?: (date: string, studentName: string) => void;
}

const PRESET_REASONS = [
  'Illness / Sick',
  'Doctor / Dental Appointment',
  'Family Vacation / Trip',
  'Parent Driving / Transporting',
  'Personal / Other'
];

export const RecordStudentAbsenceModal: React.FC<RecordStudentAbsenceModalProps> = ({
  isOpen,
  onClose,
  shifts = [],
  initialDate,
  initialStudent,
  onAbsenceRecorded,
}) => {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  // Compute Today and Tomorrow in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const tomorrowStr = useMemo(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
  }, []);

  const [targetDate, setTargetDate] = useState<string>(initialDate || todayStr);
  const [selectedRouteNo, setSelectedRouteNo] = useState<string>('ALL');
  const [selectedShiftType, setSelectedShiftType] = useState<'ALL' | 'AM' | 'PM'>('ALL');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentAbsenceTarget | null>(initialStudent || null);

  useEffect(() => {
    if (isOpen) {
      if (initialStudent) {
        setSelectedStudent(initialStudent);
      }
      if (initialDate) {
        setTargetDate(initialDate);
      }
    }
  }, [isOpen, initialStudent, initialDate]);

  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customNote, setCustomNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Extract all distinct students across current shifts
  const distinctStudents = useMemo(() => {
    const map = new Map<number, {
      studentId: number;
      studentNo?: string;
      studentName: string;
      schoolName?: string;
      routeNo?: string;
    }>();

    shifts.forEach((s) => {
      if (selectedRouteNo !== 'ALL' && s.routeNo !== selectedRouteNo) return;
      (s.stops || []).forEach((st) => {
        const stuList: DispatchStopStudent[] = (st.assignedStudents || (st as any).students || []);
        stuList.forEach((stu) => {
          if (!map.has(stu.studentId)) {
            map.set(stu.studentId, {
              studentId: stu.studentId,
              studentNo: stu.studentNo,
              studentName: stu.studentName,
              schoolName: stu.schoolName || st.schoolName,
              routeNo: s.routeNo,
            });
          }
        });
      });
    });

    if (initialStudent && !map.has(initialStudent.studentId)) {
      map.set(initialStudent.studentId, initialStudent);
    }

    return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [shifts, selectedRouteNo, initialStudent]);

  // Filter students based on search term
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return distinctStudents.slice(0, 15);
    const q = studentSearch.toLowerCase().trim();
    return distinctStudents.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        (s.studentNo && s.studentNo.toLowerCase().includes(q)) ||
        (s.schoolName && s.schoolName.toLowerCase().includes(q))
    );
  }, [distinctStudents, studentSearch]);

  // Distinct Route Numbers
  const routeNumbers = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach((s) => {
      if (s.routeNo) set.add(s.routeNo);
    });
    return Array.from(set).sort();
  }, [shifts]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setErrorMsg('Please select a student rider.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const finalReason = customNote.trim()
        ? `${selectedReason}: ${customNote.trim()}`
        : selectedReason;

      const res = await DispatchService.recordStudentAbsence({
        date: targetDate,
        studentId: selectedStudent.studentId,
        routeNo: selectedStudent.routeNo,
        shiftType: selectedShiftType,
        reason: finalReason,
        reportedBy: actorName,
      });

      await logDispatchAction({
        date: targetDate,
        type: 'Student Absence Logged',
        detail: `Parent notified: Student ${selectedStudent.studentName} (#${selectedStudent.studentId}) marked absent on ${targetDate} (${selectedShiftType} runs). Reason: ${finalReason}`,
        user: actorName,
      });

      setSuccessMsg(`Success! ${selectedStudent.studentName} marked absent for ${targetDate} (${res.affectedShifts?.length || 0} run(s) updated).`);
      onAbsenceRecorded?.(targetDate, selectedStudent.studentName);

      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
        setSelectedStudent(null);
        setCustomNote('');
      }, 1400);
    } catch (err: any) {
      console.error('Failed to log student absence:', err);
      setErrorMsg(err.message || 'Failed to save student absence');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Record Student Absence
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log parent notification of absence for Today, Tomorrow, or scheduled runs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Date Quick Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              1. Absence Date
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetDate(todayStr)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 ${
                  targetDate === todayStr
                    ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                }`}
              >
                <span>Today</span>
                <span className="text-[10px] font-normal opacity-85">{todayStr}</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetDate(tomorrowStr)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 ${
                  targetDate === tomorrowStr
                    ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                }`}
              >
                <span>Tomorrow</span>
                <span className="text-[10px] font-normal opacity-85">{tomorrowStr}</span>
              </button>

              <div className="relative">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full h-full py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-center"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Route & Student Search */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                2. Select Student Rider
              </label>
              {routeNumbers.length > 0 && (
                <select
                  value={selectedRouteNo}
                  onChange={(e) => {
                    setSelectedRouteNo(e.target.value);
                    setSelectedStudent(null);
                  }}
                  className="text-[11px] font-semibold py-0.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <option value="ALL">All Routes ({routeNumbers.length})</option>
                  {routeNumbers.map((r) => (
                    <option key={r} value={r}>
                      Route {r}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student by name, student #, school..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-rose-400"
              />
            </div>

            {/* Student Picker List */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  No matching students found on this route.
                </div>
              ) : (
                filteredStudents.map((stu) => {
                  const isSelected = selectedStudent?.studentId === stu.studentId;
                  return (
                    <div
                      key={stu.studentId}
                      onClick={() => setSelectedStudent(stu)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition text-xs ${
                        isSelected
                          ? 'bg-rose-50 dark:bg-rose-950/60 font-bold text-rose-900 dark:text-rose-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{stu.studentName}</div>
                        <div className="text-[10px] text-slate-400">
                          {stu.studentNo ? `#${stu.studentNo} • ` : ''}
                          {stu.schoolName}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {stu.routeNo}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedStudent && (
              <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
                <span>Selected: <strong>{selectedStudent.studentName}</strong> (Route {selectedStudent.routeNo})</span>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Shift Scope */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              3. Absence Shift Scope
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedShiftType('ALL')}
                className={`py-1.5 px-2 rounded-lg border font-semibold transition ${
                  selectedShiftType === 'ALL'
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-400'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                Full Day (AM & PM)
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftType('AM')}
                className={`py-1.5 px-2 rounded-lg border font-semibold transition ${
                  selectedShiftType === 'AM'
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-400'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                Morning (AM) Only
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftType('PM')}
                className={`py-1.5 px-2 rounded-lg border font-semibold transition ${
                  selectedShiftType === 'PM'
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-400'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                Afternoon (PM) Only
              </button>
            </div>
          </div>

          {/* Section 4: Absence Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              4. Absence Reason (Preserved for Driver & Audit Log)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      isSelected
                        ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              placeholder="Additional parent notes (e.g. fever, family emergency, doctor note)..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-rose-400"
            />
          </div>

          {/* Information Notice */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Once saved, the student's status is immediately updated in Firestore. The Driver Mobile App will receive this notice with the absent badge and bypass instructions for the pickup stop.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedStudent}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>{submitting ? 'Recording...' : 'Confirm Absence'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
