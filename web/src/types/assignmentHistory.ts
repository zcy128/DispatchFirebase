export type AssignmentTargetType = 'driver_route' | 'driver_vehicle';
export type AssignmentAction = 'assign' | 'unassign' | 'reassign';

export interface AssignmentHistoryRecord {
  id: string;
  type: AssignmentTargetType;         // 'driver_route' or 'driver_vehicle'
  action: AssignmentAction;           // 'assign', 'unassign', 'reassign'
  timestamp: string;                  // ISO 8601 string
  effectiveDate: string;              // YYYY-MM-DD
  endDate?: string;                   // YYYY-MM-DD if unassigned/ended

  // Driver details
  driverId: string;
  driverName: string;
  driverNumber?: string;

  // Route details (when type === 'driver_route' or associated)
  routeId?: string;
  routeNo?: string;
  routeName?: string;
  shiftType?: string;                 // 'Standing', 'AM', 'PM', etc.

  // Vehicle details (when type === 'driver_vehicle' or associated)
  vehicleId?: string | number;
  unitNumber?: string;
  plateNumber?: string;

  // Metadata
  // Dispatcher audit details (who performed this assignment change)
  assignedBy?: string;                // Name or formatted string of dispatcher
  dispatcherId?: string;              // UID or Employee ID of dispatcher
  dispatcherName?: string;            // Full display name of dispatcher
  dispatcherRole?: string;            // Role of actor e.g. 'admin', 'dispatcher'
  dispatcherEmail?: string;           // Work email of dispatcher

  reason?: string;
  notes?: string;
  isCurrent?: boolean;                // true if this assignment is still actively held
}

export interface AssignmentHistoryFilter {
  type?: AssignmentTargetType | 'all';
  driverId?: string;
  driverName?: string;
  routeNo?: string;
  unitNumber?: string;
  action?: AssignmentAction | 'all';
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  timeRange?: '1year' | 'all';
}
