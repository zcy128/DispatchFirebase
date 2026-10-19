package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type VehicleHandler struct {
	repo repository.VehicleRepository
}

func NewVehicleHandler(repo repository.VehicleRepository) *VehicleHandler {
	return &VehicleHandler{repo: repo}
}

// ListVehicles returns vehicles with optional search, type, and fuel filters
func (h *VehicleHandler) ListVehicles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	q := r.URL.Query()
	filter := repository.VehicleFilter{
		Search:   q.Get("search"),
		UnitType: q.Get("unitType"),
		FuelType: q.Get("fuelType"),
		YardName: q.Get("yardName"),
	}

	if actStr := q.Get("active"); actStr != "" {
		b := actStr == "true"
		filter.Active = &b
	}

	vehicles, err := h.repo.ListVehicles(r.Context(), filter)
	if err != nil {
		http.Error(w, `{"error":"failed to retrieve vehicles"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(vehicles)
}

// GetVehicle returns a single vehicle by ID
func (h *VehicleHandler) GetVehicle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	vehicle, err := h.repo.GetVehicleByID(r.Context(), id)
	if err != nil {
		vehicle, err = h.repo.GetVehicleByUnitNumber(r.Context(), id)
		if err != nil {
			http.Error(w, `{"error":"vehicle not found"}`, http.StatusNotFound)
			return
		}
	}
	json.NewEncoder(w).Encode(vehicle)
}

// CreateVehicle creates a new vehicle record
func (h *VehicleHandler) CreateVehicle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var v models.Vehicle
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		http.Error(w, `{"error":"invalid vehicle payload"}`, http.StatusBadRequest)
		return
	}

	created, err := h.repo.CreateVehicle(r.Context(), &v)
	if err != nil {
		http.Error(w, `{"error":"failed to create vehicle"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// UpdateVehicle updates an existing vehicle record
func (h *VehicleHandler) UpdateVehicle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, `{"error":"invalid update payload"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateVehicle(r.Context(), id, updates)
	if err != nil {
		if err == repository.ErrVehicleNotFound {
			http.Error(w, `{"error":"vehicle not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to update vehicle"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// GetStats returns aggregated vehicle fleet statistics
func (h *VehicleHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	stats, err := h.repo.GetStats(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to retrieve vehicle stats"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(stats)
}

// DeleteVehicle removes a vehicle record
func (h *VehicleHandler) DeleteVehicle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	if err := h.repo.DeleteVehicle(r.Context(), id); err != nil {
		if err == repository.ErrVehicleNotFound {
			http.Error(w, `{"error":"vehicle not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to delete vehicle"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
