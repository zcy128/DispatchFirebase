/**
 * Format a Date object to local YYYY-MM-DD string without UTC offset shifting.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's local date as YYYY-MM-DD.
 */
export function getLocalTodayString(): string {
  return formatLocalDate(new Date());
}

/**
 * Add or subtract days from a YYYY-MM-DD date string using local calendar math.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  if (!dateStr || !dateStr.includes('-')) {
    return getLocalTodayString();
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return formatLocalDate(date);
}

/**
 * Safely format any date representation (string, Date, Firestore Timestamp, number) to YYYY-MM-DD.
 */
export function safeFormatDate(value: any, fallback: string = '-'): string {
  if (!value) return fallback;
  try {
    let d: Date | null = null;
    if (typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        d = value.toDate();
      } else if (value.seconds !== undefined) {
        d = new Date(value.seconds * 1000);
      } else if (value instanceof Date) {
        d = value;
      }
    } else if (typeof value === 'string') {
      if (value.includes('T')) {
        return value.split('T')[0];
      }
      d = new Date(value);
    } else if (typeof value === 'number') {
      d = new Date(value);
    }

    if (d && !isNaN(d.getTime())) {
      return formatLocalDate(d);
    }
    return String(value);
  } catch {
    return fallback;
  }
}
/**
 * Calculate the default application deadline for a route opening.
 * Rule: Dispatchers typically generate tomorrow's dispatch by 2:00 PM today.
 * Therefore, bidding for coverage on `startDate` must close before dispatch is generated:
 * - If `startDate` is a Monday, dispatch is generated on the preceding business day (Friday) at 14:00 (2:00 PM).
 * - If `startDate` is a Sunday, preceding business day is Friday at 14:00.
 * - If `startDate` is Tuesday - Saturday, dispatch is generated on the day before at 14:00.
 * - If the target deadline is already in the past, fall back to a reasonable upcoming deadline before the shift starts.
 */
export function calculateDefaultDeadline(startDateStr: string): string {
  const todayStr = getLocalTodayString();
  const now = new Date();

  if (!startDateStr || !startDateStr.includes('-')) {
    const [tY, tM, tD] = todayStr.split('-').map(Number);
    const today2pm = new Date(tY, tM - 1, tD, 14, 0, 0);
    if (now < today2pm) {
      return `${todayStr}T14:00`;
    }
    const tomorrowStr = addDaysToDateString(todayStr, 1);
    return `${tomorrowStr}T14:00`;
  }

  const [year, month, day] = startDateStr.split('-').map(Number);
  const startDateObj = new Date(year, month - 1, day);
  const dayOfWeek = startDateObj.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat

  let targetDateStr: string;
  if (dayOfWeek === 1) {
    // Monday: Dispatch is finalized on previous Friday (3 days prior)
    targetDateStr = addDaysToDateString(startDateStr, -3);
  } else if (dayOfWeek === 0) {
    // Sunday: Previous Friday (2 days prior)
    targetDateStr = addDaysToDateString(startDateStr, -2);
  } else {
    // Tuesday through Saturday: Previous day
    targetDateStr = addDaysToDateString(startDateStr, -1);
  }

  const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
  const targetDateTime = new Date(tYear, tMonth - 1, tDay, 14, 0, 0);

  // If the computed 2:00 PM deadline is in the future, use it!
  if (targetDateTime.getTime() > now.getTime()) {
    return `${targetDateStr}T14:00`;
  }

  // If previous business day 14:00 has passed (e.g. posting on Friday evening or weekend for Monday):
  // Check if calendar day before at 14:00 is in the future (e.g. Sunday 14:00 for Monday)
  const calendarDayBeforeStr = addDaysToDateString(startDateStr, -1);
  const [cYear, cMonth, cDay] = calendarDayBeforeStr.split('-').map(Number);
  const calendarDayBefore2pm = new Date(cYear, cMonth - 1, cDay, 14, 0, 0);
  if (calendarDayBefore2pm.getTime() > now.getTime()) {
    return `${calendarDayBeforeStr}T14:00`;
  }

  // If even day before 14:00 is in the past, but day before 18:00 (6:00 PM) is still in the future:
  const calendarDayBefore6pm = new Date(cYear, cMonth - 1, cDay, 18, 0, 0);
  if (calendarDayBefore6pm.getTime() > now.getTime()) {
    return `${calendarDayBeforeStr}T18:00`;
  }

  // If posting on the same day as coverage or right before shift:
  // Give at least 2 hours from now
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const twoHoursStr = formatLocalDate(twoHoursLater);
  const twoHoursTime = `${String(twoHoursLater.getHours()).padStart(2, '0')}:${String(twoHoursLater.getMinutes()).padStart(2, '0')}`;
  return `${twoHoursStr}T${twoHoursTime}`;
}
