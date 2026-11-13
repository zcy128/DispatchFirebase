import { describe, expect, it } from 'vitest';
import {
  getVehicleAssignmentInfo,
  sortVehiclesByAssignmentPriority,
  sortCandidatesByAssignmentPriority,
} from './assignmentPriorityUtils';
import { Vehicle } from '../types/vehicle';
import { BusRoute } from '../types/route';
import { Employee } from '../types/employee';

const testVehicles: Vehicle[] = [
  {
    id: 'VEH-1',
    vehicleId: 1,
    unitNumber: '101',
    plateNumber: 'PLT-101',
    manufacturer: 'Blue Bird',
    model: 'Vision',
    year: 2022,
    color: 'Yellow',
    unitType: 'Bus',
    fuelType: 'Diesel',
    active: true,
    status: 'In Service',
    yardName: 'North Yard',
    seatCap: 72,
    wheelchairCap: 0,
  },
  {
    id: 'VEH-2',
    vehicleId: 2,
    unitNumber: '102',
    plateNumber: 'PLT-102',
    manufacturer: 'Thomas',
    model: 'C2',
    year: 2021,
    color: 'Yellow',
    unitType: 'Bus',
    fuelType: 'Gasoline',
    active: true,
    status: 'In Service',
    yardName: 'North Yard',
    seatCap: 70,
    wheelchairCap: 0,
  },
  {
    id: 'VEH-3',
    vehicleId: 3,
    unitNumber: '103',
    plateNumber: 'PLT-103',
    manufacturer: 'Lion',
    model: 'LionC',
    year: 2023,
    color: 'Yellow',
    unitType: 'Bus',
    fuelType: 'Electric',
    active: true,
    status: 'In Service',
    yardName: 'North Yard',
    seatCap: 66,
    wheelchairCap: 0,
  },
];

const testRoutes: BusRoute[] = [
  {
    id: 'RT-1',
    busRouteId: 1,
    routeNo: 'OCDSB-001',
    routeName: 'Route 1',
    active: true,
    schoolBoardId: 1,
    schoolBoardCode: 'OCDSB',
    yardId: 1,
    yardName: 'North Yard',
    unitNumber: '101',
    totalStops: 4,
    totalStudents: 10,
  },
  {
    id: 'RT-2',
    busRouteId: 2,
    routeNo: 'OCDSB-002',
    routeName: 'Route 2',
    active: true,
    schoolBoardId: 1,
    schoolBoardCode: 'OCDSB',
    yardId: 1,
    yardName: 'North Yard',
    unitNumber: '103',
    totalStops: 4,
    totalStudents: 10,
  },
];

describe('assignmentPriorityUtils', () => {
  it('correctly classifies vehicle assignments against current and other routes', () => {
    const curRoute = { id: 'RT-1', routeNo: 'OCDSB-001' };

    // 101 is assigned to current route
    const info101 = getVehicleAssignmentInfo(testVehicles[0], testRoutes, curRoute);
    expect(info101.isCurrentRoute).toBe(true);
    expect(info101.statusTag).toBe('★ [Current Route]');

    // 102 is not assigned to any route
    const info102 = getVehicleAssignmentInfo(testVehicles[1], testRoutes, curRoute);
    expect(info102.isCurrentRoute).toBe(false);
    expect(info102.isAssigned).toBe(false);
    expect(info102.statusTag).toBe('[Available]');

    // 103 is assigned to another route (RT-2)
    const info103 = getVehicleAssignmentInfo(testVehicles[2], testRoutes, curRoute);
    expect(info103.isCurrentRoute).toBe(false);
    expect(info103.isAssigned).toBe(true);
    expect(info103.statusTag).toContain('⚠ [Assigned: OCDSB-002]');
  });

  it('sorts vehicles prioritizing current route first, then unassigned, then other routes', () => {
    const curRoute = { id: 'RT-1', routeNo: 'OCDSB-001' };
    const sorted = sortVehiclesByAssignmentPriority(testVehicles, testRoutes, curRoute);

    expect(sorted.map((s) => s.vehicle.unitNumber)).toEqual(['101', '102', '103']);
    expect(sorted[0].rank).toBe(0); // current route
    expect(sorted[1].rank).toBe(1); // unassigned (available)
    expect(sorted[2].rank).toBe(2); // other route
  });

  it('sorts candidate employees prioritizing unassigned over those already on other routes', () => {
    const empCurrent: Employee = {
      id: 'EMP-1',
      employeeNumber: '1001',
      firstName: 'Alice',
      lastName: 'Current',
      fullName: 'Alice Current',
      jobPosition: 'Driver',
      isActive: true,
      role: 'driver',
    };
    const empBusy: Employee = {
      id: 'EMP-2',
      employeeNumber: '1002',
      firstName: 'Bob',
      lastName: 'Busy',
      fullName: 'Bob Busy',
      jobPosition: 'Driver',
      isActive: true,
      role: 'driver',
    };
    const empFree: Employee = {
      id: 'EMP-3',
      employeeNumber: '1003',
      firstName: 'Charlie',
      lastName: 'Free',
      fullName: 'Charlie Free',
      jobPosition: 'Driver',
      isActive: true,
      role: 'driver',
    };

    const getAssignments = (emp: Employee) => {
      if (emp.id === 'EMP-1') return [{ isCurrentRoute: true }];
      if (emp.id === 'EMP-2') return [{ isCurrentRoute: false }]; // assigned to another route
      return []; // unassigned
    };

    const candidates = [
      { employee: empBusy, deadhead: { totalDeadheadKm: 2 } },
      { employee: empFree, deadhead: { totalDeadheadKm: 5 } },
      { employee: empCurrent, deadhead: { totalDeadheadKm: 8 } },
    ];

    const sorted = sortCandidatesByAssignmentPriority(candidates, getAssignments);
    expect(sorted.map((c) => c.employee.id)).toEqual(['EMP-1', 'EMP-3', 'EMP-2']);
  });
});
