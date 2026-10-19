import React, { useState, useEffect } from 'react';
import { BusRoute, AssignRouteCrewPayload, BusRouteShift } from '../../types/route';
import { RouteService } from '../../services/routeService';
import { Employee } from '../../types/employee';
import { Vehicle } from '../../types/vehicle';
import {
  X,
  User,
  Bus,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Home,
  Navigation,
  Zap
} from 'lucide-react';
import { AssignmentHistoryService } from '../../services/assignmentHistoryService';
import { RouteAuditService } from '../../services/routeAuditService';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import {
  sortDriversByDeadhead,
  sortAttendantsByDeadhead,
  calculateDriverDeadhead,
  calculateAttendantDeadhead
} from '../../utils/deadheadCalculator';

interface RouteAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: BusRoute | null;
  employees: Employee[];
  vehicles: Vehicle[];
  allRoutes?: BusRoute[];
  onSave: (routeId: string, payload: AssignRouteCrewPayload) => Promise<void>;
}

export const RouteAssignModal: React.FC<RouteAssignModalProps> = ({
  isOpen,
  onClose,
  route,
  employees,
  vehicles,
  allRoutes = [],
  onSave
}) => {
  const { currentUser } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  // Route-level standing crew
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedUnitNumber, setSelectedUnitNumber] = useState('');
  const [selectedAttendantId, setSelectedAttendantId] = useState('');
  const [autoFilledNote, setAutoFilledNote] = useState<string | null>(null);

  // Deadhead sort switcher
  const [sortByDeadhead, setSortByDeadhead] = useState(true);

  // Shift-level override switch
  const [isCustomCrew, setIsCustomCrew] = useState(false);
  const [shiftOverrides, setShiftOverrides] = useState<Record<string, {
    driverId: string;
    unitNumber: string;
    attendantId: string;
  }>>({});

  // Filter and sort employees
  const driversList = React.useMemo(() => {
    return employees.filter((e) => e.isActive);
  }, [employees]);

  // Attendants prioritized: jobPosition includes 'attendant' at top
  const attendantsList = React.useMemo(() => {
    const list = [...employees.filter((e) => e.isActive)];
    return list.sort((a, b) => {
      const aIs = (a.jobPosition || '').toLowerCase().includes('attendant');
      const bIs = (b.jobPosition || '').toLowerCase().includes('attendant');
      if (aIs && !bIs) return -1;
      if (!aIs && bIs) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [employees]);

  // Load full shifts with stops for deadhead calculation
  const [loadedShifts, setLoadedShifts] = useState<BusRouteShift[]>([]);

  useEffect(() => {
    if (!isOpen || !route?.id) {
      setLoadedShifts([]);
      return;
    }
    let isCancelled = false;
    RouteService.getShiftsForRoute(route.id)
      .then((shifts) => {
        if (!isCancelled) {
          setLoadedShifts(shifts || []);
        }
      })
      .catch((err) => {
        console.warn('Failed to load shifts for deadhead calculation:', err);
      });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, route?.id]);

  // Extract reference stops for deadhead calculation (prefer AM shift as morning pull-out)
  const routeReferenceStops = React.useMemo(() => {
    if (loadedShifts.length === 0) return [];
    const amShift = loadedShifts.find(
      (s) => (s.shiftType || '').toUpperCase() === 'AM' && s.stops && s.stops.length > 0
    );
    if (amShift && amShift.stops) return amShift.stops;
    const anyShiftWithStops = loadedShifts.find((s) => s.stops && s.stops.length > 0);
    return anyShiftWithStops && anyShiftWithStops.stops ? anyShiftWithStops.stops : [];
  }, [loadedShifts]);

  // Ranked drivers sorted by deadhead distance
  const rankedDrivers = React.useMemo(() => {
    if (routeReferenceStops.length === 0 || !sortByDeadhead) {
      return driversList.map((d) => ({
        employee: d,
        deadhead: calculateDriverDeadhead(d, routeReferenceStops)
      }));
    }
    return sortDriversByDeadhead(driversList, routeReferenceStops);
  }, [driversList, routeReferenceStops, sortByDeadhead]);

  // Active vehicles sorted by unit number
  const activeVehicles = React.useMemo(() => {
    return [...vehicles].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
  }, [vehicles]);

  // Helper to determine route assignments for any employee across all routes
  const getEmployeeAssignments = React.useCallback(
    (emp: Employee) => {
      const cleanEmpNum = emp.employeeNumber ? emp.employeeNumber.trim() : '';
      const cleanId = emp.id ? emp.id.replace(/^EMP-/, '').trim() : '';
      const empName = (emp.fullName || '').trim().toLowerCase();

      const matchesEmp = (id?: string, name?: string) => {
        if (!id && !name) return false;
        if (id) {
          const idTrim = id.trim();
          const idClean = idTrim.replace(/^EMP-/, '');
          if (idTrim === emp.id || idTrim === emp.employeeNumber) return true;
          if (cleanEmpNum && (idTrim === cleanEmpNum || idClean === cleanEmpNum)) return true;
          if (cleanId && (idTrim === cleanId || idClean === cleanId)) return true;
        }
        if (name && empName && name.trim().toLowerCase() === empName) {
          return true;
        }
        return false;
      };

      const assignments: {
        routeId: string;
        routeNo: string;
        routeName: string;
        roles: string[];
        isCurrentRoute: boolean;
      }[] = [];

      allRoutes.forEach((r) => {
        const isCurrentRoute = Boolean(route && (r.id === route.id || r.routeNo === route.routeNo));
        const rolesSet = new Set<string>();

        if (matchesEmp(r.driverId, r.driverName)) {
          rolesSet.add('Driver');
        }
        if (matchesEmp(r.attendantId, r.attendantName)) {
          rolesSet.add('Attendant');
        }

        if (r.shifts) {
          r.shifts.forEach((s) => {
            if (matchesEmp(s.driverId, s.driverName)) {
              rolesSet.add(`${s.shiftType || 'Shift'} Driver`);
            }
            if (matchesEmp(s.attendantId, s.attendantName)) {
              rolesSet.add(`${s.shiftType || 'Shift'} Attendant`);
            }
          });
        }

        if (rolesSet.size > 0) {
          assignments.push({
            routeId: r.id,
            routeNo: r.routeNo,
            routeName: r.routeName,
            roles: Array.from(rolesSet),
            isCurrentRoute
          });
        }
      });

      return assignments;
    },
    [allRoutes, route]
  );

  // Helper to format concise status tag for dropdown options
  const getEmployeeOptionTag = React.useCallback(
    (emp: Employee) => {
      const assignments = getEmployeeAssignments(emp);
      if (assignments.length === 0) {
        return '[Available]';
      }
      const otherRoutes = assignments.filter((a) => !a.isCurrentRoute);
      const isCurrent = assignments.some((a) => a.isCurrentRoute);

      if (otherRoutes.length > 0) {
        const routeNames = otherRoutes.map((a) => a.routeNo).slice(0, 2).join(', ');
        const more = otherRoutes.length > 2 ? ` +${otherRoutes.length - 2}` : '';
        return `⚠ [Assigned: ${routeNames}${more}]`;
      }

      if (isCurrent) {
        return '★ [Current Route]';
      }

      return '[Available]';
    },
    [getEmployeeAssignments]
  );

  // Helper to find regular vehicle for a driver
  const findRegularVehicleForDriver = (driverIdStr: string): Vehicle | undefined => {
    if (!driverIdStr) return undefined;
    const cleanId = driverIdStr.replace(/^EMP-/, '');
    const emp = employees.find(
      (e) =>
        e.id === driverIdStr ||
        e.employeeNumber === driverIdStr ||
        e.employeeNumber === cleanId ||
        `EMP-${e.employeeNumber}` === driverIdStr
    );
    if (!emp) return undefined;

    return vehicles.find(
      (v) =>
        v.driverId === emp.id ||
        v.driverId === emp.employeeNumber ||
        (v.driverId && v.driverId.replace(/^EMP-/, '') === cleanId) ||
        (emp.employeeId && v.employeeId === emp.employeeId) ||
        (v.driverName && v.driverName.trim().toLowerCase() === emp.fullName.trim().toLowerCase())
    );
  };

  useEffect(() => {
    if (route && isOpen) {
      // Robust matching for Driver by ID, employeeNumber, or Name
      const cleanDriverId = (route.driverId || '').replace(/^EMP-/, '');
      const matchedDriver = employees.find(
        (e) =>
          (route.driverId && (e.id === route.driverId || e.employeeNumber === route.driverId || e.employeeNumber === cleanDriverId)) ||
          (route.driverName && e.fullName.trim().toLowerCase() === route.driverName.trim().toLowerCase())
      );
      const driverIdToUse = matchedDriver ? matchedDriver.id : (route.driverId || '');
      setSelectedDriverId(driverIdToUse);

      setSelectedUnitNumber(route.unitNumber || '');

      // Robust matching for Attendant
      const cleanAttendantId = (route.attendantId || '').replace(/^EMP-/, '');
      const matchedAttendant = employees.find(
        (e) =>
          (route.attendantId && (e.id === route.attendantId || e.employeeNumber === route.attendantId || e.employeeNumber === cleanAttendantId)) ||
          (route.attendantName && e.fullName.trim().toLowerCase() === route.attendantName.trim().toLowerCase())
      );
      const attendantIdToUse = matchedAttendant ? matchedAttendant.id : (route.attendantId || '');
      setSelectedAttendantId(attendantIdToUse);

      setAutoFilledNote(null);

      // Check if any shift had custom crew
      setIsCustomCrew(false);
      const initOverrides: Record<string, { driverId: string; unitNumber: string; attendantId: string }> = {};
      if (route.shifts) {
        route.shifts.forEach((s) => {
          initOverrides[String(s.shiftId)] = {
            driverId: driverIdToUse,
            unitNumber: route.unitNumber || '',
            attendantId: attendantIdToUse
          };
        });
      }
      setShiftOverrides(initOverrides);
    }
  }, [route, isOpen, employees]);

  // Handler for route-level driver change (Auto-fills regular vehicle!)
  const handleDriverChange = (driverIdStr: string) => {
    setSelectedDriverId(driverIdStr);
    if (!driverIdStr) {
      setAutoFilledNote(null);
      return;
    }

    const matchedVeh = findRegularVehicleForDriver(driverIdStr);
    if (matchedVeh) {
      setSelectedUnitNumber(matchedVeh.unitNumber);
      setAutoFilledNote(`Auto-linked driver's regular bus: Unit #${matchedVeh.unitNumber} (${matchedVeh.manufacturer} ${matchedVeh.model})`);
    } else {
      setAutoFilledNote(null);
    }
  };

  // Handler for shift-level driver change
  const handleShiftDriverChange = (shiftIdStr: string, driverIdStr: string) => {
    const matchedVeh = findRegularVehicleForDriver(driverIdStr);
    setShiftOverrides((prev) => ({
      ...prev,
      [shiftIdStr]: {
        ...prev[shiftIdStr],
        driverId: driverIdStr,
        unitNumber: matchedVeh ? matchedVeh.unitNumber : prev[shiftIdStr]?.unitNumber || selectedUnitNumber
      }
    }));
  };

  const handleShiftFieldChange = (shiftIdStr: string, field: 'unitNumber' | 'attendantId', value: string) => {
    setShiftOverrides((prev) => ({
      ...prev,
      [shiftIdStr]: {
        ...prev[shiftIdStr],
        [field]: value
      }
    }));
  };

  const selectedDriverEmp = React.useMemo(() => {
    if (!selectedDriverId) return undefined;
    const cleanDriverId = selectedDriverId.replace(/^EMP-/, '');
    return employees.find(
      (e) => e.id === selectedDriverId || e.employeeNumber === selectedDriverId || e.employeeNumber === cleanDriverId
    );
  }, [selectedDriverId, employees]);

  const selectedDriverAssignments = React.useMemo(() => {
    if (!selectedDriverEmp) return [];
    return getEmployeeAssignments(selectedDriverEmp);
  }, [selectedDriverEmp, getEmployeeAssignments]);

  const selectedAttendantEmp = React.useMemo(() => {
    if (!selectedAttendantId) return undefined;
    const cleanAttId = selectedAttendantId.replace(/^EMP-/, '');
    return employees.find(
      (e) => e.id === selectedAttendantId || e.employeeNumber === selectedAttendantId || e.employeeNumber === cleanAttId
    );
  }, [selectedAttendantId, employees]);

  const selectedAttendantAssignments = React.useMemo(() => {
    if (!selectedAttendantEmp) return [];
    return getEmployeeAssignments(selectedAttendantEmp);
  }, [selectedAttendantEmp, getEmployeeAssignments]);

  const rankedAttendants = React.useMemo(() => {
    if (routeReferenceStops.length === 0 || !sortByDeadhead) {
      return attendantsList.map((a) => ({
        employee: a,
        deadhead: calculateAttendantDeadhead(a, selectedDriverEmp || null, routeReferenceStops)
      }));
    }
    return sortAttendantsByDeadhead(attendantsList, selectedDriverEmp || null, routeReferenceStops);
  }, [attendantsList, selectedDriverEmp, routeReferenceStops, sortByDeadhead]);

  const selectedDriverDeadhead = React.useMemo(() => {
    if (!selectedDriverEmp || routeReferenceStops.length === 0) return null;
    return calculateDriverDeadhead(selectedDriverEmp, routeReferenceStops);
  }, [selectedDriverEmp, routeReferenceStops]);

  const selectedAttendantDeadhead = React.useMemo(() => {
    if (!selectedAttendantEmp || routeReferenceStops.length === 0) return null;
    return calculateAttendantDeadhead(selectedAttendantEmp, selectedDriverEmp || null, routeReferenceStops);
  }, [selectedAttendantEmp, selectedDriverEmp, routeReferenceStops]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;
    setLoading(true);

    try {
      const cleanDriverId = selectedDriverId.replace(/^EMP-/, '');
      const driverEmp = employees.find(
        (e) => e.id === selectedDriverId || e.employeeNumber === selectedDriverId || e.employeeNumber === cleanDriverId
      );
      const vehObj = vehicles.find((v) => v.unitNumber === selectedUnitNumber);
      const cleanAttId = selectedAttendantId.replace(/^EMP-/, '');
      const attendantEmp = employees.find(
        (e) => e.id === selectedAttendantId || e.employeeNumber === selectedAttendantId || e.employeeNumber === cleanAttId
      );

      const payload: AssignRouteCrewPayload = {
        driverId: driverEmp ? driverEmp.id : selectedDriverId,
        driverName: driverEmp ? driverEmp.fullName : route.driverName,
        driverPhone: driverEmp ? (driverEmp.mobilePhone || driverEmp.workPhonePhone) : route.driverPhone,
        vehicleId: vehObj ? vehObj.vehicleId : undefined,
        unitNumber: selectedUnitNumber,
        plateNumber: vehObj ? vehObj.plateNumber : undefined,
        attendantId: attendantEmp ? attendantEmp.id : (selectedAttendantId || undefined),
        attendantName: attendantEmp ? attendantEmp.fullName : undefined,
        attendantPhone: attendantEmp ? (attendantEmp.mobilePhone || attendantEmp.workPhonePhone) : undefined,
        isCustomCrew
      };

      if (isCustomCrew && route.shifts) {
        payload.shiftOverrides = route.shifts.map((s) => {
          const ov = shiftOverrides[String(s.shiftId)] || {
            driverId: selectedDriverId,
            unitNumber: selectedUnitNumber,
            attendantId: selectedAttendantId
          };
          const sCleanDriverId = ov.driverId.replace(/^EMP-/, '');
          const sDriver = employees.find(
            (e) => e.id === ov.driverId || e.employeeNumber === ov.driverId || e.employeeNumber === sCleanDriverId
          );
          const sVeh = vehicles.find((v) => v.unitNumber === ov.unitNumber);
          const sCleanAttId = ov.attendantId.replace(/^EMP-/, '');
          const sAttendant = employees.find(
            (e) => e.id === ov.attendantId || e.employeeNumber === ov.attendantId || e.employeeNumber === sCleanAttId
          );

          return {
            shiftId: String(s.shiftId),
            driverId: sDriver ? sDriver.id : ov.driverId,
            driverName: sDriver ? sDriver.fullName : '',
            driverPhone: sDriver ? (sDriver.mobilePhone || sDriver.workPhonePhone) : '',
            vehicleId: sVeh ? sVeh.vehicleId : undefined,
            unitNumber: ov.unitNumber,
            plateNumber: sVeh ? sVeh.plateNumber : '',
            attendantId: sAttendant ? sAttendant.id : ov.attendantId,
            attendantName: sAttendant ? sAttendant.fullName : '',
            attendantPhone: sAttendant ? (sAttendant.mobilePhone || sAttendant.workPhonePhone) : ''
          };
        });
      }

      await onSave(route.id, payload);

      // Track driver-to-route and driver-to-vehicle assignment changes
      const todayStr = new Date().toISOString().slice(0, 10);
      const previousDriverId = route.driverId || '';
      const newDriverId = payload.driverId || '';
      const previousUnit = route.unitNumber || '';
      const newUnit = payload.unitNumber || '';

      const dispatcherName = currentUser?.displayName || currentUser?.email || 'Dispatcher / Admin';
      const dispatcherId = currentUser?.employeeId || currentUser?.uid || 'UNKNOWN_DISPATCHER';
      const dispatcherRole = currentUser?.role || 'admin';
      const dispatcherEmail = currentUser?.email || '';

      // 1. If previous driver is unassigned or changed
      if (previousDriverId && previousDriverId !== newDriverId) {
        AssignmentHistoryService.recordEvent({
          type: 'driver_route',
          action: 'unassign',
          effectiveDate: todayStr,
          driverId: previousDriverId,
          driverName: route.driverName || previousDriverId,
          routeId: route.id,
          routeNo: route.routeNo,
          routeName: route.routeName,
          reason: newDriverId ? `Replaced on route ${route.routeNo}` : `Unassigned from route ${route.routeNo}`,
          assignedBy: dispatcherName,
          dispatcherId,
          dispatcherName,
          dispatcherRole,
          dispatcherEmail,
        }).catch((e) => console.warn('Audit record unassign driver error:', e));
      }

      // 2. If new driver is assigned
      if (newDriverId && newDriverId !== previousDriverId) {
        AssignmentHistoryService.recordEvent({
          type: 'driver_route',
          action: 'assign',
          effectiveDate: todayStr,
          driverId: newDriverId,
          driverName: payload.driverName || newDriverId,
          routeId: route.id,
          routeNo: route.routeNo,
          routeName: route.routeName,
          unitNumber: newUnit,
          plateNumber: payload.plateNumber,
          reason: `Assigned standing driver to route ${route.routeNo}`,
          assignedBy: dispatcherName,
          dispatcherId,
          dispatcherName,
          dispatcherRole,
          dispatcherEmail,
        }).catch((e) => console.warn('Audit record assign driver error:', e));
      }

      // 3. Driver & Vehicle relationship tracking
      if (newDriverId && newUnit && (newDriverId !== previousDriverId || newUnit !== previousUnit)) {
        AssignmentHistoryService.recordEvent({
          type: 'driver_vehicle',
          action: 'assign',
          effectiveDate: todayStr,
          driverId: newDriverId,
          driverName: payload.driverName || newDriverId,
          unitNumber: newUnit,
          plateNumber: payload.plateNumber,
          routeNo: route.routeNo,
          reason: `Assigned Unit #${newUnit} for route ${route.routeNo}`,
          assignedBy: dispatcherName,
          dispatcherId,
          dispatcherName,
          dispatcherRole,
          dispatcherEmail,
        }).catch((e) => console.warn('Audit record driver-vehicle error:', e));
      }

      // Also record route change audit log for route crew assignment
      RouteAuditService.logRouteChange({
        routeId: route.id,
        routeNo: route.routeNo,
        routeName: route.routeName,
        category: 'crew',
        action: 'assign',
        summary: `Crew updated for Route ${route.routeNo}: Driver ${payload.driverName || 'None'}, Bus #${payload.unitNumber || 'None'}${payload.attendantName ? `, Monitor ${payload.attendantName}` : ''}`,
        diffs: [
          { field: 'driverName', fieldLabel: 'Assigned Driver', oldValue: route.driverName || 'None', newValue: payload.driverName || 'None' },
          { field: 'unitNumber', fieldLabel: 'Assigned Bus', oldValue: route.unitNumber ? `#${route.unitNumber}` : 'None', newValue: payload.unitNumber ? `#${payload.unitNumber}` : 'None' },
          { field: 'attendantName', fieldLabel: 'Attendant / Monitor', oldValue: route.attendantName || 'None', newValue: payload.attendantName || 'None' }
        ],
        userId: dispatcherId,
        userName: dispatcherName,
        userEmail: dispatcherEmail,
        userRole: dispatcherRole
      }).catch((e) => console.warn('Route crew audit error:', e));

      onClose();
    } catch (err: any) {
      alert(`Failed to assign crew: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !route) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10 gap-2">
          <div className="min-w-0 pr-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Assign Crew & Vehicle: {route.routeNo}
              </h2>
              {route.yardName && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-bold">
                  {route.yardName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-lg">
              {route.routeName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Standing Assignment */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                <User className="w-4 h-4" />
                <span>Primary Driver & Vehicle (Standing Assignment)</span>
              </span>
              <button
                type="button"
                onClick={() => setSortByDeadhead(!sortByDeadhead)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border cursor-pointer ${
                  sortByDeadhead
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title={sortByDeadhead ? t.deadhead.sortByName : t.deadhead.sortByDeadhead}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{sortByDeadhead ? t.deadhead.sortByDeadhead : t.deadhead.sortByName}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Driver Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Select Assigned Driver *</span>
                </label>
                <select
                  required
                  value={selectedDriverId}
                  onChange={(e) => handleDriverChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                >
                  <option value="">-- Choose Driver --</option>
                  {rankedDrivers.map(({ employee: d, deadhead }) => {
                    const tag = getEmployeeOptionTag(d);
                    const deadheadText = deadhead.hasCoordinates
                      ? ` [~${deadhead.totalDeadheadKm} km deadhead (${deadhead.pullOutKm} km to start) • ${deadhead.totalMinutes}m]`
                      : ` [${t.deadhead.noGpsCoordinates}]`;
                    return (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.id}){deadheadText} {tag} {d.jobPosition ? `• ${d.jobPosition}` : ''}
                      </option>
                    );
                  })}
                </select>

                {/* Deadhead Proximity Card for Selected Driver */}
                {selectedDriverDeadhead && selectedDriverDeadhead.hasCoordinates && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-bold flex items-center gap-1.5 text-amber-400">
                        <Home className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t.deadhead.driverParkedAtHome}</span>
                      </span>
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                        ~{selectedDriverDeadhead.totalDeadheadKm} km {t.deadhead.totalDeadhead} ({selectedDriverDeadhead.totalMinutes} min)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                      <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                        <div className="text-slate-500">{t.deadhead.pullOutDistance}:</div>
                        <div className="text-slate-200 font-bold">{selectedDriverDeadhead.pullOutKm} km (~{selectedDriverDeadhead.pullOutMinutes} min)</div>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                        <div className="text-slate-500">{t.deadhead.pullInDistance}:</div>
                        <div className="text-slate-200 font-bold">{selectedDriverDeadhead.pullInKm} km (~{selectedDriverDeadhead.pullInMinutes} min)</div>
                      </div>
                    </div>
                    {selectedDriverDeadhead.originAddress && (
                      <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-slate-500" />
                        <span>Residence: {selectedDriverDeadhead.originAddress}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Driver Assignment Status Indicator */}
                {selectedDriverEmp && (
                  <div className="mt-2">
                    {(() => {
                      const otherRoutes = selectedDriverAssignments.filter((a) => !a.isCurrentRoute);
                      const isCurrent = selectedDriverAssignments.some((a) => a.isCurrentRoute);

                      if (otherRoutes.length > 0) {
                        return (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                            <div>
                              <div className="font-semibold text-amber-200">
                                Already assigned to other route(s):
                              </div>
                              <div className="font-mono text-[11px] mt-0.5 text-amber-300">
                                {otherRoutes.map((a) => `${a.routeNo} (${a.roles.join(', ')})`).join(', ')}
                              </div>
                              <p className="text-[10px] text-amber-400/80 mt-1">
                                Multi-route assignment allowed (relief/combined runs).
                              </p>
                            </div>
                          </div>
                        );
                      }
                      if (isCurrent) {
                        return (
                          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Assigned to this route ({route.routeNo})</span>
                          </div>
                        );
                      }
                      return (
                        <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs flex items-center space-x-2">
                          <UserCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Available</span>
                          <span className="text-slate-400">- Not assigned to any routes</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Vehicle Picker (Auto-filled on driver change) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1">
                  <Bus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Assigned Vehicle *</span>
                </label>
                <select
                  required
                  value={selectedUnitNumber}
                  onChange={(e) => setSelectedUnitNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono transition"
                >
                  <option value="">-- Choose Unit --</option>
                  {activeVehicles.map((v) => (
                    <option key={v.id} value={v.unitNumber}>
                      Unit #{v.unitNumber} - {v.manufacturer} {v.model} ({v.seatCap} Seats, {v.fuelType})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-fill notification alert */}
            {autoFilledNote && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{autoFilledNote}</span>
              </div>
            )}

            {/* Attendant Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bus Attendant / Monitor (Optional)</span>
              </label>
              <select
                value={selectedAttendantId}
                onChange={(e) => setSelectedAttendantId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition"
              >
                <option value="">-- No Attendant Assigned --</option>
                {rankedAttendants.map(({ employee: a, deadhead }) => {
                  const isAtt = (a.jobPosition || '').toLowerCase().includes('attendant');
                  const tag = getEmployeeOptionTag(a);
                  let deadheadText = '';
                  if (deadhead.hasCoordinates) {
                    if (deadhead.distanceToDriverKm !== undefined) {
                      deadheadText = ` [${deadhead.distanceToDriverKm} km ${t.deadhead.toDriverHome}${deadhead.detourKm ? ` • +${deadhead.detourKm}km detour` : ''}]`;
                    } else {
                      deadheadText = ` [${deadhead.distanceToFirstStopKm} km ${t.deadhead.toFirstStop}]`;
                    }
                  } else {
                    deadheadText = ` [${t.deadhead.noGpsCoordinates}]`;
                  }
                  return (
                    <option key={a.id} value={a.id}>
                      {isAtt ? '★ [Attendant] ' : ''}{a.fullName} ({a.id}){deadheadText} {tag} - {a.jobPosition}
                    </option>
                  );
                })}
              </select>

              {/* Deadhead Proximity Card for Selected Attendant */}
              {selectedAttendantDeadhead && selectedAttendantDeadhead.hasCoordinates && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {selectedAttendantDeadhead.distanceToDriverKm !== undefined
                        ? `${t.deadhead.toDriverHome}: ${selectedAttendantDeadhead.distanceToDriverKm} km (~${selectedAttendantDeadhead.estimatedMinutes} min)`
                        : `${t.deadhead.toFirstStop}: ${selectedAttendantDeadhead.distanceToFirstStopKm} km (~${selectedAttendantDeadhead.estimatedMinutes} min)`}
                    </span>
                  </div>
                  {selectedAttendantDeadhead.detourKm !== undefined && selectedAttendantDeadhead.detourKm > 0 && (
                    <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      +{selectedAttendantDeadhead.detourKm} km {t.deadhead.detourToDriver}
                    </span>
                  )}
                </div>
              )}

              {/* Attendant Assignment Status Indicator */}
              {selectedAttendantEmp && (
                <div className="mt-2">
                  {(() => {
                    const otherRoutes = selectedAttendantAssignments.filter((a) => !a.isCurrentRoute);
                    const isCurrent = selectedAttendantAssignments.some((a) => a.isCurrentRoute);

                    if (otherRoutes.length > 0) {
                      return (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                          <div>
                            <div className="font-semibold text-amber-200">
                              Already assigned to other route(s):
                            </div>
                            <div className="font-mono text-[11px] mt-0.5 text-amber-300">
                              {otherRoutes.map((a) => `${a.routeNo} (${a.roles.join(', ')})`).join(', ')}
                            </div>
                            <p className="text-[10px] text-amber-400/80 mt-1">
                              Multi-route assignment allowed.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    if (isCurrent) {
                      return (
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Assigned to this route ({route.routeNo})</span>
                        </div>
                      );
                    }
                    return (
                      <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs flex items-center space-x-2">
                        <UserCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Available</span>
                        <span className="text-slate-400">- Not assigned to any routes</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <p className="text-[11px] text-slate-500 mt-1.5">
                Attendants are prioritized at top. Any driver or office staff member may also be assigned.
              </p>
            </div>
          </div>

          {/* Shift Override Mode Toggle (For the 10% special cases) */}
          <div className="space-y-4">
            <label className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 cursor-pointer hover:bg-slate-800/60 transition">
              <input
                type="checkbox"
                checked={isCustomCrew}
                onChange={(e) => setIsCustomCrew(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-700"
              />
              <div>
                <span className="text-xs font-bold text-white block">
                  Customize Crew & Vehicle per Shift (AM vs PM Split)
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Check this if the morning and afternoon shifts require different drivers, relief vehicles, or specialized monitors.
                </span>
              </div>
            </label>

            {/* Shift Breakdown Cards */}
            {isCustomCrew && route.shifts && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Shift-Specific Crew Customization</span>
                </h4>

                {route.shifts.map((shift) => {
                  const shiftOv = shiftOverrides[String(shift.shiftId)] || {
                    driverId: selectedDriverId,
                    unitNumber: selectedUnitNumber,
                    attendantId: selectedAttendantId
                  };

                  return (
                    <div
                      key={shift.shiftId}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold font-mono">
                            {shift.shiftType} Shift
                          </span>
                          <span className="text-xs text-slate-300 font-medium">
                            {shift.firstStopTime} - {shift.lastStopTime} ({shift.stopCount} stops)
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono">
                          Days: {shift.runDays}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Shift Driver */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Shift Driver
                          </label>
                          <select
                            value={shiftOv.driverId}
                            onChange={(e) => handleShiftDriverChange(String(shift.shiftId), e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="">-- Same as Route --</option>
                            {driversList.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.fullName} ({d.id}) {getEmployeeOptionTag(d)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Shift Vehicle */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Shift Vehicle
                          </label>
                          <select
                            value={shiftOv.unitNumber}
                            onChange={(e) => handleShiftFieldChange(String(shift.shiftId), 'unitNumber', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                          >
                            <option value="">-- Same as Route --</option>
                            {activeVehicles.map((v) => (
                              <option key={v.id} value={v.unitNumber}>
                                Unit #{v.unitNumber} ({v.seatCap} seats)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Shift Attendant */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Shift Attendant
                          </label>
                          <select
                            value={shiftOv.attendantId}
                            onChange={(e) => handleShiftFieldChange(String(shift.shiftId), 'attendantId', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="">-- None / Default --</option>
                            {attendantsList.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.fullName} ({a.id}) {getEmployeeOptionTag(a)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedDriverId || !selectedUnitNumber}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {loading ? 'Saving Assignment...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
