import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { AssignmentHistoryRecord, AssignmentHistoryFilter } from '../types/assignmentHistory';
import { apiRequest } from './api';

const LOCAL_STORAGE_KEY = 'dispatch_assignment_history_cache';
const FIRESTORE_COLLECTION = 'assignment_history';

/**
 * Check if an assignment record is older than 1 year (365 days) -> BigQuery cold storage.
 */
export const isColdRecord = (effectiveDate?: string, timestamp?: string): boolean => {
  const d = effectiveDate || (timestamp ? timestamp.slice(0, 10) : '');
  if (!d) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  return d.slice(0, 10) < cutoff.toISOString().slice(0, 10);
};

/**
 * Realistic seed data illustrating:
 * 1) Driver -> Route assignment and later unassignment / reassignment
 * 2) Driver -> Vehicle assignment and vehicle -> driver tracking
 */
const generateSeedHistory = (): AssignmentHistoryRecord[] => {
  return [
    {
      id: 'asg-seed-1',
      type: 'driver_route',
      action: 'assign',
      timestamp: '2026-09-01T08:00:00.000Z',
      effectiveDate: '2026-09-01',
      driverId: 'EMP-2001',
      driverName: 'David Miller',
      driverNumber: 'EMP-2001',
      routeId: 'RT-001',
      routeNo: 'OCDSB-001',
      routeName: 'Sir Robert Borden High & Greenbank',
      shiftType: 'Standing',
      unitNumber: '1001',
      plateNumber: 'ON-1001',
      reason: 'Fall 2026 Academic Year Regular Standing Assignment',
      assignedBy: 'Alex Morgan (Admin)',
      notes: 'Primary driver assignment',
      isCurrent: true,
    },
    {
      id: 'asg-seed-2',
      type: 'driver_vehicle',
      action: 'assign',
      timestamp: '2026-09-01T08:10:00.000Z',
      effectiveDate: '2026-09-01',
      driverId: 'EMP-2001',
      driverName: 'David Miller',
      driverNumber: 'EMP-2001',
      vehicleId: 1001,
      unitNumber: '1001',
      plateNumber: 'ON-1001',
      routeNo: 'OCDSB-001',
      reason: 'Allocated dedicated 72-passenger Blue Bird bus',
      assignedBy: 'Alex Morgan (Admin)',
      notes: 'Bus parked at West Yard',
      isCurrent: true,
    },
    {
      id: 'asg-seed-3',
      type: 'driver_route',
      action: 'assign',
      timestamp: '2026-08-25T09:30:00.000Z',
      effectiveDate: '2026-08-25',
      endDate: '2026-09-18',
      driverId: 'EMP-2002',
      driverName: 'Emily Zhang',
      driverNumber: 'EMP-2002',
      routeId: 'RT-002',
      routeNo: 'OCDSB-002',
      routeName: 'Bell High & Baseline Elementary',
      shiftType: 'Standing',
      unitNumber: '1002',
      plateNumber: 'ON-1002',
      reason: 'Initial route setup for September',
      assignedBy: 'Sarah Connor (Dispatcher)',
      isCurrent: false,
    },
    {
      id: 'asg-seed-4',
      type: 'driver_route',
      action: 'unassign',
      timestamp: '2026-09-18T16:00:00.000Z',
      effectiveDate: '2026-09-18',
      driverId: 'EMP-2002',
      driverName: 'Emily Zhang',
      driverNumber: 'EMP-2002',
      routeId: 'RT-002',
      routeNo: 'OCDSB-002',
      routeName: 'Bell High & Baseline Elementary',
      shiftType: 'Standing',
      unitNumber: '1002',
      reason: 'Driver requested transfer to East territory routes',
      assignedBy: 'Sarah Connor (Dispatcher)',
      notes: 'Relieved from OCDSB-002 amicably',
      isCurrent: false,
    },
    {
      id: 'asg-seed-5',
      type: 'driver_route',
      action: 'assign',
      timestamp: '2026-09-19T07:30:00.000Z',
      effectiveDate: '2026-09-19',
      driverId: 'EMP-2002',
      driverName: 'Emily Zhang',
      driverNumber: 'EMP-2002',
      routeId: 'RT-003',
      routeNo: 'OCDSB-003',
      routeName: 'Nepean High & Broadview Public',
      shiftType: 'Standing',
      unitNumber: '1005',
      plateNumber: 'ON-1005',
      reason: 'Reassigned to East Sector route per driver preference',
      assignedBy: 'Sarah Connor (Dispatcher)',
      isCurrent: true,
    },
    {
      id: 'asg-seed-6',
      type: 'driver_vehicle',
      action: 'assign',
      timestamp: '2026-09-01T08:15:00.000Z',
      effectiveDate: '2026-09-01',
      endDate: '2026-09-22',
      driverId: 'EMP-2003',
      driverName: 'Michael Brown',
      driverNumber: 'EMP-2003',
      vehicleId: 1003,
      unitNumber: '1003',
      plateNumber: 'ON-1003',
      routeNo: 'OCDSB-004',
      reason: 'Assigned Unit #1003 for South route',
      assignedBy: 'Alex Morgan (Admin)',
      isCurrent: false,
    },
    {
      id: 'asg-seed-7',
      type: 'driver_vehicle',
      action: 'unassign',
      timestamp: '2026-09-22T14:00:00.000Z',
      effectiveDate: '2026-09-22',
      driverId: 'EMP-2003',
      driverName: 'Michael Brown',
      driverNumber: 'EMP-2003',
      vehicleId: 1003,
      unitNumber: '1003',
      plateNumber: 'ON-1003',
      reason: 'Unit #1003 taken into maintenance shop for scheduled overhaul',
      assignedBy: 'Fleet Lead',
      notes: 'Bus transferred to Maintenance status',
      isCurrent: false,
    },
    {
      id: 'asg-seed-8',
      type: 'driver_vehicle',
      action: 'assign',
      timestamp: '2026-09-23T06:30:00.000Z',
      effectiveDate: '2026-09-23',
      driverId: 'EMP-2003',
      driverName: 'Michael Brown',
      driverNumber: 'EMP-2003',
      vehicleId: 1008,
      unitNumber: '1008',
      plateNumber: 'ON-1008',
      routeNo: 'OCDSB-004',
      reason: 'Replacement spare bus allocated while #1003 is in shop',
      assignedBy: 'Alex Morgan (Admin)',
      isCurrent: true,
    }
  ];
};

export class AssignmentHistoryService {
  private static getLocalHistory(): AssignmentHistoryRecord[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        const seed = generateSeedHistory();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      return JSON.parse(raw);
    } catch {
      return generateSeedHistory();
    }
  }

  private static saveLocalHistory(records: AssignmentHistoryRecord[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records.slice(0, 2000)));
    } catch (err) {
      console.warn('Failed to save assignment history to localStorage:', err);
    }
  }

  /**
   * Record a new assignment or unassignment event
   */
  public static async recordEvent(
    event: Omit<AssignmentHistoryRecord, 'id' | 'timestamp'> & { timestamp?: string }
  ): Promise<AssignmentHistoryRecord> {
    const now = new Date();
    const timestamp = event.timestamp || now.toISOString();
    const id = `asg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const fullRecord: AssignmentHistoryRecord = {
      id,
      timestamp,
      ...event,
    };

    const currentRecords = this.getLocalHistory();

    // If this is an unassignment, update prior active assignments for this driver & route/vehicle to set endDate and isCurrent=false
    if (fullRecord.action === 'unassign') {
      currentRecords.forEach((r) => {
        if (
          r.isCurrent &&
          r.driverId === fullRecord.driverId &&
          ((fullRecord.type === 'driver_route' && r.routeId === fullRecord.routeId) ||
           (fullRecord.type === 'driver_vehicle' && r.unitNumber === fullRecord.unitNumber))
        ) {
          r.isCurrent = false;
          r.endDate = fullRecord.effectiveDate;
        }
      });
      fullRecord.isCurrent = false;
    } else if (fullRecord.action === 'assign') {
      fullRecord.isCurrent = true;
    }

    const updated = [fullRecord, ...currentRecords];
    this.saveLocalHistory(updated);

    if (db) {
      try {
        const docRef = await addDoc(collection(db, FIRESTORE_COLLECTION), {
          ...fullRecord,
          serverTimestamp: now.getTime(),
        });
        fullRecord.id = docRef.id;
      } catch (err) {
        console.warn('AssignmentHistoryService: Firestore write skipped/offline:', err);
      }
    }

    return fullRecord;
  }

  /**
   * Query assignment history with dual-engine support:
   * - timeRange: '1year' (default live data <= 1 year)
   * - timeRange: 'all' (cold storage in BigQuery > 1 year)
   */
  public static async listHistory(filter?: AssignmentHistoryFilter): Promise<AssignmentHistoryRecord[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.type && filter.type !== 'all') params.append('type', filter.type);
      if (filter?.action && filter.action !== 'all') params.append('action', filter.action);
      if (filter?.driverId) params.append('driverId', filter.driverId);
      if (filter?.driverName) params.append('driverName', filter.driverName);
      if (filter?.routeNo) params.append('routeNo', filter.routeNo);
      if (filter?.unitNumber) params.append('unitNumber', filter.unitNumber);
      if (filter?.searchQuery) params.append('query', filter.searchQuery);
      if (filter?.timeRange) params.append('timeRange', filter.timeRange);
      if (filter?.dateFrom) params.append('startDate', filter.dateFrom);
      if (filter?.dateTo) params.append('endDate', filter.dateTo);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<AssignmentHistoryRecord[]>(`/api/public/dispatch/assignment-history${qs}`);
      if (Array.isArray(res)) {
        return res;
      }
    } catch (err) {
      console.warn('AssignmentHistoryService: backend query failed, falling back to local/Firestore:', err);
    }

    return this.getHistory(filter?.timeRange || '1year');
  }

  /**
   * Subscribe to real-time assignment history updates (live data <= 1 year)
   */
  public static subscribeToHistory(
    onUpdate: (records: AssignmentHistoryRecord[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const local = this.getLocalHistory().filter((r) => {
      const rDate = r.effectiveDate || (r.timestamp ? r.timestamp.slice(0, 10) : '');
      return !rDate || rDate >= cutoffStr;
    });
    onUpdate(local);

    if (!db) return () => {};

    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(500)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreRecords: AssignmentHistoryRecord[] = [];
            snapshot.docs.forEach((doc) => {
              const d = doc.data();
              const effDate = d.effectiveDate || (d.timestamp ? d.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10));
              // Live subscription only accepts records within 1 year
              if (effDate && effDate < cutoffStr) {
                return;
              }

              firestoreRecords.push({
                id: doc.id,
                type: d.type || 'driver_route',
                action: d.action || 'assign',
                timestamp: d.timestamp || new Date().toISOString(),
                effectiveDate: effDate,
                endDate: d.endDate,
                driverId: d.driverId || '',
                driverName: d.driverName || 'Unknown Driver',
                driverNumber: d.driverNumber,
                routeId: d.routeId,
                routeNo: d.routeNo,
                routeName: d.routeName,
                shiftType: d.shiftType,
                vehicleId: d.vehicleId,
                unitNumber: d.unitNumber,
                plateNumber: d.plateNumber,
                reason: d.reason,
                assignedBy: d.assignedBy,
                dispatcherId: d.dispatcherId,
                dispatcherName: d.dispatcherName,
                dispatcherRole: d.dispatcherRole,
                dispatcherEmail: d.dispatcherEmail,
                notes: d.notes,
                isCurrent: d.isCurrent !== undefined ? d.isCurrent : true,
              });
            });

            const currentLocal = this.getLocalHistory().filter((r) => {
              const rDate = r.effectiveDate || (r.timestamp ? r.timestamp.slice(0, 10) : '');
              return !rDate || rDate >= cutoffStr;
            });
            const map = new Map<string, AssignmentHistoryRecord>();
            [...firestoreRecords, ...currentLocal].forEach((item) => {
              if (!map.has(item.id)) {
                map.set(item.id, item);
              }
            });

            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            this.saveLocalHistory(merged);
            onUpdate(merged);
          }
        },
        (err) => {
          console.warn('AssignmentHistoryService snapshot error:', err);
          if (onError) onError(err);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('AssignmentHistoryService listener setup failed:', err);
      return () => {};
    }
  }

  /**
   * Fetch records with optional 1-year live filter
   */
  public static async getHistory(timeRange: '1year' | 'all' = '1year'): Promise<AssignmentHistoryRecord[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const filterLive = (list: AssignmentHistoryRecord[]) => {
      if (timeRange === 'all') return list;
      return list.filter((r) => {
        const rDate = r.effectiveDate || (r.timestamp ? r.timestamp.slice(0, 10) : '');
        return !rDate || rDate >= cutoffStr;
      });
    };

    const local = filterLive(this.getLocalHistory());
    if (!db) return local;

    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(500)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const mapped = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            type: d.type || 'driver_route',
            action: d.action || 'assign',
            timestamp: d.timestamp || new Date().toISOString(),
            effectiveDate: d.effectiveDate || (d.timestamp ? d.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            endDate: d.endDate,
            driverId: d.driverId || '',
            driverName: d.driverName || 'Unknown Driver',
            driverNumber: d.driverNumber,
            routeId: d.routeId,
            routeNo: d.routeNo,
            routeName: d.routeName,
            shiftType: d.shiftType,
            vehicleId: d.vehicleId,
            unitNumber: d.unitNumber,
            plateNumber: d.plateNumber,
            reason: d.reason,
            assignedBy: d.assignedBy,
            dispatcherId: d.dispatcherId,
            dispatcherName: d.dispatcherName,
            dispatcherRole: d.dispatcherRole,
            dispatcherEmail: d.dispatcherEmail,
            notes: d.notes,
            isCurrent: d.isCurrent !== undefined ? d.isCurrent : true,
          } as AssignmentHistoryRecord;
        });
        return filterLive(mapped);
      }
    } catch {
      // Local fallback
    }
    return local;
  }
}
