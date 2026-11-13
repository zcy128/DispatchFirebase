package models

// DashboardPreferences stores per-user Fleet Pulse card ordering and visibility.
type DashboardPreferences struct {
	UserID      string   `json:"userId" firestore:"userId"`
	CardOrder   []string `json:"cardOrder" firestore:"cardOrder"`
	HiddenCards []string `json:"hiddenCards" firestore:"hiddenCards"`
	UpdatedAt   string   `json:"updatedAt" firestore:"updatedAt"`
}
