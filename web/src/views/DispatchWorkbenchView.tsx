import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue, memo, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Search,
  Truck,
  MoreHorizontal,
  RefreshCw,
  Check,
  Table as TableIcon,
  Layers,
  Clock,
  ShieldAlert,
  ChevronDown,
  SlidersHorizontal,
  Split,
  DollarSign,
  BellRing,
  MessageSquare,
  UserX,
  MapPin,
  History,
  LogOut,
  UserCheck,
  Users,
  Navigation,
  Wrench,
  Bell
} from 'lucide-react';
import { DispatchShift, DispatchShiftStop, CheckInReminderSettings } from '../types/dispatch';
import { DispatchService } from '../services/dispatchService';
import { apiRequest } from '../services/api';
import { DefectService } from '../services/defectService';
import { VehicleInspectionService } from '../services/vehicleInspectionService';
import { TimeOffService } from '../services/timeOffService';
import { CharterService } from '../services/charterService';
import { CharterTrip } from '../types/charter';
import { VehicleDefectReport } from '../types/defect';
import { VehicleInspectionRecord, PreventiveMaintenanceRecord } from '../types/vehicleInspection';
import { TimeOffRequest } from '../types/timeOff';
import {
  getUnavailableVehiclesForDate,
  getVehicleUnavailabilityReason,
  getUniqueUnavailableVehicleList,
  getEmployeeTimeOffMapForDate,
} from '../utils/vehicleAvailabilityUtils';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import { Yard } from '../types/yard';
import { Student } from '../types/student';
import { getLocalTodayString, addDaysToDateString } from '../utils/dateUtils';
import {
  getCurrentHHmm,
  calculateDynamicShiftLateness,
  getSentParentNotifications,
  evaluateAutoDelayAlertTrigger,
  isAlertMessageShift,
  type ShiftLatenessInfo,
} from '../utils/dispatchDelayUtils';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { logDispatchAction } from '../utils/dispatchLogger';
import { DispatchWorkbenchModePanel } from '../components/dispatch/DispatchWorkbenchModePanel';
import { CrewCheckOutModal, CrewCheckOutModalState } from '../components/dispatch/CrewCheckOutModal';

const EMPTY_STUDENTS_MAP: Record<number, Student> = {};

const loadDispatchStopModal = () => import('../components/dispatch/DispatchStopModal');
const loadDispatchCrewModal = () => import('../components/dispatch/DispatchCrewModal');
const loadDispatchSplitModal = () => import('../components/dispatch/DispatchSplitModal');
const loadDispatchPayrollModal = () => import('../components/dispatch/DispatchPayrollModal');
const loadParentNotificationModal = () => import('../components/dispatch/ParentNotificationModal');
const loadParentNotificationHistoryModal = () => import('../components/dispatch/ParentNotificationHistoryModal');
const loadRecordStudentAbsenceModal = () => import('../components/dispatch/RecordStudentAbsenceModal');
const loadCheckInReminderSettingsModal = () => import('../components/dispatch/CheckInReminderSettingsModal');

const DispatchStopModal = React.lazy(() =>
  loadDispatchStopModal().then((module) => ({ default: module.DispatchStopModal }))
);
const DispatchCrewModal = React.lazy(() =>
  loadDispatchCrewModal().then((module) => ({ default: module.DispatchCrewModal }))
);
const DispatchSplitModal = React.lazy(() =>
  loadDispatchSplitModal().then((module) => ({ default: module.DispatchSplitModal }))
);
const DispatchPayrollModal = React.lazy(() =>
  loadDispatchPayrollModal().then((module) => ({ default: module.DispatchPayrollModal }))
);
const ParentNotificationModal = React.lazy(() =>
  loadParentNotificationModal().then((module) => ({ default: module.ParentNotificationModal }))
);
const ParentNotificationHistoryModal = React.lazy(() =>
  loadParentNotificationHistoryModal().then((module) => ({ default: module.ParentNotificationHistoryModal }))
);
const RecordStudentAbsenceModal = React.lazy(() =>
  loadRecordStudentAbsenceModal().then((module) => ({ default: module.RecordStudentAbsenceModal }))
);
const CheckInReminderSettingsModal = React.lazy(() =>
  loadCheckInReminderSettingsModal().then((module) => ({ default: module.CheckInReminderSettingsModal }))
);

let workbenchModalsPreloaded = false;
function preloadWorkbenchModals() {
  if (workbenchModalsPreloaded) return;
  workbenchModalsPreloaded = true;
  void loadDispatchStopModal();
  void loadDispatchCrewModal();
  void loadDispatchSplitModal();
  void loadDispatchPayrollModal();
  void loadParentNotificationModal();
  void loadParentNotificationHistoryModal();
}

function ModalLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 text-sm text-white">
      Loading...
    </div>
  );
}

const DISPATCH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function DispatchLiveClock() {
  const [label, setLabel] = useState(() => getCurrentHHmm());

  useEffect(() => {
    const timer = setInterval(() => {
      const next = getCurrentHHmm();
      setLabel((prev) => (prev === next ? prev : next));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  return <>Live {label}</>;
}

interface DispatchWorkbenchViewProps {
  employees: Employee[];
  vehicles: Vehicle[];
  yards: Yard[];
  studentsMap?: Record<number, Student>;
  onSelectStudent?: (studentId: number) => void;
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
  onSelectVehicle?: (vehicleId?: number, unitNumber?: string) => void;
  onNavigateToChangeLog?: (date: string) => void;
  onNavigateToTemporaryAssignments?: () => void;
  onNavigateToAbsences?: () => void;
  onMessageDriver?: (driverId: string) => void;
}

const DispatchWorkbenchViewInner: React.FC<DispatchWorkbenchViewProps> = ({
  employees,
  vehicles,
  yards,
  studentsMap = EMPTY_STUDENTS_MAP,
  onSelectStudent,
  onSelectEmployee,
  onSelectVehicle,
  onNavigateToChangeLog,
  onNavigateToTemporaryAssignments,
  onNavigateToAbsences,
  onMessageDriver,
}) => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
  // Current selected dispatch date (defaults to local today in YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalTodayString());
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(() => getCurrentHHmm());
  const isToday = selectedDate === getLocalTodayString();

  // Refresh lateness once per minute only when viewing today's shifts.
  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => {
      const next = getCurrentHHmm();
      setCurrentTimeStr((prev) => (prev === next ? prev : next));
    }, 60000);
    return () => clearInterval(timer);
  }, [isToday]);

  const [shifts, setShifts] = useState<DispatchShift[]>([]);
  const [loading, setLoading] = useState(false);
  // Ignore REST responses that started before a newer load, create, or delete.
  const shiftLoadGen = useRef(0);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Vehicle Defect, Periodic Inspection & Employee Time Off state for dispatch visibility
  const [defectReports, setDefectReports] = useState<VehicleDefectReport[]>([]);
  const [inspectionRecords, setInspectionRecords] = useState<VehicleInspectionRecord[]>([]);
  const [pmRecords, setPmRecords] = useState<PreventiveMaintenanceRecord[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [dayCharterTrips, setDayCharterTrips] = useState<CharterTrip[]>([]);
  const scrubbedShiftKeysRef = React.useRef<Set<string>>(new Set());

  const authUid = currentUser?.uid;
  useEffect(() => {
    if (!authUid) return;

    const unsubDefects = DefectService.subscribeToDefects((data) => {
      setDefectReports(Array.isArray(data) ? data : []);
    });

    const unsubInsp = VehicleInspectionService.subscribe((updated) => {
      setInspectionRecords(Array.isArray(updated) ? updated : []);
    });
    const unsubPM = VehicleInspectionService.subscribePM((updated) => {
      setPmRecords(Array.isArray(updated) ? updated : []);
    });
    const unsubTimeOff = TimeOffService.subscribeToTimeOffRequests((data) => {
      setTimeOffRequests(Array.isArray(data) ? data : []);
    });

    return () => {
      setTimeout(() => {
        try { unsubDefects(); } catch { /* listener already closed */ }
        try { unsubInsp(); } catch { /* listener already closed */ }
        try { unsubPM(); } catch { /* listener already closed */ }
        try { unsubTimeOff(); } catch { /* listener already closed */ }
      }, 150);
    };
  }, [authUid]);

  // Subscribe to charter trips for the selected dispatch date so driver/attendant lists show charter tasks
  useEffect(() => {
    if (!authUid || !selectedDate) {
      setDayCharterTrips([]);
      return;
    }
    let active = true;
    const unsubCharters = CharterService.subscribeToTrips(
      (list) => {
        if (active) setDayCharterTrips(Array.isArray(list) ? list : []);
      },
      () => {
        if (active) setDayCharterTrips([]);
      },
      selectedDate
    );
    return () => {
      active = false;
      setTimeout(() => {
        try { unsubCharters(); } catch { /* listener already closed */ }
      }, 150);
    };
  }, [authUid, selectedDate]);

  // Only show maintenance/defect status and time-off info for today, tomorrow, or future dates (not yesterday/past)
  const isTodayOrFuture = selectedDate >= getLocalTodayString();

  const unavailableVehiclesMap = useMemo(
    () =>
      isTodayOrFuture
        ? getUnavailableVehiclesForDate(
            selectedDate,
            defectReports,
            inspectionRecords,
            pmRecords,
            vehicles
          )
        : new Map(),
    [isTodayOrFuture, selectedDate, defectReports, inspectionRecords, pmRecords, vehicles]
  );

  const employeeTimeOffMap = useMemo(
    () => (isTodayOrFuture ? getEmployeeTimeOffMapForDate(selectedDate, timeOffRequests) : new Map()),
    [isTodayOrFuture, selectedDate, timeOffRequests]
  );

  const unavailableVehiclesList = useMemo(
    () => getUniqueUnavailableVehicleList(unavailableVehiclesMap),
    [unavailableVehiclesMap]
  );

  // Effective shifts: any vehicle in Vehicle Defect or Periodic Inspection is stripped from dispatch shifts
  const effectiveShifts = useMemo(() => {
    const safeShifts = Array.isArray(shifts) ? shifts : [];
    if (unavailableVehiclesMap.size === 0) return safeShifts;

    return safeShifts.map((s) => {
      if (!s.unitNumber && !s.vehicleId) return s;
      const reason = getVehicleUnavailabilityReason(
        s.unitNumber,
        s.vehicleId,
        unavailableVehiclesMap
      );
      if (!reason) return s;

      return {
        ...s,
        vehicleId: 0,
        unitNumber: '',
        plateNumber: '',
        isTemporaryVehicle: false,
        health: 'red' as const,
      };
    });
  }, [shifts, unavailableVehiclesMap]);

  // Persist unassignment to backend/Firestore if any raw shift still holds a grounded/inspecting vehicle
  useEffect(() => {
    const safeShifts = Array.isArray(shifts) ? shifts : [];
    if (safeShifts.length === 0 || unavailableVehiclesMap.size === 0) return;

    safeShifts.forEach((s) => {
      if (!s.unitNumber && !s.vehicleId) return;
      const reason = getVehicleUnavailabilityReason(
        s.unitNumber,
        s.vehicleId,
        unavailableVehiclesMap
      );
      if (!reason) return;

      const key = `${s.id}:${s.unitNumber || ''}:${s.vehicleId || ''}`;
      if (scrubbedShiftKeysRef.current.has(key)) return;
      scrubbedShiftKeysRef.current.add(key);

      DispatchService.removeUnavailableVehicleFromDispatches(
        s.unitNumber || '',
        s.vehicleId,
        selectedDate,
        selectedDate
      ).catch(() => {});

      DispatchService.updateShift(s.id, {
        vehicleId: 0,
        unitNumber: '',
        plateNumber: '',
        isTemporaryVehicle: false,
        health: 'red',
      }).catch(() => {});
    });
  }, [shifts, unavailableVehiclesMap, selectedDate]);

  // Filter state matching screenshot
  const [routeFilter, setRouteFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [stopFilter, setStopFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [shiftTypeFilter, setShiftTypeFilter] = useState<'ALL' | 'AM' | 'PM' | 'Midday'>('ALL');
  const [yardFilter, setYardFilter] = useState<string>('ALL');
  const [healthFilter, setHealthFilter] = useState<'ALL' | 'green' | 'attention' | 'unassigned' | 'checkin_overdue' | 'stop_delayed' | 'alert_message'>('ALL');
  const [viewMode, setViewMode] = useState<'workbench' | 'card' | 'sheet'>('workbench');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Reminder & Auto-Delay Alert Settings state
  const [reminderSettings, setReminderSettings] = useState<CheckInReminderSettings>({
    enabled: true,
    reminderGraceMinutes: 20,
    pretripReminderGraceMinutes: 60,
    autoDelayAlertEnabled: true,
    autoDelayFirstAlertMinutes: 15,
    autoDelaySecondAlertMinutes: 45,
    reminderWindowStart: '06:00',
    reminderWindowEnd: '18:00',
  });
  const autoAlertDispatchedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    DispatchService.getCheckInReminderSettings()
      .then((s) => {
        if (!isMounted || !s) return;
        setReminderSettings({
          enabled: s.enabled ?? true,
          reminderGraceMinutes: s.reminderGraceMinutes || 20,
          pretripReminderGraceMinutes: s.pretripReminderGraceMinutes || 60,
          autoDelayAlertEnabled: s.autoDelayAlertEnabled ?? true,
          autoDelayFirstAlertMinutes: s.autoDelayFirstAlertMinutes || 15,
          autoDelaySecondAlertMinutes: s.autoDelaySecondAlertMinutes || 45,
          reminderWindowStart: s.reminderWindowStart || '06:00',
          reminderWindowEnd: s.reminderWindowEnd || '18:00',
          updatedAt: s.updatedAt,
        });
      })
      .catch(() => {
        // Keep defaults
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Modal states
  const [selectedShiftForStops, setSelectedShiftForStops] = useState<DispatchShift | null>(null);
  const [initialStopsTab, setInitialStopsTab] = useState<'stops' | 'map'>('stops');
  const [initialStopId, setInitialStopId] = useState<number | null>(null);
  const [selectedShiftForCrew, setSelectedShiftForCrew] = useState<DispatchShift | null>(null);
  const [selectedShiftForSplit, setSelectedShiftForSplit] = useState<DispatchShift | null>(null);
  const [selectedShiftForPayroll, setSelectedShiftForPayroll] = useState<DispatchShift | null>(null);
  const [selectedShiftForNotification, setSelectedShiftForNotification] = useState<DispatchShift | null>(null);
  const [selectedStopForNotification, setSelectedStopForNotification] = useState<number | null>(null);
  const [selectedShiftForHistory, setSelectedShiftForHistory] = useState<DispatchShift | null>(null);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isReminderSettingsOpen, setIsReminderSettingsOpen] = useState(false);

  const handleOpenMap = useCallback((shift: DispatchShift) => {
    setSelectedShiftForStops(shift);
    setInitialStopsTab('map');
    setInitialStopId(null);
  }, []);

  const handleOpenStops = useCallback((shift: DispatchShift, stopId?: number) => {
    setSelectedShiftForStops(shift);
    setInitialStopsTab('stops');
    setInitialStopId(stopId || null);
  }, []);
  const handleOpenCrew = useCallback((shift: DispatchShift) => {
    setSelectedShiftForCrew(shift);
  }, []);
  const handleOpenSplit = useCallback((shift: DispatchShift) => {
    setSelectedShiftForSplit(shift);
  }, []);
  const handleOpenPayroll = useCallback((shift: DispatchShift) => {
    setSelectedShiftForPayroll(shift);
  }, []);
  const handleOpenNotification = useCallback((shift: DispatchShift, stopId?: number) => {
    setSelectedShiftForNotification(shift);
    setSelectedStopForNotification(stopId ?? null);
  }, []);
  const handleOpenHistory = useCallback((shift: DispatchShift) => {
    setSelectedShiftForHistory(shift);
  }, []);

  // Real-time Firestore subscription to dispatch_shifts for the selectedDate
  useEffect(() => {
    if (!DISPATCH_DATE_RE.test(selectedDate)) {
      shiftLoadGen.current += 1;
      setShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let isMounted = true;
    const gen = ++shiftLoadGen.current;

    // Failsafe timer: if real-time listener doesn't emit within 3.5s, fetch via REST API
    const fallbackTimer = setTimeout(() => {
      if (!isMounted || gen !== shiftLoadGen.current) return;
      DispatchService.list(selectedDate)
        .then((apiShifts) => {
          if (!isMounted || gen !== shiftLoadGen.current) return;
          setShifts((prev) => (prev.length === 0 ? (Array.isArray(apiShifts) ? apiShifts : []) : prev));
          setLoading(false);
        })
        .catch(() => {
          if (isMounted && gen === shiftLoadGen.current) setLoading(false);
        });
    }, 3500);

    const unsubscribe = DispatchService.subscribeToDayShifts(
      selectedDate,
      (updatedShifts) => {
        if (!isMounted || gen !== shiftLoadGen.current) return;
        clearTimeout(fallbackTimer);
        setShifts(Array.isArray(updatedShifts) ? updatedShifts : []);
        setLoading(false);
      },
      (err) => {
        if (!isMounted || gen !== shiftLoadGen.current) return;
        clearTimeout(fallbackTimer);
        console.warn('[DispatchWorkbench] Realtime listener notice (falling back to REST API):', err);
        DispatchService.list(selectedDate)
          .then((apiShifts) => {
            if (!isMounted || gen !== shiftLoadGen.current) return;
            setShifts(Array.isArray(apiShifts) ? apiShifts : []);
            setLoading(false);
          })
          .catch(() => {
            if (!isMounted || gen !== shiftLoadGen.current) return;
            setShifts([]);
            setLoading(false);
          });
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      setTimeout(() => {
        try {
          unsubscribe();
        } catch (err) {
          console.warn('[DispatchWorkbench] Unsubscribe warning:', err);
        }
      }, 150);
    };
  }, [selectedDate]);

  // Keep open modals in sync if real-time shift updates arrive
  useEffect(() => {
    const safeShifts = Array.isArray(effectiveShifts) ? effectiveShifts : [];
    const byId = new Map(safeShifts.map((shift) => [shift.id, shift]));
    const refreshOpenShift = (
      current: DispatchShift | null,
      apply: (shift: DispatchShift) => void
    ) => {
      if (!current) return;
      const refreshed = byId.get(current.id);
      if (refreshed && refreshed !== current) apply(refreshed);
    };
    refreshOpenShift(selectedShiftForStops, setSelectedShiftForStops);
    refreshOpenShift(selectedShiftForCrew, setSelectedShiftForCrew);
    refreshOpenShift(selectedShiftForPayroll, setSelectedShiftForPayroll);
    refreshOpenShift(selectedShiftForNotification, setSelectedShiftForNotification);
    refreshOpenShift(selectedShiftForHistory, setSelectedShiftForHistory);
  }, [effectiveShifts, selectedShiftForStops, selectedShiftForCrew, selectedShiftForPayroll, selectedShiftForNotification, selectedShiftForHistory]);

  // Date navigation handlers
  const handlePrevDay = () => {
    setSelectedDate((prev) => addDaysToDateString(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => addDaysToDateString(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(getLocalTodayString());
  };

  // Actions
  const handleCreateDay = async () => {
    if (!DISPATCH_DATE_RE.test(selectedDate)) {
      alert('A dispatch date is required (YYYY-MM-DD).');
      return;
    }
    const date = selectedDate;
    try {
      setGenerating(true);
      // Drop any in-flight list from the empty day so it cannot overwrite the new shifts.
      shiftLoadGen.current += 1;
      const res = await DispatchService.createDay(date, false);
      const gen = ++shiftLoadGen.current;
      const [, list] = await Promise.all([
        logDispatchAction({
          date,
          type: 'Day Generated',
          detail: `Generated dispatch day with ${res.created} shifts (${res.skippedExisting} already existed)`,
          user: actorName,
        }),
        DispatchService.list(date),
      ]);
      if (gen === shiftLoadGen.current) {
        setShifts(Array.isArray(list) ? list : []);
        setLoading(false);
      }
      alert(`Dispatch Generation Complete for ${res.date}:\nCreated ${res.created} shifts (${res.skippedExisting} already existed).`);
    } catch (err) {
      console.error('Failed to create day:', err);
      alert('Error creating dispatch day: ' + (err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteDay = async () => {
    if (!DISPATCH_DATE_RE.test(selectedDate)) {
      alert('A dispatch date is required (YYYY-MM-DD).');
      return;
    }
    if (!window.confirm(`Are you sure you want to clear all dispatch shifts for ${selectedDate}? This will remove today's tracking data.`)) {
      return;
    }
    const date = selectedDate;
    try {
      setDeleting(true);
      await DispatchService.deleteDay(date);
      await logDispatchAction({
        date,
        type: 'Day Deleted',
        detail: `Cleared all dispatch shifts for date ${date}`,
        user: actorName,
      });
      shiftLoadGen.current += 1;
      setShifts([]);
    } catch (err) {
      console.error('Failed to delete day:', err);
      alert('Error deleting day: ' + (err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!DISPATCH_DATE_RE.test(selectedDate)) {
      shiftLoadGen.current += 1;
      setShifts([]);
      setLoading(false);
      return;
    }
    const date = selectedDate;
    const gen = ++shiftLoadGen.current;
    try {
      setLoading(true);
      const list = await DispatchService.list(date);
      if (gen !== shiftLoadGen.current) return;
      setShifts(Array.isArray(list) ? list : []);
    } catch (err) {
      if (gen !== shiftLoadGen.current) return;
      console.error('Error refreshing dispatch shifts:', err);
      setShifts([]);
    } finally {
      if (gen === shiftLoadGen.current) setLoading(false);
    }
  }, [selectedDate]);

  // Quick Driver Check-In toggle
  const handleQuickCheckIn = useCallback(async (shift: DispatchShift, undo: boolean = false) => {
    try {
      const nowTime = getCurrentHHmm();
      // Optimistic update
      setShifts((prev) =>
        prev.map((s) => {
          if (s.id !== shift.id) return s;
          return {
            ...s,
            isDriverCheckedIn: !undo,
            driverCheckedInAt: !undo ? (s.driverCheckedInAt || nowTime) : undefined,
          };
        })
      );
      await DispatchService.checkInDriver(shift.id, !undo ? nowTime : undefined, undo);
      await logDispatchAction({
        date: selectedDate,
        type: 'TCS Check-in/out',
        detail: undo
          ? `TCS Driver Check-in Undone for ${shift.driverName || 'Driver'}`
          : `TCS Driver Checked in TCS ${shift.driverName || 'Driver'} at ${nowTime}`,
        shift,
        user: actorName,
      });
    } catch (err) {
      console.error('Failed to update driver check-in:', err);
      alert('Check-in failed: ' + (err as Error).message);
      handleRefresh();
    }
  }, [actorName, handleRefresh, selectedDate]);

  // Quick Attendant Check-In toggle
  const handleQuickAttendantCheckIn = useCallback(async (shift: DispatchShift, undo: boolean = false) => {
    try {
      const nowTime = getCurrentHHmm();
      // Optimistic update
      setShifts((prev) =>
        prev.map((s) => {
          if (s.id !== shift.id) return s;
          return {
            ...s,
            isAttendantCheckedIn: !undo,
            attendantCheckedInAt: !undo ? (s.attendantCheckedInAt || nowTime) : undefined,
          };
        })
      );
      await DispatchService.checkInAttendant(shift.id, !undo ? nowTime : undefined, undo);
      await logDispatchAction({
        date: selectedDate,
        type: 'TCS Check-in/out',
        detail: undo
          ? `TCS Attendant Check-in Undone for ${shift.attendantName || 'Attendant'}`
          : `TCS Attendant Checked in TCS ${shift.attendantName || 'Attendant'} at ${nowTime}`,
        shift,
        user: actorName,
      });
    } catch (err) {
      console.error('Failed to update attendant check-in:', err);
      alert('Attendant check-in failed: ' + (err as Error).message);
      handleRefresh();
    }
  }, [actorName, handleRefresh, selectedDate]);

  // Check-Out Modal state
  const [checkoutModal, setCheckoutModal] = useState<CrewCheckOutModalState | null>(null);

  // Quick Crew Check-Out toggle / submission
  const handleQuickCheckOut = useCallback(async (
    shift: DispatchShift,
    role: 'driver' | 'attendant',
    undo: boolean = false,
    checkOutTime?: string,
    comments?: string
  ) => {
    try {
      const nowTime = checkOutTime || getCurrentHHmm();
      // Optimistic update
      setShifts((prev) =>
        prev.map((s) => {
          if (s.id !== shift.id) return s;
          if (role === 'driver') {
            return {
              ...s,
              isDriverCheckedOut: !undo,
              driverCheckedOutAt: !undo ? nowTime : undefined,
              driverCheckoutComments: !undo ? (comments || undefined) : undefined,
            };
          } else {
            return {
              ...s,
              isAttendantCheckedOut: !undo,
              attendantCheckedOutAt: !undo ? nowTime : undefined,
              attendantCheckoutComments: !undo ? (comments || undefined) : undefined,
            };
          }
        })
      );
      await DispatchService.checkOutCrew(shift.id, {
        role,
        checkOutTime: !undo ? nowTime : undefined,
        comments: !undo ? comments : undefined,
        undo,
      });
      const crewName = role === 'driver' ? (shift.driverName || 'Driver') : (shift.attendantName || 'Attendant');
      await logDispatchAction({
        date: selectedDate,
        type: 'TCS Check-in/out',
        detail: undo
          ? `TCS ${role === 'driver' ? 'Driver' : 'Attendant'} Check-out Undone for ${crewName}`
          : `TCS ${role === 'driver' ? 'Driver' : 'Attendant'} Checked out for ${crewName} at ${nowTime}${comments ? ` (Comments: ${comments})` : ''}`,
        shift,
        user: actorName,
      });
    } catch (err) {
      console.error('Failed to update crew check-out:', err);
      alert('Check-out failed: ' + (err as Error).message);
      handleRefresh();
    }
  }, [actorName, handleRefresh, selectedDate]);

  const handleOpenCheckOutModal = useCallback((shift: DispatchShift, role: 'driver' | 'attendant') => {
    setCheckoutModal({
      isOpen: true,
      shift,
      role,
      checkOutTime: getCurrentHHmm(),
      comments: '',
    });
  }, []);

  const deferredRouteFilter = useDeferredValue(routeFilter);
  const deferredDriverFilter = useDeferredValue(driverFilter);
  const deferredStopFilter = useDeferredValue(stopFilter);
  const deferredVehicleFilter = useDeferredValue(vehicleFilter);

  const latenessByShiftId = useMemo(() => {
    const map = new Map<string, ShiftLatenessInfo>();
    const safeShifts = Array.isArray(effectiveShifts) ? effectiveShifts : [];
    for (const shift of safeShifts) {
      map.set(shift.id, calculateDynamicShiftLateness(shift, currentTimeStr, isToday));
    }
    return map;
  }, [effectiveShifts, currentTimeStr, isToday]);

  // Real-time dynamic metrics computation (zero Firestore writes)
  const metrics = useMemo(() => {
    let onTrack = 0;
    let attention = 0;
    let missingDriver = 0;
    let missingVehicle = 0;
    let unassignedTotal = 0;
    let checkInOverdue = 0;
    let stopDelayed = 0;
    let alertMessageCount = 0;
    let sentAlertsTotal = 0;

    const safeShifts = Array.isArray(effectiveShifts) ? effectiveShifts : [];
    for (const shift of safeShifts) {
      const info = latenessByShiftId.get(shift.id);
      if (!info) continue;
      if (info.isMissingDriver) missingDriver++;
      if (info.isMissingVehicle) missingVehicle++;
      if (info.isMissingCrewOrVehicle) unassignedTotal++;
      if (info.isCheckInOverdue) checkInOverdue++;
      if (info.hasStopDelay) stopDelayed++;

      const sentList = getSentParentNotifications(shift);
      if (sentList.length > 0) {
        sentAlertsTotal += sentList.length;
      }
      if (isAlertMessageShift(shift, info)) {
        alertMessageCount++;
      }

      if (info.effectiveHealth === 'green') {
        onTrack++;
      } else {
        attention++;
      }
    }
    return {
      total: latenessByShiftId.size,
      onTrack,
      attention,
      missingDriver,
      missingVehicle,
      unassignedTotal,
      checkInOverdue,
      stopDelayed,
      alertMessageCount,
      sentAlertsTotal,
    };
  }, [effectiveShifts, latenessByShiftId]);

  // Automatic Vehicle Delay Alert Message dispatcher (triggers at 1st & 2nd thresholds, default 15m and 45m)
  useEffect(() => {
    if (!isToday) return;
    if (reminderSettings.autoDelayAlertEnabled === false) return;
    const safeShifts = Array.isArray(effectiveShifts) ? effectiveShifts : [];
    if (safeShifts.length === 0) return;

    safeShifts.forEach((shift) => {
      const info = latenessByShiftId.get(shift.id);
      if (!info) return;
      const trigger = evaluateAutoDelayAlertTrigger(shift, info, reminderSettings);
      if (!trigger.shouldSend || !trigger.tier) return;

      const dispatchKey = `${shift.id}:tier${trigger.tier}:${trigger.thresholdMinutes}`;
      if (autoAlertDispatchedKeysRef.current.has(dispatchKey)) return;

      const recipients: Array<{
        studentId: number;
        studentName: string;
        contactName: string;
        phone: string;
        email: string;
      }> = [];
      const seenStudentIds = new Set<number>();
      (shift.stops || []).forEach((stop) => {
        const list = stop.assignedStudents || stop.students || [];
        list.forEach((stu) => {
          if (seenStudentIds.has(stu.studentId)) return;
          seenStudentIds.add(stu.studentId);
          const full = studentsMap[stu.studentId];
          const primary =
            full?.contacts?.find((c) => c.primaryContact) || full?.contacts?.[0];
          const phone =
            primary?.mobilePhone ||
            primary?.homePhone ||
            primary?.workPhone ||
            full?.studentPhone ||
            full?.studentEmergencyPhone ||
            '';
          const email = primary?.email || '';
          if (phone || email) {
            recipients.push({
              studentId: stu.studentId,
              studentName: stu.studentName,
              contactName: primary?.contactName || 'Parent / Guardian',
              phone,
              email,
            });
          }
        });
      });

      // Wait until student contacts are available before locking this auto-alert tier
      if (recipients.length === 0) return;
      autoAlertDispatchedKeysRef.current.add(dispatchKey);

      const autoReasonLabel = `Auto Delay Alert (${trigger.thresholdMinutes}m Threshold)`;
      const autoMessageText = `[Translink Dispatch Auto-Alert] Please be advised that Route ${shift.routeNo} (${shift.shiftType} shift) is currently running approximately ${trigger.actualLateMinutes} minutes behind schedule (>${trigger.thresholdMinutes} min threshold). Thank you for your patience.`;
      const auditStamp = `[Auto Alert ${getCurrentHHmm()}] Sent +${trigger.actualLateMinutes}m (${autoReasonLabel}) via SMS, Email to ${recipients.length} parent(s) (All Stops)`;

      apiRequest<{
        shift: DispatchShift;
      }>(`/api/dispatch/shifts/${shift.id}/notify-parents`, {
        method: 'POST',
        body: JSON.stringify({
          delayMinutes: trigger.actualLateMinutes,
          reasonLabel: autoReasonLabel,
          messageText: autoMessageText,
          channels: ['sms', 'email'],
          scope: 'all',
          notes: shift.notes ? `${shift.notes} | ${auditStamp}` : auditStamp,
          recipients,
        }),
      })
        .then((res: { shift?: DispatchShift }) => {
          if (res?.shift) {
            setShifts((prev) => prev.map((s) => (s.id === shift.id ? res.shift! : s)));
          }
          return logDispatchAction({
            date: shift.dispatchDate || selectedDate,
            type: 'Parent Notification',
            detail: `${autoReasonLabel} (+${trigger.actualLateMinutes}m) automatically sent for Shift ${shift.routeNo}`,
            shift,
            user: 'Auto-Alert System',
          });
        })
        .catch((err: unknown) => {
          console.warn('[AutoDelayAlert] Failed to dispatch auto delay alert:', err);
        });
    });
  }, [isToday, effectiveShifts, latenessByShiftId, reminderSettings, studentsMap, selectedDate]);

  const latenessForHealthFilter = healthFilter === 'ALL' ? null : latenessByShiftId;

  // Filtered shifts. Text queries are deferred so typing stays responsive.
  const filteredShifts = useMemo(() => {
    const safeShifts = Array.isArray(effectiveShifts) ? effectiveShifts : [];
    const routeQuery = deferredRouteFilter.trim().toLowerCase();
    const driverQuery = deferredDriverFilter.trim().toLowerCase();
    const vehicleQuery = deferredVehicleFilter.trim().toLowerCase();
    const stopQuery = deferredStopFilter.trim().toLowerCase();
    const shiftTypeQuery = shiftTypeFilter === 'ALL' ? '' : shiftTypeFilter.toUpperCase();

    return safeShifts.filter((shift) => {
      if (routeQuery) {
        const match =
          shift.routeNo.toLowerCase().includes(routeQuery) ||
          shift.routeName.toLowerCase().includes(routeQuery);
        if (!match) return false;
      }

      if (driverQuery && !(shift.driverName || '').toLowerCase().includes(driverQuery)) return false;

      if (vehicleQuery) {
        const match =
          (shift.unitNumber || '').toLowerCase().includes(vehicleQuery) ||
          (shift.plateNumber || '').toLowerCase().includes(vehicleQuery);
        if (!match) return false;
      }

      if (stopQuery) {
        const hasStop = shift.stops.some(
          (st) =>
            st.stopLocation.toLowerCase().includes(stopQuery) ||
            (st.schoolName || '').toLowerCase().includes(stopQuery)
        );
        if (!hasStop) return false;
      }

      if (shiftTypeQuery && shift.shiftType.toUpperCase() !== shiftTypeQuery) return false;

      if (yardFilter !== 'ALL' && String(shift.yardId) !== yardFilter) return false;

      if (latenessForHealthFilter) {
        const info = latenessForHealthFilter.get(shift.id);
        if (!info) return false;
        if (healthFilter === 'green' && info.effectiveHealth !== 'green') return false;
        if (healthFilter === 'attention' && info.effectiveHealth === 'green') return false;
        if (healthFilter === 'unassigned' && !info.isMissingCrewOrVehicle) return false;
        if (healthFilter === 'checkin_overdue' && !info.isCheckInOverdue) return false;
        if (healthFilter === 'stop_delayed' && !info.hasStopDelay) return false;
        if (healthFilter === 'alert_message' && !isAlertMessageShift(shift, info)) return false;
      }

      return true;
    });
  }, [
    effectiveShifts,
    deferredRouteFilter,
    deferredDriverFilter,
    deferredStopFilter,
    deferredVehicleFilter,
    shiftTypeFilter,
    yardFilter,
    healthFilter,
    latenessForHealthFilter,
  ]);

  // Virtual scrolling containers for high-density dispatch shifts (1,000+ items)
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const sheetContainerRef = useRef<HTMLDivElement>(null);

  const cardVirtualizer = useVirtualizer({
    count: filteredShifts.length,
    getScrollElement: () => cardContainerRef.current,
    estimateSize: () => 148,
    overscan: 6,
  });

  const sheetVirtualizer = useVirtualizer({
    count: filteredShifts.length,
    getScrollElement: () => sheetContainerRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const virtualSheetItems = sheetVirtualizer.getVirtualItems();
  const sheetPaddingTop = virtualSheetItems.length > 0 ? virtualSheetItems[0]?.start || 0 : 0;
  const sheetPaddingBottom = virtualSheetItems.length > 0
    ? sheetVirtualizer.getTotalSize() - (virtualSheetItems[virtualSheetItems.length - 1]?.end || 0)
    : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-12">
      {/* Top Header Row matching screenshot */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-slate-900 dark:text-white">
              Dispatch Workbench
            </h1>
            {isToday && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 shadow-2xs"
                title="Dynamic auto-refreshing ticker every 15s"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <DispatchLiveClock />
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time daily bus shift execution, driver check-in tracking, and dynamic delay detection
          </p>
        </div>

        {/* Right controls: Date Picker, Sheet View, Create Day, Delete Day */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker Group */}
          <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 shadow-xs">
            <button
              onClick={handlePrevDay}
              title="Previous Day"
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-1.5 sm:px-2">
              <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={handleNextDay}
              title="Next Day"
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Today
          </button>

          {/* Workbench / Card / Sheet View Switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('workbench')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'workbench'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Workbench Mode: Issue Queue, Recommended Actions & Shift Detail"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Workbench</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'card'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Card View"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Card view</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'sheet'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Sheet View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sheet view</span>
            </button>
          </div>

          {/* Log Student Absence Button */}
          <button
            onClick={() => setIsAbsenceModalOpen(true)}
            onMouseEnter={() => { void loadRecordStudentAbsenceModal(); }}
            onFocus={() => { void loadRecordStudentAbsenceModal(); }}
            title="Log parent notification of student absence (Today / Tomorrow / Future date)"
            className="px-3 py-1 text-xs font-bold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 shadow-2xs transition flex items-center gap-1.5"
          >
            <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Log Absence</span>
          </button>

          {onNavigateToAbsences && (
            <button
              onClick={onNavigateToAbsences}
              title="View full 2-week rolling student absence schedule"
              className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1"
            >
              <span>View Absences</span>
            </button>
          )}

          {/* Check-in Reminder Settings Button */}
          <button
            onClick={() => setIsReminderSettingsOpen(true)}
            onMouseEnter={() => { void loadCheckInReminderSettingsModal(); }}
            onFocus={() => { void loadCheckInReminderSettingsModal(); }}
            title="Configure crew late check-in FCM reminder timing and grace period"
            className="px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">Reminder Settings</span>
          </button>

          {/* Create Day Button */}
          <button
            onClick={handleCreateDay}
            disabled={generating || !DISPATCH_DATE_RE.test(selectedDate)}
            className="px-3 py-1 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{generating ? 'Generating...' : 'Create Day'}</span>
          </button>

          {/* Delete Day Button */}
          <button
            onClick={handleDeleteDay}
            disabled={deleting || !shifts || shifts.length === 0}
            className="px-2.5 py-1 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-1 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete Day</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh shifts"
            className="p-1.5 sm:p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Change Log Button */}
          {onNavigateToChangeLog && (
            <button
              onClick={() => onNavigateToChangeLog(selectedDate)}
              title="View Dispatch Change Log"
              className="px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5 shadow-2xs"
            >
              <History className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Change Log</span>
            </button>
          )}

          {/* Temporary Assignments Button */}
          {onNavigateToTemporaryAssignments && (
            <button
              onClick={onNavigateToTemporaryAssignments}
              title="View & Manage Route Temporary Assignments"
              className="px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition flex items-center gap-1.5 shadow-2xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Temp Assignments</span>
            </button>
          )}
        </div>
      </div>

      {/* Excluded Vehicles Banner (Vehicle Defect / Periodic Inspection) */}
      {unavailableVehiclesList.length > 0 && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 flex-wrap">
                <span>
                  {isFrench
                    ? `${unavailableVehiclesList.length} véhicule(s) exclu(s) des quarts de répartition le ${selectedDate} (Défectuosité / Inspection périodique)`
                    : `${unavailableVehiclesList.length} Vehicle(s) Excluded from Dispatch Shifts on ${selectedDate} (Vehicle Defect / Periodic Inspection)`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {unavailableVehiclesList.map((uv) => (
                  <span
                    key={`${uv.unitNumber}-${uv.reason}`}
                    title={isFrench ? uv.detailFr : uv.detailEn}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                      uv.reason === 'defect'
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                        : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700'
                    }`}
                  >
                    <Truck className="w-3 h-3" />
                    <span>Unit #{uv.unitNumber}</span>
                    <span className="opacity-80 font-medium">
                      • {isFrench ? uv.badgeTextFr : uv.badgeTextEn}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Metrics Cards Row: responsive grid on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
        {/* Total Shifts Card */}
        <button
          onClick={() => {
            setHealthFilter('ALL');
            setShiftTypeFilter('ALL');
          }}
          className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl border flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 transition-all ${
            healthFilter === 'ALL'
              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="text-center sm:text-left min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">Total Shifts</div>
            <div className="text-sm sm:text-base font-bold text-blue-700 dark:text-blue-400">{metrics.total}</div>
          </div>
        </button>

        {/* On Track Card */}
        <button
          onClick={() => setHealthFilter(healthFilter === 'green' ? 'ALL' : 'green')}
          className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl border flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 transition-all ${
            healthFilter === 'green'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 shadow-sm ring-1 ring-emerald-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="text-center sm:text-left min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">On Track</div>
            <div className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400">{metrics.onTrack}</div>
          </div>
        </button>

        {/* Needs Attention Card */}
        <button
          onClick={() => setHealthFilter(healthFilter === 'attention' ? 'ALL' : 'attention')}
          className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl border flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 transition-all ${
            healthFilter === 'attention'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 shadow-sm ring-1 ring-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="text-center sm:text-left min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">Attention</div>
            <div className="text-sm sm:text-base font-bold text-amber-700 dark:text-amber-400">{metrics.attention}</div>
          </div>
        </button>

        {/* Unassigned Shifts Alert Card */}
        <button
          onClick={() => setHealthFilter(healthFilter === 'unassigned' ? 'ALL' : 'unassigned')}
          className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl border flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 transition-all ${
            healthFilter === 'unassigned'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 shadow-sm ring-1 ring-rose-400'
              : metrics.unassignedTotal > 0
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
            metrics.unassignedTotal > 0
              ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <UserX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="text-center sm:text-left min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Unassigned
            </div>
            <div className={`text-sm sm:text-base font-bold ${
              metrics.unassignedTotal > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
            }`}>
              {metrics.unassignedTotal}
            </div>
          </div>
        </button>

        {/* Check-In Overdue Filter Card */}
        <button
          onClick={() => setHealthFilter(healthFilter === 'checkin_overdue' ? 'ALL' : 'checkin_overdue')}
          className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl border flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 transition-all ${
            healthFilter === 'checkin_overdue'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 shadow-sm ring-1 ring-amber-400'
              : metrics.checkInOverdue > 0
              ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80 hover:bg-amber-50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
          title="Filter shifts where assigned driver or attendant did not check in on time"
        >
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
            metrics.checkInOverdue > 0
              ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${metrics.checkInOverdue > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-center sm:text-left min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Check-In Overdue
            </div>
            <div className={`text-sm sm:text-base font-bold ${
              metrics.checkInOverdue > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
            }`}>
              {metrics.checkInOverdue}
            </div>
          </div>
        </button>

        {/* Stop Delayed Filter Card */}
        <button
          onClick={() => setHealthFilter(healthFilter === 'stop_delayed' ? 'ALL' : 'stop_delayed')}
          className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl border flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 transition-all ${
            healthFilter === 'stop_delayed'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 shadow-sm ring-1 ring-rose-400'
              : metrics.stopDelayed > 0
              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80 hover:bg-rose-50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
          title="Filter shifts with delayed stops or unarrived stops past schedule"
        >
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
            metrics.stopDelayed > 0
              ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <MapPin className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${metrics.stopDelayed > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-center sm:text-left min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Stop Delayed
            </div>
            <div className={`text-sm sm:text-base font-bold ${
              metrics.stopDelayed > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
            }`}>
              {metrics.stopDelayed}
            </div>
          </div>
        </button>

        {/* Alert Message Filter Card */}
        <button
          onClick={() => setHealthFilter(healthFilter === 'alert_message' ? 'ALL' : 'alert_message')}
          className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl border flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 transition-all ${
            healthFilter === 'alert_message'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-sm ring-1 ring-blue-400'
              : metrics.alertMessageCount > 0
              ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/80 hover:bg-blue-50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
          title="Filter shifts with sent or pending parent delay alert messages (auto-sends at 15m / 45m late)"
        >
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
            metrics.alertMessageCount > 0
              ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="text-center sm:text-left min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Alert Message
            </div>
            <div className={`text-sm sm:text-base font-bold ${
              metrics.alertMessageCount > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
            }`}>
              {metrics.alertMessageCount}
            </div>
          </div>
        </button>
      </div>

      {/* Dispatcher Alert Banner for Missing Driver or Vehicle */}
      {metrics.unassignedTotal > 0 && (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-rose-950 dark:text-rose-100">
                  Dispatcher Alert: {metrics.unassignedTotal} Shift(s) Require Crew or Vehicle Assignment
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-100">
                  Action Needed
                </span>
              </div>
              <div className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 flex items-center gap-3 flex-wrap">
                <span>Missing Drivers: <strong>{metrics.missingDriver}</strong></span>
                <span>•</span>
                <span>Missing Vehicles: <strong>{metrics.missingVehicle}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              onClick={() => setHealthFilter(healthFilter === 'unassigned' ? 'ALL' : 'unassigned')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                healthFilter === 'unassigned'
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 hover:bg-rose-100/50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{healthFilter === 'unassigned' ? 'Show All Shifts' : `Filter Unassigned (${metrics.unassignedTotal})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Check-In Overdue Filter Alert Banner */}
      {healthFilter === 'checkin_overdue' && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-amber-950 dark:text-amber-100">
                  Filter Active: Check-In Overdue ({filteredShifts.length} Shift{filteredShifts.length !== 1 ? 's' : ''})
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100">
                  Check-In Alert
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Displaying shifts where assigned driver or attendant has not checked in by their scheduled check-in time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              onClick={() => setHealthFilter('ALL')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-100/60"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Show All Shifts</span>
            </button>
          </div>
        </div>
      )}

      {/* Stop Delayed Filter Alert Banner */}
      {healthFilter === 'stop_delayed' && (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <MapPin className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-rose-950 dark:text-rose-100">
                  Filter Active: Stop Delayed ({filteredShifts.length} Shift{filteredShifts.length !== 1 ? 's' : ''})
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-100">
                  Route Delay
                </span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                Displaying shifts where one or more stops arrived late or have not arrived past their scheduled stop time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              onClick={() => setHealthFilter('ALL')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs bg-white dark:bg-slate-800 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 hover:bg-rose-100/60"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Show All Shifts</span>
            </button>
          </div>
        </div>
      )}

      {/* Alert Message Filter Banner */}
      {healthFilter === 'alert_message' && (
        <div className="rounded-2xl border border-blue-300 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/40 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-blue-950 dark:text-blue-100">
                  Filter Active: Alert Message ({filteredShifts.length} Shift{filteredShifts.length !== 1 ? 's' : ''})
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-200/80 dark:bg-blue-900/60 text-blue-900 dark:text-blue-100">
                  {reminderSettings.autoDelayAlertEnabled !== false
                    ? `Auto-Send ON (+${reminderSettings.autoDelayFirstAlertMinutes || 15}m / +${reminderSettings.autoDelaySecondAlertMinutes || 45}m)`
                    : 'Auto-Send OFF'}
                </span>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Displaying shifts with sent parent delay notifications or active route/check-in delays requiring parent communication.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setIsReminderSettingsOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Time Settings ({reminderSettings.autoDelayFirstAlertMinutes || 15}m / {reminderSettings.autoDelaySecondAlertMinutes || 45}m)</span>
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter('ALL')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs bg-white dark:bg-slate-800 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 hover:bg-blue-100/60"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Show All Shifts</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Filter Toggle Button */}
      <div className="flex md:hidden items-center justify-between">
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-2xs text-slate-700 dark:text-slate-200"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
          <span>Search & Filters</span>
          {(routeFilter || driverFilter || stopFilter || vehicleFilter || shiftTypeFilter !== 'ALL' || yardFilter !== 'ALL' || healthFilter !== 'ALL') && (
            <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
        </button>

        {(routeFilter || driverFilter || stopFilter || vehicleFilter || shiftTypeFilter !== 'ALL' || yardFilter !== 'ALL' || healthFilter !== 'ALL') && (
          <button
            onClick={() => {
              setRouteFilter('');
              setDriverFilter('');
              setStopFilter('');
              setVehicleFilter('');
              setShiftTypeFilter('ALL');
              setYardFilter('ALL');
              setHealthFilter('ALL');
            }}
            className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Filter Row matching desktop screenshot and collapsible on mobile */}
      <div className={`bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm ${showMobileFilters ? 'block space-y-3' : 'hidden md:flex'} md:flex flex-wrap items-center gap-3`}>
        {/* Route Filter */}
        <div className="w-full sm:flex-1 sm:min-w-[140px]">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Route
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter Route..."
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Driver Filter */}
        <div className="w-full sm:flex-1 sm:min-w-[140px]">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Driver
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter Driver..."
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Stop Filter */}
        <div className="w-full sm:flex-1 sm:min-w-[140px]">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Stop
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter Stop..."
              value={stopFilter}
              onChange={(e) => setStopFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Vehicle Filter */}
        <div className="w-full sm:flex-1 sm:min-w-[120px]">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Vehicle
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter Vehicle..."
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Shift Type Pills */}
        <div className="w-full sm:w-auto">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Shift
          </label>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            {(['ALL', 'AM', 'PM', 'Midday'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setShiftTypeFilter(type)}
                className={`flex-1 sm:flex-initial px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  shiftTypeFilter === type
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Yard Filter */}
        {yards.length > 0 && (
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Yard
            </label>
            <select
              value={yardFilter}
              onChange={(e) => setYardFilter(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Yards</option>
              {yards.map((y) => (
                <option key={y.yardId} value={String(y.yardId)}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Filter Status Pills */}
        <div className="w-full flex flex-wrap items-center gap-1.5 pt-2.5 mt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
            Status Filters:
          </span>

          <button
            type="button"
            onClick={() => setHealthFilter('ALL')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
              healthFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All ({metrics.total})
          </button>

          <button
            type="button"
            onClick={() => setHealthFilter(healthFilter === 'green' ? 'ALL' : 'green')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
              healthFilter === 'green'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>On Track ({metrics.onTrack})</span>
          </button>

          <button
            type="button"
            onClick={() => setHealthFilter(healthFilter === 'attention' ? 'ALL' : 'attention')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
              healthFilter === 'attention'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Attention ({metrics.attention})</span>
          </button>

          <button
            type="button"
            onClick={() => setHealthFilter(healthFilter === 'unassigned' ? 'ALL' : 'unassigned')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
              healthFilter === 'unassigned'
                ? 'bg-rose-600 text-white shadow-2xs'
                : metrics.unassignedTotal > 0
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <UserX className="w-3 h-3" />
            <span>Unassigned ({metrics.unassignedTotal})</span>
          </button>

          <button
            type="button"
            onClick={() => setHealthFilter(healthFilter === 'checkin_overdue' ? 'ALL' : 'checkin_overdue')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
              healthFilter === 'checkin_overdue'
                ? 'bg-amber-600 text-white shadow-2xs ring-2 ring-amber-400'
                : metrics.checkInOverdue > 0
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
            }`}
            title="Filter shifts where assigned driver or attendant did not check in on time"
          >
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Check-In Overdue ({metrics.checkInOverdue})</span>
            {metrics.checkInOverdue > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setHealthFilter(healthFilter === 'stop_delayed' ? 'ALL' : 'stop_delayed')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
              healthFilter === 'stop_delayed'
                ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-400'
                : metrics.stopDelayed > 0
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 hover:bg-rose-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
            }`}
            title="Filter shifts with delayed stops or unarrived stops past schedule"
          >
            <MapPin className="w-3 h-3 text-rose-500" />
            <span>Stop Delayed ({metrics.stopDelayed})</span>
            {metrics.stopDelayed > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setHealthFilter(healthFilter === 'alert_message' ? 'ALL' : 'alert_message')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
              healthFilter === 'alert_message'
                ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-400'
                : metrics.alertMessageCount > 0
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
            }`}
            title="Filter shifts with sent or pending parent delay alert messages"
          >
            <Bell className="w-3 h-3 text-blue-500" />
            <span>Alert Message ({metrics.alertMessageCount})</span>
          </button>
        </div>
      </div>

      {/* Main Shift Rows List matching media_1790353122813.png */}
      {loading && (!shifts || shifts.length === 0) ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-medium">Loading dispatch shifts for {selectedDate}...</p>
        </div>
      ) : !effectiveShifts || effectiveShifts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto text-amber-500 mb-2 opacity-80" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Dispatch Shifts Found for {selectedDate}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Click &quot;Create Day&quot; above to automatically compile active routes, evaluate school calendars, and merge marry-up runs into today&apos;s schedule.
          </p>
          <button
            onClick={handleCreateDay}
            disabled={generating || !DISPATCH_DATE_RE.test(selectedDate)}
            className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Dispatch for {selectedDate}</span>
          </button>
        </div>
      ) : viewMode !== 'workbench' && (!filteredShifts || filteredShifts.length === 0) ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
          <Filter className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-80" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Shifts Match the Current Filters
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            There are {effectiveShifts.length} dispatch shifts on {selectedDate}, but none match your active status or search filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setRouteFilter('');
              setDriverFilter('');
              setStopFilter('');
              setVehicleFilter('');
              setShiftTypeFilter('ALL');
              setYardFilter('ALL');
              setHealthFilter('ALL');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow"
          >
            <span>Reset Filters</span>
          </button>
        </div>
      ) : viewMode === 'workbench' ? (
        <DispatchWorkbenchModePanel
          shifts={filteredShifts}
          allDayShifts={effectiveShifts}
          charterTrips={dayCharterTrips}
          latenessByShiftId={latenessByShiftId}
          employees={employees}
          availableVehicles={vehicles}
          unavailableVehiclesMap={unavailableVehiclesMap}
          employeeTimeOffMap={employeeTimeOffMap}
          studentsMap={studentsMap}
          selectedDate={selectedDate}
          currentTimeStr={currentTimeStr}
          isToday={isToday}
          healthFilter={healthFilter}
          onShiftUpdated={(updated) => {
            setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          }}
          onQuickCheckIn={handleQuickCheckIn}
          onQuickAttendantCheckIn={handleQuickAttendantCheckIn}
          onQuickCheckOut={handleQuickCheckOut}
          onOpenCheckOutModal={handleOpenCheckOutModal}
          onOpenMap={handleOpenMap}
          onOpenStops={handleOpenStops}
          onOpenCrew={handleOpenCrew}
          onOpenSplit={handleOpenSplit}
          onOpenPayroll={handleOpenPayroll}
          onOpenHistory={handleOpenHistory}
          onMessageDriver={onMessageDriver}
          onSelectEmployee={onSelectEmployee}
          onSelectVehicle={onSelectVehicle}
          onSelectStudent={onSelectStudent}
          reminderSettings={reminderSettings}
          onOpenReminderSettings={() => setIsReminderSettingsOpen(true)}
        />
      ) : viewMode === 'sheet' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div ref={sheetContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider shadow-xs">
                <tr>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Route</th>
                  <th className="px-3.5 py-2.5">Shift</th>
                  <th className="px-3.5 py-2.5">Driver</th>
                  <th className="px-3.5 py-2.5">Unit</th>
                  <th className="px-3.5 py-2.5">1st Stop</th>
                  <th className="px-3.5 py-2.5">End Stop</th>
                  <th className="px-3.5 py-2.5">Progress</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sheetPaddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${sheetPaddingTop}px`, padding: 0, border: 0 }} colSpan={9} />
                  </tr>
                )}
                {virtualSheetItems.map((virtualRow) => {
                  const shift = filteredShifts[virtualRow.index];
                  if (!shift) return null;
                  const lateness = latenessByShiftId.get(shift.id);
                  if (!lateness) return null;
                  const isYellow = lateness.effectiveHealth === 'yellow';
                  const isRed = lateness.effectiveHealth === 'red';
                  return (
                    <tr
                      key={shift.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                      onPointerEnter={preloadWorkbenchModals}
                    >
                      <td className="px-3.5 py-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          isRed ? 'bg-rose-500 ring-2 ring-rose-300' : isYellow ? 'bg-amber-400 ring-2 ring-amber-200' : 'bg-emerald-500'
                        }`} />
                      </td>
                      <td className="px-3.5 py-2 font-mono font-bold text-slate-800 dark:text-slate-100">{shift.routeNo}</td>
                      <td className="px-3.5 py-2 font-medium text-slate-600 dark:text-slate-300">{shift.shiftType}</td>
                      <td className="px-3.5 py-2 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {lateness.isMissingDriver ? (
                            <button
                              onClick={() => setSelectedShiftForCrew(shift)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 animate-pulse hover:bg-rose-200 transition"
                              title="Missing driver! Click to assign crew"
                            >
                              <UserX className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              <span>Assign Driver</span>
                            </button>
                          ) : (
                            <span
                              className="cursor-pointer hover:underline inline-flex items-center gap-1"
                              onClick={() => {
                                if (onSelectEmployee && (shift.driverId || shift.driverName)) {
                                  onSelectEmployee(shift.driverId, shift.driverName);
                                  return;
                                }
                                setSelectedShiftForCrew(shift);
                              }}
                              title="View driver details"
                            >
                              <span>{shift.driverName}</span>
                              {shift.isTemporaryDriver && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  title="Temporary Replacement Driver"
                                >
                                  Temp
                                </span>
                              )}
                              {shift.driverId && onMessageDriver && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMessageDriver(shift.driverId!);
                                  }}
                                  title={`Chat with ${shift.driverName}`}
                                  className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition ml-0.5"
                                >
                                  <MessageSquare className="w-3 h-3 text-amber-500" />
                                </button>
                              )}
                            </span>
                          )}
                          {lateness.driverLateMinutes > 0 && (
                            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                              (+{lateness.driverLateMinutes}m)
                            </span>
                          )}
                          {shift.driverName && (
                            lateness.isDriverCheckedIn ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleQuickCheckIn(shift, true)}
                                  title={`Checked in at ${shift.driverCheckedInAt || lateness.scheduledCheckInTime}. Click to undo check-in.`}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-rose-50 hover:text-rose-700 transition"
                                >
                                  ✓ In {shift.driverCheckedInAt || lateness.scheduledCheckInTime}
                                </button>
                                {shift.isDriverCheckedOut ? (
                                  <button
                                    onClick={() => handleQuickCheckOut(shift, 'driver', true)}
                                    title={`Checked out at ${shift.driverCheckedOutAt}${shift.driverCheckoutComments ? ` (${shift.driverCheckoutComments})` : ''}. Click to undo.`}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 hover:bg-rose-50 hover:text-rose-700 transition"
                                  >
                                    ✓ Out {shift.driverCheckedOutAt}{shift.driverCheckoutComments && ' 💬'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleOpenCheckOutModal(shift, 'driver')}
                                    title="Check out driver"
                                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-purple-100 hover:text-purple-800 hover:border-purple-300 transition"
                                  >
                                    Out
                                  </button>
                                )}
                              </div>
                            ) : lateness.isDriverOverdue ? (
                              <button
                                onClick={() => handleQuickCheckIn(shift, false)}
                                title={`Check-in scheduled at ${lateness.scheduledCheckInTime}. Click to check in now.`}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 animate-pulse hover:bg-emerald-100 hover:text-emerald-800 transition"
                              >
                                ⚠ In (+{lateness.driverLateMinutes}m)
                              </button>
                            ) : (
                              <button
                                onClick={() => handleQuickCheckIn(shift, false)}
                                title={`Scheduled check-in at ${lateness.scheduledCheckInTime}. Click to check in early.`}
                                className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
                              >
                                In ({lateness.scheduledCheckInTime})
                              </button>
                            )
                          )}
                          {lateness.maxStopLateMinutes > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-mono ml-1">
                              Stop +{lateness.maxStopLateMinutes}m
                            </span>
                          )}
                          {lateness.maxLateMinutes > 0 && (
                            <span className="text-rose-600 dark:text-rose-400 font-bold ml-1">+{lateness.maxLateMinutes}m</span>
                          )}
                          {shift.driverPayOption && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono">
                              {shift.driverPayOption}{shift.driverPayAmount !== undefined && shift.driverPayAmount !== null ? ` $${shift.driverPayAmount}` : ''}
                            </span>
                          )}
                        </div>
                        {shift.attendantName && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                            <span
                              className="cursor-pointer hover:underline inline-flex items-center gap-1"
                              onClick={() => {
                                if (onSelectEmployee && (shift.attendantId || shift.attendantName)) {
                                  onSelectEmployee(shift.attendantId, shift.attendantName);
                                  return;
                                }
                                setSelectedShiftForCrew(shift);
                              }}
                              title="View attendant details"
                            >
                              <span>Attendant: {shift.attendantName}</span>
                              {shift.isTemporaryAttendant && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  title="Temporary Replacement Attendant"
                                >
                                  Temp
                                </span>
                              )}
                              {shift.attendantId && onMessageDriver && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMessageDriver(shift.attendantId!);
                                  }}
                                  title={`Chat with ${shift.attendantName}`}
                                  className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition ml-0.5"
                                >
                                  <MessageSquare className="w-3 h-3 text-amber-500" />
                                </button>
                              )}
                            </span>
                            {lateness.isAttendantCheckedIn ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleQuickAttendantCheckIn(shift, true)}
                                  title={`Attendant checked in at ${shift.attendantCheckedInAt || lateness.scheduledCheckInTime}. Click to undo.`}
                                  className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-rose-50 hover:text-rose-700 transition"
                                >
                                  ✓ In {shift.attendantCheckedInAt || lateness.scheduledCheckInTime}
                                </button>
                                {shift.isAttendantCheckedOut ? (
                                  <button
                                    onClick={() => handleQuickCheckOut(shift, 'attendant', true)}
                                    title={`Attendant checked out at ${shift.attendantCheckedOutAt}${shift.attendantCheckoutComments ? ` (${shift.attendantCheckoutComments})` : ''}. Click to undo.`}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 hover:bg-rose-50 hover:text-rose-700 transition"
                                  >
                                    ✓ Out {shift.attendantCheckedOutAt}{shift.attendantCheckoutComments && ' 💬'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleOpenCheckOutModal(shift, 'attendant')}
                                    title="Check out attendant"
                                    className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-purple-100 hover:text-purple-800 hover:border-purple-300 transition"
                                  >
                                    Out
                                  </button>
                                )}
                              </div>
                            ) : lateness.isAttendantOverdue ? (
                              <button
                                onClick={() => handleQuickAttendantCheckIn(shift, false)}
                                title={`Attendant check-in overdue! Scheduled at ${lateness.scheduledCheckInTime}. Click to check in.`}
                                className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 animate-pulse hover:bg-emerald-100 hover:text-emerald-800 transition"
                              >
                                ⚠ In (+{lateness.attendantLateMinutes}m)
                              </button>
                            ) : (
                              <button
                                onClick={() => handleQuickAttendantCheckIn(shift, false)}
                                title={`Scheduled check-in at ${lateness.scheduledCheckInTime}. Click to check in.`}
                                className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
                              >
                                In ({lateness.scheduledCheckInTime})
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2 font-mono">
                        {lateness.isMissingVehicle ? (
                          <button
                            onClick={() => setSelectedShiftForCrew(shift)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 animate-pulse hover:bg-rose-200 transition"
                            title="Missing vehicle! Click to assign unit"
                          >
                            <Truck className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            <span>Assign Unit</span>
                          </button>
                        ) : (
                          <span
                            className="text-slate-700 dark:text-slate-300 cursor-pointer hover:underline"
                            onClick={() => {
                              if (onSelectVehicle && (shift.vehicleId || shift.unitNumber)) {
                                onSelectVehicle(shift.vehicleId, shift.unitNumber);
                                return;
                              }
                              setSelectedShiftForCrew(shift);
                            }}
                            title={`View vehicle details: ${shift.unitNumber}`}
                          >
                            {shift.unitNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2 font-mono">{shift.firstStopTime || '--:--'}</td>
                      <td className="px-3.5 py-2 font-mono">{shift.lastStopTime || '--:--'}</td>
                      <td className="px-3.5 py-2">
                        <div className="flex flex-col">
                          <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{shift.completedStops}/{shift.totalStops}</span>
                            <span className="text-[10px] text-slate-400 ml-1">stops</span>
                          </div>
                          {(() => {
                            let totalStu = 0;
                            let pickedUpStu = 0;
                            shift.stops?.forEach(st => {
                              const stuList = st.assignedStudents || st.students || [];
                              stuList.forEach((stu) => {
                                totalStu++;
                                if (stu.isPresent || stu.status === 'picked_up' || stu.status === 'dropped_off') pickedUpStu++;
                              });
                            });
                            if (totalStu === 0) return null;
                            return (
                              <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${pickedUpStu > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                <Users className="w-2.5 h-2.5" />
                                {pickedUpStu}/{totalStu} riders
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(() => {
                            const sentNotifs = getSentParentNotifications(shift);
                            if (sentNotifs.length === 0) return null;
                            return (
                              <button
                                onClick={() => setSelectedShiftForHistory(shift)}
                                className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900 transition flex items-center gap-1 shrink-0"
                                title={`View ${sentNotifs.length} dispatched alert(s)`}
                              >
                                <MessageSquare className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                <span>Alerts ({sentNotifs.length})</span>
                              </button>
                            );
                          })()}
                          {isToday && (
                            <button
                              onClick={() => {
                                setSelectedShiftForNotification(shift);
                                setSelectedStopForNotification(null);
                              }}
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900 transition flex items-center gap-1"
                              title="Send delay notification to parents"
                            >
                              <BellRing className="w-3 h-3" />
                              <span>Alert</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedShiftForPayroll(shift)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900 transition flex items-center gap-1"
                            title="Dispatch Payroll Comment"
                          >
                            <DollarSign className="w-3 h-3" />
                            <span>Pay</span>
                          </button>
                          <button
                            onClick={() => setSelectedShiftForSplit(shift)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900 transition flex items-center gap-1"
                            title="Split Shift"
                          >
                            <Split className="w-3 h-3" />
                            <span>Split</span>
                          </button>
                          <button
                            onClick={() => handleOpenMap(shift)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition flex items-center gap-1"
                            title="View Dispatch Shift Map"
                          >
                            <Navigation className="w-3 h-3 text-amber-500" />
                            <span>Map</span>
                          </button>
                          <button
                            onClick={() => handleOpenStops(shift)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900 transition"
                          >
                            View Stops
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sheetPaddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${sheetPaddingBottom}px`, padding: 0, border: 0 }} colSpan={9} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div ref={cardContainerRef} className="overflow-y-auto max-h-[calc(100vh-270px)] pr-1">
          <div
            style={{
              height: `${cardVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {cardVirtualizer.getVirtualItems().map((virtualRow) => {
              const shift = filteredShifts[virtualRow.index];
              if (!shift) return null;
              return (
                <div
                  key={shift.id}
                  data-index={virtualRow.index}
                  ref={cardVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="pb-2" onPointerEnter={preloadWorkbenchModals}>
                    <WorkbenchShiftRow
                      shift={shift}
                      lateness={latenessByShiftId.get(shift.id)!}
                      currentTimeStr={currentTimeStr}
                      isToday={isToday}
                      onQuickCheckIn={handleQuickCheckIn}
                      onQuickAttendantCheckIn={handleQuickAttendantCheckIn}
                      onQuickCheckOut={handleQuickCheckOut}
                      onOpenCheckOutModal={handleOpenCheckOutModal}
                      onOpenNotification={handleOpenNotification}
                      onOpenMap={handleOpenMap}
                      onOpenStops={handleOpenStops}
                      onOpenCrew={handleOpenCrew}
                      onOpenSplit={handleOpenSplit}
                      onOpenPayroll={handleOpenPayroll}
                      onOpenHistory={handleOpenHistory}
                      onSelectEmployee={onSelectEmployee}
                      onSelectVehicle={onSelectVehicle}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedShiftForStops && (
        <Suspense fallback={<ModalLoadingOverlay />}>
          <DispatchStopModal
            isOpen
            onClose={() => {
              setSelectedShiftForStops(null);
              setInitialStopId(null);
            }}
            shift={selectedShiftForStops}
            initialStopId={initialStopId}
            initialTab={initialStopsTab}
            studentsMap={studentsMap}
            onSelectStudent={onSelectStudent}
            isToday={isToday}
            onOpenNotification={(openedShift, stop) => {
              handleOpenNotification(openedShift, stop ? stop.stopId : undefined);
            }}
            onOpenHistory={handleOpenHistory}
            onShiftUpdated={(updated) => {
              setSelectedShiftForStops(updated);
              setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            }}
          />
        </Suspense>
      )}

      {selectedShiftForCrew && (
        <Suspense fallback={<ModalLoadingOverlay />}>
          <DispatchCrewModal
            isOpen
            onClose={() => setSelectedShiftForCrew(null)}
            shift={selectedShiftForCrew}
            employees={employees}
            vehicles={vehicles}
            allDayShifts={effectiveShifts}
            charterTrips={dayCharterTrips}
            unavailableVehiclesMap={unavailableVehiclesMap}
            employeeTimeOffMap={employeeTimeOffMap}
            onShiftUpdated={(updated) => {
              setSelectedShiftForCrew(updated);
              setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            }}
          />
        </Suspense>
      )}

      {selectedShiftForSplit && (
        <Suspense fallback={<ModalLoadingOverlay />}>
          <DispatchSplitModal
            isOpen
            onClose={() => setSelectedShiftForSplit(null)}
            shift={selectedShiftForSplit}
            employees={employees}
            vehicles={vehicles}
            allDayShifts={effectiveShifts}
            charterTrips={dayCharterTrips}
            unavailableVehiclesMap={unavailableVehiclesMap}
            employeeTimeOffMap={employeeTimeOffMap}
            onSplitComplete={(newShifts) => {
              setSelectedShiftForSplit(null);
              setShifts((prev) => {
                const newShiftIds = new Set(newShifts.map((s) => s.id));
                const filtered = prev.filter((s) => !newShiftIds.has(s.id));
                return [...filtered, ...newShifts];
              });
            }}
          />
        </Suspense>
      )}

      {selectedShiftForPayroll && (
        <Suspense fallback={<ModalLoadingOverlay />}>
          <DispatchPayrollModal
            isOpen
            onClose={() => setSelectedShiftForPayroll(null)}
            shift={selectedShiftForPayroll}
            employees={employees}
            onShiftUpdated={(updated) => {
              setSelectedShiftForPayroll(updated);
              setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            }}
          />
        </Suspense>
      )}

      {selectedShiftForNotification && (
        <Suspense fallback={<ModalLoadingOverlay />}>
          <ParentNotificationModal
            isOpen
            onClose={() => {
              setSelectedShiftForNotification(null);
              setSelectedStopForNotification(null);
            }}
            shift={selectedShiftForNotification}
            targetStopId={selectedStopForNotification}
            studentsMap={studentsMap}
            onNotificationSent={(updated) => {
              setSelectedShiftForNotification(updated);
              setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            }}
          />
        </Suspense>
      )}

      {selectedShiftForHistory && (
        <Suspense fallback={<ModalLoadingOverlay />}>
          <ParentNotificationHistoryModal
            isOpen
            onClose={() => setSelectedShiftForHistory(null)}
            shift={selectedShiftForHistory}
            isToday={isToday}
            onOpenSendNewAlert={(openedShift) => {
              setSelectedShiftForHistory(null);
              handleOpenNotification(openedShift);
            }}
          />
        </Suspense>
      )}

      {isAbsenceModalOpen && (
        <Suspense fallback={<ModalLoadingOverlay />}>
          <RecordStudentAbsenceModal
            isOpen
            onClose={() => setIsAbsenceModalOpen(false)}
            shifts={shifts}
            initialDate={selectedDate}
            onAbsenceRecorded={(date) => {
              if (date === selectedDate) {
                handleRefresh();
              }
            }}
          />
        </Suspense>
      )}

      {isReminderSettingsOpen && (
        <Suspense fallback={<ModalLoadingOverlay />}>
          <CheckInReminderSettingsModal
            isOpen
            onClose={() => setIsReminderSettingsOpen(false)}
            onSettingsSaved={(saved) => setReminderSettings(saved)}
          />
        </Suspense>
      )}

      {/* Modal for Crew Check-Out */}
      <CrewCheckOutModal
        data={checkoutModal}
        onClose={() => setCheckoutModal(null)}
        onConfirm={handleQuickCheckOut}
      />
    </div>
  );
};

export const DispatchWorkbenchView = memo(DispatchWorkbenchViewInner);

/* ========================================================================= */
/* Individual Shift Row Component matching media_1790353122813.png           */
/* ========================================================================= */
interface WorkbenchShiftRowProps {
  shift: DispatchShift;
  lateness: ShiftLatenessInfo;
  currentTimeStr: string;
  isToday: boolean;
  onOpenMap: (shift: DispatchShift) => void;
  onOpenStops: (shift: DispatchShift, stopId?: number) => void;
  onOpenCrew: (shift: DispatchShift) => void;
  onOpenSplit: (shift: DispatchShift) => void;
  onOpenPayroll: (shift: DispatchShift) => void;
  onQuickCheckIn: (shift: DispatchShift, undo?: boolean) => void;
  onQuickAttendantCheckIn: (shift: DispatchShift, undo?: boolean) => void;
  onQuickCheckOut: (shift: DispatchShift, role: 'driver' | 'attendant', undo?: boolean) => void;
  onOpenCheckOutModal: (shift: DispatchShift, role: 'driver' | 'attendant') => void;
  onOpenNotification: (shift: DispatchShift, stopId?: number) => void;
  onOpenHistory: (shift: DispatchShift) => void;
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
  onSelectVehicle?: (vehicleId?: number, unitNumber?: string) => void;
}

const StopBubbleChain: React.FC<{
  stops: DispatchShiftStop[];
  currentTimeStr?: string;
  isToday?: boolean;
  onOpenStops: (stopId?: number) => void;
}> = ({ stops, currentTimeStr, isToday, onOpenStops }) => {
  if (stops.length === 0) {
    return <span className="text-xs text-slate-400 italic">No stops</span>;
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {stops.map((st, idx) => {
        const hasHandledStudents = Array.isArray(st.assignedStudents) && st.assignedStudents.length > 0 && st.assignedStudents.some((s) => s.status === 'picked_up' || s.isPresent === true || ((s.status === 'absent' || s.status === 'no_show') && s.absenceReportedBy === 'driver'));
        const isArrived = !!(st.actualArrivalTime || st.stopArrivalTime) || hasHandledStudents;
        const nextStop = stops[idx + 1];
        const isNextArrived = nextStop ? (!!(nextStop.actualArrivalTime || nextStop.stopArrivalTime) || (Array.isArray(nextStop.assignedStudents) && nextStop.assignedStudents.length > 0 && nextStop.assignedStudents.some((s) => s.status === 'picked_up' || s.isPresent === true || ((s.status === 'absent' || s.status === 'no_show') && s.absenceReportedBy === 'driver')))) : false;
        const isStopOverdue = !isArrived && !!isToday && !!currentTimeStr && !!st.stopScheduleTime && (currentTimeStr > st.stopScheduleTime);

        return (
          <React.Fragment key={st.stopId}>
            {/* Circle Bubble */}
            <button
              onClick={() => onOpenStops(st.stopId)}
              title={`Stop #${st.sequence}: ${st.stopLocation} (${st.stopScheduleTime}) ${
                isArrived
                  ? `• Arrived at ${st.actualArrivalTime || st.stopArrivalTime}`
                  : isStopOverdue
                  ? '• Overdue'
                  : '• Pending'
              }`}
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-125 focus:outline-none ${
                isArrived
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : isStopOverdue
                  ? 'bg-amber-100 dark:bg-amber-950/70 border border-rose-500 text-rose-600 dark:text-rose-400 font-bold'
                  : 'bg-white dark:bg-slate-700 border border-slate-400 dark:border-slate-500 text-slate-600 dark:text-slate-300'
              }`}
            >
              {isArrived ? (
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              ) : (
                <span className="text-[8px] font-bold">{st.sequence}</span>
              )}
            </button>

            {/* Connector line between circles */}
            {idx < stops.length - 1 && (
              <div
                className={`w-2 h-0.5 ${
                  isArrived && isNextArrived
                    ? 'bg-emerald-600'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const WorkbenchShiftRow = memo(function WorkbenchShiftRow({
  shift,
  lateness,
  currentTimeStr,
  isToday,
  onOpenMap,
  onOpenStops,
  onOpenCrew,
  onOpenSplit,
  onOpenPayroll,
  onQuickCheckIn,
  onQuickAttendantCheckIn,
  onQuickCheckOut,
  onOpenCheckOutModal,
  onOpenNotification,
  onOpenHistory,
  onSelectEmployee,
  onSelectVehicle,
}: WorkbenchShiftRowProps) {
  const openStop = useCallback((stopId?: number) => {
    onOpenStops(shift, stopId);
  }, [onOpenStops, shift]);
  const openDriverDetails = useCallback(() => {
    if (onSelectEmployee && (shift.driverId || shift.driverName)) {
      onSelectEmployee(shift.driverId, shift.driverName);
      return;
    }
    onOpenCrew(shift);
  }, [onOpenCrew, onSelectEmployee, shift]);
  const openAttendantDetails = useCallback(() => {
    if (onSelectEmployee && (shift.attendantId || shift.attendantName)) {
      onSelectEmployee(shift.attendantId, shift.attendantName);
      return;
    }
    onOpenCrew(shift);
  }, [onOpenCrew, onSelectEmployee, shift]);
  const openVehicleDetails = useCallback(() => {
    if (onSelectVehicle && (shift.vehicleId || shift.unitNumber)) {
      onSelectVehicle(shift.vehicleId, shift.unitNumber);
      return;
    }
    onOpenCrew(shift);
  }, [onOpenCrew, onSelectVehicle, shift]);
  const isYellow = lateness.effectiveHealth === 'yellow';
  const isRed = lateness.effectiveHealth === 'red';
  const sentParentNotifications = getSentParentNotifications(shift);

  const stops = Array.isArray(shift.stops) ? shift.stops : [];
  const firstStop = stops.length > 0 ? stops[0] : null;
  const lastStop = stops.length > 0 ? stops[stops.length - 1] : null;

  const { totalStudents, pickedUpStudents } = useMemo(() => {
    let total = 0;
    let pickedUp = 0;
    stops.forEach((st) => {
      const stuList = st.assignedStudents || st.students || [];
      stuList.forEach((stu) => {
        total++;
        if (stu.isPresent || stu.status === 'picked_up' || stu.status === 'dropped_off') {
          pickedUp++;
        }
      });
    });
    return { totalStudents: total, pickedUpStudents: pickedUp };
  }, [stops]);

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* Desktop View (md and up): original tabular row layout         */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden md:flex items-center gap-2 group">
        {/* Left Route Cell: rounded card matching screenshot */}
        <div className="w-28 shrink-0 bg-[#fdfbf7] dark:bg-slate-800/80 border border-[#eddccb] dark:border-slate-700 rounded-xl px-2.5 py-2.5 shadow-2xs flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isRed
                ? 'bg-rose-500 ring-2 ring-rose-300'
                : isYellow
                ? 'bg-amber-400 ring-2 ring-amber-200'
                : 'bg-emerald-500'
            }`}
          />
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate font-mono">
              {shift.routeNo}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold tracking-wide">
              {shift.shiftType}
            </div>
          </div>
        </div>

        {/* Main Row Card matching screenshot */}
        <div className={`flex-1 rounded-xl px-4 py-2 shadow-2xs flex items-center justify-between gap-4 transition ${
          lateness.isMissingCrewOrVehicle
            ? 'bg-rose-50/30 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800 hover:border-rose-400'
            : 'bg-[#fbf7f2] dark:bg-slate-800/60 border border-[#eddccb] dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-slate-600'
        }`}>
          {/* Section 1: Driver & Check-In */}
          <div className="flex items-center gap-2.5 min-w-[220px] max-w-[320px]">
            <div
              onClick={() => onOpenCrew(shift)}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer transition ${
                lateness.isMissingDriver
                  ? 'bg-rose-100 dark:bg-rose-950/80 border border-rose-400 text-rose-700 dark:text-rose-300 ring-2 ring-rose-200 dark:ring-rose-900 animate-pulse'
                  : 'bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:opacity-80'
              }`}
              title={lateness.isMissingDriver ? 'Missing driver! Click to assign crew' : 'Click to assign driver or vehicle'}
            >
              {lateness.isMissingDriver ? <UserX className="w-3.5 h-3.5" /> : 'D'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {lateness.isMissingDriver ? (
                  <button
                    onClick={() => onOpenCrew(shift)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 hover:bg-rose-200 transition animate-pulse"
                    title="Missing driver! Click to assign crew"
                  >
                    <UserX className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    <span>Assign Driver</span>
                  </button>
                ) : (
                  <span
                    onClick={openDriverDetails}
                    className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer hover:underline inline-flex items-center gap-1"
                    title="View driver details"
                  >
                    <span>{shift.driverName}</span>
                    {shift.isTemporaryDriver && (
                      <span
                        className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        title="Temporary Replacement Driver"
                      >
                        Temp
                      </span>
                    )}
                  </span>
                )}

                {/* Explicit Driver Late Notice */}
                {lateness.driverLateMinutes > 0 && (
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                    (+{lateness.driverLateMinutes}m)
                  </span>
                )}

                {/* Driver Check-In Badge / Quick Action */}
                {shift.driverName && (
                  lateness.isDriverCheckedIn ? (
                    <div className="inline-flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickCheckIn(shift, true);
                        }}
                        title={`Checked in at ${shift.driverCheckedInAt || lateness.scheduledCheckInTime}. Click to undo check-in.`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-rose-50 hover:text-rose-700 transition shrink-0"
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>In {shift.driverCheckedInAt || lateness.scheduledCheckInTime}</span>
                      </button>
                      {shift.isDriverCheckedOut ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickCheckOut?.(shift, 'driver', true);
                          }}
                          title={`Checked out at ${shift.driverCheckedOutAt}${shift.driverCheckoutComments ? ` (${shift.driverCheckoutComments})` : ''}. Click to undo.`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 hover:bg-rose-50 hover:text-rose-700 transition shrink-0"
                        >
                          <LogOut className="w-2.5 h-2.5" />
                          <span>Out {shift.driverCheckedOutAt}{shift.driverCheckoutComments && ' 💬'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCheckOutModal?.(shift, 'driver');
                          }}
                          title="Check out driver"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-purple-100 hover:text-purple-800 hover:border-purple-300 transition shrink-0"
                        >
                          <LogOut className="w-2.5 h-2.5" />
                          <span>Out</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickCheckIn(shift, false);
                      }}
                      title={`Scheduled check-in at ${lateness.scheduledCheckInTime}. Click to check in now.`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition shrink-0 ${
                        lateness.isDriverOverdue
                          ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 animate-pulse hover:bg-emerald-100 hover:text-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>{lateness.isDriverOverdue ? 'Overdue - Check In' : `Check In (${lateness.scheduledCheckInTime})`}</span>
                    </button>
                  )
                )}

                {shift.driverPayOption && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono">
                    {shift.driverPayOption}{shift.driverPayAmount !== undefined && shift.driverPayAmount !== null ? ` $${shift.driverPayAmount}` : ''}
                  </span>
                )}
              </div>
              {shift.attendantName && (
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      openAttendantDetails();
                    }}
                    className="cursor-pointer hover:underline inline-flex items-center gap-1"
                    title="View attendant details"
                  >
                    <span>Attendant: {shift.attendantName}</span>
                    {shift.isTemporaryAttendant && (
                      <span
                        className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        title="Temporary Replacement Attendant"
                      >
                        Temp
                      </span>
                    )}
                  </span>
                  {lateness.isAttendantCheckedIn ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAttendantCheckIn?.(shift, true);
                        }}
                        title={`Attendant checked in at ${shift.attendantCheckedInAt || lateness.scheduledCheckInTime}. Click to undo.`}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-rose-50 hover:text-rose-700 transition"
                      >
                        <Check className="w-2 h-2 stroke-[3]" />
                        <span>In {shift.attendantCheckedInAt || lateness.scheduledCheckInTime}</span>
                      </button>
                      {shift.isAttendantCheckedOut ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickCheckOut?.(shift, 'attendant', true);
                          }}
                          title={`Attendant checked out at ${shift.attendantCheckedOutAt}${shift.attendantCheckoutComments ? ` (${shift.attendantCheckoutComments})` : ''}. Click to undo.`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 hover:bg-rose-50 hover:text-rose-700 transition"
                        >
                          <LogOut className="w-2 h-2" />
                          <span>Out {shift.attendantCheckedOutAt}{shift.attendantCheckoutComments && ' 💬'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCheckOutModal?.(shift, 'attendant');
                          }}
                          title="Check out attendant"
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-purple-100 hover:text-purple-800 hover:border-purple-300 transition"
                        >
                          <LogOut className="w-2 h-2" />
                          <span>Out</span>
                        </button>
                      )}
                    </div>
                  ) : lateness.isAttendantOverdue ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAttendantCheckIn?.(shift, false);
                      }}
                      title={`Attendant check-in overdue! Scheduled at ${lateness.scheduledCheckInTime}. Click to check in.`}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 animate-pulse hover:bg-emerald-100 hover:text-emerald-800 transition"
                    >
                      <Clock className="w-2 h-2" />
                      <span>Overdue (+{lateness.attendantLateMinutes}m)</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAttendantCheckIn?.(shift, false);
                      }}
                      title={`Scheduled check-in at ${lateness.scheduledCheckInTime}. Click to check in.`}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
                    >
                      <span>Check In ({lateness.scheduledCheckInTime})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />

          {/* Section 2: Stop Progress Timeline */}
          <div className="flex-1 flex items-center justify-center gap-3 px-2">
            {/* First Stop Time Label */}
            <div className="flex items-center gap-1.5 shrink-0 text-right">
              <span className="text-[10px] font-bold text-slate-400">1st</span>
              <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-100">
                {shift.firstStopTime || '--:--'}
              </span>
              {(firstStop?.actualArrivalTime || firstStop?.stopArrivalTime) && (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                  {firstStop.actualArrivalTime || firstStop.stopArrivalTime}
                </span>
              )}
            </div>

            {/* Interactive Stop Bubble Chain */}
            <StopBubbleChain stops={stops} currentTimeStr={currentTimeStr} isToday={isToday} onOpenStops={openStop} />

            {/* Rider Boarding Badge */}
            {totalStudents > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openStop();
                }}
                title={`Passenger Boarding: ${pickedUpStudents}/${totalStudents} picked up. Click to view manifest.`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition shrink-0 cursor-pointer ${
                  pickedUpStudents > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Riders {pickedUpStudents}/{totalStudents}</span>
              </button>
            )}

            {/* End Stop Time Label & Delay Alert Actions */}
            <div className="flex items-center gap-2 shrink-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400">End</span>
                <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-100">
                  {shift.lastStopTime || '--:--'}
                </span>
                {(lastStop?.actualArrivalTime || lastStop?.stopArrivalTime) && (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                    {lastStop.actualArrivalTime || lastStop.stopArrivalTime}
                  </span>
                )}
              </div>

              {/* Dynamic Stop Delay Badge */}
              {lateness.maxStopLateMinutes > 0 && (
                <span
                  className="px-2 py-0.5 rounded-md text-xs font-bold border flex items-center gap-1 text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 shadow-2xs"
                  title={`Stop delay: ${lateness.maxStopLateMinutes}m past schedule`}
                >
                  <MapPin className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  <span>Stop +{lateness.maxStopLateMinutes}m</span>
                </span>
              )}

              {/* Dynamic Max Late Badge */}
              {lateness.maxLateMinutes > 0 && (
                <span
                  className="px-2 py-0.5 rounded-md text-xs font-bold border flex items-center gap-1 text-rose-700 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700 shadow-2xs animate-pulse"
                  title={`Max Delay: ${lateness.maxLateMinutes}m (Driver late: ${lateness.driverLateMinutes}m, Max Stop late: ${lateness.maxStopLateMinutes}m)`}
                >
                  <Clock className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  <span>+{lateness.maxLateMinutes}m</span>
                </span>
              )}

              {/* Parent Delay Notification Button for Today's Shifts */}
              {isToday && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNotification(shift);
                  }}
                  title="Notify parents of delay (vehicle breakdown, traffic delay)"
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-900 dark:text-amber-100 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900 transition flex items-center gap-1.5 shrink-0 shadow-2xs"
                >
                  <BellRing className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden xl:inline">Alert Parents</span>
                </button>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />

          {/* Section 3: Vehicle Unit Badge */}
          {lateness.isMissingVehicle ? (
            <button
              onClick={() => onOpenCrew(shift)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-800 dark:text-rose-200 shrink-0 cursor-pointer hover:bg-rose-200 transition animate-pulse shadow-2xs"
              title="Missing vehicle! Click to assign unit"
            >
              <Truck className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Assign Unit</span>
            </button>
          ) : (
            <div
              onClick={openVehicleDetails}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0 cursor-pointer hover:border-amber-400 transition"
              title={`View vehicle details: ${shift.unitNumber}`}
            >
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <span>{shift.unitNumber}</span>
            </div>
          )}

          {/* Dispatched Parent Alerts Button (Always visible whenever sent, regardless of isToday) */}
          {sentParentNotifications.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenHistory(shift);
              }}
              title={`View ${sentParentNotifications.length} dispatched alert(s) sent to parents`}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition shrink-0 flex items-center gap-1.5 shadow-2xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden xl:inline text-[11px]">Sent Alerts</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100">
                {sentParentNotifications.length}
              </span>
            </button>
          )}

          {/* Dispatch Payroll Comment Button */}
          <button
            onClick={() => onOpenPayroll(shift)}
            title="Dispatch Payroll Comment"
            className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition shrink-0 flex items-center gap-1"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden lg:inline text-[11px]">Pay</span>
          </button>

          {/* Split Shift Button */}
          <button
            onClick={() => onOpenSplit(shift)}
            title="Split shift into 2 or more routes"
            className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-700 hover:border-amber-300 transition shrink-0 flex items-center gap-1"
          >
            <Split className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden lg:inline text-[11px]">Split</span>
          </button>

          {/* Dispatch Shift Map Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenMap(shift);
            }}
            title="View Live Google Map"
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Navigation className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden lg:inline text-[11px] font-bold">Map</span>
          </button>

          {/* Action Menu Button */}
          <button
            onClick={() => openStop()}
            title="Open Itinerary & Actions"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition shrink-0"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Mobile View (phones below md): compact stacked card layout   */}
      {/* ------------------------------------------------------------- */}
      <div className={`block md:hidden rounded-2xl p-3.5 shadow-2xs space-y-2.5 transition ${
        lateness.isMissingCrewOrVehicle
          ? 'bg-rose-50/40 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800'
          : 'bg-[#fbf7f2] dark:bg-slate-800/70 border border-[#eddccb] dark:border-slate-700/80 hover:border-amber-400'
      }`}>
        {/* Unassigned Warning Banner on Mobile */}
        {lateness.isMissingCrewOrVehicle && (
          <div
            onClick={() => onOpenCrew(shift)}
            className="bg-rose-100/90 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer animate-pulse"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                {lateness.isMissingDriver && lateness.isMissingVehicle
                  ? 'Driver & Vehicle Required'
                  : lateness.isMissingDriver
                  ? 'Driver Required'
                  : 'Vehicle Required'}
              </span>
            </div>
            <span className="text-[11px] font-semibold underline text-rose-700 dark:text-rose-300 shrink-0">
              Assign Now
            </span>
          </div>
        )}

        {/* Card Header: Route, Shift Type, Health, Vehicle, Menu */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isRed
                  ? 'bg-rose-500 ring-2 ring-rose-300'
                  : isYellow
                  ? 'bg-amber-400 ring-2 ring-amber-200'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
              {shift.routeNo}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {shift.shiftType}
            </span>
            {shift.yardName && (
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                {shift.yardName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onOpenPayroll(shift)}
              title="Dispatch Payroll Comment"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition"
            >
              <DollarSign className="w-3 h-3" />
              <span>Pay</span>
            </button>
            <button
              onClick={() => onOpenSplit(shift)}
              title="Split Shift"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 transition"
            >
              <Split className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              onClick={() => onOpenMap(shift)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-xs font-semibold text-amber-800 dark:text-amber-300 transition"
              title="View Shift Map"
            >
              <Navigation className="w-3 h-3 text-amber-500" />
              <span>Map</span>
            </button>
            {lateness.isMissingVehicle ? (
              <button
                onClick={() => onOpenCrew(shift)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-800 dark:text-rose-200 animate-pulse"
                title="Missing vehicle! Click to assign"
              >
                <Truck className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Unit</span>
              </button>
            ) : (
              <div
                onClick={openVehicleDetails}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                title={`View vehicle details: ${shift.unitNumber}`}
              >
                <Truck className="w-3 h-3 text-slate-400" />
                <span>{shift.unitNumber}</span>
              </div>
            )}
            <button
              onClick={() => openStop()}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Driver Row & Mobile Check-In */}
        <div className="bg-white/70 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
          <div className="flex items-center gap-2">
            <div
              onClick={() => onOpenCrew(shift)}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 cursor-pointer transition ${
                lateness.isMissingDriver
                  ? 'bg-rose-100 dark:bg-rose-950/80 border border-rose-400 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200'
                  : 'bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
              }`}
              title="Assign driver or vehicle"
            >
              {lateness.isMissingDriver ? <UserX className="w-3 h-3" /> : 'D'}
            </div>
            {lateness.isMissingDriver ? (
              <button
                onClick={() => onOpenCrew(shift)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 animate-pulse hover:bg-rose-200 transition"
                title="Missing driver! Click to assign"
              >
                <UserX className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Assign Driver</span>
              </button>
            ) : (
              <span
                onClick={openDriverDetails}
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:underline"
                title="View driver details"
              >
                {shift.driverName}
              </span>
            )}
            {lateness.driverLateMinutes > 0 && (
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                (+{lateness.driverLateMinutes}m)
              </span>
            )}
            {shift.driverPayOption && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono">
                {shift.driverPayOption}{shift.driverPayAmount !== undefined && shift.driverPayAmount !== null ? ` $${shift.driverPayAmount}` : ''}
              </span>
            )}
            {lateness.maxLateMinutes > 0 && (
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-800 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                +{lateness.maxLateMinutes}m
              </span>
            )}
          </div>

          {/* Quick Check-In / Check-Out on Mobile */}
          {shift.driverName && (
            <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Driver Check-In</span>
                {lateness.isDriverCheckedIn ? (
                  <button
                    onClick={() => onQuickCheckIn(shift, true)}
                    title="Checked in. Click to undo."
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1"
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    <span>In {shift.driverCheckedInAt || lateness.scheduledCheckInTime}</span>
                  </button>
                ) : lateness.isDriverOverdue ? (
                  <button
                    onClick={() => onQuickCheckIn(shift, false)}
                    title="Overdue check-in. Click to check in."
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 animate-pulse flex items-center gap-1"
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>Check In (+{lateness.driverLateMinutes}m)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onQuickCheckIn(shift, false)}
                    title="Click to check in early."
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200"
                  >
                    Check In ({lateness.scheduledCheckInTime})
                  </button>
                )}
              </div>

              {lateness.isDriverCheckedIn && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-purple-700 dark:text-purple-400 font-medium">Driver Check-Out</span>
                  {shift.isDriverCheckedOut ? (
                    <button
                      onClick={() => onQuickCheckOut?.(shift, 'driver', true)}
                      title={`Checked out at ${shift.driverCheckedOutAt}${shift.driverCheckoutComments ? ` (${shift.driverCheckoutComments})` : ''}. Click to undo.`}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1"
                    >
                      <LogOut className="w-2.5 h-2.5" />
                      <span>Out {shift.driverCheckedOutAt}{shift.driverCheckoutComments && ' 💬'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenCheckOutModal?.(shift, 'driver')}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 flex items-center gap-1"
                    >
                      <LogOut className="w-2.5 h-2.5" />
                      <span>Check Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attendant Row & Mobile Check-In */}
        {shift.attendantName && (
          <div className="bg-white/70 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center gap-2">
              <div
                onClick={() => onOpenCrew(shift)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 cursor-pointer bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
              >
                A
              </div>
              <span
                onClick={openAttendantDetails}
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:underline"
                title="View attendant details"
              >
                Attendant: {shift.attendantName}
              </span>
              {lateness.attendantLateMinutes > 0 && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                  (+{lateness.attendantLateMinutes}m)
                </span>
              )}
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Attendant Check-In</span>
                {lateness.isAttendantCheckedIn ? (
                  <button
                    onClick={() => onQuickAttendantCheckIn?.(shift, true)}
                    title="Checked in. Click to undo."
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1"
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    <span>In {shift.attendantCheckedInAt || lateness.scheduledCheckInTime}</span>
                  </button>
                ) : lateness.isAttendantOverdue ? (
                  <button
                    onClick={() => onQuickAttendantCheckIn?.(shift, false)}
                    title="Overdue check-in. Click to check in."
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 animate-pulse flex items-center gap-1"
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>Check In (+{lateness.attendantLateMinutes}m)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onQuickAttendantCheckIn?.(shift, false)}
                    title="Click to check in early."
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200"
                  >
                    Check In ({lateness.scheduledCheckInTime})
                  </button>
                )}
              </div>

              {lateness.isAttendantCheckedIn && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-purple-700 dark:text-purple-400 font-medium">Attendant Check-Out</span>
                  {shift.isAttendantCheckedOut ? (
                    <button
                      onClick={() => onQuickCheckOut?.(shift, 'attendant', true)}
                      title={`Attendant checked out at ${shift.attendantCheckedOutAt}${shift.attendantCheckoutComments ? ` (${shift.attendantCheckoutComments})` : ''}. Click to undo.`}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1"
                    >
                      <LogOut className="w-2.5 h-2.5" />
                      <span>Out {shift.attendantCheckedOutAt}{shift.attendantCheckoutComments && ' 💬'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenCheckOutModal?.(shift, 'attendant')}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 flex items-center gap-1"
                    >
                      <LogOut className="w-2.5 h-2.5" />
                      <span>Check Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Times & Stop Bubbles */}
        <div className="bg-white/80 dark:bg-slate-900/50 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 font-mono">
              <span className="text-[10px] font-bold text-slate-400">1st:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{shift.firstStopTime || '--:--'}</span>
              {(firstStop?.actualArrivalTime || firstStop?.stopArrivalTime) && (
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
                  {firstStop.actualArrivalTime || firstStop.stopArrivalTime}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {lateness.maxStopLateMinutes > 0 && (
                <span className="text-[9px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-800 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  Stop +{lateness.maxStopLateMinutes}m
                </span>
              )}
              <div className="flex items-center gap-1 font-mono">
                <span className="text-[10px] font-bold text-slate-400">End:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{shift.lastStopTime || '--:--'}</span>
                {(lastStop?.actualArrivalTime || lastStop?.stopArrivalTime) && (
                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
                    {lastStop.actualArrivalTime || lastStop.stopArrivalTime}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bubble chain & Rider status */}
          <div className="pt-0.5 flex items-center justify-between gap-2">
            <StopBubbleChain stops={stops} currentTimeStr={currentTimeStr} isToday={isToday} onOpenStops={openStop} />
            {totalStudents > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openStop();
                }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 cursor-pointer ${
                  pickedUpStudents > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
                title={`Passenger Boarding: ${pickedUpStudents}/${totalStudents} picked up`}
              >
                <Users className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                <span>{pickedUpStudents}/{totalStudents}</span>
              </button>
            )}
          </div>

          {/* Dispatched Alerts History on Mobile (visible whenever sent, regardless of isToday) */}
          {sentParentNotifications.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenHistory(shift);
              }}
              className="w-full mt-2 py-1.5 rounded-xl text-xs font-semibold text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-700 flex items-center justify-center gap-1.5 transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>View Sent Alerts ({sentParentNotifications.length})</span>
            </button>
          )}

          {/* Alert Parents on Mobile */}
          {isToday && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenNotification(shift);
              }}
              className="w-full mt-2 py-1.5 rounded-xl text-xs font-semibold text-amber-900 dark:text-amber-100 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 flex items-center justify-center gap-1.5 transition"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Alert Parents of Delay</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
});
