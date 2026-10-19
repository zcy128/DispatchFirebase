import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle } from '../types/vehicle';
import {
  VehicleInspectionRecord,
  InspectionAttachment,
  VehicleInspectionStats,
  PreventiveMaintenanceRecord,
  PreventiveMaintenanceStats
} from '../types/vehicleInspection';
import { VehicleInspectionService } from '../services/vehicleInspectionService';
import { DispatchService } from '../services/dispatchService';
import { useCompliance } from '../contexts/ComplianceContext';
import { useI18n } from '../contexts/I18nContext';
import {
  formatStickerMonth,
  getDaysRemainingUntilEndOfMonth,
  getEndOfMonthDate,
  isDueWithin30Days,
  isOverdue,
  isOlderThanTwoYears
} from '../utils/inspectionDateUtils';
import { InspectionAttachmentModal } from '../components/inspections/InspectionAttachmentModal';
import { PreventiveMaintenanceFormModal } from '../components/inspections/PreventiveMaintenanceFormModal';
import { WrittenMaintenancePlanPrintModal } from '../components/inspections/WrittenMaintenancePlanPrintModal';
import {
  ShieldCheck,
  Search,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  Database,
  FileText,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Archive,
  Wrench,
  Gauge,
  Printer,
  Edit3,
  FileCheck,
  UserCheck
} from 'lucide-react';

interface VehicleInspectionsViewProps {
  vehicles: Vehicle[];
  onSelectVehicle?: (vehicle: Vehicle) => void;
}

export const VehicleInspectionsView: React.FC<VehicleInspectionsViewProps> = ({
  vehicles,
  onSelectVehicle
}) => {
  const { config: complianceConfig, isOntario } = useCompliance();
  const { isFrench } = useI18n();

  // Top-level module tab: 'sticker_inspections' (Semi-Annual PMVI/VMP) vs 'preventive_maintenance' (PM & Oil Changes / Fiche d'entretien)
  const [activeModule, setActiveModule] = useState<'sticker_inspections' | 'preventive_maintenance'>('sticker_inspections');

  const [inspections, setInspections] = useState<VehicleInspectionRecord[]>([]);
  const [pmRecords, setPmRecords] = useState<PreventiveMaintenanceRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Default filter for Sticker Inspections: 'due_30' (Vehicles due for inspection within 30 days)
  const [activeFilterTab, setActiveFilterTab] = useState<'due_30' | 'overdue' | 'all' | 'bigquery'>('due_30');

  // Default filter for Preventive Maintenance: 'due_soon'
  const [pmFilterTab, setPmFilterTab] = useState<'due_soon' | 'violation' | 'all' | 'bigquery'>('due_soon');

  const [searchTerm, setSearchTerm] = useState('');
  const [yardFilter, setYardFilter] = useState('ALL');

  // Attachment Modal State (shared by both Sticker Inspections and PM Records)
  const [selectedRecordForAtt, setSelectedRecordForAtt] = useState<VehicleInspectionRecord | PreventiveMaintenanceRecord | null>(null);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [bqSyncSuccessMsg, setBqSyncSuccessMsg] = useState<string | null>(null);

  // PM Form & Written Plan Print Modal State
  const [isPMFormOpen, setIsPMFormOpen] = useState(false);
  const [editingPMRecord, setEditingPMRecord] = useState<PreventiveMaintenanceRecord | null>(null);
  const [isPrintPlanModalOpen, setIsPrintPlanModalOpen] = useState(false);

  // Semi-Annual Inspection Schedule / Log Modal State
  const [isInspFormOpen, setIsInspFormOpen] = useState(false);
  const [editingInspRecord, setEditingInspRecord] = useState<VehicleInspectionRecord | null>(null);
  const [inspFormUnit, setInspFormUnit] = useState('');
  const [inspFormDate, setInspFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [inspFormScheduledDate, setInspFormScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [inspFormStickerMonth, setInspFormStickerMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [inspFormStatus, setInspFormStatus] = useState<'compliant' | 'scheduled' | 'in_inspection' | 'completed'>('in_inspection');
  const [inspFormCertNo, setInspFormCertNo] = useState('');
  const [inspFormStickerNo, setInspFormStickerNo] = useState('');
  const [inspFormTechName, setInspFormTechName] = useState('Marc Lefebvre (Master Tech 310T)');
  const [inspFormFacility, setInspFormFacility] = useState('');
  const [inspFormNotes, setInspFormNotes] = useState('');

  const handleOpenInspForm = (record?: VehicleInspectionRecord) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (record) {
      setEditingInspRecord(record);
      setInspFormUnit(record.unitNumber);
      setInspFormDate(record.inspectionDate || todayStr);
      setInspFormScheduledDate(record.scheduledInspectionDate || todayStr);
      setInspFormStickerMonth(record.stickerMonth || todayStr.slice(0, 7));
      setInspFormStatus(record.inspectionStatus || 'in_inspection');
      setInspFormCertNo(record.certificateNumber || '');
      setInspFormStickerNo(record.stickerNumber || '');
      setInspFormTechName(record.technicianName || 'Marc Lefebvre (Master Tech 310T)');
      setInspFormFacility(
        record.facilityName ||
          (record.province === 'QC' ? 'SAAQ Mandataire Agréé #104' : 'DriveON Authorized Inspection Lane #392')
      );
      setInspFormNotes(record.notes || '');
    } else {
      setEditingInspRecord(null);
      const firstVeh = vehicles[0];
      setInspFormUnit(firstVeh?.unitNumber || '1001');
      setInspFormDate(todayStr);
      setInspFormScheduledDate(todayStr);
      const future = new Date();
      future.setMonth(future.getMonth() + 6);
      setInspFormStickerMonth(`${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}`);
      setInspFormStatus('in_inspection');
      setInspFormCertNo('');
      setInspFormStickerNo('');
      setInspFormTechName('Marc Lefebvre (Master Tech 310T)');
      setInspFormFacility(isOntario ? 'DriveON Authorized Inspection Lane #392' : 'SAAQ Mandataire Agréé #104');
      setInspFormNotes('');
    }
    setIsInspFormOpen(true);
  };

  const handleToggleInInspectionToday = async (record: VehicleInspectionRecord) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const isCurrentlyInInsp =
      record.inspectionStatus === 'in_inspection' ||
      record.scheduledInspectionDate === todayStr ||
      record.inspectionDate === todayStr;

    const updated: VehicleInspectionRecord = {
      ...record,
      inspectionStatus: isCurrentlyInInsp ? 'compliant' : 'in_inspection',
      scheduledInspectionDate: isCurrentlyInInsp ? undefined : todayStr,
      updatedAt: new Date().toISOString()
    };

    await VehicleInspectionService.saveInspection(updated);

    if (!isCurrentlyInInsp) {
      await DispatchService.removeUnavailableVehicleFromDispatches(
        record.unitNumber,
        record.vehicleId,
        todayStr,
        todayStr
      ).catch(() => {});
      setBqSyncSuccessMsg(
        isFrench
          ? `Unité #${record.unitNumber} marquée « En inspection périodique » le ${todayStr} et retirée des quarts de répartition.`
          : `Unit #${record.unitNumber} marked "In Periodic Inspection" for ${todayStr} and removed from dispatch shifts.`
      );
    } else {
      setBqSyncSuccessMsg(
        isFrench
          ? `Unité #${record.unitNumber} remise en service actif pour la répartition.`
          : `Unit #${record.unitNumber} returned to active service for dispatch.`
      );
    }
    setTimeout(() => setBqSyncSuccessMsg(null), 4500);
  };

  const handleSaveInspectionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedVeh = vehicles.find((v) => v.unitNumber === inspFormUnit);
    const province: 'ON' | 'QC' =
      editingInspRecord?.province ||
      ((matchedVeh?.plateNumber || '').startsWith('QC') || !isOntario ? 'QC' : 'ON');
    const legalExpiry = getEndOfMonthDate(inspFormStickerMonth);
    const recordToSave: VehicleInspectionRecord = {
      id: editingInspRecord?.id || `INSP-${inspFormUnit}-${inspFormStickerMonth.replace('-', '')}`,
      vehicleId: editingInspRecord?.vehicleId || matchedVeh?.vehicleId || Number(inspFormUnit) || 1001,
      unitNumber: inspFormUnit,
      plateNumber: editingInspRecord?.plateNumber || matchedVeh?.plateNumber || `${province}-${inspFormUnit}`,
      vin: editingInspRecord?.vin || matchedVeh?.vin || `1HVBBAB84KH88${inspFormUnit}`,
      unitType: editingInspRecord?.unitType || matchedVeh?.unitType || 'School Bus (72-Pax)',
      yardName: editingInspRecord?.yardName || matchedVeh?.yardName || 'HQ-Central',
      province,
      inspectionDate: inspFormDate,
      scheduledInspectionDate:
        inspFormStatus === 'scheduled' || inspFormStatus === 'in_inspection'
          ? inspFormScheduledDate || inspFormDate
          : undefined,
      inspectionStatus: inspFormStatus,
      stickerMonth: inspFormStickerMonth,
      legalExpiryDate: legalExpiry,
      certificateNumber: inspFormCertNo || `${province === 'ON' ? 'DOC-ON' : 'CVM-QC'}-${inspFormUnit}`,
      stickerNumber: inspFormStickerNo || `STK-${inspFormUnit}-${inspFormStickerMonth.replace('-', '')}`,
      facilityName: inspFormFacility,
      technicianName: inspFormTechName,
      odometerAtInspection: editingInspRecord?.odometerAtInspection || matchedVeh?.odometer || 90000,
      hasInVehicleCertificate: editingInspRecord?.hasInVehicleCertificate ?? true,
      hasDetailedMeasurementsArchived: editingInspRecord?.hasDetailedMeasurementsArchived ?? true,
      hasProofOfRepairsAttached: editingInspRecord?.hasProofOfRepairsAttached ?? true,
      attachments: editingInspRecord?.attachments || [],
      isArchivedToBigQuery: editingInspRecord?.isArchivedToBigQuery ?? false,
      notes: inspFormNotes || 'Scheduled / logged periodic mechanical inspection.',
      createdAt: editingInspRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await VehicleInspectionService.saveInspection(recordToSave);

    const targetDispatchDate = recordToSave.scheduledInspectionDate || recordToSave.inspectionDate;
    if (targetDispatchDate) {
      await DispatchService.removeUnavailableVehicleFromDispatches(
        recordToSave.unitNumber,
        recordToSave.vehicleId,
        targetDispatchDate,
        targetDispatchDate
      ).catch(() => {});
    }

    setIsInspFormOpen(false);
    setBqSyncSuccessMsg(
      isFrench
        ? `Inspection enregistrée pour l'Unité #${recordToSave.unitNumber}. Le véhicule est exclu de la répartition à la date d'inspection (${targetDispatchDate}).`
        : `Inspection saved for Unit #${recordToSave.unitNumber}. Vehicle excluded from dispatch shifts on inspection date (${targetDispatchDate}).`
    );
    setTimeout(() => setBqSyncSuccessMsg(null), 4500);
  };

  // Load both Semi-Annual Inspections and Preventive Maintenance records
  const loadData = async () => {
    try {
      const [inspList, pmList] = await Promise.all([
        VehicleInspectionService.getInspections(vehicles),
        VehicleInspectionService.getPMRecords(vehicles)
      ]);
      setInspections(inspList);
      setPmRecords(pmList);
    } catch (err) {
      console.error('Failed to load vehicle inspection & PM data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubInsp = VehicleInspectionService.subscribe((updated) => {
      setInspections(updated);
    });
    const unsubPM = VehicleInspectionService.subscribePM((updated) => {
      setPmRecords(updated);
    });
    return () => {
      unsubInsp();
      unsubPM();
    };
  }, [vehicles]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Open attachment modal for either Inspection or PM Record
  const handleOpenAttachments = (record: VehicleInspectionRecord | PreventiveMaintenanceRecord) => {
    setSelectedRecordForAtt(record);
    setIsAttachmentModalOpen(true);
  };

  // Add attachment handler
  const handleAddAttachment = async (recordId: string, attachment: InspectionAttachment) => {
    if (selectedRecordForAtt && 'serviceTier' in selectedRecordForAtt) {
      await VehicleInspectionService.addPMAttachment(recordId, attachment);
      setPmRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, attachments: [...(r.attachments || []), attachment] } : r
        )
      );
    } else {
      await VehicleInspectionService.addAttachment(recordId, attachment);
      setInspections((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, attachments: [...(r.attachments || []), attachment] } : r
        )
      );
    }
    setSelectedRecordForAtt((prev) =>
      prev ? { ...prev, attachments: [...(prev.attachments || []), attachment] } : null
    );
  };

  // Delete attachment handler
  const handleDeleteAttachment = async (recordId: string, attachmentId: string) => {
    if (selectedRecordForAtt && 'serviceTier' in selectedRecordForAtt) {
      await VehicleInspectionService.deletePMAttachment(recordId, attachmentId);
      setPmRecords((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? { ...r, attachments: (r.attachments || []).filter((a) => a.id !== attachmentId) }
            : r
        )
      );
    } else {
      await VehicleInspectionService.deleteAttachment(recordId, attachmentId);
      setInspections((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? { ...r, attachments: (r.attachments || []).filter((a) => a.id !== attachmentId) }
            : r
        )
      );
    }
    setSelectedRecordForAtt((prev) =>
      prev
        ? {
            ...prev,
            attachments: (prev.attachments || []).filter((a) => a.id !== attachmentId)
          }
        : null
    );
  };

  // Sync to BigQuery handler
  const handleSyncToBigQuery = async (inspectionId: string) => {
    await VehicleInspectionService.syncToBigQuery(inspectionId);
    setBqSyncSuccessMsg(
      isFrench
        ? `Dossier synchronisé vers BigQuery (dataset : fleet_compliance.semi_annual_inspections)`
        : `Record synced to BigQuery (dataset: fleet_compliance.semi_annual_inspections)`
    );
    setTimeout(() => setBqSyncSuccessMsg(null), 4000);
  };

  const handleSyncPMToBigQuery = async (pmId: string) => {
    await VehicleInspectionService.syncPMToBigQuery(pmId);
    setBqSyncSuccessMsg(
      isFrench
        ? `Dossier d'entretien archivé dans BigQuery (dataset : fleet_compliance.preventive_maintenance_archive)`
        : `PM record archived to BigQuery (dataset: fleet_compliance.preventive_maintenance_archive)`
    );
    setTimeout(() => setBqSyncSuccessMsg(null), 4000);
  };

  // Batch sync older records (> 2 years) to BigQuery
  const handleBatchArchiveToBigQuery = async () => {
    const count = await VehicleInspectionService.batchArchiveOldRecordsToBigQuery();
    setBqSyncSuccessMsg(
      isFrench
        ? `${count} dossier(s) historique(s) (>2 ans) archivé(s) avec succès dans BigQuery.`
        : `Successfully archived ${count} historical record(s) (>2 years old) to BigQuery.`
    );
    setTimeout(() => setBqSyncSuccessMsg(null), 5000);
  };

  const handleSavePMRecord = async (record: PreventiveMaintenanceRecord) => {
    await VehicleInspectionService.savePMRecord(record);
    if (record.serviceDate) {
      await DispatchService.removeUnavailableVehicleFromDispatches(
        record.unitNumber,
        record.vehicleId,
        record.serviceDate,
        record.serviceDate
      ).catch(() => {});
    }
    setBqSyncSuccessMsg(
      isFrench
        ? `Dossier d'entretien préventif et vidange d'huile enregistré pour l'Unité #${record.unitNumber} (exclu de la répartition le ${record.serviceDate}).`
        : `Saved Preventive Maintenance & Oil Change record for Unit #${record.unitNumber} (excluded from dispatch on ${record.serviceDate}).`
    );
    setTimeout(() => setBqSyncSuccessMsg(null), 4000);
  };

  // Unique yards for filter
  const yardsList = useMemo(() => {
    const set = new Set<string>();
    inspections.forEach((r) => {
      if (r.yardName) set.add(r.yardName);
    });
    pmRecords.forEach((r) => {
      if (r.yardName) set.add(r.yardName);
    });
    return Array.from(set).sort();
  }, [inspections, pmRecords]);

  // Statistics calculation
  const stats: VehicleInspectionStats = useMemo(() => {
    return VehicleInspectionService.calculateStats(inspections);
  }, [inspections]);

  const pmStats: PreventiveMaintenanceStats = useMemo(() => {
    return VehicleInspectionService.calculatePMStats(pmRecords);
  }, [pmRecords]);

  // Filtered sticker inspections
  const filteredInspections = useMemo(() => {
    return inspections.filter((r) => {
      if (activeFilterTab === 'due_30') {
        if (r.isArchivedToBigQuery) return false;
        if (!isDueWithin30Days(r.legalExpiryDate)) return false;
      } else if (activeFilterTab === 'overdue') {
        if (r.isArchivedToBigQuery) return false;
        if (!isOverdue(r.legalExpiryDate)) return false;
      } else if (activeFilterTab === 'bigquery') {
        if (!r.isArchivedToBigQuery && !isOlderThanTwoYears(r.inspectionDate)) return false;
      }

      if (yardFilter !== 'ALL' && r.yardName !== yardFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchUnit = r.unitNumber.toLowerCase().includes(term);
        const matchPlate = (r.plateNumber || '').toLowerCase().includes(term);
        const matchVin = (r.vin || '').toLowerCase().includes(term);
        const matchCert = (r.certificateNumber || '').toLowerCase().includes(term);
        const matchSticker = (r.stickerNumber || '').toLowerCase().includes(term);
        const matchFacility = (r.facilityName || '').toLowerCase().includes(term);
        const matchYard = (r.yardName || '').toLowerCase().includes(term);
        return matchUnit || matchPlate || matchVin || matchCert || matchSticker || matchFacility || matchYard;
      }

      return true;
    });
  }, [inspections, activeFilterTab, yardFilter, searchTerm]);

  // Filtered Preventive Maintenance records
  const filteredPMRecords = useMemo(() => {
    const todayMs = Date.now();
    return pmRecords.filter((r) => {
      const dueMs = new Date(r.nextDueDate + 'T23:59:59').getTime();
      const daysRemaining = Math.ceil((dueMs - todayMs) / 86400000);
      const kmRemaining = r.nextDueOdometerKm - r.currentVehicleOdometerKm;
      const isCurrentlyOverdue = daysRemaining < 0 || kmRemaining < 0;
      const isDueSoon = !isCurrentlyOverdue && (daysRemaining <= 30 || kmRemaining <= 1000);

      if (pmFilterTab === 'due_soon') {
        if (r.isArchivedToBigQuery) return false;
        if (!isDueSoon) return false;
      } else if (pmFilterTab === 'violation') {
        if (r.isArchivedToBigQuery) return false;
        if (!isCurrentlyOverdue && r.wasPerformedOnTime) return false;
      } else if (pmFilterTab === 'bigquery') {
        if (!r.isArchivedToBigQuery && !isOlderThanTwoYears(r.serviceDate)) return false;
      }

      if (yardFilter !== 'ALL' && r.yardName !== yardFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        return (
          r.unitNumber.toLowerCase().includes(term) ||
          r.plateNumber.toLowerCase().includes(term) ||
          r.vin.toLowerCase().includes(term) ||
          r.workOrderNumber.toLowerCase().includes(term) ||
          r.partsInvoiceNumber.toLowerCase().includes(term) ||
          r.mechanicName.toLowerCase().includes(term) ||
          r.shopName.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [pmRecords, pmFilterTab, yardFilter, searchTerm]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Jurisdiction Flag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>
              {isFrench
                ? 'Conformité légale de sécurité mécanique et d\'entretien préventif'
                : 'Statutory Mechanical Safety & Preventive Maintenance Compliance'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {activeModule === 'sticker_inspections'
              ? isFrench
                ? 'Gestion des inspections mécaniques semestrielles des véhicules'
                : 'Vehicle Semi-Annual Mechanical Inspection Management'
              : isFrench
              ? 'Entretien préventif (EP), vidanges d\'huile et Fiche d\'entretien'
              : 'Preventive Maintenance (PM), Oil Changes & Fiche d\'Entretien'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {activeModule === 'sticker_inspections'
              ? isFrench
                ? 'Validité jusqu\'au dernier jour du mois de la vignette, pièces jointes numériques (PDF et images) et archivage BigQuery après 2 ans.'
                : 'Sticker month validity ending on the last day of the month, digital inspection attachments (PDF & images), and 2-year BigQuery historical cold archival.'
              : isOntario
              ? isFrench
                ? 'Plan d\'entretien écrit CVOR du MTO de l\'Ontario (« Écrire ce que l\'on fait, faire ce que l\'on écrit ») avec suivi strict des intervalles (km et jours) et des 5 éléments d\'audit.'
                : 'Ontario MTO CVOR Written Maintenance Plan ("Write What You Do, Do What You Write") with strict mileage & day interval monitoring and 5 mandatory audit elements.'
              : isFrench
              ? 'Entretien mécanique obligatoire SAAQ du Québec (Fiche d\'entretien signée) intercalé aux 3 à 6 mois et 5 éléments obligatoires du dossier.'
              : 'Québec SAAQ Mandatory Mechanical Maintenance (Entretien mécanique obligatoire / Signed Fiche d\'entretien) interleaved every 3 to 6 months + 5 statutory record elements.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            isOntario
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
          }`}>
            <span>{isOntario ? '🇨🇦' : '⚜️'}</span>
            <span>
              {isOntario
                ? isFrench
                  ? 'Ontario : DriveON PMVI et Plan CVOR'
                  : 'Ontario: DriveON PMVI & CVOR WMP'
                : 'Québec: SAAQ VMP & Fiche d\'Entretien'}
            </span>
          </span>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title={isFrench ? 'Actualiser les données' : 'Refresh Inspection & PM Data'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Module Switcher Tabs: Semi-Annual Sticker Inspection vs Preventive Maintenance & Oil Changes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveModule('sticker_inspections')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center space-x-2 ${
              activeModule === 'sticker_inspections'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {isFrench
                ? '1. Inspections semestrielles (Vignette 6 mois PMVI / VMP)'
                : '1. Semi-Annual Sticker Inspections (6-Month PMVI / VMP)'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeModule === 'sticker_inspections' ? 'bg-slate-950/25 text-slate-950' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {isFrench ? `${stats.dueWithin30Days} à venir (30j)` : `${stats.dueWithin30Days} Due in 30d`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('preventive_maintenance')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center space-x-2 ${
              activeModule === 'preventive_maintenance'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>
              {isFrench
                ? `2. Entretien préventif et vidanges d'huile (${isOntario ? 'Plan écrit ON A/B/C' : 'Fiche d\'entretien QC'})`
                : `2. Preventive Maintenance & Oil Changes (${isOntario ? 'ON A/B/C Written Plan' : 'QC Fiche d\'Entretien'})`}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeModule === 'preventive_maintenance'
                ? 'bg-slate-950/25 text-slate-950'
                : pmStats.overdueOrViolationCount > 0
                ? 'bg-rose-500/20 text-rose-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {isFrench
                ? `${pmStats.dueSoonCount} à venir • ${pmStats.overdueOrViolationCount} alertes`
                : `${pmStats.dueSoonCount} Due • ${pmStats.overdueOrViolationCount} Alerts`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 pr-1">
          <button
            type="button"
            onClick={() => setIsPrintPlanModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {isFrench
                ? 'Imprimer le plan écrit et dossier d\'audit'
                : 'Print Written Plan & Audit Dossier'}
            </span>
          </button>

          {activeModule === 'sticker_inspections' && (
            <button
              type="button"
              onClick={() => handleOpenInspForm()}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isFrench ? 'Planifier / Enregistrer inspection' : 'Schedule / Log Inspection'}
              </span>
            </button>
          )}

          {activeModule === 'preventive_maintenance' && (
            <button
              type="button"
              onClick={() => {
                setEditingPMRecord(null);
                setIsPMFormOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>{isFrench ? 'Nouvel entretien / Huile' : 'Log PM / Oil Change'}</span>
            </button>
          )}
        </div>
      </div>

      {/* BigQuery Sync Notification Toast */}
      {bqSyncSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{bqSyncSuccessMsg}</span>
          </div>
          <button
            onClick={() => setBqSyncSuccessMsg(null)}
            className="text-sky-400 hover:text-white text-xs font-bold"
          >
            {isFrench ? 'Fermer' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* =====================================================================
          MODULE 1: SEMI-ANNUAL STICKER INSPECTIONS (PMVI / VMP)
      ===================================================================== */}
      {activeModule === 'sticker_inspections' && (
        <>
          {/* Statutory End-of-Month Rule Explanation Banner */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs leading-relaxed">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <span>
                    {isFrench
                      ? 'Règle de validité légale du mois de la vignette (Valide jusqu\'à la fin du mois à minuit)'
                      : 'Sticker Month Legal Validity Rule (Valid Until Month-End Midnight)'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {isFrench ? 'Fin du mois' : 'End-of-Month Rule'}
                  </span>
                </div>
                <p className="text-slate-300 mt-1">
                  {isFrench ? (
                    <>
                      Tant que la vignette d'inspection perforée indique un mois donné (ex. <strong>OCT / Mois 10</strong>), l'autobus scolaire conserve son statut d'exploitation légal jusqu'à <strong>minuit 23h59 le dernier jour de ce mois</strong>. Le système conserve en permanence la date exacte de l'inspection effectuée par le technicien certifié, tout en calculant le compte à rebours jusqu'au dernier jour civil du mois de la vignette.
                    </>
                  ) : (
                    <>
                      As long as the punched inspection decal shows a specific month (e.g. <strong>OCT / Month 10</strong>), the vehicle maintains valid legal operating status until <strong>midnight 23:59:59 on the last day of that month</strong>.
                      The system permanently retains the exact date the certified mechanic physically conducted the inspection (e.g. <strong>Apr 12</strong>), while countdown timers compute against the final calendar day of the sticker month.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center space-x-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-slate-400 font-mono text-[11px]">
              <Database className="w-4 h-4 text-sky-400" />
              <span>
                {isFrench ? 'Rétention BigQuery : Archivage >2 ans' : 'BigQuery Retention: >2 Years Cold Archive'}
              </span>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div
              onClick={() => setActiveFilterTab('due_30')}
              className={`p-5 rounded-2xl border cursor-pointer transition ${
                activeFilterTab === 'due_30'
                  ? 'bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  {isFrench ? 'Échéance dans 30 jours' : 'Due in 30 Days'}
                </span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-amber-400">{stats.dueWithin30Days}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Vue par défaut • Planifier' : 'Default view • Schedule now'}
                </span>
              </div>
            </div>

            <div
              onClick={() => setActiveFilterTab('overdue')}
              className={`p-5 rounded-2xl border cursor-pointer transition ${
                activeFilterTab === 'overdue'
                  ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  {isFrench ? 'En retard (Hors service)' : 'Overdue (Out of Service)'}
                </span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-rose-400">{stats.overdue}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Immobiliser immédiatement' : 'Ground immediately'}
                </span>
              </div>
            </div>

            <div
              onClick={() => setActiveFilterTab('all')}
              className={`p-5 rounded-2xl border cursor-pointer transition ${
                activeFilterTab === 'all'
                  ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  {isFrench ? 'Flotte active conforme' : 'Active Fleet'}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-emerald-400">{stats.compliant}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? `Total ${stats.totalInspected} autobus` : `Total ${stats.totalInspected} buses`}
                </span>
              </div>
            </div>

            <div
              onClick={() => setActiveFilterTab('bigquery')}
              className={`p-5 rounded-2xl border cursor-pointer transition ${
                activeFilterTab === 'bigquery'
                  ? 'bg-sky-950/20 border-sky-500/40 ring-1 ring-sky-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                  {isFrench ? 'Archives BigQuery (>2 ans)' : 'BigQuery Archive (>2 Years)'}
                </span>
                <Database className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-sky-400">{stats.archivedToBigQuery}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Entrepôt de données froides' : 'Cold data warehouse'}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Tabs & Search Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
              <button
                onClick={() => setActiveFilterTab('due_30')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                  activeFilterTab === 'due_30'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{isFrench ? 'Échéance dans 30 jours' : 'Due in 30 Days'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/30 text-slate-950 font-mono font-bold">
                  {stats.dueWithin30Days}
                </span>
              </button>

              <button
                onClick={() => setActiveFilterTab('overdue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                  activeFilterTab === 'overdue'
                    ? 'bg-rose-500 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{isFrench ? 'En retard' : 'Overdue'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-white font-mono">
                  {stats.overdue}
                </span>
              </button>

              <button
                onClick={() => setActiveFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  activeFilterTab === 'all'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {isFrench ? `Toute la flotte (${stats.totalInspected})` : `All Fleet (${stats.totalInspected})`}
              </button>

              <button
                onClick={() => setActiveFilterTab('bigquery')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                  activeFilterTab === 'bigquery'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Archives BigQuery (>2 ans)' : 'BigQuery Archive (>2 Yrs)'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-white font-mono">
                  {stats.archivedToBigQuery}
                </span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <select
                  value={yardFilter}
                  onChange={(e) => setYardFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="ALL">{isFrench ? 'Tous les dépôts' : 'All Yards / Depots'}</option>
                  {yardsList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    isFrench
                      ? 'Rechercher Unité #, Plaque, NIV, Doc #...'
                      : 'Search Unit #, Plate, VIN, Doc #...'
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleBatchArchiveToBigQuery}
                className="px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center space-x-1.5 transition whitespace-nowrap"
                title={
                  isFrench
                    ? 'Migrer automatiquement les dossiers de plus de 2 ans vers BigQuery'
                    : 'Automatically migrate records older than 2 years to BigQuery cold storage'
                }
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isFrench ? 'Archiver >2A vers BigQuery' : 'Archive >2Y to BigQuery'}
                </span>
              </button>
            </div>
          </div>

          {/* Main Sticker Inspections Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">
                  {activeFilterTab === 'due_30' &&
                    (isFrench
                      ? 'Véhicules devant subir une inspection mécanique d\'ici 30 jours'
                      : 'Vehicles Due for Mechanical Inspection Within 30 Days')}
                  {activeFilterTab === 'overdue' &&
                    (isFrench
                      ? 'Véhicules en retard - Expirés après la fin du mois de la vignette'
                      : 'Overdue Vehicles - Expired Past End of Sticker Month')}
                  {activeFilterTab === 'all' &&
                    (isFrench
                      ? 'Tous les dossiers d\'inspection mécanique semestrielle de la flotte'
                      : 'All Fleet Semi-Annual Mechanical Inspection Records')}
                  {activeFilterTab === 'bigquery' &&
                    (isFrench
                      ? 'Archives froides BigQuery - Dossiers historiques (> 2 ans)'
                      : 'BigQuery Cold Archive - Historical Records (> 2 Years Old)')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-amber-400">
                  {filteredInspections.length}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center space-x-3">
                <span>
                  {isFrench
                    ? 'Valide jusqu\'à minuit le dernier jour du mois de la vignette'
                    : 'Validity lasts until midnight on last day of sticker month'}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-semibold">
                    <th className="py-3.5 px-4">{isFrench ? 'Unité / Plaque' : 'Vehicle Unit / Plate'}</th>
                    <th className="py-3.5 px-4">{isFrench ? 'Date réelle d\'inspection' : 'Actual Inspection Date'}</th>
                    <th className="py-3.5 px-4">{isFrench ? 'Mois de vignette et expiration' : 'Sticker Month & Legal Expiry'}</th>
                    <th className="py-3.5 px-4">{isFrench ? 'Jours restants' : 'Days Left'}</th>
                    <th className="py-3.5 px-4">{isFrench ? 'Certificat et vignette #' : 'Doc & Sticker #'}</th>
                    <th className="py-3.5 px-4">{isFrench ? 'Pièces jointes (PDF / Images)' : 'Attachments (PDF / Images)'}</th>
                    <th className="py-3.5 px-4">{isFrench ? '3 obligations d\'archivage' : '3 Statutory Records'}</th>
                    <th className="py-3.5 px-4 text-right">{isFrench ? 'Actions' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredInspections.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <ShieldCheck className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <div>
                          {isFrench
                            ? `Aucun véhicule ne correspond au filtre sélectionné (${activeFilterTab}).`
                            : `No vehicles match the selected filter (${activeFilterTab}).`}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInspections.map((r) => {
                      const daysLeft = getDaysRemainingUntilEndOfMonth(r.legalExpiryDate);
                      const isExp = daysLeft < 0;
                      const isDue30 = daysLeft >= 0 && daysLeft <= 30;
                      const atts = r.attachments || [];
                      const pdfCount = atts.filter((a) => a.type === 'pdf').length;
                      const imgCount = atts.filter((a) => a.type === 'image').length;
                      const isOver2Years = isOlderThanTwoYears(r.inspectionDate);

                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-800/40 transition group cursor-pointer"
                          onClick={() => {
                            const matchedVeh = vehicles.find((v) => v.unitNumber === r.unitNumber);
                            if (matchedVeh && onSelectVehicle) onSelectVehicle(matchedVeh);
                          }}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-sm flex items-center space-x-2">
                              <span>{isFrench ? 'Unité' : 'Unit'} #{r.unitNumber}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                r.province === 'QC' ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {r.province}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {r.plateNumber || (isFrench ? 'Sans plaque' : 'No Plate')} • <span className="text-slate-500">{r.yardName}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-mono text-slate-200 font-semibold flex items-center gap-1.5 flex-wrap">
                              <span>{r.inspectionDate}</span>
                              {(r.inspectionStatus === 'in_inspection' ||
                                r.scheduledInspectionDate === new Date().toISOString().slice(0, 10) ||
                                r.inspectionDate === new Date().toISOString().slice(0, 10)) && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold">
                                  {isFrench ? 'En inspection (Exclu répartition)' : 'In Inspection (No Dispatch)'}
                                </span>
                              )}
                            </div>
                            {r.scheduledInspectionDate && (
                              <div className="text-[10px] font-mono text-indigo-400 mt-0.5">
                                {isFrench ? 'Planifié :' : 'Scheduled:'} {r.scheduledInspectionDate}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500">
                              {r.technicianName?.split(' ')[0] || (isFrench ? 'Tech certifié' : 'Certified Tech')}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-xs">
                                {formatStickerMonth(r.stickerMonth)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 font-mono mt-1">
                              {isFrench ? 'Valide jusqu\'au :' : 'Valid to:'}{' '}
                              <strong className="text-white">{r.legalExpiryDate}</strong> 23:59
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                isExp
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : isDue30
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {isExp
                                ? isFrench
                                  ? 'EXPIRÉ / HORS SERVICE'
                                  : 'EXPIRED / GROUNDED'
                                : daysLeft === 0
                                ? isFrench
                                  ? 'Expire aujourd\'hui'
                                  : 'Expires Today'
                                : isFrench
                                ? `${daysLeft} jours restants`
                                : `${daysLeft} days remaining`}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            <div>
                              Doc: <span className="text-slate-200 font-semibold">{r.certificateNumber || 'N/A'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {isFrench ? 'Vignette' : 'Decal'}: {r.stickerNumber || 'N/A'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleOpenAttachments(r)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                                <span>
                                  {atts.length} {isFrench ? 'Fichiers' : 'Files'}
                                </span>
                              </button>

                              {pdfCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 flex items-center space-x-0.5" title={`${pdfCount} PDF document(s)`}>
                                  <FileText className="w-3 h-3" />
                                  <span>{pdfCount}</span>
                                </span>
                              )}
                              {imgCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-300 flex items-center space-x-0.5" title={`${imgCount} Photo(s)`}>
                                  <ImageIcon className="w-3 h-3" />
                                  <span>{imgCount}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-1 text-[10px] font-mono">
                              <span
                                title={
                                  isFrench
                                    ? 'Preuve à bord : Conservée dans le coffre à gants'
                                    : 'In-Vehicle Proof: Carried in glove compartment'
                                }
                                className={`px-1.5 py-0.5 rounded ${
                                  r.hasInVehicleCertificate !== false
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-400'
                                }`}
                              >
                                {isFrench ? 'À bord' : 'In-Cab'}
                              </span>
                              <span
                                title={
                                  isFrench
                                    ? 'Fiche de mesures : Épaisseur des garnitures de freins et pneus'
                                    : 'Measurements Sheet: Brake linings and tire tread depths'
                                }
                                className={`px-1.5 py-0.5 rounded ${
                                  r.hasDetailedMeasurementsArchived !== false
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-amber-500/15 text-amber-400'
                                }`}
                              >
                                {isFrench ? 'Freins-mm' : 'Brake-mm'}
                              </span>
                              <span
                                title={
                                  isFrench
                                    ? 'Preuve de réparations : Bons de travail et factures'
                                    : 'Proof of Repairs: Defect work orders & parts invoices'
                                }
                                className={`px-1.5 py-0.5 rounded ${
                                  r.hasProofOfRepairsAttached !== false
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-slate-800 text-slate-500'
                                }`}
                              >
                                {isFrench ? 'Répar.' : 'Repairs'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                type="button"
                                onClick={() => handleToggleInInspectionToday(r)}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition border flex items-center space-x-1 ${
                                  r.inspectionStatus === 'in_inspection'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                }`}
                                title={
                                  r.inspectionStatus === 'in_inspection'
                                    ? isFrench
                                      ? 'Cliquer pour terminer l\'inspection et remettre l\'autobus en répartition'
                                      : 'Click to complete inspection and return bus to dispatch'
                                    : isFrench
                                      ? 'Marquer en inspection aujourd\'hui (retirer des quarts de répartition)'
                                      : 'Mark as in inspection today (remove from dispatch shifts)'
                                }
                              >
                                <Wrench className="w-3 h-3" />
                                <span>
                                  {r.inspectionStatus === 'in_inspection'
                                    ? isFrench
                                      ? 'En insp. (Retiré)'
                                      : 'In Insp. (Excluded)'
                                    : isFrench
                                      ? 'Mettre en insp.'
                                      : 'Set In Insp.'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenInspForm(r)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                title={isFrench ? 'Modifier / Planifier l\'inspection' : 'Edit / Schedule inspection'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {r.isArchivedToBigQuery ? (
                                <span
                                  className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-bold flex items-center space-x-1"
                                  title={`Archived to BigQuery dataset: ${r.bigQueryDataset || 'fleet_compliance'}`}
                                >
                                  <Database className="w-3 h-3" />
                                  <span>BigQuery</span>
                                </span>
                              ) : isOver2Years ? (
                                <button
                                  type="button"
                                  onClick={() => handleSyncToBigQuery(r.id)}
                                  className="px-2 py-1 rounded bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 text-[10px] font-bold transition flex items-center space-x-1"
                                  title={
                                    isFrench
                                      ? 'Migrer le dossier (>2 ans) vers BigQuery'
                                      : 'Migrate record (>2 years old) to BigQuery'
                                  }
                                >
                                  <Database className="w-3 h-3" />
                                  <span>Sync BQ</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {isFrench ? 'Actif (2a)' : 'Active (2y)'}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenAttachments(r)}
                                className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition"
                                title={isFrench ? 'Gérer les pièces jointes' : 'Manage attachments'}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          MODULE 2: PREVENTIVE MAINTENANCE (PM), OIL CHANGES & FICHE D'ENTRETIEN
      ===================================================================== */}
      {activeModule === 'preventive_maintenance' && (
        <>
          {/* Jurisdiction-Specific Regulatory Mandate & Written Maintenance Plan Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span>
                    {isOntario
                      ? isFrench
                        ? 'Logique d\'audit CVOR du MTO de l\'Ontario : « Écrire ce que l\'on fait, faire ce que l\'on écrit »'
                        : 'Ontario MTO CVOR Audit Logic: "Write What You Do, Do What You Write"'
                      : isFrench
                      ? 'Règle obligatoire SAAQ du Québec : Entretien mécanique obligatoire (Tous les 6 mois)'
                      : 'Québec SAAQ Mandatory Rule: Entretien Mécanique Obligatoire (Every 6 Months)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  {isFrench ? 'Tolérance zéro dépassement' : 'Zero Overdue Tolerance'}
                </span>
              </div>

              {isOntario ? (
                <p className="text-slate-300 leading-relaxed">
                  {isFrench ? (
                    <>
                      En vertu des règlements CVOR de l'Ontario, les exploitants doivent tenir un <strong>Plan d'entretien écrit</strong> définissant les intervalles exacts en kilomètres et en jours pour le <strong>Service A (Graissage/Mineur)</strong>, le <strong>Service B (Vidange d'huile et filtre)</strong> et le <strong>Service C (Majeur)</strong>. Lors d'un audit, les inspecteurs du MTO comparent ce plan directement aux relevés d'odomètre de chaque autobus : tout dépassement (ex. 11 500 km ou 120 jours au lieu de 8 000 km / 90 jours) entraîne une <strong>infraction d'entretien préventif CVOR</strong>.
                    </>
                  ) : (
                    <>
                      Under Ontario CVOR regulations, operators must maintain a formal <strong>Written Maintenance Plan</strong> defining exact mileage and calendar day intervals for <strong>Service A (Grease/Minor)</strong>, <strong>Service B (Oil & Filter Change)</strong>, and <strong>Service C (Major)</strong>. During an audit, MTO officers compare this written plan directly against each bus's odometer log—if a bus exceeds its planned interval (e.g., driven 11,500 km or 120 days against an 8,000 km / 90-day limit), it is cited as a <strong>Preventive Maintenance Violation</strong> even if no breakdown occurred.
                    </>
                  )}
                </p>
              ) : (
                <p className="text-slate-300 leading-relaxed">
                  {isFrench ? (
                    <>
                      Au Québec, en plus de la vérification mécanique semestrielle (vignette VMP) aux 6 mois chez un mandataire de la SAAQ, la loi impose l'<strong>Entretien mécanique obligatoire</strong> : peu importe le kilométrage parcouru, chaque autobus scolaire doit subir un entretien préventif exécuté par un mécanicien (fluides, usure des freins, lubrification) au moins tous les 6 mois (généralement intercalé aux <strong>{complianceConfig.qcMandatoryMaintenanceDays || 90} jours</strong>) avec une <strong>Fiche d'entretien SAAQ</strong> signée et archivée.
                    </>
                  ) : (
                    <>
                      In Québec, in addition to the 6-month VMP sticker inspection at an external SAAQ Mandataire, the law mandates <strong>Entretien mécanique obligatoire</strong>: regardless of mileage driven, every school bus must undergo mechanic-performed preventive maintenance (fluids, brake wear, chassis lubrication) at least every 6 months (typically interleaved every <strong>{complianceConfig.qcMandatoryMaintenanceDays || 90} days</strong>) with a signed <strong>SAAQ Fiche d'entretien</strong> archived in the vehicle dossier.
                    </>
                  )}
                </p>
              )}

              {/* Active Written Plan Threshold Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      {isFrench ? 'Service A (Graissage)' : 'Service A (Grease/Lube)'}
                    </div>
                    <div className="text-xs font-mono font-bold text-white">
                      {complianceConfig.serviceAIntervalKm.toLocaleString()} km / {complianceConfig.serviceAIntervalDays}d
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {isFrench ? 'EP Mineur' : 'Minor PM'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-amber-400 uppercase font-bold">
                      {isFrench ? 'Service B (Huile et filtre)' : 'Service B (Oil & Filter)'}
                    </div>
                    <div className="text-xs font-mono font-bold text-white">
                      {complianceConfig.serviceBIntervalKm.toLocaleString()} km / {complianceConfig.serviceBIntervalDays}d
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">15W-40 PM</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-sky-400 uppercase font-bold">
                      {isOntario ? (isFrench ? 'Service C (EP Majeur)' : 'Service C (Major PM)') : 'QC Fiche d\'entretien'}
                    </div>
                    <div className="text-xs font-mono font-bold text-white">
                      {isOntario
                        ? `${complianceConfig.serviceCIntervalKm.toLocaleString()} km / ${complianceConfig.serviceCIntervalDays}d`
                        : isFrench
                        ? `Aux ${complianceConfig.qcMandatoryMaintenanceDays || 90}j (Max 180j)`
                        : `Every ${complianceConfig.qcMandatoryMaintenanceDays || 90}d (Max 180d)`}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                    {isOntario ? 'Drivetrain' : 'Fiche signée'}
                  </span>
                </div>
              </div>
            </div>

            {/* 5 Mandatory Statutory Record Elements Box */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                <span>
                  {isFrench ? '5 éléments obligatoires du dossier d\'audit' : '5 Mandatory Audit Record Elements'}
                </span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="font-black text-amber-400">1.</span>
                  <span>
                    {isFrench ? (
                      <>
                        <strong>Identification du véhicule :</strong> Plaque #, NIV et numéro d'unité.
                      </>
                    ) : (
                      <>
                        <strong>Vehicle Identification:</strong> Plate #, VIN & Fleet Unit #.
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-black text-amber-400">2.</span>
                  <span>
                    {isFrench ? (
                      <>
                        <strong>Date d'entretien :</strong> Date exacte et prochaine échéance.
                      </>
                    ) : (
                      <>
                        <strong>Maintenance Date:</strong> Exact service date & next due date.
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-black text-amber-400">3.</span>
                  <span>
                    {isFrench ? (
                      <>
                        <strong>Odomètre (km) et heures moteur :</strong> Essentiel pour vérifier le respect des intervalles lors de l'audit.
                      </>
                    ) : (
                      <>
                        <strong>Odometer Reading & Engine Hours:</strong> Essential for auditors to verify mileage intervals.
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-black text-amber-400">4.</span>
                  <span>
                    {isFrench ? (
                      <>
                        <strong>Travaux détaillés et factures :</strong> Litres d'huile (15W-40), filtre, graissage, freins + bon de travail / facture.
                      </>
                    ) : (
                      <>
                        <strong>Itemized Work & Invoices:</strong> Oil liters (e.g. 15W-40), filter, chassis grease, brake slack + Work Order / Parts Invoice.
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-black text-amber-400">5.</span>
                  <span>
                    {isFrench ? (
                      <>
                        <strong>Identité de l'exécutant :</strong> Signature du mécanicien ou nom et facture du garage externe.
                      </>
                    ) : (
                      <>
                        <strong>Performer Identity:</strong> Mechanic signature or external repair shop name & invoice.
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PM KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div
              onClick={() => setPmFilterTab('due_soon')}
              className={`p-5 rounded-2xl border cursor-pointer transition ${
                pmFilterTab === 'due_soon'
                  ? 'bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  {isFrench ? 'EP à venir (≤30j ou ≤1 000 km)' : 'PM Due Soon (≤30d or ≤1,000 km)'}
                </span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-amber-400">{pmStats.dueSoonCount}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Planifier vidange / graissage' : 'Schedule oil / lube'}
                </span>
              </div>
            </div>

            <div
              onClick={() => setPmFilterTab('violation')}
              className={`p-5 rounded-2xl border cursor-pointer transition ${
                pmFilterTab === 'violation'
                  ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  {isFrench ? 'En retard / Infraction au plan' : 'Overdue / Plan Violation'}
                </span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-rose-400">{pmStats.overdueOrViolationCount}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Dépassement km ou jours' : 'Exceeded km or days'}
                </span>
              </div>
            </div>

            <div
              onClick={() => setPmFilterTab('all')}
              className={`p-5 rounded-2xl border cursor-pointer transition ${
                pmFilterTab === 'all'
                  ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  {isFrench ? 'EP conforme à temps' : 'On-Time Compliant PM'}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-emerald-400">{pmStats.compliantCount}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? `Total ${pmStats.totalRecords} dossiers` : `Total ${pmStats.totalRecords} logs`}
                </span>
              </div>
            </div>

            <div
              onClick={() => setPmFilterTab('bigquery')}
              className={`p-5 rounded-2xl border cursor-pointer transition ${
                pmFilterTab === 'bigquery'
                  ? 'bg-sky-950/20 border-sky-500/40 ring-1 ring-sky-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                  {isFrench ? 'Archives EP BigQuery (>2 ans)' : 'BigQuery PM Archive (>2 Yrs)'}
                </span>
                <Database className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-sky-400">{pmStats.archivedToBigQueryCount}</span>
                <span className="text-xs text-slate-400">
                  {isFrench ? 'Archives légales 2 ans+' : '2-Year statutory archive'}
                </span>
              </div>
            </div>
          </div>

          {/* PM Filter Pills & Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
              <button
                onClick={() => setPmFilterTab('due_soon')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                  pmFilterTab === 'due_soon'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{isFrench ? 'À venir (≤30j / ≤1 000 km)' : 'Due Soon (≤30d / ≤1,000 km)'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/30 text-slate-950 font-mono font-bold">
                  {pmStats.dueSoonCount}
                </span>
              </button>

              <button
                onClick={() => setPmFilterTab('violation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                  pmFilterTab === 'violation'
                    ? 'bg-rose-500 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{isFrench ? 'En retard / Infraction' : 'Overdue / Plan Violation'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-white font-mono">
                  {pmStats.overdueOrViolationCount}
                </span>
              </button>

              <button
                onClick={() => setPmFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  pmFilterTab === 'all'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {isFrench
                  ? `Tous les dossiers EP et huile (${pmStats.totalRecords})`
                  : `All PM & Oil Change Logs (${pmStats.totalRecords})`}
              </button>

              <button
                onClick={() => setPmFilterTab('bigquery')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                  pmFilterTab === 'bigquery'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Archives BigQuery (>2 ans)' : 'BigQuery Archive (>2 Yrs)'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-white font-mono">
                  {pmStats.archivedToBigQueryCount}
                </span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={yardFilter}
                onChange={(e) => setYardFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="ALL">{isFrench ? 'Tous les dépôts' : 'All Yards / Depots'}</option>
                {yardsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    isFrench
                      ? 'Rechercher Unité #, NIV, BT #, Mécanicien...'
                      : 'Search Unit #, VIN, WO #, Mechanic...'
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 5-Element Preventive Maintenance Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">
                  {isFrench
                    ? 'Registre d\'entretien préventif, vidanges d\'huile et Fiche d\'entretien (5 éléments)'
                    : '5-Element Preventive Maintenance, Oil Change & Fiche d\'Entretien Register'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-amber-400">
                  {filteredPMRecords.length}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {isFrench
                  ? 'Les auditeurs vérifient l\'odomètre (km) et les jours écoulés par rapport au plan d\'entretien écrit'
                  : 'Auditors verify Odometer Reading (km) & Days Elapsed against the Written Maintenance Plan'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-semibold">
                    <th className="py-3.5 px-4">
                      {isFrench ? '1. Véhicule (Unité / Plaque / NIV)' : '1. Vehicle ID (Unit / Plate / VIN)'}
                    </th>
                    <th className="py-3.5 px-4">
                      {isFrench ? '2. Date d\'entretien et catégorie' : '2. Service Date & Tier'}
                    </th>
                    <th className="py-3.5 px-4">
                      {isFrench ? '3. Odomètre (km), heures et audit d\'intervalle' : '3. Odometer (km), Hours & Interval Audit'}
                    </th>
                    <th className="py-3.5 px-4">
                      {isFrench ? '4. Travaux détaillés (Huile / Graissage / Freins) et facture' : '4. Itemized Oil / Lube / Brake & Invoice'}
                    </th>
                    <th className="py-3.5 px-4">
                      {isFrench ? '5. Signature mécanicien / atelier' : '5. Mechanic / Shop Sign-Off'}
                    </th>
                    <th className="py-3.5 px-4 text-right">
                      {isFrench ? 'Fichiers et actions' : 'Files & Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPMRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <Wrench className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <div>
                          {isFrench
                            ? `Aucun dossier d'entretien préventif ne correspond au filtre (${pmFilterTab}).`
                            : `No preventive maintenance records match the current filter (${pmFilterTab}).`}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPMRecords.map((r) => {
                      const todayMs = Date.now();
                      const dueMs = new Date(r.nextDueDate + 'T23:59:59').getTime();
                      const daysRemaining = Math.ceil((dueMs - todayMs) / 86400000);
                      const kmRemaining = r.nextDueOdometerKm - r.currentVehicleOdometerKm;
                      const isCurrentlyOverdue = daysRemaining < 0 || kmRemaining < 0;
                      const isOver2Years = isOlderThanTwoYears(r.serviceDate);
                      const atts = r.attachments || [];

                      return (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition align-top">
                          {/* 1. Vehicle ID */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-sm flex items-center space-x-2">
                              <span>{isFrench ? 'Unité' : 'Unit'} #{r.unitNumber}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                r.province === 'QC' ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {r.province}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                              {isFrench ? 'Plaque' : 'Plate'}: {r.plateNumber} • {r.yardName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              VIN: {r.vin}
                            </div>
                          </td>

                          {/* 2. Date & Tier */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono mb-1 ${
                              r.serviceTier === 'QC_FICHE_ENTRETIEN'
                                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                : r.serviceTier === 'SERVICE_B'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {r.serviceTier === 'QC_FICHE_ENTRETIEN' ? 'QC Fiche d\'entretien' : r.serviceTier.replace('_', ' ')}
                            </span>
                            <div className="font-mono text-slate-200 font-semibold">
                              {isFrench ? 'Fait le :' : 'Done:'} {r.serviceDate}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {isFrench ? 'Prochain :' : 'Next Due:'}{' '}
                              <strong className="text-white">{r.nextDueDate}</strong>
                            </div>
                          </td>

                          {/* 3. Odometer & Interval Audit */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="text-white font-bold flex items-center gap-1.5">
                              <Gauge className="w-3.5 h-3.5 text-amber-400" />
                              <span>{r.odometerAtServiceKm.toLocaleString()} km</span>
                              <span className="text-[10px] text-slate-400 font-normal">({r.engineHoursAtService} hrs)</span>
                            </div>
                            <div className="text-[11px] text-slate-300 mt-0.5">
                              {isFrench ? 'Parcouru :' : 'Interval Driven:'}{' '}
                              <strong className={r.kmDrivenSinceLastService > r.planAllowedMaxKm ? 'text-rose-400' : 'text-emerald-400'}>
                                {r.kmDrivenSinceLastService.toLocaleString()}
                              </strong>{' '}
                              / {r.planAllowedMaxKm.toLocaleString()} km ({r.daysElapsedSinceLastService}/{r.planAllowedMaxDays}d)
                            </div>
                            <div className="mt-1">
                              {!r.wasPerformedOnTime || isCurrentlyOverdue ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                                  <AlertTriangle className="w-3 h-3" />
                                  {!r.wasPerformedOnTime
                                    ? isFrench
                                      ? 'INFRACTION : PLAN ÉCRIT DÉPASSÉ'
                                      : 'VIOLATION: EXCEEDED WRITTEN PLAN'
                                    : isFrench
                                    ? `EN RETARD (${Math.abs(kmRemaining).toLocaleString()} km / ${Math.abs(daysRemaining)}j)`
                                    : `OVERDUE (${Math.abs(kmRemaining).toLocaleString()} km / ${Math.abs(daysRemaining)}d)`}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {isFrench
                                    ? `${kmRemaining.toLocaleString()} km ou ${daysRemaining}j restants`
                                    : `${kmRemaining.toLocaleString()} km or ${daysRemaining}d remaining`}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. Itemized Checklist & Invoices */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">
                              {r.checklist.engineOilChanged
                                ? `${r.checklist.oilQuantityLiters}L ${r.checklist.oilSpecification}`
                                : isFrench
                                ? 'Graissage mineur du châssis et inspection de sécurité'
                                : 'Minor Chassis Grease & Safety Inspection'}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1 text-[10px] font-mono">
                              {r.checklist.oilFilterReplaced && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300">
                                  {isFrench ? 'Filtre huile' : 'Oil Filter'}
                                </span>
                              )}
                              {r.checklist.chassisLubricated && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-emerald-300">
                                  {isFrench ? 'Châssis graissé' : 'Chassis Greased'}
                                </span>
                              )}
                              {r.checklist.rearBrakeSlackAdjusted && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-sky-300">
                                  {isFrench ? 'Freins ajustés' : 'Brake Slack Adj'}
                                </span>
                              )}
                              {r.checklist.tirePressureAdjusted && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                  {isFrench ? 'Pression pneus' : 'Tire PSI'}
                                </span>
                              )}
                              {r.checklist.saaqFicheEntretienSigned && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  {isFrench ? 'Fiche SAAQ signée' : 'Fiche SAAQ Signed'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-1">
                              WO: <strong className="text-slate-200">{r.workOrderNumber}</strong> • Inv:{' '}
                              <strong className="text-slate-200">{r.partsInvoiceNumber}</strong>
                            </div>
                          </td>

                          {/* 5. Performer Identity & Signature */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{r.mechanicName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">{r.shopName}</div>
                            <div className="text-[10px] font-mono text-emerald-400/90 mt-0.5">
                              {r.mechanicSignature}
                            </div>
                          </td>

                          {/* Files & Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenAttachments(r)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-1 border border-slate-700 transition"
                                title={
                                  isFrench
                                    ? 'Téléverser ou voir le bon de travail, la facture de pièces et la Fiche d\'entretien'
                                    : 'Upload or view Work Order, Parts Invoice & Fiche d\'entretien PDF/Images'
                                }
                              >
                                <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                                <span>{atts.length}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPMRecord(r);
                                  setIsPMFormOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                                title={isFrench ? 'Modifier le dossier EP' : 'Edit PM Record'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {r.isArchivedToBigQuery ? (
                                <span
                                  className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-bold flex items-center space-x-1"
                                  title={isFrench ? 'Archivé dans BigQuery (>2 ans)' : 'Archived to BigQuery (>2 Years)'}
                                >
                                  <Database className="w-3 h-3" />
                                  <span>BQ</span>
                                </span>
                              ) : isOver2Years ? (
                                <button
                                  type="button"
                                  onClick={() => handleSyncPMToBigQuery(r.id)}
                                  className="px-2 py-1 rounded bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 text-[10px] font-bold transition"
                                >
                                  Sync BQ
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Attachment Modal (Shared by Sticker Inspections & Preventive Maintenance) */}
      {isAttachmentModalOpen && selectedRecordForAtt && (
        <InspectionAttachmentModal
          isOpen={isAttachmentModalOpen}
          onClose={() => {
            setIsAttachmentModalOpen(false);
            setSelectedRecordForAtt(null);
          }}
          inspection={selectedRecordForAtt}
          onAddAttachment={handleAddAttachment}
          onDeleteAttachment={handleDeleteAttachment}
        />
      )}

      {/* Log / Edit Preventive Maintenance Form Modal */}
      <PreventiveMaintenanceFormModal
        isOpen={isPMFormOpen}
        onClose={() => {
          setIsPMFormOpen(false);
          setEditingPMRecord(null);
        }}
        vehicles={vehicles}
        complianceConfig={complianceConfig}
        initialRecord={editingPMRecord}
        onSave={handleSavePMRecord}
      />

      {/* Print Written Maintenance Plan & 5-Element Audit Dossier Modal */}
      <WrittenMaintenancePlanPrintModal
        isOpen={isPrintPlanModalOpen}
        onClose={() => setIsPrintPlanModalOpen(false)}
        complianceConfig={complianceConfig}
        pmRecords={pmRecords}
      />

      {/* Schedule / Log Periodic Sticker Inspection Modal */}
      {isInspFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>
                    {isFrench
                      ? 'Planifier / Enregistrer une inspection périodique'
                      : 'Schedule / Log Periodic Inspection'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isFrench
                    ? 'Les véhicules en inspection sont automatiquement exclus des quarts de répartition.'
                    : 'Vehicles undergoing inspection are automatically excluded from dispatch shifts.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInspFormOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInspectionForm} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {isFrench ? 'Véhicule (Unité)' : 'Vehicle (Unit)'}
                  </label>
                  <select
                    value={inspFormUnit}
                    onChange={(e) => setInspFormUnit(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.unitNumber}>
                        #{v.unitNumber} ({v.plateNumber}) - {v.year} {v.model}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {isFrench ? 'Statut de l\'inspection' : 'Inspection Status'}
                  </label>
                  <select
                    value={inspFormStatus}
                    onChange={(e) => setInspFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="in_inspection">
                      {isFrench ? 'En inspection (Exclu de la répartition)' : 'In Inspection (Excluded from Dispatch)'}
                    </option>
                    <option value="scheduled">
                      {isFrench ? 'Planifiée (Exclu à la date prévue)' : 'Scheduled (Excluded on Scheduled Date)'}
                    </option>
                    <option value="completed">
                      {isFrench ? 'Terminée / Conforme (Disponible)' : 'Completed / Compliant (Available)'}
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {isFrench ? 'Date d\'inspection / Prévue' : 'Inspection / Scheduled Date'}
                  </label>
                  <input
                    type="date"
                    value={inspFormScheduledDate || inspFormDate}
                    onChange={(e) => {
                      setInspFormScheduledDate(e.target.value);
                      setInspFormDate(e.target.value);
                    }}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {isFrench ? 'Mois d\'expiration de la vignette' : 'Sticker Expiry Month'}
                  </label>
                  <input
                    type="month"
                    value={inspFormStickerMonth}
                    onChange={(e) => setInspFormStickerMonth(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {isFrench ? 'Numéro de vignette' : 'Sticker Number'}
                  </label>
                  <input
                    type="text"
                    value={inspFormStickerNo}
                    onChange={(e) => setInspFormStickerNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    {isFrench ? 'Station / Technicien' : 'Station / Mechanic'}
                  </label>
                  <input
                    type="text"
                    value={inspFormFacility}
                    onChange={(e) => setInspFormFacility(e.target.value)}
                    placeholder={isFrench ? 'Nom du centre ou mécanicien' : 'Inspection station or mechanic'}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  {isFrench ? 'Notes' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={inspFormNotes}
                  onChange={(e) => setInspFormNotes(e.target.value)}
                  placeholder={
                    isFrench
                      ? 'Détails de l\'inspection périodique...'
                      : 'Periodic inspection details...'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {isFrench
                    ? 'Si le statut est « En inspection » ou « Planifiée », ce véhicule sera automatiquement retiré des quarts de répartition (Dispatch Shifts) pour la date sélectionnée.'
                    : 'If status is "In Inspection" or "Scheduled", this vehicle will be automatically removed from Dispatch Shifts for the selected date.'}
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInspFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  {isFrench ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition shadow-lg shadow-amber-500/20"
                >
                  {isFrench ? 'Enregistrer' : 'Save Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
