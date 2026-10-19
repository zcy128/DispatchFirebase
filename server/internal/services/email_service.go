package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"mime"
	"net/smtp"
	"strings"
	"time"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
)

// EmailService handles outbound email delivery (via SMTP or SES) and token generation
type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

// GenerateActionToken creates an HMAC-SHA256 signature for one-click email approvals
func (s *EmailService) GenerateActionToken(reqID, action string, exp int64) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.ApprovalSecret))
	data := fmt.Sprintf("%s:%s:%d", reqID, action, exp)
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyActionToken validates an HMAC-SHA256 signature
func (s *EmailService) VerifyActionToken(reqID, action string, exp int64, token string) bool {
	if time.Now().Unix() > exp {
		return false
	}
	expected := s.GenerateActionToken(reqID, action, exp)
	return hmac.Equal([]byte(expected), []byte(token))
}

// SendEmail delivers an email via standard SMTP or logs if SMTP is not configured
func (s *EmailService) SendEmail(to []string, subject, htmlBody, textBody string) error {
	from := s.cfg.SMTPFrom
	if from == "" {
		from = "leave@pcytech.ca"
	}

	// If SMTP host is not configured, log email delivery in dev mode
	if s.cfg.SMTPHost == "" {
		log.Printf("[EMAIL-SIMULATION] Outbound Email to: %v | Subject: %s\nText:\n%s\n---", to, subject, textBody)
		return nil
	}

	addr := fmt.Sprintf("%s:%d", s.cfg.SMTPHost, s.cfg.SMTPPort)
	var auth smtp.Auth
	if s.cfg.SMTPUsername != "" && s.cfg.SMTPPassword != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	}

	// Build MIME multipart email
	boundary := "===Part_Dispatch_Email_Boundary==="
	header := make(map[string]string)
	header["From"] = from
	header["To"] = strings.Join(to, ", ")
	header["Subject"] = mime.QEncoding.Encode("UTF-8", subject)
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = fmt.Sprintf("multipart/alternative; boundary=\"%s\"", boundary)

	var msg strings.Builder
	for k, v := range header {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")

	// Text part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
	msg.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
	msg.WriteString(base64.StdEncoding.EncodeToString([]byte(textBody)))
	msg.WriteString("\r\n\r\n")

	// HTML part
	if htmlBody != "" {
		msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
		msg.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
		msg.WriteString(base64.StdEncoding.EncodeToString([]byte(htmlBody)))
		msg.WriteString("\r\n\r\n")
	}

	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	err := smtp.SendMail(addr, auth, from, to, []byte(msg.String()))
	if err != nil {
		log.Printf("[EMAIL-ERROR] Failed to send email to %v: %v", to, err)
		return err
	}
	log.Printf("[EMAIL-SENT] Successfully delivered email to %v (Subject: %s)", to, subject)
	return nil
}

// SendLeaveRequestToHR formats and emails the leave request to HR with quick-action links
func (s *EmailService) SendLeaveRequestToHR(req *models.TimeOffRequest, driver *models.Employee) error {
	recipients := s.cfg.GetForwardTargets("leave@pcytech.ca")
	if len(recipients) == 0 {
		recipients = []string{"HR@pcytech.ca"}
	}

	subject := fmt.Sprintf("[Time-Off Request %s] %s - Leave Application (%s to %s)", req.ID, req.EmployeeName, req.StartDate, req.EndDate)

	// Expiry in 7 days
	exp := time.Now().Add(7 * 24 * time.Hour).Unix()
	approveToken := s.GenerateActionToken(req.ID, "approve", exp)
	rejectToken := s.GenerateActionToken(req.ID, "reject", exp)

	baseURL := strings.TrimRight(s.cfg.AppBaseURL, "/")
	approveURL := fmt.Sprintf("%s/api/public/timeoff/quick-action?id=%s&action=approve&exp=%d&token=%s", baseURL, req.ID, exp, approveToken)
	rejectURL := fmt.Sprintf("%s/api/public/timeoff/quick-action?id=%s&action=reject&exp=%d&token=%s", baseURL, req.ID, exp, rejectToken)

	driverInfo := req.EmployeeName
	if driver != nil {
		if driver.EmployeeNumber != "" {
			driverInfo += fmt.Sprintf(" (Emp #: %s)", driver.EmployeeNumber)
		}
		if driver.MobilePhone != "" {
			driverInfo += fmt.Sprintf(" · Phone: %s", driver.MobilePhone)
		}
		if driver.PersonalEmail != "" {
			driverInfo += fmt.Sprintf(" · Email: %s", driver.PersonalEmail)
		}
	}

	shiftDesc := req.ShiftType
	if shiftDesc == "" || shiftDesc == "ALL" {
		shiftDesc = "All Shifts"
	} else {
		shiftDesc = fmt.Sprintf("%s Shift", shiftDesc)
	}

	textBody := fmt.Sprintf(`[School Bus Dispatch System - Employee Time-Off Approval Request]

Request ID: %s
Employee: %s
Leave Type: %s
Dates: %s to %s
Shifts Affected: %s
Reason: %s

[Review Options]
1. Reply directly to this email with "Approve" or "Reject";
2. Or click one of the quick action links below:
- Click to Approve: %s
- Click to Reject: %s

The system will automatically record your decision, update the schedule, and notify the driver via email.
`, req.ID, driverInfo, req.LeaveType, req.StartDate, req.EndDate, shiftDesc, req.Comments, approveURL, rejectURL)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
  .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px; }
  .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
  .tag { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 13px; font-weight: 600; background: #e0f2fe; color: #0284c7; margin-top: 8px; }
  .row { display: flex; margin-bottom: 12px; font-size: 14px; }
  .label { width: 110px; font-weight: 600; color: #64748b; }
  .val { color: #0f172a; flex: 1; font-weight: 500; }
  .reason { background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; font-size: 14px; margin: 16px 0; color: #334155; }
  .actions { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; }
  .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; margin: 0 8px; }
  .btn-approve { background: #16a34a; color: #ffffff !important; }
  .btn-reject { background: #dc2626; color: #ffffff !important; }
  .footer { margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">📋 Employee Time-Off Request</div>
      <div class="tag">Request ID: %s</div>
    </div>
    <div class="row"><div class="label">Employee:</div><div class="val">%s</div></div>
    <div class="row"><div class="label">Leave Type:</div><div class="val"><strong>%s</strong></div></div>
    <div class="row"><div class="label">Date Range:</div><div class="val"><strong>%s</strong> to <strong>%s</strong></div></div>
    <div class="row"><div class="label">Shift(s):</div><div class="val">%s</div></div>
    <div class="reason">
      <strong>Reason for Request:</strong><br/>%s
    </div>
    <div class="actions" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
      <a ses:no-track href="%s" class="btn btn-approve" style="display: inline-block; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; margin: 0 8px; background-color: #16a34a; color: #ffffff;">✅ Approve</a>
      <a ses:no-track href="%s" class="btn btn-reject" style="display: inline-block; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; margin: 0 8px; background-color: #dc2626; color: #ffffff;">❌ Reject</a>
    </div>
    <div class="footer">
      💡 Tip: You can also <strong>reply directly to this email</strong> with "Approve" or "Reject". The system will process your response automatically and notify the driver.
    </div>
  </div>
</body>
</html>`, req.ID, driverInfo, req.LeaveType, req.StartDate, req.EndDate, shiftDesc, req.Comments, approveURL, rejectURL)

	return s.SendEmail(recipients, subject, htmlBody, textBody)
}

// SendLeaveDecisionToDriver notifies the driver of the approval or rejection
func (s *EmailService) SendLeaveDecisionToDriver(req *models.TimeOffRequest, driver *models.Employee, decision, reviewerName, notes string) error {
	var recipient string
	if driver != nil {
		if driver.PersonalEmail != "" {
			recipient = driver.PersonalEmail
		} else if driver.PreferredEmail != "" {
			recipient = driver.PreferredEmail
		} else if driver.WorkEmail != "" {
			recipient = driver.WorkEmail
		}
	}
	if recipient == "" && req.RequestedByUserID != "" && strings.Contains(req.RequestedByUserID, "@") {
		recipient = req.RequestedByUserID
	}

	if recipient == "" {
		log.Printf("[EMAIL-WARN] No recipient email found for driver %s (Req: %s)", req.EmployeeName, req.ID)
		return nil
	}

	isApproved := strings.EqualFold(decision, "approved")
	var statusText, subject, alertColor string
	if isApproved {
		statusText = "Approved"
		subject = fmt.Sprintf("[Time-Off Approved] Your request (%s to %s) has been approved", req.StartDate, req.EndDate)
		alertColor = "#16a34a"
	} else {
		statusText = "Rejected"
		subject = fmt.Sprintf("[Time-Off Rejected] Your request (%s to %s) was not approved", req.StartDate, req.EndDate)
		alertColor = "#dc2626"
	}

	textBody := fmt.Sprintf(`Hello %s,

Your time-off request (ID: %s) has been reviewed:

- Decision: %s
- Reviewed By: %s
- Date Range: %s to %s
- Notes: %s

If you have any questions, please contact Dispatch or Human Resources.
`, req.EmployeeName, req.ID, statusText, reviewerName, req.StartDate, req.EndDate, notes)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
  .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
  .status-box { background: %s; color: #ffffff; padding: 12px 18px; border-radius: 8px; font-size: 16px; font-weight: 700; margin: 16px 0; text-align: center; }
  .row { display: flex; margin-bottom: 10px; font-size: 14px; }
  .label { width: 110px; color: #64748b; font-weight: 600; }
  .val { color: #0f172a; flex: 1; font-weight: 500; }
  .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 14px; }
</style>
</head>
<body>
  <div class="card">
    <div class="title">School Bus Dispatch - Time-Off Decision Notice</div>
    <p>Hello <strong>%s</strong>, your time-off request review is complete:</p>
    <div class="status-box">%s</div>
    <div class="row"><div class="label">Request ID:</div><div class="val">%s</div></div>
    <div class="row"><div class="label">Date Range:</div><div class="val">%s to %s</div></div>
    <div class="row"><div class="label">Reviewed By:</div><div class="val">%s</div></div>
    <div class="row"><div class="label">Notes:</div><div class="val">%s</div></div>
    <div class="footer">If you need to make adjustments or have questions, please contact the dispatch office.</div>
  </div>
</body>
</html>`, alertColor, req.EmployeeName, statusText, req.ID, req.StartDate, req.EndDate, reviewerName, notes)

	return s.SendEmail([]string{recipient}, subject, htmlBody, textBody)
}

// SendDriverAck sends an immediate confirmation back to the driver when request is received
func (s *EmailService) SendDriverAck(req *models.TimeOffRequest, recipient string) error {
	if recipient == "" {
		return nil
	}
	subject := fmt.Sprintf("[Request Received %s] Time-off request is awaiting approval", req.ID)
	textBody := fmt.Sprintf(`Hello %s,

We have received your time-off request (ID: %s):
- Dates: %s to %s
- Leave Type: %s
- Reason: %s

This request has been automatically routed to HR (%s) for approval. You will receive an email update as soon as a decision is made.
`, req.EmployeeName, req.ID, req.StartDate, req.EndDate, req.LeaveType, req.Comments, s.cfg.HRNotificationEmail)

	return s.SendEmail([]string{recipient}, subject, "", textBody)
}

// ForwardEmail forwards an incoming email to designated recipients, preserving original sender and subject
func (s *EmailService) ForwardEmail(to []string, originalRecipient, sender, subject, bodyText string) error {
	if len(to) == 0 {
		log.Printf("[EMAIL-FORWARD-WARN] No target recipients specified for mailbox: %s", originalRecipient)
		return nil
	}

	forwardSubject := fmt.Sprintf("[FWD from %s] %s", originalRecipient, subject)
	textBody := fmt.Sprintf(`[Automated Email Forwarding Notice]

- Mailbox: %s
- Original Sender: %s
- Subject: %s
- Forwarded At: %s

──────────────── Message Body ────────────────
%s
`, originalRecipient, sender, subject, time.Now().Format("2006-01-02 15:04:05"), bodyText)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
  .card { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .header { border-bottom: 2px solid #6366f1; padding-bottom: 14px; margin-bottom: 18px; }
  .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; }
  .meta { font-size: 13px; color: #64748b; line-height: 1.8; }
  .content { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; margin-top: 16px; }
  .footer { margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">📨 Automated Email Forwarding</div>
      <div class="meta">
        <div><strong>Forwarded From:</strong> <code>%s</code></div>
        <div><strong>Original Sender:</strong> %s</div>
        <div><strong>Date:</strong> %s</div>
      </div>
    </div>
    <div class="content">%s</div>
    <div class="footer">This message was automatically forwarded by the School Bus Dispatch Mail Gateway</div>
  </div>
</body>
</html>`, originalRecipient, sender, time.Now().Format("2006-01-02 15:04:05"), bodyText)

	return s.SendEmail(to, forwardSubject, htmlBody, textBody)
}
