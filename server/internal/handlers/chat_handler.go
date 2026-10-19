package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type ChatHandler struct {
	chatRepo repository.ChatRepository
	empRepo  repository.EmployeeRepository
}

func NewChatHandler(chatRepo repository.ChatRepository, empRepo repository.EmployeeRepository) *ChatHandler {
	return &ChatHandler{
		chatRepo: chatRepo,
		empRepo:  empRepo,
	}
}

// resolveCurrentUserID extracts user ID from auth context, or falls back to X-User-Id header / query
func (h *ChatHandler) resolveCurrentUserID(r *http.Request) string {
	user := auth.GetUser(r.Context())
	if user != nil {
		if user.EmployeeID != "" {
			return user.EmployeeID
		}
		if user.UID != "" && h.empRepo != nil {
			if emp, err := h.empRepo.GetByFirebaseUID(r.Context(), user.UID); err == nil && emp != nil {
				return emp.ID
			}
			return user.UID
		}
	}
	// Fallback to explicit header or query param
	if val := r.Header.Get("X-User-Id"); val != "" {
		return val
	}
	return r.URL.Query().Get("userId")
}

// ListChannels returns all channels accessible to the user
func (h *ChatHandler) ListChannels(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := h.resolveCurrentUserID(r)
	if userID == "" {
		http.Error(w, `{"error":"user id is required"}`, http.StatusBadRequest)
		return
	}

	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	channels, err := h.chatRepo.ListUserChannels(r.Context(), userID, date)
	if err != nil {
		http.Error(w, `{"error":"failed to list channels: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(channels)
}

// GetChannel returns channel details
func (h *ChatHandler) GetChannel(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	channelID := chi.URLParam(r, "id")
	if channelID == "" {
		http.Error(w, `{"error":"channel id is required"}`, http.StatusBadRequest)
		return
	}

	channel, err := h.chatRepo.GetChannelByID(r.Context(), channelID)
	if err != nil {
		http.Error(w, `{"error":"failed to get channel: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(channel)
}

// CreateOrGetDirectChannel opens or retrieves a 1-on-1 private chat
func (h *ChatHandler) CreateOrGetDirectChannel(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := h.resolveCurrentUserID(r)
	if userID == "" {
		http.Error(w, `{"error":"user id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.CreateDirectChannelPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if req.TargetUserID == "" {
		http.Error(w, `{"error":"targetUserId is required"}`, http.StatusBadRequest)
		return
	}

	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	channel, err := h.chatRepo.CreateOrGetDirectChannel(r.Context(), userID, req.TargetUserID, date)
	if err != nil {
		http.Error(w, `{"error":"failed to open direct channel: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(channel)
}

// CreateOrGetParentChannel finds or creates a parent conversation channel
func (h *ChatHandler) CreateOrGetParentChannel(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.CreateParentChannelPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.ParentContact) == "" {
		http.Error(w, `{"error":"parentContact is required"}`, http.StatusBadRequest)
		return
	}

	channel, err := h.chatRepo.CreateOrGetParentChannel(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create or get parent channel: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(channel)
}

// ListMessages returns chronological messages for a channel
func (h *ChatHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	channelID := chi.URLParam(r, "id")
	if channelID == "" {
		http.Error(w, `{"error":"channel id is required"}`, http.StatusBadRequest)
		return
	}

	limit := 50
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}

	messages, err := h.chatRepo.ListMessages(r.Context(), channelID, limit)
	if err != nil {
		http.Error(w, `{"error":"failed to list messages: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(messages)
}

// SendMessage sends a new message to a channel
func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	channelID := chi.URLParam(r, "id")
	if channelID == "" {
		http.Error(w, `{"error":"channel id is required"}`, http.StatusBadRequest)
		return
	}

	userID := h.resolveCurrentUserID(r)
	if userID == "" {
		http.Error(w, `{"error":"sender user id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.SendMessagePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Text) == "" && req.MediaURL == "" {
		http.Error(w, `{"error":"message text or media is required"}`, http.StatusBadRequest)
		return
	}

	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	msg, err := h.chatRepo.SendMessage(r.Context(), channelID, userID, &req, date)
	if err != nil {
		http.Error(w, `{"error":"failed to send message: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(msg)
}

// ListContacts returns contacts for 1-on-1 private messaging with dynamic display names
func (h *ChatHandler) ListContacts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := h.resolveCurrentUserID(r)

	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	contacts, err := h.chatRepo.ListDirectMessageContacts(r.Context(), userID, date)
	if err != nil {
		http.Error(w, `{"error":"failed to list contacts: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(contacts)
}

// GetMyDisplayName returns the current user's dynamic display name
func (h *ChatHandler) GetMyDisplayName(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := h.resolveCurrentUserID(r)
	if userID == "" {
		http.Error(w, `{"error":"user id is required"}`, http.StatusBadRequest)
		return
	}

	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	displayName, err := h.chatRepo.GetDynamicDisplayName(r.Context(), userID, date)
	if err != nil {
		http.Error(w, `{"error":"failed to get display name: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"userId":      userID,
		"displayName": displayName,
		"date":        date,
	})
}
