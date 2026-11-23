package services

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"dispatch-server/internal/models"
)

func parseISODateUTC(dateStr string) (time.Time, error) {
	trimmed := strings.TrimSpace(dateStr)
	if len(trimmed) >= 10 {
		trimmed = trimmed[:10]
	}
	t, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date %q: %w", dateStr, err)
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), nil
}

// ResolveBiweeklyPayPeriod calculates the fixed bi-weekly pay period [start, end] (inclusive)
// containing dateStr, anchored to anchorStr.
func ResolveBiweeklyPayPeriod(dateStr, anchorStr string, periodLengthDays int) (string, string, error) {
	if periodLengthDays <= 0 {
		periodLengthDays = 14
	}
	target, err := parseISODateUTC(dateStr)
	if err != nil {
		return "", "", err
	}
	anchor, err := parseISODateUTC(anchorStr)
	if err != nil {
		return "", "", err
	}

	diffDays := int(target.Sub(anchor).Hours() / 24)
	// Floor division for negative diffDays as well
	periodIndex := diffDays / periodLengthDays
	if diffDays < 0 && diffDays%periodLengthDays != 0 {
		periodIndex--
	}

	start := anchor.AddDate(0, 0, periodIndex*periodLengthDays)
	end := start.AddDate(0, 0, periodLengthDays-1)
	return start.Format("2006-01-02"), end.Format("2006-01-02"), nil
}

// ResolveExpensePeriodWindow resolves the [windowStart, windowEnd] inclusive YYYY-MM-DD bounds
// for the given periodType and claimDate.
func ResolveExpensePeriodWindow(periodType, claimDate string, cfg *models.BiweeklyPayrollConfig) (string, string, error) {
	pt := strings.ToLower(strings.TrimSpace(periodType))
	if pt == "" || pt == models.ExpensePeriodPerClaim {
		return "", "", nil
	}
	if pt == models.ExpensePeriodOneTime {
		return "0001-01-01", "9999-12-31", nil
	}

	target, err := parseISODateUTC(claimDate)
	if err != nil {
		return "", "", err
	}

	switch pt {
	case models.ExpensePeriodBiweeklyPayPeriod:
		if cfg == nil {
			cfg = models.DefaultBiweeklyPayrollConfig()
		}
		anchor := strings.TrimSpace(cfg.BiweeklyAnchorDate)
		if anchor == "" {
			anchor = models.DefaultBiweeklyPayrollConfig().BiweeklyAnchorDate
		}
		return ResolveBiweeklyPayPeriod(claimDate, anchor, cfg.PeriodLengthDays)
	case models.ExpensePeriodMonthly:
		start := time.Date(target.Year(), target.Month(), 1, 0, 0, 0, 0, time.UTC)
		end := start.AddDate(0, 1, -1)
		return start.Format("2006-01-02"), end.Format("2006-01-02"), nil
	case models.ExpensePeriodYearly:
		start := time.Date(target.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		end := time.Date(target.Year(), 12, 31, 0, 0, 0, 0, time.UTC)
		return start.Format("2006-01-02"), end.Format("2006-01-02"), nil
	default:
		return "", "", nil
	}
}

func dateInWindow(dateStr, windowStart, windowEnd string) bool {
	if windowStart == "" || windowEnd == "" {
		return false
	}
	d := strings.TrimSpace(dateStr)
	if len(d) >= 10 {
		d = d[:10]
	}
	return d >= windowStart && d <= windowEnd
}

// EvaluateExpenseClaim deterministically evaluates a claim against configured expense policies
// and the employee's historical claims.
func EvaluateExpenseClaim(
	claim *models.ExpenseReimbursement,
	employeeClaims []*models.ExpenseReimbursement,
	categories []*models.ExpenseCategory,
	cfg *models.BiweeklyPayrollConfig,
) *models.ExpenseClaimEvaluation {
	if cfg == nil {
		cfg = models.DefaultBiweeklyPayrollConfig()
	}
	result := &models.ExpenseClaimEvaluation{
		ClaimID:            claim.ID,
		EmployeeID:         claim.EmployeeID,
		ClaimDate:          claim.ClaimDate,
		Status:             models.ExpenseEvalPass,
		RequiresOverride:   false,
		ApproverGroups:     []string{},
		BiweeklyAnchorDate: cfg.BiweeklyAnchorDate,
		Lines:              make([]models.ExpenseLineEvaluation, 0, len(claim.Lines)),
	}

	policyByCode := make(map[string]*models.ExpenseCategory, len(categories))
	for _, cat := range categories {
		if cat == nil {
			continue
		}
		code := strings.ToLower(strings.TrimSpace(cat.Code))
		if code != "" {
			policyByCode[code] = cat
		}
	}

	// Track same-claim cumulative amounts per categoryCode so multiple lines of the same
	// category within one claim are properly aggregated.
	sameClaimAmountByCode := make(map[string]float64)
	sameClaimCountByCode := make(map[string]int)
	for _, line := range claim.Lines {
		code := strings.ToLower(strings.TrimSpace(line.CategoryCode))
		sameClaimAmountByCode[code] = models.RoundCurrencyHalfUp(sameClaimAmountByCode[code] + line.Amount)
		sameClaimCountByCode[code]++
	}

	groupSet := make(map[string]bool)

	for _, line := range claim.Lines {
		code := strings.ToLower(strings.TrimSpace(line.CategoryCode))
		policy := policyByCode[code]

		lineEval := models.ExpenseLineEvaluation{
			LineID:              line.ID,
			CategoryCode:        line.CategoryCode,
			CategoryDisplayName: line.CategoryDisplayName,
			CurrentAmount:       models.RoundCurrencyHalfUp(line.Amount),
			Status:              models.ExpenseEvalPass,
		}

		if policy == nil {
			lineEval.IsLegacyCategory = true
			lineEval.ApproverGroup = models.ExpenseApproverGroupHR
			lineEval.PeriodType = models.ExpensePeriodPerClaim
			lineEval.ProjectedApproved = lineEval.CurrentAmount
			lineEval.ProjectedWithPending = lineEval.CurrentAmount
			groupSet[lineEval.ApproverGroup] = true
			result.Lines = append(result.Lines, lineEval)
			continue
		}

		group := strings.ToLower(strings.TrimSpace(policy.ApproverGroup))
		if group == "" {
			group = models.ExpenseApproverGroupHR
		}
		periodType := strings.ToLower(strings.TrimSpace(policy.PeriodType))
		if periodType == "" {
			periodType = models.ExpensePeriodPerClaim
		}

		lineEval.ApproverGroup = group
		lineEval.PeriodType = periodType
		lineEval.MaxTotalAmount = policy.MaxTotalAmount
		lineEval.MaxCountPerPeriod = policy.MaxCountPerPeriod
		lineEval.AIReviewGuidance = policy.AIReviewGuidance
		groupSet[group] = true

		windowStart, windowEnd, err := ResolveExpensePeriodWindow(periodType, claim.ClaimDate, cfg)
		if err == nil {
			lineEval.WindowStart = windowStart
			lineEval.WindowEnd = windowEnd
		}

		var approvedAmt float64
		var pendingAmt float64
		var approvedCnt int
		var pendingCnt int

		if periodType != models.ExpensePeriodPerClaim && windowStart != "" && windowEnd != "" {
			for _, hist := range employeeClaims {
				if hist == nil || hist.ID == claim.ID {
					continue
				}
				if hist.EmployeeID != claim.EmployeeID {
					continue
				}
				st := strings.ToLower(strings.TrimSpace(hist.Status))
				if st != "approved" && st != "pre_approved" && st != "pending" {
					continue
				}
				if !dateInWindow(hist.ClaimDate, windowStart, windowEnd) {
					continue
				}
				var matchedAmt float64
				var matched bool
				for _, hl := range hist.Lines {
					if strings.EqualFold(strings.TrimSpace(hl.CategoryCode), code) {
						matchedAmt = models.RoundCurrencyHalfUp(matchedAmt + hl.Amount)
						matched = true
					}
				}
				if matched {
					if st == "approved" || st == "pre_approved" {
						approvedAmt = models.RoundCurrencyHalfUp(approvedAmt + matchedAmt)
						approvedCnt++
					} else {
						pendingAmt = models.RoundCurrencyHalfUp(pendingAmt + matchedAmt)
						pendingCnt++
					}
				}
			}
		}

		// Use total for this category within the current claim for cap checks
		currentClaimCatAmt := sameClaimAmountByCode[code]
		projectedApproved := models.RoundCurrencyHalfUp(approvedAmt + currentClaimCatAmt)
		projectedWithPending := models.RoundCurrencyHalfUp(approvedAmt + pendingAmt + currentClaimCatAmt)

		lineEval.ApprovedAmount = approvedAmt
		lineEval.PendingAmount = pendingAmt
		lineEval.ProjectedApproved = projectedApproved
		lineEval.ProjectedWithPending = projectedWithPending
		lineEval.ApprovedCount = approvedCnt
		lineEval.PendingCount = pendingCnt

		if policy.MaxTotalAmount != nil {
			capVal := models.RoundCurrencyHalfUp(*policy.MaxTotalAmount)
			rem := models.RoundCurrencyHalfUp(capVal - approvedAmt)
			if rem < 0 {
				rem = 0
			}
			lineEval.RemainingAmount = &rem

			if projectedApproved > capVal {
				excess := models.RoundCurrencyHalfUp(projectedApproved - capVal)
				lineEval.Status = models.ExpenseEvalViolation
				lineEval.Reasons = append(lineEval.Reasons, fmt.Sprintf(
					"Projected total $%.2f exceeds $%.2f %s limit by $%.2f (approved so far: $%.2f).",
					projectedApproved, capVal, periodDisplayLabel(periodType), excess, approvedAmt,
				))
			} else if pendingAmt > 0 && projectedWithPending > capVal {
				if lineEval.Status == models.ExpenseEvalPass {
					lineEval.Status = models.ExpenseEvalWarning
				}
				lineEval.Reasons = append(lineEval.Reasons, fmt.Sprintf(
					"Including $%.2f in other pending claims brings total to $%.2f, exceeding $%.2f %s limit.",
					pendingAmt, projectedWithPending, capVal, periodDisplayLabel(periodType),
				))
			}
		}

		if policy.MaxCountPerPeriod != nil && *policy.MaxCountPerPeriod > 0 {
			maxCnt := *policy.MaxCountPerPeriod
			if approvedCnt+1 > maxCnt {
				lineEval.Status = models.ExpenseEvalViolation
				lineEval.Reasons = append(lineEval.Reasons, fmt.Sprintf(
					"Claim count (%d approved + 1 current) exceeds maximum %d per %s.",
					approvedCnt, maxCnt, periodDisplayLabel(periodType),
				))
			} else if pendingCnt > 0 && approvedCnt+pendingCnt+1 > maxCnt {
				if lineEval.Status == models.ExpenseEvalPass {
					lineEval.Status = models.ExpenseEvalWarning
				}
				lineEval.Reasons = append(lineEval.Reasons, fmt.Sprintf(
					"Including %d other pending claim(s) would exceed maximum %d per %s.",
					pendingCnt, maxCnt, periodDisplayLabel(periodType),
				))
			}
		}

		if policy.RequireAttachment && len(claim.AttachmentURLs) == 0 {
			lineEval.Status = models.ExpenseEvalViolation
			lineEval.Reasons = append(lineEval.Reasons, "Required receipt/proof attachment is missing.")
		}

		if lineEval.Status == models.ExpenseEvalViolation {
			result.Status = models.ExpenseEvalViolation
			result.RequiresOverride = true
		} else if lineEval.Status == models.ExpenseEvalWarning && result.Status == models.ExpenseEvalPass {
			result.Status = models.ExpenseEvalWarning
		}

		result.Lines = append(result.Lines, lineEval)
	}

	for g := range groupSet {
		result.ApproverGroups = append(result.ApproverGroups, g)
	}
	sort.Strings(result.ApproverGroups)

	return result
}

// ValidateSingleCategoryClaim checks that all lines in a claim share a single expense category.
func ValidateSingleCategoryClaim(lines []models.ExpenseReimbursementLinePayload) (string, error) {
	if len(lines) == 0 {
		return "", fmt.Errorf("at least one expense line is required")
	}
	firstCode := strings.ToLower(strings.TrimSpace(lines[0].CategoryCode))
	if firstCode == "" {
		return "", fmt.Errorf("each expense line needs a categoryCode")
	}
	for i := 1; i < len(lines); i++ {
		code := strings.ToLower(strings.TrimSpace(lines[i].CategoryCode))
		if code != firstCode {
			return "", fmt.Errorf("only one expense category is allowed per claim (found %q and %q); please submit a separate claim for other categories", firstCode, code)
		}
	}
	return firstCode, nil
}

// ShouldAutoPreApproveClaim determines whether a newly submitted single-category claim qualifies
// for Option A automatic pre-approval with a configurable calendar-day SLA (default 5 days) from submission time.
func ShouldAutoPreApproveClaim(
	claim *models.ExpenseReimbursement,
	eval *models.ExpenseClaimEvaluation,
	categories []*models.ExpenseCategory,
	submittedAt time.Time,
	autoApproveDays int,
) (bool, *time.Time, string) {
	if claim == nil || eval == nil || len(claim.Lines) == 0 {
		return false, nil, ""
	}
	if autoApproveDays <= 0 {
		autoApproveDays = 5
	}
	if eval.Status != models.ExpenseEvalPass {
		return false, nil, ""
	}
	firstCode := strings.ToLower(strings.TrimSpace(claim.Lines[0].CategoryCode))
	var matchedPolicy *models.ExpenseCategory
	for _, cat := range categories {
		if cat != nil && strings.EqualFold(strings.TrimSpace(cat.Code), firstCode) {
			matchedPolicy = cat
			break
		}
	}
	if matchedPolicy == nil || !matchedPolicy.Active || !matchedPolicy.AutoPreApprove {
		return false, nil, ""
	}
	if matchedPolicy.RequireAttachment && len(claim.AttachmentURLs) == 0 {
		return false, nil, ""
	}
	for _, l := range claim.Lines {
		if !strings.EqualFold(strings.TrimSpace(l.CategoryCode), firstCode) {
			return false, nil, ""
		}
	}
	deadline := submittedAt.UTC().Add(time.Duration(autoApproveDays) * 24 * time.Hour)
	return true, &deadline, fmt.Sprintf(
		"Auto pre-approved by policy (%s). Scheduled for final release to Finance on %s (%d-day SLA) if no manual intervention.",
		matchedPolicy.DisplayName,
		deadline.Format("2006-01-02 15:04 UTC"),
		autoApproveDays,
	)
}

func periodDisplayLabel(periodType string) string {
	switch periodType {
	case models.ExpensePeriodBiweeklyPayPeriod:
		return "bi-weekly pay period"
	case models.ExpensePeriodMonthly:
		return "monthly"
	case models.ExpensePeriodYearly:
		return "yearly"
	case models.ExpensePeriodOneTime:
		return "one-time"
	default:
		return "per-claim"
	}
}
