import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Wrench,
  Search,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Car,
  Calendar,
  X,
  User,
  MapPin,
  FileText,
  Hammer,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import {
  VehicleDefectReport,
  DefectStatus,
  UpdateDefectAssessmentPayload,
  DEFECT_STATUS_LABELS,
  DEFECT_STATUS_COLORS,
} from '../types/defect';
import { DefectService } from '../services/defectService';
import { DispatchService } from '../services/dispatchService';
import { useAuth } from '../contexts/AuthContext';
import { OperationalSafetyLogService } from '../services/operationalSafetyLogService';
import { VehicleDefectPdfModal } from '../components/defects/VehicleDefectPdfModal';
import { VehicleDefectSummaryModal } from '../components/defects/VehicleDefectSummaryModal';

export const DefectReportsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState<VehicleDefectReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<VehicleDefectReport | null>(null);
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // PDF & Print Modals State
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
  const [pdfSelectedReport, setPdfSelectedReport] = useState<VehicleDefectReport | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState<boolean>(false);

  const handleOpenPdf = (report: VehicleDefectReport) => {
    setPdfSelectedReport(report);
    setPdfModalOpen(true);
  };

  // Assessment Form State
  const [assessmentStatus, setAssessmentStatus] = useState<DefectStatus>('under_assessment');
  const [assessedBy, setAssessedBy] = useState<string>('');
  const [repairLocation, setRepairLocation] = useState<string>('');
  const [estimatedRepairDays, setEstimatedRepairDays] = useState<number>(1);
  const [estimatedStartDate, setEstimatedStartDate] = useState<string>('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState<string>('');
  const [actualCompletionDate, setActualCompletionDate] = useState<string>('');
  const [repairCost, setRepairCost] = useState<number>(0);
  const [assessmentNotes, setAssessmentNotes] = useState<string>('');
  const [mechanicNotes, setMechanicNotes] = useState<string>('');
  const [resolvedBy, setResolvedBy] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = DefectService.subscribeToDefects((data) => {
      setReports(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const data = await DefectService.listDefects();
      setReports(data);
    } catch (err) {
      console.error('Failed to refresh defect reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = reports.length;
    const submitted = reports.filter((r) => r.status === 'submitted').length;
    const underAssessment = reports.filter((r) => r.status === 'under_assessment').length;
    const underRepair = reports.filter((r) => r.status === 'under_repair').length;
    const resolved = reports.filter((r) => r.status === 'resolved').length;
    return { total, submitted, underAssessment, underRepair, resolved };
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const unit = (r.vehicleUnitNumber || '').toLowerCase();
        const driver = (r.reportedByName || '').toLowerCase();
        const notes = (r.defectNotes || '').toLowerCase();
        const location = (r.assessment?.repairLocation || '').toLowerCase();
        return unit.includes(q) || driver.includes(q) || notes.includes(q) || location.includes(q);
      }
      return true;
    });
  }, [reports, statusFilter, searchQuery]);

  const openAssessmentModal = (report: VehicleDefectReport) => {
    setSelectedReport(report);
    setAssessmentStatus(
      report.status === 'submitted' ? 'under_assessment' : report.status
    );
    setAssessedBy(
      report.assessment?.assessedBy || currentUser?.displayName || currentUser?.email || 'Fleet Operations'
    );
    setRepairLocation(report.assessment?.repairLocation || 'Main Maintenance Depot');
    setEstimatedRepairDays(report.assessment?.estimatedRepairDays || 1);

    const todayStr = new Date().toISOString().split('T')[0];
    setEstimatedStartDate(report.assessment?.estimatedStartDate || todayStr);
    setEstimatedCompletionDate(report.assessment?.estimatedCompletionDate || todayStr);
    setActualCompletionDate(report.assessment?.actualCompletionDate || '');
    setRepairCost(report.assessment?.repairCost || 0);
    setAssessmentNotes(report.assessment?.assessmentNotes || '');
    setMechanicNotes(report.assessment?.mechanicNotes || '');
    setResolvedBy(report.assessment?.resolvedBy || currentUser?.displayName || '');
    setIsAssessmentModalOpen(true);
  };

  const handleDaysChange = (days: number) => {
    setEstimatedRepairDays(days);
    if (estimatedStartDate && days > 0) {
      const d = new Date(estimatedStartDate);
      d.setDate(d.getDate() + days);
      setEstimatedCompletionDate(d.toISOString().split('T')[0]);
    }
  };

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    setSaving(true);
    try {
      const payload: UpdateDefectAssessmentPayload = {
        status: assessmentStatus,
        assessedBy,
        repairLocation,
        estimatedRepairDays: Number(estimatedRepairDays) || 0,
        estimatedStartDate,
        estimatedCompletionDate,
        actualCompletionDate: assessmentStatus === 'resolved' ? (actualCompletionDate || new Date().toISOString().split('T')[0]) : actualCompletionDate,
        repairCost: Number(repairCost) || 0,
        assessmentNotes,
        mechanicNotes,
        resolvedBy: assessmentStatus === 'resolved' ? (resolvedBy || assessedBy) : resolvedBy,
      };

      await DefectService.updateAssessment(selectedReport.id, payload);

      if (assessmentStatus !== 'resolved' && !selectedReport.noDefectsFound) {
        const effStart =
          estimatedStartDate && selectedReport.reportDate
            ? estimatedStartDate < selectedReport.reportDate
              ? estimatedStartDate
              : selectedReport.reportDate
            : estimatedStartDate || selectedReport.reportDate;
        await DispatchService.removeUnavailableVehicleFromDispatches(
          selectedReport.vehicleUnitNumber,
          selectedReport.vehicleId,
          effStart
        ).catch(() => {});
      }

      await OperationalSafetyLogService.logOperation({
        module: 'vehicle_defect',
        action: assessmentStatus === 'resolved' ? 'resolve' : 'update',
        targetId: selectedReport.id,
        targetIdentifier: `DEF-${selectedReport.vehicleUnitNumber}`,
        targetTitle: `Bus #${selectedReport.vehicleUnitNumber} Defect`,
        status: assessmentStatus,
        summary: `Assessment saved by ${assessedBy || currentUser?.displayName || 'Fleet'}. Status: ${assessmentStatus}. Location: ${repairLocation || 'Shop'}.`,
        actor: {
          userId: currentUser?.uid || 'fleet-1',
          userName: currentUser?.displayName || assessedBy || 'Fleet Maintenance',
          userEmail: currentUser?.email,
          userRole: currentUser?.role || 'fleet',
        },
        diffs: [
          {
            field: 'status',
            fieldLabel: 'Defect Status',
            oldValue: selectedReport.status,
            newValue: assessmentStatus,
          },
          ...(repairLocation ? [{
            field: 'repairLocation',
            fieldLabel: 'Repair Location',
            oldValue: selectedReport.assessment?.repairLocation || null,
            newValue: repairLocation,
          }] : []),
          ...(mechanicNotes ? [{
            field: 'mechanicNotes',
            fieldLabel: 'Mechanic Notes',
            oldValue: selectedReport.assessment?.mechanicNotes || null,
            newValue: mechanicNotes,
          }] : []),
        ],
      });

      setIsAssessmentModalOpen(false);
      refreshData();
    } catch (err) {
      console.error('Failed to update defect assessment:', err);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // CSV Export with PCY Tech Brand & Summary Block
  const handleExportCsv = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const totalCost = filteredReports.reduce((acc, curr) => acc + (curr.assessment?.repairCost || 0), 0);

    const companyHeaderRows = [
      ['PCY TECH INC. - SCHOOL BUS FLEET OPERATIONS & SAFETY COMPLIANCE'],
      ['VEHICLE DEFECT INSPECTION & FLEET MAINTENANCE STATUS REPORT'],
      [
        'Generated Date:',
        new Date().toLocaleString(),
        'Filter Status Scope:',
        statusFilter.toUpperCase(),
        'Search Query:',
        searchQuery || 'None',
        'System Source:',
        'PCY Tech Fleet Cloud Operations Platform'
      ],
      [
        'Total Reports Logged:',
        filteredReports.length,
        'Submitted:',
        stats.submitted,
        'Under Assessment:',
        stats.underAssessment,
        'Under Repair:',
        stats.underRepair,
        'Resolved:',
        stats.resolved,
        'Total Repair Cost:',
        `$${totalCost.toFixed(2)}`
      ],
      [],
      ['DETAILED VEHICLE DEFECT RECORDS']
    ];

    const tableHeaders = [
      'Vehicle Unit #',
      'Report ID',
      'Report Date',
      'Report Time',
      'Reported By (Driver)',
      'Odometer (km)',
      'Defects Flagged Count',
      'Flagged Items List',
      'Driver Defect Notes',
      'Defect Lifecycle Status',
      'Assessed By',
      'Repair Location / Shop',
      'Estimated Repair Days',
      'Estimated Start Date',
      'Estimated Completion Date',
      'Actual Completion Date',
      'Repair Cost ($)',
      'Triage / Assessment Notes',
      'Mechanic / Completion Notes',
      'Resolved By'
    ];

    const dataRows = filteredReports.map((r) => {
      const defectItems = r.items.filter((i) => i.status === 'defect');
      return [
        `Bus #${r.vehicleUnitNumber}`,
        r.id,
        r.reportDate,
        r.reportTime,
        r.reportedByName,
        r.odometer || 0,
        defectItems.length,
        defectItems.map((i) => i.name + (i.notes ? ` (${i.notes})` : '')).join('; ') || 'None (Pass)',
        r.defectNotes || 'None',
        DEFECT_STATUS_LABELS[r.status] || r.status,
        r.assessment?.assessedBy || 'Unassigned',
        r.assessment?.repairLocation || 'Unassigned',
        r.assessment?.estimatedRepairDays ?? 0,
        r.assessment?.estimatedStartDate || '',
        r.assessment?.estimatedCompletionDate || '',
        r.assessment?.actualCompletionDate || '',
        r.assessment?.repairCost ? r.assessment.repairCost.toFixed(2) : '0.00',
        r.assessment?.assessmentNotes || '',
        r.assessment?.mechanicNotes || '',
        r.assessment?.resolvedBy || ''
      ];
    });

    const summaryRow = [
      'TOTAL SUMMARY',
      `${filteredReports.length} Reports`,
      '-',
      '-',
      '-',
      '-',
      filteredReports.reduce((acc, curr) => acc + curr.items.filter((i) => i.status === 'defect').length, 0),
      '-',
      '-',
      `${stats.resolved} Resolved / ${stats.underRepair} Repair / ${stats.submitted} Subm`,
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      totalCost.toFixed(2),
      '-',
      '-',
      '-'
    ];

    const footerRows = [
      [],
      ['REGULATORY COMPLIANCE & AUDIT NOTICE'],
      ['Notice:', 'This official record contains vehicle mechanical inspection and maintenance history generated by PCY Tech Fleet Management Platform. Maintained in compliance with motor vehicle safety transport regulations.'],
      ['Certified By:', 'PCY TECH FLEET OPERATIONS & SAFETY DEPARTMENT', 'Audit Timestamp:', new Date().toISOString()]
    ];

    const allCsvRows = [
      ...companyHeaderRows,
      tableHeaders,
      ...dataRows,
      summaryRow,
      ...footerRows
    ];

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
    link.setAttribute('download', `PCY_Tech_Fleet_Defect_Reports_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-500" />
            Vehicle Defect Reports & Fleet Assessment
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review driver defect reports, manage repair schedules, and maintain fleet vehicle safety compliance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredReports.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-40 cursor-pointer"
            title="Download CSV spreadsheet of defect reports"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Export CSV
          </button>

          {/* Print Summary */}
          <button
            type="button"
            onClick={() => setSummaryModalOpen(true)}
            disabled={filteredReports.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-40 cursor-pointer"
            title="Print or export A4 landscape summary report"
          >
            <Printer className="w-4 h-4 text-amber-500" />
            Print Summary
          </button>

          {/* Refresh */}
          <button
            onClick={refreshData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</div>
          <div className="text-xs text-slate-400 mt-0.5">All defect reports</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-amber-200 dark:border-amber-900/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Submitted</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.submitted}</div>
          <div className="text-xs text-slate-400 mt-0.5">Awaiting assessment</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-200 dark:border-blue-900/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Assessment</span>
            <ShieldAlert className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.underAssessment}</div>
          <div className="text-xs text-slate-400 mt-0.5">Under evaluation</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-purple-200 dark:border-purple-900/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">In Repair</span>
            <Hammer className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.underRepair}</div>
          <div className="text-xs text-slate-400 mt-0.5">Shop work in progress</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-900/50 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.resolved}</div>
          <div className="text-xs text-slate-400 mt-0.5">Repaired & cleared</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'submitted', label: 'Submitted' },
            { id: 'under_assessment', label: 'Under Assessment' },
            { id: 'under_repair', label: 'Under Repair' },
            { id: 'resolved', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search unit, driver, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm">Loading defect reports...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No defect reports found</h3>
            <p className="text-xs text-slate-500 mt-1">No reports match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Vehicle Unit</th>
                  <th className="py-3 px-4">Reported By / Date</th>
                  <th className="py-3 px-4">Odometer</th>
                  <th className="py-3 px-4">Flagged Items</th>
                  <th className="py-3 px-4">Driver Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Fleet Assignment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-300">
                {filteredReports.map((report) => {
                  const defectItems = report.items.filter((i) => i.status === 'defect');
                  const statusColors = DEFECT_STATUS_COLORS[report.status];

                  return (
                    <tr key={report.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition">
                      {/* Unit Number */}
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                            <Car className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              Unit #{report.vehicleUnitNumber}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Driver & Date */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {report.reportedByName}
                          </span>
                          <span className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {report.reportDate} {report.reportTime}
                          </span>
                        </div>
                      </td>

                      {/* Odometer */}
                      <td className="py-3 px-4 font-mono">
                        {report.odometer > 0 ? `${report.odometer.toLocaleString()} km` : '—'}
                      </td>

                      {/* Flagged Defect Items */}
                      <td className="py-3 px-4">
                        {defectItems.length === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> No Defects
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {defectItems.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                              >
                                {item.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Driver Notes */}
                      <td className="py-3 px-4 max-w-xs truncate" title={report.defectNotes}>
                        {report.defectNotes ? (
                          <span className="text-slate-600 dark:text-slate-300">{report.defectNotes}</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${statusColors.badge}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {DEFECT_STATUS_LABELS[report.status]}
                        </span>
                      </td>

                      {/* Fleet Assignment Info */}
                      <td className="py-3 px-4">
                        {report.assessment?.repairLocation ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {report.assessment.repairLocation}
                            </span>
                            {(report.assessment.estimatedRepairDays ?? 0) > 0 && (
                              <span className="text-slate-400 text-[10px]">
                                Est. {report.assessment.estimatedRepairDays} days
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPdf(report)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md transition cursor-pointer"
                            title="Print or Download Work Order PDF"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-500" />
                            <span>Print / PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openAssessmentModal(report)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 rounded-md transition cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Assess / Repair</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fleet Assessment & Repair Modal */}
      {isAssessmentModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-500" />
                  Fleet Assessment & Repair Dispatch
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Unit #{selectedReport.vehicleUnitNumber} — Reported by {selectedReport.reportedByName} on{' '}
                  {selectedReport.reportDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPdf(selectedReport)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-lg transition cursor-pointer"
                  title="Print Official Work Order"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-500" />
                  <span>Print Work Order</span>
                </button>
                <button
                  onClick={() => setIsAssessmentModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveAssessment} className="p-6 overflow-y-auto space-y-5">
              {/* Flagged Items Summary */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Inspection Checklist Results
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedReport.items.map((item) => {
                    const isDefect = item.status === 'defect';
                    const isNA = item.status === 'na';
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start justify-between p-2 rounded-lg text-xs border ${
                          isDefect
                            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 font-semibold'
                            : isNA
                            ? 'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate pr-2">{item.name}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isDefect
                              ? 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'
                              : isNA
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {selectedReport.defectNotes && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Driver Notes: </span>
                    <span className="text-slate-600 dark:text-slate-400 italic">{selectedReport.defectNotes}</span>
                  </div>
                )}
              </div>

              {/* Status Transition Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Update Lifecycle Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'submitted', label: 'Submitted' },
                    { id: 'under_assessment', label: 'Under Assessment' },
                    { id: 'under_repair', label: 'Under Repair' },
                    { id: 'resolved', label: 'Resolved' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setAssessmentStatus(s.id as DefectStatus)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition text-center ${
                        assessmentStatus === s.id
                          ? 'bg-amber-500 text-slate-900 border-amber-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fleet Assessment & Repair Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assessed By
                  </label>
                  <input
                    type="text"
                    required
                    value={assessedBy}
                    onChange={(e) => setAssessedBy(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Repair Location / Workshop
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Depot Bay 1, Vendor Service"
                    value={repairLocation}
                    onChange={(e) => setRepairLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Repair Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={estimatedRepairDays}
                    onChange={(e) => handleDaysChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Completion Date
                  </label>
                  <input
                    type="date"
                    value={estimatedCompletionDate}
                    onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Repair Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={repairCost}
                    onChange={(e) => setRepairCost(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                {assessmentStatus === 'resolved' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Resolved By
                    </label>
                    <input
                      type="text"
                      value={resolvedBy}
                      onChange={(e) => setResolvedBy(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Assessment Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assessment / Triage Notes
                </label>
                <textarea
                  rows={2}
                  value={assessmentNotes}
                  onChange={(e) => setAssessmentNotes(e.target.value)}
                  placeholder="Notes from initial inspection triage or required parts..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Mechanic Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mechanic / Repair Completion Notes
                </label>
                <textarea
                  rows={2}
                  value={mechanicNotes}
                  onChange={(e) => setMechanicNotes(e.target.value)}
                  placeholder="Details of parts replaced, repairs conducted, and sign-off..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAssessmentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Save Assessment & Repair
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Defect Report & Work Order PDF / Print Modal */}
      <VehicleDefectPdfModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        report={pdfSelectedReport}
        allReports={reports}
      />

      {/* Fleet Defect Summary & Maintenance Status Print Modal */}
      <VehicleDefectSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        reports={filteredReports}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />
    </div>
  );
};
