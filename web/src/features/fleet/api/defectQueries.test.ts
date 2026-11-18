import { describe, expect, it } from 'vitest';
import { buildDefectListParams, fleetKeys } from './defectQueries';

describe('defectQueries', () => {
  it('builds deterministic query keys for defects', () => {
    expect(fleetKeys.defects('6months', '')).toEqual(['fleet', 'defects', '6months', '']);
    expect(fleetKeys.defects('all', ' 104 ')).toEqual(['fleet', 'defects', 'all', '104']);
  });

  it('builds listDefects params with optional trimmed query', () => {
    expect(buildDefectListParams('1year', '')).toEqual({ timeRange: '1year' });
    expect(buildDefectListParams('all', '  BUS-22 ')).toEqual({
      timeRange: 'all',
      vehicleUnit: 'BUS-22',
      query: 'BUS-22',
    });
  });
});
