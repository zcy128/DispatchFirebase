export interface StudentContact {
  contactId: string;
  studentId: number;
  contactIndex: number;
  primaryContact: boolean;
  contactName: string;
  relationship?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  address?: string;
  email?: string;
  active: boolean;
}

export interface StudentStop {
  stopId?: string;
  time: string; // e.g. "7:10 a.m." or "07:10 AM"
  type: string; // e.g. "Pickup" | "Dropoff" | "School Dropoff" | "School Pickup"
  opDays: string; // e.g. "M T W R F", "---- F", "M T W R -"
  location: string; // e.g. "993 CARRINGTON BV NW; CALGARY"
  comment?: string; // e.g. "Eastbound Carrington Boulevard after Carrington Road NW at house #995"
  instruction?: string; // e.g. "Met at bus by parent"
  route?: string; // e.g. "CBE-0433" or "OCDSB-001"
  shift?: string; // "AM" | "NOON" | "PM"
}

export interface Student {
  id: string; // STU-0001
  studentId: number;
  studentNo: string;
  firstName: string;
  lastName: string;
  studentName: string;
  fullName: string;
  studentAddress: string;
  studentPhone?: string;
  gender?: string;
  birthDate?: string;
  grade: string;
  active: boolean;
  metatBus: boolean;
  studentEmergencyAddress?: string;
  studentEmergencyPhone?: string;
  studentDispatchNotes?: string;
  studentSchoolNotes?: string;
  equipments?: string;
  schoolId: number;
  schoolName: string;
  routes?: string;
  contacts?: StudentContact[];
  stops?: StudentStop[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentStats {
  totalStudents: number;
  activeStudents: number;
  metAtBusCount: number;
  routesCovered: number;
  gradeDistribution: Record<string, number>;
  schoolDistribution: Record<string, number>;
}
