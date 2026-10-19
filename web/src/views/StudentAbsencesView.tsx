import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { StudentAbsenceRecord } from '../types/dispatch';
import { DispatchService } from '../services/dispatchService';
import { RecordStudentAbsenceModal } from '../components/dispatch/RecordStudentAbsenceModal';
import { Student } from '../types/student';

interface StudentAbsencesViewProps {
  onSelectStudent?: (studentId: number) => void;
  studentsMap?: Record<number, Student>;
}

export const StudentAbsencesView: React.FC<StudentAbsencesViewProps> = ({
  onSelectStudent,
  studentsMap = {},
}) => {
  // Helper to format date as YYYY-MM-DD
  const formatYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Today in YYYY-MM-DD
  const todayStr = useMemo(() => formatYMD(new Date()), []);

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

  // Modals
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [cancellingAbsence, setCancellingAbsence] = useState<StudentAbsenceRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Load absences from backend
  const fetchAbsences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DispatchService.listStudentAbsences(
        startDate,
        endDate,
        selectedRoute !== 'ALL' ? selectedRoute : undefined,
        undefined,
        selectedShiftType !== 'ALL' ? selectedShiftType : undefined
      );
      setAbsences(Array.isArray(data) ? data : ((data as any)?.data || []));
    } catch (err: any) {
      console.error('Failed to load student absences:', err);
      setError(err.message || 'Failed to load absence records');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedRoute, selectedShiftType]);

  useEffect(() => {
    fetchAbsences();
  }, [fetchAbsences]);

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

  // Filtered Absences by search term
  const filteredAbsences = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return absences;

    return absences.filter((a) => {
      const nameMatch = a.studentName.toLowerCase().includes(q);
      const noMatch = a.studentNo?.toLowerCase().includes(q);
      const idMatch = String(a.studentId).includes(q);
      const schoolMatch = a.schoolName?.toLowerCase().includes(q);
      const routeMatch = a.routeNo?.toLowerCase().includes(q);
      const reasonMatch = a.reason?.toLowerCase().includes(q);
      return nameMatch || noMatch || idMatch || schoolMatch || routeMatch || reasonMatch;
    });
  }, [absences, searchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = filteredAbsences.length;
    let upcoming = 0;
    let todayCount = 0;
    const routeCounts: Record<string, number> = {};

    filteredAbsences.forEach((a) => {
      if (a.date > todayStr) upcoming++;
      if (a.date === todayStr) todayCount++;
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

    return { total, upcoming, todayCount, topRoute };
  }, [filteredAbsences, todayStr]);

  // Cancel / Revoke Absence Handler
  const handleConfirmCancel = async () => {
    if (!cancellingAbsence) return;
    try {
      setIsCancelling(true);
      await DispatchService.cancelStudentAbsence(cancellingAbsence.id);
      setCancellingAbsence(null);
      await fetchAbsences();
    } catch (err: any) {
      alert('Failed to cancel absence: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCancelling(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredAbsences.length === 0) return;
    const headers = ['Date', 'Student ID', 'Student Name', 'School', 'Route', 'Shift Type', 'Reason', 'Reported By', 'Reported At'];
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
          Today
        </span>
      );
    }
    if (diffDays === 1) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
          Tomorrow
        </span>
      );
    }
    if (diffDays > 1) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          In {diffDays} days
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        Past
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
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Student Absences & Leave Log
              </h1>
              <p className="text-xs text-slate-400">
                Log and track student bus service leave requests across 2-week rolling schedules
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => fetchAbsences()}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh absence records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredAbsences.length === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
            title="Export to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Log Absence</span>
          </button>
        </div>
      </div>

      {/* 2. Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Range Total</span>
            <Calendar className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Records in current date filter</div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Upcoming Absences</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400">{metrics.upcoming}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Scheduled after today</div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Today's Absences</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{metrics.todayCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Riders excused today</div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Top Impact Route</span>
            <Bus className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-lg font-black text-rose-300 truncate">{metrics.topRoute}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Highest leave volume</div>
        </div>
      </div>

      {/* 3. Filter Bar (Date Range with 2-Week Default + Search + Route) */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3.5">
        {/* Preset Range Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              Range Preset:
            </span>

            <button
              onClick={() => handleApplyPreset('next2weeks')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                activePreset === 'next2weeks'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              Next 2 Weeks (Default)
            </button>

            <button
              onClick={() => handleApplyPreset('thisweek')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                activePreset === 'thisweek'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              This Week
            </button>

            <button
              onClick={() => handleApplyPreset('nextweek')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                activePreset === 'nextweek'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              Next Week
            </button>

            <button
              onClick={() => handleApplyPreset('past2weeks')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                activePreset === 'past2weeks'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              Past 2 Weeks
            </button>

            <button
              onClick={() => handleApplyPreset('thismonth')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                activePreset === 'thismonth'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              This Month
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">From:</span>
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

            <span className="text-slate-500 text-xs">to</span>

            <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">To:</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search student, ID, school, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 shrink-0">Route:</span>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500/50"
            >
              <option value="ALL">All Routes ({distinctRoutes.length})</option>
              {distinctRoutes.map((r) => (
                <option key={r} value={r}>
                  Route {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 shrink-0">Shift:</span>
            <select
              value={selectedShiftType}
              onChange={(e) => setSelectedShiftType(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500/50"
            >
              <option value="ALL">All Runs (AM & PM)</option>
              <option value="AM">AM Pickup Only</option>
              <option value="PM">PM Dropoff Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Table / Content Container */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
            <div className="text-sm font-semibold text-slate-300">Loading student absence log...</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <div className="text-sm font-bold text-rose-300">{error}</div>
            <button
              onClick={() => fetchAbsences()}
              className="px-4 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : filteredAbsences.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="text-base font-bold text-white">No absences recorded in this date range</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No students are currently scheduled absent between {startDate} and {endDate}. Click "Log Absence" to record upcoming leaves.
            </p>
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              + Log Student Absence
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Absence Date</th>
                  <th className="py-3 px-4">Student Rider</th>
                  <th className="py-3 px-4">School & Route</th>
                  <th className="py-3 px-4">Shift Scope</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Reported By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredAbsences.map((rec) => {
                  const studentObj = studentsMap[rec.studentId];

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* Date & Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-white text-xs">{rec.date}</span>
                          {getRelativeDayBadge(rec.date)}
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
                            <span>Route {rec.routeNo}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">All Assigned Routes</span>
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
                          {rec.shiftType ? `${rec.shiftType} Run` : 'ALL Runs'}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4">
                        <div className="text-slate-200 text-xs font-semibold max-w-xs break-words">
                          {rec.reason || 'Excused / Absent'}
                        </div>
                      </td>

                      {/* Reported By & Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-300 font-medium">{rec.reportedBy || 'Dispatcher'}</span>
                          {rec.reportedBy?.toLowerCase().includes('parent') && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase">
                              Parent
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
                              title="View student profile details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setCancellingAbsence(rec)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Cancel absence & restore student to bus roster"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Record Absence Modal */}
      <RecordStudentAbsenceModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        initialDate={todayStr}
        onAbsenceRecorded={() => {
          fetchAbsences();
        }}
      />

      {/* 6. Cancel Absence Confirmation Dialog */}
      {cancellingAbsence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Cancel Student Absence?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to cancel the absence for <strong className="text-white">{cancellingAbsence.studentName}</strong> on <strong className="text-white">{cancellingAbsence.date}</strong>?
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  This will restore the student as an active rider on the scheduled route runs for that day.
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
                Keep Absence
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
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Confirm Cancel</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
