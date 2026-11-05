import {
  collection,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import {
  PayrollOperationLog,
  PayrollOperationLogFilter
} from '../types/payrollOperationLog';
import {
  capLogList,
  isTimestampInBounds,
  timestampLogQuery,
  type TimestampLogBounds,
} from './timestampLogQuery';

const LOCAL_STORAGE_KEY = 'dispatch_payroll_operation_logs';

const isRealPayrollLog = (item: PayrollOperationLog | null | undefined): item is PayrollOperationLog =>
  !!item && typeof item.id === 'string' && item.id.length > 0 && !item.id.startsWith('pol-seed-');

export const PayrollOperationLogService = {
  getStoredLogs(): PayrollOperationLog[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isRealPayrollLog);
    } catch {
      return [];
    }
  },

  saveStoredLogs(logs: PayrollOperationLog[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[PayrollOperationLogService] Failed to save localStorage:', e);
    }
  },

  async logOperation(
    entry: Omit<PayrollOperationLog, 'id' | 'timestamp'> & { timestamp?: string }
  ): Promise<PayrollOperationLog> {
    const timestamp = entry.timestamp || new Date().toISOString();
    const id = `pol-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newLog: PayrollOperationLog = {
      ...entry,
      id,
      timestamp
    };

    // 1. LocalStorage
    try {
      const current = PayrollOperationLogService.getStoredLogs();
      PayrollOperationLogService.saveStoredLogs([newLog, ...current]);
    } catch (e) {
      console.warn('[PayrollOperationLogService] Local save failed:', e);
    }

    // 2. Firestore
    if (db) {
      try {
        const cleanPayload = JSON.parse(JSON.stringify(newLog));
        await addDoc(collection(db, 'payroll_operation_logs'), cleanPayload);
      } catch (err) {
        console.warn('[PayrollOperationLogService] Firestore addDoc failed, saved locally:', err);
      }
    }

    return newLog;
  },

  subscribeToLogs(
    filter: PayrollOperationLogFilter = {},
    onUpdate: (logs: PayrollOperationLog[]) => void,
    onError?: (err: Error) => void,
    bounds?: TimestampLogBounds
  ): () => void {
    const applyFilter = (allLogs: PayrollOperationLog[]): PayrollOperationLog[] => {
      return allLogs
        .filter((item) => {
          if (filter.category && filter.category !== 'all' && item.category !== filter.category) {
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
              (item.targetName || '').toLowerCase().includes(q) ||
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

    const publish = (logs: PayrollOperationLog[]) => {
      const windowed = logs.filter((item) => isTimestampInBounds(item.timestamp, bounds));
      onUpdate(capLogList(applyFilter(windowed), bounds?.limitCount));
    };

    if (!db) {
      publish(PayrollOperationLogService.getStoredLogs());
      return () => {};
    }

    try {
      const logQuery = timestampLogQuery(collection(db, 'payroll_operation_logs'), bounds);
      const unsub = onSnapshot(
        logQuery,
        (snap) => {
          const remoteList: PayrollOperationLog[] = [];
          snap.forEach((doc) => {
            const d = doc.data() as PayrollOperationLog;
            if (String(doc.id).startsWith('pol-seed-') || String(d.id || '').startsWith('pol-seed-')) return;
            remoteList.push({
              ...d,
              id: doc.id
            });
          });

          publish(remoteList);
        },
        (err) => {
          console.warn('[PayrollOperationLogService] onSnapshot fallback:', err);
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
