import { auth } from './firebase';
import { joinApiUrl } from './apiUrl';

// Empty in dev and in the GitHub Hosting build. Vite proxies /api to :8080.
// Firebase Hosting rewrites /api/** to Cloud Run. Do not set this to /api.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function getAuthToken(): Promise<string> {
  // 1. Real Firebase Auth token if logged in as the employee's own account.
  // Synthetic demo uids are not an identity; keep using the backend session token.
  if (auth && auth.currentUser && !auth.currentUser.uid.startsWith('mock-')) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) return token;
    } catch (e) {
      console.warn("Failed to get Firebase token:", e);
    }
  }

  // 2. Real signed HMAC token from backend login
  const authToken = localStorage.getItem('dispatch_auth_token');
  if (authToken) {
    return authToken;
  }

  // Legacy cleanup: remove any obsolete mock token
  try {
    localStorage.removeItem('dispatch_mock_token');
  } catch {
    // ignore
  }

  return '';
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isClientHttpError(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}

function reportApiFailure(payload: {
  method?: string;
  endpoint: string;
  status?: number;
  message: string;
  action?: string;
}): void {
  void import('./clientErrorReporter')
    .then(({ reportClientOperationError }) => {
      reportClientOperationError({
        method: payload.method,
        endpoint: payload.endpoint,
        status: payload.status,
        message: payload.message,
        action: payload.action || 'api_request',
      });
    })
    .catch(() => {
      // ignore reporter load failures
    });
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const method = (options.method || 'GET').toUpperCase();

  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = joinApiUrl(API_BASE_URL, endpoint);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network request failed';
    reportApiFailure({
      method,
      endpoint,
      status: 0,
      message,
      action: 'network',
    });
    throw err;
  }

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error || errorJson.message || errorMsg;
    } catch {
      // ignore
    }
    reportApiFailure({
      method,
      endpoint,
      status: response.status,
      message: errorMsg,
    });
    throw new ApiError(errorMsg, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const raw = await response.text();
  if (!raw.trim()) {
    return undefined as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    const message = `HTTP ${response.status}: response was not JSON`;
    reportApiFailure({
      method,
      endpoint,
      status: response.status,
      message,
      action: 'parse',
    });
    throw new Error(message);
  }
}
