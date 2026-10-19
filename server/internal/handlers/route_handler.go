package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type RouteHandler struct {
	repo repository.RouteRepository
}

func NewRouteHandler(repo repository.RouteRepository) *RouteHandler {
	return &RouteHandler{repo: repo}
}

// ListRoutes returns routes with optional search and filters
func (h *RouteHandler) ListRoutes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	q := r.URL.Query()
	filter := repository.RouteFilter{
		Search: q.Get("search"),
	}

	if yStr := q.Get("yardId"); yStr != "" {
		if y, err := strconv.Atoi(yStr); err == nil {
			filter.YardID = y
		}
	}
	if bStr := q.Get("boardId"); bStr != "" {
		if b, err := strconv.Atoi(bStr); err == nil {
			filter.BoardID = b
		}
	}
	if actStr := q.Get("active"); actStr != "" {
		b := actStr == "true"
		filter.Active = &b
	}

	routes, err := h.repo.ListRoutes(r.Context(), filter)
	if err != nil {
		http.Error(w, `{"error":"failed to retrieve routes"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(routes)
}

// GetRoute returns a single route by ID
func (h *RouteHandler) GetRoute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	route, err := h.repo.GetRouteByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"route not found"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(route)
}

// UpdateRoute updates route parameters including autoMarryup, yard, active, and instructions
func (h *RouteHandler) UpdateRoute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var req models.UpdateRouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateRoute(r.Context(), id, &req)
	if err != nil {
		if err == repository.ErrRouteNotFound {
			http.Error(w, `{"error":"route not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to update route: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// ListRouteShifts returns the operational shifts with ordered stops for a route
func (h *RouteHandler) ListRouteShifts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	routeID := chi.URLParam(r, "id")

	shifts, err := h.repo.ListShiftsByRoute(r.Context(), routeID)
	if err != nil {
		http.Error(w, `{"error":"failed to retrieve route shifts"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(shifts)
}

// GetShift returns a specific shift document by shift ID
func (h *RouteHandler) GetShift(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	shift, err := h.repo.GetShiftByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"shift not found"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(shift)
}

// UpdateShift updates stops, active status, run days, or dates for a specific shift
func (h *RouteHandler) UpdateShift(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var payload models.UpdateShiftRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateShift(r.Context(), id, &payload)
	if err != nil {
		http.Error(w, `{"error":"failed to update shift: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// Stats returns high level metrics
func (h *RouteHandler) Stats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	routes, err := h.repo.ListRoutes(r.Context(), repository.RouteFilter{})
	if err != nil {
		http.Error(w, `{"error":"failed to calculate route statistics"}`, http.StatusInternalServerError)
		return
	}

	totalRoutes := len(routes)
	activeRoutes := 0
	assignedDrivers := 0
	totalStops := 0
	totalStudents := 0

	for _, rt := range routes {
		if rt.Active {
			activeRoutes++
		}
		if rt.DriverName != "" {
			assignedDrivers++
		}
		totalStops += rt.TotalStops
		totalStudents += rt.TotalStudents
	}

	stats := map[string]interface{}{
		"totalRoutes":     totalRoutes,
		"activeRoutes":    activeRoutes,
		"assignedDrivers": assignedDrivers,
		"totalStops":      totalStops,
		"totalStudents":   totalStudents,
	}

	json.NewEncoder(w).Encode(stats)
}

// AssignCrew updates driver, vehicle, and attendant for a route and its shifts
func (h *RouteHandler) AssignCrew(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	routeID := chi.URLParam(r, "id")

	var req models.AssignRouteCrewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid crew payload"}`, http.StatusBadRequest)
		return
	}

	updatedRoute, err := h.repo.AssignCrew(r.Context(), routeID, &req)
	if err != nil {
		if err == repository.ErrRouteNotFound {
			http.Error(w, `{"error":"route not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to assign crew: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updatedRoute)
}
