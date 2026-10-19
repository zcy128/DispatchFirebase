import React, { useState, useEffect } from 'react';
import { Vehicle } from '../../types/vehicle';
import {
  X,
  Bus,
  Car,
  Truck,
  User,
  Phone,
  Fuel,
  ShieldCheck,
  Building2,
  Route as RouteIcon,
  Edit2,
  History,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Clock,
  FileText
} from 'lucide-react';
import { AssignmentHistoryService } from '../../services/assignmentHistoryService';
import { AssignmentHistoryRecord } from '../../types/assignmentHistory';
import { EntityOperationLogPanel } from '../common/EntityOperationLogPanel';
import { useCompliance } from '../../contexts/ComplianceContext';
import { useI18n } from '../../contexts/I18nContext';

interface VehicleDetailDrawerProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSelectRoute?: (routeNo: string) => void;
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicle: Vehicle) => void;
}

export const VehicleDetailDrawer: React.FC<VehicleDetailDrawerProps> = ({
  vehicle,
  onClose,
  onSelectRoute,
  onEdit,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'specs' | 'driver_timeline' | 'audit'>('specs');
  const { config: complianceConfig, isOntario } = useCompliance();
  const { isFrench } = useI18n();
  const [vehicleAssignments, setVehicleAssignments] = useState<AssignmentHistoryRecord[]>([]);

  useEffect(() => {
    if (!vehicle) {
      setVehicleAssignments([]);
      return;
    }
    const unsub = AssignmentHistoryService.subscribeToHistory((all) => {
      const vUnit = vehicle.unitNumber;
      const vId = vehicle.vehicleId;
      const filtered = all.filter(
        (r) =>
          r.unitNumber === vUnit ||
          (r.vehicleId && String(r.vehicleId) === String(vId)) ||
          (r.type === 'driver_vehicle' && r.unitNumber === vUnit)
      );
      setVehicleAssignments(filtered);
    });
    return () => unsub();
  }, [vehicle]);

  if (!vehicle) return null;

  const isAssigned = !!vehicle.assignedRouteId;
  const isBus = vehicle.unitType.toLowerCase().includes('bus');
  const isVan = vehicle.unitType.toLowerCase().includes('van');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 text-slate-100 h-full overflow-y-auto shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/90 sticky top-0 backdrop-blur z-10">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
                {isBus ? <Bus className="w-7 h-7" /> : isVan ? <Truck className="w-7 h-7" /> : <Car className="w-7 h-7" />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {isFrench ? `Unité #${vehicle.unitNumber}` : `Unit #${vehicle.unitNumber}`}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      isAssigned
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {vehicle.status || (isAssigned ? (isFrench ? 'En service' : 'In Service') : (isFrench ? 'Réserve' : 'Spare'))}
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    {vehicle.unitType}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium font-mono">
                  {isFrench ? 'Plaque' : 'Plate'}: {vehicle.plateNumber || (isFrench ? 'Sans plaque' : 'No Plate')}
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                  <span className="flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{vehicle.yardName || 'HQ-Central'}</span>
                  </span>
                  <span>•</span>
                  <span>{vehicle.seatCap} {isFrench ? 'Places passagers' : 'Passenger Seats'}</span>
                  {vehicle.wheelchairCap > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-400 font-semibold">{vehicle.wheelchairCap} {isFrench ? 'Poste FR' : 'WC Station'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subtab Switcher */}
          <div className="flex items-center space-x-2 px-6 pt-4 border-b border-slate-800 bg-slate-900/60 overflow-x-auto">
            <button
              onClick={() => setActiveTab('specs')}
              className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'specs'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bus className="w-3.5 h-3.5" />
              <span>{isFrench ? 'Spécifications & Opérations' : 'Specs & Operations'}</span>
            </button>
            <button
              onClick={() => setActiveTab('driver_timeline')}
              className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'driver_timeline'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{isFrench ? 'Historique chauffeurs' : 'Driver Timeline'} ({vehicleAssignments.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{isFrench ? "Journal d'opérations" : 'Operation History & Logs'}</span>
            </button>
          </div>

          {activeTab === 'audit' && (
            <div className="p-6">
              <EntityOperationLogPanel
                targetType="vehicle"
                targetId={vehicle.id}
                targetIdentifier={vehicle.unitNumber}
                title={isFrench ? `Journal d'audit : Unité #${vehicle.unitNumber}` : `Audit Log: Unit #${vehicle.unitNumber}`}
                subtitle={isFrench ? `Opérations et modifications enregistrées pour l'unité #${vehicle.unitNumber}` : `Operations & modifications recorded for Unit #${vehicle.unitNumber}`}
                compact={true}
              />
            </div>
          )}

          {activeTab === 'driver_timeline' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isFrench ? 'Chronologie des affectations chauffeurs' : 'Driver Assignment Timeline'} ({vehicleAssignments.length})</span>
                </h3>
              </div>

              {vehicleAssignments.length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 text-xs text-slate-500 italic text-center">
                  {isFrench
                    ? `Aucune affectation historique de chauffeur enregistrée pour l'unité #${vehicle.unitNumber}.`
                    : `No historical driver allocations recorded for Unit #${vehicle.unitNumber}.`}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {vehicleAssignments.map((asg) => {
                    const isAssign = asg.action === 'assign';
                    return (
                      <div
                        key={asg.id}
                        className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isAssign
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {isAssign
                                ? (isFrench ? 'Assigné au chauffeur' : 'Assigned to Driver')
                                : (isFrench ? 'Libéré du chauffeur' : 'Released from Driver')}
                            </span>
                            {asg.isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
                                {isFrench ? 'Actuel' : 'Current'}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {asg.effectiveDate}
                          </span>
                        </div>

                        <div className="font-semibold text-white flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-amber-400" />
                          <span>{asg.driverName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({asg.driverId})</span>
                        </div>

                        {asg.reason && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{asg.reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="p-6 space-y-6">
              {/* Operational Assignment (Driver & Route) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {isFrench ? 'Affectation opérationnelle actuelle' : 'Current Operational Assignment'}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Route Card */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center space-x-2 text-[10px] uppercase font-bold text-slate-500">
                      <RouteIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isFrench ? 'Circuit assigné' : 'Assigned Route'}</span>
                    </div>
                    {vehicle.assignedRouteNo ? (
                      <div>
                        <div
                          onClick={() => onSelectRoute && onSelectRoute(vehicle.assignedRouteNo!)}
                          className="font-bold text-white text-sm hover:text-amber-400 transition cursor-pointer flex items-center space-x-1.5 mt-1"
                        >
                          <span>{vehicle.assignedRouteNo}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5" title={vehicle.assignedRouteName}>
                          {vehicle.assignedRouteName}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic mt-1">
                        {isFrench ? 'En attente / Non assigné à un circuit' : 'Standby / Unassigned to route'}
                      </div>
                    )}
                  </div>

                  {/* Driver Card */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center space-x-2 text-[10px] uppercase font-bold text-slate-500">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isFrench ? 'Chauffeur assigné' : 'Assigned Driver'}</span>
                    </div>
                    {vehicle.driverName ? (
                      <div>
                        <div className="font-bold text-white text-sm mt-1">
                          {vehicle.driverName}
                        </div>
                        {vehicle.driverPhone ? (
                          <a
                            href={`tel:${vehicle.driverPhone}`}
                            className="text-amber-400 hover:underline font-mono text-xs flex items-center space-x-1 mt-1 font-semibold"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{vehicle.driverPhone}</span>
                          </a>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">{isFrench ? 'Aucun téléphone direct' : 'No direct phone'}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic mt-1">
                        {isFrench ? 'Aucun chauffeur régulier assigné' : 'No regular driver assigned'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle Specifications */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {isFrench ? 'Spécifications du véhicule' : 'Vehicle Specifications'}
                </h3>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl divide-y divide-slate-800/60 text-xs">
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400">{isFrench ? 'Marque & Modèle' : 'Make & Model'}</span>
                    <span className="font-bold text-white">
                      {vehicle.manufacturer} {vehicle.model} ({vehicle.year})
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400">{isFrench ? 'NIV (Numéro d’identification)' : 'VIN (Vehicle Identification #)'}</span>
                    <span className="font-mono text-slate-300">
                      {vehicle.vin || (isFrench ? 'Non enregistré' : 'Not Registered')}
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400">{isFrench ? 'Configuration des sièges' : 'Seating Configuration'}</span>
                    <div className="space-x-2 font-medium">
                      <span className="text-slate-200">{vehicle.seatCap} {isFrench ? 'Places' : 'Seats'}</span>
                      {vehicle.wheelchairCap > 0 && (
                        <span className="text-indigo-400 font-bold">+{vehicle.wheelchairCap} FR</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400">{isFrench ? 'Carburant & Motorisation' : 'Fuel & Powertrain'}</span>
                    <div className="flex items-center space-x-1.5 font-bold text-slate-200">
                      <Fuel className="w-3.5 h-3.5 text-amber-400" />
                      <span>{vehicle.fuelType}</span>
                    </div>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400">{isFrench ? 'Couleur & Finition' : 'Color & Finish'}</span>
                    <span className="text-slate-200 font-medium">{vehicle.color || (isFrench ? 'Jaune autobus scolaire' : 'School Bus Yellow')}</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-400">{isFrench ? 'Garage / Dépôt principal' : 'Home Terminal / Yard'}</span>
                    <span className="text-slate-200 font-medium">{vehicle.yardName}</span>
                  </div>
                </div>
              </div>

              {/* Compliance & Safety: Semi-Annual Mechanical Inspection & Archival */}
              {(() => {
                const nextDueStr = vehicle.nextInspectionDue || vehicle.licenseExpiry || '2026-11-30';
                const dueDays = Math.ceil(
                  (new Date(nextDueStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const preInspectionBuffer = complianceConfig.advancePreInspectionDays || 21;
                const isExpired = dueDays <= 0;
                const isPreDue = !isExpired && dueDays <= preInspectionBuffer;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isFrench ? 'Inspection mécanique semestrielle & Archivage' : 'Semi-Annual Safety Inspection & Archival'}</span>
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isOntario
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      }`}>
                        {isOntario ? '🇨🇦 Ontario: DriveON PMVI (MTO)' : '⚜️ Québec: SAAQ VMP / PEP'}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isExpired
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : isPreDue
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {isExpired ? (
                              <AlertTriangle className="w-5 h-5" />
                            ) : isPreDue ? (
                              <Clock className="w-5 h-5 animate-pulse" />
                            ) : (
                              <ShieldCheck className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">
                              {complianceConfig.inspectionType}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 space-x-2">
                              <span>{isFrench ? 'Échéance' : 'Due'}: <strong className="text-slate-200">{nextDueStr.substring(0, 10)}</strong></span>
                              {vehicle.lastInspectionDate && (
                                <span className="text-slate-500">• {isFrench ? 'Dernière' : 'Last'}: {vehicle.lastInspectionDate.substring(0, 10)}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {isFrench ? 'Norme' : 'Standard'}: {complianceConfig.inspectionStandard}
                            </div>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
                          isExpired
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isPreDue
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {isExpired
                            ? (isFrench ? 'EXPIRÉ / HORS SERVICE' : 'EXPIRED / OUT OF SERVICE')
                            : isPreDue
                            ? (isFrench ? `PRÉ-INSPECTION REQUISE (${dueDays}j)` : `PRE-INSPECTION DUE (${dueDays}d left)`)
                            : (isFrench ? `Conforme (${dueDays}j restants)` : `Compliant (${dueDays}d left)`)}
                        </span>
                      </div>

                      {/* Advance Pre-Inspection Alert Banner */}
                      {isPreDue && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{isFrench ? 'Action requise : Fenêtre de pré-inspection interne' : 'Action Required: Advance Yard Pre-Inspection Window'}</span>
                          </div>
                          <p className="text-[11px] text-amber-200/90 leading-relaxed">
                            {isFrench ? (
                              <>L'inspection officielle expire dans <strong>{dueDays} jours</strong>. Selon la procédure de sécurité de l'entreprise, effectuez une pré-inspection interne maintenant pour remplacer les plaquettes de frein usées et corriger les défauts mineurs avant le jour de l'examen.</>
                            ) : (
                              <>Official inspection expires in <strong>{dueDays} days</strong>. Under company safety procedure, conduct internal pre-inspection now to replace worn brake pads and fix minor defects, preventing out-of-service orders on test day.</>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Certificate & Sticker Identifiers */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-xs font-mono">
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">
                            {isOntario ? (isFrench ? 'N° Certificat DriveON' : 'DriveON Certificate #') : 'SAAQ CVM #'}
                          </span>
                          <span className="text-slate-200 font-bold">
                            {vehicle.inspectionCertificateNumber || (isOntario ? `DOC-ON-${vehicle.unitNumber}` : `CVM-QC-${vehicle.unitNumber}`)}
                          </span>
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">
                            {isOntario ? (isFrench ? 'N° Vignette DriveON' : 'DriveON Sticker / Decal #') : 'Vignette SAAQ #'}
                          </span>
                          <span className="text-slate-200 font-bold">
                            {vehicle.inspectionStickerNumber || `STK-${vehicle.unitNumber}-2026`}
                          </span>
                        </div>
                      </div>

                      {/* 3 Statutory Operator Archival Checkpoints */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {isFrench ? "Liste de contrôle d'archivage réglementaire (MTO / SAAQ) :" : 'Operator Audit Archival Checklist (MTO / SAAQ Statutory Duty):'}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                            vehicle.hasInVehicleCertificate !== false
                              ? 'bg-emerald-950/20 text-emerald-300 border-emerald-500/20'
                              : 'bg-rose-950/20 text-rose-300 border-rose-500/20'
                          }`}>
                            <FileCheck className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate" title="Glovebox Certificate + Punched Decal Present">
                              {isFrench ? '1. Document à bord' : '1. In-Cab Document'}
                            </span>
                          </div>

                          <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                            vehicle.hasDetailedMeasurementsArchived !== false
                              ? 'bg-emerald-950/20 text-emerald-300 border-emerald-500/20'
                              : 'bg-amber-950/20 text-amber-300 border-amber-500/20'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate" title="Brake mm and tire tread measurement sheet on file">
                              {isFrench ? '2. Mesures archivées' : '2. Measurements Archived'}
                            </span>
                          </div>

                          <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                            vehicle.hasProofOfRepairsAttached !== false
                              ? 'bg-emerald-950/20 text-emerald-300 border-emerald-500/20'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}>
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate" title="Work orders and invoices attached for pre-pass repairs">
                              {isFrench ? '3. Preuves de réparation' : '3. Repair Proof Attached'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <span>{isFrench ? 'Durée pure :' : 'Pure Inspection:'} {complianceConfig.inspectionDurationHours}</span>
                        <span>{isFrench ? 'Immobilisation :' : 'Downtime:'} {complianceConfig.fleetDowntimeEstimate}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              {vehicle.notes && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isFrench ? 'Notes de répartition' : 'Dispatch Notes'}
                  </h3>
                  <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    {vehicle.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(vehicle);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Modifier le véhicule' : 'Edit Vehicle'}</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(vehicle)}
                className="px-3 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
                title={isFrench ? 'Mettre hors service ou supprimer le véhicule' : 'Decommission or delete vehicle'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Supprimer' : 'Delete'}</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
          >
            {isFrench ? 'Fermer les détails' : 'Close Details'}
          </button>
        </div>
      </div>
    </div>
  );
};
