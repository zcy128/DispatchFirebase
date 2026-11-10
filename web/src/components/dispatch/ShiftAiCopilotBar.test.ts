import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ShiftAiCopilotBar,
  matchEmployee,
  matchVehicle,
  matchStudentInShift,
} from './ShiftAiCopilotBar';
import type { DispatchShift } from '../../types/dispatch';
import type { Employee } from '../../types/employee';
import type { Vehicle } from '../../types/vehicle';

describe('ShiftAiCopilotBar logic & matchers', () => {
  const sampleEmployees: Employee[] = [
    {
      id: 'EMP-1',
      firstName: 'Alice',
      lastName: 'Driver',
      preferredPhone: '613-555-0100',
    } as Employee,
    {
      id: 'EMP-21',
      firstName: 'Driver',
      lastName: '21',
      employeeNumber: 'DRV-21',
      preferredPhone: '613-555-0121',
    } as Employee,
    {
      id: 'EMP-30',
      firstName: 'Bob',
      lastName: 'Attendant',
      jobPosition: 'Attendant',
      preferredPhone: '613-555-0200',
    } as Employee,
  ];

  const sampleVehicles: Vehicle[] = [
    {
      vehicleId: 101,
      unitNumber: '1001',
      plateNumber: 'ON-1001',
    } as Vehicle,
    {
      vehicleId: 201,
      unitNumber: '2021',
      plateNumber: 'ON-2021',
    } as Vehicle,
  ];

  const sampleShift: DispatchShift = {
    id: 'DS-2026-11-10-TEST-001',
    dispatchDate: '2026-11-10',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Merivale',
    shiftType: 'AM',
    driverId: 'EMP-1',
    driverName: 'Alice Driver',
    firstStopTime: '07:30',
    lastStopTime: '08:30',
    totalStops: 2,
    completedStops: 0,
    lateMinutes: 0,
    health: 'green',
    stops: [
      {
        stopId: 10,
        sequence: 1,
        stopLocation: '1200 Merivale Rd',
        stopScheduleTime: '07:30',
        stopType: 'StudentPickup',
        schoolName: 'Merivale High',
        assignedStudents: [
          {
            studentId: 501,
            studentName: 'Benjamin Martin',
            status: 'scheduled',
          },
          {
            studentId: 502,
            studentName: 'Chloe Bennett',
            status: 'scheduled',
          },
        ],
      },
    ],
  };

  it('matches employee by name, ID, or driver number', () => {
    // 1. Matches "driver21" to EMP-21
    const emp21 = matchEmployee('driver21', sampleEmployees);
    expect(emp21).toBeDefined();
    expect(emp21?.id).toBe('EMP-21');

    // 2. Matches "Alice"
    const alice = matchEmployee('Alice', sampleEmployees);
    expect(alice?.id).toBe('EMP-1');

    // 3. Matches full name
    const bob = matchEmployee('Bob Attendant', sampleEmployees);
    expect(bob?.id).toBe('EMP-30');

    // 4. Non-matching returns null
    expect(matchEmployee('NonExistent', sampleEmployees)).toBeNull();
  });

  it('matches vehicle by unit number or plate with or without prefix', () => {
    // 1. Exact unit number
    const v1001 = matchVehicle('1001', sampleVehicles);
    expect(v1001?.unitNumber).toBe('1001');

    // 2. Prefix "unit 1001" or "bus 2021"
    const vUnit = matchVehicle('unit 1001', sampleVehicles);
    expect(vUnit?.unitNumber).toBe('1001');

    const vBus = matchVehicle('bus 2021', sampleVehicles);
    expect(vBus?.unitNumber).toBe('2021');

    // 3. Plate number
    const vPlate = matchVehicle('ON-1001', sampleVehicles);
    expect(vPlate?.unitNumber).toBe('1001');

    expect(matchVehicle('9999', sampleVehicles)).toBeNull();
  });

  it('matches student in shift stops by name or first name', () => {
    // 1. Exact full name
    const res1 = matchStudentInShift('Benjamin Martin', sampleShift);
    expect(res1?.student.studentId).toBe(501);
    expect(res1?.stop.stopId).toBe(10);

    // 2. First name "Benjamin"
    const res2 = matchStudentInShift('Benjamin', sampleShift);
    expect(res2?.student.studentId).toBe(501);

    // 3. Case-insensitive "chloe"
    const res3 = matchStudentInShift('chloe', sampleShift);
    expect(res3?.student.studentId).toBe(502);

    expect(matchStudentInShift('Nobody', sampleShift)).toBeNull();
  });

  it('renders copilot bar with target shift badge and quick actions', () => {
    const html = renderToStaticMarkup(
      React.createElement(ShiftAiCopilotBar, {
        selectedShift: sampleShift,
        employees: sampleEmployees,
        availableVehicles: sampleVehicles,
        onAssignDriver: vi.fn(),
        onAssignVehicle: vi.fn(),
        onAssignAttendant: vi.fn(),
        onUpdateStudentStatus: vi.fn(),
        selectedDate: '2026-11-10',
      })
    );

    expect(html).toContain('Shift AI Copilot');
    expect(html).toContain('Target: OCDSB-001 (AM)');
    expect(html).toContain('driver');
    expect(html).toContain('vehicle');
    expect(html).toContain('pickup');
    expect(html).toContain('checkin');
  });
});
