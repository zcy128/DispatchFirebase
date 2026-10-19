import React, { useState, useEffect, useMemo } from 'react';
import { School, SchoolBoard } from '../types/school';
import type {
  CalendarEvent,
  SchoolCalendar
} from '../types/calendar';
import { EVENT_TYPE_CONFIGS } from '../types/calendar';
import { CalendarService } from '../services/calendarService';
import { CalendarEventModal } from '../components/calendar/CalendarEventModal';
import { CalendarPdfExportModal } from '../components/calendar/CalendarPdfExportModal';
import { useI18n } from '../contexts/I18nContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Building2,
  School as SchoolIcon,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  CalendarDays,
  Sparkles,
  FileDown
} from 'lucide-react';

interface SchoolCalendarViewProps {
  schools: School[];
  boards: SchoolBoard[];
  selectedSchoolId?: number | null;
  onSelectSchool?: (school: School | null) => void;
}

export const SchoolCalendarView: React.FC<SchoolCalendarViewProps> = ({
  schools,
  boards,
  selectedSchoolId,
  onSelectSchool
}) => {
  const { t } = useI18n();

  // 1. Board & School Scope Selection
  // Default to OCSB (ID 6) if present, or first board
  const defaultBoard = boards.find((b) => b.schoolBoardCode === 'OCSB') || boards[0] || {
    id: '6',
    schoolBoardId: 6,
    schoolBoardCode: 'OCSB',
    schoolBoardName: 'Ottawa Catholic School Board'
  };

  const [selectedBoardId, setSelectedBoardId] = useState<number>(defaultBoard.schoolBoardId);
  const [selectedScope, setSelectedScope] = useState<'board' | 'school'>('board');
  const [currentSchoolId, setCurrentSchoolId] = useState<number | null>(selectedSchoolId || null);
  const [schoolYear, setSchoolYear] = useState<string>('2026-2027');

  // Handle external selectedSchoolId change
  useEffect(() => {
    if (selectedSchoolId) {
      setCurrentSchoolId(selectedSchoolId);
      setSelectedScope('school');
      const sch = schools.find((s) => s.schoolId === selectedSchoolId);
      if (sch && sch.schoolBoardId) {
        setSelectedBoardId(sch.schoolBoardId);
      }
    }
  }, [selectedSchoolId, schools]);

  // Filtered schools for current board
  const boardSchools = useMemo(() => {
    return schools.filter((s) => s.schoolBoardId === selectedBoardId);
  }, [schools, selectedBoardId]);

  const currentSchool = useMemo(() => {
    return schools.find((s) => s.schoolId === currentSchoolId) || null;
  }, [schools, currentSchoolId]);

  const currentBoard = useMemo(() => {
    return boards.find((b) => b.schoolBoardId === selectedBoardId) || defaultBoard;
  }, [boards, selectedBoardId, defaultBoard]);

  // 2. Calendar Data State
  const [calendar, setCalendar] = useState<SchoolCalendar | null>(null);
  const [boardCalendar, setBoardCalendar] = useState<SchoolCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 3. Month Grid Navigation State (Defaults to September 2026 for school year start)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date(2026, 8, 1)); // September 2026
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');

  // 4. Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined);

  // 5. Bottom Table Search & Type Filter State
  const [tableSearch, setTableSearch] = useState('');
  const [tableTypeFilter, setTableTypeFilter] = useState<string>('ALL');

  // Load Calendar Data
  const loadCalendar = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setFeedback(null);

    try {
      // 1. Always load board calendar for inheritance reference
      const bCal = await CalendarService.getCalendar({
        scope: 'board',
        boardId: selectedBoardId,
        year: schoolYear
      });
      setBoardCalendar(bCal);

      // 2. If viewing a school, load school calendar (falls back to board if not custom)
      if (selectedScope === 'school' && currentSchoolId) {
        const sCal = await CalendarService.getCalendar({
          scope: 'school',
          boardId: selectedBoardId,
          schoolId: currentSchoolId,
          year: schoolYear
        });
        setCalendar(sCal);
      } else {
        setCalendar(bCal);
      }
    } catch (err: any) {
      console.error('Failed to load calendar:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load school calendar.'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [selectedBoardId, selectedScope, currentSchoolId, schoolYear]);

  // Handler: Create Custom School Calendar by copying board calendar events
  const handleCreateCustomSchoolCalendar = async () => {
    if (!currentSchool || !boardCalendar) return;
    setLoading(true);
    try {
      const customCal = await CalendarService.createCustomSchoolCalendar({
        schoolId: currentSchool.schoolId,
        schoolName: currentSchool.schoolName,
        boardCalendar,
        schoolYear
      });
      setCalendar(customCal);
      setFeedback({
        type: 'success',
        message: t.calendar?.customCreatedSuccess || `Custom calendar created for ${currentSchool.schoolName} based on ${boardCalendar.boardCode} baseline.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to create custom school calendar.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Revert School Custom Calendar to Board Master
  const handleRevertSchoolToBoard = async () => {
    if (!currentSchool) return;
    if (!window.confirm(t.calendar?.confirmRevert || 'Revert this school to the School Board Master calendar? All custom changes will be discarded.')) {
      return;
    }
    setLoading(true);
    try {
      await CalendarService.revertSchoolCalendar(currentSchool.schoolId, schoolYear);
      await loadCalendar();
      setFeedback({
        type: 'success',
        message: t.calendar?.revertedSuccess || `Successfully reverted ${currentSchool.schoolName} to School Board calendar.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to revert to board calendar.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Save Event (Add or Edit)
  const handleSaveEvent = async (event: CalendarEvent) => {
    if (!calendar) return;

    let updatedEvents = [...(calendar.events || [])];
    const existingIndex = updatedEvents.findIndex((e) => e.id === event.id);

    if (existingIndex >= 0) {
      updatedEvents[existingIndex] = event;
    } else {
      updatedEvents.push(event);
    }

    // Sort events chronologically by startDate
    updatedEvents.sort((a, b) => a.startDate.localeCompare(b.startDate));

    // If currently on school scope with inherited board calendar, auto-elevate to custom school calendar
    let targetCal: SchoolCalendar = {
      ...calendar,
      events: updatedEvents
    };

    if (selectedScope === 'school' && currentSchool && !calendar.isCustom) {
      targetCal = {
        ...targetCal,
        id: `school_${currentSchool.schoolId}_${schoolYear}`,
        scope: 'school',
        schoolId: currentSchool.schoolId,
        schoolName: currentSchool.schoolName,
        isCustom: true
      };
    }

    const saved = await CalendarService.saveCalendar(targetCal);
    setCalendar(saved);
    setFeedback({
      type: 'success',
      message: t.calendar?.eventSavedSuccess || 'Calendar event saved successfully.'
    });
  };

  // Handler: Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!calendar) return;

    const updatedEvents = (calendar.events || []).filter((e) => e.id !== eventId);

    let targetCal: SchoolCalendar = {
      ...calendar,
      events: updatedEvents
    };

    if (selectedScope === 'school' && currentSchool && !calendar.isCustom) {
      targetCal = {
        ...targetCal,
        id: `school_${currentSchool.schoolId}_${schoolYear}`,
        scope: 'school',
        schoolId: currentSchool.schoolId,
        schoolName: currentSchool.schoolName,
        isCustom: true
      };
    }

    const saved = await CalendarService.saveCalendar(targetCal);
    setCalendar(saved);
    setFeedback({
      type: 'success',
      message: t.calendar?.eventDeletedSuccess || 'Event removed from calendar.'
    });
  };

  // Click on date cell: open add event modal prefilled with that date
  const handleCellClick = (dateStr: string) => {
    setEditingEvent(null);
    setModalInitialDate(dateStr);
    setIsModalOpen(true);
  };

  // Click on existing event badge: open edit modal
  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setModalInitialDate(event.startDate);
    setIsModalOpen(true);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    setCurrentMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Month calendar grid computation
  const monthData = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth(); // 0-indexed

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      isToday: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const mStr = String(prevM + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${prevY}-${mStr}-${dStr}`;
      const dayOfWeek = new Date(prevY, prevM, d).getDay();
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateStr === todayStr
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateStr === todayStr
      });
    }

    // Next month padding to fill out 35 or 42 grid cells
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      const mStr = String(nextM + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${nextY}-${mStr}-${dStr}`;
      const dayOfWeek = new Date(nextY, nextM, d).getDay();
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateStr === todayStr
      });
    }

    return cells;
  }, [currentMonthDate]);

  // Lookup map: dateStr -> events occurring on that date (including date spans)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!calendar?.events) return map;

    calendar.events.forEach((ev) => {
      if (!ev.endDate || ev.endDate === ev.startDate) {
        const list = map.get(ev.startDate) || [];
        list.push(ev);
        map.set(ev.startDate, list);
      } else {
        // Multi-day span: populate all days in interval
        let cur = new Date(ev.startDate + 'T00:00:00');
        const end = new Date(ev.endDate + 'T00:00:00');
        while (cur <= end) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          const str = `${y}-${m}-${d}`;
          const list = map.get(str) || [];
          list.push(ev);
          map.set(str, list);
          cur.setDate(cur.getDate() + 1);
        }
      }
    });

    return map;
  }, [calendar]);

  // Filtered events for bottom key dates table
  const filteredTableEvents = useMemo(() => {
    if (!calendar?.events) return [];
    return calendar.events.filter((ev) => {
      // Type filter
      if (tableTypeFilter !== 'ALL' && ev.type !== tableTypeFilter) {
        return false;
      }
      // Search term
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesDate = ev.startDate.toLowerCase().includes(q) || (ev.endDate && ev.endDate.toLowerCase().includes(q));
        const matchesGrades = ev.grades && ev.grades.toLowerCase().includes(q);
        const matchesDesc = ev.description && ev.description.toLowerCase().includes(q);
        return matchesTitle || matchesDate || matchesGrades || matchesDesc;
      }
      return true;
    });
  }, [calendar, tableTypeFilter, tableSearch]);

  // Stats calculation
  const stats = useMemo(() => {
    const events = calendar?.events || [];
    let pdDays = 0;
    let holidays = 0;
    let breaks = 0;
    let exams = 0;
    let custom = 0;

    events.forEach((e) => {
      if (e.type === 'pd_day') pdDays++;
      else if (e.type === 'holiday') holidays++;
      else if (e.type === 'break') breaks++;
      else if (e.type === 'exam') exams++;
      else if (e.type === 'custom') custom++;
    });

    return { total: events.length, pdDays, holidays, breaks, exams, custom };
  }, [calendar]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Header & Scope Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shadow-inner">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {t.calendar?.title || 'School Year Calendar'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-teal-400 border border-slate-700">
                  {schoolYear}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.calendar?.subtitle || 'Statutory holidays, PD days, and school-specific operational schedules'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setEditingEvent(null);
                setModalInitialDate(new Date().toISOString().split('T')[0]);
                setIsModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-900/30 flex items-center space-x-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t.calendar?.addEvent || 'Add Event'}</span>
            </button>

            <button
              onClick={() => setIsPdfExportOpen(true)}
              disabled={!calendar}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-500/30 text-xs font-semibold shadow-md flex items-center space-x-1.5 transition disabled:opacity-50"
              title={t.calendar?.exportPdf || 'Export PDF / Print'}
            >
              <FileDown className="w-4 h-4" />
              <span>{t.calendar?.exportPdf || 'Export PDF'}</span>
            </button>

            <button
              onClick={() => loadCalendar(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Refresh Calendar"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Board & School Hierarchy Controls */}
        <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* School Board Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-400" />
              <span>School Board</span>
            </label>
            <select
              value={selectedBoardId}
              onChange={(e) => {
                const bId = Number(e.target.value);
                setSelectedBoardId(bId);
                setSelectedScope('board');
                setCurrentSchoolId(null);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            >
              {boards.map((b) => (
                <option key={b.schoolBoardId} value={b.schoolBoardId}>
                  {b.schoolBoardCode} – {b.schoolBoardName}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Selector: Board Master vs Specific School */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <SchoolIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.calendar?.calendarScope || 'Calendar Target (Board or School)'}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedScope === 'board' ? 'board' : String(currentSchoolId || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'board') {
                    setSelectedScope('board');
                    setCurrentSchoolId(null);
                    if (onSelectSchool) onSelectSchool(null);
                  } else {
                    const sId = Number(val);
                    setSelectedScope('school');
                    setCurrentSchoolId(sId);
                    const sch = schools.find((s) => s.schoolId === sId);
                    if (onSelectSchool && sch) onSelectSchool(sch);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              >
                <option value="board">
                  🏛️ {currentBoard.schoolBoardCode} Master Calendar (Default for all schools)
                </option>
                <optgroup label={`Schools in ${currentBoard.schoolBoardCode}`}>
                  {boardSchools.map((s) => (
                    <option key={s.schoolId} value={s.schoolId}>
                      🏫 {s.schoolName}
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* School Year Selector */}
              <div className="flex items-center space-x-2">
                <select
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 transition flex-1"
                >
                  <option value="2026-2027">2026-2027 School Year</option>
                  <option value="2025-2026">2025-2026 School Year</option>
                  <option value="2027-2028">2027-2028 School Year</option>
                </select>

                <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      viewMode === 'month'
                        ? 'bg-teal-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      viewMode === 'list'
                        ? 'bg-teal-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    List
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Inheritance Status Banner (Requirement 2 & 3) */}
        {selectedScope === 'school' && currentSchool && (
          <div className="mt-3 p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 border-slate-800">
            <div className="flex items-start sm:items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  calendar?.isCustom
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    : 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                }`}
              >
                {calendar?.isCustom ? <Sparkles className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white">
                    {currentSchool.schoolName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      calendar?.isCustom
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    }`}
                  >
                    {calendar?.isCustom
                      ? (t.calendar?.customActive || 'Custom School Calendar')
                      : (t.calendar?.inheritingBoard || `Inheriting ${currentBoard.schoolBoardCode} Defaults`)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {calendar?.isCustom
                    ? (t.calendar?.customDesc || 'This school has an independent calendar. Changes here do not affect other schools.')
                    : (t.calendar?.inheritedDesc || `Currently using ${currentBoard.schoolBoardName} calendar. All board PD days and holidays apply automatically.`)}
                </p>
              </div>
            </div>

            {/* Customize / Revert Controls */}
            <div className="flex items-center space-x-2">
              {!calendar?.isCustom ? (
                <button
                  onClick={handleCreateCustomSchoolCalendar}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 flex items-center space-x-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t.calendar?.createCustom || 'Create Custom Calendar'}</span>
                </button>
              ) : (
                <button
                  onClick={handleRevertSchoolToBoard}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.calendar?.revertToBoard || 'Revert to Board Defaults'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center space-x-2 animate-in fade-in duration-150 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* 3. Month Navigation & Legend Bar (1:1 with OCSB Reference Layout) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Month Selector Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-white min-w-[180px] text-center">
              {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleCurrentMonth}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 border border-slate-700 transition"
            >
              Today
            </button>
          </div>

          {/* OCSB Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <span style={{ color: EVENT_TYPE_CONFIGS.pd_day.dotColor }} className="text-sm font-bold leading-none">
                ■
              </span>
              <span className="text-slate-300 font-medium">PD Days</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span style={{ color: EVENT_TYPE_CONFIGS.holiday.dotColor }} className="text-sm font-bold leading-none">
                ■
              </span>
              <span className="text-slate-300 font-medium">Statutory Holidays</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span style={{ color: EVENT_TYPE_CONFIGS.school_event.dotColor }} className="text-sm font-bold leading-none">
                ●
              </span>
              <span className="text-slate-300 font-medium">School Milestones</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span style={{ color: EVENT_TYPE_CONFIGS.exam.dotColor }} className="text-sm font-bold leading-none">
                ▲
              </span>
              <span className="text-slate-300 font-medium">Exams</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span style={{ color: EVENT_TYPE_CONFIGS.break.dotColor }} className="text-sm font-bold leading-none">
                ☀️
              </span>
              <span className="text-slate-300 font-medium">Breaks</span>
            </div>
          </div>
        </div>

        {/* 4. Interactive Calendar Grid (Click Date to Add) */}
        {viewMode === 'month' && (
          <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner bg-slate-950">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/80 text-center py-2.5">
              {weekdayNames.map((d, idx) => (
                <span
                  key={d}
                  className={`text-xs font-bold uppercase tracking-wider ${
                    idx === 0 || idx === 6 ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/80">
              {monthData.map((cell) => {
                const dayEvents = eventsByDate.get(cell.dateStr) || [];

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => handleCellClick(cell.dateStr)}
                    className={`min-h-[96px] sm:min-h-[110px] p-2 relative flex flex-col justify-between group cursor-pointer transition hover:bg-slate-800/40 ${
                      !cell.isCurrentMonth
                        ? 'bg-slate-950/40 text-slate-600'
                        : cell.isWeekend
                        ? 'bg-slate-950/70 text-slate-400'
                        : 'bg-slate-900/30 text-slate-200'
                    }`}
                  >
                    {/* Date Number Header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-semibold rounded-md px-1.5 py-0.5 ${
                          cell.isToday
                            ? 'bg-teal-500 text-slate-950 font-bold shadow'
                            : cell.isCurrentMonth
                            ? 'text-slate-300'
                            : 'text-slate-600'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Quick Add Button on Hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(cell.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Add event on this date"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Event Badges List */}
                    <div className="space-y-1 mt-1 overflow-y-auto max-h-[70px] pr-0.5">
                      {dayEvents.map((ev) => {
                        const conf = EVENT_TYPE_CONFIGS[ev.type] || EVENT_TYPE_CONFIGS.school_event;
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => handleEventClick(ev, e)}
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium border truncate transition flex items-center space-x-1 cursor-pointer hover:brightness-110 shadow-sm ${conf.badgeBg} ${conf.badgeText} ${conf.badgeBorder}`}
                            title={`${ev.title} (${conf.defaultLabel})${ev.grades ? ` • ${ev.grades}` : ''}`}
                          >
                            <span style={{ color: conf.dotColor }} className="text-[11px] font-bold leading-none flex-shrink-0">
                              {conf.symbol}
                            </span>
                            <span className="truncate">{ev.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Bottom Table: Key Dates for School Year (1:1 with OCSB Reference Webpage) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <CalendarDays className="w-5 h-5 text-teal-400" />
              <span>Key Dates for {schoolYear} Calendar</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Official schedule of school start/end dates, examinations, statutory holidays, and professional activity days
            </p>
          </div>

          {/* Table Search & Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search dates & events..."
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition w-48 sm:w-56"
              />
            </div>

            {/* Type Filter */}
            <select
              value={tableTypeFilter}
              onChange={(e) => setTableTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 transition"
            >
              <option value="ALL">All Event Types ({calendar?.events?.length || 0})</option>
              <option value="pd_day">PD Days ({stats.pdDays})</option>
              <option value="holiday">Statutory Holidays ({stats.holidays})</option>
              <option value="school_event">School Milestones</option>
              <option value="exam">Secondary Exams ({stats.exams})</option>
              <option value="break">School Breaks ({stats.breaks})</option>
              <option value="custom">Custom Events ({stats.custom})</option>
            </select>
          </div>
        </div>

        {/* Structured Table matching OCSB TablePress Format */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-1/3">Date</th>
                <th className="py-3 px-4 w-1/3">Event</th>
                <th className="py-3 px-4">Applicable Scope / Grades</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
              {filteredTableEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                    No calendar events found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTableEvents.map((ev) => {
                  const conf = EVENT_TYPE_CONFIGS[ev.type] || EVENT_TYPE_CONFIGS.school_event;
                  const isSpan = Boolean(ev.endDate && ev.endDate !== ev.startDate);

                  return (
                    <tr
                      key={ev.id}
                      className="hover:bg-slate-900/50 transition cursor-pointer group"
                      onClick={() => {
                        setEditingEvent(ev);
                        setModalInitialDate(ev.startDate);
                        setIsModalOpen(true);
                      }}
                    >
                      {/* Date Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span
                            style={{ color: conf.dotColor }}
                            className="text-sm font-bold leading-none flex-shrink-0"
                          >
                            {conf.symbol}
                          </span>
                          <span className="font-medium text-white">
                            {isSpan ? `${ev.startDate} – ${ev.endDate}` : ev.startDate}
                          </span>
                        </div>
                      </td>

                      {/* Event Column */}
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        <div className="flex items-center space-x-2">
                          <span>{ev.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${conf.badgeBg} ${conf.badgeText} ${conf.badgeBorder}`}
                          >
                            {conf.defaultLabel}
                          </span>
                        </div>
                        {ev.description && (
                          <p className="text-[11px] text-slate-500 font-normal mt-0.5 line-clamp-1">
                            {ev.description}
                          </p>
                        )}
                      </td>

                      {/* Grades / Scope */}
                      <td className="py-3 px-4 text-slate-400">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-900 border border-slate-800">
                          {ev.grades || 'All Grades'}
                        </span>
                      </td>

                      {/* Quick Edit/Delete */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEvent(ev);
                            setModalInitialDate(ev.startDate);
                            setIsModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Event Creation & Edit Modal */}
      <CalendarEventModal
        isOpen={isModalOpen}
        event={editingEvent}
        initialDate={modalInitialDate}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />

      {/* 7. PDF Export & Landscape Printable Poster Modal */}
      {isPdfExportOpen && calendar && (
        <CalendarPdfExportModal
          isOpen={isPdfExportOpen}
          onClose={() => setIsPdfExportOpen(false)}
          calendar={calendar}
          board={currentBoard}
          school={currentSchool}
          schoolYear={schoolYear}
        />
      )}
    </div>
  );
};
