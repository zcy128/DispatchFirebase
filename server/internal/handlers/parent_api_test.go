package handlers_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"dispatch-server/internal/config"
	"dispatch-server/internal/handlers"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

func setupTestEnvironment() (*handlers.ParentHandler, *handlers.TwilioWebhookHandler, repository.StudentRepository, repository.ParentRepository, repository.DispatchRepository) {
	cfg := &config.Config{
		IsDevelopment:       true,
		ApprovalSecret:      "test-secret",
		ParentJWTSigningKey: "test-jwt-secret",
	}

	studentRepo := repository.NewMemoryStudentRepository()
	parentRepo := repository.NewMemoryParentRepository()
	dispatchRepo := repository.NewMemoryDispatchRepository()
	routeRepo := repository.NewMemoryRouteRepository()

	twilioService := services.NewTwilioService(cfg)
	emailService := services.NewEmailService(cfg)
	etaService := services.NewETAService()

	parentHandler := handlers.NewParentHandler(cfg, studentRepo, parentRepo, dispatchRepo, routeRepo, twilioService, emailService, etaService, nil)
	twilioWebhookHandler := handlers.NewTwilioWebhookHandler(cfg, studentRepo, dispatchRepo, parentRepo, twilioService, etaService)

	// Determine current Toronto time and AM/PM shift window
	loc, errLoc := time.LoadLocation("America/Toronto")
	if errLoc != nil {
		loc = time.FixedZone("EDT", -4*3600)
	}
	now := time.Now().In(loc)
	todayStr := now.Format("2006-01-02")
	currentShift := "AM"
	if now.Hour() >= 12 {
		currentShift = "PM"
	}

	// Seed test student
	ctx := context.Background()
	s1 := &models.Student{
		ID:             "STU-1",
		StudentID:      1,
		StudentNo:      "S-1",
		FirstName:      "Emma",
		LastName:       "Watson",
		StudentName:    "Emma Watson",
		Grade:          "2",
		SchoolName:     "Broadview Public",
		StudentAddress: "450 Fraser Ave",
		Active:         true,
		Routes:         "OCDSB-001",
		Contacts: []models.StudentContact{
			{
				ContactName: "David Watson",
				MobilePhone: "613-555-0199",
				Email:       "parent@pcytech.ca",
				Active:      true,
			},
		},
		Stops: []models.StudentStop{
			{
				StopID:   "STP-1",
				Time:     "07:35",
				Type:     "HomePickup",
				Location: "Woodroffe & Baseline",
				Route:    "OCDSB-001",
				Shift:    currentShift,
			},
		},
	}
	_ = studentRepo.Create(ctx, s1)

	// Seed active dispatch shift
	dispatchRepo.AddShift(&models.DispatchShift{
		ID:           "DS-TODAY-001",
		DispatchDate: todayStr,
		RouteNo:      "OCDSB-001",
		ShiftType:    currentShift,
		UnitNumber:   "42",
		DriverName:   "Mike Ross",
		LateMinutes:  0,
		Stops: []models.DispatchShiftStop{
			{
				StopID:           1,
				Sequence:         1,
				StopLocation:     "Woodroffe & Baseline",
				StopScheduleTime: "07:35",
				AssignedStudents: []models.DispatchShiftStopStudent{
					{StudentID: 1, StudentNo: "S-1", StudentName: "Emma Watson", Status: "pending"},
				},
			},
		},
	})

	return parentHandler, twilioWebhookHandler, studentRepo, parentRepo, dispatchRepo
}

func TestRequestOTP_Success(t *testing.T) {
	parentHandler, _, _, _, _ := setupTestEnvironment()

	payload := `{"contact":"613-555-0199"}`
	req := httptest.NewRequest("POST", "/api/parent/auth/request-otp", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	parentHandler.RequestOTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp models.RequestOTPResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if !resp.Success {
		t.Errorf("expected success true")
	}
	if resp.MatchedStudentsCount != 1 {
		t.Errorf("expected 1 student matched, got %d", resp.MatchedStudentsCount)
	}
	if resp.DevCode == "" {
		t.Errorf("expected devCode to be populated in dev mode")
	}
}

func TestRequestOTP_NotFound(t *testing.T) {
	parentHandler, _, _, _, _ := setupTestEnvironment()

	payload := `{"contact":"613-000-0000"}`
	req := httptest.NewRequest("POST", "/api/parent/auth/request-otp", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	parentHandler.RequestOTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp models.RequestOTPResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.Success {
		t.Fatalf("expected success to be false for unknown number")
	}
}

func TestRequestOTP_DemoContacts(t *testing.T) {
	parentHandler, _, _, _, _ := setupTestEnvironment()

	demoContacts := []string{
		"613-555-0199",
		"613-555-0100",
		"parent@pcytech.ca",
		"parent@example.com",
		"demo",
	}

	for _, c := range demoContacts {
		t.Run("contact_"+c, func(t *testing.T) {
			payload := fmt.Sprintf(`{"contact":"%s"}`, c)
			req := httptest.NewRequest("POST", "/api/parent/auth/request-otp", strings.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			parentHandler.RequestOTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
			}

			var resp models.RequestOTPResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			if !resp.Success {
				t.Errorf("expected success true for demo contact %s, got: %s", c, resp.Message)
			}
		})
	}
}

func TestVerifyOTP_And_Register(t *testing.T) {
	parentHandler, _, _, _, _ := setupTestEnvironment()

	// 1. Request OTP
	reqOTP := httptest.NewRequest("POST", "/api/parent/auth/request-otp", strings.NewReader(`{"contact":"parent@pcytech.ca"}`))
	recOTP := httptest.NewRecorder()
	parentHandler.RequestOTP(recOTP, reqOTP)

	var otpResp models.RequestOTPResponse
	_ = json.Unmarshal(recOTP.Body.Bytes(), &otpResp)

	// 2. Verify OTP
	verifyBody := fmt.Sprintf(`{"contact":"parent@pcytech.ca","code":"%s"}`, otpResp.DevCode)
	reqVerify := httptest.NewRequest("POST", "/api/parent/auth/verify-otp", strings.NewReader(verifyBody))
	recVerify := httptest.NewRecorder()
	parentHandler.VerifyOTP(recVerify, reqVerify)

	if recVerify.Code != http.StatusOK {
		t.Fatalf("verify OTP failed: %s", recVerify.Body.String())
	}

	var verifyResp models.VerifyOTPResponse
	_ = json.Unmarshal(recVerify.Body.Bytes(), &verifyResp)

	if !verifyResp.Success || verifyResp.Token == "" {
		t.Fatalf("expected token in response")
	}
	if len(verifyResp.Students) != 1 {
		t.Fatalf("expected 1 commute in students list, got %d", len(verifyResp.Students))
	}
	if verifyResp.Students[0].StudentName != "Emma Watson" {
		t.Errorf("expected Emma Watson, got %s", verifyResp.Students[0].StudentName)
	}

	// 3. Optional Account Registration
	regBody := `{"contact":"parent@pcytech.ca","password":"SecretPassword123","name":"David Watson"}`
	reqReg := httptest.NewRequest("POST", "/api/parent/auth/register", strings.NewReader(regBody))
	recReg := httptest.NewRecorder()
	parentHandler.Register(recReg, reqReg)

	if recReg.Code != http.StatusOK {
		t.Fatalf("registration failed: %s", recReg.Body.String())
	}
}

func TestTwilioInboundSMS(t *testing.T) {
	_, twilioWebhookHandler, _, _, _ := setupTestEnvironment()

	formData := url.Values{}
	formData.Set("From", "+16135550199")
	formData.Set("Body", "ETA")
	formData.Set("MessageSid", "SM123456789")

	req := httptest.NewRequest("POST", "/api/integrations/twilio/sms-inbound", strings.NewReader(formData.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	twilioWebhookHandler.HandleTwilioInboundSMS(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from twilio webhook, got %d", rec.Code)
	}

	respBody := rec.Body.String()
	if !strings.Contains(respBody, "<Response>") || !strings.Contains(respBody, "<Message>") {
		t.Errorf("expected valid TwiML XML response, got: %s", respBody)
	}

	if !strings.Contains(respBody, "Emma Watson") {
		t.Errorf("expected student Emma Watson in SMS reply, got: %s", respBody)
	}
	if !strings.Contains(respBody, "Bus: #42") {
		t.Errorf("expected Bus: #42 in SMS reply, got: %s", respBody)
	}
}
