import { db } from './firebase';

export interface RouteOptimizationSettings {
  defaultStopDwellMinutes: number; // default: 3
  averageSpeedKmH: number; // default: 30 km/h in urban/suburban Ottawa
  recalculateTimesDefault: boolean; // default: true
  includeDriverHomeDefault: boolean; // default: false
  updatedAt?: string;
}

const DEFAULT_SETTINGS: RouteOptimizationSettings = {
  defaultStopDwellMinutes: 3,
  averageSpeedKmH: 30,
  recalculateTimesDefault: true,
  includeDriverHomeDefault: false
};

const STORAGE_KEY = 'dispatch_route_optimization_settings';

export const RouteSettingsService = {
  getSettings: async (): Promise<RouteOptimizationSettings> => {
    // 1. Try Firestore if available
    if (db) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'system_settings', 'route_optimization');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as Partial<RouteOptimizationSettings>;
          const merged: RouteOptimizationSettings = {
            ...DEFAULT_SETTINGS,
            ...data
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        }
      } catch (err) {
        console.warn('[RouteSettingsService] Firestore fetch fallback to local:', err);
      }
    }

    // 2. Fallback to localStorage
    try {
      const localStr = localStorage.getItem(STORAGE_KEY);
      if (localStr) {
        return {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(localStr)
        };
      }
    } catch {
      // ignore
    }

    return DEFAULT_SETTINGS;
  },

  saveSettings: async (settings: Partial<RouteOptimizationSettings>): Promise<RouteOptimizationSettings> => {
    const updated: RouteOptimizationSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      defaultStopDwellMinutes: Math.max(1, Math.min(15, Number(settings.defaultStopDwellMinutes) || 3)),
      averageSpeedKmH: Math.max(15, Math.min(80, Number(settings.averageSpeedKmH) || 30)),
      updatedAt: new Date().toISOString()
    };

    // 1. Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    // 2. Save to Firestore
    if (db) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'system_settings', 'route_optimization');
        await setDoc(docRef, updated, { merge: true });
      } catch (err) {
        console.warn('[RouteSettingsService] Firestore save error:', err);
      }
    }

    return updated;
  }
};
