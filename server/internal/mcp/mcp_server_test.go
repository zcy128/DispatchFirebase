package mcp_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/config"
	"dispatch-server/internal/handlers"
	"dispatch-server/internal/mcp"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

type testDispatchRepo struct {
	repository.DispatchRepository
	shifts     []*models.DispatchShift
	changeLogs []*models.DispatchChangeLog
}

func (r *testDispatchRepo) ListShifts(ctx context.Context, date string, filter repository.DispatchFilter) ([]*models.DispatchShift, error) {
	return r.shifts, nil
}

func (r *testDispatchRepo) UpdateShift(ctx context.Context, id string, req *models.UpdateDispatchShiftRequest) (*models.DispatchShift, error) {
	for _, s := range r.shifts {
		if s.ID == id {
			if req.DriverID != nil {
				s.DriverID = *req.DriverID
			}
			if req.DriverName != nil {
				s.DriverName = *req.DriverName
			}
			if req.DriverPhone != nil {
				s.DriverPhone = *req.DriverPhone
			}
			return s, nil
		}
	}
	return nil, nil
}

func (r *testDispatchRepo) AddChangeLog(ctx context.Context, log *models.DispatchChangeLog) (*models.DispatchChangeLog, error) {
	r.changeLogs = append(r.changeLogs, log)
	return log, nil
}

func (r *testDispatchRepo) ListChangeLogs(ctx context.Context, date string) ([]*models.DispatchChangeLog, error) {
	return r.changeLogs, nil
}

func setupMCPTestHarness(t *testing.T) (
	http.Handler,
	repository.EmployeeRepository,
	repository.DispatchRepository,
	*config.Config,
) {
	t.Helper()
	ctx := context.Background()

	cfg := &config.Config{
		AppMode:        "demo",
		IsDevelopment:  true,
		MCPTokenSecret: "test-mcp-secret-key-2026",
		AdminEmail:     "admin@dispatch.local",
		AdminPassword:  "Admin@Dispatch2026!",
		AppBaseURL:     "http://localhost:8080",
	}

	empRepo := repository.NewMemoryEmployeeRepository()
	baseDispatchRepo := repository.NewMemoryDispatchRepository()
	dispatchRepo := &testDispatchRepo{
		DispatchRepository: baseDispatchRepo,
		shifts: []*models.DispatchShift{
			{
				ID:            "SHIFT-CSDF-001-AM",
				DispatchDate:  "2026-10-21",
				RouteID:       "RT-001",
				RouteNo:       "CSDF-001",
				RouteName:     "CSDF Morning Run",
				ShiftType:     "AM",
				FirstStopTime: "07:30",
				UnitNumber:    "B-101",
				YardName:      "North Yard",
				Health:        models.HealthRed,
			},
		},
	}
	routeRepo := repository.NewMemoryRouteRepository()
	vehicleRepo := repository.NewInMemoryVehicleRepository()
	payrollRepo := repository.NewMemoryPayrollRepository()
	studentRepo := repository.NewMemoryStudentRepository()

	now := time.Now()
	employees := []*models.Employee{
		{
			ID:             "EMP-DISP-01",
			EmployeeNumber: "EMP-DISP-01",
			FirstName:      "Sarah",
			LastName:       "Connor",
			Username:       "sarahc",
			WorkEmail:      "sarahc@dispatch.pcy.ca",
			Role:           "dispatcher",
			IsActive:       true,
			CreatedAt:      now,
			UpdatedAt:      now,
		},
		{
			ID:             "EMP-HR-01",
			EmployeeNumber: "EMP-HR-01",
			FirstName:      "Helen",
			LastName:       "Reyes",
			Username:       "helenr",
			WorkEmail:      "helenr@dispatch.pcy.ca",
			Role:           "HR",
			IsActive:       true,
			CreatedAt:      now,
			UpdatedAt:      now,
		},
		{
			ID:             "EMP-PAY-01",
			EmployeeNumber: "EMP-PAY-01",
			FirstName:      "Paul",
			LastName:       "Finance",
			Username:       "paulf",
			WorkEmail:      "paulf@dispatch.pcy.ca",
			Role:           "payroll",
			IsActive:       true,
			CreatedAt:      now,
			UpdatedAt:      now,
		},
		{
			ID:             "EMP-DRV-01",
			EmployeeNumber: "EMP-DRV-01",
			FirstName:      "Tom",
			LastName:       "Miller",
			Username:       "tomm",
			WorkEmail:      "tomm@dispatch.pcy.ca",
			MobilePhone:    "613-555-0199",
			Role:           "driver",
			IsActive:       true,
			CreatedAt:      now,
			UpdatedAt:      now,
		},
	}

	for _, e := range employees {
		e.ComputeComputedFields()
		if err := empRepo.Create(ctx, e); err != nil {
			t.Fatalf("failed to seed employee %s: %v", e.EmployeeNumber, err)
		}
	}

	authHandler := handlers.NewAuthHandler(empRepo, nil, cfg)
	authenticator := auth.NewAuthenticator(nil, true).
		WithMCPTokenSecret(cfg.MCPTokenSecret).
		WithUserResolver(authHandler.ResolveEmployeeAuthUser)

	aiTools := services.NewAIToolService(dispatchRepo, empRepo, routeRepo, vehicleRepo, payrollRepo, studentRepo)
	mcpServer := mcp.NewServer(aiTools, dispatchRepo, empRepo)
	mcpHandler := handlers.NewMCPHandler(mcpServer)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/mcp-login", authHandler.LoginMCP)
	mux.Handle("/api/auth/mcp-token", authenticator.Middleware(http.HandlerFunc(authHandler.IssueMCPToken)))
	mux.Handle("/api/mcp", authenticator.Middleware(http.HandlerFunc(mcpHandler.HandleHTTP)))

	return mux, empRepo, dispatchRepo, cfg
}

func callMCPToolHTTP(t *testing.T, handler http.Handler, token string, toolName string, args map[string]interface{}) (int, *mcp.JSONRPCResponse) {
	t.Helper()
	rpcBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]interface{}{
			"name":      toolName,
			"arguments": args,
		},
	}
	b, _ := json.Marshal(rpcBody)
	req := httptest.NewRequest(http.MethodPost, "/api/mcp", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		return rec.Code, nil
	}

	var rpcResp mcp.JSONRPCResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &rpcResp); err != nil {
		t.Fatalf("failed to unmarshal JSON-RPC response: %v (body=%s)", err, rec.Body.String())
	}
	return rec.Code, &rpcResp
}

func extractToolResult(t *testing.T, resp *mcp.JSONRPCResponse) (string, bool) {
	t.Helper()
	raw, _ := json.Marshal(resp.Result)
	var callRes mcp.MCPCallToolResult
	if err := json.Unmarshal(raw, &callRes); err != nil {
		t.Fatalf("failed to parse tool result: %v", err)
	}
	if len(callRes.Content) == 0 {
		return "", callRes.IsError
	}
	return callRes.Content[0].Text, callRes.IsError
}

func loginForMCPToken(t *testing.T, handler http.Handler, username, password string) string {
	t.Helper()
	b, _ := json.Marshal(map[string]interface{}{
		"username": username,
		"password": password,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/mcp-login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/auth/mcp-login for %s, got %d: %s", username, rec.Code, rec.Body.String())
	}
	var res struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if !strings.HasPrefix(res.Token, auth.MCPTokenPrefix) {
		t.Fatalf("expected token with prefix %s, got %s", auth.MCPTokenPrefix, res.Token)
	}
	return res.Token
}

func TestMCPAuthenticationAndRBACEnforcement(t *testing.T) {
	handler, empRepo, dispatchRepo, _ := setupMCPTestHarness(t)

	// 1. Unauthenticated request must return 401
	code, _ := callMCPToolHTTP(t, handler, "", "get_dispatch_summary", map[string]interface{}{"date": "2026-10-21"})
	if code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated MCP call, got %d", code)
	}

	// 2. Tampered token must return 401
	code, _ = callMCPToolHTTP(t, handler, "dsp_mcp_invalid.signature", "get_dispatch_summary", map[string]interface{}{"date": "2026-10-21"})
	if code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for tampered MCP token, got %d", code)
	}

	// 3. Login as Dispatcher (sarahc), HR (helenr), Payroll (paulf), and Driver (tomm)
	dispToken := loginForMCPToken(t, handler, "sarahc", "Dispatch2026!")
	hrToken := loginForMCPToken(t, handler, "helenr", "Dispatch2026!")
	payrollToken := loginForMCPToken(t, handler, "paulf", "Dispatch2026!")
	driverToken := loginForMCPToken(t, handler, "tomm", "Dispatch2026!")

	// 4. Dispatcher can list unassigned shifts and assign a driver
	code, resp := callMCPToolHTTP(t, handler, dispToken, "list_unassigned_shifts", map[string]interface{}{"date": "2026-10-21"})
	if code != http.StatusOK {
		t.Fatalf("expected 200 for dispatcher list_unassigned_shifts, got %d", code)
	}
	text, isErr := extractToolResult(t, resp)
	if isErr || !strings.Contains(text, "CSDF-001") {
		t.Fatalf("expected unassigned shift CSDF-001 in response, got isErr=%v, text=%s", isErr, text)
	}

	// 5. HR role MUST be denied when attempting to assign a driver
	_, hrAssignResp := callMCPToolHTTP(t, handler, hrToken, "assign_driver_to_shift", map[string]interface{}{
		"date":        "2026-10-21",
		"routeNo":     "CSDF-001",
		"driverQuery": "Tom Miller",
	})
	hrText, hrErr := extractToolResult(t, hrAssignResp)
	if !hrErr || !strings.Contains(hrText, "Permission Denied") {
		t.Fatalf("expected HR to be denied assign_driver_to_shift, got isErr=%v, text=%s", hrErr, hrText)
	}

	// 6. Dispatcher CAN assign driver Tom Miller to route CSDF-001
	_, dispAssignResp := callMCPToolHTTP(t, handler, dispToken, "assign_driver_to_shift", map[string]interface{}{
		"date":        "2026-10-21",
		"routeNo":     "CSDF-001",
		"driverQuery": "Tom Miller",
	})
	assignText, assignErr := extractToolResult(t, dispAssignResp)
	if assignErr || !strings.Contains(assignText, "Executed Successfully") {
		t.Fatalf("expected dispatcher to succeed in assign_driver_to_shift, got isErr=%v, text=%s", assignErr, assignText)
	}

	// Verify audit log was created in dispatch_change_logs
	logs, _ := dispatchRepo.ListChangeLogs(context.Background(), "2026-10-21")
	if len(logs) == 0 {
		t.Fatalf("expected audit log to be recorded in dispatch_change_logs after MCP driver assignment")
	}

	// 7. Dispatcher MUST be denied access to Payroll summary, whereas Payroll role succeeds
	_, dispPayResp := callMCPToolHTTP(t, handler, dispToken, "get_payroll_summary", map[string]interface{}{"date": "2026-10-21"})
	dispPayText, dispPayErr := extractToolResult(t, dispPayResp)
	if !dispPayErr || !strings.Contains(dispPayText, "Permission Denied") {
		t.Fatalf("expected dispatcher to be denied payroll access, got isErr=%v, text=%s", dispPayErr, dispPayText)
	}

	_, payResp := callMCPToolHTTP(t, handler, payrollToken, "get_payroll_summary", map[string]interface{}{"date": "2026-10-21"})
	_, payErr := extractToolResult(t, payResp)
	if payErr {
		t.Fatalf("expected payroll role to access get_payroll_summary without error")
	}

	// 8. Driver can query their own schedule, but is denied querying another driver or full dispatch summary
	_, drvSelfResp := callMCPToolHTTP(t, handler, driverToken, "get_driver_schedule", map[string]interface{}{
		"date": "2026-10-21",
	})
	drvSelfText, drvSelfErr := extractToolResult(t, drvSelfResp)
	if drvSelfErr || !strings.Contains(drvSelfText, "CSDF-001") {
		t.Fatalf("expected driver Tom to view his own assigned shift CSDF-001, got isErr=%v, text=%s", drvSelfErr, drvSelfText)
	}

	_, drvOtherResp := callMCPToolHTTP(t, handler, driverToken, "get_driver_schedule", map[string]interface{}{
		"date":        "2026-10-21",
		"driverQuery": "Sarah Connor",
	})
	_, drvOtherErr := extractToolResult(t, drvOtherResp)
	if !drvOtherErr {
		t.Fatalf("expected driver role to be denied when querying another employee's schedule")
	}

	// 9. API-side real-time revocation: if Sarah (dispatcher) is given readonly pagePermissions["dispatch"], write tool is immediately blocked
	sarah, _ := empRepo.GetByEmployeeNumber(context.Background(), "EMP-DISP-01")
	sarah.PagePermissions = map[string]string{"dispatch": "readonly"}
	_ = empRepo.Update(context.Background(), sarah)

	_, readonlyResp := callMCPToolHTTP(t, handler, dispToken, "assign_driver_to_shift", map[string]interface{}{
		"date":        "2026-10-21",
		"routeNo":     "CSDF-001",
		"driverQuery": "Tom Miller",
	})
	_, readonlyErr := extractToolResult(t, readonlyResp)
	if !readonlyErr {
		t.Fatalf("expected dispatcher with pagePermissions[dispatch]=readonly to be blocked from modifying shifts")
	}

	// 10. API-side deactivation check: if Sarah is deactivated, token is immediately rejected with 403 Forbidden
	sarah.IsActive = false
	_ = empRepo.Update(context.Background(), sarah)

	deactivatedCode, _ := callMCPToolHTTP(t, handler, dispToken, "get_my_profile", map[string]interface{}{})
	if deactivatedCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for deactivated employee token, got %d", deactivatedCode)
	}
}
