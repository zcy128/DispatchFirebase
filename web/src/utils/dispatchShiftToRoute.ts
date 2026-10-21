import { DispatchShift, DispatchShiftStop } from '../types/dispatch';
import { BusRoute, BusRouteShift, RouteStop, StopStudent } from '../types/route';

/**
 * Converts a DispatchShift (from dispatch workbench) into a BusRouteShift and BusRoute
 * so it can be seamlessly rendered by the ShiftGoogleMapView component.
 */
export function convertDispatchShiftToRouteShift(ds: DispatchShift): {
  shift: BusRouteShift;
  route: BusRoute;
} {
  const stops: RouteStop[] = (ds.stops || []).map((s: DispatchShiftStop, idx: number) => {
    const rawStudents = s.assignedStudents || s.students || [];
    const assignedStudents: StopStudent[] = rawStudents.map((st) => ({
      studentId: st.studentId,
      studentNo: st.studentNo || String(st.studentId),
      studentName: st.studentName,
      schoolName: st.schoolName
    }));

    return {
      stopId: s.stopId || idx + 1,
      sequence: s.sequence || idx + 1,
      stopLocation: s.stopLocation,
      pullawayTime: s.stopScheduleTime || s.actualArrivalTime || '07:30',
      actualArrivalTime: s.actualArrivalTime || s.stopArrivalTime,
      minutesLate: s.minutesLate,
      stopType: s.stopType,
      latitude: s.latitude,
      longitude: s.longitude,
      schoolId: s.schoolId,
      schoolName: s.schoolName,
      runDays: 'MTWRF',
      comment: s.comment,
      assignedStudents
    };
  });

  const shiftSchools = ds.stops?.find((s) => s.stopType?.toLowerCase().includes('school'))?.schoolName;

  const shift: BusRouteShift = {
    id: ds.id,
    shiftId: parseInt(ds.id.replace(/\D/g, '')) || 1,
    routeId: ds.routeId,
    routeNo: ds.routeNo,
    routeName: ds.routeName,
    shiftType: ds.shiftType,
    shiftSchools: shiftSchools,
    runDays: 'MTWRF',
    firstStopTime: ds.firstStopTime,
    lastStopTime: ds.lastStopTime,
    stops,
    driverName: ds.driverName,
    unitNumber: ds.unitNumber,
    vehicleId: ds.vehicleId
  };

  const route: BusRoute = {
    id: ds.routeId,
    busRouteId: parseInt(ds.routeId.replace(/\D/g, '')) || 1,
    routeNo: ds.routeNo,
    routeName: ds.routeName,
    active: true,
    schoolBoardId: ds.schoolBoardId || 1,
    schoolBoardCode: ds.schoolBoardCode || 'OCDSB',
    yardId: ds.yardId || 1,
    yardName: ds.yardName || 'Main Depot',
    driverName: ds.driverName,
    unitNumber: ds.unitNumber,
    plateNumber: ds.plateNumber,
    attendantName: ds.attendantName,
    totalStops: ds.totalStops || stops.length,
    totalStudents: stops.reduce((sum, s) => sum + (s.assignedStudents?.length || 0), 0)
  };

  return { shift, route };
}
