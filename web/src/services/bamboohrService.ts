import { apiRequest } from './api';

export interface BambooHRSettings {
  enabled: boolean;
  companyDomain: string;
  apiKeyConfigured: boolean;
  webhookKeyConfigured: boolean;
  dailySyncTime: string;
  lastDailySyncAt?: string;
  lastDailySyncCount: number;
  updatedAt?: string;
}

export interface BambooHRPreviewRow {
  id: string;
  displayName: string;
  jobTitle: string;
  status: string;
}

export interface BambooHRTestReport {
  dryRun: boolean;
  persisted: boolean;
  companyDomain: string;
  fieldCount: number;
  userCount: number;
  directoryCount: number;
  matchedCount: number;
  preview: BambooHRPreviewRow[];
  message: string;
}

export interface BambooHRManualSync {
  persisted: boolean;
  directoryCount: number;
  syncedAt: string;
  message: string;
}

export interface BambooHRSavePayload {
  enabled: boolean;
  companyDomain: string;
  apiKey?: string;
  clearApiKey?: boolean;
  webhookKey?: string;
  clearWebhookKey?: boolean;
  dailySyncTime?: string;
}

export interface BambooWebhookEvent {
  receivedAt: string;
  employeeId: string;
  action: string;
  changedFields?: string[];
  displayName?: string;
  jobTitle?: string;
  status?: string;
  employeeNumber?: string;
  note?: string;
  persisted: boolean;
}

export const BambooHRService = {
  getSettings: () => apiRequest<BambooHRSettings>('/api/bamboohr/settings'),

  saveSettings: (payload: BambooHRSavePayload) =>
    apiRequest<BambooHRSettings>('/api/bamboohr/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  testSync: () =>
    apiRequest<BambooHRTestReport>('/api/bamboohr/test', {
      method: 'POST',
      body: '{}',
    }),

  syncNow: () =>
    apiRequest<BambooHRManualSync>('/api/bamboohr/sync', {
      method: 'POST',
      body: '{}',
    }),

  listWebhookEvents: () =>
    apiRequest<{ events: BambooWebhookEvent[] }>('/api/bamboohr/webhook-events'),
};
