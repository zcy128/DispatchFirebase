package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

func TestSaveZonarSettingsNeverReturnsPassword(t *testing.T) {
	svc := NewZonarService(NewZonarStore(nil))
	const secret = "super-secret-zonar-password"
	saved, err := svc.SaveSettings(context.Background(), ZonarSave{
		Enabled:             true,
		Customer:            "sea5711",
		Username:            "mason",
		Password:            secret,
		BusyIntervalMinutes: 1,
		IdleIntervalMinutes: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if saved.PasswordConfigured != true || saved.BusyIntervalMinutes != 1 || saved.IdleIntervalMinutes != 10 {
		t.Fatalf("settings = %+v", saved)
	}
	raw, _ := json.Marshal(saved)
	if strings.Contains(string(raw), secret) {
		t.Fatalf("settings leaked the password: %s", raw)
	}
	again, err := svc.SaveSettings(context.Background(), ZonarSave{
		Enabled:  true,
		Customer: "sea5711",
		Username: "mason",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !again.PasswordConfigured {
		t.Fatal("blank password cleared the stored password")
	}
}

func TestZonarSyncReadsPositionsWithoutPersistingThem(t *testing.T) {
	const secret = "super-secret-zonar-password"
	var seenURL string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenURL = r.URL.String()
		if r.Header.Get("User-Agent") == "" {
			t.Error("missing user agent")
		}
		_, _ = w.Write([]byte(`<?xml version="1.0"?>
<currentlocations>
  <asset id="1" fleet="4S-100"><long>-75.69</long><lat>45.42</lat><time>1710000000</time><power>on</power><address>hidden street</address></asset>
  <asset id="2" fleet="4S-200"><long>-75.60</long><lat>45.50</lat><time>1710000060</time><power>off</power></asset>
  <asset id="3" fleet="4S-300"></asset>
</currentlocations>`))
	}))
	defer srv.Close()

	svc := NewZonarService(NewZonarStore(nil))
	svc.endpoint = srv.URL
	if _, err := svc.SaveSettings(context.Background(), ZonarSave{
		Enabled:             true,
		Customer:            "exampleco",
		Username:            "reader",
		Password:            secret,
		BusyIntervalMinutes: 1,
		IdleIntervalMinutes: 10,
	}); err != nil {
		t.Fatal(err)
	}
	report, err := svc.TestSync(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !report.Persisted || report.DryRun || report.AssetCount != 3 || report.LocatedCount != 2 {
		t.Fatalf("report = %+v", report)
	}
	if len(report.Preview) != 2 || report.Preview[0].Fleet != "4S-100" {
		t.Fatalf("preview = %+v", report.Preview)
	}
	raw, _ := json.Marshal(report)
	if strings.Contains(string(raw), secret) || strings.Contains(string(raw), "hidden street") {
		t.Fatalf("report leaked secret or address: %s", raw)
	}
	saved, err := svc.GetCurrent(context.Background(), "4S-100")
	if err != nil || saved == nil || saved.UnitNumber != "100" || saved.Address != "hidden street" {
		t.Fatalf("stored = %+v err=%v", saved, err)
	}
	if _, err := svc.TestSync(context.Background()); err != nil {
		t.Fatal(err)
	}
	again, err := svc.GetCurrent(context.Background(), "#100")
	if err != nil || again == nil || again.AssetID != "1" {
		t.Fatalf("second read = %+v err=%v", again, err)
	}
	if !strings.Contains(seenURL, "action=showposition") || !strings.Contains(seenURL, "operation=current") {
		t.Fatalf("url = %s", seenURL)
	}
	if strings.Contains(seenURL, secret) && !strings.Contains(seenURL, "password=") {
		t.Fatal("password was not sent as the Zonar query password")
	}
}

func TestScheduledZonarSyncUsesBusyAndIdleIntervals(t *testing.T) {
	const secret = "super-secret-zonar-password"
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`<currentlocations><asset id="9" fleet="4S-9"><lat>45.1</lat><long>-75.1</long><time>1710000000</time><power>on</power></asset></currentlocations>`))
	}))
	defer srv.Close()

	svc := NewZonarService(NewZonarStore(nil))
	svc.endpoint = srv.URL
	if _, err := svc.SaveSettings(context.Background(), ZonarSave{
		Enabled:             true,
		Customer:            "exampleco",
		Username:            "reader",
		Password:            secret,
		BusyIntervalMinutes: 1,
		IdleIntervalMinutes: 10,
	}); err != nil {
		t.Fatal(err)
	}
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		t.Fatal(err)
	}
	busy := time.Date(2026, 10, 20, 10, 0, 0, 0, loc)
	svc.runScheduledSyncAt(context.Background(), busy)
	svc.runScheduledSyncAt(context.Background(), busy.Add(30*time.Second))
	if calls != 1 {
		t.Fatalf("busy calls after 30s = %d", calls)
	}
	svc.runScheduledSyncAt(context.Background(), busy.Add(61*time.Second))
	if calls != 2 {
		t.Fatalf("busy calls after 61s = %d", calls)
	}

	idle := time.Date(2026, 10, 24, 10, 0, 0, 0, loc)
	svc.runScheduledSyncAt(context.Background(), idle)
	if calls != 3 {
		t.Fatalf("weekend should read once, calls = %d", calls)
	}
	svc.runScheduledSyncAt(context.Background(), idle.Add(2*time.Minute))
	if calls != 3 {
		t.Fatalf("weekend idle interval was not 10 minutes, calls = %d", calls)
	}
	evening := time.Date(2026, 10, 20, 18, 0, 0, 0, loc)
	modeInterval, mode := scheduleFor(evening, zonarSecret{BusyIntervalMinutes: 1, IdleIntervalMinutes: 10})
	if mode != "idle" || modeInterval != 10*time.Minute {
		t.Fatalf("18:00 mode = %s %s", mode, modeInterval)
	}
	settings, err := svc.GetSettings(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(settings)
	if strings.Contains(string(raw), secret) {
		t.Fatal("settings leaked the password")
	}
	if settings.LastSyncCount != 1 || settings.LastSyncMode != "idle" {
		t.Fatalf("settings = %+v", settings)
	}
}

func TestSyncSerialsMatchesFleetAndRunsOncePerDay(t *testing.T) {
	const secret = "super-secret-zonar-password"
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Query().Get("operation") != "showassets" {
			t.Fatalf("operation = %s", r.URL.Query().Get("operation"))
		}
		_, _ = w.Write([]byte(`<assetlist>
			<asset id="40"><fleet>4S-1003 D</fleet><gps>SN-1003</gps><status>1</status></asset>
			<asset id="41"><fleet>4S-NOPE</fleet><gps>SN-X</gps><status>1</status></asset>
			<asset id="42"><fleet>4S-OFF</fleet><gps>SN-OFF</gps><status>0</status></asset>
		</assetlist>`))
	}))
	defer srv.Close()

	vehicles := repository.NewInMemoryVehicleRepository()
	ctx := context.Background()
	if _, err := vehicles.CreateVehicle(ctx, &models.Vehicle{ID: "VEH-1003", UnitNumber: "1003", Active: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := vehicles.CreateVehicle(ctx, &models.Vehicle{ID: "VEH-OLD", UnitNumber: "88", Active: true, ZonarAssetID: 77, GpsSerial: "OLD"}); err != nil {
		t.Fatal(err)
	}
	if _, err := vehicles.CreateVehicle(ctx, &models.Vehicle{ID: "VEH-OFF", UnitNumber: "89", Active: false, ZonarAssetID: 99}); err != nil {
		t.Fatal(err)
	}

	svc := NewZonarService(NewZonarStore(nil))
	svc.endpoint = srv.URL
	svc.UseVehicles(vehicles)
	if _, err := svc.SaveSettings(ctx, ZonarSave{
		Enabled:           true,
		Customer:          "exampleco",
		Username:          "reader",
		Password:          secret,
		GpsSerialSyncTime: "03:00",
	}); err != nil {
		t.Fatal(err)
	}
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		t.Fatal(err)
	}
	before := time.Date(2026, 10, 20, 2, 30, 0, 0, loc)
	svc.runScheduledSerialSyncAt(ctx, before)
	if calls != 0 {
		t.Fatalf("ran before the chosen time, calls = %d", calls)
	}
	due := time.Date(2026, 10, 20, 9, 0, 0, 0, loc)
	svc.runScheduledSerialSyncAt(ctx, due)
	svc.runScheduledSerialSyncAt(ctx, due.Add(time.Hour))
	if calls != 1 {
		t.Fatalf("daily calls = %d", calls)
	}
	got, err := vehicles.GetVehicleByID(ctx, "VEH-1003")
	if err != nil || got.GpsSerial != "SN-1003" || got.ZonarAssetID != 40 || got.ZonarFleet != "4S-1003 D" {
		t.Fatalf("vehicle = %+v err=%v", got, err)
	}
	old, err := vehicles.GetVehicleByID(ctx, "VEH-OLD")
	if err != nil || old.ZonarAssetID != 0 || old.GpsSerial != "OLD" {
		t.Fatalf("stale vehicle = %+v err=%v", old, err)
	}
	inactive, err := vehicles.GetVehicleByID(ctx, "VEH-OFF")
	if err != nil || inactive.ZonarAssetID != 99 {
		t.Fatalf("inactive vehicle = %+v err=%v", inactive, err)
	}
	report, err := svc.SyncSerials(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if report.UpdatedCount != 0 || report.UnmatchedCount != 1 || report.Unmatched[0] != "4S-NOPE" {
		t.Fatalf("manual report = %+v", report)
	}
	raw, _ := json.Marshal(report)
	if strings.Contains(string(raw), secret) {
		t.Fatal("report leaked the password")
	}
}

func TestRouteWriteBackIsPreparedAndNotSent(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		t.Fatal("route preview must not call Zonar")
	}))
	defer srv.Close()

	vehicles := repository.NewInMemoryVehicleRepository()
	ctx := context.Background()
	if _, err := vehicles.CreateVehicle(ctx, &models.Vehicle{
		ID: "VEH-1003", UnitNumber: "1003", Active: true, ZonarAssetID: 40, ZonarFleet: "4S-1003 D",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := vehicles.CreateVehicle(ctx, &models.Vehicle{
		ID: "VEH-CBE", UnitNumber: "200", Active: true, ZonarAssetID: 41, ZonarFleet: "4S-200", AssignedRouteNo: "cbe-9",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := vehicles.CreateVehicle(ctx, &models.Vehicle{
		ID: "VEH-OFF", UnitNumber: "88", Active: false, ZonarAssetID: 77, ZonarFleet: "4S-88",
	}); err != nil {
		t.Fatal(err)
	}

	svc := NewZonarService(NewZonarStore(nil))
	svc.endpoint = srv.URL
	svc.UseVehicles(vehicles)
	svc.UseRoutes(func(_ context.Context, day string) (map[string]string, error) {
		if day != "2026-10-20" {
			t.Fatalf("day = %s", day)
		}
		return map[string]string{"1003": "CEPEO-021"}, nil
	})
	if _, err := svc.SaveSettings(ctx, ZonarSave{
		Enabled:           true,
		Customer:          "preview",
		Username:          "preview",
		Password:          "not-sent",
		GpsSerialSyncTime: "03:00",
	}); err != nil {
		t.Fatal(err)
	}
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		t.Fatal(err)
	}
	before := time.Date(2026, 10, 20, 2, 0, 0, 0, loc)
	svc.runScheduledRoutePreviewAt(ctx, before)
	if calls != 0 {
		t.Fatalf("zonar calls = %d", calls)
	}
	due := time.Date(2026, 10, 20, 9, 0, 0, 0, loc)
	svc.runScheduledRoutePreviewAt(ctx, due)
	svc.runScheduledRoutePreviewAt(ctx, due.Add(time.Hour))
	settings, err := svc.GetSettings(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if settings.LastRoutePreviewCount != 2 {
		t.Fatalf("settings = %+v", settings)
	}
	report, err := svc.PreviewRouteWriteBack(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if report.Persisted || report.SentToZonar || report.WithRoute != 2 || calls != 0 {
		t.Fatalf("report = %+v calls=%d", report, calls)
	}
	found := map[string]ZonarRoutePreview{}
	for _, row := range report.Preview {
		found[row.UnitNumber] = row
	}
	if found["1003"].RouteNo != "CEPEO-021" || found["1003"].Location != "Office" {
		t.Fatalf("1003 = %+v", found["1003"])
	}
	if found["200"].RouteNo != "CBE-9" || found["200"].Location != "CBE" {
		t.Fatalf("200 = %+v", found["200"])
	}
	if zonarLocationForRoute("PRO-1") != "PROVIDENCE" || zonarLocationForRoute("PRI-1") != "PRIVATE" || zonarLocationForRoute("") != "Office" {
		t.Fatal("location keywords drifted from the reference write-back")
	}
	if _, ok := found["88"]; ok {
		t.Fatal("inactive vehicle was included")
	}
}
