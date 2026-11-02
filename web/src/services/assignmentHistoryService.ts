import { auth, db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit
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

const isStoredHistoryRecord = (item: unknown): item is AssignmentHistoryRecord => {
  if (!item || typeof item !== 'object') return false;
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 && !id.startsWith('asg-seed-');
};

export class AssignmentHistoryService {
  private static getLocalHistory(): AssignmentHistoryRecord[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isStoredHistoryRecord);
    } catch {
      return [];
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

    if (db && auth?.currentUser) {
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
      const res = await apiRequest<AssignmentHistoryRecord[]>(`/api/dispatch/assignment-history${qs}`);
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
    let cancelled = false;
    this.listHistory({ timeRange: '1year' })
      .then((records) => {
        if (!cancelled) {
          this.saveLocalHistory(records);
          onUpdate(records);
        }
      })
      .catch((err) => {
        console.warn('AssignmentHistoryService: live history load failed:', err);
        if (!cancelled && onError) onError(err);
      });

    return () => {
      cancelled = true;
    };
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
    if (!db || !auth?.currentUser) return local;

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
