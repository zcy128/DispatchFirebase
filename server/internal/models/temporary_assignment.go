package models

// TemporaryAssignment represents a scheduled temporary crew replacement on a route/shift (Collection: temporary_assignments)
type TemporaryAssignment struct {
	ID                     string      `json:"id" firestore:"id"`                                           // TA-{timestamp}
	RouteID                string      `json:"routeId" firestore:"routeId"`                                 // RT-{BusRouteId}
	RouteNo                string      `json:"routeNo" firestore:"routeNo"`                                 // e.g. "OCDSB-050"
	RouteName              string      `json:"routeName,omitempty" firestore:"routeName,omitempty"`
	ShiftType              string      `json:"shiftType" firestore:"shiftType"`                             // "ALL", "AM", "PM", "Midday"
	BusRouteShiftID        string      `json:"busRouteShiftId,omitempty" firestore:"busRouteShiftId,omitempty"`
	StartDate              string      `json:"startDate" firestore:"startDate"`                             // YYYY-MM-DD
	EndDate                string      `json:"endDate" firestore:"endDate"`                                 // YYYY-MM-DD (inclusive)
	SpecificDates          []string    `json:"specificDates,omitempty" firestore:"specificDates,omitempty"` // Optional discrete dates
	OriginalDriverID       string      `json:"originalDriverId,omitempty" firestore:"originalDriverId,omitempty"`
	OriginalDriverName     string      `json:"originalDriverName,omitempty" firestore:"originalDriverName,omitempty"`
	TemporaryDriverID      string      `json:"temporaryDriverId,omitempty" firestore:"temporaryDriverId,omitempty"`
	TemporaryDriverName    string      `json:"temporaryDriverName,omitempty" firestore:"temporaryDriverName,omitempty"`
	TemporaryDriverPhone   string      `json:"temporaryDriverPhone,omitempty" firestore:"temporaryDriverPhone,omitempty"`
	OriginalAttendantID    string      `json:"originalAttendantId,omitempty" firestore:"originalAttendantId,omitempty"`
	OriginalAttendantName  string      `json:"originalAttendantName,omitempty" firestore:"originalAttendantName,omitempty"`
	TemporaryAttendantID   string      `json:"temporaryAttendantId,omitempty" firestore:"temporaryAttendantId,omitempty"`
	TemporaryAttendantName string      `json:"temporaryAttendantName,omitempty" firestore:"temporaryAttendantName,omitempty"`
	TemporaryAttendantPhone string     `json:"temporaryAttendantPhone,omitempty" firestore:"temporaryAttendantPhone,omitempty"`
	TemporaryVehicleID     int         `json:"temporaryVehicleId,omitempty" firestore:"temporaryVehicleId,omitempty"`
	TemporaryUnitNumber    string      `json:"temporaryUnitNumber,omitempty" firestore:"temporaryUnitNumber,omitempty"`
	TemporaryPlateNumber   string      `json:"temporaryPlateNumber,omitempty" firestore:"temporaryPlateNumber,omitempty"`
	Reason                 string      `json:"reason" firestore:"reason"`                                   // "Sick Leave", "Vacation", "Driver Training", "Medical Appointment", "Other"
	Notes                  string      `json:"notes,omitempty" firestore:"notes,omitempty"`
	Status                 string      `json:"status" firestore:"status"`                                   // "active", "completed", "cancelled"
	CreatedBy              string      `json:"createdBy,omitempty" firestore:"createdBy,omitempty"`
	CreatedAt              interface{} `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt              interface{} `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// CreateTemporaryAssignmentRequest payload to create a temporary assignment
type CreateTemporaryAssignmentRequest struct {
	RouteID                 string   `json:"routeId"`
	RouteNo                 string   `json:"routeNo"`
	RouteName               string   `json:"routeName,omitempty"`
	ShiftType               string   `json:"shiftType"` // "ALL", "AM", "PM", "Midday"
	BusRouteShiftID         string   `json:"busRouteShiftId,omitempty"`
	StartDate               string   `json:"startDate"`
	EndDate                 string   `json:"endDate"`
	SpecificDates           []string `json:"specificDates,omitempty"`
	OriginalDriverID        string   `json:"originalDriverId,omitempty"`
	OriginalDriverName      string   `json:"originalDriverName,omitempty"`
	TemporaryDriverID       string   `json:"temporaryDriverId,omitempty"`
	TemporaryDriverName     string   `json:"temporaryDriverName,omitempty"`
	TemporaryDriverPhone    string   `json:"temporaryDriverPhone,omitempty"`
	OriginalAttendantID     string   `json:"originalAttendantId,omitempty"`
	OriginalAttendantName   string   `json:"originalAttendantName,omitempty"`
	TemporaryAttendantID    string   `json:"temporaryAttendantId,omitempty"`
	TemporaryAttendantName  string   `json:"temporaryAttendantName,omitempty"`
	TemporaryAttendantPhone string   `json:"temporaryAttendantPhone,omitempty"`
	TemporaryVehicleID      int      `json:"temporaryVehicleId,omitempty"`
	TemporaryUnitNumber     string   `json:"temporaryUnitNumber,omitempty"`
	TemporaryPlateNumber    string   `json:"temporaryPlateNumber,omitempty"`
	Reason                  string   `json:"reason"`
	Notes                   string   `json:"notes,omitempty"`
	CreatedBy               string   `json:"createdBy,omitempty"`
}

// UpdateTemporaryAssignmentRequest payload to update a temporary assignment
type UpdateTemporaryAssignmentRequest struct {
	ShiftType               *string  `json:"shiftType,omitempty"`
	StartDate               *string  `json:"startDate,omitempty"`
	EndDate                 *string  `json:"endDate,omitempty"`
	SpecificDates           []string `json:"specificDates,omitempty"`
	TemporaryDriverID       *string  `json:"temporaryDriverId,omitempty"`
	TemporaryDriverName     *string  `json:"temporaryDriverName,omitempty"`
	TemporaryDriverPhone    *string  `json:"temporaryDriverPhone,omitempty"`
	TemporaryAttendantID    *string  `json:"temporaryAttendantId,omitempty"`
	TemporaryAttendantName  *string  `json:"temporaryAttendantName,omitempty"`
	TemporaryAttendantPhone *string  `json:"temporaryAttendantPhone,omitempty"`
	TemporaryVehicleID      *int     `json:"temporaryVehicleId,omitempty"`
	TemporaryUnitNumber     *string  `json:"temporaryUnitNumber,omitempty"`
	TemporaryPlateNumber    *string  `json:"temporaryPlateNumber,omitempty"`
	Reason                  *string  `json:"reason,omitempty"`
	Notes                   *string  `json:"notes,omitempty"`
	Status                  *string  `json:"status,omitempty"`
}
