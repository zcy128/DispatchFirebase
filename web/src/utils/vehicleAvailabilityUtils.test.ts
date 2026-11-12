import { describe, expect, it } from 'vitest';
import {
  filterAvailableVehicles,
  getUnavailableVehiclesForDate,
  getVehicleUnavailabilityReason,
  getEmployeeTimeOffMapForDate,
  getEmployeeTimeOffReason,
} from './vehicleAvailabilityUtils';
import type { Vehicle } from '../types/vehicle';
import type { VehicleDefectReport } from '../types/defect';
import type { PreventiveMaintenanceRecord } from '../types/vehicleInspection';
import type { TimeOffRequest } from '../types/timeOff';

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

  it('flags vehicles with future scheduled preventive maintenance when viewing today or tomorrow', () => {
    const futurePm: PreventiveMaintenanceRecord = {
      id: 'pm-200',
      unitNumber: '101',
      vehicleId: 1,
      serviceTier: 'Schedule C Service',
      serviceDate: '2099-12-15',
      scheduledServiceDate: '2099-12-15',
      maintenanceStatus: 'in_progress',
    } as unknown as PreventiveMaintenanceRecord;

    const unavailable = getUnavailableVehiclesForDate(
      '2099-12-10',
      [],
      [],
      [futurePm],
      [activeVehicle]
    );

    const result = getVehicleUnavailabilityReason('101', 1, unavailable);
    expect(result).toBeDefined();
    expect(result?.reason).toBe('preventive_maintenance');
    expect(result?.badgeTextEn).toContain('2099-12-15');
  });

  it('resolves employee time-off info for today/tomorrow but suppresses it for yesterday', () => {
    const timeOffReq: TimeOffRequest = {
      id: 'to-1',
      employeeId: 'emp-doc-42',
      employeeNumber: '42',
      employeeName: 'Marie Curie',
      leaveType: 'vacation',
      startDate: '2026-11-10',
      endDate: '2026-11-15',
      shiftType: 'AM',
      status: 'approved',
      comments: 'Family trip',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    };

    // Today / tomorrow (>= todayOverride '2026-11-11') -> returns Time Off info
    const todayMap = getEmployeeTimeOffMapForDate('2026-11-11', [timeOffReq], '2026-11-11');
    const infoToday = getEmployeeTimeOffReason(
      { id: 'emp-doc-42', employeeId: 42, firstName: 'Marie', lastName: 'Curie' },
      todayMap
    );
    expect(infoToday).toBeDefined();
    expect(infoToday?.badgeTextEn).toContain('Time Off: Vacation');
    expect(infoToday?.badgeTextEn).toContain('AM');
    expect(infoToday?.detailEn).toContain('Family trip');

    // Yesterday (< todayOverride '2026-11-11') -> returns empty map (no time-off shown)
    const yesterdayMap = getEmployeeTimeOffMapForDate('2026-11-10', [timeOffReq], '2026-11-11');
    expect(yesterdayMap.size).toBe(0);
    const infoYesterday = getEmployeeTimeOffReason(
      { id: 'emp-doc-42', employeeId: 42, firstName: 'Marie', lastName: 'Curie' },
      yesterdayMap
    );
    expect(infoYesterday).toBeUndefined();
  });

  it('returns empty map when date is empty or invalid', () => {
    const unavailable = getUnavailableVehiclesForDate('', [], [], [], [outOfServiceVehicle]);
    expect(unavailable.size).toBe(0);
  });
});
