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
  updatedAt?: string;
}

export function createDefaultDashboardPreferences(): DashboardPreferences {
  return {
    cardOrder: [...DEFAULT_CARD_ORDER],
    hiddenCards: [],
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

  return {
    userId: raw?.userId,
    cardOrder,
    hiddenCards,
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
