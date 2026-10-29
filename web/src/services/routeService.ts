import { collection, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import { BusRoute, BusRouteShift, RouteStats, extractRouteAssignedEmployeeIds } from '../types/route';

export const calculateRouteStats = (routes: BusRoute[]): RouteStats => {
  const total = routes.length;
  let active = 0;
  let drivers = 0;
  let stops = 0;
  let students = 0;

  routes.forEach((r) => {
    if (r.active) active++;
    if (r.driverName) drivers++;
    stops += r.totalStops || 0;
    students += r.totalStudents || 0;
  });

  return {
    totalRoutes: total,
    activeRoutes: active,
    assignedDrivers: drivers,
    totalStops: stops,
    totalStudents: students
  };
};

export const RouteService = {
  // Pure real-time onSnapshot listener (Zero API server traffic)
  subscribeToRoutes: (
    onUpdate: (routes: BusRoute[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      console.warn('[RouteService] Firestore SDK not initialized, falling back to REST');
      RouteService.list().then(onUpdate).catch(onError);
      return () => {};
    }

    try {
      // Automatically sync any awarded permanent route openings whose effectiveStartDate has arrived
      import('./routeOpeningService')
        .then(({ RouteOpeningService }) => RouteOpeningService.syncEffectivePermanentOpenings())
        .catch(() => {});

      const q = query(collection(db, 'routes'), orderBy('routeNo', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: BusRoute[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as BusRoute;
            const assignedEmployeeIds =
              data.assignedEmployeeIds || extractRouteAssignedEmployeeIds(data);
            list.push({
              ...data,
              assignedEmployeeIds,
              id: d.id
            });
          });
          onUpdate(list);
        },
        (error) => {
          console.error('[RouteService] onSnapshot listener error:', error);
          if (onError) onError(error);
          // Fallback to REST API
          RouteService.list().then(onUpdate).catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[RouteService] Exception creating onSnapshot listener:', e);
      RouteService.list().then(onUpdate).catch(onError);
      return () => {};
    }
  },

  list: async (params?: { search?: string; status?: string; yardId?: string; driver?: string }): Promise<BusRoute[]> => {
    let queryStr = '';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.status) searchParams.append('status', params.status);
      if (params.yardId) searchParams.append('yardId', params.yardId);
      if (params.driver) searchParams.append('driver', params.driver);
      const str = searchParams.toString();
      if (str) queryStr = `?${str}`;
    }
    try {
      return await apiRequest<BusRoute[]>(`/api/routes${queryStr}`);
    } catch {
      return await apiRequest<BusRoute[]>(`/api/public/routes${queryStr}`);
    }
  },

  getById: async (id: string): Promise<BusRoute> => {
    return apiRequest<BusRoute>(`/api/routes/${id}`);
  },

  getShiftsForRoute: async (routeId: string): Promise<BusRouteShift[]> => {
    if (db) {
      try {
        const q = query(collection(db, 'route_shifts'), where('routeId', '==', routeId));
        const snap = await getDocs(q);
        const shifts: BusRouteShift[] = [];
        snap.forEach((d) => {
          shifts.push({ ...(d.data() as BusRouteShift), id: d.id });
        });
        if (shifts.length > 0) {
          // Sort chronologically by firstStopTime
          shifts.sort((a, b) => (a.firstStopTime || '').localeCompare(b.firstStopTime || ''));
          return shifts;
        }
      } catch (err) {
        console.warn('[RouteService] Direct Firestore shifts query error, falling back to REST:', err);
      }
    }
    return apiRequest<BusRouteShift[]>(`/api/routes/${routeId}/shifts`);
  },

  getAllShifts: async (): Promise<BusRouteShift[]> => {
    if (db) {
      try {
        const snap = await getDocs(collection(db, 'route_shifts'));
        const shifts: BusRouteShift[] = [];
        snap.forEach((d) => {
          shifts.push({ ...(d.data() as BusRouteShift), id: d.id });
        });
        if (shifts.length > 0) {
          shifts.sort((a, b) => (a.routeNo || '').localeCompare(b.routeNo || ''));
          return shifts;
        }
      } catch (err) {
        console.warn('[RouteService] Direct Firestore all shifts query error:', err);
      }
    }
    try {
      const routes = await RouteService.list();
      const allShifts: BusRouteShift[] = [];
      for (const r of routes) {
        const s = await RouteService.getShiftsForRoute(r.id);
        allShifts.push(...s);
      }
      return allShifts;
    } catch {
      return [];
    }
  },

  getStats: async (): Promise<RouteStats> => {
    return apiRequest<RouteStats>('/api/routes/stats');
  },

  assignCrew: async (routeId: string, payload: any): Promise<BusRoute> => {
    return apiRequest<BusRoute>(`/api/routes/${routeId}/crew`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  updateShift: async (shiftId: string, payload: Partial<BusRouteShift>): Promise<BusRouteShift> => {
    // Sanitize payload recursively to remove any undefined fields before sending to Firestore or REST API
    const sanitizeForFirestore = (obj: any): any => {
      if (obj === null || obj === undefined) return null;
      if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
      }
      if (typeof obj === 'object') {
        const res: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            res[key] = sanitizeForFirestore(value);
          }
        }
        return res;
      }
      return obj;
    };

    const cleanPayload = sanitizeForFirestore(payload);

    // 1. Direct Firestore update for real-time instantaneous sync
    if (db) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const shiftRef = doc(db, 'route_shifts', shiftId);
        await updateDoc(shiftRef, {
          ...cleanPayload,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('[RouteService] Firestore updateShift fallback to API:', err);
      }
    }

    // 2. Call backend API endpoint if needed
    try {
      return await apiRequest<BusRouteShift>(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        body: JSON.stringify(cleanPayload)
      });
    } catch {
      return cleanPayload as BusRouteShift;
    }
  },

  updateRoute: async (routeId: string, payload: Partial<BusRoute>): Promise<BusRoute> => {
    return apiRequest<BusRoute>(`/api/routes/${routeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  toggleAutoMarryup: async (routeId: string, currentEnabled: boolean): Promise<BusRoute> => {
    return RouteService.updateRoute(routeId, {
      autoMarryup: !currentEnabled
    });
  }
};
