package models

import (
	"time"
)

// SchoolBoard represents school_board table from SchoolModel.cs
type SchoolBoard struct {
	ID              string `json:"id,omitempty" firestore:"id,omitempty"`
	SchoolBoardID   int    `json:"schoolBoardId" firestore:"schoolBoardId"`
	SchoolBoardName string `json:"schoolBoardName" firestore:"schoolBoardName"`
	SchoolBoardCode string `json:"schoolBoardCode" firestore:"schoolBoardCode"`
}

// School represents school table from SchoolModel.cs
type School struct {
	ID                     string       `json:"id" firestore:"id"`                                     // SCH-{SchoolId}
	SchoolID               int          `json:"schoolId" firestore:"schoolId"`
	SchoolName             string       `json:"schoolName" firestore:"schoolName"`
	SchoolAddress          string       `json:"schoolAddress" firestore:"schoolAddress"`
	SchoolPhone            string       `json:"schoolPhone,omitempty" firestore:"schoolPhone,omitempty"`
	SchoolFax              string       `json:"schoolFax,omitempty" firestore:"schoolFax,omitempty"`
	GpsLatitude            *float64     `json:"gpsLatitude,omitempty" firestore:"gpsLatitude,omitempty"`
	GpsLongitude           *float64     `json:"gpsLongitude,omitempty" firestore:"gpsLongitude,omitempty"`
	StartTime              string       `json:"startTime,omitempty" firestore:"startTime,omitempty"`       // e.g. "08:30"
	DismissalTime          string       `json:"dismissalTime,omitempty" firestore:"dismissalTime,omitempty"` // e.g. "15:00"
	EarlyDismissalDay      string       `json:"earlyDismissalDay,omitempty" firestore:"earlyDismissalDay,omitempty"`
	EarlyDismissalTime     string       `json:"earlyDismissalTime,omitempty" firestore:"earlyDismissalTime,omitempty"`
	ContactPerson          string       `json:"contactPerson,omitempty" firestore:"contactPerson,omitempty"`
	ContactPersonCellPhone string       `json:"contactPersonCellPhone,omitempty" firestore:"contactPersonCellPhone,omitempty"`
	ContactPersonEmail     string       `json:"contactPersonEmail,omitempty" firestore:"contactPersonEmail,omitempty"`
	SchoolNotes            string       `json:"schoolNotes,omitempty" firestore:"schoolNotes,omitempty"`
	ParkingNotes           string       `json:"parkingNotes,omitempty" firestore:"parkingNotes,omitempty"`
	SchoolBoardID          int          `json:"schoolBoardId" firestore:"schoolBoardId"`
	SchoolBoardName        string       `json:"schoolBoardName,omitempty" firestore:"schoolBoardName,omitempty"`
	SchoolBoardCode        string       `json:"schoolBoardCode,omitempty" firestore:"schoolBoardCode,omitempty"`
	IsActive               bool         `json:"isActive" firestore:"isActive"`
	StudentNum             int          `json:"studentNum" firestore:"studentNum"`
	Routes                 string       `json:"routes,omitempty" firestore:"routes,omitempty"`
	YardID                 *int         `json:"yardId,omitempty" firestore:"yardId,omitempty"`
	CreatedAt              time.Time    `json:"createdAt" firestore:"createdAt"`
	UpdatedAt              time.Time    `json:"updatedAt" firestore:"updatedAt"`
}
