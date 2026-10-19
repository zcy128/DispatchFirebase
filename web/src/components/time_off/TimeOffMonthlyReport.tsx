import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Printer,
  Search,
  FileSpreadsheet,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Bus,
  ShieldCheck,
  Building,
  TrendingUp,
  XCircle,
  Download,
  X,
  Loader2
} from 'lucide-react';
import { TimeOffRequest, LeaveType, LEAVE_TYPE_LABELS } from '../../types/timeOff';
import { Employee } from '../../types/employee';
import { BusRoute } from '../../types/route';
import { Vehicle } from '../../types/vehicle';
import { formatLocalDate, getLocalTodayString } from '../../utils/dateUtils';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';

interface TimeOffMonthlyReportProps {
  requests: TimeOffRequest[];
  employees: Employee[];
  routes: BusRoute[];
  vehicles: Vehicle[];
  onExportPdf?: (request: TimeOffRequest) => void;
}

export interface EmployeeMonthlyStats {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  role: string;
  yardName: string;
  primaryRoute?: BusRoute;
  totalDays: number;
  totalRequests: number;
  approvedDays: number;
  pendingDays: number;
  rejectedDays: number;
  byCategory: Record<string, number>;
  requests: {
    request: TimeOffRequest;
    daysInMonth: number;
  }[];
}

export const TimeOffMonthlyReport: React.FC<TimeOffMonthlyReportProps> = ({
  requests,
  employees,
  routes,
  onExportPdf
}) => {
  const todayStr = getLocalTodayString();
  const currentMonthStr = todayStr.substring(0, 7); // "YYYY-MM"

  // Controls State
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('approved');
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'attendant'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<'totalDays' | 'employeeName' | 'totalRequests'>('totalDays');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const isExportingPdfRef = useRef<boolean>(false);
  const printSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPrintModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExportingPdfRef.current) {
        setShowPrintModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintModal]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(formatLocalDate(prevDate).substring(0, 7));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(formatLocalDate(nextDate).substring(0, 7));
  };

  // Month boundary calculation
  const { monthStartStr, monthEndStr, monthDisplayName } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return {
      monthStartStr: formatLocalDate(firstDay),
      monthEndStr: formatLocalDate(lastDay),
      monthDisplayName: `${monthNames[month - 1]} ${year}`
    };
  }, [selectedMonth]);

  // Aggregate statistics per employee for the selected month
  const { employeeStatsList, totalPersons, totalDaysAll, approvedDaysAll, pendingDaysAll, categoryBreakdown } = useMemo(() => {
    const statsMap: Record<string, EmployeeMonthlyStats> = {};
    const catTotals: Record<string, number> = {};

    let grandTotalDays = 0;
    let grandApprovedDays = 0;
    let grandPendingDays = 0;

    requests.forEach((req) => {
      // Status filtering
      if (statusFilter === 'approved' && req.status !== 'approved') return;
      if (statusFilter === 'pending' && req.status !== 'pending') return;

      const reqStart = req.startDate;
      const reqEnd = req.endDate;

      // Check if this request overlaps with the selected month
      if (reqStart > monthEndStr || reqEnd < monthStartStr) return;

      // Calculate the specific overlap days in this month
      const overlapStart = reqStart < monthStartStr ? monthStartStr : reqStart;
      const overlapEnd = reqEnd > monthEndStr ? monthEndStr : reqEnd;

      const startMs = new Date(overlapStart).getTime();
      const endMs = new Date(overlapEnd).getTime();
      const rawDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
      const isHalfDay = req.shiftType && req.shiftType !== 'ALL';
      const daysInMonth = isHalfDay ? rawDays * 0.5 : rawDays;

      if (daysInMonth <= 0) return;

      const empId = req.employeeId || req.employeeName || 'unknown';

      if (!statsMap[empId]) {
        const emp = employees.find(
          (e) => e.id === req.employeeId || e.employeeNumber === req.employeeId || e.employeeNumber === req.employeeNumber
        );
        const route = routes.find(
          (r) => r.driverId === req.employeeId || r.attendantId === req.employeeId
        );

        statsMap[empId] = {
          employeeId: empId,
          employeeNumber: req.employeeNumber || emp?.employeeNumber || 'N/A',
          employeeName: req.employeeName || emp?.fullName || 'Unknown Staff',
          role: emp?.role || (emp?.jobPosition?.toLowerCase().includes('attendant') ? 'attendant' : 'driver'),
          yardName: route?.yardName || emp?.yardId || 'Main Terminal',
          primaryRoute: route,
          totalDays: 0,
          totalRequests: 0,
          approvedDays: 0,
          pendingDays: 0,
          rejectedDays: 0,
          byCategory: {},
          requests: []
        };
      }

      statsMap[empId].totalDays += daysInMonth;
      statsMap[empId].totalRequests += 1;

      if (req.status === 'approved') {
        statsMap[empId].approvedDays += daysInMonth;
        grandApprovedDays += daysInMonth;
      } else if (req.status === 'pending') {
        statsMap[empId].pendingDays += daysInMonth;
        grandPendingDays += daysInMonth;
      } else if (req.status === 'rejected') {
        statsMap[empId].rejectedDays += daysInMonth;
      }

      const catKey = req.leaveType || 'other';
      statsMap[empId].byCategory[catKey] = (statsMap[empId].byCategory[catKey] || 0) + daysInMonth;

      catTotals[catKey] = (catTotals[catKey] || 0) + daysInMonth;
      grandTotalDays += daysInMonth;

      statsMap[empId].requests.push({
        request: req,
        daysInMonth
      });
    });

    let list = Object.values(statsMap);

    // Filter by role
    if (roleFilter !== 'all') {
      list = list.filter((item) => item.role.toLowerCase() === roleFilter.toLowerCase());
    }

    // Filter by search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          item.employeeName.toLowerCase().includes(q) ||
          item.employeeNumber.toLowerCase().includes(q) ||
          item.yardName.toLowerCase().includes(q) ||
          (item.primaryRoute?.routeNo && item.primaryRoute.routeNo.toLowerCase().includes(q))
      );
    }

    // Sort list
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'totalDays') {
        comparison = a.totalDays - b.totalDays;
      } else if (sortField === 'totalRequests') {
        comparison = a.totalRequests - b.totalRequests;
      } else if (sortField === 'employeeName') {
        comparison = a.employeeName.localeCompare(b.employeeName);
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return {
      employeeStatsList: list,
      totalPersons: list.length,
      totalDaysAll: grandTotalDays,
      approvedDaysAll: grandApprovedDays,
      pendingDaysAll: grandPendingDays,
      categoryBreakdown: catTotals
    };
  }, [requests, employees, routes, selectedMonth, statusFilter, roleFilter, searchTerm, sortField, sortDirection, monthStartStr, monthEndStr]);

  // Average days per employee
  const avgDaysPerPerson = totalPersons > 0 ? (totalDaysAll / totalPersons).toFixed(1) : '0';

  // Toggle sorting
  const handleSort = (field: 'totalDays' | 'employeeName' | 'totalRequests') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // CSV Export with Official Corporate Branding & Metrics Summary
  const handleExportCsv = () => {
    const companyHeaderRows = [
      ['PCY TECH INC. - SCHOOL BUS FLEET OPERATIONS & DISPATCH SYSTEMS'],
      ['EMPLOYEE TIME OFF MONTHLY STATISTICAL REPORT'],
      [
        'Reporting Month:',
        monthDisplayName,
        'Date Range:',
        `${monthStartStr} to ${monthEndStr}`,
        'Export Timestamp:',
        new Date().toLocaleString(),
        'System Platform:',
        'PCY Tech Fleet Cloud Operations Platform'
      ],
      [
        'Filter Status Scope:',
        statusFilter === 'approved' ? 'Approved Time Off Only' : statusFilter === 'pending' ? 'Pending Approval Only' : 'All Request Statuses',
        'Staff Role Scope:',
        roleFilter === 'all' ? 'All Roles (Drivers & Attendants)' : roleFilter === 'driver' ? 'Drivers Only' : 'Attendants Only',
        'Total Staff on Leave:',
        totalPersons,
        'Total Days Off:',
        totalDaysAll
      ],
      [],
      ['EXECUTIVE METRICS SUMMARY'],
      ['Metric', 'Value', 'Metric', 'Value'],
      ['Total Staff on Leave', totalPersons, 'Average Days Per Staff Member', `${avgDaysPerPerson} days`],
      ['Approved Leave Days', approvedDaysAll, 'Pending Leave Days', pendingDaysAll],
      ['Vacation Days', categoryBreakdown['vacation'] || 0, 'Sick Leave Days', categoryBreakdown['sick_leave'] || 0],
      ['Personal Days', categoryBreakdown['personal_days'] || 0, 'Bereavement & Other Days',
        (categoryBreakdown['bereavement_leave'] || 0) +
        (categoryBreakdown['jury_duty'] || 0) +
        (categoryBreakdown['aboriginal_practices'] || 0) +
        (categoryBreakdown['other'] || 0)
      ],
      [],
      ['DETAILED EMPLOYEE TIME OFF BREAKDOWN']
    ];

    const tableHeaders = [
      'Employee Name',
      'Employee ID',
      'Role',
      'Home Yard',
      'Assigned Route',
      'Month',
      'Total Days Off',
      'Approved Days',
      'Pending Days',
      'Requests Count',
      'Vacation (Days)',
      'Sick Leave (Days)',
      'Personal Days (Days)',
      'Other Leave (Days)'
    ];

    const rows = employeeStatsList.map((stat) => [
      stat.employeeName,
      stat.employeeNumber,
      stat.role.toUpperCase(),
      stat.yardName,
      stat.primaryRoute ? `${stat.primaryRoute.routeNo} - ${stat.primaryRoute.routeName}` : 'Unassigned',
      monthDisplayName,
      stat.totalDays,
      stat.approvedDays,
      stat.pendingDays,
      stat.totalRequests,
      stat.byCategory['vacation'] || 0,
      stat.byCategory['sick_leave'] || 0,
      stat.byCategory['personal_days'] || 0,
      (stat.byCategory['bereavement_leave'] || 0) +
        (stat.byCategory['jury_duty'] || 0) +
        (stat.byCategory['aboriginal_practices'] || 0) +
        (stat.byCategory['other'] || 0)
    ]);

    // Add summary row at bottom
    const summaryRow = [
      'TOTAL SUMMARY',
      `${totalPersons} Staff Members`,
      '-',
      '-',
      '-',
      monthDisplayName,
      totalDaysAll,
      approvedDaysAll,
      pendingDaysAll,
      employeeStatsList.reduce((acc, curr) => acc + curr.totalRequests, 0),
      categoryBreakdown['vacation'] || 0,
      categoryBreakdown['sick_leave'] || 0,
      categoryBreakdown['personal_days'] || 0,
      (categoryBreakdown['bereavement_leave'] || 0) +
        (categoryBreakdown['jury_duty'] || 0) +
        (categoryBreakdown['aboriginal_practices'] || 0) +
        (categoryBreakdown['other'] || 0)
    ];

    const footerRows = [
      [],
      ['CONFIDENTIALITY & AUDIT CERTIFICATION'],
      ['Notice:', 'This document contains proprietary employee attendance and leave records generated by PCY Tech Fleet Operations Platform. Unauthorized reproduction or dissemination is strictly prohibited.'],
      ['Verified & Certified By:', 'PCY TECH FLEET OPERATIONS & HUMAN RESOURCES', 'Digital Audit Timestamp:', new Date().toISOString()]
    ];

    const allCsvRows = [
      ...companyHeaderRows,
      tableHeaders,
      ...rows,
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
    link.setAttribute('download', `PCY_Tech_TimeOff_Monthly_Report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Open high-fidelity print & PDF export preview
  const handlePrintReport = () => {
    setShowPrintModal(true);
  };

  // Generate crisp A4 Landscape PDF directly via html2canvas and jsPDF
  const handleDownloadMonthlyPdf = async () => {
    if (isExportingPdfRef.current || isExportingPdf) return;
    if (!printSheetRef.current) return;

    isExportingPdfRef.current = true;
    setIsExportingPdf(true);

    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const element = printSheetRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            img { display: inline-block !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = 297;
      const pdfHeight = 210;
      const margin = 8;
      const printableWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * printableWidth) / canvas.width;

      if (imgHeight <= pdfHeight - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, imgHeight, undefined, 'FAST');
      } else {
        pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, Math.min(imgHeight, pdfHeight - margin * 2), undefined, 'FAST');
      }

      pdf.save(`PCY_Tech_TimeOff_Monthly_Report_${selectedMonth}.pdf`);
    } catch (err) {
      console.error('Failed to generate Monthly PDF report:', err);
    } finally {
      isExportingPdfRef.current = false;
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Month Navigation Bar */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Month Selector Pill */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-amber-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer"
            />
            <span className="text-xs text-slate-400 font-medium pl-1 border-l border-slate-700">
              {monthDisplayName}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {selectedMonth !== currentMonthStr && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonthStr)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition border border-amber-500/20"
            >
              This Month
            </button>
          )}
        </div>

        {/* Right Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          {/* Status Filter */}
          <div className="bg-slate-800 p-1 rounded-lg flex items-center text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-md transition ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Approved Only
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-md transition ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending
            </button>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="all">All Staff Roles</option>
            <option value="driver">Drivers Only</option>
            <option value="attendant">Attendants Only</option>
          </select>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={employeeStatsList.length === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-slate-200 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-sm"
            title="Download report as CSV Excel spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrintReport}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-sm"
            title="Print Monthly Summary Report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Staff Requesting Leave */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{totalPersons}</div>
              <div className="text-xs font-semibold text-slate-300">Total Staff on Leave</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {employees.length > 0 ? `${((totalPersons / employees.length) * 100).toFixed(0)}% of total workforce` : 'Active fleet staff'}
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Leave Days */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">
                {totalDaysAll} <span className="text-xs font-normal text-slate-400">Days</span>
              </div>
              <div className="text-xs font-semibold text-slate-300">Total Leave Days</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">
                {approvedDaysAll} approved • {pendingDaysAll} pending
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Average Days Per Person */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">
                {avgDaysPerPerson} <span className="text-xs font-normal text-slate-400">Days</span>
              </div>
              <div className="text-xs font-semibold text-slate-300">Average Per Person</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Absence intensity index</div>
            </div>
          </div>
        </div>

        {/* KPI 4: Top Category */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              {(() => {
                const entries = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
                const top = entries.length > 0 ? entries[0] : null;
                const topLabel = top ? LEAVE_TYPE_LABELS[top[0] as LeaveType] || top[0] : 'None';
                const topDays = top ? top[1] : 0;
                return (
                  <>
                    <div className="text-lg font-bold text-white truncate max-w-[150px]">
                      {topLabel}
                    </div>
                    <div className="text-xs font-semibold text-slate-300">
                      Primary Leave Type ({topDays} d)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {totalDaysAll > 0 ? `${((topDays / totalDaysAll) * 100).toFixed(0)}% of total days` : 'No leave logged'}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Progress Bar */}
      {totalDaysAll > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            <span>Leave Distribution by Category ({monthDisplayName})</span>
            <span className="font-mono text-slate-400">{totalDaysAll} Days Total</span>
          </div>

          {/* Multi-segment Progress Bar */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
            {Object.entries(categoryBreakdown).map(([cat, days]) => {
              const pct = (days / totalDaysAll) * 100;
              let bg = 'bg-slate-600';
              if (cat === 'vacation') bg = 'bg-blue-500';
              else if (cat === 'sick_leave') bg = 'bg-amber-500';
              else if (cat === 'personal_days') bg = 'bg-purple-500';
              else if (cat === 'bereavement_leave') bg = 'bg-rose-500';

              return (
                <div
                  key={cat}
                  style={{ width: `${pct}%` }}
                  className={`${bg} h-full transition-all`}
                  title={`${LEAVE_TYPE_LABELS[cat as LeaveType] || cat}: ${days} days (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-300">
            {Object.entries(categoryBreakdown).map(([cat, days]) => {
              let dotBg = 'bg-slate-500';
              if (cat === 'vacation') dotBg = 'bg-blue-400';
              else if (cat === 'sick_leave') dotBg = 'bg-amber-400';
              else if (cat === 'personal_days') dotBg = 'bg-purple-400';
              else if (cat === 'bereavement_leave') dotBg = 'bg-rose-400';

              return (
                <div key={cat} className="flex items-center space-x-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotBg}`} />
                  <span className="text-slate-400">
                    {LEAVE_TYPE_LABELS[cat as LeaveType] || cat}:
                  </span>
                  <span className="font-bold text-white font-mono">{days}d</span>
                  <span className="text-[10px] text-slate-500">
                    ({((days / totalDaysAll) * 100).toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Employee Statistical Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        {/* Table Controls Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              Employee Absence Summary &bull; {monthDisplayName}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              {totalPersons} Staff Members
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff, ID, yard, route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Table Content */}
        {employeeStatsList.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-500 mx-auto mb-3">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-200">No Time Off Records Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              There are no employee absence records matching your current filter in{' '}
              <strong>{monthDisplayName}</strong>. Use the month selector above to inspect other months or change the status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800 select-none">
                  <th className="py-3 px-4 w-12 text-center font-semibold">Rank</th>
                  <th
                    className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
                    onClick={() => handleSort('employeeName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Employee Details</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-semibold">Classification &amp; Yard</th>
                  <th className="py-3 px-4 font-semibold">Assigned Route</th>
                  <th
                    className="py-3 px-4 font-semibold cursor-pointer hover:text-white text-right"
                    onClick={() => handleSort('totalDays')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Total Days Off</span>
                      <ArrowUpDown className="w-3 h-3 text-amber-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-semibold">Category Breakdown</th>
                  <th
                    className="py-3 px-4 font-semibold cursor-pointer hover:text-white text-center"
                    onClick={() => handleSort('totalRequests')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Requests</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 text-center font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employeeStatsList.map((stat, idx) => {
                  const isExpanded = expandedEmployeeId === stat.employeeId;

                  return (
                    <React.Fragment key={stat.employeeId}>
                      <tr
                        className={`transition hover:bg-slate-800/40 ${
                          isExpanded ? 'bg-slate-800/30' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block w-6 h-6 rounded-full text-center leading-6 text-[11px] font-bold ${
                              idx === 0
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-950 font-bold'
                                : idx === 2
                                ? 'bg-amber-700/60 text-amber-200'
                                : 'text-slate-500 bg-slate-800'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>

                        {/* Employee Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                              {stat.employeeName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-100 text-sm">
                                {stat.employeeName}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                ID: {stat.employeeNumber}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role & Yard */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200 capitalize">
                            {stat.role === 'driver'
                              ? 'School Bus Driver'
                              : stat.role === 'attendant'
                              ? 'Safety Attendant'
                              : stat.role}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                            <Building className="w-3 h-3 text-slate-500 inline mr-0.5" />
                            <span>{stat.yardName}</span>
                          </div>
                        </td>

                        {/* Assigned Route */}
                        <td className="py-3.5 px-4">
                          {stat.primaryRoute ? (
                            <div>
                              <div className="font-semibold text-amber-400 flex items-center space-x-1">
                                <Bus className="w-3 h-3 text-amber-500 inline mr-0.5" />
                                <span>Route {stat.primaryRoute.routeNo}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                {stat.primaryRoute.routeName}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">
                              Relief / Unassigned
                            </span>
                          )}
                        </td>

                        {/* Total Days in Month */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-block px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-sm font-black font-mono">
                            {stat.totalDays} {stat.totalDays === 1 ? 'day' : 'days'}
                          </span>
                        </td>

                        {/* Category Breakdown Badges */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {Object.entries(stat.byCategory).map(([cat, days]) => {
                              let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                              if (cat === 'vacation')
                                badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                              else if (cat === 'sick_leave')
                                badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                              else if (cat === 'personal_days')
                                badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                              else if (cat === 'bereavement_leave')
                                badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                              return (
                                <span
                                  key={cat}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeColor}`}
                                >
                                  {LEAVE_TYPE_LABELS[cat as LeaveType] || cat}: {days}d
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Requests Count */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono font-bold text-slate-300">
                            {stat.totalRequests}
                          </span>
                        </td>

                        {/* Status Breakdown */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center space-y-0.5">
                            {stat.approvedDays > 0 && (
                              <span className="text-[10px] font-semibold text-emerald-400 flex items-center space-x-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                <span>{stat.approvedDays}d Approved</span>
                              </span>
                            )}
                            {stat.pendingDays > 0 && (
                              <span className="text-[10px] font-semibold text-amber-400 flex items-center space-x-0.5">
                                <Clock className="w-2.5 h-2.5 text-amber-500" />
                                <span>{stat.pendingDays}d Pending</span>
                              </span>
                            )}
                            {stat.rejectedDays > 0 && (
                              <span className="text-[10px] font-semibold text-rose-400 flex items-center space-x-0.5">
                                <XCircle className="w-2.5 h-2.5 text-rose-500" />
                                <span>{stat.rejectedDays}d Rejected</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Expand Details Button */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEmployeeId(isExpanded ? null : stat.employeeId)
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                            title={isExpanded ? 'Collapse breakdown' : 'Expand leave entries'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-amber-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Details Sub-row */}
                      {isExpanded && (
                        <tr className="bg-slate-950/70 border-b border-slate-800">
                          <td colSpan={9} className="p-4 pl-14">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-300 uppercase tracking-wider">
                                  Absence Records for {stat.employeeName} in {monthDisplayName} ({stat.requests.length} requests)
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {stat.requests.map(({ request: r, daysInMonth }, reqIdx) => (
                                  <div
                                    key={r.id || reqIdx}
                                    className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between space-y-2 text-xs"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <span className="font-bold text-white text-xs">
                                          {LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType}
                                        </span>
                                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                          {r.startDate} &rarr; {r.endDate} ({daysInMonth} days in {monthDisplayName})
                                        </div>
                                      </div>

                                      <div className="flex items-center space-x-1.5">
                                        <span
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                            r.status === 'approved'
                                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                              : r.status === 'pending'
                                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                          }`}
                                        >
                                          {r.status}
                                        </span>

                                        {onExportPdf && (
                                          <button
                                            type="button"
                                            onClick={() => onExportPdf(r)}
                                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition"
                                            title="Export Official Authorization Form"
                                          >
                                            <Printer className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {r.comments && (
                                      <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded text-[11px] text-slate-300 italic">
                                        "{r.comments}"
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                                      <span>
                                        Shift: <strong>{r.shiftType === 'ALL' ? 'Full Day' : r.shiftType}</strong>
                                      </span>
                                      <span>
                                        Coverage: {r.coverageAssigned ? (
                                          <strong className="text-blue-400">Assigned</strong>
                                        ) : (
                                          <strong className="text-amber-400">Pending</strong>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* High-Fidelity Landscape A4 Print & PDF Preview Modal */}
      {showPrintModal &&
        createPortal(
          <div
            id="timeoff-monthly-report-portal"
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-start print:p-0 print:bg-white print:static print:inset-auto"
          >
            {/* Top Floating Control Bar (Hidden when printing via .no-print) */}
            <div className="no-print w-full max-w-[1140px] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 sticky top-2 z-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Monthly Time Off Statistical Report</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Landscape A4
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {monthDisplayName} ({monthStartStr} &rarr; {monthEndStr}) • {totalPersons} staff members • {totalDaysAll} total days
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={handleDownloadMonthlyPdf}
                  disabled={isExportingPdf}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-2 transition disabled:opacity-50"
                  title="Download vector PDF document"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-lg shadow-amber-500/20 cursor-pointer"
                  title="Open system print dialog"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  disabled={isExportingPdf}
                  className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 hover:border-rose-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-sm active:scale-95 cursor-pointer ml-1"
                  title="Close Preview (Esc)"
                >
                  <X className="w-4 h-4 text-rose-300" />
                  <span>Close</span>
                  <span className="hidden sm:inline-block ml-0.5 text-[10px] font-mono px-1.5 py-0.2 bg-rose-950/60 rounded border border-rose-400/30 text-rose-200">
                    Esc
                  </span>
                </button>
              </div>
            </div>

            {/* Printable A4 Landscape Paper Sheet */}
            <div
              ref={printSheetRef}
              id="timeoff-monthly-print-sheet"
              className="w-full max-w-[1140px] bg-white text-slate-900 p-8 shadow-2xl rounded-xl border border-slate-200 mx-auto font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:rounded-none"
            >
              {/* Header with PCY Tech Brand */}
              <div className="border-b-2 border-slate-900 pb-5 mb-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    {/* PCY Tech Redesigned Brand Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-slate-950 p-1 flex-shrink-0 shadow-md border border-amber-500/50 flex items-center justify-center overflow-hidden">
                      <img
                        src={PCY_TECH_LOGO_DATA_URL}
                        alt="PCY Tech"
                        className="w-full h-full object-cover rounded-xl"
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-black tracking-tight text-slate-950 font-mono">
                          PCY TECH
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 rounded uppercase tracking-wider">
                          Fleet Cloud
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-600 tracking-wider uppercase mt-0.5">
                        School Bus Fleet Operations &amp; Dispatch Systems
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Official Monthly Staff Absence &amp; Attendance Audit Record
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-slate-900 tracking-tight uppercase">
                      Monthly Time Off Statistical Report
                    </div>
                    <div className="text-xs font-bold text-amber-600 font-mono mt-0.5">
                      {monthDisplayName}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      Period: {monthStartStr} ~ {monthEndStr} • Generated: {new Date().toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Sub-header meta */}
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                  <div>
                    Filter Scope:{' '}
                    <strong className="text-slate-900 font-bold uppercase">
                      {statusFilter === 'approved' ? 'Approved Requests Only' : statusFilter === 'pending' ? 'Pending Approval' : 'All Request Statuses'}
                    </strong>
                    {' • '}
                    Roles:{' '}
                    <strong className="text-slate-900 font-bold">
                      {roleFilter === 'all' ? 'All Roles' : roleFilter === 'driver' ? 'Drivers' : 'Attendants'}
                    </strong>
                  </div>
                  <div>
                    System Platform:{' '}
                    <strong className="text-slate-900 font-bold font-mono">
                      PCY Tech Fleet Cloud Operations
                    </strong>
                  </div>
                </div>
              </div>

              {/* KPI Summary Stat Cards */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Staff on Leave
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono mt-1">
                    {totalPersons}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Active staff count</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Total Leave Days
                  </div>
                  <div className="text-xl font-black text-amber-600 font-mono mt-1">
                    {totalDaysAll} <span className="text-xs font-semibold">days</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Sum of all shifts</div>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Approved Days
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono mt-1">
                    {approvedDaysAll} <span className="text-xs font-semibold">days</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">HR Authorized</div>
                </div>

                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg">
                  <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Pending Days
                  </div>
                  <div className="text-xl font-black text-amber-700 font-mono mt-1">
                    {pendingDaysAll} <span className="text-xs font-semibold">days</span>
                  </div>
                  <div className="text-[10px] text-amber-600 mt-0.5">Under Review</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Avg Days / Person
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono mt-1">
                    {avgDaysPerPerson} <span className="text-xs font-semibold">days</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Per absent employee</div>
                </div>
              </div>

              {/* Leave Type Category Summary Pills */}
              <div className="mb-5 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                  Leave Category Totals:
                </span>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                  <span className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800">
                    Vacation: <strong>{categoryBreakdown['vacation'] || 0}d</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800">
                    Sick Leave: <strong>{categoryBreakdown['sick_leave'] || 0}d</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800">
                    Personal Days: <strong>{categoryBreakdown['personal_days'] || 0}d</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800">
                    Bereavement &amp; Other:{' '}
                    <strong>
                      {(categoryBreakdown['bereavement_leave'] || 0) +
                        (categoryBreakdown['jury_duty'] || 0) +
                        (categoryBreakdown['aboriginal_practices'] || 0) +
                        (categoryBreakdown['other'] || 0)}
                      d
                    </strong>
                  </span>
                </div>
              </div>

              {/* Per-Employee Detailed Breakdown Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 border-r border-slate-200">#</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Employee Name</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Staff ID</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Role</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Yard / Base</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Assigned Route</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-right font-black">Total Days</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center">Vacation</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center">Sick</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center">Personal</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center">Other</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 text-center">Requests</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 text-[11px]">
                    {employeeStatsList.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-8 text-center text-slate-500 italic">
                          No leave records found matching the selected month and filters.
                        </td>
                      </tr>
                    ) : (
                      employeeStatsList.map((stat, idx) => (
                        <tr
                          key={stat.employeeId || idx}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                          style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                        >
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-400 font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                            {stat.employeeName}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-600">
                            {stat.employeeNumber}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 uppercase font-semibold text-[10px]">
                            {stat.role}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                            {stat.yardName}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-700 font-mono">
                            {stat.primaryRoute ? stat.primaryRoute.routeNo : 'Unassigned'}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-right font-black font-mono text-amber-700 bg-amber-50/40">
                            {stat.totalDays}d
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center font-mono">
                            {stat.byCategory['vacation'] ? `${stat.byCategory['vacation']}d` : '-'}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center font-mono">
                            {stat.byCategory['sick_leave'] ? `${stat.byCategory['sick_leave']}d` : '-'}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center font-mono">
                            {stat.byCategory['personal_days'] ? `${stat.byCategory['personal_days']}d` : '-'}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center font-mono">
                            {(stat.byCategory['bereavement_leave'] || 0) +
                              (stat.byCategory['jury_duty'] || 0) +
                              (stat.byCategory['aboriginal_practices'] || 0) +
                              (stat.byCategory['other'] || 0) > 0
                              ? `${
                                  (stat.byCategory['bereavement_leave'] || 0) +
                                  (stat.byCategory['jury_duty'] || 0) +
                                  (stat.byCategory['aboriginal_practices'] || 0) +
                                  (stat.byCategory['other'] || 0)
                                }d`
                              : '-'}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center font-mono font-bold">
                            {stat.totalRequests}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                stat.approvedDays > 0 && stat.pendingDays === 0
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : stat.pendingDays > 0
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-slate-100 text-slate-800 border border-slate-300'
                              }`}
                            >
                              {stat.approvedDays > 0 && stat.pendingDays === 0
                                ? 'Approved'
                                : stat.pendingDays > 0
                                ? 'Pending'
                                : 'Reviewed'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {employeeStatsList.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-200/80 font-bold border-t-2 border-slate-400 text-slate-900 text-[11px]">
                        <td colSpan={6} className="py-2.5 px-3 border-r border-slate-300 uppercase tracking-wider">
                          TOTAL ({totalPersons} Staff Members)
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-300 text-right font-black font-mono text-amber-900 bg-amber-100/60">
                          {totalDaysAll}d
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono">
                          {categoryBreakdown['vacation'] || 0}d
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono">
                          {categoryBreakdown['sick_leave'] || 0}d
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono">
                          {categoryBreakdown['personal_days'] || 0}d
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono">
                          {(categoryBreakdown['bereavement_leave'] || 0) +
                            (categoryBreakdown['jury_duty'] || 0) +
                            (categoryBreakdown['aboriginal_practices'] || 0) +
                            (categoryBreakdown['other'] || 0)}
                          d
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-300 text-center font-mono">
                          {employeeStatsList.reduce((acc, curr) => acc + curr.totalRequests, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[10px] text-slate-600 font-mono">
                          {approvedDaysAll}d Appr / {pendingDaysAll}d Pend
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Sign-off & Audit Certification Footer */}
              <div
                className="mt-6 pt-5 border-t-2 border-slate-300 text-xs text-slate-700"
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                      Prepared By (Dispatch Operations)
                    </div>
                    <div className="border-b border-slate-400 pb-1 text-xs font-semibold text-slate-900">
                      PCY Tech Fleet Dispatch Department
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Date: {new Date().toLocaleDateString()}</div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                      Human Resources Sign-Off
                    </div>
                    <div className="border-b border-slate-400 pb-1 text-xs text-slate-400 italic">
                      Signature / Approval Code
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Date: ________________________</div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                      Fleet Operations Director
                    </div>
                    <div className="border-b border-slate-400 pb-1 text-xs text-slate-400 italic">
                      Signature / Approval Code
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Date: ________________________</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3 border-t border-slate-200">
                  <div className="flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Official Certified Company Record • PCY Tech Fleet Operations Platform</span>
                  </div>
                  <div className="font-mono">
                    CONFIDENTIAL • FOR INTERNAL PAYROLL &amp; OPERATIONS AUDIT ONLY
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
