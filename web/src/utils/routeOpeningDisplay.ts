import { CharterTrip, formatCharterStopTime, addMinutesToCharterTime } from '../types/charter';
import { RouteOpening, SanitizedStopPreview } from '../types/routeOpening';

export const isOpeningUnderReview = (op: RouteOpening) => {
  if (op.status === 'reviewing') return true;
  return op.status === 'open' && (op.applicants || []).some((a) => a.status === 'pending');
};

export const getDeadlineStatus = (
  deadlineStr: string,
  labels?: { deadlinePassed?: string; daysLeft?: string; hoursLeft?: string }
) => {
  const deadlineTime = new Date(deadlineStr).getTime();
  const now = Date.now();
  const diff = deadlineTime - now;

  if (isNaN(deadlineTime) || diff <= 0) {
    return {
      isPassed: true,
      label: labels?.deadlinePassed || 'Application Closed',
      color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    };
  }

  const diffHours = Math.floor(diff / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    return {
      isPassed: false,
      label: `${diffDays} ${labels?.daysLeft || 'days left'}`,
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    };
  }
  return {
    isPassed: false,
    label: `${diffHours} ${labels?.hoursLeft || 'hours left'}`,
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };
};

export const resolveOpeningDisplayStops = (
  op: RouteOpening,
  charterTripsById: Record<string, CharterTrip>
): SanitizedStopPreview[] => {
  if (op.postingType === 'charter') {
    const trip = charterTripsById[op.charterTripId || op.routeId];
    const depTime = formatCharterStopTime(trip?.departsAt || op.departsAt) || '08:00';
    const retTime = formatCharterStopTime(trip?.returnsAt || op.returnsAt) || '15:00';

    if (trip && trip.stops && trip.stops.length > 0) {
      if (trip.roundTrip !== false && trip.stops.length === 3) {
        const s0 = trip.stops[0];
        const s1 = trip.stops[1];
        const s2 = trip.stops[2];
        const t0 = formatCharterStopTime(s0.scheduledAt) || depTime;
        const t1 = addMinutesToCharterTime(t0, 30);
        const t2 = formatCharterStopTime(s2.scheduledAt) || retTime;
        const t3 = addMinutesToCharterTime(t2, 30);
        return [
          {
            stopId: s0.id || 'stop-1',
            sequence: 1,
            stopLocation: `Pickup: ${s0.address || 'School'}`,
            stopScheduleTime: t0,
            stopType: 'CharterPickup',
          },
          {
            stopId: s1.id || 'stop-2',
            sequence: 2,
            stopLocation: `Dropoff: ${s1.address || 'Museum'}`,
            stopScheduleTime: t1,
            stopType: 'CharterDestination',
          },
          {
            stopId: 'stop-3',
            sequence: 3,
            stopLocation: `Return Pickup: ${s1.address || 'Library'}`,
            stopScheduleTime: t2,
            stopType: 'CharterPickup',
          },
          {
            stopId: s2.id || 'stop-4',
            sequence: 4,
            stopLocation: `Return Dropoff: ${s2.address || s0.address || 'School'}`,
            stopScheduleTime: t3,
            stopType: 'CharterReturn',
          },
        ];
      }
      return trip.stops.map((s, idx) => {
        const actionLabel =
          s.stopType === 0
            ? 'Pickup'
            : s.stopType === 1
              ? 'Dropoff'
              : s.stopType === 3
                ? 'Return Pickup'
                : 'Return Dropoff';
        const fallbackT =
          idx === 0
            ? depTime
            : idx === 1
              ? addMinutesToCharterTime(depTime, 30)
              : idx === 2
                ? retTime
                : addMinutesToCharterTime(retTime, 30);
        return {
          stopId: s.id || `stop-${idx + 1}`,
          sequence: idx + 1,
          stopLocation: `${actionLabel}: ${s.address}`,
          stopScheduleTime: formatCharterStopTime(s.scheduledAt) || fallbackT,
          stopType: s.stopType === 0 || s.stopType === 3 ? 'CharterPickup' : 'CharterReturn',
        };
      });
    }

    if (op.sanitizedStops && op.sanitizedStops.length === 3) {
      const s0 = op.sanitizedStops[0];
      const s1 = op.sanitizedStops[1];
      const s2 = op.sanitizedStops[2];
      const t0 = formatCharterStopTime(s0.stopScheduleTime) || depTime;
      const t1 = addMinutesToCharterTime(t0, 30);
      const t2 = formatCharterStopTime(s2.stopScheduleTime) || retTime;
      const t3 = addMinutesToCharterTime(t2, 30);
      return [
        { ...s0, sequence: 1, stopScheduleTime: t0 },
        {
          ...s1,
          sequence: 2,
          stopLocation: s1.stopLocation.replace(/^Destination/i, 'Dropoff'),
          stopScheduleTime: t1,
        },
        {
          ...s1,
          stopId: 'stop-3',
          sequence: 3,
          stopLocation: s1.stopLocation.replace(/^(Destination|Dropoff)/i, 'Return Pickup'),
          stopScheduleTime: t2,
          stopType: 'CharterPickup',
        },
        {
          ...s2,
          stopId: 'stop-4',
          sequence: 4,
          stopLocation: s2.stopLocation.replace(/^Return/i, 'Return Dropoff'),
          stopScheduleTime: t3,
          stopType: 'CharterReturn',
        },
      ];
    }
  }
  return op.sanitizedStops || [];
};

export const computeOpeningsKpi = (openings: RouteOpening[]) => {
  let openForBidding = 0;
  let reviewing = 0;
  let awarded = 0;
  for (const o of openings) {
    if (o.status === 'open') openForBidding += 1;
    if (isOpeningUnderReview(o)) reviewing += 1;
    if (o.status === 'awarded') awarded += 1;
  }
  return { total: openings.length, openForBidding, reviewing, awarded };
};
