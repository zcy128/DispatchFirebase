export type ExpenseClaimStatus =
  | 'pending'
  | 'pre_approved'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export const EXPENSE_CLAIM_STATUS_LABELS: Record<ExpenseClaimStatus, string> = {
  pending: 'Pending Review',
  pre_approved: 'Pre-Approved (5-Day SLA)',
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
  pre_approved: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-700/50',
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

export type ExpenseApproverGroup = 'hr' | 'fleet';

export type ExpensePeriodType =
  | 'per_claim'
  | 'one_time'
  | 'biweekly_pay_period'
  | 'monthly'
  | 'yearly';

export type ExpenseEvaluationStatus = 'pass' | 'warning' | 'violation';

export const DEFAULT_EXPENSE_CATEGORIES: Array<{
  code: string;
  label: string;
  limitLabel: string;
  approverGroup: ExpenseApproverGroup;
  periodType: ExpensePeriodType;
  maxTotalAmount: number | null;
  requireAttachment: boolean;
}> = [
  {
    code: 'drivers_medical',
    label: 'Drivers Medical',
    limitLabel: 'Up to $60.00 / year',
    approverGroup: 'hr',
    periodType: 'yearly',
    maxTotalAmount: 60.0,
    requireAttachment: true,
  },
  {
    code: 'road_test',
    label: 'Road Test (after successful completion)',
    limitLabel: 'Up to $155.00',
    approverGroup: 'hr',
    periodType: 'per_claim',
    maxTotalAmount: 155.0,
    requireAttachment: true,
  },
  {
    code: 'class4_knowledge_test',
    label: 'Class 4 Knowledge Test (after successful completion)',
    limitLabel: 'Up to $17.00',
    approverGroup: 'hr',
    periodType: 'per_claim',
    maxTotalAmount: 17.0,
    requireAttachment: true,
  },
  {
    code: 's_endorsement',
    label: 'S Endorsement Licence Addition',
    limitLabel: 'Up to $28.00',
    approverGroup: 'hr',
    periodType: 'per_claim',
    maxTotalAmount: 28.0,
    requireAttachment: true,
  },
  {
    code: 'bus_washing',
    label: 'Bus Washing',
    limitLabel: 'Up to $20.00 / pay period',
    approverGroup: 'fleet',
    periodType: 'biweekly_pay_period',
    maxTotalAmount: 20.0,
    requireAttachment: true,
  },
  {
    code: 'washer_fluid',
    label: 'Washer Fluid',
    limitLabel: 'Up to $5.00 / month',
    approverGroup: 'fleet',
    periodType: 'monthly',
    maxTotalAmount: 5.0,
    requireAttachment: true,
  },
  {
    code: 'other_hr',
    label: 'Other (HR)',
    limitLabel: '',
    approverGroup: 'hr',
    periodType: 'per_claim',
    maxTotalAmount: null,
    requireAttachment: false,
  },
  {
    code: 'other_fleet',
    label: 'Other (Fleet)',
    limitLabel: '',
    approverGroup: 'fleet',
    periodType: 'per_claim',
    maxTotalAmount: null,
    requireAttachment: false,
  },
];

export interface ExpenseCategory {
  id: string;
  code: string;
  displayName: string;
  limitLabel?: string;
  approverGroup?: ExpenseApproverGroup;
  periodType?: ExpensePeriodType;
  maxTotalAmount?: number | null;
  maxCountPerPeriod?: number | null;
  requireAttachment?: boolean;
  autoPreApprove?: boolean;
  aiReviewGuidance?: string;
  sortOrder: number;
  active: boolean;
  version?: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface UpsertExpenseCategoryPayload {
  code?: string;
  displayName: string;
  limitLabel?: string;
  approverGroup: ExpenseApproverGroup;
  periodType: ExpensePeriodType;
  maxTotalAmount: number | null;
  maxCountPerPeriod: number | null;
  requireAttachment: boolean;
  autoPreApprove?: boolean;
  aiReviewGuidance?: string;
  sortOrder?: number;
  active?: boolean;
  reason?: string;
}

export interface ExpensePolicyAuditLog {
  id: string;
  categoryCode: string;
  action: 'create' | 'update' | 'deactivate' | string;
  source: 'ai_copilot' | 'web_ui' | 'system_seed' | string;
  before?: ExpenseCategory;
  after?: ExpenseCategory;
  reason?: string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  createdAt: string;
}

export interface BiweeklyPayrollConfig {
  biweeklyAnchorDate: string; // YYYY-MM-DD
  periodLengthDays: number;
  timezone: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface ExpensePolicySettings {
  autoApproveDays: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface ExpenseLineEvaluation {
  lineId: string;
  categoryCode: string;
  categoryDisplayName: string;
  approverGroup: ExpenseApproverGroup | string;
  periodType: ExpensePeriodType | string;
  windowStart?: string;
  windowEnd?: string;
  maxTotalAmount?: number | null;
  maxCountPerPeriod?: number | null;
  currentAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  projectedApproved: number;
  projectedWithPending: number;
  remainingAmount?: number | null;
  approvedCount: number;
  pendingCount: number;
  status: ExpenseEvaluationStatus;
  reasons?: string[];
  aiReviewGuidance?: string;
  isLegacyCategory?: boolean;
}

export interface ExpenseClaimEvaluation {
  claimId: string;
  employeeId: string;
  claimDate: string;
  status: ExpenseEvaluationStatus;
  requiresOverride: boolean;
  approverGroups: string[];
  biweeklyAnchorDate?: string;
  lines: ExpenseLineEvaluation[];
}

export interface ExpenseAIPreCheckFinding {
  lineId: string;
  categoryCode: string;
  categoryDisplayName: string;
  status: 'pass' | 'attention' | 'missing_proof' | string;
  summary: string;
  guidanceChecked?: string;
  receiptVerified: boolean;
}

export interface ExpenseAIPreCheckResult {
  claimId: string;
  status: 'pass' | 'attention' | 'missing_proof' | string;
  engine: 'gemini' | 'builtin' | string;
  summary: string;
  attachmentCount: number;
  findings: ExpenseAIPreCheckFinding[];
  checkedAt: string;
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
  preApprovedAt?: string;
  autoApproveDeadline?: string;
  autoApproved?: boolean;
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
  status: 'approved' | 'rejected' | 'pending';
  approvalNotes: string;
  approvedByName: string;
}
