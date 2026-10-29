import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  UserX,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  Download,
  AlertCircle,
  Clock,
  Bus,
  CheckCircle2,
  Trash2,
  Eye,
  ChevronRight,
  Database,
  Info,
  ArrowUpDown,
  Lock,
  GraduationCap
} from 'lucide-react';
import { StudentAbsenceRecord } from '../types/dispatch';
import { DispatchService } from '../services/dispatchService';
import { RecordStudentAbsenceModal } from '../components/dispatch/RecordStudentAbsenceModal';
import { Student } from '../types/student';
import { useI18n } from '../contexts/I18nContext';

interface StudentAbsencesViewProps {
  onSelectStudent?: (studentId: number) => void;
  studentsMap?: Record<number, Student>;
}

export const StudentAbsencesView: React.FC<StudentAbsencesViewProps> = ({
  onSelectStudent,
  studentsMap = {},
}) => {
  const { isFrench } = useI18n();

  // Helper to format date as YYYY-MM-DD
  const formatYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Today in YYYY-MM-DD
  const todayStr = useMemo(() => formatYMD(new Date()), []);

  // Generate the past 10 academic school years (August 1 to July 31)
  const schoolYears = useMemo(() => {
    const now = new Date();
    // School year starts August 1st (month 7 in 0-indexed JS: 0=Jan, 7=Aug)
    const currentSchoolYearStart = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const years: Array<{
      key: string;
      label: string;
      shortLabel: string;
      startYear: number;
      endYear: number;
      startDate: string;
      endDate: string;
      isCurrent: boolean;
    }> = [];

    for (let i = 0; i < 10; i++) {
      const sy = currentSchoolYearStart - i;
      const ey = sy + 1;
      const sDate = `${sy}-08-01`;
      const eDate = `${ey}-07-31`;
      const isCurrent = i === 0;
      years.push({
        key: `sy-${sy}`,
        label: `${sy}-${ey} (${isFrench ? 'août' : 'Aug'} ${sy} - ${isFrench ? 'juil.' : 'Jul'} ${ey})${isCurrent ? (isFrench ? ' [En cours]' : ' [Current]') : ''}`,
        shortLabel: `${sy}-${ey}`,
        startYear: sy,
        endYear: ey,
        startDate: sDate,
        endDate: eDate,
        isCurrent,
      });
    }
    return years;
  }, [isFrench]);

  // Time Range Mode: '6months' (Live Data <= 6 Months) | 'all' (BigQuery Cold Archive > 6 Months)
  const [timeRange, setTimeRange] = useState<'6months' | 'all'>('6months');

  // Default date range: 2 weeks starting from today
  const defaultRange = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return {
      start: formatYMD(start),
      end: formatYMD(end),
    };
  }, []);

  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);
  const [activePreset, setActivePreset] = useState<string>('next2weeks');

  const [absences, setAbsences] = useState<StudentAbsenceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [selectedShiftType, setSelectedShiftType] = useState<string>('ALL');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Modals
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [cancellingAbsence, setCancellingAbsence] = useState<StudentAbsenceRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Load absences from backend (Hybrid Dual-Engine: Firestore <= 6mo, BigQuery > 6mo)
  const fetchAbsences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DispatchService.listStudentAbsences(
        startDate,
        endDate,
        selectedRoute !== 'ALL' ? selectedRoute : undefined,
        undefined,
        selectedShiftType !== 'ALL' ? selectedShiftType : undefined,
        searchTerm.trim() || undefined
      );
      setAbsences(Array.isArray(data) ? data : ((data as any)?.data || []));
    } catch (err: any) {
      console.error('Failed to load student absences:', err);
      setError(err.message || (isFrench ? 'Échec du chargement des absences' : 'Failed to load absence records'));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedRoute, selectedShiftType, searchTerm, isFrench]);

  useEffect(() => {
    fetchAbsences();
  }, [fetchAbsences]);

  // Check if an absence record originates from BigQuery cold storage
  const isColdRecord = useCallback((rec: StudentAbsenceRecord): boolean => {
    if (rec.isCold || rec.isArchivedToBigQuery) return true;
    return DispatchService.isColdAbsence(rec.date);
  }, []);

  // Handle Time Range Toggle
  const handleTimeRangeToggle = (newRange: '6months' | 'all') => {
    setTimeRange(newRange);
    const now = new Date();
    if (newRange === '6months') {
      const end = new Date();
      end.setDate(now.getDate() + 14);
      setStartDate(formatYMD(now));
      setEndDate(formatYMD(end));
      setActivePreset('next2weeks');
    } else {
      // All History mode: default to the current academic school year
      const defaultSY = schoolYears[0] || {
        key: 'sy-2026',
        startDate: '2026-08-01',
        endDate: '2027-07-31',
      };
      setStartDate(defaultSY.startDate);
      setEndDate(defaultSY.endDate);
      setActivePreset(defaultSY.key);
    }
  };

  // Date Range Quick Preset Handlers
  const handleApplyPreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === 'next2weeks') {
      const end = new Date();
      end.setDate(now.getDate() + 14);
      setStartDate(formatYMD(now));
      setEndDate(formatYMD(end));
    } else if (preset === 'thisweek') {
      const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon
      const mon = new Date(now);
      mon.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4);
      setStartDate(formatYMD(mon));
      setEndDate(formatYMD(fri));
    } else if (preset === 'nextweek') {
      const dayOfWeek = now.getDay();
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek));
      const nextFri = new Date(nextMon);
      nextFri.setDate(nextMon.getDate() + 4);
      setStartDate(formatYMD(nextMon));
      setEndDate(formatYMD(nextFri));
    } else if (preset === 'past2weeks') {
      const start = new Date();
      start.setDate(now.getDate() - 14);
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(now));
    } else if (preset === 'thismonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(end));
    } else if (preset === 'past6months') {
      const start = new Date();
      start.setMonth(now.getMonth() - 6);
      const end = new Date();
      end.setDate(now.getDate() + 14);
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(end));
    } else if (preset === 'all-10-years') {
      if (schoolYears.length > 0) {
        setStartDate(schoolYears[schoolYears.length - 1].startDate);
        setEndDate(schoolYears[0].endDate);
      }
    } else if (preset.startsWith('sy-')) {
      const sy = schoolYears.find((y) => y.key === preset);
      if (sy) {
        setStartDate(sy.startDate);
        setEndDate(sy.endDate);
      }
    }
  };

  // Distinct Route Numbers across loaded records
  const distinctRoutes = useMemo(() => {
    const set = new Set<string>();
    absences.forEach((a) => {
      if (a.routeNo) set.add(a.routeNo);
    });
    return Array.from(set).sort();
  }, [absences]);

  // Filtered & Sorted Absences
  const filteredAbsences = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    let list = absences;

    if (q) {
      list = absences.filter((a) => {
        const nameMatch = a.studentName.toLowerCase().includes(q);
        const noMatch = a.studentNo?.toLowerCase().includes(q);
        const idMatch = String(a.studentId).includes(q);
        const schoolMatch = a.schoolName?.toLowerCase().includes(q);
        const routeMatch = a.routeNo?.toLowerCase().includes(q);
        const reasonMatch = a.reason?.toLowerCase().includes(q);
        return nameMatch || noMatch || idMatch || schoolMatch || routeMatch || reasonMatch;
      });
    }

    // Sort by date (descending by default so newest / upcoming appear first)
    return [...list].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return sortDirection === 'desc'
          ? dateB.localeCompare(dateA)
          : dateA.localeCompare(dateB);
      }
      return a.studentName.localeCompare(b.studentName);
    });
  }, [absences, searchTerm, sortDirection]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = filteredAbsences.length;
    let upcoming = 0;
    let todayCount = 0;
    let coldCount = 0;
    const routeCounts: Record<string, number> = {};

    filteredAbsences.forEach((a) => {
      if (a.date > todayStr) upcoming++;
      if (a.date === todayStr) todayCount++;
      if (isColdRecord(a)) coldCount++;
      if (a.routeNo) {
        routeCounts[a.routeNo] = (routeCounts[a.routeNo] || 0) + 1;
      }
    });

    let topRoute = '-';
    let maxRouteCount = 0;
    Object.entries(routeCounts).forEach(([r, count]) => {
      if (count > maxRouteCount) {
        maxRouteCount = count;
        topRoute = `${r} (${count})`;
      }
    });

    return { total, upcoming, todayCount, coldCount, topRoute };
  }, [filteredAbsences, todayStr, isColdRecord]);

  // Virtual scrolling for 1,000+ student absence records
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredAbsences.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  // Cancel / Revoke Absence Handler
  const handleConfirmCancel = async () => {
    if (!cancellingAbsence) return;
    try {
      setIsCancelling(true);
      await DispatchService.cancelStudentAbsence(cancellingAbsence.id);
      setCancellingAbsence(null);
      await fetchAbsences();
    } catch (err: any) {
      alert((isFrench ? 'Échec de l\'annulation : ' : 'Failed to cancel absence: ') + (err.message || 'Unknown error'));
    } finally {
      setIsCancelling(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredAbsences.length === 0) return;
    const headers = [
      'Date',
      'Student ID',
      'Student Name',
      'School',
      'Route',
      'Shift Type',
      'Reason',
      'Reported By',
      'Reported At',
      'Archived to BigQuery'
    ];
    const rows = filteredAbsences.map((a) => [
      `"${a.date}"`,
      `"${a.studentId}"`,
      `"${a.studentName}"`,
      `"${a.schoolName || ''}"`,
      `"${a.routeNo || ''}"`,
      `"${a.shiftType || 'ALL'}"`,
      `"${a.reason.replace(/"/g, '""')}"`,
      `"${a.reportedBy || ''}"`,
      `"${a.reportedAt || ''}"`,
      `"${isColdRecord(a) ? 'YES' : 'NO'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `student_absences_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute Relative Day Badge
  const getRelativeDayBadge = (dateStr: string) => {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          {isFrench ? 'Aujourd\'hui' : 'Today'}
        </span>
      );
    }
    if (diffDays === 1) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
          {isFrench ? 'Demain' : 'Tomorrow'}
        </span>
      );
    }
    if (diffDays > 1) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          {isFrench ? `Dans ${diffDays} j` : `In ${diffDays} days`}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        {isFrench ? 'Passé' : 'Past'}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl shadow-xs">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {isFrench ? 'Registre des absences & congés des élèves' : 'Student Absences & Leave Log'}
                </h1>
                {timeRange === '6months' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isFrench ? 'En direct (≤6 mois)' : 'Live Data (≤6 Months)'}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isFrench ? 'Archive BigQuery (>6 mois)' : 'BigQuery Archive (>6 Months)'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isFrench
                  ? 'Consultez et suivez les absences au transport scolaire en direct (≤6 mois) ou dans les archives froides BigQuery par année scolaire'
                  : 'Log and track student bus service leave requests across live schedules (≤6 months) or BigQuery archives by school year'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          {/* Time Range Filter Toggle (6 Months Live vs All History BigQuery) */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleTimeRangeToggle('6months')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                timeRange === '6months'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isFrench ? 'En direct (≤6 mois)' : 'Live (≤6 Months)'}
            </button>
            <button
              type="button"
              onClick={() => handleTimeRangeToggle('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                timeRange === 'all'
                  ? 'bg-sky-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🧊 {isFrench ? 'Tout l\'historique (Archive BigQuery)' : 'All History (BigQuery Archive)'}</span>
            </button>
          </div>

          <button
            onClick={() => fetchAbsences()}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title={isFrench ? 'Actualiser les absences' : 'Refresh absence records'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredAbsences.length === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
            title={isFrench ? 'Exporter CSV' : 'Export to CSV'}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isFrench ? 'Exporter CSV' : 'Export CSV'}</span>
          </button>

          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{isFrench ? 'Enregistrer une absence' : 'Log Absence'}</span>
          </button>
        </div>
      </div>

      {/* 2. Notice Banner when in BigQuery Historical Mode */}
      {timeRange === 'all' && (
        <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-start gap-3 text-xs text-sky-300">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-sky-200 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-sky-400" />
              <span>{isFrench ? 'Mode Tout l\'historique (Archive froide BigQuery par année scolaire)' : 'All History Mode (BigQuery Cold Archive by School Year)'}</span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-medium border border-sky-500/30">
                {isFrench ? '10 années scolaires (août à juillet)' : '10 School Years (Aug - Jul)'}
              </span>
            </div>
            <p className="text-slate-300">
              {isFrench
                ? 'Sélectionnez une année scolaire (du 1er août au 31 juillet) parmi les 10 dernières années archivées dans Google BigQuery, ou choisissez les 10 années complètes. Pour optimiser les performances, vous pouvez filtrer par élève, matricule, école ou route.'
                : 'Select an academic school year (August 1 to July 31) from the past 10 years stored in Google BigQuery cold archives, or choose all 10 years. Filter by student, ID, school, or route to optimize retrieval.'}
            </p>
          </div>
        </div>
      )}

      {/* 3. Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>{isFrench ? 'Total de la période' : 'Range Total'}</span>
            <Calendar className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics.coldCount > 0
              ? (isFrench ? `${metrics.coldCount} issus de BigQuery (>6m)` : `${metrics.coldCount} from BigQuery (>6m)`)
              : (isFrench ? 'Dossiers selon les filtres' : 'Records in current date filter')}
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>{isFrench ? 'Absences à venir' : 'Upcoming Absences'}</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400">{metrics.upcoming}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {isFrench ? 'Prévues après aujourd\'hui' : 'Scheduled after today'}
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>{isFrench ? 'Absences aujourd\'hui' : 'Today\'s Absences'}</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{metrics.todayCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {isFrench ? 'Passagers excusés ce jour' : 'Riders excused today'}
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>{isFrench ? 'Ligne la plus touchée' : 'Top Impact Route'}</span>
            <Bus className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-lg font-black text-rose-300 truncate">{metrics.topRoute}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {isFrench ? 'Plus fort volume d\'absences' : 'Highest leave volume'}
          </div>
        </div>
      </div>

      {/* 4. Filter Bar (Preset Range + Date Range Picker + Search + Route & Shift) */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3.5">
        {/* Preset Range Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {timeRange === '6months' ? (
              <>
                <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  {isFrench ? 'Période :' : 'Range Preset:'}
                </span>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('next2weeks')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                    activePreset === 'next2weeks'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isFrench ? '2 prochaines semaines (Défaut)' : 'Next 2 Weeks (Default)'}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('thisweek')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                    activePreset === 'thisweek'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isFrench ? 'Cette semaine' : 'This Week'}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('nextweek')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                    activePreset === 'nextweek'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isFrench ? 'Semaine prochaine' : 'Next Week'}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('past2weeks')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                    activePreset === 'past2weeks'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isFrench ? '2 dernières semaines' : 'Past 2 Weeks'}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('thismonth')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                    activePreset === 'thismonth'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isFrench ? 'Ce mois-ci' : 'This Month'}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('past6months')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                    activePreset === 'past6months'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isFrench ? '6 derniers mois (En direct)' : 'Past 6 Months (Live)'}
                </button>
              </>
            ) : (
              /* All History Mode: School Year Range Selection (Past 10 Years) */
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1 shrink-0">
                    <GraduationCap className="w-4 h-4 text-sky-400" />
                    <span>{isFrench ? 'Année scolaire :' : 'School Year:'}</span>
                  </span>
                  <select
                    value={activePreset}
                    onChange={(e) => handleApplyPreset(e.target.value)}
                    className="py-1 px-2.5 bg-slate-950 border border-sky-500/40 rounded-xl text-xs font-semibold text-sky-200 focus:outline-none focus:border-sky-400"
                  >
                    <option value="all-10-years">
                      {isFrench
                        ? `Toutes les 10 années (${schoolYears[schoolYears.length - 1]?.startYear}-${schoolYears[0]?.endYear})`
                        : `All 10 School Years (${schoolYears[schoolYears.length - 1]?.startYear}-${schoolYears[0]?.endYear})`}
                    </option>
                    {schoolYears.map((sy) => (
                      <option key={sy.key} value={sy.key}>
                        {sy.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick-Access Pills for the 10 School Years */}
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('all-10-years')}
                    className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition flex items-center gap-1 ${
                      activePreset === 'all-10-years'
                        ? 'bg-sky-500 text-slate-950 border-sky-500 shadow-sm'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Database className="w-3 h-3" />
                    <span>{isFrench ? '10 ans' : '10y'}</span>
                  </button>
                  {schoolYears.map((sy) => (
                    <button
                      key={sy.key}
                      type="button"
                      onClick={() => handleApplyPreset(sy.key)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition ${
                        activePreset === sy.key
                          ? 'bg-sky-500 text-slate-950 border-sky-500 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                      title={`${sy.startDate} ~ ${sy.endDate}`}
                    >
                      {sy.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">{isFrench ? 'De :' : 'From:'}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="bg-transparent text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <span className="text-slate-500 text-xs">{isFrench ? 'à' : 'to'}</span>

            <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">{isFrench ? 'À :' : 'To:'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="bg-transparent text-xs font-mono text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Search, Route & Shift Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={isFrench ? 'Rechercher un élève, matricule, école, route ou motif...' : 'Search student, ID, school, route, or reason...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 shrink-0">{isFrench ? 'Circuit :' : 'Route:'}</span>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500/50"
            >
              <option value="ALL">{isFrench ? `Tous les circuits (${distinctRoutes.length})` : `All Routes (${distinctRoutes.length})`}</option>
              {distinctRoutes.map((r) => (
                <option key={r} value={r}>
                  {isFrench ? `Circuit ${r}` : `Route ${r}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 shrink-0">{isFrench ? 'Service :' : 'Shift:'}</span>
            <select
              value={selectedShiftType}
              onChange={(e) => setSelectedShiftType(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500/50"
            >
              <option value="ALL">{isFrench ? 'Tous les trajets (AM & PM)' : 'All Runs (AM & PM)'}</option>
              <option value="AM">{isFrench ? 'Matin (AM) seulement' : 'AM Pickup Only'}</option>
              <option value="PM">{isFrench ? 'Après-midi (PM) seulement' : 'PM Dropoff Only'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Table / Content Container */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
            <div className="text-sm font-semibold text-slate-300">
              {isFrench ? 'Chargement du registre des absences...' : 'Loading student absence log...'}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <div className="text-sm font-bold text-rose-300">{error}</div>
            <button
              onClick={() => fetchAbsences()}
              className="px-4 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
            >
              {isFrench ? 'Réessayer' : 'Retry'}
            </button>
          </div>
        ) : filteredAbsences.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              {timeRange === 'all' ? (
                <Database className="w-7 h-7 text-sky-400" />
              ) : (
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              )}
            </div>
            <div className="text-base font-bold text-white">
              {timeRange === 'all'
                ? (isFrench ? 'Aucune absence trouvée dans BigQuery' : 'No absences found in BigQuery archives')
                : (isFrench ? 'Aucune absence enregistrée pour cette période' : 'No absences recorded in this date range')}
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {timeRange === 'all'
                ? (isFrench
                    ? `Aucun dossier d'absence correspondant entre le ${startDate} et le ${endDate}. Vous pouvez changer d'année scolaire ou modifier les filtres.`
                    : `No absence records matched between ${startDate} and ${endDate}. Try selecting another school year or adjusting your filters.`)
                : (isFrench
                    ? `Aucun élève n'est prévu absent entre le ${startDate} et le ${endDate}. Cliquez sur « Enregistrer une absence » pour consigner les congés prévus.`
                    : `No students are currently scheduled absent between ${startDate} and ${endDate}. Click "Log Absence" to record upcoming leaves.`)}
            </p>
            {timeRange === '6months' && (
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                + {isFrench ? 'Enregistrer une absence' : 'Log Student Absence'}
              </button>
            )}
          </div>
        ) : (
          <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[960px]">
              <colgroup>
                <col style={{ width: '160px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ minWidth: '180px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '90px' }} />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] shadow-xs">
                <tr>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-1.5 hover:text-white transition group/sort"
                      title={isFrench ? 'Trier par date' : 'Sort by date'}
                    >
                      <span>{isFrench ? 'Date d\'absence' : 'Absence Date'}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 group-hover/sort:text-white transition" />
                      <span className="text-[10px] font-mono lowercase text-slate-500 font-normal">
                        ({sortDirection})
                      </span>
                    </button>
                  </th>
                  <th className="py-3 px-4">{isFrench ? 'Élève passager' : 'Student Rider'}</th>
                  <th className="py-3 px-4">{isFrench ? 'École & Circuit' : 'School & Route'}</th>
                  <th className="py-3 px-4">{isFrench ? 'Période du service' : 'Shift Scope'}</th>
                  <th className="py-3 px-4">{isFrench ? 'Motif / Remarques' : 'Reason / Notes'}</th>
                  <th className="py-3 px-4">{isFrench ? 'Signalé par' : 'Reported By'}</th>
                  <th className="py-3 px-4 text-right">{isFrench ? 'Actions' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={7} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const rec = filteredAbsences[virtualRow.index];
                  if (!rec) return null;
                  const studentObj = studentsMap[rec.studentId];
                  const isCold = isColdRecord(rec);

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-800/40 transition group h-14"
                    >
                      {/* Date & Badges */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-white text-xs">{rec.date}</span>
                            {getRelativeDayBadge(rec.date)}
                          </div>
                          {isCold && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap">
                              <Database className="w-2.5 h-2.5" />
                              <span>{isFrench ? 'Archive BigQuery (>6m)' : 'BigQuery Archive (>6m)'}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Student Rider */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {rec.studentName ? rec.studentName[0] : 'S'}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => onSelectStudent?.(rec.studentId)}
                              className="font-bold text-white hover:text-sky-400 transition text-left flex items-center gap-1 group/btn"
                            >
                              <span>{rec.studentName}</span>
                              <ChevronRight className="w-3 h-3 text-slate-500 group-hover/btn:translate-x-0.5 transition" />
                            </button>
                            <div className="text-[11px] text-slate-400 font-mono">
                              ID: {rec.studentNo || rec.studentId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* School & Route */}
                      <td className="py-3 px-4">
                        <div className="text-slate-300 font-medium truncate max-w-[200px]" title={rec.schoolName}>
                          {rec.schoolName || studentObj?.schoolName || '—'}
                        </div>
                        {rec.routeNo ? (
                          <div className="flex items-center space-x-1 text-slate-400 text-[11px] font-mono mt-0.5">
                            <Bus className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{isFrench ? `Circuit ${rec.routeNo}` : `Route ${rec.routeNo}`}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">
                            {isFrench ? 'Tous circuits assignés' : 'All Assigned Routes'}
                          </span>
                        )}
                      </td>

                      {/* Shift Scope */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            rec.shiftType === 'AM'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : rec.shiftType === 'PM'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {rec.shiftType === 'AM'
                            ? (isFrench ? 'Matin (AM)' : 'AM Pickup')
                            : rec.shiftType === 'PM'
                            ? (isFrench ? 'Après-midi (PM)' : 'PM Dropoff')
                            : (isFrench ? 'Tous trajets' : 'ALL Runs')}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4">
                        <div className="text-slate-200 text-xs font-semibold max-w-xs break-words">
                          {rec.reason || (isFrench ? 'Excusé / Absent' : 'Excused / Absent')}
                        </div>
                      </td>

                      {/* Reported By & Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-300 font-medium">
                            {rec.reportedBy || (isFrench ? 'Régulateur' : 'Dispatcher')}
                          </span>
                          {rec.reportedBy?.toLowerCase().includes('parent') && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase">
                              {isFrench ? 'Parent' : 'Parent'}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[10px]">{rec.reportedAt || rec.createdAt || '—'}</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {onSelectStudent && (
                            <button
                              type="button"
                              onClick={() => onSelectStudent(rec.studentId)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition"
                              title={isFrench ? 'Voir le profil de l\'élève' : 'View student profile details'}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          {isCold ? (
                            <span
                              title={isFrench ? 'Archive BigQuery historique (Lecture seule)' : 'Historical BigQuery archive (Read-only)'}
                              className="p-1.5 rounded-lg text-slate-600 cursor-not-allowed"
                            >
                              <Lock className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancellingAbsence(rec)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                              title={isFrench ? 'Annuler l\'absence et réintégrer l\'élève au circuit' : 'Cancel absence & restore student to bus roster'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={7} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Record Absence Modal */}
      <RecordStudentAbsenceModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        initialDate={todayStr}
        onAbsenceRecorded={() => {
          fetchAbsences();
        }}
      />

      {/* 7. Cancel Absence Confirmation Dialog */}
      {cancellingAbsence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isFrench ? 'Annuler l\'absence de l\'élève ?' : 'Cancel Student Absence?'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isFrench ? (
                    <>
                      Voulez-vous vraiment annuler l'absence de <strong className="text-white">{cancellingAbsence.studentName}</strong> pour le <strong className="text-white">{cancellingAbsence.date}</strong> ?
                    </>
                  ) : (
                    <>
                      Are you sure you want to cancel the absence for <strong className="text-white">{cancellingAbsence.studentName}</strong> on <strong className="text-white">{cancellingAbsence.date}</strong>?
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isFrench
                    ? 'L\'élève sera réintégré comme passager actif sur la feuille de route du jour.'
                    : 'This will restore the student as an active rider on the scheduled route runs for that day.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancellingAbsence(null)}
                disabled={isCancelling}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition"
              >
                {isFrench ? 'Garder l\'absence' : 'Keep Absence'}
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md transition flex items-center space-x-1.5"
              >
                {isCancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isFrench ? 'Annulation...' : 'Cancelling...'}</span>
                  </>
                ) : (
                  <span>{isFrench ? 'Confirmer l\'annulation' : 'Confirm Cancel'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
