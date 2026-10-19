import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  FileText,
  Bus,
  ShieldCheck,
  User,
  Calendar,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { TimeOffRequest, LEAVE_TYPE_LABELS } from '../../types/timeOff';
import { Employee } from '../../types/employee';
import { BusRoute } from '../../types/route';
import { safeFormatDate, getLocalTodayString } from '../../utils/dateUtils';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';

interface TimeOffPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TimeOffRequest | null;
  allRequests?: TimeOffRequest[];
  employees: Employee[];
  routes: BusRoute[];
}

export const TimeOffPdfModal: React.FC<TimeOffPdfModalProps> = ({
  isOpen,
  onClose,
  request,
  allRequests = [],
  employees,
  routes
}) => {
  const [selectedRequestId, setSelectedRequestId] = useState<string>(
    request?.id || (allRequests.length > 0 ? allRequests[0].id : '')
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const isExportingRef = useRef<boolean>(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExportingRef.current) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentRequest =
    allRequests.find((r) => r.id === selectedRequestId) || request || allRequests[0];

  if (!currentRequest) return null;

  // Find linked employee and primary route
  const employee = employees.find(
    (e) => e.id === currentRequest.employeeId || e.employeeNumber === currentRequest.employeeId
  );
  const primaryRoute = routes.find(
    (r) => r.driverId === currentRequest.employeeId || r.attendantId === currentRequest.employeeId
  );

  // Calculate day difference
  const calculateDays = (start: string, end: string) => {
    try {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  };
  const totalDays = calculateDays(currentRequest.startDate, currentRequest.endDate);

  // PDF Generation with html2canvas and jsPDF (A4 portrait)
  const handleDownloadPdf = async () => {
    if (isExportingRef.current || isExporting) return;
    if (!formRef.current) return;

    // Immediately lock synchronously to avoid multiple rapid clicks
    isExportingRef.current = true;
    setIsExporting(true);

    // Yield to the browser event loop so React immediately paints the loading button state
    await new Promise((resolve) => setTimeout(resolve, 60));

    try {
      const element = formRef.current;
      const width = 794;
      const height = 1123;

      const canvas = await html2canvas(element, {
        scale: 2, // 2x crisp resolution for printing
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: width,
        height: height,
        windowWidth: 1024,
        windowHeight: 1400,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: (clonedDoc) => {
          const clonedPortal = clonedDoc.getElementById('timeoff-print-portal');
          if (clonedPortal) {
            clonedPortal.style.position = 'static';
            clonedPortal.style.overflow = 'visible';
            clonedPortal.style.height = 'auto';
            clonedPortal.style.maxHeight = 'none';
            clonedPortal.style.padding = '0';
          }
          const clonedForm = clonedDoc.getElementById('timeoff-printable-sheet');
          if (clonedForm) {
            clonedForm.style.transform = 'none';
            clonedForm.style.overflow = 'visible';
            clonedForm.style.margin = '0';
            clonedForm.style.boxShadow = 'none';
            clonedForm.style.border = 'none';
            clonedForm.style.borderRadius = '0';
            clonedForm.style.width = '794px';
            clonedForm.style.height = '1123px';
            clonedForm.style.minHeight = '1123px';
            clonedForm.style.maxHeight = '1123px';
          }
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
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4' // 210mm x 297mm
      });

      // Map 794x1123 full canvas onto standard 210x297mm A4 sheet (built-in padding provides margins)
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

      const cleanEmpName = (currentRequest.employeeName || 'Staff').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `PCY_Tech_TimeOff_Form_${cleanEmpName}_${currentRequest.startDate}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF form:', err);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div
      id="timeoff-print-portal"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-start print:p-0 print:bg-white print:static print:inset-auto"
    >
      {/* Top Floating Control Bar (Hidden when printing via .no-print) */}
      <div className="no-print w-full max-w-[840px] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 sticky top-2 z-10">
        {/* Left: Info & Selector */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Time Off Form PDF Export</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                A4 Official Form
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {currentRequest.employeeName} • {currentRequest.startDate} to {currentRequest.endDate}
            </p>
          </div>
        </div>

        {/* Center: Quick Request Switcher (if list is available) */}
        {allRequests.length > 1 && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Record:</span>
            <select
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 max-w-[200px] truncate"
            >
              {allRequests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.employeeName} ({r.startDate}) - {r.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isExporting}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-semibold text-xs rounded-xl flex items-center space-x-1.5 transition border border-slate-700"
            title="Browser Print / Save as PDF"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition shadow-lg ${
              isExporting
                ? 'bg-amber-600/70 text-slate-950 cursor-wait pointer-events-none'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95 cursor-pointer'
            }`}
            title={isExporting ? 'Generating PDF, please wait...' : 'Download PDF File'}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                <span>Download PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 hover:border-rose-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm active:scale-95 cursor-pointer ml-1"
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

      {/* Printable Document Sheet (A4 Portrait Container) */}
      <div className="w-full flex justify-center pb-8 print:p-0">
        <div
          ref={formRef}
          id="timeoff-printable-sheet"
          className="bg-white text-slate-900 shadow-2xl text-sm font-sans flex flex-col justify-between relative print:shadow-none print:m-0"
          style={{
            width: '794px',
            minHeight: '1123px',
            height: '1123px',
            padding: '36px 44px',
            boxSizing: 'border-box'
          }}
        >
          {/* Main Top / Center Sections Wrapper */}
          <div className="space-y-4">
        {/* Top Header: Brand Logo & Title */}
        <div className="flex items-start justify-between pb-4 border-b-2 border-slate-900">
          <div className="flex items-center space-x-4">
            {/* New PCY Tech Icon */}
            <div className="w-14 h-14 rounded-2xl bg-slate-950 p-1 flex-shrink-0 shadow-md border border-amber-500/40 flex items-center justify-center overflow-hidden">
              <img
                src={PCY_TECH_LOGO_DATA_URL}
                alt="PCY Tech"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-black tracking-tight text-slate-950">PCY TECH</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 rounded uppercase tracking-wider">
                  Fleet Cloud
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mt-0.5">
                School Bus Fleet Operations &amp; Dispatch Systems
              </p>
              <p className="text-[11px] text-slate-500">
                Official Employee Absence Authorization &amp; Attendance Audit Record
              </p>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <span className="text-base font-extrabold text-slate-900 tracking-tight">
              TIME OFF AUTHORIZATION FORM
            </span>
            <span className="text-xs font-mono text-slate-600 mt-0.5">
              Ref: <span className="font-bold text-slate-900">{currentRequest.id}</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              Issued: {getLocalTodayString()}
            </span>

            {/* Formal Status Stamp Badge */}
            <div className="mt-2">
              {(() => {
                const s = (currentRequest.status || '').toLowerCase();
                let borderColor = '#d97706';
                let bgColor = '#fffbeb';
                let textColor = '#92400e';
                let iconSymbol = '⏱';
                let titleText = 'PENDING HR REVIEW';

                if (s === 'approved') {
                  borderColor = '#059669';
                  bgColor = '#ecfdf5';
                  textColor = '#065f46';
                  iconSymbol = '✓';
                  titleText = 'APPROVED & AUTHORIZED';
                } else if (s === 'rejected') {
                  borderColor = '#dc2626';
                  bgColor = '#fef2f2';
                  textColor = '#991b1b';
                  iconSymbol = '✕';
                  titleText = 'REQUEST REJECTED';
                } else if (s === 'cancelled') {
                  borderColor = '#64748b';
                  bgColor = '#f8fafc';
                  textColor = '#334155';
                  iconSymbol = '—';
                  titleText = 'REQUEST CANCELLED';
                }

                return (
                  <div
                    style={{
                      display: 'inline-block',
                      border: `2px solid ${borderColor}`,
                      backgroundColor: bgColor,
                      color: textColor,
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontWeight: 800,
                      fontSize: '11px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      lineHeight: '1.4'
                    }}
                  >
                    <span style={{ marginRight: '6px', fontWeight: 900 }}>{iconSymbol}</span>
                    <span>{titleText}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Section 1: Employee Information */}
        <div className="mt-3.5">
          <div className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-t-md flex items-center space-x-2">
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span>1. Employee &amp; Assignment Identification</span>
          </div>
          <div className="border border-slate-300 border-t-0 rounded-b-md p-3 bg-slate-50/60 grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4 text-xs">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Employee Full Name
              </span>
              <span className="font-bold text-slate-900 text-sm">{currentRequest.employeeName}</span>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Employee ID / Badge #
              </span>
              <span className="font-mono font-bold text-slate-900">
                {currentRequest.employeeNumber || employee?.employeeNumber || 'N/A'}
              </span>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Job Classification
              </span>
              <span className="font-semibold text-slate-800 capitalize">
                {employee?.role === 'driver'
                  ? 'School Bus Driver'
                  : employee?.role === 'attendant'
                  ? 'Bus Safety Attendant'
                  : employee?.role || 'Driver / Attendant'}
              </span>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Primary Assigned Route
              </span>
              <span className="font-semibold text-slate-800 flex items-center space-x-1">
                <Bus className="w-3 h-3 text-amber-600 inline mr-0.5" />
                <span>
                  {primaryRoute
                    ? `${primaryRoute.routeNo} (${primaryRoute.routeName})`
                    : 'Unassigned / Relief Pool'}
                </span>
              </span>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Home Operations Yard
              </span>
              <span className="font-semibold text-slate-800">
                {primaryRoute?.yardName || employee?.yardId || 'Main Transportation Terminal'}
              </span>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Contact Phone
              </span>
              <span className="font-mono text-slate-800">
                {employee?.mobilePhone || employee?.preferredPhone || employee?.homePhone || 'On File'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Leave & Absence Specifications */}
        <div className="mt-3.5">
          <div className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-t-md flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>2. Leave &amp; Absence Specifications</span>
          </div>
          <div className="border border-slate-300 border-t-0 rounded-b-md p-3 bg-slate-50/60 space-y-2.5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2.5 gap-x-4">
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                  Leave Category
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {LEAVE_TYPE_LABELS[currentRequest.leaveType] || currentRequest.leaveType}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                  Coverage Dates
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {currentRequest.startDate} <span className="text-slate-400">&rarr;</span>{' '}
                  {currentRequest.endDate}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                  Total Duration
                </span>
                <span className="font-bold text-slate-900">
                  {totalDays} Calendar Day{totalDays > 1 ? 's' : ''}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                  Shift(s) Requested Off
                </span>
                <span className="font-semibold text-slate-900 px-2 py-0.5 rounded bg-slate-200 text-[11px] inline-block mt-0.5">
                  {currentRequest.shiftType === 'ALL'
                    ? 'Full Day (AM & PM)'
                    : `${currentRequest.shiftType} Only`}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Reason &amp; Employee Notes
              </span>
              <div className="p-2 bg-white border border-slate-200 rounded text-slate-800 text-xs italic min-h-[36px]">
                {currentRequest.comments ? `"${currentRequest.comments}"` : 'None specified.'}
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-500 pt-0.5">
              <span>
                Submitted on: <strong>{safeFormatDate(currentRequest.createdAt)}</strong>
              </span>
              {currentRequest.requestedByName && (
                <span>
                  Submitted by: <strong>{currentRequest.requestedByName}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Dispatch Operations & Shift Coverage */}
        <div className="mt-3.5">
          <div className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-t-md flex items-center space-x-2">
            <Bus className="w-3.5 h-3.5 text-amber-400" />
            <span>3. Dispatch Operations &amp; Shift Coverage</span>
          </div>
          <div className="border border-slate-300 border-t-0 rounded-b-md p-3 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Coverage Status
              </span>
              <span className="font-bold text-slate-900">
                {currentRequest.coverageAssigned ? (
                  <span className="text-blue-700 font-bold">&bull; Replacement Driver Arranged</span>
                ) : currentRequest.status === 'approved' ? (
                  <span className="text-amber-700 font-bold">&bull; Coverage Required / Pending Openings</span>
                ) : (
                  <span className="text-slate-500">&bull; Not applicable</span>
                )}
              </span>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Dispatch Action Taken
              </span>
              <span className="text-slate-800">
                {currentRequest.coverageAssigned
                  ? `Assigned on ${safeFormatDate(currentRequest.coverageAssignedAt || currentRequest.updatedAt)}`
                  : 'Pending dispatch review / bulletin'}
              </span>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                Dispatch Planning Horizon
              </span>
              <span className="text-slate-800">
                Daily dispatch generated at 2:00 PM prior workday
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Management & HR Authorization */}
        <div className="mt-3.5">
          <div className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-t-md flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>4. Human Resources &amp; Management Decision</span>
          </div>
          <div className="border border-slate-300 border-t-0 rounded-b-md p-3 bg-slate-50/60 space-y-2.5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                  Decision Status
                </span>
                <span className="font-bold uppercase text-xs">
                  {currentRequest.status === 'approved' ? (
                    <span className="text-emerald-700 font-extrabold">&bull; APPROVED</span>
                  ) : currentRequest.status === 'pending' ? (
                    <span className="text-amber-700 font-extrabold">&bull; PENDING REVIEW</span>
                  ) : currentRequest.status === 'rejected' ? (
                    <span className="text-rose-700 font-extrabold">&bull; REJECTED</span>
                  ) : (
                    <span className="text-slate-600 font-extrabold">&bull; CANCELLED</span>
                  )}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                  Reviewer Name
                </span>
                <span className="font-bold text-slate-900">
                  {currentRequest.approvedByName || (currentRequest.status === 'approved' ? 'HR Administrator' : 'Pending Review')}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                  Decision Date
                </span>
                <span className="font-mono text-slate-900">
                  {currentRequest.approvedAt ? safeFormatDate(currentRequest.approvedAt) : 'Awaiting Decision'}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                  Applicant Notified Via
                </span>
                <span className="font-medium text-slate-800">
                  {currentRequest.notifiedChannels && currentRequest.notifiedChannels.length > 0
                    ? currentRequest.notifiedChannels.map((c) => c.toUpperCase()).join(' & ')
                    : 'System Notification'}
                </span>
              </div>
            </div>

            {currentRequest.approvalNotes && (
              <div className="pt-2 border-t border-slate-200">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  HR Reviewer Notes &amp; Conditions
                </span>
                <div className="p-2 bg-white border border-slate-200 rounded text-slate-800 italic">
                  "{currentRequest.approvalNotes}"
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Authorization Signatures */}
        <div className="mt-3.5 pt-3 border-t-2 border-slate-300">
          <span className="block text-xs font-extrabold uppercase text-slate-900 mb-2 tracking-wider">
            5. Official Authorizations &amp; Signatures
          </span>
          <div className="grid grid-cols-3 gap-6 text-xs text-slate-600">
            {/* Signature Box 1 */}
            <div className="flex flex-col justify-end">
              <div className="border-b-2 border-slate-400 pb-1 mb-1.5 h-8 flex items-end">
                <span className="font-serif italic text-slate-900 text-sm pl-2">
                  {currentRequest.employeeName}
                </span>
              </div>
              <span className="font-bold text-slate-900 text-[11px]">Employee Signature</span>
              <span className="text-[10px] text-slate-500">
                Date: {safeFormatDate(currentRequest.createdAt)}
              </span>
            </div>

            {/* Signature Box 2 */}
            <div className="flex flex-col justify-end">
              <div className="border-b-2 border-slate-400 pb-1 mb-1.5 h-8 flex items-end">
                <span className="font-serif italic text-slate-900 text-sm pl-2">
                  PCY Operations Dispatch
                </span>
              </div>
              <span className="font-bold text-slate-900 text-[11px]">
                Operations Dispatcher Signature
              </span>
              <span className="text-[10px] text-slate-500">
                Date: {safeFormatDate(currentRequest.coverageAssignedAt || currentRequest.updatedAt)}
              </span>
            </div>

            {/* Signature Box 3 */}
            <div className="flex flex-col justify-end">
              <div className="border-b-2 border-slate-400 pb-1 mb-1.5 h-8 flex items-end">
                {currentRequest.status === 'approved' && (
                  <span className="font-serif italic text-emerald-800 text-sm pl-2 font-bold">
                    {currentRequest.approvedByName || 'Authorized by HR'}
                  </span>
                )}
              </div>
              <span className="font-bold text-slate-900 text-[11px]">
                HR / General Manager Authorization
              </span>
              <span className="text-[10px] text-slate-500">
                Date: {safeFormatDate(currentRequest.approvedAt || currentRequest.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Official Document Footer & Legal Audit Trail (Pinned to Bottom of A4) */}
      <div className="mt-auto pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
        <div>
          <span className="font-mono font-bold text-slate-700">
            *PCY-FLEET-{(currentRequest.id || '').toUpperCase()}*
          </span>
          <p className="mt-0.5">
            Certified digital attendance record generated via PCY Tech Fleet Operations Platform.
          </p>
        </div>
        <div className="text-right">
          <span>Confidential &bull; Student Transportation Operations</span>
          <p className="font-mono mt-0.5">Page 1 of 1</p>
        </div>
      </div>
    </div>
  </div>

  {/* High-fidelity A4 Print Styles */}
  <style
    dangerouslySetInnerHTML={{
      __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: white !important;
          }
          #timeoff-print-portal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          #timeoff-printable-sheet {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      `
    }}
  />
</div>,
document.body
);
};
