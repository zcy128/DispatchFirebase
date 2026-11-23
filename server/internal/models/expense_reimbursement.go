package models

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// ExpenseApproverGroup values
const (
	ExpenseApproverGroupHR    = "hr"
	ExpenseApproverGroupFleet = "fleet"
)

// ExpensePeriodType values
const (
	ExpensePeriodPerClaim          = "per_claim"
	ExpensePeriodOneTime           = "one_time"
	ExpensePeriodBiweeklyPayPeriod = "biweekly_pay_period"
	ExpensePeriodMonthly           = "monthly"
	ExpensePeriodYearly            = "yearly"
)

// ExpenseEvaluationStatus values
const (
	ExpenseEvalPass      = "pass"
	ExpenseEvalWarning   = "warning"
	ExpenseEvalViolation = "violation"
)

// RoundCurrencyHalfUp rounds a monetary amount to 2 decimal places using half-up rounding.
func RoundCurrencyHalfUp(val float64) float64 {
	if math.IsNaN(val) || math.IsInf(val, 0) {
		return 0
	}
	if val < 0 {
		return -math.Floor(-val*100+0.5) / 100
	}
	return math.Floor(val*100+0.5) / 100
}

// FormatExpenseLimitLabel builds a human-readable limit label from policy fields.
func FormatExpenseLimitLabel(maxTotalAmount *float64, periodType string) string {
	if maxTotalAmount == nil || *maxTotalAmount <= 0 {
		return ""
	}
	amt := RoundCurrencyHalfUp(*maxTotalAmount)
	switch strings.ToLower(strings.TrimSpace(periodType)) {
	case ExpensePeriodBiweeklyPayPeriod:
		return fmt.Sprintf("Up to $%.2f / pay period", amt)
	case ExpensePeriodMonthly:
		return fmt.Sprintf("Up to $%.2f / month", amt)
	case ExpensePeriodYearly:
		return fmt.Sprintf("Up to $%.2f / year", amt)
	case ExpensePeriodOneTime:
		return fmt.Sprintf("Up to $%.2f (one-time)", amt)
	default:
		return fmt.Sprintf("Up to $%.2f", amt)
	}
}

// ExpenseCategory defines an expense categorization and reimbursement policy for drivers.
type ExpenseCategory struct {
	ID                string    `json:"id" firestore:"id"`
	Code              string    `json:"code" firestore:"code"`
	DisplayName       string    `json:"displayName" firestore:"displayName"`
	LimitLabel        string    `json:"limitLabel,omitempty" firestore:"limitLabel,omitempty"`
	ApproverGroup     string    `json:"approverGroup,omitempty" firestore:"approverGroup,omitempty"`         // "hr" | "fleet"
	PeriodType        string    `json:"periodType,omitempty" firestore:"periodType,omitempty"`               // "per_claim" | "one_time" | "biweekly_pay_period" | "monthly" | "yearly"
	MaxTotalAmount    *float64  `json:"maxTotalAmount,omitempty" firestore:"maxTotalAmount,omitempty"`       // Cumulative cap per employee per period (nil = no cap)
	MaxCountPerPeriod *int      `json:"maxCountPerPeriod,omitempty" firestore:"maxCountPerPeriod,omitempty"` // Optional count cap per period (nil = unlimited count within amount cap)
	RequireAttachment bool      `json:"requireAttachment,omitempty" firestore:"requireAttachment,omitempty"`
	AutoPreApprove    bool      `json:"autoPreApprove,omitempty" firestore:"autoPreApprove,omitempty"`
	AIReviewGuidance  string    `json:"aiReviewGuidance,omitempty" firestore:"aiReviewGuidance,omitempty"`
	SortOrder         int       `json:"sortOrder" firestore:"sortOrder"`
	Active            bool      `json:"active" firestore:"active"`
	Version           int       `json:"version,omitempty" firestore:"version,omitempty"`
	UpdatedBy         string    `json:"updatedBy,omitempty" firestore:"updatedBy,omitempty"`
	UpdatedAt         time.Time `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// UpsertExpenseCategoryPayload is the request payload for creating or updating an expense policy.
type UpsertExpenseCategoryPayload struct {
	Code              string   `json:"code"`
	DisplayName       string   `json:"displayName"`
	LimitLabel        string   `json:"limitLabel,omitempty"`
	ApproverGroup     string   `json:"approverGroup"`
	PeriodType        string   `json:"periodType"`
	MaxTotalAmount    *float64 `json:"maxTotalAmount"`
	MaxCountPerPeriod *int     `json:"maxCountPerPeriod"`
	RequireAttachment bool     `json:"requireAttachment"`
	AutoPreApprove    *bool    `json:"autoPreApprove,omitempty"`
	AIReviewGuidance  string   `json:"aiReviewGuidance,omitempty"`
	SortOrder         int      `json:"sortOrder,omitempty"`
	Active            *bool    `json:"active,omitempty"`
	Reason            string   `json:"reason,omitempty"`
}

// ExpensePolicyAuditLog records immutable policy change history.
type ExpensePolicyAuditLog struct {
	ID           string           `json:"id" firestore:"id"`
	CategoryCode string           `json:"categoryCode" firestore:"categoryCode"`
	Action       string           `json:"action" firestore:"action"` // "create" | "update" | "deactivate"
	Source       string           `json:"source" firestore:"source"` // "ai_copilot" | "web_ui" | "system_seed"
	Before       *ExpenseCategory `json:"before,omitempty" firestore:"before,omitempty"`
	After        *ExpenseCategory `json:"after,omitempty" firestore:"after,omitempty"`
	Reason       string           `json:"reason,omitempty" firestore:"reason,omitempty"`
	ActorEmail   string           `json:"actorEmail,omitempty" firestore:"actorEmail,omitempty"`
	ActorName    string           `json:"actorName,omitempty" firestore:"actorName,omitempty"`
	ActorRole    string           `json:"actorRole,omitempty" firestore:"actorRole,omitempty"`
	CreatedAt    time.Time        `json:"createdAt" firestore:"createdAt"`
}

// BiweeklyPayrollConfig stores the shared fixed bi-weekly pay period anchor used by both
// Bi-Weekly Payroll and Expense Policy evaluation.
type BiweeklyPayrollConfig struct {
	BiweeklyAnchorDate string `json:"biweeklyAnchorDate" firestore:"biweeklyAnchorDate"` // YYYY-MM-DD
	PeriodLengthDays   int    `json:"periodLengthDays" firestore:"periodLengthDays"`     // Default 14
	Timezone           string `json:"timezone" firestore:"timezone"`                     // Default "America/Toronto"
	UpdatedBy          string `json:"updatedBy,omitempty" firestore:"updatedBy,omitempty"`
	UpdatedAt          string `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// DefaultBiweeklyPayrollConfig returns the default bi-weekly pay period anchor configuration.
func DefaultBiweeklyPayrollConfig() *BiweeklyPayrollConfig {
	return &BiweeklyPayrollConfig{
		BiweeklyAnchorDate: "2026-01-04",
		PeriodLengthDays:   14,
		Timezone:           "America/Toronto",
	}
}

// ExpensePolicySettings stores global expense workflow settings such as the pre-approval SLA window.
type ExpensePolicySettings struct {
	AutoApproveDays int    `json:"autoApproveDays" firestore:"autoApproveDays"` // Calendar days before pre_approved auto-finalizes (default 5)
	UpdatedBy       string `json:"updatedBy,omitempty" firestore:"updatedBy,omitempty"`
	UpdatedAt       string `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// DefaultExpensePolicySettings returns the default expense policy workflow settings.
func DefaultExpensePolicySettings() *ExpensePolicySettings {
	return &ExpensePolicySettings{
		AutoApproveDays: 5,
	}
}

// ExpenseLineEvaluation holds deterministic policy check results for a single claim line.
type ExpenseLineEvaluation struct {
	LineID               string   `json:"lineId"`
	CategoryCode         string   `json:"categoryCode"`
	CategoryDisplayName  string   `json:"categoryDisplayName"`
	ApproverGroup        string   `json:"approverGroup"`
	PeriodType           string   `json:"periodType"`
	WindowStart          string   `json:"windowStart,omitempty"`
	WindowEnd            string   `json:"windowEnd,omitempty"`
	MaxTotalAmount       *float64 `json:"maxTotalAmount,omitempty"`
	MaxCountPerPeriod    *int     `json:"maxCountPerPeriod,omitempty"`
	CurrentAmount        float64  `json:"currentAmount"`
	ApprovedAmount       float64  `json:"approvedAmount"`
	PendingAmount        float64  `json:"pendingAmount"`
	ProjectedApproved    float64  `json:"projectedApproved"`
	ProjectedWithPending float64  `json:"projectedWithPending"`
	RemainingAmount      *float64 `json:"remainingAmount,omitempty"`
	ApprovedCount        int      `json:"approvedCount"`
	PendingCount         int      `json:"pendingCount"`
	Status               string   `json:"status"` // "pass" | "warning" | "violation"
	Reasons              []string `json:"reasons,omitempty"`
	AIReviewGuidance     string   `json:"aiReviewGuidance,omitempty"`
	IsLegacyCategory     bool     `json:"isLegacyCategory,omitempty"`
}

// ExpenseClaimEvaluation aggregates deterministic policy checks across all lines of a claim.
type ExpenseClaimEvaluation struct {
	ClaimID            string                  `json:"claimId"`
	EmployeeID         string                  `json:"employeeId"`
	ClaimDate          string                  `json:"claimDate"`
	Status             string                  `json:"status"` // "pass" | "warning" | "violation"
	RequiresOverride   bool                    `json:"requiresOverride"`
	ApproverGroups     []string                `json:"approverGroups"`
	BiweeklyAnchorDate string                  `json:"biweeklyAnchorDate,omitempty"`
	Lines              []ExpenseLineEvaluation `json:"lines"`
}

// ExpenseAIPreCheckFinding represents the AI/heuristic soft-rule check for a single expense line.
type ExpenseAIPreCheckFinding struct {
	LineID              string `json:"lineId"`
	CategoryCode        string `json:"categoryCode"`
	CategoryDisplayName string `json:"categoryDisplayName"`
	Status              string `json:"status"` // "pass" | "attention" | "missing_proof"
	Summary             string `json:"summary"`
	GuidanceChecked     string `json:"guidanceChecked,omitempty"`
	ReceiptVerified     bool   `json:"receiptVerified"`
}

// ExpenseAIPreCheckResult is returned by POST /api/dispatch/expense-reimbursements/{id}/ai-precheck.
type ExpenseAIPreCheckResult struct {
	ClaimID         string                     `json:"claimId"`
	Status          string                     `json:"status"` // "pass" | "attention" | "missing_proof"
	Engine          string                     `json:"engine"` // "gemini" | "builtin"
	Summary         string                     `json:"summary"`
	AttachmentCount int                        `json:"attachmentCount"`
	Findings        []ExpenseAIPreCheckFinding `json:"findings"`
	CheckedAt       string                     `json:"checkedAt"`
}

// ExpenseReimbursementLine represents a single line item within an expense reimbursement claim.
type ExpenseReimbursementLine struct {
	ID                  string  `json:"id" firestore:"id"`
	CategoryCode        string  `json:"categoryCode" firestore:"categoryCode"`
	CategoryDisplayName string  `json:"categoryDisplayName" firestore:"categoryDisplayName"`
	Amount              float64 `json:"amount" firestore:"amount"`
	Note                string  `json:"note" firestore:"note"`
	SortOrder           int     `json:"sortOrder" firestore:"sortOrder"`
}

// ExpenseReimbursement represents a driver expense claim submitted for office review.
type ExpenseReimbursement struct {
	ID             string                     `json:"id" firestore:"id"`
	EmployeeID     string                     `json:"employeeId" firestore:"employeeId"`
	EmployeeName   string                     `json:"employeeName" firestore:"employeeName"`
	ClaimDate      string                     `json:"claimDate" firestore:"claimDate"` // YYYY-MM-DD
	RouteNo        string                     `json:"routeNo" firestore:"routeNo"`
	TotalAmount    float64                    `json:"totalAmount" firestore:"totalAmount"`
	Lines          []ExpenseReimbursementLine `json:"lines" firestore:"lines"`
	AttachmentURLs []string                   `json:"attachmentUrls,omitempty" firestore:"attachmentUrls,omitempty"`
	// Status: "pending" | "pre_approved" | "approved" | "rejected" | "cancelled"
	Status              string     `json:"status" firestore:"status"`
	PreApprovedAt       *time.Time `json:"preApprovedAt,omitempty" firestore:"preApprovedAt,omitempty"`
	AutoApproveDeadline *time.Time `json:"autoApproveDeadline,omitempty" firestore:"autoApproveDeadline,omitempty"`
	AutoApproved        bool       `json:"autoApproved,omitempty" firestore:"autoApproved,omitempty"`
	ApprovalNotes       string     `json:"approvalNotes,omitempty" firestore:"approvalNotes,omitempty"`
	ApprovedByName      string     `json:"approvedByName,omitempty" firestore:"approvedByName,omitempty"`
	ApprovedAt          *time.Time `json:"approvedAt,omitempty" firestore:"approvedAt,omitempty"`
	CreatedAt           time.Time  `json:"createdAt" firestore:"createdAt"`
	UpdatedAt           time.Time  `json:"updatedAt" firestore:"updatedAt"`
}

// ExpenseReimbursementLinePayload represents a line item in claim creation.
type ExpenseReimbursementLinePayload struct {
	CategoryCode        string  `json:"categoryCode"`
	CategoryDisplayName string  `json:"categoryDisplayName"`
	Amount              float64 `json:"amount"`
	Note                string  `json:"note"`
	SortOrder           int     `json:"sortOrder"`
}

// CreateExpenseClaimPayload is the request payload received when submitting an expense claim.
type CreateExpenseClaimPayload struct {
	EmployeeID     string                            `json:"employeeId"`
	EmployeeName   string                            `json:"employeeName"`
	ClaimDate      string                            `json:"claimDate"`
	RouteNo        string                            `json:"routeNo"`
	Lines          []ExpenseReimbursementLinePayload `json:"lines"`
	AttachmentURLs []string                          `json:"attachmentUrls,omitempty"`

	// Server-computed triage fields (not accepted from JSON clients)
	InitialStatus       string     `json:"-"`
	PreApprovedAt       *time.Time `json:"-"`
	AutoApproveDeadline *time.Time `json:"-"`
	InitialNotes        string     `json:"-"`
}

// ReviewExpenseClaimPayload is the request payload for approving, rejecting, or holding an expense claim.
type ReviewExpenseClaimPayload struct {
	Status         string `json:"status"` // "approved" | "rejected" | "pending"
	ApprovalNotes  string `json:"approvalNotes"`
	ApprovedByName string `json:"approvedByName"`
}

// CancelExpenseClaimPayload is the request payload for cancelling a pending expense claim.
type CancelExpenseClaimPayload struct {
	EmployeeID string `json:"employeeId"`
}
