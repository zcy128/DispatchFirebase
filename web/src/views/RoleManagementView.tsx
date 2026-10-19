import React, { useState, useEffect, useMemo } from 'react';
import { Employee, UserRole } from '../types/employee';
import {
  USER_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  normalizeRole,
  isRoleDefaultCustomized,
  subscribeToRolePermissionChanges
} from '../utils/permissions';
import { RolePermissionsModal } from '../components/roles/RolePermissionsModal';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Search,
  RefreshCw,
  Building2,
  Mail,
  Phone,
  Edit,
  Sliders,
  Truck,
  Wrench,
  DollarSign,
  Award,
  GraduationCap,
  Briefcase,
  Radio,
  Eye,
  LayoutGrid,
  List
} from 'lucide-react';

interface RoleManagementViewProps {
  employees: Employee[];
  loading?: boolean;
  onSelectEmployee?: (emp: Employee) => void;
  onEditEmployee: (emp: Employee, initialTab?: 'profile' | 'permissions' | 'contact' | 'license' | 'emergency') => void;
  onQuickReassignRole?: (employeeId: string, newRole: UserRole) => Promise<void>;
  onRefresh?: () => void;
  refreshing?: boolean;
}

// Visual themes for roles
const ROLE_THEMES: Record<UserRole, {
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}> = {
  admin: {
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    icon: ShieldAlert,
    tag: 'Full Administrator'
  },
  manager: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    icon: Briefcase,
    tag: 'Executive Read-Only'
  },
  dispatcher: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    icon: Radio,
    tag: 'Operations & Routes'
  },
  supervisor: {
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    icon: Eye,
    tag: 'Yard Supervision'
  },
  'office staff': {
    color: 'text-slate-300',
    bgColor: 'bg-slate-700/30',
    borderColor: 'border-slate-600/40',
    badgeBg: 'bg-slate-700/50',
    badgeText: 'text-slate-200',
    icon: Building2,
    tag: 'Office Support'
  },
  studentcare: {
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    badgeBg: 'bg-violet-500/20',
    badgeText: 'text-violet-300',
    icon: GraduationCap,
    tag: 'Student Safety'
  },
  fleet: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    icon: Wrench,
    tag: 'Maintenance & Assets'
  },
  HR: {
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    badgeBg: 'bg-pink-500/20',
    badgeText: 'text-pink-300',
    icon: Users,
    tag: 'Human Resources'
  },
  payroll: {
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    icon: DollarSign,
    tag: 'Compensation & Payroll'
  },
  training: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    icon: Award,
    tag: 'Safety & Recertification'
  },
  driver: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    icon: Truck,
    tag: 'Driver Mobile App'
  },
  helper: {
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/10',
    borderColor: 'border-lime-500/30',
    badgeBg: 'bg-lime-500/20',
    badgeText: 'text-lime-300',
    icon: Users,
    tag: 'Bus Attendant / Helper'
  }
};

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
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeToRolePermissionChanges(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Group employees by normalized role
  const roleCounts = useMemo(() => {
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

    employees.forEach((emp) => {
      const r = normalizeRole(emp.role);
      counts[r] = (counts[r] || 0) + 1;
    });

    return counts;
  }, [employees]);

  // Overall Stats
  const totalEmployees = employees.length;
  const totalDriversAndHelpers = (roleCounts.driver || 0) + (roleCounts.helper || 0);
  const totalOperations = (roleCounts.admin || 0) + (roleCounts.dispatcher || 0) + (roleCounts.fleet || 0) + (roleCounts.supervisor || 0) + (roleCounts.manager || 0);
  const totalWithOverrides = useMemo(() => {
    return employees.filter((e) => e.pagePermissions && Object.keys(e.pagePermissions).length > 0).length;
  }, [employees]);

  // Unique Yards for dropdown
  const yards = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.yardId) set.add(e.yardId);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered staff list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const empRole = normalizeRole(emp.role);

      // Role filter
      if (selectedRole !== 'ALL' && empRole !== selectedRole) {
        return false;
      }

      // Yard filter
      if (selectedYard !== 'ALL' && emp.yardId !== selectedYard) {
        return false;
      }

      // Override filter
      const hasOverrides = emp.pagePermissions && Object.keys(emp.pagePermissions).length > 0;
      if (overrideFilter === 'OVERRIDES' && !hasOverrides) return false;
      if (overrideFilter === 'STANDARD' && hasOverrides) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = (emp.fullName || `${emp.firstName} ${emp.lastName}`).toLowerCase().includes(term);
        const matchNum = (emp.employeeNumber || '').toLowerCase().includes(term);
        const matchUser = (emp.username || '').toLowerCase().includes(term);
        const matchPos = (emp.jobPosition || '').toLowerCase().includes(term);
        const matchEmail = (emp.workEmail || '').toLowerCase().includes(term);
        if (!matchName && !matchNum && !matchUser && !matchPos && !matchEmail) {
          return false;
        }
      }

      return true;
    });
  }, [employees, selectedRole, selectedYard, overrideFilter, searchTerm]);

  const handleRoleChange = async (emp: Employee, newRole: UserRole) => {
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
  };

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
                    {isRoleDefaultCustomized(r) && (
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
                  {isRoleDefaultCustomized(selectedRole) && (
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
          {filteredEmployees.map((emp) => {
            const role = normalizeRole(emp.role);
            const theme = ROLE_THEMES[role];
            const RoleIcon = theme.icon;
            const overrideCount = emp.pagePermissions ? Object.keys(emp.pagePermissions).length : 0;
            const isReassigning = reassigningId === emp.id;

            return (
              <div
                key={emp.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all duration-150 space-y-4 hover:shadow-lg"
              >
                {/* Employee Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-sm">
                        {emp.firstName ? emp.firstName[0].toUpperCase() : 'E'}
                        {emp.lastName ? emp.lastName[0].toUpperCase() : ''}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          emp.isActive ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}
                        title={emp.isActive ? 'Active Staff' : 'Inactive'}
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectEmployee && onSelectEmployee(emp)}
                        className="text-left font-bold text-sm text-white hover:text-amber-400 transition"
                      >
                        {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                      </button>
                      <div className="text-[11px] text-slate-400 font-mono">
                        #{emp.employeeNumber || emp.id}
                        {emp.username && (
                          <span className="text-slate-500 ml-1.5 font-sans">
                            @{emp.username}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium mt-0.5 truncate max-w-[200px]">
                        {emp.jobPosition}
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center space-x-1 border ${theme.badgeBg} ${theme.color} ${theme.borderColor}`}>
                    <RoleIcon className="w-3 h-3" />
                    <span className="truncate max-w-[90px]">{ROLE_LABELS[role]}</span>
                  </div>
                </div>

                {/* Yard and Permissions Summary */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      <span>{emp.yardId || 'HQ-Central'}</span>
                    </span>

                    {overrideCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => onEditEmployee(emp, 'permissions')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition flex items-center space-x-1"
                      >
                        <Sliders className="w-2.5 h-2.5" />
                        <span>{overrideCount} Page Overrides</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Standard Role Permissions
                      </span>
                    )}
                  </div>

                  {/* Contact Snippets */}
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-1">
                    {(emp.mobilePhone || emp.workPhonePhone) && (
                      <span className="flex items-center space-x-1 truncate" title={emp.mobilePhone || emp.workPhonePhone}>
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{emp.mobilePhone || emp.workPhonePhone}</span>
                      </span>
                    )}
                    {emp.workEmail && (
                      <span className="flex items-center space-x-1 truncate max-w-[150px]" title={emp.workEmail}>
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{emp.workEmail}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  {/* Quick Role Reassignment Selector */}
                  <div className="flex-1">
                    <select
                      value={role}
                      disabled={isReassigning}
                      onChange={(e) => handleRoleChange(emp, e.target.value as UserRole)}
                      className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-200 focus:outline-none focus:border-amber-500 transition"
                      title="Quick reassign role"
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          Role: {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => onEditEmployee(emp, 'permissions')}
                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition"
                      title="Configure page authorizations"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditEmployee(emp, 'profile')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      title="Edit employee record"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
                {filteredEmployees.map((emp) => {
                  const role = normalizeRole(emp.role);
                  const theme = ROLE_THEMES[role];
                  const RoleIcon = theme.icon;
                  const overrideCount = emp.pagePermissions ? Object.keys(emp.pagePermissions).length : 0;
                  const isReassigning = reassigningId === emp.id;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs">
                            {emp.firstName ? emp.firstName[0].toUpperCase() : 'E'}
                            {emp.lastName ? emp.lastName[0].toUpperCase() : ''}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => onSelectEmployee && onSelectEmployee(emp)}
                              className="font-bold text-white hover:text-amber-400 transition"
                            >
                              {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                            </button>
                            <div className="text-[10px] text-slate-500 font-mono">
                              #{emp.employeeNumber || emp.id}
                              {emp.username && <span> &bull; @{emp.username}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Dropdown / Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1 rounded ${theme.badgeBg}`}>
                            <RoleIcon className={`w-3.5 h-3.5 ${theme.color}`} />
                          </div>
                          <select
                            value={role}
                            disabled={isReassigning}
                            onChange={(e) => handleRoleChange(emp, e.target.value as UserRole)}
                            className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500"
                          >
                            {USER_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Yard */}
                      <td className="py-3 px-4 text-slate-300">
                        {emp.yardId || 'HQ-Central'}
                      </td>

                      {/* Position */}
                      <td className="py-3 px-4 text-slate-300">
                        {emp.jobPosition}
                      </td>

                      {/* Permissions */}
                      <td className="py-3 px-4">
                        {overrideCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => onEditEmployee(emp, 'permissions')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition flex items-center space-x-1"
                          >
                            <Sliders className="w-2.5 h-2.5" />
                            <span>{overrideCount} Custom Overrides</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            Default ({ROLE_LABELS[role]})
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => onEditEmployee(emp, 'permissions')}
                            className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/20 transition flex items-center space-x-1"
                            title="Configure page authorizations"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Access</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditEmployee(emp, 'profile')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center space-x-1"
                            title="Edit employee record"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Default Permissions Editor Modal */}
      <RolePermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        role={permissionsModalRole}
      />
    </div>
  );
};
