import { RouteStop } from '../types/route';
import { resolveStopCoordinates } from './geoUtils';

export interface OptimizationOptions {
  shiftType?: string; // 'AM' | 'PM' | 'Midday'
  driverCoords?: { lat: number; lng: number } | null;
  includeDriverHome?: boolean;
  recalculateTimes?: boolean;
  dwellMinutes?: number; // default: 3
  averageSpeedKmH?: number; // default: 30
  schoolBoardOrRouteName?: string;
}

export interface OptimizationResult {
  optimizedStops: RouteStop[];
  originalDistanceMeters: number;
  optimizedDistanceMeters: number;
  savedDistanceMeters: number;
  savingsPercentage: number;
  originalDurationMinutes: number;
  optimizedDurationMinutes: number;
}

/**
 * Great-circle distance between two coordinates using the Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Parse HH:MM into total minutes from midnight
 */
export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr || !timeStr.includes(':')) return 7 * 60 + 30; // default 07:30
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Format minutes from midnight into 24h "HH:MM" or 12h format
 */
export function formatMinutesToTime(totalMinutes: number, use12hFormat?: boolean): string {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  let h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const mStr = m.toString().padStart(2, '0');

  if (use12hFormat) {
    const suffix = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mStr} ${suffix}`;
  }

  return `${h.toString().padStart(2, '0')}:${mStr}`;
}

/**
 * Check whether a stop is a school destination / origin
 */
export function checkIsSchoolStop(
  stop: RouteStop,
  _shiftSchools?: string,
  isLastStop?: boolean,
  isFirstStop?: boolean,
  shiftType?: string
): boolean {
  const type = (stop.stopType || '').toLowerCase().trim();

  // If stopType indicates Home, Corner, or Yard, it is definitely a STUDENT stop, NOT a school stop
  if (
    type === 'homepickup' ||
    type === 'homedropoff' ||
    type.includes('home') ||
    type.includes('corner') ||
    type.includes('yard')
  ) {
    return false;
  }

  // Explicit school stopType (SchoolDropoff, SchoolPickup, or contains 'school')
  if (
    type === 'schooldropoff' ||
    type === 'schoolpickup' ||
    (type.includes('school') && !type.includes('home'))
  ) {
    return true;
  }

  if (stop.schoolId && stop.schoolId > 0) return true;
  if (stop.schoolName && stop.schoolName.trim().length > 0) return true;

  // Fallback when stopType is empty / undefined
  if (!type) {
    const loc = (stop.stopLocation || '').toLowerCase().trim();
    const isSchoolAddress =
      loc.startsWith('école') ||
      loc.startsWith('ecole') ||
      loc.includes('high school') ||
      loc.includes('elementary school') ||
      loc.includes('collegiate') ||
      loc.includes('public school');

    if (isSchoolAddress) {
      return true;
    }

    const isAM = (shiftType || '').toUpperCase().includes('AM');
    const isPM = (shiftType || '').toUpperCase().includes('PM');
    if (isAM && isLastStop) return true;
    if (isPM && isFirstStop) return true;
  }

  return false;
}

/**
 * Recalculate scheduled pullaway times based on stop order, travel distance, and dwell minutes.
 * Crucial rule: The school stop's scheduled time (pullawayTime) must NEVER be modified!
 * - AM shifts (or School at the end): School arrival/pullaway time is locked (e.g. bell time 08:30).
 *   Student stops are calculated backwards from the school stop time.
 * - PM shifts (or School at the beginning): School departure time is locked (e.g. dismissal 14:45).
 *   Student stops are calculated forward from the school stop time.
 * - If school is in the middle: Stops before school are calculated backward; stops after are calculated forward.
 */
export function recalculateStopTimes(
  stops: RouteStop[],
  dwellMinutes: number = 3,
  speedKmH: number = 30,
  schoolBoardOrRouteName?: string,
  shiftType?: string
): RouteStop[] {
  if (stops.length === 0) return [];

  const totalStops = stops.length;
  // Resolve stop coordinates
  const stopsWithCoords = stops.map((s) => ({
    ...s,
    coords: resolveStopCoordinates(s, schoolBoardOrRouteName || s.schoolName, totalStops)
  }));

  // Detect if original times use 12h format
  const is12h = stops.some(
    (s) =>
      s.pullawayTime &&
      (s.pullawayTime.toLowerCase().includes('am') ||
        s.pullawayTime.toLowerCase().includes('pm') ||
        s.pullawayTime.toLowerCase().includes('a.m.') ||
        s.pullawayTime.toLowerCase().includes('p.m.'))
  );

  // Find school stop
  const schoolIdx = stops.findIndex((s, idx) =>
    checkIsSchoolStop(s, schoolBoardOrRouteName, idx === totalStops - 1, idx === 0, shiftType)
  );

  const updated: RouteStop[] = new Array(totalStops);

  // Helper to calculate travel minutes between two stops
  const getTravelMinutes = (fromIdx: number, toIdx: number): number => {
    const c1 = stopsWithCoords[fromIdx].coords;
    const c2 = stopsWithCoords[toIdx].coords;
    const distMeters = calculateHaversineDistance(c1.lat, c1.lng, c2.lat, c2.lng);
    const distKm = distMeters / 1000;
    return Math.max(1, Math.round((distKm / speedKmH) * 60));
  };

  if (schoolIdx !== -1) {
    const schoolStop = stopsWithCoords[schoolIdx];
    // Keep school stop's original times completely untouched
    const originalSchoolPullaway = schoolStop.pullawayTime || '08:30';
    const originalSchoolArrival = schoolStop.actualArrivalTime || originalSchoolPullaway;
    const schoolTargetMinutes = parseTimeToMinutes(originalSchoolPullaway);

    updated[schoolIdx] = {
      ...schoolStop,
      sequence: schoolIdx + 1,
      pullawayTime: originalSchoolPullaway,
      actualArrivalTime: originalSchoolArrival
    };

    // 1. Calculate stops preceding the school backward from schoolTargetMinutes
    // The bus departs the stop right before school and arrives at school at schoolTargetMinutes
    let nextArrivalMinutes = schoolTargetMinutes;

    for (let i = schoolIdx - 1; i >= 0; i--) {
      const travelMins = getTravelMinutes(i, i + 1);
      const pullawayMins = nextArrivalMinutes - travelMins;
      const arrivalMins = pullawayMins - dwellMinutes;

      updated[i] = {
        ...stopsWithCoords[i],
        sequence: i + 1,
        actualArrivalTime: formatMinutesToTime(arrivalMins, is12h),
        pullawayTime: formatMinutesToTime(pullawayMins, is12h)
      };

      nextArrivalMinutes = arrivalMins;
    }

    // 2. Calculate stops following the school forward from schoolTargetMinutes
    // The bus departs the school at schoolTargetMinutes and heads to next stops
    let prevPullawayMinutes = schoolTargetMinutes;

    for (let i = schoolIdx + 1; i < totalStops; i++) {
      const travelMins = getTravelMinutes(i - 1, i);
      const arrivalMins = prevPullawayMinutes + travelMins;
      const pullawayMins = arrivalMins + dwellMinutes;

      updated[i] = {
        ...stopsWithCoords[i],
        sequence: i + 1,
        actualArrivalTime: formatMinutesToTime(arrivalMins, is12h),
        pullawayTime: formatMinutesToTime(pullawayMins, is12h)
      };

      prevPullawayMinutes = pullawayMins;
    }
  } else {
    // Fallback: No school stop found, calculate forward starting from stop 0
    let currentMinutes = parseTimeToMinutes(stops[0].pullawayTime || '07:30');

    for (let i = 0; i < totalStops; i++) {
      const current = stopsWithCoords[i];

      if (i > 0) {
        const travelMins = getTravelMinutes(i - 1, i);
        currentMinutes += travelMins;
      }

      const arrivalTime = formatMinutesToTime(currentMinutes, is12h);
      currentMinutes += dwellMinutes;
      const pullawayTime = formatMinutesToTime(currentMinutes, is12h);

      updated[i] = {
        ...current,
        sequence: i + 1,
        actualArrivalTime: arrivalTime,
        pullawayTime
      };
    }
  }

  return updated;
}

/**
 * Calculate total route distance in meters for an ordered sequence of stops
 */
export function calculateTotalRouteDistance(
  stops: RouteStop[],
  schoolBoardOrRouteName?: string
): number {
  if (stops.length < 2) return 0;
  const totalStops = stops.length;
  let totalMeters = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const c1 = resolveStopCoordinates(stops[i], schoolBoardOrRouteName, totalStops);
    const c2 = resolveStopCoordinates(stops[i + 1], schoolBoardOrRouteName, totalStops);
    totalMeters += calculateHaversineDistance(c1.lat, c1.lng, c2.lat, c2.lng);
  }

  return totalMeters;
}

/**
 * Optimize Stop Sequence using Constrained 2-Opt TSP
 * - Respects School stop anchors (AM: School is final stop; PM: School is first stop)
 * - Optionally incorporates Driver's Home location as origin (AM) or destination (PM)
 * - Untangles criss-crossing paths with 2-Opt local search
 */
export function optimizeStopSequence(
  stops: RouteStop[],
  options: OptimizationOptions = {}
): OptimizationResult {
  if (stops.length <= 2) {
    const origDist = calculateTotalRouteDistance(stops, options.schoolBoardOrRouteName);
    return {
      optimizedStops: stops,
      originalDistanceMeters: origDist,
      optimizedDistanceMeters: origDist,
      savedDistanceMeters: 0,
      savingsPercentage: 0,
      originalDurationMinutes: Math.round((origDist / 1000 / (options.averageSpeedKmH || 30)) * 60),
      optimizedDurationMinutes: Math.round((origDist / 1000 / (options.averageSpeedKmH || 30)) * 60)
    };
  }

  const shiftType = (options.shiftType || 'AM').toUpperCase();
  const isPM = shiftType === 'PM';
  const dwellMinutes = options.dwellMinutes ?? 3;
  const speedKmH = options.averageSpeedKmH ?? 30;
  const totalStops = stops.length;

  const originalDistance = calculateTotalRouteDistance(stops, options.schoolBoardOrRouteName);

  // Identify school stop vs student stops
  const schoolStop = stops.find((s, idx) =>
    checkIsSchoolStop(s, options.schoolBoardOrRouteName, idx === totalStops - 1, idx === 0, shiftType)
  );
  const studentStops = stops.filter((s) => s !== schoolStop);

  if (!schoolStop || studentStops.length <= 1) {
    // Cannot optimize without school + at least 2 student stops
    return {
      optimizedStops: stops,
      originalDistanceMeters: originalDistance,
      optimizedDistanceMeters: originalDistance,
      savedDistanceMeters: 0,
      savingsPercentage: 0,
      originalDurationMinutes: Math.round((originalDistance / 1000 / speedKmH) * 60),
      optimizedDurationMinutes: Math.round((originalDistance / 1000 / speedKmH) * 60)
    };
  }

  // Pre-resolve coordinates for student stops & school
  const studentItems = studentStops.map((s) => ({
    stop: s,
    coords: resolveStopCoordinates(s, options.schoolBoardOrRouteName, totalStops)
  }));

  const schoolCoords = resolveStopCoordinates(schoolStop, options.schoolBoardOrRouteName, totalStops);

  let orderedStudentItems: typeof studentItems = [];

  // Determine starting point
  if (isPM) {
    // PM Shift: School is start anchor (sequence 1)
    // Step 1: Greedy Nearest-Neighbor starting from School
    const remaining = [...studentItems];
    let currentPoint = schoolCoords;

    while (remaining.length > 0) {
      let bestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const d = calculateHaversineDistance(
          currentPoint.lat,
          currentPoint.lng,
          remaining[i].coords.lat,
          remaining[i].coords.lng
        );
        if (d < minDistance) {
          minDistance = d;
          bestIdx = i;
        }
      }

      const [nextStop] = remaining.splice(bestIdx, 1);
      orderedStudentItems.push(nextStop);
      currentPoint = nextStop.coords;
    }
  } else {
    // AM Shift: School is end anchor (final dropoff)
    // Step 1: Determine first pickup stop
    let firstIdx = 0;

    if (options.includeDriverHome && options.driverCoords) {
      // Pick student stop closest to driver's home
      let minDistToDriver = Infinity;
      studentItems.forEach((item, idx) => {
        const d = calculateHaversineDistance(
          options.driverCoords!.lat,
          options.driverCoords!.lng,
          item.coords.lat,
          item.coords.lng
        );
        if (d < minDistToDriver) {
          minDistToDriver = d;
          firstIdx = idx;
        }
      });
    } else {
      // Pick student stop furthest from school as initial pickup
      let maxDistToSchool = -Infinity;
      studentItems.forEach((item, idx) => {
        const d = calculateHaversineDistance(
          schoolCoords.lat,
          schoolCoords.lng,
          item.coords.lat,
          item.coords.lng
        );
        if (d > maxDistToSchool) {
          maxDistToSchool = d;
          firstIdx = idx;
        }
      });
    }

    const remaining = [...studentItems];
    const [startStop] = remaining.splice(firstIdx, 1);
    orderedStudentItems.push(startStop);
    let currentPoint = startStop.coords;

    // Greedy Nearest-Neighbor through remaining student stops
    while (remaining.length > 0) {
      let bestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const d = calculateHaversineDistance(
          currentPoint.lat,
          currentPoint.lng,
          remaining[i].coords.lat,
          remaining[i].coords.lng
        );
        if (d < minDistance) {
          minDistance = d;
          bestIdx = i;
        }
      }

      const [nextStop] = remaining.splice(bestIdx, 1);
      orderedStudentItems.push(nextStop);
      currentPoint = nextStop.coords;
    }
  }

  // Construct working sequence with anchors
  let fullList: { stop: RouteStop; coords: { lat: number; lng: number } }[] = isPM
    ? [{ stop: schoolStop, coords: schoolCoords }, ...orderedStudentItems]
    : [...orderedStudentItems, { stop: schoolStop, coords: schoolCoords }];

  // Step 2: 2-Opt Local Search to eliminate crossing edges
  // AM: Anchor is at index N-1 (school). PM: Anchor is at index 0 (school).
  const startIndex = isPM ? 1 : 0;
  const endIndex = isPM ? fullList.length - 1 : fullList.length - 2;

  let improved = true;
  let iterations = 0;
  const maxIterations = 150;

  const getDistance = (i: number, j: number) =>
    calculateHaversineDistance(
      fullList[i].coords.lat,
      fullList[i].coords.lng,
      fullList[j].coords.lat,
      fullList[j].coords.lng
    );

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = startIndex; i < endIndex; i++) {
      for (let j = i + 1; j <= endIndex; j++) {
        const prevIdx = i > 0 ? i - 1 : 0;
        const nextIdx = j < fullList.length - 1 ? j + 1 : fullList.length - 1;

        if (prevIdx === i || nextIdx === j) continue;

        const currentDist = getDistance(prevIdx, i) + getDistance(j, nextIdx);
        const newDist = getDistance(prevIdx, j) + getDistance(i, nextIdx);

        if (newDist + 1e-4 < currentDist) {
          // Reverse subsegment from i to j
          const sub = fullList.slice(i, j + 1).reverse();
          fullList.splice(i, sub.length, ...sub);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  // Extract raw optimized stops
  let resultStops = fullList.map((item) => item.stop);

  // Recalculate scheduled times if enabled
  if (options.recalculateTimes !== false) {
    resultStops = recalculateStopTimes(
      resultStops,
      dwellMinutes,
      speedKmH,
      options.schoolBoardOrRouteName,
      shiftType
    );
  } else {
    // Re-index sequences only
    resultStops = resultStops.map((s, idx) => ({
      ...s,
      sequence: idx + 1
    }));
  }

  const optimizedDistance = calculateTotalRouteDistance(resultStops, options.schoolBoardOrRouteName);
  const savedDistance = Math.max(0, originalDistance - optimizedDistance);
  const savingsPercentage = originalDistance > 0 ? Math.round((savedDistance / originalDistance) * 1000) / 10 : 0;

  const originalDurationMinutes = Math.round((originalDistance / 1000 / speedKmH) * 60) + stops.length * dwellMinutes;
  const optimizedDurationMinutes = Math.round((optimizedDistance / 1000 / speedKmH) * 60) + stops.length * dwellMinutes;

  return {
    optimizedStops: resultStops,
    originalDistanceMeters: originalDistance,
    optimizedDistanceMeters: optimizedDistance,
    savedDistanceMeters: savedDistance,
    savingsPercentage,
    originalDurationMinutes,
    optimizedDurationMinutes
  };
}
