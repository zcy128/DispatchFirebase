import type { NavTab } from '../components/common/Sidebar';

export interface QuickAccessPageMeta {
  id: NavTab;
  labelEn: string;
  labelFr: string;
  domain: 'dispatch_ops' | 'hr_payroll' | 'fleet' | 'students_safety' | 'system';
}

export const QUICK_ACCESS_PAGES_META: QuickAccessPageMeta[] = [
  // Dispatch & Ops
  { id: 'dispatch', labelEn: 'Dispatch Workbench', labelFr: 'Console de répartition', domain: 'dispatch_ops' },
  { id: 'charter', labelEn: 'Charter Trips', labelFr: 'Gestion des nolisés', domain: 'dispatch_ops' },
  { id: 'routes', labelEn: 'Route Network', labelFr: 'Réseau de circuits', domain: 'dispatch_ops' },
  { id: 'staging_routes', labelEn: 'Staging Routes', labelFr: 'Circuits staging', domain: 'dispatch_ops' },
  { id: 'dispatch_payroll', labelEn: 'Dispatch Payroll', labelFr: 'Paie de répartition', domain: 'dispatch_ops' },
  { id: 'temporary_assignments', labelEn: 'Temporary Assignments', labelFr: 'Affectations temporaires', domain: 'dispatch_ops' },
  { id: 'dispatch_log', labelEn: 'Dispatch Change Log', labelFr: 'Journal des modifications', domain: 'dispatch_ops' },
  { id: 'assignment_history', labelEn: 'Assignment Tracking', labelFr: 'Suivi des affectations', domain: 'dispatch_ops' },

  // HR & Payroll
  { id: 'employees', labelEn: 'Employees', labelFr: 'Employés', domain: 'hr_payroll' },
  { id: 'time_off', labelEn: 'Time Off Requests', labelFr: 'Demandes de congé', domain: 'hr_payroll' },
  { id: 'payroll', labelEn: 'Payroll Rates', labelFr: 'Taux de paie', domain: 'hr_payroll' },
  { id: 'biweekly_payroll', labelEn: 'Bi-Weekly Payroll', labelFr: 'Paie aux deux semaines', domain: 'hr_payroll' },
  { id: 'payroll_dept_log', labelEn: 'Payroll Department Log', labelFr: 'Journal du service de paie', domain: 'hr_payroll' },
  { id: 'expenses', labelEn: 'Expense Claims', labelFr: 'Notes de frais', domain: 'hr_payroll' },

  // Fleet & Depot
  { id: 'vehicles', labelEn: 'Fleet Vehicles', labelFr: 'Véhicules', domain: 'fleet' },
  { id: 'pretrip_checks', labelEn: 'Pre-Trip Inspections', labelFr: 'Inspections avant départ', domain: 'fleet' },
  { id: 'vehicle_inspections', labelEn: 'Vehicle Inspections', labelFr: 'Inspections véhicules', domain: 'fleet' },
  { id: 'defects', labelEn: 'Defect Reports', labelFr: 'Rapports de défectuosité', domain: 'fleet' },
  { id: 'vehicle_signouts', labelEn: 'Vehicle Signouts', labelFr: 'Sorties de véhicules', domain: 'fleet' },
  { id: 'yards', labelEn: 'Yards & Depots', labelFr: 'Dépôts', domain: 'fleet' },

  // Students & Safety
  { id: 'compliance', labelEn: 'Compliance Center', labelFr: 'Centre de conformité', domain: 'students_safety' },
  { id: 'training', labelEn: 'Training & Courses', labelFr: 'Formation et cours', domain: 'students_safety' },
  { id: 'students', labelEn: 'Students', labelFr: 'Élèves', domain: 'students_safety' },
  { id: 'student_absences', labelEn: 'Student Absences', labelFr: 'Absences des élèves', domain: 'students_safety' },
  { id: 'student_incidents', labelEn: 'Student Incidents', labelFr: 'Incidents élèves', domain: 'students_safety' },
  { id: 'hazards', labelEn: 'Hazard Reports', labelFr: 'Rapports de danger', domain: 'students_safety' },
  { id: 'route_assessments', labelEn: 'Route Assessments', labelFr: 'Évaluations de circuits', domain: 'students_safety' },
  { id: 'schools', labelEn: 'Schools & Boards', labelFr: 'Écoles et conseils', domain: 'students_safety' },
  { id: 'calendar', labelEn: 'School Calendar', labelFr: 'Calendrier scolaire', domain: 'students_safety' },

  // System & Admin
  { id: 'company_contacts', labelEn: 'Company Contacts', labelFr: 'Contacts de l’entreprise', domain: 'system' },
  { id: 'roles', labelEn: 'Role Permissions', labelFr: 'Rôles et permissions', domain: 'system' },
  { id: 'login_logs', labelEn: 'Login Logs', labelFr: 'Journaux de connexion', domain: 'system' },
  { id: 'audit_logs', labelEn: 'Audit Logs', labelFr: 'Journaux d’audit', domain: 'system' },
  { id: 'error_logs', labelEn: 'Error Logs', labelFr: 'Journaux d’erreurs', domain: 'system' },
  { id: 'external_sync', labelEn: 'External Sync', labelFr: 'Synchronisation externe', domain: 'system' },
  { id: 'settings', labelEn: 'Settings', labelFr: 'Paramètres', domain: 'system' },
];

const VALID_PINNABLE_TAB_SET = new Set<string>(QUICK_ACCESS_PAGES_META.map((p) => p.id));

export type DashboardActionCardId =
  | 'dispatch_missing_driver'
  | 'dispatch_missing_vehicle'
  | 'driver_not_checked_in'
  | 'routes_missing_crew'
  | 'time_off_requests'
  | 'student_incidents'
  | 'vehicle_defects'
  | 'hazard_reports'
  | 'expense_claims'
  | 'license_expirations';

export type DashboardSummaryPanelId = 'cdl_watchlist' | 'staff_depot';

export type DashboardCardId = DashboardActionCardId | DashboardSummaryPanelId;

export interface DashboardCardMeta {
  id: DashboardCardId;
  label: string;
  category: 'action' | 'summary';
}

export const DASHBOARD_CARDS_META: DashboardCardMeta[] = [
  { id: 'dispatch_missing_driver', label: 'Dispatch: Missing Driver', category: 'action' },
  { id: 'dispatch_missing_vehicle', label: 'Dispatch: Missing Vehicle', category: 'action' },
  { id: 'driver_not_checked_in', label: 'Driver Not Checked In', category: 'action' },
  { id: 'routes_missing_crew', label: 'Routes Missing Crew / Bus', category: 'action' },
  { id: 'time_off_requests', label: 'Time Off Requests', category: 'action' },
  { id: 'student_incidents', label: 'Student Incidents', category: 'action' },
  { id: 'vehicle_defects', label: 'Vehicle Defects', category: 'action' },
  { id: 'hazard_reports', label: 'Hazard Reports', category: 'action' },
  { id: 'expense_claims', label: 'Expense Claims', category: 'action' },
  { id: 'license_expirations', label: 'License Expirations', category: 'action' },
  { id: 'cdl_watchlist', label: 'Driver CDL Expiration Watchlist', category: 'summary' },
  { id: 'staff_depot', label: 'Staff Depot Distribution', category: 'summary' },
];

export const DEFAULT_CARD_ORDER: DashboardCardId[] = DASHBOARD_CARDS_META.map((c) => c.id);

const VALID_CARD_ID_SET = new Set<string>(DEFAULT_CARD_ORDER);

export interface DashboardPreferences {
  userId?: string;
  cardOrder: DashboardCardId[];
  hiddenCards: DashboardCardId[];
  pinnedPages: NavTab[];
  updatedAt?: string;
}

export function createDefaultDashboardPreferences(): DashboardPreferences {
  return {
    cardOrder: [...DEFAULT_CARD_ORDER],
    hiddenCards: [],
    pinnedPages: [],
  };
}

export function normalizeDashboardPreferences(
  raw?: Partial<DashboardPreferences> | null
): DashboardPreferences {
  const seenOrder = new Set<DashboardCardId>();
  const cardOrder: DashboardCardId[] = [];

  for (const id of raw?.cardOrder ?? []) {
    if (VALID_CARD_ID_SET.has(id) && !seenOrder.has(id as DashboardCardId)) {
      const typedId = id as DashboardCardId;
      seenOrder.add(typedId);
      cardOrder.push(typedId);
    }
  }

  for (const defaultId of DEFAULT_CARD_ORDER) {
    if (!seenOrder.has(defaultId)) {
      seenOrder.add(defaultId);
      cardOrder.push(defaultId);
    }
  }

  const seenHidden = new Set<DashboardCardId>();
  const hiddenCards: DashboardCardId[] = [];
  for (const id of raw?.hiddenCards ?? []) {
    if (VALID_CARD_ID_SET.has(id) && !seenHidden.has(id as DashboardCardId)) {
      const typedId = id as DashboardCardId;
      seenHidden.add(typedId);
      hiddenCards.push(typedId);
    }
  }

  const seenPinned = new Set<NavTab>();
  const pinnedPages: NavTab[] = [];
  for (const tab of raw?.pinnedPages ?? []) {
    if (VALID_PINNABLE_TAB_SET.has(tab) && !seenPinned.has(tab)) {
      seenPinned.add(tab);
      pinnedPages.push(tab);
    }
  }

  return {
    userId: raw?.userId,
    cardOrder,
    hiddenCards,
    pinnedPages,
    updatedAt: raw?.updatedAt,
  };
}

export function hideDashboardCard(
  prefs: DashboardPreferences,
  cardId: DashboardCardId
): DashboardPreferences {
  if (prefs.hiddenCards.includes(cardId)) return prefs;
  return {
    ...prefs,
    hiddenCards: [...prefs.hiddenCards, cardId],
  };
}

export function restoreDashboardCard(
  prefs: DashboardPreferences,
  cardId: DashboardCardId
): DashboardPreferences {
  return {
    ...prefs,
    hiddenCards: prefs.hiddenCards.filter((id) => id !== cardId),
  };
}

/**
 * Moves a card one step earlier (-1) or later (+1) among visible cards of the same category.
 */
export function moveDashboardCardStep(
  prefs: DashboardPreferences,
  cardId: DashboardCardId,
  direction: -1 | 1,
  category: 'action' | 'summary'
): DashboardPreferences {
  const categoryIds = new Set(
    DASHBOARD_CARDS_META.filter((c) => c.category === category).map((c) => c.id)
  );
  const hiddenSet = new Set(prefs.hiddenCards);
  const visibleInCategory = prefs.cardOrder.filter(
    (id) => categoryIds.has(id) && !hiddenSet.has(id)
  );

  const currentVisibleIdx = visibleInCategory.indexOf(cardId);
  if (currentVisibleIdx === -1) return prefs;

  const targetVisibleIdx = currentVisibleIdx + direction;
  if (targetVisibleIdx < 0 || targetVisibleIdx >= visibleInCategory.length) return prefs;

  const swapWithId = visibleInCategory[targetVisibleIdx];
  const nextOrder = [...prefs.cardOrder];
  const idxA = nextOrder.indexOf(cardId);
  const idxB = nextOrder.indexOf(swapWithId);
  if (idxA === -1 || idxB === -1) return prefs;

  nextOrder[idxA] = swapWithId;
  nextOrder[idxB] = cardId;

  return {
    ...prefs,
    cardOrder: nextOrder,
  };
}

/**
 * Reorders `draggedId` to the position of `targetId` within `cardOrder`.
 */
export function reorderDashboardCards(
  prefs: DashboardPreferences,
  draggedId: DashboardCardId,
  targetId: DashboardCardId
): DashboardPreferences {
  if (draggedId === targetId) return prefs;
  const draggedMeta = DASHBOARD_CARDS_META.find((c) => c.id === draggedId);
  const targetMeta = DASHBOARD_CARDS_META.find((c) => c.id === targetId);
  if (!draggedMeta || !targetMeta || draggedMeta.category !== targetMeta.category) {
    return prefs;
  }

  const nextOrder = [...prefs.cardOrder];
  const fromIdx = nextOrder.indexOf(draggedId);
  const toIdx = nextOrder.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return prefs;

  nextOrder.splice(fromIdx, 1);
  nextOrder.splice(toIdx, 0, draggedId);

  return {
    ...prefs,
    cardOrder: nextOrder,
  };
}

/**
 * Toggles a page shortcut in the user's pinned quick-access list.
 */
export function togglePinnedPage(
  prefs: DashboardPreferences,
  tabId: NavTab
): DashboardPreferences {
  if (!VALID_PINNABLE_TAB_SET.has(tabId)) return prefs;
  const current = prefs.pinnedPages ?? [];
  if (current.includes(tabId)) {
    return {
      ...prefs,
      pinnedPages: current.filter((id) => id !== tabId),
    };
  }
  return {
    ...prefs,
    pinnedPages: [...current, tabId],
  };
}

/**
 * Moves a pinned page shortcut one step earlier (-1) or later (+1).
 */
export function movePinnedPageStep(
  prefs: DashboardPreferences,
  tabId: NavTab,
  direction: -1 | 1
): DashboardPreferences {
  const current = [...(prefs.pinnedPages ?? [])];
  const idx = current.indexOf(tabId);
  if (idx === -1) return prefs;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= current.length) return prefs;

  const swap = current[targetIdx];
  current[targetIdx] = tabId;
  current[idx] = swap;
  return {
    ...prefs,
    pinnedPages: current,
  };
}

/**
 * Clears all pinned quick-access shortcuts while preserving card layout preferences.
 */
export function clearPinnedPages(prefs: DashboardPreferences): DashboardPreferences {
  return {
    ...prefs,
    pinnedPages: [],
  };
}
