import { apiRequest } from './api';
import {
  DashboardPreferences,
  normalizeDashboardPreferences,
} from '../utils/dashboardPreferencesUtils';

export const userPreferencesService = {
  getDashboardPreferences: async (userId?: string): Promise<DashboardPreferences> => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const data = await apiRequest<DashboardPreferences>(
      `/api/dispatch/user-preferences/dashboard${query}`
    );
    return normalizeDashboardPreferences(data);
  },

  saveDashboardPreferences: async (
    prefs: DashboardPreferences
  ): Promise<DashboardPreferences> => {
    const data = await apiRequest<DashboardPreferences>(
      '/api/dispatch/user-preferences/dashboard',
      {
        method: 'PUT',
        body: JSON.stringify({
          userId: prefs.userId,
          cardOrder: prefs.cardOrder,
          hiddenCards: prefs.hiddenCards,
        }),
      }
    );
    return normalizeDashboardPreferences(data);
  },
};
