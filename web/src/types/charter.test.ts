import { describe, expect, it } from 'vitest';
import {
  addMinutesToCharterTime,
  buildCharterSimpleStops,
  CharterAssignment,
  extractAssignedEmployeeIds,
  formatCharterStopTime,
  getCharterAssignmentStatusLabel,
  getCharterTripStatusLabel,
  getCharterTripTypeLabel,
} from './charter';

describe('extractAssignedEmployeeIds', () => {
  it('extracts unique valid employee IDs and names while ignoring unassigned placeholders', () => {
    const assignments: CharterAssignment[] = [
      {
        id: 'asg-1',
        charterTripId: 'trip-1',
        vehicleId: 101,
        vehicleUnitNumber: 'BUS-1',
        driverId: 'EMP-2001',
        driverName: 'Alice Driver',
        attendantId: '0',
        attendantName: 'TBD',
        driverPayRate: 150,
        driverEiHours: 5,
        attendantPayRate: 0,
        attendantEiHours: 0,
        status: 0,
        isDriverCheckedIn: false,
        isAttendantCheckedIn: false,
      },
      {
        id: 'asg-2',
        charterTripId: 'trip-1',
        vehicleId: 102,
        vehicleUnitNumber: 'BUS-2',
        driverId: 'unassigned',
        driverName: 'Unassigned',
        attendantId: 'ATT-3001',
        attendantName: 'Bob Monitor',
        driverPayRate: 150,
        driverEiHours: 5,
        attendantPayRate: 100,
        attendantEiHours: 5,
        status: 0,
        isDriverCheckedIn: false,
        isAttendantCheckedIn: false,
      },
    ];

    const ids = extractAssignedEmployeeIds(assignments);

    expect(ids).toContain('EMP-2001');
    expect(ids).toContain('emp-2001');
    expect(ids).toContain('Alice Driver');
    expect(ids).toContain('ATT-3001');
    expect(ids).toContain('Bob Monitor');

    expect(ids).not.toContain('0');
    expect(ids).not.toContain('tbd');
    expect(ids).not.toContain('unassigned');
  });

  it('handles empty or undefined assignments safely', () => {
    expect(extractAssignedEmployeeIds([])).toEqual([]);
    expect(extractAssignedEmployeeIds(undefined)).toEqual([]);
  });
});

describe('Charter Status & Type Labels (Bilingual)', () => {
  it('maps charter trip statuses to English and French labels', () => {
    expect(getCharterTripStatusLabel(0, false)).toBe('Draft');
    expect(getCharterTripStatusLabel(0, true)).toBe('Brouillon');

    expect(getCharterTripStatusLabel(1, false)).toBe('Confirmed');
    expect(getCharterTripStatusLabel(1, true)).toBe('Confirmé');

    expect(getCharterTripStatusLabel(3, false)).toBe('In Progress');
    expect(getCharterTripStatusLabel(3, true)).toBe('En cours');

    expect(getCharterTripStatusLabel(4, false)).toBe('Completed');
    expect(getCharterTripStatusLabel(4, true)).toBe('Terminé');
  });

  it('maps charter trip types and assignment statuses', () => {
    expect(getCharterTripTypeLabel(0, false)).toBe('Field Trip');
    expect(getCharterTripTypeLabel(0, true)).toBe('Sortie éducative');

    expect(getCharterAssignmentStatusLabel(1, false)).toBe('Checked In');
    expect(getCharterAssignmentStatusLabel(1, true)).toBe('Pointé (Arrivée)');
  });
});

describe('formatCharterStopTime & addMinutesToCharterTime', () => {
  it('formats ISO datetime strings or raw time strings to HH:MM', () => {
    expect(formatCharterStopTime('2026-11-03T08:30:00')).toBe('08:30');
    expect(formatCharterStopTime('2026-11-03 14:15')).toBe('14:15');
    expect(formatCharterStopTime('09:45')).toBe('09:45');
    expect(formatCharterStopTime('')).toBe('');
  });

  it('adds minutes correctly across daytime and midnight rollover', () => {
    expect(addMinutesToCharterTime('08:15', 30)).toBe('08:45');
    expect(addMinutesToCharterTime('08:45', 30)).toBe('09:15');
    expect(addMinutesToCharterTime('23:45', 30)).toBe('00:15');

    // ISO string calculation
    const isoResult = addMinutesToCharterTime('2026-11-03T08:00', 45);
    expect(isoResult).toBe('2026-11-03T08:45');
  });
});

describe('buildCharterSimpleStops', () => {
  it('generates standard 4-stop itinerary for round trips', () => {
    const stops = buildCharterSimpleStops({
      tripId: 'TRIP-100',
      fromAddress: 'Lisgar Collegiate Institute',
      toAddress: 'Canada Science and Technology Museum',
      roundTrip: true,
      departsAt: '2026-11-03T08:30',
      returnsAt: '2026-11-03T14:30',
    });

    expect(stops.length).toBe(4);

    // Stop 1: Outbound Pickup
    expect(stops[0].sequenceOrder).toBe(1);
    expect(stops[0].stopType).toBe(0);
    expect(stops[0].address).toBe('Lisgar Collegiate Institute');
    expect(stops[0].scheduledAt).toBe('2026-11-03T08:30');

    // Stop 2: Outbound Dropoff at Museum (+30m default)
    expect(stops[1].sequenceOrder).toBe(2);
    expect(stops[1].stopType).toBe(1);
    expect(stops[1].address).toBe('Canada Science and Technology Museum');
    expect(stops[1].scheduledAt).toBe('2026-11-03T09:00');

    // Stop 3: Return Pickup at Museum
    expect(stops[2].sequenceOrder).toBe(3);
    expect(stops[2].stopType).toBe(3);
    expect(stops[2].address).toBe('Canada Science and Technology Museum');
    expect(stops[2].scheduledAt).toBe('2026-11-03T14:30');

    // Stop 4: Return Dropoff at School (+30m default)
    expect(stops[3].sequenceOrder).toBe(4);
    expect(stops[3].stopType).toBe(2);
    expect(stops[3].address).toBe('Lisgar Collegiate Institute');
    expect(stops[3].scheduledAt).toBe('2026-11-03T15:00');
  });

  it('generates 2-stop itinerary for one-way trips', () => {
    const stops = buildCharterSimpleStops({
      tripId: 'TRIP-ONEWAY',
      fromAddress: 'School',
      toAddress: 'Camp',
      roundTrip: false,
      departsAt: '2026-11-03T09:00',
      returnsAt: '2026-11-03T10:00',
    });

    expect(stops.length).toBe(2);
    expect(stops[0].stopType).toBe(0); // Pickup
    expect(stops[1].stopType).toBe(1); // Dropoff
  });
});
