import { describe, expect, it } from 'vitest';
import { reorderStopsAndUpdateSequence } from './routeOptimizer';
import type { RouteStop } from '../types/route';

function makeStop(overrides: Partial<RouteStop>): RouteStop {
  return {
    stopId: 1,
    sequence: 1,
    stopLocation: '100 Main St',
    stopType: 'HomePickup',
    pullawayTime: '07:30',
    latitude: 45.35,
    longitude: -75.76,
    assignedStudents: [],
    ...overrides,
  } as RouteStop;
}

describe('reorderStopsAndUpdateSequence', () => {
  const stops: RouteStop[] = [
    makeStop({
      stopId: 101,
      sequence: 1,
      stopLocation: 'Stop A (Parent wants later pickup)',
      latitude: 45.34,
      longitude: -75.78,
      pullawayTime: '07:45',
    }),
    makeStop({
      stopId: 102,
      sequence: 2,
      stopLocation: 'Stop B',
      latitude: 45.36,
      longitude: -75.75,
      pullawayTime: '07:55',
    }),
    makeStop({
      stopId: 103,
      sequence: 3,
      stopLocation: 'Stop C',
      latitude: 45.38,
      longitude: -75.72,
      pullawayTime: '08:05',
    }),
    makeStop({
      stopId: 104,
      sequence: 4,
      stopLocation: 'Hillcrest High School',
      stopType: 'SchoolDropoff',
      schoolName: 'Hillcrest High School',
      latitude: 45.405,
      longitude: -75.642,
      pullawayTime: '08:30',
    }),
  ];

  it('moves an early student stop later and recalculates times backward from school anchor', () => {
    // Move Stop A (index 0) to right before SchoolDropoff (index 2)
    const reordered = reorderStopsAndUpdateSequence(stops, 0, 2, {
      recalculateTimes: true,
      dwellMinutes: 3,
      speedKmH: 30,
      shiftType: 'AM',
    });

    expect(reordered.map((s) => s.stopId)).toEqual([102, 103, 101, 104]);
    expect(reordered.map((s) => s.sequence)).toEqual([1, 2, 3, 4]);

    // School dropoff remains anchored at 08:30
    expect(reordered[3].pullawayTime).toBe('08:30');
    // Stop A (now stop #3 right before school) has a later pickup time than Stop B (#1)
    expect(reordered[2].pullawayTime > reordered[0].pullawayTime).toBe(true);
  });

  it('re-indexes sequence without modifying times when recalculateTimes is false', () => {
    const reordered = reorderStopsAndUpdateSequence(stops, 2, 0, {
      recalculateTimes: false,
    });

    expect(reordered.map((s) => s.stopId)).toEqual([103, 101, 102, 104]);
    expect(reordered.map((s) => s.sequence)).toEqual([1, 2, 3, 4]);
    expect(reordered[0].pullawayTime).toBe('08:05');
  });

  it('returns the original array untouched for out-of-bounds or no-op indices', () => {
    expect(reorderStopsAndUpdateSequence(stops, 1, 1)).toBe(stops);
    expect(reorderStopsAndUpdateSequence(stops, -1, 2)).toBe(stops);
    expect(reorderStopsAndUpdateSequence(stops, 0, 99)).toBe(stops);
  });

  it('strips undefined fields from stops for Firestore compatibility', () => {
    const withUndef = [
      makeStop({ stopId: 1, sequence: 1, instruction: undefined }),
      makeStop({ stopId: 2, sequence: 2 }),
    ];
    const reordered = reorderStopsAndUpdateSequence(withUndef, 0, 1, {
      recalculateTimes: false,
    });
    expect('instruction' in reordered[1]).toBe(false);
  });
});
