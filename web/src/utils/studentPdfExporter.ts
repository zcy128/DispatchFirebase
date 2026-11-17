import jsPDF from 'jspdf';
import { Student, StudentStop } from '../types/student';
import { School } from '../types/school';

export interface StudentPdfInput {
  student: Student;
  school?: School | null;
  stops: StudentStop[];
}

const PAGE_WIDTH = 215.9; // Letter width (mm)
const PAGE_HEIGHT = 279.4; // Letter height (mm)
const MARGIN_X = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function drawHeaderBanner(
  doc: jsPDF,
  title: string,
  subtitle: string,
  rightBadge?: string
): number {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_WIDTH, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, MARGIN_X, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(subtitle, MARGIN_X, 20);

  if (rightBadge) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(251, 191, 36);
    doc.text(rightBadge, PAGE_WIDTH - MARGIN_X, 12, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, PAGE_WIDTH - MARGIN_X, 20, {
    align: 'right',
  });

  return 36;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(title, MARGIN_X, y);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, y + 2, PAGE_WIDTH - MARGIN_X, y + 2);
  return y + 7;
}

function drawKeyValueGrid(
  doc: jsPDF,
  startY: number,
  rows: Array<{ label: string; value: string }>
): number {
  let y = startY;
  const colWidth = CONTENT_WIDTH / 2 - 3;

  for (let i = 0; i < rows.length; i += 2) {
    const left = rows[i];
    const right = rows[i + 1];

    const drawCell = (x: number, item: { label: string; value: string }): number => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label.toUpperCase(), x, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const wrapped = doc.splitTextToSize(item.value || '-', colWidth);
      doc.text(wrapped, x, y + 4.2);
      return wrapped.length * 4.2 + 5.5;
    };

    const hLeft = drawCell(MARGIN_X, left);
    const hRight = right ? drawCell(MARGIN_X + colWidth + 6, right) : 0;
    y += Math.max(hLeft, hRight, 10);
  }

  return y + 2;
}

/**
 * Builds a multi-page Letter PDF for a student:
 * - Page 1: Student profile, school, guardians/contacts, and care plan notes.
 * - Page 2+: Student stops & route itinerary on its own dedicated page(s).
 */
export function buildStudentPdf(input: StudentPdfInput): jsPDF {
  const { student, school, stops } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const fullName =
    student.fullName ||
    student.studentName ||
    `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
    `Student #${student.studentNo || student.studentId}`;

  // ================= PAGE 1: STUDENT PROFILE & DETAILS =================
  let y = drawHeaderBanner(
    doc,
    fullName,
    `Student #${student.studentNo || student.studentId}  |  Grade: ${student.grade || '-'}  |  Gender: ${student.gender || '-'}`,
    student.active !== false ? 'ACTIVE' : 'INACTIVE'
  );

  y = drawSectionTitle(doc, y, 'Student Profile & Transportation');
  y = drawKeyValueGrid(doc, y, [
    { label: 'Home Address', value: student.studentAddress || '-' },
    { label: 'Primary Phone', value: student.studentPhone || '-' },
    { label: 'Date of Birth', value: student.birthDate ? String(student.birthDate).slice(0, 10) : '-' },
    { label: 'Assigned Routes', value: student.routes || 'Unassigned' },
    { label: 'Emergency Phone', value: student.studentEmergencyPhone || '-' },
    { label: 'Emergency Address', value: student.studentEmergencyAddress || '-' },
  ]);

  y = drawSectionTitle(doc, y + 2, 'School Information');
  const bellTimes =
    school && (school.startTime || school.dismissalTime)
      ? `${school.startTime || '-'} - ${school.dismissalTime || '-'}`
      : '-';
  y = drawKeyValueGrid(doc, y, [
    { label: 'School Name', value: school?.schoolName || student.schoolName || '-' },
    { label: 'School Board', value: school?.schoolBoardCode || '-' },
    { label: 'School Address', value: school?.schoolAddress || '-' },
    { label: 'Bell Times', value: bellTimes },
  ]);

  y = drawSectionTitle(doc, y + 2, 'Guardians & Emergency Contacts');
  const contacts = Array.isArray(student.contacts) ? student.contacts : [];
  if (contacts.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No guardian or emergency contacts recorded.', MARGIN_X, y);
    y += 8;
  } else {
    for (const c of contacts) {
      if (y > PAGE_HEIGHT - 40) break;
      const phone = c.mobilePhone || c.homePhone || c.workPhone || '-';
      const primaryTag = c.primaryContact ? ' (Primary)' : '';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${c.contactName || 'Contact'}${primaryTag} - ${c.relationship || 'Guardian'}`, MARGIN_X, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Phone: ${phone}   |   Email: ${c.email || '-'}`, MARGIN_X, y + 4.2);
      y += 10;
    }
  }

  y = drawSectionTitle(doc, y + 2, 'Care Plan, Equipment & Notes');
  drawKeyValueGrid(doc, y, [
    { label: 'Accessibility / MetatBus', value: student.metatBus ? 'Yes (Special Transport)' : 'Standard' },
    { label: 'Equipment', value: student.equipments || 'None' },
    { label: 'Dispatch Notes', value: student.studentDispatchNotes || 'None' },
    { label: 'School Notes', value: student.studentSchoolNotes || 'None' },
  ]);

  // ================= PAGE 2: STOPS ON A SEPARATE PAGE =================
  doc.addPage();
  const stopRoutes = Array.from(
    new Set(stops.map((s) => s.route).filter((r): r is string => Boolean(r)))
  ).join(', ');
  let sy = drawHeaderBanner(
    doc,
    `Scheduled Stops: ${fullName}`,
    `Student #${student.studentNo || student.studentId}  |  Routes: ${stopRoutes || student.routes || 'Unassigned'}`,
    `${stops.length} ${stops.length === 1 ? 'STOP' : 'STOPS'}`
  );

  sy = drawSectionTitle(doc, sy, 'Stops & Route Itinerary');

  if (stops.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No scheduled stops configured for this student.', MARGIN_X, sy + 2);
    return doc;
  }

  // Table column layout (total = CONTENT_WIDTH = 187.9 mm)
  const cols = [
    { label: '#', width: 8 },
    { label: 'Route', width: 24 },
    { label: 'Shift', width: 14 },
    { label: 'Time', width: 20 },
    { label: 'Type', width: 28 },
    { label: 'Op Days', width: 20 },
    { label: 'Location', width: 48 },
    { label: 'Comment', width: CONTENT_WIDTH - (8 + 24 + 14 + 20 + 28 + 20 + 48) },
  ];

  const drawTableHeader = (headerY: number): number => {
    doc.setFillColor(241, 245, 249);
    doc.rect(MARGIN_X, headerY, CONTENT_WIDTH, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    let x = MARGIN_X + 1.5;
    for (const col of cols) {
      doc.text(col.label, x, headerY + 5);
      x += col.width;
    }
    return headerY + 9;
  };

  sy = drawTableHeader(sy);

  stops.forEach((st, idx) => {
    const locLines = doc.splitTextToSize(st.location || '-', cols[6].width - 3);
    const commentLines = doc.splitTextToSize(st.comment || st.instruction || '-', cols[7].width - 2);
    const rowLines = Math.max(locLines.length, commentLines.length, 1);
    const rowHeight = rowLines * 4 + 4;

    if (sy + rowHeight > PAGE_HEIGHT - 16) {
      doc.addPage();
      sy = drawHeaderBanner(
        doc,
        `Scheduled Stops (cont.): ${fullName}`,
        `Student #${student.studentNo || student.studentId}`,
        `${stops.length} STOPS`
      );
      sy = drawTableHeader(sy);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN_X, sy - 2, CONTENT_WIDTH, rowHeight, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    const values: Array<string | string[]> = [
      String(idx + 1),
      st.route || '-',
      st.shift || '-',
      st.time || '-',
      st.type || '-',
      st.opDays || '-',
      locLines,
      commentLines,
    ];

    let x = MARGIN_X + 1.5;
    for (let c = 0; c < cols.length; c++) {
      const val = values[c];
      doc.text(val, x, sy + 2);
      x += cols[c].width;
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, sy + rowHeight - 2, PAGE_WIDTH - MARGIN_X, sy + rowHeight - 2);
    sy += rowHeight;
  });

  return doc;
}

export function exportStudentPdf(input: StudentPdfInput): void {
  const doc = buildStudentPdf(input);
  const rawName =
    input.student.fullName ||
    input.student.studentName ||
    `${input.student.firstName || ''}_${input.student.lastName || ''}`.trim() ||
    `student_${input.student.studentNo || input.student.studentId}`;
  const safeName = rawName.replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`${safeName}_profile_and_stops.pdf`);
}
