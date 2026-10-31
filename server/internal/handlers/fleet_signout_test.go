package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/repository"
)

func TestFleetRoleSecurity(t *testing.T) {
	memDispatch := repository.NewMemoryDispatchRepository()
	handler := NewDispatchHandler(memDispatch, true)

	t.Run("Driver with X-User-Role fleet is rejected with 403 Forbidden", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/public/dispatch/vehicle-signouts?role=fleet", nil)
		req.Header.Set("X-User-Role", "fleet")
		// Authenticated as driver
		driverUser := &auth.AuthUser{
			UID:      "mock-driver-1",
			Username: "driver1d",
			Role:     "driver",
		}
		req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, driverUser))
		rec := httptest.NewRecorder()

		handler.ListVehicleSignouts(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden for driver attempting to spoof fleet role, got %d", rec.Code)
		}
	})

	t.Run("Real fleet role is allowed", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/public/dispatch/vehicle-signouts", nil)
		fleetUser := &auth.AuthUser{
			UID:      "mock-fleet-1",
			Username: "fleetmaster",
			Role:     "fleet",
		}
		req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, fleetUser))
		rec := httptest.NewRecorder()

		handler.ListVehicleSignouts(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for authentic fleet user, got %d", rec.Code)
		}
	})

	t.Run("Real admin role is allowed", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/public/dispatch/vehicle-signouts", nil)
		adminUser := &auth.AuthUser{
			UID:      "mock-admin-1",
			Username: "admin",
			Role:     "admin",
		}
		req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, adminUser))
		rec := httptest.NewRecorder()

		handler.ListVehicleSignouts(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for admin user, got %d", rec.Code)
		}
	})
}

func TestUploadFileSecurity(t *testing.T) {
	t.Run("Rejects dangerous executable extension", func(t *testing.T) {
		body := bytes.NewBufferString(`{"filename":"malware.exe","data":"SGVsbG8gV29ybGQ="}`)
		req := httptest.NewRequest("POST", "/api/public/upload", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		UploadFileHandler(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request for .exe upload, got %d", rec.Code)
		}
	})

	t.Run("Accepts safe image extension", func(t *testing.T) {
		body := bytes.NewBufferString(`{"filename":"receipt.jpg","data":"SGVsbG8gV29ybGQ="}`)
		req := httptest.NewRequest("POST", "/api/public/upload", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		UploadFileHandler(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created for .jpg upload, got %d", rec.Code)
		}
	})
}
