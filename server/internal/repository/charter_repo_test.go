package repository

import (
	"context"
	"errors"
	"testing"
)

func TestMemoryCharterTripRoundTrip(t *testing.T) {
	repo := NewMemoryCharterRepository()
	ctx := context.Background()

	created, err := repo.CreateTrip(ctx, map[string]interface{}{
		"title":        "QA Charter",
		"departsAt":    "2026-11-01T08:00",
		"dispatchDate": "2026-11-01",
		"clientName":   "General Charter Client",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatal("expected generated id")
	}

	listed, err := repo.ListTrips(ctx, "2026-11-01")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 1 || listed[0]["title"] != "QA Charter" {
		t.Fatalf("list = %#v", listed)
	}

	updated, err := repo.UpdateTrip(ctx, id, map[string]interface{}{"title": "QA Charter Updated"})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated["title"] != "QA Charter Updated" {
		t.Fatalf("title = %#v", updated["title"])
	}
	if updated["clientName"] != "General Charter Client" {
		t.Fatalf("client name was dropped: %#v", updated["clientName"])
	}

	if err := repo.DeleteTrip(ctx, id); err != nil {
		t.Fatalf("delete: %v", err)
	}
	left, err := repo.ListTrips(ctx, "")
	if err != nil {
		t.Fatalf("list after delete: %v", err)
	}
	if len(left) != 0 {
		t.Fatalf("expected empty list, got %d", len(left))
	}
}

func TestMemoryRouteOpeningRoundTrip(t *testing.T) {
	repo := NewMemoryCharterRepository()
	ctx := context.Background()

	created, err := repo.CreateRouteOpening(ctx, map[string]interface{}{
		"id":                 "RO-qa-1",
		"routeId":            "RT-021",
		"routeNo":            "021",
		"postingType":        "permanent",
		"status":             "open",
		"description":        "QA test opening",
		"effectiveStartDate": "2026-11-02",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created["id"] != "RO-qa-1" {
		t.Fatalf("id = %#v", created["id"])
	}

	updated, err := repo.UpdateRouteOpening(ctx, "RO-qa-1", map[string]interface{}{
		"description": "QA test opening updated",
		"status":      "reviewing",
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated["description"] != "QA test opening updated" || updated["routeNo"] != "021" {
		t.Fatalf("merged = %#v", updated)
	}

	listed, err := repo.ListRouteOpenings(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("list len = %d", len(listed))
	}

	if err := repo.DeleteRouteOpening(ctx, "RO-qa-1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := repo.UpdateRouteOpening(ctx, "RO-qa-1", map[string]interface{}{"status": "open"}); !errors.Is(err, ErrRouteOpeningNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestMemoryCharterClientRequiresLookup(t *testing.T) {
	repo := NewMemoryCharterRepository()
	ctx := context.Background()
	created, err := repo.CreateClient(ctx, map[string]interface{}{"name": "Museum Board", "active": true})
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	id, _ := created["id"].(string)
	got, err := repo.GetClient(ctx, id)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got["name"] != "Museum Board" {
		t.Fatalf("name = %#v", got["name"])
	}
}
