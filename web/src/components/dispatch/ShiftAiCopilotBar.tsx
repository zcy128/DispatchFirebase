import React, { useState, useRef, useId } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  CornerDownLeft,
} from 'lucide-react';
import type {
  DispatchShift,
  DispatchShiftStop,
  DispatchStudentStatus,
} from '../../types/dispatch';
import type { Employee } from '../../types/employee';
import type { Vehicle } from '../../types/vehicle';
import { aiService } from '../../services/aiService';

export interface ShiftAiCopilotBarProps {
  selectedShift: DispatchShift | null;
  employees: Employee[];
  availableVehicles: Vehicle[];
  onAssignDriver: (driver: Employee) => Promise<void>;
  onAssignVehicle: (vehicle: Vehicle) => Promise<void>;
  onAssignAttendant: (attendant: Employee) => Promise<void>;
  onUpdateStudentStatus: (
    stop: DispatchShiftStop,
    studentId: number,
    studentName: string,
    status: DispatchStudentStatus
  ) => Promise<void>;
  onQuickCheckIn?: (shift: DispatchShift) => void;
  onQuickAttendantCheckIn?: (shift: DispatchShift) => void;
  onQuickCheckOut?: (shift: DispatchShift) => void;
  onTriggerDelayAlert?: (minutes: number, reason: string) => void;
  selectedDate: string;
}

export interface CopilotLogEntry {
  id: string;
  command: string;
  timestamp: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

export function matchEmployee(term: string, employees: Employee[]): Employee | null {
  const clean = term.trim().toLowerCase();
  if (!clean) return null;

  // 1. Exact ID or employeeNumber match
  const exactId = employees.find(
    (e) =>
      e.id.toLowerCase() === clean ||
      (e.employeeNumber && e.employeeNumber.toLowerCase() === clean)
  );
  if (exactId) return exactId;

  // 2. Exact full name match (with or without spaces, e.g. "driver21" vs "driver 21")
  const cleanNoSpace = clean.replace(/\s+/g, '');
  const exactFullName = employees.find((e) => {
    const full = `${e.firstName} ${e.lastName}`.toLowerCase();
    return full === clean || full.replace(/\s+/g, '') === cleanNoSpace;
  });
  if (exactFullName) return exactFullName;

  // 3. Exact first name or last name match
  const exactFirstOrLast = employees.find(
    (e) =>
      e.firstName.toLowerCase() === clean ||
      e.lastName.toLowerCase() === clean
  );
  if (exactFirstOrLast) return exactFirstOrLast;

  // 4. Substring in full name
  const partial = employees.find((e) => {
    const full = `${e.firstName} ${e.lastName}`.toLowerCase();
    return full.includes(clean);
  });
  if (partial) return partial;

  // 5. If term contains digits (e.g. "driver21" or "21"), try matching employee whose id or name contains those digits
  const digits = clean.replace(/\D/g, '');
  if (digits) {
    const digitMatch = employees.find((e) => {
      const idDigits = e.id.replace(/\D/g, '');
      const numDigits = (e.employeeNumber || '').replace(/\D/g, '');
      const nameDigits = `${e.firstName} ${e.lastName}`.replace(/\D/g, '');
      return idDigits === digits || numDigits === digits || nameDigits === digits;
    });
    if (digitMatch) return digitMatch;
  }

  return null;
}

export function matchVehicle(term: string, vehicles: Vehicle[]): Vehicle | null {
  const clean = term.trim().toLowerCase();
  if (!clean) return null;

  // Remove common prefixes like "unit", "bus", "van", "#"
  const cleanStripped = clean.replace(/^(unit|bus|van|#|\s)+/g, '').trim();

  // 1. Exact unitNumber match
  const exactUnit = vehicles.find(
    (v) =>
      v.unitNumber.toLowerCase() === clean ||
      v.unitNumber.toLowerCase() === cleanStripped
  );
  if (exactUnit) return exactUnit;

  // 2. Exact plateNumber match
  const exactPlate = vehicles.find(
    (v) =>
      v.plateNumber.toLowerCase() === clean ||
      v.plateNumber.toLowerCase().replace(/\s+/g, '') === clean.replace(/\s+/g, '')
  );
  if (exactPlate) return exactPlate;

  // 3. ID match
  const exactId = vehicles.find(
    (v) => String(v.vehicleId) === clean || String(v.vehicleId) === cleanStripped
  );
  if (exactId) return exactId;

  // 4. Substring in unit or plate
  const partial = vehicles.find(
    (v) =>
      v.unitNumber.toLowerCase().includes(cleanStripped) ||
      v.plateNumber.toLowerCase().includes(cleanStripped)
  );
  if (partial) return partial;

  return null;
}

export function matchStudentInShift(
  term: string,
  shift: DispatchShift
): { stop: DispatchShiftStop; student: { studentId: number; studentName: string; status?: string } } | null {
  const clean = term.trim().toLowerCase();
  if (!clean || !Array.isArray(shift.stops)) return null;

  for (const stop of shift.stops) {
    if (!Array.isArray(stop.assignedStudents)) continue;
    for (const student of stop.assignedStudents) {
      const name = (student.studentName || '').toLowerCase();
      const idStr = String(student.studentId);
      if (name === clean || name.includes(clean) || idStr === clean) {
        return { stop, student };
      }
    }
  }

  for (const stop of shift.stops) {
    if (!Array.isArray(stop.assignedStudents)) continue;
    for (const student of stop.assignedStudents) {
      const name = (student.studentName || '').toLowerCase();
      const firstWord = name.split(/\s+/)[0];
      if (firstWord === clean) {
        return { stop, student };
      }
    }
  }

  return null;
}

export const ShiftAiCopilotBar: React.FC<ShiftAiCopilotBarProps> = ({
  selectedShift,
  employees,
  availableVehicles,
  onAssignDriver,
  onAssignVehicle,
  onAssignAttendant,
  onUpdateStudentStatus,
  onQuickCheckIn,
  onQuickAttendantCheckIn,
  onQuickCheckOut,
  onTriggerDelayAlert,
  selectedDate,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [logs, setLogs] = useState<CopilotLogEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const addLog = (entry: Omit<CopilotLogEntry, 'id' | 'timestamp'>) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newEntry: CopilotLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: time,
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 9)]);
  };

  const handleExecute = async (inputStr: string) => {
    const text = inputStr.trim();
    if (!text) return;
    if (!selectedShift) {
      addLog({
        command: text,
        type: 'warning',
        message: 'No shift selected. Please select a dispatch shift from the queue first.',
      });
      return;
    }

    setExecuting(true);
    const lower = text.toLowerCase();

    try {
      // 1. Driver assignment: "driver driver21", "assign driver Alice", "set driver Bob"
      const driverMatch = lower.match(/^(?:assign\s+driver|set\s+driver|driver)\s+(.+)$/i);
      if (driverMatch) {
        const target = driverMatch[1].trim();
        const emp = matchEmployee(target, employees);
        if (emp) {
          await onAssignDriver(emp);
          addLog({
            command: text,
            type: 'success',
            message: `Assigned Driver ${emp.firstName} ${emp.lastName} to route ${selectedShift.routeNo} (${selectedShift.shiftType}).`,
          });
          setCommandInput('');
          return;
        } else {
          addLog({
            command: text,
            type: 'warning',
            message: `Driver "${target}" not found. Try entering an employee name or ID (e.g. "driver ${employees[0]?.firstName || 'Alice'}").`,
          });
          return;
        }
      }

      // 2. Vehicle assignment: "vehicle 1001", "bus 1001", "unit 1001", "assign vehicle 1001"
      const vehicleMatch = lower.match(/^(?:assign\s+vehicle|assign\s+bus|vehicle|bus|unit|van)\s+(.+)$/i);
      if (vehicleMatch) {
        const target = vehicleMatch[1].trim();
        const veh = matchVehicle(target, availableVehicles);
        if (veh) {
          await onAssignVehicle(veh);
          addLog({
            command: text,
            type: 'success',
            message: `Assigned Vehicle Unit #${veh.unitNumber} (${veh.plateNumber}) to route ${selectedShift.routeNo} (${selectedShift.shiftType}).`,
          });
          setCommandInput('');
          return;
        } else {
          addLog({
            command: text,
            type: 'warning',
            message: `Vehicle "${target}" not found in available fleet. Try unit numbers like ${availableVehicles.slice(0, 3).map((v) => v.unitNumber).join(', ') || '1001'}.`,
          });
          return;
        }
      }

      // 3. Student Pickup: "pickup Benjamin", "pick up Benjamin"
      const pickupMatch = lower.match(/^(?:pickup|pick\s+up)\s+(.+)$/i);
      if (pickupMatch) {
        const target = pickupMatch[1].trim();
        const match = matchStudentInShift(target, selectedShift);
        if (match) {
          await onUpdateStudentStatus(
            match.stop,
            match.student.studentId,
            match.student.studentName,
            'picked_up'
          );
          addLog({
            command: text,
            type: 'success',
            message: `Marked student "${match.student.studentName}" as Picked Up at Stop #${match.stop.sequence} (${match.stop.stopLocation}).`,
          });
          setCommandInput('');
          return;
        } else {
          addLog({
            command: text,
            type: 'warning',
            message: `Student "${target}" not found in this shift's stops. Available students: ${
              (selectedShift.stops || [])
                .flatMap((s) => (s.assignedStudents || []).map((stu) => stu.studentName))
                .join(', ') || 'None'
            }`,
          });
          return;
        }
      }

      // 4. Student Dropoff: "dropoff Benjamin", "drop off Benjamin"
      const dropoffMatch = lower.match(/^(?:dropoff|drop\s+off)\s+(.+)$/i);
      if (dropoffMatch) {
        const target = dropoffMatch[1].trim();
        const match = matchStudentInShift(target, selectedShift);
        if (match) {
          await onUpdateStudentStatus(
            match.stop,
            match.student.studentId,
            match.student.studentName,
            'dropped_off'
          );
          addLog({
            command: text,
            type: 'success',
            message: `Marked student "${match.student.studentName}" as Dropped Off at Stop #${match.stop.sequence} (${match.stop.stopLocation}).`,
          });
          setCommandInput('');
          return;
        } else {
          addLog({
            command: text,
            type: 'warning',
            message: `Student "${target}" not found in this shift's stops.`,
          });
          return;
        }
      }

      // 5. Student Absent: "absent Benjamin", "mark absent Benjamin"
      const absentMatch = lower.match(/^(?:mark\s+absent|absent)\s+(.+)$/i);
      if (absentMatch) {
        const target = absentMatch[1].trim();
        const match = matchStudentInShift(target, selectedShift);
        if (match) {
          await onUpdateStudentStatus(
            match.stop,
            match.student.studentId,
            match.student.studentName,
            'absent'
          );
          addLog({
            command: text,
            type: 'success',
            message: `Marked student "${match.student.studentName}" as Absent for Stop #${match.stop.sequence}.`,
          });
          setCommandInput('');
          return;
        } else {
          addLog({
            command: text,
            type: 'warning',
            message: `Student "${target}" not found in this shift's stops.`,
          });
          return;
        }
      }

      // 6. Attendant assignment: "attendant Bob", "assign attendant Bob"
      const attendantMatch = lower.match(/^(?:assign\s+attendant|attendant|aide)\s+(.+)$/i);
      if (attendantMatch) {
        const target = attendantMatch[1].trim();
        const emp = matchEmployee(target, employees);
        if (emp) {
          await onAssignAttendant(emp);
          addLog({
            command: text,
            type: 'success',
            message: `Assigned Attendant ${emp.firstName} ${emp.lastName} to route ${selectedShift.routeNo}.`,
          });
          setCommandInput('');
          return;
        } else {
          addLog({
            command: text,
            type: 'warning',
            message: `Attendant candidate "${target}" not found in employees list.`,
          });
          return;
        }
      }

      // 7. Check-in & Check-out actions
      if (lower === 'checkin' || lower === 'check in' || lower === 'driver checkin' || lower === 'driver check in') {
        if (onQuickCheckIn) {
          onQuickCheckIn(selectedShift);
          addLog({
            command: text,
            type: 'success',
            message: `Triggered driver check-in toggle for ${selectedShift.driverName || 'Driver'}.`,
          });
          setCommandInput('');
          return;
        }
      }

      if (lower === 'attendant checkin' || lower === 'attendant check in') {
        if (onQuickAttendantCheckIn) {
          onQuickAttendantCheckIn(selectedShift);
          addLog({
            command: text,
            type: 'success',
            message: `Triggered attendant check-in toggle for ${selectedShift.attendantName || 'Attendant'}.`,
          });
          setCommandInput('');
          return;
        }
      }

      if (lower === 'checkout' || lower === 'check out') {
        if (onQuickCheckOut) {
          onQuickCheckOut(selectedShift);
          addLog({
            command: text,
            type: 'success',
            message: `Triggered driver check-out for ${selectedShift.driverName || 'Driver'}.`,
          });
          setCommandInput('');
          return;
        }
      }

      // 8. Delay notification: "delay 15 traffic", "late 10 weather"
      const delayMatch = lower.match(/^(?:delay|late)\s+(\d+)(?:\s+(.+))?$/i);
      if (delayMatch) {
        const mins = parseInt(delayMatch[1], 10);
        const reason = delayMatch[2]?.trim() || 'traffic';
        if (onTriggerDelayAlert) {
          onTriggerDelayAlert(mins, reason);
          addLog({
            command: text,
            type: 'success',
            message: `Pre-filled parent delay alert with +${mins}m (${reason}) for Route ${selectedShift.routeNo}.`,
          });
          setCommandInput('');
          return;
        }
      }

      // 9. Quick informational questions answered directly from shift data
      if (lower === 'driver' || lower.includes('who is driver') || lower.includes("driver name")) {
        addLog({
          command: text,
          type: 'info',
          message: selectedShift.driverName
            ? `Current driver: ${selectedShift.driverName} (Phone: ${selectedShift.driverPhone || 'N/A'}).`
            : 'No driver currently assigned to this shift.',
        });
        setCommandInput('');
        return;
      }

      if (lower === 'vehicle' || lower.includes('what vehicle') || lower.includes('which bus')) {
        addLog({
          command: text,
          type: 'info',
          message: selectedShift.unitNumber
            ? `Current vehicle: Unit #${selectedShift.unitNumber} (Plate: ${selectedShift.plateNumber || 'N/A'}).`
            : 'No vehicle currently assigned to this shift.',
        });
        setCommandInput('');
        return;
      }

      if (lower.includes('student') || lower === 'students') {
        const names = (selectedShift.stops || []).flatMap((s) => (s.assignedStudents || []).map((stu) => `${stu.studentName} (${stu.status || 'scheduled'})`));
        addLog({
          command: text,
          type: 'info',
          message: names.length > 0
            ? `Assigned students on this route: ${names.join(', ')}.`
            : 'No students assigned to stops on this shift.',
        });
        setCommandInput('');
        return;
      }

      // 10. Fallback to Gemini / AI Copilot backend
      try {
        const aiPrompt = `[Context: Target Shift Route ${selectedShift.routeNo} (${selectedShift.shiftType}), Driver: ${selectedShift.driverName || 'None'}, Vehicle: ${selectedShift.unitNumber || 'None'}, First stop: ${selectedShift.firstStopTime}, Total stops: ${selectedShift.totalStops}]: ${text}`;
        const aiRes = await aiService.chat({
          message: aiPrompt,
          date: selectedDate,
        });

        addLog({
          command: text,
          type: 'info',
          message: aiRes.reply || 'AI Copilot processed your inquiry.',
        });
        setCommandInput('');
      } catch (aiErr) {
        addLog({
          command: text,
          type: 'warning',
          message: `Unrecognized command. Try: "driver <name>", "vehicle <unit>", "pickup <student>", "dropoff <student>", "absent <student>", or "checkin".`,
        });
      }
    } catch (err: any) {
      console.error('[ShiftAiCopilotBar] execution error:', err);
      addLog({
        command: text,
        type: 'error',
        message: `Action failed: ${err.message || 'Unknown error occurred'}`,
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExecute(commandInput);
  };

  const sampleStudentName = (selectedShift?.stops || [])
    .flatMap((s) => (s.assignedStudents || []).map((stu) => stu.studentName))[0] || 'Benjamin';

  const sampleDriverName = employees[0]?.firstName || 'driver21';
  const sampleVehicleUnit = availableVehicles[0]?.unitNumber || '1001';

  return (
    <div
      data-testid="shift-ai-copilot-window"
      className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-blue-50/70 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-blue-950/30 shadow-xs mb-3 overflow-hidden transition-all"
    >
      {/* Header Bar */}
      <div className="px-4 py-2.5 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <span>Shift AI Copilot</span>
              </span>
              {selectedShift ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Target: {selectedShift.routeNo} ({selectedShift.shiftType})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  No Shift Selected
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 transition"
            title={isExpanded ? 'Collapse Copilot' : 'Expand Copilot'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Body */}
      {isExpanded && (
        <div className="p-3 sm:p-3.5 space-y-2.5">
          {/* Command Input Form */}
          <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <label htmlFor={inputId} className="sr-only">
                Dispatch AI Copilot Command Input
              </label>
              <input
                id={inputId}
                ref={inputRef}
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder={
                  selectedShift
                    ? `Command for ${selectedShift.routeNo}: e.g. "driver ${sampleDriverName}", "vehicle ${sampleVehicleUnit}", "pickup ${sampleStudentName}"...`
                    : 'Select a shift to execute AI commands...'
                }
                disabled={executing || !selectedShift}
                className="w-full pl-3.5 pr-20 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs transition disabled:opacity-60"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                  <CornerDownLeft className="w-2.5 h-2.5" />
                </kbd>
              </div>
            </div>

            <button
              type="submit"
              disabled={executing || !commandInput.trim() || !selectedShift}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              title="Execute AI Command"
            >
              {executing ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Run</span>
            </button>
          </form>

          {/* Quick Command Suggestions */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar pt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 shrink-0 flex items-center gap-1 mr-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Quick:</span>
            </span>

            <button
              type="button"
              onClick={() => handleExecute(`driver ${sampleDriverName}`)}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800/80 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 transition font-mono shrink-0"
            >
              driver {sampleDriverName}
            </button>

            <button
              type="button"
              onClick={() => handleExecute(`vehicle ${sampleVehicleUnit}`)}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800/80 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 transition font-mono shrink-0"
            >
              vehicle {sampleVehicleUnit}
            </button>

            <button
              type="button"
              onClick={() => handleExecute(`pickup ${sampleStudentName}`)}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800/80 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 transition font-mono shrink-0"
            >
              pickup {sampleStudentName}
            </button>

            <button
              type="button"
              onClick={() => handleExecute(`dropoff ${sampleStudentName}`)}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800/80 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 transition font-mono shrink-0"
            >
              dropoff {sampleStudentName}
            </button>

            <button
              type="button"
              onClick={() => handleExecute('checkin')}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800/80 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 transition font-mono shrink-0"
            >
              checkin
            </button>
          </div>

          {/* Execution History / Status Feed */}
          {logs.length > 0 && (
            <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pt-1 border-t border-indigo-100/80 dark:border-indigo-900/40">
              {logs.map((log) => {
                const isSuccess = log.type === 'success';
                const isWarning = log.type === 'warning';
                const isError = log.type === 'error';

                return (
                  <div
                    key={log.id}
                    className={`p-2 rounded-xl text-xs flex items-start gap-2 border transition ${
                      isSuccess
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                        : isWarning
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                        : isError
                        ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                        : 'bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-900/40 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                      {isWarning && <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                      {isError && <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                      {log.type === 'info' && <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10">
                          &gt; {log.command}
                        </span>
                        <span className="text-[10px] opacity-60 font-mono">• {log.timestamp}</span>
                      </div>
                      <div className="text-[11px] mt-0.5 leading-relaxed font-medium">
                        {log.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
