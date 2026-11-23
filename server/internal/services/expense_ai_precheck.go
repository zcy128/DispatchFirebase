package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"dispatch-server/internal/models"
)

// RunExpenseClaimAIPreCheck evaluates soft policy guidance and receipt attachments for an expense claim.
// It uses Gemini multimodal inspection when GEMINI_API_KEY is configured and falls back to the
// deterministic built-in pre-check engine when offline or unconfigured.
func RunExpenseClaimAIPreCheck(
	ctx context.Context,
	claim *models.ExpenseReimbursement,
	eval *models.ExpenseClaimEvaluation,
	categories []*models.ExpenseCategory,
) (*models.ExpenseAIPreCheckResult, error) {
	if claim == nil {
		return nil, fmt.Errorf("claim is required")
	}

	policyByCode := make(map[string]*models.ExpenseCategory, len(categories))
	for _, cat := range categories {
		if cat != nil {
			policyByCode[strings.ToLower(strings.TrimSpace(cat.Code))] = cat
		}
	}

	attCount := len(claim.AttachmentURLs)
	findings := make([]models.ExpenseAIPreCheckFinding, 0, len(claim.Lines))
	overallStatus := "pass"

	for _, line := range claim.Lines {
		code := strings.ToLower(strings.TrimSpace(line.CategoryCode))
		pol := policyByCode[code]

		finding := models.ExpenseAIPreCheckFinding{
			LineID:              line.ID,
			CategoryCode:        line.CategoryCode,
			CategoryDisplayName: line.CategoryDisplayName,
			Status:              "pass",
			ReceiptVerified:     attCount > 0,
		}

		reqAtt := false
		guidance := ""
		if pol != nil {
			reqAtt = pol.RequireAttachment
			guidance = strings.TrimSpace(pol.AIReviewGuidance)
			finding.GuidanceChecked = guidance
		}

		switch {
		case reqAtt && attCount == 0:
			finding.Status = "missing_proof"
			finding.ReceiptVerified = false
			finding.Summary = "Policy requires a receipt or completion proof attachment, but 0 files are attached."
			overallStatus = "missing_proof"
		case guidance != "" && attCount > 0:
			finding.Status = "attention"
			finding.Summary = fmt.Sprintf(
				"%d attachment(s) present. Soft-rule check required: %s (Claimed $%.2f on %s).",
				attCount, guidance, models.RoundCurrencyHalfUp(line.Amount), claim.ClaimDate,
			)
			if overallStatus == "pass" {
				overallStatus = "attention"
			}
		case attCount > 0:
			finding.Status = "pass"
			finding.Summary = fmt.Sprintf(
				"Receipt attachment present (%d file(s)) for $%.2f.",
				attCount, models.RoundCurrencyHalfUp(line.Amount),
			)
		default:
			finding.Status = "pass"
			finding.Summary = "No attachment required for this category."
		}

		findings = append(findings, finding)
	}

	result := &models.ExpenseAIPreCheckResult{
		ClaimID:         claim.ID,
		Status:          overallStatus,
		Engine:          "builtin",
		AttachmentCount: attCount,
		Findings:        findings,
		CheckedAt:       time.Now().UTC().Format(time.RFC3339),
	}

	switch overallStatus {
	case "missing_proof":
		result.Summary = "Missing required receipt or completion proof attachment."
	case "attention":
		result.Summary = fmt.Sprintf(
			"Attachments found (%d). Please verify completion proof / soft-rule requirements highlighted below.",
			attCount,
		)
	default:
		if eval != nil && eval.Status == models.ExpenseEvalViolation {
			result.Status = "attention"
			result.Summary = "Attachments verified, but cumulative amount/count exceeds policy limit."
		} else {
			result.Summary = fmt.Sprintf(
				"All %d line item(s) and attachment requirements passed pre-check.",
				len(claim.Lines),
			)
		}
	}

	// Optional multimodal Gemini enrichment if GEMINI_API_KEY is available
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey != "" && attCount > 0 {
		if geminiSummary, ok := tryGeminiMultimodalReceiptPreCheck(ctx, apiKey, claim, findings); ok && geminiSummary != "" {
			result.Engine = "gemini"
			result.Summary = geminiSummary
		}
	}

	return result, nil
}

func tryGeminiMultimodalReceiptPreCheck(
	ctx context.Context,
	apiKey string,
	claim *models.ExpenseReimbursement,
	findings []models.ExpenseAIPreCheckFinding,
) (string, bool) {
	reqCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()

	var promptBuilder strings.Builder
	promptBuilder.WriteString(fmt.Sprintf(
		"You are an HR & Fleet Expense Audit Assistant. Review this driver expense claim (Date: %s, Total: $%.2f) against the attached receipt(s) and soft policy rules:\n",
		claim.ClaimDate, models.RoundCurrencyHalfUp(claim.TotalAmount),
	))
	for _, f := range findings {
		promptBuilder.WriteString(fmt.Sprintf("- Category: %s (%s)", f.CategoryDisplayName, f.CategoryCode))
		if f.GuidanceChecked != "" {
			promptBuilder.WriteString(fmt.Sprintf(" | Soft Rule: %s", f.GuidanceChecked))
		}
		promptBuilder.WriteString("\n")
	}
	promptBuilder.WriteString("In 1-2 concise sentences in English, state whether the receipt amount/date matches and whether any soft rule (such as proof of passing a test) is satisfied or needs manual HR verification.")

	parts := []map[string]interface{}{
		{"text": promptBuilder.String()},
	}

	// Attempt to load first local attachment if stored under server/uploads or uploads
	if len(claim.AttachmentURLs) > 0 {
		if b64, mimeType, ok := loadLocalAttachmentBase64(claim.AttachmentURLs[0]); ok {
			parts = append(parts, map[string]interface{}{
				"inlineData": map[string]interface{}{
					"mimeType": mimeType,
					"data":     b64,
				},
			})
		}
	}

	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{"parts": parts},
		},
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", false
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", apiKey)
	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", false
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", false
	}

	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", false
	}
	if len(parsed.Candidates) > 0 && len(parsed.Candidates[0].Content.Parts) > 0 {
		txt := strings.TrimSpace(parsed.Candidates[0].Content.Parts[0].Text)
		if txt != "" {
			return txt, true
		}
	}
	return "", false
}

func loadLocalAttachmentBase64(rawURL string) (string, string, bool) {
	clean := strings.TrimSpace(rawURL)
	if clean == "" {
		return "", "", false
	}
	base := filepath.Base(clean)
	if base == "" || base == "." || base == "/" {
		return "", "", false
	}
	candidates := []string{
		filepath.Join("uploads", base),
		filepath.Join("internal", "handlers", "uploads", base),
		filepath.Join("..", "uploads", base),
	}
	for _, p := range candidates {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		data, err := io.ReadAll(io.LimitReader(f, 4*1024*1024))
		_ = f.Close()
		if err != nil || len(data) == 0 {
			continue
		}
		mimeType := "image/jpeg"
		if strings.HasSuffix(strings.ToLower(base), ".png") {
			mimeType = "image/png"
		}
		return base64.StdEncoding.EncodeToString(data), mimeType, true
	}
	return "", "", false
}
