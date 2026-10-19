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
  StudentIncident,
  UpdateIncidentOfficeFollowUpPayload,
  StudentIncidentStatus,
} from '../types/studentIncident';

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

function normalizeIncidentRecord(raw: any, id: string): StudentIncident {
  return {
    id,
    incidentDate: String(raw?.incidentDate || ''),
    incidentTime: String(raw?.incidentTime || ''),
    studentId: raw?.studentId ? Number(raw.studentId) : undefined,
    studentNo: String(raw?.studentNo || ''),
    studentName: String(raw?.studentName || ''),
    grade: String(raw?.grade || ''),
    schoolId: raw?.schoolId ? Number(raw.schoolId) : undefined,
    schoolName: String(raw?.schoolName || ''),
    routeId: raw?.routeId ? Number(raw.routeId) : undefined,
    routeNo: String(raw?.routeNo || ''),
    routeName: String(raw?.routeName || ''),
    shiftType: String(raw?.shiftType || ''),
    driverId: String(raw?.driverId || ''),
    driverName: String(raw?.driverName || ''),
    location: String(raw?.location || ''),
    incidentTypes: Array.isArray(raw?.incidentTypes) ? raw.incidentTypes : [],
    typeOther: raw?.typeOther || '',
    description: String(raw?.description || ''),
    otherStudentsInvolved: raw?.otherStudentsInvolved || '',
    witnesses: raw?.witnesses || '',
    immediateActionTaken: raw?.immediateActionTaken || '',
    studentRemovedFromBus: Boolean(raw?.studentRemovedFromBus),
    firstAidRequired: Boolean(raw?.firstAidRequired),
    parentsNotified: Boolean(raw?.parentsNotified),
    parentsNotificationDetail: raw?.parentsNotificationDetail || '',
    status: (raw?.status as StudentIncidentStatus) || 'submitted',
    officeFollowUp: raw?.officeFollowUp
      ? {
          reviewedDate: raw.officeFollowUp.reviewedDate || '',
          administratorName: raw.officeFollowUp.administratorName || '',
          disciplinaryActions: Array.isArray(raw.officeFollowUp.disciplinaryActions)
            ? raw.officeFollowUp.disciplinaryActions
            : [],
          disciplinaryOther: raw.officeFollowUp.disciplinaryOther || '',
          officeNotes: raw.officeFollowUp.officeNotes || '',
          isOfficeLocked: Boolean(raw.officeFollowUp.isOfficeLocked),
          reviewedAt: normalizeDate(raw.officeFollowUp.reviewedAt),
        }
      : undefined,
    createdAt: normalizeDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(raw?.updatedAt) || new Date().toISOString(),
  };
}

export const StudentIncidentService = {
  listIncidents: async (params?: Record<string, string>): Promise<StudentIncident[]> => {
    const qStr = new URLSearchParams(params || {}).toString();
    try {
      const res = await apiRequest<StudentIncident[]>(`/api/dispatch/student-incidents?${qStr}`);
      return Array.isArray(res) ? res.map((r) => normalizeIncidentRecord(r, r.id)) : [];
    } catch {
      try {
        const res = await apiRequest<StudentIncident[]>(
          `/api/public/dispatch/student-incidents?${qStr}`
        );
        return Array.isArray(res) ? res.map((r) => normalizeIncidentRecord(r, r.id)) : [];
      } catch (err) {
        if (db) {
          const qRef = collection(db, 'student_incidents');
          const snap = await getDocs(qRef);
          const list: StudentIncident[] = [];
          snap.forEach((d) => {
            list.push(normalizeIncidentRecord(d.data(), d.id));
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return list;
        }
        return [];
      }
    }
  },

  getIncident: async (id: string): Promise<StudentIncident> => {
    try {
      const res = await apiRequest<StudentIncident>(`/api/dispatch/student-incidents/${id}`);
      return normalizeIncidentRecord(res, res.id || id);
    } catch {
      try {
        const res = await apiRequest<StudentIncident>(
          `/api/public/dispatch/student-incidents/${id}`
        );
        return normalizeIncidentRecord(res, res.id || id);
      } catch (err) {
        if (db) {
          const dSnap = await getDoc(doc(db, 'student_incidents', id));
          if (dSnap.exists()) {
            return normalizeIncidentRecord(dSnap.data(), dSnap.id);
          }
        }
        throw new Error(`Student incident report not found: ${id}`);
      }
    }
  },

  updateOfficeFollowUp: async (
    id: string,
    payload: UpdateIncidentOfficeFollowUpPayload
  ): Promise<StudentIncident> => {
    try {
      const res = await apiRequest<StudentIncident>(
        `/api/dispatch/student-incidents/${id}/office-review`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
      return normalizeIncidentRecord(res, res.id || id);
    } catch {
      try {
        const res = await apiRequest<StudentIncident>(
          `/api/public/dispatch/student-incidents/${id}/office-review`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
        return normalizeIncidentRecord(res, res.id || id);
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'student_incidents', id);
          const dSnap = await getDoc(docRef);
          if (dSnap.exists()) {
            const current = dSnap.data();
            const now = new Date().toISOString();
            const updated = {
              ...current,
              status: payload.status || current.status,
              officeFollowUp: {
                ...(current.officeFollowUp || {}),
                reviewedDate: payload.reviewedDate,
                administratorName: payload.administratorName,
                disciplinaryActions: payload.disciplinaryActions,
                disciplinaryOther: payload.disciplinaryOther || '',
                officeNotes: payload.officeNotes || '',
                isOfficeLocked: payload.isOfficeLocked,
                reviewedAt: now,
              },
              updatedAt: now,
            };
            await setDoc(docRef, updated, { merge: true });
            return normalizeIncidentRecord(updated, id);
          }
        }
        throw err;
      }
    }
  },

  updateStatus: async (
    id: string,
    status: StudentIncidentStatus
  ): Promise<StudentIncident> => {
    try {
      const res = await apiRequest<StudentIncident>(
        `/api/dispatch/student-incidents/${id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );
      return normalizeIncidentRecord(res, res.id || id);
    } catch {
      try {
        const res = await apiRequest<StudentIncident>(
          `/api/public/dispatch/student-incidents/${id}/status`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          }
        );
        return normalizeIncidentRecord(res, res.id || id);
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'student_incidents', id);
          const now = new Date().toISOString();
          await setDoc(docRef, { status, updatedAt: now }, { merge: true });
          const snap = await getDoc(docRef);
          return normalizeIncidentRecord(snap.data(), id);
        }
        throw err;
      }
    }
  },

  subscribeToIncidents: (callback: (data: StudentIncident[]) => void): (() => void) => {
    if (!db) {
      StudentIncidentService.listIncidents().then(callback).catch(console.error);
      return () => {};
    }

    const colRef = collection(db, 'student_incidents');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: StudentIncident[] = [];
        snapshot.forEach((d) => {
          list.push(normalizeIncidentRecord(d.data(), d.id));
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(list);
      },
      (error) => {
        console.warn('[StudentIncidentService] onSnapshot listener error, falling back:', error);
        StudentIncidentService.listIncidents().then(callback).catch(console.error);
      }
    );
  },
};
