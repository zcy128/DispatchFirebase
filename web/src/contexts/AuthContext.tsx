import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { AuthUser } from '../types/employee';
import { LoginLogService } from '../services/loginLogService';
import { isDemoMode } from '../config/appMode';

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  isMockMode: boolean;
  loginAsMockAdmin: () => void;
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
    if (!isDemoMode) {
      localStorage.removeItem('dispatch_mock_user');
      localStorage.removeItem('dispatch_mock_token');
    }

    if (!auth) {
      // Auto fallback to mock admin if Firebase SDK is unconfigured
      const storedMock = localStorage.getItem('dispatch_mock_user');
      if (storedMock) {
        try {
          setCurrentUser(JSON.parse(storedMock));
          setIsMockMode(true);
        } catch {
          // ignore
        }
      }
      setLoading(false);
      return;
    }

    // Check if previously logged in as mock admin
    const storedMock = localStorage.getItem('dispatch_mock_user');
    if (storedMock) {
      try {
        setCurrentUser(JSON.parse(storedMock));
        setIsMockMode(true);
      } catch {
        // ignore
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          const role = (idTokenResult.claims.role as string) || 'admin';
          const employeeId = (idTokenResult.claims.employeeId as string) || 'EMP-ADMIN-001';

          setCurrentUser({
            uid: user.uid,
            email: user.email || '',
            role,
            employeeId,
            displayName: user.displayName || user.email || 'Dispatcher'
          });
          setIsMockMode(false);
        } catch (e) {
          console.warn("Failed to get idTokenResult:", e);
        }
      } else {
        const mockSaved = localStorage.getItem('dispatch_mock_user');
        if (mockSaved) {
          try {
            setCurrentUser(JSON.parse(mockSaved));
            setIsMockMode(true);
          } catch {
            setCurrentUser(null);
            setIsMockMode(false);
          }
        } else {
          setCurrentUser(null);
          setIsMockMode(false);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginAsMockAdmin = (customUser?: { username?: string; role?: string; displayName?: string }) => {
    if (!isDemoMode) {
      return;
    }
    const uname = customUser?.username || 'admin';
    const role = customUser?.role || 'admin';
    const mockUser: AuthUser = {
      uid: `mock-uid-${uname}`,
      email: `${uname}@dispatch.pcy.ca`,
      role: role as any,
      employeeId: `EMP-${uname.toUpperCase()}`,
      displayName: customUser?.displayName || (uname === 'admin' ? 'Alex Morgan (Operations Admin)' : uname)
    };
    localStorage.setItem('dispatch_mock_user', JSON.stringify(mockUser));
    localStorage.setItem('dispatch_mock_token', uname === 'admin' ? 'mock-admin-token-secret-dev' : `mock-token-${uname}`);
    setCurrentUser(mockUser);
    setIsMockMode(true);

    // Record login audit log
    LoginLogService.recordLog({
      status: 'success',
      username: mockUser.email,
      employeeName: mockUser.displayName,
      employeeId: mockUser.employeeId,
      role: mockUser.role,
      app: 'Dispatch Web Hub',
      appVersion: 'v1.0.0',
      deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
    }).catch((err) => console.warn('Failed to record mock admin login log:', err));
  };

  const loginWithFirebase = async (identifier: string, pass: string) => {
    let loginEmail = identifier.trim().toLowerCase();
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@dispatch.pcy.ca`;
    }

    if (!auth) {
      const errMessage = "Firebase Auth is not configured";
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

    localStorage.removeItem('dispatch_mock_user');
    localStorage.removeItem('dispatch_mock_token');

    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail, pass);
      const user = cred.user;
      if (user) {
        let role = 'staff';
        let employeeId = '';
        try {
          const idTokenResult = await user.getIdTokenResult(true);
          if (idTokenResult.claims.role) role = idTokenResult.claims.role as string;
          if (idTokenResult.claims.employeeId) employeeId = idTokenResult.claims.employeeId as string;
        } catch {
          // fallback
        }

        const displayName = user.displayName || user.email || 'Dispatcher';
        setCurrentUser({
          uid: user.uid,
          email: user.email || loginEmail,
          role,
          employeeId: employeeId || 'EMP-1002',
          displayName
        });
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
