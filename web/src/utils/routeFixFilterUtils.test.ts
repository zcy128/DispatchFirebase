import { describe, expect, it } from 'vitest';
import {
  countRouteFixIssues,
  getRouteFixStatus,
  matchesRouteFixFilter,
} from './routeFixFilterUtils';

const completeRoute = {
  driverId: 'EMP-1',
  driverName: 'Alice',
  vehicleId: 10,
  unitNumber: '204',
};

const missingDriverRoute = {
  driverId: '',
  driverName: '',
  vehicleId: 11,
  unitNumber: '205',
};

const missingVehicleRoute = {
  driverId: 'EMP-2',
  driverName: 'Bob',
  vehicleId: 0,
  unitNumber: '',
};

const missingBothRoute = {
  driverId: '',
  driverName: '   ',
  vehicleId: undefined,
  unitNumber: '',
};

describe('routeFixFilterUtils', () => {
  it('detects missing driver and vehicle accurately', () => {
    expect(getRouteFixStatus(completeRoute)).toEqual({
      missingDriver: false,
      missingVehicle: false,
      needsFix: false,
    });
    expect(getRouteFixStatus(missingDriverRoute)).toEqual({
      missingDriver: true,
      missingVehicle: false,
      needsFix: true,
    });
    expect(getRouteFixStatus(missingVehicleRoute)).toEqual({
      missingDriver: false,
      missingVehicle: true,
      needsFix: true,
    });
    expect(getRouteFixStatus(missingBothRoute)).toEqual({
      missingDriver: true,
      missingVehicle: true,
      needsFix: true,
    });
  });

  it('filters routes according to each RouteFixFilter option', () => {
    const list = [completeRoute, missingDriverRoute, missingVehicleRoute, missingBothRoute];

    expect(list.filter((r) => matchesRouteFixFilter(r, 'ALL'))).toHaveLength(4);
    expect(list.filter((r) => matchesRouteFixFilter(r, 'NEEDS_FIX'))).toHaveLength(3);
    expect(list.filter((r) => matchesRouteFixFilter(r, 'MISSING_DRIVER'))).toHaveLength(2);
    expect(list.filter((r) => matchesRouteFixFilter(r, 'MISSING_VEHICLE'))).toHaveLength(2);
    expect(list.filter((r) => matchesRouteFixFilter(r, 'MISSING_BOTH'))).toHaveLength(1);
    expect(list.filter((r) => matchesRouteFixFilter(r, 'COMPLETE'))).toHaveLength(1);
  });

  it('computes aggregate counts across all routes', () => {
    const counts = countRouteFixIssues([
      completeRoute,
      missingDriverRoute,
      missingVehicleRoute,
      missingBothRoute,
    ]);
    expect(counts).toEqual({
      needsFix: 3,
      missingDriver: 2,
      missingVehicle: 2,
      missingBoth: 1,
      complete: 1,
    });
  });
});
