import { describe, expect, it } from 'vitest';
import { BusRoute, BusRouteShift } from '../types/route';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import {
  buildFixedShiftStopsForMissingSchoolStudents,
  matchesRouteAuditFilter,
  runRouteAudit,
} from './routeAuditUtils';

const makeRoute = (overrides: Partial<BusRoute>): BusRoute => ({
  id: 'RT-1',
  busRouteId: 1,
  routeNo: 'OCDSB-001',
  routeName: 'Route 1',
  active: true,
  schoolBoardId: 1,
  schoolBoardCode: 'OCDSB',
  yardId: 1,
  yardName: 'HQ',
  driverId: 'EMP-1',
  driverName: 'Alice',
  vehicleId: 101,
  unitNumber: '1001',
  totalStops: 2,
  totalStudents: 1,
  ...overrides,
});

const makeShift = (overrides: Partial<BusRouteShift>): BusRouteShift => ({
  id: 'SH-1',
  shiftId: 1,
  routeId: 'RT-1',
  routeNo: 'OCDSB-001',
  routeName: 'Route 1',
  shiftType: 'AM',
  runDays: 'MTWRF',
  firstStopTime: '07:00',
  lastStopTime: '07:45',
  stops: [],
  ...overrides,
});

describe('routeAuditUtils', () => {
  const today = '2026-11-17';

  it('detects empty stops and school/home stop mismatches', () => {
    const route = makeRoute({});
    const shift = makeShift({
      stops: [
        {
          stopId: 1,
          sequence: 1,
          stopLocation: '100 Main St',
          pullawayTime: '07:10',
          stopType: 'HomePickup',
          assignedStudents: [{ studentId: 10, studentNo: 'S10', studentName: 'Leo' }],
        },
        {
          stopId: 2,
          sequence: 2,
          stopLocation: '200 Empty Rd',
          pullawayTime: '07:15',
          stopType: 'HomePickup',
          assignedStudents: [],
        },
        {
          stopId: 3,
          sequence: 3,
          stopLocation: 'Maple School',
          pullawayTime: '07:35',
          stopType: 'SchoolDropoff',
          schoolId: 5,
          assignedStudents: [{ studentId: 20, studentNo: 'S20', studentName: 'Mia' }],
        },
      ],
    });

    const summary = runRouteAudit({ routes: [route], shifts: [shift], todayStr: today });
    const res = summary.byRouteId.get('RT-1')!;
    expect(res.issues.some((i) => i.type === 'EMPTY_STOP')).toBe(true);
    expect(res.issues.filter((i) => i.type === 'SCHOOL_STOP_MISSING_STUDENT')).toHaveLength(1);
    expect(res.issues.filter((i) => i.type === 'SCHOOL_STOP_MISMATCH')).toHaveLength(1);

    const fixedStops = buildFixedShiftStopsForMissingSchoolStudents(shift, [10], undefined, today);
    expect(fixedStops).not.toBeNull();
    const fixedShift = makeShift({ stops: fixedStops! });
    const afterFix = runRouteAudit({ routes: [route], shifts: [fixedShift], todayStr: today });
    expect(afterFix.byRouteId.get('RT-1')!.issues.filter((i) => i.type === 'SCHOOL_STOP_MISSING_STUDENT')).toHaveLength(0);
  });

  it('recognizes school stop by address and avoids flagging empty school stop as EMPTY_STOP when home students exist', () => {
    const route = makeRoute({});
    const shift = makeShift({
      stops: [
        {
          stopId: 1,
          sequence: 1,
          stopLocation: '100 Main St',
          pullawayTime: '07:10',
          stopType: 'HomePickup',
          assignedStudents: [{ studentId: 10, studentNo: 'S10', studentName: 'Leo' }],
        },
        {
          stopId: 2,
          sequence: 2,
          stopLocation: '8063 Oak St, Kanata, ON',
          pullawayTime: '07:40',
          stopType: 'Dropoff',
          assignedStudents: [],
        },
      ],
    });

    const summary = runRouteAudit({
      routes: [route],
      shifts: [shift],
      schools: [{ schoolId: 9, schoolName: 'Kanata PS', schoolAddress: '8063 Oak St, Kanata, ON' } as any],
      todayStr: today,
    });
    const res = summary.byRouteId.get('RT-1')!;
    expect(res.issues.some((i) => i.type === 'EMPTY_STOP')).toBe(false);
    expect(res.issues.filter((i) => i.type === 'SCHOOL_STOP_MISSING_STUDENT')).toHaveLength(1);

    // Even when a shift has no home-stop students at all, a school stop should never be flagged as EMPTY_STOP
    const schoolOnlyShift = makeShift({
      stops: [
        {
          stopId: 2,
          sequence: 1,
          stopLocation: '8063 Oak St, Kanata, ON',
          pullawayTime: '07:40',
          stopType: 'SchoolDropoff',
          assignedStudents: [],
        },
      ],
    });
    const schoolOnlySummary = runRouteAudit({ routes: [route], shifts: [schoolOnlyShift], todayStr: today });
    expect(schoolOnlySummary.byRouteId.get('RT-1')!.issues.some((i) => i.type === 'EMPTY_STOP')).toBe(false);
  });

  it('detects duplicate student in route and respects ignoredDuplicateStudentIds', () => {
    const shift = makeShift({
      stops: [
        {
          stopId: 1,
          sequence: 1,
          stopLocation: 'Dad House',
          pullawayTime: '07:10',
          stopType: 'HomePickup',
          assignedStudents: [{ studentId: 10, studentNo: 'S10', studentName: 'Leo' }],
        },
        {
          stopId: 2,
          sequence: 2,
          stopLocation: 'Mom House',
          pullawayTime: '07:20',
          stopType: 'HomePickup',
          assignedStudents: [{ studentId: 10, studentNo: 'S10', studentName: 'Leo' }],
        },
        {
          stopId: 3,
          sequence: 3,
          stopLocation: 'School',
          pullawayTime: '07:35',
          stopType: 'SchoolDropoff',
          schoolId: 5,
          assignedStudents: [{ studentId: 10, studentNo: 'S10', studentName: 'Leo' }],
        },
      ],
    });

    const routeFlagged = makeRoute({});
    const s1 = runRouteAudit({ routes: [routeFlagged], shifts: [shift], todayStr: today });
    expect(s1.byRouteId.get('RT-1')!.issues.some((i) => i.type === 'DUPLICATE_STUDENT_IN_ROUTE')).toBe(true);

    const routeIgnored = makeRoute({ ignoredDuplicateStudentIds: [10] });
    const s2 = runRouteAudit({ routes: [routeIgnored], shifts: [shift], todayStr: today });
    expect(s2.byRouteId.get('RT-1')!.issues.some((i) => i.type === 'DUPLICATE_STUDENT_IN_ROUTE')).toBe(false);
    expect(s2.byRouteId.get('RT-1')!.ignoredIssues).toHaveLength(1);
  });

  it('detects cross-shift duplicate student on same day while skipping future effectiveDate stops', () => {
    const r1 = makeRoute({ id: 'RT-1', routeNo: 'R1' });
    const r2 = makeRoute({ id: 'RT-2', routeNo: 'R2', driverId: 'EMP-2', driverName: 'Bob', vehicleId: 102, unitNumber: '1002' });

    const sh1 = makeShift({
      id: 'SH-1',
      routeId: 'RT-1',
      routeNo: 'R1',
      stops: [
        {
          stopId: 1,
          sequence: 1,
          stopLocation: 'Stop A',
          pullawayTime: '07:10',
          stopType: 'HomePickup',
          assignedStudents: [{ studentId: 99, studentNo: 'S99', studentName: 'Sam' }],
        },
      ],
    });

    const sh2Future = makeShift({
      id: 'SH-2',
      routeId: 'RT-2',
      routeNo: 'R2',
      stops: [
        {
          stopId: 2,
          sequence: 1,
          stopLocation: 'Stop B',
          pullawayTime: '07:10',
          stopType: 'HomePickup',
          effectiveDate: '2026-11-18', // Tomorrow -> should NOT trigger today
          assignedStudents: [{ studentId: 99, studentNo: 'S99', studentName: 'Sam' }],
        },
      ],
    });

    const sFuture = runRouteAudit({ routes: [r1, r2], shifts: [sh1, sh2Future], todayStr: today });
    expect(sFuture.counts.CROSS_SHIFT_DUPLICATE_STUDENT).toBe(0);

    const sh2Active = {
      ...sh2Future,
      stops: [{ ...sh2Future.stops[0], effectiveDate: '2026-11-17' }],
    };
    const sActive = runRouteAudit({ routes: [r1, r2], shifts: [sh1, sh2Active], todayStr: today });
    expect(sActive.counts.CROSS_SHIFT_DUPLICATE_STUDENT).toBe(2);
  });

  it('flags multi-route crew/vehicle for quick filter without error when times do not overlap, and flags when times overlap', () => {
    const r1 = makeRoute({ id: 'RT-1', routeNo: 'R1', driverId: 'EMP-1', driverName: 'Alice', unitNumber: '1001' });
    const r2 = makeRoute({ id: 'RT-2', routeNo: 'R2', driverId: 'EMP-1', driverName: 'Alice', unitNumber: '1001' });

    const sh1 = makeShift({ id: 'SH-1', routeId: 'RT-1', routeNo: 'R1', firstStopTime: '07:00', lastStopTime: '07:45' });
    const sh2NonOverlap = makeShift({ id: 'SH-2', routeId: 'RT-2', routeNo: 'R2', firstStopTime: '08:00', lastStopTime: '08:30' });

    const sNonOverlap = runRouteAudit({ routes: [r1, r2], shifts: [sh1, sh2NonOverlap], todayStr: today });
    expect(sNonOverlap.counts.MULTI_ROUTE_TIME_CONFLICT).toBe(0);
    expect(sNonOverlap.counts.MULTI_ROUTE_SHARED).toBe(2);
    expect(matchesRouteAuditFilter('RT-1', sNonOverlap, 'MULTI_ROUTE_SHARED')).toBe(true);

    const sh2Overlap = makeShift({ id: 'SH-2', routeId: 'RT-2', routeNo: 'R2', firstStopTime: '07:30', lastStopTime: '08:15' });
    const sOverlap = runRouteAudit({ routes: [r1, r2], shifts: [sh1, sh2Overlap], todayStr: today });
    expect(sOverlap.counts.MULTI_ROUTE_TIME_CONFLICT).toBe(2);
  });

  it('detects inactive assigned driver or vehicle', () => {
    const route = makeRoute({ driverId: 'EMP-1', driverName: 'Alice', vehicleId: 101, unitNumber: '1001' });
    const employees = [{ id: 'EMP-1', fullName: 'Alice', isActive: false } as Employee];
    const vehicles = [{ id: 'VEH-101', vehicleId: 101, unitNumber: '1001', active: false, status: 'Out of Service' } as Vehicle];

    const summary = runRouteAudit({ routes: [route], shifts: [], employees, vehicles, todayStr: today });
    expect(summary.byRouteId.get('RT-1')!.issues.filter((i) => i.type === 'INACTIVE_CREW_OR_VEHICLE')).toHaveLength(2);
  });
});
