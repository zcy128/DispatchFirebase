import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canEditPage } from '../utils/permissions';
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

interface CompanyContactsViewProps {
  contacts?: CompanyContact[];
}

export const CompanyContactsView: React.FC<CompanyContactsViewProps> = ({ contacts: initialPropsContacts }) => {
  const { currentUser } = useAuth();
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

  useEffect(() => {
    if (initialPropsContacts && initialPropsContacts.length > 0) {
      setContacts(initialPropsContacts);
    }
  }, [initialPropsContacts]);

  useEffect(() => {
    if (!initialPropsContacts) {
      const unsub = CompanyContactsService.subscribeToCompanyContacts((data) => {
        setContacts(data);
      });
      return () => unsub();
    }
  }, [initialPropsContacts]);

  const [searchTerm, setSearchTerm] = useState('');
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

  // Check RBAC permission for this page
  const canEdit = canEditPage(currentUser, 'company_contacts');

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (selectedDept !== 'ALL' && c.department !== selectedDept) return false;
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase().trim();
        const matchName = c.name.toLowerCase().includes(t);
        const matchTitle = c.title.toLowerCase().includes(t);
        const matchPhone = c.phone.includes(t);
        const matchEmail = c.email.toLowerCase().includes(t);
        const matchDept = c.department.toLowerCase().includes(t);
        if (!matchName && !matchTitle && !matchPhone && !matchEmail && !matchDept) return false;
      }
      return true;
    });
  }, [contacts, selectedDept, searchTerm]);

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
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this company contact?')) {
      const nextList = contacts.filter((c) => c.id !== id);
      setContacts(nextList);
      try {
        await CompanyContactsService.deleteContact(id);
      } catch (err) {
        console.error('Failed to delete contact from Firestore:', err);
      }
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      const updatedContact: CompanyContact = {
        ...editingContact,
        name: formName,
        title: formTitle,
        department: formDept,
        phone: formPhone,
        extension: formExt,
        email: formEmail,
        hours: formHours,
        is24x7: formIs24x7,
        notes: formNotes
      };
      setContacts(contacts.map((c) => (c.id === editingContact.id ? updatedContact : c)));
      try {
        await CompanyContactsService.saveContact(updatedContact);
      } catch (err) {
        console.error('Failed to save contact to Firestore:', err);
      }
    } else {
      const newContact: CompanyContact = {
        id: `CC-${Date.now()}`,
        name: formName,
        title: formTitle,
        department: formDept,
        phone: formPhone,
        extension: formExt,
        email: formEmail,
        hours: formHours,
        is24x7: formIs24x7,
        notes: formNotes
      };
      setContacts([newContact, ...contacts]);
      try {
        await CompanyContactsService.saveContact(newContact);
      } catch (err) {
        console.error('Failed to create contact in Firestore:', err);
      }
    }
    setIsModalOpen(false);
  };

  const getDeptBadgeClass = (dept: CompanyContact['department']) => {
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
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Company Contacts Directory
              </h1>
              {canEdit ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Editor (HR / Admin)</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center space-x-1">
                  <span>Read-Only Access</span>
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Corporate emergency hotlines, operations desks, and departmental extensions.
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs transition shadow-lg shadow-amber-500/20 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Contact</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search contacts by name, department, phone, or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs md:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'Operations', 'Emergency', 'Fleet', 'HR', 'Training', 'Finance'].map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedDept === dept
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {dept === 'ALL' ? 'All Departments' : dept}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    <span>24/7 Active</span>
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-white tracking-tight">
                {c.name}
              </h3>
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
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <a
                    href={`tel:${c.phone}`}
                    className="font-bold text-white hover:text-amber-400 transition"
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
                <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <a
                  href={`mailto:${c.email}`}
                  className="hover:text-amber-400 transition truncate"
                  title={c.email}
                >
                  {c.email}
                </a>
              </div>

              <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{c.hours}</span>
              </div>
            </div>

            {/* Action Buttons: Gated by canEdit */}
            {canEdit && (
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(c)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center space-x-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal for Adding / Editing Contact */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingContact ? 'Edit Company Contact' : 'Add New Company Contact'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Contact / Line Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. 24/7 Operations Desk"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Title / Role
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Operations Coordinator"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Department *
                  </label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Operations">Operations</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Fleet">Fleet</option>
                    <option value="HR">HR</option>
                    <option value="Training">Training</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="613-555-0100"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Extension / Radio
                  </label>
                  <input
                    type="text"
                    value={formExt}
                    onChange={(e) => setFormExt(e.target.value)}
                    placeholder="Ext. 101"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="contact@dispatch.local"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Hours of Operation
                  </label>
                  <input
                    type="text"
                    value={formHours}
                    onChange={(e) => setFormHours(e.target.value)}
                    placeholder="08:00 AM - 05:00 PM"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="check24x7"
                  checked={formIs24x7}
                  onChange={(e) => setFormIs24x7(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="check24x7" className="text-slate-300 font-semibold">
                  Available 24 Hours / 7 Days Hotline
                </label>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Notes & Instructions
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Escalation procedures, dispatch channel notes..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
