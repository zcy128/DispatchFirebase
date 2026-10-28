import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import {
  ExpenseReimbursement,
  ExpenseReimbursementLine,
  ReviewExpenseClaimPayload,
  ExpenseClaimStatus,
  ExpenseCategory,
  DEFAULT_EXPENSE_CATEGORIES,
} from '../types/expenseReimbursement';

function normalizeDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'object' && val.seconds !== undefined) {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function normalizeExpenseLine(raw: any, idx: number): ExpenseReimbursementLine {
  return {
    id: String(raw?.id || `line-${idx + 1}`),
    categoryCode: String(raw?.categoryCode || 'other'),
    categoryDisplayName: String(raw?.categoryDisplayName || 'Other Expense'),
    amount: Number(raw?.amount || 0),
    note: String(raw?.note || ''),
    sortOrder: Number(raw?.sortOrder || idx + 1),
  };
}

function normalizeExpenseRecord(raw: any, id: string): ExpenseReimbursement {
  const lines = Array.isArray(raw?.lines)
    ? raw.lines.map((l: any, idx: number) => normalizeExpenseLine(l, idx))
    : [];

  const totalAmount =
    raw?.totalAmount !== undefined && raw?.totalAmount !== null
      ? Number(raw.totalAmount)
      : lines.reduce((sum: number, l: ExpenseReimbursementLine) => sum + l.amount, 0);

  return {
    id,
    employeeId: String(raw?.employeeId || ''),
    employeeName: String(raw?.employeeName || ''),
    claimDate: String(raw?.claimDate || ''),
    routeNo: String(raw?.routeNo || ''),
    totalAmount,
    lines,
    status: (raw?.status as ExpenseClaimStatus) || 'pending',
    approvalNotes: raw?.approvalNotes || '',
    approvedByName: raw?.approvedByName || '',
    approvedAt: normalizeDate(raw?.approvedAt),
    createdAt: normalizeDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(raw?.updatedAt) || new Date().toISOString(),
  };
}

export const ExpenseReimbursementService = {
  listCategories: async (): Promise<ExpenseCategory[]> => {
    try {
      const res = await apiRequest<ExpenseCategory[]>('/api/public/dispatch/expense-categories');
      if (Array.isArray(res) && res.length > 0) return res;
    } catch {
      if (db) {
        try {
          const snap = await getDocs(collection(db, 'expense_categories'));
          if (!snap.empty) {
            const list: ExpenseCategory[] = [];
            snap.forEach((d) => {
              const data = d.data();
              list.push({
                id: d.id,
                code: data.code || '',
                displayName: data.displayName || '',
                sortOrder: data.sortOrder || 0,
                active: data.active !== false,
              });
            });
            list.sort((a, b) => a.sortOrder - b.sortOrder);
            return list;
          }
        } catch (_) {}
      }
    }

    return DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
      id: `cat-${c.code}`,
      code: c.code,
      displayName: c.label,
      sortOrder: i + 1,
      active: true,
    }));
  },

  isColdClaim: (claimDate?: string): boolean => {
    if (!claimDate) return false;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return claimDate.slice(0, 10) < cutoff.toISOString().slice(0, 10);
  },

  listClaims: async (params?: Record<string, string>): Promise<ExpenseReimbursement[]> => {
    const qStr = new URLSearchParams(params || {}).toString();
    try {
      const res = await apiRequest<ExpenseReimbursement[]>(
        `/api/dispatch/expense-reimbursements?${qStr}`
      );
      if (Array.isArray(res)) {
        return res
          .map((r) => normalizeExpenseRecord(r, r.id))
          .sort((a, b) => {
            const dateA = a.claimDate || a.createdAt || '';
            const dateB = b.claimDate || b.createdAt || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          });
      }
    } catch {
      try {
        const res = await apiRequest<ExpenseReimbursement[]>(
          `/api/public/dispatch/expense-reimbursements?${qStr}`
        );
        if (Array.isArray(res)) {
          return res
            .map((r) => normalizeExpenseRecord(r, r.id))
            .sort((a, b) => {
              const dateA = a.claimDate || a.createdAt || '';
              const dateB = b.claimDate || b.createdAt || '';
              if (dateA !== dateB) return dateB.localeCompare(dateA);
              return (b.createdAt || '').localeCompare(a.createdAt || '');
            });
        }
      } catch (err) {
        if (db) {
          const qRef = collection(db, 'expense_reimbursements');
          const snap = await getDocs(qRef);
          const cutoff = new Date();
          cutoff.setMonth(cutoff.getMonth() - 6);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          const list: ExpenseReimbursement[] = [];
          snap.forEach((d) => {
            const rec = normalizeExpenseRecord(d.data(), d.id);
            if (!params?.timeRange || params.timeRange === '6months') {
              const cDate = rec.claimDate || rec.createdAt.slice(0, 10);
              if (cDate < cutoffStr) return;
            }
            list.push(rec);
          });
          list.sort((a, b) => {
            const dateA = a.claimDate || a.createdAt || '';
            const dateB = b.claimDate || b.createdAt || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          });
          return list;
        }
        return [];
      }
    }
    return [];
  },

  getClaim: async (id: string): Promise<ExpenseReimbursement | null> => {
    try {
      const res = await apiRequest<ExpenseReimbursement>(
        `/api/dispatch/expense-reimbursements/${id}`
      );
      return normalizeExpenseRecord(res, res.id || id);
    } catch {
      try {
        const res = await apiRequest<ExpenseReimbursement>(
          `/api/public/dispatch/expense-reimbursements/${id}`
        );
        return normalizeExpenseRecord(res, res.id || id);
      } catch {
        if (db) {
          const snap = await getDoc(doc(db, 'expense_reimbursements', id));
          if (snap.exists()) {
            return normalizeExpenseRecord(snap.data(), snap.id);
          }
        }
        return null;
      }
    }
  },

  reviewClaim: async (
    id: string,
    payload: ReviewExpenseClaimPayload
  ): Promise<ExpenseReimbursement> => {
    try {
      const res = await apiRequest<ExpenseReimbursement>(
        `/api/dispatch/expense-reimbursements/${id}/review`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      return normalizeExpenseRecord(res, res.id || id);
    } catch {
      try {
        const res = await apiRequest<ExpenseReimbursement>(
          `/api/public/dispatch/expense-reimbursements/${id}/review`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
        return normalizeExpenseRecord(res, res.id || id);
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'expense_reimbursements', id);
          const snap = await getDoc(docRef);
          const now = new Date().toISOString();
          const baseData = snap.exists() ? snap.data() : {};
          const updated = {
            ...baseData,
            status: payload.status,
            approvalNotes: payload.approvalNotes,
            approvedByName: payload.approvedByName,
            approvedAt: now,
            updatedAt: now,
          };
          await setDoc(docRef, updated, { merge: true });
          return normalizeExpenseRecord(updated, id);
        }
        throw err;
      }
    }
  },

  cancelClaim: async (id: string, employeeId?: string): Promise<ExpenseReimbursement> => {
    try {
      const res = await apiRequest<ExpenseReimbursement>(
        `/api/dispatch/expense-reimbursements/${id}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ employeeId }),
        }
      );
      return normalizeExpenseRecord(res, res.id || id);
    } catch {
      const res = await apiRequest<ExpenseReimbursement>(
        `/api/public/dispatch/expense-reimbursements/${id}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ employeeId }),
        }
      );
      return normalizeExpenseRecord(res, res.id || id);
    }
  },

  subscribeClaims: (
    callback: (claims: ExpenseReimbursement[]) => void,
    pollingIntervalMs = 6000
  ): (() => void) => {
    let isSubscribed = true;
    let pollTimer: any = null;
    let unsubscribeSnapshot: (() => void) | null = null;
    let restClaims: ExpenseReimbursement[] = [];
    let firestoreClaims: ExpenseReimbursement[] = [];

    const emitMerged = () => {
      if (!isSubscribed) return;
      const map = new Map<string, ExpenseReimbursement>();
      for (const r of restClaims) {
        map.set(r.id, r);
      }
      for (const r of firestoreClaims) {
        const existing = map.get(r.id);
        if (
          !existing ||
          new Date(r.updatedAt || r.createdAt).getTime() >=
            new Date(existing.updatedAt || existing.createdAt).getTime()
        ) {
          map.set(r.id, r);
        }
      }
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const merged = Array.from(map.values())
        .filter((r) => {
          const cDate = r.claimDate || (r.createdAt ? r.createdAt.slice(0, 10) : '');
          return cDate >= cutoffStr;
        })
        .sort((a, b) => {
          const dateA = a.claimDate || a.createdAt || '';
          const dateB = b.claimDate || b.createdAt || '';
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
      callback(merged);
    };

    const fetchLatestRest = async () => {
      if (!isSubscribed) return;
      try {
        const claims = await ExpenseReimbursementService.listClaims();
        if (isSubscribed) {
          restClaims = claims;
          emitMerged();
        }
      } catch (err) {
        console.warn('[ExpenseReimbursementService] Polling fetch error:', err);
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      fetchLatestRest();
      pollTimer = setInterval(fetchLatestRest, pollingIntervalMs);
    };

    // 1. Initial fetch
    fetchLatestRest();

    // 2. Real-time Firestore onSnapshot listener
    if (db) {
      try {
        const qRef = collection(db, 'expense_reimbursements');
        unsubscribeSnapshot = onSnapshot(
          qRef,
          (snapshot) => {
            if (!isSubscribed) return;
            const list: ExpenseReimbursement[] = [];
            snapshot.forEach((d) => {
              list.push(normalizeExpenseRecord(d.data(), d.id));
            });
            firestoreClaims = list;
            emitMerged();
          },
          (error) => {
            console.warn(
              '[ExpenseReimbursementService] Firestore snapshot error, switching to auto-polling:',
              error
            );
            startPolling();
          }
        );
      } catch (err) {
        console.warn(
          '[ExpenseReimbursementService] Failed to establish onSnapshot, starting auto-polling:',
          err
        );
        startPolling();
      }
    } else {
      startPolling();
    }

    // 3. Auto-sync on window focus / tab visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isSubscribed) {
        fetchLatestRest();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // 4. Background heartbeat sync every 15s to guarantee consistency
    const heartbeatTimer = setInterval(() => {
      if (isSubscribed) {
        fetchLatestRest();
      }
    }, 15000);

    return () => {
      isSubscribed = false;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  },
};

