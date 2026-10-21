package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"dispatch-server/internal/services"
	"github.com/go-chi/chi/v5"
)

// BusPlannerHandler exposes admin settings and a staging-only sync.
type BusPlannerHandler struct {
	svc *services.BusPlannerService
}

func NewBusPlannerHandler(svc *services.BusPlannerService) *BusPlannerHandler {
	return &BusPlannerHandler{svc: svc}
}

func (h *BusPlannerHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeBusPlannerError(w, http.StatusForbidden, "admin role required")
		return
	}
	settings, err := h.svc.GetSettings(r.Context())
	if err != nil {
		writeBusPlannerError(w, http.StatusInternalServerError, "could not load BusPlanner settings")
		return
	}
	writeBusPlannerJSON(w, http.StatusOK, settings)
}

func (h *BusPlannerHandler) SaveSettings(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeBusPlannerError(w, http.StatusForbidden, "admin role required")
		return
	}
	var body services.BusPlannerSave
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeBusPlannerError(w, http.StatusBadRequest, "invalid settings payload")
		return
	}
	settings, err := h.svc.SaveSettings(r.Context(), body)
	if err != nil {
		writeBusPlannerError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeBusPlannerJSON(w, http.StatusOK, settings)
}

func (h *BusPlannerHandler) ListStagingRoutes(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.ListStagingRoutes(r.Context())
	if err != nil {
		writeBusPlannerError(w, http.StatusInternalServerError, "could not load staging routes")
		return
	}
	writeBusPlannerJSON(w, http.StatusOK, list)
}

func (h *BusPlannerHandler) CopyStagingRoute(w http.ResponseWriter, r *http.Request) {
	report, err := h.svc.CopyStagingRoute(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		status := http.StatusInternalServerError
		msg := "could not copy staging route"
		switch {
		case errors.Is(err, services.ErrStagingRouteNotFound):
			status = http.StatusNotFound
			msg = err.Error()
		case errors.Is(err, services.ErrStagingRouteEmpty):
			status = http.StatusConflict
			msg = err.Error()
		case errors.Is(err, services.ErrLiveRoutesUnavailable):
			status = http.StatusServiceUnavailable
			msg = err.Error()
		}
		writeBusPlannerError(w, status, msg)
		return
	}
	writeBusPlannerJSON(w, http.StatusOK, report)
}

func (h *BusPlannerHandler) SyncNow(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeBusPlannerError(w, http.StatusForbidden, "admin role required")
		return
	}
	report, err := h.svc.SyncNow(r.Context())
	if err != nil {
		status := http.StatusBadGateway
		msg := err.Error()
		if strings.Contains(msg, "turned off") || strings.Contains(msg, "required") || strings.Contains(msg, "already running") {
			status = http.StatusConflict
		}
		writeBusPlannerError(w, status, msg)
		return
	}
	writeBusPlannerJSON(w, http.StatusOK, report)
}

func writeBusPlannerJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeBusPlannerError(w http.ResponseWriter, status int, message string) {
	writeBusPlannerJSON(w, status, map[string]string{"error": message})
}
