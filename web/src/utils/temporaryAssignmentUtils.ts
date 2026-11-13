import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';

/**
 * Calculates adjusted end date when start date changes.
 * Preserves the previous duration if valid, and guarantees endDate >= newStartDate.
 */
export const calculateAdjustedEndDate = (
  prevStartDate: string,
  prevEndDate: string,
  newStartDate: string
): string => {
  if (!newStartDate) return prevEndDate || '';

  if (prevStartDate && prevEndDate) {
    const prevStartMs = new Date(`${prevStartDate}T00:00:00`).getTime();
    const prevEndMs = new Date(`${prevEndDate}T00:00:00`).getTime();
    const newStartMs = new Date(`${newStartDate}T00:00:00`).getTime();

    if (!isNaN(prevStartMs) && !isNaN(prevEndMs) && !isNaN(newStartMs) && prevEndMs >= prevStartMs) {
      const diffMs = prevEndMs - prevStartMs;
      const adjustedEnd = new Date(newStartMs + diffMs);
      const yyyy = adjustedEnd.getFullYear();
      const mm = String(adjustedEnd.getMonth() + 1).padStart(2, '0');
      const dd = String(adjustedEnd.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  if (!prevEndDate || prevEndDate < newStartDate) {
    return newStartDate;
  }

  return prevEndDate;
};

/**
 * Matches a vehicle from the vehicle table for a given driver.
 * Matches by driverId, employeeNumber, numeric employeeId, or driverName.
 */
export const matchVehicleForDriver = (
  driverIdStr: string,
  employees: Employee[],
  vehicles: Vehicle[]
): Vehicle | undefined => {
  if (!driverIdStr) return undefined;
  const cleanId = driverIdStr.replace(/^EMP-/, '');
  const emp = employees.find(
    (e) =>
      e.id === driverIdStr ||
      e.employeeNumber === driverIdStr ||
      e.employeeNumber === cleanId ||
      `EMP-${e.employeeNumber}` === driverIdStr
  );

  return vehicles.find((v) => {
    if (
      v.driverId &&
      (v.driverId === driverIdStr ||
        v.driverId === cleanId ||
        (emp && (v.driverId === emp.id || v.driverId === emp.employeeNumber)))
    ) {
      return true;
    }
    if (emp && emp.employeeId && v.employeeId === emp.employeeId) {
      return true;
    }
    if (
      emp &&
      v.driverName &&
      emp.fullName &&
      v.driverName.trim().toLowerCase() === emp.fullName.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  });
};

/**
 * Checks whether two inclusive date ranges overlap.
 */
export const hasDateRangeOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean => {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && startB <= endA;
};
