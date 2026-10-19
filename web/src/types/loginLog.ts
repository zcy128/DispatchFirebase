export type LoginStatus = 'success' | 'failure';

export interface LoginLogEntry {
  id: string;
  timestamp: string;      // ISO string e.g. "2026-10-05T20:15:30.000Z"
  date: string;           // YYYY-MM-DD for fast filtering
  status: LoginStatus;
  username: string;       // Entered username or email
  employeeName?: string;  // Captured if login succeeds
  employeeId?: string;    // Captured if login succeeds
  role?: string;          // Role of the logged-in user
  app: string;            // e.g. "Dispatch Web Hub", "Driver Mobile App"
  appVersion: string;     // e.g. "v1.0.0"
  failureReason?: string; // Reason if status === 'failure'
  deviceInfo?: string;    // Browser / platform summary
  ipAddress?: string;
}

export interface LoginLogFilter {
  date?: string;          // YYYY-MM-DD
  searchQuery?: string;   // Generic text search across fields
  username?: string;
  employeeName?: string;
  app?: string;
  appVersion?: string;
  status?: LoginStatus | 'all';
}
