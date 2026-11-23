package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

// GetBiweeklyPayrollConfig returns the shared fixed bi-weekly pay period anchor configuration.
func (h *DispatchHandler) GetBiweeklyPayrollConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	cfg, err := h.repo.GetBiweeklyPayrollConfig(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch biweekly payroll config: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(cfg)
}

// SaveBiweeklyPayrollConfig updates the shared fixed bi-weekly pay period anchor configuration.
func (h *DispatchHandler) SaveBiweeklyPayrollConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	authUser := auth.GetUser(r.Context())
	if authUser == nil || !authUser.CanManageBiweeklyPayrollConfig() {
		http.Error(w, `{"error":"forbidden: only admin or payroll can update biweekly payroll config"}`, http.StatusForbidden)
		return
	}

	var req models.BiweeklyPayrollConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	req.BiweeklyAnchorDate = strings.TrimSpace(req.BiweeklyAnchorDate)
	if _, err := time.Parse("2006-01-02", req.BiweeklyAnchorDate); err != nil {
		http.Error(w, `{"error":"biweeklyAnchorDate must be in YYYY-MM-DD format"}`, http.StatusBadRequest)
		return
	}
	if req.PeriodLengthDays <= 0 {
		req.PeriodLengthDays = 14
	}
	if req.PeriodLengthDays != 14 {
		http.Error(w, `{"error":"periodLengthDays must be 14 for biweekly payroll"}`, http.StatusBadRequest)
		return
	}
	if authUser.Email != "" {
		req.UpdatedBy = authUser.Email
	} else {
		req.UpdatedBy = authUser.FullName
	}

	saved, err := h.repo.SaveBiweeklyPayrollConfig(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to save biweekly payroll config: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(saved)
}

// UpsertExpenseCategory creates or updates an expense policy with strict HR/Fleet group isolation.
func (h *DispatchHandler) UpsertExpenseCategory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	authUser := auth.GetUser(r.Context())
	if authUser == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	code := strings.ToLower(strings.TrimSpace(chi.URLParam(r, "code")))
	var req models.UpsertExpenseCategoryPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if code == "" {
		code = strings.ToLower(strings.TrimSpace(req.Code))
	}
	if code == "" {
		http.Error(w, `{"error":"category code is required"}`, http.StatusBadRequest)
		return
	}
	if strings.Contains(code, "lpn") {
		http.Error(w, `{"error":"LPN expense categories are not supported"}`, http.StatusBadRequest)
		return
	}

	existing, err := h.repo.GetExpenseCategoryByCode(r.Context(), code)
	if err != nil {
		http.Error(w, `{"error":"failed to look up expense category: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	targetGroup := strings.ToLower(strings.TrimSpace(req.ApproverGroup))
	if targetGroup == "" && existing != nil {
		targetGroup = existing.ApproverGroup
	}
	if targetGroup != models.ExpenseApproverGroupHR && targetGroup != models.ExpenseApproverGroupFleet {
		http.Error(w, `{"error":"approverGroup must be 'hr' or 'fleet'"}`, http.StatusBadRequest)
		return
	}

	// Enforce strict group-level isolation on both existing and target groups
	if existing != nil && !authUser.CanManageExpensePolicyGroup(existing.ApproverGroup) {
		http.Error(w, `{"error":"forbidden: your role cannot modify policies in the `+existing.ApproverGroup+` group"}`, http.StatusForbidden)
		return
	}
	if !authUser.CanManageExpensePolicyGroup(targetGroup) {
		http.Error(w, `{"error":"forbidden: your role cannot manage policies in the `+targetGroup+` group"}`, http.StatusForbidden)
		return
	}

	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" && existing != nil {
		displayName = existing.DisplayName
	}
	if displayName == "" {
		http.Error(w, `{"error":"displayName is required"}`, http.StatusBadRequest)
		return
	}

	periodType := strings.ToLower(strings.TrimSpace(req.PeriodType))
	if periodType == "" && existing != nil {
		periodType = existing.PeriodType
	}
	switch periodType {
	case models.ExpensePeriodPerClaim,
		models.ExpensePeriodOneTime,
		models.ExpensePeriodBiweeklyPayPeriod,
		models.ExpensePeriodMonthly,
		models.ExpensePeriodYearly:
	default:
		http.Error(w, `{"error":"invalid periodType"}`, http.StatusBadRequest)
		return
	}

	if req.MaxTotalAmount != nil && *req.MaxTotalAmount < 0 {
		http.Error(w, `{"error":"maxTotalAmount cannot be negative"}`, http.StatusBadRequest)
		return
	}
	if req.MaxCountPerPeriod != nil && *req.MaxCountPerPeriod < 1 {
		http.Error(w, `{"error":"maxCountPerPeriod must be at least 1"}`, http.StatusBadRequest)
		return
	}

	active := true
	if req.Active != nil {
		active = *req.Active
	} else if existing != nil {
		active = existing.Active
	}

	sortOrder := req.SortOrder
	if sortOrder <= 0 {
		if existing != nil && existing.SortOrder > 0 {
			sortOrder = existing.SortOrder
		} else {
			sortOrder = 50
		}
	}

	version := 1
	action := "create"
	var beforeCopy *models.ExpenseCategory
	if existing != nil {
		cp := *existing
		beforeCopy = &cp
		version = existing.Version + 1
		if !active && existing.Active {
			action = "deactivate"
		} else {
			action = "update"
		}
	}

	limitLabel := strings.TrimSpace(req.LimitLabel)
	if limitLabel == "" {
		limitLabel = models.FormatExpenseLimitLabel(req.MaxTotalAmount, periodType)
	}

	actorName := authUser.FullName
	if actorName == "" {
		actorName = authUser.Email
	}

	autoPreApprove := false
	if req.AutoPreApprove != nil {
		autoPreApprove = *req.AutoPreApprove
	} else if existing != nil {
		autoPreApprove = existing.AutoPreApprove
	}

	updated := &models.ExpenseCategory{
		ID:                "cat-" + code,
		Code:              code,
		DisplayName:       displayName,
		LimitLabel:        limitLabel,
		ApproverGroup:     targetGroup,
		PeriodType:        periodType,
		MaxTotalAmount:    req.MaxTotalAmount,
		MaxCountPerPeriod: req.MaxCountPerPeriod,
		RequireAttachment: req.RequireAttachment,
		AutoPreApprove:    autoPreApprove,
		AIReviewGuidance:  strings.TrimSpace(req.AIReviewGuidance),
		SortOrder:         sortOrder,
		Active:            active,
		Version:           version,
		UpdatedBy:         actorName,
	}
	if existing != nil && existing.ID != "" {
		updated.ID = existing.ID
	}

	audit := &models.ExpensePolicyAuditLog{
		CategoryCode: code,
		Action:       action,
		Source:       "web_ui",
		Before:       beforeCopy,
		After:        updated,
		Reason:       strings.TrimSpace(req.Reason),
		ActorEmail:   authUser.Email,
		ActorName:    actorName,
		ActorRole:    authUser.Role,
		CreatedAt:    time.Now().UTC(),
	}

	saved, err := h.repo.UpsertExpenseCategory(r.Context(), updated, audit)
	if err != nil {
		http.Error(w, `{"error":"failed to save expense policy: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(saved)
}

// ListExpensePolicyAuditLogs returns recent policy modification audit entries.
func (h *DispatchHandler) ListExpensePolicyAuditLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	authUser := auth.GetUser(r.Context())
	if authUser == nil || !authUser.CanViewExpensePolicyAuditLogs() {
		http.Error(w, `{"error":"forbidden: insufficient permissions to view policy audit logs"}`, http.StatusForbidden)
		return
	}

	code := strings.TrimSpace(r.URL.Query().Get("categoryCode"))
	limit := 50
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		if n, err := strconv.Atoi(rawLimit); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}

	logs, err := h.repo.ListExpensePolicyAuditLogs(r.Context(), code, limit)
	if err != nil {
		http.Error(w, `{"error":"failed to list policy audit logs: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = []*models.ExpensePolicyAuditLog{}
	}
	json.NewEncoder(w).Encode(logs)
}

// EvaluateExpenseClaim deterministically evaluates a single expense claim against configured policies.
func (h *DispatchHandler) EvaluateExpenseClaim(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	authUser := auth.GetUser(r.Context())
	if authUser == nil || !authUser.CanReviewExpenses() {
		http.Error(w, `{"error":"forbidden: insufficient permissions to evaluate expense claims"}`, http.StatusForbidden)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	claim, err := h.repo.GetExpenseClaimByID(r.Context(), id)
	if err != nil || claim == nil {
		http.Error(w, `{"error":"expense claim not found"}`, http.StatusNotFound)
		return
	}

	categories, err := h.repo.ListAllExpenseCategories(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load expense policies"}`, http.StatusInternalServerError)
		return
	}

	cfg, err := h.repo.GetBiweeklyPayrollConfig(r.Context())
	if err != nil {
		cfg = models.DefaultBiweeklyPayrollConfig()
	}

	employeeClaims, err := h.repo.ListExpenseClaimsFiltered(r.Context(), repository.ExpenseClaimFilter{
		EmployeeID: claim.EmployeeID,
		TimeRange:  "all",
	})
	if err != nil {
		http.Error(w, `{"error":"failed to load employee expense history"}`, http.StatusInternalServerError)
		return
	}

	eval := services.EvaluateExpenseClaim(claim, employeeClaims, categories, cfg)
	json.NewEncoder(w).Encode(eval)
}

// AIPreCheckExpenseClaim performs AI / soft-rule receipt & guidance pre-check on an expense claim.
func (h *DispatchHandler) AIPreCheckExpenseClaim(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	authUser := auth.GetUser(r.Context())
	if authUser == nil || !authUser.CanReviewExpenses() {
		http.Error(w, `{"error":"forbidden: insufficient permissions to pre-check expense claims"}`, http.StatusForbidden)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	claim, err := h.repo.GetExpenseClaimByID(r.Context(), id)
	if err != nil || claim == nil {
		http.Error(w, `{"error":"expense claim not found"}`, http.StatusNotFound)
		return
	}

	categories, err := h.repo.ListAllExpenseCategories(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load expense policies"}`, http.StatusInternalServerError)
		return
	}

	cfg, _ := h.repo.GetBiweeklyPayrollConfig(r.Context())
	employeeClaims, _ := h.repo.ListExpenseClaimsFiltered(r.Context(), repository.ExpenseClaimFilter{
		EmployeeID: claim.EmployeeID,
		TimeRange:  "all",
	})
	eval := services.EvaluateExpenseClaim(claim, employeeClaims, categories, cfg)

	precheck, err := services.RunExpenseClaimAIPreCheck(r.Context(), claim, eval, categories)
	if err != nil {
		http.Error(w, `{"error":"failed to run AI pre-check: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(precheck)
}

// FinalizePreApprovedExpenseClaims promotes pre_approved claims past their 5-day SLA to approved.
func (h *DispatchHandler) FinalizePreApprovedExpenseClaims(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	count, err := h.repo.FinalizeDuePreApprovedClaims(r.Context(), time.Now().UTC())
	if err != nil {
		http.Error(w, `{"error":"failed to finalize pre-approved expense claims: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"finalized": count,
		"checkedAt": time.Now().UTC().Format(time.RFC3339),
	})
}

// GetExpensePolicySettings returns global expense workflow settings (such as autoApproveDays).
func (h *DispatchHandler) GetExpensePolicySettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	settings, err := h.repo.GetExpensePolicySettings(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch expense policy settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(settings)
}

// SaveExpensePolicySettings updates the configurable pre-approval SLA days (admin, HR, or fleet).
func (h *DispatchHandler) SaveExpensePolicySettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	authUser := auth.GetUser(r.Context())
	if authUser == nil || (!authUser.CanManageExpensePolicyGroup("hr") && !authUser.CanManageExpensePolicyGroup("fleet")) {
		http.Error(w, `{"error":"forbidden: admin, HR, or fleet role required to update expense policy settings"}`, http.StatusForbidden)
		return
	}

	var req models.ExpensePolicySettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if req.AutoApproveDays < 1 || req.AutoApproveDays > 30 {
		http.Error(w, `{"error":"autoApproveDays must be between 1 and 30"}`, http.StatusBadRequest)
		return
	}
	if authUser.FullName != "" {
		req.UpdatedBy = authUser.FullName
	} else {
		req.UpdatedBy = authUser.Email
	}

	saved, err := h.repo.SaveExpensePolicySettings(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to save expense policy settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(saved)
}
