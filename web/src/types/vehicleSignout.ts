export interface VehicleSignoutAttachment {
  url: string;
  fileName: string;
  caption?: string;
  uploadedTime: string;
}

export interface VehicleSignout {
  id: string;
  isSignIn: boolean; // false = Sign Out (handover to driver), true = Sign In (return to yard)
  signDate: string;
  vehicleType: number; // 0 = Bus, 1 = Van
  employeeId: string;
  employeeName: string;
  routeId?: string;
  routeName?: string;
  cellPhone?: string;
  driverLicenseClass?: string;
  driverLicenseCondition?: string;
  unitId?: number;
  unitNumber: string;
  odometer: number;
  licensePlate?: string;
  cvipDate?: string;
  unitYear?: number;
  unitMaker?: string;
  unitModel?: string;
  unitColor?: string;
  fuelLevelId?: number;
  fuelLevelDescription?: string;
  fuelTypeId?: number;
  fuelTypeDescription?: string;

  // Documents Check
  docRegistrationSignIn: boolean;
  docInsuranceSignIn: boolean;
  docSafetyFitnessSignIn: boolean;
  docCollisionReportSignIn: boolean;
  docScheduleMaintenanceSignIn: boolean;
  docSdsSignIn: boolean;

  // Safety Equipment Checklist
  checkFireExtinguisher: boolean;
  checkFirstAidKit: boolean;
  checkTriangles: boolean;
  checkQstraints: boolean;
  checkSeatBeltCutter: boolean;
  checkBroom: boolean;
  checkSnowbrush: boolean;
  checkCleankit: boolean;

  // Parking & Acknowledgement
  acknowledgeCheck: boolean;
  conditionKey?: string;
  conditionComments?: string;
  parkingAddress?: string;
  fireHallLocation?: string;

  // Signatures
  driverSignature?: string;
  driverSignDate?: string;
  fleetDepartmentSignature?: string;
  fleetDepartmentSignDate?: string;

  attachments?: VehicleSignoutAttachment[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleSignoutPayload {
  isSignIn: boolean;
  signDate: string;
  vehicleType: number;
  employeeId: string;
  employeeName: string;
  routeId?: string;
  routeName?: string;
  cellPhone?: string;
  driverLicenseClass?: string;
  driverLicenseCondition?: string;
  unitId?: number;
  unitNumber: string;
  odometer: number;
  licensePlate?: string;
  cvipDate?: string;
  unitYear?: number;
  unitMaker?: string;
  unitModel?: string;
  unitColor?: string;
  fuelLevelId?: number;
  fuelLevelDescription?: string;
  fuelTypeId?: number;
  fuelTypeDescription?: string;
  docRegistrationSignIn: boolean;
  docInsuranceSignIn: boolean;
  docSafetyFitnessSignIn: boolean;
  docCollisionReportSignIn: boolean;
  docScheduleMaintenanceSignIn: boolean;
  docSdsSignIn: boolean;
  checkFireExtinguisher: boolean;
  checkFirstAidKit: boolean;
  checkTriangles: boolean;
  checkQstraints: boolean;
  checkSeatBeltCutter: boolean;
  checkBroom: boolean;
  checkSnowbrush: boolean;
  checkCleankit: boolean;
  acknowledgeCheck: boolean;
  conditionKey?: string;
  conditionComments?: string;
  parkingAddress?: string;
  fireHallLocation?: string;
  driverSignature?: string;
  driverSignDate?: string;
  fleetDepartmentSignature?: string;
  fleetDepartmentSignDate?: string;
  attachments?: VehicleSignoutAttachment[];
  createdBy?: string;
}
