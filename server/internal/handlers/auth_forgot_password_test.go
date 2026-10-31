package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"dispatch-server/internal/config"
)

func TestForgotPasswordRequiresIdentifier(t *testing.T) {
	handler := NewAuthHandler(nil, nil, &config.Config{})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/forgot-password", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	handler.ForgotPassword(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "staff ID") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestForgotPasswordReportsMissingEmailService(t *testing.T) {
	handler := NewAuthHandler(nil, nil, &config.Config{})
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/auth/forgot-password",
		strings.NewReader(`{"username":"driver1d"}`),
	)
	rec := httptest.NewRecorder()

	handler.ForgotPassword(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "not configured") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}
