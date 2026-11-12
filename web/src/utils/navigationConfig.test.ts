import { describe, it, expect } from 'vitest';
import {
  NAV_DOMAINS,
  getDomainForTab,
  getDefaultTabForDomain,
  getAccessibleDomains
} from './navigationConfig';
import { SYSTEM_PAGES } from './permissions';
import { AuthUser } from '../types/employee';

const mockAdminUser: AuthUser = {
  uid: 'admin-1',
  email: 'admin@pcytech.com',
  displayName: 'Admin User',
  role: 'admin'
};

describe('navigationConfig (Hybrid Navigation Architecture)', () => {
  it('maps every SYSTEM_PAGES tab to one of the 5 top-level domains without duplicates', () => {
    const allDomainTabs = NAV_DOMAINS.flatMap((d) => d.tabs);
    const uniqueDomainTabs = new Set(allDomainTabs);

    expect(uniqueDomainTabs.size).toBe(allDomainTabs.length);

    for (const page of SYSTEM_PAGES) {
      expect(uniqueDomainTabs.has(page.id)).toBe(true);
    }
  });

  it('resolves the owning domain for individual tabs accurately', () => {
    expect(getDomainForTab('dashboard')).toBe('dispatch_ops');
    expect(getDomainForTab('dispatch')).toBe('dispatch_ops');
    expect(getDomainForTab('employees')).toBe('hr_payroll');
    expect(getDomainForTab('payroll')).toBe('hr_payroll');
    expect(getDomainForTab('vehicles')).toBe('fleet');
    expect(getDomainForTab('yards')).toBe('fleet');
    expect(getDomainForTab('students')).toBe('students_safety');
    expect(getDomainForTab('schools')).toBe('students_safety');
    expect(getDomainForTab('settings')).toBe('system');
    expect(getDomainForTab('roles')).toBe('system');
  });

  it('returns the first accessible tab in each domain for an admin user', () => {
    expect(getDefaultTabForDomain('dispatch_ops', mockAdminUser)).toBe('dashboard');
    expect(getDefaultTabForDomain('hr_payroll', mockAdminUser)).toBe('employees');
    expect(getDefaultTabForDomain('fleet', mockAdminUser)).toBe('vehicles');
    expect(getDefaultTabForDomain('students_safety', mockAdminUser)).toBe('compliance');
    expect(getDefaultTabForDomain('system', mockAdminUser)).toBe('company_contacts');
  });

  it('returns all 5 domains for an admin user', () => {
    const domains = getAccessibleDomains(mockAdminUser);
    expect(domains.map((d) => d.id)).toEqual([
      'dispatch_ops',
      'hr_payroll',
      'fleet',
      'students_safety',
      'system'
    ]);
  });
});
