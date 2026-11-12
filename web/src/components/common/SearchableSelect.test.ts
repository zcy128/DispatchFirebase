import { describe, expect, it } from 'vitest';
import { filterSearchableOptions, SearchableSelectOption } from './SearchableSelect';

const sampleOptions: SearchableSelectOption[] = [
  {
    value: 'emp-1',
    label: 'Alice Martin (EMP-101)',
    groupLabel: 'Drivers',
    searchText: 'Alice Martin EMP-101 Driver 613-555-0101',
  },
  {
    value: 'emp-2',
    label: 'Bob Tremblay (EMP-204)',
    groupLabel: 'Supervisors & Experienced Cover Staff',
    searchText: 'Bob Tremblay EMP-204 Supervisor Experienced Cover Driver 613-555-0204',
  },
  {
    value: '205',
    label: 'Unit #205 - Thomas C2 (72 Seats)',
    searchText: '205 Thomas Saf-T-Liner C2 ABC123 Yard North Alice Martin',
  },
];

describe('filterSearchableOptions', () => {
  it('returns all options when query is empty or whitespace', () => {
    expect(filterSearchableOptions(sampleOptions, '')).toHaveLength(3);
    expect(filterSearchableOptions(sampleOptions, '   ')).toHaveLength(3);
  });

  it('matches multi-token queries across label and searchText case-insensitively', () => {
    const driverMatch = filterSearchableOptions(sampleOptions, 'bob supervisor');
    expect(driverMatch).toHaveLength(1);
    expect(driverMatch[0].value).toBe('emp-2');

    const unitMatch = filterSearchableOptions(sampleOptions, '205 abc123');
    expect(unitMatch).toHaveLength(1);
    expect(unitMatch[0].value).toBe('205');
  });

  it('returns empty array when any token fails to match', () => {
    expect(filterSearchableOptions(sampleOptions, 'alice xyz999')).toHaveLength(0);
  });
});
