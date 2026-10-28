import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { VehicleSignout, CreateVehicleSignoutPayload, VehicleSignoutAttachment } from '../types/vehicleSignout';
import { VehicleSignoutService } from '../services/vehicleSignoutService';
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

export const VehicleSignoutView: React.FC = () => {
  const { currentUser } = useAuth();

  // Role validation: Strictly only fleet or admin
  const isFleetRole = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.role || '').toLowerCase();
    return r === 'fleet' || r === 'admin';
  }, [currentUser]);

  // State
  const [records, setRecords] = useState<VehicleSignout[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  // Fetch initial data
  const fetchData = async () => {
    if (!isFleetRole) return;
    setLoading(true);
    try {
      const [signouts, vList, eList] = await Promise.all([
        VehicleSignoutService.list({ role: 'fleet', timeRange: '1year' }),
        VehicleService.list().catch(() => []),
        EmployeeService.list().catch(() => [])
      ]);
      setRecords(signouts);
      setVehicles(vList);
      setEmployees(eList);
    } catch (err) {
      console.error('Error fetching handover data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async (targetQuery?: string) => {
    if (!isFleetRole) return;
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q && !dateFilter) {
      setRecords([]);
      setLoading(false);
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
      setRecords(signouts);
    } catch (err) {
      console.error('Error fetching handover data:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFleetRole) return;
    if (timeRange === '1year') {
      fetchData();
      const unsub = VehicleSignoutService.subscribeToLive((live) => {
        setRecords(live);
        setLoading(false);
      });
      return () => unsub();
    } else {
      if (searchQuery.trim() || dateFilter) {
        loadRecords(searchQuery.trim());
      } else {
        setRecords([]);
        setLoading(false);
      }
    }
  }, [isFleetRole, timeRange]);

  // Vehicle selection auto-fill
  const handleSelectVehicle = (unitNum: string) => {
    const v = vehicles.find((item) => item.unitNumber === unitNum);
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
      const res = await fetch('/api/public/upload', {
        method: 'POST',
        body: uploadData
      });
      if (res.ok) {
        const json = await res.json();
        const newAtt: VehicleSignoutAttachment = {
          url: json.url,
          fileName: file.name,
          uploadedTime: new Date().toISOString()
        };
        setFormData((prev) => ({
          ...prev,
          attachments: [...(prev.attachments || []), newAtt]
        }));
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Submit new handover
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitNumber || !formData.employeeName) {
      alert('Please provide Vehicle Unit Number and Driver Name.');
      return;
    }
    setSubmitting(true);
    try {
      await VehicleSignoutService.create(formData);
      setIsCreateOpen(false);
      fetchData();
    } catch (err: any) {
      alert(`Failed to save handover record: ${err?.message || err}`);
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

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter === 'sign_in' && !r.isSignIn) return false;
      if (typeFilter === 'sign_out' && r.isSignIn) return false;
      if (dateFilter && !r.signDate.startsWith(dateFilter)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchUnit = r.unitNumber.toLowerCase().includes(q);
        const matchDriver = r.employeeName.toLowerCase().includes(q);
        const matchRoute = (r.routeId || '').toLowerCase().includes(q) || (r.routeName || '').toLowerCase().includes(q);
        if (!matchUnit && !matchDriver && !matchRoute) return false;
      }
      return true;
    });
  }, [records, typeFilter, dateFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = records.length;
    const signedOut = records.filter((r) => !r.isSignIn).length;
    const signedIn = records.filter((r) => r.isSignIn).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = records.filter((r) => r.signDate.startsWith(todayStr)).length;
    return { total, signedOut, signedIn, todayCount };
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                Vehicle Sign-Out & Handover
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-wider">
                  Fleet Exclusive
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Track unit custody, vehicle document packs, safety equipment checks, and driver sign-off agreements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
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
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
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
              setActiveTab('details');
              setIsCreateOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Handover Form</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-semibold">Total Records</span>
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">Custody logs on file</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-semibold text-blue-400">Signed Out</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">{stats.signedOut}</div>
          <div className="text-xs text-slate-500 mt-1">In field custody</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-semibold text-emerald-400">Signed In</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.signedIn}</div>
          <div className="text-xs text-slate-500 mt-1">Returned to yard/fleet</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs uppercase font-semibold text-amber-400">Today's Activity</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats.todayCount}</div>
          <div className="text-xs text-slate-500 mt-1">Handovers today</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {timeRange === 'all' && (
            <button
              type="button"
              onClick={() => loadRecords(searchQuery.trim())}
              disabled={loading || (!searchQuery.trim() && !dateFilter)}
              className="px-3.5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-xl transition shadow-xs whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Search Archive
            </button>
          )}
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            Range:
          </span>
          {[
            { id: '1year', label: '1 Year (Live)' },
            { id: 'all', label: 'All History' },
          ].map((rng) => (
            <button
              key={rng.id}
              type="button"
              onClick={() => setTimeRange(rng.id as any)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
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
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                typeFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('sign_out')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                typeFilter === 'sign_out' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Out (Handover)
            </button>
            <button
              onClick={() => setTypeFilter('sign_in')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                typeFilter === 'sign_in' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In (Return)
            </button>
          </div>

          {/* Date Picker */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 10-Year Safe Scan Notice Banner */}
      {timeRange === 'all' && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs text-amber-300">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-200 flex items-center gap-1.5">
              <span>All History Mode (BigQuery Cold Archive)</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">10-Year Safe Scan</span>
            </div>
            <p className="text-amber-400/80">
              Live vehicle handover records cover the most recent 1 year. Older data is stored in BigQuery cold archives. To avoid massive 10-year database scans, please enter a <strong>Bus Unit #</strong>, <strong>Driver Name</strong>, <strong>Employee ID</strong>, or <strong>Route #</strong> to query historical archive records.
            </p>
          </div>
        </div>
      )}

      {/* Record Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Vehicle Unit</th>
                <th className="py-3.5 px-4">Driver / Recipient</th>
                <th className="py-3.5 px-4">Route</th>
                <th className="py-3.5 px-4">Odometer & Fuel</th>
                <th className="py-3.5 px-4">Condition</th>
                <th className="py-3.5 px-4 text-center">Photos</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading vehicle handover records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <FileSignature className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    {timeRange === 'all' && !searchQuery.trim() && !dateFilter ? (
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-300">
                          Enter Bus #, Driver Name, Route, or Date to Search 10-Year Archive
                        </div>
                        <div className="text-xs text-slate-500 max-w-md mx-auto">
                          Live vehicle handover records cover the most recent 1 year. Type a query above and click &quot;Search Archive&quot; to inspect historical records.
                        </div>
                      </div>
                    ) : (
                      <>No vehicle handover records match your filters.</>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Type */}
                    <td className="py-3.5 px-4">
                      {r.isSignIn ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Sign In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          Sign Out
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
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        Unit #{r.unitNumber}
                      </div>
                      <div className="text-xs text-slate-400">
                        {r.unitMaker} {r.unitModel} {r.licensePlate ? `· ${r.licensePlate}` : ''}
                      </div>
                    </td>

                    {/* Driver */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-100 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {r.employeeName}
                      </div>
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
                        <Gauge className="w-3 h-3 text-slate-400" />
                        {r.odometer ? r.odometer.toLocaleString() + ' km' : '—'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Fuel className="w-3 h-3 text-amber-400" />
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
                        <span className="text-xs text-slate-500 italic">No notes</span>
                      )}
                    </td>

                    {/* Photos */}
                    <td className="py-3.5 px-4 text-center">
                      {r.attachments && r.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-amber-400 border border-amber-500/30">
                          <Camera className="w-3 h-3" />
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
                          onClick={() => setSelectedRecord(r)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete vehicle handover record for Unit #${r.unitNumber}?`)) {
                              await VehicleSignoutService.delete(r.id);
                              fetchData();
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE NEW HANDOVER MODAL ─────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100">Create Vehicle Handover Record</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/50">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Vehicle & Custody
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('checklist')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors ${
                  activeTab === 'checklist'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Inspection Checklists
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('signatures')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors ${
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
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, isSignIn: false }))}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        !formData.isSignIn
                          ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" />
                        Sign Out (Dispatch to Driver)
                      </div>
                      <div className="text-xs opacity-75">Vehicle handed over to driver for route service.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, isSignIn: true }))}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        formData.isSignIn
                          ? 'bg-emerald-600/15 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Sign In (Return to Yard)
                      </div>
                      <div className="text-xs opacity-75">Vehicle returned and custody transferred back to fleet.</div>
                    </button>
                  </div>

                  {/* Vehicle Unit Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Vehicle Unit # *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 101 or select from fleet"
                        list="vehicle-options"
                        value={formData.unitNumber}
                        onChange={(e) => handleSelectVehicle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
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
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Handover Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.signDate}
                        onChange={(e) => setFormData((p) => ({ ...p, signDate: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* Driver Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Driver / Employee Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Select or enter driver name"
                        list="driver-options"
                        value={formData.employeeName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((p) => ({ ...p, employeeName: val }));
                          const match = employees.find((emp) => `${emp.firstName} ${emp.lastName}`.toLowerCase() === val.toLowerCase());
                          if (match) handleSelectEmployee(match.id);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
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
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">License Class & Conditions</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Class 2-S"
                          value={formData.driverLicenseClass || ''}
                          onChange={(e) => setFormData((p) => ({ ...p, driverLicenseClass: e.target.value }))}
                          className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                        />
                        <input
                          type="text"
                          placeholder="e.g. None / Lenses"
                          value={formData.driverLicenseCondition || ''}
                          onChange={(e) => setFormData((p) => ({ ...p, driverLicenseCondition: e.target.value }))}
                          className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Route & Phone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assigned Route (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Route 101 or General"
                        value={formData.routeId || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, routeId: e.target.value, routeName: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Driver Contact Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. 403-555-0199"
                        value={formData.cellPhone || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, cellPhone: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* Odometer & Fuel Level */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Current Odometer (km) *</label>
                      <input
                        type="number"
                        required
                        value={formData.odometer}
                        onChange={(e) => setFormData((p) => ({ ...p, odometer: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Fuel Level</label>
                      <select
                        value={formData.fuelLevelDescription || 'Full'}
                        onChange={(e) => setFormData((p) => ({ ...p, fuelLevelDescription: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="Full">Full (100%)</option>
                        <option value="3/4 Full">3/4 Full (75%)</option>
                        <option value="1/2 Full">1/2 Full (50%)</option>
                        <option value="1/4 Full">1/4 Full (25%)</option>
                        <option value="Near Empty">Low / Reserve</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Fuel Type</label>
                      <select
                        value={formData.fuelTypeDescription || 'Diesel'}
                        onChange={(e) => setFormData((p) => ({ ...p, fuelTypeDescription: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
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
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors"
                    >
                      ✓ Select All Verified
                    </button>
                  </div>

                  {/* Section A: Document Pack Checklist */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      Vehicle Document Packet
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {[
                        { key: 'docRegistrationSignIn', label: 'Vehicle Registration' },
                        { key: 'docInsuranceSignIn', label: 'Pink Card / Insurance' },
                        { key: 'docSafetyFitnessSignIn', label: 'Safety Fitness Certificate' },
                        { key: 'docCollisionReportSignIn', label: 'Collision Report Forms' },
                        { key: 'docScheduleMaintenanceSignIn', label: 'Schedule 2 Maintenance' },
                        { key: 'docSdsSignIn', label: 'SDS Safety Binder' }
                      ].map((item) => (
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
                      <ShieldCheck className="w-4 h-4" />
                      Safety Equipment Checklist
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[
                        { key: 'checkFireExtinguisher', label: 'Fire Extinguisher' },
                        { key: 'checkFirstAidKit', label: 'First Aid Kit' },
                        { key: 'checkTriangles', label: 'Warning Triangles (3)' },
                        { key: 'checkSeatBeltCutter', label: 'Seat Belt Cutter' },
                        { key: 'checkBroom', label: 'Broom' },
                        { key: 'checkSnowbrush', label: 'Snowbrush' },
                        { key: 'checkCleankit', label: 'Body Fluid / Spill Kit' },
                        { key: 'checkQstraints', label: 'Wheelchair Q-Straints' }
                      ].map((item) => (
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
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Designated Parking Address</label>
                      <input
                        type="text"
                        placeholder="e.g. 123 Calgary Trail NW / Approved Yard"
                        value={formData.parkingAddress || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, parkingAddress: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nearest Fire Hall Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Fire Station 14 - 1100 McKnight"
                        value={formData.fireHallLocation || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, fireHallLocation: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* Condition Key & Comments */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Condition Key & Observations (B: Broken, C: Chip, CR: Crack, D: Dent, H: Hole, M: Missing, S: Scrape)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Note any pre-existing blemishes, scratches, interior cleanliness observations..."
                      value={formData.conditionComments || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, conditionComments: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Photo Attachments */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Photo Attachments</label>
                    <div className="flex flex-wrap items-center gap-3">
                      {formData.attachments?.map((att, idx) => (
                        <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                          <img src={att.url} alt="attachment" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                attachments: p.attachments?.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl cursor-pointer text-slate-400 hover:text-amber-400 transition-colors bg-slate-950">
                        {uploadingPhoto ? (
                          <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                        ) : (
                          <>
                            <Upload className="w-5 h-5 mb-1" />
                            <span className="text-[10px] font-medium">Add Photo</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
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
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Driver Digital Sign-off</label>
                      <input
                        type="text"
                        required
                        placeholder="Driver Signature Name"
                        value={formData.driverSignature || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, driverSignature: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-serif focus:outline-none"
                      />
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Fleet Inspector Sign-off</label>
                      <input
                        type="text"
                        required
                        placeholder="Fleet Officer Name"
                        value={formData.fleetDepartmentSignature || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, fleetDepartmentSignature: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-serif focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  {activeTab !== 'details' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(activeTab === 'signatures' ? 'checklist' : 'details')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                    >
                      ← Previous Step
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
                  >
                    Cancel
                  </button>

                  {activeTab !== 'signatures' ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(activeTab === 'details' ? 'checklist' : 'signatures')}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {submitting ? 'Submitting...' : 'Save Handover Record'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW / PRINT DETAIL MODAL ────────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100">
                  Custody Record: Unit #{selectedRecord.unitNumber} ({selectedRecord.isSignIn ? 'Sign In / Return' : 'Sign Out / Handover'})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
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
                      <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-slate-700 aspect-square">
                        <img src={att.url} alt="attached" className="w-full h-full object-cover" />
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
          </div>
        </div>
      )}
    </div>
  );
};
