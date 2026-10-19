package services

import (
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"dispatch-server/internal/config"
)

type TwilioService struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewTwilioService(cfg *config.Config) *TwilioService {
	return &TwilioService{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// SendSMS sends an SMS message via Twilio REST API, or logs locally in development mode
func (s *TwilioService) SendSMS(toPhone, messageBody string) error {
	normalizedTo := s.FormatE164(toPhone)
	fromNumber := s.cfg.TwilioFromNumber
	if fromNumber == "" {
		fromNumber = "+18005550199" // fallback default
	}

	// Dev / simulation mode if credentials are not configured
	if s.cfg.TwilioAccountSID == "" || s.cfg.TwilioAuthToken == "" {
		log.Printf("[TWILIO-SIMULATION] Outbound SMS to: %s | From: %s | Body:\n%s\n---", normalizedTo, fromNumber, messageBody)
		return nil
	}

	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", s.cfg.TwilioAccountSID)

	data := url.Values{}
	data.Set("To", normalizedTo)
	data.Set("From", fromNumber)
	data.Set("Body", messageBody)

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create Twilio request: %w", err)
	}

	req.SetBasicAuth(s.cfg.TwilioAccountSID, s.cfg.TwilioAuthToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("twilio HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("twilio API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	log.Printf("[TWILIO] Successfully dispatched SMS to %s", normalizedTo)
	return nil
}

// TwiMLResponse structure for serializing XML TwiML messages
type TwiMLResponse struct {
	XMLName xml.Name     `xml:"Response"`
	Message TwiMLMessage `xml:"Message"`
}

type TwiMLMessage struct {
	Body string `xml:"Body"`
}

// GenerateTwiMLResponse produces standard TwiML XML to respond to incoming SMS
func (s *TwilioService) GenerateTwiMLResponse(body string) string {
	res := TwiMLResponse{
		Message: TwiMLMessage{Body: body},
	}
	out, err := xml.MarshalIndent(res, "", "  ")
	if err != nil {
		return fmt.Sprintf("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message><Body>%s</Body></Message></Response>", body)
	}
	return xml.Header + string(out)
}

// FormatE164 normalizes phone numbers into E.164 format (+1XXXXXXXXXX)
func (s *TwilioService) FormatE164(phone string) string {
	clean := strings.TrimSpace(phone)
	if strings.HasPrefix(clean, "+") {
		return clean
	}

	// Extract digits only
	var b strings.Builder
	for _, r := range clean {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()

	// 10-digit North American number without country code
	if len(digits) == 10 {
		return "+1" + digits
	}
	// 11-digit number starting with 1
	if len(digits) == 11 && strings.HasPrefix(digits, "1") {
		return "+" + digits
	}

	if digits != "" {
		return "+" + digits
	}
	return clean
}
