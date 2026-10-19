import { db } from './firebase';
import {
  VehicleInspectionRecord,
  InspectionAttachment,
  VehicleInspectionStats,
  PreventiveMaintenanceRecord,
  PreventiveMaintenanceStats,
  PMServiceTier
} from '../types/vehicleInspection';
import { Vehicle } from '../types/vehicle';
import {
  getEndOfMonthDate,
  isDueWithin30Days,
  isOverdue,
  isOlderThanTwoYears
} from '../utils/inspectionDateUtils';

const STORAGE_KEY = 'dispatch_vehicle_inspections_data';
const FIRESTORE_COLLECTION = 'vehicle_inspections';

const PM_STORAGE_KEY = 'dispatch_preventive_maintenance_data';
const PM_FIRESTORE_COLLECTION = 'preventive_maintenance_records';

type Listener = (records: VehicleInspectionRecord[]) => void;
const listeners = new Set<Listener>();

type PMListener = (records: PreventiveMaintenanceRecord[]) => void;
const pmListeners = new Set<PMListener>();

// Initial sample inspection generator based on vehicles
function generateInitialInspections(vehicles: Vehicle[] = []): VehicleInspectionRecord[] {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  // Default vehicles if none passed
  const list = vehicles.length > 0 ? vehicles : [
    { id: 'v1', vehicleId: 101, unitNumber: '1001', plateNumber: 'ON-1001', unitType: 'School Bus (72-Pax)', yardName: 'HQ-Central' },
    { id: 'v2', vehicleId: 102, unitNumber: '1002', plateNumber: 'ON-1002', unitType: 'School Bus (72-Pax)', yardName: 'HQ-Central' },
    { id: 'v3', vehicleId: 103, unitNumber: '1003', plateNumber: 'ON-1003', unitType: 'Wheelchair Bus (WC-3)', yardName: 'West-Terminal' },
    { id: 'v4', vehicleId: 104, unitNumber: '1004', plateNumber: 'ON-1004', unitType: 'School Bus (72-Pax)', yardName: 'East-Yard' },
    { id: 'v5', vehicleId: 105, unitNumber: '1005', plateNumber: 'ON-1005', unitType: 'Van (9-Pax)', yardName: 'HQ-Central' },
    { id: 'v6', vehicleId: 106, unitNumber: '1006', plateNumber: 'QC-1006', unitType: 'School Bus (72-Pax)', yardName: 'Gatineau-Depot' },
    { id: 'v7', vehicleId: 107, unitNumber: '1007', plateNumber: 'QC-1007', unitType: 'School Bus (72-Pax)', yardName: 'Gatineau-Depot' },
    { id: 'v8', vehicleId: 108, unitNumber: '1008', plateNumber: 'ON-1008', unitType: 'School Bus (72-Pax)', yardName: 'HQ-Central' },
  ] as Vehicle[];

  const initialRecords: VehicleInspectionRecord[] = [];

  list.forEach((v, index) => {
    const isQuebec = (v.plateNumber || '').startsWith('QC') || (v.yardName || '').includes('Gatineau');
    const province = isQuebec ? 'QC' : 'ON';

    let inspDateStr: string;
    let stickerMonthStr: string;
    let isArchived = false;
    let archivedAt: string | undefined;

    if (index === 0) {
      const targetMonth = currentMonth;
      const targetYear = currentYear;
      stickerMonthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      const prevDate = new Date(targetYear, targetMonth - 1 - 6, 12);
      inspDateStr = prevDate.toISOString().slice(0, 10);
    } else if (index === 1) {
      const nextMonthDate = new Date(currentYear, currentMonth, 1);
      const targetMonth = nextMonthDate.getMonth() + 1;
      const targetYear = nextMonthDate.getFullYear();
      stickerMonthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      const prevDate = new Date(targetYear, targetMonth - 1 - 6, 18);
      inspDateStr = prevDate.toISOString().slice(0, 10);
    } else if (index === 2) {
      stickerMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const prevDate = new Date(currentYear, currentMonth - 1 - 6, 25);
      inspDateStr = prevDate.toISOString().slice(0, 10);
    } else if (index === 3) {
      const lastMonthDate = new Date(currentYear, currentMonth - 2, 1);
      const targetMonth = lastMonthDate.getMonth() + 1;
      const targetYear = lastMonthDate.getFullYear();
      stickerMonthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      const prevDate = new Date(targetYear, targetMonth - 1 - 6, 5);
      inspDateStr = prevDate.toISOString().slice(0, 10);
    } else if (index === 4) {
      const futureDate = new Date(currentYear, currentMonth + 3, 1);
      const targetMonth = futureDate.getMonth() + 1;
      const targetYear = futureDate.getFullYear();
      stickerMonthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      const prevDate = new Date(targetYear, targetMonth - 1 - 6, 10);
      inspDateStr = prevDate.toISOString().slice(0, 10);
    } else if (index === 5) {
      stickerMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const prevDate = new Date(currentYear, currentMonth - 1 - 6, 14);
      inspDateStr = prevDate.toISOString().slice(0, 10);
    } else {
      inspDateStr = '2024-03-15';
      stickerMonthStr = '2024-09';
      isArchived = true;
      archivedAt = '2026-03-16T08:30:00Z';
    }

    const legalExpiry = getEndOfMonthDate(stickerMonthStr);

    const sampleAttachments: InspectionAttachment[] = [
      {
        id: `att-${v.unitNumber}-1`,
        name: isQuebec ? `Certificat_VMP_SAAQ_${v.unitNumber}.pdf` : `DriveON_PMVI_Report_${v.unitNumber}.pdf`,
        category: 'certificate',
        categoryLabel: isQuebec ? 'Certificat CVM' : 'Safety Certificate',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 245100,
        uploadedAt: inspDateStr + 'T14:20:00Z',
        uploadedBy: 'Lead Inspector #4410',
        description: isQuebec ? 'SAAQ CVM Official Periodic Verification Report' : 'Ontario DriveON Safety Standards Certificate'
      },
      {
        id: `att-${v.unitNumber}-2`,
        name: `Brake_Lining_Measurement_Gauge_${v.unitNumber}.jpg`,
        category: 'measurements',
        categoryLabel: 'Brake Measurements',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 512400,
        uploadedAt: inspDateStr + 'T14:35:00Z',
        uploadedBy: 'Technician #1209',
        description: 'Photo proof of brake lining thickness (9.5mm front / 11mm rear)'
      }
    ];

    initialRecords.push({
      id: `INSP-${v.unitNumber}-${stickerMonthStr.replace('-', '')}`,
      vehicleId: v.vehicleId || Number(v.unitNumber) || 1000 + index,
      unitNumber: v.unitNumber,
      plateNumber: v.plateNumber || `${province}-${v.unitNumber}`,
      vin: v.vin || `1HVBBAB84KH${88000 + index}`,
      unitType: v.unitType || 'School Bus (72-Pax)',
      yardName: v.yardName || 'HQ-Central',
      province,
      inspectionDate: inspDateStr,
      stickerMonth: stickerMonthStr,
      legalExpiryDate: legalExpiry,
      certificateNumber: province === 'ON' ? `DOC-ON-${v.unitNumber}-981` : `CVM-QC-${v.unitNumber}-442`,
      stickerNumber: `STK-${v.unitNumber}-${stickerMonthStr.replace('-', '')}`,
      facilityName: province === 'ON' ? 'DriveON Authorized Inspection Lane #392' : 'SAAQ Mandataire Agréé #104',
      technicianName: 'Marc Lefebvre (Master Tech 310T)',
      odometerAtInspection: 85200 + index * 4200,
      hasInVehicleCertificate: true,
      hasDetailedMeasurementsArchived: true,
      hasProofOfRepairsAttached: index % 2 === 0,
      attachments: sampleAttachments,
      isArchivedToBigQuery: isArchived,
      bigQueryDataset: isArchived ? 'fleet_compliance.semi_annual_inspections' : undefined,
      bigQueryTable: isArchived ? 'historical_inspection_archive' : undefined,
      bigQueryArchivedAt: archivedAt,
      bigQueryRowId: isArchived ? `BQ-ARCHIVE-${v.unitNumber}-2024` : undefined,
      notes: isArchived
        ? 'Record exceeds 2-year CVOR/SAAQ mandatory vehicle retention; archived to BigQuery historical data lake.'
        : 'All measurements verified compliant with NSC Standard 11B.',
      createdAt: inspDateStr + 'T10:00:00Z',
      updatedAt: new Date().toISOString()
    });
  });

  return initialRecords;
}

// Initial sample Preventive Maintenance (PM & Oil Changes / Fiche d'entretien) generator
function generateInitialPMRecords(vehicles: Vehicle[] = []): PreventiveMaintenanceRecord[] {
  const today = new Date();
  const list = vehicles.length > 0 ? vehicles : [
    { id: 'v1', vehicleId: 101, unitNumber: '1001', plateNumber: 'ON-1001', unitType: 'School Bus (72-Pax)', yardName: 'HQ-Central' },
    { id: 'v2', vehicleId: 102, unitNumber: '1002', plateNumber: 'ON-1002', unitType: 'School Bus (72-Pax)', yardName: 'HQ-Central' },
    { id: 'v3', vehicleId: 103, unitNumber: '1003', plateNumber: 'ON-1003', unitType: 'Wheelchair Bus (WC-3)', yardName: 'West-Terminal' },
    { id: 'v4', vehicleId: 104, unitNumber: '1004', plateNumber: 'ON-1004', unitType: 'School Bus (72-Pax)', yardName: 'East-Yard' },
    { id: 'v5', vehicleId: 105, unitNumber: '1005', plateNumber: 'ON-1005', unitType: 'Van (9-Pax)', yardName: 'HQ-Central' },
    { id: 'v6', vehicleId: 106, unitNumber: '1006', plateNumber: 'QC-1006', unitType: 'School Bus (72-Pax)', yardName: 'Gatineau-Depot' },
    { id: 'v7', vehicleId: 107, unitNumber: '1007', plateNumber: 'QC-1007', unitType: 'School Bus (72-Pax)', yardName: 'Gatineau-Depot' },
    { id: 'v8', vehicleId: 108, unitNumber: '1008', plateNumber: 'ON-1008', unitType: 'School Bus (72-Pax)', yardName: 'HQ-Central' },
  ] as Vehicle[];

  const pmRecords: PreventiveMaintenanceRecord[] = [];

  list.forEach((v, idx) => {
    const isQuebec = (v.plateNumber || '').startsWith('QC') || (v.yardName || '').includes('Gatineau') || idx === 5 || idx === 6;
    const province: 'ON' | 'QC' = isQuebec ? 'QC' : 'ON';

    let serviceTier: PMServiceTier = isQuebec ? 'QC_FICHE_ENTRETIEN' : 'SERVICE_B';
    let serviceDateObj = new Date(today);
    let nextDueDateObj = new Date(today);
    let prevOdometer = 92000 + idx * 5500;
    let serviceOdometer = prevOdometer + 7200;
    let currentOdometer = serviceOdometer + 4100;
    let planMaxKm = 8000;
    let planMaxDays = 90;
    let daysElapsedAtService = 78;
    let wasPerformedOnTime = true;
    let auditViolationNotes: string | undefined;
    let isArchived = false;
    let archivedAt: string | undefined;

    if (idx === 0) {
      // Due soon by days and odometer (14 days left, 680 km left before 8,000 km limit)
      serviceTier = 'SERVICE_B';
      serviceDateObj = new Date(today.getTime() - 76 * 86400000);
      nextDueDateObj = new Date(today.getTime() + 14 * 86400000);
      prevOdometer = 94000;
      serviceOdometer = 101400; // 7,400 km interval (compliant with 8,000 km limit)
      currentOdometer = 108720; // 7,320 km driven since last service -> 680 km remaining
      daysElapsedAtService = 82;
    } else if (idx === 1) {
      // Due soon for Service A (Minor / Chassis Lubrication - 4,000 km / 45 days)
      serviceTier = 'SERVICE_A';
      planMaxKm = 4000;
      planMaxDays = 45;
      serviceDateObj = new Date(today.getTime() - 36 * 86400000);
      nextDueDateObj = new Date(today.getTime() + 9 * 86400000);
      prevOdometer = 112000;
      serviceOdometer = 115600; // 3,600 km
      currentOdometer = 119150; // 3,550 km since service -> 450 km remaining
      daysElapsedAtService = 41;
    } else if (idx === 2) {
      // Audit Violation Example (Unit #3 / index 2): Written plan says 8,000 km / 90 days, bus went 11,500 km / 120 days!
      serviceTier = 'SERVICE_B';
      planMaxKm = 8000;
      planMaxDays = 90;
      serviceDateObj = new Date(today.getTime() - 105 * 86400000);
      nextDueDateObj = new Date(today.getTime() - 15 * 86400000); // Currently Overdue!
      prevOdometer = 120000;
      serviceOdometer = 131500; // 11,500 km driven between oil changes!
      currentOdometer = 140900; // 9,400 km since last service -> Overdue by 1,400 km!
      daysElapsedAtService = 120;
      wasPerformedOnTime = false;
      auditViolationNotes = 'CVOR Audit Flag: Previous interval reached 11,500 km / 120 days (exceeded Written Maintenance Plan limit of 8,000 km / 90 days). Current cycle also overdue by 1,400 km.';
    } else if (idx === 3) {
      // Quebec Mandatory Fiche d'entretien (Due within 18 days)
      serviceTier = 'QC_FICHE_ENTRETIEN';
      planMaxKm = 8000;
      planMaxDays = 90; // Interleaved 3-month / 6-month SAAQ cycle
      serviceDateObj = new Date(today.getTime() - 72 * 86400000);
      nextDueDateObj = new Date(today.getTime() + 18 * 86400000);
      prevOdometer = 78500;
      serviceOdometer = 85100;
      currentOdometer = 91800;
      daysElapsedAtService = 84;
    } else if (idx === 4) {
      // Service C (Major Drivetrain / Coolant / Transmission PM - Compliant)
      serviceTier = 'SERVICE_C';
      planMaxKm = 24000;
      planMaxDays = 180;
      serviceDateObj = new Date(today.getTime() - 25 * 86400000);
      nextDueDateObj = new Date(today.getTime() + 155 * 86400000);
      prevOdometer = 140000;
      serviceOdometer = 162400;
      currentOdometer = 165200;
      daysElapsedAtService = 168;
    } else if (idx === 5) {
      // Quebec Mandatory Fiche d'entretien (Compliant)
      serviceTier = 'QC_FICHE_ENTRETIEN';
      planMaxKm = 8000;
      planMaxDays = 90;
      serviceDateObj = new Date(today.getTime() - 20 * 86400000);
      nextDueDateObj = new Date(today.getTime() + 70 * 86400000);
      prevOdometer = 64000;
      serviceOdometer = 70900;
      currentOdometer = 72800;
      daysElapsedAtService = 79;
    } else {
      // Historical PM Record (> 2 years old -> Archived to BigQuery)
      serviceTier = isQuebec ? 'QC_FICHE_ENTRETIEN' : 'SERVICE_B';
      serviceDateObj = new Date('2024-02-18T10:00:00Z');
      nextDueDateObj = new Date('2024-05-18T10:00:00Z');
      prevOdometer = 51000;
      serviceOdometer = 58200;
      currentOdometer = 58200;
      daysElapsedAtService = 81;
      isArchived = true;
      archivedAt = '2026-02-20T09:15:00Z';
    }

    const serviceDateStr = serviceDateObj.toISOString().slice(0, 10);
    const nextDueDateStr = nextDueDateObj.toISOString().slice(0, 10);
    const kmDrivenAtService = serviceOdometer - prevOdometer;
    const nextDueOdometer = serviceOdometer + planMaxKm;
    const performerType = idx % 3 === 1 ? 'EXTERNAL_SHOP' : 'IN_HOUSE_MECHANIC';

    const pmAttachments: InspectionAttachment[] = [
      {
        id: `pm-att-${v.unitNumber}-1`,
        name: province === 'QC'
          ? `Fiche_Entretien_SAAQ_Unit_${v.unitNumber}_${serviceDateStr}.pdf`
          : `PM_WorkOrder_${serviceTier}_Unit_${v.unitNumber}_${serviceDateStr}.pdf`,
        category: province === 'QC' ? 'fiche_entretien' : 'work_order',
        categoryLabel: province === 'QC' ? 'Fiche d\'entretien SAAQ' : 'Signed Work Order',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 198400,
        uploadedAt: serviceDateStr + 'T16:10:00Z',
        uploadedBy: performerType === 'IN_HOUSE_MECHANIC' ? 'Jean-Luc Picard (310T)' : 'Service Advisor',
        description: province === 'QC'
          ? 'Signed SAAQ mandatory mechanical maintenance checklist (Fiche d\'entretien)'
          : `Completed ${serviceTier} preventive maintenance checklist with odometer verification`
      },
      {
        id: `pm-att-${v.unitNumber}-2`,
        name: `Invoice_Oil_15W40_Filters_${v.unitNumber}.pdf`,
        category: 'parts_invoice',
        categoryLabel: 'Parts & Oil Invoice',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 142300,
        uploadedAt: serviceDateStr + 'T16:25:00Z',
        uploadedBy: 'Parts Dept',
        description: 'Invoice for 19L 15W-40 CK-4 Heavy Duty Diesel Engine Oil & Fleetguard LF16015 Filter'
      }
    ];

    pmRecords.push({
      id: `PM-${v.unitNumber}-${serviceDateStr.replace(/-/g, '')}`,
      vehicleId: v.vehicleId || Number(v.unitNumber) || 1000 + idx,
      unitNumber: v.unitNumber,
      plateNumber: v.plateNumber || `${province}-${v.unitNumber}`,
      vin: v.vin || `1HVBBAB84KH${88000 + idx}`,
      unitType: v.unitType || 'School Bus (72-Pax)',
      yardName: v.yardName || 'HQ-Central',
      province,
      serviceTier,
      serviceDate: serviceDateStr,
      nextDueDate: nextDueDateStr,
      daysElapsedSinceLastService: daysElapsedAtService,
      planAllowedMaxDays: planMaxDays,
      odometerAtServiceKm: serviceOdometer,
      previousServiceOdometerKm: prevOdometer,
      kmDrivenSinceLastService: kmDrivenAtService,
      planAllowedMaxKm: planMaxKm,
      engineHoursAtService: Math.round(serviceOdometer / 38),
      currentVehicleOdometerKm: currentOdometer,
      nextDueOdometerKm: nextDueOdometer,
      wasPerformedOnTime,
      auditViolationNotes,
      checklist: {
        engineOilChanged: serviceTier !== 'SERVICE_A',
        oilSpecification: '15W-40 Heavy Duty Diesel (CK-4)',
        oilQuantityLiters: serviceTier === 'SERVICE_A' ? 0 : 19.0,
        oilFilterReplaced: serviceTier !== 'SERVICE_A',
        fuelFilterReplaced: serviceTier === 'SERVICE_C' || serviceTier === 'QC_FICHE_ENTRETIEN',
        chassisLubricated: true,
        tirePressureAdjusted: true,
        rearBrakeSlackAdjusted: true,
        fluidsToppedUp: true,
        suspensionAndSteeringChecked: true,
        lightsAndEmergencyExitsChecked: true,
        saaqFicheEntretienSigned: province === 'QC'
      },
      workOrderNumber: `WO-${serviceDateStr.slice(0, 4)}-${4100 + idx}`,
      partsInvoiceNumber: `INV-HD-${90210 + idx}`,
      partsCostCad: serviceTier === 'SERVICE_A' ? 145.0 : serviceTier === 'SERVICE_C' ? 890.0 : 385.5,
      laborHours: serviceTier === 'SERVICE_A' ? 1.5 : serviceTier === 'SERVICE_C' ? 5.5 : 2.5,
      attachments: pmAttachments,
      performerType,
      mechanicName: performerType === 'IN_HOUSE_MECHANIC' ? 'Jean-Luc Picard' : 'TruckPro Heavy Duty Service Center',
      mechanicLicenseNumber: performerType === 'IN_HOUSE_MECHANIC' ? (province === 'ON' ? '310T-ON-77412' : 'CPA-QC-33910') : 'EXT-CERT-882',
      mechanicSignature: `Signed Digitally: ${performerType === 'IN_HOUSE_MECHANIC' ? 'J.L. Picard' : 'R. Tremblay (Shop Foreman)'} (${serviceDateStr})`,
      shopName: performerType === 'IN_HOUSE_MECHANIC' ? `${v.yardName || 'HQ-Central'} Fleet Maintenance Bay #2` : 'TruckPro Heavy Duty Center - Ottawa/Gatineau',
      isArchivedToBigQuery: isArchived,
      bigQueryDataset: isArchived ? 'fleet_compliance.preventive_maintenance_archive' : undefined,
      bigQueryTable: isArchived ? 'pm_oil_change_records' : undefined,
      bigQueryArchivedAt: archivedAt,
      bigQueryRowId: isArchived ? `BQ-PM-${v.unitNumber}-2024` : undefined,
      notes: auditViolationNotes || 'All 5 statutory audit record elements verified: Vehicle ID, Service Date, Exact Odometer & Engine Hours, Itemized Oil/Grease/Brake Checklist with Invoice, and Certified Mechanic Sign-off.',
      createdAt: serviceDateStr + 'T16:00:00Z',
      updatedAt: new Date().toISOString()
    });
  });

  return pmRecords;
}

export const VehicleInspectionService = {
  getInspections: async (vehicles: Vehicle[] = []): Promise<VehicleInspectionRecord[]> => {
    if (db) {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const colRef = collection(db, FIRESTORE_COLLECTION);
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const list: VehicleInspectionRecord[] = [];
          snap.forEach((doc) => {
            const data = doc.data() as VehicleInspectionRecord;
            list.push({ ...data, id: doc.id });
          });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
          } catch {
            // ignore
          }
          return list;
        }
      } catch (err) {
        console.warn('[VehicleInspectionService] Firestore fetch error, fallback to local:', err);
      }
    }

    try {
      const localStr = localStorage.getItem(STORAGE_KEY);
      if (localStr) {
        const parsed = JSON.parse(localStr) as VehicleInspectionRecord[];
        if (parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    const seed = generateInitialInspections(vehicles);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch {
      // ignore
    }
    return seed;
  },

  saveInspection: async (record: VehicleInspectionRecord): Promise<VehicleInspectionRecord> => {
    const legalExpiry = getEndOfMonthDate(record.stickerMonth || record.inspectionDate);
    const isOverTwoYears = isOlderThanTwoYears(record.inspectionDate);

    const merged: VehicleInspectionRecord = {
      ...record,
      legalExpiryDate: legalExpiry,
      isArchivedToBigQuery: record.isArchivedToBigQuery || isOverTwoYears,
      bigQueryDataset: (record.isArchivedToBigQuery || isOverTwoYears) ? (record.bigQueryDataset || 'fleet_compliance.semi_annual_inspections') : undefined,
      bigQueryTable: (record.isArchivedToBigQuery || isOverTwoYears) ? (record.bigQueryTable || 'historical_inspection_archive') : undefined,
      bigQueryArchivedAt: (record.isArchivedToBigQuery || isOverTwoYears) ? (record.bigQueryArchivedAt || new Date().toISOString()) : undefined,
      bigQueryRowId: (record.isArchivedToBigQuery || isOverTwoYears) ? (record.bigQueryRowId || `BQ-${record.unitNumber}-${Date.now()}`) : undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      const existing = await VehicleInspectionService.getInspections();
      const idx = existing.findIndex((r) => r.id === merged.id || (r.unitNumber === merged.unitNumber && r.stickerMonth === merged.stickerMonth));
      if (idx >= 0) {
        existing[idx] = merged;
      } else {
        existing.unshift(merged);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      notifyListeners(existing);
    } catch (err) {
      console.warn('[VehicleInspectionService] local save error:', err);
    }

    if (db) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const docRef = doc(db, FIRESTORE_COLLECTION, merged.id);
        await setDoc(docRef, merged, { merge: true });
      } catch (err) {
        console.warn('[VehicleInspectionService] Firestore save error:', err);
      }
    }

    return merged;
  },

  addAttachment: async (inspectionId: string, attachment: InspectionAttachment): Promise<void> => {
    const list = await VehicleInspectionService.getInspections();
    const target = list.find((r) => r.id === inspectionId);
    if (!target) return;

    target.attachments = [...(target.attachments || []), attachment];
    target.updatedAt = new Date().toISOString();

    await VehicleInspectionService.saveInspection(target);
  },

  deleteAttachment: async (inspectionId: string, attachmentId: string): Promise<void> => {
    const list = await VehicleInspectionService.getInspections();
    const target = list.find((r) => r.id === inspectionId);
    if (!target) return;

    target.attachments = (target.attachments || []).filter((a) => a.id !== attachmentId);
    target.updatedAt = new Date().toISOString();

    await VehicleInspectionService.saveInspection(target);
  },

  syncToBigQuery: async (inspectionId: string): Promise<void> => {
    const list = await VehicleInspectionService.getInspections();
    const target = list.find((r) => r.id === inspectionId);
    if (!target) return;

    target.isArchivedToBigQuery = true;
    target.bigQueryDataset = 'fleet_compliance.semi_annual_inspections';
    target.bigQueryTable = 'historical_inspection_archive';
    target.bigQueryArchivedAt = new Date().toISOString();
    target.bigQueryRowId = `BQ-${target.unitNumber}-${target.stickerMonth.replace('-', '')}`;
    target.updatedAt = new Date().toISOString();

    await VehicleInspectionService.saveInspection(target);
  },

  batchArchiveOldRecordsToBigQuery: async (): Promise<number> => {
    const list = await VehicleInspectionService.getInspections();
    let count = 0;

    for (const record of list) {
      if (!record.isArchivedToBigQuery && isOlderThanTwoYears(record.inspectionDate)) {
        record.isArchivedToBigQuery = true;
        record.bigQueryDataset = 'fleet_compliance.semi_annual_inspections';
        record.bigQueryTable = 'historical_inspection_archive';
        record.bigQueryArchivedAt = new Date().toISOString();
        record.bigQueryRowId = `BQ-${record.unitNumber}-${record.stickerMonth.replace('-', '')}`;
        record.updatedAt = new Date().toISOString();
        count++;
      }
    }

    if (count > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      notifyListeners(list);
    }
    return count;
  },

  calculateStats: (records: VehicleInspectionRecord[]): VehicleInspectionStats => {
    let dueWithin30Days = 0;
    let overdue = 0;
    let compliant = 0;
    let archivedToBigQuery = 0;
    let withAttachmentsCount = 0;

    records.forEach((r) => {
      if (r.isArchivedToBigQuery) {
        archivedToBigQuery++;
      } else if (isOverdue(r.legalExpiryDate)) {
        overdue++;
      } else if (isDueWithin30Days(r.legalExpiryDate)) {
        dueWithin30Days++;
      } else {
        compliant++;
      }

      if (r.attachments && r.attachments.length > 0) {
        withAttachmentsCount++;
      }
    });

    return {
      totalInspected: records.length,
      dueWithin30Days,
      overdue,
      compliant,
      archivedToBigQuery,
      withAttachmentsCount
    };
  },

  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // ============================================================================
  // Preventive Maintenance (PM & Oil Changes / QC Fiche d'entretien) Operations
  // ============================================================================
  getPMRecords: async (vehicles: Vehicle[] = []): Promise<PreventiveMaintenanceRecord[]> => {
    if (db) {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const colRef = collection(db, PM_FIRESTORE_COLLECTION);
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const list: PreventiveMaintenanceRecord[] = [];
          snap.forEach((doc) => {
            const data = doc.data() as PreventiveMaintenanceRecord;
            list.push({ ...data, id: doc.id });
          });
          try {
            localStorage.setItem(PM_STORAGE_KEY, JSON.stringify(list));
          } catch {
            // ignore
          }
          return list;
        }
      } catch (err) {
        console.warn('[VehicleInspectionService] PM Firestore fetch error, fallback to local:', err);
      }
    }

    try {
      const localStr = localStorage.getItem(PM_STORAGE_KEY);
      if (localStr) {
        const parsed = JSON.parse(localStr) as PreventiveMaintenanceRecord[];
        if (parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    const seed = generateInitialPMRecords(vehicles);
    try {
      localStorage.setItem(PM_STORAGE_KEY, JSON.stringify(seed));
    } catch {
      // ignore
    }
    return seed;
  },

  savePMRecord: async (record: PreventiveMaintenanceRecord): Promise<PreventiveMaintenanceRecord> => {
    const isOverTwoYears = isOlderThanTwoYears(record.serviceDate);
    const kmDriven = Math.max(0, record.odometerAtServiceKm - record.previousServiceOdometerKm);
    const wasOnTime = kmDriven <= record.planAllowedMaxKm && record.daysElapsedSinceLastService <= record.planAllowedMaxDays;

    let violationNotes = record.auditViolationNotes;
    if (!wasOnTime && !violationNotes) {
      const reasons: string[] = [];
      if (kmDriven > record.planAllowedMaxKm) {
        reasons.push(`Driven ${kmDriven.toLocaleString()} km (Plan limit: ${record.planAllowedMaxKm.toLocaleString()} km)`);
      }
      if (record.daysElapsedSinceLastService > record.planAllowedMaxDays) {
        reasons.push(`Elapsed ${record.daysElapsedSinceLastService} days (Plan limit: ${record.planAllowedMaxDays} days)`);
      }
      violationNotes = `CVOR/SAAQ Audit Interval Violation: ${reasons.join(' & ')}`;
    }

    const merged: PreventiveMaintenanceRecord = {
      ...record,
      kmDrivenSinceLastService: kmDriven,
      wasPerformedOnTime: wasOnTime,
      auditViolationNotes: violationNotes,
      isArchivedToBigQuery: record.isArchivedToBigQuery || isOverTwoYears,
      bigQueryDataset: (record.isArchivedToBigQuery || isOverTwoYears)
        ? (record.bigQueryDataset || 'fleet_compliance.preventive_maintenance_archive')
        : undefined,
      bigQueryTable: (record.isArchivedToBigQuery || isOverTwoYears)
        ? (record.bigQueryTable || 'pm_oil_change_records')
        : undefined,
      bigQueryArchivedAt: (record.isArchivedToBigQuery || isOverTwoYears)
        ? (record.bigQueryArchivedAt || new Date().toISOString())
        : undefined,
      bigQueryRowId: (record.isArchivedToBigQuery || isOverTwoYears)
        ? (record.bigQueryRowId || `BQ-PM-${record.unitNumber}-${Date.now()}`)
        : undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      const existing = await VehicleInspectionService.getPMRecords();
      const idx = existing.findIndex((r) => r.id === merged.id);
      if (idx >= 0) {
        existing[idx] = merged;
      } else {
        existing.unshift(merged);
      }
      localStorage.setItem(PM_STORAGE_KEY, JSON.stringify(existing));
      notifyPMListeners(existing);
    } catch (err) {
      console.warn('[VehicleInspectionService] local PM save error:', err);
    }

    if (db) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const docRef = doc(db, PM_FIRESTORE_COLLECTION, merged.id);
        await setDoc(docRef, merged, { merge: true });
      } catch (err) {
        console.warn('[VehicleInspectionService] Firestore PM save error:', err);
      }
    }

    return merged;
  },

  addPMAttachment: async (pmId: string, attachment: InspectionAttachment): Promise<void> => {
    const list = await VehicleInspectionService.getPMRecords();
    const target = list.find((r) => r.id === pmId);
    if (!target) return;

    target.attachments = [...(target.attachments || []), attachment];
    target.updatedAt = new Date().toISOString();

    await VehicleInspectionService.savePMRecord(target);
  },

  deletePMAttachment: async (pmId: string, attachmentId: string): Promise<void> => {
    const list = await VehicleInspectionService.getPMRecords();
    const target = list.find((r) => r.id === pmId);
    if (!target) return;

    target.attachments = (target.attachments || []).filter((a) => a.id !== attachmentId);
    target.updatedAt = new Date().toISOString();

    await VehicleInspectionService.savePMRecord(target);
  },

  syncPMToBigQuery: async (pmId: string): Promise<void> => {
    const list = await VehicleInspectionService.getPMRecords();
    const target = list.find((r) => r.id === pmId);
    if (!target) return;

    target.isArchivedToBigQuery = true;
    target.bigQueryDataset = 'fleet_compliance.preventive_maintenance_archive';
    target.bigQueryTable = 'pm_oil_change_records';
    target.bigQueryArchivedAt = new Date().toISOString();
    target.bigQueryRowId = `BQ-PM-${target.unitNumber}-${target.serviceDate.replace(/-/g, '')}`;
    target.updatedAt = new Date().toISOString();

    await VehicleInspectionService.savePMRecord(target);
  },

  calculatePMStats: (records: PreventiveMaintenanceRecord[]): PreventiveMaintenanceStats => {
    let dueSoonCount = 0;
    let overdueOrViolationCount = 0;
    let compliantCount = 0;
    let archivedToBigQueryCount = 0;

    const todayMs = Date.now();

    records.forEach((r) => {
      if (r.isArchivedToBigQuery) {
        archivedToBigQueryCount++;
        return;
      }

      const dueMs = new Date(r.nextDueDate + 'T23:59:59').getTime();
      const daysRemaining = Math.ceil((dueMs - todayMs) / 86400000);
      const kmRemaining = r.nextDueOdometerKm - r.currentVehicleOdometerKm;

      const isCurrentlyOverdue = daysRemaining < 0 || kmRemaining < 0;
      const isDueSoon = !isCurrentlyOverdue && (daysRemaining <= 30 || kmRemaining <= 1000);

      if (isCurrentlyOverdue || !r.wasPerformedOnTime) {
        overdueOrViolationCount++;
      } else if (isDueSoon) {
        dueSoonCount++;
      } else {
        compliantCount++;
      }
    });

    return {
      totalRecords: records.length,
      dueSoonCount,
      overdueOrViolationCount,
      compliantCount,
      archivedToBigQueryCount
    };
  },

  subscribePM: (listener: PMListener): (() => void) => {
    pmListeners.add(listener);
    return () => {
      pmListeners.delete(listener);
    };
  }
};

function notifyListeners(records: VehicleInspectionRecord[]) {
  listeners.forEach((listener) => {
    try {
      listener(records);
    } catch (err) {
      console.error('Error notifying inspection listener:', err);
    }
  });
}

function notifyPMListeners(records: PreventiveMaintenanceRecord[]) {
  pmListeners.forEach((listener) => {
    try {
      listener(records);
    } catch (err) {
      console.error('Error notifying PM listener:', err);
    }
  });
}

