import { apiRequest } from './api';
import { db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Employee, DashboardStats } from '../types/employee';

// Default mock initial data in case Go API is offline
export const INITIAL_MOCK_EMPLOYEES: Employee[] = [
  {
    id: "EMP-ADMIN-001",
    employeeNumber: "EMP-ADMIN-001",
    firstName: "Alex",
    lastName: "Morgan",
    middleName: "J",
    fullName: "Alex (J) Morgan",
    jobPosition: "Operations Director & System Admin",
    workEmail: "admin@dispatch.local",
    personalEmail: "alex.morgan.personal@example.com",
    workPhonePhone: "613-555-0100",
    mobilePhone: "613-555-0101",
    preferredPhone: "613-555-0100",
    preferredEmail: "admin@dispatch.local",
    dateHired: "2021-03-15",
    isActive: true,
    personalAddress: "100 Fleet Operations Blvd, Suite 200, Ottawa, ON",
    yardId: "HQ-Central",
    role: "admin",
    employeeContacts: [
      {
        contactId: "EC-ADMIN-1",
        contactName: "Sarah Morgan",
        relationship: "Spouse",
        mobilePhone: "613-555-0102",
        primaryContact: true,
        active: true
      }
    ]
  },
  {
    id: "EMP-1002",
    employeeNumber: "EMP-1002",
    firstName: "Sarah",
    lastName: "Connor",
    fullName: "Sarah Connor",
    jobPosition: "Head Dispatcher",
    workEmail: "sarah.c@dispatch.local",
    workPhonePhone: "613-555-0201",
    mobilePhone: "613-555-0202",
    preferredPhone: "613-555-0201",
    preferredEmail: "sarah.c@dispatch.local",
    dateHired: "2021-08-10",
    isActive: true,
    personalAddress: "245 Bank St, Ottawa, ON",
    yardId: "HQ-Central",
    role: "dispatcher",
    employeeContacts: [
      {
        contactId: "EC-1002-1",
        contactName: "John Connor",
        relationship: "Son",
        mobilePhone: "613-555-0203",
        primaryContact: true,
        active: true
      }
    ]
  },
  {
    id: "EMP-1003",
    employeeNumber: "EMP-1003",
    firstName: "Marcus",
    lastName: "Vance",
    fullName: "Marcus Vance",
    jobPosition: "Yard Supervisor",
    workEmail: "marcus.v@dispatch.local",
    workPhonePhone: "613-555-0301",
    mobilePhone: "613-555-0302",
    preferredPhone: "613-555-0301",
    preferredEmail: "marcus.v@dispatch.local",
    dateHired: "2022-01-20",
    isActive: true,
    personalAddress: "780 Industrial Ave, Ottawa, ON",
    yardId: "Yard-East",
    role: "supervisor"
  },
  {
    id: "EMP-2001",
    employeeNumber: "EMP-2001",
    firstName: "David",
    lastName: "Miller",
    middleName: "Robert",
    fullName: "David (Robert) Miller",
    jobPosition: "Senior School Bus Driver",
    personalEmail: "david.m.driver@gmail.com",
    mobilePhone: "613-555-0401",
    preferredPhone: "613-555-0401",
    preferredEmail: "david.m.driver@gmail.com",
    dateHired: "2022-04-12",
    isActive: true,
    personalAddress: "45 Meadowlands Dr, Nepean, ON",
    yardId: "Yard-West",
    role: "driver",
    driverLicense: {
      licenseId: "M1234-56789-01234",
      expirationDate: new Date(Date.now() + 14 * 86400000).toISOString(), // 14 days left! Expiring soon alert
      licenseClass: "Class B with Z",
      licenseCondition: "Corrective Lenses",
      mvid: "MVID-99812"
    },
    employeeContacts: [
      {
        contactId: "EC-2001-1",
        contactName: "Rachel Miller",
        relationship: "Spouse",
        mobilePhone: "613-555-0405",
        primaryContact: true,
        active: true
      }
    ]
  },
  {
    id: "EMP-2002",
    employeeNumber: "EMP-2002",
    firstName: "Emily",
    lastName: "Zhang",
    fullName: "Emily Zhang",
    jobPosition: "School Bus Driver",
    personalEmail: "emily.zhang92@example.com",
    mobilePhone: "613-555-0501",
    preferredPhone: "613-555-0501",
    preferredEmail: "emily.zhang92@example.com",
    dateHired: "2023-02-01",
    isActive: true,
    personalAddress: "1280 Baseline Rd, Ottawa, ON",
    yardId: "Yard-East",
    role: "driver",
    driverLicense: {
      licenseId: "Z9876-54321-12345",
      expirationDate: "2028-10-15T00:00:00Z",
      licenseClass: "Class B",
      licenseCondition: "None",
      mvid: "MVID-88741"
    }
  },
  {
    id: "EMP-2003",
    employeeNumber: "EMP-2003",
    firstName: "James",
    lastName: "Wilson",
    fullName: "James Wilson",
    jobPosition: "School Bus Driver",
    personalEmail: "jwilson.transit@example.com",
    mobilePhone: "613-555-0601",
    preferredPhone: "613-555-0601",
    preferredEmail: "jwilson.transit@example.com",
    dateHired: "2024-05-15",
    isActive: true,
    personalAddress: "320 St. Laurent Blvd, Ottawa, ON",
    yardId: "Yard-East",
    role: "driver",
    driverLicense: {
      licenseId: "W5544-33221-99887",
      expirationDate: "2027-11-20T00:00:00Z",
      licenseClass: "Class B with Z",
      licenseCondition: "None",
      mvid: "MVID-77631"
    }
  },
  {
    id: "EMP-2004",
    employeeNumber: "EMP-2004",
    firstName: "Robert",
    lastName: "Taylor",
    fullName: "Robert Taylor",
    jobPosition: "Fleet Mechanic & Relief Driver",
    personalEmail: "robert.taylor@example.com",
    mobilePhone: "613-555-0701",
    preferredPhone: "613-555-0701",
    preferredEmail: "robert.taylor@example.com",
    dateHired: "2021-11-05",
    isActive: true,
    personalAddress: "950 Merivale Rd, Ottawa, ON",
    yardId: "Yard-West",
    role: "staff",
    driverLicense: {
      licenseId: "T1122-33445-55667",
      expirationDate: "2029-06-30T00:00:00Z",
      licenseClass: "Class CZ",
      mvid: "MVID-66521"
    }
  }
];

export function calculateStats(employees: Employee[]): DashboardStats {
  const total = employees.length;
  const active = employees.filter((e) => e.isActive).length;
  const drivers = employees.filter((e) => e.jobPosition.toLowerCase().includes('driver')).length;
  const now = Date.now();
  const expiringSoon = employees.filter((e) => {
    if (!e.driverLicense?.expirationDate) return false;
    const diffDays = (new Date(e.driverLicense.expirationDate).getTime() - now) / 86400000;
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  const yardMap: Record<string, number> = {};
  employees.forEach((e) => {
    const y = e.yardId || 'Unassigned';
    yardMap[y] = (yardMap[y] || 0) + 1;
  });

  return {
    totalEmployees: total,
    activeEmployees: active,
    totalDrivers: drivers,
    licenseExpiringSoon: expiringSoon,
    yardDistribution: yardMap,
    timestamp: new Date().toISOString()
  };
}

let localCache: Employee[] = [...INITIAL_MOCK_EMPLOYEES];

export const EmployeeService = {
  async list(params?: {
    search?: string;
    jobPosition?: string;
    yardId?: string;
    activeOnly?: boolean;
    licenseDue?: boolean;
  }): Promise<Employee[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.jobPosition) query.set('jobPosition', params.jobPosition);
      if (params?.yardId) query.set('yardId', params.yardId);
      if (params?.activeOnly !== undefined) query.set('activeOnly', String(params.activeOnly));
      if (params?.licenseDue) query.set('licenseDue', 'true');

      const url = `/api/employees?${query.toString()}`;
      const data = await apiRequest<Employee[]>(url);
      if (Array.isArray(data)) {
        localCache = data;
        return data;
      }
    } catch (err) {
      console.warn("[EmployeeService.list] Server fetch notice (using cache fallback):", err);
    }

    // Local filter fallback
    return localCache.filter(e => {
      if (params?.activeOnly && !e.isActive) return false;
      if (params?.yardId && e.yardId !== params.yardId) return false;
      if (params?.jobPosition && e.jobPosition !== params.jobPosition) return false;
      if (params?.search) {
        const term = params.search.toLowerCase();
        const matches =
          e.fullName.toLowerCase().includes(term) ||
          e.employeeNumber.toLowerCase().includes(term) ||
          e.jobPosition.toLowerCase().includes(term) ||
          (e.mobilePhone && e.mobilePhone.includes(term));
        if (!matches) return false;
      }
      if (params?.licenseDue) {
        if (!e.driverLicense?.expirationDate) return false;
        const diffDays = (new Date(e.driverLicense.expirationDate).getTime() - Date.now()) / 86400000;
        if (diffDays > 30 || diffDays < 0) return false;
      }
      return true;
    });
  },

  async getById(id: string): Promise<Employee> {
    try {
      return await apiRequest<Employee>(`/api/employees/${id}`);
    } catch {
      const found = localCache.find(e => e.id === id || e.employeeNumber === id);
      if (found) return found;
      throw new Error(`Employee #${id} not found`);
    }
  },

  async create(employee: Partial<Employee>): Promise<Employee> {
    const created = await apiRequest<Employee>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(employee)
    });
    localCache.unshift(created);
    return created;
  },

  async update(id: string, updates: Partial<Employee>): Promise<Employee> {
    const updated = await apiRequest<Employee>(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    localCache = localCache.map(e => e.id === id || e.employeeNumber === id ? updated : e);
    return updated;
  },

  async delete(id: string): Promise<void> {
    await apiRequest(`/api/employees/${id}`, { method: 'DELETE' });
    localCache = localCache.filter(e => e.id !== id && e.employeeNumber !== id);
  },

  async getStats(): Promise<DashboardStats> {
    try {
      return await apiRequest<DashboardStats>('/api/employees/stats');
    } catch {
      const total = localCache.length;
      const active = localCache.filter(e => e.isActive).length;
      const drivers = localCache.filter(e => e.jobPosition.toLowerCase().includes('driver')).length;
      const expiringSoon = localCache.filter(e => {
        if (!e.driverLicense?.expirationDate) return false;
        const diffDays = (new Date(e.driverLicense.expirationDate).getTime() - Date.now()) / 86400000;
        return diffDays >= 0 && diffDays <= 30;
      }).length;

      const yardMap: Record<string, number> = {};
      localCache.forEach(e => {
        const y = e.yardId || 'Unassigned';
        yardMap[y] = (yardMap[y] || 0) + 1;
      });

      return {
        totalEmployees: total,
        activeEmployees: active,
        totalDrivers: drivers,
        licenseExpiringSoon: expiringSoon,
        yardDistribution: yardMap,
        timestamp: new Date().toISOString()
      };
    }
  },

  async setupAdmin(data: { email: string; password?: string; firstName?: string; lastName?: string; mobilePhone?: string }) {
    return await apiRequest('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Real-time Firestore onSnapshot listener
  subscribeToEmployees(onUpdate: (employees: Employee[]) => void, onError?: (err: any) => void): () => void {
    if (db) {
      try {
        const collRef = collection(db, 'employees');
        const unsubscribe = onSnapshot(collRef, (snapshot) => {
          const items: Employee[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as any;

            let dateHiredStr: string | undefined = undefined;
            if (data.dateHired) {
              if (typeof data.dateHired.toDate === 'function') {
                dateHiredStr = data.dateHired.toDate().toISOString();
              } else if (typeof data.dateHired.seconds === 'number') {
                dateHiredStr = new Date(data.dateHired.seconds * 1000).toISOString();
              } else if (typeof data.dateHired === 'string') {
                dateHiredStr = data.dateHired;
              }
            }

            let driverLicense = data.driverLicense;
            if (driverLicense && driverLicense.expirationDate) {
              let expStr = driverLicense.expirationDate;
              if (typeof expStr.toDate === 'function') {
                expStr = expStr.toDate().toISOString();
              } else if (typeof expStr.seconds === 'number') {
                expStr = new Date(expStr.seconds * 1000).toISOString();
              }
              driverLicense = {
                ...driverLicense,
                expirationDate: expStr
              };
            }

            items.push({
              ...data,
              id: doc.id,
              employeeNumber: data.employeeNumber || doc.id,
              dateHired: dateHiredStr,
              driverLicense
            });
          });
          localCache = items;
          onUpdate(items);
        }, (error) => {
          console.warn("[Firestore Realtime onSnapshot Notice]:", error);
          if (onError) onError(error);
        });
        return unsubscribe;
      } catch (e) {
        console.warn("[Firestore onSnapshot init notice]:", e);
        if (onError) onError(e);
      }
    } else {
      if (onError) onError(new Error("Firestore DB not initialized"));
    }
    return () => {};
  }
};
