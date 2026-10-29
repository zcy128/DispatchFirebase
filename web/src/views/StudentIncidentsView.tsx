import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useI18n } from '../contexts/I18nContext';
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
import { StudentIncidentPdfModal } from '../components/incidents/StudentIncidentPdfModal';

export const StudentIncidentsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();
  const [incidents, setIncidents] = useState<StudentIncident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  const [timeRange, setTimeRange] = useState<'6months' | '1year' | 'all'>('6months');

  const isArchivedDate = (d?: string) => {
    if (!d) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);
    return d < cutoff.toISOString().slice(0, 10);
  };

  const loadIncidents = async (targetQuery?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q) {
      setIncidents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = { timeRange };
      if (q) {
        params.query = q;
      }
      const data = await StudentIncidentService.listIncidents(params);
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load student incidents:', err);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (timeRange === '6months') {
      setLoading(true);
      const unsubscribe = StudentIncidentService.subscribeToIncidents((data) => {
        setIncidents(data);
        setLoading(false);
      });
      return () => unsubscribe();
    } else if (timeRange === '1year') {
      loadIncidents();
    } else {
      if (searchQuery.trim()) {
        loadIncidents(searchQuery.trim());
      } else {
        setIncidents([]);
        setLoading(false);
      }
    }
  }, [timeRange]);

  const refreshData = async () => {
    if (timeRange === 'all') {
      if (searchQuery.trim()) {
        loadIncidents(searchQuery.trim());
      } else {
        setIncidents([]);
      }
    } else {
      loadIncidents();
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = incidents.length;
    const pendingReview = incidents.filter(
      (r) =>
        r.status !== 'closed' &&
        (!r.officeFollowUp || !r.officeFollowUp.isOfficeLocked)
    ).length;
    const underInvestigation = incidents.filter((r) => r.status === 'under_investigation').length;
    const parentContacted = incidents.filter(
      (r) => r.status === 'parent_contacted' || r.status === 'school_notified'
    ).length;
    const closed = incidents.filter((r) => r.status === 'closed').length;
    return { total, pendingReview, underInvestigation, parentContacted, closed };
  }, [incidents]);

  // Filtered reports
  const filteredIncidents = useMemo(() => {
    return incidents.filter((r) => {
      // Needs Follow-up toggle
      if (needsFollowUpOnly) {
        if (r.status === 'closed') return false;
        if (r.officeFollowUp?.isOfficeLocked) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesStudent = r.studentName.toLowerCase().includes(q);
        const matchesStudentNo = (r.studentNo || '').toLowerCase().includes(q);
        const matchesSchool = (r.schoolName || '').toLowerCase().includes(q);
        const matchesRoute = (r.routeNo || '').toLowerCase().includes(q);
        const matchesDriver = r.driverName.toLowerCase().includes(q);
        const matchesDesc = r.description.toLowerCase().includes(q);
        const matchesLocation = r.location.toLowerCase().includes(q);
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
  }, [incidents, needsFollowUpOnly, statusFilter, searchQuery]);

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
    setIsReviewModalOpen(true);
  };

  const handleToggleDiscipline = (key: string) => {
    setDisciplinaryActions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSaveReview = async () => {
    if (!selectedIncident) return;
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
      alert('Error saving office follow-up review. Please try again.');
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
    <div className="space-y-6">
      {/* ─── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            {isFrench ? 'Gestion des incidents des élèves' : 'Student Incident Management'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isFrench
              ? 'Examinez les signalements d\'incidents comportementaux, traitez les mesures disciplinaires et suivez les résolutions.'
              : 'Review driver behavior incident reports, conduct office disciplinary actions, and track resolutions.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredIncidents.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs disabled:opacity-40"
            title={isFrench ? 'Exporter en CSV Excel' : 'Export incidents data to CSV Excel'}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            <span>{isFrench ? 'Exporter CSV' : 'Export CSV'}</span>
          </button>

          <button
            onClick={refreshData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{isFrench ? 'Actualiser' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isFrench ? 'Incidents totaux' : 'Total Incidents'}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {stats.total}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            {isFrench ? 'En attente bureau' : 'Pending Office'}
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats.pendingReview}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            {isFrench ? 'Enquête en cours' : 'Under Investigation'}
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {stats.underInvestigation}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            {isFrench ? 'Parents/École notifiés' : 'Parent / School Notified'}
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {stats.parentContacted}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            {isFrench ? 'Clos / Résolus' : 'Closed / Resolved'}
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.closed}
          </div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                timeRange === 'all'
                  ? (isFrench ? 'Nom de l\'élève, matricule ou n° de route...' : 'Student name, #, or route #...')
                  : (isFrench ? 'Rechercher par élève, école, route, conducteur ou notes...' : 'Search by student name, #, school, route, driver, or notes...')
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && timeRange === 'all') {
                  loadIncidents(searchQuery.trim());
                }
              }}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>
          {timeRange === 'all' && (
            <button
              type="button"
              onClick={() => loadIncidents(searchQuery.trim())}
              disabled={loading || !searchQuery.trim()}
              className="px-3.5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 rounded-lg transition shadow-xs whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isFrench ? 'Rechercher dans l\'archive' : 'Search Archive'}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
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
                onClick={() => setTimeRange(rng.id as any)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  timeRange === rng.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {rng.label}
              </button>
            ))}
          </div>

          {/* Needs Office Follow-up Toggle */}
          <button
            type="button"
            onClick={() => setNeedsFollowUpOnly(!needsFollowUpOnly)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              needsFollowUpOnly
                ? 'bg-amber-500/10 border-amber-400 text-amber-700 dark:text-amber-300 font-semibold'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            {isFrench ? 'Suivi bureau requis seulement' : 'Needs Office Follow-up Only'}
          </button>

          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={isFrench ? 'Filtrer par statut d\'incident' : 'Filter by incident status'}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
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

      {/* 5-Year Safe Scan Notice Banner */}
      {timeRange === 'all' && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
              <span>{isFrench ? 'Mode Tout l\'historique (Archive froide BigQuery)' : 'All History Mode (BigQuery Cold Archive)'}</span>
              <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded font-medium">
                {isFrench ? 'Recherche sécurisée 5 ans' : '5-Year Safe Scan'}
              </span>
            </div>
            <p className="text-amber-700 dark:text-amber-300">
              {isFrench
                ? 'Pour protéger les performances de la base de données sur les 5 ans d\'archives d\'incidents, la navigation complète est restreinte. Veuillez saisir un nom d\'élève, un matricule ou un numéro de route pour interroger les archives.'
                : 'To protect database performance and avoid full-table scans across 5 years of school incidents, full browsing is restricted. Please enter a Student Name, Student #, or Route # to query historical archive records.'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Incident Reports Table ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 border-collapse table-fixed min-w-[980px]">
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
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900/95 backdrop-blur-xs text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 shadow-xs">
              <tr>
                <th className="px-4 py-3">{isFrench ? 'Date / Heure' : 'Date / Time'}</th>
                <th className="px-4 py-3">{isFrench ? 'Élève' : 'Student'}</th>
                <th className="px-4 py-3">{isFrench ? 'École & Circuit' : 'School & Route'}</th>
                <th className="px-4 py-3">{isFrench ? 'Catégories' : 'Categories'}</th>
                <th className="px-4 py-3">{isFrench ? 'Conducteur' : 'Reporting Driver'}</th>
                <th className="px-4 py-3">{isFrench ? 'Alertes sécurité' : 'Safety Alerts'}</th>
                <th className="px-4 py-3">{isFrench ? 'Statut' : 'Status'}</th>
                <th className="px-4 py-3 text-right">{isFrench ? 'Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
                    {isFrench ? 'Chargement des rapports d\'incidents...' : 'Loading student incident reports...'}
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {timeRange === 'all' && !searchQuery.trim() ? (
                      <div className="flex flex-col items-center">
                        <Search className="h-10 w-10 text-amber-500/60 mb-2" />
                        <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">
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
                        <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">
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
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition cursor-pointer"
                        onClick={() => handleOpenReview(r)}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {r.incidentDate}
                            {isArchivedDate(r.incidentDate) && (
                              <span
                                title={isFrench ? 'Dossier archivé dans BigQuery (>6 mois)' : 'Record is older than 6 months and retrieved from BigQuery cold archive'}
                                className="ml-1 px-1 py-0.2 rounded text-[10px] font-semibold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
                              >
                                BigQuery
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {r.incidentTime}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {r.studentName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {r.grade ? `Gr ${r.grade}` : (isFrench ? 'Élève' : 'Student')}{' '}
                            {r.studentNo ? `· #${r.studentNo}` : ''}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-slate-900 dark:text-slate-200 flex items-center gap-1">
                            <School className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {r.schoolName || (isFrench ? 'École non assignée' : 'Unassigned School')}
                            </span>
                          </div>
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
                                className="px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
                              >
                                {STUDENT_INCIDENT_CATEGORY_LABELS[k] || k}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="text-slate-900 dark:text-slate-200 font-medium">
                            {r.driverName}
                          </div>
                          <div className="text-xs text-slate-400">ID: {r.driverId}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 text-xs">
                            {r.studentRemovedFromBus && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 font-semibold w-fit">
                                <UserX className="h-3 w-3" /> {isFrench ? 'Débarqué de l\'autobus' : 'Removed from Bus'}
                              </span>
                            )}
                            {r.firstAidRequired && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-400 font-semibold w-fit">
                                <HeartPulse className="h-3 w-3" /> {isFrench ? 'Premiers soins' : 'First Aid Given'}
                              </span>
                            )}
                            {r.parentsNotified && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 w-fit">
                                <PhoneCall className="h-3 w-3" /> {isFrench ? 'Parents notifiés' : 'Parents Notified'}
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
                              <Lock className="h-3 w-3" />
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
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-600 flex items-center gap-1 cursor-pointer"
                              title={isFrench ? 'Imprimer / Exporter PDF' : 'Print Official Incident Form / PDF'}
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-500" />
                              <span>{isFrench ? 'Imprimer / PDF' : 'Print / PDF'}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReview(r);
                              }}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer"
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
      {isReviewModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Student Incident Office Review & Resolution
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPdf(selectedIncident)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Print Incident Report PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-500" />
                  <span>Print / PDF</span>
                </button>
                <button
                  onClick={() => setIsReviewModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Driver Report Summary Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Student
                    </span>
                    <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {selectedIncident.studentName}{' '}
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
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {selectedIncident.incidentDate} at {selectedIncident.incidentTime}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="font-semibold">School:</span> {selectedIncident.schoolName || 'N/A'}
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
                  <p className="mt-1 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 leading-relaxed text-xs">
                    {selectedIncident.description}
                  </p>
                </div>

                {selectedIncident.immediateActionTaken && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">Immediate Action:</span> {selectedIncident.immediateActionTaken}
                  </div>
                )}
                {selectedIncident.otherStudentsInvolved && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">Other Students:</span> {selectedIncident.otherStudentsInvolved}
                  </div>
                )}
                {selectedIncident.witnesses && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">Witnesses:</span> {selectedIncident.witnesses}
                  </div>
                )}
                {selectedIncident.parentsNotificationDetail && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold">Parent Notification:</span> {selectedIncident.parentsNotificationDetail}
                  </div>
                )}
              </div>

              {/* Status & Review Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Incident Status *
                  </label>
                  <select
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value as StudentIncidentStatus)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="submitted">Submitted</option>
                    <option value="under_investigation">Under Investigation</option>
                    <option value="parent_contacted">Parent Contacted</option>
                    <option value="school_notified">School Notified</option>
                    <option value="closed">Closed / Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Review Date *
                  </label>
                  <input
                    type="date"
                    value={reviewedDate}
                    onChange={(e) => setReviewedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Admin / Officer Name *
                  </label>
                  <input
                    type="text"
                    value={administratorName}
                    onChange={(e) => setAdministratorName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Disciplinary Actions Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Disciplinary & Administrative Actions Taken
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(DISCIPLINARY_ACTION_LABELS).map(([k, label]) => {
                    const isChecked = disciplinaryActions.includes(k);
                    return (
                      <label
                        key={k}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
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
                    <input
                      type="text"
                      placeholder="Specify other disciplinary or corrective action..."
                      value={disciplinaryOther}
                      onChange={(e) => setDisciplinaryOther(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>

              {/* Office Administrative Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Administrative Resolution Notes & Follow-up Details
                </label>
                <textarea
                  rows={3}
                  value={officeNotes}
                  onChange={(e) => setOfficeNotes(e.target.value)}
                  placeholder="Record summary of conversations with school principal, parent conferences, or suspension dates..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Lock Record Checkbox */}
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-200 dark:border-amber-700/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Lock Office Record
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Prevent subsequent modifications once case has concluded.
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isOfficeLocked}
                  onChange={(e) => setIsOfficeLocked(e.target.checked)}
                  aria-label="Lock Office Record"
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReview}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition flex items-center gap-1.5 shadow-xs"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Save Resolution
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Official Printable Incident Report PDF Modal ───────────────────── */}
      <StudentIncidentPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        incident={pdfTargetIncident}
        allIncidents={filteredIncidents}
      />
    </div>
  );
};
