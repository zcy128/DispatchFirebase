import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import {
  RouteAssessment,
  ROUTE_ASSESSMENT_QUESTIONS,
} from '../types/routeAssessment';
import { RouteAssessmentService } from '../services/routeAssessmentService';
import { RouteAssessmentPdfModal } from '../components/assessments/RouteAssessmentPdfModal';

export const RouteAssessmentsView: React.FC = () => {
  const [assessments, setAssessments] = useState<RouteAssessment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'working' | 'completed' | 'submitted'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | '0' | '1'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Real-time subscription with dual-channel sync
  useEffect(() => {
    setLoading(true);
    const unsubscribe = RouteAssessmentService.subscribeRouteAssessments((data) => {
      setAssessments(data);
      setLoading(false);
      // Keep selected assessment up to date if open
      setSelectedAssessment((prev) => {
        if (!prev) return null;
        const found = data.find((d) => d.id === prev.id);
        return found || prev;
      });
    });
    return () => unsubscribe();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const data = await RouteAssessmentService.listAssessments();
      setAssessments(data);
    } catch (err) {
      console.error('Failed to refresh route assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = assessments.length;
    const working = assessments.filter((a) => a.statusInt === 0 || a.statusInt === 1).length;
    const completed = assessments.filter((a) => a.statusInt === 2 || a.isCompleted).length;
    const submitted = assessments.filter((a) => a.statusInt === 3 || a.isSubmitted).length;
    const flagged = assessments.filter((a) => {
      return (
        a.visibilityProblemCheck ||
        a.highwayStopConcernCheck ||
        a.locationProblemCheck ||
        a.unsafeTurnaroundCheck ||
        a.intersectionCheck ||
        a.roadwayCheck ||
        a.nonweatherRiskCheck ||
        a.weatherRiskCheck ||
        a.safetyConcernCheck
      );
    }).length;
    return { total, working, completed, submitted, flagged };
  }, [assessments]);

  // Filtered list
  const filteredAssessments = useMemo(() => {
    return assessments.filter((item) => {
      // Status filter
      if (statusFilter === 'working' && item.statusInt !== 0 && item.statusInt !== 1) {
        return false;
      }
      if (statusFilter === 'completed' && item.statusInt !== 2) {
        return false;
      }
      if (statusFilter === 'submitted' && item.statusInt !== 3) {
        return false;
      }

      // Assessment Type filter
      if (typeFilter !== 'all' && item.assessmentType !== typeFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRoute = item.routeId.toLowerCase().includes(q);
        const matchesDriver = item.conductedByDriver.toLowerCase().includes(q);
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
  }, [assessments, statusFilter, typeFilter, searchQuery]);

  const openReviewModal = (item: RouteAssessment) => {
    setSelectedAssessment(item);
    setOfficeAssignedTo(item.assignedTo || '');
    setOfficeCompleted(item.isCompleted || item.statusInt === 2);
    setOfficeSubmitted(item.isSubmitted || item.statusInt === 3);
    setEditSummaryText(item.summary || '');
    setIsEditingSummary(false);
  };

  const closeReviewModal = () => {
    setSelectedAssessment(null);
    setIsEditingSummary(false);
  };

  // Office Section Save (matching the reference image)
  const handleSaveOffice = async () => {
    if (!selectedAssessment) return;
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
      alert('Failed to save office processing. Please try again.');
    } finally {
      setIsSavingOffice(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!selectedAssessment) return;
    try {
      const updated = await RouteAssessmentService.updateAssessment(selectedAssessment.id, {
        summary: editSummaryText,
      });
      setSelectedAssessment(updated);
      setIsEditingSummary(false);
      setAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      console.error('Failed to update summary:', err);
      alert('Failed to update summary.');
    }
  };

  const handleDeleteAssessment = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this route assessment?')) {
      return;
    }
    try {
      await RouteAssessmentService.deleteAssessment(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
      if (selectedAssessment?.id === id) {
        setSelectedAssessment(null);
      }
    } catch (err) {
      console.error('Failed to delete route assessment:', err);
      alert('Failed to delete route assessment.');
    }
  };

  // Count flagged risks for an assessment
  const countFlaggedRisks = (a: RouteAssessment): number => {
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Route Assessments
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                School bus route safety checklists conducted by drivers & review workflow
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredAssessments.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer disabled:opacity-40"
            title="Export route assessments to CSV Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={refreshData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Assessments</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Working / In Review
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.working}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Submitted
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.submitted}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Identified Risks
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.flagged}</div>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search route, driver, employee ID, school, summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Assessment Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All Checklist Types</option>
              <option value="0">New Route (Dry Run)</option>
              <option value="1">Change in Route</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">Status:</span>
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
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Route</th>
                <th className="px-4 py-3.5">Date / Created</th>
                <th className="px-4 py-3.5">School & Board</th>
                <th className="px-4 py-3.5">Conducted By</th>
                <th className="px-4 py-3.5">Findings Summary</th>
                <th className="px-4 py-3.5">Safety Concerns</th>
                <th className="px-4 py-3.5">Assigned To</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading && assessments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Loading route assessments...
                  </td>
                </tr>
              ) : filteredAssessments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    No route assessments found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredAssessments.map((item) => {
                  const riskCount = countFlaggedRisks(item);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => openReviewModal(item)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors"
                    >
                      {/* Type */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.assessmentType === '0'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          }`}
                        >
                          {item.assessmentType === '0' ? 'New Route' : 'Change in Route'}
                        </span>
                      </td>

                      {/* Route */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">
                        {item.routeId || 'N/A'}
                      </td>

                      {/* Date / Created */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {item.assessmentDate
                            ? new Date(item.assessmentDate).toLocaleDateString()
                            : new Date(item.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-slate-400">
                          {item.schoolYear || '2026-2027'}
                        </div>
                      </td>

                      {/* School & Board */}
                      <td className="px-4 py-3.5 max-w-[180px] truncate">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.school || 'Unspecified'}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {item.schoolBoard || 'School Board'}
                        </div>
                      </td>

                      {/* Conducted By */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {item.conductedByDriver}
                        </div>
                        <div className="text-xs text-slate-400">
                          {item.conductedByEmployeeId || item.driverEmail || ''}
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="px-4 py-3.5 max-w-xs truncate text-xs text-slate-600 dark:text-slate-400">
                        {item.summary || <span className="italic text-slate-400">No summary entered</span>}
                      </td>

                      {/* Safety Concerns */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {riskCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            {riskCount} Concern{riskCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 text-emerald-500" />
                            Clear
                          </span>
                        )}
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                        {item.assignedTo || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>

                      {/* Status Icon */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {item.statusInt === 3 ? (
                          <div className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium text-xs">
                            <Send className="w-4 h-4" /> Submitted
                          </div>
                        ) : item.statusInt === 2 ? (
                          <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                            <CheckCircle2 className="w-4 h-4" /> Completed
                          </div>
                        ) : item.statusInt === 1 ? (
                          <div className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium text-xs">
                            <Wrench className="w-4 h-4" /> In Review
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-xs">
                            <Clock className="w-4 h-4" /> Working
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
                            className="p-1.5 text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                            title="Print Official Route Assessment / PDF"
                          >
                            <Printer className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openReviewModal(item);
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                            title="Review Route Assessment"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteAssessment(item.id, e)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Detail & Office Processing Modal */}
      {selectedAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedAssessment.assessmentType === '0'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    }`}
                  >
                    {selectedAssessment.assessmentType === '0' ? 'New Route (Dry Run)' : 'Change in Route'}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Route Assessment: {selectedAssessment.routeId || 'N/A'}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Print Route Assessment PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Print / PDF</span>
                </button>
                <button
                  onClick={closeReviewModal}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* ───────────────────────────────────────────────────────────── */}
              {/* 1. OFFICE PROCESSING SECTION (STRICTLY MATCHING USER'S IMAGE) */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                {/* Header with green underline matching Razor & user image */}
                <div className="text-base font-bold text-slate-900 dark:text-slate-100 pb-2 border-b-2 border-emerald-500 flex items-center justify-between">
                  <span>Office</span>
                  <span className="text-xs font-normal text-slate-500">
                    Current Status:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedAssessment.statusStr}
                    </strong>
                  </span>
                </div>

                {/* Form fields: Assigned To, Completed checkbox, Submitted checkbox */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Assigned To
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="e.g. Safety Officer / Dispatcher"
                      value={officeAssignedTo}
                      onChange={(e) => setOfficeAssignedTo(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="officeCompletedCheck"
                      checked={officeCompleted}
                      onChange={(e) => setOfficeCompleted(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <label
                      htmlFor="officeCompletedCheck"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Completed
                    </label>
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="officeSubmittedCheck"
                      checked={officeSubmitted}
                      onChange={(e) => setOfficeSubmitted(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <label
                      htmlFor="officeSubmittedCheck"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Submitted
                    </label>
                  </div>
                </div>

                {/* Action Buttons: Save & Cancel */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleSaveOffice}
                    disabled={isSavingOffice}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingOffice ? 'Saving...' : 'Save'}
                  </button>

                  <button
                    onClick={() => {
                      setOfficeAssignedTo(selectedAssessment.assignedTo || '');
                      setOfficeCompleted(selectedAssessment.isCompleted);
                      setOfficeSubmitted(selectedAssessment.isSubmitted);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                  >
                    <Ban className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 2. DRIVER & ROUTE METADATA SECTION                             */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Driver Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-500" /> Driver Details
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {selectedAssessment.conductedByDriver}
                      </span>
                    </div>
                    {selectedAssessment.conductedByEmployeeId && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Employee ID:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {selectedAssessment.conductedByEmployeeId}
                        </span>
                      </div>
                    )}
                    {selectedAssessment.driverPhone && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Phone:</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {selectedAssessment.driverPhone}
                        </span>
                      </div>
                    )}
                    {selectedAssessment.driverEmail && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {selectedAssessment.driverEmail}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Route & School Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-emerald-500" /> Route & School
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Route ID:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {selectedAssessment.routeId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">School:</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {selectedAssessment.school || 'Unspecified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">School Board:</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {selectedAssessment.schoolBoard || 'Unspecified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">School Year:</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {selectedAssessment.schoolYear || '2026-2027'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 3. FINDINGS SUMMARY                                            */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-500" /> Summarize Findings
                  </span>
                  {!isEditingSummary && (
                    <button
                      onClick={() => setIsEditingSummary(true)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Edit Summary
                    </button>
                  )}
                </div>

                {isEditingSummary ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={editSummaryText}
                      onChange={(e) => setEditSummaryText(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSummary}
                        className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
                      >
                        Save Summary
                      </button>
                      <button
                        onClick={() => setIsEditingSummary(false)}
                        className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
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
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-500" /> Attached Incident / Route Photos (
                    {selectedAssessment.attachmentUrls.length})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {selectedAssessment.attachmentUrls.map((url, idx) => (
                      <div
                        key={idx}
                        onClick={() =>
                          setLightbox({
                            urls: selectedAssessment.attachmentUrls || [],
                            currentIndex: idx,
                            title: `Route Photo ${idx + 1} of ${selectedAssessment.attachmentUrls?.length}`,
                          })
                        }
                        className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-100 dark:bg-slate-800"
                      >
                        <img
                          src={url}
                          alt={`Attachment ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 5. 11 SAFETY CHECKLIST QUESTIONS                              */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="text-base font-bold text-slate-900 dark:text-slate-100 pb-2 border-b-2 border-emerald-500 flex items-center justify-between">
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
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                            : 'bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 p-1 rounded-md ${
                              isChecked
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
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
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {q.title}
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  isChecked
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {isChecked ? 'Concern Flagged (YES)' : 'No Issues (NO)'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {q.question}
                            </p>

                            {isChecked && textVal && (
                              <div className="mt-2 p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs text-slate-800 dark:text-slate-200 font-medium">
                                <span className="font-bold text-rose-700 dark:text-rose-400 block mb-0.5">
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
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Assessment ID: <code className="font-mono">{selectedAssessment.id}</code>
              </span>
              <button
                onClick={closeReviewModal}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for Photos */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          {/* Lightbox Header */}
          <div
            className="w-full max-w-4xl flex items-center justify-between text-white pb-3 mb-2 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-sm">{lightbox.title}</h3>
              <p className="text-xs text-slate-400">
                Photo {lightbox.currentIndex + 1} of {lightbox.urls.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={lightbox.urls[lightbox.currentIndex]}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Full Size
              </a>
              <button
                onClick={() => setLightbox(null)}
                className="p-1.5 text-white/80 hover:text-white rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Image */}
          <div
            className="relative max-w-4xl max-h-[75vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.urls.length > 1 && (
              <button
                disabled={lightbox.currentIndex === 0}
                onClick={() =>
                  setLightbox((prev) =>
                    prev && prev.currentIndex > 0
                      ? { ...prev, currentIndex: prev.currentIndex - 1 }
                      : prev
                  )
                }
                className="absolute left-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={lightbox.urls[lightbox.currentIndex]}
              alt="Full resolution"
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />

            {lightbox.urls.length > 1 && (
              <button
                disabled={lightbox.currentIndex === lightbox.urls.length - 1}
                onClick={() =>
                  setLightbox((prev) =>
                    prev && prev.currentIndex < prev.urls.length - 1
                      ? { ...prev, currentIndex: prev.currentIndex + 1 }
                      : prev
                  )
                }
                className="absolute right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Lightbox Thumbnail Strip */}
          {lightbox.urls.length > 1 && (
            <div
              className="flex items-center gap-2 mt-4 overflow-x-auto max-w-xl py-2 px-3 bg-black/40 rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {lightbox.urls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightbox((prev) => (prev ? { ...prev, currentIndex: i } : null))}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
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

      {/* ─── Official Printable Route Assessment PDF Modal ───────────────────── */}
      <RouteAssessmentPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        assessment={pdfTargetAssessment}
        allAssessments={filteredAssessments}
      />
    </div>
  );
};
