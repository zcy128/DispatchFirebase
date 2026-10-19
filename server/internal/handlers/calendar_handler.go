package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type CalendarHandler struct {
	repo repository.CalendarRepository
}

func NewCalendarHandler(repo repository.CalendarRepository) *CalendarHandler {
	return &CalendarHandler{repo: repo}
}

// Get retrieves a calendar for a board or school
// GET /api/calendars?scope=board|school&boardId=6&schoolId=22&year=2026-2027
func (h *CalendarHandler) Get(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "board"
	}

	boardID := 6 // Default to OCSB (ID 6)
	if bStr := r.URL.Query().Get("boardId"); bStr != "" {
		if val, err := strconv.Atoi(bStr); err == nil && val > 0 {
			boardID = val
		}
	}

	var schoolID *int
	if sStr := r.URL.Query().Get("schoolId"); sStr != "" {
		if val, err := strconv.Atoi(sStr); err == nil && val > 0 {
			schoolID = &val
		}
	}

	year := r.URL.Query().Get("year")
	if year == "" {
		year = "2026-2027"
	}

	cal, err := h.repo.GetCalendar(r.Context(), scope, boardID, schoolID, year)
	if err != nil {
		http.Error(w, `{"error":"failed to load calendar"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(cal)
}

// Save creates or updates a calendar (board or custom school)
// POST /api/calendars or PUT /api/calendars/{id}
func (h *CalendarHandler) Save(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var cal models.SchoolCalendar
	if err := json.NewDecoder(r.Body).Decode(&cal); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	saved, err := h.repo.SaveCalendar(r.Context(), &cal)
	if err != nil {
		http.Error(w, `{"error":"failed to save calendar: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(saved)
}

// DeleteSchoolCustom reverts a school to its board calendar by deleting the custom record
// DELETE /api/calendars/school?schoolId=22&year=2026-2027
func (h *CalendarHandler) DeleteSchoolCustom(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	sStr := r.URL.Query().Get("schoolId")
	if sStr == "" {
		http.Error(w, `{"error":"schoolId is required"}`, http.StatusBadRequest)
		return
	}
	schoolID, err := strconv.Atoi(sStr)
	if err != nil {
		http.Error(w, `{"error":"invalid schoolId"}`, http.StatusBadRequest)
		return
	}

	year := r.URL.Query().Get("year")
	if year == "" {
		year = "2026-2027"
	}

	if err := h.repo.DeleteSchoolCalendar(r.Context(), schoolID, year); err != nil {
		http.Error(w, `{"error":"failed to revert school calendar"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"school reverted to board calendar successfully"}`))
}

// List returns all stored calendars for a given year
// GET /api/calendars/all?year=2026-2027
func (h *CalendarHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	year := r.URL.Query().Get("year")
	if year == "" {
		year = "2026-2027"
	}

	list, err := h.repo.ListCalendars(r.Context(), year)
	if err != nil {
		http.Error(w, `{"error":"failed to list calendars"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(list)
}
