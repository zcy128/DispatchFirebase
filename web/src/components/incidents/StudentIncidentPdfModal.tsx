import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  ShieldAlert,
  Loader2,
  Calendar,
  Clock,
  School,
  Bus,
  User,
  MapPin,
  HeartPulse,
  UserX,
  PhoneCall,
  AlertTriangle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  StudentIncident,
  STUDENT_INCIDENT_STATUS_LABELS,
  STUDENT_INCIDENT_CATEGORY_LABELS,
  DISCIPLINARY_ACTION_LABELS,
} from '../../types/studentIncident';
import { PCY_TECH_LOGO_DATA_URL } from '../../assets/logoDataUrl';

interface StudentIncidentPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: StudentIncident | null;
  allIncidents?: StudentIncident[];
}

export const StudentIncidentPdfModal: React.FC<StudentIncidentPdfModalProps> = ({
  isOpen,
  onClose,
  incident,
  allIncidents = [],
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    incident?.id || (allIncidents.length > 0 ? allIncidents[0].id : '')
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

  const currentIncident =
    allIncidents.find((i) => i.id === selectedIncidentId) || incident || allIncidents[0];

  if (!currentIncident) return null;

  const statusLabel =
    STUDENT_INCIDENT_STATUS_LABELS[currentIncident.status] || currentIncident.status;

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
          const clonedForm = clonedDoc.getElementById('student-incident-printable-sheet');
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

      const cleanStudent = (currentIncident.studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `PCY_Tech_Student_Incident_${cleanStudent}_${currentIncident.incidentDate}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate Student Incident PDF:', err);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const reportCode = `IR-STU-${currentIncident.routeNo || 'BUS'}-${currentIncident.id ? currentIncident.id.substring(0, 6).toUpperCase() : '001'}`;

  return createPortal(
    <div
      id="student-incident-print-portal"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex flex-col items-center justify-start print:p-0 print:bg-white print:static print:inset-auto"
    >
      {/* Top Floating Control Bar */}
      <div className="no-print w-full max-w-[840px] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 sticky top-2 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Student Incident Report PDF Export</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                A4 Official Form
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {currentIncident.studentName} ({currentIncident.schoolName || 'School'}) • {currentIncident.incidentDate}
            </p>
          </div>
        </div>

        {allIncidents.length > 1 && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Record:</span>
            <select
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 max-w-[210px] truncate"
            >
              {allIncidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.studentName} ({inc.incidentDate}) - {inc.status.toUpperCase()}
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
          id="student-incident-printable-sheet"
          className="bg-white text-slate-900 shadow-2xl text-xs font-sans flex flex-col justify-between relative print:shadow-none print:m-0"
          style={{
            width: '794px',
            minHeight: '1123px',
            height: '1123px',
            padding: '34px 40px',
            boxSizing: 'border-box',
          }}
        >
          {/* Main Top Content */}
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
                      Fleet Cloud
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-widest mt-0.5">
                    School Bus Fleet Operations &amp; Safety Compliance
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Official Student Transportation Incident &amp; Disciplinary Record
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                <span className="text-base font-black text-rose-900 tracking-tight uppercase flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4 text-rose-600 inline" />
                  INCIDENT REPORT
                </span>
                <span className="text-xs font-mono text-slate-600 mt-0.5">
                  File #: <strong className="text-slate-900 font-bold">{reportCode}</strong>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Date: {currentIncident.incidentDate} at {currentIncident.incidentTime}
                </span>

                <div className="mt-1.5">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      currentIncident.status === 'closed'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                        : currentIncident.status === 'school_notified'
                        ? 'bg-purple-100 text-purple-800 border-purple-400'
                        : currentIncident.status === 'parent_contacted'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-400'
                        : currentIncident.status === 'under_investigation'
                        ? 'bg-blue-100 text-blue-800 border-blue-400'
                        : 'bg-amber-100 text-amber-800 border-amber-400'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 1: Student & Transport Profile */}
            <div className="grid grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Student Name
                </span>
                <span className="text-sm font-black text-slate-900 flex items-center gap-1 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                  {currentIncident.studentName}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {currentIncident.grade ? `Grade ${currentIncident.grade}` : 'Student'}{' '}
                  {currentIncident.studentNo ? `• ID: ${currentIncident.studentNo}` : ''}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Assigned School
                </span>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <School className="w-3.5 h-3.5 text-blue-600" />
                  {currentIncident.schoolName || 'Unassigned School'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Shift: {currentIncident.shiftType || 'AM / PM Route'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Bus Route
                </span>
                <span className="text-xs font-black text-slate-900 font-mono flex items-center gap-1 mt-0.5">
                  <Bus className="w-3.5 h-3.5 text-amber-600" />
                  Route #{currentIncident.routeNo}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {currentIncident.routeName || 'Standard Route'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Reporting Driver
                </span>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                  {currentIncident.driverName || 'Bus Operator'}
                </span>
                <span className="text-[11px] text-slate-500 block font-mono">
                  Driver ID: {currentIncident.driverId || 'N/A'}
                </span>
              </div>
            </div>

            {/* Location & Time Line */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="font-bold text-slate-700">Incident Location:</span>
                <span className="text-slate-900">{currentIncident.location || 'In Transit on Route'}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 font-mono text-[11px]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> {currentIncident.incidentDate}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> {currentIncident.incidentTime}
                </span>
              </div>
            </div>

            {/* Section 2: Incident Types Categorization */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Incident Categorization
              </span>
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                {currentIncident.incidentTypes && currentIncident.incidentTypes.length > 0 ? (
                  currentIncident.incidentTypes.map((typeKey) => (
                    <span
                      key={typeKey}
                      className="px-2.5 py-1 text-xs font-bold rounded bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      {STUDENT_INCIDENT_CATEGORY_LABELS[typeKey] || typeKey}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">No specific categories flagged</span>
                )}
                {currentIncident.typeOther && (
                  <span className="px-2 py-1 text-xs rounded bg-slate-200 text-slate-800 border border-slate-300 font-medium">
                    Other: {currentIncident.typeOther}
                  </span>
                )}
              </div>
            </div>

            {/* Section 3: Driver Incident Statement */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Driver Incident Statement &amp; Detailed Description
              </span>
              <div className="p-3 bg-white border border-slate-300 rounded-lg text-xs leading-relaxed text-slate-800 min-h-[90px] whitespace-pre-wrap font-sans">
                {currentIncident.description || 'No detailed incident description provided.'}
              </div>
            </div>

            {/* Section 4: Supplementary Field Details (Witnesses & Immediate Action) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                  Witnesses &amp; Other Students Involved
                </span>
                <p className="text-slate-800 text-[11px] min-h-[30px]">
                  {currentIncident.witnesses || currentIncident.otherStudentsInvolved || 'None reported'}
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                  Immediate Action Taken By Driver
                </span>
                <p className="text-slate-800 text-[11px] min-h-[30px]">
                  {currentIncident.immediateActionTaken || 'Verbal instructions given, logged report for administration.'}
                </p>
              </div>
            </div>

            {/* Section 5: Critical Safety & Emergency Interventions */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Emergency &amp; Protocol Checklist
              </span>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className={`p-2 rounded-lg border flex items-center space-x-2 ${
                  currentIncident.studentRemovedFromBus
                    ? 'bg-rose-100 border-rose-300 text-rose-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}>
                  <UserX className="w-4 h-4 shrink-0 text-rose-600" />
                  <div>
                    <div className="text-[11px]">Student Removed from Bus</div>
                    <div className="text-[10px] font-mono">{currentIncident.studentRemovedFromBus ? 'YES - REMOVED' : 'NO - KEPT ON BUS'}</div>
                  </div>
                </div>

                <div className={`p-2 rounded-lg border flex items-center space-x-2 ${
                  currentIncident.firstAidRequired
                    ? 'bg-red-100 border-red-300 text-red-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}>
                  <HeartPulse className="w-4 h-4 shrink-0 text-red-600" />
                  <div>
                    <div className="text-[11px]">First Aid Administered</div>
                    <div className="text-[10px] font-mono">{currentIncident.firstAidRequired ? 'YES - FIRST AID GIVEN' : 'NO - NOT REQUIRED'}</div>
                  </div>
                </div>

                <div className={`p-2 rounded-lg border flex items-center space-x-2 ${
                  currentIncident.parentsNotified
                    ? 'bg-blue-100 border-blue-300 text-blue-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}>
                  <PhoneCall className="w-4 h-4 shrink-0 text-blue-600" />
                  <div>
                    <div className="text-[11px]">Parents / Guardians Notified</div>
                    <div className="text-[10px] font-mono">{currentIncident.parentsNotified ? 'YES - CONTACTED' : 'NO - PENDING OFFICE'}</div>
                  </div>
                </div>
              </div>
              {currentIncident.parentsNotificationDetail && (
                <div className="mt-2 text-[11px] text-slate-600 px-2 py-1 bg-white rounded border border-slate-200">
                  <strong className="text-slate-800">Notification Detail:</strong> {currentIncident.parentsNotificationDetail}
                </div>
              )}
            </div>

            {/* Section 6: Office / School District Administrative Action */}
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-200">
                <span className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                  School District &amp; Administrative Follow-Up
                </span>
                <span className="text-[10px] font-bold text-amber-800 font-mono">
                  Reviewer: {currentIncident.officeFollowUp?.administratorName || 'Pending Administrative Review'}
                  {currentIncident.officeFollowUp?.reviewedDate ? ` (${currentIncident.officeFollowUp.reviewedDate})` : ''}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Disciplinary Actions Imposed
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentIncident.officeFollowUp?.disciplinaryActions &&
                  currentIncident.officeFollowUp.disciplinaryActions.length > 0 ? (
                    currentIncident.officeFollowUp.disciplinaryActions.map((actionKey) => (
                      <span
                        key={actionKey}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200/80 text-amber-950 border border-amber-300"
                      >
                        ✓ {DISCIPLINARY_ACTION_LABELS[actionKey] || actionKey}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">No formal disciplinary actions recorded yet</span>
                  )}
                  {currentIncident.officeFollowUp?.disciplinaryOther && (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-200 text-slate-800 border border-slate-300">
                      Other: {currentIncident.officeFollowUp.disciplinaryOther}
                    </span>
                  )}
                </div>
              </div>

              {currentIncident.officeFollowUp?.officeNotes && (
                <div className="text-[11px] text-slate-800 pt-1">
                  <strong className="text-amber-950">Administrative Notes:</strong>{' '}
                  {currentIncident.officeFollowUp.officeNotes}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section: Official Legal & Regulatory Signatures */}
          <div className="pt-3 border-t-2 border-slate-900 mt-2">
            <div className="grid grid-cols-3 gap-6 text-[10px]">
              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  {currentIncident.driverName}
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">Reporting Driver Signature</div>
                <div className="text-slate-500 text-[9px] font-mono">Date: {currentIncident.incidentDate}</div>
              </div>

              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  {currentIncident.officeFollowUp?.administratorName || ''}
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">School Administrator / Principal</div>
                <div className="text-slate-500 text-[9px] font-mono">
                  Date: {currentIncident.officeFollowUp?.reviewedDate || '_______________'}
                </div>
              </div>

              <div>
                <div className="h-9 border-b border-dashed border-slate-400 flex items-end pb-1 font-serif text-slate-800 italic">
                  PCY Tech Fleet Safety Compliance
                </div>
                <div className="pt-1 font-bold text-slate-700 uppercase">Fleet Safety Supervisor Sign-off</div>
                <div className="text-slate-500 text-[9px] font-mono">
                  Audit Date: {new Date().toISOString().split('T')[0]}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 text-[9px] text-slate-400">
              <span>PCY TECH FLEET CLOUD • STUDENT DISCIPLINARY &amp; SAFETY ARCHIVE</span>
              <span>CONFIDENTIAL - FOR AUTHORIZED SCHOOL DISTRICT &amp; FLEET PERSONNEL ONLY</span>
              <span className="font-mono">PAGE 1 OF 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
