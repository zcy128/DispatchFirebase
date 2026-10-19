package repository

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
)

type CalendarRepository interface {
	GetCalendar(ctx context.Context, scope string, boardID int, schoolID *int, year string) (*models.SchoolCalendar, error)
	SaveCalendar(ctx context.Context, cal *models.SchoolCalendar) (*models.SchoolCalendar, error)
	DeleteSchoolCalendar(ctx context.Context, schoolID int, year string) error
	ListCalendars(ctx context.Context, year string) ([]*models.SchoolCalendar, error)
}

// GenerateDefaultOCSB2026Events produces the baseline events matching https://www.ocsb.ca/parents/calendar/
func GenerateDefaultOCSB2026Events() []models.CalendarEvent {
	return []models.CalendarEvent{
		{
			ID:          "EVT-2026-08-31",
			Title:       "PD Day – All Grades",
			Type:        models.EventTypePDDay,
			StartDate:   "2026-08-31",
			Grades:      "All Grades",
			Description: "Professional Development Day for staff. No classes for students.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2026-09-01",
			Title:       "First Day of School for Students",
			Type:        models.EventTypeSchoolEvent,
			StartDate:   "2026-09-01",
			Grades:      "All Grades",
			Description: "Welcome back to school! Kindergarten gradual entry schedule applies.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2026-09-07",
			Title:       "Labour Day",
			Type:        models.EventTypeHoliday,
			StartDate:   "2026-09-07",
			Grades:      "All Grades",
			Description: "Statutory Holiday. Schools and board offices closed.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2026-10-02",
			Title:       "PD Day – All Grades",
			Type:        models.EventTypePDDay,
			StartDate:   "2026-10-02",
			Grades:      "All Grades",
			Description: "Professional Development Day for teachers and staff.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2026-10-12",
			Title:       "Thanksgiving Day",
			Type:        models.EventTypeHoliday,
			StartDate:   "2026-10-12",
			Grades:      "All Grades",
			Description: "Statutory Holiday. Schools and offices closed.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2026-11-20",
			Title:       "PD Day – All Grades",
			Type:        models.EventTypePDDay,
			StartDate:   "2026-11-20",
			Grades:      "All Grades",
			Description: "Reporting & Parent-Teacher Interview Preparation.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2026-12-21",
			Title:       "Christmas Break",
			Type:        models.EventTypeBreak,
			StartDate:   "2026-12-21",
			EndDate:     "2027-01-01",
			Grades:      "All Grades",
			Description: "Winter Holiday Break across all elementary and secondary schools.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-01-04",
			Title:       "First Day of School after Christmas Break",
			Type:        models.EventTypeSchoolEvent,
			StartDate:   "2027-01-04",
			Grades:      "All Grades",
			Description: "Classes resume for all students.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-01-21",
			Title:       "First Semester Examinations (Secondary)",
			Type:        models.EventTypeExam,
			StartDate:   "2027-01-21",
			EndDate:     "2027-01-27",
			Grades:      "Secondary (9-12)",
			Description: "January 21, 22, 25, 26 & 27, 2027 exams.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-01-29",
			Title:       "PD Day – All Grades",
			Type:        models.EventTypePDDay,
			StartDate:   "2027-01-29",
			Grades:      "All Grades",
			Description: "Turnaround day between Semester 1 and Semester 2.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-02-01",
			Title:       "First Day of Semester 2 (Secondary)",
			Type:        models.EventTypeSchoolEvent,
			StartDate:   "2027-02-01",
			Grades:      "Secondary (9-12)",
			Description: "Semester 2 courses begin for secondary students.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-02-15",
			Title:       "Family Day",
			Type:        models.EventTypeHoliday,
			StartDate:   "2027-02-15",
			Grades:      "All Grades",
			Description: "Provincial Statutory Holiday. Schools closed.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-03-15",
			Title:       "March Break",
			Type:        models.EventTypeBreak,
			StartDate:   "2027-03-15",
			EndDate:     "2027-03-19",
			Grades:      "All Grades",
			Description: "Ontario Spring Break for all students and school staff.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-03-22",
			Title:       "First Day of School after March Break",
			Type:        models.EventTypeSchoolEvent,
			StartDate:   "2027-03-22",
			Grades:      "All Grades",
			Description: "Classes resume following spring break.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-03-26",
			Title:       "Good Friday",
			Type:        models.EventTypeHoliday,
			StartDate:   "2027-03-26",
			Grades:      "All Grades",
			Description: "Statutory Holiday. Schools closed.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-03-29",
			Title:       "Easter Monday",
			Type:        models.EventTypeHoliday,
			StartDate:   "2027-03-29",
			Grades:      "All Grades",
			Description: "Board Holiday. Schools closed.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-04-23",
			Title:       "PD Day – All Grades",
			Type:        models.EventTypePDDay,
			StartDate:   "2027-04-23",
			Grades:      "All Grades",
			Description: "Staff professional learning and development.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-05-24",
			Title:       "Victoria Day",
			Type:        models.EventTypeHoliday,
			StartDate:   "2027-05-24",
			Grades:      "All Grades",
			Description: "Statutory Holiday. Schools and offices closed.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-06-04",
			Title:       "PD Day – All Grades",
			Type:        models.EventTypePDDay,
			StartDate:   "2027-06-04",
			Grades:      "All Grades",
			Description: "Elementary report card writing and secondary assessment.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-06-17",
			Title:       "Second Semester Examinations (Secondary)",
			Type:        models.EventTypeExam,
			StartDate:   "2027-06-17",
			EndDate:     "2027-06-23",
			Grades:      "Secondary (9-12)",
			Description: "June 17, 18, 21, 22 & 23, 2027 final exams.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-06-24",
			Title:       "Last Day of School for Students",
			Type:        models.EventTypeSchoolEvent,
			StartDate:   "2027-06-24",
			Grades:      "All Grades",
			Description: "Official final instructional day of the school year.",
			IsBoardWide: true,
		},
		{
			ID:          "EVT-2027-06-25",
			Title:       "PD Day – All Grades",
			Type:        models.EventTypePDDay,
			StartDate:   "2027-06-25",
			Grades:      "All Grades",
			Description: "Year-end administrative turnaround day for staff.",
			IsBoardWide: true,
		},
	}
}

// FirestoreCalendarRepository implements CalendarRepository with Firestore
type FirestoreCalendarRepository struct {
	client *firestore.Client
	coll   string
}

func NewFirestoreCalendarRepository(client *firestore.Client) *FirestoreCalendarRepository {
	return &FirestoreCalendarRepository{
		client: client,
		coll:   "school_calendars",
	}
}

func (r *FirestoreCalendarRepository) GetCalendar(ctx context.Context, scope string, boardID int, schoolID *int, year string) (*models.SchoolCalendar, error) {
	if year == "" {
		year = "2026-2027"
	}

	// 1. If requesting for a specific school, check if a custom calendar exists
	if scope == "school" && schoolID != nil && *schoolID > 0 {
		customDocID := fmt.Sprintf("school_%d_%s", *schoolID, year)
		doc, err := r.client.Collection(r.coll).Doc(customDocID).Get(ctx)
		if err == nil && doc.Exists() {
			var cal models.SchoolCalendar
			if err := doc.DataTo(&cal); err == nil {
				cal.ID = doc.Ref.ID
				cal.IsCustom = true
				return &cal, nil
			}
		}
		// No custom calendar found for school: fall through to board calendar
	}

	// 2. Fetch Board Calendar
	boardDocID := fmt.Sprintf("board_%d_%s", boardID, year)
	doc, err := r.client.Collection(r.coll).Doc(boardDocID).Get(ctx)
	if err == nil && doc.Exists() {
		var cal models.SchoolCalendar
		if err := doc.DataTo(&cal); err == nil {
			cal.ID = doc.Ref.ID
			// If requested as school scope but using board calendar, mark isCustom = false
			if scope == "school" {
				cal.IsCustom = false
			}
			return &cal, nil
		}
	}

	// 3. If board calendar does not exist in Firestore yet, automatically seed standard baseline
	boardCode := "OCSB"
	if boardID == 5 {
		boardCode = "OCDSB"
	}
	defaultEvents := GenerateDefaultOCSB2026Events()
	now := time.Now().UTC().Format(time.RFC3339)

	defaultBoardCal := &models.SchoolCalendar{
		ID:         boardDocID,
		Scope:      "board",
		BoardID:    boardID,
		BoardCode:  boardCode,
		SchoolYear: year,
		IsCustom:   false,
		Events:     defaultEvents,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Seed to Firestore in background
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_, _ = r.client.Collection(r.coll).Doc(boardDocID).Set(bgCtx, defaultBoardCal)
	}()

	return defaultBoardCal, nil
}

func (r *FirestoreCalendarRepository) SaveCalendar(ctx context.Context, cal *models.SchoolCalendar) (*models.SchoolCalendar, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	cal.UpdatedAt = now
	if cal.CreatedAt == nil {
		cal.CreatedAt = now
	}

	if cal.ID == "" {
		if cal.Scope == "school" && cal.SchoolID != nil {
			cal.ID = fmt.Sprintf("school_%d_%s", *cal.SchoolID, cal.SchoolYear)
		} else {
			cal.ID = fmt.Sprintf("board_%d_%s", cal.BoardID, cal.SchoolYear)
		}
	}

	_, err := r.client.Collection(r.coll).Doc(cal.ID).Set(ctx, cal)
	if err != nil {
		return nil, err
	}
	return cal, nil
}

func (r *FirestoreCalendarRepository) DeleteSchoolCalendar(ctx context.Context, schoolID int, year string) error {
	docID := fmt.Sprintf("school_%d_%s", schoolID, year)
	_, err := r.client.Collection(r.coll).Doc(docID).Delete(ctx)
	return err
}

func (r *FirestoreCalendarRepository) ListCalendars(ctx context.Context, year string) ([]*models.SchoolCalendar, error) {
	var list []*models.SchoolCalendar
	iter := r.client.Collection(r.coll).Where("schoolYear", "==", year).Documents(ctx)
	defer iter.Stop()

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var cal models.SchoolCalendar
		if err := doc.DataTo(&cal); err == nil {
			cal.ID = doc.Ref.ID
			list = append(list, &cal)
		}
	}
	return list, nil
}

// MemoryCalendarRepository implements in-memory fallback for local dev
type MemoryCalendarRepository struct {
	mu        sync.RWMutex
	calendars map[string]*models.SchoolCalendar
}

func NewMemoryCalendarRepository() *MemoryCalendarRepository {
	repo := &MemoryCalendarRepository{
		calendars: make(map[string]*models.SchoolCalendar),
	}
	// Pre-seed OCSB (ID 6) and OCDSB (ID 5)
	now := time.Now().UTC().Format(time.RFC3339)
	repo.calendars["board_6_2026-2027"] = &models.SchoolCalendar{
		ID:         "board_6_2026-2027",
		Scope:      "board",
		BoardID:    6,
		BoardCode:  "OCSB",
		SchoolYear: "2026-2027",
		IsCustom:   false,
		Events:     GenerateDefaultOCSB2026Events(),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	repo.calendars["board_5_2026-2027"] = &models.SchoolCalendar{
		ID:         "board_5_2026-2027",
		Scope:      "board",
		BoardID:    5,
		BoardCode:  "OCDSB",
		SchoolYear: "2026-2027",
		IsCustom:   false,
		Events:     GenerateDefaultOCSB2026Events(),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	return repo
}

func (r *MemoryCalendarRepository) GetCalendar(ctx context.Context, scope string, boardID int, schoolID *int, year string) (*models.SchoolCalendar, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if year == "" {
		year = "2026-2027"
	}

	if scope == "school" && schoolID != nil && *schoolID > 0 {
		customID := fmt.Sprintf("school_%d_%s", *schoolID, year)
		if cal, ok := r.calendars[customID]; ok {
			return cal, nil
		}
	}

	boardIDStr := fmt.Sprintf("board_%d_%s", boardID, year)
	if cal, ok := r.calendars[boardIDStr]; ok {
		// Clone and set custom flag
		cloned := *cal
		if scope == "school" {
			cloned.IsCustom = false
		}
		return &cloned, nil
	}

	// Fallback seed
	now := time.Now().UTC().Format(time.RFC3339)
	newBoardCal := &models.SchoolCalendar{
		ID:         boardIDStr,
		Scope:      "board",
		BoardID:    boardID,
		BoardCode:  "BOARD",
		SchoolYear: year,
		IsCustom:   false,
		Events:     GenerateDefaultOCSB2026Events(),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	return newBoardCal, nil
}

func (r *MemoryCalendarRepository) SaveCalendar(ctx context.Context, cal *models.SchoolCalendar) (*models.SchoolCalendar, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if cal.ID == "" {
		if cal.Scope == "school" && cal.SchoolID != nil {
			cal.ID = fmt.Sprintf("school_%d_%s", *cal.SchoolID, cal.SchoolYear)
		} else {
			cal.ID = fmt.Sprintf("board_%d_%s", cal.BoardID, cal.SchoolYear)
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	cal.UpdatedAt = now
	r.calendars[cal.ID] = cal
	return cal, nil
}

func (r *MemoryCalendarRepository) DeleteSchoolCalendar(ctx context.Context, schoolID int, year string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	docID := fmt.Sprintf("school_%d_%s", schoolID, year)
	delete(r.calendars, docID)
	return nil
}

func (r *MemoryCalendarRepository) ListCalendars(ctx context.Context, year string) ([]*models.SchoolCalendar, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*models.SchoolCalendar
	for _, c := range r.calendars {
		if c.SchoolYear == year {
			list = append(list, c)
		}
	}
	return list, nil
}
