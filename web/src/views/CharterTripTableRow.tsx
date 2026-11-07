import { memo, type MouseEvent } from 'react';
import { ArrowRight, CheckCircle2, Megaphone, Pencil, Trash2, Users } from 'lucide-react';
import {
  CharterTrip,
  formatCharterStopTime,
  getCharterTripStatusLabel,
  getCharterTripTypeLabel,
} from '../types/charter';
import { RouteOpening } from '../types/routeOpening';
import { normalizeCharterTripStops, resolveDefaultStopTime } from './charterStopHelpers';

export interface CharterTripTableRowProps {
  trip: CharterTrip;
  opening?: RouteOpening;
  isFrench: boolean;
  onOpen: (tripId: string) => void;
  onPublish: (trip: CharterTrip, event?: MouseEvent) => void;
  onEdit: (trip: CharterTrip) => void;
  onDelete: (trip: CharterTrip) => void;
  onReview: (openingId: string) => void;
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
  onSelectVehicle?: (vehicleId?: number, unitNumber?: string) => void;
}

export const CharterTripTableRow = memo(function CharterTripTableRow({
  trip,
  opening,
  isFrench,
  onOpen,
  onPublish,
  onEdit,
  onDelete,
  onReview,
  onSelectEmployee,
  onSelectVehicle,
}: CharterTripTableRowProps) {
  const departsTime = trip.departsAt ? trip.departsAt.replace('T', ' ').slice(11, 16) : '-';
  const returnsTime = trip.returnsAt ? trip.returnsAt.replace('T', ' ').slice(11, 16) : '-';
  const allShifts = trip.assignments || [];
  const totalShifts = Math.max(trip.vehiclesNeeded || 1, allShifts.length);
  const assignedShifts = allShifts.filter(
    (assignment) => Boolean(assignment.driverId || assignment.driverName || (assignment.vehicleId && assignment.vehicleUnitNumber && assignment.vehicleUnitNumber !== 'TBD'))
  );
  const driverFilledCount = allShifts.filter((assignment) => Boolean(assignment.driverId || assignment.driverName)).length;
  const openShiftsCount = Math.max(0, totalShifts - assignedShifts.length);

  return (

                        <tr
                          key={trip.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          onClick={() => onOpen(trip.id)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {trip.tripNumber}
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                              {trip.title}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {trip.dispatchDate}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                              {trip.clientName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {trip.passengerCount} {isFrench ? 'passagers' : 'passengers'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 space-y-1">
                            <div>
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {getCharterTripTypeLabel(trip.tripType, isFrench)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                  trip.status === 4
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                    : trip.status === 3
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : trip.status === 2
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : trip.status === 1
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {getCharterTripStatusLabel(trip.status, isFrench)}
                              </span>
                            </div>
                            {(() => {
                              const charterOp = opening;
                              const isPublished = Boolean(
                                (charterOp && charterOp.status !== 'cancelled') || trip.isPublishedOpen
                              );
                              if (!isPublished) return null;
                              const isAwarded = charterOp?.status === 'awarded';
                              return (
                                <div>
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                      isAwarded
                                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    <span>
                                      {isAwarded
                                        ? isFrench
                                          ? 'Offre attribuée'
                                          : 'Opening Awarded'
                                        : isFrench
                                        ? 'Publié (Open)'
                                        : 'Published (Open)'}
                                    </span>
                                  </span>
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono">
                            <div className="text-slate-700 dark:text-slate-300 font-semibold">
                              {isFrench ? 'Dép :' : 'Dep:'} {departsTime}
                            </div>
                            <div className="text-slate-400">
                              {isFrench ? 'Ret :' : 'Ret:'} {returnsTime}
                            </div>
                            {(() => {
                              const charterOp = opening;
                              const displayStops = normalizeCharterTripStops(trip, charterOp);
                              if (!displayStops.length) return null;
                              return (
                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                                  {displayStops.map((st, sIdx) => {
                                    const stTime =
                                      formatCharterStopTime(st.scheduledAt) ||
                                      resolveDefaultStopTime(trip, st, sIdx, charterOp);
                                    const isPickup = st.stopType === 0 || st.stopType === 3;
                                    const actionTag = isPickup ? 'Pick' : 'Drop';
                                    return (
                                      <div
                                        key={st.id || sIdx}
                                        className="flex items-center justify-between gap-2 text-[10px] text-slate-600 dark:text-slate-300"
                                        title={`#${sIdx + 1} ${actionTag}: ${st.address} @ ${stTime}`}
                                      >
                                        <span className="truncate max-w-[125px] font-sans">
                                          <span
                                            className={`font-bold ${
                                              isPickup
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-amber-600 dark:text-amber-400'
                                            }`}
                                          >
                                            {actionTag}
                                          </span>{' '}
                                          {st.address}
                                        </span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                          {stTime || '--:--'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  driverFilledCount >= totalShifts
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                    : assignedShifts.length > 0
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                                }`}
                              >
                                {driverFilledCount} / {totalShifts} {isFrench ? 'quarts assignés' : 'shifts assigned'}
                              </span>
                            </div>
                            {assignedShifts.length === 0 ? (
                              <span className="text-xs text-amber-500 font-semibold">
                                {totalShifts} {isFrench ? 'quarts ouverts (non assignés)' : 'open shifts (unassigned)'}
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {assignedShifts.slice(0, 4).map((asg, sIdx) => {
                                  const hasVehicle = Boolean(
                                    asg.vehicleId && asg.vehicleUnitNumber && asg.vehicleUnitNumber !== 'TBD'
                                  );
                                  const hasDriver = Boolean(asg.driverId || asg.driverName);
                                  return (
                                  <div key={asg.id} className="text-xs flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                      #{asg.runNumber || sIdx + 1}
                                    </span>
                                    {hasVehicle ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectVehicle?.(asg.vehicleId, asg.vehicleUnitNumber);
                                        }}
                                        className="font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300 hover:underline transition"
                                        title={isFrench ? 'Voir la fiche véhicule' : 'View vehicle details'}
                                      >
                                        {asg.vehicleUnitNumber}
                                      </button>
                                    ) : (
                                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {asg.vehicleUnitNumber || 'TBD'}
                                      </span>
                                    )}
                                    <span className="text-slate-400">•</span>
                                    {hasDriver ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectEmployee?.(asg.driverId, asg.driverName);
                                        }}
                                        className="text-slate-800 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-300 hover:underline transition"
                                        title={isFrench ? 'Voir la fiche chauffeur' : 'View driver details'}
                                      >
                                        {asg.driverName}
                                      </button>
                                    ) : (
                                      <span className="text-slate-800 dark:text-slate-200">
                                        {isFrench ? 'Chauffeur à assigner' : 'Driver TBD'}
                                      </span>
                                    )}
                                    {asg.isDriverCheckedIn && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        {isFrench ? 'Pointé' : 'Checked In'}
                                      </span>
                                    )}
                                  </div>
                                  );
                                })}
                                {assignedShifts.length > 4 && (
                                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                                    +{assignedShifts.length - 4} {isFrench ? 'autres assignés' : 'more assigned'}
                                  </div>
                                )}
                                {openShiftsCount > 0 && (
                                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                    +{openShiftsCount} {isFrench ? 'quarts ouverts' : 'open shift(s)'}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ${(trip.quotedAmount || 0).toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {trip.billableHours || 0} hrs
                            </div>
                            <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                              {isFrench ? 'Chauff:' : 'Drv:'} ${(trip.driverPayRate ?? trip.assignments?.[0]?.driverPayRate ?? 150).toFixed(0)}
                              {(trip.needsAttendant || trip.attendantPayRate) && (
                                <span>
                                  {' • '}
                                  {isFrench ? 'Acc:' : 'Att:'} ${(trip.attendantPayRate ?? trip.assignments?.[0]?.attendantPayRate ?? 100).toFixed(0)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const charterOp = opening;
                              const isPublished = Boolean(
                                (charterOp && charterOp.status !== 'cancelled') || trip.isPublishedOpen
                              );
                              const applicantCount = charterOp?.applicants?.filter((a) => a.status !== 'withdrawn').length || 0;
                              return (
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    <button
                                      onClick={(e) => onPublish(trip, e)}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                        isPublished
                                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs'
                                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60'
                                      }`}
                                      title={
                                        isPublished
                                          ? isFrench
                                            ? 'Déjà publié dans Route Openings — Cliquer pour modifier'
                                            : 'Already Published to Route Openings — Click to update'
                                          : isFrench
                                          ? 'Publier l\'offre aux chauffeurs (Route Openings)'
                                          : 'Publish Assignment Open to Driver App (Route Openings)'
                                      }
                                    >
                                      {isPublished ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      ) : (
                                        <Megaphone className="w-3 h-3 shrink-0" />
                                      )}
                                      <span>
                                        {isPublished
                                          ? isFrench
                                            ? 'Publié ✓'
                                            : 'Published ✓'
                                          : isFrench
                                          ? 'Publier Open'
                                          : 'Publish Open'}
                                      </span>
                                    </button>
                                    {(charterOp || isPublished) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (charterOp) {
                                            onReview(charterOp.id);
                                          } else {
                                            onPublish(trip, e);
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-950/70 dark:text-purple-300 transition-all"
                                        title={isFrench ? 'Voir les candidats' : 'Review Applicants'}
                                      >
                                        <Users className="w-3 h-3" />
                                        <span>{applicantCount}</span>
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => onOpen(trip.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                      title={isFrench ? 'Détails & affectation' : 'Details & Crew'}
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => onEdit(trip)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                      title={isFrench ? 'Modifier' : 'Edit'}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => onDelete(trip)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                                      title={isFrench ? 'Supprimer' : 'Delete'}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
  );
});
