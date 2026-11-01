package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/repository"
)

type CharterHandler struct {
	repo repository.CharterRepository
}

func NewCharterHandler(repo repository.CharterRepository) *CharterHandler {
	return &CharterHandler{repo: repo}
}

func (h *CharterHandler) ListClients(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, false) {
		return
	}
	list, err := h.repo.ListClients(r.Context())
	if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to list charter clients")
		return
	}
	writeCharterJSON(w, http.StatusOK, nonNilDocs(list))
}

func (h *CharterHandler) CreateClient(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, true) {
		return
	}
	doc, err := decodeCharterDoc(r)
	if err != nil {
		writeCharterError(w, http.StatusBadRequest, "invalid charter client payload")
		return
	}
	if strings.TrimSpace(charterDocString(doc, "name")) == "" {
		writeCharterError(w, http.StatusBadRequest, "client name is required")
		return
	}
	created, err := h.repo.CreateClient(r.Context(), doc)
	if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to create charter client")
		return
	}
	writeCharterJSON(w, http.StatusCreated, created)
}

func (h *CharterHandler) UpdateClient(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, true) {
		return
	}
	id := chi.URLParam(r, "id")
	doc, err := decodeCharterDoc(r)
	if err != nil {
		writeCharterError(w, http.StatusBadRequest, "invalid charter client payload")
		return
	}
	updated, err := h.repo.UpdateClient(r.Context(), id, doc)
	if errors.Is(err, repository.ErrCharterClientNotFound) {
		writeCharterError(w, http.StatusNotFound, "charter client not found")
		return
	}
	if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to update charter client")
		return
	}
	writeCharterJSON(w, http.StatusOK, updated)
}

func (h *CharterHandler) DeleteClient(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, true) {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.repo.DeleteClient(r.Context(), id); errors.Is(err, repository.ErrCharterClientNotFound) {
		writeCharterError(w, http.StatusNotFound, "charter client not found")
		return
	} else if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to delete charter client")
		return
	}
	writeCharterJSON(w, http.StatusOK, map[string]interface{}{"success": true, "id": id})
}

func (h *CharterHandler) ListTrips(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, false) {
		return
	}
	list, err := h.repo.ListTrips(r.Context(), r.URL.Query().Get("date"))
	if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to list charter trips")
		return
	}
	writeCharterJSON(w, http.StatusOK, nonNilDocs(list))
}

func (h *CharterHandler) GetTrip(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, false) {
		return
	}
	trip, err := h.repo.GetTrip(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, repository.ErrCharterTripNotFound) {
		writeCharterError(w, http.StatusNotFound, "charter trip not found")
		return
	}
	if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to load charter trip")
		return
	}
	writeCharterJSON(w, http.StatusOK, trip)
}

func (h *CharterHandler) CreateTrip(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, true) {
		return
	}
	doc, err := decodeCharterDoc(r)
	if err != nil {
		writeCharterError(w, http.StatusBadRequest, "invalid charter trip payload")
		return
	}
	if strings.TrimSpace(charterDocString(doc, "title")) == "" {
		writeCharterError(w, http.StatusBadRequest, "trip title is required")
		return
	}
	if strings.TrimSpace(charterDocString(doc, "departsAt")) == "" {
		writeCharterError(w, http.StatusBadRequest, "departure time is required")
		return
	}
	created, err := h.repo.CreateTrip(r.Context(), doc)
	if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to create charter trip")
		return
	}
	writeCharterJSON(w, http.StatusCreated, created)
}

func (h *CharterHandler) UpdateTrip(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, true) {
		return
	}
	id := chi.URLParam(r, "id")
	doc, err := decodeCharterDoc(r)
	if err != nil {
		writeCharterError(w, http.StatusBadRequest, "invalid charter trip payload")
		return
	}
	updated, err := h.repo.UpdateTrip(r.Context(), id, doc)
	if errors.Is(err, repository.ErrCharterTripNotFound) {
		writeCharterError(w, http.StatusNotFound, "charter trip not found")
		return
	}
	if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to update charter trip")
		return
	}
	writeCharterJSON(w, http.StatusOK, updated)
}

func (h *CharterHandler) DeleteTrip(w http.ResponseWriter, r *http.Request) {
	if !requireCharter(w, r, true) {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.repo.DeleteTrip(r.Context(), id); errors.Is(err, repository.ErrCharterTripNotFound) {
		writeCharterError(w, http.StatusNotFound, "charter trip not found")
		return
	} else if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to delete charter trip")
		return
	}
	writeCharterJSON(w, http.StatusOK, map[string]interface{}{"success": true, "id": id})
}

func (h *CharterHandler) ListRouteOpenings(w http.ResponseWriter, r *http.Request) {
	if !requireCharterOrDispatchRead(w, r) {
		return
	}
	list, err := h.repo.ListRouteOpenings(r.Context())
	if err != nil {
		writeCharterError(w, http.StatusInternalServerError, "failed to list route openings")
		return
	}
	writeCharterJSON(w, http.StatusOK, nonNilDocs(list))
}

func requireCharter(w http.ResponseWriter, r *http.Request, write bool) bool {
	user := auth.GetUser(r.Context())
	if user == nil {
		writeCharterError(w, http.StatusUnauthorized, "unauthorized")
		return false
	}
	if !user.HasModulePermission("charter", write) {
		writeCharterError(w, http.StatusForbidden, "forbidden")
		return false
	}
	return true
}

func requireCharterOrDispatchRead(w http.ResponseWriter, r *http.Request) bool {
	user := auth.GetUser(r.Context())
	if user == nil {
		writeCharterError(w, http.StatusUnauthorized, "unauthorized")
		return false
	}
	if user.HasModulePermission("charter", false) || user.HasModulePermission("dispatch", false) {
		return true
	}
	writeCharterError(w, http.StatusForbidden, "forbidden")
	return false
}

func decodeCharterDoc(r *http.Request) (map[string]interface{}, error) {
	var doc map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
		return nil, err
	}
	if doc == nil {
		doc = map[string]interface{}{}
	}
	return doc, nil
}

func charterDocString(doc map[string]interface{}, key string) string {
	value, ok := doc[key]
	if !ok || value == nil {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return text
}

func nonNilDocs(list []map[string]interface{}) []map[string]interface{} {
	if list == nil {
		return []map[string]interface{}{}
	}
	return list
}

func writeCharterJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeCharterError(w http.ResponseWriter, status int, message string) {
	writeCharterJSON(w, status, map[string]string{"error": message})
}
