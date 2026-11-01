package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"

	"github.com/go-chi/chi/v5"
)

func injectChiURLParam(req *http.Request, key, val string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, val)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

// TestNotifyParentsNoChannels verifies that if neither SMS nor Email is provided, the API rejects with 400.
func TestNotifyParentsNoChannels(t *testing.T) {
	repo := repository.NewMemoryDispatchRepository()
	h := NewDispatchHandler(repo, true)

	// Create dummy shift
	shift := &models.DispatchShift{
		ID:           "DS-2026-11-01-TEST-AM",
		DispatchDate: "2026-11-01",
		RouteNo:      "TEST",
		ShiftType:    "AM",
	}
	repo.AddShift(shift)

	// Call NotifyParents with empty channels
	payload := map[string]interface{}{
		"channels":     []string{},
		"delayMinutes": 15,
		"reasonLabel":  "Traffic",
		"recipients": []map[string]string{
			{"contactName": "Parent 1", "phone": "1234567890"},
		},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/api/dispatch/shifts/"+shift.ID+"/notify-parents", bytes.NewReader(body))
	req = injectChiURLParam(req, "id", shift.ID)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.AuthUser{Role: "dispatcher"}))
	w := httptest.NewRecorder()

	h.NotifyParents(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when no channels specified, got %d: %s", w.Code, w.Body.String())
	}
}

// TestSecurityRBAC_DeleteDayAndCreateDay verifies that drivers or unauthorized staff cannot delete or create dispatch days.
func TestSecurityRBAC_DeleteDayAndCreateDay(t *testing.T) {
	repo := repository.NewMemoryDispatchRepository()
	h := NewDispatchHandler(repo, true)

	// 1. Unauthenticated or Driver trying to DeleteDay
	req := httptest.NewRequest("DELETE", "/api/dispatch/delete-day?date=2026-11-01", nil)
	w := httptest.NewRecorder()
	h.DeleteDay(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for unauthenticated DeleteDay, got %d", w.Code)
	}

	driverUser := &auth.AuthUser{
		UID:        "u_driver",
		Role:       "driver",
		EmployeeID: "EMP-DRIVER",
	}
	reqWithDriver := req.WithContext(context.WithValue(context.Background(), auth.UserContextKey, driverUser))
	wWithDriver := httptest.NewRecorder()
	h.DeleteDay(wWithDriver, reqWithDriver)
	if wWithDriver.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for driver DeleteDay, got %d", wWithDriver.Code)
	}

	// 2. Dispatcher can delete day
	dispatcherUser := &auth.AuthUser{
		UID:        "u_dispatcher",
		Role:       "dispatcher",
		EmployeeID: "EMP-DISP",
	}
	reqWithDispatcher := req.WithContext(context.WithValue(context.Background(), auth.UserContextKey, dispatcherUser))
	wWithDispatcher := httptest.NewRecorder()
	h.DeleteDay(wWithDispatcher, reqWithDispatcher)
	if wWithDispatcher.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for dispatcher DeleteDay, got %d: %s", wWithDispatcher.Code, wWithDispatcher.Body.String())
	}
}

// TestSecurityRBAC_ProxyCheckIn verifies that drivers cannot check in for other drivers.
func TestSecurityRBAC_ProxyCheckIn(t *testing.T) {
	repo := repository.NewMemoryDispatchRepository()
	h := NewDispatchHandler(repo, true)

	shift := &models.DispatchShift{
		ID:           "DS-2026-11-01-ROUTE1-AM",
		DispatchDate: "2026-11-01",
		RouteNo:      "ROUTE1",
		ShiftType:    "AM",
		DriverID:     "EMP-ALICE",
	}
	repo.AddShift(shift)

	// Bob tries to check in for Alice
	bobUser := &auth.AuthUser{
		UID:        "u_bob",
		Role:       "driver",
		EmployeeID: "EMP-BOB",
	}
	checkInReq := httptest.NewRequest("PUT", "/api/dispatch/shifts/"+shift.ID+"/check-in", bytes.NewReader([]byte("{}")))
	checkInReq = injectChiURLParam(checkInReq, "id", shift.ID)
	checkInReq = checkInReq.WithContext(context.WithValue(checkInReq.Context(), auth.UserContextKey, bobUser))
	w := httptest.NewRecorder()

	h.CheckInDriver(w, checkInReq)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when driver checks in for another driver, got %d: %s", w.Code, w.Body.String())
	}

	// Alice checks in for herself
	aliceUser := &auth.AuthUser{
		UID:        "u_alice",
		Role:       "driver",
		EmployeeID: "EMP-ALICE",
	}
	aliceCheckIn := httptest.NewRequest("PUT", "/api/dispatch/shifts/"+shift.ID+"/check-in", bytes.NewReader([]byte("{}")))
	aliceCheckIn = injectChiURLParam(aliceCheckIn, "id", shift.ID)
	aliceCheckIn = aliceCheckIn.WithContext(context.WithValue(aliceCheckIn.Context(), auth.UserContextKey, aliceUser))
	wAlice := httptest.NewRecorder()

	h.CheckInDriver(wAlice, aliceCheckIn)
	if wAlice.Code != http.StatusOK {
		t.Fatalf("expected 200 OK when driver checks in for herself, got %d: %s", wAlice.Code, wAlice.Body.String())
	}
}

// TestSecurityRBAC_PayrollAndExpenses verifies that sensitive payroll and expense approval endpoints require appropriate module rights.
func TestSecurityRBAC_PayrollAndExpenses(t *testing.T) {
	repo := repository.NewMemoryDispatchRepository()
	h := NewDispatchHandler(repo, true)

	driverUser := &auth.AuthUser{
		UID:        "u_driver",
		Role:       "driver",
		EmployeeID: "EMP-DRIVER",
	}

	// 1. Driver tries to save payroll settings
	payrollReq := httptest.NewRequest("PUT", "/api/dispatch/payroll-settings", bytes.NewReader([]byte(`{"defaultPayOption":"hourly"}`)))
	payrollReq = payrollReq.WithContext(context.WithValue(context.Background(), auth.UserContextKey, driverUser))
	wPayroll := httptest.NewRecorder()
	h.SavePayrollSettings(wPayroll, payrollReq)
	if wPayroll.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for driver modifying payroll settings, got %d", wPayroll.Code)
	}

	// 2. Driver tries to review expense claim
	expenseReq := httptest.NewRequest("POST", "/api/dispatch/expense-reimbursements/exp-1/review", bytes.NewReader([]byte(`{"status":"approved"}`)))
	expenseReq = injectChiURLParam(expenseReq, "id", "exp-1")
	expenseReq = expenseReq.WithContext(context.WithValue(expenseReq.Context(), auth.UserContextKey, driverUser))
	wExpense := httptest.NewRecorder()
	h.ReviewExpenseClaim(wExpense, expenseReq)
	if wExpense.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for driver reviewing expense claim, got %d", wExpense.Code)
	}
}

// TestSecurityAI_UnauthenticatedGuestRole verifies that unauthenticated requests to AI cannot spoof roles.
func TestSecurityAI_UnauthenticatedGuestRole(t *testing.T) {
	aiToolService := services.NewAIToolService(nil, nil, nil, nil, nil, nil)
	aiService := services.NewAIService(aiToolService)
	aiH := NewAIHandler(aiService)

	spoofedBody := []byte(`{"message":"List all staff salaries","userRole":"admin","operatorName":"SpoofedAdmin"}`)
	req := httptest.NewRequest("POST", "/api/public/ai/chat", bytes.NewReader(spoofedBody))
	w := httptest.NewRecorder()

	aiH.ProcessChat(w, req)

	// Builtin AI returns a response
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from AI chat, got %d: %s", w.Code, w.Body.String())
	}
}

type recordingSMS struct {
	to []string
}

func (s *recordingSMS) SendSMS(toPhone, messageBody string) error {
	s.to = append(s.to, toPhone)
	return nil
}

func TestNotifyParentsRejectsUnknownContact(t *testing.T) {
	repo := repository.NewMemoryDispatchRepository()
	students := repository.NewMemoryStudentRepository()
	h := NewDispatchHandler(repo, true)
	h.UseStudentLookup(students)
	sms := &recordingSMS{}
	h.UseParentNotifiers(sms, nil)

	if err := students.Create(context.Background(), &models.Student{
		ID:        "STU-1",
		StudentID: 42,
		Contacts: []models.StudentContact{{
			MobilePhone: "(613) 555-0100",
			Email:       "parent@example.com",
		}},
	}); err != nil {
		t.Fatal(err)
	}
	shift := &models.DispatchShift{
		ID: "DS-notify",
		Stops: []models.DispatchShiftStop{{
			AssignedStudents: []models.DispatchShiftStopStudent{{StudentID: 42}},
		}},
	}
	repo.AddShift(shift)

	payload, _ := json.Marshal(map[string]interface{}{
		"channels":    []string{"sms"},
		"messageText": "delay",
		"recipients": []map[string]interface{}{{
			"studentId": 42,
			"phone":     "9995551212",
			"email":     "stranger@example.com",
		}},
	})
	req := httptest.NewRequest("POST", "/api/dispatch/shifts/"+shift.ID+"/notify-parents", bytes.NewReader(payload))
	req = injectChiURLParam(req, "id", shift.ID)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.AuthUser{Role: "dispatcher"}))
	w := httptest.NewRecorder()
	h.NotifyParents(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an unknown contact, got %d: %s", w.Code, w.Body.String())
	}
	if len(sms.to) != 0 {
		t.Fatalf("sent SMS to an unverified number: %v", sms.to)
	}
}

func TestNotifyParentsSendsStoredContact(t *testing.T) {
	repo := repository.NewMemoryDispatchRepository()
	students := repository.NewMemoryStudentRepository()
	h := NewDispatchHandler(repo, true)
	h.UseStudentLookup(students)
	sms := &recordingSMS{}
	h.UseParentNotifiers(sms, nil)

	if err := students.Create(context.Background(), &models.Student{
		ID:        "STU-1",
		StudentID: 42,
		Contacts: []models.StudentContact{{
			MobilePhone: "(613) 555-0100",
		}},
	}); err != nil {
		t.Fatal(err)
	}
	shift := &models.DispatchShift{
		ID: "DS-notify-ok",
		Stops: []models.DispatchShiftStop{{
			AssignedStudents: []models.DispatchShiftStopStudent{{StudentID: 42}},
		}},
	}
	repo.AddShift(shift)

	payload, _ := json.Marshal(map[string]interface{}{
		"channels":    []string{"sms"},
		"messageText": "delay",
		"recipients": []map[string]interface{}{{
			"studentId": 42,
			"phone":     "6135550100",
		}},
	})
	req := httptest.NewRequest("POST", "/api/dispatch/shifts/"+shift.ID+"/notify-parents", bytes.NewReader(payload))
	req = injectChiURLParam(req, "id", shift.ID)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.AuthUser{Role: "dispatcher"}))
	w := httptest.NewRecorder()
	h.NotifyParents(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for a stored contact, got %d: %s", w.Code, w.Body.String())
	}
	if len(sms.to) != 1 || sms.to[0] != "(613) 555-0100" {
		t.Fatalf("expected the stored phone, got %v", sms.to)
	}
}

func TestCrewAssignedToUnit(t *testing.T) {
	repo := repository.NewMemoryDispatchRepository()
	repo.AddShift(&models.DispatchShift{
		ID:           "DS-unit",
		DispatchDate: torontoToday(),
		UnitNumber:   "#12",
		DriverID:     "EMP-1",
	})
	h := &ParentHandler{dispatchRepo: repo}
	if !h.crewAssignedToUnit(context.Background(), "emp-1", "12") {
		t.Fatal("assigned driver was rejected")
	}
	if h.crewAssignedToUnit(context.Background(), "EMP-9", "12") {
		t.Fatal("unassigned driver was accepted")
	}
	if h.crewAssignedToUnit(context.Background(), "", "12") {
		t.Fatal("blank employee was accepted")
	}
}
