import React from 'react';
import { useI18n } from '../../contexts/I18nContext';
import {
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
  PanelLeftOpen
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/permissions';
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
  onSelectTab: (tab: NavTab) => void;
  expiringLicenseCount: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  expiringLicenseCount,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { t, isFrench } = useI18n();
  const { currentUser } = useAuth();

  const activeDomainId = getDomainForTab(currentTab);
  const activeDomainDef =
    NAV_DOMAINS.find((d) => d.id === activeDomainId) || NAV_DOMAINS[0];

  const groups: NavGroupConfig[] = [
    {
      domain: 'dispatch_ops',
      title: t.nav.overview || (isFrench ? 'Aperçu' : 'Overview'),
      items: [
        {
          id: 'dashboard',
          label: t.nav.fleetPulse,
          icon: LayoutDashboard,
          badge: null
        }
      ]
    },
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

  const domainGroups = groups.filter((g) => g.domain === activeDomainId);

  return (
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

      {/* Domain Filtered Menu Items */}
      <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-4">
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
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    title={
                      isCollapsed
                        ? `${item.label}${item.badge ? ` (${item.badge})` : ''}`
                        : undefined
                    }
                    aria-label={item.label}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all relative group ${
                      isCollapsed
                        ? 'justify-center h-10 w-10 mx-auto'
                        : 'justify-between px-3 py-2.5'
                    } ${
                      isActive
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

                    {!isCollapsed && item.badge !== null && (
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          item.badgeColor || 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {item.badge}
                      </span>
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

      {/* Bottom Depot & Collapse Controls */}
      <div className="shrink-0 p-2.5 border-t border-slate-800 space-y-2">
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
  );
};
