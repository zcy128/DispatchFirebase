package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

type SMSHandler struct {
	twilioService *services.TwilioService
	smsRepo       repository.SMSRepository
	empRepo       repository.EmployeeRepository
}

func NewSMSHandler(
	twilioService *services.TwilioService,
	smsRepo repository.SMSRepository,
	empRepo repository.EmployeeRepository,
) *SMSHandler {
	return &SMSHandler{
		twilioService: twilioService,
		smsRepo:       smsRepo,
		empRepo:       empRepo,
	}
}

// SendSMS handles dispatching an SMS via Twilio API and recording the message.
func (h *SMSHandler) SendSMS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.SendSMSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	cleanTo := strings.TrimSpace(req.ToPhone)
	cleanMsg := strings.TrimSpace(req.Message)
	if cleanTo == "" {
		http.Error(w, `{"error":"recipient phone number is required"}`, http.StatusBadRequest)
		return
	}
	if cleanMsg == "" {
		http.Error(w, `{"error":"message content cannot be empty"}`, http.StatusBadRequest)
		return
	}

	// Resolve sender identity
	senderName := "Dispatcher"
	if u := auth.GetUser(r.Context()); u != nil {
		if u.FullName != "" {
			senderName = u.FullName
		} else if u.Username != "" {
			senderName = u.Username
		} else if u.Email != "" {
			senderName = u.Email
		}
	}

	// Send via Twilio (or simulation mode in dev)
	fromNumber := "+18005550199"
	if h.twilioService != nil {
		if fn := h.twilioService.FromNumber(); fn != "" {
			fromNumber = fn
		}
		if err := h.twilioService.SendSMS(cleanTo, cleanMsg); err != nil {
			http.Error(w, `{"error":"failed to dispatch SMS: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	}

	now := time.Now().UTC()
	smsRecord := &models.SMSMessage{
		Direction:       "outbound",
		FromPhone:       fromNumber,
		ToPhone:         cleanTo,
		NormalizedPhone: repository.NormalizePhone(cleanTo),
		Message:         cleanMsg,
		RecipientName:   strings.TrimSpace(req.RecipientName),
		SenderName:      senderName,
		ShiftID:         strings.TrimSpace(req.ShiftID),
		RouteNo:         strings.TrimSpace(req.RouteNo),
		Status:          "sent",
		CreatedAt:       now,
		DateStr:         now.Format("2006-01-02"),
	}

	if h.smsRepo != nil {
		if err := h.smsRepo.Save(r.Context(), smsRecord); err != nil {
			// Log and return partial success with record
			http.Error(w, `{"error":"sms sent but failed to persist record: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(smsRecord)
}

// GetHistory retrieves today's SMS message records for a specific phone number.
func (h *SMSHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	phone := strings.TrimSpace(r.URL.Query().Get("phone"))
	dateStr := strings.TrimSpace(r.URL.Query().Get("date"))
	if dateStr == "" {
		dateStr = time.Now().UTC().Format("2006-01-02")
	}

	if h.smsRepo == nil {
		_ = json.NewEncoder(w).Encode([]*models.SMSMessage{})
		return
	}

	messages, err := h.smsRepo.ListForPhoneAndDate(r.Context(), phone, dateStr)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch SMS history: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	if messages == nil {
		messages = []*models.SMSMessage{}
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(messages)
}
