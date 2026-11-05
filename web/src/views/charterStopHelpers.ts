import { CharterStop, CharterTrip, addMinutesToCharterTime, buildCharterSimpleStops, formatCharterStopTime } from '../types/charter';
import { RouteOpening } from '../types/routeOpening';
import { getLocalTodayString } from '../utils/dateUtils';

export const normalizeCharterTripStops = (trip: CharterTrip, existingOp?: RouteOpening): CharterStop[] => {
  const rawStops = trip.stops || [];
  const dateStr = trip.dispatchDate || trip.departsAt?.slice(0, 10) || getLocalTodayString();
  const depTime = formatCharterStopTime(trip.departsAt) || '08:00';
  const retTime = formatCharterStopTime(trip.returnsAt) || '15:00';

  if (
    trip.roundTrip !== false &&
    rawStops.length === 3 &&
    rawStops[0]?.stopType === 0 &&
    rawStops[1]?.stopType === 1 &&
    rawStops[2]?.stopType === 2
  ) {
    const s1Time = formatCharterStopTime(rawStops[0].scheduledAt) || depTime;
    const s2Time = addMinutesToCharterTime(s1Time, 30);
    const s3Time = formatCharterStopTime(rawStops[2].scheduledAt) || retTime;
    const s4Time = addMinutesToCharterTime(s3Time, 30);

    return [
      {
        ...rawStops[0],
        id: rawStops[0].id || `ST-${trip.id}-1`,
        sequenceOrder: 1,
        stopType: 0,
        locationName: 'Pickup',
        address: rawStops[0].address || 'School',
        scheduledAt: `${dateStr}T${s1Time}`,
      },
      {
        ...rawStops[1],
        id: rawStops[1].id || `ST-${trip.id}-2`,
        sequenceOrder: 2,
        stopType: 1,
        locationName: 'Dropoff',
        address: rawStops[1].address || 'Destination',
        scheduledAt: `${dateStr}T${s2Time}`,
      },
      {
        id: `ST-${trip.id}-3`,
        charterTripId: trip.id,
        sequenceOrder: 3,
        stopType: 3,
        locationName: 'Return Pickup',
        address: rawStops[1].address || 'Destination',
        scheduledAt: `${dateStr}T${s3Time}`,
      },
      {
        ...rawStops[2],
        id: `ST-${trip.id}-4`,
        sequenceOrder: 4,
        stopType: 2,
        locationName: 'Return Dropoff',
        address: rawStops[2].address || rawStops[0].address || 'School',
        scheduledAt: `${dateStr}T${s4Time}`,
      },
    ];
  }

  if (rawStops.length === 0) {
    return buildCharterSimpleStops({
      tripId: trip.id || 'temp',
      fromAddress: 'School',
      toAddress: 'Destination',
      roundTrip: trip.roundTrip !== false,
      departsAt: `${dateStr}T${depTime}`,
      returnsAt: `${dateStr}T${retTime}`,
    });
  }

  return rawStops.map((s, idx) => {
    const fromOp = existingOp?.sanitizedStops?.find(
      (ss) => String(ss.stopId) === String(s.id) || ss.sequence === (s.sequenceOrder || idx + 1)
    )?.stopScheduleTime;
    const resolvedTime =
      formatCharterStopTime(fromOp) ||
      formatCharterStopTime(s.scheduledAt) ||
      (idx === 0
        ? depTime
        : idx === 1
        ? addMinutesToCharterTime(depTime, 30)
        : idx === 2
        ? retTime
        : addMinutesToCharterTime(retTime, 30));
    return {
      ...s,
      sequenceOrder: idx + 1,
      scheduledAt: `${dateStr}T${resolvedTime}`,
    };
  });
};


export const resolveDefaultStopTime = (trip: CharterTrip, stop: CharterStop, idx: number, existingOp?: RouteOpening): string => {
  const fromExistingOp = existingOp?.sanitizedStops?.find(
    (ss) => String(ss.stopId) === String(stop.id) || ss.sequence === (stop.sequenceOrder || idx + 1)
  )?.stopScheduleTime;
  if (fromExistingOp && formatCharterStopTime(fromExistingOp)) {
    return formatCharterStopTime(fromExistingOp);
  }
  const fromStop = formatCharterStopTime(stop.scheduledAt);
  if (fromStop) return fromStop;

  const depTime = formatCharterStopTime(trip.departsAt) || '08:00';
  const retTime = formatCharterStopTime(trip.returnsAt) || '15:00';
  if (idx === 0 || stop.stopType === 0) return depTime;
  if (idx === 1 || stop.stopType === 1) return addMinutesToCharterTime(depTime, 30);
  if (idx === 2 || stop.stopType === 3) return retTime;
  if (idx === 3 || stop.stopType === 2) return addMinutesToCharterTime(retTime, 30);
  return depTime;
};
