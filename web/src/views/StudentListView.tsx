import React, { useState, useRef, useEffect, useMemo, useDeferredValue } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Student, StudentContact, StudentStats } from '../types/student';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import { School } from '../types/school';
import { StudentService } from '../services/studentService';
import {
  Search,
  Filter,
  GraduationCap,
  School as SchoolIcon,
  Bus,
  RefreshCw,
  Phone,
  ChevronRight,
  ChevronDown,
  Users,
  Edit2,
  Plus,
  Trash2,
  MessageSquare,
  Globe,
  Check,
  X,
  Sparkles,
  ArrowRight,
  Loader2,
  Download
} from 'lucide-react';
import { RouteService } from '../services/routeService';
import {
  extractStudentStopsFromShifts,
  generateDefaultStudentStops
} from '../utils/studentStopsHelper';
import { exportStudentPdf } from '../utils/studentPdfExporter';
import { CreateParentChannelPayload } from '../types/chat';
import type { StudentModalTab } from '../components/students/StudentModal';

const AVAILABLE_GRADES = ['JK', 'SK', '1', '2', '3', '4', '5', '6', '7', '8'] as const;

interface StudentListViewProps {
  students?: Student[];
  schools: School[];
  stats: StudentStats;
  loading?: boolean;
  onRefresh?: () => void;
  onSelectStudent: (student: Student) => void;
  onSelectSchool?: (schoolId?: number, schoolName?: string) => void;
  onEditStudent?: (student: Student, initialTab?: StudentModalTab) => void;
  onViewStudentStops?: (student: Student) => void;
  onCreateStudent?: () => void;
  onDeleteStudent?: (student: Student) => void;
  onMessageParent?: (payload: CreateParentChannelPayload) => void;
  onStudentsLoaded?: (students: Student[]) => void;
}

export const StudentListView: React.FC<StudentListViewProps> = ({
  students = [],
  schools,
  stats,
  onRefresh,
  onSelectStudent,
  onSelectSchool,
  onEditStudent,
  onViewStudentStops,
  onCreateStudent,
  onDeleteStudent,
  onMessageParent,
  onStudentsLoaded,
}) => {
  const handleOpenStops = (student: Student) => {
    if (onViewStudentStops) {
      onViewStudentStops(student);
    } else if (onEditStudent) {
      onEditStudent(student, 'stops');
    } else {
      onSelectStudent(student);
    }
  };
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);

  const handleExportStudentPdf = async (stu: Student) => {
    if (exportingPdfId) return;
    setExportingPdfId(stu.id);
    try {
      const matchedSchool = schools.find((sch) => sch.schoolId === stu.schoolId) || null;
      let resolvedStops = Array.isArray(stu.stops) ? stu.stops : [];
      try {
        const allShifts = await RouteService.getAllShifts();
        const activeShifts = (allShifts || []).filter((sh) => sh.active !== false);
        const extracted = extractStudentStopsFromShifts(
          stu.studentId,
          stu.studentNo,
          stu.fullName || stu.studentName,
          activeShifts
        );
        if (extracted.length > 0) {
          resolvedStops = extracted;
        }
      } catch {
        // Fallback to student.stops or generated default stops
      }
      if (resolvedStops.length === 0) {
        resolvedStops = generateDefaultStudentStops(
          stu.studentAddress || '',
          stu.schoolName || (matchedSchool ? matchedSchool.schoolName : ''),
          stu.routes || ''
        );
      }
      exportStudentPdf({ student: stu, school: matchedSchool, stops: resolvedStops });
    } finally {
      setExportingPdfId(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  // School selection defaults to saved preference or first active school
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    const saved = localStorage.getItem('last_selected_school_id');
    if (saved && (saved === 'ALL' || schools.some((s) => String(s.schoolId) === saved))) {
      return saved;
    }
    return schools.length > 0 ? String(schools[0].schoolId) : 'ALL';
  });

  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [routeFilter, setRouteFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [metAtBusOnly, setMetAtBusOnly] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // School Quick-Switcher Popover state
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const schoolDropdownRef = useRef<HTMLDivElement>(null);

  // Sync selectedSchoolId once schools prop hydrates if previously uninitialized
  useEffect(() => {
    if (selectedSchoolId === 'ALL' && schools.length > 0) {
      const saved = localStorage.getItem('last_selected_school_id');
      if (!saved) {
        setSelectedSchoolId(String(schools[0].schoolId));
      }
    }
  }, [schools, selectedSchoolId]);

  const handleSelectSchool = (schoolIdStr: string) => {
    setSelectedSchoolId(schoolIdStr);
    localStorage.setItem('last_selected_school_id', schoolIdStr);
    setIsSchoolDropdownOpen(false);
    setSchoolSearchQuery('');
  };

  // State for on-demand school student records
  const [loadedSchoolStudents, setLoadedSchoolStudents] = useState<Student[]>([]);
  const [loadingSchoolStudents, setLoadingSchoolStudents] = useState<boolean>(false);
  const [rosterLive, setRosterLive] = useState<boolean>(false);

  // Dynamic onSnapshot listener scoped strictly to the selected school
  useEffect(() => {
    let isCancelled = false;
    setLoadingSchoolStudents(true);

    if (selectedSchoolId === 'ALL') {
      setRosterLive(false);
      StudentService.list()
        .then((list) => {
          if (!isCancelled) {
            setLoadedSchoolStudents(list);
            setLoadingSchoolStudents(false);
            onStudentsLoaded?.(list);
          }
        })
        .catch((err) => {
          console.error('Failed to load district-wide students:', err);
          if (!isCancelled) setLoadingSchoolStudents(false);
        });
      return () => {
        isCancelled = true;
      };
    }

    const sId = Number(selectedSchoolId);
    let live = true;
    const unsub = StudentService.subscribeToSchoolStudents(
      sId,
      (list) => {
        if (!isCancelled) {
          setLoadedSchoolStudents(list);
          setLoadingSchoolStudents(false);
          setRosterLive(live);
          onStudentsLoaded?.(list);
        }
      },
      (err) => {
        live = false;
        console.error(`Error subscribing to school ${sId}:`, err);
        if (!isCancelled) {
          setLoadingSchoolStudents(false);
          setRosterLive(false);
        }
      }
    );

    return () => {
      isCancelled = true;
      unsub();
    };
  }, [selectedSchoolId, onStudentsLoaded]);

  // Active student pool: prioritize on-demand loaded students, fallback to props
  const activeStudents = useMemo(() => {
    if (loadedSchoolStudents.length > 0 || selectedSchoolId !== 'ALL') {
      return loadedSchoolStudents;
    }
    return students;
  }, [loadedSchoolStudents, selectedSchoolId, students]);

  // Server-side cross-school search results (targeted query on-demand)
  const [crossSchoolMatches, setCrossSchoolMatches] = useState<Student[]>([]);
  const [isCrossSearching, setIsCrossSearching] = useState<boolean>(false);

  // Debounced server-side cross-school search
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2 || selectedSchoolId === 'ALL') {
      setCrossSchoolMatches([]);
      setIsCrossSearching(false);
      return;
    }

    setIsCrossSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await StudentService.search(term);
        const currentSid = Number(selectedSchoolId);
        const list = Array.isArray(results) ? results : [];
        const otherMatches = list.filter((s) => s.schoolId !== currentSid);
        setCrossSchoolMatches(otherMatches);
      } catch (err) {
        console.warn('Cross-school search failed:', err);
        setCrossSchoolMatches([]);
      } finally {
        setIsCrossSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedSchoolId]);

  // Close school popover on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (schoolDropdownRef.current && !schoolDropdownRef.current.contains(e.target as Node)) {
        setIsSchoolDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSchoolDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (selectedSchoolId === 'ALL') {
        const list = await StudentService.list();
        setLoadedSchoolStudents(list);
        onStudentsLoaded?.(list);
      } else {
        const list = await StudentService.list({ schoolId: Number(selectedSchoolId) });
        setLoadedSchoolStudents(list);
        onStudentsLoaded?.(list);
      }
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Refresh students failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Pre-calculate student counts per school for accurate live badges
  const schoolStudentCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const sch of schools) {
      counts[sch.schoolId] = sch.studentNum || 0;
    }
    if (selectedSchoolId !== 'ALL' && loadedSchoolStudents.length > 0) {
      counts[Number(selectedSchoolId)] = loadedSchoolStudents.length;
    }
    return counts;
  }, [schools, selectedSchoolId, loadedSchoolStudents.length]);

  // Pre-index schools for O(1) retrieval
  const schoolsById = useMemo(() => {
    const map = new Map<number, School>();
    for (const s of schools) {
      map.set(s.schoolId, s);
    }
    return map;
  }, [schools]);

  // Current selected school entity
  const currentSchool = useMemo(() => {
    if (selectedSchoolId === 'ALL') return null;
    return schoolsById.get(Number(selectedSchoolId)) || null;
  }, [schoolsById, selectedSchoolId]);

  // Filtered schools inside popover search
  const filteredSchools = useMemo(() => {
    if (!schoolSearchQuery.trim()) return schools;
    const q = schoolSearchQuery.toLowerCase();
    return schools.filter(
      (s) =>
        s.schoolName.toLowerCase().includes(q) ||
        (s.schoolBoardName || '').toLowerCase().includes(q) ||
        (s.schoolBoardCode || '').toLowerCase().includes(q) ||
        String(s.schoolId).includes(q)
    );
  }, [schools, schoolSearchQuery]);

  // Filter active students based on grade, route assignment, metAtBus, and deferredSearchTerm
  const filteredStudents = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    const hasSearch = term.length > 0;
    const isSchoolFiltered = selectedSchoolId !== 'ALL';
    const sIdNum = isSchoolFiltered ? Number(selectedSchoolId) : 0;
    const isGradeFiltered = selectedGrade !== 'ALL';

    return activeStudents.filter((s) => {
      if (isSchoolFiltered && s.schoolId !== sIdNum) {
        return false;
      }

      if (isGradeFiltered && s.grade !== selectedGrade) {
        return false;
      }

      if (metAtBusOnly && !s.metatBus) {
        return false;
      }

      if (routeFilter === 'ASSIGNED' && (!s.routes || s.routes.trim() === '')) {
        return false;
      }
      if (routeFilter === 'UNASSIGNED' && s.routes && s.routes.trim() !== '') {
        return false;
      }

      if (hasSearch) {
        const matchName = (s.fullName || s.studentName || '').toLowerCase().includes(term);
        const matchNo = (s.studentNo || '').toLowerCase().includes(term);
        const matchSchool = (s.schoolName || '').toLowerCase().includes(term);
        const matchRoute = (s.routes || '').toLowerCase().includes(term);
        const matchPhone = (s.studentPhone || '').includes(term);
        const matchAddr = (s.studentAddress || '').toLowerCase().includes(term);
        if (!matchName && !matchNo && !matchSchool && !matchRoute && !matchPhone && !matchAddr) {
          return false;
        }
      }

      return true;
    });
  }, [activeStudents, selectedSchoolId, selectedGrade, metAtBusOnly, routeFilter, deferredSearchTerm]);

  // Aggregated other schools found during cross-school peek
  const distinctCrossSchools = useMemo(() => {
    const map = new Map<number, { schoolId: number; schoolName: string; count: number }>();
    for (const s of crossSchoolMatches) {
      const existing = map.get(s.schoolId);
      if (existing) {
        existing.count++;
      } else {
        map.set(s.schoolId, {
          schoolId: s.schoolId,
          schoolName: s.schoolName || `School #${s.schoolId}`,
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [crossSchoolMatches]);

  // Dynamic search placeholder
  const searchPlaceholder = useMemo(() => {
    if (selectedSchoolId === 'ALL') {
      return `Search across all ${schools.length} schools and ${stats.totalStudents || activeStudents.length} students by name, ID, route, phone...`;
    }
    return `Search in ${currentSchool?.schoolName || 'current school'} by name, ID, route, phone... (server cross-school peek active)`;
  }, [selectedSchoolId, currentSchool, schools.length, stats.totalStudents, activeStudents.length]);

  const hasActiveFilters =
    selectedGrade !== 'ALL' ||
    routeFilter !== 'ALL' ||
    metAtBusOnly ||
    searchTerm.trim() !== '';

  const handleClearAllFilters = () => {
    setSelectedGrade('ALL');
    setRouteFilter('ALL');
    setMetAtBusOnly(false);
    setSearchTerm('');
  };

  // Virtual scrolling containers for 5,000+ students (desktop table + mobile cards)
  const studentTableContainerRef = useRef<HTMLDivElement>(null);
  const studentMobileContainerRef = useRef<HTMLDivElement>(null);

  const studentTableVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => studentTableContainerRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const virtualStudents = studentTableVirtualizer.getVirtualItems();
  const tablePaddingTop = virtualStudents.length > 0 ? virtualStudents[0]?.start || 0 : 0;
  const tablePaddingBottom = virtualStudents.length > 0
    ? studentTableVirtualizer.getTotalSize() - (virtualStudents[virtualStudents.length - 1]?.end || 0)
    : 0;

  const studentMobileVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => studentMobileContainerRef.current,
    estimateSize: () => 140,
    overscan: 6,
  });

  return (
    <PageShell>
      <PageHeader
        title="Students"
        subtitle="Student riders, school assignments, parent contacts, and transportation plans."
      />
      {/* Top Header Card: Breadcrumb School Switcher + Primary Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Row 1: Workspace Breadcrumb Navigation & Global Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          {/* Breadcrumb School Quick-Switcher */}
          <div className="flex items-center flex-wrap gap-2 text-sm">
            <span className="font-semibold text-slate-400">Student Directory</span>
            <span className="text-slate-600 font-bold">/</span>

            {/* School Quick-Switcher Popover Trigger */}
            <div className="relative" ref={schoolDropdownRef}>
              <button
                type="button"
                aria-expanded={isSchoolDropdownOpen}
                aria-haspopup="listbox"
                aria-label="Switch active school context"
                onClick={() => setIsSchoolDropdownOpen(!isSchoolDropdownOpen)}
                className={`group flex items-center space-x-2.5 px-3 py-1.5 min-h-[36px] rounded-xl border text-xs sm:text-sm font-semibold transition shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                  selectedSchoolId === 'ALL'
                    ? 'bg-slate-800 hover:bg-slate-700/80 text-slate-200 border-slate-700'
                    : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/30'
                }`}
                title="Click to switch active school work context"
              >
                {selectedSchoolId === 'ALL' ? (
                  <>
                    <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    <span>All Schools (District-Wide)</span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-700/80 text-slate-300">
                      {students.length} riders
                    </span>
                  </>
                ) : (
                  <>
                    <SchoolIcon className="w-4 h-4 text-sky-400 flex-shrink-0" aria-hidden="true" />
                    <span className="max-w-[220px] sm:max-w-[320px] truncate">
                      {currentSchool?.schoolName || `School #${selectedSchoolId}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/20 text-sky-200 border border-sky-500/30">
                      {currentSchool ? (schoolStudentCounts[currentSchool.schoolId] ?? currentSchool.studentNum) : 0} riders
                    </span>
                  </>
                )}
                <ChevronDown
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isSchoolDropdownOpen ? 'rotate-180 text-sky-400' : 'group-hover:text-slate-200'
                  }`}
                />
              </button>

              {/* School Quick-Switcher Popover Panel */}
              {isSchoolDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 space-y-2 backdrop-blur-md">
                  {/* Popover School Search Filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      type="search"
                      aria-label="Filter schools by name or board"
                      placeholder={`Filter ${schools.length} schools by name or board...`}
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-1.5 text-base sm:text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    {schoolSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSchoolSearchQuery('')}
                        aria-label="Clear school search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[24px] min-h-[24px] flex items-center justify-center rounded text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* School List Scroll Area */}
                  <div role="listbox" aria-label="Schools" className="max-h-72 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {/* Option: All Schools */}
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedSchoolId === 'ALL'}
                      onClick={() => handleSelectSchool('ALL')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-400 ${
                        selectedSchoolId === 'ALL'
                          ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                        <div>
                          <div className="font-semibold">All Schools (District-Wide)</div>
                          <div className="text-[10px] text-slate-400">View roster across entire fleet</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] text-slate-400 font-mono">{stats.totalStudents || students.length}</span>
                        {selectedSchoolId === 'ALL' && <Check className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />}
                      </div>
                    </button>

                    <div className="border-t border-slate-800/80 my-1" />

                    {/* School List */}
                    {filteredSchools.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No school matching &quot;{schoolSearchQuery}&quot;
                      </div>
                    ) : (
                      filteredSchools.map((sch) => {
                        const isSelected = selectedSchoolId === String(sch.schoolId);
                        const count = schoolStudentCounts[sch.schoolId] ?? (sch.studentNum || 0);
                        return (
                          <button
                            key={sch.schoolId}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelectSchool(String(sch.schoolId))}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-400 ${
                              isSelected
                                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate">
                              <SchoolIcon className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
                              <div className="truncate">
                                <div className="font-semibold truncate">{sch.schoolName}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {sch.schoolBoardCode || sch.schoolBoardName || `ID: #${sch.schoolId}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                              <span className="text-[11px] text-slate-400 font-mono">{count}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Add Student & Refresh */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {onCreateStudent && (
              <button
                type="button"
                onClick={onCreateStudent}
                className="px-3.5 py-2 min-h-[36px] bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-sky-500/20 transition flex items-center space-x-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Student</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh student roster from cloud"
                title="Refresh student roster from cloud"
                className="px-3.5 py-2 min-h-[36px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline">Refresh Directory</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2 & 3: Smart Unified Search Input & Filter Row */}
        <search aria-label="Filter students" className="block space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search students"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-9 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-sky-500 transition placeholder:text-slate-500"
            />
            {isCrossSearching ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-400" title="Searching across district schools..." role="status">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              </div>
            ) : searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 min-w-[24px] min-h-[24px] flex items-center justify-center rounded text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                title="Clear search"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Row 3: Filter Row (Grade, Route Assignment, Met at Bus, Clear) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400 mr-2 font-medium">
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Refine:</span>
            </div>

            {/* Grade Filter */}
            <select
              value={selectedGrade}
              aria-label="Filter by grade"
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Grades</option>
              {AVAILABLE_GRADES.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>

            {/* Route Assignment Filter */}
            <div
              role="group"
              aria-label="Filter by route assignment"
              className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700"
            >
              <button
                type="button"
                aria-pressed={routeFilter === 'ALL'}
                onClick={() => setRouteFilter('ALL')}
                className={`px-2.5 py-1 min-h-[28px] rounded-lg text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                  routeFilter === 'ALL'
                    ? 'bg-sky-500/20 text-sky-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Routes
              </button>
              <button
                type="button"
                aria-pressed={routeFilter === 'ASSIGNED'}
                onClick={() => setRouteFilter('ASSIGNED')}
                className={`px-2.5 py-1 min-h-[28px] rounded-lg text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                  routeFilter === 'ASSIGNED'
                    ? 'bg-amber-500/20 text-amber-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Assigned
              </button>
              <button
                type="button"
                aria-pressed={routeFilter === 'UNASSIGNED'}
                onClick={() => setRouteFilter('UNASSIGNED')}
                className={`px-2.5 py-1 min-h-[28px] rounded-lg text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                  routeFilter === 'UNASSIGNED'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unassigned
              </button>
            </div>

            {/* Met at Bus toggle */}
            <button
              type="button"
              aria-pressed={metAtBusOnly}
              onClick={() => setMetAtBusOnly(!metAtBusOnly)}
              className={`px-3 py-1.5 min-h-[32px] rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                metAtBusOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <span>★ Met at Bus Only</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-2 py-1 min-h-[28px] text-xs text-rose-400 hover:text-rose-300 hover:underline ml-auto font-medium flex items-center space-x-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </search>

        {/* Row 4: Smart Cross-School Peek Notification Banner */}
        {crossSchoolMatches.length > 0 && filteredStudents.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center space-x-2 text-amber-300">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Showing <strong>{filteredStudents.length}</strong> student{filteredStudents.length > 1 ? 's' : ''} in{' '}
                <em className="text-white font-medium">{currentSchool?.schoolName}</em>. Cross-school peek found{' '}
                <strong>{crossSchoolMatches.length}</strong> matching student{crossSchoolMatches.length > 1 ? 's' : ''} in other schools (
                {distinctCrossSchools.slice(0, 3).map((item, idx) => (
                  <span key={item.schoolId}>
                    {idx > 0 && ', '}
                    <strong className="text-white">{item.schoolName}</strong> ({item.count})
                  </span>
                ))}
                {distinctCrossSchools.length > 3 && ` +${distinctCrossSchools.length - 3} more`}
                ).
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectSchool('ALL')}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition flex items-center space-x-1.5 flex-shrink-0 shadow-sm"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>View District-Wide ({filteredStudents.length + crossSchoolMatches.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.totalStudents}</div>
            <div className="text-[11px] text-slate-400 font-medium">Total Registered Students</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            <SchoolIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{schools.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Schools Served</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.routesCovered}</div>
            <div className="text-[11px] text-slate-400 font-medium">Active Routes Covered</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.activeStudents}</div>
            <div className="text-[11px] text-slate-400 font-medium">Active Bus Riders</div>
          </div>
        </div>
      </div>

      {/* Roster Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-bold text-white text-sm">
            <span>Student Roster</span>
            <span className="text-slate-400 font-normal">
              ({filteredStudents.length} of {selectedSchoolId === 'ALL' ? (stats.totalStudents || activeStudents.length) : (currentSchool ? (schoolStudentCounts[currentSchool.schoolId] ?? currentSchool.studentNum) : activeStudents.length)})
            </span>
            {selectedSchoolId !== 'ALL' && currentSchool && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {currentSchool.schoolName}
              </span>
            )}
            {loadingSchoolStudents && (
              <span className="flex items-center space-x-1 text-sky-400 text-xs ml-2 font-normal animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Syncing campus roster...</span>
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${rosterLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="hidden sm:inline">{rosterLive ? 'Real-time sync active' : 'Directory loaded'}</span>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          crossSchoolMatches.length > 0 ? (
            /* Smart Cross-School Empty State: Matched students found in other campuses! */
            <div className="p-8 sm:p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto text-sky-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-white text-sm sm:text-base">
                  No match in &quot;{currentSchool?.schoolName}&quot;
                </div>
                <div className="text-xs text-slate-400 max-w-lg mx-auto">
                  However, we discovered <strong>{crossSchoolMatches.length}</strong> student{crossSchoolMatches.length > 1 ? 's' : ''} matching &quot;<span className="text-sky-300 font-semibold">{searchTerm}</span>&quot; in other schools across the district:
                </div>
              </div>

              {/* Quick Jump School Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto pt-2">
                {distinctCrossSchools.map((item) => (
                  <button
                    key={item.schoolId}
                    type="button"
                    onClick={() => handleSelectSchool(String(item.schoolId))}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
                  >
                    <SchoolIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Switch to {item.schoolName} ({item.count})</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handleSelectSchool('ALL')}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 shadow-md shadow-sky-500/20"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Search District-Wide ({crossSchoolMatches.length})</span>
                </button>
              </div>
            </div>
          ) : (
            /* Standard Empty State */
            <div className="p-12 text-center text-slate-500 space-y-2">
              <GraduationCap className="w-8 h-8 mx-auto text-slate-600" />
              <div className="font-semibold text-sm">No students match current filter criteria</div>
              <div className="text-xs text-slate-600">Try clearing search terms or selecting another school from the top switcher</div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="mt-3 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl border border-slate-700 text-xs font-semibold transition"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )
        ) : (
          <>
            {/* Desktop Table View */}
            <div
              ref={studentTableContainerRef}
              tabIndex={0}
              role="region"
              aria-label="Student directory roster table"
              className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
            >
              <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1100px]">
                <caption className="sr-only">Student directory roster</caption>
                <colgroup>
                  <col style={{ width: '240px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ minWidth: '180px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '160px' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[11px] shadow-xs">
                  <tr>
                    <th scope="col" className="py-3 px-4">Student</th>
                    <th scope="col" className="py-3 px-4">School & Bell</th>
                    <th scope="col" className="py-3 px-4">Assigned Routes</th>
                    <th scope="col" className="py-3 px-4">Primary Contact</th>
                    <th scope="col" className="py-3 px-4">Home Address</th>
                    <th scope="col" className="py-3 px-4 text-center">Status</th>
                    <th scope="col" className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tablePaddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${tablePaddingTop}px`, padding: 0, border: 0 }} colSpan={7} />
                    </tr>
                  )}
                  {virtualStudents.map((virtualRow) => {
                    const s = filteredStudents[virtualRow.index];
                    if (!s) return null;
                    const primaryContact = s.contacts?.find((c: StudentContact) => c.primaryContact) || s.contacts?.[0];
                    const routeList = s.routes
                      ? s.routes.split(',').map((r: string) => r.trim()).filter(Boolean)
                      : [];

                    return (
                      <tr
                        key={s.id}
                        onClick={() => onSelectStudent(s)}
                        className="hover:bg-slate-800/40 transition cursor-pointer group"
                      >
                        {/* Name & ID */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-400 text-xs" aria-hidden="true">
                              {s.firstName[0]}
                              {s.lastName[0]}
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-sky-400 transition flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectStudent(s);
                                  }}
                                  aria-label={`View profile for ${s.studentName}`}
                                  className="text-left hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                                >
                                  {s.studentName}
                                </button>
                                {s.metatBus && (
                                  <span className="text-amber-400 text-xs font-bold" title="Met at Bus">
                                    *
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-1.5 font-mono text-[11px] text-slate-400">
                                <span>ID: {s.studentNo}</span>
                                <span>•</span>
                                <span className="text-indigo-400 font-semibold">Gr. {s.grade}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* School */}
                        <td className="py-3 px-4">
                          {onSelectSchool && s.schoolName ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSchool(s.schoolId, s.schoolName);
                              }}
                              aria-label={`View school details for ${s.schoolName}`}
                              className="text-slate-200 font-medium flex items-center space-x-1 hover:text-amber-300 hover:underline transition text-left max-w-full rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title="View school details"
                            >
                              <SchoolIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate max-w-[180px]">{s.schoolName}</span>
                            </button>
                          ) : (
                            <div className="text-slate-200 font-medium flex items-center space-x-1">
                              <SchoolIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate max-w-[180px]">{s.schoolName}</span>
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            School #{s.schoolId}
                          </div>
                        </td>

                        {/* Routes */}
                        <td
                          className="py-3 px-4 cursor-pointer group/route"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenStops(s);
                          }}
                          title="Click to view and manage route stops"
                        >
                          {routeList.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenStops(s);
                              }}
                              aria-label={`View and manage route stops for ${s.studentName}`}
                              className="flex flex-wrap items-center gap-1 text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                            >
                              {routeList.map((rt: string) => (
                                <span
                                  key={rt}
                                  className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover/route:border-amber-400/50 group-hover/route:bg-amber-500/20 font-mono text-[11px] font-semibold transition"
                                >
                                  <Bus className="w-3 h-3 mr-1 flex-shrink-0" aria-hidden="true" />
                                  {rt}
                                </span>
                              ))}
                              <span className="text-[10px] text-amber-400 opacity-0 group-hover/route:opacity-100 transition-opacity ml-1 font-semibold flex items-center space-x-0.5">
                                <span>Stops</span>
                                <ChevronRight className="w-3 h-3 inline" aria-hidden="true" />
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenStops(s);
                              }}
                              aria-label={`View stops and assign route for ${s.studentName}`}
                              className="text-slate-500 hover:text-amber-400 text-[11px] italic hover:underline flex items-center space-x-1 transition cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title="Click to view stops and assign route"
                            >
                              <span>Unassigned</span>
                              <span className="text-[10px] not-italic text-slate-600 hover:text-amber-400">
                                (View Stops)
                              </span>
                            </button>
                          )}
                        </td>

                        {/* Primary Contact */}
                        <td className="py-3 px-4">
                          {primaryContact ? (
                            <div className="space-y-0.5">
                              <div className="text-slate-200 font-medium">
                                {primaryContact.contactName}
                                {primaryContact.relationship && (
                                  <span className="text-slate-400 text-[10px] ml-1">
                                    ({primaryContact.relationship})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 pt-0.5">
                                {primaryContact.mobilePhone && (
                                  <a
                                    href={`tel:${primaryContact.mobilePhone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`Call ${primaryContact.contactName || 'parent'} at ${primaryContact.mobilePhone}`}
                                    className="text-amber-400 hover:underline font-mono text-[11px] flex items-center space-x-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                  >
                                    <Phone className="w-3 h-3" aria-hidden="true" />
                                    <span>{primaryContact.mobilePhone}</span>
                                  </a>
                                )}
                                {onMessageParent && (primaryContact.mobilePhone || primaryContact.email) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMessageParent({
                                        parentContact: primaryContact.mobilePhone || primaryContact.email || '',
                                        parentName: primaryContact.contactName,
                                        studentId: s.studentId,
                                        studentName: s.fullName,
                                        busUnitNumber: s.routes ? s.routes.split(',')[0].trim() : '',
                                        routeNo: s.routes || '',
                                        schoolName: s.schoolName,
                                        grade: s.grade,
                                      });
                                    }}
                                    aria-label={`Open operations chat with parent of ${s.studentName}`}
                                    className="text-indigo-400 hover:text-indigo-300 hover:underline font-semibold text-[11px] flex items-center space-x-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                                    title="Open operations chat with parent"
                                  >
                                    <MessageSquare className="w-3 h-3" aria-hidden="true" />
                                    <span>Chat</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">None</span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="py-3 px-4">
                          <div className="text-slate-300 text-[11px] truncate max-w-[200px]" title={s.studentAddress}>
                            {s.studentAddress || 'N/A'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                              s.active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end space-x-1.5 text-slate-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => void handleExportStudentPdf(s)}
                              disabled={exportingPdfId === s.id}
                              aria-label={`Export PDF for ${s.studentName}`}
                              title="Export Student PDF (Stops on separate page)"
                              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            {onEditStudent && (
                              <button
                                type="button"
                                onClick={() => onEditStudent(s)}
                                aria-label={`Edit ${s.studentName}`}
                                title="Edit student"
                                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                              >
                                <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                            {onDeleteStudent && (
                              <button
                                type="button"
                                onClick={() => onDeleteStudent(s)}
                                aria-label={`Delete ${s.studentName}`}
                                title="Delete student profile"
                                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectStudent(s)}
                              aria-label={`View profile for ${s.studentName}`}
                              className="px-1.5 py-1 min-h-[28px] flex items-center space-x-0.5 text-slate-400 hover:text-sky-400 rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                            >
                              <span className="text-[11px] hidden sm:inline">Profile</span>
                              <ChevronRight className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {tablePaddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${tablePaddingBottom}px`, padding: 0, border: 0 }} colSpan={7} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards Stream (Virtual Scrolling) */}
            <div ref={studentMobileContainerRef} className="md:hidden overflow-y-auto max-h-[calc(100vh-270px)]">
              <div
                style={{
                  height: `${studentMobileVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {studentMobileVirtualizer.getVirtualItems().map((virtualRow) => {
                  const s = filteredStudents[virtualRow.index];
                  if (!s) return null;
                  const primaryContact = s.contacts?.find((c: StudentContact) => c.primaryContact) || s.contacts?.[0];
                  const routeList = s.routes
                    ? s.routes.split(',').map((r: string) => r.trim()).filter(Boolean)
                    : [];

                  return (
                    <div
                      key={s.id}
                      data-index={virtualRow.index}
                      ref={studentMobileVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => onSelectStudent(s)}
                      className="p-4 hover:bg-slate-800/40 active:bg-slate-800/70 transition cursor-pointer space-y-3 border-b border-slate-800/80"
                    >
                      {/* Top: Avatar, Name, MetAtBus, Grade, Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-400 text-xs flex-shrink-0">
                            {s.firstName[0]}
                            {s.lastName[0]}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center space-x-1.5">
                              <span>{s.studentName}</span>
                              {s.metatBus && (
                                <span className="text-amber-400 text-xs font-bold" title="Must be met at bus">
                                  *
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1.5 font-mono text-[11px] text-slate-400 mt-0.5">
                              <span>ID: {s.studentNo}</span>
                              <span>•</span>
                              <span className="text-indigo-400 font-semibold">Gr. {s.grade}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                            s.active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* School & Route Tags */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {onSelectSchool && s.schoolName ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSchool(s.schoolId, s.schoolName);
                            }}
                            className="flex items-center space-x-1 text-slate-300 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60 max-w-[220px] truncate hover:text-amber-300 hover:border-amber-500/40 transition"
                            title="View school details"
                          >
                            <SchoolIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{s.schoolName}</span>
                          </button>
                        ) : (
                          <div className="flex items-center space-x-1 text-slate-300 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60 max-w-[220px] truncate">
                            <SchoolIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{s.schoolName}</span>
                          </div>
                        )}

                        {routeList.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {routeList.map((rt: string) => (
                              <button
                                type="button"
                                key={rt}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenStops(s);
                                }}
                                className="inline-flex items-center px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-400 border border-amber-500/20 font-mono text-[11px] font-semibold transition cursor-pointer"
                                title="Click to view and manage route stops"
                              >
                                <Bus className="w-3 h-3 mr-1" />
                                <span>{rt}</span>
                                <ChevronRight className="w-3 h-3 ml-0.5 text-amber-400/70" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStops(s);
                            }}
                            className="text-slate-500 hover:text-amber-400 text-[11px] italic bg-slate-800/50 hover:bg-slate-800 px-2 py-1 rounded-lg transition cursor-pointer"
                            title="Click to view stops and assign route"
                          >
                            No Route Assigned (View Stops)
                          </button>
                        )}
                      </div>

                      {/* Contact & Profile Action */}
                      <div
                        className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center space-x-2">
                          {primaryContact && primaryContact.mobilePhone ? (
                            <a
                              href={`tel:${primaryContact.mobilePhone}`}
                              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg font-mono font-medium transition active:scale-95"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{primaryContact.contactName || 'Parent'}: {primaryContact.mobilePhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-500 text-xs italic">
                              {primaryContact ? primaryContact.contactName : 'No contact registered'}
                            </span>
                          )}
                          {onMessageParent && primaryContact && (primaryContact.mobilePhone || primaryContact.email) && (
                            <button
                              type="button"
                              onClick={() => {
                                onMessageParent({
                                  parentContact: primaryContact.mobilePhone || primaryContact.email || '',
                                  parentName: primaryContact.contactName,
                                  studentId: s.studentId,
                                  studentName: s.fullName,
                                  busUnitNumber: s.routes ? s.routes.split(',')[0].trim() : '',
                                  routeNo: s.routes || '',
                                  schoolName: s.schoolName,
                                  grade: s.grade,
                                });
                              }}
                              className="flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-xs font-semibold transition"
                              title="Chat with Parent"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Chat</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => void handleExportStudentPdf(s)}
                            disabled={exportingPdfId === s.id}
                            aria-label={`Export PDF for ${s.studentName}`}
                            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                            title="Export Student PDF (Stops on separate page)"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          {onEditStudent && (
                            <button
                              type="button"
                              onClick={() => onEditStudent(s)}
                              aria-label={`Edit ${s.studentName}`}
                              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-400 hover:text-sky-400 rounded-lg hover:bg-slate-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                              title="Edit student"
                            >
                              <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectStudent(s)}
                            aria-label={`View profile for ${s.studentName}`}
                            className="flex items-center space-x-1 text-slate-400 hover:text-sky-400 px-2 py-1 min-h-[28px] rounded-lg hover:bg-slate-800 transition text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                          >
                            <span>Profile</span>
                            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
};
