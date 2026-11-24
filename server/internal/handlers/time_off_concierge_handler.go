package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/services"
)

func (h *DispatchHandler) ensureConcierge() *services.OfficeConciergeService {
	if h.concierge == nil {
		h.concierge = services.NewOfficeConciergeService(h.repo, nil, nil)
	}
	return h.concierge
}

// OfficeConciergeChat handles POST /api/dispatch/office-concierge/chat
func (h *DispatchHandler) OfficeConciergeChat(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.OfficeConciergeChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	authUser := auth.GetUser(r.Context())
	if authUser != nil {
		if strings.TrimSpace(req.EmployeeID) == "" {
			if authUser.EmployeeID != "" {
				req.EmployeeID = authUser.EmployeeID
			} else {
				req.EmployeeID = authUser.UID
			}
		}
		if strings.TrimSpace(req.EmployeeName) == "" {
			if authUser.FullName != "" {
				req.EmployeeName = authUser.FullName
			} else {
				req.EmployeeName = authUser.Email
			}
		}
	}

	resp, err := h.ensureConcierge().ProcessOfficeConciergeChat(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to process office concierge chat: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(resp)
}

// GetOfficeConciergeMessages handles GET /api/dispatch/office-concierge/messages?employeeId=...
func (h *DispatchHandler) GetOfficeConciergeMessages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	empID := strings.TrimSpace(r.URL.Query().Get("employeeId"))
	if empID == "" {
		if authUser := auth.GetUser(r.Context()); authUser != nil {
			if authUser.EmployeeID != "" {
				empID = authUser.EmployeeID
			} else {
				empID = authUser.UID
			}
		}
	}
	if empID == "" {
		empID = "EMP-1001"
	}
	msgs := h.ensureConcierge().GetEmployeeMessages(empID)
	json.NewEncoder(w).Encode(msgs)
}

// ConfirmTimeOffPeerCover handles POST /api/dispatch/time-off-requests/{id}/confirm-peer-cover
func (h *DispatchHandler) ConfirmTimeOffPeerCover(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.ConfirmPeerCoverPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.ensureConcierge().ConfirmPeerCover(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// ClaimTimeOffCoverageSlot handles POST /api/dispatch/time-off-requests/{id}/claim-slot
func (h *DispatchHandler) ClaimTimeOffCoverageSlot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.ClaimTimeOffSlotPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.ensureConcierge().ClaimCoverageSlot(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// GetTimeOffWorkbench handles GET /api/dispatch/time-off-workbench
// Returns the 3-Day Rolling Approver Chat Workbench feed and Region/Yard summary.
func (h *DispatchHandler) GetTimeOffWorkbench(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	authUser := auth.GetUser(r.Context())
	canApprove := false
	if authUser != nil {
		normRole := auth.NormalizeRoleName(authUser.Role)
		canApprove = normRole == "admin" || authUser.HasModulePermission("time_off", true) || authUser.HasModulePermission("timeoff", true)
	}
	resp, err := h.ensureConcierge().GetTimeOffWorkbench(r.Context(), canApprove, time.Now().UTC())
	if err != nil {
		http.Error(w, `{"error":"failed to load time-off workbench: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(resp)
}

// FinalizePreApprovedTimeOffRequests handles POST /api/admin/time-off-requests/finalize-preapproved
func (h *DispatchHandler) FinalizePreApprovedTimeOffRequests(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	count, err := h.ensureConcierge().RunPreApprovedAutoFinalizationSweep(r.Context(), time.Now().UTC())
	if err != nil {
		http.Error(w, `{"error":"failed to finalize pre-approved time-off requests: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"finalized": count,
		"checkedAt": time.Now().UTC().Format(time.RFC3339),
	})
}

// HoldTimeOffRequest places a time-off request into 'on_hold' status (blocking auto-cover & auto-approval).
func (h *DispatchHandler) HoldTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}
	authUser := auth.GetUser(r.Context())
	if authUser == nil || !authUser.HasModulePermission("time_off", true) {
		http.Error(w, `{"error":"forbidden: insufficient permissions to hold time off requests"}`, http.StatusForbidden)
		return
	}
	var req models.ReviewTimeOffRequestPayload
	_ = json.NewDecoder(r.Body).Decode(&req)
	if strings.TrimSpace(req.ReviewerName) == "" {
		if authUser.FullName != "" {
			req.ReviewerName = authUser.FullName
		} else {
			req.ReviewerName = authUser.Email
		}
	}
	if strings.TrimSpace(req.ReviewerUserID) == "" {
		req.ReviewerUserID = authUser.UID
	}

	updated, err := h.repo.HoldTimeOffRequest(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to hold time off request: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if h.concierge != nil {
		h.concierge.NotifyDirectTimeOffUpdated(models.TimeOffStatusPending, updated)
	}
	json.NewEncoder(w).Encode(updated)
}

// ResumeTimeOffRequest releases a time-off request from 'on_hold' back to 'pending'.
func (h *DispatchHandler) ResumeTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}
	authUser := auth.GetUser(r.Context())
	if authUser == nil || !authUser.HasModulePermission("time_off", true) {
		http.Error(w, `{"error":"forbidden: insufficient permissions to resume time off requests"}`, http.StatusForbidden)
		return
	}
	var req models.ReviewTimeOffRequestPayload
	_ = json.NewDecoder(r.Body).Decode(&req)

	updated, err := h.repo.ResumeTimeOffRequest(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to resume time off request: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if h.concierge != nil {
		h.concierge.NotifyDirectTimeOffUpdated(models.TimeOffStatusOnHold, updated)
	}
	json.NewEncoder(w).Encode(updated)
}

// GetTimeOffPolicySettings returns the configurable time-off automation thresholds.
func (h *DispatchHandler) GetTimeOffPolicySettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	cfg, err := h.repo.GetTimeOffPolicySettings(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to get time-off policy settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(cfg)
}

// SaveTimeOffPolicySettings updates the configurable time-off automation thresholds.
func (h *DispatchHandler) SaveTimeOffPolicySettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	authUser := auth.GetUser(r.Context())
	if authUser == nil || !authUser.HasModulePermission("time_off", true) {
		http.Error(w, `{"error":"forbidden: insufficient permissions to update time-off policy settings"}`, http.StatusForbidden)
		return
	}
	var cfg models.TimeOffPolicySettings
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if authUser.FullName != "" {
		cfg.UpdatedBy = authUser.FullName
	} else {
		cfg.UpdatedBy = authUser.Email
	}
	saved, err := h.repo.SaveTimeOffPolicySettings(r.Context(), &cfg)
	if err != nil {
		http.Error(w, `{"error":"failed to save time-off policy settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(saved)
}
