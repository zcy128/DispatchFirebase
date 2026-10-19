package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

type SNSWebhookHandler struct {
	cfg                 *config.Config
	inboundEmailService *services.InboundEmailService
	emailService        *services.EmailService
	dispatchRepo        repository.DispatchRepository
	empRepo             repository.EmployeeRepository
}

func NewSNSWebhookHandler(
	cfg *config.Config,
	inboundEmailService *services.InboundEmailService,
	emailService *services.EmailService,
	dispatchRepo repository.DispatchRepository,
	empRepo repository.EmployeeRepository,
) *SNSWebhookHandler {
	return &SNSWebhookHandler{
		cfg:                 cfg,
		inboundEmailService: inboundEmailService,
		emailService:        emailService,
		dispatchRepo:        dispatchRepo,
		empRepo:             empRepo,
	}
}

// HandleSNSInboundEmail processes incoming POST webhook notifications from Amazon SNS
func (h *SNSWebhookHandler) HandleSNSInboundEmail(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read request body"}`, http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	res, err := h.inboundEmailService.ProcessSNSWebhook(r.Context(), body)
	if err != nil {
		log.Printf("[SNS-WEBHOOK-ERROR] Error processing webhook: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ok","result":"%s"}`, res)
}

// HandleQuickAction handles one-click browser links sent in HR emails
func (h *SNSWebhookHandler) HandleQuickAction(w http.ResponseWriter, r *http.Request) {
	reqID := r.URL.Query().Get("id")
	action := strings.ToLower(r.URL.Query().Get("action"))
	expStr := r.URL.Query().Get("exp")
	token := r.URL.Query().Get("token")

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || reqID == "" || (action != "approve" && action != "reject") {
		w.WriteHeader(http.StatusBadRequest)
		h.renderHTMLResult(w, false, "Invalid Approval Request", "Missing required parameters or malformed request format.")
		return
	}

	// Verify cryptographic HMAC token
	if !h.emailService.VerifyActionToken(reqID, action, exp, token) {
		w.WriteHeader(http.StatusForbidden)
		h.renderHTMLResult(w, false, "Invalid or Expired Link", "This quick action link has expired or is invalid. Please review directly in the Dispatch portal.")
		return
	}

	reviewPayload := &models.ReviewTimeOffRequestPayload{
		ReviewerUserID: "HR_EMAIL_QUICK_ACTION",
		ReviewerName:   "HR Office (Quick Action)",
		ApprovalNotes:  "Processed via email 1-click quick action",
	}

	var updated *models.TimeOffRequest
	var actionText string
	if action == "approve" {
		updated, err = h.dispatchRepo.ApproveTimeOffRequest(r.Context(), reqID, reviewPayload)
		actionText = "Approved"
	} else {
		updated, err = h.dispatchRepo.RejectTimeOffRequest(r.Context(), reqID, reviewPayload)
		actionText = "Rejected"
	}

	if err != nil {
		log.Printf("[QUICK-ACTION-ERROR] Failed to update time-off %s: %v", reqID, err)
		w.WriteHeader(http.StatusInternalServerError)
		h.renderHTMLResult(w, false, "Action Failed", err.Error())
		return
	}

	// Notify driver
	var driver *models.Employee
	if updated.EmployeeID != "" && updated.EmployeeID != "EMP-UNKNOWN" {
		driver, _ = h.empRepo.GetByID(r.Context(), updated.EmployeeID)
	}
	_ = h.emailService.SendLeaveDecisionToDriver(updated, driver, action, "HR Department", "Processed via email 1-click quick action")

	msg := fmt.Sprintf("Request <strong>%s</strong> has been marked as <strong>%s</strong>.<br/>The system has updated the database and notified <strong>%s</strong> via email.",
		reqID, actionText, updated.EmployeeName)
	h.renderHTMLResult(w, true, "Review Action Completed", msg)
}

func (h *SNSWebhookHandler) renderHTMLResult(w http.ResponseWriter, success bool, title, message string) {
	bgColor := "#16a34a"
	icon := "✅"
	if !success {
		bgColor = "#dc2626"
		icon = "❌"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s - School Bus Dispatch</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
  .card { max-width: 520px; width: 100%%; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); padding: 36px 28px; text-align: center; }
  .badge { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%%; background: %s; color: #fff; font-size: 32px; margin-bottom: 20px; }
  .title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; }
  .desc { font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; }
  .btn { display: inline-block; padding: 10px 20px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">%s</div>
    <div class="title">%s</div>
    <div class="desc">%s</div>
    <div><a href="/" class="btn">Return to Dispatch Portal</a></div>
  </div>
</body>
</html>`, title, bgColor, icon, title, message)

	fmt.Fprint(w, html)
}
