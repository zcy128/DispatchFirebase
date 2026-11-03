import { describe, expect, it, vi } from 'vitest';
import type { BusRouteShift } from '../types/route';
import type { School } from '../types/school';
import type { Student } from '../types/student';

vi.mock('./firebase', () => ({ db: null }));
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  updateDoc: async () => undefined,
}));
vi.mock('./routeService', () => ({
  RouteService: { updateShift: async () => undefined },
}));

import {
  assignStudentToRouteOrShiftLogic,
  doRunDaysOverlap,
  isDropoff,
  isPickup,
  isSchoolStop,
  parseRunDays,
  parseTimeToMinutes,
} from './stopAssignmentService';

const school: School = {
  id: 'SCH-001',
  schoolId: 1,
  schoolName: 'Hillcrest High School',
  schoolAddress: '1 Hillcrest Ave',
  schoolBoardId: 1,
  isActive: true,
  studentNum: 1,
  startTime: '08:30 AM',
  dismissalTime: '02:40 PM',
};

const student = {
  id: 'STU-0006',
  studentId: 6,
  studentNo: '0006',
  firstName: 'Benjamin',
  lastName: 'Johnson',
  studentName: 'Benjamin Johnson',
  fullName: 'Benjamin Johnson',
  studentAddress: '42 Maple Street',
  grade: '3',
  schoolId: 1,
  schoolName: 'Hillcrest High School',
} as Student;

function routeShift(partial: Partial<BusRouteShift>): BusRouteShift {
  return {
    id: 'SHIFT-AM',
    shiftId: 1,
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001',
    shiftType: 'AM',
    runDays: 'MTWRF',
    firstStopTime: '07:00',
    lastStopTime: '08:30',
    stops: [],
    ...partial,
  };
}

describe('run days and stop kinds', () => {
  it('treats Friday-only service as overlapping a full week and not a Monday-Thursday run', () => {
    expect([...parseRunDays('MTWRF')]).toEqual(['M', 'T', 'W', 'R', 'F']);
    expect([...parseRunDays('----F')]).toEqual(['F']);
    expect(doRunDaysOverlap('MTWRF', '----F')).toBe(true);
    expect(doRunDaysOverlap('MTWR-', '----F')).toBe(false);
  });

  it('parses bell times and classifies pickup, dropoff, and school stops', () => {
    expect(parseTimeToMinutes('7:10 a.m.')).toBe(430);
    expect(parseTimeToMinutes('2:40 p.m.')).toBe(880);
    expect(parseTimeToMinutes('12:00 a.m.')).toBe(0);
    expect(isPickup({ stopId: 1, sequence: 1, stopLocation: 'Home', pullawayTime: '07:10', stopType: 'HomePickup' })).toBe(true);
    expect(isDropoff({ stopId: 2, sequence: 2, stopLocation: 'School', pullawayTime: '08:30', stopType: 'School Dropoff' })).toBe(true);
    expect(isSchoolStop({ stopId: 2, sequence: 2, stopLocation: 'School', pullawayTime: '08:30', stopType: 'SchoolDropoff', schoolName: 'Hillcrest High School' })).toBe(true);
  });
});

describe('assignStudentToRouteOrShiftLogic', () => {
  it('refuses a route whose AM shifts share operating days', () => {
    const result = assignStudentToRouteOrShiftLogic(
      student,
      { type: 'route', routeId: 'RT-001', routeNo: 'OCDSB-001', label: 'Route 001' },
      [
        routeShift({ id: 'AM-1', shiftId: 1 }),
        routeShift({ id: 'AM-2', shiftId: 2, runDays: '----F' }),
      ],
      [school],
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Duplicate AM shifts detected on route.');
  });

  it('places a home pickup 28 minutes before the morning school bell', () => {
    const result = assignStudentToRouteOrShiftLogic(
      student,
      { type: 'shift', routeId: 'RT-001', routeNo: 'OCDSB-001', shiftId: 'SHIFT-AM', label: 'AM' },
      [routeShift({})],
      [school],
    );

    expect(result.success).toBe(true);
    expect(result.updatedShifts[0].stops.map((stop) => stop.stopType)).toEqual(['HomePickup', 'SchoolDropoff']);
    expect(result.updatedShifts[0].stops.map((stop) => stop.pullawayTime)).toEqual(['08:02', '08:30']);
    expect(result.generatedStudentStops.map((stop) => stop.type)).toEqual(['Pickup', 'School Dropoff']);
  });

  it('places a home dropoff 28 minutes after the afternoon school bell', () => {
    const result = assignStudentToRouteOrShiftLogic(
      student,
      { type: 'shift', routeId: 'RT-001', routeNo: 'OCDSB-001', shiftId: 'SHIFT-PM', label: 'PM' },
      [routeShift({ id: 'SHIFT-PM', shiftId: 2, shiftType: 'PM', firstStopTime: '14:40', lastStopTime: '16:10' })],
      [school],
    );

    expect(result.success).toBe(true);
    expect(result.updatedShifts[0].stops.map((stop) => stop.stopType)).toEqual(['SchoolPickup', 'HomeDropoff']);
    expect(result.updatedShifts[0].stops.map((stop) => stop.pullawayTime)).toEqual(['14:40', '15:08']);
  });

  it('reports a missing shift instead of creating stops', () => {
    const result = assignStudentToRouteOrShiftLogic(
      student,
      { type: 'shift', routeId: 'RT-001', routeNo: 'OCDSB-001', shiftId: 'missing', label: 'AM' },
      [routeShift({})],
      [school],
    );

    expect(result.success).toBe(false);
    expect(result.updatedShifts).toEqual([]);
  });
});
