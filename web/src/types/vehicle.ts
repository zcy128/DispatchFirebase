export interface Vehicle {
  id: string; // "VEH-001"
  vehicleId: number;
  unitNumber: string; // "1001"
  plateNumber: string; // "ON-1001"
  vin?: string;
  manufacturer: string; // "Blue Bird"
  model: string; // "CE Series"
  year: number;
  color: string;
  unitType: 'Bus' | 'Van' | 'Car' | string;
  seatCap: number;
  wheelchairCap: number;
  fuelType: 'Diesel' | 'Gasoline' | string;
  licenseExpiry?: string;
  active: boolean;
  status: 'In Service' | 'Spare' | 'Maintenance' | string;
  yardName: string;
  odometer?: number;
  employeeId?: number;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  assignedRouteId?: string; // "RT-001"
  assignedRouteNo?: string; // "OCDSB-001"
  assignedRouteName?: string;
  notes?: string;
  // Semi-annual safety inspection & regulatory compliance fields
  lastInspectionDate?: string; // YYYY-MM-DD
  nextInspectionDue?: string; // YYYY-MM-DD (typically 6 months)
  inspectionCertificateNumber?: string; // e.g. "ON-DOC-98124" or "QC-CVM-55412"
  inspectionStickerNumber?: string; // e.g. "STK-2026-0881"
  inspectionFacility?: string; // Station / Facility / Mandataire
  hasInVehicleCertificate?: boolean; // Glovebox certificate present for roadside inspection
  hasDetailedMeasurementsArchived?: boolean; // Brake lining mm & tire tread mm measurement sheets archived
  hasProofOfRepairsAttached?: boolean; // Defect repair work orders and parts invoices attached
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleStats {
  totalVehicles: number;
  activeVehicles: number;
  assignedToRoutes: number;
  spareVehicles: number;
  wheelchairAccessible: number;
  typeDistribution: Record<string, number>;
  fuelDistribution: Record<string, number>;
  yardDistribution: Record<string, number>;
}
