package auth

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// IPRateLimiter provides a thread-safe sliding-window rate limiter per client IP.
type IPRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	limit    int
	window   time.Duration
}

type visitor struct {
	count   int
	resetAt time.Time
}

// NewIPRateLimiter creates an IPRateLimiter and starts a periodic cleanup routine.
func NewIPRateLimiter(limit int, window time.Duration) *IPRateLimiter {
	limiter := &IPRateLimiter{
		visitors: make(map[string]*visitor),
		limit:    limit,
		window:   window,
	}

	// Periodic cleanup every 5 minutes to avoid memory growth from transient IPs
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			limiter.cleanup()
		}
	}()

	return limiter
}

func (l *IPRateLimiter) cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	for ip, v := range l.visitors {
		if now.After(v.resetAt) {
			delete(l.visitors, ip)
		}
	}
}

// Allow returns true if the request from ip is within the rate limit.
func (l *IPRateLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	v, exists := l.visitors[ip]
	if !exists || now.After(v.resetAt) {
		l.visitors[ip] = &visitor{
			count:   1,
			resetAt: now.Add(l.window),
		}
		return true
	}

	if v.count >= l.limit {
		return false
	}

	v.count++
	return true
}

// isPrivateOrLoopbackIP returns true if the ip string represents loopback or private network space.
func isPrivateOrLoopbackIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}

// GetClientIP extracts the real client IP.
// To prevent rate-limit bypass via spoofed X-Forwarded-For headers (CWE-345),
// it inspects trusted edge headers (CF-Connecting-IP), the nearest proxy hop (last XFF entry)
// if connected via loopback/proxy, or falls back to the peer TCP RemoteAddr.
func GetClientIP(r *http.Request) string {
	// 1. Cloudflare edge header (cannot be forged by the client when behind Cloudflare)
	if cfIP := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cfIP != "" {
		if net.ParseIP(cfIP) != nil {
			return cfIP
		}
	}

	// 2. TCP peer host
	peerHost, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		peerHost = r.RemoteAddr
	}

	// 3. If connected via a reverse proxy (peerHost is loopback or private network like Cloud Run/Nginx),
	// take the nearest proxy-added IP (the last entry in X-Forwarded-For, NOT the spoofable first entry).
	if isPrivateOrLoopbackIP(peerHost) {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			for i := len(parts) - 1; i >= 0; i-- {
				candidate := strings.TrimSpace(parts[i])
				if candidate != "" && net.ParseIP(candidate) != nil {
					return candidate
				}
			}
		}
		if xrip := strings.TrimSpace(r.Header.Get("X-Real-IP")); xrip != "" && net.ParseIP(xrip) != nil {
			return xrip
		}
	}

	// 4. Direct connection: trust the peer TCP address
	if peerHost != "" {
		return peerHost
	}
	return r.RemoteAddr
}

// isSensitiveDataPath returns true if the endpoint contains personal identifiable information (PII),
// staff compensation, internal communications, or dispatch operational management records.
func isSensitiveDataPath(path string) bool {
	p := strings.ToLower(path)

	// Students PII
	if strings.Contains(p, "/students") {
		return true
	}
	// Employees PII & compensation
	if strings.Contains(p, "/employees") {
		return true
	}
	// Payroll & wage records
	if strings.Contains(p, "/payroll") {
		return true
	}
	// Chat & internal communications
	if strings.Contains(p, "/chat") {
		return true
	}
	// AI assistant / copilot endpoints
	if strings.HasPrefix(p, "/api/public/ai") {
		return true
	}
	// Dispatch operational records (shifts, check-in, attendance, time-off, expense, defect, hazard, incident)
	if strings.HasPrefix(p, "/api/public/dispatch") {
		return true
	}
	// Routes and shifts (contain student stop locations, home addresses, timetables)
	if strings.Contains(p, "/routes") || strings.Contains(p, "/shifts") {
		return true
	}

	return false
}

// PublicAPISecurityMiddleware creates a middleware protecting /api/public fallback routes.
// - In Production (allowDemo == false): Any unauthenticated request is rejected with 401 Unauthorized.
// - In Demo Mode (allowDemo == true):
//     * Valid Bearer tokens are verified via authenticator. URL query tokens are deliberately rejected to prevent log leakage.
//     * All mutations (POST, PUT, PATCH, DELETE) require authentication (401). Anonymous callers
//       cannot check in, alter attendance, approve time-off/expenses, or mutate state.
//     * Access to sensitive PII and operational records (students, employees, routes, shifts, payroll, chat, dispatch)
//       requires authentication (401).
//     * Only non-sensitive public catalogs (e.g. schools, vehicles, yards) can be viewed anonymously,
//       and are strictly rate-limited to 60 requests per minute per IP (429).
func PublicAPISecurityMiddleware(allowDemo bool, authenticator *Authenticator) func(http.Handler) http.Handler {
	limiter := NewIPRateLimiter(60, time.Minute)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token exclusively from the Authorization header (no URL query token allowed for security)
			authHeader := r.Header.Get("Authorization")
			hasAuth := strings.TrimSpace(authHeader) != ""

			// 1. If an Authorization token is provided, use authenticator to verify
			if hasAuth {
				authenticator.Middleware(next).ServeHTTP(w, r)
				return
			}

			// 2. Production Mode: strictly reject all anonymous requests
			if !allowDemo {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"authentication required: public dev endpoints are disabled in production mode"}`))
				return
			}

			// 3. Demo Mode Guardrails for Anonymous Callers:
			// 3a. Block ALL state modifications (POST, PUT, PATCH, DELETE)
			// Anonymous users cannot check in, alter attendance, approve requests, or delete/update data
			if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"authentication required: sign in or provide a demo token to perform operations (check-in, attendance, approvals, modifications, or AI)"}`))
				return
			}

			// 3b. Block anonymous reads of sensitive PII, payroll, chat, and dispatch operational data
			if isSensitiveDataPath(r.URL.Path) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"authentication required: access to student, employee, payroll, or dispatch records requires demo login or a valid Bearer token"}`))
				return
			}

			// 3c. Rate limit remaining safe catalog requests (60 req/min per IP)
			ip := GetClientIP(r)
			if !limiter.Allow(ip) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"too many requests: anonymous requests are limited to 60 per minute per IP"}`))
				return
			}

			// Allow through for harmless catalog reads (e.g. schools, vehicles, yards)
			next.ServeHTTP(w, r)
		})
	}
}
