package models

// CalendarEventType defines categories of school calendar events
type CalendarEventType string

const (
	EventTypeHoliday     CalendarEventType = "holiday"      // Statutory / Public Holiday (Amber)
	EventTypePDDay       CalendarEventType = "pd_day"       // Professional Development / PA Day (Teal)
	EventTypeSchoolEvent CalendarEventType = "school_event" // School Milestone (First Day, Semester Start, Last Day)
	EventTypeExam        CalendarEventType = "exam"         // Secondary Examinations (Indigo)
	EventTypeBreak       CalendarEventType = "break"        // School Break (Christmas Break, March Break)
	EventTypeCustom      CalendarEventType = "custom"       // Custom School Event (Purple)
)

// CalendarEvent represents a single date or date-span entry in a school calendar
type CalendarEvent struct {
	ID          string            `json:"id" firestore:"id"`
	Title       string            `json:"title" firestore:"title"`
	Type        CalendarEventType `json:"type" firestore:"type"`
	StartDate   string            `json:"startDate" firestore:"startDate"` // YYYY-MM-DD
	EndDate     string            `json:"endDate,omitempty" firestore:"endDate,omitempty"` // YYYY-MM-DD (optional, if span)
	Grades      string            `json:"grades,omitempty" firestore:"grades,omitempty"`   // e.g. "All Grades", "Secondary", "Elementary", "K-6"
	Description string            `json:"description,omitempty" firestore:"description,omitempty"`
	IsBoardWide bool              `json:"isBoardWide,omitempty" firestore:"isBoardWide,omitempty"`
}

// SchoolCalendar is the operational aggregate document for school calendars
// Document ID format: "board_{boardId}_{schoolYear}" or "school_{schoolId}_{schoolYear}"
type SchoolCalendar struct {
	ID         string          `json:"id" firestore:"id"`
	Scope      string          `json:"scope" firestore:"scope"` // "board" or "school"
	BoardID    int             `json:"boardId" firestore:"boardId"`
	BoardCode  string          `json:"boardCode" firestore:"boardCode"` // e.g. "OCSB", "OCDSB"
	SchoolID   *int            `json:"schoolId,omitempty" firestore:"schoolId,omitempty"`
	SchoolName string          `json:"schoolName,omitempty" firestore:"schoolName,omitempty"`
	SchoolYear string          `json:"schoolYear" firestore:"schoolYear"` // e.g. "2026-2027"
	IsCustom   bool            `json:"isCustom" firestore:"isCustom"`     // true if customized for a specific school
	Events     []CalendarEvent `json:"events" firestore:"events"`
	CreatedAt  interface{}     `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt  interface{}     `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}
