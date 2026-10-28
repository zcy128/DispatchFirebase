import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import {
  VehicleSignout,
  CreateVehicleSignoutPayload,
} from '../types/vehicleSignout';

function normalizeDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'object' && val.seconds !== undefined) {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function normalizeRecord(raw: any, id: string): VehicleSignout {
  return {
    id,
    isSignIn: Boolean(raw?.isSignIn),
    signDate: String(raw?.signDate || ''),
    vehicleType: Number(raw?.vehicleType ?? 0),
    employeeId: String(raw?.employeeId || ''),
    employeeName: String(raw?.employeeName || 'Driver'),
    routeId: raw?.routeId ? String(raw.routeId) : undefined,
    routeName: raw?.routeName ? String(raw.routeName) : undefined,
    cellPhone: raw?.cellPhone ? String(raw.cellPhone) : undefined,
    driverLicenseClass: raw?.driverLicenseClass ? String(raw.driverLicenseClass) : undefined,
    driverLicenseCondition: raw?.driverLicenseCondition ? String(raw.driverLicenseCondition) : undefined,
    unitId: raw?.unitId !== undefined ? Number(raw.unitId) : undefined,
    unitNumber: String(raw?.unitNumber || ''),
    odometer: Number(raw?.odometer ?? 0),
    licensePlate: raw?.licensePlate ? String(raw.licensePlate) : undefined,
    cvipDate: raw?.cvipDate ? String(raw.cvipDate) : undefined,
    unitYear: raw?.unitYear !== undefined ? Number(raw.unitYear) : undefined,
    unitMaker: raw?.unitMaker ? String(raw.unitMaker) : undefined,
    unitModel: raw?.unitModel ? String(raw.unitModel) : undefined,
    unitColor: raw?.unitColor ? String(raw.unitColor) : undefined,
    fuelLevelId: raw?.fuelLevelId !== undefined ? Number(raw.fuelLevelId) : undefined,
    fuelLevelDescription: raw?.fuelLevelDescription ? String(raw.fuelLevelDescription) : undefined,
    fuelTypeId: raw?.fuelTypeId !== undefined ? Number(raw.fuelTypeId) : undefined,
    fuelTypeDescription: raw?.fuelTypeDescription ? String(raw.fuelTypeDescription) : undefined,

    docRegistrationSignIn: Boolean(raw?.docRegistrationSignIn),
    docInsuranceSignIn: Boolean(raw?.docInsuranceSignIn),
    docSafetyFitnessSignIn: Boolean(raw?.docSafetyFitnessSignIn),
    docCollisionReportSignIn: Boolean(raw?.docCollisionReportSignIn),
    docScheduleMaintenanceSignIn: Boolean(raw?.docScheduleMaintenanceSignIn),
    docSdsSignIn: Boolean(raw?.docSdsSignIn),

    checkFireExtinguisher: Boolean(raw?.checkFireExtinguisher),
    checkFirstAidKit: Boolean(raw?.checkFirstAidKit),
    checkTriangles: Boolean(raw?.checkTriangles),
    checkQstraints: Boolean(raw?.checkQstraints),
    checkSeatBeltCutter: Boolean(raw?.checkSeatBeltCutter),
    checkBroom: Boolean(raw?.checkBroom),
    checkSnowbrush: Boolean(raw?.checkSnowbrush),
    checkCleankit: Boolean(raw?.checkCleankit),

    acknowledgeCheck: Boolean(raw?.acknowledgeCheck),
    conditionKey: raw?.conditionKey ? String(raw.conditionKey) : undefined,
    conditionComments: raw?.conditionComments ? String(raw.conditionComments) : undefined,
    parkingAddress: raw?.parkingAddress ? String(raw.parkingAddress) : undefined,
    fireHallLocation: raw?.fireHallLocation ? String(raw.fireHallLocation) : undefined,

    driverSignature: raw?.driverSignature ? String(raw.driverSignature) : undefined,
    driverSignDate: raw?.driverSignDate ? String(raw.driverSignDate) : undefined,
    fleetDepartmentSignature: raw?.fleetDepartmentSignature ? String(raw.fleetDepartmentSignature) : undefined,
    fleetDepartmentSignDate: raw?.fleetDepartmentSignDate ? String(raw.fleetDepartmentSignDate) : undefined,

    attachments: Array.isArray(raw?.attachments) ? raw.attachments : [],
    createdBy: raw?.createdBy ? String(raw.createdBy) : undefined,
    createdAt: normalizeDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(raw?.updatedAt) || new Date().toISOString(),
  };
}

export const VehicleSignoutService = {
  list: async (filters?: {
    unitNumber?: string;
    employeeId?: string;
    isSignIn?: boolean;
    query?: string;
    timeRange?: '1year' | 'all';
    startDate?: string;
    endDate?: string;
    role?: string;
  }): Promise<VehicleSignout[]> => {
    try {
      const params = new URLSearchParams();
      params.append('role', filters?.role || 'fleet');
      if (filters?.unitNumber) params.append('unitNumber', filters.unitNumber);
      if (filters?.employeeId) params.append('employeeId', filters.employeeId);
      if (filters?.isSignIn !== undefined) params.append('isSignIn', String(filters.isSignIn));
      if (filters?.query) params.append('query', filters.query);
      if (filters?.timeRange) params.append('timeRange', filters.timeRange);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<VehicleSignout[]>(`/api/public/dispatch/vehicle-signouts${qs}`);
      if (Array.isArray(res)) {
        return res.map((r) => normalizeRecord(r, r.id));
      }
    } catch {
      // Fallback to Firestore direct read if backend is offline or for preview
      if (db) {
        try {
          const snapshot = await getDocs(collection(db, 'vehicle_signouts'));
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 365);
          const cutoffStr = cutoffDate.toISOString().slice(0, 10);
          const items: VehicleSignout[] = [];
          snapshot.forEach((d) => {
            const rec = normalizeRecord(d.data(), d.id);
            if (!filters?.timeRange || filters.timeRange === '1year') {
              const rDate = rec.signDate?.slice(0, 10) || rec.createdAt.slice(0, 10);
              if (rDate && rDate < cutoffStr) return;
            }
            items.push(rec);
          });
          items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return items;
        } catch (e) {
          console.error('Firestore list vehicle signouts fallback error:', e);
        }
      }
    }
    return [];
  },

  getByID: async (id: string): Promise<VehicleSignout> => {
    try {
      const res = await apiRequest<VehicleSignout>(`/api/public/dispatch/vehicle-signouts/${id}?role=fleet`);
      return normalizeRecord(res, res.id);
    } catch {
      if (db) {
        const snap = await getDoc(doc(db, 'vehicle_signouts', id));
        if (snap.exists()) {
          return normalizeRecord(snap.data(), snap.id);
        }
      }
      throw new Error(`Vehicle signout record not found: ${id}`);
    }
  },

  create: async (payload: CreateVehicleSignoutPayload): Promise<VehicleSignout> => {
    try {
      const res = await apiRequest<VehicleSignout>('/api/public/dispatch/vehicle-signouts?role=fleet', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const record = normalizeRecord(res, res.id);
      if (db) {
        try {
          await setDoc(doc(db, 'vehicle_signouts', record.id), record, { merge: true });
        } catch (e) {
          console.warn('Sync created vehicle signout to Firestore notice:', e);
        }
      }
      return record;
    } catch {
      // Direct Firestore creation fallback
      if (db) {
        const docRef = doc(collection(db, 'vehicle_signouts'));
        const now = new Date().toISOString();
        const record: VehicleSignout = {
          ...payload,
          id: docRef.id,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(docRef, record);
        return record;
      }
      throw new Error('Failed to create vehicle signout record');
    }
  },

  update: async (id: string, payload: Partial<VehicleSignout>): Promise<VehicleSignout> => {
    try {
      const res = await apiRequest<VehicleSignout>(`/api/public/dispatch/vehicle-signouts/${id}?role=fleet`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const updated = normalizeRecord(res, res.id);
      if (db) {
        try {
          await setDoc(doc(db, 'vehicle_signouts', id), updated, { merge: true });
        } catch (e) {
          console.warn('Sync updated vehicle signout to Firestore notice:', e);
        }
      }
      return updated;
    } catch {
      if (db) {
        const now = new Date().toISOString();
        const docRef = doc(db, 'vehicle_signouts', id);
        await setDoc(docRef, { ...payload, updatedAt: now }, { merge: true });
        const snap = await getDoc(docRef);
        return normalizeRecord(snap.data(), snap.id);
      }
      throw new Error(`Failed to update vehicle signout ${id}`);
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiRequest(`/api/public/dispatch/vehicle-signouts/${id}?role=fleet`, {
        method: 'DELETE',
      });
    } catch {
      // ignore
    }
    if (db) {
      try {
        await deleteDoc(doc(db, 'vehicle_signouts', id));
      } catch (e) {
        console.warn('Sync delete vehicle signout to Firestore notice:', e);
      }
    }
  },

  subscribeToLive: (
    callback: (records: VehicleSignout[]) => void,
    onError?: (error: Error) => void
  ) => {
    if (!db) return () => {};
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    return onSnapshot(
      collection(db, 'vehicle_signouts'),
      (snapshot) => {
        const records: VehicleSignout[] = [];
        snapshot.forEach((d) => {
          const rec = normalizeRecord(d.data(), d.id);
          const rDate = rec.signDate?.slice(0, 10) || rec.createdAt.slice(0, 10);
          if (!rDate || rDate >= cutoffStr) {
            records.push(rec);
          }
        });
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(records);
      },
      (error) => {
        console.warn('[VehicleSignoutService] Firestore snapshot notice:', error);
        onError?.(error);
      }
    );
  },
};
