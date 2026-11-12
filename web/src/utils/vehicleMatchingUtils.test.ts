import { describe, expect, it } from 'vitest';
import { filterAndSortVehicles, findRegularVehicleForDriver } from './vehicleMatchingUtils';
import type { Employee } from '../types/employee';
import type { Vehicle } from '../types/vehicle';

const vehicles: Vehicle[] = [
  {
    id: 'VEH-2002',
    vehicleId: 2002,
    unitNumber: '1012',
    plateNumber: 'ON-1012',
    manufacturer: 'Thomas',
    model: 'Saf-T-Liner',
    year: 2022,
    color: 'Yellow',
    unitType: 'Bus',
    seatCap: 72,
    wheelchairCap: 0,
    fuelType: 'Diesel',
    active: true,
    status: 'In Service',
    yardName: 'Nepean Yard',
    employeeId: 102,
    driverId: 'EMP-102',
    driverName: 'Bob Martin',
  },
  {
    id: 'VEH-1001',
    vehicleId: 1001,
    unitNumber: '1001',
    plateNumber: 'ON-1001',
    manufacturer: 'Blue Bird',
    model: 'Vision',
    year: 2023,
    color: 'Yellow',
    unitType: 'Bus',
    seatCap: 48,
    wheelchairCap: 2,
    fuelType: 'Diesel',
    active: true,
    status: 'In Service',
    yardName: 'Kanata Yard',
    driverId: '101',
    driverName: 'Alice Tremblay',
  },
  {
    id: 'VEH-3003',
    vehicleId: 3003,
    unitNumber: '502',
    plateNumber: 'QC-502',
    manufacturer: 'Ford',
    model: 'Transit',
    year: 2021,
    color: 'White',
    unitType: 'Van',
    seatCap: 15,
    wheelchairCap: 0,
    fuelType: 'Gasoline',
    active: false,
    status: 'Maintenance',
    yardName: 'East Yard',
    driverName: 'Charlie UnlistedId',
  },
];

describe('vehicleMatchingUtils', () => {
  describe('findRegularVehicleForDriver', () => {
    it('matches vehicle when vehicle.driverId lacks EMP- prefix', () => {
      const driver = {
        id: 'EMP-101',
        employeeNumber: '101',
        firstName: 'Alice',
        lastName: 'Tremblay',
        fullName: 'Alice Tremblay',
      } as Employee;

      const matched = findRegularVehicleForDriver(driver, vehicles);
      expect(matched?.vehicleId).toBe(1001);
      expect(matched?.unitNumber).toBe('1001');
    });

    it('matches vehicle by numeric employeeId and full EMP- driverId', () => {
      const driver = {
        id: 'EMP-102',
        employeeId: 102,
        employeeNumber: '102',
        firstName: 'Bob',
        lastName: 'Martin',
        fullName: 'Bob Martin',
      } as Employee;

      const matched = findRegularVehicleForDriver(driver, vehicles);
      expect(matched?.vehicleId).toBe(2002);
    });

    it('falls back to normalized driverName match when IDs are absent on vehicle', () => {
      const driver = {
        id: 'EMP-999',
        employeeNumber: '999',
        firstName: 'Charlie',
        lastName: 'UnlistedId',
        fullName: 'charlie unlistedid',
      } as Employee;

      const matched = findRegularVehicleForDriver(driver, vehicles);
      expect(matched?.vehicleId).toBe(3003);
    });

    it('returns undefined when the driver has no matching vehicle', () => {
      const spareDriver = {
        id: 'EMP-777',
        employeeNumber: '777',
        firstName: 'Spare',
        lastName: 'Driver',
        fullName: 'Spare Driver',
      } as Employee;

      expect(findRegularVehicleForDriver(spareDriver, vehicles)).toBeUndefined();
    });
  });

  describe('filterAndSortVehicles', () => {
    it('sorts active vehicles first and applies numeric unit ordering when query is empty', () => {
      const result = filterAndSortVehicles(vehicles, '');
      expect(result.map((v) => v.unitNumber)).toEqual(['1001', '1012', '502']);
    });

    it('filters by unit number, plate, make/model, yard, or assigned driver name', () => {
      expect(filterAndSortVehicles(vehicles, 'kanata').map((v) => v.vehicleId)).toEqual([1001]);
      expect(filterAndSortVehicles(vehicles, 'bob martin').map((v) => v.vehicleId)).toEqual([2002]);
      expect(filterAndSortVehicles(vehicles, 'qc-502').map((v) => v.vehicleId)).toEqual([3003]);
      expect(filterAndSortVehicles(vehicles, 'vision').map((v) => v.vehicleId)).toEqual([1001]);
    });
  });
});
