import { describe, it, expect } from 'vitest';
import {
  calculateAdjustedEndDate,
  matchVehicleForDriver,
  hasDateRangeOverlap,
} from './temporaryAssignmentUtils';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';

describe('temporaryAssignmentUtils', () => {
  describe('calculateAdjustedEndDate', () => {
    it('keeps same single day when startDate and endDate are identical', () => {
      const res = calculateAdjustedEndDate('2026-11-12', '2026-11-12', '2026-11-15');
      expect(res).toBe('2026-11-15');
    });

    it('preserves multi-day duration when startDate changes', () => {
      // 4 days duration: 2026-11-10 to 2026-11-14
      const res = calculateAdjustedEndDate('2026-11-10', '2026-11-14', '2026-11-20');
      expect(res).toBe('2026-11-24');
    });

    it('prevents endDate from being earlier than newStartDate', () => {
      const res = calculateAdjustedEndDate('2026-11-10', '2026-11-12', '2026-11-15');
      expect(res).toBe('2026-11-17');
    });

    it('falls back to newStartDate if previous endDate is invalid or empty', () => {
      const res = calculateAdjustedEndDate('', '', '2026-11-20');
      expect(res).toBe('2026-11-20');
    });
  });

  describe('matchVehicleForDriver', () => {
    const mockEmployees: Employee[] = [
      {
        id: 'EMP-001',
        employeeNumber: '1001',
        employeeId: 501,
        firstName: 'John',
        lastName: 'Smith',
        fullName: 'John Smith',
        jobPosition: 'Driver',
        isActive: true,
      },
      {
        id: 'EMP-002',
        employeeNumber: '1002',
        employeeId: 502,
        firstName: 'Sarah',
        lastName: 'Connor',
        fullName: 'Sarah Connor',
        jobPosition: 'Driver',
        isActive: true,
      },
    ];

    const mockVehicles: Vehicle[] = [
      {
        id: 'VEH-101',
        vehicleId: 101,
        unitNumber: 'BUS-101',
        plateNumber: 'PLATE-101',
        manufacturer: 'Blue Bird',
        model: 'Vision',
        year: 2022,
        color: 'Yellow',
        unitType: 'Bus',
        seatCap: 72,
        wheelchairCap: 0,
        fuelType: 'Diesel',
        active: true,
        status: 'In Service',
        yardName: 'North Yard',
        driverId: 'EMP-001',
        driverName: 'John Smith',
      },
      {
        id: 'VEH-102',
        vehicleId: 102,
        unitNumber: 'VAN-102',
        plateNumber: 'PLATE-102',
        manufacturer: 'Ford',
        model: 'Transit',
        year: 2023,
        color: 'White',
        unitType: 'Van',
        seatCap: 8,
        wheelchairCap: 1,
        fuelType: 'Gasoline',
        active: true,
        status: 'In Service',
        yardName: 'South Yard',
        employeeId: 502,
        driverName: 'Sarah Connor',
      },
    ];

    it('matches vehicle by driver id', () => {
      const matched = matchVehicleForDriver('EMP-001', mockEmployees, mockVehicles);
      expect(matched?.id).toBe('VEH-101');
    });

    it('matches vehicle by employeeNumber / employeeId', () => {
      const matched = matchVehicleForDriver('EMP-002', mockEmployees, mockVehicles);
      expect(matched?.id).toBe('VEH-102');
    });

    it('returns undefined when no vehicle is assigned to driver', () => {
      const matched = matchVehicleForDriver('EMP-999', mockEmployees, mockVehicles);
      expect(matched).toBeUndefined();
    });
  });

  describe('hasDateRangeOverlap', () => {
    it('detects overlapping ranges', () => {
      expect(hasDateRangeOverlap('2026-11-10', '2026-11-15', '2026-11-12', '2026-11-18')).toBe(true);
      expect(hasDateRangeOverlap('2026-11-10', '2026-11-15', '2026-11-15', '2026-11-20')).toBe(true);
    });

    it('returns false for disjoint date ranges', () => {
      expect(hasDateRangeOverlap('2026-11-10', '2026-11-14', '2026-11-15', '2026-11-20')).toBe(false);
      expect(hasDateRangeOverlap('2026-11-20', '2026-11-25', '2026-11-10', '2026-11-15')).toBe(false);
    });

    it('returns false if any date is empty', () => {
      expect(hasDateRangeOverlap('', '2026-11-15', '2026-11-12', '2026-11-18')).toBe(false);
    });
  });
});
