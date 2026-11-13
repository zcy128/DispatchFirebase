import { describe, it, expect } from 'vitest';
import { computeFleetPulseSummary } from './fleetPulseUtils';
import { DispatchShift } from '../types/dispatch';
import { BusRoute } from '../types/route';
import { TimeOffRequest } from '../types/timeOff';
import { StudentIncident } from '../types/studentIncident';
import { VehicleDefectReport } from '../types/defect';
import { HazardReport } from '../types/hazardReport';
import { ExpenseReimbursement } from '../types/expenseReimbursement';

describe('computeFleetPulseSummary', () => {
  it('computes all pending operational tasks across dispatch, routes, safety, and approvals', () => {
    const shifts: DispatchShift[] = [
      {
        id: 'DS-1',
        dispatchDate: '2026-11-12',
        routeId: 'RT-1',
        routeNo: '001',
        routeName: 'Route 1',
        shiftType: 'AM',
        driverId: '',
        driverName: '',
        vehicleId: 101,
        unitNumber: 'BUS-101',
        firstStopTime: '07:30',
        lastStopTime: '08:30',
        totalStops: 5,
        completedStops: 0,
        lateMinutes: 0,
        health: 'red',
        stops: [],
      },
      {
        id: 'DS-2',
        dispatchDate: '2026-11-12',
        routeId: 'RT-2',
        routeNo: '002',
        routeName: 'Route 2',
        shiftType: 'AM',
        driverId: 'DRV-1',
        driverName: 'Alice Driver',
        vehicleId: 0,
        unitNumber: '',
        firstStopTime: '07:30',
        lastStopTime: '08:30',
        totalStops: 5,
        completedStops: 0,
        lateMinutes: 0,
        health: 'yellow',
        isDriverCheckedIn: false,
        stops: [],
      },
      {
        id: 'DS-3',
        dispatchDate: '2026-11-12',
        routeId: 'RT-3',
        routeNo: '003',
        routeName: 'Route 3',
        shiftType: 'AM',
        driverId: 'DRV-2',
        driverName: 'Bob Driver',
        vehicleId: 103,
        unitNumber: 'BUS-103',
        firstStopTime: '07:30',
        lastStopTime: '08:30',
        totalStops: 5,
        completedStops: 2,
        lateMinutes: 0,
        health: 'green',
        isDriverCheckedIn: true,
        stops: [],
      },
    ];

    const routes: BusRoute[] = [
      { id: 'R1', routeNo: '101', routeName: 'R1', driverId: '', driverName: '', vehicleId: 1, unitNumber: 'U1' } as BusRoute,
      { id: 'R2', routeNo: '102', routeName: 'R2', driverId: 'D2', driverName: 'D2', vehicleId: 0, unitNumber: '' } as BusRoute,
      { id: 'R3', routeNo: '103', routeName: 'R3', driverId: 'D3', driverName: 'D3', vehicleId: 3, unitNumber: 'U3' } as BusRoute,
    ];

    const timeOffRequests: TimeOffRequest[] = [
      { id: 'T1', status: 'pending', endDate: '2026-11-15' } as TimeOffRequest,
      { id: 'T2', status: 'approved', endDate: '2026-11-14', coverageAssigned: false } as TimeOffRequest,
      { id: 'T3', status: 'approved', endDate: '2026-11-14', coverageAssigned: true } as TimeOffRequest,
      { id: 'T4', status: 'pending', endDate: '2026-11-10' } as TimeOffRequest, // expired
    ];

    const studentIncidents: StudentIncident[] = [
      { id: 'SI-1', status: 'submitted' } as StudentIncident,
      { id: 'SI-2', status: 'closed' } as StudentIncident,
    ];

    const vehicleDefects: VehicleDefectReport[] = [
      { id: 'VD-1', status: 'submitted' } as VehicleDefectReport,
      { id: 'VD-2', status: 'under_repair' } as VehicleDefectReport,
      { id: 'VD-3', status: 'resolved' } as VehicleDefectReport,
    ];

    const hazardReports: HazardReport[] = [
      { id: 'HR-1', statusInt: 0, isCompleted: false } as HazardReport,
      { id: 'HR-2', statusInt: 2, isCompleted: true } as HazardReport,
    ];

    const expenseClaims: ExpenseReimbursement[] = [
      { id: 'EX-1', status: 'pending' } as ExpenseReimbursement,
      { id: 'EX-2', status: 'approved' } as ExpenseReimbursement,
    ];

    const summary = computeFleetPulseSummary({
      shifts,
      routes,
      timeOffRequests,
      studentIncidents,
      vehicleDefects,
      hazardReports,
      expenseClaims,
      todayStr: '2026-11-12',
      currentHHmm: '08:00',
    });

    expect(summary.dispatchTotalShifts).toBe(3);
    expect(summary.dispatchMissingDriver).toBe(1);
    expect(summary.dispatchMissingVehicle).toBe(1);
    expect(summary.dispatchNotCheckedIn).toBe(1);
    expect(summary.dispatchCheckInOverdue).toBe(1);
    expect(summary.routeMissingDriver).toBe(1);
    expect(summary.routeMissingVehicle).toBe(1);
    expect(summary.routeNeedsFix).toBe(2);
    expect(summary.pendingTimeOff).toBe(1);
    expect(summary.timeOffNeedsCover).toBe(1);
    expect(summary.openStudentIncidents).toBe(1);
    expect(summary.openVehicleDefects).toBe(2);
    expect(summary.openHazardReports).toBe(1);
    expect(summary.pendingExpenses).toBe(1);
    expect(summary.totalActionItems).toBe(12);
  });

  it('reflects updates immediately when a missing driver is filled in', () => {
    const baseShift: DispatchShift = {
      id: 'DS-1',
      dispatchDate: '2026-11-12',
      routeId: 'RT-1',
      routeNo: '001',
      routeName: 'Route 1',
      shiftType: 'AM',
      driverId: '',
      driverName: '',
      vehicleId: 101,
      unitNumber: 'BUS-101',
      firstStopTime: '09:00',
      lastStopTime: '10:00',
      totalStops: 5,
      completedStops: 0,
      lateMinutes: 0,
      health: 'red',
      stops: [],
    };

    const before = computeFleetPulseSummary({
      shifts: [baseShift],
      routes: [],
      timeOffRequests: [],
      studentIncidents: [],
      vehicleDefects: [],
      hazardReports: [],
      expenseClaims: [],
      todayStr: '2026-11-12',
      currentHHmm: '08:00',
    });
    expect(before.dispatchMissingDriver).toBe(1);

    const updatedShift: DispatchShift = {
      ...baseShift,
      driverId: 'DRV-9',
      driverName: 'Updated Driver',
      isDriverCheckedIn: true,
    };

    const after = computeFleetPulseSummary({
      shifts: [updatedShift],
      routes: [],
      timeOffRequests: [],
      studentIncidents: [],
      vehicleDefects: [],
      hazardReports: [],
      expenseClaims: [],
      todayStr: '2026-11-12',
      currentHHmm: '08:00',
    });
    expect(after.dispatchMissingDriver).toBe(0);
    expect(after.totalActionItems).toBe(0);
  });
});
