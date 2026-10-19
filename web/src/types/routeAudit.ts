export type RouteChangeCategory =
  | 'route'     // Route general settings: active, name, yard, instructions, autoMarryup
  | 'shift'     // Shift settings: active, runDays, effective/retire dates
  | 'stop'      // Stop modifications: time, address, comment, type, sequence, effective/retire dates
  | 'student'   // Student changes: assigned to route/shift, itinerary updated, removed
  | 'crew';     // Crew assignments: driver, bus, attendant

export type RouteChangeAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'assign'
  | 'unassign';

export interface RouteChangeFieldDiff {
  field: string;
  fieldLabel: string;
  oldValue?: any;
  newValue?: any;
}

export interface RouteChangeLog {
  id: string;
  routeId: string;
  routeNo: string;
  routeName?: string;
  category: RouteChangeCategory;
  action: RouteChangeAction;
  summary: string;
  diffs?: RouteChangeFieldDiff[];

  // Contextual identifiers
  shiftId?: string;
  shiftType?: string;
  stopId?: number | string;
  stopSequence?: number;
  stopLocation?: string;
  studentId?: number;
  studentNo?: string;
  studentName?: string;

  // Audit information: who modified it
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;

  // Timestamp
  timestamp: string; // ISO 8601 string
}

export interface RouteAuditFilter {
  category?: RouteChangeCategory | 'all';
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
