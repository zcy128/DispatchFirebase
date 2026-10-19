import React, { useState, useEffect } from 'react';
import { Employee, EmployeeContact, UserRole, PermissionLevel } from '../../types/employee';
import { X, Plus, Trash2, Shield, CheckCircle2, RefreshCw, ChevronRight } from 'lucide-react';
import {
  USER_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_PAGES,
  CATEGORY_LABELS,
  normalizeRole
} from '../../utils/permissions';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Partial<Employee>) => Promise<void>;
  initialData?: Employee | null;
  initialTab?: 'profile' | 'permissions' | 'contact' | 'license' | 'emergency';
}

// Safe helper to format any date or Firestore Timestamp for HTML date inputs
const formatDateForInput = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate().toISOString().substring(0, 10);
  }
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString().substring(0, 10);
  }
  if (val instanceof Date) {
    return val.toISOString().substring(0, 10);
  }
  if (typeof val === 'string') {
    return val.substring(0, 10);
  }
  return '';
};

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  initialTab = 'profile'
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'permissions' | 'contact' | 'license' | 'emergency'>(initialTab);
  const [loading, setLoading] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [username, setUsername] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [jobPosition, setJobPosition] = useState('School Bus Driver');
  const [yardId, setYardId] = useState('HQ-Central');
  const [isActive, setIsActive] = useState(true);
  const [dateHired, setDateHired] = useState('');
  const [role, setRole] = useState<UserRole>('driver');
  const [pagePermissions, setPagePermissions] = useState<Record<string, PermissionLevel>>({});

  // Auto-generate username: e.g. "driver1 Doe" -> "driver1d"
  const computedUsername = React.useMemo(() => {
    if (username) return username.trim().toLowerCase();
    const fn = (firstName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ln = (lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return fn + (ln.length > 0 ? ln[0] : '');
  }, [username, firstName, lastName]);

  // Contact
  const [mobilePhone, setMobilePhone] = useState('');
  const [workPhonePhone, setWorkPhonePhone] = useState('');
  const [homePhone, setHomePhone] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalAddress, setPersonalAddress] = useState('');

  // Driver License
  const [hasLicense, setHasLicense] = useState(false);
  const [licenseId, setLicenseId] = useState('');
  const [licenseClass, setLicenseClass] = useState('Class B with Z');
  const [expirationDate, setExpirationDate] = useState('');
  const [licenseCondition, setLicenseCondition] = useState('');
  const [mvid, setMvid] = useState('');

  // Emergency contacts
  const [contacts, setContacts] = useState<EmployeeContact[]>([]);

  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.firstName || '');
      setLastName(initialData.lastName || '');
      setMiddleName(initialData.middleName || '');
      setUsername(initialData.username || '');
      setEmployeeNumber(initialData.employeeNumber || '');
      setJobPosition(initialData.jobPosition || 'School Bus Driver');
      setYardId(initialData.yardId || 'HQ-Central');
      setIsActive(initialData.isActive ?? true);
      setDateHired(formatDateForInput(initialData.dateHired));
      setRole(normalizeRole(initialData.role || 'driver'));
      setPagePermissions(initialData.pagePermissions || {});

      setMobilePhone(initialData.mobilePhone || '');
      setWorkPhonePhone(initialData.workPhonePhone || '');
      setHomePhone(initialData.homePhone || '');
      setWorkEmail(initialData.workEmail || '');
      setPersonalEmail(initialData.personalEmail || '');
      setPersonalAddress(initialData.personalAddress || '');

      if (initialData.driverLicense) {
        setHasLicense(true);
        setLicenseId(initialData.driverLicense.licenseId || '');
        setLicenseClass(initialData.driverLicense.licenseClass || 'Class B with Z');
        setExpirationDate(formatDateForInput(initialData.driverLicense.expirationDate));
        setLicenseCondition(initialData.driverLicense.licenseCondition || '');
        setMvid(initialData.driverLicense.mvid || '');
      } else {
        setHasLicense(false);
        setLicenseId('');
        setLicenseClass('Class B with Z');
        setExpirationDate('');
        setLicenseCondition('');
        setMvid('');
      }

      setContacts(Array.isArray(initialData.employeeContacts) ? initialData.employeeContacts : []);
    } else {
      // Defaults for new employee
      setFirstName('');
      setLastName('');
      setMiddleName('');
      setEmployeeNumber(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
      setJobPosition('School Bus Driver');
      setYardId('HQ-Central');
      setIsActive(true);
      setDateHired(new Date().toISOString().substring(0, 10));
      setRole('driver');
      setPagePermissions({});

      setMobilePhone('');
      setWorkPhonePhone('');
      setHomePhone('');
      setWorkEmail('');
      setPersonalEmail('');
      setPersonalAddress('');

      setHasLicense(true);
      setLicenseId('');
      setLicenseClass('Class B with Z');
      setExpirationDate(new Date(Date.now() + 365 * 86400000).toISOString().substring(0, 10));
      setLicenseCondition('');
      setMvid('');

      setContacts([]);
    }
    if (isOpen) {
      setActiveTab(initialTab || 'profile');
    }
  }, [initialData, isOpen, initialTab]);

  if (!isOpen) return null;

  const handleAddContact = () => {
    setContacts([
      ...contacts,
      {
        contactId: `EC-${Date.now()}`,
        contactName: '',
        relationship: 'Spouse',
        mobilePhone: '',
        primaryContact: contacts.length === 0,
        active: true
      }
    ]);
  };

  const handleRemoveContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const handleContactChange = (index: number, field: keyof EmployeeContact, value: any) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: Partial<Employee> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim(),
        username: computedUsername,
        employeeNumber: employeeNumber.trim(),
        jobPosition,
        yardId,
        isActive,
        role,
        pagePermissions,
        dateHired: dateHired ? new Date(dateHired).toISOString() : undefined,
        mobilePhone: mobilePhone.trim(),
        workPhonePhone: workPhonePhone.trim(),
        homePhone: homePhone.trim(),
        workEmail: workEmail.trim(),
        personalEmail: personalEmail.trim(),
        personalAddress: personalAddress.trim(),
        employeeContacts: contacts
      };

      if (hasLicense && licenseId && expirationDate) {
        payload.driverLicense = {
          licenseId,
          expirationDate: new Date(expirationDate).toISOString(),
          licenseClass,
          licenseCondition: licenseCondition || undefined,
          mvid: mvid || undefined
        };
      } else {
        payload.driverLicense = undefined;
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      alert(`Error saving employee: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {initialData ? `Edit Staff: ${initialData.fullName}` : 'Register New Employee'}
            </h2>
            <p className="text-xs text-slate-400">
              Master employee record synchronized to Firestore business database
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 space-x-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            General Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'permissions'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Role & Page Access</span>
            {Object.keys(pagePermissions).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                {Object.keys(pagePermissions).length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'contact'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Phone & Address
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('license')}
            className={`py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'license'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            CDL Driver License
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emergency')}
            className={`py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'emergency'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Emergency Contacts ({contacts.length})
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="e.g. David"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="e.g. Robert"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="e.g. Miller"
                  />
                </div>
              </div>

              {/* Auto-Generated Login Username Card */}
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-semibold text-slate-200">
                      System Login Username
                    </label>
                    <span className="px-1.5 py-0.2 text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-semibold uppercase">
                      Auto-Generated
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Used to log in directly. Maps to internal account <span className="font-mono text-slate-300">@{computedUsername || 'username'}@dispatch.pcy.ca</span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs">
                    <span className="text-slate-400 mr-0.5">@</span>
                    <input
                      type="text"
                      value={computedUsername}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      className="bg-transparent text-amber-400 font-bold focus:outline-none w-28 text-xs"
                      placeholder="driver1d"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Employee Number (ID) *</label>
                  <input
                    type="text"
                    required
                    value={employeeNumber}
                    onChange={(e) => setEmployeeNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                    placeholder="EMP-1001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Job Position *</label>
                  <select
                    value={jobPosition}
                    onChange={(e) => setJobPosition(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="School Bus Driver">School Bus Driver</option>
                    <option value="Senior School Bus Driver">Senior School Bus Driver</option>
                    <option value="Head Dispatcher">Head Dispatcher</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="Yard Supervisor">Yard Supervisor</option>
                    <option value="Fleet Mechanic & Relief Driver">Fleet Mechanic & Relief Driver</option>
                    <option value="Operations Director & System Admin">Operations Director & System Admin</option>
                  </select>
                </div>
              </div>

              {/* System Role (Custom Claims / RBAC) Card */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <label className="text-xs font-bold text-slate-200">
                      User Role (Custom Claims / RBAC) *
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('permissions')}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1 transition"
                  >
                    <span>Configure Page Access</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{ROLE_DESCRIPTIONS[role]}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Yard</label>
                  <select
                    value={yardId}
                    onChange={(e) => setYardId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="HQ-Central">HQ-Central (Ottawa)</option>
                    <option value="Yard-East">Yard-East (Industrial)</option>
                    <option value="Yard-West">Yard-West (Nepean)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date Hired</label>
                  <input
                    type="date"
                    value={dateHired}
                    onChange={(e) => setDateHired(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <label className="flex items-center space-x-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-800 border-slate-700"
                    />
                    <span className="text-sm font-medium text-emerald-400">
                      {isActive ? 'Active Staff' : 'Inactive'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Permissions & Page Access Overrides */}
          {activeTab === 'permissions' && (
            <div className="space-y-5">
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Base Role: {ROLE_LABELS[role]}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                      {role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>
                {Object.keys(pagePermissions).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPagePermissions({})}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 flex items-center space-x-1.5 transition flex-shrink-0"
                    title="Clear all page overrides and reset to role defaults"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset All Overrides</span>
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between px-1">
                <span>
                  Configure page-level authorization overrides for this employee. Custom settings override role defaults.
                </span>
                <span className="text-amber-400 font-mono text-[11px] font-semibold">
                  {Object.keys(pagePermissions).length} Custom Override(s)
                </span>
              </div>

              {/* Grouped Page Permissions Matrix */}
              <div className="space-y-4">
                {(['operations', 'masterData', 'hr_finance', 'system'] as const).map((cat) => {
                  const pagesInCat = SYSTEM_PAGES.filter((p) => p.category === cat);
                  if (pagesInCat.length === 0) return null;

                  return (
                    <div key={cat} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-sm">
                      <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-800 font-bold text-xs text-slate-200 flex items-center justify-between">
                        <span>{CATEGORY_LABELS[cat]}</span>
                        <span className="text-[10px] font-mono text-slate-400">{pagesInCat.length} pages</span>
                      </div>
                      <div className="divide-y divide-slate-800/60">
                        {pagesInCat.map((page) => {
                          const defaultPerm = DEFAULT_ROLE_PERMISSIONS[role]?.[page.id] || 'none';
                          const overrideVal = pagePermissions[page.id]; // undefined means inherit
                          const isOverridden = overrideVal !== undefined;
                          const effectivePerm = isOverridden ? overrideVal : defaultPerm;

                          return (
                            <div
                              key={page.id}
                              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition"
                            >
                              <div className="flex-1 pr-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-white">{page.label}</span>
                                  {isOverridden && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                                      Customized
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{page.description}</p>
                              </div>

                              <div className="flex items-center space-x-3 flex-shrink-0">
                                {/* Role Default Indicator */}
                                <div className="text-[11px] text-slate-400 hidden lg:block">
                                  <span className="text-slate-500 mr-1">Default:</span>
                                  <span className="font-semibold text-slate-300">
                                    {defaultPerm === 'readwrite' ? 'Read/Write' : defaultPerm === 'readonly' ? 'Read-Only' : 'No Access'}
                                  </span>
                                </div>

                                {/* Override Selector */}
                                <select
                                  value={overrideVal !== undefined ? overrideVal : 'default'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const next = { ...pagePermissions };
                                    if (val === 'default') {
                                      delete next[page.id];
                                    } else {
                                      next[page.id] = val as PermissionLevel;
                                    }
                                    setPagePermissions(next);
                                  }}
                                  className={`bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none transition ${
                                    isOverridden
                                      ? 'border-amber-500/80 text-amber-300 ring-1 ring-amber-500/30 bg-amber-500/5'
                                      : 'border-slate-700 text-slate-300'
                                  }`}
                                >
                                  <option value="default">
                                    Inherit ({defaultPerm === 'readwrite' ? 'Read/Write' : defaultPerm === 'readonly' ? 'Read-Only' : 'No Access'})
                                  </option>
                                  <option value="readwrite">Read & Write</option>
                                  <option value="readonly">Read Only</option>
                                  <option value="none">No Access</option>
                                </select>

                                {/* Effective Badge */}
                                <span
                                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase min-w-[76px] text-center ${
                                    effectivePerm === 'readwrite'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : effectivePerm === 'readonly'
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}
                                >
                                  {effectivePerm === 'readwrite' ? 'Read/Write' : effectivePerm === 'readonly' ? 'Read-Only' : 'Denied'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Phone & Address */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    value={mobilePhone}
                    onChange={(e) => setMobilePhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="613-555-0100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Work Phone</label>
                  <input
                    type="text"
                    value={workPhonePhone}
                    onChange={(e) => setWorkPhonePhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="613-555-0200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Home Phone</label>
                  <input
                    type="text"
                    value={homePhone}
                    onChange={(e) => setHomePhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="613-555-0300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Work Email</label>
                  <input
                    type="email"
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="david.m@dispatch.local"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Personal Email</label>
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="david.personal@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Home Address</label>
                <input
                  type="text"
                  value={personalAddress}
                  onChange={(e) => setPersonalAddress(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 45 Meadowlands Dr, Nepean, ON"
                />
              </div>
            </div>
          )}

          {/* TAB 3: CDL Driver License */}
          {activeTab === 'license' && (
            <div className="space-y-4">
              <label className="flex items-center space-x-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLicense}
                  onChange={(e) => setHasLicense(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-800 border-slate-700"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-200">
                    Employee holds a Commercial Driver's License (CDL / School Bus)
                  </span>
                  <p className="text-xs text-slate-400">
                    Enables automated expiration alerts and route assignment qualification
                  </p>
                </div>
              </label>

              {hasLicense && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">License ID / Number *</label>
                      <input
                        type="text"
                        required={hasLicense}
                        value={licenseId}
                        onChange={(e) => setLicenseId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                        placeholder="M1234-56789-01234"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">License Class & Endorsement *</label>
                      <select
                        value={licenseClass}
                        onChange={(e) => setLicenseClass(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="Class B with Z Air Brake">Class B with Z Air Brake</option>
                        <option value="Class B">Class B</option>
                        <option value="Class CZ">Class CZ</option>
                        <option value="Class E / School Van">Class E / School Van</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Expiration Date *</label>
                      <input
                        type="date"
                        required={hasLicense}
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Conditions</label>
                      <input
                        type="text"
                        value={licenseCondition}
                        onChange={(e) => setLicenseCondition(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                        placeholder="Corrective Lenses"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">MVID</label>
                      <input
                        type="text"
                        value={mvid}
                        onChange={(e) => setMvid(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                        placeholder="MVID-99812"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Emergency Contacts */}
          {activeTab === 'emergency' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Required for emergency dispatch response and safety protocols
                </span>
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs font-bold rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>
              </div>

              {contacts.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No emergency contacts configured yet. Click "Add Contact" above.
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c, idx) => (
                    <div key={idx} className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">Contact #{idx + 1}</span>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={c.primaryContact}
                              onChange={(e) => handleContactChange(idx, 'primaryContact', e.target.checked)}
                              className="rounded text-amber-500 bg-slate-800"
                            />
                            <span>Primary</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveContact(idx)}
                            className="p-1 text-rose-400 hover:bg-rose-500/10 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Name"
                          value={c.contactName}
                          onChange={(e) => handleContactChange(idx, 'contactName', e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Relationship (e.g. Spouse)"
                          value={c.relationship || ''}
                          onChange={(e) => handleContactChange(idx, 'relationship', e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Phone number"
                          value={c.mobilePhone || ''}
                          onChange={(e) => handleContactChange(idx, 'mobilePhone', e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition disabled:opacity-50"
            >
              {loading ? 'Saving to Database...' : initialData ? 'Update Record' : 'Save Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
