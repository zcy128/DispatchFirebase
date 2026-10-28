export interface PreTripInspectionItem {
  code: string;
  title: string;
  category: string;
  isSchoolBusSpecific?: boolean;
  status: 'pass' | 'minor_defect' | 'major_defect' | 'na';
  notes?: string;
}

export interface PreTripInspection {
  id: string;
  vehicleUnit: string;
  vehicleId?: number;
  vehiclePlate?: string;
  inspectionDate: string; // YYYY-MM-DD
  inspectionTime: string; // HH:mm
  inspectorId: string;
  inspectorName: string;
  odometer: number;
  overallStatus: 'passed' | 'passed_with_minor_defects' | 'failed_major_defects';
  items?: Record<string, PreTripInspectionItem>;
  defectNotes?: string;
  signatureName: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehiclePretripStatus {
  unitNumber: string;
  vehiclePlate?: string;
  unitMaker?: string;
  unitModel?: string;
  unitYear?: number;
  routeId?: string;
  routeName?: string;
  driverId?: string;
  driverName?: string;
  shiftType?: string;
  isAssigned: boolean;
  hasInspection: boolean;
  inspection?: PreTripInspection;
  status: 'passed' | 'passed_with_minor_defects' | 'failed_major_defects' | 'missing' | 'unassigned';
}
