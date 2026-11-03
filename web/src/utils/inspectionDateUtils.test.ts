import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addMonths,
  formatStickerMonth,
  getEndOfMonthDate,
  isDueWithin30Days,
  isOlderThanTwoYears,
  isOverdue,
} from './inspectionDateUtils';

afterEach(() => {
  vi.useRealTimers();
});

describe('inspection sticker dates', () => {
  it('uses the last calendar day of the sticker month, including leap years', () => {
    expect(getEndOfMonthDate('2026-10')).toBe('2026-10-31');
    expect(getEndOfMonthDate('2028-02-15')).toBe('2028-02-29');
    expect(getEndOfMonthDate('')).toBe('');
    expect(formatStickerMonth('2026-10-15')).toBe('10 / OCT 2026');
    expect(formatStickerMonth('')).toBe('N/A');
  });

  it('marks a past sticker overdue and a sticker ending this month as due within 30 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 15, 0, 0));

    expect(isOverdue('2026-10')).toBe(true);
    expect(isDueWithin30Days('2026-10')).toBe(false);
    expect(isOverdue('2026-11')).toBe(false);
    expect(isDueWithin30Days('2026-11')).toBe(true);
    expect(isDueWithin30Days('2026-12')).toBe(false);
  });

  it('archives inspections older than two years', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 15, 0, 0));

    expect(isOlderThanTwoYears('2023-01-01')).toBe(true);
    expect(isOlderThanTwoYears('2026-01-01')).toBe(false);
    expect(isOlderThanTwoYears('')).toBe(false);
  });

  it('adds six months for the next semi-annual inspection', () => {
    expect(addMonths('', 6)).toBe('');
    expect(addMonths('not-a-date', 6)).toBe('not-a-date');
    expect(['2026-07-14', '2026-07-15']).toContain(addMonths('2026-01-15', 6));
  });
});
