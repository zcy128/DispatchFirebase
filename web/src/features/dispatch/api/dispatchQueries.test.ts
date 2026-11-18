import { describe, expect, it } from 'vitest';
import { dispatchKeys, normalizeChangeLogFilters } from './dispatchQueries';

describe('dispatchQueries', () => {
  it('normalizes empty filter objects to undefined', () => {
    expect(normalizeChangeLogFilters(undefined)).toBeUndefined();
    expect(normalizeChangeLogFilters({})).toBeUndefined();
    expect(normalizeChangeLogFilters({ routeNo: '', employee: '', scope: '' })).toBeUndefined();
    expect(normalizeChangeLogFilters({ routeNo: 'R101' })).toEqual({
      routeNo: 'R101',
      employee: undefined,
      scope: undefined,
    });
  });

  it('builds deterministic query keys for change logs', () => {
    expect(dispatchKeys.changeLogs('2026-11-18')).toEqual([
      'dispatch',
      'change-logs',
      '2026-11-18',
      '',
      '',
      '',
    ]);
    expect(
      dispatchKeys.changeLogs('2026-11-18', { routeNo: 'R101', scope: 'dispatch' })
    ).toEqual(['dispatch', 'change-logs', '2026-11-18', 'R101', '', 'dispatch']);
  });
});
