import React, { useState } from 'react';
import {
  X,
  Users,
  CheckCircle2,
  Clock,
  Phone,
  Award,
  AlertCircle,
  Navigation
} from 'lucide-react';
import { RouteOpening, RouteOpeningApplicant } from '../../types/routeOpening';
import { RouteOpeningService } from '../../services/routeOpeningService';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';

interface RouteOpeningApplicantsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  opening: RouteOpening | null;
  onAwarded: () => void;
}

export const RouteOpeningApplicantsDrawer: React.FC<RouteOpeningApplicantsDrawerProps> = ({
  isOpen,
  onClose,
  opening,
  onAwarded
}) => {
  const { currentUser } = useAuth();
  const { t } = useI18n();

  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  const [awardingApplicant, setAwardingApplicant] = useState<RouteOpeningApplicant | null>(null);
  const [awardNotes, setAwardNotes] = useState<string>('');
  const [isAwarding, setIsAwarding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !opening) return null;

  const applicants = opening.applicants || [];

  // Sort applicants: pending first, then by deadhead km ascending
  const sortedApplicants = [...applicants].sort((a, b) => {
    if (a.status === 'selected') return -1;
    if (b.status === 'selected') return 1;
    if (a.status === 'withdrawn' && b.status !== 'withdrawn') return 1;
    if (b.status === 'withdrawn' && a.status !== 'withdrawn') return -1;

    const kmA = typeof a.deadheadKm === 'number' ? a.deadheadKm : 9999;
    const kmB = typeof b.deadheadKm === 'number' ? b.deadheadKm : 9999;
    return kmA - kmB;
  });

  const handleConfirmAward = async () => {
    if (!awardingApplicant) return;

    setIsAwarding(true);
    setError(null);

    try {
      await RouteOpeningService.confirmAndAwardOpening(
        opening,
        awardingApplicant,
        actorName,
        awardNotes.trim() || undefined
      );
      onAwarded();
      setAwardingApplicant(null);
      onClose();
    } catch (err: any) {
      console.error('[ApplicantsDrawer] Failed to award position:', err);
      setError(err?.message || 'Failed to award position. Please try again.');
    } finally {
      setIsAwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl my-auto flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  {t.routeOpenings?.reviewApplicantsBtn || 'Review Candidates'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Route {opening.routeNo}
                </span>
                <span className="text-xs text-slate-400">
                  ({applicants.length} {t.routeOpenings?.applicantsCount || 'Applicants'})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {opening.postingType === 'permanent' ? 'Permanent Route Vacancy' : 'Temporary Coverage Shift'} •
                Effective: {opening.effectiveStartDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Applicant list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {sortedApplicants.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              {t.routeOpenings?.noApplicantsYet || 'No applicants have applied for this posting yet.'}
            </div>
          ) : (
            sortedApplicants.map((app) => {
              const isSelected = app.status === 'selected';
              const isWithdrawn = app.status === 'withdrawn';
              const isPending = app.status === 'pending';

              return (
                <div
                  key={app.employeeId}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-purple-950/30 border-purple-500/50 shadow-md ring-1 ring-purple-500/30'
                      : isWithdrawn
                      ? 'bg-slate-900/40 border-slate-800 opacity-60'
                      : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-sm text-slate-100">{app.fullName}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700 text-slate-300">
                          {app.roleApplied.toUpperCase()}
                        </span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-purple-400" />
                            Awarded Position
                          </span>
                        )}
                        {isWithdrawn && (
                          <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-500">
                            Withdrawn
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400">
                        {app.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            {app.phone}
                          </span>
                        )}
                        {app.jobPosition && (
                          <span className="text-slate-400">Role: {app.jobPosition}</span>
                        )}
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3" />
                          Applied: {app.appliedAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Proximity & Award Button */}
                    <div className="flex items-center gap-3">
                      {typeof app.deadheadKm === 'number' ? (
                        <div className="text-right">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Navigation className="w-3.5 h-3.5 text-amber-400" />
                            ~{app.deadheadKm} km deadhead
                          </span>
                          {typeof app.deadheadDurationMinutes === 'number' && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              ~{app.deadheadDurationMinutes} min pull-out
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No GPS coordinates</span>
                      )}

                      {isPending && opening.status !== 'awarded' && (
                        <button
                          onClick={() => setAwardingApplicant(app)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                        >
                          <Award className="w-3.5 h-3.5" />
                          Award
                        </button>
                      )}
                    </div>
                  </div>

                  {app.notes && (
                    <div className="mt-2.5 p-2 bg-slate-900/60 rounded-lg text-xs text-slate-300 border border-slate-800">
                      <span className="text-slate-500 font-semibold mr-1.5">Note:</span>
                      {app.notes}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Confirmation Modal overlay when Dispatcher clicks "Award" */}
        {awardingApplicant && (
          <div className="p-5 border-t border-purple-500/30 bg-purple-950/40">
            <div className="flex items-start gap-3">
              <Award className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-100">
                  {t.routeOpenings?.awardDialogTitle || 'Confirm Award Position'}
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Award <span className="font-bold text-amber-300">{awardingApplicant.fullName}</span> to Route{' '}
                  <span className="font-bold text-purple-300">{opening.routeNo}</span> as{' '}
                  <span className="font-bold text-slate-100">{awardingApplicant.roleApplied.toUpperCase()}</span>?
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {opening.postingType === 'permanent'
                    ? 'This will permanently assign the crew to the bus route.'
                    : 'This will schedule a temporary coverage assignment for the shift dates.'}
                </p>

                <div className="mt-3">
                  <input
                    type="text"
                    value={awardNotes}
                    onChange={(e) => setAwardNotes(e.target.value)}
                    placeholder="Confirmation notes or instructions (optional)..."
                    className="w-full bg-slate-900/90 border border-purple-700/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 mt-3">
                  <button
                    onClick={() => setAwardingApplicant(null)}
                    disabled={isAwarding}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAward}
                    disabled={isAwarding}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
                  >
                    {isAwarding ? 'Confirming Award...' : 'Confirm & Award Now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Candidates sorted by shortest deadhead distance to 1st stop.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
