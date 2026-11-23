import { ExpenseApproverGroup } from '../types/expenseReimbursement';

const MS_PER_DAY = 86_400_000;

function parseDateUTC(dateStr: string): number {
  const clean = (dateStr || '').trim().slice(0, 10);
  const parts = clean.split('-').map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return Number.NaN;
  }
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function formatDateUTC(utcMs: number): string {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Resolves the fixed bi-weekly pay period [startDate, endDate] (inclusive) containing dateStr,
 * anchored to anchorDateStr. Mirrors server/internal/services/expense_policy_evaluator.go.
 */
export function resolveBiweeklyPayPeriod(
  dateStr: string,
  anchorDateStr: string,
  periodLengthDays = 14
): { startDate: string; endDate: string } {
  const len = periodLengthDays > 0 ? periodLengthDays : 14;
  const targetMs = parseDateUTC(dateStr);
  const anchorMs = parseDateUTC(anchorDateStr);
  if (Number.isNaN(targetMs) || Number.isNaN(anchorMs)) {
    return { startDate: dateStr.slice(0, 10), endDate: dateStr.slice(0, 10) };
  }

  const diffDays = Math.floor((targetMs - anchorMs) / MS_PER_DAY);
  const periodIndex = Math.floor(diffDays / len);
  const startMs = anchorMs + periodIndex * len * MS_PER_DAY;
  const endMs = startMs + (len - 1) * MS_PER_DAY;
  return {
    startDate: formatDateUTC(startMs),
    endDate: formatDateUTC(endMs),
  };
}

/**
 * Rounds a monetary amount to 2 decimal places using half-up rounding.
 */
export function roundCurrencyHalfUp(val: number): number {
  if (!Number.isFinite(val)) return 0;
  if (val < 0) {
    return -Math.floor(-val * 100 + 0.5) / 100;
  }
  return Math.floor(val * 100 + 0.5) / 100;
}

/**
 * Enforces strict HR/Fleet group-level isolation for expense policy management in UI.
 */
export function canManageExpensePolicyGroup(
  userRole?: string,
  approverGroup?: ExpenseApproverGroup | string
): boolean {
  const role = (userRole || '').trim().toLowerCase();
  const group = (approverGroup || '').trim().toLowerCase();
  if (group !== 'hr' && group !== 'fleet') return false;
  if (role === 'admin' || role === 'administrator') return true;
  if ((role === 'hr' || role === 'human resources' || role === 'human_resources') && group === 'hr') {
    return true;
  }
  if ((role === 'fleet' || role === 'mechanic') && group === 'fleet') {
    return true;
  }
  return false;
}

export function canManageBiweeklyPayrollConfig(userRole?: string): boolean {
  const role = (userRole || '').trim().toLowerCase();
  return role === 'admin' || role === 'administrator' || role === 'payroll' || role === 'finance';
}
