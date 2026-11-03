import { describe, expect, it } from 'vitest';
import {
  calculateEmployeePayrollTotals,
  calculateHourlyRate,
  getHolidaysInPeriod,
  roundToCurrency,
  ShiftPayrollItem,
} from './payrollCalculator';

describe('roundToCurrency', () => {
  it('correctly rounds floating point numbers to 2 decimals without drift', () => {
    expect(roundToCurrency(10.005)).toBe(10.01);
    expect(roundToCurrency(28.5)).toBe(28.5);
    expect(roundToCurrency(0.1 + 0.2)).toBe(0.3);
    expect(roundToCurrency(NaN)).toBe(0);
    expect(roundToCurrency(Infinity)).toBe(0);
  });
});

describe('calculateHourlyRate', () => {
  it('calculates hourly rate for normal hours and wages', () => {
    expect(calculateHourlyRate(60.0, 2.5)).toBe(24.0);
    expect(calculateHourlyRate(28.5, 2.0)).toBe(14.25);
  });

  it('safely returns 0 when eiHours is zero or negative', () => {
    expect(calculateHourlyRate(50.0, 0)).toBe(0);
    expect(calculateHourlyRate(50.0, -2.5)).toBe(0);
    expect(calculateHourlyRate(NaN, 2.5)).toBe(0);
  });
});

describe('getHolidaysInPeriod', () => {
  it('identifies statutory holidays falling within a 2-week period', () => {
    // Thanksgiving period (Oct 5 to Oct 18, 2026)
    const holidays = getHolidaysInPeriod('2026-10-05', '2026-10-18');
    expect(holidays.length).toBe(1);
    expect(holidays[0].date).toBe('2026-10-12');
    expect(holidays[0].name).toContain('Thanksgiving');
  });

  it('returns empty array when no holidays exist in period or dates are empty', () => {
    expect(getHolidaysInPeriod('2026-06-01', '2026-06-14')).toEqual([]);
    expect(getHolidaysInPeriod('', '')).toEqual([]);
  });
});

describe('calculateEmployeePayrollTotals', () => {
  const shifts: ShiftPayrollItem[] = [
    {
      id: 'shift-1',
      dispatchDate: '2026-10-05',
      routeNo: 'OCDSB-001',
      shiftType: 'AM',
      payAmount: 28.5,
      eiHours: 2.5,
      payOption: 'STANDARD',
    },
    {
      id: 'shift-2',
      dispatchDate: '2026-10-05',
      routeNo: 'OCDSB-001',
      shiftType: 'PM',
      payAmount: 28.5,
      eiHours: 2.5,
      payOption: 'STANDARD',
    },
    {
      id: 'shift-np',
      dispatchDate: '2026-10-06',
      routeNo: 'OCDSB-001',
      shiftType: 'MIDDAY',
      payAmount: 0,
      eiHours: 1.0,
      payOption: 'NP', // No pay shift
    },
    {
      id: 'shift-holiday',
      dispatchDate: '2026-10-12',
      routeNo: 'OCDSB-001',
      shiftType: 'AM',
      payAmount: 28.5,
      eiHours: 2.5,
      isHolidayCredit: true,
    },
  ];

  it('aggregates standard shifts, holiday credits, and expense claims accurately', () => {
    const totals = calculateEmployeePayrollTotals(shifts, 45.2, true);

    expect(totals.regularRuns).toBe(2);
    expect(totals.regularHours).toBe(5.0);
    expect(totals.regularPay).toBe(57.0);

    expect(totals.holidayRuns).toBe(1);
    expect(totals.holidayPay).toBe(28.5);

    expect(totals.totalRuns).toBe(3);
    expect(totals.totalWages).toBe(85.5);
    expect(totals.approvedExpenses).toBe(45.2);
    expect(totals.netPayout).toBe(130.7); // 85.50 + 45.20
  });

  it('can toggle holiday entitlement off when policy dictates', () => {
    const totals = calculateEmployeePayrollTotals(shifts, 10.0, false);

    expect(totals.regularRuns).toBe(2);
    expect(totals.holidayRuns).toBe(0);
    expect(totals.holidayPay).toBe(0);
    expect(totals.totalWages).toBe(57.0);
    expect(totals.netPayout).toBe(67.0); // 57.00 + 10.00
  });

  it('handles empty shifts gracefully', () => {
    const totals = calculateEmployeePayrollTotals([], 0);
    expect(totals.totalRuns).toBe(0);
    expect(totals.totalWages).toBe(0);
    expect(totals.netPayout).toBe(0);
  });
});
