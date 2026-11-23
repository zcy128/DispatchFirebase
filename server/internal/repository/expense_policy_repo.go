package repository

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"dispatch-server/internal/models"
)

const (
	expensePolicyAuditLogColl = "expense_policy_audit_logs"
	biweeklyPayrollConfigDoc  = "biweekly_payroll_config"
	expensePolicySettingsDoc  = "expense_policy_settings"
)

func float64Ptr(v float64) *float64 { return &v }

// defaultExpenseCategories returns the 8 standard HR & Fleet expense policies
// (LPN options and Van/Transit/ProMaster Washing removed per policy specification).
func defaultExpenseCategories() []*models.ExpenseCategory {
	return []*models.ExpenseCategory{
		{
			ID:                "cat-drivers_medical",
			Code:              "drivers_medical",
			DisplayName:       "Drivers Medical",
			LimitLabel:        "Up to $60.00 / year",
			ApproverGroup:     models.ExpenseApproverGroupHR,
			PeriodType:        models.ExpensePeriodYearly,
			MaxTotalAmount:    float64Ptr(60.00),
			RequireAttachment: true,
			AutoPreApprove:    true,
			AIReviewGuidance:  "Verify receipt is for commercial driver medical exam.",
			SortOrder:         1,
			Active:            true,
			Version:           1,
		},
		{
			ID:                "cat-road_test",
			Code:              "road_test",
			DisplayName:       "Road Test (after successful completion)",
			LimitLabel:        "Up to $155.00",
			ApproverGroup:     models.ExpenseApproverGroupHR,
			PeriodType:        models.ExpensePeriodPerClaim,
			MaxTotalAmount:    float64Ptr(155.00),
			RequireAttachment: true,
			AutoPreApprove:    false,
			AIReviewGuidance:  "Verify attachment proves successful completion of road test, not just payment.",
			SortOrder:         2,
			Active:            true,
			Version:           1,
		},
		{
			ID:                "cat-class4_knowledge_test",
			Code:              "class4_knowledge_test",
			DisplayName:       "Class 4 Knowledge Test (after successful completion)",
			LimitLabel:        "Up to $17.00",
			ApproverGroup:     models.ExpenseApproverGroupHR,
			PeriodType:        models.ExpensePeriodPerClaim,
			MaxTotalAmount:    float64Ptr(17.00),
			RequireAttachment: true,
			AutoPreApprove:    false,
			AIReviewGuidance:  "Verify attachment proves successful completion of Class 4 knowledge test.",
			SortOrder:         3,
			Active:            true,
			Version:           1,
		},
		{
			ID:                "cat-s_endorsement",
			Code:              "s_endorsement",
			DisplayName:       "S Endorsement Licence Addition",
			LimitLabel:        "Up to $28.00",
			ApproverGroup:     models.ExpenseApproverGroupHR,
			PeriodType:        models.ExpensePeriodPerClaim,
			MaxTotalAmount:    float64Ptr(28.00),
			RequireAttachment: true,
			AutoPreApprove:    true,
			AIReviewGuidance:  "Verify S Endorsement licence addition receipt.",
			SortOrder:         4,
			Active:            true,
			Version:           1,
		},
		{
			ID:                "cat-bus_washing",
			Code:              "bus_washing",
			DisplayName:       "Bus Washing",
			LimitLabel:        "Up to $20.00 / pay period",
			ApproverGroup:     models.ExpenseApproverGroupFleet,
			PeriodType:        models.ExpensePeriodBiweeklyPayPeriod,
			MaxTotalAmount:    float64Ptr(20.00),
			RequireAttachment: true,
			AutoPreApprove:    true,
			SortOrder:         5,
			Active:            true,
			Version:           1,
		},
		{
			ID:                "cat-washer_fluid",
			Code:              "washer_fluid",
			DisplayName:       "Washer Fluid",
			LimitLabel:        "Up to $5.00 / month",
			ApproverGroup:     models.ExpenseApproverGroupFleet,
			PeriodType:        models.ExpensePeriodMonthly,
			MaxTotalAmount:    float64Ptr(5.00),
			RequireAttachment: true,
			AutoPreApprove:    true,
			SortOrder:         6,
			Active:            true,
			Version:           1,
		},
		{
			ID:                "cat-other_hr",
			Code:              "other_hr",
			DisplayName:       "Other (HR)",
			LimitLabel:        "",
			ApproverGroup:     models.ExpenseApproverGroupHR,
			PeriodType:        models.ExpensePeriodPerClaim,
			MaxTotalAmount:    nil,
			RequireAttachment: false,
			SortOrder:         7,
			Active:            true,
			Version:           1,
		},
		{
			ID:                "cat-other_fleet",
			Code:              "other_fleet",
			DisplayName:       "Other (Fleet)",
			LimitLabel:        "",
			ApproverGroup:     models.ExpenseApproverGroupFleet,
			PeriodType:        models.ExpensePeriodPerClaim,
			MaxTotalAmount:    nil,
			RequireAttachment: false,
			SortOrder:         8,
			Active:            true,
			Version:           1,
		},
	}
}

func normalizeBiweeklyPayrollConfig(cfg *models.BiweeklyPayrollConfig) *models.BiweeklyPayrollConfig {
	def := models.DefaultBiweeklyPayrollConfig()
	if cfg == nil {
		return def
	}
	out := *cfg
	out.BiweeklyAnchorDate = strings.TrimSpace(out.BiweeklyAnchorDate)
	if len(out.BiweeklyAnchorDate) >= 10 {
		out.BiweeklyAnchorDate = out.BiweeklyAnchorDate[:10]
	}
	if _, err := time.Parse("2006-01-02", out.BiweeklyAnchorDate); err != nil {
		out.BiweeklyAnchorDate = def.BiweeklyAnchorDate
	}
	if out.PeriodLengthDays <= 0 {
		out.PeriodLengthDays = 14
	}
	if strings.TrimSpace(out.Timezone) == "" {
		out.Timezone = def.Timezone
	}
	return &out
}

func normalizeExpenseCategory(cat *models.ExpenseCategory) *models.ExpenseCategory {
	if cat == nil {
		return nil
	}
	cp := *cat
	cp.Code = strings.ToLower(strings.TrimSpace(cp.Code))
	cp.DisplayName = strings.TrimSpace(cp.DisplayName)
	cp.ApproverGroup = strings.ToLower(strings.TrimSpace(cp.ApproverGroup))
	if cp.ApproverGroup != models.ExpenseApproverGroupHR && cp.ApproverGroup != models.ExpenseApproverGroupFleet {
		cp.ApproverGroup = models.ExpenseApproverGroupHR
	}
	cp.PeriodType = strings.ToLower(strings.TrimSpace(cp.PeriodType))
	switch cp.PeriodType {
	case models.ExpensePeriodPerClaim,
		models.ExpensePeriodOneTime,
		models.ExpensePeriodBiweeklyPayPeriod,
		models.ExpensePeriodMonthly,
		models.ExpensePeriodYearly:
	default:
		cp.PeriodType = models.ExpensePeriodPerClaim
	}
	if cp.MaxTotalAmount != nil {
		v := models.RoundCurrencyHalfUp(*cp.MaxTotalAmount)
		cp.MaxTotalAmount = &v
	}
	if strings.TrimSpace(cp.LimitLabel) == "" && cp.MaxTotalAmount != nil {
		cp.LimitLabel = models.FormatExpenseLimitLabel(cp.MaxTotalAmount, cp.PeriodType)
	}
	if cp.ID == "" && cp.Code != "" {
		cp.ID = "cat-" + cp.Code
	}
	if cp.Version <= 0 {
		cp.Version = 1
	}
	return &cp
}

// ─── Firestore Implementations ──────────────────────────────────────────────

func (r *FirestoreDispatchRepository) GetBiweeklyPayrollConfig(ctx context.Context) (*models.BiweeklyPayrollConfig, error) {
	docRef := r.client.Collection("system_settings").Doc(biweeklyPayrollConfigDoc)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return models.DefaultBiweeklyPayrollConfig(), nil
	}
	var cfg models.BiweeklyPayrollConfig
	if err := snap.DataTo(&cfg); err != nil {
		return models.DefaultBiweeklyPayrollConfig(), nil
	}
	return normalizeBiweeklyPayrollConfig(&cfg), nil
}

func (r *FirestoreDispatchRepository) SaveBiweeklyPayrollConfig(ctx context.Context, cfg *models.BiweeklyPayrollConfig) (*models.BiweeklyPayrollConfig, error) {
	cfg = normalizeBiweeklyPayrollConfig(cfg)
	cfg.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	docRef := r.client.Collection("system_settings").Doc(biweeklyPayrollConfigDoc)
	if _, err := docRef.Set(ctx, cfg); err != nil {
		return nil, fmt.Errorf("failed to save biweekly payroll config: %w", err)
	}
	return cfg, nil
}

func normalizeExpensePolicySettings(s *models.ExpensePolicySettings) *models.ExpensePolicySettings {
	def := models.DefaultExpensePolicySettings()
	if s == nil {
		return def
	}
	out := *s
	if out.AutoApproveDays < 1 || out.AutoApproveDays > 30 {
		out.AutoApproveDays = def.AutoApproveDays
	}
	return &out
}

func (r *FirestoreDispatchRepository) GetExpensePolicySettings(ctx context.Context) (*models.ExpensePolicySettings, error) {
	docRef := r.client.Collection("system_settings").Doc(expensePolicySettingsDoc)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return models.DefaultExpensePolicySettings(), nil
	}
	var s models.ExpensePolicySettings
	if err := snap.DataTo(&s); err != nil {
		return models.DefaultExpensePolicySettings(), nil
	}
	return normalizeExpensePolicySettings(&s), nil
}

func (r *FirestoreDispatchRepository) SaveExpensePolicySettings(ctx context.Context, settings *models.ExpensePolicySettings) (*models.ExpensePolicySettings, error) {
	settings = normalizeExpensePolicySettings(settings)
	settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	docRef := r.client.Collection("system_settings").Doc(expensePolicySettingsDoc)
	if _, err := docRef.Set(ctx, settings); err != nil {
		return nil, fmt.Errorf("failed to save expense policy settings: %w", err)
	}
	return settings, nil
}

func (r *FirestoreDispatchRepository) ListAllExpenseCategories(ctx context.Context) ([]*models.ExpenseCategory, error) {
	iter := r.client.Collection(r.expenseCategoryColl).Documents(ctx)
	defer iter.Stop()

	var results []*models.ExpenseCategory
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var cat models.ExpenseCategory
		if err := doc.DataTo(&cat); err == nil {
			cat.ID = doc.Ref.ID
			results = append(results, normalizeExpenseCategory(&cat))
		}
	}
	if len(results) == 0 {
		return defaultExpenseCategories(), nil
	}
	sort.Slice(results, func(i, j int) bool {
		if results[i].SortOrder != results[j].SortOrder {
			return results[i].SortOrder < results[j].SortOrder
		}
		return results[i].Code < results[j].Code
	})
	return results, nil
}

func (r *FirestoreDispatchRepository) GetExpenseCategoryByCode(ctx context.Context, code string) (*models.ExpenseCategory, error) {
	normCode := strings.ToLower(strings.TrimSpace(code))
	if normCode == "" {
		return nil, fmt.Errorf("category code is required")
	}
	all, err := r.ListAllExpenseCategories(ctx)
	if err != nil {
		return nil, err
	}
	for _, cat := range all {
		if strings.EqualFold(cat.Code, normCode) {
			return cat, nil
		}
	}
	return nil, nil
}

func (r *FirestoreDispatchRepository) UpsertExpenseCategory(
	ctx context.Context,
	cat *models.ExpenseCategory,
	audit *models.ExpensePolicyAuditLog,
) (*models.ExpenseCategory, error) {
	norm := normalizeExpenseCategory(cat)
	if norm == nil || norm.Code == "" {
		return nil, fmt.Errorf("category code is required")
	}
	norm.UpdatedAt = time.Now().UTC()

	// Seed defaults into Firestore on first write so defaults don't vanish when 1 doc is written
	existingSnap, err := r.client.Collection(r.expenseCategoryColl).Limit(1).Documents(ctx).GetAll()
	if err == nil && len(existingSnap) == 0 {
		for _, def := range defaultExpenseCategories() {
			if strings.EqualFold(def.Code, norm.Code) {
				continue
			}
			_, _ = r.client.Collection(r.expenseCategoryColl).Doc(def.ID).Set(ctx, def)
		}
	}

	docRef := r.client.Collection(r.expenseCategoryColl).Doc(norm.ID)
	if _, err := docRef.Set(ctx, norm); err != nil {
		return nil, fmt.Errorf("failed to upsert expense category %s: %w", norm.Code, err)
	}

	if audit != nil {
		auditRef := r.client.Collection(expensePolicyAuditLogColl).NewDoc()
		audit.ID = auditRef.ID
		if audit.CreatedAt.IsZero() {
			audit.CreatedAt = time.Now().UTC()
		}
		_, _ = auditRef.Set(ctx, audit)
	}
	return norm, nil
}

func (r *FirestoreDispatchRepository) ListExpensePolicyAuditLogs(ctx context.Context, categoryCode string, limit int) ([]*models.ExpensePolicyAuditLog, error) {
	if limit <= 0 {
		limit = 50
	}
	q := r.client.Collection(expensePolicyAuditLogColl).OrderBy("createdAt", firestore.Desc).Limit(limit)
	iter := q.Documents(ctx)
	defer iter.Stop()

	normCode := strings.ToLower(strings.TrimSpace(categoryCode))
	var results []*models.ExpensePolicyAuditLog
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var rec models.ExpensePolicyAuditLog
		if err := doc.DataTo(&rec); err == nil {
			rec.ID = doc.Ref.ID
			if normCode != "" && !strings.EqualFold(rec.CategoryCode, normCode) {
				continue
			}
			results = append(results, &rec)
		}
	}
	return results, nil
}

// FinalizeDuePreApprovedClaims promotes any pre_approved claims whose 5-day review deadline has
// elapsed into final approved status so they are released to Finance/Payroll.
func (r *FirestoreDispatchRepository) FinalizeDuePreApprovedClaims(ctx context.Context, now time.Time) (int, error) {
	nowUTC := now.UTC()
	iter := r.client.Collection(r.expenseReimbursementColl).
		Where("status", "==", "pre_approved").
		Documents(ctx)
	defer iter.Stop()

	finalized := 0
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return finalized, fmt.Errorf("iterate pre_approved claims: %w", err)
		}
		var rec models.ExpenseReimbursement
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		if rec.AutoApproveDeadline == nil || rec.AutoApproveDeadline.After(nowUTC) {
			continue
		}

		note := strings.TrimSpace(rec.ApprovalNotes)
		if note == "" {
			note = "Auto-finalized after 5-day pre-approval review window with no manual intervention."
		}
		updates := []firestore.Update{
			{Path: "status", Value: "approved"},
			{Path: "autoApproved", Value: true},
			{Path: "approvedByName", Value: "AI Policy Auto-Approval (5-Day SLA)"},
			{Path: "approvedAt", Value: &nowUTC},
			{Path: "approvalNotes", Value: note},
			{Path: "updatedAt", Value: nowUTC},
		}
		if _, err := doc.Ref.Update(ctx, updates); err == nil {
			finalized++
		}
	}
	return finalized, nil
}

// ─── Memory Implementations ─────────────────────────────────────────────────

func (m *MemoryDispatchRepository) GetBiweeklyPayrollConfig(ctx context.Context) (*models.BiweeklyPayrollConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return normalizeBiweeklyPayrollConfig(m.biweeklyPayrollConfig), nil
}

func (m *MemoryDispatchRepository) SaveBiweeklyPayrollConfig(ctx context.Context, cfg *models.BiweeklyPayrollConfig) (*models.BiweeklyPayrollConfig, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg = normalizeBiweeklyPayrollConfig(cfg)
	cfg.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	m.biweeklyPayrollConfig = cfg
	return cfg, nil
}

func (m *MemoryDispatchRepository) GetExpensePolicySettings(ctx context.Context) (*models.ExpensePolicySettings, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return normalizeExpensePolicySettings(m.expensePolicySettings), nil
}

func (m *MemoryDispatchRepository) SaveExpensePolicySettings(ctx context.Context, settings *models.ExpensePolicySettings) (*models.ExpensePolicySettings, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	settings = normalizeExpensePolicySettings(settings)
	settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	m.expensePolicySettings = settings
	return settings, nil
}

func (m *MemoryDispatchRepository) ListAllExpenseCategories(ctx context.Context) ([]*models.ExpenseCategory, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	results := make([]*models.ExpenseCategory, 0, len(m.expenseCategories))
	for _, cat := range m.expenseCategories {
		results = append(results, normalizeExpenseCategory(cat))
	}
	sort.Slice(results, func(i, j int) bool {
		if results[i].SortOrder != results[j].SortOrder {
			return results[i].SortOrder < results[j].SortOrder
		}
		return results[i].Code < results[j].Code
	})
	return results, nil
}

func (m *MemoryDispatchRepository) GetExpenseCategoryByCode(ctx context.Context, code string) (*models.ExpenseCategory, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	normCode := strings.ToLower(strings.TrimSpace(code))
	if cat, ok := m.expenseCategories[normCode]; ok {
		return normalizeExpenseCategory(cat), nil
	}
	return nil, nil
}

func (m *MemoryDispatchRepository) UpsertExpenseCategory(
	ctx context.Context,
	cat *models.ExpenseCategory,
	audit *models.ExpensePolicyAuditLog,
) (*models.ExpenseCategory, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	norm := normalizeExpenseCategory(cat)
	if norm == nil || norm.Code == "" {
		return nil, fmt.Errorf("category code is required")
	}
	norm.UpdatedAt = time.Now().UTC()
	m.expenseCategories[norm.Code] = norm

	if audit != nil {
		cp := *audit
		if cp.ID == "" {
			cp.ID = fmt.Sprintf("audit-%d", time.Now().UTC().UnixNano())
		}
		if cp.CreatedAt.IsZero() {
			cp.CreatedAt = time.Now().UTC()
		}
		m.expensePolicyAuditLogs = append([]*models.ExpensePolicyAuditLog{&cp}, m.expensePolicyAuditLogs...)
	}
	return norm, nil
}

func (m *MemoryDispatchRepository) ListExpensePolicyAuditLogs(ctx context.Context, categoryCode string, limit int) ([]*models.ExpensePolicyAuditLog, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if limit <= 0 {
		limit = 50
	}
	normCode := strings.ToLower(strings.TrimSpace(categoryCode))
	results := make([]*models.ExpensePolicyAuditLog, 0, len(m.expensePolicyAuditLogs))
	for _, rec := range m.expensePolicyAuditLogs {
		if normCode != "" && !strings.EqualFold(rec.CategoryCode, normCode) {
			continue
		}
		results = append(results, rec)
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

func (m *MemoryDispatchRepository) FinalizeDuePreApprovedClaims(ctx context.Context, now time.Time) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	nowUTC := now.UTC()
	finalized := 0
	for _, rec := range m.expenseClaims {
		if rec == nil || rec.Status != "pre_approved" {
			continue
		}
		if rec.AutoApproveDeadline == nil || rec.AutoApproveDeadline.After(nowUTC) {
			continue
		}
		rec.Status = "approved"
		rec.AutoApproved = true
		rec.ApprovedByName = "AI Policy Auto-Approval (5-Day SLA)"
		t := nowUTC
		rec.ApprovedAt = &t
		if strings.TrimSpace(rec.ApprovalNotes) == "" {
			rec.ApprovalNotes = "Auto-finalized after 5-day pre-approval review window with no manual intervention."
		}
		rec.UpdatedAt = nowUTC
		finalized++
	}
	return finalized, nil
}
