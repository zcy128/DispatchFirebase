import { describe, it, expect } from 'vitest';
import {
  resolveBiweeklyPayPeriod,
  roundCurrencyHalfUp,
  canManageExpensePolicyGroup,
  canManageBiweeklyPayrollConfig,
} from './biweeklyPeriodUtils';

describe('biweeklyPeriodUtils', () => {
  it('resolves fixed bi-weekly pay periods around anchor date', () => {
    expect(resolveBiweeklyPayPeriod('2026-01-04', '2026-01-04')).toEqual({
      startDate: '2026-01-04',
      endDate: '2026-01-17',
    });
    expect(resolveBiweeklyPayPeriod('2026-01-17', '2026-01-04')).toEqual({
      startDate: '2026-01-04',
      endDate: '2026-01-17',
    });
    expect(resolveBiweeklyPayPeriod('2026-01-18', '2026-01-04')).toEqual({
      startDate: '2026-01-18',
      endDate: '2026-01-31',
    });
    expect(resolveBiweeklyPayPeriod('2026-01-03', '2026-01-04')).toEqual({
      startDate: '2025-12-21',
      endDate: '2026-01-03',
    });
  });

  it('rounds currency amounts half-up to 2 decimal places', () => {
    expect(roundCurrencyHalfUp(10.005)).toBe(10.01);
    expect(roundCurrencyHalfUp(19.994)).toBe(19.99);
    expect(roundCurrencyHalfUp(20)).toBe(20);
  });

  it('enforces strict HR vs Fleet group isolation', () => {
    expect(canManageExpensePolicyGroup('admin', 'hr')).toBe(true);
    expect(canManageExpensePolicyGroup('admin', 'fleet')).toBe(true);
    expect(canManageExpensePolicyGroup('HR', 'hr')).toBe(true);
    expect(canManageExpensePolicyGroup('HR', 'fleet')).toBe(false);
    expect(canManageExpensePolicyGroup('fleet', 'fleet')).toBe(true);
    expect(canManageExpensePolicyGroup('fleet', 'hr')).toBe(false);
    expect(canManageExpensePolicyGroup('driver', 'hr')).toBe(false);
  });

  it('restricts biweekly payroll config management to admin and payroll', () => {
    expect(canManageBiweeklyPayrollConfig('admin')).toBe(true);
    expect(canManageBiweeklyPayrollConfig('payroll')).toBe(true);
    expect(canManageBiweeklyPayrollConfig('HR')).toBe(false);
    expect(canManageBiweeklyPayrollConfig('fleet')).toBe(false);
  });
});
