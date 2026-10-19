import { apiRequest } from './api';
import {
  BusRoutePayrollRate,
  SchoolBoardBaseRatesDTO,
  PayrollLookups,
  RateCalculationRequest,
  RateCalculationResponse,
} from '../types/payroll';

export const PayrollService = {
  /**
   * Fetches base rates aggregated by school board (Driver & Attendant AM, Midday, PM)
   */
  getSchoolBoardBaseRates: async (): Promise<SchoolBoardBaseRatesDTO[]> => {
    try {
      return await apiRequest<SchoolBoardBaseRatesDTO[]>('/api/payroll-rates/school-boards');
    } catch {
      return await apiRequest<SchoolBoardBaseRatesDTO[]>('/api/public/payroll-rates/school-boards');
    }
  },

  /**
   * Fetches all custom/override rates (Route, Shift, or Employee specific)
   */
  getCustomRates: async (): Promise<BusRoutePayrollRate[]> => {
    try {
      return await apiRequest<BusRoutePayrollRate[]>('/api/payroll-rates/custom');
    } catch {
      return await apiRequest<BusRoutePayrollRate[]>('/api/public/payroll-rates/custom');
    }
  },

  /**
   * Fetches dropdown lookup data (boards, active routes, shifts, employees, job titles, shift types)
   */
  getLookups: async (): Promise<PayrollLookups> => {
    try {
      return await apiRequest<PayrollLookups>('/api/payroll-rates/lookups');
    } catch {
      return await apiRequest<PayrollLookups>('/api/public/payroll-rates/lookups');
    }
  },

  /**
   * Creates a new payroll rate or override rule
   */
  createRate: async (rate: Partial<BusRoutePayrollRate>): Promise<BusRoutePayrollRate> => {
    return await apiRequest<BusRoutePayrollRate>('/api/payroll-rates', {
      method: 'POST',
      body: JSON.stringify(rate),
    });
  },

  /**
   * Updates an existing payroll rate
   */
  updateRate: async (id: string, rate: Partial<BusRoutePayrollRate>): Promise<BusRoutePayrollRate> => {
    return await apiRequest<BusRoutePayrollRate>(`/api/payroll-rates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(rate),
    });
  },

  /**
   * Deletes a payroll rate
   */
  deleteRate: async (id: string): Promise<void> => {
    await apiRequest<{ message: string }>(`/api/payroll-rates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
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
