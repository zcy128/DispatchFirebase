import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PreTripInspection, VehiclePretripStatus } from '../types/pretrip';
import { PreTripService } from '../services/pretripService';
import { DispatchService } from '../services/dispatchService';
import { VehicleService } from '../services/vehicleService';
import { Vehicle } from '../types/vehicle';
import { DispatchShift } from '../types/dispatch';
import { PreTripReportPdfModal } from '../components/pretrip/PreTripReportPdfModal';
import { PreTripFleetRosterPrintModal } from '../components/pretrip/PreTripFleetRosterPrintModal';
import {
  ClipboardCheck,
  Search,
  RefreshCw,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Download,
  Truck,
  User,
  X,
  Database,
  ShieldCheck,
} from 'lucide-react';

export const PreTripInspectionsView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [inspections, setInspections] = useState<PreTripInspection[]>([]);
  const [shifts, setShifts] = useState<DispatchShift[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all_dispatched' | 'missing' | 'passed' | 'defects' | 'all_fleet'>('missing');

  // Modals
  const [selectedInspectionForPdf, setSelectedInspectionForPdf] = useState<PreTripInspection | null>(null);
  const [isIndividualPdfOpen, setIsIndividualPdfOpen] = useState<boolean>(false);
  const [isRosterPdfOpen, setIsRosterPdfOpen] = useState<boolean>(false);

  const isColdData = useMemo(() => {
    return PreTripService.isColdDate(selectedDate);
  }, [selectedDate]);

  // Load shifts, vehicles, and subscribe to pre-trip inspections for selectedDate
  const loadData = async () => {
    setLoading(true);
    try {
      const [vList, sList, inspList] = await Promise.all([
        VehicleService.list().catch(() => []),
        DispatchService.list(selectedDate).catch(() => []),
        PreTripService.listInspections(selectedDate).catch(() => []),
      ]);
      setVehicles(vList);
      setShifts(sList);
      setInspections(inspList);
    } catch (err) {
      console.error('[PreTripInspectionsView] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to live updates for today / recent dates
    if (!PreTripService.isColdDate(selectedDate)) {
      const unsub = PreTripService.subscribeToDate(selectedDate, (live) => {
        setInspections(live);
      });
      return () => unsub();
    }
  }, [selectedDate]);

  // Map each vehicle/shift into unified VehiclePretripStatus
  const roster = useMemo(() => {
    const map = new Map<string, VehiclePretripStatus>();

    // Helper map of vehicleId -> unitNumber
    const vehIdMap = new Map<number, string>();
    vehicles.forEach((v) => {
      if (v.vehicleId !== undefined && v.unitNumber) {
        vehIdMap.set(v.vehicleId, v.unitNumber);
      }
    });

    // 1. First record all dispatched shifts on this date
    shifts.forEach((sh) => {
      const unit = (sh.unitNumber || (sh.vehicleId ? vehIdMap.get(sh.vehicleId) : '') || '').trim();
      if (!unit) return;

      const existing = map.get(unit);
      if (!existing) {
        map.set(unit, {
          unitNumber: unit,
          routeId: sh.routeNo || sh.routeId,
          routeName: sh.routeName || `Route ${sh.routeNo}`,
          driverId: sh.driverId,
          driverName: sh.driverName,
          shiftType: sh.shiftType || 'AM / PM',
          isAssigned: true,
          hasInspection: false,
          status: 'missing',
        });
      } else {
        // Multi-shift assignment: append route info if different
        if (sh.routeNo && !existing.routeId?.includes(sh.routeNo)) {
          existing.routeId = `${existing.routeId}, ${sh.routeNo}`;
        }
      }
    });

    // 2. Map all submitted pre-trip inspections for this date
    inspections.forEach((insp) => {
      const unit = (insp.vehicleUnit || '').trim();
      if (!unit) return;

      const existing = map.get(unit);
      if (existing) {
        existing.hasInspection = true;
        existing.inspection = insp;
        existing.vehiclePlate = insp.vehiclePlate || existing.vehiclePlate;
        existing.status = insp.overallStatus;
        if (!existing.driverName && insp.inspectorName) {
          existing.driverName = insp.inspectorName;
        }
      } else {
        // Vehicle inspected but not currently assigned to a regular dispatch shift (e.g. reserve bus / charter)
        map.set(unit, {
          unitNumber: unit,
          vehiclePlate: insp.vehiclePlate,
          routeId: 'Terminal Reserve / Spare',
          driverName: insp.inspectorName,
          driverId: insp.inspectorId,
          isAssigned: false,
          hasInspection: true,
          inspection: insp,
          status: insp.overallStatus,
        });
      }
    });

    // 3. For 'all_fleet' view, include idle fleet vehicles that had no shift and no inspection
    vehicles.forEach((v) => {
      const unit = v.unitNumber.trim();
      if (!map.has(unit)) {
        map.set(unit, {
          unitNumber: unit,
          vehiclePlate: v.plateNumber,
          unitMaker: v.manufacturer,
          unitModel: v.model,
          unitYear: v.year,
          routeId: 'Unassigned (Yard Parked)',
          isAssigned: false,
          hasInspection: false,
          status: 'unassigned',
        });
      } else {
        const item = map.get(unit)!;
        item.vehiclePlate = item.vehiclePlate || v.plateNumber;
        item.unitMaker = v.manufacturer;
        item.unitModel = v.model;
        item.unitYear = v.year;
      }
    });

    // Sort: Missing scheduled first, then defects, then passed, then unassigned
    return Array.from(map.values()).sort((a, b) => {
      if (a.isAssigned && !a.hasInspection && (!b.isAssigned || b.hasInspection)) return -1;
      if (b.isAssigned && !b.hasInspection && (!a.isAssigned || a.hasInspection)) return 1;
      if (a.isAssigned && !b.isAssigned) return -1;
      if (!a.isAssigned && b.isAssigned) return 1;
      return a.unitNumber.localeCompare(b.unitNumber);
    });
  }, [shifts, inspections, vehicles]);

  // KPIs
  const stats = useMemo(() => {
    const assigned = roster.filter((r) => r.isAssigned);
    const totalAssigned = assigned.length;
    const inspected = assigned.filter((r) => r.hasInspection);
    const missing = assigned.filter((r) => !r.hasInspection);
    const passedClean = inspected.filter((r) => r.status === 'passed').length;
    const defects = inspected.filter((r) => r.status === 'passed_with_minor_defects' || r.status === 'failed_major_defects').length;
    const complianceRate = totalAssigned > 0 ? Math.round((inspected.length / totalAssigned) * 100) : 100;

    return {
      totalAssigned,
      inspectedCount: inspected.length,
      missingCount: missing.length,
      passedClean,
      defects,
      complianceRate,
    };
  }, [roster]);

  // Filtered List
  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      // Tab filter
      if (activeTab === 'all_dispatched' && !item.isAssigned) return false;
      if (activeTab === 'missing' && (!item.isAssigned || item.hasInspection)) return false;
      if (activeTab === 'passed' && item.status !== 'passed') return false;
      if (activeTab === 'defects' && item.status !== 'passed_with_minor_defects' && item.status !== 'failed_major_defects') return false;
      // 'all_fleet' includes everyone

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.unitNumber.toLowerCase().includes(q) ||
          (item.driverName && item.driverName.toLowerCase().includes(q)) ||
          (item.routeId && item.routeId.toLowerCase().includes(q)) ||
          (item.vehiclePlate && item.vehiclePlate.toLowerCase().includes(q)) ||
          (item.inspection?.inspectorName && item.inspection.inspectorName.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [roster, activeTab, searchQuery]);

  // Virtual Scrolling for large fleet rosters (hundreds/thousands of units)
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredRoster.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 58,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl shadow-xs">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Pre-Trip Inspections
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Daily Schedule 5 Check
                </span>
                {isColdData && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 flex items-center gap-1">
                    <Database className="w-3 h-3" /> BigQuery Archive (&gt;7d)
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Monitor vehicle pre-trip completion, identify missing inspections, and export audit certificates
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Date Picker */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Export PDF Audit Roster */}
          <button
            type="button"
            onClick={() => setIsRosterPdfOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition shadow-xs cursor-pointer"
            title="Export or Print Full Fleet Pre-Trip Compliance Audit Log"
          >
            <Download className="w-4 h-4 text-blue-500" />
            <span>Export Compliance Roster (PDF)</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 transition shadow-xs disabled:opacity-50 cursor-pointer"
            title="Refresh Inspections & Shifts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* BigQuery Cold Data Banner (When date > 7 days ago) */}
      {isColdData && (
        <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-start gap-3 text-xs text-sky-800 dark:text-sky-200">
          <Database className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-sky-900 dark:text-sky-100 flex items-center gap-1.5">
              <span>BigQuery Cold Archive Mode (Date: {selectedDate})</span>
              <span className="text-[10px] bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200 px-1.5 py-0.2 rounded font-medium">Historical Cold Tier</span>
            </div>
            <p className="text-sky-700 dark:text-sky-300">
              Live operational pre-trip logs are retained in Firestore for 7 days. Data for <strong>{selectedDate}</strong> is retrieved transparently from Google Cloud BigQuery cold archives for compliance audit integrity.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Dispatched */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Dispatched Units</span>
            <Truck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalAssigned}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active on route shifts</div>
        </div>

        {/* Missing Pre-Trip Card - Core Focus of Fleet! */}
        <div
          onClick={() => setActiveTab('missing')}
          className={`p-4 rounded-xl border cursor-pointer transition shadow-xs ${
            stats.missingCount > 0
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 ring-2 ring-rose-500/20 hover:bg-rose-100/80'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
              Missing Pre-Trip
            </span>
            <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold">
              High Alert
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">{stats.missingCount}</div>
          <div className="text-[11px] text-rose-500 dark:text-rose-300 mt-0.5 font-medium">
            {stats.missingCount > 0 ? 'Assigned but uninspected!' : 'All dispatched units checked'}
          </div>
        </div>

        {/* Inspected Clean */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span>Passed & Clean</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.passedClean}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Zero defects recorded</div>
        </div>

        {/* Defects Flagged */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span>Defects Noted</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.defects}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Minor or major issues</div>
        </div>

        {/* Compliance Rate */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between">
            <span>Compliance Rate</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.complianceRate}%</div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                stats.complianceRate === 100 ? 'bg-emerald-500' : stats.complianceRate > 80 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${stats.complianceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Missing Pre-Trip Alert Banner */}
      {stats.missingCount > 0 && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex items-start justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                Action Required: {stats.missingCount} Vehicle(s) are active on routes without verified Pre-Trip Inspection!
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Under Ontario Highway Traffic Act Regulation 199/07, drivers must complete and record a Schedule 5 inspection prior to transporting passengers. Prompt drivers to complete their inspection in the Driver App immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('missing')}
            className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs whitespace-nowrap cursor-pointer transition"
          >
            Filter Missing Only
          </button>
        </div>
      )}

      {/* Toolbar: Search & Filter Tabs */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Bus #, Plate, Driver Name, or Route..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">Filter View:</span>
          {[
            {
              id: 'missing',
              label: `🚨 Missing Pre-Trip (${stats.missingCount})`,
              badgeClass: stats.missingCount > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white',
            },
            { id: 'all_dispatched', label: `Dispatched Vehicles (${stats.totalAssigned})` },
            { id: 'passed', label: `Passed Clean (${stats.passedClean})` },
            { id: 'defects', label: `With Defects (${stats.defects})` },
            { id: 'all_fleet', label: `All Fleet Units (${roster.length})` },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  active
                    ? tab.badgeClass || 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Roster Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px]">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 shadow-xs backdrop-blur-xs">
              <tr>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Unit #</th>
                <th className="px-4 py-3.5">Plate & Vehicle</th>
                <th className="px-4 py-3.5">Assigned Route</th>
                <th className="px-4 py-3.5">Driver / Inspector</th>
                <th className="px-4 py-3.5">Check Time</th>
                <th className="px-4 py-3.5">Odometer</th>
                <th className="px-4 py-3.5">Defect Notes</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading && roster.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Loading pre-trip inspection roster...
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    {activeTab === 'missing' && stats.missingCount === 0 ? (
                      <div className="py-6 flex flex-col items-center justify-center space-y-2">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                          No Missing Pre-Trips — 100% Compliant!
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md text-center">
                          All {stats.totalAssigned} dispatched vehicles for {selectedDate} have completed and submitted their Schedule 5 circle check inspection.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('all_dispatched')}
                          className="mt-2 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs cursor-pointer"
                        >
                          View All {stats.totalAssigned} Dispatched Units
                        </button>
                      </div>
                    ) : (
                      <>No vehicles found matching current filter ({activeTab}).</>
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
                    const item = filteredRoster[virtualRow.index];
                    if (!item) return null;
                    const isMissing = item.isAssigned && !item.hasInspection;
                    const isPassed = item.status === 'passed';
                    const isMinor = item.status === 'passed_with_minor_defects';
                    const isMajor = item.status === 'failed_major_defects';

                    return (
                      <tr
                        key={item.unitNumber}
                      className={
                        isMissing
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition-colors'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors'
                      }
                    >
                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isMissing ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            MISSING
                          </span>
                        ) : isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Passed
                          </span>
                        ) : isMinor ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Minor Defect
                          </span>
                        ) : isMajor ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <XCircle className="w-3.5 h-3.5" />
                            Major Defect
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-100 dark:bg-slate-800">
                            Idle / Reserve
                          </span>
                        )}
                      </td>

                      {/* Unit Number */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-bold text-slate-900 dark:text-slate-100 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-amber-500" />
                          #{item.unitNumber}
                        </div>
                      </td>

                      {/* Plate & Vehicle Info */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.vehiclePlate || `ON-${item.unitNumber}`}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {item.unitMaker} {item.unitModel} {item.unitYear ? `(${item.unitYear})` : ''}
                        </div>
                      </td>

                      {/* Assigned Route */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.routeId || 'Yard Reserve'}
                        </div>
                        {item.shiftType && (
                          <div className="text-slate-400 text-[11px]">{item.shiftType}</div>
                        )}
                      </td>

                      {/* Driver / Inspector */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {item.inspection?.inspectorName || item.driverName || '—'}
                        </div>
                        {item.driverId && (
                          <div className="text-slate-400 font-mono text-[10px]">
                            ID: {item.driverId}
                          </div>
                        )}
                      </td>

                      {/* Check Time */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono">
                        {item.inspection?.inspectionTime ? (
                          <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {item.inspection.inspectionTime}
                            {isColdData && (
                              <span
                                title="Retrieved from BigQuery cold archive"
                                className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
                              >
                                BigQuery
                              </span>
                            )}
                          </div>
                        ) : isMissing ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold text-[11px]">
                            NOT SUBMITTED
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Odometer */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono">
                        {item.inspection?.odometer ? (
                          <span>{item.inspection.odometer.toLocaleString()} km</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Defect Notes */}
                      <td className="px-4 py-3.5 text-xs max-w-[200px] truncate">
                        {item.inspection?.defectNotes ? (
                          <span className="text-amber-700 dark:text-amber-300 font-medium">
                            {item.inspection.defectNotes}
                          </span>
                        ) : isMissing ? (
                          <span className="text-rose-500 text-[11px] italic">
                            Awaiting driver circle check
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        {item.inspection ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInspectionForPdf(item.inspection || null);
                              setIsIndividualPdfOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                            title="View & Export Official Schedule 5 Certificate (PDF)"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Certificate (PDF)</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No Record</span>
                        )}
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

      {/* Individual Certificate Modal */}
      <PreTripReportPdfModal
        isOpen={isIndividualPdfOpen}
        onClose={() => {
          setIsIndividualPdfOpen(false);
          setSelectedInspectionForPdf(null);
        }}
        inspection={selectedInspectionForPdf}
      />

      {/* Fleet Daily Roster Print Modal */}
      <PreTripFleetRosterPrintModal
        isOpen={isRosterPdfOpen}
        onClose={() => setIsRosterPdfOpen(false)}
        date={selectedDate}
        roster={roster}
      />
    </div>
  );
};
