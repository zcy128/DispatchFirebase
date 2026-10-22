package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type LocalMCPConfig struct {
	ServerURL string `json:"serverUrl"`
	Token     string `json:"token"`
	ExpiresAt string `json:"expiresAt,omitempty"`
	Username  string `json:"username,omitempty"`
	Role      string `json:"role,omitempty"`
}

func configFilePath() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return ".dispatch-mcp.json"
	}
	return filepath.Join(home, ".dispatch-mcp.json")
}

const defaultServerURL = "https://dispatch-api-kv7qum3dca-nn.a.run.app"

func loadLocalConfig() *LocalMCPConfig {
	cfg := &LocalMCPConfig{
		ServerURL: defaultServerURL,
	}

	if data, err := os.ReadFile(configFilePath()); err == nil {
		_ = json.Unmarshal(data, cfg)
	}

	if envURL := strings.TrimSpace(os.Getenv("DISPATCH_SERVER_URL")); envURL != "" {
		cfg.ServerURL = envURL
	}
	if envToken := strings.TrimSpace(os.Getenv("DISPATCH_MCP_TOKEN")); envToken != "" {
		cfg.Token = envToken
	}

	cfg.ServerURL = strings.TrimRight(cfg.ServerURL, "/")
	if cfg.ServerURL == "" {
		cfg.ServerURL = defaultServerURL
	}
	return cfg
}

func saveLocalConfig(cfg *LocalMCPConfig) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configFilePath(), data, 0600)
}

func main() {
	if len(os.Args) > 1 {
		switch strings.ToLower(os.Args[1]) {
		case "login":
			runLoginCommand(os.Args[2:])
			return
		case "status":
			runStatusCommand()
			return
		case "help", "-h", "--help":
			printUsage()
			return
		}
	}

	runStdioBridge()
}

func printUsage() {
	fmt.Fprintf(os.Stderr, `Dispatch MCP CLI & Stdio Bridge

Usage:
  dispatch-mcp                                              Run as an MCP stdio server (for Cursor, Gemini, Codex, Claude)
  dispatch-mcp login --username <user> --password <pass>    Authenticate and save MCP token to ~/.dispatch-mcp.json
  dispatch-mcp login --token <dsp_mcp_...>                  Save a token generated from the Web Settings UI
  dispatch-mcp status                                       Verify saved login token and display API role permissions

Environment Variables (optional override):
  DISPATCH_SERVER_URL   Base URL of Dispatch Server (default: http://localhost:8080)
  DISPATCH_MCP_TOKEN    Personal Access Token (dsp_mcp_...)
`)
}

func runLoginCommand(args []string) {
	fs := flag.NewFlagSet("login", flag.ExitOnError)
	urlFlag := fs.String("url", defaultServerURL, "Dispatch API Server URL")
	userFlag := fs.String("username", "", "Dispatch username or email")
	passFlag := fs.String("password", "", "Dispatch account password")
	tokenFlag := fs.String("token", "", "Pre-generated MCP token (dsp_mcp_...)")
	_ = fs.Parse(args)

	serverURL := strings.TrimRight(strings.TrimSpace(*urlFlag), "/")
	if strings.TrimSpace(*tokenFlag) != "" {
		cfg := &LocalMCPConfig{
			ServerURL: serverURL,
			Token:     strings.TrimSpace(*tokenFlag),
		}
		if err := saveLocalConfig(cfg); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to save config: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Saved MCP token to %s\n", configFilePath())
		return
	}

	username := strings.TrimSpace(*userFlag)
	password := *passFlag

	reader := bufio.NewReader(os.Stdin)
	if username == "" {
		fmt.Print("Dispatch Username or Email: ")
		line, _ := reader.ReadString('\n')
		username = strings.TrimSpace(line)
	}
	if password == "" {
		fmt.Print("Password: ")
		line, _ := reader.ReadString('\n')
		password = strings.TrimSpace(line)
	}

	if username == "" || password == "" {
		fmt.Fprintln(os.Stderr, "Error: both username and password are required.")
		os.Exit(1)
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"username": username,
		"password": password,
		"ttlDays":  30,
	})

	reqURL := serverURL + "/api/auth/mcp-login"
	resp, err := http.Post(reqURL, "application/json", bytes.NewReader(payload))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect to %s: %v\n", reqURL, err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "Login failed (HTTP %d): %s\n", resp.StatusCode, strings.TrimSpace(string(body)))
		os.Exit(1)
	}

	var loginResp struct {
		Token     string `json:"token"`
		ExpiresAt string `json:"expiresAt"`
		User      struct {
			Username   string `json:"username"`
			Email      string `json:"email"`
			Role       string `json:"role"`
			EmployeeID string `json:"employeeId"`
		} `json:"user"`
	}
	if err := json.Unmarshal(body, &loginResp); err != nil {
		fmt.Fprintf(os.Stderr, "Invalid response from server: %v\n", err)
		os.Exit(1)
	}

	cfg := &LocalMCPConfig{
		ServerURL: serverURL,
		Token:     loginResp.Token,
		ExpiresAt: loginResp.ExpiresAt,
		Username:  loginResp.User.Email,
		Role:      loginResp.User.Role,
	}
	if err := saveLocalConfig(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to write %s: %v\n", configFilePath(), err)
		os.Exit(1)
	}

	fmt.Printf("Logged in successfully as %s (Role: %s, EmployeeID: %s)\n", loginResp.User.Email, loginResp.User.Role, loginResp.User.EmployeeID)
	fmt.Printf("Credentials saved to %s (Expires: %s)\n", configFilePath(), loginResp.ExpiresAt)
}

func runStatusCommand() {
	cfg := loadLocalConfig()
	if cfg.Token == "" {
		fmt.Fprintln(os.Stderr, "Not logged in. Run 'dispatch-mcp login' or set DISPATCH_MCP_TOKEN.")
		os.Exit(1)
	}

	rpcReq := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]interface{}{
			"name":      "get_my_profile",
			"arguments": map[string]interface{}{},
		},
	}
	b, _ := json.Marshal(rpcReq)

	req, err := http.NewRequest(http.MethodPost, cfg.ServerURL+"/api/mcp", bytes.NewReader(b))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Request error: %v\n", err)
		os.Exit(1)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.Token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Connection failed (%s): %v\n", cfg.ServerURL, err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "Server returned HTTP %d: %s\n", resp.StatusCode, strings.TrimSpace(string(body)))
		os.Exit(1)
	}

	fmt.Println(string(body))
}

func runStdioBridge() {
	cfg := loadLocalConfig()
	client := &http.Client{Timeout: 45 * time.Second}

	scanner := bufio.NewScanner(os.Stdin)
	buf := make([]byte, 0, 1024*1024)
	scanner.Buffer(buf, 4*1024*1024)

	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}

		// Reload config if token was empty so user can login without restarting IDE
		if cfg.Token == "" {
			cfg = loadLocalConfig()
		}

		var incoming struct {
			JSONRPC string          `json:"jsonrpc"`
			ID      json.RawMessage `json:"id,omitempty"`
			Method  string          `json:"method"`
		}
		_ = json.Unmarshal(line, &incoming)

		if cfg.Token == "" {
			handleUnauthenticatedStdio(incoming.ID, incoming.Method)
			continue
		}

		req, err := http.NewRequest(http.MethodPost, cfg.ServerURL+"/api/mcp", bytes.NewReader(line))
		if err != nil {
			writeStdioError(incoming.ID, -32603, err.Error())
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+cfg.Token)

		resp, err := client.Do(req)
		if err != nil {
			writeStdioError(incoming.ID, -32000, fmt.Sprintf("Failed to reach Dispatch Server (%s): %v", cfg.ServerURL, err))
			continue
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == http.StatusAccepted || len(bytes.TrimSpace(respBody)) == 0 {
			continue
		}

		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			writeAuthFailureResponse(incoming.ID, incoming.Method, resp.StatusCode, string(respBody))
			continue
		}

		// Write single-line JSON-RPC response to stdout
		var compact bytes.Buffer
		if err := json.Compact(&compact, respBody); err == nil {
			fmt.Fprintln(os.Stdout, compact.String())
		} else {
			fmt.Fprintln(os.Stdout, strings.TrimSpace(string(respBody)))
		}
	}
}

func handleUnauthenticatedStdio(id json.RawMessage, method string) {
	if len(id) == 0 {
		return
	}
	if method == "initialize" {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      id,
			"result": map[string]interface{}{
				"protocolVersion": "2024-11-05",
				"capabilities": map[string]interface{}{
					"tools": map[string]interface{}{},
				},
				"serverInfo": map[string]interface{}{
					"name":    "dispatch-mcp-server (unauthenticated)",
					"version": "1.0.0",
				},
			},
		}
		b, _ := json.Marshal(resp)
		fmt.Fprintln(os.Stdout, string(b))
		return
	}
	writeAuthFailureResponse(id, method, http.StatusUnauthorized, "No MCP login token found. Please run 'dispatch-mcp login' or set DISPATCH_MCP_TOKEN.")
}

func writeAuthFailureResponse(id json.RawMessage, method string, statusCode int, detail string) {
	if len(id) == 0 {
		return
	}
	msg := fmt.Sprintf("🔒 Authentication / Permission Error (HTTP %d): %s\n\nPlease log in via `dispatch-mcp login` or generate a fresh MCP Personal Access Token in Dispatch Web Settings.", statusCode, strings.TrimSpace(detail))
	if method == "tools/call" {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      id,
			"result": map[string]interface{}{
				"content": []map[string]string{
					{"type": "text", "text": msg},
				},
				"isError": true,
			},
		}
		b, _ := json.Marshal(resp)
		fmt.Fprintln(os.Stdout, string(b))
		return
	}
	writeStdioError(id, -32001, msg)
}

func writeStdioError(id json.RawMessage, code int, message string) {
	if len(id) == 0 {
		return
	}
	resp := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      id,
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
	}
	b, _ := json.Marshal(resp)
	fmt.Fprintln(os.Stdout, string(b))
}
