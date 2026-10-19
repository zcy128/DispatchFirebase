import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  Navigation,
  Loader2,
  Bus,
  User,
  School,
  Phone,
  Mail,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { RouteAssessment } from '../../types/routeAssessment';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';

interface RouteAssessmentPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: RouteAssessment | null;
  allAssessments?: RouteAssessment[];
}

export const RouteAssessmentPdfModal: React.FC<RouteAssessmentPdfModalProps> = ({
  isOpen,
  onClose,
  assessment,
  allAssessments = [],
}) => {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(
    assessment?.id || (allAssessments.length > 0 ? allAssessments[0].id : '')
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

  const currentAssessment =
    allAssessments.find((a) => a.id === selectedAssessmentId) || assessment || allAssessments[0];

  if (!currentAssessment) return null;

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
          const clonedForm = clonedDoc.getElementById('route-assessment-printable-sheet');
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

      const cleanRoute = (currentAssessment.routeId || 'Route').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = currentAssessment.assessmentDate || currentAssessment.createdAt.slice(0, 10);
      const filename = `PCY_Tech_Route_Assessment_Route_${cleanRoute}_${dateStr}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate Route Assessment PDF:', err);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const reportCode = `RA-AUDIT-${currentAssessment.routeId || 'RT'}-${currentAssessment.id ? currentAssessment.id.substring(0, 6).toUpperCase() : '001'}`;

  const assessmentDateStr = currentAssessment.assessmentDate
    ? currentAssessment.assessmentDate
    : currentAssessment.createdAt.slice(0, 10);

  // 11 Core Assessment Points
  const safetyPoints = [
    {
      title: '1. Visibility & Sightline Problems',
      flagged: currentAssessment.visibilityProblemCheck,
      detail: currentAssessment.visibilityProblem,
    },
    {
      title: '2. Highway / High-Speed Stop Safety',
      flagged: currentAssessment.highwayStopConcernCheck,
      detail: currentAssessment.highwayStopConcern,
    },
    {
      title: '3. Student Loading Location Hazards',
      flagged: currentAssessment.locationProblemCheck,
      detail: currentAssessment.locationProblem,
    },
    {
      title: '4. Turnaround & Backing Safety',
      flagged: currentAssessment.unsafeTurnaroundCheck,
      detail: currentAssessment.unsafeTurnaround,
    },
    {
      title: '5. Dangerous Intersections',
      flagged: currentAssessment.intersectionCheck,
      detail: currentAssessment.intersection,
    },
    {
      title: '6. Roadway Width, Grade & Surface',
      flagged: currentAssessment.roadwayCheck,
      detail: currentAssessment.roadway,
    },
    {
      title: '7. Non-Weather Risks (Trees, Animals, Const.)',
      flagged: currentAssessment.nonweatherRiskCheck,
      detail: currentAssessment.nonweatherRisk,
    },
    {
      title: '8. Severe Weather / Winter Vulnerabilities',
      flagged: currentAssessment.weatherRiskCheck,
      detail: currentAssessment.weatherRisk,
    },
    {
      title: '9. Operating Policy & Safety Rules',
      flagged: !currentAssessment.companyPolicyCheck && !currentAssessment.companyPolicyFamiliar,
      detail: currentAssessment.companyPolicyFamiliar ? 'Driver familiar with all applicable rules.' : 'Review required.',
    },
    {
      title: '10. Route Timing / Stop Adjustments',
      flagged: currentAssessment.routeAdjustCheck,
      detail: currentAssessment.routeAdjust,
    },
    {
      title: '11. General Driver Safety Concerns',
      flagged: currentAssessment.safetyConcernCheck,
      detail: currentAssessment.safetyConcern,
    },
  ];

  const flaggedCount = safetyPoints.filter((p) => p.flagged).length;

  return createPortal(
    <div
      id="route-assessment-print-portal"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-start print:p-0 print:bg-white print:static print:inset-auto"
    >
      {/* Top Floating Control Bar */}
      <div className="no-print w-full max-w-[840px] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 sticky top-2 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Route Assessment PDF Export</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                A4 Official Form
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Route #{currentAssessment.routeId} • Conducted by {currentAssessment.conductedByDriver} • {assessmentDateStr}
            </p>
          </div>
        </div>

        {allAssessments.length > 1 && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Record:</span>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 max-w-[210px] truncate"
            >
              {allAssessments.map((a) => (
                <option key={a.id} value={a.id}>
                  Route #{a.routeId} ({a.assessmentDate || a.createdAt.slice(0, 10)}) - {a.statusStr}
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
          id="route-assessment-printable-sheet"
          className="bg-white text-slate-900 shadow-2xl text-xs font-sans flex flex-col justify-between relative print:shadow-none print:m-0"
          style={{
            width: '794px',
            minHeight: '1123px',
            height: '1123px',
            padding: '34px 40px',
            boxSizing: 'border-box',
          }}
        >
          {/* Main Content Area */}
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
                      Fleet Routing
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-widest mt-0.5">
                    School Bus Safety &amp; Route Operations
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Route Hazard &amp; Operational Feasibility Safety Assessment
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                <span className="text-base font-black text-slate-900 tracking-tight uppercase flex items-center gap-1">
                  <Navigation className="w-4 h-4 text-teal-600 inline" />
                  ROUTE ASSESSMENT
                </span>
                <span className="text-xs font-mono text-slate-600 mt-0.5">
                  File #: <strong className="text-slate-900 font-bold">{reportCode}</strong>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Assessed: {assessmentDateStr}
                </span>

                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      currentAssessment.statusInt === 3
                        ? 'bg-blue-100 text-blue-800 border-blue-400'
                        : currentAssessment.statusInt === 2
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                        : currentAssessment.statusInt === 1
                        ? 'bg-cyan-100 text-cyan-800 border-cyan-400'
                        : 'bg-amber-100 text-amber-800 border-amber-400'
                    }`}
                  >
                    {currentAssessment.statusStr || 'Working'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 1: Route & Assessor Profile */}
            <div className="grid grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Route Identifier
                </span>
                <span className="text-sm font-black text-slate-900 font-mono flex items-center gap-1 mt-0.5">
                  <Bus className="w-3.5 h-3.5 text-amber-600" />
                  Route #{currentAssessment.routeId}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {currentAssessment.assessmentType === '1' ? 'Change in Route' : 'New Route Initial Assessment'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  School Board &amp; School
                </span>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5 truncate">
                  <School className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  {currentAssessment.school || 'Assigned Schools'}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {currentAssessment.schoolBoard || 'Consortium Board'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Assessing Driver
                </span>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                  {currentAssessment.conductedByDriver}
                </span>
                <span className="text-[11px] text-slate-500 block font-mono">
                  ID: {currentAssessment.conductedByEmployeeId || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Driver Contact
                </span>
                <span className="text-[11px] text-slate-800 block mt-0.5 truncate flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {currentAssessment.driverEmail || 'driver@pcytech.com'}
                </span>
                <span className="text-[11px] text-slate-500 block truncate flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {currentAssessment.driverPhone || 'N/A'}
                </span>
              </div>
            </div>

            {/* Assessment Summary Banner */}
            <div className="p-2.5 bg-slate-100/80 border border-slate-200 rounded-lg text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="font-bold text-slate-700">Driver Operational Assessment Summary:</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  flaggedCount > 0
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {flaggedCount > 0 ? `⚠ ${flaggedCount} Safety Flag(s) Identified` : '✓ All Route Clear'}
                </span>
              </div>
              <p className="pt-1.5 text-slate-800 italic leading-relaxed">
                "{currentAssessment.summary || 'Comprehensive route test drive executed in accordance with school bus standard operating procedures.'}"
              </p>
            </div>

            {/* Section 2: 11-Point Route Safety Audit Checklist */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                11-Point Detailed Safety Audit Grid
              </span>
              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                      <th className="py-1 px-2.5 w-1/3">Safety Checkpoint</th>
                      <th className="py-1 px-2 text-center w-20">Audit Status</th>
                      <th className="py-1 px-2.5">Specific Driver Findings &amp; Observations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {safetyPoints.map((point, idx) => (
                      <tr key={idx} className={point.flagged ? 'bg-rose-50/50' : 'bg-white'}>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900 align-top">
                          {point.title}
                        </td>
                        <td className="py-1.5 px-2 text-center align-top whitespace-nowrap">
                          {point.flagged ? (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              FLAGGED
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              PASS
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-700 text-[10.5px] leading-tight align-top">
                          {point.detail ? point.detail : <span className="text-slate-400 italic">No hazard observed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Office Processing & Routing Action */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Office &amp; Routing Administration Processing
              </span>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Assigned Dispatcher:</span>
                  <span className="font-bold text-slate-800">{currentAssessment.assignedTo || 'Safety Officer'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Review Completed:</span>
                  <span className={`font-bold ${currentAssessment.isCompleted ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {currentAssessment.isCompleted ? '✓ Completed' : 'Pending Review'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Submitted to Board:</span>
                  <span className={`font-bold ${currentAssessment.isSubmitted ? 'text-blue-700' : 'text-slate-600'}`}>
                    {currentAssessment.isSubmitted ? '✓ Submitted to Consortium' : 'Internal Working Draft'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Official Approvals & Certifications */}
          <div className="pt-3 border-t-2 border-slate-900 mt-2">
            <div className="grid grid-cols-3 gap-6 text-[10px]">
              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  {currentAssessment.conductedByDriver}
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">Assessing Driver Signature</div>
                <div className="text-slate-500 text-[9px] font-mono">Date: {assessmentDateStr}</div>
              </div>

              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  {currentAssessment.assignedTo || 'Fleet Routing Coordinator'}
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">Safety &amp; Routing Auditor</div>
                <div className="text-slate-500 text-[9px] font-mono">
                  Audit Date: {currentAssessment.isCompleted ? assessmentDateStr : '_______________'}
                </div>
              </div>

              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  PCY Tech Fleet Safety &amp; Consortium Liaison
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">Director of Transportation Sign-off</div>
                <div className="text-slate-500 text-[9px] font-mono">
                  Date: {new Date().toISOString().split('T')[0]}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 text-[9px] text-slate-400">
              <span>PCY TECH FLEET CLOUD • SCHOOL BUS ROUTE SAFETY AUDIT</span>
              <span>STANDARDS COMPLIANT WITH MINISTRY / CONSORTIUM TRANSPORTATION SAFETY</span>
              <span className="font-mono">PAGE 1 OF 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
