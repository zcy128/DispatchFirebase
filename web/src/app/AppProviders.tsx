import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';
import { ComplianceProvider } from '../contexts/ComplianceContext';
import { I18nProvider } from '../contexts/I18nContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { appQueryClient } from './queryClient';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Root provider composition for theming, localization, compliance, auth, and server state.
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={appQueryClient}>
      <ThemeProvider>
        <I18nProvider>
          <ComplianceProvider>
            <AuthProvider>{children}</AuthProvider>
          </ComplianceProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
