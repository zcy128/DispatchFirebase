import React, { useState, useMemo } from 'react';
import { School, SchoolBoard, SchoolStats } from '../types/school';
import {
  Search,
  Filter,
  School as SchoolIcon,
  Building2,
  Users,
  Clock,
  MapPin,
  RefreshCw,
  Plus,
  Edit2,
  ChevronRight,
  ExternalLink,
  CalendarDays
} from 'lucide-react';

interface SchoolListViewProps {
  schools: School[];
  boards: SchoolBoard[];
  stats: SchoolStats;
  loading?: boolean;
  onRefresh?: () => void;
  onSelectSchool: (school: School) => void;
  onEditSchool: (school: School) => void;
  onCreateSchool: () => void;
  onEditBoard: (board: SchoolBoard) => void;
  onCreateBoard: () => void;
  onViewSchoolStudents?: (schoolId: number) => void;
  onViewSchoolCalendar?: (school: School) => void;
}

export const SchoolListView: React.FC<SchoolListViewProps> = ({
  schools,
  boards,
  stats,
  loading = false,
  onRefresh,
  onSelectSchool,
  onEditSchool,
  onCreateSchool,
  onEditBoard,
  onCreateBoard,
  onViewSchoolStudents,
  onViewSchoolCalendar
}) => {
  const [activeTab, setActiveTab] = useState<'schools' | 'boards'>('schools');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Compute school & student counts per board
  const boardMetrics = useMemo(() => {
    const metrics: Record<number, { schoolCount: number; studentCount: number }> = {};
    for (const s of schools) {
      if (!metrics[s.schoolBoardId]) {
        metrics[s.schoolBoardId] = { schoolCount: 0, studentCount: 0 };
      }
      metrics[s.schoolBoardId].schoolCount += 1;
      metrics[s.schoolBoardId].studentCount += (s.studentNum || 0);
    }
    return metrics;
  }, [schools]);

  // Filter schools
  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      if (selectedBoardId !== 'ALL' && s.schoolBoardId !== Number(selectedBoardId)) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && !s.isActive) return false;
      if (statusFilter === 'INACTIVE' && s.isActive) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        s.schoolName.toLowerCase().includes(term) ||
        s.schoolAddress?.toLowerCase().includes(term) ||
        s.contactPerson?.toLowerCase().includes(term) ||
        s.schoolBoardCode?.toLowerCase().includes(term) ||
        s.schoolBoardName?.toLowerCase().includes(term)
      );
    });
  }, [schools, selectedBoardId, statusFilter, searchTerm]);

  const getBoardBadgeColor = (code?: string) => {
    switch (code) {
      case 'OCDSB':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'OCSB':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'CEPEO':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 text-slate-100">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Schools & School Boards
            </h1>
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              {schools.length} Campuses
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            District educational authorities, campus locations, and daily bell timetables
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition shadow-sm disabled:opacity-50"
              title="Sync latest school database"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          )}

          {activeTab === 'schools' ? (
            <button
              onClick={onCreateSchool}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>New School</span>
            </button>
          ) : (
            <button
              onClick={onCreateBoard}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>New School Board</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Schools */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <SchoolIcon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Schools
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white font-mono">{stats.totalSchools}</span>
              <span className="text-xs text-emerald-400 font-semibold">{stats.activeSchools} Active</span>
            </div>
          </div>
        </div>

        {/* School Boards */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              School Boards
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white font-mono">{boards.length}</span>
              <span className="text-xs text-slate-400">Districts</span>
            </div>
          </div>
        </div>

        {/* Total Enrolled Students */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Enrolled Students
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white font-mono">{stats.totalStudents}</span>
              <span className="text-xs text-slate-400">Bus Riders</span>
            </div>
          </div>
        </div>

        {/* Operating Coverage */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Bell Schedules
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">100%</span>
              <span className="text-xs text-slate-400">Synchronized</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Header */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('schools')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'schools'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <SchoolIcon className="w-4 h-4" />
          <span>Schools Directory ({schools.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('boards')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'boards'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>School Boards ({boards.length})</span>
        </button>
      </div>

      {/* TAB CONTENT 1: SCHOOLS DIRECTORY */}
      {activeTab === 'schools' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by school name, address, contact person, or board..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition placeholder:text-slate-500"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Board Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedBoardId}
                  onChange={(e) => setSelectedBoardId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Boards ({schools.length})</option>
                  {boards.map((b) => (
                    <option key={b.schoolBoardId} value={b.schoolBoardId}>
                      {b.schoolBoardCode} ({boardMetrics[b.schoolBoardId]?.schoolCount || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* Schools Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60">
                  <tr>
                    <th className="py-3.5 px-4">School & Code</th>
                    <th className="py-3.5 px-4">School Board</th>
                    <th className="py-3.5 px-4">Address & Location</th>
                    <th className="py-3.5 px-4">Bell Times</th>
                    <th className="py-3.5 px-4">Enrolled</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredSchools.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <SchoolIcon className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="text-sm font-semibold">No schools match your search or filter criteria</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSchools.map((s) => (
                      <tr
                        key={s.id || s.schoolId}
                        onClick={() => onSelectSchool(s)}
                        className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                      >
                        {/* School Name & ID */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs flex-shrink-0">
                              <SchoolIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-amber-400 transition-colors">
                                {s.schoolName}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                ID: {s.id || `SCH-${s.schoolId}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* School Board Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getBoardBadgeColor(
                              s.schoolBoardCode
                            )}`}
                          >
                            {s.schoolBoardCode || 'Board'}
                          </span>
                        </td>

                        {/* Address */}
                        <td className="py-3.5 px-4 max-w-xs truncate">
                          <div className="flex items-center space-x-1.5 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate">{s.schoolAddress || 'No address'}</span>
                          </div>
                        </td>

                        {/* Bell Times */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {s.startTime || '08:30'}
                            </span>
                            <span className="text-slate-500">→</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {s.dismissalTime || '15:00'}
                            </span>
                          </div>
                        </td>

                        {/* Enrolled Students */}
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onViewSchoolStudents) onViewSchoolStudents(s.schoolId);
                            }}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition font-mono font-bold"
                            title="Click to view students attending this school"
                          >
                            <Users className="w-3 h-3" />
                            <span>{s.studentNum || 0}</span>
                          </button>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {s.isActive ? 'Active' : 'Closed'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {onViewSchoolCalendar && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewSchoolCalendar(s);
                                }}
                                className="p-1.5 text-slate-400 hover:text-teal-400 rounded-lg hover:bg-slate-800 transition"
                                title="View School Calendar"
                              >
                                <CalendarDays className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditSchool(s);
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition"
                              title="Edit school"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition" />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards Stream */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {filteredSchools.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <SchoolIcon className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
                  <p className="text-sm font-semibold">No schools match your filters</p>
                </div>
              ) : (
                filteredSchools.map((s) => (
                  <div
                    key={s.id || s.schoolId}
                    onClick={() => onSelectSchool(s)}
                    className="p-4 hover:bg-slate-800/40 active:bg-slate-800/70 transition cursor-pointer space-y-3"
                  >
                    {/* Header: Icon, Name, Board, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">
                          <SchoolIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">
                            {s.schoolName}
                          </div>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.2 rounded text-[10px] font-semibold border ${getBoardBadgeColor(
                                s.schoolBoardCode
                              )}`}
                            >
                              {s.schoolBoardCode || 'Board'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              ID: {s.id || `SCH-${s.schoolId}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                          s.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {s.isActive ? 'Active' : 'Closed'}
                      </span>
                    </div>

                    {/* Bell Times & Enrolled */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-1.5 font-mono text-[11px] bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                        <Clock className="w-3 h-3 text-slate-400 mr-0.5" />
                        <span className="text-emerald-400 font-semibold">{s.startTime || '08:30'}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-amber-400 font-semibold">{s.dismissalTime || '15:00'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onViewSchoolStudents) onViewSchoolStudents(s.schoolId);
                        }}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition font-mono text-xs font-semibold"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{s.studentNum || 0} Students</span>
                      </button>
                    </div>

                    {/* Address & Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      {s.schoolAddress ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${s.schoolName} ${s.schoolAddress}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-1 text-slate-400 hover:text-amber-400 truncate max-w-[200px]"
                          title="Open in Maps"
                        >
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{s.schoolAddress}</span>
                          <ExternalLink className="w-3 h-3 text-slate-600 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-xs italic">No address specified</span>
                      )}

                      <div
                        className="flex items-center space-x-1 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {onViewSchoolCalendar && (
                          <button
                            type="button"
                            onClick={() => onViewSchoolCalendar(s)}
                            className="p-1.5 text-slate-400 hover:text-teal-400 rounded-lg hover:bg-slate-800 transition"
                            title="View School Calendar"
                          >
                            <CalendarDays className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditSchool(s)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition"
                          title="Edit school"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectSchool(s)}
                          className="flex items-center space-x-1 text-slate-400 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition text-xs font-semibold"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: SCHOOL BOARDS */}
      {activeTab === 'boards' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {boards.map((b) => {
              const count = boardMetrics[b.schoolBoardId]?.schoolCount || 0;
              const stuCount = boardMetrics[b.schoolBoardId]?.studentCount || 0;
              return (
                <div
                  key={b.id || b.schoolBoardId}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${getBoardBadgeColor(b.schoolBoardCode)}`}>
                        {b.schoolBoardCode}
                      </span>
                      <button
                        onClick={() => onEditBoard(b)}
                        className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition"
                        title="Edit Board"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-white mt-3">
                      {b.schoolBoardName}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Board ID: #{b.schoolBoardId}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Schools
                      </span>
                      <span className="text-lg font-bold text-white font-mono">
                        {count}
                      </span>
                    </div>

                    <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Students
                      </span>
                      <span className="text-lg font-bold text-amber-400 font-mono">
                        {stuCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
