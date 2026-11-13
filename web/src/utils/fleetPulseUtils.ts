import { BusRoute } from '../types/route';
import { DispatchShift } from '../types/dispatch';
import { TimeOffRequest } from '../types/timeOff';
import { StudentIncident } from '../types/studentIncident';
import { VehicleDefectReport } from '../types/defect';
import { HazardReport } from '../types/hazardReport';
import { ExpenseReimbursement } from '../types/expenseReimbursement';
import { calculateDynamicShiftLateness } from './dispatchDelayUtils';
import { countRouteFixIssues } from './routeFixFilterUtils';

export interface FleetPulseSummary {
  dispatchTotalShifts: number;
  dispatchMissingDriver: number;
  dispatchMissingVehicle: number;
  dispatchNotCheckedIn: number;
  dispatchCheckInOverdue: number;
  routeMissingDriver: number;
  routeMissingVehicle: number;
  routeNeedsFix: number;
  pendingTimeOff: number;
  timeOffNeedsCover: number;
  openStudentIncidents: number;
  openVehicleDefects: number;
  openHazardReports: number;
  pendingExpenses: number;
  totalActionItems: number;
}

export interface FleetPulseInput {
  shifts: DispatchShift[];
  routes: BusRoute[];
  timeOffRequests: TimeOffRequest[];
  studentIncidents: StudentIncident[];
  vehicleDefects: VehicleDefectReport[];
  hazardReports: HazardReport[];
  expenseClaims: ExpenseReimbursement[];
  todayStr: string;
  currentHHmm: string;
}

/**
 * Computes real-time operational task counts for the Fleet Pulse dashboard.
 */
export function computeFleetPulseSummary(input: FleetPulseInput): FleetPulseSummary {
  const {
    shifts,
    routes,
    timeOffRequests,
    studentIncidents,
    vehicleDefects,
    hazardReports,
    expenseClaims,
    todayStr,
    currentHHmm,
  } = input;

  let dispatchMissingDriver = 0;
  let dispatchMissingVehicle = 0;
  let dispatchNotCheckedIn = 0;
  let dispatchCheckInOverdue = 0;

  for (const shift of shifts || []) {
    const info = calculateDynamicShiftLateness(shift, currentHHmm, true);
    if (info.isMissingDriver) {
      dispatchMissingDriver += 1;
    } else if (!info.isDriverCheckedIn) {
      dispatchNotCheckedIn += 1;
    }
    if (info.isMissingVehicle) {
      dispatchMissingVehicle += 1;
    }
    if (info.isCheckInOverdue) {
      dispatchCheckInOverdue += 1;
    }
  }

  const routeFix = countRouteFixIssues(routes || []);

  let pendingTimeOff = 0;
  let timeOffNeedsCover = 0;
  for (const req of timeOffRequests || []) {
    if (req.endDate && req.endDate < todayStr) continue;
    if (req.status === 'pending') {
      pendingTimeOff += 1;
    } else if (req.status === 'approved' && !req.coverageAssigned) {
      timeOffNeedsCover += 1;
    }
  }

  const openStudentIncidents = (studentIncidents || []).filter(
    (inc) => inc.status !== 'closed'
  ).length;

  const openVehicleDefects = (vehicleDefects || []).filter(
    (def) => def.status !== 'resolved'
  ).length;

  const openHazardReports = (hazardReports || []).filter(
    (haz) => !haz.isCompleted && haz.statusInt !== 2
  ).length;

  const pendingExpenses = (expenseClaims || []).filter(
    (exp) => exp.status === 'pending'
  ).length;

  const totalActionItems =
    dispatchMissingDriver +
    dispatchMissingVehicle +
    dispatchCheckInOverdue +
    routeFix.needsFix +
    pendingTimeOff +
    timeOffNeedsCover +
    openStudentIncidents +
    openVehicleDefects +
    openHazardReports +
    pendingExpenses;

  return {
    dispatchTotalShifts: (shifts || []).length,
    dispatchMissingDriver,
    dispatchMissingVehicle,
    dispatchNotCheckedIn,
    dispatchCheckInOverdue,
    routeMissingDriver: routeFix.missingDriver,
    routeMissingVehicle: routeFix.missingVehicle,
    routeNeedsFix: routeFix.needsFix,
    pendingTimeOff,
    timeOffNeedsCover,
    openStudentIncidents,
    openVehicleDefects,
    openHazardReports,
    pendingExpenses,
    totalActionItems,
  };
}
