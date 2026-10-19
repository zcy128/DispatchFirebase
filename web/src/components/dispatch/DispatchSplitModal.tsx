import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Split,
  Plus,
  Trash2,
  User,
  Truck,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Check,
  CheckCircle2,
  MapPin,
  MoveHorizontal,
  GraduationCap,
  Clock
} from 'lucide-react';
import { DispatchShift, SplitShiftPart } from '../../types/dispatch';
import { DispatchService } from '../../services/dispatchService';
import { Employee } from '../../types/employee';
import { Vehicle } from '../../types/vehicle';
import { useAuth } from '../../contexts/AuthContext';
import { logDispatchAction } from '../../utils/dispatchLogger';

interface DispatchSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: DispatchShift | null;
  employees: Employee[];
  vehicles: Vehicle[];
  onSplitComplete: (newShifts: DispatchShift[]) => void;
}

interface StudentItem {
  studentId: number;
  studentNo?: string;
  studentName: string;
  schoolName?: string;
  stopLocation?: string;
  stopScheduleTime?: string;
}

interface SplitPartState {
  id: string;
  suffix: string; // "A", "B", "C"...
  routeNo: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleId: number | undefined;
  unitNumber: string;
  plateNumber: string;
  attendantId: string;
  attendantName: string;
  attendantPhone: string;
  studentIds: number[];
}

const SUFFIXES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const isSchoolStopType = (stopType?: string): boolean => {
  const t = (stopType || '').toLowerCase().trim();
  return t.includes('school') && !t.includes('home') && !t.includes('corner') && !t.includes('yard');
};

export const DispatchSplitModal: React.FC<DispatchSplitModalProps> = ({
  isOpen,
  onClose,
  shift,
  employees,
  vehicles,
  onSplitComplete,
}) => {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  if (!isOpen || !shift) return null;

  // Extract all unique students from shift stops, prioritizing their home pickup/dropoff stop for time & location
  const allStudents = useMemo(() => {
    const map = new Map<number, StudentItem>();
    const stops = Array.isArray(shift.stops) ? shift.stops : [];

    stops.forEach((st) => {
      const isHome = !isSchoolStopType(st.stopType);
      if (Array.isArray(st.assignedStudents)) {
        st.assignedStudents.forEach((stu) => {
          const sid = stu.studentId;
          const existing = map.get(sid);
          if (!existing || isHome) {
            map.set(sid, {
              studentId: sid,
              studentNo: stu.studentNo,
              studentName: stu.studentName,
              schoolName: stu.schoolName || st.schoolName,
              stopLocation: isHome ? st.stopLocation : (existing?.stopLocation || st.stopLocation),
              stopScheduleTime: isHome ? st.stopScheduleTime : (existing?.stopScheduleTime || st.stopScheduleTime),
            });
          }
        });
      }
    });

    return Array.from(map.values());
  }, [shift]);

  // Extract all school destination stops (strictly SchoolDropoff / SchoolPickup, excluding HomePickup)
  const allSchoolStops = useMemo(() => {
    const stops = Array.isArray(shift.stops) ? shift.stops : [];
    return stops.filter((st) => isSchoolStopType(st.stopType));
  }, [shift]);

  // Dynamically compute the replicated school stops and assigned student roster for each split partition
  const getPartitionSchoolStops = (partStudentIds: number[]) => {
    const studentSet = new Set(partStudentIds);
    const assignedStudentsInPart = allStudents.filter((s) => studentSet.has(s.studentId));

    return allSchoolStops
      .map((st) => {
        const schName = (st.schoolName || '').trim().toLowerCase();
        // 1. Match students in this partition whose school matches this stop
        let matching = assignedStudentsInPart.filter((stu) => {
          if (!stu.schoolName || !schName) return false;
          const sSch = stu.schoolName.trim().toLowerCase();
          return sSch === schName || sSch.includes(schName) || schName.includes(sSch);
        });

        // 2. Check if student was explicitly assigned in original stop
        if (matching.length === 0 && Array.isArray(st.assignedStudents)) {
          const origIds = new Set(st.assignedStudents.map((s) => s.studentId));
          matching = assignedStudentsInPart.filter((stu) => origIds.has(stu.studentId));
        }

        // 3. Fallback: If only 1 school stop in the route, all partition students drop off here
        if (matching.length === 0 && allSchoolStops.length === 1 && assignedStudentsInPart.length > 0) {
          matching = assignedStudentsInPart;
        }

        return {
          stopId: st.stopId,
          schoolName: st.schoolName || st.stopLocation,
          stopLocation: st.stopLocation,
          stopScheduleTime: st.stopScheduleTime,
          stopType: st.stopType,
          students: matching,
          studentCount: matching.length,
        };
      })
      .filter((s) => s.studentCount > 0);
  };

  // Clean base route number without existing split suffix
  const baseRouteNo = useMemo(() => {
    let base = shift.routeNo;
    for (const suf of SUFFIXES) {
      if (base.endsWith('-' + suf)) {
        base = base.substring(0, base.length - 2);
        break;
      }
    }
    return base;
  }, [shift.routeNo]);

  // Initialize split parts (default 2 parts: Shift A & Shift B)
  const [parts, setParts] = useState<SplitPartState[]>(() => {
    const studentIds = allStudents.map((s) => s.studentId);
    return [
      {
        id: 'part-0',
        suffix: 'A',
        routeNo: `${baseRouteNo}-A`,
        driverId: shift.driverId || '',
        driverName: shift.driverName || '',
        driverPhone: shift.driverPhone || '',
        vehicleId: shift.vehicleId,
        unitNumber: shift.unitNumber || '',
        plateNumber: shift.plateNumber || '',
        attendantId: shift.attendantId || '',
        attendantName: shift.attendantName || '',
        attendantPhone: shift.attendantPhone || '',
        studentIds: studentIds, // All students start in Shift A
      },
      {
        id: 'part-1',
        suffix: 'B',
        routeNo: `${baseRouteNo}-B`,
        driverId: '',
        driverName: '',
        driverPhone: '',
        vehicleId: undefined,
        unitNumber: '',
        plateNumber: '',
        attendantId: '',
        attendantName: '',
        attendantPhone: '',
        studentIds: [], // Empty initially
      },
    ];
  });

  // Re-sync when shift changes
  useEffect(() => {
    const studentIds = allStudents.map((s) => s.studentId);
    setParts([
      {
        id: 'part-0',
        suffix: 'A',
        routeNo: `${baseRouteNo}-A`,
        driverId: shift.driverId || '',
        driverName: shift.driverName || '',
        driverPhone: shift.driverPhone || '',
        vehicleId: shift.vehicleId,
        unitNumber: shift.unitNumber || '',
        plateNumber: shift.plateNumber || '',
        attendantId: shift.attendantId || '',
        attendantName: shift.attendantName || '',
        attendantPhone: shift.attendantPhone || '',
        studentIds: studentIds,
      },
      {
        id: 'part-1',
        suffix: 'B',
        routeNo: `${baseRouteNo}-B`,
        driverId: '',
        driverName: '',
        driverPhone: '',
        vehicleId: undefined,
        unitNumber: '',
        plateNumber: '',
        attendantId: '',
        attendantName: '',
        attendantPhone: '',
        studentIds: [],
      },
    ]);
  }, [shift.id, allStudents, baseRouteNo]);

  const [saving, setSaving] = useState(false);
  const [draggedStudentId, setDraggedStudentId] = useState<number | null>(null);
  const [dragOverPartId, setDragOverPartId] = useState<string | null>(null);

  const activeDrivers = useMemo(() => employees.filter((e) => e.isActive !== false), [employees]);
  const activeVehicles = useMemo(() => vehicles.filter((v) => v.active !== false), [vehicles]);

  // Add another split partition (e.g. Shift C, Shift D...)
  const handleAddPart = () => {
    if (parts.length >= SUFFIXES.length) return;
    const nextIndex = parts.length;
    const suffix = SUFFIXES[nextIndex];
    const newPart: SplitPartState = {
      id: `part-${Date.now()}`,
      suffix,
      routeNo: `${baseRouteNo}-${suffix}`,
      driverId: '',
      driverName: '',
      driverPhone: '',
      vehicleId: undefined,
      unitNumber: '',
      plateNumber: '',
      attendantId: '',
      attendantName: '',
      attendantPhone: '',
      studentIds: [],
    };
    setParts((prev) => [...prev, newPart]);
  };

  // Remove split partition (minimum 2 partitions required)
  const handleRemovePart = (partIndex: number) => {
    if (parts.length <= 2) return;
    const partToRemove = parts[partIndex];
    const remainingStudents = partToRemove.studentIds;

    setParts((prev) => {
      const updated = prev.filter((_, idx) => idx !== partIndex);
      // Return displaced students to part 0
      updated[0].studentIds = [...updated[0].studentIds, ...remainingStudents];
      // Re-assign suffixes and route numbers
      return updated.map((p, idx) => ({
        ...p,
        suffix: SUFFIXES[idx],
        routeNo: `${baseRouteNo}-${SUFFIXES[idx]}`,
      }));
    });
  };

  // Move student between parts
  const moveStudent = (studentId: number, targetPartIndex: number) => {
    setParts((prev) => {
      return prev.map((p, idx) => {
        if (idx === targetPartIndex) {
          if (!p.studentIds.includes(studentId)) {
            return { ...p, studentIds: [...p.studentIds, studentId] };
          }
          return p;
        } else {
          return { ...p, studentIds: p.studentIds.filter((id) => id !== studentId) };
        }
      });
    });
  };

  // Update crew selection for a part
  const handleDriverChange = (partIndex: number, driverId: string) => {
    const selected = employees.find((e) => e.id === driverId);
    setParts((prev) => {
      const copy = [...prev];
      copy[partIndex] = {
        ...copy[partIndex],
        driverId,
        driverName: selected ? `${selected.firstName} ${selected.lastName}` : '',
        driverPhone: selected ? selected.preferredPhone || selected.mobilePhone || '' : '',
      };
      return copy;
    });
  };

  const handleVehicleChange = (partIndex: number, vehIdStr: string) => {
    const veh = vehicles.find((v) => String(v.vehicleId) === vehIdStr);
    setParts((prev) => {
      const copy = [...prev];
      copy[partIndex] = {
        ...copy[partIndex],
        vehicleId: veh ? veh.vehicleId : undefined,
        unitNumber: veh ? veh.unitNumber : '',
        plateNumber: veh ? veh.plateNumber : '',
      };
      return copy;
    });
  };

  // Validation
  const hasEmptyPart = parts.some((p) => p.studentIds.length === 0);
  const totalStudentsAssigned = parts.reduce((acc, p) => acc + p.studentIds.length, 0);

  // Submit split request
  const handleSubmit = async () => {
    if (hasEmptyPart) {
      alert('Every split shift must contain at least one student.');
      return;
    }

    try {
      setSaving(true);
      const payload: SplitShiftPart[] = parts.map((p) => ({
        routeSuffix: p.suffix,
        routeNo: p.routeNo,
        driverId: p.driverId,
        driverName: p.driverName,
        driverPhone: p.driverPhone,
        vehicleId: p.vehicleId || 0,
        unitNumber: p.unitNumber,
        plateNumber: p.plateNumber,
        attendantId: p.attendantId,
        attendantName: p.attendantName,
        attendantPhone: p.attendantPhone,
        studentIds: p.studentIds,
      }));

      const results = await DispatchService.splitShift(shift.id, payload);

      await logDispatchAction({
        date: shift.dispatchDate,
        type: 'Shift Split',
        detail: `Shift ${shift.routeNo} split into ${payload.map((p) => p.routeNo).join(', ')}`,
        shift,
        user: actorName,
      });

      alert(`Shift successfully split into ${results.length} separate routes!`);
      onSplitComplete(results);
      onClose();
    } catch (err: any) {
      console.error('Failed to split shift:', err);
      alert('Error splitting shift: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Split Dispatch Shift
                </h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {shift.routeNo} • {shift.shiftType}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({allStudents.length} total students)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Redistribute students into multiple shifts. Keep the original driver on Shift A and assign new crew for the split routes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddPart}
              disabled={parts.length >= SUFFIXES.length}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-xs transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Split Shift</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Multi-column Drag and Drop Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className={`grid grid-cols-1 md:grid-cols-${Math.min(parts.length, 3)} lg:grid-cols-${parts.length} gap-4`}>
            {parts.map((part, partIndex) => {
              const partStudents = allStudents.filter((s) => part.studentIds.includes(s.studentId));
              const partitionSchoolStops = getPartitionSchoolStops(part.studentIds);
              const isOriginal = partIndex === 0;
              const isDragTarget = dragOverPartId === part.id;

              return (
                <div
                  key={part.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverPartId !== part.id) setDragOverPartId(part.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverPartId === part.id) setDragOverPartId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverPartId(null);
                    const sId = Number(e.dataTransfer.getData('text/plain') || draggedStudentId);
                    if (sId) {
                      moveStudent(sId, partIndex);
                    }
                  }}
                  className={`rounded-2xl border transition-all flex flex-col bg-slate-50/70 dark:bg-slate-850/60 ${
                    isDragTarget
                      ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/20 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold font-mono text-xs text-amber-600 dark:text-amber-400">
                          {part.suffix}
                        </span>
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono">
                            {part.routeNo}
                          </h4>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                            {isOriginal ? 'Primary (Original Route)' : `Split Route #${partIndex + 1}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {part.studentIds.length} {part.studentIds.length === 1 ? 'student' : 'students'}
                        </span>
                        {!isOriginal && parts.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePart(partIndex)}
                            title="Remove this split shift and return students to Shift A"
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Crew Assignment Selectors */}
                    <div className="space-y-1.5 pt-1 text-xs">
                      {/* Driver */}
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <select
                          value={part.driverId}
                          onChange={(e) => handleDriverChange(partIndex, e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="">{isOriginal ? '-- Keep Original Driver --' : '-- Assign Driver --'}</option>
                          {activeDrivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.firstName} {d.lastName}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Vehicle Unit */}
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <select
                          value={part.vehicleId ? String(part.vehicleId) : ''}
                          onChange={(e) => handleVehicleChange(partIndex, e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="">{isOriginal ? '-- Keep Original Vehicle --' : '-- Assign Vehicle --'}</option>
                          {activeVehicles.map((v) => (
                            <option key={v.vehicleId} value={v.vehicleId}>
                              Unit {v.unitNumber} ({v.plateNumber})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Destination School Stops Preview */}
                  <div className="px-3.5 py-2 bg-blue-50/60 dark:bg-blue-950/30 border-b border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 dark:text-blue-200">
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>School Stops ({partitionSchoolStops.length})</span>
                      </span>
                      <span className="text-[10px] text-blue-600/80 dark:text-blue-300/80 font-normal">
                        Auto-replicated
                      </span>
                    </div>

                    {partitionSchoolStops.length === 0 ? (
                      <div className="text-[10px] text-slate-400 italic py-0.5">
                        No students attending school in this shift yet.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {partitionSchoolStops.map((sch) => (
                          <div
                            key={sch.stopId}
                            className="flex items-center justify-between text-xs bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-blue-200/80 dark:border-blue-900/50 shadow-2xs"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-slate-800 dark:text-slate-100 truncate text-[11px]">
                                {sch.schoolName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {sch.stopScheduleTime} • {sch.stopType}
                              </div>
                            </div>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0"
                              title={sch.students.map((s) => s.studentName).join(', ')}
                            >
                              {sch.studentCount} {sch.studentCount === 1 ? 'student' : 'students'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Student Cards List / Drop Zone */}
                  <div className="p-2.5 flex-1 min-h-[160px] space-y-2 overflow-y-auto">
                    {partStudents.length === 0 ? (
                      <div className="h-full min-h-[130px] border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center p-4 text-center">
                        <MoveHorizontal className="w-6 h-6 text-slate-400 mb-1 opacity-60" />
                        <p className="text-xs font-semibold text-slate-400">Drop students here</p>
                        <p className="text-[10px] text-slate-400">or use arrows to assign</p>
                      </div>
                    ) : (
                      partStudents.map((student) => (
                        <div
                          key={student.studentId}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(student.studentId));
                            setDraggedStudentId(student.studentId);
                          }}
                          onDragEnd={() => {
                            setDraggedStudentId(null);
                            setDragOverPartId(null);
                          }}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-2xs hover:border-amber-400 transition cursor-grab active:cursor-grabbing space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {student.studentName}
                            </span>
                            {student.studentNo && (
                              <span className="text-[10px] font-mono text-slate-400">
                                #{student.studentNo}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1.5 text-[11px]">
                            <div className="flex items-center gap-1 min-w-0 truncate text-slate-600 dark:text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate font-medium">{student.stopLocation || 'Stop location'}</span>
                            </div>
                            {student.stopScheduleTime && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 shrink-0 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{student.stopScheduleTime}</span>
                              </span>
                            )}
                          </div>

                          {student.schoolName && (
                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">
                              Services: {student.schoolName}
                            </div>
                          )}

                          {/* Quick Transfer Button Row for Mobile Touch */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                            {/* Move Left */}
                            {partIndex > 0 ? (
                              <button
                                type="button"
                                onClick={() => moveStudent(student.studentId, partIndex - 1)}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-0.5"
                                title={`Move to Shift ${parts[partIndex - 1].suffix}`}
                              >
                                <ArrowLeft className="w-2.5 h-2.5" />
                                <span>Shift {parts[partIndex - 1].suffix}</span>
                              </button>
                            ) : <span />}

                            {/* Move Right */}
                            {partIndex < parts.length - 1 ? (
                              <button
                                type="button"
                                onClick={() => moveStudent(student.studentId, partIndex + 1)}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-0.5"
                                title={`Move to Shift ${parts[partIndex + 1].suffix}`}
                              >
                                <span>Shift {parts[partIndex + 1].suffix}</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            ) : <span />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            {hasEmptyPart ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Every split shift must have at least 1 student.
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All {totalStudentsAssigned} students distributed across {parts.length} split shifts.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={saving || hasEmptyPart}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? 'Creating Split Shifts...' : `Confirm Split (${parts.length} Shifts)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
