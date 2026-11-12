import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  UserX,
  Truck,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Check,
  Search,
  Zap,
  BellRing,
  MessageSquare,
  Send,
  Navigation,
  Split,
  DollarSign,
  Phone,
  Mail,
  Wrench,
  CloudRain,
  Users,
  ChevronDown,
  ChevronUp,
  LogOut,
  History,
  SlidersHorizontal,
  ShieldCheck,
  Bell,
  CalendarOff,
  HeartHandshake,
} from 'lucide-react';
import {
  CheckInReminderSettings,
  DispatchShift,
  DispatchShiftStop,
  DispatchStudentStatus,
  DelayReasonCategory,
  ParentNotificationRecipient,
} from '../../types/dispatch';
import { CharterTrip } from '../../types/charter';
import { Employee } from '../../types/employee';
import { Vehicle } from '../../types/vehicle';
import { Student } from '../../types/student';
import { DispatchService } from '../../services/dispatchService';
import { apiRequest } from '../../services/api';
import {
  ShiftLatenessInfo,
  getCurrentHHmm,
  diffMinutes,
  getSentParentNotifications,
  isAlertMessageShift,
} from '../../utils/dispatchDelayUtils';
import {
  sortDriversByDeadhead,
  calculateDriverDeadhead,
  sortAttendantsByDeadhead,
  calculateAttendantDeadhead,
} from '../../utils/deadheadCalculator';
import {
  classifyEmployeeForRole,
  compareCrewPriority,
  CrewCandidateClassification,
} from '../../utils/crewEligibilityUtils';
import {
  ScheduledShift,
  checkDriverShiftConflict,
  checkVehicleConflict,
} from '../../utils/dispatchConflictDetector';
import {
  UnavailableVehicleInfo,
  EmployeeTimeOffInfo,
  getVehicleUnavailabilityReason,
  getEmployeeTimeOffReason,
} from '../../utils/vehicleAvailabilityUtils';
import {
  EmployeeDayTask,
  buildEmployeeTaskIndex,
  formatEmployeeTaskShortLabel,
  getEmployeeDayTasks,
} from '../../utils/employeeTaskUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { logDispatchAction } from '../../utils/dispatchLogger';
import { SmsConversationModal } from './SmsConversationModal';
import { ShiftAiCopilotBar } from './ShiftAiCopilotBar';

const EMPTY_STOPS: DispatchShiftStop[] = [];
const EMPTY_CHARTER_TRIPS: CharterTrip[] = [];

export type WorkbenchActionTab = 'assign_driver' | 'assign_attendant' | 'assign_vehicle' | 'late_alert';

function getEligibilityBadgeClass(cls: CrewCandidateClassification): string {
  if (cls.tier === 1) {
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
  }
  if (cls.hasCoverExperience) {
    return 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 font-bold';
  }
  if (cls.isSupervisor) {
    return 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 font-bold';
  }
  return 'bg-slate-100/70 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/70 dark:border-slate-700/70';
}

function renderCandidateTaskPills(
  otherTasks: EmployeeDayTask[],
  isFrench: boolean,
  testId?: string
) {
  if (otherTasks.length === 0) return null;
  return (
    <div data-testid={testId} className="flex flex-wrap items-center gap-1 mt-1">
      {otherTasks.map((task) => (
        <span
          key={`${task.source}:${task.id}:${task.role}`}
          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
            task.isOverlap
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              : task.source === 'charter'
                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
          }`}
        >
          <Clock className="w-2.5 h-2.5 shrink-0" />
          <span>{formatEmployeeTaskShortLabel(task, isFrench)}</span>
        </span>
      ))}
    </div>
  );
}
export type WorkbenchQueueSubFilter =
  | 'all_filtered'
  | 'issues_only'
  | 'missing_driver'
  | 'missing_vehicle'
  | 'checkin_overdue'
  | 'stop_delayed'
  | 'alert_message';

export function scoreShiftIssueSeverity(info?: ShiftLatenessInfo): number {
  if (!info) return 0;
  let s = 0;
  if (info.isMissingDriver) s += 100;
  if (info.isMissingVehicle) s += 90;
  if (info.isCheckInOverdue) s += 70;
  if (info.hasStopDelay) s += 60 + Math.min(info.maxStopLateMinutes, 35);
  if (info.effectiveHealth === 'red') s += 30;
  if (info.effectiveHealth === 'yellow') s += 15;
  return s;
}

export function resolveRecommendedActionTab(
  info?: ShiftLatenessInfo,
  subFilter?: WorkbenchQueueSubFilter,
  topFilter?: string
): WorkbenchActionTab {
  if (subFilter === 'missing_driver') return 'assign_driver';
  if (subFilter === 'missing_vehicle') return 'assign_vehicle';
  if (
    subFilter === 'checkin_overdue' ||
    subFilter === 'stop_delayed' ||
    subFilter === 'alert_message'
  ) {
    return 'late_alert';
  }
  if (
    topFilter === 'checkin_overdue' ||
    topFilter === 'stop_delayed' ||
    topFilter === 'alert_message'
  ) {
    return 'late_alert';
  }

  if (!info) return 'assign_driver';
  if (info.isMissingDriver) return 'assign_driver';
  if (info.isMissingVehicle) return 'assign_vehicle';
  if (info.isCheckInOverdue || info.hasStopDelay) return 'late_alert';
  return 'assign_driver';
}

export function filterAndSortWorkbenchQueue(
  shifts: DispatchShift[],
  latenessByShiftId: Map<string, ShiftLatenessInfo>,
  queueSubFilter: WorkbenchQueueSubFilter,
  queueSearch: string
): DispatchShift[] {
  const q = queueSearch.trim().toLowerCase();
  const filtered = shifts.filter((shift) => {
    const info = latenessByShiftId.get(shift.id);
    if (queueSubFilter === 'issues_only') {
      if (!info || info.effectiveHealth === 'green') return false;
    } else if (queueSubFilter === 'missing_driver') {
      if (!info?.isMissingDriver) return false;
    } else if (queueSubFilter === 'missing_vehicle') {
      if (!info?.isMissingVehicle) return false;
    } else if (queueSubFilter === 'checkin_overdue') {
      if (!info?.isCheckInOverdue) return false;
    } else if (queueSubFilter === 'stop_delayed') {
      if (!info?.hasStopDelay) return false;
    } else if (queueSubFilter === 'alert_message') {
      if (!isAlertMessageShift(shift, info)) return false;
    }

    if (q) {
      const matchRoute =
        shift.routeNo.toLowerCase().includes(q) ||
        shift.routeName.toLowerCase().includes(q);
      const matchDriver = (shift.driverName || '').toLowerCase().includes(q);
      const matchUnit = (shift.unitNumber || '').toLowerCase().includes(q);
      if (!matchRoute && !matchDriver && !matchUnit) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    const infoA = latenessByShiftId.get(a.id);
    const infoB = latenessByShiftId.get(b.id);
    const diff = scoreShiftIssueSeverity(infoB) - scoreShiftIssueSeverity(infoA);
    if (diff !== 0) return diff;
    return (a.firstStopTime || '').localeCompare(b.firstStopTime || '');
  });
}

interface DispatchWorkbenchModePanelProps {
  shifts: DispatchShift[];
  allDayShifts: DispatchShift[];
  charterTrips?: CharterTrip[];
  latenessByShiftId: Map<string, ShiftLatenessInfo>;
  employees: Employee[];
  availableVehicles: Vehicle[];
  unavailableVehiclesMap?: Map<string, UnavailableVehicleInfo>;
  employeeTimeOffMap?: Map<string, EmployeeTimeOffInfo>;
  studentsMap: Record<number, Student>;
  selectedDate: string;
  currentTimeStr: string;
  isToday: boolean;
  healthFilter:
    | 'ALL'
    | 'green'
    | 'attention'
    | 'unassigned'
    | 'checkin_overdue'
    | 'stop_delayed'
    | 'alert_message';
  reminderSettings?: CheckInReminderSettings | null;
  onOpenReminderSettings?: () => void;
  onShiftUpdated: (updatedShift: DispatchShift) => void;
  onQuickCheckIn: (shift: DispatchShift, undo?: boolean) => void;
  onQuickAttendantCheckIn: (shift: DispatchShift, undo?: boolean) => void;
  onQuickCheckOut: (shift: DispatchShift, role: 'driver' | 'attendant', undo?: boolean) => void;
  onOpenCheckOutModal: (shift: DispatchShift, role: 'driver' | 'attendant') => void;
  onOpenMap: (shift: DispatchShift) => void;
  onOpenStops: (shift: DispatchShift, stopId?: number) => void;
  onOpenCrew: (shift: DispatchShift) => void;
  onOpenSplit: (shift: DispatchShift) => void;
  onOpenPayroll: (shift: DispatchShift) => void;
  onOpenHistory: (shift: DispatchShift) => void;
  onMessageDriver?: (driverId: string) => void;
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
  onSelectVehicle?: (vehicleId?: number, unitNumber?: string) => void;
  onSelectStudent?: (studentId: number) => void;
}

export const DispatchWorkbenchModePanel: React.FC<DispatchWorkbenchModePanelProps> = ({
  shifts,
  allDayShifts,
  charterTrips = EMPTY_CHARTER_TRIPS,
  latenessByShiftId,
  employees,
  availableVehicles,
  unavailableVehiclesMap,
  employeeTimeOffMap,
  studentsMap,
  selectedDate,
  currentTimeStr,
  isToday,
  healthFilter,
  reminderSettings,
  onOpenReminderSettings,
  onShiftUpdated,
  onQuickCheckIn,
  onQuickAttendantCheckIn,
  onQuickCheckOut,
  onOpenCheckOutModal,
  onOpenMap,
  onOpenStops,
  onOpenCrew,
  onOpenSplit,
  onOpenPayroll,
  onOpenHistory,
  onMessageDriver,
  onSelectEmployee,
  onSelectVehicle,
  onSelectStudent,
}) => {
  const { currentUser } = useAuth();
  const { t, isFrench } = useI18n();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  // Left queue sub-filter & search (derived state reset during render, avoiding extra useEffect render pass)
  const [prevHealthFilter, setPrevHealthFilter] = useState(healthFilter);
  const [queueSubFilter, setQueueSubFilter] = useState<WorkbenchQueueSubFilter>('all_filtered');
  const [queueSearch, setQueueSearch] = useState('');

  if (prevHealthFilter !== healthFilter) {
    setPrevHealthFilter(healthFilter);
    setQueueSubFilter('all_filtered');
  }

  // Compute sorted & filtered left queue
  const queueShifts = useMemo(
    () => filterAndSortWorkbenchQueue(shifts, latenessByShiftId, queueSubFilter, queueSearch),
    [shifts, latenessByShiftId, queueSubFilter, queueSearch]
  );

  // User-selected shift ID state. Null means auto-select the first shift in queueShifts.
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // Deterministically derive the active selected shift:
  // 1. If user explicitly clicked a shift that is currently in queueShifts, use that shift.
  // 2. Otherwise (including initial load, or when the resolved shift leaves queueShifts),
  //    fall back immediately to the first shift in queueShifts, or null if the queue is empty.
  const selectedShift = useMemo(() => {
    if (queueShifts.length === 0) return null;
    if (selectedShiftId) {
      const match = queueShifts.find((s) => s.id === selectedShiftId);
      if (match) return match;
    }
    return queueShifts[0] || null;
  }, [queueShifts, selectedShiftId]);

  const activeShiftId = selectedShift?.id || null;

  const [activeActionTab, setActiveActionTab] = useState<WorkbenchActionTab>(() => {
    if (!selectedShift) return 'assign_driver';
    return resolveRecommendedActionTab(latenessByShiftId.get(selectedShift.id), queueSubFilter, healthFilter);
  });

  // Keep Recommended Action tab aligned when active shift changes (e.g. resolution advances to next shift)
  const [lastResolvedShiftId, setLastResolvedShiftId] = useState<string | null>(activeShiftId);
  if (activeShiftId !== lastResolvedShiftId) {
    setLastResolvedShiftId(activeShiftId);
    if (selectedShift) {
      const info = latenessByShiftId.get(selectedShift.id);
      setActiveActionTab(resolveRecommendedActionTab(info, queueSubFilter, healthFilter));
    }
  }

  // Keep Recommended Action tab aligned when user clicks a top category or left sub-filter pill
  const prevFilterKey = `${queueSubFilter}:${healthFilter}`;
  const [trackedFilterKey, setTrackedFilterKey] = useState(prevFilterKey);
  if (trackedFilterKey !== prevFilterKey) {
    setTrackedFilterKey(prevFilterKey);
    if (selectedShift) {
      const info = latenessByShiftId.get(selectedShift.id);
      setActiveActionTab(resolveRecommendedActionTab(info, queueSubFilter, healthFilter));
    }
  }

  const selectedLateness = selectedShift ? latenessByShiftId.get(selectedShift.id) : undefined;

  const handleSelectShift = (shift: DispatchShift, explicitTab?: WorkbenchActionTab) => {
    setSelectedShiftId(shift.id);
    const info = latenessByShiftId.get(shift.id);
    if (explicitTab) {
      setActiveActionTab(explicitTab);
    } else {
      setActiveActionTab(resolveRecommendedActionTab(info, queueSubFilter, healthFilter));
    }
  };

  // Convert allDayShifts into ScheduledShift[] for conflict detection
  const scheduledShiftsForConflict: ScheduledShift[] = useMemo(() => {
    return allDayShifts.map((s) => ({
      id: s.id,
      dispatchDate: s.dispatchDate,
      routeNo: s.routeNo,
      shiftType: s.shiftType,
      driverId: s.driverId,
      driverName: s.driverName,
      vehicleUnit: s.unitNumber,
      startTime: s.firstStopTime || '07:00',
      endTime: s.lastStopTime || '09:00',
    }));
  }, [allDayShifts]);

  // Index other Dispatch shifts and Charter trips on selectedShift.dispatchDate for every candidate
  const employeeTaskIndex = useMemo(() => {
    if (!selectedShift) return null;
    return buildEmployeeTaskIndex({
      targetDate: selectedShift.dispatchDate || selectedDate,
      dispatchShifts: allDayShifts,
      charterTrips,
      excludeDispatchShiftId: selectedShift.id,
      windowStartTime: selectedShift.firstStopTime || '07:00',
      windowEndTime: selectedShift.lastStopTime || '09:00',
    });
  }, [selectedShift, selectedDate, allDayShifts, charterTrips]);

  // Resolved phone numbers for assigned driver and attendant
  const driverPhone = useMemo(() => {
    if (!selectedShift) return '';
    if (selectedShift.driverPhone && selectedShift.driverPhone.trim() !== '') {
      return selectedShift.driverPhone.trim();
    }
    if (selectedShift.driverId) {
      const emp = employees.find((e) => e.id === selectedShift.driverId);
      if (emp) return (emp.preferredPhone || emp.mobilePhone || '').trim();
    }
    return '';
  }, [selectedShift, employees]);

  const attendantPhone = useMemo(() => {
    if (!selectedShift) return '';
    if (selectedShift.attendantPhone && selectedShift.attendantPhone.trim() !== '') {
      return selectedShift.attendantPhone.trim();
    }
    if (selectedShift.attendantId) {
      const emp = employees.find((e) => e.id === selectedShift.attendantId);
      if (emp) return (emp.preferredPhone || emp.mobilePhone || '').trim();
    }
    return '';
  }, [selectedShift, employees]);

  // SMS conversation modal state
  const [smsModalState, setSmsModalState] = useState<{
    isOpen: boolean;
    phone: string;
    name: string;
    role: 'driver' | 'attendant';
  } | null>(null);

  // ============================================================================
  // Action 1: Driver Assignment State & Logic
  // ============================================================================
  const [driverSearch, setDriverSearch] = useState('');
  const [sortByDeadhead, setSortByDeadhead] = useState(true);
  const [onlyAvailableDrivers, setOnlyAvailableDrivers] = useState(false);
  const [onlyQualifiedDrivers, setOnlyQualifiedDrivers] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);

  const rankedDriverCandidates = useMemo(() => {
    if (!selectedShift) return [];
    const activeEmps = employees.filter((e) => e.isActive !== false);
    const shiftStops = Array.isArray(selectedShift.stops) ? selectedShift.stops : EMPTY_STOPS;

    const baseList =
      shiftStops.length > 0 && sortByDeadhead
        ? sortDriversByDeadhead(activeEmps, shiftStops)
        : [...activeEmps]
            .sort((a, b) => compareCrewPriority(a, b, 'driver'))
            .map((d) => ({
              employee: d,
              deadhead: calculateDriverDeadhead(d, shiftStops),
            }));

    const q = driverSearch.trim().toLowerCase();
    const result: Array<{
      employee: Employee;
      deadhead: ReturnType<typeof calculateDriverDeadhead>;
      conflict: ReturnType<typeof checkDriverShiftConflict>;
      timeOff: EmployeeTimeOffInfo | undefined;
      eligibility: CrewCandidateClassification;
      otherTasks: EmployeeDayTask[];
      hasTaskOverlap: boolean;
    }> = [];

    for (let i = 0; i < baseList.length; i++) {
      const { employee, deadhead } = baseList[i];
      const eligibility = classifyEmployeeForRole(employee, 'driver');

      if (q) {
        const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
        const pos = (employee.jobPosition || '').toLowerCase();
        const addr = (employee.personalAddress || '').toLowerCase();
        const phone = (employee.preferredPhone || employee.mobilePhone || '').toLowerCase();
        const badge = eligibility.badgeTextEn.toLowerCase();
        if (
          !fullName.includes(q) &&
          !pos.includes(q) &&
          !addr.includes(q) &&
          !phone.includes(q) &&
          !badge.includes(q)
        ) {
          continue;
        }
      }

      if (onlyQualifiedDrivers && !eligibility.isQualifiedRelief && employee.id !== selectedShift.driverId) {
        continue;
      }

      const conflict = checkDriverShiftConflict(
        employee.id,
        selectedShift.dispatchDate,
        selectedShift.firstStopTime || '07:00',
        selectedShift.lastStopTime || '09:00',
        scheduledShiftsForConflict,
        selectedShift.id
      );
      const timeOff = getEmployeeTimeOffReason(employee, employeeTimeOffMap);
      const otherTasks = getEmployeeDayTasks(employee, employeeTaskIndex);
      const hasTaskOverlap = conflict.hasConflict || otherTasks.some((task) => task.isOverlap);

      if (
        onlyAvailableDrivers &&
        (hasTaskOverlap || Boolean(timeOff)) &&
        employee.id !== selectedShift.driverId
      ) {
        continue;
      }

      result.push({ employee, deadhead, conflict, timeOff, eligibility, otherTasks, hasTaskOverlap });
    }

    return result;
  }, [
    selectedShift,
    employees,
    sortByDeadhead,
    driverSearch,
    onlyAvailableDrivers,
    onlyQualifiedDrivers,
    scheduledShiftsForConflict,
    employeeTimeOffMap,
    employeeTaskIndex,
  ]);

  const handleAssignDriver = async (driver: Employee) => {
    if (!selectedShift) return;
    try {
      setAssigningDriverId(driver.id);
      const newDriverName = `${driver.firstName} ${driver.lastName}`.trim();
      const newDriverPhone = driver.preferredPhone || driver.mobilePhone || '';
      const updated = await DispatchService.updateShift(selectedShift.id, {
        driverId: driver.id,
        driverName: newDriverName,
        driverPhone: newDriverPhone,
      });
      await logDispatchAction({
        date: selectedShift.dispatchDate,
        type: 'Assignment Updated',
        detail: `Workbench Quick Assign: Assigned Driver ${newDriverName} to Shift ${selectedShift.routeNo} (${selectedShift.shiftType})`,
        shift: selectedShift,
        user: actorName,
      });
      onShiftUpdated(updated);
    } catch (err) {
      console.error('Failed to assign driver:', err);
      alert('Failed to assign driver: ' + (err as Error).message);
    } finally {
      setAssigningDriverId(null);
    }
  };

  // ============================================================================
  // Action 2: Vehicle Assignment State & Logic
  // ============================================================================
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [onlyAvailableVehicles, setOnlyAvailableVehicles] = useState(false);
  const [assigningVehicleId, setAssigningVehicleId] = useState<number | null>(null);

  const rankedVehicleCandidates = useMemo(() => {
    if (!selectedShift) return [];
    const activeVehs = availableVehicles.filter((v) => v.active !== false);
    const q = vehicleSearch.trim().toLowerCase();

    const result: Array<{
      vehicle: Vehicle;
      conflict: ReturnType<typeof checkVehicleConflict>;
      unavail: UnavailableVehicleInfo | undefined;
    }> = [];

    for (let i = 0; i < activeVehs.length; i++) {
      const vehicle = activeVehs[i];
      if (q) {
        const unit = (vehicle.unitNumber || '').toLowerCase();
        const plate = (vehicle.plateNumber || '').toLowerCase();
        const model = `${vehicle.manufacturer || ''} ${vehicle.model || ''}`.toLowerCase();
        const yard = (vehicle.yardName || '').toLowerCase();
        if (!unit.includes(q) && !plate.includes(q) && !model.includes(q) && !yard.includes(q)) {
          continue;
        }
      }

      const conflict = checkVehicleConflict(
        vehicle.unitNumber,
        selectedShift.dispatchDate,
        selectedShift.firstStopTime || '07:00',
        selectedShift.lastStopTime || '09:00',
        scheduledShiftsForConflict,
        selectedShift.id
      );
      const unavail = getVehicleUnavailabilityReason(
        vehicle.unitNumber,
        vehicle.vehicleId || vehicle.id,
        unavailableVehiclesMap
      );

      if (
        onlyAvailableVehicles &&
        (conflict.hasConflict || Boolean(unavail)) &&
        vehicle.unitNumber !== selectedShift.unitNumber
      ) {
        continue;
      }

      result.push({ vehicle, conflict, unavail });
    }

    return result;
  }, [
    selectedShift,
    availableVehicles,
    vehicleSearch,
    onlyAvailableVehicles,
    scheduledShiftsForConflict,
    unavailableVehiclesMap,
  ]);

  const handleAssignVehicle = async (vehicle: Vehicle) => {
    if (!selectedShift) return;
    try {
      setAssigningVehicleId(vehicle.vehicleId);
      const updated = await DispatchService.updateShift(selectedShift.id, {
        vehicleId: vehicle.vehicleId,
        unitNumber: vehicle.unitNumber,
        plateNumber: vehicle.plateNumber,
      });
      await logDispatchAction({
        date: selectedShift.dispatchDate,
        type: 'Assignment Updated',
        detail: `Workbench Quick Assign: Assigned Vehicle Unit #${vehicle.unitNumber} (${vehicle.plateNumber}) to Shift ${selectedShift.routeNo} (${selectedShift.shiftType})`,
        shift: selectedShift,
        user: actorName,
      });
      onShiftUpdated(updated);
    } catch (err) {
      console.error('Failed to assign vehicle:', err);
      alert('Failed to assign vehicle: ' + (err as Error).message);
    } finally {
      setAssigningVehicleId(null);
    }
  };

  const [attendantSearch, setAttendantSearch] = useState('');
  const [onlyAvailableAttendants, setOnlyAvailableAttendants] = useState(false);
  const [onlyQualifiedAttendants, setOnlyQualifiedAttendants] = useState(false);
  const [assigningAttendantId, setAssigningAttendantId] = useState<string | null>(null);

  const selectedShiftDriverObj = useMemo(() => {
    if (!selectedShift?.driverId) return null;
    return employees.find((e) => e.id === selectedShift.driverId) || null;
  }, [selectedShift, employees]);

  const rankedAttendantCandidates = useMemo(() => {
    if (!selectedShift) return [];
    const activeEmps = employees.filter((e) => e.isActive !== false);
    const shiftStops = Array.isArray(selectedShift.stops) ? selectedShift.stops : EMPTY_STOPS;

    const baseList =
      shiftStops.length > 0 && sortByDeadhead
        ? sortAttendantsByDeadhead(activeEmps, selectedShiftDriverObj, shiftStops)
        : [...activeEmps]
            .sort((a, b) => compareCrewPriority(a, b, 'attendant'))
            .map((a) => ({
              employee: a,
              deadhead: calculateAttendantDeadhead(a, selectedShiftDriverObj, shiftStops),
            }));

    const q = attendantSearch.trim().toLowerCase();
    const result: Array<{
      employee: Employee;
      deadhead: ReturnType<typeof calculateAttendantDeadhead>;
      timeOff: EmployeeTimeOffInfo | undefined;
      eligibility: CrewCandidateClassification;
      otherTasks: EmployeeDayTask[];
      hasTaskOverlap: boolean;
    }> = [];

    for (let i = 0; i < baseList.length; i++) {
      const { employee, deadhead } = baseList[i];
      const eligibility = classifyEmployeeForRole(employee, 'attendant');

      if (q) {
        const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
        const pos = (employee.jobPosition || '').toLowerCase();
        const addr = (employee.personalAddress || '').toLowerCase();
        const phone = (employee.preferredPhone || employee.mobilePhone || '').toLowerCase();
        const badge = eligibility.badgeTextEn.toLowerCase();
        if (
          !fullName.includes(q) &&
          !pos.includes(q) &&
          !addr.includes(q) &&
          !phone.includes(q) &&
          !badge.includes(q)
        ) {
          continue;
        }
      }

      if (
        onlyQualifiedAttendants &&
        !eligibility.isQualifiedRelief &&
        employee.id !== selectedShift.attendantId
      ) {
        continue;
      }

      const timeOff = getEmployeeTimeOffReason(employee, employeeTimeOffMap);
      const otherTasks = getEmployeeDayTasks(employee, employeeTaskIndex);
      const hasTaskOverlap = otherTasks.some((task) => task.isOverlap);
      if (
        onlyAvailableAttendants &&
        (hasTaskOverlap || Boolean(timeOff)) &&
        employee.id !== selectedShift.attendantId
      ) {
        continue;
      }

      result.push({ employee, deadhead, timeOff, eligibility, otherTasks, hasTaskOverlap });
    }

    return result;
  }, [
    selectedShift,
    employees,
    selectedShiftDriverObj,
    sortByDeadhead,
    attendantSearch,
    onlyAvailableAttendants,
    onlyQualifiedAttendants,
    employeeTimeOffMap,
    employeeTaskIndex,
  ]);

  const handleAssignAttendant = async (attendant: Employee) => {
    if (!selectedShift) return;
    try {
      setAssigningAttendantId(attendant.id);
      const newAttendantName = `${attendant.firstName} ${attendant.lastName}`.trim();
      const newAttendantPhone = attendant.preferredPhone || attendant.mobilePhone || '';
      const updated = await DispatchService.updateShift(selectedShift.id, {
        attendantId: attendant.id,
        attendantName: newAttendantName,
        attendantPhone: newAttendantPhone,
      });
      await logDispatchAction({
        date: selectedShift.dispatchDate,
        type: 'Assignment Updated',
        detail: `Workbench Quick Assign: Assigned Attendant ${newAttendantName} to Shift ${selectedShift.routeNo} (${selectedShift.shiftType})`,
        shift: selectedShift,
        user: actorName,
      });
      onShiftUpdated(updated);
    } catch (err) {
      console.error('Failed to assign attendant:', err);
      alert('Failed to assign attendant: ' + (err as Error).message);
    } finally {
      setAssigningAttendantId(null);
    }
  };

  // ============================================================================
  // Action 3: Late Alert & Inline Parent Notification State & Logic
  // ============================================================================
  const [alertScope, setAlertScope] = useState<'all' | 'downstream' | 'this_stop'>('all');
  const [alertStopId, setAlertStopId] = useState<number>(0);
  const [reasonCategory, setReasonCategory] = useState<DelayReasonCategory>('traffic');
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [channels, setChannels] = useState<{ sms: boolean; email: boolean }>({
    sms: true,
    email: true,
  });
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isCustomEdited, setIsCustomEdited] = useState<boolean>(false);
  const [sendingAlert, setSendingAlert] = useState<boolean>(false);
  const [alertSentBanner, setAlertSentBanner] = useState<string | null>(null);

  const handleTriggerDelayAlertFromCopilot = (minutes: number, reason: string) => {
    setDelayMinutes(minutes);
    if (
      reason === 'traffic' ||
      reason === 'weather' ||
      reason === 'breakdown' ||
      reason === 'other'
    ) {
      setReasonCategory(reason);
    }
    setActiveActionTab('late_alert');
  };

  // Sync default delay minutes and stop when selectedShift changes (during render to eliminate extra useEffect pass)
  const [prevSelectedShiftIdForAlert, setPrevSelectedShiftIdForAlert] = useState<string | null>(selectedShift?.id || null);
  if (selectedShift && selectedShift.id !== prevSelectedShiftIdForAlert) {
    setPrevSelectedShiftIdForAlert(selectedShift.id);
    const stops = Array.isArray(selectedShift.stops) ? selectedShift.stops : EMPTY_STOPS;
    if (stops.length > 0) {
      setAlertStopId(stops[0].stopId);
    }
    const lateness = latenessByShiftId.get(selectedShift.id);
    if (lateness && lateness.maxLateMinutes >= 5) {
      const rounded = Math.max(10, Math.min(60, Math.ceil(lateness.maxLateMinutes / 5) * 5));
      setDelayMinutes(rounded);
    } else {
      setDelayMinutes(15);
    }
    setIsCustomEdited(false);
    setAlertSentBanner(null);
  }

  // Update default message text when reason/delayMinutes/routeNo changes
  useEffect(() => {
    if (!selectedShift || isCustomEdited) return;
    let reasonPhrase = 'traffic congestion and road slowdowns';
    if (reasonCategory === 'breakdown') {
      reasonPhrase =
        'a vehicle mechanical issue. A technician or replacement vehicle is being coordinated';
    } else if (reasonCategory === 'weather') {
      reasonPhrase = 'severe weather and hazardous road conditions';
    } else if (reasonCategory === 'other') {
      reasonPhrase = 'an operational delay en route';
    }
    const text = `School Bus Delay Notice: Bus Route ${selectedShift.routeNo} (${selectedShift.shiftType}) is currently delayed by approximately ${delayMinutes} minutes due to ${reasonPhrase}. We apologize for any inconvenience and are working safely to complete the route. Thank you for your patience.`;
    setCustomMessage(text);
  }, [selectedShift, reasonCategory, delayMinutes, isCustomEdited]);

  const alertRecipients: ParentNotificationRecipient[] = useMemo(() => {
    if (!selectedShift) return [];
    const stops = Array.isArray(selectedShift.stops) ? selectedShift.stops : [];
    if (stops.length === 0) return [];

    const activeStop = stops.find((s) => s.stopId === alertStopId) || stops[0];
    let relevantStops: DispatchShiftStop[] = stops;
    if (alertScope === 'this_stop') {
      relevantStops = activeStop ? [activeStop] : stops;
    } else if (alertScope === 'downstream') {
      const idx = stops.findIndex((s) => s.stopId === (activeStop?.stopId || 0));
      relevantStops = idx >= 0 ? stops.slice(idx) : stops;
    }

    const map = new Map<number, { studentId: number; studentName: string; schoolName?: string }>();
    for (const st of relevantStops) {
      const stuList = st.assignedStudents || st.students || [];
      for (const s of stuList) {
        if (!map.has(s.studentId)) {
          map.set(s.studentId, {
            studentId: s.studentId,
            studentName: s.studentName,
            schoolName: s.schoolName || st.schoolName,
          });
        }
      }
    }

    return Array.from(map.values()).map((ts) => {
      const masterStudent = studentsMap[ts.studentId];
      const primaryContact =
        masterStudent?.contacts?.find((c) => c.primaryContact) || masterStudent?.contacts?.[0];
      return {
        studentId: ts.studentId,
        studentName: ts.studentName,
        schoolName: ts.schoolName || masterStudent?.schoolName,
        contactName: primaryContact?.contactName || 'Parent / Guardian',
        relationship: primaryContact?.relationship || 'Parent',
        phone: primaryContact?.mobilePhone || masterStudent?.studentPhone || 'No Phone',
        email: primaryContact?.email || 'No Email',
        selected: true,
      };
    });
  }, [selectedShift, alertScope, alertStopId, studentsMap]);

  const handleSendInlineAlert = async () => {
    if (!selectedShift) return;
    if (alertRecipients.length === 0) {
      alert('No parent recipients found for the selected stop scope on this route.');
      return;
    }
    if (!channels.sms && !channels.email) {
      alert('Please select at least one delivery channel (SMS or Email).');
      return;
    }
    try {
      setSendingAlert(true);
      setAlertSentBanner(null);
      const nowTime = getCurrentHHmm();
      const reasonLabel =
        reasonCategory === 'breakdown'
          ? 'Mechanical Breakdown'
          : reasonCategory === 'traffic'
          ? 'Traffic Congestion'
          : reasonCategory === 'weather'
          ? 'Weather Conditions'
          : 'Operational Delay';

      const notificationAudit = `[${nowTime} Parent Alert] Dispatched +${delayMinutes}m delay notification (${reasonLabel}) to ${alertRecipients.length} parent(s).`;
      const activeChannels = (['sms', 'email'] as ('sms' | 'email')[]).filter((c) => channels[c]);
      const stops = Array.isArray(selectedShift.stops) ? selectedShift.stops : [];
      const selectedStop = stops.find((s) => s.stopId === alertStopId);

      const result = await apiRequest<{
        shift: DispatchShift;
        sentSms: number;
        sentEmail: number;
        failed: number;
      }>(`/api/dispatch/shifts/${selectedShift.id}/notify-parents`, {
        method: 'POST',
        body: JSON.stringify({
          delayMinutes,
          reasonLabel,
          messageText: customMessage,
          channels: activeChannels,
          scope: alertScope,
          stopId: selectedStop?.stopId,
          stopSequence: selectedStop?.sequence,
          stopLocation: selectedStop?.stopLocation,
          notes: notificationAudit,
          recipients: alertRecipients.map((r) => ({
            studentId: r.studentId,
            studentName: r.studentName,
            contactName: r.contactName,
            phone: r.phone,
            email: r.email,
          })),
        }),
      });

      const updatedShift: DispatchShift = {
        ...(result.shift || selectedShift),
        notes: result.shift?.notes || result.shift?.dispatchComments || notificationAudit,
        dispatchComments:
          result.shift?.dispatchComments || result.shift?.notes || notificationAudit,
      };

      await logDispatchAction({
        date: selectedShift.dispatchDate,
        type: 'Parent Notification',
        detail: `Workbench Delay Alert (+${delayMinutes}m, ${reasonLabel}) dispatched for Shift ${selectedShift.routeNo}`,
        shift: selectedShift,
        user: actorName,
      });

      onShiftUpdated(updatedShift);
      setAlertSentBanner(
        `Delay alert (+${delayMinutes}m • ${reasonLabel}) recorded for Route ${selectedShift.routeNo}.`
      );
    } catch (err) {
      console.error('Failed to send inline delay notification:', err);
      alert('Failed to send notification: ' + (err as Error).message);
    } finally {
      setSendingAlert(false);
    }
  };

  // ============================================================================
  // Lower-Right Panel: Inline Stop Arrival & Student Boarding Handlers
  // ============================================================================
  const [stopArrivalInputs, setStopArrivalInputs] = useState<Record<number, string>>({});
  const [savingStopId, setSavingStopId] = useState<number | null>(null);
  const [expandedStopIds, setExpandedStopIds] = useState<Record<number, boolean>>({});
  const [updatingStudentKey, setUpdatingStudentKey] = useState<string | null>(null);

  const handleRecordStopArrivalInline = async (stop: DispatchShiftStop, customTime?: string) => {
    if (!selectedShift) return;
    try {
      setSavingStopId(stop.stopId);
      const timeToUse = customTime || stopArrivalInputs[stop.stopId] || getCurrentHHmm();
      const updated = await DispatchService.recordStopArrival(
        selectedShift.id,
        stop.stopId,
        timeToUse
      );
      await logDispatchAction({
        date: selectedShift.dispatchDate,
        type: 'Stop Arrival',
        detail: `Stop #${stop.sequence} (${stop.stopLocation}) marked arrived at ${timeToUse}`,
        shift: selectedShift,
        user: actorName,
      });
      onShiftUpdated(updated);
    } catch (err) {
      console.error('Failed to record stop arrival:', err);
      alert('Failed to record arrival: ' + (err as Error).message);
    } finally {
      setSavingStopId(null);
    }
  };

  const handleInlineStudentStatus = async (
    stop: DispatchShiftStop,
    studentId: number,
    studentName: string,
    status: DispatchStudentStatus
  ) => {
    if (!selectedShift) return;
    const key = `${stop.stopId}:${studentId}`;
    try {
      setUpdatingStudentKey(key);
      const updated = await DispatchService.updateStudentStatus(
        selectedShift.id,
        stop.stopId,
        studentId,
        status
      );
      await logDispatchAction({
        date: selectedShift.dispatchDate,
        type: 'Student Boarding',
        detail: `Student ${studentName} marked as ${status} at Stop #${stop.sequence} (${stop.stopLocation})`,
        shift: selectedShift,
        user: actorName,
      });
      onShiftUpdated(updated);
    } catch (err) {
      console.error('Failed to update student status:', err);
      alert('Failed to update student: ' + (err as Error).message);
    } finally {
      setUpdatingStudentKey(null);
    }
  };

  // Issue counts across currently filtered shifts
  const subFilterCounts = useMemo(() => {
    let issuesOnly = 0;
    let missingDriver = 0;
    let missingVehicle = 0;
    let checkInOverdue = 0;
    let stopDelayed = 0;
    let alertMessage = 0;

    for (const s of shifts) {
      const info = latenessByShiftId.get(s.id);
      if (!info) continue;
      if (info.effectiveHealth !== 'green') issuesOnly++;
      if (info.isMissingDriver) missingDriver++;
      if (info.isMissingVehicle) missingVehicle++;
      if (info.isCheckInOverdue) checkInOverdue++;
      if (info.hasStopDelay) stopDelayed++;
      if (isAlertMessageShift(s, info)) alertMessage++;
    }
    return {
      all: shifts.length,
      issuesOnly,
      missingDriver,
      missingVehicle,
      checkInOverdue,
      stopDelayed,
      alertMessage,
    };
  }, [shifts, latenessByShiftId]);

  const selectedStops = useMemo(
    () => (selectedShift && Array.isArray(selectedShift.stops) ? selectedShift.stops : EMPTY_STOPS),
    [selectedShift]
  );

  const sentNotifications = useMemo(
    () => (selectedShift ? getSentParentNotifications(selectedShift) : []),
    [selectedShift]
  );

  return (
    <div
      data-testid="dispatch-workbench-mode-panel"
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
    >
      {/* =================================================================== */}
      {/* LEFT PANE (4 Cols): Issue & Shift Queue                             */}
      {/* =================================================================== */}
      <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden lg:sticky lg:top-4 max-h-[calc(100vh-180px)]">
        {/* Queue Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Dispatch Issue Queue
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800">
              {queueShifts.length} Shift{queueShifts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Search input inside queue */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Quick search route, driver, unit..."
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Sub-filter pills for specific issue types */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setQueueSubFilter('all_filtered')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                queueSubFilter === 'all_filtered'
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              All ({subFilterCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setQueueSubFilter('missing_driver')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
                queueSubFilter === 'missing_driver'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100'
              }`}
            >
              <UserX className="w-3 h-3" />
              <span>No Driver ({subFilterCounts.missingDriver})</span>
            </button>
            <button
              type="button"
              onClick={() => setQueueSubFilter('missing_vehicle')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
                queueSubFilter === 'missing_vehicle'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100'
              }`}
            >
              <Truck className="w-3 h-3" />
              <span>No Vehicle ({subFilterCounts.missingVehicle})</span>
            </button>
            <button
              type="button"
              onClick={() => setQueueSubFilter('checkin_overdue')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
                queueSubFilter === 'checkin_overdue'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Late Check-In ({subFilterCounts.checkInOverdue})</span>
            </button>
            <button
              type="button"
              onClick={() => setQueueSubFilter('stop_delayed')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
                queueSubFilter === 'stop_delayed'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100'
              }`}
            >
              <MapPin className="w-3 h-3" />
              <span>Stop Delayed ({subFilterCounts.stopDelayed})</span>
            </button>
            <button
              type="button"
              data-testid="subfilter-alert-message"
              onClick={() => setQueueSubFilter('alert_message')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
                queueSubFilter === 'alert_message'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70 hover:bg-blue-100'
              }`}
            >
              <Bell className="w-3 h-3" />
              <span>Alert Message ({subFilterCounts.alertMessage})</span>
            </button>
          </div>
        </div>

        {/* Scrollable Shift Issue List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {queueShifts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No matching shifts in queue
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Try switching the category filter above or clearing your search query.
              </p>
            </div>
          ) : (
            queueShifts.map((shift) => {
              const info = latenessByShiftId.get(shift.id);
              const isSelected = selectedShift?.id === shift.id;
              const isRed = info?.effectiveHealth === 'red';
              const isYellow = info?.effectiveHealth === 'yellow';

              return (
                <div
                  key={shift.id}
                  data-testid={`workbench-queue-item-${shift.id}`}
                  onClick={() => handleSelectShift(shift)}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500 shadow-sm'
                      : isRed
                      ? 'bg-rose-50/30 dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/60 hover:border-rose-400'
                      : isYellow
                      ? 'bg-amber-50/30 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/60 hover:border-amber-400'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {/* Top line: Route + ShiftType + Time Window */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isRed
                            ? 'bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900'
                            : isYellow
                            ? 'bg-amber-400 ring-2 ring-amber-200 dark:ring-amber-900'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate">
                        {shift.routeNo}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 uppercase">
                        {shift.shiftType}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {shift.firstStopTime || '--:--'} - {shift.lastStopTime || '--:--'}
                    </span>
                  </div>

                  {/* Second line: Crew & Vehicle summary */}
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="truncate">
                      <span className="text-slate-400">Driver: </span>
                      <span className="font-semibold">
                        {shift.driverName && shift.driverName.trim() !== ''
                          ? shift.driverName
                          : 'Unassigned'}
                      </span>
                    </div>
                    <div className="shrink-0 font-mono text-[11px]">
                      <span className="text-slate-400">Unit: </span>
                      <span className="font-semibold">
                        {shift.unitNumber && shift.unitNumber.trim() !== ''
                          ? `#${shift.unitNumber}`
                          : 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Third line: Actionable Issue Badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {info?.isMissingDriver && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectShift(shift, 'assign_driver');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 hover:bg-rose-200 transition"
                      >
                        <UserX className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>Missing Driver</span>
                      </button>
                    )}

                    {info?.isMissingVehicle && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectShift(shift, 'assign_vehicle');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 hover:bg-rose-200 transition"
                      >
                        <Truck className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>Missing Vehicle</span>
                      </button>
                    )}

                    {info?.isCheckInOverdue && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectShift(shift, 'late_alert');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 transition"
                      >
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>
                          Check-In Overdue
                          {info.driverLateMinutes > 0 ? ` (+${info.driverLateMinutes}m)` : ''}
                        </span>
                      </button>
                    )}

                    {info?.hasStopDelay && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectShift(shift, 'late_alert');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 hover:bg-rose-200 transition"
                      >
                        <MapPin className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>
                          Stop Delayed
                          {info.maxStopLateMinutes > 0
                            ? ` (+${info.maxStopLateMinutes}m)`
                            : shift.lateMinutes > 0
                            ? ` (+${shift.lateMinutes}m)`
                            : ''}
                        </span>
                      </button>
                    )}

                    {getSentParentNotifications(shift).length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectShift(shift, 'late_alert');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 transition"
                      >
                        <Bell className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>Alert Sent ({getSentParentNotifications(shift).length})</span>
                      </button>
                    )}

                    {info &&
                      !info.isMissingDriver &&
                      !info.isMissingVehicle &&
                      !info.isCheckInOverdue &&
                      !info.hasStopDelay && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>On Track ({shift.completedStops}/{shift.totalStops} stops)</span>
                        </span>
                      )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* RIGHT PANE (8 Cols): Upper Recommended Action + Lower Shift Detail  */}
      {/* =================================================================== */}
      <div className="lg:col-span-8 space-y-4">
        {!selectedShift ? (
          <div
            data-testid="workbench-empty-selection"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400"
          >
            {queueShifts.length === 0 ? (
              <>
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500 opacity-80" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  All Issues in Queue Resolved
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  There are no matching shifts requiring attention under the active filter.
                </p>
              </>
            ) : (
              <>
                <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 text-amber-500 opacity-75" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Select a Shift from the Left Queue
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Click any shift or issue on the left to view recommended dispatch actions, crew/vehicle details, and live stop arrivals.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ------------------------------------------------------------- */}
            {/* RIGHT UPPER PANEL: Recommended Action                         */}
            {/* ------------------------------------------------------------- */}
            <div
              key={`workbench-recommended-action-${selectedShift.id}`}
              data-testid="workbench-recommended-action-panel"
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              {/* Action Panel Header & Mode Tabs */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Recommended Action
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeActionTab === 'assign_driver'
                        ? `Assign Driver for ${selectedShift.routeNo} (${selectedShift.shiftType})`
                        : activeActionTab === 'assign_attendant'
                        ? `Assign Attendant for ${selectedShift.routeNo} (${selectedShift.shiftType})`
                        : activeActionTab === 'assign_vehicle'
                        ? `Assign Vehicle for ${selectedShift.routeNo} (${selectedShift.shiftType})`
                        : `Delay Alert & Outreach for ${selectedShift.routeNo} (${selectedShift.shiftType})`}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeActionTab === 'assign_driver'
                      ? 'Drivers ranked by qualification tier (Drivers -> Supervisors / Experienced Cover Staff -> Others) and deadhead distance.'
                      : activeActionTab === 'assign_attendant'
                      ? 'Attendants ranked by qualification tier (Attendants -> Supervisors / Experienced Cover Staff -> Others) and proximity.'
                      : activeActionTab === 'assign_vehicle'
                      ? 'Showing compliant vehicles available for dispatch (defective and due-inspection units are excluded).'
                      : 'Send SMS/Email delay alerts to parents or message/check in the assigned driver.'}
                  </p>
                </div>

                {/* Action Switcher Tabs */}
                <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl border border-slate-300/70 dark:border-slate-700 shrink-0">
                  <button
                    type="button"
                    data-testid="action-tab-assign-driver"
                    onClick={() => setActiveActionTab('assign_driver')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeActionTab === 'assign_driver'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    <span>Drivers</span>
                    {selectedLateness?.isMissingDriver && (
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="action-tab-assign-attendant"
                    onClick={() => setActiveActionTab('assign_attendant')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeActionTab === 'assign_attendant'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <HeartHandshake className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Attendants</span>
                  </button>

                  <button
                    type="button"
                    data-testid="action-tab-assign-vehicle"
                    onClick={() => setActiveActionTab('assign_vehicle')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeActionTab === 'assign_vehicle'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5 text-blue-500" />
                    <span>Vehicles</span>
                    {selectedLateness?.isMissingVehicle && (
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="action-tab-late-alert"
                    onClick={() => setActiveActionTab('late_alert')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeActionTab === 'late_alert'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <BellRing className="w-3.5 h-3.5 text-rose-500" />
                    <span>Late Alert / Msg</span>
                    {(selectedLateness?.isCheckInOverdue || selectedLateness?.hasStopDelay) && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    )}
                  </button>
                </div>
              </div>

              {/* Action Panel Body */}
              <div className="p-4">
                {/* CASE 1: ASSIGN DRIVER LIST */}
                {activeActionTab === 'assign_driver' && (
                  <div data-testid="recommended-driver-list" className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search drivers by name, role, phone, or neighborhood..."
                          value={driverSearch}
                          onChange={(e) => setDriverSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSortByDeadhead(!sortByDeadhead)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                            sortByDeadhead
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>{sortByDeadhead ? t.deadhead.sortByDeadhead : t.deadhead.sortByName}</span>
                        </button>

                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={onlyQualifiedDrivers}
                            onChange={(e) => setOnlyQualifiedDrivers(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{isFrench ? 'Qualifiés seulement' : 'Qualified Relief Only'}</span>
                        </label>

                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={onlyAvailableDrivers}
                            onChange={(e) => setOnlyAvailableDrivers(e.target.checked)}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span>Available Only</span>
                        </label>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                      {rankedDriverCandidates.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          No matching drivers found.
                        </div>
                      ) : (
                        rankedDriverCandidates.slice(0, 40).map(({ employee: d, deadhead, conflict, timeOff, eligibility, otherTasks, hasTaskOverlap }) => {
                          const isCurrent =
                            (selectedShift.driverId && selectedShift.driverId === d.id) ||
                            (selectedShift.driverName &&
                              selectedShift.driverName.toLowerCase() ===
                                `${d.firstName} ${d.lastName}`.trim().toLowerCase());
                          const isBusy = assigningDriverId === d.id;

                          return (
                            <div
                              key={d.id}
                              className={`p-2.5 sm:px-3.5 flex items-center justify-between gap-3 transition ${
                                isCurrent
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                                  : timeOff
                                    ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                                    : hasTaskOverlap
                                      ? 'bg-amber-50/40 dark:bg-amber-950/15 hover:bg-amber-50/70 dark:hover:bg-amber-950/25'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {d.firstName} {d.lastName}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                                    {d.jobPosition || 'Driver'}
                                  </span>
                                  <span
                                    data-testid={`driver-eligibility-badge-${d.id}`}
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${getEligibilityBadgeClass(eligibility)}`}
                                  >
                                    {isFrench ? eligibility.badgeTextFr : eligibility.badgeTextEn}
                                  </span>
                                  {deadhead.hasCoordinates && (
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                      ~{deadhead.totalDeadheadKm} km ({deadhead.pullOutKm} km to start • {deadhead.totalMinutes}m)
                                    </span>
                                  )}
                                  {timeOff && (
                                    <span
                                      data-testid={`driver-timeoff-badge-${d.id}`}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                      title={isFrench ? timeOff.detailFr : timeOff.detailEn}
                                    >
                                      <CalendarOff className="w-3 h-3 shrink-0" />
                                      <span>
                                        {isFrench ? timeOff.badgeTextFr : timeOff.badgeTextEn}
                                      </span>
                                    </span>
                                  )}
                                  {hasTaskOverlap && !isCurrent ? (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                      title={conflict.messageEn}
                                    >
                                      Overlap
                                    </span>
                                  ) : !timeOff && otherTasks.length === 0 ? (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                      Available
                                    </span>
                                  ) : null}
                                </div>
                                {timeOff && (
                                  <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-0.5">
                                    {isFrench ? timeOff.detailFr : timeOff.detailEn}
                                  </div>
                                )}
                                {renderCandidateTaskPills(otherTasks, isFrench, `driver-other-tasks-${d.id}`)}
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                                  {(d.preferredPhone || d.mobilePhone) && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      {d.preferredPhone || d.mobilePhone}
                                    </span>
                                  )}
                                  {d.personalAddress && (
                                    <span className="truncate max-w-xs">{d.personalAddress}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {onMessageDriver && (
                                  <button
                                    type="button"
                                    onClick={() => onMessageDriver(d.id)}
                                    title={`Chat with ${d.firstName} ${d.lastName}`}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isCurrent ? (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white inline-flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Assigned</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleAssignDriver(d)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-2xs transition disabled:opacity-50"
                                  >
                                    {isBusy ? 'Assigning...' : 'Assign Driver'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* CASE 1B: ASSIGN ATTENDANT LIST */}
                {activeActionTab === 'assign_attendant' && (
                  <div data-testid="recommended-attendant-list" className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder={
                            isFrench
                              ? 'Rechercher par nom, poste, expérience de remplacement...'
                              : 'Search attendants, supervisors, or experienced cover staff...'
                          }
                          value={attendantSearch}
                          onChange={(e) => setAttendantSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSortByDeadhead(!sortByDeadhead)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                            sortByDeadhead
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>{sortByDeadhead ? t.deadhead.sortByDeadhead : t.deadhead.sortByName}</span>
                        </button>

                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={onlyQualifiedAttendants}
                            onChange={(e) => setOnlyQualifiedAttendants(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{isFrench ? 'Qualifiés seulement' : 'Qualified Relief Only'}</span>
                        </label>

                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={onlyAvailableAttendants}
                            onChange={(e) => setOnlyAvailableAttendants(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Available Only</span>
                        </label>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                      {rankedAttendantCandidates.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          No matching attendants found.
                        </div>
                      ) : (
                        rankedAttendantCandidates.slice(0, 40).map(({ employee: a, deadhead, timeOff, eligibility, otherTasks, hasTaskOverlap }) => {
                          const isCurrent =
                            (selectedShift.attendantId && selectedShift.attendantId === a.id) ||
                            (selectedShift.attendantName &&
                              selectedShift.attendantName.toLowerCase() ===
                                `${a.firstName} ${a.lastName}`.trim().toLowerCase());
                          const isBusy = assigningAttendantId === a.id;

                          return (
                            <div
                              key={a.id}
                              className={`p-2.5 sm:px-3.5 flex items-center justify-between gap-3 transition ${
                                isCurrent
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                                  : timeOff
                                    ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                                    : hasTaskOverlap
                                      ? 'bg-amber-50/40 dark:bg-amber-950/15 hover:bg-amber-50/70 dark:hover:bg-amber-950/25'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {a.firstName} {a.lastName}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                                    {a.jobPosition || a.role || 'Staff'}
                                  </span>
                                  <span
                                    data-testid={`attendant-eligibility-badge-${a.id}`}
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${getEligibilityBadgeClass(eligibility)}`}
                                  >
                                    {isFrench ? eligibility.badgeTextFr : eligibility.badgeTextEn}
                                  </span>
                                  {deadhead.hasCoordinates && (
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                                      {deadhead.distanceToDriverKm !== undefined
                                        ? `${deadhead.distanceToDriverKm} km to driver`
                                        : `${deadhead.distanceToFirstStopKm} km to 1st stop`}
                                    </span>
                                  )}
                                  {timeOff && (
                                    <span
                                      data-testid={`attendant-timeoff-badge-${a.id}`}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                      title={isFrench ? timeOff.detailFr : timeOff.detailEn}
                                    >
                                      <CalendarOff className="w-3 h-3 shrink-0" />
                                      <span>
                                        {isFrench ? timeOff.badgeTextFr : timeOff.badgeTextEn}
                                      </span>
                                    </span>
                                  )}
                                  {hasTaskOverlap && !isCurrent && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                      Overlap
                                    </span>
                                  )}
                                </div>
                                {timeOff && (
                                  <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-0.5">
                                    {isFrench ? timeOff.detailFr : timeOff.detailEn}
                                  </div>
                                )}
                                {renderCandidateTaskPills(otherTasks, isFrench, `attendant-other-tasks-${a.id}`)}
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                                  {(a.preferredPhone || a.mobilePhone) && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      {a.preferredPhone || a.mobilePhone}
                                    </span>
                                  )}
                                  {a.personalAddress && (
                                    <span className="truncate max-w-xs">{a.personalAddress}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {onMessageDriver && (
                                  <button
                                    type="button"
                                    onClick={() => onMessageDriver(a.id)}
                                    title={`Chat with ${a.firstName} ${a.lastName}`}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isCurrent ? (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white inline-flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Assigned</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleAssignAttendant(a)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition disabled:opacity-50"
                                  >
                                    {isBusy ? 'Assigning...' : 'Assign Attendant'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* CASE 2: ASSIGN VEHICLE LIST */}
                {activeActionTab === 'assign_vehicle' && (
                  <div data-testid="recommended-vehicle-list" className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search by unit #, plate #, make/model, or yard..."
                          value={vehicleSearch}
                          onChange={(e) => setVehicleSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Safety Compliant Only</span>
                        </span>

                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={onlyAvailableVehicles}
                            onChange={(e) => setOnlyAvailableVehicles(e.target.checked)}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span>Available Window Only</span>
                        </label>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                      {rankedVehicleCandidates.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          No matching compliant vehicles found.
                        </div>
                      ) : (
                        rankedVehicleCandidates.slice(0, 40).map(({ vehicle: v, conflict, unavail }) => {
                          const isCurrent =
                            (selectedShift.vehicleId && selectedShift.vehicleId === v.vehicleId) ||
                            (selectedShift.unitNumber &&
                              selectedShift.unitNumber.trim() === v.unitNumber.trim());
                          const isBusy = assigningVehicleId === v.vehicleId;

                          return (
                            <div
                              key={v.vehicleId}
                              className={`p-2.5 sm:px-3.5 flex items-center justify-between gap-3 transition ${
                                isCurrent
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                                  : unavail
                                    ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                    Unit #{v.unitNumber}
                                  </span>
                                  <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    Plate: {v.plateNumber}
                                  </span>
                                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                                    {v.manufacturer} {v.model}
                                  </span>
                                  {v.seatCap > 0 && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      {v.seatCap} seats{v.wheelchairCap > 0 ? ` + ${v.wheelchairCap} WC` : ''}
                                    </span>
                                  )}
                                  {unavail && (
                                    <span
                                      data-testid={`vehicle-maintenance-badge-${v.unitNumber}`}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                      title={isFrench ? unavail.detailFr : unavail.detailEn}
                                    >
                                      <Wrench className="w-3 h-3 shrink-0" />
                                      <span>
                                        {isFrench ? unavail.badgeTextFr : unavail.badgeTextEn}
                                      </span>
                                    </span>
                                  )}
                                  {conflict.hasConflict && !isCurrent ? (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                      title={conflict.messageEn}
                                    >
                                      In Use
                                    </span>
                                  ) : !unavail ? (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                      Available
                                    </span>
                                  ) : null}
                                </div>
                                {unavail && (
                                  <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-0.5">
                                    {isFrench ? unavail.detailFr : unavail.detailEn}
                                  </div>
                                )}
                                {v.yardName && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    Yard: {v.yardName} • Status: {v.status || 'In Service'}
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0">
                                {isCurrent ? (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white inline-flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Assigned</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleAssignVehicle(v)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition disabled:opacity-50"
                                  >
                                    {isBusy ? 'Assigning...' : 'Assign Unit'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* CASE 3: LATE ALERT & MESSAGE CONSOLE */}
                {activeActionTab === 'late_alert' && (
                  <div data-testid="recommended-late-alert-panel" className="space-y-4">
                    {/* Auto-Alert Schedule Banner (15m / 45m thresholds) */}
                    <div
                      data-testid="auto-delay-alert-schedule-banner"
                      className="p-2.5 px-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Auto Delay Alert Schedule:
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            reminderSettings?.autoDelayAlertEnabled !== false
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {reminderSettings?.autoDelayAlertEnabled !== false ? 'Auto-Send ON' : 'Auto-Send OFF'}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          1st Alert at{' '}
                          <strong>+{reminderSettings?.autoDelayFirstAlertMinutes ?? 15} min</strong> late • 2nd Alert at{' '}
                          <strong>+{reminderSettings?.autoDelaySecondAlertMinutes ?? 45} min</strong> late
                        </span>
                      </div>
                      {onOpenReminderSettings && (
                        <button
                          type="button"
                          onClick={onOpenReminderSettings}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                        >
                          Configure Time Settings ({reminderSettings?.autoDelayFirstAlertMinutes ?? 15}m / {reminderSettings?.autoDelaySecondAlertMinutes ?? 45}m)
                        </button>
                      )}
                    </div>

                    {/* Crew Quick Outreach Bar */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span>
                              Driver: {selectedShift.driverName || 'Unassigned'}
                            </span>
                            {selectedShift.driverPhone && (
                              <span className="font-mono text-[11px] text-slate-500">
                                ({selectedShift.driverPhone})
                              </span>
                            )}
                            {selectedLateness?.isCheckInOverdue && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                Check-In Overdue (+{selectedLateness.driverLateMinutes}m)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Scheduled Check-In: {selectedLateness?.scheduledCheckInTime || '--:--'} •{' '}
                            {selectedLateness?.isDriverCheckedIn
                              ? `Checked in at ${selectedShift.driverCheckedInAt || selectedLateness.scheduledCheckInTime}`
                              : 'Not checked in yet'}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {selectedShift.driverId && onMessageDriver && (
                          <button
                            type="button"
                            onClick={() => onMessageDriver(selectedShift.driverId!)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5 shadow-2xs transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat with Driver</span>
                          </button>
                        )}
                        {selectedShift.driverName && !selectedLateness?.isDriverCheckedIn && (
                          <button
                            type="button"
                            onClick={() => onQuickCheckIn(selectedShift, false)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-2xs transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Check In Now</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveActionTab('assign_driver')}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          Reassign Driver
                        </button>
                        {sentNotifications.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onOpenHistory(selectedShift)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Sent ({sentNotifications.length})</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Parent Delay Notification Composer */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-5 space-y-3">
                        {/* Reason Category */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Delay Reason
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(
                              [
                                { id: 'traffic', label: 'Traffic', icon: AlertTriangle },
                                { id: 'breakdown', label: 'Breakdown', icon: Wrench },
                                { id: 'weather', label: 'Weather', icon: CloudRain },
                                { id: 'other', label: 'General', icon: Clock },
                              ] as const
                            ).map((item) => {
                              const Icon = item.icon;
                              const active = reasonCategory === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setReasonCategory(item.id);
                                    setIsCustomEdited(false);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                                    active
                                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-200'
                                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span>{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Estimated Delay Duration */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Estimated Delay
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {[10, 15, 20, 30, 45, 60].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => {
                                  setDelayMinutes(mins);
                                  setIsCustomEdited(false);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                                  delayMinutes === mins
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                +{mins}m
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Scope & Channels */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={alertScope}
                              onChange={(e) =>
                                setAlertScope(e.target.value as 'all' | 'downstream' | 'this_stop')
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
                            >
                              <option value="all">All Route Stops</option>
                              <option value="downstream">Downstream Stops</option>
                              <option value="this_stop">Single Stop</option>
                            </select>
                            {alertScope !== 'all' && selectedStops.length > 0 && (
                              <select
                                value={alertStopId}
                                onChange={(e) => setAlertStopId(Number(e.target.value))}
                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 max-w-[140px] truncate"
                              >
                                {selectedStops.map((st) => (
                                  <option key={st.stopId} value={st.stopId}>
                                    #{st.sequence} {st.stopLocation}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={channels.sms}
                                onChange={(e) =>
                                  setChannels((prev) => ({ ...prev, sms: e.target.checked }))
                                }
                                className="rounded border-slate-300 text-amber-600"
                              />
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>SMS</span>
                            </label>
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={channels.email}
                                onChange={(e) =>
                                  setChannels((prev) => ({ ...prev, email: e.target.checked }))
                                }
                                className="rounded border-slate-300 text-amber-600"
                              />
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>Email</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Message Box & Send Button */}
                      <div className="md:col-span-7 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              Parent Notification Message ({alertRecipients.length} Recipient
                              {alertRecipients.length !== 1 ? 's' : ''})
                            </label>
                          </div>
                          <textarea
                            rows={3}
                            value={customMessage}
                            onChange={(e) => {
                              setCustomMessage(e.target.value);
                              setIsCustomEdited(true);
                            }}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        {alertSentBanner && (
                          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{alertSentBanner}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={sendingAlert}
                            onClick={handleSendInlineAlert}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {sendingAlert
                                ? 'Sending Alert...'
                                : `Send Delay Alert (+${delayMinutes}m)`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Recent Dispatched Alert Messages for this Shift */}
                    {sentNotifications.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-blue-500" />
                            <span>Dispatched Alert Messages ({sentNotifications.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenHistory(selectedShift)}
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View Full Audit Log
                          </button>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1.5">
                          {sentNotifications.slice(-3).reverse().map((notif) => (
                            <div
                              key={notif.id}
                              className="p-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300">
                                    {notif.timeStr || '--:--'}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                                    +{notif.delayMinutes}m
                                  </span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {notif.reasonLabel}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    • {notif.recipientsCount} parent(s) ({(notif.channels || []).join('/').toUpperCase()})
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {notif.messageText}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT LOWER PANEL: Shift Details, Crew/Vehicle & Stops Status */}
            {/* ------------------------------------------------------------- */}
            {/* Shift AI Copilot Command Window (Default targets current selected shift) */}
            <ShiftAiCopilotBar
              selectedShift={selectedShift}
              employees={employees}
              availableVehicles={availableVehicles}
              onAssignDriver={handleAssignDriver}
              onAssignVehicle={handleAssignVehicle}
              onAssignAttendant={handleAssignAttendant}
              onUpdateStudentStatus={handleInlineStudentStatus}
              onQuickCheckIn={onQuickCheckIn}
              onQuickAttendantCheckIn={onQuickAttendantCheckIn}
              onQuickCheckOut={(shift) => onQuickCheckOut?.(shift, 'driver')}
              onTriggerDelayAlert={handleTriggerDelayAlertFromCopilot}
              selectedDate={selectedDate}
            />

            <div
              key={`workbench-shift-detail-${selectedShift.id}`}
              data-testid="workbench-shift-detail-panel"
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              {/* Shift Overview Header */}
              <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {selectedShift.routeNo}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    {selectedShift.shiftType}
                  </span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {selectedShift.routeName}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    • {selectedShift.firstStopTime || '--:--'} – {selectedShift.lastStopTime || '--:--'} ({selectedDate})
                  </span>
                </div>

                {/* Secondary Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenCrew(selectedShift)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
                  >
                    Crew & Pay Modal
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPayroll(selectedShift)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1"
                  >
                    <DollarSign className="w-3 h-3" />
                    <span>Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenSplit(selectedShift)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <Split className="w-3 h-3" />
                    <span>Split</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMap(selectedShift)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3 text-amber-500" />
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenStops(selectedShift)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                  >
                    Full Stop View
                  </button>
                </div>
              </div>

              {/* Crew & Vehicle Summary Cards */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800">
                {/* 1. Driver Card */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-amber-500" />
                        <span>Assigned Driver</span>
                      </div>
                      {selectedLateness?.isMissingDriver ? (
                        <button
                          type="button"
                          onClick={() => setActiveActionTab('assign_driver')}
                          className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5 hover:underline text-left block"
                        >
                          Unassigned
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectEmployee
                                ? onSelectEmployee(selectedShift.driverId, selectedShift.driverName)
                                : onOpenCrew(selectedShift)
                            }
                            className="text-xs font-bold text-slate-900 dark:text-white hover:underline hover:text-amber-600 dark:hover:text-amber-400 truncate text-left"
                            title={`Click to view details for Driver: ${selectedShift.driverName}`}
                          >
                            {selectedShift.driverName}
                          </button>

                          <div className="inline-flex items-center gap-1 shrink-0">
                            {selectedShift.driverId && onMessageDriver && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMessageDriver(selectedShift.driverId!);
                                }}
                                title={`Chat with ${selectedShift.driverName}`}
                                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-amber-600 hover:border-amber-400 dark:hover:text-amber-400 transition"
                              >
                                <MessageSquare className="w-3 h-3 text-amber-500" />
                              </button>
                            )}

                            {driverPhone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSmsModalState({
                                    isOpen: true,
                                    phone: driverPhone,
                                    name: selectedShift.driverName || 'Driver',
                                    role: 'driver',
                                  });
                                }}
                                title={`Send SMS to ${selectedShift.driverName} (${driverPhone})`}
                                className="px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 hover:border-blue-400 transition inline-flex items-center gap-1"
                              >
                                <Send className="w-2.5 h-2.5 text-blue-500" />
                                <span>SMS</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {driverPhone && (
                        <a
                          href={`tel:${driverPhone}`}
                          title={`Call ${selectedShift.driverName}`}
                          className="text-[11px] font-mono text-slate-500 hover:underline hover:text-slate-800 dark:hover:text-slate-200 block mt-0.5"
                        >
                          {driverPhone}
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveActionTab('assign_driver')}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 transition shrink-0"
                    >
                      {selectedLateness?.isMissingDriver ? 'Assign' : 'Change'}
                    </button>
                  </div>

                  {/* Driver Check-In / Out Controls */}
                  {!selectedLateness?.isMissingDriver && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                      {selectedLateness?.isDriverCheckedIn ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onQuickCheckIn(selectedShift, true)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                            title="Click to undo check-in"
                          >
                            ✓ In {selectedShift.driverCheckedInAt || selectedLateness.scheduledCheckInTime}
                          </button>
                          {selectedShift.isDriverCheckedOut ? (
                            <button
                              type="button"
                              onClick={() => onQuickCheckOut(selectedShift, 'driver', true)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                            >
                              ✓ Out {selectedShift.driverCheckedOutAt}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenCheckOutModal(selectedShift, 'driver')}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-purple-100"
                            >
                              <LogOut className="w-2.5 h-2.5 inline mr-1" />
                              Check Out
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onQuickCheckIn(selectedShift, false)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                            selectedLateness?.isDriverOverdue
                              ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {selectedLateness?.isDriverOverdue
                            ? `⚠ Check In (+${selectedLateness.driverLateMinutes}m)`
                            : `Check In (${selectedLateness?.scheduledCheckInTime || '--:--'})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Vehicle Card */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Truck className="w-3 h-3 text-blue-500" />
                        <span>Assigned Vehicle</span>
                      </div>
                      {selectedLateness?.isMissingVehicle ? (
                        <button
                          type="button"
                          onClick={() => setActiveActionTab('assign_vehicle')}
                          className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5 hover:underline text-left block"
                        >
                          Unassigned Unit
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectVehicle
                                ? onSelectVehicle(selectedShift.vehicleId, selectedShift.unitNumber)
                                : onOpenCrew(selectedShift)
                            }
                            className="text-xs font-mono font-bold text-slate-900 dark:text-white hover:underline hover:text-blue-600 dark:hover:text-blue-400 truncate text-left"
                            title={`Click to view details for Vehicle Unit #${selectedShift.unitNumber}`}
                          >
                            Unit #{selectedShift.unitNumber}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenMap(selectedShift);
                            }}
                            title={`View route & vehicle map for Unit #${selectedShift.unitNumber}`}
                            className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-amber-600 hover:border-amber-400 dark:hover:text-amber-400 transition inline-flex items-center gap-1 text-[10px] font-semibold"
                          >
                            <Navigation className="w-3 h-3 text-amber-500" />
                            <span>Map</span>
                          </button>
                        </div>
                      )}
                      {selectedShift.plateNumber && (
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Plate: {selectedShift.plateNumber}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveActionTab('assign_vehicle')}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 hover:bg-blue-200 transition shrink-0"
                    >
                      {selectedLateness?.isMissingVehicle ? 'Assign' : 'Change'}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span>Yard: <strong className="text-slate-700 dark:text-slate-300">{selectedShift.yardName || 'Main Yard'}</strong></span>
                    {!selectedLateness?.isMissingVehicle && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectVehicle
                            ? onSelectVehicle(selectedShift.vehicleId, selectedShift.unitNumber)
                            : onOpenCrew(selectedShift)
                        }
                        className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Details
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Attendant & Route Progress Card */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3 text-emerald-500" />
                      <span>Attendant & Route Progress</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="text-xs text-slate-500">Attendant:</span>
                        {selectedShift.attendantName && selectedShift.attendantName.trim() !== '' && selectedShift.attendantName !== 'None' ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onSelectEmployee
                                  ? onSelectEmployee(selectedShift.attendantId, selectedShift.attendantName)
                                  : onOpenCrew(selectedShift)
                              }
                              className="text-xs font-bold text-slate-900 dark:text-white hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 truncate text-left"
                              title={`Click to view details for Attendant: ${selectedShift.attendantName}`}
                            >
                              {selectedShift.attendantName}
                            </button>

                            <div className="inline-flex items-center gap-1 shrink-0">
                              {selectedShift.attendantId && onMessageDriver && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMessageDriver(selectedShift.attendantId!);
                                  }}
                                  title={`Chat with ${selectedShift.attendantName}`}
                                  className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-amber-600 hover:border-amber-400 dark:hover:text-amber-400 transition inline-flex items-center"
                                >
                                  <MessageSquare className="w-3 h-3 text-amber-500" />
                                </button>
                              )}

                              {attendantPhone && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSmsModalState({
                                      isOpen: true,
                                      phone: attendantPhone,
                                      name: selectedShift.attendantName || 'Attendant',
                                      role: 'attendant',
                                    });
                                  }}
                                  title={`Send SMS to ${selectedShift.attendantName} (${attendantPhone})`}
                                  className="px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 hover:border-blue-400 transition inline-flex items-center gap-1"
                                >
                                  <Send className="w-2.5 h-2.5 text-blue-500" />
                                  <span>SMS</span>
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveActionTab('assign_attendant')}
                            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                            title="Assign an attendant in workbench"
                          >
                            + Assign Attendant
                          </button>
                        )}
                      </div>

                      {selectedShift.attendantName && selectedShift.attendantName.trim() !== '' && selectedShift.attendantName !== 'None' && (
                        <button
                          type="button"
                          onClick={() =>
                            onQuickAttendantCheckIn(
                              selectedShift,
                              !!selectedLateness?.isAttendantCheckedIn
                            )
                          }
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 ${
                            selectedLateness?.isAttendantCheckedIn
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-200 text-slate-700 border-slate-300'
                          }`}
                        >
                          {selectedLateness?.isAttendantCheckedIn ? '✓ In' : 'Check In'}
                        </button>
                      )}
                    </div>
                    {attendantPhone && (
                      <a
                        href={`tel:${attendantPhone}`}
                        title={`Call ${selectedShift.attendantName}`}
                        className="text-[11px] font-mono text-slate-500 hover:underline hover:text-slate-800 dark:hover:text-slate-200 block mt-0.5"
                      >
                        {attendantPhone}
                      </a>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                    <span className="text-slate-500">Stops Completed:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {selectedShift.completedStops} / {selectedShift.totalStops}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stops & Arrival Status Timeline List */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      Stops & Arrival Status ({selectedShift.completedStops}/{selectedShift.totalStops} Arrived)
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Click a stop&apos;s riders badge to inspect or update passenger boarding
                  </span>
                </div>

                {selectedStops.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    No stops configured for this shift.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStops.map((st) => {
                      const actualTime = st.actualArrivalTime || st.stopArrivalTime;
                      const isArrived = !!actualTime;
                      const lateMins =
                        isArrived
                          ? typeof st.minutesLate === 'number' && st.minutesLate > 0
                            ? st.minutesLate
                            : st.stopScheduleTime
                            ? Math.max(0, diffMinutes(actualTime, st.stopScheduleTime))
                            : 0
                          : isToday && st.stopScheduleTime
                          ? Math.max(0, diffMinutes(currentTimeStr, st.stopScheduleTime))
                          : 0;
                      const isOverdue = !isArrived && isToday && lateMins > 0;
                      const students = st.assignedStudents || st.students || [];
                      const isExpanded = !!expandedStopIds[st.stopId];
                      const isSavingThisStop = savingStopId === st.stopId;

                      return (
                        <div
                          key={st.stopId}
                          data-testid={`workbench-stop-row-${st.stopId}`}
                          className={`rounded-xl border transition ${
                            isArrived
                              ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200/80 dark:border-emerald-900/50'
                              : isOverdue
                              ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/80'
                              : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            {/* Stop Sequence + Location + Schedule */}
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                                  isArrived
                                    ? 'bg-emerald-600 text-white'
                                    : isOverdue
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {isArrived ? <Check className="w-3.5 h-3.5" /> : st.sequence}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                    {st.stopScheduleTime}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {st.stopLocation}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {st.stopType}
                                  </span>
                                  {isArrived ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                      Arrived {actualTime}
                                      {lateMins > 0 ? ` (+${lateMins}m)` : ''}
                                    </span>
                                  ) : isOverdue ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                                      Overdue +{lateMins}m
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium text-slate-400">
                                      Pending
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                                  {st.schoolName && <span>School: {st.schoolName}</span>}
                                  {students.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedStopIds((prev) => ({
                                          ...prev,
                                          [st.stopId]: !prev[st.stopId],
                                        }))
                                      }
                                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                                    >
                                      <Users className="w-3 h-3" />
                                      <span>{students.length} passenger(s)</span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3 h-3" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Inline Arrival Controls */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              <input
                                type="time"
                                value={
                                  stopArrivalInputs[st.stopId] ??
                                  actualTime ??
                                  currentTimeStr
                                }
                                onChange={(e) =>
                                  setStopArrivalInputs((prev) => ({
                                    ...prev,
                                    [st.stopId]: e.target.value,
                                  }))
                                }
                                className="px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                              />
                              <button
                                type="button"
                                disabled={isSavingThisStop}
                                onClick={() => handleRecordStopArrivalInline(st)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50"
                              >
                                {isSavingThisStop
                                  ? '...'
                                  : isArrived
                                  ? 'Update'
                                  : 'Arrived'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAlertStopId(st.stopId);
                                  setAlertScope('downstream');
                                  setActiveActionTab('late_alert');
                                }}
                                title="Send delay alert starting from this stop"
                                className="p-1.5 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expandable Student Boarding List */}
                          {isExpanded && students.length > 0 && (
                            <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                              {students.map((stu) => {
                                const busy =
                                  updatingStudentKey === `${st.stopId}:${stu.studentId}`;
                                const status =
                                  stu.status === 'picked_up' || stu.isPresent === true
                                    ? 'picked_up'
                                    : stu.status === 'dropped_off'
                                    ? 'dropped_off'
                                    : stu.status === 'absent' ||
                                      stu.status === 'no_show' ||
                                      stu.isPresent === false
                                    ? 'absent'
                                    : 'scheduled';

                                return (
                                  <div
                                    key={stu.studentId}
                                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => onSelectStudent?.(stu.studentId)}
                                      className="font-semibold text-slate-800 dark:text-slate-200 hover:text-amber-600 text-left truncate"
                                    >
                                      {stu.studentName}
                                      {stu.absenceReason && status === 'absent' && (
                                        <span className="ml-2 text-[10px] text-rose-600 font-normal">
                                          ({stu.absenceReason})
                                        </span>
                                      )}
                                    </button>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          handleInlineStudentStatus(
                                            st,
                                            stu.studentId,
                                            stu.studentName,
                                            'picked_up'
                                          )
                                        }
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                          status === 'picked_up'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                        }`}
                                      >
                                        Picked Up
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          handleInlineStudentStatus(
                                            st,
                                            stu.studentId,
                                            stu.studentName,
                                            'dropped_off'
                                          )
                                        }
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                          status === 'dropped_off'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                        }`}
                                      >
                                        Dropped Off
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          handleInlineStudentStatus(
                                            st,
                                            stu.studentId,
                                            stu.studentName,
                                            status === 'absent' ? 'scheduled' : 'absent'
                                          )
                                        }
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                          status === 'absent'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                        }`}
                                      >
                                        Absent
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {smsModalState && (
        <SmsConversationModal
          isOpen={smsModalState.isOpen}
          onClose={() => setSmsModalState(null)}
          recipientPhone={smsModalState.phone}
          recipientName={smsModalState.name}
          recipientRole={smsModalState.role}
          shift={selectedShift}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
};
