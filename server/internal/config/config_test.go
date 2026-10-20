package config

import "testing"

func TestUnsetAppModeStaysDemo(t *testing.T) {
	t.Setenv("APP_MODE", "")
	t.Setenv("ADMIN_PASSWORD", "")
	t.Setenv("APPROVAL_SECRET", "")

	cfg := LoadConfig()
	if cfg.AppMode != "demo" {
		t.Fatalf("AppMode = %q, want demo", cfg.AppMode)
	}
	if !cfg.AllowsDemo() {
		t.Fatal("unset APP_MODE should allow demo features")
	}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	if cfg.AdminPassword == "" || cfg.ApprovalSecret == "" {
		t.Fatal("demo mode should keep local fallback secrets")
	}
}

func TestProductionRefusesPublishedSecrets(t *testing.T) {
	t.Setenv("APP_MODE", "production")
	t.Setenv("ADMIN_PASSWORD", "")
	t.Setenv("ADMIN_API_SECRET", "")
	t.Setenv("APPROVAL_SECRET", "")
	t.Setenv("PARENT_JWT_SIGNING_KEY", "")

	cfg := LoadConfig()
	if cfg.AllowsDemo() {
		t.Fatal("production mode must disable demo features")
	}
	if cfg.AdminPassword != "" || cfg.ApprovalSecret != "" {
		t.Fatal("production mode must not fill published fallback secrets")
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected production validation to fail")
	}
}

func TestProductionAcceptsPrivateSecrets(t *testing.T) {
	t.Setenv("APP_MODE", "production")
	t.Setenv("ADMIN_PASSWORD", "private-admin-password-1")
	t.Setenv("ADMIN_API_SECRET", "private-admin-api-secret-1")
	t.Setenv("APPROVAL_SECRET", "private-approval-secret-1")
	t.Setenv("PARENT_JWT_SIGNING_KEY", "private-parent-jwt-key-1")

	cfg := LoadConfig()
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
}
