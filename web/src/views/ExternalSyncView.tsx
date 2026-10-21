import React, { useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { BambooHRService, BambooHRTestReport, BambooWebhookEvent } from '../services/bamboohrService';
import { ZonarService, ZonarSerialReport, ZonarRouteWriteReport, ZonarTestReport } from '../services/zonarService';
import { BusPlannerService, BusPlannerSyncReport } from '../services/busplannerService';

export const ExternalSyncView: React.FC = () => {
  const { isFrench } = useI18n();

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
  const [zonarRouteSyncEnabled, setZonarRouteSyncEnabled] = useState(false);
  const [zonarRouteSyncSaved, setZonarRouteSyncSaved] = useState(false);
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

  const [plannerEnabled, setPlannerEnabled] = useState(false);
  const [plannerEnabledSaved, setPlannerEnabledSaved] = useState(false);
  const [plannerBaseUrl, setPlannerBaseUrl] = useState('https://school.mybusplanner.ca');
  const [plannerUsername, setPlannerUsername] = useState('');
  const [plannerPassword, setPlannerPassword] = useState('');
  const [plannerPasswordSet, setPlannerPasswordSet] = useState(false);
  const [plannerOperator, setPlannerOperator] = useState('4S');
  const [plannerTimes, setPlannerTimes] = useState<string[]>(['05:00']);
  const [plannerSaving, setPlannerSaving] = useState(false);
  const [plannerRunning, setPlannerRunning] = useState(false);
  const [plannerStatus, setPlannerStatus] = useState<string | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerReport, setPlannerReport] = useState<BusPlannerSyncReport | null>(null);
  const [plannerLastSyncAt, setPlannerLastSyncAt] = useState('');

  useEffect(() => {
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
        setZonarRouteSyncEnabled(!!s.routeSyncEnabled);
        setZonarRouteSyncSaved(!!s.routeSyncEnabled);
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

    BusPlannerService.getSettings()
      .then((s) => {
        setPlannerEnabled(!!s.enabled);
        setPlannerEnabledSaved(!!s.enabled);
        setPlannerBaseUrl(s.baseUrl || 'https://school.mybusplanner.ca');
        setPlannerUsername(s.username || '');
        setPlannerPasswordSet(!!s.passwordConfigured);
        setPlannerOperator(s.operatorId || '4S');
        setPlannerTimes(s.syncTimes && s.syncTimes.length > 0 ? s.syncTimes : ['05:00']);
        setPlannerLastSyncAt(s.lastSyncAt || '');
        setPlannerPassword('');
      })
      .catch((err) => console.error('Failed to load BusPlanner settings:', err));
  }, []);

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
        routeSyncEnabled: zonarRouteSyncEnabled,
        customer: zonarCustomer.trim(),
        username: zonarUsername.trim(),
        password: zonarPassword.trim() || undefined,
        busyIntervalMinutes: zonarBusyMinutes || 1,
        idleIntervalMinutes: zonarIdleMinutes || 10,
        gpsSerialSyncTime: zonarSerialTime || '03:00',
      });
      setZonarEnabled(!!saved.enabled);
      setZonarRouteSyncEnabled(!!saved.routeSyncEnabled);
      setZonarRouteSyncSaved(!!saved.routeSyncEnabled);
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
  const applyPlannerSettings = (saved: {
    enabled: boolean;
    baseUrl: string;
    username: string;
    passwordConfigured: boolean;
    operatorId: string;
    syncTimes: string[];
    lastSyncAt?: string;
  }) => {
    setPlannerEnabled(!!saved.enabled);
    setPlannerEnabledSaved(!!saved.enabled);
    setPlannerBaseUrl(saved.baseUrl || 'https://school.mybusplanner.ca');
    setPlannerUsername(saved.username || '');
    setPlannerPasswordSet(!!saved.passwordConfigured);
    setPlannerOperator(saved.operatorId || '4S');
    setPlannerTimes(saved.syncTimes && saved.syncTimes.length > 0 ? saved.syncTimes : ['05:00']);
    setPlannerLastSyncAt(saved.lastSyncAt || '');
    setPlannerPassword('');
  };

  const handleSavePlanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlannerSaving(true);
    setPlannerStatus(null);
    setPlannerError(null);
    try {
      const saved = await BusPlannerService.saveSettings({
        enabled: plannerEnabled,
        baseUrl: plannerBaseUrl.trim(),
        username: plannerUsername.trim(),
        password: plannerPassword.trim() || undefined,
        operatorId: plannerOperator.trim() || '4S',
        syncTimes: plannerTimes.filter((value) => value.trim() !== ''),
      });
      applyPlannerSettings(saved);
      setPlannerStatus(
        isFrench
          ? 'Paramètres BusPlanner enregistrés. Le mot de passe reste sur le serveur.'
          : 'BusPlanner settings saved. The password stays on the server.'
      );
    } catch (err: any) {
      setPlannerError(err.message || (isFrench ? 'Échec de l\'enregistrement BusPlanner' : 'Failed to save BusPlanner settings'));
    } finally {
      setPlannerSaving(false);
    }
  };

  const handleSyncPlanner = async () => {
    setPlannerRunning(true);
    setPlannerStatus(null);
    setPlannerError(null);
    try {
      const report = await BusPlannerService.syncNow();
      setPlannerReport(report);
      setPlannerLastSyncAt(report.syncedAt || '');
      setPlannerStatus(report.message);
    } catch (err: any) {
      setPlannerError(err.message || (isFrench ? 'La synchronisation BusPlanner a échoué' : 'BusPlanner sync failed'));
    } finally {
      setPlannerRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {isFrench ? 'Synchronisation des données externes' : 'External Data Sync'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {isFrench
            ? 'BambooHR, Zonar et BusPlanner. Les clés restent sur le serveur. BusPlanner est enregistré dans staging seulement.'
            : 'BambooHR, Zonar, and BusPlanner. Keys stay on the server. BusPlanner is saved to staging only.'}
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
              ? 'Une fois par jour, heure d\'Ottawa. Les numeros GPS sont copies sur les vehicules.'
              : 'Once per day, Ottawa time. GPS serials are copied onto vehicles.'}
            {zonarLastSerialAt
              ? ` ${isFrench ? 'Derniere execution' : 'Last run'}: ${zonarLastSerialAt}. ${zonarLastSerialCount} ${isFrench ? 'vehicules ont un numero GPS' : 'vehicles have a GPS serial'}.`
              : ''}
            {zonarLastRouteAt
              ? ` ${isFrench ? 'Apercu des lignes' : 'Route preview'}: ${zonarLastRouteAt} (${zonarLastRouteCount}).`
              : ''}
          </p>
        </div>

        <label className="flex items-start gap-2.5 max-w-xl cursor-pointer">
          <input
            type="checkbox"
            checked={zonarRouteSyncEnabled}
            onChange={(e) => setZonarRouteSyncEnabled(e.target.checked)}
            className="mt-0.5 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-xs text-slate-200">
            <span className="font-bold">{isFrench ? 'Synchroniser les lignes vers Zonar' : 'Sync route to Zonar'}</span>
            <span className="block text-[11px] text-slate-500 mt-0.5">
              {isFrench
                ? 'Desactive par defaut. Une fois enregistre, les numeros de ligne sont prepares a l\'heure du numero GPS. Rien n\'est envoye a Zonar.'
                : 'Off by default. After you save, route numbers are prepared at the GPS serial time. Nothing is sent to Zonar.'}
            </span>
          </span>
        </label>

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
            disabled={zonarRouteRunning || !zonarRouteSyncSaved}
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

      <form
        onSubmit={handleSavePlanner}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              {isFrench ? 'Synchronisation BusPlanner' : 'BusPlanner Sync'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isFrench
                ? 'Les lignes, écoles, arrêts et élèves lus chez BusPlanner sont enregistrés dans staging. Les dossiers actifs du dispatch ne sont pas modifiés.'
                : 'Routes, schools, stops, and students read from BusPlanner are saved to staging. Live dispatch records are not changed.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={plannerEnabled}
              onChange={(e) => setPlannerEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            <span className="ml-3 text-xs font-semibold text-slate-300">
              {plannerEnabled ? (isFrench ? 'Sync activé' : 'Sync enabled') : (isFrench ? 'Sync désactivé' : 'Sync disabled')}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-xs text-slate-400 sm:col-span-2">
            {isFrench ? 'Adresse BusPlanner' : 'BusPlanner address'}
            <input
              value={plannerBaseUrl}
              onChange={(e) => setPlannerBaseUrl(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            {isFrench ? 'Nom d\'utilisateur' : 'Username'}
            <input
              value={plannerUsername}
              onChange={(e) => setPlannerUsername(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            {isFrench ? 'Mot de passe' : 'Password'}
            <input
              type="password"
              value={plannerPassword}
              onChange={(e) => setPlannerPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={plannerPasswordSet
                ? (isFrench ? 'Laisser vide pour garder le mot de passe' : 'Leave blank to keep the saved password')
                : (isFrench ? 'Mot de passe BusPlanner' : 'BusPlanner password')}
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <span className="block mt-1 text-[11px] text-slate-500">
              {isFrench ? 'Le mot de passe reste sur le serveur.' : 'The password stays on the server.'}
            </span>
          </label>
          <label className="block text-xs text-slate-400">
            {isFrench ? 'Opérateur' : 'Operator'}
            <input
              value={plannerOperator}
              onChange={(e) => setPlannerOperator(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <span className="block mt-1 text-[11px] text-slate-500">
              {isFrench ? 'Seules les lignes de cet opérateur sont enregistrées. Défaut : 4S.' : 'Only routes for this operator are saved. Default is 4S.'}
            </span>
          </label>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-slate-400">
            {isFrench ? 'Heures de synchronisation (Ottawa)' : 'Sync times (Ottawa)'}
          </div>
          <p className="text-[11px] text-slate-500">
            {isFrench
              ? 'Chaque heure est exécutée une fois par jour. Ajoutez plusieurs heures pour synchroniser plusieurs fois dans la journée. Maximum 8.'
              : 'Each time runs once per day. Add more than one time to sync several times a day. Maximum 8.'}
          </p>
          {plannerTimes.map((value, index) => (
            <div key={`planner-time-${index}`} className="flex items-center gap-2">
              <input
                type="time"
                value={value}
                onChange={(e) => {
                  const next = [...plannerTimes];
                  next[index] = e.target.value;
                  setPlannerTimes(next);
                }}
                className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
              />
              {plannerTimes.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPlannerTimes(plannerTimes.filter((_, i) => i !== index))}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-800"
                >
                  {isFrench ? 'Retirer' : 'Remove'}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={plannerTimes.length >= 8}
            onClick={() => setPlannerTimes([...plannerTimes, '12:00'])}
            className="px-3 py-2 text-xs font-semibold text-amber-200 border border-amber-500/40 rounded-xl hover:bg-amber-500/10 disabled:opacity-40"
          >
            {isFrench ? 'Ajouter une heure' : 'Add a time'}
          </button>
        </div>

        {plannerLastSyncAt && (
          <p className="text-[11px] text-slate-500">
            {isFrench ? 'Dernière synchronisation' : 'Last sync'}: {plannerLastSyncAt}
          </p>
        )}
        {plannerStatus && <p className="text-xs text-emerald-300">{plannerStatus}</p>}
        {plannerError && <p className="text-xs text-rose-300">{plannerError}</p>}
        {plannerReport && (
          <div className="text-xs text-slate-300 space-y-1">
            <p>
              {isFrench ? 'Lignes' : 'Routes'}: {plannerReport.routeCount}
              {' · '}
              {isFrench ? 'Parcours' : 'Runs'}: {plannerReport.runCount}
              {' · '}
              {isFrench ? 'Écoles' : 'Schools'}: {plannerReport.schoolCount}
              {' · '}
              {isFrench ? 'Arrêts' : 'Stops'}: {plannerReport.stopCount}
              {' · '}
              {isFrench ? 'Élèves aux arrêts' : 'Student stops'}: {plannerReport.studentStopCount}
              {' · '}
              {isFrench ? 'Élèves' : 'Students'}: {plannerReport.studentCount}
            </p>
            {plannerReport.preview.length > 0 && (
              <p className="font-mono text-[11px] text-slate-400">{plannerReport.preview.join(', ')}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={plannerSaving}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold disabled:opacity-50"
          >
            {plannerSaving
              ? (isFrench ? 'Enregistrement...' : 'Saving...')
              : (isFrench ? 'Enregistrer BusPlanner' : 'Save BusPlanner')}
          </button>
          <button
            type="button"
            disabled={plannerRunning || !plannerEnabledSaved}
            onClick={handleSyncPlanner}
            className="px-4 py-2 rounded-xl border border-slate-600 text-xs font-semibold text-slate-200 disabled:opacity-40"
          >
            {plannerRunning
              ? (isFrench ? 'Synchronisation...' : 'Syncing...')
              : (isFrench ? 'Synchroniser maintenant' : 'Sync now')}
          </button>
        </div>
      </form>
    </div>
  );
};
