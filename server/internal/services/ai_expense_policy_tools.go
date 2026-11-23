package services

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"dispatch-server/internal/models"
)

var (
	policyAmountRe = regexp.MustCompile(`(?:\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:\$|dollars?|cad))`)
	policyToNumRe  = regexp.MustCompile(`(?i)(?:to|at|limit|cap|max|à)\s+\$?\s*(\d+(?:\.\d{1,2})?)`)
	policyCountRe  = regexp.MustCompile(`(?i)(\d+)\s*(?:times?|claims?|fois)\s*(?:per|a|par|/)`)
)

// ListExpensePoliciesSummary returns a bilingual summary of all configured expense policies.
func (s *AIToolService) ListExpensePoliciesSummary(ctx context.Context, userRole string, lang string) (string, *models.AIActionCard, error) {
	policies, err := s.dispatchRepo.ListAllExpenseCategories(ctx)
	if err != nil {
		return "", nil, fmt.Errorf("failed to list expense policies: %w", err)
	}
	cfg, err := s.dispatchRepo.GetBiweeklyPayrollConfig(ctx)
	if err != nil || cfg == nil {
		cfg = models.DefaultBiweeklyPayrollConfig()
	}

	isFr := strings.EqualFold(lang, "fr")
	var sb strings.Builder
	if isFr {
		sb.WriteString(fmt.Sprintf("📋 **Politiques de remboursement actives** (Ancre paie aux 2 semaines : `%s`)\n\n", cfg.BiweeklyAnchorDate))
	} else {
		sb.WriteString(fmt.Sprintf("📋 **Expense Reimbursement Policies** (Bi-weekly pay period anchor: `%s`)\n\n", cfg.BiweeklyAnchorDate))
	}

	items := make([]map[string]interface{}, 0, len(policies))
	for _, p := range policies {
		groupUpper := strings.ToUpper(p.ApproverGroup)
		limitText := p.LimitLabel
		if limitText == "" {
			if p.MaxTotalAmount != nil {
				limitText = models.FormatExpenseLimitLabel(p.MaxTotalAmount, p.PeriodType)
			} else if isFr {
				limitText = "Sans plafond fixe"
			} else {
				limitText = "No fixed cap"
			}
		}
		statusBadge := "Active"
		if !p.Active {
			if isFr {
				statusBadge = "Inactif"
			} else {
				statusBadge = "Inactive"
			}
		}
		canEdit := CanManageExpensePolicyGroup(userRole, p.ApproverGroup)
		sb.WriteString(fmt.Sprintf("- **[%s] %s** (`%s`) — %s", groupUpper, p.DisplayName, p.Code, limitText))
		if p.MaxCountPerPeriod != nil && *p.MaxCountPerPeriod > 0 {
			sb.WriteString(fmt.Sprintf(" (max %d/%s)", *p.MaxCountPerPeriod, p.PeriodType))
		}
		if !p.Active {
			sb.WriteString(fmt.Sprintf(" [%s]", statusBadge))
		}
		sb.WriteString("\n")

		items = append(items, map[string]interface{}{
			"code":          p.Code,
			"displayName":   p.DisplayName,
			"approverGroup": p.ApproverGroup,
			"periodType":    p.PeriodType,
			"limitLabel":    limitText,
			"active":        p.Active,
			"canEdit":       canEdit,
		})
	}

	title := "Expense Reimbursement Policies"
	if isFr {
		title = "Politiques de remboursement"
	}
	card := &models.AIActionCard{
		Type:  "expense_policies",
		Title: title,
		Data: map[string]interface{}{
			"biweeklyAnchorDate": cfg.BiweeklyAnchorDate,
			"policies":           items,
		},
	}
	return sb.String(), card, nil
}

// matchExpensePolicyFromMessage finds the best matching policy from a natural language request.
func matchExpensePolicyFromMessage(lowerMsg string, policies []*models.ExpenseCategory) *models.ExpenseCategory {
	// First check exact code or displayName substring matches
	for _, p := range policies {
		if strings.Contains(lowerMsg, strings.ToLower(p.Code)) ||
			strings.Contains(lowerMsg, strings.ToLower(p.DisplayName)) {
			return p
		}
	}
	// Keyword aliases for common short references
	aliases := map[string][]string{
		"bus_washing":           {"bus wash", "washing", "car wash", "lavage"},
		"washer_fluid":          {"washer fluid", "windshield fluid", "lave-glace"},
		"drivers_medical":       {"driver medical", "drivers medical", "medical exam", "medical", "examen médical", "medicale"},
		"road_test":             {"road test", "examen routier", "examen de conduite"},
		"class4_knowledge_test": {"knowledge test", "class 4", "examen théorique"},
		"s_endorsement":         {"s endorsement", "endorsement", "mention s"},
		"other_hr":              {"other hr", "other (hr)"},
		"other_fleet":           {"other fleet", "other (fleet)"},
	}
	for code, keys := range aliases {
		for _, kw := range keys {
			if strings.Contains(lowerMsg, kw) {
				for _, p := range policies {
					if strings.EqualFold(p.Code, code) {
						return p
					}
				}
			}
		}
	}
	return nil
}

func extractPolicyAmount(msg string) *float64 {
	if m := policyAmountRe.FindStringSubmatch(msg); len(m) > 0 {
		raw := m[1]
		if raw == "" {
			raw = m[2]
		}
		if v, err := strconv.ParseFloat(raw, 64); err == nil && v >= 0 {
			r := models.RoundCurrencyHalfUp(v)
			return &r
		}
	}
	if m := policyToNumRe.FindStringSubmatch(msg); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v >= 0 {
			r := models.RoundCurrencyHalfUp(v)
			return &r
		}
	}
	return nil
}

func extractPolicyPeriod(lowerMsg string) string {
	switch {
	case strings.Contains(lowerMsg, "biweekly") || strings.Contains(lowerMsg, "bi-weekly") ||
		strings.Contains(lowerMsg, "two weeks") || strings.Contains(lowerMsg, "2 weeks") ||
		strings.Contains(lowerMsg, "pay period") || strings.Contains(lowerMsg, "aux deux semaines") ||
		strings.Contains(lowerMsg, "deux semaines"):
		return models.ExpensePeriodBiweeklyPayPeriod
	case strings.Contains(lowerMsg, "monthly") || strings.Contains(lowerMsg, "per month") ||
		strings.Contains(lowerMsg, "/month") || strings.Contains(lowerMsg, "par mois") ||
		strings.Contains(lowerMsg, "mensuel"):
		return models.ExpensePeriodMonthly
	case strings.Contains(lowerMsg, "yearly") || strings.Contains(lowerMsg, "annual") ||
		strings.Contains(lowerMsg, "per year") || strings.Contains(lowerMsg, "/year") ||
		strings.Contains(lowerMsg, "par an") || strings.Contains(lowerMsg, "annuel"):
		return models.ExpensePeriodYearly
	case strings.Contains(lowerMsg, "one-time") || strings.Contains(lowerMsg, "one time") ||
		strings.Contains(lowerMsg, "lifetime") || strings.Contains(lowerMsg, "une seule fois"):
		return models.ExpensePeriodOneTime
	case strings.Contains(lowerMsg, "per claim") || strings.Contains(lowerMsg, "par demande"):
		return models.ExpensePeriodPerClaim
	default:
		return ""
	}
}

// ParseAndPrepareExpensePolicyChange parses an HR/Fleet policy update instruction, enforces
// strict group-level RBAC, and stages a PendingDispatchAction requiring explicit confirmation.
func (s *AIToolService) ParseAndPrepareExpensePolicyChange(
	ctx context.Context,
	message string,
	operatorName string,
	userRole string,
	lang string,
) (*models.PendingDispatchAction, string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	lowerMsg := strings.ToLower(strings.TrimSpace(message))

	policies, err := s.dispatchRepo.ListAllExpenseCategories(ctx)
	if err != nil {
		return nil, "", nil, fmt.Errorf("failed to load expense policies: %w", err)
	}

	target := matchExpensePolicyFromMessage(lowerMsg, policies)
	if target == nil {
		if isFr {
			return nil, "Je n'ai pas identifié quelle politique modifier. Précisez par exemple **Bus Washing**, **Washer Fluid**, **Drivers Medical**, **Road Test**, **Class 4 Knowledge Test** ou **S Endorsement**.", nil, nil
		}
		return nil, "I could not identify which expense policy to update. Please specify a category such as **Bus Washing**, **Washer Fluid**, **Drivers Medical**, **Road Test**, **Class 4 Knowledge Test**, or **S Endorsement**.", nil, nil
	}

	// Strict group-level isolation check
	if !CanManageExpensePolicyGroup(userRole, target.ApproverGroup) {
		return nil, BuildExpensePolicyAccessDeniedMessage(userRole, target.ApproverGroup, lang), nil, nil
	}

	before := *target
	after := *target
	after.Version = target.Version + 1
	actionKind := "update"
	changedFields := make([]string, 0)

	if strings.Contains(lowerMsg, "deactivate") || strings.Contains(lowerMsg, "disable") || strings.Contains(lowerMsg, "désactiver") {
		after.Active = false
		actionKind = "deactivate"
		changedFields = append(changedFields, "Active: true -> false")
	} else if strings.Contains(lowerMsg, "activate") || strings.Contains(lowerMsg, "enable") || strings.Contains(lowerMsg, "activer") {
		after.Active = true
		changedFields = append(changedFields, "Active: false -> true")
	}

	if amt := extractPolicyAmount(message); amt != nil {
		oldStr := "None"
		if before.MaxTotalAmount != nil {
			oldStr = fmt.Sprintf("$%.2f", *before.MaxTotalAmount)
		}
		after.MaxTotalAmount = amt
		changedFields = append(changedFields, fmt.Sprintf("Max Total Amount: %s -> $%.2f", oldStr, *amt))
	}

	if period := extractPolicyPeriod(lowerMsg); period != "" && period != before.PeriodType {
		after.PeriodType = period
		changedFields = append(changedFields, fmt.Sprintf("Period: %s -> %s", before.PeriodType, period))
	}

	if m := policyCountRe.FindStringSubmatch(message); len(m) > 1 {
		if cnt, err := strconv.Atoi(m[1]); err == nil && cnt >= 1 {
			oldCnt := "Unlimited"
			if before.MaxCountPerPeriod != nil {
				oldCnt = fmt.Sprintf("%d", *before.MaxCountPerPeriod)
			}
			after.MaxCountPerPeriod = &cnt
			changedFields = append(changedFields, fmt.Sprintf("Max Count/Period: %s -> %d", oldCnt, cnt))
		}
	}

	if len(changedFields) == 0 {
		if isFr {
			return nil, fmt.Sprintf("Aucun changement détecté pour **%s**. Précisez un nouveau montant (ex: `25$`), une période (ex: `par mois`, `aux deux semaines`, `par an`) ou `désactiver`.", target.DisplayName), nil, nil
		}
		return nil, fmt.Sprintf("No policy change was detected for **%s**. Please specify a new amount (e.g. `$25`), period (e.g. `bi-weekly`, `monthly`, `yearly`), max count, or `deactivate`.", target.DisplayName), nil, nil
	}

	after.LimitLabel = models.FormatExpenseLimitLabel(after.MaxTotalAmount, after.PeriodType)
	if operatorName != "" {
		after.UpdatedBy = operatorName
	}

	actionID := fmt.Sprintf("act_policy_%d", time.Now().UTC().UnixNano())
	pending := &models.PendingDispatchAction{
		ID:                  actionID,
		ActionType:          "UPDATE_EXPENSE_POLICY",
		ExpensePolicyBefore: &before,
		ExpensePolicyAfter:  &after,
		PolicyChangeReason:  strings.TrimSpace(message),
		PolicyAction:        actionKind,
		CreatedBy:           operatorName,
		CreatedByRole:       userRole,
		CreatedAt:           time.Now().UTC(),
	}

	s.mu.Lock()
	s.pendingActions[actionID] = pending
	s.mu.Unlock()

	var summary string
	var cardTitle string
	if isFr {
		cardTitle = fmt.Sprintf("Confirmation modification politique : %s", after.DisplayName)
		summary = fmt.Sprintf(
			"📝 **Proposition de modification de politique (%s — groupe %s)**\n\n- %s\n- **Libellé affiché** : `%s` → `%s`\n\nVeuillez cliquer sur **Confirmer** pour appliquer et journaliser ce changement.",
			after.DisplayName,
			strings.ToUpper(after.ApproverGroup),
			strings.Join(changedFields, "\n- "),
			before.LimitLabel,
			after.LimitLabel,
		)
	} else {
		cardTitle = fmt.Sprintf("Confirm Policy Change: %s", after.DisplayName)
		summary = fmt.Sprintf(
			"📝 **Proposed Expense Policy Change (%s — %s Group)**\n\n- %s\n- **Display Label**: `%s` → `%s`\n\nPlease click **Confirm** to publish this policy update and record it in the audit log.",
			after.DisplayName,
			strings.ToUpper(after.ApproverGroup),
			strings.Join(changedFields, "\n- "),
			before.LimitLabel,
			after.LimitLabel,
		)
	}

	card := &models.AIActionCard{
		Type:        "confirm_action",
		Title:       cardTitle,
		ActionID:    actionID,
		RequiresAck: true,
		Data: map[string]interface{}{
			"actionType":    "UPDATE_EXPENSE_POLICY",
			"categoryCode":  after.Code,
			"displayName":   after.DisplayName,
			"approverGroup": after.ApproverGroup,
			"changes":       changedFields,
			"before":        before,
			"after":         after,
		},
	}

	return pending, summary, card, nil
}
