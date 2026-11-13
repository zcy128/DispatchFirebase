import { BusRoute, BusRouteShift } from '../types/route';
import { TemporaryAssignment } from '../types/dispatch';
import { RouteOpening } from '../types/routeOpening';

export type TemporaryCoverPhase = 'active_now' | 'upcoming';

export interface RouteTemporaryCoverItem {
  assignment: TemporaryAssignment;
  phase: TemporaryCoverPhase;
  nextEffectiveDate: string;
  dateSummary: string;
}

export interface RouteScheduledOpeningItem {
  opening: RouteOpening;
  kind: 'scheduled_permanent' | 'scheduled_temporary' | 'open_posting';
}

export interface RouteShiftOverrideItem {
  shift: BusRouteShift;
  differsDriver: boolean;
  differsVehicle: boolean;
  differsAttendant: boolean;
}

export interface RouteScheduleSummary {
  temporaryCovers: RouteTemporaryCoverItem[];
  scheduledOpenings: RouteScheduledOpeningItem[];
  shiftOverrides: RouteShiftOverrideItem[];
  upcomingAndActiveCount: number;
}

function normalizeStr(v?: string | null): string {
  return (v || '').trim().toLowerCase();
}

export function matchesRouteReference(
  route: Pick<BusRoute, 'id' | 'routeNo'>,
  itemRouteId?: string,
  itemRouteNo?: string
): boolean {
  if (itemRouteId && route.id && itemRouteId.trim() === route.id.trim()) {
    return true;
  }
  const rNo = normalizeStr(route.routeNo);
  const iNo = normalizeStr(itemRouteNo);
  return Boolean(rNo && iNo && rNo === iNo);
}

/**
 * Formats YYYY-MM-DD with short weekday (e.g., "2026-11-20 (Fri)") using local date parts.
 */
export function formatDateWithWeekday(dateStr: string, isFrench = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString(isFrench ? 'fr-CA' : 'en-CA', { weekday: 'short' });
  return `${dateStr} (${weekday})`;
}

function isOpeningExpired(opening: RouteOpening, todayStr: string): boolean {
  if (opening.effectiveEndDate && opening.effectiveEndDate < todayStr) {
    return true;
  }
  if (
    opening.postingType === 'temporary' &&
    !opening.effectiveEndDate &&
    opening.effectiveStartDate &&
    opening.effectiveStartDate < todayStr
  ) {
    return true;
  }
  if (opening.deadline) {
    const deadlineDate = opening.deadline.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineDate) && deadlineDate < todayStr) {
      return true;
    }
  }
  return false;
}

export function buildRouteScheduleSummary(params: {
  route: BusRoute;
  shifts?: BusRouteShift[];
  temporaryAssignments: TemporaryAssignment[];
  routeOpenings: RouteOpening[];
  todayStr: string;
  isFrench?: boolean;
}): RouteScheduleSummary {
  const {
    route,
    shifts = [],
    temporaryAssignments,
    routeOpenings,
    todayStr,
    isFrench = false,
  } = params;

  // 1. Active & upcoming temporary assignments for this route
  const temporaryCovers: RouteTemporaryCoverItem[] = [];
  const coveredOpeningIds = new Set<string>();
  const matchedTempAssignmentIds = new Set<string>();

  for (const ta of temporaryAssignments) {
    if (!matchesRouteReference(route, ta.routeId, ta.routeNo)) continue;
    const status = normalizeStr(ta.status || 'active');
    if (status === 'cancelled' || status === 'completed') continue;

    const specificDates = Array.isArray(ta.specificDates)
      ? [...ta.specificDates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
      : [];

    let phase: TemporaryCoverPhase | null = null;
    let nextEffectiveDate = ta.startDate || '';
    let dateSummary = '';

    if (specificDates.length > 0) {
      const futureOrToday = specificDates.filter((d) => d >= todayStr);
      if (futureOrToday.length === 0) continue;
      phase = specificDates.includes(todayStr) ? 'active_now' : 'upcoming';
      nextEffectiveDate = futureOrToday[0];
      dateSummary = futureOrToday.map((d) => formatDateWithWeekday(d, isFrench)).join(', ');
    } else {
      const start = ta.startDate || '';
      const end = ta.endDate || start;
      if (!start || end < todayStr) continue;
      phase = start <= todayStr && end >= todayStr ? 'active_now' : 'upcoming';
      nextEffectiveDate = phase === 'active_now' ? todayStr : start;
      dateSummary =
        start === end
          ? formatDateWithWeekday(start, isFrench)
          : `${formatDateWithWeekday(start, isFrench)} -> ${formatDateWithWeekday(end, isFrench)}`;
    }

    matchedTempAssignmentIds.add(ta.id);
    const fromOpeningId = (ta as TemporaryAssignment & { fromRouteOpeningId?: string }).fromRouteOpeningId;
    if (fromOpeningId) {
      coveredOpeningIds.add(fromOpeningId);
    }

    temporaryCovers.push({
      assignment: ta,
      phase,
      nextEffectiveDate,
      dateSummary,
    });
  }

  temporaryCovers.sort((a, b) => {
    if (a.phase !== b.phase) {
      return a.phase === 'active_now' ? -1 : 1;
    }
    return a.nextEffectiveDate.localeCompare(b.nextEffectiveDate);
  });

  // 2. Route openings: scheduled future permanent awards, awarded temporary awards without TA, or open/reviewing postings
  const scheduledOpenings: RouteScheduledOpeningItem[] = [];

  for (const opening of routeOpenings) {
    if (!matchesRouteReference(route, opening.routeId, opening.routeNo)) continue;
    if (opening.status === 'cancelled') continue;

    if (opening.status === 'open' || opening.status === 'reviewing') {
      if (isOpeningExpired(opening, todayStr)) continue;
      scheduledOpenings.push({
        opening,
        kind: 'open_posting',
      });
      continue;
    }

    if (opening.status === 'awarded') {
      if (opening.postingType === 'permanent') {
        const isNotExpiredAndUnapplied =
          !opening.crewAppliedToRoute &&
          (!opening.effectiveStartDate || opening.effectiveStartDate >= todayStr);
        if (isNotExpiredAndUnapplied) {
          scheduledOpenings.push({
            opening,
            kind: 'scheduled_permanent',
          });
        }
      } else if (opening.postingType === 'temporary') {
        const alreadyLinked =
          coveredOpeningIds.has(opening.id) ||
          Boolean(opening.temporaryAssignmentId && matchedTempAssignmentIds.has(opening.temporaryAssignmentId));
        const effectiveEnd = opening.effectiveEndDate || opening.effectiveStartDate || '';
        if (!alreadyLinked && effectiveEnd >= todayStr) {
          scheduledOpenings.push({
            opening,
            kind: 'scheduled_temporary',
          });
        }
      }
    }
  }

  scheduledOpenings.sort((a, b) => {
    const order = { scheduled_permanent: 0, scheduled_temporary: 1, open_posting: 2 };
    if (order[a.kind] !== order[b.kind]) {
      return order[a.kind] - order[b.kind];
    }
    return (a.opening.effectiveStartDate || '').localeCompare(b.opening.effectiveStartDate || '');
  });

  // 3. Shift-level custom crew overrides compared to standing route crew
  const shiftOverrides: RouteShiftOverrideItem[] = [];
  for (const shift of shifts) {
    const differsDriver = Boolean(
      shift.driverId && normalizeStr(shift.driverId) !== normalizeStr(route.driverId)
    ) || Boolean(
      shift.driverName && normalizeStr(shift.driverName) !== normalizeStr(route.driverName)
    );
    const differsVehicle = Boolean(
      shift.unitNumber && normalizeStr(shift.unitNumber) !== normalizeStr(route.unitNumber)
    );
    const differsAttendant = Boolean(
      (shift.attendantId || '') !== (route.attendantId || '') &&
        (shift.attendantId || shift.attendantName)
    );

    if (shift.isCustomCrew || differsDriver || differsVehicle || differsAttendant) {
      shiftOverrides.push({
        shift,
        differsDriver,
        differsVehicle,
        differsAttendant,
      });
    }
  }

  return {
    temporaryCovers,
    scheduledOpenings,
    shiftOverrides,
    upcomingAndActiveCount: temporaryCovers.length + scheduledOpenings.length,
  };
}
