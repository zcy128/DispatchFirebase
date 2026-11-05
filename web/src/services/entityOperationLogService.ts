import {
  collection,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import {
  EntityOperationLog,
  EntityOperationLogFilter,
  EntityFieldDiff
} from '../types/entityOperationLog';
import { Student } from '../types/student';
import { Vehicle } from '../types/vehicle';
import {
  capLogList,
  isTimestampInBounds,
  timestampLogQuery,
  type TimestampLogBounds,
} from './timestampLogQuery';

const LOCAL_STORAGE_KEY = 'dispatch_entity_operation_logs';
let memoryLogs: EntityOperationLog[] | null = null;

export const EntityOperationLogService = {
  /**
   * Read stored logs from localStorage, excluding placeholder demo records
   */
  getStoredLogs(): EntityOperationLog[] {
    if (memoryLogs) return memoryLogs;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        memoryLogs = [];
        return memoryLogs;
      }
      const parsed = JSON.parse(raw);
      memoryLogs = Array.isArray(parsed)
        ? parsed.filter((item) => item && typeof item.id === 'string' && !item.id.startsWith('eol-seed-') && !item.id.startsWith('eol-init-'))
        : [];
      return memoryLogs;
    } catch (e) {
      console.warn('[EntityOperationLogService] Failed to read localStorage logs:', e);
      return [];
    }
  },

  /**
   * Save an array of logs to localStorage
   */
  saveStoredLogs(logs: EntityOperationLog[]): void {
    memoryLogs = logs;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[EntityOperationLogService] Failed to save localStorage logs:', e);
    }
  },

  /**
   * Record a new operation log for student or vehicle
   */
  async logOperation(
    entry: Omit<EntityOperationLog, 'id' | 'timestamp'> & { timestamp?: string }
  ): Promise<EntityOperationLog> {
    const timestamp = entry.timestamp || new Date().toISOString();
    const id = `eol-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newLog: EntityOperationLog = {
      ...entry,
      id,
      timestamp
    };

    // 1. Save to localStorage immediately
    try {
      const current = EntityOperationLogService.getStoredLogs();
      const updated = [newLog, ...current];
      EntityOperationLogService.saveStoredLogs(updated);
    } catch (e) {
      console.warn('[EntityOperationLogService] Error saving to localStorage:', e);
    }

    // 2. Persist to Firestore if online
    if (db) {
      try {
        const cleanPayload = JSON.parse(JSON.stringify(newLog));
        await addDoc(collection(db, 'entity_operation_logs'), cleanPayload);
      } catch (err) {
        console.warn('[EntityOperationLogService] Firestore addDoc failed, cached locally:', err);
      }
    }

    return newLog;
  },

  /**
   * Subscribe to real-time logs with filter support
   */
  subscribeToLogs(
    filter: EntityOperationLogFilter = {},
    onUpdate: (logs: EntityOperationLog[]) => void,
    onError?: (err: Error) => void,
    bounds?: TimestampLogBounds
  ): () => void {
    const applyFilter = (allLogs: EntityOperationLog[]): EntityOperationLog[] => {
      return allLogs
        .filter((item) => {
          if (filter.targetType && filter.targetType !== 'all' && item.targetType !== filter.targetType) {
            return false;
          }
          if (filter.action && filter.action !== 'all' && item.action !== filter.action) {
            return false;
          }
          if (filter.targetId && item.targetId !== filter.targetId) {
            return false;
          }
          if (filter.targetIdentifier && item.targetIdentifier !== filter.targetIdentifier) {
            return false;
          }
          if (filter.userId && item.actor?.userId !== filter.userId) {
            return false;
          }
          if (filter.dateFrom && item.timestamp < filter.dateFrom) {
            return false;
          }
          if (filter.dateTo && item.timestamp > filter.dateTo) {
            return false;
          }
          if (filter.search && filter.search.trim()) {
            const q = filter.search.trim().toLowerCase();
            const matchTarget =
              item.targetName.toLowerCase().includes(q) ||
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

    const publish = (logs: EntityOperationLog[]) => {
      const windowed = logs.filter((item) => isTimestampInBounds(item.timestamp, bounds));
      onUpdate(capLogList(applyFilter(windowed), bounds?.limitCount));
    };

    if (!db) {
      publish(EntityOperationLogService.getStoredLogs());
      return () => {};
    }

    try {
      const logQuery = timestampLogQuery(collection(db, 'entity_operation_logs'), bounds);
      const unsub = onSnapshot(
        logQuery,
        (snap) => {
          const remoteList: EntityOperationLog[] = [];
          snap.forEach((doc) => {
            const d = doc.data() as EntityOperationLog;
            if (doc.id.startsWith('eol-seed-') || doc.id.startsWith('eol-init-')) return;
            remoteList.push({
              ...d,
              id: doc.id
            });
          });

          // Merge local cached logs that fall inside the same timestamp window.
          const localList = EntityOperationLogService.getStoredLogs().filter((item) =>
            isTimestampInBounds(item.timestamp, bounds)
          );
          const seen = new Set<string>();
          const combined: EntityOperationLog[] = [];

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

          publish(combined);
        },
        (err) => {
          console.warn('[EntityOperationLogService] onSnapshot error, falling back to local storage:', err);
          if (onError) onError(err);
          publish(EntityOperationLogService.getStoredLogs());
        }
      );
      return unsub;
    } catch (err: any) {
      console.warn('[EntityOperationLogService] Failed to establish listener, falling back:', err);
      publish(EntityOperationLogService.getStoredLogs());
      return () => {};
    }
  },

  /**
   * Helper to compute field diffs for Student changes
   */
  compareStudent(oldData: Partial<Student>, newData: Partial<Student>): EntityFieldDiff[] {
    const diffs: EntityFieldDiff[] = [];

    const fieldConfig: Array<{ key: keyof Student; label: string }> = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'fullName', label: 'Full Name' },
      { key: 'studentNo', label: 'Student Number' },
      { key: 'grade', label: 'Grade' },
      { key: 'gender', label: 'Gender' },
      { key: 'birthDate', label: 'Date of Birth' },
      { key: 'active', label: 'Active Status' },
      { key: 'metatBus', label: 'Met at Bus Requirement' },
      { key: 'schoolName', label: 'Assigned School' },
      { key: 'routes', label: 'Assigned Routes' },
      { key: 'studentAddress', label: 'Residential Address' },
      { key: 'studentPhone', label: 'Student / Home Phone' },
      { key: 'studentEmergencyPhone', label: 'Emergency Phone' },
      { key: 'studentEmergencyAddress', label: 'Emergency Address' },
      { key: 'equipments', label: 'Special Equipment' },
      { key: 'studentDispatchNotes', label: 'Dispatch Care Notes' },
      { key: 'studentSchoolNotes', label: 'School / Medical Notes' }
    ];

    fieldConfig.forEach(({ key, label }) => {
      const oldVal = oldData[key];
      const newVal = newData[key];

      const cleanOld = oldVal === undefined || oldVal === null ? '' : String(oldVal).trim();
      const cleanNew = newVal === undefined || newVal === null ? '' : String(newVal).trim();

      if (typeof oldVal === 'boolean' || typeof newVal === 'boolean') {
        if (Boolean(oldVal) !== Boolean(newVal)) {
          diffs.push({
            field: key,
            fieldLabel: label,
            oldValue: Boolean(oldVal),
            newValue: Boolean(newVal)
          });
        }
      } else if (cleanOld !== cleanNew) {
        diffs.push({
          field: key,
          fieldLabel: label,
          oldValue: oldVal ?? 'None',
          newValue: newVal ?? 'None'
        });
      }
    });

    return diffs;
  },

  /**
   * Helper to compute field diffs for Vehicle fleet changes
   */
  compareVehicle(oldData: Partial<Vehicle>, newData: Partial<Vehicle>): EntityFieldDiff[] {
    const diffs: EntityFieldDiff[] = [];

    const fieldConfig: Array<{ key: keyof Vehicle; label: string }> = [
      { key: 'unitNumber', label: 'Unit Number' },
      { key: 'plateNumber', label: 'License Plate' },
      { key: 'vin', label: 'VIN' },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'model', label: 'Model' },
      { key: 'year', label: 'Model Year' },
      { key: 'color', label: 'Color' },
      { key: 'unitType', label: 'Vehicle Type' },
      { key: 'seatCap', label: 'Passenger Capacity' },
      { key: 'wheelchairCap', label: 'Wheelchair Capacity' },
      { key: 'fuelType', label: 'Fuel Type' },
      { key: 'status', label: 'Operational Status' },
      { key: 'active', label: 'Active Status' },
      { key: 'yardName', label: 'Assigned Yard / Depot' },
      { key: 'driverName', label: 'Assigned Driver' },
      { key: 'driverPhone', label: 'Driver Contact Phone' },
      { key: 'assignedRouteNo', label: 'Assigned Route' },
      { key: 'licenseExpiry', label: 'Inspection / Plate Expiry' },
      { key: 'notes', label: 'Dispatch Notes' }
    ];

    fieldConfig.forEach(({ key, label }) => {
      const oldVal = oldData[key];
      const newVal = newData[key];

      const cleanOld = oldVal === undefined || oldVal === null ? '' : String(oldVal).trim();
      const cleanNew = newVal === undefined || newVal === null ? '' : String(newVal).trim();

      if (typeof oldVal === 'boolean' || typeof newVal === 'boolean') {
        if (Boolean(oldVal) !== Boolean(newVal)) {
          diffs.push({
            field: key,
            fieldLabel: label,
            oldValue: Boolean(oldVal),
            newValue: Boolean(newVal)
          });
        }
      } else if (typeof oldVal === 'number' || typeof newVal === 'number') {
        if (Number(oldVal || 0) !== Number(newVal || 0)) {
          diffs.push({
            field: key,
            fieldLabel: label,
            oldValue: oldVal ?? 0,
            newValue: newVal ?? 0
          });
        }
      } else if (cleanOld !== cleanNew) {
        diffs.push({
          field: key,
          fieldLabel: label,
          oldValue: oldVal ?? 'None',
          newValue: newVal ?? 'None'
        });
      }
    });

    return diffs;
  }
};
