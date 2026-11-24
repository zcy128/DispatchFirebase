package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

func TestOllamaErrorPersistedToSystemErrorLogs(t *testing.T) {
	failServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "model overloaded", http.StatusInternalServerError)
	}))
	defer failServer.Close()

	t.Setenv("OLLAMA_BASE_URL", failServer.URL)
	t.Setenv("OLLAMA_MODEL", "qwen3.5:2b")
	t.Setenv("GEMINI_API_KEY", "")

	dispatchRepo := repository.NewMemoryDispatchRepository()
	empRepo := repository.NewMemoryEmployeeRepository()
	routeRepo := repository.NewMemoryRouteRepository()

	t.Run("AIService_ProcessChat_LogsOllamaError", func(t *testing.T) {
		toolSvc := NewAIToolService(dispatchRepo, empRepo, routeRepo, nil, nil, nil)
		aiSvc := NewAIService(toolSvc)

		resp, err := aiSvc.ProcessChat(context.Background(), &models.AIChatRequest{
			Message:      "Tell me a motivational quote for dispatchers",
			ActivePage:   "dispatch",
			OperatorID:   "admin-1",
			OperatorName: "Alice Admin",
		})
		if err != nil {
			t.Fatalf("expected fallback response, got error: %v", err)
		}
		if resp.Engine != "builtin" {
			t.Fatalf("expected builtin fallback engine, got %q", resp.Engine)
		}

		logs, err := dispatchRepo.ListClientOperationErrors(context.Background(), 20, "")
		if err != nil {
			t.Fatalf("failed to list system error logs: %v", err)
		}
		if len(logs) == 0 {
			t.Fatalf("expected AI error to be persisted in system error logs")
		}
		latest := logs[0]
		if latest.Action != "ollama_chat" || latest.Page != "dispatch" || latest.Status != 502 {
			t.Fatalf("unexpected error log record: %+v", latest)
		}
		if !strings.Contains(latest.Message, "ollama HTTP 500") {
			t.Fatalf("expected error message to include HTTP 500, got %q", latest.Message)
		}
	})

	t.Run("OfficeConcierge_LogsOllamaExtractError", func(t *testing.T) {
		concierge := NewOfficeConciergeService(dispatchRepo, empRepo, routeRepo)
		_, err := concierge.ProcessOfficeConciergeChat(context.Background(), &models.OfficeConciergeChatRequest{
			EmployeeID:   "drv-1",
			EmployeeName: "Bob Driver",
			Message:      "need to see my dentist Friday morning",
		})
		if err != nil {
			t.Fatalf("expected concierge fallback, got error: %v", err)
		}

		logs, err := dispatchRepo.ListClientOperationErrors(context.Background(), 20, "time_off_concierge")
		if err != nil {
			t.Fatalf("failed to list concierge error logs: %v", err)
		}
		if len(logs) == 0 {
			t.Fatalf("expected concierge AI extraction error to be persisted")
		}
		if logs[0].Action != "ollama_timeoff_extract" {
			t.Fatalf("expected action ollama_timeoff_extract, got %q", logs[0].Action)
		}
	})
}
