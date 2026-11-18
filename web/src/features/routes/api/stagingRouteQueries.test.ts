import { describe, expect, it } from 'vitest';
import { StagingRoute } from '../../../services/busplannerService';
import { normalizeStagingRoutesResponse, routeKeys } from './stagingRouteQueries';

describe('stagingRouteQueries', () => {
  it('builds deterministic query keys for staging routes', () => {
    expect(routeKeys.all).toEqual(['routes']);
    expect(routeKeys.staging()).toEqual(['routes', 'staging']);
  });

  it('normalizes staging routes response and falls back to routes length', () => {
    const mockRoutes = [{ id: 'r1' }, { id: 'r2' }] as StagingRoute[];
    const normalized = normalizeStagingRoutesResponse({
      routes: mockRoutes,
      totalShifts: 4,
      totalStops: 12,
      totalStudents: 30,
    });

    expect(normalized.routes).toHaveLength(2);
    expect(normalized.totals).toEqual({
      routes: 2,
      shifts: 4,
      stops: 12,
      students: 30,
    });
  });
});
