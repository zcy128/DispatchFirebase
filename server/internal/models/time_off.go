package models

import "time"

// LeaveType represents the reason for time-off, referencing TimeOffLeaveType in TimeOffRequestModel.cs
type LeaveType string

const (
	LeaveTypeVacation            LeaveType = "vacation"
	LeaveTypeSickLeave           LeaveType = "sick_leave"
	LeaveTypePersonalDays        LeaveType = "personal_days"
	LeaveTypeJuryDuty            LeaveType = "jury_duty"
	LeaveTypeBereavementLeave    LeaveType = "bereavement_leave"
	LeaveTypeAboriginalPractices LeaveType = "aboriginal_practices"
	LeaveTypeOther               LeaveType = "other"
)

// TimeOffStatus represents the approval state of a time-off request
type TimeOffStatus string

const (
	TimeOffStatusPending   TimeOffStatus = "pending"
	TimeOffStatusApproved  TimeOffStatus = "approved"
	TimeOffStatusRejected  TimeOffStatus = "rejected"
	TimeOffStatusCancelled TimeOffStatus = "cancelled"
)

// TimeOffRequest represents a formal employee leave request stored in Firestore collection 'time_off_requests'
type TimeOffRequest struct {
	ID                string        `json:"id" firestore:"id"`                               // TOR-{timestamp}
	EmployeeID        string        `json:"employeeId" firestore:"employeeId"`               // e.g. EMP-2001
	EmployeeNumber    string        `json:"employeeNumber,omitempty" firestore:"employeeNumber,omitempty"`
	EmployeeName      string        `json:"employeeName" firestore:"employeeName"`
	LeaveType         LeaveType     `json:"leaveType" firestore:"leaveType"`
	StartDate         string        `json:"startDate" firestore:"startDate"`                 // YYYY-MM-DD
	EndDate           string        `json:"endDate" firestore:"endDate"`                     // YYYY-MM-DD
	ShiftType         string        `json:"shiftType" firestore:"shiftType"`                 // ALL, AM, PM, Midday
	Comments          string        `json:"comments,omitempty" firestore:"comments,omitempty"`
	Status            TimeOffStatus `json:"status" firestore:"status"`
	RequestedByUserID string        `json:"requestedByUserId,omitempty" firestore:"requestedByUserId,omitempty"`
	RequestedByName   string        `json:"requestedByName,omitempty" firestore:"requestedByName,omitempty"`
	ApprovedByUserID  string        `json:"approvedByUserId,omitempty" firestore:"approvedByUserId,omitempty"`
	ApprovedByName    string        `json:"approvedByName,omitempty" firestore:"approvedByName,omitempty"`
	ApprovedAt        *time.Time    `json:"approvedAt,omitempty" firestore:"approvedAt,omitempty"`
	ApprovalNotes     string        `json:"approvalNotes,omitempty" firestore:"approvalNotes,omitempty"`
	NotifiedChannels  []string      `json:"notifiedChannels,omitempty" firestore:"notifiedChannels,omitempty"`
	NotifiedAt        *time.Time    `json:"notifiedAt,omitempty" firestore:"notifiedAt,omitempty"`
	CreatedAt            time.Time     `json:"createdAt" firestore:"createdAt"`
	UpdatedAt            time.Time     `json:"updatedAt" firestore:"updatedAt"`
	IsArchivedToBigQuery bool          `json:"isArchivedToBigQuery,omitempty" firestore:"isArchivedToBigQuery,omitempty"`
	BigQueryDataset      string        `json:"bigQueryDataset,omitempty" firestore:"bigQueryDataset,omitempty"`
	BigQueryTable        string        `json:"bigQueryTable,omitempty" firestore:"bigQueryTable,omitempty"`
}

// CreateTimeOffRequestPayload contains parameters for submitting a new time-off request
type CreateTimeOffRequestPayload struct {
	EmployeeID        string    `json:"employeeId"`
	EmployeeNumber    string    `json:"employeeNumber,omitempty"`
	EmployeeName      string    `json:"employeeName"`
	LeaveType         LeaveType `json:"leaveType"`
	StartDate         string    `json:"startDate"`
	EndDate           string    `json:"endDate"`
	ShiftType         string    `json:"shiftType"`
	Comments          string    `json:"comments,omitempty"`
	RequestedByUserID string    `json:"requestedByUserId,omitempty"`
	RequestedByName   string    `json:"requestedByName,omitempty"`
}

// UpdateTimeOffRequestPayload contains parameters for updating a pending time-off request
type UpdateTimeOffRequestPayload struct {
	LeaveType LeaveType `json:"leaveType,omitempty"`
	StartDate string    `json:"startDate,omitempty"`
	EndDate   string    `json:"endDate,omitempty"`
	ShiftType string    `json:"shiftType,omitempty"`
	Comments  string    `json:"comments,omitempty"`
}

// ReviewTimeOffRequestPayload contains parameters for approving or rejecting a time-off request (HR/Admin only)
type ReviewTimeOffRequestPayload struct {
	ReviewerUserID   string   `json:"reviewerUserId"`
	ReviewerName     string   `json:"reviewerName"`
	ApprovalNotes    string   `json:"approvalNotes,omitempty"`
	NotifiedChannels []string `json:"notifiedChannels,omitempty"`
}
