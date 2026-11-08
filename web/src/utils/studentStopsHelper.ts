import { Student, StudentStop } from '../types/student';
import { BusRouteShift } from '../types/route';

/**
 * Standard default stops generator based on student home address, school, and routes.
 * Matches the OCDSB/OSTA student transportation schedule layout.
 */
export const generateDefaultStudentStops = (
  addr: string,
  schName: string,
  rt: string
): StudentStop[] => {
  const cleanRt = rt ? rt.split(',')[0].trim() : 'OCDSB-001';
  const cleanAddr = addr.trim() || 'Home Stop (Curbside)';
  const cleanSch = schName.trim() || "Children's Village School";
  return [
    {
      stopId: 'STP-1',
      time: '7:10 a.m.',
      type: 'Pickup',
      opDays: 'M T W R F',
      location: cleanAddr,
      comment: 'Eastbound front curb / driveway',
      instruction: 'Met at bus by parent',
      route: cleanRt,
      shift: 'AM',
    },
    {
      stopId: 'STP-2',
      time: '8:30 a.m.',
      type: 'School Dropoff',
      opDays: 'M T W R F',
      location: cleanSch,
      comment: 'Main school bus arrival loop',
      instruction: '',
      route: cleanRt,
      shift: 'AM',
    },
    {
      stopId: 'STP-3',
      time: '12:25 p.m.',
      type: 'School Pickup',
      opDays: '---- F',
      location: cleanSch,
      comment: 'Friday early dismissal loading zone',
      instruction: '',
      route: cleanRt,
      shift: 'NOON',
    },
    {
      stopId: 'STP-4',
      time: '1:33 p.m.',
      type: 'Dropoff',
      opDays: '---- F',
      location: cleanAddr,
      comment: 'Friday early dismissal dropoff at curb',
      instruction: '',
      route: cleanRt,
      shift: 'NOON',
    },
    {
      stopId: 'STP-5',
      time: '2:40 p.m.',
      type: 'School Pickup',
      opDays: 'M T W R -',
      location: cleanSch,
      comment: 'Afternoon regular dismissal loop',
      instruction: '',
      route: cleanRt,
      shift: 'PM',
    },
    {
      stopId: 'STP-6',
      time: '3:48 p.m.',
      type: 'Dropoff',
      opDays: 'M T W R -',
      location: cleanAddr,
      comment: 'Afternoon dropoff at house curb',
      instruction: '',
      route: cleanRt,
      shift: 'PM',
    },
  ];
};

/**
 * Extracts stops where the given student is assigned from route shifts.
 */
export const extractStudentStopsFromShifts = (
  studentId: number,
  studentNo?: string,
  studentName?: string,
  shifts?: BusRouteShift[]
): StudentStop[] => {
  if (!shifts || !Array.isArray(shifts) || shifts.length === 0) return [];
  const sNo = studentNo?.trim().toLowerCase();
  const sName = studentName?.trim().toLowerCase();

  const stops: StudentStop[] = [];

  for (const shift of shifts) {
    if (!Array.isArray(shift.stops)) continue;
    for (const st of shift.stops) {
      const match = (st.assignedStudents || []).some((stu) => {
        if (studentId && stu.studentId === studentId) return true;
        if (sNo && stu.studentNo?.trim().toLowerCase() === sNo) return true;
        if (sName && (stu.studentName || '').trim().toLowerCase() === sName) return true;
        return false;
      });

      if (match) {
        stops.push({
          stopId: st.stopId !== undefined ? String(st.stopId) : `STP-${stops.length + 1}`,
          time: st.pullawayTime || '08:00 AM',
          type: st.stopType || (st.schoolName ? 'School Dropoff' : 'Pickup'),
          opDays: st.runDays || shift.runDays || 'M T W R F',
          location: st.stopLocation || 'Designated Stop',
          comment: st.comment || '',
          instruction: st.instruction || '',
          route: shift.routeNo || '',
          shift: shift.shiftType || 'AM',
        });
      }
    }
  }

  return stops;
};

/**
 * Resolves a student's effective stops with fallback:
 * 1. Explicit student.stops (if non-empty)
 * 2. Stops extracted from route shifts (if available)
 * 3. Default stops generated from student address, school name, and routes
 */
export const resolveStudentEffectiveStops = (
  student: Student | null,
  shifts?: BusRouteShift[],
  fallbackSchoolName?: string
): StudentStop[] => {
  if (!student) return [];

  // 1. Explicit stops
  if (Array.isArray(student.stops) && student.stops.length > 0) {
    return student.stops;
  }

  // 2. Extracted from shifts
  if (shifts && shifts.length > 0) {
    const fromShifts = extractStudentStopsFromShifts(
      student.studentId,
      student.studentNo,
      student.fullName || student.studentName,
      shifts
    );
    if (fromShifts.length > 0) {
      return fromShifts;
    }
  }

  // 3. Fallback default stops
  const schoolName = student.schoolName || fallbackSchoolName || '';
  return generateDefaultStudentStops(
    student.studentAddress || '',
    schoolName,
    student.routes || ''
  );
};
