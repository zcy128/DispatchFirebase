package models

// DashboardPreferences stores per-user Fleet Pulse card ordering, visibility, and pinned quick-access pages.
type DashboardPreferences struct {
	UserID      string   `json:"userId" firestore:"userId"`
	CardOrder   []string `json:"cardOrder" firestore:"cardOrder"`
	HiddenCards []string `json:"hiddenCards" firestore:"hiddenCards"`
	PinnedPages []string `json:"pinnedPages" firestore:"pinnedPages"`
	UpdatedAt   string   `json:"updatedAt" firestore:"updatedAt"`
}
