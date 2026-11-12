import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Truck,
  Save,
  DollarSign,
  HeartHandshake,
  Clock,
  Zap,
  Home,
  Navigation,
  Shield,
  Wrench,
  CalendarOff
} from 'lucide-react';
import { DispatchShift, DispatchPayrollSettings } from '../../types/dispatch';
import { CharterTrip } from '../../types/charter';
import { DispatchService } from '../../services/dispatchService';
import { getScheduledCheckInTime, getCurrentHHmm } from '../../utils/dispatchDelayUtils';
import { Employee } from '../../types/employee';
import { Vehicle } from '../../types/vehicle';
import {
  UnavailableVehicleInfo,
  EmployeeTimeOffInfo,
  getVehicleUnavailabilityReason,
  getEmployeeTimeOffReason
} from '../../utils/vehicleAvailabilityUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { logDispatchAction } from '../../utils/dispatchLogger';
import {
  sortDriversByDeadhead,
  sortAttendantsByDeadhead,
  calculateDriverDeadhead,
  calculateAttendantDeadhead
} from '../../utils/deadheadCalculator';
import {
  classifyEmployeeForRole,
  compareCrewPriority,
  groupCrewCandidates,
  getOptGroupLabels,
} from '../../utils/crewEligibilityUtils';
import {
  buildEmployeeTaskIndex,
  formatEmployeeTaskShortLabel,
  formatEmployeeTasksOptionSuffix,
  getEmployeeDayTasks,
} from '../../utils/employeeTaskUtils';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';

const EMPTY_SHIFTS: DispatchShift[] = [];
const EMPTY_CHARTER_TRIPS: CharterTrip[] = [];

interface DispatchCrewModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: DispatchShift | null;
  employees: Employee[];
  vehicles: Vehicle[];
  allDayShifts?: DispatchShift[];
  charterTrips?: CharterTrip[];
  unavailableVehiclesMap?: Map<string, UnavailableVehicleInfo>;
  employeeTimeOffMap?: Map<string, EmployeeTimeOffInfo>;
  onShiftUpdated: (updatedShift: DispatchShift) => void;
}

export const DispatchCrewModal: React.FC<DispatchCrewModalProps> = (props) => {
  if (!props.isOpen || !props.shift) return null;
  return <DispatchCrewModalContent {...props} shift={props.shift} />;
};

const DispatchCrewModalContent: React.FC<DispatchCrewModalProps & { shift: DispatchShift }> = ({
  onClose,
  shift,
  employees,
  vehicles,
  allDayShifts = EMPTY_SHIFTS,
  charterTrips = EMPTY_CHARTER_TRIPS,
  unavailableVehiclesMap,
  employeeTimeOffMap,
  onShiftUpdated,
}) => {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  const [driverId, setDriverId] = useState(shift.driverId || '');
  const [attendantId, setAttendantId] = useState(shift.attendantId || '');
  const [vehicleId, setVehicleId] = useState(shift.vehicleId ? String(shift.vehicleId) : '');
  const [isDryRun, setIsDryRun] = useState(!!shift.isDryRun);
  const [notes, setNotes] = useState(shift.notes || '');

  // Driver Check-in fields
  const [scheduledCheckInTime, setScheduledCheckInTime] = useState(
    shift.scheduledCheckInTime || getScheduledCheckInTime(shift)
  );
  const [isDriverCheckedIn, setIsDriverCheckedIn] = useState(!!shift.isDriverCheckedIn);
  const [driverCheckedInAt, setDriverCheckedInAt] = useState(shift.driverCheckedInAt || '');
  const [isAttendantCheckedIn, setIsAttendantCheckedIn] = useState(!!shift.isAttendantCheckedIn);
  const [attendantCheckedInAt, setAttendantCheckedInAt] = useState(shift.attendantCheckedInAt || '');

  // Crew Check-out fields
  const [isDriverCheckedOut, setIsDriverCheckedOut] = useState(!!shift.isDriverCheckedOut);
  const [driverCheckedOutAt, setDriverCheckedOutAt] = useState(shift.driverCheckedOutAt || '');
  const [driverCheckoutComments, setDriverCheckoutComments] = useState(shift.driverCheckoutComments || '');
  const [isAttendantCheckedOut, setIsAttendantCheckedOut] = useState(!!shift.isAttendantCheckedOut);
  const [attendantCheckedOutAt, setAttendantCheckedOutAt] = useState(shift.attendantCheckedOutAt || '');
  const [attendantCheckoutComments, setAttendantCheckoutComments] = useState(shift.attendantCheckoutComments || '');

  // Dispatch Payroll Comment fields
  const [driverPayOption, setDriverPayOption] = useState(shift.driverPayOption || '');
  const [attendantPayOption, setAttendantPayOption] = useState(shift.attendantPayOption || '');
  const [nursePayOption, setNursePayOption] = useState(shift.nursePayOption || '');
  const [nurseName, setNurseName] = useState(shift.nurseName || '');
  const [payrollComments, setPayrollComments] = useState(shift.payrollComments || '');
  const [payrollSettings, setPayrollSettings] = useState<DispatchPayrollSettings | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    DispatchService.getPayrollSettings()
      .then((s) => setPayrollSettings(s))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { t, isFrench } = useI18n();
  const [sortByDeadhead, setSortByDeadhead] = useState(true);

  const activeDrivers = employees.filter((e) => e.isActive !== false);
  const activeAttendants = employees.filter((e) => e.isActive !== false);
  const activeVehicles = vehicles.filter((v) => v.active !== false);

  const shiftStops = shift?.stops || [];
  const selectedDriverObj = employees.find((e) => e.id === driverId) || null;
  const selectedAttendantObj = employees.find((e) => e.id === attendantId) || null;
  const selectedVehicleObj = activeVehicles.find((v) => String(v.vehicleId) === vehicleId) || null;

  const selectedDriverTimeOff = getEmployeeTimeOffReason(selectedDriverObj, employeeTimeOffMap);
  const selectedAttendantTimeOff = getEmployeeTimeOffReason(selectedAttendantObj, employeeTimeOffMap);

  const employeeTaskIndex = React.useMemo(
    () =>
      buildEmployeeTaskIndex({
        targetDate: shift.dispatchDate,
        dispatchShifts: allDayShifts,
        charterTrips,
        excludeDispatchShiftId: shift.id,
        windowStartTime: shift.firstStopTime || '07:00',
        windowEndTime: shift.lastStopTime || '09:00',
      }),
    [shift.dispatchDate, shift.id, shift.firstStopTime, shift.lastStopTime, allDayShifts, charterTrips]
  );

  const selectedDriverOtherTasks = React.useMemo(
    () => getEmployeeDayTasks(selectedDriverObj, employeeTaskIndex),
    [selectedDriverObj, employeeTaskIndex]
  );

  const selectedAttendantOtherTasks = React.useMemo(
    () => getEmployeeDayTasks(selectedAttendantObj, employeeTaskIndex),
    [selectedAttendantObj, employeeTaskIndex]
  );
  const selectedVehicleUnavail = selectedVehicleObj
    ? getVehicleUnavailabilityReason(
        selectedVehicleObj.unitNumber,
        selectedVehicleObj.vehicleId || selectedVehicleObj.id,
        unavailableVehiclesMap
      )
    : undefined;

  const rankedDrivers = React.useMemo(() => {
    if (shiftStops.length === 0 || !sortByDeadhead) {
      return [...activeDrivers]
        .sort((a, b) => compareCrewPriority(a, b, 'driver'))
        .map((d) => ({
          employee: d,
          deadhead: calculateDriverDeadhead(d, shiftStops)
        }));
    }
    return sortDriversByDeadhead(activeDrivers, shiftStops);
  }, [activeDrivers, shiftStops, sortByDeadhead]);

  const rankedAttendants = React.useMemo(() => {
    if (shiftStops.length === 0 || !sortByDeadhead) {
      return [...activeAttendants]
        .sort((a, b) => compareCrewPriority(a, b, 'attendant'))
        .map((a) => ({
          employee: a,
          deadhead: calculateAttendantDeadhead(a, selectedDriverObj, shiftStops)
        }));
    }
    return sortAttendantsByDeadhead(activeAttendants, selectedDriverObj, shiftStops);
  }, [activeAttendants, selectedDriverObj, shiftStops, sortByDeadhead]);

  const selectedDriverDeadhead = React.useMemo(() => {
    if (!selectedDriverObj || shiftStops.length === 0) return null;
    return calculateDriverDeadhead(selectedDriverObj, shiftStops);
  }, [selectedDriverObj, shiftStops]);

  const selectedAttendantDeadhead = React.useMemo(() => {
    if (!selectedAttendantObj || shiftStops.length === 0) return null;
    return calculateAttendantDeadhead(selectedAttendantObj, selectedDriverObj, shiftStops);
  }, [selectedAttendantObj, selectedDriverObj, shiftStops]);

  const driverSelectOptions = React.useMemo<SearchableSelectOption[]>(() => {
    const groups = groupCrewCandidates(rankedDrivers, 'driver');
    const labels = getOptGroupLabels('driver', isFrench);
    const buildOpt = (groupLabel: string) => ({ employee: d, deadhead }: (typeof rankedDrivers)[number]): SearchableSelectOption => {
      const eligibility = classifyEmployeeForRole(d, 'driver');
      const roleTag = isFrench ? eligibility.optionTagFr : eligibility.optionTagEn;
      const deadheadText = deadhead.hasCoordinates
        ? `~${deadhead.totalDeadheadKm} km deadhead (${deadhead.pullOutKm} km to start • ${deadhead.totalMinutes}m)`
        : t.deadhead.noGpsCoordinates;
      const timeOff = getEmployeeTimeOffReason(d, employeeTimeOffMap);
      const otherTasks = getEmployeeDayTasks(d, employeeTaskIndex);
      const tasksText = otherTasks.length > 0 ? formatEmployeeTasksOptionSuffix(otherTasks, isFrench) : '';
      const timeOffLabel = timeOff ? (isFrench ? timeOff.badgeTextFr : timeOff.badgeTextEn) : undefined;
      return {
        value: d.id,
        label: `${d.firstName} ${d.lastName} (${d.jobPosition || 'Driver'})`,
        groupLabel,
        badgeText: roleTag || undefined,
        secondaryBadgeText: timeOffLabel ? `🏖️ ${timeOffLabel}` : otherTasks.length > 0 ? `${otherTasks.length} task(s)` : undefined,
        secondaryBadgeClassName: timeOffLabel
          ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
          : otherTasks.some((task) => task.isOverlap)
            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            : 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        subtext: [deadheadText, d.preferredPhone || d.mobilePhone || ''].filter(Boolean).join(' • '),
        warningText: [timeOff ? (isFrench ? timeOff.detailFr : timeOff.detailEn) : '', tasksText]
          .filter(Boolean)
          .join(' • ') || undefined,
        isHighlighted: Boolean(timeOff || otherTasks.some((task) => task.isOverlap)),
        searchText: [
          d.firstName,
          d.lastName,
          d.employeeNumber,
          d.jobPosition,
          d.role,
          roleTag,
          d.preferredPhone,
          d.mobilePhone,
          d.personalAddress,
          timeOffLabel,
          tasksText,
        ]
          .filter(Boolean)
          .join(' '),
      };
    };
    return [
      ...groups.primary.map(buildOpt(labels.primary)),
      ...groups.relief.map(buildOpt(labels.relief)),
      ...groups.other.map(buildOpt(labels.other)),
    ];
  }, [rankedDrivers, isFrench, t.deadhead.noGpsCoordinates, employeeTimeOffMap, employeeTaskIndex]);

  const attendantSelectOptions = React.useMemo<SearchableSelectOption[]>(() => {
    const groups = groupCrewCandidates(rankedAttendants, 'attendant');
    const labels = getOptGroupLabels('attendant', isFrench);
    const buildOpt = (groupLabel: string) => ({ employee: a, deadhead }: (typeof rankedAttendants)[number]): SearchableSelectOption => {
      const eligibility = classifyEmployeeForRole(a, 'attendant');
      const roleTag = isFrench ? eligibility.optionTagFr : eligibility.optionTagEn;
      let deadheadText = '';
      if (deadhead.hasCoordinates) {
        if (deadhead.distanceToDriverKm !== undefined) {
          deadheadText = `${deadhead.distanceToDriverKm} km ${t.deadhead.toDriverHome}${deadhead.detourKm ? ` • +${deadhead.detourKm}km detour` : ''}`;
        } else {
          deadheadText = `${deadhead.distanceToFirstStopKm} km ${t.deadhead.toFirstStop}`;
        }
      } else {
        deadheadText = t.deadhead.noGpsCoordinates;
      }
      const timeOff = getEmployeeTimeOffReason(a, employeeTimeOffMap);
      const otherTasks = getEmployeeDayTasks(a, employeeTaskIndex);
      const tasksText = otherTasks.length > 0 ? formatEmployeeTasksOptionSuffix(otherTasks, isFrench) : '';
      const timeOffLabel = timeOff ? (isFrench ? timeOff.badgeTextFr : timeOff.badgeTextEn) : undefined;
      return {
        value: a.id,
        label: `${a.firstName} ${a.lastName} (${a.jobPosition || 'Attendant'})`,
        groupLabel,
        badgeText: roleTag || undefined,
        secondaryBadgeText: timeOffLabel ? `🏖️ ${timeOffLabel}` : otherTasks.length > 0 ? `${otherTasks.length} task(s)` : undefined,
        secondaryBadgeClassName: timeOffLabel
          ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
          : otherTasks.some((task) => task.isOverlap)
            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            : 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        subtext: [deadheadText, a.preferredPhone || a.mobilePhone || ''].filter(Boolean).join(' • '),
        warningText: [timeOff ? (isFrench ? timeOff.detailFr : timeOff.detailEn) : '', tasksText]
          .filter(Boolean)
          .join(' • ') || undefined,
        isHighlighted: Boolean(timeOff || otherTasks.some((task) => task.isOverlap)),
        searchText: [
          a.firstName,
          a.lastName,
          a.employeeNumber,
          a.jobPosition,
          a.role,
          roleTag,
          a.preferredPhone,
          a.mobilePhone,
          a.personalAddress,
          timeOffLabel,
          tasksText,
        ]
          .filter(Boolean)
          .join(' '),
      };
    };
    return [
      ...groups.primary.map(buildOpt(labels.primary)),
      ...groups.relief.map(buildOpt(labels.relief)),
      ...groups.other.map(buildOpt(labels.other)),
    ];
  }, [
    rankedAttendants,
    isFrench,
    t.deadhead.noGpsCoordinates,
    t.deadhead.toDriverHome,
    t.deadhead.toFirstStop,
    employeeTimeOffMap,
    employeeTaskIndex,
  ]);

  const vehicleSelectOptions = React.useMemo<SearchableSelectOption[]>(() => {
    return activeVehicles.map((v) => {
      const unavail = getVehicleUnavailabilityReason(
        v.unitNumber,
        v.vehicleId || v.id,
        unavailableVehiclesMap
      );
      const unavailBadge = unavail
        ? `🔧 ${isFrench ? unavail.badgeTextFr : unavail.badgeTextEn}`
        : undefined;
      return {
        value: String(v.vehicleId),
        label: `Unit ${v.unitNumber} (${v.manufacturer} ${v.model}, Plate: ${v.plateNumber})`,
        secondaryBadgeText: unavailBadge,
        secondaryBadgeClassName: unavailBadge
          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
          : undefined,
        subtext: [
          v.seatCap ? `${v.seatCap} seats` : '',
          v.yardName || '',
          v.driverName ? `Driver: ${v.driverName}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        warningText: unavail ? (isFrench ? unavail.detailFr : unavail.detailEn) : undefined,
        isHighlighted: Boolean(unavail),
        searchText: [
          v.unitNumber,
          v.plateNumber,
          v.manufacturer,
          v.model,
          v.fuelType,
          v.yardName,
          v.driverName,
          unavailBadge,
        ]
          .filter(Boolean)
          .join(' '),
      };
    });
  }, [activeVehicles, unavailableVehiclesMap, isFrench]);

  const driverPD = payrollSettings?.driver?.partialPayRate ?? 25;
  const driverDD = payrollSettings?.driver?.doublePartialPayRate ?? 50;
  const driverEI = payrollSettings?.driver?.defaultEiHours ?? 3;

  const attendantPD = payrollSettings?.attendant?.partialPayRate ?? 20;
  const attendantDD = payrollSettings?.attendant?.doublePartialPayRate ?? 40;
  const attendantEI = payrollSettings?.attendant?.defaultEiHours ?? 2;

  const nursePD = payrollSettings?.nurse?.partialPayRate ?? 30;
  const nurseDD = payrollSettings?.nurse?.doublePartialPayRate ?? 60;
  const nurseEI = payrollSettings?.nurse?.defaultEiHours ?? 3;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const selectedDriver = employees.find((e) => e.id === driverId);
      const selectedAttendant = employees.find((e) => e.id === attendantId);
      const selectedVeh = vehicles.find((v) => String(v.vehicleId) === vehicleId);

      // Resolve driver pay
      let driverPayAmount: number | undefined = undefined;
      let driverEiHours: number | undefined = undefined;
      if (driverPayOption === 'PD') {
        driverPayAmount = driverPD;
        driverEiHours = driverEI;
      } else if (driverPayOption === 'DD') {
        driverPayAmount = driverDD;
        driverEiHours = driverEI;
      } else if (driverPayOption === 'NP') {
        driverPayAmount = 0;
        driverEiHours = 0;
      }

      // Resolve attendant pay
      let attendantPayAmount: number | undefined = undefined;
      let attendantEiHours: number | undefined = undefined;
      if (attendantPayOption === 'PD') {
        attendantPayAmount = attendantPD;
        attendantEiHours = attendantEI;
      } else if (attendantPayOption === 'DD') {
        attendantPayAmount = attendantDD;
        attendantEiHours = attendantEI;
      } else if (attendantPayOption === 'NP') {
        attendantPayAmount = 0;
        attendantEiHours = 0;
      }

      // Resolve nurse pay
      let nursePayAmount: number | undefined = undefined;
      let nurseEiHours: number | undefined = undefined;
      if (nursePayOption === 'PD') {
        nursePayAmount = nursePD;
        nurseEiHours = nurseEI;
      } else if (nursePayOption === 'DD') {
        nursePayAmount = nurseDD;
        nurseEiHours = nurseEI;
      } else if (nursePayOption === 'NP') {
        nursePayAmount = 0;
        nurseEiHours = 0;
      }

      const updateData: Partial<DispatchShift> = {
        driverId: driverId || undefined,
        driverName: selectedDriver ? `${selectedDriver.firstName} ${selectedDriver.lastName}` : (driverId ? shift.driverName : ''),
        driverPhone: selectedDriver?.preferredPhone || selectedDriver?.mobilePhone || (driverId ? shift.driverPhone : ''),
        attendantId: attendantId || undefined,
        attendantName: selectedAttendant ? `${selectedAttendant.firstName} ${selectedAttendant.lastName}` : (attendantId ? shift.attendantName : ''),
        attendantPhone: selectedAttendant?.preferredPhone || selectedAttendant?.mobilePhone || (attendantId ? shift.attendantPhone : ''),
        vehicleId: selectedVeh ? selectedVeh.vehicleId : (vehicleId ? shift.vehicleId : 0),
        unitNumber: selectedVeh ? selectedVeh.unitNumber : (vehicleId ? shift.unitNumber : ''),
        plateNumber: selectedVeh ? selectedVeh.plateNumber : (vehicleId ? shift.plateNumber : ''),
        isDryRun,
        notes,
        scheduledCheckInTime: scheduledCheckInTime || undefined,
        isDriverCheckedIn,
        driverCheckedInAt: isDriverCheckedIn ? (driverCheckedInAt || getCurrentHHmm()) : null,
        isDriverCheckedOut,
        driverCheckedOutAt: isDriverCheckedOut ? (driverCheckedOutAt || getCurrentHHmm()) : null,
        driverCheckoutComments: isDriverCheckedOut ? (driverCheckoutComments || undefined) : null,
        isAttendantCheckedIn,
        attendantCheckedInAt: isAttendantCheckedIn ? (attendantCheckedInAt || getCurrentHHmm()) : null,
        isAttendantCheckedOut,
        attendantCheckedOutAt: isAttendantCheckedOut ? (attendantCheckedOutAt || getCurrentHHmm()) : null,
        attendantCheckoutComments: isAttendantCheckedOut ? (attendantCheckoutComments || undefined) : null,
        driverPayOption: driverPayOption || undefined,
        driverPayAmount,
        driverEiHours,
        attendantPayOption: attendantPayOption || undefined,
        attendantPayAmount,
        attendantEiHours,
        nurseName: nurseName || undefined,
        nursePayOption: nursePayOption || undefined,
        nursePayAmount,
        nurseEiHours,
        payrollComments: payrollComments || undefined,
      };

      const updated = await DispatchService.updateShift(shift.id, updateData);

      // Audit Logging
      const origDriverId = shift.driverId || '';
      const origAttendantId = shift.attendantId || '';
      const origVehId = shift.vehicleId ? String(shift.vehicleId) : '';
      const newDriverName = selectedDriver ? `${selectedDriver.firstName} ${selectedDriver.lastName}` : (driverId ? shift.driverName : 'None');
      const newAttendantName = selectedAttendant ? `${selectedAttendant.firstName} ${selectedAttendant.lastName}` : (attendantId ? shift.attendantName : 'None');
      const newUnitNo = selectedVeh ? selectedVeh.unitNumber : (shift.unitNumber || 'None');

      // 1. Crew Assignment update
      if (driverId !== origDriverId || attendantId !== origAttendantId || vehicleId !== origVehId) {
        await logDispatchAction({
          date: shift.dispatchDate,
          type: 'Assignment Updated',
          detail: `Dispatch Shift ${shift.routeNo} Assignment Updated: Driver ${newDriverName} Attendant ${newAttendantName} Unit ${newUnitNo} on ${shift.dispatchDate}`,
          shift,
          user: actorName,
        });
      }

      // 2. Dispatch comments
      if (notes !== (shift.notes || '')) {
        await logDispatchAction({
          date: shift.dispatchDate,
          type: 'Dispatch Comments',
          detail: `Update Dispatch Comments: ${notes || '(cleared)'}`,
          shift,
          user: actorName,
        });
      }

      // 3. Payroll comments / Pay options
      if (
        payrollComments !== (shift.payrollComments || '') ||
        driverPayOption !== (shift.driverPayOption || '') ||
        attendantPayOption !== (shift.attendantPayOption || '')
      ) {
        await logDispatchAction({
          date: shift.dispatchDate,
          type: 'Payroll Comments',
          detail: `Update Payroll Comments: ${payrollComments || 'Updated pay options'}`,
          shift,
          user: actorName,
        });
      }

      // 4. TCS Check-in/out
      if (isDriverCheckedIn !== !!shift.isDriverCheckedIn) {
        await logDispatchAction({
          date: shift.dispatchDate,
          type: 'TCS Check-in/out',
          detail: `TCS Driver ${isDriverCheckedIn ? 'Checked in' : 'Check-out'} TCS ${newDriverName} at ${driverCheckedInAt || getCurrentHHmm()}`,
          shift,
          user: actorName,
        });
      }
      if (isAttendantCheckedIn !== !!shift.isAttendantCheckedIn) {
        await logDispatchAction({
          date: shift.dispatchDate,
          type: 'TCS Check-in/out',
          detail: `TCS Attendant ${isAttendantCheckedIn ? 'Checked in' : 'Check-out'} TCS ${newAttendantName} at ${attendantCheckedInAt || getCurrentHHmm()}`,
          shift,
          user: actorName,
        });
      }

      onShiftUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update shift crew:', err);
      alert('Failed to update shift: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="flex min-h-full items-center justify-center p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl">
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/95 rounded-t-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Assign Dispatch Crew & Vehicle
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Shift {shift.routeNo} • {shift.shiftType} ({shift.dispatchDate})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="space-y-4 min-w-0">
          {/* Driver Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-500" />
                <span>Assigned Driver</span>
              </label>
              <button
                type="button"
                onClick={() => setSortByDeadhead(!sortByDeadhead)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition border cursor-pointer ${
                  sortByDeadhead
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
                }`}
                title={sortByDeadhead ? t.deadhead.sortByName : t.deadhead.sortByDeadhead}
              >
                <Zap className="w-3 h-3 text-amber-500" />
                <span>{sortByDeadhead ? t.deadhead.sortByDeadhead : t.deadhead.sortByName}</span>
              </button>
            </div>
            <SearchableSelect
              testId="dispatch-crew-driver-select"
              value={driverId}
              onChange={setDriverId}
              options={driverSelectOptions}
              emptyOptionLabel="-- No Driver Assigned --"
              searchPlaceholder={
                isFrench ? 'Rechercher chauffeur (nom, #, rôle)...' : 'Search driver (name, #, role, task)...'
              }
              noResultsText={isFrench ? 'Aucun chauffeur trouvé' : 'No matching drivers found'}
              icon={<User className="w-4 h-4 text-amber-500" />}
              accentColor="amber"
            />

            {selectedDriverOtherTasks.length > 0 && (
              <div
                data-testid="crew-modal-driver-other-tasks"
                className={`mt-2 p-2.5 rounded-xl border text-xs space-y-1 ${
                  selectedDriverOtherTasks.some((task) => task.isOverlap)
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200'
                    : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/70 text-sky-900 dark:text-sky-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isFrench
                      ? `Autres tâches le ${shift.dispatchDate} :`
                      : `Other tasks on ${shift.dispatchDate}:`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedDriverOtherTasks.map((task) => (
                    <span
                      key={`${task.source}:${task.id}:${task.role}`}
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        task.isOverlap
                          ? 'bg-rose-100/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                          : 'bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border-sky-200 dark:border-sky-800'
                      }`}
                    >
                      {formatEmployeeTaskShortLabel(task, isFrench)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedDriverTimeOff && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700/80 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
                <CalendarOff className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    {isFrench ? selectedDriverTimeOff.badgeTextFr : selectedDriverTimeOff.badgeTextEn}
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    {isFrench ? selectedDriverTimeOff.detailFr : selectedDriverTimeOff.detailEn}
                  </div>
                </div>
              </div>
            )}

            {/* Deadhead Proximity Card for Selected Driver */}
            {selectedDriverDeadhead && selectedDriverDeadhead.hasCoordinates && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-amber-500/30 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[11px]">
                    <Home className="w-3.5 h-3.5" />
                    <span>{t.deadhead.driverParkedAtHome}</span>
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[11px]">
                    ~{selectedDriverDeadhead.totalDeadheadKm} km ({selectedDriverDeadhead.totalMinutes} min)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                  <div className="bg-white dark:bg-slate-900/60 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                    <div>{t.deadhead.pullOutDistance}:</div>
                    <div className="font-bold text-slate-900 dark:text-slate-200">{selectedDriverDeadhead.pullOutKm} km (~{selectedDriverDeadhead.pullOutMinutes}m)</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900/60 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                    <div>{t.deadhead.pullInDistance}:</div>
                    <div className="font-bold text-slate-900 dark:text-slate-200">{selectedDriverDeadhead.pullInKm} km (~{selectedDriverDeadhead.pullInMinutes}m)</div>
                  </div>
                </div>
                {selectedDriverDeadhead.originAddress && (
                  <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-slate-400" />
                    <span>{selectedDriverDeadhead.originAddress}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Driver Check-In Configuration */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Driver Check-In</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDriverCheckedIn}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsDriverCheckedIn(checked);
                    if (checked && !driverCheckedInAt) {
                      setDriverCheckedInAt(getCurrentHHmm());
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className={isDriverCheckedIn ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                  {isDriverCheckedIn ? 'Checked In' : 'Not Checked In'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Scheduled Check-In (60m prior)
                </label>
                <input
                  type="time"
                  value={scheduledCheckInTime}
                  onChange={(e) => setScheduledCheckInTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Actual Check-In Time
                </label>
                <input
                  type="time"
                  disabled={!isDriverCheckedIn}
                  value={driverCheckedInAt}
                  onChange={(e) => setDriverCheckedInAt(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                  placeholder="--:--"
                />
              </div>
            </div>

            {/* Driver Check-Out Controls */}
            {isDriverCheckedIn && (
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                    Driver Check-Out
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDriverCheckedOut}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsDriverCheckedOut(checked);
                        if (checked && !driverCheckedOutAt) {
                          setDriverCheckedOutAt(getCurrentHHmm());
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className={isDriverCheckedOut ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>
                      {isDriverCheckedOut ? 'Checked Out' : 'Not Checked Out'}
                    </span>
                  </label>
                </div>
                {isDriverCheckedOut && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Actual Check-Out Time
                      </label>
                      <input
                        type="time"
                        value={driverCheckedOutAt}
                        onChange={(e) => setDriverCheckedOutAt(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Checkout Comments
                      </label>
                      <input
                        type="text"
                        value={driverCheckoutComments}
                        onChange={(e) => setDriverCheckoutComments(e.target.value)}
                        placeholder="Optional remarks"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>

          <div className="space-y-4 min-w-0">
          {/* Attendant Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-emerald-500" />
              <span>Assigned Attendant</span>
            </label>
            <SearchableSelect
              testId="dispatch-crew-attendant-select"
              value={attendantId}
              onChange={setAttendantId}
              options={attendantSelectOptions}
              emptyOptionLabel="-- No Attendant Assigned --"
              searchPlaceholder={
                isFrench ? 'Rechercher accompagnateur (nom, #, rôle)...' : 'Search attendant (name, #, role, task)...'
              }
              noResultsText={isFrench ? 'Aucun accompagnateur trouvé' : 'No matching attendants found'}
              icon={<HeartHandshake className="w-4 h-4 text-emerald-500" />}
              accentColor="emerald"
            />

            {selectedAttendantOtherTasks.length > 0 && (
              <div
                data-testid="crew-modal-attendant-other-tasks"
                className={`mt-2 p-2.5 rounded-xl border text-xs space-y-1 ${
                  selectedAttendantOtherTasks.some((task) => task.isOverlap)
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200'
                    : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/70 text-sky-900 dark:text-sky-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isFrench
                      ? `Autres tâches le ${shift.dispatchDate} :`
                      : `Other tasks on ${shift.dispatchDate}:`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedAttendantOtherTasks.map((task) => (
                    <span
                      key={`${task.source}:${task.id}:${task.role}`}
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        task.isOverlap
                          ? 'bg-rose-100/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                          : 'bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border-sky-200 dark:border-sky-800'
                      }`}
                    >
                      {formatEmployeeTaskShortLabel(task, isFrench)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedAttendantTimeOff && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700/80 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
                <CalendarOff className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    {isFrench ? selectedAttendantTimeOff.badgeTextFr : selectedAttendantTimeOff.badgeTextEn}
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    {isFrench ? selectedAttendantTimeOff.detailFr : selectedAttendantTimeOff.detailEn}
                  </div>
                </div>
              </div>
            )}

            {/* Deadhead Proximity Card for Selected Attendant */}
            {selectedAttendantDeadhead && selectedAttendantDeadhead.hasCoordinates && (
              <div className="mt-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-indigo-500/30 text-xs flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300 text-[11px]">
                  <Shield className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    {selectedAttendantDeadhead.distanceToDriverKm !== undefined
                      ? `${t.deadhead.toDriverHome}: ${selectedAttendantDeadhead.distanceToDriverKm} km (~${selectedAttendantDeadhead.estimatedMinutes}m)`
                      : `${t.deadhead.toFirstStop}: ${selectedAttendantDeadhead.distanceToFirstStopKm} km (~${selectedAttendantDeadhead.estimatedMinutes}m)`}
                  </span>
                </div>
                {selectedAttendantDeadhead.detourKm !== undefined && selectedAttendantDeadhead.detourKm > 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    +{selectedAttendantDeadhead.detourKm} km {t.deadhead.detourToDriver}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Attendant Check-In Configuration (shown if attendant assigned) */}
          {(attendantId || shift.attendantId) && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Attendant Check-In</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAttendantCheckedIn}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsAttendantCheckedIn(checked);
                      if (checked && !attendantCheckedInAt) {
                        setAttendantCheckedInAt(getCurrentHHmm());
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className={isAttendantCheckedIn ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                    {isAttendantCheckedIn ? 'Checked In' : 'Not Checked In'}
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Actual Attendant Check-In Time
                </label>
                <input
                  type="time"
                  disabled={!isAttendantCheckedIn}
                  value={attendantCheckedInAt}
                  onChange={(e) => setAttendantCheckedInAt(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                  placeholder="--:--"
                />
              </div>

              {/* Attendant Check-Out Controls */}
              {isAttendantCheckedIn && (
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                      Attendant Check-Out
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAttendantCheckedOut}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsAttendantCheckedOut(checked);
                          if (checked && !attendantCheckedOutAt) {
                            setAttendantCheckedOutAt(getCurrentHHmm());
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className={isAttendantCheckedOut ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>
                        {isAttendantCheckedOut ? 'Checked Out' : 'Not Checked Out'}
                      </span>
                    </label>
                  </div>
                  {isAttendantCheckedOut && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Actual Attendant Check-Out Time
                        </label>
                        <input
                          type="time"
                          value={attendantCheckedOutAt}
                          onChange={(e) => setAttendantCheckedOutAt(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Checkout Comments
                        </label>
                        <input
                          type="text"
                          value={attendantCheckoutComments}
                          onChange={(e) => setAttendantCheckoutComments(e.target.value)}
                          placeholder="Optional remarks"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
          </div>

          {/* Vehicle Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              <span>Assigned Vehicle Unit</span>
            </label>
            <SearchableSelect
              testId="dispatch-crew-vehicle-select"
              value={vehicleId}
              onChange={setVehicleId}
              options={vehicleSelectOptions}
              emptyOptionLabel="-- No Vehicle Assigned --"
              searchPlaceholder={
                isFrench
                  ? 'Rechercher véhicule (unité, plaque, modèle, chauffeur)...'
                  : 'Search vehicle (unit #, plate, model, driver)...'
              }
              noResultsText={isFrench ? 'Aucun véhicule trouvé' : 'No matching vehicles found'}
              icon={<Truck className="w-4 h-4 text-blue-500" />}
              accentColor="blue"
            />

            {selectedVehicleUnavail && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    {isFrench ? selectedVehicleUnavail.badgeTextFr : selectedVehicleUnavail.badgeTextEn}
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    {isFrench ? selectedVehicleUnavail.detailFr : selectedVehicleUnavail.detailEn}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dispatch Payroll Comment Section */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Dispatch Payroll Comment</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Driver Payroll Rate */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Driver Pay
                </label>
                <select
                  value={driverPayOption}
                  onChange={(e) => setDriverPayOption(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">-- Standard Route Pay --</option>
                  <option value="PD">PD ${driverPD.toFixed(2)} (Partial)</option>
                  <option value="DD">DD ${driverDD.toFixed(2)} (Double)</option>
                  <option value="NP">No Pay ($0.00)</option>
                </select>
              </div>

              {/* Attendant Payroll Rate */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Attendant Pay
                </label>
                <select
                  value={attendantPayOption}
                  onChange={(e) => setAttendantPayOption(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">-- Standard Route Pay --</option>
                  <option value="PD">PD ${attendantPD.toFixed(2)} (Partial)</option>
                  <option value="DD">DD ${attendantDD.toFixed(2)} (Double)</option>
                  <option value="NP">No Pay ($0.00)</option>
                </select>
              </div>

              {/* LPN / Nurse Payroll Rate */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    LPN / Nurse Pay
                  </label>
                  {nursePayOption && (
                    <input
                      type="text"
                      placeholder="LPN Name"
                      value={nurseName}
                      onChange={(e) => setNurseName(e.target.value)}
                      className="px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-32"
                    />
                  )}
                </div>
                <select
                  value={nursePayOption}
                  onChange={(e) => setNursePayOption(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">-- No LPN / Standard Pay --</option>
                  <option value="PD">PD ${nursePD.toFixed(2)} (Partial)</option>
                  <option value="DD">DD ${nurseDD.toFixed(2)} (Double)</option>
                  <option value="NP">No Pay ($0.00)</option>
                </select>
              </div>

              {/* Payroll Comments */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Payroll Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special rate authorized"
                  value={payrollComments}
                  onChange={(e) => setPayrollComments(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Dry Run Flag */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isDryRun"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="isDryRun" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Mark as Dry Run / Route Familiarization
            </label>
          </div>

          {/* Dispatch Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Operational Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Substitute driver, detour on Merivale Rd, etc."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="sticky bottom-0 z-10 -mx-6 -mb-6 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Crew'}</span>
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
