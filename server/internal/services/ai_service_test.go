package services

import (
	"context"
	"strings"
	"testing"
	"time"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type mockDispatchRepo struct {
	repository.DispatchRepository
	shifts               []*models.DispatchShift
	changeLogs           []*models.DispatchChangeLog
	temporaryAssignments []*models.TemporaryAssignment
	timeOffRequests      []*models.TimeOffRequest
	expenseClaims        []*models.ExpenseReimbursement
	dispatchPayrolls     []*models.DispatchPayrollRecord
}

func (m *mockDispatchRepo) ListShifts(ctx context.Context, date string, filter repository.DispatchFilter) ([]*models.DispatchShift, error) {
	return m.shifts, nil
}

func (m *mockDispatchRepo) ListTemporaryAssignments(ctx context.Context, routeID string, date string, status string) ([]*models.TemporaryAssignment, error) {
	return m.temporaryAssignments, nil
}

func (m *mockDispatchRepo) ListTimeOffRequests(ctx context.Context, employeeID string, status string, date string) ([]*models.TimeOffRequest, error) {
	return m.timeOffRequests, nil
}

func (m *mockDispatchRepo) ListExpenseClaims(ctx context.Context, employeeID string, status string) ([]*models.ExpenseReimbursement, error) {
	return m.expenseClaims, nil
}

func (m *mockDispatchRepo) ListDispatchPayrolls(ctx context.Context, date string) ([]*models.DispatchPayrollRecord, error) {
	return m.dispatchPayrolls, nil
}

type mockRouteRepo struct {
	repository.RouteRepository
	routes []*models.BusRoute
}

func (m *mockRouteRepo) ListRoutes(ctx context.Context, filter repository.RouteFilter) ([]*models.BusRoute, error) {
	return m.routes, nil
}

func (m *mockDispatchRepo) UpdateShift(ctx context.Context, id string, req *models.UpdateDispatchShiftRequest) (*models.DispatchShift, error) {
	for _, s := range m.shifts {
		if s.ID == id {
			if req.DriverID != nil {
				s.DriverID = *req.DriverID
			}
			if req.DriverName != nil {
				s.DriverName = *req.DriverName
			}
			return s, nil
		}
	}
	return nil, nil
}

func (m *mockDispatchRepo) AddChangeLog(ctx context.Context, log *models.DispatchChangeLog) (*models.DispatchChangeLog, error) {
	m.changeLogs = append(m.changeLogs, log)
	return log, nil
}

func (m *mockDispatchRepo) ListChangeLogs(ctx context.Context, date string) ([]*models.DispatchChangeLog, error) {
	var res []*models.DispatchChangeLog
	for _, l := range m.changeLogs {
		if l.DispatchDate == date {
			res = append(res, l)
		}
	}
	return res, nil
}

func (m *mockDispatchRepo) CreateDay(ctx context.Context, date string, yards []string) (*models.CreateDispatchDayResult, error) {
	return &models.CreateDispatchDayResult{
		Created:         5,
		Eligible:        5,
		SkippedExisting: 0,
	}, nil
}

func TestAIPermissions_CanModifyDispatchShifts(t *testing.T) {
	tests := []struct {
		role            string
		pagePermissions map[string]string
		want            bool
	}{
		{"admin", nil, true},
		{"ADMIN", nil, true},
		{"dispatcher", nil, true},
		{"DISPATCHER", nil, true},
		{"dispatch", nil, true},
		{"HR", nil, false},
		{"hr", nil, false},
		{"payroll", nil, false},
		{"Payroll", nil, false},
		{"manager", nil, false},
		{"fleet", nil, false},
		{"driver", nil, false},
		{"helper", nil, false},
		// Custom override allows dispatch write
		{"HR", map[string]string{"dispatch": "readwrite"}, true},
		// Custom override revokes dispatch write
		{"dispatcher", map[string]string{"dispatch": "readonly"}, false},
	}

	for _, tt := range tests {
		got := CanModifyDispatchShifts(tt.role, tt.pagePermissions)
		if got != tt.want {
			t.Errorf("CanModifyDispatchShifts(%q, %v) = %v; want %v", tt.role, tt.pagePermissions, got, tt.want)
		}
	}
}

func TestAIPermissions_CanAccessPayroll(t *testing.T) {
	tests := []struct {
		role            string
		pagePermissions map[string]string
		want            bool
	}{
		{"admin", nil, true},
		{"payroll", nil, true},
		{"manager", nil, true},
		{"dispatcher", nil, false},
		{"HR", nil, false},
		{"fleet", nil, false},
		{"driver", nil, false},
		{"helper", nil, false},
	}

	for _, tt := range tests {
		got := CanAccessPayroll(tt.role, tt.pagePermissions)
		if got != tt.want {
			t.Errorf("CanAccessPayroll(%q, %v) = %v; want %v", tt.role, tt.pagePermissions, got, tt.want)
		}
	}
}

func TestAIPermissions_CanAccessHR(t *testing.T) {
	tests := []struct {
		role            string
		pagePermissions map[string]string
		want            bool
	}{
		{"admin", nil, true},
		{"HR", nil, true},
		{"dispatcher", nil, true}, // read-only personnel access
		{"manager", nil, true},
		{"payroll", nil, true},
		{"fleet", nil, false},
		{"driver", nil, false},
	}

	for _, tt := range tests {
		got := CanAccessHR(tt.role, tt.pagePermissions)
		if got != tt.want {
			t.Errorf("CanAccessHR(%q, %v) = %v; want %v", tt.role, tt.pagePermissions, got, tt.want)
		}
	}
}

func TestProcessChat_RoleScoping(t *testing.T) {
	ctx := context.Background()
	empRepo := repository.NewMemoryEmployeeRepository()

	// Seed an active driver
	emp := &models.Employee{
		ID:             "EMP-001",
		EmployeeNumber: "1001",
		FullName:       "Tom Driver",
		FirstName:      "Tom",
		LastName:       "Driver",
		JobPosition:    "Driver",
		IsActive:       true,
	}
	_ = empRepo.Create(ctx, emp)

	// Seed a shift
	today := time.Now().Format("2006-01-02")
	shift := &models.DispatchShift{
		ID:            "SHIFT-1",
		DispatchDate:  today,
		RouteNo:       "101",
		RouteName:     "Route 101 North",
		ShiftType:     "AM",
		DriverID:      "",
		DriverName:    "",
		UnitNumber:    "BUS-1",
		FirstStopTime: "07:30 AM",
	}
	mockDisp := &mockDispatchRepo{
		shifts: []*models.DispatchShift{shift},
	}

	aiToolService := NewAIToolService(mockDisp, empRepo, nil, nil, nil, nil)
	aiService := NewAIService(aiToolService)

	// 1. HR user tries to assign a driver to a shift -> MUST BE DENIED
	hrReq := &models.AIChatRequest{
		Message:      "Assign Tom to route 101",
		UserRole:     "HR",
		OperatorName: "HR Officer",
		Date:         today,
		Lang:         "en",
	}
	hrResp, err := aiService.ProcessChat(ctx, hrReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(hrResp.Reply, "Permission Denied") {
		t.Errorf("expected HR assignment to be denied, got reply: %s", hrResp.Reply)
	}
	if len(hrResp.ActionCards) > 0 {
		t.Errorf("expected no action cards for denied HR request, got %d cards", len(hrResp.ActionCards))
	}

	// 2. Payroll user tries to assign a driver to a shift -> MUST BE DENIED
	payrollReq := &models.AIChatRequest{
		Message:      "Assign Tom to route 101",
		UserRole:     "payroll",
		OperatorName: "Payroll Clerk",
		Date:         today,
		Lang:         "en",
	}
	payrollResp, err := aiService.ProcessChat(ctx, payrollReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(payrollResp.Reply, "Permission Denied") {
		t.Errorf("expected Payroll assignment to be denied, got reply: %s", payrollResp.Reply)
	}

	// 3. Dispatcher tries to assign a driver to a shift -> MUST SUCCEED with pending confirmation
	dispReq := &models.AIChatRequest{
		Message:      "Assign Tom to route 101",
		UserRole:     "dispatcher",
		OperatorName: "Head Dispatcher",
		Date:         today,
		Lang:         "en",
	}
	dispResp, err := aiService.ProcessChat(ctx, dispReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dispResp.ActionCards) == 0 || dispResp.ActionCards[0].Type != "confirm_action" {
		t.Errorf("expected confirm_action card for Dispatcher, got reply: %s, cards: %+v", dispResp.Reply, dispResp.ActionCards)
	}
	actionID := dispResp.ActionCards[0].ActionID

	// 4. HR tries to CONFIRM the pending action -> MUST BE DENIED
	hrConfirmReq := &models.AIChatRequest{
		Message:      "Confirm",
		UserRole:     "HR",
		OperatorName: "HR Officer",
		ActionID:     actionID,
		Confirmed:    true,
		Date:         today,
		Lang:         "en",
	}
	hrConfirmResp, err := aiService.ProcessChat(ctx, hrConfirmReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(hrConfirmResp.Reply, "Permission Denied") {
		t.Errorf("expected HR confirm to be denied, got: %s", hrConfirmResp.Reply)
	}

	// 5. Dispatcher tries to access Payroll -> MUST BE DENIED
	dispPayReq := &models.AIChatRequest{
		Message:  "Show payroll rates and driver salary",
		UserRole: "dispatcher",
		Date:     today,
		Lang:     "en",
	}
	dispPayResp, err := aiService.ProcessChat(ctx, dispPayReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(dispPayResp.Reply, "Permission Denied") {
		t.Errorf("expected Dispatcher payroll inquiry to be denied, got: %s", dispPayResp.Reply)
	}

	// 6. Dispatcher CONFIRMS the pending action -> MUST SUCCEED
	dispConfirmReq := &models.AIChatRequest{
		Message:      "Confirm",
		UserRole:     "dispatcher",
		OperatorName: "Head Dispatcher",
		ActionID:     actionID,
		Confirmed:    true,
		Date:         today,
		Lang:         "en",
	}
	dispConfirmResp, err := aiService.ProcessChat(ctx, dispConfirmReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dispConfirmResp.ActionCards) == 0 || dispConfirmResp.ActionCards[0].Type != "action_success" {
		t.Errorf("expected action_success for Dispatcher confirm, got reply: %s", dispConfirmResp.Reply)
	}
}

func TestAIService_CreateDispatchSheetFlow(t *testing.T) {
	ctx := context.Background()
	today := time.Now().Format("2006-01-02")

	mockDisp := &mockDispatchRepo{
		shifts: []*models.DispatchShift{},
	}
	empRepo := repository.NewMemoryEmployeeRepository()

	aiToolService := NewAIToolService(mockDisp, empRepo, nil, nil, nil, nil)
	aiService := NewAIService(aiToolService)

	// 1. HR tries to create dispatch sheet ("创建dispatch sheet") -> MUST BE DENIED
	hrReq := &models.AIChatRequest{
		Message:      "创建dispatch sheet",
		UserRole:     "HR",
		OperatorName: "HR Officer",
		Date:         today,
		Lang:         "fr",
	}
	hrResp, err := aiService.ProcessChat(ctx, hrReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(hrResp.Reply, "Accès refusé") {
		t.Errorf("expected HR create sheet request to be denied in French, got: %s", hrResp.Reply)
	}
	if len(hrResp.ActionCards) > 0 {
		t.Errorf("expected no action cards for denied HR request, got %d", len(hrResp.ActionCards))
	}

	// 2. Payroll tries to create dispatch sheet ("create dispatch sheet") -> MUST BE DENIED
	payReq := &models.AIChatRequest{
		Message:      "create dispatch sheet",
		UserRole:     "payroll",
		OperatorName: "Payroll Clerk",
		Date:         today,
		Lang:         "en",
	}
	payResp, err := aiService.ProcessChat(ctx, payReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(payResp.Reply, "Permission Denied") {
		t.Errorf("expected payroll create sheet request to be denied in English, got: %s", payResp.Reply)
	}

	// 3. Dispatcher requests sheet creation ("创建dispatch sheet") -> MUST SUCCEED with pending confirm card
	dispReq := &models.AIChatRequest{
		Message:      "创建dispatch sheet",
		UserRole:     "dispatcher",
		OperatorName: "Lead Dispatcher",
		Date:         today,
		Lang:         "fr",
	}
	dispResp, err := aiService.ProcessChat(ctx, dispReq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dispResp.ActionCards) == 0 || dispResp.ActionCards[0].Type != "confirm_action" {
		t.Fatalf("expected confirm_action card for Dispatcher, got cards: %+v", dispResp.ActionCards)
	}
	card := dispResp.ActionCards[0]
	actionID := card.ActionID
	if card.Data["actionType"] != "CREATE_DISPATCH_SHEET" {
		t.Errorf("expected actionType CREATE_DISPATCH_SHEET, got %v", card.Data["actionType"])
	}

	// 4. HR tries to confirm the action -> MUST BE DENIED
	hrConfirm := &models.AIChatRequest{
		Message:      "Confirmer",
		UserRole:     "HR",
		OperatorName: "HR Officer",
		ActionID:     actionID,
		Confirmed:    true,
		Date:         today,
		Lang:         "fr",
	}
	hrConfirmResp, err := aiService.ProcessChat(ctx, hrConfirm)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(hrConfirmResp.Reply, "Accès refusé") {
		t.Errorf("expected HR confirm to be denied, got: %s", hrConfirmResp.Reply)
	}

	// 5. Dispatcher confirms -> MUST EXECUTE and return action_success
	dispConfirm := &models.AIChatRequest{
		Message:      "Confirmer",
		UserRole:     "dispatcher",
		OperatorName: "Lead Dispatcher",
		ActionID:     actionID,
		Confirmed:    true,
		Date:         today,
		Lang:         "fr",
	}
	dispConfirmResp, err := aiService.ProcessChat(ctx, dispConfirm)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dispConfirmResp.ActionCards) == 0 || dispConfirmResp.ActionCards[0].Type != "action_success" {
		t.Fatalf("expected action_success card, got cards: %+v", dispConfirmResp.ActionCards)
	}
	if dispConfirmResp.ActionCards[0].Data["actionType"] != "CREATE_DISPATCH_SHEET" {
		t.Errorf("expected actionType CREATE_DISPATCH_SHEET, got %v", dispConfirmResp.ActionCards[0].Data["actionType"])
	}
}

func TestAIService_WhoCreatedDispatchFlow(t *testing.T) {
	ctx := context.Background()
	today := time.Now().Format("2006-01-02")

	mockDisp := &mockDispatchRepo{
		shifts: []*models.DispatchShift{},
	}
	empRepo := repository.NewMemoryEmployeeRepository()

	aiToolService := NewAIToolService(mockDisp, empRepo, nil, nil, nil, nil)
	aiService := NewAIService(aiToolService)

	// 1. Query when dispatch sheet does not exist yet
	queryReq1 := &models.AIChatRequest{
		Message:      "who created dispatch today?",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	resp1, err := aiService.ProcessChat(ctx, queryReq1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(resp1.Reply, "No dispatch sheet has been created") {
		t.Errorf("expected notice that no dispatch sheet has been created, got: %s", resp1.Reply)
	}

	// 2. Add a "Day Generated" change log
	mockDisp.changeLogs = append(mockDisp.changeLogs, &models.DispatchChangeLog{
		ID:           "LOG-001",
		DispatchDate: today,
		Type:         "Day Generated",
		User:         "Dispatcher Bob",
		Time:         "2026-10-09 06:15:00 a.m.",
		Detail:       "Generated dispatch day with 12 shifts (0 already existed)",
		Timestamp:    time.Now().UnixMilli(),
	})
	mockDisp.shifts = append(mockDisp.shifts, &models.DispatchShift{
		ID:           "SHIFT-1",
		DispatchDate: today,
		RouteNo:      "101",
		DriverID:     "EMP-001",
		DriverName:   "Tom Driver",
	})

	// 3. Query "who created dispatch today?" in English
	queryReq2 := &models.AIChatRequest{
		Message:      "who created dispatch today?",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	resp2, err := aiService.ProcessChat(ctx, queryReq2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(resp2.Reply, "Dispatcher Bob") {
		t.Errorf("expected reply to mention Dispatcher Bob, got: %s", resp2.Reply)
	}
	if len(resp2.ActionCards) == 0 || resp2.ActionCards[0].Type != "creator_info" {
		t.Errorf("expected creator_info action card, got cards: %+v", resp2.ActionCards)
	}
	if resp2.ActionCards[0].Data["creator"] != "Dispatcher Bob" {
		t.Errorf("expected creator data Dispatcher Bob, got: %v", resp2.ActionCards[0].Data["creator"])
	}

	// 4. Query in French: "qui a créé le dispatch aujourd'hui ?"
	queryReq3 := &models.AIChatRequest{
		Message:      "qui a créé le dispatch aujourd'hui ?",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "fr",
	}
	resp3, err := aiService.ProcessChat(ctx, queryReq3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(resp3.Reply, "Dispatcher Bob") {
		t.Errorf("expected French reply to mention Dispatcher Bob, got: %s", resp3.Reply)
	}

	// 5. Query in Chinese: "今天是谁创建的dispatch？"
	queryReq4 := &models.AIChatRequest{
		Message:      "今天是谁创建的dispatch？",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	resp4, err := aiService.ProcessChat(ctx, queryReq4)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(resp4.Reply, "Dispatcher Bob") {
		t.Errorf("expected Chinese-prompt reply to mention Dispatcher Bob, got: %s", resp4.Reply)
	}
}

func TestAIService_RouteAndAssignmentFlows(t *testing.T) {
	ctx := context.Background()
	today := time.Now().Format("2006-01-02")

	mockDisp := &mockDispatchRepo{
		shifts: []*models.DispatchShift{
			{
				ID:           "SHIFT-1",
				DispatchDate: today,
				RouteNo:      "101",
				RouteName:    "East Elementary",
				ShiftType:    "AM",
				DriverID:     "EMP-001",
				DriverName:   "Tom Driver",
				UnitNumber:   "BUS-50",
			},
			{
				ID:           "SHIFT-2",
				DispatchDate: today,
				RouteNo:      "102",
				RouteName:    "West High",
				ShiftType:    "AM",
				DriverID:     "",
				DriverName:   "",
				UnitNumber:   "BUS-51",
			},
		},
		temporaryAssignments: []*models.TemporaryAssignment{
			{
				ID:                  "TEMP-1",
				RouteID:             "ROUTE-101",
				RouteNo:             "101",
				ShiftType:           "AM",
				OriginalDriverName:  "Tom Driver",
				TemporaryDriverName: "Jerry Sub",
				StartDate:           today,
				EndDate:             today,
				Status:              "active",
			},
		},
	}

	mockRoutes := &mockRouteRepo{
		routes: []*models.BusRoute{
			{
				ID:         "ROUTE-101",
				RouteNo:    "101",
				RouteName:  "East Elementary",
				YardName:   "North Yard",
				DriverID:   "EMP-001",
				DriverName: "Tom Driver",
				Active:     true,
			},
			{
				ID:        "ROUTE-102",
				RouteNo:   "102",
				RouteName: "West High",
				YardName:  "South Yard",
				Active:    true,
			},
		},
	}

	empRepo := repository.NewMemoryEmployeeRepository()
	_ = empRepo.Create(ctx, &models.Employee{
		ID:          "EMP-001",
		FullName:    "Tom Driver",
		FirstName:   "Tom",
		LastName:    "Driver",
		JobPosition: "Driver",
		IsActive:    true,
	})

	aiToolService := NewAIToolService(mockDisp, empRepo, mockRoutes, nil, nil, nil)
	aiService := NewAIService(aiToolService)

	// 1. Route details query: "who is driving route 101"
	reqRoute := &models.AIChatRequest{
		Message:      "who is driving route 101",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respRoute, err := aiService.ProcessChat(ctx, reqRoute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respRoute.Reply, "101") {
		t.Errorf("expected route reply to mention 101, got: %s", respRoute.Reply)
	}
	if len(respRoute.ActionCards) == 0 || respRoute.ActionCards[0].Type != "route_details" {
		t.Fatalf("expected route_details card, got: %+v", respRoute.ActionCards)
	}
	if respRoute.ActionCards[0].Data["routeNo"] != "101" {
		t.Errorf("expected card routeNo 101, got: %v", respRoute.ActionCards[0].Data["routeNo"])
	}

	// 2. Route summary query: "all routes"
	reqSummary := &models.AIChatRequest{
		Message:      "all routes",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respSummary, err := aiService.ProcessChat(ctx, reqSummary)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respSummary.ActionCards) == 0 || respSummary.ActionCards[0].Type != "route_summary" {
		t.Fatalf("expected route_summary card, got: %+v", respSummary.ActionCards)
	}
	if respSummary.ActionCards[0].Data["totalRoutes"] != 2 {
		t.Errorf("expected totalRoutes 2, got: %v", respSummary.ActionCards[0].Data["totalRoutes"])
	}

	// 3. Assignment overview query: "today's assignments"
	reqAssignOverview := &models.AIChatRequest{
		Message:      "today's assignments",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respAssignOverview, err := aiService.ProcessChat(ctx, reqAssignOverview)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respAssignOverview.ActionCards) == 0 || respAssignOverview.ActionCards[0].Type != "assignment_summary" {
		t.Fatalf("expected assignment_summary card, got: %+v", respAssignOverview.ActionCards)
	}
	if respAssignOverview.ActionCards[0].Data["totalShifts"] != 2 {
		t.Errorf("expected totalShifts 2, got: %v", respAssignOverview.ActionCards[0].Data["totalShifts"])
	}

	// 4. Temporary assignments query: "temporary assignments"
	reqTemp := &models.AIChatRequest{
		Message:      "temporary assignments",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respTemp, err := aiService.ProcessChat(ctx, reqTemp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respTemp.Reply, "Jerry Sub") {
		t.Errorf("expected temporary assignment reply to mention Jerry Sub, got: %s", respTemp.Reply)
	}

	// 5. Driver assignment: "Assign route 102 to Tom"
	reqAssign1 := &models.AIChatRequest{
		Message:      "Assign route 102 to Tom",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respAssign1, err := aiService.ProcessChat(ctx, reqAssign1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respAssign1.ActionCards) == 0 || respAssign1.ActionCards[0].Type != "confirm_action" {
		t.Fatalf("expected confirm_action card, got: %+v", respAssign1.ActionCards)
	}
	if respAssign1.ActionCards[0].Data["routeNo"] != "102" || respAssign1.ActionCards[0].Data["driverName"] != "Tom Driver" {
		t.Errorf("expected route 102 and driver Tom Driver, got: %+v", respAssign1.ActionCards[0].Data)
	}

	// 6. Driver assignment Chinese syntax: "把线路102分配给Tom"
	reqAssign2 := &models.AIChatRequest{
		Message:      "把线路102分配给Tom",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respAssign2, err := aiService.ProcessChat(ctx, reqAssign2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respAssign2.ActionCards) == 0 || respAssign2.ActionCards[0].Type != "confirm_action" {
		t.Fatalf("expected confirm_action card, got: %+v", respAssign2.ActionCards)
	}
	if respAssign2.ActionCards[0].Data["routeNo"] != "102" || respAssign2.ActionCards[0].Data["driverName"] != "Tom Driver" {
		t.Errorf("expected route 102 and driver Tom Driver, got: %+v", respAssign2.ActionCards[0].Data)
	}
}

func TestAIService_VehicleStudentEmployeeFlows(t *testing.T) {
	ctx := context.Background()
	today := time.Now().Format("2006-01-02")

	mockDisp := &mockDispatchRepo{
		shifts: []*models.DispatchShift{
			{
				ID:           "SHIFT-1",
				DispatchDate: today,
				RouteNo:      "101",
				ShiftType:    "AM",
				DriverID:     "EMP-001",
				DriverName:   "Tom Driver",
				UnitNumber:   "BUS-50",
			},
		},
	}

	empRepo := repository.NewMemoryEmployeeRepository()
	_ = empRepo.Create(ctx, &models.Employee{
		ID:             "EMP-001",
		EmployeeNumber: "1001",
		FullName:       "Tom Driver",
		FirstName:      "Tom",
		LastName:       "Driver",
		JobPosition:    "Driver",
		MobilePhone:    "613-555-0101",
		IsActive:       true,
		DriverLicense: &models.DriverLicense{
			LicenseClass:   "Class B",
			ExpirationDate: time.Now().AddDate(1, 0, 0),
		},
	})

	vehRepo := repository.NewInMemoryVehicleRepository()
	_, _ = vehRepo.CreateVehicle(ctx, &models.Vehicle{
		ID:           "VEH-001",
		UnitNumber:   "BUS-50",
		PlateNumber:  "ABC-1234",
		Manufacturer: "Blue Bird",
		Model:        "CE Series",
		Year:         2024,
		UnitType:     "Bus",
		Status:       "In Service",
		YardName:     "North Yard",
		DriverName:   "Tom Driver",
		SeatCap:      72,
		Active:       true,
	})

	stuRepo := repository.NewMemoryStudentRepository()
	_ = stuRepo.Create(ctx, &models.Student{
		ID:          "STU-101",
		StudentNo:   "101",
		FirstName:   "Alice",
		LastName:    "Smith",
		FullName:    "Alice Smith",
		StudentName: "Alice Smith",
		SchoolName:  "St. Patrick High",
		Grade:       "4",
		Routes:      "101",
		MetatBus:    true,
		Active:      true,
		Contacts: []models.StudentContact{
			{
				ContactName:    "Bob Smith",
				Relationship:   "Father",
				MobilePhone:    "613-555-0199",
				PrimaryContact: true,
			},
		},
	})

	aiToolService := NewAIToolService(mockDisp, empRepo, nil, vehRepo, nil, stuRepo)
	aiService := NewAIService(aiToolService)

	// 1. Student details query: "find student Alice"
	reqStu := &models.AIChatRequest{
		Message:      "find student Alice",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respStu, err := aiService.ProcessChat(ctx, reqStu)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respStu.Reply, "Alice Smith") {
		t.Errorf("expected reply to mention Alice Smith, got: %s", respStu.Reply)
	}
	if len(respStu.ActionCards) == 0 || respStu.ActionCards[0].Type != "student_details" {
		t.Fatalf("expected student_details card, got: %+v", respStu.ActionCards)
	}
	if respStu.ActionCards[0].Data["studentNo"] != "101" {
		t.Errorf("expected studentNo 101, got: %v", respStu.ActionCards[0].Data["studentNo"])
	}

	// 2. Student summary query: "how many students"
	reqStuSumm := &models.AIChatRequest{
		Message:      "how many students",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respStuSumm, err := aiService.ProcessChat(ctx, reqStuSumm)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respStuSumm.ActionCards) == 0 || respStuSumm.ActionCards[0].Type != "student_summary" {
		t.Fatalf("expected student_summary card, got: %+v", respStuSumm.ActionCards)
	}
	if respStuSumm.ActionCards[0].Data["totalStudents"] != 1 {
		t.Errorf("expected totalStudents 1, got: %v", respStuSumm.ActionCards[0].Data["totalStudents"])
	}

	// 3. Vehicle details query: "vehicle BUS-50"
	reqVeh := &models.AIChatRequest{
		Message:      "vehicle BUS-50",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respVeh, err := aiService.ProcessChat(ctx, reqVeh)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respVeh.Reply, "BUS-50") {
		t.Errorf("expected reply to mention BUS-50, got: %s", respVeh.Reply)
	}
	if len(respVeh.ActionCards) == 0 || respVeh.ActionCards[0].Type != "vehicle_details" {
		t.Fatalf("expected vehicle_details card, got: %+v", respVeh.ActionCards)
	}
	if respVeh.ActionCards[0].Data["unitNumber"] != "BUS-50" {
		t.Errorf("expected unitNumber BUS-50, got: %v", respVeh.ActionCards[0].Data["unitNumber"])
	}

	// 4. Vehicle summary query: "fleet status"
	reqVehSumm := &models.AIChatRequest{
		Message:      "fleet status",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respVehSumm, err := aiService.ProcessChat(ctx, reqVehSumm)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respVehSumm.ActionCards) == 0 || respVehSumm.ActionCards[0].Type != "vehicle_summary" {
		t.Fatalf("expected vehicle_summary card, got: %+v", respVehSumm.ActionCards)
	}
	if respVehSumm.ActionCards[0].Data["totalVehicles"] != 1 {
		t.Errorf("expected totalVehicles 1, got: %v", respVehSumm.ActionCards[0].Data["totalVehicles"])
	}

	// 5. Employee details query: "driver Tom info"
	reqEmp := &models.AIChatRequest{
		Message:      "driver Tom info",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respEmp, err := aiService.ProcessChat(ctx, reqEmp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respEmp.Reply, "Tom Driver") {
		t.Errorf("expected reply to mention Tom Driver, got: %s", respEmp.Reply)
	}
	if len(respEmp.ActionCards) == 0 || respEmp.ActionCards[0].Type != "employee_details" {
		t.Fatalf("expected employee_details card, got: %+v", respEmp.ActionCards)
	}
	if respEmp.ActionCards[0].Data["employeeNumber"] != "1001" {
		t.Errorf("expected employeeNumber 1001, got: %v", respEmp.ActionCards[0].Data["employeeNumber"])
	}

	// 6. Employee summary query: "staff directory"
	reqEmpSumm := &models.AIChatRequest{
		Message:      "staff directory",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Alice",
		Date:         today,
		Lang:         "en",
	}
	respEmpSumm, err := aiService.ProcessChat(ctx, reqEmpSumm)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respEmpSumm.ActionCards) == 0 || respEmpSumm.ActionCards[0].Type != "employee_summary" {
		t.Fatalf("expected employee_summary card, got: %+v", respEmpSumm.ActionCards)
	}
	if respEmpSumm.ActionCards[0].Data["totalEmployees"] != 1 {
		t.Errorf("expected totalEmployees 1, got: %v", respEmpSumm.ActionCards[0].Data["totalEmployees"])
	}
}

func TestAIService_TimeOffAndExpenseClaims(t *testing.T) {
	ctx := context.Background()
	today := time.Now().Format("2006-01-02")

	mockDisp := &mockDispatchRepo{
		timeOffRequests: []*models.TimeOffRequest{
			{
				ID:             "TOR-001",
				EmployeeID:     "EMP-1001",
				EmployeeNumber: "1001",
				EmployeeName:   "Bob Driver",
				LeaveType:      models.LeaveTypeVacation,
				StartDate:      today,
				EndDate:        today,
				ShiftType:      "ALL",
				Status:         models.TimeOffStatusApproved,
				Comments:       "Family trip",
				ApprovedByName: "HR Manager",
			},
			{
				ID:             "TOR-002",
				EmployeeID:     "EMP-1002",
				EmployeeNumber: "1002",
				EmployeeName:   "Alice Helper",
				LeaveType:      models.LeaveTypeSickLeave,
				StartDate:      "2026-10-15",
				EndDate:        "2026-10-16",
				ShiftType:      "AM",
				Status:         models.TimeOffStatusPending,
				Comments:       "Doctor appointment",
			},
		},
		expenseClaims: []*models.ExpenseReimbursement{
			{
				ID:           "EXP-001",
				EmployeeID:   "EMP-1001",
				EmployeeName: "Bob Driver",
				ClaimDate:    today,
				RouteNo:      "OCSB-050",
				TotalAmount:  45.50,
				Status:       "pending",
				Lines: []models.ExpenseReimbursementLine{
					{
						ID:                  "LINE-1",
						CategoryCode:        "fuel",
						CategoryDisplayName: "Emergency Fuel",
						Amount:              45.50,
						Note:                "Shell station fill-up",
					},
				},
			},
			{
				ID:           "EXP-002",
				EmployeeID:   "EMP-1002",
				EmployeeName: "Alice Helper",
				ClaimDate:    "2026-10-01",
				RouteNo:      "CSDF-001",
				TotalAmount:  15.00,
				Status:       "approved",
				ApprovedByName: "Payroll Officer",
				Lines: []models.ExpenseReimbursementLine{
					{
						ID:                  "LINE-2",
						CategoryCode:        "parking",
						CategoryDisplayName: "School Parking Fee",
						Amount:              15.00,
					},
				},
			},
		},
	}

	mockEmp := repository.NewMemoryEmployeeRepository()
	mockRoute := &mockRouteRepo{}
	mockVeh := repository.NewInMemoryVehicleRepository()
	mockPay := repository.NewMemoryPayrollRepository()
	mockStu := repository.NewMemoryStudentRepository()

	toolService := NewAIToolService(mockDisp, mockEmp, mockRoute, mockVeh, mockPay, mockStu)
	aiService := NewAIService(toolService)

	// 1. Time off summary query: "time off summary"
	reqTOSumm := &models.AIChatRequest{
		Message:      "time off summary",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Dan",
		Date:         today,
		Lang:         "en",
	}
	respTOSumm, err := aiService.ProcessChat(ctx, reqTOSumm)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respTOSumm.ActionCards) == 0 || respTOSumm.ActionCards[0].Type != "time_off_summary" {
		t.Fatalf("expected time_off_summary card, got: %+v", respTOSumm.ActionCards)
	}
	if respTOSumm.ActionCards[0].Data["totalRequests"] != 2 {
		t.Errorf("expected totalRequests 2, got: %v", respTOSumm.ActionCards[0].Data["totalRequests"])
	}
	if respTOSumm.ActionCards[0].Data["pendingCount"] != 1 {
		t.Errorf("expected pendingCount 1, got: %v", respTOSumm.ActionCards[0].Data["pendingCount"])
	}
	if respTOSumm.ActionCards[0].Data["activeTodayCount"] != 1 {
		t.Errorf("expected activeTodayCount 1, got: %v", respTOSumm.ActionCards[0].Data["activeTodayCount"])
	}

	// 2. Who is off today query: "who is off today?"
	reqWhoOff := &models.AIChatRequest{
		Message:      "who is off today?",
		UserRole:     "dispatcher",
		OperatorName: "Dispatcher Dan",
		Date:         today,
		Lang:         "en",
	}
	respWhoOff, err := aiService.ProcessChat(ctx, reqWhoOff)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respWhoOff.Reply, "Bob Driver") {
		t.Errorf("expected Bob Driver in reply, got: %s", respWhoOff.Reply)
	}
	if len(respWhoOff.ActionCards) == 0 || respWhoOff.ActionCards[0].Type != "time_off_details" {
		t.Fatalf("expected time_off_details card, got: %+v", respWhoOff.ActionCards)
	}

	// 3. Pending time off requests: "pending leave requests"
	reqPendingTO := &models.AIChatRequest{
		Message:      "pending leave requests",
		UserRole:     "HR",
		OperatorName: "HR Officer",
		Date:         today,
		Lang:         "en",
	}
	respPendingTO, err := aiService.ProcessChat(ctx, reqPendingTO)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respPendingTO.Reply, "Alice Helper") {
		t.Errorf("expected Alice Helper in reply, got: %s", respPendingTO.Reply)
	}

	// 4. Expense summary query: "expense summary"
	reqExpSumm := &models.AIChatRequest{
		Message:      "expense summary",
		UserRole:     "payroll",
		OperatorName: "Payroll Officer",
		Date:         today,
		Lang:         "en",
	}
	respExpSumm, err := aiService.ProcessChat(ctx, reqExpSumm)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respExpSumm.ActionCards) == 0 || respExpSumm.ActionCards[0].Type != "expense_summary" {
		t.Fatalf("expected expense_summary card, got: %+v", respExpSumm.ActionCards)
	}
	if respExpSumm.ActionCards[0].Data["totalClaims"] != 2 {
		t.Errorf("expected totalClaims 2, got: %v", respExpSumm.ActionCards[0].Data["totalClaims"])
	}
	if respExpSumm.ActionCards[0].Data["pendingCount"] != 1 {
		t.Errorf("expected pendingCount 1, got: %v", respExpSumm.ActionCards[0].Data["pendingCount"])
	}

	// 5. Expense details query: "pending expense claims"
	reqExpDet := &models.AIChatRequest{
		Message:      "pending expense claims",
		UserRole:     "payroll",
		OperatorName: "Payroll Officer",
		Date:         today,
		Lang:         "en",
	}
	respExpDet, err := aiService.ProcessChat(ctx, reqExpDet)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respExpDet.Reply, "Bob Driver") {
		t.Errorf("expected Bob Driver in reply, got: %s", respExpDet.Reply)
	}
	if len(respExpDet.ActionCards) == 0 || respExpDet.ActionCards[0].Type != "expense_details" {
		t.Fatalf("expected expense_details card, got: %+v", respExpDet.ActionCards)
	}

	// 6. RBAC rejection test: Driver role asking for expense summary
	reqExpDriver := &models.AIChatRequest{
		Message:      "expense summary",
		UserRole:     "driver",
		OperatorName: "Driver Dave",
		Date:         today,
		Lang:         "en",
	}
	respExpDriver, err := aiService.ProcessChat(ctx, reqExpDriver)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respExpDriver.Reply, "Permission Denied") {
		t.Errorf("expected Permission Denied for driver asking for expense summary, got: %s", respExpDriver.Reply)
	}
}

func TestAIService_PayrollFeatures(t *testing.T) {
	ctx := context.Background()
	today := time.Now().Format("2006-01-02")

	mockDisp := &mockDispatchRepo{
		dispatchPayrolls: []*models.DispatchPayrollRecord{
			{
				ID:           "DP-001-driver",
				DispatchDate: today,
				ShiftID:      "DS-001",
				RouteNo:      "OCSB-050",
				Role:         "driver",
				EmployeeName: "Bob Driver",
				PayRate:      44.00,
				EiHours:      2.50,
				Status:       "pending_approval",
			},
			{
				ID:           "DP-002-attendant",
				DispatchDate: today,
				ShiftID:      "DS-002",
				RouteNo:      "CSDF-001",
				Role:         "attendant",
				EmployeeName: "Alice Helper",
				PayRate:      29.00,
				EiHours:      2.50,
				Status:       "approved",
			},
		},
	}

	mockEmp := repository.NewMemoryEmployeeRepository()
	mockRoute := &mockRouteRepo{}
	mockVeh := repository.NewInMemoryVehicleRepository()
	mockPay := repository.NewMemoryPayrollRepository()
	mockStu := repository.NewMemoryStudentRepository()

	toolService := NewAIToolService(mockDisp, mockEmp, mockRoute, mockVeh, mockPay, mockStu)
	aiService := NewAIService(toolService)

	// 1. Overall Payroll Rates Summary
	reqSumm := &models.AIChatRequest{
		Message:      "payroll summary",
		UserRole:     "payroll",
		OperatorName: "Payroll Officer",
		Date:         today,
		Lang:         "en",
	}
	respSumm, err := aiService.ProcessChat(ctx, reqSumm)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respSumm.ActionCards) == 0 || respSumm.ActionCards[0].Type != "payroll_summary" {
		t.Fatalf("expected payroll_summary card, got: %+v", respSumm.ActionCards)
	}
	if respSumm.ActionCards[0].Data["totalRates"] == 0 {
		t.Errorf("expected positive totalRates, got 0")
	}

	// 2. Specific Rate Query: "rate for route 101"
	reqRate := &models.AIChatRequest{
		Message:      "rate for route 101",
		UserRole:     "payroll",
		OperatorName: "Payroll Officer",
		Date:         today,
		Lang:         "en",
	}
	respRate, err := aiService.ProcessChat(ctx, reqRate)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respRate.ActionCards) == 0 || respRate.ActionCards[0].Type != "payroll_details" {
		t.Fatalf("expected payroll_details card, got: %+v", respRate.ActionCards)
	}
	if !strings.Contains(respRate.Reply, "PR-CUST-RT101") && !strings.Contains(respRate.Reply, "48.50") {
		t.Errorf("expected route 101 rate details in reply, got: %s", respRate.Reply)
	}

	// 3. Daily Dispatch Shift Payroll liability: "dispatch payroll summary"
	reqDispPay := &models.AIChatRequest{
		Message:      "dispatch payroll summary",
		UserRole:     "payroll",
		OperatorName: "Payroll Officer",
		Date:         today,
		Lang:         "en",
	}
	respDispPay, err := aiService.ProcessChat(ctx, reqDispPay)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(respDispPay.ActionCards) == 0 || respDispPay.ActionCards[0].Type != "dispatch_payroll_summary" {
		t.Fatalf("expected dispatch_payroll_summary card, got: %+v", respDispPay.ActionCards)
	}
	if respDispPay.ActionCards[0].Data["totalRecords"] != 2 {
		t.Errorf("expected totalRecords 2, got: %v", respDispPay.ActionCards[0].Data["totalRecords"])
	}
	if respDispPay.ActionCards[0].Data["totalLiability"] != 73.00 {
		t.Errorf("expected totalLiability 73.00, got: %v", respDispPay.ActionCards[0].Data["totalLiability"])
	}

	// 4. Permission Denied check: Driver role inquiring about payroll
	reqDriver := &models.AIChatRequest{
		Message:      "dispatch payroll summary",
		UserRole:     "driver",
		OperatorName: "Driver Bob",
		Date:         today,
		Lang:         "en",
	}
	respDriver, err := aiService.ProcessChat(ctx, reqDriver)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(respDriver.Reply, "Permission Denied") {
		t.Errorf("expected Permission Denied for driver inquiring about payroll, got: %s", respDriver.Reply)
	}
}


