import React, { useState, useEffect } from 'react';
import { Employee } from '../../types/employee';
import {
  X,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Edit2,
  Trash2,
  CreditCard,
  Building2,
  Users,
  KeyRound,
  Shield,
  Route,
  Truck,
  History
} from 'lucide-react';
import { ROLE_LABELS, normalizeRole } from '../../utils/permissions';
import { AssignmentHistoryService } from '../../services/assignmentHistoryService';
import { AssignmentHistoryRecord } from '../../types/assignmentHistory';

interface EmployeeDetailDrawerProps {
  employee: Employee | null;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
}

export const EmployeeDetailDrawer: React.FC<EmployeeDetailDrawerProps> = ({
  employee,
  onClose,
  onEdit,
  onDelete
}) => {
  const [assignments, setAssignments] = useState<AssignmentHistoryRecord[]>([]);

  useEffect(() => {
    if (!employee) {
      setAssignments([]);
      return;
    }
    const unsub = AssignmentHistoryService.subscribeToHistory((all) => {
      const empId = employee.id;
      const empNum = employee.employeeNumber;
      const filtered = all.filter(
        (r) => r.driverId === empId || (empNum && r.driverId === empNum) || (r.driverNumber && r.driverNumber === empNum)
      );
      setAssignments(filtered);
    });
    return () => unsub();
  }, [employee]);

  if (!employee) return null;

  const parseDateToMs = (val?: any): number | null => {
    if (!val) return null;
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    if (typeof val === 'object' && typeof val.seconds === 'number') {
      return val.seconds * 1000;
    }
    if (val instanceof Date) {
      return val.getTime();
    }
    if (typeof val === 'string') {
      const ms = new Date(val).getTime();
      return isNaN(ms) ? null : ms;
    }
    return null;
  };

  const formatDateDisplay = (val?: any): string => {
    const ms = parseDateToMs(val);
    if (ms === null) return 'N/A';
    return new Date(ms).toLocaleDateString();
  };

  const getDaysUntilExpiration = (dateVal?: any) => {
    const ms = parseDateToMs(dateVal);
    if (ms === null) return null;
    const diff = ms - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysUntilLicenseExp = employee.driverLicense
    ? getDaysUntilExpiration(employee.driverLicense.expirationDate)
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 text-slate-100 h-full overflow-y-auto shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/90 sticky top-0 backdrop-blur z-10">
            <div className="flex items-center space-x-4">
              {employee.employeePhoto?.photoUrl ? (
                <img
                  src={employee.employeePhoto.photoUrl}
                  alt={employee.fullName}
                  className="w-14 h-14 rounded-xl object-cover border border-amber-500/30 shadow-lg shadow-amber-500/10"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-bold text-xl shadow-lg shadow-amber-500/10">
                  {employee.firstName[0]}
                  {employee.lastName[0]}
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">{employee.fullName}</h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      employee.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {employee.isActive ? 'Active Staff' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
                    {employee.employeeNumber}
                  </span>
                  {employee.username && (
                    <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                      @{employee.username}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                    {employee.role || 'driver'}
                  </span>
                  <span>{employee.jobPosition}</span>
                  <span>•</span>
                  <span>{employee.yardId || 'HQ-Central'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Action Bar (Quick dispatch triggers) */}
            <div className="grid grid-cols-2 gap-3">
              {employee.preferredPhone ? (
                <a
                  href={`tel:${employee.preferredPhone}`}
                  className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>Call {employee.preferredPhone}</span>
                </a>
              ) : (
                <div className="py-2.5 px-4 bg-slate-800/40 text-slate-500 text-xs rounded-lg border border-slate-800 text-center">
                  No Phone Registered
                </div>
              )}

              {employee.preferredEmail ? (
                <a
                  href={`mailto:${employee.preferredEmail}`}
                  className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Email Staff</span>
                </a>
              ) : (
                <div className="py-2.5 px-4 bg-slate-800/40 text-slate-500 text-xs rounded-lg border border-slate-800 text-center">
                  No Email Registered
                </div>
              )}
            </div>

            {/* CDL Driver License Section (Critical for School Bus Dispatch) */}
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-semibold text-slate-200 text-sm">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>Driver License (CDL / Class B)</span>
                </div>
                {employee.driverLicense && daysUntilLicenseExp !== null && (
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      daysUntilLicenseExp <= 0
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : daysUntilLicenseExp <= 30
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {daysUntilLicenseExp <= 30 && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {daysUntilLicenseExp <= 0
                      ? 'EXPIRED'
                      : daysUntilLicenseExp <= 30
                      ? `Expires in ${daysUntilLicenseExp} days`
                      : 'Compliant & Valid'}
                  </span>
                )}
              </div>

              {employee.driverLicense ? (
                <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <span className="text-slate-400">License Number:</span>
                    <p className="font-mono font-bold text-slate-200 text-sm mt-0.5">
                      {employee.driverLicense.licenseId}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Class & Endorsement:</span>
                    <p className="font-semibold text-amber-400 text-sm mt-0.5">
                      {employee.driverLicense.licenseClass}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Expiration Date:</span>
                    <p className="font-semibold text-slate-200 mt-0.5">
                      {formatDateDisplay(employee.driverLicense.expirationDate)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Conditions / Restrictions:</span>
                    <p className="text-slate-300 mt-0.5">
                      {employee.driverLicense.licenseCondition || 'None'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No CDL driver license registered for this employee.</p>
              )}
            </div>

            {/* System Login Account Card */}
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>System Login & RBAC Role</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                  {ROLE_LABELS[normalizeRole(employee.role)] || employee.role || 'Driver'}
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Username:</span>
                  <p className="font-mono font-bold text-amber-400 text-sm mt-0.5">
                    {employee.username ? `@${employee.username}` : 'Not assigned'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Auth Login Email:</span>
                  <p className="font-mono text-slate-300 mt-0.5">
                    {employee.username ? `${employee.username}@dispatch.pcy.ca` : (employee.workEmail || 'None')}
                  </p>
                </div>
              </div>

              {/* Custom Page Overrides if any */}
              {employee.pagePermissions && Object.keys(employee.pagePermissions).length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold flex items-center space-x-1">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Custom Page Authorizations:</span>
                    </span>
                    <span className="text-amber-400 font-mono text-[10px]">
                      {Object.keys(employee.pagePermissions).length} overrides
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(employee.pagePermissions).map(([page, perm]) => (
                      <span
                        key={page}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          perm === 'readwrite'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : perm === 'readonly'
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}
                      >
                        {page}: {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Employment & Yard Details */}
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Operational Data</span>
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Assigned Depot / Yard:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{employee.yardId || 'HQ-Central'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Date Hired:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">
                    {formatDateDisplay(employee.dateHired)}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Personal Address:</span>
                  <div className="flex items-center space-x-1.5 text-slate-200 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span>{employee.personalAddress || 'Not recorded'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Lifecycle History (Routes & Vehicles) */}
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <span>Route & Vehicle Assignment History ({assignments.length})</span>
                </h3>
              </div>

              {assignments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No recorded route or vehicle allocation history for this staff member.</p>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {assignments.map((asg) => {
                    const isRoute = asg.type === 'driver_route';
                    const isAssign = asg.action === 'assign';
                    return (
                      <div
                        key={asg.id}
                        className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            {isRoute ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Route className="w-3 h-3" />
                                <span>Route</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Truck className="w-3 h-3" />
                                <span>Vehicle</span>
                              </span>
                            )}

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isAssign
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {isAssign ? 'Assigned' : 'Unassigned / Released'}
                            </span>
                          </div>

                          <div className="font-mono text-[11px] text-slate-400">
                            {asg.effectiveDate}
                          </div>
                        </div>

                        <div className="font-medium text-white flex items-center space-x-1">
                          {isRoute ? (
                            <span>Route: <strong className="text-amber-400 font-mono">{asg.routeNo}</strong> {asg.routeName ? `(${asg.routeName})` : ''}</span>
                          ) : (
                            <span>Bus: <strong className="text-amber-400 font-mono">Unit #{asg.unitNumber}</strong> {asg.plateNumber ? `[${asg.plateNumber}]` : ''}</span>
                          )}
                        </div>

                        {asg.reason && (
                          <p className="text-[11px] text-slate-400">{asg.reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Emergency Contacts */}
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Emergency Contacts ({employee.employeeContacts?.length || 0})</span>
              </h3>

              {employee.employeeContacts && employee.employeeContacts.length > 0 ? (
                <div className="space-y-2">
                  {employee.employeeContacts.map((contact, idx) => (
                    <div
                      key={contact.contactId || idx}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-200">{contact.contactName}</span>
                          {contact.primaryContact && (
                            <span className="px-1.5 py-0.2 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-[11px]">{contact.relationship}</span>
                      </div>
                      <div className="text-right">
                        <a
                          href={`tel:${contact.mobilePhone || contact.homePhone}`}
                          className="font-mono text-emerald-400 hover:underline flex items-center space-x-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{contact.mobilePhone || contact.homePhone || 'No phone'}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No emergency contacts listed.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => onDelete(employee.id)}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Record</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition"
            >
              Close
            </button>
            <button
              onClick={() => onEdit(employee)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
