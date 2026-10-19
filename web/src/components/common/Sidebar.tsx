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
  UserX
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/permissions';

export type NavTab =
  | 'dashboard'
  | 'dispatch'
  | 'routes'
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
  | 'settings';

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
  badgeColor?: string;
}

interface NavGroupConfig {
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

  const groups: NavGroupConfig[] = [
    {
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
      title: t.nav.dispatchGroup || (isFrench ? 'Répartition' : 'Dispatch'),
      items: [
        {
          id: 'dispatch',
          label: (t.nav as any).dispatch || (isFrench ? 'Console de répartition' : 'Dispatch Workbench'),
          icon: Radio,
          badge: null
        },
        {
          id: 'routes',
          label: t.nav.routeNetwork,
          icon: RouteIcon,
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
          icon: Receipt,
          badge: null
        }
      ]
    },
    {
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
      title: t.nav.fleetGroup || (isFrench ? 'Flotte et dépôt' : 'Fleet & Depot'),
      items: [
        {
          id: 'vehicles',
          label: t.nav.vehicles,
          icon: Truck,
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
      title: t.nav.safetyGroup || (isFrench ? 'Sécurité et élèves' : 'Safety & Students'),
      items: [
        {
          id: 'compliance',
          label: t.nav.compliance,
          icon: AlertTriangle,
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
          label: isFrench ? 'Incidents d\'élèves' : 'Student Incidents',
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
      title: t.nav.system,
      items: [
        {
          id: 'expenses',
          label: isFrench ? 'Notes de frais' : 'Expense Claims',
          icon: Receipt,
          badge: null
        },
        {
          id: 'company_contacts',
          label: isFrench ? 'Contacts de l\'entreprise' : 'Company Contacts',
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
          label: isFrench ? 'Journaux d\'audit système' : 'System Audit Logs',
          icon: FileText,
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

  return (
    <aside
      className={`hidden md:flex flex-col justify-between flex-shrink-0 bg-slate-900 border-r border-slate-800 transition-all duration-300 min-h-[calc(100vh-4rem)] z-20 ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      <div className="py-4 px-2 space-y-5">
        {groups.map((group, groupIdx) => {
          const visibleItems = group.items.filter((item) => hasPageAccess(currentUser, item.id));
          if (visibleItems.length === 0) return null;

          return (
            <div key={groupIdx} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-3 pb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>{group.title}</span>
                  <span className="w-8 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="h-2" />
              )}

              {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={isCollapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all relative group ${
                    isCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                    <Icon
                      className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge !== null && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${item.badgeColor || 'bg-amber-500 text-slate-950'}`}>
                      {item.badge}
                    </span>
                  )}

                  {isCollapsed && item.badge !== null && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>

      {/* Bottom Depot & Collapse Controls */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        {!isCollapsed && (
          <div className="px-2 py-2 rounded-lg bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center space-x-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
              <span className="truncate">HQ-Central (Active)</span>
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          </div>
        )}

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-semibold space-x-2"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[11px]">Collapse Menu</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
};
