package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

func TestVehicleTraceAndIdlesUseVehicleIDAndAreNotStored(t *testing.T) {
	var seen urlParts
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen.calls++
		seen.operation = r.URL.Query().Get("operation")
		seen.target = r.URL.Query().Get("target")
		seen.password = r.URL.Query().Get("password")
		if r.URL.Query().Get("operation") == "path" {
			_, _ = w.Write([]byte(`<pathevents><asset><event lat="45.4" long="-75.7" time="2026-10-21T15:00:00Z" speed="30" heading="N"/></asset></pathevents>`))
			return
		}
		_, _ = w.Write([]byte(`<eventlist><event from="1761058800" to="1761060600" latlong="45.41,-75.71"/></eventlist>`))
	}))
	defer srv.Close()

	vehicles := repository.NewInMemoryVehicleRepository()
	ctx := context.Background()
	if _, err := vehicles.CreateVehicle(ctx, &models.Vehicle{
		ID: "VEH-1003", VehicleID: 1003, UnitNumber: "1003", Active: true, ZonarAssetID: 40,
	}); err != nil {
		t.Fatal(err)
	}
	svc := NewZonarService(NewZonarStore(nil))
	svc.endpoint = srv.URL
	svc.client = srv.Client()
	svc.UseVehicles(vehicles)
	if _, err := svc.SaveSettings(ctx, ZonarSave{
		Enabled: true, Customer: "preview", Username: "preview", Password: "not-sent",
	}); err != nil {
		t.Fatal(err)
	}

	trace, err := svc.VehicleTrace(ctx, "1003", "2026-10-21T10:00:00Z", "2026-10-21T12:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if trace.Persisted || trace.VehicleID != 1003 || trace.AssetID != 40 || len(trace.Points) != 1 || trace.Points[0].Lat != 45.4 {
		t.Fatalf("trace = %+v", trace)
	}
	if trace.Points[0].Heading != 360 {
		t.Fatalf("heading = %d", trace.Points[0].Heading)
	}
	idles, err := svc.VehicleIdles(ctx, "1003", "2026-10-21T10:00:00Z", "2026-10-21T12:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if idles.Persisted || len(idles.Stops) != 1 || idles.Stops[0].DurationSeconds != 1800 || idles.Stops[0].Lat != 45.41 {
		t.Fatalf("idles = %+v", idles)
	}
	if seen.target != "40" || seen.calls != 2 {
		t.Fatalf("calls=%d target=%s operation=%s", seen.calls, seen.target, seen.operation)
	}
	raw, _ := json.Marshal(trace)
	if strings.Contains(string(raw), "not-sent") || strings.Contains(string(raw), seen.password) {
		t.Fatal("trace response leaked the password")
	}

	svcOff := NewZonarService(NewZonarStore(nil))
	offCalls := 0
	offSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		offCalls++
		t.Fatal("disabled sync must not call Zonar")
	}))
	defer offSrv.Close()
	svcOff.endpoint = offSrv.URL
	svcOff.client = offSrv.Client()
	svcOff.UseVehicles(vehicles)
	if _, err := svcOff.SaveSettings(ctx, ZonarSave{Customer: "preview", Username: "preview", Password: "not-sent"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svcOff.VehicleTrace(ctx, "1003", "2026-10-21T10:00:00Z", "2026-10-21T12:00:00Z"); err == nil || !strings.Contains(err.Error(), "turned off") {
		t.Fatalf("disabled err = %v", err)
	}
	if offCalls != 0 {
		t.Fatalf("off calls = %d", offCalls)
	}
	if _, err := svc.VehicleTrace(ctx, "9999", "2026-10-21T10:00:00Z", "2026-10-21T12:00:00Z"); err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("missing vehicle err = %v", err)
	}
	if _, err := svc.VehicleTrace(ctx, "1003", "2026-10-21T10:00:00Z", "2026-10-22T11:00:00Z"); err == nil || !strings.Contains(err.Error(), "24 hours") {
		t.Fatalf("range err = %v", err)
	}
	enabled, err := svcOff.SyncEnabled(ctx)
	if err != nil || enabled {
		t.Fatalf("enabled = %v err=%v", enabled, err)
	}
}

type urlParts struct {
	calls     int
	operation string
	target    string
	password  string
}
