import { describe, it, expect } from 'vitest';
import { isOpeningExpired } from './routeOpeningDisplay';
import { RouteOpening } from '../types/routeOpening';

describe('isOpeningExpired', () => {
  const baseOpening: RouteOpening = {
    id: 'RO-1',
    title: 'Test Opening',
    routeId: 'RT-1',
    routeNo: '101',
    postingType: 'permanent',
    roleNeeded: 'driver',
    effectiveStartDate: '2026-11-20',
    shiftType: 'ALL',
    deadline: '2026-11-19T23:59:59Z',
    status: 'open',
    applicants: [],
    createdBy: 'Admin',
    createdAt: '2026-11-12T00:00:00Z',
    updatedAt: '2026-11-12T00:00:00Z',
  };

  const todayStr = '2026-11-12';
  const nowMs = new Date('2026-11-12T12:00:00Z').getTime();

  it('returns false for active future opening', () => {
    expect(isOpeningExpired(baseOpening, todayStr, nowMs)).toBe(false);
  });

  it('returns true when status is cancelled', () => {
    const cancelled = { ...baseOpening, status: 'cancelled' as const };
    expect(isOpeningExpired(cancelled, todayStr, nowMs)).toBe(true);
  });

  it('returns true when deadline is in the past', () => {
    const pastDeadline = { ...baseOpening, deadline: '2026-11-10T12:00:00Z' };
    expect(isOpeningExpired(pastDeadline, todayStr, nowMs)).toBe(true);
  });

  it('returns true when effectiveEndDate is in the past', () => {
    const pastCoverage = {
      ...baseOpening,
      postingType: 'temporary' as const,
      effectiveStartDate: '2026-11-01',
      effectiveEndDate: '2026-11-10',
      deadline: '2026-11-25T12:00:00Z',
    };
    expect(isOpeningExpired(pastCoverage, todayStr, nowMs)).toBe(true);
  });

  it('returns true for charter trip when trip date is in the past', () => {
    const pastCharter = {
      ...baseOpening,
      postingType: 'charter' as const,
      effectiveStartDate: '2026-11-05',
      deadline: '2026-11-25T12:00:00Z',
    };
    expect(isOpeningExpired(pastCharter, todayStr, nowMs)).toBe(true);
  });

  it('returns false when deadline is in the future on the same day', () => {
    const laterToday = {
      ...baseOpening,
      deadline: '2026-11-12T18:00:00Z',
    };
    expect(isOpeningExpired(laterToday, todayStr, nowMs)).toBe(false);
  });
});
