export type CalendarEventType =
  | 'holiday'      // Statutory / Public Holiday (Amber)
  | 'pd_day'       // Professional Development / PA Day (Teal)
  | 'school_event' // School Milestone (First Day, Semester Start, Last Day)
  | 'exam'         // Secondary Examinations (Indigo)
  | 'break'        // School Break (Christmas Break, March Break)
  | 'custom';      // Custom School Event (Purple)

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD (optional, if date span)
  grades?: string;    // e.g. "All Grades", "Secondary (9-12)", "Elementary (K-8)", "K-6"
  description?: string;
  isBoardWide?: boolean;
}

export interface SchoolCalendar {
  id: string;
  scope: 'board' | 'school';
  boardId: number;
  boardCode: string;
  schoolId?: number;
  schoolName?: string;
  schoolYear: string; // e.g. "2026-2027"
  isCustom: boolean;  // true if customized for a specific school
  events: CalendarEvent[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EventTypeConfig {
  type: CalendarEventType;
  labelKey: string;
  defaultLabel: string;
  symbol: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
}

export const EVENT_TYPE_CONFIGS: Record<CalendarEventType, EventTypeConfig> = {
  pd_day: {
    type: 'pd_day',
    labelKey: 'pdDay',
    defaultLabel: 'PD Day',
    symbol: '■',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    badgeBorder: 'border-teal-500/40',
    dotColor: '#22a2a1'
  },
  holiday: {
    type: 'holiday',
    labelKey: 'statutoryHoliday',
    defaultLabel: 'Statutory Holiday',
    symbol: '■',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/40',
    dotColor: '#E4A13A'
  },
  school_event: {
    type: 'school_event',
    labelKey: 'schoolMilestone',
    defaultLabel: 'School Milestone',
    symbol: '●',
    badgeBg: 'bg-slate-500/20',
    badgeText: 'text-slate-300',
    badgeBorder: 'border-slate-500/40',
    dotColor: '#94a3b8'
  },
  exam: {
    type: 'exam',
    labelKey: 'examinations',
    defaultLabel: 'Secondary Exams',
    symbol: '▲',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-300',
    badgeBorder: 'border-indigo-500/40',
    dotColor: '#6366f1'
  },
  break: {
    type: 'break',
    labelKey: 'schoolBreak',
    defaultLabel: 'School Break',
    symbol: '☀️',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-500/40',
    dotColor: '#f43f5e'
  },
  custom: {
    type: 'custom',
    labelKey: 'customEvent',
    defaultLabel: 'School Event',
    symbol: '◆',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    badgeBorder: 'border-purple-500/40',
    dotColor: '#a855f7'
  }
};
