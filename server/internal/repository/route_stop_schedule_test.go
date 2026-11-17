package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"dispatch-server/internal/models"
)

func TestValidateStopsRunDaysSubset(t *testing.T) {
	stopsOK := []models.RouteStop{
		{StopID: 1, StopLocation: "Dad House", RunDays: "MW"},
		{StopID: 2, StopLocation: "Mom House", RunDays: "TR"},
	}
	if err := models.ValidateStopsRunDaysSubset("MTWR-", stopsOK); err != nil {
		t.Fatalf("expected valid subset to pass, got: %v", err)
	}

	stopsOverflow := []models.RouteStop{
		{StopID: 1, StopLocation: "Dad House", RunDays: "MWF"},
	}
	err := models.ValidateStopsRunDaysSubset("MTWR-", stopsOverflow)
	if !errors.Is(err, models.ErrStopRunDaysExceedShift) {
		t.Fatalf("expected ErrStopRunDaysExceedShift when stop includes F on MTWR- shift, got: %v", err)
	}
}

func TestMemoryRouteRepositoryUpdateShiftRejectsOverflowRunDays(t *testing.T) {
	repo := NewMemoryRouteRepository()
	ctx := context.Background()
	repo.shifts["SH-1"] = &models.BusRouteShift{
		ID:      "SH-1",
		RouteID: "RT-1",
		RunDays: "MTWR-",
		Stops: []models.RouteStop{
			{StopID: 1, StopLocation: "100 Main St", PullawayTime: "07:10"},
		},
	}

	badStops := []models.RouteStop{
		{StopID: 1, StopLocation: "100 Main St", PullawayTime: "07:10", RunDays: "MTWRF"},
	}
	_, err := repo.UpdateShift(ctx, "SH-1", &models.UpdateShiftRequest{Stops: &badStops})
	if !errors.Is(err, models.ErrStopRunDaysExceedShift) {
		t.Fatalf("expected UpdateShift to reject stop RunDays overflowing shift RunDays, got: %v", err)
	}

	goodStops := []models.RouteStop{
		{StopID: 1, StopLocation: "100 Main St", PullawayTime: "07:10", RunDays: "MW", WeekParity: "ODD"},
	}
	updated, err := repo.UpdateShift(ctx, "SH-1", &models.UpdateShiftRequest{Stops: &goodStops})
	if err != nil {
		t.Fatalf("expected valid UpdateShift to succeed, got: %v", err)
	}
	if updated.Stops[0].WeekParity != "ODD" {
		t.Fatalf("expected WeekParity ODD to persist, got %q", updated.Stops[0].WeekParity)
	}
}

func TestShouldIncludeRouteStopForDate(t *testing.T) {
	// 2026-11-17 is Tuesday (T) in ISO week 47 (ODD)
	// 2026-11-23 is Monday (M) in ISO week 48 (EVEN)
	tOdd, _ := time.Parse("2006-01-02", "2026-11-17")
	_, wkOdd := tOdd.ISOWeek()
	isOdd := wkOdd%2 == 1

	tEven, _ := time.Parse("2006-01-02", "2026-11-23")
	_, wkEven := tEven.ISOWeek()
	isEvenOdd := wkEven%2 == 1

	dadStop := models.RouteStop{StopID: 1, RunDays: "MW", WeekParity: "ODD"}
	momStop := models.RouteStop{StopID: 2, RunDays: "TR", WeekParity: "EVEN"}

	// Tuesday of Odd week: Dad is MW (false), Mom is EVEN (false)
	if shouldIncludeRouteStopForDate(dadStop, "2026-11-17", "T", isOdd) {
		t.Fatalf("expected Dad MW stop to be excluded on Tuesday")
	}
	if shouldIncludeRouteStopForDate(momStop, "2026-11-17", "T", isOdd) {
		t.Fatalf("expected Mom EVEN stop to be excluded on Odd week")
	}

	// Monday of Odd week: Dad MW + ODD -> included
	if !shouldIncludeRouteStopForDate(dadStop, "2026-11-16", "M", isOdd) {
		t.Fatalf("expected Dad MW ODD stop to be included on Monday of Odd week")
	}
	// Monday of Even week: Dad MW + ODD -> excluded
	if shouldIncludeRouteStopForDate(dadStop, "2026-11-23", "M", isEvenOdd) {
		t.Fatalf("expected Dad MW ODD stop to be excluded on Monday of Even week")
	}
	// Tuesday of Even week: Mom TR + EVEN -> included
	if !shouldIncludeRouteStopForDate(momStop, "2026-11-24", "T", isEvenOdd) {
		t.Fatalf("expected Mom TR EVEN stop to be included on Tuesday of Even week")
	}
}
