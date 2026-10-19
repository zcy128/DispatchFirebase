package auth

import (
	"context"
	"net/http"
	"strings"

	firebaseAuth "firebase.google.com/go/v4/auth"
)

type contextKey string

const (
	UserContextKey contextKey = "dispatch_user"
)

type AuthUser struct {
	UID        string                 `json:"uid"`
	Email      string                 `json:"email"`
	Role       string                 `json:"role"`
	EmployeeID string                 `json:"employeeId"`
	Claims     map[string]interface{} `json:"claims"`
}

type Authenticator struct {
	client        *firebaseAuth.Client
	isDevelopment bool
}

func NewAuthenticator(client *firebaseAuth.Client, isDevelopment bool) *Authenticator {
	return &Authenticator{
		client:        client,
		isDevelopment: isDevelopment,
	}
}

// Middleware verifies the Firebase Bearer token and injects AuthUser into request context
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			// Allow anonymous or return unauthorized
			http.Error(w, `{"error":"authorization header required"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := parts[1]

		// Support mock admin token (for local development, demo mode, and 1-click admin launch)
		if strings.HasPrefix(tokenStr, "mock-admin-token") {
			role := "admin"
			if rRole := r.Header.Get("X-User-Role"); rRole != "" {
				role = rRole
			}
			user := &AuthUser{
				UID:        "mock-admin-uid-001",
				Email:      "admin@dispatch.pcy.ca",
				Role:       role,
				EmployeeID: "EMP-ADMIN-001",
				Claims: map[string]interface{}{
					"role": role,
				},
			}
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Support mock token for custom username
		if strings.HasPrefix(tokenStr, "mock-token-") {
			username := strings.TrimPrefix(tokenStr, "mock-token-")
			role := "driver"
			if rRole := r.Header.Get("X-User-Role"); rRole != "" {
				role = rRole
			}
			user := &AuthUser{
				UID:        "mock-uid-" + username,
				Email:      username + "@dispatch.pcy.ca",
				Role:       role,
				EmployeeID: "EMP-" + username,
				Claims: map[string]interface{}{
					"role":     role,
					"username": username,
				},
			}
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if a.client == nil {
			// No Firebase auth client configured, and not a mock token
			http.Error(w, `{"error":"firebase auth not configured on server"}`, http.StatusServiceUnavailable)
			return
		}

		token, err := a.client.VerifyIDToken(r.Context(), tokenStr)
		if err != nil {
			http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		role := "staff"
		if r, ok := token.Claims["role"].(string); ok && r != "" {
			role = r
		}
		empID := ""
		if e, ok := token.Claims["employeeId"].(string); ok && e != "" {
			empID = e
		}

		email := ""
		if em, ok := token.Claims["email"].(string); ok {
			email = em
		}

		user := &AuthUser{
			UID:        token.UID,
			Email:      email,
			Role:       role,
			EmployeeID: empID,
			Claims:     token.Claims,
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole checks that the user has at least one of the specified roles
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(*AuthUser)
			if !ok || user == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			hasRole := false
			for _, role := range roles {
				if strings.EqualFold(user.Role, role) {
					hasRole = true
					break
				}
			}

			if !hasRole {
				http.Error(w, `{"error":"forbidden: insufficient role privileges"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetUser extracts the AuthUser from context
func GetUser(ctx context.Context) *AuthUser {
	if user, ok := ctx.Value(UserContextKey).(*AuthUser); ok {
		return user
	}
	return nil
}
