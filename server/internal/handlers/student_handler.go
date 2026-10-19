package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type StudentHandler struct {
	repo repository.StudentRepository
}

func NewStudentHandler(repo repository.StudentRepository) *StudentHandler {
	return &StudentHandler{repo: repo}
}

// List returns filtered students
func (h *StudentHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	q := r.URL.Query()
	filter := repository.StudentFilter{
		Search:       q.Get("search"),
		Grade:        q.Get("grade"),
		Route:        q.Get("route"),
		MetatBusOnly: q.Get("metatBus") == "true",
	}

	if sidStr := q.Get("schoolId"); sidStr != "" {
		if sid, err := strconv.Atoi(sidStr); err == nil {
			filter.SchoolID = sid
		}
	}

	if activeStr := q.Get("active"); activeStr != "" {
		b := activeStr == "true"
		filter.ActiveOnly = &b
	}

	students, err := h.repo.List(r.Context(), filter)
	if err != nil {
		http.Error(w, `{"error":"failed to retrieve students"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(students)
}

// GetByID returns student by ID
func (h *StudentHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	student, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"student not found"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(student)
}

// Create inserts a new student
func (h *StudentHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var s models.Student
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if s.StudentNo == "" || s.FirstName == "" || s.LastName == "" {
		http.Error(w, `{"error":"studentNo, firstName, and lastName are required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.Create(r.Context(), &s); err != nil {
		if err == repository.ErrStudentConflict {
			http.Error(w, `{"error":"student number already exists"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to create student"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(s)
}

// Update modifies an existing student
func (h *StudentHandler) Update(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var s models.Student
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	s.ID = id

	if err := h.repo.Update(r.Context(), &s); err != nil {
		http.Error(w, `{"error":"failed to update student"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(s)
}

// Delete removes a student
func (h *StudentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	if err := h.repo.Delete(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete student"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"student deleted successfully"}`))
}

// Stats returns summary statistics
func (h *StudentHandler) Stats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	students, err := h.repo.List(r.Context(), repository.StudentFilter{})
	if err != nil {
		http.Error(w, `{"error":"failed to calculate statistics"}`, http.StatusInternalServerError)
		return
	}

	total := len(students)
	active := 0
	metAtBus := 0
	routesCovered := make(map[string]bool)
	gradeDist := make(map[string]int)
	schoolDist := make(map[string]int)

	for _, s := range students {
		if s.Active {
			active++
		}
		if s.MetatBus {
			metAtBus++
		}
		if s.Grade != "" {
			gradeDist[s.Grade]++
		}
		if s.SchoolName != "" {
			schoolDist[s.SchoolName]++
		}
		if s.Routes != "" {
			for _, rt := range strings.Split(s.Routes, ",") {
				cleaned := strings.TrimSpace(rt)
				if cleaned != "" {
					routesCovered[cleaned] = true
				}
			}
		}
	}

	stats := map[string]interface{}{
		"totalStudents":   total,
		"activeStudents":  active,
		"metAtBusCount":   metAtBus,
		"routesCovered":   len(routesCovered),
		"gradeDistribution": gradeDist,
		"schoolDistribution": schoolDist,
	}

	json.NewEncoder(w).Encode(stats)
}
