package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type SchoolHandler struct {
	repo      repository.SchoolRepository
	boardRepo repository.SchoolBoardRepository
}

func NewSchoolHandler(repo repository.SchoolRepository, boardRepo repository.SchoolBoardRepository) *SchoolHandler {
	return &SchoolHandler{
		repo:      repo,
		boardRepo: boardRepo,
	}
}

// List returns all schools
func (h *SchoolHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	schools, err := h.repo.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to retrieve schools: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(schools)
}

// GetByID returns a single school by document ID or schoolId
func (h *SchoolHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	sch, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"school not found"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(sch)
}

// Create creates a new school record
func (h *SchoolHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var s models.School
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	created, err := h.repo.Create(r.Context(), &s)
	if err != nil {
		http.Error(w, `{"error":"failed to create school: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// Update updates an existing school record
func (h *SchoolHandler) Update(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var s models.School
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	s.ID = id

	updated, err := h.repo.Update(r.Context(), &s)
	if err != nil {
		http.Error(w, `{"error":"failed to update school: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// Delete deletes a school record
func (h *SchoolHandler) Delete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	if err := h.repo.Delete(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete school: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "school deleted successfully",
		"id":      id,
	})
}

// --- School Board Handlers ---

// ListBoards returns all school boards
func (h *SchoolHandler) ListBoards(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.boardRepo == nil {
		http.Error(w, `{"error":"school board repository not configured"}`, http.StatusInternalServerError)
		return
	}

	boards, err := h.boardRepo.ListBoards(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to retrieve school boards: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(boards)
}

// CreateBoard creates a new school board
func (h *SchoolHandler) CreateBoard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var b models.SchoolBoard
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	created, err := h.boardRepo.CreateBoard(r.Context(), &b)
	if err != nil {
		http.Error(w, `{"error":"failed to create school board: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// UpdateBoard updates an existing school board
func (h *SchoolHandler) UpdateBoard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var b models.SchoolBoard
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	b.ID = id

	updated, err := h.boardRepo.UpdateBoard(r.Context(), &b)
	if err != nil {
		http.Error(w, `{"error":"failed to update school board: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// DeleteBoard deletes a school board
func (h *SchoolHandler) DeleteBoard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	if err := h.boardRepo.DeleteBoard(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete school board: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "school board deleted successfully",
		"id":      id,
	})
}
