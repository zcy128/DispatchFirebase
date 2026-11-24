export type LeaveType =
  | 'vacation'
  | 'sick_leave'
  | 'personal_days'
  | 'jury_duty'
  | 'bereavement_leave'
  | 'aboriginal_practices'
  | 'other';

export type TimeOffStatus =
  | 'pending'
  | 'awaiting_peer_confirm'
  | 'seeking_coverage'
  | 'pre_approved'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface TimeOffCoverageSlot {
  slotId: string;
  date: string;
  shiftType: 'AM' | 'PM' | 'Midday' | string;
  routeId?: string;
  routeNo: string;
  yardId?: string;
  yardName?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  status: 'awaiting_peer' | 'open_broadcast' | 'filled' | 'declined' | string;
  coverDriverId?: string;
  coverDriverName?: string;
  temporaryAssignmentId?: string;
  confirmedAt?: string;
}

export interface TimeOffRequest {
  id: string; // TOR-{timestamp}
  employeeId: string;
  employeeNumber?: string;
  employeeName: string;
  yardId?: string;
  yardName?: string;
  routeNo?: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  shiftType: 'ALL' | 'AM' | 'PM' | 'Midday' | string;
  comments?: string;
  status: TimeOffStatus;
  coverageMode?: 'named_peer' | 'auto_broadcast' | 'manual_dispatch' | string;
  coverageSlots?: TimeOffCoverageSlot[];
  preApprovedAt?: string;
  autoApproveDeadline?: string;
  autoApproved?: boolean;
  requestedByUserId?: string;
  requestedByName?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalNotes?: string;
  notifiedChannels?: ('email' | 'sms')[];
  notifiedAt?: string;
  coverageAssigned?: boolean;
  coverageAssignedAt?: string;
  coverageDriverName?: string;
  coverageDriverId?: string;
  temporaryAssignmentId?: string;
  createdAt: string;
  updatedAt: string;
  isArchivedToBigQuery?: boolean;
  bigQueryDataset?: string;
  bigQueryTable?: string;
  bigQueryArchivedAt?: string;
}

export interface CreateTimeOffRequestPayload {
  employeeId: string;
  employeeNumber?: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  shiftType: string;
  comments?: string;
  requestedByUserId?: string;
  requestedByName?: string;
}

export interface UpdateTimeOffRequestPayload {
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  shiftType?: string;
  comments?: string;
  coverageAssigned?: boolean;
  coverageAssignedAt?: string;
  coverageDriverName?: string;
  coverageDriverId?: string;
  temporaryAssignmentId?: string;
}

export interface ReviewTimeOffRequestPayload {
  reviewerUserId: string;
  reviewerName: string;
  approvalNotes?: string;
  notifiedChannels?: ('email' | 'sms')[];
}

export interface TimeOffNotificationSettings {
  notifyOnApprovalEmail: boolean;
  notifyOnApprovalSms: boolean;
  notifyOnRejectionEmail: boolean;
  notifyOnRejectionSms: boolean;
}

export const DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS: TimeOffNotificationSettings = {
  notifyOnApprovalEmail: true,
  notifyOnApprovalSms: true,
  notifyOnRejectionEmail: true,
  notifyOnRejectionSms: true,
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: 'Vacation',
  sick_leave: 'Sick Leave',
  personal_days: 'Personal Days',
  jury_duty: 'Jury Duty',
  bereavement_leave: 'Bereavement Leave',
  aboriginal_practices: 'Leave for Traditional Aboriginal Practices',
  other: 'Other'
};

export const STATUS_LABELS: Record<TimeOffStatus, string> = {
  pending: 'Pending Review',
  awaiting_peer_confirm: 'Awaiting Peer Confirm',
  seeking_coverage: 'Seeking Shift Cover',
  pre_approved: 'Pre-Approved (24h SLA)',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

export interface OfficeConciergeCard {
  type:
    | 'leave_type_selector'
    | 'time_off_preview'
    | 'peer_cover_invite'
    | 'time_off_status_update'
    | string;
  title: string;
  requestId?: string;
  data?: Record<string, any>;
}

export interface OfficeConciergeMessage {
  id: string;
  employeeId: string;
  senderRole: 'employee' | 'office_ai' | 'hr_approver' | 'system' | string;
  senderName: string;
  department?: string;
  text: string;
  card?: OfficeConciergeCard;
  createdAt: string;
}

export interface OfficeConciergeChatRequest {
  employeeId: string;
  employeeName?: string;
  message: string;
  action?: 'select_leave_type' | 'confirm_preview' | 'cancel_draft';
  leaveType?: LeaveType | string;
  lang?: 'en' | 'fr';
}

export interface OfficeConciergeChatResponse {
  reply: string;
  department: string;
  step: string;
  card?: OfficeConciergeCard;
  request?: TimeOffRequest;
  messages: OfficeConciergeMessage[];
}

export interface TimeOffWorkbenchEvent {
  id: string;
  requestId: string;
  employeeId: string;
  employeeName: string;
  yardId?: string;
  yardName?: string;
  routeNo?: string;
  eventType: string;
  title: string;
  summary: string;
  status: TimeOffStatus;
  canApprove: boolean;
  request?: TimeOffRequest;
  createdAt: string;
}

export interface TimeOffYardSummary {
  yardId: string;
  yardName: string;
  totalRequests: number;
  pendingCount: number;
  seekingCount: number;
  preApprovedCount: number;
  approvedCount: number;
  totalSlots: number;
  filledSlots: number;
  openSlots: number;
  requests: TimeOffRequest[];
}

export interface TimeOffWorkbenchResponse {
  windowStart: string;
  windowEnd: string;
  canApprove: boolean;
  events: TimeOffWorkbenchEvent[];
  activeClaims: TimeOffRequest[];
  yardRegions: TimeOffYardSummary[];
}
