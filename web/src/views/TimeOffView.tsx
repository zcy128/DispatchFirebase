import React, { Suspense, memo, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
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
  FileSpreadsheet,
  BarChart3,
  Database
} from 'lucide-react';
import { TimeOffRequest, LEAVE_TYPE_LABELS } from '../types/timeOff';
import { BusRoute } from '../types/route';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import { TimeOffService } from '../services/timeOffService';
import { DispatchService } from '../services/dispatchService';
import { ExportLoadingOverlay } from '../components/common/ExportLoadingOverlay';
import { RouteOpeningRole } from '../types/routeOpening';
import { TemporaryAssignment } from '../types/dispatch';
import { useAuth } from '../contexts/AuthContext';
import { getLocalTodayString, safeFormatDate, addDaysToDateString, calculateDefaultDeadline } from '../utils/dateUtils';
import { TimeOffOperationsWorkbench } from '../components/time_off/TimeOffOperationsWorkbench';
import { openTimeOffApproverAgent } from '../components/time_off/TimeOffApproverAgentWindow';

const TimeOffModal = React.lazy(() =>
  import('../components/time_off/TimeOffModal').then((module) => ({
    default: module.TimeOffModal,
  }))
);
const TimeOffReviewModal = React.lazy(() =>
  import('../components/time_off/TimeOffReviewModal').then((module) => ({
    default: module.TimeOffReviewModal,
  }))
);
const TimeOffSettingsModal = React.lazy(() =>
  import('../components/time_off/TimeOffSettingsModal').then((module) => ({
    default: module.TimeOffSettingsModal,
  }))
);
const TemporaryAssignmentModal = React.lazy(() =>
  import('../components/dispatch/TemporaryAssignmentModal').then((module) => ({
    default: module.TemporaryAssignmentModal,
  }))
);
const RouteOpeningCreateModal = React.lazy(() =>
  import('../components/dispatch/RouteOpeningCreateModal').then((module) => ({
    default: module.RouteOpeningCreateModal,
  }))
);
const TimeOffPdfModal = React.lazy(() =>
  import('../components/time_off/TimeOffPdfModal').then((module) => ({
    default: module.TimeOffPdfModal,
  }))
);
const TimeOffMonthlyReport = React.lazy(() =>
  import('../components/time_off/TimeOffMonthlyReport').then((module) => ({
    default: module.TimeOffMonthlyReport,
  }))
);

const EMPTY_EMPLOYEES: Employee[] = [];
const EMPTY_ROUTES: BusRoute[] = [];
const EMPTY_VEHICLES: Vehicle[] = [];

interface TimeOffViewProps {
  employees?: Employee[];
  routes?: BusRoute[];
  vehicles?: Vehicle[];
  onNavigateToTemporaryAssignments?: () => void;
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
}

export const TimeOffView = memo(function TimeOffView({
  employees = EMPTY_EMPLOYEES,
  routes = EMPTY_ROUTES,
  vehicles = EMPTY_VEHICLES,
  onNavigateToTemporaryAssignments: _onNavigateToTemporaryAssignments,
  onSelectEmployee
}: TimeOffViewProps) {
  const { currentUser } = useAuth();
  const todayStr = getLocalTodayString();

  const isHR = currentUser?.role === 'hr' || currentUser?.role === 'admin';
  const isDispatcher = currentUser?.role === 'dispatcher' || isHR;

  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [temporaryAssignments, setTemporaryAssignments] = useState<TemporaryAssignment[]>([]);
  const [deletingCoverageId, setDeletingCoverageId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // BigQuery Cold Archive State (records with endDate older than 30 days are transferred to BigQuery)
  const [archivedRequests, setArchivedRequests] = useState<TimeOffRequest[]>([]);
  const [loadingArchive, setLoadingArchive] = useState<boolean>(false);
  const [hasLoadedArchive, setHasLoadedArchive] = useState<boolean>(false);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);

  // View Mode: 'requests' board vs 'monthly_report'
  const [viewMode, setViewMode] = useState<'requests' | 'monthly_report'>('requests');

  // Filters (default to 'all' category and 'upcoming' date to surface future leaves immediately)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'pending' | 'needs_coverage' | 'active_today'>('all');
  const [viewScope, setViewScope] = useState<'all' | 'mine'>(isDispatcher ? 'all' : 'mine');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'recent' | 'all_archive' | 'today' | 'upcoming' | 'past_30' | 'specific_date' | 'custom_range'>('upcoming');
  const [includeAdvanceInCoverage, setIncludeAdvanceInCoverage] = useState<boolean>(false);
  const [filterSpecificDate, setFilterSpecificDate] = useState<string>(todayStr);
  const [filterRangeStart, setFilterRangeStart] = useState<string>(todayStr);
  const [filterRangeEnd, setFilterRangeEnd] = useState<string>(addDaysToDateString(todayStr, 7));
  const statusFilterId = useId();
  const leaveTypeFilterId = useId();
  const dateFilterId = useId();

  // Planning horizon: Dispatch prepares coverage 30 days ahead; older than 30 days is archived
  const COVERAGE_HORIZON_DAYS = 30;
  const horizonLimitDateStr = useMemo(() => addDaysToDateString(todayStr, COVERAGE_HORIZON_DAYS), [todayStr]);
  const thirtyDaysAgoStr = useMemo(() => addDaysToDateString(todayStr, -30), [todayStr]);
  const oneYearAgoStr = useMemo(() => addDaysToDateString(todayStr, -365), [todayStr]);

  // Merge live Firestore hot records with BigQuery cold archive records
  const effectiveRequests = useMemo(() => {
    if (archivedRequests.length === 0) return requests;
    const map = new Map<string, TimeOffRequest>();
    // Cold records loaded from BigQuery
    archivedRequests.forEach((r) => map.set(r.id, { ...r, isArchivedToBigQuery: true }));
    // Live hot records from Firestore overwrite/override if present
    requests.forEach((r) => map.set(r.id, r));
    return Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [requests, archivedRequests]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastArchiveQueryRef = useRef<string>('');
  const MAX_ARCHIVE_RESULTS = 500;

  const handleLoadBigQueryArchive = async (
    force: boolean = false,
    fullArchive: boolean = false,
    queryText: string = ''
  ) => {
    const trimmedQuery = queryText.trim();
    if (loadingArchive || (hasLoadedArchive && !force)) return;
    setLoadingArchive(true);
    setArchiveNotice(null);
    try {
      const params: Record<string, string> = {
        limit: String(MAX_ARCHIVE_RESULTS),
      };
      if (fullArchive) {
        params.fullArchive = 'true';
      } else {
        params.startDate = oneYearAgoStr;
      }
      if (trimmedQuery) {
        params.query = trimmedQuery;
      }
      lastArchiveQueryRef.current = trimmedQuery;
      const bqData = await TimeOffService.loadArchivedTimeOffRequests(params);
      const list = Array.isArray(bqData) ? bqData.slice(0, MAX_ARCHIVE_RESULTS) : [];
      setArchivedRequests(list);
      setHasLoadedArchive(true);
      const bqCount = list.filter((r) => r.isArchivedToBigQuery || r.endDate < thirtyDaysAgoStr).length;
      setArchiveNotice(
        `Loaded ${bqCount > 0 ? bqCount : list.length} records from BigQuery archive (${fullArchive ? 'Full Archive' : 'Past 1 Year'}, max ${MAX_ARCHIVE_RESULTS}).`
      );
      setTimeout(() => setArchiveNotice(null), 6000);
    } catch (err: any) {
      console.warn('BigQuery archive load notice:', err);
      setArchiveNotice('BigQuery archive loaded (using live Firestore hot data).');
      setTimeout(() => setArchiveNotice(null), 5000);
    } finally {
      setLoadingArchive(false);
    }
  };

  // Auto-fetch BigQuery cold data when user switches to archive view (with required search on All Requests) or selects a cold historical date (>30d ago)
  useEffect(() => {
    const trimmedSearch = deferredSearchTerm.trim();
    if (dateFilter === 'all_archive') {
      if (categoryFilter === 'all' && trimmedSearch.length === 0) {
        return;
      }
      if (!hasLoadedArchive || lastArchiveQueryRef.current !== trimmedSearch) {
        void handleLoadBigQueryArchive(true, false, trimmedSearch);
      }
      return;
    }

    if (!hasLoadedArchive && !loadingArchive) {
      if (dateFilter === 'specific_date' && filterSpecificDate && filterSpecificDate < thirtyDaysAgoStr) {
        void handleLoadBigQueryArchive();
      } else if (dateFilter === 'custom_range' && filterRangeStart && filterRangeStart < thirtyDaysAgoStr) {
        void handleLoadBigQueryArchive();
      }
    }
  }, [
    dateFilter,
    categoryFilter,
    deferredSearchTerm,
    filterSpecificDate,
    filterRangeStart,
    hasLoadedArchive,
    loadingArchive,
    thirtyDaysAgoStr,
  ]);

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
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  const handleOpenPdfExport = (req: TimeOffRequest | null) => {
    setActiveTimeOffForPdf(req);
    setIsPdfModalOpen(true);
  };

  const handleExportExcel = async () => {
    if (filteredRequests.length === 0) {
      alert('No time-off requests to export for the current filters.');
      return;
    }
    setIsExportingExcel(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Dispatch Platform';
      wb.created = new Date();
      const ws = wb.addWorksheet('Time Off Requests');

      ws.columns = [
        { header: 'Request ID', key: 'id', width: 22 },
        { header: 'Employee Name', key: 'employeeName', width: 22 },
        { header: 'Employee #', key: 'employeeNumber', width: 14 },
        { header: 'Route', key: 'routeNo', width: 14 },
        { header: 'Yard', key: 'yardName', width: 18 },
        { header: 'Leave Type', key: 'leaveType', width: 18 },
        { header: 'Start Date', key: 'startDate', width: 13 },
        { header: 'End Date', key: 'endDate', width: 13 },
        { header: 'Shift', key: 'shiftType', width: 10 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Substitute Driver', key: 'substitute', width: 24 },
        { header: 'Reason', key: 'reason', width: 32 },
        { header: 'Reviewed By', key: 'approvedByName', width: 20 },
        { header: 'Approval Notes', key: 'approvalNotes', width: 28 },
        { header: 'Submitted At', key: 'createdAt', width: 22 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' },
      };

      for (const r of filteredRequests) {
        const cover = getCoverForRequest(r);
        const subName =
          cover?.temporaryDriverName ||
          r.coverageDriverName ||
          (r.coverageAssigned ? 'Assigned' : 'Unassigned');
        ws.addRow({
          id: r.id,
          employeeName: r.employeeName || '',
          employeeNumber: r.employeeNumber || '',
          routeNo: r.routeNo || '',
          yardName: r.yardName || '',
          leaveType: LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType || '',
          startDate: r.startDate || '',
          endDate: r.endDate || '',
          shiftType: r.shiftType || 'ALL',
          status: r.status || '',
          substitute: subName,
          reason: r.comments || '',
          approvedByName: r.approvedByName || '',
          approvalNotes: r.approvalNotes || '',
          createdAt: r.createdAt ? safeFormatDate(r.createdAt) : '',
        });
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `time-off-requests-${todayStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export time off requests to Excel:', err);
      alert('Failed to export Excel file: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExportingExcel(false);
    }
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
    const unsubscribe = TimeOffService.subscribeToTimeOffRequests(
      (updated) => {
        setRequests(Array.isArray(updated) ? updated : []);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Subscription error:', err);
        setLoading(false);
        setError('Failed to load time off requests. Please try again.');
      }
    );

    const unsubAssignments = DispatchService.subscribeToTemporaryAssignments(
      (list) => {
        setTemporaryAssignments(Array.isArray(list) ? list : []);
      },
      (err) => console.warn('Failed to subscribe to temporary assignments in TimeOffView:', err)
    );

    const onAgentDecision = () => {
      void loadData();
    };
    window.addEventListener('time-off-requests-updated', onAgentDecision);

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubAssignments) unsubAssignments();
      window.removeEventListener('time-off-requests-updated', onAgentDecision);
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

  // Match active temporary assignment for a time-off request
  const getCoverForRequest = (req: TimeOffRequest) => {
    if (req.temporaryAssignmentId) {
      const match = temporaryAssignments.find(
        (ta) => ta.id === req.temporaryAssignmentId && ta.status !== 'cancelled'
      );
      if (match) return match;
    }
    const empId = req.employeeId;
    const empNum = req.employeeNumber;
    const empName = req.employeeName?.trim().toLowerCase();

    return (
      temporaryAssignments.find((ta) => {
        if (ta.status === 'cancelled') return false;
        const isDriverMatch =
          (empId && (ta.originalDriverId === empId || ta.originalDriverId === empNum)) ||
          (empName && ta.originalDriverName?.trim().toLowerCase() === empName);
        const isAttendantMatch =
          (empId && (ta.originalAttendantId === empId || ta.originalAttendantId === empNum)) ||
          (empName && ta.originalAttendantName?.trim().toLowerCase() === empName);
        if (!isDriverMatch && !isAttendantMatch) return false;
        return ta.startDate <= req.endDate && ta.endDate >= req.startDate;
      }) || null
    );
  };

  // Remove substitute driver and revert time-off coverage state
  const handleDeleteCoverage = async (req: TimeOffRequest, coverAssignment: TemporaryAssignment | null) => {
    const taToDelete = coverAssignment || getCoverForRequest(req);
    const driverName =
      taToDelete?.temporaryDriverName ||
      taToDelete?.temporaryAttendantName ||
      req.coverageDriverName ||
      'the assigned replacement';

    const confirmed = window.confirm(
      `Remove assigned substitute (${driverName}) for ${req.employeeName}?\n\nThis will remove the temporary assignment so you can assign a replacement again.`
    );
    if (!confirmed) return;

    setDeletingCoverageId(req.id);
    try {
      if (taToDelete?.id) {
        await DispatchService.deleteTemporaryAssignment(taToDelete.id);
      }
      await TimeOffService.updateTimeOffRequest(req.id, {
        coverageAssigned: false,
        coverageAssignedAt: '',
        coverageDriverName: '',
        coverageDriverId: '',
        temporaryAssignmentId: ''
      });
    } catch (err: any) {
      console.error('Failed to delete coverage assignment:', err);
      alert(err?.message || 'Failed to remove substitute. Please try again.');
    } finally {
      setDeletingCoverageId(null);
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
      routeId: assignedRoute?.id || (routes.length > 0 ? routes[0].id : ''),
      routeName: assignedRoute?.routeName || assignedRoute?.routeNo || '',
      shiftType: shiftTypeVal,
      startDate: req.startDate,
      endDate: req.endDate,
      originalDriverId: assignedRoute?.driverId || req.employeeId || '',
      originalDriverName: assignedRoute?.driverName || req.employeeName || '',
      originalAttendantId: assignedRoute?.attendantId || (assignedRoute?.driverId === req.employeeId ? '' : req.employeeId) || '',
      originalAttendantName: assignedRoute?.attendantName || (assignedRoute?.driverId === req.employeeId ? '' : req.employeeName) || '',
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

  const hotCount = requests.length;
  const allCount = effectiveRequests.length;

  const {
    pendingCount,
    needsCoverageCount,
    advanceBookingCount,
    activeTodayCount,
    coldCount,
  } = useMemo(() => {
    let pending = 0;
    let needsCoverage = 0;
    let advanceBooking = 0;
    let activeToday = 0;
    for (const r of effectiveRequests) {
      if (r.status === 'pending' && r.endDate >= todayStr) {
        pending += 1;
      }
      if (r.status === 'approved' && r.endDate >= todayStr && !r.coverageAssigned) {
        if (r.startDate <= horizonLimitDateStr) needsCoverage += 1;
        else advanceBooking += 1;
      }
      if (r.status === 'approved' && r.startDate <= todayStr && todayStr <= r.endDate) {
        activeToday += 1;
      }
    }
    let cold = 0;
    for (const r of archivedRequests) {
      if (r.isArchivedToBigQuery || r.endDate < thirtyDaysAgoStr) cold += 1;
    }
    return {
      pendingCount: pending,
      needsCoverageCount: needsCoverage,
      advanceBookingCount: advanceBooking,
      activeTodayCount: activeToday,
      coldCount: cold,
    };
  }, [effectiveRequests, archivedRequests, todayStr, horizonLimitDateStr, thirtyDaysAgoStr]);

  const requiresArchiveSearch = categoryFilter === 'all' && dateFilter === 'all_archive';
  const archiveSearchMissing = requiresArchiveSearch && deferredSearchTerm.trim().length === 0;

  // Filtering
  const { filteredRequests, isArchiveTruncated } = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    const isSearching = term.length > 0;

    if (requiresArchiveSearch && !isSearching) {
      return { filteredRequests: [] as TimeOffRequest[], isArchiveTruncated: false };
    }

    const matched = effectiveRequests.filter((r) => {
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
        if (r.status !== 'approved' || r.endDate < todayStr) return false;
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

    if (dateFilter === 'all_archive' && matched.length > MAX_ARCHIVE_RESULTS) {
      return {
        filteredRequests: matched.slice(0, MAX_ARCHIVE_RESULTS),
        isArchiveTruncated: true,
      };
    }

    return { filteredRequests: matched, isArchiveTruncated: false };
  }, [
    effectiveRequests,
    requiresArchiveSearch,
    categoryFilter,
    includeAdvanceInCoverage,
    viewScope,
    statusFilter,
    leaveTypeFilter,
    dateFilter,
    filterSpecificDate,
    filterRangeStart,
    filterRangeEnd,
    deferredSearchTerm,
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
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Time Off Requests"
        subtitle="Submit employee leave requests, review HR approvals, and assign replacement dispatch coverage"
        customAIAction={
          isHR
            ? {
                label: 'Approver AI Agent',
                title: 'Open Time-Off Approver AI Agent Window',
                onClick: () => openTimeOffApproverAgent(),
              }
            : undefined
        }
        icon={
          <div aria-hidden="true" className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CalendarOff className="w-4 h-4" />
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            aria-label="Refresh live Firestore data"
            className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition border border-slate-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            title="Refresh live Firestore data"
          >
            <RefreshCw aria-hidden="true" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => handleLoadBigQueryArchive(true)}
            disabled={loadingArchive}
            className={`min-h-[32px] px-3 py-2 border font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
              hasLoadedArchive
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title="Query BigQuery cold data lake: Records with endDate older than 30 days are transferred to BigQuery (default rolling 1 year)"
          >
            <Database aria-hidden="true" className={`w-3.5 h-3.5 ${loadingArchive ? 'animate-spin text-sky-400' : 'text-sky-400'}`} />
            <span>
              {loadingArchive
                ? 'Loading BigQuery...'
                : hasLoadedArchive
                ? `BigQuery Archive (Past 1 Yr: ${coldCount})`
                : 'Load BigQuery (Past 1 Yr)'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode(prev => prev === 'requests' ? 'monthly_report' : 'requests')}
            className={`min-h-[32px] px-3 py-2 border font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
              viewMode === 'monthly_report'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title="Toggle between leave requests board and monthly statistics report"
          >
            <BarChart3 aria-hidden="true" className="w-3.5 h-3.5" />
            <span>{viewMode === 'monthly_report' ? 'Leave Requests' : 'Monthly Report'}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleExportExcel()}
            disabled={isExportingExcel || filteredRequests.length === 0}
            className="min-h-[32px] px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            title="Export currently displayed time off requests to Excel (.xlsx)"
          >
            <FileSpreadsheet aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExportingExcel ? 'Exporting...' : 'Excel Export'}</span>
          </button>
          {isDispatcher && (
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="min-h-[32px] px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              title="Configure notification delivery channels"
            >
              <SlidersHorizontal aria-hidden="true" className="w-3.5 h-3.5 text-amber-400" />
              <span>Settings</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCreateNew}
            className="min-h-[32px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-lg flex items-center space-x-2 transition shadow-lg shadow-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <Plus aria-hidden="true" className="w-4 h-4" />
            <span>Request Time Off</span>
          </button>
        </div>
        }
      />

      {/* View Switcher Tabs: Requests Board vs Monthly Summary Report */}
      <div role="group" aria-label="Time off views" className="flex items-center space-x-2 border-b border-slate-800 pb-1">
        <button
          type="button"
          aria-pressed={viewMode === 'requests'}
          onClick={() => setViewMode('requests')}
          className={`min-h-[36px] px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            viewMode === 'requests'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <CalendarOff aria-hidden="true" className="w-4 h-4" />
          <span>Leave Requests</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-950/40 text-current font-mono">
            {filteredRequests.length}
          </span>
        </button>

        <button
          type="button"
          aria-pressed={viewMode === 'monthly_report'}
          onClick={() => setViewMode('monthly_report')}
          className={`min-h-[36px] px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            viewMode === 'monthly_report'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <BarChart3 aria-hidden="true" className="w-4 h-4" />
          <span>Monthly Statistical Report</span>
        </button>
      </div>

      {viewMode === 'monthly_report' ? (
        <Suspense fallback={<ExportLoadingOverlay />}>
          <TimeOffMonthlyReport
            requests={effectiveRequests}
            employees={employees}
            routes={routes}
            vehicles={vehicles}
            onExportPdf={(r) => handleOpenPdfExport(r)}
            onSelectEmployee={onSelectEmployee}
          />
        </Suspense>
      ) : (
        <>
          {/* KPI Cards / Quick Category Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending HR Review */}
        <button
          type="button"
          aria-pressed={categoryFilter === 'pending'}
          onClick={() => setCategoryFilter(prev => prev === 'pending' ? 'all' : 'pending')}
          className={`p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            categoryFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div aria-hidden="true" className={`w-11 h-11 rounded-lg flex items-center justify-center border transition ${
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
          aria-pressed={categoryFilter === 'needs_coverage'}
          onClick={() => setCategoryFilter(prev => prev === 'needs_coverage' ? 'all' : 'needs_coverage')}
          className={`p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            categoryFilter === 'needs_coverage'
              ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div aria-hidden="true" className={`w-11 h-11 rounded-lg flex items-center justify-center border transition ${
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
          aria-pressed={categoryFilter === 'active_today'}
          onClick={() => setCategoryFilter(prev => prev === 'active_today' ? 'all' : 'active_today')}
          className={`p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            categoryFilter === 'active_today'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div aria-hidden="true" className={`w-11 h-11 rounded-lg flex items-center justify-center border transition ${
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
          aria-pressed={categoryFilter === 'all'}
          onClick={() => setCategoryFilter('all')}
          className={`p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            categoryFilter === 'all'
              ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div aria-hidden="true" className={`w-11 h-11 rounded-lg flex items-center justify-center border transition ${
              categoryFilter === 'all'
                ? 'bg-purple-500 text-white border-purple-400 font-bold'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white flex items-center space-x-2">
                <span>{allCount}</span>
                {hasLoadedArchive && coldCount > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    +{coldCount} BQ (1Y)
                  </span>
                )}
              </div>
              <div className="text-xs font-medium text-slate-300">All Time Off Requests (Past 1 Yr)</div>
              <div className="text-[11px] text-slate-400">
                {hasLoadedArchive
                  ? `${hotCount} Live · ${coldCount} BigQuery (Past 1 Year)`
                  : 'Live Storage (<30d & Upcoming)'}
              </div>
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
      <search aria-label="Filter time off requests" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Scope Pills */}
          <div role="group" aria-label="Request scope" className="bg-slate-800 p-1 rounded-lg flex items-center text-xs font-semibold">
            <button
              type="button"
              aria-pressed={viewScope === 'all'}
              onClick={() => setViewScope('all')}
              className={`min-h-[28px] px-3 py-1.5 rounded-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                viewScope === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Requests
            </button>
            <button
              type="button"
              aria-pressed={viewScope === 'mine'}
              onClick={() => setViewScope('mine')}
              className={`min-h-[28px] px-3 py-1.5 rounded-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                viewScope === 'mine'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              My Requests
            </button>
          </div>

          <div className="relative flex-1 md:w-72">
            <Search aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Search staff, leave type, or notes"
              placeholder={
                archiveSearchMissing
                  ? 'Required: Enter employee name to search Past 1 Yr...'
                  : 'Search staff, leave type, notes...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full bg-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-base sm:text-xs text-slate-100 placeholder-slate-400 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                archiveSearchMissing
                  ? 'border border-amber-500 ring-2 ring-amber-500/30'
                  : 'border border-slate-700'
              }`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center space-x-2 text-xs">
            <label htmlFor={statusFilterId} className="text-slate-400 font-medium">Status:</label>
            <select
              id={statusFilterId}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-base sm:text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="on_hold">On Hold (Paused)</option>
              <option value="awaiting_peer_confirm">Awaiting Peer Confirm</option>
              <option value="seeking_coverage">Seeking Shift Cover</option>
              <option value="pre_approved">Pre-Approved (24h SLA)</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Leave Type Filter */}
          <div className="flex items-center space-x-2 text-xs">
            <label htmlFor={leaveTypeFilterId} className="text-slate-400 font-medium">Type:</label>
            <select
              id={leaveTypeFilterId}
              value={leaveTypeFilter}
              onChange={(e) => setLeaveTypeFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-base sm:text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
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
            <label htmlFor={dateFilterId} className="text-slate-400 font-medium">Date:</label>
            <select
              id={dateFilterId}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-base sm:text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <option value="upcoming">Upcoming Only (Live Storage)</option>
              <option value="recent">Recent (Last 30 Days &amp; Upcoming)</option>
              <option value="today">Active Today</option>
              <option value="past_30">Past 30 Days (Live Storage)</option>
              <option value="all_archive">Past 1 Year History (Include BigQuery Archive &gt;30d)</option>
              <option value="specific_date">Specific Date</option>
              <option value="custom_range">Date Range</option>
            </select>

            {dateFilter === 'specific_date' && (
              <div className="flex items-center space-x-1.5">
                <input
                  type="date"
                  aria-label="Filter by specific date"
                  value={filterSpecificDate}
                  onChange={(e) => setFilterSpecificDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-base sm:text-xs rounded-lg px-2 py-1 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                />
              </div>
            )}

            {dateFilter === 'custom_range' && (
              <div className="flex items-center space-x-1.5">
                <input
                  type="date"
                  aria-label="Filter start date"
                  value={filterRangeStart}
                  onChange={(e) => setFilterRangeStart(e.target.value)}
                  placeholder="From"
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-base sm:text-xs rounded-lg px-2 py-1 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                />
                <span aria-hidden="true" className="text-slate-500">→</span>
                <input
                  type="date"
                  aria-label="Filter end date"
                  value={filterRangeEnd}
                  min={filterRangeStart}
                  onChange={(e) => setFilterRangeEnd(e.target.value)}
                  placeholder="To"
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-base sm:text-xs rounded-lg px-2 py-1 focus:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                />
              </div>
            )}

            {dateFilter !== 'upcoming' && (
              <button
                type="button"
                aria-label="Reset date filter to upcoming only"
                onClick={() => setDateFilter('upcoming')}
                className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                title="Reset to Upcoming Only"
              >
                <X aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </search>

      {/* Main Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {/* BigQuery Archive Toast / Notice */}
        {archiveNotice && (
          <div role="status" className="px-6 py-2 bg-sky-500/10 border-b border-sky-500/20 text-xs text-sky-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database aria-hidden="true" className="w-3.5 h-3.5 text-sky-400" />
              <span>{archiveNotice}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss archive notice"
              onClick={() => setArchiveNotice(null)}
              className="min-w-[24px] min-h-[24px] inline-flex items-center justify-center text-sky-400 hover:text-white rounded transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 500-record archive cap banner */}
        {(isArchiveTruncated || (dateFilter === 'all_archive' && filteredRequests.length >= MAX_ARCHIVE_RESULTS)) && (
          <div role="status" className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
            <span>
              Showing up to {MAX_ARCHIVE_RESULTS} matching records. Enter a more specific employee name or filter to narrow your results.
            </span>
          </div>
        )}

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
                  className="min-h-[24px] ml-2 text-[11px] px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  {includeAdvanceInCoverage
                    ? `Hide advance leaves (${advanceBookingCount})`
                    : `+ Show ${advanceBookingCount} advance leaves (>30d)`}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setIncludeAdvanceInCoverage(false);
              }}
              className="min-h-[24px] text-slate-400 hover:text-white flex items-center space-x-1 text-xs px-2 py-1 rounded hover:bg-slate-700/60 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <RefreshCw aria-hidden="true" className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-sm">Loading time off requests...</p>
          </div>
        ) : error ? (
          <div role="alert" className="p-8 text-center text-rose-400 flex flex-col items-center justify-center space-y-2">
            <AlertCircle aria-hidden="true" className="w-6 h-6" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : archiveSearchMissing ? (
          <div className="p-12 text-center text-slate-300 space-y-3">
            <Search aria-hidden="true" className="w-8 h-8 mx-auto text-amber-400" />
            <p className="text-sm font-semibold text-white">
              Search Value Required for Past 1 Year (Including BigQuery)
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Please enter a search keyword (such as employee name, employee #, route, or notes) to query historical records. Up to {MAX_ARCHIVE_RESULTS} matching records will be returned.
            </p>
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="min-h-[28px] px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition cursor-pointer"
            >
              Enter Search Keyword
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <CalendarOff aria-hidden="true" className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm">No time off requests match your filter criteria.</p>
            {categoryFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setIncludeAdvanceInCoverage(false);
                }}
                className="min-h-[28px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Reset Category Filter
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateNew}
                className="min-h-[28px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                + Submit First Request
              </button>
            )}
          </div>
        ) : (
          <div ref={timeOffTableContainerRef} tabIndex={0} role="region" aria-label="Time off requests table" className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
            <table className="w-full text-left text-sm text-slate-200 border-collapse table-fixed min-w-[1420px]">
              <caption className="sr-only">Employee time off requests</caption>
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
                  <th scope="col" className="py-3 px-4 font-semibold">Employee</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Leave Type</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Dates & Shifts</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Comments</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Status</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Review History</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Actions</th>
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
                  const isArchived = r.isArchivedToBigQuery || r.endDate < thirtyDaysAgoStr;
                  const isAdvanceBooking = r.status === 'approved' && !isPast && r.startDate > horizonLimitDateStr;

                  const coverAssignment = getCoverForRequest(r);
                  const coverPersonnelName =
                    coverAssignment?.temporaryDriverName ||
                    coverAssignment?.temporaryAttendantName ||
                    r.coverageDriverName;
                  const hasCover = Boolean(coverAssignment || (r.coverageAssigned && coverPersonnelName));

                  const canCancel =
                    !isArchived &&
                    r.status === 'pending' &&
                    (r.requestedByUserId === currentUser?.uid || isHR);

                  return (
                    <tr
                      key={r.id}
                      className="h-[70px] hover:bg-slate-800/40 transition duration-150 group"
                    >
                      {/* Employee */}
                      <td className="py-2.5 px-4 align-middle h-[70px]">
                        {onSelectEmployee ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEmployee(r.employeeId || r.employeeNumber, r.employeeName);
                            }}
                            className="text-left group/emp focus:outline-none focus:ring-1 focus:ring-amber-400/50 rounded p-1 -m-1 transition cursor-pointer"
                            title="Click to view employee profile"
                          >
                            <div className="font-semibold text-white group-hover/emp:text-amber-300 flex items-center space-x-1.5 transition">
                              <User className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 group-hover/emp:scale-110 transition-transform" />
                              <span className="group-hover/emp:underline decoration-dotted underline-offset-2">
                                {r.employeeName}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              {r.employeeNumber && (
                                <span className="text-[11px] text-slate-400 group-hover/emp:text-slate-300 font-mono">
                                  ID: {r.employeeNumber}
                                </span>
                              )}
                              {isArchived && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                  title="Cold archive stored in BigQuery (>30 days past endDate, within 1 year)"
                                >
                                  <Database className="w-2.5 h-2.5 mr-1 text-sky-400" />
                                  BigQuery (1Y)
                                </span>
                              )}
                            </div>
                          </button>
                        ) : (
                          <>
                            <div className="font-semibold text-white flex items-center space-x-1.5">
                              <User className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                              <span>{r.employeeName}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              {r.employeeNumber && (
                                <span className="text-[11px] text-slate-400">
                                  ID: {r.employeeNumber}
                                </span>
                              )}
                              {isArchived && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                  title="Cold archive stored in BigQuery (>30 days past endDate, within 1 year)"
                                >
                                  <Database className="w-2.5 h-2.5 mr-1 text-sky-400" />
                                  BigQuery (1Y)
                                </span>
                              )}
                            </div>
                          </>
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
                            ) : hasCover || r.coverageAssigned ? (
                              <span
                                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                title={coverPersonnelName ? `Covered by ${coverPersonnelName}` : 'Replacement coverage has been assigned'}
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
                        ) : r.status === 'on_hold' ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/40"
                            title={r.holdByName ? `Placed on hold by ${r.holdByName}` : 'On hold: auto-cover & auto-approval paused'}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            On Hold
                          </span>
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
                          {/* HR Decision Action: HR can approve/reject/hold active requests */}
                          {isHR &&
                            (r.status === 'pending' ||
                              r.status === 'on_hold' ||
                              r.status === 'pre_approved' ||
                              r.status === 'seeking_coverage' ||
                              r.status === 'awaiting_peer_confirm') && (
                            <button
                              type="button"
                              aria-label={`Review time off request for ${r.employeeName}`}
                              onClick={() => handleOpenReview(r)}
                              className="min-h-[28px] px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-1 transition shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title="Review and approve/reject"
                            >
                              <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5" />
                              <span>Review</span>
                            </button>
                          )}

                          {/* Dispatcher Coverage Actions: Manual assignment or Post Route Opening */}
                          {isDispatcher && r.status === 'approved' && (
                            isPast ? (
                              <span className="text-[11px] text-slate-500 italic px-2 py-0.5 bg-slate-800/60 rounded-md border border-slate-700/40">
                                Past Absence
                              </span>
                            ) : (
                              <div className="flex items-center space-x-1.5 justify-end">
                                {hasCover ? (
                                  <div className="flex items-center space-x-1.5 bg-blue-500/10 border border-blue-500/25 px-2.5 py-1 rounded-lg text-xs">
                                    <UserCheck aria-hidden="true" className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                    <span
                                      className="font-medium text-blue-200 max-w-[130px] truncate"
                                      title={`Assigned Cover: ${coverPersonnelName}`}
                                    >
                                      {coverPersonnelName}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Remove substitute for ${r.employeeName}`}
                                      onClick={() => handleDeleteCoverage(r, coverAssignment)}
                                      disabled={deletingCoverageId === r.id}
                                      className="min-w-[24px] min-h-[24px] inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded transition ml-1 cursor-pointer disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                      title="Remove substitute driver (allows re-assigning)"
                                    >
                                      <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      aria-label={`Assign cover for ${r.employeeName}`}
                                      onClick={() => handleAssignCoverage(r)}
                                      className="min-h-[28px] px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg flex items-center space-x-1 transition shadow-sm cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                      title="Manually assign replacement driver / attendant / vehicle"
                                    >
                                      <UserCheck aria-hidden="true" className="w-3.5 h-3.5" />
                                      <span>Assign Cover</span>
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Post route opening for ${r.employeeName}`}
                                      onClick={() => handlePostRouteOpening(r)}
                                      className="min-h-[28px] px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg flex items-center space-x-1 transition shadow-sm cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                                      title="Publish Route Opening & Coverage Bulletin to Bidding Board"
                                    >
                                      <Radio aria-hidden="true" className="w-3.5 h-3.5" />
                                      <span>Post Opening</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )
                          )}

                          {/* Edit pending request */}
                          {!isArchived && r.status === 'pending' && (r.requestedByUserId === currentUser?.uid || isHR) && (
                            <button
                              type="button"
                              aria-label={`Edit time off request for ${r.employeeName}`}
                              onClick={() => handleEdit(r)}
                              className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title="Edit Request"
                            >
                              <Edit aria-hidden="true" className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cancel pending request */}
                          {canCancel && (
                            <button
                              type="button"
                              aria-label={`Cancel time off request for ${r.employeeName}`}
                              onClick={() => handleCancelRequest(r.id)}
                              className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title="Cancel Request"
                            >
                              <XCircle aria-hidden="true" className="w-4 h-4" />
                            </button>
                          )}

                          {/* Export / Print PDF Form */}
                          <button
                            type="button"
                            aria-label={`Export PDF form for ${r.employeeName}`}
                            onClick={() => handleOpenPdfExport(r)}
                            className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                            title="Export / Print Official PDF Form"
                          >
                            <Printer aria-hidden="true" className="w-4 h-4" />
                          </button>

                          {/* Delete (Admin only) */}
                          {currentUser?.role === 'admin' && (
                            <button
                              type="button"
                              aria-label={`Delete time off request for ${r.employeeName}`}
                              onClick={() => handleDelete(r.id)}
                              className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-800 rounded transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title="Delete permanently"
                            >
                              <Trash2 aria-hidden="true" className="w-4 h-4" />
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

      {/* Lower Tabbed Operations Dock: 3-Day Live Chat Workbench & Region / Yard Coverage List */}
      <TimeOffOperationsWorkbench
        employees={employees}
        canApproveTimeOff={isHR}
        onRequestsChanged={() => void loadData()}
      />
    </>
  )}

      {/* Submit / Edit Modal */}
      {isSubmitModalOpen && (
        <Suspense fallback={null}>
          <TimeOffModal
            isOpen={isSubmitModalOpen}
            onClose={() => setIsSubmitModalOpen(false)}
            request={editingRequest}
            employees={employees}
            onSaved={() => {}}
          />
        </Suspense>
      )}

      {/* HR Review Modal */}
      {isReviewModalOpen && reviewingRequest && (
        <Suspense fallback={null}>
          <TimeOffReviewModal
            isOpen={isReviewModalOpen}
            onClose={() => {
              setIsReviewModalOpen(false);
              setReviewingRequest(null);
            }}
            request={reviewingRequest}
            employees={employees}
            onDecisionCompleted={() => {}}
            onSelectEmployee={onSelectEmployee}
          />
        </Suspense>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <Suspense fallback={null}>
          <TimeOffSettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
          />
        </Suspense>
      )}

      {/* Temporary Assignment Coverage Modal */}
      {isCoverModalOpen && coverInitialAssignment && (
        <Suspense fallback={null}>
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
            onSaved={async (created?: TemporaryAssignment) => {
              if (activeTimeOffForCoverage?.id) {
                try {
                  const driverName =
                    created?.temporaryDriverName ||
                    created?.temporaryAttendantName ||
                    '';
                  const driverId =
                    created?.temporaryDriverId ||
                    created?.temporaryAttendantId ||
                    '';
                  await TimeOffService.updateTimeOffRequest(activeTimeOffForCoverage.id, {
                    coverageAssigned: true,
                    coverageAssignedAt: new Date().toISOString(),
                    coverageDriverName: driverName,
                    coverageDriverId: driverId,
                    temporaryAssignmentId: created?.id || ''
                  });
                } catch (e) {
                  console.error('Failed to mark time off as coverage assigned', e);
                }
              }
            }}
          />
        </Suspense>
      )}

      {/* Route Opening Bulletin Modal */}
      {isCreateOpeningModalOpen && (
        <Suspense fallback={null}>
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
            }}
          />
        </Suspense>
      )}

      {/* Official Time Off PDF Authorization Form Modal */}
      {isPdfModalOpen && (
        <Suspense fallback={<ExportLoadingOverlay />}>
          <TimeOffPdfModal
            isOpen={isPdfModalOpen}
            onClose={() => {
              setIsPdfModalOpen(false);
              setActiveTimeOffForPdf(null);
            }}
            request={activeTimeOffForPdf}
            allRequests={filteredRequests.length > 0 ? filteredRequests : effectiveRequests}
            employees={employees}
            routes={routes}
          />
        </Suspense>
      )}
    </PageShell>
  );
});
