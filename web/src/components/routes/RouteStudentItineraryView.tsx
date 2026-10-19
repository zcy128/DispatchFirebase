import React, { useState, useMemo, useEffect } from 'react';
import { BusRoute, BusRouteShift, RouteStop, formatOpDays } from '../../types/route';
import { Student } from '../../types/student';
import { School } from '../../types/school';
import { StudentService } from '../../services/studentService';
import { persistShiftAssignments, normalizeAddress } from '../../services/stopAssignmentService';
import { useAuth } from '../../contexts/AuthContext';
import { RouteAuditService } from '../../services/routeAuditService';
import { RouteChangeFieldDiff } from '../../types/routeAudit';
import { useI18n } from '../../contexts/I18nContext';
import {
  Save,
  RotateCcw,
  Clock,
  School as SchoolIcon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';

interface RouteStudentItineraryViewProps {
  route: BusRoute;
  shifts: BusRouteShift[];
  studentsMap: Record<number, Student>;
  schools: School[];
  onSelectStudent?: (student: Student) => void;
  onRefreshShifts: () => Promise<void>;
}

interface StudentRowEdits {
  pickupTime?: string;
  dropoffTime?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
}

interface RouteStudentInfo {
  studentId: number;
  studentNo: string;
  studentName: string;
  fullName: string;
  schoolName?: string;
  master?: Student;
}

export const RouteStudentItineraryView: React.FC<RouteStudentItineraryViewProps> = ({
  route,
  shifts,
  studentsMap,
  schools,
  onSelectStudent,
  onRefreshShifts
}) => {
  const { t } = useI18n();
  const { currentUser } = useAuth();

  // 1. Shift Categorization: AM vs PM/NOON
  const amShifts = useMemo(() => {
    return shifts.filter((s) => (s.shiftType || '').toUpperCase() === 'AM');
  }, [shifts]);

  const pmShifts = useMemo(() => {
    return shifts.filter(
      (s) =>
        (s.shiftType || '').toUpperCase() === 'PM' ||
        (s.shiftType || '').toUpperCase() === 'NOON' ||
        (s.shiftType || '').toUpperCase() === 'MIDDAY'
    );
  }, [shifts]);

  const [pickupShiftId, setPickupShiftId] = useState<string>('');
  const [dropoffShiftId, setDropoffShiftId] = useState<string>('');

  useEffect(() => {
    if (amShifts.length > 0) {
      setPickupShiftId((prev) => (amShifts.some((s) => s.id === prev) ? prev : amShifts[0].id));
    } else if (shifts.length > 0) {
      setPickupShiftId(shifts[0].id);
    }

    if (pmShifts.length > 0) {
      setDropoffShiftId((prev) => (pmShifts.some((s) => s.id === prev) ? prev : pmShifts[0].id));
    } else if (shifts.length > 1) {
      setDropoffShiftId(shifts[1].id);
    } else if (shifts.length > 0) {
      setDropoffShiftId(shifts[0].id);
    }
  }, [amShifts, pmShifts, shifts]);

  const activePickupShift = useMemo(() => {
    return shifts.find((s) => s.id === pickupShiftId) || amShifts[0] || shifts[0];
  }, [shifts, pickupShiftId, amShifts]);

  const activeDropoffShift = useMemo(() => {
    return shifts.find((s) => s.id === dropoffShiftId) || pmShifts[0] || shifts[shifts.length - 1] || shifts[0];
  }, [shifts, dropoffShiftId, pmShifts]);

  // 2. Collect all distinct students on this route (Note 1: one stop can have multiple students)
  const routeStudents = useMemo(() => {
    const map = new Map<number, RouteStudentInfo>();

    // From shift stops
    shifts.forEach((shift) => {
      shift.stops?.forEach((stop) => {
        const isSchool = stop.stopType?.toLowerCase().includes('school');
        if (!isSchool) {
          stop.assignedStudents?.forEach((st) => {
            if (!map.has(st.studentId)) {
              const master = studentsMap[st.studentId];
              map.set(st.studentId, {
                studentId: st.studentId,
                studentNo: st.studentNo || master?.studentNo || '',
                studentName: st.studentName || master?.studentName || 'Student',
                fullName: master?.fullName || st.studentName,
                schoolName: master?.schoolName || st.schoolName,
                master
              });
            }
          });
        }
      });
    });

    // Also include students linked by student.routes
    Object.values(studentsMap).forEach((st) => {
      if (st.routes) {
        const rList = st.routes.split(',').map((r) => r.trim());
        if (rList.includes(route.routeNo) && !map.has(st.studentId)) {
          map.set(st.studentId, {
            studentId: st.studentId,
            studentNo: st.studentNo,
            studentName: st.studentName,
            fullName: st.fullName || st.studentName,
            schoolName: st.schoolName,
            master: st
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [shifts, studentsMap, route.routeNo]);

  // 3. Multi-School detection (Requirement 3: if route serves multiple schools, display school name under student)
  const distinctSchoolsOnRoute = useMemo(() => {
    const set = new Set<string>();
    routeStudents.forEach((stu) => {
      if (stu.schoolName && stu.schoolName.trim()) {
        set.add(stu.schoolName.trim());
      }
    });
    // Also include school names from route stops
    shifts.forEach((s) => {
      s.stops?.forEach((stop) => {
        if (stop.schoolName && stop.schoolName.trim()) {
          set.add(stop.schoolName.trim());
        }
      });
    });
    return Array.from(set);
  }, [routeStudents, shifts]);

  const hasMultipleSchools = distinctSchoolsOnRoute.length > 1;

  // Helper to reliably find student stop in a shift
  const findStudentStopInShift = (
    shift: BusRouteShift | undefined,
    student: RouteStudentInfo,
    fallbackAddress?: string
  ): RouteStop | undefined => {
    if (!shift?.stops) return undefined;
    // 1. Primary: match by studentId or studentNo
    let match = shift.stops.find((st) => {
      if (st.stopType?.toLowerCase().includes('school')) return false;
      return st.assignedStudents?.some(
        (s) => s.studentId === student.studentId || (s.studentNo && student.studentNo && s.studentNo === student.studentNo)
      );
    });
    // 2. Secondary: fallback match by address
    if (!match && fallbackAddress) {
      const norm = normalizeAddress(fallbackAddress);
      match = shift.stops.find(
        (st) => !st.stopType?.toLowerCase().includes('school') && normalizeAddress(st.stopLocation) === norm
      );
    }
    return match;
  };

  // 4. Resolve original values for each student
  const getOriginalValues = (student: RouteStudentInfo) => {
    const master = student.master || studentsMap[student.studentId];

    const pickupStop = findStudentStopInShift(activePickupShift, student, master?.studentAddress);
    const dropoffStop = findStudentStopInShift(activeDropoffShift, student, master?.studentAddress);

    const pickupTime = pickupStop?.pullawayTime || '';
    const pickupAddress = pickupStop?.stopLocation || master?.studentAddress || '';
    const dropoffTime = dropoffStop?.pullawayTime || '';
    const dropoffAddress = dropoffStop?.stopLocation || master?.studentAddress || '';

    return {
      pickupTime,
      pickupAddress,
      dropoffTime,
      dropoffAddress,
      pickupStop,
      dropoffStop
    };
  };

  // 5. Pending Edits State (Requirement 2: modified but unsaved fields show warning color)
  const [pendingEdits, setPendingEdits] = useState<Record<number, StudentRowEdits>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCellChange = (
    studentId: number,
    field: keyof StudentRowEdits,
    value: string
  ) => {
    setPendingEdits((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
    setFeedback(null);
  };

  const handleReset = () => {
    setPendingEdits({});
    setFeedback(null);
  };

  // Check dirty counts
  const dirtyFieldsCount = useMemo(() => {
    let count = 0;
    routeStudents.forEach((stu) => {
      const orig = getOriginalValues(stu);
      const edits = pendingEdits[stu.studentId];
      if (!edits) return;

      if (edits.pickupTime !== undefined && edits.pickupTime !== orig.pickupTime) count++;
      if (edits.dropoffTime !== undefined && edits.dropoffTime !== orig.dropoffTime) count++;
      if (edits.pickupAddress !== undefined && edits.pickupAddress !== orig.pickupAddress) count++;
      if (edits.dropoffAddress !== undefined && edits.dropoffAddress !== orig.dropoffAddress) count++;
    });
    return count;
  }, [routeStudents, pendingEdits, activePickupShift, activeDropoffShift]);

  // 6. Save handler: updates shifts in Firestore and student personal records
  const handleSave = async () => {
    if (dirtyFieldsCount === 0) return;

    setSaving(true);
    setFeedback(null);

    try {
      // Clone shifts for in-memory modification
      const clonedShifts: BusRouteShift[] = JSON.parse(JSON.stringify(shifts));
      const targetPickup = clonedShifts.find((s) => s.id === activePickupShift?.id);
      const targetDropoff = clonedShifts.find((s) => s.id === activeDropoffShift?.id);

      for (const stu of routeStudents) {
        const edits = pendingEdits[stu.studentId];
        if (!edits) continue;

        const orig = getOriginalValues(stu);
        const master = stu.master || studentsMap[stu.studentId];

        // 1. Process Pickup Stop Modifications
        if (targetPickup && (edits.pickupTime !== undefined || edits.pickupAddress !== undefined)) {
          const newTime = edits.pickupTime !== undefined ? edits.pickupTime : orig.pickupTime;
          const newAddress = edits.pickupAddress !== undefined ? edits.pickupAddress : orig.pickupAddress;

          // Find the pickup stop in targetPickup using robust matching
          targetPickup.stops = targetPickup.stops || [];
          let currentStop = findStudentStopInShift(targetPickup, stu, orig.pickupAddress);

          if (currentStop) {
            // Note 1: Stop may have multiple students
            const isShared = (currentStop.assignedStudents?.length || 0) > 1;
            const addressChanged = edits.pickupAddress !== undefined && edits.pickupAddress !== orig.pickupAddress;

            if (isShared && addressChanged) {
              // Remove student from shared stop
              currentStop.assignedStudents = (currentStop.assignedStudents || []).filter(
                (s) => s.studentId !== stu.studentId && s.studentNo !== stu.studentNo
              );

              // Check if another non-school stop with new address already exists
              const normNew = normalizeAddress(newAddress);
              let existingWithNewAddr = targetPickup.stops.find(
                (st) => !st.stopType?.toLowerCase().includes('school') && normalizeAddress(st.stopLocation) === normNew
              );

              if (existingWithNewAddr) {
                existingWithNewAddr.assignedStudents = existingWithNewAddr.assignedStudents || [];
                const alreadyAssigned = existingWithNewAddr.assignedStudents.some(
                  (s) => s.studentId === stu.studentId || (s.studentNo && stu.studentNo && s.studentNo === stu.studentNo)
                );
                if (!alreadyAssigned) {
                  existingWithNewAddr.assignedStudents.push({
                    studentId: stu.studentId,
                    studentNo: stu.studentNo,
                    studentName: stu.fullName,
                    schoolName: stu.schoolName
                  });
                }
              } else {
                // Create dedicated stop for this student with new address
                const newStop: RouteStop = {
                  stopId: Date.now() + Math.floor(Math.random() * 1000),
                  sequence: currentStop.sequence,
                  stopLocation: newAddress,
                  pullawayTime: newTime || currentStop.pullawayTime,
                  stopType: currentStop.stopType || 'HomePickup',
                  runDays: targetPickup.runDays,
                  comment: currentStop.comment,
                  instruction: currentStop.instruction,
                  assignedStudents: [
                    {
                      studentId: stu.studentId,
                      studentNo: stu.studentNo,
                      studentName: stu.fullName,
                      schoolName: stu.schoolName
                    }
                  ]
                };
                targetPickup.stops.push(newStop);
              }
            } else {
              // Sole student or time-only update: update the stop directly
              if (edits.pickupTime !== undefined) currentStop.pullawayTime = newTime;
              if (edits.pickupAddress !== undefined) currentStop.stopLocation = newAddress;

              // Ensure student is in assignedStudents
              currentStop.assignedStudents = currentStop.assignedStudents || [];
              const hasStudent = currentStop.assignedStudents.some(
                (s) => s.studentId === stu.studentId || (s.studentNo && stu.studentNo && s.studentNo === stu.studentNo)
              );
              if (!hasStudent) {
                currentStop.assignedStudents.push({
                  studentId: stu.studentId,
                  studentNo: stu.studentNo,
                  studentName: stu.fullName,
                  schoolName: stu.schoolName
                });
              }
            }
          } else if (newAddress) {
            // Student did not have a stop in targetPickup yet: find or create stop
            const normNew = normalizeAddress(newAddress);
            let existingWithNewAddr = targetPickup.stops.find(
              (st) => !st.stopType?.toLowerCase().includes('school') && normalizeAddress(st.stopLocation) === normNew
            );
            if (existingWithNewAddr) {
              existingWithNewAddr.assignedStudents = existingWithNewAddr.assignedStudents || [];
              const alreadyAssigned = existingWithNewAddr.assignedStudents.some(
                (s) => s.studentId === stu.studentId || (s.studentNo && stu.studentNo && s.studentNo === stu.studentNo)
              );
              if (!alreadyAssigned) {
                existingWithNewAddr.assignedStudents.push({
                  studentId: stu.studentId,
                  studentNo: stu.studentNo,
                  studentName: stu.fullName,
                  schoolName: stu.schoolName
                });
              }
            } else {
              const newStop: RouteStop = {
                stopId: Date.now() + Math.floor(Math.random() * 1000),
                sequence: targetPickup.stops.length + 1,
                stopLocation: newAddress,
                pullawayTime: newTime || '07:30',
                stopType: 'HomePickup',
                runDays: targetPickup.runDays,
                assignedStudents: [
                  {
                    studentId: stu.studentId,
                    studentNo: stu.studentNo,
                    studentName: stu.fullName,
                    schoolName: stu.schoolName
                  }
                ]
              };
              targetPickup.stops.push(newStop);
            }
          }
        }

        // 2. Process Dropoff Stop Modifications
        if (targetDropoff && (edits.dropoffTime !== undefined || edits.dropoffAddress !== undefined)) {
          const newTime = edits.dropoffTime !== undefined ? edits.dropoffTime : orig.dropoffTime;
          const newAddress = edits.dropoffAddress !== undefined ? edits.dropoffAddress : orig.dropoffAddress;

          targetDropoff.stops = targetDropoff.stops || [];
          let currentStop = findStudentStopInShift(targetDropoff, stu, orig.dropoffAddress);

          if (currentStop) {
            const isShared = (currentStop.assignedStudents?.length || 0) > 1;
            const addressChanged = edits.dropoffAddress !== undefined && edits.dropoffAddress !== orig.dropoffAddress;

            if (isShared && addressChanged) {
              currentStop.assignedStudents = (currentStop.assignedStudents || []).filter(
                (s) => s.studentId !== stu.studentId && s.studentNo !== stu.studentNo
              );

              const normNew = normalizeAddress(newAddress);
              let existingWithNewAddr = targetDropoff.stops.find(
                (st) => !st.stopType?.toLowerCase().includes('school') && normalizeAddress(st.stopLocation) === normNew
              );

              if (existingWithNewAddr) {
                existingWithNewAddr.assignedStudents = existingWithNewAddr.assignedStudents || [];
                const alreadyAssigned = existingWithNewAddr.assignedStudents.some(
                  (s) => s.studentId === stu.studentId || (s.studentNo && stu.studentNo && s.studentNo === stu.studentNo)
                );
                if (!alreadyAssigned) {
                  existingWithNewAddr.assignedStudents.push({
                    studentId: stu.studentId,
                    studentNo: stu.studentNo,
                    studentName: stu.fullName,
                    schoolName: stu.schoolName
                  });
                }
              } else {
                const newStop: RouteStop = {
                  stopId: Date.now() + Math.floor(Math.random() * 1000) + 2,
                  sequence: currentStop.sequence,
                  stopLocation: newAddress,
                  pullawayTime: newTime || currentStop.pullawayTime,
                  stopType: currentStop.stopType || 'HomeDropoff',
                  runDays: targetDropoff.runDays,
                  comment: currentStop.comment,
                  instruction: currentStop.instruction,
                  assignedStudents: [
                    {
                      studentId: stu.studentId,
                      studentNo: stu.studentNo,
                      studentName: stu.fullName,
                      schoolName: stu.schoolName
                    }
                  ]
                };
                targetDropoff.stops.push(newStop);
              }
            } else {
              if (edits.dropoffTime !== undefined) currentStop.pullawayTime = newTime;
              if (edits.dropoffAddress !== undefined) currentStop.stopLocation = newAddress;

              currentStop.assignedStudents = currentStop.assignedStudents || [];
              const hasStudent = currentStop.assignedStudents.some(
                (s) => s.studentId === stu.studentId || (s.studentNo && stu.studentNo && s.studentNo === stu.studentNo)
              );
              if (!hasStudent) {
                currentStop.assignedStudents.push({
                  studentId: stu.studentId,
                  studentNo: stu.studentNo,
                  studentName: stu.fullName,
                  schoolName: stu.schoolName
                });
              }
            }
          } else if (newAddress) {
            const normNew = normalizeAddress(newAddress);
            let existingWithNewAddr = targetDropoff.stops.find(
              (st) => !st.stopType?.toLowerCase().includes('school') && normalizeAddress(st.stopLocation) === normNew
            );
            if (existingWithNewAddr) {
              existingWithNewAddr.assignedStudents = existingWithNewAddr.assignedStudents || [];
              const alreadyAssigned = existingWithNewAddr.assignedStudents.some(
                (s) => s.studentId === stu.studentId || (s.studentNo && stu.studentNo && s.studentNo === stu.studentNo)
              );
              if (!alreadyAssigned) {
                existingWithNewAddr.assignedStudents.push({
                  studentId: stu.studentId,
                  studentNo: stu.studentNo,
                  studentName: stu.fullName,
                  schoolName: stu.schoolName
                });
              }
            } else {
              const newStop: RouteStop = {
                stopId: Date.now() + Math.floor(Math.random() * 1000) + 2,
                sequence: targetDropoff.stops.length + 1,
                stopLocation: newAddress,
                pullawayTime: newTime || '15:00',
                stopType: 'HomeDropoff',
                runDays: targetDropoff.runDays,
                assignedStudents: [
                  {
                    studentId: stu.studentId,
                    studentNo: stu.studentNo,
                    studentName: stu.fullName,
                    schoolName: stu.schoolName
                  }
                ]
              };
              targetDropoff.stops.push(newStop);
            }
          }
        }

        // 3. Update Student Record in Firestore
        if (master?.id) {
          const studentPayload: Partial<Student> = { ...master };
          if (edits.pickupAddress && edits.pickupAddress.trim()) {
            studentPayload.studentAddress = edits.pickupAddress.trim();
          }

          // Update student personal stops itinerary
          if (master.stops && master.stops.length > 0) {
            const updatedStops = master.stops.map((s) => {
              if (s.route === route.routeNo) {
                if ((s.shift === 'AM' || s.type.toLowerCase().includes('pickup')) && edits.pickupTime) {
                  return { ...s, time: edits.pickupTime, location: edits.pickupAddress || s.location };
                }
                if ((s.shift === 'PM' || s.type.toLowerCase().includes('dropoff')) && edits.dropoffTime) {
                  return { ...s, time: edits.dropoffTime, location: edits.dropoffAddress || s.location };
                }
              }
              return s;
            });
            studentPayload.stops = updatedStops;
          }

          if (Object.keys(studentPayload).length > 0) {
            try {
              await StudentService.update(master.id, studentPayload);
            } catch (studentErr) {
              console.warn('[RouteStudentItinerary] Student update warning:', studentErr);
            }
          }
        }
      }

      // Persist modified shifts to Firestore
      await persistShiftAssignments(clonedShifts);

      // Audit Log: Record student itinerary modifications
      const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
      const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
      const actorRole = currentUser?.role || 'dispatcher';
      const actorEmail = currentUser?.email || undefined;

      for (const stu of routeStudents) {
        const edits = pendingEdits[stu.studentId];
        if (!edits) continue;
        const orig = getOriginalValues(stu);

        const stuDiffs: RouteChangeFieldDiff[] = [];
        if (edits.pickupTime !== undefined && edits.pickupTime !== orig.pickupTime) {
          stuDiffs.push({ field: 'pickupTime', fieldLabel: 'Pickup Time', oldValue: orig.pickupTime, newValue: edits.pickupTime });
        }
        if (edits.dropoffTime !== undefined && edits.dropoffTime !== orig.dropoffTime) {
          stuDiffs.push({ field: 'dropoffTime', fieldLabel: 'Dropoff Time', oldValue: orig.dropoffTime, newValue: edits.dropoffTime });
        }
        if (edits.pickupAddress !== undefined && edits.pickupAddress !== orig.pickupAddress) {
          stuDiffs.push({ field: 'pickupAddress', fieldLabel: 'Pickup Address', oldValue: orig.pickupAddress, newValue: edits.pickupAddress });
        }
        if (edits.dropoffAddress !== undefined && edits.dropoffAddress !== orig.dropoffAddress) {
          stuDiffs.push({ field: 'dropoffAddress', fieldLabel: 'Dropoff Address', oldValue: orig.dropoffAddress, newValue: edits.dropoffAddress });
        }

        if (stuDiffs.length > 0) {
          RouteAuditService.logRouteChange({
            routeId: route.id,
            routeNo: route.routeNo,
            routeName: route.routeName,
            category: 'student',
            action: 'update',
            studentId: stu.studentId,
            studentNo: stu.studentNo,
            studentName: stu.fullName || stu.studentName,
            summary: `Updated itinerary for ${stu.fullName || stu.studentName} on Route ${route.routeNo}: ${stuDiffs.map((d) => `${d.fieldLabel} (${d.oldValue || 'None'} -> ${d.newValue || 'None'})`).join(', ')}`,
            diffs: stuDiffs,
            userId: actorId,
            userName: actorName,
            userEmail: actorEmail,
            userRole: actorRole
          }).catch((auditErr) => console.warn('[RouteStudentItineraryView] Audit log warning:', auditErr));
        }
      }

      // Refresh shifts
      await onRefreshShifts();

      // Clear pending edits
      setPendingEdits({});
      setFeedback({
        type: 'success',
        message: t.stops?.changesSavedSuccess || 'Changes saved successfully to route shifts and student records.'
      });
    } catch (err: any) {
      console.error('Failed to save student itinerary changes:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'An error occurred while saving changes.'
      });
    } finally {
      setSaving(false);
    }
  };

  // 7. Resolve School Terminal Stops (bottom row matching the picture)
  const schoolTerminalStops = useMemo(() => {
    const list: {
      schoolName: string;
      schoolAddress: string;
      amBellTime: string;
      pmBellTime: string;
    }[] = [];

    // Find school stop in pickupShift and dropoffShift
    const pickupSchoolStop = activePickupShift?.stops?.find((s) =>
      s.stopType?.toLowerCase().includes('school')
    );
    const dropoffSchoolStop = activeDropoffShift?.stops?.find((s) =>
      s.stopType?.toLowerCase().includes('school')
    );

    const primarySchoolName =
      pickupSchoolStop?.schoolName ||
      dropoffSchoolStop?.schoolName ||
      distinctSchoolsOnRoute[0] ||
      route.routeName;

    const matchedSchool = schools.find(
      (s) =>
        s.schoolName?.toLowerCase().trim() === primarySchoolName?.toLowerCase().trim() ||
        s.schoolId === pickupSchoolStop?.schoolId
    );

    const schoolAddress =
      pickupSchoolStop?.stopLocation ||
      dropoffSchoolStop?.stopLocation ||
      matchedSchool?.schoolAddress ||
      'School Campus Address';

    const amBellTime =
      pickupSchoolStop?.pullawayTime || matchedSchool?.startTime || '08:30 a.m.';
    const pmBellTime =
      dropoffSchoolStop?.pullawayTime || matchedSchool?.dismissalTime || '02:38 p.m.';

    list.push({
      schoolName: primarySchoolName,
      schoolAddress,
      amBellTime,
      pmBellTime
    });

    return list;
  }, [activePickupShift, activeDropoffShift, distinctSchoolsOnRoute, route, schools]);

  return (
    <div className="space-y-4">
      {/* Top Action Bar (Reference Image 1 & 2: Red Save Button on left, Reset Button on right) */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || dirtyFieldsCount === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md ${
              dirtyFieldsCount > 0
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
                : 'bg-rose-950/40 text-rose-300/40 border border-rose-900/30 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {saving
                ? 'Saving...'
                : dirtyFieldsCount > 0
                ? `${t.stops?.saveChanges || 'Save'} (${dirtyFieldsCount})`
                : t.stops?.saveChanges || 'Save'}
            </span>
          </button>

          {dirtyFieldsCount > 0 && (
            <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
              {dirtyFieldsCount} {t.stops?.unsavedChangesBadge || 'unsaved changes (highlighted in gold)'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={dirtyFieldsCount === 0}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border ${
            dirtyFieldsCount > 0
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              : 'bg-slate-900/40 text-slate-600 border-slate-800/60 cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.stops?.resetChanges || 'Reset'}</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Student Itinerary Table (1:1 with Reference Image) */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-inner">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-semibold tracking-wider text-[11px]">
              {/* Column 1: Student */}
              <th className="py-3 px-4 w-[240px]">Student</th>

              {/* Column 2: Pickup Time with Shift Operational Days dropdown */}
              <th className="py-3 px-3 w-[150px]">
                <div className="flex items-center space-x-1">
                  {amShifts.length > 1 ? (
                    <div className="relative inline-block">
                      <select
                        value={pickupShiftId}
                        onChange={(e) => setPickupShiftId(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-[11px] font-mono font-bold focus:outline-none focus:border-sky-500 cursor-pointer"
                      >
                        {amShifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatOpDays(s.runDays)} (AM)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono font-bold text-[11px]">
                      <span>{formatOpDays(activePickupShift?.runDays)}</span>
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    </span>
                  )}
                </div>
              </th>

              {/* Column 3: Dropoff Time with Shift Operational Days dropdown */}
              <th className="py-3 px-3 w-[150px]">
                <div className="flex items-center space-x-1">
                  {pmShifts.length > 1 ? (
                    <div className="relative inline-block">
                      <select
                        value={dropoffShiftId}
                        onChange={(e) => setDropoffShiftId(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-[11px] font-mono font-bold focus:outline-none focus:border-sky-500 cursor-pointer"
                      >
                        {pmShifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatOpDays(s.runDays)} ({s.shiftType})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono font-bold text-[11px]">
                      <span>{formatOpDays(activeDropoffShift?.runDays)}</span>
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    </span>
                  )}
                </div>
              </th>

              {/* Column 4: Pickup Address */}
              <th className="py-3 px-3 min-w-[280px]">
                {t.stops?.pickupAddress || 'Pickup Address'}
              </th>

              {/* Column 5: Dropoff Address */}
              <th className="py-3 px-3 min-w-[280px]">
                {t.stops?.dropoffAddress || 'Dropoff Address'}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {routeStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 italic text-xs">
                  {t.stops?.noStudentsOnRoute || 'No students currently assigned to this route.'}
                </td>
              </tr>
            ) : (
              routeStudents.map((stu) => {
                const orig = getOriginalValues(stu);
                const edits = pendingEdits[stu.studentId] || {};

                const valPickupTime = edits.pickupTime !== undefined ? edits.pickupTime : orig.pickupTime;
                const valDropoffTime = edits.dropoffTime !== undefined ? edits.dropoffTime : orig.dropoffTime;
                const valPickupAddress = edits.pickupAddress !== undefined ? edits.pickupAddress : orig.pickupAddress;
                const valDropoffAddress = edits.dropoffAddress !== undefined ? edits.dropoffAddress : orig.dropoffAddress;

                const isPickupTimeDirty = edits.pickupTime !== undefined && edits.pickupTime !== orig.pickupTime;
                const isDropoffTimeDirty = edits.dropoffTime !== undefined && edits.dropoffTime !== orig.dropoffTime;
                const isPickupAddressDirty = edits.pickupAddress !== undefined && edits.pickupAddress !== orig.pickupAddress;
                const isDropoffAddressDirty = edits.dropoffAddress !== undefined && edits.dropoffAddress !== orig.dropoffAddress;

                // Special care badges
                const badges: string[] = [];
                if (stu.master?.metatBus) {
                  badges.push('Attendant');
                }
                if (stu.master?.equipments) {
                  stu.master.equipments
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .forEach((badge) => {
                      if (!badges.includes(badge)) badges.push(badge);
                    });
                }
                if (stu.master?.studentDispatchNotes) {
                  if (stu.master.studentDispatchNotes.toLowerCase().includes('wheelchair') && !badges.includes('Wheelchair')) {
                    badges.push('Wheelchair');
                  }
                  if (stu.master.studentDispatchNotes.toLowerCase().includes('walker') && !badges.includes('Walker')) {
                    badges.push('Walker');
                  }
                  if (stu.master.studentDispatchNotes.toLowerCase().includes('lpn') && !badges.includes('LPN')) {
                    badges.push('LPN');
                  }
                }

                return (
                  <tr
                    key={stu.studentId}
                    className="hover:bg-slate-800/30 transition text-xs"
                  >
                    {/* Student Identity Cell */}
                    <td className="py-3 px-4 align-middle">
                      <div
                        onClick={() => stu.master && onSelectStudent && onSelectStudent(stu.master)}
                        className="cursor-pointer group"
                      >
                        <div className="font-bold text-slate-100 group-hover:text-amber-400 transition flex items-center space-x-1">
                          <span>
                            {stu.fullName || stu.studentName}
                            {stu.master?.metatBus ? '*' : ''}
                          </span>
                        </div>

                        {/* Requirement 3: If multiple schools on route, display school name under student */}
                        {hasMultipleSchools && stu.schoolName && (
                          <div className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                            {stu.schoolName}
                          </div>
                        )}

                        {/* Special Care Badges (Reference image yellow badges) */}
                        {badges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {badges.map((b, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Pickup Time Cell */}
                    <td className="py-2.5 px-3 align-middle">
                      <div className="relative">
                        <input
                          type="text"
                          value={valPickupTime}
                          onChange={(e) => handleCellChange(stu.studentId, 'pickupTime', e.target.value)}
                          placeholder="e.g. 07:48 a.m."
                          className={`w-full font-mono text-xs font-bold rounded-xl pl-3 pr-8 py-2 transition focus:outline-none ${
                            isPickupTimeDirty
                              ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-md font-bold'
                              : 'bg-sky-500/10 text-sky-200 border border-sky-500/20 focus:border-sky-400'
                          }`}
                        />
                        <Clock
                          className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                            isPickupTimeDirty ? 'text-slate-900' : 'text-sky-400/80'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Dropoff Time Cell */}
                    <td className="py-2.5 px-3 align-middle">
                      <div className="relative">
                        <input
                          type="text"
                          value={valDropoffTime}
                          onChange={(e) => handleCellChange(stu.studentId, 'dropoffTime', e.target.value)}
                          placeholder="e.g. 02:59 p.m."
                          className={`w-full font-mono text-xs font-bold rounded-xl pl-3 pr-8 py-2 transition focus:outline-none ${
                            isDropoffTimeDirty
                              ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-md font-bold'
                              : 'bg-slate-800 text-slate-200 border border-slate-700 focus:border-sky-400'
                          }`}
                        />
                        <Clock
                          className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                            isDropoffTimeDirty ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Pickup Address Cell */}
                    <td className="py-2.5 px-3 align-middle">
                      <input
                        type="text"
                        value={valPickupAddress}
                        onChange={(e) => handleCellChange(stu.studentId, 'pickupAddress', e.target.value)}
                        placeholder="Pickup address..."
                        className={`w-full text-xs rounded-xl px-3 py-2 transition focus:outline-none ${
                          isPickupAddressDirty
                            ? 'bg-amber-400 text-slate-950 font-bold border border-amber-500 shadow-md'
                            : 'bg-slate-800 text-slate-200 border border-slate-700 focus:border-sky-400'
                        }`}
                      />
                    </td>

                    {/* Dropoff Address Cell */}
                    <td className="py-2.5 px-3 align-middle">
                      <input
                        type="text"
                        value={valDropoffAddress}
                        onChange={(e) => handleCellChange(stu.studentId, 'dropoffAddress', e.target.value)}
                        placeholder="Dropoff address..."
                        className={`w-full text-xs rounded-xl px-3 py-2 transition focus:outline-none ${
                          isDropoffAddressDirty
                            ? 'bg-amber-400 text-slate-950 font-bold border border-amber-500 shadow-md'
                            : 'bg-slate-800 text-slate-200 border border-slate-700 focus:border-sky-400'
                        }`}
                      />
                    </td>
                  </tr>
                );
              })
            )}

            {/* School Terminal Row (Bottom Row matching reference image) */}
            {schoolTerminalStops.map((sch, sIdx) => (
              <tr
                key={sIdx}
                className="bg-emerald-950/20 border-t-2 border-emerald-500/20 text-xs"
              >
                {/* School Name Cell (Green background pill matching picture) */}
                <td className="py-3 px-4 align-middle">
                  <div className="flex items-center space-x-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold px-3 py-2 rounded-xl">
                    <SchoolIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{sch.schoolName}</span>
                  </div>
                </td>

                {/* School Morning Arrival Bell Time */}
                <td className="py-2.5 px-3 align-middle">
                  <div className="relative">
                    <div className="w-full font-mono text-xs font-bold rounded-xl pl-3 pr-8 py-2 bg-slate-800/80 border border-slate-700 text-emerald-300">
                      {sch.amBellTime}
                    </div>
                    <Clock className="w-3.5 h-3.5 text-emerald-400/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </td>

                {/* School Afternoon Dismissal Bell Time */}
                <td className="py-2.5 px-3 align-middle">
                  <div className="relative">
                    <div className="w-full font-mono text-xs font-bold rounded-xl pl-3 pr-8 py-2 bg-sky-500/10 border border-sky-500/20 text-sky-300">
                      {sch.pmBellTime}
                    </div>
                    <Clock className="w-3.5 h-3.5 text-sky-400/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </td>

                {/* School Pickup Address (Arrival Terminal) */}
                <td className="py-2.5 px-3 align-middle">
                  <div
                    className="w-full text-xs rounded-xl px-3 py-2 bg-slate-800/80 border border-slate-700 text-slate-300 font-mono truncate"
                    title={sch.schoolAddress}
                  >
                    {sch.schoolAddress}
                  </div>
                </td>

                {/* School Dropoff Address (Departure Terminal) */}
                <td className="py-2.5 px-3 align-middle">
                  <div
                    className="w-full text-xs rounded-xl px-3 py-2 bg-slate-800/80 border border-slate-700 text-slate-300 font-mono truncate"
                    title={sch.schoolAddress}
                  >
                    {sch.schoolAddress}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
