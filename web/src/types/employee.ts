export interface DriverLicense {
  licenseId: string;
  expirationDate: string; // ISO string
  licenseClass: string;
  licenseCondition?: string;
  mvid?: string;
  issuedDate?: string;
}

export interface EmployeeContact {
  contactId: string;
  primaryContact: boolean;
  contactName: string;
  relationship?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  email?: string;
  active: boolean;
}

export interface EmployeePhoto {
  photoUrl?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  updatedAt?: string;
}

export interface Employee {
  id: string;
  employeeId?: number;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  username?: string;
  fullName: string;
  mobilePhone?: string;
  workPhonePhone?: string;
  homePhone?: string;
  preferredPhone?: string;
  personalEmail?: string;
  workEmail?: string;
  preferredEmail?: string;
  jobPosition: string;
  dateHired?: string;
  isActive: boolean;
  personalAddress?: string;
  lat?: number;
  lng?: number;
  yardId?: string;
  driverLicense?: DriverLicense;
  employeeContacts?: EmployeeContact[];
  employeePhoto?: EmployeePhoto;
  firebaseUid?: string;
  role?: UserRole | string;
  pagePermissions?: Record<string, PermissionLevel>;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole =
  | 'admin'
  | 'manager'
  | 'dispatcher'
  | 'supervisor'
  | 'office staff'
  | 'studentcare'
  | 'fleet'
  | 'HR'
  | 'payroll'
  | 'training'
  | 'driver'
  | 'helper';

export type PermissionLevel = 'none' | 'readonly' | 'readwrite';

export type EmployeePagePermissions = Record<string, PermissionLevel>;

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalDrivers: number;
  licenseExpiringSoon: number;
  yardDistribution: Record<string, number>;
  timestamp: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  role: string;
  employeeId?: string;
  displayName?: string;
  username?: string;
  fullName?: string;
  yardId?: string;
  overrides?: Record<string, PermissionLevel>;
  pagePermissions?: Record<string, PermissionLevel>;
}
