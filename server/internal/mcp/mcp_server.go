package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

const (
	DefaultProtocolVersion = "2024-11-05"
	ServerName             = "dispatch-mcp-server"
	ServerVersion          = "1.0.0"
)

// JSONRPCRequest represents an incoming JSON-RPC 2.0 message from an MCP client.
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JSONRPCResponse represents an outgoing JSON-RPC 2.0 response.
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  interface{}     `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

type JSONRPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type MCPTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

type MCPContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type MCPCallToolResult struct {
	Content []MCPContent `json:"content"`
	IsError bool         `json:"isError,omitempty"`
}

type Server struct {
	aiTools      *services.AIToolService
	dispatchRepo repository.DispatchRepository
	employeeRepo repository.EmployeeRepository
}

func NewServer(
	aiTools *services.AIToolService,
	dispatchRepo repository.DispatchRepository,
	employeeRepo repository.EmployeeRepository,
) *Server {
	return &Server{
		aiTools:      aiTools,
		dispatchRepo: dispatchRepo,
		employeeRepo: employeeRepo,
	}
}

// HandleJSONRPC processes a single JSON-RPC 2.0 message.
// Returns nil if the request is a notification (no ID) that requires no response body.
func (s *Server) HandleJSONRPC(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	if req == nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      json.RawMessage("null"),
			Error:   &JSONRPCError{Code: -32600, Message: "Invalid Request"},
		}
	}

	user := auth.GetUser(ctx)
	if user == nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      ensureID(req.ID),
			Error:   &JSONRPCError{Code: -32001, Message: "Unauthorized: valid login token required"},
		}
	}

	// Notifications have no ID and do not expect a JSON-RPC response object
	if len(req.ID) == 0 {
		return nil
	}

	switch req.Method {
	case "initialize":
		return s.handleInitialize(req, user)
	case "ping":
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  map[string]interface{}{},
		}
	case "tools/list":
		return s.handleToolsList(req, user)
	case "tools/call":
		return s.handleToolsCall(ctx, req, user)
	case "resources/list":
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"resources": []interface{}{},
			},
		}
	case "prompts/list":
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"prompts": []interface{}{},
			},
		}
	default:
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    -32601,
				Message: fmt.Sprintf("Method not found: %s", req.Method),
			},
		}
	}
}

func (s *Server) handleInitialize(req *JSONRPCRequest, user *auth.AuthUser) *JSONRPCResponse {
	var initParams struct {
		ProtocolVersion string `json:"protocolVersion"`
	}
	_ = json.Unmarshal(req.Params, &initParams)

	protocolVersion := DefaultProtocolVersion
	if initParams.ProtocolVersion == "2025-03-26" || initParams.ProtocolVersion == "2024-11-05" {
		protocolVersion = initParams.ProtocolVersion
	}

	roleNorm := services.NormalizeRole(user.Role)
	instructions := fmt.Sprintf(
		"Connected to Dispatch Operations MCP Server as %s (Role: %s, EmployeeID: %s). All tool invocations enforce role-based access control (RBAC) on the API server.",
		firstNonEmpty(user.FullName, user.Email, user.Username, user.UID),
		roleNorm,
		firstNonEmpty(user.EmployeeID, "N/A"),
	)

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: map[string]interface{}{
			"protocolVersion": protocolVersion,
			"capabilities": map[string]interface{}{
				"tools": map[string]interface{}{
					"listChanged": false,
				},
			},
			"serverInfo": map[string]interface{}{
				"name":    ServerName,
				"version": ServerVersion,
			},
			"instructions": instructions,
		},
	}
}

func (s *Server) handleToolsList(req *JSONRPCRequest, _ *auth.AuthUser) *JSONRPCResponse {
	tools := s.buildToolDefinitions()
	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: map[string]interface{}{
			"tools": tools,
		},
	}
}

func (s *Server) handleToolsCall(ctx context.Context, req *JSONRPCRequest, user *auth.AuthUser) *JSONRPCResponse {
	var callParams struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &callParams); err != nil || strings.TrimSpace(callParams.Name) == "" {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    -32602,
				Message: "Invalid params: tool 'name' is required",
			},
		}
	}

	if callParams.Arguments == nil {
		callParams.Arguments = map[string]interface{}{}
	}

	result := s.executeTool(ctx, user, callParams.Name, callParams.Arguments)
	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	}
}

func (s *Server) executeTool(ctx context.Context, user *auth.AuthUser, toolName string, args map[string]interface{}) *MCPCallToolResult {
	lang := getStringArg(args, "lang", "en")
	date := getStringArg(args, "date", time.Now().Format("2006-01-02"))
	role := user.Role
	perms := user.PagePermissions

	switch toolName {
	case "get_my_profile":
		normRole := services.NormalizeRole(role)
		profileData := map[string]interface{}{
			"uid":             user.UID,
			"email":           user.Email,
			"username":        user.Username,
			"fullName":        user.FullName,
			"employeeId":      user.EmployeeID,
			"role":            normRole,
			"pagePermissions": perms,
			"capabilities": map[string]bool{
				"canViewDispatch":         services.CanViewDispatch(role, perms),
				"canModifyDispatchShifts": services.CanModifyDispatchShifts(role, perms),
				"canAccessHR":             services.CanAccessHR(role, perms),
				"canModifyHR":             services.CanModifyHR(role, perms),
				"canAccessPayroll":        services.CanAccessPayroll(role, perms),
				"canAccessTimeOff":        services.CanAccessTimeOff(role, perms),
				"canAccessExpenses":       services.CanAccessExpenses(role, perms),
				"canAccessSafetyReports":  services.CanAccessSafetyReports(role, perms),
			},
		}
		b, _ := json.MarshalIndent(profileData, "", "  ")
		text := fmt.Sprintf(
			"### 👤 Authenticated Dispatch Profile\n\n- **Name**: %s\n- **Email / Username**: %s (%s)\n- **Employee ID**: `%s`\n- **Effective Role**: **`%s`**\n\n```json\n%s\n```",
			firstNonEmpty(user.FullName, user.Username, user.Email),
			user.Email,
			firstNonEmpty(user.Username, "N/A"),
			firstNonEmpty(user.EmployeeID, "N/A"),
			normRole,
			string(b),
		)
		return textResult(text, false)

	case "get_dispatch_summary":
		if !services.CanViewDispatch(role, perms) {
			return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** is not authorized to view full dispatch operations summaries.", services.NormalizeRole(role)))
		}
		fleetText, err := s.aiTools.GetFleetSummary(ctx, date, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Error retrieving dispatch summary: %v", err), true)
		}
		assignText, _, _ := s.aiTools.GetAssignmentSummary(ctx, date, lang)
		if assignText != "" {
			return textResult(fleetText+"\n\n---\n\n"+assignText, false)
		}
		return textResult(fleetText, false)

	case "list_unassigned_shifts":
		if !services.CanViewDispatch(role, perms) {
			return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** is not authorized to query unassigned dispatch shifts.", services.NormalizeRole(role)))
		}
		yard := getStringArg(args, "yard", "")
		shifts, err := s.aiTools.GetUnassignedShifts(ctx, date, yard)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to list unassigned shifts: %v", err), true)
		}
		if len(shifts) == 0 {
			return textResult(fmt.Sprintf("✅ All dispatch shifts on **%s** have drivers assigned (0 unassigned shifts).", date), false)
		}
		var lines []string
		lines = append(lines, fmt.Sprintf("### ⚠️ Unassigned Dispatch Shifts on %s (%d total)\n", date, len(shifts)))
		for _, sh := range shifts {
			lines = append(lines, fmt.Sprintf(
				"- **Route `%s`** (%s) | Shift: **%s** | First Stop: `%s` | Unit: `%s` | Yard: `%s` | Shift ID: `%s`",
				sh.RouteNo, sh.RouteName, sh.ShiftType, firstNonEmpty(sh.FirstStopTime, "N/A"), firstNonEmpty(sh.UnitNumber, "Unassigned"), firstNonEmpty(sh.YardName, "N/A"), sh.ID,
			))
		}
		return textResult(strings.Join(lines, "\n"), false)

	case "list_dispatch_shifts":
		if !services.CanViewDispatch(role, perms) {
			return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** is not authorized to list dispatch shifts.", services.NormalizeRole(role)))
		}
		routeFilter := strings.ToLower(strings.TrimSpace(getStringArg(args, "routeQuery", "")))
		driverFilter := strings.ToLower(strings.TrimSpace(getStringArg(args, "driverQuery", "")))
		vehicleFilter := strings.ToLower(strings.TrimSpace(getStringArg(args, "unitNumber", "")))
		yardFilter := strings.ToLower(strings.TrimSpace(getStringArg(args, "yard", "")))
		shiftTypeFilter := strings.ToUpper(strings.TrimSpace(getStringArg(args, "shiftType", "")))

		shifts, err := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{})
		if err != nil {
			return textResult(fmt.Sprintf("Failed to list shifts for %s: %v", date, err), true)
		}

		var matched []string
		for _, sh := range shifts {
			if routeFilter != "" && !strings.Contains(strings.ToLower(sh.RouteNo), routeFilter) && !strings.Contains(strings.ToLower(sh.RouteName), routeFilter) {
				continue
			}
			if driverFilter != "" && !strings.Contains(strings.ToLower(sh.DriverName), driverFilter) && !strings.Contains(strings.ToLower(sh.DriverID), driverFilter) {
				continue
			}
			if vehicleFilter != "" && !strings.Contains(strings.ToLower(sh.UnitNumber), vehicleFilter) {
				continue
			}
			if yardFilter != "" && !strings.Contains(strings.ToLower(sh.YardName), yardFilter) {
				continue
			}
			if shiftTypeFilter != "" && shiftTypeFilter != "ALL" && !strings.EqualFold(sh.ShiftType, shiftTypeFilter) {
				continue
			}
			driverDisplay := sh.DriverName
			if strings.TrimSpace(driverDisplay) == "" {
				driverDisplay = "⚠️ UNASSIGNED"
			}
			matched = append(matched, fmt.Sprintf(
				"- **Route `%s`** (%s) | **%s** | Driver: **%s** (`%s`) | Unit: `%s` | First Stop: `%s` | Health: `%s`",
				sh.RouteNo, sh.RouteName, sh.ShiftType, driverDisplay, sh.DriverID, firstNonEmpty(sh.UnitNumber, "N/A"), firstNonEmpty(sh.FirstStopTime, "N/A"), firstNonEmpty(string(sh.Health), "green"),
			))
		}

		if len(matched) == 0 {
			return textResult(fmt.Sprintf("No dispatch shifts matched the filter criteria on **%s**.", date), false)
		}
		header := fmt.Sprintf("### 📋 Dispatch Shifts on %s (%d matched)\n\n", date, len(matched))
		return textResult(header+strings.Join(matched, "\n"), false)

	case "get_driver_schedule":
		driverQuery := getStringArg(args, "driverQuery", "")
		if driverQuery == "" {
			driverQuery = firstNonEmpty(user.EmployeeID, user.FullName, user.Username)
		}
		// Drivers/Helpers can only query their own schedule unless they have CanViewDispatch
		if !services.CanViewDispatch(role, perms) {
			qLower := strings.ToLower(strings.TrimSpace(driverQuery))
			isSelf := (user.EmployeeID != "" && strings.EqualFold(qLower, user.EmployeeID)) ||
				(user.FullName != "" && strings.EqualFold(qLower, user.FullName)) ||
				(user.Username != "" && strings.EqualFold(qLower, user.Username))
			if !isSelf {
				return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** may only query their own personal shift schedule.", services.NormalizeRole(role)))
			}
		}
		reply, err := s.aiTools.GetDriverSchedule(ctx, driverQuery, date, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get driver schedule: %v", err), true)
		}
		return textResult(reply, false)

	case "get_route_details":
		if !services.CanViewDispatch(role, perms) {
			return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** is not authorized to view route details.", services.NormalizeRole(role)))
		}
		routeQuery := getStringArg(args, "routeQuery", "")
		if strings.TrimSpace(routeQuery) == "" {
			reply, _, err := s.aiTools.GetRouteSummary(ctx, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get route summary: %v", err), true)
			}
			return textResult(reply, false)
		}
		reply, _, err := s.aiTools.GetRouteDetails(ctx, routeQuery, date, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get route details: %v", err), true)
		}
		return textResult(reply, false)

	case "get_vehicle_summary":
		if !services.CanViewDispatch(role, perms) {
			return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** is not authorized to view fleet vehicle summaries.", services.NormalizeRole(role)))
		}
		reply, _, err := s.aiTools.GetVehicleSummary(ctx, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get vehicle summary: %v", err), true)
		}
		return textResult(reply, false)

	case "get_vehicle_details":
		if !services.CanViewDispatch(role, perms) {
			return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** is not authorized to view vehicle details.", services.NormalizeRole(role)))
		}
		vehicleQuery := getStringArg(args, "vehicleQuery", "")
		if strings.TrimSpace(vehicleQuery) == "" {
			return textResult("Please provide 'vehicleQuery' (e.g., unit number or license plate).", true)
		}
		reply, _, err := s.aiTools.GetVehicleDetails(ctx, vehicleQuery, date, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get vehicle details: %v", err), true)
		}
		return textResult(reply, false)

	case "get_student_details":
		if !services.CanViewDispatch(role, perms) {
			return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** is not authorized to access student transport records.", services.NormalizeRole(role)))
		}
		studentQuery := getStringArg(args, "studentQuery", "")
		if strings.TrimSpace(studentQuery) == "" {
			reply, _, err := s.aiTools.GetStudentSummary(ctx, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get student summary: %v", err), true)
			}
			return textResult(reply, false)
		}
		reply, _, err := s.aiTools.GetStudentDetails(ctx, studentQuery, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get student details: %v", err), true)
		}
		return textResult(reply, false)

	case "get_hr_summary":
		if !services.CanAccessHR(role, perms) {
			return deniedResult(services.BuildHRAccessDeniedMessage(role, lang))
		}
		reply, _, err := s.aiTools.GetHRSummary(ctx, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get HR summary: %v", err), true)
		}
		return textResult(reply, false)

	case "get_employee_details":
		if !services.CanAccessHR(role, perms) {
			return deniedResult(services.BuildHRAccessDeniedMessage(role, lang))
		}
		empQuery := getStringArg(args, "employeeQuery", "")
		if strings.TrimSpace(empQuery) == "" {
			return textResult("Please provide 'employeeQuery' (employee name, ID, or number).", true)
		}
		reply, _, err := s.aiTools.GetEmployeeDetails(ctx, empQuery, date, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get employee details: %v", err), true)
		}
		return textResult(reply, false)

	case "get_payroll_summary":
		if !services.CanAccessPayroll(role, perms) {
			return deniedResult(services.BuildPayrollAccessDeniedMessage(role, lang))
		}
		rateText, _, err := s.aiTools.GetPayrollSummary(ctx, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get payroll summary: %v", err), true)
		}
		dispPayrollText, _, _ := s.aiTools.GetDispatchPayrollSummary(ctx, date, lang)
		if dispPayrollText != "" {
			return textResult(rateText+"\n\n---\n\n"+dispPayrollText, false)
		}
		return textResult(rateText, false)

	case "get_payroll_details":
		if !services.CanAccessPayroll(role, perms) {
			return deniedResult(services.BuildPayrollAccessDeniedMessage(role, lang))
		}
		query := getStringArg(args, "query", "")
		if strings.TrimSpace(query) == "" {
			reply, _, err := s.aiTools.GetDispatchPayrollSummary(ctx, date, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get dispatch payroll summary: %v", err), true)
			}
			return textResult(reply, false)
		}
		reply, _, err := s.aiTools.GetPayrollDetails(ctx, query, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get payroll details: %v", err), true)
		}
		return textResult(reply, false)

	case "get_time_off_requests":
		if !services.CanAccessTimeOff(role, perms) {
			return deniedResult(services.BuildTimeOffAccessDeniedMessage(role, lang))
		}
		query := getStringArg(args, "query", "")
		if strings.TrimSpace(query) == "" {
			reply, _, err := s.aiTools.GetTimeOffSummary(ctx, date, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get time off summary: %v", err), true)
			}
			return textResult(reply, false)
		}
		reply, _, err := s.aiTools.GetTimeOffDetails(ctx, query, date, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get time off details: %v", err), true)
		}
		return textResult(reply, false)

	case "get_expense_claims":
		if !services.CanAccessExpenses(role, perms) {
			return deniedResult(services.BuildExpenseAccessDeniedMessage(role, lang))
		}
		query := getStringArg(args, "query", "")
		if strings.TrimSpace(query) == "" {
			reply, _, err := s.aiTools.GetExpenseSummary(ctx, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get expense summary: %v", err), true)
			}
			return textResult(reply, false)
		}
		reply, _, err := s.aiTools.GetExpenseDetails(ctx, query, lang)
		if err != nil {
			return textResult(fmt.Sprintf("Failed to get expense details: %v", err), true)
		}
		return textResult(reply, false)

	case "get_safety_reports":
		if !services.CanAccessSafetyReports(role, perms) {
			return deniedResult(fmt.Sprintf("⚠️ **Permission Denied**: Role **%s** is not authorized to view safety, incident, or hazard reports.", services.NormalizeRole(role)))
		}
		category := strings.ToLower(strings.TrimSpace(getStringArg(args, "category", "incidents")))
		query := strings.TrimSpace(getStringArg(args, "query", ""))

		switch category {
		case "hazards", "hazard":
			if query == "" {
				reply, _, err := s.aiTools.GetHazardReportSummary(ctx, lang)
				if err != nil {
					return textResult(fmt.Sprintf("Failed to get hazard report summary: %v", err), true)
				}
				return textResult(reply, false)
			}
			reply, _, err := s.aiTools.GetHazardReportDetails(ctx, query, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get hazard report details: %v", err), true)
			}
			return textResult(reply, false)

		case "assessments", "route_assessments", "assessment":
			if query == "" {
				reply, _, err := s.aiTools.GetRouteAssessmentSummary(ctx, lang)
				if err != nil {
					return textResult(fmt.Sprintf("Failed to get route assessment summary: %v", err), true)
				}
				return textResult(reply, false)
			}
			reply, _, err := s.aiTools.GetRouteAssessmentDetails(ctx, query, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get route assessment details: %v", err), true)
			}
			return textResult(reply, false)

		case "training":
			if query == "" {
				reply, _, err := s.aiTools.GetTrainingSummary(ctx, date, lang)
				if err != nil {
					return textResult(fmt.Sprintf("Failed to get training summary: %v", err), true)
				}
				return textResult(reply, false)
			}
			reply, _, err := s.aiTools.GetTrainingDetails(ctx, query, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get training details: %v", err), true)
			}
			return textResult(reply, false)

		default: // "incidents"
			if query == "" {
				reply, _, err := s.aiTools.GetStudentIncidentSummary(ctx, date, lang)
				if err != nil {
					return textResult(fmt.Sprintf("Failed to get student incident summary: %v", err), true)
				}
				return textResult(reply, false)
			}
			reply, _, err := s.aiTools.GetStudentIncidentDetails(ctx, query, lang)
			if err != nil {
				return textResult(fmt.Sprintf("Failed to get student incident details: %v", err), true)
			}
			return textResult(reply, false)
		}

	case "assign_driver_to_shift":
		if !services.CanModifyDispatchShifts(role, perms) {
			return deniedResult(services.BuildDispatchModificationDeniedMessage(role, lang))
		}
		routeQuery := getStringArg(args, "routeNo", "")
		driverQuery := getStringArg(args, "driverQuery", "")
		shiftType := getStringArg(args, "shiftType", "ALL")
		dryRun := getBoolArg(args, "dryRun", false)

		if strings.TrimSpace(routeQuery) == "" || strings.TrimSpace(driverQuery) == "" {
			return textResult("Both 'routeNo' and 'driverQuery' are required to assign a driver.", true)
		}

		operatorName := fmt.Sprintf("%s (MCP)", firstNonEmpty(user.FullName, user.Username, user.Email, "Dispatcher"))
		pendingAction, summaryMsg, err := s.aiTools.PrepareDriverAssignment(
			ctx,
			date,
			routeQuery,
			driverQuery,
			shiftType,
			operatorName,
			role,
			perms,
			lang,
		)
		if err != nil {
			return textResult(fmt.Sprintf("⚠️ Failed to prepare driver assignment: %v", err), true)
		}

		if dryRun {
			return textResult("### 🔍 Dry-Run Preview (Not Yet Applied)\n\n"+summaryMsg, false)
		}

		executed, err := s.aiTools.ExecutePendingAction(ctx, pendingAction.ID, user.UID, operatorName, role, perms)
		if err != nil {
			return textResult(fmt.Sprintf("⚠️ Failed to execute driver assignment: %v", err), true)
		}

		return textResult(fmt.Sprintf(
			"✅ **Driver Assignment Executed Successfully**\n\n- **Route**: `%s` (%s)\n- **Date**: `%s` (%s)\n- **Assigned Driver**: **%s** (`%s`)\n- **Previous Driver**: %s\n- **Operator**: %s (Role: `%s`)\n- **Audit Log**: Recorded in `dispatch_change_logs`",
			executed.RouteNo, executed.RouteName, executed.Date, executed.ShiftType,
			executed.DriverName, executed.DriverID, executed.OldDriverName, operatorName, services.NormalizeRole(role),
		), false)

	case "create_daily_dispatch_sheet":
		if !services.CanModifyDispatchShifts(role, perms) {
			return deniedResult(services.BuildDispatchModificationDeniedMessage(role, lang))
		}
		dryRun := getBoolArg(args, "dryRun", false)
		operatorName := fmt.Sprintf("%s (MCP)", firstNonEmpty(user.FullName, user.Username, user.Email, "Dispatcher"))

		pendingAction, summaryMsg, err := s.aiTools.PrepareCreateDispatchSheet(
			ctx,
			date,
			operatorName,
			role,
			perms,
			lang,
		)
		if err != nil {
			return textResult(fmt.Sprintf("⚠️ Failed to prepare daily dispatch sheet: %v", err), true)
		}

		if dryRun {
			return textResult("### 🔍 Dry-Run Preview (Not Yet Applied)\n\n"+summaryMsg, false)
		}

		executed, err := s.aiTools.ExecutePendingAction(ctx, pendingAction.ID, user.UID, operatorName, role, perms)
		if err != nil {
			return textResult(fmt.Sprintf("⚠️ Failed to generate daily dispatch sheet: %v", err), true)
		}

		return textResult(fmt.Sprintf(
			"✅ **Daily Dispatch Sheet Generated Successfully**\n\n- **Date**: `%s`\n- **Operation**: Populated daily shifts from active master routes\n- **Operator**: %s (Role: `%s`)",
			executed.Date, operatorName, services.NormalizeRole(role),
		), false)

	default:
		return textResult(fmt.Sprintf("Unknown MCP tool: %s", toolName), true)
	}
}

func (s *Server) buildToolDefinitions() []MCPTool {
	return []MCPTool{
		{
			Name:        "get_my_profile",
			Description: "Get the currently authenticated user's profile, employee ID, role, and API-side permission matrix.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "get_dispatch_summary",
			Description: "Get the daily dispatch operations overview for a date (total shifts, assigned drivers, unassigned vacancies, completed runs, delays).",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format (defaults to today).",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "list_unassigned_shifts",
			Description: "List all dispatch shifts on a given date that are missing an assigned driver.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format (defaults to today).",
					},
					"yard": map[string]interface{}{
						"type":        "string",
						"description": "Optional yard/depot name filter.",
					},
				},
			},
		},
		{
			Name:        "list_dispatch_shifts",
			Description: "Search and filter daily dispatch shifts by date, route number, driver name/ID, vehicle unit number, yard, or shift type (AM/PM).",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format (defaults to today).",
					},
					"routeQuery": map[string]interface{}{
						"type":        "string",
						"description": "Optional route number or route name filter (e.g. 'CSDF-001').",
					},
					"driverQuery": map[string]interface{}{
						"type":        "string",
						"description": "Optional driver name or employee ID filter.",
					},
					"unitNumber": map[string]interface{}{
						"type":        "string",
						"description": "Optional vehicle unit number filter.",
					},
					"yard": map[string]interface{}{
						"type":        "string",
						"description": "Optional yard/depot name filter.",
					},
					"shiftType": map[string]interface{}{
						"type":        "string",
						"description": "Optional shift type filter: 'AM', 'PM', or 'ALL'.",
					},
				},
			},
		},
		{
			Name:        "get_driver_schedule",
			Description: "Query the daily shift schedule, pullaway times, and assigned vehicles for a specific driver.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"driverQuery": map[string]interface{}{
						"type":        "string",
						"description": "Driver name, employee number, or username (defaults to logged-in user if omitted).",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format (defaults to today).",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_route_details",
			Description: "Get master route details, stops, schedules, and assigned crew/vehicles, or overall route summary if routeQuery is omitted.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"routeQuery": map[string]interface{}{
						"type":        "string",
						"description": "Route number or name (e.g. 'CSDF-001'). Omit for overall route summary.",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format (defaults to today).",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_vehicle_summary",
			Description: "Get fleet vehicle statistics (active, spare, in maintenance, out of service, wheelchair accessible).",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_vehicle_details",
			Description: "Get detailed information and daily shifts for a specific vehicle by unit number, license plate, or VIN.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"vehicleQuery": map[string]interface{}{
						"type":        "string",
						"description": "Vehicle unit number, license plate, or model.",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format (defaults to today).",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
				"required": []string{"vehicleQuery"},
			},
		},
		{
			Name:        "get_student_details",
			Description: "Search student rider details (school, grade, special needs, assigned stops and routes) or overall student summary.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"studentQuery": map[string]interface{}{
						"type":        "string",
						"description": "Student name or ID. Omit to get overall student roster summary.",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_hr_summary",
			Description: "Get Human Resources (HR) personnel summary, active headcount, and driver license compliance status. Requires HR/Admin/Manager access.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_employee_details",
			Description: "Get employee record, contact info, driver license status, and role by name or employee number. Requires HR/Admin/Dispatcher access.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"employeeQuery": map[string]interface{}{
						"type":        "string",
						"description": "Employee name, employee number (e.g. 'EMP-1001'), or username.",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format.",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
				"required": []string{"employeeQuery"},
			},
		},
		{
			Name:        "get_payroll_summary",
			Description: "Get driver payroll compensation rates and daily dispatch payroll summary. Restricted to Payroll, Manager, and Admin roles.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format (defaults to today).",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_payroll_details",
			Description: "Query specific payroll rates, school board base rates, or driver compensation details. Restricted to Payroll, Manager, and Admin roles.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Driver name, route number, or school board code.",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format.",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_time_off_requests",
			Description: "Query employee time-off / leave requests summary or specific employee leave status.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Optional employee name, status ('pending', 'approved'), or leave type.",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format.",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_expense_claims",
			Description: "Query employee expense reimbursement claims summary or details.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Optional employee name, claim ID, or status ('pending', 'approved').",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "get_safety_reports",
			Description: "Query operational safety reports including student incidents, hazard reports, route assessments, or training courses.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"category": map[string]interface{}{
						"type":        "string",
						"description": "Report category: 'incidents', 'hazards', 'assessments', or 'training'.",
					},
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Optional search query (student/driver name, route number, report ID).",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target date in YYYY-MM-DD format.",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
		{
			Name:        "assign_driver_to_shift",
			Description: "[WRITE] Assign or reassign a driver to a route's dispatch shift(s) on a given date and record an audit log. Strictly requires Dispatcher or Admin write permissions.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"routeNo": map[string]interface{}{
						"type":        "string",
						"description": "Route number to assign (e.g. 'CSDF-001').",
					},
					"driverQuery": map[string]interface{}{
						"type":        "string",
						"description": "Driver full name or employee ID (e.g. 'EMP-1001').",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target dispatch date in YYYY-MM-DD format (defaults to today).",
					},
					"shiftType": map[string]interface{}{
						"type":        "string",
						"description": "Shift type: 'AM', 'PM', or 'ALL' (defaults to 'ALL').",
					},
					"dryRun": map[string]interface{}{
						"type":        "boolean",
						"description": "If true, only validates and previews the assignment without modifying the database.",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
				"required": []string{"routeNo", "driverQuery"},
			},
		},
		{
			Name:        "create_daily_dispatch_sheet",
			Description: "[WRITE] Generate the daily dispatch sheet (all AM/PM shifts from active master routes) for a target date. Strictly requires Dispatcher or Admin write permissions.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Target dispatch date in YYYY-MM-DD format (defaults to today).",
					},
					"dryRun": map[string]interface{}{
						"type":        "boolean",
						"description": "If true, previews the operation without creating shifts.",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "Response language: 'en' or 'fr'.",
					},
				},
			},
		},
	}
}

func textResult(text string, isErr bool) *MCPCallToolResult {
	return &MCPCallToolResult{
		Content: []MCPContent{
			{
				Type: "text",
				Text: text,
			},
		},
		IsError: isErr,
	}
}

func deniedResult(msg string) *MCPCallToolResult {
	return textResult(msg, true)
}

func getStringArg(args map[string]interface{}, key string, fallback string) string {
	if args == nil {
		return fallback
	}
	if val, ok := args[key]; ok && val != nil {
		if s, ok := val.(string); ok {
			if strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return fallback
}

func getBoolArg(args map[string]interface{}, key string, fallback bool) bool {
	if args == nil {
		return fallback
	}
	if val, ok := args[key]; ok && val != nil {
		if b, ok := val.(bool); ok {
			return b
		}
	}
	return fallback
}

func ensureID(id json.RawMessage) json.RawMessage {
	if len(id) == 0 {
		return json.RawMessage("null")
	}
	return id
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
