import { AuthUser, PermissionLevel, UserRole } from '../types/employee';
import { NavTab } from '../components/common/Sidebar';

export interface PageDefinition {
  id: NavTab;
  label: string;
  category: 'operations' | 'masterData' | 'hr_finance' | 'system';
  description: string;
}

export const SYSTEM_PAGES: PageDefinition[] = [
  // Operations & Dispatch
  { id: 'dashboard', label: 'Fleet Pulse / Dashboard', category: 'operations', description: 'Real-time operational dashboard & live metrics' },
  { id: 'dispatch', label: 'Dispatch Workbench', category: 'operations', description: 'Daily route dispatch assignment & bus allocations' },
  { id: 'routes', label: 'Route Network', category: 'operations', description: 'Route paths, runs, stops and schedules' },
  { id: 'staging_routes', label: 'Staging Routes', category: 'operations', description: 'BusPlanner staging routes, shifts, stops, and students. No crew assignment.' },
  { id: 'dispatch_payroll', label: 'Daily Dispatch Payroll', category: 'operations', description: 'Daily dispatch shift payroll review, driver shift adjustments and finance approvals' },
  { id: 'charter', label: 'Charter Trip Management', category: 'operations', description: 'Charter trip contracts, multi-vehicle dispatch, crew check-in and payroll generation' },
  { id: 'dispatch_log', label: 'Dispatch Change Log', category: 'operations', description: 'Audit trail of dispatcher changes & cover assignments' },
  { id: 'temporary_assignments', label: 'Route Openings & Coverage', category: 'operations', description: 'Route vacancy bidding board and temporary shift covers' },
  { id: 'assignment_history', label: 'Assignment Tracking (Driver & Route/Bus)', category: 'operations', description: 'Lifecycle history tracking when drivers are assigned or unassigned from routes and vehicles' },
  { id: 'route_assessments', label: 'Route Safety Assessments', category: 'operations', description: 'Roadway safety assessments & evaluation sheets' },
  { id: 'defects', label: 'Vehicle Defects & Maintenance', category: 'operations', description: 'Driver DVIR mechanical defects & shop work orders' },
  { id: 'vehicle_signouts', label: 'Vehicle Handover / Sign-out', category: 'operations', description: 'Bus key sign-outs, yard departure & return records' },
  { id: 'student_incidents', label: 'Student Incidents', category: 'operations', description: 'School bus behavioral and disciplinary incident reports' },
  { id: 'hazards', label: 'Hazard & Near-Miss Reports', category: 'operations', description: 'Environmental hazards, road risks, and near misses' },

  // Master Data
  { id: 'employees', label: 'Staff Directory (Employees)', category: 'masterData', description: 'Master personnel database, credentials and emergency info' },
  { id: 'students', label: 'Student Directory', category: 'masterData', description: 'Student passengers, boarding schools & guardian contacts' },
  { id: 'schools', label: 'Schools & Bell Times', category: 'masterData', description: 'Educational institutions, bell schedules and yard contacts' },
  { id: 'calendar', label: 'School Calendar', category: 'masterData', description: 'District academic calendars, holidays, and closures' },
  { id: 'vehicles', label: 'Fleet Vehicles', category: 'masterData', description: 'Bus fleet assets, odometer tracking and inspections' },
  { id: 'vehicle_inspections', label: 'Vehicle Mechanical Inspections', category: 'masterData', description: 'Semi-annual safety inspections, end-of-month validity, attachments, and BigQuery archival' },
  { id: 'yards', label: 'Operational Yards', category: 'masterData', description: 'Bus terminal depots, yard supervisors and dispatch zones' },
  { id: 'compliance', label: 'CDL License Compliance', category: 'masterData', description: 'Commercial driver license expiry and medical certification' },

  // HR, Training & Finance
  { id: 'time_off', label: 'Time Off Requests', category: 'hr_finance', description: 'Driver absence requests, sick leave and vacation approval' },
  { id: 'training', label: 'Training & Courses', category: 'hr_finance', description: 'Safety training sessions, annual recertification and logs' },
  { id: 'expenses', label: 'Expense Reimbursements', category: 'hr_finance', description: 'Driver out-of-pocket receipts and reimbursement approvals' },
  { id: 'payroll', label: 'Payroll & Compensation', category: 'hr_finance', description: 'Daily driver payroll timesheets and finance adjustments' },
  { id: 'biweekly_payroll', label: 'Bi-Weekly Payroll Summary', category: 'hr_finance', description: '2-week pay period aggregation per driver & attendant grouped by route/rate' },
  { id: 'payroll_dept_log', label: 'Payroll Department Log', category: 'hr_finance', description: 'Finance department locked payroll logs and historical reviews' },
  { id: 'company_contacts', label: 'Company Contacts Directory', category: 'hr_finance', description: 'Corporate emergency hotlines, operations desks, and departmental extensions' },

  // System
  { id: 'roles', label: 'Roles & Staff Allocation', category: 'system', description: 'Overview of staff assignments per role with permission management' },
  { id: 'login_logs', label: 'Login Audit Logs', category: 'system', description: 'Comprehensive audit trail of user and driver authentication attempts' },
  { id: 'audit_logs', label: 'System Audit Logs', category: 'system', description: 'Cross-functional audit query console across dispatch, routes, master records, payroll, and safety logs' },
  { id: 'external_sync', label: 'External Data Sync', category: 'system', description: 'BambooHR and Zonar sync settings. Credentials stay on the server.' },
  { id: 'settings', label: 'System & Security Settings', category: 'system', description: 'Security identity credentials, administrator configuration' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  operations: 'Operations & Dispatch',
  masterData: 'Master Data',
  hr_finance: 'HR, Training & Finance',
  system: 'System Configuration',
};

export const USER_ROLES: UserRole[] = [
  'admin',
  'manager',
  'dispatcher',
  'supervisor',
  'office staff',
  'studentcare',
  'fleet',
  'HR',
  'payroll',
  'training',
  'driver',
  'helper',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  dispatcher: 'Dispatcher',
  supervisor: 'Supervisor',
  'office staff': 'Office Staff',
  studentcare: 'Student Care',
  fleet: 'Fleet Maintenance',
  HR: 'Human Resources (HR)',
  payroll: 'Payroll & Finance',
  training: 'Safety Training',
  driver: 'School Bus Driver',
  helper: 'Bus Helper / Attendant',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full system administrator privileges. Can manage all pages, user roles, and custom page authorizations.',
  manager: 'Read-only access across all operational, dispatch, fleet, and financial views.',
  dispatcher: 'Read/write access to dispatch and route pages, students, and schools. Read-only for staff and time-off. No access to payroll.',
  supervisor: 'Read-only access to dispatch shifts, routes, and vehicles assigned to their own yard.',
  'office staff': 'Read-only access to operations and master data. No access to payroll.',
  studentcare: 'Read/write access to students and student incidents. Read-only for routes and safety. No access to payroll or HR.',
  fleet: 'Read/write access to vehicles, mechanical defects, and vehicle handovers. Read-only dispatch and routes. No access to payroll.',
  HR: 'Read/write access to staff directory, time-off requests, and expense claims. Read-only for operations. No access to payroll.',
  payroll: 'Read/write access to driver payroll and timesheet compensation. Read-only for other pages.',
  training: 'Read/write access to driver safety training programs and course logs. Read-only for operations. No access to payroll.',
  driver: 'Primarily uses Driver App (access to driver forms with read-only handover). No web management access by default.',
  helper: 'Primarily uses Driver App (student incidents, hazard reports, time-off, expenses). No web management access by default.',
};

export function normalizeRole(role?: string | null): UserRole {
  if (!role) return 'driver';
  const r = role.trim().toLowerCase();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'dispatcher') return 'dispatcher';
  if (r === 'supervisor') return 'supervisor';
  if (r === 'office staff' || r === 'office_staff' || r === 'officestaff' || r === 'staff') return 'office staff';
  if (r === 'studentcare' || r === 'student_care' || r === 'student care') return 'studentcare';
  if (r === 'fleet' || r === 'mechanic') return 'fleet';
  if (r === 'hr') return 'HR';
  if (r === 'payroll' || r === 'finance') return 'payroll';
  if (r === 'training') return 'training';
  if (r === 'driver') return 'driver';
  if (r === 'helper' || r === 'attendant' || r === 'monitor') return 'helper';
  return 'driver';
}

/**
 * Factory baseline permission matrix for all 12 roles
 */
export const FACTORY_ROLE_PERMISSIONS: Record<UserRole, Record<NavTab, PermissionLevel>> = {
  admin: {
    dashboard: 'readwrite',
    dispatch: 'readwrite',
    charter: 'readwrite',
    dispatch_payroll: 'readwrite',
    dispatch_log: 'readwrite',
    temporary_assignments: 'readwrite',
    assignment_history: 'readwrite',
    routes: 'readwrite',
    staging_routes: 'readwrite',
    route_assessments: 'readwrite',
    defects: 'readwrite',
    vehicle_signouts: 'readwrite',
    student_incidents: 'readwrite',
    hazards: 'readwrite',
    employees: 'readwrite',
    students: 'readwrite',
    student_absences: 'readwrite',
    schools: 'readwrite',
    calendar: 'readwrite',
    vehicles: 'readwrite',
    vehicle_inspections: 'readwrite',
    yards: 'readwrite',
    compliance: 'readwrite',
    time_off: 'readwrite',
    training: 'readwrite',
    expenses: 'readwrite',
    payroll: 'readwrite',
    biweekly_payroll: 'readwrite',
    payroll_dept_log: 'readwrite',
    roles: 'readwrite',
    company_contacts: 'readwrite',
    login_logs: 'readwrite',
    audit_logs: 'readwrite',
    settings: 'readwrite',
    external_sync: 'readwrite',
  },

  manager: {
    dashboard: 'readonly',
    dispatch: 'readonly',
    charter: 'readonly',
    dispatch_payroll: 'readonly',
    dispatch_log: 'readonly',
    temporary_assignments: 'readonly',
    assignment_history: 'readonly',
    routes: 'readonly',
    staging_routes: 'readonly',
    route_assessments: 'readonly',
    defects: 'readonly',
    vehicle_signouts: 'readonly',
    student_incidents: 'readonly',
    hazards: 'readonly',
    employees: 'readonly',
    students: 'readonly',
    student_absences: 'readonly',
    schools: 'readonly',
    calendar: 'readonly',
    vehicles: 'readonly',
    vehicle_inspections: 'readonly',
    yards: 'readonly',
    compliance: 'readonly',
    time_off: 'readonly',
    training: 'readonly',
    expenses: 'readonly',
    payroll: 'readonly',
    biweekly_payroll: 'readonly',
    payroll_dept_log: 'readonly',
    roles: 'readonly',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  dispatcher: {
    dashboard: 'readwrite',
    dispatch: 'readwrite',
    charter: 'readwrite',
    dispatch_payroll: 'readwrite',
    dispatch_log: 'readwrite',
    temporary_assignments: 'readwrite',
    assignment_history: 'readwrite',
    routes: 'readwrite',
    staging_routes: 'readwrite',
    route_assessments: 'readwrite',
    defects: 'readonly',
    vehicle_signouts: 'readonly',
    student_incidents: 'readonly',
    hazards: 'readonly',
    employees: 'readonly', // Read-only employees
    students: 'readwrite', // Accessible students
    student_absences: 'readwrite',
    schools: 'readwrite',   // Accessible schools
    calendar: 'readwrite',
    vehicles: 'readonly',
    vehicle_inspections: 'readonly',
    yards: 'readonly',
    compliance: 'readonly',
    time_off: 'readonly',  // Read-only time off
    training: 'readonly',
    expenses: 'none',
    payroll: 'none',       // No access to payroll
    biweekly_payroll: 'none',
    payroll_dept_log: 'readonly',
    roles: 'readonly',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  'office staff': {
    dashboard: 'readonly',
    dispatch: 'readonly',
    charter: 'none',
    dispatch_payroll: 'none',
    dispatch_log: 'readonly',
    temporary_assignments: 'readonly',
    assignment_history: 'readonly',
    routes: 'readonly',
    staging_routes: 'readonly',
    route_assessments: 'readonly',
    defects: 'readonly',
    vehicle_signouts: 'readonly',
    student_incidents: 'readonly',
    hazards: 'readonly',
    employees: 'readonly',
    students: 'readonly',
    student_absences: 'readonly',
    schools: 'readonly',
    calendar: 'readonly',
    vehicles: 'readonly',
    vehicle_inspections: 'readonly',
    yards: 'readonly',
    compliance: 'readonly',
    time_off: 'readonly',
    training: 'readonly',
    expenses: 'readonly',
    payroll: 'none', // No access to payroll, other pages read-only
    biweekly_payroll: 'none',
    payroll_dept_log: 'none',
    roles: 'readonly',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  studentcare: {
    dashboard: 'readonly',
    dispatch: 'readonly',
    charter: 'none',
    dispatch_payroll: 'none',
    dispatch_log: 'readonly',
    temporary_assignments: 'readonly',
    assignment_history: 'none',
    routes: 'readonly',
    staging_routes: 'readonly',
    route_assessments: 'readonly',
    defects: 'readonly',
    vehicle_signouts: 'none',
    student_incidents: 'readwrite', // Read/write student incidents
    hazards: 'readonly',
    employees: 'none',              // No access to HR or employees
    students: 'readwrite',          // Read/write students
    student_absences: 'readwrite',
    schools: 'readonly',
    calendar: 'readonly',
    vehicles: 'none',
    vehicle_inspections: 'none',
    yards: 'none',
    compliance: 'none',
    time_off: 'none',               // No access to HR/time-off
    training: 'readonly',
    expenses: 'none',               // No access to HR/expenses
    payroll: 'none',                // No access to payroll
    biweekly_payroll: 'none',
    payroll_dept_log: 'none',
    roles: 'none',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  fleet: {
    dashboard: 'readonly',
    dispatch: 'readonly',           // Read-only dispatch
    charter: 'readonly',
    dispatch_payroll: 'none',
    dispatch_log: 'readonly',
    temporary_assignments: 'readonly',
    assignment_history: 'readwrite', // Can track vehicle & driver allocations
    routes: 'readonly',
    staging_routes: 'readonly',             // Read-only routes
    route_assessments: 'readonly',
    defects: 'readwrite',           // Read/write defects
    vehicle_signouts: 'readwrite',  // Read/write vehicle handovers
    student_incidents: 'none',
    hazards: 'readonly',
    employees: 'none',
    students: 'none',
    student_absences: 'none',
    schools: 'none',
    calendar: 'none',
    vehicles: 'readwrite',          // Read/write vehicles
    vehicle_inspections: 'readwrite',
    yards: 'readonly',
    compliance: 'readonly',
    time_off: 'none',
    training: 'none',
    expenses: 'none',
    payroll: 'none',                // No access to payroll
    biweekly_payroll: 'none',
    payroll_dept_log: 'none',
    roles: 'none',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  supervisor: {
    dashboard: 'readonly',
    dispatch: 'readonly',           // Read-only yard dispatch
    charter: 'readonly',
    dispatch_payroll: 'readonly',
    dispatch_log: 'readonly',
    temporary_assignments: 'readonly',
    assignment_history: 'readonly',
    routes: 'readonly',
    staging_routes: 'readonly',             // Read-only yard route shifts
    route_assessments: 'readonly',
    defects: 'readonly',
    vehicle_signouts: 'readonly',
    student_incidents: 'readonly',
    hazards: 'readonly',
    employees: 'none',
    students: 'none',
    student_absences: 'readonly',
    schools: 'none',
    calendar: 'readonly',
    vehicles: 'readonly',           // Read-only yard vehicles
    vehicle_inspections: 'readonly',
    yards: 'readonly',
    compliance: 'readonly',
    time_off: 'none',
    training: 'none',
    expenses: 'none',
    payroll: 'none',
    biweekly_payroll: 'none',
    payroll_dept_log: 'none',
    roles: 'none',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  HR: {
    dashboard: 'readonly',
    dispatch: 'readonly',
    charter: 'none',
    dispatch_payroll: 'none',
    dispatch_log: 'readonly',
    temporary_assignments: 'readonly',
    assignment_history: 'readonly',
    routes: 'readonly',
    staging_routes: 'readonly',
    route_assessments: 'readonly',
    defects: 'readonly',
    vehicle_signouts: 'none',
    student_incidents: 'readonly',
    hazards: 'readonly',
    employees: 'readwrite', // Read/write employees
    students: 'readonly',
    student_absences: 'readonly',
    schools: 'readonly',
    calendar: 'readonly',
    vehicles: 'readonly',
    vehicle_inspections: 'readonly',
    yards: 'readonly',
    compliance: 'readonly',
    time_off: 'readwrite',  // Read/write time-off
    training: 'readonly',
    expenses: 'readwrite',  // Read/write expense reimbursements
    payroll: 'none',        // No access to payroll
    biweekly_payroll: 'none',
    payroll_dept_log: 'none',
    roles: 'readwrite',
    company_contacts: 'readwrite',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  payroll: {
    dashboard: 'readonly',
    dispatch: 'readonly',
    charter: 'readonly',
    dispatch_payroll: 'readonly',
    dispatch_log: 'readonly',
    temporary_assignments: 'readonly',
    assignment_history: 'readonly',
    routes: 'readonly',
    staging_routes: 'readonly',
    route_assessments: 'readonly',
    defects: 'readonly',
    vehicle_signouts: 'readonly',
    student_incidents: 'readonly',
    hazards: 'readonly',
    employees: 'readonly',
    students: 'readonly',
    student_absences: 'readonly',
    schools: 'readonly',
    calendar: 'readonly',
    vehicles: 'readonly',
    vehicle_inspections: 'readonly',
    yards: 'readonly',
    compliance: 'readonly',
    time_off: 'readonly',
    training: 'readonly',
    expenses: 'readonly',
    payroll: 'readwrite',   // Read/write payroll, other pages read-only
    biweekly_payroll: 'readwrite',
    payroll_dept_log: 'readwrite',
    roles: 'none',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  training: {
    dashboard: 'readonly',
    dispatch: 'readonly',
    charter: 'none',
    dispatch_payroll: 'none',
    dispatch_log: 'readonly',
    temporary_assignments: 'readonly',
    assignment_history: 'readonly',
    routes: 'readonly',
    staging_routes: 'readonly',
    route_assessments: 'readonly',
    defects: 'readonly',
    vehicle_signouts: 'none',
    student_incidents: 'readonly',
    hazards: 'readonly',
    employees: 'readonly',
    students: 'readonly',
    student_absences: 'readonly',
    schools: 'readonly',
    calendar: 'readonly',
    vehicles: 'readonly',
    vehicle_inspections: 'readonly',
    yards: 'readonly',
    compliance: 'readonly',
    time_off: 'readonly',
    training: 'readwrite',  // Read/write training & courses
    expenses: 'none',
    payroll: 'none',        // No access to payroll
    biweekly_payroll: 'none',
    payroll_dept_log: 'none',
    roles: 'none',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  driver: {
    dashboard: 'none',
    dispatch: 'readwrite',
    charter: 'readwrite',
    dispatch_payroll: 'none',
    dispatch_log: 'none',
    temporary_assignments: 'readonly',
    assignment_history: 'none',
    routes: 'readonly',
    staging_routes: 'none',
    route_assessments: 'readwrite',
    defects: 'readwrite',
    vehicle_signouts: 'readwrite',
    student_incidents: 'readwrite',
    hazards: 'readwrite',
    employees: 'none',
    students: 'readonly',
    student_absences: 'readonly',
    schools: 'readonly',
    calendar: 'readonly',
    vehicles: 'readonly',
    vehicle_inspections: 'readonly',
    yards: 'readonly',
    compliance: 'none',
    time_off: 'readwrite',
    training: 'readonly',
    expenses: 'readwrite',
    payroll: 'none',
    biweekly_payroll: 'none',
    payroll_dept_log: 'none',
    roles: 'none',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },

  helper: {
    dashboard: 'none',
    dispatch: 'readonly',
    charter: 'none',
    dispatch_payroll: 'none',
    dispatch_log: 'none',
    temporary_assignments: 'readonly',
    assignment_history: 'none',
    routes: 'readonly',
    staging_routes: 'none',
    route_assessments: 'none',
    defects: 'none',
    vehicle_signouts: 'none',
    student_incidents: 'readwrite',
    hazards: 'readwrite',
    employees: 'none',
    students: 'readonly',
    student_absences: 'readonly',
    schools: 'readonly',
    calendar: 'readonly',
    vehicles: 'none',
    vehicle_inspections: 'none',
    yards: 'readonly',
    compliance: 'none',
    time_off: 'readwrite',
    training: 'readonly',
    expenses: 'readwrite',
    payroll: 'none',
    biweekly_payroll: 'none',
    payroll_dept_log: 'none',
    roles: 'none',
    company_contacts: 'readonly',
    login_logs: 'none',
    audit_logs: 'none',
    settings: 'none',
    external_sync: 'none',
  },
};

/**
 * Live default permission matrix for all 12 roles.
 * Initialized from FACTORY_ROLE_PERMISSIONS and merged with localStorage/cloud customizations.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Record<NavTab, PermissionLevel>> = JSON.parse(
  JSON.stringify(FACTORY_ROLE_PERMISSIONS)
);

const LOCAL_STORAGE_KEY = 'dispatch_custom_role_permissions';

function loadStoredRolePermissions(): void {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        USER_ROLES.forEach((r) => {
          if (parsed[r] && typeof parsed[r] === 'object') {
            DEFAULT_ROLE_PERMISSIONS[r] = {
              ...DEFAULT_ROLE_PERMISSIONS[r],
              ...parsed[r]
            };
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not load custom role permissions from localStorage:', err);
  }
}

// Initial load from local storage
loadStoredRolePermissions();

type RolePermissionListener = () => void;
const rolePermissionListeners = new Set<RolePermissionListener>();

export function subscribeToRolePermissionChanges(listener: RolePermissionListener): () => void {
  rolePermissionListeners.add(listener);
  return () => {
    rolePermissionListeners.delete(listener);
  };
}

function notifyRolePermissionChanges(): void {
  rolePermissionListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

export function getRoleDefaultPermissions(role: UserRole): Record<NavTab, PermissionLevel> {
  const r = normalizeRole(role);
  return DEFAULT_ROLE_PERMISSIONS[r] || FACTORY_ROLE_PERMISSIONS[r];
}

export function isRoleDefaultCustomized(role: UserRole): boolean {
  const r = normalizeRole(role);
  const current = DEFAULT_ROLE_PERMISSIONS[r];
  const factory = FACTORY_ROLE_PERMISSIONS[r];
  if (!current || !factory) return false;
  return Object.keys(factory).some(
    (k) => current[k as NavTab] !== factory[k as NavTab]
  );
}

export function isPageDefaultModified(role: UserRole, pageId: NavTab): boolean {
  const r = normalizeRole(role);
  const current = DEFAULT_ROLE_PERMISSIONS[r]?.[pageId];
  const factory = FACTORY_ROLE_PERMISSIONS[r]?.[pageId];
  return current !== factory;
}

export function updateRoleDefaultPermissions(
  role: UserRole,
  permissions: Record<string, PermissionLevel>
): void {
  const r = normalizeRole(role);
  DEFAULT_ROLE_PERMISSIONS[r] = {
    ...DEFAULT_ROLE_PERMISSIONS[r],
    ...(permissions as Record<NavTab, PermissionLevel>)
  };

  try {
    const saved: Partial<Record<UserRole, Record<string, PermissionLevel>>> = {};
    USER_ROLES.forEach((ur) => {
      saved[ur] = DEFAULT_ROLE_PERMISSIONS[ur];
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saved));
  } catch (err) {
    console.warn('Could not save role permissions to localStorage:', err);
  }

  notifyRolePermissionChanges();
  syncRolePermissionsToCloud();
}

export function resetRoleDefaultPermissions(role: UserRole): void {
  const r = normalizeRole(role);
  DEFAULT_ROLE_PERMISSIONS[r] = {
    ...FACTORY_ROLE_PERMISSIONS[r]
  };

  try {
    const saved: Partial<Record<UserRole, Record<string, PermissionLevel>>> = {};
    USER_ROLES.forEach((ur) => {
      saved[ur] = DEFAULT_ROLE_PERMISSIONS[ur];
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saved));
  } catch (err) {
    console.warn('Could not reset role permissions in localStorage:', err);
  }

  notifyRolePermissionChanges();
  syncRolePermissionsToCloud();
}

export async function syncRolePermissionsToCloud(): Promise<void> {
  try {
    const { db } = await import('../services/firebase');
    if (!db) return;
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'system_config', 'role_permissions'),
      {
        permissions: DEFAULT_ROLE_PERMISSIONS,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Cloud sync of role permissions skipped:', err);
  }
}

export function initCloudRolePermissionsListener(): () => void {
  let unsub = () => {};
  import('../services/firebase').then(({ db }) => {
    if (!db) return;
    import('firebase/firestore').then(({ doc, onSnapshot }) => {
      unsub = onSnapshot(
        doc(db, 'system_config', 'role_permissions'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && data.permissions) {
              USER_ROLES.forEach((r) => {
                if (data.permissions[r]) {
                  DEFAULT_ROLE_PERMISSIONS[r] = {
                    ...DEFAULT_ROLE_PERMISSIONS[r],
                    ...data.permissions[r]
                  };
                }
              });
              notifyRolePermissionChanges();
            }
          }
        },
        (err) => {
          console.warn('Cloud role permissions listener notice:', err);
        }
      );
    });
  });
  return () => unsub();
}

/**
 * Resolves the effective permission for a given user and page.
 * Logic:
 * 1. Admin always has 'readwrite'.
 * 2. If user or employee has an explicit page override (e.g. employee.pagePermissions[pageId]), use it!
 * 3. Fallback to default permission for the user's role.
 */
export function getPagePermission(
  user: AuthUser | null | undefined,
  pageId: NavTab,
  customOverrides?: Record<string, PermissionLevel>
): PermissionLevel {
  if (!user) return 'none';

  const role = normalizeRole(user.role);
  if (role === 'admin') return 'readwrite';

  // Check specific override passed directly or from user record
  const overrides = customOverrides || user.overrides || (user as any).pagePermissions;
  if (overrides && overrides[pageId]) {
    const overrideVal = overrides[pageId];
    if (overrideVal === 'readwrite' || overrideVal === 'readonly' || overrideVal === 'none') {
      return overrideVal;
    }
  }

  // Fallback to role defaults
  const roleDefaults = getRoleDefaultPermissions(role);
  if (roleDefaults && roleDefaults[pageId]) {
    return roleDefaults[pageId];
  }
  if (pageId === 'biweekly_payroll') {
    return roleDefaults?.['payroll'] || 'none';
  }
  if (pageId === 'dispatch_payroll') {
    return roleDefaults?.['dispatch_payroll'] || (role === 'dispatcher' || role === 'payroll' ? 'readwrite' : 'none');
  }
  if (pageId === 'payroll_dept_log') {
    return roleDefaults?.['payroll_dept_log'] || (role === 'payroll' ? 'readwrite' : 'none');
  }
  if (pageId === 'student_absences') {
    return roleDefaults?.['students'] || roleDefaults?.['dispatch'] || (role === 'dispatcher' ? 'readwrite' : 'readonly');
  }
  if (pageId === 'vehicle_inspections') {
    return roleDefaults?.['vehicles'] || (role === 'fleet' ? 'readwrite' : 'readonly');
  }

  return 'none';
}

/**
 * Check whether a user has access to view a page (readonly or readwrite)
 */
export function hasPageAccess(
  user: AuthUser | null | undefined,
  pageId: NavTab,
  customOverrides?: Record<string, PermissionLevel>
): boolean {
  if (!user) return false;
  const perm = getPagePermission(user, pageId, customOverrides);
  return perm === 'readonly' || perm === 'readwrite';
}

/**
 * Check whether a user has full edit / write permissions on a page
 */
export function canEditPage(
  user: AuthUser | null | undefined,
  pageId: NavTab,
  customOverrides?: Record<string, PermissionLevel>
): boolean {
  if (!user) return false;
  const perm = getPagePermission(user, pageId, customOverrides);
  return perm === 'readwrite';
}

/**
 * For supervisor: checks if the current resource/yard matches supervisor's own yard
 */
export function canAccessYard(
  user: AuthUser | null | undefined,
  targetYardId?: string | null
): boolean {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (role === 'admin' || role === 'manager' || role === 'dispatcher') return true;
  if (role === 'supervisor') {
    if (!targetYardId || !user.yardId) return true; // allow if unassigned or general
    return targetYardId.toLowerCase() === user.yardId.toLowerCase();
  }
  return true;
}
