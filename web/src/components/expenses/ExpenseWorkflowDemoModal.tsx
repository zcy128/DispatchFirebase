import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Film,
  Pause,
  Play,
  Receipt,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

interface ExpenseWorkflowDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScenarioId = 'auto_pre_approve' | 'manual_review' | 'ai_policy';

interface DemoBubble {
  sender: 'driver' | 'engine' | 'reviewer' | 'system';
  text: string;
  badge?: string;
  highlight?: 'warning' | 'success' | 'info';
}

interface WebFeedItem {
  type: 'pre_approved' | 'pending' | 'approved' | 'policy';
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
  leftBubbles: DemoBubble[];
  rightFeed: WebFeedItem[];
  payrollStatus: string;
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
        id: 'auto_pre_approve',
        tabLabel: '1. Pré-approbation auto (SLA configurable)',
        summary:
          'Dépense standard éligible (ex. Lavage d’autobus <= 20 $/période) : catégorie unique validée, passage auto en Pré-approuvé (isolé de la paie), puis Approbation finale après le délai SLA (5 jours par défaut).',
        steps: [
          {
            title: 'Étape 1 · Soumission à catégorie unique (Driver App)',
            subtitle: 'Le chauffeur sélectionne « Bus Washing » et joint 2 reçus (18,50 $).',
            stageIndex: 1,
            stageLabel: '1. Soumission & Catégorie unique',
            statusColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
            leftBubbles: [
              {
                sender: 'driver',
                text: 'Catégorie : Bus Washing (Flotte) · Reçu #1 : 10,00 $ + Reçu #2 : 8,50 $ = 18,50 $.',
                badge: 'Catégorie unique valide',
                highlight: 'info',
              },
            ],
            rightFeed: [
              {
                type: 'pending',
                title: 'Validation des règles en cours',
                detail: 'Vérification : catégorie unique, reçu joint, plafond bi-hebdomadaire (20,00 $).',
                badge: 'Évaluation',
              },
            ],
            payrollStatus: 'Non transmis à la Paie',
          },
          {
            title: 'Étape 2 · Pré-approbation automatique (Option A)',
            subtitle: '18,50 $ <= 20,00 $ et autoPreApprove = true → Statut Pre-Approved (5 j).',
            stageIndex: 2,
            stageLabel: '2. Pré-approuvé (Fenêtre 5 jours)',
            statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
            leftBubbles: [
              {
                sender: 'engine',
                text: '💠 Pré-approuvé automatiquement ! Conforme au plafond (18,50 $ / 20,00 $). Sera finalisé après 5 jours calendaires.',
                badge: 'Pre-Approved (SLA 5j)',
                highlight: 'success',
              },
            ],
            rightFeed: [
              {
                type: 'pre_approved',
                title: '💠 Demande #EXP-3091 → Pre-Approved',
                detail: 'Visible dans la carte & filtre Pre-Approved. Isolée de la Paie tant que le délai SLA n’est pas écoulé.',
                badge: 'Pre-Approved',
              },
            ],
            payrollStatus: 'Isolé de la Paie (En attente SLA)',
          },
          {
            title: 'Étape 3 · Finalisation auto SLA (ou Validation anticipée)',
            subtitle: 'Après 5 jours sans blocage (ou clic Approuver), la demande passe à Approved.',
            stageIndex: 4,
            stageLabel: '4. Approuvé & Synchronisé Paie',
            statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            leftBubbles: [
              {
                sender: 'system',
                text: '✅ Demande #EXP-3091 officiellement Approuvée (18,50 $). Incluse dans votre relevé bi-hebdomadaire.',
                badge: 'Approved',
                highlight: 'success',
              },
            ],
            rightFeed: [
              {
                type: 'approved',
                title: '✅ Finalisée → Approved (18,50 $)',
                detail: 'Transmise à Bi-Weekly Payroll (status === "approved") avec traçabilité complète.',
                badge: 'Synchronisé Paie',
              },
            ],
            payrollStatus: 'Inclus dans Bi-Weekly Payroll (+18,50 $)',
          },
        ],
      },
      {
        id: 'manual_review',
        tabLabel: '2. Révision manuelle & Dépassement de plafond',
        summary:
          'Les catégories exigeant une preuve de réussite (Road Test) ou dépassant le plafond restent en Pending Review (onglet par défaut) pour vérification IA et approbation justifiée.',
        steps: [
          {
            title: 'Étape 1 · Demande nécessitant révision manuelle',
            subtitle: 'Le chauffeur soumet un lavage à 32,00 $ (> plafond 20,00 $) ou un Road Test.',
            stageIndex: 1,
            stageLabel: '1. Soumis · Dépassement détecté',
            statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            leftBubbles: [
              {
                sender: 'driver',
                text: 'Catégorie : Bus Washing · Montant : 32,00 $ (nettoyage complet après tempête).',
                badge: '32,00 $ > 20,00 $',
                highlight: 'warning',
              },
            ],
            rightFeed: [
              {
                type: 'pending',
                title: '⏳ File Pending Review (Vue par défaut)',
                detail: 'Alerte déterministe : dépassement de 12,00 $ sur la période de paie. Pré-approbation auto bloquée.',
                badge: 'Pending Review',
              },
            ],
            payrollStatus: 'Bloqué (Révision requise)',
          },
          {
            title: 'Étape 2 · Pré-vérification IA & Isolation RBAC',
            subtitle: 'Le responsable Flotte exécute AI Pre-Check et saisit une note de dérogation.',
            stageIndex: 3,
            stageLabel: '3. Contrôle Flotte & AI Pre-Check',
            statusColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
            leftBubbles: [
              {
                sender: 'reviewer',
                text: '🤖 AI Pre-Check : Reçu valide (32,00 $). Justification obligatoire pour approuver le dépassement.',
                badge: 'Groupe Flotte uniquement',
                highlight: 'info',
              },
            ],
            rightFeed: [
              {
                type: 'pending',
                title: 'Note de dérogation ajoutée',
                detail: '« Nettoyage exceptionnel approuvé par le superviseur de dépôt. »',
                badge: 'Dérogation prête',
              },
            ],
            payrollStatus: 'En attente de validation',
          },
          {
            title: 'Étape 3 · Approbation manuelle → Paie Bi-Hebdomadaire',
            subtitle: 'Une fois approuvée, la somme exacte (arrondie à 2 décimales) rejoint la paie.',
            stageIndex: 4,
            stageLabel: '4. Approuvé & Transmis Paie',
            statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            leftBubbles: [
              {
                sender: 'system',
                text: '✅ Demande approuvée (32,00 $) par le responsable Flotte.',
                badge: 'Approved',
                highlight: 'success',
              },
            ],
            rightFeed: [
              {
                type: 'approved',
                title: '✅ Approuvé avec justification',
                detail: '32,00 $ synchronisés avec Bi-Weekly Payroll & QuickBooks.',
                badge: 'Synchronisé Paie',
              },
            ],
            payrollStatus: 'Inclus dans Bi-Weekly Payroll (+32,00 $)',
          },
        ],
      },
      {
        id: 'ai_policy',
        tabLabel: '3. Assistant IA Politiques & Délai SLA',
        summary:
          'Dans Policies & Limits, les responsables RH/Flotte ajustent le délai SLA (ex. 5j → 3j) ou modifient les plafonds en langage naturel via le Copilote IA avec journal d’audit immuable.',
        steps: [
          {
            title: 'Étape 1 · Commande en langage naturel',
            subtitle: 'Le responsable Flotte demande au Copilote IA d’augmenter le plafond lavage.',
            stageIndex: 1,
            stageLabel: '1. Requête Copilote IA',
            statusColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
            leftBubbles: [
              {
                sender: 'reviewer',
                text: '« Augmenter le plafond bi-hebdomadaire de Bus Washing à 25 $ et passer le SLA à 3 jours. »',
                badge: 'Policies & Limits',
                highlight: 'info',
              },
            ],
            rightFeed: [
              {
                type: 'policy',
                title: 'Vérification RBAC (Flotte vs RH)',
                detail: 'Rôle Flotte autorisé sur bus_washing (interdit sur politiques RH).',
                badge: 'RBAC Vérifié',
              },
            ],
            payrollStatus: 'Ancre partagée Bi-Weekly',
          },
          {
            title: 'Étape 2 · Carte de confirmation interactive',
            subtitle: 'L’IA affiche le différentiel avant/après avant toute écriture en base.',
            stageIndex: 3,
            stageLabel: '3. Confirmation administrateur',
            statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
            leftBubbles: [
              {
                sender: 'engine',
                text: '📋 Aperçu : Bus Washing 20,00 $ → 25,00 $ / période · SLA Pré-approbation : 5j → 3j. [Confirmer]',
                badge: 'Confirmation requise',
                highlight: 'info',
              },
            ],
            rightFeed: [
              {
                type: 'policy',
                title: '💠 Carte de changement de règle prête',
                detail: 'Aucun changement appliqué tant que l’utilisateur ne clique pas sur Confirmer.',
                badge: 'Aperçu',
              },
            ],
            payrollStatus: 'Ancre partagée Bi-Weekly',
          },
          {
            title: 'Étape 3 · Règle publiée & Journal d’audit immuable',
            subtitle: 'Nouvelles limites actives immédiatement sur Web & Driver App.',
            stageIndex: 4,
            stageLabel: '4. Politique active & Auditée',
            statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            leftBubbles: [
              {
                sender: 'system',
                text: '✅ Politique mise à jour (25,00 $ · SLA 3j). Driver App synchronisée en temps réel.',
                badge: 'Actif',
                highlight: 'success',
              },
            ],
            rightFeed: [
              {
                type: 'approved',
                title: '✅ Enregistré dans expense_policy_audit_logs',
                detail: 'Historique immuable : qui, quand, avant (20 $) → après (25 $).',
                badge: 'Audité',
              },
            ],
            payrollStatus: 'Nouvelles règles actives',
          },
        ],
      },
    ];
  }

  return [
    {
      id: 'auto_pre_approve',
      tabLabel: '1. Auto Pre-Approval (Configurable SLA)',
      summary:
        'Eligible standard claims (e.g., Bus Washing <= $20/pay period): single-category validated, auto-routed to Pre-Approved (isolated from Payroll), then finalized to Approved after the configurable SLA.',
      steps: [
        {
          title: 'Step 1 · Single-Category Submission (Driver App)',
          subtitle: 'Driver selects "Bus Washing" and attaches 2 receipts totaling $18.50.',
          stageIndex: 1,
          stageLabel: '1. Submit & Single-Category Check',
          statusColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          leftBubbles: [
            {
              sender: 'driver',
              text: 'Category: Bus Washing (Fleet) · Receipt #1: $10.00 + Receipt #2: $8.50 = $18.50.',
              badge: 'Single-Category Valid',
              highlight: 'info',
            },
          ],
          rightFeed: [
            {
              type: 'pending',
              title: 'Policy Engine Evaluating',
              detail: 'Checking single-category rule, receipt attached, and bi-weekly period cap ($20.00).',
              badge: 'Evaluating',
            },
          ],
          payrollStatus: 'Not in Payroll',
        },
        {
          title: 'Step 2 · Automated Pre-Approval (Option A)',
          subtitle: '$18.50 <= $20.00 & autoPreApprove = true → Pre-Approved (5-Day SLA).',
          stageIndex: 2,
          stageLabel: '2. Pre-Approved (5-Day Window)',
          statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          leftBubbles: [
            {
              sender: 'engine',
              text: '💠 Auto Pre-Approved! Within bi-weekly cap ($18.50 / $20.00). Auto-finalizes in 5 calendar days unless held.',
              badge: 'Pre-Approved (5d SLA)',
              highlight: 'success',
            },
          ],
          rightFeed: [
            {
              type: 'pre_approved',
              title: '💠 Claim #EXP-3091 → Pre-Approved',
              detail: 'Tracked in Pre-Approved KPI & Filter. Isolated from Finance/Payroll until SLA completes.',
              badge: 'Pre-Approved',
            },
          ],
          payrollStatus: 'Isolated from Payroll (SLA Hold)',
        },
        {
          title: 'Step 3 · SLA Auto-Finalize (or Early Review) → Payroll',
          subtitle: 'After 5 calendar days with no hold (or manual Approve), claim becomes Approved.',
          stageIndex: 4,
          stageLabel: '4. Final Approved & Synced',
          statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          leftBubbles: [
            {
              sender: 'system',
              text: '✅ Claim #EXP-3091 officially Approved ($18.50). Added to your Bi-Weekly Payroll payout.',
              badge: 'Approved',
              highlight: 'success',
            },
          ],
          rightFeed: [
            {
              type: 'approved',
              title: '✅ Finalized → Approved ($18.50)',
              detail: 'Released to Bi-Weekly Payroll (status === "approved") with full audit trail.',
              badge: 'Synced to Payroll',
            },
          ],
          payrollStatus: 'Included in Bi-Weekly Payroll (+$18.50)',
        },
      ],
    },
    {
      id: 'manual_review',
      tabLabel: '2. Manual Review & Cap / Proof Gate',
      summary:
        'Completion-proof categories (Road Test) or over-cap claims stay in Pending Review (default page tab) for deterministic badge inspection, AI Pre-Check, and justified approval.',
      steps: [
        {
          title: 'Step 1 · Over-Cap or Proof-Required Submission',
          subtitle: 'Driver submits $32.00 Bus Washing (> $20.00 cap) or Road Test completion proof.',
          stageIndex: 1,
          stageLabel: '1. Submitted · Cap Warning',
          statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          leftBubbles: [
            {
              sender: 'driver',
              text: 'Category: Bus Washing · Amount: $32.00 (heavy winter salt & interior wash).',
              badge: '$32.00 > $20.00 Cap',
              highlight: 'warning',
            },
          ],
          rightFeed: [
            {
              type: 'pending',
              title: '⏳ Pending Review Queue (Default Tab)',
              detail: 'Deterministic badge: Exceeds bi-weekly limit by $12.00. Auto pre-approval bypassed.',
              badge: 'Pending Review',
            },
          ],
          payrollStatus: 'Blocked (Needs Review)',
        },
        {
          title: 'Step 2 · AI Pre-Check & Group RBAC Isolation',
          subtitle: 'Fleet reviewer runs AI Pre-Check and enters required override justification.',
          stageIndex: 3,
          stageLabel: '3. Fleet Review & AI Pre-Check',
          statusColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
          leftBubbles: [
            {
              sender: 'reviewer',
              text: '🤖 AI Pre-Check: Receipt matches $32.00. Override justification note required to approve.',
              badge: 'Fleet Group RBAC',
              highlight: 'info',
            },
          ],
          rightFeed: [
            {
              type: 'pending',
              title: 'Override Notes Entered',
              detail: '"Approved deep winter wash per yard supervisor authorization."',
              badge: 'Override Ready',
            },
          ],
          payrollStatus: 'Awaiting Approval Click',
        },
        {
          title: 'Step 3 · Approved & Released to Bi-Weekly Payroll',
          subtitle: 'Approved amount (half-up rounded to 2 decimals) syncs into Payroll & QuickBooks.',
          stageIndex: 4,
          stageLabel: '4. Approved & Synced',
          statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          leftBubbles: [
            {
              sender: 'system',
              text: '✅ Claim approved ($32.00) by Fleet Reviewer.',
              badge: 'Approved',
              highlight: 'success',
            },
          ],
          rightFeed: [
            {
              type: 'approved',
              title: '✅ Approved with Override Notes',
              detail: '$32.00 released to Bi-Weekly Payroll & QuickBooks tax-free reimbursement export.',
              badge: 'Synced to Payroll',
            },
          ],
          payrollStatus: 'Included in Bi-Weekly Payroll (+$32.00)',
        },
      ],
    },
    {
      id: 'ai_policy',
      tabLabel: '3. AI Policy Assistant (Policies & Limits)',
      summary:
        'In Policies & Limits, HR/Fleet managers tune the Pre-Approve SLA (e.g., 5d → 3d) or update caps in natural language via AI Copilot with confirmation cards and immutable audit logs.',
      steps: [
        {
          title: 'Step 1 · Natural-Language Policy Request',
          subtitle: 'Fleet manager asks AI Copilot to raise the Bus Washing cap and adjust SLA.',
          stageIndex: 1,
          stageLabel: '1. AI Policy Prompt',
          statusColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          leftBubbles: [
            {
              sender: 'reviewer',
              text: '"Increase Bus Washing bi-weekly cap to $25 and set Pre-Approve SLA to 3 days."',
              badge: 'Policies & Limits',
              highlight: 'info',
            },
          ],
          rightFeed: [
            {
              type: 'policy',
              title: 'RBAC Scope Check (Fleet vs HR)',
              detail: 'Fleet role permitted on bus_washing (blocked from modifying HR policies).',
              badge: 'RBAC Verified',
            },
          ],
          payrollStatus: 'Shared Bi-Weekly Anchor',
        },
        {
          title: 'Step 2 · Interactive Policy Confirmation Card',
          subtitle: 'AI Copilot previews the exact before/after diff before persisting any change.',
          stageIndex: 3,
          stageLabel: '3. Manager Confirmation',
          statusColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          leftBubbles: [
            {
              sender: 'engine',
              text: '📋 Preview: Bus Washing $20.00 → $25.00 / pay period · Pre-Approve SLA: 5d → 3d. [Confirm Update]',
              badge: 'Confirmation Card',
              highlight: 'info',
            },
          ],
          rightFeed: [
            {
              type: 'policy',
              title: '💠 Policy Change Card Ready',
              detail: 'No database write occurs until the authorized manager clicks Confirm Update.',
              badge: 'Preview',
            },
          ],
          payrollStatus: 'Shared Bi-Weekly Anchor',
        },
        {
          title: 'Step 3 · Policy Live & Immutable Audit Logged',
          subtitle: 'Updated cap & 3-day SLA take effect immediately across Web & Driver App.',
          stageIndex: 4,
          stageLabel: '4. Policy Live & Audited',
          statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          leftBubbles: [
            {
              sender: 'system',
              text: '✅ Policy updated ($25.00 · 3-Day SLA). Driver App cap hints synced in real time.',
              badge: 'Active',
              highlight: 'success',
            },
          ],
          rightFeed: [
            {
              type: 'approved',
              title: '✅ Logged in expense_policy_audit_logs',
              detail: 'Immutable audit entry: actor, timestamp, before ($20) → after ($25).',
              badge: 'Audited',
            },
          ],
          payrollStatus: 'New Rules Live',
        },
      ],
    },
  ];
}

export const ExpenseWorkflowDemoModal: React.FC<ExpenseWorkflowDemoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isFrench } = useI18n();
  const scenarios = useMemo(() => buildScenarios(isFrench), [isFrench]);

  const [scenarioId, setScenarioId] = useState<ScenarioId>('auto_pre_approve');
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
      aria-label="Expense Reimbursement Workflow Animated Demo"
    >
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-teal-500/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/40 flex items-center justify-center text-teal-300">
              <Film className="w-4.5 h-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                {isFrench
                  ? 'Démonstration Animée du Flux Remboursements & Politiques IA'
                  : 'Expense Reimbursement & Policy Engine Animated Workflow Demo'}
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-[10px] font-bold text-teal-300">
                  {isFrench ? 'Interactif' : 'Interactive'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isFrench
                  ? 'Simule la soumission chauffeur, le moteur Pre-Approved (SLA), la révision manuelle et le Copilote IA'
                  : 'Live simulation of Driver Submission, Auto Pre-Approve SLA, Manual Cap/Proof Gate, and AI Policy Assistant'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Close expense workflow demo"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Scenario Switcher + Controls */}
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

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setStepIndex((p) => (p - 1 + activeScenario.steps.length) % activeScenario.steps.length);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title="Previous Step"
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
              title="Next Step"
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
              title="Restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSpeedMs((prev) => (prev === 3200 ? 1800 : 3200))}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono cursor-pointer"
              title="Playback speed"
            >
              {speedMs === 3200 ? '1.0x' : '1.8x'}
            </button>
          </div>
        </div>

        {/* Summary & 4-Stage Pipeline */}
        <div className="px-5 py-3 bg-slate-950/50 border-b border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-300">{activeScenario.summary}</p>
            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${currentStep.statusColor}`}>
              {currentStep.stageLabel}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { idx: 1, label: isFrench ? '1. Soumission & Règles' : '1. Submit & Policy Check', icon: Receipt },
              { idx: 2, label: isFrench ? '2. Pré-approuvé (SLA)' : '2. Pre-Approved (SLA)', icon: Clock },
              { idx: 3, label: isFrench ? '3. Révision / IA' : '3. Review / AI Policy', icon: SlidersHorizontal },
              { idx: 4, label: isFrench ? '4. Approuvé → Paie' : '4. Approved → Payroll', icon: DollarSign },
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

        {/* Main Split Simulation */}
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
            {/* Left: Driver App / Policy Engine */}
            <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  {isFrench ? 'Driver App & Moteur de Règles' : 'Driver App & Policy Evaluator'}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                  {isFrench ? 'Temps réel' : 'Real-Time'}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[190px]">
                {currentStep.leftBubbles.map((b, i) => {
                  const isDriver = b.sender === 'driver';
                  const borderTone =
                    b.highlight === 'warning'
                      ? 'border-amber-500/50 bg-amber-950/40 text-amber-100'
                      : b.highlight === 'success'
                        ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                        : b.highlight === 'info'
                          ? 'border-sky-500/40 bg-sky-950/30 text-slate-100'
                          : 'border-slate-700 bg-slate-800/90 text-slate-200';

                  return (
                    <div
                      key={`${scenarioId}-${stepIndex}-left-${i}`}
                      className={`flex flex-col ${isDriver ? 'items-end' : 'items-start'} animate-[fadeIn_0.35s_ease-out]`}
                    >
                      <div
                        className={`max-w-[92%] rounded-xl px-3 py-2.5 text-xs border space-y-1 ${
                          isDriver ? 'bg-teal-600 border-teal-500 text-white' : borderTone
                        }`}
                      >
                        {b.badge && (
                          <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-90 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {b.badge}
                          </div>
                        )}
                        <div className="leading-relaxed">{b.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  {isFrench ? 'Statut Finance / Paie :' : 'Finance / Payroll Gate:'}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-teal-300 font-semibold">
                  {currentStep.payrollStatus}
                </span>
              </div>
            </div>

            {/* Right: Web Console Expense & Policies */}
            <div className="rounded-2xl bg-slate-950/70 border border-teal-500/30 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Bot className="w-4 h-4 text-teal-400" />
                  {isFrench ? 'Console Web · Remboursements & Politiques' : 'Web Console · Expense & Policy Desk'}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  HR / Fleet RBAC
                </span>
              </div>

              <div className="space-y-2.5 min-h-[190px]">
                {currentStep.rightFeed.map((ev, i) => {
                  const tone =
                    ev.type === 'approved'
                      ? 'bg-emerald-950/50 border-emerald-500/50'
                      : ev.type === 'pre_approved'
                        ? 'bg-cyan-950/40 border-cyan-500/40'
                        : ev.type === 'policy'
                          ? 'bg-violet-950/40 border-violet-500/40'
                          : 'bg-slate-900/90 border-slate-700';

                  return (
                    <div
                      key={`${scenarioId}-${stepIndex}-right-${i}`}
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
                    ? 'Arrondi financier à 2 décimales · Journal d’audit immuable'
                    : 'Half-up 2-decimal precision · Immutable policy audit logs'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Stepper */}
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
