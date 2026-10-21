package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/services"
)

// ZonarHandler exposes admin GPS sync settings and the current-position table.
type ZonarHandler struct {
	svc *services.ZonarService
}

func NewZonarHandler(svc *services.ZonarService) *ZonarHandler {
	return &ZonarHandler{svc: svc}
}

func (h *ZonarHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeZonarError(w, http.StatusForbidden, "admin role required")
		return
	}
	settings, err := h.svc.GetSettings(r.Context())
	if err != nil {
		writeZonarError(w, http.StatusInternalServerError, "could not load Zonar settings")
		return
	}
	writeZonarJSON(w, http.StatusOK, settings)
}

func (h *ZonarHandler) SaveSettings(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeZonarError(w, http.StatusForbidden, "admin role required")
		return
	}
	var body services.ZonarSave
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeZonarError(w, http.StatusBadRequest, "invalid settings payload")
		return
	}
	settings, err := h.svc.SaveSettings(r.Context(), body)
	if err != nil {
		writeZonarError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeZonarJSON(w, http.StatusOK, settings)
}

func (h *ZonarHandler) TestSync(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeZonarError(w, http.StatusForbidden, "admin role required")
		return
	}
	report, err := h.svc.TestSync(r.Context())
	if err != nil {
		status := http.StatusBadGateway
		msg := err.Error()
		if strings.Contains(msg, "turned off") || strings.Contains(msg, "not configured") || strings.Contains(msg, "required") {
			status = http.StatusConflict
		}
		writeZonarError(w, status, msg)
		return
	}
	writeZonarJSON(w, http.StatusOK, report)
}

func (h *ZonarHandler) SyncSerials(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeZonarError(w, http.StatusForbidden, "admin role required")
		return
	}
	report, err := h.svc.SyncSerials(r.Context())
	if err != nil {
		status := http.StatusBadGateway
		msg := err.Error()
		if strings.Contains(msg, "not configured") || strings.Contains(msg, "required") {
			status = http.StatusConflict
		}
		writeZonarError(w, status, msg)
		return
	}
	writeZonarJSON(w, http.StatusOK, report)
}

func (h *ZonarHandler) PreviewRouteWriteBack(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeZonarError(w, http.StatusForbidden, "admin role required")
		return
	}
	report, err := h.svc.PreviewRouteWriteBack(r.Context())
	if err != nil {
		status := http.StatusBadGateway
		msg := err.Error()
		if strings.Contains(msg, "not configured") || strings.Contains(msg, "turned off") {
			status = http.StatusConflict
		}
		writeZonarError(w, status, msg)
		return
	}
	writeZonarJSON(w, http.StatusOK, report)
}

func (h *ZonarHandler) GetSyncEnabled(w http.ResponseWriter, r *http.Request) {
	enabled, err := h.svc.SyncEnabled(r.Context())
	if err != nil {
		writeZonarError(w, http.StatusInternalServerError, "could not load Zonar settings")
		return
	}
	writeZonarJSON(w, http.StatusOK, map[string]bool{"enabled": enabled})
}

func (h *ZonarHandler) GetVehicleTrace(w http.ResponseWriter, r *http.Request) {
	h.writeVehicleRead(w, r, func() (any, error) {
		return h.svc.VehicleTrace(r.Context(), chi.URLParam(r, "vehicleId"), r.URL.Query().Get("start"), r.URL.Query().Get("end"))
	})
}

func (h *ZonarHandler) GetVehicleIdles(w http.ResponseWriter, r *http.Request) {
	h.writeVehicleRead(w, r, func() (any, error) {
		return h.svc.VehicleIdles(r.Context(), chi.URLParam(r, "vehicleId"), r.URL.Query().Get("start"), r.URL.Query().Get("end"))
	})
}

func (h *ZonarHandler) writeVehicleRead(w http.ResponseWriter, _ *http.Request, load func() (any, error)) {
	payload, err := load()
	if err != nil {
		status := http.StatusBadGateway
		msg := err.Error()
		switch {
		case strings.Contains(msg, "not found"):
			status = http.StatusNotFound
		case strings.Contains(msg, "required"), strings.Contains(msg, "turned off"), strings.Contains(msg, "no Zonar"), strings.Contains(msg, "24 hours"), strings.Contains(msg, "after start"):
			status = http.StatusConflict
		}
		writeZonarError(w, status, msg)
		return
	}
	writeZonarJSON(w, http.StatusOK, payload)
}

func (h *ZonarHandler) GetPosition(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeZonarError(w, http.StatusForbidden, "admin role required")
		return
	}
	pos, err := h.svc.GetCurrent(r.Context(), chi.URLParam(r, "unitNumber"))
	if err != nil {
		writeZonarError(w, http.StatusInternalServerError, "could not load the current position")
		return
	}
	if pos == nil {
		writeZonarError(w, http.StatusNotFound, "vehicle location not available")
		return
	}
	writeZonarJSON(w, http.StatusOK, pos)
}

func writeZonarJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeZonarError(w http.ResponseWriter, status int, message string) {
	writeZonarJSON(w, status, map[string]string{"error": message})
}
