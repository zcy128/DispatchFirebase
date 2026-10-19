export type OperationalSafetyModule =
  | 'time_off'          // Time off leave requests
  | 'vehicle_defect'    // Vehicle defects & fleet maintenance
  | 'hazard_report'     // Workplace & road hazard assessments
  | 'student_incident'  // Student bus behavior & safety incidents
  | 'route_assessment'  // Safety surveys & assessments
  | 'vehicle_signout';  // Vehicle depot checkout and return

export type OperationalSafetyAction =
  | 'submit'
  | 'update'
  | 'approve'
  | 'reject'
  | 'resolve'
  | 'close'
  | 'delete';

export interface SafetyFieldDiff {
  field: string;
  fieldLabel: string;
  oldValue?: any;
  newValue?: any;
}

export interface OperationalSafetyActor {
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
}

export interface OperationalSafetyLog {
  id: string;
  module: OperationalSafetyModule;
  action: OperationalSafetyAction;
  targetId: string;
  targetIdentifier: string; // e.g. "TO-2026-004", "DEF-801", "HAZ-102", "INC-305"
  targetTitle: string;      // e.g. "James Anderson (Sick Leave)", "Bus #1001 Brake Air Leak"
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  status?: string;
  summary: string;
  diffs?: SafetyFieldDiff[];
  actor: OperationalSafetyActor;
  timestamp: string; // ISO 8601 string
  metadata?: Record<string, any>;
}

export interface OperationalSafetyLogFilter {
  module?: OperationalSafetyModule | 'all';
  action?: OperationalSafetyAction | 'all';
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
