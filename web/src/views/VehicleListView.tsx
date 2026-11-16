import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Vehicle, VehicleStats } from '../types/vehicle';
import { VehicleDefectReport } from '../types/defect';
import { VehicleInspectionRecord, PreventiveMaintenanceRecord } from '../types/vehicleInspection';
import { DefectService } from '../services/defectService';
import { VehicleInspectionService } from '../services/vehicleInspectionService';
import { getLocalTodayString } from '../utils/dateUtils';
import {
  getUnavailableVehiclesForDate,
  getVehicleUnavailabilityReason,
  getUniqueUnavailableVehicleList
} from '../utils/vehicleAvailabilityUtils';
import { useI18n } from '../contexts/I18nContext';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import type { VehicleExportFieldDef } from '../utils/vehicleExcelExporter';
import {
  Search,
  Filter,
  Bus,
  Car,
  Truck,
  User,
  Phone,
  RefreshCw,
  Building2,
  ChevronRight,
  ShieldCheck,
  Fuel,
  Route as RouteIcon,
  CheckCircle2,
  Clock,
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Download,
  CheckSquare,
  Square,
  X,
  AlertCircle,
  Wrench,
  AlertTriangle
} from 'lucide-react';

// Hoisted static set for table grid columns to eliminate repeated instantiation (Vercel advanced-init-once)
const GRID_DISPLAYED_FIELD_KEYS = new Set([
  'unitNumber',
  'plateNumber',
  'manufacturer',
  'model',
  'year',
  'fuelType',
  'yardName',
  'licenseExpiry',
  'seatCap',
  'wheelchairCap',
  'assignedRouteNo',
  'assignedRouteName',
  'driverName',
  'status',
]);

interface VehicleModalDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  children: React.ReactNode;
}

const VehicleModalDialog: React.FC<VehicleModalDialogProps> = ({
  open,
  onClose,
  ariaLabelledBy,
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
      className="m-0 max-w-none max-h-none w-screen h-screen bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center overflow-y-auto overscroll-contain backdrop:overscroll-contain animate-in fade-in duration-200"
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </dialog>
  );
};

interface VehicleListViewProps {
  vehicles: Vehicle[];
  stats: VehicleStats;
  loading?: boolean;
  onRefresh?: () => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onSelectRoute?: (routeNo: string) => void;
  onEditVehicle?: (vehicle: Vehicle) => void;
  onCreateVehicle?: () => void;
  onDeleteVehicle?: (vehicle: Vehicle) => void;
  syncSource?: 'firestore' | 'api';
}

export const VehicleListView: React.FC<VehicleListViewProps> = ({
  vehicles,
  stats,
  onRefresh,
  onSelectVehicle,
  onSelectRoute,
  onEditVehicle,
  onCreateVehicle,
  onDeleteVehicle,
  syncSource = 'api'
}) => {
  const { t, isFrench } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [fuelFilter, setFuelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [yardFilter, setYardFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Real-time Vehicle Defect, Periodic Inspection & PM records to identify units excluded from dispatch shifts
  const [defectReports, setDefectReports] = useState<VehicleDefectReport[]>([]);
  const [inspectionRecords, setInspectionRecords] = useState<VehicleInspectionRecord[]>([]);
  const [pmRecords, setPmRecords] = useState<PreventiveMaintenanceRecord[]>([]);
  const todayDateStr = useMemo(() => getLocalTodayString(), []);

  useEffect(() => {
    const unsubDefects = DefectService.subscribeToDefects((data) => {
      setDefectReports(Array.isArray(data) ? data : []);
    });
    const unsubInsp = VehicleInspectionService.subscribe((updated) => {
      setInspectionRecords(Array.isArray(updated) ? updated : []);
    });
    const unsubPM = VehicleInspectionService.subscribePM((updated) => {
      setPmRecords(Array.isArray(updated) ? updated : []);
    });

    return () => {
      setTimeout(() => {
        try { unsubDefects(); } catch { /* listener closed */ }
        try { unsubInsp(); } catch { /* listener closed */ }
        try { unsubPM(); } catch { /* listener closed */ }
      }, 150);
    };
  }, []);

  const unavailableVehiclesMap = useMemo(
    () =>
      getUnavailableVehiclesForDate(
        todayDateStr,
        defectReports,
        inspectionRecords,
        pmRecords,
        vehicles
      ),
    [todayDateStr, defectReports, inspectionRecords, pmRecords, vehicles]
  );

  const unavailableVehiclesList = useMemo(
    () => getUniqueUnavailableVehicleList(unavailableVehiclesMap),
    [unavailableVehiclesMap]
  );

  // Excel Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFields, setExportFields] = useState<VehicleExportFieldDef[]>([]);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>([]);
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFieldSearch, setExportFieldSearch] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);


  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Memoized filter logic with deferred search term to prevent UI frame drops (Vercel rerender-memo & rerender-use-deferred-value)
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (typeFilter !== 'ALL' && !v.unitType.toLowerCase().includes(typeFilter.toLowerCase())) {
        return false;
      }
      if (fuelFilter !== 'ALL' && !v.fuelType.toLowerCase().includes(fuelFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ASSIGNED' && !v.assignedRouteId) return false;
        if (statusFilter === 'SPARE' && v.assignedRouteId) return false;
        if (statusFilter === 'EXCLUDED') {
          const vid = v.vehicleId || (typeof v.id === 'number' ? v.id : Number(v.id) || undefined);
          const isExcluded = !!getVehicleUnavailabilityReason(v.unitNumber, vid, unavailableVehiclesMap);
          if (!isExcluded) return false;
        }
      }
      if (yardFilter !== 'ALL' && v.yardName !== yardFilter) {
        return false;
      }

      if (deferredSearchTerm) {
        const term = deferredSearchTerm.toLowerCase();
        const matchUnit = v.unitNumber.toLowerCase().includes(term);
        const matchPlate = (v.plateNumber || '').toLowerCase().includes(term);
        const matchVin = (v.vin || '').toLowerCase().includes(term);
        const matchMfr = (v.manufacturer || '').toLowerCase().includes(term);
        const matchModel = (v.model || '').toLowerCase().includes(term);
        const matchDriver = (v.driverName || '').toLowerCase().includes(term);
        const matchRoute = (v.assignedRouteNo || '').toLowerCase().includes(term);
        if (!matchUnit && !matchPlate && !matchVin && !matchMfr && !matchModel && !matchDriver && !matchRoute) {
          return false;
        }
      }

      return true;
    });
  }, [vehicles, typeFilter, fuelFilter, statusFilter, yardFilter, deferredSearchTerm, unavailableVehiclesMap]);

  // Virtual scrolling for 1,000+ fleet vehicles
  const vehicleTableContainerRef = useRef<HTMLDivElement>(null);

  const vehicleTableVirtualizer = useVirtualizer({
    count: filteredVehicles.length,
    getScrollElement: () => vehicleTableContainerRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const virtualVehicles = vehicleTableVirtualizer.getVirtualItems();
  const vehPaddingTop = virtualVehicles.length > 0 ? virtualVehicles[0]?.start || 0 : 0;
  const vehPaddingBottom = virtualVehicles.length > 0
    ? vehicleTableVirtualizer.getTotalSize() - (virtualVehicles[virtualVehicles.length - 1]?.end || 0)
    : 0;

  // O(1) lookup set for export modal field selection (Vercel js-set-map-lookups)
  const selectedFieldKeysSet = useMemo(() => new Set(selectedFieldKeys), [selectedFieldKeys]);

  const handleToggleField = (key: string) => {
    setSelectedFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllFields = () => {
    setSelectedFieldKeys(exportFields.map((field) => field.key));
  };

  const handleDeselectAllFields = () => {
    setSelectedFieldKeys([]);
  };

  const handleResetAllFields = () => {
    setSelectedFieldKeys(exportFields.map((field) => field.key));
  };

  const openExportModal = async () => {
    setExportError(null);
    const exporter = await import('../utils/vehicleExcelExporter');
    setExportFields(exporter.ALL_VEHICLE_EXPORT_FIELDS);
    setSelectedFieldKeys((prev) =>
      prev.length > 0 ? prev : exporter.ALL_VEHICLE_EXPORT_FIELDS.map((field) => field.key)
    );
    setIsExportModalOpen(true);
  };

  const handleExportExcelSubmit = async () => {
    if (selectedFieldKeys.length === 0) {
      setExportError(
        isFrench
          ? 'Veuillez sélectionner au moins un champ à exporter.'
          : 'Please select at least one field to export.'
      );
      return;
    }

    const targetVehicles = exportScope === 'filtered' ? filteredVehicles : vehicles;
    if (targetVehicles.length === 0) {
      setExportError(
        isFrench
          ? 'Aucun véhicule à exporter avec les critères actuels.'
          : 'No vehicles available to export with current criteria.'
      );
      return;
    }

    setIsExporting(true);
    setExportError(null);
    try {
      const filterSummary =
        exportScope === 'filtered' &&
        (typeFilter !== 'ALL' || fuelFilter !== 'ALL' || statusFilter !== 'ALL' || yardFilter !== 'ALL' || searchTerm)
          ? `Type=${typeFilter}, Fuel=${fuelFilter}, Status=${statusFilter}, Yard=${yardFilter}${searchTerm ? `, Search="${searchTerm}"` : ''}`
          : undefined;

      await (await import('../utils/vehicleExcelExporter')).exportVehiclesToExcel({
        vehicles: targetVehicles,
        selectedFieldKeys,
        isFrench,
        filterSummaryText: filterSummary,
      });

      setIsExportModalOpen(false);
    } catch (err: any) {
      setExportError(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Memoized unique yards list (Vercel rerender-memo)
  const uniqueYards = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.yardName).filter(Boolean))).sort(),
    [vehicles]
  );

  return (
    <PageShell>
      <PageHeader
        title={isFrench ? 'Flotte de véhicules' : 'Fleet & Vehicles'}
        subtitle={
          isFrench
            ? 'Unités actives, état mécanique, affectations de cour et historique d\'inspection.'
            : 'Active fleet units, mechanical availability, yard assignments, and inspection status.'
        }
        actions={
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                void openExportModal();
              }}
              title={t.vehicles.exportExcel}
              className="px-3.5 py-2 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
              <span>{t.vehicles.exportExcel}</span>
            </button>

            {onCreateVehicle && (
              <button
                type="button"
                onClick={onCreateVehicle}
                className="px-3.5 py-2 min-h-[36px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Vehicle</span>
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh vehicles from cloud"
                title="Refresh vehicles from cloud"
                className="px-3.5 py-2 min-h-[36px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline">Refresh Fleet</span>
              </button>
            )}
          </div>
        }
      >
        {/* Top Search & Filter Bar */}
        <search aria-label="Filter vehicles" className="block space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search vehicles"
              placeholder="Search by Unit # (e.g. 1001), Plate, Driver, Route (OCDSB-001), Make/Model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-amber-500 transition placeholder:text-slate-500"
            />
          </div>


        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400 mr-2 font-medium">
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Filter by:</span>
          </div>

          {/* Unit Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by vehicle type"
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Vehicle Types</option>
            <option value="Bus">School Buses (50)</option>
            <option value="Van">Passenger Vans (20)</option>
            <option value="Car">Sedans / Shuttles (10)</option>
          </select>

          {/* Fuel Filter */}
          <select
            value={fuelFilter}
            onChange={(e) => setFuelFilter(e.target.value)}
            aria-label="Filter by fuel type"
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Fuel Types</option>
            <option value="Diesel">Diesel</option>
            <option value="Gasoline">Gasoline</option>
          </select>

          {/* Operational Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by operational status"
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">In Service / On Route</option>
            <option value="SPARE">Spare / Standby</option>
            <option value="EXCLUDED">
              {isFrench
                ? `Exclus des quarts de répartition (${unavailableVehiclesList.length})`
                : `Excluded from Dispatch Shifts (${unavailableVehiclesList.length})`}
            </option>
          </select>

          {/* Yard Filter */}
          <select
            value={yardFilter}
            onChange={(e) => setYardFilter(e.target.value)}
            aria-label="Filter by terminal or yard"
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-base sm:text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Terminals / Yards</option>
            {uniqueYards.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {(typeFilter !== 'ALL' || fuelFilter !== 'ALL' || statusFilter !== 'ALL' || yardFilter !== 'ALL' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('ALL');
                setFuelFilter('ALL');
                setStatusFilter('ALL');
                setYardFilter('ALL');
                setSearchTerm('');
              }}
              className="px-2 py-1 min-h-[28px] text-xs text-rose-400 hover:underline ml-auto font-medium rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
            >
              Clear Filters
            </button>
          )}
        </div>
      </search>
      </PageHeader>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
            <Bus className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.totalVehicles}</div>
            <div className="text-[11px] text-slate-400 font-medium">Total Fleet Size</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.assignedToRoutes}</div>
            <div className="text-[11px] text-slate-400 font-medium">Active on Routes</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
            <Clock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.spareVehicles}</div>
            <div className="text-[11px] text-slate-400 font-medium">Standby / Spare</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.wheelchairAccessible}</div>
            <div className="text-[11px] text-slate-400 font-medium">Wheelchair Equipped</div>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={statusFilter === 'EXCLUDED'}
          onClick={() => setStatusFilter(statusFilter === 'EXCLUDED' ? 'ALL' : 'EXCLUDED')}
          title={
            isFrench
              ? 'Filtrer les véhicules exclus des quarts de répartition'
              : 'Filter vehicles excluded from dispatch shifts'
          }
          className={`rounded-2xl p-4 flex items-center space-x-3.5 text-left transition border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 ${
            statusFilter === 'EXCLUDED'
              ? 'bg-rose-950/50 border-rose-500/60 ring-1 ring-rose-500/40'
              : unavailableVehiclesList.length > 0
              ? 'bg-slate-900 border-rose-500/30 hover:bg-slate-800/80'
              : 'bg-slate-900 border-slate-800 hover:bg-slate-800/60'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              unavailableVehiclesList.length > 0
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                : 'bg-slate-800 border border-slate-700 text-slate-400'
            }`}
          >
            <Wrench className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div
              className={`text-xl font-bold tracking-tight ${
                unavailableVehiclesList.length > 0 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {unavailableVehiclesList.length}
            </div>
            <div className="text-[11px] text-slate-400 font-medium truncate">
              {isFrench ? 'Exclus répartition' : 'Excluded from Dispatch'}
            </div>
          </div>
        </button>
      </div>

      {/* Vehicle Fleet Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="font-bold text-white text-sm">
            Fleet Roster ({filteredVehicles.length} of {vehicles.length})
          </div>
          <div className="text-xs text-slate-400">
            {syncSource === 'firestore'
              ? 'Real-time onSnapshot sync active'
              : 'Loaded from API'}
          </div>
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Bus className="w-8 h-8 mx-auto text-slate-600" aria-hidden="true" />
            <div className="font-semibold text-sm">No vehicles match current filter criteria</div>
            <div className="text-xs text-slate-600">Try changing vehicle type, fuel, or search terms</div>
          </div>
        ) : (
          <div
            ref={vehicleTableContainerRef}
            tabIndex={0}
            role="region"
            aria-label="Vehicle fleet roster table"
            className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500"
          >
            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1240px]">
              <caption className="sr-only">Vehicle fleet roster</caption>
              <colgroup>
                <col style={{ width: '230px' }} />
                <col style={{ width: '170px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '120px' }} />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[11px] shadow-xs">
                <tr>
                  <th scope="col" className="py-3 px-4">Unit # & Type</th>
                  <th scope="col" className="py-3 px-4">Make, Model & Year</th>
                  <th scope="col" className="py-3 px-4">Terminal / Yard</th>
                  <th scope="col" className="py-3 px-4">Capacities</th>
                  <th scope="col" className="py-3 px-4">Assigned Route</th>
                  <th scope="col" className="py-3 px-4">Assigned Driver</th>
                  <th scope="col" className="py-3 px-4 text-center">Status</th>
                  <th scope="col" className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {vehPaddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${vehPaddingTop}px`, padding: 0, border: 0 }} colSpan={8} />
                  </tr>
                )}
                {virtualVehicles.map((virtualRow) => {
                  const v = filteredVehicles[virtualRow.index];
                  if (!v) return null;
                  const isBus = v.unitType.toLowerCase().includes('bus');
                  const isVan = v.unitType.toLowerCase().includes('van');
                  const isAssigned = !!v.assignedRouteId;
                  const vid = v.vehicleId || (typeof v.id === 'number' ? v.id : Number(v.id) || undefined);
                  const exclusionReason = getVehicleUnavailabilityReason(
                    v.unitNumber,
                    vid,
                    unavailableVehiclesMap
                  );

                  return (
                    <tr
                      key={v.id}
                      onClick={() => onSelectVehicle(v)}
                      className={`h-16 transition cursor-pointer group ${
                        exclusionReason
                          ? 'bg-rose-950/15 hover:bg-rose-950/25'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Unit # & Type */}
                      <td className="py-2.5 px-4 align-middle h-16">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              exclusionReason
                                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                            }`}
                          >
                            {isBus ? <Bus className="w-5 h-5" aria-hidden="true" /> : isVan ? <Truck className="w-5 h-5" aria-hidden="true" /> : <Car className="w-5 h-5" aria-hidden="true" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-amber-400 transition flex items-center space-x-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectVehicle(v);
                                }}
                                aria-label={`View details for Unit #${v.unitNumber}`}
                                className="text-left hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              >
                                Unit #{v.unitNumber}
                              </button>
                              {exclusionReason && (
                                <span
                                  title={isFrench ? exclusionReason.detailFr : exclusionReason.detailEn}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                    exclusionReason.reason === 'defect'
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  }`}
                                >
                                  <Wrench className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                  <span>{isFrench ? 'Exclu répartition' : 'Excluded from Dispatch'}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              {v.plateNumber || 'No Plate'}
                              {v.gpsSerial ? ` · GPS ${v.gpsSerial}` : ''}
                            </div>
                            {exclusionReason && (
                              <div
                                className="text-[10px] font-semibold text-rose-300/90 truncate mt-0.5"
                                title={isFrench ? exclusionReason.detailFr : exclusionReason.detailEn}
                              >
                                {isFrench ? exclusionReason.badgeTextFr : exclusionReason.badgeTextEn}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Make, Model & Year */}
                      <td className="py-2.5 px-4 align-middle h-16">
                        <div className="font-medium text-slate-200">
                          {v.manufacturer} {v.model}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{v.year}</span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Fuel className="w-3 h-3 text-slate-500" aria-hidden="true" />
                            <span>{v.fuelType}</span>
                          </span>
                        </div>
                      </td>

                      {/* Terminal / Yard */}
                      <td className="py-2.5 px-4 align-middle h-16">
                        <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          <span>{v.yardName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Insp: {v.nextInspectionDue ? v.nextInspectionDue.substring(0, 10) : 'Not set'}
                        </div>
                      </td>

                      {/* Capacities */}
                      <td className="py-2.5 px-4 align-middle h-16">
                        <div className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold">
                          <span className="text-slate-200">{v.seatCap} seats</span>
                          {v.wheelchairCap > 0 && (
                            <>
                              <span className="text-slate-500">•</span>
                              <span className="text-indigo-400">{v.wheelchairCap} WC</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Assigned Route */}
                      <td className="py-2.5 px-4 align-middle h-16">
                        {v.assignedRouteNo ? (
                          <div className="space-y-0.5">
                            {onSelectRoute ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectRoute(v.assignedRouteNo!);
                                }}
                                aria-label={`View route ${v.assignedRouteNo}`}
                                className="font-bold text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              >
                                <RouteIcon className="w-3 h-3" aria-hidden="true" />
                                <span>{v.assignedRouteNo}</span>
                              </button>
                            ) : (
                              <div className="font-bold text-amber-400 flex items-center space-x-1">
                                <RouteIcon className="w-3 h-3" aria-hidden="true" />
                                <span>{v.assignedRouteNo}</span>
                              </div>
                            )}
                            <div className="text-[11px] text-slate-400 truncate max-w-[160px]" title={v.assignedRouteName}>
                              {v.assignedRouteName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Standby / Unassigned</span>
                        )}
                      </td>

                      {/* Assigned Driver */}
                      <td className="py-2.5 px-4 align-middle h-16">
                        {v.driverName ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-200 flex items-center space-x-1">
                              <User className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                              <span>{v.driverName}</span>
                            </div>
                            {v.driverPhone && (
                              <a
                                href={`tel:${v.driverPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-amber-400 hover:underline font-mono text-[11px] flex items-center space-x-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                              >
                                <Phone className="w-3 h-3" aria-hidden="true" />
                                <span>{v.driverPhone}</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-4 text-center align-middle h-16">
                        {exclusionReason ? (
                          <div
                            className="flex flex-col items-center gap-0.5"
                            title={isFrench ? exclusionReason.detailFr : exclusionReason.detailEn}
                          >
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                exclusionReason.reason === 'defect'
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                              }`}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span className="truncate max-w-[125px]">
                                {isFrench ? exclusionReason.badgeTextFr : exclusionReason.badgeTextEn}
                              </span>
                            </span>
                            <span className="text-[10px] text-rose-400/90 font-semibold">
                              {isFrench ? 'Exclu des quarts' : 'Excluded from Shifts'}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              isAssigned
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {v.status || (isAssigned ? 'In Service' : 'Spare')}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-4 text-right align-middle h-16">
                        <div className="flex items-center justify-end space-x-1">
                          {onEditVehicle && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditVehicle(v);
                              }}
                              aria-label={`Edit vehicle ${v.unitNumber}`}
                              title="Edit Vehicle"
                              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                            >
                              <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                          {onDeleteVehicle && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteVehicle(v);
                              }}
                              aria-label={`Delete vehicle ${v.unitNumber}`}
                              title="Delete / Decommission Vehicle"
                              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                          <div className="flex items-center text-slate-400 group-hover:text-amber-400 transition pl-1">
                            <span className="text-[11px] mr-1 hidden sm:inline">Specs</span>
                            <ChevronRight className="w-4 h-4" aria-hidden="true" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {vehPaddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${vehPaddingBottom}px`, padding: 0, border: 0 }} colSpan={8} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Export Configuration Modal */}
      <VehicleModalDialog
        open={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        ariaLabelledBy="vehicle-export-modal-title"
      >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="vehicle-export-modal-title" className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{t.vehicles.exportModalTitle}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      .XLSX
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.vehicles.exportModalSubtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setIsExportModalOpen(false)}
                aria-label="Close export modal"
                className="text-slate-400 hover:text-white p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-slate-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Export Scope Selector */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  {t.vehicles.exportScope}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      exportScope === 'filtered'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="radio"
                        name="exportScope"
                        value="filtered"
                        checked={exportScope === 'filtered'}
                        onChange={() => setExportScope('filtered')}
                        className="text-emerald-500 focus:ring-0"
                      />
                      <div>
                        <div className="font-bold text-white">{t.vehicles.exportFilteredOnly}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {filteredVehicles.length} {isFrench ? 'véhicules filtrés' : 'matching vehicles'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700">
                      {filteredVehicles.length}
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      exportScope === 'all'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="radio"
                        name="exportScope"
                        value="all"
                        checked={exportScope === 'all'}
                        onChange={() => setExportScope('all')}
                        className="text-emerald-500 focus:ring-0"
                      />
                      <div>
                        <div className="font-bold text-white">{t.vehicles.exportAllVehicles}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {vehicles.length} {isFrench ? 'véhicules totaux' : 'total vehicles in database'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700">
                      {vehicles.length}
                    </span>
                  </label>
                </div>
              </div>

              {/* Field Selection Toolbar */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-xs uppercase tracking-wider">
                      {t.vehicles.fieldsToExport}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                      {selectedFieldKeys.length} / {exportFields.length} {t.vehicles.fieldsSelected}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllFields}
                      className="px-2.5 py-1 min-h-[28px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      {t.vehicles.selectAll}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFields}
                      className="px-2.5 py-1 min-h-[28px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      {t.vehicles.deselectAll}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAllFields}
                      className="px-2.5 py-1 min-h-[28px] rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      {t.vehicles.resetDefaults}
                    </button>
                  </div>
                </div>

                {/* Quick field search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Search export fields"
                    placeholder={t.vehicles.searchFieldsPlaceholder}
                    value={exportFieldSearch}
                    onChange={(e) => setExportFieldSearch(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-base sm:text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Categorized Field Checkboxes */}
                <div className="space-y-4 max-h-[42vh] overflow-y-auto pr-1">
                  {(['identification', 'specifications', 'operations', 'assignment', 'system'] as const).map(
                    (categoryKey) => {
                      const categoryFields = exportFields.filter((f) => {
                        if (f.category !== categoryKey) return false;
                        if (!exportFieldSearch) return true;
                        const search = exportFieldSearch.toLowerCase();
                        return (
                          f.labelEn.toLowerCase().includes(search) ||
                          f.labelFr.toLowerCase().includes(search) ||
                          f.key.toLowerCase().includes(search)
                        );
                      });

                      if (categoryFields.length === 0) return null;

                      const categoryTitle = isFrench
                        ? categoryFields[0].categoryLabelFr
                        : categoryFields[0].categoryLabelEn;

                      return (
                        <div
                          key={categoryKey}
                          className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 space-y-2"
                        >
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                            <span>{categoryTitle}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {categoryFields.filter((f) => selectedFieldKeysSet.has(f.key)).length} /{' '}
                              {categoryFields.length}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {categoryFields.map((field) => {
                              const isChecked = selectedFieldKeysSet.has(field.key);
                              const isGridCol = GRID_DISPLAYED_FIELD_KEYS.has(field.key);
                              const label = isFrench ? field.labelFr : field.labelEn;

                              return (
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={isChecked}
                                  key={field.key}
                                  onClick={() => handleToggleField(field.key)}
                                  className={`w-full p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition select-none text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                                    isChecked
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                                    <div className="shrink-0 text-emerald-400" aria-hidden="true">
                                      {isChecked ? (
                                        <CheckSquare className="w-4 h-4" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-600" />
                                      )}
                                    </div>
                                    <span className="text-xs font-medium truncate" title={label}>
                                      {label}
                                    </span>
                                  </div>

                                  <span
                                    className={`shrink-0 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                      isGridCol
                                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}
                                    title={
                                      isGridCol
                                        ? 'Shown in fleet table grid'
                                        : 'Extra field not displayed in data grid'
                                    }
                                  >
                                    {isGridCol
                                      ? isFrench
                                        ? 'Tableau'
                                        : 'In Grid'
                                      : isFrench
                                      ? 'Étendu'
                                      : 'Extended'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {exportError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{exportError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                <span className="text-white font-bold">{selectedFieldKeys.length}</span>{' '}
                {t.vehicles.fieldsSelected} (
                {exportScope === 'filtered' ? filteredVehicles.length : vehicles.length}{' '}
                {isFrench ? 'véhicules' : 'vehicles'})
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition border border-slate-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                >
                  {t.vehicles.cancel}
                </button>

                <button
                  type="button"
                  disabled={isExporting || selectedFieldKeys.length === 0}
                  onClick={handleExportExcelSubmit}
                  className="px-4 py-2 min-h-[36px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg flex items-center space-x-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>{t.vehicles.exporting}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" aria-hidden="true" />
                      <span>{t.vehicles.downloadExcel}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
      </VehicleModalDialog>
    </PageShell>
  );
};

