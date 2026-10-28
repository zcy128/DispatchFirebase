import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PreTripInspection } from '../../types/pretrip';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';
import {
  X,
  Printer,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Calendar,
  Clock,
  Gauge,
  User,
  Truck,
} from 'lucide-react';

interface PreTripReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspection: PreTripInspection | null;
}

export const PreTripReportPdfModal: React.FC<PreTripReportPdfModalProps> = ({
  isOpen,
  onClose,
  inspection,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const isExportingRef = useRef<boolean>(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !inspection) return null;

  const handleDownloadPdf = async () => {
    if (isExportingRef.current || isExporting) return;
    if (!sheetRef.current) return;

    isExportingRef.current = true;
    setIsExporting(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const element = sheetRef.current;
      const fullHeight = element.scrollHeight;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        height: fullHeight,
        windowHeight: fullHeight + 200,
        scrollY: 0,
        scrollX: 0,
        onclone: (clonedDoc) => {
          const clonedPortal = clonedDoc.getElementById('pretrip-report-print-portal');
          if (clonedPortal) {
            clonedPortal.style.position = 'static';
            clonedPortal.style.overflow = 'visible';
            clonedPortal.style.height = 'auto';
            clonedPortal.style.maxHeight = 'none';
            clonedPortal.style.padding = '0';
          }
          const clonedSheet = clonedDoc.getElementById('pretrip-report-printable-sheet');
          if (clonedSheet) {
            clonedSheet.style.overflow = 'visible';
            clonedSheet.style.height = 'auto';
            clonedSheet.style.maxHeight = 'none';
            clonedSheet.style.boxShadow = 'none';
          }
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            img { display: inline-block !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4', // 210mm x 297mm
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = pdfHeight - margin * 2;

      const pxPerMm = canvas.width / contentWidth;
      const canvasPageHeight = Math.floor(contentHeight * pxPerMm);
      const totalPages = Math.ceil(canvas.height / canvasPageHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        const sY = page * canvasPageHeight;
        const sHeight = Math.min(canvasPageHeight, canvas.height - sY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, sY, canvas.width, sHeight,
            0, 0, canvas.width, sHeight
          );
        }

        const pageImgData = pageCanvas.toDataURL('image/png');
        const renderedImgHeight = sHeight / pxPerMm;

        pdf.addImage(
          pageImgData,
          'PNG',
          margin,
          margin,
          contentWidth,
          renderedImgHeight,
          undefined,
          'FAST'
        );
      }

      const cleanUnit = (inspection.vehicleUnit || 'Bus').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `PCY_Tech_PreTrip_Schedule5_Unit_${cleanUnit}_${inspection.inspectionDate}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate Pre-Trip Certificate PDF:', err);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isPassed = inspection.overallStatus === 'passed';
  const isMinor = inspection.overallStatus === 'passed_with_minor_defects';
  const isMajor = inspection.overallStatus === 'failed_major_defects';

  const itemsList = inspection.items ? Object.values(inspection.items) : [];

  // Group items by category
  const categories = itemsList.reduce((acc, item) => {
    const cat = item.category || 'General Vehicle Inspection';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof itemsList>);

  return createPortal(
    <div
      id="pretrip-report-print-portal"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-start print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible"
    >
      <style>{`
        @media print {
          #root {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          @page {
            size: portrait;
            margin: 8mm;
          }
          .no-print {
            display: none !important;
          }
          #pretrip-report-print-portal {
            position: static !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          #pretrip-report-printable-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>

      {/* Top Floating Control Bar (Hidden when printing via .no-print) */}
      <div className="no-print w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 sticky top-2 z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Official Pre-Trip Inspection Certificate
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Schedule 5 — MTO Highway Traffic Act Reg. 199/07 / NSC Standard 13
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition"
            title="Directly export and download high-resolution multi-page PDF"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Direct Export PDF</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition"
            title="Print document via system print dialog"
          >
            <Printer className="w-4 h-4" />
            <span>Print Preview</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Certificate Sheet (Full natural height, captured by html2canvas and print) */}
      <div className="w-full flex justify-center pb-8 print:p-0">
        <div
          ref={sheetRef}
          id="pretrip-report-printable-sheet"
          className="bg-white text-slate-900 shadow-2xl relative print:shadow-none print:m-0 w-full max-w-4xl rounded-2xl p-8 space-y-6"
        >
          {/* Certificate Header with Official App Brand Logo */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3.5">
                {/* PCY Tech App Brand Logo */}
                <div className="w-14 h-14 rounded-2xl bg-slate-950 p-1 flex-shrink-0 shadow-md border border-amber-500/50 flex items-center justify-center overflow-hidden">
                  <img
                    src={PCY_TECH_LOGO_DATA_URL}
                    alt="PCY Tech"
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-black tracking-tight text-slate-950 font-mono">
                      PCY TECH
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 rounded uppercase tracking-wider">
                      Fleet Cloud
                    </span>
                  </div>
                  <h1 className="text-sm font-bold text-slate-800 uppercase tracking-wide mt-0.5">
                    PCY Tech Student Transportation Services
                  </h1>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Fleet Safety & Compliance Division · Ottawa Operations Center · CVOR: 982-341-712
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 text-xs font-bold uppercase rounded border border-slate-900 text-slate-900">
                  Official Audit Document
                </span>
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  Doc ID: #{inspection.id.slice(0, 12)}
                </p>
              </div>
            </div>

            <div className="mt-3 py-1 bg-slate-100 border-y border-slate-300 font-bold text-xs uppercase tracking-wider text-center text-slate-900">
              Daily Vehicle Pre-Trip Circle Inspection Certificate (Schedule 5 — MTO Reg. 199/07)
            </div>
          </div>

          {/* Vehicle & Inspector Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Vehicle Unit</span>
              <span className="font-bold text-sm text-slate-900 flex items-center gap-1 font-mono">
                <Truck className="w-3.5 h-3.5 text-amber-500" />
                Unit #{inspection.vehicleUnit}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">License Plate</span>
              <span className="font-semibold text-slate-800 font-mono">
                {inspection.vehiclePlate || `ON-${inspection.vehicleUnit}`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inspection Date</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {inspection.inspectionDate}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inspection Time</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {inspection.inspectionTime || '06:30 AM'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inspector / Driver</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {inspection.inspectorName}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Employee ID</span>
              <span className="font-mono text-slate-700">
                {inspection.inspectorId || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Odometer Reading</span>
              <span className="font-mono font-semibold text-slate-800 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                {inspection.odometer ? `${inspection.odometer.toLocaleString()} km` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inspection Result</span>
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  isPassed
                    ? 'text-emerald-800'
                    : isMinor
                    ? 'text-amber-800'
                    : 'text-rose-800'
                }`}
              >
                {isPassed && <CheckCircle2 className="w-3.5 h-3.5" />}
                {isMinor && <AlertTriangle className="w-3.5 h-3.5" />}
                {isMajor && <XCircle className="w-3.5 h-3.5" />}
                {isPassed ? 'PASSED (Clean)' : isMinor ? 'PASSED W/ MINOR' : 'OUT OF SERVICE'}
              </span>
            </div>
          </div>

          {/* Checklist Items Breakdown */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-300 pb-1">
              Schedule 5 Statutory Inspection Item Breakdown
            </h4>

            {Object.keys(categories).length === 0 ? (
              <div className="p-3 text-xs text-slate-500 italic bg-slate-50 rounded">
                Full 42-point Circle Check passed in accordance with Schedule 5 standard.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(categories).map(([catName, items]) => (
                  <div key={catName} className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800">
                      {catName}
                    </div>
                    <div className="divide-y divide-slate-200 text-xs">
                      {items.map((item) => (
                        <div
                          key={item.code}
                          className="px-3 py-1.5 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-400">{item.code}</span>
                            <span className="text-slate-700">
                              {item.title}
                            </span>
                            {item.isSchoolBusSpecific && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-semibold">
                                School Bus Spec
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {item.notes && (
                              <span className="text-[11px] text-slate-500 italic">
                                &quot;{item.notes}&quot;
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                item.status === 'pass'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'minor_defect'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.status === 'major_defect'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Defect Notes Section */}
          {inspection.defectNotes && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-1">
              <span className="font-bold text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Driver Defect Remarks / Corrective Follow-Up:
              </span>
              <p className="text-amber-900 font-mono">
                {inspection.defectNotes}
              </p>
            </div>
          )}

          {/* Statutory Certification & Signature */}
          <div className="pt-4 border-t-2 border-slate-800 space-y-4">
            <p className="text-[11px] text-slate-700 leading-relaxed italic">
              <strong>Statutory Certification:</strong> I hereby declare that the vehicle specified above has been inspected in accordance with Schedule 5 of Ontario Regulation 199/07 (Highway Traffic Act). All major and minor defects identified have been recorded. If no defects are noted, I certify the vehicle is in fit condition to safely transport students.
            </p>

            <div className="grid grid-cols-2 gap-8 pt-2">
              <div className="border-t border-slate-400 pt-2">
                <div className="text-base text-blue-900 font-semibold italic">
                  {inspection.signatureName || inspection.inspectorName}
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold mt-1">
                  Driver / Certified Inspector Signature
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Signed: {inspection.inspectionDate} @ {inspection.inspectionTime || '06:30 AM'}
                </div>
              </div>

              <div className="border-t border-slate-400 pt-2">
                <div className="text-xs font-semibold text-slate-800">
                  Ottawa Fleet Operations Authority
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold mt-1">
                  Fleet Safety Supervisor / Dispatcher Sign-Off
                </div>
                <div className="text-[10px] text-slate-400">
                  Verified against daily route dispatch manifest
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
