import React, { useState } from 'react';
import { Employee } from '../types/employee';
import {
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  AlertTriangle,
  Building2,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  ChevronRight
} from 'lucide-react';

interface EmployeeListViewProps {
  employees: Employee[];
  loading: boolean;
  onSelectEmployee: (emp: Employee) => void;
  onEditEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onOpenCreate: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const EmployeeListView: React.FC<EmployeeListViewProps> = ({
  employees,
  loading,
  onSelectEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onOpenCreate,
  onRefresh,
  refreshing
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYard, setSelectedYard] = useState('ALL');
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [activeOnly, setActiveOnly] = useState(false);
  const [filterLicenseDue, setFilterLicenseDue] = useState(false);

  // Filtered employees
  const filtered = employees.filter((emp) => {
    if (activeOnly && !emp.isActive) return false;
    if (selectedYard !== 'ALL' && emp.yardId !== selectedYard) return false;
    if (selectedPosition !== 'ALL' && emp.jobPosition !== selectedPosition) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = emp.fullName.toLowerCase().includes(term);
      const matchNum = emp.employeeNumber.toLowerCase().includes(term);
      const matchPos = emp.jobPosition.toLowerCase().includes(term);
      const matchPhone =
        (emp.mobilePhone && emp.mobilePhone.includes(term)) ||
        (emp.workPhonePhone && emp.workPhonePhone.includes(term));
      if (!matchName && !matchNum && !matchPos && !matchPhone) return false;
    }

    if (filterLicenseDue) {
      if (!emp.driverLicense?.expirationDate) return false;
      const diff =
        (new Date(emp.driverLicense.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (diff > 30 || diff < 0) return false;
    }

    return true;
  });

  const uniquePositions = Array.from(new Set(employees.map((e) => e.jobPosition).filter(Boolean)));

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Controls: Search & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, employee number (EMP-...), phone, position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition placeholder:text-slate-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh employee roster from cloud"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh Roster</span>
              </button>
            )}

            <button
              onClick={onOpenCreate}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-amber-500/20 flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 flex items-center space-x-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>

          {/* Yard Select */}
          <select
            value={selectedYard}
            onChange={(e) => setSelectedYard(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Yards</option>
            <option value="HQ-Central">HQ-Central</option>
            <option value="Yard-East">Yard-East</option>
            <option value="Yard-West">Yard-West</option>
          </select>

          {/* Position Select */}
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 max-w-[160px] truncate"
          >
            <option value="ALL">All Job Titles</option>
            {uniquePositions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>

          {/* License Due toggle */}
          <button
            onClick={() => setFilterLicenseDue(!filterLicenseDue)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition flex items-center space-x-1 ${
              filterLicenseDue
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>CDL Expiring Soon (&le;30d)</span>
          </button>

          {/* Active Only Toggle */}
          <button
            onClick={() => setActiveOnly(!activeOnly)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
              activeOnly
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            Active Only
          </button>

          <span className="text-slate-500 ml-auto font-mono text-[11px]">
            Showing {filtered.length} of {employees.length} records
          </span>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading master employee database...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm space-y-2">
            <p className="font-semibold text-slate-300">No employees match the specified filters</p>
            <p className="text-xs text-slate-500">Try clearing your search keyword or yard filter.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role & Yard</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">CDL Compliance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((emp) => {
                    const daysToExpiration = emp.driverLicense?.expirationDate
                      ? Math.ceil(
                          (new Date(emp.driverLicense.expirationDate).getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : null;

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => onSelectEmployee(emp)}
                        className="hover:bg-slate-800/40 transition cursor-pointer group"
                      >
                        {/* Name & ID */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            {emp.employeePhoto?.photoUrl ? (
                              <img
                                src={emp.employeePhoto.photoUrl}
                                alt={emp.fullName}
                                className="w-9 h-9 rounded-lg object-cover border border-slate-700"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-xs">
                                {emp.firstName[0]}
                                {emp.lastName[0]}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-white group-hover:text-amber-400 transition">
                                {emp.fullName}
                              </div>
                              <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                                <span className="text-slate-400">{emp.employeeNumber}</span>
                                {emp.username && (
                                  <span className="text-amber-400/90 font-medium bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 text-[10px]">
                                    @{emp.username}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Job & Yard */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-200 font-medium">{emp.jobPosition}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                              {emp.role || 'driver'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                            <div className="flex items-center space-x-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span>{emp.yardId || 'HQ-Central'}</span>
                            </div>
                            {emp.pagePermissions && Object.keys(emp.pagePermissions).length > 0 && (
                              <span className="text-[10px] text-amber-400 font-mono">
                                • {Object.keys(emp.pagePermissions).length} custom perms
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Contact Info */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {emp.preferredPhone ? (
                              <a
                                href={`tel:${emp.preferredPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center space-x-1.5 text-emerald-400 hover:underline font-mono"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{emp.preferredPhone}</span>
                              </a>
                            ) : (
                              <span className="text-slate-500 text-[11px]">No phone</span>
                            )}

                            {emp.preferredEmail ? (
                              <a
                                href={`mailto:${emp.preferredEmail}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center space-x-1.5 text-slate-400 hover:text-amber-400 transition"
                              >
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[150px]">{emp.preferredEmail}</span>
                              </a>
                            ) : null}
                          </div>
                        </td>

                        {/* CDL Status */}
                        <td className="py-3 px-4">
                          {emp.driverLicense ? (
                            <div>
                              <span className="text-slate-300 font-medium block">
                                {emp.driverLicense.licenseClass}
                              </span>
                              {daysToExpiration !== null && (
                                <span
                                  className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                                    daysToExpiration <= 0
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : daysToExpiration <= 30
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-emerald-500/10 text-emerald-400'
                                  }`}
                                >
                                  {daysToExpiration <= 0
                                    ? 'EXPIRED'
                                    : daysToExpiration <= 30
                                    ? `Expires in ${daysToExpiration}d`
                                    : `Valid until ${new Date(
                                        emp.driverLicense.expirationDate
                                      ).toLocaleDateString()}`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Non-driver staff</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              emp.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {emp.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Row Actions */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end space-x-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => onSelectEmployee(emp)}
                              title="View details"
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onEditEmployee(emp)}
                              title="Edit"
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteEmployee(emp.id)}
                              title="Delete"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards Stream */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {filtered.map((emp) => {
                const daysToExpiration = emp.driverLicense?.expirationDate
                  ? Math.ceil(
                      (new Date(emp.driverLicense.expirationDate).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : null;

                return (
                  <div
                    key={emp.id}
                    onClick={() => onSelectEmployee(emp)}
                    className="p-4 hover:bg-slate-800/40 active:bg-slate-800/70 transition cursor-pointer space-y-3"
                  >
                    {/* Top Header: Photo + Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        {emp.employeePhoto?.photoUrl ? (
                          <img
                            src={emp.employeePhoto.photoUrl}
                            alt={emp.fullName}
                            className="w-11 h-11 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-sm flex-shrink-0">
                            {emp.firstName[0]}
                            {emp.lastName[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white text-sm flex items-center space-x-1.5">
                            <span>{emp.fullName}</span>
                            {emp.username && (
                              <span className="text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-[10px] font-mono">
                                @{emp.username}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                            <span>{emp.jobPosition}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{emp.employeeNumber}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                          emp.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Location & CDL Pill */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center space-x-1 text-slate-400 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        <span>{emp.yardId || 'HQ-Central'}</span>
                      </div>

                      {emp.driverLicense && (
                        <div
                          className={`inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-1 rounded-lg border ${
                            daysToExpiration !== null && daysToExpiration <= 0
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : daysToExpiration !== null && daysToExpiration <= 30
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                          }`}
                        >
                          <span className="font-bold">{emp.driverLicense.licenseClass}</span>
                          {daysToExpiration !== null && (
                            <span>
                              •{' '}
                              {daysToExpiration <= 0
                                ? 'EXPIRED'
                                : daysToExpiration <= 30
                                ? `Exp in ${daysToExpiration}d`
                                : `Exp ${new Date(emp.driverLicense.expirationDate).toLocaleDateString()}`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Row: Direct Phone Call, Email & Details */}
                    <div
                      className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center space-x-2">
                        {emp.preferredPhone ? (
                          <a
                            href={`tel:${emp.preferredPhone}`}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg font-mono font-medium transition active:scale-95"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call {emp.preferredPhone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 text-xs italic">No phone on file</span>
                        )}
                        {emp.preferredEmail && (
                          <a
                            href={`mailto:${emp.preferredEmail}`}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition"
                            title={emp.preferredEmail}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEditEmployee(emp)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectEmployee(emp)}
                          className="flex items-center space-x-1 text-slate-400 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition text-xs font-semibold"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
