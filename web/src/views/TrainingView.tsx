import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Users,
  MapPin,
  Video,
  DollarSign,
  BookOpen,
  Award,
  ChevronRight
} from 'lucide-react';
import {
  TrainingCourse,
  TrainingType,
  TrainingCategory,
  TrainingRegistration,
  TRAINING_COURSE_STATUS_LABELS,
  TRAINING_CATEGORY_LABELS
} from '../types/training';
import { Employee } from '../types/employee';
import { TrainingService } from '../services/trainingService';
import { TrainingCourseModal } from '../components/training/TrainingCourseModal';
import { TrainingCourseDetailModal } from '../components/training/TrainingCourseDetailModal';
import { TrainingTypeModal } from '../components/training/TrainingTypeModal';
import { useAuth } from '../contexts/AuthContext';
import { getLocalTodayString, addDaysToDateString } from '../utils/dateUtils';

interface TrainingViewProps {
  employees: Employee[];
}

export const TrainingView: React.FC<TrainingViewProps> = ({ employees }) => {
  const { currentUser } = useAuth();
  const todayStr = getLocalTodayString();

  const isManagement = currentUser?.role === 'admin' || currentUser?.role === 'dispatcher' || currentUser?.role === 'hr';
  const isHR = currentUser?.role === 'hr' || currentUser?.role === 'admin';

  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab: 'sessions' or 'catalog'
  const [activeTab, setActiveTab] = useState<'sessions' | 'catalog'>('sessions');

  // Filters
  const [viewScope, setViewScope] = useState<'all' | 'mine'>(isManagement ? 'all' : 'mine');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'today' | 'past'>('all');

  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);

  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<TrainingType | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [coursesData, typesData] = await Promise.all([
        TrainingService.listCourses(),
        TrainingService.listTrainingTypes()
      ]);
      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setTrainingTypes(Array.isArray(typesData) ? typesData : []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load training data:', err);
      setError('Failed to load training courses. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = TrainingService.subscribeToTrainingCourses(
      (updatedCourses) => {
        setCourses(Array.isArray(updatedCourses) ? updatedCourses : []);
        setLoading(false);
      },
      (err) => {
        console.error('Training courses subscription error:', err);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const attendees: TrainingRegistration[] = c.attendees || c.registrations || [];

      // Scope filter: mine vs all
      if (viewScope === 'mine') {
        const currentEmpId = currentUser?.employeeId || '';
        const userUid = currentUser?.uid || '';
        const userEmail = currentUser?.email || '';
        const isAttendee = attendees.some(
          (a: TrainingRegistration) =>
            (currentEmpId && a.employeeId === currentEmpId) ||
            (userUid && a.employeeId === userUid) ||
            (userEmail && a.employeeId === userEmail)
        );
        const isInstructor =
          (currentUser?.displayName && c.instructorName?.toLowerCase().includes(currentUser.displayName.toLowerCase())) ||
          (userEmail && c.instructorContact?.toLowerCase().includes(userEmail.toLowerCase()));

        if (!isAttendee && !isInstructor) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      // Category filter
      const courseCategory = c.category || 'safety';
      if (categoryFilter !== 'all' && courseCategory !== categoryFilter) {
        return false;
      }

      // Date filter
      if (dateFilter === 'upcoming') {
        if (c.startDate < todayStr) return false;
      } else if (dateFilter === 'today') {
        if (c.startDate > todayStr || (c.endDate && c.endDate < todayStr)) return false;
      } else if (dateFilter === 'past') {
        if (c.startDate >= todayStr) return false;
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const titleMatch = (c.title || '').toLowerCase().includes(q);
        const descMatch = (c.description || '').toLowerCase().includes(q);
        const instMatch = (c.instructorName || '').toLowerCase().includes(q);
        const locMatch = (c.location || '').toLowerCase().includes(q);
        const attendeeMatch = attendees.some((a: TrainingRegistration) =>
          a.employeeName.toLowerCase().includes(q)
        );
        if (!titleMatch && !descMatch && !instMatch && !locMatch && !attendeeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [courses, viewScope, statusFilter, categoryFilter, dateFilter, searchTerm, todayStr, currentUser]);

  // Statistics
  const stats = useMemo(() => {
    const published = courses.filter((c) => c.status === 'published');
    const upcomingWeek = courses.filter((c) => {
      const maxNext = addDaysToDateString(todayStr, 7);
      return c.startDate >= todayStr && c.startDate <= maxNext && c.status !== 'cancelled';
    });
    const totalEnrolled = courses.reduce((sum, c) => {
      const roster = c.attendees || c.registrations || [];
      return sum + (roster.length > 0 ? roster.length : (c.registeredCount || 0));
    }, 0);

    return {
      totalCourses: courses.length,
      publishedCount: published.length,
      upcomingWeekCount: upcomingWeek.length,
      totalEnrolled,
      catalogCount: trainingTypes.length
    };
  }, [courses, trainingTypes, todayStr]);

  const handleOpenDetail = (course: TrainingCourse) => {
    setSelectedCourse(course);
    setIsDetailModalOpen(true);
  };

  const handleCreateCourse = () => {
    setEditingCourse(null);
    setIsCourseModalOpen(true);
  };

  const handleEditCourse = (course: TrainingCourse) => {
    setEditingCourse(course);
    setIsCourseModalOpen(true);
  };

  const handleCreateType = () => {
    setEditingType(null);
    setIsTypeModalOpen(true);
  };

  const handleEditType = (type: TrainingType) => {
    setEditingType(type);
    setIsTypeModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {TRAINING_COURSE_STATUS_LABELS[status as keyof typeof TRAINING_COURSE_STATUS_LABELS] || status}
          </span>
        );
      case 'draft':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {TRAINING_COURSE_STATUS_LABELS[status as keyof typeof TRAINING_COURSE_STATUS_LABELS] || status}
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            {TRAINING_COURSE_STATUS_LABELS[status as keyof typeof TRAINING_COURSE_STATUS_LABELS] || status}
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            {TRAINING_COURSE_STATUS_LABELS[status as keyof typeof TRAINING_COURSE_STATUS_LABELS] || status}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Global Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Driver & Crew Training</h1>
              <p className="text-xs text-slate-400">
                Continuing education, compliance certifications, and scheduled curriculum workshops
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition"
            title="Refresh Courses"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isHR && (
            <button
              onClick={handleCreateType}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Catalog Templates</span>
            </button>
          )}

          {isManagement && (
            <button
              onClick={handleCreateCourse}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 flex items-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Course</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Sessions</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{stats.publishedCount}</span>
            <span className="text-xs text-slate-500">of {stats.totalCourses} total</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Upcoming Next 7 Days</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{stats.upcomingWeekCount}</span>
            <span className="text-xs text-indigo-400 font-medium">scheduled</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Enrolled Crew</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{stats.totalEnrolled}</span>
            <span className="text-xs text-slate-500">registrations</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Curriculum Types</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">{stats.catalogCount}</span>
            <span className="text-xs text-slate-500">standard topics</span>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher & Filters */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          {/* View Tab Switcher */}
          <div className="flex items-center space-x-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80 max-w-fit">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'sessions'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Scheduled Sessions ({courses.length})
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'catalog'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Curriculum Catalog ({trainingTypes.length})
            </button>
          </div>

          {/* Scope Filter for regular users */}
          {activeTab === 'sessions' && (
            <div className="flex items-center space-x-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80 max-w-fit">
              <button
                onClick={() => setViewScope('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  viewScope === 'all'
                    ? 'bg-slate-800 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Courses
              </button>
              <button
                onClick={() => setViewScope('mine')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  viewScope === 'mine'
                    ? 'bg-slate-800 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                My Enrolled / Assigned
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls for Sessions */}
        {activeTab === 'sessions' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search title, instructor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(TRAINING_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Dates</option>
                <option value="upcoming">Upcoming & Today</option>
                <option value="today">Today Only</option>
                <option value="past">Past Sessions</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sessions View */}
      {activeTab === 'sessions' && (
        <>
          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-indigo-400" />
              <p className="text-sm">Loading training sessions...</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">No training courses found</p>
              <p className="text-xs text-slate-500 mt-1">
                {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Schedule your first driver or attendant course session above.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((c) => {
                const roster = c.attendees || c.registrations || [];
                const attendeesCount = roster.length > 0 ? roster.length : (c.registeredCount || 0);
                const capacity = c.maxSeats || 20;
                const percentFilled = Math.min(100, Math.round((attendeesCount / capacity) * 100));
                const isFull = attendeesCount >= capacity;
                const courseCategory = (c.category || 'safety') as TrainingCategory;

                return (
                  <div
                    key={c.id}
                    className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between transition-all duration-150 hover:shadow-lg hover:shadow-indigo-500/5 group"
                  >
                    <div>
                      {/* Status and Category */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 rounded border border-slate-700">
                          {TRAINING_CATEGORY_LABELS[courseCategory] || courseCategory}
                        </span>
                        {getStatusBadge(c.status)}
                      </div>

                      {/* Course Title */}
                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">
                        {c.title}
                      </h3>

                      {c.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.description}</p>
                      )}

                      {/* Details Grid */}
                      <div className="mt-4 space-y-2 text-xs text-slate-300 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Schedule:</span>
                          </span>
                          <span className="font-medium text-white">
                            {c.startDate} {c.startTime ? `(${c.startTime})` : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>Duration:</span>
                          </span>
                          <span className="font-medium">{c.hours || 0} Hours</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center space-x-1">
                            <User className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Instructor:</span>
                          </span>
                          <span className="font-medium truncate max-w-[140px]">{c.instructorName || 'TBD'}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center space-x-1">
                            {c.isOnline ? (
                              <Video className="w-3.5 h-3.5 text-sky-400" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span>Type:</span>
                          </span>
                          <span className="font-medium">
                            {c.isOnline ? 'Online Webinar' : c.location || 'On-site'}
                          </span>
                        </div>

                        {c.payAmount && c.payAmount > 0 ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center space-x-1">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Paid Session:</span>
                            </span>
                            <span className="font-medium text-emerald-400">${c.payAmount.toFixed(2)}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Enrollment Bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400">Enrollment</span>
                          <span className="font-semibold text-slate-200">
                            {attendeesCount} / {capacity} Seats {isFull && <span className="text-rose-400">(Full)</span>}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isFull ? 'bg-rose-500' : percentFilled > 75 ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${percentFilled}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">ID: {c.id.slice(0, 8)}</span>
                      <button
                        onClick={() => handleOpenDetail(c)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-medium rounded-lg border border-slate-700/80 flex items-center space-x-1 transition shadow-sm"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Catalog Templates View */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Standardized training curricula templates available for scheduling new course sessions
            </p>
            {isHR && (
              <button
                onClick={handleCreateType}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow flex items-center space-x-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Curriculum Template</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainingTypes.map((t) => (
              <div
                key={t.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {t.code}
                    </span>
                    {t.isRequired ? (
                      <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        Optional
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white mt-1">{t.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.description}</p>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Hours:</span>
                      <span className="font-semibold text-white">{t.defaultHours}h</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Valid:</span>
                      <span className="font-semibold text-white">{t.validityMonths}m</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Passing:</span>
                      <span className="font-semibold text-white">{t.passingScore || 80}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 capitalize">
                    Category: {TRAINING_CATEGORY_LABELS[t.category] || t.category}
                  </span>
                  {isHR && (
                    <button
                      onClick={() => handleEditType(t)}
                      className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {isCourseModalOpen && (
        <TrainingCourseModal
          isOpen={isCourseModalOpen}
          onClose={() => setIsCourseModalOpen(false)}
          course={editingCourse}
          trainingTypes={trainingTypes}
          onSaved={loadData}
        />
      )}

      {isDetailModalOpen && selectedCourse && (
        <TrainingCourseDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedCourse(null);
          }}
          course={selectedCourse}
          employees={employees}
          onRefresh={async () => {
            await loadData();
            // Refresh currently selected course from updated list
            const updated = await TrainingService.getCourse(selectedCourse.id);
            if (updated) setSelectedCourse(updated);
          }}
          onEdit={(c) => {
            setIsDetailModalOpen(false);
            handleEditCourse(c);
          }}
        />
      )}

      {isTypeModalOpen && (
        <TrainingTypeModal
          isOpen={isTypeModalOpen}
          onClose={() => setIsTypeModalOpen(false)}
          trainingType={editingType}
          onSaved={loadData}
        />
      )}
    </div>
  );
};
