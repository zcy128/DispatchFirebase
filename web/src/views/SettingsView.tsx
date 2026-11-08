import React, { Suspense, memo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { isDemoMode } from '../config/appMode';
import { ComplianceSettingsSection } from '../components/settings/ComplianceSettingsSection';
import { ThemeSettingsSection } from '../components/settings/ThemeSettingsSection';
import { ReminderSettingsSection } from '../components/settings/ReminderSettingsSection';
import { ErrorAlertSettingsSection } from '../components/settings/ErrorAlertSettingsSection';
import { RouteOptSettingsSection } from '../components/settings/RouteOptSettingsSection';
import { AdminAccountSection } from '../components/settings/AdminAccountSection';
import { PlatformInfoSections } from '../components/settings/PlatformInfoSections';
import { AiCopilotSection } from '../components/settings/AiCopilotSection';
import { McpSettingsSection } from '../components/settings/McpSettingsSection';

const SimulationSettingsSection = React.lazy(() =>
  import('../components/settings/SimulationSettingsSection').then((module) => ({
    default: module.SimulationSettingsSection,
  }))
);

export const SettingsView = memo(function SettingsView() {
  const { isFrench } = useI18n();

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {isFrench ? 'Paramètres système et identité' : 'System & Identity Settings'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {isFrench
            ? 'Configuration de la juridiction réglementaire, plan d\'entretien écrit, identifiants administrateur et base de données Firestore.'
            : 'Identity gateway configuration, administrator credentials, and Firebase Firestore master database link.'}
        </p>
      </div>

      <ComplianceSettingsSection />
      {isDemoMode ? (
        <Suspense fallback={<p className="text-xs text-slate-500">Loading simulation settings...</p>}>
          <SimulationSettingsSection />
        </Suspense>
      ) : null}
      {isDemoMode ? <ThemeSettingsSection /> : null}
      <ReminderSettingsSection />
      <ErrorAlertSettingsSection />
      <RouteOptSettingsSection />
      <AdminAccountSection />
      <PlatformInfoSections />
      <AiCopilotSection />
      <McpSettingsSection />

      <p className="pt-2 pb-6 text-center text-[11px] font-mono text-slate-500">
        Version {__APP_VERSION__}
      </p>
    </div>
  );
});
