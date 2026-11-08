package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type mockEmailSender struct {
	sentCount int
	lastTo    []string
	lastSubj  string
	lastHTML  string
	lastText  string
	fail      bool
}

func (m *mockEmailSender) SendEmail(to []string, subject, htmlBody, textBody string) error {
	if m.fail {
		return context.DeadlineExceeded
	}
	m.sentCount++
	m.lastTo = to
	m.lastSubj = subject
	m.lastHTML = htmlBody
	m.lastText = textBody
	return nil
}

func withTestUser(req *http.Request, user *auth.AuthUser) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, user))
}

func TestClientOperationErrorHandlers(t *testing.T) {
	repo := repository.NewMemoryDispatchRepository()
	handler := NewDispatchHandler(repo, false)
	emailMock := &mockEmailSender{}
	handler.UseParentNotifiers(nil, emailMock)

	adminUser := &auth.AuthUser{
		UID:        "admin-123",
		EmployeeID: "EMP-001",
		FullName:   "Admin User",
		Role:       "admin",
	}

	driverUser := &auth.AuthUser{
		UID:        "driver-456",
		EmployeeID: "DRV-001",
		FullName:   "Driver User",
		Role:       "driver",
	}

	// 1. Get default Error Alert Settings
	t.Run("GetDefaultErrorAlertSettings", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/dispatch/error-alert-settings", nil)
		rec := httptest.NewRecorder()
		handler.GetErrorAlertSettings(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		var settings models.ErrorAlertSettings
		if err := json.Unmarshal(rec.Body.Bytes(), &settings); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if settings.ThrottleMinutes != 5 {
			t.Errorf("expected default throttle 5, got %d", settings.ThrottleMinutes)
		}
	})

	// 2. Save Error Alert Settings requires settings permission
	t.Run("SaveErrorAlertSettings_ForbiddenWithoutPermission", func(t *testing.T) {
		payload := `{"recipients":["ops@example.com"],"pages":{"dispatch":true},"throttleMinutes":10}`
		req := httptest.NewRequest(http.MethodPut, "/api/dispatch/error-alert-settings", strings.NewReader(payload))
		req = withTestUser(req, driverUser)
		rec := httptest.NewRecorder()
		handler.SaveErrorAlertSettings(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	// 3. Save Error Alert Settings succeeds with admin
	t.Run("SaveErrorAlertSettings_Success", func(t *testing.T) {
		payload := `{"recipients":["ops@example.com","OPS@example.com","  alerts@example.com  "],"pages":{"dispatch":true,"routes":true},"throttleMinutes":10}`
		req := httptest.NewRequest(http.MethodPut, "/api/dispatch/error-alert-settings", strings.NewReader(payload))
		req = withTestUser(req, adminUser)
		rec := httptest.NewRecorder()
		handler.SaveErrorAlertSettings(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}
		var settings models.ErrorAlertSettings
		if err := json.Unmarshal(rec.Body.Bytes(), &settings); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(settings.Recipients) != 2 {
			t.Errorf("expected 2 deduped recipients, got %d: %v", len(settings.Recipients), settings.Recipients)
		}
		if !settings.Pages["dispatch"] || !settings.Pages["routes"] {
			t.Errorf("expected dispatch and routes enabled: %v", settings.Pages)
		}
		if settings.ThrottleMinutes != 10 {
			t.Errorf("expected throttle 10, got %d", settings.ThrottleMinutes)
		}
	})

	// 4. Create Client Operation Error: validation
	t.Run("CreateClientOperationError_Validation", func(t *testing.T) {
		// Missing message
		req := httptest.NewRequest(http.MethodPost, "/api/client-operation-errors", strings.NewReader(`{"page":"dispatch"}`))
		rec := httptest.NewRecorder()
		handler.CreateClientOperationError(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for missing message, got %d", rec.Code)
		}

		// Refuse error-report endpoint loop
		req2 := httptest.NewRequest(http.MethodPost, "/api/client-operation-errors", strings.NewReader(`{"page":"dispatch","endpoint":"/api/client-operation-errors","message":"fail"}`))
		rec2 := httptest.NewRecorder()
		handler.CreateClientOperationError(rec2, req2)
		if rec2.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for self-endpoint, got %d", rec2.Code)
		}

		// Skip 401
		req3 := httptest.NewRequest(http.MethodPost, "/api/client-operation-errors", strings.NewReader(`{"page":"dispatch","status":401,"message":"unauthorized"}`))
		rec3 := httptest.NewRecorder()
		handler.CreateClientOperationError(rec3, req3)
		if rec3.Code != http.StatusNoContent {
			t.Errorf("expected 204 No Content for status 401, got %d", rec3.Code)
		}
	})

	// 5. Create Client Operation Error with email sent
	t.Run("CreateClientOperationError_EmailSentAndThrottled", func(t *testing.T) {
		emailMock.sentCount = 0

		body := models.CreateClientOperationErrorRequest{
			Page:     "dispatch",
			Action:   "assign_driver",
			Method:   "PUT",
			Endpoint: "/api/dispatch/shifts/sh-1",
			Status:   500,
			Message:  "Database deadlock detected",
		}
		bodyBytes, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/client-operation-errors", bytes.NewReader(bodyBytes))
		req = withTestUser(req, adminUser)
		rec := httptest.NewRecorder()
		handler.CreateClientOperationError(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}
		var created models.ClientOperationError
		if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if !created.EmailSent {
			t.Errorf("expected emailSent = true, got skipped=%s", created.EmailSkipped)
		}
		if emailMock.sentCount != 1 {
			t.Errorf("expected 1 email sent, got %d", emailMock.sentCount)
		}

		// Immediate duplicate error with identical fingerprint should be throttled
		reqDup := httptest.NewRequest(http.MethodPost, "/api/client-operation-errors", bytes.NewReader(bodyBytes))
		reqDup = withTestUser(reqDup, adminUser)
		recDup := httptest.NewRecorder()
		handler.CreateClientOperationError(recDup, reqDup)

		if recDup.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created for duplicate, got %d: %s", recDup.Code, recDup.Body.String())
		}
		var createdDup models.ClientOperationError
		if err := json.Unmarshal(recDup.Body.Bytes(), &createdDup); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if createdDup.EmailSent {
			t.Errorf("expected duplicate email to be throttled, but emailSent was true")
		}
		if createdDup.EmailSkipped != "throttled" {
			t.Errorf("expected emailSkipped='throttled', got %s", createdDup.EmailSkipped)
		}
		if emailMock.sentCount != 1 {
			t.Errorf("expected email count to remain 1, got %d", emailMock.sentCount)
		}
	})

	// 6. Create Client Operation Error for disabled page
	t.Run("CreateClientOperationError_PageDisabled", func(t *testing.T) {
		body := models.CreateClientOperationErrorRequest{
			Page:     "students", // disabled in settings
			Action:   "load_student",
			Method:   "GET",
			Endpoint: "/api/students/999",
			Status:   404,
			Message:  "Student not found",
		}
		bodyBytes, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/client-operation-errors", bytes.NewReader(bodyBytes))
		rec := httptest.NewRecorder()
		handler.CreateClientOperationError(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}
		var created models.ClientOperationError
		if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if created.EmailSent {
			t.Errorf("expected emailSent = false for disabled page")
		}
		if created.EmailSkipped != "page_disabled" {
			t.Errorf("expected emailSkipped='page_disabled', got %s", created.EmailSkipped)
		}
	})

	// 7. List Client Operation Errors
	t.Run("ListClientOperationErrors_PermissionsAndFilter", func(t *testing.T) {
		// Non-privileged user
		reqForbidden := httptest.NewRequest(http.MethodGet, "/api/client-operation-errors", nil)
		reqForbidden = withTestUser(reqForbidden, driverUser)
		recForbidden := httptest.NewRecorder()
		handler.ListClientOperationErrors(recForbidden, reqForbidden)
		if recForbidden.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden, got %d", recForbidden.Code)
		}

		// Admin user - list all
		reqAll := httptest.NewRequest(http.MethodGet, "/api/client-operation-errors", nil)
		reqAll = withTestUser(reqAll, adminUser)
		recAll := httptest.NewRecorder()
		handler.ListClientOperationErrors(recAll, reqAll)
		if recAll.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", recAll.Code, recAll.Body.String())
		}
		var allRows []*models.ClientOperationError
		if err := json.Unmarshal(recAll.Body.Bytes(), &allRows); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(allRows) < 3 {
			t.Errorf("expected at least 3 errors recorded, got %d", len(allRows))
		}

		// Filter by page=students
		reqFiltered := httptest.NewRequest(http.MethodGet, "/api/client-operation-errors?page=students", nil)
		reqFiltered = withTestUser(reqFiltered, adminUser)
		recFiltered := httptest.NewRecorder()
		handler.ListClientOperationErrors(recFiltered, reqFiltered)
		if recFiltered.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", recFiltered.Code, recFiltered.Body.String())
		}
		var filteredRows []*models.ClientOperationError
		if err := json.Unmarshal(recFiltered.Body.Bytes(), &filteredRows); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(filteredRows) != 1 || filteredRows[0].Page != "students" {
			t.Errorf("expected 1 student error, got %d", len(filteredRows))
		}
	})
}
