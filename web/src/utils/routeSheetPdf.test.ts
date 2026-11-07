import { describe, expect, it } from 'vitest';
import { BusRoute, BusRouteShift } from '../types/route';
import { Student } from '../types/student';
import {
  boardCountsForStops,
  buildRouteSheetPdf,
  formatRouteSheetClock,
  sortRouteSheetShifts,
  collectAssignedStudentIds,
  isSchoolStop,
  routeSheetStopHeading,
  studentHasContactDetails,
  studentSheetColumns,
  studentSheetLines,
} from './routeSheetPdf';

describe('route sheet PDF', () => {
  it('keeps the bus load the way a CCSD route sheet does', () => {
    const loads = boardCountsForStops([
      { stopType: 'HomePickup', studentCount: 1 },
      { stopType: 'HomePickup', studentCount: 1 },
      { stopType: 'HomePickup', studentCount: 1 },
      { stopType: 'SchoolDropoff', studentCount: 3 },
    ]);
    expect(loads.map((load) => [load.stopLoad, load.runLoad])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [3, 0],
    ]);
  });

  it('empties the bus at a school drop when riders are not listed again', () => {
    const loads = boardCountsForStops([
      { stopType: 'HomePickup', studentCount: 2 },
      { stopType: 'SchoolDropoff', studentCount: 0 },
    ]);
    expect(loads[1]).toEqual({ stopLoad: 2, runLoad: 0 });
  });

  it('formats clock times like the printed route sheet', () => {
    expect(formatRouteSheetClock('07:34:00')).toBe('7:34 AM');
    expect(formatRouteSheetClock('14:38')).toBe('2:38 PM');
    expect(formatRouteSheetClock('3:10 PM')).toBe('3:10 PM');
  });

  it('adds guardian, equipment, and care notes from the student record', () => {
    const student: Student = {
      id: 'STU-1',
      studentId: 1,
      studentNo: '01',
      firstName: 'Maya',
      lastName: 'Mitica',
      studentName: 'Maya Mitica',
      fullName: 'Maya Mitica',
      studentAddress: '242 CRAMOND CT SE; CALGARY',
      studentPhone: '(587) 578-5577',
      grade: '4',
      active: true,
      metatBus: true,
      equipments: 'Attendant, Wheelchair',
      studentDispatchNotes: 'Wheelchair securement required.',
      schoolId: 40,
      schoolName: 'Emily Follensbee School',
      contacts: [
        {
          contactId: 'c1',
          studentId: 1,
          contactIndex: 1,
          primaryContact: true,
          contactName: 'Dorina Florentina Mitica',
          mobilePhone: '(587) 578-5577',
          homePhone: '(403) 555-0100',
          active: true,
        },
        {
          contactId: 'c2',
          studentId: 1,
          contactIndex: 2,
          primaryContact: false,
          contactName: 'Romica Iuda',
          mobilePhone: '(403) 888-8379',
          active: true,
        },
      ],
    };

    const columns = studentSheetColumns(student, 'Maya');
    const left = columns.left.map((line) => line.text);
    const right = columns.right.map((line) => line.text);
    expect(left).toContain('Mitica, Maya');
    expect(left).toContain('Emily Follensbee School');
    expect(left).toContain('Grade 4');
    expect(left).toContain('Equip: Attendant, Wheelchair');
    expect(left.some((line) => line.includes('Wheelchair securement required.'))).toBe(true);
    expect(right).toContain('Guardian #1');
    expect(right).toContain('(587) 578-5577 (403) 555-0100 Dorina Florentina Mitica');
    expect(right).toContain('Guardian #2');
    expect(right).toContain('(403) 888-8379 Romica Iuda');
    expect(studentSheetLines(student, 'Maya').map((line) => line.text)).toEqual([...left, ...right]);
  });

  it('labels school stops with the school name and a school kind badge', () => {
    expect(isSchoolStop('SchoolDropoff')).toBe(true);
    expect(isSchoolStop('HomePickup')).toBe(false);
    expect(
      routeSheetStopHeading({
        stopType: 'SchoolDropoff',
        schoolName: 'Emily Follensbee School',
        stopLocation: '1715 17 AV SE; CALGARY',
      }),
    ).toEqual({
      isSchool: true,
      kindLabel: 'SCHOOL DROPOFF',
      title: 'Emily Follensbee School',
      detail: '1715 17 AV SE; CALGARY',
    });
    expect(
      routeSheetStopHeading({
        stopType: 'HomePickup',
        schoolName: 'Emily Follensbee School',
        stopLocation: '242 CRAMOND CT SE',
      }),
    ).toEqual({
      isSchool: false,
      title: '242 CRAMOND CT SE',
    });
  });

  it('knows when a rider still needs a master record for guardian lines', () => {
    expect(studentHasContactDetails(undefined)).toBe(false);
    expect(
      studentHasContactDetails({
        id: 'STU-1',
        studentId: 1,
        studentNo: '1',
        firstName: 'Maya',
        lastName: 'Mitica',
        studentName: 'Maya Mitica',
        fullName: 'Maya Mitica',
        studentAddress: '',
        grade: '4',
        active: true,
        metatBus: false,
        schoolId: 1,
        schoolName: 'School',
      }),
    ).toBe(false);
    expect(collectAssignedStudentIds([
      {
        id: 's1',
        shiftId: 1,
        routeId: 'r1',
        routeNo: 'CBE-0400',
        routeName: 'Test',
        shiftType: 'AM',
        runDays: 'MTWRF',
        stops: [
          {
            stopId: 1,
            sequence: 1,
            stopLocation: 'Home',
            pullawayTime: '07:00',
            stopType: 'HomePickup',
            assignedStudents: [{ studentId: 11, studentName: 'A' }, { studentId: 22, studentName: 'B' }],
          },
        ],
      } as BusRouteShift,
    ])).toEqual([11, 22]);
  });

  it('starts each shift on a new page', () => {
    const route = {
      id: 'RT-0400',
      routeNo: 'CBE-0400',
      routeName: 'Emily Follensbee',
      yardName: 'CBE',
    } as BusRoute;
    const shift = (shiftType: string): BusRouteShift => ({
      id: shiftType,
      shiftId: shiftType === 'AM' ? 1 : 2,
      routeId: route.id,
      routeNo: route.routeNo,
      routeName: route.routeName,
      shiftType,
      runDays: 'MTWRF',
      firstStopTime: '07:34',
      lastStopTime: '08:30',
      stops: [],
    });
    const doc = buildRouteSheetPdf({
      route,
      shifts: [shift('AM'), shift('PM')],
      studentsMap: {},
    });
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('treats a school dropoff as AM and every other run as PM, then sorts by weekday', () => {
    const ordered = sortRouteSheetShifts([
      {
        shiftType: 'AM',
        runDays: '----F',
        firstStopTime: '07:10',
        stops: [{ stopType: 'SchoolPickup' }],
      },
      {
        shiftType: 'NOON',
        runDays: 'MTWRF',
        firstStopTime: '11:00',
        stops: [{ stopType: 'School Dropoff' }],
      },
      {
        shiftType: 'PM',
        runDays: 'MTWRF',
        firstStopTime: '15:00',
        stops: [{ stopType: 'HomeDropoff' }, { stopType: 'SchoolPickup' }],
      },
      {
        shiftType: 'PM',
        runDays: '----F',
        firstStopTime: '12:05',
        stops: [{ stopType: 'SchoolPickup' }],
      },
      {
        shiftType: 'EARLY',
        runDays: 'MTWRF',
        firstStopTime: '07:34',
        stops: [{ stopType: 'HomePickup' }, { stopType: 'SchoolDropoff' }],
      },
    ]);
    expect(ordered.map((shift) => shift.firstStopTime)).toEqual([
      '07:34',
      '11:00',
      '15:00',
      '07:10',
      '12:05',
    ]);
  });
});
