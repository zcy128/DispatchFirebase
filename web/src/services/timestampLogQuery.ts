import {
  query,
  where,
  orderBy,
  limit,
  type CollectionReference,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { addDaysToDateString } from '../utils/dateUtils';

export interface TimestampLogBounds {
  dateFrom?: string;
  dateTo?: string;
  limitCount?: number;
}

export interface TimestampWindow {
  start: string;
  endExclusive: string;
}

/**
 * Local calendar days can sit on either side of a UTC timestamp, so the query
 * window is widened by one day on each side. Callers still apply local-day filtering.
 */
export function timestampWindow(bounds?: TimestampLogBounds): TimestampWindow | null {
  if (!bounds?.dateFrom || !bounds?.dateTo) return null;
  return {
    start: addDaysToDateString(bounds.dateFrom, -1),
    endExclusive: addDaysToDateString(bounds.dateTo, 2),
  };
}

export function timestampLogQuery(
  collectionRef: CollectionReference<DocumentData>,
  bounds?: TimestampLogBounds
): Query<DocumentData> {
  const window = timestampWindow(bounds);
  const constraints = [];
  if (window) {
    constraints.push(where('timestamp', '>=', window.start));
    constraints.push(where('timestamp', '<', window.endExclusive));
  }
  constraints.push(orderBy('timestamp', 'desc'));
  if (bounds?.limitCount && bounds.limitCount > 0) {
    constraints.push(limit(bounds.limitCount));
  }
  return query(collectionRef, ...constraints);
}

export function isTimestampInBounds(timestamp: string | undefined, bounds?: TimestampLogBounds): boolean {
  const window = timestampWindow(bounds);
  if (!window) return true;
  if (!timestamp) return false;
  return timestamp >= window.start && timestamp < window.endExclusive;
}

export function capLogList<T>(logs: T[], limitCount?: number): T[] {
  if (!limitCount || limitCount <= 0 || logs.length <= limitCount) return logs;
  return logs.slice(0, limitCount);
}
