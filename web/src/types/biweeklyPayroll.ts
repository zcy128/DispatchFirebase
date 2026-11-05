import { PayrollDepartmentLogRecord } from './dispatch';
import { ExpenseReimbursement } from './expenseReimbursement';

/** One grouped route & rate line for an employee */
export interface BiweeklyRouteRateRow {
  routeNo: string;
  payRate: number;
  eiHours: number;
  hourlyRate: number;
  week1Runs: number;
  week1Pay: number;
  week2Runs: number;
  week2Pay: number;
  totalRuns: number;
  subTotalPay: number;
  week1Hours: number;
  week2Hours: number;
  subTotalHours: number;
  holidayRuns: number;
  holidayPay: number;
  holidayNote?: string;
}

/** Summary of approved expenses for an employee */
export interface EmployeeExpenseSummary {
  totalAmount: number;
  byCategory: Record<
    string,
    {
      code: string;
      label: string;
      amount: number;
      count: number;
    }
  >;
  claimsCount: number;
  claims: ExpenseReimbursement[];
}

/** Grouped bi-weekly payroll data for one employee */
export interface BiweeklyEmployeeGroup {
  employeeId: string;
  employeeName: string;
  schoolBoardCode?: string;
  rows: BiweeklyRouteRateRow[];
  totalWeek1Runs: number;
  totalWeek1Pay: number;
  totalWeek1Hours: number;
  totalWeek2Runs: number;
  totalWeek2Pay: number;
  totalWeek2Hours: number;
  grandTotalRuns: number;
  grandTotalPay: number;
  grandTotalHours: number;
  totalHolidayRuns: number;
  totalHolidayPay: number;
  expenses: EmployeeExpenseSummary;
  totalPayout: number;
  dailyRecords: PayrollDepartmentLogRecord[];
}
