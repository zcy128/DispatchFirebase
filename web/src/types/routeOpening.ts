export type RouteOpeningType = 'permanent' | 'temporary' | 'charter';
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

  postingType: RouteOpeningType; // 'permanent' | 'temporary' | 'charter'
  roleNeeded: RouteOpeningRole;   // 'driver' | 'attendant' | 'driver_and_attendant'

  // Charter-specific metadata (when postingType === 'charter')
  charterTripId?: string;
  charterClientName?: string;
  vehiclesNeeded?: number;
  openShiftsCount?: number;
  departsAt?: string;
  returnsAt?: string;
  passengerCount?: number;
  driverPayRate?: number;
  attendantPayRate?: number;
  sanitizedStops?: SanitizedStopPreview[];

  effectiveStartDate: string;    // YYYY-MM-DD
  effectiveEndDate?: string;     // YYYY-MM-DD (optional, for temporary/charter)
  shiftType: string;             // 'ALL', 'AM', 'PM', 'Midday', or 'CHARTER'

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

  charterTripId?: string;
  charterClientName?: string;
  vehiclesNeeded?: number;
  openShiftsCount?: number;
  departsAt?: string;
  returnsAt?: string;
  passengerCount?: number;
  driverPayRate?: number;
  attendantPayRate?: number;
  sanitizedStops?: SanitizedStopPreview[];

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
