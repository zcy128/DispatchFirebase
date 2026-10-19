import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  Wrench,
  Bus,
  CheckCircle2,
  AlertTriangle,
  User,
  MapPin,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  VehicleDefectReport,
  DEFECT_STATUS_LABELS,
} from '../../types/defect';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';

interface VehicleDefectPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: VehicleDefectReport | null;
  allReports?: VehicleDefectReport[];
}

export const VehicleDefectPdfModal: React.FC<VehicleDefectPdfModalProps> = ({
  isOpen,
  onClose,
  report,
  allReports = [],
}) => {
  const [selectedReportId, setSelectedReportId] = useState<string>(
    report?.id || (allReports.length > 0 ? allReports[0].id : '')
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

  const currentReport =
    allReports.find((r) => r.id === selectedReportId) || report || allReports[0];

  if (!currentReport) return null;

  const defectItems = currentReport.items.filter((i) => i.status === 'defect');
  const statusLabel = DEFECT_STATUS_LABELS[currentReport.status] || currentReport.status;

  // PDF Generation with html2canvas and jsPDF (A4 Portrait)
  const handleDownloadPdf = async () => {
    if (isExportingRef.current || isExporting) return;
    if (!formRef.current) return;

    isExportingRef.current = true;
    setIsExporting(true);

    await new Promise((resolve) => setTimeout(resolve, 80));

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
          const clonedPortal = clonedDoc.getElementById('defect-print-portal');
          if (clonedPortal) {
            clonedPortal.style.position = 'static';
            clonedPortal.style.overflow = 'visible';
            clonedPortal.style.height = 'auto';
            clonedPortal.style.maxHeight = 'none';
            clonedPortal.style.padding = '0';
          }
          const clonedForm = clonedDoc.getElementById('defect-printable-sheet');
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
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4', // 210mm x 297mm
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

      const cleanUnit = (currentReport.vehicleUnitNumber || 'Bus').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `PCY_Tech_Defect_Report_Bus_${cleanUnit}_${currentReport.reportDate}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate Defect Report PDF:', err);
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
      id="defect-print-portal"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-start print:p-0 print:bg-white print:static print:inset-auto"
    >
      {/* Top Floating Control Bar (Hidden when printing via .no-print) */}
      <div className="no-print w-full max-w-[840px] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 sticky top-2 z-10">
        {/* Left: Info & Report Selector */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Vehicle Defect Report &amp; Work Order</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Official A4
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Unit #{currentReport.vehicleUnitNumber} • {currentReport.reportedByName} • {currentReport.reportDate}
            </p>
          </div>
        </div>

        {/* Quick Report Switcher */}
        {allReports.length > 1 && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Switch Unit:</span>
            <select
              value={currentReport.id}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 max-w-[200px] truncate"
            >
              {allReports.map((r) => (
                <option key={r.id} value={r.id}>
                  Bus #{r.vehicleUnitNumber} ({r.reportDate}) - {r.status.toUpperCase()}
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
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-semibold text-xs rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            title="Browser Print Work Order"
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

      {/* Printable Document Sheet (A4 Portrait Container 794x1123) */}
      <div className="w-full flex justify-center pb-8 print:p-0">
        <div
          ref={formRef}
          id="defect-printable-sheet"
          className="bg-white text-slate-900 shadow-2xl text-xs font-sans flex flex-col justify-between relative print:shadow-none print:m-0"
          style={{
            width: '794px',
            minHeight: '1123px',
            height: '1123px',
            padding: '34px 42px',
            boxSizing: 'border-box',
          }}
        >
          {/* Main Content Area */}
          <div className="space-y-4">
            {/* Header: Company Brand & Work Order Title */}
            <div className="flex items-start justify-between pb-3.5 border-b-2 border-slate-900">
              <div className="flex items-center space-x-3.5">
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
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-widest mt-0.5">
                    School Bus Fleet Operations &amp; Safety Compliance
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Vehicle Defect Inspection &amp; Maintenance Work Order
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                <span className="text-base font-black text-slate-900 tracking-tight uppercase">
                  DEFECT WORK ORDER
                </span>
                <span className="text-xs font-mono text-slate-600 mt-0.5">
                  Order #: <strong className="text-slate-900 font-bold">WO-DEF-{currentReport.vehicleUnitNumber}-{currentReport.id ? currentReport.id.substring(0, 6).toUpperCase() : '001'}</strong>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Reported: {currentReport.reportDate} {currentReport.reportTime}
                </span>

                {/* Status Stamp */}
                <div className="mt-1.5">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      currentReport.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                        : currentReport.status === 'under_repair'
                        ? 'bg-purple-100 text-purple-800 border-purple-400'
                        : currentReport.status === 'under_assessment'
                        ? 'bg-blue-100 text-blue-800 border-blue-400'
                        : 'bg-amber-100 text-amber-800 border-amber-400'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 1: Vehicle & Inspection Metadata Profile */}
            <div className="grid grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Vehicle Unit #
                </span>
                <span className="text-sm font-black text-slate-900 font-mono flex items-center gap-1 mt-0.5">
                  <Bus className="w-4 h-4 text-amber-600" />
                  Unit #{currentReport.vehicleUnitNumber}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Odometer Reading
                </span>
                <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                  {currentReport.odometer > 0 ? `${currentReport.odometer.toLocaleString()} km` : '—'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Reporting Driver
                </span>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5 truncate">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {currentReport.reportedByName || 'Fleet Operator'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Inspection Confirmation
                </span>
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {currentReport.confirmedAccurate ? 'Driver Verified' : 'Standard Log'}
                </span>
              </div>
            </div>

            {/* Section 2: Flagged Defects & Safety Remarks Alert Box */}
            <div
              className={`p-3.5 rounded-xl border ${
                defectItems.length > 0
                  ? 'bg-red-50/80 border-red-300 text-red-950'
                  : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-current/20">
                <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider">
                  {defectItems.length > 0 ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span className="text-red-900 font-black">
                        Flagged Safety Defect Items ({defectItems.length} Identified)
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-900 font-black">
                        Pre-Trip / Daily Inspection: No Defects Identified
                      </span>
                    </>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold uppercase">
                  {currentReport.noDefectsFound ? 'Certified Pass' : 'Action Required'}
                </span>
              </div>

              {defectItems.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    {defectItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 bg-white/90 border border-red-200 rounded-lg text-xs flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-red-900 text-xs">{item.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-800 border border-red-300">
                            DEFECT
                          </span>
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-red-700 italic mt-1 bg-red-50 p-1 rounded">
                            "{item.notes}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {currentReport.defectNotes && (
                    <div className="mt-2 pt-2 border-t border-red-200 text-xs">
                      <span className="font-bold text-red-900">Driver Explanation / Notes: </span>
                      <span className="italic text-slate-800">"{currentReport.defectNotes}"</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-xs text-emerald-800">
                  Driver inspection conducted in accordance with provincial school bus circle-check standards. All critical safety systems operating within factory specifications.
                </div>
              )}
            </div>

            {/* Section 3: Full 24-Point Inspection Checklist Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 font-bold text-[10px] text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Circle Check System Inspection Checklist</span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {currentReport.items.length} Checked Points
                </span>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-200 p-1">
                {/* Column 1 */}
                <div className="divide-y divide-slate-100 pr-1">
                  {currentReport.items
                    .slice(0, Math.ceil(currentReport.items.length / 2))
                    .map((item) => {
                      const isDefect = item.status === 'defect';
                      const isNA = item.status === 'na';
                      return (
                        <div
                          key={item.id}
                          className="py-1 px-2 flex items-center justify-between text-[11px]"
                        >
                          <span className={`truncate pr-2 ${isDefect ? 'font-bold text-red-800' : 'text-slate-700'}`}>
                            {item.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                              isDefect
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : isNA
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* Column 2 */}
                <div className="divide-y divide-slate-100 pl-1">
                  {currentReport.items
                    .slice(Math.ceil(currentReport.items.length / 2))
                    .map((item) => {
                      const isDefect = item.status === 'defect';
                      const isNA = item.status === 'na';
                      return (
                        <div
                          key={item.id}
                          className="py-1 px-2 flex items-center justify-between text-[11px]"
                        >
                          <span className={`truncate pr-2 ${isDefect ? 'font-bold text-red-800' : 'text-slate-700'}`}>
                            {item.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                              isDefect
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : isNA
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Section 4: Maintenance Assessment & Repair Dispatch Work Order */}
            <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/60 text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-600" />
                  Fleet Maintenance Assessment &amp; Work Dispatch
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  Assessed: {currentReport.assessment?.assessedAt || currentReport.reportDate}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">Assessed By</span>
                  <span className="font-bold text-slate-900 block truncate">
                    {currentReport.assessment?.assessedBy || 'Fleet Maintenance Supervisor'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">Repair Location / Bay</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {currentReport.assessment?.repairLocation || 'Main Maintenance Depot'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">Estimated Schedule</span>
                  <span className="font-mono text-slate-900 block font-semibold text-[11px]">
                    {currentReport.assessment?.estimatedRepairDays ?? 1} days (Due {currentReport.assessment?.estimatedCompletionDate || currentReport.reportDate})
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">Repair Cost / Expense</span>
                  <span className="font-mono font-bold text-emerald-800 text-[11px] block">
                    {currentReport.assessment?.repairCost ? `$${currentReport.assessment.repairCost.toFixed(2)}` : '$0.00'}
                  </span>
                </div>
              </div>

              {/* Assessment / Triage Notes */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                <span className="font-bold text-slate-700">Triage &amp; Inspection Assessment: </span>
                <span className="text-slate-600 italic">
                  {currentReport.assessment?.assessmentNotes || 'Vehicle assessed by shop foreman. Parts ordered and technician assigned.'}
                </span>
              </div>

              {/* Mechanic Work & Parts Replaced Notes */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                <span className="font-bold text-slate-700">Mechanic / Work Completion Notes: </span>
                <span className="text-slate-600 italic">
                  {currentReport.assessment?.mechanicNotes || (currentReport.status === 'resolved' ? 'All required repairs completed and safety operational tests passed.' : 'Pending repair completion and road-test signoff.')}
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Regulatory Compliance & Safety Clearance Sign-Off (Bottom of A4) */}
          <div className="pt-3 border-t-2 border-slate-300 text-xs text-slate-800">
            {/* Safe For Passenger Transport Determination Banner */}
            <div className="mb-3 p-2 rounded-lg border flex items-center justify-between text-[11px] font-bold bg-slate-100 border-slate-300">
              <span className="uppercase tracking-wider text-[10px] text-slate-600">
                Safety Clearance Determination:
              </span>
              <div className="flex items-center space-x-6">
                <span className="flex items-center space-x-1.5">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center font-bold text-[10px] ${currentReport.status === 'resolved' || currentReport.noDefectsFound ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white border-slate-400'}`}>
                    {currentReport.status === 'resolved' || currentReport.noDefectsFound ? '✓' : ''}
                  </span>
                  <span className="text-slate-900 font-bold">PASS: Cleared for Route Service</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center font-bold text-[10px] ${currentReport.status !== 'resolved' && !currentReport.noDefectsFound ? 'bg-red-600 text-white border-red-700' : 'bg-white border-slate-400'}`}>
                    {currentReport.status !== 'resolved' && !currentReport.noDefectsFound ? '✕' : ''}
                  </span>
                  <span className="text-red-900 font-bold">OUT OF SERVICE (Red Tagged)</span>
                </span>
              </div>
            </div>

            {/* Signature Lines */}
            <div className="grid grid-cols-3 gap-6 mb-3">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Driver / Reporting Operator
                </div>
                <div className="border-b border-slate-400 pb-1 font-semibold text-slate-900 text-xs">
                  {currentReport.reportedByName}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Date: {currentReport.reportDate}</div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Certified Mechanic / Technician
                </div>
                <div className="border-b border-slate-400 pb-1 text-slate-400 italic text-xs">
                  {currentReport.assessment?.resolvedBy || 'Signature & Tech License #'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Date: {currentReport.assessment?.actualCompletionDate || '__________________'}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Fleet Safety Supervisor Clearance
                </div>
                <div className="border-b border-slate-400 pb-1 text-slate-400 italic text-xs">
                  {currentReport.assessment?.assessedBy || 'Supervisor Signature / Code'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Date: {currentReport.assessment?.assessedAt?.substring(0, 10) || currentReport.reportDate}
                </div>
              </div>
            </div>

            {/* Official Audit Verification Footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-200">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Certified Official Fleet Maintenance Record • PCY Tech Fleet Operations Platform</span>
              </div>
              <div className="font-mono uppercase">
                Confidential • Provincial Motor Vehicle Safety Standard Compliance
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
