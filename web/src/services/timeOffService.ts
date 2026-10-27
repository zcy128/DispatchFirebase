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
  TimeOffRequest,
  CreateTimeOffRequestPayload,
  UpdateTimeOffRequestPayload,
  ReviewTimeOffRequestPayload,
  TimeOffNotificationSettings,
  DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS
} from '../types/timeOff';

function normalizeTimeOffDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'object' && val.seconds !== undefined) {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function normalizeTimeOffRecord(raw: any, id: string): TimeOffRequest {
  return {
    ...raw,
    id,
    notifiedChannels: Array.isArray(raw?.notifiedChannels) ? raw.notifiedChannels : undefined,
    notifiedAt: raw?.notifiedAt ? normalizeTimeOffDate(raw.notifiedAt) : undefined,
    createdAt: normalizeTimeOffDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeTimeOffDate(raw?.updatedAt) || new Date().toISOString(),
    approvedAt: raw?.approvedAt ? normalizeTimeOffDate(raw.approvedAt) : undefined,
    rejectedAt: raw?.rejectedAt ? normalizeTimeOffDate(raw.rejectedAt) : undefined,
    isArchivedToBigQuery: Boolean(raw?.isArchivedToBigQuery),
    bigQueryDataset: raw?.bigQueryDataset || undefined,
    bigQueryTable: raw?.bigQueryTable || undefined,
    bigQueryArchivedAt: raw?.bigQueryArchivedAt ? normalizeTimeOffDate(raw.bigQueryArchivedAt) : undefined,
  };
}

export const TimeOffService = {
  listTimeOffRequests: async (params?: Record<string, string>): Promise<TimeOffRequest[]> => {
    const qStr = new URLSearchParams(params || {}).toString();
    try {
      const res = await apiRequest<TimeOffRequest[]>(`/api/dispatch/time-off-requests?${qStr}`);
      return Array.isArray(res) ? res.map((r) => normalizeTimeOffRecord(r, r.id)) : [];
    } catch {
      try {
        const res = await apiRequest<TimeOffRequest[]>(`/api/public/dispatch/time-off-requests?${qStr}`);
        return Array.isArray(res) ? res.map((r) => normalizeTimeOffRecord(r, r.id)) : [];
      } catch (err) {
        if (db) {
          const qRef = collection(db, 'time_off_requests');
          const snap = await getDocs(qRef);
          const list: TimeOffRequest[] = [];
          snap.forEach((d) => {
            list.push(normalizeTimeOffRecord(d.data(), d.id));
          });
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          return list;
        }
        throw err;
      }
    }
  },

  loadArchivedTimeOffRequests: async (params?: Record<string, string>): Promise<TimeOffRequest[]> => {
    return TimeOffService.listTimeOffRequests({ includeArchive: 'true', ...(params || {}) });
  },

  triggerBigQueryArchival: async (days: number = 30): Promise<{ success: boolean; message: string }> => {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/api/admin/archive/sync-all?days=${days}`, {
        method: 'POST',
      });
    } catch {
      return { success: false, message: 'Archive endpoint unavailable in local preview mode.' };
    }
  },

  getTimeOffRequest: async (id: string): Promise<TimeOffRequest> => {
    try {
      const res = await apiRequest<TimeOffRequest>(`/api/dispatch/time-off-requests/${encodeURIComponent(id)}`);
      return normalizeTimeOffRecord(res, res.id);
    } catch {
      try {
        const res = await apiRequest<TimeOffRequest>(`/api/public/dispatch/time-off-requests/${encodeURIComponent(id)}`);
        return normalizeTimeOffRecord(res, res.id);
      } catch (err) {
        if (db) {
          const snap = await getDoc(doc(db, 'time_off_requests', id));
          if (snap.exists()) {
            return normalizeTimeOffRecord(snap.data(), snap.id);
          }
        }
        throw err;
      }
    }
  },

  createTimeOffRequest: async (payload: CreateTimeOffRequestPayload): Promise<TimeOffRequest> => {
    try {
      return await apiRequest<TimeOffRequest>('/api/dispatch/time-off-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<TimeOffRequest>('/api/public/dispatch/time-off-requests', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const id = `TOR-${Date.now()}`;
          const nowStr = new Date().toISOString();
          const rec: TimeOffRequest = {
            ...payload,
            id,
            status: 'pending',
            createdAt: nowStr,
            updatedAt: nowStr
          };
          await setDoc(doc(db, 'time_off_requests', id), rec);
          return rec;
        }
        throw err;
      }
    }
  },

  updateTimeOffRequest: async (
    id: string,
    payload: UpdateTimeOffRequestPayload
  ): Promise<TimeOffRequest> => {
    try {
      return await apiRequest<TimeOffRequest>(`/api/dispatch/time-off-requests/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<TimeOffRequest>(`/api/public/dispatch/time-off-requests/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'time_off_requests', id);
          await setDoc(docRef, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
          const snap = await getDoc(docRef);
          return { ...snap.data(), id: docRef.id } as TimeOffRequest;
        }
        throw err;
      }
    }
  },

  approveTimeOffRequest: async (
    id: string,
    payload: ReviewTimeOffRequestPayload
  ): Promise<TimeOffRequest> => {
    try {
      return await apiRequest<TimeOffRequest>(`/api/dispatch/time-off-requests/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<TimeOffRequest>(`/api/public/dispatch/time-off-requests/${encodeURIComponent(id)}/approve`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'time_off_requests', id);
          const nowStr = new Date().toISOString();
          const hasChannels = Array.isArray(payload.notifiedChannels) && payload.notifiedChannels.length > 0;
          const updates: any = {
            status: 'approved',
            approvedByUserId: payload.reviewerUserId,
            approvedByName: payload.reviewerName,
            approvedAt: nowStr,
            approvalNotes: payload.approvalNotes || '',
            updatedAt: nowStr
          };
          if (hasChannels) {
            updates.notifiedChannels = payload.notifiedChannels;
            updates.notifiedAt = nowStr;
          }
          await setDoc(docRef, updates, { merge: true });
          const snap = await getDoc(docRef);
          return normalizeTimeOffRecord(snap.data(), docRef.id);
        }
        throw err;
      }
    }
  },

  rejectTimeOffRequest: async (
    id: string,
    payload: ReviewTimeOffRequestPayload
  ): Promise<TimeOffRequest> => {
    try {
      return await apiRequest<TimeOffRequest>(`/api/dispatch/time-off-requests/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<TimeOffRequest>(`/api/public/dispatch/time-off-requests/${encodeURIComponent(id)}/reject`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'time_off_requests', id);
          const nowStr = new Date().toISOString();
          const hasChannels = Array.isArray(payload.notifiedChannels) && payload.notifiedChannels.length > 0;
          const updates: any = {
            status: 'rejected',
            approvedByUserId: payload.reviewerUserId,
            approvedByName: payload.reviewerName,
            approvedAt: nowStr,
            approvalNotes: payload.approvalNotes || '',
            updatedAt: nowStr
          };
          if (hasChannels) {
            updates.notifiedChannels = payload.notifiedChannels;
            updates.notifiedAt = nowStr;
          }
          await setDoc(docRef, updates, { merge: true });
          const snap = await getDoc(docRef);
          return normalizeTimeOffRecord(snap.data(), docRef.id);
        }
        throw err;
      }
    }
  },

  cancelTimeOffRequest: async (id: string, userId: string): Promise<TimeOffRequest> => {
    try {
      return await apiRequest<TimeOffRequest>(`/api/dispatch/time-off-requests/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    } catch {
      try {
        return await apiRequest<TimeOffRequest>(`/api/public/dispatch/time-off-requests/${encodeURIComponent(id)}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ userId }),
        });
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'time_off_requests', id);
          const nowStr = new Date().toISOString();
          await setDoc(docRef, { status: 'cancelled', updatedAt: nowStr }, { merge: true });
          const snap = await getDoc(docRef);
          return { ...snap.data(), id: docRef.id } as TimeOffRequest;
        }
        throw err;
      }
    }
  },

  deleteTimeOffRequest: async (id: string): Promise<void> => {
    try {
      await apiRequest(`/api/dispatch/time-off-requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {
      try {
        await apiRequest(`/api/public/dispatch/time-off-requests/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        if (db) {
          await deleteDoc(doc(db, 'time_off_requests', id));
          return;
        }
        throw err;
      }
    }
  },

  subscribeToTimeOffRequests: (
    onUpdate: (requests: TimeOffRequest[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      TimeOffService.listTimeOffRequests()
        .then((list) => onUpdate(Array.isArray(list) ? list : []))
        .catch(onError);
      return () => {};
    }

    try {
      const q = collection(db, 'time_off_requests');
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: TimeOffRequest[] = [];
          snapshot.forEach((d) => {
            list.push(normalizeTimeOffRecord(d.data(), d.id));
          });
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          onUpdate(list);
        },
        (error) => {
          console.error('[TimeOffService] onSnapshot error:', error);
          if (onError) onError(error);
          TimeOffService.listTimeOffRequests()
            .then((list) => onUpdate(Array.isArray(list) ? list : []))
            .catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[TimeOffService] Exception in listener:', e);
      TimeOffService.listTimeOffRequests()
        .then((list) => onUpdate(Array.isArray(list) ? list : []))
        .catch(onError);
      return () => {};
    }
  },

  getNotificationSettings: async (): Promise<TimeOffNotificationSettings> => {
    try {
      if (db) {
        const snap = await getDoc(doc(db, 'system_settings', 'time_off_notifications'));
        if (snap.exists()) {
          return {
            ...DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS,
            ...snap.data(),
          } as TimeOffNotificationSettings;
        }
      }
    } catch (e) {
      console.warn('[TimeOffService] Failed to load settings from Firestore, trying localStorage:', e);
    }
    try {
      const local = localStorage.getItem('time_off_notification_settings');
      if (local) {
        return {
          ...DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS,
          ...JSON.parse(local),
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS;
  },

  saveNotificationSettings: async (settings: TimeOffNotificationSettings): Promise<void> => {
    try {
      localStorage.setItem('time_off_notification_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
    if (db) {
      try {
        await setDoc(doc(db, 'system_settings', 'time_off_notifications'), settings, { merge: true });
      } catch (e) {
        console.error('[TimeOffService] Failed to persist settings to Firestore:', e);
      }
    }
  },
};
