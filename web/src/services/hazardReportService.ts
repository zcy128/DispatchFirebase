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
  HazardReport,
  CreateHazardReportPayload,
  UpdateHazardReportOfficePayload,
} from '../types/hazardReport';

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

function normalizeHazardRecord(raw: any, id: string): HazardReport {
  let statusInt = Number(raw?.statusInt ?? 0);
  let statusStr = String(raw?.statusStr || (statusInt === 2 ? 'Resolved' : statusInt === 1 ? 'Investigating' : 'Open'));

  return {
    id,
    reportedBy: String(raw?.reportedBy || 'Driver / Crew'),
    reportedByEmployeeId: raw?.reportedByEmployeeId ? String(raw.reportedByEmployeeId) : undefined,
    personInvolved: raw?.personInvolved ? String(raw.personInvolved) : undefined,
    unitId: raw?.unitId ? String(raw.unitId) : undefined,
    unitNumber: raw?.unitNumber ? String(raw.unitNumber) : undefined,
    routeId: raw?.routeId ? String(raw.routeId) : undefined,
    routeName: raw?.routeName ? String(raw.routeName) : undefined,
    phone: raw?.phone ? String(raw.phone) : undefined,
    supervisor: raw?.supervisor ? String(raw.supervisor) : undefined,
    eventTime: raw?.eventTime ? String(raw.eventTime) : undefined,
    eventLocation: raw?.eventLocation ? String(raw.eventLocation) : undefined,
    witnesses: raw?.witnesses ? String(raw.witnesses) : undefined,
    eventDescription: String(raw?.eventDescription || ''),

    // Hazard Types
    trippingHazard: Boolean(raw?.trippingHazard),
    trafficHazard: Boolean(raw?.trafficHazard),
    equipmentHazard: Boolean(raw?.equipmentHazard),
    performanceHazard: Boolean(raw?.performanceHazard),
    snowHazard: Boolean(raw?.snowHazard),
    spillHazard: Boolean(raw?.spillHazard),
    otherHazard: Boolean(raw?.otherHazard),

    // Close Call Types
    unsafeAction: Boolean(raw?.unsafeAction),
    unsafeCondition: Boolean(raw?.unsafeCondition),
    happenedtoMe: Boolean(raw?.happenedtoMe),
    happenedtoSomeone: Boolean(raw?.happenedtoSomeone),
    ofanarea: Boolean(raw?.ofanarea),
    ofEquipment: Boolean(raw?.ofEquipment),

    // Risk Potential Evaluation
    moderate: Boolean(raw?.moderate),
    serious: Boolean(raw?.serious),
    minor: Boolean(raw?.minor),
    probableRecurrence: Boolean(raw?.probableRecurrence),
    occasional: Boolean(raw?.occasional),
    rare: Boolean(raw?.rare),
    suggestion: raw?.suggestion ? String(raw.suggestion) : undefined,
    actionTaken: raw?.actionTaken ? String(raw.actionTaken) : undefined,
    assignedTo: raw?.assignedTo ? String(raw.assignedTo) : undefined,
    isCompleted: Boolean(raw?.isCompleted),
    officeHazardType: raw?.officeHazardType ? String(raw.officeHazardType) : undefined,
    employeeIdError: raw?.employeeIdError ? String(raw.employeeIdError) : undefined,
    employeeNameError: raw?.employeeNameError ? String(raw.employeeNameError) : undefined,
    safetySignedBy: raw?.safetySignedBy ? String(raw.safetySignedBy) : undefined,
    safetySignedDate: normalizeDate(raw?.safetySignedDate),

    statusInt,
    statusStr,

    attachmentUrls: Array.isArray(raw?.attachmentUrls) ? raw.attachmentUrls : [],
    createdAt: normalizeDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(raw?.updatedAt) || new Date().toISOString(),
  };
}

export const HazardReportService = {
  listReports: async (filters?: {
    employeeId?: string;
    status?: string | number;
    officeHazardType?: string;
    unitNumber?: string;
    routeId?: string;
    query?: string;
    timeRange?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<HazardReport[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.employeeId) params.append('employeeId', filters.employeeId);
      if (filters?.status !== undefined) params.append('status', String(filters.status));
      if (filters?.officeHazardType) params.append('officeHazardType', filters.officeHazardType);
      if (filters?.unitNumber) params.append('unitNumber', filters.unitNumber);
      if (filters?.routeId) params.append('routeId', filters.routeId);
      if (filters?.query) params.append('query', filters.query);
      if (filters?.timeRange) params.append('timeRange', filters.timeRange);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<HazardReport[]>(`/api/public/dispatch/hazard-reports${qs}`);
      if (Array.isArray(res)) {
        return res.map((r) => normalizeHazardRecord(r, r.id));
      }
    } catch {
      // Fallback to Firestore direct read if backend is not reachable
      if (db) {
        try {
          const snapshot = await getDocs(collection(db, 'hazard_reports'));
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 365);
          const cutoffStr = cutoffDate.toISOString().slice(0, 10);
          const items: HazardReport[] = [];
          snapshot.forEach((d) => {
            const rec = normalizeHazardRecord(d.data(), d.id);
            if (!filters?.timeRange || filters.timeRange === '1year') {
              const rDate = rec.eventTime?.slice(0, 10) || rec.createdAt.slice(0, 10);
              if (rDate && rDate < cutoffStr) return;
            }
            items.push(rec);
          });
          items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return items;
        } catch (e) {
          console.error('Firestore list hazard reports fallback error:', e);
        }
      }
    }
    return [];
  },

  getReport: async (id: string): Promise<HazardReport> => {
    try {
      const res = await apiRequest<HazardReport>(`/api/public/dispatch/hazard-reports/${id}`);
      return normalizeHazardRecord(res, res.id);
    } catch {
      if (db) {
        const snap = await getDoc(doc(db, 'hazard_reports', id));
        if (snap.exists()) {
          return normalizeHazardRecord(snap.data(), snap.id);
        }
      }
      throw new Error(`Hazard report not found: ${id}`);
    }
  },

  createReport: async (payload: CreateHazardReportPayload): Promise<HazardReport> => {
    try {
      const res = await apiRequest<HazardReport>('/api/public/dispatch/hazard-reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const record = normalizeHazardRecord(res, res.id);
      if (db) {
        try {
          const ref = doc(db, 'hazard_reports', record.id);
          await setDoc(ref, record);
        } catch (_) {}
      }
      return record;
    } catch {
      if (db) {
        const ref = doc(collection(db, 'hazard_reports'));
        const now = new Date().toISOString();
        const record = {
          ...payload,
          id: ref.id,
          statusInt: 0,
          statusStr: 'Open',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(ref, record);
        return normalizeHazardRecord(record, ref.id);
      }
      throw new Error('Failed to create hazard report');
    }
  },

  updateOfficeEvaluation: async (
    id: string,
    payload: UpdateHazardReportOfficePayload
  ): Promise<HazardReport> => {
    try {
      const res = await apiRequest<HazardReport>(
        `/api/public/dispatch/hazard-reports/${id}/office-evaluation`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
      const record = normalizeHazardRecord(res, res.id);
      if (db) {
        try {
          const ref = doc(db, 'hazard_reports', id);
          await setDoc(ref, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (_) {}
      }
      return record;
    } catch {
      if (db) {
        const ref = doc(db, 'hazard_reports', id);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data() : {};
        const now = new Date().toISOString();
        const updated = {
          ...existing,
          ...payload,
          updatedAt: now,
        };
        await setDoc(ref, updated, { merge: true });
        return normalizeHazardRecord(updated, id);
      }
      throw new Error('Failed to update office evaluation');
    }
  },

  subscribeHazardReports: (
    callback: (reports: HazardReport[]) => void,
    pollingIntervalMs = 5000
  ): (() => void) => {
    let isSubscribed = true;
    let pollTimer: any = null;
    let unsubscribeSnapshot: (() => void) | null = null;
    let restReports: HazardReport[] = [];
    let firestoreReports: HazardReport[] = [];

    const emitMerged = () => {
      if (!isSubscribed) return;
      const map = new Map<string, HazardReport>();
      for (const r of restReports) {
        map.set(r.id, r);
      }
      for (const r of firestoreReports) {
        const existing = map.get(r.id);
        if (
          !existing ||
          new Date(r.updatedAt || r.createdAt).getTime() >=
            new Date(existing.updatedAt || existing.createdAt).getTime()
        ) {
          map.set(r.id, r);
        }
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      callback(merged);
    };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const fetchLatestRest = async () => {
      if (!isSubscribed) return;
      try {
        const data = await HazardReportService.listReports({ timeRange: '1year' });
        if (isSubscribed) {
          restReports = data;
          emitMerged();
        }
      } catch (err) {
        console.warn('[HazardReportService] Polling fetch error:', err);
      }
    };

    // 1. Initial immediate REST fetch
    fetchLatestRest();

    // 2. Poll every 5s to guarantee fresh updates even if submitted via REST
    pollTimer = setInterval(fetchLatestRest, pollingIntervalMs);

    // 3. Real-time Firestore onSnapshot listener for instant 0-second push (live data <= 1 year)
    if (db) {
      try {
        const collRef = collection(db, 'hazard_reports');
        unsubscribeSnapshot = onSnapshot(
          collRef,
          (snapshot) => {
            if (!isSubscribed) return;
            const items: HazardReport[] = [];
            snapshot.forEach((d) => {
              const rec = normalizeHazardRecord(d.data(), d.id);
              const rDate = rec.eventTime?.slice(0, 10) || rec.createdAt.slice(0, 10);
              if (!rDate || rDate >= cutoffStr) {
                items.push(rec);
              }
            });
            firestoreReports = items;
            emitMerged();
          },
          (error) => {
            console.warn('[HazardReportService] Firestore subscription error, polling remains active:', error);
          }
        );
      } catch (err) {
        console.warn('[HazardReportService] Failed to establish onSnapshot, polling remains active:', err);
      }
    }

    // 4. Auto-sync on window focus / tab visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isSubscribed) {
        fetchLatestRest();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      isSubscribed = false;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  },
};
