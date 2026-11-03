package httpjson

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestErrorContentTypeRelabelsJSONFromHTTPError(t *testing.T) {
	handler := ErrorContentType(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error":"authorization header required"}`, http.StatusUnauthorized)
	}))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/employees", nil)
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/json") {
		t.Fatalf("content-type = %q", got)
	}
	if strings.TrimSpace(rec.Body.String()) != `{"error":"authorization header required"}` {
		t.Fatalf("body = %q", rec.Body.String())
	}
}

func TestErrorContentTypeLeavesPlainTextAndHTML(t *testing.T) {
	plain := ErrorContentType(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
	}))
	html := ErrorContentType(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("<p>Invalid request</p>"))
	}))

	plainRec := httptest.NewRecorder()
	plain.ServeHTTP(plainRec, httptest.NewRequest(http.MethodGet, "/", nil))
	if got := plainRec.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/plain") {
		t.Fatalf("plain content-type = %q", got)
	}

	htmlRec := httptest.NewRecorder()
	html.ServeHTTP(htmlRec, httptest.NewRequest(http.MethodGet, "/", nil))
	if got := htmlRec.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/html") {
		t.Fatalf("html content-type = %q", got)
	}
}

func TestErrorContentTypeLabelsUnlabeledJSON(t *testing.T) {
	handler := ErrorContentType(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": false,
			"error":   "No active verification request found.",
		})
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/parent/auth/verify-otp", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "application/json") {
		t.Fatalf("content-type = %q", got)
	}
}

func TestErrorContentTypePassesSuccessfulJSONThrough(t *testing.T) {
	handler := ErrorContentType(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"healthy"}`))
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("content-type = %q", got)
	}
}
