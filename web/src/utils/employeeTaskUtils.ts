import { CharterTrip } from '../types/charter';
import { DispatchShift } from '../types/dispatch';
import { Employee } from '../types/employee';
import { doIntervalsOverlap } from './dispatchConflictDetector';

export interface EmployeeDayTask {
  id: string;
  source: 'dispatch' | 'charter';
  role: 'driver' | 'attendant';
  title: string;
  subtitle?: string;
  startTime?: string;
  endTime?: string;
  vehicleUnit?: string;
  isOverlap: boolean;
}

export interface EmployeeTaskIndex {
  byId: Map<string, EmployeeDayTask[]>;
  byName: Map<string, EmployeeDayTask[]>;
}

export interface BuildEmployeeTaskIndexOptions {
  targetDate: string;
  dispatchShifts?: DispatchShift[];
  charterTrips?: CharterTrip[];
  excludeDispatchShiftId?: string;
  excludeCharterAssignmentId?: string;
  windowStartTime?: string;
  windowEndTime?: string;
}

const PLACEHOLDER_VALUES = new Set([
  '',
  '0',
  'tbd',
  'unassigned',
  'none',
  'non assigné',
  'n/a',
]);

function normalizeKey(value?: string | number | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value).trim().toLowerCase();
  if (PLACEHOLDER_VALUES.has(str)) return '';
  return str;
}

function normalizeTimeHHmm(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const tIndex = trimmed.indexOf('T');
  if (tIndex !== -1 && trimmed.length >= tIndex + 6) {
    return trimmed.slice(tIndex + 1, tIndex + 6);
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/**
 * Resolves the HH:mm start and end window for a charter trip on a given YYYY-MM-DD date.
 */
export function extractCharterTimeWindow(
  trip: CharterTrip,
  targetDate?: string
): { startTime: string; endTime: string } {
  const normTarget = (targetDate || '').slice(0, 10);
  const startDate = (trip.dispatchDate || trip.departsAt || '').slice(0, 10);
  const endDate = (trip.returnsAt || '').slice(0, 10) || startDate;

  let startTime = normalizeTimeHHmm(trip.departsAt);
  let endTime = normalizeTimeHHmm(trip.returnsAt);

  if (!startTime && Array.isArray(trip.stops) && trip.stops.length > 0) {
    startTime = normalizeTimeHHmm(trip.stops[0]?.scheduledAt);
  }
  if (!endTime && Array.isArray(trip.stops) && trip.stops.length > 0) {
    endTime = normalizeTimeHHmm(trip.stops[trip.stops.length - 1]?.scheduledAt);
  }

  if (normTarget && startDate && endDate && endDate > startDate) {
    if (normTarget > startDate && normTarget < endDate) {
      return { startTime: '00:00', endTime: '23:59' };
    }
    if (normTarget === startDate) {
      return { startTime: startTime || '00:00', endTime: '23:59' };
    }
    if (normTarget === endDate) {
      return { startTime: '00:00', endTime: endTime || '23:59' };
    }
  }

  return { startTime, endTime };
}

function computeIsOverlap(
  taskStart: string,
  taskEnd: string,
  windowStart?: string,
  windowEnd?: string
): boolean {
  if (!windowStart || !windowEnd || !taskStart || !taskEnd) return false;
  return doIntervalsOverlap(windowStart, windowEnd, taskStart, taskEnd);
}

function addTaskToIndex(
  index: EmployeeTaskIndex,
  rawId: string | number | undefined,
  rawName: string | undefined,
  task: EmployeeDayTask
): void {
  const idKey = normalizeKey(rawId);
  const nameKey = normalizeKey(rawName);
  if (!idKey && !nameKey) return;

  if (idKey) {
    const existing = index.byId.get(idKey);
    if (existing) {
      existing.push(task);
    } else {
      index.byId.set(idKey, [task]);
    }
  } else if (nameKey) {
    const existing = index.byName.get(nameKey);
    if (existing) {
      existing.push(task);
    } else {
      index.byName.set(nameKey, [task]);
    }
  }
}

/**
 * Indexes all Dispatch shifts and Charter trips occurring on `targetDate`
 * so any driver/attendant list can display the employee's other assignments for that day.
 */
export function buildEmployeeTaskIndex({
  targetDate,
  dispatchShifts = [],
  charterTrips = [],
  excludeDispatchShiftId,
  excludeCharterAssignmentId,
  windowStartTime,
  windowEndTime,
}: BuildEmployeeTaskIndexOptions): EmployeeTaskIndex {
  const index: EmployeeTaskIndex = {
    byId: new Map(),
    byName: new Map(),
  };

  const normTargetDate = (targetDate || '').slice(0, 10);
  if (!normTargetDate) return index;

  const normWindowStart = normalizeTimeHHmm(windowStartTime);
  const normWindowEnd = normalizeTimeHHmm(windowEndTime);

  for (const shift of dispatchShifts) {
    if (!shift) continue;
    if (excludeDispatchShiftId && shift.id === excludeDispatchShiftId) continue;
    const shiftDate = (shift.dispatchDate || '').slice(0, 10);
    if (shiftDate !== normTargetDate) continue;

    const startTime = normalizeTimeHHmm(shift.firstStopTime);
    const endTime = normalizeTimeHHmm(shift.lastStopTime);
    const isOverlap = computeIsOverlap(startTime, endTime, normWindowStart, normWindowEnd);
    const baseTask = {
      id: shift.id,
      source: 'dispatch' as const,
      title: shift.routeNo || shift.id,
      subtitle: shift.shiftType || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      vehicleUnit: shift.unitNumber || undefined,
      isOverlap,
    };

    if (normalizeKey(shift.driverId) || normalizeKey(shift.driverName)) {
      addTaskToIndex(index, shift.driverId, shift.driverName, {
        ...baseTask,
        role: 'driver',
      });
    }

    if (normalizeKey(shift.attendantId) || normalizeKey(shift.attendantName)) {
      addTaskToIndex(index, shift.attendantId, shift.attendantName, {
        ...baseTask,
        role: 'attendant',
      });
    }
  }

  for (const trip of charterTrips) {
    if (!trip || trip.status === 5) continue;
    const tripStartDate = (trip.dispatchDate || trip.departsAt || '').slice(0, 10);
    const tripEndDate = (trip.returnsAt || '').slice(0, 10) || tripStartDate;
    if (!tripStartDate) continue;
    const matchesDate =
      normTargetDate === tripStartDate ||
      (tripEndDate >= tripStartDate && normTargetDate >= tripStartDate && normTargetDate <= tripEndDate);
    if (!matchesDate) continue;

    const { startTime, endTime } = extractCharterTimeWindow(trip, normTargetDate);
    const isOverlap = computeIsOverlap(startTime, endTime, normWindowStart, normWindowEnd);
    const assignments = Array.isArray(trip.assignments) ? trip.assignments : [];

    for (const asg of assignments) {
      if (!asg || asg.status === 3) continue;
      if (excludeCharterAssignmentId && asg.id === excludeCharterAssignmentId) continue;

      const baseTask = {
        id: `${trip.id}:${asg.id}`,
        source: 'charter' as const,
        title: trip.tripNumber || trip.title || trip.id,
        subtitle: trip.title || trip.clientName || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        vehicleUnit: asg.vehicleUnitNumber || undefined,
        isOverlap,
      };

      if (normalizeKey(asg.driverId) || normalizeKey(asg.driverName)) {
        addTaskToIndex(index, asg.driverId, asg.driverName, {
          ...baseTask,
          role: 'driver',
        });
      }

      if (normalizeKey(asg.attendantId) || normalizeKey(asg.attendantName)) {
        addTaskToIndex(index, asg.attendantId, asg.attendantName, {
          ...baseTask,
          role: 'attendant',
        });
      }
    }
  }

  return index;
}

/**
 * Retrieves all indexed tasks for an employee on the target date, sorted chronologically.
 */
export function getEmployeeDayTasks(
  employee: Employee | null | undefined,
  index: EmployeeTaskIndex | null | undefined
): EmployeeDayTask[] {
  if (!employee || !index) return [];

  const matched: EmployeeDayTask[] = [];
  const seen = new Set<string>();

  const idKeys = new Set<string>();
  const primaryId = normalizeKey(employee.id);
  const numericId = normalizeKey(employee.employeeId);
  const empNum = normalizeKey(employee.employeeNumber);
  if (primaryId) idKeys.add(primaryId);
  if (numericId) idKeys.add(numericId);
  if (empNum) idKeys.add(empNum);

  const pushUnique = (tasks: EmployeeDayTask[] | undefined) => {
    if (!tasks) return;
    for (const t of tasks) {
      const dedupeKey = `${t.source}:${t.id}:${t.role}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        matched.push(t);
      }
    }
  };

  for (const key of idKeys) {
    pushUnique(index.byId.get(key));
  }

  const fullName1 = normalizeKey(`${employee.firstName || ''} ${employee.lastName || ''}`);
  const fullName2 = normalizeKey(employee.fullName);
  if (fullName1) pushUnique(index.byName.get(fullName1));
  if (fullName2 && fullName2 !== fullName1) pushUnique(index.byName.get(fullName2));

  matched.sort((a, b) => {
    const timeCmp = (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    if (timeCmp !== 0) return timeCmp;
    return a.title.localeCompare(b.title);
  });

  return matched;
}

/**
 * Formats a single task concisely for badges and select options.
 */
export function formatEmployeeTaskShortLabel(task: EmployeeDayTask, isFrench = false): string {
  const sourceLabel =
    task.source === 'dispatch'
      ? 'Dispatch'
      : isFrench
      ? 'Nolisement'
      : 'Charter';
  const sub = task.source === 'dispatch' && task.subtitle ? ` ${task.subtitle}` : '';
  const timeRange =
    task.startTime && task.endTime
      ? ` (${task.startTime}-${task.endTime})`
      : task.startTime
      ? ` (${task.startTime})`
      : '';
  return `${sourceLabel}: ${task.title}${sub}${timeRange}`;
}

/**
 * Formats a concise inline suffix suitable for native <option> labels.
 */
export function formatEmployeeTasksOptionSuffix(
  tasks: EmployeeDayTask[],
  isFrench = false
): string {
  if (tasks.length === 0) return '';
  return tasks
    .map((task) => {
      const prefix = task.isOverlap ? '⚠ ' : '';
      return `${prefix}${formatEmployeeTaskShortLabel(task, isFrench)}`;
    })
    .join('; ');
}
