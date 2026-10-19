import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import {
  OperationalSafetyLog,
  OperationalSafetyLogFilter
} from '../types/operationalSafetyLog';

const LOCAL_STORAGE_KEY = 'dispatch_operational_safety_logs';

const SEED_SAFETY_LOGS: OperationalSafetyLog[] = [
  {
    id: 'osl-seed-001',
    module: 'time_off',
    action: 'approve',
    targetId: 'TO-2026-004',
    targetIdentifier: 'EMP-1002',
    targetTitle: 'David Miller - Vacation Leave Request (2026-10-14 to 2026-10-16)',
    status: 'approved',
    summary: 'Approved 3-day personal vacation leave request for driver David Miller',
    diffs: [
      { field: 'status', fieldLabel: 'Approval Status', oldValue: 'pending', newValue: 'approved' },
      { field: 'approvedBy', fieldLabel: 'Approver', oldValue: undefined, newValue: 'Sarah Jenkins (Dispatcher)' }
    ],
    actor: {
      userId: 'usr-disp-101',
      userName: 'Sarah Jenkins',
      userEmail: 's.jenkins@dispatch.net',
      userRole: 'dispatcher'
    },
    timestamp: new Date(Date.now() - 3600000 * 32).toISOString()
  },
  {
    id: 'osl-seed-002',
    module: 'vehicle_defect',
    action: 'resolve',
    targetId: 'DEF-801',
    targetIdentifier: '1001',
    targetTitle: 'Bus Unit #1001 - Front Right Headlamp Assembly Replaced',
    severity: 'medium',
    status: 'repaired_and_cleared',
    summary: 'Mechanic certified completion of work order #WO-9912. Unit returned to full active service.',
    diffs: [
      { field: 'status', fieldLabel: 'Defect Resolution', oldValue: 'in_maintenance', newValue: 'repaired_and_cleared' },
      { field: 'roadworthy', fieldLabel: 'Roadworthy Safe', oldValue: false, newValue: true }
    ],
    actor: {
      userId: 'usr-mech-001',
      userName: 'Robert Vance',
      userEmail: 'r.vance@dispatch.net',
      userRole: 'admin'
    },
    timestamp: new Date(Date.now() - 3600000 * 22).toISOString()
  },
  {
    id: 'osl-seed-003',
    module: 'hazard_report',
    action: 'resolve',
    targetId: 'HAZ-102',
    targetIdentifier: 'LOC-WOODROFFE',
    targetTitle: 'Roadway Hazard: Woodroffe Ave Construction Lane Restriction',
    severity: 'high',
    status: 'mitigated',
    summary: 'Updated driver route warnings and communicated alternate detour stop for PM shifts',
    diffs: [
      { field: 'status', fieldLabel: 'Hazard Status', oldValue: 'reported', newValue: 'mitigated' },
      { field: 'bulletinIssued', fieldLabel: 'Fleet Alert Sent', oldValue: false, newValue: true }
    ],
    actor: {
      userId: 'usr-admin-001',
      userName: 'Admin User',
      userEmail: 'admin@schoolbus.com',
      userRole: 'admin'
    },
    timestamp: new Date(Date.now() - 3600000 * 14).toISOString()
  },
  {
    id: 'osl-seed-004',
    module: 'student_incident',
    action: 'resolve',
    targetId: 'INC-305',
    targetIdentifier: 'STU-1004',
    targetTitle: 'Student Incident: Liam Tremblay Seatbelt Compliance Follow-up',
    severity: 'low',
    status: 'resolved',
    summary: 'Spoke with parent; student care plan updated to include front-row preferred seating',
    diffs: [
      { field: 'status', fieldLabel: 'Case Status', oldValue: 'open', newValue: 'resolved' },
      { field: 'parentNotified', fieldLabel: 'Parent Contacted', oldValue: false, newValue: true }
    ],
    actor: {
      userId: 'usr-disp-101',
      userName: 'Sarah Jenkins',
      userEmail: 's.jenkins@dispatch.net',
      userRole: 'dispatcher'
    },
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString()
  }
];

export const OperationalSafetyLogService = {
  getStoredLogs(): OperationalSafetyLog[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_SAFETY_LOGS));
        return SEED_SAFETY_LOGS;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_SAFETY_LOGS));
        return SEED_SAFETY_LOGS;
      }
      return parsed;
    } catch {
      return SEED_SAFETY_LOGS;
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

    // 1. LocalStorage
    try {
      const current = OperationalSafetyLogService.getStoredLogs();
      OperationalSafetyLogService.saveStoredLogs([newLog, ...current]);
    } catch (e) {
      console.warn('[OperationalSafetyLogService] Local save failed:', e);
    }

    // 2. Firestore
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
    onError?: (err: Error) => void
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
              item.targetTitle.toLowerCase().includes(q) ||
              item.targetIdentifier.toLowerCase().includes(q) ||
              item.targetId.toLowerCase().includes(q);
            const matchSummary = item.summary.toLowerCase().includes(q);
            const matchActor =
              item.actor.userName.toLowerCase().includes(q) ||
              (item.actor.userRole && item.actor.userRole.toLowerCase().includes(q)) ||
              (item.actor.userEmail && item.actor.userEmail.toLowerCase().includes(q));
            const matchDiff = item.diffs?.some(
              (d) =>
                d.fieldLabel.toLowerCase().includes(q) ||
                String(d.oldValue).toLowerCase().includes(q) ||
                String(d.newValue).toLowerCase().includes(q)
            );
            if (!matchTarget && !matchSummary && !matchActor && !matchDiff) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    if (!db) {
      const local = OperationalSafetyLogService.getStoredLogs();
      onUpdate(applyFilter(local));
      return () => {};
    }

    try {
      const q = query(collection(db, 'operational_safety_logs'), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const remoteList: OperationalSafetyLog[] = [];
          snap.forEach((doc) => {
            const d = doc.data() as OperationalSafetyLog;
            remoteList.push({
              ...d,
              id: doc.id
            });
          });

          const localList = OperationalSafetyLogService.getStoredLogs();
          const seen = new Set<string>();
          const combined: OperationalSafetyLog[] = [];

          remoteList.forEach((item) => {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              combined.push(item);
            }
          });

          localList.forEach((item) => {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              combined.push(item);
            }
          });

          onUpdate(applyFilter(combined));
        },
        (err) => {
          console.warn('[OperationalSafetyLogService] onSnapshot fallback:', err);
          if (onError) onError(err);
          const local = OperationalSafetyLogService.getStoredLogs();
          onUpdate(applyFilter(local));
        }
      );
      return unsub;
    } catch {
      const local = OperationalSafetyLogService.getStoredLogs();
      onUpdate(applyFilter(local));
      return () => {};
    }
  }
};
