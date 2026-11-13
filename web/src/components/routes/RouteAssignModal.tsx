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
  Zap,
  CalendarClock,
  History,
  ArrowRight,
  Megaphone,
  Loader2,
  Plus
} from 'lucide-react';
import { AssignmentHistoryService } from '../../services/assignmentHistoryService';
import { DispatchService } from '../../services/dispatchService';
import { RouteOpeningService, getTodayLocalDateStr } from '../../services/routeOpeningService';
import { TemporaryAssignment } from '../../types/dispatch';
import { RouteOpening } from '../../types/routeOpening';
import { AssignmentHistoryRecord } from '../../types/assignmentHistory';
import { buildRouteScheduleSummary } from '../../utils/routeAssignmentScheduleUtils';
import {
  sortVehiclesByAssignmentPriority,
  sortCandidatesByAssignmentPriority,
} from '../../utils/assignmentPriorityUtils';
import { RouteAuditService } from '../../services/routeAuditService';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import {
  sortDriversByDeadhead,
  sortAttendantsByDeadhead,
  calculateDriverDeadhead,
  calculateAttendantDeadhead
} from '../../utils/deadheadCalculator';
import {
  classifyEmployeeForRole,
  compareCrewPriority,
  groupCrewCandidates,
  getOptGroupLabels,
} from '../../utils/crewEligibilityUtils';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';

const EMPTY_ROUTES: BusRoute[] = [];

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
  allRoutes = EMPTY_ROUTES,
  onSave
}) => {
  const { currentUser } = useAuth();
  const { t, isFrench } = useI18n();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'assign' | 'scheduled'>('assign');

  // Schedule & active/upcoming assignments state
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [temporaryAssignments, setTemporaryAssignments] = useState<TemporaryAssignment[]>([]);
  const [routeOpenings, setRouteOpenings] = useState<RouteOpening[]>([]);
  const [recentHistory, setRecentHistory] = useState<AssignmentHistoryRecord[]>([]);

  // Inline schedule / publish position state inside Scheduled tab
  const [scheduledActionMode, setScheduledActionMode] = useState<'none' | 'schedule_assign' | 'publish_opening'>('none');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Schedule future assignment form state
  const [planKind, setPlanKind] = useState<'permanent' | 'temporary'>('permanent');
  const [planStartDate, setPlanStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [planShiftType, setPlanShiftType] = useState('ALL');
  const [planDriverId, setPlanDriverId] = useState('');
  const [planAttendantId, setPlanAttendantId] = useState('');
  const [planUnitNumber, setPlanUnitNumber] = useState('');
  const [planAutoFilledNote, setPlanAutoFilledNote] = useState<string | null>(null);
  const [planReason, setPlanReason] = useState('Scheduled Replacement');
  const [planNotes, setPlanNotes] = useState('');

  // Publish open position form state
  const [publishPostingType, setPublishPostingType] = useState<'permanent' | 'temporary'>('permanent');
  const [publishRoleNeeded, setPublishRoleNeeded] = useState<'driver' | 'attendant' | 'driver_and_attendant'>('driver');
  const [publishShiftType, setPublishShiftType] = useState('ALL');
  const [publishStartDate, setPublishStartDate] = useState('');
  const [publishEndDate, setPublishEndDate] = useState('');
  const [publishDeadline, setPublishDeadline] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishPostToChat, setPublishPostToChat] = useState(true);

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

  // Filter and sort employees with crew eligibility priority
  const driversList = React.useMemo(() => {
    return employees
      .filter((e) => e.isActive)
      .sort((a, b) => compareCrewPriority(a, b, 'driver'));
  }, [employees]);

  // Attendants prioritized: Attendants -> Supervisors / Experienced Cover Staff -> Others
  const attendantsList = React.useMemo(() => {
    return employees
      .filter((e) => e.isActive)
      .sort((a, b) => compareCrewPriority(a, b, 'attendant'));
  }, [employees]);

  // Load full shifts with stops for deadhead calculation
  const [loadedShifts, setLoadedShifts] = useState<BusRouteShift[]>([]);

  const loadScheduleData = React.useCallback(async () => {
    if (!route?.id) return;
    setScheduleLoading(true);
    try {
      const [taRes, roRes, histRes] = await Promise.allSettled([
        DispatchService.listTemporaryAssignments(),
        RouteOpeningService.listOpenings(),
        AssignmentHistoryService.listHistory({
          routeNo: route.routeNo,
          timeRange: '1year',
        }),
      ]);
      setTemporaryAssignments(
        taRes.status === 'fulfilled' && Array.isArray(taRes.value) ? taRes.value : []
      );
      setRouteOpenings(
        roRes.status === 'fulfilled' && Array.isArray(roRes.value) ? roRes.value : []
      );
      const rawHist =
        histRes.status === 'fulfilled' && Array.isArray(histRes.value) ? histRes.value : [];
      const filteredHist = rawHist
        .filter(
          (h) =>
            (h.routeId && h.routeId === route.id) ||
            (h.routeNo && h.routeNo.toLowerCase() === (route.routeNo || '').toLowerCase())
        )
        .slice(0, 6);
      setRecentHistory(filteredHist);
    } finally {
      setScheduleLoading(false);
    }
  }, [route?.id, route?.routeNo]);

  useEffect(() => {
    if (!isOpen || !route?.id) {
      setLoadedShifts([]);
      setTemporaryAssignments([]);
      setRouteOpenings([]);
      setRecentHistory([]);
      return;
    }
    setActiveTab('assign');
    setScheduledActionMode('none');
    setActionFeedback(null);

    const todayStr = getTodayLocalDateStr();
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;
    setPlanKind('permanent');
    setPlanStartDate(todayStr);
    setPlanEndDate(todayStr);
    setPlanShiftType('ALL');
    setPlanDriverId('');
    setPlanAttendantId('');
    setPlanUnitNumber('');
    setPlanAutoFilledNote(null);
    setPlanReason('Scheduled Replacement');
    setPlanNotes('');

    setPublishPostingType('permanent');
    setPublishRoleNeeded('driver');
    setPublishShiftType('ALL');
    setPublishStartDate(todayStr);
    setPublishEndDate(todayStr);
    setPublishDeadline(`${nextWeekStr}T17:00`);
    setPublishDescription('');
    setPublishPostToChat(true);

    let isCancelled = false;
    setScheduleLoading(true);

    RouteService.getShiftsForRoute(route.id)
      .then((shifts) => {
        if (!isCancelled) {
          setLoadedShifts(shifts || []);
        }
      })
      .catch((err) => {
        console.warn('Failed to load shifts for deadhead calculation:', err);
      });

    Promise.allSettled([
      DispatchService.listTemporaryAssignments(),
      RouteOpeningService.listOpenings(),
      AssignmentHistoryService.listHistory({
        routeNo: route.routeNo,
        timeRange: '1year',
      }),
    ])
      .then(([taRes, roRes, histRes]) => {
        if (isCancelled) return;
        setTemporaryAssignments(
          taRes.status === 'fulfilled' && Array.isArray(taRes.value) ? taRes.value : []
        );
        setRouteOpenings(
          roRes.status === 'fulfilled' && Array.isArray(roRes.value) ? roRes.value : []
        );
        const rawHist =
          histRes.status === 'fulfilled' && Array.isArray(histRes.value) ? histRes.value : [];
        const filteredHist = rawHist
          .filter(
            (h) =>
              (h.routeId && h.routeId === route.id) ||
              (h.routeNo && h.routeNo.toLowerCase() === (route.routeNo || '').toLowerCase())
          )
          .slice(0, 6);
        setRecentHistory(filteredHist);
      })
      .finally(() => {
        if (!isCancelled) setScheduleLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, route?.id, route?.routeNo]);

  const scheduleSummary = React.useMemo(() => {
    if (!route) {
      return {
        temporaryCovers: [],
        scheduledOpenings: [],
        shiftOverrides: [],
        upcomingAndActiveCount: 0,
      };
    }
    return buildRouteScheduleSummary({
      route,
      shifts: loadedShifts,
      temporaryAssignments,
      routeOpenings,
      todayStr: getTodayLocalDateStr(),
      isFrench,
    });
  }, [route, loadedShifts, temporaryAssignments, routeOpenings, isFrench]);

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

  // Ranked drivers prioritizing: Current Route -> Available (Unassigned) -> Other Routes, then by deadhead/name
  const rankedDrivers = React.useMemo(() => {
    if (!isOpen) return [];
    let list: { employee: Employee; deadhead: any }[];
    if (routeReferenceStops.length === 0 || !sortByDeadhead) {
      list = driversList.map((d) => ({
        employee: d,
        deadhead: calculateDriverDeadhead(d, routeReferenceStops)
      }));
    } else {
      list = sortDriversByDeadhead(driversList, routeReferenceStops);
    }
    return sortCandidatesByAssignmentPriority(list, getEmployeeAssignments);
  }, [isOpen, driversList, routeReferenceStops, sortByDeadhead, getEmployeeAssignments]);

  // Vehicles prioritized: Current Route -> Available (Unassigned) -> Other Routes
  const prioritizedVehicles = React.useMemo(() => {
    const list = Array.isArray(vehicles) ? vehicles : [];
    return sortVehiclesByAssignmentPriority(list, allRoutes, route);
  }, [vehicles, allRoutes, route]);

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
    let list: { employee: Employee; deadhead: any }[];
    if (routeReferenceStops.length === 0 || !sortByDeadhead) {
      list = attendantsList.map((a) => ({
        employee: a,
        deadhead: calculateAttendantDeadhead(a, selectedDriverEmp || null, routeReferenceStops)
      }));
    } else {
      list = sortAttendantsByDeadhead(attendantsList, selectedDriverEmp || null, routeReferenceStops);
    }
    return sortCandidatesByAssignmentPriority(list, getEmployeeAssignments);
  }, [attendantsList, selectedDriverEmp, routeReferenceStops, sortByDeadhead, getEmployeeAssignments]);

  const selectedDriverDeadhead = React.useMemo(() => {
    if (!selectedDriverEmp || routeReferenceStops.length === 0) return null;
    return calculateDriverDeadhead(selectedDriverEmp, routeReferenceStops);
  }, [selectedDriverEmp, routeReferenceStops]);

  const selectedAttendantDeadhead = React.useMemo(() => {
    if (!selectedAttendantEmp || routeReferenceStops.length === 0) return null;
    return calculateAttendantDeadhead(selectedAttendantEmp, selectedDriverEmp || null, routeReferenceStops);
  }, [selectedAttendantEmp, selectedDriverEmp, routeReferenceStops]);

  const driverSelectOptions = React.useMemo<SearchableSelectOption[]>(() => {
    const groups = groupCrewCandidates(rankedDrivers, 'driver');
    const labels = getOptGroupLabels('driver', isFrench);
    const buildOpt = (groupLabel: string) => ({ employee: d, deadhead }: (typeof rankedDrivers)[number]): SearchableSelectOption => {
      const eligibility = classifyEmployeeForRole(d, 'driver');
      const roleTag = isFrench ? eligibility.optionTagFr : eligibility.optionTagEn;
      const routeTag = getEmployeeOptionTag(d);
      const deadheadText = deadhead.hasCoordinates
        ? `~${deadhead.totalDeadheadKm} km deadhead (${deadhead.pullOutKm} km to start • ${deadhead.totalMinutes}m)`
        : t.deadhead.noGpsCoordinates;
      return {
        value: d.id,
        label: `${d.fullName} (${d.employeeNumber || d.id})`,
        groupLabel,
        badgeText: roleTag || undefined,
        secondaryBadgeText: routeTag !== '[Available]' ? routeTag : undefined,
        secondaryBadgeClassName: routeTag.includes('Assigned')
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        subtext: [d.jobPosition || '', deadheadText, d.mobilePhone || d.preferredPhone || '']
          .filter(Boolean)
          .join(' • '),
        isHighlighted: routeTag.includes('Assigned'),
        searchText: [
          d.fullName,
          d.firstName,
          d.lastName,
          d.id,
          d.employeeNumber,
          d.jobPosition,
          d.role,
          roleTag,
          routeTag,
          d.mobilePhone,
          d.preferredPhone,
          d.personalAddress,
        ]
          .filter(Boolean)
          .join(' '),
      };
    };
    return [
      ...groups.primary.map(buildOpt(labels.primary)),
      ...groups.relief.map(buildOpt(labels.relief)),
      ...groups.other.map(buildOpt(labels.other)),
    ];
  }, [rankedDrivers, isFrench, getEmployeeOptionTag, t.deadhead.noGpsCoordinates]);

  const attendantSelectOptions = React.useMemo<SearchableSelectOption[]>(() => {
    const groups = groupCrewCandidates(rankedAttendants, 'attendant');
    const labels = getOptGroupLabels('attendant', isFrench);
    const buildOpt = (groupLabel: string) => ({ employee: a, deadhead }: (typeof rankedAttendants)[number]): SearchableSelectOption => {
      const eligibility = classifyEmployeeForRole(a, 'attendant');
      const roleTag = isFrench ? eligibility.optionTagFr : eligibility.optionTagEn;
      const routeTag = getEmployeeOptionTag(a);
      let deadheadText = '';
      if (deadhead.hasCoordinates) {
        if (deadhead.distanceToDriverKm !== undefined) {
          deadheadText = `${deadhead.distanceToDriverKm} km ${t.deadhead.toDriverHome}${deadhead.detourKm ? ` • +${deadhead.detourKm}km detour` : ''}`;
        } else {
          deadheadText = `${deadhead.distanceToFirstStopKm} km ${t.deadhead.toFirstStop}`;
        }
      } else {
        deadheadText = t.deadhead.noGpsCoordinates;
      }
      return {
        value: a.id,
        label: `${a.fullName} (${a.employeeNumber || a.id})`,
        groupLabel,
        badgeText: roleTag || undefined,
        secondaryBadgeText: routeTag !== '[Available]' ? routeTag : undefined,
        secondaryBadgeClassName: routeTag.includes('Assigned')
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        subtext: [a.jobPosition || '', deadheadText, a.mobilePhone || a.preferredPhone || '']
          .filter(Boolean)
          .join(' • '),
        isHighlighted: routeTag.includes('Assigned'),
        searchText: [
          a.fullName,
          a.firstName,
          a.lastName,
          a.id,
          a.employeeNumber,
          a.jobPosition,
          a.role,
          roleTag,
          routeTag,
          a.mobilePhone,
          a.preferredPhone,
          a.personalAddress,
        ]
          .filter(Boolean)
          .join(' '),
      };
    };
    return [
      ...groups.primary.map(buildOpt(labels.primary)),
      ...groups.relief.map(buildOpt(labels.relief)),
      ...groups.other.map(buildOpt(labels.other)),
    ];
  }, [
    rankedAttendants,
    isFrench,
    getEmployeeOptionTag,
    t.deadhead.noGpsCoordinates,
    t.deadhead.toDriverHome,
    t.deadhead.toFirstStop,
  ]);

  const vehicleSelectOptions = React.useMemo<SearchableSelectOption[]>(() => {
    return prioritizedVehicles.map(({ vehicle: v, info }) => {
      const isAvailable = !info.isAssigned;
      const isCurrent = info.isCurrentRoute;
      const assignmentNote = isCurrent
        ? (isFrench ? '★ Affecté à cette route' : '★ Assigned to this route')
        : isAvailable
        ? (isFrench ? 'Disponible — Non affecté' : 'Available — Unassigned')
        : (isFrench ? `Occupé — ${info.statusTag}` : `In Use — ${info.statusTag}`);

      return {
        value: v.unitNumber,
        label: `Unit #${v.unitNumber} - ${v.manufacturer} ${v.model} (${v.seatCap} Seats, ${v.fuelType})`,
        badgeText: info.statusTag !== '[Available]' ? info.statusTag : (isFrench ? '[Disponible]' : '[Available]'),
        badgeClassName: isCurrent
          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
          : isAvailable
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        subtext: [
          assignmentNote,
          v.plateNumber ? `Plate: ${v.plateNumber}` : '',
          v.yardName || '',
          v.driverName ? `Driver: ${v.driverName}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        isHighlighted: isAvailable || isCurrent,
        searchText: [
          v.unitNumber,
          v.plateNumber,
          v.manufacturer,
          v.model,
          v.fuelType,
          v.yardName,
          v.driverName,
          info.statusTag,
          assignmentNote,
          String(v.seatCap || ''),
        ]
          .filter(Boolean)
          .join(' '),
      };
    });
  }, [prioritizedVehicles, isFrench]);

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

  const resolveEmployeeBySelection = (idStr: string): Employee | undefined => {
    if (!idStr) return undefined;
    const clean = idStr.replace(/^EMP-/, '');
    return employees.find(
      (e) => e.id === idStr || e.employeeNumber === idStr || e.employeeNumber === clean
    );
  };

  const handlePlanDriverChange = (driverIdStr: string) => {
    setPlanDriverId(driverIdStr);
    if (!driverIdStr) {
      setPlanAutoFilledNote(null);
      return;
    }
    const regVeh = findRegularVehicleForDriver(driverIdStr);
    if (regVeh) {
      setPlanUnitNumber(regVeh.unitNumber);
      setPlanAutoFilledNote(
        isFrench
          ? `Autobus régulier du chauffeur : Unit #${regVeh.unitNumber}`
          : `Auto-filled Driver's Regular Bus: Unit #${regVeh.unitNumber}`
      );
    } else {
      setPlanAutoFilledNote(null);
    }
  };

  const handleCreateScheduledAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;
    if (!planStartDate) {
      setActionFeedback({
        type: 'error',
        text: isFrench ? 'Veuillez sélectionner une date de début.' : 'Please select an effective start date.',
      });
      return;
    }
    if (!planDriverId && !planAttendantId && !planUnitNumber) {
      setActionFeedback({
        type: 'error',
        text: isFrench
          ? 'Veuillez sélectionner au moins un chauffeur, accompagnateur ou véhicule.'
          : 'Please select at least a driver, attendant, or vehicle.',
      });
      return;
    }

    setActionSubmitting(true);
    setActionFeedback(null);
    const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

    try {
      const driverEmp = resolveEmployeeBySelection(planDriverId);
      const attendantEmp = resolveEmployeeBySelection(planAttendantId);
      const vehObj = planUnitNumber ? vehicles.find((v) => v.unitNumber === planUnitNumber) : undefined;

      if (planKind === 'temporary') {
        const endDate = planEndDate && planEndDate >= planStartDate ? planEndDate : planStartDate;
        await DispatchService.createTemporaryAssignment({
          routeId: route.id,
          routeNo: route.routeNo,
          routeName: route.routeName,
          shiftType: planShiftType || 'ALL',
          startDate: planStartDate,
          endDate,
          originalDriverId: driverEmp ? route.driverId : undefined,
          originalDriverName: driverEmp ? route.driverName : undefined,
          temporaryDriverId: driverEmp ? driverEmp.id : planDriverId || undefined,
          temporaryDriverName: driverEmp ? driverEmp.fullName : undefined,
          temporaryDriverPhone: driverEmp ? (driverEmp.mobilePhone || driverEmp.workPhonePhone) : undefined,
          originalAttendantId: attendantEmp ? route.attendantId : undefined,
          originalAttendantName: attendantEmp ? route.attendantName : undefined,
          temporaryAttendantId: attendantEmp ? attendantEmp.id : planAttendantId || undefined,
          temporaryAttendantName: attendantEmp ? attendantEmp.fullName : undefined,
          temporaryAttendantPhone: attendantEmp ? (attendantEmp.mobilePhone || attendantEmp.workPhonePhone) : undefined,
          temporaryVehicleId: vehObj ? vehObj.vehicleId : undefined,
          temporaryUnitNumber: vehObj ? vehObj.unitNumber : planUnitNumber || undefined,
          temporaryPlateNumber: vehObj ? vehObj.plateNumber : undefined,
          reason: planReason.trim() || 'Scheduled Replacement',
          notes: planNotes.trim() || undefined,
          createdBy: actorName,
        });
      } else {
        const roleNeeded =
          driverEmp && attendantEmp
            ? 'driver_and_attendant'
            : attendantEmp
            ? 'attendant'
            : 'driver';
        const created = await RouteOpeningService.createOpening({
          routeId: route.id,
          routeNo: route.routeNo,
          routeName: route.routeName,
          yardId: route.yardId,
          yardName: route.yardName,
          schoolBoardCode: route.schoolBoardCode,
          postingType: 'permanent',
          roleNeeded,
          effectiveStartDate: planStartDate,
          shiftType: planShiftType || 'ALL',
          deadline: `${planStartDate}T17:00`,
          description: planNotes.trim() || `Scheduled permanent assignment effective ${planStartDate}`,
          createdBy: actorName,
          postToChat: false,
        });

        const awardedOpening: RouteOpening = {
          ...created,
          status: 'awarded',
          awardedDriverId: driverEmp ? driverEmp.id : undefined,
          awardedDriverName: driverEmp ? driverEmp.fullName : undefined,
          awardedDriverPhone: driverEmp ? (driverEmp.mobilePhone || driverEmp.workPhonePhone) : undefined,
          awardedAttendantId: attendantEmp ? attendantEmp.id : undefined,
          awardedAttendantName: attendantEmp ? attendantEmp.fullName : undefined,
          awardedAttendantPhone: attendantEmp ? (attendantEmp.mobilePhone || attendantEmp.workPhonePhone) : undefined,
          awardedVehicleId: vehObj ? vehObj.vehicleId : undefined,
          awardedUnitNumber: vehObj ? vehObj.unitNumber : planUnitNumber || undefined,
          awardedPlateNumber: vehObj ? vehObj.plateNumber : undefined,
          awardedAt: new Date().toISOString(),
          awardedBy: actorName,
          awardedNotes: planNotes.trim() || undefined,
          crewAppliedToRoute: false,
        };

        await RouteOpeningService.updateOpening(created.id, {
          status: 'awarded',
          awardedDriverId: awardedOpening.awardedDriverId,
          awardedDriverName: awardedOpening.awardedDriverName,
          awardedDriverPhone: awardedOpening.awardedDriverPhone,
          awardedAttendantId: awardedOpening.awardedAttendantId,
          awardedAttendantName: awardedOpening.awardedAttendantName,
          awardedAttendantPhone: awardedOpening.awardedAttendantPhone,
          awardedVehicleId: awardedOpening.awardedVehicleId,
          awardedUnitNumber: awardedOpening.awardedUnitNumber,
          awardedPlateNumber: awardedOpening.awardedPlateNumber,
          awardedAt: awardedOpening.awardedAt,
          awardedBy: actorName,
          awardedNotes: awardedOpening.awardedNotes,
          crewAppliedToRoute: false,
        });

        const todayStr = getTodayLocalDateStr();
        if (planStartDate <= todayStr) {
          await RouteOpeningService.applyPermanentOpeningCrewToRoute(awardedOpening);
        } else {
          await RouteOpeningService.applyPermanentOpeningToFutureDispatches(awardedOpening);
        }
      }

      await loadScheduleData();
      setScheduledActionMode('none');
      setPlanDriverId('');
      setPlanAttendantId('');
      setPlanUnitNumber('');
      setPlanAutoFilledNote(null);
      setPlanNotes('');
      setActionFeedback({
        type: 'success',
        text: isFrench ? 'Affectation planifiée enregistrée.' : 'Scheduled assignment saved.',
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err?.message || 'Failed to save scheduled assignment',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handlePublishPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;
    if (!publishStartDate || !publishDeadline) {
      setActionFeedback({
        type: 'error',
        text: isFrench
          ? 'Veuillez saisir la date de début et la date limite.'
          : 'Please enter the effective start date and application deadline.',
      });
      return;
    }

    setActionSubmitting(true);
    setActionFeedback(null);
    const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

    try {
      await RouteOpeningService.createOpening({
        routeId: route.id,
        routeNo: route.routeNo,
        routeName: route.routeName,
        yardId: route.yardId,
        yardName: route.yardName,
        schoolBoardCode: route.schoolBoardCode,
        postingType: publishPostingType,
        roleNeeded: publishRoleNeeded,
        effectiveStartDate: publishStartDate,
        effectiveEndDate:
          publishPostingType === 'temporary' && publishEndDate ? publishEndDate : undefined,
        shiftType: publishShiftType || 'ALL',
        deadline: publishDeadline,
        description: publishDescription.trim() || undefined,
        createdBy: actorName,
        postToChat: publishPostToChat,
      });

      await loadScheduleData();
      setScheduledActionMode('none');
      setPublishDescription('');
      setActionFeedback({
        type: 'success',
        text: isFrench ? 'Poste publié avec succès.' : 'Position published successfully.',
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err?.message || 'Failed to publish position',
      });
    } finally {
      setActionSubmitting(false);
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

        {/* Tabs */}
        <div className="px-4 sm:px-6 border-b border-slate-800 bg-slate-900/95 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('assign')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'assign'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Affecter équipage & véhicule' : 'Assign Crew & Vehicle'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scheduled')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'scheduled'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Affectations actives & planifiées' : 'Active & Scheduled'}</span>
            {scheduleSummary.upcomingAndActiveCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {scheduleSummary.upcomingAndActiveCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'scheduled' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Quick Action Bar: Schedule Future Assignment or Publish Position */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 border border-slate-800/80 rounded-2xl px-4 py-3">
              <div className="text-xs text-slate-300">
                {isFrench
                  ? 'Planifier un changement futur ou publier un poste ouvert pour cette route'
                  : 'Plan a future crew change or publish an open position for this route'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActionFeedback(null);
                    setScheduledActionMode((prev) =>
                      prev === 'schedule_assign' ? 'none' : 'schedule_assign'
                    );
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${
                    scheduledActionMode === 'schedule_assign'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isFrench ? 'Planifier une affectation' : 'Schedule Assignment'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionFeedback(null);
                    setScheduledActionMode((prev) =>
                      prev === 'publish_opening' ? 'none' : 'publish_opening'
                    );
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${
                    scheduledActionMode === 'publish_opening'
                      ? 'bg-indigo-500 text-white border-indigo-400'
                      : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25'
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>{isFrench ? 'Publier le poste' : 'Publish Position'}</span>
                </button>
              </div>
            </div>

            {actionFeedback && (
              <div
                className={`px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  actionFeedback.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <span>{actionFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setActionFeedback(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Inline Form 1: Schedule Future Assignment */}
            {scheduledActionMode === 'schedule_assign' && (
              <form
                onSubmit={handleCreateScheduledAssignment}
                className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4" />
                    <span>{isFrench ? 'Nouvelle affectation planifiée' : 'New Scheduled Assignment'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setScheduledActionMode('none')}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    {isFrench ? 'Annuler' : 'Cancel'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Type' : 'Assignment Type'}
                    </label>
                    <select
                      value={planKind}
                      onChange={(e) => setPlanKind(e.target.value as 'permanent' | 'temporary')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="permanent">
                        {isFrench ? 'Permanent (À partir du...)' : 'Permanent (Effective Date)'}
                      </option>
                      <option value="temporary">
                        {isFrench ? 'Remplacement temporaire' : 'Temporary Coverage'}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {planKind === 'permanent'
                        ? isFrench ? 'Date d\'entrée en vigueur *' : 'Effective Start Date *'
                        : isFrench ? 'Date de début *' : 'Start Date *'}
                    </label>
                    <input
                      type="date"
                      value={planStartDate}
                      onChange={(e) => setPlanStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {planKind === 'temporary' ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {isFrench ? 'Date de fin' : 'End Date'}
                      </label>
                      <input
                        type="date"
                        value={planEndDate}
                        min={planStartDate}
                        onChange={(e) => setPlanEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {isFrench ? 'Quart' : 'Shift'}
                      </label>
                      <select
                        value={planShiftType}
                        onChange={(e) => setPlanShiftType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="ALL">ALL</option>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                        <option value="Midday">Midday</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Chauffeur' : 'Driver'}
                    </label>
                    <SearchableSelect
                      variant="dark"
                      compact
                      value={planDriverId}
                      onChange={handlePlanDriverChange}
                      options={driverSelectOptions}
                      emptyOptionLabel={isFrench ? '-- Aucun changement --' : '-- No Driver Change --'}
                      searchPlaceholder={isFrench ? 'Rechercher chauffeur...' : 'Search driver...'}
                      noResultsText={isFrench ? 'Aucun chauffeur trouvé' : 'No matching drivers'}
                      accentColor="amber"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Véhicule' : 'Vehicle'}
                    </label>
                    <SearchableSelect
                      variant="dark"
                      compact
                      value={planUnitNumber}
                      onChange={(val) => {
                        setPlanUnitNumber(val);
                        setPlanAutoFilledNote(null);
                      }}
                      options={vehicleSelectOptions}
                      emptyOptionLabel={isFrench ? '-- Aucun changement --' : '-- No Vehicle Change --'}
                      searchPlaceholder={isFrench ? 'Rechercher unité #...' : 'Search unit #...'}
                      noResultsText={isFrench ? 'Aucun véhicule trouvé' : 'No matching vehicles'}
                      accentColor="amber"
                    />
                    {planAutoFilledNote && (
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>{planAutoFilledNote}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Accompagnateur' : 'Attendant'}
                    </label>
                    <SearchableSelect
                      variant="dark"
                      compact
                      value={planAttendantId}
                      onChange={setPlanAttendantId}
                      options={attendantSelectOptions}
                      emptyOptionLabel={isFrench ? '-- Aucun changement --' : '-- No Attendant Change --'}
                      searchPlaceholder={isFrench ? 'Rechercher accompagnateur...' : 'Search attendant...'}
                      noResultsText={isFrench ? 'Aucun accompagnateur trouvé' : 'No matching attendants'}
                      accentColor="indigo"
                    />
                  </div>
                </div>

                {planKind === 'temporary' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {isFrench ? 'Quart' : 'Shift'}
                      </label>
                      <select
                        value={planShiftType}
                        onChange={(e) => setPlanShiftType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="ALL">ALL</option>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                        <option value="Midday">Midday</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {isFrench ? 'Motif' : 'Reason'}
                      </label>
                      <input
                        type="text"
                        value={planReason}
                        onChange={(e) => setPlanReason(e.target.value)}
                        placeholder="Vacation / Medical / Training..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {isFrench ? 'Notes (optionnel)' : 'Notes (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={planNotes}
                    onChange={(e) => setPlanNotes(e.target.value)}
                    placeholder={isFrench ? 'Détails supplémentaires...' : 'Additional schedule notes...'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setScheduledActionMode('none')}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    {isFrench ? 'Annuler' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={actionSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50"
                  >
                    {actionSubmitting
                      ? isFrench ? 'Enregistrement...' : 'Saving...'
                      : isFrench ? 'Enregistrer la planification' : 'Save Scheduled Assignment'}
                  </button>
                </div>
              </form>
            )}

            {/* Inline Form 2: Publish Position (Route Opening) */}
            {scheduledActionMode === 'publish_opening' && (
              <form
                onSubmit={handlePublishPosition}
                className="bg-slate-950/80 border border-indigo-500/40 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Megaphone className="w-4 h-4" />
                    <span>{isFrench ? 'Publier un poste pour cette route' : 'Publish Position (Route Opening)'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setScheduledActionMode('none')}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    {isFrench ? 'Annuler' : 'Cancel'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Type de poste' : 'Posting Type'}
                    </label>
                    <select
                      value={publishPostingType}
                      onChange={(e) => setPublishPostingType(e.target.value as 'permanent' | 'temporary')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="permanent">{isFrench ? 'Permanent' : 'Permanent'}</option>
                      <option value="temporary">{isFrench ? 'Temporaire' : 'Temporary Coverage'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Rôle requis' : 'Role Needed'}
                    </label>
                    <select
                      value={publishRoleNeeded}
                      onChange={(e) =>
                        setPublishRoleNeeded(e.target.value as 'driver' | 'attendant' | 'driver_and_attendant')
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="driver">{isFrench ? 'Chauffeur' : 'Driver'}</option>
                      <option value="attendant">{isFrench ? 'Accompagnateur' : 'Attendant'}</option>
                      <option value="driver_and_attendant">
                        {isFrench ? 'Chauffeur & Accompagnateur' : 'Driver & Attendant'}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Quart' : 'Shift'}
                    </label>
                    <select
                      value={publishShiftType}
                      onChange={(e) => setPublishShiftType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="ALL">ALL</option>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                      <option value="Midday">Midday</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Date de début *' : 'Effective Start Date *'}
                    </label>
                    <input
                      type="date"
                      value={publishStartDate}
                      onChange={(e) => setPublishStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  {publishPostingType === 'temporary' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {isFrench ? 'Date de fin' : 'Effective End Date'}
                      </label>
                      <input
                        type="date"
                        value={publishEndDate}
                        min={publishStartDate}
                        onChange={(e) => setPublishEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {isFrench ? 'Date limite *' : 'Application Deadline *'}
                    </label>
                    <input
                      type="datetime-local"
                      value={publishDeadline}
                      onChange={(e) => setPublishDeadline(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {isFrench ? 'Description / Exigences (optionnel)' : 'Description / Notes (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={publishDescription}
                    onChange={(e) => setPublishDescription(e.target.value)}
                    placeholder={isFrench ? 'Détails du poste...' : 'Route details or requirements...'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishPostToChat}
                    onChange={(e) => setPublishPostToChat(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700"
                  />
                  <span>
                    {isFrench
                      ? 'Diffuser l\'annonce dans Fleet Chat'
                      : 'Broadcast announcement to Fleet Chat'}
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setScheduledActionMode('none')}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    {isFrench ? 'Annuler' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={actionSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {actionSubmitting
                      ? isFrench ? 'Publication...' : 'Publishing...'
                      : isFrench ? 'Publier le poste' : 'Publish Position'}
                  </button>
                </div>
              </form>
            )}

            {scheduleLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>{isFrench ? 'Chargement des affectations planifiées...' : 'Loading active and scheduled assignments...'}</span>
              </div>
            )}

            {/* 1. Current Standing Assignment */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isFrench ? 'Équipage principal actuel (Fixe)' : 'Current Standing Assignment'}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">{route.routeNo}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isFrench ? 'Chauffeur' : 'Driver'}</span>
                  </div>
                  <div className="font-semibold text-white">
                    {route.driverName || <span className="text-slate-500 italic">{isFrench ? 'Non assigné' : 'Unassigned'}</span>}
                  </div>
                  {route.driverPhone && <div className="text-[11px] text-slate-400 mt-0.5">{route.driverPhone}</div>}
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <Bus className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isFrench ? 'Véhicule' : 'Vehicle'}</span>
                  </div>
                  <div className="font-semibold text-white">
                    {route.unitNumber ? `Unit #${route.unitNumber}` : <span className="text-slate-500 italic">{isFrench ? 'Non assigné' : 'Unassigned'}</span>}
                  </div>
                  {route.plateNumber && <div className="text-[11px] text-slate-400 mt-0.5">{route.plateNumber}</div>}
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isFrench ? 'Accompagnateur' : 'Attendant'}</span>
                  </div>
                  <div className="font-semibold text-white">
                    {route.attendantName || <span className="text-slate-500 italic">{isFrench ? 'Aucun' : 'None'}</span>}
                  </div>
                  {route.attendantPhone && <div className="text-[11px] text-slate-400 mt-0.5">{route.attendantPhone}</div>}
                </div>
              </div>

              {scheduleSummary.shiftOverrides.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                    {isFrench ? 'Exceptions par quart (AM / PM)' : 'Shift-Specific Crew Overrides'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {scheduleSummary.shiftOverrides.map(({ shift }) => (
                      <div key={shift.shiftId} className="p-2.5 rounded-xl bg-slate-900/70 border border-amber-500/20 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono font-bold text-[10px]">
                            {shift.shiftType}
                          </span>
                          <span className="text-[11px] text-slate-400">{shift.firstStopTime} - {shift.lastStopTime}</span>
                        </div>
                        <div className="text-slate-200">
                          {shift.driverName ? `Driver: ${shift.driverName}` : ''}
                          {shift.unitNumber ? ` • Unit #${shift.unitNumber}` : ''}
                          {shift.attendantName ? ` • Att: ${shift.attendantName}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Active & Upcoming Temporary Substitutions */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{isFrench ? 'Remplacements temporaires actifs et à venir' : 'Active & Upcoming Temporary Coverage'}</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {scheduleSummary.temporaryCovers.length}
                </span>
              </div>

              {scheduleSummary.temporaryCovers.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  {isFrench
                    ? 'Aucun remplacement temporaire actif ou planifié pour cette route.'
                    : 'No active or upcoming temporary substitutions scheduled for this route.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {scheduleSummary.temporaryCovers.map(({ assignment: ta, phase, dateSummary }) => (
                    <div
                      key={ta.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        phase === 'active_now'
                          ? 'bg-emerald-950/25 border-emerald-500/35'
                          : 'bg-amber-950/20 border-amber-500/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              phase === 'active_now'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {phase === 'active_now'
                              ? (isFrench ? 'En cours' : 'Active Now')
                              : (isFrench ? 'Planifié' : 'Upcoming')}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px] font-bold">
                            {ta.shiftType || 'ALL'}
                          </span>
                          <span className="text-slate-200 font-semibold">{dateSummary}</span>
                        </div>
                        {ta.reason && (
                          <span className="text-[11px] text-slate-400">{ta.reason}</span>
                        )}
                      </div>

                      <div className="space-y-1 text-slate-200">
                        {(ta.temporaryDriverName || ta.temporaryDriverId) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-semibold text-white">{ta.temporaryDriverName || ta.temporaryDriverId}</span>
                            {ta.originalDriverName && (
                              <span className="text-slate-400 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                <span>{isFrench ? `Remplace ${ta.originalDriverName}` : `Covering for ${ta.originalDriverName}`}</span>
                              </span>
                            )}
                          </div>
                        )}
                        {(ta.temporaryAttendantName || ta.temporaryAttendantId) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="font-semibold text-white">{ta.temporaryAttendantName || ta.temporaryAttendantId}</span>
                            {ta.originalAttendantName && (
                              <span className="text-slate-400 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                <span>{isFrench ? `Remplace ${ta.originalAttendantName}` : `Covering for ${ta.originalAttendantName}`}</span>
                              </span>
                            )}
                          </div>
                        )}
                        {ta.temporaryUnitNumber && (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Bus className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span>
                              {isFrench ? 'Véhicule de remplacement :' : 'Relief Vehicle:'} Unit #{ta.temporaryUnitNumber}
                              {ta.temporaryPlateNumber ? ` (${ta.temporaryPlateNumber})` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {ta.notes && (
                        <div className="text-[11px] text-slate-400 bg-slate-900/70 rounded-lg px-2.5 py-1.5">
                          {ta.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Scheduled Future Permanent Changes & Open Postings */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4" />
                  <span>{isFrench ? 'Changements futurs & offres en cours' : 'Scheduled Future Assignments & Open Postings'}</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {scheduleSummary.scheduledOpenings.length}
                </span>
              </div>

              {scheduleSummary.scheduledOpenings.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  {isFrench
                    ? 'Aucun changement futur planifié ni offre ouverte pour cette route.'
                    : 'No future permanent assignments or open postings for this route.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {scheduleSummary.scheduledOpenings.map(({ opening, kind }) => (
                    <div
                      key={opening.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        kind === 'scheduled_permanent'
                          ? 'bg-indigo-950/25 border-indigo-500/35'
                          : kind === 'scheduled_temporary'
                          ? 'bg-sky-950/25 border-sky-500/35'
                          : 'bg-slate-900/80 border-slate-700'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              kind === 'scheduled_permanent'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : kind === 'scheduled_temporary'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {kind === 'scheduled_permanent'
                              ? (isFrench ? 'Permanent planifié' : 'Scheduled Permanent')
                              : kind === 'scheduled_temporary'
                              ? (isFrench ? 'Temporaire attribué' : 'Awarded Temporary')
                              : (isFrench ? (opening.status === 'reviewing' ? 'En révision' : 'Offre ouverte') : (opening.status === 'reviewing' ? 'Reviewing' : 'Open Posting'))}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px] font-bold">
                            {opening.shiftType || 'ALL'}
                          </span>
                          <span className="font-semibold text-white">
                            {isFrench ? 'À compter du' : 'Effective:'} {opening.effectiveStartDate}
                            {opening.effectiveEndDate ? ` -> ${opening.effectiveEndDate}` : ''}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 uppercase">{opening.roleNeeded.replace(/_/g, ' ')}</span>
                      </div>

                      {kind !== 'open_posting' ? (
                        <div className="space-y-1 text-slate-200">
                          {opening.awardedDriverName && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>
                                {isFrench ? 'Nouveau chauffeur :' : 'Assigned Driver:'}{' '}
                                <strong className="text-white">{opening.awardedDriverName}</strong>
                              </span>
                            </div>
                          )}
                          {opening.awardedUnitNumber && (
                            <div className="flex items-center gap-1.5">
                              <Bus className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span>
                                {isFrench ? 'Véhicule :' : 'Assigned Vehicle:'}{' '}
                                <strong className="text-white">Unit #{opening.awardedUnitNumber}</strong>
                                {opening.awardedPlateNumber ? ` (${opening.awardedPlateNumber})` : ''}
                              </span>
                            </div>
                          )}
                          {opening.awardedAttendantName && (
                            <div className="flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>
                                {isFrench ? 'Nouvel accompagnateur :' : 'Assigned Attendant:'}{' '}
                                <strong className="text-white">{opening.awardedAttendantName}</strong>
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                          <span>{opening.title}</span>
                          <span className="text-[11px] text-amber-300 font-semibold">
                            {opening.applicants.length} {isFrench ? 'candidat(s)' : 'applicant(s)'}
                          </span>
                        </div>
                      )}

                      {opening.awardedNotes && (
                        <div className="text-[11px] text-slate-400 bg-slate-900/70 rounded-lg px-2.5 py-1.5">
                          {opening.awardedNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Recent Route Assignment History */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-400" />
                  <span>{isFrench ? 'Historique récent de la route' : 'Recent Route Assignment History'}</span>
                </span>
                <span className="text-[11px] text-slate-500">{recentHistory.length}</span>
              </div>

              {recentHistory.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  {isFrench ? 'Aucun historique récent enregistré.' : 'No recent assignment changes recorded.'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {recentHistory.map((h) => (
                    <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-slate-400">{h.effectiveDate || (h.timestamp || '').slice(0, 10)}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            h.action === 'assign'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {h.action}
                        </span>
                        <span className="text-slate-200 font-medium truncate">
                          {h.driverName || h.driverId}
                          {h.unitNumber ? ` • Unit #${h.unitNumber}` : ''}
                        </span>
                      </div>
                      {h.assignedBy && (
                        <span className="text-[11px] text-slate-500 truncate">{h.assignedBy}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setActiveTab('assign')}
                className="px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-slate-800 rounded-lg transition"
              >
                {isFrench ? 'Retour à l\'affectation' : 'Back to Assign Crew'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition"
              >
                {isFrench ? 'Fermer' : 'Close'}
              </button>
            </div>
          </div>
        ) : (
        /* Form Body */
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
                <SearchableSelect
                  testId="route-assign-driver-select"
                  variant="dark"
                  value={selectedDriverId}
                  onChange={handleDriverChange}
                  options={driverSelectOptions}
                  emptyOptionLabel="-- Choose Driver --"
                  searchPlaceholder={
                    isFrench ? 'Rechercher chauffeur (nom, #, route)...' : 'Search driver (name, #, role, route)...'
                  }
                  noResultsText={isFrench ? 'Aucun chauffeur trouvé' : 'No matching drivers found'}
                  icon={<User className="w-3.5 h-3.5 text-amber-400" />}
                  accentColor="amber"
                />

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
                <SearchableSelect
                  testId="route-assign-vehicle-select"
                  variant="dark"
                  value={selectedUnitNumber}
                  onChange={setSelectedUnitNumber}
                  options={vehicleSelectOptions}
                  emptyOptionLabel="-- Choose Unit --"
                  searchPlaceholder={
                    isFrench
                      ? 'Rechercher véhicule (unité, plaque, modèle)...'
                      : 'Search vehicle (unit #, plate, model, driver)...'
                  }
                  noResultsText={isFrench ? 'Aucun véhicule trouvé' : 'No matching vehicles found'}
                  icon={<Bus className="w-3.5 h-3.5 text-amber-400" />}
                  accentColor="amber"
                />
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
              <SearchableSelect
                testId="route-assign-attendant-select"
                variant="dark"
                value={selectedAttendantId}
                onChange={setSelectedAttendantId}
                options={attendantSelectOptions}
                emptyOptionLabel="-- No Attendant Assigned --"
                searchPlaceholder={
                  isFrench
                    ? 'Rechercher accompagnateur (nom, #, route)...'
                    : 'Search attendant (name, #, role, route)...'
                }
                noResultsText={isFrench ? 'Aucun accompagnateur trouvé' : 'No matching attendants found'}
                icon={<Shield className="w-3.5 h-3.5 text-indigo-400" />}
                accentColor="indigo"
              />

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
                          <SearchableSelect
                            variant="dark"
                            compact
                            value={shiftOv.driverId}
                            onChange={(val) => handleShiftDriverChange(String(shift.shiftId), val)}
                            options={driverSelectOptions}
                            emptyOptionLabel="-- Same as Route --"
                            searchPlaceholder="Search driver..."
                            noResultsText="No matching drivers found"
                            accentColor="amber"
                          />
                        </div>

                        {/* Shift Vehicle */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Shift Vehicle
                          </label>
                          <SearchableSelect
                            variant="dark"
                            compact
                            value={shiftOv.unitNumber}
                            onChange={(val) => handleShiftFieldChange(String(shift.shiftId), 'unitNumber', val)}
                            options={vehicleSelectOptions}
                            emptyOptionLabel="-- Same as Route --"
                            searchPlaceholder="Search unit #..."
                            noResultsText="No matching vehicles found"
                            accentColor="amber"
                          />
                        </div>

                        {/* Shift Attendant */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Shift Attendant
                          </label>
                          <SearchableSelect
                            variant="dark"
                            compact
                            value={shiftOv.attendantId}
                            onChange={(val) => handleShiftFieldChange(String(shift.shiftId), 'attendantId', val)}
                            options={attendantSelectOptions}
                            emptyOptionLabel="-- None / Default --"
                            searchPlaceholder="Search attendant..."
                            noResultsText="No matching attendants found"
                            accentColor="indigo"
                          />
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
        )}
      </div>
    </div>
  );
};
