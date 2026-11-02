import { collection, getDocs, onSnapshot, type DocumentData } from 'firebase/firestore';
import { apiRequest } from './api';
import { auth, db } from './firebase';
import {
  VehicleInspectionRecord,
  InspectionAttachment,
  VehicleInspectionStats,
  PreventiveMaintenanceRecord,
  PreventiveMaintenanceStats
} from '../types/vehicleInspection';
import { Vehicle } from '../types/vehicle';
import {
  getEndOfMonthDate,
  isDueWithin30Days,
  isOverdue,
  isOlderThanTwoYears
} from '../utils/inspectionDateUtils';

const LEGACY_INSPECTION_KEY = 'dispatch_vehicle_inspections_data';
const LEGACY_PM_KEY = 'dispatch_preventive_maintenance_data';
const INSPECTION_COLLECTION = 'vehicle_inspections';
const PM_COLLECTION = 'preventive_maintenance_records';

function mapInspection(id: string, data: DocumentData): VehicleInspectionRecord {
  const record = data as VehicleInspectionRecord;
  return {
    ...record,
    id: record.id || id,
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
  };
}

function mapPMRecord(id: string, data: DocumentData): PreventiveMaintenanceRecord {
  const record = data as PreventiveMaintenanceRecord;
  return {
    ...record,
    id: record.id || id,
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
  };
}

async function readInspectionDocs(): Promise<VehicleInspectionRecord[] | null> {
  if (!db || !auth?.currentUser) return null;
  const snap = await getDocs(collection(db, INSPECTION_COLLECTION));
  return snap.docs.map((item) => mapInspection(item.id, item.data()));
}

async function readPMDocs(): Promise<PreventiveMaintenanceRecord[] | null> {
  if (!db || !auth?.currentUser) return null;
  const snap = await getDocs(collection(db, PM_COLLECTION));
  return snap.docs.map((item) => mapPMRecord(item.id, item.data()));
}

type Listener = (records: VehicleInspectionRecord[]) => void;
const listeners = new Set<Listener>();

type PMListener = (records: PreventiveMaintenanceRecord[]) => void;
const pmListeners = new Set<PMListener>();

function dropLegacyCache() {
  try {
    localStorage.removeItem(LEGACY_INSPECTION_KEY);
    localStorage.removeItem(LEGACY_PM_KEY);
  } catch {
    // ignore
  }
}

async function refreshInspections(): Promise<VehicleInspectionRecord[]> {
  const list = await VehicleInspectionService.getInspections();
  notifyListeners(list);
  return list;
}

async function refreshPMRecords(): Promise<PreventiveMaintenanceRecord[]> {
  const list = await VehicleInspectionService.getPMRecords();
  notifyPMListeners(list);
  return list;
}

export const VehicleInspectionService = {
  getInspections: async (_vehicles: Vehicle[] = []): Promise<VehicleInspectionRecord[]> => {
    dropLegacyCache();
    try {
      const fromFirebase = await readInspectionDocs();
      if (fromFirebase) return fromFirebase;
    } catch (err) {
      console.warn('[VehicleInspectionService] Firestore read failed, using API:', err);
    }
    const list = await apiRequest<VehicleInspectionRecord[]>('/api/fleet/mechanical-inspections');
    return Array.isArray(list) ? list : [];
  },

  saveInspection: async (record: VehicleInspectionRecord): Promise<VehicleInspectionRecord> => {
    const legalExpiry = getEndOfMonthDate(record.stickerMonth || record.inspectionDate);
    const isOverTwoYears = isOlderThanTwoYears(record.inspectionDate);
    const archived = record.isArchivedToBigQuery || isOverTwoYears;

    const merged: VehicleInspectionRecord = {
      ...record,
      legalExpiryDate: legalExpiry,
      isArchivedToBigQuery: archived,
      bigQueryDataset: archived ? (record.bigQueryDataset || 'fleet_compliance.semi_annual_inspections') : undefined,
      bigQueryTable: archived ? (record.bigQueryTable || 'historical_inspection_archive') : undefined,
      bigQueryArchivedAt: archived ? (record.bigQueryArchivedAt || new Date().toISOString()) : undefined,
      bigQueryRowId: archived ? (record.bigQueryRowId || `BQ-${record.unitNumber}-${Date.now()}`) : undefined,
      attachments: record.attachments || [],
      updatedAt: new Date().toISOString()
    };

    const saved = await apiRequest<VehicleInspectionRecord>('/api/fleet/mechanical-inspections', {
      method: 'POST',
      body: JSON.stringify(merged)
    });
    await refreshInspections();
    return saved;
  },

  deleteInspection: async (id: string): Promise<void> => {
    await apiRequest(`/api/fleet/mechanical-inspections/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    await refreshInspections();
  },

  addAttachment: async (inspectionId: string, attachment: InspectionAttachment): Promise<void> => {
    const list = await VehicleInspectionService.getInspections();
    const target = list.find((r) => r.id === inspectionId);
    if (!target) return;

    target.attachments = [...(target.attachments || []), attachment];
    target.updatedAt = new Date().toISOString();
    await VehicleInspectionService.saveInspection(target);
  },

  deleteAttachment: async (inspectionId: string, attachmentId: string): Promise<void> => {
    const list = await VehicleInspectionService.getInspections();
    const target = list.find((r) => r.id === inspectionId);
    if (!target) return;

    target.attachments = (target.attachments || []).filter((a) => a.id !== attachmentId);
    target.updatedAt = new Date().toISOString();
    await VehicleInspectionService.saveInspection(target);
  },

  syncToBigQuery: async (inspectionId: string): Promise<void> => {
    const list = await VehicleInspectionService.getInspections();
    const target = list.find((r) => r.id === inspectionId);
    if (!target) return;

    target.isArchivedToBigQuery = true;
    target.bigQueryDataset = 'fleet_compliance.semi_annual_inspections';
    target.bigQueryTable = 'historical_inspection_archive';
    target.bigQueryArchivedAt = new Date().toISOString();
    target.bigQueryRowId = `BQ-${target.unitNumber}-${target.stickerMonth.replace('-', '')}`;
    target.updatedAt = new Date().toISOString();
    await VehicleInspectionService.saveInspection(target);
  },

  batchArchiveOldRecordsToBigQuery: async (): Promise<number> => {
    const list = await VehicleInspectionService.getInspections();
    const pending = list.filter((record) => !record.isArchivedToBigQuery && isOlderThanTwoYears(record.inspectionDate));
    for (const record of pending) {
      record.isArchivedToBigQuery = true;
      record.bigQueryDataset = 'fleet_compliance.semi_annual_inspections';
      record.bigQueryTable = 'historical_inspection_archive';
      record.bigQueryArchivedAt = new Date().toISOString();
      record.bigQueryRowId = `BQ-${record.unitNumber}-${record.stickerMonth.replace('-', '')}`;
      record.updatedAt = new Date().toISOString();
      await VehicleInspectionService.saveInspection(record);
    }
    return pending.length;
  },

  calculateStats: (records: VehicleInspectionRecord[]): VehicleInspectionStats => {
    let dueWithin30Days = 0;
    let overdue = 0;
    let compliant = 0;
    let archivedToBigQuery = 0;
    let withAttachmentsCount = 0;

    records.forEach((r) => {
      if (r.isArchivedToBigQuery) {
        archivedToBigQuery++;
      } else if (isOverdue(r.legalExpiryDate)) {
        overdue++;
      } else if (isDueWithin30Days(r.legalExpiryDate)) {
        dueWithin30Days++;
      } else {
        compliant++;
      }

      if (r.attachments && r.attachments.length > 0) {
        withAttachmentsCount++;
      }
    });

    return {
      totalInspected: records.length,
      dueWithin30Days,
      overdue,
      compliant,
      archivedToBigQuery,
      withAttachmentsCount
    };
  },

  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    if (!db || !auth?.currentUser) {
      return () => {
        listeners.delete(listener);
      };
    }
    const unsubscribe = onSnapshot(
      collection(db, INSPECTION_COLLECTION),
      (snap) => {
        listener(snap.docs.map((item) => mapInspection(item.id, item.data())));
      },
      (err) => {
        console.warn('[VehicleInspectionService] inspection listener failed:', err);
      }
    );
    return () => {
      listeners.delete(listener);
      unsubscribe();
    };
  },

  getPMRecords: async (_vehicles: Vehicle[] = []): Promise<PreventiveMaintenanceRecord[]> => {
    dropLegacyCache();
    try {
      const fromFirebase = await readPMDocs();
      if (fromFirebase) return fromFirebase;
    } catch (err) {
      console.warn('[VehicleInspectionService] PM Firestore read failed, using API:', err);
    }
    const list = await apiRequest<PreventiveMaintenanceRecord[]>('/api/fleet/preventive-maintenance');
    return Array.isArray(list) ? list : [];
  },

  savePMRecord: async (record: PreventiveMaintenanceRecord): Promise<PreventiveMaintenanceRecord> => {
    const isOverTwoYears = isOlderThanTwoYears(record.serviceDate);
    const kmDriven = Math.max(0, record.odometerAtServiceKm - record.previousServiceOdometerKm);
    const wasOnTime = kmDriven <= record.planAllowedMaxKm && record.daysElapsedSinceLastService <= record.planAllowedMaxDays;
    const archived = record.isArchivedToBigQuery || isOverTwoYears;

    let violationNotes = record.auditViolationNotes;
    if (!wasOnTime && !violationNotes) {
      const reasons: string[] = [];
      if (kmDriven > record.planAllowedMaxKm) {
        reasons.push(`Driven ${kmDriven.toLocaleString()} km (Plan limit: ${record.planAllowedMaxKm.toLocaleString()} km)`);
      }
      if (record.daysElapsedSinceLastService > record.planAllowedMaxDays) {
        reasons.push(`Elapsed ${record.daysElapsedSinceLastService} days (Plan limit: ${record.planAllowedMaxDays} days)`);
      }
      violationNotes = `CVOR/SAAQ Audit Interval Violation: ${reasons.join(' & ')}`;
    }

    const merged: PreventiveMaintenanceRecord = {
      ...record,
      kmDrivenSinceLastService: kmDriven,
      wasPerformedOnTime: wasOnTime,
      auditViolationNotes: violationNotes,
      maintenanceStatus: record.maintenanceStatus || 'completed',
      isArchivedToBigQuery: archived,
      bigQueryDataset: archived
        ? (record.bigQueryDataset || 'fleet_compliance.preventive_maintenance_archive')
        : undefined,
      bigQueryTable: archived ? (record.bigQueryTable || 'pm_oil_change_records') : undefined,
      bigQueryArchivedAt: archived ? (record.bigQueryArchivedAt || new Date().toISOString()) : undefined,
      bigQueryRowId: archived ? (record.bigQueryRowId || `BQ-PM-${record.unitNumber}-${Date.now()}`) : undefined,
      attachments: record.attachments || [],
      updatedAt: new Date().toISOString()
    };

    const saved = await apiRequest<PreventiveMaintenanceRecord>('/api/fleet/preventive-maintenance', {
      method: 'POST',
      body: JSON.stringify(merged)
    });
    await refreshPMRecords();
    return saved;
  },

  deletePMRecord: async (id: string): Promise<void> => {
    await apiRequest(`/api/fleet/preventive-maintenance/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    await refreshPMRecords();
  },

  addPMAttachment: async (pmId: string, attachment: InspectionAttachment): Promise<void> => {
    const list = await VehicleInspectionService.getPMRecords();
    const target = list.find((r) => r.id === pmId);
    if (!target) return;

    target.attachments = [...(target.attachments || []), attachment];
    target.updatedAt = new Date().toISOString();
    await VehicleInspectionService.savePMRecord(target);
  },

  deletePMAttachment: async (pmId: string, attachmentId: string): Promise<void> => {
    const list = await VehicleInspectionService.getPMRecords();
    const target = list.find((r) => r.id === pmId);
    if (!target) return;

    target.attachments = (target.attachments || []).filter((a) => a.id !== attachmentId);
    target.updatedAt = new Date().toISOString();
    await VehicleInspectionService.savePMRecord(target);
  },

  syncPMToBigQuery: async (pmId: string): Promise<void> => {
    const list = await VehicleInspectionService.getPMRecords();
    const target = list.find((r) => r.id === pmId);
    if (!target) return;

    target.isArchivedToBigQuery = true;
    target.bigQueryDataset = 'fleet_compliance.preventive_maintenance_archive';
    target.bigQueryTable = 'pm_oil_change_records';
    target.bigQueryArchivedAt = new Date().toISOString();
    target.bigQueryRowId = `BQ-PM-${target.unitNumber}-${target.serviceDate.replace(/-/g, '')}`;
    target.updatedAt = new Date().toISOString();
    await VehicleInspectionService.savePMRecord(target);
  },

  calculatePMStats: (records: PreventiveMaintenanceRecord[]): PreventiveMaintenanceStats => {
    let dueSoonCount = 0;
    let overdueOrViolationCount = 0;
    let compliantCount = 0;
    let archivedToBigQueryCount = 0;

    const todayMs = Date.now();

    records.forEach((r) => {
      if (r.isArchivedToBigQuery) {
        archivedToBigQueryCount++;
        return;
      }

      const dueMs = new Date(r.nextDueDate + 'T23:59:59').getTime();
      const daysRemaining = Math.ceil((dueMs - todayMs) / 86400000);
      const kmRemaining = r.nextDueOdometerKm - r.currentVehicleOdometerKm;

      const isCurrentlyOverdue = daysRemaining < 0 || kmRemaining < 0;
      const isDueSoon = !isCurrentlyOverdue && (daysRemaining <= 30 || kmRemaining <= 1000);

      if (isCurrentlyOverdue || !r.wasPerformedOnTime) {
        overdueOrViolationCount++;
      } else if (isDueSoon) {
        dueSoonCount++;
      } else {
        compliantCount++;
      }
    });

    return {
      totalRecords: records.length,
      dueSoonCount,
      overdueOrViolationCount,
      compliantCount,
      archivedToBigQueryCount
    };
  },

  subscribePM: (listener: PMListener): (() => void) => {
    pmListeners.add(listener);
    if (!db || !auth?.currentUser) {
      return () => {
        pmListeners.delete(listener);
      };
    }
    const unsubscribe = onSnapshot(
      collection(db, PM_COLLECTION),
      (snap) => {
        listener(snap.docs.map((item) => mapPMRecord(item.id, item.data())));
      },
      (err) => {
        console.warn('[VehicleInspectionService] PM listener failed:', err);
      }
    );
    return () => {
      pmListeners.delete(listener);
      unsubscribe();
    };
  }
};

function notifyListeners(records: VehicleInspectionRecord[]) {
  listeners.forEach((listener) => {
    try {
      listener(records);
    } catch (err) {
      console.error('Error notifying inspection listener:', err);
    }
  });
}

function notifyPMListeners(records: PreventiveMaintenanceRecord[]) {
  pmListeners.forEach((listener) => {
    try {
      listener(records);
    } catch (err) {
      console.error('Error notifying PM listener:', err);
    }
  });
}
