export type JobTitleType = 'driver' | 'attendant' | 'lpn';
export type ShiftTypeKind = 'AM' | 'MIDDAY' | 'PM';

export interface BusRoutePayrollRate {
  id: string;
  numericId?: number;
  schoolBoardId: number;
  schoolBoardName?: string;
  schoolBoardCode?: string;
  routeId?: number | null;
  routeNo?: string;
  routeName?: string;
  shiftId?: number | null;
  shiftName?: string;
  employeeId?: number | null;
  employeeName?: string;
  jobTitle?: JobTitleType | string;
  weekDays?: string;
  shiftType?: ShiftTypeKind | string;
  payRate?: number;
  eiHours?: number;
  effectiveDate: string; // YYYY-MM-DD
  retireDate?: string | null; // YYYY-MM-DD
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolBoardShiftRate {
  rateId?: string;
  payRate?: number;
  eiHours?: number;
  effectiveDate?: string;
  retireDate?: string | null;
}

export interface SchoolBoardJobRates {
  am: SchoolBoardShiftRate;
  midday: SchoolBoardShiftRate;
  pm: SchoolBoardShiftRate;
  all: SchoolBoardShiftRate;
}

export interface SchoolBoardBaseRatesDTO {
  schoolBoardId: number;
  schoolBoardName: string;
  schoolBoardCode: string;
  driver: SchoolBoardJobRates;
  attendant: SchoolBoardJobRates;
}

export interface PayrollLookups {
  schoolBoards: Array<{
    schoolBoardId: number;
    schoolBoardName: string;
    schoolBoardCode: string;
  }>;
  routes: Array<{
    busRouteId: number;
    routeNo: string;
    routeName: string;
    shifts: Array<{
      shiftId: number;
      shiftType: string;
    }>;
  }>;
  employees: Array<{
    employeeId: number;
    firstName: string;
    lastName: string;
    jobPosition?: string;
  }>;
  jobTitles: Array<{
    id: number;
    name: string;
    displayName: string;
  }>;
  shiftTypes: Array<{
    id: number;
    name: string;
    displayName: string;
  }>;
}

export interface RateCalculationRequest {
  date: string;
  schoolBoardId: number;
  routeId?: number | null;
  shiftId?: number | null;
  employeeId?: number | null;
  jobTitle: string;
  shiftType: string;
}

export interface RateCalculationResponse {
  matchedTier: number; // 1: Route+Emp, 2: Emp general, 3: Route general, 4: Board base, 0: Default
  matchedRuleDesc: string;
  payRate: number;
  eiHours: number;
  appliedRate?: BusRoutePayrollRate | null;
}
