import { describe, expect, it } from 'vitest';
import {
  classifyEmployeeForRole,
  compareCrewPriority,
  groupCrewCandidates,
  sortCrewCandidatesWithPriority,
} from './crewEligibilityUtils';
import { sortAttendantsByDeadhead, sortDriversByDeadhead } from './deadheadCalculator';
import type { Employee } from '../types/employee';
import type { RouteStop } from '../types/route';

function makeEmployee(overrides: Partial<Employee>): Employee {
  return {
    id: 'emp-x',
    employeeId: 'emp-x',
    employeeNumber: 'emp-x',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
    role: 'driver',
    jobPosition: 'School Bus Driver',
    isActive: true,
    ...overrides,
  } as Employee;
}

describe('crewEligibilityUtils', () => {
  const regularDriver = makeEmployee({
    id: 'drv-1',
    firstName: 'Alice',
    lastName: 'Driver',
    fullName: 'Alice Driver',
    role: 'driver',
    jobPosition: 'School Bus Driver',
    lat: 45.42, // farther from stop
    lng: -75.69,
  });

  const supervisor = makeEmployee({
    id: 'sup-1',
    firstName: 'Bob',
    lastName: 'Supervisor',
    fullName: 'Bob Supervisor',
    role: 'supervisor',
    jobPosition: 'Operations Supervisor',
    lat: 45.38,
    lng: -75.72,
  });

  const expCoverDriverOffice = makeEmployee({
    id: 'off-drv',
    firstName: 'Clara',
    lastName: 'OfficeExpDriver',
    fullName: 'Clara OfficeExpDriver',
    role: 'staff',
    jobPosition: 'Office Administrator',
    hasCoveredAsDriver: true,
    hasCoveredAsAttendant: false,
    lat: 45.37,
    lng: -75.74,
  });

  const expCoverAttendantOffice = makeEmployee({
    id: 'off-att',
    firstName: 'Dan',
    lastName: 'OfficeExpAttendant',
    fullName: 'Dan OfficeExpAttendant',
    role: 'dispatcher',
    jobPosition: 'Office Coordinator',
    hasCoveredAsDriver: false,
    hasCoveredAsAttendant: true,
    lat: 45.3511, // closest to stop
    lng: -75.7601,
  });

  const regularAttendant = makeEmployee({
    id: 'att-1',
    firstName: 'Eva',
    lastName: 'Attendant',
    fullName: 'Eva Attendant',
    role: 'helper',
    jobPosition: 'Bus Attendant / Monitor',
    lat: 45.42,
    lng: -75.69,
  });

  const inexperiencedOffice = makeEmployee({
    id: 'off-none',
    firstName: 'Frank',
    lastName: 'OfficeNone',
    fullName: 'Frank OfficeNone',
    role: 'staff',
    jobPosition: 'Office Clerk',
    hasCoveredAsDriver: false,
    hasCoveredAsAttendant: false,
    lat: 45.351, // very close to stop
    lng: -75.76,
  });

  const stops: RouteStop[] = [
    {
      id: 'stop-1',
      stopId: 1,
      sequence: 1,
      stopLocation: 'Baseline & Woodroffe',
      latitude: 45.3512,
      longitude: -75.7602,
      schoolName: 'Hillcrest High',
      pullawayTime: '07:30',
      stopType: 'HomePickup',
    } as unknown as RouteStop,
    {
      id: 'stop-2',
      stopId: 2,
      sequence: 2,
      stopLocation: 'Hillcrest High',
      latitude: 45.405,
      longitude: -75.642,
      schoolName: 'Hillcrest High',
      pullawayTime: '08:15',
      stopType: 'SchoolDropoff',
    } as unknown as RouteStop,
  ];

  it('classifies driver candidates into Tier 1 (regular), Tier 2 (supervisor & experienced cover office), Tier 3 (inexperienced office / attendant)', () => {
    expect(classifyEmployeeForRole(regularDriver, 'driver').tier).toBe(1);
    expect(classifyEmployeeForRole(supervisor, 'driver').tier).toBe(2);
    expect(classifyEmployeeForRole(expCoverDriverOffice, 'driver').tier).toBe(2);
    expect(classifyEmployeeForRole(expCoverDriverOffice, 'driver').hasCoverExperience).toBe(true);
    expect(classifyEmployeeForRole(inexperiencedOffice, 'driver').tier).toBe(3);
    expect(classifyEmployeeForRole(inexperiencedOffice, 'driver').isQualifiedRelief).toBe(false);
    expect(classifyEmployeeForRole(regularAttendant, 'driver').tier).toBe(3);
  });

  it('classifies attendant candidates into Tier 1 (regular attendant), Tier 2 (supervisor & experienced cover attendant), Tier 3 (others)', () => {
    expect(classifyEmployeeForRole(regularAttendant, 'attendant').tier).toBe(1);
    expect(classifyEmployeeForRole(supervisor, 'attendant').tier).toBe(2);
    expect(classifyEmployeeForRole(expCoverAttendantOffice, 'attendant').tier).toBe(2);
    expect(classifyEmployeeForRole(expCoverDriverOffice, 'attendant').tier).toBe(3);
    expect(classifyEmployeeForRole(regularDriver, 'attendant').tier).toBe(3);
    expect(classifyEmployeeForRole(inexperiencedOffice, 'attendant').tier).toBe(3);
  });

  it('ranks driver candidates: Regular Drivers > Experienced Cover Office / Supervisors > Inexperienced Office / Attendants', () => {
    const unordered = [
      inexperiencedOffice,
      regularAttendant,
      supervisor,
      expCoverDriverOffice,
      regularDriver,
    ];
    const sorted = [...unordered].sort((a, b) => compareCrewPriority(a, b, 'driver'));

    expect(sorted[0].id).toBe('drv-1');
    // Tier 2: experienced cover office & supervisor before Tier 3; within Tier 2 hasCoverExperience comes first
    expect(sorted[1].id).toBe('off-drv');
    expect(sorted[2].id).toBe('sup-1');
    // Tier 3 at the bottom
    expect(sorted.slice(3).map((e) => e.id)).toContain('off-none');
    expect(sorted.slice(3).map((e) => e.id)).toContain('att-1');
  });

  it('ranks attendant candidates: Regular Attendants > Experienced Cover Attendant Office / Supervisors > Others', () => {
    const unordered = [
      regularDriver,
      inexperiencedOffice,
      supervisor,
      expCoverAttendantOffice,
      regularAttendant,
    ];
    const sorted = [...unordered].sort((a, b) => compareCrewPriority(a, b, 'attendant'));

    expect(sorted[0].id).toBe('att-1');
    expect(sorted[1].id).toBe('off-att');
    expect(sorted[2].id).toBe('sup-1');
    expect(sorted.slice(3).map((e) => e.id)).toContain('drv-1');
    expect(sorted.slice(3).map((e) => e.id)).toContain('off-none');
  });

  it('preserves Tier 1 > Tier 2 > Tier 3 priority in deadhead sorting even when Tier 3 lives closer', () => {
    const candidates = [inexperiencedOffice, expCoverDriverOffice, supervisor, regularDriver];
    const rankedDrivers = sortDriversByDeadhead(candidates, stops);

    expect(rankedDrivers[0].employee.id).toBe('drv-1'); // Tier 1 even though farther
    const tier2Ids = rankedDrivers.slice(1, 3).map((r) => r.employee.id);
    expect(tier2Ids).toContain('off-drv');
    expect(tier2Ids).toContain('sup-1');
    // Within Tier 2, candidates are ordered by shortest total deadhead distance
    expect(rankedDrivers[1].deadhead.totalDeadheadKm).toBeLessThanOrEqual(
      rankedDrivers[2].deadhead.totalDeadheadKm
    );
    expect(rankedDrivers[3].employee.id).toBe('off-none'); // Tier 3 stays last despite closest GPS
    expect(rankedDrivers[3].deadhead.totalDeadheadKm).toBeLessThan(
      rankedDrivers[0].deadhead.totalDeadheadKm
    );

    const attCandidates = [inexperiencedOffice, supervisor, expCoverAttendantOffice, regularAttendant];
    const rankedAttendants = sortAttendantsByDeadhead(attCandidates, regularDriver, stops);
    expect(rankedAttendants[0].employee.id).toBe('att-1');
    const attTier2Ids = rankedAttendants.slice(1, 3).map((r) => r.employee.id);
    expect(attTier2Ids).toContain('off-att');
    expect(attTier2Ids).toContain('sup-1');
    expect(rankedAttendants[1].deadhead.distanceToDriverKm!).toBeLessThanOrEqual(
      rankedAttendants[2].deadhead.distanceToDriverKm!
    );
    expect(rankedAttendants[3].employee.id).toBe('off-none');
  });

  it('groups candidates cleanly into primary, relief, and other buckets', () => {
    const all = [
      regularDriver,
      supervisor,
      expCoverDriverOffice,
      inexperiencedOffice,
      regularAttendant,
    ];
    const sortedItems = sortCrewCandidatesWithPriority(
      all.map((employee) => ({ employee })),
      'driver'
    );
    const grouped = groupCrewCandidates(sortedItems, 'driver');

    expect(grouped.primary.map((i) => i.employee.id)).toEqual(['drv-1']);
    expect(grouped.relief.map((i) => i.employee.id)).toEqual(['off-drv', 'sup-1']);
    expect(grouped.other.map((i) => i.employee.id)).toEqual(['att-1', 'off-none']);
  });
});
