package httpjson

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestIdempotencyReplaysSuccessfulMutation(t *testing.T) {
	var calls atomic.Int32
	mw := Idempotency(time.Minute, 100)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"shift-1","status":"in_progress"}`))
	}))

	req1 := httptest.NewRequest(http.MethodPost, "/api/dispatch/shifts/s1/check-in", nil)
	req1.Header.Set(HeaderIdempotencyKey, "key-123")
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec1.Code)
	}
	if rec1.Header().Get(HeaderIdempotentReplay) != "" {
		t.Fatalf("first response should not be marked as replay")
	}

	req2 := httptest.NewRequest(http.MethodPost, "/api/dispatch/shifts/s1/check-in", nil)
	req2.Header.Set(HeaderIdempotencyKey, "key-123")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusCreated {
		t.Fatalf("expected replayed 201, got %d", rec2.Code)
	}
	if rec2.Header().Get(HeaderIdempotentReplay) != "true" {
		t.Fatalf("expected X-Idempotent-Replay: true")
	}
	if rec2.Body.String() != `{"id":"shift-1","status":"in_progress"}` {
		t.Fatalf("unexpected replayed body: %s", rec2.Body.String())
	}
	if calls.Load() != 1 {
		t.Fatalf("expected handler to execute once, executed %d times", calls.Load())
	}
}

func TestIdempotencyDoesNotCacheErrors(t *testing.T) {
	var calls atomic.Int32
	mw := Idempotency(time.Minute, 100)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		if n == 1 {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":"bad input"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))

	req1 := httptest.NewRequest(http.MethodPut, "/api/dispatch/shifts/s1/check-in", nil)
	req1.Header.Set(HeaderIdempotencyKey, "retry-key")
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec1.Code)
	}

	req2 := httptest.NewRequest(http.MethodPut, "/api/dispatch/shifts/s1/check-in", nil)
	req2.Header.Set(HeaderIdempotencyKey, "retry-key")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 on retry after 400, got %d", rec2.Code)
	}
	if calls.Load() != 2 {
		t.Fatalf("expected 2 calls, got %d", calls.Load())
	}
}
