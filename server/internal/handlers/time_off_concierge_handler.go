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
