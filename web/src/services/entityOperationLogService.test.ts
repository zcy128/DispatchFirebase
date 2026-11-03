import { describe, expect, it } from 'vitest';
import { EntityOperationLogService } from './entityOperationLogService';
import type { Student } from '../types/student';
import type { Vehicle } from '../types/vehicle';

describe('EntityOperationLogService Diff Engine', () => {
  describe('compareStudent', () => {
    it('detects changes in student personal details, address, and special flags', () => {
      const oldStudent: Partial<Student> = {
        firstName: 'John',
        lastName: 'Doe',
        studentAddress: '100 Main St',
        studentPhone: '613-555-0100',
        active: true,
        metatBus: false,
      };

      const newStudent: Partial<Student> = {
        firstName: 'John',
        lastName: 'Doe',
        studentAddress: '250 Bank St', // Changed
        studentPhone: '613-555-0199', // Changed
        active: false,                // Changed
        metatBus: true,               // Changed
      };

      const diffs = EntityOperationLogService.compareStudent(oldStudent, newStudent);

      expect(diffs.length).toBe(4);

      const addressDiff = diffs.find((d) => d.field === 'studentAddress');
      expect(addressDiff).toBeDefined();
      expect(addressDiff?.oldValue).toBe('100 Main St');
      expect(addressDiff?.newValue).toBe('250 Bank St');

      const activeDiff = diffs.find((d) => d.field === 'active');
      expect(activeDiff).toBeDefined();
      expect(activeDiff?.oldValue).toBe(true);
      expect(activeDiff?.newValue).toBe(false);

      const metatBusDiff = diffs.find((d) => d.field === 'metatBus');
      expect(metatBusDiff).toBeDefined();
      expect(metatBusDiff?.oldValue).toBe(false);
      expect(metatBusDiff?.newValue).toBe(true);
    });

    it('returns empty diff array when student fields are identical', () => {
      const student: Partial<Student> = {
        firstName: 'Alice',
        lastName: 'Wonder',
        grade: '4',
        active: true,
      };

      const diffs = EntityOperationLogService.compareStudent(student, { ...student });
      expect(diffs).toEqual([]);
    });
  });

  describe('compareVehicle', () => {
    it('detects driver assignment reassignment, capacity, and operational status changes', () => {
      const oldVehicle: Partial<Vehicle> = {
        unitNumber: '101',
        driverName: 'Dave Miller',
        seatCap: 72,
        status: 'Active',
        assignedRouteNo: 'OCDSB-001',
      };

      const newVehicle: Partial<Vehicle> = {
        unitNumber: '101',
        driverName: 'Sarah Jenkins', // Reassigned driver
        seatCap: 66,                  // Capacity adjustment
        status: 'Maintenance',       // Taken out of service
        assignedRouteNo: 'OCDSB-002', // Route change
      };

      const diffs = EntityOperationLogService.compareVehicle(oldVehicle, newVehicle);

      expect(diffs.length).toBe(4);

      const driverDiff = diffs.find((d) => d.field === 'driverName');
      expect(driverDiff?.oldValue).toBe('Dave Miller');
      expect(driverDiff?.newValue).toBe('Sarah Jenkins');

      const capacityDiff = diffs.find((d) => d.field === 'seatCap');
      expect(capacityDiff?.oldValue).toBe(72);
      expect(capacityDiff?.newValue).toBe(66);

      const statusDiff = diffs.find((d) => d.field === 'status');
      expect(statusDiff?.oldValue).toBe('Active');
      expect(statusDiff?.newValue).toBe('Maintenance');
    });

    it('handles numeric and boolean normalization smoothly', () => {
      const oldVehicle: Partial<Vehicle> = {
        active: true,
        wheelchairCap: 2,
      };

      const newVehicle: Partial<Vehicle> = {
        active: true,
        wheelchairCap: 2,
      };

      const diffs = EntityOperationLogService.compareVehicle(oldVehicle, newVehicle);
      expect(diffs).toEqual([]);
    });
  });
});
