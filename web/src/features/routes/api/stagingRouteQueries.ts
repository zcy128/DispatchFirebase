import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BusPlannerService, StagingRoute } from '../../../services/busplannerService';

export interface StagingRoutesSummary {
  routes: StagingRoute[];
  totals: {
    routes: number;
    shifts: number;
    stops: number;
    students: number;
  };
}

/**
 * Query key factory for routes domain server state.
 */
export const routeKeys = {
  all: ['routes'] as const,
  staging: () => [...routeKeys.all, 'staging'] as const,
};

/**
 * Normalizes staging routes API response into routes array and summary totals.
 */
export function normalizeStagingRoutesResponse(list: {
  routes?: StagingRoute[];
  totalRoutes?: number;
  totalShifts?: number;
  totalStops?: number;
  totalStudents?: number;
}): StagingRoutesSummary {
  const routes = Array.isArray(list.routes) ? list.routes : [];
  return {
    routes,
    totals: {
      routes: list.totalRoutes || routes.length,
      shifts: list.totalShifts || 0,
      stops: list.totalStops || 0,
      students: list.totalStudents || 0,
    },
  };
}

/**
 * Queries staging routes from BusPlannerService with TanStack Query caching.
 */
export function useStagingRoutesQuery(errorFallbackMessage: string) {
  const query = useQuery<StagingRoutesSummary, Error>({
    queryKey: routeKeys.staging(),
    queryFn: async () => {
      const list = await BusPlannerService.listStagingRoutes();
      return normalizeStagingRoutesResponse(list);
    },
  });

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);

  return {
    routes: query.data?.routes ?? [],
    totals: query.data?.totals ?? { routes: 0, shifts: 0, stops: 0, students: 0 },
    loading: query.isLoading,
    error: query.error ? query.error.message || errorFallbackMessage : null,
    refresh,
  };
}
