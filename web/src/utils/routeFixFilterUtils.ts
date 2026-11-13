import { BusRoute } from '../types/route';

export type RouteFixFilter =
  | 'ALL'
  | 'NEEDS_FIX'
  | 'MISSING_DRIVER'
  | 'MISSING_VEHICLE'
  | 'MISSING_BOTH'
  | 'COMPLETE';

export interface RouteFixStatus {
  missingDriver: boolean;
  missingVehicle: boolean;
  needsFix: boolean;
}

export function getRouteFixStatus(route: Pick<BusRoute, 'driverId' | 'driverName' | 'vehicleId' | 'unitNumber'>): RouteFixStatus {
  const hasDriver = Boolean((route.driverId || '').trim() || (route.driverName || '').trim());
  const hasVehicle = Boolean((route.unitNumber || '').trim() || (typeof route.vehicleId === 'number' && route.vehicleId > 0));
  const missingDriver = !hasDriver;
  const missingVehicle = !hasVehicle;

  return {
    missingDriver,
    missingVehicle,
    needsFix: missingDriver || missingVehicle,
  };
}

export function matchesRouteFixFilter(
  route: Pick<BusRoute, 'driverId' | 'driverName' | 'vehicleId' | 'unitNumber'>,
  filter: RouteFixFilter
): boolean {
  if (filter === 'ALL') return true;
  const status = getRouteFixStatus(route);

  switch (filter) {
    case 'NEEDS_FIX':
      return status.needsFix;
    case 'MISSING_DRIVER':
      return status.missingDriver;
    case 'MISSING_VEHICLE':
      return status.missingVehicle;
    case 'MISSING_BOTH':
      return status.missingDriver && status.missingVehicle;
    case 'COMPLETE':
      return !status.needsFix;
    default:
      return true;
  }
}

export interface RouteFixCounts {
  needsFix: number;
  missingDriver: number;
  missingVehicle: number;
  missingBoth: number;
  complete: number;
}

export function countRouteFixIssues(
  routes: Pick<BusRoute, 'driverId' | 'driverName' | 'vehicleId' | 'unitNumber'>[]
): RouteFixCounts {
  const counts: RouteFixCounts = {
    needsFix: 0,
    missingDriver: 0,
    missingVehicle: 0,
    missingBoth: 0,
    complete: 0,
  };

  for (const r of routes) {
    const s = getRouteFixStatus(r);
    if (s.needsFix) {
      counts.needsFix += 1;
    } else {
      counts.complete += 1;
    }
    if (s.missingDriver) counts.missingDriver += 1;
    if (s.missingVehicle) counts.missingVehicle += 1;
    if (s.missingDriver && s.missingVehicle) counts.missingBoth += 1;
  }

  return counts;
}
