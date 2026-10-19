import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle } from '../../types/vehicle';
import { Employee } from '../../types/employee';
import { useI18n } from '../../contexts/I18nContext';
import {
  X,
  Bus,
  ShieldCheck,
  Wrench,
  MapPin,
  Hash,
  User,
  Phone,
  Search,
  AlertTriangle
} from 'lucide-react';
import { AssignmentHistoryService } from '../../services/assignmentHistoryService';
import { useAuth } from '../../contexts/AuthContext';
import { useCompliance } from '../../contexts/ComplianceContext';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vehicleData: Partial<Vehicle>) => Promise<void>;
  initialData?: Vehicle | null;
  employees?: Employee[];
  vehicles?: Vehicle[];
}

type StaffCategory = 'driver' | 'office' | 'other';

const getStaffCategory = (emp: Employee): StaffCategory => {
  const role = (emp.role || '').toLowerCase();
  const pos = (emp.jobPosition || '').toLowerCase();

  // 1. Driver category
  if (
    role === 'driver' ||
    pos.includes('driver') ||
    pos.includes('chauffeur') ||
    pos.includes('operator')
  ) {
    return 'driver';
  }

  // 2. Office staff category: Admin, Dispatcher, Supervisor, Management, Coordinator, Office, etc.
  if (
    role === 'admin' ||
    role === 'dispatcher' ||
    role === 'supervisor' ||
    pos.includes('dispatch') ||
    pos.includes('admin') ||
    pos.includes('supervisor') ||
    pos.includes('manager') ||
    pos.includes('coordinator') ||
    pos.includes('office') ||
    pos.includes('clerk') ||
    pos.includes('safety')
  ) {
    return 'office';
  }

  // 3. Other personnel
  return 'other';
};

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  employees = [],
  vehicles = []
}) => {
  const { currentUser } = useAuth();
  const { t } = useI18n();
  const { isOntario } = useCompliance();
  const [loading, setLoading] = useState(false);

  // Form states
  const [unitNumber, setUnitNumber] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [unitType, setUnitType] = useState('Bus');
  const [manufacturer, setManufacturer] = useState('Blue Bird');
  const [model, setModel] = useState('Vision');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [color, setColor] = useState('School Bus Yellow');
  const [seatCap, setSeatCap] = useState<number>(72);
  const [wheelchairCap, setWheelchairCap] = useState<number>(0);
  const [fuelType, setFuelType] = useState('Diesel');
  const [yardName, setYardName] = useState('HQ-Central');
  const [status, setStatus] = useState('Spare');
  const [active, setActive] = useState(true);
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'driver' | 'office' | 'other'>('all');

  // Semi-annual mechanical safety inspection & statutory archival fields
  const [lastInspectionDate, setLastInspectionDate] = useState('');
  const [nextInspectionDue, setNextInspectionDue] = useState('');
  const [inspectionCertificateNumber, setInspectionCertificateNumber] = useState('');
  const [inspectionStickerNumber, setInspectionStickerNumber] = useState('');
  const [hasInVehicleCertificate, setHasInVehicleCertificate] = useState(true);
  const [hasDetailedMeasurementsArchived, setHasDetailedMeasurementsArchived] = useState(true);
  const [hasProofOfRepairsAttached, setHasProofOfRepairsAttached] = useState(true);

  // Helper to check if a vehicle is this vehicle being edited
  const isCurrentVehicle = (v?: Vehicle): boolean => {
    if (!v || !initialData) return false;
    if (initialData.id && v.id === initialData.id) return true;
    if (initialData.unitNumber && v.unitNumber === initialData.unitNumber) return true;
    return false;
  };

  // Helper to find which vehicle an employee is currently assigned to
  const getAssignedVehicle = (emp: Employee): Vehicle | undefined => {
    if (!vehicles || vehicles.length === 0) return undefined;
    const cleanEmpNum = (emp.employeeNumber || '').replace(/^EMP-/, '');
    const cleanId = (emp.id || '').replace(/^EMP-/, '');

    return vehicles.find((v) => {
      if (v.driverId) {
        const cleanDriverId = v.driverId.replace(/^EMP-/, '');
        if (
          v.driverId === emp.id ||
          v.driverId === emp.employeeNumber ||
          cleanDriverId === cleanEmpNum ||
          cleanDriverId === cleanId
        ) {
          return true;
        }
      }
      if (emp.employeeId && v.employeeId && emp.employeeId === v.employeeId) {
        return true;
      }
      if (
        v.driverName &&
        emp.fullName &&
        v.driverName.trim().toLowerCase() === emp.fullName.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });
  };

  useEffect(() => {
    if (isOpen) {
      setDriverSearchTerm('');
      setCategoryFilter('all');
    }
    if (initialData) {
      setUnitNumber(initialData.unitNumber || '');
      setPlateNumber(initialData.plateNumber || '');
      setVin(initialData.vin || '');
      setUnitType(initialData.unitType || 'Bus');
      setManufacturer(initialData.manufacturer || 'Blue Bird');
      setModel(initialData.model || '');
      setYear(initialData.year || new Date().getFullYear());
      setColor(initialData.color || 'School Bus Yellow');
      setSeatCap(initialData.seatCap ?? 72);
      setWheelchairCap(initialData.wheelchairCap ?? 0);
      setFuelType(initialData.fuelType || 'Diesel');
      setYardName(initialData.yardName || 'HQ-Central');
      setStatus(initialData.status || 'Spare');
      setActive(initialData.active ?? true);
      setLicenseExpiry(initialData.licenseExpiry ? initialData.licenseExpiry.substring(0, 10) : '');
      setNotes(initialData.notes || '');

      setLastInspectionDate(initialData.lastInspectionDate ? initialData.lastInspectionDate.substring(0, 10) : '');
      setNextInspectionDue(initialData.nextInspectionDue ? initialData.nextInspectionDue.substring(0, 10) : (initialData.licenseExpiry ? initialData.licenseExpiry.substring(0, 10) : ''));
      setInspectionCertificateNumber(initialData.inspectionCertificateNumber || '');
      setInspectionStickerNumber(initialData.inspectionStickerNumber || '');
      setHasInVehicleCertificate(initialData.hasInVehicleCertificate !== false);
      setHasDetailedMeasurementsArchived(initialData.hasDetailedMeasurementsArchived !== false);
      setHasProofOfRepairsAttached(initialData.hasProofOfRepairsAttached !== false);

      let matchedDriverId = '';
      if (initialData.driverId) {
        const cleanId = initialData.driverId.replace(/^EMP-/, '');
        const matched = employees.find(
          (e) =>
            e.id === initialData.driverId ||
            e.employeeNumber === initialData.driverId ||
            e.employeeNumber === cleanId ||
            `EMP-${e.employeeNumber}` === initialData.driverId
        );
        matchedDriverId = matched ? matched.id : initialData.driverId;
      } else if (initialData.driverName) {
        const matched = employees.find(
          (e) => e.fullName?.trim().toLowerCase() === initialData.driverName?.trim().toLowerCase()
        );
        if (matched) matchedDriverId = matched.id;
      }
      setSelectedDriverId(matchedDriverId);
    } else {
      setUnitNumber('');
      setPlateNumber('');
      setVin('');
      setUnitType('Bus');
      setManufacturer('Blue Bird');
      setModel('Vision');
      setYear(new Date().getFullYear());
      setColor('School Bus Yellow');
      setSeatCap(72);
      setWheelchairCap(0);
      setFuelType('Diesel');
      setYardName('HQ-Central');
      setStatus('Spare');
      setActive(true);
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setLicenseExpiry(nextYear.toISOString().substring(0, 10));
      setNotes('');
      setSelectedDriverId('');

      const today = new Date();
      setLastInspectionDate(today.toISOString().substring(0, 10));
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      setNextInspectionDue(sixMonthsLater.toISOString().substring(0, 10));
      setInspectionCertificateNumber('');
      setInspectionStickerNumber('');
      setHasInVehicleCertificate(true);
      setHasDetailedMeasurementsArchived(true);
      setHasProofOfRepairsAttached(true);
    }
  }, [initialData, isOpen, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedEmp = employees.find(
        (e) => e.id === selectedDriverId || e.employeeNumber === selectedDriverId
      );
      const empNum =
        selectedEmp && !isNaN(Number(selectedEmp.employeeNumber))
          ? Number(selectedEmp.employeeNumber)
          : undefined;

      const payload: Partial<Vehicle> = {
        unitNumber,
        plateNumber,
        vin: vin || undefined,
        unitType,
        manufacturer,
        model,
        year: Number(year),
        color,
        seatCap: Number(seatCap),
        wheelchairCap: Number(wheelchairCap),
        fuelType,
        yardName,
        status,
        active,
        licenseExpiry: licenseExpiry ? licenseExpiry.substring(0, 10) : undefined,
        notes: notes || undefined,
        lastInspectionDate: lastInspectionDate ? lastInspectionDate.substring(0, 10) : undefined,
        nextInspectionDue: nextInspectionDue ? nextInspectionDue.substring(0, 10) : undefined,
        inspectionCertificateNumber: inspectionCertificateNumber || undefined,
        inspectionStickerNumber: inspectionStickerNumber || undefined,
        hasInVehicleCertificate,
        hasDetailedMeasurementsArchived,
        hasProofOfRepairsAttached,
        driverId: selectedEmp ? (selectedEmp.employeeNumber || selectedEmp.id) : '',
        driverName: selectedEmp ? selectedEmp.fullName : '',
        driverPhone: selectedEmp ? (selectedEmp.preferredPhone || selectedEmp.mobilePhone || '') : '',
        employeeId: empNum ?? undefined
      };

      await onSave(payload);

      // Track vehicle-to-driver assignment audit
      const todayStr = new Date().toISOString().slice(0, 10);
      const prevDriverId = initialData?.driverId || '';
      const newDriverId = payload.driverId || '';
      const vUnit = payload.unitNumber || initialData?.unitNumber || '';

      const dispatcherName = currentUser?.displayName || currentUser?.email || 'Fleet Lead / Admin';
      const dispatcherId = currentUser?.employeeId || currentUser?.uid || 'UNKNOWN_DISPATCHER';
      const dispatcherRole = currentUser?.role || 'admin';
      const dispatcherEmail = currentUser?.email || '';

      if (prevDriverId && prevDriverId !== newDriverId) {
        AssignmentHistoryService.recordEvent({
          type: 'driver_vehicle',
          action: 'unassign',
          effectiveDate: todayStr,
          driverId: prevDriverId,
          driverName: initialData?.driverName || prevDriverId,
          unitNumber: vUnit,
          plateNumber: payload.plateNumber,
          reason: newDriverId ? `Vehicle Unit #${vUnit} reassigned to another driver` : `Driver unassigned from Vehicle Unit #${vUnit}`,
          assignedBy: dispatcherName,
          dispatcherId,
          dispatcherName,
          dispatcherRole,
          dispatcherEmail,
        }).catch((e) => console.warn('Vehicle modal audit unassign error:', e));
      }

      if (newDriverId && newDriverId !== prevDriverId) {
        AssignmentHistoryService.recordEvent({
          type: 'driver_vehicle',
          action: 'assign',
          effectiveDate: todayStr,
          driverId: newDriverId,
          driverName: payload.driverName || newDriverId,
          unitNumber: vUnit,
          plateNumber: payload.plateNumber,
          routeNo: initialData?.assignedRouteNo,
          reason: `Assigned Vehicle Unit #${vUnit} to driver ${payload.driverName}`,
          assignedBy: dispatcherName,
          dispatcherId,
          dispatcherName,
          dispatcherRole,
          dispatcherEmail,
        }).catch((e) => console.warn('Vehicle modal audit assign error:', e));
      }

      onClose();
    } catch (err: any) {
      alert(`Failed to save vehicle: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Sort employees: 1. Drivers, 2. Office Staff, 3. Other Staff; within each category: unassigned first, already assigned later
  const categorizedAndSortedEmployees = useMemo(() => {
    const activeList = employees.filter((e) => e.isActive !== false);

    const getScore = (emp: Employee) => {
      const cat = getStaffCategory(emp);
      // Category priority: driver (10), office (20), other (30)
      const catScore = cat === 'driver' ? 10 : cat === 'office' ? 20 : 30;

      const assignedVeh = getAssignedVehicle(emp);
      // If assigned to ANOTHER vehicle (not current), they are "already arranged" (score +1)
      // If not assigned to any vehicle (or currently on this vehicle), they are "available / unassigned" (score +0)
      const isAlreadyArrangedOnOther = assignedVeh && !isCurrentVehicle(assignedVeh);
      const assignScore = isAlreadyArrangedOnOther ? 1 : 0;

      return catScore + assignScore;
    };

    return [...activeList].sort((a, b) => {
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [employees, vehicles, initialData]);

  // Category counts
  const categoryCounts = useMemo(() => {
    let drivers = 0;
    let office = 0;
    let other = 0;
    employees.forEach((emp) => {
      if (emp.isActive === false) return;
      const cat = getStaffCategory(emp);
      if (cat === 'driver') drivers++;
      else if (cat === 'office') office++;
      else other++;
    });
    return {
      all: drivers + office + other,
      driver: drivers,
      office: office,
      other: other
    };
  }, [employees]);

  // Filter candidates by keyword and category
  const filteredEmployees = useMemo(() => {
    return categorizedAndSortedEmployees.filter((emp) => {
      if (categoryFilter !== 'all') {
        const cat = getStaffCategory(emp);
        if (cat !== categoryFilter) return false;
      }

      if (driverSearchTerm.trim()) {
        const term = driverSearchTerm.trim().toLowerCase();
        const assignedVeh = getAssignedVehicle(emp);
        const matchName = (emp.fullName || '').toLowerCase().includes(term);
        const matchNumber = (emp.employeeNumber || '').toLowerCase().includes(term);
        const matchPos = (emp.jobPosition || '').toLowerCase().includes(term);
        const matchPhone = (emp.preferredPhone || emp.mobilePhone || '').toLowerCase().includes(term);
        const matchVehicle = assignedVeh
          ? (assignedVeh.unitNumber || '').toLowerCase().includes(term) ||
            (assignedVeh.plateNumber || '').toLowerCase().includes(term)
          : false;

        return matchName || matchNumber || matchPos || matchPhone || matchVehicle;
      }

      return true;
    });
  }, [categorizedAndSortedEmployees, categoryFilter, driverSearchTerm, vehicles]);

  const selectedDriver = employees.find(
    (e) => e.id === selectedDriverId || e.employeeNumber === selectedDriverId
  );
  const selectedDriverVeh = selectedDriver ? getAssignedVehicle(selectedDriver) : undefined;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {initialData ? `${t.vehicles.editTitle}${initialData.unitNumber}` : t.vehicles.newTitle}
              </h2>
              <p className="text-xs text-slate-400">
                {t.vehicles.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identification Section */}
          <div>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Hash className="w-3.5 h-3.5" />
              <span>{t.vehicles.unitNumber} / {t.vehicles.vin}</span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.unitNumber} *</label>
                <input
                  type="text"
                  required
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 1001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.plateNumber} *</label>
                <input
                  type="text"
                  required
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500 uppercase"
                  placeholder="e.g. ON-1001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.vin}</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500 uppercase"
                  placeholder="1BABBPPA9HF..."
                  maxLength={17}
                />
              </div>
            </div>
          </div>

          {/* Model & Specifications */}
          <div>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Wrench className="w-3.5 h-3.5" />
              <span>{t.vehicles.model} & {t.vehicles.passengerSeats}</span>
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.unitType} *</label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Bus">Bus</option>
                  <option value="Van">Van</option>
                  <option value="Car">Sedan / SUV</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.manufacturer}</label>
                <input
                  type="text"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="Blue Bird"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.model}</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="Vision / CE"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.year}</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  min={1990}
                  max={new Date().getFullYear() + 2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.passengerSeats}</label>
                <input
                  type="number"
                  value={seatCap}
                  onChange={(e) => setSeatCap(Number(e.target.value))}
                  min={0}
                  max={90}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.wheelchairSlots}</label>
                <input
                  type="number"
                  value={wheelchairCap}
                  onChange={(e) => setWheelchairCap(Number(e.target.value))}
                  min={0}
                  max={10}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.fuelType}</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Diesel">Diesel</option>
                  <option value="Gasoline">Gasoline</option>
                  <option value="Electric">Electric</option>
                  <option value="Propane">Propane</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.color}</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Operational Status & Yard */}
          <div>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{t.vehicles.homeYard} & {t.vehicles.fleetStatus}</span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.homeYard}</label>
                <select
                  value={yardName}
                  onChange={(e) => setYardName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="HQ-Central">HQ-Central (Ottawa)</option>
                  <option value="Yard-East">Yard-East (Industrial)</option>
                  <option value="Yard-West">Yard-West (Nepean)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.fleetStatus}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="In Service">{t.vehicles.inService}</option>
                  <option value="Spare">{t.vehicles.spare}</option>
                  <option value="Maintenance">{t.vehicles.maintenance}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.activeFleetFlag}</label>
                <label className="flex items-center space-x-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-800 border-slate-700"
                  />
                  <span className={`text-sm font-semibold ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {active ? t.vehicles.availableForDispatch : t.vehicles.decommissioned}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Assigned Driver Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{t.vehicles.assignedRegularDriver}</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                {t.vehicles.priorityOrder}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              {/* Active Selected Driver Banner */}
              {selectedDriver ? (
                <div className="p-3 bg-slate-900 border border-amber-500/40 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                      {selectedDriver.firstName?.[0] || 'D'}
                      {selectedDriver.lastName?.[0] || ''}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">
                          {selectedDriver.fullName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                          {selectedDriver.employeeNumber || selectedDriver.id}
                        </span>
                        {/* Category tag */}
                        {(() => {
                          const cat = getStaffCategory(selectedDriver);
                          if (cat === 'driver') {
                            return (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {t.vehicles.driverCategory}
                              </span>
                            );
                          }
                          if (cat === 'office') {
                            return (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {t.vehicles.officeCategory}
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {t.vehicles.otherCategory}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="text-xs text-slate-400 flex items-center space-x-3 mt-1 flex-wrap">
                        <span>{selectedDriver.jobPosition || t.vehicles.driverCategory}</span>
                        {(selectedDriver.preferredPhone || selectedDriver.mobilePhone) && (
                          <span className="flex items-center space-x-1 text-slate-300">
                            <Phone className="w-3 h-3 text-amber-400" />
                            <span>{selectedDriver.preferredPhone || selectedDriver.mobilePhone}</span>
                          </span>
                        )}
                        {/* Vehicle status */}
                        {selectedDriverVeh && !isCurrentVehicle(selectedDriverVeh) && (
                          <span className="flex items-center space-x-1 text-amber-300 text-[11px] font-medium">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>{t.vehicles.priorAssignment}: Unit #{selectedDriverVeh.unitNumber}</span>
                          </span>
                        )}
                        {selectedDriverVeh && isCurrentVehicle(selectedDriverVeh) && (
                          <span className="text-sky-300 text-[11px] font-medium">
                            ✓ {t.vehicles.assignedToCurrent}
                          </span>
                        )}
                        {!selectedDriverVeh && (
                          <span className="text-emerald-400 text-[11px] font-medium">
                            ✓ {t.vehicles.availableBadge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDriverId('')}
                    className="ml-3 shrink-0 text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition flex items-center space-x-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{t.common.unassign}</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-900/60 border border-dashed border-slate-700/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span>{t.vehicles.noDriverAssigned}</span>
                  </div>
                </div>
              )}

              {/* Search & Category Tabs */}
              <div className="space-y-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={driverSearchTerm}
                    onChange={(e) => setDriverSearchTerm(e.target.value)}
                    placeholder={t.vehicles.searchPersonnelPlaceholder}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  />
                  {driverSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setDriverSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter Tabs */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                      categoryFilter === 'all'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.common.all} ({categoryCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('driver')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                      categoryFilter === 'driver'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.vehicles.driverCategory}s ({categoryCounts.driver})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('office')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                      categoryFilter === 'office'
                        ? 'bg-blue-500 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.vehicles.officeCategory} ({categoryCounts.office})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('other')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                      categoryFilter === 'other'
                        ? 'bg-purple-500 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.vehicles.otherCategory} ({categoryCounts.other})
                  </button>

                  <span className="text-[11px] text-slate-500 ml-auto shrink-0">
                    {filteredEmployees.length} {t.common.total.toLowerCase()}
                  </span>
                </div>
              </div>

              {/* Scrollable Candidate List */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-lg p-1.5 bg-slate-900/50">
                {/* Option 0: Clear / Unassigned */}
                <div
                  onClick={() => setSelectedDriverId('')}
                  className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between text-xs border ${
                    !selectedDriverId
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-slate-850 border-transparent hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        !selectedDriverId ? 'border-amber-400 bg-amber-400' : 'border-slate-600'
                      }`}
                    >
                      {!selectedDriverId && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </div>
                    <span className="font-medium">-- {t.vehicles.noDriverAssigned} --</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{t.common.clear}</span>
                </div>

                {/* Candidate Rows */}
                {filteredEmployees.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <div>{t.vehicles.noMatchingPersonnel}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setDriverSearchTerm('');
                        setCategoryFilter('all');
                      }}
                      className="mt-2 text-amber-400 hover:underline text-xs"
                    >
                      {t.vehicles.resetSearchAndFilter}
                    </button>
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected =
                      emp.id === selectedDriverId || emp.employeeNumber === selectedDriverId;
                    const cat = getStaffCategory(emp);
                    const assignedVeh = getAssignedVehicle(emp);
                    const isCurrent = isCurrentVehicle(assignedVeh);

                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedDriverId(emp.id)}
                        className={`p-2.5 rounded-lg cursor-pointer transition flex items-center justify-between text-xs border ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/50 shadow-sm'
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {/* Left: Radio + Avatar + Name + Number + Category */}
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {/* Selection indicator */}
                          <div
                            className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                              isSelected ? 'border-amber-400 bg-amber-400' : 'border-slate-600'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                          </div>

                          {/* Avatar */}
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              cat === 'driver'
                                ? 'bg-amber-500/20 text-amber-300'
                                : cat === 'office'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}
                          >
                            {emp.firstName?.[0] || 'E'}
                            {emp.lastName?.[0] || ''}
                          </div>

                          {/* Name & Details */}
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span
                                className={`font-semibold truncate ${
                                  isSelected ? 'text-amber-200' : 'text-slate-200'
                                }`}
                              >
                                {emp.fullName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({emp.employeeNumber || emp.id})
                              </span>
                              {/* Category badge */}
                              {cat === 'driver' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 font-medium">
                                  {t.vehicles.driverCategory}
                                </span>
                              )}
                              {cat === 'office' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 font-medium">
                                  {t.vehicles.officeCategory}
                                </span>
                              )}
                              {cat === 'other' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20 font-medium">
                                  {t.vehicles.otherCategory}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                              <span className="truncate max-w-[120px]">
                                {emp.jobPosition || t.vehicles.driverCategory}
                              </span>
                              {(emp.preferredPhone || emp.mobilePhone) && (
                                <span className="text-slate-400 flex items-center space-x-0.5">
                                  <Phone className="w-2.5 h-2.5 text-amber-400/80" />
                                  <span>{emp.preferredPhone || emp.mobilePhone}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Vehicle Assignment Status Badge */}
                        <div className="ml-2 shrink-0">
                          {isCurrent && assignedVeh ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center space-x-1">
                              <Bus className="w-3 h-3 text-sky-400" />
                              <span>{t.vehicles.currentVehicleBadge} (Unit #{assignedVeh.unitNumber})</span>
                            </span>
                          ) : assignedVeh ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                              <Bus className="w-3 h-3 text-amber-400" />
                              <span>{t.vehicles.assignedBadge}: Unit #{assignedVeh.unitNumber}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              ✓ {t.vehicles.availableBadge}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Compliance, Semi-Annual Inspection & Notes */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Semi-Annual Safety Inspection & Archival Compliance</span>
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isOntario
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
              }`}>
                {isOntario ? '🇨🇦 Ontario: DriveON PMVI (MTO)' : '⚜️ Québec: SAAQ VMP / PEP'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Last Inspection Date
                </label>
                <input
                  type="date"
                  value={lastInspectionDate}
                  onChange={(e) => setLastInspectionDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Next Inspection Due Date
                </label>
                <input
                  type="date"
                  value={nextInspectionDue}
                  onChange={(e) => {
                    setNextInspectionDue(e.target.value);
                    setLicenseExpiry(e.target.value);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isOntario ? 'DriveON Safety Certificate #' : 'SAAQ CVM # (Certificat)'}
                </label>
                <input
                  type="text"
                  value={inspectionCertificateNumber}
                  onChange={(e) => setInspectionCertificateNumber(e.target.value)}
                  placeholder={isOntario ? 'e.g. DOC-ON-10882' : 'e.g. CVM-QC-99412'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isOntario ? 'DriveON Decal / Sticker #' : 'Vignette SAAQ # (Punched Decal)'}
                </label>
                <input
                  type="text"
                  value={inspectionStickerNumber}
                  onChange={(e) => setInspectionStickerNumber(e.target.value)}
                  placeholder={isOntario ? 'e.g. STK-2026-901' : 'e.g. VIG-2026-441'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Operator Statutory Archival Checkboxes */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Operator Statutory Compliance Checklist:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasInVehicleCertificate}
                    onChange={(e) => setHasInVehicleCertificate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-800"
                  />
                  <span className="text-slate-300 text-[11px] font-medium leading-tight">
                    1. In-Vehicle Proof<br />
                    <span className="text-[10px] text-slate-500">Certificate copy carried in vehicle</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasDetailedMeasurementsArchived}
                    onChange={(e) => setHasDetailedMeasurementsArchived(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-800"
                  />
                  <span className="text-slate-300 text-[11px] font-medium leading-tight">
                    2. Measurements Sheet<br />
                    <span className="text-[10px] text-slate-500">Lining and tread depth record</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasProofOfRepairsAttached}
                    onChange={(e) => setHasProofOfRepairsAttached(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-800"
                  />
                  <span className="text-slate-300 text-[11px] font-medium leading-tight">
                    3. Proof of Repairs<br />
                    <span className="text-[10px] text-slate-500">Defect work orders & parts invoices</span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t.vehicles.maintenanceNotes}</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                placeholder="e.g. Certified by DriveON tech #402, brakes serviced Oct 2026"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition disabled:opacity-50"
            >
              {loading ? t.common.saving : initialData ? t.common.save : t.vehicles.newTitle}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
