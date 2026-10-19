package models

import "time"

// PreTripInspectionItem represents a single inspection checklist item result.
type PreTripInspectionItem struct {
	Code                string `json:"code" firestore:"code"`
	Title               string `json:"title" firestore:"title"`
	Category            string `json:"category" firestore:"category"`
	IsSchoolBusSpecific bool   `json:"isSchoolBusSpecific" firestore:"isSchoolBusSpecific"`
	// Status: "pass" | "minor_defect" | "major_defect" | "na"
	Status string `json:"status" firestore:"status"`
	Notes  string `json:"notes,omitempty" firestore:"notes,omitempty"`
}

// PreTripInspection represents a completed daily vehicle inspection record.
type PreTripInspection struct {
	ID           string `json:"id" firestore:"id"`
	VehicleUnit  string `json:"vehicleUnit" firestore:"vehicleUnit"`
	VehicleID    int    `json:"vehicleId" firestore:"vehicleId"`
	VehiclePlate string `json:"vehiclePlate,omitempty" firestore:"vehiclePlate,omitempty"`

	// InspectionDate in YYYY-MM-DD format
	InspectionDate string `json:"inspectionDate" firestore:"inspectionDate"`
	InspectionTime string `json:"inspectionTime" firestore:"inspectionTime"`

	InspectorID   string `json:"inspectorId" firestore:"inspectorId"`
	InspectorName string `json:"inspectorName" firestore:"inspectorName"`

	Odometer int `json:"odometer" firestore:"odometer"`

	// OverallStatus: "passed" | "passed_with_minor_defects" | "failed_major_defects"
	OverallStatus string `json:"overallStatus" firestore:"overallStatus"`

	// Items is a map keyed by item code.
	Items map[string]PreTripInspectionItem `json:"items" firestore:"items"`

	DefectNotes   string `json:"defectNotes,omitempty" firestore:"defectNotes,omitempty"`
	SignatureName string `json:"signatureName" firestore:"signatureName"`

	CreatedAt time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" firestore:"updatedAt"`
}

// CreatePreTripInspectionPayload is the request body for submitting a new inspection.
type CreatePreTripInspectionPayload struct {
	VehicleUnit   string                           `json:"vehicleUnit"`
	VehicleID     int                              `json:"vehicleId"`
	VehiclePlate  string                           `json:"vehiclePlate,omitempty"`
	InspectionDate string                          `json:"inspectionDate"`
	InspectionTime string                          `json:"inspectionTime"`
	InspectorID   string                           `json:"inspectorId"`
	InspectorName string                           `json:"inspectorName"`
	Odometer      int                              `json:"odometer"`
	Items         map[string]PreTripInspectionItem `json:"items"`
	DefectNotes   string                           `json:"defectNotes,omitempty"`
	SignatureName string                           `json:"signatureName"`
}
