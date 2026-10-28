import React from 'react';
import { NavTab } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import { hasPageAccess } from '../../utils/permissions';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Settings,
  GraduationCap,
  Route as RouteIcon,
  Truck,
  School as SchoolIcon,
  X,
  LogOut,
  ShieldCheck,
  Building2,
  Globe,
  Sun,
  Moon,
  CalendarDays,
  DollarSign,
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
  RefreshCw
} from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  expiringLicenseCount: number;
}

interface MobileNavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  expiringLicenseCount
}) => {
  const { currentUser, isMockMode, logout } = useAuth();
  const { lang, setLang, t, isFrench } = useI18n();
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    onClose();
  };

  const sections: { title: string; items: MobileNavItem[] }[] = [
    {
      title: t.nav.overview || (isFrench ? 'Aperçu' : 'Overview'),
      items: [
        { id: 'dashboard' as NavTab, label: t.nav.fleetPulse, icon: LayoutDashboard }
      ]
    },
    {
      title: t.nav.dispatchGroup || (isFrench ? 'Répartition' : 'Dispatch'),
      items: [
        { id: 'dispatch' as NavTab, label: (t.nav as any).dispatch || (isFrench ? 'Console de répartition' : 'Dispatch Workbench'), icon: Radio },
        { id: 'routes' as NavTab, label: t.nav.routeNetwork, icon: RouteIcon },
        { id: 'staging_routes' as NavTab, label: isFrench ? 'Circuits staging' : 'Staging Routes', icon: RouteIcon },
        { id: 'dispatch_payroll' as NavTab, label: (t.nav as any).dispatchPayroll || (isFrench ? 'Paie de répartition' : 'Dispatch Payroll'), icon: BadgeDollarSign }
      ]
    },
    {
      title: t.nav.hrGroup || (isFrench ? 'Ressources humaines (RH)' : 'Human Resources (HR)'),
      items: [
        { id: 'employees' as NavTab, label: t.nav.employees, icon: Users },
        { id: 'time_off' as NavTab, label: t.nav.timeOff || (isFrench ? 'Demandes de congé' : 'Time Off Requests'), icon: CalendarOff }
      ]
    },
    {
      title: t.nav.payrollGroup || (isFrench ? 'Paie et finances' : 'Payroll & Finance'),
      items: [
        { id: 'payroll' as NavTab, label: t.nav.payroll, icon: DollarSign },
        { id: 'biweekly_payroll' as NavTab, label: (t.nav as any).biweeklyPayroll || (isFrench ? 'Paie aux deux semaines' : 'Bi-Weekly Payroll'), icon: FileSpreadsheet },
        { id: 'payroll_dept_log' as NavTab, label: (t.nav as any).payrollDeptLog || (isFrench ? 'Journal du service de paie' : 'Payroll Department Log'), icon: Receipt }
      ]
    },
    {
      title: t.nav.trackingGroup || (isFrench ? 'Suivi des opérations' : 'Operations Tracking'),
      items: [
        { id: 'temporary_assignments' as NavTab, label: t.nav.temporaryAssignments || (isFrench ? 'Affectations temporaires' : 'Temporary Assignments'), icon: UserCheck },
        { id: 'dispatch_log' as NavTab, label: (t.nav as any).dispatchLog || (isFrench ? 'Journal des modifications' : 'Dispatch Change Log'), icon: History },
        { id: 'assignment_history' as NavTab, label: isFrench ? 'Suivi des affectations' : 'Assignment Tracking', icon: ArrowRightLeft }
      ]
    },
    {
      title: t.nav.fleetGroup || (isFrench ? 'Flotte et dépôt' : 'Fleet & Depot'),
      items: [
        { id: 'vehicles' as NavTab, label: t.nav.vehicles, icon: Truck, badge: null },
        { id: 'pretrip_checks' as NavTab, label: isFrench ? 'Contrôles avant départ (Pre-Trip)' : 'Pre-Trip Inspections', icon: ClipboardCheck, badge: null },
        { id: 'vehicle_inspections' as NavTab, label: isFrench ? 'Inspections mécaniques' : 'Mechanical Inspections', icon: ShieldCheck, badge: null },
        { id: 'defects' as NavTab, label: isFrench ? 'Défectuosités véhicules' : 'Vehicle Defects', icon: Wrench },
        { id: 'vehicle_signouts' as NavTab, label: isFrench ? 'Remise des véhicules' : 'Vehicle Handover', icon: FileSignature },
        { id: 'yards' as NavTab, label: (t.nav as any).yards || (isFrench ? 'Dépôts' : 'Yards'), icon: Building2, badge: null }
      ]
    },
    {
      title: t.nav.safetyGroup || (isFrench ? 'Sécurité et élèves' : 'Safety & Students'),
      items: [
        {
          id: 'compliance' as NavTab,
          label: t.nav.compliance,
          icon: AlertTriangle,
          badge: expiringLicenseCount > 0 ? expiringLicenseCount : null
        },
        { id: 'training' as NavTab, label: t.nav.training || (isFrench ? 'Formations et cours' : 'Training & Courses'), icon: Award },
        { id: 'students' as NavTab, label: t.nav.students, icon: GraduationCap },
        { id: 'student_absences' as NavTab, label: isFrench ? 'Absences des élèves' : 'Student Absences', icon: UserX },
        { id: 'student_incidents' as NavTab, label: isFrench ? 'Incidents d\'élèves' : 'Student Incidents', icon: ShieldAlert },
        { id: 'hazards' as NavTab, label: isFrench ? 'Rapports de dangers' : 'Hazard Reports', icon: AlertTriangle },
        { id: 'route_assessments' as NavTab, label: isFrench ? 'Évaluations de circuits' : 'Route Assessments', icon: ClipboardCheck }
      ]
    },
    {
      title: t.nav.schoolsGroup || (isFrench ? 'Écoles et calendrier' : 'Schools & Calendar'),
      items: [
        { id: 'schools' as NavTab, label: t.nav.schools, icon: SchoolIcon },
        { id: 'calendar' as NavTab, label: t.nav.calendar, icon: CalendarDays }
      ]
    },
    {
      title: t.nav.system,
      items: [
        { id: 'expenses' as NavTab, label: isFrench ? 'Notes de frais' : 'Expense Claims', icon: Receipt },
        { id: 'company_contacts' as NavTab, label: isFrench ? 'Contacts de l\'entreprise' : 'Company Contacts', icon: PhoneCall, badge: null },
        { id: 'roles' as NavTab, label: isFrench ? 'Rôles et permissions' : 'Roles & Permissions', icon: ShieldCheck },
        { id: 'login_logs' as NavTab, label: isFrench ? 'Journaux de connexion' : 'Login Audit Logs', icon: History },
        { id: 'audit_logs' as NavTab, label: isFrench ? 'Journaux d\'audit système' : 'System Audit Logs', icon: FileText },
        { id: 'external_sync' as NavTab, label: isFrench ? 'Synchronisation externe' : 'External Sync', icon: RefreshCw },
        { id: 'settings' as NavTab, label: t.nav.settings, icon: Settings }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden bg-slate-950/70 backdrop-blur-sm flex justify-start">
      <div className="w-4/5 max-w-xs bg-slate-900 border-r border-slate-800 text-slate-100 h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200">
        <div>
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-white">DISPATCH HUB</span>
                <p className="text-[10px] text-slate-400">Operations Console</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped Links */}
          <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
            {sections.map((sec, idx) => {
              const visibleItems = sec.items.filter((item) => hasPageAccess(currentUser, item.id));
              if (visibleItems.length === 0) return null;

              return (
                <div key={idx} className="space-y-1">
                  <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {sec.title}
                  </span>

                  {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>

                      {item.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>

        {/* Footer with User info & logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-xs">
              {currentUser?.displayName?.slice(0, 2).toUpperCase() || 'OP'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {currentUser?.displayName || currentUser?.email || 'Dispatcher'}
              </p>
              <div className="flex items-center space-x-1 text-[10px] text-amber-400">
                <ShieldCheck className="w-3 h-3" />
                <span className="uppercase">{currentUser?.role || 'Admin'}</span>
                {isMockMode && <span>(Demo)</span>}
              </div>
            </div>
          </div>

          {/* Mobile Theme Switcher */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
            <span className="text-slate-400 flex items-center space-x-1.5 text-xs">
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{t.theme.theme}</span>
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition flex items-center space-x-1 ${
                  theme === 'light'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>{t.theme.light}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition flex items-center space-x-1 ${
                  theme === 'dark'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>{t.theme.dark}</span>
              </button>
            </div>
          </div>

          {/* Mobile Language Switcher */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
            <span className="text-slate-400 flex items-center space-x-1.5 text-xs">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>Language / Langue</span>
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                  lang === 'en'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                  lang === 'fr'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                FR
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.header.signOut}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
