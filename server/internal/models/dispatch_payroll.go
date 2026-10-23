package models

// DispatchPayrollRecord represents an earned labor payroll liability confirmed upon crew check-in (Collection: dispatch_payrolls)
type DispatchPayrollRecord struct {
	ID              string      `json:"id" firestore:"id"`                           // Deterministic: DP-{shiftId}-{role}
	DispatchDate    string      `json:"dispatchDate" firestore:"dispatchDate"`       // YYYY-MM-DD
	ShiftID         string      `json:"shiftId" firestore:"shiftId"`                 // DS-{date}-{routeNo}-{shiftType}
	RouteNo         string      `json:"routeNo" firestore:"routeNo"`                 // e.g. "OCSB-050"
	RouteName       string      `json:"routeName,omitempty" firestore:"routeName,omitempty"`
	ShiftType       string      `json:"shiftType" firestore:"shiftType"`             // "AM", "PM", "Midday"
	SchoolBoardID   int         `json:"schoolBoardId" firestore:"schoolBoardId"`
	SchoolBoardCode string      `json:"schoolBoardCode,omitempty" firestore:"schoolBoardCode,omitempty"`
	EmployeeID      string      `json:"employeeId" firestore:"employeeId"`
	EmployeeName    string      `json:"employeeName" firestore:"employeeName"`
	Role            string      `json:"role" firestore:"role"`                       // "driver" or "attendant"
	VehicleID       int         `json:"vehicleId,omitempty" firestore:"vehicleId,omitempty"`
	UnitNumber      string      `json:"unitNumber,omitempty" firestore:"unitNumber,omitempty"`
	CheckInTime     string      `json:"checkInTime" firestore:"checkInTime"`         // "06:28"
	CheckOutTime    string      `json:"checkOutTime,omitempty" firestore:"checkOutTime,omitempty"` // "08:45"
	HasComments     bool        `json:"hasComments" firestore:"hasComments"`         // true if driver/attendant submitted comments
	PayOption       string      `json:"payOption" firestore:"payOption"`             // "PD", "DD", "NP", "F", "STANDARD"
	PayRate         float64     `json:"payRate" firestore:"payRate"`                 // Hourly or flat dollar rate
	EiHours         float64     `json:"eiHours" firestore:"eiHours"`                 // Insurable hours
	RateSource      string      `json:"rateSource" firestore:"rateSource"`           // "override_pd", "override_dd", "override_np", "override_custom", "route_shift_rate", "board_base_rate", "default"
	RateDescription string      `json:"rateDescription,omitempty" firestore:"rateDescription,omitempty"`
	PayrollComments string      `json:"payrollComments,omitempty" firestore:"payrollComments,omitempty"`
	Status              string      `json:"status" firestore:"status"`                   // "pending_checkout", "pending_approval", "approved", "rejected"
	SyncedToFinance     bool        `json:"syncedToFinance" firestore:"syncedToFinance"` // true if synced to payroll_logs
	IsCharter           bool        `json:"isCharter,omitempty" firestore:"isCharter,omitempty"`
	CharterTripID       string      `json:"charterTripId,omitempty" firestore:"charterTripId,omitempty"`
	CharterAssignmentID string      `json:"charterAssignmentId,omitempty" firestore:"charterAssignmentId,omitempty"`
	ClientName          string      `json:"clientName,omitempty" firestore:"clientName,omitempty"`
	ApprovedBy          *string     `json:"approvedBy,omitempty" firestore:"approvedBy,omitempty"`
	ApprovedAt      *string     `json:"approvedAt,omitempty" firestore:"approvedAt,omitempty"`
	RejectedBy      *string     `json:"rejectedBy,omitempty" firestore:"rejectedBy,omitempty"`
	RejectedAt      *string     `json:"rejectedAt,omitempty" firestore:"rejectedAt,omitempty"`
	UpdatedBy       *string     `json:"updatedBy,omitempty" firestore:"updatedBy,omitempty"`
	CreatedAt       interface{} `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt       interface{} `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// GenerateDispatchPayrollRequest defines payload to manually create or trigger payroll generation
type GenerateDispatchPayrollRequest struct {
	ShiftID     string `json:"shiftId"`
	Role        string `json:"role"` // "driver" or "attendant"
	CheckInTime string `json:"checkInTime,omitempty"`
}

// CrewCheckOutRequest payload for crew member checking out
type CrewCheckOutRequest struct {
	Role            string  `json:"role"` // "driver" or "attendant"
	CheckOutTime    *string `json:"checkOutTime,omitempty"`
	PayrollComments *string `json:"payrollComments,omitempty"`
	Undo            bool    `json:"undo,omitempty"`
}

// ApproveDispatchPayrollRequest payload for dispatcher approval & rate adjustments
type ApproveDispatchPayrollRequest struct {
	ApprovedBy      string   `json:"approvedBy"`
	PayRate         *float64 `json:"payRate,omitempty"`
	EiHours         *float64 `json:"eiHours,omitempty"`
	PayOption       *string  `json:"payOption,omitempty"`
	PayrollComments *string  `json:"payrollComments,omitempty"`
}

// RejectDispatchPayrollRequest payload for dispatcher rejection
type RejectDispatchPayrollRequest struct {
	RejectedBy string `json:"rejectedBy"`
	Reason     string `json:"reason,omitempty"`
}

// PayrollDepartmentLogRecord represents an approved record synced to the Finance/Payroll Department (Collection: payroll_logs)
type PayrollDepartmentLogRecord struct {
	ID                 string      `json:"id" firestore:"id"`                                     // Deterministic: PL-{shiftId}-{role}
	DispatchPayrollID  string      `json:"dispatchPayrollId" firestore:"dispatchPayrollId"`       // Reference to DP-{shiftId}-{role}
	DispatchDate       string      `json:"dispatchDate" firestore:"dispatchDate"`                 // YYYY-MM-DD
	ShiftID            string      `json:"shiftId" firestore:"shiftId"`
	RouteNo            string      `json:"routeNo" firestore:"routeNo"`
	RouteName          string      `json:"routeName,omitempty" firestore:"routeName,omitempty"`
	ShiftType          string      `json:"shiftType" firestore:"shiftType"`                       // "AM", "PM", "Midday"
	SchoolBoardCode    string      `json:"schoolBoardCode,omitempty" firestore:"schoolBoardCode,omitempty"`
	EmployeeID         string      `json:"employeeId" firestore:"employeeId"`
	EmployeeName       string      `json:"employeeName" firestore:"employeeName"`
	Role               string      `json:"role" firestore:"role"`                                 // "driver" or "attendant"
	UnitNumber         string      `json:"unitNumber,omitempty" firestore:"unitNumber,omitempty"`
	CheckInTime        string      `json:"checkInTime" firestore:"checkInTime"`
	CheckOutTime       string      `json:"checkOutTime,omitempty" firestore:"checkOutTime,omitempty"`
	PayOption          string      `json:"payOption" firestore:"payOption"`
	OriginalPayRate    float64     `json:"originalPayRate" firestore:"originalPayRate"`           // Source rate from Dispatch
	PayAmount          float64     `json:"payAmount" firestore:"payAmount"`                       // Editable by Payroll Department
	OriginalEiHours    float64     `json:"originalEiHours" firestore:"originalEiHours"`           // Source EI hours from Dispatch
	EiHours            float64     `json:"eiHours" firestore:"eiHours"`                           // Editable by Payroll Department
	RateSource         string      `json:"rateSource" firestore:"rateSource"`
	RateDescription    string      `json:"rateDescription,omitempty" firestore:"rateDescription,omitempty"`
	DispatcherComments string      `json:"dispatcherComments,omitempty" firestore:"dispatcherComments,omitempty"`
	CrewComments       string      `json:"crewComments,omitempty" firestore:"crewComments,omitempty"`
	PayrollNotes       string      `json:"payrollNotes,omitempty" firestore:"payrollNotes,omitempty"` // Internal Finance adjustments/notes
	Status              string      `json:"status" firestore:"status"`                             // "approved", "processed", "paid", "on_hold"
	IsCharter           bool        `json:"isCharter,omitempty" firestore:"isCharter,omitempty"`
	CharterTripID       string      `json:"charterTripId,omitempty" firestore:"charterTripId,omitempty"`
	CharterAssignmentID string      `json:"charterAssignmentId,omitempty" firestore:"charterAssignmentId,omitempty"`
	ClientName          string      `json:"clientName,omitempty" firestore:"clientName,omitempty"`
	ApprovedBy          string      `json:"approvedBy,omitempty" firestore:"approvedBy,omitempty"`
	ApprovedAt         string      `json:"approvedAt,omitempty" firestore:"approvedAt,omitempty"`
	SyncedAt           string      `json:"syncedAt" firestore:"syncedAt"`
	UpdatedAt          interface{} `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
	UpdatedBy          string      `json:"updatedBy,omitempty" firestore:"updatedBy,omitempty"`
}

// UpdatePayrollDepartmentLogRequest payload for payroll staff editing a payroll_log record
type UpdatePayrollDepartmentLogRequest struct {
	PayAmount    *float64 `json:"payAmount,omitempty"`
	EiHours      *float64 `json:"eiHours,omitempty"`
	PayrollNotes *string  `json:"payrollNotes,omitempty"`
	Status       *string  `json:"status,omitempty"`
	UpdatedBy    string   `json:"updatedBy"`
}
