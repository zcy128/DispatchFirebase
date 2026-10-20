import { auth } from './firebase';
import { isDemoMode } from '../config/appMode';

// When running with Vite dev proxy, empty string calls same origin /api which proxies to :8080
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function getAuthToken(): Promise<string> {
  // 1. Real Firebase Auth token if logged in
  if (auth && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) return token;
    } catch (e) {
      console.warn("Failed to get Firebase token:", e);
    }
  }

  // 2. Stored mock admin token
  const mockToken = localStorage.getItem('dispatch_mock_token');
  if (mockToken) {
    return mockToken;
  }

  // 3. Demo deployments fall back to the mock admin token. Production builds do not.
  if (isDemoMode) {
    return 'mock-admin-token-secret-dev';
  }
  return '';
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('X-User-Role')) {
    try {
      const mockRaw = localStorage.getItem('dispatch_mock_user');
      if (mockRaw) {
        const u = JSON.parse(mockRaw);
        if (u?.role) {
          headers.set('X-User-Role', u.role);
        }
      }
    } catch {
      // ignore
    }
  }

  let path = endpoint;
  if (!path.startsWith('http')) {
    if (!path.startsWith('/api') && !path.startsWith('api/')) {
      path = path.startsWith('/') ? `/api${path}` : `/api/${path}`;
    }
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error || errorJson.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
