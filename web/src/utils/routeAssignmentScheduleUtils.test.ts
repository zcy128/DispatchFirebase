import { describe, expect, it } from 'vitest';
import { buildRouteScheduleSummary } from './routeAssignmentScheduleUtils';
import { BusRoute, BusRouteShift } from '../types/route';
import { TemporaryAssignment } from '../types/dispatch';
import { RouteOpening } from '../types/routeOpening';

const baseRoute: BusRoute = {
  id: 'RT-101',
  busRouteId: 101,
  routeNo: 'OCDSB-101',
  routeName: 'Kanata North AM/PM',
  active: true,
  schoolBoardId: 1,
  schoolBoardCode: 'OCDSB',
  yardId: 1,
  yardName: 'North Yard',
  driverId: 'EMP-001',
  driverName: 'Alice Driver',
  unitNumber: '204',
  attendantId: 'EMP-010',
  attendantName: 'Bob Attendant',
  totalStops: 8,
  totalStudents: 22,
};

describe('buildRouteScheduleSummary', () => {
  it('classifies active and upcoming temporary assignments including specificDates', () => {
    const temporaryAssignments: TemporaryAssignment[] = [
      {
        id: 'TA-PAST',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        shiftType: 'ALL',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        temporaryDriverId: 'EMP-002',
        temporaryDriverName: 'Past Sub',
        reason: 'Sick Leave',
        status: 'active',
      },
      {
        id: 'TA-CANCELLED',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        shiftType: 'ALL',
        startDate: '2026-11-20',
        endDate: '2026-11-20',
        temporaryDriverId: 'EMP-002',
        temporaryDriverName: 'Cancelled Sub',
        reason: 'Other',
        status: 'cancelled',
      },
      {
        id: 'TA-NEXT-FRI',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        shiftType: 'PM',
        startDate: '2026-11-20',
        endDate: '2026-11-20',
        specificDates: ['2026-11-20'],
        originalDriverName: 'Alice Driver',
        temporaryDriverId: 'EMP-003',
        temporaryDriverName: 'Charlie Relief',
        reason: 'Medical Appointment',
        status: 'active',
      },
      {
        id: 'TA-TODAY',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        shiftType: 'AM',
        startDate: '2026-11-11',
        endDate: '2026-11-13',
        originalAttendantName: 'Bob Attendant',
        temporaryAttendantId: 'EMP-011',
        temporaryAttendantName: 'Dana Monitor',
        reason: 'Vacation',
        status: 'active',
      },
    ];

    const summary = buildRouteScheduleSummary({
      route: baseRoute,
      temporaryAssignments,
      routeOpenings: [],
      todayStr: '2026-11-12',
    });

    expect(summary.temporaryCovers).toHaveLength(2);
    expect(summary.temporaryCovers[0].assignment.id).toBe('TA-TODAY');
    expect(summary.temporaryCovers[0].phase).toBe('active_now');
    expect(summary.temporaryCovers[1].assignment.id).toBe('TA-NEXT-FRI');
    expect(summary.temporaryCovers[1].phase).toBe('upcoming');
    expect(summary.temporaryCovers[1].dateSummary).toContain('2026-11-20');
  });

  it('includes future permanent route openings and open postings while skipping already-applied ones', () => {
    const routeOpenings: RouteOpening[] = [
      {
        id: 'RO-FUTURE-PERM',
        title: 'Permanent Driver Next Month',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        postingType: 'permanent',
        roleNeeded: 'driver',
        effectiveStartDate: '2026-12-01',
        shiftType: 'ALL',
        deadline: '2026-11-20T17:00',
        status: 'awarded',
        applicants: [],
        awardedDriverId: 'EMP-009',
        awardedDriverName: 'New Permanent Driver',
        crewAppliedToRoute: false,
        createdBy: 'Admin',
        createdAt: '2026-11-10T10:00:00Z',
        updatedAt: '2026-11-11T10:00:00Z',
      },
      {
        id: 'RO-ALREADY-APPLIED',
        title: 'Old Permanent Award',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        postingType: 'permanent',
        roleNeeded: 'driver',
        effectiveStartDate: '2026-11-01',
        shiftType: 'ALL',
        deadline: '2026-10-25T17:00',
        status: 'awarded',
        applicants: [],
        awardedDriverId: 'EMP-001',
        awardedDriverName: 'Alice Driver',
        crewAppliedToRoute: true,
        createdBy: 'Admin',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'RO-OPEN',
        title: 'Midday Attendant Needed',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        postingType: 'permanent',
        roleNeeded: 'attendant',
        effectiveStartDate: '2026-11-25',
        shiftType: 'Midday',
        deadline: '2026-11-18T17:00',
        status: 'open',
        applicants: [
          {
            employeeId: 'EMP-020',
            fullName: 'Applicant One',
            roleApplied: 'attendant',
            appliedAt: '2026-11-12T08:00:00Z',
            status: 'pending',
          },
        ],
        createdBy: 'Admin',
        createdAt: '2026-11-11T10:00:00Z',
        updatedAt: '2026-11-11T10:00:00Z',
      },
    ];

    const summary = buildRouteScheduleSummary({
      route: baseRoute,
      temporaryAssignments: [],
      routeOpenings,
      todayStr: '2026-11-12',
    });

    expect(summary.scheduledOpenings).toHaveLength(2);
    expect(summary.scheduledOpenings[0].kind).toBe('scheduled_permanent');
    expect(summary.scheduledOpenings[0].opening.awardedDriverName).toBe('New Permanent Driver');
    expect(summary.scheduledOpenings[1].kind).toBe('open_posting');
    expect(summary.upcomingAndActiveCount).toBe(2);
  });

  it('filters out expired open postings and past-due permanent openings', () => {
    const routeOpenings: RouteOpening[] = [
      {
        id: 'RO-EXPIRED-DEADLINE',
        title: 'Expired Deadline Posting',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        postingType: 'permanent',
        roleNeeded: 'driver',
        effectiveStartDate: '2026-12-01',
        shiftType: 'ALL',
        deadline: '2026-11-10T17:00',
        status: 'open',
        applicants: [],
        createdBy: 'Admin',
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
      },
      {
        id: 'RO-EXPIRED-TEMP',
        title: 'Expired Temporary Posting',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        postingType: 'temporary',
        roleNeeded: 'driver',
        effectiveStartDate: '2026-11-08',
        effectiveEndDate: '2026-11-09',
        shiftType: 'AM',
        deadline: '2026-11-15T17:00',
        status: 'reviewing',
        applicants: [],
        createdBy: 'Admin',
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
      },
      {
        id: 'RO-PAST-PERM-AWARD',
        title: 'Past Permanent Award',
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        postingType: 'permanent',
        roleNeeded: 'driver',
        effectiveStartDate: '2026-11-05',
        shiftType: 'ALL',
        deadline: '2026-10-30T17:00',
        status: 'awarded',
        applicants: [],
        awardedDriverId: 'EMP-009',
        awardedDriverName: 'Old Award',
        crewAppliedToRoute: false,
        createdBy: 'Admin',
        createdAt: '2026-10-25T10:00:00Z',
        updatedAt: '2026-10-30T10:00:00Z',
      },
    ];

    const summary = buildRouteScheduleSummary({
      route: baseRoute,
      temporaryAssignments: [],
      routeOpenings,
      todayStr: '2026-11-12',
    });

    expect(summary.scheduledOpenings).toHaveLength(0);
    expect(summary.upcomingAndActiveCount).toBe(0);
  });

  it('detects shift-level custom crew overrides', () => {
    const shifts: BusRouteShift[] = [
      {
        id: 'SHIFT-101-AM',
        shiftId: 1,
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        routeName: 'Kanata North AM/PM',
        shiftType: 'AM',
        runDays: 'MTWRF',
        firstStopTime: '07:15',
        lastStopTime: '08:30',
        stops: [],
        driverId: 'EMP-001',
        driverName: 'Alice Driver',
        unitNumber: '204',
      },
      {
        id: 'SHIFT-101-PM',
        shiftId: 2,
        routeId: 'RT-101',
        routeNo: 'OCDSB-101',
        routeName: 'Kanata North AM/PM',
        shiftType: 'PM',
        runDays: 'MTWRF',
        firstStopTime: '14:45',
        lastStopTime: '16:00',
        stops: [],
        isCustomCrew: true,
        driverId: 'EMP-005',
        driverName: 'PM Driver',
        unitNumber: '310',
      },
    ];

    const summary = buildRouteScheduleSummary({
      route: baseRoute,
      shifts,
      temporaryAssignments: [],
      routeOpenings: [],
      todayStr: '2026-11-12',
    });

    expect(summary.shiftOverrides).toHaveLength(1);
    expect(summary.shiftOverrides[0].shift.shiftType).toBe('PM');
    expect(summary.shiftOverrides[0].differsDriver).toBe(true);
    expect(summary.shiftOverrides[0].differsVehicle).toBe(true);
  });
});
