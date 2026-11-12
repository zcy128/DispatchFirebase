import { NavTab } from '../components/common/Sidebar';
import { AuthUser } from '../types/employee';
import { hasPageAccess } from './permissions';

export type NavDomainId =
  | 'dispatch_ops'
  | 'hr_payroll'
  | 'fleet'
  | 'students_safety'
  | 'system';

export interface NavDomainDefinition {
  id: NavDomainId;
  labelEn: string;
  labelFr: string;
  shortLabelEn: string;
  shortLabelFr: string;
  tabs: NavTab[];
}

export const NAV_DOMAINS: NavDomainDefinition[] = [
  {
    id: 'dispatch_ops',
    labelEn: 'Dispatch & Ops',
    labelFr: 'Répartition & Opérations',
    shortLabelEn: 'Dispatch',
    shortLabelFr: 'Répartition',
    tabs: [
      'dashboard',
      'dispatch',
      'charter',
      'routes',
      'staging_routes',
      'dispatch_payroll',
      'temporary_assignments',
      'dispatch_log',
      'assignment_history'
    ]
  },
  {
    id: 'hr_payroll',
    labelEn: 'HR & Payroll',
    labelFr: 'RH & Paie',
    shortLabelEn: 'HR & Payroll',
    shortLabelFr: 'RH & Paie',
    tabs: [
      'employees',
      'time_off',
      'payroll',
      'biweekly_payroll',
      'payroll_dept_log',
      'expenses'
    ]
  },
  {
    id: 'fleet',
    labelEn: 'Fleet & Depot',
    labelFr: 'Flotte & Dépôt',
    shortLabelEn: 'Fleet',
    shortLabelFr: 'Flotte',
    tabs: [
      'vehicles',
      'pretrip_checks',
      'vehicle_inspections',
      'defects',
      'vehicle_signouts',
      'yards'
    ]
  },
  {
    id: 'students_safety',
    labelEn: 'Students & Safety',
    labelFr: 'Élèves & Sécurité',
    shortLabelEn: 'Safety & School',
    shortLabelFr: 'Sécurité & Écoles',
    tabs: [
      'compliance',
      'training',
      'students',
      'student_absences',
      'student_incidents',
      'hazards',
      'route_assessments',
      'schools',
      'calendar'
    ]
  },
  {
    id: 'system',
    labelEn: 'System & Admin',
    labelFr: 'Système & Admin',
    shortLabelEn: 'System',
    shortLabelFr: 'Système',
    tabs: [
      'company_contacts',
      'roles',
      'login_logs',
      'audit_logs',
      'error_logs',
      'external_sync',
      'settings'
    ]
  }
];

/**
 * Resolves the top-level domain ID that owns a given NavTab.
 */
export function getDomainForTab(tab: NavTab): NavDomainId {
  for (const domain of NAV_DOMAINS) {
    if (domain.tabs.includes(tab)) {
      return domain.id;
    }
  }
  return 'dispatch_ops';
}

/**
 * Returns the first accessible NavTab within the specified domain for a user,
 * or null if the user has no access to any tab in that domain.
 */
export function getDefaultTabForDomain(
  domainId: NavDomainId,
  user: AuthUser | null
): NavTab | null {
  const domain = NAV_DOMAINS.find((d) => d.id === domainId);
  if (!domain) return null;
  for (const tab of domain.tabs) {
    if (hasPageAccess(user, tab)) {
      return tab;
    }
  }
  return null;
}

/**
 * Returns all top-level domains where the user has access to at least one child tab.
 */
export function getAccessibleDomains(
  user: AuthUser | null
): NavDomainDefinition[] {
  return NAV_DOMAINS.filter((domain) =>
    domain.tabs.some((tab) => hasPageAccess(user, tab))
  );
}
