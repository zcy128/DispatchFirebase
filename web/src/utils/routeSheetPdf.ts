import jsPDF from 'jspdf';
import { PCY_TECH_LOGO_DATA_URL } from '../assets/logoDataUrl';
import { BusRoute, BusRouteShift, RouteStop, formatOpDays } from '../types/route';
import { School } from '../types/school';
import { Student, StudentContact } from '../types/student';

export interface StopBoardCount {
  stopLoad: number;
  runLoad: number;
}

export function isRouteDropoff(stopType: string): boolean {
  return stopType.toLowerCase().includes('drop');
}

/** Stop load is who gets on or off. Run load is who is still on the bus after the stop. */
export function boardCountsForStops(
  stops: { stopType: string; studentCount: number }[],
): StopBoardCount[] {
  let onboard = 0;
  return stops.map((stop) => {
    const listed = Math.max(0, stop.studentCount);
    if (isRouteDropoff(stop.stopType)) {
      const leaving = listed > 0 ? listed : onboard;
      onboard = Math.max(0, onboard - leaving);
      return { stopLoad: leaving, runLoad: onboard };
    }
    onboard += listed;
    return { stopLoad: listed, runLoad: onboard };
  });
}

export function formatRouteSheetClock(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return raw.trim();
  let hour = Number(match[1]);
  const minute = match[2];
  let meridiem = match[3]?.toUpperCase();
  if (!meridiem) {
    meridiem = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
  } else if (hour > 12) {
    hour %= 12;
  }
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${meridiem}`;
}

function clockMinutes(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }
  return hour * 60 + minute;
}

function runDurationLabel(start: string, end: string): string {
  const startMin = clockMinutes(start);
  const endMin = clockMinutes(end);
  const endLabel = formatRouteSheetClock(end);
  if (startMin == null || endMin == null) return endLabel;
  let span = endMin - startMin;
  if (span < 0) span += 24 * 60;
  return `${endLabel} (${span} min)`;
}

export function formatGuardianLine(contact: StudentContact): string {
  const phones = [contact.mobilePhone, contact.homePhone, contact.workPhone]
    .map((phone) => phone?.trim() || '')
    .filter(Boolean);
  return [...phones, contact.contactName.trim()].filter(Boolean).join(' ');
}

export interface SheetLine {
  text: string;
  bold?: boolean;
}

export interface StudentSheetColumns {
  left: SheetLine[];
  right: SheetLine[];
}

/**
 * Pack student care fields into two columns so the sheet uses the empty
 * right side under Stop Ld / Run Ld instead of a tall single stack.
 */
export function studentSheetColumns(
  student: Student | undefined,
  fallbackName: string,
): StudentSheetColumns {
  const name = student
    ? [student.lastName, student.firstName].filter((part) => part.trim()).join(', ') ||
      student.studentName ||
      student.fullName ||
      fallbackName
    : fallbackName;

  const left: SheetLine[] = [
    { text: name, bold: true },
    { text: `Equip: ${student?.equipments?.trim() || 'No'}` },
  ];
  if (student?.grade?.trim()) left.push({ text: `Grade ${student.grade.trim()}` });
  if (student?.studentAddress?.trim()) left.push({ text: student.studentAddress.trim() });
  if (student?.schoolName?.trim()) left.push({ text: student.schoolName.trim() });

  const notes = [student?.studentDispatchNotes, student?.studentSchoolNotes]
    .map((note) => note?.trim() || '')
    .filter(Boolean);
  if (notes.length > 0) left.push({ text: `Notes: ${notes.join(' ')}` });

  const right: SheetLine[] = [];
  const guardians = [...(student?.contacts ?? [])]
    .filter((contact) => contact.active !== false && contact.contactName.trim())
    .sort((a, b) => {
      if (a.primaryContact !== b.primaryContact) return a.primaryContact ? -1 : 1;
      return a.contactIndex - b.contactIndex;
    });
  guardians.forEach((contact, index) => {
    right.push({ text: `Guardian #${index + 1}`, bold: true });
    right.push({ text: formatGuardianLine(contact) });
  });
  if (guardians.length === 0 && student?.studentPhone?.trim()) {
    right.push({ text: 'Guardian #1', bold: true });
    right.push({ text: student.studentPhone.trim() });
  }

  return { left, right };
}

/** Flat student lines for callers that do not need the two-column layout. */
export function studentSheetLines(student: Student | undefined, fallbackName: string): SheetLine[] {
  const columns = studentSheetColumns(student, fallbackName);
  return [...columns.left, ...columns.right];
}

export function routeSheetFileName(routeNo: string): string {
  const safe = routeNo.trim().replace(/[^\w.-]+/g, '-') || 'route';
  return `Route-${safe}.pdf`;
}

/** Numeric student ids listed on the sheet stops. */
export function collectAssignedStudentIds(shifts: BusRouteShift[]): number[] {
  const ids = new Set<number>();
  for (const shift of shifts) {
    for (const stop of shift.stops ?? []) {
      for (const student of stop.assignedStudents ?? []) {
        if (student.studentId > 0) ids.add(student.studentId);
      }
    }
  }
  return Array.from(ids);
}

/** True when the master record can print guardian phone lines. */
export function studentHasContactDetails(student: Student | undefined): boolean {
  if (!student) return false;
  if (student.studentPhone?.trim()) return true;
  return (student.contacts ?? []).some(
    (contact) =>
      contact.active !== false &&
      (contact.contactName.trim() ||
        contact.mobilePhone?.trim() ||
        contact.homePhone?.trim() ||
        contact.workPhone?.trim()),
  );
}

export interface RouteSheetPdfInput {
  route: BusRoute;
  shifts: BusRouteShift[];
  studentsMap: Record<number, Student>;
  schools?: School[];
  generatedAt?: Date;
}

function schoolLabel(route: BusRoute, shifts: BusRouteShift[], schools: School[]): string {
  const names = new Set<string>();
  shifts.forEach((shift) => {
    if (shift.shiftSchools?.trim()) names.add(shift.shiftSchools.trim());
    shift.stops.forEach((stop) => {
      if (stop.schoolName?.trim()) names.add(stop.schoolName.trim());
    });
  });
  schools.forEach((school) => {
    if (names.has(school.schoolName) && school.schoolId) {
      names.delete(school.schoolName);
      names.add(`${school.schoolName} (${school.schoolId})`);
    }
  });
  if (names.size === 0 && route.routeName.trim()) return route.routeName.trim();
  return Array.from(names).join(', ');
}

const WEEKDAY_ORDER = ['M', 'T', 'W', 'R', 'F'] as const;

/** Monday is 0. A run that includes Monday sorts ahead of a Friday-only run. */
export function earliestRunDayRank(runDays?: string | null): number {
  const mask = formatOpDays(runDays);
  const index = WEEKDAY_ORDER.findIndex((day, position) => mask[position] === day);
  return index === -1 ? WEEKDAY_ORDER.length : index;
}

function normalizedStopType(stopType: string): string {
  return stopType.toLowerCase().replace(/[\s_-]/g, '');
}

/** School pickup or dropoff stops, not home / corner / yard stops. */
export function isSchoolStop(stopType: string): boolean {
  const type = normalizedStopType(stopType);
  if (type.includes('home') || type.includes('corner') || type.includes('yard')) return false;
  return type.includes('school') && (type.includes('drop') || type.includes('pick'));
}

/** A school dropoff is an AM run. Home dropoff and school pickup are not. */
export function isSchoolDropoffStop(stopType: string): boolean {
  const type = normalizedStopType(stopType);
  if (type.includes('home') || type.includes('corner') || type.includes('yard')) return false;
  return type.includes('school') && type.includes('drop');
}

export function schoolStopKindLabel(stopType: string): string {
  if (isSchoolDropoffStop(stopType)) return 'SCHOOL DROPOFF';
  const type = normalizedStopType(stopType);
  if (type.includes('school') && type.includes('pick')) return 'SCHOOL PICKUP';
  return 'SCHOOL';
}

export interface RouteSheetStopHeading {
  isSchool: boolean;
  kindLabel?: string;
  title: string;
  detail?: string;
}

/** School stops lead with the school name; home stops keep the street description. */
export function routeSheetStopHeading(stop: {
  stopType: string;
  stopLocation?: string;
  pickupLocation?: string;
  schoolName?: string;
}): RouteSheetStopHeading {
  const location = [stop.stopLocation, stop.pickupLocation]
    .filter((part) => part && part.trim())
    .join(' — ');
  if (!isSchoolStop(stop.stopType)) {
    return { isSchool: false, title: location || 'Stop' };
  }
  const schoolName = stop.schoolName?.trim() || '';
  const title = schoolName || location || 'School';
  const detail =
    schoolName && location && location.toLowerCase() !== schoolName.toLowerCase()
      ? location
      : undefined;
  return {
    isSchool: true,
    kindLabel: schoolStopKindLabel(stop.stopType),
    title,
    detail,
  };
}

export function isSchoolDropoffRun(stops?: { stopType?: string }[]): boolean {
  return (stops ?? []).some((stop) => isSchoolDropoffStop(stop.stopType || ''));
}

/** School dropoff runs are AM (0). Every other run is PM (1). */
export function shiftPeriodRank(shift: { stops?: { stopType?: string }[] }): number {
  return isSchoolDropoffRun(shift.stops) ? 0 : 1;
}

export function sortRouteSheetShifts<
  T extends { runDays?: string | null; firstStopTime?: string; stops?: { stopType?: string }[] },
>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) => {
    const byPeriod = shiftPeriodRank(a) - shiftPeriodRank(b);
    if (byPeriod !== 0) return byPeriod;
    const byDay = earliestRunDayRank(a.runDays) - earliestRunDayRank(b.runDays);
    if (byDay !== 0) return byDay;
    return (a.firstStopTime || '').localeCompare(b.firstStopTime || '');
  });
}

export interface LabeledValue {
  label: string;
  value: string;
}

export function routeRunFields(route: BusRoute, shift: BusRouteShift, schools: School[] = []): LabeledValue[] {
  const driverLine = [shift.driverName || route.driverName, shift.driverPhone || route.driverPhone]
    .filter(Boolean)
    .join(' · ');
  const vehicleLine = [shift.unitNumber || route.unitNumber, shift.plateNumber || route.plateNumber]
    .filter(Boolean)
    .join(' · ');
  const attendantLine = [shift.attendantName || route.attendantName, shift.attendantPhone || route.attendantPhone]
    .filter(Boolean)
    .join(' · ');
  return [
    { label: 'Start Time', value: formatRouteSheetClock(shift.firstStopTime) },
    { label: 'End Time', value: runDurationLabel(shift.firstStopTime, shift.lastStopTime) },
    { label: 'Riders', value: String(uniqueRiderCount(shift)) },
    { label: 'Stops', value: String(shift.stops.length) },
    { label: 'Description', value: shift.description || route.routeName || '' },
    { label: 'Schools', value: schoolLabel(route, [shift], schools) || shift.shiftSchools || '' },
    { label: 'Driver', value: driverLine },
    { label: 'Vehicle', value: vehicleLine },
    { label: 'Operator', value: route.yardName || '' },
    { label: 'Capacity', value: route.vehicleCapacity ? String(route.vehicleCapacity) : '' },
    { label: 'Attendant', value: attendantLine },
    { label: 'Days', value: formatOpDays(shift.runDays) },
  ];
}

function uniqueRiderCount(shift: BusRouteShift): number {
  const ids = new Set<number>();
  shift.stops.forEach((stop) => {
    stop.assignedStudents?.forEach((student) => {
      if (student.studentId) ids.add(student.studentId);
    });
  });
  return ids.size;
}

export function buildRouteSheetPdf(input: RouteSheetPdfInput): jsPDF {
  const { route, studentsMap } = input;
  const shifts = sortRouteSheetShifts(input.shifts);
  const schools = input.schools ?? [];
  const generatedAt = input.generatedAt ?? new Date();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const width = pageWidth - margin * 2;
  let y = 14;
  let currentShift: BusRouteShift | undefined;
  let inStopTable = false;
  let drawingTableHeader = false;

  const stamp = generatedAt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const drawPageHeader = (shift?: BusRouteShift) => {
    const top = 10;
    try {
      doc.addImage(PCY_TECH_LOGO_DATA_URL, 'JPEG', margin, top, 14, 14);
    } catch {
      // A missing logo still leaves the company name and title.
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('PCY TECH', margin + 18, top + 5);
    doc.setFontSize(7);
    doc.setTextColor(180, 83, 9);
    doc.text('FLEET CLOUD', margin + 50, top + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('School Bus Fleet Operations', margin + 18, top + 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('ROUTE SHEET', pageWidth - margin, top + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const routeLine = shift
      ? `${route.routeNo}  ·  ${shift.shiftType}  ·  ${formatOpDays(shift.runDays)}`
      : route.routeNo;
    doc.text(routeLine, pageWidth - margin, top + 10, { align: 'right' });
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(margin, top + 16, pageWidth - margin, top + 16);
    doc.setLineWidth(0.2);
    return top + 22;
  };

  const ensure = (needed: number) => {
    if (y + needed <= pageHeight - 14) return;
    doc.addPage();
    y = drawPageHeader(currentShift);
    if (inStopTable && !drawingTableHeader) {
      drawingTableHeader = true;
      drawStopTableHeader();
      drawingTableHeader = false;
    }
  };

  const drawPair = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) => {
    const columnWidth = width / 2 - 4;
    const valueWidth = columnWidth - 28;
    const leftLines: string[] = doc.splitTextToSize(leftValue.trim() || '—', valueWidth);
    const rightLines: string[] = doc.splitTextToSize(rightValue.trim() || '—', valueWidth);
    const rowCount = Math.max(leftLines.length, rightLines.length, 1);
    ensure(rowCount * 4.2 + 1.4);
    const top = y;
    const paint = (label: string, lines: string[], x: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(label, x, top);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      lines.forEach((line, index) => {
        doc.text(line, x + 28, top + index * 4.2);
      });
    };
    paint(leftLabel, leftLines, margin);
    paint(rightLabel, rightLines, margin + width / 2);
    y = top + rowCount * 4.2 + 1.6;
  };

  const drawStopTableHeader = () => {
    drawingTableHeader = true;
    ensure(8);
    drawingTableHeader = false;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, width, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const columns = [margin + 1, margin + 10, margin + 32, margin + width - 32, margin + width - 14];
    ['#', 'Time', 'Description (Crossing)', 'Stop Ld', 'Run Ld'].forEach((label, index) => {
      doc.text(label, columns[index], y);
    });
    y += 6;
  };

  const drawStop = (stop: RouteStop, number: number, load: StopBoardCount) => {
    const heading = routeSheetStopHeading(stop);
    const note = [stop.comment, stop.instruction]
      .map((part) => part?.trim() || '')
      .filter(Boolean)
      .join(' ');
    const titleLines: string[] = doc.splitTextToSize(heading.title, width - 78);
    const detailLines: string[] = heading.detail
      ? doc.splitTextToSize(heading.detail, width - 78)
      : [];
    const kindStep = heading.isSchool && heading.kindLabel ? 3.8 : 0;
    const titleStep = Math.max(titleLines.length - 1, 0) * 4;
    const detailStep = detailLines.length * 3.6;
    // Keep the highlight on this stop only; do not include the gap before the next stop.
    const bandTopPad = 2.6;
    const bandBottomPad = 1.8;
    const bandHeight = bandTopPad + kindStep + titleStep + detailStep + bandBottomPad;
    ensure(Math.max(8, bandHeight + 4));
    const rowY = y;
    if (heading.isSchool) {
      doc.setFillColor(255, 247, 237);
      doc.rect(margin, rowY - bandTopPad, width, bandHeight, 'F');
      doc.setFillColor(245, 158, 11);
      doc.rect(margin, rowY - bandTopPad, 1.6, bandHeight, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(heading.isSchool ? 146 : 15, heading.isSchool ? 64 : 23, heading.isSchool ? 14 : 42);
    doc.text(String(number), margin + 1, rowY);
    doc.text(formatRouteSheetClock(stop.pullawayTime), margin + 10, rowY);
    if (heading.isSchool && heading.kindLabel) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      doc.text(heading.kindLabel, margin + 32, y);
      y += kindStep;
    }
    titleLines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        y += 4;
        ensure(5);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(heading.isSchool ? 10 : 9);
      doc.setTextColor(heading.isSchool ? 120 : 15, heading.isSchool ? 53 : 23, heading.isSchool ? 15 : 42);
      doc.text(line, margin + 32, y);
    });
    detailLines.forEach((line) => {
      y += 3.6;
      ensure(5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(line, margin + 32, y);
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(String(load.stopLoad), margin + width - 32, rowY);
    doc.text(String(load.runLoad), margin + width - 14, rowY);
    // Extra space after the school band so the next stop number stays clear.
    y += heading.isSchool ? 5.5 : 4.5;
    if (note) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const noteLines: string[] = doc.splitTextToSize(`NOTE: ${note}`, width - 40);
      noteLines.forEach((line) => {
        ensure(4);
        doc.text(line, margin + 32, y);
        y += 3.8;
      });
    }

    (stop.assignedStudents ?? []).forEach((assigned) => {
      const student = studentsMap[assigned.studentId];
      const columns = studentSheetColumns(student, assigned.studentName || assigned.studentNo);
      const studentLeft = margin + 32;
      const studentWidth = pageWidth - margin - studentLeft;
      const gap = 5;
      const hasRight = columns.right.length > 0;
      const colWidth = hasRight ? (studentWidth - gap) / 2 : studentWidth;
      const rightX = studentLeft + colWidth + gap;

      const wrapColumn = (lines: SheetLine[], maxWidth: number) =>
        lines.flatMap((line) => {
          const parts: string[] = doc.splitTextToSize(line.text, maxWidth);
          return parts.map((text, index) => ({
            text,
            bold: !!line.bold && index === 0,
          }));
        });

      const leftParts = wrapColumn(columns.left, colWidth);
      const rightParts = hasRight ? wrapColumn(columns.right, colWidth) : [];
      const rowCount = Math.max(leftParts.length, rightParts.length, 1);
      ensure(rowCount * 3.6 + 1.4);
      const top = y;

      const paint = (parts: { text: string; bold: boolean }[], x: number) => {
        parts.forEach((part, index) => {
          doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(part.text, x, top + index * 3.6);
        });
      };
      paint(leftParts, studentLeft);
      if (hasRight) paint(rightParts, rightX);
      y = top + rowCount * 3.6 + 1.4;
    });
    y += 1.5;
  };

  const drawRun = (shift: BusRouteShift) => {
    const ordered = [...shift.stops].sort((a, b) => a.sequence - b.sequence);
    const loads = boardCountsForStops(
      ordered.map((stop) => ({
        stopType: stop.stopType,
        studentCount: stop.assignedStudents?.length ?? 0,
      })),
    );
    const fields = routeRunFields(route, shift, schools);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    ensure(8);
    doc.text(`Run ${route.routeNo}-${shift.shiftType}`, margin, y);
    y += 6;

    for (let index = 0; index < fields.length; index += 2) {
      const left = fields[index];
      const right = fields[index + 1];
      drawPair(left.label, left.value, right?.label || '', right?.value || '');
    }
    if (route.instructions?.trim()) {
      ensure(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Driver Notes', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const noteLines: string[] = doc.splitTextToSize(route.instructions.trim(), width - 28);
      noteLines.forEach((line, index) => {
        if (index > 0) {
          y += 4;
          ensure(5);
        }
        doc.text(line, margin + 28, y);
      });
      y += 5;
    }
    y += 1;
    inStopTable = true;
    drawStopTableHeader();
    ordered.forEach((stop, index) => {
      drawStop(stop, index + 1, loads[index]);
    });
    inStopTable = false;
  };

  const runs = shifts.length > 0 ? shifts : [];
  if (runs.length === 0) {
    y = drawPageHeader();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('No runs are assigned to this route.', margin, y);
  } else {
    runs.forEach((shift, index) => {
      currentShift = shift;
      if (index > 0) doc.addPage();
      y = drawPageHeader(shift);
      drawRun(shift);
    });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Route Details', margin, pageHeight - 8);
    doc.text(stamp, margin + 28, pageHeight - 8);
    doc.text(`${page} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }
  return doc;
}

export function routeSheetPdfBase64(input: RouteSheetPdfInput): string {
  const dataUri = buildRouteSheetPdf(input).output('datauristring');
  const marker = 'base64,';
  const index = dataUri.indexOf(marker);
  return index >= 0 ? dataUri.slice(index + marker.length) : dataUri;
}
