import { describe, expect, it } from 'vitest';
import { StagingRoute } from '../services/busplannerService';
import { buildRouteSheetPdf, sortRouteSheetShifts, studentSheetLines } from './routeSheetPdf';
import { isStagingSchoolDropoff, stagingRouteToSheetInput } from './stagingRouteSheet';

function sampleRoute(): StagingRoute {
  return {
    id: '0400',
    routeNo: 'CBE-0400',
    routeName: 'Emily Follensbee',
    operatorId: 'OP-1',
    active: true,
    totalStops: 4,
    totalStudents: 1,
    shifts: [
      {
        id: '0400-PM',
        shiftType: 'PM',
        runDays: '----F',
        description: 'Afternoon',
        schools: 'Emily Follensbee',
        instruction: 'Meet the attendant',
        firstStopTime: '15:10',
        lastStopTime: '15:45',
        stopCount: 2,
        studentCount: 1,
        stops: [
          {
            id: 'pm-school',
            sequence: 1,
            location: 'Emily Follensbee School',
            time: '15:10',
            stopType: 'School',
            students: [],
          },
          {
            id: 'pm-home',
            sequence: 2,
            location: '12 Home Street',
            time: '15:45',
            stopType: 'Home',
            students: [{ id: 'maya', name: 'Maya Mitica', grade: '3', schoolName: 'Emily Follensbee' }],
          },
        ],
      },
      {
        id: '0400-AM',
        shiftType: 'AM',
        runDays: 'MTWRF',
        description: 'Morning',
        schools: 'Emily Follensbee',
        instruction: '',
        firstStopTime: '07:20',
        lastStopTime: '08:05',
        stopCount: 2,
        studentCount: 1,
        stops: [
          {
            id: 'am-home',
            sequence: 1,
            location: '12 Home Street',
            time: '07:20',
            stopType: 'Home',
            students: [{ id: 'maya', name: 'Maya Mitica', grade: '3', schoolName: 'Emily Follensbee' }],
          },
          {
            id: 'am-school',
            sequence: 2,
            location: 'Emily Follensbee School',
            time: '08:05',
            stopType: 'School',
            students: [],
          },
        ],
      },
    ],
  };
}

describe('staging route sheet', () => {
  it('treats a home-then-school run as a school dropoff and the reverse as a pickup', () => {
    const route = sampleRoute();
    expect(isStagingSchoolDropoff(route.shifts[1].stops)).toBe(true);
    expect(isStagingSchoolDropoff(route.shifts[0].stops)).toBe(false);

    const input = stagingRouteToSheetInput(route);
    const ordered = sortRouteSheetShifts(input.shifts);
    expect(ordered.map((shift) => shift.id)).toEqual(['0400-AM', '0400-PM']);
    expect(ordered[0].stops.map((stop) => stop.stopType)).toEqual(['HomePickup', 'SchoolDropoff']);
    expect(ordered[1].stops.map((stop) => stop.stopType)).toEqual(['SchoolPickup', 'HomeDropoff']);

    const student = Object.values(input.studentsMap)[0];
    expect(studentSheetLines(student, 'Maya Mitica').map((line) => line.text)).toEqual([
      'Mitica, Maya',
      'Equip: No',
      'Grade 3',
      'Emily Follensbee',
    ]);

    const doc = buildRouteSheetPdf(input);
    expect(doc.getNumberOfPages()).toBe(2);
  });
});