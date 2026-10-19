export type PayrollOperationCategory =
  | 'base_rate'         // Base rate by school board or shift type
  | 'custom_rate'       // Route, shift, or employee override rate
  | 'dispatch_payroll'  // Dispatch checkout, review, approval, rejection
  | 'finance_payroll';  // Finance department adjustment or sync

export type PayrollOperationAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'checkout'
  | 'adjust';

export interface PayrollFieldDiff {
  field: string;
  fieldLabel: string;
  oldValue?: any;
  newValue?: any;
}

export interface PayrollOperationActor {
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
}

export interface PayrollOperationLog {
  id: string;
  category: PayrollOperationCategory;
  action: PayrollOperationAction;
  targetId: string;
  targetIdentifier: string; // e.g. "RATE-001", "DP-SHIFT-101", "OCDSB-001"
  targetName: string;       // e.g. "OCDSB Driver AM Base Rate", "Shift #101 James Anderson"
  amount?: number;
  rateType?: string;
  summary: string;
  diffs?: PayrollFieldDiff[];
  actor: PayrollOperationActor;
  timestamp: string; // ISO 8601 string
  metadata?: Record<string, any>;
}

export interface PayrollOperationLogFilter {
  category?: PayrollOperationCategory | 'all';
  action?: PayrollOperationAction | 'all';
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
