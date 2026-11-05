import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { RouteChangeLog } from '../types/routeAudit';
import {
  capLogList,
  isTimestampInBounds,
  timestampLogQuery,
  type TimestampLogBounds,
} from './timestampLogQuery';

const LOCAL_STORAGE_KEY = 'dispatch_route_change_logs';
let memoryLogs: RouteChangeLog[] | null = null;

function isStoredRouteLog(item: unknown): item is RouteChangeLog {
  if (!item || typeof item !== 'object') return false;
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 && !id.startsWith('rcl-seed-') && !id.startsWith('rcl-init-');
}

function getStoredLogs(): RouteChangeLog[] {
  if (memoryLogs) return memoryLogs;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      memoryLogs = [];
      return memoryLogs;
    }
    const parsed = JSON.parse(raw);
    memoryLogs = Array.isArray(parsed) ? parsed.filter(isStoredRouteLog) : [];
    return memoryLogs;
  } catch {
    return [];
  }
}

function saveStoredLogs(logs: RouteChangeLog[]) {
  memoryLogs = logs;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.warn('[RouteAuditService] Failed to cache logs in localStorage:', err);
  }
}

function publishRouteLogs(logs: RouteChangeLog[], bounds?: TimestampLogBounds): RouteChangeLog[] {
  const filtered = logs.filter((item) => isTimestampInBounds(item.timestamp, bounds));
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return capLogList(sorted, bounds?.limitCount);
}

export const RouteAuditService = {
  /**
   * Records a modification event to Firestore and caches locally
   */
  logRouteChange: async (
    entry: Omit<RouteChangeLog, 'id' | 'timestamp'> & { timestamp?: string }
  ): Promise<RouteChangeLog> => {
    const record: RouteChangeLog = {
      ...entry,
      id: `rcl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString()
    };

    // 1. Save to localStorage cache
    const current = getStoredLogs();
    const updated = [record, ...current];
    saveStoredLogs(updated);

    // 2. Persist to Firestore if available
    if (db) {
      try {
        const col = collection(db, 'route_change_logs');
        const docRef = await addDoc(col, record);
        record.id = docRef.id;
      } catch (err) {
        console.warn('[RouteAuditService] Firestore write failed, stored in local cache:', err);
      }
    }

    return record;
  },

  /**
   * Real-time subscription to change logs for a specific route
   */
  subscribeToRouteLogs: (
    routeId: string,
    onUpdate: (logs: RouteChangeLog[]) => void,
    onError?: (err: Error) => void
  ): (() => void) => {
    if (!db) {
      const all = getStoredLogs();
      const filtered = all
        .filter((l) => l.routeId === routeId || l.routeNo === routeId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(filtered);
      return () => {};
    }

    try {
      const q = query(
        collection(db, 'route_change_logs'),
        where('routeId', '==', routeId),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: RouteChangeLog[] = [];
          snapshot.forEach((doc) => {
            if (doc.id.startsWith('rcl-seed-') || doc.id.startsWith('rcl-init-')) return;
            list.push({ ...(doc.data() as RouteChangeLog), id: doc.id });
          });

          // Merge with any local cache logs for immediate offline responsiveness
          const cached = getStoredLogs().filter(
            (l) => l.routeId === routeId || l.routeNo === routeId
          );
          const map = new Map<string, RouteChangeLog>();
          cached.forEach((item) => map.set(item.id, item));
          list.forEach((item) => map.set(item.id, item));

          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          onUpdate(merged);
        },
        (error) => {
          console.warn('[RouteAuditService] onSnapshot query error, fallback to local:', error);
          if (onError) onError(error);
          const cached = getStoredLogs()
            .filter((l) => l.routeId === routeId || l.routeNo === routeId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          onUpdate(cached);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('[RouteAuditService] Failed to establish onSnapshot:', err);
      const cached = getStoredLogs()
        .filter((l) => l.routeId === routeId || l.routeNo === routeId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(cached);
      return () => {};
    }
  },

  /**
   * Real-time subscription to all route change logs (system-wide)
   */
  subscribeToAllLogs: (
    onUpdate: (logs: RouteChangeLog[]) => void,
    onError?: (err: Error) => void,
    bounds?: TimestampLogBounds
  ): (() => void) => {
    if (!db) {
      onUpdate(publishRouteLogs(getStoredLogs(), bounds));
      return () => {};
    }

    try {
      const logQuery = timestampLogQuery(collection(db, 'route_change_logs'), bounds);
      const unsubscribe = onSnapshot(
        logQuery,
        (snapshot) => {
          const list: RouteChangeLog[] = [];
          snapshot.forEach((doc) => {
            if (doc.id.startsWith('rcl-seed-') || doc.id.startsWith('rcl-init-')) return;
            list.push({ ...(doc.data() as RouteChangeLog), id: doc.id });
          });

          const cached = getStoredLogs().filter((item) => isTimestampInBounds(item.timestamp, bounds));
          const map = new Map<string, RouteChangeLog>();
          cached.forEach((item) => map.set(item.id, item));
          list.forEach((item) => map.set(item.id, item));

          onUpdate(publishRouteLogs(Array.from(map.values()), bounds));
        },
        (error) => {
          console.warn('[RouteAuditService] onSnapshot error on all logs, fallback to cache:', error);
          if (onError) onError(error);
          onUpdate(publishRouteLogs(getStoredLogs(), bounds));
        }
      );
      return unsubscribe;
    } catch (err) {
      console.warn('[RouteAuditService] Exception in all logs listener:', err);
      onUpdate(publishRouteLogs(getStoredLogs(), bounds));
      return () => {};
    }
  }
};
