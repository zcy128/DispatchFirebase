package models

import "time"

// Vehicle represents a fleet vehicle aggregate in Cloud Firestore (Collection: vehicles)
type Vehicle struct {
	ID                string    `json:"id" firestore:"id"` // e.g. "VEH-001"
	VehicleID         int       `json:"vehicleId" firestore:"vehicleId"`
	UnitNumber        string    `json:"unitNumber" firestore:"unitNumber"` // e.g. "1001"
	PlateNumber       string    `json:"plateNumber" firestore:"plateNumber"`
	Vin               string    `json:"vin,omitempty" firestore:"vin,omitempty"`
	Manufacturer      string    `json:"manufacturer" firestore:"manufacturer"` // e.g. "Blue Bird"
	Model             string    `json:"model" firestore:"model"`               // e.g. "CE Series"
	Year              int       `json:"year" firestore:"year"`
	Color             string    `json:"color" firestore:"color"`
	UnitType          string    `json:"unitType" firestore:"unitType"` // "Bus", "Van", "Car"
	SeatCap           int       `json:"seatCap" firestore:"seatCap"`
	WheelchairCap     int       `json:"wheelchairCap" firestore:"wheelchairCap"`
	FuelType          string    `json:"fuelType" firestore:"fuelType"` // "Diesel", "Gasoline"
	LicenseExpiry     string    `json:"licenseExpiry,omitempty" firestore:"licenseExpiry,omitempty"`
	Active            bool      `json:"active" firestore:"active"`
	Status            string    `json:"status" firestore:"status"` // "In Service", "Spare", "Maintenance"
	YardName          string    `json:"yardName" firestore:"yardName"`
	Odometer          int       `json:"odometer" firestore:"odometer"`
	EmployeeID        *int      `json:"employeeId,omitempty" firestore:"employeeId,omitempty"`
	DriverID          string    `json:"driverId,omitempty" firestore:"driverId,omitempty"`
	DriverName        string    `json:"driverName,omitempty" firestore:"driverName,omitempty"`
	DriverPhone       string    `json:"driverPhone,omitempty" firestore:"driverPhone,omitempty"`
	AssignedRouteID   string    `json:"assignedRouteId,omitempty" firestore:"assignedRouteId,omitempty"` // e.g. "RT-001"
	AssignedRouteNo   string    `json:"assignedRouteNo,omitempty" firestore:"assignedRouteNo,omitempty"` // e.g. "OCDSB-001"
	AssignedRouteName string    `json:"assignedRouteName,omitempty" firestore:"assignedRouteName,omitempty"`
	Notes             string    `json:"notes,omitempty" firestore:"notes,omitempty"`
	ZonarFleet        string    `json:"zonarFleet,omitempty" firestore:"zonarFleet,omitempty"`
	ZonarAssetID      int       `json:"zonarAssetId,omitempty" firestore:"zonarAssetId,omitempty"`
	GpsSerial         string    `json:"gpsSerial,omitempty" firestore:"gpsSerial,omitempty"`
	CreatedAt         time.Time `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt         time.Time `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// VehicleStats aggregates metrics across the fleet
type VehicleStats struct {
	TotalVehicles        int            `json:"totalVehicles"`
	ActiveVehicles       int            `json:"activeVehicles"`
	AssignedToRoutes     int            `json:"assignedToRoutes"`
	SpareVehicles        int            `json:"spareVehicles"`
	WheelchairAccessible int            `json:"wheelchairAccessible"`
	TypeDistribution     map[string]int `json:"typeDistribution"`
	FuelDistribution     map[string]int `json:"fuelDistribution"`
	YardDistribution     map[string]int `json:"yardDistribution"`
}
