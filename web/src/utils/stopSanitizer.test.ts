import { describe, expect, it } from 'vitest';
import { sanitizeStopsForPublicViewing } from './stopSanitizer';
import type { RouteStop } from '../types/route';

describe('stopSanitizer', () => {
  it('strips student identities and private contact details for candidate driver preview', () => {
    const rawStops = [
      {
        stopId: 101,
        sequence: 1,
        stopLocation: '42 Maple Street & Pine',
        pullawayTime: '07:15',
        stopType: 'HomePickup',
        latitude: 45.369,
        longitude: -75.752,
        schoolName: 'Hillcrest High School',
        // Private fields that must be sanitized away
        students: [
          {
            studentId: 1,
            studentName: 'Alice Secret',
            guardianPhone: '613-555-0199',
            specialNeeds: 'Requires wheelchair harness',
          },
        ],
        parentNotes: 'Call before arrival',
      },
      {
        stopId: 102,
        sequence: 2,
        stopLocation: 'Hillcrest High School Dropoff',
        pullawayTime: '08:00',
        stopType: 'SchoolDropoff',
        latitude: 45.405,
        longitude: -75.642,
        schoolName: 'Hillcrest High School',
        students: [],
      },
    ] as unknown as RouteStop[];

    const sanitized = sanitizeStopsForPublicViewing(rawStops, 'Hillcrest High School');

    expect(sanitized.length).toBe(2);

    // Stop 1 checks
    const s1 = sanitized[0] as any;
    expect(s1.stopId).toBe(101);
    expect(s1.sequence).toBe(1);
    expect(s1.stopLocation).toBe('42 Maple Street & Pine');
    expect(s1.stopScheduleTime).toBe('07:15');
    expect(s1.stopType).toBe('HomePickup');
    expect(s1.latitude).toBe(45.369);
    expect(s1.longitude).toBe(-75.752);

    // Verify confidential fields are NOT present in sanitized preview
    expect(s1.students).toBeUndefined();
    expect(s1.parentNotes).toBeUndefined();

    // Stop 2 checks
    const s2 = sanitized[1];
    expect(s2.stopType).toBe('school'); // Recognized as school stop
    expect(s2.schoolName).toBe('Hillcrest High School');
  });

  it('generates fallback coordinates for stops missing direct latitude and longitude', () => {
    const stopsWithoutCoords = [
      {
        id: 'stop-fallback',
        sequence: 1,
        location: 'Baseline & Woodroffe',
        time: '07:30',
        stopType: 'pickup',
      },
    ] as unknown as RouteStop[];

    const sanitized = sanitizeStopsForPublicViewing(stopsWithoutCoords, 'Broadview PS');
    expect(sanitized.length).toBe(1);
    expect(sanitized[0].latitude).toBeCloseTo(45.35125, 2);
    expect(sanitized[0].longitude).toBeCloseTo(-75.76015, 2);
  });

  it('returns empty array when input is null, undefined, or empty', () => {
    expect(sanitizeStopsForPublicViewing([])).toEqual([]);
    expect(sanitizeStopsForPublicViewing(null as any)).toEqual([]);
    expect(sanitizeStopsForPublicViewing(undefined as any)).toEqual([]);
  });
});
