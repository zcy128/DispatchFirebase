/**
 * Inspection Date & End-of-Month Legal Expiry Utilities
 *
 * Rule: As long as the safety sticker displays a given month (e.g. "10 / OCT"),
 * the vehicle's legal operating authorization remains valid until midnight (23:59:59)
 * on the LAST DAY of that month, while the actual inspection date is saved.
 */

const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

/**
 * Returns the exact last day of the month as 'YYYY-MM-DD'.
 * Handles leap years properly.
 * Example: '2026-10' -> '2026-10-31', '2028-02-15' -> '2028-02-29'
 */
export function getEndOfMonthDate(dateOrMonthStr: string): string {
  if (!dateOrMonthStr) return '';
  const clean = dateOrMonthStr.slice(0, 7); // YYYY-MM
  const parts = clean.split('-');
  if (parts.length < 2) return dateOrMonthStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1-12
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return dateOrMonthStr;
  }

  // Day 0 of the following month returns the last day of the target month
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Calculates days remaining from today until 23:59:59 on the last day of the sticker month.
 */
export function getDaysRemainingUntilEndOfMonth(dateOrMonthStr: string): number {
  const endOfMonth = getEndOfMonthDate(dateOrMonthStr);
  if (!endOfMonth) return 0;

  const expiryTime = new Date(`${endOfMonth}T23:59:59`).getTime();
  const now = Date.now();
  const diffMs = expiryTime - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks whether the vehicle's legal validity expires within the next 30 days.
 */
export function isDueWithin30Days(dateOrMonthStr: string): boolean {
  const days = getDaysRemainingUntilEndOfMonth(dateOrMonthStr);
  return days >= 0 && days <= 30;
}

/**
 * Checks whether the vehicle's legal validity has expired past midnight of the sticker month.
 */
export function isOverdue(dateOrMonthStr: string): boolean {
  const days = getDaysRemainingUntilEndOfMonth(dateOrMonthStr);
  return days < 0;
}

/**
 * Formats a date or YYYY-MM into the official sticker display, e.g. "10 / OCT 2026".
 */
export function formatStickerMonth(dateOrMonthStr: string): string {
  if (!dateOrMonthStr) return 'N/A';
  const clean = dateOrMonthStr.slice(0, 7);
  const parts = clean.split('-');
  if (parts.length < 2) return dateOrMonthStr;

  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return dateOrMonthStr;

  const monthCode = MONTH_NAMES[monthNum - 1];
  return `${String(monthNum).padStart(2, '0')} / ${monthCode} ${year}`;
}

/**
 * Checks whether an inspection record is older than 2 years (> 730 days) from its actual inspection date.
 * Under MTO CVOR and SAAQ regulations, active files must be kept 2 years; older records migrate to BigQuery cold data lake.
 */
export function isOlderThanTwoYears(inspectionDateStr: string): boolean {
  if (!inspectionDateStr) return false;
  const inspTime = new Date(inspectionDateStr).getTime();
  if (isNaN(inspTime)) return false;

  const twoYearsInMs = 2 * 365.25 * 24 * 60 * 60 * 1000;
  return Date.now() - inspTime >= twoYearsInMs;
}

/**
 * Adds months to a date string (YYYY-MM-DD), default 6 months for semi-annual inspection.
 */
export function addMonths(dateStr: string, monthsToAdd: number = 6): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  d.setMonth(d.getMonth() + monthsToAdd);
  return d.toISOString().slice(0, 10);
}
