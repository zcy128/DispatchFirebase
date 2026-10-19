package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/mail"
	"os"
	"regexp"
	"strings"
	"time"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

// SNSInboundPayload represents the outer envelope sent by Amazon SNS
type SNSInboundPayload struct {
	Type             string `json:"Type"`
	MessageID        string `json:"MessageId"`
	TopicArn         string `json:"TopicArn"`
	Subject          string `json:"Subject"`
	Message          string `json:"Message"`
	Timestamp        string `json:"Timestamp"`
	SignatureVersion string `json:"SignatureVersion"`
	Signature        string `json:"Signature"`
	SigningCertURL   string `json:"SigningCertURL"`
	SubscribeURL     string `json:"SubscribeURL"`
	Token            string `json:"Token"`
}

// SESInboundNotification represents the inner SES JSON stored in SNS's Message field
type SESInboundNotification struct {
	NotificationType string `json:"notificationType"`
	Mail             struct {
		Timestamp        string   `json:"timestamp"`
		Source           string   `json:"source"`
		MessageID        string   `json:"messageId"`
		Destination      []string `json:"destination"`
		HeadersTruncated bool     `json:"headersTruncated"`
		Headers          []struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		} `json:"headers"`
		CommonHeaders struct {
			ReturnPath string      `json:"returnPath"`
			From       interface{} `json:"from"`
			Date       string      `json:"date"`
			To         interface{} `json:"to"`
			MessageID  string      `json:"messageId"`
			Subject    string      `json:"subject"`
		} `json:"commonHeaders"`
	} `json:"mail"`
	Receipt struct {
		Action struct {
			Type     string `json:"type"`
			TopicArn string `json:"topicArn"`
		} `json:"action"`
		SpamVerdict struct {
			Status string `json:"status"`
		} `json:"spamVerdict"`
		SpfVerdict struct {
			Status string `json:"status"`
		} `json:"spfVerdict"`
		DkimVerdict struct {
			Status string `json:"status"`
		} `json:"dkimVerdict"`
		DmarcVerdict struct {
			Status string `json:"status"`
		} `json:"dmarcVerdict"`
	} `json:"receipt"`
	Content string `json:"content"` // Raw RFC822 email content if configured
}

type InboundEmailService struct {
	cfg          *config.Config
	dispatchRepo repository.DispatchRepository
	empRepo      repository.EmployeeRepository
	emailService *EmailService
	httpClient   *http.Client
}

func NewInboundEmailService(
	cfg *config.Config,
	dispatchRepo repository.DispatchRepository,
	empRepo repository.EmployeeRepository,
	emailService *EmailService,
) *InboundEmailService {
	return &InboundEmailService{
		cfg:          cfg,
		dispatchRepo: dispatchRepo,
		empRepo:      empRepo,
		emailService: emailService,
		httpClient:   &http.Client{Timeout: 15 * time.Second},
	}
}

// ProcessSNSWebhook processes incoming Amazon SNS webhook requests
func (s *InboundEmailService) ProcessSNSWebhook(ctx context.Context, body []byte) (string, error) {
	var sns SNSInboundPayload
	if err := json.Unmarshal(body, &sns); err != nil {
		return "", fmt.Errorf("invalid SNS JSON: %w", err)
	}

	// 1. Auto-confirm SNS subscription
	if sns.Type == "SubscriptionConfirmation" {
		log.Printf("[SNS-AUTO-SUBSCRIBE] Received SubscriptionConfirmation for topic: %s", sns.TopicArn)
		if sns.SubscribeURL != "" {
			resp, err := s.httpClient.Get(sns.SubscribeURL)
			if err != nil {
				log.Printf("[SNS-SUBSCRIBE-ERROR] Failed to confirm subscription URL: %v", err)
				return "", err
			}
			defer resp.Body.Close()
			log.Printf("[SNS-AUTO-SUBSCRIBE-SUCCESS] Topic confirmed! Status: %d", resp.StatusCode)
			return "subscription_confirmed", nil
		}
		return "subscription_no_url", nil
	}

	if sns.Type != "Notification" {
		return "ignored_type", nil
	}

	// 2. Parse inner SES notification
	var ses SESInboundNotification
	if err := json.Unmarshal([]byte(sns.Message), &ses); err != nil {
		return "", fmt.Errorf("failed to parse SES notification from SNS message: %w", err)
	}

	sender := ses.Mail.Source
	fromHeader := parseFirstString(ses.Mail.CommonHeaders.From)
	if fromHeader != "" {
		parsedAddr, err := mail.ParseAddress(fromHeader)
		if err == nil && parsedAddr.Address != "" {
			sender = parsedAddr.Address
		}
	}
	subject := ses.Mail.CommonHeaders.Subject
	rawContent := ses.Content
	recipient := ""
	if len(ses.Mail.Destination) > 0 {
		recipient = ses.Mail.Destination[0]
	} else if toStr := parseFirstString(ses.Mail.CommonHeaders.To); toStr != "" {
		if parsedTo, err := mail.ParseAddress(toStr); err == nil {
			recipient = parsedTo.Address
		} else {
			recipient = toStr
		}
	}
	cleanRecipient := strings.ToLower(strings.TrimSpace(recipient))

	log.Printf("[SES-INBOUND] Processing email from: %s -> To: %s | Subject: %s", sender, cleanRecipient, subject)

	// Extract plain text body
	bodyText := extractEmailBody(rawContent, sns.Message)

	// 1. Check if this is an HR approval/rejection reply
	if s.isHRApprovalReply(sender, subject, bodyText) {
		return s.handleHRReply(ctx, sender, subject, bodyText)
	}

	// 2. Route by destination mailbox
	// A: Leave / Time-off requests (leave@pcytech.ca, timeoff@pcytech.ca)
	if strings.Contains(cleanRecipient, "leave") || strings.Contains(cleanRecipient, "timeoff") {
		return s.handleDriverLeaveRequest(ctx, sender, subject, bodyText)
	}

	// B: Dispatch Operations (dispatch@pcytech.ca)
	if strings.Contains(cleanRecipient, "dispatch") {
		return s.handleDispatchForward(ctx, cleanRecipient, sender, subject, bodyText)
	}

	// C: Payroll & Compensation (payroll@pcytech.ca)
	if strings.Contains(cleanRecipient, "payroll") {
		return s.handlePayrollForward(ctx, cleanRecipient, sender, subject, bodyText)
	}

	// D: Heuristic check: if sent to general inbox but is a leave request
	if s.looksLikeLeaveRequest(subject, bodyText) {
		return s.handleDriverLeaveRequest(ctx, sender, subject, bodyText)
	}

	// E: General Fallback Forwarding
	return s.handleGeneralForward(ctx, cleanRecipient, sender, subject, bodyText)
}

func (s *InboundEmailService) handleDispatchForward(ctx context.Context, recipient, sender, subject, body string) (string, error) {
	targets := s.cfg.GetForwardTargets(recipient)
	log.Printf("[DISPATCH-FORWARD] Forwarding email from %s (To: %s) to %v", sender, recipient, targets)
	if err := s.emailService.ForwardEmail(targets, recipient, sender, subject, body); err != nil {
		return "", err
	}
	return fmt.Sprintf("forwarded_to_dispatch_%d_recipients", len(targets)), nil
}

func (s *InboundEmailService) handlePayrollForward(ctx context.Context, recipient, sender, subject, body string) (string, error) {
	targets := s.cfg.GetForwardTargets(recipient)
	log.Printf("[PAYROLL-FORWARD] Forwarding email from %s (To: %s) to %v", sender, recipient, targets)
	if err := s.emailService.ForwardEmail(targets, recipient, sender, subject, body); err != nil {
		return "", err
	}
	return fmt.Sprintf("forwarded_to_payroll_%d_recipients", len(targets)), nil
}

func (s *InboundEmailService) handleGeneralForward(ctx context.Context, recipient, sender, subject, body string) (string, error) {
	targets := s.cfg.GetForwardTargets(recipient)
	log.Printf("[GENERAL-FORWARD] Forwarding email from %s (To: %s) to %v", sender, recipient, targets)
	if err := s.emailService.ForwardEmail(targets, recipient, sender, subject, body); err != nil {
		return "", err
	}
	return fmt.Sprintf("forwarded_general_%d_recipients", len(targets)), nil
}

func (s *InboundEmailService) looksLikeLeaveRequest(subject, body string) bool {
	lower := strings.ToLower(subject + " " + body)
	return strings.Contains(lower, "leave") ||
		strings.Contains(lower, "sick") ||
		strings.Contains(lower, "vacation") ||
		strings.Contains(lower, "time off") ||
		strings.Contains(lower, "timeoff") ||
		strings.Contains(lower, "请假") ||
		strings.Contains(lower, "病假") ||
		strings.Contains(lower, "事假")
}

// isHRApprovalReply checks if this incoming email is an HR review decision
func (s *InboundEmailService) isHRApprovalReply(sender, subject, body string) bool {
	torPattern := regexp.MustCompile(`(?i)TOR-\d+`)
	hasTorInSubject := torPattern.MatchString(subject)
	hasTorInBody := torPattern.MatchString(body)

	if !hasTorInSubject && !hasTorInBody {
		return false
	}

	// Check if sender is HR or if body contains approval keywords
	isFromHR := strings.EqualFold(sender, s.cfg.HRNotificationEmail) ||
		strings.Contains(strings.ToLower(sender), "hr@") ||
		strings.Contains(strings.ToLower(sender), "admin@")

	lowerBody := strings.ToLower(body)
	hasApprovalWord := strings.Contains(lowerBody, "批准") ||
		strings.Contains(lowerBody, "同意") ||
		strings.Contains(lowerBody, "approve") ||
		strings.Contains(lowerBody, "approved") ||
		strings.Contains(lowerBody, "拒绝") ||
		strings.Contains(lowerBody, "不同意") ||
		strings.Contains(lowerBody, "reject") ||
		strings.Contains(lowerBody, "rejected") ||
		strings.Contains(lowerBody, "denied")

	return isFromHR || (hasTorInSubject && hasApprovalWord)
}

// handleHRReply updates the database and notifies the driver
func (s *InboundEmailService) handleHRReply(ctx context.Context, sender, subject, body string) (string, error) {
	torPattern := regexp.MustCompile(`(?i)TOR-\d+`)
	torID := torPattern.FindString(subject)
	if torID == "" {
		torID = torPattern.FindString(body)
	}
	if torID == "" {
		return "no_tor_found", nil
	}

	// Determine decision
	lowerBody := strings.ToLower(body)
	isReject := strings.Contains(lowerBody, "拒绝") ||
		strings.Contains(lowerBody, "不同意") ||
		strings.Contains(lowerBody, "reject") ||
		strings.Contains(lowerBody, "rejected") ||
		strings.Contains(lowerBody, "denied")

	decision := "approved"
	if isReject {
		decision = "rejected"
	}

	// Clean comments / notes from reply
	notes := extractFirstLineOrSummary(body)

	log.Printf("[HR-REPLY-DETECTED] Request %s: Decision=%s by %s", torID, decision, sender)

	var updated *models.TimeOffRequest
	var err error
	reviewPayload := &models.ReviewTimeOffRequestPayload{
		ReviewerUserID: sender,
		ReviewerName:   "HR Email (" + sender + ")",
		ApprovalNotes:  notes,
	}

	if decision == "approved" {
		updated, err = s.dispatchRepo.ApproveTimeOffRequest(ctx, torID, reviewPayload)
	} else {
		updated, err = s.dispatchRepo.RejectTimeOffRequest(ctx, torID, reviewPayload)
	}

	if err != nil {
		log.Printf("[HR-REPLY-ERROR] Failed to update time-off %s: %v", torID, err)
		return "", err
	}

	// Find the driver to email them
	driver, _ := s.findDriverByEmployeeID(ctx, updated.EmployeeID)
	if err := s.emailService.SendLeaveDecisionToDriver(updated, driver, decision, sender, notes); err != nil {
		log.Printf("[HR-REPLY-WARN] Failed to send email to driver: %v", err)
	}

	return fmt.Sprintf("time_off_%s_updated_%s", torID, decision), nil
}

// handleDriverLeaveRequest parses the email, creates the TimeOffRequest, and alerts HR
func (s *InboundEmailService) handleDriverLeaveRequest(ctx context.Context, sender, subject, body string) (string, error) {
	// 1. Identify driver by email (or fall back to body/subject search)
	driver, err := s.findDriver(ctx, sender, subject, body)
	if err != nil || driver == nil {
		log.Printf("[DRIVER-MATCH-FAILED] Could not identify employee for sender %s. Creating unassigned request with sender info.", sender)
	}

	empID := "EMP-UNKNOWN"
	empName := "Driver (" + sender + ")"
	empNum := ""
	if driver != nil {
		empID = driver.ID
		empName = driver.FullName
		empNum = driver.EmployeeNumber
	}

	// 2. Parse leave details using Gemini or fallback NLP
	details := s.extractLeaveDetailsWithAIOrRules(ctx, subject, body)

	// Default fallback dates if not found
	today := time.Now().Format("2006-01-02")
	if details.StartDate == "" {
		details.StartDate = today
	}
	if details.EndDate == "" {
		details.EndDate = details.StartDate
	}
	if details.ShiftType == "" {
		details.ShiftType = "ALL"
	}
	if details.LeaveType == "" {
		details.LeaveType = models.LeaveTypeSickLeave
	}
	if details.Comments == "" {
		details.Comments = strings.TrimSpace(subject + " | " + body)
		if len(details.Comments) > 300 {
			details.Comments = details.Comments[:300] + "..."
		}
	}

	// 3. Create TimeOffRequest in Firestore
	createPayload := &models.CreateTimeOffRequestPayload{
		EmployeeID:        empID,
		EmployeeNumber:    empNum,
		EmployeeName:      empName,
		LeaveType:         details.LeaveType,
		StartDate:         details.StartDate,
		EndDate:           details.EndDate,
		ShiftType:         details.ShiftType,
		Comments:          details.Comments,
		RequestedByUserID: sender,
		RequestedByName:   empName,
	}

	record, err := s.dispatchRepo.CreateTimeOffRequest(ctx, createPayload)
	if err != nil {
		log.Printf("[LEAVE-CREATE-ERROR] Failed to save time-off request: %v", err)
		return "", err
	}

	log.Printf("[LEAVE-REQUEST-CREATED] Successfully created TimeOffRequest %s for %s (%s to %s)",
		record.ID, empName, record.StartDate, record.EndDate)

	// 4. Send notification email to HR with one-click approval buttons
	if err := s.emailService.SendLeaveRequestToHR(record, driver); err != nil {
		log.Printf("[LEAVE-NOTIFY-HR-ERROR] Failed to notify HR: %v", err)
	}

	// 5. Send acknowledgment to the driver
	_ = s.emailService.SendDriverAck(record, sender)

	return fmt.Sprintf("created_%s", record.ID), nil
}

// ParsedLeaveDetails structure for structured extraction
type ParsedLeaveDetails struct {
	StartDate string           `json:"startDate"`
	EndDate   string           `json:"endDate"`
	ShiftType string           `json:"shiftType"`
	LeaveType models.LeaveType `json:"leaveType"`
	Comments  string           `json:"comments"`
}

// extractLeaveDetailsWithAIOrRules extracts dates and leave parameters
func (s *InboundEmailService) extractLeaveDetailsWithAIOrRules(ctx context.Context, subject, body string) ParsedLeaveDetails {
	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey != "" {
		if parsed, err := s.extractWithGemini(ctx, subject, body, geminiKey); err == nil {
			return *parsed
		}
	}
	return s.extractWithRules(subject, body)
}

// extractWithGemini uses Gemini Flash JSON output for high accuracy date/reason understanding
func (s *InboundEmailService) extractWithGemini(ctx context.Context, subject, body, apiKey string) (*ParsedLeaveDetails, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", apiKey)

	todayStr := time.Now().Format("2006-01-02")
	prompt := fmt.Sprintf(`Today's date is %s.
Extract the leave request details from the following email.
Subject: %s
Body: %s

Respond with ONLY a raw JSON object with these keys:
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "shiftType": "ALL" | "AM" | "PM" | "Midday",
  "leaveType": "sick_leave" | "vacation" | "personal_days" | "bereavement_leave" | "other",
  "comments": "concise summary of reason"
}
If end date is not mentioned, use the same as startDate.
DO NOT wrap in markdown code blocks.`, todayStr, subject, body)

	reqPayload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]string{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.1,
			"responseMimeType": "application/json",
		},
	}

	jsonBytes, _ := json.Marshal(reqPayload)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil || len(geminiResp.Candidates) == 0 {
		return nil, fmt.Errorf("gemini response empty")
	}

	rawJSON := geminiResp.Candidates[0].Content.Parts[0].Text
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var details ParsedLeaveDetails
	if err := json.Unmarshal([]byte(rawJSON), &details); err != nil {
		return nil, err
	}
	return &details, nil
}

// extractWithRules provides a fast, offline regex and keyword fallback
func (s *InboundEmailService) extractWithRules(subject, body string) ParsedLeaveDetails {
	text := subject + " " + body
	lower := strings.ToLower(text)

	var details ParsedLeaveDetails
	details.LeaveType = models.LeaveTypeSickLeave

	if strings.Contains(lower, "vacation") || strings.Contains(lower, "holiday") || strings.Contains(lower, "休假") || strings.Contains(lower, "年假") {
		details.LeaveType = models.LeaveTypeVacation
	} else if strings.Contains(lower, "personal") || strings.Contains(lower, "事假") || strings.Contains(lower, "私事") {
		details.LeaveType = models.LeaveTypePersonalDays
	} else if strings.Contains(lower, "bereavement") || strings.Contains(lower, "funeral") || strings.Contains(lower, "丧假") {
		details.LeaveType = models.LeaveTypeBereavementLeave
	}

	// Shift detection
	details.ShiftType = "ALL"
	if strings.Contains(lower, "morning") || strings.Contains(lower, "上午") || strings.Contains(lower, "am shift") {
		details.ShiftType = "AM"
	} else if strings.Contains(lower, "afternoon") || strings.Contains(lower, "下午") || strings.Contains(lower, "pm shift") {
		details.ShiftType = "PM"
	}

	// Date regex matching YYYY-MM-DD
	datePattern := regexp.MustCompile(`\b\d{4}-\d{2}-\d{2}\b`)
	foundDates := datePattern.FindAllString(text, -1)
	if len(foundDates) >= 2 {
		details.StartDate = foundDates[0]
		details.EndDate = foundDates[1]
	} else if len(foundDates) == 1 {
		details.StartDate = foundDates[0]
		details.EndDate = foundDates[0]
	} else {
		// Tomorrow
		if strings.Contains(lower, "tomorrow") || strings.Contains(lower, "明天") {
			tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
			details.StartDate = tomorrow
			details.EndDate = tomorrow
		} else {
			today := time.Now().Format("2006-01-02")
			details.StartDate = today
			details.EndDate = today
		}
	}

	details.Comments = extractFirstLineOrSummary(body)
	return details
}

// findDriver searches for the employee by personal, work, or preferred email, or text search
func (s *InboundEmailService) findDriver(ctx context.Context, senderEmail, subject, body string) (*models.Employee, error) {
	cleanSender := strings.ToLower(strings.TrimSpace(senderEmail))

	// Fetch all active employees
	activeTrue := true
	employees, err := s.empRepo.List(ctx, repository.EmployeeFilter{ActiveOnly: &activeTrue})
	if err != nil {
		return nil, err
	}

	// 1. Direct email match
	for _, emp := range employees {
		if strings.EqualFold(emp.PersonalEmail, cleanSender) ||
			strings.EqualFold(emp.WorkEmail, cleanSender) ||
			strings.EqualFold(emp.PreferredEmail, cleanSender) {
			return emp, nil
		}
	}

	// 2. Employee number match in email body or subject (e.g. EMP-2001 or 2001)
	empNumPattern := regexp.MustCompile(`(?i)\bEMP-?\d{3,5}\b`)
	fullText := subject + " " + body
	foundNum := empNumPattern.FindString(fullText)
	if foundNum != "" {
		cleanNum := strings.ToUpper(strings.ReplaceAll(foundNum, "-", ""))
		for _, emp := range employees {
			empNumUpper := strings.ToUpper(strings.ReplaceAll(emp.EmployeeNumber, "-", ""))
			if empNumUpper == cleanNum || strings.EqualFold(emp.ID, foundNum) {
				return emp, nil
			}
		}
	}

	// 3. Name match in body or subject
	for _, emp := range employees {
		if emp.FullName != "" && strings.Contains(fullText, emp.FullName) {
			return emp, nil
		}
	}

	return nil, nil
}

func (s *InboundEmailService) findDriverByEmployeeID(ctx context.Context, empID string) (*models.Employee, error) {
	if empID == "" || empID == "EMP-UNKNOWN" {
		return nil, nil
	}
	return s.empRepo.GetByID(ctx, empID)
}

// extractEmailBody extracts clean text from raw RFC822 or JSON strings
func extractEmailBody(rawContent, fallback string) string {
	if rawContent != "" {
		r := strings.NewReader(rawContent)
		msg, err := mail.ReadMessage(r)
		if err == nil {
			bodyBytes, err := io.ReadAll(msg.Body)
			if err == nil {
				return string(bodyBytes)
			}
		}
	}
	return fallback
}

func extractFirstLineOrSummary(text string) string {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" && !strings.HasPrefix(trimmed, ">") && !strings.HasPrefix(trimmed, "On ") {
			if len(trimmed) > 150 {
				return trimmed[:150] + "..."
			}
			return trimmed
		}
	}
	return "No notes provided"
}

func parseFirstString(val interface{}) string {
	if val == nil {
		return ""
	}
	switch v := val.(type) {
	case string:
		return v
	case []interface{}:
		if len(v) > 0 {
			if s, ok := v[0].(string); ok {
				return s
			}
		}
	case []string:
		if len(v) > 0 {
			return v[0]
		}
	}
	return ""
}
