import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  AlertOctagon,
  Flame,
  Printer,
  FileSpreadsheet,
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
import { HazardReportPdfModal } from '../components/hazards/HazardReportPdfModal';

export const HazardReportsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
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

  // Subscribe to real-time updates
  useEffect(() => {
    setLoading(true);
    const unsubscribe = HazardReportService.subscribeHazardReports((data) => {
      setReports(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const data = await HazardReportService.listReports();
      setReports(data);
    } catch (err) {
      console.error('Failed to refresh hazard reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = reports.length;
    const open = reports.filter((r) => r.statusInt === 0).length;
    const investigating = reports.filter((r) => r.statusInt === 1).length;
    const resolved = reports.filter((r) => r.statusInt === 2 || r.isCompleted).length;
    const serious = reports.filter((r) => r.serious || r.trafficHazard).length;
    return { total, open, investigating, resolved, serious };
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Status filter
      if (statusFilter !== 'all') {
        const targetStatus = Number(statusFilter);
        if (r.statusInt !== targetStatus) return false;
      }

      // Office Hazard Type filter
      if (officeTypeFilter !== 'all') {
        if ((r.officeHazardType || '').toLowerCase() !== officeTypeFilter.toLowerCase()) {
          return false;
        }
      }

      // Specific Hazard Type filter
      if (hazardTypeFilter !== 'all') {
        const key = hazardTypeFilter as keyof HazardReport;
        if (!r[key]) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
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
  }, [reports, statusFilter, officeTypeFilter, hazardTypeFilter, searchQuery]);

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
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedReport(null);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedReport) return;
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
      alert('Failed to save evaluation. Please check server logs.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to get active hazard tags
  const getHazardTags = (r: HazardReport) => {
    const list: string[] = [];
    if (r.trippingHazard) list.push('Tripping');
    if (r.trafficHazard) list.push('Traffic');
    if (r.equipmentHazard) list.push('Equipment');
    if (r.performanceHazard) list.push('Performance');
    if (r.snowHazard) list.push('Snow / Ice / Road');
    if (r.spillHazard) list.push('Spill');
    if (r.otherHazard) list.push('Other Hazard');
    return list;
  };

  // Helper to get active close call tags
  const getCloseCallTags = (r: HazardReport) => {
    const list: string[] = [];
    if (r.unsafeAction) list.push('Unsafe Action');
    if (r.unsafeCondition) list.push('Unsafe Condition');
    if (r.happenedtoMe) list.push('To Me');
    if (r.happenedtoSomeone) list.push('To Someone');
    if (r.ofanarea) list.push('Area Issue');
    if (r.ofEquipment) list.push('Equipment Issue');
    return list;
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
    <div className="space-y-6">
      {/* ─── Header & Actions ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:white">
                Hazard & Near-Miss Reports
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Track driver & crew safety concerns, road hazards, unsafe conditions, and corrective actions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredReports.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer disabled:opacity-40"
            title="Export hazards data to CSV Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Refresh list from server"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics Overview ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Total Reports</span>
            <AlertOctagon className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-400">All filed hazards</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <span>Open / Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.open}
          </div>
          <div className="mt-1 text-xs text-slate-400">Awaiting office review</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <span>Investigating</span>
            <Wrench className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.investigating}
          </div>
          <div className="mt-1 text-xs text-slate-400">Corrective action in progress</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span>Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.resolved}
          </div>
          <div className="mt-1 text-xs text-slate-400">Completed & closed</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <span>Critical / Serious</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {stats.serious}
          </div>
          <div className="mt-1 text-xs text-slate-400">High severity potential</div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ─────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search driver, route, unit #, location, person involved, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="0">Open / Pending</option>
              <option value="1">Under Investigation</option>
              <option value="2">Resolved / Completed</option>
            </select>
          </div>

          {/* Office Hazard Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              Office Type:
            </span>
            <select
              value={officeTypeFilter}
              onChange={(e) => setOfficeTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              Hazard:
            </span>
            <select
              value={hazardTypeFilter}
              onChange={(e) => setHazardTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
      </div>

      {/* ─── Main Reports Table ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3.5">Event Date / Time</th>
                <th className="px-4 py-3.5">Hazard & Close Call Types</th>
                <th className="px-4 py-3.5">Reported By / Unit / Route</th>
                <th className="px-4 py-3.5">Location & Description</th>
                <th className="px-4 py-3.5">Risk & Office Type</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        No Hazard Reports Found
                      </div>
                      <p className="text-xs text-slate-400">
                        {searchQuery || statusFilter !== 'all' || officeTypeFilter !== 'all'
                          ? 'Try clearing active filters or search terms.'
                          : 'Drivers & crew members can submit reports directly from the Driver App.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const statusConfig = HAZARD_STATUS_CONFIG[report.statusInt] || HAZARD_STATUS_CONFIG[0];
                  const hazardTags = getHazardTags(report);
                  const closeCallTags = getCloseCallTags(report);

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      {/* Event Date / Time */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {report.eventTime
                            ? report.eventTime.replace('T', ' ').slice(0, 16)
                            : report.createdAt.slice(0, 10)}
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
                              className="group inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:ring-2 hover:ring-amber-400/30 transition-all cursor-pointer shadow-xs"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{report.attachmentUrls.length}</span>
                              <Eye className="w-3 h-3 text-amber-500 opacity-60 group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Hazard & Close Call Tags */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {hazardTags.length === 0 && closeCallTags.length === 0 && (
                            <span className="text-xs text-slate-400">General Hazard</span>
                          )}
                          {hazardTags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                            >
                              {tag}
                            </span>
                          ))}
                          {closeCallTags.map((tag, idx) => (
                            <span
                              key={`cc-${idx}`}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Reported By / Unit / Route */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {report.reportedBy || 'Unknown Staff'}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {report.unitNumber && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                              <Truck className="w-3 h-3" />
                              {report.unitNumber}
                            </span>
                          )}
                          {report.routeId && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                              <RouteIcon className="w-3 h-3" />
                              {report.routeId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Location & Description */}
                      <td className="px-4 py-3.5 align-top max-w-[300px]">
                        {report.eventLocation && (
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mb-0.5">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span className="truncate">{report.eventLocation}</span>
                          </div>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          {report.eventDescription}
                        </p>
                        {report.witnesses && (
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Witness: {report.witnesses}</span>
                          </div>
                        )}
                      </td>

                      {/* Risk & Office Type */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-1">
                          {report.officeHazardType ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              {report.officeHazardType}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Unclassified</span>
                          )}
                          <div className="flex items-center gap-1 text-[11px]">
                            {report.serious && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                Serious
                              </span>
                            )}
                            {report.moderate && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                Moderate
                              </span>
                            )}
                            {report.minor && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                Minor
                              </span>
                            )}
                            {report.assignedTo && (
                              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[100px]">
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
                          {report.statusInt === 0 && <Clock className="w-3 h-3 text-amber-500" />}
                          {report.statusInt === 1 && <Wrench className="w-3 h-3 text-blue-500" />}
                          {report.statusInt === 2 && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
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
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-600 flex items-center gap-1 cursor-pointer"
                            title="Print Official Hazard Report / PDF"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-500" />
                            <span>Print / PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openDetailModal(report)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer ${
                              report.statusInt === 0
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {report.statusInt === 0 ? 'Evaluate & Action' : 'View Details'}
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

      {/* ─── Detail & Office Evaluation Modal ─────────────────────────────── */}
      {isDetailModalOpen && selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={closeDetailModal}
        >
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
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
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Reported on {selectedReport.eventTime || selectedReport.createdAt.slice(0, 10)} by{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedReport.reportedBy}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPdf(selectedReport)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Print Hazard Report PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-500" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={closeDetailModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Two Column Grid */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ─── Column 1: Event Information & Driver Report ──────────────── */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Event & Route Information
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">Reported By:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedReport.reportedBy}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Contact Phone:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedReport.phone || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Route:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedReport.routeId || 'N/A'}{' '}
                          {selectedReport.routeName ? `(${selectedReport.routeName})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Vehicle Unit:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedReport.unitNumber || selectedReport.unitId || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Supervisor:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedReport.supervisor || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Person(s) Involved:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedReport.personInvolved || 'None'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                      <span className="text-slate-400 block mb-0.5">Location of Event:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        {selectedReport.eventLocation || 'Not specified'}
                      </span>
                    </div>

                    {selectedReport.witnesses && (
                      <div className="text-xs">
                        <span className="text-slate-400 block mb-0.5">Witnesses:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {selectedReport.witnesses}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Hazard Categories & Close Call Badges */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Selected Hazard Classifications
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {getHazardTags(selectedReport).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                        >
                          ⚠ {tag}
                        </span>
                      ))}
                      {getCloseCallTags(selectedReport).map((tag, i) => (
                        <span
                          key={`cc-${i}`}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800"
                        >
                          👁 {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Event Description */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Event Description
                    </h4>
                    <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {selectedReport.eventDescription}
                    </p>
                  </div>

                  {/* Attached Photos */}
                  {selectedReport.attachmentUrls && selectedReport.attachmentUrls.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                          Attached Photos ({selectedReport.attachmentUrls.length})
                        </h4>
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
                            className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-xs hover:ring-2 hover:ring-amber-500"
                          >
                            <img
                              src={url}
                              alt={`Hazard Attachment #${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold gap-1">
                              <Eye className="w-3 h-3" />
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
                  <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Evaluation of Risk Potential
                        </h4>
                      </div>
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        Health & Safety Review
                      </span>
                    </div>

                    {/* Severity Potential Checkboxes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Severity Potential:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalSerious}
                            onChange={(e) => setEvalSerious(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            Serious
                          </span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalModerate}
                            onChange={(e) => setEvalModerate(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            Moderate
                          </span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalMinor}
                            onChange={(e) => setEvalMinor(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Minor
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Recurrence Potential Checkboxes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Probability of Recurrence:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalProbable}
                            onChange={(e) => setEvalProbable(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Probable</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalOccasional}
                            onChange={(e) => setEvalOccasional(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Occasional</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalRare}
                            onChange={(e) => setEvalRare(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Rare</span>
                        </label>
                      </div>
                    </div>

                    {/* Office Hazard Type Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Office Classification Type:
                      </label>
                      <select
                        value={evalOfficeHazardType}
                        onChange={(e) => setEvalOfficeHazardType(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Suggested Corrective Action:
                      </label>
                      <textarea
                        rows={2}
                        value={evalSuggestion}
                        onChange={(e) => setEvalSuggestion(e.target.value)}
                        placeholder="e.g. Notify road maintenance department of severe black ice on Route 12 corner..."
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      />
                    </div>

                    {/* Corrective Action Taken */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Corrective Action Taken:
                      </label>
                      <textarea
                        rows={2}
                        value={evalActionTaken}
                        onChange={(e) => setEvalActionTaken(e.target.value)}
                        placeholder="e.g. City crew dispatched salt truck; alternative stop rerouted temporarily."
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      />
                    </div>

                    {/* Assigned To & Employee Attribution */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Assigned To:
                        </label>
                        <input
                          type="text"
                          value={evalAssignedTo}
                          onChange={(e) => setEvalAssignedTo(e.target.value)}
                          placeholder="e.g. Safety Mgr John"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Employee Error (if any):
                        </label>
                        <input
                          type="text"
                          value={evalEmployeeError}
                          onChange={(e) => setEvalEmployeeError(e.target.value)}
                          placeholder="Driver or staff name"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    {/* Status & Completion Toggle */}
                    <div className="pt-2 border-t border-amber-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalIsCompleted}
                            onChange={(e) => {
                              setEvalIsCompleted(e.target.checked);
                              if (e.target.checked) setEvalStatusInt(2);
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Mark Hazard Report as Resolved / Completed
                          </span>
                        </label>

                        {!evalIsCompleted && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">Current Phase:</span>
                            <select
                              value={evalStatusInt}
                              onChange={(e) => setEvalStatusInt(Number(e.target.value))}
                              className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
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
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={closeDetailModal}
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEvaluation}
                disabled={saving}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-all shadow-sm flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Evaluation & Actions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Multi-Photo Lightbox Modal ─────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="w-full flex items-center justify-between p-3.5 border-b border-slate-800 text-white bg-slate-900/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm font-semibold truncate">{lightbox.title}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  {lightbox.currentIndex + 1} / {lightbox.urls.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.urls[lightbox.currentIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Full Size
                </a>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
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
                  className="absolute left-3 z-10 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-sm shadow-lg"
                  title="Previous image (Left arrow)"
                >
                  <ChevronLeft className="w-6 h-6" />
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
                  className="absolute right-3 z-10 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-sm shadow-lg"
                  title="Next image (Right arrow)"
                >
                  <ChevronRight className="w-6 h-6" />
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
                    onClick={() =>
                      setLightbox((prev) => (prev ? { ...prev, currentIndex: idx } : null))
                    }
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
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
        </div>
      )}

      {/* ─── Official Printable Hazard Report PDF Modal ───────────────────── */}
      <HazardReportPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        report={pdfTargetReport}
        allReports={filteredReports}
      />
    </div>
  );
};
