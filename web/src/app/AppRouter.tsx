import React, { Suspense } from 'react';
import { NavTab } from '../components/common/Sidebar';
import { StudentModalTab } from '../components/students/StudentModal';
import { calculateSchoolStats } from '../services/schoolService';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { CompanyContact } from '../services/companyContactsService';
import { SchoolCalendar } from '../types/calendar';
import { CreateParentChannelPayload } from '../types/chat';
import { DashboardStats, Employee, UserRole } from '../types/employee';
import { BusRoutePayrollRate, SchoolBoardBaseRatesDTO } from '../types/payroll';
import { BusRoute, RouteStats } from '../types/route';
import { School, SchoolBoard } from '../types/school';
import { Student, StudentStats } from '../types/student';
import { Vehicle, VehicleStats } from '../types/vehicle';
import { Yard } from '../types/yard';
import { AssignmentTrackingView } from '../views/AssignmentTrackingView';
import { ComplianceView } from '../views/ComplianceView';
import { DashboardView } from '../views/DashboardView';
import { DefectReportsView } from '../views/DefectReportsView';
import { ExpenseReimbursementsView } from '../views/ExpenseReimbursementsView';
import { ExternalSyncView } from '../views/ExternalSyncView';
import { HazardReportsView } from '../views/HazardReportsView';
import { PreTripInspectionsView } from '../views/PreTripInspectionsView';
import { RouteAssessmentsView } from '../views/RouteAssessmentsView';
import { StudentAbsencesView } from '../views/StudentAbsencesView';
import { StudentIncidentsView } from '../views/StudentIncidentsView';
import { StudentListView } from '../views/StudentListView';
import { TrainingView } from '../views/TrainingView';
import { VehicleListView } from '../views/VehicleListView';
import { VehicleSignoutView } from '../views/VehicleSignoutView';
import { YardListView } from '../views/YardListView';

const SchoolListView = lazyWithRetry(
  () => import('../views/SchoolListView').then((m) => ({ default: m.SchoolListView })),
  'SchoolListView'
);
const SchoolCalendarView = lazyWithRetry(
  () => import('../views/SchoolCalendarView').then((m) => ({ default: m.SchoolCalendarView })),
  'SchoolCalendarView'
);
const PayrollRateView = lazyWithRetry(
  () => import('../views/PayrollRateView').then((m) => ({ default: m.PayrollRateView })),
  'PayrollRateView'
);
const BiweeklyPayrollView = lazyWithRetry(
  () => import('../views/BiweeklyPayrollView').then((m) => ({ default: m.BiweeklyPayrollView })),
  'BiweeklyPayrollView'
);
const PayrollDepartmentLogView = lazyWithRetry(
  () => import('../views/PayrollDepartmentLogView').then((m) => ({ default: m.PayrollDepartmentLogView })),
  'PayrollDepartmentLogView'
);
const RoleManagementView = lazyWithRetry(
  () => import('../views/RoleManagementView').then((m) => ({ default: m.RoleManagementView })),
  'RoleManagementView'
);
const CompanyContactsView = lazyWithRetry(
  () => import('../views/CompanyContactsView').then((m) => ({ default: m.CompanyContactsView })),
  'CompanyContactsView'
);
const LoginLogsView = lazyWithRetry(
  () => import('../views/LoginLogsView').then((m) => ({ default: m.LoginLogsView })),
  'LoginLogsView'
);
const AuditLogsView = lazyWithRetry(
  () => import('../views/AuditLogsView').then((m) => ({ default: m.AuditLogsView })),
  'AuditLogsView'
);
const ErrorLogsView = lazyWithRetry(
  () => import('../views/ErrorLogsView').then((m) => ({ default: m.ErrorLogsView })),
  'ErrorLogsView'
);
const SettingsView = lazyWithRetry(
  () => import('../views/SettingsView').then((m) => ({ default: m.SettingsView })),
  'SettingsView'
);
const DispatchWorkbenchView = lazyWithRetry(
  () => import('../views/DispatchWorkbenchView').then((m) => ({ default: m.DispatchWorkbenchView })),
  'DispatchWorkbenchView'
);
const RouteListView = lazyWithRetry(
  () => import('../views/RouteListView').then((m) => ({ default: m.RouteListView })),
  'RouteListView'
);
const StagingRouteListView = lazyWithRetry(
  () => import('../views/StagingRouteListView').then((m) => ({ default: m.StagingRouteListView })),
  'StagingRouteListView'
);
const DispatchDailyPayrollTab = lazyWithRetry(
  () => import('../components/payroll/DispatchDailyPayrollTab').then((m) => ({ default: m.DispatchDailyPayrollTab })),
  'DispatchDailyPayrollTab'
);
const CharterManagementView = lazyWithRetry(
  () => import('../views/CharterManagementView').then((m) => ({ default: m.CharterManagementView })),
  'CharterManagementView'
);
const EmployeeListView = lazyWithRetry(
  () => import('../views/EmployeeListView').then((m) => ({ default: m.EmployeeListView })),
  'EmployeeListView'
);
const TimeOffView = lazyWithRetry(
  () => import('../views/TimeOffView').then((m) => ({ default: m.TimeOffView })),
  'TimeOffView'
);
const VehicleInspectionsView = lazyWithRetry(
  () => import('../views/VehicleInspectionsView').then((m) => ({ default: m.VehicleInspectionsView })),
  'VehicleInspectionsView'
);
const DispatchChangeLogView = lazyWithRetry(
  () => import('../views/DispatchChangeLogView').then((m) => ({ default: m.DispatchChangeLogView })),
  'DispatchChangeLogView'
);
const TemporaryAssignmentsView = lazyWithRetry(
  () => import('../views/TemporaryAssignmentsView').then((m) => ({ default: m.TemporaryAssignmentsView })),
  'TemporaryAssignmentsView'
);

export interface AppRouterProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  navigateToTab: (tab: NavTab) => void;
  dataLoading: boolean;
  stats: DashboardStats;
  employees: Employee[];
  schools: School[];
  boards: SchoolBoard[];
  schoolStats: ReturnType<typeof calculateSchoolStats>;
  calendarSelectedSchoolId: number | null;
  setCalendarSelectedSchoolId: (id: number | null) => void;
  schoolCalendars: SchoolCalendar[];
  students: Student[];
  studentStats: StudentStats;
  studentsMap: Record<string, Student>;
  routes: BusRoute[];
  routeStats: RouteStats;
  vehicles: Vehicle[];
  vehicleStats: VehicleStats;
  vehicleSyncSource: 'firestore' | 'api';
  yards: Yard[];
  dispatchLogDate: string;
  payrollBoardRates: SchoolBoardBaseRatesDTO[];
  setPayrollBoardRates: React.Dispatch<React.SetStateAction<SchoolBoardBaseRatesDTO[]>>;
  payrollRates: BusRoutePayrollRate[];
  companyContacts: CompanyContact[];
  onSelectEmployee: (emp: Employee) => void;
  onEditEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onCreateEmployee: () => void;
  onManualSync: () => void;
  onQuickReassignRole: (employeeId: string, newRole: UserRole) => Promise<void>;
  onSelectSchool: (school: School) => void;
  onEditSchool: (school: School) => void;
  onCreateSchool: () => void;
  onEditBoard: (board: SchoolBoard) => void;
  onCreateBoard: () => void;
  onSchoolRefresh: () => void;
  onSelectStudent: (student: Student) => void;
  onEditStudent: (student: Student, tab?: StudentModalTab) => void;
  onEditStudentById: (studentId: number, initialTab?: StudentModalTab) => void;
  onCreateStudent: () => void;
  onDeleteStudent: (student: Student) => void;
  onStudentRefresh: () => void;
  onStudentsLoaded: (loaded: Student[]) => void;
  onOpenParentChat: (payload: CreateParentChannelPayload) => void;
  onSelectRoute: (route: BusRoute) => void;
  onOpenAssignCrew: (route: BusRoute) => void;
  onRouteRefresh: () => void;
  onRouteUpdated: (updated: BusRoute) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onCreateVehicle: () => void;
  onDeleteVehicle: (vehicle: Vehicle) => void;
  onVehicleRefresh: () => void;
  onYardRefresh: () => void;
  openSchoolDetails: (schoolId?: number, schoolName?: string) => void;
  openStudentDetails: (studentId: number, initialTab?: 'profile' | 'stops') => void;
  openStudentDetailsByRef: (ref: { id?: string; name?: string; initialTab?: 'profile' | 'stops' }) => void;
  openEmployeeDetails: (employeeId?: string, employeeName?: string) => void;
  openVehicleDetails: (vehicleId?: number, unitNumber?: string) => void;
  openDispatchChangeLog: (date?: string) => void;
  openTemporaryAssignments: () => void;
  openStudentAbsences: () => void;
  openDispatchPayroll: () => void;
  openPayrollFinanceLog: () => void;
  messageDriverFromDispatch: (driverId: string, driverName?: string) => void;
}

/**
 * Central view router for all Dispatch Console tabs inside the main content area.
 */
export const AppRouter: React.FC<AppRouterProps> = (props) => {
  const { currentTab, setCurrentTab, navigateToTab } = props;

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading...</div>}>
      {currentTab === 'dashboard' && (
        <DashboardView
          stats={props.stats}
          employees={props.employees}
          routes={props.routes}
          onNavigateTab={navigateToTab}
          onSelectEmployee={props.onSelectEmployee}
        />
      )}

      {currentTab === 'employees' && (
        <EmployeeListView
          employees={props.employees}
          loading={props.dataLoading}
          onSelectEmployee={props.onSelectEmployee}
          onEditEmployee={props.onEditEmployee}
          onDeleteEmployee={props.onDeleteEmployee}
          onOpenCreate={props.onCreateEmployee}
          onRefresh={props.onManualSync}
          refreshing={props.dataLoading}
        />
      )}

      {currentTab === 'schools' && (
        <SchoolListView
          schools={props.schools}
          boards={props.boards}
          stats={props.schoolStats}
          loading={props.dataLoading}
          onRefresh={props.onSchoolRefresh}
          onSelectSchool={props.onSelectSchool}
          onEditSchool={props.onEditSchool}
          onCreateSchool={props.onCreateSchool}
          onEditBoard={props.onEditBoard}
          onCreateBoard={props.onCreateBoard}
          onViewSchoolStudents={() => setCurrentTab('students')}
          onViewSchoolCalendar={(school) => {
            props.setCalendarSelectedSchoolId(school.schoolId);
            setCurrentTab('calendar');
          }}
        />
      )}

      {currentTab === 'calendar' && (
        <SchoolCalendarView
          schools={props.schools}
          boards={props.boards}
          selectedSchoolId={props.calendarSelectedSchoolId}
          onSelectSchool={(school) => {
            props.setCalendarSelectedSchoolId(school ? school.schoolId : null);
          }}
          cachedCalendars={props.schoolCalendars}
        />
      )}

      {currentTab === 'students' && (
        <StudentListView
          students={props.students}
          schools={props.schools}
          stats={props.studentStats}
          loading={props.dataLoading}
          onSelectStudent={props.onSelectStudent}
          onSelectSchool={props.openSchoolDetails}
          onEditStudent={props.onEditStudent}
          onViewStudentStops={(student) => props.onEditStudent(student, 'stops')}
          onCreateStudent={props.onCreateStudent}
          onDeleteStudent={props.onDeleteStudent}
          onRefresh={props.onStudentRefresh}
          onMessageParent={props.onOpenParentChat}
          onStudentsLoaded={props.onStudentsLoaded}
        />
      )}

      {currentTab === 'student_absences' && (
        <StudentAbsencesView
          studentsMap={props.studentsMap}
          onSelectStudent={props.openStudentDetailsByRef}
          onSelectSchool={props.openSchoolDetails}
        />
      )}

      {currentTab === 'dispatch' && (
        <DispatchWorkbenchView
          employees={props.employees}
          vehicles={props.vehicles}
          yards={props.yards}
          studentsMap={props.studentsMap}
          onSelectStudent={props.openStudentDetails}
          onSelectEmployee={props.openEmployeeDetails}
          onSelectVehicle={props.openVehicleDetails}
          onNavigateToChangeLog={props.openDispatchChangeLog}
          onNavigateToTemporaryAssignments={props.openTemporaryAssignments}
          onNavigateToAbsences={props.openStudentAbsences}
          onMessageDriver={props.messageDriverFromDispatch}
        />
      )}

      {currentTab === 'charter' && (
        <CharterManagementView
          employees={props.employees}
          vehicles={props.vehicles}
          schools={props.schools}
          onNavigateToPayroll={props.openDispatchPayroll}
          onSelectEmployee={props.openEmployeeDetails}
          onSelectVehicle={props.openVehicleDetails}
        />
      )}

      {currentTab === 'dispatch_payroll' && (
        <div className="p-3 md:p-4 w-full">
          <DispatchDailyPayrollTab
            onNavigateToFinanceLog={props.openPayrollFinanceLog}
            onSelectEmployee={props.openEmployeeDetails}
          />
        </div>
      )}

      {currentTab === 'dispatch_log' && (
        <DispatchChangeLogView
          key={props.dispatchLogDate}
          initialDate={props.dispatchLogDate}
          onNavigateToDispatch={() => setCurrentTab('dispatch')}
        />
      )}

      {currentTab === 'temporary_assignments' && (
        <TemporaryAssignmentsView
          routes={props.routes}
          employees={props.employees}
          vehicles={props.vehicles}
        />
      )}

      {currentTab === 'assignment_history' && <AssignmentTrackingView />}

      {currentTab === 'time_off' && (
        <TimeOffView
          employees={props.employees}
          routes={props.routes}
          vehicles={props.vehicles}
          onNavigateToTemporaryAssignments={props.openTemporaryAssignments}
          onSelectEmployee={props.openEmployeeDetails}
        />
      )}

      {currentTab === 'training' && <TrainingView employees={props.employees} />}

      {currentTab === 'defects' && (
        <DefectReportsView
          onSelectEmployee={props.openEmployeeDetails}
          onSelectVehicle={props.openVehicleDetails}
        />
      )}

      {currentTab === 'student_incidents' && (
        <StudentIncidentsView
          onSelectStudent={props.openStudentDetailsByRef}
          onSelectSchool={props.openSchoolDetails}
        />
      )}

      {currentTab === 'expenses' && (
        <ExpenseReimbursementsView
          employees={props.employees}
          onSelectEmployee={props.openEmployeeDetails}
        />
      )}

      {currentTab === 'hazards' && (
        <HazardReportsView onSelectEmployee={props.openEmployeeDetails} />
      )}

      {currentTab === 'route_assessments' && <RouteAssessmentsView />}

      {currentTab === 'vehicle_signouts' && (
        <VehicleSignoutView
          onSelectEmployee={props.openEmployeeDetails}
          onSelectVehicle={props.openVehicleDetails}
        />
      )}

      {currentTab === 'staging_routes' && (
        <StagingRouteListView onSelectStudent={props.openStudentDetailsByRef} />
      )}

      {currentTab === 'routes' && (
        <RouteListView
          routes={props.routes}
          stats={props.routeStats}
          studentsMap={props.studentsMap}
          schools={props.schools}
          yards={props.yards}
          employees={props.employees}
          vehicles={props.vehicles}
          loading={props.dataLoading}
          onSelectRoute={props.onSelectRoute}
          onSelectStudent={props.onSelectStudent}
          onSelectStudentId={props.openStudentDetails}
          onEditStudentStops={(studentId) => props.onEditStudentById(studentId, 'stops')}
          onSelectEmployee={props.openEmployeeDetails}
          onSelectVehicle={props.openVehicleDetails}
          onAssignCrew={props.onOpenAssignCrew}
          onRefresh={props.onRouteRefresh}
          onRouteUpdated={props.onRouteUpdated}
        />
      )}

      {currentTab === 'vehicles' && (
        <VehicleListView
          vehicles={props.vehicles}
          stats={props.vehicleStats}
          loading={props.dataLoading}
          onSelectVehicle={props.onSelectVehicle}
          onEditVehicle={props.onEditVehicle}
          onCreateVehicle={props.onCreateVehicle}
          onDeleteVehicle={props.onDeleteVehicle}
          syncSource={props.vehicleSyncSource}
          onSelectRoute={(routeNo) => {
            const rt = props.routes.find((r) => r.routeNo === routeNo);
            if (rt) {
              props.onSelectRoute(rt);
            }
            setCurrentTab('routes');
          }}
          onRefresh={props.onVehicleRefresh}
        />
      )}

      {currentTab === 'pretrip_checks' && (
        <PreTripInspectionsView
          onSelectEmployee={props.openEmployeeDetails}
          onSelectVehicle={props.openVehicleDetails}
        />
      )}

      {currentTab === 'vehicle_inspections' && (
        <VehicleInspectionsView
          vehicles={props.vehicles}
          onSelectVehicle={props.onSelectVehicle}
        />
      )}

      {currentTab === 'compliance' && (
        <ComplianceView
          employees={props.employees}
          vehicles={props.vehicles}
          onSelectEmployee={props.onSelectEmployee}
          onSelectVehicle={props.onSelectVehicle}
          onBack={() => setCurrentTab('dashboard')}
        />
      )}

      {currentTab === 'payroll' && (
        <PayrollRateView
          initialBoardRates={props.payrollBoardRates}
          cachedRates={props.payrollRates}
          boards={props.boards}
          routes={props.routes}
          employees={props.employees}
          onBoardRatesChange={props.setPayrollBoardRates}
          onSelectEmployee={props.openEmployeeDetails}
        />
      )}

      {currentTab === 'biweekly_payroll' && (
        <BiweeklyPayrollView
          boards={props.boards}
          employees={props.employees}
          routes={props.routes}
          onSelectEmployee={props.openEmployeeDetails}
        />
      )}

      {currentTab === 'payroll_dept_log' && (
        <PayrollDepartmentLogView onSelectEmployee={props.openEmployeeDetails} />
      )}

      {currentTab === 'yards' && (
        <YardListView
          yards={props.yards}
          routes={props.routes}
          schools={props.schools}
          employees={props.employees}
          loading={props.dataLoading}
          onRefresh={props.onYardRefresh}
          onRoutesUpdate={props.onRouteRefresh}
          onSchoolsUpdate={props.onSchoolRefresh}
          onYardsUpdate={props.onYardRefresh}
        />
      )}

      {currentTab === 'roles' && (
        <RoleManagementView
          employees={props.employees}
          loading={props.dataLoading}
          onSelectEmployee={props.onSelectEmployee}
          onEditEmployee={props.onEditEmployee}
          onQuickReassignRole={props.onQuickReassignRole}
          onRefresh={props.onManualSync}
          refreshing={props.dataLoading}
        />
      )}

      {currentTab === 'company_contacts' && <CompanyContactsView contacts={props.companyContacts} />}
      {currentTab === 'login_logs' && <LoginLogsView />}
      {currentTab === 'audit_logs' && <AuditLogsView />}
      {currentTab === 'error_logs' && <ErrorLogsView />}
      {currentTab === 'external_sync' && <ExternalSyncView />}
      {currentTab === 'settings' && <SettingsView />}
    </Suspense>
  );
};
