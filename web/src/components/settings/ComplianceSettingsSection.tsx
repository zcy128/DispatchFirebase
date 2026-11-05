import React, { memo, useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { useCompliance } from '../../contexts/ComplianceContext';
import { OperatingProvince, ProvinceComplianceConfig } from '../../types/compliance';
import { useScheduledReset } from './useScheduledReset';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  Save,
  ShieldCheck,
  Wrench
} from 'lucide-react';

const ProvinceModelCards = memo(function ProvinceModelCards({
  isFrench,
  province,
  onSelect,
}: {
  isFrench: boolean;
  province: OperatingProvince;
  onSelect: (province: OperatingProvince) => void;
}) {
  return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ontario Card */}
          <div
            onClick={() => onSelect('ON')}
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
            onClick={() => onSelect('QC')}
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
  );
});

const ComplianceGuide = memo(function ComplianceGuide({ isFrench }: { isFrench: boolean }) {
  return (
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
  );
});

export const ComplianceSettingsSection = memo(function ComplianceSettingsSection() {
  const { isFrench } = useI18n();
  const { province, config: complianceConfig, isOntario, setProvince, updateConfig } = useCompliance();
  const [provForm, setProvForm] = useState<ProvinceComplianceConfig>(complianceConfig);
  const [provSaving, setProvSaving] = useState(false);
  const [provStatus, setProvStatus] = useState<string | null>(null);
  const [provError, setProvError] = useState<string | null>(null);
  const scheduleReset = useScheduledReset();

  useEffect(() => {
    setProvForm(complianceConfig);
  }, [complianceConfig]);

  const handleSelectProvince = useCallback(async (newProv: OperatingProvince) => {
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
      scheduleReset(() => setProvStatus(null), 4000);
    } catch (err: any) {
      setProvError(err.message || (isFrench ? 'Échec du changement de province' : 'Failed to switch province'));
    } finally {
      setProvSaving(false);
    }
  }, [isFrench, province, provForm.province, scheduleReset, setProvince]);

  const handleSaveComplianceSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setProvStatus(null);
    setProvError(null);
    const alertDays = Number(provForm.advancePreInspectionDays);
    const retentionYears = Number(provForm.retentionYears);
    const intervals = [
      provForm.serviceAIntervalKm,
      provForm.serviceAIntervalDays,
      provForm.serviceBIntervalKm,
      provForm.serviceBIntervalDays,
      provForm.serviceCIntervalKm,
      provForm.serviceCIntervalDays
    ];
    if (!Number.isFinite(alertDays) || alertDays < 7 || alertDays > 60) {
      setProvError(isFrench
        ? 'Le délai d\'alerte doit être un nombre entre 7 et 60 jours.'
        : 'Advance pre-inspection alert must be a number from 7 to 60 days.');
      return;
    }
    if (!Number.isFinite(retentionYears) || retentionYears < 1 || retentionYears > 7) {
      setProvError(isFrench
        ? 'La conservation doit être un nombre entre 1 et 7 ans.'
        : 'Archive retention must be a number from 1 to 7 years.');
      return;
    }
    if (intervals.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0)) {
      setProvError(isFrench
        ? 'Les intervalles d\'entretien doivent être des nombres supérieurs à 0.'
        : 'Maintenance intervals must be numbers greater than 0.');
      return;
    }
    setProvSaving(true);
    try {
      await updateConfig({
        ...provForm,
        cvorOrPevlNumber: (provForm.cvorOrPevlNumber || '').trim(),
        pepNumber: (provForm.pepNumber || '').trim(),
        notes: (provForm.notes || '').trim(),
        defaultEngineOilSpec: (provForm.defaultEngineOilSpec || '').trim(),
        writtenPlanVersion: (provForm.writtenPlanVersion || '').trim(),
        writtenPlanApprovedBy: (provForm.writtenPlanApprovedBy || '').trim()
      });
      setProvStatus(
        isFrench
          ? 'Paramètres de conformité et plan d\'entretien enregistrés avec succès.'
          : 'Compliance parameters saved successfully to cloud & local storage.'
      );
      scheduleReset(() => setProvStatus(null), 3500);
    } catch (err: any) {
      setProvError(err.message || (isFrench ? 'Échec de l\'enregistrement' : 'Failed to save compliance settings'));
    } finally {
      setProvSaving(false);
    }
  };

  return (
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
      <ProvinceModelCards
        isFrench={isFrench}
        province={province}
        onSelect={handleSelectProvince}
      />
      <ComplianceGuide isFrench={isFrench} />
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
                    value={provForm.defaultEngineOilSpec || ''}
                    placeholder="e.g. 15W-40 CK-4"
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
                    value={provForm.writtenPlanVersion || ''}
                    placeholder="Plan version"
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
                    value={provForm.writtenPlanApprovedBy || ''}
                    placeholder="Approver name or title"
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
  );
});
