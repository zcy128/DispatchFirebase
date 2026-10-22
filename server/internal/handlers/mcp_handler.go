package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"dispatch-server/internal/mcp"
)

type MCPHandler struct {
	server   *mcp.Server
	mu       sync.RWMutex
	sessions map[string]chan []byte
}

func NewMCPHandler(server *mcp.Server) *MCPHandler {
	return &MCPHandler{
		server:   server,
		sessions: make(map[string]chan []byte),
	}
}

// HandleHTTP handles Streamable HTTP MCP requests (POST /api/mcp).
func (h *MCPHandler) HandleHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		// If a client opens GET /api/mcp with Accept: text/event-stream, delegate to SSE handler
		if strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
			h.HandleSSE(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"name":            mcp.ServerName,
			"version":         mcp.ServerVersion,
			"protocolVersion": mcp.DefaultProtocolVersion,
			"transport":       "streamable-http",
			"status":          "ready",
		})
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 4*1024*1024))
	if err != nil {
		http.Error(w, `{"error":"failed to read request body"}`, http.StatusBadRequest)
		return
	}
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		http.Error(w, `{"error":"empty request body"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Support JSON-RPC batch requests
	if trimmed[0] == '[' {
		var batch []mcp.JSONRPCRequest
		if err := json.Unmarshal(trimmed, &batch); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(mcp.JSONRPCResponse{
				JSONRPC: "2.0",
				ID:      json.RawMessage("null"),
				Error:   &mcp.JSONRPCError{Code: -32700, Message: "Parse error"},
			})
			return
		}

		var responses []*mcp.JSONRPCResponse
		for i := range batch {
			if resp := h.server.HandleJSONRPC(r.Context(), &batch[i]); resp != nil {
				responses = append(responses, resp)
			}
		}
		if len(responses) == 0 {
			w.WriteHeader(http.StatusAccepted)
			return
		}
		_ = json.NewEncoder(w).Encode(responses)
		return
	}

	// Single JSON-RPC request
	var req mcp.JSONRPCRequest
	if err := json.Unmarshal(trimmed, &req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(mcp.JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      json.RawMessage("null"),
			Error:   &mcp.JSONRPCError{Code: -32700, Message: "Parse error"},
		})
		return
	}

	resp := h.server.HandleJSONRPC(r.Context(), &req)
	if resp == nil {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	_ = json.NewEncoder(w).Encode(resp)
}

// HandleSSE handles legacy MCP HTTP+SSE connections (GET /api/mcp/sse).
func (h *MCPHandler) HandleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming unsupported"}`, http.StatusInternalServerError)
		return
	}

	sessionID := fmt.Sprintf("mcp-sess-%d", time.Now().UnixNano())
	msgChan := make(chan []byte, 32)

	h.mu.Lock()
	h.sessions[sessionID] = msgChan
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.sessions, sessionID)
		close(msgChan)
		h.mu.Unlock()
	}()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	endpointURL := fmt.Sprintf("/api/mcp/message?sessionId=%s", sessionID)
	fmt.Fprintf(w, "event: endpoint\ndata: %s\n\n", endpointURL)
	flusher.Flush()

	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case msg, open := <-msgChan:
			if !open {
				return
			}
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", string(msg))
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

// HandleSSEMessage handles incoming JSON-RPC messages for an SSE session (POST /api/mcp/message).
func (h *MCPHandler) HandleSSEMessage(w http.ResponseWriter, r *http.Request) {
	var req mcp.JSONRPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON-RPC request"}`, http.StatusBadRequest)
		return
	}

	resp := h.server.HandleJSONRPC(r.Context(), &req)
	sessionID := strings.TrimSpace(r.URL.Query().Get("sessionId"))

	if resp != nil && sessionID != "" {
		if payload, err := json.Marshal(resp); err == nil {
			h.mu.RLock()
			ch, exists := h.sessions[sessionID]
			if exists {
				select {
				case ch <- payload:
				default:
				}
			}
			h.mu.RUnlock()
		}
	}

	if resp == nil {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
