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
  RouteAssessment,
  CreateRouteAssessmentPayload,
  UpdateRouteAssessmentOfficePayload,
  UpdateRouteAssessmentPayload,
} from '../types/routeAssessment';

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

function normalizeAssessmentRecord(raw: any, id: string): RouteAssessment {
  const isCompleted = Boolean(raw?.isCompleted);
  const isSubmitted = Boolean(raw?.isSubmitted);

  let statusInt = Number(raw?.statusInt ?? (isSubmitted ? 3 : isCompleted ? 2 : 0));
  let statusStr = String(raw?.statusStr || (statusInt === 3 ? 'Submitted' : statusInt === 2 ? 'Completed' : 'Working'));

  return {
    id,
    assessmentType: String(raw?.assessmentType ?? '0'),
    routeId: String(raw?.routeId ?? ''),
    schoolBoardId: raw?.schoolBoardId !== undefined ? Number(raw.schoolBoardId) : undefined,
    schoolBoard: raw?.schoolBoard ? String(raw.schoolBoard) : undefined,
    schoolId: raw?.schoolId !== undefined ? Number(raw.schoolId) : undefined,
    school: raw?.school ? String(raw.school) : undefined,
    schoolYear: raw?.schoolYear ? String(raw.schoolYear) : undefined,
    assessmentDate: normalizeDate(raw?.assessmentDate),
    conductedByDriver: String(raw?.conductedByDriver ?? 'Driver'),
    conductedByOperator: raw?.conductedByOperator ? String(raw.conductedByOperator) : undefined,
    conductedByEmployeeId: raw?.conductedByEmployeeId ? String(raw.conductedByEmployeeId) : undefined,
    driverEmail: raw?.driverEmail ? String(raw.driverEmail) : undefined,
    driverPhone: raw?.driverPhone ? String(raw.driverPhone) : undefined,
    summary: raw?.summary ? String(raw.summary) : '',

    // 11 Core Assessment Safety Checklist Questions
    visibilityProblemCheck: Boolean(raw?.visibilityProblemCheck),
    visibilityProblem: raw?.visibilityProblem ? String(raw.visibilityProblem) : undefined,

    highwayStopConcernCheck: Boolean(raw?.highwayStopConcernCheck),
    highwayStopConcern: raw?.highwayStopConcern ? String(raw.highwayStopConcern) : undefined,

    locationProblemCheck: Boolean(raw?.locationProblemCheck),
    locationProblem: raw?.locationProblem ? String(raw.locationProblem) : undefined,

    unsafeTurnaroundCheck: Boolean(raw?.unsafeTurnaroundCheck),
    unsafeTurnaround: raw?.unsafeTurnaround ? String(raw.unsafeTurnaround) : undefined,

    intersectionCheck: Boolean(raw?.intersectionCheck),
    intersection: raw?.intersection ? String(raw.intersection) : undefined,

    roadwayCheck: Boolean(raw?.roadwayCheck),
    roadway: raw?.roadway ? String(raw.roadway) : undefined,

    nonweatherRiskCheck: Boolean(raw?.nonweatherRiskCheck),
    nonweatherRisk: raw?.nonweatherRisk ? String(raw.nonweatherRisk) : undefined,

    weatherRiskCheck: Boolean(raw?.weatherRiskCheck),
    weatherRisk: raw?.weatherRisk ? String(raw.weatherRisk) : undefined,

    companyPolicyCheck: Boolean(raw?.companyPolicyCheck),
    companyPolicyFamiliar: Boolean(raw?.companyPolicyFamiliar),
    routeAdjustCheck: Boolean(raw?.routeAdjustCheck),
    routeAdjust: raw?.routeAdjust ? String(raw.routeAdjust) : undefined,

    safetyConcernCheck: Boolean(raw?.safetyConcernCheck),
    safetyConcern: raw?.safetyConcern ? String(raw.safetyConcern) : undefined,

    // Office Processing Section
    assignedTo: raw?.assignedTo ? String(raw.assignedTo) : undefined,
    isCompleted,
    isSubmitted,

    statusInt,
    statusStr,

    attachmentUrls: Array.isArray(raw?.attachmentUrls) ? raw.attachmentUrls : [],
    createdAt: normalizeDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(raw?.updatedAt) || new Date().toISOString(),
  };
}

export const RouteAssessmentService = {
  listAssessments: async (filters?: {
    routeId?: string;
    employeeId?: string;
    status?: string | number;
    assessmentType?: string;
  }): Promise<RouteAssessment[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.routeId) params.append('routeId', filters.routeId);
      if (filters?.employeeId) params.append('employeeId', filters.employeeId);
      if (filters?.status !== undefined) params.append('status', String(filters.status));
      if (filters?.assessmentType) params.append('assessmentType', filters.assessmentType);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<RouteAssessment[]>(`/api/public/dispatch/route-assessments${qs}`);
      if (Array.isArray(res)) {
        return res.map((r) => normalizeAssessmentRecord(r, r.id));
      }
    } catch {
      // Fallback to Firestore direct read if backend is not reachable
      if (db) {
        try {
          const snapshot = await getDocs(collection(db, 'route_assessments'));
          const items: RouteAssessment[] = [];
          snapshot.forEach((d) => items.push(normalizeAssessmentRecord(d.data(), d.id)));
          items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return items;
        } catch (e) {
          console.error('Firestore list route assessments fallback error:', e);
        }
      }
    }
    return [];
  },

  getAssessment: async (id: string): Promise<RouteAssessment> => {
    try {
      const res = await apiRequest<RouteAssessment>(`/api/public/dispatch/route-assessments/${id}`);
      return normalizeAssessmentRecord(res, res.id);
    } catch {
      if (db) {
        const snap = await getDoc(doc(db, 'route_assessments', id));
        if (snap.exists()) {
          return normalizeAssessmentRecord(snap.data(), snap.id);
        }
      }
      throw new Error(`Route assessment not found: ${id}`);
    }
  },

  createAssessment: async (payload: CreateRouteAssessmentPayload): Promise<RouteAssessment> => {
    try {
      const res = await apiRequest<RouteAssessment>('/api/public/dispatch/route-assessments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const record = normalizeAssessmentRecord(res, res.id);
      if (db) {
        try {
          const ref = doc(db, 'route_assessments', record.id);
          await setDoc(ref, record);
        } catch (_) {}
      }
      return record;
    } catch {
      if (db) {
        const ref = doc(collection(db, 'route_assessments'));
        const now = new Date().toISOString();
        const record = {
          ...payload,
          id: ref.id,
          statusInt: payload.isSubmitted ? 3 : payload.isCompleted ? 2 : 0,
          statusStr: payload.isSubmitted ? 'Submitted' : payload.isCompleted ? 'Completed' : 'Working',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(ref, record);
        return normalizeAssessmentRecord(record, ref.id);
      }
      throw new Error('Failed to create route assessment');
    }
  },

  updateOfficeProcessing: async (
    id: string,
    payload: UpdateRouteAssessmentOfficePayload
  ): Promise<RouteAssessment> => {
    try {
      const res = await apiRequest<RouteAssessment>(
        `/api/public/dispatch/route-assessments/${id}/office`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
      const record = normalizeAssessmentRecord(res, res.id);
      if (db) {
        try {
          const ref = doc(db, 'route_assessments', id);
          await setDoc(ref, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (_) {}
      }
      return record;
    } catch {
      if (db) {
        const ref = doc(db, 'route_assessments', id);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data() : {};
        const now = new Date().toISOString();
        const isCompleted = payload.isCompleted ?? existing.isCompleted;
        const isSubmitted = payload.isSubmitted ?? existing.isSubmitted;
        const updated = {
          ...existing,
          ...payload,
          statusInt: isSubmitted ? 3 : isCompleted ? 2 : 0,
          statusStr: isSubmitted ? 'Submitted' : isCompleted ? 'Completed' : 'Working',
          updatedAt: now,
        };
        await setDoc(ref, updated, { merge: true });
        return normalizeAssessmentRecord(updated, id);
      }
      throw new Error('Failed to update office processing');
    }
  },

  updateAssessment: async (
    id: string,
    payload: UpdateRouteAssessmentPayload
  ): Promise<RouteAssessment> => {
    try {
      const res = await apiRequest<RouteAssessment>(
        `/api/public/dispatch/route-assessments/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );
      const record = normalizeAssessmentRecord(res, res.id);
      if (db) {
        try {
          const ref = doc(db, 'route_assessments', id);
          await setDoc(ref, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (_) {}
      }
      return record;
    } catch {
      if (db) {
        const ref = doc(db, 'route_assessments', id);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data() : {};
        const now = new Date().toISOString();
        const updated = {
          ...existing,
          ...payload,
          updatedAt: now,
        };
        await setDoc(ref, updated, { merge: true });
        return normalizeAssessmentRecord(updated, id);
      }
      throw new Error('Failed to update route assessment');
    }
  },

  deleteAssessment: async (id: string): Promise<void> => {
    try {
      await apiRequest(`/api/public/dispatch/route-assessments/${id}`, {
        method: 'DELETE',
      });
      if (db) {
        try {
          await deleteDoc(doc(db, 'route_assessments', id));
        } catch (_) {}
      }
    } catch {
      if (db) {
        await deleteDoc(doc(db, 'route_assessments', id));
      }
    }
  },

  subscribeRouteAssessments: (
    callback: (assessments: RouteAssessment[]) => void,
    pollingIntervalMs = 5000
  ): (() => void) => {
    let isSubscribed = true;
    let pollTimer: any = null;
    let unsubscribeSnapshot: (() => void) | null = null;
    let restItems: RouteAssessment[] = [];
    let firestoreItems: RouteAssessment[] = [];

    const emitMerged = () => {
      if (!isSubscribed) return;
      const map = new Map<string, RouteAssessment>();
      for (const item of restItems) {
        map.set(item.id, item);
      }
      for (const item of firestoreItems) {
        const existing = map.get(item.id);
        if (
          !existing ||
          new Date(item.updatedAt || item.createdAt).getTime() >=
            new Date(existing.updatedAt || existing.createdAt).getTime()
        ) {
          map.set(item.id, item);
        }
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      callback(merged);
    };

    const fetchLatestRest = async () => {
      if (!isSubscribed) return;
      try {
        const data = await RouteAssessmentService.listAssessments();
        if (isSubscribed) {
          restItems = data;
          emitMerged();
        }
      } catch (err) {
        console.warn('[RouteAssessmentService] Polling fetch error:', err);
      }
    };

    // 1. Initial fetch
    fetchLatestRest();

    // 2. Poll every 5s for background sync
    pollTimer = setInterval(fetchLatestRest, pollingIntervalMs);

    // 3. Real-time Firestore onSnapshot
    if (db) {
      try {
        const collRef = collection(db, 'route_assessments');
        unsubscribeSnapshot = onSnapshot(
          collRef,
          (snapshot) => {
            if (!isSubscribed) return;
            const items: RouteAssessment[] = [];
            snapshot.forEach((d) => {
              items.push(normalizeAssessmentRecord(d.data(), d.id));
            });
            firestoreItems = items;
            emitMerged();
          },
          (error) => {
            console.warn('[RouteAssessmentService] Firestore onSnapshot error, polling remains active:', error);
          }
        );
      } catch (err) {
        console.warn('[RouteAssessmentService] Failed to establish onSnapshot:', err);
      }
    }

    // 4. Tab focus auto-sync
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
