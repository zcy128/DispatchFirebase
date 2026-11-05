import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Employee, UserRole } from '../types/employee';
import {
  USER_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  normalizeRole,
  isRoleDefaultCustomized,
  subscribeToRolePermissionChanges
} from '../utils/permissions';
import { ROLE_THEMES } from '../components/roles/roleThemes';
import { StaffRoleCard, StaffRoleRow } from '../components/roles/StaffRoleListItems';
import {
  ShieldCheck,
  Users,
  Search,
  RefreshCw,
  Sliders,
  Truck,
  Radio,
  LayoutGrid,
  List
} from 'lucide-react';

const RolePermissionsModal = React.lazy(() =>
  import('../components/roles/RolePermissionsModal').then((module) => ({
    default: module.RolePermissionsModal,
  }))
);

interface RoleManagementViewProps {
  employees: Employee[];
  loading?: boolean;
  onSelectEmployee?: (emp: Employee) => void;
  onEditEmployee: (emp: Employee, initialTab?: 'profile' | 'permissions' | 'contact' | 'license' | 'emergency') => void;
  onQuickReassignRole?: (employeeId: string, newRole: UserRole) => Promise<void>;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const RoleManagementView: React.FC<RoleManagementViewProps> = ({
  employees,
  loading = false,
  onSelectEmployee,
  onEditEmployee,
  onQuickReassignRole,
  onRefresh,
  refreshing = false
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYard, setSelectedYard] = useState('ALL');
  const [overrideFilter, setOverrideFilter] = useState<'ALL' | 'OVERRIDES' | 'STANDARD'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [permissionsModalRole, setPermissionsModalRole] = useState<UserRole>('dispatcher');
  const [permissionTick, setPermissionTick] = useState(0);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    return subscribeToRolePermissionChanges(() => {
      setPermissionTick((tick) => tick + 1);
    });
  }, []);

  const customizedRoles = useMemo(() => {
    const customized = new Set<UserRole>();
    for (const role of USER_ROLES) {
      if (isRoleDefaultCustomized(role)) customized.add(role);
    }
    return customized;
  }, [permissionTick]);

  const rosterStats = useMemo(() => {
    const counts: Record<UserRole, number> = {
      admin: 0,
      manager: 0,
      dispatcher: 0,
      supervisor: 0,
      'office staff': 0,
      studentcare: 0,
      fleet: 0,
      HR: 0,
      payroll: 0,
      training: 0,
      driver: 0,
      helper: 0
    };
    const yardSet = new Set<string>();
    let overrides = 0;

    for (const emp of employees) {
      const role = normalizeRole(emp.role);
      counts[role] = (counts[role] || 0) + 1;
      if (emp.yardId) yardSet.add(emp.yardId);
      if (emp.pagePermissions && Object.keys(emp.pagePermissions).length > 0) {
        overrides += 1;
      }
    }

    return {
      counts,
      yards: Array.from(yardSet).sort(),
      overrides,
    };
  }, [employees]);

  const roleCounts = rosterStats.counts;
  const yards = rosterStats.yards;
  const totalWithOverrides = rosterStats.overrides;
  const totalEmployees = employees.length;
  const totalDriversAndHelpers = (roleCounts.driver || 0) + (roleCounts.helper || 0);
  const totalOperations = (roleCounts.admin || 0) + (roleCounts.dispatcher || 0) + (roleCounts.fleet || 0) + (roleCounts.supervisor || 0) + (roleCounts.manager || 0);

  const filteredEmployees = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    return employees.filter((emp) => {
      const empRole = normalizeRole(emp.role);
      if (selectedRole !== 'ALL' && empRole !== selectedRole) return false;
      if (selectedYard !== 'ALL' && emp.yardId !== selectedYard) return false;

      const hasOverrides = Boolean(emp.pagePermissions && Object.keys(emp.pagePermissions).length > 0);
      if (overrideFilter === 'OVERRIDES' && !hasOverrides) return false;
      if (overrideFilter === 'STANDARD' && hasOverrides) return false;

      if (term) {
        const matchName = (emp.fullName || `${emp.firstName} ${emp.lastName}`).toLowerCase().includes(term);
        const matchNum = (emp.employeeNumber || '').toLowerCase().includes(term);
        const matchUser = (emp.username || '').toLowerCase().includes(term);
        const matchPos = (emp.jobPosition || '').toLowerCase().includes(term);
        const matchEmail = (emp.workEmail || '').toLowerCase().includes(term);
        if (!matchName && !matchNum && !matchUser && !matchPos && !matchEmail) return false;
      }
      return true;
    });
  }, [employees, selectedRole, selectedYard, overrideFilter, deferredSearchTerm]);

  const handleRoleChange = useCallback(async (emp: Employee, newRole: UserRole) => {
    if (!onQuickReassignRole) {
      onEditEmployee(emp, 'profile');
      return;
    }
    try {
      setReassigningId(emp.id);
      await onQuickReassignRole(emp.id, newRole);
    } catch (err) {
      console.error('Failed to reassign role:', err);
    } finally {
      setReassigningId(null);
    }
  }, [onEditEmployee, onQuickReassignRole]);

  const handleSelectEmployee = useCallback((emp: Employee) => {
    onSelectEmployee?.(emp);
  }, [onSelectEmployee]);

  const handleEditPermissions = useCallback((emp: Employee) => {
    onEditEmployee(emp, 'permissions');
  }, [onEditEmployee]);

  const handleEditProfile = useCallback((emp: Employee) => {
    onEditEmployee(emp, 'profile');
  }, [onEditEmployee]);

  const closePermissionsModal = useCallback(() => setIsPermissionsModalOpen(false), []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-slate-100">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Roles & Staff Allocations
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Manage system role-based access control (RBAC), view staff per role, and configure granular page permissions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end md:self-auto">
          {loading && (
            <span className="text-xs text-slate-400 flex items-center space-x-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Loading staff...</span>
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing || loading}
              className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
              title="Refresh staff data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>{refreshing || loading ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{totalEmployees}</div>
            <div className="text-[11px] text-slate-400">Total Personnel</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-400">{totalDriversAndHelpers}</div>
            <div className="text-[11px] text-slate-400">Drivers & Helpers</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-400">{totalOperations}</div>
            <div className="text-[11px] text-slate-400">Ops & Dispatch Hub</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-purple-400">{totalWithOverrides}</div>
            <div className="text-[11px] text-slate-400">Custom Page Overrides</div>
          </div>
        </div>
      </div>

      {/* Role Navigation Carousel / Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            System Roles (Custom Claims)
          </span>
          <button
            onClick={() => setSelectedRole('ALL')}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md transition ${
              selectedRole === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Roles ({totalEmployees})
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {USER_ROLES.map((r) => {
            const theme = ROLE_THEMES[r];
            const count = roleCounts[r] || 0;
            const isSelected = selectedRole === r;
            const Icon = theme.icon;

            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`p-3 rounded-xl border text-left transition-all duration-150 relative overflow-hidden group ${
                  isSelected
                    ? `${theme.bgColor} ${theme.borderColor} ring-2 ring-amber-500/50 shadow-lg`
                    : 'bg-slate-900/70 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-7 h-7 rounded-lg ${theme.badgeBg} flex items-center justify-center ${theme.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {customizedRoles.has(r) && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Customized default permissions" />
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${theme.badgeBg} ${theme.color}`}>
                      {count}
                    </span>
                  </div>
                </div>

                <div className="font-bold text-xs text-white truncate" title={ROLE_LABELS[r]}>
                  {ROLE_LABELS[r]}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {theme.tag}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Role Focus Banner (When a specific role is active) */}
      {selectedRole !== 'ALL' && (
        <div className={`p-4 md:p-5 rounded-xl border ${ROLE_THEMES[selectedRole].bgColor} ${ROLE_THEMES[selectedRole].borderColor} space-y-3 animate-in fade-in duration-200`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl ${ROLE_THEMES[selectedRole].badgeBg} flex items-center justify-center ${ROLE_THEMES[selectedRole].color}`}>
                {React.createElement(ROLE_THEMES[selectedRole].icon, { className: 'w-5 h-5' })}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-white">
                    {ROLE_LABELS[selectedRole]}
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700">
                    role: &quot;{selectedRole}&quot;
                  </span>
                  {customizedRoles.has(selectedRole) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Customized Defaults
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  {ROLE_DESCRIPTIONS[selectedRole]}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-start md:self-auto flex-shrink-0">
              <span className="text-xs text-slate-400">
                Staff count: <strong className="text-white font-bold">{roleCounts[selectedRole] || 0}</strong>
              </span>

              <button
                type="button"
                onClick={() => {
                  setPermissionsModalRole(selectedRole);
                  setIsPermissionsModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-500/20"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Edit Default Access</span>
              </button>
            </div>
          </div>

          {/* Quick Default Capability Pills */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Default Access:
            </span>
            {selectedRole === 'admin' && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Full Read/Write Access on all 22 System Pages
              </span>
            )}
            {selectedRole === 'dispatcher' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Dispatch & Routes: Read/Write
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Students & Schools: Read/Write
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Staff & Time Off: Read-Only
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Payroll: No Access
                </span>
              </>
            )}
            {selectedRole === 'driver' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Driver App Forms: Active
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Vehicle Handover: Read-Only
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700/50 text-slate-400 border border-slate-600/30">
                  Web Management: Restricted
                </span>
              </>
            )}
            {selectedRole === 'helper' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-lime-500/10 text-lime-400 border border-lime-500/20">
                  Driver App: Incidents, Hazards, Time Off, Expenses
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700/50 text-slate-400 border border-slate-600/30">
                  Vehicle Inspections: Hidden
                </span>
              </>
            )}
            {selectedRole === 'fleet' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Vehicles, Defects & Handover: Read/Write
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Dispatch & Routes: Read-Only
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Payroll: No Access
                </span>
              </>
            )}
            {selectedRole === 'supervisor' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Assigned Yard Dispatch, Routes & Vehicles: Read-Only
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Payroll: No Access
                </span>
              </>
            )}
            {selectedRole === 'HR' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Employees, Time-Off & Expenses: Read/Write
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Operations: Read-Only
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Payroll: No Access
                </span>
              </>
            )}
            {selectedRole === 'payroll' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Payroll & Compensation: Read/Write
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Other Pages: Read-Only
                </span>
              </>
            )}
            {selectedRole === 'training' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Training & Courses: Read/Write
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Other Pages: Read-Only
                </span>
              </>
            )}
            {selectedRole === 'manager' && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                All Operational, Asset & Financial Pages: Read-Only
              </span>
            )}
            {selectedRole === 'office staff' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Operations & Master Data: Read-Only
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Payroll: No Access
                </span>
              </>
            )}
            {selectedRole === 'studentcare' && (
              <>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Students & Incidents: Read/Write
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  HR & Payroll: No Access
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Staff Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff by name, employee ID, username, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs md:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Yard Selector */}
            <select
              value={selectedYard}
              onChange={(e) => setSelectedYard(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Yards</option>
              {yards.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Overrides Filter */}
            <select
              value={overrideFilter}
              onChange={(e) => setOverrideFilter(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Permissions</option>
              <option value="OVERRIDES">Custom Overrides Only</option>
              <option value="STANDARD">Standard Roles Only</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status / Count indicator */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <div>
            Showing <strong className="text-white font-bold">{filteredEmployees.length}</strong> staff member{filteredEmployees.length === 1 ? '' : 's'}
            {selectedRole !== 'ALL' && (
              <span> under <strong className="text-amber-400 font-bold">{ROLE_LABELS[selectedRole]}</strong></span>
            )}
          </div>

          {(searchTerm || selectedYard !== 'ALL' || overrideFilter !== 'ALL' || selectedRole !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedYard('ALL');
                setOverrideFilter('ALL');
                setSelectedRole('ALL');
              }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Staff Presentation Area */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No Staff Members Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No employees match the active filters{selectedRole !== 'ALL' ? ` for role "${ROLE_LABELS[selectedRole]}"` : ''}. Try adjusting search criteria or clearing filters.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <StaffRoleCard
              key={emp.id}
              employee={emp}
              isReassigning={reassigningId === emp.id}
              onSelect={handleSelectEmployee}
              onEditPermissions={handleEditPermissions}
              onEditProfile={handleEditProfile}
              onRoleChange={handleRoleChange}
            />
          ))}
        </div>
      ) : (
        /* TABLE / LIST VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-700/80">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role & Custom Claims</th>
                  <th className="py-3 px-4">Assigned Yard</th>
                  <th className="py-3 px-4">Job Position</th>
                  <th className="py-3 px-4">Page Permissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEmployees.map((emp) => (
                  <StaffRoleRow
                    key={emp.id}
                    employee={emp}
                    isReassigning={reassigningId === emp.id}
                    onSelect={handleSelectEmployee}
                    onEditPermissions={handleEditPermissions}
                    onEditProfile={handleEditProfile}
                    onRoleChange={handleRoleChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isPermissionsModalOpen && (
        <React.Suspense fallback={null}>
          <RolePermissionsModal
            isOpen
            onClose={closePermissionsModal}
            role={permissionsModalRole}
          />
        </React.Suspense>
      )}
    </div>
  );
};
