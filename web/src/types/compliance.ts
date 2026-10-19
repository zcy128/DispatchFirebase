export type OperatingProvince = 'ON' | 'QC';

export interface ProvinceComplianceConfig {
  province: OperatingProvince;
  provinceName: string;
  regulatoryBody: string;
  inspectionFramework: string;
  inspectionType: string;
  certificateTitle: string;
  decalTitle: string;
  inspectionStandard: string;
  inspectionDurationHours: string;
  fleetDowntimeEstimate: string;
  advancePreInspectionDays: number; // e.g. 21 days (2-3 weeks pre-inspection)
  retentionYears: number; // e.g. 2 years statutory audit retention
  enforcementAgency: string;
  pepEnabled?: boolean; // Quebec PEP: Programme d'entretien preventif
  pepNumber?: string;
  cvorOrPevlNumber?: string; // CVOR # (Ontario) or PEVL/NIR # (Quebec)
  notes?: string;
  // Written Maintenance Plan ("Write what you do, do what you write" - ON CVOR & QC Fiche d'entretien)
  serviceAIntervalKm: number; // e.g. 4,000 km (Minor / Chassis Lubrication & Safety Check)
  serviceAIntervalDays: number; // e.g. 45 days
  serviceBIntervalKm: number; // e.g. 8,000 km (Engine Oil & Filter Change + Comprehensive PM)
  serviceBIntervalDays: number; // e.g. 90 days
  serviceCIntervalKm: number; // e.g. 24,000 km (Major Drivetrain / Coolant / Transmission PM)
  serviceCIntervalDays: number; // e.g. 180 days
  qcMandatoryMaintenanceDays: number; // e.g. 90 days interleaved (Statutory max 180 days / 6 months)
  qcRequireSignedFiche: boolean; // Mandatory signed SAAQ Fiche d'entretien
  strictNoOverdueEnforcement: boolean; // Flag violation if either KM or Days interval is exceeded
  defaultEngineOilSpec: string; // e.g. "15W-40 Heavy Duty Diesel (CJ-4/CK-4)"
  writtenPlanVersion: string; // e.g. "WMP-2026-REV3"
  writtenPlanApprovedBy: string; // e.g. "Director of Fleet Safety & Maintenance"
  updatedAt?: string;
  updatedBy?: string;
}

export const ONTARIO_COMPLIANCE_DEFAULTS: ProvinceComplianceConfig = {
  province: 'ON',
  provinceName: 'Ontario',
  regulatoryBody: 'Ministry of Transportation Ontario (MTO) / CVOR System',
  inspectionFramework: 'DriveON Digital Inspection System (MVIS Phase-out)',
  inspectionType: 'Semi-Annual PMVI (Periodic Mandatory Vehicle Inspection - 6 Months)',
  certificateTitle: 'Safety Standards Certificate / DriveON PMVI Report',
  decalTitle: 'DriveON Inspection Decal / Punched Safety Sticker',
  inspectionStandard: 'National Safety Code Standard 11B (NSC 11B) / O. Reg. 611',
  inspectionDurationHours: '2.5 - 3.5 hours (Pure mechanical inspection)',
  fleetDowntimeEstimate: '0.5 - 1.0 day (1 - 3 days if parts ordering needed)',
  advancePreInspectionDays: 21, // 3 weeks internal pre-inspection window
  retentionYears: 2, // Mandatory 2-year CVOR audit archive
  enforcementAgency: 'MTO Transportation Enforcement Officers (TEO) / OPP Highway Safety',
  pepEnabled: false,
  cvorOrPevlNumber: 'CVOR-ON-889201',
  notes: 'All inspections must be completed digitally via government DriveON tablets with direct photo telemetry (brake lining thickness mm, VIN, odometer) to MTO.',
  serviceAIntervalKm: 4000,
  serviceAIntervalDays: 45,
  serviceBIntervalKm: 8000,
  serviceBIntervalDays: 90,
  serviceCIntervalKm: 24000,
  serviceCIntervalDays: 180,
  qcMandatoryMaintenanceDays: 90,
  qcRequireSignedFiche: true,
  strictNoOverdueEnforcement: true,
  defaultEngineOilSpec: '15W-40 Heavy Duty Synthetic Blend (CK-4)',
  writtenPlanVersion: 'ON-CVOR-WMP-2026.2',
  writtenPlanApprovedBy: 'Director of Fleet Maintenance & Safety'
};

export const QUEBEC_COMPLIANCE_DEFAULTS: ProvinceComplianceConfig = {
  province: 'QC',
  provinceName: 'Québec',
  regulatoryBody: 'Société de l\'assurance automobile du Québec (SAAQ) / CTQ',
  inspectionFramework: 'SAAQ Mandataire Agréé (VMP) / Entretien Mécanique Obligatoire',
  inspectionType: 'Vérification Mécanique Périodique (VMP - 6 Mois) + Fiche d\'Entretien',
  certificateTitle: 'Certificat de Vérification Mécanique (CVM) SAAQ & Fiche d\'Entretien',
  decalTitle: 'Vignette de Vérification Mécanique SAAQ',
  inspectionStandard: 'Guide de vérification mécanique des véhicules routiers / CSR art. 521',
  inspectionDurationHours: '2.5 - 3.5 heures (Inspection mécanique approfondie)',
  fleetDowntimeEstimate: '0.5 - 1.0 jour (1 - 3 jours si attente de pièces mécaniques)',
  advancePreInspectionDays: 21,
  retentionYears: 2,
  enforcementAgency: 'Contrôle routier Québec (CRQ) / Sûreté du Québec (SQ)',
  pepEnabled: true,
  pepNumber: 'PEP-SAAQ-44910',
  cvorOrPevlNumber: 'NIR-CTQ-55291',
  notes: 'Outre la VMP aux 6 mois (vignette), l\'entretien mécanique obligatoire avec signature de la Fiche d\'entretien SAAQ doit être effectué au moins aux 6 mois (ou intercalé aux 3 mois).',
  serviceAIntervalKm: 4000,
  serviceAIntervalDays: 45,
  serviceBIntervalKm: 8000,
  serviceBIntervalDays: 90,
  serviceCIntervalKm: 24000,
  serviceCIntervalDays: 180,
  qcMandatoryMaintenanceDays: 90,
  qcRequireSignedFiche: true,
  strictNoOverdueEnforcement: true,
  defaultEngineOilSpec: '15W-40 Heavy Duty Synthetic Blend (CK-4)',
  writtenPlanVersion: 'QC-SAAQ-PEP-2026.2',
  writtenPlanApprovedBy: 'Directeur de l\'entretien mécanique et conformité SAAQ'
};
