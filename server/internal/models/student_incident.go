package models

import "time"

// IncidentOfficeFollowUp represents office administration follow-up and disciplinary actions taken.
type IncidentOfficeFollowUp struct {
	ReviewedDate         string     `json:"reviewedDate,omitempty" firestore:"reviewedDate,omitempty"`
	AdministratorName    string     `json:"administratorName,omitempty" firestore:"administratorName,omitempty"`
	DisciplinaryActions  []string   `json:"disciplinaryActions,omitempty" firestore:"disciplinaryActions,omitempty"`
	DisciplinaryOther    string     `json:"disciplinaryOther,omitempty" firestore:"disciplinaryOther,omitempty"`
	OfficeNotes          string     `json:"officeNotes,omitempty" firestore:"officeNotes,omitempty"`
	IsOfficeLocked       bool       `json:"isOfficeLocked" firestore:"isOfficeLocked"`
	ReviewedAt           *time.Time `json:"reviewedAt,omitempty" firestore:"reviewedAt,omitempty"`
}

// StudentIncident represents an incident report filed by a school bus driver regarding student behavior or safety.
type StudentIncident struct {
	ID                         string                  `json:"id" firestore:"id"`
	IncidentDate               string                  `json:"incidentDate" firestore:"incidentDate"` // YYYY-MM-DD
	IncidentTime               string                  `json:"incidentTime" firestore:"incidentTime"` // HH:mm
	StudentID                  int                     `json:"studentId,omitempty" firestore:"studentId,omitempty"`
	StudentNo                  string                  `json:"studentNo,omitempty" firestore:"studentNo,omitempty"`
	StudentName                string                  `json:"studentName" firestore:"studentName"`
	Grade                      string                  `json:"grade,omitempty" firestore:"grade,omitempty"`
	SchoolID                   int                     `json:"schoolId,omitempty" firestore:"schoolId,omitempty"`
	SchoolName                 string                  `json:"schoolName,omitempty" firestore:"schoolName,omitempty"`
	RouteID                    int                     `json:"routeId,omitempty" firestore:"routeId,omitempty"`
	RouteNo                    string                  `json:"routeNo" firestore:"routeNo"`
	RouteName                  string                  `json:"routeName,omitempty" firestore:"routeName,omitempty"`
	ShiftType                  string                  `json:"shiftType,omitempty" firestore:"shiftType,omitempty"`
	DriverID                   string                  `json:"driverId" firestore:"driverId"`
	DriverName                 string                  `json:"driverName" firestore:"driverName"`
	Location                   string                  `json:"location" firestore:"location"`
	IncidentTypes              []string                `json:"incidentTypes" firestore:"incidentTypes"`
	TypeOther                  string                  `json:"typeOther,omitempty" firestore:"typeOther,omitempty"`
	Description                string                  `json:"description" firestore:"description"`
	OtherStudentsInvolved      string                  `json:"otherStudentsInvolved,omitempty" firestore:"otherStudentsInvolved,omitempty"`
	Witnesses                  string                  `json:"witnesses,omitempty" firestore:"witnesses,omitempty"`
	ImmediateActionTaken       string                  `json:"immediateActionTaken,omitempty" firestore:"immediateActionTaken,omitempty"`
	StudentRemovedFromBus      bool                    `json:"studentRemovedFromBus" firestore:"studentRemovedFromBus"`
	FirstAidRequired           bool                    `json:"firstAidRequired" firestore:"firstAidRequired"`
	ParentsNotified            bool                    `json:"parentsNotified" firestore:"parentsNotified"`
	ParentsNotificationDetail string                  `json:"parentsNotificationDetail,omitempty" firestore:"parentsNotificationDetail,omitempty"`
	// Status: "submitted" | "under_investigation" | "parent_contacted" | "school_notified" | "closed"
	Status                     string                  `json:"status" firestore:"status"`
	OfficeFollowUp             *IncidentOfficeFollowUp `json:"officeFollowUp,omitempty" firestore:"officeFollowUp,omitempty"`
	CreatedAt                  time.Time               `json:"createdAt" firestore:"createdAt"`
	UpdatedAt                  time.Time               `json:"updatedAt" firestore:"updatedAt"`
}

// CreateStudentIncidentPayload is the request payload received when creating a student incident report.
type CreateStudentIncidentPayload struct {
	IncidentDate               string   `json:"incidentDate"`
	IncidentTime               string   `json:"incidentTime"`
	StudentID                  int      `json:"studentId,omitempty"`
	StudentNo                  string   `json:"studentNo,omitempty"`
	StudentName                string   `json:"studentName"`
	Grade                      string   `json:"grade,omitempty"`
	SchoolID                   int      `json:"schoolId,omitempty"`
	SchoolName                 string   `json:"schoolName,omitempty"`
	RouteID                    int      `json:"routeId,omitempty"`
	RouteNo                    string   `json:"routeNo"`
	RouteName                  string   `json:"routeName,omitempty"`
	ShiftType                  string   `json:"shiftType,omitempty"`
	DriverID                   string   `json:"driverId"`
	DriverName                 string   `json:"driverName"`
	Location                   string   `json:"location"`
	IncidentTypes              []string `json:"incidentTypes"`
	TypeOther                  string   `json:"typeOther,omitempty"`
	Description                string   `json:"description"`
	OtherStudentsInvolved      string   `json:"otherStudentsInvolved,omitempty"`
	Witnesses                  string   `json:"witnesses,omitempty"`
	ImmediateActionTaken       string   `json:"immediateActionTaken,omitempty"`
	StudentRemovedFromBus      bool     `json:"studentRemovedFromBus"`
	FirstAidRequired           bool     `json:"firstAidRequired"`
	ParentsNotified            bool     `json:"parentsNotified"`
	ParentsNotificationDetail string   `json:"parentsNotificationDetail,omitempty"`
}

// UpdateIncidentOfficeFollowUpPayload is the request payload for office administrative follow-up.
type UpdateIncidentOfficeFollowUpPayload struct {
	ReviewedDate        string   `json:"reviewedDate"`
	AdministratorName   string   `json:"administratorName"`
	DisciplinaryActions []string `json:"disciplinaryActions"`
	DisciplinaryOther   string   `json:"disciplinaryOther,omitempty"`
	OfficeNotes         string   `json:"officeNotes,omitempty"`
	IsOfficeLocked      bool     `json:"isOfficeLocked"`
	Status              string   `json:"status,omitempty"` // e.g. "under_investigation", "parent_contacted", "school_notified", "closed"
}

// UpdateStudentIncidentStatusPayload is used to quickly change incident status.
type UpdateStudentIncidentStatusPayload struct {
	Status string `json:"status"`
}
