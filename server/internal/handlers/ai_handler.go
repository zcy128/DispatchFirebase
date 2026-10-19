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

	// Enrich operator information and role from authenticated user context if not explicitly provided
	user := auth.GetUser(r.Context())
	if user != nil {
		if req.OperatorName == "" {
			req.OperatorName = user.Email
		}
		if req.OperatorID == "" {
			req.OperatorID = user.UID
		}
		if req.UserRole == "" && user.Role != "" {
			req.UserRole = user.Role
		}
	}

	if req.UserRole == "" {
		if headerRole := r.Header.Get("X-User-Role"); headerRole != "" {
			req.UserRole = headerRole
		}
	}
	if req.UserRole == "" {
		req.UserRole = "dispatcher"
	}
	if req.OperatorName == "" {
		req.OperatorName = "Dispatcher"
	}

	resp, err := h.aiService.ProcessChat(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(resp)
}

// GetStatus returns the operational status and active engine of AI Copilot
func (h *AIHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	hasKey := os.Getenv("GEMINI_API_KEY") != ""
	engine := "builtin"
	if hasKey {
		engine = "gemini"
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "online",
		"engine":      engine,
		"hasApiKey":   hasKey,
		"name":        "Dispatch AI Copilot",
		"version":     "1.0",
		"supported":   []string{"unassigned_shifts", "assign_driver", "driver_schedule", "fleet_summary"},
	})
}
