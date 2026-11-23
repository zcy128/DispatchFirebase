import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest, isClientHttpError } from './api';
import { listenerOwnEmployeeId } from '../utils/listenerScope';
import {
  ExpenseReimbursement,
  ExpenseReimbursementLine,
  ReviewExpenseClaimPayload,
  ExpenseClaimStatus,
  ExpenseCategory,
  ExpenseApproverGroup,
  UpsertExpenseCategoryPayload,
  ExpensePolicyAuditLog,
  BiweeklyPayrollConfig,
  ExpensePolicySettings,
  ExpenseClaimEvaluation,
  ExpenseAIPreCheckResult,
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
    attachmentUrls: Array.isArray(raw?.attachmentUrls) ? raw.attachmentUrls : undefined,
    status: (raw?.status as ExpenseClaimStatus) || 'pending',
    preApprovedAt: normalizeDate(raw?.preApprovedAt) || undefined,
    autoApproveDeadline: normalizeDate(raw?.autoApproveDeadline) || undefined,
    autoApproved: Boolean(raw?.autoApproved),
    approvalNotes: raw?.approvalNotes || '',
    approvedByName: raw?.approvedByName || '',
    approvedAt: normalizeDate(raw?.approvedAt),
    createdAt: normalizeDate(raw?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(raw?.updatedAt) || new Date().toISOString(),
  };
}

export const ExpenseReimbursementService = {
  listCategories: async (options?: {
    includeInactive?: boolean;
    approverGroup?: ExpenseApproverGroup;
  }): Promise<ExpenseCategory[]> => {
    const params = new URLSearchParams();
    if (options?.includeInactive) params.set('includeInactive', 'true');
    if (options?.approverGroup) params.set('approverGroup', options.approverGroup);
    const qs = params.toString() ? `?${params.toString()}` : '';

    try {
      const res = await apiRequest<ExpenseCategory[]>(`/api/dispatch/expense-categories${qs}`);
      if (Array.isArray(res) && res.length > 0) return res;
    } catch {
      if (db) {
        try {
          const snap = await getDocs(collection(db, 'expense_categories'));
          if (!snap.empty) {
            const list: ExpenseCategory[] = [];
            snap.forEach((d) => {
              const data = d.data();
              const active = data.active !== false;
              if (!options?.includeInactive && !active) return;
              if (options?.approverGroup && data.approverGroup !== options.approverGroup) return;
              list.push({
                id: d.id,
                code: data.code || '',
                displayName: data.displayName || '',
                limitLabel: data.limitLabel || '',
                approverGroup: data.approverGroup || 'hr',
                periodType: data.periodType || 'per_claim',
                maxTotalAmount:
                  data.maxTotalAmount !== undefined && data.maxTotalAmount !== null
                    ? Number(data.maxTotalAmount)
                    : null,
                maxCountPerPeriod:
                  data.maxCountPerPeriod !== undefined && data.maxCountPerPeriod !== null
                    ? Number(data.maxCountPerPeriod)
                    : null,
                requireAttachment: Boolean(data.requireAttachment),
                autoPreApprove: Boolean(data.autoPreApprove),
                aiReviewGuidance: data.aiReviewGuidance || '',
                sortOrder: data.sortOrder || 0,
                active,
                version: data.version || 1,
                updatedBy: data.updatedBy || '',
                updatedAt: normalizeDate(data.updatedAt),
              });
            });
            list.sort((a, b) => a.sortOrder - b.sortOrder);
            if (list.length > 0) return list;
          }
        } catch (_) {}
      }
    }

    return DEFAULT_EXPENSE_CATEGORIES.filter(
      (c) => !options?.approverGroup || c.approverGroup === options.approverGroup
    ).map((c, i) => ({
      id: `cat-${c.code}`,
      code: c.code,
      displayName: c.label,
      limitLabel: c.limitLabel,
      approverGroup: c.approverGroup,
      periodType: c.periodType,
      maxTotalAmount: c.maxTotalAmount,
      maxCountPerPeriod: null,
      requireAttachment: c.requireAttachment,
      sortOrder: i + 1,
      active: true,
      version: 1,
    }));
  },

  upsertCategory: async (
    code: string,
    payload: UpsertExpenseCategoryPayload
  ): Promise<ExpenseCategory> => {
    return apiRequest<ExpenseCategory>(
      `/api/dispatch/expense-categories/${encodeURIComponent(code)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  listPolicyAuditLogs: async (
    categoryCode?: string,
    limit = 50
  ): Promise<ExpensePolicyAuditLog[]> => {
    const params = new URLSearchParams();
    if (categoryCode) params.set('categoryCode', categoryCode);
    if (limit > 0) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiRequest<ExpensePolicyAuditLog[]>(
      `/api/dispatch/expense-policy-audit-logs${qs}`
    );
    return Array.isArray(res) ? res : [];
  },

  evaluateClaim: async (claimId: string): Promise<ExpenseClaimEvaluation> => {
    return apiRequest<ExpenseClaimEvaluation>(
      `/api/dispatch/expense-reimbursements/${encodeURIComponent(claimId)}/evaluate`
    );
  },

  aiPreCheckClaim: async (claimId: string): Promise<ExpenseAIPreCheckResult> => {
    return apiRequest<ExpenseAIPreCheckResult>(
      `/api/dispatch/expense-reimbursements/${encodeURIComponent(claimId)}/ai-precheck`,
      { method: 'POST' }
    );
  },

  getBiweeklyPayrollConfig: async (): Promise<BiweeklyPayrollConfig> => {
    try {
      const res = await apiRequest<BiweeklyPayrollConfig>('/api/payroll/biweekly-config');
      if (res && res.biweeklyAnchorDate) return res;
    } catch {
      // Fallback to default anchor if offline
    }
    return {
      biweeklyAnchorDate: '2026-01-04',
      periodLengthDays: 14,
      timezone: 'America/Toronto',
    };
  },

  saveBiweeklyPayrollConfig: async (
    payload: Partial<BiweeklyPayrollConfig>
  ): Promise<BiweeklyPayrollConfig> => {
    return apiRequest<BiweeklyPayrollConfig>('/api/payroll/biweekly-config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getExpensePolicySettings: async (): Promise<ExpensePolicySettings> => {
    try {
      const res = await apiRequest<ExpensePolicySettings>('/api/dispatch/expense-policy-settings');
      if (res && typeof res.autoApproveDays === 'number' && res.autoApproveDays > 0) {
        return res;
      }
    } catch {
      // Fallback to default 5 days if offline
    }
    return { autoApproveDays: 5 };
  },

  saveExpensePolicySettings: async (
    payload: Partial<ExpensePolicySettings>
  ): Promise<ExpensePolicySettings> => {
    return apiRequest<ExpensePolicySettings>('/api/dispatch/expense-policy-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
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
    return [];
  },

  getClaim: async (id: string): Promise<ExpenseReimbursement | null> => {
    try {
      const res = await apiRequest<ExpenseReimbursement>(
        `/api/dispatch/expense-reimbursements/${id}`
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
    } catch (err) {
      if (isClientHttpError(err)) throw err;
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
  },

  cancelClaim: async (id: string, employeeId?: string): Promise<ExpenseReimbursement> => {
          const res = await apiRequest<ExpenseReimbursement>(
        `/api/dispatch/expense-reimbursements/${id}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ employeeId }),
        }
      );
      return normalizeExpenseRecord(res, res.id || id);
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
    let listenerReady = false;

    const emitMerged = () => {
      if (!isSubscribed) return;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const source = listenerReady ? firestoreClaims : restClaims;

      const merged = source
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
        if (isSubscribed && !listenerReady) {
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
        const ownId = listenerOwnEmployeeId();
        const qRef = ownId
          ? query(collection(db, 'expense_reimbursements'), where('employeeId', '==', ownId))
          : collection(db, 'expense_reimbursements');
        unsubscribeSnapshot = onSnapshot(
          qRef,
          (snapshot) => {
            if (!isSubscribed) return;
            const list: ExpenseReimbursement[] = [];
            snapshot.forEach((d) => {
              list.push(normalizeExpenseRecord(d.data(), d.id));
            });
            firestoreClaims = list;
            listenerReady = true;
            emitMerged();
          },
          (error) => {
            listenerReady = false;
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

    return () => {
      isSubscribed = false;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  },
};

