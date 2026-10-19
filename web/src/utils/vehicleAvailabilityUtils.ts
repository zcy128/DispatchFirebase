import { VehicleDefectReport } from '../types/defect';
import { VehicleInspectionRecord, PreventiveMaintenanceRecord } from '../types/vehicleInspection';
import { Vehicle } from '../types/vehicle';
import { getLocalTodayString } from './dateUtils';

export interface UnavailableVehicleInfo {
  unitNumber: string;
  vehicleId?: number;
  reason: 'defect' | 'periodic_inspection' | 'preventive_maintenance' | 'vehicle_status';
  badgeTextEn: string;
  badgeTextFr: string;
  detailEn: string;
  detailFr: string;
  sourceId?: string;
}

function normalizeUnitKey(unitNumber?: string | number | null): string {
  if (unitNumber === undefined || unitNumber === null) return '';
  return String(unitNumber).trim().toUpperCase();
}

/**
 * Computes all vehicles that are unavailable for dispatch shifts on a given `date` (YYYY-MM-DD)
 * due to:
 * 1) Active Vehicle Defect Reports (`vehicle_defects`)
 * 2) Periodic Semi-Annual Inspections (`vehicle_inspections`) scheduled or performed on `date`
 * 3) Preventive Maintenance / Oil Changes (`preventive_maintenance_records`) scheduled or performed on `date`
 * 4) Vehicle Master Status (`Maintenance`, `Out of Service`, `In Inspection`, `Defective`)
 */
export function getUnavailableVehiclesForDate(
  date: string,
  defects: VehicleDefectReport[] = [],
  inspections: VehicleInspectionRecord[] = [],
  pmRecords: PreventiveMaintenanceRecord[] = [],
  vehicles: Vehicle[] = []
): Map<string, UnavailableVehicleInfo> {
  const map = new Map<string, UnavailableVehicleInfo>();
  if (!date) return map;

  const targetDate = date.slice(0, 10);
  const todayStr = getLocalTodayString();

  const registerUnavailable = (info: UnavailableVehicleInfo) => {
    const unitKey = normalizeUnitKey(info.unitNumber);
    if (unitKey) {
      map.set(`UNIT:${unitKey}`, info);
    }
    if (info.vehicleId && info.vehicleId > 0) {
      map.set(`ID:${info.vehicleId}`, info);
    }
  };

  // 1. Check Vehicle Status from master fleet list
  for (const v of vehicles) {
    const statusLower = (v.status || '').toLowerCase().trim();
    const isOutOfServiceStatus =
      (v as any).inService === false ||
      statusLower === 'maintenance' ||
      statusLower === 'out of service' ||
      statusLower === 'in inspection' ||
      statusLower === 'periodic inspection' ||
      statusLower === 'defective' ||
      statusLower === 'under repair';

    if (isOutOfServiceStatus) {
      const vid = v.vehicleId || (typeof v.id === 'number' ? v.id : Number(v.id) || undefined);
      registerUnavailable({
        unitNumber: v.unitNumber || String(v.id || ''),
        vehicleId: vid,
        reason: statusLower.includes('inspect') ? 'periodic_inspection' : 'vehicle_status',
        badgeTextEn: statusLower.includes('inspect') ? 'Periodic Inspection' : 'Out of Service',
        badgeTextFr: statusLower.includes('inspect') ? 'Inspection périodique' : 'Hors service',
        detailEn: `Unit #${v.unitNumber} status is "${v.status || 'Out of Service'}"`,
        detailFr: `L'unité #${v.unitNumber} a le statut « ${v.status || 'Hors service'} »`,
      });
    }
  }

  // 2. Check Preventive Maintenance Records (PM & Oil Changes / Fiche d'entretien)
  for (const pm of pmRecords) {
    if (pm.isArchivedToBigQuery) continue;
    const srvDate = (pm.serviceDate || '').slice(0, 10);
    const schedDate = (pm.scheduledServiceDate || '').slice(0, 10);
    const isInProgressToday = pm.maintenanceStatus === 'in_progress' && targetDate >= (schedDate || srvDate || todayStr);

    if (srvDate === targetDate || schedDate === targetDate || isInProgressToday) {
      registerUnavailable({
        unitNumber: pm.unitNumber,
        vehicleId: pm.vehicleId,
        reason: 'preventive_maintenance',
        badgeTextEn: 'Periodic Maintenance',
        badgeTextFr: 'Entretien périodique',
        detailEn: `Unit #${pm.unitNumber} is undergoing Preventive Maintenance (${pm.serviceTier}) on ${targetDate}`,
        detailFr: `L'unité #${pm.unitNumber} est en entretien préventif (${pm.serviceTier}) le ${targetDate}`,
        sourceId: pm.id,
      });
    }
  }

  // 3. Check Periodic Semi-Annual Inspections (PMVI / VMP)
  for (const insp of inspections) {
    if (insp.isArchivedToBigQuery) continue;
    const inspDate = (insp.inspectionDate || '').slice(0, 10);
    const schedDate = (insp.scheduledInspectionDate || '').slice(0, 10);
    const isActivelyInInspection =
      insp.inspectionStatus === 'in_inspection' &&
      (!schedDate || targetDate >= schedDate) &&
      targetDate >= todayStr;

    if (inspDate === targetDate || schedDate === targetDate || isActivelyInInspection) {
      registerUnavailable({
        unitNumber: insp.unitNumber,
        vehicleId: insp.vehicleId,
        reason: 'periodic_inspection',
        badgeTextEn: 'Periodic Inspection',
        badgeTextFr: 'Inspection périodique',
        detailEn: `Unit #${insp.unitNumber} is undergoing Semi-Annual Periodic Inspection on ${targetDate}`,
        detailFr: `L'unité #${insp.unitNumber} est en inspection mécanique périodique semestrielle le ${targetDate}`,
        sourceId: insp.id,
      });
    }
  }

  // 4. Check Vehicle Defect Reports (Highest visibility priority)
  for (const defect of defects) {
    if (defect.noDefectsFound) continue;

    const repDate = (defect.reportDate || '').slice(0, 10);
    const estStart = (defect.assessment?.estimatedStartDate || '').slice(0, 10);
    const estEnd = (defect.assessment?.estimatedCompletionDate || '').slice(0, 10);
    const actualEnd = (defect.assessment?.actualCompletionDate || '').slice(0, 10);

    const effectiveStart =
      estStart && repDate
        ? estStart < repDate
          ? estStart
          : repDate
        : repDate || estStart;

    if (defect.status !== 'resolved') {
      // Unresolved defect grounds the vehicle from its report/start date onward
      // (or on any date if no reportDate was set)
      const isDateCovered = !effectiveStart || targetDate >= effectiveStart;
      if (isDateCovered) {
        const statusLabelEn =
          defect.status === 'under_repair'
            ? 'Under Repair'
            : defect.status === 'under_assessment'
            ? 'Under Assessment'
            : 'Defect Reported';
        const statusLabelFr =
          defect.status === 'under_repair'
            ? 'En réparation'
            : defect.status === 'under_assessment'
            ? 'En évaluation'
            : 'Défectuosité signalée';

        registerUnavailable({
          unitNumber: defect.vehicleUnitNumber,
          vehicleId: defect.vehicleId,
          reason: 'defect',
          badgeTextEn: `Vehicle Defect (${statusLabelEn})`,
          badgeTextFr: `Défectuosité véhicule (${statusLabelFr})`,
          detailEn: `Unit #${defect.vehicleUnitNumber} grounded due to Vehicle Defect (${statusLabelEn})${
            defect.defectNotes ? `: ${defect.defectNotes}` : ''
          }`,
          detailFr: `Unité #${defect.vehicleUnitNumber} immobilisée pour défectuosité (${statusLabelFr})${
            defect.defectNotes ? ` : ${defect.defectNotes}` : ''
          }`,
          sourceId: defect.id,
        });
      }
    } else {
      // Resolved defect: if viewing a historical/specific date strictly inside [effectiveStart, actualEnd || estEnd) before resolution
      const resolvedEnd = actualEnd || estEnd;
      if (effectiveStart && resolvedEnd && targetDate >= effectiveStart && targetDate < resolvedEnd) {
        registerUnavailable({
          unitNumber: defect.vehicleUnitNumber,
          vehicleId: defect.vehicleId,
          reason: 'defect',
          badgeTextEn: 'Vehicle Defect (In Repair Window)',
          badgeTextFr: 'Défectuosité véhicule (En réparation)',
          detailEn: `Unit #${defect.vehicleUnitNumber} was in defect repair (${effectiveStart} to ${resolvedEnd})`,
          detailFr: `L'unité #${defect.vehicleUnitNumber} était en réparation (${effectiveStart} au ${resolvedEnd})`,
          sourceId: defect.id,
        });
      }
    }
  }

  return map;
}

/**
 * Checks whether a specific vehicle (by unitNumber and/or vehicleId) is in the unavailable map.
 */
export function getVehicleUnavailabilityReason(
  unitNumber?: string | number | null,
  vehicleId?: number | string | null,
  unavailableMap?: Map<string, UnavailableVehicleInfo>
): UnavailableVehicleInfo | undefined {
  if (!unavailableMap || unavailableMap.size === 0) return undefined;

  const unitKey = normalizeUnitKey(unitNumber);
  if (unitKey) {
    const byUnit = unavailableMap.get(`UNIT:${unitKey}`);
    if (byUnit) return byUnit;
  }

  const numId = typeof vehicleId === 'number' ? vehicleId : Number(vehicleId);
  if (numId && !Number.isNaN(numId) && numId > 0) {
    const byId = unavailableMap.get(`ID:${numId}`);
    if (byId) return byId;
  }

  return undefined;
}

/**
 * Returns only the vehicles that are available for dispatch on the target date.
 */
export function filterAvailableVehicles(
  vehicles: Vehicle[],
  unavailableMap?: Map<string, UnavailableVehicleInfo>
): Vehicle[] {
  if (!unavailableMap || unavailableMap.size === 0) return vehicles;
  return vehicles.filter((v) => {
    const vid = v.vehicleId || (typeof v.id === 'number' ? v.id : Number(v.id) || undefined);
    const reason = getVehicleUnavailabilityReason(v.unitNumber, vid, unavailableMap);
    return !reason;
  });
}

/**
 * Returns a deduplicated array of UnavailableVehicleInfo entries for UI display.
 */
export function getUniqueUnavailableVehicleList(
  unavailableMap?: Map<string, UnavailableVehicleInfo>
): UnavailableVehicleInfo[] {
  if (!unavailableMap || unavailableMap.size === 0) return [];
  const seenUnits = new Set<string>();
  const list: UnavailableVehicleInfo[] = [];

  unavailableMap.forEach((info) => {
    const key = normalizeUnitKey(info.unitNumber) || `ID:${info.vehicleId || ''}`;
    if (!key || seenUnits.has(key)) return;
    seenUnits.add(key);
    list.push(info);
  });

  return list.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
}
