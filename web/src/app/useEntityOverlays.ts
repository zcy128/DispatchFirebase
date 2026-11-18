import { useCallback, useRef, useState } from 'react';
import { StudentModalTab } from '../components/students/StudentModal';
import { useAuth } from '../contexts/AuthContext';
import { EmployeeService } from '../services/employeeService';
import { EntityOperationLogService } from '../services/entityOperationLogService';
import { RouteService } from '../services/routeService';
import { SchoolService } from '../services/schoolService';
import { StudentService } from '../services/studentService';
import { VehicleService } from '../services/vehicleService';
import { Employee, UserRole } from '../types/employee';
import { EntityFieldDiff, EntityOperationActor } from '../types/entityOperationLog';
import { AssignRouteCrewPayload, BusRoute } from '../types/route';
import { School, SchoolBoard } from '../types/school';
import { Student } from '../types/student';
import { Vehicle } from '../types/vehicle';
import { EmployeeModalTab } from './GlobalEntityOverlays';
import { useFleetData } from './useFleetData';

type AuthUser = ReturnType<typeof useAuth>['currentUser'];
type FleetDataState = ReturnType<typeof useFleetData>;

interface UseEntityOverlaysParams {
  currentUser: AuthUser;
  fleet: FleetDataState;
}

function buildOperationActor(currentUser: AuthUser): EntityOperationActor {
  return {
    userId: currentUser?.employeeId || currentUser?.uid || 'usr-dispatch',
    userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
    userEmail: currentUser?.email || undefined,
    userRole: currentUser?.role || 'dispatcher',
  };
}

/**
 * Manages global entity detail drawers, CRUD modals, cross-view entity lookups, and mutations.
 */
export function useEntityOverlays({ currentUser, fleet }: UseEntityOverlaysParams) {
  const {
    employeesRef,
    setEmployees,
    students,
    setStudents,
    studentsRef,
    setStudentStats,
    schoolsRef,
    setSchools,
    setBoards,
    setRoutes,
    vehiclesRef,
    setVehicles,
    setVehicleStats,
  } = fleet;

  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState<boolean>(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isBoardModalOpen, setIsBoardModalOpen] = useState<boolean>(false);
  const [editingBoard, setEditingBoard] = useState<SchoolBoard | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDrawerInitialTab, setStudentDrawerInitialTab] = useState<'profile' | 'stops'>('profile');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentModalInitialTab, setStudentModalInitialTab] = useState<StudentModalTab>('profile');

  const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
  const [isRouteAssignModalOpen, setIsRouteAssignModalOpen] = useState<boolean>(false);
  const [assigningRoute, setAssigningRoute] = useState<BusRoute | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeModalInitialTab, setEmployeeModalInitialTab] = useState<EmployeeModalTab>('profile');

  const studentDetailRequest = useRef(0);
  const employeeDetailRequest = useRef(0);
  const vehicleDetailRequest = useRef(0);

  const openStudentDetailsByRef = useCallback(
    (ref: { id?: string; name?: string; initialTab?: 'profile' | 'stops' }) => {
      const id = ref.id?.trim() || '';
      const name = ref.name?.trim() || '';
      const nameLower = name.toLowerCase();
      if (!id && !name) return;
      setStudentDrawerInitialTab(ref.initialTab || 'profile');

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

      const cached =
        studentsRef.current.find(matchStudent) ||
        (nameLower
          ? studentsRef.current.find((student) =>
              studentFullName(student).toLowerCase().includes(nameLower)
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
            : [...prev.filter((item) => item.id !== student.id), student]
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

      if (hasNumericId && !name) {
        void StudentService.getByStudentId(numericId)
          .then((stu) => finish(stu))
          .catch(() => searchThenMaybeId());
        return;
      }

      searchThenMaybeId();
    },
    [studentsRef, setStudents]
  );

  const openStudentDetails = useCallback(
    (studentId: number, initialTab: 'profile' | 'stops' = 'profile') => {
      if (!studentId) return;
      openStudentDetailsByRef({ id: String(studentId), initialTab });
    },
    [openStudentDetailsByRef]
  );

  const openSchoolDetails = useCallback(
    (schoolId?: number, schoolName?: string) => {
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
              (school.schoolName || '').toLowerCase().includes(nameLower)
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
    },
    [schoolsRef, setSchools]
  );

  const openEmployeeDetails = useCallback(
    (employeeId?: string, employeeName?: string) => {
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
    },
    [employeesRef]
  );

  const openVehicleDetails = useCallback(
    (vehicleId?: number, unitNumber?: string) => {
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
    },
    [vehiclesRef]
  );

  const closeEmployeeDrawer = useCallback(() => setSelectedEmployee(null), []);
  const closeEmployeeModal = useCallback(() => setIsEmployeeModalOpen(false), []);

  const handleCreateEmployee = useCallback(() => {
    setEditingEmployee(null);
    setEmployeeModalInitialTab('profile');
    setIsEmployeeModalOpen(true);
  }, []);

  const handleEditEmployee = useCallback(
    (emp: Employee, initialTab: EmployeeModalTab = 'profile') => {
      setEditingEmployee(emp);
      setEmployeeModalInitialTab(initialTab);
      setIsEmployeeModalOpen(true);
      setSelectedEmployee(null);
    },
    []
  );

  const handleQuickReassignRole = useCallback(
    async (employeeId: string, newRole: UserRole) => {
      const emp = employeesRef.current.find(
        (e) => e.id === employeeId || e.employeeNumber === employeeId
      );
      if (!emp) return;
      const updated = await EmployeeService.update(emp.id, { role: newRole });
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    },
    [employeesRef, setEmployees]
  );

  const handleSaveEmployee = useCallback(
    async (data: Partial<Employee>) => {
      if (editingEmployee) {
        const updated = await EmployeeService.update(editingEmployee.id, data);
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === updated.id ||
            (updated.employeeNumber && e.employeeNumber === updated.employeeNumber)
              ? updated
              : e
          )
        );
        return;
      }
      const created = await EmployeeService.create(data);
      setEmployees((prev) => {
        const withoutNew = prev.filter(
          (e) =>
            e.id !== created.id &&
            (!created.employeeNumber || e.employeeNumber !== created.employeeNumber)
        );
        return [created, ...withoutNew];
      });
    },
    [editingEmployee, setEmployees]
  );

  const handleDeleteEmployee = useCallback(
    async (id: string) => {
      if (!window.confirm(`Are you sure you want to delete employee #${id}?`)) return;
      await EmployeeService.delete(id);
      setEmployees((prev) => prev.filter((e) => e.id !== id && e.employeeNumber !== id));
      setSelectedEmployee(null);
    },
    [setEmployees]
  );

  const handleRouteUpdated = useCallback((updatedRoute: BusRoute) => {
    setRoutes((prev) => prev.map((route) => (route.id === updatedRoute.id ? updatedRoute : route)));
    setSelectedRoute((current) => (current && current.id === updatedRoute.id ? updatedRoute : current));
  }, [setRoutes]);

  const handleOpenAssignCrew = useCallback((route: BusRoute) => {
    setAssigningRoute(route);
    setIsRouteAssignModalOpen(true);
  }, []);

  const handleSaveRouteCrew = async (routeId: string, payload: AssignRouteCrewPayload) => {
    const updated = await RouteService.assignCrew(routeId, payload);
    setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedRoute && selectedRoute.id === updated.id) {
      setSelectedRoute(updated);
    }
    const newVehStats = await VehicleService.getStats();
    setVehicleStats(newVehStats);
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
    const actor = buildOperationActor(currentUser);

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
        actor,
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
        { field: 'status', fieldLabel: 'Fleet Status', oldValue: undefined, newValue: created.status },
      ];

      EntityOperationLogService.logOperation({
        targetType: 'vehicle',
        targetId: created.id,
        targetIdentifier: created.unitNumber,
        targetName: `${created.manufacturer || ''} ${created.model || ''} (${created.plateNumber || 'No Plate'})`.trim(),
        action: 'create',
        summary: `Registered new fleet vehicle Unit #${created.unitNumber} (${created.manufacturer} ${created.model})`,
        diffs,
        actor,
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

    const actor = buildOperationActor(currentUser);

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
          { field: 'active', fieldLabel: 'Active Flag', oldValue: veh.active, newValue: false },
        ],
        actor,
        metadata: { deletedSnapshot: veh },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Delete vehicle failed:', err);
      alert(`Failed to delete vehicle: ${msg}`);
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

  const handleEditStudentById = (studentId: number, initialTab: StudentModalTab = 'stops') => {
    if (!studentId) return;
    const cached = studentsRef.current.find((s) => Number(s.studentId) === Number(studentId));
    if (cached) {
      handleEditStudent(cached, initialTab);
      return;
    }
    void StudentService.getByStudentId(studentId)
      .then((stu) => {
        if (stu) handleEditStudent(stu, initialTab);
      })
      .catch(() => {});
  };

  const handleSaveStudent = async (data: Partial<Student>) => {
    const actor = buildOperationActor(currentUser);

    if (editingStudent) {
      const updated = await StudentService.update(editingStudent.id, data);
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
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
        actor,
      }).catch((e) => console.warn('Student update audit log failed:', e));
    } else {
      const created = await StudentService.create(data);
      setStudents((prev) => [created, ...prev]);
      void StudentService.getStats()
        .then(setStudentStats)
        .catch((error) => console.warn('Student stats refresh failed:', error));

      const diffs: EntityFieldDiff[] = [
        { field: 'fullName', fieldLabel: 'Student Name', oldValue: undefined, newValue: created.fullName || created.studentName },
        { field: 'studentNo', fieldLabel: 'Student Number', oldValue: undefined, newValue: created.studentNo },
        { field: 'schoolName', fieldLabel: 'School', oldValue: undefined, newValue: created.schoolName },
        { field: 'grade', fieldLabel: 'Grade', oldValue: undefined, newValue: created.grade },
        { field: 'routes', fieldLabel: 'Assigned Routes', oldValue: undefined, newValue: created.routes || 'None' },
      ];

      EntityOperationLogService.logOperation({
        targetType: 'student',
        targetId: created.id,
        targetIdentifier: created.studentNo,
        targetName: created.fullName || created.studentName,
        action: 'create',
        summary: `Created new student profile for ${created.fullName || created.studentName} (#${created.studentNo}) at ${created.schoolName}`,
        diffs,
        actor,
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

    const actor = buildOperationActor(currentUser);

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
          { field: 'schoolName', fieldLabel: 'School', oldValue: student.schoolName, newValue: 'Removed' },
        ],
        actor,
        metadata: { deletedSnapshot: student },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Delete student failed:', err);
      alert(`Failed to delete student: ${msg}`);
    }
  };

  return {
    selectedEmployee,
    setSelectedEmployee,
    isEmployeeModalOpen,
    editingEmployee,
    employeeModalInitialTab,
    closeEmployeeDrawer,
    closeEmployeeModal,
    handleCreateEmployee,
    handleEditEmployee,
    handleSaveEmployee,
    handleDeleteEmployee,
    handleQuickReassignRole,
    selectedStudent,
    setSelectedStudent,
    studentDrawerInitialTab,
    isStudentModalOpen,
    setIsStudentModalOpen,
    editingStudent,
    studentModalInitialTab,
    handleCreateStudent,
    handleEditStudent,
    handleEditStudentById,
    handleSaveStudent,
    handleDeleteStudent,
    selectedRoute,
    setSelectedRoute,
    isRouteAssignModalOpen,
    setIsRouteAssignModalOpen,
    assigningRoute,
    handleOpenAssignCrew,
    handleSaveRouteCrew,
    handleRouteUpdated,
    selectedVehicle,
    setSelectedVehicle,
    isVehicleModalOpen,
    setIsVehicleModalOpen,
    editingVehicle,
    handleCreateVehicle,
    handleEditVehicle,
    handleSaveVehicle,
    handleDeleteVehicle,
    selectedSchool,
    setSelectedSchool,
    isSchoolModalOpen,
    setIsSchoolModalOpen,
    editingSchool,
    handleCreateSchool,
    handleEditSchool,
    handleSaveSchool,
    handleDeleteSchool,
    isBoardModalOpen,
    setIsBoardModalOpen,
    editingBoard,
    handleCreateBoard,
    handleEditBoard,
    handleSaveBoard,
    openStudentDetailsByRef,
    openStudentDetails,
    openSchoolDetails,
    openEmployeeDetails,
    openVehicleDetails,
  };
}
