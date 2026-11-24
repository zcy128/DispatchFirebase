package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"google.golang.org/api/iterator"

	"dispatch-server/internal/models"
)

func (r *FirestoreDispatchRepository) SaveTimeOffRequest(ctx context.Context, rec *models.TimeOffRequest) (*models.TimeOffRequest, error) {
	if rec == nil || strings.TrimSpace(rec.ID) == "" {
		return nil, fmt.Errorf("time off request ID is required")
	}
	rec.UpdatedAt = time.Now().UTC()
	if _, err := r.client.Collection(r.timeOffColl).Doc(rec.ID).Set(ctx, rec); err != nil {
		return nil, fmt.Errorf("save time off request %s: %w", rec.ID, err)
	}
	return rec, nil
}

func (r *FirestoreDispatchRepository) FinalizeDuePreApprovedTimeOffRequests(ctx context.Context, now time.Time) ([]*models.TimeOffRequest, error) {
	nowUTC := now.UTC()
	iter := r.client.Collection(r.timeOffColl).
		Where("status", "==", string(models.TimeOffStatusPreApproved)).
		Documents(ctx)
	defer iter.Stop()

	var finalized []*models.TimeOffRequest
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return finalized, fmt.Errorf("iterate pre_approved time off requests: %w", err)
		}
		var rec models.TimeOffRequest
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		rec.ID = doc.Ref.ID
		if rec.Status == models.TimeOffStatusOnHold {
			continue
		}
		if rec.AutoApproveDeadline == nil || rec.AutoApproveDeadline.After(nowUTC) {
			continue
		}
		rec.Status = models.TimeOffStatusApproved
		rec.AutoApproved = true
		rec.ApprovedByName = "AI Office Auto-Approval (24h SLA)"
		t := nowUTC
		rec.ApprovedAt = &t
		if strings.TrimSpace(rec.ApprovalNotes) == "" {
			rec.ApprovalNotes = "Auto-finalized after 24-hour pre-approval window with full substitute coverage."
		}
		rec.UpdatedAt = nowUTC
		if _, err := doc.Ref.Set(ctx, rec); err == nil {
			cp := rec
			finalized = append(finalized, &cp)
		}
	}
	return finalized, nil
}

func (m *MemoryDispatchRepository) SaveTimeOffRequest(ctx context.Context, rec *models.TimeOffRequest) (*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if rec == nil || strings.TrimSpace(rec.ID) == "" {
		return nil, fmt.Errorf("time off request ID is required")
	}
	cp := *rec
	cp.UpdatedAt = time.Now().UTC()
	m.timeOffRequests[cp.ID] = &cp
	return &cp, nil
}

func (m *MemoryDispatchRepository) FinalizeDuePreApprovedTimeOffRequests(ctx context.Context, now time.Time) ([]*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	nowUTC := now.UTC()
	var finalized []*models.TimeOffRequest
	for _, rec := range m.timeOffRequests {
		if rec == nil || rec.Status != models.TimeOffStatusPreApproved {
			continue
		}
		if rec.AutoApproveDeadline == nil || rec.AutoApproveDeadline.After(nowUTC) {
			continue
		}
		rec.Status = models.TimeOffStatusApproved
		rec.AutoApproved = true
		rec.ApprovedByName = "AI Office Auto-Approval (24h SLA)"
		t := nowUTC
		rec.ApprovedAt = &t
		if strings.TrimSpace(rec.ApprovalNotes) == "" {
			rec.ApprovalNotes = "Auto-finalized after 24-hour pre-approval window with full substitute coverage."
		}
		rec.UpdatedAt = nowUTC
		cp := *rec
		finalized = append(finalized, &cp)
	}
	return finalized, nil
}

func (r *FirestoreDispatchRepository) HoldTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	docRef := r.client.Collection(r.timeOffColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	var rec models.TimeOffRequest
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID
	if rec.Status == models.TimeOffStatusApproved || rec.Status == models.TimeOffStatusRejected || rec.Status == models.TimeOffStatusCancelled {
		return nil, fmt.Errorf("cannot hold a request that is already %s", rec.Status)
	}

	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusOnHold
	rec.HoldByUserID = req.ReviewerUserID
	rec.HoldByName = req.ReviewerName
	rec.HoldAt = &now
	rec.HoldReason = req.ApprovalNotes
	rec.AutoApproveDeadline = nil
	rec.PreApprovedAt = nil
	rec.UpdatedAt = now

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) ResumeTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	docRef := r.client.Collection(r.timeOffColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	var rec models.TimeOffRequest
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID
	if rec.Status != models.TimeOffStatusOnHold {
		return nil, fmt.Errorf("request is not on hold (status: %s)", rec.Status)
	}

	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusPending
	rec.HoldByUserID = ""
	rec.HoldByName = ""
	rec.HoldAt = nil
	rec.HoldReason = ""
	if strings.TrimSpace(req.ApprovalNotes) != "" {
		rec.ApprovalNotes = req.ApprovalNotes
	}
	rec.UpdatedAt = now

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) GetTimeOffPolicySettings(ctx context.Context) (*models.TimeOffPolicySettings, error) {
	docRef := r.client.Collection("system_settings").Doc("time_off_policy_settings")
	snap, err := docRef.Get(ctx)
	if err != nil || !snap.Exists() {
		return models.DefaultTimeOffPolicySettings(), nil
	}
	var cfg models.TimeOffPolicySettings
	if err := snap.DataTo(&cfg); err != nil {
		return models.DefaultTimeOffPolicySettings(), nil
	}
	if cfg.FarFutureManualOnlyDays <= 0 {
		cfg.FarFutureManualOnlyDays = 90
	}
	if cfg.AutoCoverWindowDays <= 0 {
		cfg.AutoCoverWindowDays = 14
	}
	return &cfg, nil
}

func (r *FirestoreDispatchRepository) SaveTimeOffPolicySettings(ctx context.Context, settings *models.TimeOffPolicySettings) (*models.TimeOffPolicySettings, error) {
	if settings == nil {
		settings = models.DefaultTimeOffPolicySettings()
	}
	if settings.FarFutureManualOnlyDays <= 0 {
		settings.FarFutureManualOnlyDays = 90
	}
	if settings.AutoCoverWindowDays <= 0 {
		settings.AutoCoverWindowDays = 14
	}
	settings.UpdatedAt = time.Now().UTC()
	docRef := r.client.Collection("system_settings").Doc("time_off_policy_settings")
	if _, err := docRef.Set(ctx, settings); err != nil {
		return nil, err
	}
	return settings, nil
}

func (m *MemoryDispatchRepository) HoldTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.timeOffRequests[id]
	if !ok || rec == nil {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	if rec.Status == models.TimeOffStatusApproved || rec.Status == models.TimeOffStatusRejected || rec.Status == models.TimeOffStatusCancelled {
		return nil, fmt.Errorf("cannot hold a request that is already %s", rec.Status)
	}
	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusOnHold
	rec.HoldByUserID = req.ReviewerUserID
	rec.HoldByName = req.ReviewerName
	rec.HoldAt = &now
	rec.HoldReason = req.ApprovalNotes
	rec.AutoApproveDeadline = nil
	rec.PreApprovedAt = nil
	rec.UpdatedAt = now
	cp := *rec
	return &cp, nil
}

func (m *MemoryDispatchRepository) ResumeTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.timeOffRequests[id]
	if !ok || rec == nil {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	if rec.Status != models.TimeOffStatusOnHold {
		return nil, fmt.Errorf("request is not on hold (status: %s)", rec.Status)
	}
	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusPending
	rec.HoldByUserID = ""
	rec.HoldByName = ""
	rec.HoldAt = nil
	rec.HoldReason = ""
	if strings.TrimSpace(req.ApprovalNotes) != "" {
		rec.ApprovalNotes = req.ApprovalNotes
	}
	rec.UpdatedAt = now
	cp := *rec
	return &cp, nil
}

func (m *MemoryDispatchRepository) GetTimeOffPolicySettings(ctx context.Context) (*models.TimeOffPolicySettings, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.timeOffPolicySettings == nil {
		return models.DefaultTimeOffPolicySettings(), nil
	}
	cp := *m.timeOffPolicySettings
	return &cp, nil
}

func (m *MemoryDispatchRepository) SaveTimeOffPolicySettings(ctx context.Context, settings *models.TimeOffPolicySettings) (*models.TimeOffPolicySettings, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if settings == nil {
		settings = models.DefaultTimeOffPolicySettings()
	}
	if settings.FarFutureManualOnlyDays <= 0 {
		settings.FarFutureManualOnlyDays = 90
	}
	if settings.AutoCoverWindowDays <= 0 {
		settings.AutoCoverWindowDays = 14
	}
	cp := *settings
	cp.UpdatedAt = time.Now().UTC()
	m.timeOffPolicySettings = &cp
	res := cp
	return &res, nil
}
