import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { LoginLogEntry } from '../types/loginLog';

const LOCAL_STORAGE_KEY = 'dispatch_login_logs_cache';
const FIRESTORE_COLLECTION = 'login_logs';

/**
 * Generate seed mock logs so the UI has immediate rich audit data for verification.
 */
const generateSeedLogs = (): LoginLogEntry[] => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  return [
    {
      id: 'log-seed-1',
      timestamp: `${today}T08:15:22.000Z`,
      date: today,
      status: 'success',
      username: 'admin@dispatch.pcy.ca',
      employeeName: 'Alex Morgan',
      employeeId: 'EMP-ADMIN-001',
      role: 'admin',
      app: 'Dispatch Web Hub',
      appVersion: 'v1.0.0',
      deviceInfo: 'Chrome / Windows 11',
    },
    {
      id: 'log-seed-2',
      timestamp: `${today}T07:45:10.000Z`,
      date: today,
      status: 'success',
      username: 'driver1d@dispatch.pcy.ca',
      employeeName: 'David Miller',
      employeeId: 'EMP-2001',
      role: 'driver',
      app: 'Driver Mobile App',
      appVersion: 'v1.0.0 (Build 1)',
      deviceInfo: 'Flutter / Android 14',
    },
    {
      id: 'log-seed-3',
      timestamp: `${today}T07:30:05.000Z`,
      date: today,
      status: 'failure',
      username: 'driver99@dispatch.pcy.ca',
      app: 'Driver Mobile App',
      appVersion: 'v1.0.0 (Build 1)',
      failureReason: 'User record not found in system directory',
      deviceInfo: 'Flutter / iOS 17.5',
    },
    {
      id: 'log-seed-4',
      timestamp: `${today}T06:50:18.000Z`,
      date: today,
      status: 'failure',
      username: 'unknown.intruder@gmail.com',
      app: 'Dispatch Web Hub',
      appVersion: 'v1.0.0',
      failureReason: 'Invalid authentication credentials',
      deviceInfo: 'Firefox / macOS Sonoma',
    },
    {
      id: 'log-seed-5',
      timestamp: `${yesterday}T16:20:45.000Z`,
      date: yesterday,
      status: 'success',
      username: 'sarah.c@dispatch.pcy.ca',
      employeeName: 'Sarah Connor',
      employeeId: 'EMP-1002',
      role: 'dispatcher',
      app: 'Dispatch Web Hub',
      appVersion: 'v1.0.0',
      deviceInfo: 'Edge / Windows 11',
    },
    {
      id: 'log-seed-6',
      timestamp: `${yesterday}T08:02:11.000Z`,
      date: yesterday,
      status: 'success',
      username: 'emily.z@dispatch.pcy.ca',
      employeeName: 'Emily Zhang',
      employeeId: 'EMP-2002',
      role: 'driver',
      app: 'Driver Mobile App',
      appVersion: 'v1.0.0 (Build 1)',
      deviceInfo: 'Flutter / Android 14',
    },
    {
      id: 'log-seed-7',
      timestamp: `${twoDaysAgo}T09:12:00.000Z`,
      date: twoDaysAgo,
      status: 'success',
      username: 'admin@dispatch.pcy.ca',
      employeeName: 'Alex Morgan',
      employeeId: 'EMP-ADMIN-001',
      role: 'admin',
      app: 'Dispatch Web Hub',
      appVersion: 'v1.0.0',
      deviceInfo: 'Chrome / Windows 11',
    }
  ];
};

export class LoginLogService {
  /**
   * Read cached logs from local storage
   */
  private static getLocalLogs(): LoginLogEntry[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        const seed = generateSeedLogs();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      return JSON.parse(raw);
    } catch {
      return generateSeedLogs();
    }
  }

  /**
   * Save logs to local storage
   */
  private static saveLocalLogs(logs: LoginLogEntry[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs.slice(0, 1000)));
    } catch (err) {
      console.warn('Failed to save login logs to localStorage:', err);
    }
  }

  /**
   * Record a login attempt (success or failure)
   */
  public static async recordLog(entry: Omit<LoginLogEntry, 'id' | 'timestamp' | 'date'> & { timestamp?: string; date?: string }): Promise<LoginLogEntry> {
    const now = new Date();
    const timestamp = entry.timestamp || now.toISOString();
    const date = entry.date || timestamp.slice(0, 10);
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const fullEntry: LoginLogEntry = {
      id,
      timestamp,
      date,
      ...entry,
    };

    // Save to local cache first for responsiveness & offline reliability
    const currentLogs = this.getLocalLogs();
    const updatedLogs = [fullEntry, ...currentLogs.filter((l) => l.id !== fullEntry.id)];
    this.saveLocalLogs(updatedLogs);

    // Persist to Firestore if configured
    if (db) {
      try {
        const docRef = await addDoc(collection(db, FIRESTORE_COLLECTION), {
          ...fullEntry,
          serverTimestamp: now.getTime(),
        });
        fullEntry.id = docRef.id;
      } catch (err) {
        console.warn('LoginLogService: Firestore record log skipped/offline:', err);
      }
    }

    return fullEntry;
  }

  /**
   * Subscribe to login logs for real-time monitoring
   */
  public static subscribeToLogs(
    onUpdate: (logs: LoginLogEntry[]) => void,
    onError?: (error: any) => void
  ): () => void {
    // Deliver local cache immediately
    const initialLogs = this.getLocalLogs();
    onUpdate(initialLogs);

    if (!db) {
      return () => {};
    }

    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(200)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreLogs: LoginLogEntry[] = snapshot.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id,
                timestamp: d.timestamp || new Date().toISOString(),
                date: d.date || (d.timestamp ? d.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                status: d.status || 'success',
                username: d.username || 'unknown',
                employeeName: d.employeeName,
                employeeId: d.employeeId,
                role: d.role,
                app: d.app || 'Unknown App',
                appVersion: d.appVersion || 'v1.0.0',
                failureReason: d.failureReason,
                deviceInfo: d.deviceInfo,
                ipAddress: d.ipAddress,
              };
            });

            // Merge with local logs to prevent dropping newly added local logs
            const local = this.getLocalLogs();
            const map = new Map<string, LoginLogEntry>();
            [...firestoreLogs, ...local].forEach((item) => {
              if (!map.has(item.id)) {
                map.set(item.id, item);
              }
            });
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            this.saveLocalLogs(merged);
            onUpdate(merged);
          }
        },
        (err) => {
          console.warn('LoginLogService: Firestore snapshot listener note:', err);
          if (onError) onError(err);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('LoginLogService setup listener failed, using local storage:', err);
      return () => {};
    }
  }

  /**
   * Fetch all logs
   */
  public static async getLogs(): Promise<LoginLogEntry[]> {
    const local = this.getLocalLogs();
    if (!db) return local;

    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(200)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const firestoreLogs: LoginLogEntry[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            timestamp: d.timestamp || new Date().toISOString(),
            date: d.date || (d.timestamp ? d.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            status: d.status || 'success',
            username: d.username || 'unknown',
            employeeName: d.employeeName,
            employeeId: d.employeeId,
            role: d.role,
            app: d.app || 'Unknown App',
            appVersion: d.appVersion || 'v1.0.0',
            failureReason: d.failureReason,
            deviceInfo: d.deviceInfo,
            ipAddress: d.ipAddress,
          };
        });
        return firestoreLogs;
      }
    } catch {
      // Return local fallback
    }

    return local;
  }
}
