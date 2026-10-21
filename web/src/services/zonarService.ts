import { apiRequest } from './api';

export interface ZonarSettings {
  enabled: boolean;
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

export interface ZonarSavePayload {
  enabled: boolean;
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
};
