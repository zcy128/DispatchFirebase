import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DefectService } from '../../../services/defectService';
import { VehicleDefectReport } from '../../../types/defect';

export type DefectTimeRange = '6months' | '1year' | 'all';

/**
 * Query key factory for fleet maintenance & defect reports.
 */
export const fleetKeys = {
  all: ['fleet'] as const,
  defects: (timeRange: DefectTimeRange, query: string) =>
    [...fleetKeys.all, 'defects', timeRange, query.trim()] as const,
};

/**
 * Builds query parameters for DefectService.listDefects based on time range and search query.
 */
export function buildDefectListParams(
  timeRange: DefectTimeRange,
  searchQuery: string
): Record<string, string> {
  const trimmed = searchQuery.trim();
  const params: Record<string, string> = { timeRange };
  if (trimmed) {
    params.vehicleUnit = trimmed;
    params.query = trimmed;
  }
  return params;
}

/**
 * Queries vehicle defect reports with real-time Firestore sync in 6-month hot mode
 * and TanStack Query caching for 1-year / all-history searches.
 */
export function useDefectReportsQuery(timeRange: DefectTimeRange, searchQuery: string) {
  const queryClient = useQueryClient();
  const trimmedQuery = searchQuery.trim();
  const enabled = timeRange !== 'all' || Boolean(trimmedQuery);
  const queryKey = fleetKeys.defects(timeRange, timeRange === '6months' ? '' : trimmedQuery);

  const query = useQuery<VehicleDefectReport[], Error>({
    queryKey,
    enabled,
    queryFn: async () => {
      const data = await DefectService.listDefects(buildDefectListParams(timeRange, trimmedQuery));
      return Array.isArray(data) ? data : [];
    },
  });

  useEffect(() => {
    if (timeRange !== '6months') return;

    const unsubscribe = DefectService.subscribeToDefects((data) => {
      queryClient.setQueryData<VehicleDefectReport[]>(
        fleetKeys.defects('6months', ''),
        Array.isArray(data) ? data : []
      );
    });

    return () => {
      unsubscribe();
    };
  }, [timeRange, queryClient]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    void query.refetch();
  }, [enabled, query.refetch]);

  const updateReportInCache = useCallback(
    (updated: VehicleDefectReport) => {
      queryClient.setQueryData<VehicleDefectReport[]>(queryKey, (prev = []) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
    },
    [queryClient, queryKey]
  );

  return {
    reports: enabled ? (query.data ?? []) : [],
    loading: enabled && query.isLoading,
    refresh,
    updateReportInCache,
  };
}
