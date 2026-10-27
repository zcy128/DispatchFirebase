import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CalendarOff,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  User,
  Users,
  UserCheck,
  Trash2,
  Edit,
  SlidersHorizontal,
  Mail,
  MessageSquare,
  X,
  Radio,
  Printer,
  BarChart3
} from 'lucide-react';
import { TimeOffRequest, LEAVE_TYPE_LABELS } from '../types/timeOff';
import { BusRoute } from '../types/route';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import { TimeOffService } from '../services/timeOffService';
import { TimeOffModal } from '../components/time_off/TimeOffModal';
import { TimeOffReviewModal } from '../components/time_off/TimeOffReviewModal';
import { TimeOffSettingsModal } from '../components/time_off/TimeOffSettingsModal';
import { TimeOffPdfModal } from '../components/time_off/TimeOffPdfModal';
import { TimeOffMonthlyReport } from '../components/time_off/TimeOffMonthlyReport';
import { TemporaryAssignmentModal } from '../components/dispatch/TemporaryAssignmentModal';
import { RouteOpeningCreateModal } from '../components/dispatch/RouteOpeningCreateModal';
import { RouteOpeningRole } from '../types/routeOpening';
import { TemporaryAssignment } from '../types/dispatch';
import { useAuth } from '../contexts/AuthContext';
import { getLocalTodayString, safeFormatDate, addDaysToDateString, calculateDefaultDeadline } from '../utils/dateUtils';

interface TimeOffViewProps {
  employees: Employee[];
  routes: BusRoute[];
  vehicles: Vehicle[];
  onNavigateToTemporaryAssignments?: () => void;
}

export const TimeOffView: React.FC<TimeOffViewProps> = ({
  employees,
  routes,
  vehicles,
  onNavigateToTemporaryAssignments
}) => {
  const { currentUser } = useAuth();
  const todayStr = getLocalTodayString();

  const isHR = currentUser?.role === 'hr' || currentUser?.role === 'admin';
  const isDispatcher = currentUser?.role === 'dispatcher' || isHR;

  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'requests' board vs 'monthly_report'
  const [viewMode, setViewMode] = useState<'requests' | 'monthly_report'>('requests');

  // Filters (default to 'all' category and 'upcoming' date to surface future leaves immediately)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'pending' | 'needs_coverage' | 'active_today'>('all');
  const [viewScope, setViewScope] = useState<'all' | 'mine'>(isDispatcher ? 'all' : 'mine');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'recent' | 'all_archive' | 'today' | 'upcoming' | 'past_30' | 'specific_date' | 'custom_range'>('upcoming');
  const [includeAdvanceInCoverage, setIncludeAdvanceInCoverage] = useState<boolean>(false);
  const [filterSpecificDate, setFilterSpecificDate] = useState<string>(todayStr);
  const [filterRangeStart, setFilterRangeStart] = useState<string>(todayStr);
  const [filterRangeEnd, setFilterRangeEnd] = useState<string>(addDaysToDateString(todayStr, 7));

  // Planning horizon: Dispatch prepares coverage 30 days ahead; older than 30 days is archived
  const COVERAGE_HORIZON_DAYS = 30;
  const horizonLimitDateStr = useMemo(() => addDaysToDateString(todayStr, COVERAGE_HORIZON_DAYS), [todayStr]);
  const thirtyDaysAgoStr = useMemo(() => addDaysToDateString(todayStr, -30), [todayStr]);

  // Modals
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [editingRequest, setEditingRequest] = useState<TimeOffRequest | null>(null);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [reviewingRequest, setReviewingRequest] = useState<TimeOffRequest | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  const [isCoverModalOpen, setIsCoverModalOpen] = useState<boolean>(false);
  const [coverInitialAssignment, setCoverInitialAssignment] = useState<TemporaryAssignment | null>(null);
  const [activeTimeOffForCoverage, setActiveTimeOffForCoverage] = useState<TimeOffRequest | null>(null);

  const [isCreateOpeningModalOpen, setIsCreateOpeningModalOpen] = useState<boolean>(false);
  const [openingInitialValues, setOpeningInitialValues] = useState<any>(null);

  // PDF Export Modal
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [activeTimeOffForPdf, setActiveTimeOffForPdf] = useState<TimeOffRequest | null>(null);

  const handleOpenPdfExport = (req: TimeOffRequest | null) => {
    setActiveTimeOffForPdf(req);
    setIsPdfModalOpen(true);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await TimeOffService.listTimeOffRequests();
      setRequests(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load time off requests:', err);
      setError('Failed to load time off requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = TimeOffService.subscribeToTimeOffRequests(
      (updated) => {
        setRequests(Array.isArray(updated) ? updated : []);
        setLoading(false);
      },
      (err) => {
        console.error('Subscription error:', err);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleCreateNew = () => {
    setEditingRequest(null);
    setIsSubmitModalOpen(true);
  };

  const handleEdit = (req: TimeOffRequest) => {
    setEditingRequest(req);
    setIsSubmitModalOpen(true);
  };

  const handleOpenReview = (req: TimeOffRequest) => {
    setReviewingRequest(req);
    setIsReviewModalOpen(true);
  };

  const handleCancelRequest = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this time off request?')) {
      return;
    }
    try {
      await TimeOffService.cancelTimeOffRequest(id, currentUser?.uid || '');
      setRequests((prev) =>
        (prev || []).map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
      );
    } catch (err: any) {
      console.error('Failed to cancel request:', err);
      alert('Failed to cancel request: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this request?')) {
      return;
    }
    try {
      await TimeOffService.deleteTimeOffRequest(id);
      setRequests((prev) => (prev || []).filter((r) => r.id !== id));
    } catch (err: any) {
      console.error('Failed to delete request:', err);
      alert('Failed to delete request: ' + (err?.message || 'Unknown error'));
    }
  };

  // Launch temporary assignment coverage for an approved request
  const handleAssignCoverage = (req: TimeOffRequest) => {
    setActiveTimeOffForCoverage(req);

    // Find route currently assigned to this employee
    const assignedRoute = routes.find((r) => r.driverId === req.employeeId || r.attendantId === req.employeeId);

    const shiftTypeVal =
      req.shiftType === 'AM'
        ? 'morning'
        : req.shiftType === 'PM'
        ? 'afternoon'
        : req.shiftType === 'Midday'
        ? 'noon'
        : 'all';

    let reasonVal: any = 'sick_leave';
    if (req.leaveType === 'vacation') reasonVal = 'vacation';
    else if (req.leaveType === 'sick_leave') reasonVal = 'sick_leave';
    else if (req.leaveType === 'personal_days') reasonVal = 'personal_leave';
    else if (req.leaveType === 'jury_duty') reasonVal = 'other';
    else if (req.leaveType === 'bereavement_leave') reasonVal = 'personal_leave';
    else reasonVal = 'other';

    const tempCoverObj: any = {
      id: '',
      routeId: assignedRoute?.id || (routes.length > 0 ? routes[0].id : ''),
      routeName: assignedRoute?.routeName || assignedRoute?.routeNo || '',
      shiftType: shiftTypeVal,
      startDate: req.startDate,
      endDate: req.endDate,
      originalDriverId: assignedRoute?.driverId === req.employeeId ? req.employeeId : (assignedRoute?.driverId || ''),
      originalDriverName: assignedRoute?.driverId === req.employeeId ? req.employeeName : (assignedRoute?.driverName || ''),
      originalAttendantId: assignedRoute?.attendantId === req.employeeId ? req.employeeId : (assignedRoute?.attendantId || ''),
      originalAttendantName: assignedRoute?.attendantId === req.employeeId ? req.employeeName : (assignedRoute?.attendantName || ''),
      reason: reasonVal,
      notes: `Temporary replacement for ${req.employeeName} (${LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType}).`,
      status: 'active'
    };

    setCoverInitialAssignment(tempCoverObj);
    setIsCoverModalOpen(true);
  };

  // Publish Route Opening & Coverage Bulletin to bidding board for an approved request
  const handlePostRouteOpening = (req: TimeOffRequest) => {
    setActiveTimeOffForCoverage(req);

    const assignedRoute = routes.find((r) => r.driverId === req.employeeId || r.attendantId === req.employeeId);
    const emp = employees.find((e) => e.id === req.employeeId || e.employeeNumber === req.employeeId);
    const roleNeeded: RouteOpeningRole =
      assignedRoute?.driverId === req.employeeId || emp?.role === 'driver' ? 'driver' : 'attendant';

    const shiftTypeVal =
      req.shiftType === 'AM'
        ? 'AM'
        : req.shiftType === 'PM'
        ? 'PM'
        : req.shiftType === 'Midday'
        ? 'Midday'
        : 'ALL';

    const calculatedDeadline = calculateDefaultDeadline(req.startDate);

    setOpeningInitialValues({
      routeId: assignedRoute?.id || (routes.length > 0 ? routes[0].id : ''),
      postingType: 'temporary',
      roleNeeded,
      effectiveStartDate: req.startDate,
      effectiveEndDate: req.endDate,
      shiftType: shiftTypeVal,
      deadline: calculatedDeadline,
      description: `Temporary route coverage needed for ${req.employeeName} (${LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType}).`
    });
    setIsCreateOpeningModalOpen(true);
  };

  // KPI Metrics (Pending excludes expired unapproved leaves)
  const pendingCount = useMemo(() => {
    return (requests || []).filter((r) => r.status === 'pending' && r.endDate >= todayStr).length;
  }, [requests, todayStr]);

  const needsCoverageCount = useMemo(() => {
    return (requests || []).filter(
      (r) =>
        r.status === 'approved' &&
        r.endDate >= todayStr &&
        !r.coverageAssigned &&
        r.startDate <= horizonLimitDateStr
    ).length;
  }, [requests, todayStr, horizonLimitDateStr]);

  const advanceBookingCount = useMemo(() => {
    return (requests || []).filter(
      (r) =>
        r.status === 'approved' &&
        r.endDate >= todayStr &&
        !r.coverageAssigned &&
        r.startDate > horizonLimitDateStr
    ).length;
  }, [requests, todayStr, horizonLimitDateStr]);

  const activeTodayCount = useMemo(() => {
    return (requests || []).filter(
      (r) => r.status === 'approved' && r.startDate <= todayStr && todayStr <= r.endDate
    ).length;
  }, [requests, todayStr]);

  const allCount = useMemo(() => {
    return (requests || []).length;
  }, [requests]);

  // Filtering
  const filteredRequests = useMemo(() => {
    const isSearching = searchTerm.trim().length > 0;

    return (requests || []).filter((r) => {
      // Scope filter: My requests vs All
      if (viewScope === 'mine') {
        const isMine =
          (currentUser?.employeeId && (r.employeeId === currentUser.employeeId || r.employeeNumber === currentUser.employeeId)) ||
          (currentUser?.uid && r.requestedByUserId === currentUser.uid);
        if (!isMine) return false;
      }

      // Quick Category Filter from Top Cards
      if (categoryFilter === 'pending') {
        if (r.status !== 'pending' || r.endDate < todayStr) return false;
      } else if (categoryFilter === 'needs_coverage') {
        if (r.status !== 'approved' || r.endDate < todayStr || r.coverageAssigned) return false;
        if (!includeAdvanceInCoverage && r.startDate > horizonLimitDateStr) return false;
      } else if (categoryFilter === 'active_today') {
        if (r.status !== 'approved' || !(r.startDate <= todayStr && todayStr <= r.endDate)) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      // Leave Type filter
      if (leaveTypeFilter !== 'all' && r.leaveType !== leaveTypeFilter) {
        return false;
      }

      // Date filter
      // If user is searching (e.g. looking for a specific employee), bypass 30-day cutoff to query all history
      if (!isSearching && dateFilter === 'recent') {
        if (r.endDate < thirtyDaysAgoStr) return false;
      } else if (dateFilter === 'today') {
        if (!(r.startDate <= todayStr && todayStr <= r.endDate)) return false;
      } else if (dateFilter === 'upcoming') {
        if (r.endDate < todayStr) return false;
      } else if (dateFilter === 'past_30') {
        if (r.endDate >= todayStr || r.endDate < thirtyDaysAgoStr) return false;
      } else if (dateFilter === 'all_archive') {
        // Show everything including archived records (> 30 days old)
      } else if (dateFilter === 'specific_date') {
        if (filterSpecificDate) {
          if (!(r.startDate <= filterSpecificDate && filterSpecificDate <= r.endDate)) return false;
        }
      } else if (dateFilter === 'custom_range') {
        if (filterRangeStart && r.endDate < filterRangeStart) return false;
        if (filterRangeEnd && r.startDate > filterRangeEnd) return false;
      }

      // Search term
      if (isSearching) {
        const term = searchTerm.toLowerCase();
        const empMatch = (r.employeeName || '').toLowerCase().includes(term);
        const empNumMatch = (r.employeeNumber || '').toLowerCase().includes(term);
        const typeMatch = (LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType).toLowerCase().includes(term);
        const commentsMatch = (r.comments || '').toLowerCase().includes(term);
        const reviewerMatch = (r.approvedByName || '').toLowerCase().includes(term);
        const notesMatch = (r.approvalNotes || '').toLowerCase().includes(term);
        return empMatch || empNumMatch || typeMatch || commentsMatch || reviewerMatch || notesMatch;
      }

      return true;
    });
  }, [
    requests,
    categoryFilter,
    includeAdvanceInCoverage,
    viewScope,
    statusFilter,
    leaveTypeFilter,
    dateFilter,
    filterSpecificDate,
    filterRangeStart,
    filterRangeEnd,
    searchTerm,
    currentUser,
    todayStr,
    horizonLimitDateStr,
    thirtyDaysAgoStr
  ]);

  // Virtual scrolling for 1,000+ time off requests
  const timeOffTableContainerRef = useRef<HTMLDivElement>(null);

  const timeOffVirtualizer = useVirtualizer({
    count: filteredRequests.length,
    getScrollElement: () => timeOffTableContainerRef.current,
    estimateSize: () => 70,
    overscan: 8,
  });

  const virtualTimeOffs = timeOffVirtualizer.getVirtualItems();
  const timeOffPaddingTop = virtualTimeOffs.length > 0 ? virtualTimeOffs[0]?.start || 0 : 0;
  const timeOffPaddingBottom = virtualTimeOffs.length > 0
    ? timeOffVirtualizer.getTotalSize() - (virtualTimeOffs[virtualTimeOffs.length - 1]?.end || 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CalendarOff className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Time Off Requests</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit employee leave requests, review HR approvals, and assign replacement dispatch coverage
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition border border-slate-700 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setViewMode(prev => prev === 'requests' ? 'monthly_report' : 'requests')}
            className={`px-3 py-2 border font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-sm ${
              viewMode === 'monthly_report'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title="Toggle between leave requests board and monthly statistics report"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{viewMode === 'monthly_report' ? 'Leave Requests' : 'Monthly Report'}</span>
          </button>
          <button
            onClick={() => handleOpenPdfExport(null)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-sm"
            title="Export or print official employee time off authorization form"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Export PDF Form</span>
          </button>
          {isDispatcher && (
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition"
              title="Configure notification delivery channels"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Settings</span>
            </button>
          )}
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-lg flex items-center space-x-2 transition shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Request Time Off</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs: Requests Board vs Monthly Summary Report */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-1">
        <button
          type="button"
          onClick={() => setViewMode('requests')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition ${
            viewMode === 'requests'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <CalendarOff className="w-4 h-4" />
          <span>Leave Requests</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-950/40 text-current font-mono">
            {filteredRequests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('monthly_report')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition ${
            viewMode === 'monthly_report'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Monthly Statistical Report</span>
        </button>
      </div>

      {viewMode === 'monthly_report' ? (
        <TimeOffMonthlyReport
          requests={requests}
          employees={employees}
          routes={routes}
          vehicles={vehicles}
          onExportPdf={(r) => handleOpenPdfExport(r)}
        />
      ) : (
        <>
          {/* KPI Cards / Quick Category Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending HR Review */}
        <button
          type="button"
          onClick={() => setCategoryFilter(prev => prev === 'pending' ? 'all' : 'pending')}
          className={`p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border ${
            categoryFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center border transition ${
              categoryFilter === 'pending'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{pendingCount}</div>
              <div className="text-xs font-medium text-slate-300">Needs HR Approval</div>
              <div className="text-[11px] text-slate-400">Pending review</div>
            </div>
          </div>
          {categoryFilter === 'pending' && (
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Active
            </span>
          )}
        </button>

        {/* Needs Replacement Cover */}
        <button
          type="button"
          onClick={() => setCategoryFilter(prev => prev === 'needs_coverage' ? 'all' : 'needs_coverage')}
          className={`p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border ${
            categoryFilter === 'needs_coverage'
              ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center border transition ${
              categoryFilter === 'needs_coverage'
                ? 'bg-blue-500 text-white border-blue-400 font-bold'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}>
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{needsCoverageCount}</div>
              <div className="text-xs font-medium text-slate-300">Needs Replacement Cover</div>
              <div className="text-[11px] text-slate-400">
                {advanceBookingCount > 0
                  ? `Next 30 days (+${advanceBookingCount} advance)`
                  : 'Within next 30 days'}
              </div>
            </div>
          </div>
          {categoryFilter === 'needs_coverage' && (
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Active
            </span>
          )}
        </button>

        {/* Active Absences Today */}
        <button
          type="button"
          onClick={() => setCategoryFilter(prev => prev === 'active_today' ? 'all' : 'active_today')}
          className={`p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border ${
            categoryFilter === 'active_today'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center border transition ${
              categoryFilter === 'active_today'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{activeTodayCount}</div>
              <div className="text-xs font-medium text-slate-300">Active Absences Today</div>
              <div className="text-[11px] text-slate-400">Absent on current shifts</div>
            </div>
          </div>
          {categoryFilter === 'active_today' && (
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Active
            </span>
          )}
        </button>

        {/* All Requests */}
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border ${
            categoryFilter === 'all'
              ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center border transition ${
              categoryFilter === 'all'
                ? 'bg-purple-500 text-white border-purple-400 font-bold'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{allCount}</div>
              <div className="text-xs font-medium text-slate-300">All Time Off Requests</div>
              <div className="text-[11px] text-slate-400">Complete leave history</div>
            </div>
          </div>
          {categoryFilter === 'all' && (
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Active
            </span>
          )}
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Scope Pills */}
          <div className="bg-slate-800 p-1 rounded-lg flex items-center text-xs font-semibold">
            <button
              onClick={() => setViewScope('all')}
              className={`px-3 py-1.5 rounded-md transition ${
                viewScope === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Requests
            </button>
            <button
              onClick={() => setViewScope('mine')}
              className={`px-3 py-1.5 rounded-md transition ${
                viewScope === 'mine'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              My Requests
            </button>
          </div>

          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff, leave type, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Leave Type Filter */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Type:</span>
            <select
              value={leaveTypeFilter}
              onChange={(e) => setLeaveTypeFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Leave Types</option>
              {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="recent">Recent (Last 30 Days &amp; Upcoming)</option>
              <option value="today">Active Today</option>
              <option value="upcoming">Upcoming Only</option>
              <option value="past_30">Past 30 Days</option>
              <option value="all_archive">All Historical Records (Include Archive &gt;30d)</option>
              <option value="specific_date">Specific Date</option>
              <option value="custom_range">Date Range</option>
            </select>

            {dateFilter === 'specific_date' && (
              <div className="flex items-center space-x-1.5">
                <input
                  type="date"
                  value={filterSpecificDate}
                  onChange={(e) => setFilterSpecificDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {dateFilter === 'custom_range' && (
              <div className="flex items-center space-x-1.5">
                <input
                  type="date"
                  value={filterRangeStart}
                  onChange={(e) => setFilterRangeStart(e.target.value)}
                  placeholder="From"
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-500">→</span>
                <input
                  type="date"
                  value={filterRangeEnd}
                  min={filterRangeStart}
                  onChange={(e) => setFilterRangeEnd(e.target.value)}
                  placeholder="To"
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {dateFilter !== 'upcoming' && (
              <button
                type="button"
                onClick={() => setDateFilter('upcoming')}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                title="Reset to Upcoming Only"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {/* Quick Category Filter Banner */}
        {categoryFilter !== 'all' && (
          <div className="px-6 py-2.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-slate-300 flex-wrap gap-y-1">
              <span className="text-slate-400">Filtered by:</span>
              <span className="font-semibold text-amber-400">
                {categoryFilter === 'pending' && 'Needs HR Approval (Pending Review)'}
                {categoryFilter === 'needs_coverage' && (
                  includeAdvanceInCoverage
                    ? 'Needs Replacement Cover (All Approved & Unassigned, Including Advance)'
                    : 'Needs Replacement Cover (Approved within Next 30 Days)'
                )}
                {categoryFilter === 'active_today' && "Active Absences Today"}
              </span>
              <span className="text-slate-500">({filteredRequests.length} results)</span>
              {categoryFilter === 'needs_coverage' && advanceBookingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIncludeAdvanceInCoverage(!includeAdvanceInCoverage)}
                  className="ml-2 text-[11px] px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition"
                >
                  {includeAdvanceInCoverage
                    ? `Hide advance leaves (${advanceBookingCount})`
                    : `+ Show ${advanceBookingCount} advance leaves (>30d)`}
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setCategoryFilter('all');
                setIncludeAdvanceInCoverage(false);
              }}
              className="text-slate-400 hover:text-white flex items-center space-x-1 text-xs px-2 py-1 rounded hover:bg-slate-700/60 transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-sm">Loading time off requests...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 flex flex-col items-center justify-center space-y-2">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <CalendarOff className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm">No time off requests match your filter criteria.</p>
            {categoryFilter !== 'all' ? (
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setIncludeAdvanceInCoverage(false);
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs rounded-lg transition"
              >
                Reset Category Filter
              </button>
            ) : (
              <button
                onClick={handleCreateNew}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs rounded-lg transition"
              >
                + Submit First Request
              </button>
            )}
          </div>
        ) : (
          <div ref={timeOffTableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left text-sm text-slate-200 border-collapse table-fixed min-w-[1420px]">
              <colgroup>
                <col style={{ width: '200px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '290px' }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 shadow-xs">
                <tr>
                  <th className="py-3 px-4 font-semibold">Employee</th>
                  <th className="py-3 px-4 font-semibold">Leave Type</th>
                  <th className="py-3 px-4 font-semibold">Dates & Shifts</th>
                  <th className="py-3 px-4 font-semibold">Comments</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Review History</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {timeOffPaddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${timeOffPaddingTop}px`, padding: 0, border: 0 }} colSpan={7} />
                  </tr>
                )}
                {virtualTimeOffs.map((virtualRow) => {
                  const r = filteredRequests[virtualRow.index];
                  if (!r) return null;
                  const isEffectiveToday =
                    r.status === 'approved' && r.startDate <= todayStr && todayStr <= r.endDate;
                  const isPast = r.endDate < todayStr;
                  const isAdvanceBooking = r.status === 'approved' && !isPast && r.startDate > horizonLimitDateStr;

                  const canCancel =
                    r.status === 'pending' &&
                    (r.requestedByUserId === currentUser?.uid || isHR);

                  return (
                    <tr
                      key={r.id}
                      className="h-[70px] hover:bg-slate-800/40 transition duration-150 group"
                    >
                      {/* Employee */}
                      <td className="py-2.5 px-4 align-middle h-[70px]">
                        <div className="font-semibold text-white flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span>{r.employeeName}</span>
                        </div>
                        {r.employeeNumber && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            ID: {r.employeeNumber}
                          </div>
                        )}
                      </td>

                      {/* Leave Type */}
                      <td className="py-2.5 px-4 align-middle h-[70px]">
                        <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType}
                        </span>
                      </td>

                      {/* Dates & Shifts */}
                      <td className="py-2.5 px-4 align-middle h-[70px]">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-mono">
                          <span>{r.startDate}</span>
                          <span className="text-slate-500">→</span>
                          <span>{r.endDate}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                            {r.shiftType === 'ALL' ? 'Full Day' : `${r.shiftType} Only`}
                          </span>
                          {isEffectiveToday && (
                            <span className="inline-flex items-center text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Absent Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Comments */}
                      <td className="py-2.5 px-4 align-middle h-[70px]">
                        {r.comments ? (
                          <div className="text-xs text-slate-300 truncate" title={r.comments}>
                            {r.comments}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">None</span>
                        )}
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Submitted {safeFormatDate(r.createdAt)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4 align-middle h-[70px]">
                        {r.status === 'pending' ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isPast
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                            title={isPast ? 'Leave date has passed without HR approval' : 'Pending review'}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {isPast ? 'Pending (Expired)' : 'Pending Review'}
                          </span>
                        ) : r.status === 'approved' ? (
                          <div className="flex flex-col items-start space-y-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Approved
                            </span>
                            {isPast ? (
                              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                                Completed
                              </span>
                            ) : isAdvanceBooking ? (
                              <span
                                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20"
                                title={`Advance leave approved. Coverage window opens 30 days prior (${addDaysToDateString(r.startDate, -30)})`}
                              >
                                <Calendar className="w-2.5 h-2.5 mr-1" />
                                Advance Booking
                              </span>
                            ) : r.coverageAssigned ? (
                              <span
                                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                title="Replacement coverage has been assigned"
                              >
                                <UserCheck className="w-2.5 h-2.5 mr-1" />
                                Covered
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                title="Needs replacement driver or route opening bulletin (within 30 days)"
                              >
                                <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                Needs Cover
                              </span>
                            )}
                          </div>
                        ) : r.status === 'rejected' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            Cancelled
                          </span>
                        )}
                      </td>

                      {/* Review History */}
                      <td className="py-2.5 px-4 align-middle h-[70px]">
                        {r.approvedByName ? (
                          <div>
                            <div className="text-xs text-slate-300 font-medium">
                              {r.approvedByName}
                            </div>
                            {r.approvedAt && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                {safeFormatDate(r.approvedAt)}
                              </div>
                            )}
                            {r.approvalNotes && (
                              <div className="text-[11px] text-slate-400 italic truncate mt-0.5" title={r.approvalNotes}>
                                "{r.approvalNotes}"
                              </div>
                            )}
                            {r.notifiedChannels && r.notifiedChannels.length > 0 && (
                              <div className="flex items-center space-x-1.5 mt-1.5 text-[10px]">
                                {r.notifiedChannels.includes('email') && (
                                  <span
                                    className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    title="Applicant notified via Email"
                                  >
                                    <Mail className="w-2.5 h-2.5 mr-0.5" /> Email
                                  </span>
                                )}
                                {r.notifiedChannels.includes('sms') && (
                                  <span
                                    className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    title="Applicant notified via SMS"
                                  >
                                    <MessageSquare className="w-2.5 h-2.5 mr-0.5" /> SMS
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Awaiting review</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right align-middle h-[70px] whitespace-nowrap overflow-hidden">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* HR Decision Action: only HR can approve/reject */}
                          {isHR && r.status === 'pending' && (
                            <button
                              onClick={() => handleOpenReview(r)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-1 transition shadow-sm"
                              title="Review and approve/reject"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Review</span>
                            </button>
                          )}

                          {/* Dispatcher Coverage Actions: Manual assignment or Post Route Opening */}
                          {isDispatcher && r.status === 'approved' && (
                            isPast ? (
                              <span className="text-[11px] text-slate-500 italic px-2 py-0.5 bg-slate-800/60 rounded-md border border-slate-700/40">
                                Past Absence
                              </span>
                            ) : isAdvanceBooking ? (
                              <div className="flex items-center space-x-1.5">
                                <span
                                  className="text-[11px] text-slate-400 italic px-2 py-0.5 bg-slate-800/60 rounded-md border border-slate-700/40"
                                  title={`Coverage scheduling window opens on ${addDaysToDateString(r.startDate, -30)} (30 days prior)`}
                                >
                                  Opens {addDaysToDateString(r.startDate, -30)}
                                </span>
                                <button
                                  onClick={() => handleAssignCoverage(r)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition border border-slate-700"
                                  title="Pre-assign early if replacement driver is already determined"
                                >
                                  Pre-assign
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleAssignCoverage(r)}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg flex items-center space-x-1 transition shadow-sm"
                                  title="Manually assign replacement driver / attendant / vehicle"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Assign Cover</span>
                                </button>
                                <button
                                  onClick={() => handlePostRouteOpening(r)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg flex items-center space-x-1 transition shadow-sm"
                                  title="Publish Route Opening & Coverage Bulletin to Bidding Board"
                                >
                                  <Radio className="w-3.5 h-3.5" />
                                  <span>Post Opening</span>
                                </button>
                              </>
                            )
                          )}

                          {/* Edit pending request */}
                          {r.status === 'pending' && (r.requestedByUserId === currentUser?.uid || isHR) && (
                            <button
                              onClick={() => handleEdit(r)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                              title="Edit Request"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cancel pending request */}
                          {canCancel && (
                            <button
                              onClick={() => handleCancelRequest(r.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                              title="Cancel Request"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Export / Print PDF Form */}
                          <button
                            onClick={() => handleOpenPdfExport(r)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                            title="Export / Print Official PDF Form"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Delete (Admin only) */}
                          {currentUser?.role === 'admin' && (
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-800 rounded transition"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {timeOffPaddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${timeOffPaddingBottom}px`, padding: 0, border: 0 }} colSpan={7} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}

      {/* Submit / Edit Modal */}
      {isSubmitModalOpen && (
        <TimeOffModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          request={editingRequest}
          employees={employees}
          onSaved={() => {
            loadData();
          }}
        />
      )}

      {/* HR Review Modal */}
      {isReviewModalOpen && reviewingRequest && (
        <TimeOffReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setReviewingRequest(null);
          }}
          request={reviewingRequest}
          employees={employees}
          onDecisionCompleted={() => {
            loadData();
          }}
        />
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <TimeOffSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}

      {/* Temporary Assignment Coverage Modal */}
      {isCoverModalOpen && coverInitialAssignment && (
        <TemporaryAssignmentModal
          isOpen={isCoverModalOpen}
          onClose={() => {
            setIsCoverModalOpen(false);
            setCoverInitialAssignment(null);
            setActiveTimeOffForCoverage(null);
          }}
          assignment={coverInitialAssignment}
          routes={routes}
          employees={employees}
          vehicles={vehicles}
          onSwitchToRouteOpening={() => {
            if (activeTimeOffForCoverage) {
              handlePostRouteOpening(activeTimeOffForCoverage);
            }
          }}
          onSaved={async () => {
            if (activeTimeOffForCoverage?.id) {
              try {
                await TimeOffService.updateTimeOffRequest(activeTimeOffForCoverage.id, {
                  coverageAssigned: true,
                  coverageAssignedAt: new Date().toISOString()
                });
              } catch (e) {
                console.error('Failed to mark time off as coverage assigned', e);
              }
            }
            loadData();
            if (onNavigateToTemporaryAssignments) {
              onNavigateToTemporaryAssignments();
            }
          }}
        />
      )}

      {/* Route Opening Bulletin Modal */}
      {isCreateOpeningModalOpen && (
        <RouteOpeningCreateModal
          isOpen={isCreateOpeningModalOpen}
          onClose={() => {
            setIsCreateOpeningModalOpen(false);
            setOpeningInitialValues(null);
            setActiveTimeOffForCoverage(null);
          }}
          routes={routes}
          initialValues={openingInitialValues}
          onCreated={async () => {
            if (activeTimeOffForCoverage?.id) {
              try {
                await TimeOffService.updateTimeOffRequest(activeTimeOffForCoverage.id, {
                  coverageAssigned: true,
                  coverageAssignedAt: new Date().toISOString()
                });
              } catch (e) {
                console.error('Failed to mark time off as coverage assigned', e);
              }
            }
            loadData();
            if (onNavigateToTemporaryAssignments) {
              onNavigateToTemporaryAssignments();
            }
          }}
        />
      )}

      {/* Official Time Off PDF Authorization Form Modal */}
      {isPdfModalOpen && (
        <TimeOffPdfModal
          isOpen={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            setActiveTimeOffForPdf(null);
          }}
          request={activeTimeOffForPdf}
          allRequests={filteredRequests.length > 0 ? filteredRequests : requests}
          employees={employees}
          routes={routes}
        />
      )}
    </div>
  );
};
