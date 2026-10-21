package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/services"
)

func TestGetZonarSettingsDoesNotEchoPassword(t *testing.T) {
	svc := services.NewZonarService(services.NewZonarStore(nil))
	const secret = "super-secret-zonar-password"
	if _, err := svc.SaveSettings(context.Background(), services.ZonarSave{
		Enabled:  true,
		Customer: "exampleco",
		Username: "reader",
		Password: secret,
	}); err != nil {
		t.Fatal(err)
	}
	handler := NewZonarHandler(svc)
	req := httptest.NewRequest(http.MethodGet, "/api/zonar/settings", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.AuthUser{Role: "admin"}))
	rec := httptest.NewRecorder()
	handler.GetSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), secret) {
		t.Fatalf("handler leaked the password: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"passwordConfigured":true`) {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestSaveZonarSettingsRejectsNonAdmin(t *testing.T) {
	handler := NewZonarHandler(services.NewZonarService(services.NewZonarStore(nil)))
	req := httptest.NewRequest(http.MethodPut, "/api/zonar/settings", bytes.NewBufferString(`{"enabled":true,"customer":"exampleco","username":"reader","password":"super-secret-zonar-password"}`))
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.AuthUser{Role: "driver"}))
	rec := httptest.NewRecorder()
	handler.SaveSettings(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "super-secret-zonar-password") {
		t.Fatal("error response echoed the password")
	}
}
