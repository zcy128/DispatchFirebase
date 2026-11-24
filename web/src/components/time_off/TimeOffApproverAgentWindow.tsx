import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  Film,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { TimeOffService } from '../../services/timeOffService';
import {
  LEAVE_TYPE_LABELS,
  TimeOffRequest,
  TimeOffWorkbenchResponse,
} from '../../types/timeOff';
import { canEditPage, normalizeRole } from '../../utils/permissions';
import { TimeOffWorkflowDemoModal } from './TimeOffWorkflowDemoModal';

const WORKBENCH_CHAT_STORAGE_KEY = 'time_off_manager_workbench_trail_v1';
const AGENT_WINDOW_OPEN_STORAGE_KEY = 'time_off_approver_agent_open_v1';
const AGENT_WINDOW_DOCK_STORAGE_KEY = 'time_off_approver_agent_dock_v1';

export interface OpenApproverAgentDetail {
  query?: string;
  focusRequestId?: string;
  toggle?: boolean;
}

export function openTimeOffApproverAgent(detail?: OpenApproverAgentDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<OpenApproverAgentDetail>('open-time-off-approver-agent', {
        detail: detail || {},
      })
    );
  }
}

export function notifyTimeOffRequestsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('time-off-requests-updated'));
  }
}

interface ManagerChatMessage {
  id: string;
  sender: 'manager' | 'assistant' | 'audit_trail';
  text: string;
  requests?: TimeOffRequest[];
  timestamp: string;
}

export function getRequestStageDiagnosis(
  req: TimeOffRequest,
  isFrench: boolean
): {
  stageOrder: number;
  stageBadge: string;
  stageColor: string;
  diagnosisText: string;
  isUnclaimedBroadcast: boolean;
} {
  const slots = req.coverageSlots || [];
  const totalSlots = slots.length;
  const filledSlots = slots.filter((s) => s.status === 'filled').length;

  if (req.status === 'approved') {
    return {
      stageOrder: 4,
      stageBadge: isFrench ? '4. Approuvé final' : '4. Final Approved',
      stageColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      diagnosisText: isFrench
        ? `Approuvé officiellement${req.approvedByName ? ' par ' + req.approvedByName : ''}. Remplaçant : ${req.coverageDriverName || 'Assigné'}.`
        : `Officially approved${req.approvedByName ? ' by ' + req.approvedByName : ''}. Substitute: ${req.coverageDriverName || 'Assigned'}.`,
      isUnclaimedBroadcast: false,
    };
  }

  if (req.status === 'rejected') {
    return {
      stageOrder: 4,
      stageBadge: isFrench ? 'Refusé' : 'Rejected',
      stageColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      diagnosisText: isFrench
        ? `Refusé${req.approvedByName ? ' par ' + req.approvedByName : ''}.`
        : `Rejected${req.approvedByName ? ' by ' + req.approvedByName : ''}.`,
      isUnclaimedBroadcast: false,
    };
  }

  if (req.status === 'on_hold') {
    return {
      stageOrder: 1,
      stageBadge: isFrench ? 'En attente (Hold On)' : 'On Hold (Paused)',
      stageColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      diagnosisText: isFrench
        ? `Mis en pause${req.holdByName ? ' par ' + req.holdByName : ''}. Aucune recherche auto de remplaçant ni approbation automatique.`
        : `Placed on hold${req.holdByName ? ' by ' + req.holdByName : ''}. Paused from auto-cover matching and auto-approval.`,
      isUnclaimedBroadcast: false,
    };
  }

  if (req.status === 'pre_approved') {
    return {
      stageOrder: 3,
      stageBadge: isFrench ? '3. Pré-approuvé (SLA 24h)' : '3. Pre-Approved (24h SLA)',
      stageColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      diagnosisText: isFrench
        ? `Tous les quarts sont couverts (${req.coverageDriverName || 'Confirmé'}). Validation finale auto sous 24h sauf intervention.`
        : `All shifts covered (${req.coverageDriverName || 'Confirmed'}). Auto-finalizes within 24h unless manually intervened.`,
      isUnclaimedBroadcast: false,
    };
  }

  if (req.status === 'awaiting_peer_confirm') {
    return {
      stageOrder: 2,
      stageBadge: isFrench
        ? '2. Attente confirmation remplaçant'
        : '2. Awaiting Substitute Confirmation',
      stageColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
      diagnosisText: isFrench
        ? `L'employé a désigné ${req.coverageDriverName || 'un chauffeur'}, en attente de son clic « Accepter le remplacement ».`
        : `Employee named ${req.coverageDriverName || 'a substitute driver'}; waiting for peer to click Accept Cover.`,
      isUnclaimedBroadcast: false,
    };
  }

  if (req.status === 'seeking_coverage') {
    const unclaimed = filledSlots === 0;
    return {
      stageOrder: 2,
      stageBadge: unclaimed
        ? isFrench
          ? '2. Remplacement publié · Aucun candidat'
          : '2. Broadcasted · No Applicants'
        : isFrench
          ? `2. Remplacement partiel (${filledSlots}/${totalSlots})`
          : `2. Partial Cover (${filledSlots}/${totalSlots} Shifts)`,
      stageColor: unclaimed
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      diagnosisText: unclaimed
        ? isFrench
          ? `Remplacement publié (${totalSlots || 2} quarts AM/PM), mais aucun chauffeur n'a encore postulé.`
          : `Shift cover broadcasted (${totalSlots || 2} AM/PM slots), but no driver has applied yet.`
        : isFrench
          ? `${filledSlots}/${totalSlots} quarts couverts. En attente d'un chauffeur pour le quart restant.`
          : `${filledSlots}/${totalSlots} shifts claimed. Waiting for a driver on the remaining shift.`,
      isUnclaimedBroadcast: unclaimed,
    };
  }

  const noCoverYet = !req.coverageAssigned && !req.coverageDriverName;
  return {
    stageOrder: 1,
    stageBadge: noCoverYet
      ? isFrench
        ? '1. Soumis · Sans remplaçant'
        : '1. Submitted · No Substitute Yet'
      : isFrench
        ? '1. Soumis · En attente RH'
        : '1. Submitted · Pending HR Review',
    stageColor: noCoverYet
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    diagnosisText: noCoverYet
      ? isFrench
        ? `Demande soumise sans remplaçant confirmé. Nécessite un remplacement ou une décision RH.`
        : `Request submitted without a confirmed substitute driver. Requires shift cover or manual HR decision.`
      : isFrench
        ? `Remplaçant assigné (${req.coverageDriverName}). Prêt pour validation RH.`
        : `Substitute assigned (${req.coverageDriverName}). Ready for HR approval decision.`,
    isUnclaimedBroadcast: noCoverYet,
  };
}

interface TimeOffApproverAgentWindowProps {
  currentTab?: string;
  onNavigateToTimeOff?: () => void;
}

export const TimeOffApproverAgentWindow: React.FC<TimeOffApproverAgentWindowProps> = ({
  currentTab,
  onNavigateToTimeOff,
}) => {
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();

  const canApproveTimeOff = useMemo(() => {
    const role = normalizeRole(currentUser?.role);
    if (role === 'admin' || role === 'HR') return true;
    return canEditPage(currentUser, 'time_off');
  }, [currentUser]);

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AGENT_WINDOW_OPEN_STORAGE_KEY);
      if (saved !== null) return saved === '1';
    } catch {
      // ignore storage errors
    }
    return false;
  });

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isDemoOpen, setIsDemoOpen] = useState<boolean>(false);
  const [dockSide, setDockSide] = useState<'left' | 'right'>(() => {
    try {
      const saved = localStorage.getItem(AGENT_WINDOW_DOCK_STORAGE_KEY);
      if (saved === 'left' || saved === 'right') return saved;
    } catch {
      // ignore
    }
    return 'left';
  });

  const [workbench, setWorkbench] = useState<TimeOffWorkbenchResponse | null>(null);
  const [loadingWb, setLoadingWb] = useState<boolean>(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [latestToastText, setLatestToastText] = useState<string | null>(null);

  const [managerMessages, setManagerMessages] = useState<ManagerChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(WORKBENCH_CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [managerInput, setManagerInput] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSyncDoneRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(AGENT_WINDOW_OPEN_STORAGE_KEY, isOpen ? '1' : '0');
    } catch {
      // ignore
    }
    if (isOpen) {
      setUnreadCount(0);
      setLatestToastText(null);
    }
  }, [isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(AGENT_WINDOW_DOCK_STORAGE_KEY, dockSide);
    } catch {
      // ignore
    }
  }, [dockSide]);

  useEffect(() => {
    try {
      if (managerMessages.length > 0) {
        localStorage.setItem(
          WORKBENCH_CHAT_STORAGE_KEY,
          JSON.stringify(managerMessages.slice(-60))
        );
      }
    } catch {
      // ignore
    }
  }, [managerMessages]);

  const loadWorkbench = useCallback(
    async (silent = false) => {
      if (!canApproveTimeOff) return;
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
    },
    [canApproveTimeOff]
  );

  useEffect(() => {
    if (!canApproveTimeOff) return;
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
  }, [canApproveTimeOff, loadWorkbench]);

  const activeClaims = useMemo(() => workbench?.activeClaims || [], [workbench]);

  const claimsById = useMemo(() => {
    const map = new Map<string, TimeOffRequest>();
    for (const c of activeClaims) {
      map.set(c.id, c);
    }
    return map;
  }, [activeClaims]);

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

  // Sync live badge counts with the Sidebar Approver AI Agent button
  useEffect(() => {
    if (!canApproveTimeOff || typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('approver-agent-badge-update', {
        detail: {
          activeCount: stageStats.totalActive,
          unreadCount,
          isOpen,
        },
      })
    );
  }, [canApproveTimeOff, stageStats.totalActive, unreadCount, isOpen]);

  // Update only the top briefing message in-place without wiping conversation & approval audit history
  useEffect(() => {
    if (!canApproveTimeOff) return;
    const briefingText = isFrench
      ? `📊 **Synthèse Agent Approbateur (3 derniers jours)**\n• **${activeClaims.length}** demande(s) suivie(s) :\n  - 🔴 **${stageStats.unclaimedBroadcast}** remplacement(s) publié(s) sans candidat (ou sans remplaçant)\n  - ⏳ **${stageStats.awaitingPeer}** en attente de confirmation du collègue désigné\n  - 💠 **${stageStats.preApproved}** Pré-approuvée(s) (validation auto sous 24h)\n  - 📋 **${stageStats.manualPending}** en attente de révision manuelle RH`
      : `📊 **Approver AI Agent Briefing (Last 3 Days)**\n• **${activeClaims.length}** request(s) tracked:\n  - 🔴 **${stageStats.unclaimedBroadcast}** broadcasted shift cover with no applicants yet (or unassigned)\n  - ⏳ **${stageStats.awaitingPeer}** awaiting named substitute peer confirmation\n  - 💠 **${stageStats.preApproved}** Pre-Approved (within 24h auto-finalize window)\n  - 📋 **${stageStats.manualPending}** awaiting manual HR review`;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setManagerMessages((prev) => {
      const briefingMsg: ManagerChatMessage = {
        id: 'briefing-init',
        sender: 'assistant',
        text: briefingText,
        timestamp: prev[0]?.id === 'briefing-init' ? prev[0].timestamp : nowTime,
      };
      if (prev.length === 0) {
        return [briefingMsg];
      }
      if (prev[0].id === 'briefing-init') {
        return [briefingMsg, ...prev.slice(1)];
      }
      return [briefingMsg, ...prev];
    });
  }, [
    canApproveTimeOff,
    activeClaims.length,
    stageStats.unclaimedBroadcast,
    stageStats.awaitingPeer,
    stageStats.preApproved,
    stageStats.manualPending,
    isFrench,
  ]);

  // Stream real-time lifecycle events into the Approver AI Agent window:
  // 1) Employee submitted a time-off request in Driver App
  // 2) Substitute driver agreed to cover -> status changed to Pre-Approved (or partial slot claimed)
  // 3) Approver approved/rejected the request (Work Trajectory)
  useEffect(() => {
    if (!canApproveTimeOff) return;
    if (activeClaims.length === 0 && (!workbench?.events || workbench.events.length === 0)) {
      return;
    }

    const chronologicalClaims = [...activeClaims].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    setManagerMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const added: ManagerChatMessage[] = [];

      for (const req of chronologicalClaims) {
        const dateSpan =
          req.startDate === req.endDate ? req.startDate : `${req.startDate} → ${req.endDate}`;
        const leaveLabel = LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType;
        const routePart = req.routeNo
          ? isFrench
            ? ` · Circuit ${req.routeNo}`
            : ` · Route ${req.routeNo}`
          : '';

        // 1. Submission event
        const subMsgId = `event-submitted-${req.id}`;
        if (!existingIds.has(subMsgId)) {
          const subTime = req.createdAt
            ? new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const subText = isFrench
            ? `📥 **[Nouvelle demande · ${subTime}]** **${req.employeeName}** a soumis une demande de congé (\`${req.id}\` · ${leaveLabel} · ${dateSpan}${routePart}).`
            : `📥 **[New Time-Off Request · ${subTime}]** **${req.employeeName}** submitted a time-off request (\`${req.id}\` · ${leaveLabel} · ${dateSpan}${routePart}).`;

          existingIds.add(subMsgId);
          added.push({
            id: subMsgId,
            sender: 'assistant',
            text: subText,
            requests: [req],
            timestamp: subTime,
          });
        }

        // 2. Status changed to Pre-Approved (substitute driver agreed to cover shifts)
        const isPreApprovedOrHadPreApproval =
          req.status === 'pre_approved' || Boolean(req.preApprovedAt);
        const preMsgId = `event-preapproved-${req.id}`;
        if (isPreApprovedOrHadPreApproval && !existingIds.has(preMsgId)) {
          const preTs =
            req.preApprovedAt || req.coverageAssignedAt || req.updatedAt || req.createdAt;
          const preTime = preTs
            ? new Date(preTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const coverDriver =
            req.coverageDriverName ||
            (isFrench ? 'Chauffeur remplaçant confirmé' : 'Confirmed Substitute Driver');

          const preText = isFrench
            ? `🔄 **[Statut modifié → Pré-approuvé · ${preTime}]** Le statut de la demande de **${req.employeeName}** (\`${req.id}\` · ${dateSpan}${routePart}) a changé : **${coverDriver}** a accepté le remplacement. La demande est maintenant **Pré-approuvée** (validation auto sous 24h).`
            : `🔄 **[Request Status Changed → Pre-Approved · ${preTime}]** **${req.employeeName}**'s time-off request (\`${req.id}\` · ${dateSpan}${routePart}) status has changed: **${coverDriver}** agreed to cover the shift(s). Status is now **Pre-Approved** (24h auto-approval SLA active).`;

          existingIds.add(preMsgId);
          added.push({
            id: preMsgId,
            sender: 'assistant',
            text: preText,
            requests: [req],
            timestamp: preTime,
          });
        }

        // 3. Final Approved / Rejected work trajectory
        if (req.status === 'approved' || req.status === 'rejected') {
          const hasAuditForReq = Array.from(existingIds).some((id) =>
            id.startsWith(`audit-${req.id}-`)
          );
          if (!hasAuditForReq) {
            const reviewerName =
              req.approvedByName || (isFrench ? 'Responsable RH' : 'HR Approver');
            const tsSource = req.approvedAt || req.updatedAt || req.createdAt;
            const formattedTime = tsSource
              ? new Date(tsSource).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const auditText =
              req.status === 'approved'
                ? isFrench
                  ? `✅ **[Traçabilité · ${formattedTime}]** **${reviewerName}** a approuvé la demande de congé de **${req.employeeName}** (\`${req.id}\` · ${leaveLabel} · ${dateSpan}${routePart}).`
                  : `✅ **[Work Trajectory · ${formattedTime}]** **${reviewerName}** approved **${req.employeeName}**'s time-off request (\`${req.id}\` · ${leaveLabel} · ${dateSpan}${routePart}).`
                : isFrench
                  ? `❌ **[Traçabilité · ${formattedTime}]** **${reviewerName}** a refusé la demande de congé de **${req.employeeName}** (\`${req.id}\` · ${leaveLabel} · ${dateSpan}).`
                  : `❌ **[Work Trajectory · ${formattedTime}]** **${reviewerName}** rejected **${req.employeeName}**'s time-off request (\`${req.id}\` · ${leaveLabel} · ${dateSpan}).`;

            const auditId = `audit-${req.id}-synced`;
            existingIds.add(auditId);
            added.push({
              id: auditId,
              sender: 'audit_trail',
              text: auditText,
              timestamp: formattedTime,
            });
          }
        }
      }

      // 4. Intermediate shift-claim / peer-response events from workbench.events
      const wbEvents = [...(workbench?.events || [])].reverse();
      for (const ev of wbEvents) {
        if (ev.eventType !== 'slot_claimed' && ev.eventType !== 'peer_declined') {
          continue;
        }
        const evMsgId = `event-wb-${ev.id}`;
        if (existingIds.has(evMsgId)) continue;

        const evTime = ev.createdAt
          ? new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const evText = isFrench
          ? `🔄 **[Mise à jour du remplacement · ${evTime}]** ${ev.title} — ${ev.summary}`
          : `🔄 **[Shift Cover Status Update · ${evTime}]** ${ev.title} — ${ev.summary}`;

        existingIds.add(evMsgId);
        added.push({
          id: evMsgId,
          sender: 'assistant',
          text: evText,
          requests: ev.request ? [ev.request] : undefined,
          timestamp: evTime,
        });
      }

      if (added.length === 0) {
        initialSyncDoneRef.current = true;
        return prev;
      }

      if (initialSyncDoneRef.current && !isOpen) {
        setUnreadCount((c) => c + added.length);
        const latest = added[added.length - 1];
        setLatestToastText(latest.text.replace(/\*\*/g, ''));
      }
      initialSyncDoneRef.current = true;
      return [...prev, ...added];
    });
  }, [canApproveTimeOff, activeClaims, workbench?.events, isFrench, isOpen]);

  const handleManagerQuery = useCallback(
    (rawQuery?: string, focusRequestId?: string) => {
      if (focusRequestId) {
        const target = activeClaims.find((r) => r.id === focusRequestId);
        if (target) {
          const nowTime = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const focusReply = isFrench
            ? `🎯 Examen de la demande **${target.id}** de **${target.employeeName}** :`
            : `🎯 Focused inspection for **${target.employeeName}**'s time-off request (**${target.id}**):`;
          setManagerMessages((prev) => [
            ...prev,
            {
              id: `mgr-focus-${Date.now()}`,
              sender: 'assistant',
              text: focusReply,
              requests: [target],
              timestamp: nowTime,
            },
          ]);
          return;
        }
      }

      const q = (rawQuery !== undefined ? rawQuery : managerInput).trim();
      if (!q) return;
      if (rawQuery === undefined) {
        setManagerInput('');
      }
      const lower = q.toLowerCase();
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let matched: TimeOffRequest[] = [];
      let replyText = '';

      if (
        lower.includes('unclaimed') ||
        lower.includes('no applicant') ||
        lower.includes('broadcast') ||
        lower.includes('seeking') ||
        lower.includes('sans candidat') ||
        lower.includes('publié')
      ) {
        matched = activeClaims.filter((r) => {
          const d = getRequestStageDiagnosis(r, isFrench);
          return (
            (r.status === 'seeking_coverage' || d.isUnclaimedBroadcast) &&
            r.status !== 'approved' &&
            r.status !== 'rejected' &&
            r.status !== 'cancelled'
          );
        });
        replyText = isFrench
          ? `🔍 **${matched.length} demande(s)** ont un remplacement publié sans candidat (ou aucun remplaçant assigné) :`
          : `🔍 Found **${matched.length} request(s)** where shift cover was broadcasted/requested but no driver has claimed all shifts yet:`;
      } else if (
        lower.includes('pre-approved') ||
        lower.includes('pre_approved') ||
        lower.includes('24h') ||
        lower.includes('pré-approuvé')
      ) {
        matched = activeClaims.filter((r) => r.status === 'pre_approved');
        replyText = isFrench
          ? `💠 **${matched.length} demande(s)** sont actuellement **Pré-approuvées** (tous les remplacements sont verrouillés, validation auto sous 24h) :`
          : `💠 Found **${matched.length} Pre-Approved request(s)** (all shift covers locked; counting down 24h to auto-approval):`;
      } else if (
        lower.includes('peer') ||
        lower.includes('collègue') ||
        lower.includes('awaiting')
      ) {
        matched = activeClaims.filter((r) => r.status === 'awaiting_peer_confirm');
        replyText = isFrench
          ? `⏳ **${matched.length} demande(s)** attendent la confirmation du chauffeur remplaçant désigné :`
          : `⏳ Found **${matched.length} request(s)** waiting for the named substitute driver to accept cover:`;
      } else if (
        lower.includes('manual') ||
        lower.includes('pending') ||
        lower.includes('révision')
      ) {
        matched = activeClaims.filter((r) => r.status === 'pending');
        replyText = isFrench
          ? `📋 **${matched.length} demande(s)** sont en attente de révision manuelle RH :`
          : `📋 Found **${matched.length} request(s)** awaiting manual HR review:`;
      } else {
        matched = activeClaims.slice(0, 8);
        replyText = isFrench
          ? `📋 Voici l'état d'avancement des **${matched.length}** dernières demandes de congé :`
          : `📋 Here is the current pipeline stage breakdown for the latest **${matched.length}** time-off request(s):`;
      }

      setManagerMessages((prev) => [
        ...prev,
        {
          id: `mgr-q-${Date.now()}`,
          sender: 'manager',
          text: q,
          timestamp: nowTime,
        },
        {
          id: `mgr-a-${Date.now() + 1}`,
          sender: 'assistant',
          text: replyText,
          requests: matched,
          timestamp: nowTime,
        },
      ]);
    },
    [activeClaims, isFrench, managerInput]
  );

  // Listen for external triggers to open or toggle the Approver AI Agent window
  useEffect(() => {
    if (!canApproveTimeOff) return;
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent<OpenApproverAgentDetail>;
      const hasFocusTarget = Boolean(
        customEv.detail?.query || customEv.detail?.focusRequestId
      );
      if (customEv.detail?.toggle || !hasFocusTarget) {
        setIsOpen((prev) => !prev);
      } else {
        setIsOpen(true);
      }
      setUnreadCount(0);
      setLatestToastText(null);
      if (hasFocusTarget) {
        handleManagerQuery(customEv.detail.query, customEv.detail.focusRequestId);
      }
    };
    window.addEventListener('open-time-off-approver-agent', handler);
    return () => window.removeEventListener('open-time-off-approver-agent', handler);
  }, [canApproveTimeOff, handleManagerQuery]);

  // Auto-scroll to bottom when new messages arrive while open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [managerMessages.length, isOpen]);

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
            ? 'Approved via Time-Off Approver AI Agent'
            : decision === 'rejected'
              ? 'Rejected via Time-Off Approver AI Agent'
              : decision === 'on_hold'
                ? 'Placed on hold via Time-Off Approver AI Agent'
                : 'Released from hold via Time-Off Approver AI Agent',
      };
      let updatedReq: TimeOffRequest;
      if (decision === 'approved') {
        updatedReq = await TimeOffService.approveTimeOffRequest(req.id, payload);
      } else if (decision === 'rejected') {
        updatedReq = await TimeOffService.rejectTimeOffRequest(req.id, payload);
      } else if (decision === 'on_hold') {
        updatedReq = await TimeOffService.holdTimeOffRequest(req.id, payload);
      } else {
        updatedReq = await TimeOffService.resumeTimeOffRequest(req.id, payload);
      }

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateSpan =
        req.startDate === req.endDate ? req.startDate : `${req.startDate} → ${req.endDate}`;
      const leaveLabel = LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType;
      const auditText =
        decision === 'approved'
          ? isFrench
            ? `✅ **[Traçabilité · ${nowTime}]** **${reviewerName}** a approuvé la demande de congé de **${req.employeeName}** (\`${req.id}\` · ${leaveLabel} · ${dateSpan}${req.routeNo ? ' · Circuit ' + req.routeNo : ''}).`
            : `✅ **[Work Trajectory · ${nowTime}]** **${reviewerName}** approved **${req.employeeName}**'s time-off request (\`${req.id}\` · ${leaveLabel} · ${dateSpan}${req.routeNo ? ' · Route ' + req.routeNo : ''}).`
          : decision === 'rejected'
            ? isFrench
              ? `❌ **[Traçabilité · ${nowTime}]** **${reviewerName}** a refusé la demande de congé de **${req.employeeName}** (\`${req.id}\` · ${leaveLabel} · ${dateSpan}).`
              : `❌ **[Work Trajectory · ${nowTime}]** **${reviewerName}** rejected **${req.employeeName}**'s time-off request (\`${req.id}\` · ${leaveLabel} · ${dateSpan}).`
            : decision === 'on_hold'
              ? isFrench
                ? `⏸️ **[Traçabilité · ${nowTime}]** **${reviewerName}** a mis en attente (Hold On) la demande de **${req.employeeName}** (\`${req.id}\`).`
                : `⏸️ **[Work Trajectory · ${nowTime}]** **${reviewerName}** placed **${req.employeeName}**'s request (\`${req.id}\`) **On Hold** (auto-cover & auto-approval paused).`
              : isFrench
                ? `▶️ **[Traçabilité · ${nowTime}]** **${reviewerName}** a levé la suspension de la demande de **${req.employeeName}** (\`${req.id}\`).`
                : `▶️ **[Work Trajectory · ${nowTime}]** **${reviewerName}** released **${req.employeeName}**'s request (\`${req.id}\`) from Hold.`;

      // Update any existing cards in chat messages in-place AND append the new audit trail entry
      setManagerMessages((prev) => {
        const updatedList = prev.map((msg) => {
          if (!msg.requests) return msg;
          return {
            ...msg,
            requests: msg.requests.map((item) =>
              item.id === req.id
                ? {
                    ...item,
                    ...updatedReq,
                    status: decision,
                    approvedByName: reviewerName,
                  }
                : item
            ),
          };
        });
        return [
          ...updatedList,
          {
            id: `audit-${req.id}-${Date.now()}`,
            sender: 'audit_trail',
            text: auditText,
            timestamp: nowTime,
          },
        ];
      });

      await loadWorkbench(true);
      notifyTimeOffRequestsUpdated();
    } finally {
      setActingId(null);
    }
  };

  if (!canApproveTimeOff) {
    return null;
  }

  const positionClass =
    dockSide === 'left'
      ? 'left-4 sm:left-6'
      : 'right-4 sm:right-6';

  if (!isOpen) {
    if (!latestToastText) return null;
    return (
      <div className={`fixed bottom-5 ${positionClass} z-40 flex flex-col items-start gap-2`}>
        <div className="max-w-xs sm:max-w-sm p-3 rounded-xl bg-slate-900/95 border border-teal-500/50 shadow-2xl text-xs text-slate-100 flex items-start gap-2.5 backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 space-y-1.5">
            <div className="font-bold text-teal-300 text-[11px]">
              {isFrench ? 'Nouvel événement Congés / Remplacement' : 'New Time-Off / Cover Event'}
            </div>
            <div className="text-slate-200 line-clamp-2">{latestToastText}</div>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 hover:text-teal-200 cursor-pointer"
            >
              {isFrench ? 'Ouvrir l’Agent Approbateur →' : 'Open Approver AI Agent →'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLatestToastText(null)}
            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside
      aria-label="Time-Off Approver AI Agent Window"
      className={`fixed bottom-4 ${positionClass} z-50 flex flex-col bg-slate-900/98 border border-teal-500/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl transition-all ${
        isMaximized
          ? 'w-[860px] max-w-[95vw] h-[82vh]'
          : 'w-[450px] sm:w-[500px] max-w-[95vw] h-[640px] max-h-[85vh]'
      }`}
    >
      {/* Window Title Bar */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/40 flex items-center justify-center text-teal-300 shrink-0">
            <Bot className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                {isFrench
                  ? 'Agent IA Approbateur de Congés'
                  : 'Time-Off Approver AI Agent'}
              </h2>
              <span className="px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/30 text-[10px] font-bold text-teal-300 shrink-0">
                {isFrench ? 'Direct 3J' : '3-Day Live'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {isFrench
                ? 'Flux en direct des demandes, remplacements AM/PM, pré-approbations 24h & traçabilité'
                : 'Live submissions, AM/PM cover broadcasts, 24h pre-approvals & work trajectory'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsDemoOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-[10px] font-semibold text-indigo-200 cursor-pointer mr-1"
            title={isFrench ? 'Démo animée du flux' : 'Animated Workflow Demo'}
          >
            <Film className="w-3 h-3" />
            <span className="hidden sm:inline">{isFrench ? 'Démo' : 'Demo'}</span>
          </button>
          {currentTab !== 'time_off' && onNavigateToTimeOff && (
            <button
              type="button"
              onClick={onNavigateToTimeOff}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-semibold text-teal-300 cursor-pointer mr-1"
              title={isFrench ? 'Aller à la page Congés' : 'Open Time-Off Page'}
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">{isFrench ? 'Page Congés' : 'Time-Off Page'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadWorkbench(false)}
            disabled={loadingWb}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title={isFrench ? 'Actualiser' : 'Refresh'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingWb ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setDockSide((prev) => (prev === 'left' ? 'right' : 'left'))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title={
              dockSide === 'left'
                ? isFrench
                  ? 'Ancrer à droite'
                  : 'Dock to Right'
                : isFrench
                  ? 'Ancrer à gauche'
                  : 'Dock to Left'
            }
          >
            {dockSide === 'left' ? (
              <PanelRight className="w-3.5 h-3.5" />
            ) : (
              <PanelLeft className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsMaximized((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title={isMaximized ? (isFrench ? 'Réduire' : 'Restore size') : (isFrench ? 'Agrandir' : 'Maximize')}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title={isFrench ? 'Minimiser la fenêtre' : 'Minimize Agent Window'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick 4-Stage Summary Strip */}
      <div className="px-3 py-2 bg-slate-950/50 border-b border-slate-800 grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={() =>
            handleManagerQuery(
              isFrench
                ? 'Remplacements publiés sans candidat'
                : 'Broadcasted shifts with no applicants'
            )
          }
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-rose-500/30 text-left cursor-pointer"
        >
          <div className="text-[10px] text-rose-300 font-semibold truncate">
            {isFrench ? '🔴 Sans candidat' : '🔴 No Applicant'}
          </div>
          <div className="text-sm font-extrabold text-white">{stageStats.unclaimedBroadcast}</div>
        </button>
        <button
          type="button"
          onClick={() =>
            handleManagerQuery(
              isFrench ? 'En attente de confirmation collègue' : 'Awaiting peer confirmation'
            )
          }
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-violet-500/30 text-left cursor-pointer"
        >
          <div className="text-[10px] text-violet-300 font-semibold truncate">
            {isFrench ? '⏳ Attente collègue' : '⏳ Awaiting Peer'}
          </div>
          <div className="text-sm font-extrabold text-white">{stageStats.awaitingPeer}</div>
        </button>
        <button
          type="button"
          onClick={() =>
            handleManagerQuery(
              isFrench ? 'Demandes Pré-approuvées (24h)' : 'Pre-Approved requests (24h SLA)'
            )
          }
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-left cursor-pointer"
        >
          <div className="text-[10px] text-cyan-300 font-semibold truncate">
            {isFrench ? '💠 Pré-approuvé' : '💠 Pre-Approved'}
          </div>
          <div className="text-sm font-extrabold text-white">{stageStats.preApproved}</div>
        </button>
        <button
          type="button"
          onClick={() =>
            handleManagerQuery(isFrench ? 'En attente de révision manuelle' : 'Manual pending review')
          }
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/30 text-left cursor-pointer"
        >
          <div className="text-[10px] text-amber-300 font-semibold truncate">
            {isFrench ? '📋 Révision RH' : '📋 HR Pending'}
          </div>
          <div className="text-sm font-extrabold text-white">{stageStats.manualPending}</div>
        </button>
      </div>

      {/* Chat & Live Work Trajectory Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {managerMessages.map((m) => {
          const isMgr = m.sender === 'manager';
          const isAudit = m.sender === 'audit_trail';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMgr ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[95%] rounded-xl px-3.5 py-2.5 text-xs space-y-2 ${
                  isMgr
                    ? 'bg-teal-600 text-white'
                    : isAudit
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-100'
                      : 'bg-slate-800/95 border border-slate-700 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

                {m.requests && m.requests.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {m.requests.slice(0, 8).map((rawReq) => {
                      const r = claimsById.get(rawReq.id) || rawReq;
                      const d = getRequestStageDiagnosis(r, isFrench);
                      const slots = r.coverageSlots || [];
                      return (
                        <div
                          key={r.id}
                          className={`p-2.5 rounded-xl border space-y-1.5 text-[11px] ${
                            r.status === 'approved'
                              ? 'bg-emerald-950/40 border-emerald-500/40'
                              : r.status === 'rejected'
                                ? 'bg-rose-950/40 border-rose-500/40'
                                : 'bg-slate-900/95 border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-bold text-white">
                              {r.employeeName} · {r.routeNo || 'Route'} ({r.startDate}
                              {r.endDate !== r.startDate ? ` → ${r.endDate}` : ''})
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${d.stageColor}`}
                            >
                              {d.stageBadge}
                            </span>
                          </div>

                          <div className="text-slate-300">{d.diagnosisText}</div>

                          {slots.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {slots.map((sl) => (
                                <span
                                  key={sl.slotId}
                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                    sl.status === 'filled'
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                      : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                  }`}
                                >
                                  {sl.date} {sl.shiftType}:{' '}
                                  {sl.status === 'filled'
                                    ? sl.coverDriverName || (isFrench ? 'Couvert' : 'Covered')
                                    : isFrench
                                      ? 'Ouvert'
                                      : 'Open'}
                                </span>
                              ))}
                            </div>
                          )}

                          {canApproveTimeOff &&
                            r.status !== 'approved' &&
                            r.status !== 'rejected' &&
                            r.status !== 'cancelled' && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => void handleInlineDecision(r, 'approved')}
                                  disabled={actingId === r.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                  {isFrench ? 'Approuver' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleInlineDecision(
                                      r,
                                      r.status === 'on_hold' ? 'pending' : 'on_hold'
                                    )
                                  }
                                  disabled={actingId === r.id}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white font-semibold text-[10px] cursor-pointer disabled:opacity-50"
                                >
                                  {r.status === 'on_hold'
                                    ? isFrench
                                      ? 'Reprendre'
                                      : 'Release Hold'
                                    : isFrench
                                      ? 'En attente'
                                      : 'Hold On'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleInlineDecision(r, 'rejected')}
                                  disabled={actingId === r.id}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px] cursor-pointer disabled:opacity-50"
                                >
                                  {isFrench ? 'Refuser' : 'Reject'}
                                </button>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Inquiry Chips & Natural Language Input */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(isFrench
            ? [
                'Remplacements publiés sans candidat',
                'Demandes Pré-approuvées (24h)',
                'En attente de confirmation collègue',
                'Résumé de toutes les étapes',
              ]
            : [
                'Broadcasted shifts with no applicants',
                'Pre-Approved requests (24h SLA)',
                'Awaiting peer confirmation',
                'Show all request stages',
              ]
          ).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleManagerQuery(q)}
              className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleManagerQuery();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={managerInput}
            onChange={(e) => setManagerInput(e.target.value)}
            placeholder={
              isFrench
                ? 'Interroger l’Agent Approbateur (ex. remplacements sans candidat)...'
                : 'Ask Approver AI Agent (e.g. Broadcasted shifts with no applicants)...'
            }
            className="flex-1 px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!managerInput.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </form>
      </div>
      <TimeOffWorkflowDemoModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
      />
    </aside>
  );
};
