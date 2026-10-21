package services

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestWeeklyStagingSimulationWritesFiveRoutes(t *testing.T) {
	store := NewBusPlannerStore(nil)
	svc := NewBusPlannerService(store)
	svc.AllowStagingSimulation(true)
	loc := busplannerLocation()
	wednesday := time.Date(2026, 10, 21, 15, 0, 0, 0, loc)
	if wednesday.Weekday() != time.Wednesday {
		t.Fatalf("fixture weekday = %s", wednesday.Weekday())
	}
	svc.now = func() time.Time { return wednesday }

	svc.RunScheduledStagingSimulation(context.Background())
	list, err := svc.ListStagingRoutes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if list.TotalRoutes != 5 || list.TotalShifts != 10 || list.TotalStudents != 10 {
		t.Fatalf("counts = %+v", list)
	}
	raw, _ := json.Marshal(list)
	if strings.Contains(string(raw), "clinic") || strings.Contains(string(raw), "CBE-SIM") {
		t.Fatalf("unexpected payload: %s", raw)
	}
	for _, route := range list.Routes {
		if !route.Simulated || len(route.Shifts) != 2 || route.Shifts[0].ShiftType != "AM" || route.Shifts[1].ShiftType != "PM" {
			t.Fatalf("route = %+v", route)
		}
		if route.Shifts[0].EffectiveDate != "2026-10-26" || route.Shifts[0].ApplyDate != "2026-10-23" {
			t.Fatalf("window = %s apply %s", route.Shifts[0].EffectiveDate, route.Shifts[0].ApplyDate)
		}
		if len(route.Shifts[0].Stops) != 3 || len(route.Shifts[0].Stops[0].Students) != 1 {
			t.Fatalf("stops = %+v", route.Shifts[0].Stops)
		}
	}
	secret, err := store.Load(context.Background())
	if err != nil || secret.LastStagingSimWeek == "" || secret.Enabled {
		t.Fatalf("secret = %+v err=%v", secret, err)
	}
	svc.RunScheduledStagingSimulation(context.Background())
	again, err := svc.ListStagingRoutes(context.Background())
	if err != nil || again.TotalRoutes != 5 {
		t.Fatalf("second week run = %+v err=%v", again, err)
	}
}

func TestWeeklyStagingSimulationSkipsWhenSyncEnabledOrBeforeMondayMorning(t *testing.T) {
	store := NewBusPlannerStore(nil)
	if err := store.Save(context.Background(), busplannerSecret{Enabled: true, Username: "user", Password: "not-sent", BaseURL: "https://school.mybusplanner.ca"}); err != nil {
		t.Fatal(err)
	}
	svc := NewBusPlannerService(store)
	svc.AllowStagingSimulation(true)
	loc := busplannerLocation()
	svc.now = func() time.Time { return time.Date(2026, 10, 21, 15, 0, 0, 0, loc) }
	svc.RunScheduledStagingSimulation(context.Background())
	list, err := svc.ListStagingRoutes(context.Background())
	if err != nil || list.TotalRoutes != 0 {
		t.Fatalf("enabled sync wrote routes: %+v err=%v", list, err)
	}

	store = NewBusPlannerStore(nil)
	svc = NewBusPlannerService(store)
	svc.AllowStagingSimulation(true)
	monday := time.Date(2026, 10, 26, 8, 59, 0, 0, loc)
	if monday.Weekday() != time.Monday {
		t.Fatalf("fixture weekday = %s", monday.Weekday())
	}
	svc.now = func() time.Time { return monday }
	svc.RunScheduledStagingSimulation(context.Background())
	list, err = svc.ListStagingRoutes(context.Background())
	if err != nil || list.TotalRoutes != 0 {
		t.Fatalf("early Monday wrote routes: %+v err=%v", list, err)
	}
	svc.now = func() time.Time { return time.Date(2026, 10, 26, 9, 0, 0, 0, loc) }
	svc.RunScheduledStagingSimulation(context.Background())
	list, err = svc.ListStagingRoutes(context.Background())
	if err != nil || list.TotalRoutes != 5 {
		t.Fatalf("Monday 09:00 = %+v err=%v", list, err)
	}

	plain := NewBusPlannerService(NewBusPlannerStore(nil))
	plain.now = func() time.Time { return time.Date(2026, 10, 21, 15, 0, 0, 0, loc) }
	plain.RunScheduledStagingSimulation(context.Background())
	list, err = plain.ListStagingRoutes(context.Background())
	if err != nil || list.TotalRoutes != 0 {
		t.Fatalf("production mode wrote routes: %+v err=%v", list, err)
	}
}
