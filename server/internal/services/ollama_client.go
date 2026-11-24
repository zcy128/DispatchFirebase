package services

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

// OllamaTimeOffExtraction represents structured leave intent extracted by a local Ollama model.
type OllamaTimeOffExtraction struct {
	Intent         string `json:"intent"`         // "time_off" | "expense" | "other"
	DateText       string `json:"dateText"`       // "today" | "tomorrow" | "YYYY-MM-DD" | ""
	ShiftType      string `json:"shiftType"`      // "ALL" | "AM" | "PM" | "Midday"
	LeaveType      string `json:"leaveType"`      // "vacation" | "sick_leave" | "personal_days" | "jury_duty" | "bereavement_leave" | "other" | ""
	Substitute     string `json:"substitute"`     // driver id/name or ""
	HasSubstitute  *bool  `json:"hasSubstitute"`  // explicit true/false if stated
}

type ollamaChatRequest struct {
	Model    string                 `json:"model"`
	Messages []ollamaChatMessage    `json:"messages"`
	Think    bool                   `json:"think"`
	Format   string                 `json:"format,omitempty"`
	Stream   bool                   `json:"stream"`
	Options  map[string]interface{} `json:"options,omitempty"`
}

type ollamaChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ollamaChatResponse struct {
	Message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"message"`
	TotalDuration      int64 `json:"total_duration"`
	LoadDuration       int64 `json:"load_duration"`
	PromptEvalCount    int   `json:"prompt_eval_count"`
	PromptEvalDuration int64 `json:"prompt_eval_duration"`
	EvalCount          int   `json:"eval_count"`
	EvalDuration       int64 `json:"eval_duration"`
}

type ollamaChatResult struct {
	Content        string
	PromptTokens   int
	PromptEvalRate float64
	EvalTokens     int
	EvalRate       float64
	LoadDurationMs int64
}

// IsOllamaConfigured returns true when OLLAMA_BASE_URL is set (e.g. http://127.0.0.1:11434).
func IsOllamaConfigured() bool {
	return strings.TrimSpace(os.Getenv("OLLAMA_BASE_URL")) != ""
}

// GetOllamaConfig returns the trimmed Ollama base URL, model name (defaulting to qwen3.5:2b), and optional API key.
func GetOllamaConfig() (baseURL, model, apiKey string) {
	return getOllamaConfig()
}

func getOllamaConfig() (baseURL, model, apiKey string) {
	baseURL = strings.TrimRight(strings.TrimSpace(os.Getenv("OLLAMA_BASE_URL")), "/")
	model = strings.TrimSpace(os.Getenv("OLLAMA_MODEL"))
	if model == "" {
		model = "qwen3.5:2b"
	}
	apiKey = strings.TrimSpace(os.Getenv("OLLAMA_API_KEY"))
	return baseURL, model, apiKey
}

func callOllamaChat(ctx context.Context, systemPrompt, userMessage string, jsonMode bool) (string, error) {
	res, err := callOllamaChatDetailed(ctx, systemPrompt, userMessage, jsonMode)
	if err != nil {
		return "", err
	}
	return res.Content, nil
}

func callOllamaChatDetailed(ctx context.Context, systemPrompt, userMessage string, jsonMode bool) (*ollamaChatResult, error) {
	baseURL, model, apiKey := getOllamaConfig()
	if baseURL == "" {
		return nil, fmt.Errorf("OLLAMA_BASE_URL is not configured")
	}

	reqCtx, cancel := context.WithTimeout(ctx, 14*time.Second)
	defer cancel()

	payload := ollamaChatRequest{
		Model: model,
		Messages: []ollamaChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMessage},
		},
		Think:  false,
		Stream: false,
		Options: map[string]interface{}{
			"temperature": 0.1,
			"num_ctx":     2048,
		},
	}
	if jsonMode {
		payload.Format = "json"
	}

	rawBody, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodPost, baseURL+"/api/chat", bytes.NewReader(rawBody))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ollama HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var parsed ollamaChatResponse
	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return nil, err
	}

	out := &ollamaChatResult{
		Content:        strings.TrimSpace(parsed.Message.Content),
		PromptTokens:   parsed.PromptEvalCount,
		EvalTokens:     parsed.EvalCount,
		LoadDurationMs: parsed.LoadDuration / 1e6,
	}
	if parsed.PromptEvalCount > 0 && parsed.PromptEvalDuration > 0 {
		rate := float64(parsed.PromptEvalCount) / (float64(parsed.PromptEvalDuration) / 1e9)
		out.PromptEvalRate = math.Round(rate*100) / 100
	}
	if parsed.EvalCount > 0 && parsed.EvalDuration > 0 {
		rate := float64(parsed.EvalCount) / (float64(parsed.EvalDuration) / 1e9)
		out.EvalRate = math.Round(rate*100) / 100
	}
	return out, nil
}

// ExtractTimeOffIntentWithOllama extracts structured EN/FR leave fields using a lightweight local Ollama model.
func ExtractTimeOffIntentWithOllama(ctx context.Context, message string) (*OllamaTimeOffExtraction, error) {
	if !IsOllamaConfigured() || strings.TrimSpace(message) == "" {
		return nil, nil
	}
	systemPrompt := `Extract school bus employee request fields as strict JSON.
Schema:
{
  "intent": "time_off" | "expense" | "other",
  "dateText": "today" | "tomorrow" | "YYYY-MM-DD" | "",
  "shiftType": "ALL" | "AM" | "PM" | "Midday",
  "leaveType": "vacation" | "sick_leave" | "personal_days" | "jury_duty" | "bereavement_leave" | "other" | "",
  "substitute": string,
  "hasSubstitute": boolean | null
}
Examples:
Input: "tomorrow am only sick, ask driver41"
Output: {"intent":"time_off","dateText":"tomorrow","shiftType":"AM","leaveType":"sick_leave","substitute":"driver41","hasSubstitute":true}
Input: "je veux prendre congé demain sans remplaçant"
Output: {"intent":"time_off","dateText":"tomorrow","shiftType":"ALL","leaveType":"","substitute":"","hasSubstitute":false}`

	raw, err := callOllamaChat(ctx, systemPrompt, message, true)
	if err != nil {
		return nil, err
	}
	var out OllamaTimeOffExtraction
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ChatWithOllama generates a concise bilingual operational reply using the local Ollama model.
func ChatWithOllama(ctx context.Context, page, message, lang string) (string, error) {
	if !IsOllamaConfigured() || strings.TrimSpace(message) == "" {
		return "", fmt.Errorf("ollama not configured")
	}
	langLabel := "English"
	if strings.EqualFold(lang, "fr") {
		langLabel = "French"
	}
	systemPrompt := fmt.Sprintf(
		"You are a concise school bus fleet dispatch & HR assistant. Current page: %s. Reply in %s in 2-4 clear sentences. Never invent driver names, routes, or financial figures.",
		page, langLabel,
	)
	return callOllamaChat(ctx, systemPrompt, message, false)
}

// recordAIOperationError logs an AI provider failure to stdout and persists it to the system error_logs collection.
func recordAIOperationError(repo repository.DispatchRepository, page, action, endpoint, userID, userName string, err error) {
	if err == nil {
		return
	}
	msg := strings.TrimSpace(err.Error())
	if len(msg) > 1000 {
		msg = msg[:1000]
	}
	if strings.TrimSpace(page) == "" {
		page = "ai_copilot"
	}
	log.Printf("[AI_ERROR] page=%s action=%s endpoint=%s user=%s err=%s", page, action, endpoint, userID, msg)
	if repo == nil {
		return
	}

	now := time.Now().UTC()
	status := 502
	if strings.Contains(strings.ToLower(msg), "deadline exceeded") || strings.Contains(strings.ToLower(msg), "timeout") {
		status = 504
	}
	sum := sha1.Sum([]byte(fmt.Sprintf("%s|%s|%s|%d|%s", page, "POST", endpoint, status, msg)))
	fp := hex.EncodeToString(sum[:8])

	rec := &models.ClientOperationError{
		ID:           fmt.Sprintf("coe-ai-%d", now.UnixNano()),
		Timestamp:    now.Format(time.RFC3339),
		Date:         now.Format("2006-01-02"),
		Page:         page,
		Action:       action,
		Method:       "POST",
		Endpoint:     endpoint,
		Status:       status,
		Message:      msg,
		UserID:       strings.TrimSpace(userID),
		UserName:     strings.TrimSpace(userName),
		Fingerprint:  fp,
		EmailSkipped: "backend_ai_log",
	}

	saveCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, saveErr := repo.CreateClientOperationError(saveCtx, rec); saveErr != nil {
		log.Printf("[AI_ERROR] failed to persist system error log: %v", saveErr)
	}
}
