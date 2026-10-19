import { RouteStop } from '../types/route';
import { DispatchShiftStop } from '../types/dispatch';
import { SanitizedStopPreview } from '../types/routeOpening';
import { resolveStopCoordinates } from './geoUtils';

/**
 * Sanitizes stops for candidate drivers and attendants to preview.
 * Strips all confidential student names, IDs, grades, and parent contacts.
 */
export function sanitizeStopsForPublicViewing(
  stops: (RouteStop | DispatchShiftStop)[],
  schoolHint?: string
): SanitizedStopPreview[] {
  if (!stops || !Array.isArray(stops)) return [];

  const totalStops = stops.length;

  return stops.map((s, idx) => {
    const rawStop = s as any;
    const sequence = typeof rawStop.sequence === 'number' ? rawStop.sequence : idx + 1;
    const stopId = rawStop.stopId || rawStop.id || `stop-${idx + 1}`;
    const stopLocation = rawStop.stopLocation || rawStop.location || 'Scheduled Stop';
    const stopScheduleTime =
      rawStop.pullawayTime || rawStop.stopScheduleTime || rawStop.scheduledTime || rawStop.time || '';
    const rawType = String(rawStop.stopType || '');
    const stopType = rawType.toLowerCase().includes('school') ? 'school' : (rawType || 'pickup');
    const schoolName = rawStop.schoolName || undefined;

    const resolved = resolveStopCoordinates(
      { ...rawStop, sequence, stopLocation },
      schoolHint || schoolName || '',
      totalStops
    );

    const latitude =
      typeof rawStop.latitude === 'number' && !isNaN(rawStop.latitude) && rawStop.latitude !== 0
        ? rawStop.latitude
        : resolved.lat;
    const longitude =
      typeof rawStop.longitude === 'number' && !isNaN(rawStop.longitude) && rawStop.longitude !== 0
        ? rawStop.longitude
        : resolved.lng;

    return {
      stopId,
      sequence,
      stopLocation,
      stopScheduleTime,
      stopType,
      schoolName,
      latitude,
      longitude
    };
  });
}
