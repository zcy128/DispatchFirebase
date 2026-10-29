import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import {
  BusRoutePayrollRate,
  SchoolBoardBaseRatesDTO,
  PayrollLookups,
  RateCalculationRequest,
  RateCalculationResponse,
  SchoolBoardJobRates,
  SchoolBoardShiftRate,
} from '../types/payroll';
import { SchoolBoard } from '../types/school';

const LOCAL_STORAGE_BOARD_RATES = 'dispatch_payroll_board_rates';
const LOCAL_STORAGE_CUSTOM_RATES = 'dispatch_payroll_custom_rates';
const LOCAL_STORAGE_LOOKUPS = 'dispatch_payroll_lookups';

let memoryBoardRates: SchoolBoardBaseRatesDTO[] | null = null;
let memoryCustomRates: BusRoutePayrollRate[] | null = null;
let memoryLookups: PayrollLookups | null = null;

export const PayrollService = {
  /**
   * Synchronous cache reader for School Board Base Rates (memory -> localStorage)
   */
  getCachedBoardRates: (): SchoolBoardBaseRatesDTO[] => {
    if (memoryBoardRates && memoryBoardRates.length > 0) return memoryBoardRates;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BOARD_RATES);
      if (raw) {
        memoryBoardRates = JSON.parse(raw);
        return memoryBoardRates || [];
      }
    } catch {}
    return [];
  },

  /**
   * Synchronous cache writer for School Board Base Rates (memory + localStorage)
   */
  setCachedBoardRates: (rates: SchoolBoardBaseRatesDTO[]): void => {
    memoryBoardRates = rates;
    try {
      localStorage.setItem(LOCAL_STORAGE_BOARD_RATES, JSON.stringify(rates));
    } catch (e) {
      console.warn('[PayrollService] Failed to cache board rates:', e);
    }
  },

  /**
   * Synchronous cache reader for Custom Payroll Rates
   */
  getCachedCustomRates: (): BusRoutePayrollRate[] => {
    if (memoryCustomRates && memoryCustomRates.length > 0) return memoryCustomRates;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CUSTOM_RATES);
      if (raw) {
        memoryCustomRates = JSON.parse(raw);
        return memoryCustomRates || [];
      }
    } catch {}
    return [];
  },

  /**
   * Synchronous cache writer for Custom Payroll Rates
   */
  setCachedCustomRates: (rates: BusRoutePayrollRate[]): void => {
    memoryCustomRates = rates;
    try {
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_RATES, JSON.stringify(rates));
    } catch (e) {
      console.warn('[PayrollService] Failed to cache custom rates:', e);
    }
  },

  /**
   * Synchronous cache reader for Payroll Lookups
   */
  getCachedLookups: (): PayrollLookups | null => {
    if (memoryLookups) return memoryLookups;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_LOOKUPS);
      if (raw) {
        memoryLookups = JSON.parse(raw);
        return memoryLookups;
      }
    } catch {}
    return null;
  },

  /**
   * Synchronous cache writer for Payroll Lookups
   */
  setCachedLookups: (lookups: PayrollLookups): void => {
    memoryLookups = lookups;
    try {
      localStorage.setItem(LOCAL_STORAGE_LOOKUPS, JSON.stringify(lookups));
    } catch (e) {
      console.warn('[PayrollService] Failed to cache lookups:', e);
    }
  },

  /**
   * Real-time subscription to busroute_payroll_rates in Firestore with IndexedDB local cache
   */
  subscribeToPayrollRates: (
    onUpdate: (rates: BusRoutePayrollRate[]) => void,
    onError?: (err: Error) => void
  ) => {
    // Deliver local cache immediately to eliminate wait time
    const initialCustom = PayrollService.getCachedCustomRates();
    if (initialCustom && initialCustom.length > 0) {
      onUpdate(initialCustom);
    }

    if (!db) {
      PayrollService.getCustomRates().then(onUpdate).catch(onError);
      return () => {};
    }
    try {
      const collRef = collection(db, 'busroute_payroll_rates');
      return onSnapshot(
        collRef,
        async (snapshot) => {
          if (snapshot.empty) {
            // First time seeding if Firestore is empty
            try {
              const customs = await PayrollService.getCustomRates();
              if (customs && customs.length > 0) {
                onUpdate(customs);
                if (db) {
                  const firestore = db;
                  const batch = writeBatch(firestore);
                  let count = 0;
                  customs.forEach((r) => {
                    if (r.id) {
                      batch.set(doc(firestore, 'busroute_payroll_rates', r.id), r);
                      count++;
                    }
                  });
                  if (count > 0) {
                    await batch.commit();
                  }
                }
              }
            } catch (seedErr) {
              console.warn('[PayrollService] Seed notice:', seedErr);
            }
            return;
          }

          const list: BusRoutePayrollRate[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as BusRoutePayrollRate;
            list.push({ ...data, id: d.id });
          });
          PayrollService.setCachedCustomRates(list);
          onUpdate(list);
        },
        (error) => {
          console.warn('[PayrollService] subscribeToPayrollRates notice:', error);
          if (onError) onError(error);
        }
      );
    } catch (e) {
      console.error('[PayrollService] subscribeToPayrollRates error:', e);
      return () => {};
    }
  },

  /**
   * Evaluates and aggregates base rates per school board from in-memory rates
   */
  aggregateSchoolBoardBaseRates: (
    boards: SchoolBoard[],
    rates: BusRoutePayrollRate[]
  ): SchoolBoardBaseRatesDTO[] => {
    return boards.map((b) => {
      const emptyJobRates = (): SchoolBoardJobRates => ({
        am: {},
        midday: {},
        pm: {},
        all: {},
      });

      const dto: SchoolBoardBaseRatesDTO = {
        schoolBoardId: b.schoolBoardId,
        schoolBoardName: b.schoolBoardName,
        schoolBoardCode: b.schoolBoardCode,
        driver: emptyJobRates(),
        attendant: emptyJobRates(),
      };

      for (const r of rates) {
        if (r.schoolBoardId !== b.schoolBoardId) continue;
        // Base rate only: no route, shift, or employee override
        if (r.routeId || r.shiftId || r.employeeId) continue;

        const job = (r.jobTitle || '').toLowerCase().trim();
        const shift = (r.shiftType || '').toUpperCase().trim();
        const shiftRate: SchoolBoardShiftRate = {
          rateId: r.id,
          payRate: r.payRate,
          eiHours: r.eiHours,
          effectiveDate: r.effectiveDate,
          retireDate: r.retireDate,
        };

        const targetJob = job === 'attendant' ? dto.attendant : job === 'driver' ? dto.driver : null;
        if (targetJob) {
          if (shift === 'AM') targetJob.am = shiftRate;
          else if (shift === 'MIDDAY') targetJob.midday = shiftRate;
          else if (shift === 'PM') targetJob.pm = shiftRate;
          else if (shift === 'ALL') targetJob.all = shiftRate;
        }
      }
      return dto;
    });
  },

  /**
   * Filters custom overrides from in-memory rates
   */
  filterCustomRates: (rates: BusRoutePayrollRate[]): BusRoutePayrollRate[] => {
    return rates.filter((r) => {
      return (
        r.routeId != null ||
        r.shiftId != null ||
        r.employeeId != null ||
        (r.weekDays && r.weekDays !== 'Weekdays' && r.weekDays !== 'MTWRF' && r.weekDays !== 'ALL')
      );
    });
  },

  /**
   * Fetches base rates aggregated by school board (Driver & Attendant AM, Midday, PM) with caching
   */
  getSchoolBoardBaseRates: async (): Promise<SchoolBoardBaseRatesDTO[]> => {
    try {
      const res = await apiRequest<SchoolBoardBaseRatesDTO[]>('/api/payroll-rates/school-boards');
      if (res && res.length > 0) {
        PayrollService.setCachedBoardRates(res);
      }
      return res;
    } catch {
      try {
        const res = await apiRequest<SchoolBoardBaseRatesDTO[]>('/api/public/payroll-rates/school-boards');
        if (res && res.length > 0) {
          PayrollService.setCachedBoardRates(res);
        }
        return res;
      } catch (fallbackErr) {
        const cached = PayrollService.getCachedBoardRates();
        if (cached && cached.length > 0) return cached;
        throw fallbackErr;
      }
    }
  },

  /**
   * Fetches all custom/override rates (Route, Shift, or Employee specific) with caching
   */
  getCustomRates: async (): Promise<BusRoutePayrollRate[]> => {
    try {
      const res = await apiRequest<BusRoutePayrollRate[]>('/api/payroll-rates/custom');
      if (res && res.length > 0) {
        PayrollService.setCachedCustomRates(res);
      }
      return res;
    } catch {
      try {
        const res = await apiRequest<BusRoutePayrollRate[]>('/api/public/payroll-rates/custom');
        if (res && res.length > 0) {
          PayrollService.setCachedCustomRates(res);
        }
        return res;
      } catch (fallbackErr) {
        const cached = PayrollService.getCachedCustomRates();
        if (cached && cached.length > 0) return cached;
        throw fallbackErr;
      }
    }
  },

  /**
   * Fetches dropdown lookup data with caching
   */
  getLookups: async (): Promise<PayrollLookups> => {
    try {
      const res = await apiRequest<PayrollLookups>('/api/payroll-rates/lookups');
      if (res) {
        PayrollService.setCachedLookups(res);
      }
      return res;
    } catch {
      try {
        const res = await apiRequest<PayrollLookups>('/api/public/payroll-rates/lookups');
        if (res) {
          PayrollService.setCachedLookups(res);
        }
        return res;
      } catch (fallbackErr) {
        const cached = PayrollService.getCachedLookups();
        if (cached) return cached;
        throw fallbackErr;
      }
    }
  },

  /**
   * Creates a new payroll rate or override rule
   */
  createRate: async (rate: Partial<BusRoutePayrollRate>): Promise<BusRoutePayrollRate> => {
    try {
      const created = await apiRequest<BusRoutePayrollRate>('/api/payroll-rates', {
        method: 'POST',
        body: JSON.stringify(rate),
      });
      return created;
    } catch (apiErr) {
      if (db) {
        const id = rate.id || `PR-${Date.now()}`;
        const payload: BusRoutePayrollRate = {
          ...rate,
          id,
          effectiveDate: rate.effectiveDate || new Date().toISOString().split('T')[0],
          schoolBoardId: rate.schoolBoardId || 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'busroute_payroll_rates', id), payload, { merge: true });
        return payload;
      }
      throw apiErr;
    }
  },

  /**
   * Updates an existing payroll rate
   */
  updateRate: async (id: string, rate: Partial<BusRoutePayrollRate>): Promise<BusRoutePayrollRate> => {
    try {
      const updated = await apiRequest<BusRoutePayrollRate>(`/api/payroll-rates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(rate),
      });
      return updated;
    } catch (apiErr) {
      if (db) {
        const payload = {
          ...rate,
          id,
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'busroute_payroll_rates', id), payload, { merge: true });
        return payload as BusRoutePayrollRate;
      }
      throw apiErr;
    }
  },

  /**
   * Deletes a payroll rate
   */
  deleteRate: async (id: string): Promise<void> => {
    try {
      await apiRequest<{ message: string }>(`/api/payroll-rates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (apiErr) {
      if (db) {
        await deleteDoc(doc(db, 'busroute_payroll_rates', id));
        return;
      }
      throw apiErr;
    }
  },

  /**
   * Simulates the 4-tier rate resolution hierarchy
   */
  calculateRate: async (req: RateCalculationRequest): Promise<RateCalculationResponse> => {
    try {
      return await apiRequest<RateCalculationResponse>('/api/payroll-rates/calculate', {
        method: 'POST',
        body: JSON.stringify(req),
      });
    } catch {
      return await apiRequest<RateCalculationResponse>('/api/public/payroll-rates/calculate', {
        method: 'POST',
        body: JSON.stringify(req),
      });
    }
  },
};
