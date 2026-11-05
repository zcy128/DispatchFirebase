import { memo } from 'react';
import { Building2, Edit, Mail, Phone, Sliders } from 'lucide-react';
import { Employee, UserRole } from '../../types/employee';
import { ROLE_LABELS, USER_ROLES, normalizeRole } from '../../utils/permissions';
import { ROLE_THEMES } from './roleThemes';

interface StaffRoleItemProps {
  employee: Employee;
  isReassigning: boolean;
  onSelect: (employee: Employee) => void;
  onEditPermissions: (employee: Employee) => void;
  onEditProfile: (employee: Employee) => void;
  onRoleChange: (employee: Employee, role: UserRole) => void;
}

const roleOptions = USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export const StaffRoleCard = memo(function StaffRoleCard({
  employee: emp,
  isReassigning,
  onSelect,
  onEditPermissions,
  onEditProfile,
  onRoleChange,
}: StaffRoleItemProps) {
  const role = normalizeRole(emp.role);
  const theme = ROLE_THEMES[role];
  const RoleIcon = theme.icon;
  const overrideCount = emp.pagePermissions ? Object.keys(emp.pagePermissions).length : 0;

  return (
    <div
      className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all duration-150 space-y-4 hover:shadow-lg"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '220px' }}
    >
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
              onClick={() => onSelect(emp)}
              className="text-left font-bold text-sm text-white hover:text-amber-400 transition"
            >
              {emp.fullName || `${emp.firstName} ${emp.lastName}`}
            </button>
            <div className="text-[11px] text-slate-400 font-mono">
              #{emp.employeeNumber || emp.id}
              {emp.username && (
                <span className="text-slate-500 ml-1.5 font-sans">@{emp.username}</span>
              )}
            </div>
            <div className="text-[11px] text-slate-300 font-medium mt-0.5 truncate max-w-[200px]">
              {emp.jobPosition}
            </div>
          </div>
        </div>

        <div
          className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center space-x-1 border ${theme.badgeBg} ${theme.color} ${theme.borderColor}`}
        >
          <RoleIcon className="w-3 h-3" />
          <span className="truncate max-w-[90px]">{ROLE_LABELS[role]}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center space-x-1">
            <Building2 className="w-3 h-3 text-slate-500" />
            <span>{emp.yardId || 'HQ-Central'}</span>
          </span>

          {overrideCount > 0 ? (
            <button
              type="button"
              onClick={() => onEditPermissions(emp)}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition flex items-center space-x-1"
            >
              <Sliders className="w-2.5 h-2.5" />
              <span>{overrideCount} Page Overrides</span>
            </button>
          ) : (
            <span className="text-[10px] text-slate-500 font-medium">Standard Role Permissions</span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-1">
          {(emp.mobilePhone || emp.workPhonePhone) && (
            <span
              className="flex items-center space-x-1 truncate"
              title={emp.mobilePhone || emp.workPhonePhone}
            >
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

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
        <div className="flex-1">
          <select
            value={role}
            disabled={isReassigning}
            onChange={(e) => onRoleChange(emp, e.target.value as UserRole)}
            className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-200 focus:outline-none focus:border-amber-500 transition"
            title="Quick reassign role"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Role: {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => onEditPermissions(emp)}
            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition"
            title="Configure page authorizations"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onEditProfile(emp)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Edit employee record"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

export const StaffRoleRow = memo(function StaffRoleRow({
  employee: emp,
  isReassigning,
  onSelect,
  onEditPermissions,
  onEditProfile,
  onRoleChange,
}: StaffRoleItemProps) {
  const role = normalizeRole(emp.role);
  const theme = ROLE_THEMES[role];
  const RoleIcon = theme.icon;
  const overrideCount = emp.pagePermissions ? Object.keys(emp.pagePermissions).length : 0;

  return (
    <tr
      className="hover:bg-slate-800/40 transition"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' }}
    >
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs">
            {emp.firstName ? emp.firstName[0].toUpperCase() : 'E'}
            {emp.lastName ? emp.lastName[0].toUpperCase() : ''}
          </div>
          <div>
            <button
              type="button"
              onClick={() => onSelect(emp)}
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

      <td className="py-3 px-4">
        <div className="flex items-center space-x-2">
          <div className={`p-1 rounded ${theme.badgeBg}`}>
            <RoleIcon className={`w-3.5 h-3.5 ${theme.color}`} />
          </div>
          <select
            value={role}
            disabled={isReassigning}
            onChange={(e) => onRoleChange(emp, e.target.value as UserRole)}
            className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </td>

      <td className="py-3 px-4 text-slate-300">{emp.yardId || 'HQ-Central'}</td>
      <td className="py-3 px-4 text-slate-300">{emp.jobPosition}</td>
      <td className="py-3 px-4">
        {overrideCount > 0 ? (
          <button
            type="button"
            onClick={() => onEditPermissions(emp)}
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition flex items-center space-x-1"
          >
            <Sliders className="w-2.5 h-2.5" />
            <span>{overrideCount} Custom Overrides</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-500">Default ({ROLE_LABELS[role]})</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => onEditPermissions(emp)}
            className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/20 transition flex items-center space-x-1"
            title="Configure page authorizations"
          >
            <Sliders className="w-3 h-3" />
            <span>Access</span>
          </button>
          <button
            type="button"
            onClick={() => onEditProfile(emp)}
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
});
