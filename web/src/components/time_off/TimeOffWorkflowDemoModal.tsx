import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

interface TimeOffWorkflowDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScenarioId = 'named_peer' | 'auto_broadcast' | 'manual_handling';

interface ChatBubble {
  sender: 'driver' | 'ai' | 'peer' | 'system';
  text: string;
  badge?: string;
  highlight?: 'warning' | 'success' | 'info';
}

interface AgentFeedItem {
  type: 'submitted' | 'status_change' | 'audit' | 'manual_action';
  title: string;
  detail: string;
  badge: string;
}

interface DemoStep {
  title: string;
  subtitle: string;
  stageIndex: 1 | 2 | 3 | 4;
  stageLabel: string;
  statusColor: string;
  driverBubbles: ChatBubble[];
  agentFeed: AgentFeedItem[];
  slots?: Array<{ label: string; assignee: string; filled: boolean }>;
}

interface DemoScenario {
  id: ScenarioId;
  tabLabel: string;
  summary: string;
  steps: DemoStep[];
}

function buildScenarios(isFrench: boolean): DemoScenario[] {
  if (isFrench) {
    return [
      {
        id: 'named_peer',
        tabLabel: '1. Remplaçant trouvé (Vérif. conflit)',
        summary:
          'Le chauffeur désigne un collègue. L’IA détecte un conflit sur driver22, valide driver41, envoie la demande au pair, puis passe en Pré-approuvé et Approuvé.',
        steps: [
          {
            title: 'Étape 1 · Demande conversationnelle (Driver App)',
            subtitle: 'L’employé demande congé demain ; l’IA détecte ses circuits AM & PM.',
            stageIndex: 1,
            stageLabel: '1. Brouillon & Vérif. circuit',
            statusColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
            driverBubbles: [
              { sender: 'driver', text: 'Je veux prendre congé demain.' },
              {
                sender: 'ai',
                text: 'Vos circuits demain sont ODSOE-001 (AM & PM). Quel type de congé (Personnel/Maladie) et avez-vous un remplaçant ?',
                badge: 'Détection horaire',
                highlight: 'info',
              },
              { sender: 'driver', text: 'Congé personnel, remplaçant : driver22.' },
            ],
            agentFeed: [
              {
                type: 'submitted',
                title: 'En attente de soumission',
                detail: 'Le chauffeur finalise les détails dans Company Office Chat...',
                badge: 'Brouillon',
              },
            ],
          },
          {
            title: 'Étape 2 · Détection de conflit & Correction',
            subtitle: 'L’IA bloque driver22 (déjà sur ODSOE-007) et valide driver41.',
            stageIndex: 1,
            stageLabel: '1. Vérification conflits & CDL',
            statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            driverBubbles: [
              {
                sender: 'ai',
                text: 'Conflit détecté : Driver22 Doe est déjà affecté au circuit ODSOE-007 (AM & PM) demain.',
                badge: 'Conflit horaire',
                highlight: 'warning',
              },
              { sender: 'driver', text: 'Désolé, je voulais dire driver41.' },
              {
                sender: 'ai',
                text: 'Driver41 Doe est libre demain et possède un permis CDL valide. Aperçu prêt — veuillez confirmer l’envoi.',
                badge: 'Aucun conflit',
                highlight: 'success',
              },
            ],
            agentFeed: [
              {
                type: 'submitted',
                title: 'Pré-validation en cours',
                detail: 'Driver41 Doe vérifié (CDL valide, 0 conflit AM/PM).',
                badge: 'Prêt',
              },
            ],
          },
          {
            title: 'Étape 3 · Demande soumise & Notification pair (Option B)',
            subtitle: 'La demande passe en attente de confirmation du pair ; l’Agent Web est alerté.',
            stageIndex: 2,
            stageLabel: '2. Attente confirmation pair',
            statusColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
            driverBubbles: [
              {
                sender: 'system',
                text: 'Aperçu confirmé · Demande #TOR-2041 soumise. Demande de remplacement envoyée à Driver41 Doe.',
                badge: 'Option B · Pair',
                highlight: 'info',
              },
              {
                sender: 'peer',
                text: 'Notification sur l’app de Driver41 : « Couvrir ODSOE-001 AM & PM demain ? [Accepter] [Refuser] »',
                badge: 'En attente',
              },
            ],
            agentFeed: [
              {
                type: 'submitted',
                title: '📥 Nouvelle demande de congé',
                detail: 'Sarah Connor a soumis une demande (ODSOE-001 · Congé personnel). En attente de Driver41 Doe.',
                badge: 'Attente pair',
              },
            ],
          },
          {
            title: 'Étape 4 · Le collègue accepte → Pré-approuvé (SLA 24h)',
            subtitle: 'Driver41 accepte ; le remplacement est verrouillé et le statut passe à Pré-approuvé.',
            stageIndex: 3,
            stageLabel: '3. Pré-approuvé (SLA 24h)',
            statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
            driverBubbles: [
              {
                sender: 'peer',
                text: 'Driver41 Doe a cliqué sur « Accepter le remplacement » ! Affectation temporaire pré-verrouillée.',
                badge: 'Accepté',
                highlight: 'success',
              },
              {
                sender: 'ai',
                text: 'Pré-approuvé ! Confirmation finale dans les 24h (ou 2h avant le départ) sauf intervention RH.',
                badge: 'Pré-approuvé',
                highlight: 'success',
              },
            ],
            agentFeed: [
              {
                type: 'submitted',
                title: '📥 Nouvelle demande de congé',
                detail: 'Sarah Connor · ODSOE-001 · Demain',
                badge: 'Reçue',
              },
              {
                type: 'status_change',
                title: '🔄 Statut modifié → Pré-approuvé',
                detail: 'Driver41 Doe a accepté le remplacement. SLA auto 24h actif.',
                badge: 'Pré-approuvé',
              },
            ],
            slots: [
              { label: 'AM (07:00)', assignee: 'Driver41 Doe', filled: true },
              { label: 'PM (14:30)', assignee: 'Driver41 Doe', filled: true },
            ],
          },
          {
            title: 'Étape 5 · Validation RH & Traçabilité permanente',
            subtitle: 'Le responsable clique sur Approuver dans l’Agent IA ; la trace est enregistrée.',
            stageIndex: 4,
            stageLabel: '4. Approuvé final',
            statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            driverBubbles: [
              {
                sender: 'system',
                text: '✅ Officiellement approuvé par Alex (RH). Votre congé sur ODSOE-001 est confirmé (Remplaçant : Driver41 Doe).',
                badge: 'Approuvé',
                highlight: 'success',
              },
            ],
            agentFeed: [
              {
                type: 'status_change',
                title: '🔄 Statut modifié → Pré-approuvé',
                detail: 'Driver41 Doe couvre ODSOE-001 AM & PM.',
                badge: 'Pré-approuvé',
              },
              {
                type: 'audit',
                title: '✅ [Traçabilité] Alex (RH) a approuvé la demande',
                detail: 'Demande de Sarah Connor approuvée en ligne ; carte conservée dans le fil.',
                badge: 'Approuvé',
              },
            ],
            slots: [
              { label: 'AM (07:00)', assignee: 'Driver41 Doe', filled: true },
              { label: 'PM (14:30)', assignee: 'Driver41 Doe', filled: true },
            ],
          },
        ],
      },
      {
        id: 'auto_broadcast',
        tabLabel: '2. Sans remplaçant (Diffusion AM/PM)',
        summary:
          'Congé <= 2 jours sans remplaçant : le système découpe et publie automatiquement les quarts AM et PM ; des chauffeurs différents les réclament et la demande passe en Pré-approuvé puis Approuvé.',
        steps: [
          {
            title: 'Étape 1 · Congé <= 2 jours sans remplaçant',
            subtitle: 'L’employé n’a pas trouvé de collègue pour demain (1 jour).',
            stageIndex: 1,
            stageLabel: '1. Soumission sans remplaçant',
            statusColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
            driverBubbles: [
              { sender: 'driver', text: 'Je suis malade et j’ai besoin de demain en congé. Aucun remplaçant trouvé.' },
              {
                sender: 'ai',
                text: 'Comme votre absence est <= 2 jours, je vais publier séparément vos quarts AM et PM sur ODSOE-004.',
                badge: 'Auto-diffusion <= 2j',
                highlight: 'info',
              },
            ],
            agentFeed: [
              {
                type: 'submitted',
                title: 'Création de la diffusion',
                detail: 'Découpage automatique en quarts AM & PM ouverts...',
                badge: 'Initialisation',
              },
            ],
          },
          {
            title: 'Étape 2 · Quarts AM & PM publiés (0 candidat)',
            subtitle: 'L’Agent Web et le Suivi des Étapes signalent « Publié · Aucun candidat ».',
            stageIndex: 2,
            stageLabel: '2. Publié · Aucun candidat (0/2)',
            statusColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
            driverBubbles: [
              {
                sender: 'system',
                text: '📢 2 ouvertures publiées : ODSOE-004 AM (07:00) et PM (14:30). En attente de candidatures.',
                badge: '0/2 couverts',
                highlight: 'warning',
              },
            ],
            agentFeed: [
              {
                type: 'submitted',
                title: '📥 Nouvelle demande (Diffusion auto)',
                detail: 'Marc Tremblay · ODSOE-004 · 2 quarts publiés, 0 candidat pour l’instant.',
                badge: '🔴 Sans candidat',
              },
            ],
            slots: [
              { label: 'AM (07:00)', assignee: 'Ouvert', filled: false },
              { label: 'PM (14:30)', assignee: 'Ouvert', filled: false },
            ],
          },
          {
            title: 'Étape 3 · Premier chauffeur réclame le quart AM (1/2)',
            subtitle: 'Driver15 prend le matin ; le système vérifie l’absence de conflit.',
            stageIndex: 2,
            stageLabel: '2. Couverture partielle (1/2)',
            statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            driverBubbles: [
              {
                sender: 'peer',
                text: '👍 Driver15 a réclamé votre quart AM (07:00) sur ODSOE-004.',
                badge: '1/2 couvert',
                highlight: 'info',
              },
            ],
            agentFeed: [
              {
                type: 'status_change',
                title: '🔄 Mise à jour remplacement (1/2)',
                detail: 'Driver15 couvre le quart AM. Quart PM toujours ouvert.',
                badge: '1/2 couvert',
              },
            ],
            slots: [
              { label: 'AM (07:00)', assignee: 'Driver15', filled: true },
              { label: 'PM (14:30)', assignee: 'Ouvert', filled: false },
            ],
          },
          {
            title: 'Étape 4 · Second chauffeur réclame PM → Pré-approuvé (2/2)',
            subtitle: 'Tous les quarts sont remplis ; passage automatique en Pré-approuvé (SLA 24h).',
            stageIndex: 3,
            stageLabel: '3. Pré-approuvé (2/2 couverts)',
            statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
            driverBubbles: [
              {
                sender: 'ai',
                text: '🎉 Tous les quarts sont couverts (AM : Driver15, PM : Driver33) ! Statut passé à Pré-approuvé (SLA 24h).',
                badge: 'Pré-approuvé',
                highlight: 'success',
              },
            ],
            agentFeed: [
              {
                type: 'status_change',
                title: '🔄 Statut modifié → Pré-approuvé',
                detail: '2/2 quarts couverts (Driver15 AM, Driver33 PM). Validation auto dans 24h.',
                badge: 'Pré-approuvé',
              },
            ],
            slots: [
              { label: 'AM (07:00)', assignee: 'Driver15', filled: true },
              { label: 'PM (14:30)', assignee: 'Driver33', filled: true },
            ],
          },
          {
            title: 'Étape 5 · Validation automatique après 24h (SLA)',
            subtitle: 'Sans intervention manuelle avant l’échéance, le congé devient officiellement Approuvé.',
            stageIndex: 4,
            stageLabel: '4. Approuvé auto (SLA 24h)',
            statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            driverBubbles: [
              {
                sender: 'system',
                text: '✅ Validation automatique (SLA 24h) : Votre congé sur ODSOE-004 est officiellement Approuvé.',
                badge: 'Auto-approuvé',
                highlight: 'success',
              },
            ],
            agentFeed: [
              {
                type: 'audit',
                title: '✅ [Traçabilité] Validation automatique SLA 24h',
                detail: 'Marc Tremblay · ODSOE-004 · Couvert par Driver15 (AM) & Driver33 (PM).',
                badge: 'Approuvé',
              },
            ],
            slots: [
              { label: 'AM (07:00)', assignee: 'Driver15', filled: true },
              { label: 'PM (14:30)', assignee: 'Driver33', filled: true },
            ],
          },
        ],
      },
      {
        id: 'manual_handling',
        tabLabel: '3. Traitement manuel (Publier / Assigner)',
        summary:
          'Absence > 2 jours ou révision manuelle : le répartiteur publie les postes vacants ou assigne directement un remplaçant, puis les RH valident dans l’Agent IA.',
        steps: [
          {
            title: 'Étape 1 · Demande > 2 jours (Révision manuelle requise)',
            subtitle: 'Une absence de 4 jours ne déclenche pas la diffusion auto et passe en attente RH.',
            stageIndex: 1,
            stageLabel: '1. Soumis · Révision RH',
            statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            driverBubbles: [
              { sender: 'driver', text: 'Je demande 4 jours de vacances la semaine prochaine (Lun–Jeu).' },
              {
                sender: 'ai',
                text: 'Pour les absences de plus de 2 jours, votre demande est transmise aux RH et à la répartition pour traitement manuel.',
                badge: 'Révision manuelle',
                highlight: 'info',
              },
            ],
            agentFeed: [
              {
                type: 'submitted',
                title: '📥 Nouvelle demande (4 jours · Vacances)',
                detail: 'David Roy · ODSOE-012 · Sans remplaçant. Nécessite action manuelle.',
                badge: '📋 Révision RH',
              },
            ],
          },
          {
            title: 'Étape 2 · Le répartiteur choisit : Publier ou Assigner',
            subtitle: 'Depuis la table ou le tableau par dépôt, le répartiteur ouvre les actions de couverture.',
            stageIndex: 2,
            stageLabel: '2. Action manuelle Répartition',
            statusColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
            driverBubbles: [
              {
                sender: 'system',
                text: 'La répartition examine les disponibilités du dépôt Est d’Ottawa pour couvrir ODSOE-012 sur 4 jours.',
                badge: 'En traitement',
              },
            ],
            agentFeed: [
              {
                type: 'manual_action',
                title: '🛠️ Choix du répartiteur',
                detail: 'Option 1 : Publier sur Route Openings · Option 2 : Assigner directement un chauffeur de réserve.',
                badge: 'Répartition',
              },
            ],
          },
          {
            title: 'Étape 3 · Assignation directe du remplaçant (Driver08)',
            subtitle: 'Un chauffeur de réserve (Driver08) est assigné sur les 4 jours via TemporaryAssignment.',
            stageIndex: 3,
            stageLabel: '3. Remplaçant assigné',
            statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
            driverBubbles: [
              {
                sender: 'system',
                text: 'Remplaçant assigné par la répartition : Driver08 Couvrira ODSOE-012 (Lun–Jeu).',
                badge: 'Couvert',
                highlight: 'success',
              },
            ],
            agentFeed: [
              {
                type: 'status_change',
                title: '🔄 Remplaçant assigné manuellement',
                detail: 'Driver08 affecté à ODSOE-012 (Lun–Jeu). Prêt pour approbation RH.',
                badge: 'Prêt RH',
              },
            ],
            slots: [
              { label: 'Lun–Jeu (AM)', assignee: 'Driver08', filled: true },
              { label: 'Lun–Jeu (PM)', assignee: 'Driver08', filled: true },
            ],
          },
          {
            title: 'Étape 4 · Approbation finale & Trace d’audit',
            subtitle: 'Les RH approuvent dans l’Agent IA ; le chauffeur reçoit sa confirmation.',
            stageIndex: 4,
            stageLabel: '4. Approuvé final',
            statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            driverBubbles: [
              {
                sender: 'system',
                text: '✅ Vos vacances (Lun–Jeu) sont officiellement approuvées par Marie (RH). Remplaçant : Driver08.',
                badge: 'Approuvé',
                highlight: 'success',
              },
            ],
            agentFeed: [
              {
                type: 'audit',
                title: '✅ [Traçabilité] Marie (RH) a approuvé David Roy',
                detail: 'Couverture manuelle confirmée (Driver08). Historique complet enregistré.',
                badge: 'Approuvé',
              },
            ],
            slots: [
              { label: 'Lun–Jeu (AM)', assignee: 'Driver08', filled: true },
              { label: 'Lun–Jeu (PM)', assignee: 'Driver08', filled: true },
            ],
          },
        ],
      },
    ];
  }

  return [
    {
      id: 'named_peer',
      tabLabel: '1. Substitute Found (Peer Confirm)',
      summary:
        'Driver names a substitute. AI catches schedule conflicts (driver22), validates driver41, sends a peer confirmation card, transitions to Pre-Approved, and records HR approval.',
      steps: [
        {
          title: 'Step 1 · Conversational Request (Driver App)',
          subtitle: 'Employee asks for tomorrow off; AI detects assigned AM & PM routes.',
          stageIndex: 1,
          stageLabel: '1. Draft & Schedule Check',
          statusColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          driverBubbles: [
            { sender: 'driver', text: 'I want to take tomorrow off.' },
            {
              sender: 'ai',
              text: 'Your scheduled route tomorrow is ODSOE-001 (AM & PM). What is your leave type, and do you have a substitute driver?',
              badge: 'Schedule Detected',
              highlight: 'info',
            },
            { sender: 'driver', text: 'Personal leave, substitute: driver22.' },
          ],
          agentFeed: [
            {
              type: 'submitted',
              title: 'Awaiting Submission',
              detail: 'Employee is completing leave details in Company Office Chat...',
              badge: 'Drafting',
            },
          ],
        },
        {
          title: 'Step 2 · Conflict Detection & Correction',
          subtitle: 'AI rejects driver22 (conflict on ODSOE-007) and validates driver41.',
          stageIndex: 1,
          stageLabel: '1. Conflict & CDL Check',
          statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          driverBubbles: [
            {
              sender: 'ai',
              text: 'Schedule Conflict: Driver22 Doe is already assigned to route ODSOE-007 (AM & PM) tomorrow.',
              badge: 'Conflict Blocked',
              highlight: 'warning',
            },
            { sender: 'driver', text: 'My mistake — it is driver41.' },
            {
              sender: 'ai',
              text: 'Driver41 Doe is available tomorrow with a valid CDL. Preview ready — please confirm to submit.',
              badge: 'No Conflict',
              highlight: 'success',
            },
          ],
          agentFeed: [
            {
              type: 'submitted',
              title: 'Pre-Check Ready',
              detail: 'Driver41 Doe verified (Valid CDL, 0 AM/PM conflicts).',
              badge: 'Verified',
            },
          ],
        },
        {
          title: 'Step 3 · Submitted & Peer Confirmation Sent (Option B)',
          subtitle: 'Request enters awaiting_peer_confirm; Web Approver AI Agent is notified.',
          stageIndex: 2,
          stageLabel: '2. Awaiting Peer Confirm',
          statusColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
          driverBubbles: [
            {
              sender: 'system',
              text: 'Form confirmed · Request #TOR-2041 submitted. Cover request sent to Driver41 Doe.',
              badge: 'Option B · Peer',
              highlight: 'info',
            },
            {
              sender: 'peer',
              text: 'Driver41 App Card: "Cover ODSOE-001 AM & PM tomorrow? [Accept Cover] [Decline]"',
              badge: 'Pending Peer',
            },
          ],
          agentFeed: [
            {
              type: 'submitted',
              title: '📥 New Time-Off Request',
              detail: 'Sarah Connor submitted Personal Leave (ODSOE-001). Waiting for Driver41 Doe.',
              badge: 'Awaiting Peer',
            },
          ],
        },
        {
          title: 'Step 4 · Peer Accepts → Pre-Approved (24h SLA)',
          subtitle: 'Driver41 taps Accept Cover; schedule is pre-locked and status becomes Pre-Approved.',
          stageIndex: 3,
          stageLabel: '3. Pre-Approved (24h SLA)',
          statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          driverBubbles: [
            {
              sender: 'peer',
              text: 'Driver41 Doe tapped "Accept Cover"! TemporaryAssignment pre-locked on schedule.',
              badge: 'Cover Locked',
              highlight: 'success',
            },
            {
              sender: 'ai',
              text: '🎉 Pre-Approved! Final confirmation returns within 24h (or 2h before departure) if no HR changes are needed.',
              badge: 'Pre-Approved',
              highlight: 'success',
            },
          ],
          agentFeed: [
            {
              type: 'submitted',
              title: '📥 New Time-Off Request',
              detail: 'Sarah Connor · ODSOE-001 · Tomorrow',
              badge: 'Submitted',
            },
            {
              type: 'status_change',
              title: '🔄 Status Changed → Pre-Approved',
              detail: 'Driver41 Doe agreed to cover AM & PM. 24h auto-finalize SLA active.',
              badge: 'Pre-Approved',
            },
          ],
          slots: [
            { label: 'AM (07:00)', assignee: 'Driver41 Doe', filled: true },
            { label: 'PM (14:30)', assignee: 'Driver41 Doe', filled: true },
          ],
        },
        {
          title: 'Step 5 · HR Approval & Permanent Work Trajectory',
          subtitle: 'Approver clicks Approve inside the AI Agent; trajectory is permanently logged.',
          stageIndex: 4,
          stageLabel: '4. Final Approved',
          statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          driverBubbles: [
            {
              sender: 'system',
              text: '✅ Officially Approved by Alex (HR). Your leave on ODSOE-001 is confirmed (Substitute: Driver41 Doe).',
              badge: 'Approved',
              highlight: 'success',
            },
          ],
          agentFeed: [
            {
              type: 'status_change',
              title: '🔄 Status Changed → Pre-Approved',
              detail: 'Driver41 Doe covering ODSOE-001 AM & PM.',
              badge: 'Pre-Approved',
            },
            {
              type: 'audit',
              title: '✅ [Work Trajectory] Alex (HR) approved Sarah Connor',
              detail: 'Inline approval completed; card preserved with full audit trail.',
              badge: 'Approved',
            },
          ],
          slots: [
            { label: 'AM (07:00)', assignee: 'Driver41 Doe', filled: true },
            { label: 'PM (14:30)', assignee: 'Driver41 Doe', filled: true },
          ],
        },
      ],
    },
    {
      id: 'auto_broadcast',
      tabLabel: '2. No Substitute (Auto-Broadcast AM/PM)',
      summary:
        'Leave <= 2 days with no substitute: app splits and broadcasts AM & PM shift openings separately; different drivers claim each shift → Pre-Approved → 24h auto-finalize.',
      steps: [
        {
          title: 'Step 1 · Leave <= 2 Days with No Substitute',
          subtitle: 'Employee requests 1 day off without a named substitute.',
          stageIndex: 1,
          stageLabel: '1. Submitted (No Substitute)',
          statusColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          driverBubbles: [
            { sender: 'driver', text: 'I am sick and need tomorrow off. I do not have a substitute.' },
            {
              sender: 'ai',
              text: 'Since your leave is <= 2 days, I will automatically split and broadcast your AM & PM shifts on ODSOE-004.',
              badge: 'Auto-Broadcast <= 2d',
              highlight: 'info',
            },
          ],
          agentFeed: [
            {
              type: 'submitted',
              title: 'Creating Shift Broadcast',
              detail: 'Splitting into independent AM & PM shift openings...',
              badge: 'Initializing',
            },
          ],
        },
        {
          title: 'Step 2 · AM & PM Shifts Broadcasted (0 Applicants)',
          subtitle: 'Web Approver Agent & Stage Tracker highlight "Broadcasted · No Applicants".',
          stageIndex: 2,
          stageLabel: '2. Broadcasted · No Applicants (0/2)',
          statusColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          driverBubbles: [
            {
              sender: 'system',
              text: '📢 Published 2 separate openings: ODSOE-004 AM (07:00) and PM (14:30). Waiting for drivers.',
              badge: '0/2 Filled',
              highlight: 'warning',
            },
          ],
          agentFeed: [
            {
              type: 'submitted',
              title: '📥 New Request (Auto-Broadcast)',
              detail: 'Marc Tremblay · ODSOE-004 · 2 shift openings live, 0 applicants yet.',
              badge: '🔴 No Applicant',
            },
          ],
          slots: [
            { label: 'AM (07:00)', assignee: 'Open', filled: false },
            { label: 'PM (14:30)', assignee: 'Open', filled: false },
          ],
        },
        {
          title: 'Step 3 · Driver15 Claims AM Shift (1/2 Filled)',
          subtitle: 'First driver claims morning slot after conflict check; PM remains open.',
          stageIndex: 2,
          stageLabel: '2. Partial Cover (1/2 Shifts)',
          statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          driverBubbles: [
            {
              sender: 'peer',
              text: '👍 Driver15 claimed your AM shift (07:00) on ODSOE-004.',
              badge: '1/2 Filled',
              highlight: 'info',
            },
          ],
          agentFeed: [
            {
              type: 'status_change',
              title: '🔄 Shift Cover Update (1/2)',
              detail: 'Driver15 claimed AM shift. PM shift still open.',
              badge: '1/2 Covered',
            },
          ],
          slots: [
            { label: 'AM (07:00)', assignee: 'Driver15', filled: true },
            { label: 'PM (14:30)', assignee: 'Open', filled: false },
          ],
        },
        {
          title: 'Step 4 · Driver33 Claims PM → Pre-Approved (2/2)',
          subtitle: 'All shifts covered; auto-transitions to Pre-Approved and starts 24h SLA.',
          stageIndex: 3,
          stageLabel: '3. Pre-Approved (2/2 Covered)',
          statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          driverBubbles: [
            {
              sender: 'ai',
              text: '🎉 All shifts covered (AM: Driver15, PM: Driver33)! Status changed to Pre-Approved (24h SLA).',
              badge: 'Pre-Approved',
              highlight: 'success',
            },
          ],
          agentFeed: [
            {
              type: 'status_change',
              title: '🔄 Status Changed → Pre-Approved',
              detail: '2/2 shifts filled (Driver15 AM, Driver33 PM). 24h auto-approval active.',
              badge: 'Pre-Approved',
            },
          ],
          slots: [
            { label: 'AM (07:00)', assignee: 'Driver15', filled: true },
            { label: 'PM (14:30)', assignee: 'Driver33', filled: true },
          ],
        },
        {
          title: 'Step 5 · 24h SLA Auto-Finalized to Approved',
          subtitle: 'With no manual intervention before deadline, request auto-approves.',
          stageIndex: 4,
          stageLabel: '4. Auto-Approved (24h SLA)',
          statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          driverBubbles: [
            {
              sender: 'system',
              text: '✅ Automatically Finalized (24h SLA): Your leave on ODSOE-004 is officially Approved.',
              badge: 'Auto-Approved',
              highlight: 'success',
            },
          ],
          agentFeed: [
            {
              type: 'audit',
              title: '✅ [Work Trajectory] 24h SLA Auto-Approved',
              detail: 'Marc Tremblay · ODSOE-004 · Covered by Driver15 (AM) & Driver33 (PM).',
              badge: 'Approved',
            },
          ],
          slots: [
            { label: 'AM (07:00)', assignee: 'Driver15', filled: true },
            { label: 'PM (14:30)', assignee: 'Driver33', filled: true },
          ],
        },
      ],
    },
    {
      id: 'manual_handling',
      tabLabel: '3. Manual Handling (Publish / Assign)',
      summary:
        'Leave > 2 days or manual dispatch: Dispatcher manually publishes route openings or directly assigns a spare driver, then HR reviews and approves in the AI Agent.',
      steps: [
        {
          title: 'Step 1 · > 2 Days Request (Manual Review Required)',
          subtitle: 'A 4-day vacation skips auto-broadcast and enters pending HR/Dispatch review.',
          stageIndex: 1,
          stageLabel: '1. Submitted · Manual Review',
          statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          driverBubbles: [
            { sender: 'driver', text: 'I need 4 days of vacation next week (Mon–Thu).' },
            {
              sender: 'ai',
              text: 'Requests over 2 days are routed to HR & Dispatch for manual coverage planning and review.',
              badge: 'Manual Review',
              highlight: 'info',
            },
          ],
          agentFeed: [
            {
              type: 'submitted',
              title: '📥 New Request (4 Days · Vacation)',
              detail: 'David Roy · ODSOE-012 · Unassigned. Requires manual handling.',
              badge: '📋 HR Pending',
            },
          ],
        },
        {
          title: 'Step 2 · Dispatcher Chooses: Publish or Direct Assign',
          subtitle: 'From the Time-Off table or Yard view, Dispatcher opens coverage tools.',
          stageIndex: 2,
          stageLabel: '2. Manual Dispatch Action',
          statusColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
          driverBubbles: [
            {
              sender: 'system',
              text: 'Dispatch is reviewing Ottawa East Yard spare drivers to cover ODSOE-012 for 4 days.',
              badge: 'In Progress',
            },
          ],
          agentFeed: [
            {
              type: 'manual_action',
              title: '🛠️ Dispatcher Coverage Options',
              detail: 'Option 1: Publish to Route Openings · Option 2: Directly Assign Spare Driver.',
              badge: 'Dispatch',
            },
          ],
        },
        {
          title: 'Step 3 · Direct Substitute Assignment (Driver08)',
          subtitle: 'Spare driver Driver08 is assigned across Mon–Thu via TemporaryAssignment.',
          stageIndex: 3,
          stageLabel: '3. Substitute Assigned',
          statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          driverBubbles: [
            {
              sender: 'system',
              text: 'Dispatch assigned Driver08 to cover ODSOE-012 (Mon–Thu).',
              badge: 'Covered',
              highlight: 'success',
            },
          ],
          agentFeed: [
            {
              type: 'status_change',
              title: '🔄 Substitute Manually Assigned',
              detail: 'Driver08 assigned to ODSOE-012 (Mon–Thu). Ready for HR approval.',
              badge: 'Ready for HR',
            },
          ],
          slots: [
            { label: 'Mon–Thu (AM)', assignee: 'Driver08', filled: true },
            { label: 'Mon–Thu (PM)', assignee: 'Driver08', filled: true },
          ],
        },
        {
          title: 'Step 4 · Final HR Approval & Audit Trail',
          subtitle: 'HR approves in the Approver AI Agent; employee receives final confirmation.',
          stageIndex: 4,
          stageLabel: '4. Final Approved',
          statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          driverBubbles: [
            {
              sender: 'system',
              text: '✅ Your vacation (Mon–Thu) is officially Approved by Marie (HR). Substitute: Driver08.',
              badge: 'Approved',
              highlight: 'success',
            },
          ],
          agentFeed: [
            {
              type: 'audit',
              title: '✅ [Work Trajectory] Marie (HR) approved David Roy',
              detail: 'Manual coverage confirmed (Driver08). Full audit trail recorded.',
              badge: 'Approved',
            },
          ],
          slots: [
            { label: 'Mon–Thu (AM)', assignee: 'Driver08', filled: true },
            { label: 'Mon–Thu (PM)', assignee: 'Driver08', filled: true },
          ],
        },
      ],
    },
  ];
}

export const TimeOffWorkflowDemoModal: React.FC<TimeOffWorkflowDemoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isFrench } = useI18n();
  const scenarios = useMemo(() => buildScenarios(isFrench), [isFrench]);

  const [scenarioId, setScenarioId] = useState<ScenarioId>('named_peer');
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMs, setSpeedMs] = useState<number>(3200);

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === scenarioId) || scenarios[0],
    [scenarios, scenarioId]
  );

  const currentStep = activeScenario.steps[stepIndex] || activeScenario.steps[0];

  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const timer = window.setInterval(() => {
      setStepIndex((prev) => {
        if (prev + 1 >= activeScenario.steps.length) {
          return 0;
        }
        return prev + 1;
      });
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [isOpen, isPlaying, speedMs, activeScenario.steps.length]);

  const handleSelectScenario = (id: ScenarioId) => {
    setScenarioId(id);
    setStepIndex(0);
    setIsPlaying(true);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Time-Off Workflow Animated Demo"
    >
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-teal-500/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/40 flex items-center justify-center text-teal-300">
              <Film className="w-4.5 h-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                {isFrench
                  ? 'Démonstration Animée du Flux Congés & Remplacements'
                  : 'Time-Off & Shift Cover Animated Workflow Demo'}
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-[10px] font-bold text-teal-300">
                  {isFrench ? 'Interactif' : 'Interactive'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isFrench
                  ? 'Simule en direct l’interaction Driver App ↔ Agent IA Approbateur Web selon 3 scénarios'
                  : 'Live animated simulation of Driver App ↔ Web Approver AI Agent across 3 real-world scenarios'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Close demo"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {scenarios.map((sc) => {
              const active = sc.id === scenarioId;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handleSelectScenario(sc.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    active
                      ? 'bg-teal-600 text-white border-teal-400 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {sc.tabLabel}
                </button>
              );
            })}
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setStepIndex((p) => (p - 1 + activeScenario.steps.length) % activeScenario.steps.length);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title={isFrench ? 'Étape précédente' : 'Previous Step'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? (isFrench ? 'Pause' : 'Pause') : (isFrench ? 'Lire' : 'Play')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setStepIndex((p) => (p + 1) % activeScenario.steps.length);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title={isFrench ? 'Étape suivante' : 'Next Step'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setStepIndex(0);
                setIsPlaying(true);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title={isFrench ? 'Recommencer' : 'Restart'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSpeedMs((prev) => (prev === 3200 ? 1800 : 3200))}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono cursor-pointer"
              title={isFrench ? 'Vitesse de lecture' : 'Playback speed'}
            >
              {speedMs === 3200 ? '1.0x' : '1.8x'}
            </button>
          </div>
        </div>

        {/* Scenario Summary + 4-Stage Animated Progress Bar */}
        <div className="px-5 py-3 bg-slate-950/50 border-b border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-300">{activeScenario.summary}</p>
            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${currentStep.statusColor}`}>
              {currentStep.stageLabel}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { idx: 1, label: isFrench ? '1. Soumission & Vérif.' : '1. Submit & Validate', icon: Sparkles },
              { idx: 2, label: isFrench ? '2. Remplacement / Diffusion' : '2. Cover / Broadcast', icon: Radio },
              { idx: 3, label: isFrench ? '3. Pré-approuvé (24h)' : '3. Pre-Approved (24h)', icon: Clock },
              { idx: 4, label: isFrench ? '4. Approuvé final' : '4. Final Approved', icon: ShieldCheck },
            ].map((node) => {
              const Icon = node.icon;
              const isReached = currentStep.stageIndex >= node.idx;
              const isCurrent = currentStep.stageIndex === node.idx;
              return (
                <div
                  key={node.idx}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border text-[11px] font-bold transition-all duration-500 ${
                    isCurrent
                      ? 'bg-teal-500/20 border-teal-400 text-teal-200 scale-[1.02] shadow-md shadow-teal-500/10'
                      : isReached
                        ? 'bg-slate-800/90 border-slate-600 text-slate-200'
                        : 'bg-slate-900/50 border-slate-800 text-slate-500'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'animate-pulse text-teal-300' : ''}`} />
                  <span className="truncate">{node.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Split-Screen Animated Simulation */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">{currentStep.title}</h3>
              <p className="text-xs text-slate-400">{currentStep.subtitle}</p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              {stepIndex + 1} / {activeScenario.steps.length}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Driver App Mockup */}
            <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  {isFrench ? 'Application Chauffeur · Office Chat' : 'Driver App · Company Office Chat'}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                  {isFrench ? 'Temps réel' : 'Real-Time'}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[210px]">
                {currentStep.driverBubbles.map((b, i) => {
                  const isDriver = b.sender === 'driver';
                  const borderTone =
                    b.highlight === 'warning'
                      ? 'border-rose-500/50 bg-rose-950/40 text-rose-100'
                      : b.highlight === 'success'
                        ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                        : b.highlight === 'info'
                          ? 'border-sky-500/40 bg-sky-950/30 text-slate-100'
                          : 'border-slate-700 bg-slate-800/90 text-slate-200';

                  return (
                    <div
                      key={`${scenarioId}-${stepIndex}-drv-${i}`}
                      className={`flex flex-col ${isDriver ? 'items-end' : 'items-start'} animate-[fadeIn_0.35s_ease-out]`}
                    >
                      <div
                        className={`max-w-[90%] rounded-xl px-3 py-2 text-xs border space-y-1 ${
                          isDriver ? 'bg-teal-600 border-teal-500 text-white' : borderTone
                        }`}
                      >
                        {b.badge && (
                          <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-90">
                            {b.badge}
                          </div>
                        )}
                        <div className="leading-relaxed">{b.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentStep.slots && (
                <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                  {currentStep.slots.map((sl) => (
                    <span
                      key={sl.label}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all duration-300 ${
                        sl.filled
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
                      }`}
                    >
                      {sl.filled ? <UserCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                      {sl.label}: {sl.assignee}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Web Approver AI Agent Mockup */}
            <div className="rounded-2xl bg-slate-950/70 border border-teal-500/30 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Bot className="w-4 h-4 text-teal-400" />
                  {isFrench ? 'Console Web · Agent IA Approbateur' : 'Web Console · Approver AI Agent'}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Firestore Live
                </span>
              </div>

              <div className="space-y-2.5 min-h-[210px]">
                {currentStep.agentFeed.map((ev, i) => {
                  const tone =
                    ev.type === 'audit'
                      ? 'bg-emerald-950/50 border-emerald-500/50'
                      : ev.type === 'status_change'
                        ? 'bg-cyan-950/40 border-cyan-500/40'
                        : ev.type === 'manual_action'
                          ? 'bg-violet-950/40 border-violet-500/40'
                          : 'bg-slate-900/90 border-slate-700';

                  return (
                    <div
                      key={`${scenarioId}-${stepIndex}-agt-${i}`}
                      className={`p-3 rounded-xl border space-y-1.5 ${tone} animate-[fadeIn_0.35s_ease-out]`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">{ev.title}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-teal-300">
                          {ev.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{ev.detail}</p>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  {isFrench
                    ? 'Traçabilité complète conservée en continu'
                    : 'Full work trajectory preserved across every decision'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Stepper Dots */}
        <div className="px-5 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {activeScenario.steps.map((st, idx) => (
              <button
                key={st.title}
                type="button"
                onClick={() => {
                  setStepIndex(idx);
                  setIsPlaying(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  idx === stepIndex
                    ? 'bg-teal-600 text-white border-teal-400'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {isFrench
              ? 'Cliquez sur un numéro pour sauter directement à une étape'
              : 'Click any step number to jump directly to that stage'}
          </span>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
