import { describe, expect, it } from 'vitest';
import {
  checkDriverShiftConflict,
  checkDriverTimeOffConflict,
  checkVehicleConflict,
  doIntervalsOverlap,
  parseClockToMinutes,
  ScheduledShift,
  TimeOffRecord,
} from './dispatchConflictDetector';

describe('parseClockToMinutes', () => {
  it('converts HH:mm to minutes from midnight', () => {
    expect(parseClockToMinutes('00:00')).toBe(0);
    expect(parseClockToMinutes('07:30')).toBe(450);
    expect(parseClockToMinutes('14:45')).toBe(885);
    expect(parseClockToMinutes('23:59')).toBe(1439);
    expect(parseClockToMinutes('')).toBe(0);
  });
});

describe('doIntervalsOverlap', () => {
  it('detects partial and full overlapping time ranges', () => {
    expect(doIntervalsOverlap('07:00', '08:30', '08:00', '09:00')).toBe(true);
    expect(doIntervalsOverlap('07:00', '09:00', '07:30', '08:30')).toBe(true);
  });

  it('allows back-to-back non-overlapping shifts where end equals next start', () => {
    expect(doIntervalsOverlap('07:00', '08:30', '08:30', '10:00')).toBe(false);
    expect(doIntervalsOverlap('14:00', '15:30', '08:00', '09:30')).toBe(false);
  });

  it('returns false for invalid start/end sequences', () => {
    expect(doIntervalsOverlap('09:00', '08:00', '07:00', '10:00')).toBe(false);
  });
});

describe('checkDriverShiftConflict', () => {
  const shifts: ScheduledShift[] = [
    {
      id: 'shift-101',
      dispatchDate: '2026-11-03',
      routeNo: 'OCDSB-001',
      shiftType: 'AM',
      driverId: 'EMP-1001',
      driverName: 'Alice Smith',
      startTime: '07:00',
      endTime: '08:30',
    },
    {
      id: 'shift-102',
      dispatchDate: '2026-11-03',
      routeNo: 'OCDSB-002',
      shiftType: 'PM',
      driverId: 'EMP-1001',
      driverName: 'Alice Smith',
      startTime: '14:30',
      endTime: '16:00',
    },
  ];

  it('detects driver conflict when another assignment overlaps on the same day', () => {
    const result = checkDriverShiftConflict(
      'EMP-1001',
      '2026-11-03',
      '08:00',
      '09:30',
      shifts
    );
    expect(result.hasConflict).toBe(true);
    expect(result.reason).toBe('driver_overlap');
    expect(result.conflictingShiftId).toBe('shift-101');
    expect(result.messageEn).toContain('already assigned to OCDSB-001');
  });

  it('allows assigning non-overlapping shift on same day', () => {
    const result = checkDriverShiftConflict(
      'EMP-1001',
      '2026-11-03',
      '09:00',
      '11:00',
      shifts
    );
    expect(result.hasConflict).toBe(false);
  });

  it('allows updating an existing shift without self-conflict', () => {
    const result = checkDriverShiftConflict(
      'EMP-1001',
      '2026-11-03',
      '07:00',
      '08:30',
      shifts,
      'shift-101' // Exclude self
    );
    expect(result.hasConflict).toBe(false);
  });
});

describe('checkVehicleConflict', () => {
  const shifts: ScheduledShift[] = [
    {
      id: 'shift-v1',
      dispatchDate: '2026-11-03',
      routeNo: 'OCDSB-001',
      shiftType: 'AM',
      vehicleUnit: 'BUS-42',
      startTime: '07:00',
      endTime: '08:30',
    },
  ];

  it('detects vehicle double-booking on overlapping shift hours', () => {
    const result = checkVehicleConflict('BUS-42', '2026-11-03', '08:00', '09:00', shifts);
    expect(result.hasConflict).toBe(true);
    expect(result.reason).toBe('vehicle_overlap');
    expect(result.messageEn).toContain('Vehicle #BUS-42 is already assigned');
  });

  it('allows vehicle assignment on non-overlapping hours or different days', () => {
    expect(checkVehicleConflict('BUS-42', '2026-11-03', '08:30', '10:00', shifts).hasConflict).toBe(false);
    expect(checkVehicleConflict('BUS-42', '2026-11-04', '07:00', '08:30', shifts).hasConflict).toBe(false);
  });
});

describe('checkDriverTimeOffConflict', () => {
  const timeOffRecords: TimeOffRecord[] = [
    {
      id: 'leave-1',
      employeeId: 'EMP-1001',
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      status: 'approved',
      type: 'Medical Leave',
    },
    {
      id: 'leave-2',
      employeeId: 'EMP-1002',
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      status: 'pending', // Not yet approved
      type: 'Vacation',
    },
  ];

  it('blocks shift assignment if driver has approved time-off spanning the date', () => {
    const conflict = checkDriverTimeOffConflict('EMP-1001', '2026-11-04', timeOffRecords);
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.reason).toBe('driver_time_off');
    expect(conflict.messageEn).toContain('approved time-off (Medical Leave)');
  });

  it('does not block shift for pending or unapproved leaves', () => {
    const conflict = checkDriverTimeOffConflict('EMP-1002', '2026-11-04', timeOffRecords);
    expect(conflict.hasConflict).toBe(false);
  });

  it('does not block shift outside the leave date range', () => {
    const conflict = checkDriverTimeOffConflict('EMP-1001', '2026-11-10', timeOffRecords);
    expect(conflict.hasConflict).toBe(false);
  });
});
