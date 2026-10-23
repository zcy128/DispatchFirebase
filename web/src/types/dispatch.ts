export type DispatchStudentStatus = 'scheduled' | 'picked_up' | 'dropped_off' | 'absent' | 'no_show';

export interface DispatchStopStudent {
  studentId: number;
  studentNo?: string;
  studentName: string;
  schoolName?: string;
  status?: DispatchStudentStatus;
  boardedAt?: string;
  isPresent?: boolean;
  pickupTime?: string;
  absenceReason?: string;
  absenceReportedAt?: string;
  absenceReportedBy?: string;
}

export interface RecordStudentAbsencePayload {
  date: string;
  studentId: number;
  routeNo?: string;
  shiftType?: 'ALL' | 'AM' | 'PM' | string;
  reason: string;
  reportedBy?: string;
}

export interface RecordStudentAbsenceResponse {
  date: string;
  studentId: number;
  studentName: string;
  reason: string;
  affectedShifts: string[];
  count: number;
}

export interface StudentAbsenceRecord {
  id: string;
  date: string;
  studentId: number;
  studentNo?: string;
  studentName: string;
  schoolName?: string;
  routeNo?: string;
  shiftType?: 'ALL' | 'AM' | 'PM' | string;
  reason: string;
  reportedBy?: string;
  reportedAt?: string;
  createdAt?: string;
  status: string;
  affectedShifts?: string[];
}

export interface DispatchShiftStop {
  stopId: number;
  sequence: number;
  stopLocation: string;
  stopScheduleTime: string; // HH:mm
  actualArrivalTime?: string; // HH:mm
  stopArrivalTime?: string; // HH:mm
  minutesLate?: number;
  stopType: string;
  latitude?: number;
  longitude?: number;
  schoolId?: number;
  schoolName?: string;
  comment?: string;
  assignedStudents?: DispatchStopStudent[];
  students?: DispatchStopStudent[];
}

export type DispatchHealth = 'green' | 'yellow' | 'red';

export interface DispatchShift {
  id: string; // e.g. "DS-2026-09-25-OCSB-050-AM"
  dispatchDate: string; // YYYY-MM-DD
  routeId: string;
  routeNo: string;
  routeName: string;
  shiftType: 'AM' | 'PM' | 'Midday' | 'NOON' | string;
  busRouteShiftId?: string;
  mergedShiftIds?: string[];
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleId?: number;
  unitNumber?: string;
  plateNumber?: string;
  attendantId?: string;
  attendantName?: string;
  attendantPhone?: string;
  isTemporaryDriver?: boolean;
  isTemporaryAttendant?: boolean;
  isTemporaryVehicle?: boolean;
  temporaryAssignmentId?: string;
  yardId?: number;
  yardName?: string;
  schoolBoardId?: number;
  schoolBoardCode?: string;
  firstStopTime: string;
  lastStopTime: string;
  totalStops: number;
  completedStops: number;
  lateMinutes: number;
  health: DispatchHealth;
  isDryRun?: boolean;
  notes?: string;
  driverPayOption?: string;
  driverPayAmount?: number;
  driverEiHours?: number;
  attendantPayOption?: string;
  attendantPayAmount?: number;
  attendantEiHours?: number;
  nurseId?: string;
  nurseName?: string;
  nursePhone?: string;
  nursePayOption?: string;
  nursePayAmount?: number;
  nurseEiHours?: number;
  payrollComments?: string;
  scheduledCheckInTime?: string; // HH:mm (defaults to 60 mins before firstStopTime)
  driverCheckedInAt?: string | null; // HH:mm
  isDriverCheckedIn?: boolean;
  driverCheckedOutAt?: string | null; // HH:mm
  isDriverCheckedOut?: boolean;
  driverCheckoutComments?: string | null;
  attendantCheckedInAt?: string | null; // HH:mm
  isAttendantCheckedIn?: boolean;
  attendantCheckedOutAt?: string | null; // HH:mm
  isAttendantCheckedOut?: boolean;
  attendantCheckoutComments?: string | null;
  driverReminderSentAt?: string;
  attendantReminderSentAt?: string;
  pretripReminderSentAt?: string;
  parentNotifications?: SentParentNotificationRecord[];
  stops: DispatchShiftStop[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverCheckInRequest {
  checkInTime?: string;
  undo?: boolean;
}

export interface RolePayrollRateSetting {
  role: 'driver' | 'attendant' | 'nurse';
  roleLabel: string;
  partialPayRate: number;
  doublePartialPayRate: number;
  defaultEiHours: number;
  noPayRate: number;
  noPayEiHours: number;
}

export interface DispatchPayrollSettings {
  driver: RolePayrollRateSetting;
  attendant: RolePayrollRateSetting;
  nurse: RolePayrollRateSetting;
  updatedAt?: string;
}

export interface CreateDispatchDayResult {
  date: string;
  created: number;
  eligible: number;
  skippedExisting: number;
  message: string;
}

export interface DispatchFilterState {
  search: string;
  yardFilter: string;
  shiftTypeFilter: string;
  healthFilter: string;
  needsAttentionOnly: boolean;
}

export interface SplitShiftPart {
  routeSuffix: string; // e.g. "A", "B", "C"
  routeNo: string; // e.g. "OCSB-050-A", "OCSB-050-B"
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleId?: number;
  unitNumber?: string;
  plateNumber?: string;
  attendantId?: string;
  attendantName?: string;
  attendantPhone?: string;
  studentIds: number[];
}

export interface SplitDispatchShiftRequest {
  parts: SplitShiftPart[];
}

export interface ParentNotificationRecipient {
  studentId: number;
  studentName: string;
  schoolName?: string;
  contactName: string;
  relationship?: string;
  phone?: string;
  email?: string;
  selected: boolean;
}

export type DelayReasonCategory = 'traffic' | 'breakdown' | 'weather' | 'other';

export interface ParentNotificationPayload {
  shiftId: string;
  routeNo: string;
  shiftType: string;
  stopId?: number;
  stopLocation?: string;
  delayMinutes: number;
  reasonCategory: DelayReasonCategory;
  messageText: string;
  channels: ('sms' | 'email')[];
  recipients: ParentNotificationRecipient[];
  timestamp: string;
}

export interface SentParentNotificationRecord {
  id: string;
  timestamp: string;
  timeStr: string;
  reasonCategory: DelayReasonCategory;
  reasonLabel: string;
  delayMinutes: number;
  messageText: string;
  channels: ('sms' | 'email')[];
  recipientsCount: number;
  recipientsSummary?: string;
  scope: 'this_stop' | 'downstream' | 'all';
  stopId?: number;
  stopSequence?: number;
  stopLocation?: string;
  recipients?: {
    studentId: number;
    studentName: string;
    contactName: string;
    relationship?: string;
    phone?: string;
    email?: string;
  }[];
}
export interface DispatchChangeLog {
  id: string;
  dispatchDate: string; // YYYY-MM-DD
  shiftId?: string;
  routeNo: string;
  shiftType: string;
  type: string;
  detail: string;
  time: string;
  timestamp: number;
  user: string;
}

export interface DispatchPayrollRecord {
  id: string; // DP-{shiftId}-{role}
  dispatchDate: string; // YYYY-MM-DD
  shiftId: string;
  routeNo: string;
  routeName?: string;
  shiftType: string;
  schoolBoardId?: number;
  schoolBoardCode?: string;
  employeeId: string;
  employeeName: string;
  role: 'driver' | 'attendant' | string;
  vehicleId?: number;
  unitNumber?: string;
  checkInTime: string;
  checkOutTime?: string;
  hasComments?: boolean;
  payOption: 'PD' | 'DD' | 'NP' | 'F' | 'STANDARD' | string;
  payRate: number;
  eiHours: number;
  rateSource: string;
  rateDescription?: string;
  payrollComments?: string;
  status: 'pending_checkout' | 'pending_approval' | 'approved' | 'rejected' | string;
  syncedToFinance?: boolean;
  isCharter?: boolean;
  charterTripId?: string;
  charterAssignmentId?: string;
  clientName?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PayrollDepartmentLogRecord {
  id: string; // PL-{shiftId}-{role}
  dispatchPayrollId: string; // DP-{shiftId}-{role}
  dispatchDate: string; // YYYY-MM-DD
  shiftId: string;
  routeNo: string;
  routeName?: string;
  shiftType: string;
  schoolBoardCode?: string;
  employeeId: string;
  employeeName: string;
  role: 'driver' | 'attendant' | string;
  unitNumber?: string;
  checkInTime: string;
  checkOutTime?: string;
  payOption: string;
  originalPayRate: number;
  payAmount: number;
  originalEiHours: number;
  eiHours: number;
  rateSource: string;
  rateDescription?: string;
  dispatcherComments?: string;
  crewComments?: string;
  payrollNotes?: string;
  status: 'approved' | 'processed' | 'paid' | 'on_hold' | string;
  isCharter?: boolean;
  charterTripId?: string;
  charterAssignmentId?: string;
  clientName?: string;
  approvedBy?: string;
  approvedAt?: string;
  syncedAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CrewCheckOutPayload {
  role: 'driver' | 'attendant';
  checkOutTime?: string;
  payrollComments?: string;
  comments?: string;
  undo?: boolean;
}

export interface ApproveDispatchPayrollPayload {
  approvedBy: string;
  payRate?: number;
  eiHours?: number;
  payOption?: string;
  payrollComments?: string;
}

export interface RejectDispatchPayrollPayload {
  rejectedBy: string;
  reason?: string;
}

export interface UpdatePayrollDepartmentLogPayload {
  payAmount?: number;
  eiHours?: number;
  payrollNotes?: string;
  status?: string;
  updatedBy: string;
}

export interface TemporaryAssignment {
  id: string; // TA-{timestamp}
  routeId: string; // RT-{BusRouteId}
  routeNo: string; // e.g. "OCDSB-050"
  routeName?: string;
  shiftType: 'ALL' | 'AM' | 'PM' | 'Midday' | string;
  busRouteShiftId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  specificDates?: string[];
  originalDriverId?: string;
  originalDriverName?: string;
  temporaryDriverId?: string;
  temporaryDriverName?: string;
  temporaryDriverPhone?: string;
  originalAttendantId?: string;
  originalAttendantName?: string;
  temporaryAttendantId?: string;
  temporaryAttendantName?: string;
  temporaryAttendantPhone?: string;
  temporaryVehicleId?: number;
  temporaryUnitNumber?: string;
  temporaryPlateNumber?: string;
  reason: string; // "Sick Leave" | "Vacation" | "Driver Training" | "Medical Appointment" | "Other"
  notes?: string;
  status: 'active' | 'completed' | 'cancelled' | string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTemporaryAssignmentPayload {
  routeId: string;
  routeNo: string;
  routeName?: string;
  shiftType: string;
  busRouteShiftId?: string;
  startDate: string;
  endDate: string;
  specificDates?: string[];
  originalDriverId?: string;
  originalDriverName?: string;
  temporaryDriverId?: string;
  temporaryDriverName?: string;
  temporaryDriverPhone?: string;
  originalAttendantId?: string;
  originalAttendantName?: string;
  temporaryAttendantId?: string;
  temporaryAttendantName?: string;
  temporaryAttendantPhone?: string;
  temporaryVehicleId?: number;
  temporaryUnitNumber?: string;
  temporaryPlateNumber?: string;
  reason: string;
  notes?: string;
  createdBy?: string;
  fromRouteOpeningId?: string;
}

export interface UpdateTemporaryAssignmentPayload {
  shiftType?: string;
  startDate?: string;
  endDate?: string;
  specificDates?: string[];
  temporaryDriverId?: string;
  temporaryDriverName?: string;
  temporaryDriverPhone?: string;
  temporaryAttendantId?: string;
  temporaryAttendantName?: string;
  temporaryAttendantPhone?: string;
  temporaryVehicleId?: number;
  temporaryUnitNumber?: string;
  temporaryPlateNumber?: string;
  reason?: string;
  notes?: string;
  status?: string;
}

export interface CheckInReminderSettings {
  reminderGraceMinutes: number;
  pretripReminderGraceMinutes?: number; // default: 60
  enabled: boolean;
  reminderWindowStart: string;
  reminderWindowEnd: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SimulationSettings {
  enabled: boolean;
  autoGenerateTime: string; // default "14:00" (2:00 PM Ottawa time)
  checkInWindowMinutes: number; // default 30 (+0..30m)
  studentPickupWindowMinutes: number; // default 15 (+0..15m)
  studentAbsentRate: number; // default 10 (10%)
  pretripWindowMinutes: number; // default 30 (+0..30m)
  lastAutoGeneratedForDate?: string;
  lastSimulatedDate?: string;
  lastRunAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SimulationRunResult {
  date: string;
  dispatchesCreated: number;
  totalShifts: number;
  driversCheckedIn: number;
  attendantsCheckedIn: number;
  totalStudents: number;
  absentStudents: number;
  presentStudents: number;
  absentRatePercent: number;
  pretripsCreated: number;
  timeOffCreated: number;
  timeOffApproved: number;
  defectsCreated: number;
  defectsResolved: number;
  incidentsCreated: number;
  incidentsResolved: number;
  routeAssessmentsCreated: number;
  hazardReportsCreated: number;
  expensesCreated: number;
  expensesApproved: number;
  vehicleSignoutsCreated: number;
  executedAt: string;
  message: string;
}


