export type InspectionAttachmentCategory =
  | 'certificate'
  | 'measurements'
  | 'repair_proof'
  | 'sticker_photo'
  | 'work_order'
  | 'parts_invoice'
  | 'fiche_entretien'
  | 'other';

export interface InspectionAttachment {
  id: string;
  name: string;
  category: InspectionAttachmentCategory;
  categoryLabel?: string;
  type: 'pdf' | 'image';
  mimeType: string;
  size: number;
  dataUrl?: string; // Base64 data URL for instant viewing and offline support
  storageUrl?: string;
  uploadedAt: string;
  uploadedBy?: string;
  description?: string;
}

export interface VehicleInspectionRecord {
  id: string;
  vehicleId: number;
  unitNumber: string;
  plateNumber: string;
  vin?: string;
  unitType: string;
  yardName: string;
  province: 'ON' | 'QC';
  // Actual date when inspection was conducted (preserved permanently)
  inspectionDate: string; // YYYY-MM-DD
  // Optional scheduled date or active inspection status for dispatch exclusion
  scheduledInspectionDate?: string; // YYYY-MM-DD
  inspectionStatus?: 'compliant' | 'scheduled' | 'in_inspection' | 'completed';
  // Decal sticker month (e.g. "2026-10" for OCT)
  stickerMonth: string; // YYYY-MM
  // Legal validity expires at midnight (23:59:59) on the LAST DAY OF THE STICKER MONTH
  legalExpiryDate: string; // YYYY-MM-DD (e.g. 2026-10-31)
  certificateNumber?: string; // DriveON # or SAAQ CVM #
  stickerNumber?: string; // Decal / Vignette #
  facilityName?: string;
  technicianName?: string;
  odometerAtInspection?: number;
  // 3 Statutory Archival Requirements
  hasInVehicleCertificate: boolean; // Glovebox certificate present
  hasDetailedMeasurementsArchived: boolean; // Brake lining mm and tire tread mm sheets archived
  hasProofOfRepairsAttached: boolean; // Defect repair work orders and parts invoices attached
  // Attachments (PDF and Images)
  attachments: InspectionAttachment[];
  // BigQuery Archival (> 2 years statutory retention threshold)
  isArchivedToBigQuery: boolean;
  bigQueryDataset?: string;
  bigQueryTable?: string;
  bigQueryArchivedAt?: string;
  bigQueryRowId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleInspectionStats {
  totalInspected: number;
  dueWithin30Days: number;
  overdue: number;
  compliant: number;
  archivedToBigQuery: number;
  withAttachmentsCount: number;
}

export type PMServiceTier = 'QC_FICHE_ENTRETIEN' | 'SERVICE_A' | 'SERVICE_B' | 'SERVICE_C';

export interface PMChecklistItem {
  engineOilChanged: boolean;
  oilSpecification: string; // e.g. "15W-40 CK-4 Heavy Duty"
  oilQuantityLiters: number; // e.g. 18.5
  oilFilterReplaced: boolean;
  fuelFilterReplaced: boolean;
  chassisLubricated: boolean; // Grease kingpins, U-joints, s-cams
  tirePressureAdjusted: boolean;
  rearBrakeSlackAdjusted: boolean;
  fluidsToppedUp: boolean; // Coolant, DEF, power steering, washer
  suspensionAndSteeringChecked: boolean;
  lightsAndEmergencyExitsChecked: boolean;
  saaqFicheEntretienSigned: boolean; // Mandatory for Quebec Entretien mecanique obligatoire
}

/**
 * Covers the 5 Mandatory Statutory Record Elements for Preventive Maintenance & Oil Changes:
 * 1. Vehicle Identification (Unit #, Plate #, VIN)
 * 2. Maintenance Date (Date & Next Due Date)
 * 3. Odometer Reading (km) & Engine Hours at time of service (Critical for auditor interval check)
 * 4. Itemized Checklist & Invoices / Work Orders (Oil liters, filter, grease, brake slack + attached invoices)
 * 5. Performer Identity (Mechanic Name & Signature, or External Repair Shop Name & Invoice)
 */
export interface PreventiveMaintenanceRecord {
  id: string;
  // 1. Vehicle Identification
  vehicleId: number;
  unitNumber: string;
  plateNumber: string;
  vin: string;
  unitType: string;
  yardName: string;
  province: 'ON' | 'QC';

  // 2. Maintenance Date & Schedule
  serviceTier: PMServiceTier;
  serviceDate: string; // YYYY-MM-DD
  scheduledServiceDate?: string; // YYYY-MM-DD
  maintenanceStatus?: 'scheduled' | 'in_progress' | 'completed';
  nextDueDate: string; // YYYY-MM-DD
  daysElapsedSinceLastService: number;
  planAllowedMaxDays: number;

  // 3. Odometer Reading & Engine Hours at Service
  odometerAtServiceKm: number;
  previousServiceOdometerKm: number;
  kmDrivenSinceLastService: number;
  planAllowedMaxKm: number;
  engineHoursAtService: number;
  currentVehicleOdometerKm: number;
  nextDueOdometerKm: number;

  // Audit Compliance Evaluation ("Write what you do, do what you write")
  wasPerformedOnTime: boolean; // False if kmDrivenSinceLastService > planAllowedMaxKm OR daysElapsed > planAllowedMaxDays
  auditViolationNotes?: string;

  // 4. Itemized Work Checklist & Work Order / Parts Invoices
  checklist: PMChecklistItem;
  workOrderNumber: string;
  partsInvoiceNumber: string;
  partsCostCad?: number;
  laborHours?: number;
  attachments: InspectionAttachment[];

  // 5. Performer Identity & Sign-off
  performerType: 'IN_HOUSE_MECHANIC' | 'EXTERNAL_SHOP';
  mechanicName: string;
  mechanicLicenseNumber?: string;
  mechanicSignature: string;
  shopName: string;

  // BigQuery Cold Archival (> 2 Years)
  isArchivedToBigQuery: boolean;
  bigQueryDataset?: string;
  bigQueryTable?: string;
  bigQueryArchivedAt?: string;
  bigQueryRowId?: string;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreventiveMaintenanceStats {
  totalRecords: number;
  dueSoonCount: number; // Due within 30 days or <= 1,000 km remaining
  overdueOrViolationCount: number; // Currently overdue by km/days or past interval violation
  compliantCount: number;
  archivedToBigQueryCount: number;
}

