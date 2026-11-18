import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DispatchService } from '../../../services/dispatchService';
import { PreTripService } from '../../../services/pretripService';
import { VehicleService } from '../../../services/vehicleService';
import { DispatchShift } from '../../../types/dispatch';
import { PreTripInspection } from '../../../types/pretrip';
import { Vehicle } from '../../../types/vehicle';

export interface PreTripRosterData {
  vehicles: Vehicle[];
  shifts: DispatchShift[];
  inspections: PreTripInspection[];
}

/**
 * Query key factory for compliance & pre-trip inspection server state.
 */
export const complianceKeys = {
  all: ['compliance'] as const,
  pretrip: (date: string) => [...complianceKeys.all, 'pretrip', date] as const,
};

/**
 * Fetches vehicles, dispatch shifts, and pre-trip inspections for a date,
 * and mirrors live Firestore inspection updates into the TanStack Query cache for hot dates.
 */
export function usePreTripRosterQuery(selectedDate: string) {
  const queryClient = useQueryClient();
  const queryKey = complianceKeys.pretrip(selectedDate);

  const query = useQuery<PreTripRosterData, Error>({
    queryKey,
    enabled: Boolean(selectedDate),
    queryFn: async () => {
      const [vehicles, shifts, inspections] = await Promise.all([
        VehicleService.list().catch(() => []),
        DispatchService.list(selectedDate).catch(() => []),
        PreTripService.listInspections(selectedDate).catch(() => []),
      ]);
      return { vehicles, shifts, inspections };
    },
  });

  useEffect(() => {
    if (!selectedDate || PreTripService.isColdDate(selectedDate)) return;

    const unsubscribe = PreTripService.subscribeToDate(selectedDate, (liveInspections) => {
      queryClient.setQueryData<PreTripRosterData>(
        complianceKeys.pretrip(selectedDate),
        (prev) => ({
          vehicles: prev?.vehicles ?? [],
          shifts: prev?.shifts ?? [],
          inspections: liveInspections,
        })
      );
    });

    return () => {
      unsubscribe();
    };
  }, [selectedDate, queryClient]);

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);

  return {
    vehicles: query.data?.vehicles ?? [],
    shifts: query.data?.shifts ?? [],
    inspections: query.data?.inspections ?? [],
    loading: query.isLoading,
    refresh,
  };
}
