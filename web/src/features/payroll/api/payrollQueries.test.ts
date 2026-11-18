import { describe, expect, it } from 'vitest';
import { PayrollDepartmentLogRecord } from '../../../types/dispatch';
import { buildPayrollLogsSignature, payrollKeys } from './payrollQueries';

describe('payrollQueries', () => {
  it('builds deterministic query keys per date', () => {
    expect(payrollKeys.all).toEqual(['payroll']);
    expect(payrollKeys.departmentLogs('2026-11-18')).toEqual([
      'payroll',
      'department-logs',
      '2026-11-18',
    ]);
  });

  it('computes signature reflecting payAmount, eiHours, status, and updatedAt', () => {
    const baseRecord = {
      id: 'log-1',
      payAmount: 120.5,
      eiHours: 4,
      status: 'clean',
      updatedAt: '2026-11-18T10:00:00Z',
    } as PayrollDepartmentLogRecord;

    const sig1 = buildPayrollLogsSignature([baseRecord]);
    const sig2 = buildPayrollLogsSignature([{ ...baseRecord, payAmount: 125.0 }]);
    const sig3 = buildPayrollLogsSignature([baseRecord]);

    expect(sig1).toBe(sig3);
    expect(sig1).not.toBe(sig2);
  });
});
