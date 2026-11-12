import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';

function stripEmpPrefix(value?: string | null): string {
  return (value || '').trim().replace(/^emp-/i, '').toLowerCase();
}

function normalizeText(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Finds the regular vehicle assigned to a driver in the fleet vehicle list.
 * Matches by numeric employeeId, vehicle.driverId (with or without EMP- prefix),
 * or normalized driver full name. Prefers active vehicles and ID matches over name-only matches.
 */
export function findRegularVehicleForDriver(
  driver: Employee | string | null | undefined,
  vehicles: Vehicle[],
  employees?: Employee[]
): Vehicle | undefined {
  if (!driver || vehicles.length === 0) return undefined;

  let driverObj: Employee | undefined;
  let rawIdQuery = '';

  if (typeof driver === 'string') {
    rawIdQuery = driver.trim();
    if (!rawIdQuery) return undefined;
    const strippedQuery = stripEmpPrefix(rawIdQuery);
    driverObj = employees?.find(
      (e) =>
        normalizeText(e.id) === normalizeText(rawIdQuery) ||
        normalizeText(e.employeeNumber) === normalizeText(rawIdQuery) ||
        stripEmpPrefix(e.id) === strippedQuery ||
        stripEmpPrefix(e.employeeNumber) === strippedQuery ||
        (e.employeeId !== undefined && e.employeeId !== null && String(e.employeeId) === rawIdQuery)
    );
  } else {
    driverObj = driver;
  }

  const idTokens = new Set<string>();
  const strippedTokens = new Set<string>();

  if (rawIdQuery) {
    idTokens.add(normalizeText(rawIdQuery));
    const s = stripEmpPrefix(rawIdQuery);
    if (s) strippedTokens.add(s);
  }

  if (driverObj) {
    for (const candidate of [
      driverObj.id,
      driverObj.employeeNumber,
      driverObj.employeeId !== undefined && driverObj.employeeId !== null
        ? String(driverObj.employeeId)
        : undefined,
    ]) {
      const norm = normalizeText(candidate);
      if (norm) idTokens.add(norm);
      const stripped = stripEmpPrefix(candidate);
      if (stripped) strippedTokens.add(stripped);
    }
  }

  const nameTokens = new Set<string>();
  if (driverObj) {
    const full = normalizeText(driverObj.fullName);
    const firstLast = normalizeText(`${driverObj.firstName || ''} ${driverObj.lastName || ''}`);
    if (full) nameTokens.add(full);
    if (firstLast) nameTokens.add(firstLast);
  }

  let bestVehicle: Vehicle | undefined;
  let bestScore = 0;

  for (const v of vehicles) {
    let score = 0;

    if (
      driverObj?.employeeId !== undefined &&
      driverObj?.employeeId !== null &&
      v.employeeId !== undefined &&
      v.employeeId !== null &&
      Number(v.employeeId) === Number(driverObj.employeeId)
    ) {
      score = Math.max(score, 100);
    }

    const vDriverIdNorm = normalizeText(v.driverId);
    const vDriverIdStripped = stripEmpPrefix(v.driverId);
    if (vDriverIdNorm && (idTokens.has(vDriverIdNorm) || (vDriverIdStripped && strippedTokens.has(vDriverIdStripped)))) {
      score = Math.max(score, 90);
    }

    const vEmpIdStr = v.employeeId !== undefined && v.employeeId !== null ? String(v.employeeId).trim() : '';
    if (vEmpIdStr && (idTokens.has(vEmpIdStr.toLowerCase()) || strippedTokens.has(vEmpIdStr.toLowerCase()))) {
      score = Math.max(score, 85);
    }

    const vDriverNameNorm = normalizeText(v.driverName);
    if (vDriverNameNorm && nameTokens.has(vDriverNameNorm)) {
      score = Math.max(score, 60);
    }

    if (score === 0) continue;

    // Prefer active vehicles and vehicles not marked in Maintenance
    if (v.active !== false) score += 10;
    if (normalizeText(v.status) !== 'maintenance') score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestVehicle = v;
    }
  }

  return bestVehicle;
}

/**
 * Filters vehicles by a free-text query across unit number, plate, make/model,
 * yard name, vehicle type, ID, and assigned driver name, and sorts active units first
 * in natural unit-number order.
 */
export function filterAndSortVehicles(vehicles: Vehicle[], query: string): Vehicle[] {
  const sorted = [...vehicles].sort((a, b) => {
    const aActive = a.active !== false;
    const bActive = b.active !== false;
    if (aActive !== bActive) return aActive ? -1 : 1;
    return (a.unitNumber || '').localeCompare(b.unitNumber || '', undefined, { numeric: true });
  });

  const q = query.trim().toLowerCase();
  if (!q) return sorted;

  return sorted.filter((v) => {
    const unit = (v.unitNumber || '').toLowerCase();
    const plate = (v.plateNumber || '').toLowerCase();
    const makeModel = `${v.manufacturer || ''} ${v.model || ''}`.toLowerCase();
    const yard = (v.yardName || '').toLowerCase();
    const driver = (v.driverName || '').toLowerCase();
    const unitType = (v.unitType || '').toLowerCase();
    const vehId = String(v.vehicleId || '');
    return (
      unit.includes(q) ||
      plate.includes(q) ||
      makeModel.includes(q) ||
      yard.includes(q) ||
      driver.includes(q) ||
      unitType.includes(q) ||
      vehId.includes(q)
    );
  });
}
