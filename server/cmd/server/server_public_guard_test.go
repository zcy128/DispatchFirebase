package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/config"
)

func TestPublicRouteGuardIntegration(t *testing.T) {
	const secret = "test-mcp-secret"
	// Setup test router with the guard
	setupRouter := func(allowDemo bool) *chi.Mux {
		r := chi.NewRouter()
		cfg := &config.Config{
			AppMode:        "demo",
			MCPTokenSecret: secret,
		}
		if !allowDemo {
			cfg.AppMode = "production"
		}
		authenticator := auth.NewAuthenticator(nil, allowDemo).WithMCPTokenSecret(secret)

		r.Group(func(publicDev chi.Router) {
			publicDev.Use(auth.PublicAPISecurityMiddleware(cfg.AllowsDemo(), authenticator))

			publicDev.Get("/api/public/schools", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`[{"id":"SCH-1"}]`))
			})
			publicDev.Get("/api/public/employees", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`[{"id":"EMP-1"}]`))
			})
			publicDev.Delete("/api/public/dispatch/shifts/{id}", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`{"deleted":true}`))
			})
			publicDev.Post("/api/public/ai/chat", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`{"reply":"hello"}`))
			})
		})

		return r
	}

	t.Run("Production mode blocks anonymous calls", func(t *testing.T) {
		r := setupRouter(false)

		req := httptest.NewRequest("GET", "/api/public/schools", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized in production, got %d", rec.Code)
		}
	})

	t.Run("Demo mode blocks anonymous AI calls", func(t *testing.T) {
		r := setupRouter(true)

		req := httptest.NewRequest("POST", "/api/public/ai/chat", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized for anonymous AI call in demo, got %d", rec.Code)
		}
	})

	t.Run("Demo mode blocks anonymous mutations and DELETE calls", func(t *testing.T) {
		r := setupRouter(true)

		req := httptest.NewRequest("DELETE", "/api/public/dispatch/shifts/123", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized for anonymous DELETE in demo, got %d", rec.Code)
		}
	})

	t.Run("Demo mode blocks anonymous sensitive employee PII read", func(t *testing.T) {
		r := setupRouter(true)

		req := httptest.NewRequest("GET", "/api/public/employees", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized for anonymous employee read in demo, got %d", rec.Code)
		}
	})

	t.Run("Demo mode permits anonymous safe catalog GET within limit", func(t *testing.T) {
		r := setupRouter(true)

		req := httptest.NewRequest("GET", "/api/public/schools", nil)
		req.RemoteAddr = "172.16.0.1:54321"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for safe catalog GET in demo, got %d", rec.Code)
		}
	})

	t.Run("Demo mode allows authenticated AI call with valid MCP token", func(t *testing.T) {
		r := setupRouter(true)

		adminToken, _, _ := auth.GenerateMCPToken(secret, &auth.AuthUser{
			Username:   "admin",
			EmployeeID: "EMP-ADMIN-001",
			Role:       "admin",
		}, 10*time.Minute)

		req := httptest.NewRequest("POST", "/api/public/ai/chat", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for authenticated AI call in demo, got %d", rec.Code)
		}
	})
}
