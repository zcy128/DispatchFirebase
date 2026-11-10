package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

func TestSMSHandler_SendAndHistory(t *testing.T) {
	cfg := &config.Config{
		AppMode:          "demo",
		TwilioAccountSID: "", // Dev simulation mode
		TwilioFromNumber: "+18005550199",
	}
	twilioService := services.NewTwilioService(cfg)
	smsRepo := repository.NewMemorySMSRepository()
	smsHandler := NewSMSHandler(twilioService, smsRepo, nil)

	// 1. Send SMS
	sendPayload := models.SendSMSRequest{
		ToPhone:       "(613) 555-0123",
		Message:       "Route CEPEP-021 check-in reminder.",
		RecipientName: "John Driver",
		ShiftID:       "DS-2026-11-10-CEPEP-021-AM",
		RouteNo:       "CEPEP-021",
	}
	body, _ := json.Marshal(sendPayload)
	req := httptest.NewRequest("POST", "/api/sms/send", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	smsHandler.SendSMS(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var sentMsg models.SMSMessage
	if err := json.NewDecoder(rec.Body).Decode(&sentMsg); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if sentMsg.Direction != "outbound" {
		t.Errorf("expected direction outbound, got %s", sentMsg.Direction)
	}
	if sentMsg.Message != sendPayload.Message {
		t.Errorf("expected message '%s', got '%s'", sendPayload.Message, sentMsg.Message)
	}
	if sentMsg.NormalizedPhone != "6135550123" {
		t.Errorf("expected normalized phone 6135550123, got %s", sentMsg.NormalizedPhone)
	}

	// 2. Simulate Inbound reply
	now := time.Now().UTC()
	_ = smsRepo.Save(context.Background(), &models.SMSMessage{
		Direction:       "inbound",
		FromPhone:       "+16135550123",
		ToPhone:         "+18005550199",
		NormalizedPhone: "6135550123",
		Message:         "Understood, heading to first stop now.",
		Status:          "received",
		CreatedAt:       now.Add(1 * time.Minute),
		DateStr:         now.Format("2006-01-02"),
	})

	// 3. Fetch History for this phone number
	histReq := httptest.NewRequest("GET", "/api/sms/history?phone=613-555-0123&date="+now.Format("2006-01-02"), nil)
	histRec := httptest.NewRecorder()

	smsHandler.GetHistory(histRec, histReq)

	if histRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on history, got %d: %s", histRec.Code, histRec.Body.String())
	}

	var messages []*models.SMSMessage
	if err := json.NewDecoder(histRec.Body).Decode(&messages); err != nil {
		t.Fatalf("failed to decode history: %v", err)
	}

	if len(messages) != 2 {
		t.Fatalf("expected 2 messages (1 outbound + 1 inbound), got %d", len(messages))
	}
	if messages[0].Direction != "outbound" || messages[1].Direction != "inbound" {
		t.Errorf("expected chronological order: outbound then inbound")
	}
	if messages[1].Message != "Understood, heading to first stop now." {
		t.Errorf("unexpected inbound message: %s", messages[1].Message)
	}
}
