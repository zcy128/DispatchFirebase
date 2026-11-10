import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ComplianceProvider } from './contexts/ComplianceContext';
import './index.css';

// Unregister any stale Service Worker in local development to prevent aggressive asset caching
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <ComplianceProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ComplianceProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
