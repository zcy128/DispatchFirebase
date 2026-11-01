package handlers

import (
	"encoding/json"
	"net/http"
	"os"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/services"
)

type AIHandler struct {
	aiService *services.AIService
}

func NewAIHandler(aiService *services.AIService) *AIHandler {
	return &AIHandler{aiService: aiService}
}

// ProcessChat handles the dispatch copilot conversation
func (h *AIHandler) ProcessChat(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.AIChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	// Enrich operator information and role from authenticated user context.
	// For unauthenticated requests, strictly enforce guest role and discard any client-supplied userRole or permissions.
	user := auth.GetUser(r.Context())
	if user != nil {
		if user.Email != "" {
			req.OperatorName = user.Email
		}
		if user.UID != "" {
			req.OperatorID = user.UID
		}
		if user.EmployeeID != "" {
			req.OperatorID = user.EmployeeID
		}
		if user.Role != "" {
			req.UserRole = user.Role
		}
		req.PagePermissions = user.PagePermissions
	} else {
		req.UserRole = "guest"
		req.OperatorName = "Guest"
		req.OperatorID = ""
		req.PagePermissions = nil
	}
	if req.OperatorName == "" {
		req.OperatorName = "Dispatcher"
	}

	resp, err := h.aiService.ProcessChat(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"ai request failed"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(resp)
}

// GetStatus returns the operational status, active engine, and daily Gemini quota of AI Copilot
func (h *AIHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	hasKey := os.Getenv("GEMINI_API_KEY") != ""
	engine := "builtin"
	if hasKey {
		engine = "gemini"
	}

	userKey := "anonymous"
	if user := auth.GetUser(r.Context()); user != nil && user.UID != "" {
		userKey = user.UID
	} else if qUser := r.URL.Query().Get("userId"); qUser != "" {
		userKey = qUser
	}

	used, limit, remaining, exhausted := 0, services.DefaultUserDailyGeminiLimit, services.DefaultUserDailyGeminiLimit, false
	if h.aiService != nil {
		used, limit, remaining, exhausted = h.aiService.GetQuotaStatus(userKey)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":         "online",
		"engine":         engine,
		"hasApiKey":      hasKey,
		"name":           "Dispatch AI Copilot",
		"version":        "1.0",
		"supported":      []string{"unassigned_shifts", "assign_driver", "driver_schedule", "fleet_summary"},
		"quotaUsed":      used,
		"quotaLimit":     limit,
		"quotaRemaining": remaining,
		"quotaExhausted": exhausted,
	})
}
