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

const LOCAL_STORAGE_KEY = 'dispatch_route_change_logs';

/**
 * Seed mock logs for demonstration and immediate verification
 */
const SEED_ROUTE_LOGS: RouteChangeLog[] = [
  {
    id: 'rcl-seed-001',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Bell High School',
    category: 'shift',
    action: 'update',
    summary: 'Updated AM Shift operating schedule to MTWRF (07:30 - 08:30)',
    shiftId: 'SHIFT-001-AM',
    shiftType: 'AM',
    diffs: [
      { field: 'runDays', fieldLabel: 'Operating Days', oldValue: 'MTWR-', newValue: 'MTWRF' },
      { field: 'active', fieldLabel: 'Shift Active Status', oldValue: false, newValue: true }
    ],
    userId: 'usr-disp-101',
    userName: 'Sarah Jenkins',
    userEmail: 's.jenkins@dispatch.net',
    userRole: 'dispatcher',
    timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
  },
  {
    id: 'rcl-seed-002',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Bell High School',
    category: 'stop',
    action: 'update',
    summary: 'Modified Stop #2 (1420 Woodroffe Ave): Pullaway time adjusted from 07:40 to 07:42',
    shiftId: 'SHIFT-001-AM',
    shiftType: 'AM',
    stopId: 1002,
    stopSequence: 2,
    stopLocation: '1420 Woodroffe Ave',
    diffs: [
      { field: 'pullawayTime', fieldLabel: 'Pullaway Time', oldValue: '07:40', newValue: '07:42' },
      { field: 'instruction', fieldLabel: 'Instructions', oldValue: '', newValue: 'Wait across sidewalk at north entrance' }
    ],
    userId: 'usr-disp-102',
    userName: 'David Miller',
    userEmail: 'd.miller@dispatch.net',
    userRole: 'dispatcher',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'rcl-seed-003',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Bell High School',
    category: 'student',
    action: 'assign',
    summary: 'Assigned student Liam Tremblay (#STU-1004) to Stop #2 (Home Pickup 07:42)',
    shiftId: 'SHIFT-001-AM',
    shiftType: 'AM',
    stopId: 1002,
    stopSequence: 2,
    stopLocation: '1420 Woodroffe Ave',
    studentId: 1004,
    studentNo: 'STU-1004',
    studentName: 'Liam Tremblay',
    diffs: [
      { field: 'assignedStudents', fieldLabel: 'Assigned Riders', oldValue: 'None', newValue: 'Liam Tremblay' }
    ],
    userId: 'usr-admin-001',
    userName: 'Admin User',
    userEmail: 'admin@schoolbus.com',
    userRole: 'admin',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'rcl-seed-004',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Bell High School',
    category: 'student',
    action: 'update',
    summary: 'Updated itinerary for Emma Watson: PM Dropoff address changed to 88 Richmond Rd',
    shiftId: 'SHIFT-001-PM',
    shiftType: 'PM',
    studentId: 1002,
    studentNo: 'STU-1002',
    studentName: 'Emma Watson',
    diffs: [
      { field: 'dropoffAddress', fieldLabel: 'PM Dropoff Address', oldValue: '45 Baseline Rd', newValue: '88 Richmond Rd' },
      { field: 'dropoffTime', fieldLabel: 'PM Dropoff Time', oldValue: '15:15', newValue: '15:20' }
    ],
    userId: 'usr-disp-101',
    userName: 'Sarah Jenkins',
    userEmail: 's.jenkins@dispatch.net',
    userRole: 'dispatcher',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'rcl-seed-005',
    routeId: 'RT-001',
    routeNo: 'OCDSB-001',
    routeName: 'Route 001 - Bell High School',
    category: 'route',
    action: 'update',
    summary: 'Updated route operational settings: Enabled Auto Marryup for AM & PM shift coupling',
    diffs: [
      { field: 'autoMarryup', fieldLabel: 'Auto Marryup', oldValue: false, newValue: true }
    ],
    userId: 'usr-disp-101',
    userName: 'Sarah Jenkins',
    userEmail: 's.jenkins@dispatch.net',
    userRole: 'dispatcher',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

function getStoredLogs(): RouteChangeLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_ROUTE_LOGS));
      return [...SEED_ROUTE_LOGS];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...SEED_ROUTE_LOGS];
  } catch {
    return [...SEED_ROUTE_LOGS];
  }
}

function saveStoredLogs(logs: RouteChangeLog[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.warn('[RouteAuditService] Failed to cache logs in localStorage:', err);
  }
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
    onError?: (err: Error) => void
  ): (() => void) => {
    if (!db) {
      const all = getStoredLogs().sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      onUpdate(all);
      return () => {};
    }

    try {
      const q = query(collection(db, 'route_change_logs'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: RouteChangeLog[] = [];
          snapshot.forEach((doc) => {
            list.push({ ...(doc.data() as RouteChangeLog), id: doc.id });
          });

          const cached = getStoredLogs();
          const map = new Map<string, RouteChangeLog>();
          cached.forEach((item) => map.set(item.id, item));
          list.forEach((item) => map.set(item.id, item));

          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          onUpdate(merged);
        },
        (error) => {
          console.warn('[RouteAuditService] onSnapshot error on all logs, fallback to cache:', error);
          if (onError) onError(error);
          onUpdate(
            getStoredLogs().sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
          );
        }
      );
      return unsubscribe;
    } catch (err) {
      console.warn('[RouteAuditService] Exception in all logs listener:', err);
      onUpdate(
        getStoredLogs().sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      );
      return () => {};
    }
  }
};
