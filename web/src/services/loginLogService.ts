import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { LoginLogEntry } from '../types/loginLog';

const LOCAL_STORAGE_PREFIX = 'dispatch_login_logs_';
const FIRESTORE_COLLECTION = 'login_logs';

const MOCK_NAMES = [
  { name: 'Alex Morgan', id: 'EMP-ADMIN-001', role: 'admin', username: 'admin@dispatch.pcy.ca' },
  { name: 'Sarah Connor', id: 'EMP-1002', role: 'dispatcher', username: 'sarah.c@dispatch.pcy.ca' },
  { name: 'David Miller', id: 'EMP-2001', role: 'driver', username: 'driver1d@dispatch.pcy.ca' },
  { name: 'Emily Zhang', id: 'EMP-2002', role: 'driver', username: 'emily.z@dispatch.pcy.ca' },
  { name: 'Michael Chang', id: 'EMP-2003', role: 'driver', username: 'michael.c@dispatch.pcy.ca' },
  { name: 'Robert Johnson', id: 'EMP-2004', role: 'driver', username: 'robert.j@dispatch.pcy.ca' },
  { name: 'Jessica Taylor', id: 'EMP-2005', role: 'driver', username: 'jessica.t@dispatch.pcy.ca' },
  { name: 'James Wilson', id: 'EMP-2006', role: 'driver', username: 'james.w@dispatch.pcy.ca' },
  { name: 'Carlos Rodriguez', id: 'EMP-2007', role: 'driver', username: 'carlos.r@dispatch.pcy.ca' },
  { name: 'Priya Sharma', id: 'EMP-2008', role: 'driver', username: 'priya.s@dispatch.pcy.ca' },
  { name: 'Lucas Tremblay', id: 'EMP-2009', role: 'driver', username: 'lucas.t@dispatch.pcy.ca' },
  { name: 'Sophia Chen', id: 'EMP-2010', role: 'driver', username: 'sophia.c@dispatch.pcy.ca' },
  { name: 'Daniel Kim', id: 'EMP-2011', role: 'driver', username: 'daniel.k@dispatch.pcy.ca' },
  { name: 'Olivia Martin', id: 'EMP-2012', role: 'driver', username: 'olivia.m@dispatch.pcy.ca' },
  { name: 'William Brown', id: 'EMP-2013', role: 'driver', username: 'william.b@dispatch.pcy.ca' },
  { name: 'Emma Davis', id: 'EMP-2014', role: 'driver', username: 'emma.d@dispatch.pcy.ca' },
  { name: 'Liam Wilson', id: 'EMP-2015', role: 'driver', username: 'liam.w@dispatch.pcy.ca' },
  { name: 'Ava Anderson', id: 'EMP-2016', role: 'driver', username: 'ava.a@dispatch.pcy.ca' },
  { name: 'Noah Thomas', id: 'EMP-2017', role: 'driver', username: 'noah.t@dispatch.pcy.ca' },
  { name: 'Isabella Jackson', id: 'EMP-2018', role: 'driver', username: 'isabella.j@dispatch.pcy.ca' },
  { name: 'Ethan White', id: 'EMP-2019', role: 'driver', username: 'ethan.w@dispatch.pcy.ca' },
  { name: 'Mia Harris', id: 'EMP-2020', role: 'driver', username: 'mia.h@dispatch.pcy.ca' },
  { name: 'Aiden Clark', id: 'EMP-2021', role: 'driver', username: 'aiden.c@dispatch.pcy.ca' },
  { name: 'Chloe Lewis', id: 'EMP-2022', role: 'driver', username: 'chloe.l@dispatch.pcy.ca' },
  { name: 'Mason Hall', id: 'EMP-2023', role: 'driver', username: 'mason.h@dispatch.pcy.ca' },
  { name: 'Harper Allen', id: 'EMP-2024', role: 'driver', username: 'harper.a@dispatch.pcy.ca' },
  { name: 'Elijah Young', id: 'EMP-2025', role: 'driver', username: 'elijah.y@dispatch.pcy.ca' },
  { name: 'Evelyn King', id: 'EMP-2026', role: 'driver', username: 'evelyn.k@dispatch.pcy.ca' },
  { name: 'Benjamin Wright', id: 'EMP-2027', role: 'driver', username: 'benjamin.w@dispatch.pcy.ca' },
  { name: 'Charlotte Scott', id: 'EMP-2028', role: 'driver', username: 'charlotte.s@dispatch.pcy.ca' },
  { name: 'Alexander Green', id: 'EMP-2029', role: 'driver', username: 'alexander.g@dispatch.pcy.ca' },
  { name: 'Amelia Baker', id: 'EMP-2030', role: 'driver', username: 'amelia.b@dispatch.pcy.ca' },
];

const MOBILE_DEVICES = [
  'Flutter / Android 14 (Samsung Galaxy Tab Active4 Pro)',
  'Flutter / Android 14 (Google Pixel 8 Pro)',
  'Flutter / Android 13 (Samsung Galaxy A54 5G)',
  'Flutter / iOS 17.5.1 (iPad 10th Gen)',
  'Flutter / iOS 17.4 (iPhone 15)',
  'Flutter / Android 14 (Motorola Defy Rugged)',
];

const WEB_DEVICES = [
  'Chrome 128 / Windows 11',
  'Edge 128 / Windows 11 Pro',
  'Safari 17.5 / macOS Sonoma 14.5',
  'Chrome 127 / macOS Sonoma 14.4',
  'Firefox 129 / Windows 10 Enterprise',
];

const FAILURE_REASONS = [
  'Invalid authentication credentials',
  'User record not found in system directory',
  'Account temporarily locked due to 3 consecutive failed attempts',
  'Session token expired - re-authentication required',
  'Biometric authentication cancelled by user',
  'App version deprecated - please update via Play Store',
  'Network handshake timeout during credential verification',
];

/**
 * Generate ~1,000 realistic logs for a specific day to simulate production volume.
 */
export const generateDailySeedLogs = (targetDate: string, count = 1000): LoginLogEntry[] => {
  const list: LoginLogEntry[] = [];

  // Seed with deterministic pseudorandom so the records are consistent for a given date
  let seed = 0;
  for (let i = 0; i < targetDate.length; i++) {
    seed = (seed * 31 + targetDate.charCodeAt(i)) & 0xffffffff;
  }
  const pseudoRandom = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };

  // Generate logs spread throughout the day
  for (let i = 0; i < count; i++) {
    const isFailure = pseudoRandom() < 0.045; // ~4.5% failure rate
    const isDriver = pseudoRandom() < 0.78; // ~78% driver mobile logins

    const userProfile = isDriver
      ? MOCK_NAMES[2 + Math.floor(pseudoRandom() * (MOCK_NAMES.length - 2))]
      : MOCK_NAMES[Math.floor(pseudoRandom() * 2)];

    // Time distribution: Morning peak 05:30-08:45, noon peak 11:30-13:30, afternoon 14:30-17:30, night
    let hour = 6;
    const timeDist = pseudoRandom();
    if (timeDist < 0.45) {
      // 45% morning shift (05:30 - 08:59)
      hour = 5 + Math.floor(pseudoRandom() * 4);
    } else if (timeDist < 0.65) {
      // 20% midday check-in (11:00 - 13:59)
      hour = 11 + Math.floor(pseudoRandom() * 3);
    } else if (timeDist < 0.90) {
      // 25% afternoon route (14:00 - 17:59)
      hour = 14 + Math.floor(pseudoRandom() * 4);
    } else {
      // 10% evening/night (18:00 - 23:59)
      hour = 18 + Math.floor(pseudoRandom() * 6);
    }

    const minute = Math.floor(pseudoRandom() * 60);
    const second = Math.floor(pseudoRandom() * 60);
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    const timestamp = `${targetDate}T${timeStr}.000Z`;

    const app = isDriver ? 'Driver Mobile App' : 'Dispatch Web Hub';
    const appVersion = isDriver ? 'v1.2.4 (Build 42)' : 'v1.0.0';
    const deviceInfo = isDriver
      ? MOBILE_DEVICES[Math.floor(pseudoRandom() * MOBILE_DEVICES.length)]
      : WEB_DEVICES[Math.floor(pseudoRandom() * WEB_DEVICES.length)];

    let username = userProfile.username;
    let employeeName: string | undefined = userProfile.name;
    let employeeId: string | undefined = userProfile.id;
    let role: string | undefined = userProfile.role;
    let failureReason: string | undefined = undefined;

    if (isFailure) {
      failureReason = FAILURE_REASONS[Math.floor(pseudoRandom() * FAILURE_REASONS.length)];
      if (pseudoRandom() < 0.4) {
        // Unknown user attempt
        username = `driver${100 + Math.floor(pseudoRandom() * 900)}@dispatch.pcy.ca`;
        employeeName = undefined;
        employeeId = undefined;
        role = undefined;
      }
    }

    list.push({
      id: `seed-${targetDate}-${i + 1}-${Math.floor(pseudoRandom() * 10000)}`,
      timestamp,
      date: targetDate,
      status: isFailure ? 'failure' : 'success',
      username,
      employeeName,
      employeeId,
      role,
      app,
      appVersion,
      failureReason,
      deviceInfo,
      ipAddress: `192.168.${Math.floor(pseudoRandom() * 20) + 1}.${Math.floor(pseudoRandom() * 250) + 2}`,
    });
  }

  // Sort strictly descending by timestamp
  return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

export class LoginLogService {
  private static memoryCache = new Map<string, LoginLogEntry[]>();

  /**
   * Read cached logs for a specific date from memory or localStorage.
   * If none exists, generates ~1,000 realistic logs for that date.
   */
  public static getLocalLogsForDate(date: string): LoginLogEntry[] {
    if (this.memoryCache.has(date)) {
      return this.memoryCache.get(date)!;
    }

    const key = `${LOCAL_STORAGE_PREFIX}${date}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoryCache.set(date, parsed);
          return parsed;
        }
      }
    } catch (err) {
      console.warn('LoginLogService: error reading local cache:', err);
    }

    // Generate ~1000 realistic logs for this date
    const generated = generateDailySeedLogs(date, 1000);
    this.memoryCache.set(date, generated);
    this.saveLocalLogsForDate(date, generated);
    return generated;
  }

  /**
   * Save logs for a specific date to memory & localStorage.
   */
  public static saveLocalLogsForDate(date: string, logs: LoginLogEntry[]): void {
    this.memoryCache.set(date, logs);
    try {
      const key = `${LOCAL_STORAGE_PREFIX}${date}`;
      localStorage.setItem(key, JSON.stringify(logs.slice(0, 1500)));
    } catch (err) {
      console.warn('Failed to save login logs to localStorage (quota safe):', err);
    }
  }

  /**
   * Regenerate mock daily logs for local testing/benchmarking.
   */
  public static regenerateMockLogs(date: string, count = 1000): LoginLogEntry[] {
    const generated = generateDailySeedLogs(date, count);
    this.memoryCache.set(date, generated);
    this.saveLocalLogsForDate(date, generated);
    return generated;
  }

  /**
   * Record a login attempt (success or failure)
   */
  public static async recordLog(
    entry: Omit<LoginLogEntry, 'id' | 'timestamp' | 'date'> & { timestamp?: string; date?: string }
  ): Promise<LoginLogEntry> {
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

    // Save to local cache first
    const currentLogs = this.getLocalLogsForDate(date);
    const updatedLogs = [fullEntry, ...currentLogs.filter((l) => l.id !== fullEntry.id)];
    this.saveLocalLogsForDate(date, updatedLogs);

    // Persist to Firestore if online
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
   * Subscribe to login logs for a specific date in real-time.
   * Handles daily volume (~1,000 records) smoothly with automatic fallback.
   */
  public static subscribeToLogs(
    date: string,
    onUpdate: (logs: LoginLogEntry[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const targetDate = date || new Date().toISOString().slice(0, 10);

    // Deliver cached logs immediately for zero-wait rendering
    const initialLogs = this.getLocalLogsForDate(targetDate);
    onUpdate(initialLogs);

    if (!db) {
      return () => {};
    }

    try {
      // Query Firestore by date (exact equality filter uses default single-field index)
      const q = query(
        collection(db, FIRESTORE_COLLECTION),
        where('date', '==', targetDate),
        limit(2000)
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
                date: d.date || (d.timestamp ? d.timestamp.slice(0, 10) : targetDate),
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

            // Merge with local newly created logs for that date if any
            const local = this.getLocalLogsForDate(targetDate);
            const map = new Map<string, LoginLogEntry>();
            [...firestoreLogs, ...local].forEach((item) => {
              if (!map.has(item.id)) {
                map.set(item.id, item);
              }
            });

            const merged = Array.from(map.values()).sort(
              (a, b) => b.timestamp.localeCompare(a.timestamp)
            );

            this.saveLocalLogsForDate(targetDate, merged);
            onUpdate(merged);
          } else {
            // Snapshot empty: use cached/seed logs
            onUpdate(initialLogs);
          }
        },
        (err) => {
          console.warn(`LoginLogService: Firestore snapshot note for ${targetDate}:`, err);
          if (onError) onError(err);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('LoginLogService listener error, using local storage:', err);
      return () => {};
    }
  }

  /**
   * Fetch logs for a specific date (one-off fetch)
   */
  public static async getLogs(date?: string): Promise<LoginLogEntry[]> {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const local = this.getLocalLogsForDate(targetDate);
    if (!db) return local;

    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTION),
        where('date', '==', targetDate),
        limit(2000)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const firestoreLogs: LoginLogEntry[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            timestamp: d.timestamp || new Date().toISOString(),
            date: d.date || (d.timestamp ? d.timestamp.slice(0, 10) : targetDate),
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

        firestoreLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        this.saveLocalLogsForDate(targetDate, firestoreLogs);
        return firestoreLogs;
      }
    } catch (err) {
      console.warn('LoginLogService: getDocs notice:', err);
    }

    return local;
  }
}
