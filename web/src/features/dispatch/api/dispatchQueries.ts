import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DispatchService } from '../../../services/dispatchService';
import { DispatchChangeLog } from '../../../types/dispatch';

export interface ChangeLogFilterParams {
  routeNo?: string;
  employee?: string;
  scope?: string;
}

/**
 * Query key factory for dispatch domain server state.
 */
export const dispatchKeys = {
  all: ['dispatch'] as const,
  changeLogs: (date: string, filters?: ChangeLogFilterParams) =>
    [
      ...dispatchKeys.all,
      'change-logs',
      date,
      filters?.routeNo || '',
      filters?.employee || '',
      filters?.scope || '',
    ] as const,
};

/**
 * Normalizes optional change-log filters into a stable object or undefined.
 */
export function normalizeChangeLogFilters(
  filters?: ChangeLogFilterParams
): ChangeLogFilterParams | undefined {
  if (!filters) return undefined;
  if (!filters.routeNo && !filters.employee && !filters.scope) return undefined;
  return {
    routeNo: filters.routeNo,
    employee: filters.employee,
    scope: filters.scope,
  };
}

/**
 * Subscribes to real-time dispatch change logs for a date and syncs updates into TanStack Query cache.
 */
export function useDispatchChangeLogsQuery(date: string, filters?: ChangeLogFilterParams) {
  const queryClient = useQueryClient();
  const normalizedFilters = normalizeChangeLogFilters(filters);
  const queryKey = dispatchKeys.changeLogs(date, normalizedFilters);

  const query = useQuery<DispatchChangeLog[], Error>({
    queryKey,
    enabled: Boolean(date),
    queryFn: async () => {
      const data = await DispatchService.listChangeLogs(date, normalizedFilters);
      return Array.isArray(data) ? data : [];
    },
  });

  useEffect(() => {
    if (!date) return;

    const unsubscribe = DispatchService.subscribeToChangeLogs(
      date,
      (updatedLogs) => {
        queryClient.setQueryData<DispatchChangeLog[]>(
          dispatchKeys.changeLogs(date, normalizedFilters),
          Array.isArray(updatedLogs) ? updatedLogs : []
        );
      },
      (err) => {
        console.warn('Realtime change logs subscription error, relying on TanStack Query:', err);
      },
      normalizedFilters
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [
    date,
    normalizedFilters?.routeNo,
    normalizedFilters?.employee,
    normalizedFilters?.scope,
    queryClient,
  ]);

  const refresh = useCallback(() => {
    if (!date) return;
    void query.refetch();
  }, [date, query.refetch]);

  return {
    logs: date ? (query.data ?? []) : [],
    loading: Boolean(date) && query.isLoading,
    error: query.error ? query.error.message || 'Failed to load dispatch change logs' : null,
    refresh,
  };
}
