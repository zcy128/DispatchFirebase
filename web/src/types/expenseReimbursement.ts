export type ExpenseClaimStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export const EXPENSE_CLAIM_STATUS_LABELS: Record<ExpenseClaimStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const EXPENSE_CLAIM_STATUS_COLORS: Record<
  ExpenseClaimStatus,
  { bg: string; text: string; border: string }
> = {
  pending: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-700/50',
  },
  approved: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-700/50',
  },
  rejected: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-700/50',
  },
  cancelled: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    text: 'text-slate-700 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700/50',
  },
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  { code: 'fuel', label: 'Fuel / Gas' },
  { code: 'parking', label: 'Parking & Tolls' },
  { code: 'maintenance', label: 'Supplies & Minor Maintenance' },
  { code: 'cleaning', label: 'Vehicle Cleaning' },
  { code: 'meals', label: 'Meal Allowance' },
  { code: 'other', label: 'Other Expense' },
];

export interface ExpenseCategory {
  id: string;
  code: string;
  displayName: string;
  sortOrder: number;
  active: boolean;
}

export interface ExpenseReimbursementLine {
  id: string;
  categoryCode: string;
  categoryDisplayName: string;
  amount: number;
  note: string;
  sortOrder: number;
}

export interface ExpenseReimbursement {
  id: string;
  employeeId: string;
  employeeName: string;
  claimDate: string; // YYYY-MM-DD
  routeNo: string;
  totalAmount: number;
  lines: ExpenseReimbursementLine[];
  attachmentUrls?: string[];
  status: ExpenseClaimStatus;
  approvalNotes?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseClaimPayload {
  employeeId: string;
  employeeName: string;
  claimDate: string;
  routeNo: string;
  lines: Array<{
    categoryCode: string;
    categoryDisplayName: string;
    amount: number;
    note: string;
    sortOrder: number;
  }>;
  attachmentUrls?: string[];
}

export interface ReviewExpenseClaimPayload {
  status: 'approved' | 'rejected';
  approvalNotes: string;
  approvedByName: string;
}
