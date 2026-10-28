import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import { PreTripInspection } from '../types/pretrip';

function normalizePreTrip(raw: any, id: string): PreTripInspection {
  let itemsObj: Record<string, any> = {};
  if (raw?.items && typeof raw.items === 'object') {
    itemsObj = raw.items;
  }

  return {
    id: id || raw?.id || '',
    vehicleUnit: String(raw?.vehicleUnit || ''),
    vehicleId: raw?.vehicleId !== undefined ? Number(raw.vehicleId) : undefined,
    vehiclePlate: raw?.vehiclePlate ? String(raw.vehiclePlate) : undefined,
    inspectionDate: String(raw?.inspectionDate || ''),
    inspectionTime: String(raw?.inspectionTime || ''),
    inspectorId: String(raw?.inspectorId || ''),
    inspectorName: String(raw?.inspectorName || 'Driver'),
    odometer: Number(raw?.odometer || 0),
    overallStatus: (raw?.overallStatus as any) || 'passed',
    items: itemsObj,
    defectNotes: raw?.defectNotes ? String(raw.defectNotes) : undefined,
    signatureName: String(raw?.signatureName || raw?.inspectorName || ''),
    createdAt: raw?.createdAt ? (typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()) : new Date().toISOString(),
    updatedAt: raw?.updatedAt ? (typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()) : new Date().toISOString(),
  };
}

export const PreTripService = {
  isColdDate: (dateStr: string): boolean => {
    if (!dateStr) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return dateStr < cutoff.toISOString().slice(0, 10);
  },

  listInspections: async (date: string, vehicleUnit?: string): Promise<PreTripInspection[]> => {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (vehicleUnit) params.append('vehicleUnit', vehicleUnit);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<PreTripInspection[]>(`/api/public/dispatch/pretrip-inspections${qs}`);
      if (Array.isArray(res)) {
        return res.map((r) => normalizePreTrip(r, r.id));
      }
    } catch (err) {
      console.warn('[PreTripService] REST list failed, attempting Firestore fallback:', err);
    }

    // Direct Firestore fallback (for dates within last 7 days)
    if (db && (!date || !PreTripService.isColdDate(date))) {
      try {
        let q = query(collection(db, 'pretrip_inspections'));
        if (date) {
          q = query(collection(db, 'pretrip_inspections'), where('inspectionDate', '==', date));
        }
        const snap = await getDocs(q);
        const list: PreTripInspection[] = [];
        snap.forEach((d) => {
          const rec = normalizePreTrip(d.data(), d.id);
          if (vehicleUnit && rec.vehicleUnit.toLowerCase() !== vehicleUnit.toLowerCase()) {
            return;
          }
          list.push(rec);
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return list;
      } catch (e) {
        console.error('[PreTripService] Firestore fallback error:', e);
      }
    }

    return [];
  },

  getTodayInspection: async (vehicleUnit: string, date: string): Promise<PreTripInspection | null> => {
    try {
      const res = await apiRequest<{ found: boolean; inspection: PreTripInspection | null }>(
        `/api/public/dispatch/pretrip-inspections/today/${encodeURIComponent(vehicleUnit)}?date=${date}`
      );
      if (res && res.found && res.inspection) {
        return normalizePreTrip(res.inspection, res.inspection.id);
      }
    } catch {
      // ignore
    }
    return null;
  },

  subscribeToDate: (
    date: string,
    callback: (records: PreTripInspection[]) => void
  ): (() => void) => {
    // If date is cold (> 7 days), Firestore won't have new live writes; do single fetch
    if (PreTripService.isColdDate(date)) {
      PreTripService.listInspections(date).then(callback);
      return () => {};
    }

    let isSubscribed = true;

    // 1. Initial REST fetch
    PreTripService.listInspections(date).then((data) => {
      if (isSubscribed) callback(data);
    });

    // 2. Real-time Firestore listener for today / live dates
    if (db) {
      try {
        const q = date
          ? query(collection(db, 'pretrip_inspections'), where('inspectionDate', '==', date))
          : collection(db, 'pretrip_inspections');

        const unsub = onSnapshot(
          q,
          (snapshot) => {
            if (!isSubscribed) return;
            const list: PreTripInspection[] = [];
            snapshot.forEach((d) => {
              list.push(normalizePreTrip(d.data(), d.id));
            });
            list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            callback(list);
          },
          (err) => {
            console.warn('[PreTripService] onSnapshot notice:', err);
          }
        );

        return () => {
          isSubscribed = false;
          unsub();
        };
      } catch (err) {
        console.warn('[PreTripService] Failed to establish snapshot:', err);
      }
    }

    return () => {
      isSubscribed = false;
    };
  },
};
