package models

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// RouteAssessment represents a school bus route safety assessment.
type RouteAssessment struct {
	ID                     string     `json:"id" firestore:"id"`
	AssessmentType         string     `json:"assessmentType" firestore:"assessmentType"` // "0" = New Route, "1" = Change in Route
	RouteID                string     `json:"routeId" firestore:"routeId"`
	SchoolBoardID          *int       `json:"schoolBoardId,omitempty" firestore:"schoolBoardId,omitempty"`
	SchoolBoard            string     `json:"schoolBoard,omitempty" firestore:"schoolBoard,omitempty"`
	SchoolID               *int       `json:"schoolId,omitempty" firestore:"schoolId,omitempty"`
	School                 string     `json:"school,omitempty" firestore:"school,omitempty"`
	SchoolYear             string     `json:"schoolYear,omitempty" firestore:"schoolYear,omitempty"`
	AssessmentDate         *time.Time `json:"assessmentDate,omitempty" firestore:"assessmentDate,omitempty"`
	ConductedByDriver      string     `json:"conductedByDriver" firestore:"conductedByDriver"`
	ConductedByOperator    string     `json:"conductedByOperator,omitempty" firestore:"conductedByOperator,omitempty"`
	ConductedByEmployeeID  string     `json:"conductedByEmployeeId,omitempty" firestore:"conductedByEmployeeId,omitempty"`
	DriverEmail            string     `json:"driverEmail,omitempty" firestore:"driverEmail,omitempty"`
	DriverPhone            string     `json:"driverPhone,omitempty" firestore:"driverPhone,omitempty"`
	Summary                string     `json:"summary,omitempty" firestore:"summary,omitempty"`

	// 11 Core Assessment Safety Checklist Questions
	// Q1: Visibility Problem
	VisibilityProblemCheck bool   `json:"visibilityProblemCheck" firestore:"visibilityProblemCheck"`
	VisibilityProblem      string `json:"visibilityProblem,omitempty" firestore:"visibilityProblem,omitempty"`

	// Q2: Highway Stop Concern
	HighwayStopConcernCheck bool   `json:"highwayStopConcernCheck" firestore:"highwayStopConcernCheck"`
	HighwayStopConcern      string `json:"highwayStopConcern,omitempty" firestore:"highwayStopConcern,omitempty"`

	// Q3: Location / Loading Problem
	LocationProblemCheck bool   `json:"locationProblemCheck" firestore:"locationProblemCheck"`
	LocationProblem      string `json:"locationProblem,omitempty" firestore:"locationProblem,omitempty"`

	// Q4: Unsafe Turnaround
	UnsafeTurnaroundCheck bool   `json:"unsafeTurnaroundCheck" firestore:"unsafeTurnaroundCheck"`
	UnsafeTurnaround      string `json:"unsafeTurnaround,omitempty" firestore:"unsafeTurnaround,omitempty"`

	// Q5: Intersection / Crossing
	IntersectionCheck bool   `json:"intersectionCheck" firestore:"intersectionCheck"`
	Intersection      string `json:"intersection,omitempty" firestore:"intersection,omitempty"`

	// Q6: Roadway Inadequacy
	RoadwayCheck bool   `json:"roadwayCheck" firestore:"roadwayCheck"`
	Roadway      string `json:"roadway,omitempty" firestore:"roadway,omitempty"`

	// Q7: Non-weather Variable Risk
	NonweatherRiskCheck bool   `json:"nonweatherRiskCheck" firestore:"nonweatherRiskCheck"`
	NonweatherRisk      string `json:"nonweatherRisk,omitempty" firestore:"nonweatherRisk,omitempty"`

	// Q8: Weather Variable Risk
	WeatherRiskCheck bool   `json:"weatherRiskCheck" firestore:"weatherRiskCheck"`
	WeatherRisk      string `json:"weatherRisk,omitempty" firestore:"weatherRisk,omitempty"`

	// Q9: Inclement Weather Policy & Adjustments
	CompanyPolicyCheck    bool   `json:"companyPolicyCheck" firestore:"companyPolicyCheck"`
	CompanyPolicyFamiliar bool   `json:"companyPolicyFamiliar" firestore:"companyPolicyFamiliar"`
	RouteAdjustCheck      bool   `json:"routeAdjustCheck" firestore:"routeAdjustCheck"`
	RouteAdjust           string `json:"routeAdjust,omitempty" firestore:"routeAdjust,omitempty"`

	// Q10: Safety Concern
	SafetyConcernCheck bool   `json:"safetyConcernCheck" firestore:"safetyConcernCheck"`
	SafetyConcern      string `json:"safetyConcern,omitempty" firestore:"safetyConcern,omitempty"`

	// Office Processing Section (as shown in reference UI)
	AssignedTo  string `json:"assignedTo,omitempty" firestore:"assignedTo,omitempty"`
	IsCompleted bool   `json:"isCompleted" firestore:"isCompleted"`
	IsSubmitted bool   `json:"isSubmitted" firestore:"isSubmitted"`

	// Working status: 0/1 = Working / In Review, 2 = Completed, 3 = Submitted
	StatusInt int    `json:"statusInt" firestore:"statusInt"`
	StatusStr string `json:"statusStr" firestore:"statusStr"`

	// Attachments (photos of stops, turns, or obstacles)
	AttachmentURLs []string  `json:"attachmentUrls,omitempty" firestore:"attachmentUrls,omitempty"`
	CreatedAt      time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt" firestore:"updatedAt"`
}

// CreateRouteAssessmentPayload is used when submitting a new route assessment.
type CreateRouteAssessmentPayload struct {
	AssessmentType        string     `json:"assessmentType"`
	RouteID               string     `json:"routeId"`
	SchoolBoardID         *int       `json:"schoolBoardId,omitempty"`
	SchoolBoard           string     `json:"schoolBoard,omitempty"`
	SchoolID              *int       `json:"schoolId,omitempty"`
	School                string     `json:"school,omitempty"`
	SchoolYear            string     `json:"schoolYear,omitempty"`
	AssessmentDate        *time.Time `json:"assessmentDate,omitempty"`
	ConductedByDriver     string     `json:"conductedByDriver"`
	ConductedByOperator   string     `json:"conductedByOperator,omitempty"`
	ConductedByEmployeeID string     `json:"conductedByEmployeeId,omitempty"`
	DriverEmail           string     `json:"driverEmail,omitempty"`
	DriverPhone           string     `json:"driverPhone,omitempty"`
	Summary               string     `json:"summary,omitempty"`

	VisibilityProblemCheck  bool   `json:"visibilityProblemCheck"`
	VisibilityProblem       string `json:"visibilityProblem,omitempty"`
	HighwayStopConcernCheck bool   `json:"highwayStopConcernCheck"`
	HighwayStopConcern      string `json:"highwayStopConcern,omitempty"`
	LocationProblemCheck    bool   `json:"locationProblemCheck"`
	LocationProblem         string `json:"locationProblem,omitempty"`
	UnsafeTurnaroundCheck   bool   `json:"unsafeTurnaroundCheck"`
	UnsafeTurnaround        string `json:"unsafeTurnaround,omitempty"`
	IntersectionCheck       bool   `json:"intersectionCheck"`
	Intersection            string `json:"intersection,omitempty"`
	RoadwayCheck            bool   `json:"roadwayCheck"`
	Roadway                 string `json:"roadway,omitempty"`
	NonweatherRiskCheck     bool   `json:"nonweatherRiskCheck"`
	NonweatherRisk          string `json:"nonweatherRisk,omitempty"`
	WeatherRiskCheck        bool   `json:"weatherRiskCheck"`
	WeatherRisk             string `json:"weatherRisk,omitempty"`
	CompanyPolicyCheck      bool   `json:"companyPolicyCheck"`
	CompanyPolicyFamiliar   bool   `json:"companyPolicyFamiliar"`
	RouteAdjustCheck        bool   `json:"routeAdjustCheck"`
	RouteAdjust             string `json:"routeAdjust,omitempty"`
	SafetyConcernCheck      bool   `json:"safetyConcernCheck"`
	SafetyConcern           string `json:"safetyConcern,omitempty"`

	AssignedTo     string   `json:"assignedTo,omitempty"`
	IsCompleted    bool     `json:"isCompleted"`
	IsSubmitted    bool     `json:"isSubmitted"`
	AttachmentURLs []string `json:"attachmentUrls,omitempty"`
}

// UpdateRouteAssessmentOfficePayload updates only the Office section (Assigned To, Completed, Submitted).
type UpdateRouteAssessmentOfficePayload struct {
	AssignedTo  *string `json:"assignedTo,omitempty"`
	IsCompleted *bool   `json:"isCompleted,omitempty"`
	IsSubmitted *bool   `json:"isSubmitted,omitempty"`
}

// UpdateRouteAssessmentPayload updates all editable fields.
type UpdateRouteAssessmentPayload struct {
	AssessmentType          *string    `json:"assessmentType,omitempty"`
	RouteID                 *string    `json:"routeId,omitempty"`
	SchoolBoard             *string    `json:"schoolBoard,omitempty"`
	School                  *string    `json:"school,omitempty"`
	SchoolYear              *string    `json:"schoolYear,omitempty"`
	AssessmentDate          *time.Time `json:"assessmentDate,omitempty"`
	Summary                 *string    `json:"summary,omitempty"`
	VisibilityProblemCheck  *bool      `json:"visibilityProblemCheck,omitempty"`
	VisibilityProblem       *string    `json:"visibilityProblem,omitempty"`
	HighwayStopConcernCheck *bool      `json:"highwayStopConcernCheck,omitempty"`
	HighwayStopConcern      *string    `json:"highwayStopConcern,omitempty"`
	LocationProblemCheck    *bool      `json:"locationProblemCheck,omitempty"`
	LocationProblem         *string    `json:"locationProblem,omitempty"`
	UnsafeTurnaroundCheck   *bool      `json:"unsafeTurnaroundCheck,omitempty"`
	UnsafeTurnaround        *string    `json:"unsafeTurnaround,omitempty"`
	IntersectionCheck       *bool      `json:"intersectionCheck,omitempty"`
	Intersection            *string    `json:"intersection,omitempty"`
	RoadwayCheck            *bool      `json:"roadwayCheck,omitempty"`
	Roadway                 *string    `json:"roadway,omitempty"`
	NonweatherRiskCheck     *bool      `json:"nonweatherRiskCheck,omitempty"`
	NonweatherRisk          *string    `json:"nonweatherRisk,omitempty"`
	WeatherRiskCheck        *bool      `json:"weatherRiskCheck,omitempty"`
	WeatherRisk             *string    `json:"weatherRisk,omitempty"`
	CompanyPolicyCheck      *bool      `json:"companyPolicyCheck,omitempty"`
	CompanyPolicyFamiliar   *bool      `json:"companyPolicyFamiliar,omitempty"`
	RouteAdjustCheck        *bool      `json:"routeAdjustCheck,omitempty"`
	RouteAdjust             *string    `json:"routeAdjust,omitempty"`
	SafetyConcernCheck      *bool      `json:"safetyConcernCheck,omitempty"`
	SafetyConcern           *string    `json:"safetyConcern,omitempty"`
	AssignedTo              *string    `json:"assignedTo,omitempty"`
	IsCompleted             *bool      `json:"isCompleted,omitempty"`
	IsSubmitted             *bool      `json:"isSubmitted,omitempty"`
	AttachmentURLs          []string   `json:"attachmentUrls,omitempty"`
}

// ParseFlexibleDate parses RFC3339, ISO8601 without timezone, date-only, and other formats.
func ParseFlexibleDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.999999999",
		"2006-01-02T15:04:05.999999",
		"2006-01-02T15:04:05.999",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unable to parse date %q", s)
}

func (p *CreateRouteAssessmentPayload) UnmarshalJSON(data []byte) error {
	type Alias CreateRouteAssessmentPayload
	aux := struct {
		RawAssessmentDate *string `json:"assessmentDate,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(p),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	if aux.RawAssessmentDate != nil && *aux.RawAssessmentDate != "" {
		parsed, err := ParseFlexibleDate(*aux.RawAssessmentDate)
		if err == nil {
			p.AssessmentDate = &parsed
		}
	}
	return nil
}

func (p *UpdateRouteAssessmentPayload) UnmarshalJSON(data []byte) error {
	type Alias UpdateRouteAssessmentPayload
	aux := struct {
		RawAssessmentDate *string `json:"assessmentDate,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(p),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	if aux.RawAssessmentDate != nil && *aux.RawAssessmentDate != "" {
		parsed, err := ParseFlexibleDate(*aux.RawAssessmentDate)
		if err == nil {
			p.AssessmentDate = &parsed
		}
	}
	return nil
}

