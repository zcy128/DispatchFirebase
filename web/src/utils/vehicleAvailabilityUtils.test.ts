import { describe, expect, it } from 'vitest';
import {
  filterAvailableVehicles,
  getUnavailableVehiclesForDate,
  getVehicleUnavailabilityReason,
} from './vehicleAvailabilityUtils';
import type { Vehicle } from '../types/vehicle';
import type { VehicleDefectReport } from '../types/defect';
import type { PreventiveMaintenanceRecord } from '../types/vehicleInspection';

describe('vehicleAvailabilityUtils', () => {
  const activeVehicle: Vehicle = {
    id: '1',
    vehicleId: 1,
    unitNumber: '101',
    plateNumber: 'ABC-123',
    make: 'Blue Bird',
    model: 'Vision',
    year: 2024,
    capacity: 72,
    status: 'Active',
    inService: true,
  } as unknown as Vehicle;

  const outOfServiceVehicle: Vehicle = {
    id: '2',
    vehicleId: 2,
    unitNumber: '102',
    plateNumber: 'DEF-456',
    make: 'Thomas',
    model: 'Saf-T-Liner',
    year: 2022,
    capacity: 72,
    status: 'Maintenance',
    inService: false,
  } as unknown as Vehicle;

  it('detects vehicles out of service by vehicle master status', () => {
    const unavailable = getUnavailableVehiclesForDate(
      '2026-11-03',
      [],
      [],
      [],
      [activeVehicle, outOfServiceVehicle]
    );

    expect(getVehicleUnavailabilityReason('101', 1, unavailable)).toBeUndefined();

    const result = getVehicleUnavailabilityReason('102', 2, unavailable);
    expect(result).toBeDefined();
    expect(result?.reason).toBe('vehicle_status');
    expect(result?.badgeTextEn).toBe('Out of Service');

    const availableList = filterAvailableVehicles([activeVehicle, outOfServiceVehicle], unavailable);
    expect(availableList.length).toBe(1);
    expect(availableList[0].unitNumber).toBe('101');
  });

  it('marks vehicles unavailable when an active defect report exists', () => {
    const defect: VehicleDefectReport = {
      id: 'defect-001',
      vehicleUnitNumber: '101',
      vehicleId: 1,
      defectCategory: 'Brakes',
      severity: 'major',
      status: 'under_repair',
      reportDate: '2026-11-03',
      defectNotes: 'Air brake pressure leak detected',
    } as unknown as VehicleDefectReport;

    const unavailable = getUnavailableVehiclesForDate(
      '2026-11-03',
      [defect],
      [],
      [],
      [activeVehicle]
    );

    const result = getVehicleUnavailabilityReason('101', 1, unavailable);
    expect(result).toBeDefined();
    expect(result?.reason).toBe('defect');
    expect(result?.detailEn).toContain('Air brake pressure leak');
  });

  it('locks vehicles scheduled for preventive maintenance on the target date', () => {
    const pm: PreventiveMaintenanceRecord = {
      id: 'pm-100',
      unitNumber: '101',
      vehicleId: 1,
      serviceTier: 'Schedule B Service',
      serviceDate: '2026-11-03',
      scheduledServiceDate: '2026-11-03',
      maintenanceStatus: 'in_progress',
    } as unknown as PreventiveMaintenanceRecord;

    const unavailable = getUnavailableVehiclesForDate(
      '2026-11-03',
      [],
      [],
      [pm],
      [activeVehicle]
    );

    const result = getVehicleUnavailabilityReason('101', 1, unavailable);
    expect(result).toBeDefined();
    expect(result?.reason).toBe('preventive_maintenance');
    expect(result?.detailEn).toContain('Schedule B Service');
  });

  it('returns empty map when date is empty or invalid', () => {
    const unavailable = getUnavailableVehiclesForDate('', [], [], [], [outOfServiceVehicle]);
    expect(unavailable.size).toBe(0);
  });
});
