package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
)

func resolveDashboardPrefUserID(r *http.Request, fallbackUserID string) string {
	if user := auth.GetUser(r.Context()); user != nil {
		if uid := strings.TrimSpace(user.UID); uid != "" {
			return uid
		}
		if empID := strings.TrimSpace(user.EmployeeID); empID != "" {
			return empID
		}
	}
	if q := strings.TrimSpace(r.URL.Query().Get("userId")); q != "" {
		return q
	}
	return strings.TrimSpace(fallbackUserID)
}

// GetDashboardPreferences returns the current user's Fleet Pulse dashboard card layout.
func (h *DispatchHandler) GetDashboardPreferences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := resolveDashboardPrefUserID(r, "")
	if userID == "" {
		http.Error(w, `{"error":"user identity is required"}`, http.StatusBadRequest)
		return
	}

	prefs, err := h.repo.GetUserDashboardPreferences(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"failed to load dashboard preferences: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(prefs)
}

// SaveDashboardPreferences persists the current user's Fleet Pulse dashboard card layout.
func (h *DispatchHandler) SaveDashboardPreferences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.DashboardPreferences
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	userID := resolveDashboardPrefUserID(r, req.UserID)
	if userID == "" {
		http.Error(w, `{"error":"user identity is required"}`, http.StatusBadRequest)
		return
	}
	req.UserID = userID

	saved, err := h.repo.SaveUserDashboardPreferences(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to save dashboard preferences: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(saved)
}
