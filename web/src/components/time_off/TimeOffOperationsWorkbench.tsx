import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Film,
  MapPin,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { TimeOffService } from '../../services/timeOffService';
import {
  LEAVE_TYPE_LABELS,
  TimeOffRequest,
  TimeOffWorkbenchResponse,
} from '../../types/timeOff';
import {
  getRequestStageDiagnosis,
  notifyTimeOffRequestsUpdated,
  openTimeOffApproverAgent,
} from './TimeOffApproverAgentWindow';
import { TimeOffWorkflowDemoModal } from './TimeOffWorkflowDemoModal';

interface TimeOffOperationsWorkbenchProps {
  employees?: unknown[];
  canApproveTimeOff: boolean;
  onRequestsChanged?: () => void;
}

type StageFilter =
  | 'all'
  | 'unclaimed_broadcast'
  | 'awaiting_peer'
  | 'pre_approved'
  | 'manual_pending';

export const TimeOffOperationsWorkbench: React.FC<TimeOffOperationsWorkbenchProps> = ({
  canApproveTimeOff,
  onRequestsChanged,
}) => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();
  const [bottomTab, setBottomTab] = useState<'stage_tracker' | 'region_list'>('stage_tracker');

  const [workbench, setWorkbench] = useState<TimeOffWorkbenchResponse | null>(null);
  const [loadingWb, setLoadingWb] = useState<boolean>(false);
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [selectedYardFilter, setSelectedYardFilter] = useState<string>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [isDemoOpen, setIsDemoOpen] = useState<boolean>(false);

  const loadWorkbench = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingWb(true);
    }
    try {
      const wb = await TimeOffService.getTimeOffWorkbench().catch(() => null);
      if (wb) {
        setWorkbench(wb);
      }
    } finally {
      if (!silent) {
        setLoadingWb(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadWorkbench(false);

    // Event-driven Firestore listener: only refreshes when time_off_requests changes in the database (no polling timer)
    let isFirstSnapshot = true;
    const unsubscribe = TimeOffService.subscribeToTimeOffRequests(() => {
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        return;
      }
      void loadWorkbench(true);
    });

    const onUpdated = () => {
      void loadWorkbench(true);
    };
    window.addEventListener('time-off-requests-updated', onUpdated);
    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('time-off-requests-updated', onUpdated);
    };
  }, [loadWorkbench]);

  const activeClaims = useMemo(() => workbench?.activeClaims || [], [workbench]);

  const stageStats = useMemo(() => {
    let unclaimedBroadcast = 0;
    let awaitingPeer = 0;
    let preApproved = 0;
    let manualPending = 0;

    for (const r of activeClaims) {
      if (r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled') {
        continue;
      }
      const diag = getRequestStageDiagnosis(r, isFrench);
      if (r.status === 'pre_approved') {
        preApproved++;
      } else if (r.status === 'awaiting_peer_confirm') {
        awaitingPeer++;
      } else if (r.status === 'seeking_coverage' || diag.isUnclaimedBroadcast) {
        unclaimedBroadcast++;
      } else {
        manualPending++;
      }
    }
    return {
      totalActive: unclaimedBroadcast + awaitingPeer + preApproved + manualPending,
      unclaimedBroadcast,
      awaitingPeer,
      preApproved,
      manualPending,
    };
  }, [activeClaims, isFrench]);

  const filteredRequests = useMemo(() => {
    return activeClaims.filter((r) => {
      if (stageFilter === 'all') return true;
      const diag = getRequestStageDiagnosis(r, isFrench);
      if (stageFilter === 'unclaimed_broadcast') {
        return (
          (r.status === 'seeking_coverage' || diag.isUnclaimedBroadcast) &&
          r.status !== 'approved' &&
          r.status !== 'rejected' &&
          r.status !== 'cancelled'
        );
      }
      if (stageFilter === 'awaiting_peer') return r.status === 'awaiting_peer_confirm';
      if (stageFilter === 'pre_approved') return r.status === 'pre_approved';
      if (stageFilter === 'manual_pending') return r.status === 'pending';
      return true;
    });
  }, [activeClaims, stageFilter, isFrench]);

  const handleInlineDecision = async (
    req: TimeOffRequest,
    decision: 'approved' | 'rejected' | 'on_hold' | 'pending'
  ) => {
    if (!canApproveTimeOff) return;
    setActingId(req.id);
    try {
      const reviewerName =
        currentUser?.displayName || currentUser?.email?.split('@')[0] || 'HR Approver';
      const payload = {
        reviewerUserId: currentUser?.uid || 'hr-admin',
        reviewerName,
        approvalNotes:
          decision === 'approved'
            ? 'Approved via 3-Day Time-Off Stage Tracker'
            : decision === 'rejected'
              ? 'Rejected via 3-Day Time-Off Stage Tracker'
              : decision === 'on_hold'
                ? 'Placed on hold via 3-Day Time-Off Stage Tracker'
                : 'Released from hold via 3-Day Time-Off Stage Tracker',
      };
      if (decision === 'approved') {
        await TimeOffService.approveTimeOffRequest(req.id, payload);
      } else if (decision === 'rejected') {
        await TimeOffService.rejectTimeOffRequest(req.id, payload);
      } else if (decision === 'on_hold') {
        await TimeOffService.holdTimeOffRequest(req.id, payload);
      } else {
        await TimeOffService.resumeTimeOffRequest(req.id, payload);
      }

      await loadWorkbench(true);
      notifyTimeOffRequestsUpdated();
      onRequestsChanged?.();
    } finally {
      setActingId(null);
    }
  };

  return (
    <section
      aria-label="Time-Off Stage Tracker and Region Coverage"
      className="mt-6 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-lg overflow-hidden"
    >
      {/* Lower Tab Header */}
      <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-900 border border-slate-700 p-1">
          <button
            type="button"
            onClick={() => setBottomTab('stage_tracker')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              bottomTab === 'stage_tracker'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            {isFrench
              ? 'Suivi des Étapes & Pipeline (3 derniers jours)'
              : '3-Day Pipeline & Stage Tracker'}
          </button>
          <button
            type="button"
            onClick={() => setBottomTab('region_list')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              bottomTab === 'region_list'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            {isFrench
              ? `Régions & Dépôts (${workbench?.yardRegions?.length || 0})`
              : `Regions & Yards Coverage (${workbench?.yardRegions?.length || 0})`}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDemoOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold cursor-pointer transition-colors"
          >
            <Film className="w-3.5 h-3.5 text-indigo-300" aria-hidden="true" />
            {isFrench ? 'Démo animée' : 'Workflow Demo'}
          </button>
          {canApproveTimeOff && (
            <button
              type="button"
              onClick={() => openTimeOffApproverAgent()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-200 text-xs font-bold cursor-pointer transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
              {isFrench ? 'Ouvrir l’Agent IA Approbateur' : 'Open Approver AI Agent'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadWorkbench(false)}
            disabled={loadingWb}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 cursor-pointer"
            title={isFrench ? 'Actualiser' : 'Refresh Workbench'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingWb ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {bottomTab === 'stage_tracker' ? (
        <div className="p-4 space-y-3">
          {/* 4-Stage Pipeline Filter Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                stageFilter === 'all'
                  ? 'bg-teal-600/20 border-teal-500 text-white'
                  : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                {isFrench ? 'Toutes (3j)' : 'All (3 Days)'}
              </div>
              <div className="text-base font-extrabold text-white mt-0.5">
                {activeClaims.length}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStageFilter('unclaimed_broadcast')}
              className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                stageFilter === 'unclaimed_broadcast'
                  ? 'bg-rose-600/25 border-rose-500 text-white'
                  : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-rose-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {isFrench ? 'Publié · Sans candidat' : 'Broadcast · No Applicant'}
                </span>
              </div>
              <div className="text-base font-extrabold text-rose-200 mt-0.5">
                {stageStats.unclaimedBroadcast}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStageFilter('awaiting_peer')}
              className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                stageFilter === 'awaiting_peer'
                  ? 'bg-violet-600/25 border-violet-500 text-white'
                  : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-violet-300 truncate">
                {isFrench ? 'Attente collègue' : 'Awaiting Peer'}
              </div>
              <div className="text-base font-extrabold text-violet-200 mt-0.5">
                {stageStats.awaitingPeer}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStageFilter('pre_approved')}
              className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                stageFilter === 'pre_approved'
                  ? 'bg-cyan-600/25 border-cyan-500 text-white'
                  : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-cyan-300 truncate">
                {isFrench ? 'Pré-approuvé (24h)' : 'Pre-Approved (24h)'}
              </div>
              <div className="text-base font-extrabold text-cyan-200 mt-0.5">
                {stageStats.preApproved}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStageFilter('manual_pending')}
              className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                stageFilter === 'manual_pending'
                  ? 'bg-amber-600/25 border-amber-500 text-white'
                  : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-amber-300 truncate">
                {isFrench ? 'Révision RH' : 'Manual HR Review'}
              </div>
              <div className="text-base font-extrabold text-amber-200 mt-0.5">
                {stageStats.manualPending}
              </div>
            </button>
          </div>

          {/* Pipeline Request Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredRequests.length === 0 ? (
              <div className="col-span-2 p-6 text-center text-xs text-slate-400 bg-slate-800/40 rounded-xl border border-slate-800">
                {isFrench
                  ? 'Aucune demande de congé dans cette étape pour les 3 derniers jours.'
                  : 'No time-off requests in this stage over the last 3 days.'}
              </div>
            ) : (
              filteredRequests.map((req) => {
                const diag = getRequestStageDiagnosis(req, isFrench);
                const slots = req.coverageSlots || [];
                const canDecide =
                  canApproveTimeOff &&
                  req.status !== 'approved' &&
                  req.status !== 'rejected' &&
                  req.status !== 'cancelled';

                return (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{req.employeeName}</span>
                        <span className="text-[11px] font-mono text-slate-400">({req.id})</span>
                        {req.routeNo && (
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-teal-300">
                            {isFrench ? 'Circuit' : 'Route'} {req.routeNo}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-300">
                          {LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType} · {req.startDate}
                          {req.endDate !== req.startDate ? ` → ${req.endDate}` : ''}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${diag.stageColor}`}
                      >
                        {diag.stageBadge}
                      </span>
                    </div>

                    {/* Visual 4-Step Progress Bar */}
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      {[
                        { step: 1, label: isFrench ? '1. Soumis' : '1. Submitted' },
                        { step: 2, label: isFrench ? '2. Remplacement' : '2. Shift Cover' },
                        { step: 3, label: isFrench ? '3. Pré-approuvé' : '3. Pre-Approved' },
                        { step: 4, label: isFrench ? '4. Approuvé' : '4. Final Approved' },
                      ].map((s) => {
                        const active = diag.stageOrder >= s.step;
                        const current = diag.stageOrder === s.step;
                        return (
                          <div
                            key={s.step}
                            className={`px-2 py-1 rounded text-center font-semibold border ${
                              current
                                ? 'bg-teal-500/20 border-teal-500/60 text-teal-200'
                                : active
                                  ? 'bg-slate-900/90 border-slate-700 text-slate-300'
                                  : 'bg-slate-950/50 border-slate-800/80 text-slate-500'
                            }`}
                          >
                            {s.label}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className="text-xs text-slate-300 space-y-1">
                        <div>{diag.diagnosisText}</div>
                        {slots.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {slots.map((sl) => (
                              <span
                                key={sl.slotId}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                  sl.status === 'filled'
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                }`}
                              >
                                {sl.date} {sl.shiftType}:{' '}
                                {sl.status === 'filled'
                                  ? sl.coverDriverName || (isFrench ? 'Couvert' : 'Covered')
                                  : isFrench
                                    ? 'Ouvert (0 candidat)'
                                    : 'Open (No Applicant)'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {canApproveTimeOff && (
                          <button
                            type="button"
                            onClick={() => openTimeOffApproverAgent({ focusRequestId: req.id })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-teal-300 text-[10px] font-semibold cursor-pointer"
                            title={
                              isFrench
                                ? 'Examiner dans l’Agent IA Approbateur'
                                : 'Inspect in Approver AI Agent'
                            }
                          >
                            <Bot className="w-3 h-3" />
                            {isFrench ? 'Agent IA' : 'AI Desk'}
                          </button>
                        )}
                        {canDecide && (
                          <>
                            <button
                              type="button"
                              disabled={actingId === req.id}
                              onClick={() => void handleInlineDecision(req, 'approved')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              {isFrench ? 'Approuver' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              disabled={actingId === req.id}
                              onClick={() =>
                                void handleInlineDecision(
                                  req,
                                  req.status === 'on_hold' ? 'pending' : 'on_hold'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {req.status === 'on_hold'
                                ? isFrench
                                  ? 'Reprendre'
                                  : 'Release Hold'
                                : isFrench
                                  ? 'En attente'
                                  : 'Hold On'}
                            </button>
                            <button
                              type="button"
                              disabled={actingId === req.id}
                              onClick={() => void handleInlineDecision(req, 'rejected')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              {isFrench ? 'Refuser' : 'Reject'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: Region / Yard Coverage List */
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">
                {isFrench
                  ? 'Couverture des Congés & Remplacements par Région / Dépôt (Fenêtre 3 Jours)'
                  : 'Regional & Yard Time-Off Coverage Breakdown (3-Day Window)'}
              </h3>
              <p className="text-xs text-slate-400">
                {isFrench
                  ? 'Vue agrégée des demandes en attente, remplacements publiés sans candidat et pré-approbations 24h par dépôt'
                  : 'Aggregated view of pending requests, unclaimed shift broadcasts, and 24h pre-approvals by yard'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedYardFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  selectedYardFilter === 'all'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {isFrench ? ' toutes les régions' : 'All Regions'}
              </button>
              {(workbench?.yardRegions || []).map((yr) => (
                <button
                  key={yr.yardId}
                  type="button"
                  onClick={() => setSelectedYardFilter(yr.yardName)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    selectedYardFilter === yr.yardName
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {yr.yardName} ({yr.totalRequests})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(workbench?.yardRegions || [])
              .filter(
                (yr) => selectedYardFilter === 'all' || yr.yardName === selectedYardFilter
              )
              .map((yr) => (
                <div
                  key={yr.yardId}
                  className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
                      {yr.yardName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-200">
                      {yr.totalRequests} {isFrench ? 'demande(s)' : 'request(s)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-amber-300">
                        {isFrench ? 'Attente' : 'Pending'}
                      </div>
                      <div className="text-xs font-extrabold text-white">{yr.pendingCount}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-rose-300">
                        {isFrench ? 'Publié' : 'Broadcast'}
                      </div>
                      <div className="text-xs font-extrabold text-white">{yr.seekingCount}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-cyan-300">
                        {isFrench ? 'Pré-appr.' : 'Pre-Appr.'}
                      </div>
                      <div className="text-xs font-extrabold text-white">
                        {yr.preApprovedCount}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-emerald-300">
                        {isFrench ? 'Approuvé' : 'Approved'}
                      </div>
                      <div className="text-xs font-extrabold text-white">{yr.approvedCount}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-700/70">
                    <span>
                      {isFrench ? 'Quarts AM/PM couverts :' : 'Shift Slots Covered:'}{' '}
                      <strong className="text-emerald-400">{yr.filledSlots}</strong> /{' '}
                      {yr.totalSlots}
                    </span>
                    {yr.openSlots > 0 && (
                      <span className="text-rose-300 font-semibold">
                        {yr.openSlots} {isFrench ? 'quart(s) sans candidat' : 'open slot(s)'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <TimeOffWorkflowDemoModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
      />
    </section>
  );
};
