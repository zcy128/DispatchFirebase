import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysToDateString,
  calculateDefaultDeadline,
  safeFormatDate,
} from './dateUtils';

afterEach(() => {
  vi.useRealTimers();
});

describe('addDaysToDateString', () => {
  it('keeps a 14-day period intact across the autumn daylight-saving change', () => {
    expect(addDaysToDateString('2026-10-25', 13)).toBe('2026-11-07');
    expect(addDaysToDateString('2026-10-25', 6)).toBe('2026-10-31');
    expect(addDaysToDateString('2026-10-25', 7)).toBe('2026-11-01');
  });

  it('returns today when the date string is empty', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 10, 0, 0));
    expect(addDaysToDateString('', 3)).toBe('2026-11-02');
    expect(addDaysToDateString('nodate', 3)).toBe('2026-11-02');
  });
});

describe('safeFormatDate', () => {
  it('reads a calendar date from an ISO timestamp without shifting the day', () => {
    expect(safeFormatDate('2026-11-02T21:04:00Z')).toBe('2026-11-02');
  });

  it('formats Date objects, epoch seconds, and Firestore timestamps', () => {
    expect(safeFormatDate(new Date(2026, 10, 2, 15, 0, 0))).toBe('2026-11-02');
    expect(safeFormatDate({ seconds: Date.UTC(2026, 10, 2, 15, 0, 0) / 1000 })).toBe('2026-11-02');
    expect(safeFormatDate({ toDate: () => new Date(2026, 10, 2, 8, 0, 0) })).toBe('2026-11-02');
  });

  it('uses the fallback for empty values', () => {
    expect(safeFormatDate(null)).toBe('-');
    expect(safeFormatDate('')).toBe('-');
    expect(safeFormatDate(undefined, 'n/a')).toBe('n/a');
  });
});

describe('calculateDefaultDeadline', () => {
  it('closes Monday and Sunday coverage on the previous Friday at 14:00', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 10, 0, 0));

    expect(calculateDefaultDeadline('2026-11-09')).toBe('2026-11-06T14:00');
    expect(calculateDefaultDeadline('2026-11-08')).toBe('2026-11-06T14:00');
    expect(calculateDefaultDeadline('2026-11-10')).toBe('2026-11-09T14:00');
  });

  it('uses today at 14:00 before that hour and tomorrow after it when no start date is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 10, 0, 0));
    expect(calculateDefaultDeadline('')).toBe('2026-11-02T14:00');

    vi.setSystemTime(new Date(2026, 10, 2, 15, 0, 0));
    expect(calculateDefaultDeadline('')).toBe('2026-11-03T14:00');
  });
});
