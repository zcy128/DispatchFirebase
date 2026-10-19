import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import {
  VehicleDefectReport,
  UpdateDefectAssessmentPayload,
  DefectStatus,
} from '../types/defect';

function normalizeDefectDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'object' && val.seconds !== undefined) {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function normalizeDefectRecord(raw: any, id: string): VehicleDefectReport {
  return {
    id,
    vehicleId: Number(raw?.vehicleId || 0),
    vehicleUnitNumber: String(raw?.vehicleUnitNumber || ''),
    odometer: Number(raw?.odometer || 0),
    reportedByUserId: String(raw?.reportedByUserId || ''),
    reportedByName: String(raw?.reportedByName || ''),
    reportDate: String(raw?.reportDate || ''),
    reportTime: String(raw?.reportTime || ''),
    items: Array.isArray(raw?.items) ? raw.items : [],
    defectNotes: raw?.defectNotes || '',
    noDefectsFound: Boolean(raw?.noDefectsFound),
    confirmedAccurate: Boolean(raw?.confirmedAccurate),
    status: raw?.status || 'submitted',
    assessment: raw?.assessment
      ? {
          assessedBy: raw.assessment.assessedBy || '',
          assessedAt: normalizeDefectDate(raw.assessment.assessedAt),
          assessmentNotes: raw.assessment.assessmentNotes || '',
          repairLocation: raw.assessment.repairLocation || '',
          estimatedRepairDays: Number(raw.assessment.estimatedRepairDays || 0),
          estimatedStartDate: raw.assessment.estimatedStartDate || '',
          estimatedCompletionDate: raw.assessment.estimatedCompletionDate || '',
          actualCompletionDate: raw.assessment.actualCompletionDate || '',
          repairCost: Number(raw.assessment.repairCost || 0),
          mechanicNotes: raw.assessment.mechanicNotes || '',
          resolvedBy: raw.assessment.resolvedBy || '',
          resolvedAt: normalizeDefectDate(raw.assessment.resolvedAt),
        }
      : undefined,
    createdAt: normalizeDefectDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDefectDate(raw?.updatedAt) || new Date().toISOString(),
  };
}

export const DefectService = {
  listDefects: async (params?: Record<string, string>): Promise<VehicleDefectReport[]> => {
    const qStr = new URLSearchParams(params || {}).toString();
    try {
      const res = await apiRequest<VehicleDefectReport[]>(`/api/dispatch/vehicle-defects?${qStr}`);
      return Array.isArray(res) ? res.map((r) => normalizeDefectRecord(r, r.id)) : [];
    } catch {
      try {
        const res = await apiRequest<VehicleDefectReport[]>(
          `/api/public/dispatch/vehicle-defects?${qStr}`
        );
        return Array.isArray(res) ? res.map((r) => normalizeDefectRecord(r, r.id)) : [];
      } catch (err) {
        if (db) {
          const qRef = collection(db, 'vehicle_defects');
          const snap = await getDocs(qRef);
          const list: VehicleDefectReport[] = [];
          snap.forEach((d) => {
            list.push(normalizeDefectRecord(d.data(), d.id));
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return list;
        }
        return [];
      }
    }
  },

  getDefect: async (id: string): Promise<VehicleDefectReport> => {
    try {
      const res = await apiRequest<VehicleDefectReport>(`/api/dispatch/vehicle-defects/${id}`);
      return normalizeDefectRecord(res, res.id || id);
    } catch {
      try {
        const res = await apiRequest<VehicleDefectReport>(
          `/api/public/dispatch/vehicle-defects/${id}`
        );
        return normalizeDefectRecord(res, res.id || id);
      } catch (err) {
        if (db) {
          const dSnap = await getDoc(doc(db, 'vehicle_defects', id));
          if (dSnap.exists()) {
            return normalizeDefectRecord(dSnap.data(), dSnap.id);
          }
        }
        throw new Error(`Defect report not found: ${id}`);
      }
    }
  },

  updateAssessment: async (
    id: string,
    payload: UpdateDefectAssessmentPayload
  ): Promise<VehicleDefectReport> => {
    try {
      const res = await apiRequest<VehicleDefectReport>(
        `/api/dispatch/vehicle-defects/${id}/assessment`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
      return normalizeDefectRecord(res, res.id || id);
    } catch {
      try {
        const res = await apiRequest<VehicleDefectReport>(
          `/api/public/dispatch/vehicle-defects/${id}/assessment`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
        return normalizeDefectRecord(res, res.id || id);
      } catch (err) {
        if (db) {
          const dRef = doc(db, 'vehicle_defects', id);
          const now = new Date().toISOString();
          const patchData: any = {
            status: payload.status,
            updatedAt: now,
            'assessment.assessedBy': payload.assessedBy,
            'assessment.assessedAt': now,
            'assessment.assessmentNotes': payload.assessmentNotes || '',
            'assessment.repairLocation': payload.repairLocation || '',
            'assessment.estimatedRepairDays': payload.estimatedRepairDays || 0,
            'assessment.estimatedStartDate': payload.estimatedStartDate || '',
            'assessment.estimatedCompletionDate': payload.estimatedCompletionDate || '',
            'assessment.actualCompletionDate': payload.actualCompletionDate || '',
            'assessment.repairCost': payload.repairCost || 0,
            'assessment.mechanicNotes': payload.mechanicNotes || '',
          };
          if (payload.resolvedBy) {
            patchData['assessment.resolvedBy'] = payload.resolvedBy;
            patchData['assessment.resolvedAt'] = now;
          }
          await setDoc(dRef, patchData, { merge: true });
          const snap = await getDoc(dRef);
          return normalizeDefectRecord(snap.data(), id);
        }
        throw err;
      }
    }
  },

  updateStatus: async (id: string, status: DefectStatus): Promise<VehicleDefectReport> => {
    try {
      const res = await apiRequest<VehicleDefectReport>(
        `/api/dispatch/vehicle-defects/${id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );
      return normalizeDefectRecord(res, res.id || id);
    } catch {
      try {
        const res = await apiRequest<VehicleDefectReport>(
          `/api/public/dispatch/vehicle-defects/${id}/status`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          }
        );
        return normalizeDefectRecord(res, res.id || id);
      } catch (err) {
        if (db) {
          const dRef = doc(db, 'vehicle_defects', id);
          const now = new Date().toISOString();
          await setDoc(dRef, { status, updatedAt: now }, { merge: true });
          const snap = await getDoc(dRef);
          return normalizeDefectRecord(snap.data(), id);
        }
        throw err;
      }
    }
  },

  subscribeToDefects: (
    callback: (defects: VehicleDefectReport[]) => void
  ): (() => void) => {
    if (!db) {
      DefectService.listDefects().then(callback).catch(() => callback([]));
      return () => {};
    }

    const colRef = collection(db, 'vehicle_defects');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: VehicleDefectReport[] = [];
        snapshot.forEach((d) => {
          list.push(normalizeDefectRecord(d.data(), d.id));
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(list);
      },
      (err) => {
        console.warn('[DefectService] Firestore onSnapshot error, falling back to REST:', err);
        DefectService.listDefects().then(callback).catch(() => callback([]));
      }
    );

    return unsubscribe;
  },
};
