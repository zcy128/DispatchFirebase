import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DispatchWorkbenchModePanel,
  filterAndSortWorkbenchQueue,
  resolveRecommendedActionTab,
  scoreShiftIssueSeverity,
} from './DispatchWorkbenchModePanel';
import { calculateDynamicShiftLateness, ShiftLatenessInfo } from '../../utils/dispatchDelayUtils';
import type { DispatchShift } from '../../types/dispatch';
import type { Employee } from '../../types/employee';
import type { Vehicle } from '../../types/vehicle';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'u-1', displayName: 'Test Dispatcher', email: 'dispatch@example.com' },
  }),
}));

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({
    isFrench: false,
    t: {
      deadhead: {
        sortByDeadhead: 'Sort by Deadhead',
        sortByName: 'Sort by Name',
        noGpsCoordinates: 'No GPS',
      },
    },
  }),
}));

function makeShift(partial: Partial<DispatchShift>): DispatchShift {
  return {
    id: 'DS-2026-11-09-OCDSB-001-AM',
    dispatchDate: '2026-11-09',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Merivale High',
    shiftType: 'AM',
    driverId: 'EMP-1',
    driverName: 'Alice Driver',
    driverPhone: '613-555-0100',
    vehicleId: 101,
    unitNumber: '1001',
    plateNumber: 'ON-1001',
    firstStopTime: '07:30',
    lastStopTime: '08:30',
    totalStops: 2,
    completedStops: 1,
    lateMinutes: 0,
    health: 'green',
    scheduledCheckInTime: '06:30',
    isDriverCheckedIn: true,
    driverCheckedInAt: '06:25',
    stops: [
      {
        stopId: 10,
        sequence: 1,
        stopLocation: '1200 Merivale Rd',
        stopScheduleTime: '07:30',
        actualArrivalTime: '07:30',
        stopType: 'StudentPickup',
        schoolName: 'Merivale High',
        assignedStudents: [
          {
            studentId: 501,
            studentName: 'Leo Martin',
            status: 'picked_up',
          },
        ],
      },
      {
        stopId: 20,
        sequence: 2,
        stopLocation: 'Merivale High School',
        stopScheduleTime: '08:00',
        stopType: 'SchoolDropoff',
        schoolName: 'Merivale High',
        assignedStudents: [],
      },
    ],
    ...partial,
  };
}

const sampleDrivers: Employee[] = [
  {
    id: 'EMP-1',
    firstName: 'Alice',
    lastName: 'Driver',
    jobPosition: 'Driver',
    isActive: true,
    personalAddress: 'Nepean, Ottawa',
    preferredPhone: '613-555-0100',
  } as Employee,
  {
    id: 'EMP-2',
    firstName: 'Bob',
    lastName: 'Spare',
    jobPosition: 'Spare Driver',
    isActive: true,
    personalAddress: 'Kanata, Ottawa',
    preferredPhone: '613-555-0199',
  } as Employee,
];

const sampleVehicles: Vehicle[] = [
  {
    id: 'VEH-101',
    vehicleId: 101,
    unitNumber: '1001',
    plateNumber: 'ON-1001',
    manufacturer: 'Blue Bird',
    model: 'Vision',
    year: 2024,
    color: 'Yellow',
    unitType: 'Bus',
    seatCap: 72,
    wheelchairCap: 0,
    fuelType: 'Diesel',
    active: true,
    status: 'In Service',
    yardName: 'West Yard',
  },
  {
    id: 'VEH-102',
    vehicleId: 102,
    unitNumber: '1002',
    plateNumber: 'ON-1002',
    manufacturer: 'Thomas',
    model: 'Saf-T-Liner',
    year: 2025,
    color: 'Yellow',
    unitType: 'Bus',
    seatCap: 48,
    wheelchairCap: 2,
    fuelType: 'Diesel',
    active: true,
    status: 'Spare',
    yardName: 'West Yard',
  },
];

describe('DispatchWorkbenchModePanel helper logic', () => {
  it('resolves the recommended action tab based on shift issue priority', () => {
    const missingDriverShift = makeShift({ driverId: '', driverName: '' });
    const missingDriverInfo = calculateDynamicShiftLateness(missingDriverShift, '07:00', true);
    expect(resolveRecommendedActionTab(missingDriverInfo)).toBe('assign_driver');

    const missingVehicleShift = makeShift({ vehicleId: 0, unitNumber: '' });
    const missingVehicleInfo = calculateDynamicShiftLateness(missingVehicleShift, '07:00', true);
    expect(resolveRecommendedActionTab(missingVehicleInfo)).toBe('assign_vehicle');

    const delayedShift = makeShift({
      isDriverCheckedIn: false,
      driverCheckedInAt: null,
      scheduledCheckInTime: '06:30',
    });
    const delayedInfo = calculateDynamicShiftLateness(delayedShift, '07:00', true);
    expect(resolveRecommendedActionTab(delayedInfo)).toBe('late_alert');
  });

  it('sorts shifts with missing driver/vehicle or delays ahead of healthy shifts and filters by sub-category', () => {
    const healthy = makeShift({ id: 'S-GREEN', routeNo: 'OCDSB-001', firstStopTime: '07:00' });
    const delayed = makeShift({
      id: 'S-DELAY',
      routeNo: 'OCDSB-002',
      firstStopTime: '07:10',
      isDriverCheckedIn: false,
      driverCheckedInAt: null,
    });
    const noVehicle = makeShift({
      id: 'S-NOVEH',
      routeNo: 'OCDSB-003',
      firstStopTime: '07:20',
      vehicleId: 0,
      unitNumber: '',
    });
    const noDriver = makeShift({
      id: 'S-NODRV',
      routeNo: 'OCDSB-004',
      firstStopTime: '07:30',
      driverId: '',
      driverName: '',
    });

    const list = [healthy, delayed, noVehicle, noDriver];
    const map = new Map<string, ShiftLatenessInfo>();
    for (const s of list) {
      map.set(s.id, calculateDynamicShiftLateness(s, '07:00', true));
    }

    expect(scoreShiftIssueSeverity(map.get('S-NODRV'))).toBeGreaterThan(
      scoreShiftIssueSeverity(map.get('S-NOVEH'))
    );
    expect(scoreShiftIssueSeverity(map.get('S-NOVEH'))).toBeGreaterThan(
      scoreShiftIssueSeverity(map.get('S-DELAY'))
    );
    expect(scoreShiftIssueSeverity(map.get('S-DELAY'))).toBeGreaterThan(
      scoreShiftIssueSeverity(map.get('S-GREEN'))
    );

    const sortedAll = filterAndSortWorkbenchQueue(list, map, 'all_filtered', '');
    expect(sortedAll.map((s) => s.id)).toEqual(['S-NODRV', 'S-NOVEH', 'S-DELAY', 'S-GREEN']);

    const onlyNoDriver = filterAndSortWorkbenchQueue(list, map, 'missing_driver', '');
    expect(onlyNoDriver.map((s) => s.id)).toEqual(['S-NODRV']);

    const onlyNoVeh = filterAndSortWorkbenchQueue(list, map, 'missing_vehicle', '');
    expect(onlyNoVeh.map((s) => s.id)).toEqual(['S-NOVEH']);

    const onlyCheckInOverdue = filterAndSortWorkbenchQueue(list, map, 'checkin_overdue', '');
    expect(onlyCheckInOverdue.map((s) => s.id)).toEqual(['S-DELAY']);

    const onlyAlertMessage = filterAndSortWorkbenchQueue(list, map, 'alert_message', '');
    expect(onlyAlertMessage.map((s) => s.id)).toEqual(['S-DELAY']);
  });
});

describe('DispatchWorkbenchModePanel component rendering', () => {
  const noop = () => {};

  it('renders recommended driver list when the top shift is missing a driver', () => {
    const shift = makeShift({ id: 'S-1', driverId: '', driverName: '' });
    const map = new Map<string, ShiftLatenessInfo>([
      [shift.id, calculateDynamicShiftLateness(shift, '07:00', true)],
    ]);

    const html = renderToStaticMarkup(
      React.createElement(DispatchWorkbenchModePanel, {
        shifts: [shift],
        allDayShifts: [shift],
        latenessByShiftId: map,
        employees: sampleDrivers,
        availableVehicles: sampleVehicles,
        studentsMap: {},
        selectedDate: '2026-11-09',
        currentTimeStr: '07:00',
        isToday: true,
        healthFilter: 'unassigned',
        onShiftUpdated: noop,
        onQuickCheckIn: noop,
        onQuickAttendantCheckIn: noop,
        onQuickCheckOut: noop,
        onOpenCheckOutModal: noop,
        onOpenMap: noop,
        onOpenStops: noop,
        onOpenCrew: noop,
        onOpenSplit: noop,
        onOpenPayroll: noop,
        onOpenHistory: noop,
      })
    );

    expect(html).toContain('data-testid="recommended-driver-list"');
    expect(html).toContain('Bob Spare');
    expect(html).toContain('data-testid="workbench-shift-detail-panel"');
    expect(html).toContain('1200 Merivale Rd');
  });

  it('renders recommended vehicle list when the top shift is missing a vehicle', () => {
    const shift = makeShift({ id: 'S-2', vehicleId: 0, unitNumber: '' });
    const map = new Map<string, ShiftLatenessInfo>([
      [shift.id, calculateDynamicShiftLateness(shift, '07:00', true)],
    ]);

    const html = renderToStaticMarkup(
      React.createElement(DispatchWorkbenchModePanel, {
        shifts: [shift],
        allDayShifts: [shift],
        latenessByShiftId: map,
        employees: sampleDrivers,
        availableVehicles: sampleVehicles,
        studentsMap: {},
        selectedDate: '2026-11-09',
        currentTimeStr: '07:00',
        isToday: true,
        healthFilter: 'unassigned',
        onShiftUpdated: noop,
        onQuickCheckIn: noop,
        onQuickAttendantCheckIn: noop,
        onQuickCheckOut: noop,
        onOpenCheckOutModal: noop,
        onOpenMap: noop,
        onOpenStops: noop,
        onOpenCrew: noop,
        onOpenSplit: noop,
        onOpenPayroll: noop,
        onOpenHistory: noop,
      })
    );

    expect(html).toContain('data-testid="recommended-vehicle-list"');
    expect(html).toContain('Unit #1002');
    expect(html).toContain('Safety Compliant Only');
  });

  it('renders late alert & message composer when the top shift has a stop delay', () => {
    const shift = makeShift({
      id: 'S-3',
      stops: [
        {
          stopId: 10,
          sequence: 1,
          stopLocation: '1200 Merivale Rd',
          stopScheduleTime: '07:30',
          stopType: 'StudentPickup',
          schoolName: 'Merivale High',
        },
      ],
    });
    const map = new Map<string, ShiftLatenessInfo>([
      [shift.id, calculateDynamicShiftLateness(shift, '07:50', true)],
    ]);

    const html = renderToStaticMarkup(
      React.createElement(DispatchWorkbenchModePanel, {
        shifts: [shift],
        allDayShifts: [shift],
        latenessByShiftId: map,
        employees: sampleDrivers,
        availableVehicles: sampleVehicles,
        studentsMap: {},
        selectedDate: '2026-11-09',
        currentTimeStr: '07:50',
        isToday: true,
        healthFilter: 'stop_delayed',
        onShiftUpdated: noop,
        onQuickCheckIn: noop,
        onQuickAttendantCheckIn: noop,
        onQuickCheckOut: noop,
        onOpenCheckOutModal: noop,
        onOpenMap: noop,
        onOpenStops: noop,
        onOpenCrew: noop,
        onOpenSplit: noop,
        onOpenPayroll: noop,
        onOpenHistory: noop,
      })
    );

    expect(html).toContain('data-testid="recommended-late-alert-panel"');
    expect(html).toContain('data-testid="subfilter-alert-message"');
    expect(html).toContain('data-testid="auto-delay-alert-schedule-banner"');
    expect(html).toContain('1st Alert at');
    expect(html).toContain('+15 min');
    expect(html).toContain('+45 min');
    expect(html).toContain('Send Delay Alert');
    expect(html).toContain('Overdue +20m');
  });

  it('automatically advances right pane to the next queue shift when the active shift is resolved', () => {
    const shift1 = makeShift({ id: 'S-VEH-1', routeNo: 'OCDSB-101', vehicleId: 0, unitNumber: '' });
    const shift2 = makeShift({ id: 'S-VEH-2', routeNo: 'OCDSB-102', vehicleId: 0, unitNumber: '' });

    const mapBefore = new Map<string, ShiftLatenessInfo>([
      [shift1.id, calculateDynamicShiftLateness(shift1, '07:00', true)],
      [shift2.id, calculateDynamicShiftLateness(shift2, '07:00', true)],
    ]);

    // Initial render with both shifts in queue
    const htmlBefore = renderToStaticMarkup(
      React.createElement(DispatchWorkbenchModePanel, {
        shifts: [shift1, shift2],
        allDayShifts: [shift1, shift2],
        latenessByShiftId: mapBefore,
        employees: sampleDrivers,
        availableVehicles: sampleVehicles,
        studentsMap: {},
        selectedDate: '2026-11-09',
        currentTimeStr: '07:00',
        isToday: true,
        healthFilter: 'unassigned',
        onShiftUpdated: noop,
        onQuickCheckIn: noop,
        onQuickAttendantCheckIn: noop,
        onQuickCheckOut: noop,
        onOpenCheckOutModal: noop,
        onOpenMap: noop,
        onOpenStops: noop,
        onOpenCrew: noop,
        onOpenSplit: noop,
        onOpenPayroll: noop,
        onOpenHistory: noop,
      })
    );
    expect(htmlBefore).toContain('OCDSB-101');
    expect(htmlBefore).toContain('Assign Vehicle for OCDSB-101 (AM)');

    // After resolving shift1 (vehicle assigned, now removed from unassigned queue)
    const mapAfter = new Map<string, ShiftLatenessInfo>([
      [shift2.id, calculateDynamicShiftLateness(shift2, '07:00', true)],
    ]);

    const htmlAfter = renderToStaticMarkup(
      React.createElement(DispatchWorkbenchModePanel, {
        shifts: [shift2],
        allDayShifts: [shift1, shift2],
        latenessByShiftId: mapAfter,
        employees: sampleDrivers,
        availableVehicles: sampleVehicles,
        studentsMap: {},
        selectedDate: '2026-11-09',
        currentTimeStr: '07:00',
        isToday: true,
        healthFilter: 'unassigned',
        onShiftUpdated: noop,
        onQuickCheckIn: noop,
        onQuickAttendantCheckIn: noop,
        onQuickCheckOut: noop,
        onOpenCheckOutModal: noop,
        onOpenMap: noop,
        onOpenStops: noop,
        onOpenCrew: noop,
        onOpenSplit: noop,
        onOpenPayroll: noop,
        onOpenHistory: noop,
      })
    );
    // Right panel should now show shift2 (OCDSB-102) rather than stale shift1
    expect(htmlAfter).toContain('Assign Vehicle for OCDSB-102 (AM)');
    expect(htmlAfter).toContain('data-testid="workbench-queue-item-S-VEH-2"');
    expect(htmlAfter).not.toContain('data-testid="workbench-queue-item-S-VEH-1"');
  });

  it('renders all-issues-resolved empty state when queue becomes empty after handling errors', () => {
    const htmlEmpty = renderToStaticMarkup(
      React.createElement(DispatchWorkbenchModePanel, {
        shifts: [],
        allDayShifts: [],
        latenessByShiftId: new Map(),
        employees: sampleDrivers,
        availableVehicles: sampleVehicles,
        studentsMap: {},
        selectedDate: '2026-11-09',
        currentTimeStr: '07:00',
        isToday: true,
        healthFilter: 'unassigned',
        onShiftUpdated: noop,
        onQuickCheckIn: noop,
        onQuickAttendantCheckIn: noop,
        onQuickCheckOut: noop,
        onOpenCheckOutModal: noop,
        onOpenMap: noop,
        onOpenStops: noop,
        onOpenCrew: noop,
        onOpenSplit: noop,
        onOpenPayroll: noop,
        onOpenHistory: noop,
      })
    );
    expect(htmlEmpty).toContain('All Issues in Queue Resolved');
    expect(htmlEmpty).toContain('No matching shifts in queue');
  });

  it('renders driver chat/sms buttons, attendant details and vehicle map buttons in shift detail panel', () => {
    const testShift = makeShift({
      id: 'S-CREW-DETAIL-1',
      routeNo: 'CEPEP-021',
      shiftType: 'AM',
      driverId: 'EMP-1',
      driverName: 'Alice Driver',
      driverPhone: '613-555-0100',
      attendantId: 'EMP-2',
      attendantName: 'Bob Attendant',
      attendantPhone: '613-555-0200',
      unitNumber: '2021',
      vehicleId: 201,
      plateNumber: 'ON-2021',
    });

    const latenessMap = new Map<string, ShiftLatenessInfo>([
      [testShift.id, calculateDynamicShiftLateness(testShift, '07:00', true)],
    ]);

    const html = renderToStaticMarkup(
      React.createElement(DispatchWorkbenchModePanel, {
        shifts: [testShift],
        allDayShifts: [testShift],
        latenessByShiftId: latenessMap,
        employees: sampleDrivers,
        availableVehicles: sampleVehicles,
        studentsMap: {},
        selectedDate: '2026-11-09',
        currentTimeStr: '07:00',
        isToday: true,
        healthFilter: 'ALL',
        onShiftUpdated: noop,
        onQuickCheckIn: noop,
        onQuickAttendantCheckIn: noop,
        onQuickCheckOut: noop,
        onOpenCheckOutModal: noop,
        onOpenMap: noop,
        onOpenStops: noop,
        onOpenCrew: noop,
        onOpenSplit: noop,
        onOpenPayroll: noop,
        onOpenHistory: noop,
        onMessageDriver: noop,
        onSelectEmployee: noop,
        onSelectVehicle: noop,
      })
    );

    // Shift AI Copilot window at top of right detail
    expect(html).toContain('data-testid="shift-ai-copilot-window"');
    expect(html).toContain('Shift AI Copilot');
    expect(html).toContain('Target: CEPEP-021 (AM)');

    // Driver details & chat/sms buttons
    expect(html).toContain('Alice Driver');
    expect(html).toContain('Chat with Alice Driver');
    expect(html).toContain('title="Send SMS to Alice Driver (613-555-0100)"');
    expect(html).toContain('SMS');

    // Attendant details & chat/sms buttons
    expect(html).toContain('Bob Attendant');
    expect(html).toContain('Chat with Bob Attendant');
    expect(html).toContain('title="Send SMS to Bob Attendant (613-555-0200)"');

    // Vehicle details & map button
    expect(html).toContain('Unit #2021');
    expect(html).toContain('View route &amp; vehicle map for Unit #2021');
  });
});
