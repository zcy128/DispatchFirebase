package models

// BusRoutePayrollRate represents busroute_payroll_rate table from BusRoutePayrollModel.cs
type BusRoutePayrollRate struct {
	ID              string      `json:"id" firestore:"id"`
	NumericID       int         `json:"numericId" firestore:"numericId"`
	SchoolBoardID   int         `json:"schoolBoardId" firestore:"schoolBoardId"`
	SchoolBoardName string      `json:"schoolBoardName,omitempty" firestore:"schoolBoardName,omitempty"`
	SchoolBoardCode string      `json:"schoolBoardCode,omitempty" firestore:"schoolBoardCode,omitempty"`
	RouteID         *int        `json:"routeId,omitempty" firestore:"routeId,omitempty"`
	RouteNo         string      `json:"routeNo,omitempty" firestore:"routeNo,omitempty"`
	RouteName       string      `json:"routeName,omitempty" firestore:"routeName,omitempty"`
	ShiftID         *int        `json:"shiftId,omitempty" firestore:"shiftId,omitempty"`
	ShiftName       string      `json:"shiftName,omitempty" firestore:"shiftName,omitempty"`
	EmployeeID      *int        `json:"employeeId,omitempty" firestore:"employeeId,omitempty"`
	EmployeeName    string      `json:"employeeName,omitempty" firestore:"employeeName,omitempty"`
	JobTitle        string      `json:"jobTitle,omitempty" firestore:"jobTitle,omitempty"`     // "driver", "attendant", "lpn"
	WeekDays        string      `json:"weekDays,omitempty" firestore:"weekDays,omitempty"`     // "Weekdays", "Mon-Wed", etc.
	ShiftType       string      `json:"shiftType,omitempty" firestore:"shiftType,omitempty"`   // "AM", "MIDDAY", "PM"
	PayRate         *float64    `json:"payRate,omitempty" firestore:"payRate,omitempty"`
	EiHours         *float64    `json:"eiHours,omitempty" firestore:"eiHours,omitempty"`
	EffectiveDate   string      `json:"effectiveDate" firestore:"effectiveDate"`               // "YYYY-MM-DD"
	RetireDate      *string     `json:"retireDate,omitempty" firestore:"retireDate,omitempty"` // "YYYY-MM-DD" or null
	Notes           string      `json:"notes,omitempty" firestore:"notes,omitempty"`
	CreatedAt       interface{} `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt       interface{} `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// SchoolBoardShiftRate holds rate details for a specific job title and shift type
type SchoolBoardShiftRate struct {
	RateID        string   `json:"rateId,omitempty"`
	PayRate       *float64 `json:"payRate,omitempty"`
	EiHours       *float64 `json:"eiHours,omitempty"`
	EffectiveDate string   `json:"effectiveDate,omitempty"`
	RetireDate    *string  `json:"retireDate,omitempty"`
}

// SchoolBoardJobRates holds rates across shift types for a job title
type SchoolBoardJobRates struct {
	AM     SchoolBoardShiftRate `json:"am"`
	Midday SchoolBoardShiftRate `json:"midday"`
	PM     SchoolBoardShiftRate `json:"pm"`
	All    SchoolBoardShiftRate `json:"all"`
}

// SchoolBoardBaseRatesDTO aggregates base rates for a board
type SchoolBoardBaseRatesDTO struct {
	SchoolBoardID   int                 `json:"schoolBoardId"`
	SchoolBoardName string              `json:"schoolBoardName"`
	SchoolBoardCode string              `json:"schoolBoardCode"`
	Driver          SchoolBoardJobRates `json:"driver"`
	Attendant       SchoolBoardJobRates `json:"attendant"`
}

// RateCalculationRequest request to simulate rate resolution
type RateCalculationRequest struct {
	Date          string `json:"date"`
	SchoolBoardID int    `json:"schoolBoardId"`
	RouteID       *int   `json:"routeId,omitempty"`
	ShiftID       *int   `json:"shiftId,omitempty"`
	EmployeeID    *int   `json:"employeeId,omitempty"`
	JobTitle      string `json:"jobTitle"`   // "driver" or "attendant"
	ShiftType     string `json:"shiftType"` // "AM", "MIDDAY", "PM"
}

// RateCalculationResponse result of rate resolution
type RateCalculationResponse struct {
	MatchedTier     int                  `json:"matchedTier"` // 1: Route+Emp, 2: Emp general, 3: Route general, 4: Board base
	MatchedRuleDesc string               `json:"matchedRuleDesc"`
	PayRate         float64              `json:"payRate"`
	EiHours         float64              `json:"eiHours"`
	AppliedRate     *BusRoutePayrollRate `json:"appliedRate"`
}

// RolePayrollRateSetting defines dispatch payroll defaults for a role (driver, attendant, nurse)
type RolePayrollRateSetting struct {
	Role                 string  `json:"role" firestore:"role"`                                 // "driver", "attendant", "nurse"
	RoleLabel            string  `json:"roleLabel" firestore:"roleLabel"`                       // "Driver", "Attendant", "Nurse / LPN"
	PartialPayRate       float64 `json:"partialPayRate" firestore:"partialPayRate"`             // e.g. 25.0, 20.0, 30.0
	DoublePartialPayRate float64 `json:"doublePartialPayRate" firestore:"doublePartialPayRate"` // e.g. 50.0, 40.0, 60.0
	DefaultEiHours       float64 `json:"defaultEiHours" firestore:"defaultEiHours"`             // e.g. 3.0, 2.0, 3.0
	NoPayRate            float64 `json:"noPayRate" firestore:"noPayRate"`                       // 0.0
	NoPayEiHours         float64 `json:"noPayEiHours" firestore:"noPayEiHours"`                 // 0.0
}

// DispatchPayrollSettings stores global dispatch payroll defaults
type DispatchPayrollSettings struct {
	Driver    RolePayrollRateSetting `json:"driver" firestore:"driver"`
	Attendant RolePayrollRateSetting `json:"attendant" firestore:"attendant"`
	Nurse     RolePayrollRateSetting `json:"nurse" firestore:"nurse"`
	UpdatedAt string                 `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// DefaultDispatchPayrollSettings returns the preset configuration
func DefaultDispatchPayrollSettings() *DispatchPayrollSettings {
	return &DispatchPayrollSettings{
		Driver: RolePayrollRateSetting{
			Role:                 "driver",
			RoleLabel:            "Driver",
			PartialPayRate:       25.0,
			DoublePartialPayRate: 50.0,
			DefaultEiHours:       3.0,
			NoPayRate:            0.0,
			NoPayEiHours:         0.0,
		},
		Attendant: RolePayrollRateSetting{
			Role:                 "attendant",
			RoleLabel:            "Attendant",
			PartialPayRate:       20.0,
			DoublePartialPayRate: 40.0,
			DefaultEiHours:       2.0,
			NoPayRate:            0.0,
			NoPayEiHours:         0.0,
		},
		Nurse: RolePayrollRateSetting{
			Role:                 "nurse",
			RoleLabel:            "Nurse / LPN",
			PartialPayRate:       30.0,
			DoublePartialPayRate: 60.0,
			DefaultEiHours:       3.0,
			NoPayRate:            0.0,
			NoPayEiHours:         0.0,
		},
	}
}
