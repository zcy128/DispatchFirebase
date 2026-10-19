package models

import (
	"strings"
	"time"
)

// StudentContact represents student_contact table from StudentModel.cs
type StudentContact struct {
	ContactID      string `json:"contactId" firestore:"contactId"`
	StudentID      int    `json:"studentId" firestore:"studentId"`
	ContactIndex   int    `json:"contactIndex" firestore:"contactIndex"`
	PrimaryContact bool   `json:"primaryContact" firestore:"primaryContact"`
	ContactName    string `json:"contactName" firestore:"contactName"`
	Relationship   string `json:"relationship,omitempty" firestore:"relationship,omitempty"`
	MobilePhone    string `json:"mobilePhone,omitempty" firestore:"mobilePhone,omitempty"`
	HomePhone      string `json:"homePhone,omitempty" firestore:"homePhone,omitempty"`
	WorkPhone      string `json:"workPhone,omitempty" firestore:"workPhone,omitempty"`
	Address        string `json:"address,omitempty" firestore:"address,omitempty"`
	Email          string `json:"email,omitempty" firestore:"email,omitempty"`
	Active         bool   `json:"active" firestore:"active"`
}

// StudentStop represents an assigned route stop for the student
type StudentStop struct {
	StopID      string `json:"stopId,omitempty" firestore:"stopId,omitempty"`
	Time        string `json:"time" firestore:"time"`
	Type        string `json:"type" firestore:"type"`
	OpDays      string `json:"opDays" firestore:"opDays"`
	Location    string   `json:"location" firestore:"location"`
	Latitude    *float64 `json:"latitude,omitempty" firestore:"latitude,omitempty"`
	Longitude   *float64 `json:"longitude,omitempty" firestore:"longitude,omitempty"`
	Comment     string   `json:"comment,omitempty" firestore:"comment,omitempty"`
	Instruction string `json:"instruction,omitempty" firestore:"instruction,omitempty"`
	Route       string `json:"route,omitempty" firestore:"route,omitempty"`
	Shift       string `json:"shift,omitempty" firestore:"shift,omitempty"`
}

// Student represents student table from StudentModel.cs
type Student struct {
	ID                      string           `json:"id" firestore:"id"`                                     // STU-{StudentNo}
	StudentID               int              `json:"studentId" firestore:"studentId"`                       // MySQL ID
	StudentNo               string           `json:"studentNo" firestore:"studentNo"`
	FirstName               string           `json:"firstName" firestore:"firstName"`
	LastName                string           `json:"lastName" firestore:"lastName"`
	StudentName             string           `json:"studentName" firestore:"studentName"`                   // FirstName + LastName
	FullName                string           `json:"fullName" firestore:"fullName"`                         // FirstName + LastName + (* if MetatBus)
	StudentAddress          string           `json:"studentAddress" firestore:"studentAddress"`
	StudentPhone            string           `json:"studentPhone,omitempty" firestore:"studentPhone,omitempty"`
	Gender                  string           `json:"gender,omitempty" firestore:"gender,omitempty"`
	BirthDate               *time.Time       `json:"birthDate,omitempty" firestore:"birthDate,omitempty"`
	Grade                   string           `json:"grade" firestore:"grade"`                               // JK, SK, 1 ~ 8
	Active                  bool             `json:"active" firestore:"active"`
	MetatBus                bool             `json:"metatBus" firestore:"metatBus"`                         // Requires adult/staff greeting at bus
	StudentEmergencyAddress string           `json:"studentEmergencyAddress,omitempty" firestore:"studentEmergencyAddress,omitempty"`
	StudentEmergencyPhone   string           `json:"studentEmergencyPhone,omitempty" firestore:"studentEmergencyPhone,omitempty"`
	StudentDispatchNotes    string           `json:"studentDispatchNotes,omitempty" firestore:"studentDispatchNotes,omitempty"`
	StudentSchoolNotes      string           `json:"studentSchoolNotes,omitempty" firestore:"studentSchoolNotes,omitempty"`
	Equipments              string           `json:"equipments,omitempty" firestore:"equipments,omitempty"`
	SchoolID                int              `json:"schoolId" firestore:"schoolId"`
	SchoolName              string           `json:"schoolName" firestore:"schoolName"`                     // Denormalized name for direct list search
	Routes                  string           `json:"routes,omitempty" firestore:"routes,omitempty"`         // Comma-separated assigned route numbers
	Contacts                []StudentContact `json:"contacts,omitempty" firestore:"contacts,omitempty"`
	Stops                   []StudentStop    `json:"stops,omitempty" firestore:"stops,omitempty"`
	CreatedAt               interface{}      `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt               interface{}      `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// ComputeComputedFields computes StudentName and FullName
func (s *Student) ComputeComputedFields() {
	first := strings.TrimSpace(s.FirstName)
	last := strings.TrimSpace(s.LastName)
	s.StudentName = strings.TrimSpace(first + " " + last)
	if s.MetatBus {
		s.FullName = s.StudentName + "*"
	} else {
		s.FullName = s.StudentName
	}
}
