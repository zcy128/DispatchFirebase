import { describe, it, expect } from 'vitest';
import { getPageDisplayLabel } from './AIContext';

describe('AIContext page display labels', () => {
  it('maps core dispatch and route tabs to clear display titles', () => {
    expect(getPageDisplayLabel('dispatch')).toBe('Dispatch Workbench');
    expect(getPageDisplayLabel('routes')).toBe('Routes');
    expect(getPageDisplayLabel('biweekly_payroll')).toBe('Bi-Weekly Payroll');
    expect(getPageDisplayLabel('vehicles')).toBe('Fleet & Vehicles');
  });

  it('falls back to raw tab key for unknown tabs', () => {
    expect(getPageDisplayLabel('custom_view')).toBe('custom_view');
  });
});
