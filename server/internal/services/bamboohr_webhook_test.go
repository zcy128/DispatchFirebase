package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReceiveWebhookReadsEmployeeAndDoesNotPersist(t *testing.T) {
	const apiSecret = "super-secret-bamboo-key"
	const webhookKey = "webhook-key-1234"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.Header.Get("Authorization"), apiSecret) {
			t.Fatal("api key sent in plaintext")
		}
		if !strings.HasPrefix(r.URL.Path, "/employees/2379") {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(`{
			"id":"2379",
			"displayName":"Marian Abdulle",
			"jobTitle":"Clinical Nurse",
			"status":"Active",
			"employeeNumber":"1907",
			"workEmail":"hidden@example.com",
			"mobilePhone":"555",
			"customPoliceCheckIssued":"2024-01-01"
		}`))
	}))
	defer srv.Close()

	svc := NewBambooHRService(NewBambooHRStore(nil))
	svc.baseURL = func(string) string { return srv.URL }
	if _, err := svc.SaveSettings(context.Background(), BambooHRSave{
		Enabled:       true,
		CompanyDomain: "exampleco",
		APIKey:        apiSecret,
		WebhookKey:    webhookKey,
	}); err != nil {
		t.Fatal(err)
	}

	result, err := svc.ReceiveWebhook(context.Background(), webhookKey, &BambooWebhookPayload{
		Employees: []BambooWebhookEmployee{{
			ID:            "2379",
			Action:        "Updated",
			ChangedFields: []string{"Job Title"},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !result.OK || result.Persisted || result.Received != 1 {
		t.Fatalf("result = %+v", result)
	}
	if result.Results[0].DisplayName != "Marian Abdulle" || result.Results[0].Persisted {
		t.Fatalf("event = %+v", result.Results[0])
	}
	raw, _ := json.Marshal(result)
	for _, leaked := range []string{apiSecret, webhookKey, "hidden@example.com", "555", "2024-01-01"} {
		if strings.Contains(string(raw), leaked) {
			t.Fatalf("result leaked %s: %s", leaked, raw)
		}
	}

	if _, err := svc.ReceiveWebhook(context.Background(), "wrong-webhook-key", &BambooWebhookPayload{
		Employees: []BambooWebhookEmployee{},
	}); err != ErrBadWebhookKey {
		t.Fatalf("expected bad key, got %v", err)
	}
}

func TestReceiveWebhookRejectsMissingEmployees(t *testing.T) {
	svc := NewBambooHRService(NewBambooHRStore(nil))
	if _, err := svc.SaveSettings(context.Background(), BambooHRSave{
		CompanyDomain: "exampleco",
		WebhookKey:    "webhook-key-1234",
	}); err != nil {
		t.Fatal(err)
	}
	_, err := svc.ReceiveWebhook(context.Background(), "webhook-key-1234", &BambooWebhookPayload{})
	if err != ErrInvalidWebhookPayload {
		t.Fatalf("got %v", err)
	}
}
