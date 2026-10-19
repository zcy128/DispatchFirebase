import { BusRouteShift, RouteStop } from '../types/route';
import { Student, StudentStop } from '../types/student';
import { School } from '../types/school';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { RouteService } from './routeService';

export interface AssignmentTarget {
  type: 'route' | 'shift';
  routeId: string;
  routeNo: string;
  shiftId?: string;
  label: string;
}

export interface AssignmentResult {
  success: boolean;
  error?: string;
  message: string;
  updatedShifts: BusRouteShift[];
  generatedStudentStops: StudentStop[];
  assignedRouteNos: string[];
}

/**
 * Extracts individual operational days into a set (M, T, W, R, F)
 */
export function parseRunDays(daysStr?: string): Set<string> {
  const result = new Set<string>();
  if (!daysStr) return result;

  const upper = daysStr.toUpperCase();
  const dayTokens = ['M', 'T', 'W', 'R', 'F'];
  for (const token of dayTokens) {
    if (upper.includes(token)) {
      result.add(token);
    }
  }
  return result;
}

/**
 * Checks whether two runDays strings share any common operating days
 */
export function doRunDaysOverlap(daysA?: string, daysB?: string): boolean {
  const setA = parseRunDays(daysA);
  const setB = parseRunDays(daysB);
  for (const day of setA) {
    if (setB.has(day)) {
      return true;
    }
  }
  return false;
}

/**
 * Parses time string (e.g. "08:30", "7:10 a.m.", "2:40 p.m.") into minutes from midnight
 */
export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 8 * 60; // Default 08:00 AM

  const clean = timeStr.trim().toLowerCase();
  const isPM = clean.includes('p.m.') || clean.includes('pm');
  const isAM = clean.includes('a.m.') || clean.includes('am');

  const numbersOnly = clean.replace(/[^0-9:]/g, '');
  const parts = numbersOnly.split(':');
  if (parts.length === 0) return 8 * 60;

  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

/**
 * Formats minutes from midnight into 12-hour format e.g. "7:10 a.m." or "2:40 p.m."
 */
export function formatMinutesTo12h(totalMinutes: number): string {
  let normalized = Math.max(0, totalMinutes % (24 * 60));
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? 'p.m.' : 'a.m.';

  hours = hours % 12;
  if (hours === 0) hours = 12;

  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minStr} ${suffix}`;
}

/**
 * Formats minutes into 24-hour "HH:MM"
 */
export function formatMinutesTo24h(totalMinutes: number): string {
  const normalized = Math.max(0, totalMinutes % (24 * 60));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const hStr = hours < 10 ? `0${hours}` : `${hours}`;
  const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hStr}:${mStr}`;
}

/**
 * Normalizes an address string for deduplication comparison
 */
export function normalizeAddress(addr?: string): string {
  if (!addr) return '';
  return addr
    .toLowerCase()
    .replace(/[.,#\-;/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSchoolStop(stop: RouteStop | StudentStop): boolean {
  const typeStr = ('stopType' in stop ? stop.stopType : stop.type) || '';
  if (typeStr.toLowerCase().includes('school')) return true;
  if ('schoolId' in stop && stop.schoolId && stop.schoolId > 0) return true;
  if ('schoolName' in stop && stop.schoolName && stop.schoolName.trim().length > 0) return true;
  return false;
}

export function isDropoff(stop: RouteStop | StudentStop): boolean {
  const typeStr = ('stopType' in stop ? stop.stopType : stop.type) || '';
  return typeStr.toLowerCase().includes('dropoff') || typeStr.toLowerCase().includes('drop off');
}

export function isPickup(stop: RouteStop | StudentStop): boolean {
  const typeStr = ('stopType' in stop ? stop.stopType : stop.type) || '';
  return typeStr.toLowerCase().includes('pickup') || typeStr.toLowerCase().includes('pick up');
}

/**
 * Core Algorithm: Assigns student to route or specific shift, creating/updating stops and recalculating travel times
 */
export function assignStudentToRouteOrShiftLogic(
  student: Student,
  target: AssignmentTarget,
  routeShifts: BusRouteShift[],
  schools: School[]
): AssignmentResult {
  const ESTIMATED_TRAVEL_MINUTES = 28;

  // 1. Resolve Target Shifts
  let targetShifts: BusRouteShift[] = [];
  if (target.type === 'shift' && target.shiftId) {
    const matched = routeShifts.find((s) => s.id === target.shiftId);
    if (!matched) {
      return {
        success: false,
        error: `Target shift '${target.shiftId}' not found.`,
        message: 'Shift not found.',
        updatedShifts: [],
        generatedStudentStops: [],
        assignedRouteNos: []
      };
    }
    targetShifts = [matched];
  } else {
    // Target is a Route: select all shifts belonging to this route
    targetShifts = routeShifts.filter(
      (s) => s.routeId === target.routeId || s.routeNo === target.routeNo
    );
    if (targetShifts.length === 0) {
      return {
        success: false,
        error: `No shifts found for route '${target.routeNo || target.routeId}'.`,
        message: 'Route has no shifts.',
        updatedShifts: [],
        generatedStudentStops: [],
        assignedRouteNos: []
      };
    }

    // 2. Validation: If route has duplicate AM shifts with overlapping days, reject and abort immediately
    const amShifts = targetShifts.filter((s) => (s.shiftType || '').toUpperCase() === 'AM');
    for (let i = 0; i < amShifts.length; i++) {
      for (let j = i + 1; j < amShifts.length; j++) {
        if (doRunDaysOverlap(amShifts[i].runDays, amShifts[j].runDays)) {
          return {
            success: false,
            error: `Route ${target.routeNo} has duplicate AM shifts with overlapping operating days (${amShifts[i].runDays || 'All'} vs ${amShifts[j].runDays || 'All'}). Assignment aborted.`,
            message: 'Duplicate AM shifts detected on route.',
            updatedShifts: [],
            generatedStudentStops: [],
            assignedRouteNos: []
          };
        }
      }
    }
  }

  // Find school details for accurate location and bell times
  const studentSchool = schools.find((sch) => sch.schoolId === student.schoolId) || {
    schoolId: student.schoolId,
    schoolName: student.schoolName,
    schoolAddress: student.schoolName,
    startTime: '08:30 AM',
    dismissalTime: '02:40 PM'
  };

  const updatedShifts: BusRouteShift[] = [];
  const generatedStudentStops: StudentStop[] = [];
  const assignedRouteNos = new Set<string>();

  // 3. Process each shift
  for (const origShift of targetShifts) {
    const shift: BusRouteShift = JSON.parse(JSON.stringify(origShift)); // deep copy
    shift.stops = shift.stops || [];

    // Step A: Check if shift already has this student
    const studentAlreadyInShift = shift.stops.some((st) =>
      st.assignedStudents?.some(
        (s) => s.studentId === student.studentId || (s.studentNo && s.studentNo === student.studentNo)
      )
    );

    if (studentAlreadyInShift) {
      // Skip adding stop for this shift
      continue;
    }

    // Step B: Check for School Stop corresponding to student's school
    let schoolStop = shift.stops.find((st) => {
      if (!isSchoolStop(st)) return false;
      if (st.schoolId && st.schoolId === student.schoolId) return true;
      if (
        st.schoolName &&
        student.schoolName &&
        st.schoolName.toLowerCase().trim() === student.schoolName.toLowerCase().trim()
      ) {
        return true;
      }
      return false;
    });

    const isAM = (shift.shiftType || '').toUpperCase() === 'AM';
    const isNoonOrPM =
      (shift.shiftType || '').toUpperCase() === 'NOON' ||
      (shift.shiftType || '').toUpperCase() === 'MIDDAY' ||
      (shift.shiftType || '').toUpperCase() === 'PM';

    // If shift has no school stop yet, default: AM is SchoolDropoff, NOON and PM are SchoolPickup
    if (!schoolStop) {
      const defaultSchoolStopType = isAM ? 'SchoolDropoff' : 'SchoolPickup';
      let defaultSchoolTimeStr = isAM
        ? studentSchool.startTime || '08:30 AM'
        : studentSchool.dismissalTime || (shift.shiftType === 'NOON' ? '12:25 PM' : '02:40 PM');

      const schoolTimeMins = parseTimeToMinutes(defaultSchoolTimeStr);
      const nextStopId = Date.now() + Math.floor(Math.random() * 1000);

      schoolStop = {
        stopId: nextStopId,
        sequence: isAM ? shift.stops.length + 1 : 1,
        stopLocation: studentSchool.schoolAddress || studentSchool.schoolName,
        pullawayTime: formatMinutesTo24h(schoolTimeMins),
        stopType: defaultSchoolStopType,
        schoolId: student.schoolId,
        schoolName: student.schoolName,
        runDays: shift.runDays,
        comment: `School bell terminal stop for ${student.schoolName}`,
        assignedStudents: []
      };

      if (isAM) {
        shift.stops.push(schoolStop);
      } else {
        shift.stops.unshift(schoolStop);
      }
    }

    // Add student to the school stop's assignedStudents list
    schoolStop.assignedStudents = schoolStop.assignedStudents || [];
    if (!schoolStop.assignedStudents.some((s) => s.studentId === student.studentId)) {
      schoolStop.assignedStudents.push({
        studentId: student.studentId,
        studentNo: student.studentNo,
        studentName: student.fullName || `${student.firstName} ${student.lastName}`,
        schoolName: student.schoolName
      });
    }

    // Step C: Determine Student Home Stop Type and Time
    // If school stop is SchoolDropoff -> Student stop is Pickup (28 mins before)
    // If school stop is SchoolPickup -> Student stop is Dropoff (28 mins after)
    const schoolDropoffMode = isDropoff(schoolStop);

    const schoolStopMinutes = parseTimeToMinutes(schoolStop.pullawayTime);
    let calculatedMinutes: number;
    if (schoolDropoffMode) {
      // Student is picked up at home, arrives at school
      calculatedMinutes = Math.max(0, schoolStopMinutes - ESTIMATED_TRAVEL_MINUTES);
    } else {
      // Student is picked up at school, dropped off at home
      calculatedMinutes = (schoolStopMinutes + ESTIMATED_TRAVEL_MINUTES) % (24 * 60);
    }

    const calculatedTime24h = formatMinutesTo24h(calculatedMinutes);
    const calculatedTime12h = formatMinutesTo12h(calculatedMinutes);
    const studentAddressNorm = normalizeAddress(student.studentAddress);

    // Check if shift already has a stop with the same home address
    let homeStop = shift.stops.find(
      (st) => !isSchoolStop(st) && normalizeAddress(st.stopLocation) === studentAddressNorm
    );

    if (homeStop) {
      // If current shift already has same stop address: do not add new stop,
      // simply add student to that stop without changing time or type.
      homeStop.assignedStudents = homeStop.assignedStudents || [];
      if (!homeStop.assignedStudents.some((s) => s.studentId === student.studentId)) {
        homeStop.assignedStudents.push({
          studentId: student.studentId,
          studentNo: student.studentNo,
          studentName: student.fullName || `${student.firstName} ${student.lastName}`,
          schoolName: student.schoolName
        });
      }
    } else {
      // Create new Home Stop
      const nextHomeStopId = Date.now() + Math.floor(Math.random() * 1000) + 1;
      homeStop = {
        stopId: nextHomeStopId,
        sequence: schoolDropoffMode ? 1 : shift.stops.length + 1,
        stopLocation: student.studentAddress || 'Home Address',
        pullawayTime: calculatedTime24h,
        stopType: schoolDropoffMode ? 'HomePickup' : 'HomeDropoff',
        runDays: shift.runDays,
        comment: student.metatBus ? 'C/O: METATBUS/P' : undefined,
        instruction: student.studentDispatchNotes || undefined,
        assignedStudents: [
          {
            studentId: student.studentId,
            studentNo: student.studentNo,
            studentName: student.fullName || `${student.firstName} ${student.lastName}`,
            schoolName: student.schoolName
          }
        ]
      };

      if (schoolDropoffMode) {
        // Place pickup stops before school dropoff
        const schoolIndex = shift.stops.indexOf(schoolStop);
        if (schoolIndex >= 0) {
          shift.stops.splice(schoolIndex, 0, homeStop);
        } else {
          shift.stops.unshift(homeStop);
        }
      } else {
        // Place dropoff stops after school pickup
        const schoolIndex = shift.stops.indexOf(schoolStop);
        if (schoolIndex >= 0) {
          shift.stops.splice(schoolIndex + 1, 0, homeStop);
        } else {
          shift.stops.push(homeStop);
        }
      }
    }

    // Re-index sequences
    shift.stops.forEach((st, idx) => {
      st.sequence = idx + 1;
    });

    // Step D: Record Student Personal Itinerary Stops
    const schoolTime12h = formatMinutesTo12h(schoolStopMinutes);
    const shiftOpDays = shift.runDays || 'M T W R F';

    // Pair of stops for this shift:
    if (schoolDropoffMode) {
      // 1. Home Pickup
      generatedStudentStops.push({
        stopId: `STP-${homeStop.stopId || Date.now()}`,
        time: calculatedTime12h,
        type: 'Pickup',
        opDays: shiftOpDays,
        location: homeStop.stopLocation,
        comment: homeStop.comment,
        instruction: homeStop.instruction,
        route: shift.routeNo,
        shift: shift.shiftType || 'AM'
      });

      // 2. School Dropoff
      generatedStudentStops.push({
        stopId: `STP-${schoolStop.stopId || Date.now()}-SCH`,
        time: schoolTime12h,
        type: 'School Dropoff',
        opDays: shiftOpDays,
        location: schoolStop.stopLocation,
        route: shift.routeNo,
        shift: shift.shiftType || 'AM'
      });
    } else {
      // 1. School Pickup
      generatedStudentStops.push({
        stopId: `STP-${schoolStop.stopId || Date.now()}-SCH`,
        time: schoolTime12h,
        type: 'School Pickup',
        opDays: shiftOpDays,
        location: schoolStop.stopLocation,
        route: shift.routeNo,
        shift: shift.shiftType || (isNoonOrPM ? 'PM' : 'AM')
      });

      // 2. Home Dropoff
      generatedStudentStops.push({
        stopId: `STP-${homeStop.stopId || Date.now()}`,
        time: calculatedTime12h,
        type: 'Dropoff',
        opDays: shiftOpDays,
        location: homeStop.stopLocation,
        comment: homeStop.comment,
        instruction: homeStop.instruction,
        route: shift.routeNo,
        shift: shift.shiftType || (isNoonOrPM ? 'PM' : 'AM')
      });
    }

    assignedRouteNos.add(shift.routeNo);
    updatedShifts.push(shift);
  }

  return {
    success: true,
    message: `Successfully assigned student to ${updatedShifts.length} shift(s).`,
    updatedShifts,
    generatedStudentStops,
    assignedRouteNos: Array.from(assignedRouteNos)
  };
}

/**
 * Persists updated shifts to Firestore and updates student document
 */
export async function persistShiftAssignments(
  updatedShifts: BusRouteShift[]
): Promise<void> {
  for (const shift of updatedShifts) {
    if (!shift.id) continue;
    let saved = false;
    let lastError: any = null;

    // 1. Primary: Go backend API server (Admin SDK privileges)
    try {
      await RouteService.updateShift(shift.id, { stops: shift.stops });
      saved = true;
    } catch (apiErr) {
      lastError = apiErr;
      console.warn(`[StopAssignment] API update for shift ${shift.id} failed, trying Firestore direct:`, apiErr);
    }

    // 2. Fallback: Direct Firestore SDK update if API didn't succeed
    if (!saved && db) {
      try {
        const shiftRef = doc(db, 'route_shifts', shift.id);
        await updateDoc(shiftRef, {
          stops: shift.stops,
          updatedAt: new Date().toISOString()
        });
        saved = true;
      } catch (fsErr) {
        lastError = fsErr;
        console.error(`[StopAssignment] Direct Firestore update failed for shift ${shift.id}:`, fsErr);
      }
    }

    if (!saved) {
      throw new Error(lastError?.message || `Failed to persist shift ${shift.id}.`);
    }
  }
}
