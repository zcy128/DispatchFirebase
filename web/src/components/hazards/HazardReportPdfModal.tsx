import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  AlertTriangle,
  Loader2,
  Clock,
  Bus,
  User,
  MapPin,
  Phone,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { HazardReport } from '../../types/hazardReport';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';

interface HazardReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: HazardReport | null;
  allReports?: HazardReport[];
}

export const HazardReportPdfModal: React.FC<HazardReportPdfModalProps> = ({
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

  const handleDownloadPdf = async () => {
    if (isExportingRef.current || isExporting) return;
    if (!formRef.current) return;

    isExportingRef.current = true;
    setIsExporting(true);

    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const element = formRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const clonedForm = clonedDoc.getElementById('hazard-report-printable-sheet');
          if (clonedForm) {
            clonedForm.style.boxShadow = 'none';
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
        format: 'a4',
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

      const cleanReporter = (currentReport.reportedBy || 'Staff').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = currentReport.eventTime ? currentReport.eventTime.slice(0, 10) : currentReport.createdAt.slice(0, 10);
      const filename = `PCY_Tech_Hazard_Report_${cleanReporter}_${dateStr}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate Hazard Report PDF:', err);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const reportCode = `HZ-REP-${currentReport.unitNumber || 'BUS'}-${currentReport.id ? currentReport.id.substring(0, 6).toUpperCase() : '001'}`;

  const eventDateStr = currentReport.eventTime
    ? currentReport.eventTime.replace('T', ' ').slice(0, 16)
    : currentReport.createdAt.replace('T', ' ').slice(0, 16);

  // Status mapping
  const statusLabel =
    currentReport.statusInt === 2
      ? 'Resolved'
      : currentReport.statusInt === 1
      ? 'Investigating'
      : 'Open / Pending';

  return createPortal(
    <div
      id="hazard-report-print-portal"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-start print:p-0 print:bg-white print:static print:inset-auto"
    >
      {/* Top Floating Control Bar */}
      <div className="no-print w-full max-w-[840px] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 sticky top-2 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Hazard Report PDF Export</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                A4 Official Form
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {currentReport.reportedBy || 'Staff'} • Unit #{currentReport.unitNumber || 'N/A'} • {eventDateStr}
            </p>
          </div>
        </div>

        {allReports.length > 1 && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Record:</span>
            <select
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 max-w-[210px] truncate"
            >
              {allReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.reportedBy || 'Staff'} ({r.unitNumber ? `Bus #${r.unitNumber}` : 'General'}) - #{r.id.slice(-5)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isExporting}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-semibold text-xs rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
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

      {/* Printable Document Sheet (A4 Portrait Container 794x1123) */}
      <div className="w-full flex justify-center pb-8 print:p-0">
        <div
          ref={formRef}
          id="hazard-report-printable-sheet"
          className="bg-white text-slate-900 shadow-2xl text-xs font-sans flex flex-col justify-between relative print:shadow-none print:m-0"
          style={{
            width: '794px',
            minHeight: '1123px',
            height: '1123px',
            padding: '34px 40px',
            boxSizing: 'border-box',
          }}
        >
          {/* Main Top Content Area */}
          <div className="space-y-3.5">
            {/* Header: Company Brand & Official Title */}
            <div className="flex items-start justify-between pb-3 border-b-2 border-slate-900">
              <div className="flex items-center space-x-3.5">
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
                      Fleet HSE
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-widest mt-0.5">
                    School Bus Fleet Health, Safety &amp; Environment
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Hazard Identification, Near Miss &amp; Close Call Investigation Form
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                <span className="text-base font-black text-amber-950 tracking-tight uppercase flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 inline" />
                  HAZARD REPORT
                </span>
                <span className="text-xs font-mono text-slate-600 mt-0.5">
                  File #: <strong className="text-slate-900 font-bold">{reportCode}</strong>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Recorded: {eventDateStr}
                </span>

                <div className="mt-1.5">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      currentReport.statusInt === 2
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                        : currentReport.statusInt === 1
                        ? 'bg-blue-100 text-blue-800 border-blue-400'
                        : 'bg-amber-100 text-amber-800 border-amber-400'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 1: Staff, Vehicle & Event Metadata */}
            <div className="grid grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Reported By (Staff)
                </span>
                <span className="text-sm font-black text-slate-900 flex items-center gap-1 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                  {currentReport.reportedBy || 'Staff Member'}
                </span>
                <span className="text-[11px] text-slate-500 block font-mono">
                  ID: {currentReport.reportedByEmployeeId || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Vehicle Unit #
                </span>
                <span className="text-xs font-black text-slate-900 font-mono flex items-center gap-1 mt-0.5">
                  <Bus className="w-3.5 h-3.5 text-amber-600" />
                  {currentReport.unitNumber ? `Unit #${currentReport.unitNumber}` : 'General / Facility'}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  Route: {currentReport.routeName || currentReport.routeId || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Supervisor Contact
                </span>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                  {currentReport.supervisor || 'Operations Dispatch'}
                </span>
                <span className="text-[11px] text-slate-500 block flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {currentReport.phone || 'Fleet Line'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Person(s) Involved
                </span>
                <span className="text-xs font-bold text-slate-900 block mt-0.5 truncate">
                  {currentReport.personInvolved || 'Driver / Lone Worker'}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  Witnesses: {currentReport.witnesses || 'None reported'}
                </span>
              </div>
            </div>

            {/* Event Location & Timestamp */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="font-bold text-slate-700">Location of Event / Condition:</span>
                <span className="text-slate-900">{currentReport.eventLocation || 'Terminal Yard / En Route'}</span>
              </div>
              <div className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> {eventDateStr}
              </div>
            </div>

            {/* Section 2: Hazard Type & Close Call Two-Column Checklist */}
            <div className="grid grid-cols-2 gap-3">
              {/* Type of Hazard */}
              <div className="p-3 bg-amber-50/40 border border-amber-200 rounded-xl space-y-1.5">
                <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider block border-b border-amber-200 pb-1">
                  Type of Hazard Identified
                </span>
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.trippingHazard ? 'bg-amber-200/70 border-amber-400 font-bold text-amber-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.trippingHazard ? '☑' : '☐'}</span>
                    <span>Tripping / Slip Hazard</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.trafficHazard ? 'bg-amber-200/70 border-amber-400 font-bold text-amber-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.trafficHazard ? '☑' : '☐'}</span>
                    <span>Traffic / Roadway</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.equipmentHazard ? 'bg-amber-200/70 border-amber-400 font-bold text-amber-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.equipmentHazard ? '☑' : '☐'}</span>
                    <span>Equipment / Vehicle</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.performanceHazard ? 'bg-amber-200/70 border-amber-400 font-bold text-amber-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.performanceHazard ? '☑' : '☐'}</span>
                    <span>Performance / Handling</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.snowHazard ? 'bg-amber-200/70 border-amber-400 font-bold text-amber-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.snowHazard ? '☑' : '☐'}</span>
                    <span>Snow / Ice Conditions</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.spillHazard ? 'bg-amber-200/70 border-amber-400 font-bold text-amber-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.spillHazard ? '☑' : '☐'}</span>
                    <span>Spill / Chemical Fluid</span>
                  </div>
                </div>
                {currentReport.otherHazard && (
                  <div className="text-[10px] text-amber-900 font-medium pt-0.5">
                    ✓ Other Unclassified Hazard Flagged
                  </div>
                )}
              </div>

              {/* Type of Close Call / Near Miss */}
              <div className="p-3 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-1.5">
                <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block border-b border-indigo-200 pb-1">
                  Close Call / Near Miss Factors
                </span>
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.unsafeAction ? 'bg-indigo-200/70 border-indigo-400 font-bold text-indigo-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.unsafeAction ? '☑' : '☐'}</span>
                    <span>Unsafe Action</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.unsafeCondition ? 'bg-indigo-200/70 border-indigo-400 font-bold text-indigo-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.unsafeCondition ? '☑' : '☐'}</span>
                    <span>Unsafe Condition</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.happenedtoMe ? 'bg-indigo-200/70 border-indigo-400 font-bold text-indigo-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.happenedtoMe ? '☑' : '☐'}</span>
                    <span>Happened to Me</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.happenedtoSomeone ? 'bg-indigo-200/70 border-indigo-400 font-bold text-indigo-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.happenedtoSomeone ? '☑' : '☐'}</span>
                    <span>Happened to Other</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.ofanarea ? 'bg-indigo-200/70 border-indigo-400 font-bold text-indigo-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.ofanarea ? '☑' : '☐'}</span>
                    <span>Yard / Facility Area</span>
                  </div>
                  <div className={`p-1.5 rounded flex items-center gap-1.5 border ${currentReport.ofEquipment ? 'bg-indigo-200/70 border-indigo-400 font-bold text-indigo-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span>{currentReport.ofEquipment ? '☑' : '☐'}</span>
                    <span>Bus Equipment</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Event Description Narrative */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Event Description &amp; Circumstances
              </span>
              <div className="p-3 bg-white border border-slate-300 rounded-lg text-xs leading-relaxed text-slate-800 min-h-[85px] whitespace-pre-wrap font-sans">
                {currentReport.eventDescription || 'No description entered.'}
              </div>
            </div>

            {/* Reporter Suggestion */}
            {currentReport.suggestion && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                  Reporter's Suggested Preventative Action
                </span>
                <p className="text-slate-800 text-[11px] italic">
                  "{currentReport.suggestion}"
                </p>
              </div>
            )}

            {/* Section 4: Risk Evaluation (Safety & Dispatch Investigation) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Evaluation of Risk Potential (HSE Safety Review)
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Severity */}
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">
                    POTENTIAL SEVERITY:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${currentReport.serious ? 'bg-rose-100 text-rose-800 border-rose-400' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {currentReport.serious ? '✓ Serious' : 'Serious'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${currentReport.moderate ? 'bg-amber-100 text-amber-800 border-amber-400' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {currentReport.moderate ? '✓ Moderate' : 'Moderate'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${currentReport.minor ? 'bg-emerald-100 text-emerald-800 border-emerald-400' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {currentReport.minor ? '✓ Minor' : 'Minor'}
                    </span>
                  </div>
                </div>

                {/* Recurrence Probability */}
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">
                    PROBABILITY OF RECURRENCE:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${currentReport.probableRecurrence ? 'bg-rose-100 text-rose-800 border-rose-400' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {currentReport.probableRecurrence ? '✓ Probable' : 'Probable'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${currentReport.occasional ? 'bg-amber-100 text-amber-800 border-amber-400' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {currentReport.occasional ? '✓ Occasional' : 'Occasional'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${currentReport.rare ? 'bg-emerald-100 text-emerald-800 border-emerald-400' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                      {currentReport.rare ? '✓ Rare' : 'Rare'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Taken & Assigned To */}
              <div className="pt-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">Investigating Assignee:</span>
                  <span className="font-bold text-slate-800">{currentReport.assignedTo || 'Unassigned'}</span>
                  {currentReport.officeHazardType && (
                    <span className="ml-2 text-[11px] text-slate-500">({currentReport.officeHazardType})</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">Action Implemented:</span>
                  <span className="text-slate-800">{currentReport.actionTaken || 'Review & Corrective Action in Progress'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Formal Sign-off */}
          <div className="pt-3 border-t-2 border-slate-900 mt-2">
            <div className="grid grid-cols-3 gap-6 text-[10px]">
              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  {currentReport.reportedBy}
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">Reporting Employee Signature</div>
                <div className="text-slate-500 text-[9px] font-mono">Date: {eventDateStr.slice(0, 10)}</div>
              </div>

              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  {currentReport.safetySignedBy || currentReport.assignedTo || ''}
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">Designated Safety Officer</div>
                <div className="text-slate-500 text-[9px] font-mono">
                  Date: {currentReport.safetySignedDate || '_______________'}
                </div>
              </div>

              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  PCY Tech Fleet HSE Committee
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">Operations Safety Manager Sign-off</div>
                <div className="text-slate-500 text-[9px] font-mono">
                  Audit Date: {new Date().toISOString().split('T')[0]}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 text-[9px] text-slate-400">
              <span>PCY TECH FLEET CLOUD • OCCUPATIONAL HEALTH &amp; SAFETY AUDIT TRAIL</span>
              <span>CONFIDENTIAL - INTERNAL FLEET SAFETY ARCHIVE</span>
              <span className="font-mono">PAGE 1 OF 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
