package services

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestBusPlannerSyncWritesStagingAndCanRunTwiceADay(t *testing.T) {
	var mu sync.Mutex
	routeCalls := 0
	var sawPassword bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "Token") {
			body, _ := io.ReadAll(r.Body)
			if strings.Contains(string(body), "not-sent") {
				mu.Lock()
				sawPassword = true
				mu.Unlock()
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"test-token","token_type":"bearer","expires_in":3600}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(r.URL.Path, "/Route/GetAll"):
			mu.Lock()
			routeCalls++
			mu.Unlock()
			_, _ = w.Write([]byte(`[
				{"RouteID":"100","Description":"North","OperatorID":"4S","VehicleID":"V1"},
				{"RouteID":"200","Description":"Other","OperatorID":"OTHER","VehicleID":"V2"}
			]`))
		case strings.Contains(r.URL.Path, "/Run/GetAll"):
			_, _ = w.Write([]byte(`[
				{"RunID":"100A","RouteID":"100","Active":true,"Description":"AM","ComponentID":"AM","Type":"AM","EffectiveDate":"2026-09-01"},
				{"RunID":"200A","RouteID":"200","Active":true,"Description":"Skip"},
				{"RunID":"100B","RouteID":"100","Active":false,"Description":"Retired"}
			]`))
		case strings.Contains(r.URL.Path, "/School"):
			_, _ = w.Write([]byte(`[{"SchoolId":"S1","Name":"North School","SchoolGuid":"g1","AMBellTime":"08:30","Address":{"PostalCode":"T2P","LatLong":{"Latitude":51.0,"Longitude":-114.0}}}]`))
		case strings.Contains(r.URL.Path, "GetSchoolStops"):
			if r.URL.Query().Get("lastStopGuid") != "00000000-0000-0000-0000-000000000000" {
				_, _ = w.Write([]byte(`[]`))
				return
			}
			_, _ = w.Write([]byte(`[{"RouteID":"100","LatLong":{"Latitude":51.1,"Longitude":-114.1},"BasicInformation":{"BusStopID":"9","BusStopGuid":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","Active":true,"Time":"2026-10-21T08:00:00","RunID":"100A","StopType":2,"Description":"School"}}]`))
		case strings.Contains(r.URL.Path, "GetHomeStops"):
			_, _ = w.Write([]byte(`[]`))
		case strings.Contains(r.URL.Path, "StudentStop"):
			if r.URL.Query().Get("lastStudentGuid") != "00000000-0000-0000-0000-000000000000" {
				_, _ = w.Write([]byte(`[]`))
				return
			}
			_, _ = w.Write([]byte(`[{"BusStopID":"9","StudentID":"77","StudentGuid":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","BusStopGuid":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}]`))
		case strings.Contains(r.URL.Path, "/Student/Get"):
			_, _ = w.Write([]byte(`{"Id":"77","FirstName":"Ada","LastName":"Kept","MedicalDetail":"clinic-note","SchoolId":"S1"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	store := NewBusPlannerStore(nil)
	svc := NewBusPlannerService(store)
	ctx := context.Background()
	if _, err := svc.SaveSettings(ctx, BusPlannerSave{
		Enabled:    true,
		BaseURL:    srv.URL,
		Username:   "planner",
		Password:   "not-sent",
		OperatorID: "4S",
		SyncTimes:  []string{"15:00", "05:00", "05:00"},
	}); err != nil {
		t.Fatal(err)
	}
	settings, err := svc.GetSettings(ctx)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(settings)
	if strings.Contains(string(raw), "not-sent") || settings.PasswordConfigured != true {
		t.Fatalf("password leaked or was not stored: %s", raw)
	}
	if len(settings.SyncTimes) != 2 || settings.SyncTimes[0] != "05:00" || settings.SyncTimes[1] != "15:00" {
		t.Fatalf("times = %#v", settings.SyncTimes)
	}

	day := time.Date(2026, 10, 21, 5, 10, 0, 0, time.UTC)
	svc.runScheduledSyncAt(ctx, day)
	if routeCalls != 1 {
		t.Fatalf("first slot calls = %d", routeCalls)
	}
	svc.runScheduledSyncAt(ctx, day.Add(30*time.Minute))
	if routeCalls != 1 {
		t.Fatalf("same morning ran again: %d", routeCalls)
	}
	svc.runScheduledSyncAt(ctx, time.Date(2026, 10, 21, 15, 10, 0, 0, time.UTC))
	if routeCalls != 2 {
		t.Fatalf("afternoon slot calls = %d", routeCalls)
	}
	svc.runScheduledSyncAt(ctx, time.Date(2026, 10, 21, 15, 40, 0, 0, time.UTC))
	if routeCalls != 2 {
		t.Fatalf("afternoon ran again: %d", routeCalls)
	}

	route, ok := store.StageDoc(ctx, stageRoutes, "100")
	if !ok || route["routeName"] != "North" {
		t.Fatalf("staged route = %#v ok=%v", route, ok)
	}
	if _, ok := store.StageDoc(ctx, stageRoutes, "200"); ok {
		t.Fatal("other operator route was staged")
	}
	if _, ok := store.StageDoc(ctx, stageRuns, "100A"); !ok {
		t.Fatal("run 100A missing")
	}
	if _, ok := store.StageDoc(ctx, stageRuns, "200A"); ok {
		t.Fatal("run for another operator was staged")
	}
	if _, ok := store.StageDoc(ctx, stageRuns, "100B"); ok {
		t.Fatal("inactive run was staged")
	}
	if _, ok := store.StageDoc(ctx, stageSchools, "S1"); !ok {
		t.Fatal("school missing")
	}
	if _, ok := store.StageDoc(ctx, stageStops, "9"); !ok {
		t.Fatal("stop missing")
	}
	student, ok := store.StageDoc(ctx, stageStudents, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	if !ok || student["medicalDetail"] != "clinic-note" {
		t.Fatalf("student staging = %#v", student)
	}

	report, err := svc.SyncNow(ctx)
	if err != nil {
		t.Fatal(err)
	}
	reportJSON, _ := json.Marshal(report)
	if report.LiveUpdated || !report.StagingOnly || !report.Persisted {
		t.Fatalf("report flags = %+v", report)
	}
	if strings.Contains(string(reportJSON), "clinic-note") || strings.Contains(string(reportJSON), "not-sent") || strings.Contains(string(reportJSON), "test-token") {
		t.Fatalf("report exposed private data: %s", reportJSON)
	}
	if !sawPassword {
		t.Fatal("token request did not receive the configured password")
	}
}

func TestBusPlannerSyncStaysOffUntilEnabled(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	store := NewBusPlannerStore(nil)
	svc := NewBusPlannerService(store)
	ctx := context.Background()
	if _, err := svc.SaveSettings(ctx, BusPlannerSave{
		Enabled:   false,
		BaseURL:   srv.URL,
		Username:  "planner",
		Password:  "not-sent",
		SyncTimes: []string{"05:00", "15:00"},
	}); err != nil {
		t.Fatal(err)
	}
	svc.runScheduledSyncAt(ctx, time.Date(2026, 10, 21, 16, 0, 0, 0, time.UTC))
	if _, err := svc.SyncNow(ctx); err == nil || !strings.Contains(err.Error(), "turned off") {
		t.Fatalf("manual sync err = %v", err)
	}
	if calls != 0 {
		t.Fatalf("disabled sync called BusPlanner %d times", calls)
	}
}
