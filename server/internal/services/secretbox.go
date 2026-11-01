package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const sealedSecretPrefix = "enc:v1:"

func integrationKey() []byte {
	raw := firstPrivateIntegrationSecret()
	if raw == "" && !strings.EqualFold(strings.TrimSpace(os.Getenv("APP_MODE")), "production") {
		raw = localDevIntegrationSecret()
	}
	if raw == "" {
		return nil
	}
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}

// IntegrationKeyConfigured reports whether production can seal integration passwords.
func IntegrationKeyConfigured() bool {
	return integrationKey() != nil
}

func firstPrivateIntegrationSecret() string {
	for _, name := range []string{"INTEGRATION_SECRET_KEY", "MCP_TOKEN_SECRET", "APPROVAL_SECRET"} {
		raw := strings.TrimSpace(os.Getenv(name))
		if raw == "" || raw == "DevApprovalSecretChangeInProduction" {
			continue
		}
		return raw
	}
	return ""
}

func sealSecret(plain string) (string, error) {
	plain = strings.TrimSpace(plain)
	if plain == "" || strings.HasPrefix(plain, sealedSecretPrefix) {
		return plain, nil
	}
	key := integrationKey()
	if key == nil {
		return "", errors.New("integration secret key is not configured")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return sealedSecretPrefix + base64.RawStdEncoding.EncodeToString(sealed), nil
}

func openSecret(stored string) (string, error) {
	if !strings.HasPrefix(stored, sealedSecretPrefix) {
		return stored, nil
	}
	key := integrationKey()
	if key == nil {
		return "", errors.New("integration secret key is not configured")
	}
	raw, err := base64.RawStdEncoding.DecodeString(strings.TrimPrefix(stored, sealedSecretPrefix))
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("sealed secret is truncated")
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

var (
	devKeyOnce  sync.Once
	devKeyValue string
)

func localDevIntegrationSecret() string {
	devKeyOnce.Do(func() {
		path := localDevKeyPath()
		if raw, err := os.ReadFile(path); err == nil {
			devKeyValue = strings.TrimSpace(string(raw))
		}
		if devKeyValue == "" || devKeyValue == "DevApprovalSecretChangeInProduction" {
			buf := make([]byte, 32)
			if _, err := rand.Read(buf); err != nil {
				log.Printf("[WARN] Could not generate a local integration key: %v", err)
				return
			}
			devKeyValue = base64.RawURLEncoding.EncodeToString(buf)
			if err := os.WriteFile(path, []byte(devKeyValue), 0600); err != nil {
				log.Printf("[WARN] Using an in-memory integration key because %s could not be written: %v", path, err)
				return
			}
		}
		log.Printf("[WARN] INTEGRATION_SECRET_KEY is not set. Local secrets use %s. Set INTEGRATION_SECRET_KEY before sharing this database.", path)
	})
	return devKeyValue
}

func localDevKeyPath() string {
	dir, err := os.Getwd()
	if err != nil {
		return filepath.Join(os.TempDir(), ".integration-dev-key")
	}
	start := dir
	for i := 0; i < 8; i++ {
		if _, statErr := os.Stat(filepath.Join(dir, "go.mod")); statErr == nil {
			if _, cmdErr := os.Stat(filepath.Join(dir, "cmd", "server", "main.go")); cmdErr == nil {
				return filepath.Join(dir, ".integration-dev-key")
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return filepath.Join(start, ".integration-dev-key")
}
