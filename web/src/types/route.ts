export interface StopStudent {
  studentId: number;
  studentNo: string;
  studentName: string;
  schoolName?: string;
}

export interface RouteStop {
  stopId: number;
  sequence: number;
  stopLocation: string;
  pullawayTime: string; // "07:30"
  actualArrivalTime?: string; // "07:38"
  minutesLate?: number;
  stopType: string;     // "HomePickup", "SchoolDropoff", etc.
  latitude?: number;
  longitude?: number;
  schoolId?: number;
  schoolName?: string;
  runDays?: string;     // "MTWRF", "----F", etc.
  comment?: string;
  instruction?: string;
  effectiveDate?: string;
  retireDate?: string;
  assignedStudents?: StopStudent[];
  // Customizable bus pickup spot (for streets too narrow for large buses)
  pickupLocation?: string;        // Specific bus stopping description, e.g. "Corner of Maple St & Pine Ave"
  pickupLatitude?: number;        // Explicit bus stop latitude if moved from home address
  pickupLongitude?: number;       // Explicit bus stop longitude if moved from home address
  isCustomPickupLocation?: boolean; // True if the dispatcher has repositioned the bus stop
}

export interface ShiftSummary {
  shiftId: number;
  shiftType: 'AM' | 'PM' | 'Midday' | 'NOON' | string;
  shiftName?: string;
  runDays: string; // "MTWRF", "----F", "MTWR-"
  schoolsServiced?: string;
  description?: string;
  firstStopTime: string;
  lastStopTime: string;
  stopCount: number;
  studentCount: number;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleId?: number;
  unitNumber?: string;
  attendantId?: string;
  attendantName?: string;
  attendantPhone?: string;
}

export interface BusRouteShift {
  id: string; // SHIFT-001-AM
  shiftId: number;
  routeId: string;
  routeNo: string;
  routeName: string;
  shiftType: string;
  shiftSchools?: string;
  description?: string;
  active?: boolean;
  runDays: string; // "MTWRF", "----F"
  effectiveDate?: string;
  retireDate?: string;
  firstStopTime: string;
  lastStopTime: string;
  stops: RouteStop[];
  isCustomCrew?: boolean;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleId?: number;
  unitNumber?: string;
  plateNumber?: string;
  attendantId?: string;
  attendantName?: string;
  attendantPhone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusRoute {
  id: string; // RT-001
  busRouteId: number;
  routeNo: string; // OCDSB-001
  routeName: string;
  active: boolean;
  schoolBoardId: number;
  schoolBoardCode: string;
  yardId: number;
  yardName: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleId?: number;
  unitNumber?: string;
  plateNumber?: string;
  vehicleCapacity?: number;
  attendantId?: string;
  attendantName?: string;
  attendantPhone?: string;
  shifts?: ShiftSummary[];
  totalStops: number;
  totalStudents: number;
  autoMarryup?: boolean;
  instructions?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const isAutoMarryupEnabled = (route: BusRoute): boolean => {
  return route.autoMarryup !== false;
};

export interface ShiftCrewOverride {
  shiftId: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleId?: number;
  unitNumber?: string;
  plateNumber?: string;
  attendantId?: string;
  attendantName?: string;
  attendantPhone?: string;
}

export interface AssignRouteCrewPayload {
  driverId: string;
  driverName?: string;
  driverPhone?: string;
  vehicleId?: number;
  unitNumber?: string;
  plateNumber?: string;
  attendantId?: string;
  attendantName?: string;
  attendantPhone?: string;
  isCustomCrew: boolean;
  shiftOverrides?: ShiftCrewOverride[];
}

export interface RouteStats {
  totalRoutes: number;
  activeRoutes: number;
  assignedDrivers: number;
  totalStops: number;
  totalStudents: number;
}

/**
 * Normalizes weekday bitmask / string into compact standard format: MTWRF, ----F, MTWR-
 */
export const formatOpDays = (runDays?: number | string | null): string => {
  if (!runDays) return 'MTWRF';
  if (typeof runDays === 'string') {
    const s = runDays.trim().toUpperCase();
    if (s === 'WEEKDAYS' || s === '31' || s === 'MTWRF' || s === 'ALL') return 'MTWRF';
    if (s === '16' || s === '----F' || s === 'F') return '----F';
    if (s === '15' || s === 'MTWR-' || s === 'MTWR') return 'MTWR-';
    // If it's already a 5-char mask with '-' (e.g. M-W-F or --W--)
    if (s.length === 5 && /^[MTWRF\-]{5}$/.test(s)) return s;
    // Map arbitrary day combinations (e.g. MWF, MWR, TR, etc.)
    const hasM = s.includes('M') ? 'M' : '-';
    const hasT = s.includes('T') ? 'T' : '-';
    const hasW = s.includes('W') ? 'W' : '-';
    const hasR = s.includes('R') ? 'R' : '-';
    const hasF = s.includes('F') ? 'F' : '-';
    const res = `${hasM}${hasT}${hasW}${hasR}${hasF}`;
    if (res !== '-----') return res;
    return s;
  }
  if (runDays === 31) return 'MTWRF';
  if (runDays === 16) return '----F';
  if (runDays === 15) return 'MTWR-';

  // Bitmask: M=1, T=2, W=4, R=8, F=16
  const days = [
    { flag: 1, char: 'M' },
    { flag: 2, char: 'T' },
    { flag: 4, char: 'W' },
    { flag: 8, char: 'R' },
    { flag: 16, char: 'F' }
  ];
  let res = '';
  for (const d of days) {
    res += (runDays & d.flag) ? d.char : '-';
  }
  return res || 'MTWRF';
};

/**
 * Returns visual color palettes for shift types and early dismissals
 */
export const getShiftBadgeStyle = (shiftType: string, runDays: string = 'MTWRF') => {
  const isFridayOnly = runDays.includes('F') && !runDays.includes('M') && !runDays.includes('T');
  const typeUpper = shiftType.toUpperCase();

  if (isFridayOnly || typeUpper.includes('NOON') || typeUpper.includes('EARLY')) {
    return {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      text: 'text-purple-300',
      dot: 'bg-purple-400',
      tag: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      label: 'Early Dismissal'
    };
  }
  if (typeUpper.includes('AM')) {
    return {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-300',
      dot: 'bg-amber-400',
      tag: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      label: 'Morning'
    };
  }
  if (typeUpper.includes('PM')) {
    return {
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/30',
      text: 'text-sky-300',
      dot: 'bg-sky-400',
      tag: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      label: 'Afternoon'
    };
  }
  return {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
    tag: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    label: 'Midday / Special'
  };
};
