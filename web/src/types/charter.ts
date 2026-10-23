export type CharterTripType = 0 | 1 | 2 | 3; // 0 = Field Trip, 1 = Athletic, 2 = Academic, 3 = Other
export type CharterTripStatus = 0 | 1 | 2 | 3 | 4 | 5; // 0 = Draft, 1 = Confirmed, 2 = Assigned, 3 = In Progress, 4 = Completed, 5 = Cancelled
export type CharterStopType = 0 | 1 | 2 | 3; // 0 = Pickup, 1 = Destination, 2 = Return, 3 = Other
export type CharterAssignmentStatus = 0 | 1 | 2 | 3; // 0 = Pending, 1 = Checked In, 2 = Checked Out, 3 = Cancelled

export interface CharterClient {
  id: string;
  name: string;
  schoolId?: number;
  schoolName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  billingAddress?: string;
  notes?: string;
  active: boolean;
  tripCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CharterStop {
  id: string;
  charterTripId?: string;
  sequenceOrder: number;
  stopType: CharterStopType;
  locationName?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  scheduledAt?: string; // ISO or HH:MM
  arrivedAt?: string;
  departedAt?: string;
  notes?: string;
}

export interface CharterAssignment {
  id: string;
  charterTripId: string;
  vehicleId: number;
  vehicleUnitNumber: string;
  plateNumber?: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  attendantId?: string;
  attendantName?: string;
  attendantPhone?: string;
  driverPayOption?: 'PD' | 'DD' | 'NP' | 'F' | 'STANDARD' | string;
  driverPayRate: number;
  driverEiHours: number;
  attendantPayOption?: 'PD' | 'DD' | 'NP' | 'F' | 'STANDARD' | string;
  attendantPayRate: number;
  attendantEiHours: number;
  status: CharterAssignmentStatus;
  isDriverCheckedIn: boolean;
  driverCheckedInAt?: string; // HH:MM or ISO
  isDriverCheckedOut?: boolean;
  driverCheckedOutAt?: string; // HH:MM or ISO
  driverPayrollComments?: string;
  isAttendantCheckedIn: boolean;
  attendantCheckedInAt?: string; // HH:MM or ISO
  isAttendantCheckedOut?: boolean;
  attendantCheckedOutAt?: string; // HH:MM or ISO
  attendantPayrollComments?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CharterTrip {
  id: string;
  tripNumber: string; // e.g. "CHR-2026-001"
  charterClientId: string;
  clientName: string;
  title: string;
  tripType: CharterTripType;
  status: CharterTripStatus;
  dispatchDate: string; // YYYY-MM-DD derived from departsAt
  departsAt: string; // ISO string or YYYY-MM-DDTHH:mm
  returnsAt: string; // ISO string or YYYY-MM-DDTHH:mm
  passengerCount: number;
  needsAttendant: boolean;
  specialRequirements?: string;
  quotedAmount?: number;
  billableHours?: number;
  billingNotes?: string;
  notes?: string;
  roundTrip: boolean;
  stops: CharterStop[];
  assignments: CharterAssignment[];
  createdByUserId?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export function getCharterTripTypeLabel(type: CharterTripType, isFrench: boolean): string {
  switch (type) {
    case 0:
      return isFrench ? 'Sortie éducative' : 'Field Trip';
    case 1:
      return isFrench ? 'Sportif' : 'Athletic';
    case 2:
      return isFrench ? 'Académique' : 'Academic';
    case 3:
    default:
      return isFrench ? 'Autre' : 'Other';
  }
}

export function getCharterTripStatusLabel(status: CharterTripStatus, isFrench: boolean): string {
  switch (status) {
    case 0:
      return isFrench ? 'Brouillon' : 'Draft';
    case 1:
      return isFrench ? 'Confirmé' : 'Confirmed';
    case 2:
      return isFrench ? 'Assigné' : 'Assigned';
    case 3:
      return isFrench ? 'En cours' : 'In Progress';
    case 4:
      return isFrench ? 'Terminé' : 'Completed';
    case 5:
      return isFrench ? 'Annulé' : 'Cancelled';
    default:
      return isFrench ? 'Brouillon' : 'Draft';
  }
}

export function getCharterStopTypeLabel(stopType: CharterStopType, isFrench: boolean): string {
  switch (stopType) {
    case 0:
      return isFrench ? 'Prise en charge' : 'Pickup';
    case 1:
      return isFrench ? 'Destination' : 'Destination';
    case 2:
      return isFrench ? 'Retour' : 'Return';
    case 3:
    default:
      return isFrench ? 'Autre' : 'Other';
  }
}

export function getCharterAssignmentStatusLabel(status: CharterAssignmentStatus, isFrench: boolean): string {
  switch (status) {
    case 0:
      return isFrench ? 'En attente' : 'Pending';
    case 1:
      return isFrench ? 'Pointé (Arrivée)' : 'Checked In';
    case 2:
      return isFrench ? 'Terminé (Départ)' : 'Checked Out';
    case 3:
      return isFrench ? 'Annulé' : 'Cancelled';
    default:
      return isFrench ? 'En attente' : 'Pending';
  }
}

/**
 * Builds Pickup / Destination / optional Return stops from simple route fields,
 * mirroring buildCharterSimpleStops in models/charter.dart.
 */
export function buildCharterSimpleStops(params: {
  tripId: string;
  fromAddress: string;
  toAddress: string;
  roundTrip: boolean;
  departsAt: string;
  returnsAt: string;
}): CharterStop[] {
  const from = params.fromAddress.trim();
  const to = params.toAddress.trim();
  const stops: CharterStop[] = [
    {
      id: `ST-${params.tripId}-1`,
      charterTripId: params.tripId,
      sequenceOrder: 1,
      stopType: 0, // Pickup
      locationName: 'Pickup',
      address: from,
      scheduledAt: params.departsAt,
    },
    {
      id: `ST-${params.tripId}-2`,
      charterTripId: params.tripId,
      sequenceOrder: 2,
      stopType: 1, // Destination
      locationName: 'Destination',
      address: to,
    },
  ];
  if (params.roundTrip) {
    stops.push({
      id: `ST-${params.tripId}-3`,
      charterTripId: params.tripId,
      sequenceOrder: 3,
      stopType: 2, // Return
      locationName: 'Return',
      address: from,
      scheduledAt: params.returnsAt,
    });
  }
  return stops;
}
