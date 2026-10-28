import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { VehiclePretripStatus } from '../../types/pretrip';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';
import {
  X,
  Printer,
  Download,
  Loader2,
  Calendar,
  AlertTriangle,
  FileText,
} from 'lucide-react';

interface PreTripFleetRosterPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  roster: VehiclePretripStatus[];
}

export const PreTripFleetRosterPrintModal: React.FC<PreTripFleetRosterPrintModalProps> = ({
  isOpen,
  onClose,
  date,
  roster,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const isExportingRef = useRef<boolean>(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

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
          const clonedPortal = clonedDoc.getElementById('pretrip-roster-print-portal');
          if (clonedPortal) {
            clonedPortal.style.position = 'static';
            clonedPortal.style.overflow = 'visible';
            clonedPortal.style.height = 'auto';
            clonedPortal.style.maxHeight = 'none';
            clonedPortal.style.padding = '0';
          }
          const clonedSheet = clonedDoc.getElementById('pretrip-roster-printable-sheet');
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
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4', // 297mm x 210mm
      });

      const pdfWidth = 297;
      const pdfHeight = 210;
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

      pdf.save(`PCY_Tech_Daily_PreTrip_Fleet_Roster_${date}.pdf`);
    } catch (err) {
      console.error('Failed to generate Fleet Pre-Trip Roster PDF:', err);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalAssigned = roster.filter((r) => r.isAssigned).length;
  const inspected = roster.filter((r) => r.isAssigned && r.hasInspection);
  const passedClean = inspected.filter((r) => r.status === 'passed').length;
  const withDefects = inspected.filter((r) => r.status === 'passed_with_minor_defects' || r.status === 'failed_major_defects').length;
  const missing = roster.filter((r) => r.isAssigned && !r.hasInspection);

  const complianceRate = totalAssigned > 0 ? Math.round((inspected.length / totalAssigned) * 100) : 100;

  return createPortal(
    <div
      id="pretrip-roster-print-portal"
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
            size: landscape;
            margin: 6mm;
          }
          .no-print {
            display: none !important;
          }
          #pretrip-roster-print-portal {
            position: static !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          #pretrip-roster-printable-sheet {
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
      <div className="no-print w-full max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 sticky top-2 z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Daily Fleet Pre-Trip Compliance Audit Log
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Official Roster for MTO / CVOR Commercial Vehicle Enforcement Inspections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition"
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

      {/* Printable Fleet Roster Sheet (Full natural height, captured by html2canvas and print) */}
      <div className="w-full flex justify-center pb-8 print:p-0">
        <div
          ref={sheetRef}
          id="pretrip-roster-printable-sheet"
          className="bg-white text-slate-900 shadow-2xl relative print:shadow-none print:m-0 w-full max-w-6xl rounded-2xl p-8 space-y-6"
        >
          {/* Header with App Brand Logo */}
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
                  <p className="text-[11px] text-slate-600 font-mono">
                    Daily Commercial Vehicle Trip Inspection Audit Log (MTO Reg 199/07 / NSC Standard 13) · Carrier Safety Fitness: Satisfactory · CVOR: 982-341-712
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold uppercase text-slate-600">Audit Date</div>
                <div className="text-base font-black font-mono flex items-center gap-1 justify-end text-slate-900">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  {date}
                </div>
              </div>
            </div>

            {/* KPI Summary Strip */}
            <div className="grid grid-cols-5 gap-2 mt-4 text-center text-xs">
              <div className="bg-slate-100 p-2 rounded border border-slate-300">
                <span className="text-[10px] uppercase font-semibold text-slate-600 block">Total Dispatched</span>
                <span className="text-base font-bold text-slate-900">{totalAssigned}</span>
              </div>
              <div className="bg-emerald-50 p-2 rounded border border-emerald-300">
                <span className="text-[10px] uppercase font-semibold text-emerald-800 block">Passed Clean</span>
                <span className="text-base font-bold text-emerald-800">{passedClean}</span>
              </div>
              <div className="bg-amber-50 p-2 rounded border border-amber-300">
                <span className="text-[10px] uppercase font-semibold text-amber-800 block">With Defects</span>
                <span className="text-base font-bold text-amber-800">{withDefects}</span>
              </div>
              <div className={`p-2 rounded border ${missing.length > 0 ? 'bg-rose-50 border-rose-400' : 'bg-slate-50 border-slate-300'}`}>
                <span className={`text-[10px] uppercase font-semibold block ${missing.length > 0 ? 'text-rose-800 font-bold' : 'text-slate-600'}`}>
                  Missing Pre-Trip
                </span>
                <span className={`text-base font-bold ${missing.length > 0 ? 'text-rose-800' : 'text-slate-700'}`}>
                  {missing.length}
                </span>
              </div>
              <div className="bg-blue-50 p-2 rounded border border-blue-300">
                <span className="text-[10px] uppercase font-semibold text-blue-800 block">Compliance Rate</span>
                <span className="text-base font-bold text-blue-800">{complianceRate}%</span>
              </div>
            </div>
          </div>

          {/* Missing Pre-Trip Alert Box (if any) */}
          {missing.length > 0 && (
            <div className="p-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-xs space-y-1">
              <span className="font-bold text-rose-800 flex items-center gap-1.5 uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Compliance Warning: {missing.length} Vehicle(s) Dispatched Without Recorded Pre-Trip Check
              </span>
              <p className="text-rose-800">
                Vehicles must undergo Schedule 5 circle inspection prior to departing the terminal:{' '}
                <strong>{missing.map((m) => `Unit #${m.unitNumber} (${m.driverName || 'No Driver'})`).join(', ')}</strong>
              </p>
            </div>
          )}

          {/* Roster Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-200 font-bold uppercase text-[10px] text-slate-800 border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Unit #</th>
                  <th className="py-2.5 px-3">Plate</th>
                  <th className="py-2.5 px-3">Route / Shift</th>
                  <th className="py-2.5 px-3">Driver / Inspector</th>
                  <th className="py-2.5 px-3">Check Time</th>
                  <th className="py-2.5 px-3">Odometer</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Signature</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {roster.map((v) => {
                  const isMissing = v.isAssigned && !v.hasInspection;
                  return (
                    <tr
                      key={v.unitNumber}
                      className={isMissing ? 'bg-rose-50/80 font-medium' : 'hover:bg-slate-50/50'}
                    >
                      <td className="py-2 px-3 font-bold font-mono text-slate-950">#{v.unitNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">
                        {v.vehiclePlate || `ON-${v.unitNumber}`}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900">{v.routeId || 'Yard Reserve'}</span>
                        {v.shiftType && <span className="text-[10px] text-slate-500 block">{v.shiftType}</span>}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {v.inspection?.inspectorName || v.driverName || '—'}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-700">
                        {v.inspection?.inspectionTime || (isMissing ? 'NOT COMPLETED' : '—')}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-700">
                        {v.inspection?.odometer ? `${v.inspection.odometer.toLocaleString()} km` : '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {isMissing ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            MISSING
                          </span>
                        ) : v.status === 'passed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            PASSED
                          </span>
                        ) : v.status === 'passed_with_minor_defects' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            MINOR DEFECT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            MAJOR DEFECT
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-script italic text-blue-900">
                        {v.inspection?.signatureName || '—'}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-600 truncate max-w-[150px]">
                        {v.inspection?.defectNotes || 'None'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Supervisor Signature Block */}
          <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-end text-xs">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">
                Carrier Safety Declaration
              </p>
              <p className="text-[11px] text-slate-700 max-w-md">
                Verified that daily pre-trip vehicle circle inspections have been archived in company records and maintained for statutory audit requirements under HTA Reg. 199/07.
              </p>
            </div>
            <div className="w-64 border-t border-slate-400 pt-2 text-center">
              <div className="font-semibold text-slate-800">Ottawa Fleet Supervisor</div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">
                Authorized Safety Official Sign-Off
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
