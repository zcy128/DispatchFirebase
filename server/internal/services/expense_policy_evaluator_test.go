package services

import (
	"testing"
	"time"

	"dispatch-server/internal/models"
)

func expenseFloatPtr(v float64) *float64 { return &v }
func expenseIntPtr(v int) *int           { return &v }

func TestResolveBiweeklyPayPeriod(t *testing.T) {
	// Anchor Sunday 2026-01-04 -> Period 0: 2026-01-04..2026-01-17
	// Period 1: 2026-01-18..2026-01-31
	// Period -1: 2025-12-21..2026-01-03
	cases := []struct {
		date      string
		wantStart string
		wantEnd   string
	}{
		{"2026-01-04", "2026-01-04", "2026-01-17"},
		{"2026-01-17", "2026-01-04", "2026-01-17"},
		{"2026-01-18", "2026-01-18", "2026-01-31"},
		{"2026-01-03", "2025-12-21", "2026-01-03"},
		{"2025-12-21", "2025-12-21", "2026-01-03"},
		{"2025-12-20", "2025-12-07", "2025-12-20"},
	}

	for _, tc := range cases {
		gotStart, gotEnd, err := ResolveBiweeklyPayPeriod(tc.date, "2026-01-04", 14)
		if err != nil {
			t.Fatalf("ResolveBiweeklyPayPeriod(%s) unexpected error: %v", tc.date, err)
		}
		if gotStart != tc.wantStart || gotEnd != tc.wantEnd {
			t.Errorf("date %s: got [%s, %s], want [%s, %s]", tc.date, gotStart, gotEnd, tc.wantStart, tc.wantEnd)
		}
	}
}

func TestEvaluateExpenseClaim_BiweeklyCumulativeBusWashing(t *testing.T) {
	cfg := &models.BiweeklyPayrollConfig{
		BiweeklyAnchorDate: "2026-01-04",
		PeriodLengthDays:   14,
	}
	categories := []*models.ExpenseCategory{
		{
			Code:           "bus_washing",
			DisplayName:    "Bus Washing",
			ApproverGroup:  models.ExpenseApproverGroupFleet,
			PeriodType:     models.ExpensePeriodBiweeklyPayPeriod,
			MaxTotalAmount: expenseFloatPtr(20.00),
			Active:         true,
		},
	}

	history := []*models.ExpenseReimbursement{
		{
			ID:         "hist-1",
			EmployeeID: "emp-1",
			ClaimDate:  "2026-01-05", // Same pay period (2026-01-04..2026-01-17)
			Status:     "approved",
			Lines:      []models.ExpenseReimbursementLine{{ID: "l1", CategoryCode: "bus_washing", Amount: 10.00}},
		},
		{
			ID:         "hist-rejected",
			EmployeeID: "emp-1",
			ClaimDate:  "2026-01-06",
			Status:     "rejected", // Must be ignored
			Lines:      []models.ExpenseReimbursementLine{{ID: "l2", CategoryCode: "bus_washing", Amount: 20.00}},
		},
		{
			ID:         "hist-prev-period",
			EmployeeID: "emp-1",
			ClaimDate:  "2026-01-03", // Previous pay period
			Status:     "approved",
			Lines:      []models.ExpenseReimbursementLine{{ID: "l3", CategoryCode: "bus_washing", Amount: 20.00}},
		},
	}

	// Case 1: $10 approved + $10 current = $20 <= $20 -> PASS
	claimPass := &models.ExpenseReimbursement{
		ID:         "curr-1",
		EmployeeID: "emp-1",
		ClaimDate:  "2026-01-15",
		Status:     "pending",
		Lines:      []models.ExpenseReimbursementLine{{ID: "c1", CategoryCode: "bus_washing", Amount: 10.00}},
	}
	evalPass := EvaluateExpenseClaim(claimPass, history, categories, cfg)
	if evalPass.Status != models.ExpenseEvalPass {
		t.Fatalf("expected pass for $10+$10=$20, got %s (%v)", evalPass.Status, evalPass.Lines[0].Reasons)
	}
	if evalPass.Lines[0].ApprovedAmount != 10.00 || evalPass.Lines[0].ProjectedApproved != 20.00 {
		t.Fatalf("unexpected amounts: approved=%.2f projected=%.2f", evalPass.Lines[0].ApprovedAmount, evalPass.Lines[0].ProjectedApproved)
	}

	// Case 2: $10 approved + $10.01 current = $20.01 > $20 -> VIOLATION
	claimFail := &models.ExpenseReimbursement{
		ID:         "curr-2",
		EmployeeID: "emp-1",
		ClaimDate:  "2026-01-15",
		Status:     "pending",
		Lines:      []models.ExpenseReimbursementLine{{ID: "c2", CategoryCode: "bus_washing", Amount: 10.01}},
	}
	evalFail := EvaluateExpenseClaim(claimFail, history, categories, cfg)
	if evalFail.Status != models.ExpenseEvalViolation || !evalFail.RequiresOverride {
		t.Fatalf("expected violation with requiresOverride=true, got status=%s override=%v", evalFail.Status, evalFail.RequiresOverride)
	}
}

func TestEvaluateExpenseClaim_PendingWarningAndCountCap(t *testing.T) {
	cfg := models.DefaultBiweeklyPayrollConfig()
	categories := []*models.ExpenseCategory{
		{
			Code:              "drivers_medical",
			DisplayName:       "Drivers Medical",
			ApproverGroup:     models.ExpenseApproverGroupHR,
			PeriodType:        models.ExpensePeriodYearly,
			MaxTotalAmount:    expenseFloatPtr(60.00),
			MaxCountPerPeriod: expenseIntPtr(1),
			Active:            true,
		},
	}

	history := []*models.ExpenseReimbursement{
		{
			ID:         "pending-other",
			EmployeeID: "emp-2",
			ClaimDate:  "2026-03-10",
			Status:     "pending",
			Lines:      []models.ExpenseReimbursementLine{{ID: "p1", CategoryCode: "drivers_medical", Amount: 50.00}},
		},
	}

	claim := &models.ExpenseReimbursement{
		ID:         "curr-3",
		EmployeeID: "emp-2",
		ClaimDate:  "2026-08-01",
		Status:     "pending",
		Lines:      []models.ExpenseReimbursementLine{{ID: "c3", CategoryCode: "drivers_medical", Amount: 45.00}},
	}

	eval := EvaluateExpenseClaim(claim, history, categories, cfg)
	if eval.Status != models.ExpenseEvalWarning {
		t.Fatalf("expected warning due to other pending claim, got %s", eval.Status)
	}
	if eval.RequiresOverride {
		t.Fatalf("warning should not require override")
	}
}

func TestRunExpenseClaimAIPreCheck(t *testing.T) {
	categories := []*models.ExpenseCategory{
		{
			Code:              "road_test",
			DisplayName:       "Road Test (after successful completion)",
			ApproverGroup:     models.ExpenseApproverGroupHR,
			PeriodType:        models.ExpensePeriodPerClaim,
			MaxTotalAmount:    expenseFloatPtr(155.00),
			RequireAttachment: true,
			AIReviewGuidance:  "Verify attachment proves successful completion of road test, not just payment.",
			Active:            true,
		},
	}

	// Missing attachment -> missing_proof
	claimNoAtt := &models.ExpenseReimbursement{
		ID:          "claim-rt-1",
		EmployeeID:  "emp-10",
		ClaimDate:   "2026-05-01",
		TotalAmount: 150.00,
		Lines:       []models.ExpenseReimbursementLine{{ID: "l1", CategoryCode: "road_test", CategoryDisplayName: "Road Test", Amount: 150.00}},
	}
	res1, err := RunExpenseClaimAIPreCheck(t.Context(), claimNoAtt, nil, categories)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res1.Status != "missing_proof" {
		t.Fatalf("expected missing_proof when attachment is absent, got %s", res1.Status)
	}

	// Attachment present + soft guidance -> attention
	claimWithAtt := &models.ExpenseReimbursement{
		ID:             "claim-rt-2",
		EmployeeID:     "emp-10",
		ClaimDate:      "2026-05-01",
		TotalAmount:    150.00,
		AttachmentURLs: []string{"https://example.com/receipt.jpg"},
		Lines:          []models.ExpenseReimbursementLine{{ID: "l1", CategoryCode: "road_test", CategoryDisplayName: "Road Test", Amount: 150.00}},
	}
	res2, err := RunExpenseClaimAIPreCheck(t.Context(), claimWithAtt, nil, categories)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res2.Status != "attention" || len(res2.Findings) != 1 || !res2.Findings[0].ReceiptVerified {
		t.Fatalf("expected attention status with verified receipt, got %+v", res2)
	}
}

func TestValidateSingleCategoryClaimAndAutoPreApprove(t *testing.T) {
	// Multi-line same category is allowed
	code, err := ValidateSingleCategoryClaim([]models.ExpenseReimbursementLinePayload{
		{CategoryCode: "bus_washing", Amount: 10.00},
		{CategoryCode: "bus_washing", Amount: 8.50},
	})
	if err != nil || code != "bus_washing" {
		t.Fatalf("expected same-category multi-line claim to pass, got code=%s err=%v", code, err)
	}

	// Mixed categories in one claim MUST be rejected
	if _, err := ValidateSingleCategoryClaim([]models.ExpenseReimbursementLinePayload{
		{CategoryCode: "bus_washing", Amount: 10.00},
		{CategoryCode: "washer_fluid", Amount: 4.00},
	}); err == nil {
		t.Fatalf("expected mixed-category claim to be rejected")
	}

	cfg := models.DefaultBiweeklyPayrollConfig()
	categories := []*models.ExpenseCategory{
		{
			Code:              "bus_washing",
			DisplayName:       "Bus Washing",
			ApproverGroup:     models.ExpenseApproverGroupFleet,
			PeriodType:        models.ExpensePeriodBiweeklyPayPeriod,
			MaxTotalAmount:    expenseFloatPtr(20.00),
			RequireAttachment: true,
			AutoPreApprove:    true,
			Active:            true,
		},
		{
			Code:              "road_test",
			DisplayName:       "Road Test",
			ApproverGroup:     models.ExpenseApproverGroupHR,
			PeriodType:        models.ExpensePeriodPerClaim,
			MaxTotalAmount:    expenseFloatPtr(155.00),
			RequireAttachment: true,
			AutoPreApprove:    false,
			Active:            true,
		},
	}

	submittedAt := time.Date(2026, 11, 23, 15, 0, 0, 0, time.UTC)

	// Eligible bus_washing with attachment and within cap -> pre_approved + 5 calendar days
	washClaim := &models.ExpenseReimbursement{
		ID:             "c-wash",
		EmployeeID:     "emp-1",
		ClaimDate:      "2026-11-23",
		AttachmentURLs: []string{"receipt.jpg"},
		Lines:          []models.ExpenseReimbursementLine{{ID: "l1", CategoryCode: "bus_washing", Amount: 18.00}},
	}
	evalWash := EvaluateExpenseClaim(washClaim, nil, categories, cfg)
	ok, deadline, _ := ShouldAutoPreApproveClaim(washClaim, evalWash, categories, submittedAt, 5)
	if !ok || deadline == nil {
		t.Fatalf("expected eligible bus_washing claim to auto pre-approve")
	}
	wantDeadline := submittedAt.Add(5 * 24 * time.Hour)
	if !deadline.Equal(wantDeadline) {
		t.Fatalf("expected 5-day deadline %v, got %v", wantDeadline, *deadline)
	}

	// Custom 7-day SLA window
	ok7, deadline7, _ := ShouldAutoPreApproveClaim(washClaim, evalWash, categories, submittedAt, 7)
	if !ok7 || deadline7 == nil || !deadline7.Equal(submittedAt.Add(7*24*time.Hour)) {
		t.Fatalf("expected 7-day deadline when autoApproveDays=7, got %v", deadline7)
	}

	// Road Test (autoPreApprove=false) MUST stay pending
	roadClaim := &models.ExpenseReimbursement{
		ID:             "c-road",
		EmployeeID:     "emp-1",
		ClaimDate:      "2026-11-23",
		AttachmentURLs: []string{"pass.jpg"},
		Lines:          []models.ExpenseReimbursementLine{{ID: "l1", CategoryCode: "road_test", Amount: 150.00}},
	}
	evalRoad := EvaluateExpenseClaim(roadClaim, nil, categories, cfg)
	if ok, _, _ := ShouldAutoPreApproveClaim(roadClaim, evalRoad, categories, submittedAt, 5); ok {
		t.Fatalf("expected road_test claim NOT to auto pre-approve")
	}
}
