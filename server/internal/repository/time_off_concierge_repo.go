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
