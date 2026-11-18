import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DispatchService } from '../../../services/dispatchService';
import { PayrollDepartmentLogRecord } from '../../../types/dispatch';
import { logDispatchAction } from '../../../utils/dispatchLogger';

/**
 * Query key factory for payroll server state.
 */
export const payrollKeys = {
  all: ['payroll'] as const,
  departmentLogs: (date: string) => [...payrollKeys.all, 'department-logs', date] as const,
};

/**
 * Computes a lightweight signature for payroll department logs to avoid redundant cache writes.
 */
export function buildPayrollLogsSignature(logs: PayrollDepartmentLogRecord[]): string {
  return logs
    .map((item) => `${item.id}_${item.payAmount}_${item.eiHours}_${item.status}_${item.updatedAt}`)
    .join('|');
}

/**
 * Subscribes to real-time payroll department logs for a date and mirrors updates into TanStack Query cache.
 */
export function usePayrollDepartmentLogsQuery(date: string) {
  const queryClient = useQueryClient();
  const prevSignatureRef = useRef<string>('');
  const queryKey = payrollKeys.departmentLogs(date);

  const query = useQuery<PayrollDepartmentLogRecord[], Error>({
    queryKey,
    queryFn: async () => {
      const records = await DispatchService.listPayrollDepartmentLogs(date ? { date } : undefined);
      const safeList = Array.isArray(records) ? records : [];
      prevSignatureRef.current = buildPayrollLogsSignature(safeList);
      return safeList;
    },
  });

  useEffect(() => {
    prevSignatureRef.current = '';
    const unsubscribe = DispatchService.subscribeToPayrollDepartmentLogs(
      date,
      (updatedList) => {
        const safeList = Array.isArray(updatedList) ? updatedList : [];
        const sig = buildPayrollLogsSignature(safeList);
        if (sig !== prevSignatureRef.current) {
          prevSignatureRef.current = sig;
          queryClient.setQueryData<PayrollDepartmentLogRecord[]>(
            payrollKeys.departmentLogs(date),
            safeList
          );
        }
      },
      (err) => {
        console.warn('Realtime payroll log subscription error, relying on TanStack Query:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [date, queryClient]);

  const updateLogInCache = useCallback(
    (updated: PayrollDepartmentLogRecord) => {
      queryClient.setQueryData<PayrollDepartmentLogRecord[]>(
        payrollKeys.departmentLogs(date),
        (prev = []) => prev.map((item) => (item.id === updated.id ? updated : item))
      );
    },
    [date, queryClient]
  );

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);

  return {
    logs: query.data ?? [],
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? 'Failed to fetch payroll department records.' : null,
    refresh,
    updateLogInCache,
  };
}

/**
 * Mutation hook to synchronize clean daily dispatch payroll records for a given date.
 */
export function useSyncCleanPayrollsMutation(date: string, actorName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => DispatchService.syncCleanPayrollsForDate(date),
    onSuccess: (res) => {
      void logDispatchAction({
        date,
        type: 'Payroll Synced',
        detail: `Finance synced daily dispatch payroll records for ${date} (${res.synced} clean records synced)`,
        user: actorName,
      });
      void queryClient.invalidateQueries({ queryKey: payrollKeys.departmentLogs(date) });
    },
  });
}
