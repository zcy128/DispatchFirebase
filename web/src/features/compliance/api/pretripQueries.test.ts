import { describe, expect, it } from 'vitest';
import { complianceKeys } from './pretripQueries';

describe('pretripQueries', () => {
  it('builds deterministic query keys per date', () => {
    expect(complianceKeys.all).toEqual(['compliance']);
    expect(complianceKeys.pretrip('2026-11-18')).toEqual([
      'compliance',
      'pretrip',
      '2026-11-18',
    ]);
  });
});
