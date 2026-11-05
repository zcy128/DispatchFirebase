import { PayrollDepartmentLogRecord } from '../types/dispatch';
import { BusRoute } from '../types/route';

export interface StatHolidayInfo {
  date: string;
  name: string;
  type: string;
  description?: string;
}

export interface CreditedHolidayShift {
  date: string;
  holidayName: string;
  routeNo: string;
  driverId: string;
  driverName: string;
  shiftsCount: number;
  rate: number;
  eiHours: number;
}

export const PREDEFINED_HOLIDAYS: StatHolidayInfo[] = [
  { date: '2026-01-01', name: "New Year's Day", type: 'Statutory Holiday' },
  { date: '2026-02-16', name: 'Family Day', type: 'Statutory Holiday' },
  { date: '2026-04-03', name: 'Good Friday', type: 'Statutory Holiday' },
  { date: '2026-04-06', name: 'Easter Monday', type: 'School Holiday' },
  { date: '2026-05-18', name: 'Victoria Day', type: 'Statutory Holiday' },
  { date: '2026-07-01', name: 'Canada Day', type: 'Statutory Holiday' },
  { date: '2026-08-03', name: 'Civic Holiday', type: 'Public Holiday' },
  { date: '2026-09-07', name: 'Labour Day', type: 'Statutory Holiday' },
  { date: '2026-09-30', name: 'National Day for Truth and Reconciliation', type: 'Federal Holiday' },
  { date: '2026-10-12', name: 'Thanksgiving Day (10-12 Holiday)', type: 'Statutory Holiday' },
  { date: '2026-11-11', name: 'Remembrance Day', type: 'Federal Holiday' },
  { date: '2026-12-25', name: 'Christmas Day', type: 'Statutory Holiday' },
  { date: '2026-12-26', name: 'Boxing Day', type: 'Statutory Holiday' },
];

export function buildHolidayEntitlements(
  routes: BusRoute[],
  baseRecords: PayrollDepartmentLogRecord[],
  startDate: string,
  endDate: string,
  includeHolidayEntitlements: boolean
): { creditedShifts: CreditedHolidayShift[]; holidayRecords: PayrollDepartmentLogRecord[] } {
  if (!includeHolidayEntitlements) {
    return { creditedShifts: [], holidayRecords: [] };
  }

  const creditedShifts: CreditedHolidayShift[] = [];
  const holidayRecords: PayrollDepartmentLogRecord[] = [];
  const matchingHolidays = PREDEFINED_HOLIDAYS.filter(
    (holiday) => holiday.date >= startDate && holiday.date <= endDate
  );

  matchingHolidays.forEach((holiday) => {
    const hDate = holiday.date;
    const [y, m, d] = hDate.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const DOW_CHARS = ['', 'M', 'T', 'W', 'R', 'F', ''];
    const dow = DOW_CHARS[dayOfWeek];
    if (!dow) return;

    routes.forEach((rt) => {
      const driverId = rt.driverId;
      const driverName = rt.driverName || `Driver (${rt.routeNo})`;
      if (!driverId || rt.active === false) return;

      let shiftsCount = 0;
      if (Array.isArray(rt.shifts) && rt.shifts.length > 0) {
        shiftsCount = rt.shifts.filter((shift) => {
          const runDays = (shift.runDays || 'MTWRF').toUpperCase();
          return runDays.includes(dow);
        }).length;
      } else {
        shiftsCount = 2;
      }
      if (shiftsCount <= 0) return;

      const rate = rt.schoolBoardCode?.toUpperCase().includes('CEPEO') ? 25.0 : 44.4;
      const eiHours = 3.0;
      const alreadyLogged = baseRecords.filter(
        (rec) => rec.dispatchDate === hDate && rec.employeeId === driverId
      );
      if (alreadyLogged.length >= shiftsCount) return;

      const shiftsNeeded = shiftsCount - alreadyLogged.length;
      creditedShifts.push({
        date: hDate,
        holidayName: holiday.name,
        routeNo: rt.routeNo,
        driverId,
        driverName,
        shiftsCount: shiftsNeeded,
        rate,
        eiHours,
      });

      for (let sIdx = 1; sIdx <= shiftsNeeded; sIdx++) {
        holidayRecords.push({
          id: `HOLIDAY-${driverId}-${rt.routeNo}-${hDate}-${sIdx}`,
          dispatchPayrollId: `DP-HOLIDAY-${driverId}-${rt.routeNo}-${hDate}-${sIdx}`,
          dispatchDate: hDate,
          shiftId: `SHIFT-HOLIDAY-${rt.routeNo}-${sIdx}`,
          routeNo: rt.routeNo,
          routeName: rt.routeName,
          shiftType: sIdx === 1 ? 'AM' : 'PM',
          schoolBoardCode: rt.schoolBoardCode,
          employeeId: driverId,
          employeeName: driverName,
          role: 'driver',
          payOption: 'STANDARD',
          originalPayRate: rate,
          payAmount: rate,
          originalEiHours: eiHours,
          eiHours,
          rateSource: 'holiday_route_assignment',
          rateDescription: `Stat Holiday Pay: ${holiday.name} (${shiftsCount} assigned shifts)`,
          status: 'approved',
          checkInTime: '00:00',
          syncedAt: new Date().toISOString(),
        });
      }
    });
  });

  return { creditedShifts, holidayRecords };
}
