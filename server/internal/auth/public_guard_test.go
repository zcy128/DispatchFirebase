package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestIPRateLimiter(t *testing.T) {
	limiter := NewIPRateLimiter(3, 100*time.Millisecond)

	ip := "192.168.1.100"

	// First 3 requests should be allowed
	if !limiter.Allow(ip) {
		t.Fatalf("expected 1st request to be allowed")
	}
	if !limiter.Allow(ip) {
		t.Fatalf("expected 2nd request to be allowed")
	}
	if !limiter.Allow(ip) {
		t.Fatalf("expected 3rd request to be allowed")
	}

	// 4th request should be blocked
	if limiter.Allow(ip) {
		t.Fatalf("expected 4th request to be blocked")
	}

	// Different IP should still be allowed
	if !limiter.Allow("192.168.1.101") {
		t.Fatalf("expected different IP to be allowed")
	}

	// Wait for window expiration
	time.Sleep(150 * time.Millisecond)
	if !limiter.Allow(ip) {
		t.Fatalf("expected request after window reset to be allowed")
	}
}

func TestGetClientIP(t *testing.T) {
	// 1. Behind reverse proxy (RemoteAddr is loopback): must use the last XFF hop, NOT the spoofed first entry
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "127.0.0.1:8080"
	req.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18")
	if ip := GetClientIP(req); ip != "70.41.3.18" {
		t.Errorf("expected nearest proxy hop 70.41.3.18, got %s", ip)
	}

	// 2. Direct public connection: spoofed XFF must be ignored in favor of peer TCP RemoteAddr
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "198.51.100.1:12345"
	req2.Header.Set("X-Forwarded-For", "1.2.3.4")
	if ip := GetClientIP(req2); ip != "198.51.100.1" {
		t.Errorf("expected direct peer 198.51.100.1, got %s", ip)
	}

	// 3. Cloudflare CF-Connecting-IP takes precedence
	req3 := httptest.NewRequest("GET", "/test", nil)
	req3.Header.Set("CF-Connecting-IP", "192.0.2.88")
	req3.RemoteAddr = "127.0.0.1:12345"
	if ip := GetClientIP(req3); ip != "192.0.2.88" {
		t.Errorf("expected CF-Connecting-IP 192.0.2.88, got %s", ip)
	}
}

func TestPublicAPISecurityMiddleware_Production(t *testing.T) {
	auth := NewAuthenticator(nil, false)
	mw := PublicAPISecurityMiddleware(false, auth)

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	}))

	// Anonymous request in production must be rejected with 401
	req := httptest.NewRequest("GET", "/api/public/employees", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized in production, got %d", rec.Code)
	}
}

func TestPublicAPISecurityMiddleware_Demo(t *testing.T) {
	const secret = "test-demo-secret"
	authenticator := NewAuthenticator(nil, true).WithMCPTokenSecret(secret)
	mw := PublicAPISecurityMiddleware(true, authenticator)

	validToken, _, _ := GenerateMCPToken(secret, &AuthUser{
		Username:   "admin",
		EmployeeID: "EMP-ADMIN-001",
		Role:       "admin",
	}, time.Hour)

	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	}))

	// 1. Anonymous GET /api/public/employees in demo MUST be blocked (401)
	req1 := httptest.NewRequest("GET", "/api/public/employees", nil)
	req1.RemoteAddr = "10.0.0.1:1234"
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous employee read in demo, got %d", rec1.Code)
	}

	// 2. Anonymous GET /api/public/students in demo MUST be blocked (401)
	req2 := httptest.NewRequest("GET", "/api/public/students", nil)
	req2.RemoteAddr = "10.0.0.2:1234"
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous student read in demo, got %d", rec2.Code)
	}

	// 3. Anonymous GET /api/public/dispatch/payrolls in demo MUST be blocked (401)
	req3 := httptest.NewRequest("GET", "/api/public/dispatch/payrolls", nil)
	req3.RemoteAddr = "10.0.0.3:1234"
	rec3 := httptest.NewRecorder()
	handler.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous payroll read in demo, got %d", rec3.Code)
	}

	// 4. Anonymous POST /api/public/dispatch/R101/check-in in demo MUST be blocked (401)
	req4 := httptest.NewRequest("POST", "/api/public/dispatch/R101/check-in", nil)
	req4.RemoteAddr = "10.0.0.4:1234"
	rec4 := httptest.NewRecorder()
	handler.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous check-in in demo, got %d", rec4.Code)
	}

	// 5. Anonymous POST /api/public/dispatch/time-off-requests/REQ1/approve in demo MUST be blocked (401)
	req5 := httptest.NewRequest("POST", "/api/public/dispatch/time-off-requests/REQ1/approve", nil)
	req5.RemoteAddr = "10.0.0.5:1234"
	rec5 := httptest.NewRecorder()
	handler.ServeHTTP(rec5, req5)
	if rec5.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous time-off approval in demo, got %d", rec5.Code)
	}

	// 6. Anonymous POST /api/public/dispatch/expense-reimbursements/EXP1/approve in demo MUST be blocked (401)
	req6 := httptest.NewRequest("POST", "/api/public/dispatch/expense-reimbursements/EXP1/approve", nil)
	req6.RemoteAddr = "10.0.0.6:1234"
	rec6 := httptest.NewRecorder()
	handler.ServeHTTP(rec6, req6)
	if rec6.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous expense approval in demo, got %d", rec6.Code)
	}

	// 7. Anonymous POST /api/public/ai/chat in demo MUST be blocked (401)
	req7 := httptest.NewRequest("POST", "/api/public/ai/chat", nil)
	req7.RemoteAddr = "10.0.0.7:1234"
	rec7 := httptest.NewRecorder()
	handler.ServeHTTP(rec7, req7)
	if rec7.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous AI chat in demo, got %d", rec7.Code)
	}

	// 8. Anonymous DELETE /api/public/yards/123 in demo MUST be blocked (401)
	req8 := httptest.NewRequest("DELETE", "/api/public/yards/123", nil)
	req8.RemoteAddr = "10.0.0.8:1234"
	rec8 := httptest.NewRecorder()
	handler.ServeHTTP(rec8, req8)
	if rec8.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous DELETE in demo, got %d", rec8.Code)
	}

	// 9. Authenticated Bearer request in demo SHOULD be allowed (200)
	req9 := httptest.NewRequest("GET", "/api/public/employees", nil)
	req9.Header.Set("Authorization", "Bearer "+validToken)
	req9.RemoteAddr = "10.0.0.9:1234"
	rec9 := httptest.NewRecorder()
	handler.ServeHTTP(rec9, req9)
	if rec9.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for authenticated employee read in demo, got %d", rec9.Code)
	}

	// 10. Query token (?token=...) MUST be rejected (401) to avoid leaking tokens in logs & history
	req10 := httptest.NewRequest("GET", "/api/public/employees?token="+validToken, nil)
	req10.RemoteAddr = "10.0.0.10:1234"
	rec10 := httptest.NewRecorder()
	handler.ServeHTTP(rec10, req10)
	if rec10.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for URL query token in demo, got %d", rec10.Code)
	}

	// 11. Anonymous route and shift reads MUST be blocked (401)
	req11a := httptest.NewRequest("GET", "/api/public/routes", nil)
	req11a.RemoteAddr = "10.0.0.11:1234"
	rec11a := httptest.NewRecorder()
	handler.ServeHTTP(rec11a, req11a)
	if rec11a.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous routes read, got %d", rec11a.Code)
	}

	req11b := httptest.NewRequest("GET", "/api/public/routes/R-101/shifts", nil)
	req11b.RemoteAddr = "10.0.0.11:1234"
	rec11b := httptest.NewRecorder()
	handler.ServeHTTP(rec11b, req11b)
	if rec11b.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous route shifts read, got %d", rec11b.Code)
	}

	// 12. Anonymous non-sensitive catalog read (/api/public/schools) within limit SHOULD be allowed (200)
	req12 := httptest.NewRequest("GET", "/api/public/schools", nil)
	req12.RemoteAddr = "10.0.0.12:1234"
	rec12 := httptest.NewRecorder()
	handler.ServeHTTP(rec12, req12)
	if rec12.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for anonymous school catalog in demo, got %d", rec12.Code)
	}
}

func TestDemoTokenSecurity(t *testing.T) {
	const secret = "test-public-guard-secret"
	authenticator := NewAuthenticator(nil, true).WithMCPTokenSecret(secret)

	var capturedUser *AuthUser
	handler := authenticator.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedUser = GetUser(r.Context())
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	}))

	t.Run("All mock admin tokens are strictly rejected", func(t *testing.T) {
		for _, token := range []string{"mock-admin-token-test", "mock-admin-token-secret-dev", "mock-admin-token-forged"} {
			req := httptest.NewRequest("GET", "/test", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401 Unauthorized for mock admin token %s, got %d", token, rec.Code)
			}
		}
	})

	t.Run("All mock driver tokens are strictly rejected", func(t *testing.T) {
		for _, token := range []string{"mock-token-driver1d", "mock-token-admin", "mock-token-tomm", "mock-token-fake"} {
			req := httptest.NewRequest("GET", "/test", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401 Unauthorized for mock driver token %s, got %d", token, rec.Code)
			}
		}
	})

	t.Run("Valid cryptographic MCP token is accepted", func(t *testing.T) {
		token, _, err := GenerateMCPToken(secret, &AuthUser{
			Username:   "driver1d",
			EmployeeID: "EMP-2001",
			Role:       "driver",
		}, time.Hour)
		if err != nil {
			t.Fatalf("failed to generate MCP token: %v", err)
		}

		capturedUser = nil
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for valid MCP token, got %d", rec.Code)
		}
		if capturedUser == nil || capturedUser.EmployeeID != "EMP-2001" || capturedUser.Role != "driver" {
			t.Fatalf("unexpected user in context: %+v", capturedUser)
		}
	})

	t.Run("Deactivated employee account is rejected with 403 Forbidden", func(t *testing.T) {
		deactivatedAuth := NewAuthenticator(nil, true).
			WithMCPTokenSecret(secret).
			WithUserResolver(func(ctx context.Context, u *AuthUser) (*AuthUser, error) {
				return nil, errors.New("employee account is deactivated")
			})

		deactivatedHandler := deactivatedAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		token, _, err := GenerateMCPToken(secret, &AuthUser{
			Username:   "deactivated_driver",
			EmployeeID: "EMP-9999",
			Role:       "driver",
		}, time.Hour)
		if err != nil {
			t.Fatalf("failed to generate token: %v", err)
		}

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		deactivatedHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden for deactivated employee, got %d", rec.Code)
		}
	})
}
