package handlers

import (
	"testing"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
)

func TestFirebaseCustomClaimsIncludesRoleAndOverrides(t *testing.T) {
	claims := firebaseCustomClaims(&auth.AuthUser{
		UID:        "mock-admin-uid-001",
		Email:      "admin@dispatch.pcy.ca",
		Username:   "admin",
		Role:       "admin",
		EmployeeID: "EMP-ADMIN-001",
		YardID:     "YARD-1",
		Overrides:  map[string]string{"dispatch": "readwrite"},
	})

	if claims["role"] != "admin" {
		t.Fatalf("role = %v", claims["role"])
	}
	if claims["employeeId"] != "EMP-ADMIN-001" {
		t.Fatalf("employeeId = %v", claims["employeeId"])
	}
	if claims["email"] != "admin@dispatch.pcy.ca" {
		t.Fatalf("email = %v", claims["email"])
	}
	ovr, ok := claims["ovr"].(map[string]interface{})
	if !ok || ovr["dispatch"] != "readwrite" {
		t.Fatalf("ovr = %#v", claims["ovr"])
	}
}

func TestFirebaseCustomClaimsSkipsEmptyUser(t *testing.T) {
	claims := firebaseCustomClaims(nil)
	if len(claims) != 0 {
		t.Fatalf("expected empty claims, got %#v", claims)
	}
}

func TestSyntheticUIDDetectsDemoPlaceholders(t *testing.T) {
	if !isSyntheticUID("") || !isSyntheticUID("mock-admin-uid-001") || !isSyntheticUID("mock-uid-driver") {
		t.Fatal("expected placeholder uids to be synthetic")
	}
	if isSyntheticUID("firebase-uid-alex") {
		t.Fatal("real uid was treated as synthetic")
	}
}

func TestFirebaseAuthEmailsPreferLoginIdentity(t *testing.T) {
	emails := firebaseAuthEmails(
		&auth.AuthUser{Email: "admin@dispatch.pcy.ca", Username: "admin"},
		&models.Employee{Username: "alexm", WorkEmail: "admin@dispatch.local"},
	)
	if len(emails) < 3 || emails[0] != "admin@dispatch.pcy.ca" {
		t.Fatalf("emails = %#v", emails)
	}
	if emails[1] != "alexm@dispatch.pcy.ca" {
		t.Fatalf("employee auth email = %s", emails[1])
	}
}

func TestIssueFirebaseCustomTokenWithoutClient(t *testing.T) {
	handler := NewAuthHandler(nil, nil, nil)
	_, err := handler.issueFirebaseCustomToken(t.Context(), &auth.AuthUser{UID: "mock-admin-uid-001", Role: "admin"})
	if err == nil {
		t.Fatal("expected error when firebase auth client is missing")
	}
}
