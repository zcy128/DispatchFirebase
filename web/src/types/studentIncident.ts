export type StudentIncidentStatus =
  | 'submitted'
  | 'under_investigation'
  | 'parent_contacted'
  | 'school_notified'
  | 'closed';

export const STUDENT_INCIDENT_STATUS_LABELS: Record<StudentIncidentStatus, string> = {
  submitted: 'Submitted',
  under_investigation: 'Under Investigation',
  parent_contacted: 'Parent Contacted',
  school_notified: 'School Notified',
  closed: 'Closed / Resolved',
};

export const STUDENT_INCIDENT_STATUS_COLORS: Record<
  StudentIncidentStatus,
  { bg: string; text: string; border: string }
> = {
  submitted: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-700/50',
  },
  under_investigation: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-700/50',
  },
  parent_contacted: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-700/50',
  },
  school_notified: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-700/50',
  },
  closed: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-700/50',
  },
};

export const STUDENT_INCIDENT_CATEGORY_LABELS: Record<string, string> = {
  physical_altercation: 'Physical Altercation',
  verbal_conflict: 'Verbal Conflict',
  academic_misconduct: 'Academic Misconduct',
  bullying_or_harassment: 'Bullying / Harassment',
  vandalism: 'Vandalism / Property Damage',
  safety_violation: 'Safety Violation',
  other: 'Other Category',
};

export const DISCIPLINARY_ACTION_LABELS: Record<string, string> = {
  verbal_warning: 'Verbal Warning',
  parent_conference: 'Parent Conference',
  detention: 'Detention Assigned',
  suspension: 'Bus Riding Suspension',
  counseling_referral: 'Counseling Referral',
  other: 'Other Action',
};

export interface IncidentOfficeFollowUp {
  reviewedDate?: string;
  administratorName?: string;
  disciplinaryActions?: string[];
  disciplinaryOther?: string;
  officeNotes?: string;
  isOfficeLocked: boolean;
  reviewedAt?: string;
}

export interface StudentIncident {
  id: string;
  incidentDate: string; // YYYY-MM-DD
  incidentTime: string; // HH:mm
  studentId?: number;
  studentNo?: string;
  studentName: string;
  grade?: string;
  schoolId?: number;
  schoolName?: string;
  routeId?: number;
  routeNo: string;
  routeName?: string;
  shiftType?: string;
  driverId: string;
  driverName: string;
  location: string;
  incidentTypes: string[];
  typeOther?: string;
  description: string;
  otherStudentsInvolved?: string;
  witnesses?: string;
  immediateActionTaken?: string;
  studentRemovedFromBus: boolean;
  firstAidRequired: boolean;
  parentsNotified: boolean;
  parentsNotificationDetail?: string;
  status: StudentIncidentStatus;
  officeFollowUp?: IncidentOfficeFollowUp;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateIncidentOfficeFollowUpPayload {
  reviewedDate: string;
  administratorName: string;
  disciplinaryActions: string[];
  disciplinaryOther?: string;
  officeNotes?: string;
  isOfficeLocked: boolean;
  status?: StudentIncidentStatus;
}
