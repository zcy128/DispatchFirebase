import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import { Vehicle, VehicleStats } from '../types/vehicle';

export const calculateVehicleStats = (vehicles: Vehicle[]): VehicleStats => {
  const total = vehicles.length;
  let active = 0;
  let assigned = 0;
  let spare = 0;
  let wheelchair = 0;
  const typeMap: Record<string, number> = {};
  const fuelMap: Record<string, number> = {};
  const yardMap: Record<string, number> = {};

  vehicles.forEach((v) => {
    if (v.active) active++;
    if (v.assignedRouteId) {
      assigned++;
    } else {
      spare++;
    }
    if (v.wheelchairCap > 0) wheelchair++;

    if (v.unitType) typeMap[v.unitType] = (typeMap[v.unitType] || 0) + 1;
    if (v.fuelType) fuelMap[v.fuelType] = (fuelMap[v.fuelType] || 0) + 1;
    if (v.yardName) yardMap[v.yardName] = (yardMap[v.yardName] || 0) + 1;
  });

  return {
    totalVehicles: total,
    activeVehicles: active,
    assignedToRoutes: assigned,
    spareVehicles: spare,
    wheelchairAccessible: wheelchair,
    typeDistribution: typeMap,
    fuelDistribution: fuelMap,
    yardDistribution: yardMap
  };
};

export const VehicleService = {
  // Pure real-time onSnapshot listener (Zero API server traffic)
  subscribeToVehicles: (
    onUpdate: (vehicles: Vehicle[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      console.warn('[VehicleService] Firestore SDK not initialized, falling back to REST');
      VehicleService.list().then(onUpdate).catch(onError);
      return () => {};
    }

    try {
      const q = query(collection(db, 'vehicles'), orderBy('unitNumber', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: Vehicle[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as Vehicle;
            list.push({
              ...data,
              id: doc.id
            });
          });
          onUpdate(list);
        },
        (error) => {
          console.error('[VehicleService] onSnapshot listener error:', error);
          if (onError) onError(error);
          VehicleService.list().then(onUpdate).catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[VehicleService] Exception creating onSnapshot listener:', e);
      VehicleService.list().then(onUpdate).catch(onError);
      return () => {};
    }
  },

  list: async (params?: { search?: string; unitType?: string; fuelType?: string; yardName?: string }): Promise<Vehicle[]> => {
    let queryStr = '';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.unitType) searchParams.append('unitType', params.unitType);
      if (params.fuelType) searchParams.append('fuelType', params.fuelType);
      if (params.yardName) searchParams.append('yardName', params.yardName);
      const str = searchParams.toString();
      if (str) queryStr = `?${str}`;
    }
    return apiRequest<Vehicle[]>(`/api/vehicles${queryStr}`);
  },

  getById: async (id: string): Promise<Vehicle> => {
    return apiRequest<Vehicle>(`/api/vehicles/${id}`);
  },

  getStats: async (): Promise<VehicleStats> => {
    return apiRequest<VehicleStats>('/api/vehicles/stats');
  },

  create: async (vehicle: Partial<Vehicle>): Promise<Vehicle> => {
    return apiRequest<Vehicle>('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicle)
    });
  },

  update: async (id: string, updates: Partial<Vehicle>): Promise<Vehicle> => {
    return apiRequest<Vehicle>(`/api/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/vehicles/${id}`, {
      method: 'DELETE'
    });
  }
};
