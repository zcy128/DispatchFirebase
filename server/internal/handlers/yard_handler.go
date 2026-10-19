package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type YardHandler struct {
	repo repository.YardRepository
}

func NewYardHandler(repo repository.YardRepository) *YardHandler {
	return &YardHandler{repo: repo}
}

func (h *YardHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	yards, err := h.repo.ListYards(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch yards: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if yards == nil {
		yards = []*models.Yard{}
	}
	json.NewEncoder(w).Encode(yards)
}

func (h *YardHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	yard, err := h.repo.GetYardByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"yard not found"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(yard)
}

func (h *YardHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.CreateYardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, `{"error":"yard name is required"}`, http.StatusBadRequest)
		return
	}

	created, err := h.repo.CreateYard(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create yard: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (h *YardHandler) Update(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	var req models.UpdateYardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateYard(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update yard: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

func (h *YardHandler) Delete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if err := h.repo.DeleteYard(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete yard: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "yard deleted successfully"})
}

func (h *YardHandler) Stats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	stats, err := h.repo.GetStats(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to get yard stats: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(stats)
}

func (h *YardHandler) AssignRoute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req struct {
		YardID   int    `json:"yardId"`
		YardName string `json:"yardName"`
		RouteID  string `json:"routeId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}
	if req.RouteID == "" {
		http.Error(w, `{"error":"routeId is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.AssignRoute(r.Context(), req.YardID, req.YardName, req.RouteID); err != nil {
		http.Error(w, `{"error":"failed to assign route: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "route assigned to yard"})
}

func (h *YardHandler) UnassignRoute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	routeID := chi.URLParam(r, "routeId")
	if routeID == "" {
		var req struct {
			RouteID string `json:"routeId"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		routeID = req.RouteID
	}
	if routeID == "" {
		http.Error(w, `{"error":"routeId is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.UnassignRoute(r.Context(), routeID); err != nil {
		http.Error(w, `{"error":"failed to unassign route: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "route unassigned from yard"})
}

func (h *YardHandler) AssignSchool(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req struct {
		YardID   int    `json:"yardId"`
		YardName string `json:"yardName"`
		SchoolID string `json:"schoolId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}
	if req.SchoolID == "" {
		http.Error(w, `{"error":"schoolId is required"}`, http.StatusBadRequest)
		return
	}

	affectedRoutes, err := h.repo.AssignSchool(r.Context(), req.YardID, req.YardName, req.SchoolID)
	if err != nil {
		http.Error(w, `{"error":"failed to assign school: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"message":        "school and routes assigned to yard",
		"affectedRoutes": affectedRoutes,
		"count":          len(affectedRoutes),
	})
}

func (h *YardHandler) UnassignSchool(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	schoolID := chi.URLParam(r, "schoolId")
	if schoolID == "" {
		var req struct {
			SchoolID string `json:"schoolId"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		schoolID = req.SchoolID
	}
	if schoolID == "" {
		http.Error(w, `{"error":"schoolId is required"}`, http.StatusBadRequest)
		return
	}

	affectedRoutes, err := h.repo.UnassignSchool(r.Context(), schoolID)
	if err != nil {
		http.Error(w, `{"error":"failed to unassign school: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"message":        "school and routes unassigned from yard",
		"affectedRoutes": affectedRoutes,
		"count":          len(affectedRoutes),
	})
}
