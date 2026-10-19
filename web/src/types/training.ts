export type TrainingCourseStatus = 'draft' | 'published' | 'completed' | 'cancelled';

export type TrainingRegistrationStatus =
  | 'registered'
  | 'checked_in'
  | 'completed'
  | 'no_show'
  | 'cancelled_by_user'
  | 'cancelled_by_office';

export type TrainingCategory = 'safety' | 'compliance' | 'first_aid' | 'operations' | 'technical';

export interface TrainingType {
  id: string; // e.g. TT-DEF-DRV
  code: string;
  name: string;
  category: TrainingCategory;
  defaultHours: number;
  defaultPayAmount?: number;
  validityMonths: number;
  requiredForRoles?: string[]; // ['driver', 'attendant']
  eligibleRoles?: string[];
  isRequired?: boolean;
  passingScore?: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrainingRegistration {
  id: string; // TR-{timestamp}-{employeeId}
  courseId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber?: string;
  jobTitle?: string;
  employeeRole?: string;
  status: TrainingRegistrationStatus;
  registeredAt: string;
  checkedInAt?: string;
  completedAt?: string;
  passed?: boolean;
  score?: number;
  certificateNumber?: string;
  notes?: string;
  cancellationReason?: string;
}

export interface TrainingCourse {
  id: string; // TC-{timestamp}
  title: string;
  trainingTypeId?: string;
  courseTypeId?: string;
  trainingTypeName?: string;
  instructorName: string;
  instructorContact?: string;
  location: string;
  isOnline?: boolean;
  onlineMeetingUrl?: string;
  yardId?: string;
  yardName?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  hours: number;
  payAmount?: number;
  maxSeats: number;
  registeredCount: number;
  status: TrainingCourseStatus;
  eligibleRoles: string[];
  category?: TrainingCategory;
  description?: string;
  materialsUrl?: string;
  notes?: string;
  cancellationReason?: string;
  registrations: TrainingRegistration[];
  attendees?: TrainingRegistration[];
  createdByUserId?: string;
  createdByName?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainingCoursePayload {
  title: string;
  trainingTypeId?: string;
  courseTypeId?: string;
  trainingTypeName?: string;
  instructorName: string;
  instructorContact?: string;
  location: string;
  isOnline?: boolean;
  onlineMeetingUrl?: string;
  yardId?: string;
  yardName?: string;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  hours: number;
  payAmount?: number;
  maxSeats: number;
  eligibleRoles: string[];
  category?: TrainingCategory;
  description?: string;
  materialsUrl?: string;
  notes?: string;
  createdByUserId?: string;
  createdByName?: string;
  createdBy?: string;
  status?: string;
}

export interface UpdateTrainingCoursePayload {
  title?: string;
  trainingTypeId?: string;
  courseTypeId?: string;
  trainingTypeName?: string;
  instructorName?: string;
  instructorContact?: string;
  location?: string;
  isOnline?: boolean;
  onlineMeetingUrl?: string;
  yardId?: string;
  yardName?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  hours?: number;
  payAmount?: number;
  maxSeats?: number;
  eligibleRoles?: string[];
  category?: TrainingCategory;
  description?: string;
  materialsUrl?: string;
  notes?: string;
  status?: string;
}

export interface CreateTrainingTypePayload {
  name: string;
  code: string;
  description?: string;
  category: TrainingCategory;
  defaultHours: number;
  defaultPayAmount?: number;
  validityMonths: number;
  isRequired?: boolean;
  passingScore?: number;
  eligibleRoles?: string[];
  requiredForRoles?: string[];
}

export interface UpdateTrainingTypePayload {
  name?: string;
  code?: string;
  description?: string;
  category?: TrainingCategory;
  defaultHours?: number;
  defaultPayAmount?: number;
  validityMonths?: number;
  isRequired?: boolean;
  passingScore?: number;
  eligibleRoles?: string[];
  requiredForRoles?: string[];
}

export interface RegisterAttendeePayload {
  employeeId: string;
  employeeName: string;
  employeeNumber?: string;
  jobTitle?: string;
  employeeRole?: string;
  notes?: string;
}

export interface UpdateAttendeeStatusPayload {
  status: TrainingRegistrationStatus;
  passed?: boolean;
  score?: number;
  notes?: string;
}

export const TRAINING_COURSE_STATUS_LABELS: Record<TrainingCourseStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const TRAINING_REGISTRATION_STATUS_LABELS: Record<TrainingRegistrationStatus, string> = {
  registered: 'Registered',
  checked_in: 'Checked In',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled_by_user: 'Cancelled by Crew',
  cancelled_by_office: 'Cancelled by Office'
};

export const TRAINING_CATEGORY_LABELS: Record<TrainingCategory, string> = {
  safety: 'Safety & Defense',
  compliance: 'Regulatory & Compliance',
  first_aid: 'First Aid & Medical',
  operations: 'Fleet Operations',
  technical: 'Technical & Equipment'
};
