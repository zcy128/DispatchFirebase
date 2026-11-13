package repository

import (
	"context"
	"strings"
	"time"

	"dispatch-server/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const userPreferencesCollection = "user_preferences"

func dashboardPrefsDocID(userID string) string {
	trimmed := strings.TrimSpace(userID)
	if trimmed == "" {
		return ""
	}
	return "dashboard_" + trimmed
}

// GetUserDashboardPreferences retrieves a user's Fleet Pulse dashboard card layout from Firestore.
func (r *FirestoreDispatchRepository) GetUserDashboardPreferences(ctx context.Context, userID string) (*models.DashboardPreferences, error) {
	docID := dashboardPrefsDocID(userID)
	if docID == "" {
		return &models.DashboardPreferences{
			CardOrder:   []string{},
			HiddenCards: []string{},
		}, nil
	}

	snap, err := r.client.Collection(userPreferencesCollection).Doc(docID).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return &models.DashboardPreferences{
				UserID:      strings.TrimSpace(userID),
				CardOrder:   []string{},
				HiddenCards: []string{},
			}, nil
		}
		return nil, err
	}

	var prefs models.DashboardPreferences
	if err := snap.DataTo(&prefs); err != nil {
		return nil, err
	}
	if prefs.CardOrder == nil {
		prefs.CardOrder = []string{}
	}
	if prefs.HiddenCards == nil {
		prefs.HiddenCards = []string{}
	}
	return &prefs, nil
}

// SaveUserDashboardPreferences persists a user's Fleet Pulse dashboard card layout to Firestore.
func (r *FirestoreDispatchRepository) SaveUserDashboardPreferences(ctx context.Context, prefs *models.DashboardPreferences) (*models.DashboardPreferences, error) {
	if prefs == nil {
		return nil, nil
	}
	docID := dashboardPrefsDocID(prefs.UserID)
	if docID == "" {
		return prefs, nil
	}

	if prefs.CardOrder == nil {
		prefs.CardOrder = []string{}
	}
	if prefs.HiddenCards == nil {
		prefs.HiddenCards = []string{}
	}
	prefs.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	_, err := r.client.Collection(userPreferencesCollection).Doc(docID).Set(ctx, prefs)
	if err != nil {
		return nil, err
	}
	return prefs, nil
}

// GetUserDashboardPreferences retrieves a user's Fleet Pulse dashboard card layout from memory.
func (r *MemoryDispatchRepository) GetUserDashboardPreferences(ctx context.Context, userID string) (*models.DashboardPreferences, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	docID := dashboardPrefsDocID(userID)
	if docID == "" || r.dashboardPreferences == nil {
		return &models.DashboardPreferences{
			UserID:      strings.TrimSpace(userID),
			CardOrder:   []string{},
			HiddenCards: []string{},
		}, nil
	}

	existing, ok := r.dashboardPreferences[docID]
	if !ok || existing == nil {
		return &models.DashboardPreferences{
			UserID:      strings.TrimSpace(userID),
			CardOrder:   []string{},
			HiddenCards: []string{},
		}, nil
	}

	cardOrder := make([]string, len(existing.CardOrder))
	copy(cardOrder, existing.CardOrder)
	hiddenCards := make([]string, len(existing.HiddenCards))
	copy(hiddenCards, existing.HiddenCards)
	return &models.DashboardPreferences{
		UserID:      existing.UserID,
		CardOrder:   cardOrder,
		HiddenCards: hiddenCards,
		UpdatedAt:   existing.UpdatedAt,
	}, nil
}

// SaveUserDashboardPreferences persists a user's Fleet Pulse dashboard card layout to memory.
func (r *MemoryDispatchRepository) SaveUserDashboardPreferences(ctx context.Context, prefs *models.DashboardPreferences) (*models.DashboardPreferences, error) {
	if prefs == nil {
		return nil, nil
	}
	docID := dashboardPrefsDocID(prefs.UserID)
	if docID == "" {
		return prefs, nil
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.dashboardPreferences == nil {
		r.dashboardPreferences = make(map[string]*models.DashboardPreferences)
	}

	cardOrder := make([]string, len(prefs.CardOrder))
	copy(cardOrder, prefs.CardOrder)
	hiddenCards := make([]string, len(prefs.HiddenCards))
	copy(hiddenCards, prefs.HiddenCards)
	saved := &models.DashboardPreferences{
		UserID:      strings.TrimSpace(prefs.UserID),
		CardOrder:   cardOrder,
		HiddenCards: hiddenCards,
		UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
	}
	r.dashboardPreferences[docID] = saved
	return saved, nil
}
