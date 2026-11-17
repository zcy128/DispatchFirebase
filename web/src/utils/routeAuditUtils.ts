import { BusRoute, BusRouteShift, RouteStop } from '../types/route';
import { Employee } from '../types/employee';
import { School } from '../types/school';
import { Vehicle } from '../types/vehicle';
import { getLocalTodayString } from './dateUtils';

export type RouteAuditIssueType =
  | 'EMPTY_STOP'
  | 'SCHOOL_STOP_MISSING_STUDENT'
  | 'SCHOOL_STOP_MISMATCH'
  | 'DUPLICATE_STUDENT_IN_ROUTE'
  | 'CROSS_SHIFT_DUPLICATE_STUDENT'
  | 'MULTI_ROUTE_TIME_CONFLICT'
  | 'INACTIVE_CREW_OR_VEHICLE';

export type RouteAuditFilter =
  | 'ALL'
  | 'ANY_ISSUE'
  | RouteAuditIssueType
  | 'MULTI_ROUTE_SHARED';

export interface RouteAuditIssue {
  id: string;
  type: RouteAuditIssueType;
  routeId: string;
  routeNo: string;
  shiftId?: string;
  shiftType?: string;
  stopLocation?: string;
  studentId?: number;
  studentNo?: string;
  studentName?: string;
  schoolName?: string;
  otherRouteNo?: string;
  entityName?: string;
  message: string;
  canIgnore?: boolean;
  ignored?: boolean;
}

export interface RouteAuditResult {
  routeId: string;
  issues: RouteAuditIssue[];
  ignoredIssues: RouteAuditIssue[];
  isMultiRouteShared: boolean;
  sharedReasons: string[];
}

export interface RouteAuditSummary {
  byRouteId: Map<string, RouteAuditResult>;
  counts: {
    anyIssue: number;
    EMPTY_STOP: number;
    SCHOOL_STOP_MISSING_STUDENT: number;
    SCHOOL_STOP_MISMATCH: number;
    DUPLICATE_STUDENT_IN_ROUTE: number;
    CROSS_SHIFT_DUPLICATE_STUDENT: number;
    MULTI_ROUTE_TIME_CONFLICT: number;
    INACTIVE_CREW_OR_VEHICLE: number;
    MULTI_ROUTE_SHARED: number;
  };
}

function normalizeDateOnly(raw?: string): string {
  if (!raw) return '';
  return raw.trim().slice(0, 10);
}

export function isEffectiveOnOrBefore(
  effectiveDate?: string,
  retireDate?: string,
  todayStr: string = getLocalTodayString()
): boolean {
  const eff = normalizeDateOnly(effectiveDate);
  if (eff && /^\d{4}-\d{2}-\d{2}$/.test(eff) && eff > todayStr) {
    return false;
  }
  const ret = normalizeDateOnly(retireDate);
  if (ret && /^\d{4}-\d{2}-\d{2}$/.test(ret) && ret < todayStr) {
    return false;
  }
  return true;
}

function normalizeLoc(raw?: string): string {
  return (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isSchoolStop(stop: RouteStop, schools?: School[]): boolean {
  if (typeof stop.schoolId === 'number' && stop.schoolId > 0) return true;
  if (stop.schoolName && stop.schoolName.trim().length > 0) return true;
  if (/school/i.test(stop.stopType || '')) return true;
  if (schools && schools.length > 0) {
    const loc = normalizeLoc(stop.stopLocation);
    if (loc) {
      return schools.some((sch) => {
        const addr = normalizeLoc(sch.schoolAddress);
        const name = normalizeLoc(sch.schoolName);
        return (addr && (loc === addr || loc.startsWith(addr) || addr.startsWith(loc))) ||
          (name && (loc === name || loc.includes(name)));
      });
    }
  }
  return false;
}

function normalizeShiftType(shiftType?: string): string {
  const s = (shiftType || '').trim().toUpperCase();
  if (s === 'NOON' || s === 'MIDDAY') return 'MIDDAY';
  return s || 'AM';
}

export function parseTimeToMinutes(raw?: string): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

export function runDaysOverlap(a?: string, b?: string): boolean {
  const norm = (v?: string) => {
    const s = (v || 'MTWRF').trim().toUpperCase();
    const set = new Set<string>();
    for (const ch of ['M', 'T', 'W', 'R', 'F']) {
      if (s.includes(ch)) set.add(ch);
    }
    if (set.size === 0) {
      for (const ch of ['M', 'T', 'W', 'R', 'F']) set.add(ch);
    }
    return set;
  };
  const setA = norm(a);
  const setB = norm(b);
  for (const ch of setA) {
    if (setB.has(ch)) return true;
  }
  return false;
}

export function shiftTimesOverlap(
  a: Pick<BusRouteShift, 'firstStopTime' | 'lastStopTime' | 'runDays' | 'shiftType'>,
  b: Pick<BusRouteShift, 'firstStopTime' | 'lastStopTime' | 'runDays' | 'shiftType'>
): boolean {
  if (!runDaysOverlap(a.runDays, b.runDays)) return false;
  const startA = parseTimeToMinutes(a.firstStopTime);
  const endA = parseTimeToMinutes(a.lastStopTime);
  const startB = parseTimeToMinutes(b.firstStopTime);
  const endB = parseTimeToMinutes(b.lastStopTime);

  if (startA !== null && endA !== null && startB !== null && endB !== null) {
    const safeEndA = endA >= startA ? endA : startA;
    const safeEndB = endB >= startB ? endB : startB;
    return startA < safeEndB && startB < safeEndA;
  }

  return normalizeShiftType(a.shiftType) === normalizeShiftType(b.shiftType);
}

function normalizeIdentifier(id?: string, name?: string): string {
  const cleanId = (id || '').trim().toLowerCase();
  if (cleanId && cleanId !== '0' && cleanId !== 'tbd' && cleanId !== 'unassigned') {
    return cleanId;
  }
  const cleanName = (name || '').trim().toLowerCase();
  if (cleanName && cleanName !== 'tbd' && cleanName !== 'unassigned' && cleanName !== 'non assigné') {
    return cleanName;
  }
  return '';
}

function normalizeVehicleKey(vehicleId?: number, unitNumber?: string): string {
  const unit = (unitNumber || '').trim().toLowerCase();
  if (unit && unit !== 'tbd' && unit !== 'unassigned') return `unit:${unit}`;
  if (typeof vehicleId === 'number' && vehicleId > 0) return `id:${vehicleId}`;
  return '';
}

/**
 * Runs all 6 structural, student, crew/vehicle, and inactive-resource audit checks
 * across active routes and their shifts.
 */
export function runRouteAudit(params: {
  routes: BusRoute[];
  shifts: BusRouteShift[];
  employees?: Employee[];
  vehicles?: Vehicle[];
  schools?: School[];
  todayStr?: string;
}): RouteAuditSummary {
  const { routes, shifts, employees = [], vehicles = [], schools = [], todayStr = getLocalTodayString() } = params;

  const byRouteId = new Map<string, RouteAuditResult>();
  const activeRoutes = routes.filter((r) => r.active !== false);
  const routeById = new Map<string, BusRoute>();
  for (const r of activeRoutes) {
    routeById.set(r.id, r);
    byRouteId.set(r.id, {
      routeId: r.id,
      issues: [],
      ignoredIssues: [],
      isMultiRouteShared: false,
      sharedReasons: [],
    });
  }

  const shiftsByRouteId = new Map<string, BusRouteShift[]>();
  for (const sh of shifts) {
    if (sh.active === false) continue;
    if (!isEffectiveOnOrBefore(sh.effectiveDate, sh.retireDate, todayStr)) continue;
    if (!routeById.has(sh.routeId)) continue;
    const list = shiftsByRouteId.get(sh.routeId) || [];
    list.push(sh);
    shiftsByRouteId.set(sh.routeId, list);
  }

  // Build employee and vehicle lookup maps for Check #6 (Inactive)
  const employeeByKey = new Map<string, Employee>();
  for (const emp of employees) {
    if (emp.id) employeeByKey.set(emp.id.trim().toLowerCase(), emp);
    if (emp.employeeNumber) employeeByKey.set(emp.employeeNumber.trim().toLowerCase(), emp);
    if (emp.fullName) employeeByKey.set(emp.fullName.trim().toLowerCase(), emp);
  }

  const vehicleByKey = new Map<string, Vehicle>();
  for (const v of vehicles) {
    if (v.unitNumber) vehicleByKey.set(`unit:${v.unitNumber.trim().toLowerCase()}`, v);
    if (typeof v.vehicleId === 'number' && v.vehicleId > 0) vehicleByKey.set(`id:${v.vehicleId}`, v);
  }

  // Track cross-shift student appearances (Check #4)
  interface StudentShiftOccurrence {
    routeId: string;
    routeNo: string;
    shiftType: string;
    runDays: string;
    studentId: number;
    studentName: string;
  }
  const studentOccurrences = new Map<string, StudentShiftOccurrence[]>();

  // Track multi-route crew & vehicle assignments (Check #5 + Multi-route quick filter)
  interface AssignmentRef {
    routeId: string;
    routeNo: string;
    label: string;
    shifts: BusRouteShift[];
  }
  const driverAssignments = new Map<string, AssignmentRef[]>();
  const attendantAssignments = new Map<string, AssignmentRef[]>();
  const vehicleAssignments = new Map<string, AssignmentRef[]>();

  for (const route of activeRoutes) {
    const res = byRouteId.get(route.id)!;
    const routeShifts = shiftsByRouteId.get(route.id) || [];
    const ignoredSet = new Set<number>(route.ignoredDuplicateStudentIds || []);

    // Check #6: Inactive driver, attendant, or vehicle
    const drvKey = normalizeIdentifier(route.driverId, route.driverName);
    if (drvKey) {
      const emp = employeeByKey.get(drvKey);
      if (emp && !emp.isActive) {
        res.issues.push({
          id: `${route.id}:inactive-driver:${drvKey}`,
          type: 'INACTIVE_CREW_OR_VEHICLE',
          routeId: route.id,
          routeNo: route.routeNo,
          entityName: route.driverName || emp.fullName,
          message: `Assigned driver "${route.driverName || emp.fullName}" is inactive.`,
        });
      }
      const list = driverAssignments.get(drvKey) || [];
      list.push({ routeId: route.id, routeNo: route.routeNo, label: route.driverName || route.driverId || drvKey, shifts: routeShifts });
      driverAssignments.set(drvKey, list);
    }

    const attKey = normalizeIdentifier(route.attendantId, route.attendantName);
    if (attKey) {
      const emp = employeeByKey.get(attKey);
      if (emp && !emp.isActive) {
        res.issues.push({
          id: `${route.id}:inactive-attendant:${attKey}`,
          type: 'INACTIVE_CREW_OR_VEHICLE',
          routeId: route.id,
          routeNo: route.routeNo,
          entityName: route.attendantName || emp.fullName,
          message: `Assigned attendant "${route.attendantName || emp.fullName}" is inactive.`,
        });
      }
      const list = attendantAssignments.get(attKey) || [];
      list.push({ routeId: route.id, routeNo: route.routeNo, label: route.attendantName || route.attendantId || attKey, shifts: routeShifts });
      attendantAssignments.set(attKey, list);
    }

    const vehKey = normalizeVehicleKey(route.vehicleId, route.unitNumber);
    if (vehKey) {
      const veh = vehicleByKey.get(vehKey);
      if (veh && ((!veh.active && veh.status !== '') || /inactive|retired|out of service/i.test(veh.status || ''))) {
        res.issues.push({
          id: `${route.id}:inactive-vehicle:${vehKey}`,
          type: 'INACTIVE_CREW_OR_VEHICLE',
          routeId: route.id,
          routeNo: route.routeNo,
          entityName: route.unitNumber || veh.unitNumber,
          message: `Assigned vehicle Unit #${route.unitNumber || veh.unitNumber} is ${veh.status || 'inactive'}.`,
        });
      }
      const list = vehicleAssignments.get(vehKey) || [];
      list.push({ routeId: route.id, routeNo: route.routeNo, label: `Unit #${route.unitNumber || route.vehicleId}`, shifts: routeShifts });
      vehicleAssignments.set(vehKey, list);
    }

    // Per-shift checks: #1 Empty Stop, #2 School Stop Mismatch, #3 Duplicate Student in Route, #4 Collect Cross-Shift
    for (const sh of routeShifts) {
      const effectiveStops = (sh.stops || []).filter((st) =>
        isEffectiveOnOrBefore(st.effectiveDate, st.retireDate, todayStr)
      );

      const homeStudents = new Map<
        number,
        { studentId: number; studentNo: string; studentName: string; schoolName?: string }
      >();
      const schoolStudents = new Map<number, string>();
      const homeStopCountByStudent = new Map<number, { name: string; count: number; locations: string[] }>();
      let hasHomeStop = false;
      let hasSchoolStop = false;

      for (const st of effectiveStops) {
        const students = st.assignedStudents || [];
        const school = isSchoolStop(st, schools);
        // Check #1: Empty stop (only flag non-school stops; school stops are checked by Check #2)
        if (students.length === 0 && !school) {
          res.issues.push({
            id: `${route.id}:empty-stop:${sh.id}:${st.stopId}:${st.sequence}`,
            type: 'EMPTY_STOP',
            routeId: route.id,
            routeNo: route.routeNo,
            shiftType: sh.shiftType,
            stopLocation: st.stopLocation || `Stop #${st.sequence}`,
            message: `${sh.shiftType} stop "${st.stopLocation || `#${st.sequence}`}" has 0 assigned students.`,
          });
        }

        if (school) hasSchoolStop = true;
        else hasHomeStop = true;

        for (const stu of students) {
          if (!stu || !stu.studentId) continue;
          if (school) {
            schoolStudents.set(stu.studentId, stu.studentName);
          } else {
            homeStudents.set(stu.studentId, {
              studentId: stu.studentId,
              studentNo: stu.studentNo || '',
              studentName: stu.studentName,
              schoolName: stu.schoolName,
            });
            const entry = homeStopCountByStudent.get(stu.studentId) || {
              name: stu.studentName,
              count: 0,
              locations: [],
            };
            entry.count += 1;
            entry.locations.push(st.stopLocation || `Stop #${st.sequence}`);
            homeStopCountByStudent.set(stu.studentId, entry);
          }

          // Record for Check #4 (Cross-Shift Duplicate Student)
          const normShift = normalizeShiftType(sh.shiftType);
          const occKey = `${stu.studentId}:${normShift}`;
          const occList = studentOccurrences.get(occKey) || [];
          if (!occList.some((o) => o.routeId === route.id && o.shiftType === normShift)) {
            occList.push({
              routeId: route.id,
              routeNo: route.routeNo,
              shiftType: normShift,
              runDays: sh.runDays || 'MTWRF',
              studentId: stu.studentId,
              studentName: stu.studentName,
            });
            studentOccurrences.set(occKey, occList);
          }
        }
      }

      // Check #2: School stop missing student vs. home stop missing student within shift
      if (hasHomeStop && hasSchoolStop) {
        for (const [stuId, stuInfo] of homeStudents.entries()) {
          if (!schoolStudents.has(stuId)) {
            res.issues.push({
              id: `${route.id}:school-missing-student:${sh.id}:${stuId}`,
              type: 'SCHOOL_STOP_MISSING_STUDENT',
              routeId: route.id,
              routeNo: route.routeNo,
              shiftId: sh.id,
              shiftType: sh.shiftType,
              studentId: stuId,
              studentNo: stuInfo.studentNo,
              studentName: stuInfo.studentName,
              schoolName: stuInfo.schoolName,
              message: `${sh.shiftType}: "${stuInfo.studentName}" has a home stop but is missing from the school stop.`,
            });
          }
        }
        for (const [stuId, stuName] of schoolStudents.entries()) {
          if (!homeStudents.has(stuId)) {
            res.issues.push({
              id: `${route.id}:school-mismatch:missing-home:${sh.id}:${stuId}`,
              type: 'SCHOOL_STOP_MISMATCH',
              routeId: route.id,
              routeNo: route.routeNo,
              shiftId: sh.id,
              shiftType: sh.shiftType,
              studentId: stuId,
              studentName: stuName,
              message: `${sh.shiftType}: "${stuName}" is on the school stop but missing a home stop.`,
            });
          }
        }
      }

      // Check #3: Same student has 2+ home stops in this route/shift (can be ignored for shared custody)
      for (const [stuId, entry] of homeStopCountByStudent.entries()) {
        if (entry.count >= 2) {
          const isIgnored = ignoredSet.has(stuId);
          const issue: RouteAuditIssue = {
            id: `${route.id}:dup-student:${sh.id}:${stuId}`,
            type: 'DUPLICATE_STUDENT_IN_ROUTE',
            routeId: route.id,
            routeNo: route.routeNo,
            shiftType: sh.shiftType,
            studentId: stuId,
            studentName: entry.name,
            canIgnore: true,
            ignored: isIgnored,
            message: `${sh.shiftType}: "${entry.name}" appears on ${entry.count} stops (${entry.locations.join(' & ')}).`,
          };
          if (isIgnored) {
            res.ignoredIssues.push(issue);
          } else {
            res.issues.push(issue);
          }
        }
      }
    }
  }

  // Check #4: Same student on different routes in the same shiftType on overlapping runDays
  for (const occs of studentOccurrences.values()) {
    if (occs.length < 2) continue;
    for (let i = 0; i < occs.length; i++) {
      for (let j = i + 1; j < occs.length; j++) {
        const a = occs[i];
        const b = occs[j];
        if (!runDaysOverlap(a.runDays, b.runDays)) continue;
        byRouteId.get(a.routeId)?.issues.push({
          id: `${a.routeId}:cross-shift:${a.shiftType}:${a.studentId}:${b.routeNo}`,
          type: 'CROSS_SHIFT_DUPLICATE_STUDENT',
          routeId: a.routeId,
          routeNo: a.routeNo,
          shiftType: a.shiftType,
          studentId: a.studentId,
          studentName: a.studentName,
          otherRouteNo: b.routeNo,
          message: `${a.shiftType}: "${a.studentName}" also appears on route ${b.routeNo} on the same operating days.`,
        });
        byRouteId.get(b.routeId)?.issues.push({
          id: `${b.routeId}:cross-shift:${b.shiftType}:${b.studentId}:${a.routeNo}`,
          type: 'CROSS_SHIFT_DUPLICATE_STUDENT',
          routeId: b.routeId,
          routeNo: b.routeNo,
          shiftType: b.shiftType,
          studentId: b.studentId,
          studentName: b.studentName,
          otherRouteNo: a.routeNo,
          message: `${b.shiftType}: "${b.studentName}" also appears on route ${a.routeNo} on the same operating days.`,
        });
      }
    }
  }

  // Check #5: Multi-route crew/vehicle sharing + time-overlap conflict check
  const evaluateMultiRouteGroup = (map: Map<string, AssignmentRef[]>, kindLabel: string) => {
    for (const refs of map.values()) {
      if (refs.length < 2) continue;
      for (const ref of refs) {
        const res = byRouteId.get(ref.routeId);
        if (res) {
          res.isMultiRouteShared = true;
          const others = refs.filter((o) => o.routeId !== ref.routeId).map((o) => o.routeNo);
          res.sharedReasons.push(`${kindLabel} ${ref.label} (${others.join(', ')})`);
        }
      }

      for (let i = 0; i < refs.length; i++) {
        for (let j = i + 1; j < refs.length; j++) {
          const a = refs[i];
          const b = refs[j];
          for (const shA of a.shifts) {
            for (const shB of b.shifts) {
              if (shiftTimesOverlap(shA, shB)) {
                byRouteId.get(a.routeId)?.issues.push({
                  id: `${a.routeId}:overlap:${kindLabel}:${shA.id}:${b.routeNo}:${shB.id}`,
                  type: 'MULTI_ROUTE_TIME_CONFLICT',
                  routeId: a.routeId,
                  routeNo: a.routeNo,
                  shiftType: shA.shiftType,
                  otherRouteNo: b.routeNo,
                  entityName: a.label,
                  message: `${kindLabel} "${a.label}" overlaps with ${b.routeNo} (${shA.shiftType} ${shA.firstStopTime}-${shA.lastStopTime} vs ${shB.firstStopTime}-${shB.lastStopTime}).`,
                });
                byRouteId.get(b.routeId)?.issues.push({
                  id: `${b.routeId}:overlap:${kindLabel}:${shB.id}:${a.routeNo}:${shA.id}`,
                  type: 'MULTI_ROUTE_TIME_CONFLICT',
                  routeId: b.routeId,
                  routeNo: b.routeNo,
                  shiftType: shB.shiftType,
                  otherRouteNo: a.routeNo,
                  entityName: b.label,
                  message: `${kindLabel} "${b.label}" overlaps with ${a.routeNo} (${shB.shiftType} ${shB.firstStopTime}-${shB.lastStopTime} vs ${shA.firstStopTime}-${shA.lastStopTime}).`,
                });
              }
            }
          }
        }
      }
    }
  };

  evaluateMultiRouteGroup(driverAssignments, 'Driver');
  evaluateMultiRouteGroup(attendantAssignments, 'Attendant');
  evaluateMultiRouteGroup(vehicleAssignments, 'Vehicle');

  const counts: RouteAuditSummary['counts'] = {
    anyIssue: 0,
    EMPTY_STOP: 0,
    SCHOOL_STOP_MISSING_STUDENT: 0,
    SCHOOL_STOP_MISMATCH: 0,
    DUPLICATE_STUDENT_IN_ROUTE: 0,
    CROSS_SHIFT_DUPLICATE_STUDENT: 0,
    MULTI_ROUTE_TIME_CONFLICT: 0,
    INACTIVE_CREW_OR_VEHICLE: 0,
    MULTI_ROUTE_SHARED: 0,
  };

  for (const res of byRouteId.values()) {
    if (res.isMultiRouteShared) counts.MULTI_ROUTE_SHARED += 1;
    if (res.issues.length > 0) {
      counts.anyIssue += 1;
      const types = new Set(res.issues.map((i) => i.type));
      for (const t of types) {
        counts[t] += 1;
      }
    }
  }

  return { byRouteId, counts };
}

export function matchesRouteAuditFilter(
  routeId: string,
  summary: RouteAuditSummary,
  filter: RouteAuditFilter
): boolean {
  if (filter === 'ALL') return true;
  const res = summary.byRouteId.get(routeId);
  if (!res) return false;
  if (filter === 'MULTI_ROUTE_SHARED') return res.isMultiRouteShared;
  if (filter === 'ANY_ISSUE') return res.issues.length > 0;
  return res.issues.some((i) => i.type === filter);
}

/**
 * Builds an updated `stops` array for `shift` with missing home-stop students added to the
 * matching school stop in that shift. Returns `null` if no changes are needed.
 */
export function buildFixedShiftStopsForMissingSchoolStudents(
  shift: BusRouteShift,
  targetStudentIds?: number[],
  studentsMap?: Record<number, { schoolId?: number; schoolName?: string; studentNo?: string }>,
  todayStr: string = getLocalTodayString(),
  schools?: School[]
): RouteStop[] | null {
  const stops = shift.stops || [];
  if (stops.length === 0 || !isEffectiveOnOrBefore(shift.effectiveDate, shift.retireDate, todayStr)) {
    return null;
  }

  const schoolStopIndices: number[] = [];
  const schoolStudentIds = new Set<number>();
  const homeStudents = new Map<
    number,
    { studentId: number; studentNo: string; studentName: string; schoolName?: string }
  >();

  stops.forEach((st, idx) => {
    if (!isEffectiveOnOrBefore(st.effectiveDate, st.retireDate, todayStr)) return;
    const assigned = st.assignedStudents || [];
    if (isSchoolStop(st, schools)) {
      schoolStopIndices.push(idx);
      for (const stu of assigned) {
        if (stu?.studentId) schoolStudentIds.add(stu.studentId);
      }
    } else {
      for (const stu of assigned) {
        if (stu?.studentId && !homeStudents.has(stu.studentId)) {
          homeStudents.set(stu.studentId, {
            studentId: stu.studentId,
            studentNo: stu.studentNo || '',
            studentName: stu.studentName,
            schoolName: stu.schoolName,
          });
        }
      }
    }
  });

  if (schoolStopIndices.length === 0 || homeStudents.size === 0) {
    return null;
  }

  const targetSet = targetStudentIds && targetStudentIds.length > 0 ? new Set(targetStudentIds) : null;
  const nextStops: RouteStop[] = stops.map((st) => ({
    ...st,
    assignedStudents: st.assignedStudents ? [...st.assignedStudents] : [],
  }));

  let changed = false;

  for (const [stuId, stuInfo] of homeStudents.entries()) {
    if (schoolStudentIds.has(stuId)) continue;
    if (targetSet && !targetSet.has(stuId)) continue;

    const studentRecord = studentsMap?.[stuId];
    const desiredSchoolId = studentRecord?.schoolId;
    const desiredSchoolName = (stuInfo.schoolName || studentRecord?.schoolName || '').trim().toLowerCase();

    let chosenIdx = schoolStopIndices[0];
    if (schoolStopIndices.length > 1) {
      const matchedIdx = schoolStopIndices.find((idx) => {
        const schStop = nextStops[idx];
        if (desiredSchoolId && schStop.schoolId && schStop.schoolId === desiredSchoolId) return true;
        if (!desiredSchoolName) return false;
        const stopSchName = (schStop.schoolName || '').trim().toLowerCase();
        const stopLoc = (schStop.stopLocation || '').trim().toLowerCase();
        return stopSchName === desiredSchoolName || stopLoc.includes(desiredSchoolName);
      });
      if (matchedIdx !== undefined) {
        chosenIdx = matchedIdx;
      }
    }

    const targetStop = nextStops[chosenIdx];
    const assignedList = targetStop.assignedStudents || [];
    if (!assignedList.some((s) => s.studentId === stuId)) {
      assignedList.push({
        studentId: stuId,
        studentNo: stuInfo.studentNo || studentRecord?.studentNo || '',
        studentName: stuInfo.studentName,
        schoolName: stuInfo.schoolName || studentRecord?.schoolName || targetStop.schoolName,
      });
      targetStop.assignedStudents = assignedList;
      schoolStudentIds.add(stuId);
      changed = true;
    }
  }

  return changed ? nextStops : null;
}
