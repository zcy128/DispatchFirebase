package repository

import (
	"context"
	"testing"

	"dispatch-server/internal/models"
)

func TestMemoryUserDashboardPreferencesPersistsPinnedPages(t *testing.T) {
	repo := NewMemoryDispatchRepository()
	ctx := context.Background()

	initial, err := repo.GetUserDashboardPreferences(ctx, "usr-hr-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(initial.PinnedPages) != 0 {
		t.Fatalf("expected empty initial pinned pages, got %v", initial.PinnedPages)
	}

	_, err = repo.SaveUserDashboardPreferences(ctx, &models.DashboardPreferences{
		UserID:      "usr-hr-1",
		CardOrder:   []string{"time_off_requests"},
		HiddenCards: []string{"vehicle_defects"},
		PinnedPages: []string{"employees", "training", "student_incidents"},
	})
	if err != nil {
		t.Fatalf("failed to save preferences: %v", err)
	}

	loaded, err := repo.GetUserDashboardPreferences(ctx, "usr-hr-1")
	if err != nil {
		t.Fatalf("failed to load preferences: %v", err)
	}
	if len(loaded.PinnedPages) != 3 ||
		loaded.PinnedPages[0] != "employees" ||
		loaded.PinnedPages[1] != "training" ||
		loaded.PinnedPages[2] != "student_incidents" {
		t.Fatalf("unexpected pinned pages: %v", loaded.PinnedPages)
	}
}
