import { StagingRoute, StagingStop } from '../services/busplannerService';
import { BusRoute, BusRouteShift, RouteStop } from '../types/route';
import { Student } from '../types/student';
import { buildRouteSheetPdf, routeSheetFileName, RouteSheetPdfInput } from './routeSheetPdf';

function compactStopType(stopType: string): string {
  return stopType.toLowerCase().replace(/[\s_-]/g, '');
}

function isHomeStop(stopType: string): boolean {
  const type = compactStopType(stopType);
  return type.includes('home') || type === '0' || type === '1';
}

function isSchoolStop(stopType: string): boolean {
  const type = compactStopType(stopType);
  if (isHomeStop(stopType)) return false;
  return type.includes('school') || type === '2' || type === '3';
}

/** A run that boards at home and later unloads at school is the morning sheet. */
export function isStagingSchoolDropoff(stops: StagingStop[]): boolean {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence || a.time.localeCompare(b.time));
  let sawHome = false;
  for (const stop of ordered) {
    if (isHomeStop(stop.stopType)) sawHome = true;
    if (isSchoolStop(stop.stopType) && sawHome) return true;
  }
  return false;
}

function sheetStopType(stopType: string, schoolDropoff: boolean): string {
  const type = compactStopType(stopType);
  if (type.includes('drop') || type.includes('pickup')) return stopType;
  if (isSchoolStop(stopType)) return schoolDropoff ? 'SchoolDropoff' : 'SchoolPickup';
  if (isHomeStop(stopType)) return schoolDropoff ? 'HomePickup' : 'HomeDropoff';
  return stopType || 'Stop';
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export function stagingRouteToSheetInput(route: StagingRoute): RouteSheetPdfInput {
  const studentsMap: Record<number, Student> = {};
  const studentIds = new Map<string, number>();
  let nextStudentId = 1;
  const studentNumber = (key: string) => {
    const existing = studentIds.get(key);
    if (existing) return existing;
    const id = nextStudentId;
    nextStudentId += 1;
    studentIds.set(key, id);
    return id;
  };

  const shifts: BusRouteShift[] = route.shifts.map((shift, shiftIndex) => {
    const schoolDropoff = isStagingSchoolDropoff(shift.stops);
    const stops: RouteStop[] = [...shift.stops]
      .sort((a, b) => a.sequence - b.sequence || a.time.localeCompare(b.time))
      .map((stop, stopIndex) => ({
        stopId: stopIndex + 1,
        sequence: stop.sequence || stopIndex + 1,
        stopLocation: stop.location,
        pullawayTime: stop.time,
        stopType: sheetStopType(stop.stopType, schoolDropoff),
        instruction: stop.instruction,
        latitude: stop.latitude ? Number(stop.latitude) : undefined,
        longitude: stop.longitude ? Number(stop.longitude) : undefined,
        assignedStudents: stop.students.map((student) => {
          const key = `${student.id}|${student.name}`;
          const studentId = studentNumber(key);
          const { firstName, lastName } = splitName(student.name);
          studentsMap[studentId] = {
            id: student.id || key,
            studentId,
            studentNo: student.id,
            firstName,
            lastName,
            studentName: student.name,
            fullName: student.name,
            studentAddress: '',
            grade: student.grade || '',
            active: true,
            metatBus: false,
            schoolId: 0,
            schoolName: student.schoolName || '',
          };
          return {
            studentId,
            studentNo: student.id,
            studentName: student.name,
            schoolName: student.schoolName,
          };
        }),
      }));

    return {
      id: shift.id,
      shiftId: shiftIndex + 1,
      routeId: route.id,
      routeNo: route.routeNo,
      routeName: route.routeName,
      shiftType: shift.shiftType,
      shiftSchools: shift.schools,
      description: shift.description,
      runDays: shift.runDays,
      effectiveDate: shift.effectiveDate,
      retireDate: shift.retireDate,
      firstStopTime: shift.firstStopTime,
      lastStopTime: shift.lastStopTime,
      stops,
    };
  });

  const notes = [...new Set(route.shifts.map((shift) => shift.instruction.trim()).filter(Boolean))];
  const sheetRoute: BusRoute = {
    id: route.id,
    busRouteId: 0,
    routeNo: route.routeNo,
    routeName: route.routeName,
    active: route.active,
    schoolBoardId: 0,
    schoolBoardCode: '',
    yardId: 0,
    yardName: route.operatorId,
    totalStops: route.totalStops,
    totalStudents: route.totalStudents,
    instructions: notes.join(' '),
  };

  return { route: sheetRoute, shifts, studentsMap, schools: [] };
}

export function downloadStagingRouteSheet(route: StagingRoute) {
  const input = stagingRouteToSheetInput(route);
  const doc = buildRouteSheetPdf(input);
  doc.save(routeSheetFileName(input.route.routeNo));
}
