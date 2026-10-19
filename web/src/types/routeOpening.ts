export type RouteOpeningType = 'permanent' | 'temporary';
export type RouteOpeningRole = 'driver' | 'attendant' | 'driver_and_attendant';
export type RouteOpeningStatus = 'open' | 'reviewing' | 'awarded' | 'cancelled';

export interface RouteOpeningApplicant {
  employeeId: string;
  employeeNumber?: string;
  fullName: string;
  jobPosition?: string;
  phone?: string;
  email?: string;
  roleApplied: 'driver' | 'attendant';
  appliedAt: string;
  notes?: string;
  deadheadKm?: number;
  deadheadDurationMinutes?: number;
  status: 'pending' | 'selected' | 'rejected' | 'withdrawn';
}

export interface RouteOpening {
  id: string; // RO-{timestamp}
  title: string;
  routeId: string;
  routeNo: string;
  routeName?: string;
  yardId?: string | number;
  yardName?: string;
  schoolBoardCode?: string;

  postingType: RouteOpeningType; // 'permanent' | 'temporary'
  roleNeeded: RouteOpeningRole;   // 'driver' | 'attendant' | 'driver_and_attendant'

  effectiveStartDate: string;    // YYYY-MM-DD
  effectiveEndDate?: string;     // YYYY-MM-DD (optional, for temporary)
  shiftType: string;             // 'ALL', 'AM', 'PM', 'Midday'

  deadline: string;              // ISO string or YYYY-MM-DDTHH:mm
  compensationNote?: string;
  description?: string;
  requirements?: string;

  status: RouteOpeningStatus;
  applicants: RouteOpeningApplicant[];

  awardedDriverId?: string;
  awardedDriverName?: string;
  awardedDriverPhone?: string;
  awardedAttendantId?: string;
  awardedAttendantName?: string;
  awardedAttendantPhone?: string;
  awardedAt?: string;
  awardedBy?: string;
  awardedNotes?: string;

  crewAppliedToRoute?: boolean;
  crewAppliedAt?: string;
  temporaryAssignmentId?: string;
  chatAnnouncementSent?: boolean;
  chatChannelId?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouteOpeningPayload {
  routeId: string;
  routeNo: string;
  routeName?: string;
  yardId?: string | number;
  yardName?: string;
  schoolBoardCode?: string;

  postingType: RouteOpeningType;
  roleNeeded: RouteOpeningRole;

  effectiveStartDate: string;
  effectiveEndDate?: string;
  shiftType: string;

  deadline: string;
  compensationNote?: string;
  description?: string;
  requirements?: string;

  postToChat?: boolean;
  createdBy: string;
}

export interface SanitizedStopPreview {
  stopId: number | string;
  sequence: number;
  stopLocation: string;
  stopScheduleTime: string;
  stopType: string;
  schoolName?: string;
  latitude?: number;
  longitude?: number;
}
