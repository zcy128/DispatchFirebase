import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { VehicleSignout, CreateVehicleSignoutPayload, VehicleSignoutAttachment } from '../types/vehicleSignout';
import { apiRequest } from '../services/api';
import { VehicleSignoutService } from '../services/vehicleSignoutService';
import { canEditPage } from '../utils/permissions';
import { VehicleService } from '../services/vehicleService';
import { EmployeeService } from '../services/employeeService';
import { Vehicle } from '../types/vehicle';
import { Employee } from '../types/employee';
import {
  FileSignature,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Calendar,
  User,
  Gauge,
  Fuel,
  FileText,
  Camera,
  Trash2,
  Eye,
  Printer,
  ShieldAlert,
  ArrowRightLeft,
  X,
  Upload,
  Clock,
  Info
} from 'lucide-react';

const TIME_RANGE_OPTIONS = [
  { id: '1year', label: '1 Year (Live)' },
  { id: 'all', label: 'All History' },
] as const;

const DOCUMENT_PACK_ITEMS = [
  { key: 'docRegistrationSignIn', label: 'Vehicle Registration' },
  { key: 'docInsuranceSignIn', label: 'Pink Card / Insurance' },
  { key: 'docSafetyFitnessSignIn', label: 'Safety Fitness Certificate' },
  { key: 'docCollisionReportSignIn', label: 'Collision Report Forms' },
  { key: 'docScheduleMaintenanceSignIn', label: 'Schedule 2 Maintenance' },
  { key: 'docSdsSignIn', label: 'SDS Safety Binder' },
] as const;

const SAFETY_EQUIPMENT_ITEMS = [
  { key: 'checkFireExtinguisher', label: 'Fire Extinguisher' },
  { key: 'checkFirstAidKit', label: 'First Aid Kit' },
  { key: 'checkTriangles', label: 'Warning Triangles (3)' },
  { key: 'checkSeatBeltCutter', label: 'Seat Belt Cutter' },
  { key: 'checkBroom', label: 'Broom' },
  { key: 'checkSnowbrush', label: 'Snowbrush' },
  { key: 'checkCleankit', label: 'Body Fluid / Spill Kit' },
  { key: 'checkQstraints', label: 'Wheelchair Q-Straints' },
] as const;

interface SignoutModalDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  maxWidthClassName: string;
  children: React.ReactNode;
}

const SignoutModalDialog: React.FC<SignoutModalDialogProps> = ({
  open,
  onClose,
  ariaLabelledBy,
  maxWidthClassName,
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ariaLabelledBy}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="m-0 max-w-none max-h-none w-screen h-screen bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center overflow-y-auto overscroll-contain backdrop:overscroll-contain"
    >
      <div
        className={`bg-slate-900 border border-slate-800 rounded-3xl w-full ${maxWidthClassName} overflow-hidden shadow-2xl my-8`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </dialog>
  );
};

interface VehicleSignoutViewProps {
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
  onSelectVehicle?: (vehicleId?: number, unitNumber?: string) => void;
}

export const VehicleSignoutView: React.FC<VehicleSignoutViewProps> = ({
  onSelectEmployee,
  onSelectVehicle,
}) => {
  const { currentUser } = useAuth();

  // Role validation: Strictly only fleet or admin
  const isFleetRole = useMemo(() => canEditPage(currentUser, 'vehicle_signouts'), [currentUser]);

  // State
  const [records, setRecords] = useState<VehicleSignout[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [typeFilter, setTypeFilter] = useState<'all' | 'sign_out' | 'sign_in'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'1year' | 'all'>('1year');

  const isArchivedDate = (d?: string) => {
    if (!d) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    return d.slice(0, 10) < cutoff.toISOString().slice(0, 10);
  };

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<VehicleSignout | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'signatures'>('details');

  // Form State
  const [formData, setFormData] = useState<CreateVehicleSignoutPayload>({
    isSignIn: false,
    signDate: new Date().toISOString().split('T')[0],
    vehicleType: 0,
    employeeId: '',
    employeeName: '',
    routeId: '',
    routeName: '',
    cellPhone: '',
    driverLicenseClass: 'Class 2-S',
    driverLicenseCondition: 'None',
    unitId: undefined,
    unitNumber: '',
    odometer: 0,
    licensePlate: '',
    cvipDate: '',
    unitYear: 2022,
    unitMaker: '',
    unitModel: '',
    unitColor: 'Yellow',
    fuelLevelDescription: 'Full',
    fuelTypeDescription: 'Diesel',
    docRegistrationSignIn: true,
    docInsuranceSignIn: true,
    docSafetyFitnessSignIn: true,
    docCollisionReportSignIn: true,
    docScheduleMaintenanceSignIn: true,
    docSdsSignIn: true,
    checkFireExtinguisher: true,
    checkFirstAidKit: true,
    checkTriangles: true,
    checkQstraints: false,
    checkSeatBeltCutter: true,
    checkBroom: true,
    checkSnowbrush: true,
    checkCleankit: true,
    acknowledgeCheck: true,
    conditionKey: '',
    conditionComments: '',
    parkingAddress: '',
    fireHallLocation: '',
    driverSignature: '',
    driverSignDate: new Date().toISOString().split('T')[0],
    fleetDepartmentSignature: currentUser?.displayName || currentUser?.email || 'Fleet Officer',
    fleetDepartmentSignDate: new Date().toISOString().split('T')[0],
    attachments: [],
    createdBy: currentUser?.email || 'Fleet Officer'
  });

  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fast hash maps for O(1) vehicle and driver lookups
  const vehiclesByUnit = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const v of vehicles) {
      map.set(v.unitNumber, v);
    }
    return map;
  }, [vehicles]);

  const employeesByFullName = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const emp of employees) {
      map.set(`${emp.firstName} ${emp.lastName}`.toLowerCase(), emp);
    }
    return map;
  }, [employees]);

  // Fetch initial data
  const fetchData = async (opts?: { isCancelled?: () => boolean }) => {
    if (!isFleetRole) return;
    setLoading(true);
    try {
      const [signouts, vList, eList] = await Promise.all([
        VehicleSignoutService.list({ role: 'fleet', timeRange: '1year' }),
        VehicleService.list().catch(() => []),
        EmployeeService.list().catch(() => [])
      ]);
      if (opts?.isCancelled?.()) return;
      setRecords(signouts);
      setVehicles(vList);
      setEmployees(eList);
    } catch (err) {
      console.error('Error fetching handover data:', err);
    } finally {
      if (!opts?.isCancelled?.()) {
        setLoading(false);
      }
    }
  };

  const loadRecords = async (targetQuery?: string, opts?: { isCancelled?: () => boolean }) => {
    if (!isFleetRole) return;
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q && !dateFilter) {
      if (!opts?.isCancelled?.()) {
        setRecords([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = { role: 'fleet', timeRange };
      if (q) params.query = q;
      if (dateFilter) {
        params.startDate = dateFilter;
        params.endDate = dateFilter;
      }
      const signouts = await VehicleSignoutService.list(params);
      if (opts?.isCancelled?.()) return;
      setRecords(signouts);
    } catch (err) {
      console.error('Error fetching handover data:', err);
      if (!opts?.isCancelled?.()) {
        setRecords([]);
      }
    } finally {
      if (!opts?.isCancelled?.()) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isFleetRole) return;
    let isCancelled = false;
    if (timeRange === '1year') {
      void fetchData({ isCancelled: () => isCancelled });
      const unsub = VehicleSignoutService.subscribeToLive((live) => {
        if (!isCancelled) {
          setRecords(live);
          setLoading(false);
        }
      });
      return () => {
        isCancelled = true;
        unsub();
      };
    } else {
      if (searchQuery.trim() || dateFilter) {
        void loadRecords(searchQuery.trim(), { isCancelled: () => isCancelled });
      } else {
        setRecords([]);
        setLoading(false);
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [isFleetRole, timeRange]);

  // Vehicle selection auto-fill
  const handleSelectVehicle = (unitNum: string) => {
    const v = vehiclesByUnit.get(unitNum);
    if (v) {
      setFormData((prev) => ({
        ...prev,
        unitNumber: v.unitNumber,
        unitId: v.vehicleId || undefined,
        licensePlate: v.plateNumber || '',
        unitMaker: v.manufacturer || '',
        unitModel: v.model || '',
        unitYear: v.year || prev.unitYear,
        unitColor: v.color || prev.unitColor,
        odometer: prev.odometer,
        cvipDate: v.licenseExpiry || '',
        fuelTypeDescription: v.fuelType || prev.fuelTypeDescription
      }));
    } else {
      setFormData((prev) => ({ ...prev, unitNumber: unitNum }));
    }
  };

  // Driver selection auto-fill
  const handleSelectEmployee = (empId: string) => {
    const e = employees.find((emp) => emp.id === empId || emp.employeeNumber === empId);
    if (e) {
      setFormData((prev) => ({
        ...prev,
        employeeId: e.employeeNumber || e.id || '',
        employeeName: `${e.firstName} ${e.lastName}`,
        cellPhone: e.mobilePhone || e.preferredPhone || '',
        driverLicenseClass: e.driverLicense?.licenseClass || prev.driverLicenseClass,
        driverLicenseCondition: e.driverLicense?.licenseCondition || 'None',
        driverSignature: `${e.firstName} ${e.lastName}`
      }));
    } else {
      setFormData((prev) => ({ ...prev, employeeId: empId }));
    }
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      const json = await apiRequest<{ url: string }>('/api/upload', {
        method: 'POST',
        body: uploadData,
      });
      const newAtt: VehicleSignoutAttachment = {
        url: json.url,
        fileName: file.name,
        uploadedTime: new Date().toISOString()
      };
      setFormData((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAtt]
      }));
    } catch (err) {
      console.error('Failed to upload image:', err);
      setFormError('Photo upload failed. Check that you are signed in and try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Submit new handover
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitNumber || !formData.employeeName) {
      setFormError('Please provide Vehicle Unit Number and Driver Name.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await VehicleSignoutService.create(formData);
      setIsCreateOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(`Failed to save handover record: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Select All Pass for checklists
  const handleSelectAllPass = () => {
    setFormData((prev) => ({
      ...prev,
      docRegistrationSignIn: true,
      docInsuranceSignIn: true,
      docSafetyFitnessSignIn: true,
      docCollisionReportSignIn: true,
      docScheduleMaintenanceSignIn: true,
      docSdsSignIn: true,
      checkFireExtinguisher: true,
      checkFirstAidKit: true,
      checkTriangles: true,
      checkSeatBeltCutter: true,
      checkBroom: true,
      checkSnowbrush: true,
      checkCleankit: true,
      acknowledgeCheck: true
    }));
  };

  // Filtered list: decoupled from rapid keystrokes with deferredSearchQuery
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter === 'sign_in' && !r.isSignIn) return false;
      if (typeFilter === 'sign_out' && r.isSignIn) return false;
      if (dateFilter && !r.signDate.startsWith(dateFilter)) return false;
      if (deferredSearchQuery) {
        const q = deferredSearchQuery.toLowerCase();
        const matchUnit = r.unitNumber.toLowerCase().includes(q);
        const matchDriver = r.employeeName.toLowerCase().includes(q);
        const matchRoute = (r.routeId || '').toLowerCase().includes(q) || (r.routeName || '').toLowerCase().includes(q);
        if (!matchUnit && !matchDriver && !matchRoute) return false;
      }
      return true;
    });
  }, [records, typeFilter, dateFilter, deferredSearchQuery]);

  const { isFrench } = useI18n();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredRecords.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0;

  // Statistics: single-pass iteration across records
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let signedOut = 0;
    let signedIn = 0;
    let todayCount = 0;
    for (const r of records) {
      if (r.isSignIn) {
        signedIn++;
      } else {
        signedOut++;
      }
      if (r.signDate.startsWith(todayStr)) {
        todayCount++;
      }
    }
    return { total: records.length, signedOut, signedIn, todayCount };
  }, [records]);

  // ── Access Denied for Non-Fleet Roles ─────────────────────────────────────
  if (!isFleetRole) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Access Denied: Fleet Role Required</h2>
          <p className="text-slate-400 max-w-md mx-auto mb-6 text-sm">
            Vehicle Sign-Out and Handover records are restricted. Only personnel with the <strong>fleet</strong> role have authorization to view or create vehicle sign-out forms.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-400 font-mono">
            <span>Current Role:</span>
            <span className="text-amber-400 font-semibold uppercase">{currentUser?.role || 'Guest'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Vehicle Sign-Out & Handover"
        subtitle="Track unit custody, vehicle document packs, safety equipment checks, and driver sign-off agreements."
        icon={
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <FileSignature className="w-5 h-5" aria-hidden="true" />
          </div>
        }
        badge={
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-wider">
            Fleet Exclusive
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (timeRange === 'all') {
                if (searchQuery.trim() || dateFilter) {
                  loadRecords(searchQuery.trim());
                } else {
                  setRecords([]);
                }
              } else {
                fetchData();
              }
            }}
            aria-label="Refresh handover list"
            className="p-2.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData({
                isSignIn: false,
                signDate: new Date().toISOString().split('T')[0],
                vehicleType: 0,
                employeeId: '',
                employeeName: '',
                routeId: '',
                routeName: '',
                cellPhone: '',
                driverLicenseClass: 'Class 2-S',
                driverLicenseCondition: 'None',
                unitId: undefined,
                unitNumber: '',
                odometer: 0,
                licensePlate: '',
                cvipDate: '',
                unitYear: 2022,
                unitMaker: '',
                unitModel: '',
                unitColor: 'Yellow',
                fuelLevelDescription: 'Full',
                fuelTypeDescription: 'Diesel',
                docRegistrationSignIn: true,
                docInsuranceSignIn: true,
                docSafetyFitnessSignIn: true,
                docCollisionReportSignIn: true,
                docScheduleMaintenanceSignIn: true,
                docSdsSignIn: true,
                checkFireExtinguisher: true,
                checkFirstAidKit: true,
                checkTriangles: true,
                checkQstraints: false,
                checkSeatBeltCutter: true,
                checkBroom: true,
                checkSnowbrush: true,
                checkCleankit: true,
                acknowledgeCheck: true,
                conditionKey: '',
                conditionComments: '',
                parkingAddress: '',
                fireHallLocation: '',
                driverSignature: '',
                driverSignDate: new Date().toISOString().split('T')[0],
                fleetDepartmentSignature: currentUser?.displayName || currentUser?.email || 'Fleet Officer',
                fleetDepartmentSignDate: new Date().toISOString().split('T')[0],
                attachments: [],
                createdBy: currentUser?.email || 'Fleet Officer'
              });
              setFormError(null);
              setActiveTab('details');
              setIsCreateOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 min-h-[36px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Handover Form</span>
          </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-semibold">Total Records</span>
            <FileText className="w-4 h-4 text-slate-500" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">Custody logs on file</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-semibold text-blue-400">Signed Out</span>
            <Truck className="w-4 h-4 text-blue-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-blue-400">{stats.signedOut}</div>
          <div className="text-xs text-slate-500 mt-1">In field custody</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-semibold text-emerald-400">Signed In</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.signedIn}</div>
          <div className="text-xs text-slate-500 mt-1">Returned to yard/fleet</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-semibold text-amber-400">Today's Activity</span>
            <Calendar className="w-4 h-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats.todayCount}</div>
          <div className="text-xs text-slate-500 mt-1">Handovers today</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <search
        aria-label="Filter vehicle handover records"
        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3"
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search vehicle handover records"
              placeholder={
                timeRange === 'all'
                  ? 'Bus #, driver, route, or keyword to search archive...'
                  : 'Search by Bus #, Driver name, or Route...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && timeRange === 'all') {
                  loadRecords(searchQuery.trim());
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-base sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 min-w-[24px] min-h-[24px] flex items-center justify-center rounded text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {timeRange === 'all' && (
            <button
              type="button"
              onClick={() => loadRecords(searchQuery.trim())}
              disabled={loading || (!searchQuery.trim() && !dateFilter)}
              className="px-3.5 py-2 min-h-[36px] text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-xl transition shadow-xs whitespace-nowrap cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              Search Archive
            </button>
          )}
        </div>

        {/* Time Range Selector */}
        <div
          role="group"
          aria-label="Handover record time range"
          className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800"
        >
          <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            Range:
          </span>
          {TIME_RANGE_OPTIONS.map((rng) => (
            <button
              key={rng.id}
              type="button"
              aria-pressed={timeRange === rng.id}
              onClick={() => setTimeRange(rng.id as any)}
              className={`px-2.5 py-1 min-h-[28px] text-xs font-semibold rounded-lg transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                timeRange === rng.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {rng.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Type Toggle */}
          <div
            role="group"
            aria-label="Handover direction filter"
            className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs"
          >
            <button
              type="button"
              aria-pressed={typeFilter === 'all'}
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 min-h-[28px] rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                typeFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={typeFilter === 'sign_out'}
              onClick={() => setTypeFilter('sign_out')}
              className={`px-3 py-1.5 min-h-[28px] rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                typeFilter === 'sign_out' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Out (Handover)
            </button>
            <button
              type="button"
              aria-pressed={typeFilter === 'sign_in'}
              onClick={() => setTypeFilter('sign_in')}
              className={`px-3 py-1.5 min-h-[28px] rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                typeFilter === 'sign_in' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In (Return)
            </button>
          </div>

          {/* Date Picker */}
          <input
            type="date"
            aria-label="Filter handover records by date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-base sm:text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-2 py-1 min-h-[28px] text-xs text-slate-400 hover:text-slate-200 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Clear
            </button>
          )}
        </div>
      </search>

      {/* 5-Year Safe Scan Notice Banner */}
      {timeRange === 'all' && (
        <div role="status" className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs text-amber-300">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-200 flex items-center gap-1.5">
              <span>All History Mode (BigQuery Cold Archive)</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">5-Year Safe Scan</span>
            </div>
            <p className="text-amber-400/80">
              Live vehicle handover records cover the most recent 1 year. Older data is stored in BigQuery cold archives. To avoid massive database scans across 5 years, please enter a <strong>Bus Unit #</strong>, <strong>Driver Name</strong>, <strong>Employee ID</strong>, or <strong>Route #</strong> to query historical archive records.
            </p>
          </div>
        </div>
      )}

      {/* Record Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div
          ref={tableContainerRef}
          tabIndex={0}
          role="region"
          aria-label="Vehicle sign-out and handover records table"
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500"
        >
          <table className="w-full text-left text-sm text-slate-300">
            <caption className="sr-only">Vehicle sign-out and handover records</caption>
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '4%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th scope="col" className="py-3.5 px-4">{isFrench ? 'Type' : 'Type'}</th>
                <th scope="col" className="py-3.5 px-4">{isFrench ? 'Date' : 'Date'}</th>
                <th scope="col" className="py-3.5 px-4">{isFrench ? 'Unité Véhicule' : 'Vehicle Unit'}</th>
                <th scope="col" className="py-3.5 px-4">{isFrench ? 'Chauffeur / Destinataire' : 'Driver / Recipient'}</th>
                <th scope="col" className="py-3.5 px-4">{isFrench ? 'Trajet' : 'Route'}</th>
                <th scope="col" className="py-3.5 px-4">{isFrench ? 'Odomètre & Carburant' : 'Odometer & Fuel'}</th>
                <th scope="col" className="py-3.5 px-4">{isFrench ? 'État' : 'Condition'}</th>
                <th scope="col" className="py-3.5 px-4 text-center">{isFrench ? 'Photos' : 'Photos'}</th>
                <th scope="col" className="py-3.5 px-4 text-right">{isFrench ? 'Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500" role="status">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" aria-hidden="true" />
                    {isFrench ? 'Chargement des fiches de transfert...' : 'Loading vehicle handover records...'}
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <FileSignature className="w-10 h-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                    {timeRange === 'all' && !searchQuery.trim() && !dateFilter ? (
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-300">
                          {isFrench ? 'Rechercher dans les archives de 5 ans' : 'Enter Bus #, Driver Name, Route, or Date to Search 5-Year Archive'}
                        </div>
                        <div className="text-xs text-slate-500 max-w-md mx-auto">
                          {isFrench
                            ? 'Les données en direct couvrent la dernière année. Saisissez une requête ci-dessus pour inspecter les archives historiques.'
                            : 'Live vehicle handover records cover the most recent 1 year. Type a query above and click "Search Archive" to inspect historical records.'}
                        </div>
                      </div>
                    ) : (
                      <>{isFrench ? 'Aucune fiche de transfert ne correspond à vos filtres.' : 'No vehicle handover records match your filters.'}</>
                    )}
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={9} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const r = filteredRecords[virtualRow.index];
                    if (!r) return null;
                    return (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Type */}
                        <td className="py-3.5 px-4">
                          {r.isSignIn ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              {isFrench ? 'Entrée' : 'Sign In'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
                              {isFrench ? 'Sortie' : 'Sign Out'}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-200 font-medium">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span>{r.signDate || (r.createdAt ? r.createdAt.split('T')[0] : '—')}</span>
                            {isArchivedDate(r.signDate || r.createdAt) && (
                              <span
                                title="Record is older than 1 year and retrieved from BigQuery cold archive"
                                className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-950/80 text-sky-300 border border-sky-800"
                              >
                                BigQuery
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Vehicle */}
                        <td className="py-3.5 px-4">
                          {onSelectVehicle && r.unitNumber ? (
                            <button
                              type="button"
                              onClick={() => onSelectVehicle(r.unitId, r.unitNumber)}
                              aria-label={isFrench ? `Voir la fiche véhicule Unité #${r.unitNumber}` : `View vehicle details for Unit #${r.unitNumber}`}
                              className="font-bold text-slate-100 flex items-center gap-1.5 hover:text-amber-300 hover:underline transition text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title={isFrench ? 'Voir la fiche véhicule' : 'View vehicle details'}
                            >
                              <Truck className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                              #{r.unitNumber}
                            </button>
                          ) : (
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                              #{r.unitNumber}
                            </div>
                          )}
                          <div className="text-xs text-slate-400">
                            {r.unitMaker} {r.unitModel} {r.licensePlate ? `· ${r.licensePlate}` : ''}
                          </div>
                        </td>

                        {/* Driver */}
                        <td className="py-3.5 px-4">
                          {onSelectEmployee && r.employeeName ? (
                            <button
                              type="button"
                              onClick={() => onSelectEmployee(r.employeeId, r.employeeName)}
                              aria-label={isFrench ? `Voir la fiche chauffeur ${r.employeeName}` : `View employee details for ${r.employeeName}`}
                              className="font-medium text-slate-100 flex items-center gap-1.5 hover:text-amber-300 hover:underline transition text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title={isFrench ? 'Voir la fiche chauffeur' : 'View employee details'}
                            >
                              <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              {r.employeeName}
                            </button>
                          ) : (
                            <div className="font-medium text-slate-100 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              {r.employeeName}
                            </div>
                          )}
                          <div className="text-xs text-slate-400">
                            {r.driverLicenseClass || 'Class 2-S'} {r.cellPhone ? `· ${r.cellPhone}` : ''}
                          </div>
                        </td>

                        {/* Route */}
                        <td className="py-3.5 px-4">
                          {r.routeId ? (
                            <div>
                              <span className="font-semibold text-slate-200">{r.routeId}</span>
                              {r.routeName && <div className="text-xs text-slate-400 truncate max-w-[120px]">{r.routeName}</div>}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Odometer & Fuel */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 text-slate-200 font-mono text-xs">
                            <Gauge className="w-3 h-3 text-slate-400" aria-hidden="true" />
                            {r.odometer ? r.odometer.toLocaleString() + ' km' : '—'}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Fuel className="w-3 h-3 text-amber-400" aria-hidden="true" />
                            {r.fuelLevelDescription || 'Full'} ({r.fuelTypeDescription || 'Diesel'})
                          </div>
                        </td>

                        {/* Condition Comments */}
                        <td className="py-3.5 px-4">
                          {r.conditionComments ? (
                            <div className="text-xs text-slate-300 max-w-[180px] truncate" title={r.conditionComments}>
                              {r.conditionKey && <span className="font-bold text-amber-400 mr-1">[{r.conditionKey}]</span>}
                              {r.conditionComments}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">{isFrench ? 'Aucune note' : 'No notes'}</span>
                          )}
                        </td>

                        {/* Photos */}
                        <td className="py-3.5 px-4 text-center">
                          {r.attachments && r.attachments.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-amber-400 border border-amber-500/30">
                              <Camera className="w-3 h-3" aria-hidden="true" />
                              {r.attachments.length}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">0</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(r)}
                              aria-label={isFrench ? `Voir les détails pour Unité #${r.unitNumber} du ${r.signDate}` : `View handover details for Unit #${r.unitNumber} on ${r.signDate}`}
                              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              title={isFrench ? 'Voir Détails' : 'View Details'}
                            >
                              <Eye className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Delete vehicle handover record for Unit #${r.unitNumber}?`)) {
                                  await VehicleSignoutService.delete(r.id);
                                  fetchData();
                                }
                              }}
                              aria-label={isFrench ? `Supprimer la fiche pour Unité #${r.unitNumber} du ${r.signDate}` : `Delete handover record for Unit #${r.unitNumber} on ${r.signDate}`}
                              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                              title={isFrench ? 'Supprimer' : 'Delete Record'}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={9} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE NEW HANDOVER MODAL ─────────────────────────────────────── */}
      <SignoutModalDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        ariaLabelledBy="signout-create-modal-title"
        maxWidthClassName="max-w-3xl"
      >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-amber-400" aria-hidden="true" />
                <h3 id="signout-create-modal-title" className="font-bold text-slate-100">Create Vehicle Handover Record</h3>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close create handover modal"
                className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div role="tablist" aria-label="Handover form steps" className="flex border-b border-slate-800 bg-slate-900/50">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'details'}
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-400 ${
                  activeTab === 'details'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Vehicle & Custody
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'checklist'}
                onClick={() => setActiveTab('checklist')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-400 ${
                  activeTab === 'checklist'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Inspection Checklists
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'signatures'}
                onClick={() => setActiveTab('signatures')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-400 ${
                  activeTab === 'signatures'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Parking, Photos & Signatures
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Handover Direction */}
                  <div role="group" aria-label="Handover direction" className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      aria-pressed={!formData.isSignIn}
                      onClick={() => setFormData((p) => ({ ...p, isSignIn: false }))}
                      className={`p-3.5 rounded-2xl border text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                        !formData.isSignIn
                          ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
                        Sign Out (Dispatch to Driver)
                      </div>
                      <div className="text-xs opacity-75">Vehicle handed over to driver for route service.</div>
                    </button>

                    <button
                      type="button"
                      aria-pressed={formData.isSignIn}
                      onClick={() => setFormData((p) => ({ ...p, isSignIn: true }))}
                      className={`p-3.5 rounded-2xl border text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                        formData.isSignIn
                          ? 'bg-emerald-600/15 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        Sign In (Return to Yard)
                      </div>
                      <div className="text-xs opacity-75">Vehicle returned and custody transferred back to fleet.</div>
                    </button>
                  </div>

                  {/* Vehicle Unit Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="signout-unit-number" className="block text-xs font-semibold text-slate-300 mb-1.5">Vehicle Unit # *</label>
                      <input
                        id="signout-unit-number"
                        type="text"
                        required
                        placeholder="e.g. 101 or select from fleet"
                        list="vehicle-options"
                        value={formData.unitNumber}
                        onChange={(e) => handleSelectVehicle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                      <datalist id="vehicle-options">
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.unitNumber}>
                            {v.manufacturer} {v.model} ({v.plateNumber || 'No Plate'})
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label htmlFor="signout-date" className="block text-xs font-semibold text-slate-300 mb-1.5">Handover Date *</label>
                      <input
                        id="signout-date"
                        type="date"
                        required
                        value={formData.signDate}
                        onChange={(e) => setFormData((p) => ({ ...p, signDate: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* Driver Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="signout-employee-name" className="block text-xs font-semibold text-slate-300 mb-1.5">Driver / Employee Name *</label>
                      <input
                        id="signout-employee-name"
                        type="text"
                        required
                        placeholder="Select or enter driver name"
                        list="driver-options"
                        value={formData.employeeName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, employeeName: val }));
                          const match = employeesByFullName.get(val.toLowerCase());
                          if (match) handleSelectEmployee(match.id);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                      <datalist id="driver-options">
                        {employees.map((emp) => (
                          <option key={emp.id} value={`${emp.firstName} ${emp.lastName}`}>
                            {emp.driverLicense?.licenseClass || 'Driver'} · #{emp.employeeNumber}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label htmlFor="signout-license-class" className="block text-xs font-semibold text-slate-300 mb-1.5">License Class & Conditions</label>
                      <div className="flex gap-2">
                        <input
                          id="signout-license-class"
                          type="text"
                          aria-label="Driver license class"
                          placeholder="e.g. Class 2-S"
                          value={formData.driverLicenseClass || ''}
                          onChange={(e) => setFormData((p) => ({ ...p, driverLicenseClass: e.target.value }))}
                          className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                        />
                        <input
                          id="signout-license-condition"
                          type="text"
                          aria-label="Driver license conditions"
                          placeholder="e.g. None / Lenses"
                          value={formData.driverLicenseCondition || ''}
                          onChange={(e) => setFormData((p) => ({ ...p, driverLicenseCondition: e.target.value }))}
                          className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Route & Phone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="signout-route" className="block text-xs font-semibold text-slate-300 mb-1.5">Assigned Route (Optional)</label>
                      <input
                        id="signout-route"
                        type="text"
                        placeholder="e.g. Route 101 or General"
                        value={formData.routeId || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, routeId: e.target.value, routeName: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label htmlFor="signout-phone" className="block text-xs font-semibold text-slate-300 mb-1.5">Driver Contact Phone</label>
                      <input
                        id="signout-phone"
                        type="text"
                        placeholder="e.g. 403-555-0199"
                        value={formData.cellPhone || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, cellPhone: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* Odometer & Fuel Level */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="signout-odometer" className="block text-xs font-semibold text-slate-300 mb-1.5">Current Odometer (km) *</label>
                      <input
                        id="signout-odometer"
                        type="number"
                        required
                        value={formData.odometer}
                        onChange={(e) => setFormData((p) => ({ ...p, odometer: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label htmlFor="signout-fuel-level" className="block text-xs font-semibold text-slate-300 mb-1.5">Fuel Level</label>
                      <select
                        id="signout-fuel-level"
                        value={formData.fuelLevelDescription || 'Full'}
                        onChange={(e) => setFormData((p) => ({ ...p, fuelLevelDescription: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="Full">Full (100%)</option>
                        <option value="3/4 Full">3/4 Full (75%)</option>
                        <option value="1/2 Full">1/2 Full (50%)</option>
                        <option value="1/4 Full">1/4 Full (25%)</option>
                        <option value="Near Empty">Low / Reserve</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="signout-fuel-type" className="block text-xs font-semibold text-slate-300 mb-1.5">Fuel Type</label>
                      <select
                        id="signout-fuel-type"
                        value={formData.fuelTypeDescription || 'Diesel'}
                        onChange={(e) => setFormData((p) => ({ ...p, fuelTypeDescription: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="Diesel">Diesel</option>
                        <option value="Gasoline">Gasoline</option>
                        <option value="Propane">Propane</option>
                        <option value="Electric">Electric</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'checklist' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      Verify that all mandatory vehicle documents and emergency safety gear are present and verified.
                    </p>
                    <button
                      type="button"
                      onClick={handleSelectAllPass}
                      className="px-3 py-1.5 min-h-[28px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      ✓ Select All Verified
                    </button>
                  </div>

                  {/* Section A: Document Pack Checklist */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" aria-hidden="true" />
                      Vehicle Document Packet
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {DOCUMENT_PACK_ITEMS.map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-2.5 p-2.5 bg-slate-900 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={(formData as any)[item.key]}
                            onChange={(e) => setFormData((p) => ({ ...p, [item.key]: e.target.checked }))}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-950 border-slate-700"
                          />
                          <span className="text-slate-200">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Section B: Safety Equipment Checklist */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      Safety Equipment Checklist
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {SAFETY_EQUIPMENT_ITEMS.map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-2.5 p-2.5 bg-slate-900 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={(formData as any)[item.key]}
                            onChange={(e) => setFormData((p) => ({ ...p, [item.key]: e.target.checked }))}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-950 border-slate-700"
                          />
                          <span className="text-slate-200">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'signatures' && (
                <div className="space-y-4">
                  {/* Parking Address & Fire Hall */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="signout-parking-address" className="block text-xs font-semibold text-slate-300 mb-1.5">Designated Parking Address</label>
                      <input
                        id="signout-parking-address"
                        type="text"
                        placeholder="e.g. 123 Calgary Trail NW / Approved Yard"
                        value={formData.parkingAddress || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, parkingAddress: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label htmlFor="signout-fire-hall" className="block text-xs font-semibold text-slate-300 mb-1.5">Nearest Fire Hall Location</label>
                      <input
                        id="signout-fire-hall"
                        type="text"
                        placeholder="e.g. Fire Station 14 - 1100 McKnight"
                        value={formData.fireHallLocation || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, fireHallLocation: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* Condition Key & Comments */}
                  <div>
                    <label htmlFor="signout-condition-comments" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Condition Key & Observations (B: Broken, C: Chip, CR: Crack, D: Dent, H: Hole, M: Missing, S: Scrape)
                    </label>
                    <textarea
                      id="signout-condition-comments"
                      rows={2}
                      placeholder="Note any pre-existing blemishes, scratches, interior cleanliness observations..."
                      value={formData.conditionComments || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, conditionComments: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-base sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Photo Attachments */}
                  <div>
                    <span className="block text-xs font-semibold text-slate-300 mb-1.5">Photo Attachments</span>
                    <div className="flex flex-wrap items-center gap-3">
                      {formData.attachments?.map((att, idx) => (
                        <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                          <img src={att.url} alt={att.fileName || `Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                attachments: p.attachments?.filter((_, i) => i !== idx)
                              }));
                            }}
                            aria-label={`Remove attachment ${att.fileName || idx + 1}`}
                            className="absolute top-1 right-1 p-1 min-w-[24px] min-h-[24px] flex items-center justify-center bg-red-600 text-white rounded-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          >
                            <X className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      ))}

                      <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl cursor-pointer text-slate-400 hover:text-amber-400 transition-colors bg-slate-950">
                        {uploadingPhoto ? (
                          <RefreshCw className="w-5 h-5 animate-spin text-amber-500" aria-hidden="true" />
                        ) : (
                          <>
                            <Upload className="w-5 h-5 mb-1" aria-hidden="true" />
                            <span className="text-[10px] font-medium">Add Photo</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          aria-label="Upload handover photo"
                          className="hidden"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Acknowledgement Policy Checkbox */}
                  <label className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={formData.acknowledgeCheck}
                      onChange={(e) => setFormData((p) => ({ ...p, acknowledgeCheck: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-950 border-amber-500/50"
                    />
                    <span className="text-xs text-slate-300 leading-relaxed">
                      I have read, understood, and agree to abide by the locking protocol, parking agreement, and safety equipment standards for this vehicle.
                    </span>
                  </label>

                  {/* Signatures */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <label htmlFor="signout-driver-signature" className="block text-xs font-semibold text-slate-300 mb-1">Driver Digital Sign-off</label>
                      <input
                        id="signout-driver-signature"
                        type="text"
                        required
                        placeholder="Driver Signature Name"
                        value={formData.driverSignature || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, driverSignature: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-100 font-serif focus:outline-none"
                      />
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <label htmlFor="signout-fleet-signature" className="block text-xs font-semibold text-slate-300 mb-1">Fleet Inspector Sign-off</label>
                      <input
                        id="signout-fleet-signature"
                        type="text"
                        required
                        placeholder="Fleet Officer Name"
                        value={formData.fleetDepartmentSignature || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, fleetDepartmentSignature: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-100 font-serif focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  {activeTab !== 'details' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(activeTab === 'signatures' ? 'checklist' : 'details')}
                      className="px-4 py-2 min-h-[36px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                    >
                      ← Previous Step
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 min-h-[36px] text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                  >
                    Cancel
                  </button>

                  {activeTab !== 'signatures' ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(activeTab === 'details' ? 'checklist' : 'signatures')}
                      className="px-5 py-2.5 min-h-[36px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 min-h-[36px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      {submitting ? 'Submitting...' : 'Save Handover Record'}
                    </button>
                  )}
                </div>
              </div>
            </form>
      </SignoutModalDialog>

      {/* ── VIEW / PRINT DETAIL MODAL ────────────────────────────────────── */}
      <SignoutModalDialog
        open={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        ariaLabelledBy="signout-detail-modal-title"
        maxWidthClassName="max-w-2xl"
      >
        {selectedRecord && (
          <>
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" aria-hidden="true" />
                <h3 id="signout-detail-modal-title" className="font-bold text-slate-100">
                  Custody Record: Unit #{selectedRecord.unitNumber} ({selectedRecord.isSignIn ? 'Sign In / Return' : 'Sign Out / Handover'})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1.5 min-h-[32px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  Print
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setSelectedRecord(null)}
                  aria-label="Close custody record modal"
                  className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 text-sm text-slate-200">
              {/* Summary Banner */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Driver Custody</div>
                  <div className="text-lg font-bold text-slate-100">{selectedRecord.employeeName}</div>
                  <div className="text-xs text-slate-400">{selectedRecord.driverLicenseClass} · {selectedRecord.cellPhone || 'No Phone'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Date Recorded</div>
                  <div className="text-sm font-bold text-amber-400">{selectedRecord.signDate}</div>
                  <div className="text-xs text-slate-500 font-mono">{selectedRecord.odometer.toLocaleString()} km</div>
                </div>
              </div>

              {/* Vehicle Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Unit Maker</span>
                  <span className="font-semibold text-slate-200">{selectedRecord.unitMaker || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Model & Year</span>
                  <span className="font-semibold text-slate-200">{selectedRecord.unitModel} ({selectedRecord.unitYear || '—'})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Plate</span>
                  <span className="font-semibold text-slate-200">{selectedRecord.licensePlate || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fuel</span>
                  <span className="font-semibold text-slate-200">{selectedRecord.fuelLevelDescription} ({selectedRecord.fuelTypeDescription})</span>
                </div>
              </div>

              {/* Checklist verification tags */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Verified Documents & Gear</h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedRecord.docRegistrationSignIn && <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">✓ Registration</span>}
                  {selectedRecord.docInsuranceSignIn && <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">✓ Insurance</span>}
                  {selectedRecord.docSafetyFitnessSignIn && <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">✓ Safety Fitness</span>}
                  {selectedRecord.checkFireExtinguisher && <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">✓ Extinguisher</span>}
                  {selectedRecord.checkFirstAidKit && <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">✓ First Aid</span>}
                  {selectedRecord.checkTriangles && <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">✓ Triangles</span>}
                  {selectedRecord.checkSeatBeltCutter && <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">✓ Belt Cutter</span>}
                  {selectedRecord.checkBroom && <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">✓ Broom & Brush</span>}
                  {selectedRecord.checkCleankit && <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">✓ Clean Kit</span>}
                  {selectedRecord.checkQstraints && <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">✓ Q-Straints</span>}
                </div>
              </div>

              {/* Notes & Parking */}
              {(selectedRecord.conditionComments || selectedRecord.parkingAddress) && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  {selectedRecord.conditionComments && (
                    <div>
                      <span className="text-slate-500 font-semibold block">Condition Notes:</span>
                      <p className="text-slate-300 mt-0.5">{selectedRecord.conditionComments}</p>
                    </div>
                  )}
                  {selectedRecord.parkingAddress && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-slate-500 font-semibold block">Parking & Emergency:</span>
                      <p className="text-slate-300 mt-0.5">
                        Address: {selectedRecord.parkingAddress} {selectedRecord.fireHallLocation ? `· Nearest Fire Hall: ${selectedRecord.fireHallLocation}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Photos */}
              {selectedRecord.attachments && selectedRecord.attachments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attached Photos</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {selectedRecord.attachments.map((att, idx) => (
                      <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-slate-700 aspect-square focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
                        <img src={att.url} alt={att.fileName || `Attached photo ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Driver Sign-off:</span>
                  <div className="font-serif text-slate-100 text-sm mt-0.5">{selectedRecord.driverSignature || selectedRecord.employeeName}</div>
                  <span className="text-slate-500 text-[10px]">{selectedRecord.driverSignDate || selectedRecord.signDate}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Fleet Department:</span>
                  <div className="font-serif text-slate-100 text-sm mt-0.5">{selectedRecord.fleetDepartmentSignature || selectedRecord.createdBy || 'Fleet Inspector'}</div>
                  <span className="text-slate-500 text-[10px]">{selectedRecord.fleetDepartmentSignDate || selectedRecord.signDate}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </SignoutModalDialog>
    </PageShell>
  );
};
