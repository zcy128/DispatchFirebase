import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  ShieldCheck,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  VehicleDefectReport,
  DEFECT_STATUS_LABELS,
} from '../../types/defect';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';

interface VehicleDefectSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: VehicleDefectReport[];
  statusFilter: string;
  searchQuery?: string;
}

export const VehicleDefectSummaryModal: React.FC<VehicleDefectSummaryModalProps> = ({
  isOpen,
  onClose,
  reports,
  statusFilter,
  searchQuery = '',
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const isExportingRef = useRef<boolean>(false);
  const sheetRef = useRef<HTMLDivElement>(null);

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

  const todayStr = new Date().toISOString().split('T')[0];

  // Aggregated Stats
  const totalReports = reports.length;
  const submittedCount = reports.filter((r) => r.status === 'submitted').length;
  const underAssessmentCount = reports.filter((r) => r.status === 'under_assessment').length;
  const underRepairCount = reports.filter((r) => r.status === 'under_repair').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved').length;
  const totalCost = reports.reduce((acc, curr) => acc + (curr.assessment?.repairCost || 0), 0);

  // Landscape A4 PDF Generation
  const handleDownloadPdf = async () => {
    if (isExportingRef.current || isExporting) return;
    if (!sheetRef.current) return;

    isExportingRef.current = true;
    setIsExporting(true);

    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const element = sheetRef.current;
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
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4', // 297mm x 210mm
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

      pdf.save(`PCY_Tech_Fleet_Defect_Summary_${todayStr}.pdf`);
    } catch (err) {
      console.error('Failed to generate Defect Summary PDF:', err);
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
      id="defect-summary-print-portal"
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
              <span>Vehicle Defect Reports Summary</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Landscape A4
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {totalReports} total reports • Filter: {statusFilter.toUpperCase()} • Generated {todayStr}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
            title="Download vector PDF document"
          >
            {isExporting ? (
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
            onClick={handlePrint}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center space-x-1.5 transition shadow-lg shadow-amber-500/20 cursor-pointer"
            title="Open system print dialog"
          >
            <Printer className="w-4 h-4" />
            <span>Print Now</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
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
        ref={sheetRef}
        id="defect-summary-print-sheet"
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
                  School Bus Fleet Operations &amp; Safety Compliance
                </div>
                <div className="text-[11px] text-slate-500">
                  Fleet Defect Reports &amp; Maintenance Status Log
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-base font-black text-slate-900 tracking-tight uppercase">
                Defect Reports Summary
              </div>
              <div className="text-xs font-bold text-amber-600 font-mono mt-0.5">
                Filter: {statusFilter.toUpperCase()} {searchQuery ? `• "${searchQuery}"` : ''}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                Generated: {new Date().toLocaleString()} • Total Units: {totalReports}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Summary Stat Cards */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Total Reports
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-1">
              {totalReports}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Logged defects</div>
          </div>

          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg">
            <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
              Submitted
            </div>
            <div className="text-xl font-black text-amber-700 font-mono mt-1">
              {submittedCount}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">Awaiting triage</div>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg">
            <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
              Under Assessment
            </div>
            <div className="text-xl font-black text-blue-700 font-mono mt-1">
              {underAssessmentCount}
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">Evaluating repair</div>
          </div>

          <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-lg">
            <div className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">
              Under Repair
            </div>
            <div className="text-xl font-black text-purple-700 font-mono mt-1">
              {underRepairCount}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5">In depot shop</div>
          </div>

          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Resolved
            </div>
            <div className="text-xl font-black text-emerald-700 font-mono mt-1">
              {resolvedCount}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Cleared for route</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Total Repair Cost
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-1">
              ${totalCost.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Parts &amp; labour</div>
          </div>
        </div>

        {/* Detailed Defect Reports Breakdown Table */}
        <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3 border-r border-slate-200">#</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Vehicle Unit</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Reported By</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Date / Time</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Odometer</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Flagged Defects</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Driver Notes</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">Status</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Repair Facility</th>
                <th className="py-2.5 px-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 text-[11px]">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 italic">
                    No vehicle defect records match the selected filter.
                  </td>
                </tr>
              ) : (
                reports.map((report, idx) => {
                  const defectItems = report.items.filter((i) => i.status === 'defect');
                  return (
                    <tr
                      key={report.id || idx}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                      style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                    >
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-400 font-mono text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                        Bus #{report.vehicleUnitNumber}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-800 font-medium">
                        {report.reportedByName}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono text-[10px] text-slate-600">
                        {report.reportDate} {report.reportTime}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono text-[10px] text-slate-700">
                        {report.odometer > 0 ? `${report.odometer.toLocaleString()} km` : '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        {defectItems.length === 0 ? (
                          <span className="text-emerald-700 font-semibold text-[10px]">
                            No defects (Pass)
                          </span>
                        ) : (
                          <span className="text-red-700 font-bold text-[10px]">
                            {defectItems.map((d) => d.name).join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 max-w-[160px] truncate italic text-slate-600 text-[10px]" title={report.defectNotes}>
                        {report.defectNotes || '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            report.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : report.status === 'under_repair'
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : report.status === 'under_assessment'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {DEFECT_STATUS_LABELS[report.status] || report.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-700 text-[10px]">
                        {report.assessment?.repairLocation || 'Unassigned'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {report.assessment?.repairCost ? `$${report.assessment.repairCost.toFixed(2)}` : '$0.00'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {reports.length > 0 && (
              <tfoot>
                <tr className="bg-slate-200/80 font-bold border-t-2 border-slate-400 text-slate-900 text-[11px]">
                  <td colSpan={5} className="py-2.5 px-3 border-r border-slate-300 uppercase tracking-wider">
                    TOTAL ({totalReports} Defect Reports)
                  </td>
                  <td colSpan={4} className="py-2.5 px-3 border-r border-slate-300 font-mono text-[10px] text-slate-700">
                    {submittedCount} Subm / {underAssessmentCount} Assmt / {underRepairCount} Repair / {resolvedCount} Resolved
                  </td>
                  <td className="py-2.5 px-3 text-right font-black font-mono text-emerald-900 bg-emerald-100/60">
                    ${totalCost.toFixed(2)}
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
                Fleet Maintenance Supervisor Sign-off
              </div>
              <div className="border-b border-slate-400 pb-1 text-xs text-slate-400 italic">
                Signature / Approval Stamp
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Date: {todayStr}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                Fleet Operations Director Review
              </div>
              <div className="border-b border-slate-400 pb-1 text-xs text-slate-400 italic">
                Signature / Approval Stamp
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Date: ________________________</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                Safety &amp; Compliance Audit Officer
              </div>
              <div className="border-b border-slate-400 pb-1 text-xs text-slate-400 italic">
                Signature / Audit Code
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Date: ________________________</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3 border-t border-slate-200">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Official Certified Fleet Inspection Record • PCY Tech Fleet Operations Platform</span>
            </div>
            <div className="font-mono">
              CONFIDENTIAL • FOR REGULATORY VEHICLE SAFETY AUDIT USE ONLY
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
