import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../types/employee';
import {
  canAccessYard,
  canEditPage,
  hasPageAccess,
  normalizeRole,
} from './permissions';

function user(role: string, extra: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: 'u1',
    email: 'user@dispatch.local',
    role,
    ...extra,
  };
}

describe('normalizeRole', () => {
  it('maps office aliases onto the twelve role keys', () => {
    expect(normalizeRole('Administrator')).toBe('admin');
    expect(normalizeRole('mechanic')).toBe('fleet');
    expect(normalizeRole('attendant')).toBe('helper');
    expect(normalizeRole('finance')).toBe('payroll');
    expect(normalizeRole('office_staff')).toBe('office staff');
    expect(normalizeRole('')).toBe('driver');
    expect(normalizeRole(null)).toBe('driver');
  });
});

describe('page access', () => {
  it('lets a driver read contacts and handovers without editing them or opening payroll', () => {
    const driver = user('driver');
    expect(hasPageAccess(driver, 'company_contacts')).toBe(true);
    expect(canEditPage(driver, 'company_contacts')).toBe(false);
    expect(hasPageAccess(driver, 'vehicle_signouts')).toBe(true);
    expect(canEditPage(driver, 'vehicle_signouts')).toBe(false);
    expect(hasPageAccess(driver, 'payroll')).toBe(false);
    expect(canEditPage(driver, 'payroll')).toBe(false);
  });

  it('lets fleet staff edit vehicle handovers and blocks payroll', () => {
    const fleet = user('fleet');
    expect(canEditPage(fleet, 'vehicle_signouts')).toBe(true);
    expect(canEditPage(fleet, 'defects')).toBe(true);
    expect(hasPageAccess(fleet, 'payroll')).toBe(false);
    expect(canEditPage(fleet, 'company_contacts')).toBe(false);
  });

  it('gives admin write access and honors an explicit page override', () => {
    expect(canEditPage(user('admin'), 'payroll')).toBe(true);
    expect(hasPageAccess(null, 'dispatch')).toBe(false);
    expect(canEditPage(user('driver', {
      overrides: { company_contacts: 'readwrite' },
    }), 'company_contacts')).toBe(true);
  });
});

describe('canAccessYard', () => {
  it('limits a supervisor to the assigned yard', () => {
    const supervisor = user('supervisor', { yardId: 'yard-1' });
    expect(canAccessYard(supervisor, 'yard-1')).toBe(true);
    expect(canAccessYard(supervisor, 'YARD-1')).toBe(true);
    expect(canAccessYard(supervisor, 'yard-2')).toBe(false);
    expect(canAccessYard(user('dispatcher'), 'yard-2')).toBe(true);
    expect(canAccessYard(null, 'yard-1')).toBe(false);
  });
});
