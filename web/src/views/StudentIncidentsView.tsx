import React, { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    setLoading(true);
    const unsubscribe = StudentIncidentService.subscribeToIncidents((data) => {
      setIncidents(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const data = await StudentIncidentService.listIncidents();
      setIncidents(data);
    } catch (err) {
      console.error('Failed to refresh student incidents:', err);
    } finally {
      setLoading(false);
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
            Student Incident Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review driver behavior incident reports, conduct office disciplinary actions, and track resolutions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredIncidents.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs disabled:opacity-40"
            title="Export incidents data to CSV Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={refreshData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Incidents
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {stats.total}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Pending Office
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats.pendingReview}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Under Investigation
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {stats.underInvestigation}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Parent / School Notified
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {stats.parentContacted}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Closed / Resolved
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.closed}
          </div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, #, school, route, driver, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            Needs Office Follow-up Only
          </button>

          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by incident status"
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="parent_contacted">Parent Contacted</option>
            <option value="school_notified">School Notified</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* ─── Incident Reports Table ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">School & Route</th>
                <th className="px-4 py-3">Categories</th>
                <th className="px-4 py-3">Reporting Driver</th>
                <th className="px-4 py-3">Safety Alerts</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading student incident reports...
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    No student incidents match your current filter.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((r) => {
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
                          {r.grade ? `Gr ${r.grade}` : 'Student'}{' '}
                          {r.studentNo ? `· #${r.studentNo}` : ''}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-slate-900 dark:text-slate-200 flex items-center gap-1">
                          <School className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {r.schoolName || 'Unassigned School'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Route {r.routeNo}{' '}
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
                              <UserX className="h-3 w-3" /> Removed from Bus
                            </span>
                          )}
                          {r.firstAidRequired && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-400 font-semibold w-fit">
                              <HeartPulse className="h-3 w-3" /> First Aid Given
                            </span>
                          )}
                          {r.parentsNotified && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 w-fit">
                              <PhoneCall className="h-3 w-3" /> Parents Notified
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
                          <span className="ml-1 text-slate-400 inline-block align-middle" title="Office Record Locked">
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
                            title="Print Official Incident Form / PDF"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-500" />
                            <span>Print / PDF</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReview(r);
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer"
                          >
                            Review & Action
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
