import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Header } from './components/common/Header';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { DashboardView } from './views/DashboardView';
import { StudentListView } from './views/StudentListView';
import { VehicleListView } from './views/VehicleListView';
import { ComplianceView } from './views/ComplianceView';
import { ExternalSyncView } from './views/ExternalSyncView';
import { LoginView } from './views/LoginView';
import { StudentDetailDrawer } from './components/students/StudentDetailDrawer';
import { StudentModal, StudentModalTab } from './components/students/StudentModal';
import { RouteDetailDrawer } from './components/routes/RouteDetailDrawer';
import { VehicleDetailDrawer } from './components/vehicles/VehicleDetailDrawer';
import { VehicleModal } from './components/vehicles/VehicleModal';
const SchoolListView = React.lazy(() => import('./views/SchoolListView').then((m) => ({ default: m.SchoolListView })));
const SchoolCalendarView = React.lazy(() => import('./views/SchoolCalendarView').then((m) => ({ default: m.SchoolCalendarView })));
const PayrollRateView = React.lazy(() => import('./views/PayrollRateView').then((m) => ({ default: m.PayrollRateView })));
const BiweeklyPayrollView = React.lazy(() => import('./views/BiweeklyPayrollView').then((m) => ({ default: m.BiweeklyPayrollView })));
const PayrollDepartmentLogView = React.lazy(() => import('./views/PayrollDepartmentLogView').then((m) => ({ default: m.PayrollDepartmentLogView })));
const RoleManagementView = React.lazy(() => import('./views/RoleManagementView').then((m) => ({ default: m.RoleManagementView })));
const CompanyContactsView = React.lazy(() => import('./views/CompanyContactsView').then((m) => ({ default: m.CompanyContactsView })));
const LoginLogsView = React.lazy(() => import('./views/LoginLogsView').then((m) => ({ default: m.LoginLogsView })));
const AuditLogsView = React.lazy(() => import('./views/AuditLogsView').then((m) => ({ default: m.AuditLogsView })));
const ErrorLogsView = React.lazy(() => import('./views/ErrorLogsView').then((m) => ({ default: m.ErrorLogsView })));
const SettingsView = React.lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const DispatchWorkbenchView = React.lazy(() => import('./views/DispatchWorkbenchView').then((m) => ({ default: m.DispatchWorkbenchView })));
const RouteListView = React.lazy(() => import('./views/RouteListView').then((m) => ({ default: m.RouteListView })));
const StagingRouteListView = React.lazy(() => import('./views/StagingRouteListView').then((m) => ({ default: m.StagingRouteListView })));
const DispatchDailyPayrollTab = React.lazy(() => import('./components/payroll/DispatchDailyPayrollTab').then((m) => ({ default: m.DispatchDailyPayrollTab })));
const CharterManagementView = React.lazy(() => import('./views/CharterManagementView').then((m) => ({ default: m.CharterManagementView })));
const EmployeeListView = React.lazy(() => import('./views/EmployeeListView').then((m) => ({ default: m.EmployeeListView })));
const EmployeeDetailDrawer = React.lazy(() => import('./components/employees/EmployeeDetailDrawer').then((m) => ({ default: m.EmployeeDetailDrawer })));
const EmployeeModal = React.lazy(() => import('./components/employees/EmployeeModal').then((m) => ({ default: m.EmployeeModal })));
const TimeOffView = React.lazy(() => import('./views/TimeOffView').then((m) => ({ default: m.TimeOffView })));
const VehicleInspectionsView = React.lazy(() => import('./views/VehicleInspectionsView').then((m) => ({ default: m.VehicleInspectionsView })));
const AICopilotDrawer = React.lazy(() => import('./components/ai/AICopilotDrawer').then((m) => ({ default: m.AICopilotDrawer })));
import { SchoolDetailDrawer } from './components/schools/SchoolDetailDrawer';
import { SchoolModal } from './components/schools/SchoolModal';
import { SchoolBoardModal } from './components/schools/SchoolBoardModal';
import { RouteAssignModal } from './components/routes/RouteAssignModal';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { EmployeeService, calculateStats } from './services/employeeService';
import { StudentService, calculateStudentStats } from './services/studentService';
import { SchoolService, calculateSchoolStats } from './services/schoolService';
import { RouteService, calculateRouteStats } from './services/routeService';
import { VehicleService, calculateVehicleStats } from './services/vehicleService';
import { Employee, DashboardStats, UserRole } from './types/employee';
import { Student, StudentStats } from './types/student';
import { School, SchoolBoard } from './types/school';
import { AssignRouteCrewPayload, BusRoute, RouteStats } from './types/route';
import { Vehicle, VehicleStats } from './types/vehicle';
import { Yard } from './types/yard';
import { YardListView } from './views/YardListView';
import { hasPageAccess, initCloudRolePermissionsListener } from './utils/permissions';
import { YardService } from './services/yardService';
import { CalendarService } from './services/calendarService';
import { SchoolCalendar } from './types/calendar';
import { PayrollService } from './services/payrollService';
import { BusRoutePayrollRate, SchoolBoardBaseRatesDTO } from './types/payroll';
import { CompanyContact, CompanyContactsService } from './services/companyContactsService';
const DispatchChangeLogView = React.lazy(() =>
  import('./views/DispatchChangeLogView').then((m) => ({ default: m.DispatchChangeLogView }))
);
const TemporaryAssignmentsView = React.lazy(() =>
  import('./views/TemporaryAssignmentsView').then((m) => ({ default: m.TemporaryAssignmentsView }))
);
import { AssignmentTrackingView } from './views/AssignmentTrackingView';
import { TrainingView } from './views/TrainingView';
import { DefectReportsView } from './views/DefectReportsView';
import { StudentIncidentsView } from './views/StudentIncidentsView';
import { StudentAbsencesView } from './views/StudentAbsencesView';
import { ExpenseReimbursementsView } from './views/ExpenseReimbursementsView';
import { HazardReportsView } from './views/HazardReportsView';
import { RouteAssessmentsView } from './views/RouteAssessmentsView';
import { VehicleSignoutView } from './views/VehicleSignoutView';
import { PreTripInspectionsView } from './views/PreTripInspectionsView';
import { BottomNav } from './components/common/BottomNav';
import { MobileDrawer } from './components/common/MobileDrawer';
import { getLocalTodayString } from './utils/dateUtils';
import { EntityOperationLogService } from './services/entityOperationLogService';
import { EntityOperationActor, EntityFieldDiff } from './types/entityOperationLog';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { useChatNotifications } from './hooks/useChatNotifications';
import { MessageSquare, X, ArrowRight } from 'lucide-react';
import { CreateParentChannelPayload } from './types/chat';

export const AppContent: React.FC = () => {
  const { currentUser, loading: authLoading, updateCurrentUser } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const mainRef = useRef<HTMLElement>(null);
  const [dispatchLogDate, setDispatchLogDate] = useState<string>(() => getLocalTodayString());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('pcy_sidebar_collapsed') === '1';
    }
    return false;
  });
  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('pcy_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // Ignore localStorage quota or private browsing errors
      }
      return next;
    });
  }, []);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'ai' || params.get('ai') === '1';
    }
    return false;
  });
  const [aiCopilotMounted, setAiCopilotMounted] = useState<boolean>(isAICopilotOpen);
  const [chatInitialTargetUserId, setChatInitialTargetUserId] = useState<string | null>(null);
  const [chatInitialParent, setChatInitialParent] = useState<CreateParentChannelPayload | null>(null);

  const handleOpenParentChat = (payload: CreateParentChannelPayload) => {
    setChatInitialParent(payload);
    setIsChatOpen(true);
  };

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [currentTab]);

  useEffect(() => {
    void import('./services/clientErrorReporter').then(({ setClientErrorPage }) => {
      setClientErrorPage(currentTab);
    });
  }, [currentTab]);

  // Global shortcuts: Ctrl+J / Cmd+J to toggle AI Copilot, Ctrl+B / Cmd+B to toggle sidebar icon rail
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAiCopilotMounted(true);
        setIsAICopilotOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebarCollapse]);

  const currentUserId = currentUser?.employeeId || currentUser?.uid || '';
  const { unreadCount, activeAlert, clearUnread, dismissAlert } = useChatNotifications(
    currentUserId,
    isChatOpen,
    null,
    () => {
      setIsChatOpen(true);
      clearUnread();
    }
  );

  const [employees, setEmployees] = useState<Employee[]>([]);
  const employeesRef = useRef(employees);
  employeesRef.current = employees;
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    totalDrivers: 0,
    licenseExpiringSoon: 0,
    yardDistribution: {},
    timestamp: new Date().toISOString()
  });
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  // Student and School states
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [boards, setBoards] = useState<SchoolBoard[]>([]);
  const schoolStats = useMemo(() => calculateSchoolStats(schools, boards), [schools, boards]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState<boolean>(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isBoardModalOpen, setIsBoardModalOpen] = useState<boolean>(false);
  const [editingBoard, setEditingBoard] = useState<SchoolBoard | null>(null);
  const [calendarSelectedSchoolId, setCalendarSelectedSchoolId] = useState<number | null>(null);

  const [studentStats, setStudentStats] = useState<StudentStats>({
    totalStudents: 0,
    activeStudents: 0,
    metAtBusCount: 0,
    routesCovered: 0,
    gradeDistribution: {},
    schoolDistribution: {}
  });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentModalInitialTab, setStudentModalInitialTab] = useState<StudentModalTab>('profile');

  // Route states
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [routeStats, setRouteStats] = useState<RouteStats>({
    totalRoutes: 0,
    activeRoutes: 0,
    assignedDrivers: 0,
    totalStops: 0,
    totalStudents: 0
  });
  const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);

  // Vehicle states
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats>({
    totalVehicles: 0,
    activeVehicles: 0,
    assignedToRoutes: 0,
    spareVehicles: 0,
    wheelchairAccessible: 0,
    typeDistribution: {},
    fuelDistribution: {},
    yardDistribution: {}
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleSyncSource, setVehicleSyncSource] = useState<'firestore' | 'api'>('api');

  // Dynamic Single Source of Truth lookup map for Student Contacts
  const studentsMap = React.useMemo(() => {
    const map: Record<number, Student> = {};
    for (const s of students) {
      map[s.studentId] = s;
    }
    return map;
  }, [students]);

  const studentsRef = useRef(students);
  studentsRef.current = students;
  const schoolsRef = useRef(schools);
  schoolsRef.current = schools;
  const studentDetailRequest = useRef(0);
  const employeeDetailRequest = useRef(0);
  const vehicleDetailRequest = useRef(0);
  const openStudentDetailsByRef = useCallback((ref: { id?: string; name?: string }) => {
    const id = ref.id?.trim() || '';
    const name = ref.name?.trim() || '';
    const nameLower = name.toLowerCase();
    if (!id && !name) return;

    const studentFullName = (student: Student) =>
      (student.fullName || student.studentName || `${student.firstName} ${student.lastName}`).trim();

    const matchStudent = (student: Student) => {
      if (id) {
        if (
          student.studentNo === id ||
          student.id === id ||
          String(student.studentId) === id
        ) {
          return true;
        }
      }
      if (!nameLower) return false;
      return studentFullName(student).toLowerCase() === nameLower;
    };

    // Same approach as Dispatch: prefer in-memory/master match first.
    const cached =
      studentsRef.current.find(matchStudent) ||
      (nameLower
        ? studentsRef.current.find((student) =>
            studentFullName(student).toLowerCase().includes(nameLower),
          )
        : undefined);
    if (cached) {
      setSelectedStudent(cached);
      return;
    }

    const numericId = Number(id);
    const hasNumericId = Number.isFinite(numericId) && numericId > 0 && String(numericId) === id;

    const buildStub = (): Student => {
      const parts = name.split(/\s+/).filter(Boolean);
      const firstName = parts[0] || id || 'Unknown';
      const lastName = parts.slice(1).join(' ');
      return {
        id: id || `lookup-${nameLower || 'student'}`,
        studentId: hasNumericId ? numericId : 0,
        studentNo: id || 'N/A',
        firstName,
        lastName,
        studentName: name || id,
        fullName: name || id,
        studentAddress: '',
        grade: '',
        active: true,
        metatBus: false,
        schoolId: 0,
        schoolName: '',
      };
    };

    const requestId = ++studentDetailRequest.current;
    const finish = (student: Student) => {
      if (studentDetailRequest.current !== requestId) return;
      setStudents((prev) =>
        student.studentId > 0 && prev.some((item) => item.studentId === student.studentId)
          ? prev
          : [...prev.filter((item) => item.id !== student.id), student],
      );
      setSelectedStudent(student);
    };

    const searchThenMaybeId = () => {
      const query = name || id;
      void StudentService.search(query)
        .then((list) => {
          if (studentDetailRequest.current !== requestId) return;
          const match =
            list.find(matchStudent) ||
            (nameLower
              ? list.find((student) => studentFullName(student).toLowerCase() === nameLower)
              : undefined);
          if (match) {
            finish(match);
            return;
          }
          if (hasNumericId) {
            void StudentService.getByStudentId(numericId)
              .then((stu) => finish(stu))
              .catch(() => finish(buildStub()));
            return;
          }
          finish(buildStub());
        })
        .catch(() => {
          if (hasNumericId) {
            void StudentService.getByStudentId(numericId)
              .then((stu) => finish(stu))
              .catch(() => finish(buildStub()));
            return;
          }
          finish(buildStub());
        });
    };

    // Dispatch path usually has a real studentId — try it first, then name search.
    if (hasNumericId && !name) {
      void StudentService.getByStudentId(numericId)
        .then((stu) => finish(stu))
        .catch(() => searchThenMaybeId());
      return;
    }

    searchThenMaybeId();
  }, []);

  const openStudentDetails = useCallback(
    (studentId: number) => {
      if (!studentId) return;
      openStudentDetailsByRef({ id: String(studentId) });
    },
    [openStudentDetailsByRef],
  );

  const openSchoolDetails = useCallback((schoolId?: number, schoolName?: string) => {
    const name = schoolName?.trim() || '';
    const nameLower = name.toLowerCase();
    if (!schoolId && !name) return;

    const matchSchool = (school: School) => {
      if (schoolId && Number(school.schoolId) === Number(schoolId)) return true;
      if (!nameLower) return false;
      return (school.schoolName || '').trim().toLowerCase() === nameLower;
    };

    const cached =
      schoolsRef.current.find(matchSchool) ||
      (nameLower
        ? schoolsRef.current.find((school) =>
            (school.schoolName || '').toLowerCase().includes(nameLower),
          )
        : undefined);
    if (cached) {
      setSelectedSchool(cached);
      return;
    }

    const buildStub = (): School => ({
      id: schoolId ? `school-${schoolId}` : `school-${nameLower || 'unknown'}`,
      schoolId: schoolId || 0,
      schoolName: name || `School #${schoolId}`,
      schoolAddress: '',
      schoolBoardId: 0,
      isActive: true,
      studentNum: 0,
    });

    void SchoolService.list()
      .then((list) => {
        const match =
          list.find(matchSchool) ||
          (nameLower
            ? list.find((school) => (school.schoolName || '').toLowerCase().includes(nameLower))
            : undefined);
        if (match) {
          setSchools((prev) => (prev.some((s) => s.id === match.id) ? prev : [...prev, match]));
          setSelectedSchool(match);
          return;
        }
        if (schoolId) {
          return SchoolService.getById(String(schoolId))
            .then((school) => {
              setSchools((prev) => (prev.some((s) => s.id === school.id) ? prev : [...prev, school]));
              setSelectedSchool(school);
            })
            .catch(() => setSelectedSchool(buildStub()));
        }
        setSelectedSchool(buildStub());
      })
      .catch(() => {
        if (schoolId) {
          void SchoolService.getById(String(schoolId))
            .then((school) => setSelectedSchool(school))
            .catch(() => setSelectedSchool(buildStub()));
          return;
        }
        setSelectedSchool(buildStub());
      });
  }, []);

  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;

  const openEmployeeDetails = useCallback((employeeId?: string, employeeName?: string) => {
    const id = employeeId?.trim() || '';
    const name = employeeName?.trim() || '';
    const nameLower = name.toLowerCase();
    if (!id && !name) return;

    const employeeTokens = (employee: Employee) =>
      [
        employee.id,
        employee.employeeNumber,
        String(employee.employeeId ?? ''),
        employee.username || '',
      ]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

    const matchEmployee = (employee: Employee) => {
      if (id) {
        const idLower = id.toLowerCase();
        if (employeeTokens(employee).includes(idLower)) return true;
      }
      if (!nameLower) return false;
      const fullName = (employee.fullName || `${employee.firstName} ${employee.lastName}`)
        .trim()
        .toLowerCase();
      return fullName === nameLower;
    };

    // Same path as Dispatch / Routes: prefer in-memory master list first.
    const cached =
      employeesRef.current.find(matchEmployee) ||
      (nameLower
        ? employeesRef.current.find((employee) => {
            const fullName = (employee.fullName || `${employee.firstName} ${employee.lastName}`)
              .trim()
              .toLowerCase();
            return fullName.includes(nameLower) || nameLower.includes(fullName);
          })
        : undefined);
    if (cached) {
      setSelectedEmployee(cached);
      return;
    }

    const buildStub = (): Employee => {
      const parts = name.split(/\s+/).filter(Boolean);
      const firstName = parts[0] || id || 'Unknown';
      const lastName = parts.slice(1).join(' ');
      return {
        id: id || `lookup-${nameLower || 'employee'}`,
        employeeNumber: id || 'N/A',
        firstName,
        lastName,
        fullName: name || id,
        jobPosition: 'Staff',
        isActive: true,
      };
    };

    const requestId = ++employeeDetailRequest.current;
    const finish = (employee: Employee) => {
      if (employeeDetailRequest.current !== requestId) return;
      setSelectedEmployee(employee);
    };

    // Prefer name search (Dispatch-style), then id lookup. Avoid inventing document IDs.
    const query = name || id;
    void EmployeeService.list({ search: query })
      .then((list) => {
        if (employeeDetailRequest.current !== requestId) return;
        const match =
          list.find(matchEmployee) ||
          (nameLower
            ? list.find((employee) => {
                const fullName = (employee.fullName || `${employee.firstName} ${employee.lastName}`)
                  .trim()
                  .toLowerCase();
                return fullName === nameLower;
              })
            : undefined);
        if (match) {
          finish(match);
          return;
        }
        if (id) {
          return EmployeeService.getById(id)
            .then((employee) => finish(employee))
            .catch(() => finish(buildStub()));
        }
        finish(buildStub());
      })
      .catch(() => {
        if (id) {
          void EmployeeService.getById(id)
            .then((employee) => finish(employee))
            .catch(() => finish(buildStub()));
          return;
        }
        finish(buildStub());
      });
  }, []);

  const openVehicleDetails = useCallback((vehicleId?: number, unitNumber?: string) => {
    const unit = (unitNumber || '').trim().replace(/^#/, '');
    if (!vehicleId && !unit) return;

    const normalizeUnit = (value?: string | number | null) => {
      const raw = String(value ?? '')
        .trim()
        .replace(/^#/, '')
        .toLowerCase();
      if (!raw) return '';
      const stripped = raw.replace(/^(veh|bus|van|unit)[-_\s]*/i, '');
      return stripped.replace(/^0+(?=\d)/, '') || raw;
    };

    const unitKey = normalizeUnit(unit);
    const vehicleIdKey = vehicleId ? String(vehicleId) : '';

    const matchVehicle = (vehicle: Vehicle) => {
      if (vehicleId && Number(vehicle.vehicleId) === Number(vehicleId)) return true;
      const vehicleUnit = normalizeUnit(vehicle.unitNumber);
      if (unitKey && vehicleUnit && (vehicleUnit === unitKey || vehicleUnit === normalizeUnit(unit))) {
        return true;
      }
      if (unitKey && normalizeUnit(vehicle.plateNumber) === unitKey) return true;
      if (vehicleIdKey && vehicleUnit === normalizeUnit(vehicleIdKey)) return true;
      if (vehicleIdKey && normalizeUnit(vehicle.id) === vehicleIdKey) return true;
      if (vehicleIdKey && normalizeUnit(vehicle.id.replace(/^veh-/i, '')) === vehicleIdKey) return true;
      return false;
    };

    // Same path as Dispatch / Routes: prefer in-memory fleet list first.
    const cached = vehiclesRef.current.find(matchVehicle);
    if (cached) {
      setSelectedVehicle(cached);
      return;
    }

    const buildStub = (): Vehicle => ({
      id: unit ? `unit-${unit}` : `vehicle-${vehicleIdKey}`,
      vehicleId: vehicleId || 0,
      unitNumber: unit || vehicleIdKey || 'Unknown',
      plateNumber: '',
      manufacturer: '',
      model: '',
      year: 0,
      color: '',
      unitType: 'Bus',
      seatCap: 0,
      wheelchairCap: 0,
      fuelType: '',
      active: true,
      status: 'Spare',
      yardName: '',
    });

    const requestId = ++vehicleDetailRequest.current;
    const finish = (vehicle: Vehicle) => {
      if (vehicleDetailRequest.current !== requestId) return;
      setSelectedVehicle(vehicle);
    };

    const query = unit || vehicleIdKey;
    void VehicleService.list({ search: query })
      .then((list) => {
        if (vehicleDetailRequest.current !== requestId) return;
        const match = list.find(matchVehicle);
        if (match) {
          finish(match);
          return;
        }
        // Backend GetVehicle also accepts unit number; try that once (no invented VEH- prefixes).
        if (unit) {
          return VehicleService.getById(unit)
            .then((vehicle) => finish(vehicle))
            .catch(() => finish(buildStub()));
        }
        finish(buildStub());
      })
      .catch(() => {
        if (unit) {
          void VehicleService.getById(unit)
            .then((vehicle) => finish(vehicle))
            .catch(() => finish(buildStub()));
          return;
        }
        finish(buildStub());
      });
  }, []);

  const openDispatchChangeLog = useCallback((date?: string) => {
    if (date) setDispatchLogDate(date);
    setCurrentTab('dispatch_log');
  }, []);
  const openTemporaryAssignments = useCallback(() => {
    setCurrentTab('temporary_assignments');
  }, []);
  const openStudentAbsences = useCallback(() => {
    setCurrentTab('student_absences');
  }, []);
  const openPayrollFinanceLog = useCallback(() => {
    setCurrentTab('payroll_dept_log');
  }, []);
  const openDispatchPayroll = useCallback(() => {
    setCurrentTab('dispatch_payroll');
  }, []);
  const messageDriverFromDispatch = useCallback((driverId: string) => {
    setChatInitialTargetUserId(driverId);
    setIsChatOpen(true);
  }, []);

  // Top-level permanent caches
  const [schoolCalendars, setSchoolCalendars] = useState<SchoolCalendar[]>([]);
  const [payrollBoardRates, setPayrollBoardRates] = useState<SchoolBoardBaseRatesDTO[]>(() =>
    PayrollService.getCachedBoardRates()
  );
  const [payrollRates, setPayrollRates] = useState<BusRoutePayrollRate[]>(() =>
    PayrollService.getCachedCustomRates()
  );
  const [companyContacts, setCompanyContacts] = useState<CompanyContact[]>([]);

  // Drawer and modal states
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeModalInitialTab, setEmployeeModalInitialTab] = useState<'profile' | 'permissions' | 'contact' | 'license' | 'emergency'>('profile');
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isRouteAssignModalOpen, setIsRouteAssignModalOpen] = useState<boolean>(false);
  const [assigningRoute, setAssigningRoute] = useState<BusRoute | null>(null);

  // Manual fallback sync (only triggered if user explicitly clicks "Sync Cloud")
  const handleManualSync = useCallback(async () => {
    setDataLoading(true);
    try {
      const [empList, dashboardStats] = await Promise.all([
        EmployeeService.list(),
        EmployeeService.getStats()
      ]);
      setEmployees(empList);
      setStats(dashboardStats);
    } catch (err) {
      console.error("Manual sync failed:", err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const handleStudentsLoaded = React.useCallback((loadedStudents: Student[]) => {
    setStudents((prev) => {
      const existingMap = new Map(prev.map((s) => [s.id, s]));
      let hasChange = false;
      for (const s of loadedStudents) {
        if (!existingMap.has(s.id)) {
          existingMap.set(s.id, s);
          hasChange = true;
        } else {
          const old = existingMap.get(s.id);
          if (old && (old.updatedAt !== s.updatedAt || old.routes !== s.routes || old.active !== s.active)) {
            existingMap.set(s.id, s);
            hasChange = true;
          }
        }
      }
      return hasChange ? Array.from(existingMap.values()) : prev;
    });
  }, []);

  const handleStudentRefresh = async () => {
    try {
      const [stuList, schList] = await Promise.all([
        StudentService.list(),
        SchoolService.list()
      ]);
      setStudents(stuList);
      setSchools(schList);
      setStudentStats(calculateStudentStats(stuList));
    } catch (err) {
      console.error("Student manual sync error:", err);
    }
  };

  const handleRouteRefresh = useCallback(async () => {
    try {
      const rtList = await RouteService.list();
      setRoutes(rtList);
      setRouteStats(calculateRouteStats(rtList));
    } catch (err) {
      console.error("Route manual sync error:", err);
    }
  }, []);

  const handleRouteUpdated = useCallback((updatedRoute: BusRoute) => {
    setRoutes((prev) => prev.map((route) => (route.id === updatedRoute.id ? updatedRoute : route)));
    setSelectedRoute((current) => (current && current.id === updatedRoute.id ? updatedRoute : current));
  }, []);

  const handleOpenAssignCrew = useCallback((route: BusRoute) => {
    setAssigningRoute(route);
    setIsRouteAssignModalOpen(true);
  }, []);

  const handleVehicleRefresh = async () => {
    try {
      const vehList = await VehicleService.list();
      const safeVehicles = Array.isArray(vehList) ? vehList : [];
      setVehicles(safeVehicles);
      setVehicleStats(calculateVehicleStats(safeVehicles));
    } catch (err) {
      console.error("Vehicle manual sync error:", err);
    }
  };

  const [yards, setYards] = useState<Yard[]>([]);

  const handleYardRefresh = async () => {
    try {
      const yardList = await YardService.list();
      setYards(yardList);
    } catch (err) {
      console.error("Yard manual sync error:", err);
    }
  };

  useEffect(() => {
    const unsub = initCloudRolePermissionsListener();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setDataLoading(true);
      let isResolved = false;

      // 100% Pure Real-time Firestore onSnapshot listener for Employees
      const unsubEmployees = EmployeeService.subscribeToEmployees(
        (realtimeList) => {
          isResolved = true;
          const seen = new Set<string>();
          const deduped: Employee[] = [];
          for (const emp of realtimeList) {
            const key = emp.id || emp.employeeNumber;
            if (key && !seen.has(key)) {
              seen.add(key);
              deduped.push(emp);
            }
          }
          setEmployees(deduped);
          setStats(calculateStats(deduped));
          setDataLoading(false);
        },
        (error) => {
          console.warn("Realtime Firestore employee notice:", error);
          if (!isResolved) {
            handleManualSync();
          }
        }
      );

      // Real-time Firestore onSnapshot listener for Schools
      const unsubSchools = SchoolService.subscribeToSchools(
        (schList) => {
          setSchools(schList);
        },
        (error) => {
          console.warn("Realtime Firestore school notice:", error);
        }
      );

      // Real-time Firestore onSnapshot listener for School Boards
      const unsubBoards = SchoolService.subscribeToSchoolBoards(
        (brdList) => {
          setBoards(brdList);
        },
        (error) => {
          console.warn("Realtime Firestore school board notice:", error);
        }
      );

      // Lightweight Student Stats hydration (Zero bulk student document reads on launch)
      StudentService.getStats()
        .then((s) => setStudentStats(s))
        .catch((error) => console.warn("Initial student stats notice:", error));

      // Real-time Firestore onSnapshot listener for Routes
      const unsubRoutes = RouteService.subscribeToRoutes(
        (rtList) => {
          setRoutes(rtList);
          setRouteStats(calculateRouteStats(rtList));
        },
        (error) => {
          console.warn("Realtime Firestore route notice:", error);
        }
      );

      // Real-time Firestore onSnapshot listener for Vehicles
      const unsubVehicles = VehicleService.subscribeToVehicles(
        (vehList, source) => {
          setVehicleSyncSource(source);
          const safeVehicles = Array.isArray(vehList) ? vehList : [];
          const seen = new Set<string>();
          const deduped: Vehicle[] = [];
          for (const v of safeVehicles) {
            const key = v.id || v.unitNumber;
            if (key && !seen.has(key)) {
              seen.add(key);
              deduped.push(v);
            }
          }
          setVehicles(deduped);
          setVehicleStats(calculateVehicleStats(deduped));
        },
        (error) => {
          console.warn("Realtime Firestore vehicle notice:", error);
        }
      );

      // Real-time Firestore onSnapshot listener for Yards
      const unsubYards = YardService.subscribeToYards(
        (yardList) => {
          setYards(yardList);
        },
        (error) => {
          console.warn("Realtime Firestore yard notice:", error);
        }
      );

      // Real-time Firestore onSnapshot listener for Company Contacts
      const unsubContacts = CompanyContactsService.subscribeToCompanyContacts(
        (contactList) => {
          setCompanyContacts(contactList);
        },
        (error) => {
          console.warn("Realtime Firestore company contacts notice:", error);
        }
      );

      // Real-time Firestore onSnapshot listener for School Calendars
      const unsubCalendars = CalendarService.subscribeToAllCalendars(
        (calList) => {
          setSchoolCalendars(calList);
        },
        (error) => {
          console.warn("Realtime Firestore calendar notice:", error);
        }
      );

      // Real-time Firestore onSnapshot listener for Payroll Rates (for authorized users)
      let unsubPayrollRates: (() => void) | undefined;
      if (
        currentUser.role === 'admin' ||
        currentUser.role === 'payroll' ||
        currentUser.role === 'manager' ||
        hasPageAccess(currentUser, 'payroll')
      ) {
        unsubPayrollRates = PayrollService.subscribeToPayrollRates(
          (rateList) => {
            setPayrollRates(rateList);
          },
          (error) => {
            console.warn("Realtime Firestore payroll rates notice:", error);
          }
        );

        // Pre-hydrate Payroll Board Rates in the background on startup
        PayrollService.getSchoolBoardBaseRates()
          .then((rates) => {
            if (rates && rates.length > 0) {
              setPayrollBoardRates(rates);
            }
          })
          .catch((e) => console.warn("Payroll board rates pre-load notice:", e));
      }

      // Failsafe: if onSnapshot takes more than 2.5s to respond, hydrate from Go API
      const failsafe = setTimeout(() => {
        if (!isResolved) {
          handleManualSync();
        }
      }, 2500);

      return () => {
        unsubEmployees();
        unsubSchools();
        unsubBoards();
        unsubRoutes();
        unsubVehicles();
        unsubYards();
        unsubContacts();
        unsubCalendars();
        if (unsubPayrollRates) unsubPayrollRates();
        clearTimeout(failsafe);
      };
    }
  }, [currentUser?.uid, currentUser?.employeeId]);

  useEffect(() => {
    if (!currentUser) return;
    const matchedEmp = employees.find(
      (e) =>
        (e.id && e.id === currentUser.employeeId) ||
        (e.employeeNumber && e.employeeNumber === currentUser.employeeId) ||
        (e.workEmail && e.workEmail.toLowerCase() === currentUser.email?.toLowerCase()) ||
        (e.username && `${e.username}@dispatch.pcy.ca` === currentUser.email?.toLowerCase())
    );
    if (!matchedEmp) return;
    const nextRole = matchedEmp.role || currentUser.role;
    const nextOverrides = matchedEmp.pagePermissions || currentUser.overrides;
    const nextYard = matchedEmp.yardId || currentUser.yardId;
    if (
      nextRole !== currentUser.role ||
      JSON.stringify(nextOverrides || {}) !== JSON.stringify(currentUser.overrides || {}) ||
      nextYard !== currentUser.yardId
    ) {
      updateCurrentUser({
        role: nextRole,
        overrides: nextOverrides,
        yardId: nextYard,
      });
    }
  }, [currentUser, employees]);

  useEffect(() => {
    if (!currentUser) return;
    if (hasPageAccess(currentUser, currentTab)) return;
    const allTabs: NavTab[] = [
      'dashboard', 'dispatch', 'routes', 'staging_routes', 'dispatch_payroll',
      'employees', 'time_off', 'payroll', 'biweekly_payroll', 'payroll_dept_log',
      'temporary_assignments', 'dispatch_log', 'assignment_history',
      'vehicles', 'defects', 'vehicle_signouts', 'yards',
      'compliance', 'training', 'students', 'student_incidents',
      'hazards', 'route_assessments', 'schools', 'calendar',
      'expenses', 'company_contacts', 'roles', 'login_logs',
      'audit_logs', 'error_logs', 'external_sync', 'settings'
    ];
    const allowedTab = allTabs.find((t) => hasPageAccess(currentUser, t));
    if (allowedTab) {
      setCurrentTab(allowedTab);
    }
  }, [currentUser, currentTab]);

  const closeEmployeeDrawer = useCallback(() => setSelectedEmployee(null), []);
  const closeEmployeeModal = useCallback(() => setIsModalOpen(false), []);

  const handleCreateEmployee = useCallback(() => {
    setEditingEmployee(null);
    setEmployeeModalInitialTab('profile');
    setIsModalOpen(true);
  }, []);

  const handleEditEmployee = useCallback((
    emp: Employee,
    initialTab: 'profile' | 'permissions' | 'contact' | 'license' | 'emergency' = 'profile'
  ) => {
    setEditingEmployee(emp);
    setEmployeeModalInitialTab(initialTab);
    setIsModalOpen(true);
    setSelectedEmployee(null);
  }, []);

  const handleQuickReassignRole = useCallback(async (employeeId: string, newRole: UserRole) => {
    const emp = employeesRef.current.find((e) => e.id === employeeId || e.employeeNumber === employeeId);
    if (!emp) return;
    const updated = await EmployeeService.update(emp.id, { role: newRole });
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  const handleSaveEmployee = useCallback(async (data: Partial<Employee>) => {
    if (editingEmployee) {
      const updated = await EmployeeService.update(editingEmployee.id, data);
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === updated.id || (updated.employeeNumber && e.employeeNumber === updated.employeeNumber)
            ? updated
            : e
        )
      );
      return;
    }
    const created = await EmployeeService.create(data);
    setEmployees((prev) => {
      const withoutNew = prev.filter(
        (e) => e.id !== created.id && (!created.employeeNumber || e.employeeNumber !== created.employeeNumber)
      );
      return [created, ...withoutNew];
    });
  }, [editingEmployee]);

  const handleDeleteEmployee = useCallback(async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete employee #${id}?`)) return;
    await EmployeeService.delete(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id && e.employeeNumber !== id));
    setSelectedEmployee(null);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading Dispatch Hub...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginView />
        <PWAInstallBanner />
      </>
    );
  }

  const handleCreateVehicle = () => {
    setEditingVehicle(null);
    setIsVehicleModalOpen(true);
  };

  const handleEditVehicle = (veh: Vehicle) => {
    setEditingVehicle(veh);
    setIsVehicleModalOpen(true);
    setSelectedVehicle(null);
  };

  const handleSaveVehicle = async (data: Partial<Vehicle>) => {
    const actor: EntityOperationActor = {
      userId: currentUser?.employeeId || currentUser?.uid || 'usr-dispatch',
      userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
      userEmail: currentUser?.email || undefined,
      userRole: currentUser?.role || 'dispatcher'
    };

    if (editingVehicle) {
      const updated = await VehicleService.update(editingVehicle.id, data);
      setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

      const diffs = EntityOperationLogService.compareVehicle(editingVehicle, updated);
      const summary =
        diffs.length > 0
          ? `Modified Vehicle Unit #${updated.unitNumber}: changed ${diffs.map((d) => d.fieldLabel).join(', ')}`
          : `Updated specs and details for Vehicle Unit #${updated.unitNumber}`;

      EntityOperationLogService.logOperation({
        targetType: 'vehicle',
        targetId: updated.id,
        targetIdentifier: updated.unitNumber,
        targetName: `${updated.manufacturer || ''} ${updated.model || ''} (${updated.plateNumber || 'No Plate'})`.trim(),
        action: 'update',
        summary,
        diffs,
        actor
      }).catch((e) => console.warn('Vehicle update audit log failed:', e));
    } else {
      const created = await VehicleService.create(data);
      setVehicles((prev) => {
        const withoutNew = prev.filter(
          (v) => v.id !== created.id && (!created.unitNumber || v.unitNumber !== created.unitNumber)
        );
        return [created, ...withoutNew];
      });

      const diffs: EntityFieldDiff[] = [
        { field: 'unitNumber', fieldLabel: 'Unit Number', oldValue: undefined, newValue: created.unitNumber },
        { field: 'plateNumber', fieldLabel: 'License Plate', oldValue: undefined, newValue: created.plateNumber },
        { field: 'unitType', fieldLabel: 'Vehicle Type', oldValue: undefined, newValue: created.unitType },
        { field: 'yardName', fieldLabel: 'Home Yard', oldValue: undefined, newValue: created.yardName },
        { field: 'status', fieldLabel: 'Fleet Status', oldValue: undefined, newValue: created.status }
      ];

      EntityOperationLogService.logOperation({
        targetType: 'vehicle',
        targetId: created.id,
        targetIdentifier: created.unitNumber,
        targetName: `${created.manufacturer || ''} ${created.model || ''} (${created.plateNumber || 'No Plate'})`.trim(),
        action: 'create',
        summary: `Registered new fleet vehicle Unit #${created.unitNumber} (${created.manufacturer} ${created.model})`,
        diffs,
        actor
      }).catch((e) => console.warn('Vehicle create audit log failed:', e));
    }
    const newStats = await VehicleService.getStats();
    setVehicleStats(newStats);
  };

  const handleDeleteVehicle = async (veh: Vehicle) => {
    if (
      !window.confirm(
        `Are you sure you want to delete / decommission vehicle Unit #${veh.unitNumber} (${veh.plateNumber || 'No Plate'})? This action will be logged in the audit trail.`
      )
    ) {
      return;
    }

    const actor: EntityOperationActor = {
      userId: currentUser?.employeeId || currentUser?.uid || 'usr-dispatch',
      userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
      userEmail: currentUser?.email || undefined,
      userRole: currentUser?.role || 'dispatcher'
    };

    try {
      await VehicleService.delete(veh.id);
      setVehicles((prev) => prev.filter((v) => v.id !== veh.id));
      setSelectedVehicle(null);
      const newStats = await VehicleService.getStats();
      setVehicleStats(newStats);

      await EntityOperationLogService.logOperation({
        targetType: 'vehicle',
        targetId: veh.id,
        targetIdentifier: veh.unitNumber,
        targetName: `${veh.manufacturer || ''} ${veh.model || ''} (${veh.plateNumber || 'No Plate'})`.trim(),
        action: 'delete',
        summary: `Decommissioned / Deleted vehicle Unit #${veh.unitNumber} (${veh.plateNumber || 'No Plate'}) from active fleet inventory`,
        diffs: [
          { field: 'status', fieldLabel: 'Fleet Status', oldValue: veh.status, newValue: 'Decommissioned / Deleted' },
          { field: 'active', fieldLabel: 'Active Flag', oldValue: veh.active, newValue: false }
        ],
        actor,
        metadata: { deletedSnapshot: veh }
      });
    } catch (err: any) {
      console.error('Delete vehicle failed:', err);
      alert(`Failed to delete vehicle: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSaveRouteCrew = async (routeId: string, payload: AssignRouteCrewPayload) => {
    const updated = await RouteService.assignCrew(routeId, payload);
    setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedRoute && selectedRoute.id === updated.id) {
      setSelectedRoute(updated);
    }
    const newVehStats = await VehicleService.getStats();
    setVehicleStats(newVehStats);
  };

  const handleSchoolRefresh = async () => {
    try {
      const [schList, brdList] = await Promise.all([
        SchoolService.list(),
        SchoolService.listBoards()
      ]);
      setSchools(schList);
      setBoards(brdList);
    } catch (err) {
      console.error("School manual sync error:", err);
    }
  };

  const handleCreateSchool = () => {
    setEditingSchool(null);
    setIsSchoolModalOpen(true);
  };

  const handleEditSchool = (sch: School) => {
    setEditingSchool(sch);
    setIsSchoolModalOpen(true);
    setSelectedSchool(null);
  };

  const handleSaveSchool = async (data: Partial<School>) => {
    if (editingSchool) {
      const updated = await SchoolService.update(editingSchool.id, data);
      setSchools((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } else {
      const created = await SchoolService.create(data);
      setSchools((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
    }
  };

  const handleDeleteSchool = async (sch: School) => {
    if (!window.confirm(`Are you sure you want to delete ${sch.schoolName}?`)) return;
    await SchoolService.delete(sch.id);
    setSchools((prev) => prev.filter((s) => s.id !== sch.id));
    setSelectedSchool(null);
  };

  const handleCreateBoard = () => {
    setEditingBoard(null);
    setIsBoardModalOpen(true);
  };

  const handleEditBoard = (b: SchoolBoard) => {
    setEditingBoard(b);
    setIsBoardModalOpen(true);
  };

  const handleSaveBoard = async (data: Partial<SchoolBoard>) => {
    if (editingBoard && editingBoard.id) {
      const updated = await SchoolService.updateBoard(editingBoard.id, data);
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } else {
      const created = await SchoolService.createBoard(data);
      setBoards((prev) => [...prev.filter((b) => b.id !== created.id), created]);
    }
  };

  const handleCreateStudent = () => {
    setEditingStudent(null);
    setStudentModalInitialTab('profile');
    setIsStudentModalOpen(true);
  };

  const handleEditStudent = (student: Student, initialTab: StudentModalTab = 'profile') => {
    setEditingStudent(student);
    setStudentModalInitialTab(initialTab);
    setIsStudentModalOpen(true);
    setSelectedStudent(null);
  };

  const handleSaveStudent = async (data: Partial<Student>) => {
    const actor: EntityOperationActor = {
      userId: currentUser?.employeeId || currentUser?.uid || 'usr-dispatch',
      userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
      userEmail: currentUser?.email || undefined,
      userRole: currentUser?.role || 'dispatcher'
    };

    if (editingStudent) {
      const updated = await StudentService.update(editingStudent.id, data);
      const newStudents = students.map((s) => (s.id === updated.id ? updated : s));
      setStudents(newStudents);
      void StudentService.getStats()
        .then(setStudentStats)
        .catch((error) => console.warn('Student stats refresh failed:', error));

      const diffs = EntityOperationLogService.compareStudent(editingStudent, updated);
      const summary =
        diffs.length > 0
          ? `Modified student ${updated.fullName || updated.studentName} (#${updated.studentNo}): changed ${diffs.map((d) => d.fieldLabel).join(', ')}`
          : `Updated record for student ${updated.fullName || updated.studentName} (#${updated.studentNo})`;

      EntityOperationLogService.logOperation({
        targetType: 'student',
        targetId: updated.id,
        targetIdentifier: updated.studentNo,
        targetName: updated.fullName || updated.studentName,
        action: 'update',
        summary,
        diffs,
        actor
      }).catch((e) => console.warn('Student update audit log failed:', e));
    } else {
      const created = await StudentService.create(data);
      const newStudents = [created, ...students];
      setStudents(newStudents);
      void StudentService.getStats()
        .then(setStudentStats)
        .catch((error) => console.warn('Student stats refresh failed:', error));

      const diffs: EntityFieldDiff[] = [
        { field: 'fullName', fieldLabel: 'Student Name', oldValue: undefined, newValue: created.fullName || created.studentName },
        { field: 'studentNo', fieldLabel: 'Student Number', oldValue: undefined, newValue: created.studentNo },
        { field: 'schoolName', fieldLabel: 'School', oldValue: undefined, newValue: created.schoolName },
        { field: 'grade', fieldLabel: 'Grade', oldValue: undefined, newValue: created.grade },
        { field: 'routes', fieldLabel: 'Assigned Routes', oldValue: undefined, newValue: created.routes || 'None' }
      ];

      EntityOperationLogService.logOperation({
        targetType: 'student',
        targetId: created.id,
        targetIdentifier: created.studentNo,
        targetName: created.fullName || created.studentName,
        action: 'create',
        summary: `Created new student profile for ${created.fullName || created.studentName} (#${created.studentNo}) at ${created.schoolName}`,
        diffs,
        actor
      }).catch((e) => console.warn('Student create audit log failed:', e));
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (
      !window.confirm(
        `Are you sure you want to delete student profile for ${student.fullName || student.studentName} (#${student.studentNo})? This action will be logged in the audit trail.`
      )
    ) {
      return;
    }

    const actor: EntityOperationActor = {
      userId: currentUser?.employeeId || currentUser?.uid || 'usr-dispatch',
      userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
      userEmail: currentUser?.email || undefined,
      userRole: currentUser?.role || 'dispatcher'
    };

    try {
      await StudentService.delete(student.id);
      const newStudents = students.filter((s) => s.id !== student.id);
      setStudents(newStudents);
      void StudentService.getStats()
        .then(setStudentStats)
        .catch((error) => console.warn('Student stats refresh failed:', error));
      setSelectedStudent(null);

      await EntityOperationLogService.logOperation({
        targetType: 'student',
        targetId: student.id,
        targetIdentifier: student.studentNo,
        targetName: student.fullName || student.studentName,
        action: 'delete',
        summary: `Deleted student profile #${student.studentNo} (${student.fullName || student.studentName}) from school ${student.schoolName}`,
        diffs: [
          { field: 'active', fieldLabel: 'Active Status', oldValue: student.active, newValue: 'Deleted' },
          { field: 'schoolName', fieldLabel: 'School', oldValue: student.schoolName, newValue: 'Removed' }
        ],
        actor,
        metadata: { deletedSnapshot: student }
      });
    } catch (err: any) {
      console.error('Delete student failed:', err);
      alert(`Failed to delete student: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-950 flex flex-col text-slate-100 font-sans">
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        expiringLicenseCount={stats.licenseExpiringSoon}
        onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
        onOpenChat={() => {
          setIsChatOpen(true);
          clearUnread();
        }}
        chatUnreadCount={unreadCount}
        onOpenAICopilot={() => {
          setAiCopilotMounted(true);
          setIsAICopilotOpen((prev) => !prev);
        }}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          expiringLicenseCount={stats.licenseExpiringSoon}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />

        <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto bg-slate-950/80 pb-20 md:pb-6">
          <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading...</div>}>
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              employees={employees}
              routes={routes}
              onNavigateTab={setCurrentTab}
              onSelectEmployee={setSelectedEmployee}
            />
          )}

          {currentTab === 'employees' && (
            <EmployeeListView
              employees={employees}
              loading={dataLoading}
              onSelectEmployee={setSelectedEmployee}
              onEditEmployee={handleEditEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onOpenCreate={handleCreateEmployee}
              onRefresh={handleManualSync}
              refreshing={dataLoading}
            />
          )}

          {currentTab === 'schools' && (
            <SchoolListView
              schools={schools}
              boards={boards}
              stats={schoolStats}
              loading={dataLoading}
              onRefresh={handleSchoolRefresh}
              onSelectSchool={setSelectedSchool}
              onEditSchool={handleEditSchool}
              onCreateSchool={handleCreateSchool}
              onEditBoard={handleEditBoard}
              onCreateBoard={handleCreateBoard}
              onViewSchoolStudents={() => {
                setCurrentTab('students');
              }}
              onViewSchoolCalendar={(school) => {
                setCalendarSelectedSchoolId(school.schoolId);
                setCurrentTab('calendar');
              }}
            />
          )}

          {currentTab === 'calendar' && (
            <SchoolCalendarView
              schools={schools}
              boards={boards}
              selectedSchoolId={calendarSelectedSchoolId}
              onSelectSchool={(school) => {
                setCalendarSelectedSchoolId(school ? school.schoolId : null);
              }}
              cachedCalendars={schoolCalendars}
            />
          )}

          {currentTab === 'students' && (
            <StudentListView
              students={students}
              schools={schools}
              stats={studentStats}
              loading={dataLoading}
              onSelectStudent={setSelectedStudent}
              onSelectSchool={openSchoolDetails}
              onEditStudent={handleEditStudent}
              onViewStudentStops={(student) => handleEditStudent(student, 'stops')}
              onCreateStudent={handleCreateStudent}
              onDeleteStudent={handleDeleteStudent}
              onRefresh={handleStudentRefresh}
              onMessageParent={handleOpenParentChat}
              onStudentsLoaded={handleStudentsLoaded}
            />
          )}

          {currentTab === 'student_absences' && (
            <StudentAbsencesView
              studentsMap={studentsMap}
              onSelectStudent={openStudentDetailsByRef}
              onSelectSchool={openSchoolDetails}
            />
          )}

          {currentTab === 'dispatch' && (
            <DispatchWorkbenchView
              employees={employees}
              vehicles={vehicles}
              yards={yards}
              studentsMap={studentsMap}
              onSelectStudent={openStudentDetails}
              onSelectEmployee={openEmployeeDetails}
              onSelectVehicle={openVehicleDetails}
              onNavigateToChangeLog={openDispatchChangeLog}
              onNavigateToTemporaryAssignments={openTemporaryAssignments}
              onNavigateToAbsences={openStudentAbsences}
              onMessageDriver={messageDriverFromDispatch}
            />
          )}

          {currentTab === 'charter' && (
            <CharterManagementView
              employees={employees}
              vehicles={vehicles}
              schools={schools}
              onNavigateToPayroll={openDispatchPayroll}
              onSelectEmployee={openEmployeeDetails}
              onSelectVehicle={openVehicleDetails}
            />
          )}

          {currentTab === 'dispatch_payroll' && (
            <div className="p-3 md:p-4 w-full">
              <DispatchDailyPayrollTab
                onNavigateToFinanceLog={openPayrollFinanceLog}
                onSelectEmployee={openEmployeeDetails}
              />
            </div>
          )}

          {currentTab === 'dispatch_log' && (
            <DispatchChangeLogView
              key={dispatchLogDate}
              initialDate={dispatchLogDate}
              onNavigateToDispatch={() => {
                setCurrentTab('dispatch');
              }}
            />
          )}

          {currentTab === 'temporary_assignments' && (
            <TemporaryAssignmentsView
              routes={routes}
              employees={employees}
              vehicles={vehicles}
            />
          )}

          {currentTab === 'assignment_history' && (
            <AssignmentTrackingView />
          )}

          {currentTab === 'time_off' && (
            <TimeOffView
              employees={employees}
              routes={routes}
              vehicles={vehicles}
              onNavigateToTemporaryAssignments={openTemporaryAssignments}
              onSelectEmployee={openEmployeeDetails}
            />
          )}

          {currentTab === 'training' && (
            <TrainingView employees={employees} />
          )}

          {currentTab === 'defects' && (
            <DefectReportsView
              onSelectEmployee={openEmployeeDetails}
              onSelectVehicle={openVehicleDetails}
            />
          )}

          {currentTab === 'student_incidents' && (
            <StudentIncidentsView
              onSelectStudent={openStudentDetailsByRef}
              onSelectSchool={openSchoolDetails}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpenseReimbursementsView
              employees={employees}
              onSelectEmployee={openEmployeeDetails}
            />
          )}

          {currentTab === 'hazards' && (
            <HazardReportsView onSelectEmployee={openEmployeeDetails} />
          )}

          {currentTab === 'route_assessments' && (
            <RouteAssessmentsView />
          )}

          {currentTab === 'vehicle_signouts' && (
            <VehicleSignoutView
              onSelectEmployee={openEmployeeDetails}
              onSelectVehicle={openVehicleDetails}
            />
          )}

          {currentTab === 'staging_routes' && (
            <StagingRouteListView onSelectStudent={openStudentDetailsByRef} />
          )}

          {currentTab === 'routes' && (
            <RouteListView
              routes={routes}
              stats={routeStats}
              studentsMap={studentsMap}
              schools={schools}
              yards={yards}
              employees={employees}
              loading={dataLoading}
              onSelectRoute={setSelectedRoute}
              onSelectStudent={setSelectedStudent}
              onSelectStudentId={openStudentDetails}
              onSelectEmployee={openEmployeeDetails}
              onSelectVehicle={openVehicleDetails}
              onAssignCrew={handleOpenAssignCrew}
              onRefresh={handleRouteRefresh}
              onRouteUpdated={handleRouteUpdated}
            />
          )}

          {currentTab === 'vehicles' && (
            <VehicleListView
              vehicles={vehicles}
              stats={vehicleStats}
              loading={dataLoading}
              onSelectVehicle={setSelectedVehicle}
              onEditVehicle={handleEditVehicle}
              onCreateVehicle={handleCreateVehicle}
              onDeleteVehicle={handleDeleteVehicle}
              syncSource={vehicleSyncSource}
              onSelectRoute={(routeNo) => {
                const rt = routes.find((r) => r.routeNo === routeNo);
                if (rt) {
                  setSelectedRoute(rt);
                }
                setCurrentTab('routes');
              }}
              onRefresh={handleVehicleRefresh}
            />
          )}

          {currentTab === 'pretrip_checks' && (
            <PreTripInspectionsView
              onSelectEmployee={openEmployeeDetails}
              onSelectVehicle={openVehicleDetails}
            />
          )}

          {currentTab === 'vehicle_inspections' && (
            <VehicleInspectionsView
              vehicles={vehicles}
              onSelectVehicle={setSelectedVehicle}
            />
          )}

          {currentTab === 'compliance' && (
            <ComplianceView
              employees={employees}
              vehicles={vehicles}
              onSelectEmployee={setSelectedEmployee}
              onSelectVehicle={setSelectedVehicle}
              onBack={() => setCurrentTab('dashboard')}
            />
          )}

          {currentTab === 'payroll' && (
            <PayrollRateView
              initialBoardRates={payrollBoardRates}
              cachedRates={payrollRates}
              boards={boards}
              routes={routes}
              employees={employees}
              onBoardRatesChange={setPayrollBoardRates}
              onSelectEmployee={openEmployeeDetails}
            />
          )}

          {currentTab === 'biweekly_payroll' && (
            <BiweeklyPayrollView
              boards={boards}
              employees={employees}
              routes={routes}
              onSelectEmployee={openEmployeeDetails}
            />
          )}

          {currentTab === 'payroll_dept_log' && (
            <div className="p-3 md:p-4 w-full">
              <PayrollDepartmentLogView onSelectEmployee={openEmployeeDetails} />
            </div>
          )}

          {currentTab === 'yards' && (
            <YardListView
              yards={yards}
              routes={routes}
              schools={schools}
              employees={employees}
              loading={dataLoading}
              onRefresh={handleYardRefresh}
              onRoutesUpdate={handleRouteRefresh}
              onSchoolsUpdate={handleSchoolRefresh}
              onYardsUpdate={handleYardRefresh}
            />
          )}

          {currentTab === 'roles' && (
            <RoleManagementView
              employees={employees}
              loading={dataLoading}
              onSelectEmployee={setSelectedEmployee}
              onEditEmployee={handleEditEmployee}
              onQuickReassignRole={handleQuickReassignRole}
              onRefresh={handleManualSync}
              refreshing={dataLoading}
            />
          )}

          {currentTab === 'company_contacts' && <CompanyContactsView contacts={companyContacts} />}

          {currentTab === 'login_logs' && <LoginLogsView />}

          {currentTab === 'audit_logs' && <AuditLogsView />}

          {currentTab === 'error_logs' && <ErrorLogsView />}

          {currentTab === 'external_sync' && <ExternalSyncView />}

          {currentTab === 'settings' && <SettingsView />}
          </Suspense>
        </main>
      </div>

      {/* Slide-over Drawer for employee details */}
      {selectedEmployee && (
        <Suspense fallback={null}>
          <EmployeeDetailDrawer
            employee={selectedEmployee}
            onClose={closeEmployeeDrawer}
            onEdit={handleEditEmployee}
            onDelete={handleDeleteEmployee}
          />
        </Suspense>
      )}

      {/* Slide-over Drawer for student details (links school in real-time) */}
      <StudentDetailDrawer
        student={selectedStudent}
        school={selectedStudent ? schools.find((s) => s.schoolId === selectedStudent.schoolId) : null}
        onClose={() => setSelectedStudent(null)}
        onEdit={handleEditStudent}
        onDelete={handleDeleteStudent}
        onMessageParent={handleOpenParentChat}
      />

      {/* Slide-over Drawer for route details & stops itinerary */}
      <RouteDetailDrawer
        route={selectedRoute}
        studentsMap={studentsMap}
        onClose={() => setSelectedRoute(null)}
        onSelectStudent={(stu) => {
          setSelectedStudent(stu);
        }}
        onSelectStudentId={openStudentDetails}
        onAssignCrew={handleOpenAssignCrew}
        onRouteUpdated={handleRouteUpdated}
      />

      {/* Slide-over Drawer for vehicle fleet details */}
      <VehicleDetailDrawer
        vehicle={selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
        onEdit={handleEditVehicle}
        onDelete={handleDeleteVehicle}
        onSelectRoute={(routeNo) => {
          const rt = routes.find((r) => r.routeNo === routeNo);
          if (rt) {
            setSelectedRoute(rt);
          }
          setSelectedVehicle(null);
          setCurrentTab('routes');
        }}
      />

      {/* Modal for creating / editing employee records */}
      {isModalOpen && (
        <Suspense fallback={null}>
          <EmployeeModal
            isOpen
            onClose={closeEmployeeModal}
            onSave={handleSaveEmployee}
            initialData={editingEmployee}
            initialTab={employeeModalInitialTab}
          />
        </Suspense>
      )}

      {/* Modal for creating / editing vehicle records */}
      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSave={handleSaveVehicle}
        initialData={editingVehicle}
        employees={employees}
        vehicles={vehicles}
      />

      {/* Modal for assigning Route Crew, Vehicle & Attendant */}
      {isRouteAssignModalOpen && assigningRoute && (
        <RouteAssignModal
          isOpen
          onClose={() => setIsRouteAssignModalOpen(false)}
          route={assigningRoute}
          employees={employees}
          vehicles={vehicles}
          allRoutes={routes}
          onSave={handleSaveRouteCrew}
        />
      )}

      {/* Slide-over Drawer for school details */}
      <SchoolDetailDrawer
        school={selectedSchool}
        onClose={() => setSelectedSchool(null)}
        onEdit={handleEditSchool}
        onDelete={handleDeleteSchool}
        onViewStudents={() => {
          setSelectedSchool(null);
          setCurrentTab('students');
        }}
      />

      {/* Modal for creating / editing school records */}
      <SchoolModal
        isOpen={isSchoolModalOpen}
        onClose={() => setIsSchoolModalOpen(false)}
        onSave={handleSaveSchool}
        initialData={editingSchool}
        boards={boards}
      />

      {/* Modal for creating / editing school board records */}
      <SchoolBoardModal
        isOpen={isBoardModalOpen}
        onClose={() => setIsBoardModalOpen(false)}
        onSave={handleSaveBoard}
        initialData={editingBoard}
      />

      {/* Modal for creating / editing student records */}
      <ErrorBoundary fallbackTitle="Student Modal Error">
        <StudentModal
          isOpen={isStudentModalOpen}
          onClose={() => setIsStudentModalOpen(false)}
          onSave={handleSaveStudent}
          initialData={editingStudent}
          schools={schools}
          initialTab={studentModalInitialTab}
        />
      </ErrorBoundary>

      {/* Global PWA Install Banner */}
      <PWAInstallBanner />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenMore={() => setIsMobileDrawerOpen(true)}
        hasComplianceAlerts={stats.licenseExpiringSoon > 0}
      />

      {/* Mobile Navigation Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        expiringLicenseCount={stats.licenseExpiringSoon}
      />

      {/* Floating In-App Toast Alert */}
      {activeAlert && (
        <div className="fixed top-20 right-6 z-50 max-w-sm w-full bg-slate-900 border-2 border-amber-500/90 rounded-2xl p-3.5 shadow-2xl text-slate-100 flex items-start space-x-3 animate-in slide-in-from-top-3 duration-200">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-amber-500/30">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-xs text-amber-400 truncate">{activeAlert.senderName}</h4>
              <button onClick={dismissAlert} className="text-slate-400 hover:text-white p-0.5" title="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 truncate">{activeAlert.channelName}</p>
            <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed">{activeAlert.text}</p>
            <button
              onClick={() => {
                setChatInitialTargetUserId(null);
                setIsChatOpen(true);
                clearUnread();
                dismissAlert();
              }}
              className="mt-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
            >
              <span>Open Conversation</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Operations Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          clearUnread();
        }}
        initialTargetUserId={chatInitialTargetUserId}
        onClearInitialTarget={() => setChatInitialTargetUserId(null)}
        initialParentMetadata={chatInitialParent}
        onClearInitialParentMetadata={() => setChatInitialParent(null)}
      />

      {aiCopilotMounted && (
        <Suspense fallback={null}>
          <AICopilotDrawer
            isOpen={isAICopilotOpen}
            onClose={() => setIsAICopilotOpen(false)}
            currentDate={dispatchLogDate}
            onShiftUpdated={() => {
              handleRouteRefresh();
            }}
            onNavigateToChangeLog={(date) => {
              if (date) setDispatchLogDate(date);
              setCurrentTab('dispatch_log');
              setIsAICopilotOpen(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Application Error">
      <AppContent />
    </ErrorBoundary>
  );
}
