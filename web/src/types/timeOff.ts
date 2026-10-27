export type LeaveType =
  | 'vacation'
  | 'sick_leave'
  | 'personal_days'
  | 'jury_duty'
  | 'bereavement_leave'
  | 'aboriginal_practices'
  | 'other';

export type TimeOffStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TimeOffRequest {
  id: string; // TOR-{timestamp}
  employeeId: string;
  employeeNumber?: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  shiftType: 'ALL' | 'AM' | 'PM' | 'Midday' | string;
  comments?: string;
  status: TimeOffStatus;
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
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};
