import React, { useState } from 'react';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import { useCompliance } from '../contexts/ComplianceContext';
import { useI18n } from '../contexts/I18nContext';
import {
  AlertTriangle,
  Phone,
  ShieldCheck,
  Bus,
  UserCheck
} from 'lucide-react';

interface ComplianceViewProps {
  employees: Employee[];
  vehicles?: Vehicle[];
  onSelectEmployee: (emp: Employee) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  employees,
  vehicles = [],
  onSelectEmployee,
  onSelectVehicle
}) => {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const { config: complianceConfig, isOntario } = useCompliance();
  const { isFrench } = useI18n();

  const getDaysDiff = (dateStr: string) => {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  // Drivers CDL calculations
  const drivers = employees.filter((e) => e.driverLicense != null);
  const driverExpiredList = drivers.filter((d) => getDaysDiff(d.driverLicense!.expirationDate) <= 0);
  const driverUrgentList = drivers.filter((d) => {
    const days = getDaysDiff(d.driverLicense!.expirationDate);
    return days > 0 && days <= 30;
  });
  const driverCompliantList = drivers.filter((d) => getDaysDiff(d.driverLicense!.expirationDate) > 30);

  // Vehicle Semi-Annual Safety Inspection calculations
  const preInspectionWindow = complianceConfig.advancePreInspectionDays || 21;
  const vehiclesWithInspection = vehicles.map((v) => {
    const dueStr = v.nextInspectionDue || v.licenseExpiry || '2026-11-30';
    const daysLeft = getDaysDiff(dueStr);
    const isExpired = daysLeft <= 0;
    const isPreDue = !isExpired && daysLeft <= preInspectionWindow;
    const isArchived =
      v.hasInVehicleCertificate !== false &&
      v.hasDetailedMeasurementsArchived !== false &&
      v.hasProofOfRepairsAttached !== false;
    return {
      vehicle: v,
      dueStr,
      daysLeft,
      isExpired,
      isPreDue,
      isCompliant: !isExpired && !isPreDue,
      isArchived
    };
  });

  const vehExpired = vehiclesWithInspection.filter((v) => v.isExpired);
  const vehPreDue = vehiclesWithInspection.filter((v) => v.isPreDue);
  const vehCompliant = vehiclesWithInspection.filter((v) => v.isCompliant);
  const vehArchived = vehiclesWithInspection.filter((v) => v.isArchived);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title & Province Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>
              {isFrench ? 'Surveillance de la sécurité et de la conformité' : 'Safety & Regulatory Oversight'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isFrench
              ? 'Radar de sécurité de la flotte et de conformité réglementaire'
              : 'Fleet Safety & Statutory Compliance Radar'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {isFrench
              ? 'Suivi à double volet : Inspections mécaniques semestrielles et permis de conduire commerciaux (CDL).'
              : 'Dual-track compliance monitoring: Semi-annual mechanical inspections and commercial driver CDL certifications.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            isOntario
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
          }`}>
            <span>{isOntario ? '🇨🇦' : '⚜️'}</span>
            <span>{isOntario ? 'Ontario: DriveON PMVI (MTO / CVOR)' : 'Québec: SAAQ VMP / PEP (CTQ)'}</span>
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center space-x-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'vehicles'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bus className="w-4 h-4" />
          <span>
            {isFrench
              ? `Inspection mécanique semestrielle des véhicules (${vehicles.length})`
              : `Vehicle Semi-Annual Mechanical Inspection (${vehicles.length})`}
          </span>
          {vehPreDue.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
              {vehPreDue.length} {isFrench ? 'alerte' : 'alert'}
            </span>
          )}
          {vehExpired.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono">
              {vehExpired.length} {isFrench ? 'expiré' : 'expired'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('drivers')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'drivers'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>
            {isFrench
              ? `Permis CDL et qualifications des chauffeurs (${drivers.length})`
              : `Driver CDL & Qualifications (${drivers.length})`}
          </span>
          {driverUrgentList.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
              {driverUrgentList.length} urgent
            </span>
          )}
        </button>
      </div>

      {/* VEHICLES TAB */}
      {activeTab === 'vehicles' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-xs font-semibold text-rose-400 uppercase">
                {isFrench ? 'Expiré / Hors service' : 'Expired / Out of Service'}
              </span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-rose-400">{vehExpired.length}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Immobiliser immédiatement' : 'Ground immediately'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-xs font-semibold text-amber-400 uppercase">
                {isFrench
                  ? `Pré-inspection requise (Fenêtre ${preInspectionWindow}j)`
                  : `Pre-Inspection Due (${preInspectionWindow}d Window)`}
              </span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-amber-400">{vehPreDue.length}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Planifier vérification au dépôt' : 'Schedule yard check'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-xs font-semibold text-emerald-400 uppercase">
                {isFrench ? 'Flotte entièrement conforme' : 'Fully Compliant Fleet'}
              </span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-emerald-400">{vehCompliant.length}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Inspection mécanique réussie' : 'Passed mechanical test'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-xs font-semibold text-indigo-400 uppercase">
                {isFrench ? 'Archivage des dossiers d\'audit' : 'Audit Records Archival'}
              </span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-indigo-400">{vehArchived.length}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? '3 obligations légales remplies' : '3 statutory duties met'}
                </span>
              </div>
            </div>
          </div>

          {/* Urgent Pre-Inspection Notice Banner */}
          {vehPreDue.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  {isFrench
                    ? 'Alerte de pré-inspection anticipée (Vérification interne 2 à 3 semaines à l\'avance)'
                    : 'Advance Pre-Inspection Alert (2-3 Weeks Advance Yard Pre-Check)'}
                </span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                {isFrench ? (
                  <>
                    En vertu des règlements {isOntario ? 'DriveON / MTO de l\'Ontario' : 'SAAQ / PEP du Québec'}, les autobus scolaires dont l'inspection mécanique semestrielle est due d'ici <strong>{preInspectionWindow} jours</strong> doivent faire l'objet d'une pré-inspection interne au dépôt (épaisseur des garnitures de freins NSC 11B et suspension) afin d'éviter toute mise hors service le jour de l'examen officiel.
                  </>
                ) : (
                  <>
                    Under {isOntario ? 'Ontario DriveON / MTO' : 'Québec SAAQ / PEP'} regulations, school buses due for semi-annual mechanical inspection within <strong>{preInspectionWindow} days</strong> must be scheduled for advance yard inspection. Pre-emptively inspect brake lining thickness (NSC 11B mm requirements) and chassis bushings to prevent test failure or vehicle detention.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Vehicles Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 font-bold text-white text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>
                  {isFrench
                    ? `Registre d'inspection semestrielle de la flotte (${vehicles.length})`
                    : `Fleet Semi-Annual Inspection Roster (${vehicles.length})`}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  {isFrench ? 'Norme' : 'Standard'}: {complianceConfig.inspectionStandard}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {isFrench ? 'Trié par échéance la plus proche' : 'Sorted by closest due date'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-semibold">
                    <th className="py-3 px-4">{isFrench ? 'Unité # / Plaque' : 'Unit # / Plate'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Modèle et dépôt' : 'Model & Depot'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Prochaine inspection due' : 'Next Inspection Due'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Certificat / Vignette #' : 'Certificate / Sticker #'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Liste de contrôle d\'archivage' : 'Statutory Archival Checklist'}</th>
                    <th className="py-3 px-4 text-right">{isFrench ? 'Statut d\'inspection' : 'Inspection Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {vehiclesWithInspection
                    .sort((a, b) => new Date(a.dueStr).getTime() - new Date(b.dueStr).getTime())
                    .map(({ vehicle: v, dueStr, daysLeft, isExpired, isPreDue }) => {
                      return (
                        <tr
                          key={v.id}
                          onClick={() => onSelectVehicle && onSelectVehicle(v)}
                          className="hover:bg-slate-800/40 cursor-pointer transition"
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">
                              {isFrench ? 'Unité' : 'Unit'} #{v.unitNumber}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {v.plateNumber || (isFrench ? 'Sans plaque' : 'No Plate')}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-200">{v.manufacturer} {v.model}</div>
                            <div className="text-[11px] text-slate-400">{v.yardName || 'HQ-Central'}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            <div>{dueStr.substring(0, 10)}</div>
                            <div className="text-[11px] text-slate-500">
                              {daysLeft <= 0
                                ? isFrench
                                  ? 'En retard'
                                  : 'Overdue'
                                : isFrench
                                ? `${daysLeft} jours restants`
                                : `${daysLeft} days remaining`}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            <div className="text-[11px]">
                              Doc: <span className="text-slate-200">{v.inspectionCertificateNumber || (isOntario ? `DOC-ON-${v.unitNumber}` : `CVM-QC-${v.unitNumber}`)}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {isFrench ? 'Vignette' : 'Sticker'}: {v.inspectionStickerNumber || `STK-${v.unitNumber}-2026`}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span
                                title={
                                  isFrench
                                    ? 'Preuve à bord : Copie du certificat conservée dans le véhicule'
                                    : 'In-Vehicle Proof: Certificate copy carried in vehicle'
                                }
                                className={`px-1.5 py-0.5 rounded font-mono ${
                                  v.hasInVehicleCertificate !== false
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                [{isFrench ? 'À bord' : 'In-Cab'}]
                              </span>
                              <span
                                title={
                                  isFrench
                                    ? 'Fiche de mesures : Épaisseur des garnitures de freins et pneus'
                                    : 'Measurements Sheet: Brake lining and tire tread depths'
                                }
                                className={`px-1.5 py-0.5 rounded font-mono ${
                                  v.hasDetailedMeasurementsArchived !== false
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                [{isFrench ? 'Freins mm' : 'Brake mm'}]
                              </span>
                              <span
                                title={
                                  isFrench
                                    ? 'Preuve de réparations : Bons de travail et factures'
                                    : 'Proof of Repairs: Work orders & parts invoices'
                                }
                                className={`px-1.5 py-0.5 rounded font-mono ${
                                  v.hasProofOfRepairsAttached !== false
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-slate-800 text-slate-500'
                                }`}
                              >
                                [{isFrench ? 'Répar.' : 'Repairs'}]
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isExpired
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : isPreDue
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {isExpired
                                ? isFrench
                                  ? 'EXPIRÉ'
                                  : 'EXPIRED'
                                : isPreDue
                                ? isFrench
                                  ? `PRÉ-INSPECTION DUE (${daysLeft}j)`
                                  : `PRE-INSPECTION DUE (${daysLeft}d)`
                                : isFrench
                                ? 'Conforme'
                                : 'Compliant'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DRIVERS TAB */}
      {activeTab === 'drivers' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-xs font-semibold text-rose-400 uppercase">
                {isFrench ? 'Permis expirés' : 'Expired Licenses'}
              </span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-rose-400">{driverExpiredList.length}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Suspendre immédiatement' : 'Ground immediately'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-xs font-semibold text-amber-400 uppercase">
                {isFrench ? 'Expirant d\'ici 30 jours' : 'Expiring Within 30 Days'}
              </span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-amber-400">{driverUrgentList.length}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Renouvellement requis' : 'Renewal scheduled'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <span className="text-xs font-semibold text-emerald-400 uppercase">
                {isFrench ? 'Chauffeurs conformes' : 'Fully Compliant Drivers'}
              </span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-emerald-400">{driverCompliantList.length}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Admissibles à la répartition' : 'Eligible for dispatch'}
                </span>
              </div>
            </div>
          </div>

          {/* Urgent Warning Section */}
          {driverUrgentList.length > 0 && (
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
                <span>
                  {isFrench
                    ? 'Attention immédiate : Permis CDL expirant bientôt'
                    : 'Immediate Attention: CDL Licenses Expiring Soon'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {driverUrgentList.map((driver) => {
                  const days = getDaysDiff(driver.driverLicense!.expirationDate);
                  return (
                    <div
                      key={driver.id}
                      onClick={() => onSelectEmployee(driver)}
                      className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between hover:border-amber-500/50 cursor-pointer transition"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">{driver.fullName}</span>
                          <span className="font-mono text-xs text-slate-400">[{driver.employeeNumber}]</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {isFrench ? 'Permis' : 'License'} #{driver.driverLicense?.licenseId} • {driver.driverLicense?.licenseClass}
                        </p>
                        <p className="text-xs text-amber-400 font-semibold mt-1">
                          {isFrench ? 'Expire le :' : 'Expires:'}{' '}
                          {new Date(driver.driverLicense!.expirationDate).toLocaleDateString()} ({days}{' '}
                          {isFrench ? 'jours restants' : 'days left'})
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {driver.mobilePhone && (
                          <a
                            href={`tel:${driver.mobilePhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Drivers Roster */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 font-bold text-white text-sm flex items-center justify-between">
              <span>
                {isFrench
                  ? `Tous les dossiers des chauffeurs commerciaux (${drivers.length})`
                  : `All Commercial Driver Records (${drivers.length})`}
              </span>
              <span className="text-xs text-slate-400 font-normal">
                {isFrench ? 'Classé par date d\'expiration' : 'Ranked by closest expiration date'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-semibold">
                    <th className="py-3 px-4">{isFrench ? 'Chauffeur' : 'Driver'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Dépôt' : 'Depot'}</th>
                    <th className="py-3 px-4">{isFrench ? 'N° de permis' : 'License ID'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Classe' : 'Class'}</th>
                    <th className="py-3 px-4">{isFrench ? 'Date d\'expiration' : 'Expiration Date'}</th>
                    <th className="py-3 px-4 text-right">{isFrench ? 'Statut' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {drivers
                    .sort(
                      (a, b) =>
                        new Date(a.driverLicense!.expirationDate).getTime() -
                        new Date(b.driverLicense!.expirationDate).getTime()
                    )
                    .map((d) => {
                      const days = getDaysDiff(d.driverLicense!.expirationDate);
                      return (
                        <tr
                          key={d.id}
                          onClick={() => onSelectEmployee(d)}
                          className="hover:bg-slate-800/40 cursor-pointer transition"
                        >
                          <td className="py-3 px-4 font-bold text-white">{d.fullName}</td>
                          <td className="py-3 px-4 text-slate-300">{d.yardId}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{d.driverLicense?.licenseId}</td>
                          <td className="py-3 px-4 text-amber-400 font-semibold">
                            {d.driverLicense?.licenseClass}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono">
                            {new Date(d.driverLicense!.expirationDate).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                days <= 0
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : days <= 30
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {days <= 0
                                ? isFrench
                                  ? 'EXPIRÉ'
                                  : 'EXPIRED'
                                : days <= 30
                                ? isFrench
                                  ? `${days}j restants`
                                  : `${days}d left`
                                : isFrench
                                ? 'Conforme'
                                : 'Compliant'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
