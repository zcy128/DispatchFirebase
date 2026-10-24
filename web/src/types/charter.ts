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
  runNumber?: number;
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
  stops?: CharterStop[];
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
  vehiclesNeeded?: number;
  needsAttendant: boolean;
  specialRequirements?: string;
  quotedAmount?: number;
  billableHours?: number;
  driverPayRate?: number;
  attendantPayRate?: number;
  isPublishedOpen?: boolean;
  publishedOpeningId?: string;
  publishedAt?: string;
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
      return isFrench ? 'Prise en charge (Pickup)' : 'Pickup';
    case 1:
      return isFrench ? 'Débarquement (Dropoff)' : 'Dropoff';
    case 2:
      return isFrench ? 'Retour / Débarquement (Dropoff)' : 'Return Dropoff';
    case 3:
    default:
      return isFrench ? 'Prise en charge retour (Return Pickup)' : 'Return Pickup';
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
 * Extracts HH:MM from an ISO datetime string (YYYY-MM-DDTHH:mm) or returns HH:MM directly.
 */
export function formatCharterStopTime(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.includes('T')) {
    return trimmed.split('T')[1]?.slice(0, 5) || '';
  }
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(' ');
    return parts[parts.length - 1]?.slice(0, 5) || '';
  }
  return trimmed.slice(0, 5);
}

/**
 * Adds `minutes` to an ISO datetime (`YYYY-MM-DDTHH:mm`) or `HH:mm` string.
 */
export function addMinutesToCharterTime(isoOrTime: string, minutes: number, fallbackDate?: string): string {
  if (!isoOrTime) return '';
  const trimmed = isoOrTime.trim();
  if (trimmed.includes('T')) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const next = new Date(d.getTime() + minutes * 60 * 1000);
      const yyyy = next.getFullYear();
      const mm = String(next.getMonth() + 1).padStart(2, '0');
      const dd = String(next.getDate()).padStart(2, '0');
      const hh = String(next.getHours()).padStart(2, '0');
      const min = String(next.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }
  }
  const timePart = formatCharterStopTime(trimmed);
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr || '8', 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h) || isNaN(m)) return trimmed;
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = ((total % 60) + 60) % 60;
  const hhmm = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  return fallbackDate ? `${fallbackDate}T${hhmm}` : hhmm;
}

/**
 * Builds standard Charter itinerary stops:
 * - Outbound:
 *   #1 Pickup at School (e.g. 08:00)
 *   #2 Dropoff at Destination / Museum (e.g. 08:30)
 * - Return (if roundTrip):
 *   #3 Return Pickup at Library / Museum (e.g. 15:00)
 *   #4 Return Dropoff at School (e.g. 15:30)
 */
export function buildCharterSimpleStops(params: {
  tripId: string;
  fromAddress: string;
  toAddress: string;
  returnPickupAddress?: string;
  returnDropoffAddress?: string;
  roundTrip: boolean;
  departsAt: string;
  returnsAt: string;
  outboundDropoffAt?: string;
  returnDropoffAt?: string;
}): CharterStop[] {
  const from = params.fromAddress.trim() || 'School';
  const to = params.toAddress.trim() || 'Destination';
  const retPickup = (params.returnPickupAddress ?? to).trim() || to;
  const retDropoff = (params.returnDropoffAddress ?? from).trim() || from;
  const datePrefix = params.departsAt?.slice(0, 10) || '';

  const outboundArriveAt =
    params.outboundDropoffAt ||
    (params.roundTrip
      ? addMinutesToCharterTime(params.departsAt, 30, datePrefix)
      : params.returnsAt || addMinutesToCharterTime(params.departsAt, 30, datePrefix));

  const returnArriveAt =
    params.returnDropoffAt || addMinutesToCharterTime(params.returnsAt, 30, datePrefix);

  const stops: CharterStop[] = [
    {
      id: `ST-${params.tripId}-1`,
      charterTripId: params.tripId,
      sequenceOrder: 1,
      stopType: 0, // Pickup (Outbound)
      locationName: 'Pickup',
      address: from,
      scheduledAt: params.departsAt,
    },
    {
      id: `ST-${params.tripId}-2`,
      charterTripId: params.tripId,
      sequenceOrder: 2,
      stopType: 1, // Dropoff (Destination Arrival)
      locationName: 'Dropoff',
      address: to,
      scheduledAt: outboundArriveAt,
    },
  ];
  if (params.roundTrip) {
    stops.push(
      {
        id: `ST-${params.tripId}-3`,
        charterTripId: params.tripId,
        sequenceOrder: 3,
        stopType: 3, // Return Pickup (e.g. Library / Museum)
        locationName: 'Return Pickup',
        address: retPickup,
        scheduledAt: params.returnsAt,
      },
      {
        id: `ST-${params.tripId}-4`,
        charterTripId: params.tripId,
        sequenceOrder: 4,
        stopType: 2, // Return Dropoff (e.g. School)
        locationName: 'Return Dropoff',
        address: retDropoff,
        scheduledAt: returnArriveAt,
      }
    );
  }
  return stops;
}
