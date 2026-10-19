import { RouteStop } from '../types/route';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

/**
 * Resolves the actual bus stopping coordinates.
 * Priority:
 * 1. Explicit custom pickupLatitude / pickupLongitude if relocated
 * 2. Standard latitude / longitude
 * 3. Ottawa landmark / corridor interpolation fallback
 */
export function resolveStopCoordinates(
  stop: RouteStop | {
    latitude?: number;
    longitude?: number;
    stopLocation?: string;
    sequence?: number;
    schoolName?: string;
    pickupLatitude?: number;
    pickupLongitude?: number;
  },
  schoolName?: string,
  totalStops: number = 7
): LatLngPoint {
  // 1. If explicit custom bus pickup coordinates exist, use them
  if (
    typeof stop.pickupLatitude === 'number' &&
    typeof stop.pickupLongitude === 'number' &&
    stop.pickupLatitude !== 0 &&
    stop.pickupLongitude !== 0 &&
    !isNaN(stop.pickupLatitude) &&
    !isNaN(stop.pickupLongitude)
  ) {
    return { lat: stop.pickupLatitude, lng: stop.pickupLongitude };
  }

  // 2. If explicit standard coordinates exist, use them
  if (
    typeof stop.latitude === 'number' &&
    typeof stop.longitude === 'number' &&
    stop.latitude !== 0 &&
    stop.longitude !== 0 &&
    !isNaN(stop.latitude) &&
    !isNaN(stop.longitude)
  ) {
    return { lat: stop.latitude, lng: stop.longitude };
  }

  const loc = (stop.stopLocation || '').toLowerCase();
  const sch = (stop.schoolName || schoolName || '').toLowerCase();

  // 2. Direct Ottawa landmarks & known street intersections
  if (loc.includes('baseline') && loc.includes('woodroffe')) {
    return { lat: 45.35125, lng: -75.76015 };
  }
  if (loc.includes('woodroffe') && loc.includes('richmond')) {
    return { lat: 45.3685, lng: -75.7572 };
  }
  if (loc.includes('carling') && (loc.includes('broadview') || loc.includes('woodroffe'))) {
    return { lat: 45.3724, lng: -75.7589 };
  }
  if (loc.includes('fraser') || loc.includes('450 fraser')) {
    return { lat: 45.3881, lng: -75.7482 };
  }
  if (loc.includes('merivale')) {
    return { lat: 45.3512, lng: -75.7601 };
  }
  if (loc.includes('oak st')) {
    return { lat: 45.375, lng: -75.745 };
  }
  if (loc.includes('pine rd')) {
    return { lat: 45.369, lng: -75.752 };
  }
  if (loc.includes('dauphin') || loc.includes('hillcrest')) {
    return { lat: 45.405, lng: -75.642 };
  }
  if (loc.includes('cedar blvd') || loc.includes('gloucester')) {
    return { lat: 45.385, lng: -75.715 };
  }
  if (loc.includes('orleans')) {
    return { lat: 45.435, lng: -75.685 };
  }
  if (loc.includes('kanata')) {
    return { lat: 45.335, lng: -75.785 };
  }
  if (loc.includes('nepean') && loc.includes('maple')) {
    return { lat: 45.365, lng: -75.735 };
  }

  // 3. School destinations
  if (loc.includes('broadview') || sch.includes('broadview')) {
    return { lat: 45.37896, lng: -75.76102 };
  }
  if (loc.includes('nepean') || sch.includes('nepean')) {
    return { lat: 45.38552, lng: -75.75485 };
  }
  if (loc.includes('patrick') || sch.includes('patrick')) {
    return { lat: 45.412, lng: -75.689 };
  }
  if (loc.includes('westbrook') || sch.includes('westbrook')) {
    return { lat: 45.362, lng: -75.748 };
  }

  // 4. Transit corridor interpolation between depot and destination school
  let destLat = 45.37896;
  let destLng = -75.76102;
  if (sch.includes('nepean')) {
    destLat = 45.38552;
    destLng = -75.75485;
  } else if (sch.includes('hillcrest') || loc.includes('hillcrest')) {
    destLat = 45.405;
    destLng = -75.642;
  }

  const startLat = 45.3485;
  const startLng = -75.768;

  const seq = Math.max(1, stop.sequence || 1);
  const maxSeq = Math.max(2, totalStops || 7);
  const fraction = Math.min(0.9, Math.max(0.1, (seq - 1) / (maxSeq - 1)));

  // Add slight deterministic geographic offset for realistic road scatter
  const scatterLat = ((seq * 13) % 7 - 3) * 0.0022;
  const scatterLng = ((seq * 17) % 7 - 3) * 0.0028;

  const lat = Math.round((startLat + fraction * (destLat - startLat) + scatterLat) * 1e5) / 1e5;
  const lng = Math.round((startLng + fraction * (destLng - startLng) + scatterLng) * 1e5) / 1e5;

  return { lat, lng };
}

/**
 * Resolves the student's original home address coordinates (ignoring any relocated bus stopping point).
 */
export function resolveHomeCoordinates(
  stop: RouteStop,
  schoolName?: string,
  totalStops: number = 7
): LatLngPoint {
  // If original latitude/longitude exists on stop, use it as the home coordinate
  if (
    typeof stop.latitude === 'number' &&
    typeof stop.longitude === 'number' &&
    stop.latitude !== 0 &&
    stop.longitude !== 0 &&
    !isNaN(stop.latitude) &&
    !isNaN(stop.longitude)
  ) {
    return { lat: stop.latitude, lng: stop.longitude };
  }

  // Otherwise fallback to stopLocation based resolution without custom pickup coordinates
  const stopWithoutCustom: RouteStop = {
    ...stop,
    pickupLatitude: undefined,
    pickupLongitude: undefined
  };
  return resolveStopCoordinates(stopWithoutCustom, schoolName, totalStops);
}
