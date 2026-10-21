package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/services"
)

// BambooHRHandler exposes admin settings and a dry-run sync.
type BambooHRHandler struct {
	svc *services.BambooHRService
}

func NewBambooHRHandler(svc *services.BambooHRService) *BambooHRHandler {
	return &BambooHRHandler{svc: svc}
}

func (h *BambooHRHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeBambooError(w, http.StatusForbidden, "admin role required")
		return
	}
	settings, err := h.svc.GetSettings(r.Context())
	if err != nil {
		writeBambooError(w, http.StatusInternalServerError, "could not load BambooHR settings")
		return
	}
	writeBambooJSON(w, http.StatusOK, settings)
}

func (h *BambooHRHandler) SaveSettings(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeBambooError(w, http.StatusForbidden, "admin role required")
		return
	}
	var body services.BambooHRSave
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeBambooError(w, http.StatusBadRequest, "invalid settings payload")
		return
	}
	settings, err := h.svc.SaveSettings(r.Context(), body)
	if err != nil {
		writeBambooError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeBambooJSON(w, http.StatusOK, settings)
}

func (h *BambooHRHandler) TestSync(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeBambooError(w, http.StatusForbidden, "admin role required")
		return
	}
	report, err := h.svc.TestSync(r.Context())
	if err != nil {
		status := http.StatusBadGateway
		msg := err.Error()
		if strings.Contains(msg, "turned off") || strings.Contains(msg, "not configured") || strings.Contains(msg, "required") {
			status = http.StatusConflict
		}
		writeBambooError(w, status, msg)
		return
	}
	writeBambooJSON(w, http.StatusOK, report)
}

func (h *BambooHRHandler) SyncNow(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeBambooError(w, http.StatusForbidden, "admin role required")
		return
	}
	report, err := h.svc.SyncNow(r.Context())
	if err != nil {
		status := http.StatusBadGateway
		msg := err.Error()
		if strings.Contains(msg, "turned off") || strings.Contains(msg, "not configured") || strings.Contains(msg, "required") {
			status = http.StatusConflict
		}
		writeBambooError(w, status, msg)
		return
	}
	writeBambooJSON(w, http.StatusOK, report)
}

func (h *BambooHRHandler) ListWebhookEvents(w http.ResponseWriter, r *http.Request) {
	if !adminRequest(r) {
		writeBambooError(w, http.StatusForbidden, "admin role required")
		return
	}
	events, err := h.svc.ListWebhookEvents(r.Context())
	if err != nil {
		writeBambooError(w, http.StatusInternalServerError, "could not load webhook events")
		return
	}
	writeBambooJSON(w, http.StatusOK, map[string]any{"events": events})
}

// ReceiveWebhook accepts a BambooHR employee-change POST at /ReceiveWebhook/{apikey}.
// The path key is checked on the server. Matching employees are read and not saved.
func (h *BambooHRHandler) ReceiveWebhook(w http.ResponseWriter, r *http.Request) {
	var payload services.BambooWebhookPayload
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := decoder.Decode(&payload); err != nil {
		writeBambooError(w, http.StatusBadRequest, "Invalid payload")
		return
	}
	result, err := h.svc.ReceiveWebhook(r.Context(), chi.URLParam(r, "apikey"), &payload)
	if err != nil {
		status := http.StatusBadRequest
		message := "bad request"
		if errors.Is(err, services.ErrInvalidWebhookPayload) {
			message = "Invalid payload"
		} else if !errors.Is(err, services.ErrBadWebhookKey) {
			status = http.StatusInternalServerError
			message = "could not process webhook"
		}
		writeBambooError(w, status, message)
		return
	}
	writeBambooJSON(w, http.StatusOK, result)
}

func adminRequest(r *http.Request) bool {
	user, ok := r.Context().Value(auth.UserContextKey).(*auth.AuthUser)
	return ok && user != nil && strings.EqualFold(strings.TrimSpace(user.Role), "admin")
}

func writeBambooJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeBambooError(w http.ResponseWriter, status int, message string) {
	writeBambooJSON(w, status, map[string]string{"error": message})
}
