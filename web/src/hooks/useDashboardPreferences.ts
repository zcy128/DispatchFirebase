import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { userPreferencesService } from '../services/userPreferencesService';
import {
  DashboardPreferences,
  createDefaultDashboardPreferences,
} from '../utils/dashboardPreferencesUtils';

export const dashboardPreferencesKeys = {
  byUser: (userId: string) => ['dashboard-preferences', userId] as const,
};

/**
 * Shared TanStack Query hook for per-user Dashboard & Quick Access preferences.
 * Keeps DashboardView and Sidebar synchronized in real time across the app.
 */
export function useDashboardPreferences() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const prefUserId = currentUser?.uid || currentUser?.employeeId || '';

  const defaultPrefs = useMemo(() => createDefaultDashboardPreferences(), []);

  const query = useQuery<DashboardPreferences, Error>({
    queryKey: dashboardPreferencesKeys.byUser(prefUserId),
    enabled: Boolean(prefUserId),
    queryFn: async () => {
      const loaded = await userPreferencesService.getDashboardPreferences(prefUserId);
      return { ...loaded, userId: prefUserId };
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: DashboardPreferences) =>
      userPreferencesService.saveDashboardPreferences(payload),
    onMutate: (payload) => {
      if (prefUserId) {
        queryClient.setQueryData<DashboardPreferences>(
          dashboardPreferencesKeys.byUser(prefUserId),
          payload
        );
      }
    },
    onError: (err) => {
      console.warn('[useDashboardPreferences] Failed to save preferences:', err);
    },
  });

  const persistPrefs = useCallback(
    (nextPrefs: DashboardPreferences) => {
      const payload: DashboardPreferences = {
        ...nextPrefs,
        userId: prefUserId || nextPrefs.userId,
      };
      if (!payload.userId) return;
      saveMutation.mutate(payload);
    },
    [prefUserId, saveMutation]
  );

  return {
    prefs: query.data ?? defaultPrefs,
    isLoading: query.isLoading,
    isSaving: saveMutation.isPending,
    persistPrefs,
  };
}
