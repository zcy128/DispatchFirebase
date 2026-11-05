import { memo } from 'react';
import { Award, Calendar, Check, Clock, Eye, Send, Users } from 'lucide-react';
import { RouteOpening, SanitizedStopPreview } from '../../types/routeOpening';
import { getDeadlineStatus } from '../../utils/routeOpeningDisplay';

interface OpeningCardProps {
  opening: RouteOpening;
  displayStops: SanitizedStopPreview[];
  todayStr: string;
  canManage: boolean;
  currentEmployeeId: string | null;
  labels: {
    appliedBadge?: string;
    applyBtn?: string;
    deadlinePassed?: string;
    daysLeft?: string;
    hoursLeft?: string;
  };
  onInspect: (opening: RouteOpening) => void;
  onReview: (opening: RouteOpening) => void;
  onApply: (opening: RouteOpening) => void;
  onWithdraw: (openingId: string) => void;
  onDelete: (openingId: string) => void;
}

export const OpeningCard = memo(function OpeningCard({
  opening: op,
  displayStops,
  todayStr,
  canManage,
  currentEmployeeId,
  labels,
  onInspect,
  onReview,
  onApply,
  onWithdraw,
  onDelete,
}: OpeningCardProps) {
  const isPermanent = op.postingType === 'permanent';
  const deadlineInfo = getDeadlineStatus(op.deadline, labels);
  const applicantCount = op.applicants?.length || 0;
  const myApp = currentEmployeeId
    ? op.applicants?.find((a) => a.employeeId === currentEmployeeId)
    : null;
  const hasApplied = !!myApp && myApp.status !== 'withdrawn';
  const isAwarded = op.status === 'awarded';

  return (
    <div
      className={`bg-slate-900/90 border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all hover:border-slate-600 ${
        isAwarded
          ? 'border-purple-800/40 opacity-80'
          : myApp
            ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
            : 'border-slate-800'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {op.routeNo}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                op.postingType === 'charter'
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  : isPermanent
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
              }`}
            >
              {op.postingType === 'charter'
                ? `Charter Trip${typeof op.openShiftsCount === 'number' ? ` (${op.openShiftsCount}/${op.vehiclesNeeded || 1} Open)` : ''}`
                : isPermanent
                  ? 'Permanent Run'
                  : 'Temporary Cover'}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300">
              {op.roleNeeded === 'driver'
                ? 'Driver Needed'
                : op.roleNeeded === 'attendant'
                  ? 'Attendant Needed'
                  : 'Driver & Attendant'}
            </span>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${deadlineInfo.color}`}
          >
            {deadlineInfo.label}
          </span>
        </div>

        <h3 className="font-bold text-sm text-slate-100 mt-3 line-clamp-1">
          {op.routeName || `Route ${op.routeNo}`}
        </h3>

        <div className="mt-2 space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              {isPermanent ? (
                <>
                  Effective From: <strong className="text-slate-200">{op.effectiveStartDate}</strong>
                </>
              ) : (
                <>
                  Coverage:{' '}
                  <strong className="text-slate-200">
                    {op.effectiveStartDate} ~ {op.effectiveEndDate || op.effectiveStartDate}
                  </strong>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Shift:{' '}
              <strong className="text-slate-200">
                {op.shiftType === 'ALL' ? 'Morning & Afternoon (AM/PM)' : op.shiftType}
              </strong>
            </span>
          </div>

          {op.schoolBoardCode && (
            <div className="text-[11px] text-slate-500">Board: {op.schoolBoardCode}</div>
          )}
        </div>

        {displayStops.length > 0 && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Stop Schedule ({displayStops.length} stops)</span>
              <span>Time</span>
            </div>
            <div className="divide-y divide-slate-800/60 space-y-1">
              {displayStops.map((st, sIdx) => (
                <div
                  key={st.stopId || sIdx}
                  className="pt-1 first:pt-0 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {st.sequence || sIdx + 1}
                    </span>
                    <span className="text-slate-300 truncate" title={st.stopLocation}>
                      {st.stopLocation}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-cyan-400 shrink-0">
                    {st.stopScheduleTime || '--:--'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {op.description && (
          <p className="mt-2.5 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80 line-clamp-2">
            {op.description}
          </p>
        )}

        {isAwarded && (
          <div className="mt-3 p-2.5 bg-purple-950/40 border border-purple-800/40 rounded-xl text-xs text-purple-300 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  Awarded to:{' '}
                  <strong>
                    {[op.awardedDriverName, op.awardedAttendantName].filter(Boolean).join(' & ') ||
                      'Selected Candidate'}
                  </strong>
                </span>
              </span>
              {op.postingType === 'permanent' ? (
                op.crewAppliedToRoute || !op.effectiveStartDate || op.effectiveStartDate <= todayStr ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Crew Applied to Route
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Auto-Updates on {op.effectiveStartDate}
                  </span>
                )
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Temporary Cover Active
                  </span>
                  {op.temporaryAssignmentId && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Direct Cover
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => onInspect(op)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Inspect Stops (Confidential)</span>
          </button>

          {canManage ? (
            <button
              onClick={() => onReview(op)}
              className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-700/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Candidates ({applicantCount})</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">
              {applicantCount} applicant{applicantCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {!isAwarded && (
          <div className="pt-1">
            {hasApplied ? (
              <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-xl text-xs">
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  {labels.appliedBadge || 'Applied (Pending Review)'}
                </span>
                {!deadlineInfo.isPassed && (
                  <button
                    onClick={() => onWithdraw(op.id)}
                    className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ) : deadlineInfo.isPassed ? (
              <button
                disabled
                className="w-full py-2 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed text-center"
              >
                Application Window Closed
              </button>
            ) : (
              <button
                onClick={() => onApply(op)}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{labels.applyBtn || 'Apply / Express Interest'}</span>
              </button>
            )}
          </div>
        )}

        {canManage && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => onDelete(op.id)}
              className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
            >
              Delete Bulletin
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
