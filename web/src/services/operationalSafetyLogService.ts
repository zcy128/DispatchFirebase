import {
  collection,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import {
  OperationalSafetyLog,
  OperationalSafetyLogFilter
} from '../types/operationalSafetyLog';
import {
  capLogList,
  isTimestampInBounds,
  timestampLogQuery,
  type TimestampLogBounds,
} from './timestampLogQuery';

const LOCAL_STORAGE_KEY = 'dispatch_operational_safety_logs';

const isRealSafetyLog = (item: OperationalSafetyLog | null | undefined): item is OperationalSafetyLog =>
  !!item && typeof item.id === 'string' && item.id.length > 0 && !item.id.startsWith('osl-seed-');

export const OperationalSafetyLogService = {
  getStoredLogs(): OperationalSafetyLog[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isRealSafetyLog);
    } catch {
      return [];
    }
  },

  saveStoredLogs(logs: OperationalSafetyLog[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[OperationalSafetyLogService] Failed to save localStorage:', e);
    }
  },

  async logOperation(
    entry: Omit<OperationalSafetyLog, 'id' | 'timestamp'> & { timestamp?: string }
  ): Promise<OperationalSafetyLog> {
    const timestamp = entry.timestamp || new Date().toISOString();
    const id = `osl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newLog: OperationalSafetyLog = {
      ...entry,
      id,
      timestamp
    };

    try {
      const current = OperationalSafetyLogService.getStoredLogs();
      OperationalSafetyLogService.saveStoredLogs([newLog, ...current]);
    } catch (e) {
      console.warn('[OperationalSafetyLogService] Local save failed:', e);
    }

    if (db) {
      try {
        const cleanPayload = JSON.parse(JSON.stringify(newLog));
        await addDoc(collection(db, 'operational_safety_logs'), cleanPayload);
      } catch (err) {
        console.warn('[OperationalSafetyLogService] Firestore addDoc failed, saved locally:', err);
      }
    }

    return newLog;
  },

  subscribeToLogs(
    filter: OperationalSafetyLogFilter = {},
    onUpdate: (logs: OperationalSafetyLog[]) => void,
    onError?: (err: Error) => void,
    bounds?: TimestampLogBounds
  ): () => void {
    const applyFilter = (allLogs: OperationalSafetyLog[]): OperationalSafetyLog[] => {
      return allLogs
        .filter((item) => {
          if (filter.module && filter.module !== 'all' && item.module !== filter.module) {
            return false;
          }
          if (filter.action && filter.action !== 'all' && item.action !== filter.action) {
            return false;
          }
          if (filter.userId && item.actor?.userId !== filter.userId) {
            return false;
          }
          if (filter.dateFrom && item.timestamp.slice(0, 10) < filter.dateFrom) {
            return false;
          }
          if (filter.dateTo && item.timestamp.slice(0, 10) > filter.dateTo) {
            return false;
          }
          if (filter.search && filter.search.trim()) {
            const q = filter.search.trim().toLowerCase();
            const matchTarget =
              (item.targetTitle || '').toLowerCase().includes(q) ||
              (item.targetIdentifier || '').toLowerCase().includes(q) ||
              (item.targetId || '').toLowerCase().includes(q);
            const matchSummary = (item.summary || '').toLowerCase().includes(q);
            const matchActor =
              (item.actor?.userName || '').toLowerCase().includes(q) ||
              (item.actor?.userRole || '').toLowerCase().includes(q) ||
              (item.actor?.userEmail || '').toLowerCase().includes(q);
            const matchDiff = item.diffs?.some(
              (d) =>
                (d.fieldLabel || '').toLowerCase().includes(q) ||
                String(d.oldValue ?? '').toLowerCase().includes(q) ||
                String(d.newValue ?? '').toLowerCase().includes(q)
            );
            if (!matchTarget && !matchSummary && !matchActor && !matchDiff) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    const publish = (logs: OperationalSafetyLog[]) => {
      const windowed = logs.filter((item) => isTimestampInBounds(item.timestamp, bounds));
      onUpdate(capLogList(applyFilter(windowed), bounds?.limitCount));
    };

    if (!db) {
      publish(OperationalSafetyLogService.getStoredLogs());
      return () => {};
    }

    try {
      const logQuery = timestampLogQuery(collection(db, 'operational_safety_logs'), bounds);
      const unsub = onSnapshot(
        logQuery,
        (snap) => {
          const remoteList: OperationalSafetyLog[] = [];
          snap.forEach((doc) => {
            const d = doc.data() as OperationalSafetyLog;
            if (String(doc.id).startsWith('osl-seed-') || String(d.id || '').startsWith('osl-seed-')) return;
            remoteList.push({
              ...d,
              id: doc.id
            });
          });
          publish(remoteList);
        },
        (err) => {
          console.warn('[OperationalSafetyLogService] onSnapshot fallback:', err);
          if (onError) onError(err);
          onUpdate([]);
        }
      );
      return unsub;
    } catch {
      onUpdate([]);
      return () => {};
    }
  }
};
