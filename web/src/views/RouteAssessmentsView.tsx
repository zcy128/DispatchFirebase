import React, { useState, useEffect, useMemo, useRef, useDeferredValue, useId } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useI18n } from '../contexts/I18nContext';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import {
  ClipboardCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Wrench,
  CheckCircle2,
  Send,
  AlertTriangle,
  ChevronRight,
  Eye,
  Trash2,
  X,
  Save,
  Check,
  Building,
  User,
  FileText,
  Camera,
  Printer,
  Ban,
  ChevronLeft,
  ExternalLink,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import {
  RouteAssessment,
  ROUTE_ASSESSMENT_QUESTIONS,
} from '../types/routeAssessment';
import { RouteAssessmentService } from '../services/routeAssessmentService';
import { ExportLoadingOverlay } from '../components/common/ExportLoadingOverlay';

// Pure helper to calculate 365-day cutoff date string once
function getCutoffDate365Days(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  return cutoff.toISOString().slice(0, 10);
}

// Pure helper to count flagged risks for an assessment
function countFlaggedRisks(a: RouteAssessment): number {
  let count = 0;
  if (a.visibilityProblemCheck) count++;
  if (a.highwayStopConcernCheck) count++;
  if (a.locationProblemCheck) count++;
  if (a.unsafeTurnaroundCheck) count++;
  if (a.intersectionCheck) count++;
  if (a.roadwayCheck) count++;
  if (a.nonweatherRiskCheck) count++;
  if (a.weatherRiskCheck) count++;
  if (a.safetyConcernCheck) count++;
  return count;
}

const RouteAssessmentPdfModal = React.lazy(() =>
  import('../components/assessments/RouteAssessmentPdfModal').then((module) => ({
    default: module.RouteAssessmentPdfModal,
  }))
);

interface AssessmentModalDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  maxWidthClass?: string;
  backdropClass?: string;
  children: React.ReactNode;
}

const AssessmentModalDialog: React.FC<AssessmentModalDialogProps> = ({
  open,
  onClose,
  ariaLabelledBy,
  maxWidthClass = 'max-w-4xl',
  backdropClass = 'backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm',
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ariaLabelledBy}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 m-auto ${maxWidthClass} w-[calc(100%-2rem)] bg-transparent p-0 border-0 ${backdropClass} [&:modal]:overscroll-contain [&::backdrop]:overflow-hidden [&::backdrop]:overscroll-contain`}
    >
      {children}
    </dialog>
  );
};

export const RouteAssessmentsView: React.FC = () => {
  const [assessments, setAssessments] = useState<RouteAssessment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'working' | 'completed' | 'submitted'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | '0' | '1'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [timeRange, setTimeRange] = useState<'1year' | 'all'>('1year');

  // Pre-calculate 365-day cutoff date string once to avoid per-row Date allocations
  const cutoffDate365Str = useMemo(() => getCutoffDate365Days(), []);
  const isArchivedDate = (d?: string) => Boolean(d && d.slice(0, 10) < cutoffDate365Str);

  // Selected assessment for review/details modal
  const [selectedAssessment, setSelectedAssessment] = useState<RouteAssessment | null>(null);
  const [isEditingSummary, setIsEditingSummary] = useState<boolean>(false);
  const [editSummaryText, setEditSummaryText] = useState<string>('');

  // Print & PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfTargetAssessment, setPdfTargetAssessment] = useState<RouteAssessment | null>(null);

  // Office form states in the review modal (matching the reference image)
  const [officeAssignedTo, setOfficeAssignedTo] = useState<string>('');
  const [officeCompleted, setOfficeCompleted] = useState<boolean>(false);
  const [officeSubmitted, setOfficeSubmitted] = useState<boolean>(false);
  const [isSavingOffice, setIsSavingOffice] = useState<boolean>(false);
  const [officeError, setOfficeError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [deletingAssessment, setDeletingAssessment] = useState<RouteAssessment | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const baseId = useId();
  const officeAssignedToId = `${baseId}-office-assigned-to`;
  const officeCompletedId = `${baseId}-office-completed`;
  const officeSubmittedId = `${baseId}-office-submitted`;
  const editSummaryId = `${baseId}-edit-summary`;

  // Lightbox for photos
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    currentIndex: number;
    title: string;
  } | null>(null);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && lightbox.currentIndex > 0) {
        setLightbox((prev) => (prev ? { ...prev, currentIndex: prev.currentIndex - 1 } : null));
      }
      if (e.key === 'ArrowRight' && lightbox.currentIndex < lightbox.urls.length - 1) {
        setLightbox((prev) => (prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : null));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox]);

  const loadAssessments = async (targetQuery?: string, opts?: { isCancelled?: () => boolean }) => {
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q) {
      if (!opts?.isCancelled || !opts.isCancelled()) {
        setAssessments([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = { timeRange };
      if (q) {
        params.query = q;
      }
      const data = await RouteAssessmentService.listAssessments(params);
      if (opts?.isCancelled && opts.isCancelled()) return;
      setAssessments(data);
    } catch (err) {
      if (opts?.isCancelled && opts.isCancelled()) return;
      console.error('Failed to load route assessments:', err);
      setAssessments([]);
    } finally {
      if (!opts?.isCancelled || !opts.isCancelled()) {
        setLoading(false);
      }
    }
  };

  // Real-time subscription (live data <= 1 year) or load targeted archives
  useEffect(() => {
    let isCancelled = false;
    if (timeRange === '1year') {
      setLoading(true);
      const unsubscribe = RouteAssessmentService.subscribeRouteAssessments((data) => {
        if (!isCancelled) {
          setAssessments(data);
          setLoading(false);
          // Keep selected assessment up to date if open
          setSelectedAssessment((prev) => {
            if (!prev) return null;
            const found = data.find((d) => d.id === prev.id);
            return found || prev;
          });
        }
      });
      return () => {
        isCancelled = true;
        unsubscribe();
      };
    } else {
      if (searchQuery.trim()) {
        void loadAssessments(searchQuery.trim(), { isCancelled: () => isCancelled });
      } else {
        setAssessments([]);
        setLoading(false);
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [timeRange]);

  const refreshData = async () => {
    if (timeRange === 'all') {
      if (searchQuery.trim()) {
        await loadAssessments(searchQuery.trim());
      } else {
        setAssessments([]);
      }
      return;
    }
    setLoading(true);
    try {
      const data = await RouteAssessmentService.listAssessments({ timeRange: '1year' });
      setAssessments(data);
    } catch (err) {
      console.error('Failed to refresh route assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  // KPIs - single pass loop
  const stats = useMemo(() => {
    let working = 0;
    let completed = 0;
    let submitted = 0;
    let flagged = 0;

    for (const a of assessments) {
      if (a.statusInt === 0 || a.statusInt === 1) working++;
      if (a.statusInt === 2 || a.isCompleted) completed++;
      if (a.statusInt === 3 || a.isSubmitted) submitted++;

      if (
        a.visibilityProblemCheck ||
        a.highwayStopConcernCheck ||
        a.locationProblemCheck ||
        a.unsafeTurnaroundCheck ||
        a.intersectionCheck ||
        a.roadwayCheck ||
        a.nonweatherRiskCheck ||
        a.weatherRiskCheck ||
        a.safetyConcernCheck
      ) {
        flagged++;
      }
    }

    return { total: assessments.length, working, completed, submitted, flagged };
  }, [assessments]);

  // Filtered list
  const filteredAssessments = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const isStatusFiltered = statusFilter !== 'all';
    const isTypeFiltered = typeFilter !== 'all';

    return assessments.filter((item) => {
      // Status filter
      if (isStatusFiltered) {
        if (statusFilter === 'working' && item.statusInt !== 0 && item.statusInt !== 1) {
          return false;
        }
        if (statusFilter === 'completed' && item.statusInt !== 2) {
          return false;
        }
        if (statusFilter === 'submitted' && item.statusInt !== 3) {
          return false;
        }
      }

      // Assessment Type filter
      if (isTypeFiltered && item.assessmentType !== typeFilter) {
        return false;
      }

      // Search query
      if (hasSearch) {
        const matchesRoute = (item.routeId || '').toLowerCase().includes(q);
        const matchesDriver = (item.conductedByDriver || '').toLowerCase().includes(q);
        const matchesEmpId = (item.conductedByEmployeeId || '').toLowerCase().includes(q);
        const matchesSchool = (item.school || '').toLowerCase().includes(q);
        const matchesBoard = (item.schoolBoard || '').toLowerCase().includes(q);
        const matchesSummary = (item.summary || '').toLowerCase().includes(q);
        const matchesAssigned = (item.assignedTo || '').toLowerCase().includes(q);

        if (
          !matchesRoute &&
          !matchesDriver &&
          !matchesEmpId &&
          !matchesSchool &&
          !matchesBoard &&
          !matchesSummary &&
          !matchesAssigned
        ) {
          return false;
        }
      }

      return true;
    });
  }, [assessments, statusFilter, typeFilter, deferredSearchQuery]);

  const { isFrench } = useI18n();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredAssessments.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0;

  const openReviewModal = (item: RouteAssessment) => {
    setSelectedAssessment(item);
    setOfficeAssignedTo(item.assignedTo || '');
    setOfficeCompleted(item.isCompleted || item.statusInt === 2);
    setOfficeSubmitted(item.isSubmitted || item.statusInt === 3);
    setEditSummaryText(item.summary || '');
    setIsEditingSummary(false);
    setOfficeError(null);
    setSummaryError(null);
  };

  const closeReviewModal = () => {
    setSelectedAssessment(null);
    setIsEditingSummary(false);
    setOfficeError(null);
    setSummaryError(null);
  };

  // Office Section Save (matching the reference image)
  const handleSaveOffice = async () => {
    if (!selectedAssessment) return;
    setOfficeError(null);
    setIsSavingOffice(true);
    try {
      const updated = await RouteAssessmentService.updateOfficeProcessing(selectedAssessment.id, {
        assignedTo: officeAssignedTo,
        isCompleted: officeCompleted,
        isSubmitted: officeSubmitted,
      });
      setSelectedAssessment(updated);
      setAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      console.error('Failed to save office processing:', err);
      setOfficeError('Failed to save office processing. Please try again.');
    } finally {
      setIsSavingOffice(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!selectedAssessment) return;
    setSummaryError(null);
    try {
      const updated = await RouteAssessmentService.updateAssessment(selectedAssessment.id, {
        summary: editSummaryText,
      });
      setSelectedAssessment(updated);
      setIsEditingSummary(false);
      setAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      console.error('Failed to update summary:', err);
      setSummaryError('Failed to update summary.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAssessment) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await RouteAssessmentService.deleteAssessment(deletingAssessment.id);
      setAssessments((prev) => prev.filter((a) => a.id !== deletingAssessment.id));
      if (selectedAssessment?.id === deletingAssessment.id) {
        setSelectedAssessment(null);
      }
      setDeletingAssessment(null);
    } catch (err) {
      console.error('Failed to delete route assessment:', err);
      setDeleteError('Failed to delete route assessment. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenPdf = (a: RouteAssessment) => {
    setPdfTargetAssessment(a);
    setIsPdfModalOpen(true);
  };

  const handleExportCsv = () => {
    if (filteredAssessments.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];

    const companyHeaderRows = [
      ['PCY TECH FLEET OPERATIONS - ROUTE ASSESSMENTS REPORT'],
      [`Report Generated Date: ${todayStr}`],
      [`Total Assessment Records: ${filteredAssessments.length}`],
      [],
    ];

    const headers = [
      'Assessment ID',
      'Route ID',
      'Type',
      'School Board',
      'School',
      'School Year',
      'Assessment Date',
      'Driver Name',
      'Driver Employee ID',
      'Driver Email',
      'Driver Phone',
      'Summary',
      'Visibility Issues',
      'Highway Stop Issues',
      'Location Issues',
      'Turnaround Issues',
      'Intersection Issues',
      'Roadway Issues',
      'Non-Weather Risks',
      'Weather Risks',
      'Policy Review Needed',
      'Route Adjust Recommended',
      'General Safety Concern',
      'Total Flagged Risks',
      'Office Assigned To',
      'Completed',
      'Submitted',
      'Status'
    ];

    const rows = filteredAssessments.map((a) => [
      a.id,
      a.routeId,
      a.assessmentType === '1' ? 'Change in Route' : 'New Route',
      a.schoolBoard || '',
      a.school || '',
      a.schoolYear || '',
      a.assessmentDate || a.createdAt.slice(0, 10),
      a.conductedByDriver,
      a.conductedByEmployeeId || '',
      a.driverEmail || '',
      a.driverPhone || '',
      a.summary || '',
      a.visibilityProblemCheck ? `YES: ${a.visibilityProblem || ''}` : 'NO',
      a.highwayStopConcernCheck ? `YES: ${a.highwayStopConcern || ''}` : 'NO',
      a.locationProblemCheck ? `YES: ${a.locationProblem || ''}` : 'NO',
      a.unsafeTurnaroundCheck ? `YES: ${a.unsafeTurnaround || ''}` : 'NO',
      a.intersectionCheck ? `YES: ${a.intersection || ''}` : 'NO',
      a.roadwayCheck ? `YES: ${a.roadway || ''}` : 'NO',
      a.nonweatherRiskCheck ? `YES: ${a.nonweatherRisk || ''}` : 'NO',
      a.weatherRiskCheck ? `YES: ${a.weatherRisk || ''}` : 'NO',
      a.companyPolicyCheck ? 'NO' : 'YES',
      a.routeAdjustCheck ? `YES: ${a.routeAdjust || ''}` : 'NO',
      a.safetyConcernCheck ? `YES: ${a.safetyConcern || ''}` : 'NO',
      countFlaggedRisks(a),
      a.assignedTo || '',
      a.isCompleted ? 'YES' : 'NO',
      a.isSubmitted ? 'YES' : 'NO',
      a.statusStr
    ]);

    const allCsvRows = [...companyHeaderRows, headers, ...rows];
    const csvContent =
      '\uFEFF' +
      allCsvRows
        .map((row) =>
          row
            .map((val) => {
              const str = String(val ?? '');
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(',')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PCY_Tech_Route_Assessments_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      {/* Top Header */}
      <PageHeader
        title="Route Assessments"
        subtitle="School bus route safety checklists conducted by drivers & review workflow"
        icon={
          <div className="p-2 bg-emerald-950/60 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ClipboardCheck className="w-5 h-5" aria-hidden="true" />
          </div>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredAssessments.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[36px] text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors shadow-xs cursor-pointer disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              title="Export route assessments to CSV Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 min-h-[36px] text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
          <div className="text-xs font-medium text-slate-400">Total Assessments</div>
          <div className="mt-1 text-2xl font-bold text-slate-100">{stats.total}</div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
          <div className="text-xs font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Working / In Review
          </div>
          <div className="mt-1 text-2xl font-bold">{stats.working}</div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
          <div className="text-xs font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Completed
          </div>
          <div className="mt-1 text-2xl font-bold">{stats.completed}</div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
          <div className="text-xs font-medium flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" aria-hidden="true" /> Submitted
          </div>
          <div className="mt-1 text-2xl font-bold">{stats.submitted}</div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Identified Risks
          </div>
          <div className="mt-1 text-2xl font-bold">{stats.flagged}</div>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <search
        aria-label={isFrench ? 'Filtrer et rechercher les évaluations' : 'Search and filter route assessments'}
        className="block bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm space-y-3"
      >
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label={
                  timeRange === 'all'
                    ? 'Search archive by route number, driver, school, or keyword'
                    : 'Search by route, driver, employee ID, school, or summary'
                }
                placeholder={
                  timeRange === 'all'
                    ? 'Route #, driver, school, or keyword to search archive...'
                    : 'Search route, driver, employee ID, school, summary...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && timeRange === 'all') {
                    void loadAssessments(searchQuery.trim());
                  }
                }}
                className="w-full pl-9 pr-9 py-2 bg-slate-800 border border-slate-700 rounded-lg text-base sm:text-sm text-slate-200 placeholder-slate-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {timeRange === 'all' && (
              <button
                type="button"
                onClick={() => void loadAssessments(searchQuery.trim())}
                disabled={loading || !searchQuery.trim()}
                className="px-3.5 py-2 min-h-[36px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition shadow-xs whitespace-nowrap cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                Search Archive
              </button>
            )}
          </div>

          {/* Time Range Selector */}
          <div
            role="group"
            aria-label="Time range"
            className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700"
          >
            <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
              Range:
            </span>
            {[
              { id: '1year', label: '1 Year (Live)' },
              { id: 'all', label: 'All History' },
            ].map((rng) => (
              <button
                key={rng.id}
                type="button"
                aria-pressed={timeRange === rng.id}
                onClick={() => setTimeRange(rng.id as '1year' | 'all')}
                className={`px-2.5 py-1 min-h-[28px] text-xs font-semibold rounded-md transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                  timeRange === rng.id
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {rng.label}
              </button>
            ))}
          </div>

          {/* Assessment Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | '0' | '1')}
              aria-label="Filter by checklist type"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-base sm:text-sm text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-emerald-500"
            >
              <option value="all">All Checklist Types</option>
              <option value="0">New Route (Dry Run)</option>
              <option value="1">Change in Route</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div
          role="group"
          aria-label="Filter by status"
          className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-700"
        >
          <span className="text-xs font-semibold text-slate-400 mr-2">Status:</span>
          {(['all', 'working', 'completed', 'submitted'] as const).map((st) => {
            const active = statusFilter === st;
            const labels = {
              all: `All (${assessments.length})`,
              working: `Working (${stats.working})`,
              completed: `Completed (${stats.completed})`,
              submitted: `Submitted (${stats.submitted})`,
            };
            return (
              <button
                key={st}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 min-h-[32px] rounded-lg text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>
      </search>

      {/* 5-Year Safe Scan Notice Banner */}
      {timeRange === 'all' && (
        <div role="status" className="p-3.5 border rounded-xl flex items-start gap-3 text-xs">
          <Info className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <span>All History Mode (BigQuery Cold Archive)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium">5-Year Safe Scan</span>
            </div>
            <p className="">
              Live route assessments cover the most recent 1 year. Older data is stored in BigQuery cold archives. To avoid massive database scans across 5 years, please enter a <strong>Route #</strong>, <strong>Driver</strong>, <strong>Employee ID</strong>, or <strong>School</strong> to query historical archive records.
            </p>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm overflow-hidden">
        <div
          ref={tableContainerRef}
          tabIndex={0}
          role="region"
          aria-label={isFrench ? 'Tableau des évaluations de trajet' : 'Route assessments table'}
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-500"
        >
          <table className="w-full text-left text-sm text-slate-300">
            <caption className="sr-only">
              {isFrench ? 'Liste des évaluations de sécurité des trajets' : 'Route safety assessments'}
            </caption>
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Type' : 'Type'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Trajet' : 'Route'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Date / Créé' : 'Date / Created'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'École & Conseil' : 'School & Board'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Mené Par' : 'Conducted By'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Résumé des Constats' : 'Findings Summary'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Préoccupations' : 'Safety Concerns'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Assigné À' : 'Assigned To'}</th>
                <th scope="col" className="px-4 py-3.5 text-center">{isFrench ? 'Statut' : 'Status'}</th>
                <th scope="col" className="px-4 py-3.5 text-right">{isFrench ? 'Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading && assessments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    <div role="status">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" aria-hidden="true" />
                      {isFrench ? 'Chargement des évaluations de trajet...' : 'Loading route assessments...'}
                    </div>
                  </td>
                </tr>
              ) : filteredAssessments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    {timeRange === 'all' && !searchQuery.trim() ? (
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-300">
                          {isFrench ? 'Rechercher dans les archives de 5 ans' : 'Enter Route #, Driver, or Keyword to Search 5-Year Archive'}
                        </div>
                        <div className="text-xs text-slate-400 max-w-md mx-auto">
                          {isFrench
                            ? 'Les évaluations récentes couvrent la dernière année. Saisissez une requête ci-dessus pour inspecter les archives historiques.'
                            : 'Live route assessments cover the most recent 1 year. Type a query above and click "Search Archive" to inspect historical records.'}
                        </div>
                      </div>
                    ) : (
                      <>{isFrench ? 'Aucune évaluation de trajet ne correspond à vos filtres.' : 'No route assessments found matching your filters.'}</>
                    )}
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={10} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const item = filteredAssessments[virtualRow.index];
                    if (!item) return null;
                    const riskCount = countFlaggedRisks(item);
                    return (
                    <tr
                      key={item.id}
                      onClick={() => openReviewModal(item)}
                      className="hover:bg-slate-750 cursor-pointer transition-colors"
                    >
                      {/* Type */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.assessmentType === '0'
                              ? 'bg-blue-500/15  text-blue-300 border '
                              : 'bg-purple-500/15  text-purple-300 border '
                          }`}
                        >
                          {item.assessmentType === '0' ? 'New Route' : 'Change in Route'}
                        </span>
                      </td>

                      {/* Route */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-100">
                        {item.routeId || 'N/A'}
                      </td>

                      {/* Date / Created */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <div className="font-medium text-slate-100 flex items-center gap-1.5">
                          <span>
                            {item.assessmentDate
                              ? new Date(item.assessmentDate).toLocaleDateString()
                              : new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          {isArchivedDate(item.assessmentDate || item.createdAt) && (
                            <span
                              title="Record is older than 1 year and retrieved from BigQuery cold archive"
                              className="px-1.5 py-0.2 rounded text-[10px] font-semibold border"
                            >
                              BigQuery
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400">
                          {item.schoolYear || '2026-2027'}
                        </div>
                      </td>

                      {/* School & Board */}
                      <td className="px-4 py-3.5 max-w-[180px] truncate">
                        <div className="font-medium text-slate-100 truncate">
                          {item.school || 'Unspecified'}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {item.schoolBoard || 'School Board'}
                        </div>
                      </td>

                      {/* Conducted By */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-slate-100">
                          {item.conductedByDriver}
                        </div>
                        <div className="text-xs text-slate-400">
                          {item.conductedByEmployeeId || item.driverEmail || ''}
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="px-4 py-3.5 max-w-xs truncate text-xs text-slate-400">
                        {item.summary || <span className="italic text-slate-400">No summary entered</span>}
                      </td>

                      {/* Safety Concerns */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {riskCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border">
                            <AlertTriangle className="w-3 h-3 text-rose-500" aria-hidden="true" />
                            {riskCount} Concern{riskCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border">
                            <Check className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                            Clear
                          </span>
                        )}
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-slate-300">
                        {item.assignedTo || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>

                      {/* Status Icon */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {item.statusInt === 3 ? (
                          <div className="inline-flex items-center gap-1 font-medium text-xs">
                            <Send className="w-4 h-4" aria-hidden="true" /> Submitted
                          </div>
                        ) : item.statusInt === 2 ? (
                          <div className="inline-flex items-center gap-1 font-medium text-xs">
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Completed
                          </div>
                        ) : item.statusInt === 1 ? (
                          <div className="inline-flex items-center gap-1 font-medium text-xs">
                            <Wrench className="w-4 h-4" aria-hidden="true" /> In Review
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 font-medium text-xs">
                            <Clock className="w-4 h-4" aria-hidden="true" /> Working
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPdf(item);
                            }}
                            className="p-1.5 min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-slate-500 hover:text-teal-400 hover:bg-slate-700 rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                            title="Print Official Route Assessment / PDF"
                            aria-label={`Print PDF for route assessment ${item.routeId || item.id}`}
                          >
                            <Printer className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReviewModal(item);
                            }}
                            className="p-1.5 min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-slate-700 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                            title="Review Route Assessment"
                            aria-label={`Review route assessment ${item.routeId || item.id} by ${item.conductedByDriver}`}
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteError(null);
                              setDeletingAssessment(item);
                            }}
                            className="p-1.5 min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-slate-700 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                            title="Delete"
                            aria-label={`Delete route assessment ${item.routeId || item.id} by ${item.conductedByDriver}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={10} />
                  </tr>
                )}
              </>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Office Processing Modal */}
      <AssessmentModalDialog
        open={Boolean(selectedAssessment)}
        onClose={closeReviewModal}
        ariaLabelledBy="assessment-detail-modal-title"
        maxWidthClass="max-w-4xl"
      >
        {selectedAssessment && (
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedAssessment.assessmentType === '0'
                        ? 'bg-blue-500/15  text-blue-300'
                        : 'bg-purple-500/15  text-purple-300'
                    }`}
                  >
                    {selectedAssessment.assessmentType === '0' ? 'New Route (Dry Run)' : 'Change in Route'}
                  </span>
                  <h2 id="assessment-detail-modal-title" className="text-lg font-bold text-slate-200">
                    Route Assessment: {selectedAssessment.routeId || 'N/A'}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conducted by {selectedAssessment.conductedByDriver} on{' '}
                  {selectedAssessment.assessmentDate
                    ? new Date(selectedAssessment.assessmentDate).toLocaleDateString()
                    : new Date(selectedAssessment.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPdf(selectedAssessment)}
                  className="px-3 py-1.5 min-h-[32px] text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                  title="Print Route Assessment PDF"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={closeReviewModal}
                  aria-label="Close dialog"
                  className="p-2 min-w-[32px] min-h-[32px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 hover:text-slate-200 rounded-lg hover:bg-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* ───────────────────────────────────────────────────────────── */}
              {/* 1. OFFICE PROCESSING SECTION (STRICTLY MATCHING USER'S IMAGE) */}
              {/* ───────────────────────────────────────────────────────────── */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSaveOffice();
                }}
                className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4"
              >
                {/* Header with green underline matching Razor & user image */}
                <div className="text-base font-bold text-slate-100 pb-2 border-b-2 border-emerald-500 flex items-center justify-between">
                  <span>Office</span>
                  <span className="text-xs font-normal text-slate-500">
                    Current Status:{' '}
                    <strong className="text-slate-200">
                      {selectedAssessment.statusStr}
                    </strong>
                  </span>
                </div>

                {/* Form fields: Assigned To, Completed checkbox, Submitted checkbox */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <label
                    htmlFor={officeAssignedToId}
                    className="sm:col-span-2 text-sm font-medium text-slate-200"
                  >
                    Assigned To
                  </label>
                  <div className="sm:col-span-4">
                    <input
                      id={officeAssignedToId}
                      name="assignedTo"
                      type="text"
                      placeholder="e.g. Safety Officer / Dispatcher"
                      value={officeAssignedTo}
                      onChange={(e) => setOfficeAssignedTo(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-base sm:text-sm text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-emerald-500 shadow-sm"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={officeCompletedId}
                      name="isCompleted"
                      checked={officeCompleted}
                      onChange={(e) => setOfficeCompleted(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <label
                      htmlFor={officeCompletedId}
                      className="text-sm font-medium text-slate-300 cursor-pointer"
                    >
                      Completed
                    </label>
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={officeSubmittedId}
                      name="isSubmitted"
                      checked={officeSubmitted}
                      onChange={(e) => setOfficeSubmitted(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <label
                      htmlFor={officeSubmittedId}
                      className="text-sm font-medium text-slate-300 cursor-pointer"
                    >
                      Submitted
                    </label>
                  </div>
                </div>

                {officeError && (
                  <div role="alert" className="text-xs font-semibold text-rose-500">
                    {officeError}
                  </div>
                )}

                {/* Action Buttons: Save & Cancel */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSavingOffice}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[36px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                  >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    {isSavingOffice ? 'Saving...' : 'Save'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOfficeError(null);
                      setOfficeAssignedTo(selectedAssessment.assignedTo || '');
                      setOfficeCompleted(selectedAssessment.isCompleted);
                      setOfficeSubmitted(selectedAssessment.isSubmitted);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[36px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium text-slate-200 transition-colors shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                  >
                    <Ban className="w-4 h-4" aria-hidden="true" />
                    Cancel
                  </button>
                </div>
              </form>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 2. DRIVER & ROUTE METADATA SECTION                             */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Driver Info */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700 space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-500" /> Driver Details
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-semibold text-slate-100">
                        {selectedAssessment.conductedByDriver}
                      </span>
                    </div>
                    {selectedAssessment.conductedByEmployeeId && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Employee ID:</span>
                        <span className="font-mono text-slate-200">
                          {selectedAssessment.conductedByEmployeeId}
                        </span>
                      </div>
                    )}
                    {selectedAssessment.driverPhone && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Phone:</span>
                        <span className="text-slate-200">
                          {selectedAssessment.driverPhone}
                        </span>
                      </div>
                    )}
                    {selectedAssessment.driverEmail && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-200">
                          {selectedAssessment.driverEmail}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Route & School Info */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700 space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-emerald-500" /> Route & School
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Route ID:</span>
                      <span className="font-semibold text-slate-100">
                        {selectedAssessment.routeId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">School:</span>
                      <span className="text-slate-200">
                        {selectedAssessment.school || 'Unspecified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">School Board:</span>
                      <span className="text-slate-200">
                        {selectedAssessment.schoolBoard || 'Unspecified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">School Year:</span>
                      <span className="text-slate-200">
                        {selectedAssessment.schoolYear || '2026-2027'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 3. FINDINGS SUMMARY                                            */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={editSummaryId}
                    className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4 text-emerald-500" aria-hidden="true" /> Summarize Findings
                  </label>
                  {!isEditingSummary && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSummary(true)}
                      className="text-xs text-emerald-600 hover:text-emerald-300 font-medium rounded px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                    >
                      Edit Summary
                    </button>
                  )}
                </div>

                {isEditingSummary ? (
                  <div className="space-y-2">
                    <textarea
                      id={editSummaryId}
                      rows={3}
                      value={editSummaryText}
                      onChange={(e) => setEditSummaryText(e.target.value)}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-base sm:text-sm text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-emerald-500 resize-y"
                    />
                    {summaryError && (
                      <div role="alert" className="text-xs font-semibold text-rose-500">
                        {summaryError}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveSummary}
                        className="px-3 py-1.5 min-h-[32px] bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                      >
                        Save Summary
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSummaryError(null);
                          setIsEditingSummary(false);
                        }}
                        className="px-3 py-1.5 min-h-[32px] bg-slate-800 text-slate-200 rounded text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">
                    {selectedAssessment.summary || (
                      <span className="italic text-slate-400">No general summary recorded.</span>
                    )}
                  </p>
                )}
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 4. ATTACHED PHOTOS GALLERY                                     */}
              {/* ───────────────────────────────────────────────────────────── */}
              {selectedAssessment.attachmentUrls && selectedAssessment.attachmentUrls.length > 0 && (
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-500" aria-hidden="true" /> Attached Incident / Route Photos (
                    {selectedAssessment.attachmentUrls.length})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {selectedAssessment.attachmentUrls.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setLightbox({
                            urls: selectedAssessment.attachmentUrls || [],
                            currentIndex: idx,
                            title: `Route Photo ${idx + 1} of ${selectedAssessment.attachmentUrls?.length}`,
                          })
                        }
                        aria-label={`View route photo ${idx + 1} of ${selectedAssessment.attachmentUrls?.length}`}
                        className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700 cursor-pointer bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                      >
                        <img
                          src={url}
                          alt={`Attachment ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white drop-shadow" aria-hidden="true" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 5. 11 SAFETY CHECKLIST QUESTIONS                              */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="text-base font-bold text-slate-100 pb-2 border-b-2 border-emerald-500 flex items-center justify-between">
                  <span>Safety Assessment Checklist (9 Questions)</span>
                  <span className="text-xs font-normal text-slate-500">
                    {countFlaggedRisks(selectedAssessment)} Risk(s) Identified
                  </span>
                </div>

                <div className="space-y-3">
                  {ROUTE_ASSESSMENT_QUESTIONS.map((q) => {
                    const isChecked = Boolean((selectedAssessment as any)[q.checkKey]);
                    const textVal = (selectedAssessment as any)[q.textKey] as string | undefined;

                    return (
                      <div
                        key={q.id}
                        className={`p-3.5 rounded-xl border transition-colors ${
                          isChecked
                            ? ' '
                            : 'bg-slate-900/30 border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 p-1 rounded-md ${
                              isChecked
                                ? 'bg-rose-500/15  text-rose-300'
                                : 'bg-slate-800 text-slate-400 '
                            }`}
                          >
                            {isChecked ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </div>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-100">
                                {q.title}
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  isChecked
                                    ? 'bg-rose-500/15  text-rose-300'
                                    : 'bg-slate-800  text-slate-400'
                                }`}
                              >
                                {isChecked ? 'Concern Flagged (YES)' : 'No Issues (NO)'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400">
                              {q.question}
                            </p>

                            {isChecked && textVal && (
                              <div className="mt-2 p-2.5 bg-slate-800 rounded-lg border border-rose-900/60 text-xs text-slate-200 font-medium">
                                <span className="font-bold block mb-0.5">
                                  Driver Comment & Location Risk:
                                </span>
                                {textVal}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-900 border-t border-slate-700 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Assessment ID: <code className="font-mono">{selectedAssessment.id}</code>
              </span>
              <button
                type="button"
                onClick={closeReviewModal}
                className="px-4 py-2 min-h-[36px] bg-slate-800 text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-300 hover:bg-slate-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </AssessmentModalDialog>

      {/* Delete Assessment Confirmation Dialog */}
      <AssessmentModalDialog
        open={Boolean(deletingAssessment)}
        onClose={() => {
          setDeleteError(null);
          setDeletingAssessment(null);
        }}
        ariaLabelledBy="delete-assessment-modal-title"
        maxWidthClass="max-w-md"
      >
        {deletingAssessment && (
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-5 w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="delete-assessment-modal-title" className="text-sm font-bold text-slate-200">
                  Delete Route Assessment?
                </h2>
                <p className="text-xs text-slate-200 mt-1">
                  Are you sure you want to delete the route assessment for{' '}
                  <strong className="text-slate-200">{deletingAssessment.routeId || deletingAssessment.id}</strong>{' '}
                  conducted by <strong className="text-slate-200">{deletingAssessment.conductedByDriver}</strong>?
                </p>
              </div>
            </div>

            {deleteError && (
              <div role="alert" className="p-2.5 rounded-lg border text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setDeleteError(null);
                  setDeletingAssessment(null);
                }}
                disabled={isDeleting}
                className="px-3.5 py-1.5 min-h-[32px] text-xs font-semibold text-slate-200 hover:bg-slate-700 rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
                className="px-4 py-1.5 min-h-[32px] text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Assessment'}</span>
              </button>
            </div>
          </div>
        )}
      </AssessmentModalDialog>

      {/* Lightbox for Photos */}
      <AssessmentModalDialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        ariaLabelledBy="assessment-lightbox-title"
        maxWidthClass="max-w-4xl"
        backdropClass="backdrop:bg-black/90"
      >
        {lightbox && (
          <div className="flex flex-col items-center w-full">
            {/* Lightbox Header */}
            <div className="w-full max-w-4xl flex items-center justify-between text-white pb-3 mb-2 border-b border-white/10">
              <div>
                <h2 id="assessment-lightbox-title" className="font-semibold text-sm">{lightbox.title}</h2>
                <p className="text-xs text-slate-400">
                  Photo {lightbox.currentIndex + 1} of {lightbox.urls.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.urls[lightbox.currentIndex]}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 min-h-[32px] text-xs bg-white/10 hover:bg-white/20 text-white rounded flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Full Size
                </a>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setLightbox(null)}
                  aria-label="Close photo lightbox"
                  className="p-1.5 min-w-[32px] min-h-[32px] inline-flex items-center justify-center text-white/80 hover:text-white rounded hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Lightbox Main Image */}
            <div className="relative max-w-4xl max-h-[75vh] flex items-center justify-center">
              {lightbox.urls.length > 1 && (
                <button
                  type="button"
                  disabled={lightbox.currentIndex === 0}
                  aria-label="Previous image"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev && prev.currentIndex > 0
                        ? { ...prev, currentIndex: prev.currentIndex - 1 }
                        : prev
                    )
                  }
                  className="absolute left-2 p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                </button>
              )}

              <img
                src={lightbox.urls[lightbox.currentIndex]}
                alt="Full resolution"
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />

              {lightbox.urls.length > 1 && (
                <button
                  type="button"
                  disabled={lightbox.currentIndex === lightbox.urls.length - 1}
                  aria-label="Next image"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev && prev.currentIndex < prev.urls.length - 1
                        ? { ...prev, currentIndex: prev.currentIndex + 1 }
                        : prev
                    )
                  }
                  className="absolute right-2 p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <ChevronRight className="w-6 h-6" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Lightbox Thumbnail Strip */}
            {lightbox.urls.length > 1 && (
              <div className="flex items-center gap-2 mt-4 overflow-x-auto max-w-xl py-2 px-3 bg-black/40 rounded-xl">
                {lightbox.urls.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`View photo ${i + 1} of ${lightbox.urls.length}`}
                    aria-current={lightbox.currentIndex === i ? 'true' : undefined}
                    onClick={() => setLightbox((prev) => (prev ? { ...prev, currentIndex: i } : null))}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                      lightbox.currentIndex === i
                        ? 'border-emerald-500 scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </AssessmentModalDialog>

      {isPdfModalOpen && (
        <React.Suspense fallback={<ExportLoadingOverlay />}>
          <RouteAssessmentPdfModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            assessment={pdfTargetAssessment}
            allAssessments={filteredAssessments}
          />
        </React.Suspense>
      )}
    </PageShell>
  );
};


