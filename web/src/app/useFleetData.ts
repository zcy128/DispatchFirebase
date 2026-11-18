import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CalendarService } from '../services/calendarService';
import { CompanyContact, CompanyContactsService } from '../services/companyContactsService';
import { calculateStats, EmployeeService } from '../services/employeeService';
import { PayrollService } from '../services/payrollService';
import { calculateRouteStats, RouteService } from '../services/routeService';
import { calculateSchoolStats, SchoolService } from '../services/schoolService';
import { calculateStudentStats, StudentService } from '../services/studentService';
import { calculateVehicleStats, VehicleService } from '../services/vehicleService';
import { YardService } from '../services/yardService';
import { SchoolCalendar } from '../types/calendar';
import { DashboardStats, Employee } from '../types/employee';
import { BusRoutePayrollRate, SchoolBoardBaseRatesDTO } from '../types/payroll';
import { BusRoute, RouteStats } from '../types/route';
import { School, SchoolBoard } from '../types/school';
import { Student, StudentStats } from '../types/student';
import { Vehicle, VehicleStats } from '../types/vehicle';
import { Yard } from '../types/yard';
import { hasPageAccess, initCloudRolePermissionsListener } from '../utils/permissions';

type AuthContextValue = ReturnType<typeof useAuth>;

interface UseFleetDataParams {
  currentUser: AuthContextValue['currentUser'];
  updateCurrentUser: AuthContextValue['updateCurrentUser'];
}

/**
 * Manages real-time Firestore/API fleet master data subscriptions, stats, and manual refresh actions.
 */
export function useFleetData({ currentUser, updateCurrentUser }: UseFleetDataParams) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const employeesRef = useRef(employees);
  employeesRef.current = employees;

  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    totalDrivers: 0,
    licenseExpiringSoon: 0,
    yardDistribution: {},
    timestamp: new Date().toISOString(),
  });
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  const [students, setStudents] = useState<Student[]>([]);
  const studentsRef = useRef(students);
  studentsRef.current = students;

  const [schools, setSchools] = useState<School[]>([]);
  const schoolsRef = useRef(schools);
  schoolsRef.current = schools;

  const [boards, setBoards] = useState<SchoolBoard[]>([]);
  const schoolStats = useMemo(() => calculateSchoolStats(schools, boards), [schools, boards]);

  const [studentStats, setStudentStats] = useState<StudentStats>({
    totalStudents: 0,
    activeStudents: 0,
    metAtBusCount: 0,
    routesCovered: 0,
    gradeDistribution: {},
    schoolDistribution: {},
  });

  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [routeStats, setRouteStats] = useState<RouteStats>({
    totalRoutes: 0,
    activeRoutes: 0,
    assignedDrivers: 0,
    totalStops: 0,
    totalStudents: 0,
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;

  const [vehicleStats, setVehicleStats] = useState<VehicleStats>({
    totalVehicles: 0,
    activeVehicles: 0,
    assignedToRoutes: 0,
    spareVehicles: 0,
    wheelchairAccessible: 0,
    typeDistribution: {},
    fuelDistribution: {},
    yardDistribution: {},
  });
  const [vehicleSyncSource, setVehicleSyncSource] = useState<'firestore' | 'api'>('api');

  const [yards, setYards] = useState<Yard[]>([]);
  const [schoolCalendars, setSchoolCalendars] = useState<SchoolCalendar[]>([]);
  const [payrollBoardRates, setPayrollBoardRates] = useState<SchoolBoardBaseRatesDTO[]>(() =>
    PayrollService.getCachedBoardRates()
  );
  const [payrollRates, setPayrollRates] = useState<BusRoutePayrollRate[]>(() =>
    PayrollService.getCachedCustomRates()
  );
  const [companyContacts, setCompanyContacts] = useState<CompanyContact[]>([]);

  const studentsMap = useMemo(() => {
    const map: Record<number, Student> = {};
    for (const s of students) {
      map[s.studentId] = s;
    }
    return map;
  }, [students]);

  const handleManualSync = useCallback(async () => {
    setDataLoading(true);
    try {
      const [empList, dashboardStats] = await Promise.all([
        EmployeeService.list(),
        EmployeeService.getStats(),
      ]);
      setEmployees(empList);
      setStats(dashboardStats);
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const handleStudentsLoaded = useCallback((loadedStudents: Student[]) => {
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

  const handleStudentRefresh = useCallback(async () => {
    try {
      const [stuList, schList] = await Promise.all([
        StudentService.list(),
        SchoolService.list(),
      ]);
      setStudents(stuList);
      setSchools(schList);
      setStudentStats(calculateStudentStats(stuList));
    } catch (err) {
      console.error('Student manual sync error:', err);
    }
  }, []);

  const handleRouteRefresh = useCallback(async () => {
    try {
      const rtList = await RouteService.list();
      setRoutes(rtList);
      setRouteStats(calculateRouteStats(rtList));
    } catch (err) {
      console.error('Route manual sync error:', err);
    }
  }, []);

  const handleVehicleRefresh = useCallback(async () => {
    try {
      const vehList = await VehicleService.list();
      const safeVehicles = Array.isArray(vehList) ? vehList : [];
      setVehicles(safeVehicles);
      setVehicleStats(calculateVehicleStats(safeVehicles));
    } catch (err) {
      console.error('Vehicle manual sync error:', err);
    }
  }, []);

  const handleYardRefresh = useCallback(async () => {
    try {
      const yardList = await YardService.list();
      setYards(yardList);
    } catch (err) {
      console.error('Yard manual sync error:', err);
    }
  }, []);

  const handleSchoolRefresh = useCallback(async () => {
    try {
      const [schList, brdList] = await Promise.all([
        SchoolService.list(),
        SchoolService.listBoards(),
      ]);
      setSchools(schList);
      setBoards(brdList);
    } catch (err) {
      console.error('School manual sync error:', err);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = initCloudRolePermissionsListener();
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    setDataLoading(true);
    let isResolved = false;

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
        console.warn('Realtime Firestore employee notice:', error);
        if (!isResolved) {
          void handleManualSync();
        }
      }
    );

    const unsubSchools = SchoolService.subscribeToSchools(
      (schList) => setSchools(schList),
      (error) => console.warn('Realtime Firestore school notice:', error)
    );

    const unsubBoards = SchoolService.subscribeToSchoolBoards(
      (brdList) => setBoards(brdList),
      (error) => console.warn('Realtime Firestore school board notice:', error)
    );

    StudentService.getStats()
      .then((s) => setStudentStats(s))
      .catch((error) => console.warn('Initial student stats notice:', error));

    const unsubRoutes = RouteService.subscribeToRoutes(
      (rtList) => {
        setRoutes(rtList);
        setRouteStats(calculateRouteStats(rtList));
      },
      (error) => console.warn('Realtime Firestore route notice:', error)
    );

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
      (error) => console.warn('Realtime Firestore vehicle notice:', error)
    );

    const unsubYards = YardService.subscribeToYards(
      (yardList) => setYards(yardList),
      (error) => console.warn('Realtime Firestore yard notice:', error)
    );

    const unsubContacts = CompanyContactsService.subscribeToCompanyContacts(
      (contactList) => setCompanyContacts(contactList),
      (error) => console.warn('Realtime Firestore company contacts notice:', error)
    );

    const unsubCalendars = CalendarService.subscribeToAllCalendars(
      (calList) => setSchoolCalendars(calList),
      (error) => console.warn('Realtime Firestore calendar notice:', error)
    );

    let unsubPayrollRates: (() => void) | undefined;
    if (
      currentUser.role === 'admin' ||
      currentUser.role === 'payroll' ||
      currentUser.role === 'manager' ||
      hasPageAccess(currentUser, 'payroll')
    ) {
      unsubPayrollRates = PayrollService.subscribeToPayrollRates(
        (rateList) => setPayrollRates(rateList),
        (error) => console.warn('Realtime Firestore payroll rates notice:', error)
      );

      PayrollService.getSchoolBoardBaseRates()
        .then((rates) => {
          if (rates && rates.length > 0) {
            setPayrollBoardRates(rates);
          }
        })
        .catch((e) => console.warn('Payroll board rates pre-load notice:', e));
    }

    const failsafe = setTimeout(() => {
      if (!isResolved) {
        void handleManualSync();
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
  }, [currentUser?.uid, currentUser?.employeeId, handleManualSync]);

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
  }, [currentUser, employees, updateCurrentUser]);

  return {
    employees,
    setEmployees,
    employeesRef,
    stats,
    dataLoading,
    students,
    setStudents,
    studentsRef,
    studentsMap,
    studentStats,
    setStudentStats,
    schools,
    setSchools,
    schoolsRef,
    boards,
    setBoards,
    schoolStats,
    routes,
    setRoutes,
    routeStats,
    vehicles,
    setVehicles,
    vehiclesRef,
    vehicleStats,
    setVehicleStats,
    vehicleSyncSource,
    yards,
    schoolCalendars,
    payrollBoardRates,
    setPayrollBoardRates,
    payrollRates,
    companyContacts,
    handleManualSync,
    handleStudentsLoaded,
    handleStudentRefresh,
    handleRouteRefresh,
    handleVehicleRefresh,
    handleYardRefresh,
    handleSchoolRefresh,
  };
}
