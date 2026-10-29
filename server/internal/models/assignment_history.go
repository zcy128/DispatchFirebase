package models

import "time"

// AssignmentHistoryRecord represents a driver-route or driver-vehicle assignment event
type AssignmentHistoryRecord struct {
	ID              string      `json:"id" firestore:"id"`
	Type            string      `json:"type" firestore:"type"`                   // "driver_route" | "driver_vehicle"
	Action          string      `json:"action" firestore:"action"`               // "assign" | "unassign" | "reassign"
	Timestamp       string      `json:"timestamp" firestore:"timestamp"`         // ISO 8601
	EffectiveDate   string      `json:"effectiveDate" firestore:"effectiveDate"` // YYYY-MM-DD
	EndDate         string      `json:"endDate,omitempty" firestore:"endDate,omitempty"`
	DriverID        string      `json:"driverId" firestore:"driverId"`
	DriverName      string      `json:"driverName" firestore:"driverName"`
	DriverNumber    string      `json:"driverNumber,omitempty" firestore:"driverNumber,omitempty"`
	RouteID         string      `json:"routeId,omitempty" firestore:"routeId,omitempty"`
	RouteNo         string      `json:"routeNo,omitempty" firestore:"routeNo,omitempty"`
	RouteName       string      `json:"routeName,omitempty" firestore:"routeName,omitempty"`
	ShiftType       string      `json:"shiftType,omitempty" firestore:"shiftType,omitempty"`
	VehicleID       interface{} `json:"vehicleId,omitempty" firestore:"vehicleId,omitempty"`
	UnitNumber      string      `json:"unitNumber,omitempty" firestore:"unitNumber,omitempty"`
	PlateNumber     string      `json:"plateNumber,omitempty" firestore:"plateNumber,omitempty"`
	AssignedBy      string      `json:"assignedBy,omitempty" firestore:"assignedBy,omitempty"`
	DispatcherID    string      `json:"dispatcherId,omitempty" firestore:"dispatcherId,omitempty"`
	DispatcherName  string      `json:"dispatcherName,omitempty" firestore:"dispatcherName,omitempty"`
	DispatcherRole  string      `json:"dispatcherRole,omitempty" firestore:"dispatcherRole,omitempty"`
	DispatcherEmail string      `json:"dispatcherEmail,omitempty" firestore:"dispatcherEmail,omitempty"`
	Reason          string      `json:"reason,omitempty" firestore:"reason,omitempty"`
	Notes           string      `json:"notes,omitempty" firestore:"notes,omitempty"`
	IsCurrent       bool        `json:"isCurrent" firestore:"isCurrent"`
	CreatedAt       *time.Time  `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	ServerTimestamp int64       `json:"serverTimestamp,omitempty" firestore:"serverTimestamp,omitempty"`
}
