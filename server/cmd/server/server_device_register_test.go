package main

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

func TestDeviceRegistrationSecurity(t *testing.T) {
	memRepo := repository.NewMemoryEmployeeRepository()
	_ = memRepo.Create(context.Background(), &models.Employee{
		ID:             "emp-1",
		EmployeeNumber: "EMP-2001",
		Username:       "driver1d",
		Role:           "driver",
	})
	_ = memRepo.Create(context.Background(), &models.Employee{
		ID:             "emp-admin",
		EmployeeNumber: "EMP-ADMIN-001",
		Username:       "admin",
		Role:           "admin",
	})
	secret := "test-mcp-secret"
	cfg := &config.Config{AppMode: "demo", MCPTokenSecret: secret}
	authenticator := auth.NewAuthenticator(nil, true).WithMCPTokenSecret(secret)

	driverToken, _, _ := auth.GenerateMCPToken(secret, &auth.AuthUser{
		Username:   "driver1d",
		EmployeeID: "EMP-2001",
		Role:       "driver",
	}, 10*time.Minute)

	adminToken, _, _ := auth.GenerateMCPToken(secret, &auth.AuthUser{
		Username:   "admin",
		EmployeeID: "EMP-ADMIN-001",
		Role:       "admin",
	}, 10*time.Minute)

	r := chi.NewRouter()
	r.Group(func(publicDev chi.Router) {
		publicDev.Use(auth.PublicAPISecurityMiddleware(cfg.AllowsDemo(), authenticator))
		publicDev.Post("/api/public/devices/register", makeRegisterDeviceHandler(memRepo))
	})

	t.Run("Anonymous registration is rejected with 401", func(t *testing.T) {
		body := bytes.NewBufferString(`{"employeeId":"EMP-ADMIN-001","token":"evil-token"}`)
		req := httptest.NewRequest("POST", "/api/public/devices/register", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized for anonymous registration, got %d", rec.Code)
		}
	})

	t.Run("Driver registering for Admin is rejected with 403 Forbidden", func(t *testing.T) {
		body := bytes.NewBufferString(`{"employeeId":"EMP-ADMIN-001","token":"evil-token"}`)
		req := httptest.NewRequest("POST", "/api/public/devices/register", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+driverToken)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden for driver hijacking admin, got %d body: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("Driver registering for themselves is allowed with 200 OK", func(t *testing.T) {
		body := bytes.NewBufferString(`{"employeeId":"EMP-2001","token":"legit-driver-token"}`)
		req := httptest.NewRequest("POST", "/api/public/devices/register", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+driverToken)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for driver registering themselves, got %d body: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("Admin registering device token is allowed with 200 OK", func(t *testing.T) {
		body := bytes.NewBufferString(`{"employeeId":"EMP-ADMIN-001","token":"legit-admin-token"}`)
		req := httptest.NewRequest("POST", "/api/public/devices/register", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for admin registering token, got %d body: %s", rec.Code, rec.Body.String())
		}
	})
}
