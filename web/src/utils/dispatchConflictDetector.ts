/**
 * Dispatch Conflict Detection Engine.
 * Pure logic for verifying driver double-booking, vehicle double-assignment,
 * and scheduled driver time-off constraints.
 */

export interface ScheduledShift {
  id: string;
  dispatchDate: string; // YYYY-MM-DD
  routeNo: string;
  shiftType: string;
  driverId?: string;
  driverName?: string;
  vehicleUnit?: string;
  startTime: string; // HH:mm or H:mm
  endTime: string;   // HH:mm or H:mm
}

export interface TimeOffRecord {
  id: string;
  employeeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  type: string;      // 'sick' | 'vacation' | 'personal' | etc.
}

export interface ConflictResult {
  hasConflict: boolean;
  reason?: 'driver_overlap' | 'vehicle_overlap' | 'driver_time_off';
  messageEn?: string;
  messageFr?: string;
  conflictingShiftId?: string;
}

/**
 * Converts "HH:mm" or "H:mm" to minutes from midnight (0 - 1439).
 */
export function parseClockToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().split(' ')[0] || '';
  const [hStr, mStr] = clean.split(':');
  const h = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Checks whether two time intervals [startA, endA) and [startB, endB) overlap.
 */
export function doIntervalsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = parseClockToMinutes(startA);
  const eA = parseClockToMinutes(endA);
  const sB = parseClockToMinutes(startB);
  const eB = parseClockToMinutes(endB);

  // If start is after or equal to end, treat as zero-duration or invalid
  if (sA >= eA || sB >= eB) return false;

  return Math.max(sA, sB) < Math.min(eA, eB);
}

/**
 * Verifies if a driver has an overlapping shift on the same date.
 */
export function checkDriverShiftConflict(
  driverId: string,
  date: string,
  startTime: string,
  endTime: string,
  existingShifts: ScheduledShift[] = [],
  excludeShiftId?: string
): ConflictResult {
  if (!driverId || !date) return { hasConflict: false };

  const targetDate = date.slice(0, 10);
  const normDriver = driverId.trim().toLowerCase();

  for (const shift of existingShifts) {
    if (shift.id === excludeShiftId) continue;
    if ((shift.dispatchDate || '').slice(0, 10) !== targetDate) continue;

    const shiftDriver = (shift.driverId || '').trim().toLowerCase();
    if (shiftDriver === normDriver && shiftDriver.length > 0) {
      if (doIntervalsOverlap(startTime, endTime, shift.startTime, shift.endTime)) {
        return {
          hasConflict: true,
          reason: 'driver_overlap',
          conflictingShiftId: shift.id,
          messageEn: `Driver is already assigned to ${shift.routeNo} (${shift.startTime}-${shift.endTime}) on ${targetDate}.`,
          messageFr: `Le chauffeur est déjà assigné à ${shift.routeNo} (${shift.startTime}-${shift.endTime}) le ${targetDate}.`,
        };
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Verifies if a vehicle is already booked on the same date and overlapping hours.
 */
export function checkVehicleConflict(
  vehicleUnit: string,
  date: string,
  startTime: string,
  endTime: string,
  existingShifts: ScheduledShift[] = [],
  excludeShiftId?: string
): ConflictResult {
  if (!vehicleUnit || !date) return { hasConflict: false };

  const targetDate = date.slice(0, 10);
  const normUnit = vehicleUnit.trim().toUpperCase();

  for (const shift of existingShifts) {
    if (shift.id === excludeShiftId) continue;
    if ((shift.dispatchDate || '').slice(0, 10) !== targetDate) continue;

    const shiftUnit = (shift.vehicleUnit || '').trim().toUpperCase();
    if (shiftUnit === normUnit && shiftUnit.length > 0) {
      if (doIntervalsOverlap(startTime, endTime, shift.startTime, shift.endTime)) {
        return {
          hasConflict: true,
          reason: 'vehicle_overlap',
          conflictingShiftId: shift.id,
          messageEn: `Vehicle #${shiftUnit} is already assigned to ${shift.routeNo} (${shift.startTime}-${shift.endTime}) on ${targetDate}.`,
          messageFr: `Le véhicule #${shiftUnit} est déjà assigné à ${shift.routeNo} (${shift.startTime}-${shift.endTime}) le ${targetDate}.`,
        };
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Verifies if a driver has an approved time-off request covering the shift date.
 */
export function checkDriverTimeOffConflict(
  driverId: string,
  date: string,
  timeOffList: TimeOffRecord[] = []
): ConflictResult {
  if (!driverId || !date) return { hasConflict: false };

  const targetDate = date.slice(0, 10);
  const normDriver = driverId.trim().toLowerCase();

  for (const leave of timeOffList) {
    if (leave.status !== 'approved') continue;
    const leaveEmp = (leave.employeeId || '').trim().toLowerCase();
    if (leaveEmp !== normDriver) continue;

    const start = (leave.startDate || '').slice(0, 10);
    const end = (leave.endDate || '').slice(0, 10);

    if (targetDate >= start && targetDate <= end) {
      return {
        hasConflict: true,
        reason: 'driver_time_off',
        messageEn: `Driver has approved time-off (${leave.type}) from ${start} to ${end}.`,
        messageFr: `Le chauffeur a un congé approuvé (${leave.type}) du ${start} au ${end}.`,
      };
    }
  }

  return { hasConflict: false };
}
