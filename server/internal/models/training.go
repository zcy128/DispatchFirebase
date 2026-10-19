package models

import "time"

// TrainingCourseStatus represents the lifecycle of a training session
type TrainingCourseStatus string

const (
	TrainingCourseStatusDraft     TrainingCourseStatus = "draft"
	TrainingCourseStatusPublished TrainingCourseStatus = "published"
	TrainingCourseStatusCompleted TrainingCourseStatus = "completed"
	TrainingCourseStatusCancelled TrainingCourseStatus = "cancelled"
)

// TrainingRegistrationStatus represents an attendee's status
type TrainingRegistrationStatus string

const (
	TrainingRegistrationStatusRegistered       TrainingRegistrationStatus = "registered"
	TrainingRegistrationStatusCheckedIn        TrainingRegistrationStatus = "checked_in"
	TrainingRegistrationStatusCompleted        TrainingRegistrationStatus = "completed"
	TrainingRegistrationStatusCancelledByUser  TrainingRegistrationStatus = "cancelled_by_user"
	TrainingRegistrationStatusCancelledByAdmin TrainingRegistrationStatus = "cancelled_by_office"
	TrainingRegistrationStatusNoShow           TrainingRegistrationStatus = "no_show"
)

// TrainingType represents a curriculum category (e.g. Defensive Driving, First Aid)
type TrainingType struct {
	ID               string    `json:"id" firestore:"id"`
	Code             string    `json:"code" firestore:"code"`
	Name             string    `json:"name" firestore:"name"`
	Category         string    `json:"category" firestore:"category"` // safety, compliance, first_aid, operations, technical
	DefaultHours     float64   `json:"defaultHours" firestore:"defaultHours"`
	DefaultPayAmount float64   `json:"defaultPayAmount" firestore:"defaultPayAmount"`
	ValidityMonths   int       `json:"validityMonths" firestore:"validityMonths"`
	RequiredForRoles []string  `json:"requiredForRoles" firestore:"requiredForRoles"`
	Description      string    `json:"description,omitempty" firestore:"description,omitempty"`
	IsActive         bool      `json:"isActive" firestore:"isActive"`
	CreatedAt        time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt" firestore:"updatedAt"`
}

// TrainingRegistration represents an enrolled staff member in a training session
type TrainingRegistration struct {
	ID             string                     `json:"id" firestore:"id"`
	CourseID       string                     `json:"courseId" firestore:"courseId"`
	EmployeeID     string                     `json:"employeeId" firestore:"employeeId"`
	EmployeeName   string                     `json:"employeeName" firestore:"employeeName"`
	EmployeeNumber string                     `json:"employeeNumber,omitempty" firestore:"employeeNumber,omitempty"`
	JobTitle       string                     `json:"jobTitle,omitempty" firestore:"jobTitle,omitempty"`
	Status         TrainingRegistrationStatus `json:"status" firestore:"status"`
	RegisteredAt   time.Time                  `json:"registeredAt" firestore:"registeredAt"`
	CheckedInAt    *time.Time                 `json:"checkedInAt,omitempty" firestore:"checkedInAt,omitempty"`
	CompletedAt    *time.Time                 `json:"completedAt,omitempty" firestore:"completedAt,omitempty"`
	Passed         *bool                      `json:"passed,omitempty" firestore:"passed,omitempty"`
	Score          *float64                   `json:"score,omitempty" firestore:"score,omitempty"`
	Notes          string                     `json:"notes,omitempty" firestore:"notes,omitempty"`
}

// TrainingCourse represents a scheduled training session
type TrainingCourse struct {
	ID               string                 `json:"id" firestore:"id"` // TC-{timestamp}
	Title            string                 `json:"title" firestore:"title"`
	TrainingTypeID   string                 `json:"trainingTypeId" firestore:"trainingTypeId"`
	TrainingTypeName string                 `json:"trainingTypeName" firestore:"trainingTypeName"`
	InstructorName   string                 `json:"instructorName" firestore:"instructorName"`
	Location         string                 `json:"location" firestore:"location"`
	YardID           string                 `json:"yardId,omitempty" firestore:"yardId,omitempty"`
	YardName         string                 `json:"yardName,omitempty" firestore:"yardName,omitempty"`
	StartDate        string                 `json:"startDate" firestore:"startDate"` // YYYY-MM-DD
	StartTime        string                 `json:"startTime" firestore:"startTime"` // HH:mm
	EndTime          string                 `json:"endTime" firestore:"endTime"`     // HH:mm
	Hours            float64                `json:"hours" firestore:"hours"`
	PayAmount        float64                `json:"payAmount" firestore:"payAmount"`
	MaxSeats         int                    `json:"maxSeats" firestore:"maxSeats"`
	RegisteredCount  int                    `json:"registeredCount" firestore:"registeredCount"`
	Status           TrainingCourseStatus   `json:"status" firestore:"status"`
	EligibleRoles    []string               `json:"eligibleRoles" firestore:"eligibleRoles"`
	Description      string                 `json:"description,omitempty" firestore:"description,omitempty"`
	Registrations    []TrainingRegistration `json:"registrations" firestore:"registrations"`
	CreatedByUserID  string                 `json:"createdByUserId,omitempty" firestore:"createdByUserId,omitempty"`
	CreatedByName    string                 `json:"createdByName,omitempty" firestore:"createdByName,omitempty"`
	CreatedAt        time.Time              `json:"createdAt" firestore:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt" firestore:"updatedAt"`
}

// CreateTrainingCoursePayload contains fields to schedule a new course
type CreateTrainingCoursePayload struct {
	Title            string   `json:"title"`
	TrainingTypeID   string   `json:"trainingTypeId"`
	TrainingTypeName string   `json:"trainingTypeName"`
	InstructorName   string   `json:"instructorName"`
	Location         string   `json:"location"`
	YardID           string   `json:"yardId,omitempty"`
	YardName         string   `json:"yardName,omitempty"`
	StartDate        string   `json:"startDate"`
	StartTime        string   `json:"startTime"`
	EndTime          string   `json:"endTime"`
	Hours            float64  `json:"hours"`
	PayAmount        float64  `json:"payAmount"`
	MaxSeats         int      `json:"maxSeats"`
	EligibleRoles    []string `json:"eligibleRoles"`
	Description      string   `json:"description,omitempty"`
	CreatedByUserID  string   `json:"createdByUserId,omitempty"`
	CreatedByName    string   `json:"createdByName,omitempty"`
	Status           string   `json:"status,omitempty"` // default draft, or published
}

// UpdateTrainingCoursePayload contains fields to update a course
type UpdateTrainingCoursePayload struct {
	Title            string   `json:"title,omitempty"`
	TrainingTypeID   string   `json:"trainingTypeId,omitempty"`
	TrainingTypeName string   `json:"trainingTypeName,omitempty"`
	InstructorName   string   `json:"instructorName,omitempty"`
	Location         string   `json:"location,omitempty"`
	YardID           string   `json:"yardId,omitempty"`
	YardName         string   `json:"yardName,omitempty"`
	StartDate        string   `json:"startDate,omitempty"`
	StartTime        string   `json:"startTime,omitempty"`
	EndTime          string   `json:"endTime,omitempty"`
	Hours            *float64 `json:"hours,omitempty"`
	PayAmount        *float64 `json:"payAmount,omitempty"`
	MaxSeats         *int     `json:"maxSeats,omitempty"`
	EligibleRoles    []string `json:"eligibleRoles,omitempty"`
	Description      string   `json:"description,omitempty"`
	Status           string   `json:"status,omitempty"`
}

// RegisterAttendeePayload contains info to register an employee
type RegisterAttendeePayload struct {
	EmployeeID     string `json:"employeeId"`
	EmployeeName   string `json:"employeeName"`
	EmployeeNumber string `json:"employeeNumber,omitempty"`
	JobTitle       string `json:"jobTitle,omitempty"`
	Notes          string `json:"notes,omitempty"`
}

// UpdateAttendeeStatusPayload contains fields to update registration state (check-in, score, etc.)
type UpdateAttendeeStatusPayload struct {
	Status string   `json:"status"` // checked_in, completed, no_show, cancelled_by_office
	Passed *bool    `json:"passed,omitempty"`
	Score  *float64 `json:"score,omitempty"`
	Notes  string   `json:"notes,omitempty"`
}
