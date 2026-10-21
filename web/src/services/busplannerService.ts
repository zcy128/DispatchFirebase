import { apiRequest } from './api';

export interface BusPlannerSettings {
  enabled: boolean;
  baseUrl: string;
  username: string;
  passwordConfigured: boolean;
  operatorId: string;
  syncTimes: string[];
  lastSyncAt?: string;
  lastRouteCount: number;
  lastRunCount: number;
  lastSchoolCount: number;
  lastStopCount: number;
  lastStudentStopCount: number;
  lastStudentCount: number;
  updatedAt?: string;
}

export interface BusPlannerSyncReport {
  persisted: boolean;
  stagingOnly: boolean;
  liveUpdated: boolean;
  routeCount: number;
  runCount: number;
  schoolCount: number;
  stopCount: number;
  studentStopCount: number;
  studentCount: number;
  preview: string[];
  syncedAt: string;
  message: string;
}

export interface BusPlannerSavePayload {
  enabled: boolean;
  baseUrl: string;
  username: string;
  password?: string;
  operatorId: string;
  syncTimes: string[];
}

export interface StagingStudent {
  id: string;
  name: string;
  grade?: string;
  schoolName?: string;
}

export interface StagingStop {
  id: string;
  sequence: number;
  location: string;
  time: string;
  stopType: string;
  instruction?: string;
  latitude?: string;
  longitude?: string;
  students: StagingStudent[];
}

export interface StagingShift {
  id: string;
  shiftType: string;
  runDays: string;
  description: string;
  schools: string;
  instruction: string;
  effectiveDate?: string;
  applyDate?: string;
  applyTime?: string;
  retireDate?: string;
  firstStopTime: string;
  lastStopTime: string;
  stopCount: number;
  studentCount: number;
  stops: StagingStop[];
}

export interface StagingApplyWindow {
  effectiveDate: string;
  applyDate: string;
  applyTime: string;
}

export interface StagingCopyReport {
  routeId: string;
  routeNo: string;
  liveRouteId: string;
  created: boolean;
  shiftCount: number;
  stopCount: number;
  studentCount: number;
  crewPreserved: boolean;
  message: string;
}

export interface StagingRoute {
  id: string;
  routeNo: string;
  routeName: string;
  operatorId: string;
  active: boolean;
  simulated?: boolean;
  totalStops: number;
  totalStudents: number;
  applyWindows?: StagingApplyWindow[];
  shifts: StagingShift[];
}

export interface StagingRouteList {
  routes: StagingRoute[];
  totalRoutes: number;
  totalShifts: number;
  totalStops: number;
  totalStudents: number;
}

export const BusPlannerService = {
  getSettings: () => apiRequest<BusPlannerSettings>('/api/busplanner/settings'),

  saveSettings: (payload: BusPlannerSavePayload) =>
    apiRequest<BusPlannerSettings>('/api/busplanner/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  syncNow: () =>
    apiRequest<BusPlannerSyncReport>('/api/busplanner/sync', {
      method: 'POST',
    }),

  listStagingRoutes: () => apiRequest<StagingRouteList>('/api/busplanner/staging/routes'),

  copyStagingRoute: (routeId: string) =>
    apiRequest<StagingCopyReport>(`/api/busplanner/staging/routes/${encodeURIComponent(routeId)}/copy`, {
      method: 'POST',
    }),
};
