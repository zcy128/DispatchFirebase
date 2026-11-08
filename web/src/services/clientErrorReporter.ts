import { API_BASE_URL, apiRequest, getAuthToken } from './api';
import { joinApiUrl } from './apiUrl';

export interface ClientOperationErrorPayload {
  page?: string;
  action?: string;
  method?: string;
  endpoint?: string;
  status?: number;
  message: string;
  userAgent?: string;
}

export interface ClientOperationErrorRecord {
  id: string;
  timestamp: string;
  date: string;
  page: string;
  action?: string;
  method?: string;
  endpoint?: string;
  status?: number;
  message: string;
  userId?: string;
  userName?: string;
  userAgent?: string;
  fingerprint: string;
  emailSent: boolean;
  emailSkipped?: string;
}

export interface ErrorAlertSettings {
  recipients: string[];
  pages: Record<string, boolean>;
  throttleMinutes: number;
  updatedAt?: string;
  updatedBy?: string;
}

let currentPage = 'unknown';

const REPORT_PATH = '/api/client-operation-errors';

export function setClientErrorPage(page: string): void {
  currentPage = (page || 'unknown').trim() || 'unknown';
}

export function getClientErrorPage(): string {
  return currentPage;
}

function shouldSkipEndpoint(endpoint?: string): boolean {
  if (!endpoint) return false;
  return endpoint.includes(REPORT_PATH) || endpoint.includes('/client-operation-errors');
}

/**
 * Fire-and-forget client operation error report.
 * Never throws; never blocks the caller. Uses raw fetch to avoid apiRequest recursion.
 */
export function reportClientOperationError(payload: ClientOperationErrorPayload): void {
  if (payload.status === 401) return;
  if (shouldSkipEndpoint(payload.endpoint)) return;

  const message = (payload.message || '').trim();
  if (!message) return;

  const body: ClientOperationErrorPayload = {
    page: payload.page || currentPage || 'unknown',
    action: payload.action || '',
    method: (payload.method || '').toUpperCase(),
    endpoint: payload.endpoint || '',
    status: payload.status || 0,
    message: message.slice(0, 2000),
    userAgent: payload.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
  };

  void (async () => {
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(joinApiUrl(API_BASE_URL, REPORT_PATH), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn('[clientErrorReporter] report failed', res.status);
      }
    } catch (err) {
      console.warn('[clientErrorReporter] report error', err);
    }
  })();
}

export async function listClientOperationErrors(opts?: {
  limit?: number;
  page?: string;
}): Promise<ClientOperationErrorRecord[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.page) params.set('page', opts.page);
  const qs = params.toString();
  return apiRequest<ClientOperationErrorRecord[]>(
    `${REPORT_PATH}${qs ? `?${qs}` : ''}`
  );
}

export async function getErrorAlertSettings(): Promise<ErrorAlertSettings> {
  return apiRequest<ErrorAlertSettings>('/api/dispatch/error-alert-settings');
}

export async function saveErrorAlertSettings(
  settings: ErrorAlertSettings
): Promise<ErrorAlertSettings> {
  return apiRequest<ErrorAlertSettings>('/api/dispatch/error-alert-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
