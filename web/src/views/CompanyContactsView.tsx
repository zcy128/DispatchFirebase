import React, { useState, useMemo, useEffect, useRef, useDeferredValue, useId } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canEditPage } from '../utils/permissions';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import {
  PhoneCall,
  Search,
  Plus,
  Mail,
  Clock,
  Radio,
  Edit2,
  Trash2,
  ShieldCheck,
  X,
  Phone
} from 'lucide-react';
import { CompanyContact, CompanyContactsService, INITIAL_COMPANY_CONTACTS } from '../services/companyContactsService';

export type { CompanyContact };

export const FILTER_DEPARTMENTS = [
  'ALL',
  'Operations',
  'Emergency',
  'Fleet',
  'HR',
  'Training',
  'Finance',
] as const;

export const CONTACT_DEPARTMENTS: readonly CompanyContact['department'][] = [
  'Operations',
  'Emergency',
  'Fleet',
  'HR',
  'Training',
  'Finance',
] as const;

// Pure styling helper hoisted outside component
export function getDeptBadgeClass(dept: CompanyContact['department']): string {
  switch (dept) {
    case 'Operations':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Emergency':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    case 'Fleet':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'HR':
      return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
    case 'Training':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'Finance':
      return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
    default:
      return 'bg-slate-700/40 text-slate-300 border-slate-700';
  }
}

interface CompanyContactsViewProps {
  contacts?: CompanyContact[];
}

interface ContactModalDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

const ContactModalDialog: React.FC<ContactModalDialogProps> = ({
  open,
  onClose,
  ariaLabelledBy,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
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
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 m-auto ${maxWidthClass} w-[calc(100%-2rem)] bg-transparent p-0 border-0 backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm [&:modal]:overscroll-contain [&::backdrop]:overflow-hidden [&::backdrop]:overscroll-contain`}
    >
      {children}
    </dialog>
  );
};

export const CompanyContactsView: React.FC<CompanyContactsViewProps> = ({ contacts: initialPropsContacts }) => {
  const { currentUser } = useAuth();
  const contactsSynced = useRef(false);
  const [contacts, setContacts] = useState<CompanyContact[]>(() => {
    if (initialPropsContacts && initialPropsContacts.length > 0) {
      return initialPropsContacts;
    }
    try {
      const saved = localStorage.getItem('dispatch_company_contacts');
      return saved ? JSON.parse(saved) : INITIAL_COMPANY_CONTACTS;
    } catch {
      return INITIAL_COMPANY_CONTACTS;
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CompanyContact | null>(null);

  // Form states for creating / editing
  const [formName, setFormName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDept, setFormDept] = useState<CompanyContact['department']>('Operations');
  const [formPhone, setFormPhone] = useState('');
  const [formExt, setFormExt] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formHours, setFormHours] = useState('');
  const [formIs24x7, setFormIs24x7] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingContact, setDeletingContact] = useState<CompanyContact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const baseId = useId();
  const nameId = `${baseId}-name`;
  const titleId = `${baseId}-title`;
  const deptId = `${baseId}-dept`;
  const phoneId = `${baseId}-phone`;
  const extId = `${baseId}-ext`;
  const emailId = `${baseId}-email`;
  const hoursId = `${baseId}-hours`;
  const check24x7Id = `${baseId}-24x7`;
  const notesId = `${baseId}-notes`;
  const formErrorId = `${baseId}-error`;

  useEffect(() => {
    if (!initialPropsContacts) return;
    if (!contactsSynced.current && initialPropsContacts.length === 0) return;
    contactsSynced.current = true;
    setContacts(initialPropsContacts);
  }, [initialPropsContacts]);

  useEffect(() => {
    if (initialPropsContacts) return;
    let isCancelled = false;
    const unsub = CompanyContactsService.subscribeToCompanyContacts((data) => {
      if (!isCancelled) {
        setContacts(data);
      }
    });
    return () => {
      isCancelled = true;
      unsub();
    };
  }, [initialPropsContacts]);

  // Check RBAC permission for this page
  const canEdit = canEditPage(currentUser, 'company_contacts');

  const filteredContacts = useMemo(() => {
    const t = deferredSearchTerm.trim().toLowerCase();
    const hasTerm = t.length > 0;

    return contacts.filter((c) => {
      if (selectedDept !== 'ALL' && c.department !== selectedDept) return false;
      if (hasTerm) {
        const matchName = (c.name || '').toLowerCase().includes(t);
        const matchTitle = (c.title || '').toLowerCase().includes(t);
        const matchPhone = (c.phone || '').includes(t);
        const matchEmail = (c.email || '').toLowerCase().includes(t);
        const matchDept = (c.department || '').toLowerCase().includes(t);
        if (!matchName && !matchTitle && !matchPhone && !matchEmail && !matchDept) return false;
      }
      return true;
    });
  }, [contacts, selectedDept, deferredSearchTerm]);

  const handleOpenCreate = () => {
    setEditingContact(null);
    setFormName('');
    setFormTitle('');
    setFormDept('Operations');
    setFormPhone('');
    setFormExt('');
    setFormEmail('');
    setFormHours('08:00 AM - 05:00 PM');
    setFormIs24x7(false);
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contact: CompanyContact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormTitle(contact.title);
    setFormDept(contact.department);
    setFormPhone(contact.phone);
    setFormExt(contact.extension || '');
    setFormEmail(contact.email);
    setFormHours(contact.hours);
    setFormIs24x7(contact.is24x7 ?? false);
    setFormNotes(contact.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingContact) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await CompanyContactsService.deleteContact(deletingContact.id);
      setContacts((prev) => prev.filter((c) => c.id !== deletingContact.id));
      setDeletingContact(null);
    } catch (err: unknown) {
      console.error('Failed to delete contact from Firestore:', err);
      const errMsg = err instanceof Error ? err.message : 'Network or permission error';
      setDeleteError(`Failed to delete contact from database: ${errMsg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const phone = formPhone.trim();
    const email = formEmail.trim();
    if (!name || !phone) {
      setFormError('Contact name and phone number are required.');
      return;
    }
    if (email && !email.includes('@')) {
      setFormError('Enter a valid email address, or leave it blank.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const fields = {
      name,
      title: formTitle.trim(),
      department: formDept,
      phone,
      extension: formExt.trim(),
      email,
      hours: formHours.trim(),
      is24x7: formIs24x7,
      notes: formNotes.trim()
    };

    try {
      if (editingContact) {
        const updatedContact: CompanyContact = {
          ...editingContact,
          ...fields
        };
        await CompanyContactsService.saveContact(updatedContact);
        setContacts((prev) => prev.map((c) => (c.id === editingContact.id ? updatedContact : c)));
      } else {
        const newContact: CompanyContact = {
          id: `CC-${Date.now()}`,
          ...fields
        };
        await CompanyContactsService.saveContact(newContact);
        setContacts((prev) => [newContact, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      console.error('Failed to save contact to Firestore:', err);
      const errMsg = err instanceof Error ? err.message : 'Network or permission error';
      setFormError(`Failed to save to database: ${errMsg}. Please ensure you are logged in and backend is running.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell className="text-slate-100">
      {/* Header */}
      <PageHeader
        title="Company Contacts Directory"
        subtitle="Corporate emergency hotlines, operations desks, and departmental extensions."
        icon={
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <PhoneCall className="w-4 h-4" aria-hidden="true" />
          </div>
        }
        badge={
          canEdit ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              <span>Editor (HR / Admin)</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center space-x-1">
              <span>Read-Only Access</span>
            </span>
          )
        }
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center space-x-2 px-4 py-2 min-h-[36px] bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add New Contact</span>
            </button>
          ) : undefined
        }
      />

      {/* Filter and Search Bar */}
      <search
        aria-label="Search and filter company contacts"
        className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search contacts by name, department, phone, or title"
            placeholder="Search contacts by name, department, phone, or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-base md:text-sm text-slate-100 placeholder-slate-400 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
          />
        </div>

        <div role="group" aria-label="Filter by department" className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
          {FILTER_DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              type="button"
              aria-pressed={selectedDept === dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 min-h-[32px] rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                selectedDept === dept
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {dept === 'ALL' ? 'All Departments' : dept}
            </button>
          ))}
        </div>
      </search>

      {/* Contacts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.length === 0 && (
          <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-12 text-center text-sm text-slate-400">
            No contacts match your search or department filter.
          </div>
        )}
        {filteredContacts.map((c) => (
          <div
            key={c.id}
            className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getDeptBadgeClass(c.department)}`}>
                  {c.department}
                </span>

                {c.is24x7 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                    <Radio className="w-2.5 h-2.5 animate-pulse" aria-hidden="true" />
                    <span>24/7 Active</span>
                  </span>
                )}
              </div>

              <h2 className="text-base font-bold text-white tracking-tight">
                {c.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {c.title}
              </p>

              {c.notes && (
                <p className="text-[11px] text-slate-400 mt-2 p-2 rounded bg-slate-800/40 border border-slate-800 leading-relaxed">
                  {c.notes}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  <a
                    href={`tel:${c.phone}`}
                    className="font-bold text-white hover:text-amber-400 transition rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                  >
                    {c.phone}
                  </a>
                </div>
                {c.extension && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {c.extension}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 text-slate-400 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" aria-hidden="true" />
                <a
                  href={`mailto:${c.email}`}
                  className="hover:text-amber-400 transition truncate rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                  title={c.email}
                >
                  {c.email}
                </a>
              </div>

              <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{c.hours}</span>
              </div>
            </div>

            {/* Action Buttons: Gated by canEdit */}
            {canEdit && (
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(c)}
                  aria-label={`Edit ${c.name}`}
                  className="px-2.5 py-1.5 min-h-[32px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center space-x-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <Edit2 className="w-3 h-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeletingContact(c);
                  }}
                  aria-label={`Delete ${c.name}`}
                  className="px-2.5 py-1.5 min-h-[32px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition flex items-center space-x-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal for Adding / Editing Contact */}
      <ContactModalDialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ariaLabelledBy="contact-modal-title"
        maxWidthClass="max-w-lg"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 id="contact-modal-title" className="text-base font-bold text-white">
              {editingContact ? 'Edit Company Contact' : 'Add New Company Contact'}
            </h2>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              aria-label="Close dialog"
              className="p-1 min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSaveModal} className="p-5 space-y-3.5 text-xs">
            <div>
              <label htmlFor={nameId} className="block text-slate-300 font-semibold mb-1">
                Contact / Line Name <span aria-hidden="true">*</span>
              </label>
              <input
                id={nameId}
                name="name"
                type="text"
                autoFocus
                required
                aria-invalid={Boolean(formError && !formName.trim())}
                aria-describedby={formError ? formErrorId : undefined}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 24/7 Operations Desk"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={titleId} className="block text-slate-300 font-semibold mb-1">
                  Title / Role
                </label>
                <input
                  id={titleId}
                  name="title"
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Operations Coordinator"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                />
              </div>

              <div>
                <label htmlFor={deptId} className="block text-slate-300 font-semibold mb-1">
                  Department <span aria-hidden="true">*</span>
                </label>
                <select
                  id={deptId}
                  name="department"
                  value={formDept}
                  onChange={(e) => setFormDept(e.target.value as CompanyContact['department'])}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500 cursor-pointer"
                >
                  {CONTACT_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={phoneId} className="block text-slate-300 font-semibold mb-1">
                  Phone Number <span aria-hidden="true">*</span>
                </label>
                <input
                  id={phoneId}
                  name="phone"
                  type="tel"
                  required
                  aria-invalid={Boolean(formError && !formPhone.trim())}
                  aria-describedby={formError ? formErrorId : undefined}
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="613-555-0100"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                />
              </div>

              <div>
                <label htmlFor={extId} className="block text-slate-300 font-semibold mb-1">
                  Extension / Radio
                </label>
                <input
                  id={extId}
                  name="extension"
                  type="text"
                  value={formExt}
                  onChange={(e) => setFormExt(e.target.value)}
                  placeholder="Ext. 101"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={emailId} className="block text-slate-300 font-semibold mb-1">
                  Email Address
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  aria-invalid={Boolean(formError && formEmail.trim() && !formEmail.includes('@'))}
                  aria-describedby={formError ? formErrorId : undefined}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contact@dispatch.local"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                />
              </div>

              <div>
                <label htmlFor={hoursId} className="block text-slate-300 font-semibold mb-1">
                  Hours of Operation
                </label>
                <input
                  id={hoursId}
                  name="hours"
                  type="text"
                  value={formHours}
                  onChange={(e) => setFormHours(e.target.value)}
                  placeholder="08:00 AM - 05:00 PM"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id={check24x7Id}
                name="is24x7"
                checked={formIs24x7}
                onChange={(e) => setFormIs24x7(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor={check24x7Id} className="text-slate-300 font-semibold cursor-pointer">
                Available 24 Hours / 7 Days Hotline
              </label>
            </div>

            <div>
              <label htmlFor={notesId} className="block text-slate-300 font-semibold mb-1">
                Notes & Instructions
              </label>
              <textarea
                id={notesId}
                name="notes"
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Escalation procedures, dispatch channel notes..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
              {formError && (
                <span id={formErrorId} role="alert" className="mr-auto text-xs font-semibold text-rose-400">
                  {formError}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 min-h-[36px] rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                {saving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </form>
        </div>
      </ContactModalDialog>

      {/* Delete Contact Confirmation Dialog */}
      <ContactModalDialog
        open={Boolean(deletingContact)}
        onClose={() => {
          setDeleteError(null);
          setDeletingContact(null);
        }}
        ariaLabelledBy="delete-contact-modal-title"
        maxWidthClass="max-w-md"
      >
        {deletingContact && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 shrink-0">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="delete-contact-modal-title" className="text-sm font-bold text-white">
                  Delete Company Contact?
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete <strong className="text-white">{deletingContact.name}</strong> from the directory?
                </p>
              </div>
            </div>

            {deleteError && (
              <div role="alert" className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setDeleteError(null);
                  setDeletingContact(null);
                }}
                disabled={isDeleting}
                className="px-3.5 py-1.5 min-h-[32px] text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
                className="px-4 py-1.5 min-h-[32px] text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              >
                {isDeleting ? 'Deleting...' : 'Delete Contact'}
              </button>
            </div>
          </div>
        )}
      </ContactModalDialog>
    </PageShell>
  );
};
