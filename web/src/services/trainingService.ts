import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import {
  TrainingCourse,
  TrainingType,
  CreateTrainingCoursePayload,
  UpdateTrainingCoursePayload,
  RegisterAttendeePayload,
  UpdateAttendeeStatusPayload
} from '../types/training';

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

function normalizeCourse(raw: any, id: string): TrainingCourse {
  const registrations = Array.isArray(raw?.registrations)
    ? raw.registrations.map((r: any) => ({
        ...r,
        registeredAt: normalizeDate(r?.registeredAt) || new Date().toISOString(),
        checkedInAt: r?.checkedInAt ? normalizeDate(r.checkedInAt) : undefined,
        completedAt: r?.completedAt ? normalizeDate(r.completedAt) : undefined,
      }))
    : Array.isArray(raw?.attendees)
    ? raw.attendees.map((r: any) => ({
        ...r,
        registeredAt: normalizeDate(r?.registeredAt) || new Date().toISOString(),
        checkedInAt: r?.checkedInAt ? normalizeDate(r.checkedInAt) : undefined,
        completedAt: r?.completedAt ? normalizeDate(r.completedAt) : undefined,
      }))
    : [];

  return {
    ...raw,
    id,
    registrations,
    attendees: registrations,
    category: raw?.category || 'safety',
    endDate: raw?.endDate || raw?.startDate || '',
    registeredCount: registrations.filter(
      (r: any) => r.status !== 'cancelled_by_user' && r.status !== 'cancelled_by_office'
    ).length,
    createdAt: normalizeDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(raw?.updatedAt) || new Date().toISOString(),
  };
}

export const TrainingService = {
  listTrainingCourses: async (params?: Record<string, string>): Promise<TrainingCourse[]> => {
    const qStr = new URLSearchParams(params || {}).toString();
    try {
      const res = await apiRequest<TrainingCourse[]>(`/api/dispatch/training/courses?${qStr}`);
      return Array.isArray(res) ? res.map((c) => normalizeCourse(c, c.id)) : [];
    } catch {
      try {
        const res = await apiRequest<TrainingCourse[]>(`/api/public/dispatch/training/courses?${qStr}`);
        return Array.isArray(res) ? res.map((c) => normalizeCourse(c, c.id)) : [];
      } catch (err) {
        if (db) {
          const qRef = collection(db, 'training_courses');
          const snap = await getDocs(qRef);
          const list: TrainingCourse[] = [];
          snap.forEach((d) => {
            list.push(normalizeCourse(d.data(), d.id));
          });
          list.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
          return list;
        }
        throw err;
      }
    }
  },

  getTrainingCourse: async (id: string): Promise<TrainingCourse> => {
    try {
      const res = await apiRequest<TrainingCourse>(`/api/dispatch/training/courses/${encodeURIComponent(id)}`);
      return normalizeCourse(res, res.id);
    } catch {
      try {
        const res = await apiRequest<TrainingCourse>(`/api/public/dispatch/training/courses/${encodeURIComponent(id)}`);
        return normalizeCourse(res, res.id);
      } catch (err) {
        if (db) {
          const snap = await getDoc(doc(db, 'training_courses', id));
          if (snap.exists()) {
            return normalizeCourse(snap.data(), snap.id);
          }
        }
        throw err;
      }
    }
  },

  createTrainingCourse: async (payload: CreateTrainingCoursePayload): Promise<TrainingCourse> => {
    try {
      return await apiRequest<TrainingCourse>('/api/dispatch/training/courses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<TrainingCourse>('/api/public/dispatch/training/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const id = `TC-${Date.now()}`;
          const nowStr = new Date().toISOString();
          const rec: TrainingCourse = {
            ...payload,
            id,
            registeredCount: 0,
            status: (payload.status as any) || 'draft',
            registrations: [],
            createdAt: nowStr,
            updatedAt: nowStr,
          };
          await setDoc(doc(db, 'training_courses', id), rec);
          return rec;
        }
        throw err;
      }
    }
  },

  updateTrainingCourse: async (
    id: string,
    payload: UpdateTrainingCoursePayload
  ): Promise<TrainingCourse> => {
    try {
      return await apiRequest<TrainingCourse>(`/api/dispatch/training/courses/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<TrainingCourse>(`/api/public/dispatch/training/courses/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'training_courses', id);
          await setDoc(docRef, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
          const snap = await getDoc(docRef);
          return normalizeCourse(snap.data(), docRef.id);
        }
        throw err;
      }
    }
  },

  publishTrainingCourse: async (id: string): Promise<TrainingCourse> => {
    try {
      return await apiRequest<TrainingCourse>(`/api/dispatch/training/courses/${encodeURIComponent(id)}/publish`, {
        method: 'POST',
      });
    } catch {
      return TrainingService.updateTrainingCourse(id, { status: 'published' });
    }
  },

  cancelTrainingCourse: async (id: string): Promise<TrainingCourse> => {
    try {
      return await apiRequest<TrainingCourse>(`/api/dispatch/training/courses/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
      });
    } catch {
      return TrainingService.updateTrainingCourse(id, { status: 'cancelled' });
    }
  },

  completeTrainingCourse: async (id: string): Promise<TrainingCourse> => {
    try {
      return await apiRequest<TrainingCourse>(`/api/dispatch/training/courses/${encodeURIComponent(id)}/complete`, {
        method: 'POST',
      });
    } catch {
      return TrainingService.updateTrainingCourse(id, { status: 'completed' });
    }
  },

  deleteTrainingCourse: async (id: string): Promise<void> => {
    try {
      await apiRequest(`/api/dispatch/training/courses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {
      try {
        await apiRequest(`/api/public/dispatch/training/courses/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        if (db) {
          await deleteDoc(doc(db, 'training_courses', id));
          return;
        }
        throw err;
      }
    }
  },

  registerAttendee: async (
    courseId: string,
    payload: RegisterAttendeePayload
  ): Promise<TrainingCourse> => {
    try {
      return await apiRequest<TrainingCourse>(
        `/api/dispatch/training/courses/${encodeURIComponent(courseId)}/attendees`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
    } catch {
      try {
        return await apiRequest<TrainingCourse>(
          `/api/public/dispatch/training/courses/${encodeURIComponent(courseId)}/attendees`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'training_courses', courseId);
          const snap = await getDoc(docRef);
          if (!snap.exists()) throw new Error('Course not found');
          const course = normalizeCourse(snap.data(), snap.id);

          const isAlready = course.registrations.some(
            (r) =>
              r.employeeId === payload.employeeId &&
              r.status !== 'cancelled_by_user' &&
              r.status !== 'cancelled_by_office'
          );
          if (isAlready) throw new Error('Staff member is already registered for this session');

          const activeCount = course.registrations.filter(
            (r) => r.status !== 'cancelled_by_user' && r.status !== 'cancelled_by_office'
          ).length;
          if (course.maxSeats > 0 && activeCount >= course.maxSeats) {
            throw new Error(`Course is full (maximum ${course.maxSeats} seats reached)`);
          }

          const nowStr = new Date().toISOString();
          const newReg = {
            id: `TR-${Date.now()}-${payload.employeeId}`,
            courseId,
            employeeId: payload.employeeId,
            employeeName: payload.employeeName,
            employeeNumber: payload.employeeNumber,
            jobTitle: payload.jobTitle,
            status: 'registered',
            registeredAt: nowStr,
            notes: payload.notes || '',
          };

          const updatedRegistrations = [...course.registrations, newReg];
          await setDoc(
            docRef,
            {
              registrations: updatedRegistrations,
              registeredCount: activeCount + 1,
              updatedAt: nowStr,
            },
            { merge: true }
          );

          const updatedSnap = await getDoc(docRef);
          return normalizeCourse(updatedSnap.data(), docRef.id);
        }
        throw err;
      }
    }
  },

  updateAttendeeStatus: async (
    courseId: string,
    registrationId: string,
    payload: UpdateAttendeeStatusPayload
  ): Promise<TrainingCourse> => {
    try {
      return await apiRequest<TrainingCourse>(
        `/api/dispatch/training/courses/${encodeURIComponent(courseId)}/attendees/${encodeURIComponent(registrationId)}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );
    } catch {
      try {
        return await apiRequest<TrainingCourse>(
          `/api/public/dispatch/training/courses/${encodeURIComponent(courseId)}/attendees/${encodeURIComponent(registrationId)}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'training_courses', courseId);
          const snap = await getDoc(docRef);
          if (!snap.exists()) throw new Error('Course not found');
          const course = normalizeCourse(snap.data(), snap.id);

          const nowStr = new Date().toISOString();
          const updatedRegistrations = course.registrations.map((r) => {
            if (r.id === registrationId) {
              return {
                ...r,
                status: payload.status,
                checkedInAt: payload.status === 'checked_in' ? (r.checkedInAt || nowStr) : r.checkedInAt,
                completedAt: payload.status === 'completed' ? (r.completedAt || nowStr) : r.completedAt,
                passed: payload.passed !== undefined ? payload.passed : r.passed,
                score: payload.score !== undefined ? payload.score : r.score,
                notes: payload.notes || r.notes,
              };
            }
            return r;
          });

          const activeCount = updatedRegistrations.filter(
            (r) => r.status !== 'cancelled_by_user' && r.status !== 'cancelled_by_office'
          ).length;

          await setDoc(
            docRef,
            {
              registrations: updatedRegistrations,
              registeredCount: activeCount,
              updatedAt: nowStr,
            },
            { merge: true }
          );

          const updatedSnap = await getDoc(docRef);
          return normalizeCourse(updatedSnap.data(), docRef.id);
        }
        throw err;
      }
    }
  },

  cancelRegistration: async (
    courseId: string,
    registrationId: string
  ): Promise<TrainingCourse> => {
    return TrainingService.updateAttendeeStatus(courseId, registrationId, {
      status: 'cancelled_by_office',
    });
  },

  listTrainingTypes: async (): Promise<TrainingType[]> => {
    try {
      const res = await apiRequest<TrainingType[]>('/api/dispatch/training/types');
      return Array.isArray(res) ? res : [];
    } catch {
      try {
        const res = await apiRequest<TrainingType[]>('/api/public/dispatch/training/types');
        return Array.isArray(res) ? res : [];
      } catch (err) {
        if (db) {
          const snap = await getDocs(collection(db, 'training_types'));
          const list: TrainingType[] = [];
          snap.forEach((d) => {
            list.push({ ...d.data(), id: d.id } as TrainingType);
          });
          return list;
        }
        throw err;
      }
    }
  },

  createTrainingType: async (type: Partial<TrainingType>): Promise<TrainingType> => {
    try {
      return await apiRequest<TrainingType>('/api/dispatch/training/types', {
        method: 'POST',
        body: JSON.stringify(type),
      });
    } catch {
      if (db) {
        const id = type.id || `TT-${Date.now()}`;
        const rec = {
          ...type,
          id,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as TrainingType;
        await setDoc(doc(db, 'training_types', id), rec);
        return rec;
      }
      throw new Error('Failed to create training type');
    }
  },

  updateTrainingType: async (
    id: string,
    type: Partial<TrainingType>
  ): Promise<TrainingType> => {
    try {
      return await apiRequest<TrainingType>(`/api/dispatch/training/types/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(type),
      });
    } catch {
      if (db) {
        const docRef = doc(db, 'training_types', id);
        await setDoc(docRef, { ...type, updatedAt: new Date().toISOString() }, { merge: true });
        const snap = await getDoc(docRef);
        return { ...snap.data(), id: docRef.id } as TrainingType;
      }
      throw new Error('Failed to update training type');
    }
  },

  subscribeToTrainingCourses: (
    onUpdate: (courses: TrainingCourse[]) => void,
    onError?: (err: any) => void
  ) => {
    if (!db) {
      TrainingService.listTrainingCourses()
        .then((list) => onUpdate(Array.isArray(list) ? list : []))
        .catch(onError);
      return () => {};
    }

    try {
      const q = collection(db, 'training_courses');
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: TrainingCourse[] = [];
          snapshot.forEach((d) => {
            list.push(normalizeCourse(d.data(), d.id));
          });
          list.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
          onUpdate(list);
        },
        (error) => {
          console.error('[TrainingService] onSnapshot error:', error);
          if (onError) onError(error);
          TrainingService.listTrainingCourses()
            .then((list) => onUpdate(Array.isArray(list) ? list : []))
            .catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[TrainingService] Exception in listener:', e);
      TrainingService.listTrainingCourses()
        .then((list) => onUpdate(Array.isArray(list) ? list : []))
        .catch(onError);
      return () => {};
    }
  },

  // Aliases
  listCourses: async (params?: Record<string, string>) => TrainingService.listTrainingCourses(params),
  getCourse: async (id: string) => TrainingService.getTrainingCourse(id),
  createCourse: async (payload: CreateTrainingCoursePayload) => TrainingService.createTrainingCourse(payload),
  updateCourse: async (id: string, payload: UpdateTrainingCoursePayload) => TrainingService.updateTrainingCourse(id, payload),
  publishCourse: async (id: string) => TrainingService.publishTrainingCourse(id),
  cancelCourse: async (id: string, _reason?: string) => TrainingService.cancelTrainingCourse(id),
  completeCourse: async (id: string) => TrainingService.completeTrainingCourse(id),
};
