package models

import "time"

// DefectItem represents an inspection point item in a vehicle defect report.
type DefectItem struct {
	ID       string `json:"id" firestore:"id"`
	Name     string `json:"name" firestore:"name"`
	Category string `json:"category" firestore:"category"` // e.g. "Daily Check" or "Periodic Check"
	// Status: "ok" | "defect" | "na" (or 0=OK, 1=Defect, 2=NA)
	Status string `json:"status" firestore:"status"`
	Notes  string `json:"notes,omitempty" firestore:"notes,omitempty"`
}

// DefectAssessment represents the fleet management review and repair dispatch details.
type DefectAssessment struct {
	AssessedBy              string    `json:"assessedBy,omitempty" firestore:"assessedBy,omitempty"`
	AssessedAt              *time.Time `json:"assessedAt,omitempty" firestore:"assessedAt,omitempty"`
	AssessmentNotes         string    `json:"assessmentNotes,omitempty" firestore:"assessmentNotes,omitempty"`
	RepairLocation          string    `json:"repairLocation,omitempty" firestore:"repairLocation,omitempty"`
	EstimatedRepairDays     int       `json:"estimatedRepairDays,omitempty" firestore:"estimatedRepairDays,omitempty"`
	EstimatedStartDate      string    `json:"estimatedStartDate,omitempty" firestore:"estimatedStartDate,omitempty"`
	EstimatedCompletionDate string    `json:"estimatedCompletionDate,omitempty" firestore:"estimatedCompletionDate,omitempty"`
	ActualCompletionDate    string    `json:"actualCompletionDate,omitempty" firestore:"actualCompletionDate,omitempty"`
	RepairCost              float64   `json:"repairCost,omitempty" firestore:"repairCost,omitempty"`
	MechanicNotes           string    `json:"mechanicNotes,omitempty" firestore:"mechanicNotes,omitempty"`
	ResolvedBy              string    `json:"resolvedBy,omitempty" firestore:"resolvedBy,omitempty"`
	ResolvedAt              *time.Time `json:"resolvedAt,omitempty" firestore:"resolvedAt,omitempty"`
}

// VehicleDefectReport represents a defect report submitted by a driver and handled by fleet operations.
type VehicleDefectReport struct {
	ID                string            `json:"id" firestore:"id"`
	VehicleID         int               `json:"vehicleId" firestore:"vehicleId"`
	VehicleUnitNumber string            `json:"vehicleUnitNumber" firestore:"vehicleUnitNumber"`
	Odometer          int               `json:"odometer" firestore:"odometer"`
	ReportedByUserID  string            `json:"reportedByUserId" firestore:"reportedByUserId"`
	ReportedByName    string            `json:"reportedByName" firestore:"reportedByName"`
	ReportDate        string            `json:"reportDate" firestore:"reportDate"` // YYYY-MM-DD
	ReportTime        string            `json:"reportTime" firestore:"reportTime"` // HH:mm
	Items             []DefectItem      `json:"items" firestore:"items"`
	DefectNotes       string            `json:"defectNotes,omitempty" firestore:"defectNotes,omitempty"`
	NoDefectsFound    bool              `json:"noDefectsFound" firestore:"noDefectsFound"`
	ConfirmedAccurate bool              `json:"confirmedAccurate" firestore:"confirmedAccurate"`
	// Status: "submitted" | "under_assessment" | "under_repair" | "resolved"
	Status     string            `json:"status" firestore:"status"`
	Assessment *DefectAssessment `json:"assessment,omitempty" firestore:"assessment,omitempty"`
	CreatedAt  time.Time         `json:"createdAt" firestore:"createdAt"`
	UpdatedAt  time.Time         `json:"updatedAt" firestore:"updatedAt"`
}

// CreateDefectReportPayload is the request payload from the driver app.
type CreateDefectReportPayload struct {
	VehicleID         int          `json:"vehicleId"`
	VehicleUnitNumber string       `json:"vehicleUnitNumber"`
	Odometer          int          `json:"odometer"`
	ReportedByUserID  string       `json:"reportedByUserId"`
	ReportedByName    string       `json:"reportedByName"`
	ReportDate        string       `json:"reportDate"`
	ReportTime        string       `json:"reportTime"`
	Items             []DefectItem `json:"items"`
	DefectNotes       string       `json:"defectNotes,omitempty"`
	NoDefectsFound    bool         `json:"noDefectsFound"`
	ConfirmedAccurate bool         `json:"confirmedAccurate"`
}

// UpdateDefectAssessmentPayload is the request payload from dispatch fleet management.
type UpdateDefectAssessmentPayload struct {
	Status                  string   `json:"status"` // e.g. "under_assessment", "under_repair", "resolved"
	AssessedBy              string   `json:"assessedBy"`
	AssessmentNotes         string   `json:"assessmentNotes,omitempty"`
	RepairLocation          string   `json:"repairLocation,omitempty"`
	EstimatedRepairDays     int      `json:"estimatedRepairDays,omitempty"`
	EstimatedStartDate      string   `json:"estimatedStartDate,omitempty"`
	EstimatedCompletionDate string   `json:"estimatedCompletionDate,omitempty"`
	ActualCompletionDate    string   `json:"actualCompletionDate,omitempty"`
	RepairCost              float64  `json:"repairCost,omitempty"`
	MechanicNotes           string   `json:"mechanicNotes,omitempty"`
	ResolvedBy              string   `json:"resolvedBy,omitempty"`
}
