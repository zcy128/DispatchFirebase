import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { EmployeeService } from '../services/employeeService';
import { DispatchService } from '../services/dispatchService';
import { aiService } from '../services/aiService';
import { AICopilotStatus } from '../types/ai';
import { CheckInReminderSettings, SimulationSettings, SimulationRunResult } from '../types/dispatch';
import { RouteSettingsService, RouteOptimizationSettings } from '../services/routeSettingsService';
import { useCompliance } from '../contexts/ComplianceContext';
import { isDemoMode } from '../config/appMode';
import { BambooHRService, BambooHRTestReport, BambooWebhookEvent } from '../services/bamboohrService';
import { ZonarService, ZonarSerialReport, ZonarRouteWriteReport, ZonarTestReport } from '../services/zonarService';
import { OperatingProvince, ProvinceComplianceConfig } from '../types/compliance';
import {
  ShieldCheck,
  Database,
  Cloud,
  CheckCircle2,
  Sun,
  Moon,
  Palette,
  Check,
  Bell,
  Clock,
  Save,
  RotateCcw,
  AlertCircle,
  Wrench,
  Sparkles,
  Bot,
  Zap,
  Play,
  Calendar,
  Users,
  ClipboardCheck,
  Navigation,
  FileCheck
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { currentUser, isMockMode } = useAuth();
  const { t, isFrench } = useI18n();
  const { theme, setTheme } = useTheme();
  const [adminEmail, setAdminEmail] = useState('admin@dispatch.local');
  const [adminPassword, setAdminPassword] = useState('Admin@Dispatch2026!');
  const [provisionStatus, setProvisionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Operations Simulation settings
  const [simSettings, setSimSettings] = useState<SimulationSettings>({
    enabled: false,
    autoGenerateTime: '14:00',
    checkInWindowMinutes: 30,
    studentPickupWindowMinutes: 15,
    studentAbsentRate: 10,
    pretripWindowMinutes: 30,
  });
  const [simSaving, setSimSaving] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simStatus, setSimStatus] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [lastSimResult, setLastSimResult] = useState<SimulationRunResult | null>(null);

  // Check-in reminder settings
  const [reminderSettings, setReminderSettings] = useState<CheckInReminderSettings>({
    enabled: true,
    reminderGraceMinutes: 20,
    pretripReminderGraceMinutes: 60,
    reminderWindowStart: '06:00',
    reminderWindowEnd: '18:00',
  });
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AICopilotStatus | null>(null);

  const [bambooEnabled, setBambooEnabled] = useState(false);
  const [bambooDomain, setBambooDomain] = useState('');
  const [bambooKey, setBambooKey] = useState('');
  const [bambooKeySet, setBambooKeySet] = useState(false);
  const [bambooWebhookKey, setBambooWebhookKey] = useState('');
  const [bambooWebhookKeySet, setBambooWebhookKeySet] = useState(false);
  const [bambooDailyTime, setBambooDailyTime] = useState('02:00');
  const [bambooLastSyncAt, setBambooLastSyncAt] = useState('');
  const [bambooLastSyncCount, setBambooLastSyncCount] = useState(0);
  const [bambooEvents, setBambooEvents] = useState<BambooWebhookEvent[]>([]);
  const [bambooSaving, setBambooSaving] = useState(false);
  const [bambooTesting, setBambooTesting] = useState(false);
  const [bambooSyncing, setBambooSyncing] = useState(false);
  const [bambooStatus, setBambooStatus] = useState<string | null>(null);
  const [bambooError, setBambooError] = useState<string | null>(null);
  const [bambooReport, setBambooReport] = useState<BambooHRTestReport | null>(null);

  const [zonarEnabled, setZonarEnabled] = useState(false);
  const [zonarCustomer, setZonarCustomer] = useState('');
  const [zonarUsername, setZonarUsername] = useState('');
  const [zonarPassword, setZonarPassword] = useState('');
  const [zonarPasswordSet, setZonarPasswordSet] = useState(false);
  const [zonarBusyMinutes, setZonarBusyMinutes] = useState(1);
  const [zonarIdleMinutes, setZonarIdleMinutes] = useState(10);
  const [zonarSerialTime, setZonarSerialTime] = useState('03:00');
  const [zonarLastSerialAt, setZonarLastSerialAt] = useState('');
  const [zonarLastSerialCount, setZonarLastSerialCount] = useState(0);
  const [zonarSerialRunning, setZonarSerialRunning] = useState(false);
  const [zonarSerialReport, setZonarSerialReport] = useState<ZonarSerialReport | null>(null);
  const [zonarRouteRunning, setZonarRouteRunning] = useState(false);
  const [zonarRouteReport, setZonarRouteReport] = useState<ZonarRouteWriteReport | null>(null);
  const [zonarLastRouteAt, setZonarLastRouteAt] = useState('');
  const [zonarLastRouteCount, setZonarLastRouteCount] = useState(0);
  const [zonarLastSyncAt, setZonarLastSyncAt] = useState('');
  const [zonarLastSyncCount, setZonarLastSyncCount] = useState(0);
  const [zonarLastSyncMode, setZonarLastSyncMode] = useState('');
  const [zonarSaving, setZonarSaving] = useState(false);
  const [zonarTesting, setZonarTesting] = useState(false);
  const [zonarStatus, setZonarStatus] = useState<string | null>(null);
  const [zonarError, setZonarError] = useState<string | null>(null);
  const [zonarReport, setZonarReport] = useState<ZonarTestReport | null>(null);

  // Route Optimization & Dwell Time settings
  const [routeOptSettings, setRouteOptSettings] = useState<RouteOptimizationSettings>({
    defaultStopDwellMinutes: 3,
    averageSpeedKmH: 30,
    recalculateTimesDefault: true,
    includeDriverHomeDefault: false
  });
  const [routeOptSaving, setRouteOptSaving] = useState(false);
  const [routeOptStatus, setRouteOptStatus] = useState<string | null>(null);
  const [routeOptError, setRouteOptError] = useState<string | null>(null);

  // Operating Province & Semi-Annual Safety Compliance settings
  const { province, config: complianceConfig, isOntario, setProvince, updateConfig } = useCompliance();
  const [provForm, setProvForm] = useState<ProvinceComplianceConfig>(complianceConfig);
  const [provSaving, setProvSaving] = useState(false);
  const [provStatus, setProvStatus] = useState<string | null>(null);
  const [provError, setProvError] = useState<string | null>(null);

  useEffect(() => {
    setProvForm(complianceConfig);
  }, [complianceConfig]);

  const handleSelectProvince = async (newProv: OperatingProvince) => {
    if (newProv === province && provForm.province === newProv) return;
    setProvSaving(true);
    setProvStatus(null);
    setProvError(null);
    try {
      await setProvince(newProv);
      setProvStatus(
        isFrench
          ? `Juridiction d'exploitation changée pour ${newProv === 'QC' ? 'Québec (SAAQ / CTQ / PEP)' : 'Ontario (MTO / CVOR / DriveON)'}`
          : `Operating jurisdiction switched to ${newProv === 'QC' ? 'Québec (SAAQ / CTQ / PEP)' : 'Ontario (MTO / CVOR / DriveON)'}`
      );
      setTimeout(() => setProvStatus(null), 4000);
    } catch (err: any) {
      setProvError(err.message || (isFrench ? 'Échec du changement de province' : 'Failed to switch province'));
    } finally {
      setProvSaving(false);
    }
  };

  const handleSaveComplianceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvSaving(true);
    setProvStatus(null);
    setProvError(null);
    try {
      await updateConfig(provForm);
      setProvStatus(
        isFrench
          ? 'Paramètres de conformité et plan d\'entretien enregistrés avec succès.'
          : 'Compliance parameters saved successfully to cloud & local storage.'
      );
      setTimeout(() => setProvStatus(null), 3500);
    } catch (err: any) {
      setProvError(err.message || (isFrench ? 'Échec de l\'enregistrement' : 'Failed to save compliance settings'));
    } finally {
      setProvSaving(false);
    }
  };

  useEffect(() => {
    aiService.getStatus().then(setAiStatus).catch(console.error);

    RouteSettingsService.getSettings()
      .then(setRouteOptSettings)
      .catch((err) => console.error('Failed to load route optimization settings:', err));

    DispatchService.getSimulationSettings()
      .then((s) => {
        setSimSettings({
          enabled: s.enabled ?? false,
          autoGenerateTime: s.autoGenerateTime || '14:00',
          checkInWindowMinutes: s.checkInWindowMinutes || 30,
          studentPickupWindowMinutes: s.studentPickupWindowMinutes || 15,
          studentAbsentRate: s.studentAbsentRate || 10,
          pretripWindowMinutes: s.pretripWindowMinutes || 30,
          lastAutoGeneratedForDate: s.lastAutoGeneratedForDate,
          lastSimulatedDate: s.lastSimulatedDate,
          lastRunAt: s.lastRunAt,
          updatedAt: s.updatedAt,
        });
      })
      .catch((err) => console.error('Failed to load simulation settings in SettingsView:', err));

    DispatchService.getCheckInReminderSettings()
      .then((s) => {
        setReminderSettings({
          enabled: s.enabled ?? true,
          reminderGraceMinutes: s.reminderGraceMinutes || 20,
          pretripReminderGraceMinutes: s.pretripReminderGraceMinutes || 60,
          reminderWindowStart: s.reminderWindowStart || '06:00',
          reminderWindowEnd: s.reminderWindowEnd || '18:00',
          updatedAt: s.updatedAt,
        });
      })
      .catch((err) => console.error('Failed to load check-in reminder settings in SettingsView:', err));

    BambooHRService.getSettings()
      .then((s) => {
        setBambooEnabled(!!s.enabled);
        setBambooDomain(s.companyDomain || '');
        setBambooKeySet(!!s.apiKeyConfigured);
        setBambooWebhookKeySet(!!s.webhookKeyConfigured);
        setBambooDailyTime(s.dailySyncTime || '02:00');
        setBambooLastSyncAt(s.lastDailySyncAt || '');
        setBambooLastSyncCount(s.lastDailySyncCount || 0);
        setBambooKey('');
        setBambooWebhookKey('');
      })
      .catch((err) => console.error('Failed to load BambooHR settings:', err));

    BambooHRService.listWebhookEvents()
      .then((res) => setBambooEvents(res.events || []))
      .catch((err) => console.error('Failed to load BambooHR webhook events:', err));

    ZonarService.getSettings()
      .then((s) => {
        setZonarEnabled(!!s.enabled);
        setZonarCustomer(s.customer || '');
        setZonarUsername(s.username || '');
        setZonarPasswordSet(!!s.passwordConfigured);
        setZonarBusyMinutes(s.busyIntervalMinutes || 1);
        setZonarIdleMinutes(s.idleIntervalMinutes || 10);
        setZonarSerialTime(s.gpsSerialSyncTime || '03:00');
        setZonarLastSerialAt(s.lastGpsSerialSyncAt || '');
        setZonarLastSerialCount(s.lastGpsSerialCount || 0);
        setZonarLastRouteAt(s.lastRoutePreviewAt || '');
        setZonarLastRouteCount(s.lastRoutePreviewCount || 0);
        setZonarLastSyncAt(s.lastSyncAt || '');
        setZonarLastSyncCount(s.lastSyncCount || 0);
        setZonarLastSyncMode(s.lastSyncMode || '');
        setZonarPassword('');
      })
      .catch((err) => console.error('Failed to load Zonar settings:', err));
  }, []);

  const getOttawaDateStr = (offsetDays: number = 0): string => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = Number(parts.find((p) => p.type === 'year')?.value || now.getFullYear());
    const m = Number(parts.find((p) => p.type === 'month')?.value || now.getMonth() + 1);
    const d = Number(parts.find((p) => p.type === 'day')?.value || now.getDate());
    const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
    return dt.toISOString().slice(0, 10);
  };

  const handleToggleSimulation = async (enabled: boolean) => {
    const nextSettings: SimulationSettings = {
      ...simSettings,
      enabled,
      autoGenerateTime: simSettings.autoGenerateTime || '14:00',
      checkInWindowMinutes: Number(simSettings.checkInWindowMinutes) || 30,
      studentPickupWindowMinutes: Number(simSettings.studentPickupWindowMinutes) || 15,
      studentAbsentRate: Number(simSettings.studentAbsentRate) || 10,
      pretripWindowMinutes: Number(simSettings.pretripWindowMinutes) || 30,
    };
    setSimSettings(nextSettings);
    setSimSaving(true);
    setSimStatus(null);
    setSimError(null);
    try {
      const saved = await DispatchService.saveSimulationSettings(nextSettings);
      setSimSettings(saved);
      if (enabled) {
        setSimStatus(t.simulation.statusInitializing);
        const res = await DispatchService.runSimulation(getOttawaDateStr(0), true);
        setLastSimResult(res);
        const refreshed = await DispatchService.getSimulationSettings();
        setSimSettings(refreshed);
        setSimStatus(`${t.simulation.statusEnabledDonePrefix} (${res.date})!`);
      } else {
        setSimStatus(t.simulation.statusDisabled);
      }
      setTimeout(() => setSimStatus(null), 5000);
    } catch (err: any) {
      setSimError(err.message || t.simulation.errorSaveFailed);
    } finally {
      setSimSaving(false);
    }
  };

  const handleSaveSimSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimSaving(true);
    setSimStatus(null);
    setSimError(null);
    try {
      const saved = await DispatchService.saveSimulationSettings({
        ...simSettings,
        autoGenerateTime: simSettings.autoGenerateTime || '14:00',
        checkInWindowMinutes: Math.max(1, Math.min(120, Number(simSettings.checkInWindowMinutes) || 30)),
        studentPickupWindowMinutes: Math.max(1, Math.min(60, Number(simSettings.studentPickupWindowMinutes) || 15)),
        studentAbsentRate: Math.max(1, Math.min(100, Number(simSettings.studentAbsentRate) || 10)),
        pretripWindowMinutes: Math.max(1, Math.min(120, Number(simSettings.pretripWindowMinutes) || 30)),
      });
      setSimSettings(saved);
      setSimStatus(t.simulation.statusSaved);
      setTimeout(() => setSimStatus(null), 3500);
    } catch (err: any) {
      setSimError(err.message || t.simulation.errorSaveFailed);
    } finally {
      setSimSaving(false);
    }
  };

  const handleRunSimulationNow = async (offsetDays: number) => {
    const targetDate = getOttawaDateStr(offsetDays);
    setSimRunning(true);
    setSimStatus(null);
    setSimError(null);
    try {
      const res = await DispatchService.runSimulation(targetDate, true);
      setLastSimResult(res);
      const refreshed = await DispatchService.getSimulationSettings();
      setSimSettings(refreshed);
      setSimStatus(`${t.simulation.statusRunCompletedPrefix} ${targetDate} (${res.totalShifts} ${t.simulation.statusShiftsProcessedSuffix})`);
    } catch (err: any) {
      setSimError(err.message || t.simulation.errorRunFailed);
    } finally {
      setSimRunning(false);
    }
  };

  const handleSaveReminderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setReminderSaving(true);
    setReminderStatus(null);
    setReminderError(null);
    try {
      const saved = await DispatchService.saveCheckInReminderSettings({
        ...reminderSettings,
        reminderGraceMinutes: Math.max(1, Math.min(180, Number(reminderSettings.reminderGraceMinutes) || 20)),
        pretripReminderGraceMinutes: Math.max(1, Math.min(240, Number(reminderSettings.pretripReminderGraceMinutes) || 60)),
      });
      setReminderSettings(saved);
      setReminderStatus('Reminder settings saved successfully');
      setTimeout(() => setReminderStatus(null), 3500);
    } catch (err: any) {
      setReminderError(err.message || 'Failed to save settings');
    } finally {
      setReminderSaving(false);
    }
  };

  const handleSaveRouteOptSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setRouteOptSaving(true);
    setRouteOptStatus(null);
    setRouteOptError(null);
    try {
      const saved = await RouteSettingsService.saveSettings(routeOptSettings);
      setRouteOptSettings(saved);
      setRouteOptStatus(t.stops.routeSettingsSaved || 'Route optimization settings saved successfully.');
      setTimeout(() => setRouteOptStatus(null), 3500);
    } catch (err: any) {
      setRouteOptError(err.message || 'Failed to save route optimization settings');
    } finally {
      setRouteOptSaving(false);
    }
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setProvisionStatus(null);

    try {
      const res = (await EmployeeService.setupAdmin({
        email: adminEmail,
        password: adminPassword,
        firstName: 'System',
        lastName: 'Admin',
        mobilePhone: '613-555-0100'
      })) as any;
      setProvisionStatus(`Admin successfully registered: ${res?.email || adminEmail} [Employee: ${res?.employeeId || 'EMP-ADMIN-001'}]`);
    } catch (err: any) {
      setProvisionStatus(`Notice: ${err.message || 'Setup completed with local fallback'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBamboo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBambooSaving(true);
    setBambooStatus(null);
    setBambooError(null);
    try {
      const saved = await BambooHRService.saveSettings({
        enabled: bambooEnabled,
        companyDomain: bambooDomain.trim(),
        apiKey: bambooKey.trim() || undefined,
        webhookKey: bambooWebhookKey.trim() || undefined,
        dailySyncTime: bambooDailyTime || '02:00',
      });
      setBambooEnabled(!!saved.enabled);
      setBambooDomain(saved.companyDomain || '');
      setBambooKeySet(!!saved.apiKeyConfigured);
      setBambooWebhookKeySet(!!saved.webhookKeyConfigured);
      setBambooDailyTime(saved.dailySyncTime || '02:00');
      setBambooLastSyncAt(saved.lastDailySyncAt || '');
      setBambooLastSyncCount(saved.lastDailySyncCount || 0);
      setBambooKey('');
      setBambooWebhookKey('');
      const events = await BambooHRService.listWebhookEvents();
      setBambooEvents(events.events || []);
      setBambooStatus(
        isFrench
          ? 'Paramètres BambooHR enregistrés. La clé reste sur le serveur.'
          : 'BambooHR settings saved. The key stays on the server.'
      );
    } catch (err: any) {
      setBambooError(err.message || (isFrench ? 'Échec de l\'enregistrement' : 'Failed to save BambooHR settings'));
    } finally {
      setBambooSaving(false);
    }
  };

  const handleSaveZonar = async (e: React.FormEvent) => {
    e.preventDefault();
    setZonarSaving(true);
    setZonarStatus(null);
    setZonarError(null);
    try {
      const saved = await ZonarService.saveSettings({
        enabled: zonarEnabled,
        customer: zonarCustomer.trim(),
        username: zonarUsername.trim(),
        password: zonarPassword.trim() || undefined,
        busyIntervalMinutes: zonarBusyMinutes || 1,
        idleIntervalMinutes: zonarIdleMinutes || 10,
        gpsSerialSyncTime: zonarSerialTime || '03:00',
      });
      setZonarEnabled(!!saved.enabled);
      setZonarCustomer(saved.customer || '');
      setZonarUsername(saved.username || '');
      setZonarPasswordSet(!!saved.passwordConfigured);
      setZonarBusyMinutes(saved.busyIntervalMinutes || 1);
      setZonarIdleMinutes(saved.idleIntervalMinutes || 10);
      setZonarSerialTime(saved.gpsSerialSyncTime || '03:00');
      setZonarLastSerialAt(saved.lastGpsSerialSyncAt || '');
      setZonarLastSerialCount(saved.lastGpsSerialCount || 0);
      setZonarLastSyncAt(saved.lastSyncAt || '');
      setZonarLastSyncCount(saved.lastSyncCount || 0);
      setZonarLastSyncMode(saved.lastSyncMode || '');
      setZonarPassword('');
      setZonarStatus(
        isFrench
          ? 'Paramètres GPS enregistrés. Le mot de passe reste sur le serveur.'
          : 'GPS settings saved. The password stays on the server.'
      );
    } catch (err: any) {
      setZonarError(err.message || (isFrench ? 'Échec de l\'enregistrement GPS' : 'Failed to save GPS settings'));
    } finally {
      setZonarSaving(false);
    }
  };

  const handleSyncZonarSerials = async () => {
    setZonarSerialRunning(true);
    setZonarStatus(null);
    setZonarError(null);
    try {
      const report = await ZonarService.syncSerials();
      setZonarSerialReport(report);
      setZonarLastSerialCount(report.updatedCount || 0);
      setZonarStatus(report.message);
    } catch (err: any) {
      setZonarError(err.message || (isFrench ? 'La synchronisation du numero GPS a echoue' : 'GPS serial sync failed'));
    } finally {
      setZonarSerialRunning(false);
    }
  };

  const handlePreviewZonarRoutes = async () => {
    setZonarRouteRunning(true);
    setZonarStatus(null);
    setZonarError(null);
    try {
      const report = await ZonarService.previewRoutes();
      setZonarRouteReport(report);
      setZonarLastRouteCount(report.withRoute || 0);
      setZonarStatus(report.message);
    } catch (err: any) {
      setZonarError(err.message || (isFrench ? 'La synchronisation des lignes a echoue' : 'Route sync failed'));
    } finally {
      setZonarRouteRunning(false);
    }
  };

  const handleTestZonar = async () => {
    setZonarTesting(true);
    setZonarStatus(null);
    setZonarError(null);
    try {
      const report = await ZonarService.testSync();
      setZonarReport(report);
      setZonarLastSyncCount(report.locatedCount || 0);
      setZonarLastSyncMode(report.mode || '');
      setZonarStatus(report.message);
    } catch (err: any) {
      setZonarError(err.message || (isFrench ? 'Le test GPS a échoué' : 'GPS test failed'));
    } finally {
      setZonarTesting(false);
    }
  };

  const handleSyncBamboo = async () => {
    setBambooSyncing(true);
    setBambooStatus(null);
    setBambooError(null);
    try {
      const report = await BambooHRService.syncNow();
      setBambooLastSyncAt(report.syncedAt || '');
      setBambooLastSyncCount(report.directoryCount || 0);
      setBambooStatus(report.message);
      const events = await BambooHRService.listWebhookEvents();
      setBambooEvents(events.events || []);
    } catch (err: any) {
      setBambooError(err.message || (isFrench ? 'La synchronisation BambooHR a echoue' : 'BambooHR sync failed'));
    } finally {
      setBambooSyncing(false);
    }
  };

  const handleTestBamboo = async () => {
    setBambooTesting(true);
    setBambooStatus(null);
    setBambooError(null);
    setBambooReport(null);
    try {
      const report = await BambooHRService.testSync();
      setBambooReport(report);
      setBambooStatus(report.message);
    } catch (err: any) {
      setBambooError(err.message || (isFrench ? 'Le test BambooHR a échoué' : 'BambooHR test failed'));
    } finally {
      setBambooTesting(false);
    }
  };

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

      <form
        onSubmit={handleSaveBamboo}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              {isFrench ? 'Synchronisation BambooHR' : 'BambooHR Sync'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isFrench
                ? 'Test en lecture seule. Les employés lus chez BambooHR ne sont pas écrits dans la base de dispatch.'
                : 'Read-only test. Employees read from BambooHR are not written into the dispatch database.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={bambooEnabled}
              onChange={(e) => setBambooEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-2.5 text-xs font-bold text-white">
              {bambooEnabled
                ? isFrench
                  ? 'Synchronisation activée'
                  : 'Sync enabled'
                : isFrench
                ? 'Synchronisation désactivée'
                : 'Sync disabled'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {isFrench ? 'Sous-domaine BambooHR' : 'BambooHR subdomain'}
            </label>
            <input
              type="text"
              value={bambooDomain}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setBambooDomain(e.target.value)}
              placeholder="company"
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {isFrench ? 'Clé API' : 'API key'}
            </label>
            <input
              type="password"
              value={bambooKey}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(e) => setBambooKey(e.target.value)}
              placeholder={
                bambooKeySet
                  ? isFrench
                    ? 'Laisser vide pour conserver la clé enregistrée'
                    : 'Leave blank to keep the saved key'
                  : isFrench
                  ? 'Coller la clé API'
                  : 'Paste the API key'
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {bambooKeySet
                ? isFrench
                  ? 'Une clé est enregistrée sur le serveur. Elle n\'est pas renvoyée au navigateur.'
                  : 'A key is stored on the server. It is not sent back to the browser.'
                : isFrench
                ? 'La clé n\'est enregistrée que sur le serveur.'
                : 'The key is stored only on the server.'}
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            {isFrench ? 'Heure de synchronisation quotidienne' : 'Daily sync time'}
          </label>
          <input
            type="time"
            value={bambooDailyTime}
            onChange={(e) => setBambooDailyTime(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            {isFrench
              ? 'Heure d\'Ottawa. Tous les employés sont lus, sans filtre de poste, et ne sont pas écrits dans la base de dispatch.'
              : 'Ottawa time. Every employee is read, with no job-title filter, and none are written to the dispatch database.'}
            {bambooLastSyncAt
              ? ` ${isFrench ? 'Dernière lecture' : 'Last read'}: ${bambooLastSyncAt} (${bambooLastSyncCount}).`
              : ''}
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            {isFrench ? 'Clé du webhook' : 'Webhook key'}
          </label>
          <input
            type="password"
            value={bambooWebhookKey}
            autoComplete="new-password"
            spellCheck={false}
            onChange={(e) => setBambooWebhookKey(e.target.value)}
            placeholder={
              bambooWebhookKeySet
                ? isFrench
                  ? 'Laisser vide pour conserver la clé du webhook'
                  : 'Leave blank to keep the saved webhook key'
                : isFrench
                ? '12 caracteres ou plus, lettres et chiffres'
                : '12 or more letters, numbers, _ or -'
            }
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            {bambooWebhookKeySet
              ? isFrench
                ? 'Une clé de webhook est enregistrée sur le serveur.'
                : 'A webhook key is stored on the server.'
              : isFrench
              ? 'Choisissez une clé d\'au moins 12 caractères.'
              : 'Choose a key of at least 12 characters.'}
            {' '}
            {isFrench
              ? 'BambooHR envoie POST /api/bamboohr/webhook/{clé}. Les employés reçus sont lus, puis ignorés.'
              : 'BambooHR posts to /api/bamboohr/webhook/{key}. Received employees are read and not saved.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={bambooSaving}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
          >
            {bambooSaving
              ? isFrench
                ? 'Enregistrement...'
                : 'Saving...'
              : isFrench
              ? 'Enregistrer BambooHR'
              : 'Save BambooHR'}
          </button>
          <button
            type="button"
            onClick={handleTestBamboo}
            disabled={bambooTesting || !bambooEnabled}
            className="px-4 py-2 rounded-xl border border-slate-600 text-xs font-bold text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
          >
            {bambooTesting
              ? isFrench
                ? 'Test en cours...'
                : 'Testing...'
              : isFrench
              ? 'Tester la connexion'
              : 'Test connection'}
          </button>
          <button
            type="button"
            onClick={handleSyncBamboo}
            disabled={bambooSyncing || !bambooEnabled}
            className="px-4 py-2 rounded-xl border border-slate-600 text-xs font-bold text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
          >
            {bambooSyncing
              ? isFrench
                ? 'Synchronisation...'
                : 'Syncing...'
              : isFrench
              ? 'Synchroniser maintenant'
              : 'Sync now'}
          </button>
        </div>

        {bambooStatus && <p className="text-xs text-emerald-400">{bambooStatus}</p>}
        {bambooError && <p className="text-xs text-rose-400">{bambooError}</p>}

        {bambooEvents.length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-1 text-xs text-slate-300">
            <p className="text-slate-400 font-semibold">
              {isFrench ? 'Derniers appels webhook' : 'Recent webhook calls'}
            </p>
            {bambooEvents.slice(0, 8).map((event, index) => (
              <p key={`${event.receivedAt}-${event.employeeId}-${index}`} className="font-mono text-[11px] text-slate-400">
                {event.action || 'Update'} · #{event.employeeId}
                {event.displayName ? ` · ${event.displayName}` : ''}
                {event.jobTitle ? ` · ${event.jobTitle}` : ''}
                {event.note ? ` · ${event.note}` : ''}
              </p>
            ))}
          </div>
        )}

        {bambooReport && (
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2 text-xs text-slate-300">
            <p className="text-amber-300 font-semibold">{bambooReport.message}</p>
            <p>
              {isFrench ? 'Champs du compte' : 'Account fields'}: {bambooReport.fieldCount}
              {' · '}
              {isFrench ? 'Utilisateurs' : 'Users'}: {bambooReport.userCount}
              {' · '}
              {isFrench ? 'Annuaire' : 'Directory'}: {bambooReport.directoryCount}
              {' · '}
              {isFrench ? 'Correspondances' : 'Matches'}: {bambooReport.matchedCount}
            </p>
            {bambooReport.preview.length > 0 && (
              <ul className="space-y-1">
                {bambooReport.preview.map((row) => (
                  <li key={row.id} className="font-mono text-[11px] text-slate-400">
                    {row.displayName} · {row.jobTitle} · {row.status}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>

      <form
        onSubmit={handleSaveZonar}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              {isFrench ? 'Synchronisation GPS Zonar' : 'Zonar GPS Sync'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isFrench
                ? 'Chaque véhicule ne conserve que sa dernière position. L\'historique n\'est pas enregistré.'
                : 'Each vehicle keeps only its latest position. History is not stored.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={zonarEnabled}
              onChange={(e) => setZonarEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-2.5 text-xs font-bold text-white">
              {zonarEnabled
                ? isFrench
                  ? 'Synchronisation activée'
                  : 'Sync enabled'
                : isFrench
                ? 'Synchronisation désactivée'
                : 'Sync disabled'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {isFrench ? 'Client Zonar' : 'Zonar customer'}
            </label>
            <input
              type="text"
              value={zonarCustomer}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setZonarCustomer(e.target.value)}
              placeholder="customer"
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {isFrench ? 'Nom d\'utilisateur' : 'Username'}
            </label>
            <input
              type="text"
              value={zonarUsername}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setZonarUsername(e.target.value)}
              placeholder="username"
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {isFrench ? 'Mot de passe' : 'Password'}
            </label>
            <input
              type="password"
              value={zonarPassword}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(e) => setZonarPassword(e.target.value)}
              placeholder={
                zonarPasswordSet
                  ? isFrench
                    ? 'Laisser vide pour conserver le mot de passe'
                    : 'Leave blank to keep the saved password'
                  : isFrench
                  ? 'Mot de passe Zonar'
                  : 'Zonar password'
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {zonarPasswordSet
                ? isFrench
                  ? 'Un mot de passe est enregistré sur le serveur. Il n\'est pas renvoyé au navigateur.'
                  : 'A password is stored on the server. It is not sent back to the browser.'
                : isFrench
                ? 'Le mot de passe n\'est enregistré que sur le serveur.'
                : 'The password is stored only on the server.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {isFrench ? 'Intervalle chargé (minutes)' : 'Busy interval (minutes)'}
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={zonarBusyMinutes}
              onChange={(e) => setZonarBusyMinutes(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {isFrench
                ? 'Jours de semaine, 6 h à 18 h, heure d\'Ottawa. Par défaut 1 minute.'
                : 'Weekdays 6:00-18:00 Ottawa time. Default is 1 minute.'}
            </p>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {isFrench ? 'Intervalle calme (minutes)' : 'Idle interval (minutes)'}
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={zonarIdleMinutes}
              onChange={(e) => setZonarIdleMinutes(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {isFrench
                ? 'Soirs et fins de semaine. Par défaut 10 minutes.'
                : 'Evenings and weekends. Default is 10 minutes.'}
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            {isFrench ? 'Heure du numero de serie GPS' : 'GPS serial sync time'}
          </label>
          <input
            type="time"
            value={zonarSerialTime}
            onChange={(e) => setZonarSerialTime(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            {isFrench
              ? 'Une fois par jour, heure d\'Ottawa. Les numeros GPS sont copies sur les vehicules. Les numeros de ligne sont prepares pour Zonar a la meme heure, sans rien envoyer.'
              : 'Once per day, Ottawa time. GPS serials are copied onto vehicles. Route numbers are prepared for Zonar on this same clock and are not sent.'}
            {zonarLastSerialAt
              ? ` ${isFrench ? 'Derniere execution' : 'Last run'}: ${zonarLastSerialAt}. ${zonarLastSerialCount} ${isFrench ? 'vehicules ont un numero GPS' : 'vehicles have a GPS serial'}.`
              : ''}
            {zonarLastRouteAt
              ? ` ${isFrench ? 'Apercu des lignes' : 'Route preview'}: ${zonarLastRouteAt} (${zonarLastRouteCount}).`
              : ''}
          </p>
        </div>

        <p className="text-[11px] text-slate-500">
          {isFrench
            ? 'La dernière position de chaque véhicule est enregistrée et remplacée à la prochaine synchronisation. L\'affichage lit cette table.'
            : 'The latest position for each vehicle is saved and replaced on the next sync. Vehicle location views read that table.'}
          {zonarLastSyncAt
            ? ` ${isFrench ? 'Dernière lecture' : 'Last read'}: ${zonarLastSyncAt} (${zonarLastSyncCount}${zonarLastSyncMode ? `, ${zonarLastSyncMode}` : ''}).`
            : ''}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={zonarSaving}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
          >
            {zonarSaving
              ? isFrench
                ? 'Enregistrement...'
                : 'Saving...'
              : isFrench
              ? 'Enregistrer GPS'
              : 'Save GPS'}
          </button>
          <button
            type="button"
            onClick={handleTestZonar}
            disabled={zonarTesting || !zonarEnabled}
            className="px-4 py-2 rounded-xl border border-slate-600 text-xs font-bold text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
          >
            {zonarTesting
              ? isFrench
                ? 'Test en cours...'
                : 'Testing...'
              : isFrench
              ? 'Tester la connexion'
              : 'Test connection'}
          </button>
          <button
            type="button"
            onClick={handleSyncZonarSerials}
            disabled={zonarSerialRunning || (!zonarEnabled && !zonarPasswordSet)}
            className="px-4 py-2 rounded-xl border border-slate-600 text-xs font-bold text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
          >
            {zonarSerialRunning
              ? isFrench
                ? 'Synchronisation...'
                : 'Syncing...'
              : isFrench
              ? 'Synchroniser les numeros GPS'
              : 'Sync GPS serials'}
          </button>
          <button
            type="button"
            onClick={handlePreviewZonarRoutes}
            disabled={zonarRouteRunning}
            className="px-4 py-2 rounded-xl border border-slate-600 text-xs font-bold text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
          >
            {zonarRouteRunning
              ? isFrench
                ? 'Synchronisation...'
                : 'Syncing...'
              : isFrench
              ? 'Synchroniser les lignes vers Zonar'
              : 'Sync route to Zonar'}
          </button>
        </div>

        {zonarStatus && <p className="text-xs text-emerald-400">{zonarStatus}</p>}
        {zonarError && <p className="text-xs text-rose-400">{zonarError}</p>}

        {zonarSerialReport && (
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2 text-xs text-slate-300">
            <p className="text-amber-300 font-semibold">{zonarSerialReport.message}</p>
            {zonarSerialReport.unmatched.length > 0 && (
              <p className="font-mono text-[11px] text-slate-400">
                {zonarSerialReport.unmatched.join(', ')}
              </p>
            )}
          </div>
        )}

        {zonarRouteReport && (
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2 text-xs text-slate-300">
            <p className="text-amber-300 font-semibold">{zonarRouteReport.message}</p>
            {zonarRouteReport.preview.length > 0 && (
              <ul className="space-y-1">
                {zonarRouteReport.preview.map((row) => (
                  <li key={`${row.assetId}-${row.unitNumber}`} className="font-mono text-[11px] text-slate-400">
                    {row.unitNumber} · {row.fleet} · {row.routeNo || 'no route'} · {row.location}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {zonarReport && (
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2 text-xs text-slate-300">
            <p className="text-amber-300 font-semibold">{zonarReport.message}</p>
            <p>
              {isFrench ? 'Actifs' : 'Assets'}: {zonarReport.assetCount}
              {' · '}
              {isFrench ? 'Positions' : 'Positions'}: {zonarReport.locatedCount}
              {' · '}
              {zonarReport.mode} / {zonarReport.intervalMinutes} min
            </p>
            {zonarReport.preview.length > 0 && (
              <ul className="space-y-1">
                {zonarReport.preview.map((row) => (
                  <li key={`${row.id}-${row.fleet}`} className="font-mono text-[11px] text-slate-400">
                    {row.fleet || row.id} · {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                    {row.power ? ` · ${row.power}` : ''} · {row.observedAt}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>

      {/* Section 0: Jurisdiction & School Bus Semi-Annual Safety Compliance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${
              isOntario
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {isFrench
                    ? 'Juridiction et normes de conformité mécanique des véhicules'
                    : 'Jurisdiction & Vehicle Safety Compliance Standards'}
                </h2>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                  isOntario
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                }`}>
                  {isOntario ? '🇨🇦 Ontario (MTO / CVOR)' : '⚜️ Québec (SAAQ / CTQ)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isFrench
                  ? 'Basculez entre les cadres réglementaires de l\'Ontario (DriveON PMVI / MTO) et du Québec (SAAQ VMP / PEP CVM), les alertes de pré-inspection et les obligations d\'archivage.'
                  : 'Switch between Ontario (DriveON PMVI / MTO) and Québec (SAAQ Mandataire VMP / PEP CVM) regulatory frameworks, advance pre-inspection alerts, and audit retention mandates.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => handleSelectProvince('ON')}
              disabled={provSaving}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                province === 'ON'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-sm">🇨🇦</span>
              <span>Ontario (ON)</span>
              {province === 'ON' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>
            <button
              type="button"
              onClick={() => handleSelectProvince('QC')}
              disabled={provSaving}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                province === 'QC'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-sm">⚜️</span>
              <span>Québec (QC)</span>
              {province === 'QC' && <Check className="w-3.5 h-3.5 text-sky-400" />}
            </button>
          </div>
        </div>

        {/* Two Province Interactive Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ontario Card */}
          <div
            onClick={() => handleSelectProvince('ON')}
            className={`cursor-pointer rounded-xl p-4 border transition ${
              province === 'ON'
                ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">🇨🇦</span>
                <span className="font-bold text-white text-sm">
                  {isFrench ? 'Modèle réglementaire de l\'Ontario' : 'Ontario Regulatory Model'}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                province === 'ON' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {province === 'ON'
                  ? isFrench
                    ? 'Juridiction active'
                    : 'Active Jurisdiction'
                  : isFrench
                  ? 'Cliquer pour activer'
                  : 'Click to Switch'}
              </span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0 font-semibold">
                  {isFrench ? '• Autorité :' : '• Regulator:'}
                </span>
                <span><strong>Ministry of Transportation Ontario (MTO)</strong> / CVOR Registry</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0 font-semibold">
                  {isFrench ? '• Système :' : '• Digital System:'}
                </span>
                <span className="text-emerald-400 font-medium">
                  {isFrench
                    ? 'Système d\'inspection numérique DriveON (Fin du papier MVIS)'
                    : 'DriveON Digital Inspection System (Paper MVIS Phase-out)'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0 font-semibold">
                  {isFrench ? '• Processus :' : '• Tech Process:'}
                </span>
                <span className="text-slate-300">
                  {isFrench
                    ? 'Le technicien certifié utilise une tablette DriveON avec photos en temps réel (épaisseur des freins mm, NIV et odomètre) transmises au MTO.'
                    : 'Certified technician uses DriveON tablets with real-time photo telemetry of brake lining mm, VIN & odometer direct to MTO.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0 font-semibold">
                  {isFrench ? '• Preuve :' : '• Proof:'}
                </span>
                <span>Safety Standards Certificate (PMVI) &amp; Punched Decal Sticker</span>
              </div>
            </div>
          </div>

          {/* Quebec Card */}
          <div
            onClick={() => handleSelectProvince('QC')}
            className={`cursor-pointer rounded-xl p-4 border transition ${
              province === 'QC'
                ? 'bg-sky-950/20 border-sky-500/40 ring-1 ring-sky-500/20'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚜️</span>
                <span className="font-bold text-white text-sm">
                  {isFrench ? 'Modèle réglementaire du Québec' : 'Québec Regulatory Model'}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                province === 'QC' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {province === 'QC'
                  ? isFrench
                    ? 'Juridiction active'
                    : 'Active Jurisdiction'
                  : isFrench
                  ? 'Cliquer pour activer'
                  : 'Click to Switch'}
              </span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0 font-semibold">
                  {isFrench ? '• Autorité :' : '• Regulator:'}
                </span>
                <span><strong>SAAQ</strong> / Commission des transports du Québec (CTQ - PEVL Profile)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0 font-semibold">
                  {isFrench ? '• Mode :' : '• Inspection Mode:'}
                </span>
                <span className="text-sky-400 font-medium">Mandataires Agréés (VMP) ou Programme d'Entretien Préventif (PEP)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0 font-semibold">
                  {isFrench ? '• Processus :' : '• Tech Process:'}
                </span>
                <span className="text-slate-300">
                  {isFrench
                    ? 'Le technicien du centre mandataire saisit les résultats sur le portail SAAQ, ou les mécaniciens internes agréés complètent les fiches PEP.'
                    : 'Inspection station technician enters findings into SAAQ portal, or approved internal fleet mechanics complete PEP audit sheets.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0 font-semibold">
                  {isFrench ? '• Preuve :' : '• Proof:'}
                </span>
                <span>Certificat de Vérification Mécanique (CVM) &amp; Vignette SAAQ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Reality & Mandatory Compliance Checklist Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Time & Downtime */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                {isFrench ? 'Durée d\'inspection et temps d\'arrêt' : 'Inspection Duration & Fleet Downtime'}
              </span>
            </div>
            <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
              {isFrench ? (
                <>
                  <p>
                    <strong>Temps d'inspection pur :</strong> ~2,5 à 3,5 h (Norme NSC 11B : levage, retrait des roues / mesure des garnitures de freins, direction, suspension, course des freins).
                  </p>
                  <p className="text-slate-400">
                    <strong>Immobilisation réelle :</strong> Prévoir <strong>0,5 à 1,0 jour</strong> pour les ajustements mineurs sur place. En cas de défectuosité majeure nécessitant des pièces, l'autobus est immobilisé <strong>1 à 3 jours</strong>.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Pure Inspection Time:</strong> ~2.5 - 3.5 hrs (NSC 11B Standard: hoist vehicle, wheel removal/brake lining thickness measurement, steering, suspension, air brake pushrod stroke).
                  </p>
                  <p className="text-slate-400">
                    <strong>Actual Downtime:</strong> Budget <strong>0.5 to 1.0 day</strong> for on-site minor adjustments (stroke adjustment, loose bushing, lamp repair). If major defects require parts, vehicle will be grounded for <strong>1 to 3 days</strong>.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Advance Pre-Inspection Buffer */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>
                {isFrench ? 'Pré-inspection anticipée (2 à 3 semaines)' : '2-3 Weeks Advance Pre-Inspection Buffer'}
              </span>
            </div>
            <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
              {isFrench ? (
                <>
                  <p>
                    <strong>Pré-inspection interne au dépôt :</strong> Effectuée <strong>2 à 3 semaines (14 à 21 jours)</strong> avant la date officielle d'inspection semestrielle.
                  </p>
                  <p className="text-slate-400">
                    Les mécaniciens internes remplacent à l'avance les pièces usées afin d'éliminer tout risque de mise <em>Hors service (OOS)</em> le jour de l'examen.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Internal Yard Pre-Inspection:</strong> Conducted <strong>2-3 weeks (14-21 days)</strong> prior to official semi-annual inspection date.
                  </p>
                  <p className="text-slate-400">
                    Yard mechanics replace worn brake pads and suspension components in advance, eliminating the risk of school buses being placed <em>Out-of-Service (OOS)</em> on test day.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Card 3: Operator Archival Duties */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <FileCheck className="w-4 h-4 shrink-0" />
              <span>
                {isFrench ? '3 obligations d\'archivage de l\'exploitant' : 'Operator 3 Mandatory Archival Duties'}
              </span>
            </div>
            <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">1.</span>
                <span>
                  {isFrench ? (
                    <>
                      <strong>Document à bord :</strong> Copie du certificat/CVM dans le coffre à gants + vignette.
                    </>
                  ) : (
                    <>
                      <strong>In-Cab Document:</strong> Certificate/CVM duplicate in bus glovebox + window decal.
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">2.</span>
                <span>
                  {isFrench ? (
                    <>
                      <strong>Rapport de mesures :</strong> Fiche complète avec mesures (mm) des freins et pneus.
                    </>
                  ) : (
                    <>
                      <strong>Measurement Report:</strong> Full tech sheet with brake lining &amp; tire mm measurements.
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">3.</span>
                <span>
                  {isFrench ? (
                    <>
                      <strong>Preuve de réparations :</strong> Bons de travail et factures des pièces jointes.
                    </>
                  ) : (
                    <>
                      <strong>Proof of Repairs:</strong> Work orders and parts invoices for pre-pass repairs attached.
                    </>
                  )}
                </span>
              </div>
              <div className="pt-1 text-[11px] text-slate-400">
                ⚖️{' '}
                {isFrench ? (
                  <>
                    <strong>Conservation légale de 2 ans</strong> requise pour les audits CVOR / SAAQ CTQ.
                  </>
                ) : (
                  <>
                    <strong>Statutory 2-Year Retention</strong> required for CVOR / SAAQ CTQ audit.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Configuration Parameters Form */}
        <form onSubmit={handleSaveComplianceSettings} className="space-y-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isFrench
                    ? 'Paramètres de juridiction et identifiants réglementaires'
                    : 'Jurisdiction Parameters & Statutory Identifiers'}
                </span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {isFrench ? 'Actif :' : 'Active:'} {province === 'ON' ? 'Ontario MTO' : 'Québec SAAQ'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {province === 'ON'
                    ? isFrench
                      ? 'N° d\'inscription CVOR du MTO'
                      : 'MTO CVOR Registration #'
                    : isFrench
                    ? 'N° PEVL SAAQ / NIR CTQ'
                    : 'SAAQ PEVL / CTQ NIR #'}
                </label>
                <input
                  type="text"
                  value={provForm.cvorOrPevlNumber || ''}
                  onChange={(e) => setProvForm((prev) => ({ ...prev, cvorOrPevlNumber: e.target.value }))}
                  placeholder={province === 'ON' ? 'e.g. CVOR-ON-889201' : 'e.g. NIR-CTQ-55291'}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench
                    ? 'Délai d\'alerte de pré-inspection (Jours)'
                    : 'Advance Pre-Inspection Alert Buffer (Days)'}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={7}
                    max={60}
                    value={provForm.advancePreInspectionDays}
                    onChange={(e) => setProvForm((prev) => ({ ...prev, advancePreInspectionDays: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 shrink-0">
                    {isFrench ? 'jours (2-3 sem.)' : 'days (2-3 wks)'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench
                    ? 'Conservation légale des archives (Années)'
                    : 'Statutory Audit Archive Retention (Years)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={provForm.retentionYears}
                  onChange={(e) => setProvForm((prev) => ({ ...prev, retentionYears: Number(e.target.value) }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {province === 'QC' && (
              <div className="p-3 rounded-lg bg-sky-950/20 border border-sky-500/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="pepEnabledCheck"
                    checked={provForm.pepEnabled ?? false}
                    onChange={(e) => setProvForm((prev) => ({ ...prev, pepEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-sky-400 bg-slate-900"
                  />
                  <label htmlFor="pepEnabledCheck" className="text-xs text-white font-medium cursor-pointer">
                    {isFrench
                      ? 'Accrédité pour le PEP de la SAAQ (Programme d\'Entretien Préventif)'
                      : 'Accredited for SAAQ PEP (Programme d\'Entretien Préventif)'}
                    <span className="block text-[10px] text-slate-400">
                      {isFrench
                        ? 'Permet aux mécaniciens internes certifiés d\'effectuer les vérifications mécaniques'
                        : 'Allows in-house certified technicians to perform mechanical inspections'}
                    </span>
                  </label>
                </div>
                <div>
                  <input
                    type="text"
                    value={provForm.pepNumber || ''}
                    disabled={!provForm.pepEnabled}
                    onChange={(e) => setProvForm((prev) => ({ ...prev, pepNumber: e.target.value }))}
                    placeholder="SAAQ PEP Accreditation Number (e.g. PEP-44910)"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-sky-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                {isFrench
                  ? 'Notes sur le centre d\'inspection désigné'
                  : 'Designated Inspection Facility / Station Notes'}
              </label>
              <input
                type="text"
                value={provForm.notes || ''}
                onChange={(e) => setProvForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={
                  isFrench
                    ? 'ex. Nom du centre, accréditations des techniciens, ID DriveON ou mandataire SAAQ'
                    : 'e.g. Station name, technician credentials, DriveON station ID or SAAQ Mandataire center'
                }
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Written Maintenance Plan & Preventive Maintenance Intervals */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>
                      {province === 'ON'
                        ? isFrench
                          ? 'Plan d\'entretien écrit (« Écrire ce que l\'on fait, faire ce que l\'on écrit » - CVOR MTO)'
                          : 'Written Maintenance Plan ("Write What You Do, Do What You Write" - MTO CVOR)'
                        : isFrench
                        ? 'Calendrier d\'entretien préventif obligatoire et Fiche d\'entretien (SAAQ)'
                        : 'Mandatory Preventive Maintenance & Fiche d\'Entretien Schedule (SAAQ)'}
                    </span>
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isFrench
                      ? 'Définissez les intervalles exacts en kilomètres (km) et en jours civils pour les vidanges d\'huile, le graissage du châssis et l\'entretien préventif. Les auditeurs appliquent une tolérance zéro dépassement.'
                      : 'Define the exact mileage (km) and calendar day intervals for routine oil changes, chassis lubrication, and preventive maintenance. Auditors enforce zero-overdue compliance against these thresholds.'}
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 self-start">
                  {isFrench ? 'Tolérance zéro dépassement d\'audit' : 'Strict Zero-Overdue Audit Enforcement'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Service A */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-white">
                    🅰️ {isFrench ? 'Service A (EP mineur / Graissage)' : 'Service A (Minor PM / Chassis Grease)'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                        {isFrench ? 'Intervalle max (km)' : 'Max Interval (km)'}
                      </label>
                      <input
                        type="number"
                        step={500}
                        value={provForm.serviceAIntervalKm ?? 4000}
                        onChange={(e) => setProvForm((prev) => ({ ...prev, serviceAIntervalKm: Number(e.target.value) }))}
                        className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                        {isFrench ? 'Intervalle max (Jours)' : 'Max Interval (Days)'}
                      </label>
                      <input
                        type="number"
                        value={provForm.serviceAIntervalDays ?? 45}
                        onChange={(e) => setProvForm((prev) => ({ ...prev, serviceAIntervalDays: Number(e.target.value) }))}
                        className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Service B (Oil Change) */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-amber-500/30 space-y-2">
                  <div className="text-[11px] font-bold text-amber-300">
                    🅱️ {isFrench ? 'Service B (Vidange d\'huile et filtre)' : 'Service B (Engine Oil & Filter Change)'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                        {isFrench ? 'Intervalle max (km)' : 'Max Interval (km)'}
                      </label>
                      <input
                        type="number"
                        step={500}
                        value={provForm.serviceBIntervalKm ?? 8000}
                        onChange={(e) => setProvForm((prev) => ({ ...prev, serviceBIntervalKm: Number(e.target.value) }))}
                        className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                        {isFrench ? 'Intervalle max (Jours)' : 'Max Interval (Days)'}
                      </label>
                      <input
                        type="number"
                        value={provForm.serviceBIntervalDays ?? 90}
                        onChange={(e) => setProvForm((prev) => ({ ...prev, serviceBIntervalDays: Number(e.target.value) }))}
                        className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Service C / QC Fiche */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-white">
                    {province === 'QC'
                      ? isFrench
                        ? '⚜️ Fiche d\'entretien SAAQ (Obligatoire)'
                        : '⚜️ SAAQ Fiche d\'entretien (Mandatory)'
                      : isFrench
                      ? '🅲 Service C (EP majeur)'
                      : '🅲 Service C (Major Drivetrain PM)'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                        {isFrench ? 'Intervalle max (km)' : 'Max Interval (km)'}
                      </label>
                      <input
                        type="number"
                        step={1000}
                        value={provForm.serviceCIntervalKm ?? 24000}
                        onChange={(e) => setProvForm((prev) => ({ ...prev, serviceCIntervalKm: Number(e.target.value) }))}
                        className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                        {province === 'QC'
                          ? isFrench
                            ? 'Jours Fiche QC (≤180j)'
                            : 'QC Fiche Days (≤180d)'
                          : isFrench
                          ? 'Intervalle max (Jours)'
                          : 'Max Interval (Days)'}
                      </label>
                      <input
                        type="number"
                        max={180}
                        value={province === 'QC' ? (provForm.qcMandatoryMaintenanceDays ?? 90) : (provForm.serviceCIntervalDays ?? 180)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (province === 'QC') {
                            setProvForm((prev) => ({ ...prev, qcMandatoryMaintenanceDays: val }));
                          } else {
                            setProvForm((prev) => ({ ...prev, serviceCIntervalDays: val }));
                          }
                        }}
                        className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {isFrench
                      ? 'Spécification standard d\'huile moteur'
                      : 'Standard Engine Oil Specification'}
                  </label>
                  <input
                    type="text"
                    value={provForm.defaultEngineOilSpec || '15W-40 Heavy Duty Synthetic Blend (CK-4)'}
                    onChange={(e) => setProvForm((prev) => ({ ...prev, defaultEngineOilSpec: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {isFrench ? 'N° de version du plan écrit' : 'Written Plan Document Version #'}
                  </label>
                  <input
                    type="text"
                    value={provForm.writtenPlanVersion || 'WMP-2026.2'}
                    onChange={(e) => setProvForm((prev) => ({ ...prev, writtenPlanVersion: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {isFrench ? 'Plan approuvé par (Titre / Responsable)' : 'Plan Approved By (Title / Officer)'}
                  </label>
                  <input
                    type="text"
                    value={provForm.writtenPlanApprovedBy || 'Director of Fleet Maintenance & Safety'}
                    onChange={(e) => setProvForm((prev) => ({ ...prev, writtenPlanApprovedBy: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {provStatus && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{provStatus}</span>
            </div>
          )}
          {provError && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{provError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              {isFrench ? 'Cadre réglementaire :' : 'Regulatory framework:'}{' '}
              <strong className="text-white">{provForm.inspectionFramework}</strong>
            </span>
            <button
              type="submit"
              disabled={provSaving}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {provSaving
                  ? isFrench
                    ? 'Enregistrement des paramètres...'
                    : 'Saving Compliance Parameters...'
                  : isFrench
                  ? 'Enregistrer les paramètres de conformité'
                  : 'Save Compliance Parameters'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {isDemoMode && (
      <>
      {/* Section: Automated Operations Simulation */}
      <div className={`bg-slate-900 border rounded-2xl p-6 space-y-5 transition ${
        simSettings.enabled
          ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
          : 'border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${
              simSettings.enabled
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400'
            }`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">{t.simulation.title}</h2>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  simSettings.enabled
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {simSettings.enabled ? t.simulation.activeBadge : t.simulation.disabledBadge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.simulation.subtitle}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 self-start sm:self-center">
            <input
              type="checkbox"
              checked={simSettings.enabled}
              disabled={simSaving}
              onChange={(e) => handleToggleSimulation(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-2.5 text-xs font-bold text-white">
              {simSettings.enabled ? t.simulation.enabledLabel : t.simulation.enableLabel}
            </span>
          </label>
        </div>

        {/* 10 Core Rules Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule1Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule1Desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule2Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule2DescPrefix}
                <code className="text-emerald-400">+{simSettings.checkInWindowMinutes} min</code>
                {t.simulation.rule2DescMiddle}
                <code className="text-emerald-400">+{simSettings.studentPickupWindowMinutes} min</code>
                {t.simulation.rule2DescSuffix}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule3TitlePrefix}{simSettings.studentAbsentRate}%</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule3DescPrefix}
                <code className="text-amber-400">{simSettings.studentAbsentRate}%</code>
                {t.simulation.rule3DescMiddle}{100 - simSettings.studentAbsentRate}{t.simulation.rule3DescSuffix}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule4Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule4DescPrefix}
                <code className="text-purple-400">+{simSettings.pretripWindowMinutes} min</code>
                {t.simulation.rule4DescSuffix}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule5Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule5Desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule6Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule6Desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule7Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule7Desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule8Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule8Desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule9Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule9Desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{t.simulation.rule10Title}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.simulation.rule10Desc}
              </p>
            </div>
          </div>
        </div>

        {/* Fine-tune Parameters & Instant Execution Controls */}
        <form onSubmit={handleSaveSimSettings} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl bg-slate-800/30 border border-slate-800">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                {t.simulation.nextDayGenTimeLabel}
              </label>
              <input
                type="time"
                value={simSettings.autoGenerateTime}
                onChange={(e) => setSimSettings((prev) => ({ ...prev, autoGenerateTime: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                {t.simulation.crewCheckInWindowLabel}
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={simSettings.checkInWindowMinutes}
                onChange={(e) => setSimSettings((prev) => ({ ...prev, checkInWindowMinutes: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                {t.simulation.studentStopWindowLabel}
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={simSettings.studentPickupWindowMinutes}
                onChange={(e) => setSimSettings((prev) => ({ ...prev, studentPickupWindowMinutes: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                {t.simulation.studentAbsentRateLabel}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={simSettings.studentAbsentRate}
                onChange={(e) => setSimSettings((prev) => ({ ...prev, studentAbsentRate: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                {t.simulation.pretripWindowLabel}
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={simSettings.pretripWindowMinutes}
                onChange={(e) => setSimSettings((prev) => ({ ...prev, pretripWindowMinutes: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {lastSimResult && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-2">
              <div className="font-bold flex items-center justify-between">
                <span>{t.simulation.latestReportTitle} ({lastSimResult.date})</span>
                <span className="font-mono text-[11px] text-emerald-400">{lastSimResult.executedAt}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.totalShiftsLabel}</span>
                  <span className="font-bold text-white">{lastSimResult.totalShifts} {t.simulation.shiftsUnit} ({lastSimResult.dispatchesCreated} {t.simulation.newUnit})</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.crewCheckInLabel}</span>
                  <span className="font-bold text-white">{t.simulation.driversLabel} {lastSimResult.driversCheckedIn} / {t.simulation.attendantsLabel} {lastSimResult.attendantsCheckedIn}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.studentAttendanceLabel}</span>
                  <span className="font-bold text-white">
                    {t.simulation.absentLabel} {lastSimResult.absentStudents}/{lastSimResult.totalStudents} ({lastSimResult.absentRatePercent}%)
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.pretripChecklistsLabel}</span>
                  <span className="font-bold text-white">{lastSimResult.pretripsCreated} {t.simulation.generatedUnit}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.timeOffSummaryLabel}</span>
                  <span className="font-bold text-white">{lastSimResult.timeOffCreated} ({lastSimResult.timeOffApproved} {t.simulation.approvedUnit})</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.defectReportsSummaryLabel}</span>
                  <span className="font-bold text-white">{lastSimResult.defectsCreated} {t.simulation.newUnit} / {lastSimResult.defectsResolved} {t.simulation.resolvedUnit}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.studentIncidentsSummaryLabel}</span>
                  <span className="font-bold text-white">{lastSimResult.incidentsCreated} {t.simulation.newUnit} / {lastSimResult.incidentsResolved} {t.simulation.closedUnit}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.assessmentsHazardsSummaryLabel}</span>
                  <span className="font-bold text-white">{lastSimResult.routeAssessmentsCreated} {t.simulation.assessmentsUnit} / {lastSimResult.hazardReportsCreated} {t.simulation.hazardsUnit}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.expenseClaimsSummaryLabel}</span>
                  <span className="font-bold text-white">{lastSimResult.expensesCreated} {t.simulation.newUnit} / {lastSimResult.expensesApproved} {t.simulation.approvedUnit}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-slate-400 block">{t.simulation.vehicleHandoversSummaryLabel}</span>
                  <span className="font-bold text-white">{lastSimResult.vehicleSignoutsCreated} {t.simulation.generatedUnit}</span>
                </div>
              </div>
            </div>
          )}

          {simStatus && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{simStatus}</span>
            </div>
          )}
          {simError && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{simError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-[11px] text-slate-400 space-x-3">
              {simSettings.lastSimulatedDate && (
                <span>{t.simulation.lastSimulatedDateLabel} <strong className="text-slate-200 font-mono">{simSettings.lastSimulatedDate}</strong></span>
              )}
              {simSettings.lastAutoGeneratedForDate && (
                <span>{t.simulation.nextDayAutoGenLabel} <strong className="text-slate-200 font-mono">{simSettings.lastAutoGeneratedForDate}</strong></span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={simRunning || simSaving}
                onClick={() => handleRunSimulationNow(0)}
                className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{simRunning ? t.simulation.simulatingBtn : t.simulation.simulateTodayBtn}</span>
              </button>
              <button
                type="button"
                disabled={simRunning || simSaving}
                onClick={() => handleRunSimulationNow(1)}
                className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{simRunning ? t.simulation.simulatingBtn : t.simulation.simulateTomorrowBtn}</span>
              </button>
              <button
                type="submit"
                disabled={simSaving || simRunning}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{simSaving ? t.simulation.savingBtn : t.simulation.saveSettingsBtn}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Section 0: Appearance & Theme Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{t.theme.appearance}</h2>
            <p className="text-xs text-slate-400">{t.theme.appearanceSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Light Theme Option Card */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-3 relative group ${
              theme === 'light'
                ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30'
                : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-700 text-slate-300'}`}>
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">{t.theme.lightMode}</span>
                  <span className="text-[11px] text-slate-400">Clean, crisp off-white interface</span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                  theme === 'light'
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-600'
                }`}
              >
                {theme === 'light' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* Miniature Mockup */}
            <div className="p-2.5 rounded-lg bg-slate-200 border border-slate-300 space-y-1.5 pointer-events-none">
              <div className="h-2 w-16 bg-slate-400 rounded-full" />
              <div className="flex items-center space-x-1.5">
                <div className="h-4 w-12 bg-amber-500 rounded" />
                <div className="h-4 flex-1 bg-white border border-slate-300 rounded" />
              </div>
              <div className="h-2 w-24 bg-slate-300 rounded-full" />
            </div>
          </button>

          {/* Dark Theme Option Card */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-3 relative group ${
              theme === 'dark'
                ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30'
                : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-700 text-slate-300'}`}>
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">{t.theme.darkMode}</span>
                  <span className="text-[11px] text-slate-400">High-contrast nighttime operations</span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                  theme === 'dark'
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-600'
                }`}
              >
                {theme === 'dark' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* Miniature Mockup */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 pointer-events-none">
              <div className="h-2 w-16 bg-slate-700 rounded-full" />
              <div className="flex items-center space-x-1.5">
                <div className="h-4 w-12 bg-amber-500 rounded" />
                <div className="h-4 flex-1 bg-slate-800 border border-slate-700 rounded" />
              </div>
              <div className="h-2 w-24 bg-slate-800 rounded-full" />
            </div>
          </button>
        </div>
      </div>
      </>
      )}

      {/* Section: Crew Check-in FCM Push Reminders */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Crew Check-in FCM Reminders</h2>
              <p className="text-xs text-slate-400">
                Automated push notification policy for overdue driver & attendant check-ins
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {reminderSettings.reminderGraceMinutes} min grace period
          </span>
        </div>

        <form onSubmit={handleSaveReminderSettings} className="space-y-4 pt-1">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div>
              <span className="text-xs font-bold text-white block">Automated FCM Push Delivery</span>
              <span className="text-[11px] text-slate-400">
                Send push notifications via Google Cloud Scheduler (Mon-Fri 06:00 - 18:00)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={reminderSettings.enabled}
                onChange={(e) => setReminderSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Grace Minutes selector */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Overdue Check-in Grace Period
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              Reminder is sent when clock reaches scheduled check-in time plus this grace period. Default is 20 minutes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[10, 15, 20, 25, 30, 45].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setReminderSettings((prev) => ({ ...prev, reminderGraceMinutes: m }))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    reminderSettings.reminderGraceMinutes === m
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m} min {m === 20 ? '(Default)' : ''}
                </button>
              ))}
            </div>
            <div className="pt-2 flex items-center gap-3">
              <span className="text-xs text-slate-400">Custom minutes:</span>
              <input
                type="number"
                min="1"
                max="180"
                value={reminderSettings.reminderGraceMinutes}
                onChange={(e) => setReminderSettings((prev) => ({ ...prev, reminderGraceMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-24 px-3 py-1 text-xs font-mono rounded-lg border border-slate-700 bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Vehicle Pre-Trip Inspection Grace Period */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-400" />
                Vehicle Pre-Trip Inspection Reminder
              </label>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {reminderSettings.pretripReminderGraceMinutes ?? 60} min after check-in
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sends an FCM push reminder to the driver if pre-trip inspection for the shift vehicle has not been completed within this time after scheduled check-in. Default is 60 minutes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setReminderSettings((prev) => ({ ...prev, pretripReminderGraceMinutes: m }))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    (reminderSettings.pretripReminderGraceMinutes ?? 60) === m
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m} min {m === 60 ? '(Default)' : ''}
                </button>
              ))}
            </div>
            <div className="pt-2 flex items-center gap-3">
              <span className="text-xs text-slate-400">Custom minutes:</span>
              <input
                type="number"
                min="1"
                max="240"
                value={reminderSettings.pretripReminderGraceMinutes ?? 60}
                onChange={(e) => setReminderSettings((prev) => ({ ...prev, pretripReminderGraceMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-24 px-3 py-1 text-xs font-mono rounded-lg border border-slate-700 bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Window & Safety Notice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-amber-400 block font-bold text-[11px]">Daily Window (06:00 - 18:00)</span>
              <span className="text-slate-400 text-[11px] block">
                Evaluates shifts on weekdays during service hours. Outside this window, reminders sleep automatically.
              </span>
            </div>
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-emerald-400 block font-bold text-[11px]">Strict Idempotency</span>
              <span className="text-slate-400 text-[11px] block">
                Reminders are sent at most once per driver/vehicle per shift to prevent spam.
              </span>
            </div>
          </div>

          {/* Submit & Status */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={reminderSaving}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{reminderSaving ? 'Saving...' : 'Save Reminder Settings'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReminderSettings({
                    enabled: true,
                    reminderGraceMinutes: 20,
                    pretripReminderGraceMinutes: 60,
                    reminderWindowStart: '06:00',
                    reminderWindowEnd: '18:00',
                  });
                  setReminderStatus(null);
                  setReminderError(null);
                }}
                disabled={reminderSaving}
                className="px-3 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {reminderStatus && (
              <span className="text-xs text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{reminderStatus}</span>
              </span>
            )}
            {reminderError && (
              <span className="text-xs text-rose-400 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{reminderError}</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Section: Route Optimization & Stop Dwell Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{t.stops.routeSettingsTitle}</h2>
            <p className="text-xs text-slate-400">
              Configure default stop dwell duration for boarding/alighting, urban transit speed, and sequence optimization options.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveRouteOptSettings} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Default Stop Dwell Minutes */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{t.stops.defaultDwellMinutesLabel}</span>
                <span className="font-mono text-emerald-400 font-bold">{routeOptSettings.defaultStopDwellMinutes} min</span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 8].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRouteOptSettings((prev) => ({ ...prev, defaultStopDwellMinutes: m }))}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                      routeOptSettings.defaultStopDwellMinutes === m
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={15}
                value={routeOptSettings.defaultStopDwellMinutes}
                onChange={(e) =>
                  setRouteOptSettings((prev) => ({
                    ...prev,
                    defaultStopDwellMinutes: Math.max(1, Math.min(15, parseInt(e.target.value) || 3))
                  }))
                }
                className="w-full mt-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Scheduled boarding and alighting delay allocated per stop during automatic time recomputation.
              </p>
            </div>

            {/* Average Transit Speed */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{t.stops.avgSpeedLabel}</span>
                <span className="font-mono text-emerald-400 font-bold">{routeOptSettings.averageSpeedKmH} km/h</span>
              </label>
              <div className="flex items-center gap-2">
                {[25, 30, 35, 40, 50].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRouteOptSettings((prev) => ({ ...prev, averageSpeedKmH: s }))}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
                      routeOptSettings.averageSpeedKmH === s
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {s} km/h
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={15}
                max={80}
                value={routeOptSettings.averageSpeedKmH}
                onChange={(e) =>
                  setRouteOptSettings((prev) => ({
                    ...prev,
                    averageSpeedKmH: Math.max(15, Math.min(80, parseInt(e.target.value) || 30))
                  }))
                }
                className="w-full mt-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Estimated average driving speed in suburban/urban areas used for leg travel time estimations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recalculate Stop Times Default */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 flex items-start space-x-3">
              <input
                type="checkbox"
                id="recalcTimesDefault"
                checked={routeOptSettings.recalculateTimesDefault}
                onChange={(e) =>
                  setRouteOptSettings((prev) => ({
                    ...prev,
                    recalculateTimesDefault: e.target.checked
                  }))
                }
                className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="recalcTimesDefault" className="text-xs cursor-pointer select-none">
                <span className="font-bold text-slate-200 block">{t.stops.recalculateTimesLabel}</span>
                <span className="text-slate-400 text-[11px]">
                  Automatically recompute pullaway and arrival times whenever stops are reordered or moved.
                </span>
              </label>
            </div>

            {/* Include Driver Home Default */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 flex items-start space-x-3">
              <input
                type="checkbox"
                id="driverHomeDefault"
                checked={routeOptSettings.includeDriverHomeDefault}
                onChange={(e) =>
                  setRouteOptSettings((prev) => ({
                    ...prev,
                    includeDriverHomeDefault: e.target.checked
                  }))
                }
                className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="driverHomeDefault" className="text-xs cursor-pointer select-none">
                <span className="font-bold text-slate-200 block">{t.stops.includeDriverHomeLabel}</span>
                <span className="text-slate-400 text-[11px]">
                  {t.stops.includeDriverHomeHelp}
                </span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={routeOptSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{routeOptSaving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRouteOptSettings({
                    defaultStopDwellMinutes: 3,
                    averageSpeedKmH: 30,
                    recalculateTimesDefault: true,
                    includeDriverHomeDefault: false
                  });
                  setRouteOptStatus(null);
                  setRouteOptError(null);
                }}
                disabled={routeOptSaving}
                className="px-3 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {routeOptStatus && (
              <span className="text-xs text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{routeOptStatus}</span>
              </span>
            )}
            {routeOptError && (
              <span className="text-xs text-rose-400 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{routeOptError}</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Section 1: Administrator Account Provisioning */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Firebase Auth & Master Admin Account</h2>
            <p className="text-xs text-slate-400">
              Identity passport tied to business employee master record EMP-ADMIN-001
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700 space-y-1">
            <span className="text-slate-400">Current Logged-in Operator:</span>
            <p className="font-bold text-white text-sm">{currentUser?.displayName || currentUser?.email}</p>
            <p className="text-[11px] text-amber-400 font-mono">
              Role: {currentUser?.role} | Master ID: {currentUser?.employeeId}
            </p>
          </div>

          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700 space-y-1">
            <span className="text-slate-400">Environment Mode:</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${isMockMode ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="font-semibold text-white">
                {isMockMode ? 'Local Dev / Demo Simulation' : 'Live Google Cloud Service'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isMockMode
                ? 'Using built-in memory repository with full interactive CRUD support'
                : 'Authenticated via Firebase Admin JWT'}
            </p>
          </div>
        </div>

        {/* Provisioning form */}
        <form onSubmit={handleSetupAdmin} className="pt-2 space-y-3">
          <h3 className="text-xs font-bold text-slate-300">Provision / Reset Admin User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Admin Work Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Admin Password</label>
              <input
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Registering Admin...' : 'Provision Admin Account'}
            </button>

            {provisionStatus && (
              <span className="text-xs text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{provisionStatus}</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Section 2: Firestore Database Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Firestore Master Database Architecture</h2>
            <p className="text-xs text-slate-400">
              Reference Model: <code>D:\DispatchNew\DispatchApiServer\Models\EmployeeModel.cs</code>
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-amber-400 block font-bold">Collection: employees</span>
              <span className="text-slate-400 mt-1 block">
                Stores FullName, EmployeeNumber, JobPosition, Phones, Emails, YardId, Address, DriverLicense, Contacts, Photo
              </span>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-emerald-400 block font-bold">Driver License Sub-Entity</span>
              <span className="text-slate-400 mt-1 block">
                LicenseID, ExpirationDate, LicenseClass (Class B / Z Air Brake), Conditions, MVID
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Cloud Run Go API Deployment Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Google Cloud Run Deployment</h2>
            <p className="text-xs text-slate-400">Containerized Go microservice configuration</p>
          </div>
        </div>

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
          <div className="text-slate-400"># Deploy Go server to Cloud Run via gcloud CLI:</div>
          <div className="text-amber-400">
            gcloud run deploy dispatch-api \<br />
            &nbsp;&nbsp;--source ./server \<br />
            &nbsp;&nbsp;--platform managed \<br />
            &nbsp;&nbsp;--region us-central1 \<br />
            &nbsp;&nbsp;--allow-unauthenticated
          </div>
        </div>
      </div>

      {/* Section 4: Dispatch AI Copilot Architecture & Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-indigo-600 text-white rounded-lg shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Dispatch AI Copilot Operations Hub</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {aiStatus?.status === 'online' ? '● Online Active' : 'Offline'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Dual-engine architecture: Built-in natural language parser + Google Gemini LLM function calling</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Engine: {aiStatus?.engine === 'gemini' ? 'Gemini 2.0/1.5' : 'Built-in Offline Engine'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="font-semibold text-amber-300 flex items-center space-x-1.5">
              <Bot className="w-4 h-4" />
              <span>Supported Dispatch Commands & Dialog</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
              <li>
                <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Which shifts lack drivers today?</code>
                <span className="text-slate-400 ml-1">— Real-time scan of vacant shifts with quick assignment</span>
              </li>
              <li>
                <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Assign Tom as driver on route csdf-001</code>
                <span className="text-slate-400 ml-1">— Matches personnel, vehicle, and route before dispatcher confirmation</span>
              </li>
              <li>
                <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Show Tom's shifts today</code>
                <span className="text-slate-400 ml-1">— Inspects driver's entire daily schedule and pullaway times</span>
              </li>
              <li>
                <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">Overall dispatch summary today</code>
                <span className="text-slate-400 ml-1">— Statistics for shifts, vacancies, completed runs, and delays</span>
              </li>
            </ul>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="font-semibold text-emerald-300 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Compliance & Safety Safeguards</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
              <p>
                🔒 <strong className="text-slate-200">Mandatory Human Confirmation:</strong> AI roster assignments require the dispatcher to click
                <span className="text-emerald-400 font-bold mx-1">"Confirm Execution"</span> before changes take effect.
              </p>
              <p>
                📝 <strong className="text-slate-200">100% Audit Logging:</strong> Every AI command execution is logged to
                <code className="text-slate-300 mx-1">dispatch_change_logs</code> with operator ID, timestamp, and roster diff.
              </p>
              <p>
                ⌨️ <strong className="text-slate-200">Quick Shortcut:</strong> Press
                <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono mx-1 border border-slate-700">Ctrl + J</kbd>
                anywhere in the console to open the AI Copilot.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="pt-2 pb-6 text-center text-[11px] font-mono text-slate-500">
        Version {__APP_VERSION__}
      </p>
    </div>
  );
};
