package services

import (
	"context"
	"strings"
	"testing"

	"dispatch-server/internal/repository"
)

func TestAIExpensePolicyTools_StrictGroupIsolationAndConfirm(t *testing.T) {
	ctx := context.Background()
	repo := repository.NewMemoryDispatchRepository()
	toolSvc := NewAIToolService(repo, nil, nil, nil, nil, nil)

	// 1. HR role attempting to change Fleet policy (bus_washing) MUST be blocked
	pending, reply, card, err := toolSvc.ParseAndPrepareExpensePolicyChange(
		ctx,
		"Update bus washing limit to $25 per pay period",
		"Alice HR",
		"HR",
		"en",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pending != nil || card != nil {
		t.Fatalf("expected HR to be denied from updating fleet policy, got pending=%v", pending)
	}
	if !strings.Contains(reply, "Permission Denied") {
		t.Fatalf("expected permission denied reply, got: %s", reply)
	}

	// 2. Fleet role attempting to change HR policy (drivers_medical) MUST be blocked
	pending, reply, card, err = toolSvc.ParseAndPrepareExpensePolicyChange(
		ctx,
		"Change drivers medical cap to $80 per year",
		"Bob Fleet",
		"fleet",
		"en",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pending != nil || card != nil {
		t.Fatalf("expected Fleet to be denied from updating HR policy")
	}
	if !strings.Contains(reply, "Permission Denied") {
		t.Fatalf("expected permission denied reply, got: %s", reply)
	}

	// 3. Fleet role updating Fleet policy (bus_washing) -> staged pending action -> confirmed -> persisted + audited
	pending, _, card, err = toolSvc.ParseAndPrepareExpensePolicyChange(
		ctx,
		"Update bus washing limit to $25 per pay period",
		"Bob Fleet",
		"fleet",
		"en",
	)
	if err != nil || pending == nil || card == nil {
		t.Fatalf("expected fleet policy update to stage confirmation card, err=%v pending=%v", err, pending)
	}
	if pending.ExpensePolicyAfter.MaxTotalAmount == nil || *pending.ExpensePolicyAfter.MaxTotalAmount != 25.00 {
		t.Fatalf("expected proposed maxTotalAmount 25.00, got %v", pending.ExpensePolicyAfter.MaxTotalAmount)
	}

	executed, err := toolSvc.ExecutePendingAction(ctx, pending.ID, "bob@company.com", "Bob Fleet", "fleet", nil)
	if err != nil {
		t.Fatalf("ExecutePendingAction failed: %v", err)
	}
	if executed.ExpensePolicyAfter.Version != 2 {
		t.Fatalf("expected version 2 after confirm, got %d", executed.ExpensePolicyAfter.Version)
	}

	// Verify persisted in repo + audit log recorded
	saved, err := repo.GetExpenseCategoryByCode(ctx, "bus_washing")
	if err != nil || saved == nil || saved.MaxTotalAmount == nil || *saved.MaxTotalAmount != 25.00 {
		t.Fatalf("expected persisted bus_washing limit 25.00, got %+v", saved)
	}
	logs, err := repo.ListExpensePolicyAuditLogs(ctx, "bus_washing", 10)
	if err != nil || len(logs) != 1 || logs[0].Source != "ai_copilot" {
		t.Fatalf("expected 1 ai_copilot audit log, got %d (%v)", len(logs), err)
	}
}
