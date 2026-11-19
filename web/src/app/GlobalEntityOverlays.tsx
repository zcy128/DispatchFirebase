import React, { Suspense } from 'react';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { NavTab } from '../components/common/Sidebar';
import { RouteAssignModal } from '../components/routes/RouteAssignModal';
import { RouteDetailDrawer } from '../components/routes/RouteDetailDrawer';
import { SchoolBoardModal } from '../components/schools/SchoolBoardModal';
import { SchoolDetailDrawer } from '../components/schools/SchoolDetailDrawer';
import { SchoolModal } from '../components/schools/SchoolModal';
import { StudentDetailDrawer } from '../components/students/StudentDetailDrawer';
import { StudentModal, StudentModalTab } from '../components/students/StudentModal';
import { VehicleDetailDrawer } from '../components/vehicles/VehicleDetailDrawer';
import { VehicleModal } from '../components/vehicles/VehicleModal';
import { CreateParentChannelPayload } from '../types/chat';
import { Employee } from '../types/employee';
import { AssignRouteCrewPayload, BusRoute } from '../types/route';
import { School, SchoolBoard } from '../types/school';
import { Student } from '../types/student';
import { Vehicle } from '../types/vehicle';

const EmployeeDetailDrawer = lazyWithRetry(
  () =>
    import('../components/employees/EmployeeDetailDrawer').then((m) => ({
      default: m.EmployeeDetailDrawer,
    })),
  'EmployeeDetailDrawer'
);
const EmployeeModal = lazyWithRetry(
  () =>
    import('../components/employees/EmployeeModal').then((m) => ({
      default: m.EmployeeModal,
    })),
  'EmployeeModal'
);

export type EmployeeModalTab = 'profile' | 'permissions' | 'contact' | 'license' | 'emergency';

export interface GlobalEntityOverlaysProps {
  setCurrentTab: (tab: NavTab) => void;
  employees: Employee[];
  vehicles: Vehicle[];
  routes: BusRoute[];
  schools: School[];
  boards: SchoolBoard[];
  studentsMap: Record<string, Student>;

  selectedEmployee: Employee | null;
  closeEmployeeDrawer: () => void;
  handleEditEmployee: (emp: Employee, initialTab?: EmployeeModalTab) => void;
  handleDeleteEmployee: (id: string) => void;
  isEmployeeModalOpen: boolean;
  closeEmployeeModal: () => void;
  handleSaveEmployee: (data: Partial<Employee>) => Promise<void>;
  editingEmployee: Employee | null;
  employeeModalInitialTab: EmployeeModalTab;

  selectedStudent: Student | null;
  setSelectedStudent: (student: Student | null) => void;
  studentDrawerInitialTab: 'profile' | 'stops';
  handleEditStudent: (student: Student, initialTab?: StudentModalTab) => void;
  handleDeleteStudent: (student: Student) => void;
  handleOpenParentChat: (payload: CreateParentChannelPayload) => void;
  isStudentModalOpen: boolean;
  setIsStudentModalOpen: (open: boolean) => void;
  handleSaveStudent: (data: Partial<Student>) => Promise<void>;
  editingStudent: Student | null;
  studentModalInitialTab: StudentModalTab;

  selectedRoute: BusRoute | null;
  setSelectedRoute: (route: BusRoute | null) => void;
  openStudentDetails: (studentId: number, initialTab?: 'profile' | 'stops') => void;
  handleOpenAssignCrew: (route: BusRoute) => void;
  handleRouteUpdated: (updated: BusRoute) => void;
  isRouteAssignModalOpen: boolean;
  setIsRouteAssignModalOpen: (open: boolean) => void;
  assigningRoute: BusRoute | null;
  handleSaveRouteCrew: (routeId: string, payload: AssignRouteCrewPayload) => Promise<void>;

  selectedVehicle: Vehicle | null;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  handleEditVehicle: (veh: Vehicle) => void;
  handleDeleteVehicle: (veh: Vehicle) => void;
  isVehicleModalOpen: boolean;
  setIsVehicleModalOpen: (open: boolean) => void;
  handleSaveVehicle: (data: Partial<Vehicle>) => Promise<void>;
  editingVehicle: Vehicle | null;

  selectedSchool: School | null;
  setSelectedSchool: (school: School | null) => void;
  handleEditSchool: (school: School) => void;
  handleDeleteSchool: (school: School) => void;
  isSchoolModalOpen: boolean;
  setIsSchoolModalOpen: (open: boolean) => void;
  handleSaveSchool: (data: Partial<School>) => Promise<void>;
  editingSchool: School | null;

  isBoardModalOpen: boolean;
  setIsBoardModalOpen: (open: boolean) => void;
  handleSaveBoard: (data: Partial<SchoolBoard>) => Promise<void>;
  editingBoard: SchoolBoard | null;
}

/**
 * Global detail drawers and CRUD modals shared across Dispatch Console views.
 */
export const GlobalEntityOverlays: React.FC<GlobalEntityOverlaysProps> = (props) => {
  return (
    <>
      {props.selectedEmployee && (
        <Suspense fallback={null}>
          <EmployeeDetailDrawer
            employee={props.selectedEmployee}
            onClose={props.closeEmployeeDrawer}
            onEdit={props.handleEditEmployee}
            onDelete={props.handleDeleteEmployee}
          />
        </Suspense>
      )}

      <StudentDetailDrawer
        student={props.selectedStudent}
        school={
          props.selectedStudent
            ? props.schools.find((s) => s.schoolId === props.selectedStudent?.schoolId)
            : null
        }
        initialTab={props.studentDrawerInitialTab}
        onClose={() => props.setSelectedStudent(null)}
        onEdit={props.handleEditStudent}
        onDelete={props.handleDeleteStudent}
        onMessageParent={props.handleOpenParentChat}
      />

      <RouteDetailDrawer
        route={props.selectedRoute}
        studentsMap={props.studentsMap}
        onClose={() => props.setSelectedRoute(null)}
        onSelectStudent={(stu) => props.setSelectedStudent(stu)}
        onSelectStudentId={props.openStudentDetails}
        onAssignCrew={props.handleOpenAssignCrew}
        onRouteUpdated={props.handleRouteUpdated}
      />

      <VehicleDetailDrawer
        vehicle={props.selectedVehicle}
        onClose={() => props.setSelectedVehicle(null)}
        onEdit={props.handleEditVehicle}
        onDelete={props.handleDeleteVehicle}
        onSelectRoute={(routeNo) => {
          const rt = props.routes.find((r) => r.routeNo === routeNo);
          if (rt) {
            props.setSelectedRoute(rt);
          }
          props.setSelectedVehicle(null);
          props.setCurrentTab('routes');
        }}
      />

      {props.isEmployeeModalOpen && (
        <Suspense fallback={null}>
          <EmployeeModal
            isOpen
            onClose={props.closeEmployeeModal}
            onSave={props.handleSaveEmployee}
            initialData={props.editingEmployee}
            initialTab={props.employeeModalInitialTab}
          />
        </Suspense>
      )}

      <VehicleModal
        isOpen={props.isVehicleModalOpen}
        onClose={() => props.setIsVehicleModalOpen(false)}
        onSave={props.handleSaveVehicle}
        initialData={props.editingVehicle}
        employees={props.employees}
        vehicles={props.vehicles}
      />

      {props.isRouteAssignModalOpen && props.assigningRoute && (
        <RouteAssignModal
          isOpen
          onClose={() => props.setIsRouteAssignModalOpen(false)}
          route={props.assigningRoute}
          employees={props.employees}
          vehicles={props.vehicles}
          allRoutes={props.routes}
          onSave={props.handleSaveRouteCrew}
        />
      )}

      <SchoolDetailDrawer
        school={props.selectedSchool}
        onClose={() => props.setSelectedSchool(null)}
        onEdit={props.handleEditSchool}
        onDelete={props.handleDeleteSchool}
        onViewStudents={() => {
          props.setSelectedSchool(null);
          props.setCurrentTab('students');
        }}
      />

      <SchoolModal
        isOpen={props.isSchoolModalOpen}
        onClose={() => props.setIsSchoolModalOpen(false)}
        onSave={props.handleSaveSchool}
        initialData={props.editingSchool}
        boards={props.boards}
      />

      <SchoolBoardModal
        isOpen={props.isBoardModalOpen}
        onClose={() => props.setIsBoardModalOpen(false)}
        onSave={props.handleSaveBoard}
        initialData={props.editingBoard}
      />

      <ErrorBoundary fallbackTitle="Student Modal Error">
        <StudentModal
          isOpen={props.isStudentModalOpen}
          onClose={() => props.setIsStudentModalOpen(false)}
          onSave={props.handleSaveStudent}
          initialData={props.editingStudent}
          schools={props.schools}
          initialTab={props.studentModalInitialTab}
        />
      </ErrorBoundary>
    </>
  );
};
