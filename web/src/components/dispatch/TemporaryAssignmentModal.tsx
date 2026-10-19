import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, UserCheck, Save, ShieldAlert, Zap, Home, Search, Radio } from 'lucide-react';
import { TemporaryAssignment, CreateTemporaryAssignmentPayload, UpdateTemporaryAssignmentPayload } from '../../types/dispatch';
import { BusRoute, BusRouteShift } from '../../types/route';
import { RouteService } from '../../services/routeService';
import { Employee } from '../../types/employee';
import { Vehicle } from '../../types/vehicle';
import { DispatchService } from '../../services/dispatchService';
import { DefectService } from '../../services/defectService';
import { VehicleInspectionService } from '../../services/vehicleInspectionService';
import { VehicleDefectReport } from '../../types/defect';
import { VehicleInspectionRecord, PreventiveMaintenanceRecord } from '../../types/vehicleInspection';
import { getUnavailableVehiclesForDate, filterAvailableVehicles } from '../../utils/vehicleAvailabilityUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import {
  sortDriversByDeadhead,
  sortAttendantsByDeadhead,
  calculateDriverDeadhead,
  calculateAttendantDeadhead
} from '../../utils/deadheadCalculator';

interface TemporaryAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: TemporaryAssignment | null;
  routes: BusRoute[];
  employees: Employee[];
  vehicles: Vehicle[];
  onSaved: () => void;
  onSwitchToRouteOpening?: () => void;
}

export const TemporaryAssignmentModal: React.FC<TemporaryAssignmentModalProps> = ({
  isOpen,
  onClose,
  assignment,
  routes,
  employees,
  vehicles,
  onSaved,
  onSwitchToRouteOpening
}) => {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  const todayStr = new Date().toISOString().split('T')[0];

  const [routeId, setRouteId] = useState('');
  const [shiftType, setShiftType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState<string>('Sick Leave');
  const [temporaryDriverId, setTemporaryDriverId] = useState('');
  const [temporaryAttendantId, setTemporaryAttendantId] = useState('');
  const [temporaryVehicleId, setTemporaryVehicleId] = useState('');
  const [status, setStatus] = useState<string>('active');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state
  useEffect(() => {
    if (assignment) {
      setRouteId(assignment.routeId);
      setShiftType(assignment.shiftType || 'ALL');
      setStartDate(assignment.startDate || todayStr);
      setEndDate(assignment.endDate || todayStr);
      setReason(assignment.reason || 'Sick Leave');
      setTemporaryDriverId(assignment.temporaryDriverId || '');
      setTemporaryAttendantId(assignment.temporaryAttendantId || '');
      setTemporaryVehicleId(assignment.temporaryVehicleId ? String(assignment.temporaryVehicleId) : '');
      setStatus(assignment.status || 'active');
      setNotes(assignment.notes || '');
    } else {
      setRouteId(routes.length > 0 ? routes[0].id : '');
      setShiftType('ALL');
      setStartDate(todayStr);
      setEndDate(todayStr);
      setReason('Sick Leave');
      setTemporaryDriverId('');
      setTemporaryAttendantId('');
      setTemporaryVehicleId('');
      setStatus('active');
      setNotes('');
    }
    setError(null);
  }, [assignment, isOpen, routes, todayStr]);

  const { t } = useI18n();
  const [sortByDeadhead, setSortByDeadhead] = useState(true);

  const [defects, setDefects] = useState<VehicleDefectReport[]>([]);
  const [inspections, setInspections] = useState<VehicleInspectionRecord[]>([]);
  const [pmRecords, setPmRecords] = useState<PreventiveMaintenanceRecord[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubDefects = DefectService.subscribeToDefects((data) => {
      setDefects(Array.isArray(data) ? data : []);
    });
    VehicleInspectionService.getInspections(vehicles)
      .then((list) => setInspections(Array.isArray(list) ? list : []))
      .catch(() => {});
    VehicleInspectionService.getPMRecords(vehicles)
      .then((list) => setPmRecords(Array.isArray(list) ? list : []))
      .catch(() => {});
    return () => {
      unsubDefects();
    };
  }, [isOpen, vehicles]);

  const unavailableMap = useMemo(
    () => getUnavailableVehiclesForDate(startDate || todayStr, defects, inspections, pmRecords, vehicles),
    [startDate, todayStr, defects, inspections, pmRecords, vehicles]
  );

  const selectedRoute = routes.find((r) => r.id === routeId);
  const activeEmployees = employees.filter((e) => e.isActive !== false);
  const activeVehicles = useMemo(
    () => filterAvailableVehicles(vehicles.filter((v) => v.active !== false), unavailableMap),
    [vehicles, unavailableMap]
  );

  // Load full shifts with stops for deadhead calculation
  const [loadedShifts, setLoadedShifts] = useState<BusRouteShift[]>([]);

  useEffect(() => {
    if (!isOpen || !routeId) {
      setLoadedShifts([]);
      return;
    }
    let isCancelled = false;
    RouteService.getShiftsForRoute(routeId)
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
  }, [isOpen, routeId]);

  const routeReferenceStops = React.useMemo(() => {
    if (loadedShifts.length === 0) return [];
    const amShift = loadedShifts.find(
      (s) => (s.shiftType || '').toUpperCase() === 'AM' && s.stops && s.stops.length > 0
    );
    if (amShift && amShift.stops) return amShift.stops;
    const anyShiftWithStops = loadedShifts.find((s) => s.stops && s.stops.length > 0);
    return anyShiftWithStops && anyShiftWithStops.stops ? anyShiftWithStops.stops : [];
  }, [loadedShifts]);

  const selectedDriverObj = employees.find((e) => e.id === temporaryDriverId) || null;
  const selectedAttendantObj = employees.find((e) => e.id === temporaryAttendantId) || null;

  const rankedDrivers = React.useMemo(() => {
    if (routeReferenceStops.length === 0 || !sortByDeadhead) {
      return activeEmployees.map((d) => ({
        employee: d,
        deadhead: calculateDriverDeadhead(d, routeReferenceStops)
      }));
    }
    return sortDriversByDeadhead(activeEmployees, routeReferenceStops);
  }, [activeEmployees, routeReferenceStops, sortByDeadhead]);

  const rankedAttendants = React.useMemo(() => {
    if (routeReferenceStops.length === 0 || !sortByDeadhead) {
      return activeEmployees.map((a) => ({
        employee: a,
        deadhead: calculateAttendantDeadhead(a, selectedDriverObj, routeReferenceStops)
      }));
    }
    return sortAttendantsByDeadhead(activeEmployees, selectedDriverObj, routeReferenceStops);
  }, [activeEmployees, selectedDriverObj, routeReferenceStops, sortByDeadhead]);

  const selectedDriverDeadhead = React.useMemo(() => {
    if (!selectedDriverObj || routeReferenceStops.length === 0) return null;
    return calculateDriverDeadhead(selectedDriverObj, routeReferenceStops);
  }, [selectedDriverObj, routeReferenceStops]);

  const selectedAttendantDeadhead = React.useMemo(() => {
    if (!selectedAttendantObj || routeReferenceStops.length === 0) return null;
    return calculateAttendantDeadhead(selectedAttendantObj, selectedDriverObj, routeReferenceStops);
  }, [selectedAttendantObj, selectedDriverObj, routeReferenceStops]);

  // Search state for Replacement Driver, Attendant, and Vehicle
  const [driverSearch, setDriverSearch] = useState('');
  const [attendantSearch, setAttendantSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Filter rankedDrivers by driverSearch
  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    if (!q) return rankedDrivers;
    return rankedDrivers.filter(({ employee: e }) => {
      const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
      const role = (e.role || '').toLowerCase();
      const num = (e.employeeNumber || e.id || '').toLowerCase();
      const phone = (e.mobilePhone || e.preferredPhone || e.homePhone || '').toLowerCase();
      return name.includes(q) || role.includes(q) || num.includes(q) || phone.includes(q) || e.id === temporaryDriverId;
    });
  }, [rankedDrivers, driverSearch, temporaryDriverId]);

  // Filter rankedAttendants by attendantSearch
  const filteredAttendants = useMemo(() => {
    const q = attendantSearch.trim().toLowerCase();
    if (!q) return rankedAttendants;
    return rankedAttendants.filter(({ employee: e }) => {
      const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
      const role = (e.role || '').toLowerCase();
      const num = (e.employeeNumber || e.id || '').toLowerCase();
      const phone = (e.mobilePhone || e.preferredPhone || e.homePhone || '').toLowerCase();
      return name.includes(q) || role.includes(q) || num.includes(q) || phone.includes(q) || e.id === temporaryAttendantId;
    });
  }, [rankedAttendants, attendantSearch, temporaryAttendantId]);

  // Filter activeVehicles by vehicleSearch
  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return activeVehicles;
    return activeVehicles.filter((v) => {
      const unit = String(v.unitNumber || v.id || '').toLowerCase();
      const plate = (v.plateNumber || '').toLowerCase();
      const make = `${v.manufacturer || ''} ${v.model || ''}`.toLowerCase();
      const yard = (v.yardName || '').toLowerCase();
      return unit.includes(q) || plate.includes(q) || make.includes(q) || yard.includes(q) || String(v.id) === String(temporaryVehicleId);
    });
  }, [activeVehicles, vehicleSearch, temporaryVehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeId) {
      setError('Please select a route.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }
    if (startDate > endDate) {
      setError('Start date cannot be after end date.');
      return;
    }
    if (!temporaryDriverId && !temporaryAttendantId && !temporaryVehicleId) {
      setError('Please select at least one replacement: driver, attendant, or vehicle.');
      return;
    }

    setSaving(true);
    setError(null);

    const replacementDriver = employees.find((e) => e.id === temporaryDriverId);
    const replacementDriverName = replacementDriver ? `${replacementDriver.firstName} ${replacementDriver.lastName}`.trim() : '';
    const replacementDriverPhone = replacementDriver?.mobilePhone || replacementDriver?.preferredPhone || '';

    const replacementAttendant = employees.find((e) => e.id === temporaryAttendantId);
    const replacementAttendantName = replacementAttendant ? `${replacementAttendant.firstName} ${replacementAttendant.lastName}`.trim() : '';
    const replacementAttendantPhone = replacementAttendant?.mobilePhone || replacementAttendant?.preferredPhone || '';

    const replacementVehicle = vehicles.find((v) => String(v.id) === temporaryVehicleId);
    const replacementUnitNumber = replacementVehicle?.unitNumber || (replacementVehicle ? String(replacementVehicle.id) : '');
    const replacementPlateNumber = replacementVehicle?.plateNumber || '';
    const replacementVehicleNumId = replacementVehicle ? Number(replacementVehicle.id) : undefined;

    try {
      if (assignment) {
        const payload: UpdateTemporaryAssignmentPayload = {
          shiftType,
          startDate,
          endDate,
          temporaryDriverId: temporaryDriverId || undefined,
          temporaryDriverName: replacementDriverName || undefined,
          temporaryDriverPhone: replacementDriverPhone || undefined,
          temporaryAttendantId: temporaryAttendantId || undefined,
          temporaryAttendantName: replacementAttendantName || undefined,
          temporaryAttendantPhone: replacementAttendantPhone || undefined,
          temporaryVehicleId: replacementVehicleNumId,
          temporaryUnitNumber: replacementUnitNumber || undefined,
          temporaryPlateNumber: replacementPlateNumber || undefined,
          reason,
          notes,
          status
        };
        await DispatchService.updateTemporaryAssignment(assignment.id, payload);
      } else {
        const payload: CreateTemporaryAssignmentPayload = {
          routeId,
          routeNo: selectedRoute?.routeNo || routeId,
          routeName: selectedRoute?.routeName || selectedRoute?.routeNo || routeId,
          shiftType,
          startDate,
          endDate,
          originalDriverId: selectedRoute?.driverId || '',
          originalDriverName: selectedRoute?.driverName || '',
          temporaryDriverId: temporaryDriverId || undefined,
          temporaryDriverName: replacementDriverName || undefined,
          temporaryDriverPhone: replacementDriverPhone || undefined,
          originalAttendantId: selectedRoute?.attendantId || '',
          originalAttendantName: selectedRoute?.attendantName || '',
          temporaryAttendantId: temporaryAttendantId || undefined,
          temporaryAttendantName: replacementAttendantName || undefined,
          temporaryAttendantPhone: replacementAttendantPhone || undefined,
          temporaryVehicleId: replacementVehicleNumId,
          temporaryUnitNumber: replacementUnitNumber || undefined,
          temporaryPlateNumber: replacementPlateNumber || undefined,
          reason,
          notes,
          createdBy: actorName
        };
        await DispatchService.createTemporaryAssignment(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save temporary assignment:', err);
      setError(err?.message || 'Failed to save temporary assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {assignment ? 'Edit Temporary Assignment' : 'New Temporary Assignment'}
              </h2>
              <p className="text-xs text-slate-400">
                Schedule temporary crew or vehicle replacement for route absences
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onSwitchToRouteOpening && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToRouteOpening();
                }}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/30 transition shadow-sm"
                title="Post route opening to bidding board instead of manual assignment"
              >
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Post Route Opening instead</span>
                <span className="sm:hidden">Post Opening</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2.5 text-rose-400 text-sm">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Route & Shift Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Target Route *
              </label>
              <select
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                disabled={!!assignment}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.routeNo ? `${r.routeNo} - ${r.routeName}` : r.routeName || r.id}
                  </option>
                ))}
              </select>

              {selectedRoute && (
                <div className="mt-2 text-xs text-slate-400 bg-slate-800/40 p-2.5 rounded border border-slate-800 space-y-1">
                  <div>
                    <span className="text-slate-500">Regular Driver:</span>{' '}
                    <span className="text-slate-200 font-medium">
                      {selectedRoute.driverName || 'None assigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Regular Attendant:</span>{' '}
                    <span className="text-slate-200 font-medium">
                      {selectedRoute.attendantName || 'None assigned'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Shift Coverage *
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Shifts (AM, PM, Midday)</option>
                <option value="AM">Morning (AM) Only</option>
                <option value="PM">Afternoon (PM) Only</option>
                <option value="Midday">Midday / Noon Only</option>
              </select>
              <p className="mt-2 text-xs text-slate-500">
                When generating daily dispatch, temporary replacements apply to the selected shift types.
              </p>
            </div>
          </div>

          {/* Date Range */}
          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Coverage Date Range *</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Start Date (Inclusive)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">End Date (Inclusive)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Absence Reason & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Absence Reason *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="Sick Leave">Sick Leave</option>
                <option value="Vacation">Vacation / Leave</option>
                <option value="Driver Training">Driver Training / Cert</option>
                <option value="Medical Appointment">Medical Appointment</option>
                <option value="Vehicle Maintenance">Vehicle Maintenance</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Assignment Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="active">Active (Prioritized during dispatch generation)</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Replacement Crew Selection */}
          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Replacement Crew & Vehicle (Select applicable)
              </div>
              <button
                type="button"
                onClick={() => setSortByDeadhead(!sortByDeadhead)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition border cursor-pointer ${
                  sortByDeadhead
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title={sortByDeadhead ? t.deadhead.sortByName : t.deadhead.sortByDeadhead}
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{sortByDeadhead ? t.deadhead.sortByDeadhead : t.deadhead.sortByName}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Driver */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Replacement Driver</label>
                  {temporaryDriverId && (
                    <button
                      type="button"
                      onClick={() => setTemporaryDriverId('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Driver Search Input */}
                <div className="relative mb-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    placeholder="Search driver name, ID..."
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {driverSearch && (
                    <button
                      type="button"
                      onClick={() => setDriverSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={temporaryDriverId}
                  onChange={(e) => setTemporaryDriverId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- No Replacement Driver --</option>
                  {filteredDrivers.length === 0 ? (
                    <option disabled value="__empty">No drivers match &quot;{driverSearch}&quot;</option>
                  ) : (
                    filteredDrivers.map(({ employee: e, deadhead }) => {
                      const deadheadText = deadhead.hasCoordinates
                        ? ` [~${deadhead.totalDeadheadKm} km (${deadhead.pullOutKm} km to start)]`
                        : ` [${t.deadhead.noGpsCoordinates}]`;
                      return (
                        <option key={e.id} value={e.id}>
                          {e.firstName} {e.lastName} ({e.role || 'Driver'}){deadheadText}
                        </option>
                      );
                    })
                  )}
                </select>

                {selectedDriverDeadhead && selectedDriverDeadhead.hasCoordinates && (
                  <div className="mt-1.5 p-1.5 rounded bg-slate-900 border border-amber-500/30 text-[10px] font-mono text-slate-400 space-y-0.5">
                    <div className="text-amber-400 font-bold flex items-center gap-1">
                      <Home className="w-2.5 h-2.5" />
                      <span>~{selectedDriverDeadhead.totalDeadheadKm} km {t.deadhead.totalDeadhead}</span>
                    </div>
                    <div>{selectedDriverDeadhead.pullOutKm} km to 1st stop • {selectedDriverDeadhead.pullInKm} km return</div>
                  </div>
                )}
              </div>

              {/* Attendant */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Replacement Attendant</label>
                  {temporaryAttendantId && (
                    <button
                      type="button"
                      onClick={() => setTemporaryAttendantId('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Attendant Search Input */}
                <div className="relative mb-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={attendantSearch}
                    onChange={(e) => setAttendantSearch(e.target.value)}
                    placeholder="Search attendant..."
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {attendantSearch && (
                    <button
                      type="button"
                      onClick={() => setAttendantSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={temporaryAttendantId}
                  onChange={(e) => setTemporaryAttendantId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- No Replacement Attendant --</option>
                  {filteredAttendants.length === 0 ? (
                    <option disabled value="__empty">No attendants match &quot;{attendantSearch}&quot;</option>
                  ) : (
                    filteredAttendants.map(({ employee: e, deadhead }) => {
                      let deadheadText = '';
                      if (deadhead.hasCoordinates) {
                        if (deadhead.distanceToDriverKm !== undefined) {
                          deadheadText = ` [${deadhead.distanceToDriverKm} km ${t.deadhead.toDriverHome}]`;
                        } else {
                          deadheadText = ` [${deadhead.distanceToFirstStopKm} km ${t.deadhead.toFirstStop}]`;
                        }
                      } else {
                        deadheadText = ` [${t.deadhead.noGpsCoordinates}]`;
                      }
                      return (
                        <option key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}{deadheadText}
                        </option>
                      );
                    })
                  )}
                </select>

                {selectedAttendantDeadhead && selectedAttendantDeadhead.hasCoordinates && (
                  <div className="mt-1.5 p-1.5 rounded bg-slate-900 border border-indigo-500/30 text-[10px] font-mono text-indigo-300">
                    {selectedAttendantDeadhead.distanceToDriverKm !== undefined
                      ? `${selectedAttendantDeadhead.distanceToDriverKm} km to driver`
                      : `${selectedAttendantDeadhead.distanceToFirstStopKm} km to 1st stop`}
                  </div>
                )}
              </div>

              {/* Vehicle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Replacement Vehicle</label>
                  {temporaryVehicleId && (
                    <button
                      type="button"
                      onClick={() => setTemporaryVehicleId('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Vehicle Search Input */}
                <div className="relative mb-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    placeholder="Search unit #, plate, yard..."
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {vehicleSearch && (
                    <button
                      type="button"
                      onClick={() => setVehicleSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={temporaryVehicleId}
                  onChange={(e) => setTemporaryVehicleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- No Replacement Vehicle --</option>
                  {filteredVehicles.length === 0 ? (
                    <option disabled value="__empty">No vehicles match &quot;{vehicleSearch}&quot;</option>
                  ) : (
                    filteredVehicles.map((v) => (
                      <option key={v.id} value={String(v.id)}>
                        {v.unitNumber ? `Unit #${v.unitNumber}` : `Unit #${v.id}`} ({v.plateNumber || 'No plate'}${v.model ? ` - ${v.model}` : ''}${v.yardName ? ` · ${v.yardName}` : ''})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Notes & Dispatch Instructions
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Driver on medical leave until Friday. Replacement trained on route stops."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-sm rounded-lg flex items-center space-x-2 transition shadow-lg shadow-amber-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : assignment ? 'Update Assignment' : 'Create Assignment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
