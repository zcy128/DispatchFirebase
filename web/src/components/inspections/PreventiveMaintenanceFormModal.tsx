import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  Gauge,
  Calendar,
  FileCheck,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Truck
} from 'lucide-react';
import {
  PreventiveMaintenanceRecord,
  PMServiceTier,
  PMChecklistItem
} from '../../types/vehicleInspection';
import { Vehicle } from '../../types/vehicle';
import { ProvinceComplianceConfig } from '../../types/compliance';
import { useI18n } from '../../contexts/I18nContext';

interface PreventiveMaintenanceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  complianceConfig: ProvinceComplianceConfig;
  initialRecord?: PreventiveMaintenanceRecord | null;
  onSave: (record: PreventiveMaintenanceRecord) => Promise<void>;
}

export const PreventiveMaintenanceFormModal: React.FC<PreventiveMaintenanceFormModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  complianceConfig,
  initialRecord,
  onSave
}) => {
  const { isFrench } = useI18n();
  const isOntario = complianceConfig.province === 'ON';

  const [selectedUnitNumber, setSelectedUnitNumber] = useState<string>('');
  const [plateNumber, setPlateNumber] = useState<string>('');
  const [vin, setVin] = useState<string>('');
  const [yardName, setYardName] = useState<string>('HQ-Central');
  const [unitType, setUnitType] = useState<string>('School Bus (72-Pax)');

  const [serviceTier, setServiceTier] = useState<PMServiceTier>(
    isOntario ? 'SERVICE_B' : 'QC_FICHE_ENTRETIEN'
  );
  const [serviceDate, setServiceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [daysElapsedSinceLastService, setDaysElapsedSinceLastService] = useState<number>(75);

  const [previousServiceOdometerKm, setPreviousServiceOdometerKm] = useState<number>(95000);
  const [odometerAtServiceKm, setOdometerAtServiceKm] = useState<number>(102200);
  const [currentVehicleOdometerKm, setCurrentVehicleOdometerKm] = useState<number>(102500);
  const [engineHoursAtService, setEngineHoursAtService] = useState<number>(2680);

  const [checklist, setChecklist] = useState<PMChecklistItem>({
    engineOilChanged: true,
    oilSpecification: complianceConfig.defaultEngineOilSpec || '15W-40 Heavy Duty Diesel (CK-4)',
    oilQuantityLiters: 19.0,
    oilFilterReplaced: true,
    fuelFilterReplaced: false,
    chassisLubricated: true,
    tirePressureAdjusted: true,
    rearBrakeSlackAdjusted: true,
    fluidsToppedUp: true,
    suspensionAndSteeringChecked: true,
    lightsAndEmergencyExitsChecked: true,
    saaqFicheEntretienSigned: !isOntario
  });

  const [workOrderNumber, setWorkOrderNumber] = useState<string>(
    `WO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [partsInvoiceNumber, setPartsInvoiceNumber] = useState<string>(
    `INV-HD-${Math.floor(10000 + Math.random() * 90000)}`
  );
  const [partsCostCad, setPartsCostCad] = useState<number>(385.0);
  const [laborHours, setLaborHours] = useState<number>(2.5);

  const [performerType, setPerformerType] = useState<'IN_HOUSE_MECHANIC' | 'EXTERNAL_SHOP'>('IN_HOUSE_MECHANIC');
  const [mechanicName, setMechanicName] = useState<string>('Jean-Luc Picard');
  const [mechanicLicenseNumber, setMechanicLicenseNumber] = useState<string>(
    isOntario ? '310T-ON-77412' : 'CPA-QC-33910'
  );
  const [shopName, setShopName] = useState<string>('HQ-Central Fleet Maintenance Bay #2');
  const [mechanicSignature, setMechanicSignature] = useState<string>(
    `Signed Digitally: J.L. Picard (${new Date().toISOString().slice(0, 10)})`
  );
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Determine plan limits based on selected tier & province config
  const getPlanLimits = (tier: PMServiceTier) => {
    switch (tier) {
      case 'SERVICE_A':
        return {
          maxKm: complianceConfig.serviceAIntervalKm || 4000,
          maxDays: complianceConfig.serviceAIntervalDays || 45
        };
      case 'SERVICE_B':
        return {
          maxKm: complianceConfig.serviceBIntervalKm || 8000,
          maxDays: complianceConfig.serviceBIntervalDays || 90
        };
      case 'SERVICE_C':
        return {
          maxKm: complianceConfig.serviceCIntervalKm || 24000,
          maxDays: complianceConfig.serviceCIntervalDays || 180
        };
      case 'QC_FICHE_ENTRETIEN':
      default:
        return {
          maxKm: complianceConfig.serviceBIntervalKm || 8000,
          maxDays: complianceConfig.qcMandatoryMaintenanceDays || 90
        };
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialRecord) {
      setSelectedUnitNumber(initialRecord.unitNumber);
      setPlateNumber(initialRecord.plateNumber);
      setVin(initialRecord.vin);
      setYardName(initialRecord.yardName);
      setUnitType(initialRecord.unitType);
      setServiceTier(initialRecord.serviceTier);
      setServiceDate(initialRecord.serviceDate);
      setDaysElapsedSinceLastService(initialRecord.daysElapsedSinceLastService);
      setPreviousServiceOdometerKm(initialRecord.previousServiceOdometerKm);
      setOdometerAtServiceKm(initialRecord.odometerAtServiceKm);
      setCurrentVehicleOdometerKm(initialRecord.currentVehicleOdometerKm);
      setEngineHoursAtService(initialRecord.engineHoursAtService);
      setChecklist({ ...initialRecord.checklist });
      setWorkOrderNumber(initialRecord.workOrderNumber);
      setPartsInvoiceNumber(initialRecord.partsInvoiceNumber);
      setPartsCostCad(initialRecord.partsCostCad || 385);
      setLaborHours(initialRecord.laborHours || 2.5);
      setPerformerType(initialRecord.performerType);
      setMechanicName(initialRecord.mechanicName);
      setMechanicLicenseNumber(initialRecord.mechanicLicenseNumber || '');
      setShopName(initialRecord.shopName);
      setMechanicSignature(initialRecord.mechanicSignature);
      setNotes(initialRecord.notes || '');
    } else if (vehicles.length > 0) {
      const first = vehicles[0];
      setSelectedUnitNumber(first.unitNumber);
      setPlateNumber(first.plateNumber || `${complianceConfig.province}-${first.unitNumber}`);
      setVin(first.vin || `1HVBBAB84KH88001`);
      setYardName(first.yardName || 'HQ-Central');
      setUnitType(first.unitType || 'School Bus (72-Pax)');
      setServiceTier(isOntario ? 'SERVICE_B' : 'QC_FICHE_ENTRETIEN');
    }
  }, [isOpen, initialRecord, vehicles, complianceConfig.province, isOntario]);

  if (!isOpen) return null;

  const handleSelectVehicle = (unitNum: string) => {
    setSelectedUnitNumber(unitNum);
    const matched = vehicles.find((v) => v.unitNumber === unitNum);
    if (matched) {
      setPlateNumber(matched.plateNumber || `${complianceConfig.province}-${matched.unitNumber}`);
      setVin(matched.vin || `1HVBBAB84KH${unitNum}`);
      setYardName(matched.yardName || 'HQ-Central');
      setUnitType(matched.unitType || 'School Bus (72-Pax)');
      if (matched.odometer) {
        setOdometerAtServiceKm(matched.odometer);
        setCurrentVehicleOdometerKm(matched.odometer);
        setPreviousServiceOdometerKm(Math.max(0, matched.odometer - 7200));
      }
    }
  };

  const { maxKm, maxDays } = getPlanLimits(serviceTier);
  const kmDriven = Math.max(0, odometerAtServiceKm - previousServiceOdometerKm);
  const isKmExceeded = kmDriven > maxKm;
  const isDaysExceeded = daysElapsedSinceLastService > maxDays;
  const wasPerformedOnTime = !isKmExceeded && !isDaysExceeded;

  const nextDueDateObj = new Date(new Date(serviceDate).getTime() + maxDays * 86400000);
  const nextDueDate = isNaN(nextDueDateObj.getTime())
    ? new Date().toISOString().slice(0, 10)
    : nextDueDateObj.toISOString().slice(0, 10);
  const nextDueOdometerKm = odometerAtServiceKm + maxKm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const matchedVeh = vehicles.find((v) => v.unitNumber === selectedUnitNumber);
      const record: PreventiveMaintenanceRecord = {
        id: initialRecord?.id || `PM-${selectedUnitNumber}-${serviceDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`,
        vehicleId: matchedVeh?.vehicleId || Number(selectedUnitNumber) || 1001,
        unitNumber: selectedUnitNumber || '1001',
        plateNumber: plateNumber || `${complianceConfig.province}-${selectedUnitNumber}`,
        vin: vin || '1HVBBAB84KH88001',
        unitType,
        yardName,
        province: complianceConfig.province,
        serviceTier,
        serviceDate,
        nextDueDate,
        daysElapsedSinceLastService,
        planAllowedMaxDays: maxDays,
        odometerAtServiceKm,
        previousServiceOdometerKm,
        kmDrivenSinceLastService: kmDriven,
        planAllowedMaxKm: maxKm,
        engineHoursAtService,
        currentVehicleOdometerKm: Math.max(odometerAtServiceKm, currentVehicleOdometerKm),
        nextDueOdometerKm,
        wasPerformedOnTime,
        auditViolationNotes: !wasPerformedOnTime
          ? `Written Maintenance Plan Exceeded: ${kmDriven.toLocaleString()} km driven (limit ${maxKm.toLocaleString()} km), ${daysElapsedSinceLastService} days elapsed (limit ${maxDays} days).`
          : undefined,
        checklist,
        workOrderNumber,
        partsInvoiceNumber,
        partsCostCad,
        laborHours,
        attachments: initialRecord?.attachments || [],
        performerType,
        mechanicName,
        mechanicLicenseNumber,
        mechanicSignature,
        shopName,
        isArchivedToBigQuery: initialRecord?.isArchivedToBigQuery || false,
        notes,
        createdAt: initialRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(record);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {initialRecord
                  ? isFrench
                    ? 'Modifier le dossier d\'entretien préventif et vidange d\'huile'
                    : 'Edit Preventive Maintenance & Oil Change Record'
                  : isFrench
                  ? 'Enregistrer un entretien préventif / vidange d\'huile (5 éléments légaux)'
                  : 'Log Preventive Maintenance / Oil Change (5 Statutory Elements)'}
              </h2>
              <p className="text-xs text-slate-400">
                {isOntario
                  ? isFrench
                    ? 'Plan d\'entretien écrit CVOR de l\'Ontario (« Écrire ce que l\'on fait, faire ce que l\'on écrit »)'
                    : 'Ontario CVOR Written Maintenance Plan ("Write What You Do, Do What You Write")'
                  : isFrench
                  ? 'Entretien mécanique obligatoire SAAQ du Québec et Fiche d\'entretien signée'
                  : 'Québec SAAQ Entretien Mécanique Obligatoire & Signed Fiche d\'Entretien'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* ELEMENT 1: Vehicle Identification */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4" />
              <span>
                {isFrench
                  ? 'Élément 1 : Identification du véhicule (Unité #, Plaque et NIV)'
                  : 'Element 1: Vehicle Identification (Unit #, Plate & VIN)'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Numéro d\'unité' : 'Unit Number'}
                </label>
                {vehicles.length > 0 ? (
                  <select
                    value={selectedUnitNumber}
                    onChange={(e) => handleSelectVehicle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold focus:border-amber-500 focus:outline-none"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.unitNumber}>
                        {isFrench ? 'Unité' : 'Unit'} #{v.unitNumber} ({v.plateNumber || 'Fleet'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedUnitNumber}
                    onChange={(e) => setSelectedUnitNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                    required
                  />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Plaque d\'immatriculation' : 'License Plate #'}
                </label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Numéro NIV (VIN)' : 'VIN Number'}
                </label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Dépôt d\'attache' : 'Operating Depot / Yard'}
                </label>
                <input
                  type="text"
                  value={yardName}
                  onChange={(e) => setYardName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
              </div>
            </div>
          </div>

          {/* ELEMENT 2 & 3: Service Date, Tier & Odometer Reading (Auditor Interval Check) */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                <span>
                  {isFrench
                    ? 'Éléments 2 et 3 : Date d\'entretien, odomètre (km) et heures moteur'
                    : 'Elements 2 & 3: Maintenance Date, Odometer Reading (km) & Engine Hours'}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                wasPerformedOnTime
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {wasPerformedOnTime ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {isFrench
                        ? `Conforme au plan écrit (${kmDriven.toLocaleString()} / ${maxKm.toLocaleString()} km • ${daysElapsedSinceLastService} / ${maxDays}j)`
                        : `Written Plan Compliant (${kmDriven.toLocaleString()} / {maxKm.toLocaleString()} km • ${daysElapsedSinceLastService} / ${maxDays}d)`}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {isFrench
                        ? `Alerte d'audit : Intervalle dépassé ! (${kmDriven.toLocaleString()} km / ${daysElapsedSinceLastService}j)`
                        : `Audit Violation Warning: Interval Exceeded! (${kmDriven.toLocaleString()} km / ${daysElapsedSinceLastService}d)`}
                    </span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench
                    ? 'Catégorie d\'entretien (Calendrier du plan écrit)'
                    : 'Maintenance Tier (Written Plan Schedule)'}
                </label>
                <select
                  value={serviceTier}
                  onChange={(e) => setServiceTier(e.target.value as PMServiceTier)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold focus:border-amber-500 focus:outline-none"
                >
                  <option value="QC_FICHE_ENTRETIEN">
                    ⚜️ {isFrench ? 'Québec Entretien obligatoire' : 'Québec Mandatory Maintenance'} (Fiche d'entretien SAAQ - Max {complianceConfig.qcMandatoryMaintenanceDays || 90}d)
                  </option>
                  <option value="SERVICE_A">
                    🅰️ Service A - {isFrench ? 'Entretien mineur et graissage châssis' : 'Minor PM & Chassis Lubrication'} (Max {complianceConfig.serviceAIntervalKm.toLocaleString()} km / {complianceConfig.serviceAIntervalDays}d)
                  </option>
                  <option value="SERVICE_B">
                    🅱️ Service B - {isFrench ? 'Vidange d\'huile moteur et filtre + EP complet' : 'Engine Oil & Filter Change + Full PM'} (Max {complianceConfig.serviceBIntervalKm.toLocaleString()} km / {complianceConfig.serviceBIntervalDays}d)
                  </option>
                  <option value="SERVICE_C">
                    🅲 Service C - {isFrench ? 'Entretien majeur groupe motopropulseur' : 'Major Drivetrain, Coolant & Transmission PM'} (Max {complianceConfig.serviceCIntervalKm.toLocaleString()} km / {complianceConfig.serviceCIntervalDays}d)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Date d\'entretien' : 'Maintenance Date'}
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? `Jours depuis dernier EP (Max ${maxDays}j)` : `Days Since Last PM (Max ${maxDays}d)`}
                </label>
                <input
                  type="number"
                  value={daysElapsedSinceLastService}
                  onChange={(e) => setDaysElapsedSinceLastService(Number(e.target.value))}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-900 border font-mono ${
                    isDaysExceeded ? 'border-rose-500 text-rose-300' : 'border-slate-700 text-white'
                  }`}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Odomètre précédent (km)' : 'Previous PM Odometer (km)'}
                </label>
                <input
                  type="number"
                  value={previousServiceOdometerKm}
                  onChange={(e) => setPreviousServiceOdometerKm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-400 uppercase mb-1">
                  {isFrench ? 'Odomètre lors de l\'entretien (km) *' : 'Odometer at Service (km) *'}
                </label>
                <input
                  type="number"
                  value={odometerAtServiceKm}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setOdometerAtServiceKm(val);
                    if (currentVehicleOdometerKm < val) setCurrentVehicleOdometerKm(val);
                  }}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-900 border font-mono font-bold ${
                    isKmExceeded ? 'border-rose-500 text-rose-300' : 'border-amber-500/60 text-white'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Heures moteur' : 'Engine Hours at Service'}
                </label>
                <input
                  type="number"
                  value={engineHoursAtService}
                  onChange={(e) => setEngineHoursAtService(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Prochaine échéance (km et date)' : 'Next Due Odometer & Date'}
                </label>
                <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-emerald-400 text-[11px]">
                  {nextDueOdometerKm.toLocaleString()} km • {nextDueDate}
                </div>
              </div>
            </div>
          </div>

          {/* ELEMENT 4: Itemized Checklist & Invoices / Work Orders */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              <span>
                {isFrench
                  ? 'Élément 4 : Liste détaillée des travaux, huile et factures de pièces'
                  : 'Element 4: Itemized Work Checklist, Oil Specification & Parts Invoices'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Spécification et viscosité de l\'huile moteur' : 'Engine Oil Specification & Viscosity'}
                </label>
                <input
                  type="text"
                  value={checklist.oilSpecification}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, oilSpecification: e.target.value }))}
                  placeholder="e.g. 15W-40 Heavy Duty Diesel (CK-4)"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Quantité d\'huile (Litres)' : 'Oil Quantity Replaced (Liters)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={checklist.oilQuantityLiters}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, oilQuantityLiters: Number(e.target.value) }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Bon de travail # / Facture #' : 'Work Order # / Invoice #'}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={workOrderNumber}
                    onChange={(e) => setWorkOrderNumber(e.target.value)}
                    placeholder="WO #"
                    className="w-1/2 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                    required
                  />
                  <input
                    type="text"
                    value={partsInvoiceNumber}
                    onChange={(e) => setPartsInvoiceNumber(e.target.value)}
                    placeholder="Invoice #"
                    className="w-1/2 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {[
                {
                  key: 'engineOilChanged',
                  label: isFrench ? 'Huile moteur vidangée et remplie' : 'Engine Oil Drained & Refilled'
                },
                {
                  key: 'oilFilterReplaced',
                  label: isFrench ? 'Filtres à huile remplacés' : 'Primary & Bypass Oil Filters Replaced'
                },
                {
                  key: 'chassisLubricated',
                  label: isFrench ? 'Châssis, pivots et cames en S graissés' : 'Chassis, Kingpins & S-Cams Greased'
                },
                {
                  key: 'rearBrakeSlackAdjusted',
                  label: isFrench ? 'Course et jeu des freins ajustés' : 'Brake Pushrod Stroke & Slack Adjusted'
                },
                {
                  key: 'tirePressureAdjusted',
                  label: isFrench ? 'Pression des pneus vérifiée et ajustée' : 'All Tires Inspected & Inflated to Spec'
                },
                {
                  key: 'fluidsToppedUp',
                  label: isFrench ? 'Liquide de refroidissement, DEF et direction' : 'Coolant, DEF, Power Steering & Washer Topped'
                },
                {
                  key: 'fuelFilterReplaced',
                  label: isFrench ? 'Filtre à carburant / séparateur d\'eau remplacé' : 'Fuel / Water Separator Filter Replaced'
                },
                {
                  key: 'suspensionAndSteeringChecked',
                  label: isFrench ? 'Suspension et timonerie de direction vérifiées' : 'Suspension Bushings & Steering Linkage Checked'
                },
                {
                  key: 'saaqFicheEntretienSigned',
                  label: isFrench ? 'Fiche d\'entretien SAAQ signée' : 'SAAQ Fiche d\'entretien Checklist Signed'
                }
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center space-x-2 p-2 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checklist[item.key as keyof PMChecklistItem])}
                    onChange={(e) =>
                      setChecklist((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked
                      }))
                    }
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-800"
                  />
                  <span className="text-slate-200 text-[11px] leading-tight">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ELEMENT 5: Performer Identity & Sign-off */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <span>
                {isFrench
                  ? 'Élément 5 : Identité de l\'exécutant (Signature du mécanicien ou atelier externe)'
                  : 'Element 5: Performer Identity (Certified Mechanic Signature or External Repair Shop)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Type d\'exécutant' : 'Performer Type'}
                </label>
                <select
                  value={performerType}
                  onChange={(e) => setPerformerType(e.target.value as 'IN_HOUSE_MECHANIC' | 'EXTERNAL_SHOP')}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                >
                  <option value="IN_HOUSE_MECHANIC">
                    {isFrench ? 'Mécanicien certifié interne' : 'In-House Certified Fleet Mechanic'}
                  </option>
                  <option value="EXTERNAL_SHOP">
                    {isFrench ? 'Atelier de réparation commercial externe' : 'External Commercial Repair Shop'}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Nom du mécanicien / technicien *' : 'Mechanic / Technician Name *'}
                </label>
                <input
                  type="text"
                  value={mechanicName}
                  onChange={(e) => setMechanicName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Certificat # (310T / CPA)' : 'Certificate # (310T / CPA)'}
                </label>
                <input
                  type="text"
                  value={mechanicLicenseNumber}
                  onChange={(e) => setMechanicLicenseNumber(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Nom de l\'atelier / garage *' : 'Facility / Repair Shop Name *'}
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Signature numérique du mécanicien *' : 'Mechanic Digital Signature / Sign-Off *'}
                </label>
                <input
                  type="text"
                  value={mechanicSignature}
                  onChange={(e) => setMechanicSignature(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {isFrench ? 'Remarques d\'entretien et d\'audit' : 'Auditor & Maintenance Remarks'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isFrench
                      ? 'ex. Graissage châssis ; 19L d\'huile 15W-40 remplacés ; aucune fuite.'
                      : 'e.g. Rear S-cam bushings greased; 19L 15W-40 oil replaced; zero leaks.'
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
            >
              {isFrench ? 'Annuler' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition shadow-lg flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>
                {saving
                  ? isFrench
                    ? 'Enregistrement...'
                    : 'Saving Record...'
                  : isFrench
                  ? 'Enregistrer le dossier d\'entretien'
                  : 'Save PM & Oil Change Record'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
