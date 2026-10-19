import { DispatchShift, SentParentNotificationRecord } from '../types/dispatch';
import { getLocalTodayString } from './dateUtils';

/**
 * Parses "HH:mm" into total minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return h * 60 + m;
}

/**
 * Converts total minutes from midnight into "HH:mm".
 */
export function minutesToTimeString(totalMinutes: number): string {
  let normalized = totalMinutes % (24 * 60);
  if (normalized < 0) normalized += 24 * 60;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Subtracts minutes from "HH:mm" time string.
 */
export function subtractMinutesFromTime(timeStr: string, minutes: number): string {
  if (!timeStr) return '06:00';
  const total = timeStringToMinutes(timeStr);
  return minutesToTimeString(total - minutes);
}

/**
 * Returns difference in minutes between laterTime and earlierTime (later - earlier).
 */
export function diffMinutes(laterTime: string, earlierTime: string): number {
  const later = timeStringToMinutes(laterTime);
  const earlier = timeStringToMinutes(earlierTime);
  return later - earlier;
}

/**
 * Returns current local time formatted as "HH:mm".
 */
export function getCurrentHHmm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Gets effective scheduled check-in time.
 * Defaults to 60 minutes prior to firstStopTime if not explicitly set.
 */
export function getScheduledCheckInTime(shift: DispatchShift): string {
  if (shift.scheduledCheckInTime && shift.scheduledCheckInTime.trim() !== '') {
    return shift.scheduledCheckInTime;
  }
  if (shift.firstStopTime && shift.firstStopTime.trim() !== '') {
    return subtractMinutesFromTime(shift.firstStopTime, 60);
  }
  return '06:30';
}

export interface ShiftLatenessInfo {
  scheduledCheckInTime: string;
  isDriverCheckedIn: boolean;
  driverCheckedInAt?: string | null;
  driverLateMinutes: number;
  isDriverOverdue: boolean;
  isAttendantCheckedIn: boolean;
  attendantCheckedInAt?: string | null;
  attendantLateMinutes: number;
  isAttendantOverdue: boolean;
  isCheckInOverdue: boolean;
  maxStopLateMinutes: number;
  hasStopDelay: boolean;
  maxLateMinutes: number;
  effectiveHealth: 'green' | 'yellow' | 'red';
  isMissingDriver: boolean;
  isMissingVehicle: boolean;
  isMissingCrewOrVehicle: boolean;
}

/**
 * Computes dynamic in-memory lateness for a shift, crew check-ins, and stops.
 * Runs on-the-fly without requiring backend database writes.
 */
export function calculateDynamicShiftLateness(
  shift: DispatchShift,
  currentTimeStr: string,
  isToday: boolean
): ShiftLatenessInfo {
  const scheduledCheckIn = getScheduledCheckInTime(shift);
  const isDriverCheckedIn = Boolean(shift.isDriverCheckedIn);
  let driverLateMinutes = 0;
  let isDriverOverdue = false;

  const hasDriverAssigned = Boolean(shift.driverName && shift.driverName.trim() !== '');
  const isMissingDriver = !hasDriverAssigned;
  const isMissingVehicle = !shift.unitNumber || shift.unitNumber.trim() === '';
  const isMissingCrewOrVehicle = isMissingDriver || isMissingVehicle;

  const todayStr = getLocalTodayString();
  const shiftDate = shift.dispatchDate || '';
  const isPast = Boolean(shiftDate && shiftDate < todayStr);

  if (hasDriverAssigned) {
    if (isDriverCheckedIn) {
      if (shift.driverCheckedInAt) {
        driverLateMinutes = Math.max(0, diffMinutes(shift.driverCheckedInAt, scheduledCheckIn));
      }
      isDriverOverdue = false;
    } else if (isToday) {
      const diff = diffMinutes(currentTimeStr, scheduledCheckIn);
      if (diff > 0) {
        driverLateMinutes = diff;
        isDriverOverdue = true;
      }
    } else if (isPast) {
      isDriverOverdue = true;
    } else {
      isDriverOverdue = false;
    }
  }

  // Attendant check-in evaluation
  const hasAttendantAssigned = Boolean(shift.attendantName && shift.attendantName.trim() !== '');
  const isAttendantCheckedIn = Boolean(shift.isAttendantCheckedIn);
  let attendantLateMinutes = 0;
  let isAttendantOverdue = false;

  if (hasAttendantAssigned) {
    if (isAttendantCheckedIn) {
      if (shift.attendantCheckedInAt) {
        attendantLateMinutes = Math.max(0, diffMinutes(shift.attendantCheckedInAt, scheduledCheckIn));
      }
      isAttendantOverdue = false;
    } else if (isToday) {
      const diff = diffMinutes(currentTimeStr, scheduledCheckIn);
      if (diff > 0) {
        attendantLateMinutes = diff;
        isAttendantOverdue = true;
      }
    } else if (isPast) {
      isAttendantOverdue = true;
    } else {
      isAttendantOverdue = false;
    }
  }

  // Overdue check-in for assigned driver or attendant:
  // ONLY true if the assigned crew member has NOT checked in yet, AND their scheduled time has passed
  const isDriverCheckInOverdue = hasDriverAssigned && !isDriverCheckedIn && isDriverOverdue;
  const isAttendantCheckInOverdue = hasAttendantAssigned && !isAttendantCheckedIn && isAttendantOverdue;
  const isCheckInOverdue = isDriverCheckInOverdue || isAttendantCheckInOverdue;

  // Calculate stop lateness
  let maxStopLateMinutes = 0;
  if (Array.isArray(shift.stops)) {
    for (const stop of shift.stops) {
      let stopLate = 0;
      const actualTime = stop.stopArrivalTime || stop.actualArrivalTime;
      if (actualTime) {
        if (typeof stop.minutesLate === 'number' && stop.minutesLate > 0) {
          stopLate = stop.minutesLate;
        } else if (stop.stopScheduleTime) {
          stopLate = Math.max(0, diffMinutes(actualTime, stop.stopScheduleTime));
        }
      } else if (isToday && stop.stopScheduleTime) {
        // Unarrived stop on today's shift: check if current time is past schedule
        const diff = diffMinutes(currentTimeStr, stop.stopScheduleTime);
        if (diff > 0) {
          stopLate = diff;
        }
      }

      if (stopLate > maxStopLateMinutes) {
        maxStopLateMinutes = stopLate;
      }
    }
  }

  const existingLate = typeof shift.lateMinutes === 'number' ? shift.lateMinutes : 0;
  const hasStopDelay = maxStopLateMinutes > 0 || existingLate > 0;
  const maxLateMinutes = Math.max(driverLateMinutes, attendantLateMinutes, maxStopLateMinutes, existingLate);

  let effectiveHealth: 'green' | 'yellow' | 'red' = 'green';
  if (isMissingCrewOrVehicle || maxLateMinutes >= 15) {
    effectiveHealth = 'red';
  } else if (maxLateMinutes >= 5) {
    effectiveHealth = 'yellow';
  }

  return {
    scheduledCheckInTime: scheduledCheckIn,
    isDriverCheckedIn,
    driverCheckedInAt: shift.driverCheckedInAt,
    driverLateMinutes,
    isDriverOverdue,
    isAttendantCheckedIn,
    attendantCheckedInAt: shift.attendantCheckedInAt,
    attendantLateMinutes,
    isAttendantOverdue,
    isCheckInOverdue,
    maxStopLateMinutes,
    hasStopDelay,
    maxLateMinutes,
    effectiveHealth,
    isMissingDriver,
    isMissingVehicle,
    isMissingCrewOrVehicle,
  };
}

/**
 * Returns all sent parent notification records for a shift.
 * Checks both the structured parentNotifications array and legacy notes entries.
 */
export function getSentParentNotifications(shift: DispatchShift): SentParentNotificationRecord[] {
  if (Array.isArray(shift.parentNotifications) && shift.parentNotifications.length > 0) {
    return shift.parentNotifications;
  }

  // Check if notes contains legacy [Parent Alert] entries
  const notes = `${shift.notes || ''} ${shift.payrollComments || ''}`;
  if (notes.includes('Parent Alert')) {
    const lines = notes.split('\n').filter((l) => l.includes('Parent Alert'));
    return lines.map((line, idx) => {
      const timeMatch = line.match(/\[(\d{1,2}:\d{2})\s*Parent Alert\]/i);
      const delayMatch = line.match(/\+(\d+)m/i);
      const reasonMatch = line.match(/\((.*?)\)/i);
      const countMatch = line.match(/to\s+(\d+)\s+parent/i);

      return {
        id: `legacy_${idx}_${shift.id}`,
        timestamp: shift.dispatchDate,
        timeStr: timeMatch ? timeMatch[1] : '--:--',
        reasonCategory: 'other',
        reasonLabel: reasonMatch ? reasonMatch[1] : 'Delay Alert',
        delayMinutes: delayMatch ? parseInt(delayMatch[1], 10) : 0,
        messageText: line.trim(),
        channels: ['sms', 'email'],
        recipientsCount: countMatch ? parseInt(countMatch[1], 10) : 1,
        scope: 'all',
      };
    });
  }

  return [];
}

