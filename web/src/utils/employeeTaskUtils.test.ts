import { describe, expect, it } from 'vitest';
import { CharterTrip } from '../types/charter';
import { DispatchShift } from '../types/dispatch';
import { Employee } from '../types/employee';
import {
  buildEmployeeTaskIndex,
  extractCharterTimeWindow,
  formatEmployeeTaskShortLabel,
  formatEmployeeTasksOptionSuffix,
  getEmployeeDayTasks,
} from './employeeTaskUtils';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp-1',
  employeeId: 101,
  employeeNumber: 'DRV-101',
  firstName: 'Alice',
  lastName: 'Martin',
  fullName: 'Alice Martin',
  jobPosition: 'Driver',
  isActive: true,
  ...overrides,
});

const makeShift = (overrides: Partial<DispatchShift> = {}): DispatchShift => ({
  id: 'shift-am-1',
  dispatchDate: '2026-11-11',
  routeId: '10',
  routeNo: 'R-101',
  routeName: 'Route 101',
  shiftType: 'AM',
  driverId: 'emp-1',
  driverName: 'Alice Martin',
  unitNumber: '205',
  firstStopTime: '07:15',
  lastStopTime: '08:45',
  totalStops: 5,
  completedStops: 0,
  lateMinutes: 0,
  health: 'green',
  stops: [],
  ...overrides,
});

const makeCharterTrip = (overrides: Partial<CharterTrip> = {}): CharterTrip => ({
  id: 'trip-1',
  tripNumber: 'CHR-2026-009',
  charterClientId: 'client-1',
  clientName: 'St. Mary School',
  title: 'Science Museum Trip',
  tripType: 0,
  status: 2,
  dispatchDate: '2026-11-11',
  departsAt: '2026-11-11T09:00',
  returnsAt: '2026-11-11T14:30',
  passengerCount: 40,
  needsAttendant: false,
  roundTrip: true,
  stops: [],
  assignments: [
    {
      id: 'asg-1',
      charterTripId: 'trip-1',
      vehicleId: 12,
      vehicleUnitNumber: '312',
      driverId: 'DRV-101', // employeeNumber format used by Charter modal
      driverName: 'Alice Martin',
      driverPayRate: 150,
      driverEiHours: 5,
      attendantPayRate: 100,
      attendantEiHours: 5,
      status: 0,
      isDriverCheckedIn: false,
      isAttendantCheckedIn: false,
    },
  ],
  createdAt: '2026-11-10T10:00:00Z',
  updatedAt: '2026-11-10T10:00:00Z',
  ...overrides,
});

describe('employeeTaskUtils', () => {
  it('collects both Dispatch shifts and Charter assignments on the target date across ID variants', () => {
    const emp = makeEmployee();
    const index = buildEmployeeTaskIndex({
      targetDate: '2026-11-11',
      dispatchShifts: [
        makeShift(),
        makeShift({
          id: 'shift-other-day',
          dispatchDate: '2026-11-12',
          routeNo: 'R-999',
        }),
      ],
      charterTrips: [makeCharterTrip()],
      windowStartTime: '08:00',
      windowEndTime: '10:00',
    });

    const tasks = getEmployeeDayTasks(emp, index);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      source: 'dispatch',
      role: 'driver',
      title: 'R-101',
      subtitle: 'AM',
      startTime: '07:15',
      endTime: '08:45',
      isOverlap: true, // 07:15-08:45 overlaps 08:00-10:00
    });
    expect(tasks[1]).toMatchObject({
      source: 'charter',
      role: 'driver',
      title: 'CHR-2026-009',
      startTime: '09:00',
      endTime: '14:30',
      isOverlap: true, // 09:00-14:30 overlaps 08:00-10:00
    });
  });

  it('excludes current dispatch shift or editing charter assignment and cancelled charter trips/assignments', () => {
    const emp = makeEmployee();
    const index = buildEmployeeTaskIndex({
      targetDate: '2026-11-11',
      dispatchShifts: [
        makeShift({ id: 'current-shift' }),
        makeShift({
          id: 'pm-shift',
          routeNo: 'R-101',
          shiftType: 'PM',
          firstStopTime: '14:45',
          lastStopTime: '16:15',
          driverId: '',
          driverName: '',
          attendantId: 'emp-1',
          attendantName: 'Alice Martin',
        }),
      ],
      charterTrips: [
        makeCharterTrip({
          id: 'trip-editing',
          assignments: [
            {
              id: 'asg-editing',
              charterTripId: 'trip-editing',
              vehicleId: 12,
              vehicleUnitNumber: '312',
              driverId: 'emp-1',
              driverName: 'Alice Martin',
              driverPayRate: 150,
              driverEiHours: 5,
              attendantPayRate: 100,
              attendantEiHours: 5,
              status: 0,
              isDriverCheckedIn: false,
              isAttendantCheckedIn: false,
            },
          ],
        }),
        makeCharterTrip({ id: 'trip-cancelled', status: 5 }),
      ],
      excludeDispatchShiftId: 'current-shift',
      excludeCharterAssignmentId: 'asg-editing',
      windowStartTime: '07:15',
      windowEndTime: '08:45',
    });

    const tasks = getEmployeeDayTasks(emp, index);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: 'pm-shift',
      source: 'dispatch',
      role: 'attendant',
      subtitle: 'PM',
      isOverlap: false,
    });
  });

  it('handles multi-day charter date span and formats English/French option labels', () => {
    const multiDayTrip = makeCharterTrip({
      dispatchDate: '2026-11-10',
      departsAt: '2026-11-10T08:00',
      returnsAt: '2026-11-12T17:00',
    });

    expect(extractCharterTimeWindow(multiDayTrip, '2026-11-11')).toEqual({
      startTime: '00:00',
      endTime: '23:59',
    });

    const emp = makeEmployee({ id: 'emp-name-only', employeeId: undefined, employeeNumber: '' });
    const index = buildEmployeeTaskIndex({
      targetDate: '2026-11-11',
      dispatchShifts: [
        makeShift({
          driverId: '',
          driverName: 'Alice Martin',
        }),
      ],
      charterTrips: [
        makeCharterTrip({
          ...multiDayTrip,
          assignments: [
            {
              ...multiDayTrip.assignments[0],
              driverId: '',
              driverName: 'Alice Martin',
            },
          ],
        }),
      ],
      windowStartTime: '14:00',
      windowEndTime: '16:00',
    });

    const tasks = getEmployeeDayTasks(emp, index);
    expect(tasks).toHaveLength(2);
    expect(formatEmployeeTaskShortLabel(tasks[0], false)).toBe('Charter: CHR-2026-009 (00:00-23:59)');
    expect(formatEmployeeTaskShortLabel(tasks[0], true)).toBe('Nolisement: CHR-2026-009 (00:00-23:59)');
    expect(formatEmployeeTasksOptionSuffix(tasks, false)).toBe(
      '⚠ Charter: CHR-2026-009 (00:00-23:59); Dispatch: R-101 AM (07:15-08:45)'
    );
  });
});
