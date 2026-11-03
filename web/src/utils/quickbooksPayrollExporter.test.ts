import { describe, expect, it } from 'vitest';
import {
  escapeCsv,
  toQbDate,
  toQbDuration,
} from './quickbooksPayrollExporter';

describe('quickbooksPayrollExporter Helpers', () => {
  describe('escapeCsv', () => {
    it('wraps string in quotes and doubles inner quotation marks', () => {
      expect(escapeCsv('Standard Route')).toBe('"Standard Route"');
      expect(escapeCsv('Route "Special" AM')).toBe('"Route ""Special"" AM"');
      expect(escapeCsv('Contains, comma')).toBe('"Contains, comma"');
    });

    it('handles numbers, null, and undefined values cleanly', () => {
      expect(escapeCsv(123.45)).toBe('"123.45"');
      expect(escapeCsv(null)).toBe('""');
      expect(escapeCsv(undefined)).toBe('""');
      expect(escapeCsv('')).toBe('""');
    });
  });

  describe('toQbDate', () => {
    it('converts ISO YYYY-MM-DD to QuickBooks MM/DD/YYYY format', () => {
      expect(toQbDate('2026-11-03')).toBe('11/03/2026');
      expect(toQbDate('2026-01-15')).toBe('01/15/2026');
    });

    it('returns raw value if not standard 3-part hyphen format', () => {
      expect(toQbDate('InvalidDate')).toBe('InvalidDate');
      expect(toQbDate('')).toBe('');
    });
  });

  describe('toQbDuration', () => {
    it('converts decimal hours to H:MM duration format for QuickBooks Desktop', () => {
      expect(toQbDuration(2.5)).toBe('2:30');
      expect(toQbDuration(1.25)).toBe('1:15');
      expect(toQbDuration(0.75)).toBe('0:45');
      expect(toQbDuration(4.0)).toBe('4:00');
      expect(toQbDuration(0)).toBe('0:00');
    });

    it('rolls 60 minutes into the next whole hour properly', () => {
      expect(toQbDuration(1.999)).toBe('2:00');
      expect(toQbDuration(-1.5)).toBe('0:00'); // Negative protected
    });
  });
});
