import { apiRequest } from './api';

export interface ZonarSettings {
  enabled: boolean;
  routeSyncEnabled: boolean;
  customer: string;
  username: string;
  passwordConfigured: boolean;
  busyIntervalMinutes: number;
  idleIntervalMinutes: number;
  busyWindow: string;
  lastSyncAt?: string;
  lastSyncCount: number;
  lastSyncMode?: string;
  gpsSerialSyncTime: string;
  lastGpsSerialSyncAt?: string;
  lastGpsSerialCount: number;
  lastRoutePreviewAt?: string;
  lastRoutePreviewCount: number;
  updatedAt?: string;
}

export interface ZonarPreviewRow {
  id: string;
  fleet: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  power?: string;
}

export interface ZonarTestReport {
  dryRun: boolean;
  persisted: boolean;
  customer: string;
  mode: string;
  intervalMinutes: number;
  assetCount: number;
  locatedCount: number;
  preview: ZonarPreviewRow[];
  message: string;
}

export interface ZonarSerialReport {
  persisted: boolean;
  assetCount: number;
  updatedCount: number;
  clearedCount: number;
  unmatchedCount: number;
  unmatched: string[];
  message: string;
}

export interface ZonarRoutePreviewRow {
  unitNumber: string;
  assetId: number;
  fleet: string;
  routeNo: string;
  location: string;
}

export interface ZonarRouteWriteReport {
  persisted: boolean;
  sentToZonar: boolean;
  vehicleCount: number;
  withRoute: number;
  preview: ZonarRoutePreviewRow[];
  message: string;
}

export interface ZonarTracePoint {
  lat: number;
  lng: number;
  observedAt: string;
  speedKmh: number;
  heading: number;
}

export interface ZonarTrace {
  vehicleId: number;
  unitNumber: string;
  assetId: number;
  persisted: boolean;
  points: ZonarTracePoint[];
}

export interface ZonarIdleStop {
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

export interface ZonarIdleReport {
  vehicleId: number;
  unitNumber: string;
  persisted: boolean;
  stops: ZonarIdleStop[];
}

export interface ZonarSavePayload {
  enabled: boolean;
  routeSyncEnabled?: boolean;
  customer: string;
  username: string;
  password?: string;
  clearPassword?: boolean;
  busyIntervalMinutes?: number;
  idleIntervalMinutes?: number;
  gpsSerialSyncTime?: string;
}

export const ZonarService = {
  getSettings: () => apiRequest<ZonarSettings>('/api/zonar/settings'),

  saveSettings: (payload: ZonarSavePayload) =>
    apiRequest<ZonarSettings>('/api/zonar/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  testSync: () =>
    apiRequest<ZonarTestReport>('/api/zonar/test', {
      method: 'POST',
      body: '{}',
    }),

  syncSerials: () =>
    apiRequest<ZonarSerialReport>('/api/zonar/sync-serials', {
      method: 'POST',
      body: '{}',
    }),

  previewRoutes: () =>
    apiRequest<ZonarRouteWriteReport>('/api/zonar/route-preview', {
      method: 'POST',
      body: '{}',
    }),

  syncEnabled: () => apiRequest<{ enabled: boolean }>('/api/zonar/enabled'),

  vehicleTrace: (vehicleId: number, start: string, end: string) =>
    apiRequest<ZonarTrace>(
      `/api/zonar/vehicles/${vehicleId}/trace?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    ),

  vehicleIdles: (vehicleId: number, start: string, end: string) =>
    apiRequest<ZonarIdleReport>(
      `/api/zonar/vehicles/${vehicleId}/idles?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    ),
};
