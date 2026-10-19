import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { School, SchoolBoard } from '../../types/school';
import { CalendarEvent, SchoolCalendar } from '../../types/calendar';
import { useI18n } from '../../contexts/I18nContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  X,
  Printer,
  Download,
  BookOpen,
  Calendar as CalendarIcon
} from 'lucide-react';

interface CalendarPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendar: SchoolCalendar;
  board: SchoolBoard;
  school?: School | null;
  schoolYear: string;
}

interface MonthInfo {
  name: string;
  year: number;
  monthIndex: number; // 0-11
}

export const CalendarPdfExportModal: React.FC<CalendarPdfExportModalProps> = ({
  isOpen,
  onClose,
  calendar,
  board,
  school,
  schoolYear
}) => {
  const { t } = useI18n();
  const posterRef = useRef<HTMLDivElement>(null);
  const [calendarType, setCalendarType] = useState<'elementary' | 'secondary' | 'full'>('elementary');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isExporting]);

  if (!isOpen) return null;

  // 12 months for school year (Sep through Aug)
  const [startYearStr, endYearStr] = schoolYear.split('-');
  const startYr = parseInt(startYearStr, 10) || 2026;
  const endYr = parseInt(endYearStr, 10) || startYr + 1;

  const months: MonthInfo[] = [
    { name: 'SEPTEMBER', year: startYr, monthIndex: 8 },
    { name: 'OCTOBER', year: startYr, monthIndex: 9 },
    { name: 'NOVEMBER', year: startYr, monthIndex: 10 },
    { name: 'DECEMBER', year: startYr, monthIndex: 11 },
    { name: 'JANUARY', year: endYr, monthIndex: 0 },
    { name: 'FEBRUARY', year: endYr, monthIndex: 1 },
    { name: 'MARCH', year: endYr, monthIndex: 2 },
    { name: 'APRIL', year: endYr, monthIndex: 3 },
    { name: 'MAY', year: endYr, monthIndex: 4 },
    { name: 'JUNE', year: endYr, monthIndex: 5 },
    { name: 'JULY', year: endYr, monthIndex: 6 },
    { name: 'AUGUST', year: endYr, monthIndex: 7 }
  ];

  // Helper to check if date falls in event range
  const getEventsForDate = (dateStr: string): CalendarEvent[] => {
    return (calendar.events || []).filter((e) => {
      if (e.startDate === dateStr) return true;
      if (e.endDate && dateStr >= e.startDate && dateStr <= e.endDate) return true;
      return false;
    });
  };

  // Helper to categorize day styling
  const getDayClassification = (events: CalendarEvent[]) => {
    if (events.length === 0) return null;

    // 1. First Day of School (Priority 1)
    const firstDay = events.find(
      (e) =>
        e.title.toLowerCase().includes('first day of school') ||
        e.title.toLowerCase().includes('premier jour')
    );
    if (firstDay) return { type: 'first_day', label: firstDay.title };

    // 2. Last Day of School
    const lastDay = events.find(
      (e) =>
        e.title.toLowerCase().includes('last day of school') ||
        e.title.toLowerCase().includes('dernier jour')
    );
    if (lastDay) return { type: 'last_day', label: lastDay.title };

    // 3. PA / PD Days
    const pdDay = events.find((e) => e.type === 'pd_day');
    if (pdDay) return { type: 'pd_day', label: pdDay.title };

    // 4. Holidays & Breaks
    const holiday = events.find((e) => e.type === 'holiday' || e.type === 'break');
    if (holiday) return { type: 'holiday', label: holiday.title };

    // 5. Secondary Exams
    const exam = events.find((e) => e.type === 'exam');
    if (exam) return { type: 'exam', label: exam.title };

    // 6. Milestones & Summer Programs
    const milestone = events.find((e) => e.type === 'school_event' || e.type === 'custom');
    if (milestone) return { type: 'milestone', label: milestone.title };

    return null;
  };

  // Generate calendar days for a given month
  const generateMonthDays = (year: number, monthIndex: number) => {
    const firstDayIndex = new Date(year, monthIndex, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const days: Array<{
      dayNum: number | null;
      dateStr: string;
      classification: ReturnType<typeof getDayClassification>;
    }> = [];

    // Empty leading padding cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNum: null, dateStr: '', classification: null });
    }

    // Actual month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = getEventsForDate(dateStr);
      const classification = getDayClassification(dayEvents);
      days.push({ dayNum: d, dateStr, classification });
    }

    return days;
  };

  // Compute active title
  const activeTitle =
    calendarType === 'elementary'
      ? t.calendar.elementaryCalendar
      : calendarType === 'secondary'
      ? t.calendar.secondaryCalendar
      : t.calendar.fullCalendar;

  const boardWebsite = board.schoolBoardCode.toLowerCase().includes('catholic')
    ? 'ocsb.ca'
    : 'ocdsb.ca';

  // Export PDF using jsPDF + html2canvas with precise alignment & origin
  const handleDownloadPdf = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2, // 2x resolution for crisp high-definition printing
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1240,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            img { display: inline-block !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4' // 297mm x 210mm
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 6; // 6mm margin

      const maxRenderWidth = pageWidth - margin * 2;
      const maxRenderHeight = pageHeight - margin * 2;

      const canvasAspectRatio = canvas.width / canvas.height;
      let renderWidth = maxRenderWidth;
      let renderHeight = maxRenderWidth / canvasAspectRatio;

      if (renderHeight > maxRenderHeight) {
        renderHeight = maxRenderHeight;
        renderWidth = maxRenderHeight * canvasAspectRatio;
      }

      // Center proportionally scaled poster on A4 landscape page
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
      const cleanSchoolName = school ? school.schoolName.replace(/[^a-zA-Z0-9]/g, '_') : 'Master';
      const filename = `${board.schoolBoardCode}_${cleanSchoolName}_Calendar_${schoolYear}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Browser Native Vector Landscape Printing
  const handlePrint = () => {
    window.print();
  };

  // Render modal into body portal so #root can be cleanly hidden during print without duplicating pages
  return createPortal(
    <div
      id="calendar-print-portal"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-start print:p-0 print:bg-white print:static print:inset-auto"
    >
      {/* Top Action & Control Bar (Hidden when printing via .no-print) */}
      <div className="no-print w-full max-w-[1240px] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Left: Info & Scope */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>{t.calendar.previewTitle}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold">
                {schoolYear}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {school ? `${school.schoolName} (${board.schoolBoardCode})` : `${board.schoolBoardName} (Master)`}
            </p>
          </div>
        </div>

        {/* Center: Title / Level Selector */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setCalendarType('elementary')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              calendarType === 'elementary'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Elementary
          </button>
          <button
            type="button"
            onClick={() => setCalendarType('secondary')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              calendarType === 'secondary'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Secondary
          </button>
          <button
            type="button"
            onClick={() => setCalendarType('full')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              calendarType === 'full'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Full Year
          </button>
        </div>

        {/* Right: Actions (Print, Download PDF, Close) */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition border border-slate-700 shadow-sm"
            title="Browser Vector Print / Save as PDF"
          >
            <Printer className="w-4 h-4 text-teal-400" />
            <span>{t.calendar.printPdf}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="flex items-center space-x-2 bg-teal-500 hover:bg-teal-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-teal-500/20 disabled:opacity-50"
            title="Download direct PDF document"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? t.calendar.generatingPdf : t.calendar.downloadPdf}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 hover:border-rose-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm active:scale-95 cursor-pointer ml-1"
            title="Close Preview (Esc)"
          >
            <X className="w-4 h-4 text-rose-300" />
            <span>Close</span>
            <span className="hidden sm:inline-block ml-0.5 text-[10px] font-mono px-1.5 py-0.2 bg-rose-950/60 rounded border border-rose-400/30 text-rose-200">
              Esc
            </span>
          </button>
        </div>
      </div>

      {/* Printable Poster Container (Target of Print & html2canvas) */}
      <div
        id="calendar-print-root"
        className="w-full max-w-[1240px] bg-white rounded-2xl shadow-2xl p-5 text-slate-900 border border-slate-200 overflow-hidden print:p-0 print:border-none print:shadow-none"
      >
        <div ref={posterRef} id="calendar-printable-poster" className="bg-white p-2">
          {/* Header Banner */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
            {/* Left: Year Badge + Title */}
            <div className="flex items-center space-x-4">
              <div className="bg-[#482860] text-white px-4 py-1.5 rounded-xl font-black text-xl tracking-wider font-mono shadow-sm">
                {schoolYear}
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase">
                  {activeTitle}
                </h1>
                {school && (
                  <p className="text-xs font-bold text-teal-700 tracking-wide">
                    {school.schoolName}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Board Logo & Branding */}
            <div className="flex items-center space-x-3 text-right">
              <div className="text-right">
                <div className="text-xs font-black tracking-wider text-slate-800 uppercase">
                  {board.schoolBoardName}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 tracking-wider">
                  {board.schoolBoardCode} • Official School Calendar
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-900/10 border border-purple-900/20 flex items-center justify-center text-purple-950 flex-shrink-0">
                <BookOpen className="w-6 h-6 text-[#482860]" />
              </div>
            </div>
          </div>

          {/* 12-Month Calendar Grid */}
          <div className="mt-4 grid grid-cols-5 gap-3">
            {/* Row 1 (Months 0-4: Sep, Oct, Nov, Dec, Jan) */}
            {months.slice(0, 5).map((m) => (
              <MonthGridCard
                key={`${m.name}-${m.year}`}
                month={m}
                days={generateMonthDays(m.year, m.monthIndex)}
              />
            ))}

            {/* Row 2 (Months 5-9: Feb, Mar, Apr, May, Jun) */}
            {months.slice(5, 10).map((m) => (
              <MonthGridCard
                key={`${m.name}-${m.year}`}
                month={m}
                days={generateMonthDays(m.year, m.monthIndex)}
              />
            ))}

            {/* Row 3: July & August (2 columns) */}
            {months.slice(10, 12).map((m) => (
              <MonthGridCard
                key={`${m.name}-${m.year}`}
                month={m}
                days={generateMonthDays(m.year, m.monthIndex)}
              />
            ))}

            {/* Row 3 Right: Legend & Important Dates Panel (Spans 3 Columns) */}
            <div className="col-span-3 border border-slate-300 rounded-xl p-3 bg-slate-50/70 flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-3 text-[10px]">
                {/* Col 1: First Day & Holidays */}
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#a82020',
                        color: '#ffffff',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <span style={{ display: 'inline-block', position: 'relative', top: '-1px', lineHeight: 1 }}>
                        ✓
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{t.calendar.firstDayOfSchool}</div>
                      <div className="text-slate-600 font-medium">September 1, 2026</div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#4ade80',
                        border: '1px solid #22c55e',
                        color: '#052e16',
                        borderRadius: '9999px',
                        fontSize: '8.5px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <span style={{ display: 'inline-block', position: 'relative', top: '-1px', lineHeight: 1 }}>
                        H
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{t.calendar.holidays}</div>
                      <div className="text-slate-600 leading-tight">
                        <span className="font-semibold text-slate-700">2026:</span> Sep 7, Oct 12, Dec 21–31
                      </div>
                      <div className="text-slate-600 leading-tight">
                        <span className="font-semibold text-slate-700">2027:</span> Jan 1, Feb 15, Mar 15–19, Mar 26, 29, May 24
                      </div>
                    </div>
                  </div>
                </div>

                {/* Col 2: PA/PD Days & Turnaround */}
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        border: '1.5px solid #0284c7',
                        color: '#0284c7',
                        borderRadius: '9999px',
                        fontSize: '7.5px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <span style={{ display: 'inline-block', position: 'relative', top: '-1px', lineHeight: 1 }}>
                        PA
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{t.calendar.paDays}</div>
                      <div className="text-slate-600 leading-tight">
                        <span className="font-semibold text-slate-700">2026:</span> Aug 31, Oct 2, Nov 20, 23
                      </div>
                      <div className="text-slate-600 leading-tight">
                        <span className="font-semibold text-slate-700">2027:</span> Jan 29, Apr 16, Jun 4, 25
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#fef3c7',
                        border: '1px solid #f59e0b',
                        color: '#92400e',
                        borderRadius: '9999px',
                        fontSize: '9px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <span style={{ display: 'inline-block', position: 'relative', top: '-1px', lineHeight: 1 }}>
                        ★
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">Turnaround & Milestones</div>
                      <div className="text-slate-600 leading-tight">Semester Transitions & Interviews</div>
                    </div>
                  </div>
                </div>

                {/* Col 3: Last Day & Secondary Programs */}
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#eab308',
                        color: '#ffffff',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <span style={{ display: 'inline-block', position: 'relative', top: '-1px', lineHeight: 1 }}>
                        ✓
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{t.calendar.lastDayOfSchool}</div>
                      <div className="text-slate-600 font-medium">June 24, 2027</div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        border: '1.5px dashed #f97316',
                        color: '#ea580c',
                        borderRadius: '9999px',
                        fontSize: '7.5px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <span style={{ display: 'inline-block', position: 'relative', top: '-1px', lineHeight: 1 }}>
                        SL
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">Summer Learning & Exams</div>
                      <div className="text-slate-600 leading-tight">July 5–30 (*Dates vary by program)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Legend Branding Footer */}
              <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm font-black text-[#482860] tracking-wider font-mono">
                  {boardWebsite}
                </span>
                <span className="text-[9px] text-slate-500 font-medium">
                  Official School Board Approved Calendar • Subject to Ministry of Education guidelines
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Reusable Month Card in the Printable 12-Month Poster
interface MonthGridCardProps {
  month: MonthInfo;
  days: Array<{
    dayNum: number | null;
    dateStr: string;
    classification: { type: string; label: string } | null;
  }>;
}

const MonthGridCard: React.FC<MonthGridCardProps> = ({ month, days }) => {
  // Return style object with optical vertical centering
  const getBadgeStyle = (type: string | undefined): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '18px',
      height: '18px',
      fontSize: '9.5px',
      fontWeight: 700,
      margin: '0 auto',
      padding: 0,
      boxSizing: 'border-box'
    };

    switch (type) {
      case 'first_day':
        return {
          ...base,
          backgroundColor: '#a82020',
          color: '#ffffff',
          borderRadius: '3px'
        };
      case 'last_day':
        return {
          ...base,
          backgroundColor: '#eab308',
          color: '#ffffff',
          borderRadius: '3px'
        };
      case 'pd_day':
        return {
          ...base,
          border: '1.5px solid #0284c7',
          color: '#0284c7',
          borderRadius: '9999px'
        };
      case 'holiday':
        return {
          ...base,
          backgroundColor: '#4ade80',
          color: '#052e16',
          borderRadius: '9999px'
        };
      case 'exam':
        return {
          ...base,
          border: '1.5px solid #6366f1',
          color: '#4f46e5',
          borderRadius: '3px'
        };
      case 'milestone':
        return {
          ...base,
          border: '1.5px dashed #f97316',
          color: '#ea580c',
          borderRadius: '9999px'
        };
      default:
        return {
          ...base,
          color: '#334155',
          fontWeight: 500
        };
    }
  };

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
      {/* Month Header */}
      <div className="bg-[#482860] text-white py-1 px-2 text-center">
        <h3 className="text-[11px] font-black tracking-wide font-sans">
          {month.name} {month.year}
        </h3>
      </div>

      {/* Weekday Header: S M T W T F S */}
      <div className="grid grid-cols-7 bg-[#475569] text-white text-[9px] font-bold text-center py-0.5 border-b border-slate-200">
        <div>S</div>
        <div>M</div>
        <div>T</div>
        <div>W</div>
        <div>T</div>
        <div>F</div>
        <div>S</div>
      </div>

      {/* Days Grid (7 columns) */}
      <div className="grid grid-cols-7 gap-y-0.5 p-1 text-center text-[10px]">
        {days.map((d, idx) => {
          if (d.dayNum === null) {
            return <div key={`empty-${idx}`} style={{ height: '20px' }} />;
          }

          const c = d.classification;

          return (
            <div
              key={d.dateStr}
              style={{
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
              title={c?.label}
            >
              <span style={getBadgeStyle(c?.type)}>
                <span
                  style={{
                    display: 'inline-block',
                    position: 'relative',
                    top: '-1px',
                    lineHeight: '1'
                  }}
                >
                  {d.dayNum}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
