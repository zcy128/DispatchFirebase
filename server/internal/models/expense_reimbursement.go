package models

import "time"

// ExpenseCategory defines an expense categorization for driver reimbursements.
type ExpenseCategory struct {
	ID          string `json:"id" firestore:"id"`
	Code        string `json:"code" firestore:"code"`
	DisplayName string `json:"displayName" firestore:"displayName"`
	SortOrder   int    `json:"sortOrder" firestore:"sortOrder"`
	Active      bool   `json:"active" firestore:"active"`
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
	// Status: "pending" | "approved" | "rejected" | "cancelled"
	Status         string                     `json:"status" firestore:"status"`
	ApprovalNotes  string                     `json:"approvalNotes,omitempty" firestore:"approvalNotes,omitempty"`
	ApprovedByName string                     `json:"approvedByName,omitempty" firestore:"approvedByName,omitempty"`
	ApprovedAt     *time.Time                 `json:"approvedAt,omitempty" firestore:"approvedAt,omitempty"`
	CreatedAt      time.Time                  `json:"createdAt" firestore:"createdAt"`
	UpdatedAt      time.Time                  `json:"updatedAt" firestore:"updatedAt"`
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
}

// ReviewExpenseClaimPayload is the request payload for approving or rejecting an expense claim.
type ReviewExpenseClaimPayload struct {
	Status         string `json:"status"` // "approved" | "rejected"
	ApprovalNotes  string `json:"approvalNotes"`
	ApprovedByName string `json:"approvedByName"`
}

// CancelExpenseClaimPayload is the request payload for cancelling a pending expense claim.
type CancelExpenseClaimPayload struct {
	EmployeeID string `json:"employeeId"`
}
