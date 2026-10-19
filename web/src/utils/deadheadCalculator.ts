import { Employee } from '../types/employee';
import { RouteStop } from '../types/route';
import { DispatchShiftStop } from '../types/dispatch';
import { LatLngPoint, resolveStopCoordinates } from './geoUtils';
import { calculateHaversineDistance } from './routeOptimizer';

/**
 * Standard urban/suburban road network circuity factor.
 * Actual road driving distance is approximately 1.28x Euclidean / Haversine distance.
 */
export const ROAD_CIRCUITY_FACTOR = 1.28;

export interface DriverDeadheadResult {
  hasCoordinates: boolean;
  pullOutKm: number;       // Distance from Driver Home to First Stop
  pullInKm: number;        // Distance from Last Stop to Driver Home
  totalDeadheadKm: number; // pullOutKm + pullInKm
  pullOutMinutes: number;  // Drive time to First Stop
  pullInMinutes: number;   // Drive time from Last Stop
  totalMinutes: number;    // Total empty drive time
  originAddress?: string;
}

export interface AttendantDeadheadResult {
  hasCoordinates: boolean;
  distanceToFirstStopKm: number;
  distanceToDriverKm?: number;
  detourKm?: number;
  estimatedMinutes: number;
  originAddress?: string;
}

/**
 * Resolves an employee's residence coordinates.
 * Priority:
 * 1. Direct emp.lat and emp.lng
 * 2. Parsing emp.personalAddress or contacts
 */
export function resolveEmployeeCoordinates(emp: Employee): LatLngPoint | null {
  if (
    typeof emp.lat === 'number' &&
    typeof emp.lng === 'number' &&
    emp.lat !== 0 &&
    emp.lng !== 0 &&
    !isNaN(emp.lat) &&
    !isNaN(emp.lng)
  ) {
    return { lat: emp.lat, lng: emp.lng };
  }

  const addr = (emp.personalAddress || '').toLowerCase().trim();
  if (!addr) {
    const contact = emp.employeeContacts?.find((c) => c.street || c.city);
    if (contact) {
      const contactAddr = `${contact.street || ''} ${contact.city || ''}`.toLowerCase().trim();
      if (contactAddr) return resolveAddressToCoordinates(contactAddr);
    }
    return null;
  }

  return resolveAddressToCoordinates(addr);
}

function resolveAddressToCoordinates(addr: string): LatLngPoint | null {
  // Ottawa / Gatineau regional neighborhood & corridor map
  if (addr.includes('kanata') || addr.includes('terry fox') || addr.includes('hazeldean')) {
    return { lat: 45.312, lng: -75.898 };
  }
  if (addr.includes('stittsville') || addr.includes('main st')) {
    return { lat: 45.258, lng: -75.922 };
  }
  if (addr.includes('barrhaven') || addr.includes('strandherd') || addr.includes('jockvale')) {
    return { lat: 45.275, lng: -75.745 };
  }
  if (addr.includes('nepean') || addr.includes('baseline') || addr.includes('woodroffe')) {
    return { lat: 45.351, lng: -75.760 };
  }
  if (addr.includes('merivale') || addr.includes('meadowlands')) {
    return { lat: 45.362, lng: -75.725 };
  }
  if (addr.includes('carling') || addr.includes('richmond') || addr.includes('westboro')) {
    return { lat: 45.395, lng: -75.755 };
  }
  if (addr.includes('orleans') || addr.includes('innes') || addr.includes('st joseph')) {
    return { lat: 45.475, lng: -75.518 };
  }
  if (addr.includes('gloucester') || addr.includes('ogilvie') || addr.includes('blair')) {
    return { lat: 45.435, lng: -75.605 };
  }
  if (addr.includes('vanier') || addr.includes('montreal rd') || addr.includes('beechwood')) {
    return { lat: 45.435, lng: -75.660 };
  }
  if (addr.includes('downtown') || addr.includes('bank st') || addr.includes('somerset') || addr.includes('elgin')) {
    return { lat: 45.418, lng: -75.694 };
  }
  if (addr.includes('riverside') || addr.includes('south keys') || addr.includes('hunt club')) {
    return { lat: 45.345, lng: -75.668 };
  }
  if (addr.includes('gatineau') || addr.includes('hull') || addr.includes('aylmer')) {
    return { lat: 45.430, lng: -75.720 };
  }

  // Deterministic scatter fallback for any other Ottawa address string so relative distances remain consistent
  let hash = 0;
  for (let i = 0; i < addr.length; i++) {
    hash = (hash * 31 + addr.charCodeAt(i)) & 0xffffffff;
  }
  const deltaLat = ((Math.abs(hash) % 100) - 50) * 0.001;
  const deltaLng = ((Math.abs(hash >> 5) % 100) - 50) * 0.0012;
  return {
    lat: Math.round((45.385 + deltaLat) * 1e5) / 1e5,
    lng: Math.round((-75.725 + deltaLng) * 1e5) / 1e5
  };
}

export type AnyStop = RouteStop | DispatchShiftStop;

/**
 * Calculates deadhead distance for a driver relative to a shift's stops.
 * Assumptions:
 * - Driver parks the bus at home.
 * - Bus pulls out from Driver's Home to First Stop.
 * - Bus pulls in from Last Stop to Driver's Home.
 */
export function calculateDriverDeadhead(
  driver: Employee,
  stops: AnyStop[],
  speedKmH: number = 30
): DriverDeadheadResult {
  const empCoords = resolveEmployeeCoordinates(driver);
  if (!empCoords || stops.length === 0) {
    return {
      hasCoordinates: false,
      pullOutKm: 0,
      pullInKm: 0,
      totalDeadheadKm: 0,
      pullOutMinutes: 0,
      pullInMinutes: 0,
      totalMinutes: 0,
      originAddress: driver.personalAddress || undefined
    };
  }

  const sortedStops = [...stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const firstStop = sortedStops[0];
  const lastStop = sortedStops[sortedStops.length - 1];

  const firstCoords = resolveStopCoordinates(firstStop, firstStop.schoolName, stops.length);
  const lastCoords = resolveStopCoordinates(lastStop, lastStop.schoolName, stops.length);

  // Pull-out deadhead: Driver Home -> First Stop
  const pullOutMeters = calculateHaversineDistance(
    empCoords.lat,
    empCoords.lng,
    firstCoords.lat,
    firstCoords.lng
  ) * ROAD_CIRCUITY_FACTOR;

  // Pull-in deadhead: Last Stop -> Driver Home
  const pullInMeters = calculateHaversineDistance(
    lastCoords.lat,
    lastCoords.lng,
    empCoords.lat,
    empCoords.lng
  ) * ROAD_CIRCUITY_FACTOR;

  const pullOutKm = Math.round((pullOutMeters / 1000) * 10) / 10;
  const pullInKm = Math.round((pullInMeters / 1000) * 10) / 10;
  const totalDeadheadKm = Math.round((pullOutKm + pullInKm) * 10) / 10;

  const pullOutMinutes = Math.max(1, Math.round((pullOutKm / speedKmH) * 60));
  const pullInMinutes = Math.max(1, Math.round((pullInKm / speedKmH) * 60));
  const totalMinutes = pullOutMinutes + pullInMinutes;

  return {
    hasCoordinates: true,
    pullOutKm,
    pullInKm,
    totalDeadheadKm,
    pullOutMinutes,
    pullInMinutes,
    totalMinutes,
    originAddress: driver.personalAddress || undefined
  };
}

/**
 * Calculates attendant proximity / detour relative to the assigned driver and route origin.
 */
export function calculateAttendantDeadhead(
  attendant: Employee,
  driver: Employee | null,
  stops: AnyStop[],
  speedKmH: number = 30
): AttendantDeadheadResult {
  const attCoords = resolveEmployeeCoordinates(attendant);
  if (!attCoords || stops.length === 0) {
    return {
      hasCoordinates: false,
      distanceToFirstStopKm: 0,
      estimatedMinutes: 0,
      originAddress: attendant.personalAddress || undefined
    };
  }

  const sortedStops = [...stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const firstStop = sortedStops[0];
  const firstCoords = resolveStopCoordinates(firstStop, firstStop.schoolName, stops.length);

  const distToFirstMeters = calculateHaversineDistance(
    attCoords.lat,
    attCoords.lng,
    firstCoords.lat,
    firstCoords.lng
  ) * ROAD_CIRCUITY_FACTOR;
  const distanceToFirstStopKm = Math.round((distToFirstMeters / 1000) * 10) / 10;

  const driverCoords = driver ? resolveEmployeeCoordinates(driver) : null;
  let distanceToDriverKm: number | undefined;
  let detourKm: number | undefined;

  if (driverCoords) {
    const distToDriverMeters = calculateHaversineDistance(
      driverCoords.lat,
      driverCoords.lng,
      attCoords.lat,
      attCoords.lng
    ) * ROAD_CIRCUITY_FACTOR;
    distanceToDriverKm = Math.round((distToDriverMeters / 1000) * 10) / 10;

    // Detour = (Driver -> Attendant + Attendant -> Stop 1) - (Driver -> Stop 1)
    const directDriverToStopMeters = calculateHaversineDistance(
      driverCoords.lat,
      driverCoords.lng,
      firstCoords.lat,
      firstCoords.lng
    ) * ROAD_CIRCUITY_FACTOR;

    const detourMeters = Math.max(0, distToDriverMeters + distToFirstMeters - directDriverToStopMeters);
    detourKm = Math.round((detourMeters / 1000) * 10) / 10;
  }

  const effectiveKm = distanceToDriverKm !== undefined ? distanceToDriverKm : distanceToFirstStopKm;
  const estimatedMinutes = Math.max(1, Math.round((effectiveKm / speedKmH) * 60));

  return {
    hasCoordinates: true,
    distanceToFirstStopKm,
    distanceToDriverKm,
    detourKm,
    estimatedMinutes,
    originAddress: attendant.personalAddress || undefined
  };
}

/**
 * Sorts drivers by shortest total deadhead distance (bus parked at home).
 * Drivers with known coordinates are ranked lowest-deadhead first.
 * Drivers without coordinates are placed cleanly at the end.
 */
export function sortDriversByDeadhead(
  drivers: Employee[],
  stops: AnyStop[],
  speedKmH: number = 30
): { employee: Employee; deadhead: DriverDeadheadResult }[] {
  const mapped = drivers.map((driver) => ({
    employee: driver,
    deadhead: calculateDriverDeadhead(driver, stops, speedKmH)
  }));

  return mapped.sort((a, b) => {
    if (a.deadhead.hasCoordinates && b.deadhead.hasCoordinates) {
      return a.deadhead.totalDeadheadKm - b.deadhead.totalDeadheadKm;
    }
    if (a.deadhead.hasCoordinates && !b.deadhead.hasCoordinates) return -1;
    if (!a.deadhead.hasCoordinates && b.deadhead.hasCoordinates) return 1;
    return a.employee.fullName.localeCompare(b.employee.fullName);
  });
}

/**
 * Sorts attendants by proximity to assigned driver or first stop.
 */
export function sortAttendantsByDeadhead(
  attendants: Employee[],
  driver: Employee | null,
  stops: AnyStop[],
  speedKmH: number = 30
): { employee: Employee; deadhead: AttendantDeadheadResult }[] {
  const mapped = attendants.map((attendant) => ({
    employee: attendant,
    deadhead: calculateAttendantDeadhead(attendant, driver, stops, speedKmH)
  }));

  return mapped.sort((a, b) => {
    // Primary preference: actual 'attendant' job position
    const aIsAtt = (a.employee.jobPosition || '').toLowerCase().includes('attendant');
    const bIsAtt = (b.employee.jobPosition || '').toLowerCase().includes('attendant');
    if (aIsAtt && !bIsAtt) return -1;
    if (!aIsAtt && bIsAtt) return 1;

    if (a.deadhead.hasCoordinates && b.deadhead.hasCoordinates) {
      const aMetric = a.deadhead.distanceToDriverKm ?? a.deadhead.distanceToFirstStopKm;
      const bMetric = b.deadhead.distanceToDriverKm ?? b.deadhead.distanceToFirstStopKm;
      return aMetric - bMetric;
    }
    if (a.deadhead.hasCoordinates && !b.deadhead.hasCoordinates) return -1;
    if (!a.deadhead.hasCoordinates && b.deadhead.hasCoordinates) return 1;
    return a.employee.fullName.localeCompare(b.employee.fullName);
  });
}
