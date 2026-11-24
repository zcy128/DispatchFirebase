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
	TimeOffStatusPending             TimeOffStatus = "pending"
	TimeOffStatusAwaitingPeerConfirm TimeOffStatus = "awaiting_peer_confirm"
	TimeOffStatusSeekingCoverage     TimeOffStatus = "seeking_coverage"
	TimeOffStatusPreApproved         TimeOffStatus = "pre_approved"
	TimeOffStatusApproved            TimeOffStatus = "approved"
	TimeOffStatusRejected            TimeOffStatus = "rejected"
	TimeOffStatusCancelled           TimeOffStatus = "cancelled"
)

// TimeOffCoverageSlot tracks per-shift substitute coverage (supporting different drivers for AM vs PM).
type TimeOffCoverageSlot struct {
	SlotID                string     `json:"slotId" firestore:"slotId"`
	Date                  string     `json:"date" firestore:"date"`           // YYYY-MM-DD
	ShiftType             string     `json:"shiftType" firestore:"shiftType"` // "AM" | "PM" | "Midday"
	RouteID               string     `json:"routeId,omitempty" firestore:"routeId,omitempty"`
	RouteNo               string     `json:"routeNo" firestore:"routeNo"`
	YardID                string     `json:"yardId,omitempty" firestore:"yardId,omitempty"`
	YardName              string     `json:"yardName,omitempty" firestore:"yardName,omitempty"`
	ScheduledStart        string     `json:"scheduledStart,omitempty" firestore:"scheduledStart,omitempty"`
	ScheduledEnd          string     `json:"scheduledEnd,omitempty" firestore:"scheduledEnd,omitempty"`
	Status                string     `json:"status" firestore:"status"` // "awaiting_peer" | "open_broadcast" | "filled" | "declined"
	CoverDriverID         string     `json:"coverDriverId,omitempty" firestore:"coverDriverId,omitempty"`
	CoverDriverName       string     `json:"coverDriverName,omitempty" firestore:"coverDriverName,omitempty"`
	TemporaryAssignmentID string     `json:"temporaryAssignmentId,omitempty" firestore:"temporaryAssignmentId,omitempty"`
	ConfirmedAt           *time.Time `json:"confirmedAt,omitempty" firestore:"confirmedAt,omitempty"`
}

// TimeOffRequest represents a formal employee leave request stored in Firestore collection 'time_off_requests'
type TimeOffRequest struct {
	ID                    string                `json:"id" firestore:"id"`                 // TOR-{timestamp}
	EmployeeID            string                `json:"employeeId" firestore:"employeeId"` // e.g. EMP-2001
	EmployeeNumber        string                `json:"employeeNumber,omitempty" firestore:"employeeNumber,omitempty"`
	EmployeeName          string                `json:"employeeName" firestore:"employeeName"`
	YardID                string                `json:"yardId,omitempty" firestore:"yardId,omitempty"`
	YardName              string                `json:"yardName,omitempty" firestore:"yardName,omitempty"`
	RouteNo               string                `json:"routeNo,omitempty" firestore:"routeNo,omitempty"`
	LeaveType             LeaveType             `json:"leaveType" firestore:"leaveType"`
	StartDate             string                `json:"startDate" firestore:"startDate"` // YYYY-MM-DD
	EndDate               string                `json:"endDate" firestore:"endDate"`     // YYYY-MM-DD
	ShiftType             string                `json:"shiftType" firestore:"shiftType"` // ALL, AM, PM, Midday
	Comments              string                `json:"comments,omitempty" firestore:"comments,omitempty"`
	Status                TimeOffStatus         `json:"status" firestore:"status"`
	CoverageMode          string                `json:"coverageMode,omitempty" firestore:"coverageMode,omitempty"` // "named_peer" | "auto_broadcast" | "manual_dispatch"
	CoverageSlots         []TimeOffCoverageSlot `json:"coverageSlots,omitempty" firestore:"coverageSlots,omitempty"`
	PreApprovedAt         *time.Time            `json:"preApprovedAt,omitempty" firestore:"preApprovedAt,omitempty"`
	AutoApproveDeadline   *time.Time            `json:"autoApproveDeadline,omitempty" firestore:"autoApproveDeadline,omitempty"`
	AutoApproved          bool                  `json:"autoApproved,omitempty" firestore:"autoApproved,omitempty"`
	RequestedByUserID     string                `json:"requestedByUserId,omitempty" firestore:"requestedByUserId,omitempty"`
	RequestedByName       string                `json:"requestedByName,omitempty" firestore:"requestedByName,omitempty"`
	ApprovedByUserID      string                `json:"approvedByUserId,omitempty" firestore:"approvedByUserId,omitempty"`
	ApprovedByName        string                `json:"approvedByName,omitempty" firestore:"approvedByName,omitempty"`
	ApprovedAt            *time.Time            `json:"approvedAt,omitempty" firestore:"approvedAt,omitempty"`
	ApprovalNotes         string                `json:"approvalNotes,omitempty" firestore:"approvalNotes,omitempty"`
	NotifiedChannels      []string              `json:"notifiedChannels,omitempty" firestore:"notifiedChannels,omitempty"`
	NotifiedAt            *time.Time            `json:"notifiedAt,omitempty" firestore:"notifiedAt,omitempty"`
	CoverageAssigned      bool                  `json:"coverageAssigned,omitempty" firestore:"coverageAssigned,omitempty"`
	CoverageAssignedAt    string                `json:"coverageAssignedAt,omitempty" firestore:"coverageAssignedAt,omitempty"`
	CoverageDriverName    string                `json:"coverageDriverName,omitempty" firestore:"coverageDriverName,omitempty"`
	CoverageDriverId      string                `json:"coverageDriverId,omitempty" firestore:"coverageDriverId,omitempty"`
	TemporaryAssignmentId string                `json:"temporaryAssignmentId,omitempty" firestore:"temporaryAssignmentId,omitempty"`
	CreatedAt             time.Time             `json:"createdAt" firestore:"createdAt"`
	UpdatedAt             time.Time             `json:"updatedAt" firestore:"updatedAt"`
	IsArchivedToBigQuery  bool                  `json:"isArchivedToBigQuery,omitempty" firestore:"isArchivedToBigQuery,omitempty"`
	BigQueryDataset       string                `json:"bigQueryDataset,omitempty" firestore:"bigQueryDataset,omitempty"`
	BigQueryTable         string                `json:"bigQueryTable,omitempty" firestore:"bigQueryTable,omitempty"`
}

// CreateTimeOffRequestPayload contains parameters for submitting a new time-off request
type CreateTimeOffRequestPayload struct {
	EmployeeID          string                `json:"employeeId"`
	EmployeeNumber      string                `json:"employeeNumber,omitempty"`
	EmployeeName        string                `json:"employeeName"`
	YardID              string                `json:"yardId,omitempty"`
	YardName            string                `json:"yardName,omitempty"`
	RouteNo             string                `json:"routeNo,omitempty"`
	LeaveType           LeaveType             `json:"leaveType"`
	StartDate           string                `json:"startDate"`
	EndDate             string                `json:"endDate"`
	ShiftType           string                `json:"shiftType"`
	Comments            string                `json:"comments,omitempty"`
	RequestedByUserID   string                `json:"requestedByUserId,omitempty"`
	RequestedByName     string                `json:"requestedByName,omitempty"`
	InitialStatus       TimeOffStatus         `json:"initialStatus,omitempty"`
	CoverageMode        string                `json:"coverageMode,omitempty"`
	CoverageSlots       []TimeOffCoverageSlot `json:"coverageSlots,omitempty"`
	CoverageDriverId    string                `json:"coverageDriverId,omitempty"`
	CoverageDriverName  string                `json:"coverageDriverName,omitempty"`
	PreApprovedAt       *time.Time            `json:"preApprovedAt,omitempty"`
	AutoApproveDeadline *time.Time            `json:"autoApproveDeadline,omitempty"`
}

// UpdateTimeOffRequestPayload contains parameters for updating a pending time-off request
type UpdateTimeOffRequestPayload struct {
	LeaveType          LeaveType `json:"leaveType,omitempty"`
	StartDate          string    `json:"startDate,omitempty"`
	EndDate            string    `json:"endDate,omitempty"`
	ShiftType          string    `json:"shiftType,omitempty"`
	Comments           string    `json:"comments,omitempty"`
	CoverageAssigned      *bool     `json:"coverageAssigned,omitempty"`
	CoverageAssignedAt    string    `json:"coverageAssignedAt,omitempty"`
	CoverageDriverName    string    `json:"coverageDriverName,omitempty"`
	CoverageDriverId      string    `json:"coverageDriverId,omitempty"`
	TemporaryAssignmentId string    `json:"temporaryAssignmentId,omitempty"`
}

// ReviewTimeOffRequestPayload contains parameters for approving or rejecting a time-off request (HR/Admin only)
type ReviewTimeOffRequestPayload struct {
	ReviewerUserID   string   `json:"reviewerUserId"`
	ReviewerName     string   `json:"reviewerName"`
	ApprovalNotes    string   `json:"approvalNotes,omitempty"`
	NotifiedChannels []string `json:"notifiedChannels,omitempty"`
}

// OfficeConciergeCard represents an interactive widget inside the Employee <-> Company Office chat.
type OfficeConciergeCard struct {
	Type      string                 `json:"type"` // "leave_type_selector" | "time_off_preview" | "peer_cover_invite" | "time_off_status_update"
	Title     string                 `json:"title"`
	RequestID string                 `json:"requestId,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// OfficeConciergeMessage represents a persisted message in an employee's Office Concierge thread.
type OfficeConciergeMessage struct {
	ID         string               `json:"id"`
	EmployeeID string               `json:"employeeId"`
	SenderRole string               `json:"senderRole"` // "employee" | "office_ai" | "hr_approver" | "system"
	SenderName string               `json:"senderName"`
	Department string               `json:"department,omitempty"` // "HR" | "Dispatch" | "Fleet" | "Payroll"
	Text       string               `json:"text"`
	Card       *OfficeConciergeCard `json:"card,omitempty"`
	CreatedAt  time.Time            `json:"createdAt"`
}

// OfficeConciergeChatRequest is sent by an employee (or Web tester) in the Office Concierge chat window.
type OfficeConciergeChatRequest struct {
	EmployeeID   string `json:"employeeId"`
	EmployeeName string `json:"employeeName,omitempty"`
	Message      string `json:"message"`
	Action       string `json:"action,omitempty"`       // "select_leave_type" | "confirm_preview" | "cancel_draft"
	LeaveType    string `json:"leaveType,omitempty"`    // Selected leave type chip value
	Lang         string `json:"lang,omitempty"`         // "en" | "fr"
	ReferenceNow string `json:"referenceNow,omitempty"` // Optional ISO date override for deterministic tests
}

// OfficeConciergeChatResponse is returned by POST /api/office-concierge/chat.
type OfficeConciergeChatResponse struct {
	Reply      string                   `json:"reply"`
	Department string                   `json:"department"`
	Step       string                   `json:"step"`
	Card       *OfficeConciergeCard     `json:"card,omitempty"`
	Request    *TimeOffRequest          `json:"request,omitempty"`
	Messages   []OfficeConciergeMessage `json:"messages,omitempty"`
}

// ConfirmPeerCoverPayload is sent when a named substitute driver accepts or declines a peer cover invite.
type ConfirmPeerCoverPayload struct {
	DriverID   string `json:"driverId"`
	DriverName string `json:"driverName,omitempty"`
	Accepted   bool   `json:"accepted"`
	Notes      string `json:"notes,omitempty"`
}

// ClaimTimeOffSlotPayload is sent when a driver claims an open broadcast shift slot on a <=2-day time-off request.
type ClaimTimeOffSlotPayload struct {
	SlotID     string `json:"slotId"`
	DriverID   string `json:"driverId"`
	DriverName string `json:"driverName,omitempty"`
}

// TimeOffWorkbenchEvent represents a real-time event in the 3-Day Approver Chat Workbench.
type TimeOffWorkbenchEvent struct {
	ID          string          `json:"id"`
	RequestID   string          `json:"requestId"`
	EmployeeID  string          `json:"employeeId"`
	EmployeeName string         `json:"employeeName"`
	YardID      string          `json:"yardId,omitempty"`
	YardName    string          `json:"yardName,omitempty"`
	RouteNo     string          `json:"routeNo,omitempty"`
	EventType   string          `json:"eventType"` // "submitted" | "peer_invited" | "peer_accepted" | "peer_declined" | "slot_claimed" | "pre_approved" | "approved" | "auto_approved" | "rejected"
	Title       string          `json:"title"`
	Summary     string          `json:"summary"`
	Status      TimeOffStatus   `json:"status"`
	CanApprove  bool            `json:"canApprove"`
	Request     *TimeOffRequest `json:"request,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
}

// TimeOffYardSummary aggregates 3-day time-off and shift coverage metrics by Region / Yard.
type TimeOffYardSummary struct {
	YardID           string            `json:"yardId"`
	YardName         string            `json:"yardName"`
	TotalRequests    int               `json:"totalRequests"`
	PendingCount     int               `json:"pendingCount"`
	SeekingCount     int               `json:"seekingCount"`
	PreApprovedCount int               `json:"preApprovedCount"`
	ApprovedCount    int               `json:"approvedCount"`
	TotalSlots       int               `json:"totalSlots"`
	FilledSlots      int               `json:"filledSlots"`
	OpenSlots        int               `json:"openSlots"`
	Requests         []*TimeOffRequest `json:"requests"`
}

// TimeOffWorkbenchResponse is returned by GET /api/dispatch/time-off-workbench.
type TimeOffWorkbenchResponse struct {
	WindowStart  string                  `json:"windowStart"`
	WindowEnd    string                  `json:"windowEnd"`
	CanApprove   bool                    `json:"canApprove"`
	Events       []TimeOffWorkbenchEvent `json:"events"`
	ActiveClaims []*TimeOffRequest       `json:"activeClaims"`
	YardRegions  []TimeOffYardSummary    `json:"yardRegions"`
}
