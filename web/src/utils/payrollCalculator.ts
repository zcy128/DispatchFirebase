/**
 * Pure calculation functions for payroll and timesheet aggregation.
 * Decoupled from React UI views to guarantee precision and testability.
 */

export interface ShiftPayrollItem {
  id: string;
  dispatchDate: string; // YYYY-MM-DD
  routeNo: string;
  shiftType: string; // 'AM' | 'PM' | 'MIDDAY' | 'CHARTER' | 'EXTRA'
  payAmount: number;
  eiHours: number;
  payOption?: string; // 'STANDARD' | 'PD' | 'DD' | 'NP'
  isHolidayCredit?: boolean;
}

export interface EmployeePayrollTotals {
  regularRuns: number;
  regularHours: number;
  regularPay: number;
  holidayRuns: number;
  holidayPay: number;
  totalRuns: number;
  totalEiHours: number;
  totalWages: number;
  approvedExpenses: number;
  netPayout: number;
}

export interface StatHolidayItem {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'Statutory Holiday' | 'Public Holiday' | 'Federal Holiday' | 'School Holiday';
}

export const PREDEFINED_CANADIAN_HOLIDAYS: StatHolidayItem[] = [
  { date: '2026-01-01', name: "New Year's Day", type: 'Statutory Holiday' },
  { date: '2026-02-16', name: 'Family Day', type: 'Statutory Holiday' },
  { date: '2026-04-03', name: 'Good Friday', type: 'Statutory Holiday' },
  { date: '2026-04-06', name: 'Easter Monday', type: 'School Holiday' },
  { date: '2026-05-18', name: 'Victoria Day', type: 'Statutory Holiday' },
  { date: '2026-07-01', name: 'Canada Day', type: 'Statutory Holiday' },
  { date: '2026-08-03', name: 'Civic Holiday', type: 'Public Holiday' },
  { date: '2026-09-07', name: 'Labour Day', type: 'Statutory Holiday' },
  { date: '2026-09-30', name: 'National Day for Truth and Reconciliation', type: 'Federal Holiday' },
  { date: '2026-10-12', name: 'Thanksgiving Day (10-12 Holiday)', type: 'Statutory Holiday' },
  { date: '2026-11-11', name: 'Remembrance Day', type: 'Federal Holiday' },
  { date: '2026-12-25', name: 'Christmas Day', type: 'Statutory Holiday' },
  { date: '2026-12-26', name: 'Boxing Day', type: 'Statutory Holiday' },
];

/**
 * Rounds a dollar amount safely to 2 decimal places preventing floating-point accumulation bugs.
 */
export function roundToCurrency(val: number): number {
  if (isNaN(val) || !isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates hourly pay rate preventing divide-by-zero or negative hours.
 */
export function calculateHourlyRate(payAmount: number, eiHours: number): number {
  if (eiHours <= 0 || isNaN(payAmount) || isNaN(eiHours)) {
    return 0;
  }
  return roundToCurrency(payAmount / eiHours);
}

/**
 * Filters predefined holidays falling within [startDate, endDate].
 */
export function getHolidaysInPeriod(
  startDate: string,
  endDate: string,
  holidays: StatHolidayItem[] = PREDEFINED_CANADIAN_HOLIDAYS
): StatHolidayItem[] {
  if (!startDate || !endDate) return [];
  return holidays.filter((h) => h.date >= startDate && h.date <= endDate);
}

/**
 * Aggregates a driver's shifts and approved expense claims for a payroll period.
 */
export function calculateEmployeePayrollTotals(
  shifts: ShiftPayrollItem[] = [],
  approvedExpensesAmount: number = 0,
  includeHolidayCredit: boolean = true
): EmployeePayrollTotals {
  let regularRuns = 0;
  let regularHours = 0;
  let regularPay = 0;
  let holidayRuns = 0;
  let holidayPay = 0;

  for (const s of shifts) {
    if (s.payOption === 'NP') continue; // No Pay shift

    const amount = Number(s.payAmount) || 0;
    const hours = Number(s.eiHours) || 0;

    if (s.isHolidayCredit) {
      if (includeHolidayCredit) {
        holidayRuns += 1;
        holidayPay += amount;
      }
    } else {
      regularRuns += 1;
      regularHours += hours;
      regularPay += amount;
    }
  }

  const safeExpenses = Math.max(0, Number(approvedExpensesAmount) || 0);
  const totalRuns = regularRuns + (includeHolidayCredit ? holidayRuns : 0);
  const totalEiHours = roundToCurrency(regularHours);
  const totalWages = roundToCurrency(regularPay + (includeHolidayCredit ? holidayPay : 0));
  const netPayout = roundToCurrency(totalWages + safeExpenses);

  return {
    regularRuns,
    regularHours: roundToCurrency(regularHours),
    regularPay: roundToCurrency(regularPay),
    holidayRuns: includeHolidayCredit ? holidayRuns : 0,
    holidayPay: includeHolidayCredit ? roundToCurrency(holidayPay) : 0,
    totalRuns,
    totalEiHours,
    totalWages,
    approvedExpenses: roundToCurrency(safeExpenses),
    netPayout,
  };
}
