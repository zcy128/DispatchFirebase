import React, { Suspense, memo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { isDemoMode } from '../config/appMode';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
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
    <PageShell>
      <PageHeader
        title={isFrench ? 'Paramètres système et identité' : 'System & Identity Settings'}
        subtitle={
          isFrench
            ? 'Configuration de la juridiction réglementaire, plan d\'entretien écrit, identifiants administrateur et base de données Firestore.'
            : 'Identity gateway configuration, administrator credentials, and Firebase Firestore master database link.'
        }
      />

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
    </PageShell>
  );
});
