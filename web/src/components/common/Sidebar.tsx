import React from 'react';
import { useI18n } from '../../contexts/I18nContext';
import {
  Bot,
  LayoutDashboard,
  Users,
  AlertTriangle,
  Settings,
  GraduationCap,
  Route as RouteIcon,
  Truck,
  School as SchoolIcon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CalendarDays,
  DollarSign,
  Building2,
  Radio,
  History,
  UserCheck,
  CalendarOff,
  Award,
  Wrench,
  ShieldAlert,
  Receipt,
  ClipboardCheck,
  FileSignature,
  PhoneCall,
  ArrowRightLeft,
  FileText,
  FileSpreadsheet,
  BadgeDollarSign,
  UserX,
  RefreshCw,
  Compass,
  GitBranch,
  FileCheck2,
  FileBadge,
  PanelLeftClose,
  PanelLeftOpen,
  Bookmark
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardPreferences } from '../../hooks/useDashboardPreferences';
import { QuickAccessSection } from '../dashboard/QuickAccessSection';
import { canEditPage, hasPageAccess, normalizeRole } from '../../utils/permissions';
import { openTimeOffApproverAgent } from '../time_off/TimeOffApproverAgentWindow';
import {
  NavDomainId,
  NAV_DOMAINS,
  getDomainForTab
} from '../../utils/navigationConfig';

export type NavTab =
  | 'dashboard'
  | 'dispatch'
  | 'charter'
  | 'routes'
  | 'staging_routes'
  | 'dispatch_payroll'
  | 'employees'
  | 'time_off'
  | 'payroll'
  | 'biweekly_payroll'
  | 'payroll_dept_log'
  | 'temporary_assignments'
  | 'dispatch_log'
  | 'assignment_history'
  | 'vehicles'
  | 'pretrip_checks'
  | 'vehicle_inspections'
  | 'defects'
  | 'vehicle_signouts'
  | 'yards'
  | 'compliance'
  | 'training'
  | 'students'
  | 'student_absences'
  | 'student_incidents'
  | 'hazards'
  | 'route_assessments'
  | 'schools'
  | 'calendar'
  | 'expenses'
  | 'company_contacts'
  | 'roles'
  | 'login_logs'
  | 'audit_logs'
  | 'error_logs'
  | 'external_sync'
  | 'settings';

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
  badgeColor?: string;
}

interface NavGroupConfig {
  domain: NavDomainId;
  title: string;
  items: NavItemConfig[];
}

interface SidebarProps {
  currentTab: NavTab;
  activeDomain?: NavDomainId;
  onSelectTab: (tab: NavTab) => void;
  expiringLicenseCount: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  activeDomain,
  onSelectTab,
  expiringLicenseCount,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { t, isFrench } = useI18n();
  const { currentUser } = useAuth();
  const { prefs, isSaving: isSavingPrefs, persistPrefs } = useDashboardPreferences();
  const [isQuickAccessOpen, setIsQuickAccessOpen] = React.useState(false);
  const [quickAccessHoverPos, setQuickAccessHoverPos] = React.useState<{
    left: number;
    bottom: number;
  } | null>(null);
  const [isFleetPulseDropTarget, setIsFleetPulseDropTarget] = React.useState(false);
  const [dragOverHomeTabId, setDragOverHomeTabId] = React.useState<NavTab | null>(null);
  const [pinToast, setPinToast] = React.useState<string | null>(null);
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    item: NavItemConfig;
  } | null>(null);
  const [hoverAnimPhase, setHoverAnimPhase] = React.useState(0);
  const [approverAgentState, setApproverAgentState] = React.useState<{
    activeCount: number;
    unreadCount: number;
    isOpen: boolean;
  }>({ activeCount: 0, unreadCount: 0, isOpen: false });

  const canApproveTimeOff = React.useMemo(() => {
    const role = normalizeRole(currentUser?.role);
    if (role === 'admin' || role === 'HR') return true;
    return canEditPage(currentUser, 'time_off');
  }, [currentUser]);

  React.useEffect(() => {
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent<{
        activeCount?: number;
        unreadCount?: number;
        isOpen?: boolean;
      }>;
      if (customEv.detail) {
        setApproverAgentState({
          activeCount: customEv.detail.activeCount ?? 0,
          unreadCount: customEv.detail.unreadCount ?? 0,
          isOpen: Boolean(customEv.detail.isOpen),
        });
      }
    };
    window.addEventListener('approver-agent-badge-update', handler);
    return () => window.removeEventListener('approver-agent-badge-update', handler);
  }, []);

  React.useEffect(() => {
    if (!quickAccessHoverPos) {
      setHoverAnimPhase(0);
      return;
    }
    const timer = window.setInterval(() => {
      setHoverAnimPhase((prev) => (prev + 1) % 4);
    }, 1300);
    return () => window.clearInterval(timer);
  }, [quickAccessHoverPos]);

  React.useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  const showQuickAccessTip = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setQuickAccessHoverPos({
      left: rect.right + 10,
      bottom: Math.max(12, window.innerHeight - rect.bottom),
    });
  };
  const hideQuickAccessTip = () => setQuickAccessHoverPos(null);

  const activeDomainId = activeDomain ?? getDomainForTab(currentTab);
  const activeDomainDef =
    NAV_DOMAINS.find((d) => d.id === activeDomainId) || NAV_DOMAINS[0];

  const groups: NavGroupConfig[] = [
    {
      domain: 'dispatch_ops',
      title: t.nav.dispatchGroup || (isFrench ? 'Répartition' : 'Dispatch'),
      items: [
        {
          id: 'dispatch',
          label: (t.nav as any).dispatch || (isFrench ? 'Console de répartition' : 'Dispatch Workbench'),
          icon: Radio,
          badge: null
        },
        {
          id: 'charter',
          label: isFrench ? 'Gestion des nolisés' : 'Charter Trips',
          icon: Compass,
          badge: null
        },
        {
          id: 'routes',
          label: t.nav.routeNetwork,
          icon: RouteIcon,
          badge: null
        },
        {
          id: 'staging_routes',
          label: isFrench ? 'Circuits staging' : 'Staging Routes',
          icon: GitBranch,
          badge: null
        },
        {
          id: 'dispatch_payroll',
          label: (t.nav as any).dispatchPayroll || (isFrench ? 'Paie de répartition' : 'Dispatch Payroll'),
          icon: BadgeDollarSign,
          badge: null
        }
      ]
    },
    {
      domain: 'dispatch_ops',
      title: t.nav.trackingGroup || (isFrench ? 'Suivi des opérations' : 'Operations Tracking'),
      items: [
        {
          id: 'temporary_assignments',
          label: t.nav.temporaryAssignments || (isFrench ? 'Affectations temporaires' : 'Temporary Assignments'),
          icon: UserCheck,
          badge: null
        },
        {
          id: 'dispatch_log',
          label: (t.nav as any).dispatchLog || (isFrench ? 'Journal des modifications' : 'Dispatch Change Log'),
          icon: History,
          badge: null
        },
        {
          id: 'assignment_history',
          label: isFrench ? 'Suivi des affectations' : 'Assignment Tracking',
          icon: ArrowRightLeft,
          badge: null
        }
      ]
    },
    {
      domain: 'hr_payroll',
      title: t.nav.hrGroup || (isFrench ? 'Ressources humaines (RH)' : 'Human Resources (HR)'),
      items: [
        {
          id: 'employees',
          label: t.nav.employees,
          icon: Users,
          badge: null
        },
        {
          id: 'time_off',
          label: t.nav.timeOff || (isFrench ? 'Demandes de congé' : 'Time Off Requests'),
          icon: CalendarOff,
          badge: null
        }
      ]
    },
    {
      domain: 'hr_payroll',
      title: t.nav.payrollGroup || (isFrench ? 'Paie et finances' : 'Payroll & Finance'),
      items: [
        {
          id: 'payroll',
          label: t.nav.payroll,
          icon: DollarSign,
          badge: null
        },
        {
          id: 'biweekly_payroll',
          label: (t.nav as any).biweeklyPayroll || (isFrench ? 'Paie aux deux semaines' : 'Bi-Weekly Payroll'),
          icon: FileSpreadsheet,
          badge: null
        },
        {
          id: 'payroll_dept_log',
          label: (t.nav as any).payrollDeptLog || (isFrench ? 'Journal du service de paie' : 'Payroll Department Log'),
          icon: FileCheck2,
          badge: null
        },
        {
          id: 'expenses',
          label: isFrench ? 'Notes de frais' : 'Expense Claims',
          icon: Receipt,
          badge: null
        }
      ]
    },
    {
      domain: 'fleet',
      title: t.nav.fleetGroup || (isFrench ? 'Flotte et dépôt' : 'Fleet & Depot'),
      items: [
        {
          id: 'vehicles',
          label: t.nav.vehicles,
          icon: Truck,
          badge: null
        },
        {
          id: 'pretrip_checks',
          label: isFrench ? 'Contrôles avant départ (Pre-Trip)' : 'Pre-Trip Inspections',
          icon: ClipboardCheck,
          badge: null
        },
        {
          id: 'vehicle_inspections',
          label: isFrench ? 'Inspections mécaniques' : 'Mechanical Inspections',
          icon: ShieldCheck,
          badge: null
        },
        {
          id: 'defects',
          label: isFrench ? 'Défectuosités véhicules' : 'Vehicle Defects',
          icon: Wrench,
          badge: null
        },
        {
          id: 'vehicle_signouts',
          label: isFrench ? 'Remise des véhicules' : 'Vehicle Handover',
          icon: FileSignature,
          badge: null
        },
        {
          id: 'yards',
          label: (t.nav as any).yards || (isFrench ? 'Dépôts' : 'Yards'),
          icon: Building2,
          badge: null
        }
      ]
    },
    {
      domain: 'students_safety',
      title: t.nav.safetyGroup || (isFrench ? 'Sécurité et élèves' : 'Safety & Students'),
      items: [
        {
          id: 'compliance',
          label: t.nav.compliance,
          icon: FileBadge,
          badge: expiringLicenseCount > 0 ? expiringLicenseCount : null,
          badgeColor: 'bg-amber-500 text-slate-950'
        },
        {
          id: 'training',
          label: t.nav.training || (isFrench ? 'Formations et cours' : 'Training & Courses'),
          icon: Award,
          badge: null
        },
        {
          id: 'students',
          label: t.nav.students,
          icon: GraduationCap,
          badge: null
        },
        {
          id: 'student_absences',
          label: isFrench ? 'Absences des élèves' : 'Student Absences',
          icon: UserX,
          badge: null
        },
        {
          id: 'student_incidents',
          label: isFrench ? "Incidents d'élèves" : 'Student Incidents',
          icon: ShieldAlert,
          badge: null
        },
        {
          id: 'hazards',
          label: isFrench ? 'Rapports de dangers' : 'Hazard Reports',
          icon: AlertTriangle,
          badge: null
        },
        {
          id: 'route_assessments',
          label: isFrench ? 'Évaluations de circuits' : 'Route Assessments',
          icon: ClipboardCheck,
          badge: null
        }
      ]
    },
    {
      domain: 'students_safety',
      title: t.nav.schoolsGroup || (isFrench ? 'Écoles et calendrier' : 'Schools & Calendar'),
      items: [
        {
          id: 'schools',
          label: t.nav.schools,
          icon: SchoolIcon,
          badge: null
        },
        {
          id: 'calendar',
          label: t.nav.calendar,
          icon: CalendarDays,
          badge: null
        }
      ]
    },
    {
      domain: 'system',
      title: t.nav.system,
      items: [
        {
          id: 'company_contacts',
          label: isFrench ? "Contacts de l'entreprise" : 'Company Contacts',
          icon: PhoneCall,
          badge: null
        },
        {
          id: 'roles',
          label: isFrench ? 'Rôles et permissions' : 'Roles & Permissions',
          icon: ShieldCheck,
          badge: null
        },
        {
          id: 'login_logs',
          label: isFrench ? 'Journaux de connexion' : 'Login Audit Logs',
          icon: History,
          badge: null
        },
        {
          id: 'audit_logs',
          label: isFrench ? "Journaux d'audit système" : 'System Audit Logs',
          icon: FileText,
          badge: null
        },
        {
          id: 'error_logs',
          label: isFrench ? "Journaux d'erreurs client" : 'Client Error Logs',
          icon: AlertTriangle,
          badge: null
        },
        {
          id: 'external_sync',
          label: isFrench ? 'Synchronisation externe' : 'External Sync',
          icon: RefreshCw,
          badge: null
        },
        {
          id: 'settings',
          label: t.nav.settings,
          icon: Settings,
          badge: null
        }
      ]
    }
  ];

  const itemLookup = React.useMemo(() => {
    const map = new Map<NavTab, NavItemConfig>();
    for (const group of groups) {
      for (const item of group.items) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [groups]);

  const quickAccessItems: NavItemConfig[] = React.useMemo(() => {
    const list: NavItemConfig[] = [];
    for (const tabId of prefs.pinnedPages ?? []) {
      if (!hasPageAccess(currentUser, tabId)) continue;
      const item = itemLookup.get(tabId);
      if (item) list.push(item);
    }
    return list;
  }, [prefs.pinnedPages, currentUser, itemLookup]);

  const pinTabToHome = React.useCallback(
    async (tabId: NavTab) => {
      if (tabId === 'dashboard' || !hasPageAccess(currentUser, tabId)) return;
      const item = itemLookup.get(tabId);
      if (!item) return;
      const existing = prefs.pinnedPages ?? [];
      if (existing.includes(tabId)) {
        setPinToast(
          isFrench
            ? `« ${item.label} » est déjà épinglé sur Home`
            : `"${item.label}" is already pinned to Home`
        );
        window.setTimeout(() => setPinToast(null), 2400);
        return;
      }
      await persistPrefs({
        ...prefs,
        pinnedPages: [...existing, tabId],
      });
      setPinToast(
        isFrench
          ? `« ${item.label} » ajouté à Home`
          : `Added "${item.label}" to Home Quick Access`
      );
      window.setTimeout(() => setPinToast(null), 2600);
    },
    [currentUser, itemLookup, prefs, persistPrefs, isFrench]
  );

  const unpinTabFromHome = React.useCallback(
    async (tabId: NavTab) => {
      const existing = prefs.pinnedPages ?? [];
      if (!existing.includes(tabId)) return;
      const item = itemLookup.get(tabId);
      await persistPrefs({
        ...prefs,
        pinnedPages: existing.filter((id) => id !== tabId),
      });
      if (item) {
        setPinToast(
          isFrench
            ? `« ${item.label} » retiré de Home`
            : `Removed "${item.label}" from Home`
        );
        window.setTimeout(() => setPinToast(null), 2200);
      }
    },
    [itemLookup, prefs, persistPrefs, isFrench]
  );

  const reorderHomeTabs = React.useCallback(
    async (draggedId: NavTab, targetId: NavTab) => {
      if (draggedId === targetId) return;
      const existing = [...(prefs.pinnedPages ?? [])];
      const fromIdx = existing.indexOf(draggedId);
      const toIdx = existing.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      existing.splice(fromIdx, 1);
      existing.splice(toIdx, 0, draggedId);
      await persistPrefs({
        ...prefs,
        pinnedPages: existing,
      });
    },
    [prefs, persistPrefs]
  );

  React.useEffect(() => {
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent<{ tabId?: NavTab }>;
      if (customEv.detail?.tabId) {
        void pinTabToHome(customEv.detail.tabId);
      }
    };
    window.addEventListener('pin-nav-tab-to-home', handler);
    return () => window.removeEventListener('pin-nav-tab-to-home', handler);
  }, [pinTabToHome]);

  const domainGroups: NavGroupConfig[] =
    activeDomainId === 'home'
      ? [
          {
            domain: 'home',
            title: isFrench ? 'Mes raccourcis rapides' : 'My Quick Access',
            items: quickAccessItems,
          },
        ]
      : groups.filter((g) => g.domain === activeDomainId);

  return (
    <>
    <aside
      aria-label={isFrench ? 'Menu secondaire du domaine' : 'Domain secondary navigation'}
      className={`hidden md:flex flex-col flex-shrink-0 h-full overflow-hidden bg-slate-900 border-r border-slate-800 transition-all duration-300 z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Active Domain Header & Quick Collapse Toggle */}
      <div
        className={`shrink-0 h-12 border-b border-slate-800/80 flex items-center ${
          isCollapsed ? 'justify-center px-1' : 'justify-between px-3.5'
        }`}
      >
        {!isCollapsed && (
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 truncate">
              {isFrench ? activeDomainDef.labelFr : activeDomainDef.labelEn}
            </span>
          </div>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={
              isCollapsed
                ? isFrench
                  ? 'Développer le menu (Ctrl+B)'
                  : 'Expand menu (Ctrl+B)'
                : isFrench
                  ? 'Réduire en barre d’icônes (Ctrl+B)'
                  : 'Collapse to icon bar (Ctrl+B)'
            }
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Pinned Fleet Pulse Home Shortcut (also acts as Drop Target for pinning items to Home) */}
      {(hasPageAccess(currentUser, 'dashboard') || canApproveTimeOff) && (
        <div className="shrink-0 px-2 pt-2.5 pb-2 border-b border-slate-800/80 space-y-1.5">
          {hasPageAccess(currentUser, 'dashboard') && (
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('application/x-dispatch-nav-tab')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setIsFleetPulseDropTarget(true);
              }
            }}
            onDragLeave={() => setIsFleetPulseDropTarget(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsFleetPulseDropTarget(false);
              const tabId = e.dataTransfer.getData('application/x-dispatch-nav-tab') as NavTab;
              if (tabId) {
                void pinTabToHome(tabId);
              }
            }}
            title={isCollapsed ? t.nav.fleetPulse : undefined}
            aria-label={t.nav.fleetPulse}
            className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              isCollapsed
                ? 'justify-center h-10 w-10 mx-auto'
                : 'justify-between px-3 py-2.5'
            } ${
              isFleetPulseDropTarget
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400 ring-2 ring-amber-400/50'
                : currentTab === 'dashboard'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                  : 'text-slate-200 bg-slate-800/40 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            {isCollapsed && currentTab === 'dashboard' && (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-amber-400" />
            )}
            <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
              <LayoutDashboard
                className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                  currentTab === 'dashboard' ? 'text-amber-400' : 'text-amber-400/80 group-hover:text-amber-400'
                }`}
              />
              {!isCollapsed && <span className="truncate">{t.nav.fleetPulse}</span>}
            </div>
          </button>
          )}

          {canApproveTimeOff && (
            <button
              type="button"
              onClick={() => openTimeOffApproverAgent({ toggle: true })}
              title={
                isCollapsed
                  ? `${isFrench ? 'Agent Approbateur' : 'Approver AI Agent'} (${
                      approverAgentState.unreadCount > 0
                        ? `+${approverAgentState.unreadCount}`
                        : approverAgentState.activeCount
                    })`
                  : undefined
              }
              aria-label={isFrench ? 'Agent IA Approbateur' : 'Approver AI Agent'}
              className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
                isCollapsed
                  ? 'justify-center h-10 w-10 mx-auto'
                  : 'justify-between px-3 py-2'
              } ${
                approverAgentState.unreadCount > 0
                  ? 'bg-rose-500/15 text-rose-200 border border-rose-500/50 shadow-sm shadow-rose-500/20 animate-pulse'
                  : approverAgentState.isOpen
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm shadow-teal-500/10'
                    : 'text-slate-200 bg-slate-800/40 hover:bg-slate-800 hover:text-teal-200 border border-slate-800'
              }`}
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                <Bot
                  className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                    approverAgentState.unreadCount > 0
                      ? 'text-rose-400 animate-bounce'
                      : 'text-teal-400'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate">
                    {isFrench ? 'Agent Approbateur' : 'Approver AI Agent'}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full border ${
                    approverAgentState.unreadCount > 0
                      ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                      : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                  }`}
                >
                  {approverAgentState.unreadCount > 0
                    ? `+${approverAgentState.unreadCount}`
                    : approverAgentState.activeCount}
                </span>
              )}
              {isCollapsed && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-extrabold ring-2 ring-slate-900 ${
                    approverAgentState.unreadCount > 0
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-teal-600 text-white'
                  }`}
                >
                  {approverAgentState.unreadCount > 0
                    ? `+${approverAgentState.unreadCount}`
                    : approverAgentState.activeCount}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Domain Filtered Menu Items */}
      <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-4">
        {activeDomainId === 'home' && quickAccessItems.length === 0 && !isCollapsed && (
          <div className="px-3 py-2.5 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <div className="font-bold text-slate-300 uppercase tracking-wider text-[10px] mb-1">
              {isFrench ? 'Mes raccourcis rapides' : 'My Quick Access'}
            </div>
            {isFrench
              ? 'Épinglez vos pages fréquentes sur l’accueil pour les voir ici.'
              : 'Pin your frequent pages on Home to see shortcuts here.'}
          </div>
        )}
        {domainGroups.map((group, groupIdx) => {
          const visibleItems = group.items.filter((item) => hasPageAccess(currentUser, item.id));
          if (visibleItems.length === 0) return null;

          return (
            <div key={groupIdx} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span className="truncate">{group.title}</span>
                  <span className="w-6 h-px bg-slate-800 flex-shrink-0 ml-2" />
                </div>
              ) : (
                groupIdx > 0 && <div className="w-6 h-px bg-slate-800 mx-auto my-2" />
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                const isPinned = (prefs.pinnedPages ?? []).includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      if (activeDomainId === 'home') {
                        e.dataTransfer.setData('application/x-dispatch-home-reorder', item.id);
                        e.dataTransfer.effectAllowed = 'move';
                      } else {
                        e.dataTransfer.setData('application/x-dispatch-nav-tab', item.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }
                    }}
                    onDragOver={(e) => {
                      if (
                        activeDomainId === 'home' &&
                        e.dataTransfer.types.includes('application/x-dispatch-home-reorder')
                      ) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverHomeTabId !== item.id) {
                          setDragOverHomeTabId(item.id);
                        }
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverHomeTabId === item.id) {
                        setDragOverHomeTabId(null);
                      }
                    }}
                    onDrop={(e) => {
                      if (activeDomainId === 'home') {
                        const draggedId = e.dataTransfer.getData(
                          'application/x-dispatch-home-reorder'
                        ) as NavTab;
                        setDragOverHomeTabId(null);
                        if (draggedId) {
                          e.preventDefault();
                          void reorderHomeTabs(draggedId, item.id);
                        }
                      }
                    }}
                    onDragEnd={() => setDragOverHomeTabId(null)}
                    onClick={() => onSelectTab(item.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: Math.min(e.clientX, window.innerWidth - 210),
                        y: Math.min(e.clientY, window.innerHeight - 110),
                        item,
                      });
                    }}
                    onDoubleClick={(e) => {
                      if (activeDomainId !== 'home') {
                        e.preventDefault();
                        void pinTabToHome(item.id);
                      }
                    }}
                    title={
                      isCollapsed
                        ? `${item.label}${item.badge ? ` (${item.badge})` : ''}`
                        : activeDomainId !== 'home'
                          ? isFrench
                            ? 'Double-cliquez ou glissez vers Home pour épingler'
                            : 'Double-click or drag onto Home to pin'
                          : undefined
                    }
                    aria-label={item.label}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all relative group ${
                      isCollapsed
                        ? 'justify-center h-10 w-10 mx-auto'
                        : 'justify-between px-3 py-2.5'
                    } ${
                      activeDomainId === 'home' && dragOverHomeTabId === item.id
                        ? 'ring-2 ring-amber-400 bg-amber-500/20 text-amber-200'
                        : isActive
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    {isCollapsed && isActive && (
                      <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-amber-400" />
                    )}

                    <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center space-x-1 shrink-0">
                        {activeDomainId === 'home' ? (
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              void unpinTabFromHome(item.id);
                            }}
                            title={isFrench ? 'Retirer de Home' : 'Unpin from Home'}
                            className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-rose-300 hover:bg-slate-700/80 transition"
                          >
                            ×
                          </span>
                        ) : isPinned ? (
                          <span
                            className="text-[10px] text-amber-400/80"
                            title={isFrench ? 'Épinglé sur Home' : 'Pinned to Home'}
                          >
                            ★
                          </span>
                        ) : null}
                        {item.badge !== null && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              item.badgeColor || 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}

                    {isCollapsed && item.badge !== null && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Bottom Depot, Quick Access Customizer & Collapse Controls */}
      <div className="shrink-0 p-2.5 border-t border-slate-800 space-y-2">
        <button
          type="button"
          onClick={() => {
            hideQuickAccessTip();
            setIsQuickAccessOpen(true);
          }}
          onMouseEnter={(e) => showQuickAccessTip(e.currentTarget)}
          onMouseLeave={hideQuickAccessTip}
          onFocus={(e) => showQuickAccessTip(e.currentTarget)}
          onBlur={hideQuickAccessTip}
          aria-label={isFrench ? 'Personnaliser My Quick Access' : 'Customize My Quick Access'}
          className={`w-full flex items-center rounded-xl text-xs font-semibold transition border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-amber-500/30 text-slate-200 hover:text-amber-300 cursor-pointer ${
            isCollapsed ? 'justify-center h-9 w-9 mx-auto' : 'justify-between px-2.5 py-2'
          }`}
        >
          <span className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'space-x-2'}`}>
            <Bookmark className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            {!isCollapsed && (
              <span className="truncate text-[11px]">
                {isFrench ? 'My Quick Access' : 'My Quick Access'}
              </span>
            )}
          </span>
          {!isCollapsed && quickAccessItems.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {quickAccessItems.length}
            </span>
          )}
        </button>

        {!isCollapsed && (
          <div className="px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center space-x-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
              <span className="truncate">HQ-Central (Active)</span>
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          </div>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={
              isCollapsed
                ? isFrench
                  ? 'Développer le menu (Ctrl+B)'
                  : 'Expand sidebar (Ctrl+B)'
                : isFrench
                  ? 'Réduire en icônes (Ctrl+B)'
                  : 'Collapse to icon bar (Ctrl+B)'
            }
            className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-semibold space-x-2"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[11px]">
                  {isFrench ? 'Réduire en icônes' : 'Collapse Menu'}
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>

    {pinToast && (
      <div
        role="status"
        className="fixed bottom-16 left-4 z-[90] px-3.5 py-2 rounded-xl bg-slate-900/95 border border-amber-500/50 text-amber-200 text-xs font-semibold shadow-2xl backdrop-blur-md animate-[fadeIn_0.2s_ease-out]"
      >
        ★ {pinToast}
      </div>
    )}

    {contextMenu && (
      <div
        role="menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-[95] w-48 py-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-xs text-slate-200 backdrop-blur-md"
      >
        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate border-b border-slate-800 mb-1">
          {contextMenu.item.label}
        </div>
        <button
          type="button"
          onClick={() => {
            onSelectTab(contextMenu.item.id);
            setContextMenu(null);
          }}
          className="w-full px-3 py-1.5 text-left hover:bg-slate-800 hover:text-white transition cursor-pointer"
        >
          {isFrench ? 'Ouvrir la page' : 'Open Page'}
        </button>
        {(prefs.pinnedPages ?? []).includes(contextMenu.item.id) ? (
          <button
            type="button"
            onClick={() => {
              void unpinTabFromHome(contextMenu.item.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-rose-300 hover:bg-rose-500/15 transition cursor-pointer font-semibold"
          >
            {isFrench ? 'Retirer de Home' : 'Remove from Home'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              void pinTabToHome(contextMenu.item.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-amber-300 hover:bg-amber-500/15 transition cursor-pointer font-semibold"
          >
            ★ {isFrench ? 'Épingler sur Home' : 'Pin to Home'}
          </button>
        )}
      </div>
    )}

    {quickAccessHoverPos && !isQuickAccessOpen && (
      <div
        role="tooltip"
        style={{
          left: quickAccessHoverPos.left,
          bottom: quickAccessHoverPos.bottom,
        }}
        className="fixed z-50 w-80 pointer-events-none rounded-2xl bg-slate-900/95 backdrop-blur-md border border-amber-500/40 shadow-2xl shadow-black/50 p-3.5 text-slate-100 animate-in fade-in slide-in-from-left-2 duration-200"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5">
            <Bookmark className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span className="text-xs font-bold text-white">My Quick Access</span>
          </div>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {isFrench ? 'Synchronisé' : 'Synced'}
          </span>
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed mb-2.5">
          {isFrench
            ? 'Glissez ou double-cliquez (ou clic droit) sur un menu pour l’ajouter à Home, puis glissez dans Home pour réorganiser.'
            : 'Drag, double-click, or right-click any menu item to pin to Home — then drag inside Home to reorder.'}
        </p>

        {/* Animated Mini Demo 1: Drag Menu Item -> Home */}
        <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-2.5 space-y-2.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <span>{isFrench ? '1. Glisser vers Home' : '1. Drag to Home'}</span>
              <span className="text-amber-400">
                {hoverAnimPhase >= 2
                  ? isFrench
                    ? '★ Épinglé !'
                    : '★ Pinned!'
                  : isFrench
                    ? 'Glisser / Double-clic'
                    : 'Drag / Double-Click'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all duration-500 ${
                  hoverAnimPhase === 1
                    ? 'translate-x-5 -translate-y-1 scale-105 bg-amber-500/25 text-amber-200 border-amber-400 shadow-md shadow-amber-500/20'
                    : hoverAnimPhase >= 2
                      ? 'bg-slate-800/60 text-slate-400 border-slate-700'
                      : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                {hoverAnimPhase === 1 ? '✋ ' : ''}
                {isFrench ? 'Congés' : 'Time Off'}
              </span>
              <span className="text-[10px] text-slate-500">→</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all duration-500 ${
                  hoverAnimPhase === 1
                    ? 'bg-amber-500/30 text-amber-200 border-amber-400 ring-2 ring-amber-400/50'
                    : hoverAnimPhase >= 2
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-amber-300 border-slate-700'
                }`}
              >
                🏠 Home {hoverAnimPhase >= 2 ? '★' : ''}
              </span>
            </div>
          </div>

          {/* Animated Mini Demo 2: Drag inside Home to Reorder */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <span>{isFrench ? '2. Réorganiser dans Home' : '2. Drag on Home to Reorder'}</span>
              <span className="text-teal-300">
                {hoverAnimPhase === 3
                  ? isFrench
                    ? 'Ordre sauvé ✓'
                    : 'Order Saved ✓'
                  : isFrench
                    ? 'Glisser-déposer'
                    : 'Drag & Drop'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              {(hoverAnimPhase >= 2
                ? [
                    { id: 'time_off', label: isFrench ? 'Congés' : 'Time Off', highlight: hoverAnimPhase === 2 },
                    { id: 'employees', label: isFrench ? 'Employés' : 'Employees', highlight: false },
                    { id: 'training', label: isFrench ? 'Formation' : 'Training', highlight: false },
                  ]
                : [
                    { id: 'employees', label: isFrench ? 'Employés' : 'Employees', highlight: false },
                    { id: 'time_off', label: isFrench ? 'Congés' : 'Time Off', highlight: hoverAnimPhase === 1 },
                    { id: 'training', label: isFrench ? 'Formation' : 'Training', highlight: false },
                  ]
              ).map((pill) => (
                <span
                  key={pill.id}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-all duration-500 ${
                    pill.highlight
                      ? 'bg-amber-500/25 text-amber-200 border-amber-400 scale-105 ring-1 ring-amber-400/50'
                      : pill.id === 'time_off' && hoverAnimPhase === 3
                        ? 'bg-teal-500/20 text-teal-200 border-teal-400/50'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {pill.highlight ? '✋ ' : ''}
                  {pill.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}

    {isQuickAccessOpen && (
      <div
        className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setIsQuickAccessOpen(false)}
      >
        <div
          className="w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <QuickAccessSection
            currentUser={currentUser}
            prefs={prefs}
            isSaving={isSavingPrefs}
            onUpdatePrefs={persistPrefs}
            onNavigateTab={(tab) => {
              onSelectTab(tab);
              setIsQuickAccessOpen(false);
            }}
            defaultEditing
            onClose={() => setIsQuickAccessOpen(false)}
          />
        </div>
      </div>
    )}
    </>
  );
};
