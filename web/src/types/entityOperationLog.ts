export type EntityTargetType = 'student' | 'vehicle';

export type EntityOperationAction = 'create' | 'update' | 'delete';

export interface EntityFieldDiff {
  field: string;
  fieldLabel: string;
  oldValue?: any;
  newValue?: any;
}

export interface EntityOperationActor {
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
}

export interface EntityOperationLog {
  id: string;
  targetType: EntityTargetType;
  targetId: string;
  targetIdentifier: string;
  targetName: string;
  action: EntityOperationAction;
  summary: string;
  diffs?: EntityFieldDiff[];
  actor: EntityOperationActor;
  timestamp: string; // ISO 8601
  metadata?: Record<string, any>;
}

export interface EntityOperationLogFilter {
  targetType?: EntityTargetType | 'all';
  action?: EntityOperationAction | 'all';
  targetId?: string;
  targetIdentifier?: string;
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
