import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CARD_ORDER,
  createDefaultDashboardPreferences,
  normalizeDashboardPreferences,
  hideDashboardCard,
  restoreDashboardCard,
  moveDashboardCardStep,
  reorderDashboardCards,
} from './dashboardPreferencesUtils';

describe('dashboardPreferencesUtils', () => {
  it('normalizes empty or partial preferences by appending missing default cards', () => {
    const normalized = normalizeDashboardPreferences({
      cardOrder: ['expense_claims', 'dispatch_missing_driver', 'invalid_id' as any],
      hiddenCards: ['vehicle_defects', 'invalid_hidden' as any],
    });

    expect(normalized.cardOrder[0]).toBe('expense_claims');
    expect(normalized.cardOrder[1]).toBe('dispatch_missing_driver');
    expect(normalized.cardOrder).toHaveLength(DEFAULT_CARD_ORDER.length);
    expect(normalized.cardOrder).not.toContain('invalid_id');
    expect(normalized.hiddenCards).toEqual(['vehicle_defects']);
  });

  it('hides and restores cards without losing order', () => {
    const initial = createDefaultDashboardPreferences();
    const afterHide = hideDashboardCard(initial, 'hazard_reports');
    expect(afterHide.hiddenCards).toEqual(['hazard_reports']);

    const afterDuplicateHide = hideDashboardCard(afterHide, 'hazard_reports');
    expect(afterDuplicateHide.hiddenCards).toEqual(['hazard_reports']);

    const afterRestore = restoreDashboardCard(afterHide, 'hazard_reports');
    expect(afterRestore.hiddenCards).toEqual([]);
  });

  it('moves a card one step left or right among visible cards of the same category', () => {
    let prefs = createDefaultDashboardPreferences();
    // Hide the second card so moving the first card right swaps with the third card
    prefs = hideDashboardCard(prefs, 'dispatch_missing_vehicle');
    prefs = moveDashboardCardStep(prefs, 'dispatch_missing_driver', 1, 'action');

    const idxDriver = prefs.cardOrder.indexOf('dispatch_missing_driver');
    const idxCheckIn = prefs.cardOrder.indexOf('driver_not_checked_in');
    expect(idxDriver).toBeGreaterThan(idxCheckIn);
  });

  it('reorders cards via drag-and-drop within the same category only', () => {
    const prefs = createDefaultDashboardPreferences();
    const reordered = reorderDashboardCards(prefs, 'expense_claims', 'dispatch_missing_driver');
    expect(reordered.cardOrder[0]).toBe('expense_claims');
    expect(reordered.cardOrder[1]).toBe('dispatch_missing_driver');

    // Cross-category drag should be ignored
    const crossCategory = reorderDashboardCards(prefs, 'cdl_watchlist', 'dispatch_missing_driver');
    expect(crossCategory.cardOrder).toEqual(prefs.cardOrder);
  });
});
