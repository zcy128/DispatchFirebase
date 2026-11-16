import React, { useState, useEffect, useMemo, useRef, useDeferredValue, useId } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useI18n } from '../contexts/I18nContext';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  CheckCircle2,
  Calendar,
  X,
  AlertTriangle,
  Lock,
  PhoneCall,
  School,
  Clock,
  HeartPulse,
  UserX,
  Printer,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import {
  StudentIncident,
  StudentIncidentStatus,
  UpdateIncidentOfficeFollowUpPayload,
  STUDENT_INCIDENT_STATUS_LABELS,
  STUDENT_INCIDENT_STATUS_COLORS,
  STUDENT_INCIDENT_CATEGORY_LABELS,
  DISCIPLINARY_ACTION_LABELS,
} from '../types/studentIncident';
import { StudentIncidentService } from '../services/studentIncidentService';
import { useAuth } from '../contexts/AuthContext';
import { ExportLoadingOverlay } from '../components/common/ExportLoadingOverlay';

// Helper to calculate 180-day cutoff date string once
function getCutoffDate180Days(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  return cutoff.toISOString().slice(0, 10);
}

const StudentIncidentPdfModal = React.lazy(() =>
  import('../components/incidents/StudentIncidentPdfModal').then((module) => ({
    default: module.StudentIncidentPdfModal,
  }))
);

interface IncidentModalDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  children: React.ReactNode;
}

const IncidentModalDialog: React.FC<IncidentModalDialogProps> = ({
  open,
  onClose,
  ariaLabelledBy,
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
      className="fixed inset-0 z-50 m-auto max-w-2xl w-[calc(100%-2rem)] bg-transparent p-0 border-0 backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs [&:modal]:overscroll-contain [&::backdrop]:overflow-hidden [&::backdrop]:overscroll-contain"
    >
      {children}
    </dialog>
  );
};

interface StudentIncidentsViewProps {
  onSelectStudent?: (ref: { id?: string; name?: string }) => void;
  onSelectSchool?: (schoolId?: number, schoolName?: string) => void;
}

export const StudentIncidentsView: React.FC<StudentIncidentsViewProps> = ({
  onSelectStudent,
  onSelectSchool,
}) => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();
  const baseId = useId();
  const statusSelectId = `${baseId}-status`;
  const reviewedDateId = `${baseId}-reviewed-date`;
  const adminNameId = `${baseId}-admin-name`;
  const otherDisciplineId = `${baseId}-other-discipline`;
  const officeNotesId = `${baseId}-office-notes`;
  const lockRecordId = `${baseId}-lock-record`;
  const reviewErrorId = `${baseId}-review-error`;
  const [incidents, setIncidents] = useState<StudentIncident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [needsFollowUpOnly, setNeedsFollowUpOnly] = useState<boolean>(false);
  const [selectedIncident, setSelectedIncident] = useState<StudentIncident | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Print & PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfTargetIncident, setPdfTargetIncident] = useState<StudentIncident | null>(null);

  // Office Follow-up Form State
  const [reviewStatus, setReviewStatus] = useState<StudentIncidentStatus>('under_investigation');
  const [administratorName, setAdministratorName] = useState<string>('');
  const [reviewedDate, setReviewedDate] = useState<string>('');
  const [disciplinaryActions, setDisciplinaryActions] = useState<string[]>([]);
  const [disciplinaryOther, setDisciplinaryOther] = useState<string>('');
  const [officeNotes, setOfficeNotes] = useState<string>('');
  const [isOfficeLocked, setIsOfficeLocked] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState<'6months' | '1year' | 'all'>('6months');

  // Pre-calculate 180-day cutoff date string once to avoid per-row Date allocations
  const cutoffDate180Str = useMemo(() => getCutoffDate180Days(), []);
  const isArchivedDate = (d?: string) => Boolean(d && d < cutoffDate180Str);

  const loadIncidents = async (targetQuery?: string, opts?: { isCancelled?: () => boolean }) => {
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q) {
      if (!opts?.isCancelled || !opts.isCancelled()) {
        setIncidents([]);
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
      const data = await StudentIncidentService.listIncidents(params);
      if (opts?.isCancelled && opts.isCancelled()) return;
      setIncidents(data);
    } catch (err) {
      if (opts?.isCancelled && opts.isCancelled()) return;
      console.error('Failed to load student incidents:', err);
      setIncidents([]);
    } finally {
      if (!opts?.isCancelled || !opts.isCancelled()) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isCancelled = false;
    if (timeRange === '6months') {
      setLoading(true);
      const unsubscribe = StudentIncidentService.subscribeToIncidents((data) => {
        if (!isCancelled) {
          setIncidents(data);
          setLoading(false);
        }
      });
      return () => {
        isCancelled = true;
        unsubscribe();
      };
    } else if (timeRange === '1year') {
      void loadIncidents(undefined, { isCancelled: () => isCancelled });
    } else {
      if (searchQuery.trim()) {
        void loadIncidents(searchQuery.trim(), { isCancelled: () => isCancelled });
      } else {
        setIncidents([]);
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
        await loadIncidents(searchQuery.trim());
      } else {
        setIncidents([]);
      }
    } else {
      await loadIncidents();
    }
  };

  // KPIs - single pass loop
  const stats = useMemo(() => {
    let pendingReview = 0;
    let underInvestigation = 0;
    let parentContacted = 0;
    let closed = 0;

    for (const r of incidents) {
      if (r.status === 'closed') {
        closed++;
      } else {
        if (!r.officeFollowUp || !r.officeFollowUp.isOfficeLocked) {
          pendingReview++;
        }
      }

      if (r.status === 'under_investigation') {
        underInvestigation++;
      } else if (r.status === 'parent_contacted' || r.status === 'school_notified') {
        parentContacted++;
      }
    }

    return {
      total: incidents.length,
      pendingReview,
      underInvestigation,
      parentContacted,
      closed,
    };
  }, [incidents]);

  // Filtered reports
  const filteredIncidents = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const isStatusFiltered = statusFilter !== 'all';

    return incidents.filter((r) => {
      // Needs Follow-up toggle
      if (needsFollowUpOnly) {
        if (r.status === 'closed') return false;
        if (r.officeFollowUp?.isOfficeLocked) return false;
      }

      // Status filter
      if (isStatusFiltered && r.status !== statusFilter) {
        return false;
      }

      // Free text search
      if (hasSearch) {
        const matchesStudent = (r.studentName || '').toLowerCase().includes(q);
        const matchesStudentNo = (r.studentNo || '').toLowerCase().includes(q);
        const matchesSchool = (r.schoolName || '').toLowerCase().includes(q);
        const matchesRoute = (r.routeNo || '').toLowerCase().includes(q);
        const matchesDriver = (r.driverName || '').toLowerCase().includes(q);
        const matchesDesc = (r.description || '').toLowerCase().includes(q);
        const matchesLocation = (r.location || '').toLowerCase().includes(q);
        if (
          !matchesStudent &&
          !matchesStudentNo &&
          !matchesSchool &&
          !matchesRoute &&
          !matchesDriver &&
          !matchesDesc &&
          !matchesLocation
        ) {
          return false;
        }
      }

      return true;
    });
  }, [incidents, needsFollowUpOnly, statusFilter, deferredSearchQuery]);

  // Virtual scrolling for 1,000+ student incident records
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredIncidents.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  const handleOpenReview = (incident: StudentIncident) => {
    setSelectedIncident(incident);
    setReviewStatus(incident.status);
    const fu = incident.officeFollowUp;
    setAdministratorName(
      fu?.administratorName || currentUser?.displayName || currentUser?.email || 'Operations Admin'
    );
    setReviewedDate(fu?.reviewedDate || new Date().toISOString().split('T')[0]);
    setDisciplinaryActions(fu?.disciplinaryActions || []);
    setDisciplinaryOther(fu?.disciplinaryOther || '');
    setOfficeNotes(fu?.officeNotes || '');
    setIsOfficeLocked(fu?.isOfficeLocked || false);
    setReviewError(null);
    setIsReviewModalOpen(true);
  };

  const handleToggleDiscipline = (key: string) => {
    setDisciplinaryActions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSaveReview = async () => {
    if (!selectedIncident) return;
    if (!administratorName.trim()) {
      setReviewError('Administrator name is required.');
      return;
    }
    if (!reviewedDate) {
      setReviewError('Review date is required.');
      return;
    }
    setReviewError(null);
    setSaving(true);
    try {
      const payload: UpdateIncidentOfficeFollowUpPayload = {
        status: reviewStatus,
        administratorName,
        reviewedDate,
        disciplinaryActions,
        disciplinaryOther,
        officeNotes,
        isOfficeLocked,
      };

      const updated = await StudentIncidentService.updateOfficeFollowUp(
        selectedIncident.id,
        payload
      );
      setIncidents((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setIsReviewModalOpen(false);
      setSelectedIncident(null);
    } catch (err) {
      console.error('Failed to save office review:', err);
      setReviewError('Error saving office follow-up review. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPdf = (inc: StudentIncident) => {
    setPdfTargetIncident(inc);
    setIsPdfModalOpen(true);
  };

  const handleExportCsv = () => {
    if (filteredIncidents.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];

    const companyHeaderRows = [
      ['PCY TECH FLEET OPERATIONS - STUDENT INCIDENTS REPORT'],
      [`Report Generated Date: ${todayStr}`],
      [`Total Incident Records: ${filteredIncidents.length}`],
      [],
    ];

    const headers = [
      'Incident ID',
      'Date',
      'Time',
      'Student Name',
      'Student #',
      'Grade',
      'School',
      'Route #',
      'Route Name',
      'Driver Name',
      'Driver ID',
      'Location',
      'Categories',
      'Description',
      'Witnesses',
      'Immediate Action Taken',
      'Removed From Bus',
      'First Aid Required',
      'Parents Notified',
      'Status',
      'Reviewing Administrator',
      'Reviewed Date',
      'Disciplinary Actions',
      'Office Notes'
    ];

    const rows = filteredIncidents.map((r) => [
      r.id,
      r.incidentDate,
      r.incidentTime,
      r.studentName,
      r.studentNo || '',
      r.grade || '',
      r.schoolName || '',
      r.routeNo,
      r.routeName || '',
      r.driverName,
      r.driverId,
      r.location,
      r.incidentTypes.map((k) => STUDENT_INCIDENT_CATEGORY_LABELS[k] || k).join('; '),
      r.description,
      r.witnesses || '',
      r.immediateActionTaken || '',
      r.studentRemovedFromBus ? 'YES' : 'NO',
      r.firstAidRequired ? 'YES' : 'NO',
      r.parentsNotified ? 'YES' : 'NO',
      STUDENT_INCIDENT_STATUS_LABELS[r.status] || r.status,
      r.officeFollowUp?.administratorName || '',
      r.officeFollowUp?.reviewedDate || '',
      (r.officeFollowUp?.disciplinaryActions || []).map((k) => DISCIPLINARY_ACTION_LABELS[k] || k).join('; '),
      r.officeFollowUp?.officeNotes || ''
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
    link.setAttribute('download', `PCY_Tech_Student_Incidents_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      {/* ─── Page Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={isFrench ? 'Gestion des incidents des élèves' : 'Student Incident Management'}
        subtitle={
          isFrench
            ? 'Examinez les signalements d\'incidents comportementaux, traitez les mesures disciplinaires et suivez les résolutions.'
            : 'Review driver behavior incident reports, conduct office disciplinary actions, and track resolutions.'
        }
        icon={<ShieldAlert className="h-5 w-5 text-amber-400" aria-hidden="true" />}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredIncidents.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-xs disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              title={isFrench ? 'Exporter en CSV Excel' : 'Export incidents data to CSV Excel'}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>{isFrench ? 'Exporter CSV' : 'Export CSV'}</span>
            </button>

            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isFrench ? 'Actualiser' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      {/* ─── KPI Metrics ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isFrench ? 'Incidents totaux' : 'Total Incidents'}
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {stats.total}
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider">
            {isFrench ? 'En attente bureau' : 'Pending Office'}
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats.pendingReview}
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider">
            {isFrench ? 'Enquête en cours' : 'Under Investigation'}
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats.underInvestigation}
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider">
            {isFrench ? 'Parents/École notifiés' : 'Parent / School Notified'}
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats.parentContacted}
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider">
            {isFrench ? 'Clos / Résolus' : 'Closed / Resolved'}
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats.closed}
          </div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ────────────────────────────────────────────── */}
      <search
        aria-label={isFrench ? 'Filtrer et rechercher les incidents' : 'Search and filter student incidents'}
        className="block bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-xs"
      >
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label={
                  timeRange === 'all'
                    ? (isFrench ? 'Rechercher par élève, matricule ou numéro de route' : 'Search by student name, number, or route number')
                    : (isFrench ? 'Rechercher par élève, école, route, conducteur ou notes' : 'Search by student name, school, route, driver, or notes')
                }
                placeholder={
                  timeRange === 'all'
                    ? (isFrench ? 'Nom de l\'élève, matricule ou n° de route...' : 'Student name, #, or route #...')
                    : (isFrench ? 'Rechercher par élève, école, route, conducteur ou notes...' : 'Search by student name, #, school, route, driver, or notes...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && timeRange === 'all') {
                    void loadIncidents(searchQuery.trim());
                  }
                }}
                className="w-full pl-9 pr-4 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500 transition"
              />
            </div>
            {timeRange === 'all' && (
              <button
                type="button"
                onClick={() => void loadIncidents(searchQuery.trim())}
                disabled={loading || !searchQuery.trim()}
                className="px-3.5 py-2 min-h-[36px] text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-200 rounded-lg transition shadow-xs whitespace-nowrap cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isFrench ? 'Rechercher dans l\'archive' : 'Search Archive'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Time Range Selector */}
            <div
              role="group"
              aria-label={isFrench ? 'Plage temporelle' : 'Time range'}
              className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700"
            >
              <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
                {isFrench ? 'Période :' : 'Range:'}
              </span>
              {[
                { id: '6months', label: isFrench ? '6 mois (Direct)' : '6 Months (Hot)' },
                { id: '1year', label: isFrench ? '1 an (Hybride)' : '1 Year (Hybrid)' },
                { id: 'all', label: isFrench ? 'Tout l\'historique' : 'All History' },
              ].map((rng) => (
                <button
                  key={rng.id}
                  type="button"
                  aria-pressed={timeRange === rng.id}
                  onClick={() => setTimeRange(rng.id as '6months' | '1year' | 'all')}
                  className={`px-2.5 py-1 min-h-[28px] text-xs font-semibold rounded-md transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                    timeRange === rng.id
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {rng.label}
                </button>
              ))}
            </div>

            {/* Needs Office Follow-up Toggle */}
            <button
              type="button"
              aria-pressed={needsFollowUpOnly}
              onClick={() => setNeedsFollowUpOnly(!needsFollowUpOnly)}
              className={`px-3 py-2 min-h-[36px] text-xs font-medium rounded-lg border transition flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                needsFollowUpOnly
                  ? 'bg-amber-500/10 border-amber-400  font-semibold'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              {isFrench ? 'Suivi bureau requis seulement' : 'Needs Office Follow-up Only'}
            </button>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={isFrench ? 'Filtrer par statut d\'incident' : 'Filter by incident status'}
              className="px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
            >
              <option value="all">{isFrench ? 'Tous les statuts' : 'All Statuses'}</option>
              <option value="submitted">{isFrench ? 'Soumis' : 'Submitted'}</option>
              <option value="under_investigation">{isFrench ? 'Enquête en cours' : 'Under Investigation'}</option>
              <option value="parent_contacted">{isFrench ? 'Parents notifiés' : 'Parent Contacted'}</option>
              <option value="school_notified">{isFrench ? 'École notifiée' : 'School Notified'}</option>
              <option value="closed">{isFrench ? 'Clos' : 'Closed'}</option>
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
              <span>{isFrench ? 'Mode Tout l\'historique (Archive froide BigQuery)' : 'All History Mode (BigQuery Cold Archive)'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium">
                {isFrench ? 'Recherche sécurisée 5 ans' : '5-Year Safe Scan'}
              </span>
            </div>
            <p className="">
              {isFrench
                ? 'Pour protéger les performances de la base de données sur les 5 ans d\'archives d\'incidents, la navigation complète est restreinte. Veuillez saisir un nom d\'élève, un matricule ou un numéro de route pour interroger les archives.'
                : 'To protect database performance and avoid full-table scans across 5 years of school incidents, full browsing is restricted. Please enter a Student Name, Student #, or Route # to query historical archive records.'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Incident Reports Table ──────────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/60 shadow-xs overflow-hidden">
        <div
          ref={tableContainerRef}
          tabIndex={0}
          role="region"
          aria-label={isFrench ? 'Tableau des incidents des élèves' : 'Student incidents table'}
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500"
        >
          <table className="w-full text-left text-sm text-slate-300 border-collapse table-fixed min-w-[980px]">
            <caption className="sr-only">
              {isFrench ? 'Liste des rapports d\'incidents des élèves' : 'Student incident reports'}
            </caption>
            <colgroup>
              <col style={{ width: '130px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ minWidth: '180px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '220px' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-xs text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 shadow-xs">
              <tr>
                <th scope="col" className="px-4 py-3">{isFrench ? 'Date / Heure' : 'Date / Time'}</th>
                <th scope="col" className="px-4 py-3">{isFrench ? 'Élève' : 'Student'}</th>
                <th scope="col" className="px-4 py-3">{isFrench ? 'École & Circuit' : 'School & Route'}</th>
                <th scope="col" className="px-4 py-3">{isFrench ? 'Catégories' : 'Categories'}</th>
                <th scope="col" className="px-4 py-3">{isFrench ? 'Conducteur' : 'Reporting Driver'}</th>
                <th scope="col" className="px-4 py-3">{isFrench ? 'Alertes sécurité' : 'Safety Alerts'}</th>
                <th scope="col" className="px-4 py-3">{isFrench ? 'Statut' : 'Status'}</th>
                <th scope="col" className="px-4 py-3 text-right">{isFrench ? 'Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div role="status">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" aria-hidden="true" />
                      {isFrench ? 'Chargement des rapports d\'incidents...' : 'Loading student incident reports...'}
                    </div>
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {timeRange === 'all' && !searchQuery.trim() ? (
                      <div className="flex flex-col items-center">
                        <Search className="h-10 w-10 text-amber-500/60 mb-2" aria-hidden="true" />
                        <h4 className="text-base font-semibold text-slate-300">
                          {isFrench ? 'Rechercher dans l\'historique des incidents' : 'Search Student Incident History'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-md">
                          {isFrench
                            ? 'Recherchez parmi 5 ans d\'archives BigQuery en saisissant le nom d\'un élève, son matricule ou le numéro de route ci-dessus.'
                            : 'Search across 5 years of BigQuery incident archives by entering a student name, student #, or route # above and clicking Search Archive.'}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <ShieldAlert className="h-8 w-8 mx-auto mb-2" aria-hidden="true" />
                        <h4 className="text-base font-semibold text-slate-300">
                          {isFrench ? 'Aucun rapport d\'incident trouvé' : 'No incident reports found'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {timeRange === 'all'
                            ? (isFrench
                                ? `Aucun incident d'élève trouvé pour « ${searchQuery} » dans l'archive historique.`
                                : `No student incidents found for "${searchQuery}" in the historical archive.`)
                            : (isFrench
                                ? 'Aucun incident d\'élève ne correspond aux filtres actuels.'
                                : 'No student incidents match your current filter.')}
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={8} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const r = filteredIncidents[virtualRow.index];
                    if (!r) return null;
                    const statusConfig =
                      STUDENT_INCIDENT_STATUS_COLORS[r.status] ||
                      STUDENT_INCIDENT_STATUS_COLORS.submitted;
                    const statusLabel =
                      STUDENT_INCIDENT_STATUS_LABELS[r.status] || r.status;

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-750/50 transition cursor-pointer"
                        onClick={() => handleOpenReview(r)}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-medium text-slate-100 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            {r.incidentDate}
                            {isArchivedDate(r.incidentDate) && (
                              <span
                                title={isFrench ? 'Dossier archivé dans BigQuery (>6 mois)' : 'Record is older than 6 months and retrieved from BigQuery cold archive'}
                                className="ml-1 px-1 py-0.2 rounded text-[10px] font-semibold border"
                              >
                                BigQuery
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {r.incidentTime}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {onSelectStudent && r.studentName ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStudent({
                                  id: r.studentNo || (r.studentId ? String(r.studentId) : undefined),
                                  name: r.studentName,
                                });
                              }}
                              className="font-semibold text-slate-200 hover:text-amber-600 hover:text-amber-300 hover:underline transition text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                              title={isFrench ? "Voir la fiche élève" : 'View student details'}
                              aria-label={isFrench ? `Voir le profil de ${r.studentName}` : `View student profile for ${r.studentName}`}
                            >
                              {r.studentName}
                            </button>
                          ) : (
                            <div className="font-semibold text-slate-100">
                              {r.studentName}
                            </div>
                          )}
                          <div className="text-xs text-slate-400">
                            {r.grade ? `Gr ${r.grade}` : (isFrench ? 'Élève' : 'Student')}{' '}
                            {r.studentNo ? `· #${r.studentNo}` : ''}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {onSelectSchool && r.schoolName ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSchool(r.schoolId, r.schoolName);
                              }}
                              className="text-slate-200 flex items-center gap-1 hover:text-amber-600 hover:text-amber-300 hover:underline transition text-left max-w-full rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                              title={isFrench ? "Voir la fiche école" : 'View school details'}
                              aria-label={isFrench ? `Voir l'école ${r.schoolName}` : `View school details for ${r.schoolName}`}
                            >
                              <School className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                              <span className="truncate max-w-[180px]">{r.schoolName}</span>
                            </button>
                          ) : (
                            <div className="text-slate-200 flex items-center gap-1">
                              <School className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                              <span className="truncate max-w-[180px]">
                                {r.schoolName || (isFrench ? 'École non assignée' : 'Unassigned School')}
                              </span>
                            </div>
                          )}
                          <div className="text-xs text-slate-400">
                            {isFrench ? 'Circuit' : 'Route'} {r.routeNo}{' '}
                            {r.routeName ? `· ${r.routeName}` : ''}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {r.incidentTypes.map((k) => (
                              <span
                                key={k}
                                className="px-2 py-0.5 text-xs rounded-md bg-slate-700 text-slate-200 border border-slate-600"
                              >
                                {STUDENT_INCIDENT_CATEGORY_LABELS[k] || k}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="text-slate-200 font-medium">
                            {r.driverName}
                          </div>
                          <div className="text-xs text-slate-400">ID: {r.driverId}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 text-xs">
                            {r.studentRemovedFromBus && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-rose-300 text-rose-400 font-semibold w-fit">
                                <UserX className="h-3 w-3" aria-hidden="true" /> {isFrench ? 'Débarqué de l\'autobus' : 'Removed from Bus'}
                              </span>
                            )}
                            {r.firstAidRequired && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-red-700 text-red-400 font-semibold w-fit">
                                <HeartPulse className="h-3 w-3" aria-hidden="true" /> {isFrench ? 'Premiers soins' : 'First Aid Given'}
                              </span>
                            )}
                            {r.parentsNotified && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-blue-300 text-blue-400 w-fit">
                                <PhoneCall className="h-3 w-3" aria-hidden="true" /> {isFrench ? 'Parents notifiés' : 'Parents Notified'}
                              </span>
                            )}
                            {!r.studentRemovedFromBus &&
                              !r.firstAidRequired &&
                              !r.parentsNotified && (
                                <span className="text-slate-400">-</span>
                              )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                          >
                            {statusLabel}
                          </span>
                          {r.officeFollowUp?.isOfficeLocked && (
                            <span className="ml-1 text-slate-400 inline-block align-middle" title={isFrench ? 'Dossier verrouillé' : 'Office Record Locked'}>
                              <Lock className="h-3 w-3" aria-hidden="true" />
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPdf(r);
                              }}
                              className="px-2.5 py-1.5 min-h-[32px] text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 hover:bg-slate-600 text-slate-200 transition border border-slate-700 flex items-center gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                              title={isFrench ? 'Imprimer / Exporter PDF' : 'Print Official Incident Form / PDF'}
                              aria-label={isFrench ? `Imprimer ou exporter le PDF pour ${r.studentName} (${r.incidentDate})` : `Print or export PDF for ${r.studentName} (${r.incidentDate})`}
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                              <span>{isFrench ? 'Imprimer / PDF' : 'Print / PDF'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReview(r);
                              }}
                              className="px-2.5 py-1.5 min-h-[32px] text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                              aria-label={isFrench ? `Examiner et traiter l'incident de ${r.studentName} (${r.incidentDate})` : `Review and action incident for ${r.studentName} (${r.incidentDate})`}
                            >
                              {isFrench ? 'Examiner & Traiter' : 'Review & Action'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={8} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Office Follow-up Review Modal ────────────────────────────────────── */}
      <IncidentModalDialog
        open={Boolean(isReviewModalOpen && selectedIncident)}
        onClose={() => setIsReviewModalOpen(false)}
        ariaLabelledBy="incident-review-modal-title"
      >
        {selectedIncident && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveReview();
            }}
            className="bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" aria-hidden="true" />
                <h2 id="incident-review-modal-title" className="text-lg font-bold text-slate-200">
                  Student Incident Office Review & Resolution
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPdf(selectedIncident)}
                  className="px-3 py-1.5 min-h-[32px] text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  title="Print Incident Report PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  aria-label={isFrench ? 'Fermer la fenêtre' : 'Close dialog'}
                  className="p-1.5 min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:text-slate-200 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Driver Report Summary Box */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700 space-y-2 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Student
                    </span>
                    <div className="text-base font-bold text-slate-100">
                      {onSelectStudent && selectedIncident.studentName ? (
                        <button
                          type="button"
                          onClick={() =>
                            onSelectStudent({
                              id:
                                selectedIncident.studentNo ||
                                (selectedIncident.studentId
                                  ? String(selectedIncident.studentId)
                                  : undefined),
                              name: selectedIncident.studentName,
                            })
                          }
                          className="hover:text-amber-600 hover:text-amber-300 hover:underline transition rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                          title="View student details"
                        >
                          {selectedIncident.studentName}
                        </button>
                      ) : (
                        selectedIncident.studentName
                      )}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        ({selectedIncident.grade ? `Gr ${selectedIncident.grade}` : 'Student'}{' '}
                        {selectedIncident.studentNo ? `· #${selectedIncident.studentNo}` : ''})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Occurred
                    </span>
                    <div className="text-xs font-medium text-slate-300">
                      {selectedIncident.incidentDate} at {selectedIncident.incidentTime}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-400">
                  <div>
                    <span className="font-semibold">School:</span>{' '}
                    {onSelectSchool && selectedIncident.schoolName ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectSchool(selectedIncident.schoolId, selectedIncident.schoolName)
                        }
                        className="hover:text-amber-600 hover:text-amber-300 hover:underline transition rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                        title="View school details"
                      >
                        {selectedIncident.schoolName}
                      </button>
                    ) : (
                      selectedIncident.schoolName || 'N/A'
                    )}
                  </div>
                  <div>
                    <span className="font-semibold">Route:</span> Route {selectedIncident.routeNo}
                  </div>
                  <div>
                    <span className="font-semibold">Driver:</span> {selectedIncident.driverName} (ID: {selectedIncident.driverId})
                  </div>
                  <div>
                    <span className="font-semibold">Location:</span> {selectedIncident.location || 'On Bus'}
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-500">Driver Description:</span>
                  <p className="mt-1 text-slate-200 bg-slate-800 p-2.5 rounded-lg border border-slate-700/80 leading-relaxed text-xs">
                    {selectedIncident.description}
                  </p>
                </div>

                {selectedIncident.immediateActionTaken && (
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold">Immediate Action:</span> {selectedIncident.immediateActionTaken}
                  </div>
                )}
                {selectedIncident.otherStudentsInvolved && (
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold">Other Students:</span> {selectedIncident.otherStudentsInvolved}
                  </div>
                )}
                {selectedIncident.witnesses && (
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold">Witnesses:</span> {selectedIncident.witnesses}
                  </div>
                )}
                {selectedIncident.parentsNotificationDetail && (
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold">Parent Notification:</span> {selectedIncident.parentsNotificationDetail}
                  </div>
                )}
              </div>

              {/* Status & Review Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={statusSelectId} className="block text-xs font-semibold text-slate-200 mb-1">
                    Incident Status <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id={statusSelectId}
                    name="reviewStatus"
                    autoFocus
                    required
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value as StudentIncidentStatus)}
                    className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                  >
                    <option value="submitted">Submitted</option>
                    <option value="under_investigation">Under Investigation</option>
                    <option value="parent_contacted">Parent Contacted</option>
                    <option value="school_notified">School Notified</option>
                    <option value="closed">Closed / Resolved</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={reviewedDateId} className="block text-xs font-semibold text-slate-200 mb-1">
                    Review Date <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={reviewedDateId}
                    name="reviewedDate"
                    type="date"
                    required
                    aria-invalid={Boolean(reviewError && !reviewedDate)}
                    aria-describedby={reviewError ? reviewErrorId : undefined}
                    value={reviewedDate}
                    onChange={(e) => setReviewedDate(e.target.value)}
                    className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor={adminNameId} className="block text-xs font-semibold text-slate-200 mb-1">
                    Admin / Officer Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={adminNameId}
                    name="administratorName"
                    type="text"
                    required
                    aria-invalid={Boolean(reviewError && !administratorName.trim())}
                    aria-describedby={reviewError ? reviewErrorId : undefined}
                    value={administratorName}
                    onChange={(e) => setAdministratorName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                  />
                </div>
              </div>

              {/* Disciplinary Actions Checkboxes */}
              <fieldset>
                <legend className="block text-xs font-semibold text-slate-200 mb-2">
                  Disciplinary & Administrative Actions Taken
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(DISCIPLINARY_ACTION_LABELS).map(([k, label]) => {
                    const isChecked = disciplinaryActions.includes(k);
                    return (
                      <label
                        key={k}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-400  font-semibold'
                            : 'border-slate-700 hover:bg-slate-750 text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDiscipline(k)}
                          className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4"
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>

                {disciplinaryActions.includes('other') && (
                  <div className="mt-2">
                    <label htmlFor={otherDisciplineId} className="sr-only">
                      Other disciplinary or corrective action
                    </label>
                    <input
                      id={otherDisciplineId}
                      name="disciplinaryOther"
                      type="text"
                      placeholder="Specify other disciplinary or corrective action..."
                      value={disciplinaryOther}
                      onChange={(e) => setDisciplinaryOther(e.target.value)}
                      className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                    />
                  </div>
                )}
              </fieldset>

              {/* Office Administrative Notes */}
              <div>
                <label htmlFor={officeNotesId} className="block text-xs font-semibold text-slate-200 mb-1">
                  Administrative Resolution Notes & Follow-up Details
                </label>
                <textarea
                  id={officeNotesId}
                  name="officeNotes"
                  rows={3}
                  value={officeNotes}
                  onChange={(e) => setOfficeNotes(e.target.value)}
                  placeholder="Record summary of conversations with school principal, parent conferences, or suspension dates..."
                  className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                />
              </div>

              {/* Lock Record Checkbox */}
              <div className="p-3 rounded-lg bg-amber-500/5 border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <div>
                    <label htmlFor={lockRecordId} className="text-xs font-bold text-slate-200 cursor-pointer">
                      Lock Office Record
                    </label>
                    <div className="text-[11px] text-slate-400">
                      Prevent subsequent modifications once case has concluded.
                    </div>
                  </div>
                </div>
                <input
                  id={lockRecordId}
                  name="isOfficeLocked"
                  type="checkbox"
                  checked={isOfficeLocked}
                  onChange={(e) => setIsOfficeLocked(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3 bg-slate-900/50">
              {reviewError && (
                <span id={reviewErrorId} role="alert" className="mr-auto text-xs font-semibold text-rose-500">
                  {reviewError}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 min-h-[36px] text-sm font-medium rounded-lg border border-slate-700 hover:bg-slate-700 text-slate-200 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 min-h-[36px] text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition flex items-center gap-1.5 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Save Resolution
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </IncidentModalDialog>

      {isPdfModalOpen && (
        <React.Suspense fallback={<ExportLoadingOverlay />}>
          <StudentIncidentPdfModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            incident={pdfTargetIncident}
            allIncidents={filteredIncidents}
          />
        </React.Suspense>
      )}
    </PageShell>
  );
};


