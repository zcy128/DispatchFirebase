package models

// StopStudent represents a student boarding/alighting at a stop (lightweight reference)
type StopStudent struct {
	StudentID   int    `json:"studentId" firestore:"studentId"`
	StudentNo   string `json:"studentNo" firestore:"studentNo"`
	StudentName string `json:"studentName" firestore:"studentName"`
	SchoolName  string `json:"schoolName,omitempty" firestore:"schoolName,omitempty"`
}

// RouteStop represents an ordered stop within a shift
type RouteStop struct {
	StopID                 int           `json:"stopId" firestore:"stopId"`
	Sequence               int           `json:"sequence" firestore:"sequence"`
	StopLocation           string        `json:"stopLocation" firestore:"stopLocation"`
	PullawayTime           string        `json:"pullawayTime" firestore:"pullawayTime"` // e.g. "07:30"
	StopType               string        `json:"stopType" firestore:"stopType"`         // HomePickup, SchoolDropoff, etc.
	Latitude               *float64      `json:"latitude,omitempty" firestore:"latitude,omitempty"`
	Longitude              *float64      `json:"longitude,omitempty" firestore:"longitude,omitempty"`
	SchoolID               *int          `json:"schoolId,omitempty" firestore:"schoolId,omitempty"`
	SchoolName             string        `json:"schoolName,omitempty" firestore:"schoolName,omitempty"`
	Comment                string        `json:"comment,omitempty" firestore:"comment,omitempty"`
	Instruction            string        `json:"instruction,omitempty" firestore:"instruction,omitempty"`
	RunDays                string        `json:"runDays,omitempty" firestore:"runDays,omitempty"`
	EffectiveDate          *string       `json:"effectiveDate,omitempty" firestore:"effectiveDate,omitempty"`
	RetireDate             *string       `json:"retireDate,omitempty" firestore:"retireDate,omitempty"`
	AssignedStudents       []StopStudent `json:"assignedStudents,omitempty" firestore:"assignedStudents,omitempty"`
	PickupLocation         string        `json:"pickupLocation,omitempty" firestore:"pickupLocation,omitempty"`
	PickupLatitude         *float64      `json:"pickupLatitude,omitempty" firestore:"pickupLatitude,omitempty"`
	PickupLongitude        *float64      `json:"pickupLongitude,omitempty" firestore:"pickupLongitude,omitempty"`
	IsCustomPickupLocation bool          `json:"isCustomPickupLocation,omitempty" firestore:"isCustomPickupLocation,omitempty"`
}

// ShiftSummary embedded into BusRoute for fast high-level dashboard display
type ShiftSummary struct {
	ShiftID       int    `json:"shiftId" firestore:"shiftId"`
	ShiftType     string `json:"shiftType" firestore:"shiftType"` // "AM", "PM", "Midday"
	RunDays       string `json:"runDays" firestore:"runDays"`     // "Weekdays"
	FirstStopTime string `json:"firstStopTime" firestore:"firstStopTime"`
	LastStopTime  string `json:"lastStopTime" firestore:"lastStopTime"`
	StopCount     int    `json:"stopCount" firestore:"stopCount"`
	StudentCount  int    `json:"studentCount" firestore:"studentCount"`
}

// RouteLeg represents pre-computed road geometry between two sequential stops
type RouteLeg struct {
	LegIndex        int      `json:"legIndex" firestore:"legIndex"`
	FromStopID      int      `json:"fromStopId" firestore:"fromStopId"`
	ToStopID        int      `json:"toStopId" firestore:"toStopId"`
	DistanceMeters  int      `json:"distanceMeters" firestore:"distanceMeters"`
	DurationSeconds int      `json:"durationSeconds" firestore:"durationSeconds"`
	Polyline        string   `json:"polyline" firestore:"polyline"` // Google Encoded Polyline
	StartLatitude   *float64 `json:"startLatitude,omitempty" firestore:"startLatitude,omitempty"`
	StartLongitude  *float64 `json:"startLongitude,omitempty" firestore:"startLongitude,omitempty"`
	EndLatitude     *float64 `json:"endLatitude,omitempty" firestore:"endLatitude,omitempty"`
	EndLongitude    *float64 `json:"endLongitude,omitempty" firestore:"endLongitude,omitempty"`
}

// BusRouteShift is the comprehensive operational aggregate document (Collection: route_shifts)
type BusRouteShift struct {
	ID              string      `json:"id" firestore:"id"` // SHIFT-{ShiftId}-{Type}
	ShiftID         int         `json:"shiftId" firestore:"shiftId"`
	RouteID         string      `json:"routeId" firestore:"routeId"` // RT-{BusRouteId}
	RouteNo         string      `json:"routeNo" firestore:"routeNo"`
	RouteName       string      `json:"routeName" firestore:"routeName"`
	ShiftType       string      `json:"shiftType" firestore:"shiftType"` // "AM", "PM"
	RunDays         string      `json:"runDays" firestore:"runDays"`
	BusplannerRunID string      `json:"busplannerRunId,omitempty" firestore:"busplannerRunId,omitempty"`
	Active          *bool       `json:"active,omitempty" firestore:"active,omitempty"`
	EffectiveDate   *string     `json:"effectiveDate,omitempty" firestore:"effectiveDate,omitempty"`
	RetireDate      *string     `json:"retireDate,omitempty" firestore:"retireDate,omitempty"`
	FirstStopTime   string      `json:"firstStopTime" firestore:"firstStopTime"`
	LastStopTime    string      `json:"lastStopTime" firestore:"lastStopTime"`
	Stops           []RouteStop `json:"stops" firestore:"stops"`
	Legs            []RouteLeg  `json:"legs,omitempty" firestore:"legs,omitempty"` // Pre-computed Google Routes legs
	IsCustomCrew    bool        `json:"isCustomCrew,omitempty" firestore:"isCustomCrew,omitempty"`
	DriverID        string      `json:"driverId,omitempty" firestore:"driverId,omitempty"`
	DriverName      string      `json:"driverName,omitempty" firestore:"driverName,omitempty"`
	DriverPhone     string      `json:"driverPhone,omitempty" firestore:"driverPhone,omitempty"`
	VehicleID       int         `json:"vehicleId,omitempty" firestore:"vehicleId,omitempty"`
	UnitNumber      string      `json:"unitNumber,omitempty" firestore:"unitNumber,omitempty"`
	PlateNumber     string      `json:"plateNumber,omitempty" firestore:"plateNumber,omitempty"`
	AttendantID     string      `json:"attendantId,omitempty" firestore:"attendantId,omitempty"`
	AttendantName   string      `json:"attendantName,omitempty" firestore:"attendantName,omitempty"`
	AttendantPhone  string      `json:"attendantPhone,omitempty" firestore:"attendantPhone,omitempty"`
	CreatedAt       interface{} `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt       interface{} `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// BusRoute represents primary route entity (Collection: routes)
type BusRoute struct {
	ID              string         `json:"id" firestore:"id"` // RT-{BusRouteId}
	BusRouteId      int            `json:"busRouteId" firestore:"busRouteId"`
	RouteNo         string         `json:"routeNo" firestore:"routeNo"` // OCDSB-001
	RouteName       string         `json:"routeName" firestore:"routeName"`
	Active          bool           `json:"active" firestore:"active"`
	SchoolBoardID   int            `json:"schoolBoardId" firestore:"schoolBoardId"`
	SchoolBoardCode string         `json:"schoolBoardCode" firestore:"schoolBoardCode"`
	YardID          int            `json:"yardId" firestore:"yardId"`
	YardName        string         `json:"yardName" firestore:"yardName"`
	DriverID        string         `json:"driverId,omitempty" firestore:"driverId,omitempty"`
	DriverName      string         `json:"driverName,omitempty" firestore:"driverName,omitempty"`
	DriverPhone     string         `json:"driverPhone,omitempty" firestore:"driverPhone,omitempty"`
	VehicleID       int            `json:"vehicleId,omitempty" firestore:"vehicleId,omitempty"`
	UnitNumber      string         `json:"unitNumber,omitempty" firestore:"unitNumber,omitempty"`
	PlateNumber     string         `json:"plateNumber,omitempty" firestore:"plateNumber,omitempty"`
	VehicleCapacity int            `json:"vehicleCapacity,omitempty" firestore:"vehicleCapacity,omitempty"`
	AttendantID     string         `json:"attendantId,omitempty" firestore:"attendantId,omitempty"`
	AttendantName   string         `json:"attendantName,omitempty" firestore:"attendantName,omitempty"`
	AttendantPhone  string         `json:"attendantPhone,omitempty" firestore:"attendantPhone,omitempty"`
	Shifts          []ShiftSummary `json:"shifts,omitempty" firestore:"shifts,omitempty"`
	TotalStops      int            `json:"totalStops" firestore:"totalStops"`
	TotalStudents   int            `json:"totalStudents" firestore:"totalStudents"`
	AutoMarryup     *bool          `json:"autoMarryup,omitempty" firestore:"autoMarryup,omitempty"`
	Instructions    string         `json:"instructions,omitempty" firestore:"instructions,omitempty"`
	CreatedAt       interface{}    `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt       interface{}    `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// UpdateRouteRequest specifies updates for route configuration and metadata
type UpdateRouteRequest struct {
	RouteNo       *string `json:"routeNo,omitempty"`
	RouteName     *string `json:"routeName,omitempty"`
	Instructions  *string `json:"instructions,omitempty"`
	Active        *bool   `json:"active,omitempty"`
	SchoolBoardID *int    `json:"schoolBoardId,omitempty"`
	YardID        *int    `json:"yardId,omitempty"`
	YardName      *string `json:"yardName,omitempty"`
	AutoMarryup   *bool   `json:"autoMarryup,omitempty"`
}

// ShiftCrewOverride specifies crew details for a single shift when custom crew is enabled
type ShiftCrewOverride struct {
	ShiftID        string `json:"shiftId"`
	DriverID       string `json:"driverId,omitempty"`
	DriverName     string `json:"driverName,omitempty"`
	DriverPhone    string `json:"driverPhone,omitempty"`
	VehicleID      int    `json:"vehicleId,omitempty"`
	UnitNumber     string `json:"unitNumber,omitempty"`
	PlateNumber    string `json:"plateNumber,omitempty"`
	AttendantID    string `json:"attendantId,omitempty"`
	AttendantName  string `json:"attendantName,omitempty"`
	AttendantPhone string `json:"attendantPhone,omitempty"`
}

// AssignRouteCrewRequest is payload for PUT /api/routes/{id}/crew
type AssignRouteCrewRequest struct {
	DriverID       string              `json:"driverId"`
	DriverName     string              `json:"driverName,omitempty"`
	DriverPhone    string              `json:"driverPhone,omitempty"`
	VehicleID      int                 `json:"vehicleId,omitempty"`
	UnitNumber     string              `json:"unitNumber,omitempty"`
	PlateNumber    string              `json:"plateNumber,omitempty"`
	AttendantID    string              `json:"attendantId,omitempty"`
	AttendantName  string              `json:"attendantName,omitempty"`
	AttendantPhone string              `json:"attendantPhone,omitempty"`
	IsCustomCrew   bool                `json:"isCustomCrew"`
	ShiftOverrides []ShiftCrewOverride `json:"shiftOverrides,omitempty"`
}

// UpdateShiftRequest represents optional fields that can be updated on a shift
type UpdateShiftRequest struct {
	Stops         *[]RouteStop `json:"stops,omitempty"`
	Active        *bool        `json:"active,omitempty"`
	RunDays       *string      `json:"runDays,omitempty"`
	EffectiveDate *string      `json:"effectiveDate,omitempty"`
	RetireDate    *string      `json:"retireDate,omitempty"`
}
