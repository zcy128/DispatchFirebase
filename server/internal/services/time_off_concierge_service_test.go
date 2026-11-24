package services

import (
	"context"
	"strings"
	"testing"
	"time"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

func TestOfficeConciergeFlow_NamedPeerConflictAnd24hSLA(t *testing.T) {
	ctx := context.Background()
	repo := repository.NewMemoryDispatchRepository()
	svc := NewOfficeConciergeService(repo, nil, nil)

	// 1. Employee initiates: "I want to take tomorrow off"
	res1, err := svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-101",
		EmployeeName: "Alex Driver",
		Message:      "I want to take tomorrow off",
		ReferenceNow: "2026-11-23",
	})
	if err != nil {
		t.Fatalf("step 1 error: %v", err)
	}
	if res1.Step != "confirm_schedule" || !strings.Contains(res1.Reply, "ODSOE-001") {
		t.Fatalf("expected schedule confirmation for ODSOE-001, got step=%s reply=%s", res1.Step, res1.Reply)
	}

	// 2. Employee confirms schedule -> prompted for LeaveType
	res2, err := svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-101",
		EmployeeName: "Alex Driver",
		Message:      "Yes",
	})
	if err != nil || res2.Step != "select_leave_type" || res2.Card == nil || res2.Card.Type != "leave_type_selector" {
		t.Fatalf("expected leave_type_selector card, got step=%s card=%v", res2.Step, res2.Card)
	}

	// 3. Employee selects Personal Days -> asked for substitute
	res3, err := svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-101",
		EmployeeName: "Alex Driver",
		Action:       "select_leave_type",
		LeaveType:    string(models.LeaveTypePersonalDays),
	})
	if err != nil || res3.Step != "ask_substitute" {
		t.Fatalf("expected ask_substitute step, got %s", res3.Step)
	}

	// 4. Employee says "Yes, driver22" -> Conflict detected on ODSOE-007!
	res4, err := svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-101",
		EmployeeName: "Alex Driver",
		Message:      "Yes, driver22",
	})
	if err != nil || res4.Step != "ask_substitute" || !strings.Contains(res4.Reply, "ODSOE-007") {
		t.Fatalf("expected conflict on ODSOE-007 for driver22, got step=%s reply=%s", res4.Step, res4.Reply)
	}

	// 5. Employee corrects: "Sorry, it is driver41" -> No conflict -> Preview card returned!
	res5, err := svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-101",
		EmployeeName: "Alex Driver",
		Message:      "Sorry, it is driver41",
	})
	if err != nil || res5.Step != "preview_confirm" || res5.Card == nil || res5.Card.Type != "time_off_preview" {
		t.Fatalf("expected time_off_preview card for driver41, got step=%s card=%v", res5.Step, res5.Card)
	}

	// 6. Employee confirms preview -> Request created in awaiting_peer_confirm + invite sent to DRIVER41
	res6, err := svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-101",
		EmployeeName: "Alex Driver",
		Action:       "confirm_preview",
	})
	if err != nil || res6.Request == nil {
		t.Fatalf("expected created TimeOffRequest, err=%v", err)
	}
	if res6.Request.Status != models.TimeOffStatusAwaitingPeerConfirm {
		t.Fatalf("expected status awaiting_peer_confirm, got %s", res6.Request.Status)
	}

	// Verify Driver41 received peer_cover_invite in their Office Chat
	d41Msgs := svc.GetEmployeeMessages("DRIVER41")
	if len(d41Msgs) == 0 || d41Msgs[len(d41Msgs)-1].Card == nil || d41Msgs[len(d41Msgs)-1].Card.Type != "peer_cover_invite" {
		t.Fatalf("expected DRIVER41 to receive peer_cover_invite card, got %+v", d41Msgs)
	}

	// 7. Driver41 accepts cover -> Status transitions to pre_approved + 24h SLA
	preApprovedReq, err := svc.ConfirmPeerCover(ctx, res6.Request.ID, &models.ConfirmPeerCoverPayload{
		DriverID:   "DRIVER41",
		DriverName: "Driver41 Doe",
		Accepted:   true,
	})
	if err != nil || preApprovedReq.Status != models.TimeOffStatusPreApproved {
		t.Fatalf("expected status pre_approved after peer confirmation, got %v (err=%v)", preApprovedReq, err)
	}

	// 8. Simulate 24h SLA elapsed -> Auto-approved + notification pushed to employee chat
	future := time.Now().UTC().Add(25 * time.Hour)
	count, err := svc.RunPreApprovedAutoFinalizationSweep(ctx, future)
	if err != nil || count != 1 {
		t.Fatalf("expected 1 request auto-finalized after 24h, got %d (err=%v)", count, err)
	}
	finalReq, _ := repo.GetTimeOffRequestByID(ctx, res6.Request.ID)
	if finalReq.Status != models.TimeOffStatusApproved || !finalReq.AutoApproved {
		t.Fatalf("expected approved + autoApproved=true, got %+v", finalReq)
	}
}

func TestOfficeConciergeFlow_AutoBroadcastSplitByShift(t *testing.T) {
	ctx := context.Background()
	repo := repository.NewMemoryDispatchRepository()
	svc := NewOfficeConciergeService(repo, nil, nil)

	// Start sick leave tomorrow without substitute
	_, _ = svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-202",
		EmployeeName: "Sarah Driver",
		Message:      "I want to take tomorrow off for sick leave",
		ReferenceNow: "2026-11-23",
	})
	_, _ = svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-202",
		EmployeeName: "Sarah Driver",
		Message:      "yes",
	})
	_, _ = svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-202",
		EmployeeName: "Sarah Driver",
		Message:      "no",
	})
	resSubmit, err := svc.ProcessOfficeConciergeChat(ctx, &models.OfficeConciergeChatRequest{
		EmployeeID:   "EMP-202",
		EmployeeName: "Sarah Driver",
		Action:       "confirm_preview",
	})
	if err != nil || resSubmit.Request == nil {
		t.Fatalf("submit failed: %v", err)
	}
	reqID := resSubmit.Request.ID
	if resSubmit.Request.Status != models.TimeOffStatusSeekingCoverage || len(resSubmit.Request.CoverageSlots) != 2 {
		t.Fatalf("expected seeking_coverage with 2 split shift slots (AM & PM), got %+v", resSubmit.Request)
	}

	// Driver A claims AM slot -> still seeking_coverage (1/2 filled)
	afterAM, err := svc.ClaimCoverageSlot(ctx, reqID, &models.ClaimTimeOffSlotPayload{
		SlotID:     "2026-11-24_AM",
		DriverID:   "DRIVER-31",
		DriverName: "Driver31 AMCover",
	})
	if err != nil || afterAM.Status != models.TimeOffStatusSeekingCoverage {
		t.Fatalf("expected seeking_coverage after 1/2 slots filled, got %v (err=%v)", afterAM, err)
	}

	// Driver B claims PM slot -> all slots filled within 2-week auto-cover window -> auto-approved!
	afterPM, err := svc.ClaimCoverageSlot(ctx, reqID, &models.ClaimTimeOffSlotPayload{
		SlotID:     "2026-11-24_PM",
		DriverID:   "DRIVER-41",
		DriverName: "Driver41 PMCover",
	})
	if err != nil || (afterPM.Status != models.TimeOffStatusApproved && afterPM.Status != models.TimeOffStatusPreApproved) {
		t.Fatalf("expected approved or pre_approved once both AM and PM slots are filled, got %v (err=%v)", afterPM, err)
	}
}

func TestOfficeConcierge_OnHoldAndConfigurableTimingWindows(t *testing.T) {
	ctx := context.Background()
	repo := repository.NewMemoryDispatchRepository()
	svc := NewOfficeConciergeService(repo, nil, nil)

	// Customize policy settings: > 90 days manual only, <= 14 days auto-cover & auto-approve
	_, err := repo.SaveTimeOffPolicySettings(ctx, &models.TimeOffPolicySettings{
		FarFutureManualOnlyDays: 90,
		AutoCoverWindowDays:     14,
	})
	if err != nil {
		t.Fatalf("failed to save policy settings: %v", err)
	}

	now := time.Now().UTC()
	farDate := now.AddDate(0, 0, 100).Format("2006-01-02")
	nearDate := now.AddDate(0, 0, 7).Format("2006-01-02")

	// 1. Far-future request (>90 days) should stay pending and NOT auto-broadcast
	farReq, err := repo.CreateTimeOffRequest(ctx, &models.CreateTimeOffRequestPayload{
		EmployeeID:   "EMP-301",
		EmployeeName: "Far Future Driver",
		RouteNo:      "ODSOE-010",
		LeaveType:    models.LeaveTypeVacation,
		StartDate:    farDate,
		EndDate:      farDate,
		ShiftType:    "ALL",
	})
	if err != nil {
		t.Fatalf("create farReq failed: %v", err)
	}
	time.Sleep(2 * time.Millisecond)

	// 2. Near-term pending request (within 14 days) should auto-broadcast during sweep
	nearReq, err := repo.CreateTimeOffRequest(ctx, &models.CreateTimeOffRequestPayload{
		EmployeeID:   "EMP-302",
		EmployeeName: "Near Term Driver",
		RouteNo:      "ODSOE-011",
		LeaveType:    models.LeaveTypePersonalDays,
		StartDate:    nearDate,
		EndDate:      nearDate,
		ShiftType:    "ALL",
	})
	if err != nil {
		t.Fatalf("create nearReq failed: %v", err)
	}
	time.Sleep(2 * time.Millisecond)

	// 3. On-Hold near-term request must NOT enter auto-broadcast or auto-approval
	holdReq, err := repo.CreateTimeOffRequest(ctx, &models.CreateTimeOffRequestPayload{
		EmployeeID:   "EMP-303",
		EmployeeName: "On Hold Driver",
		RouteNo:      "ODSOE-012",
		LeaveType:    models.LeaveTypePersonalDays,
		StartDate:    nearDate,
		EndDate:      nearDate,
		ShiftType:    "ALL",
	})
	if err != nil {
		t.Fatalf("create holdReq failed: %v", err)
	}
	if _, err := repo.HoldTimeOffRequest(ctx, holdReq.ID, &models.ReviewTimeOffRequestPayload{
		ReviewerUserID: "HR-1",
		ReviewerName:   "HR Admin",
		ApprovalNotes:  "Hold for verification",
	}); err != nil {
		t.Fatalf("HoldTimeOffRequest failed: %v", err)
	}

	// Run sweep
	if _, err := svc.RunPreApprovedAutoFinalizationSweep(ctx, now); err != nil {
		t.Fatalf("sweep failed: %v", err)
	}

	farAfter, _ := repo.GetTimeOffRequestByID(ctx, farReq.ID)
	if farAfter.Status != models.TimeOffStatusPending {
		t.Fatalf("expected far-future (>90d) request to stay pending, got %s", farAfter.Status)
	}

	nearAfter, _ := repo.GetTimeOffRequestByID(ctx, nearReq.ID)
	if nearAfter.Status != models.TimeOffStatusSeekingCoverage {
		t.Fatalf("expected near-term (<=14d) request to enter seeking_coverage, got %s", nearAfter.Status)
	}

	holdAfter, _ := repo.GetTimeOffRequestByID(ctx, holdReq.ID)
	if holdAfter.Status != models.TimeOffStatusOnHold {
		t.Fatalf("expected on_hold request to remain on_hold, got %s", holdAfter.Status)
	}
}
