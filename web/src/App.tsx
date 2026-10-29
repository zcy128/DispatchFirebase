import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Header } from './components/common/Header';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { DashboardView } from './views/DashboardView';
import { EmployeeListView } from './views/EmployeeListView';
import { StudentListView } from './views/StudentListView';
import { RouteListView } from './views/RouteListView';
import { StagingRouteListView } from './views/StagingRouteListView';
import { VehicleListView } from './views/VehicleListView';
import { ComplianceView } from './views/ComplianceView';
import { SettingsView } from './views/SettingsView';
import { ExternalSyncView } from './views/ExternalSyncView';
import { LoginView } from './views/LoginView';
import { EmployeeDetailDrawer } from './components/employees/EmployeeDetailDrawer';
import { EmployeeModal } from './components/employees/EmployeeModal';
import { StudentDetailDrawer } from './components/students/StudentDetailDrawer';
import { StudentModal } from './components/students/StudentModal';
import { RouteDetailDrawer } from './components/routes/RouteDetailDrawer';
import { VehicleDetailDrawer } from './components/vehicles/VehicleDetailDrawer';
import { VehicleModal } from './components/vehicles/VehicleModal';
import { SchoolListView } from './views/SchoolListView';
import { SchoolCalendarView } from './views/SchoolCalendarView';
import { PayrollRateView } from './views/PayrollRateView';
import { BiweeklyPayrollView } from './views/BiweeklyPayrollView';
import { PayrollDepartmentLogView } from './views/PayrollDepartmentLogView';
import { DispatchDailyPayrollTab } from './components/payroll/DispatchDailyPayrollTab';
import { RoleManagementView } from './views/RoleManagementView';
import { CompanyContactsView } from './views/CompanyContactsView';
import { LoginLogsView } from './views/LoginLogsView';
import { AuditLogsView } from './views/AuditLogsView';
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
import { Employee, DashboardStats } from './types/employee';
import { Student, StudentStats } from './types/student';
import { School, SchoolBoard, SchoolStats } from './types/school';
import { BusRoute, RouteStats } from './types/route';
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
import { DispatchWorkbenchView } from './views/DispatchWorkbenchView';
import { CharterManagementView } from './views/CharterManagementView';
import { DispatchChangeLogView } from './views/DispatchChangeLogView';
import { TemporaryAssignmentsView } from './views/TemporaryAssignmentsView';
import { AssignmentTrackingView } from './views/AssignmentTrackingView';
import { TimeOffView } from './views/TimeOffView';
import { TrainingView } from './views/TrainingView';
import { DefectReportsView } from './views/DefectReportsView';
import { StudentIncidentsView } from './views/StudentIncidentsView';
import { StudentAbsencesView } from './views/StudentAbsencesView';
import { ExpenseReimbursementsView } from './views/ExpenseReimbursementsView';
import { HazardReportsView } from './views/HazardReportsView';
import { RouteAssessmentsView } from './views/RouteAssessmentsView';
import { VehicleSignoutView } from './views/VehicleSignoutView';
import { VehicleInspectionsView } from './views/VehicleInspectionsView';
import { PreTripInspectionsView } from './views/PreTripInspectionsView';
import { BottomNav } from './components/common/BottomNav';
import { MobileDrawer } from './components/common/MobileDrawer';
import { getLocalTodayString } from './utils/dateUtils';
import { EntityOperationLogService } from './services/entityOperationLogService';
import { EntityOperationActor, EntityFieldDiff } from './types/entityOperationLog';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { AICopilotDrawer } from './components/ai/AICopilotDrawer';
import { useChatNotifications } from './hooks/useChatNotifications';
import { MessageSquare, X, ArrowRight } from 'lucide-react';
import { CreateParentChannelPayload } from './types/chat';

export const AppContent: React.FC = () => {
  const { currentUser, loading: authLoading } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const mainRef = useRef<HTMLElement>(null);
  const [dispatchLogDate, setDispatchLogDate] = useState<string>(() => getLocalTodayString());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'ai' || params.get('ai') === '1';
    }
    return false;
  });
  const [chatInitialTargetUserId, setChatInitialTargetUserId] = useState<string | null>(null);
  const [chatInitialParent, setChatInitialParent] = useState<CreateParentChannelPayload | null>(null);

  const handleOpenParentChat = (payload: CreateParentChannelPayload) => {
    setChatInitialParent(payload);
    setIsChatOpen(true);
  };

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [currentTab]);

  // Global shortcut (Ctrl+J / Cmd+J) to toggle AI Copilot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsAICopilotOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentUserId = currentUser?.employeeId || currentUser?.uid || 'EMP-ADMIN-001';
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
  const [schoolStats, setSchoolStats] = useState<SchoolStats>({
    totalSchools: 0,
    activeSchools: 0,
    totalBoards: 0,
    totalStudents: 0,
    boardDistribution: {}
  });
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

  // Dynamic Single Source of Truth lookup map for Student Contacts
  const studentsMap = React.useMemo(() => {
    const map: Record<number, Student> = {};
    for (const s of students) {
      map[s.studentId] = s;
    }
    return map;
  }, [students]);

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
  const handleManualSync = async () => {
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
  };

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

  const handleRouteRefresh = async () => {
    try {
      const rtList = await RouteService.list();
      setRoutes(rtList);
      setRouteStats(calculateRouteStats(rtList));
    } catch (err) {
      console.error("Route manual sync error:", err);
    }
  };

  const handleVehicleRefresh = async () => {
    try {
      const vehList = await VehicleService.list();
      setVehicles(vehList);
      setVehicleStats(calculateVehicleStats(vehList));
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
          setEmployees(realtimeList);
          setStats(calculateStats(realtimeList));
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
          setSchoolStats(calculateSchoolStats(schList, boards));
        },
        (error) => {
          console.warn("Realtime Firestore school notice:", error);
        }
      );

      // Real-time Firestore onSnapshot listener for School Boards
      const unsubBoards = SchoolService.subscribeToSchoolBoards(
        (brdList) => {
          setBoards(brdList);
          setSchoolStats(calculateSchoolStats(schools, brdList));
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
        (vehList) => {
          setVehicles(vehList);
          setVehicleStats(calculateVehicleStats(vehList));
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
  }, [currentUser]);

  // RBAC Permission Guard: ensure user is directed to an authorized tab
  useEffect(() => {
    if (currentUser) {
      const matchedEmp = employees.find(
        (e) =>
          (e.id && e.id === currentUser.employeeId) ||
          (e.employeeNumber && e.employeeNumber === currentUser.employeeId) ||
          (e.workEmail && e.workEmail.toLowerCase() === currentUser.email?.toLowerCase()) ||
          (e.username && `${e.username}@dispatch.pcy.ca` === currentUser.email?.toLowerCase())
      );
      if (matchedEmp) {
        if (matchedEmp.role && matchedEmp.role !== currentUser.role) {
          currentUser.role = matchedEmp.role;
        }
        if (matchedEmp.pagePermissions) {
          currentUser.overrides = matchedEmp.pagePermissions;
        }
        if (matchedEmp.yardId) {
          currentUser.yardId = matchedEmp.yardId;
        }
      }

      if (!hasPageAccess(currentUser, currentTab)) {
        const allTabs: NavTab[] = [
          'dashboard', 'dispatch', 'routes', 'staging_routes', 'dispatch_payroll',
          'employees', 'time_off', 'payroll', 'biweekly_payroll', 'payroll_dept_log',
          'temporary_assignments', 'dispatch_log', 'assignment_history',
          'vehicles', 'defects', 'vehicle_signouts', 'yards',
          'compliance', 'training', 'students', 'student_incidents',
          'hazards', 'route_assessments', 'schools', 'calendar',
          'expenses', 'company_contacts', 'roles', 'login_logs',
          'audit_logs', 'external_sync', 'settings'
        ];
        const allowedTab = allTabs.find((t) => hasPageAccess(currentUser, t));
        if (allowedTab) {
          setCurrentTab(allowedTab);
        }
      }
    }
  }, [currentUser, currentTab, employees]);

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

  const handleCreateEmployee = () => {
    setEditingEmployee(null);
    setEmployeeModalInitialTab('profile');
    setIsModalOpen(true);
  };

  const handleEditEmployee = (
    emp: Employee,
    initialTab: 'profile' | 'permissions' | 'contact' | 'license' | 'emergency' = 'profile'
  ) => {
    setEditingEmployee(emp);
    setEmployeeModalInitialTab(initialTab);
    setIsModalOpen(true);
    setSelectedEmployee(null);
  };

  const handleQuickReassignRole = async (employeeId: string, newRole: any) => {
    const emp = employees.find((e) => e.id === employeeId || e.employeeNumber === employeeId);
    if (!emp) return;
    const updated = await EmployeeService.update(emp.id, { role: newRole });
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    const newStats = await EmployeeService.getStats();
    setStats(newStats);
  };

  const handleSaveEmployee = async (data: Partial<Employee>) => {
    if (editingEmployee) {
      const updated = await EmployeeService.update(editingEmployee.id, data);
      setEmployees(employees.map((e) => (e.id === updated.id ? updated : e)));
    } else {
      const created = await EmployeeService.create(data);
      setEmployees([created, ...employees]);
    }
    const newStats = await EmployeeService.getStats();
    setStats(newStats);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete employee #${id}?`)) return;
    await EmployeeService.delete(id);
    setEmployees(employees.filter((e) => e.id !== id && e.employeeNumber !== id));
    setSelectedEmployee(null);
    const newStats = await EmployeeService.getStats();
    setStats(newStats);
  };

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
      setVehicles((prev) => [created, ...prev]);

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

  const handleOpenAssignCrew = (route: BusRoute) => {
    setAssigningRoute(route);
    setIsRouteAssignModalOpen(true);
  };

  const handleSaveRouteCrew = async (routeId: string, payload: any) => {
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
      setSchoolStats(calculateSchoolStats(schList, brdList));
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
      setSchools((prev) => [created, ...prev]);
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
      setBoards((prev) => [...prev, created]);
    }
  };

  const handleCreateStudent = () => {
    setEditingStudent(null);
    setIsStudentModalOpen(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
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
      setStudentStats(calculateStudentStats(newStudents));

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
      setStudentStats(calculateStudentStats(newStudents));

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
      setStudentStats(calculateStudentStats(newStudents));
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
        onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
        onOpenChat={() => {
          setIsChatOpen(true);
          clearUnread();
        }}
        chatUnreadCount={unreadCount}
        onOpenAICopilot={() => setIsAICopilotOpen((prev) => !prev)}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          expiringLicenseCount={stats.licenseExpiringSoon}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto bg-slate-950/80 pb-20 md:pb-6">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              employees={employees}
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
              onEditStudent={handleEditStudent}
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
              onSelectStudent={(stuId) => {
                const stu = studentsMap[stuId];
                if (stu) {
                  setSelectedStudent(stu);
                }
              }}
            />
          )}

          {currentTab === 'dispatch' && (
            <DispatchWorkbenchView
              employees={employees}
              vehicles={vehicles}
              yards={yards}
              studentsMap={studentsMap}
              onNavigateToChangeLog={(date) => {
                if (date) setDispatchLogDate(date);
                setCurrentTab('dispatch_log');
              }}
              onNavigateToTemporaryAssignments={() => {
                setCurrentTab('temporary_assignments');
              }}
              onNavigateToAbsences={() => {
                setCurrentTab('student_absences');
              }}
              onMessageDriver={(driverId) => {
                setChatInitialTargetUserId(driverId);
                setIsChatOpen(true);
              }}
            />
          )}

          {currentTab === 'charter' && (
            <CharterManagementView
              employees={employees}
              vehicles={vehicles}
              schools={schools}
              onNavigateToPayroll={() => {
                setCurrentTab('dispatch_payroll');
              }}
            />
          )}

          {currentTab === 'dispatch_payroll' && (
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
              <DispatchDailyPayrollTab
                onNavigateToFinanceLog={() => {
                  setCurrentTab('payroll_dept_log');
                }}
              />
            </div>
          )}

          {currentTab === 'dispatch_log' && (
            <DispatchChangeLogView
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
              onNavigateToTemporaryAssignments={() => {
                setCurrentTab('temporary_assignments');
              }}
            />
          )}

          {currentTab === 'training' && (
            <TrainingView employees={employees} />
          )}

          {currentTab === 'defects' && (
            <DefectReportsView />
          )}

          {currentTab === 'student_incidents' && (
            <StudentIncidentsView />
          )}

          {currentTab === 'expenses' && (
            <ExpenseReimbursementsView />
          )}

          {currentTab === 'hazards' && (
            <HazardReportsView />
          )}

          {currentTab === 'route_assessments' && (
            <RouteAssessmentsView />
          )}

          {currentTab === 'vehicle_signouts' && (
            <VehicleSignoutView />
          )}

          {currentTab === 'staging_routes' && <StagingRouteListView />}

          {currentTab === 'routes' && (
            <RouteListView
              routes={routes}
              stats={routeStats}
              studentsMap={studentsMap}
              loading={dataLoading}
              onSelectRoute={setSelectedRoute}
              onSelectStudent={setSelectedStudent}
              onAssignCrew={handleOpenAssignCrew}
              onRefresh={handleRouteRefresh}
              onRouteUpdated={(updatedRoute) => {
                setRoutes((prev) => prev.map((r) => r.id === updatedRoute.id ? updatedRoute : r));
                if (selectedRoute && selectedRoute.id === updatedRoute.id) {
                  setSelectedRoute(updatedRoute);
                }
              }}
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
            <PreTripInspectionsView />
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
            />
          )}

          {currentTab === 'biweekly_payroll' && (
            <BiweeklyPayrollView />
          )}

          {currentTab === 'payroll_dept_log' && (
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
              <PayrollDepartmentLogView />
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

          {currentTab === 'external_sync' && <ExternalSyncView />}

          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Slide-over Drawer for employee details */}
      <EmployeeDetailDrawer
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        onEdit={handleEditEmployee}
        onDelete={handleDeleteEmployee}
      />

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
        onAssignCrew={handleOpenAssignCrew}
        onRouteUpdated={(updatedRoute) => {
          setSelectedRoute(updatedRoute);
          setRoutes((prev) => prev.map((r) => r.id === updatedRoute.id ? updatedRoute : r));
        }}
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
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEmployee}
        initialData={editingEmployee}
        initialTab={employeeModalInitialTab}
      />

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
      <RouteAssignModal
        isOpen={isRouteAssignModalOpen}
        onClose={() => setIsRouteAssignModalOpen(false)}
        route={assigningRoute}
        employees={employees}
        vehicles={vehicles}
        allRoutes={routes}
        onSave={handleSaveRouteCrew}
      />

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

      {/* AI Dispatch Copilot Drawer */}
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
