import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import { Yard, YardStats, CreateYardInput, UpdateYardInput } from '../types/yard';

export const YardService = {
  subscribeToYards: (
    onUpdate: (yards: Yard[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      YardService.list().then(onUpdate).catch(onError);
      return () => {};
    }

    try {
      const q = query(collection(db, 'yards'), orderBy('yardId', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: Yard[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Yard;
            list.push({
              ...data,
              id: d.id,
            });
          });
          onUpdate(list);
        },
        (error) => {
          console.error('[YardService] onSnapshot listener error:', error);
          if (onError) onError(error);
          YardService.list().then(onUpdate).catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[YardService] Exception creating onSnapshot listener:', e);
      YardService.list().then(onUpdate).catch(onError);
      return () => {};
    }
  },

  list: async (): Promise<Yard[]> => {
    return apiRequest<Yard[]>('/api/yards');
  },

  getById: async (id: string): Promise<Yard> => {
    return apiRequest<Yard>(`/api/yards/${id}`);
  },

  create: async (data: CreateYardInput): Promise<Yard> => {
    return apiRequest<Yard>('/api/yards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: UpdateYardInput): Promise<Yard> => {
    return apiRequest<Yard>(`/api/yards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/yards/${id}`, {
      method: 'DELETE',
    });
  },

  assignRoute: async (yardId: number, yardName: string, routeId: string): Promise<void> => {
    await apiRequest('/api/yards/assign-route', {
      method: 'POST',
      body: JSON.stringify({ yardId, yardName, routeId }),
    });
  },

  unassignRoute: async (routeId: string): Promise<void> => {
    await apiRequest(`/api/yards/unassign-route/${routeId}`, {
      method: 'POST',
      body: JSON.stringify({ routeId }),
    });
  },

  assignSchool: async (
    yardId: number,
    schoolId: string,
    yardName?: string
  ): Promise<{ success: boolean; affectedRoutes?: string[] }> => {
    return apiRequest<{ success: boolean; affectedRoutes?: string[] }>('/api/yards/assign-school', {
      method: 'POST',
      body: JSON.stringify({ yardId, schoolId, yardName }),
    });
  },

  unassignSchool: async (
    schoolId: string
  ): Promise<{ success: boolean; affectedRoutes?: string[] }> => {
    return apiRequest<{ success: boolean; affectedRoutes?: string[] }>(
      `/api/yards/unassign-school/${schoolId}`,
      {
        method: 'POST',
        body: JSON.stringify({ schoolId }),
      }
    );
  },

  getStats: async (): Promise<YardStats> => {
    return apiRequest<YardStats>('/api/yards/stats');
  },
};
