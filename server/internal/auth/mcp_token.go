package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	MCPTokenPrefix     = "dsp_mcp_"
	DefaultMCPTokenTTL = 30 * 24 * time.Hour
	defaultFallbackKey = "dispatch-default-mcp-signing-key-2026"
)

var (
	ErrInvalidMCPToken = errors.New("invalid MCP access token")
	ErrExpiredMCPToken = errors.New("MCP access token has expired")
)

type MCPTokenClaims struct {
	UID        string `json:"uid"`
	Email      string `json:"email"`
	Username   string `json:"username,omitempty"`
	FullName   string `json:"fullName,omitempty"`
	EmployeeID string `json:"employeeId"`
	Role       string `json:"role"`
	IssuedAt   int64  `json:"iat"`
	ExpiresAt  int64  `json:"exp"`
}

func resolveSigningSecret(secret string) []byte {
	clean := strings.TrimSpace(secret)
	if clean == "" {
		clean = defaultFallbackKey
	}
	return []byte(clean)
}

// GenerateMCPToken creates an HMAC-SHA256 signed Personal Access Token for MCP clients.
func GenerateMCPToken(secret string, user *AuthUser, ttl time.Duration) (string, time.Time, error) {
	if user == nil || (user.UID == "" && user.EmployeeID == "" && user.Email == "") {
		return "", time.Time{}, errors.New("valid authenticated user required to issue MCP token")
	}
	if ttl <= 0 {
		ttl = DefaultMCPTokenTTL
	}

	now := time.Now().UTC()
	exp := now.Add(ttl)

	claims := MCPTokenClaims{
		UID:        user.UID,
		Email:      user.Email,
		Username:   user.Username,
		FullName:   user.FullName,
		EmployeeID: user.EmployeeID,
		Role:       user.Role,
		IssuedAt:   now.Unix(),
		ExpiresAt:  exp.Unix(),
	}

	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to marshal token claims: %w", err)
	}

	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadBytes)
	mac := hmac.New(sha256.New, resolveSigningSecret(secret))
	_, _ = mac.Write([]byte(payloadB64))
	sigB64 := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	token := fmt.Sprintf("%s%s.%s", MCPTokenPrefix, payloadB64, sigB64)
	return token, exp, nil
}

// VerifyMCPToken validates the signature and expiration of a dsp_mcp_ token.
func VerifyMCPToken(secret string, tokenStr string) (*AuthUser, error) {
	trimmed := strings.TrimSpace(tokenStr)
	if !strings.HasPrefix(trimmed, MCPTokenPrefix) {
		return nil, ErrInvalidMCPToken
	}

	raw := strings.TrimPrefix(trimmed, MCPTokenPrefix)
	parts := strings.Split(raw, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return nil, ErrInvalidMCPToken
	}

	payloadB64, sigB64 := parts[0], parts[1]

	expectedMAC := hmac.New(sha256.New, resolveSigningSecret(secret))
	_, _ = expectedMAC.Write([]byte(payloadB64))
	expectedSig := expectedMAC.Sum(nil)

	actualSig, err := base64.RawURLEncoding.DecodeString(sigB64)
	if err != nil || !hmac.Equal(actualSig, expectedSig) {
		return nil, ErrInvalidMCPToken
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, ErrInvalidMCPToken
	}

	var claims MCPTokenClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, ErrInvalidMCPToken
	}

	if claims.ExpiresAt > 0 && time.Now().UTC().Unix() > claims.ExpiresAt {
		return nil, ErrExpiredMCPToken
	}

	return &AuthUser{
		UID:        claims.UID,
		Email:      claims.Email,
		Username:   claims.Username,
		FullName:   claims.FullName,
		Role:       claims.Role,
		EmployeeID: claims.EmployeeID,
		Claims: map[string]interface{}{
			"role":       claims.Role,
			"employeeId": claims.EmployeeID,
			"username":   claims.Username,
			"authType":   "mcp_pat",
		},
	}, nil
}
