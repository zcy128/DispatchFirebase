import React, { useState, useEffect, useMemo, useRef, useDeferredValue, useId } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useI18n } from '../contexts/I18nContext';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import {
  AlertTriangle,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  Wrench,
  Calendar,
  X,
  User,
  Route as RouteIcon,
  Truck,
  ShieldCheck,
  Paperclip,
  ExternalLink,
  Eye,
  ChevronLeft,
  ChevronRight,
  MapPin,
  AlertOctagon,
  Flame,
  Printer,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import {
  HazardReport,
  UpdateHazardReportOfficePayload,
  HAZARD_TYPE_DEFINITIONS,
  OFFICE_HAZARD_TYPES,
  HAZARD_STATUS_CONFIG,
} from '../types/hazardReport';
import { HazardReportService } from '../services/hazardReportService';
import { useAuth } from '../contexts/AuthContext';
import { OperationalSafetyLogService } from '../services/operationalSafetyLogService';
import { ExportLoadingOverlay } from '../components/common/ExportLoadingOverlay';

// Pure helper to calculate 365-day cutoff date string once
function getCutoffDate365Days(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  return cutoff.toISOString().slice(0, 10);
}

// Pure helper to get active hazard tags
function getHazardTags(r: HazardReport): string[] {
  const list: string[] = [];
  if (r.trippingHazard) list.push('Tripping');
  if (r.trafficHazard) list.push('Traffic');
  if (r.equipmentHazard) list.push('Equipment');
  if (r.performanceHazard) list.push('Performance');
  if (r.snowHazard) list.push('Snow / Ice / Road');
  if (r.spillHazard) list.push('Spill');
  if (r.otherHazard) list.push('Other Hazard');
  return list;
}

// Pure helper to get active close call tags
function getCloseCallTags(r: HazardReport): string[] {
  const list: string[] = [];
  if (r.unsafeAction) list.push('Unsafe Action');
  if (r.unsafeCondition) list.push('Unsafe Condition');
  if (r.happenedtoMe) list.push('To Me');
  if (r.happenedtoSomeone) list.push('To Someone');
  if (r.ofanarea) list.push('Area Issue');
  if (r.ofEquipment) list.push('Equipment Issue');
  return list;
}

const HazardReportPdfModal = React.lazy(() =>
  import('../components/hazards/HazardReportPdfModal').then((module) => ({
    default: module.HazardReportPdfModal,
  }))
);

interface HazardModalDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  maxWidthClass?: string;
  backdropClass?: string;
  children: React.ReactNode;
}

const HazardModalDialog: React.FC<HazardModalDialogProps> = ({
  open,
  onClose,
  ariaLabelledBy,
  maxWidthClass = 'max-w-4xl',
  backdropClass = 'backdrop:bg-black/60 backdrop:backdrop-blur-xs',
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

interface HazardReportsViewProps {
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
}

export const HazardReportsView: React.FC<HazardReportsViewProps> = ({
  onSelectEmployee,
}) => {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hazardTypeFilter, setHazardTypeFilter] = useState<string>('all');
  const [officeTypeFilter, setOfficeTypeFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Print & PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfTargetReport, setPdfTargetReport] = useState<HazardReport | null>(null);

  // Multi-image Lightbox state
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    currentIndex: number;
    title: string;
  } | null>(null);

  // Office Evaluation form state
  const [evalModerate, setEvalModerate] = useState<boolean>(false);
  const [evalSerious, setEvalSerious] = useState<boolean>(false);
  const [evalMinor, setEvalMinor] = useState<boolean>(false);
  const [evalProbable, setEvalProbable] = useState<boolean>(false);
  const [evalOccasional, setEvalOccasional] = useState<boolean>(false);
  const [evalRare, setEvalRare] = useState<boolean>(false);
  const [evalSuggestion, setEvalSuggestion] = useState<string>('');
  const [evalActionTaken, setEvalActionTaken] = useState<string>('');
  const [evalAssignedTo, setEvalAssignedTo] = useState<string>('');
  const [evalIsCompleted, setEvalIsCompleted] = useState<boolean>(false);
  const [evalOfficeHazardType, setEvalOfficeHazardType] = useState<string>('Hazard');
  const [evalEmployeeError, setEvalEmployeeError] = useState<string>('');
  const [evalStatusInt, setEvalStatusInt] = useState<number>(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const baseId = useId();
  const statusFilterId = `${baseId}-status-filter`;
  const officeTypeFilterId = `${baseId}-office-type-filter`;
  const hazardTypeFilterId = `${baseId}-hazard-type-filter`;
  const evalOfficeTypeId = `${baseId}-eval-office-type`;
  const evalSuggestionId = `${baseId}-eval-suggestion`;
  const evalActionTakenId = `${baseId}-eval-action-taken`;
  const evalAssignedToId = `${baseId}-eval-assigned-to`;
  const evalEmployeeErrorId = `${baseId}-eval-employee-error`;
  const evalIsCompletedId = `${baseId}-eval-is-completed`;
  const evalStatusIntId = `${baseId}-eval-status-int`;

  // Keyboard navigation for Lightbox
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

  const [timeRange, setTimeRange] = useState<'1year' | 'all'>('1year');

  // Pre-calculate 365-day cutoff date string once to avoid per-row Date allocations
  const cutoffDate365Str = useMemo(() => getCutoffDate365Days(), []);
  const isArchivedDate = (d?: string) => Boolean(d && d.slice(0, 10) < cutoffDate365Str);

  const loadReports = async (targetQuery?: string, opts?: { isCancelled?: () => boolean }) => {
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q) {
      if (!opts?.isCancelled || !opts.isCancelled()) {
        setReports([]);
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
      const data = await HazardReportService.listReports(params);
      if (opts?.isCancelled && opts.isCancelled()) return;
      setReports(data);
    } catch (err) {
      if (opts?.isCancelled && opts.isCancelled()) return;
      console.error('Failed to load hazard reports:', err);
      setReports([]);
    } finally {
      if (!opts?.isCancelled || !opts.isCancelled()) {
        setLoading(false);
      }
    }
  };

  // Subscribe to real-time updates (live data <= 1 year) or load targeted archives
  useEffect(() => {
    let isCancelled = false;
    if (timeRange === '1year') {
      setLoading(true);
      const unsubscribe = HazardReportService.subscribeHazardReports((data) => {
        if (!isCancelled) {
          setReports(data);
          setLoading(false);
        }
      });
      return () => {
        isCancelled = true;
        unsubscribe();
      };
    } else {
      if (searchQuery.trim()) {
        void loadReports(searchQuery.trim(), { isCancelled: () => isCancelled });
      } else {
        setReports([]);
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
        await loadReports(searchQuery.trim());
      } else {
        setReports([]);
      }
    } else {
      await loadReports();
    }
  };

  // KPIs - single pass loop
  const stats = useMemo(() => {
    let open = 0;
    let investigating = 0;
    let resolved = 0;
    let serious = 0;

    for (const r of reports) {
      if (r.statusInt === 0) open++;
      else if (r.statusInt === 1) investigating++;
      else if (r.statusInt === 2 || r.isCompleted) resolved++;

      if (r.serious || r.trafficHazard) serious++;
    }

    return { total: reports.length, open, investigating, resolved, serious };
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const isStatusFiltered = statusFilter !== 'all';
    const targetStatus = isStatusFiltered ? Number(statusFilter) : 0;
    const isOfficeFiltered = officeTypeFilter !== 'all';
    const targetOfficeType = isOfficeFiltered ? officeTypeFilter.toLowerCase() : '';
    const isHazardCategoryFiltered = hazardTypeFilter !== 'all';
    const targetHazardKey = isHazardCategoryFiltered ? (hazardTypeFilter as keyof HazardReport) : null;

    return reports.filter((r) => {
      // Status filter
      if (isStatusFiltered && r.statusInt !== targetStatus) {
        return false;
      }

      // Office Hazard Type filter
      if (isOfficeFiltered && (r.officeHazardType || '').toLowerCase() !== targetOfficeType) {
        return false;
      }

      // Specific Hazard Type filter
      if (targetHazardKey && !r[targetHazardKey]) {
        return false;
      }

      // Search query
      if (hasSearch) {
        const matchesReporter = (r.reportedBy || '').toLowerCase().includes(q);
        const matchesRoute = (r.routeId || r.routeName || '').toLowerCase().includes(q);
        const matchesUnit = (r.unitNumber || r.unitId || '').toLowerCase().includes(q);
        const matchesLocation = (r.eventLocation || '').toLowerCase().includes(q);
        const matchesDesc = (r.eventDescription || '').toLowerCase().includes(q);
        const matchesPerson = (r.personInvolved || '').toLowerCase().includes(q);
        const matchesAssigned = (r.assignedTo || '').toLowerCase().includes(q);

        if (
          !matchesReporter &&
          !matchesRoute &&
          !matchesUnit &&
          !matchesLocation &&
          !matchesDesc &&
          !matchesPerson &&
          !matchesAssigned
        ) {
          return false;
        }
      }
      return true;
    });
  }, [reports, statusFilter, officeTypeFilter, hazardTypeFilter, deferredSearchQuery]);

  const { isFrench } = useI18n();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredReports.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0;

  const openDetailModal = (report: HazardReport) => {
    setSelectedReport(report);
    setEvalModerate(Boolean(report.moderate));
    setEvalSerious(Boolean(report.serious));
    setEvalMinor(Boolean(report.minor));
    setEvalProbable(Boolean(report.probableRecurrence));
    setEvalOccasional(Boolean(report.occasional));
    setEvalRare(Boolean(report.rare));
    setEvalSuggestion(report.suggestion || '');
    setEvalActionTaken(report.actionTaken || '');
    setEvalAssignedTo(report.assignedTo || '');
    setEvalIsCompleted(Boolean(report.isCompleted || report.statusInt === 2));
    setEvalOfficeHazardType(report.officeHazardType || 'Hazard');
    setEvalEmployeeError(report.employeeNameError || report.employeeIdError || '');
    setEvalStatusInt(report.statusInt ?? (report.isCompleted ? 2 : 0));
    setSaveError(null);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setSaveError(null);
    setIsDetailModalOpen(false);
    setSelectedReport(null);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedReport) return;
    setSaveError(null);
    setSaving(true);
    try {
      let finalStatusInt = evalStatusInt;
      if (evalIsCompleted && finalStatusInt < 2) {
        finalStatusInt = 2;
      } else if (!evalIsCompleted && finalStatusInt === 2) {
        finalStatusInt = 1;
      }

      const payload: UpdateHazardReportOfficePayload = {
        moderate: evalModerate,
        serious: evalSerious,
        minor: evalMinor,
        probableRecurrence: evalProbable,
        occasional: evalOccasional,
        rare: evalRare,
        suggestion: evalSuggestion.trim(),
        actionTaken: evalActionTaken.trim(),
        assignedTo: evalAssignedTo.trim(),
        isCompleted: evalIsCompleted,
        officeHazardType: evalOfficeHazardType,
        employeeNameError: evalEmployeeError.trim(),
        safetySignedBy:
          currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Safety Officer',
        statusInt: finalStatusInt,
        statusStr:
          finalStatusInt === 2 ? 'Resolved' : finalStatusInt === 1 ? 'Investigating' : 'Open',
      };

      const updated = await HazardReportService.updateOfficeEvaluation(selectedReport.id, payload);

      await OperationalSafetyLogService.logOperation({
        module: 'hazard_report',
        action: finalStatusInt === 2 ? 'resolve' : 'update',
        targetId: String(selectedReport.id),
        targetIdentifier: `HAZ-${selectedReport.id}`,
        targetTitle: `Hazard Report #${selectedReport.id} (${selectedReport.officeHazardType || 'Safety'})`,
        status: finalStatusInt === 2 ? 'Resolved' : 'Investigating',
        summary: `Safety office evaluation updated by ${currentUser?.displayName || 'Safety Officer'}. Status: ${finalStatusInt === 2 ? 'Resolved' : 'Investigating'}. Assigned: ${evalAssignedTo || 'N/A'}. Action: ${evalActionTaken || 'None'}.`,
        actor: {
          userId: currentUser?.uid || 'safety-1',
          userName: currentUser?.displayName || 'Safety Officer',
          userEmail: currentUser?.email,
          userRole: currentUser?.role || 'training',
        },
        diffs: [
          {
            field: 'statusStr',
            fieldLabel: 'Status',
            oldValue: selectedReport.statusStr,
            newValue: finalStatusInt === 2 ? 'Resolved' : 'Investigating',
          },
          ...(evalActionTaken ? [{
            field: 'actionTaken',
            fieldLabel: 'Action Taken',
            oldValue: selectedReport.actionTaken || null,
            newValue: evalActionTaken,
          }] : []),
        ],
      });

      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      closeDetailModal();
    } catch (err) {
      console.error('Failed to save office evaluation:', err);
      setSaveError('Failed to save evaluation. Please check server logs.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPdf = (rep: HazardReport) => {
    setPdfTargetReport(rep);
    setIsPdfModalOpen(true);
  };

  const handleExportCsv = () => {
    if (filteredReports.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];

    const companyHeaderRows = [
      ['PCY TECH FLEET OPERATIONS - HAZARD & NEAR-MISS REPORTS'],
      [`Report Generated Date: ${todayStr}`],
      [`Total Hazard Records: ${filteredReports.length}`],
      [],
    ];

    const headers = [
      'Report ID',
      'Event Date & Time',
      'Reported By',
      'Employee ID',
      'Person Involved',
      'Bus Unit #',
      'Route Name / ID',
      'Location',
      'Witnesses',
      'Hazard Types',
      'Close Call Types',
      'Description',
      'Reporter Suggestion',
      'Risk Severity',
      'Recurrence Probability',
      'Office Classification',
      'Investigator Assigned',
      'Action Taken',
      'Status',
      'Safety Signed By',
      'Safety Signed Date'
    ];

    const rows = filteredReports.map((r) => [
      r.id,
      r.eventTime ? r.eventTime.replace('T', ' ') : r.createdAt.replace('T', ' '),
      r.reportedBy,
      r.reportedByEmployeeId || '',
      r.personInvolved || '',
      r.unitNumber || '',
      r.routeName || r.routeId || '',
      r.eventLocation || '',
      r.witnesses || '',
      getHazardTags(r).join('; '),
      getCloseCallTags(r).join('; '),
      r.eventDescription,
      r.suggestion || '',
      r.serious ? 'Serious' : r.moderate ? 'Moderate' : r.minor ? 'Minor' : 'Unspecified',
      r.probableRecurrence ? 'Probable' : r.occasional ? 'Occasional' : r.rare ? 'Rare' : 'Unspecified',
      r.officeHazardType || '',
      r.assignedTo || '',
      r.actionTaken || '',
      r.statusInt === 2 ? 'Resolved' : r.statusInt === 1 ? 'Investigating' : 'Open',
      r.safetySignedBy || '',
      r.safetySignedDate || ''
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
    link.setAttribute('download', `PCY_Tech_Hazard_Reports_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      {/* ─── Header & Actions ──────────────────────────────────────────────── */}
      <PageHeader
        title="Hazard & Near-Miss Reports"
        subtitle="Track driver & crew safety concerns, road hazards, unsafe conditions, and corrective actions"
        icon={
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredReports.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[36px] text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 rounded-xl hover:bg-slate-700 transition-colors shadow-xs cursor-pointer disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              title="Export hazards data to CSV Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[36px] text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 rounded-xl hover:bg-slate-700 transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              title="Refresh list from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        }
      />

      {/* ─── KPI Metrics Overview ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Reports</span>
            <AlertOctagon className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-400">All filed hazards</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Open / Pending</span>
            <Clock className="w-4 h-4 text-amber-500" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {stats.open}
          </div>
          <div className="mt-1 text-xs text-slate-400">Awaiting office review</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Investigating</span>
            <Wrench className="w-4 h-4 text-blue-500" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {stats.investigating}
          </div>
          <div className="mt-1 text-xs text-slate-400">Corrective action in progress</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {stats.resolved}
          </div>
          <div className="mt-1 text-xs text-slate-400">Completed & closed</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Critical / Serious</span>
            <Flame className="w-4 h-4 text-rose-500" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {stats.serious}
          </div>
          <div className="mt-1 text-xs text-slate-400">High severity potential</div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ─────────────────────────────────────────── */}
      <search
        aria-label={isFrench ? 'Filtrer et rechercher les rapports de danger' : 'Search and filter hazard reports'}
        className="block p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-3.5 shadow-xs"
      >
        <div className="flex flex-col md:flex-row gap-3">
          {/* Keyword Search */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label={
                  timeRange === 'all'
                    ? 'Search archive by location, route, unit number, or keyword'
                    : 'Search by driver, route, unit number, location, person involved, or description'
                }
                placeholder={
                  timeRange === 'all'
                    ? 'Location, route, unit #, or keyword to search archive...'
                    : 'Search driver, route, unit #, location, person involved, or description...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && timeRange === 'all') {
                    void loadReports(searchQuery.trim());
                  }
                }}
                className="w-full pl-9 pr-9 py-2 text-base sm:text-sm bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {timeRange === 'all' && (
              <button
                type="button"
                onClick={() => void loadReports(searchQuery.trim())}
                disabled={loading || !searchQuery.trim()}
                className="px-3.5 py-2 min-h-[36px] text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-200 rounded-xl transition shadow-xs whitespace-nowrap cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
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
            className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700"
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
                className={`px-2.5 py-1 min-h-[28px] text-xs font-semibold rounded-lg transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                  timeRange === rng.id
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {rng.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor={statusFilterId} className="text-xs font-semibold text-slate-200 shrink-0">
              Status:
            </label>
            <select
              id={statusFilterId}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-base sm:text-sm bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="0">Open / Pending</option>
              <option value="1">Under Investigation</option>
              <option value="2">Resolved / Completed</option>
            </select>
          </div>

          {/* Office Hazard Type Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor={officeTypeFilterId} className="text-xs font-semibold text-slate-200 shrink-0">
              Office Type:
            </label>
            <select
              id={officeTypeFilterId}
              value={officeTypeFilter}
              onChange={(e) => setOfficeTypeFilter(e.target.value)}
              className="px-3 py-2 text-base sm:text-sm bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
            >
              {OFFICE_HAZARD_TYPES.map((t) => (
                <option key={t} value={t === 'All' ? 'all' : t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Hazard Category Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor={hazardTypeFilterId} className="text-xs font-semibold text-slate-200 shrink-0">
              Hazard:
            </label>
            <select
              id={hazardTypeFilterId}
              value={hazardTypeFilter}
              onChange={(e) => setHazardTypeFilter(e.target.value)}
              className="px-3 py-2 text-base sm:text-sm bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
            >
              <option value="all">All Hazard Categories</option>
              {HAZARD_TYPE_DEFINITIONS.map((def) => (
                <option key={def.key} value={def.key}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>
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
              Live hazard reports cover the most recent 1 year. Older data is stored in BigQuery cold archives. To avoid massive database scans across 5 years, please enter a <strong>Location</strong>, <strong>Description</strong>, <strong>Vehicle Unit #</strong>, or <strong>Route #</strong> to query historical archive records.
            </p>
          </div>
        </div>
      )}

      {/* ─── Main Reports Table ───────────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xs">
        <div
          ref={tableContainerRef}
          tabIndex={0}
          role="region"
          aria-label={isFrench ? 'Tableau des rapports de danger' : 'Hazard reports table'}
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500"
        >
          <table className="w-full text-left border-collapse text-sm">
            <caption className="sr-only">
              {isFrench ? 'Liste des rapports de danger et quasi-accidents' : 'Hazard and near-miss reports'}
            </caption>
            <colgroup>
              <col style={{ width: '13%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Date / Heure Événement' : 'Event Date / Time'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Types Danger & Quasi-accident' : 'Hazard & Close Call Types'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Signalé Par / Véhicule / Trajet' : 'Reported By / Unit / Route'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Lieu & Description' : 'Location & Description'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Risque & Type Bureau' : 'Risk & Office Type'}</th>
                <th scope="col" className="px-4 py-3.5">{isFrench ? 'Statut' : 'Status'}</th>
                <th scope="col" className="px-4 py-3.5 text-right">{isFrench ? 'Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
                        {timeRange === 'all' && !searchQuery.trim() ? (
                          <Search className="w-6 h-6 text-amber-500" aria-hidden="true" />
                        ) : (
                          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                        )}
                      </div>
                      <div className="font-semibold text-slate-300">
                        {timeRange === 'all' && !searchQuery.trim()
                          ? (isFrench ? 'Rechercher dans l\'historique des dangers' : 'Search Hazard Report History')
                          : (isFrench ? 'Aucun rapport de danger trouvé' : 'No Hazard Reports Found')}
                      </div>
                      <p className="text-xs text-slate-400">
                        {timeRange === 'all' && !searchQuery.trim()
                          ? (isFrench
                              ? 'Entrez un lieu, un n° d\'unité, un n° de trajet ou un mot-clé pour interroger les archives BigQuery.'
                              : 'Enter a location, unit #, route #, or keyword above to query historical records from BigQuery archives.')
                          : searchQuery || statusFilter !== 'all' || officeTypeFilter !== 'all'
                          ? (isFrench ? 'Essayez d\'effacer les filtres actifs ou les termes de recherche.' : 'Try clearing active filters or search terms.')
                          : (isFrench ? 'Les chauffeurs et membres d\'équipe peuvent soumettre des rapports directement depuis l\'application.' : 'Drivers & crew members can submit reports directly from the Driver App.')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={7} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const report = filteredReports[virtualRow.index];
                    if (!report) return null;
                    const statusConfig = HAZARD_STATUS_CONFIG[report.statusInt] || HAZARD_STATUS_CONFIG[0];
                    const hazardTags = getHazardTags(report);
                    const closeCallTags = getCloseCallTags(report);

                    return (
                      <tr
                        key={report.id}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        {/* Event Date / Time */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="font-semibold text-white flex items-center gap-1.5 whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                            {report.eventTime
                              ? report.eventTime.replace('T', ' ').slice(0, 16)
                              : report.createdAt.slice(0, 10)}
                            {isArchivedDate(report.eventTime || report.createdAt) && (
                              <span
                                title="Record is older than 1 year and retrieved from BigQuery cold archive"
                                className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border"
                              >
                                BigQuery
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>#{report.id.slice(-6)}</span>
                            {report.attachmentUrls && report.attachmentUrls.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightbox({
                                    urls: report.attachmentUrls!,
                                    currentIndex: 0,
                                    title: `${report.reportedBy || 'Driver'} - Hazard #${report.id.slice(-6)}`,
                                  });
                                }}
                                title={`View ${report.attachmentUrls.length} photo(s) in Lightbox`}
                                aria-label={`View ${report.attachmentUrls.length} photo(s) for hazard #${report.id.slice(-6)}`}
                                className="group inline-flex items-center gap-1 px-1.5 py-0.5 min-h-[24px] rounded text-xs font-semibold border hover:ring-2 hover:ring-amber-400/30 transition-all cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                              >
                                <Paperclip className="w-3 h-3" aria-hidden="true" />
                                <span>{report.attachmentUrls.length}</span>
                                <Eye className="w-3 h-3 text-amber-500 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Hazard & Close Call Tags */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {hazardTags.length === 0 && closeCallTags.length === 0 && (
                              <span className="text-xs text-slate-400">{isFrench ? 'Danger général' : 'General Hazard'}</span>
                            )}
                            {hazardTags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                              >
                                {tag}
                              </span>
                            ))}
                            {closeCallTags.map((tag, idx) => (
                              <span
                                key={`cc-${idx}`}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Reported By / Unit / Route */}
                        <td className="px-4 py-3.5 align-top">
                          {onSelectEmployee && report.reportedBy ? (
                            <button
                              type="button"
                              onClick={() =>
                                onSelectEmployee(report.reportedByEmployeeId, report.reportedBy)
                              }
                              className="font-medium text-slate-200 flex items-center gap-1.5 hover:text-amber-600 hover:text-amber-300 hover:underline transition text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                              title={isFrench ? 'Voir la fiche employé' : 'View employee details'}
                              aria-label={isFrench ? `Voir la fiche employé de ${report.reportedBy}` : `View employee profile for ${report.reportedBy}`}
                            >
                              <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              {report.reportedBy}
                            </button>
                          ) : (
                            <div className="font-medium text-white flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              {report.reportedBy || (isFrench ? 'Personnel inconnu' : 'Unknown Staff')}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                            {report.unitNumber && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                                <Truck className="w-3 h-3" aria-hidden="true" />
                                {report.unitNumber}
                              </span>
                            )}
                            {report.routeId && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border">
                                <RouteIcon className="w-3 h-3" aria-hidden="true" />
                                {report.routeId}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Location & Description */}
                        <td className="px-4 py-3.5 align-top max-w-[300px]">
                          {report.eventLocation && (
                            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1 mb-0.5">
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0" aria-hidden="true" />
                              <span className="truncate">{report.eventLocation}</span>
                            </div>
                          )}
                          <p className="text-xs text-slate-300 line-clamp-2">
                            {report.eventDescription}
                          </p>
                        </td>

                        {/* Risk & Office Type */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="space-y-1">
                            {report.officeHazardType ? (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-200">
                                {report.officeHazardType}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">{isFrench ? 'Non classé' : 'Unclassified'}</span>
                            )}
                            <div className="flex items-center gap-1 text-[11px]">
                              {report.serious && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold border">
                                  {isFrench ? 'Grave' : 'Serious'}
                                </span>
                              )}
                              {report.moderate && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold border">
                                  {isFrench ? 'Modéré' : 'Moderate'}
                                </span>
                              )}
                              {report.minor && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold border">
                                  {isFrench ? 'Mineur' : 'Minor'}
                                </span>
                              )}
                              {report.assignedTo && (
                                <span className="text-slate-400 truncate max-w-[100px]">
                                  → {report.assignedTo}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                          >
                            {report.statusInt === 0 && <Clock className="w-3 h-3 text-amber-500" aria-hidden="true" />}
                            {report.statusInt === 1 && <Wrench className="w-3 h-3 text-blue-500" aria-hidden="true" />}
                            {report.statusInt === 2 && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                            )}
                            {statusConfig.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPdf(report);
                              }}
                              className="px-2.5 py-1.5 min-h-[32px] text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 hover:bg-slate-600 text-slate-200 transition border border-slate-700 flex items-center gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                              title={isFrench ? 'Imprimer rapport de danger / PDF' : 'Print Official Hazard Report / PDF'}
                              aria-label={isFrench ? `Imprimer ou exporter le PDF pour le rapport #${report.id.slice(-6)}` : `Print or export PDF for hazard report #${report.id.slice(-6)}`}
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                              <span>{isFrench ? 'Imprimer / PDF' : 'Print / PDF'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openDetailModal(report)}
                              className={`px-3 py-1.5 min-h-[32px] text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                                report.statusInt === 0
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                              }`}
                              aria-label={
                                report.statusInt === 0
                                  ? (isFrench ? `Évaluer et traiter le rapport #${report.id.slice(-6)}` : `Evaluate and action hazard report #${report.id.slice(-6)}`)
                                  : (isFrench ? `Voir les détails du rapport #${report.id.slice(-6)}` : `View details for hazard report #${report.id.slice(-6)}`)
                              }
                            >
                              {report.statusInt === 0
                                ? (isFrench ? 'Évaluer & Traiter' : 'Evaluate & Action')
                                : (isFrench ? 'Voir Détails' : 'View Details')}
                            </button>
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
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Detail & Office Evaluation Modal ─────────────────────────────── */}
      <HazardModalDialog
        open={Boolean(isDetailModalOpen && selectedReport)}
        onClose={closeDetailModal}
        ariaLabelledBy="hazard-detail-modal-title"
        maxWidthClass="max-w-4xl"
      >
        {selectedReport && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveEvaluation();
            }}
            className="bg-slate-800 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-scale-up"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="hazard-detail-modal-title" className="text-base font-bold text-slate-200 flex items-center gap-2">
                    Hazard Report #{selectedReport.id.slice(-6)}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                        HAZARD_STATUS_CONFIG[selectedReport.statusInt]?.bg
                      } ${HAZARD_STATUS_CONFIG[selectedReport.statusInt]?.text} ${
                        HAZARD_STATUS_CONFIG[selectedReport.statusInt]?.border
                      }`}
                    >
                      {HAZARD_STATUS_CONFIG[selectedReport.statusInt]?.label || 'Open'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Reported on {selectedReport.eventTime || selectedReport.createdAt.slice(0, 10)} by{' '}
                    {onSelectEmployee && selectedReport.reportedBy ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectEmployee(
                            selectedReport.reportedByEmployeeId,
                            selectedReport.reportedBy,
                          )
                        }
                        className="font-semibold text-slate-200 hover:text-amber-600 hover:text-amber-300 hover:underline transition rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                        title="View employee details"
                      >
                        {selectedReport.reportedBy}
                      </button>
                    ) : (
                      <span className="font-semibold text-slate-200">
                        {selectedReport.reportedBy}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPdf(selectedReport)}
                  className="px-3 py-1.5 min-h-[32px] text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  title="Print Hazard Report PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={closeDetailModal}
                  aria-label="Close dialog"
                  className="p-1.5 min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Modal Body - Two Column Grid */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ─── Column 1: Event Information & Driver Report ──────────────── */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-700 space-y-3">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Event & Route Information
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">Reported By:</span>
                        {onSelectEmployee && selectedReport.reportedBy ? (
                          <button
                            type="button"
                            onClick={() =>
                              onSelectEmployee(
                                selectedReport.reportedByEmployeeId,
                                selectedReport.reportedBy,
                              )
                            }
                            className="font-semibold text-slate-200 hover:text-amber-600 hover:text-amber-300 hover:underline transition text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                            title="View employee details"
                          >
                            {selectedReport.reportedBy}
                          </button>
                        ) : (
                          <span className="font-semibold text-slate-200">
                            {selectedReport.reportedBy}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block">Contact Phone:</span>
                        <span className="font-semibold text-slate-200">
                          {selectedReport.phone || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Route:</span>
                        <span className="font-semibold text-slate-200">
                          {selectedReport.routeId || 'N/A'}{' '}
                          {selectedReport.routeName ? `(${selectedReport.routeName})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Vehicle Unit:</span>
                        <span className="font-semibold text-slate-200">
                          {selectedReport.unitNumber || selectedReport.unitId || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Supervisor:</span>
                        <span className="font-semibold text-slate-200">
                          {selectedReport.supervisor || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Person(s) Involved:</span>
                        <span className="font-semibold text-slate-200">
                          {selectedReport.personInvolved || 'None'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 text-xs">
                      <span className="text-slate-400 block mb-0.5">Location of Event:</span>
                      <span className="font-medium text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-hidden="true" />
                        {selectedReport.eventLocation || 'Not specified'}
                      </span>
                    </div>

                    {selectedReport.witnesses && (
                      <div className="text-xs">
                        <span className="text-slate-400 block mb-0.5">Witnesses:</span>
                        <span className="font-medium text-slate-200">
                          {selectedReport.witnesses}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Hazard Categories & Close Call Badges */}
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-700 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Selected Hazard Classifications
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {getHazardTags(selectedReport).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                        >
                          <span aria-hidden="true">⚠</span> {tag}
                        </span>
                      ))}
                      {getCloseCallTags(selectedReport).map((tag, i) => (
                        <span
                          key={`cc-${i}`}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                        >
                          <span aria-hidden="true">👁</span> {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Event Description */}
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-700 space-y-1.5">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Event Description
                    </h3>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {selectedReport.eventDescription}
                    </p>
                  </div>

                  {/* Attached Photos */}
                  {selectedReport.attachmentUrls && selectedReport.attachmentUrls.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                          Attached Photos ({selectedReport.attachmentUrls.length})
                        </h3>
                        <span className="text-[11px] text-slate-400">Click to enlarge</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {selectedReport.attachmentUrls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setLightbox({
                                urls: selectedReport.attachmentUrls!,
                                currentIndex: idx,
                                title: `${selectedReport.reportedBy} - Photo #${idx + 1}`,
                              })
                            }
                            aria-label={`Enlarge photo ${idx + 1} of ${selectedReport.attachmentUrls!.length}`}
                            className="group relative aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-800 cursor-pointer shadow-xs hover:ring-2 hover:ring-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                          >
                            <img
                              src={url}
                              alt={`Hazard Attachment #${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                              <Eye className="w-3 h-3" aria-hidden="true" />
                              View
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Column 2: Evaluation of Risk Potential (Health & Safety) ─ */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-500/5 bg-amber-950/20 border border-amber-500/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Evaluation of Risk Potential
                        </h3>
                      </div>
                      <span className="text-[11px] font-medium">
                        Health & Safety Review
                      </span>
                    </div>

                    {/* Severity Potential Checkboxes */}
                    <fieldset>
                      <legend className="block text-xs font-bold text-slate-200 mb-1.5">
                        Severity Potential:
                      </legend>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalSerious}
                            onChange={(e) => setEvalSerious(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span className="font-semibold">
                            Serious
                          </span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalModerate}
                            onChange={(e) => setEvalModerate(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-semibold">
                            Moderate
                          </span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalMinor}
                            onChange={(e) => setEvalMinor(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-semibold">
                            Minor
                          </span>
                        </label>
                      </div>
                    </fieldset>

                    {/* Recurrence Potential Checkboxes */}
                    <fieldset>
                      <legend className="block text-xs font-bold text-slate-200 mb-1.5">
                        Probability of Recurrence:
                      </legend>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalProbable}
                            onChange={(e) => setEvalProbable(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Probable</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalOccasional}
                            onChange={(e) => setEvalOccasional(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Occasional</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalRare}
                            onChange={(e) => setEvalRare(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Rare</span>
                        </label>
                      </div>
                    </fieldset>

                    {/* Office Hazard Type Dropdown */}
                    <div>
                      <label htmlFor={evalOfficeTypeId} className="block text-xs font-semibold text-slate-200 mb-1">
                        Office Classification Type:
                      </label>
                      <select
                        id={evalOfficeTypeId}
                        name="officeHazardType"
                        value={evalOfficeHazardType}
                        onChange={(e) => setEvalOfficeHazardType(e.target.value)}
                        className="w-full px-3 py-2 text-base sm:text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                      >
                        {OFFICE_HAZARD_TYPES.filter((t) => t !== 'All').map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Suggested Corrective Action */}
                    <div>
                      <label htmlFor={evalSuggestionId} className="block text-xs font-semibold text-slate-200 mb-1">
                        Suggested Corrective Action:
                      </label>
                      <textarea
                        id={evalSuggestionId}
                        name="suggestion"
                        rows={2}
                        value={evalSuggestion}
                        onChange={(e) => setEvalSuggestion(e.target.value)}
                        placeholder="e.g. Notify road maintenance department of severe black ice on Route 12 corner..."
                        className="w-full px-3 py-2 text-base sm:text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500 resize-y"
                      />
                    </div>

                    {/* Corrective Action Taken */}
                    <div>
                      <label htmlFor={evalActionTakenId} className="block text-xs font-semibold text-slate-200 mb-1">
                        Corrective Action Taken:
                      </label>
                      <textarea
                        id={evalActionTakenId}
                        name="actionTaken"
                        rows={2}
                        value={evalActionTaken}
                        onChange={(e) => setEvalActionTaken(e.target.value)}
                        placeholder="e.g. City crew dispatched salt truck; alternative stop rerouted temporarily."
                        className="w-full px-3 py-2 text-base sm:text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500 resize-y"
                      />
                    </div>

                    {/* Assigned To & Employee Attribution */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={evalAssignedToId} className="block text-xs font-semibold text-slate-200 mb-1">
                          Assigned To:
                        </label>
                        <input
                          id={evalAssignedToId}
                          name="assignedTo"
                          type="text"
                          value={evalAssignedTo}
                          onChange={(e) => setEvalAssignedTo(e.target.value)}
                          placeholder="e.g. Safety Mgr John"
                          className="w-full px-3 py-2 text-base sm:text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                        />
                      </div>
                      <div>
                        <label htmlFor={evalEmployeeErrorId} className="block text-xs font-semibold text-slate-200 mb-1">
                          Employee Error (if any):
                        </label>
                        <input
                          id={evalEmployeeErrorId}
                          name="employeeNameError"
                          type="text"
                          value={evalEmployeeError}
                          onChange={(e) => setEvalEmployeeError(e.target.value)}
                          placeholder="Driver or staff name"
                          className="w-full px-3 py-2 text-base sm:text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                        />
                      </div>
                    </div>

                    {/* Status & Completion Toggle */}
                    <div className="pt-2 border-t border-amber-500/20 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label htmlFor={evalIsCompletedId} className="flex items-center gap-2 cursor-pointer">
                          <input
                            id={evalIsCompletedId}
                            name="isCompleted"
                            type="checkbox"
                            checked={evalIsCompleted}
                            onChange={(e) => {
                              setEvalIsCompleted(e.target.checked);
                              if (e.target.checked) setEvalStatusInt(2);
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                          />
                          <span className="text-xs font-bold text-white">
                            Mark Hazard Report as Resolved / Completed
                          </span>
                        </label>

                        {!evalIsCompleted && (
                          <div className="flex items-center gap-1.5">
                            <label htmlFor={evalStatusIntId} className="text-xs text-slate-400">
                              Current Phase:
                            </label>
                            <select
                              id={evalStatusIntId}
                              name="statusInt"
                              value={evalStatusInt}
                              onChange={(e) => setEvalStatusInt(Number(e.target.value))}
                              className="px-2 py-1 text-base sm:text-xs bg-slate-800 border border-slate-700 rounded-md text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                            >
                              <option value={0}>0 - Open</option>
                              <option value={1}>1 - Under Investigation</option>
                              <option value={2}>2 - Resolved</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3 bg-slate-900/60">
              {saveError && (
                <span role="alert" className="mr-auto text-xs font-semibold text-rose-500">
                  {saveError}
                </span>
              )}
              <button
                type="button"
                onClick={closeDetailModal}
                disabled={saving}
                className="px-4 py-2 min-h-[36px] text-xs font-medium text-slate-200 hover:bg-slate-700 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 min-h-[36px] text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-all shadow-sm flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                Save Evaluation & Actions
              </button>
            </div>
          </form>
        )}
      </HazardModalDialog>

      {/* ─── Multi-Photo Lightbox Modal ─────────────────────────────────────── */}
      <HazardModalDialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        ariaLabelledBy="hazard-lightbox-title"
        maxWidthClass="max-w-4xl"
        backdropClass="backdrop:bg-black/90 backdrop:backdrop-blur-md"
      >
        {lightbox && (
          <div className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center border border-slate-700">
            {/* Lightbox Header */}
            <div className="w-full flex items-center justify-between p-3.5 border-b border-slate-800 text-white bg-slate-900/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <h2 id="hazard-lightbox-title" className="text-sm font-semibold truncate">
                  {lightbox.title}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  {lightbox.currentIndex + 1} / {lightbox.urls.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.urls[lightbox.currentIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 min-h-[32px] text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Full Size
                </a>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setLightbox(null)}
                  aria-label="Close photo lightbox"
                  className="p-1.5 min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Lightbox Image Preview + Prev/Next Controls */}
            <div className="relative w-full p-4 flex items-center justify-center max-h-[75vh] min-h-[300px] overflow-hidden bg-slate-950/60">
              {lightbox.urls.length > 1 && (
                <button
                  type="button"
                  disabled={lightbox.currentIndex === 0}
                  onClick={() =>
                    setLightbox((prev) =>
                      prev && prev.currentIndex > 0
                        ? { ...prev, currentIndex: prev.currentIndex - 1 }
                        : prev
                    )
                  }
                  aria-label="Previous image"
                  className="absolute left-3 z-10 p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-sm shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                  title="Previous image (Left arrow)"
                >
                  <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                </button>
              )}

              <img
                src={lightbox.urls[lightbox.currentIndex]}
                alt={`Hazard Photo #${lightbox.currentIndex + 1}`}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl transition-all"
              />

              {lightbox.urls.length > 1 && (
                <button
                  type="button"
                  disabled={lightbox.currentIndex === lightbox.urls.length - 1}
                  onClick={() =>
                    setLightbox((prev) =>
                      prev && prev.currentIndex < prev.urls.length - 1
                        ? { ...prev, currentIndex: prev.currentIndex + 1 }
                        : prev
                    )
                  }
                  aria-label="Next image"
                  className="absolute right-3 z-10 p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-sm shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                  title="Next image (Right arrow)"
                >
                  <ChevronRight className="w-6 h-6" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Thumbnail Bottom Strip */}
            {lightbox.urls.length > 1 && (
              <div className="w-full p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-2 overflow-x-auto">
                {lightbox.urls.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`View photo ${idx + 1} of ${lightbox.urls.length}`}
                    aria-current={idx === lightbox.currentIndex ? 'true' : undefined}
                    onClick={() =>
                      setLightbox((prev) => (prev ? { ...prev, currentIndex: idx } : null))
                    }
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                      idx === lightbox.currentIndex
                        ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105'
                        : 'border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </HazardModalDialog>

      {isPdfModalOpen && (
        <React.Suspense fallback={<ExportLoadingOverlay />}>
          <HazardReportPdfModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            report={pdfTargetReport}
            allReports={filteredReports}
          />
        </React.Suspense>
      )}
    </PageShell>
  );
};


