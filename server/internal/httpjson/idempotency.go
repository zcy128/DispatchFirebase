package httpjson

import (
	"bytes"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	// HeaderIdempotencyKey is sent by offline-capable clients (e.g. Driver App outbox)
	// to prevent duplicate mutations when retrying after transient network failures.
	HeaderIdempotencyKey = "X-Idempotency-Key"
	// HeaderIdempotentReplay indicates the response was served from the idempotency cache.
	HeaderIdempotentReplay = "X-Idempotent-Replay"
)

type cachedResponse struct {
	statusCode  int
	contentType string
	body        []byte
	expiresAt   time.Time
}

type idempotencyStore struct {
	mu         sync.Mutex
	ttl        time.Duration
	maxEntries int
	inFlight   map[string]struct{}
	completed  map[string]cachedResponse
}

func newIdempotencyStore(ttl time.Duration, maxEntries int) *idempotencyStore {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	if maxEntries <= 0 {
		maxEntries = 2000
	}
	return &idempotencyStore{
		ttl:        ttl,
		maxEntries: maxEntries,
		inFlight:   make(map[string]struct{}),
		completed:  make(map[string]cachedResponse),
	}
}

// Idempotency returns an HTTP middleware that deduplicates mutating requests
// carrying X-Idempotency-Key and replays successful 2xx responses.
func Idempotency(ttl time.Duration, maxEntries int) func(http.Handler) http.Handler {
	store := newIdempotencyStore(ttl, maxEntries)
	return store.middleware
}

func (s *idempotencyStore) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isMutatingMethod(r.Method) {
			next.ServeHTTP(w, r)
			return
		}

		rawKey := strings.TrimSpace(r.Header.Get(HeaderIdempotencyKey))
		if rawKey == "" {
			next.ServeHTTP(w, r)
			return
		}

		cacheKey := r.Method + ":" + r.URL.Path + ":" + rawKey
		now := time.Now()

		s.mu.Lock()
		s.evictExpiredLocked(now)
		if cached, ok := s.completed[cacheKey]; ok {
			s.mu.Unlock()
			if cached.contentType != "" {
				w.Header().Set("Content-Type", cached.contentType)
			}
			w.Header().Set(HeaderIdempotentReplay, "true")
			w.WriteHeader(cached.statusCode)
			if len(cached.body) > 0 {
				_, _ = w.Write(cached.body)
			}
			return
		}
		if _, busy := s.inFlight[cacheKey]; busy {
			s.mu.Unlock()
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusConflict)
			_, _ = w.Write([]byte(`{"error":"Request with this X-Idempotency-Key is already in progress","code":"IDEMPOTENCY_IN_PROGRESS"}`))
			return
		}
		s.inFlight[cacheKey] = struct{}{}
		s.mu.Unlock()

		rec := &responseCaptureWriter{ResponseWriter: w}
		defer func() {
			s.mu.Lock()
			delete(s.inFlight, cacheKey)
			if rec.statusCode >= 200 && rec.statusCode < 300 {
				if len(s.completed) >= s.maxEntries {
					s.evictOneLocked()
				}
				bodyCopy := make([]byte, rec.buf.Len())
				copy(bodyCopy, rec.buf.Bytes())
				s.completed[cacheKey] = cachedResponse{
					statusCode:  rec.statusCode,
					contentType: rec.Header().Get("Content-Type"),
					body:        bodyCopy,
					expiresAt:   time.Now().Add(s.ttl),
				}
			}
			s.mu.Unlock()
		}()

		next.ServeHTTP(rec, r)
		if rec.statusCode == 0 {
			rec.statusCode = http.StatusOK
		}
	})
}

func (s *idempotencyStore) evictExpiredLocked(now time.Time) {
	for k, v := range s.completed {
		if now.After(v.expiresAt) {
			delete(s.completed, k)
		}
	}
}

func (s *idempotencyStore) evictOneLocked() {
	for k := range s.completed {
		delete(s.completed, k)
		return
	}
}

func isMutatingMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

type responseCaptureWriter struct {
	http.ResponseWriter
	statusCode int
	buf        bytes.Buffer
}

func (w *responseCaptureWriter) WriteHeader(code int) {
	if w.statusCode == 0 {
		w.statusCode = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *responseCaptureWriter) Write(p []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	_, _ = w.buf.Write(p)
	return w.ResponseWriter.Write(p)
}

func (w *responseCaptureWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}
