import {
  collection,
  addDoc,
  query,
  orderBy,
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

const LOCAL_STORAGE_KEY = 'dispatch_entity_operation_logs';

/**
 * Initial seed audit logs for demonstration and immediate display
 */
const SEED_ENTITY_LOGS: EntityOperationLog[] = [
  {
    id: 'eol-seed-stu-001',
    targetType: 'student',
    targetId: 'STU-1004',
    targetIdentifier: 'STU-1004',
    targetName: 'Liam Tremblay',
    action: 'update',
    summary: 'Updated pickup stop instructions and marked Met at Bus requirement',
    diffs: [
      { field: 'metatBus', fieldLabel: 'Met at Bus Requirement', oldValue: false, newValue: true },
      { field: 'studentDispatchNotes', fieldLabel: 'Care Plan / Dispatch Notes', oldValue: '', newValue: 'Parent must receive child directly at bus door' }
    ],
    actor: {
      userId: 'usr-disp-101',
      userName: 'Sarah Jenkins',
      userEmail: 's.jenkins@dispatch.net',
      userRole: 'dispatcher'
    },
    timestamp: new Date(Date.now() - 3600000 * 36).toISOString()
  },
  {
    id: 'eol-seed-stu-002',
    targetType: 'student',
    targetId: 'STU-1002',
    targetIdentifier: 'STU-1002',
    targetName: 'Emma Watson',
    action: 'update',
    summary: 'Changed residential address and assigned route OCDSB-001',
    diffs: [
      { field: 'studentAddress', fieldLabel: 'Home Address', oldValue: '45 Baseline Rd, Ottawa', newValue: '88 Richmond Rd, Ottawa' },
      { field: 'routes', fieldLabel: 'Assigned Routes', oldValue: 'OCDSB-004', newValue: 'OCDSB-001' }
    ],
    actor: {
      userId: 'usr-admin-001',
      userName: 'Admin User',
      userEmail: 'admin@schoolbus.com',
      userRole: 'admin'
    },
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'eol-seed-stu-003',
    targetType: 'student',
    targetId: 'STU-1010',
    targetIdentifier: 'STU-1010',
    targetName: 'Lucas Martin',
    action: 'create',
    summary: 'Created new student profile for Grade 3 student at Bell High School',
    diffs: [
      { field: 'fullName', fieldLabel: 'Student Name', oldValue: undefined, newValue: 'Lucas Martin' },
      { field: 'grade', fieldLabel: 'Grade', oldValue: undefined, newValue: '3' },
      { field: 'schoolName', fieldLabel: 'School', oldValue: undefined, newValue: 'Bell High School' },
      { field: 'active', fieldLabel: 'Status', oldValue: undefined, newValue: true }
    ],
    actor: {
      userId: 'usr-disp-102',
      userName: 'David Miller',
      userEmail: 'd.miller@dispatch.net',
      userRole: 'dispatcher'
    },
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'eol-seed-veh-001',
    targetType: 'vehicle',
    targetId: 'VEH-001',
    targetIdentifier: '1001',
    targetName: 'Blue Bird CE Series (ON-1001)',
    action: 'update',
    summary: 'Transferred home yard from HQ-South to HQ-Central and updated safety inspection expiry',
    diffs: [
      { field: 'yardName', fieldLabel: 'Terminal Yard', oldValue: 'HQ-South', newValue: 'HQ-Central' },
      { field: 'licenseExpiry', fieldLabel: 'Safety Inspection Expiry', oldValue: '2026-06-30', newValue: '2027-08-31' }
    ],
    actor: {
      userId: 'usr-fleet-001',
      userName: 'Robert Vance',
      userEmail: 'r.vance@dispatch.net',
      userRole: 'admin'
    },
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 'eol-seed-veh-002',
    targetType: 'vehicle',
    targetId: 'VEH-002',
    targetIdentifier: '1002',
    targetName: 'Thomas Saf-T-Liner C2 (ON-1002)',
    action: 'update',
    summary: 'Allocated vehicle to regular route OCDSB-001 with driver James Anderson',
    diffs: [
      { field: 'status', fieldLabel: 'Fleet Status', oldValue: 'Spare', newValue: 'In Service' },
      { field: 'assignedRouteNo', fieldLabel: 'Assigned Route', oldValue: 'None', newValue: 'OCDSB-001' },
      { field: 'driverName', fieldLabel: 'Assigned Driver', oldValue: 'None', newValue: 'James Anderson' }
    ],
    actor: {
      userId: 'usr-disp-101',
      userName: 'Sarah Jenkins',
      userEmail: 's.jenkins@dispatch.net',
      userRole: 'dispatcher'
    },
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'eol-seed-veh-003',
    targetType: 'vehicle',
    targetId: 'VEH-099',
    targetIdentifier: '1099',
    targetName: 'Chevrolet Express Van 3500 (ON-9099)',
    action: 'delete',
    summary: 'Decommissioned fleet van due to age and retired from active inventory',
    diffs: [
      { field: 'status', fieldLabel: 'Fleet Status', oldValue: 'Maintenance', newValue: 'Decommissioned / Deleted' },
      { field: 'active', fieldLabel: 'Active Flag', oldValue: true, newValue: false }
    ],
    actor: {
      userId: 'usr-fleet-001',
      userName: 'Robert Vance',
      userEmail: 'r.vance@dispatch.net',
      userRole: 'admin'
    },
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString()
  }
];

export const EntityOperationLogService = {
  /**
   * Read stored logs from localStorage, merging with seed logs
   */
  getStoredLogs(): EntityOperationLog[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_ENTITY_LOGS));
        return SEED_ENTITY_LOGS;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_ENTITY_LOGS));
        return SEED_ENTITY_LOGS;
      }
      return parsed;
    } catch (e) {
      console.warn('[EntityOperationLogService] Failed to read localStorage logs:', e);
      return SEED_ENTITY_LOGS;
    }
  },

  /**
   * Save an array of logs to localStorage
   */
  saveStoredLogs(logs: EntityOperationLog[]): void {
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
    onError?: (err: Error) => void
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

    if (!db) {
      const local = EntityOperationLogService.getStoredLogs();
      onUpdate(applyFilter(local));
      return () => {};
    }

    try {
      const q = query(collection(db, 'entity_operation_logs'), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const remoteList: EntityOperationLog[] = [];
          snap.forEach((doc) => {
            const d = doc.data() as EntityOperationLog;
            remoteList.push({
              ...d,
              id: doc.id
            });
          });

          // Merge local seed or cached logs with Firestore remote logs
          const localList = EntityOperationLogService.getStoredLogs();
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

          onUpdate(applyFilter(combined));
        },
        (err) => {
          console.warn('[EntityOperationLogService] onSnapshot error, falling back to local storage:', err);
          if (onError) onError(err);
          const local = EntityOperationLogService.getStoredLogs();
          onUpdate(applyFilter(local));
        }
      );
      return unsub;
    } catch (err: any) {
      console.warn('[EntityOperationLogService] Failed to establish listener, falling back:', err);
      const local = EntityOperationLogService.getStoredLogs();
      onUpdate(applyFilter(local));
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
