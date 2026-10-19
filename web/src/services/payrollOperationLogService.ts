import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import {
  PayrollOperationLog,
  PayrollOperationLogFilter
} from '../types/payrollOperationLog';

const LOCAL_STORAGE_KEY = 'dispatch_payroll_operation_logs';

const SEED_PAYROLL_LOGS: PayrollOperationLog[] = [
  {
    id: 'pol-seed-001',
    category: 'custom_rate',
    action: 'update',
    targetId: 'PR-OCDSB-001',
    targetIdentifier: 'RT-001',
    targetName: 'Route 001 - Bell High School AM Rate Override',
    amount: 54.50,
    rateType: 'Fixed Route Shift Rate',
    summary: 'Adjusted fixed driver payout rate from $50.00 to $54.50 for Route OCDSB-001 AM shift',
    diffs: [
      { field: 'payRate', fieldLabel: 'Shift Rate ($)', oldValue: '$50.00', newValue: '$54.50' },
      { field: 'effectiveDate', fieldLabel: 'Effective Date', oldValue: '2026-09-01', newValue: '2026-10-01' }
    ],
    actor: {
      userId: 'usr-admin-001',
      userName: 'Admin User',
      userEmail: 'admin@schoolbus.com',
      userRole: 'admin'
    },
    timestamp: new Date(Date.now() - 3600000 * 40).toISOString()
  },
  {
    id: 'pol-seed-002',
    category: 'dispatch_payroll',
    action: 'approve',
    targetId: 'DP-SHIFT-101-driver',
    targetIdentifier: 'SHIFT-101',
    targetName: 'James Anderson (AM Route OCDSB-001)',
    amount: 52.00,
    summary: 'Approved dispatch payroll for James Anderson with 0.5hr extra weather delay bonus',
    diffs: [
      { field: 'status', fieldLabel: 'Payroll Status', oldValue: 'pending_approval', newValue: 'approved' },
      { field: 'extraBonus', fieldLabel: 'Delay Adjustment', oldValue: '$0.00', newValue: '$12.50' }
    ],
    actor: {
      userId: 'usr-disp-101',
      userName: 'Sarah Jenkins',
      userEmail: 's.jenkins@dispatch.net',
      userRole: 'dispatcher'
    },
    timestamp: new Date(Date.now() - 3600000 * 20).toISOString()
  },
  {
    id: 'pol-seed-003',
    category: 'base_rate',
    action: 'create',
    targetId: 'BR-OCDSB-ATTENDANT',
    targetIdentifier: 'OCDSB-ATTENDANT-PM',
    targetName: 'OCDSB Board Bus Attendant PM Base Rate',
    amount: 38.00,
    rateType: 'Hourly Base Rate',
    summary: 'Configured new collective agreement base rate rule for OCDSB Board attendants',
    diffs: [
      { field: 'baseHourlyRate', fieldLabel: 'Hourly Rate ($)', oldValue: undefined, newValue: '$38.00' },
      { field: 'minimumHours', fieldLabel: 'Guaranteed Hours', oldValue: undefined, newValue: '2.0 hrs' }
    ],
    actor: {
      userId: 'usr-admin-001',
      userName: 'Admin User',
      userEmail: 'admin@schoolbus.com',
      userRole: 'admin'
    },
    timestamp: new Date(Date.now() - 3600000 * 10).toISOString()
  },
  {
    id: 'pol-seed-004',
    category: 'finance_payroll',
    action: 'adjust',
    targetId: 'PL-2026-10-05-104',
    targetIdentifier: 'EMP-1004',
    targetName: 'David Miller (Finance Final Review)',
    amount: 114.00,
    summary: 'Manual audit adjustment: reconciled EI reportable hours from 4.0 to 4.5 hours',
    diffs: [
      { field: 'eiHours', fieldLabel: 'EI Insurable Hours', oldValue: '4.0', newValue: '4.5' },
      { field: 'adjustmentNotes', fieldLabel: 'Auditor Reason', oldValue: '', newValue: 'Matched pre-trip inspection departure log' }
    ],
    actor: {
      userId: 'usr-admin-001',
      userName: 'Admin User',
      userEmail: 'admin@schoolbus.com',
      userRole: 'admin'
    },
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];

export const PayrollOperationLogService = {
  getStoredLogs(): PayrollOperationLog[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_PAYROLL_LOGS));
        return SEED_PAYROLL_LOGS;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_PAYROLL_LOGS));
        return SEED_PAYROLL_LOGS;
      }
      return parsed;
    } catch {
      return SEED_PAYROLL_LOGS;
    }
  },

  saveStoredLogs(logs: PayrollOperationLog[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[PayrollOperationLogService] Failed to save localStorage:', e);
    }
  },

  async logOperation(
    entry: Omit<PayrollOperationLog, 'id' | 'timestamp'> & { timestamp?: string }
  ): Promise<PayrollOperationLog> {
    const timestamp = entry.timestamp || new Date().toISOString();
    const id = `pol-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newLog: PayrollOperationLog = {
      ...entry,
      id,
      timestamp
    };

    // 1. LocalStorage
    try {
      const current = PayrollOperationLogService.getStoredLogs();
      PayrollOperationLogService.saveStoredLogs([newLog, ...current]);
    } catch (e) {
      console.warn('[PayrollOperationLogService] Local save failed:', e);
    }

    // 2. Firestore
    if (db) {
      try {
        const cleanPayload = JSON.parse(JSON.stringify(newLog));
        await addDoc(collection(db, 'payroll_operation_logs'), cleanPayload);
      } catch (err) {
        console.warn('[PayrollOperationLogService] Firestore addDoc failed, saved locally:', err);
      }
    }

    return newLog;
  },

  subscribeToLogs(
    filter: PayrollOperationLogFilter = {},
    onUpdate: (logs: PayrollOperationLog[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const applyFilter = (allLogs: PayrollOperationLog[]): PayrollOperationLog[] => {
      return allLogs
        .filter((item) => {
          if (filter.category && filter.category !== 'all' && item.category !== filter.category) {
            return false;
          }
          if (filter.action && filter.action !== 'all' && item.action !== filter.action) {
            return false;
          }
          if (filter.userId && item.actor?.userId !== filter.userId) {
            return false;
          }
          if (filter.dateFrom && item.timestamp.slice(0, 10) < filter.dateFrom) {
            return false;
          }
          if (filter.dateTo && item.timestamp.slice(0, 10) > filter.dateTo) {
            return false;
          }
          if (filter.search && filter.search.trim()) {
            const q = filter.search.trim().toLowerCase();
            const matchTarget =
              item.targetName.toLowerCase().includes(q) ||
              item.targetIdentifier.toLowerCase().includes(q) ||
              item.targetId.toLowerCase().includes(q);
            const matchSummary = item.summary.toLowerCase().includes(q);
            const matchActor =
              item.actor.userName.toLowerCase().includes(q) ||
              (item.actor.userRole && item.actor.userRole.toLowerCase().includes(q)) ||
              (item.actor.userEmail && item.actor.userEmail.toLowerCase().includes(q));
            const matchDiff = item.diffs?.some(
              (d) =>
                d.fieldLabel.toLowerCase().includes(q) ||
                String(d.oldValue).toLowerCase().includes(q) ||
                String(d.newValue).toLowerCase().includes(q)
            );
            if (!matchTarget && !matchSummary && !matchActor && !matchDiff) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    if (!db) {
      const local = PayrollOperationLogService.getStoredLogs();
      onUpdate(applyFilter(local));
      return () => {};
    }

    try {
      const q = query(collection(db, 'payroll_operation_logs'), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const remoteList: PayrollOperationLog[] = [];
          snap.forEach((doc) => {
            const d = doc.data() as PayrollOperationLog;
            remoteList.push({
              ...d,
              id: doc.id
            });
          });

          const localList = PayrollOperationLogService.getStoredLogs();
          const seen = new Set<string>();
          const combined: PayrollOperationLog[] = [];

          remoteList.forEach((item) => {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              combined.push(item);
            }
          });

          localList.forEach((item) => {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              combined.push(item);
            }
          });

          onUpdate(applyFilter(combined));
        },
        (err) => {
          console.warn('[PayrollOperationLogService] onSnapshot fallback:', err);
          if (onError) onError(err);
          const local = PayrollOperationLogService.getStoredLogs();
          onUpdate(applyFilter(local));
        }
      );
      return unsub;
    } catch {
      const local = PayrollOperationLogService.getStoredLogs();
      onUpdate(applyFilter(local));
      return () => {};
    }
  }
};
