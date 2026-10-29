import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export interface CompanyContact {
  id: string;
  name: string;
  title: string;
  department: 'Operations' | 'Emergency' | 'HR' | 'Fleet' | 'Training' | 'Finance';
  phone: string;
  extension?: string;
  email: string;
  hours: string;
  is24x7?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const INITIAL_COMPANY_CONTACTS: CompanyContact[] = [
  {
    id: 'CC-01',
    name: '24/7 Dispatch Operations Desk',
    title: 'Central Dispatch Command',
    department: 'Operations',
    phone: '613-555-0100',
    extension: 'Ext. 101',
    email: 'dispatch@dispatch.local',
    hours: '24 Hours / 7 Days',
    is24x7: true,
    notes: 'Primary channel for on-road bus issues, route diversions, and delays'
  },
  {
    id: 'CC-02',
    name: 'Student Incident & Safety Emergency Line',
    title: 'Student Care Safety Officer',
    department: 'Emergency',
    phone: '613-555-0199',
    extension: 'Hotline',
    email: 'safety-desk@dispatch.local',
    hours: '24 Hours / 7 Days',
    is24x7: true,
    notes: 'Urgent behavioral incidents, child welfare, missing passengers'
  },
  {
    id: 'CC-03',
    name: 'Fleet Maintenance & Roadside Recovery',
    title: 'Head Mechanic & Shop Dispatch',
    department: 'Fleet',
    phone: '613-555-0150',
    extension: 'Ext. 204',
    email: 'fleet-shop@dispatch.local',
    hours: '05:00 AM - 08:00 PM',
    is24x7: false,
    notes: 'Mechanical breakdowns, flat tires, emergency bus towing'
  },
  {
    id: 'CC-04',
    name: 'Human Resources & Crew Staffing',
    title: 'HR Employee Relations Manager',
    department: 'HR',
    phone: '613-555-0120',
    extension: 'Ext. 305',
    email: 'hr@dispatch.local',
    hours: '08:00 AM - 05:00 PM',
    is24x7: false,
    notes: 'Staff absence coverage, benefits, CDL compliance certification'
  },
  {
    id: 'CC-05',
    name: 'Safety Training & Recertification Office',
    title: 'Chief Driver Instructor',
    department: 'Training',
    phone: '613-555-0133',
    extension: 'Ext. 402',
    email: 'training@dispatch.local',
    hours: '07:30 AM - 04:30 PM',
    is24x7: false,
    notes: 'Driver evaluations, defensive driving refresher seminars'
  },
  {
    id: 'CC-06',
    name: 'Driver Payroll & Compensation Office',
    title: 'Payroll Coordinator',
    department: 'Finance',
    phone: '613-555-0144',
    extension: 'Ext. 501',
    email: 'payroll@dispatch.local',
    hours: '08:30 AM - 04:30 PM',
    is24x7: false,
    notes: 'Bi-weekly timesheets, charter mileage adjustments, expense payouts'
  }
];

const LOCAL_STORAGE_KEY = 'dispatch_company_contacts';

function getLocalContacts(): CompanyContact[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : INITIAL_COMPANY_CONTACTS;
  } catch {
    return INITIAL_COMPANY_CONTACTS;
  }
}

function setLocalContacts(contacts: CompanyContact[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(contacts));
  } catch (e) {
    console.warn('[CompanyContactsService] localStorage write error:', e);
  }
}

export const CompanyContactsService = {
  /**
   * Real-time subscription to company contacts collection in Firestore with IndexedDB cache
   */
  subscribeToCompanyContacts: (
    onUpdate: (contacts: CompanyContact[]) => void,
    onError?: (err: Error) => void
  ) => {
    // Deliver local cache immediately to eliminate render flicker
    const local = getLocalContacts();
    onUpdate(local);

    if (!db) {
      return () => {};
    }

    try {
      const collRef = collection(db, 'company_contacts');
      const unsubscribe = onSnapshot(
        collRef,
        async (snapshot) => {
          if (snapshot.empty) {
            // Seed initial contacts if Firestore collection is empty
            if (!db) {
              onUpdate(INITIAL_COMPANY_CONTACTS);
              return;
            }
            const firestore = db;
            try {
              const batch = writeBatch(firestore);
              INITIAL_COMPANY_CONTACTS.forEach((c) => {
                const docRef = doc(firestore, 'company_contacts', c.id);
                batch.set(docRef, { ...c, updatedAt: new Date().toISOString() });
              });
              await batch.commit();
            } catch (seedErr) {
              console.warn('[CompanyContactsService] Failed to seed initial contacts:', seedErr);
            }
            onUpdate(INITIAL_COMPANY_CONTACTS);
            setLocalContacts(INITIAL_COMPANY_CONTACTS);
            return;
          }

          const list: CompanyContact[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as CompanyContact), id: d.id });
          });

          // Sort by id / name for deterministic display
          list.sort((a, b) => a.id.localeCompare(b.id));

          setLocalContacts(list);
          onUpdate(list);
        },
        (error) => {
          console.warn('[CompanyContactsService] Firestore snapshot notice:', error);
          if (onError) onError(error);
          onUpdate(getLocalContacts());
        }
      );

      return unsubscribe;
    } catch (e) {
      console.error('[CompanyContactsService] subscribe error:', e);
      return () => {};
    }
  },

  /**
   * Save or update contact in Firestore + local cache
   */
  saveContact: async (contact: CompanyContact): Promise<void> => {
    const id = contact.id || `CC-${Date.now()}`;
    const payload: CompanyContact = {
      ...contact,
      id,
      updatedAt: new Date().toISOString(),
    };

    // Update local cache optimistically
    const local = getLocalContacts();
    const idx = local.findIndex((c) => c.id === id);
    if (idx >= 0) {
      local[idx] = payload;
    } else {
      local.push(payload);
    }
    setLocalContacts(local);

    if (db) {
      const docRef = doc(db, 'company_contacts', id);
      await setDoc(docRef, payload, { merge: true });
    }
  },

  /**
   * Delete contact
   */
  deleteContact: async (id: string): Promise<void> => {
    const local = getLocalContacts().filter((c) => c.id !== id);
    setLocalContacts(local);

    if (db) {
      const docRef = doc(db, 'company_contacts', id);
      await deleteDoc(docRef);
    }
  },
};
