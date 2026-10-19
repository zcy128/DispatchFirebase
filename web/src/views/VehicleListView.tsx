import React, { useState } from 'react';
import { Vehicle, VehicleStats } from '../types/vehicle';
import { useI18n } from '../contexts/I18nContext';
import {
  ALL_VEHICLE_EXPORT_FIELDS,
  exportVehiclesToExcel
} from '../utils/vehicleExcelExporter';
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
  AlertCircle
} from 'lucide-react';

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
}

export const VehicleListView: React.FC<VehicleListViewProps> = ({
  vehicles,
  stats,
  onRefresh,
  onSelectVehicle,
  onSelectRoute,
  onEditVehicle,
  onCreateVehicle,
  onDeleteVehicle
}) => {
  const { t, isFrench } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [fuelFilter, setFuelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [yardFilter, setYardFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Excel Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  // Default export all fields, even not shown in the data grid
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>(() =>
    ALL_VEHICLE_EXPORT_FIELDS.map((f) => f.key)
  );
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFieldSearch, setExportFieldSearch] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);


  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (typeFilter !== 'ALL' && !v.unitType.toLowerCase().includes(typeFilter.toLowerCase())) {
      return false;
    }
    if (fuelFilter !== 'ALL' && !v.fuelType.toLowerCase().includes(fuelFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ASSIGNED' && !v.assignedRouteId) return false;
      if (statusFilter === 'SPARE' && v.assignedRouteId) return false;
    }
    if (yardFilter !== 'ALL' && v.yardName !== yardFilter) {
      return false;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
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

  const handleToggleField = (key: string) => {
    setSelectedFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllFields = () => {
    setSelectedFieldKeys(ALL_VEHICLE_EXPORT_FIELDS.map((f) => f.key));
  };

  const handleDeselectAllFields = () => {
    setSelectedFieldKeys([]);
  };

  const handleResetAllFields = () => {
    setSelectedFieldKeys(ALL_VEHICLE_EXPORT_FIELDS.map((f) => f.key));
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

      await exportVehiclesToExcel({
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

  const uniqueYards = Array.from(new Set(vehicles.map((v) => v.yardName).filter(Boolean)));

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Unit # (e.g. 1001), Plate, Driver, Route (OCDSB-001), Make/Model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition placeholder:text-slate-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setExportError(null);
                setIsExportModalOpen(true);
              }}
              title={t.vehicles.exportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5 shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t.vehicles.exportExcel}</span>
            </button>

            {onCreateVehicle && (
              <button
                onClick={onCreateVehicle}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Vehicle</span>
              </button>
            )}
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh vehicles from cloud"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh Fleet</span>
              </button>
            )}
          </div>
        </div>


        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400 mr-2 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter by:</span>
          </div>

          {/* Unit Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
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
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Fuel Types</option>
            <option value="Diesel">Diesel</option>
            <option value="Gasoline">Gasoline</option>
          </select>

          {/* Operational Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">In Service / On Route (50)</option>
            <option value="SPARE">Spare / Standby (30)</option>
          </select>

          {/* Yard Filter */}
          <select
            value={yardFilter}
            onChange={(e) => setYardFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
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
              onClick={() => {
                setTypeFilter('ALL');
                setFuelFilter('ALL');
                setStatusFilter('ALL');
                setYardFilter('ALL');
                setSearchTerm('');
              }}
              className="text-xs text-rose-400 hover:underline ml-auto font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.totalVehicles}</div>
            <div className="text-[11px] text-slate-400 font-medium">Total Fleet Size</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.assignedToRoutes}</div>
            <div className="text-[11px] text-slate-400 font-medium">Active on Routes</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.spareVehicles}</div>
            <div className="text-[11px] text-slate-400 font-medium">Standby / Spare</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.wheelchairAccessible}</div>
            <div className="text-[11px] text-slate-400 font-medium">Wheelchair Equipped</div>
          </div>
        </div>
      </div>

      {/* Vehicle Fleet Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="font-bold text-white text-sm">
            Fleet Roster ({filteredVehicles.length} of {vehicles.length})
          </div>
          <div className="text-xs text-slate-400">
            Real-time onSnapshot sync active
          </div>
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Bus className="w-8 h-8 mx-auto text-slate-600" />
            <div className="font-semibold text-sm">No vehicles match current filter criteria</div>
            <div className="text-xs text-slate-600">Try changing vehicle type, fuel, or search terms</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Unit # & Type</th>
                  <th className="py-3 px-4">Make, Model & Year</th>
                  <th className="py-3 px-4">Terminal / Yard</th>
                  <th className="py-3 px-4">Capacities</th>
                  <th className="py-3 px-4">Assigned Route</th>
                  <th className="py-3 px-4">Assigned Driver</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredVehicles.map((v) => {
                  const isBus = v.unitType.toLowerCase().includes('bus');
                  const isVan = v.unitType.toLowerCase().includes('van');
                  const isAssigned = !!v.assignedRouteId;

                  return (
                    <tr
                      key={v.id}
                      onClick={() => onSelectVehicle(v)}
                      className="hover:bg-slate-800/40 transition cursor-pointer group"
                    >
                      {/* Unit # & Type */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xs">
                            {isBus ? <Bus className="w-5 h-5" /> : isVan ? <Truck className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-amber-400 transition flex items-center space-x-1.5">
                              <span>Unit #{v.unitNumber}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {v.plateNumber || 'No Plate'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Make, Model & Year */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">
                          {v.manufacturer} {v.model}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{v.year}</span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Fuel className="w-3 h-3 text-slate-500" />
                            <span>{v.fuelType}</span>
                          </span>
                        </div>
                      </td>

                      {/* Terminal / Yard */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{v.yardName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Insp: {v.licenseExpiry ? v.licenseExpiry.substring(0, 10) : '2028-08-31'}
                        </div>
                      </td>

                      {/* Capacities */}
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4">
                        {v.assignedRouteNo ? (
                          <div className="space-y-0.5">
                            <div
                              onClick={(e) => {
                                if (onSelectRoute) {
                                  e.stopPropagation();
                                  onSelectRoute(v.assignedRouteNo!);
                                }
                              }}
                              className="font-bold text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer"
                            >
                              <RouteIcon className="w-3 h-3" />
                              <span>{v.assignedRouteNo}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[160px]" title={v.assignedRouteName}>
                              {v.assignedRouteName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Standby / Unassigned</span>
                        )}
                      </td>

                      {/* Assigned Driver */}
                      <td className="py-3 px-4">
                        {v.driverName ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-200 flex items-center space-x-1">
                              <User className="w-3.5 h-3.5 text-amber-400" />
                              <span>{v.driverName}</span>
                            </div>
                            {v.driverPhone && (
                              <a
                                href={`tel:${v.driverPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-amber-400 hover:underline font-mono text-[11px] flex items-center space-x-1"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{v.driverPhone}</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            isAssigned
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {v.status || (isAssigned ? 'In Service' : 'Spare')}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {onEditVehicle && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditVehicle(v);
                              }}
                              title="Edit Vehicle"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteVehicle && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteVehicle(v);
                              }}
                              title="Delete / Decommission Vehicle"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="flex items-center text-slate-400 group-hover:text-amber-400 transition pl-1">
                            <span className="text-[11px] mr-1 hidden sm:inline">Specs</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Export Configuration Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
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
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Export Scope Selector */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  {t.vehicles.exportScope}
                </label>
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
                      {selectedFieldKeys.length} / {ALL_VEHICLE_EXPORT_FIELDS.length} {t.vehicles.fieldsSelected}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllFields}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition"
                    >
                      {t.vehicles.selectAll}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFields}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 font-medium transition"
                    >
                      {t.vehicles.deselectAll}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAllFields}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-medium transition"
                    >
                      {t.vehicles.resetDefaults}
                    </button>
                  </div>
                </div>

                {/* Quick field search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={t.vehicles.searchFieldsPlaceholder}
                    value={exportFieldSearch}
                    onChange={(e) => setExportFieldSearch(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Categorized Field Checkboxes */}
                <div className="space-y-4 max-h-[42vh] overflow-y-auto pr-1">
                  {(['identification', 'specifications', 'operations', 'assignment', 'system'] as const).map(
                    (categoryKey) => {
                      const categoryFields = ALL_VEHICLE_EXPORT_FIELDS.filter((f) => {
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
                              {categoryFields.filter((f) => selectedFieldKeys.includes(f.key)).length} /{' '}
                              {categoryFields.length}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {categoryFields.map((field) => {
                              const isChecked = selectedFieldKeys.includes(field.key);
                              const isGridCol = GRID_DISPLAYED_FIELD_KEYS.has(field.key);
                              const label = isFrench ? field.labelFr : field.labelEn;

                              return (
                                <div
                                  key={field.key}
                                  onClick={() => handleToggleField(field.key)}
                                  className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition select-none ${
                                    isChecked
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                                    <div className="shrink-0 text-emerald-400">
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
                                </div>
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
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
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
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition border border-slate-700 disabled:opacity-50"
                >
                  {t.vehicles.cancel}
                </button>

                <button
                  type="button"
                  disabled={isExporting || selectedFieldKeys.length === 0}
                  onClick={handleExportExcelSubmit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg flex items-center space-x-2 disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.vehicles.exporting}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>{t.vehicles.downloadExcel}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

