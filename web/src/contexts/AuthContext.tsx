import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithCustomToken, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { AuthUser, PermissionLevel } from '../types/employee';
import { LoginLogService } from '../services/loginLogService';
import { apiRequest } from '../services/api';

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  isMockMode: boolean;
  loginAsMockAdmin: (customUser?: { username?: string; role?: string; displayName?: string; overrides?: Record<string, PermissionLevel> }) => Promise<void>;
  loginWithFirebase: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  setupFirstAdmin: (email?: string, password?: string, adminSecret?: string) => Promise<void>;
  updateCurrentUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('dispatch_auth_user');
    const token = localStorage.getItem('dispatch_auth_token');
    if (!raw || !token) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function isSyntheticUid(uid?: string | null): boolean {
  return !!uid && uid.startsWith('mock-');
}

async function establishFirebaseSession(customToken?: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.currentUser && !isSyntheticUid(auth.currentUser.uid) && !customToken) return true;
  let token = customToken || '';
  if (!token) {
    if (!localStorage.getItem('dispatch_auth_token')) return false;
    try {
      const res = await apiRequest<{ customToken?: string }>('/api/auth/firebase-token', { method: 'POST' });
      token = res?.customToken || '';
    } catch (err) {
      console.warn('[AuthContext] Firebase session exchange failed:', err);
      return false;
    }
  }
  if (!token) return false;
  try {
    await signInWithCustomToken(auth, token);
    return true;
  } catch (err) {
    console.warn('[AuthContext] Firebase custom token sign-in failed:', err);
    return false;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMockMode, setIsMockMode] = useState<boolean>(false);

  useEffect(() => {
    // Purge any legacy mock user and token keys to ensure genuine authentication
    try {
      localStorage.removeItem('dispatch_mock_user');
      localStorage.removeItem('dispatch_mock_token');
    } catch {
      // ignore
    }

    const storedAuthUser = readStoredAuthUser();
    if (storedAuthUser) {
      setCurrentUser(storedAuthUser);
      setIsMockMode(false);
    }

    if (!auth) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let exchangeStarted = false;
    let exchangeFinished = false;

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (cancelled) return;
      if (user && !isSyntheticUid(user.uid)) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          const storedUser = readStoredAuthUser();
          const role = (idTokenResult.claims.role as string) || storedUser?.role || 'admin';
          const employeeId = (idTokenResult.claims.employeeId as string) || storedUser?.employeeId || '';
          const overrides = (idTokenResult.claims.ovr as Record<string, PermissionLevel>) || storedUser?.overrides || {};

          const nextUser: AuthUser = {
            ...(storedUser || {}),
            uid: user.uid,
            email: user.email || storedUser?.email || '',
            role,
            employeeId,
            displayName: user.displayName || storedUser?.displayName || storedUser?.fullName || user.email || 'Dispatcher',
            overrides,
          };
          setCurrentUser(nextUser);
          localStorage.setItem('dispatch_auth_user', JSON.stringify(nextUser));
          setIsMockMode(false);
        } catch (e) {
          console.warn('Failed to get idTokenResult:', e);
        }
        if (!cancelled) setLoading(false);
        return;
      }

      if (exchangeStarted && !exchangeFinished) return;

      const storedUser = readStoredAuthUser();
      const storedToken = localStorage.getItem('dispatch_auth_token');
      if (storedUser && storedToken && !exchangeFinished) {
        exchangeStarted = true;
        const signedIn = await establishFirebaseSession();
        exchangeFinished = true;
        if (cancelled) return;
        if (signedIn) return;
      }

      if (!storedUser || !storedToken) {
        setCurrentUser(null);
        setIsMockMode(false);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const loginAsMockAdmin = async (customUser?: { username?: string; role?: string; displayName?: string; overrides?: Record<string, PermissionLevel> }) => {
    const uname = customUser?.username || 'admin';
    await loginWithFirebase(uname, 'demo');
  };

  const loginWithFirebase = async (identifier: string, pass: string) => {
    let loginEmail = identifier.trim().toLowerCase();
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@dispatch.pcy.ca`;
    }

    localStorage.removeItem('dispatch_mock_user');
    localStorage.removeItem('dispatch_mock_token');

    // 1. Primary: Try Go Backend API /api/auth/login to get lean user profile with role & overrides
    let backendUser: AuthUser | null = null;
    let firebaseCustomToken = '';
    try {
      const res = await apiRequest<{ success: boolean; token: string; user: AuthUser; firebaseCustomToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: identifier, password: pass }),
      });
      if (res && res.success && res.user) {
        backendUser = res.user;
        firebaseCustomToken = res.firebaseCustomToken || '';
        if (res.token) {
          localStorage.setItem('dispatch_auth_token', res.token);
        }
        localStorage.setItem('dispatch_auth_user', JSON.stringify(backendUser));
      }
    } catch (apiErr) {
      console.warn('[AuthContext] Backend login endpoint notice:', apiErr);
    }

    if (backendUser) {
      if (auth) {
        const signedIn = firebaseCustomToken ? await establishFirebaseSession(firebaseCustomToken) : false;
        if (!signedIn) {
          signInWithEmailAndPassword(auth, loginEmail, pass).catch((e) => {
            console.warn('[AuthContext] Background Firebase signIn note:', e);
          });
        }
      }

      setCurrentUser(backendUser);
      setIsMockMode(false);

      // Record successful login audit log
      LoginLogService.recordLog({
        status: 'success',
        username: loginEmail,
        employeeName: backendUser.displayName || backendUser.fullName,
        employeeId: backendUser.employeeId,
        role: backendUser.role,
        app: 'Dispatch Web Hub',
        appVersion: 'v1.0.0',
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
      }).catch((err) => console.warn('Failed to record login log:', err));

      return;
    }

    // 2. Fallback: Direct Firebase Authentication if backend was unavailable
    if (!auth) {
      const errMessage = 'Authentication service is not available';
      LoginLogService.recordLog({
        status: 'failure',
        username: loginEmail,
        app: 'Dispatch Web Hub',
        appVersion: 'v1.0.0',
        failureReason: errMessage,
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
      }).catch(() => {});
      throw new Error(errMessage);
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail, pass);
      const user = cred.user;
      if (user) {
        let role = 'dispatcher';
        let employeeId = '';
        let overrides: Record<string, PermissionLevel> = {};
        try {
          const idTokenResult = await user.getIdTokenResult(true);
          if (idTokenResult.claims.role) role = idTokenResult.claims.role as string;
          if (idTokenResult.claims.employeeId) employeeId = idTokenResult.claims.employeeId as string;
          if (idTokenResult.claims.ovr) overrides = idTokenResult.claims.ovr as Record<string, PermissionLevel>;
        } catch {
          // fallback
        }

        const displayName = user.displayName || user.email || 'Dispatcher';
        const authenticatedUser: AuthUser = {
          uid: user.uid,
          email: user.email || loginEmail,
          role,
          employeeId,
          displayName,
          overrides,
        };

        setCurrentUser(authenticatedUser);
        localStorage.setItem('dispatch_auth_user', JSON.stringify(authenticatedUser));
        setIsMockMode(false);

        // Record successful login audit log
        LoginLogService.recordLog({
          status: 'success',
          username: loginEmail,
          employeeName: displayName,
          employeeId,
          role,
          app: 'Dispatch Web Hub',
          appVersion: 'v1.0.0',
          deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
        }).catch((err) => console.warn('Failed to record login log:', err));
      }
    } catch (err: any) {
      // Record failed login attempt
      const failureReason = err.code || err.message || 'Authentication failed';
      LoginLogService.recordLog({
        status: 'failure',
        username: loginEmail,
        app: 'Dispatch Web Hub',
        appVersion: 'v1.0.0',
        failureReason,
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
      }).catch((logErr) => console.warn('Failed to record failure login log:', logErr));

      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem('dispatch_mock_user');
    localStorage.removeItem('dispatch_mock_token');
    localStorage.removeItem('dispatch_auth_token');
    localStorage.removeItem('dispatch_auth_user');
    setCurrentUser(null);
    setIsMockMode(false);
    if (auth) {
      await fbSignOut(auth);
    }
  };

  const updateCurrentUser = (patch: Partial<AuthUser>) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('dispatch_auth_user', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const setupFirstAdmin = async (email = 'admin@dispatch.local', password = 'Admin@Dispatch2026!', adminSecret?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (adminSecret) {
        headers['X-Admin-Secret'] = adminSecret;
      }
      await apiRequest('/api/auth/setup-admin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password }),
      });
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isMockMode,
        loginAsMockAdmin,
        loginWithFirebase,
        logout,
        setupFirstAdmin,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
