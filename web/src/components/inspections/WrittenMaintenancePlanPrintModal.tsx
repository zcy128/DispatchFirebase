import React from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { ProvinceComplianceConfig } from '../../types/compliance';
import { PreventiveMaintenanceRecord } from '../../types/vehicleInspection';
import { useI18n } from '../../contexts/I18nContext';

interface WrittenMaintenancePlanPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  complianceConfig: ProvinceComplianceConfig;
  pmRecords: PreventiveMaintenanceRecord[];
}

export const WrittenMaintenancePlanPrintModal: React.FC<WrittenMaintenancePlanPrintModalProps> = ({
  isOpen,
  onClose,
  complianceConfig,
  pmRecords
}) => {
  const { isFrench } = useI18n();

  if (!isOpen) return null;

  const isOntario = complianceConfig.province === 'ON';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-sm flex flex-col items-center p-4 sm:p-6">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3.5 mb-4 flex items-center justify-between shadow-xl print:hidden">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">
              {isFrench
                ? 'Plan d\'entretien écrit et dossier d\'audit réglementaire à 5 éléments'
                : 'Written Maintenance Plan & Statutory 5-Element Audit Dossier'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {isOntario
                ? isFrench
                  ? 'Politique d\'entretien préventif CVOR de l\'Ontario (« Écrire ce que l\'on fait, faire ce que l\'on écrit »)'
                  : 'Ontario MTO CVOR "Write What You Do, Do What You Write" Preventive Maintenance Policy'
                : isFrench
                ? 'Registre d\'entretien mécanique obligatoire SAAQ du Québec et Fiche d\'entretien'
                : 'Québec SAAQ Entretien Mécanique Obligatoire & Fiche d\'Entretien Register'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 transition shadow"
          >
            <Printer className="w-4 h-4" />
            <span>{isFrench ? 'Imprimer le dossier / Enregistrer PDF' : 'Print Dossier / Save PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title={isFrench ? 'Fermer l\'aperçu (Échap)' : 'Close Preview (Esc)'}
            className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
          >
            <X className="w-4 h-4" />
            <span>{isFrench ? 'Fermer' : 'Close'}</span>
          </button>
        </div>
      </div>

      {/* Printable A4 Sheet */}
      <div className="w-full max-w-5xl bg-white text-slate-900 rounded-xl shadow-2xl p-8 sm:p-10 space-y-6 print:shadow-none print:p-0 print:max-w-none">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-lg">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {isFrench
                  ? 'Plan officiel d\'entretien préventif réglementaire du transporteur'
                  : 'Official Carrier Statutory Preventive Maintenance Plan'}
              </div>
              <h1 className="text-xl font-black text-slate-900">
                {isOntario
                  ? isFrench
                    ? 'PLAN D\'ENTRETIEN ÉCRIT CVOR MTO DE L\'ONTARIO (CALENDRIER A / B / C)'
                    : 'ONTARIO MTO CVOR WRITTEN MAINTENANCE PLAN (A / B / C SCHEDULE)'
                  : 'QUÉBEC SAAQ PROGRAMME D\'ENTRETIEN MÉCANIQUE OBLIGATOIRE (FICHE D\'ENTRETIEN)'}
              </h1>
              <div className="text-xs text-slate-600 font-mono mt-0.5">
                {isFrench ? 'Immatriculation' : 'Registration'}: <strong>{complianceConfig.cvorOrPevlNumber}</strong> •{' '}
                {isFrench ? 'Version du plan' : 'Plan Version'}:{' '}
                <strong>{complianceConfig.writtenPlanVersion || 'WMP-2026.2'}</strong> •{' '}
                {isFrench ? 'Conservation' : 'Retention'}:{' '}
                <strong>
                  {isFrench
                    ? `Minimum ${complianceConfig.retentionYears} ans (>2 ans dans BigQuery)`
                    : `Minimum ${complianceConfig.retentionYears} Years (>2 Yrs in BigQuery)`}
                </strong>
              </div>
            </div>
          </div>

          <div className="text-right text-xs font-mono text-slate-600">
            <div>
              {isFrench ? 'Juridiction' : 'Jurisdiction'}:{' '}
              <strong>{complianceConfig.provinceName} ({complianceConfig.province})</strong>
            </div>
            <div>
              {isFrench ? 'Approuvé par' : 'Approved By'}:{' '}
              <strong>{complianceConfig.writtenPlanApprovedBy || 'Fleet Safety Director'}</strong>
            </div>
            <div>
              {isFrench ? 'Généré le' : 'Generated'}: <strong>{new Date().toISOString().slice(0, 10)}</strong>
            </div>
          </div>
        </div>

        {/* Section 1: Written Maintenance Schedule Intervals */}
        <div className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 border-l-4 border-amber-500 pl-2.5">
            {isFrench
              ? '1. Calendrier d\'entretien préventif écrit et politique tolérance zéro (« Écrire ce que l\'on fait, faire ce que l\'on écrit »)'
              : '1. Written Preventive Maintenance Schedule & Zero-Overdue Policy ("Write What You Do, Do What You Write")'}
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed">
            {isOntario
              ? isFrench
                ? 'Conformément au Règlement 611 du Code de la route de l\'Ontario et aux normes d\'audit CVOR du MTO, chaque autobus scolaire de la flotte doit subir un entretien préventif programmé strictement avant d\'atteindre SOIT le kilométrage maximal SOIT le nombre maximal de jours civils ci-dessous (selon la première éventualité). Tout dépassement constitue une infraction d\'entretien préventif CVOR.'
                : 'Pursuant to Ontario Highway Traffic Act O. Reg. 611 and MTO Commercial Vehicle Operator\'s Registration (CVOR) audit standards, every school bus in the fleet must undergo scheduled preventive maintenance strictly prior to reaching EITHER the maximum kilometer reading OR the maximum calendar day interval below (whichever comes first). Exceeding either limit constitutes a CVOR Preventive Maintenance Violation.'
              : isFrench
              ? 'Conformément au Code de la sécurité routière (CSR) du Québec et aux règlements de la SAAQ, en plus de l\'inspection mécanique semestrielle (vignette VMP) aux 6 mois, chaque autobus scolaire doit subir un entretien mécanique obligatoire au moins une fois tous les 6 mois (intercalé aux 90 jours) peu importe le kilométrage, consigné sur une Fiche d\'entretien SAAQ signée.'
              : 'Pursuant to the Québec Code de la sécurité routière (CSR) and SAAQ regulations, in addition to the semi-annual VMP sticker inspection every 6 months, every school bus must undergo Mandatory Mechanical Maintenance (Entretien mécanique obligatoire) at least once every 6 months (interleaved every 90 days) regardless of mileage, documented on a signed SAAQ Fiche d\'entretien.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                {isFrench ? 'Service A (Mineur / Graissage)' : 'Service A (Minor / Grease)'}
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {isFrench
                  ? `Aux ${complianceConfig.serviceAIntervalKm.toLocaleString()} km ou ${complianceConfig.serviceAIntervalDays} jours`
                  : `Every ${complianceConfig.serviceAIntervalKm.toLocaleString()} km or ${complianceConfig.serviceAIntervalDays} Days`}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                {isFrench
                  ? 'Lubrification châssis, pivots et cames en S, appoint des fluides, pression des pneus et course des freins.'
                  : 'Chassis kingpin & s-cam lubrication, fluid top-up, tire psi, lights & brake stroke visual check.'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                {isFrench ? 'Service B (Vidange d\'huile et filtre)' : 'Service B (Oil & Filter PM)'}
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {isFrench
                  ? `Aux ${complianceConfig.serviceBIntervalKm.toLocaleString()} km ou ${complianceConfig.serviceBIntervalDays} jours`
                  : `Every ${complianceConfig.serviceBIntervalKm.toLocaleString()} km or ${complianceConfig.serviceBIntervalDays} Days`}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                {isFrench
                  ? `Vidange complète d'huile moteur (${complianceConfig.defaultEngineOilSpec}) et filtre, ajustement des freins arrière et graissage.`
                  : `Full engine oil (${complianceConfig.defaultEngineOilSpec}) & filter replacement, rear brake slack adjustment, full chassis lube.`}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                {isFrench ? 'Service C (Entretien majeur)' : 'Service C (Major Drivetrain)'}
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {isFrench
                  ? `Aux ${complianceConfig.serviceCIntervalKm.toLocaleString()} km ou ${complianceConfig.serviceCIntervalDays} jours`
                  : `Every ${complianceConfig.serviceCIntervalKm.toLocaleString()} km or ${complianceConfig.serviceCIntervalDays} Days`}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                {isFrench
                  ? 'Filtres à carburant/séparateur d\'eau, transmission et différentiel, liquide de refroidissement, direction et suspension.'
                  : 'Fuel/water separator filters, transmission & differential service, coolant test, steering & suspension torque.'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Québec Fiche d'entretien</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {isFrench
                  ? `Aux ${complianceConfig.qcMandatoryMaintenanceDays} jours (Max 180j)`
                  : `Every ${complianceConfig.qcMandatoryMaintenanceDays} Days (Max 180d)`}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                {isFrench
                  ? 'Entretien préventif obligatoire SAAQ intercalé entre les inspections semestrielles VMP, signé par le mécanicien.'
                  : 'Mandatory SAAQ preventive maintenance interleaved between semi-annual VMP sticker inspections, signed by mechanic.'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: 5 Mandatory Statutory Record Elements */}
        <div className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 border-l-4 border-amber-500 pl-2.5">
            {isFrench
              ? '2. Cinq éléments obligatoires du dossier d\'entretien (Conservés au moins 2 ans)'
              : '2. Five Mandatory Statutory Record Elements (Retained Minimum 2 Years in Vehicle Dossier)'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              {isFrench ? (
                <>
                  <strong>1. Identification :</strong> Unité #, plaque d'immatriculation et NIV complet.
                </>
              ) : (
                <>
                  <strong>1. Vehicle ID:</strong> Unit Number, License Plate #, and full VIN.
                </>
              )}
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              {isFrench ? (
                <>
                  <strong>2. Date d'entretien :</strong> Date exacte d'exécution et prochaine échéance.
                </>
              ) : (
                <>
                  <strong>2. Service Date:</strong> Exact date performed & next scheduled due date.
                </>
              )}
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              {isFrench ? (
                <>
                  <strong>3. Odomètre et heures :</strong> Kilométrage exact et heures moteur pour l'audit.
                </>
              ) : (
                <>
                  <strong>3. Odometer & Hours:</strong> Exact km reading & engine hours for auditor interval verification.
                </>
              )}
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              {isFrench ? (
                <>
                  <strong>4. Travaux et factures :</strong> Litres d'huile, filtres, graissage, freins et # facture/BT.
                </>
              ) : (
                <>
                  <strong>4. Itemized Work & Invoices:</strong> Oil spec/liters, filters, grease, brake adjustment & parts invoice #.
                </>
              )}
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              {isFrench ? (
                <>
                  <strong>5. Signature exécutant :</strong> Signature du mécanicien ou nom et facture de l'atelier.
                </>
              ) : (
                <>
                  <strong>5. Performer Sign-Off:</strong> Certified mechanic signature or external repair shop name & invoice.
                </>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Fleet Preventive Maintenance & Oil Change Audit Log */}
        <div className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 border-l-4 border-amber-500 pl-2.5">
            {isFrench
              ? `3. Registre d'audit d'entretien préventif et vidanges d'huile (${pmRecords.length} dossiers)`
              : `3. Fleet Preventive Maintenance & Oil Change Audit Register (${pmRecords.length} Records)`}
          </h2>

          <div className="overflow-x-auto border border-slate-300 rounded-lg">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 uppercase font-bold">
                  <th className="py-2 px-2.5 border-r border-slate-300">
                    {isFrench ? '1. Unité / Plaque / NIV' : '1. Unit / Plate / VIN'}
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-300">
                    {isFrench ? '2. Date et catégorie' : '2. Date & Tier'}
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-300">
                    {isFrench ? '3. Odomètre et intervalle' : '3. Odometer & Interval Delta'}
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-300">
                    {isFrench ? '4. Travaux détaillés et facture #' : '4. Itemized Work & Invoice #'}
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-300">
                    {isFrench ? '5. Signature mécanicien / atelier' : '5. Mechanic / Shop Sign-Off'}
                  </th>
                  <th className="py-2 px-2.5">{isFrench ? 'Statut d\'audit' : 'Audit Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pmRecords.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 px-2.5 border-r border-slate-200 font-mono">
                      <div className="font-bold text-slate-900">
                        {isFrench ? 'Unité' : 'Unit'} #{r.unitNumber} ({r.plateNumber})
                      </div>
                      <div className="text-[10px] text-slate-500">VIN: {r.vin}</div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-200 font-mono">
                      <div className="font-bold text-slate-900">{r.serviceDate}</div>
                      <div className="text-[10px] text-slate-600">{r.serviceTier}</div>
                      <div className="text-[10px] text-slate-500">
                        {isFrench ? 'Prochain' : 'Next'}: {r.nextDueDate}
                      </div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-200 font-mono">
                      <div className="font-bold text-slate-900">{r.odometerAtServiceKm.toLocaleString()} km</div>
                      <div className="text-[10px] text-slate-600">
                        {isFrench ? 'Intervalle' : 'Interval'}: {r.kmDrivenSinceLastService.toLocaleString()} / {r.planAllowedMaxKm.toLocaleString()} km
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {isFrench ? 'Jours' : 'Elapsed'}: {r.daysElapsedSinceLastService}/{r.planAllowedMaxDays}d • {r.engineHoursAtService} hrs
                      </div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-200">
                      <div className="font-semibold text-slate-900">
                        {r.checklist.engineOilChanged
                          ? `${r.checklist.oilQuantityLiters}L ${r.checklist.oilSpecification} + ${isFrench ? 'Filtre à huile' : 'Oil Filter'}`
                          : isFrench
                          ? 'Lubrification du châssis et EP de sécurité'
                          : 'Chassis Lubrication & Safety PM'}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {[
                          r.checklist.chassisLubricated ? (isFrench ? 'Graissé' : 'Greased') : null,
                          r.checklist.rearBrakeSlackAdjusted ? (isFrench ? 'Freins ajustés' : 'Brake Slack Adj') : null,
                          r.checklist.tirePressureAdjusted ? (isFrench ? 'Pression pneus' : 'Tire PSI') : null,
                          r.checklist.saaqFicheEntretienSigned ? 'Fiche SAAQ' : null
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        WO: {r.workOrderNumber} | Inv: {r.partsInvoiceNumber}
                      </div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-200">
                      <div className="font-bold text-slate-900">{r.mechanicName}</div>
                      <div className="text-[10px] text-slate-600">{r.shopName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{r.mechanicSignature}</div>
                    </td>
                    <td className="py-2 px-2.5 font-mono text-[10px]">
                      {r.wasPerformedOnTime ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isFrench ? 'CONFORME' : 'COMPLIANT'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {isFrench ? 'INTERVALLE DÉPASSÉ' : 'INTERVAL EXCEEDED'}
                        </span>
                      )}
                      {r.isArchivedToBigQuery && (
                        <div className="text-[9px] text-sky-700 mt-0.5">[BigQuery &gt;2Yrs]</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auditor Sign-off Footer */}
        <div className="pt-4 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-600">
          <div>
            <div className="font-bold text-slate-900 uppercase">
              {isFrench
                ? 'Attestation du responsable de la maintenance de la flotte'
                : 'Carrier Fleet Maintenance Officer Attestation'}
            </div>
            <p className="text-[11px] mt-1">
              {isFrench
                ? 'Je certifie que le plan d\'entretien écrit et les dossiers d\'entretien ci-dessus reflètent fidèlement l\'entretien préventif effectué sur la flotte conformément à la norme NSC 11B, au CVOR du MTO et aux règlements de la SAAQ.'
                : 'I certify that the Written Maintenance Plan and vehicle maintenance records above accurately reflect actual preventive maintenance performed on the fleet in accordance with NSC Standard 11B, MTO CVOR, and SAAQ regulations.'}
            </p>
          </div>
          <div className="flex flex-col justify-end items-start sm:items-end font-mono text-[11px]">
            <div>
              {isFrench ? 'Signature autorisée' : 'Authorized Signature'}: ____________________________________
            </div>
            <div className="mt-1">
              {isFrench ? 'Titre' : 'Title'}:{' '}
              {complianceConfig.writtenPlanApprovedBy || 'Director of Fleet Safety & Maintenance'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
