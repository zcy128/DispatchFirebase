package models

import "time"

// HazardReport represents a hazard, safety concern, or near-miss report filed by a driver or crew member.
type HazardReport struct {
	ID                   string     `json:"id" firestore:"id"`
	ReportedBy           string     `json:"reportedBy" firestore:"reportedBy"`
	ReportedByEmployeeID string     `json:"reportedByEmployeeId,omitempty" firestore:"reportedByEmployeeId,omitempty"`
	PersonInvolved       string     `json:"personInvolved,omitempty" firestore:"personInvolved,omitempty"`
	UnitID               string     `json:"unitId,omitempty" firestore:"unitId,omitempty"`
	UnitNumber           string     `json:"unitNumber,omitempty" firestore:"unitNumber,omitempty"`
	RouteID              string     `json:"routeId,omitempty" firestore:"routeId,omitempty"`
	RouteName            string     `json:"routeName,omitempty" firestore:"routeName,omitempty"`
	Phone                string     `json:"phone,omitempty" firestore:"phone,omitempty"`
	Supervisor           string     `json:"supervisor,omitempty" firestore:"supervisor,omitempty"`
	EventTime            string     `json:"eventTime,omitempty" firestore:"eventTime,omitempty"` // YYYY-MM-DD HH:mm or ISO
	EventLocation        string     `json:"eventLocation,omitempty" firestore:"eventLocation,omitempty"`
	Witnesses            string     `json:"witnesses,omitempty" firestore:"witnesses,omitempty"`
	EventDescription     string     `json:"eventDescription" firestore:"eventDescription"`

	// Hazard Types (Booleans)
	TrippingHazard    bool `json:"trippingHazard" firestore:"trippingHazard"`
	TrafficHazard     bool `json:"trafficHazard" firestore:"trafficHazard"`
	EquipmentHazard   bool `json:"equipmentHazard" firestore:"equipmentHazard"`
	PerformanceHazard bool `json:"performanceHazard" firestore:"performanceHazard"`
	SnowHazard        bool `json:"snowHazard" firestore:"snowHazard"`
	SpillHazard       bool `json:"spillHazard" firestore:"spillHazard"`
	OtherHazard       bool `json:"otherHazard" firestore:"otherHazard"`

	// Close Call / Near Miss Types (Booleans)
	UnsafeAction      bool `json:"unsafeAction" firestore:"unsafeAction"`
	UnsafeCondition   bool `json:"unsafeCondition" firestore:"unsafeCondition"`
	HappenedtoMe      bool `json:"happenedtoMe" firestore:"happenedtoMe"`
	HappenedtoSomeone bool `json:"happenedtoSomeone" firestore:"happenedtoSomeone"`
	Ofanarea          bool `json:"ofanarea" firestore:"ofanarea"`
	OfEquipment       bool `json:"ofEquipment" firestore:"ofEquipment"`

	// Evaluation of Risk Potential (Health & Safety / Office)
	Moderate           bool       `json:"moderate" firestore:"moderate"`
	Serious            bool       `json:"serious" firestore:"serious"`
	Minor              bool       `json:"minor" firestore:"minor"`
	ProbableRecurrence bool       `json:"probableRecurrence" firestore:"probableRecurrence"`
	Occasional         bool       `json:"occasional" firestore:"occasional"`
	Rare               bool       `json:"rare" firestore:"rare"`
	Suggestion         string     `json:"suggestion,omitempty" firestore:"suggestion,omitempty"`
	ActionTaken        string     `json:"actionTaken,omitempty" firestore:"actionTaken,omitempty"`
	AssignedTo         string     `json:"assignedTo,omitempty" firestore:"assignedTo,omitempty"`
	IsCompleted        bool       `json:"isCompleted" firestore:"isCompleted"`
	OfficeHazardType   string     `json:"officeHazardType,omitempty" firestore:"officeHazardType,omitempty"`
	EmployeeIDError    string     `json:"employeeIdError,omitempty" firestore:"employeeIdError,omitempty"`
	EmployeeNameError  string     `json:"employeeNameError,omitempty" firestore:"employeeNameError,omitempty"`
	SafetySignedBy     string     `json:"safetySignedBy,omitempty" firestore:"safetySignedBy,omitempty"`
	SafetySignedDate   *time.Time `json:"safetySignedDate,omitempty" firestore:"safetySignedDate,omitempty"`

	// Status: 0 = Open, 1 = Under Investigation, 2 = Resolved
	StatusInt int    `json:"statusInt" firestore:"statusInt"`
	StatusStr string `json:"statusStr" firestore:"statusStr"`

	// Attachments (e.g. photos of scene, road condition, or damage)
	AttachmentURLs []string  `json:"attachmentUrls,omitempty" firestore:"attachmentUrls,omitempty"`
	CreatedAt      time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt" firestore:"updatedAt"`
}

// CreateHazardReportPayload is received when creating a hazard report.
type CreateHazardReportPayload struct {
	ReportedBy           string   `json:"reportedBy"`
	ReportedByEmployeeID string   `json:"reportedByEmployeeId,omitempty"`
	PersonInvolved       string   `json:"personInvolved,omitempty"`
	UnitID               string   `json:"unitId,omitempty"`
	UnitNumber           string   `json:"unitNumber,omitempty"`
	RouteID              string   `json:"routeId,omitempty"`
	RouteName            string   `json:"routeName,omitempty"`
	Phone                string   `json:"phone,omitempty"`
	Supervisor           string   `json:"supervisor,omitempty"`
	EventTime            string   `json:"eventTime,omitempty"`
	EventLocation        string   `json:"eventLocation,omitempty"`
	Witnesses            string   `json:"witnesses,omitempty"`
	EventDescription     string   `json:"eventDescription"`
	TrippingHazard       bool     `json:"trippingHazard"`
	TrafficHazard        bool     `json:"trafficHazard"`
	EquipmentHazard      bool     `json:"equipmentHazard"`
	PerformanceHazard    bool     `json:"performanceHazard"`
	SnowHazard           bool     `json:"snowHazard"`
	SpillHazard          bool     `json:"spillHazard"`
	OtherHazard          bool     `json:"otherHazard"`
	UnsafeAction         bool     `json:"unsafeAction"`
	UnsafeCondition      bool     `json:"unsafeCondition"`
	HappenedtoMe         bool     `json:"happenedtoMe"`
	HappenedtoSomeone    bool     `json:"happenedtoSomeone"`
	Ofanarea             bool     `json:"ofanarea"`
	OfEquipment          bool     `json:"ofEquipment"`
	Suggestion           string   `json:"suggestion,omitempty"`
	AttachmentURLs       []string `json:"attachmentUrls,omitempty"`
}

// UpdateHazardReportOfficePayload is received when Safety/Dispatch updates the office evaluation.
type UpdateHazardReportOfficePayload struct {
	Moderate           bool   `json:"moderate"`
	Serious            bool   `json:"serious"`
	Minor              bool   `json:"minor"`
	ProbableRecurrence bool   `json:"probableRecurrence"`
	Occasional         bool   `json:"occasional"`
	Rare               bool   `json:"rare"`
	Suggestion         string `json:"suggestion,omitempty"`
	ActionTaken        string `json:"actionTaken,omitempty"`
	AssignedTo         string `json:"assignedTo,omitempty"`
	IsCompleted        bool   `json:"isCompleted"`
	OfficeHazardType   string `json:"officeHazardType,omitempty"`
	EmployeeIDError    string `json:"employeeIdError,omitempty"`
	EmployeeNameError  string `json:"employeeNameError,omitempty"`
	SafetySignedBy     string `json:"safetySignedBy,omitempty"`
	StatusInt          int    `json:"statusInt"`
	StatusStr          string `json:"statusStr,omitempty"`
}
