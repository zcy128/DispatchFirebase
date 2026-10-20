package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/services"
)

func TestGetSettingsDoesNotEchoAPIKey(t *testing.T) {
	svc := services.NewBambooHRService(services.NewBambooHRStore(nil))
	const secret = "super-secret-bamboo-key"
	if _, err := svc.SaveSettings(context.Background(), services.BambooHRSave{
		Enabled:       true,
		CompanyDomain: "exampleco",
		APIKey:        secret,
	}); err != nil {
		t.Fatal(err)
	}
	handler := NewBambooHRHandler(svc)
	req := httptest.NewRequest(http.MethodGet, "/api/bamboohr/settings", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.AuthUser{Role: "admin"}))
	rec := httptest.NewRecorder()
	handler.GetSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), secret) {
		t.Fatalf("handler leaked the api key: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"apiKeyConfigured":true`) {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestSaveSettingsRejectsNonAdmin(t *testing.T) {
	handler := NewBambooHRHandler(services.NewBambooHRService(services.NewBambooHRStore(nil)))
	req := httptest.NewRequest(http.MethodPut, "/api/bamboohr/settings", bytes.NewBufferString(`{"enabled":true,"companyDomain":"exampleco","apiKey":"super-secret-bamboo-key"}`))
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.AuthUser{Role: "driver"}))
	rec := httptest.NewRecorder()
	handler.SaveSettings(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "super-secret-bamboo-key") {
		t.Fatal("error response echoed the key")
	}
}

func TestReceiveWebhookHidesPathKey(t *testing.T) {
	svc := services.NewBambooHRService(services.NewBambooHRStore(nil))
	const webhookKey = "webhook-key-1234"
	if _, err := svc.SaveSettings(context.Background(), services.BambooHRSave{
		CompanyDomain: "exampleco",
		WebhookKey:    webhookKey,
	}); err != nil {
		t.Fatal(err)
	}
	handler := NewBambooHRHandler(svc)
	req := httptest.NewRequest(http.MethodPost, "/api/bamboohr/webhook/"+webhookKey, bytes.NewBufferString(`{"employees":[{"id":"2379","action":"Updated","changedFields":["Job Title"]}]}`))
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("apikey", webhookKey)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	rec := httptest.NewRecorder()
	handler.ReceiveWebhook(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), webhookKey) {
		t.Fatalf("response leaked the webhook key: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"persisted":false`) {
		t.Fatalf("body = %s", rec.Body.String())
	}
}
