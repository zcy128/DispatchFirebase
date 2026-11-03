import { describe, expect, it } from 'vitest';
import {
  calculateAttendantDeadhead,
  calculateDriverDeadhead,
  resolveEmployeeCoordinates,
  ROAD_CIRCUITY_FACTOR,
} from './deadheadCalculator';
import type { Employee } from '../types/employee';
import type { RouteStop } from '../types/route';

describe('deadheadCalculator', () => {
  const driverWithCoords: Employee = {
    id: 'emp-1',
    employeeId: 'EMP-1',
    name: 'John Driver',
    lat: 45.351,
    lng: -75.76,
    personalAddress: '123 Woodroffe Ave, Nepean',
  } as unknown as Employee;

  const driverWithAddressOnly: Employee = {
    id: 'emp-2',
    employeeId: 'EMP-2',
    name: 'Sarah Driver',
    personalAddress: 'Kanata Terry Fox Dr, Ottawa',
  } as unknown as Employee;

  const stops: RouteStop[] = [
    {
      id: 'stop-1',
      stopId: 1,
      sequence: 1,
      stopLocation: 'Baseline & Woodroffe',
      latitude: 45.35125,
      longitude: -75.76015,
      schoolName: 'Hillcrest High School',
      pullawayTime: '07:30',
      stopType: 'HomePickup',
    } as unknown as RouteStop,
    {
      id: 'stop-2',
      stopId: 2,
      sequence: 2,
      stopLocation: 'Hillcrest High School',
      latitude: 45.405,
      longitude: -75.642,
      schoolName: 'Hillcrest High School',
      pullawayTime: '08:15',
      stopType: 'SchoolDropoff',
    } as unknown as RouteStop,
  ];

  describe('resolveEmployeeCoordinates', () => {
    it('uses direct lat/lng when available and verifies circuity factor', () => {
      expect(ROAD_CIRCUITY_FACTOR).toBe(1.28);
      const coords = resolveEmployeeCoordinates(driverWithCoords);
      expect(coords).not.toBeNull();
      expect(coords?.lat).toBe(45.351);
      expect(coords?.lng).toBe(-75.76);
    });

    it('resolves address to known neighborhood coordinates when direct lat/lng missing', () => {
      const coords = resolveEmployeeCoordinates(driverWithAddressOnly);
      expect(coords).not.toBeNull();
      expect(coords?.lat).toBe(45.312);
      expect(coords?.lng).toBe(-75.898);
    });

    it('returns null when employee has no coordinates and no address', () => {
      const emptyEmp = { id: 'emp-empty', name: 'No Address' } as unknown as Employee;
      expect(resolveEmployeeCoordinates(emptyEmp)).toBeNull();
    });
  });

  describe('calculateDriverDeadhead', () => {
    it('computes pull-out and pull-in deadhead distances and driving minutes with road circuity factor', () => {
      const result = calculateDriverDeadhead(driverWithCoords, stops, 40); // 40 km/h

      expect(result.hasCoordinates).toBe(true);
      expect(result.pullOutKm).toBeGreaterThanOrEqual(0);
      expect(result.pullInKm).toBeGreaterThan(0);
      expect(result.totalDeadheadKm).toBe(
        Math.round((result.pullOutKm + result.pullInKm) * 10) / 10
      );
      expect(result.pullOutMinutes).toBeGreaterThanOrEqual(1);
      expect(result.pullInMinutes).toBeGreaterThan(1);
      expect(result.totalMinutes).toBe(result.pullOutMinutes + result.pullInMinutes);
    });

    it('returns hasCoordinates false when driver has no location', () => {
      const empNoLoc = { id: 'emp-3', name: 'Unknown' } as unknown as Employee;
      const result = calculateDriverDeadhead(empNoLoc, stops);
      expect(result.hasCoordinates).toBe(false);
      expect(result.totalDeadheadKm).toBe(0);
      expect(result.totalMinutes).toBe(0);
    });

    it('returns hasCoordinates false when stop list is empty', () => {
      const result = calculateDriverDeadhead(driverWithCoords, []);
      expect(result.hasCoordinates).toBe(false);
      expect(result.totalDeadheadKm).toBe(0);
    });
  });

  describe('calculateAttendantDeadhead', () => {
    it('computes attendant proximity to first stop and detour relative to driver', () => {
      const attendant: Employee = {
        id: 'att-1',
        employeeId: 'ATT-1',
        name: 'Bob Monitor',
        personalAddress: 'Baseline Nepean',
      } as unknown as Employee;

      const result = calculateAttendantDeadhead(attendant, driverWithCoords, stops, 35);

      expect(result.hasCoordinates).toBe(true);
      expect(result.distanceToFirstStopKm).toBeGreaterThanOrEqual(0);
      expect(result.distanceToDriverKm).toBeDefined();
      expect(result.detourKm).toBeGreaterThanOrEqual(0);
      expect(result.estimatedMinutes).toBeGreaterThanOrEqual(1);
    });
  });
});
