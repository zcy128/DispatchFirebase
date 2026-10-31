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
	UID             string                 `json:"uid"`
	Email           string                 `json:"email"`
	Username        string                 `json:"username,omitempty"`
	FullName        string                 `json:"fullName,omitempty"`
	Role            string                 `json:"role"`
	EmployeeID      string                 `json:"employeeId"`
	YardID          string                 `json:"yardId,omitempty"`
	Overrides       map[string]string      `json:"overrides"`
	PagePermissions map[string]string      `json:"-"`
	Claims          map[string]interface{} `json:"-"`
}

// UserResolverFunc looks up the latest Employee state (active status, role, pagePermissions) on the API server.
type UserResolverFunc func(ctx context.Context, user *AuthUser) (*AuthUser, error)

type Authenticator struct {
	client       *firebaseAuth.Client
	allowDemo    bool
	mcpSecret    string
	userResolver UserResolverFunc
}

func NewAuthenticator(client *firebaseAuth.Client, allowDemo bool) *Authenticator {
	return &Authenticator{
		client:    client,
		allowDemo: allowDemo,
	}
}

func (a *Authenticator) WithMCPTokenSecret(secret string) *Authenticator {
	a.mcpSecret = secret
	return a
}

func (a *Authenticator) WithUserResolver(resolver UserResolverFunc) *Authenticator {
	a.userResolver = resolver
	return a
}

// Middleware verifies the Bearer token (Firebase ID token, MCP PAT, or Demo token) and injects AuthUser into request context
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"authorization header required"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(strings.TrimSpace(authHeader), " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimSpace(parts[1])

		// 1. Check for signed MCP Personal Access Token (dsp_mcp_...)
		if strings.HasPrefix(tokenStr, MCPTokenPrefix) {
			user, err := VerifyMCPToken(a.mcpSecret, tokenStr)
			if err != nil {
				http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnauthorized)
				return
			}
			if a.userResolver != nil {
				resolved, err := a.userResolver(r.Context(), user)
				if err != nil {
					http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusForbidden)
					return
				}
				if resolved != nil {
					user = resolved
				}
			}
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// 2. Standard Firebase ID Token verification
		if a.client != nil {
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
			username := ""
			if u, ok := token.Claims["username"].(string); ok && u != "" {
				username = u
			}
			email := ""
			if em, ok := token.Claims["email"].(string); ok {
				email = em
			}

			user := &AuthUser{
				UID:        token.UID,
				Email:      email,
				Username:   username,
				Role:       role,
				EmployeeID: empID,
				Claims:     token.Claims,
			}

			if a.userResolver != nil {
				resolved, err := a.userResolver(r.Context(), user)
				if err != nil {
					http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusForbidden)
					return
				}
				if resolved != nil {
					user = resolved
				}
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// No mock tokens allowed: genuine cryptographic authentication is strictly required
		http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
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
