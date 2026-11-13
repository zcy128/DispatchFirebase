import { Vehicle } from '../types/vehicle';
import { BusRoute } from '../types/route';
import { Employee } from '../types/employee';

export interface VehicleAssignmentInfo {
  isCurrentRoute: boolean;
  assignedRouteNos: string[];
  isAssigned: boolean;
  statusTag: string;
}

function normalizeUnit(unit?: string | null): string {
  return (unit || '').trim().toLowerCase();
}

/**
 * Determines whether a vehicle is assigned to the current route, another route, or is available.
 */
export function getVehicleAssignmentInfo(
  vehicle: Vehicle,
  allRoutes: BusRoute[] = [],
  currentRoute?: Pick<BusRoute, 'id' | 'routeNo'> | null
): VehicleAssignmentInfo {
  const vUnit = normalizeUnit(vehicle.unitNumber);
  const vId = vehicle.vehicleId;

  const currentRouteId = currentRoute?.id ? currentRoute.id.trim().toLowerCase() : '';
  const currentRouteNo = currentRoute?.routeNo ? currentRoute.routeNo.trim().toLowerCase() : '';

  const assignedRoutes: { routeNo: string; isCurrent: boolean }[] = [];

  for (const r of allRoutes) {
    const isCurrent =
      Boolean(currentRouteId && r.id && r.id.trim().toLowerCase() === currentRouteId) ||
      Boolean(currentRouteNo && r.routeNo && r.routeNo.trim().toLowerCase() === currentRouteNo);

    let matched = false;
    if (vUnit && normalizeUnit(r.unitNumber) === vUnit) {
      matched = true;
    } else if (vId && r.vehicleId === vId) {
      matched = true;
    }

    if (!matched && r.shifts) {
      matched = r.shifts.some(
        (s) =>
          (vUnit && normalizeUnit(s.unitNumber) === vUnit) ||
          (Boolean(vId) && s.vehicleId === vId)
      );
    }

    if (matched) {
      assignedRoutes.push({
        routeNo: r.routeNo || r.id,
        isCurrent,
      });
    }
  }

  const isCurrentRoute = assignedRoutes.some((a) => a.isCurrent);
  const otherRoutes = assignedRoutes.filter((a) => !a.isCurrent);
  const assignedRouteNos = Array.from(new Set(assignedRoutes.map((a) => a.routeNo)));

  let statusTag = '[Available]';
  if (otherRoutes.length > 0) {
    const names = Array.from(new Set(otherRoutes.map((a) => a.routeNo))).slice(0, 2).join(', ');
    const more = otherRoutes.length > 2 ? ` +${otherRoutes.length - 2}` : '';
    statusTag = `⚠ [Assigned: ${names}${more}]`;
  } else if (isCurrentRoute) {
    statusTag = '★ [Current Route]';
  }

  return {
    isCurrentRoute,
    assignedRouteNos,
    isAssigned: assignedRoutes.length > 0,
    statusTag,
  };
}

/**
 * Priority rank for vehicle / crew assignment options:
 * - 0: Current route assignment (keep existing selection visible at top)
 * - 1: Available / Unassigned (prioritize unassigned crew/vehicles as requested)
 * - 2: Assigned to other route(s) (conflicts / busy)
 */
export function getAssignmentPriorityRank(params: {
  isCurrentRoute: boolean;
  hasOtherRouteAssignments: boolean;
}): number {
  if (params.isCurrentRoute) return 0;
  if (!params.hasOtherRouteAssignments) return 1;
  return 2;
}

export function sortVehiclesByAssignmentPriority(
  vehicles: Vehicle[],
  allRoutes: BusRoute[] = [],
  currentRoute?: Pick<BusRoute, 'id' | 'routeNo'> | null
): { vehicle: Vehicle; info: VehicleAssignmentInfo; rank: number }[] {
  const mapped = vehicles.map((v) => {
    const info = getVehicleAssignmentInfo(v, allRoutes, currentRoute);
    const rank = getAssignmentPriorityRank({
      isCurrentRoute: info.isCurrentRoute,
      hasOtherRouteAssignments: info.assignedRouteNos.some((rNo) => {
        const curNo = (currentRoute?.routeNo || '').trim().toLowerCase();
        return rNo.trim().toLowerCase() !== curNo;
      }),
    });
    return { vehicle: v, info, rank };
  });

  return mapped.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return a.vehicle.unitNumber.localeCompare(b.vehicle.unitNumber, undefined, { numeric: true });
  });
}

export interface EmployeeAssignmentSummary {
  isCurrentRoute: boolean;
  otherRoutesCount: number;
}

export function sortCandidatesByAssignmentPriority<T extends { employee: Employee }>(
  candidates: T[],
  getAssignments: (emp: Employee) => { isCurrentRoute: boolean }[]
): T[] {
  return [...candidates].sort((a, b) => {
    const aList = getAssignments(a.employee);
    const bList = getAssignments(b.employee);

    const aCurrent = aList.some((x) => x.isCurrentRoute);
    const bCurrent = bList.some((x) => x.isCurrentRoute);

    const aOther = aList.some((x) => !x.isCurrentRoute);
    const bOther = bList.some((x) => !x.isCurrentRoute);

    const aRank = getAssignmentPriorityRank({ isCurrentRoute: aCurrent, hasOtherRouteAssignments: aOther });
    const bRank = getAssignmentPriorityRank({ isCurrentRoute: bCurrent, hasOtherRouteAssignments: bOther });

    return aRank - bRank;
  });
}
