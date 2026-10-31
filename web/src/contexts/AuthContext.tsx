import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
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
  setupFirstAdmin: (email?: string, password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

    // 1. Check stored auth user and token from genuine backend login
    const storedAuthUser = localStorage.getItem('dispatch_auth_user');
    const storedAuthToken = localStorage.getItem('dispatch_auth_token');
    if (storedAuthUser && storedAuthToken) {
      try {
        setCurrentUser(JSON.parse(storedAuthUser));
        setIsMockMode(false);
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem('dispatch_auth_user');
        localStorage.removeItem('dispatch_auth_token');
      }
    }

    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          const role = (idTokenResult.claims.role as string) || 'admin';
          const employeeId = (idTokenResult.claims.employeeId as string) || 'EMP-ADMIN-001';
          const overrides = (idTokenResult.claims.ovr as Record<string, PermissionLevel>) || {};

          setCurrentUser({
            uid: user.uid,
            email: user.email || '',
            role,
            employeeId,
            displayName: user.displayName || user.email || 'Dispatcher',
            overrides,
          });
          setIsMockMode(false);
        } catch (e) {
          console.warn('Failed to get idTokenResult:', e);
        }
      } else {
        const storedAuthUser = localStorage.getItem('dispatch_auth_user');
        const storedAuthToken = localStorage.getItem('dispatch_auth_token');
        if (!storedAuthUser || !storedAuthToken) {
          setCurrentUser(null);
          setIsMockMode(false);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
    try {
      const res = await apiRequest<{ success: boolean; token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: identifier, password: pass }),
      });
      if (res && res.success && res.user) {
        backendUser = res.user;
        if (res.token) {
          localStorage.setItem('dispatch_auth_token', res.token);
        }
        localStorage.setItem('dispatch_auth_user', JSON.stringify(backendUser));
      }
    } catch (apiErr) {
      console.warn('[AuthContext] Backend login endpoint notice:', apiErr);
    }

    if (backendUser) {
      setCurrentUser(backendUser);
      setIsMockMode(false);

      // Trigger parallel Firebase client sign-in in background if available
      if (auth) {
        signInWithEmailAndPassword(auth, loginEmail, pass).catch((e) => {
          console.warn('[AuthContext] Background Firebase signIn note:', e);
        });
      }

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
          employeeId: employeeId || 'EMP-1002',
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
          employeeId: employeeId || 'EMP-1002',
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

  const setupFirstAdmin = async (email = 'admin@dispatch.local', password = 'Admin@Dispatch2026!') => {
    try {
      await fetch('http://localhost:8080/api/auth/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
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
        setupFirstAdmin
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
