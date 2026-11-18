package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestOpenAPIContractMatchesServerRoutes ensures every path and HTTP method
// declared in contracts/openapi.yaml is registered in server/cmd/server/main.go.
func TestOpenAPIContractMatchesServerRoutes(t *testing.T) {
	mainBytes, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("failed to read main.go: %v", err)
	}
	mainSrc := string(mainBytes)

	specPath := filepath.Join("..", "..", "..", "contracts", "openapi.yaml")
	specBytes, err := os.ReadFile(specPath)
	if err != nil {
		t.Fatalf("failed to read %s: %v", specPath, err)
	}

	var currentPath string
	inPaths := false
	checked := 0

	for _, rawLine := range strings.Split(string(specBytes), "\n") {
		line := strings.TrimRight(rawLine, "\r")
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if line == "paths:" {
			inPaths = true
			continue
		}
		if inPaths && !strings.HasPrefix(line, " ") && !strings.HasPrefix(line, "\t") {
			break
		}
		if !inPaths {
			continue
		}

		// Top-level path key under paths: (2-space indent)
		if strings.HasPrefix(line, "  /") && strings.HasSuffix(trimmed, ":") {
			currentPath = strings.TrimSuffix(trimmed, ":")
			continue
		}

		// HTTP method key under path (4-space indent)
		if currentPath != "" && strings.HasPrefix(line, "    ") && !strings.HasPrefix(line, "      ") && strings.HasSuffix(trimmed, ":") {
			method := strings.TrimSuffix(trimmed, ":")
			chiMethod := toChiMethod(method)
			if chiMethod == "" {
				continue
			}
			expectedCall := `.` + chiMethod + `("` + currentPath + `"`
			if !strings.Contains(mainSrc, expectedCall) {
				t.Errorf("OpenAPI contract %s %s is not registered in main.go (missing %s)", strings.ToUpper(method), currentPath, expectedCall)
			}
			checked++
		}
	}

	if checked == 0 {
		t.Fatal("expected at least one OpenAPI path/method pair to verify")
	}
}

func toChiMethod(method string) string {
	switch strings.ToLower(method) {
	case "get":
		return "Get"
	case "post":
		return "Post"
	case "put":
		return "Put"
	case "patch":
		return "Patch"
	case "delete":
		return "Delete"
	default:
		return ""
	}
}
