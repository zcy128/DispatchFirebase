import React, { useState, useEffect } from 'react';
import { X, Building2, User, Phone, Mail, Shield } from 'lucide-react';
import { Yard, CreateYardInput, UpdateYardInput } from '../../types/yard';
import { Employee } from '../../types/employee';

interface YardModalProps {
  isOpen: boolean;
  yard: Yard | null; // null for creating
  employees: Employee[];
  onClose: () => void;
  onSave: (data: CreateYardInput | UpdateYardInput) => Promise<void>;
}

export const YardModal: React.FC<YardModalProps> = ({
  isOpen,
  yard,
  employees,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorPhone, setSupervisorPhone] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorAltName, setSupervisorAltName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (yard) {
      setName(yard.name || '');
      setIsActive(yard.isActive !== undefined ? yard.isActive : true);
      setSupervisorId(yard.supervisorId || '');
      setSupervisorName(yard.supervisorName || '');
      setSupervisorPhone(yard.supervisorPhone || '');
      setSupervisorEmail(yard.supervisorEmail || '');
      setSupervisorAltName(yard.supervisorAltName === '—' ? '' : (yard.supervisorAltName || ''));
    } else {
      setName('');
      setIsActive(true);
      setSupervisorId('');
      setSupervisorName('');
      setSupervisorPhone('');
      setSupervisorEmail('');
      setSupervisorAltName('');
    }
    setErrorMsg(null);
  }, [yard, isOpen]);

  // Group and prioritize employees with supervisor job titles
  const { supervisorEmployees, otherEmployees } = React.useMemo(() => {
    const isSupervisor = (e: Employee) => {
      const pos = (e.jobPosition || '').toLowerCase();
      const role = (e.role || '').toLowerCase();
      return pos.includes('supervisor') || role === 'supervisor';
    };

    const eligibleList = employees.filter((e) => e.isActive || e.id === supervisorId);
    const supervisors: Employee[] = [];
    const others: Employee[] = [];

    eligibleList.forEach((e) => {
      if (isSupervisor(e)) {
        supervisors.push(e);
      } else {
        others.push(e);
      }
    });

    supervisors.sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
    others.sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );

    return { supervisorEmployees: supervisors, otherEmployees: others };
  }, [employees, supervisorId]);

  if (!isOpen) return null;

  const handleSupervisorSelect = (empId: string) => {
    setSupervisorId(empId);
    if (!empId) {
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      const fullName = `${emp.firstName} ${emp.lastName}`.trim();
      setSupervisorName(fullName);
      setSupervisorPhone(emp.workPhonePhone || emp.mobilePhone || '');
      setSupervisorEmail(emp.workEmail || emp.personalEmail || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Yard name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onSave({
        name: name.trim(),
        isActive,
        supervisorId: supervisorId || undefined,
        supervisorName: supervisorName.trim() || undefined,
        supervisorPhone: supervisorPhone.trim() || undefined,
        supervisorEmail: supervisorEmail.trim() || undefined,
        supervisorAltName: supervisorAltName.trim() || '—',
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save yard';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-serif text-slate-900 dark:text-white">
                {yard ? `Edit Yard (${yard.name})` : 'Add New Yard'}
              </h3>
              <p className="text-xs text-slate-500">
                Configure facility information and assigned supervision.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Yard Name & Status */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Yard Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Yard 1, Yard-East, HQ-Central"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2c3e50] dark:focus:ring-slate-500"
              />
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                  Active Status
                </span>
                <span className="text-xs text-slate-500">
                  Allows active vehicle dispatch and route routing
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? 'bg-[#2c3e50]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Supervisor Selection */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span>Supervision Assignment</span>
            </div>

            {/* Quick Select Employee */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Assign from Staff Roster
              </label>
              <select
                value={supervisorId}
                onChange={(e) => handleSupervisorSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2c3e50] dark:focus:ring-slate-500"
              >
                <option value="">-- Choose Employee or Enter Custom Below --</option>
                {supervisorEmployees.length > 0 && (
                  <optgroup label="Supervisors (Recommended)">
                    {supervisorEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} — {emp.jobPosition || 'Supervisor'}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherEmployees.length > 0 && (
                  <optgroup label="Other Staff">
                    {otherEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.jobPosition || 'Staff'})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Employees with the supervisor job title are prioritized at the top.
              </p>
            </div>

            {/* Supervisor Display Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Primary Supervisor Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  placeholder="e.g. Supervisor1 Williams"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2c3e50] dark:focus:ring-slate-500"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Supervisor Phone
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supervisorPhone}
                    onChange={(e) => setSupervisorPhone(e.target.value)}
                    placeholder="613-555-0100"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Supervisor Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={supervisorEmail}
                    onChange={(e) => setSupervisorEmail(e.target.value)}
                    placeholder="name@ottawaschoolbus.ca"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Alternate Supervisor */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Alternate Supervisor (Optional)
              </label>
              <input
                type="text"
                value={supervisorAltName}
                onChange={(e) => setSupervisorAltName(e.target.value)}
                placeholder="e.g. Rachel Dupont, or leave blank"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#2c3e50] hover:bg-[#1a252f] text-white font-bold text-sm shadow transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Yard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
