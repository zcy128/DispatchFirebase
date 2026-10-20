package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSaveSettingsNeverReturnsAPIKey(t *testing.T) {
	svc := NewBambooHRService(NewBambooHRStore(nil))
	const secret = "super-secret-bamboo-key"
	saved, err := svc.SaveSettings(context.Background(), BambooHRSave{
		Enabled:       true,
		CompanyDomain: "ExampleCo.bamboohr.com",
		APIKey:        secret,
	})
	if err != nil {
		t.Fatal(err)
	}
	if saved.CompanyDomain != "exampleco" {
		t.Fatalf("domain = %q", saved.CompanyDomain)
	}
	if !saved.APIKeyConfigured {
		t.Fatal("expected configured flag")
	}
	raw, _ := json.Marshal(saved)
	if strings.Contains(string(raw), secret) {
		t.Fatalf("response leaked the api key: %s", raw)
	}

	again, err := svc.SaveSettings(context.Background(), BambooHRSave{
		Enabled:       true,
		CompanyDomain: "exampleco",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !again.APIKeyConfigured {
		t.Fatal("blank key should keep the stored key")
	}
	loaded, _ := svc.store.Load(context.Background())
	if loaded.APIKey != secret {
		t.Fatalf("stored key changed")
	}
}

func TestTestSyncIsDryRunAndOmitsContactFields(t *testing.T) {
	const secret = "super-secret-bamboo-key"
	var seenAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/meta/fields":
			_, _ = w.Write([]byte(`[{"id":1,"name":"Job Title"},{"id":2,"name":"Status"}]`))
		case "/meta/users":
			_, _ = w.Write([]byte(`{"7":{"id":7,"email":"hidden@example.com"},"8":{"id":8,"email":"other@example.com"}}`))
		case "/employees/directory":
			_, _ = w.Write([]byte(`{"employees":[
				{"id":"1","displayName":"Ann Nurse","jobTitle":"Nurse","status":"Active","workEmail":"ann@example.com","mobilePhone":"555"},
				{"id":"2","displayName":"Pat Office","jobTitle":"Office Staff","status":"Active","workEmail":"pat@example.com"},
				{"id":"3","displayName":"Skip Driver","jobTitle":"Driver","status":"Active","workEmail":"skip@example.com"},
				{"id":"4","displayName":"Loa Nurse","jobTitle":"Nurse LOA","status":"Inactive","workEmail":"loa@example.com"}
			]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	svc := NewBambooHRService(NewBambooHRStore(nil))
	svc.baseURL = func(string) string { return srv.URL }
	if _, err := svc.SaveSettings(context.Background(), BambooHRSave{
		Enabled:       true,
		CompanyDomain: "exampleco",
		APIKey:        secret,
	}); err != nil {
		t.Fatal(err)
	}

	report, err := svc.TestSync(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !report.DryRun || report.Persisted {
		t.Fatalf("expected dry run, got %+v", report)
	}
	if report.FieldCount != 2 || report.UserCount != 2 || report.DirectoryCount != 4 || report.MatchedCount != 4 {
		t.Fatalf("counts = %+v", report)
	}
	if len(report.Preview) != 4 || report.Preview[0].DisplayName != "Ann Nurse" {
		t.Fatalf("preview = %+v", report.Preview)
	}
	raw, _ := json.Marshal(report)
	for _, leaked := range []string{secret, "ann@example.com", "555", "hidden@example.com"} {
		if strings.Contains(string(raw), leaked) {
			t.Fatalf("report leaked %s: %s", leaked, raw)
		}
	}
	if seenAuth == "" || strings.Contains(seenAuth, secret) && !strings.HasPrefix(seenAuth, "Basic ") {
		t.Fatalf("unexpected auth header")
	}
	if strings.Contains(seenAuth, secret) {
		t.Fatal("api key was sent as plaintext instead of basic auth")
	}
}

func TestScheduledSyncIncludesEveryoneOncePerDay(t *testing.T) {
	const secret = "super-secret-bamboo-key"
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"employees":[
			{"id":"1","displayName":"Ann Nurse","jobTitle":"Nurse"},
			{"id":"2","displayName":"Skip Driver","jobTitle":"Driver"},
			{"id":"3","displayName":"Loa Nurse","jobTitle":"Nurse LOA"}
		]}`))
	}))
	defer srv.Close()

	svc := NewBambooHRService(NewBambooHRStore(nil))
	svc.baseURL = func(string) string { return srv.URL }
	if _, err := svc.SaveSettings(context.Background(), BambooHRSave{
		Enabled:       true,
		CompanyDomain: "exampleco",
		APIKey:        secret,
		DailySyncTime: "01:00",
	}); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 20, 9, 0, 0, 0, time.FixedZone("EDT", -4*3600))
	svc.runScheduledSyncAt(context.Background(), now)
	svc.runScheduledSyncAt(context.Background(), now.Add(time.Hour))
	if calls != 1 {
		t.Fatalf("directory calls = %d", calls)
	}
	settings, err := svc.GetSettings(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if settings.LastDailySyncCount != 3 || settings.DailySyncTime != "01:00" {
		t.Fatalf("settings = %+v", settings)
	}
	raw, _ := json.Marshal(settings)
	if strings.Contains(string(raw), secret) {
		t.Fatal("settings leaked the api key")
	}
}

func TestTestSyncRejectsWhenDisabled(t *testing.T) {
	svc := NewBambooHRService(NewBambooHRStore(nil))
	_, err := svc.SaveSettings(context.Background(), BambooHRSave{
		Enabled:       false,
		CompanyDomain: "exampleco",
		APIKey:        "super-secret-bamboo-key",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.TestSync(context.Background()); err == nil || !strings.Contains(err.Error(), "turned off") {
		t.Fatalf("expected disabled error, got %v", err)
	}
}

func TestRedactBodyStripsAPIKey(t *testing.T) {
	got := redactBody("bad key super-secret-bamboo-key in body", "super-secret-bamboo-key")
	if strings.Contains(got, "super-secret-bamboo-key") {
		t.Fatal(got)
	}
}
