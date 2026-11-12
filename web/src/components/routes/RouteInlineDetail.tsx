import React, { useState, useEffect, memo, useMemo } from 'react';
import { BusRoute, BusRouteShift, RouteStop, getShiftBadgeStyle, formatOpDays, isAutoMarryupEnabled } from '../../types/route';
import { Student } from '../../types/student';
import { School } from '../../types/school';
import { Employee } from '../../types/employee';
import { RouteService } from '../../services/routeService';
import { StudentService } from '../../services/studentService';
import { useAuth } from '../../contexts/AuthContext';
import { RouteAuditService } from '../../services/routeAuditService';
import { RouteChangeFieldDiff } from '../../types/routeAudit';
import {
  assignStudentToRouteOrShiftLogic,
  persistShiftAssignments,
  AssignmentTarget
} from '../../services/stopAssignmentService';
import { useI18n } from '../../contexts/I18nContext';
import {
  Clock,
  MapPin,
  School as SchoolIcon,
  Phone,
  Plus,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  User,
  X,
  Search,
  AlertTriangle,
  Bus,
  FileText,
  Pencil,
  Navigation,
  Zap,
  Download,
  Mail,
  GripVertical
} from 'lucide-react';
import { RouteStudentItineraryView } from './RouteStudentItineraryView';
import { ShiftEditModal } from './ShiftEditModal';
import { StopEditModal } from './StopEditModal';
import { LazyShiftGoogleMapView, preloadShiftGoogleMapView } from './LazyShiftGoogleMapView';
import { OptimizeRouteModal } from './OptimizeRouteModal';
import { RouteSheetShareModal, downloadRouteSheet } from './RouteSheetShareModal';
import { RouteSheetPreview } from './RouteSheetPreview';
import { sortRouteSheetShifts } from '../../utils/routeSheetPdf';
import { RouteSettingsService } from '../../services/routeSettingsService';
import { reorderStopsAndUpdateSequence } from '../../utils/routeOptimizer';

interface RouteInlineDetailProps {
  route: BusRoute;
  studentsMap: Record<number, Student>;
  schools: School[];
  employees: Employee[];
  onSelectStudent?: (student: Student) => void;
  onSelectStudentId?: (studentId: number) => void;
  onOpenDrawer?: (route: BusRoute) => void;
  onRouteUpdated?: (route: BusRoute) => void;
}

export const RouteInlineDetail = memo(function RouteInlineDetail({
  route,
  studentsMap,
  schools,
  employees,
  onSelectStudent,
  onSelectStudentId,
  onOpenDrawer,
  onRouteUpdated
}: RouteInlineDetailProps) {
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const [viewMode, setViewMode] = useState<'students' | 'stops' | 'map' | 'sheet'>('students');
  const [shifts, setShifts] = useState<BusRouteShift[]>([]);
  const [activeShiftId, setActiveShiftId] = useState<string>('');
  const [editingShift, setEditingShift] = useState<BusRouteShift | null>(null);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedStopIds, setExpandedStopIds] = useState<Record<number, boolean>>({});

  // Add Student modal states
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [targetScope, setTargetScope] = useState<'shift' | 'route'>('shift');
  const [assignmentMode, setAssignmentMode] = useState<'new_stop' | 'existing_stop'>('new_stop');
  const [selectedExistingStopId, setSelectedExistingStopId] = useState<number | ''>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [draggedStopIdx, setDraggedStopIdx] = useState<number | null>(null);
  const [dragOverStopIdx, setDragOverStopIdx] = useState<number | null>(null);
  const [isReorderingStops, setIsReorderingStops] = useState(false);

  const handleRefreshShifts = async () => {
    try {
      const refreshed = await RouteService.getShiftsForRoute(route.id);
      setShifts(refreshed);
      return refreshed;
    } catch (e) {
      console.error('Failed refreshing shifts:', e);
      return [];
    }
  };

  const handleSaveShift = async (shiftId: string, updates: Partial<BusRouteShift>) => {
    const targetShift = shifts.find((r) => r.id === shiftId);

    await RouteService.updateShift(shiftId, updates);

    // Audit does not depend on the refreshed shift list, so start it before the reload.
    if (targetShift) {
      const diffs: RouteChangeFieldDiff[] = [];
      if (updates.runDays !== undefined && updates.runDays !== targetShift.runDays) {
        diffs.push({ field: 'runDays', fieldLabel: 'Operating Days', oldValue: targetShift.runDays, newValue: updates.runDays });
      }
      if (updates.active !== undefined && updates.active !== targetShift.active) {
        diffs.push({ field: 'active', fieldLabel: 'Active Status', oldValue: targetShift.active, newValue: updates.active });
      }
      if (updates.effectiveDate !== undefined && updates.effectiveDate !== targetShift.effectiveDate) {
        diffs.push({ field: 'effectiveDate', fieldLabel: 'Effective Date', oldValue: targetShift.effectiveDate, newValue: updates.effectiveDate });
      }
      if (updates.retireDate !== undefined && updates.retireDate !== targetShift.retireDate) {
        diffs.push({ field: 'retireDate', fieldLabel: 'Retire Date', oldValue: targetShift.retireDate, newValue: updates.retireDate });
      }

      if (diffs.length > 0) {
        const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
        const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
        const actorRole = currentUser?.role || 'dispatcher';
        const actorEmail = currentUser?.email || undefined;

        RouteAuditService.logRouteChange({
          routeId: route.id,
          routeNo: route.routeNo,
          routeName: route.routeName,
          category: 'shift',
          action: 'update',
          shiftId,
          shiftType: targetShift.shiftType,
          summary: `Updated ${targetShift.shiftType} Shift schedule: ${diffs.map((d) => `${d.fieldLabel} (${d.oldValue || 'None'} -> ${d.newValue || 'None'})`).join(', ')}`,
          diffs,
          userId: actorId,
          userName: actorName,
          userEmail: actorEmail,
          userRole: actorRole
        }).catch((err) => console.warn('[RouteInlineDetail] Shift audit warning:', err));
      }
    }

    await handleRefreshShifts();

    if (onRouteUpdated) {
      const updatedShifts = (route.shifts || []).map((s) => {
        if ((targetShift && s.shiftType === targetShift.shiftType) || (targetShift && s.shiftId === targetShift.shiftId)) {
          return {
            ...s,
            runDays: updates.runDays !== undefined ? updates.runDays : s.runDays,
          };
        }
        return s;
      });
      onRouteUpdated({
        ...route,
        shifts: updatedShifts
      });
    }
  };

  const handleSaveStop = async (shiftId: string, updatedStop: RouteStop) => {
    const targetShift = shifts.find((s) => s.id === shiftId);
    if (!targetShift) return;

    const oldStop = targetShift.stops?.find((s) => s.stopId === updatedStop.stopId);

    const updatedStops = oldStop
      ? (targetShift.stops || []).map((s) =>
          s.stopId === updatedStop.stopId ? updatedStop : s
        )
      : [...(targetShift.stops || []), updatedStop];

    await RouteService.updateShift(shiftId, {
      stops: updatedStops,
    });

    // Synchronize student records if riders changed
    const oldStudentIds = new Set(oldStop?.assignedStudents?.map((s) => s.studentId) || []);
    const newStudentIds = new Set(updatedStop.assignedStudents?.map((s) => s.studentId) || []);

    // 1. Newly assigned riders
    for (const rider of updatedStop.assignedStudents || []) {
      if (!oldStudentIds.has(rider.studentId)) {
        const student = studentsMap[rider.studentId];
        if (student) {
          const existingStops = [...(student.stops || [])];
          const hasThisStop = existingStops.some(
            (st) =>
              st.route === route.routeNo &&
              st.shift === targetShift.shiftType &&
              st.location === updatedStop.stopLocation
          );
          if (!hasThisStop) {
            existingStops.push({
              stopId: String(updatedStop.stopId),
              time: updatedStop.pullawayTime,
              type: updatedStop.stopType?.toLowerCase().includes('dropoff') ? 'Dropoff' : 'Pickup',
              opDays: updatedStop.runDays || targetShift.runDays || 'MTWRF',
              location: updatedStop.stopLocation,
              comment: updatedStop.comment,
              instruction: updatedStop.instruction,
              route: route.routeNo,
              shift: targetShift.shiftType
            });
          }
          const currentRoutesSet = new Set(
            student.routes ? student.routes.split(',').map((r) => r.trim()).filter(Boolean) : []
          );
          currentRoutesSet.add(route.routeNo);
          await StudentService.update(student.id, {
            stops: existingStops,
            routes: Array.from(currentRoutesSet).join(', ')
          }).catch((err) => console.warn('[RouteInlineDetail] Failed to sync student stops:', err));
        }
      }
    }

    // 2. Removed riders
    for (const oldRider of oldStop?.assignedStudents || []) {
      if (!newStudentIds.has(oldRider.studentId)) {
        const student = studentsMap[oldRider.studentId];
        if (student && student.stops) {
          const remainingStops = student.stops.filter(
            (st) =>
              !(
                st.route === route.routeNo &&
                st.shift === targetShift.shiftType &&
                (st.stopId === String(updatedStop.stopId) || (oldStop && st.location === oldStop.stopLocation))
              )
          );
          await StudentService.update(student.id, {
            stops: remainingStops
          }).catch((err) => console.warn('[RouteInlineDetail] Failed to remove student stop:', err));
        }
      }
    }

    // Audit Log: Stop Changes
    const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
    const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
    const actorRole = currentUser?.role || 'dispatcher';
    const actorEmail = currentUser?.email || undefined;

    if (!oldStop) {
      RouteAuditService.logRouteChange({
        routeId: route.id,
        routeNo: route.routeNo,
        routeName: route.routeName,
        category: 'stop',
        action: 'create',
        shiftId,
        shiftType: targetShift.shiftType,
        stopId: updatedStop.stopId,
        stopSequence: updatedStop.sequence,
        stopLocation: updatedStop.stopLocation,
        summary: `Created Stop #${updatedStop.sequence} (${updatedStop.stopLocation}) on ${targetShift.shiftType} shift.`,
        diffs: [
          { field: 'stopLocation', fieldLabel: 'Stop Location', oldValue: '', newValue: updatedStop.stopLocation },
          { field: 'pullawayTime', fieldLabel: 'Pullaway Time', oldValue: '', newValue: updatedStop.pullawayTime },
          { field: 'stopType', fieldLabel: 'Stop Type', oldValue: '', newValue: updatedStop.stopType }
        ],
        userId: actorId,
        userName: actorName,
        userEmail: actorEmail,
        userRole: actorRole
      }).catch((err) => console.warn('[RouteInlineDetail] Stop audit warning:', err));
    } else {
      const diffs: RouteChangeFieldDiff[] = [];
      if (oldStop.pullawayTime !== updatedStop.pullawayTime) {
        diffs.push({ field: 'pullawayTime', fieldLabel: 'Pullaway Time', oldValue: oldStop.pullawayTime, newValue: updatedStop.pullawayTime });
      }
      if (oldStop.stopLocation !== updatedStop.stopLocation) {
        diffs.push({ field: 'stopLocation', fieldLabel: 'Stop Location', oldValue: oldStop.stopLocation, newValue: updatedStop.stopLocation });
      }
      if (oldStop.stopType !== updatedStop.stopType) {
        diffs.push({ field: 'stopType', fieldLabel: 'Stop Type', oldValue: oldStop.stopType, newValue: updatedStop.stopType });
      }
      if (oldStop.runDays !== updatedStop.runDays) {
        diffs.push({ field: 'runDays', fieldLabel: 'Operating Days', oldValue: oldStop.runDays, newValue: updatedStop.runDays });
      }
      if (oldStop.effectiveDate !== updatedStop.effectiveDate) {
        diffs.push({ field: 'effectiveDate', fieldLabel: 'Effective Date', oldValue: oldStop.effectiveDate, newValue: updatedStop.effectiveDate });
      }
      if (oldStop.retireDate !== updatedStop.retireDate) {
        diffs.push({ field: 'retireDate', fieldLabel: 'Retire Date', oldValue: oldStop.retireDate, newValue: updatedStop.retireDate });
      }
      if ((oldStop.comment || '') !== (updatedStop.comment || '')) {
        diffs.push({ field: 'comment', fieldLabel: 'Comment', oldValue: oldStop.comment || '', newValue: updatedStop.comment || '' });
      }
      const oldRidersCount = oldStop.assignedStudents?.length || 0;
      const newRidersCount = updatedStop.assignedStudents?.length || 0;
      if (oldRidersCount !== newRidersCount) {
        diffs.push({ field: 'assignedStudents', fieldLabel: 'Assigned Riders', oldValue: `${oldRidersCount} riders`, newValue: `${newRidersCount} riders` });
      }

      if (diffs.length > 0) {
        RouteAuditService.logRouteChange({
          routeId: route.id,
          routeNo: route.routeNo,
          routeName: route.routeName,
          category: 'stop',
          action: 'update',
          shiftId,
          shiftType: targetShift.shiftType,
          stopId: updatedStop.stopId,
          stopSequence: updatedStop.sequence,
          stopLocation: updatedStop.stopLocation,
          summary: `Modified Stop #${updatedStop.sequence} (${updatedStop.stopLocation}): ${diffs.map((d) => `${d.fieldLabel} (${d.oldValue || 'None'} -> ${d.newValue || 'None'})`).join(', ')}`,
          diffs,
          userId: actorId,
          userName: actorName,
          userEmail: actorEmail,
          userRole: actorRole
        }).catch((err) => console.warn('[RouteInlineDetail] Stop audit warning:', err));
      }
    }

    await handleRefreshShifts();
  };

  const handleReorderStop = async (fromIndex: number, toIndex: number) => {
    if (!activeShift || !activeShift.stops || isReorderingStops) return;
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= activeShift.stops.length ||
      toIndex >= activeShift.stops.length
    ) {
      return;
    }

    const movedStop = activeShift.stops[fromIndex];
    setIsReorderingStops(true);

    try {
      // Load configured dwell time & average speed from settings
      const optSettings = await RouteSettingsService.getSettings();
      const cleanStops = reorderStopsAndUpdateSequence(
        activeShift.stops,
        fromIndex,
        toIndex,
        {
          recalculateTimes: true,
          dwellMinutes: optSettings.defaultStopDwellMinutes,
          speedKmH: optSettings.averageSpeedKmH,
          schoolBoardOrRouteName: route.schoolBoardCode || route.routeName,
          shiftType: activeShift.shiftType
        }
      );

      const updatedShift: BusRouteShift = {
        ...activeShift,
        stops: cleanStops,
        updatedAt: new Date().toISOString()
      };

      setShifts((prev) => prev.map((s) => (s.id === updatedShift.id ? updatedShift : s)));

      await RouteService.updateShift(activeShift.id, {
        stops: cleanStops
      });

      // Audit log entry for parental special request manual reordering
      RouteAuditService.logRouteChange({
        routeId: route.id,
        routeNo: route.routeNo,
        routeName: route.routeName,
        category: 'stop',
        action: 'update',
        shiftId: activeShift.id,
        shiftType: activeShift.shiftType,
        summary: `Manually reordered Stop #${movedStop.sequence} (${movedStop.stopLocation}) to position #${toIndex + 1} and recalculated arrival times`,
        userId: currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher',
        userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
        userEmail: currentUser?.email || undefined,
        userRole: currentUser?.role || 'dispatcher'
      }).catch(console.warn);

      await handleRefreshShifts();
    } catch (err) {
      console.error('Failed to reorder stop:', err);
      await handleRefreshShifts();
    } finally {
      setIsReorderingStops(false);
    }
  };

  const handleApplyOptimizedStopsFromModal = async (optimizedStops: RouteStop[]) => {
    if (!activeShift) return;

    const cleanStops = optimizedStops.map((s) => {
      const clean: any = {};
      for (const [k, v] of Object.entries(s)) {
        if (v !== undefined) clean[k] = v;
      }
      return clean as RouteStop;
    });

    const updatedShift: BusRouteShift = {
      ...activeShift,
      stops: cleanStops,
      updatedAt: new Date().toISOString()
    };

    setShifts((prev) => prev.map((s) => (s.id === updatedShift.id ? updatedShift : s)));

    await RouteService.updateShift(activeShift.id, {
      stops: cleanStops
    });

    RouteAuditService.logRouteChange({
      routeId: route.id,
      routeNo: route.routeNo,
      routeName: route.routeName,
      category: 'shift',
      action: 'update',
      shiftId: activeShift.id,
      shiftType: activeShift.shiftType,
      summary: `Optimized stop sequence and recalculated scheduled departure times for Shift #${activeShift.shiftId || activeShift.id}`,
      userId: currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher',
      userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
      userEmail: currentUser?.email || undefined,
      userRole: currentUser?.role || 'dispatcher'
    }).catch(console.warn);

    handleRefreshShifts();
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    RouteService.getShiftsForRoute(route.id)
      .then((data) => {
        if (!isMounted) return;
        setShifts(data);
        if (data.length > 0) {
          setActiveShiftId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Error fetching shifts for route:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [route.id]);

  const orderedShifts = useMemo(() => sortRouteSheetShifts(shifts), [shifts]);
  const activeShift = orderedShifts.find((s) => s.id === activeShiftId) || orderedShifts[0];

  const toggleStopExpand = (stopId: number) => {
    setExpandedStopIds((prev) => ({
      ...prev,
      [stopId]: !prev[stopId]
    }));
  };

  const handleOpenAddStudentModal = () => {
    setSelectedStudentId('');
    setTargetScope('shift');
    setAssignmentMode('new_stop');
    setSelectedExistingStopId('');
    setStudentSearch('');
    setAssignError(null);
    setIsAddStudentModalOpen(true);
  };

  const handleConfirmAddStudent = async () => {
    if (!selectedStudentId) {
      setAssignError('Please select a student.');
      return;
    }

    const student = studentsMap[selectedStudentId];
    if (!student) {
      setAssignError('Selected student was not found.');
      return;
    }

    setAssigning(true);
    setAssignError(null);

    // If assigning to an existing stop
    if (assignmentMode === 'existing_stop') {
      if (!selectedExistingStopId) {
        setAssignError('Please select an existing stop to assign the student to.');
        setAssigning(false);
        return;
      }

      if (!activeShift) {
        setAssignError('No active shift selected.');
        setAssigning(false);
        return;
      }

      const targetStop = activeShift.stops?.find((s) => s.stopId === Number(selectedExistingStopId));
      if (!targetStop) {
        setAssignError('Selected stop was not found on the active shift.');
        setAssigning(false);
        return;
      }

      try {
        // 1. Add student to target stop
        const updatedAssigned = [...(targetStop.assignedStudents || [])];
        if (!updatedAssigned.some((s) => s.studentId === student.studentId)) {
          updatedAssigned.push({
            studentId: student.studentId,
            studentNo: student.studentNo,
            studentName: student.fullName || `${student.firstName} ${student.lastName}`,
            schoolName: student.schoolName
          });
        }
        targetStop.assignedStudents = updatedAssigned;

        // 2. Also ensure student is in the school stop of this shift
        const studentSchool = schools.find((sch) => sch.schoolId === student.schoolId);
        const isAM = (activeShift.shiftType || '').toUpperCase() === 'AM';
        let schoolStop = activeShift.stops?.find((st) => {
          const isSchool = st.stopType === 'SchoolDropoff' || st.stopType === 'SchoolPickup';
          if (!isSchool) return false;
          if (st.schoolId && st.schoolId === student.schoolId) return true;
          if (
            st.schoolName &&
            student.schoolName &&
            st.schoolName.toLowerCase().trim() === student.schoolName.toLowerCase().trim()
          ) {
            return true;
          }
          return false;
        });

        if (schoolStop) {
          schoolStop.assignedStudents = schoolStop.assignedStudents || [];
          if (!schoolStop.assignedStudents.some((s) => s.studentId === student.studentId)) {
            schoolStop.assignedStudents.push({
              studentId: student.studentId,
              studentNo: student.studentNo,
              studentName: student.fullName || `${student.firstName} ${student.lastName}`,
              schoolName: student.schoolName
            });
          }
        } else if (studentSchool) {
          const defaultSchoolStopType = isAM ? 'SchoolDropoff' : 'SchoolPickup';
          const defaultSchoolTimeStr = isAM
            ? studentSchool.startTime || '08:30 AM'
            : studentSchool.dismissalTime || (activeShift.shiftType === 'NOON' ? '12:25 PM' : '02:40 PM');
          const nextStopId = Date.now() + Math.floor(Math.random() * 1000);
          const newSchoolStop: RouteStop = {
            stopId: nextStopId,
            sequence: isAM ? (activeShift.stops?.length || 0) + 1 : 1,
            stopLocation: studentSchool.schoolAddress || studentSchool.schoolName,
            pullawayTime: defaultSchoolTimeStr,
            stopType: defaultSchoolStopType,
            schoolId: student.schoolId,
            schoolName: student.schoolName,
            runDays: activeShift.runDays,
            comment: `School bell terminal stop for ${student.schoolName}`,
            assignedStudents: [
              {
                studentId: student.studentId,
                studentNo: student.studentNo,
                studentName: student.fullName || `${student.firstName} ${student.lastName}`,
                schoolName: student.schoolName
              }
            ]
          };
          if (isAM) {
            activeShift.stops?.push(newSchoolStop);
          } else {
            activeShift.stops?.unshift(newSchoolStop);
          }
        }

        // 3. Save shift
        await RouteService.updateShift(activeShift.id, {
          stops: activeShift.stops || []
        });

        // 4. Update student record
        const existingStops = [...(student.stops || [])];
        const hasStop = existingStops.some(
          (st) =>
            st.route === route.routeNo &&
            st.shift === activeShift.shiftType &&
            (st.stopId === String(targetStop.stopId) || st.location === targetStop.stopLocation)
        );
        if (!hasStop) {
          existingStops.push({
            stopId: String(targetStop.stopId),
            time: targetStop.pullawayTime,
            type: targetStop.stopType?.toLowerCase().includes('dropoff') ? 'Dropoff' : 'Pickup',
            opDays: targetStop.runDays || activeShift.runDays || 'MTWRF',
            location: targetStop.stopLocation,
            comment: targetStop.comment,
            instruction: targetStop.instruction,
            route: route.routeNo,
            shift: activeShift.shiftType
          });
        }

        const currentRoutesSet = new Set(
          student.routes
            ? student.routes.split(',').map((r) => r.trim()).filter(Boolean)
            : []
        );
        currentRoutesSet.add(route.routeNo);

        await StudentService.update(student.id, {
          stops: existingStops,
          routes: Array.from(currentRoutesSet).join(', ')
        });

        // 5. Refresh shift data locally
        const refreshedShifts = await RouteService.getShiftsForRoute(route.id);
        setShifts(refreshedShifts);

        // 6. Audit Log
        const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
        const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
        const actorRole = currentUser?.role || 'dispatcher';
        const actorEmail = currentUser?.email || undefined;

        RouteAuditService.logRouteChange({
          routeId: route.id,
          routeNo: route.routeNo,
          routeName: route.routeName,
          category: 'student',
          action: 'assign',
          studentId: student.studentId,
          studentNo: student.studentNo,
          studentName: student.fullName || student.studentName,
          shiftId: activeShift.id,
          shiftType: activeShift.shiftType,
          summary: `Assigned student ${student.fullName || student.studentName} (#${student.studentNo}) to existing stop #${targetStop.sequence} (${targetStop.stopLocation}) on ${activeShift.shiftType}`,
          diffs: [
            {
              field: 'assignedStudents',
              fieldLabel: 'Assigned Riders',
              oldValue: `${targetStop.assignedStudents.length - 1} riders`,
              newValue: `${targetStop.assignedStudents.length} riders`
            }
          ],
          userId: actorId,
          userName: actorName,
          userEmail: actorEmail,
          userRole: actorRole
        }).catch((auditErr) => console.warn('[RouteInlineDetail] Student assignment audit error:', auditErr));

        setIsAddStudentModalOpen(false);
      } catch (err: unknown) {
        console.error('Error in handleConfirmAddStudent (existing stop):', err);
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred during assignment.';
        setAssignError(msg);
      } finally {
        setAssigning(false);
      }
      return;
    }

    try {
      const target: AssignmentTarget =
        targetScope === 'route'
          ? {
              type: 'route',
              routeId: route.id,
              routeNo: route.routeNo,
              label: `Route ${route.routeNo}`
            }
          : {
              type: 'shift',
              routeId: route.id,
              routeNo: route.routeNo,
              shiftId: activeShift?.id,
              label: `Shift ${activeShift?.shiftType || 'AM'} (${formatOpDays(activeShift?.runDays)})`
            };

      const result = assignStudentToRouteOrShiftLogic(
        student,
        target,
        shifts,
        schools
      );

      if (!result.success) {
        setAssignError(result.error || 'Failed to assign student to stop/shift.');
        setAssigning(false);
        return;
      }

      // 1. Persist updated shifts to Firestore
      if (result.updatedShifts && result.updatedShifts.length > 0) {
        await persistShiftAssignments(result.updatedShifts);
      }

      // 2. Persist student stops & routes in student record
      const existingStops = [...(student.stops || [])];
      for (const newStop of result.generatedStudentStops) {
        const alreadyExists = existingStops.some(
          (s) =>
            s.route === newStop.route &&
            s.shift === newStop.shift &&
            s.type === newStop.type &&
            s.location === newStop.location
        );
        if (!alreadyExists) {
          existingStops.push(newStop);
        }
      }

      const currentRoutesSet = new Set(
        student.routes
          ? student.routes.split(',').map((r) => r.trim()).filter(Boolean)
          : []
      );
      for (const rNo of result.assignedRouteNos) {
        currentRoutesSet.add(rNo);
      }

      await StudentService.update(student.id, {
        stops: existingStops,
        routes: Array.from(currentRoutesSet).join(', ')
      });

      // 3. Refresh shift data locally
      const refreshedShifts = await RouteService.getShiftsForRoute(route.id);
      setShifts(refreshedShifts);

      // 4. Audit Log: Student Assignment to Route/Shift
      const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
      const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
      const actorRole = currentUser?.role || 'dispatcher';
      const actorEmail = currentUser?.email || undefined;

      RouteAuditService.logRouteChange({
        routeId: route.id,
        routeNo: route.routeNo,
        routeName: route.routeName,
        category: 'student',
        action: 'assign',
        studentId: student.studentId,
        studentNo: student.studentNo,
        studentName: student.fullName || student.studentName,
        shiftId: targetScope === 'shift' ? activeShift?.id : undefined,
        shiftType: targetScope === 'shift' ? activeShift?.shiftType : undefined,
        summary: `Assigned student ${student.fullName || student.studentName} (#${student.studentNo}) to Route ${route.routeNo} (${targetScope === 'route' ? 'All Shifts' : `Shift ${activeShift?.shiftType || 'AM'}`})`,
        diffs: [
          {
            field: 'routeAssignment',
            fieldLabel: 'Route Allocation',
            oldValue: 'Unassigned on this route',
            newValue: `Route ${route.routeNo} (${targetScope === 'route' ? 'All Shifts' : activeShift?.shiftType})`
          }
        ],
        userId: actorId,
        userName: actorName,
        userEmail: actorEmail,
        userRole: actorRole
      }).catch((auditErr) => console.warn('[RouteInlineDetail] Student assignment audit error:', auditErr));

      setIsAddStudentModalOpen(false);
    } catch (err: any) {
      console.error('Error in handleConfirmAddStudent:', err);
      setAssignError(err.message || 'An unexpected error occurred during assignment.');
    } finally {
      setAssigning(false);
    }
  };

  // Filter students for search in modal
  const allStudentsList = React.useMemo(() => {
    return Object.values(studentsMap);
  }, [studentsMap]);

  const filteredStudents = React.useMemo(() => {
    if (!studentSearch.trim()) return allStudentsList.slice(0, 30);
    const q = studentSearch.toLowerCase().trim();
    return allStudentsList.filter(
      (s) =>
        s.studentName?.toLowerCase().includes(q) ||
        s.fullName?.toLowerCase().includes(q) ||
        s.studentNo?.toLowerCase().includes(q) ||
        s.studentAddress?.toLowerCase().includes(q) ||
        s.schoolName?.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [allStudentsList, studentSearch]);

  return (
    <div className="bg-slate-950/90 border-t border-b border-slate-800 p-3 sm:p-6 space-y-3 sm:space-y-4">
      {/* Shift Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
            Operational Shifts:
          </span>

          {loading ? (
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading shift itinerary...</span>
            </div>
          ) : shifts.length === 0 ? (
            <span className="text-xs text-slate-500 italic">No shifts recorded</span>
          ) : (
            orderedShifts.map((shift) => {
              const opDaysStr = formatOpDays(shift.runDays);
              const isSelected = shift.id === activeShift?.id;
              const badgeStyle = getShiftBadgeStyle(shift.shiftType, opDaysStr);

              return (
                <div
                  key={shift.id}
                  className={`inline-flex items-center rounded-xl p-0.5 border transition ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-400/50'
                      : 'bg-slate-900 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveShiftId(shift.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-slate-950' : badgeStyle.dot
                      }`}
                    />
                    <span>
                      {shift.shiftType}
                      {opDaysStr === '----F' ? ' (Fri Early)' : ''}
                    </span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-slate-950/20 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {shift.firstStopTime || '07:30'} - {shift.lastStopTime || '08:30'}
                    </span>
                    <span
                      className={`text-[10px] px-1 rounded font-mono ${
                        opDaysStr === '----F'
                          ? 'bg-purple-500/30 text-purple-200 font-bold'
                          : 'opacity-70'
                      }`}
                    >
                      {opDaysStr}
                    </span>
                    {shift.active === false && (
                      <span className="text-[10px] px-1 rounded bg-rose-500/20 text-rose-300 font-semibold">
                        Inactive
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingShift(shift);
                    }}
                    title={`Edit ${shift.shiftType} Shift`}
                    className={`px-1.5 py-1.5 mr-0.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ${
                      isSelected ? 'text-slate-900 hover:text-slate-950 hover:bg-amber-400/50' : ''
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Quick action toolbar */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {/* View Mode Toggle: Student View vs Stops View vs Shift Map */}
          <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('students')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'students'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t.stops?.studentView || 'Student View'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('stops')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'stops'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{t.stops?.stopsView || 'Stops View'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              onMouseEnter={preloadShiftGoogleMapView}
              onFocus={preloadShiftGoogleMapView}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'map'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Shift Map</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'sheet'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Route Sheet</span>
            </button>
          </div>

          {isAutoMarryupEnabled(route) ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Auto Marryup
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
              No Auto Marryup
            </span>
          )}

          <button
            type="button"
            disabled={loading || shifts.length === 0}
            onClick={() => {
              void downloadRouteSheet({ route, shifts: orderedShifts, studentsMap, schools }).catch(
                (error) => console.warn('Failed to export route sheet PDF:', error),
              );
            }}
            title="Export a route sheet PDF"
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            disabled={loading || shifts.length === 0}
            onClick={() => setIsShareOpen(true)}
            title="Email the route sheet to a driver or the office"
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-40"
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Share</span>
          </button>

          {onOpenDrawer && (
            <button
              onClick={() => onOpenDrawer(route)}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center space-x-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Full Drawer View</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'sheet' ? (
        <RouteSheetPreview
          route={route}
          shifts={orderedShifts}
          studentsMap={studentsMap}
          schools={schools}
        />
      ) : viewMode === 'students' ? (
        <RouteStudentItineraryView
          route={route}
          shifts={orderedShifts}
          activeShift={activeShift}
          studentsMap={studentsMap}
          schools={schools}
          onSelectStudent={onSelectStudent}
          onSelectStudentId={onSelectStudentId}
          onRefreshShifts={async () => {
            await handleRefreshShifts();
          }}
          onViewMap={() => setViewMode('map')}
          onOptimizeOrder={() => setIsOptimizeModalOpen(true)}
          onAddStop={() => setIsAddStopModalOpen(true)}
          onAddStudent={handleOpenAddStudentModal}
        />
      ) : viewMode === 'map' ? (
        <LazyShiftGoogleMapView
          shift={activeShift}
          route={route}
          studentsMap={studentsMap}
          employees={employees}
          showBus={false}
          onSelectStudent={onSelectStudent}
          onUpdateShift={(updatedShift) => {
            if (updatedShift) {
              setShifts((prevShifts) =>
                prevShifts.map((s) => (s.id === updatedShift.id ? updatedShift : s))
              );
            }
            handleRefreshShifts();
          }}
          height="540px"
        />
      ) : (
        /* Route Stops Table (1:1 with User's Legacy Reference Image) */
        <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-xs flex items-center space-x-2">
              <span>Route Stops</span>
              {activeShift && (
                <span className="text-[11px] font-mono text-slate-400 normal-case">
                  ({activeShift.stops?.length || 0} stops •{' '}
                  {activeShift.stops?.reduce(
                    (sum, s) => sum + (s.assignedStudents?.length || 0),
                    0
                  )}{' '}
                  assigned riders)
                </span>
              )}
            </h4>

            {activeShift && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold bg-slate-800 border border-slate-700 text-amber-300">
                <Calendar className="w-3 h-3 text-amber-400" />
                <span>Op Days: {formatOpDays(activeShift.runDays)}</span>
              </span>
            )}
            {activeShift && activeShift.stops && activeShift.stops.length > 1 && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-800/80 border border-slate-700/80 text-slate-400">
                <GripVertical className="w-3 h-3 text-amber-400/80" />
                <span>
                  {isReorderingStops
                    ? 'Updating stop sequence & times...'
                    : 'Drag stops to reorder (adjusts pickup times)'}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              title="View on Google Map"
              className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs flex items-center space-x-1 font-medium transition cursor-pointer"
            >
              <Navigation className="w-3 h-3" />
              <span>View Map</span>
            </button>
            {activeShift && activeShift.stops && activeShift.stops.length > 2 && (
              <button
                type="button"
                onClick={() => setIsOptimizeModalOpen(true)}
                title={t.stops?.optimizeOrder || 'Optimize Stop Sequence'}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-1 font-medium transition cursor-pointer"
              >
                <Zap className="w-3 h-3 fill-emerald-400" />
                <span>{t.stops?.optimizeOrder || 'Optimize Stops'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAddStopModalOpen(true)}
              title={t.stops?.addStop || 'Add Stop to Shift'}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-1 font-medium transition cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{t.stops?.addStop || 'Add Stop'}</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAddStudentModal}
              title={t.stops?.addStudentToRoute || 'Add Student to Route'}
              className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs flex items-center space-x-1 font-medium transition cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{t.stops?.addStudentToRoute || 'Add Student'}</span>
            </button>
          </div>
        </div>

        {/* Stops Sub-Table */}
        {!activeShift || !activeShift.stops || activeShift.stops.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800/80 space-y-1">
            <AlertCircle className="w-6 h-6 mx-auto text-slate-600" />
            <div className="text-xs font-semibold">No stops recorded for this shift</div>
            <div className="text-[11px] text-slate-600">Select another shift or synchronize stops</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-inner">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 w-8 text-center">#</th>
                  <th className="py-2.5 px-3">Student / School</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Effective / Retire</th>
                  <th className="py-2.5 px-3">Comment / Instruction</th>
                  <th className="py-2.5 px-3 text-center">Op Days</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Riders</th>
                  <th className="py-2.5 px-3 text-center w-24">Order / Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeShift.stops.map((stop: RouteStop, idx: number) => {
                  const isSchool =
                    stop.stopType === 'SchoolDropoff' || stop.stopType === 'SchoolPickup';
                  const isExpanded = !!expandedStopIds[stop.stopId];
                  const ridersCount = stop.assignedStudents?.length || 0;
                  const stopOpDays = formatOpDays(stop.runDays || activeShift.runDays);

                  const isDragging = draggedStopIdx === idx;
                  const isDragOver =
                    dragOverStopIdx === idx && draggedStopIdx !== null && draggedStopIdx !== idx;
                  const dropRowHighlight = isDragOver
                    ? draggedStopIdx! > idx
                      ? 'bg-amber-500/15 border-t-2 border-t-amber-400'
                      : 'bg-amber-500/15 border-b-2 border-b-amber-400'
                    : '';

                  return (
                    <React.Fragment key={stop.stopId}>
                      <tr
                        data-testid={`route-stop-row-${stop.stopId}`}
                        draggable={!isReorderingStops}
                        onDragStart={(e) => {
                          if (isReorderingStops) {
                            e.preventDefault();
                            return;
                          }
                          setDraggedStopIdx(idx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(idx));
                        }}
                        onDragOver={(e) => {
                          if (draggedStopIdx === null || draggedStopIdx === idx) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverStopIdx !== idx) setDragOverStopIdx(idx);
                        }}
                        onDragLeave={() => {
                          if (dragOverStopIdx === idx) setDragOverStopIdx(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromIdx = draggedStopIdx;
                          setDraggedStopIdx(null);
                          setDragOverStopIdx(null);
                          if (fromIdx !== null && fromIdx !== idx) {
                            void handleReorderStop(fromIdx, idx);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedStopIdx(null);
                          setDragOverStopIdx(null);
                        }}
                        onClick={() => ridersCount > 0 && toggleStopExpand(stop.stopId)}
                        className={`hover:bg-slate-800/40 transition text-xs ${
                          ridersCount > 0 ? 'cursor-pointer' : ''
                        } ${isDragging ? 'opacity-45 bg-amber-500/10' : ''} ${dropRowHighlight}`}
                      >
                        {/* Drag Handle, Expand Icon & Seq */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                          <div className="flex items-center justify-center space-x-1">
                            <span
                              title="Drag to reorder stop"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-500 hover:text-amber-400 cursor-grab active:cursor-grabbing shrink-0"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                            {ridersCount > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStopExpand(stop.stopId);
                                }}
                                className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="w-3.5 inline-block" />
                            )}
                            <span className="text-[11px] text-slate-300">{stop.sequence}</span>
                          </div>
                        </td>

                        {/* Student / School Column (styled like reference picture) */}
                        <td className="py-2.5 px-3">
                          {isSchool ? (
                            <div className="flex items-center space-x-1.5">
                              <SchoolIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span className="font-bold text-emerald-300">
                                {stop.schoolName || stop.stopLocation}
                              </span>
                            </div>
                          ) : (
                            <div>
                              {ridersCount > 0 ? (
                                <div className="font-bold text-slate-200 flex items-center space-x-1.5 flex-wrap">
                                  {stop.assignedStudents?.map((s, idx) => (
                                    <button
                                      key={s.studentId}
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (onSelectStudentId) {
                                          onSelectStudentId(s.studentId);
                                          return;
                                        }
                                        const master = studentsMap[s.studentId];
                                        if (master && onSelectStudent) onSelectStudent(master);
                                      }}
                                      className="hover:text-amber-400 transition cursor-pointer"
                                    >
                                      {s.studentName}
                                      {idx < (stop.assignedStudents?.length || 0) - 1 ? '; ' : ''}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-medium">
                                  {stop.stopLocation}
                                </span>
                              )}
                              {stop.schoolName && !isSchool && (
                                <div className="text-[10px] text-slate-500">
                                  Destined: {stop.schoolName}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Time */}
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-400/80" />
                            <span>{stop.pullawayTime}</span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-2.5 px-3 max-w-[220px]">
                          <div className="flex items-start space-x-1 text-slate-300">
                            <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(
                                stop.stopLocation
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] truncate hover:underline hover:text-sky-300 transition"
                              title={stop.stopLocation}
                            >
                              {stop.stopLocation}
                            </a>
                          </div>
                        </td>

                        {/* Effective / Retire Dates */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {stop.effectiveDate || stop.retireDate ? (
                            <div className="space-y-0.5 text-[10px] font-mono">
                              {stop.effectiveDate && (
                                <div className="text-emerald-400">
                                  <span className="text-slate-500">Eff: </span>{stop.effectiveDate}
                                </div>
                              )}
                              {stop.retireDate && (
                                <div className="text-rose-400">
                                  <span className="text-slate-500">Ret: </span>{stop.retireDate}
                                </div>
                              )}
                            </div>
                          ) : activeShift.effectiveDate || activeShift.retireDate ? (
                            <div className="text-[10px] font-mono text-slate-500" title="Inherits Shift dates">
                              <span>(Shift)</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Comment / Instruction */}
                        <td className="py-2.5 px-3 max-w-[200px]">
                          {stop.comment || stop.instruction ? (
                            <div className="text-[11px] text-slate-400 line-clamp-2" title={stop.comment || stop.instruction}>
                              {stop.comment || stop.instruction}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px] italic">—</span>
                          )}
                        </td>

                        {/* Op Days */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              stopOpDays === '----F'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700/80'
                            }`}
                          >
                            {stopOpDays}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isSchool
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {stop.stopType}
                          </span>
                        </td>

                        {/* Riders Count */}
                        <td className="py-2.5 px-3 text-right">
                          {ridersCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono font-bold text-[11px]">
                              {ridersCount} riders
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Order & Edit Stop Action */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleReorderStop(idx, idx - 1)}
                              disabled={isReorderingStops || idx === 0}
                              title={t.stops?.moveUp || 'Move Up (Recalculate times)'}
                              className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderStop(idx, idx + 1)}
                              disabled={isReorderingStops || idx === activeShift.stops.length - 1}
                              title={t.stops?.moveDown || 'Move Down (Recalculate times)'}
                              className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition cursor-pointer"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStop(stop)}
                              title={`Edit Stop #${stop.sequence}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Nested Boarding Students Sub-row (Expands when clicked) */}
                      {isExpanded && ridersCount > 0 && (
                        <tr className="bg-slate-950/80 border-t border-b border-slate-800/80">
                          <td colSpan={10} className="p-3 pl-10">
                            <div className="space-y-2">
                              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                                <User className="w-3.5 h-3.5 text-amber-400" />
                                <span>
                                  Boarding Students at this stop ({ridersCount}) • Single Source of Truth Phone Resolution:
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {stop.assignedStudents?.map((stu) => {
                                  const master = studentsMap[stu.studentId];
                                  const phone = master?.studentPhone;
                                  const parent =
                                    master?.contacts?.find((c) => c.primaryContact) ||
                                    master?.contacts?.[0];

                                  return (
                                    <div
                                      key={stu.studentId}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onSelectStudentId) {
                                          onSelectStudentId(stu.studentId);
                                          return;
                                        }
                                        if (master && onSelectStudent) onSelectStudent(master);
                                      }}
                                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between group"
                                    >
                                      <div>
                                        <div className="font-bold text-white text-xs group-hover:text-amber-400 transition flex items-center space-x-1.5">
                                          <span>{stu.studentName}</span>
                                          <span className="text-[10px] font-mono text-slate-500">
                                            #{stu.studentNo}
                                          </span>
                                        </div>
                                        {parent && (
                                          <div className="text-[10px] text-slate-400 mt-0.5">
                                            {parent.relationship}: {parent.contactName}
                                          </div>
                                        )}
                                      </div>

                                      {/* One-click Click-to-dial Phone */}
                                      <div className="flex items-center space-x-1">
                                        {phone || parent?.mobilePhone ? (
                                          <a
                                            href={`tel:${phone || parent?.mobilePhone}`}
                                            onClick={(e) => e.stopPropagation()}
                                            title="Dial phone"
                                            className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 font-mono text-[11px] font-bold transition flex items-center space-x-1 border border-amber-500/20"
                                          >
                                            <Phone className="w-3 h-3" />
                                            <span>{phone || parent?.mobilePhone}</span>
                                          </a>
                                        ) : (
                                          <span className="text-[10px] text-slate-600 italic">
                                            No Phone
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Add Student to Route or Shift Modal */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Bus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {t.stops?.addStudentToRoute || 'Add Student to Route'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Route {route.routeNo} • {route.routeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStudentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{assignError}</div>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              {/* Stop Assignment Mode */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Stop Destination
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('new_stop')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      assignmentMode === 'new_stop'
                        ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-bold text-xs">Auto Create / Match</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      From student home address
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentMode('existing_stop');
                      setTargetScope('shift');
                      if (!selectedExistingStopId && activeShift?.stops && activeShift.stops.length > 0) {
                        const nonSchool = activeShift.stops.find((s) => !s.stopType?.toLowerCase().includes('school'));
                        setSelectedExistingStopId(nonSchool ? nonSchool.stopId : activeShift.stops[0].stopId);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      assignmentMode === 'existing_stop'
                        ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-bold text-xs">Assign to Existing Stop</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Share stop with nearby riders
                    </div>
                  </button>
                </div>
              </div>

              {assignmentMode === 'existing_stop' && activeShift && (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <label className="block font-semibold text-slate-300 text-xs">
                    Select Existing Stop on {activeShift.shiftType} <span className="text-rose-400">*</span>
                  </label>
                  {!activeShift.stops || activeShift.stops.length === 0 ? (
                    <div className="text-xs text-amber-400">
                      No stops available on this shift. Please add a stop first.
                    </div>
                  ) : (
                    <select
                      value={selectedExistingStopId}
                      onChange={(e) => setSelectedExistingStopId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="">-- Choose an existing stop --</option>
                      {activeShift.stops.map((st) => (
                        <option key={st.stopId} value={st.stopId}>
                          Stop #{st.sequence} • {st.stopLocation} [{st.pullawayTime}] ({st.stopType}) — {st.assignedStudents?.length || 0} rider(s)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Target Assignment Scope (shown when auto creating) */}
              {assignmentMode === 'new_stop' && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    Assignment Target Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetScope('shift')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        targetScope === 'shift'
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold text-xs">Current Shift Only</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {activeShift ? `${activeShift.shiftType} (${formatOpDays(activeShift.runDays)})` : 'Selected Shift'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetScope('route')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        targetScope === 'route'
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold text-xs">{t.stops?.allShifts || 'All Shifts'}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        Route {route.routeNo} ({shifts.length} shifts)
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Student Picker */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300">
                  {t.stops?.selectStudent || 'Select Student'} <span className="text-rose-400">*</span>
                </label>

                {/* Quick Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search student by name, ID, school or address..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value ? Number(e.target.value) : '');
                    setAssignError(null);
                  }}
                  size={5}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-sky-500 cursor-pointer overflow-y-auto"
                >
                  {filteredStudents.length === 0 ? (
                    <option disabled value="">No students match query</option>
                  ) : (
                    filteredStudents.map((stu) => (
                      <option key={stu.studentId} value={stu.studentId} className="py-1">
                        #{stu.studentNo} • {stu.fullName || stu.studentName} ({stu.schoolName || 'School'}) — {stu.studentAddress || 'No Address'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selected Student Details Card */}
              {selectedStudentId && studentsMap[selectedStudentId] && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Rider:</span>
                    <span className="font-bold text-white">
                      {studentsMap[selectedStudentId].fullName || studentsMap[selectedStudentId].studentName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Address:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[240px]" title={studentsMap[selectedStudentId].studentAddress}>
                      {studentsMap[selectedStudentId].studentAddress || 'No address'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>School:</span>
                    <span className="text-sky-300 font-semibold truncate max-w-[240px]" title={studentsMap[selectedStudentId].schoolName}>
                      {studentsMap[selectedStudentId].schoolName || 'Unassigned'}
                    </span>
                  </div>
                </div>
              )}

              {/* Notice & Rule summary */}
              <div className="p-2.5 rounded-xl bg-sky-500/5 border border-sky-500/15 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center space-x-1.5 text-sky-400 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Automated Dispatch Stop Estimation</span>
                </div>
                <p>
                  {t.stops?.travelEstimateNotice || 'Pickup and dropoff times are calculated using the 28-minute transit estimate to/from school.'}
                </p>
                <p className="text-slate-500">
                  If the shift already includes a stop with this address, the student will be added to that existing stop without altering time or sequence.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddStudentModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigning || !selectedStudentId}
                onClick={handleConfirmAddStudent}
                className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl transition text-xs font-bold shadow-md shadow-sky-500/20 disabled:opacity-50 flex items-center space-x-1.5"
              >
                <span>{assigning ? 'Adding Student...' : (t.stops?.assignButton || 'Assign Student')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      <ShiftEditModal
        isOpen={!!editingShift}
        shift={editingShift}
        onClose={() => setEditingShift(null)}
        onSave={handleSaveShift}
      />

      {/* Stop Edit / Add Modal */}
      <StopEditModal
        isOpen={isAddStopModalOpen || !!editingStop}
        shift={activeShift}
        stop={editingStop}
        studentsMap={studentsMap}
        onClose={() => {
          setEditingStop(null);
          setIsAddStopModalOpen(false);
        }}
        onSave={handleSaveStop}
      />

      {/* Stop Sequence Optimization Modal */}
      {isOptimizeModalOpen && activeShift && (
        <OptimizeRouteModal
          isOpen
          onClose={() => setIsOptimizeModalOpen(false)}
          shift={activeShift}
          route={route}
          employees={employees}
          onApplyOptimizedStops={handleApplyOptimizedStopsFromModal}
        />
      )}

      {isShareOpen && (
        <RouteSheetShareModal
          route={route}
          shifts={orderedShifts}
          studentsMap={studentsMap}
          schools={schools}
          employees={employees}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
});
