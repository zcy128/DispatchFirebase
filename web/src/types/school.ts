export interface SchoolBoard {
  id?: string;
  schoolBoardId: number;
  schoolBoardName: string;
  schoolBoardCode: string;
  schoolCount?: number;
  studentCount?: number;
}

export interface School {
  id: string; // SCH-005
  schoolId: number;
  schoolName: string;
  schoolAddress: string;
  schoolPhone?: string;
  schoolFax?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  startTime?: string; // "08:30"
  dismissalTime?: string; // "15:00"
  earlyDismissalDay?: string;
  earlyDismissalTime?: string;
  contactPerson?: string;
  contactPersonCellPhone?: string;
  contactPersonEmail?: string;
  schoolNotes?: string;
  parkingNotes?: string;
  schoolBoardId: number;
  schoolBoardName?: string;
  schoolBoardCode?: string;
  isActive: boolean;
  studentNum: number;
  routes?: string;
  yardId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolStats {
  totalSchools: number;
  activeSchools: number;
  totalBoards: number;
  totalStudents: number;
  boardDistribution: Record<string, number>;
}
