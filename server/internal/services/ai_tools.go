package services

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type AIToolService struct {
	dispatchRepo   repository.DispatchRepository
	employeeRepo   repository.EmployeeRepository
	routeRepo      repository.RouteRepository
	vehicleRepo    repository.VehicleRepository
	payrollRepo    repository.PayrollRepository
	studentRepo    repository.StudentRepository
	mu             sync.RWMutex
	pendingActions map[string]*models.PendingDispatchAction
}

func NewAIToolService(
	dispatchRepo repository.DispatchRepository,
	employeeRepo repository.EmployeeRepository,
	routeRepo repository.RouteRepository,
	vehicleRepo repository.VehicleRepository,
	payrollRepo repository.PayrollRepository,
	studentRepo repository.StudentRepository,
) *AIToolService {
	return &AIToolService{
		dispatchRepo:   dispatchRepo,
		employeeRepo:   employeeRepo,
		routeRepo:      routeRepo,
		vehicleRepo:    vehicleRepo,
		payrollRepo:    payrollRepo,
		studentRepo:    studentRepo,
		pendingActions: make(map[string]*models.PendingDispatchAction),
	}
}

// GetUnassignedShifts finds shifts on a date that do not have a driver assigned
func (s *AIToolService) GetUnassignedShifts(ctx context.Context, date string, yardFilter string) ([]*models.DispatchShift, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	shifts, err := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{})
	if err != nil {
		return nil, fmt.Errorf("failed to list shifts for date %s: %w", date, err)
	}

	var unassigned []*models.DispatchShift
	for _, shift := range shifts {
		if yardFilter != "" && yardFilter != "ALL" && !strings.EqualFold(shift.YardName, yardFilter) {
			continue
		}
		// A shift is unassigned if driverId is empty or driverName is empty
		driverId := strings.TrimSpace(shift.DriverID)
		driverName := strings.TrimSpace(shift.DriverName)
		if driverId == "" || driverName == "" || strings.EqualFold(driverName, "unassigned") {
			unassigned = append(unassigned, shift)
		}
	}

	return unassigned, nil
}

// PrepareDriverAssignment matches driver and route, then generates a pending confirmation action
func (s *AIToolService) PrepareDriverAssignment(
	ctx context.Context,
	date string,
	routeQuery string,
	driverQuery string,
	shiftType string,
	operatorName string,
	operatorRole string,
	pagePermissions map[string]string,
	lang string,
) (*models.PendingDispatchAction, string, error) {
	if !CanModifyDispatchShifts(operatorRole, pagePermissions) {
		return nil, "", fmt.Errorf("insufficient permissions: role '%s' cannot modify dispatch shifts", operatorRole)
	}

	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	isFr := strings.EqualFold(lang, "fr")

	// 1. Search employee (driver)
	matchedEmp, candidates, err := s.FindDriver(ctx, driverQuery)
	if err != nil {
		return nil, "", err
	}
	if matchedEmp == nil {
		if len(candidates) > 1 {
			names := make([]string, len(candidates))
			for i, c := range candidates {
				names[i] = fmt.Sprintf("%s (%s)", c.FullName, c.ID)
			}
			if isFr {
				return nil, "", fmt.Errorf("plusieurs employés correspondent: %s. Veuillez spécifier le nom ou le matricule exact", strings.Join(names, ", "))
			}
			return nil, "", fmt.Errorf("multiple matching employees found: %s. Please specify the exact name or employee ID", strings.Join(names, ", "))
		}
		if isFr {
			return nil, "", fmt.Errorf("aucun chauffeur ou employé actif trouvé sous le nom '%s'", driverQuery)
		}
		return nil, "", fmt.Errorf("no active driver or employee found matching '%s'", driverQuery)
	}

	// 2. Find route and its shifts
	shifts, err := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{})
	if err != nil {
		if isFr {
			return nil, "", fmt.Errorf("échec de la récupération des quarts pour le %s: %w", date, err)
		}
		return nil, "", fmt.Errorf("failed to retrieve shifts for date %s: %w", date, err)
	}

	var targetShifts []*models.DispatchShift
	cleanRouteQuery := strings.ToLower(strings.TrimSpace(routeQuery))
	cleanRouteQuery = strings.TrimPrefix(cleanRouteQuery, "线路")
	cleanRouteQuery = strings.TrimPrefix(cleanRouteQuery, "route")
	cleanRouteQuery = strings.TrimPrefix(cleanRouteQuery, "ligne")
	cleanRouteQuery = strings.TrimSpace(cleanRouteQuery)

	for _, sh := range shifts {
		match := strings.EqualFold(sh.RouteNo, cleanRouteQuery) ||
			strings.EqualFold(sh.RouteNo, routeQuery) ||
			strings.Contains(strings.ToLower(sh.RouteNo), cleanRouteQuery) ||
			strings.Contains(strings.ToLower(sh.RouteName), cleanRouteQuery)
		if match {
			if shiftType == "" || strings.EqualFold(shiftType, "ALL") || strings.EqualFold(sh.ShiftType, shiftType) {
				targetShifts = append(targetShifts, sh)
			}
		}
	}

	if len(targetShifts) == 0 {
		if isFr {
			return nil, "", fmt.Errorf("aucun quart de régulation trouvé pour la ligne '%s' au %s (veuillez vérifier les horaires ou le numéro de ligne)", routeQuery, date)
		}
		return nil, "", fmt.Errorf("no dispatch shifts found for route '%s' on %s (please verify the schedule or route number)", routeQuery, date)
	}

	// 3. Assemble Pending Action
	shiftIDs := make([]string, len(targetShifts))
	oldDrivers := make([]string, 0)
	for i, sh := range targetShifts {
		shiftIDs[i] = sh.ID
		if sh.DriverName != "" {
			oldDrivers = append(oldDrivers, fmt.Sprintf("%s: %s", sh.ShiftType, sh.DriverName))
		}
	}

	routeNo := targetShifts[0].RouteNo
	routeName := targetShifts[0].RouteName
	oldDriverStr := strings.Join(oldDrivers, "; ")
	if oldDriverStr == "" {
		if isFr {
			oldDriverStr = "Aucun (Non assigné)"
		} else {
			oldDriverStr = "None (Unassigned)"
		}
	}

	shiftTypeDisplay := "All Shifts (AM/PM)"
	if isFr {
		shiftTypeDisplay = "Tous les quarts (AM/PM)"
	}
	if shiftType != "" && !strings.EqualFold(shiftType, "ALL") {
		if isFr {
			shiftTypeDisplay = fmt.Sprintf("Quart %s", strings.ToUpper(shiftType))
		} else {
			shiftTypeDisplay = fmt.Sprintf("%s Shift", strings.ToUpper(shiftType))
		}
	}

	actionID := fmt.Sprintf("ACT-%d", time.Now().UnixNano())
	action := &models.PendingDispatchAction{
		ID:            actionID,
		ActionType:    "ASSIGN_DRIVER",
		Date:          date,
		RouteNo:       routeNo,
		RouteName:     routeName,
		ShiftType:     shiftTypeDisplay,
		ShiftIDs:      shiftIDs,
		DriverID:      matchedEmp.ID,
		DriverName:    matchedEmp.FullName,
		DriverPhone:   matchedEmp.MobilePhone,
		OldDriverName: oldDriverStr,
		CreatedBy:     operatorName,
		CreatedByRole: operatorRole,
		CreatedAt:     time.Now().UTC(),
	}

	s.mu.Lock()
	s.pendingActions[actionID] = action
	s.mu.Unlock()

	var summaryMsg string
	if isFr {
		summaryMsg = fmt.Sprintf(
			"Affectation de régulation prête. Veuillez confirmer :\n- **Ligne** : %s (%s)\n- **Date** : %s (%s)\n- **Chauffeur désigné** : %s (Matricule : %s)\n- **Ancien chauffeur** : %s\n\nVeuillez cliquer sur le bouton ci-dessous pour confirmer ou annuler.",
			routeNo, routeName, date, shiftTypeDisplay, matchedEmp.FullName, matchedEmp.ID, oldDriverStr,
		)
	} else {
		summaryMsg = fmt.Sprintf(
			"Dispatch assignment ready for execution. Please confirm:\n- **Route**: %s (%s)\n- **Date**: %s (%s)\n- **Assigned Driver**: %s (ID: %s)\n- **Previous Driver**: %s\n\nPlease click the button below to confirm or cancel.",
			routeNo, routeName, date, shiftTypeDisplay, matchedEmp.FullName, matchedEmp.ID, oldDriverStr,
		)
	}

	return action, summaryMsg, nil
}

// PrepareCreateDispatchSheet prepares a confirmation action to generate shifts for a date
func (s *AIToolService) PrepareCreateDispatchSheet(
	ctx context.Context,
	date string,
	operatorName string,
	operatorRole string,
	pagePermissions map[string]string,
	lang string,
) (*models.PendingDispatchAction, string, error) {
	if !CanModifyDispatchShifts(operatorRole, pagePermissions) {
		return nil, "", fmt.Errorf("insufficient permissions: role '%s' cannot create dispatch sheet", operatorRole)
	}

	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	isFr := strings.EqualFold(lang, "fr")

	existingShifts, _ := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{})
	existingCount := len(existingShifts)

	actionID := fmt.Sprintf("ACT-SHEET-%d", time.Now().UnixNano())
	action := &models.PendingDispatchAction{
		ID:            actionID,
		ActionType:    "CREATE_DISPATCH_SHEET",
		Date:          date,
		RouteNo:       "ALL",
		RouteName:     fmt.Sprintf("Daily Dispatch Sheet (%s)", date),
		CreatedBy:     operatorName,
		CreatedByRole: operatorRole,
		CreatedAt:     time.Now().UTC(),
	}

	s.mu.Lock()
	s.pendingActions[actionID] = action
	s.mu.Unlock()

	var summaryMsg string
	if isFr {
		if existingCount > 0 {
			summaryMsg = fmt.Sprintf(
				"Création de la **feuille de régulation (Dispatch Sheet)** pour le **%s** :\n- **Date ciblée** : %s\n- **Quarts existants** : %d quart(s) déjà présent(s)\n- **Opération** : Générer et compléter les quarts selon les lignes actives\n\nVeuillez cliquer sur le bouton ci-dessous pour confirmer l'exécution.",
				date, date, existingCount,
			)
		} else {
			summaryMsg = fmt.Sprintf(
				"Création de la **feuille de régulation (Dispatch Sheet)** pour le **%s** :\n- **Date ciblée** : %s\n- **Opération** : Générer tous les quarts quotidiens (matin/après-midi) pour les lignes actives\n\nVeuillez cliquer sur le bouton ci-dessous pour confirmer l'exécution.",
				date, date,
			)
		}
	} else {
		if existingCount > 0 {
			summaryMsg = fmt.Sprintf(
				"Ready to generate the **Daily Dispatch Sheet** for **%s**:\n- **Target Date**: %s\n- **Existing Shifts**: %d shift(s) already recorded\n- **Operation**: Generate and populate daily shifts from active master routes\n\nPlease click the button below to confirm and create.",
				date, date, existingCount,
			)
		} else {
			summaryMsg = fmt.Sprintf(
				"Ready to generate the **Daily Dispatch Sheet** for **%s**:\n- **Target Date**: %s\n- **Operation**: Generate all daily shifts (AM/PM runs) from active master routes\n\nPlease click the button below to confirm and create.",
				date, date,
			)
		}
	}

	return action, summaryMsg, nil
}

// ExecutePendingAction confirms and applies the pending dispatch action and saves audit logs
func (s *AIToolService) ExecutePendingAction(ctx context.Context, actionID string, operatorUser, operatorName, operatorRole string, pagePermissions map[string]string) (*models.PendingDispatchAction, error) {
	s.mu.Lock()
	action, ok := s.pendingActions[actionID]
	if ok {
		delete(s.pendingActions, actionID)
	}
	s.mu.Unlock()

	if !ok || action == nil {
		return nil, fmt.Errorf("action expired or not found; please submit a new instruction")
	}

	effectiveRole := operatorRole
	if effectiveRole == "" {
		effectiveRole = action.CreatedByRole
	}
	if !CanModifyDispatchShifts(effectiveRole, pagePermissions) {
		return nil, fmt.Errorf("insufficient permissions: role '%s' cannot execute dispatch shift changes", effectiveRole)
	}

	if operatorName == "" {
		operatorName = action.CreatedBy
	}
	if operatorName == "" {
		operatorName = "Dispatcher (via AI Copilot)"
	}

	now := time.Now()
	nowTimeStr := repository.FormatDispatchLogTime(now)

	// Execute dispatch sheet creation if action is CREATE_DISPATCH_SHEET
	if action.ActionType == "CREATE_DISPATCH_SHEET" {
		res, err := s.dispatchRepo.CreateDay(ctx, action.Date, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to generate dispatch sheet: %w", err)
		}

		changeLog := &models.DispatchChangeLog{
			ID:           fmt.Sprintf("LOG-AI-%d", time.Now().UnixNano()),
			DispatchDate: action.Date,
			Type:         "Day Generated",
			Detail:       fmt.Sprintf("AI Dispatcher: Generated daily dispatch sheet for %s (%d shifts created, %d skipped existing)", action.Date, res.Created, res.SkippedExisting),
			Time:         nowTimeStr,
			Timestamp:    now.UnixMilli(),
			User:         fmt.Sprintf("%s (AI Copilot)", operatorName),
			CreatedAt:    now.UTC().Format(time.RFC3339),
		}
		_, _ = s.dispatchRepo.AddChangeLog(ctx, changeLog)
		return action, nil
	}

	// Execute shift driver updates for each shift
	for _, shiftID := range action.ShiftIDs {
		updateReq := &models.UpdateDispatchShiftRequest{
			DriverID:    &action.DriverID,
			DriverName:  &action.DriverName,
			DriverPhone: &action.DriverPhone,
		}
		_, err := s.dispatchRepo.UpdateShift(ctx, shiftID, updateReq)
		if err != nil {
			return nil, fmt.Errorf("failed to update shift %s: %w", shiftID, err)
		}

		// Save change log into dispatch_change_logs
		changeLog := &models.DispatchChangeLog{
			ID:           fmt.Sprintf("LOG-AI-%d", time.Now().UnixNano()),
			DispatchDate: action.Date,
			ShiftID:      shiftID,
			RouteNo:      action.RouteNo,
			ShiftType:    action.ShiftType,
			Type:         "Assignment Updated",
			Detail:       fmt.Sprintf("AI Dispatcher: Reassigned driver to %s (%s). Previous: %s", action.DriverName, action.DriverID, action.OldDriverName),
			Time:         nowTimeStr,
			Timestamp:    now.UnixMilli(),
			User:         fmt.Sprintf("%s (AI Copilot)", operatorName),
			CreatedAt:    now.UTC().Format(time.RFC3339),
		}
		_, _ = s.dispatchRepo.AddChangeLog(ctx, changeLog)
	}

	return action, nil
}

// FindDriver fuzzy searches active employees for a matching driver
func (s *AIToolService) FindDriver(ctx context.Context, query string) (*models.Employee, []*models.Employee, error) {
	cleanQuery := strings.ToLower(strings.TrimSpace(query))
	if cleanQuery == "" {
		return nil, nil, nil
	}

	filter := repository.EmployeeFilter{
		Search: query,
	}
	employees, err := s.employeeRepo.List(ctx, filter)
	if err != nil {
		// Try listing all and local filter
		employees, err = s.employeeRepo.List(ctx, repository.EmployeeFilter{})
		if err != nil {
			return nil, nil, err
		}
	}

	var exactMatches []*models.Employee
	var matches []*models.Employee
	for _, emp := range employees {
		if !emp.IsActive {
			continue
		}
		fullName := strings.ToLower(emp.FullName)
		empID := strings.ToLower(emp.ID)
		empNum := strings.ToLower(emp.EmployeeNumber)
		firstName := strings.ToLower(emp.FirstName)
		lastName := strings.ToLower(emp.LastName)

		if fullName == cleanQuery || empID == cleanQuery || empNum == cleanQuery || firstName == cleanQuery || lastName == cleanQuery {
			exactMatches = append(exactMatches, emp)
			continue
		}
		if strings.Contains(fullName, cleanQuery) || strings.Contains(empID, cleanQuery) || strings.Contains(empNum, cleanQuery) {
			matches = append(matches, emp)
		}
	}

	if len(exactMatches) == 1 {
		return exactMatches[0], nil, nil
	}
	if len(exactMatches) > 1 {
		return nil, exactMatches, nil
	}
	if len(matches) == 1 {
		return matches[0], nil, nil
	}
	return nil, matches, nil
}

// GetDriverSchedule lists shifts for a driver on a given date
func (s *AIToolService) GetDriverSchedule(ctx context.Context, driverQuery string, date string, lang string) (string, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	isFr := strings.EqualFold(lang, "fr")

	driver, candidates, err := s.FindDriver(ctx, driverQuery)
	if err != nil {
		return "", err
	}
	if driver == nil {
		if len(candidates) > 1 {
			names := make([]string, len(candidates))
			for i, c := range candidates {
				names[i] = c.FullName
			}
			if isFr {
				return fmt.Sprintf("Plusieurs employés correspondent : %s. Veuillez spécifier le nom exact.", strings.Join(names, ", ")), nil
			}
			return fmt.Sprintf("Multiple matching employees found: %s. Please specify the exact name.", strings.Join(names, ", ")), nil
		}
		if isFr {
			return fmt.Sprintf("Aucun chauffeur actif trouvé sous le nom '%s'.", driverQuery), nil
		}
		return fmt.Sprintf("No active driver found matching '%s'.", driverQuery), nil
	}

	shifts, err := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{})
	if err != nil {
		return "", err
	}

	var assignedShifts []*models.DispatchShift
	for _, sh := range shifts {
		if strings.EqualFold(sh.DriverID, driver.ID) || strings.EqualFold(sh.DriverName, driver.FullName) {
			assignedShifts = append(assignedShifts, sh)
		}
	}

	if len(assignedShifts) == 0 {
		if isFr {
			return fmt.Sprintf("Le chauffeur **%s** (%s) n'a **aucun quart assigné** pour le %s (actuellement disponible).", driver.FullName, driver.ID, date), nil
		}
		return fmt.Sprintf("Driver **%s** (%s) has **no assigned shifts** on %s (currently idle / available).", driver.FullName, driver.ID, date), nil
	}

	var lines []string
	if isFr {
		lines = []string{fmt.Sprintf("Programme des quarts pour **%s** (%s) le %s :", driver.FullName, driver.ID, date)}
		for _, sh := range assignedShifts {
			lines = append(lines, fmt.Sprintf("- Quart **%s** : Ligne `%s` (%s), premier arrêt : `%s`, véhicule : `%s`", sh.ShiftType, sh.RouteNo, sh.RouteName, sh.FirstStopTime, sh.UnitNumber))
		}
	} else {
		lines = []string{fmt.Sprintf("Schedule for Driver **%s** (%s) on %s:", driver.FullName, driver.ID, date)}
		for _, sh := range assignedShifts {
			lines = append(lines, fmt.Sprintf("- **%s** Shift: Route `%s` (%s), First stop: `%s`, Unit: `%s`", sh.ShiftType, sh.RouteNo, sh.RouteName, sh.FirstStopTime, sh.UnitNumber))
		}
	}

	return strings.Join(lines, "\n"), nil
}

// GetFleetSummary generates daily operational summary stats
func (s *AIToolService) GetFleetSummary(ctx context.Context, date string, lang string) (string, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")

	shifts, err := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{})
	if err != nil {
		return "", err
	}

	if len(shifts) == 0 {
		if isZh {
			return fmt.Sprintf("⚠️ **在 %s 暂无校车调度班次记录。**\n\n- 今日调度表尚未生成。\n- 您可以直接对我说：*“生成今日调度表”* 自动生成；\n- 也可以在上方的日期选择器中选择已排班日期查看。", date), nil
		}
		if isFr {
			return fmt.Sprintf("Aucune donnée de quart trouvée pour la date du %s.", date), nil
		}
		return fmt.Sprintf("No dispatch shift records found for %s.", date), nil
	}

	total := len(shifts)
	unassigned := 0
	late := 0
	completed := 0

	for _, sh := range shifts {
		if strings.TrimSpace(sh.DriverID) == "" || strings.TrimSpace(sh.DriverName) == "" {
			unassigned++
		}
		if sh.LateMinutes > 0 {
			late++
		}
		if sh.CompletedStops >= sh.TotalStops && sh.TotalStops > 0 {
			completed++
		}
	}

	if isZh {
		return fmt.Sprintf(
			"### 📊 **%s 校车运营调度总览**\n\n- **班次总计**：%d 个班次\n- **已安排司机**：%d 人在岗\n- **⚠️ 缺少司机班次**：%d 个未分配\n- **已完成班次**：%d\n- **延误班次**：%d",
			date, total, total-unassigned, unassigned, completed, late,
		), nil
	}

	if isFr {
		return fmt.Sprintf(
			"### 📊 Aperçu des opérations de régulation pour le %s\n\n- **Total des quarts** : %d\n- **Chauffeurs assignés** : %d\n- **⚠️ Quarts sans chauffeur** : %d\n- **Quarts complétés** : %d\n- **Quarts en retard** : %d",
			date, total, total-unassigned, unassigned, completed, late,
		), nil
	}

	return fmt.Sprintf(
		"### 📊 Dispatch Operations Overview for %s\n\n- **Total Shifts**: %d\n- **Assigned Drivers**: %d\n- **⚠️ Shifts Missing Drivers**: %d\n- **Completed Shifts**: %d\n- **Delayed Shifts**: %d",
		date, total, total-unassigned, unassigned, completed, late,
	), nil
}

// GetVehicleSummary returns fleet vehicle statistics and vehicle_summary card
func (s *AIToolService) GetVehicleSummary(ctx context.Context, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")

	vehicles, err := s.vehicleRepo.ListVehicles(ctx, repository.VehicleFilter{})
	if err != nil {
		return "", nil, err
	}

	total := len(vehicles)
	active := 0
	inMaintenance := 0
	outOfService := 0
	spare := 0
	wheelchair := 0

	for _, v := range vehicles {
		status := strings.ToLower(v.Status)
		if status == "active" || status == "in service" || status == "in_service" || status == "" {
			active++
		} else if strings.Contains(status, "maint") || strings.Contains(status, "repair") {
			inMaintenance++
		} else if strings.Contains(status, "spare") {
			spare++
		} else {
			outOfService++
		}
		if v.WheelchairCap > 0 {
			wheelchair++
		}
	}

	cardTitle := "Fleet Vehicle Overview"
	if isZh {
		cardTitle = "车队车辆总览"
	} else if isFr {
		cardTitle = "État de la flotte de véhicules"
	}

	card := &models.AIActionCard{
		Type:  "vehicle_summary",
		Title: cardTitle,
		Data: map[string]interface{}{
			"totalVehicles": total,
			"active":        active,
			"inMaintenance": inMaintenance,
			"outOfService":  outOfService,
			"spare":         spare,
			"wheelchair":    wheelchair,
		},
	}

	if isZh {
		return fmt.Sprintf(
			"### 🚐 **车队车辆状态总览**\n\n"+
				"- **在册车辆总数**：**%d** 辆\n"+
				"- **正常在役/可用**：**%d** 辆\n"+
				"- **备用车辆 (Spare)**：**%d** 辆\n"+
				"- **维保检修中**：**%d** 辆\n"+
				"- **停运故障**：**%d** 辆\n"+
				"- **轮椅无障碍校车**：**%d** 辆\n\n"+
				"您可以在 **车辆管理 (Vehicles)** 页面查看完整的车辆档案与点检记录。",
			total, active, spare, inMaintenance, outOfService, wheelchair,
		), card, nil
	}

	if isFr {
		return fmt.Sprintf(
			"### 🚐 État de la flotte de véhicules\n\n"+
				"- **Total des véhicules enregistrés** : **%d**\n"+
				"- **En service / Disponibles** : **%d**\n"+
				"- **En réserve (Spare)** : **%d**\n"+
				"- **En maintenance / Réparation** : **%d**\n"+
				"- **Hors service** : **%d**\n"+
				"- **Accessible en fauteuil roulant** : **%d**\n\n"+
				"Vous pouvez consulter l'inventaire complet dans l'onglet **Véhicules**.",
			total, active, spare, inMaintenance, outOfService, wheelchair,
		), card, nil
	}

	return fmt.Sprintf(
		"### 🚐 Fleet Vehicle Overview\n\n"+
			"- **Total Registered Vehicles**: **%d**\n"+
			"- **Active / In Service**: **%d**\n"+
			"- **Spare / Backup**: **%d**\n"+
			"- **In Maintenance / Repair**: **%d**\n"+
			"- **Out of Service**: **%d**\n"+
			"- **Wheelchair Accessible**: **%d**\n\n"+
			"You can inspect the full fleet inventory on the **Vehicles** page.",
		total, active, spare, inMaintenance, outOfService, wheelchair,
	), card, nil
}

// GetVehicleDetails searches for a specific vehicle by unit number, plate, or VIN
func (s *AIToolService) GetVehicleDetails(ctx context.Context, vehicleQuery string, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")

	cleanQuery := strings.ToLower(strings.TrimSpace(vehicleQuery))
	for _, p := range []string{
		"vehicle info for", "vehicle details for", "vehicle info", "vehicle details", "about vehicle",
		"find vehicle", "bus info for", "bus info", "vehicle fleet status", "vehicle fleet", "fleet status",
		"fleet inventory", "vehicle", "vehicule", "unit", "bus", "véhicule",
		"info véhicule", "détails véhicule", "details vehicule", "车辆信息", "查询车辆", "车队状态", "车辆状态",
		"车队车辆", "车辆总览", "车队总览", "车辆", "车号", "大巴", "校车", "查车",
	} {
		if strings.HasPrefix(cleanQuery, p) {
			cleanQuery = strings.TrimSpace(strings.TrimPrefix(cleanQuery, p))
		}
	}
	for _, sfx := range []string{" status", " info", " details", " 状态", " 信息", " 详情"} {
		if strings.HasSuffix(cleanQuery, sfx) {
			cleanQuery = strings.TrimSpace(strings.TrimSuffix(cleanQuery, sfx))
		}
	}
	cleanQuery = strings.Trim(cleanQuery, " ?:!.,;，。？！#号")

	// If query was generic ("fleet", "vehicles", "flotte", "all", etc.), immediately return fleet summary
	if cleanQuery == "fleet" || cleanQuery == "vehicles" || cleanQuery == "flotte" || cleanQuery == "all" || cleanQuery == "vehicle fleet" || cleanQuery == "车队" || cleanQuery == "全部车辆" || cleanQuery == "" {
		return s.GetVehicleSummary(ctx, lang)
	}

	vehicles, err := s.vehicleRepo.ListVehicles(ctx, repository.VehicleFilter{})
	if err != nil {
		return "", nil, err
	}

	var matches []*models.Vehicle
	for _, v := range vehicles {
		if strings.EqualFold(v.UnitNumber, cleanQuery) || strings.EqualFold(v.PlateNumber, cleanQuery) {
			matches = []*models.Vehicle{v}
			break
		}
		if strings.Contains(strings.ToLower(v.UnitNumber), cleanQuery) ||
			strings.Contains(strings.ToLower(v.PlateNumber), cleanQuery) ||
			strings.Contains(strings.ToLower(v.Vin), cleanQuery) ||
			strings.Contains(strings.ToLower(v.Model), cleanQuery) {
			matches = append(matches, v)
		}
	}

	if len(matches) == 0 {
		if isZh {
			return fmt.Sprintf("未找到车号或车牌包含 “**%s**” 的车辆。您可以前往【车队车辆】页面查看完整清单。", cleanQuery), nil, nil
		}
		if isFr {
			return fmt.Sprintf("Aucun véhicule trouvé pour '%s'. Vous pouvez consulter la page **Véhicules**.", cleanQuery), nil, nil
		}
		return fmt.Sprintf("No vehicle found matching '%s'. You can browse the full fleet on the **Vehicles** page.", cleanQuery), nil, nil
	}

	if len(matches) == 1 {
		v := matches[0]
		statusStr := v.Status
		if statusStr == "" {
			statusStr = "In Service"
		}
		driverStr := v.DriverName
		if driverStr == "" {
			driverStr = "None (Unassigned)"
		}
		routeStr := v.AssignedRouteNo
		if routeStr == "" {
			routeStr = "None"
		}
		yardStr := v.YardName
		if yardStr == "" {
			yardStr = "N/A"
		}

		// Check today's shifts on this vehicle
		var operationalShiftLines []string
		if s.dispatchRepo != nil && date != "" {
			shifts, _ := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{VehicleFilter: v.UnitNumber})
			for _, sh := range shifts {
				dName := sh.DriverName
				if dName == "" {
					dName = "Unassigned"
				}
				if isZh {
					operationalShiftLines = append(operationalShiftLines, fmt.Sprintf("- **%s** 班次（路线 `%s`）：司机 **%s**", sh.ShiftType, sh.RouteNo, dName))
				} else if isFr {
					operationalShiftLines = append(operationalShiftLines, fmt.Sprintf("- Quart **%s** (Ligne `%s`) : Chauffeur **%s**", sh.ShiftType, sh.RouteNo, dName))
				} else {
					operationalShiftLines = append(operationalShiftLines, fmt.Sprintf("- **%s** Shift (Route `%s`): Driver **%s**", sh.ShiftType, sh.RouteNo, dName))
				}
			}
		}

		cardTitle := fmt.Sprintf("Vehicle %s", v.UnitNumber)
		if isZh {
			cardTitle = fmt.Sprintf("车辆详情：%s 号车", v.UnitNumber)
		} else if isFr {
			cardTitle = fmt.Sprintf("Véhicule %s", v.UnitNumber)
		}

		card := &models.AIActionCard{
			Type:  "vehicle_details",
			Title: cardTitle,
			Data: map[string]interface{}{
				"unitNumber":     v.UnitNumber,
				"plateNumber":    v.PlateNumber,
				"model":          fmt.Sprintf("%s %s (%d)", v.Manufacturer, v.Model, v.Year),
				"unitType":       v.UnitType,
				"status":         statusStr,
				"yardName":       yardStr,
				"assignedDriver": driverStr,
				"assignedRoute":  routeStr,
				"seatCap":        v.SeatCap,
				"wheelchairCap":  v.WheelchairCap,
				"odometer":       v.Odometer,
			},
		}

		var reply string
		if isZh {
			reply = fmt.Sprintf(
				"### 🚐 **车辆详情：%s 号车**\n\n"+
					"- **运营状态**：%s\n"+
					"- **车牌号码**：`%s`\n"+
					"- **车型规格**：%s %s (%d 年款)\n"+
					"- **车辆类别/燃油**：%s · %s\n"+
					"- **核载容量**：%d 乘客座 · %d 轮椅位\n"+
					"- **所属车场 (Yard)**：%s\n"+
					"- **常驻司机**：**%s**\n"+
					"- **常驻路线**：`%s`\n"+
					"- **当前里程**：%d km\n",
				v.UnitNumber, statusStr, v.PlateNumber, v.Manufacturer, v.Model, v.Year,
				v.UnitType, v.FuelType, v.SeatCap, v.WheelchairCap, yardStr, driverStr, routeStr, v.Odometer,
			)
			if len(operationalShiftLines) > 0 {
				reply += fmt.Sprintf("\n**%s 当天运营排班：**\n%s", date, strings.Join(operationalShiftLines, "\n"))
			}
		} else if isFr {
			reply = fmt.Sprintf(
				"### 🚐 Détails du véhicule `%s`\n\n"+
					"- **Statut** : %s\n"+
					"- **Plaque d'immatriculation** : `%s`\n"+
					"- **Modèle** : %s %s (%d)\n"+
					"- **Type / Carburant** : %s · %s\n"+
					"- **Capacité** : %d sièges · %d fauteuil(s) roulant(s)\n"+
					"- **Dépôt (Yard)** : %s\n"+
					"- **Chauffeur attitré** : **%s**\n"+
					"- **Ligne attitrée** : `%s`\n"+
					"- **Kilométrage** : %d km\n",
				v.UnitNumber, statusStr, v.PlateNumber, v.Manufacturer, v.Model, v.Year,
				v.UnitType, v.FuelType, v.SeatCap, v.WheelchairCap, yardStr, driverStr, routeStr, v.Odometer,
			)
			if len(operationalShiftLines) > 0 {
				reply += fmt.Sprintf("\n**Quarts prévus le %s :**\n%s", date, strings.Join(operationalShiftLines, "\n"))
			}
		} else {
			reply = fmt.Sprintf(
				"### 🚐 Vehicle Details for `%s`\n\n"+
					"- **Status**: %s\n"+
					"- **License Plate**: `%s`\n"+
					"- **Model**: %s %s (%d)\n"+
					"- **Type & Fuel**: %s · %s\n"+
					"- **Capacity**: %d seats · %d wheelchair(s)\n"+
					"- **Depot / Yard**: %s\n"+
					"- **Assigned Driver**: **%s**\n"+
					"- **Assigned Route**: `%s`\n"+
					"- **Odometer**: %d km\n",
				v.UnitNumber, statusStr, v.PlateNumber, v.Manufacturer, v.Model, v.Year,
				v.UnitType, v.FuelType, v.SeatCap, v.WheelchairCap, yardStr, driverStr, routeStr, v.Odometer,
			)
			if len(operationalShiftLines) > 0 {
				reply += fmt.Sprintf("\n**Operational Shifts on %s:**\n%s", date, strings.Join(operationalShiftLines, "\n"))
			}
		}

		return reply, card, nil
	}

	// Multiple matches
	var lines []string
	if isZh {
		lines = []string{fmt.Sprintf("找到 **%d** 辆匹配的车辆：", len(matches))}
		for i, v := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... 以及另外 %d 辆车。", len(matches)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **车辆 `%s`** (%s · %s) : 状态 %s · 车场 : %s", v.UnitNumber, v.PlateNumber, v.Model, v.Status, v.YardName))
		}
	} else if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** véhicules correspondants :", len(matches))}
		for i, v := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... et %d autres véhicules.", len(matches)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **Véhicule `%s`** (%s · %s) : Statut %s · Dépôt : %s", v.UnitNumber, v.PlateNumber, v.Model, v.Status, v.YardName))
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** matching vehicles:", len(matches))}
		for i, v := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... and %d more vehicles.", len(matches)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **Vehicle `%s`** (%s · %s): Status %s · Yard: %s", v.UnitNumber, v.PlateNumber, v.Model, v.Status, v.YardName))
		}
	}
	return strings.Join(lines, "\n"), nil, nil
}

// GetStudentDetails finds student information including school, grade, special needs, stops and routes
func (s *AIToolService) GetStudentDetails(ctx context.Context, studentQuery string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	if s.studentRepo == nil {
		if isFr {
			return "Le répertoire des élèves n'est pas configuré sur ce serveur.", nil, nil
		}
		return "Student repository is not configured on this server.", nil, nil
	}

	cleanQuery := strings.ToLower(strings.TrimSpace(studentQuery))
	for _, p := range []string{
		"find student", "student info for", "student details for", "about student", "student info",
		"student details", "student", "eleve", "élève", "étudiant", "etudiant", "info élève", "détails élève",
		"details eleve", "which route is student", "查询学生", "学生信息", "学生", "查学生",
	} {
		if strings.HasPrefix(cleanQuery, p) {
			cleanQuery = strings.TrimSpace(strings.TrimPrefix(cleanQuery, p))
		}
	}
	for _, sfx := range []string{" info", " details", " route", " routes", " schedule", " 信息", " 详情"} {
		if strings.HasSuffix(cleanQuery, sfx) {
			cleanQuery = strings.TrimSpace(strings.TrimSuffix(cleanQuery, sfx))
		}
	}
	cleanQuery = strings.Trim(cleanQuery, " ?:!.,;，。？！#")
	if cleanQuery == "" {
		cleanQuery = strings.ToLower(strings.TrimSpace(studentQuery))
	}

	students, err := s.studentRepo.List(ctx, repository.StudentFilter{})
	if err != nil {
		return "", nil, err
	}

	var matches []*models.Student
	for _, stu := range students {
		if strings.EqualFold(stu.StudentNo, cleanQuery) || strings.EqualFold(stu.FullName, cleanQuery) || strings.EqualFold(stu.StudentName, cleanQuery) {
			matches = []*models.Student{stu}
			break
		}
		if strings.Contains(strings.ToLower(stu.StudentNo), cleanQuery) ||
			strings.Contains(strings.ToLower(stu.FullName), cleanQuery) ||
			strings.Contains(strings.ToLower(stu.StudentName), cleanQuery) ||
			strings.Contains(strings.ToLower(stu.FirstName), cleanQuery) ||
			strings.Contains(strings.ToLower(stu.LastName), cleanQuery) {
			matches = append(matches, stu)
		}
	}

	if len(matches) == 0 {
		if isFr {
			return fmt.Sprintf("Aucun élève trouvé pour '%s'. Vous pouvez vérifier l'onglet **Élèves**.", cleanQuery), nil, nil
		}
		return fmt.Sprintf("No student found matching '%s'. You can browse all students on the **Students** page.", cleanQuery), nil, nil
	}

	if len(matches) == 1 {
		stu := matches[0]
		routesStr := stu.Routes
		if routesStr == "" {
			routesStr = "None"
		}
		schoolStr := stu.SchoolName
		if schoolStr == "" {
			schoolStr = "N/A"
		}
		gradeStr := stu.Grade
		if gradeStr == "" {
			gradeStr = "N/A"
		}

		var contactLines []string
		var primContactName, primContactPhone string
		for _, c := range stu.Contacts {
			if c.PrimaryContact || len(contactLines) == 0 {
				primContactName = c.ContactName
				primContactPhone = c.MobilePhone
				if primContactPhone == "" {
					primContactPhone = c.HomePhone
				}
			}
			contactLines = append(contactLines, fmt.Sprintf("- **%s** (%s) : 📞 `%s`", c.ContactName, c.Relationship, c.MobilePhone))
		}

		var stopLines []string
		var firstStopTime, firstStopLocation string
		for _, stp := range stu.Stops {
			if firstStopTime == "" {
				firstStopTime = stp.Time
				firstStopLocation = stp.Location
			}
			stopLines = append(stopLines, fmt.Sprintf("- **%s** (%s) : `%s` à `%s`", stp.Type, stp.Route, stp.Time, stp.Location))
		}

		metatNotice := ""
		if stu.MetatBus {
			if isFr {
				metatNotice = "\n- ⚠️ **MetatBus (Besoins Particuliers)** : Accueil obligatoire par un adulte à la porte du bus !"
			} else {
				metatNotice = "\n- ⚠️ **MetatBus (Special Escort)** : Adult greeting required at the bus door!"
			}
		}

		card := &models.AIActionCard{
			Type:  "student_details",
			Title: fmt.Sprintf("%s (%s)", stu.FullName, stu.StudentNo),
			Data: map[string]interface{}{
				"studentNo":    stu.StudentNo,
				"name":         stu.FullName,
				"school":       schoolStr,
				"grade":        gradeStr,
				"routes":       routesStr,
				"metatBus":     stu.MetatBus,
				"contactName":  primContactName,
				"contactPhone": primContactPhone,
				"stopTime":     firstStopTime,
				"stopLocation": firstStopLocation,
			},
		}

		var reply string
		if isFr {
			reply = fmt.Sprintf(
				"### 🎓 Fiche de l'élève : **%s** (`%s`)\n\n"+
					"- **École** : %s\n"+
					"- **Niveau scolaire (Grade)** : %s\n"+
					"- **Ligne(s) assignée(s)** : `%s`%s\n"+
					"- **Adresse** : %s\n",
				stu.FullName, stu.StudentNo, schoolStr, gradeStr, routesStr, metatNotice, stu.StudentAddress,
			)
			if len(stopLines) > 0 {
				reply += fmt.Sprintf("\n**Arrêts de transport :**\n%s\n", strings.Join(stopLines, "\n"))
			}
			if len(contactLines) > 0 {
				reply += fmt.Sprintf("\n**Contacts d'urgence :**\n%s\n", strings.Join(contactLines, "\n"))
			}
			if stu.StudentDispatchNotes != "" {
				reply += fmt.Sprintf("\n**Notes de régulation** : *%s*\n", stu.StudentDispatchNotes)
			}
		} else {
			reply = fmt.Sprintf(
				"### 🎓 Student Profile: **%s** (`%s`)\n\n"+
					"- **School**: %s\n"+
					"- **Grade**: %s\n"+
					"- **Assigned Route(s)**: `%s`%s\n"+
					"- **Address**: %s\n",
				stu.FullName, stu.StudentNo, schoolStr, gradeStr, routesStr, metatNotice, stu.StudentAddress,
			)
			if len(stopLines) > 0 {
				reply += fmt.Sprintf("\n**Transportation Stops:**\n%s\n", strings.Join(stopLines, "\n"))
			}
			if len(contactLines) > 0 {
				reply += fmt.Sprintf("\n**Emergency Contacts:**\n%s\n", strings.Join(contactLines, "\n"))
			}
			if stu.StudentDispatchNotes != "" {
				reply += fmt.Sprintf("\n**Dispatch Notes**: *%s*\n", stu.StudentDispatchNotes)
			}
		}

		return reply, card, nil
	}

	// Multiple matches
	var lines []string
	if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** élèves correspondants :", len(matches))}
		for i, s := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... et %d autres élèves.", len(matches)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`) : École %s · Ligne `%s`", s.FullName, s.StudentNo, s.SchoolName, s.Routes))
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** matching students:", len(matches))}
		for i, s := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... and %d more students.", len(matches)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`): School %s · Route `%s`", s.FullName, s.StudentNo, s.SchoolName, s.Routes))
		}
	}

	return strings.Join(lines, "\n"), nil, nil
}

// GetStudentSummary aggregates overall student transportation statistics
func (s *AIToolService) GetStudentSummary(ctx context.Context, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	if s.studentRepo == nil {
		if isFr {
			return "Le répertoire des élèves n'est pas configuré sur ce serveur.", nil, nil
		}
		return "Student repository is not configured on this server.", nil, nil
	}

	students, err := s.studentRepo.List(ctx, repository.StudentFilter{})
	if err != nil {
		return "", nil, err
	}

	total := len(students)
	active := 0
	metatBus := 0
	schoolMap := make(map[string]int)

	for _, stu := range students {
		if stu.Active {
			active++
		}
		if stu.MetatBus {
			metatBus++
		}
		if stu.SchoolName != "" {
			schoolMap[stu.SchoolName]++
		}
	}

	card := &models.AIActionCard{
		Type:  "student_summary",
		Title: "Student Transportation Overview",
		Data: map[string]interface{}{
			"totalStudents":  total,
			"activeStudents": active,
			"metatBusCount":  metatBus,
			"schoolsCount":   len(schoolMap),
		},
	}

	if isFr {
		return fmt.Sprintf(
			"### 🎓 Synthèse du Transport Scolaire (Élèves)\n\n"+
				"- **Total des élèves enregistrés** : **%d**\n"+
				"- **Élèves actifs transportés** : **%d**\n"+
				"- **⚠️ Élèves avec accueil requis (MetatBus)** : **%d**\n"+
				"- **Nombre d'écoles desservies** : **%d**\n\n"+
				"Vous pouvez consulter la liste complète et les arrêts dans l'onglet **Élèves**.",
			total, active, metatBus, len(schoolMap),
		), card, nil
	}

	return fmt.Sprintf(
		"### 🎓 Student Transportation Summary\n\n"+
			"- **Total Registered Students**: **%d**\n"+
			"- **Active Transported Students**: **%d**\n"+
			"- **⚠️ Special Escort Required (MetatBus)**: **%d**\n"+
			"- **Schools Served**: **%d**\n\n"+
			"You can search individual student route stops and schedules on the **Students** page.",
		total, active, metatBus, len(schoolMap),
	), card, nil
}

// GetRouteDetails searches for route information across master routes and daily dispatch shifts
func (s *AIToolService) GetRouteDetails(ctx context.Context, routeQuery string, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	routes, err := s.routeRepo.ListRoutes(ctx, repository.RouteFilter{})
	if err != nil {
		return "", nil, err
	}

	cleanQuery := strings.ToLower(strings.TrimSpace(routeQuery))
	for _, prefix := range []string{
		"who is driving route", "who is driving", "who is on route", "who drives route",
		"who is assigned to route", "who is assigned to", "route info for", "route details for",
		"about route", "route info", "route details", "find route", "info ligne", "détails ligne",
		"details ligne", "qui conduit la ligne", "qui est sur la ligne", "qui est assigné à la ligne",
		"ligne", "route", "line", "线路详情", "路线详情", "查询线路", "谁开", "谁负责", "谁分配在", "线路", "路线",
	} {
		if strings.HasPrefix(cleanQuery, prefix) {
			cleanQuery = strings.TrimSpace(strings.TrimPrefix(cleanQuery, prefix))
		}
	}
	cleanQuery = strings.Trim(cleanQuery, " ?:!.,;，。？！")
	if cleanQuery == "" {
		cleanQuery = strings.ToLower(strings.TrimSpace(routeQuery))
	}

	var matches []*models.BusRoute
	for _, r := range routes {
		if strings.EqualFold(r.RouteNo, cleanQuery) {
			matches = []*models.BusRoute{r}
			break
		}
		if strings.Contains(strings.ToLower(r.RouteNo), cleanQuery) ||
			strings.Contains(strings.ToLower(r.RouteName), cleanQuery) {
			matches = append(matches, r)
		}
	}

	if len(matches) == 0 {
		if isFr {
			return fmt.Sprintf("Aucune ligne trouvée pour la recherche '%s'. Vous pouvez vérifier l'onglet **Lignes**.", cleanQuery), nil, nil
		}
		return fmt.Sprintf("No route found matching '%s'. You can browse the full list on the **Routes** page.", cleanQuery), nil, nil
	}

	if len(matches) == 1 {
		r := matches[0]
		statusStr := "Active"
		if !r.Active {
			statusStr = "Inactive"
		}
		driverStr := r.DriverName
		if driverStr == "" {
			driverStr = "None (Unassigned)"
		}
		attendantStr := r.AttendantName
		if attendantStr == "" {
			attendantStr = "None"
		}
		unitStr := r.UnitNumber
		if unitStr == "" {
			unitStr = "N/A"
		}

		// Check operational shifts on date
		shifts, _ := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{RouteFilter: r.RouteNo})
		// Check temporary assignment on date
		tempAssignments, _ := s.dispatchRepo.ListTemporaryAssignments(ctx, r.ID, date, "active")

		var shiftLines []string
		if len(shifts) > 0 {
			for _, sh := range shifts {
				curDriver := sh.DriverName
				if curDriver == "" {
					curDriver = "⚠️ Unassigned"
					if isFr {
						curDriver = "⚠️ Vacant"
					}
				}
				checkInStatus := ""
				if sh.IsDriverCheckedIn {
					checkInStatus = " (Checked-in ✓)"
					if isFr {
						checkInStatus = " (Pointé ✓)"
					}
				}
				curUnit := sh.UnitNumber
				if curUnit == "" {
					curUnit = "N/A"
				}
				if isFr {
					shiftLines = append(shiftLines, fmt.Sprintf("- Quart **%s** : Chauffeur **%s**%s · Véhicule `%s` · Premier arrêt : `%s`",
						sh.ShiftType, curDriver, checkInStatus, curUnit, sh.FirstStopTime))
				} else {
					shiftLines = append(shiftLines, fmt.Sprintf("- **%s** Shift: Driver **%s**%s · Unit `%s` · First stop: `%s`",
						sh.ShiftType, curDriver, checkInStatus, curUnit, sh.FirstStopTime))
				}
			}
		}

		var tempNotice string
		if len(tempAssignments) > 0 {
			ta := tempAssignments[0]
			if isFr {
				tempNotice = fmt.Sprintf("\n- 🔄 **Remplacement temporaire actif** : Chauffeur **%s** (remplace **%s**) du %s au %s",
					ta.TemporaryDriverName, ta.OriginalDriverName, ta.StartDate, ta.EndDate)
			} else {
				tempNotice = fmt.Sprintf("\n- 🔄 **Active Temporary Replacement**: Driver **%s** (substituting for **%s**) from %s to %s",
					ta.TemporaryDriverName, ta.OriginalDriverName, ta.StartDate, ta.EndDate)
			}
		}

		card := &models.AIActionCard{
			Type:  "route_details",
			Title: fmt.Sprintf("Route %s (%s)", r.RouteNo, r.RouteName),
			Data: map[string]interface{}{
				"routeNo":         r.RouteNo,
				"routeName":       r.RouteName,
				"yardName":        r.YardName,
				"status":          statusStr,
				"masterDriver":    r.DriverName,
				"masterAttendant": r.AttendantName,
				"masterUnit":      r.UnitNumber,
				"date":            date,
				"shiftsCount":     len(shifts),
			},
		}

		var reply string
		if isFr {
			reply = fmt.Sprintf(
				"### 🚌 Détails de la ligne `%s` (%s)\n\n"+
					"**Configuration de la ligne maîtresse :**\n"+
					"- **Statut** : %s\n"+
					"- **Dépôt (Yard)** : %s\n"+
					"- **Chauffeur attitré (Master)** : **%s**\n"+
					"- **Accompagnateur** : %s\n"+
					"- **Véhicule par défaut** : `%s`%s\n\n"+
					"**Horaires & Quarts pour le %s :**\n%s",
				r.RouteNo, r.RouteName, statusStr, r.YardName, driverStr, attendantStr, unitStr, tempNotice,
				date,
				func() string {
					if len(shiftLines) > 0 {
						return strings.Join(shiftLines, "\n")
					}
					return "- *Aucun quart de régulation initialisé pour cette date.*"
				}(),
			)
		} else {
			reply = fmt.Sprintf(
				"### 🚌 Route Details for `%s` (%s)\n\n"+
					"**Master Route Configuration:**\n"+
					"- **Status**: %s\n"+
					"- **Depot / Yard**: %s\n"+
					"- **Master Driver**: **%s**\n"+
					"- **Attendant**: %s\n"+
					"- **Default Unit**: `%s`%s\n\n"+
					"**Operational Shifts on %s:**\n%s",
				r.RouteNo, r.RouteName, statusStr, r.YardName, driverStr, attendantStr, unitStr, tempNotice,
				date,
				func() string {
					if len(shiftLines) > 0 {
						return strings.Join(shiftLines, "\n")
					}
					return "- *No dispatch shifts generated for this date yet.*"
				}(),
			)
		}

		return reply, card, nil
	}

	// Multiple matches
	var lines []string
	if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** lignes correspondantes :", len(matches))}
		for i, r := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... et %d autres lignes.", len(matches)-6))
				break
			}
			driverInfo := r.DriverName
			if driverInfo == "" {
				driverInfo = "Non assigné"
			}
			lines = append(lines, fmt.Sprintf("- **Ligne `%s`** : %s (Chauffeur: %s · Dépôt: %s)", r.RouteNo, r.RouteName, driverInfo, r.YardName))
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** matching routes:", len(matches))}
		for i, r := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... and %d more routes.", len(matches)-6))
				break
			}
			driverInfo := r.DriverName
			if driverInfo == "" {
				driverInfo = "Unassigned"
			}
			lines = append(lines, fmt.Sprintf("- **Route `%s`**: %s (Driver: %s · Yard: %s)", r.RouteNo, r.RouteName, driverInfo, r.YardName))
		}
	}

	return strings.Join(lines, "\n"), nil, nil
}

// GetRouteSummary provides master route fleet network statistics
func (s *AIToolService) GetRouteSummary(ctx context.Context, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	routes, err := s.routeRepo.ListRoutes(ctx, repository.RouteFilter{})
	if err != nil {
		return "", nil, err
	}

	total := len(routes)
	active := 0
	assignedDriver := 0
	assignedAttendant := 0
	yardCounts := make(map[string]int)

	for _, r := range routes {
		if r.Active {
			active++
		}
		if strings.TrimSpace(r.DriverID) != "" || strings.TrimSpace(r.DriverName) != "" {
			assignedDriver++
		}
		if strings.TrimSpace(r.AttendantID) != "" || strings.TrimSpace(r.AttendantName) != "" {
			assignedAttendant++
		}
		yard := r.YardName
		if yard == "" {
			yard = "Unassigned Yard"
		}
		yardCounts[yard]++
	}

	unassignedDriver := total - assignedDriver

	card := &models.AIActionCard{
		Type:  "route_summary",
		Title: "Route Fleet Summary",
		Data: map[string]interface{}{
			"totalRoutes":        total,
			"activeRoutes":       active,
			"inactiveRoutes":     total - active,
			"assignedDrivers":    assignedDriver,
			"unassignedDrivers":  unassignedDriver,
			"assignedAttendants": assignedAttendant,
		},
	}

	var yardLines []string
	for yard, count := range yardCounts {
		yardLines = append(yardLines, fmt.Sprintf("- **%s** : %d", yard, count))
	}

	var reply string
	if isFr {
		reply = fmt.Sprintf(
			"### 🚌 Synthèse du Réseau des Lignes\n\n"+
				"- **Total des lignes enregistrées** : **%d**\n"+
				"- **Lignes actives** : **%d** (%d inactives)\n"+
				"- **Lignes avec chauffeur attitré** : **%d** (%d sans chauffeur par défaut)\n"+
				"- **Lignes avec accompagnateur** : **%d**\n\n"+
				"#### 📍 Répartition par Dépôt (Yard) :\n%s",
			total, active, total-active, assignedDriver, unassignedDriver, assignedAttendant,
			strings.Join(yardLines, "\n"),
		)
	} else {
		reply = fmt.Sprintf(
			"### 🚌 Master Routes Fleet Summary\n\n"+
				"- **Total Registered Routes**: **%d**\n"+
				"- **Active Routes**: **%d** (%d inactive)\n"+
				"- **Routes with Default Driver**: **%d** (%d unassigned/open)\n"+
				"- **Routes with Attendant**: **%d**\n\n"+
				"#### 📍 Route Distribution by Yard:\n%s",
			total, active, total-active, assignedDriver, unassignedDriver, assignedAttendant,
			strings.Join(yardLines, "\n"),
		)
	}

	return reply, card, nil
}

// GetAssignmentSummary provides daily dispatch shift and coverage overview for target date
func (s *AIToolService) GetAssignmentSummary(ctx context.Context, date string, lang string) (string, *models.AIActionCard, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")

	shifts, err := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{})
	if err != nil {
		return "", nil, err
	}

	tempAssignments, _ := s.dispatchRepo.ListTemporaryAssignments(ctx, "", date, "active")

	totalShifts := len(shifts)
	if totalShifts == 0 {
		if isZh {
			return fmt.Sprintf("⚠️ **在 %s 尚未生成校车调度排班表。**\n\n- 今日暂无已保存的运营班次记录。\n- 您可以直接对我说：*“生成今日调度表”* 自动生成；\n- 也可以在上方的日期选择器中切换至已排班的日期查看。", date), nil, nil
		}
		if isFr {
			return fmt.Sprintf("⚠️ **Aucun quart de régulation n'a encore été créé pour le %s.**\n\nVous pouvez demander : *« Créer la feuille de régulation pour aujourd'hui »*.", date), nil, nil
		}
		return fmt.Sprintf("⚠️ **No dispatch shifts recorded for %s yet.**\n\nYou can say: *“Create dispatch sheet for today”* to initialize routes.", date), nil, nil
	}

	assignedShifts := 0
	unassignedShifts := 0
	checkedInCount := 0
	var unassignedList []string

	for _, sh := range shifts {
		hasDriver := strings.TrimSpace(sh.DriverID) != "" || strings.TrimSpace(sh.DriverName) != ""
		if hasDriver {
			assignedShifts++
			if sh.IsDriverCheckedIn {
				checkedInCount++
			}
		} else {
			unassignedShifts++
			if len(unassignedList) < 5 {
				unassignedList = append(unassignedList, fmt.Sprintf("`%s` (%s)", sh.RouteNo, sh.ShiftType))
			}
		}
	}

	coverageRate := float64(0)
	if totalShifts > 0 {
		coverageRate = float64(assignedShifts) / float64(totalShifts) * 100
	}

	cardTitle := fmt.Sprintf("Assignments for %s", date)
	if isZh {
		cardTitle = fmt.Sprintf("排班派班总览 (%s)", date)
	} else if isFr {
		cardTitle = fmt.Sprintf("Affectations du %s", date)
	}

	card := &models.AIActionCard{
		Type:  "assignment_summary",
		Title: cardTitle,
		Data: map[string]interface{}{
			"date":             date,
			"totalShifts":      totalShifts,
			"assignedShifts":   assignedShifts,
			"unassignedShifts": unassignedShifts,
			"checkedInCount":   checkedInCount,
			"coverageRate":     fmt.Sprintf("%0.1f%%", coverageRate),
			"tempCount":        len(tempAssignments),
		},
	}

	var reply string
	if isZh {
		reply = fmt.Sprintf(
			"### 📋 **%s 校车调度与班次排班总览**\n\n"+
				"- **运营班次总数**：**%d** 个班次\n"+
				"- **班次覆盖率**：**%0.1f%%** (%d 已分配司机，**%d 个空缺/缺少司机**)\n"+
				"- **司机签到出车**：**%d** / %d 人已在岗\n"+
				"- **临时顶班替班**：**%d** 人在岗\n",
			date, totalShifts, coverageRate, assignedShifts, unassignedShifts, checkedInCount, assignedShifts, len(tempAssignments),
		)
		if len(unassignedList) > 0 {
			reply += fmt.Sprintf("\n⚠️ **部分空缺班次示例**：%s\n*您可以直接对我说：“把 [司机姓名] 指派到路线 [路线号]” 填补空缺。*", strings.Join(unassignedList, ", "))
		}
	} else if isFr {
		reply = fmt.Sprintf(
			"### 📋 État des Affectations & Quarts pour le %s\n\n"+
				"- **Total des quarts opérationnels** : **%d**\n"+
				"- **Taux de couverture** : **%0.1f%%** (%d assignés, **%d vacants**)\n"+
				"- **Chauffeurs pointés (Checked-In)** : **%d** / %d\n"+
				"- **Remplacements temporaires (Substitutes)** : **%d** actif(s)\n",
			date, totalShifts, coverageRate, assignedShifts, unassignedShifts, checkedInCount, assignedShifts, len(tempAssignments),
		)
		if len(unassignedList) > 0 {
			reply += fmt.Sprintf("\n⚠️ **Exemples de quarts vacants** : %s\n*Vous pouvez dire : « Assigner [Chauffeur] sur la ligne [Ligne] ».*", strings.Join(unassignedList, ", "))
		}
	} else {
		reply = fmt.Sprintf(
			"### 📋 Dispatch Shift & Assignment Overview for %s\n\n"+
				"- **Total Operational Shifts**: **%d**\n"+
				"- **Coverage Rate**: **%0.1f%%** (%d covered, **%d vacant/open**)\n"+
				"- **Driver Check-Ins**: **%d** / %d on duty\n"+
				"- **Active Temporary Replacements**: **%d**\n",
			date, totalShifts, coverageRate, assignedShifts, unassignedShifts, checkedInCount, assignedShifts, len(tempAssignments),
		)
		if len(unassignedList) > 0 {
			reply += fmt.Sprintf("\n⚠️ **Sample Open Shifts**: %s\n*You can say: “Assign [Driver] to route [Route]” to fill a vacancy.*", strings.Join(unassignedList, ", "))
		}
	}

	return reply, card, nil
}

// GetTemporaryAssignmentsSummary lists active temporary driver/attendant replacements for target date
func (s *AIToolService) GetTemporaryAssignmentsSummary(ctx context.Context, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	tempList, err := s.dispatchRepo.ListTemporaryAssignments(ctx, "", date, "active")
	if err != nil {
		return "", nil, err
	}

	if len(tempList) == 0 {
		if isFr {
			return fmt.Sprintf("✅ **Aucune affectation temporaire active** pour le %s.\nTous les chauffeurs réguliers sont affectés à leurs lignes habituelles.", date), nil, nil
		}
		return fmt.Sprintf("✅ **No active temporary assignments** for %s.\nAll regular master drivers are operating their standard routes.", date), nil, nil
	}

	var lines []string
	if isFr {
		lines = []string{fmt.Sprintf("### 🔄 Affectations temporaires actives pour le %s (%d) :\n", date, len(tempList))}
		for i, ta := range tempList {
			subDriver := ta.TemporaryDriverName
			if subDriver == "" {
				subDriver = "N/A"
			}
			origDriver := ta.OriginalDriverName
			if origDriver == "" {
				origDriver = "Chauffeur titulaire"
			}
			lines = append(lines, fmt.Sprintf("%d. Ligne `%s` (%s) : **%s** remplace **%s** (du %s au %s)",
				i+1, ta.RouteNo, ta.ShiftType, subDriver, origDriver, ta.StartDate, ta.EndDate))
		}
	} else {
		lines = []string{fmt.Sprintf("### 🔄 Active Temporary Assignments for %s (%d):\n", date, len(tempList))}
		for i, ta := range tempList {
			subDriver := ta.TemporaryDriverName
			if subDriver == "" {
				subDriver = "N/A"
			}
			origDriver := ta.OriginalDriverName
			if origDriver == "" {
				origDriver = "Regular Driver"
			}
			lines = append(lines, fmt.Sprintf("%d. Route `%s` (%s): **%s** substituting for **%s** (%s to %s)",
				i+1, ta.RouteNo, ta.ShiftType, subDriver, origDriver, ta.StartDate, ta.EndDate))
		}
	}

	return strings.Join(lines, "\n"), nil, nil
}

// GetEmployeeDetails searches for staff or driver by name or employee number
func (s *AIToolService) GetEmployeeDetails(ctx context.Context, empQuery string, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	cleanQuery := strings.ToLower(strings.TrimSpace(empQuery))
	for _, p := range []string{
		"employee info for", "driver info for", "about employee", "about driver", "employee info",
		"driver info", "employee", "driver", "chauffeur", "employé", "employe", "info chauffeur",
		"détails chauffeur", "details chauffeur", "contact for", "contact driver", "contact employee", "phone for",
		"查询员工", "员工信息", "查询司机", "司机信息", "员工", "司机", "查司机", "查员工",
	} {
		if strings.HasPrefix(cleanQuery, p) {
			cleanQuery = strings.TrimSpace(strings.TrimPrefix(cleanQuery, p))
		}
	}
	for _, sfx := range []string{" info", " details", " schedule", " contact", " shifts", " 信息", " 详情"} {
		if strings.HasSuffix(cleanQuery, sfx) {
			cleanQuery = strings.TrimSpace(strings.TrimSuffix(cleanQuery, sfx))
		}
	}
	cleanQuery = strings.Trim(cleanQuery, " ?:!.,;，。？！#")
	if cleanQuery == "" {
		cleanQuery = strings.ToLower(strings.TrimSpace(empQuery))
	}

	employees, err := s.employeeRepo.List(ctx, repository.EmployeeFilter{})
	if err != nil {
		return "", nil, err
	}

	var matches []*models.Employee
	for _, e := range employees {
		if strings.EqualFold(e.EmployeeNumber, cleanQuery) || strings.EqualFold(e.FullName, cleanQuery) {
			matches = []*models.Employee{e}
			break
		}
		if strings.Contains(strings.ToLower(e.EmployeeNumber), cleanQuery) ||
			strings.Contains(strings.ToLower(e.FullName), cleanQuery) ||
			strings.Contains(strings.ToLower(e.FirstName), cleanQuery) ||
			strings.Contains(strings.ToLower(e.LastName), cleanQuery) {
			matches = append(matches, e)
		}
	}

	if len(matches) == 0 {
		if isFr {
			return fmt.Sprintf("Aucun employé ou chauffeur trouvé pour '%s'. Vous pouvez consulter la page **Employés**.", cleanQuery), nil, nil
		}
		return fmt.Sprintf("No employee or driver found matching '%s'. You can check the **Staff Directory**.", cleanQuery), nil, nil
	}

	if len(matches) == 1 {
		emp := matches[0]
		statusStr := "Active"
		if !emp.IsActive {
			statusStr = "Inactive"
		}
		phoneStr := emp.MobilePhone
		if phoneStr == "" {
			phoneStr = emp.HomePhone
		}
		if phoneStr == "" {
			phoneStr = "N/A"
		}
		emailStr := emp.PersonalEmail
		if emailStr == "" {
			emailStr = emp.WorkEmail
		}
		if emailStr == "" {
			emailStr = "N/A"
		}

		// License info
		licenseClass := "N/A"
		licenseExpiry := "N/A"
		var licenseWarning string
		if emp.DriverLicense != nil && !emp.DriverLicense.ExpirationDate.IsZero() {
			licenseClass = emp.DriverLicense.LicenseClass
			licenseExpiry = emp.DriverLicense.ExpirationDate.Format("2006-01-02")
			if emp.DriverLicense.ExpirationDate.Before(time.Now().AddDate(0, 0, 30)) {
				if isFr {
					licenseWarning = "\n- ⚠️ **Alerte Permis** : Le permis expire bientôt ou est expiré !"
				} else {
					licenseWarning = "\n- ⚠️ **License Alert**: Driver license expiring soon or expired!"
				}
			}
		}

		// Check today's shifts on date
		var shiftLines []string
		if s.dispatchRepo != nil && date != "" {
			shifts, _ := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{DriverFilter: emp.FullName})
			for _, sh := range shifts {
				chk := ""
				if sh.IsDriverCheckedIn {
					chk = " (Checked-in ✓)"
					if isFr {
						chk = " (Pointé ✓)"
					}
				}
				if isFr {
					shiftLines = append(shiftLines, fmt.Sprintf("- Quart **%s** : Ligne `%s` · Véhicule `%s`%s", sh.ShiftType, sh.RouteNo, sh.UnitNumber, chk))
				} else {
					shiftLines = append(shiftLines, fmt.Sprintf("- **%s** Shift: Route `%s` · Unit `%s`%s", sh.ShiftType, sh.RouteNo, sh.UnitNumber, chk))
				}
			}
		}

		card := &models.AIActionCard{
			Type:  "employee_details",
			Title: fmt.Sprintf("%s (%s)", emp.FullName, emp.JobPosition),
			Data: map[string]interface{}{
				"employeeNumber": emp.EmployeeNumber,
				"fullName":       emp.FullName,
				"jobPosition":    emp.JobPosition,
				"phone":          phoneStr,
				"email":          emailStr,
				"licenseClass":   licenseClass,
				"licenseExpiry":  licenseExpiry,
				"status":         statusStr,
				"shiftsCount":    len(shiftLines),
			},
		}

		var reply string
		if isFr {
			reply = fmt.Sprintf(
				"### 👤 Fiche de l'employé : **%s**\n\n"+
					"- **Matricule** : `%s`\n"+
					"- **Poste** : **%s**\n"+
					"- **Statut** : %s\n"+
					"- **Téléphone** : 📞 `%s`\n"+
					"- **Courriel** : ✉️ `%s`\n"+
					"- **Permis de conduire** : Classe `%s` (Expiration : `%s`)%s\n",
				emp.FullName, emp.EmployeeNumber, emp.JobPosition, statusStr, phoneStr, emailStr, licenseClass, licenseExpiry, licenseWarning,
			)
			if len(shiftLines) > 0 {
				reply += fmt.Sprintf("\n**Quarts assignés pour le %s :**\n%s", date, strings.Join(shiftLines, "\n"))
			}
		} else {
			reply = fmt.Sprintf(
				"### 👤 Employee Profile: **%s**\n\n"+
					"- **Employee #**: `%s`\n"+
					"- **Position**: **%s**\n"+
					"- **Status**: %s\n"+
					"- **Phone**: 📞 `%s`\n"+
					"- **Email**: ✉️ `%s`\n"+
					"- **Driver License**: Class `%s` (Expires: `%s`)%s\n",
				emp.FullName, emp.EmployeeNumber, emp.JobPosition, statusStr, phoneStr, emailStr, licenseClass, licenseExpiry, licenseWarning,
			)
			if len(shiftLines) > 0 {
				reply += fmt.Sprintf("\n**Assigned Shifts on %s:**\n%s", date, strings.Join(shiftLines, "\n"))
			}
		}

		return reply, card, nil
	}

	// Multiple matches
	var lines []string
	if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** employés correspondants :", len(matches))}
		for i, e := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... et %d autres employés.", len(matches)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`) : Poste %s · Téléphone : %s", e.FullName, e.EmployeeNumber, e.JobPosition, e.MobilePhone))
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** matching employees:", len(matches))}
		for i, e := range matches {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... and %d more employees.", len(matches)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`): %s · Phone: %s", e.FullName, e.EmployeeNumber, e.JobPosition, e.MobilePhone))
		}
	}

	return strings.Join(lines, "\n"), nil, nil
}

// GetHRSummary generates human resources, driver count and license compliance overview
func (s *AIToolService) GetHRSummary(ctx context.Context, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	employees, err := s.employeeRepo.List(ctx, repository.EmployeeFilter{})
	if err != nil {
		return "", nil, err
	}

	total := len(employees)
	active := 0
	drivers := 0
	attendants := 0
	others := 0
	licenseDueCount := 0

	now := time.Now()
	dueThreshold := now.AddDate(0, 0, 30) // expiring within 30 days or already expired

	for _, emp := range employees {
		if emp.IsActive {
			active++
		}
		pos := strings.ToLower(emp.JobPosition)
		if strings.Contains(pos, "driver") || strings.Contains(pos, "chauffeur") {
			drivers++
		} else if strings.Contains(pos, "attendant") || strings.Contains(pos, "monitor") || strings.Contains(pos, "accompagnateur") {
			attendants++
		} else {
			others++
		}

		if emp.DriverLicense != nil && !emp.DriverLicense.ExpirationDate.IsZero() && emp.DriverLicense.ExpirationDate.Before(dueThreshold) {
			licenseDueCount++
		}
	}

	card := &models.AIActionCard{
		Type:  "employee_summary",
		Title: "Staff & Driver Overview",
		Data: map[string]interface{}{
			"totalEmployees":   total,
			"activeEmployees":  active,
			"driverCount":      drivers,
			"attendantCount":   attendants,
			"expiringLicenses": licenseDueCount,
		},
	}

	if isFr {
		return fmt.Sprintf(
			"### 👥 Résumé des Ressources Humaines (RH)\n\n"+
				"- **Total des employés enregistrés** : **%d**\n"+
				"- **Employés actifs** : **%d**\n"+
				"- **Chauffeurs de bus** : **%d**\n"+
				"- **Accompagnateurs / Aides** : **%d**\n"+
				"- **Autre personnel** : **%d**\n"+
				"- **⚠️ Permis de conduire à renouveler (< 30 jours)** : **%d**\n\n"+
				"Vous pouvez consulter l'annuaire complet et gérer les fiches dans l'onglet **Employés**.",
			total, active, drivers, attendants, others, licenseDueCount,
		), card, nil
	}

	return fmt.Sprintf(
		"### 👥 Human Resources (HR) & Staff Summary\n\n"+
			"- **Total Registered Employees**: **%d**\n"+
			"- **Active Staff**: **%d**\n"+
			"- **Bus Drivers**: **%d**\n"+
			"- **Bus Monitors / Attendants**: **%d**\n"+
			"- **Support & Office Staff**: **%d**\n"+
			"- **⚠️ CDL Licenses Expiring (< 30 days)**: **%d**\n\n"+
			"You can inspect full personnel records and credentials in the **Staff Directory**.",
		total, active, drivers, attendants, others, licenseDueCount,
	), card, nil
}

// GetPayrollSummary generates compensation and rate configuration overview with ActionCard
func (s *AIToolService) GetPayrollSummary(ctx context.Context, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")

	if s.payrollRepo == nil {
		if isZh {
			return "当前服务器未配置薪酬与费率服务模块。", nil, nil
		}
		if isFr {
			return "Le service de paie n'est pas encore configuré sur ce serveur.", nil, nil
		}
		return "Payroll repository is not configured on server.", nil, nil
	}

	rates, err := s.payrollRepo.List(ctx)
	if err != nil {
		return "", nil, err
	}

	totalRates := len(rates)
	customCount := 0
	schoolBoardRatesCount := 0
	tier1Count := 0
	tier2Count := 0
	tier3Count := 0

	for _, r := range rates {
		if r.EmployeeID != nil && (r.RouteID != nil || r.ShiftID != nil) {
			tier1Count++
			customCount++
		} else if r.EmployeeID != nil {
			tier2Count++
			customCount++
		} else if r.RouteID != nil || r.RouteNo != "" {
			tier3Count++
			customCount++
		} else if r.SchoolBoardID > 0 {
			schoolBoardRatesCount++
		}
	}

	cardTitle := "Payroll & Compensation Rates Overview"
	if isZh {
		cardTitle = "薪酬与费率配置总览"
	} else if isFr {
		cardTitle = "Synthèse des grilles de taux et rémunérations"
	}

	card := &models.AIActionCard{
		Type:  "payroll_summary",
		Title: cardTitle,
		Data: map[string]interface{}{
			"totalRates":            totalRates,
			"schoolBoardRatesCount": schoolBoardRatesCount,
			"customCount":           customCount,
			"tier1Count":            tier1Count,
			"tier2Count":            tier2Count,
			"tier3Count":            tier3Count,
		},
	}

	var reply string
	if isZh {
		reply = fmt.Sprintf(
			"### 💰 **薪酬与费率标准总览**\n\n"+
				"- 📊 **已配置生效费率规则**：**%d** 条\n"+
				"- 🏫 **教育局基准费率 (Tier 4)**：**%d** 条标准费率\n"+
				"- ⚡ **自定义特殊费率 (Tier 1-3)**：**%d** 条特定规则\n"+
				"  - *Tier 1（特定路线 + 特定司机）*：%d 条\n"+
				"  - *Tier 2（特定司机通用费率）*：%d 条\n"+
				"  - *Tier 3（特定路线基准费率）*：%d 条\n"+
				"- ⏱️ **EI 工时自动核算**：已根据各班次类型自动同步\n"+
				"- 🔒 **费率优先级裁决系统**：运转正常，严格遵循四级仲裁优先级\n\n"+
				"您可以询问：“OCSB 教育局费率”、“路线 101 的薪酬费率” 或 “调度班次薪酬汇总”。",
			totalRates, schoolBoardRatesCount, customCount, tier1Count, tier2Count, tier3Count,
		)
	} else if isFr {
		reply = fmt.Sprintf(
			"### 💰 **Synthèse du Module Paie & Rémunération**\n\n"+
				"- 📊 **Grilles de taux enregistrées** : **%d** grilles actives\n"+
				"- 🏫 **Barèmes par conseil scolaire (Niveau 4)** : **%d** taux de base\n"+
				"- ⚡ **Dérogations personnalisées (Tiers 1-3)** : **%d** règles spécifiques\n"+
				"  - *Tier 1 (Ligne + Chauffeur spécifique)* : %d\n"+
				"  - *Tier 2 (Chauffeur général)* : %d\n"+
				"  - *Tier 3 (Ligne/Circuit général)* : %d\n"+
				"- ⏱️ **Heures d'assurance-emploi (EI)** : Calculées automatiquement selon les quarts\n"+
				"- 🔒 **Statut du système de paie** : Opérationnel & conforme aux 4 paliers d'arbitrage\n\n"+
				"Vous pouvez demander : *« Taux de paie pour OCSB »*, *« Barème de la ligne 101 »* ou *« Heures de paie du dispatch »*.",
			totalRates, schoolBoardRatesCount, customCount, tier1Count, tier2Count, tier3Count,
		)
	} else {
		reply = fmt.Sprintf(
			"### 💰 **Payroll & Compensation Rates Overview**\n\n"+
				"- 📊 **Configured Rate Rules**: **%d** active rate schedules\n"+
				"- 🏫 **School Board Baseline Rates (Tier 4)**: **%d** standard tiers\n"+
				"- ⚡ **Custom Overrides (Tiers 1-3)**: **%d** specific rules\n"+
				"  - *Tier 1 (Route + Specific Driver)*: %d\n"+
				"  - *Tier 2 (Driver Universal Override)*: %d\n"+
				"  - *Tier 3 (Route General Override)*: %d\n"+
				"- ⏱️ **Insurable EI Hours**: Synchronized dynamically with shift types\n"+
				"- 🔒 **Payroll Resolution Hierarchy**: Active & strictly prioritized\n\n"+
				"You can ask: *“Payroll rates for OCSB”*, *“Rate for route 101”*, or *“Dispatch shift payroll summary”*.",
			totalRates, schoolBoardRatesCount, customCount, tier1Count, tier2Count, tier3Count,
		)
	}

	return reply, card, nil
}

// GetPayrollDetails searches specific rates by board name/code, route, or driver name
func (s *AIToolService) GetPayrollDetails(ctx context.Context, query string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	cleanQuery := strings.TrimSpace(query)
	lowerQuery := strings.ToLower(cleanQuery)

	if s.payrollRepo == nil {
		if isFr {
			return "Le service de paie n'est pas encore configuré.", nil, nil
		}
		return "Payroll repository is not configured.", nil, nil
	}

	rates, err := s.payrollRepo.List(ctx)
	if err != nil {
		return "", nil, err
	}

	// Clean out trigger words
	searchKey := lowerQuery
	removeWords := []string{
		"payroll", "compensation", "rate", "rates", "pay", "salary", "wage",
		"paie", "salaire", "taux", "rémunération", "remuneration", "barème", "bareme",
		"for", "pour", "de", "the", "le", "la", "les", "du", "工资", "薪资", "薪酬", "的", "查询",
	}
	for _, rw := range removeWords {
		searchKey = strings.ReplaceAll(searchKey, rw, "")
	}
	searchKey = strings.TrimSpace(searchKey)

	var matched []*models.BusRoutePayrollRate
	if searchKey != "" {
		for _, r := range rates {
			if strings.Contains(strings.ToLower(r.SchoolBoardCode), searchKey) ||
				strings.Contains(strings.ToLower(r.SchoolBoardName), searchKey) ||
				strings.Contains(strings.ToLower(r.RouteNo), searchKey) ||
				strings.Contains(strings.ToLower(r.RouteName), searchKey) ||
				strings.Contains(strings.ToLower(r.EmployeeName), searchKey) ||
				strings.Contains(strings.ToLower(r.JobTitle), searchKey) ||
				strings.Contains(strings.ToLower(r.ID), searchKey) {
				matched = append(matched, r)
			}
		}
	}

	if len(matched) == 0 {
		// If specific search had no results, fallback to custom overrides
		for _, r := range rates {
			if r.RouteNo != "" || r.EmployeeName != "" {
				matched = append(matched, r)
			}
		}
		if len(matched) == 0 {
			matched = rates
		}
	}

	if len(matched) == 0 {
		var notFoundMsg string
		if isFr {
			notFoundMsg = fmt.Sprintf("⚠️ Aucun barème de paie trouvé pour « **%s** ».", cleanQuery)
		} else {
			notFoundMsg = fmt.Sprintf("⚠️ No payroll rate rules found matching “**%s**”.", cleanQuery)
		}
		return notFoundMsg, nil, nil
	}

	// Single match card
	if len(matched) == 1 {
		r := matched[0]
		payStr := "N/A"
		if r.PayRate != nil {
			payStr = fmt.Sprintf("$%.2f", *r.PayRate)
		}
		eiStr := "N/A"
		if r.EiHours != nil {
			eiStr = fmt.Sprintf("%.2f hrs", *r.EiHours)
		}

		cardTitle := fmt.Sprintf("Rate: %s (%s)", r.ID, r.JobTitle)
		if isFr {
			cardTitle = fmt.Sprintf("Taux : %s (%s)", r.ID, r.JobTitle)
		}

		card := &models.AIActionCard{
			Type:  "payroll_details",
			Title: cardTitle,
			Data: map[string]interface{}{
				"id":              r.ID,
				"schoolBoardName": r.SchoolBoardName,
				"schoolBoardCode": r.SchoolBoardCode,
				"routeNo":         r.RouteNo,
				"routeName":       r.RouteName,
				"employeeName":    r.EmployeeName,
				"jobTitle":        r.JobTitle,
				"shiftType":       r.ShiftType,
				"payRate":         payStr,
				"eiHours":         eiStr,
				"effectiveDate":   r.EffectiveDate,
				"notes":           r.Notes,
			},
		}

		var reply string
		if isFr {
			reply = fmt.Sprintf(
				"### 💰 **Barème de paie : `%s`**\n\n"+
					"- **Conseil scolaire** : %s (`%s`)\n"+
					"- **Poste** : **%s**\n"+
					"- **Quart de travail** : `%s`\n"+
					"- **Taux de rémunération** : 💵 **%s**\n"+
					"- **Heures EI / Insurable** : ⏱️ **%s**\n"+
					"- **Date d'effet** : `%s`\n",
				r.ID, r.SchoolBoardName, r.SchoolBoardCode, strings.ToUpper(r.JobTitle), r.ShiftType, payStr, eiStr, r.EffectiveDate,
			)
			if r.RouteNo != "" {
				reply += fmt.Sprintf("- **Ligne ciblée** : Ligne `%s` (%s)\n", r.RouteNo, r.RouteName)
			}
			if r.EmployeeName != "" {
				reply += fmt.Sprintf("- **Chauffeur spécifique** : 👤 **%s**\n", r.EmployeeName)
			}
			if r.Notes != "" {
				reply += fmt.Sprintf("- **Notes** : *« %s »*\n", r.Notes)
			}
		} else {
			reply = fmt.Sprintf(
				"### 💰 **Payroll Rate Schedule: `%s`**\n\n"+
					"- **School Board**: %s (`%s`)\n"+
					"- **Role**: **%s**\n"+
					"- **Shift**: `%s`\n"+
					"- **Pay Rate**: 💵 **%s**\n"+
					"- **Insurable EI Hours**: ⏱️ **%s**\n"+
					"- **Effective Date**: `%s`\n",
				r.ID, r.SchoolBoardName, r.SchoolBoardCode, strings.ToUpper(r.JobTitle), r.ShiftType, payStr, eiStr, r.EffectiveDate,
			)
			if r.RouteNo != "" {
				reply += fmt.Sprintf("- **Target Route**: Route `%s` (%s)\n", r.RouteNo, r.RouteName)
			}
			if r.EmployeeName != "" {
				reply += fmt.Sprintf("- **Specific Employee**: 👤 **%s**\n", r.EmployeeName)
			}
			if r.Notes != "" {
				reply += fmt.Sprintf("- **Notes**: *“%s”*\n", r.Notes)
			}
		}

		return reply, card, nil
	}

	// Multiple matches list
	items := make([]map[string]interface{}, 0, len(matched))
	var lines []string

	if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** barèmes de taux correspondants :", len(matched))}
		for i, r := range matched {
			if i >= 8 {
				lines = append(lines, fmt.Sprintf("... et %d autres grilles de taux.", len(matched)-8))
				break
			}
			payVal := 0.0
			if r.PayRate != nil {
				payVal = *r.PayRate
			}
			scope := r.SchoolBoardCode
			if r.RouteNo != "" {
				scope = fmt.Sprintf("Ligne %s", r.RouteNo)
			}
			if r.EmployeeName != "" {
				scope = fmt.Sprintf("%s · %s", scope, r.EmployeeName)
			}
			lines = append(lines, fmt.Sprintf("- **%s** (%s · `%s`) : **$%.2f**",
				r.ID, scope, r.JobTitle, payVal))

			items = append(items, map[string]interface{}{
				"id":              r.ID,
				"schoolBoardCode": r.SchoolBoardCode,
				"routeNo":         r.RouteNo,
				"employeeName":    r.EmployeeName,
				"jobTitle":        r.JobTitle,
				"shiftType":       r.ShiftType,
				"payRate":         fmt.Sprintf("$%.2f", payVal),
			})
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** matching payroll rate schedules:", len(matched))}
		for i, r := range matched {
			if i >= 8 {
				lines = append(lines, fmt.Sprintf("... and %d more rate schedules.", len(matched)-8))
				break
			}
			payVal := 0.0
			if r.PayRate != nil {
				payVal = *r.PayRate
			}
			scope := r.SchoolBoardCode
			if r.RouteNo != "" {
				scope = fmt.Sprintf("Route %s", r.RouteNo)
			}
			if r.EmployeeName != "" {
				scope = fmt.Sprintf("%s · %s", scope, r.EmployeeName)
			}
			lines = append(lines, fmt.Sprintf("- **%s** (%s · `%s`): **$%.2f**",
				r.ID, scope, r.JobTitle, payVal))

			items = append(items, map[string]interface{}{
				"id":              r.ID,
				"schoolBoardCode": r.SchoolBoardCode,
				"routeNo":         r.RouteNo,
				"employeeName":    r.EmployeeName,
				"jobTitle":        r.JobTitle,
				"shiftType":       r.ShiftType,
				"payRate":         fmt.Sprintf("$%.2f", payVal),
			})
		}
	}

	card := &models.AIActionCard{
		Type:  "payroll_details",
		Title: fmt.Sprintf("Payroll Rates (%d)", len(matched)),
		Data: map[string]interface{}{
			"count": len(matched),
			"items": items,
		},
	}

	return strings.Join(lines, "\n"), card, nil
}

// GetDispatchPayrollSummary generates daily labor cost liability and crew check-out payroll summary
func (s *AIToolService) GetDispatchPayrollSummary(ctx context.Context, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	payrolls, err := s.dispatchRepo.ListDispatchPayrolls(ctx, date)
	if err != nil {
		return "", nil, err
	}

	totalRecords := len(payrolls)
	pendingCheckoutCount := 0
	pendingApprovalCount := 0
	approvedCount := 0
	totalLiability := 0.0
	totalEiHours := 0.0

	for _, p := range payrolls {
		totalLiability += p.PayRate
		totalEiHours += p.EiHours

		switch strings.ToLower(p.Status) {
		case "pending_checkout":
			pendingCheckoutCount++
		case "pending_approval":
			pendingApprovalCount++
		case "approved":
			approvedCount++
		}
	}

	cardTitle := fmt.Sprintf("Daily Dispatch Payroll (%s)", date)
	if isFr {
		cardTitle = fmt.Sprintf("Paie du dispatch pour le %s", date)
	}

	card := &models.AIActionCard{
		Type:  "dispatch_payroll_summary",
		Title: cardTitle,
		Data: map[string]interface{}{
			"date":                 date,
			"totalRecords":         totalRecords,
			"pendingCheckoutCount": pendingCheckoutCount,
			"pendingApprovalCount": pendingApprovalCount,
			"approvedCount":        approvedCount,
			"totalLiability":       totalLiability,
			"totalEiHours":         totalEiHours,
		},
	}

	var reply string
	if isFr {
		reply = fmt.Sprintf(
			"### 💼 **Suivi de la paie du dispatch (%s)**\n\n"+
				"- 👥 **Quarts avec paie générée** : **%d** quarts de travail\n"+
				"- 💵 **Passif salarial estimé (Labor Liability)** : **$%.2f**\n"+
				"- ⏱️ **Total heures d'assurance-emploi (EI)** : **%.2f hrs**\n"+
				"- ⏳ **En attente de pointage de sortie (Pending Checkout)** : **%d**\n"+
				"- 📝 **En attente de validation régulateur (Pending Approval)** : **%d**\n"+
				"- ✅ **Validés et synchronisés Finance/Paie** : **%d**\n\n",
			date, totalRecords, totalLiability, totalEiHours, pendingCheckoutCount, pendingApprovalCount, approvedCount,
		)
		if pendingApprovalCount > 0 {
			reply += fmt.Sprintf("⚠️ Il reste **%d** quart(s) nécessitant une approbation du régulateur avant transmission à la comptabilité.", pendingApprovalCount)
		} else {
			reply += "🎉 Tout le pointage des quarts et les enregistrements de paie pour cette date sont à jour."
		}
	} else {
		reply = fmt.Sprintf(
			"### 💼 **Dispatch Shift Payroll Overview (%s)**\n\n"+
				"- 👥 **Shifts with Generated Payroll**: **%d** shift records\n"+
				"- 💵 **Estimated Labor Liability**: **$%.2f**\n"+
				"- ⏱️ **Total Insurable EI Hours**: **%.2f hrs**\n"+
				"- ⏳ **Awaiting Crew Check-out**: **%d**\n"+
				"- 📝 **Awaiting Dispatcher Approval**: **%d**\n"+
				"- ✅ **Approved & Synced to Finance**: **%d**\n\n",
			date, totalRecords, totalLiability, totalEiHours, pendingCheckoutCount, pendingApprovalCount, approvedCount,
		)
		if pendingApprovalCount > 0 {
			reply += fmt.Sprintf("⚠️ There are **%d** record(s) awaiting dispatcher approval before final finance export.", pendingApprovalCount)
		} else {
			reply += "🎉 All crew check-ins and payroll shift records for this date are up to date."
		}
	}

	return reply, card, nil
}

// GetDispatchCreatorInfo queries dispatch_change_logs and shifts to determine who created/generated dispatch on target date
func (s *AIToolService) GetDispatchCreatorInfo(ctx context.Context, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")

	// 1. Fetch change logs for target date
	logs, err := s.dispatchRepo.ListChangeLogs(ctx, date)
	if err != nil {
		logs = nil
	}

	// 2. Fetch current shifts to get current state
	shifts, _ := s.dispatchRepo.ListShifts(ctx, date, repository.DispatchFilter{})
	totalShifts := len(shifts)
	assignedShifts := 0
	for _, sh := range shifts {
		if strings.TrimSpace(sh.DriverID) != "" || strings.TrimSpace(sh.DriverName) != "" {
			assignedShifts++
		}
	}
	openShifts := totalShifts - assignedShifts

	// 3. Find day generation logs
	var genLogs []*models.DispatchChangeLog
	for _, l := range logs {
		t := strings.ToLower(l.Type)
		if t == "day generated" || strings.Contains(t, "generated") || strings.Contains(t, "day create") {
			genLogs = append(genLogs, l)
		}
	}

	// Case 1: Found generation log(s)
	if len(genLogs) > 0 {
		latestLog := genLogs[0]
		initialLog := genLogs[len(genLogs)-1]

		creator := initialLog.User
		if creator == "" {
			creator = "System Dispatcher"
		}
		createdTime := initialLog.Time
		if initialLog.Timestamp > 0 {
			createdTime = repository.FormatDispatchLogTime(time.UnixMilli(initialLog.Timestamp).Local())
		} else if createdTime == "" && initialLog.CreatedAt != nil {
			createdTime = fmt.Sprintf("%v", initialLog.CreatedAt)
		}

		latestTime := latestLog.Time
		if latestLog.Timestamp > 0 {
			latestTime = repository.FormatDispatchLogTime(time.UnixMilli(latestLog.Timestamp).Local())
		}

		cardTitle := fmt.Sprintf("Dispatch Created by %s", creator)
		if isZh {
			cardTitle = fmt.Sprintf("调度创建人：%s", creator)
		} else if isFr {
			cardTitle = fmt.Sprintf("Feuille créée par %s", creator)
		}

		isCold := false
		if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
			isCold = parsedDate.Before(time.Now().AddDate(0, 0, -60))
		}

		storageSource := "Firebase Firestore (Live Operational Data)"
		if isCold {
			storageSource = "Google Cloud BigQuery (Cold Storage Archive > 60 days)"
		}

		card := &models.AIActionCard{
			Type:  "creator_info",
			Title: cardTitle,
			Data: map[string]interface{}{
				"date":           date,
				"creator":        creator,
				"createdTime":    createdTime,
				"detail":         initialLog.Detail,
				"totalShifts":    totalShifts,
				"assignedShifts": assignedShifts,
				"openShifts":     openShifts,
				"latestModifier": latestLog.User,
				"latestTime":     latestTime,
				"storageSource":  storageSource,
				"isColdArchive":  isCold,
			},
		}

		var reply string
		if isZh {
			reply = fmt.Sprintf(
				"### 📋 **%s 调度表创建与生成信息**\n\n"+
					"- 👤 **初始创建人**：**%s**\n"+
					"- 🕒 **创建时间**：`%s`\n"+
					"- 📝 **生成详情**：%s\n"+
					"- 🚌 **当前班次状态**：共 **%d** 个班次 (**%d** 个已分配，**%d** 个空缺未排)\n\n"+
					"该操作已记录在调度审计日志 (`dispatch_change_logs`) 中。",
				date, creator, createdTime, initialLog.Detail, totalShifts, assignedShifts, openShifts,
			)
			if len(genLogs) > 1 && latestLog.User != initialLog.User {
				reply += fmt.Sprintf("\n\n*注：该日期后续曾由 **%s** 在 `%s` 重新生成同步。*", latestLog.User, latestTime)
			}
		} else if isFr {
			reply = fmt.Sprintf(
				"### 📋 Informations de création du dispatch pour le %s\n\n"+
					"- 👤 **Créateur initial** : **%s**\n"+
					"- 🕒 **Heure de création** : `%s`\n"+
					"- 📝 **Détails de génération** : %s\n"+
					"- 🚌 **État actuel des quarts** : **%d** quarts au total (**%d** assignés, **%d** vacants)\n\n"+
					"Cette opération est consignée dans le journal d'audit de régulation (`dispatch_change_logs`).",
				date, creator, createdTime, initialLog.Detail, totalShifts, assignedShifts, openShifts,
			)
			if len(genLogs) > 1 && latestLog.User != initialLog.User {
				reply += fmt.Sprintf("\n\n*Note : La journée a également été régénérée par **%s** à `%s`.*", latestLog.User, latestTime)
			}
			if isCold {
				reply += "\n\n🧊 *Données historiques récupérées automatiquement depuis l'archive froide Google Cloud BigQuery (> 60 jours).* "
			}
		} else {
			reply = fmt.Sprintf(
				"### 📋 Dispatch Sheet Creation Details for %s\n\n"+
					"- 👤 **Created By**: **%s**\n"+
					"- 🕒 **Created At**: `%s`\n"+
					"- 📝 **Generation Details**: %s\n"+
					"- 🚌 **Current Shifts**: **%d** total shifts (**%d** assigned, **%d** open)\n\n"+
					"This action is recorded in the Dispatch Audit Log (`dispatch_change_logs`).",
				date, creator, createdTime, initialLog.Detail, totalShifts, assignedShifts, openShifts,
			)
			if len(genLogs) > 1 && latestLog.User != initialLog.User {
				reply += fmt.Sprintf("\n\n*Note: The day was also regenerated by **%s** at `%s`.*", latestLog.User, latestTime)
			}
			if isCold {
				reply += "\n\n🧊 *Historical archive retrieved automatically from Google Cloud BigQuery cold storage (> 60 days).* "
			}
		}

		return reply, card, nil
	}

	// Case 2: No "Day Generated" log, but shifts exist
	if totalShifts > 0 {
		earliestUser := "System (Pre-loaded / Template)"
		if len(logs) > 0 {
			earliestUser = logs[len(logs)-1].User
		}

		cardTitle := "Active Dispatch Sheet Found"
		if isZh {
			cardTitle = "已找到有效调度表"
		} else if isFr {
			cardTitle = "Feuille de régulation active trouvée"
		}

		isCold := false
		if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
			isCold = parsedDate.Before(time.Now().AddDate(0, 0, -60))
		}

		storageSource := "Firebase Firestore (Live Operational Data)"
		if isCold {
			storageSource = "Google Cloud BigQuery (Cold Storage Archive > 60 days)"
		}

		card := &models.AIActionCard{
			Type:  "creator_info",
			Title: cardTitle,
			Data: map[string]interface{}{
				"date":           date,
				"creator":        earliestUser,
				"totalShifts":    totalShifts,
				"assignedShifts": assignedShifts,
				"openShifts":     openShifts,
				"storageSource":  storageSource,
				"isColdArchive":  isCold,
			},
		}

		var reply string
		if isZh {
			reply = fmt.Sprintf(
				"### 📋 **%s 调度表排班状态**\n\n"+
					"- 🚌 **有效班次**：共 **%d** 个班次 (**%d** 个已分配司机，**%d** 个未分配)\n"+
					"- ℹ️ **说明**：日志中未找到显式由调度员手动点击“生成调度表”的记录，班次可能已由预设排班模板或定时任务自动加载。\n"+
					"- 👤 **最早记录操作人**：%s\n\n"+
					"您可以在调度变更审计日志中查看所有历史操作记录。",
				date, totalShifts, assignedShifts, openShifts, earliestUser,
			)
		} else if isFr {
			reply = fmt.Sprintf(
				"### 📋 Feuille de régulation pour le %s\n\n"+
					"- 🚌 **Quarts actifs** : **%d** quarts générés (**%d** assignés, **%d** vacants)\n"+
					"- ℹ️ **Remarque** : Aucun journal explicite *« Day Generated »* n'a été trouvé. Les quarts peuvent avoir été initialisés par synchronisation de modèles ou tâche système.\n"+
					"- 👤 **Dernier intervenant enregistré** : %s\n\n"+
					"Vous pouvez consulter l'historique complet dans le journal des modifications.",
				date, totalShifts, assignedShifts, openShifts, earliestUser,
			)
			if isCold {
				reply += "\n\n🧊 *Données historiques récupérées automatiquement depuis l'archive froide Google Cloud BigQuery (> 60 jours).* "
			}
		} else {
			reply = fmt.Sprintf(
				"### 📋 Dispatch Sheet for %s\n\n"+
					"- 🚌 **Active Shifts**: **%d** shifts loaded (**%d** assigned, **%d** open)\n"+
					"- ℹ️ **Notice**: No explicit *“Day Generated”* log was recorded. The shifts may have been initialized via schedule template sync, database migration, or background job.\n"+
					"- 👤 **Earliest Recorded Modifier**: %s\n\n"+
					"You can review recent modifications in the Dispatch Change Log.",
				date, totalShifts, assignedShifts, openShifts, earliestUser,
			)
			if isCold {
				reply += "\n\n🧊 *Historical archive retrieved automatically from Google Cloud BigQuery cold storage (> 60 days).* "
			}
		}
		return reply, card, nil
	}

	// Case 3: No shifts exist for this date
	var reply string
	if isZh {
		reply = fmt.Sprintf(
			"⚠️ **在 %s 尚未创建校车调度表。**\n\n"+
				"该日期的调度排班目前为空。\n\n"+
				"如果您希望我现在从激活的路线自动生成今日排班，请直接说：\n"+
				"👉 *“生成今日调度表”* 或 *“创建排班”*",
			date,
		)
	} else if isFr {
		reply = fmt.Sprintf(
			"⚠️ **Aucune feuille de régulation n'a encore été créée pour le %s.**\n\n"+
				"Le planning de régulation pour cette date est actuellement vide.\n\n"+
				"Si vous souhaitez que je la génère maintenant à partir des lignes maîtresses actives, dites simplement :\n"+
				"👉 *« Créer la feuille de régulation pour aujourd'hui »*",
			date,
		)
	} else {
		reply = fmt.Sprintf(
			"⚠️ **No dispatch sheet has been created for %s yet.**\n\n"+
				"The dispatch schedule for this date is currently empty.\n\n"+
				"If you would like me to generate it now based on active master routes, simply say:\n"+
				"👉 *“Create dispatch sheet for today”*",
			date,
		)
	}

	return reply, nil, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME OFF REQUESTS (CONGÉS) TOOLS
// ─────────────────────────────────────────────────────────────────────────────

// GetTimeOffSummary retrieves high-level metrics for time off requests
func (s *AIToolService) GetTimeOffSummary(ctx context.Context, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	requests, err := s.dispatchRepo.ListTimeOffRequests(ctx, "", "all", "")
	if err != nil {
		return "", nil, err
	}

	totalCount := len(requests)
	pendingCount := 0
	approvedCount := 0
	rejectedCount := 0
	activeTodayCount := 0

	var pendingList []map[string]interface{}
	var activeTodayList []map[string]interface{}

	for _, req := range requests {
		switch req.Status {
		case models.TimeOffStatusPending:
			pendingCount++
			if len(pendingList) < 5 {
				pendingList = append(pendingList, map[string]interface{}{
					"id":           req.ID,
					"employeeName": req.EmployeeName,
					"leaveType":    string(req.LeaveType),
					"startDate":    req.StartDate,
					"endDate":      req.EndDate,
					"shiftType":    req.ShiftType,
				})
			}
		case models.TimeOffStatusApproved:
			approvedCount++
		case models.TimeOffStatusRejected:
			rejectedCount++
		}

		// Check if active on target date and approved
		if req.Status == models.TimeOffStatusApproved && date != "" {
			if (req.StartDate == "" || date >= req.StartDate) && (req.EndDate == "" || date <= req.EndDate) {
				activeTodayCount++
				if len(activeTodayList) < 5 {
					activeTodayList = append(activeTodayList, map[string]interface{}{
						"id":           req.ID,
						"employeeName": req.EmployeeName,
						"leaveType":    string(req.LeaveType),
						"startDate":    req.StartDate,
						"endDate":      req.EndDate,
						"shiftType":    req.ShiftType,
					})
				}
			}
		}
	}

	cardTitle := "Time Off Requests Summary"
	if isZh {
		cardTitle = "请假与休假申请汇总"
	} else if isFr {
		cardTitle = "Synthèse des demandes de congé"
	}

	card := &models.AIActionCard{
		Type:  "time_off_summary",
		Title: cardTitle,
		Data: map[string]interface{}{
			"date":             date,
			"totalRequests":    totalCount,
			"pendingCount":     pendingCount,
			"approvedCount":    approvedCount,
			"rejectedCount":    rejectedCount,
			"activeTodayCount": activeTodayCount,
			"pendingList":      pendingList,
			"activeTodayList":  activeTodayList,
		},
	}

	var reply string
	if isZh {
		reply = fmt.Sprintf(
			"### 🏖️ **请假与休假申请汇总 (%s)**\n\n"+
				"- ⏳ **待审核审批**：**%d** 条申请\n"+
				"- 🌴 **今日休假在岗缺席 (%s)**：**%d** 人已获批休假\n"+
				"- ✅ **累计已批准**：**%d** 条\n"+
				"- ❌ **已驳回 / 已取消**：**%d** 条\n"+
				"- 📋 **总申请记录数**：**%d** 条\n\n",
			date, pendingCount, date, activeTodayCount, approvedCount, rejectedCount, totalCount,
		)
		if pendingCount > 0 {
			reply += fmt.Sprintf("⚠️ 当前有 **%d** 条请假申请需要人事或主管审核，您可查阅请假管理页面进行批复。", pendingCount)
		} else {
			reply += "🎉 当前所有提交的请假申请均已处理完毕，暂无待审事项。"
		}
	} else if isFr {
		reply = fmt.Sprintf(
			"### 🏖️ **Synthèse des demandes de congé (%s)**\n\n"+
				"- ⏳ **En attente d'approbation** : **%d** demande(s)\n"+
				"- 🌴 **En congé aujourd'hui (%s)** : **%d** employé(s) approuvé(s)\n"+
				"- ✅ **Total approuvées** : **%d**\n"+
				"- ❌ **Rejetées / Annulées** : **%d**\n"+
				"- 📋 **Volume global enregistré** : **%d** demande(s)\n\n",
			date, pendingCount, date, activeTodayCount, approvedCount, rejectedCount, totalCount,
		)
		if pendingCount > 0 {
			reply += fmt.Sprintf("⚠️ Il y a **%d** demande(s) nécessitant une validation par les RH ou la direction. Vous pouvez demander : *« Voir les congés en attente »* pour les examiner.", pendingCount)
		} else {
			reply += "🎉 Toutes les demandes de congé soumises ont été traitées. Aucune demande en attente."
		}
	} else {
		reply = fmt.Sprintf(
			"### 🏖️ **Time Off Requests Overview (%s)**\n\n"+
				"- ⏳ **Pending Review** : **%d** request(s)\n"+
				"- 🌴 **On Leave Today (%s)** : **%d** employee(s) approved\n"+
				"- ✅ **Total Approved** : **%d**\n"+
				"- ❌ **Rejected / Cancelled** : **%d**\n"+
				"- 📋 **Total Recorded Volume** : **%d** request(s)\n\n",
			date, pendingCount, date, activeTodayCount, approvedCount, rejectedCount, totalCount,
		)
		if pendingCount > 0 {
			reply += fmt.Sprintf("⚠️ There are **%d** request(s) awaiting review by HR or management. Say: *“Show pending time off requests”* to inspect them.", pendingCount)
		} else {
			reply += "🎉 All submitted leave requests are processed. No pending requests."
		}
	}

	return reply, card, nil
}

// GetTimeOffDetails searches or lists specific time off requests (e.g. pending requests or by employee name)
func (s *AIToolService) GetTimeOffDetails(ctx context.Context, query string, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	cleanQuery := strings.TrimSpace(query)
	lowerQuery := strings.ToLower(cleanQuery)

	requests, err := s.dispatchRepo.ListTimeOffRequests(ctx, "", "all", "")
	if err != nil {
		return "", nil, err
	}

	// Filter based on query:
	// If query asks for "pending" / "en attente", filter by pending
	isPendingFilter := strings.Contains(lowerQuery, "pending") || strings.Contains(lowerQuery, "en attente") || strings.Contains(lowerQuery, "待审批") || strings.Contains(lowerQuery, "待审核")
	// If query asks for "today" / "aujourd'hui" / "who is off", filter by active today
	isTodayFilter := strings.Contains(lowerQuery, "who is off") || strings.Contains(lowerQuery, "who is on leave") || strings.Contains(lowerQuery, "qui est en congé") || strings.Contains(lowerQuery, "谁休假") || strings.Contains(lowerQuery, "谁请假")

	var matched []*models.TimeOffRequest

	if isPendingFilter {
		for _, req := range requests {
			if req.Status == models.TimeOffStatusPending {
				matched = append(matched, req)
			}
		}
	} else if isTodayFilter {
		targetDate := date
		if targetDate == "" {
			targetDate = time.Now().Format("2006-01-02")
		}
		for _, req := range requests {
			if req.Status == models.TimeOffStatusApproved {
				if (req.StartDate == "" || targetDate >= req.StartDate) && (req.EndDate == "" || targetDate <= req.EndDate) {
					matched = append(matched, req)
				}
			}
		}
	} else {
		// Try matching employee name or ID
		// Strip common trigger words
		searchKey := cleanQuery
		removeWords := []string{
			"time off", "time-off", "leave", "request", "requests", "vacation", "sick leave",
			"congé", "conge", "demande", "demandes", "statut", "status", "for", "pour", "de",
			"请假", "休假", "查询", "的",
		}
		for _, rw := range removeWords {
			searchKey = strings.ReplaceAll(strings.ToLower(searchKey), rw, "")
		}
		searchKey = strings.TrimSpace(searchKey)

		if searchKey != "" {
			for _, req := range requests {
				if strings.Contains(strings.ToLower(req.EmployeeName), searchKey) ||
					strings.Contains(strings.ToLower(req.EmployeeID), searchKey) ||
					strings.Contains(strings.ToLower(req.EmployeeNumber), searchKey) ||
					strings.Contains(strings.ToLower(req.ID), searchKey) {
					matched = append(matched, req)
				}
			}
		}

		if len(matched) == 0 {
			// Fallback: show pending or all recent
			for _, req := range requests {
				if req.Status == models.TimeOffStatusPending {
					matched = append(matched, req)
				}
			}
			if len(matched) == 0 && len(requests) > 0 {
				matched = requests
			}
		}
	}

	if len(matched) == 0 {
		var notFoundMsg string
		if isPendingFilter {
			if isFr {
				notFoundMsg = "✅ **Aucune demande de congé en attente.** Toutes les demandes sont déjà traitées."
			} else {
				notFoundMsg = "✅ **No pending time off requests.** All requests have already been processed."
			}
		} else if isTodayFilter {
			if isFr {
				notFoundMsg = fmt.Sprintf("✅ **Aucun chauffeur ou employé en congé le %s.** Tout le personnel est disponible.", date)
			} else {
				notFoundMsg = fmt.Sprintf("✅ **No drivers or employees are on leave for %s.** Full roster available.", date)
			}
		} else {
			if isFr {
				notFoundMsg = fmt.Sprintf("⚠️ Aucune demande de congé trouvée correspondant à « **%s** ».", cleanQuery)
			} else {
				notFoundMsg = fmt.Sprintf("⚠️ No time off requests found matching “**%s**”.", cleanQuery)
			}
		}
		return notFoundMsg, nil, nil
	}

	// Single match detailed card
	if len(matched) == 1 {
		req := matched[0]
		statusLabel := string(req.Status)
		cardTitle := fmt.Sprintf("Time Off: %s (%s)", req.EmployeeName, req.LeaveType)
		if isFr {
			cardTitle = fmt.Sprintf("Congé : %s (%s)", req.EmployeeName, req.LeaveType)
		}

		card := &models.AIActionCard{
			Type:  "time_off_details",
			Title: cardTitle,
			Data: map[string]interface{}{
				"id":             req.ID,
				"employeeId":     req.EmployeeID,
				"employeeNumber": req.EmployeeNumber,
				"employeeName":   req.EmployeeName,
				"leaveType":      string(req.LeaveType),
				"startDate":      req.StartDate,
				"endDate":        req.EndDate,
				"shiftType":      req.ShiftType,
				"status":         statusLabel,
				"comments":       req.Comments,
				"approvedByName": req.ApprovedByName,
			},
		}

		var reply string
		if isFr {
			reply = fmt.Sprintf(
				"### 🏖️ **Demande de congé : %s**\n\n"+
					"- **Numéro de demande** : `%s`\n"+
					"- **Employé** : **%s** (`%s`)\n"+
					"- **Motif (Type)** : `%s`\n"+
					"- **Période** : du `%s` au `%s`\n"+
					"- **Quarts concernés** : `%s`\n"+
					"- **Statut** : **%s**\n",
				req.EmployeeName, req.ID, req.EmployeeName, req.EmployeeID, req.LeaveType, req.StartDate, req.EndDate, req.ShiftType, statusLabel,
			)
			if req.Comments != "" {
				reply += fmt.Sprintf("- **Commentaire** : *« %s »*\n", req.Comments)
			}
			if req.ApprovedByName != "" {
				reply += fmt.Sprintf("- **Validé par** : %s\n", req.ApprovedByName)
			}
		} else {
			reply = fmt.Sprintf(
				"### 🏖️ **Time Off Request: %s**\n\n"+
					"- **Request ID** : `%s`\n"+
					"- **Employee** : **%s** (`%s`)\n"+
					"- **Type** : `%s`\n"+
					"- **Duration** : `%s` to `%s`\n"+
					"- **Shift Impact** : `%s`\n"+
					"- **Status** : **%s**\n",
				req.EmployeeName, req.ID, req.EmployeeName, req.EmployeeID, req.LeaveType, req.StartDate, req.EndDate, req.ShiftType, statusLabel,
			)
			if req.Comments != "" {
				reply += fmt.Sprintf("- **Note / Comment** : *“%s”*\n", req.Comments)
			}
			if req.ApprovedByName != "" {
				reply += fmt.Sprintf("- **Reviewed by** : %s\n", req.ApprovedByName)
			}
		}

		return reply, card, nil
	}

	// Multiple matches list
	items := make([]map[string]interface{}, 0, len(matched))
	var lines []string

	if isFr {
		titleText := fmt.Sprintf("Trouvé **%d** demandes de congé :", len(matched))
		if isPendingFilter {
			titleText = fmt.Sprintf("⏳ Il y a **%d** demande(s) de congé en attente de validation :", len(matched))
		} else if isTodayFilter {
			titleText = fmt.Sprintf("🌴 **%d** employé(s) en congé pour la date du %s :", len(matched), date)
		}
		lines = []string{titleText}

		for i, req := range matched {
			if i >= 8 {
				lines = append(lines, fmt.Sprintf("... et %d autres demandes.", len(matched)-8))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`) : du `%s` au `%s` · Quart : `%s` · Statut : **%s**",
				req.EmployeeName, req.LeaveType, req.StartDate, req.EndDate, req.ShiftType, req.Status))

			items = append(items, map[string]interface{}{
				"id":           req.ID,
				"employeeName": req.EmployeeName,
				"leaveType":    string(req.LeaveType),
				"startDate":    req.StartDate,
				"endDate":      req.EndDate,
				"shiftType":    req.ShiftType,
				"status":       string(req.Status),
			})
		}
	} else {
		titleText := fmt.Sprintf("Found **%d** time off requests:", len(matched))
		if isPendingFilter {
			titleText = fmt.Sprintf("⏳ There are **%d** time off request(s) pending approval:", len(matched))
		} else if isTodayFilter {
			titleText = fmt.Sprintf("🌴 **%d** employee(s) on leave for %s:", len(matched), date)
		}
		lines = []string{titleText}

		for i, req := range matched {
			if i >= 8 {
				lines = append(lines, fmt.Sprintf("... and %d more requests.", len(matched)-8))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`): `%s` to `%s` · Shift: `%s` · Status: **%s**",
				req.EmployeeName, req.LeaveType, req.StartDate, req.EndDate, req.ShiftType, req.Status))

			items = append(items, map[string]interface{}{
				"id":           req.ID,
				"employeeName": req.EmployeeName,
				"leaveType":    string(req.LeaveType),
				"startDate":    req.StartDate,
				"endDate":      req.EndDate,
				"shiftType":    req.ShiftType,
				"status":       string(req.Status),
			})
		}
	}

	card := &models.AIActionCard{
		Type:  "time_off_details",
		Title: fmt.Sprintf("Time Off Requests (%d)", len(matched)),
		Data: map[string]interface{}{
			"count": len(matched),
			"items": items,
		},
	}

	return strings.Join(lines, "\n"), card, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE CLAIMS & REIMBURSEMENTS TOOLS
// ─────────────────────────────────────────────────────────────────────────────

// GetExpenseSummary provides totals and counts for driver expense reimbursement claims
func (s *AIToolService) GetExpenseSummary(ctx context.Context, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")

	claims, err := s.dispatchRepo.ListExpenseClaims(ctx, "", "")
	if err != nil {
		return "", nil, err
	}

	totalClaims := len(claims)
	pendingCount := 0
	approvedCount := 0
	rejectedCount := 0

	totalAmount := 0.0
	pendingAmount := 0.0
	approvedAmount := 0.0

	var pendingList []map[string]interface{}

	for _, c := range claims {
		totalAmount += c.TotalAmount
		switch strings.ToLower(c.Status) {
		case "pending":
			pendingCount++
			pendingAmount += c.TotalAmount
			if len(pendingList) < 5 {
				pendingList = append(pendingList, map[string]interface{}{
					"id":           c.ID,
					"employeeName": c.EmployeeName,
					"claimDate":    c.ClaimDate,
					"routeNo":      c.RouteNo,
					"totalAmount":  c.TotalAmount,
				})
			}
		case "approved":
			approvedCount++
			approvedAmount += c.TotalAmount
		case "rejected":
			rejectedCount++
		}
	}

	cardTitle := "Expense Claims & Reimbursement Summary"
	if isZh {
		cardTitle = "报销申请与费用报销总览"
	} else if isFr {
		cardTitle = "Synthèse des notes de frais & remboursements"
	}

	card := &models.AIActionCard{
		Type:  "expense_summary",
		Title: cardTitle,
		Data: map[string]interface{}{
			"totalClaims":    totalClaims,
			"pendingCount":   pendingCount,
			"approvedCount":  approvedCount,
			"rejectedCount":  rejectedCount,
			"totalAmount":    totalAmount,
			"pendingAmount":  pendingAmount,
			"approvedAmount": approvedAmount,
			"pendingList":    pendingList,
		},
	}

	var reply string
	if isZh {
		reply = fmt.Sprintf(
			"### 💳 **报销申请与费用报销总览**\n\n"+
				"- ⏳ **待审批报销**：**%d** 笔，总计 **$%.2f**\n"+
				"- ✅ **已批准已结清**：**%d** 笔（**$%.2f**）\n"+
				"- ❌ **已拒绝/已取消**：**%d** 笔\n"+
				"- 📊 **累计报销申请**：**%d** 笔（共 **$%.2f**）\n\n",
			pendingCount, pendingAmount, approvedCount, approvedAmount, rejectedCount, totalClaims, totalAmount,
		)
		if pendingCount > 0 {
			reply += fmt.Sprintf("⚠️ 当前有 **%d** 笔待审核报销（$%.2f）等待审核。您可以问：“查看待审批报销” 获取详细列表。", pendingCount, pendingAmount)
		} else {
			reply += "🎉 所有报销申请已完成审核，目前没有待处理的报销项目。"
		}
	} else if isFr {
		reply = fmt.Sprintf(
			"### 💳 **Synthèse des notes de frais & remboursements**\n\n"+
				"- ⏳ **En attente d'approbation** : **%d** réclamation(s) pour un montant de **$%.2f**\n"+
				"- ✅ **Approuvées & Payées** : **%d** réclamation(s) (**$%.2f**)\n"+
				"- ❌ **Rejetées / Annulées** : **%d** réclamation(s)\n"+
				"- 📊 **Volume cumulé** : **%d** notes de frais (**$%.2f** au total)\n\n",
			pendingCount, pendingAmount, approvedCount, approvedAmount, rejectedCount, totalClaims, totalAmount,
		)
		if pendingCount > 0 {
			reply += fmt.Sprintf("⚠️ Il y a **%d** note(s) de frais ($%.2f) en attente d'audit par la Paie/Comptabilité. Demandez : *« Voir les remboursements en attente »* pour les détails.", pendingCount, pendingAmount)
		} else {
			reply += "🎉 Toutes les demandes de remboursement ont été auditées. Aucune note de frais en attente."
		}
	} else {
		reply = fmt.Sprintf(
			"### 💳 **Expense Reimbursement Overview**\n\n"+
				"- ⏳ **Pending Approval** : **%d** claim(s) totaling **$%.2f**\n"+
				"- ✅ **Approved & Settled** : **%d** claim(s) (**$%.2f**)\n"+
				"- ❌ **Rejected / Cancelled** : **%d** claim(s)\n"+
				"- 📊 **Cumulative Total** : **%d** claims (**$%.2f** total)\n\n",
			pendingCount, pendingAmount, approvedCount, approvedAmount, rejectedCount, totalClaims, totalAmount,
		)
		if pendingCount > 0 {
			reply += fmt.Sprintf("⚠️ There are **%d** expense claim(s) ($%.2f) awaiting audit by Payroll/Accounting. Say: *“Show pending expense claims”* for details.", pendingCount, pendingAmount)
		} else {
			reply += "🎉 All reimbursement claims have been processed. No claims currently pending."
		}
	}

	return reply, card, nil
}

// GetExpenseDetails searches or details specific expense claims (e.g. pending claims, driver expense history)
func (s *AIToolService) GetExpenseDetails(ctx context.Context, query string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")
	cleanQuery := strings.TrimSpace(query)
	lowerQuery := strings.ToLower(cleanQuery)

	claims, err := s.dispatchRepo.ListExpenseClaims(ctx, "", "")
	if err != nil {
		return "", nil, err
	}

	isPendingFilter := strings.Contains(lowerQuery, "pending") || strings.Contains(lowerQuery, "en attente") || strings.Contains(lowerQuery, "待审批") || strings.Contains(lowerQuery, "待报销")

	var matched []*models.ExpenseReimbursement

	if isPendingFilter {
		for _, c := range claims {
			if strings.EqualFold(c.Status, "pending") {
				matched = append(matched, c)
			}
		}
	} else {
		searchKey := cleanQuery
		removeWords := []string{
			"expense", "expenses", "reimbursement", "reimbursements", "claim", "claims",
			"frais", "remboursement", "remboursements", "note de frais", "notes de frais",
			"报销", "费用", "支出", "查询", "的", "for", "pour", "de",
		}
		for _, rw := range removeWords {
			searchKey = strings.ReplaceAll(strings.ToLower(searchKey), rw, "")
		}
		searchKey = strings.TrimSpace(searchKey)

		if searchKey != "" {
			for _, c := range claims {
				if strings.Contains(strings.ToLower(c.EmployeeName), searchKey) ||
					strings.Contains(strings.ToLower(c.EmployeeID), searchKey) ||
					strings.Contains(strings.ToLower(c.RouteNo), searchKey) ||
					strings.Contains(strings.ToLower(c.ID), searchKey) {
					matched = append(matched, c)
				}
			}
		}

		if len(matched) == 0 {
			// Fallback: list pending claims
			for _, c := range claims {
				if strings.EqualFold(c.Status, "pending") {
					matched = append(matched, c)
				}
			}
			if len(matched) == 0 && len(claims) > 0 {
				matched = claims
			}
		}
	}

	if len(matched) == 0 {
		var notFoundMsg string
		if isPendingFilter {
			if isZh {
				notFoundMsg = "✅ **当前没有待审批的报销申请。** 所有报销已审核完毕。"
			} else if isFr {
				notFoundMsg = "✅ **Aucune note de frais en attente.** Toutes les demandes de remboursement ont été auditées."
			} else {
				notFoundMsg = "✅ **No pending expense claims.** All reimbursement requests have been audited."
			}
		} else {
			if isZh {
				notFoundMsg = fmt.Sprintf("⚠️ 未找到匹配 “**%s**” 的报销记录。", cleanQuery)
			} else if isFr {
				notFoundMsg = fmt.Sprintf("⚠️ Aucune note de frais trouvée correspondant à « **%s** ».", cleanQuery)
			} else {
				notFoundMsg = fmt.Sprintf("⚠️ No expense claims found matching “**%s**”.", cleanQuery)
			}
		}
		return notFoundMsg, nil, nil
	}

	// Single match detailed card
	if len(matched) == 1 {
		c := matched[0]
		cardTitle := fmt.Sprintf("Expense Claim: %s ($%.2f)", c.EmployeeName, c.TotalAmount)
		if isZh {
			cardTitle = fmt.Sprintf("报销详情：%s ($%.2f)", c.EmployeeName, c.TotalAmount)
		} else if isFr {
			cardTitle = fmt.Sprintf("Note de frais : %s ($%.2f)", c.EmployeeName, c.TotalAmount)
		}

		linesData := make([]map[string]interface{}, 0, len(c.Lines))
		for _, l := range c.Lines {
			linesData = append(linesData, map[string]interface{}{
				"category": l.CategoryDisplayName,
				"amount":   l.Amount,
				"note":     l.Note,
			})
		}

		card := &models.AIActionCard{
			Type:  "expense_details",
			Title: cardTitle,
			Data: map[string]interface{}{
				"id":             c.ID,
				"employeeName":   c.EmployeeName,
				"employeeId":     c.EmployeeID,
				"claimDate":      c.ClaimDate,
				"routeNo":        c.RouteNo,
				"totalAmount":    c.TotalAmount,
				"status":         c.Status,
				"lines":          linesData,
				"approvalNotes":  c.ApprovalNotes,
				"approvedByName": c.ApprovedByName,
			},
		}

		var reply string
		if isZh {
			reply = fmt.Sprintf(
				"### 💳 **报销申请详情：%s**\n\n"+
					"- **报销单号**：`%s`\n"+
					"- **员工/司机**：**%s** (`%s`)\n"+
					"- **申报日期**：`%s`\n"+
					"- **关联路线**：`%s`\n"+
					"- **报销总金额**：💵 **$%.2f**\n"+
					"- **状态**：**%s**\n",
				c.EmployeeName, c.ID, c.EmployeeName, c.EmployeeID, c.ClaimDate, c.RouteNo, c.TotalAmount, c.Status,
			)
			if len(c.Lines) > 0 {
				reply += "\n**明细项列表：**\n"
				for _, line := range c.Lines {
					noteStr := ""
					if line.Note != "" {
						noteStr = fmt.Sprintf(" (%s)", line.Note)
					}
					reply += fmt.Sprintf("- %s : **$%.2f**%s\n", line.CategoryDisplayName, line.Amount, noteStr)
				}
			}
			if c.ApprovedByName != "" {
				reply += fmt.Sprintf("\n- **审核人**：%s\n", c.ApprovedByName)
			}
		} else if isFr {
			reply = fmt.Sprintf(
				"### 💳 **Note de frais : %s**\n\n"+
					"- **Numéro de réclamation** : `%s`\n"+
					"- **Chauffeur / Employé** : **%s** (`%s`)\n"+
					"- **Date de la dépense** : `%s`\n"+
					"- **Ligne associée** : `%s`\n"+
					"- **Montant total** : 💵 **$%.2f**\n"+
					"- **Statut** : **%s**\n",
				c.EmployeeName, c.ID, c.EmployeeName, c.EmployeeID, c.ClaimDate, c.RouteNo, c.TotalAmount, c.Status,
			)
			if len(c.Lines) > 0 {
				reply += "\n**Détail des postes :**\n"
				for _, line := range c.Lines {
					noteStr := ""
					if line.Note != "" {
						noteStr = fmt.Sprintf(" (%s)", line.Note)
					}
					reply += fmt.Sprintf("- %s : **$%.2f**%s\n", line.CategoryDisplayName, line.Amount, noteStr)
				}
			}
			if c.ApprovedByName != "" {
				reply += fmt.Sprintf("\n- **Validé par** : %s\n", c.ApprovedByName)
			}
		} else {
			reply = fmt.Sprintf(
				"### 💳 **Expense Claim: %s**\n\n"+
					"- **Claim ID** : `%s`\n"+
					"- **Employee** : **%s** (`%s`)\n"+
					"- **Date of Expense** : `%s`\n"+
					"- **Route** : `%s`\n"+
					"- **Total Amount** : 💵 **$%.2f**\n"+
					"- **Status** : **%s**\n",
				c.EmployeeName, c.ID, c.EmployeeName, c.EmployeeID, c.ClaimDate, c.RouteNo, c.TotalAmount, c.Status,
			)
			if len(c.Lines) > 0 {
				reply += "\n**Line Items Breakdown:**\n"
				for _, line := range c.Lines {
					noteStr := ""
					if line.Note != "" {
						noteStr = fmt.Sprintf(" (%s)", line.Note)
					}
					reply += fmt.Sprintf("- %s: **$%.2f**%s\n", line.CategoryDisplayName, line.Amount, noteStr)
				}
			}
			if c.ApprovedByName != "" {
				reply += fmt.Sprintf("\n- **Audited by** : %s\n", c.ApprovedByName)
			}
		}

		return reply, card, nil
	}

	// Multiple matches list
	items := make([]map[string]interface{}, 0, len(matched))
	var lines []string

	if isZh {
		titleText := fmt.Sprintf("找到 **%d** 条报销记录：", len(matched))
		if isPendingFilter {
			titleText = fmt.Sprintf("⏳ 当前有 **%d** 笔待审批报销申请：", len(matched))
		}
		lines = []string{titleText}

		for i, c := range matched {
			if i >= 8 {
				lines = append(lines, fmt.Sprintf("... 以及另外 %d 笔报销申请。", len(matched)-8))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`)：日期 `%s` · 金额：**$%.2f** · 状态：**%s**",
				c.EmployeeName, c.RouteNo, c.ClaimDate, c.TotalAmount, c.Status))

			items = append(items, map[string]interface{}{
				"id":           c.ID,
				"employeeName": c.EmployeeName,
				"claimDate":    c.ClaimDate,
				"routeNo":      c.RouteNo,
				"totalAmount":  c.TotalAmount,
				"status":       c.Status,
			})
		}
	} else if isFr {
		titleText := fmt.Sprintf("Trouvé **%d** notes de frais :", len(matched))
		if isPendingFilter {
			titleText = fmt.Sprintf("⏳ Il y a **%d** note(s) de frais en attente d'approbation :", len(matched))
		}
		lines = []string{titleText}

		for i, c := range matched {
			if i >= 8 {
				lines = append(lines, fmt.Sprintf("... et %d autres notes de frais.", len(matched)-8))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`) : Date `%s` · Montant : **$%.2f** · Statut : **%s**",
				c.EmployeeName, c.RouteNo, c.ClaimDate, c.TotalAmount, c.Status))

			items = append(items, map[string]interface{}{
				"id":           c.ID,
				"employeeName": c.EmployeeName,
				"claimDate":    c.ClaimDate,
				"routeNo":      c.RouteNo,
				"totalAmount":  c.TotalAmount,
				"status":       c.Status,
			})
		}
	} else {
		titleText := fmt.Sprintf("Found **%d** expense claims:", len(matched))
		if isPendingFilter {
			titleText = fmt.Sprintf("⏳ There are **%d** expense claim(s) pending approval:", len(matched))
		}
		lines = []string{titleText}

		for i, c := range matched {
			if i >= 8 {
				lines = append(lines, fmt.Sprintf("... and %d more claims.", len(matched)-8))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`): Date `%s` · Amount: **$%.2f** · Status: **%s**",
				c.EmployeeName, c.RouteNo, c.ClaimDate, c.TotalAmount, c.Status))

			items = append(items, map[string]interface{}{
				"id":           c.ID,
				"employeeName": c.EmployeeName,
				"claimDate":    c.ClaimDate,
				"routeNo":      c.RouteNo,
				"totalAmount":  c.TotalAmount,
				"status":       c.Status,
			})
		}
	}

	cardTitle := fmt.Sprintf("Expense Claims (%d)", len(matched))
	if isZh {
		cardTitle = fmt.Sprintf("报销申请列表 (%d)", len(matched))
	} else if isFr {
		cardTitle = fmt.Sprintf("Notes de frais (%d)", len(matched))
	}
	card := &models.AIActionCard{
		Type:  "expense_details",
		Title: cardTitle,
		Data: map[string]interface{}{
			"count": len(matched),
			"items": items,
		},
	}

	return strings.Join(lines, "\n"), card, nil
}

// ============================================================================
// TRAINING COURSES & SESSIONS TOOLS
// ============================================================================

func (s *AIToolService) GetTrainingSummary(ctx context.Context, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	courses, err := s.dispatchRepo.ListTrainingCourses(ctx, "", "", "")
	if err != nil {
		courses = []*models.TrainingCourse{}
	}

	today := date
	if today == "" {
		today = time.Now().Format("2006-01-02")
	}

	total := len(courses)
	publishedCount := 0
	completedCount := 0
	draftCount := 0
	cancelledCount := 0
	totalRegistered := 0

	var upcoming []*models.TrainingCourse
	for _, c := range courses {
		switch c.Status {
		case models.TrainingCourseStatusPublished:
			publishedCount++
			if c.StartDate >= today || c.StartDate == "" {
				upcoming = append(upcoming, c)
			}
		case models.TrainingCourseStatusCompleted:
			completedCount++
		case models.TrainingCourseStatusDraft:
			draftCount++
		case models.TrainingCourseStatusCancelled:
			cancelledCount++
		}
		totalRegistered += c.RegisteredCount
	}

	var reply string
	if isFr {
		reply = fmt.Sprintf("📚 **Synthèse des Formations & Sessions de Conduite** :\n\n"+
			"- **Total des sessions enregistrées** : **%d**\n"+
			"- **Sessions publiées / à venir** : **%d** 📅\n"+
			"- **Sessions terminées** : **%d** ✅\n"+
			"- **Brouillons en préparation** : **%d** 📝\n"+
			"- **Total des inscrits** : **%d** participant(s)\n",
			total, publishedCount, completedCount, draftCount, totalRegistered)

		if len(upcoming) > 0 {
			reply += "\n🗓️ **Prochaines formations planifiées** :\n"
			for i, c := range upcoming {
				if i >= 5 {
					reply += fmt.Sprintf("... et %d autre(s) session(s).\n", len(upcoming)-5)
					break
				}
				reply += fmt.Sprintf("%d. **%s** (`%s`) · Formateur : **%s** · Inscrits : **%d/%d** · Date : `%s`\n",
					i+1, c.Title, c.TrainingTypeName, c.InstructorName, c.RegisteredCount, c.MaxSeats, c.StartDate)
			}
		}
	} else {
		reply = fmt.Sprintf("📚 **Training Courses & Sessions Summary**:\n\n"+
			"- **Total Sessions Recorded**: **%d**\n"+
			"- **Published / Upcoming Sessions**: **%d** 📅\n"+
			"- **Completed Sessions**: **%d** ✅\n"+
			"- **Draft Sessions**: **%d** 📝\n"+
			"- **Total Enrolled Attendees**: **%d** participant(s)\n",
			total, publishedCount, completedCount, draftCount, totalRegistered)

		if len(upcoming) > 0 {
			reply += "\n🗓️ **Upcoming Scheduled Sessions**:\n"
			for i, c := range upcoming {
				if i >= 5 {
					reply += fmt.Sprintf("... and %d more session(s).\n", len(upcoming)-5)
					break
				}
				reply += fmt.Sprintf("%d. **%s** (`%s`) · Instructor: **%s** · Enrolled: **%d/%d** · Date: `%s`\n",
					i+1, c.Title, c.TrainingTypeName, c.InstructorName, c.RegisteredCount, c.MaxSeats, c.StartDate)
			}
		}
	}

	cardItems := make([]map[string]interface{}, 0, len(upcoming))
	for _, c := range upcoming {
		cardItems = append(cardItems, map[string]interface{}{
			"id":               c.ID,
			"title":            c.Title,
			"trainingTypeName": c.TrainingTypeName,
			"instructorName":   c.InstructorName,
			"startDate":        c.StartDate,
			"location":         c.Location,
			"registeredCount":  c.RegisteredCount,
			"capacity":         c.MaxSeats,
			"status":           string(c.Status),
		})
	}

	card := &models.AIActionCard{
		Type:  "training_summary",
		Title: "Training Courses Summary",
		Data: map[string]interface{}{
			"total":           total,
			"publishedCount":  publishedCount,
			"completedCount":  completedCount,
			"draftCount":      draftCount,
			"cancelledCount":  cancelledCount,
			"totalRegistered": totalRegistered,
			"upcoming":        cardItems,
		},
	}

	return reply, card, nil
}

func (s *AIToolService) GetTrainingDetails(ctx context.Context, query string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	q := strings.ToLower(strings.TrimSpace(query))

	courses, err := s.dispatchRepo.ListTrainingCourses(ctx, "", "", "")
	if err != nil {
		return "", nil, err
	}

	var matched []*models.TrainingCourse
	for _, c := range courses {
		if strings.Contains(strings.ToLower(c.Title), q) ||
			strings.Contains(strings.ToLower(c.InstructorName), q) ||
			strings.Contains(strings.ToLower(c.TrainingTypeName), q) ||
			strings.Contains(strings.ToLower(c.Location), q) ||
			strings.Contains(strings.ToLower(c.ID), q) {
			matched = append(matched, c)
		}
	}

	if len(matched) == 0 {
		if isFr {
			return fmt.Sprintf("🔍 Aucune formation trouvée correspondant à « **%s** ».", query), nil, nil
		}
		return fmt.Sprintf("🔍 No training courses found matching \"**%s**\".", query), nil, nil
	}

	if len(matched) == 1 {
		c := matched[0]
		var reply string
		if isFr {
			reply = fmt.Sprintf("🎓 **Détails de la Formation : %s**\n\n"+
				"- **Identifiant** : `%s`\n"+
				"- **Catégorie** : `%s`\n"+
				"- **Statut** : **%s**\n"+
				"- **Formateur** : **%s**\n"+
				"- **Lieu** : %s (%s)\n"+
				"- **Date & Horaires** : `%s` (%s - %s)\n"+
				"- **Inscriptions** : **%d / %d** places\n",
				c.Title, c.ID, c.TrainingTypeName, c.Status, c.InstructorName, c.Location, c.YardName, c.StartDate, c.StartTime, c.EndTime, c.RegisteredCount, c.MaxSeats)
			if c.Description != "" {
				reply += fmt.Sprintf("- **Description** : %s\n", c.Description)
			}
			if len(c.Registrations) > 0 {
				reply += "\n👥 **Participants inscrits** :\n"
				for i, r := range c.Registrations {
					if i >= 6 {
						reply += fmt.Sprintf("... et %d autres inscrits.\n", len(c.Registrations)-6)
						break
					}
					reply += fmt.Sprintf("- %s (%s) · Statut : %s\n", r.EmployeeName, r.JobTitle, r.Status)
				}
			}
		} else {
			reply = fmt.Sprintf("🎓 **Training Course Details: %s**\n\n"+
				"- **ID**: `%s`\n"+
				"- **Category**: `%s`\n"+
				"- **Status**: **%s**\n"+
				"- **Instructor**: **%s**\n"+
				"- **Location**: %s (%s)\n"+
				"- **Schedule**: `%s` (%s - %s)\n"+
				"- **Capacity**: **%d / %d** attendees enrolled\n",
				c.Title, c.ID, c.TrainingTypeName, c.Status, c.InstructorName, c.Location, c.YardName, c.StartDate, c.StartTime, c.EndTime, c.RegisteredCount, c.MaxSeats)
			if c.Description != "" {
				reply += fmt.Sprintf("- **Description**: %s\n", c.Description)
			}
			if len(c.Registrations) > 0 {
				reply += "\n👥 **Enrolled Attendees**:\n"
				for i, r := range c.Registrations {
					if i >= 6 {
						reply += fmt.Sprintf("... and %d more attendees.\n", len(c.Registrations)-6)
						break
					}
					reply += fmt.Sprintf("- %s (%s) · Status: %s\n", r.EmployeeName, r.JobTitle, r.Status)
				}
			}
		}

		card := &models.AIActionCard{
			Type:  "training_details",
			Title: c.Title,
			Data: map[string]interface{}{
				"id":               c.ID,
				"title":            c.Title,
				"trainingTypeName": c.TrainingTypeName,
				"instructorName":   c.InstructorName,
				"location":         c.Location,
				"startDate":        c.StartDate,
				"startTime":        c.StartTime,
				"endTime":          c.EndTime,
				"capacity":         c.MaxSeats,
				"registeredCount":  c.RegisteredCount,
				"status":           string(c.Status),
				"registrations":    c.Registrations,
			},
		}

		return reply, card, nil
	}

	// Multiple matches list
	items := make([]map[string]interface{}, 0, len(matched))
	var lines []string
	if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** sessions de formation :", len(matched))}
		for i, c := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... et %d autres sessions.", len(matched)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`) : Date `%s` · Formateur : **%s** · Inscrits : **%d/%d** · Statut : **%s**",
				c.Title, c.TrainingTypeName, c.StartDate, c.InstructorName, c.RegisteredCount, c.MaxSeats, c.Status))
			items = append(items, map[string]interface{}{
				"id":               c.ID,
				"title":            c.Title,
				"trainingTypeName": c.TrainingTypeName,
				"startDate":        c.StartDate,
				"status":           string(c.Status),
			})
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** training sessions:", len(matched))}
		for i, c := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... and %d more sessions.", len(matched)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`): Date `%s` · Instructor: **%s** · Enrolled: **%d/%d** · Status: **%s**",
				c.Title, c.TrainingTypeName, c.StartDate, c.InstructorName, c.RegisteredCount, c.MaxSeats, c.Status))
			items = append(items, map[string]interface{}{
				"id":               c.ID,
				"title":            c.Title,
				"trainingTypeName": c.TrainingTypeName,
				"startDate":        c.StartDate,
				"status":           string(c.Status),
			})
		}
	}

	card := &models.AIActionCard{
		Type:  "training_summary",
		Title: fmt.Sprintf("Training Courses (%d)", len(matched)),
		Data: map[string]interface{}{
			"count": len(matched),
			"items": items,
		},
	}

	return strings.Join(lines, "\n"), card, nil
}

// ============================================================================
// STUDENT INCIDENT REPORTS TOOLS
// ============================================================================

func (s *AIToolService) GetStudentIncidentSummary(ctx context.Context, date string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")

	incidents, err := s.dispatchRepo.ListStudentIncidents(ctx, 0, "", "", "", false)
	if err != nil {
		incidents = []*models.StudentIncident{}
	}

	total := len(incidents)
	submittedCount := 0
	investigatingCount := 0
	parentContactedCount := 0
	schoolNotifiedCount := 0
	closedCount := 0
	firstAidCount := 0
	removedCount := 0

	var openIncidents []*models.StudentIncident
	for _, inc := range incidents {
		switch strings.ToLower(inc.Status) {
		case "submitted":
			submittedCount++
			openIncidents = append(openIncidents, inc)
		case "under_investigation":
			investigatingCount++
			openIncidents = append(openIncidents, inc)
		case "parent_contacted":
			parentContactedCount++
		case "school_notified":
			schoolNotifiedCount++
		case "closed":
			closedCount++
		default:
			openIncidents = append(openIncidents, inc)
		}
		if inc.FirstAidRequired {
			firstAidCount++
		}
		if inc.StudentRemovedFromBus {
			removedCount++
		}
	}

	var reply string
	if isZh {
		reply = fmt.Sprintf("⚠️ **学生安全与行为违规事件汇总**：\n\n"+
			"- **累计上报事件**：**%d** 件\n"+
			"- **新上报待审核**：**%d** 件 🟡\n"+
			"- **调查处理中**：**%d** 件 🔍\n"+
			"- **已联络家长/学校**：**%d** 件 📞\n"+
			"- **已结案归档**：**%d** 件 ✅\n"+
			"- **需要紧急医疗救护**：**%d** 件 🚑\n"+
			"- **从校车临时隔离移出**：**%d** 件 🛑\n",
			total, submittedCount, investigatingCount, parentContactedCount+schoolNotifiedCount, closedCount, firstAidCount, removedCount)

		if len(openIncidents) > 0 {
			reply += "\n🚨 **近期需跟进的学生安全事件**：\n"
			for i, inc := range openIncidents {
				if i >= 5 {
					reply += fmt.Sprintf("... 以及另外 %d 件事件。\n", len(openIncidents)-5)
					break
				}
				reply += fmt.Sprintf("%d. **%s**（路线 `%s`）· 日期：`%s` · 学生：**%s** · 状态：`%s`\n",
					i+1, inc.Description, inc.RouteNo, inc.IncidentDate, inc.StudentName, inc.Status)
			}
		}
	} else if isFr {
		reply = fmt.Sprintf("⚠️ **Synthèse des Incidents & Comportements d'Élèves** :\n\n"+
			"- **Total des incidents signalés** : **%d**\n"+
			"- **Nouveaux signalements (en attente)** : **%d** 🟡\n"+
			"- **En cours d'enquête** : **%d** 🔍\n"+
			"- **Parents / École contactés** : **%d** 📞\n"+
			"- **Dossiers clôturés** : **%d** ✅\n"+
			"- **Premiers soins requis** : **%d** 🚑\n"+
			"- **Élève retiré du véhicule** : **%d** 🛑\n",
			total, submittedCount, investigatingCount, parentContactedCount+schoolNotifiedCount, closedCount, firstAidCount, removedCount)

		if len(openIncidents) > 0 {
			reply += "\n🚨 **Incidents récents nécessitant un suivi** :\n"
			for i, inc := range openIncidents {
				if i >= 5 {
					reply += fmt.Sprintf("... et %d autre(s) incident(s).\n", len(openIncidents)-5)
					break
				}
				reply += fmt.Sprintf("%d. **%s** (Ligne `%s`) · Date : `%s` · Élève : **%s** · Statut : `%s`\n",
					i+1, inc.Description, inc.RouteNo, inc.IncidentDate, inc.StudentName, inc.Status)
			}
		}
	} else {
		reply = fmt.Sprintf("⚠️ **Student Incidents & Behavioral Reports Summary**:\n\n"+
			"- **Total Incidents Filed**: **%d**\n"+
			"- **Submitted (Pending Review)**: **%d** 🟡\n"+
			"- **Under Investigation**: **%d** 🔍\n"+
			"- **Parent / School Contacted**: **%d** 📞\n"+
			"- **Closed Incidents**: **%d** ✅\n"+
			"- **First Aid Required**: **%d** 🚑\n"+
			"- **Student Removed from Bus**: **%d** 🛑\n",
			total, submittedCount, investigatingCount, parentContactedCount+schoolNotifiedCount, closedCount, firstAidCount, removedCount)

		if len(openIncidents) > 0 {
			reply += "\n🚨 **Recent Open Incidents Requiring Follow-Up**:\n"
			for i, inc := range openIncidents {
				if i >= 5 {
					reply += fmt.Sprintf("... and %d more incident(s).\n", len(openIncidents)-5)
					break
				}
				reply += fmt.Sprintf("%d. **%s** (Route `%s`) · Date: `%s` · Student: **%s** · Status: `%s`\n",
					i+1, inc.Description, inc.RouteNo, inc.IncidentDate, inc.StudentName, inc.Status)
			}
		}
	}

	cardItems := make([]map[string]interface{}, 0, len(openIncidents))
	for _, inc := range openIncidents {
		cardItems = append(cardItems, map[string]interface{}{
			"id":           inc.ID,
			"incidentDate": inc.IncidentDate,
			"incidentTime": inc.IncidentTime,
			"studentName":  inc.StudentName,
			"routeNo":      inc.RouteNo,
			"driverName":   inc.DriverName,
			"status":       inc.Status,
			"description":  inc.Description,
		})
	}

	cardTitle := "Student Incident Summary"
	if isZh {
		cardTitle = "学生安全与违规事件总览"
	} else if isFr {
		cardTitle = "Synthèse des incidents élèves"
	}

	card := &models.AIActionCard{
		Type:  "student_incident_summary",
		Title: cardTitle,
		Data: map[string]interface{}{
			"total":              total,
			"submittedCount":     submittedCount,
			"investigatingCount": investigatingCount,
			"closedCount":        closedCount,
			"firstAidCount":      firstAidCount,
			"removedCount":       removedCount,
			"openIncidents":      cardItems,
		},
	}

	return reply, card, nil
}

func (s *AIToolService) GetStudentIncidentDetails(ctx context.Context, query string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	isZh := strings.EqualFold(lang, "zh")
	q := strings.ToLower(strings.TrimSpace(query))

	// Clean query to remove generic query noise
	searchKey := q
	fillerWords := []string{
		"recent student safety incidents", "recent safety incidents", "recent student incidents",
		"recent incidents", "student safety incidents", "student safety incident",
		"student incident reports", "student incident report", "student incidents", "student incident",
		"safety incidents", "safety incident", "incident report", "incident reports",
		"incidents", "incident", "rapports d'incident", "rapport d'incident",
		"incidents élèves", "incidents eleves", "recent", "safety", "student", "report", "reports",
		"最近学生安全事件", "最近学生事件", "学生安全事件", "学生违规事件", "学生事件报告", "学生事故报告",
		"学生事件", "学生事故", "安全事件", "事件报告", "事故报告", "最近", "安全", "事件", "事故", "报告",
	}
	for _, fw := range fillerWords {
		searchKey = strings.ReplaceAll(searchKey, fw, "")
	}
	searchKey = strings.TrimSpace(searchKey)

	// If query was purely generic ("Recent student safety incidents"), show summary
	if searchKey == "" {
		return s.GetStudentIncidentSummary(ctx, "", lang)
	}

	incidents, err := s.dispatchRepo.ListStudentIncidents(ctx, 0, "", "", "", false)
	if err != nil {
		return "", nil, err
	}

	var matched []*models.StudentIncident
	for _, inc := range incidents {
		if strings.Contains(strings.ToLower(inc.StudentName), searchKey) ||
			strings.Contains(strings.ToLower(inc.RouteNo), searchKey) ||
			strings.Contains(strings.ToLower(inc.DriverName), searchKey) ||
			strings.Contains(strings.ToLower(inc.SchoolName), searchKey) ||
			strings.Contains(strings.ToLower(inc.Description), searchKey) ||
			strings.Contains(strings.ToLower(inc.ID), searchKey) {
			matched = append(matched, inc)
		}
	}

	if len(matched) == 0 {
		// Fallback to general incident summary so the user gets actionable data instead of a dead-end
		return s.GetStudentIncidentSummary(ctx, "", lang)
	}

	if len(matched) == 1 {
		inc := matched[0]
		cardTitle := fmt.Sprintf("Incident: %s", inc.StudentName)
		if isZh {
			cardTitle = fmt.Sprintf("学生事件记录：%s", inc.StudentName)
		} else if isFr {
			cardTitle = fmt.Sprintf("Rapport d'incident : %s", inc.StudentName)
		}

		var reply string
		if isZh {
			reply = fmt.Sprintf("📋 **学生事件记录：%s**\n\n"+
				"- **事件编号**：`%s`\n"+
				"- **涉事学生**：**%s**（年级：%s）· 学校：%s\n"+
				"- **发生时间**：`%s %s`\n"+
				"- **关联路线**：`%s`（%s）\n"+
				"- **当班司机**：**%s**\n"+
				"- **处理状态**：**%s**\n"+
				"- **事件类型**：%s\n"+
				"- **事件描述**：%s\n",
				inc.StudentName, inc.ID, inc.StudentName, inc.Grade, inc.SchoolName,
				inc.IncidentDate, inc.IncidentTime, inc.RouteNo, inc.ShiftType, inc.DriverName,
				inc.Status, strings.Join(inc.IncidentTypes, ", "), inc.Description)

			if inc.ImmediateActionTaken != "" {
				reply += fmt.Sprintf("- **现场处置措施**：%s\n", inc.ImmediateActionTaken)
			}
			if inc.FirstAidRequired {
				reply += "- 🚑 **需要紧急医疗救护**：是\n"
			}
			if inc.StudentRemovedFromBus {
				reply += "- 🛑 **学生从校车隔离移出**：是\n"
			}
			if inc.ParentsNotified {
				reply += fmt.Sprintf("- 📞 **已通知家长**：是（%s）\n", inc.ParentsNotificationDetail)
			}
			if inc.OfficeFollowUp != nil && inc.OfficeFollowUp.AdministratorName != "" {
				reply += fmt.Sprintf("\n🏢 **办公室跟进处置（负责人：%s）**：\n- 处分措施：%s\n- 备注：%s\n",
					inc.OfficeFollowUp.AdministratorName,
					strings.Join(inc.OfficeFollowUp.DisciplinaryActions, ", "),
					inc.OfficeFollowUp.OfficeNotes)
			}
		} else if isFr {
			reply = fmt.Sprintf("📋 **Rapport d'Incident Élève : %s**\n\n"+
				"- **Identifiant** : `%s`\n"+
				"- **Élève** : **%s** (Classe : %s) · École : %s\n"+
				"- **Date & Heure** : `%s` à `%s`\n"+
				"- **Ligne** : `%s` (%s)\n"+
				"- **Chauffeur** : **%s**\n"+
				"- **Statut** : **%s**\n"+
				"- **Types d'incident** : %s\n"+
				"- **Description** : %s\n",
				inc.StudentName, inc.ID, inc.StudentName, inc.Grade, inc.SchoolName,
				inc.IncidentDate, inc.IncidentTime, inc.RouteNo, inc.ShiftType, inc.DriverName,
				inc.Status, strings.Join(inc.IncidentTypes, ", "), inc.Description)

			if inc.ImmediateActionTaken != "" {
				reply += fmt.Sprintf("- **Action immédiate prise** : %s\n", inc.ImmediateActionTaken)
			}
			if inc.FirstAidRequired {
				reply += "- 🚑 **Premiers soins requis** : Oui\n"
			}
			if inc.StudentRemovedFromBus {
				reply += "- 🛑 **Élève débarqué du véhicule** : Oui\n"
			}
			if inc.ParentsNotified {
				reply += fmt.Sprintf("- 📞 **Parents notifiés** : Oui (%s)\n", inc.ParentsNotificationDetail)
			}
			if inc.OfficeFollowUp != nil && inc.OfficeFollowUp.AdministratorName != "" {
				reply += fmt.Sprintf("\n🏢 **Suivi administratif (%s)** :\n- Mesures : %s\n- Remarques : %s\n",
					inc.OfficeFollowUp.AdministratorName,
					strings.Join(inc.OfficeFollowUp.DisciplinaryActions, ", "),
					inc.OfficeFollowUp.OfficeNotes)
			}
		} else {
			reply = fmt.Sprintf("📋 **Student Incident Report: %s**\n\n"+
				"- **ID**: `%s`\n"+
				"- **Student**: **%s** (Grade: %s) · School: %s\n"+
				"- **Date & Time**: `%s` at `%s`\n"+
				"- **Route**: `%s` (%s)\n"+
				"- **Driver**: **%s**\n"+
				"- **Status**: **%s**\n"+
				"- **Incident Categories**: %s\n"+
				"- **Description**: %s\n",
				inc.StudentName, inc.ID, inc.StudentName, inc.Grade, inc.SchoolName,
				inc.IncidentDate, inc.IncidentTime, inc.RouteNo, inc.ShiftType, inc.DriverName,
				inc.Status, strings.Join(inc.IncidentTypes, ", "), inc.Description)

			if inc.ImmediateActionTaken != "" {
				reply += fmt.Sprintf("- **Immediate Action Taken**: %s\n", inc.ImmediateActionTaken)
			}
			if inc.FirstAidRequired {
				reply += "- 🚑 **First Aid Required**: Yes\n"
			}
			if inc.StudentRemovedFromBus {
				reply += "- 🛑 **Student Removed from Bus**: Yes\n"
			}
			if inc.ParentsNotified {
				reply += fmt.Sprintf("- 📞 **Parents Notified**: Yes (%s)\n", inc.ParentsNotificationDetail)
			}
			if inc.OfficeFollowUp != nil && inc.OfficeFollowUp.AdministratorName != "" {
				reply += fmt.Sprintf("\n🏢 **Office Administration Follow-up (%s)**:\n- Disciplinary Actions: %s\n- Notes: %s\n",
					inc.OfficeFollowUp.AdministratorName,
					strings.Join(inc.OfficeFollowUp.DisciplinaryActions, ", "),
					inc.OfficeFollowUp.OfficeNotes)
			}
		}

		card := &models.AIActionCard{
			Type:  "student_incident_details",
			Title: cardTitle,
			Data: map[string]interface{}{
				"id":                    inc.ID,
				"studentName":           inc.StudentName,
				"grade":                 inc.Grade,
				"schoolName":            inc.SchoolName,
				"routeNo":               inc.RouteNo,
				"driverName":            inc.DriverName,
				"incidentDate":          inc.IncidentDate,
				"incidentTime":          inc.IncidentTime,
				"incidentTypes":         inc.IncidentTypes,
				"description":           inc.Description,
				"firstAidRequired":      inc.FirstAidRequired,
				"studentRemovedFromBus": inc.StudentRemovedFromBus,
				"status":                inc.Status,
			},
		}

		return reply, card, nil
	}

	// Multiple matches list
	items := make([]map[string]interface{}, 0, len(matched))
	var lines []string
	if isZh {
		lines = []string{fmt.Sprintf("找到 **%d** 件学生事件记录：", len(matched))}
		for i, inc := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... 以及另外 %d 件记录。", len(matched)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s**（路线 `%s`）：日期 `%s` · 学生：**%s** · 状态：**%s**",
				inc.ID, inc.RouteNo, inc.IncidentDate, inc.StudentName, inc.Status))
			items = append(items, map[string]interface{}{
				"id":           inc.ID,
				"studentName":  inc.StudentName,
				"routeNo":      inc.RouteNo,
				"incidentDate": inc.IncidentDate,
				"status":       inc.Status,
			})
		}
	} else if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** rapports d'incident :", len(matched))}
		for i, inc := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... et %d autres rapports.", len(matched)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`) : Date `%s` · Élève : **%s** · Statut : **%s**",
				inc.ID, inc.RouteNo, inc.IncidentDate, inc.StudentName, inc.Status))
			items = append(items, map[string]interface{}{
				"id":           inc.ID,
				"studentName":  inc.StudentName,
				"routeNo":      inc.RouteNo,
				"incidentDate": inc.IncidentDate,
				"status":       inc.Status,
			})
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** student incident reports:", len(matched))}
		for i, inc := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... and %d more reports.", len(matched)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** (`%s`): Date `%s` · Student: **%s** · Status: **%s**",
				inc.ID, inc.RouteNo, inc.IncidentDate, inc.StudentName, inc.Status))
			items = append(items, map[string]interface{}{
				"id":           inc.ID,
				"studentName":  inc.StudentName,
				"routeNo":      inc.RouteNo,
				"incidentDate": inc.IncidentDate,
				"status":       inc.Status,
			})
		}
	}

	cardTitle := fmt.Sprintf("Student Incidents (%d)", len(matched))
	if isZh {
		cardTitle = fmt.Sprintf("学生事件记录 (%d)", len(matched))
	} else if isFr {
		cardTitle = fmt.Sprintf("Incidents élèves (%d)", len(matched))
	}

	card := &models.AIActionCard{
		Type:  "student_incident_summary",
		Title: cardTitle,
		Data: map[string]interface{}{
			"count": len(matched),
			"items": items,
		},
	}

	return strings.Join(lines, "\n"), card, nil
}

// ============================================================================
// HAZARD & NEAR-MISS SAFETY REPORTS TOOLS
// ============================================================================

func (s *AIToolService) GetHazardReportSummary(ctx context.Context, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	hazards, err := s.dispatchRepo.ListHazardReports(ctx, "", nil, "")
	if err != nil {
		hazards = []*models.HazardReport{}
	}

	total := len(hazards)
	openCount := 0
	completedCount := 0
	seriousCount := 0
	moderateCount := 0
	trafficHazardCount := 0
	snowHazardCount := 0
	equipmentHazardCount := 0
	nearMissCount := 0

	var openHazards []*models.HazardReport
	for _, h := range hazards {
		if h.IsCompleted {
			completedCount++
		} else {
			openCount++
			openHazards = append(openHazards, h)
		}
		if h.Serious {
			seriousCount++
		}
		if h.Moderate {
			moderateCount++
		}
		if h.TrafficHazard {
			trafficHazardCount++
		}
		if h.SnowHazard {
			snowHazardCount++
		}
		if h.EquipmentHazard {
			equipmentHazardCount++
		}
		if h.UnsafeAction || h.UnsafeCondition || h.HappenedtoMe || h.HappenedtoSomeone {
			nearMissCount++
		}
	}

	var reply string
	if isFr {
		reply = fmt.Sprintf("⚠️ **Synthèse des Rapports de Dangers & Presque-Accidents (Hazards)** :\n\n"+
			"- **Total des signalements** : **%d**\n"+
			"- **En attente de traitement (ouverts)** : **%d** 🟡\n"+
			"- **Résolus / Clôturés** : **%d** ✅\n"+
			"- **Dangers graves (Serious Risk)** : **%d** 🔴\n"+
			"- **Dangers modérés (Moderate Risk)** : **%d** 🟠\n"+
			"- **Risques de circulation routière** : **%d** 🚗\n"+
			"- **Risques neige / météo** : **%d** ❄️\n"+
			"- **Presque-accidents (Near Miss)** : **%d** ⚡\n",
			total, openCount, completedCount, seriousCount, moderateCount, trafficHazardCount, snowHazardCount, nearMissCount)

		if len(openHazards) > 0 {
			reply += "\n🚨 **Signalements ouverts récents** :\n"
			for i, h := range openHazards {
				if i >= 5 {
					reply += fmt.Sprintf("... et %d autre(s) danger(s).\n", len(openHazards)-5)
					break
				}
				reply += fmt.Sprintf("%d. **%s** · Signalé par : **%s** · Lieu : `%s` · Traitement : `%s`\n",
					i+1, h.EventDescription, h.ReportedBy, h.EventLocation, h.AssignedTo)
			}
		}
	} else {
		reply = fmt.Sprintf("⚠️ **Hazard, Safety Concern & Near-Miss Summary**:\n\n"+
			"- **Total Reports Filed**: **%d**\n"+
			"- **Pending / Open Hazards**: **%d** 🟡\n"+
			"- **Resolved / Completed**: **%d** ✅\n"+
			"- **Serious Risk Potential**: **%d** 🔴\n"+
			"- **Moderate Risk Potential**: **%d** 🟠\n"+
			"- **Traffic & Road Hazards**: **%d** 🚗\n"+
			"- **Snow & Winter Hazards**: **%d** ❄️\n"+
			"- **Close Calls / Near Misses**: **%d** ⚡\n",
			total, openCount, completedCount, seriousCount, moderateCount, trafficHazardCount, snowHazardCount, nearMissCount)

		if len(openHazards) > 0 {
			reply += "\n🚨 **Recent Open Hazards Requiring Action**:\n"
			for i, h := range openHazards {
				if i >= 5 {
					reply += fmt.Sprintf("... and %d more hazard(s).\n", len(openHazards)-5)
					break
				}
				reply += fmt.Sprintf("%d. **%s** · Reported by: **%s** · Location: `%s` · Assigned: `%s`\n",
					i+1, h.EventDescription, h.ReportedBy, h.EventLocation, h.AssignedTo)
			}
		}
	}

	cardItems := make([]map[string]interface{}, 0, len(openHazards))
	for _, h := range openHazards {
		cardItems = append(cardItems, map[string]interface{}{
			"id":               h.ID,
			"reportedBy":       h.ReportedBy,
			"eventTime":        h.EventTime,
			"eventLocation":    h.EventLocation,
			"eventDescription": h.EventDescription,
			"serious":          h.Serious,
			"moderate":         h.Moderate,
			"isCompleted":      h.IsCompleted,
		})
	}

	card := &models.AIActionCard{
		Type:  "hazard_report_summary",
		Title: "Hazard Reports Summary",
		Data: map[string]interface{}{
			"total":          total,
			"openCount":      openCount,
			"completedCount": completedCount,
			"seriousCount":   seriousCount,
			"moderateCount":  moderateCount,
			"openHazards":    cardItems,
		},
	}

	return reply, card, nil
}

func (s *AIToolService) GetHazardReportDetails(ctx context.Context, query string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	q := strings.ToLower(strings.TrimSpace(query))

	hazards, err := s.dispatchRepo.ListHazardReports(ctx, "", nil, "")
	if err != nil {
		return "", nil, err
	}

	var matched []*models.HazardReport
	for _, h := range hazards {
		if strings.Contains(strings.ToLower(h.ReportedBy), q) ||
			strings.Contains(strings.ToLower(h.EventDescription), q) ||
			strings.Contains(strings.ToLower(h.EventLocation), q) ||
			strings.Contains(strings.ToLower(h.RouteName), q) ||
			strings.Contains(strings.ToLower(h.UnitNumber), q) ||
			strings.Contains(strings.ToLower(h.ID), q) {
			matched = append(matched, h)
		}
	}

	if len(matched) == 0 {
		if isFr {
			return fmt.Sprintf("🔍 Aucun rapport de danger trouvé correspondant à « **%s** ».", query), nil, nil
		}
		return fmt.Sprintf("🔍 No hazard reports found matching \"**%s**\".", query), nil, nil
	}

	if len(matched) == 1 {
		h := matched[0]
		riskStr := "Mineur (Minor)"
		if h.Serious {
			riskStr = "🔴 Grave (Serious)"
		} else if h.Moderate {
			riskStr = "🟠 Modéré (Moderate)"
		}

		var types []string
		if h.TrafficHazard {
			types = append(types, "Circulation (Traffic)")
		}
		if h.EquipmentHazard {
			types = append(types, "Équipement (Equipment)")
		}
		if h.SnowHazard {
			types = append(types, "Neige/Glace (Snow/Ice)")
		}
		if h.TrippingHazard {
			types = append(types, "Trébuchement (Tripping)")
		}
		if h.UnsafeAction || h.UnsafeCondition {
			types = append(types, "Presque-accident (Near Miss)")
		}

		statusStr := "En cours / Ouvert (Open)"
		if h.IsCompleted {
			statusStr = "Résolu / Terminé (Completed)"
		}

		var reply string
		if isFr {
			reply = fmt.Sprintf("🛡️ **Rapport de Sécurité / Danger : %s**\n\n"+
				"- **Identifiant** : `%s`\n"+
				"- **Signalé par** : **%s** (Superviseur : %s)\n"+
				"- **Date & Heure** : `%s`\n"+
				"- **Lieu de l'événement** : %s\n"+
				"- **Véhicule / Ligne** : Unité `%s` · Ligne `%s`\n"+
				"- **Évaluation du Risque** : **%s**\n"+
				"- **Catégorie(s)** : %s\n"+
				"- **Statut** : **%s**\n"+
				"- **Description** : %s\n",
				h.ID, h.ID, h.ReportedBy, h.Supervisor, h.EventTime, h.EventLocation,
				h.UnitNumber, h.RouteName, riskStr, strings.Join(types, ", "), statusStr, h.EventDescription)

			if h.ActionTaken != "" {
				reply += fmt.Sprintf("- **Mesure corrective prise** : %s\n", h.ActionTaken)
			}
			if h.AssignedTo != "" {
				reply += fmt.Sprintf("- **Assigné à** : %s\n", h.AssignedTo)
			}
		} else {
			reply = fmt.Sprintf("🛡️ **Hazard / Safety Report Details: %s**\n\n"+
				"- **ID**: `%s`\n"+
				"- **Reported by**: **%s** (Supervisor: %s)\n"+
				"- **Date & Time**: `%s`\n"+
				"- **Location**: %s\n"+
				"- **Vehicle / Route**: Unit `%s` · Route `%s`\n"+
				"- **Risk Level**: **%s**\n"+
				"- **Categories**: %s\n"+
				"- **Status**: **%s**\n"+
				"- **Description**: %s\n",
				h.ID, h.ID, h.ReportedBy, h.Supervisor, h.EventTime, h.EventLocation,
				h.UnitNumber, h.RouteName, riskStr, strings.Join(types, ", "), statusStr, h.EventDescription)

			if h.ActionTaken != "" {
				reply += fmt.Sprintf("- **Corrective Action Taken**: %s\n", h.ActionTaken)
			}
			if h.AssignedTo != "" {
				reply += fmt.Sprintf("- **Assigned to**: %s\n", h.AssignedTo)
			}
		}

		card := &models.AIActionCard{
			Type:  "hazard_report_details",
			Title: fmt.Sprintf("Hazard: %s", h.ID),
			Data: map[string]interface{}{
				"id":               h.ID,
				"reportedBy":       h.ReportedBy,
				"eventTime":        h.EventTime,
				"eventLocation":    h.EventLocation,
				"eventDescription": h.EventDescription,
				"unitNumber":       h.UnitNumber,
				"routeName":        h.RouteName,
				"risk":             riskStr,
				"isCompleted":      h.IsCompleted,
				"actionTaken":      h.ActionTaken,
			},
		}

		return reply, card, nil
	}

	// Multiple matches list
	items := make([]map[string]interface{}, 0, len(matched))
	var lines []string
	if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** signalements de danger :", len(matched))}
		for i, h := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... et %d autres signalements.", len(matched)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s** : Date `%s` · Signalé par : **%s** · Statut : %v",
				h.ID, h.EventTime, h.ReportedBy, h.IsCompleted))
			items = append(items, map[string]interface{}{
				"id":          h.ID,
				"reportedBy":  h.ReportedBy,
				"eventTime":   h.EventTime,
				"description": h.EventDescription,
				"isCompleted": h.IsCompleted,
			})
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** hazard reports:", len(matched))}
		for i, h := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... and %d more reports.", len(matched)-6))
				break
			}
			lines = append(lines, fmt.Sprintf("- **%s**: Date `%s` · Reported by: **%s** · Completed: %v",
				h.ID, h.EventTime, h.ReportedBy, h.IsCompleted))
			items = append(items, map[string]interface{}{
				"id":          h.ID,
				"reportedBy":  h.ReportedBy,
				"eventTime":   h.EventTime,
				"description": h.EventDescription,
				"isCompleted": h.IsCompleted,
			})
		}
	}

	card := &models.AIActionCard{
		Type:  "hazard_report_summary",
		Title: fmt.Sprintf("Hazard Reports (%d)", len(matched)),
		Data: map[string]interface{}{
			"count": len(matched),
			"items": items,
		},
	}

	return strings.Join(lines, "\n"), card, nil
}

// ============================================================================
// ROUTE SAFETY ASSESSMENTS TOOLS
// ============================================================================

func (s *AIToolService) GetRouteAssessmentSummary(ctx context.Context, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")

	assessments, err := s.dispatchRepo.ListRouteAssessments(ctx, "", "", nil, "")
	if err != nil {
		assessments = []*models.RouteAssessment{}
	}

	total := len(assessments)
	newRouteCount := 0
	changeRouteCount := 0
	flaggedConcernsCount := 0

	var recentAssessments []*models.RouteAssessment
	for _, a := range assessments {
		if a.AssessmentType == "0" {
			newRouteCount++
		} else {
			changeRouteCount++
		}

		hasConcern := a.VisibilityProblemCheck || a.HighwayStopConcernCheck || a.LocationProblemCheck ||
			a.UnsafeTurnaroundCheck || a.IntersectionCheck || a.RoadwayCheck || a.NonweatherRiskCheck ||
			a.WeatherRiskCheck || a.RouteAdjustCheck || a.SafetyConcernCheck

		if hasConcern {
			flaggedConcernsCount++
		}

		recentAssessments = append(recentAssessments, a)
	}

	var reply string
	if isFr {
		reply = fmt.Sprintf("🗺️ **Synthèse des Évaluations de Lignes & Audits de Sécurité** :\n\n"+
			"- **Total des évaluations enregistrées** : **%d**\n"+
			"- **Nouvelles lignes évaluées** : **%d** 🆕\n"+
			"- **Modifications de lignes auditées** : **%d** 🔄\n"+
			"- **Lignes avec réserves / alertes sécurité** : **%d** ⚠️\n",
			total, newRouteCount, changeRouteCount, flaggedConcernsCount)

		if len(recentAssessments) > 0 {
			reply += "\n📋 **Évaluations récentes** :\n"
			for i, a := range recentAssessments {
				if i >= 5 {
					reply += fmt.Sprintf("... et %d autre(s) évaluation(s).\n", len(recentAssessments)-5)
					break
				}
				dateStr := "N/A"
				if a.AssessmentDate != nil {
					dateStr = a.AssessmentDate.Format("2006-01-02")
				}
				reply += fmt.Sprintf("%d. **Ligne `%s`** (%s) · Date : `%s` · Conducteur : **%s**\n",
					i+1, a.RouteID, a.SchoolBoard, dateStr, a.ConductedByDriver)
			}
		}
	} else {
		reply = fmt.Sprintf("🗺️ **Route Safety Assessments & Audits Summary**:\n\n"+
			"- **Total Assessments Conducted**: **%d**\n"+
			"- **New Route Audits**: **%d** 🆕\n"+
			"- **Route Change Audits**: **%d** 🔄\n"+
			"- **Routes with Safety Concerns Flagged**: **%d** ⚠️\n",
			total, newRouteCount, changeRouteCount, flaggedConcernsCount)

		if len(recentAssessments) > 0 {
			reply += "\n📋 **Recent Route Assessments**:\n"
			for i, a := range recentAssessments {
				if i >= 5 {
					reply += fmt.Sprintf("... and %d more assessment(s).\n", len(recentAssessments)-5)
					break
				}
				dateStr := "N/A"
				if a.AssessmentDate != nil {
					dateStr = a.AssessmentDate.Format("2006-01-02")
				}
				reply += fmt.Sprintf("%d. **Route `%s`** (%s) · Date: `%s` · Evaluator: **%s**\n",
					i+1, a.RouteID, a.SchoolBoard, dateStr, a.ConductedByDriver)
			}
		}
	}

	cardItems := make([]map[string]interface{}, 0, len(recentAssessments))
	for _, a := range recentAssessments {
		dateStr := ""
		if a.AssessmentDate != nil {
			dateStr = a.AssessmentDate.Format("2006-01-02")
		}
		cardItems = append(cardItems, map[string]interface{}{
			"id":                a.ID,
			"routeId":           a.RouteID,
			"schoolBoard":       a.SchoolBoard,
			"school":            a.School,
			"assessmentType":    a.AssessmentType,
			"assessmentDate":    dateStr,
			"conductedByDriver": a.ConductedByDriver,
		})
	}

	card := &models.AIActionCard{
		Type:  "route_assessment_summary",
		Title: "Route Assessments Summary",
		Data: map[string]interface{}{
			"total":                total,
			"newRouteCount":        newRouteCount,
			"changeRouteCount":     changeRouteCount,
			"flaggedConcernsCount": flaggedConcernsCount,
			"items":                cardItems,
		},
	}

	return reply, card, nil
}

func (s *AIToolService) GetRouteAssessmentDetails(ctx context.Context, query string, lang string) (string, *models.AIActionCard, error) {
	isFr := strings.EqualFold(lang, "fr")
	q := strings.ToLower(strings.TrimSpace(query))

	assessments, err := s.dispatchRepo.ListRouteAssessments(ctx, "", "", nil, "")
	if err != nil {
		return "", nil, err
	}

	var matched []*models.RouteAssessment
	for _, a := range assessments {
		if strings.Contains(strings.ToLower(a.RouteID), q) ||
			strings.Contains(strings.ToLower(a.ConductedByDriver), q) ||
			strings.Contains(strings.ToLower(a.SchoolBoard), q) ||
			strings.Contains(strings.ToLower(a.School), q) ||
			strings.Contains(strings.ToLower(a.Summary), q) ||
			strings.Contains(strings.ToLower(a.ID), q) {
			matched = append(matched, a)
		}
	}

	if len(matched) == 0 {
		if isFr {
			return fmt.Sprintf("🔍 Aucune évaluation de ligne trouvée correspondant à « **%s** ».", query), nil, nil
		}
		return fmt.Sprintf("🔍 No route safety assessments found matching \"**%s**\".", query), nil, nil
	}

	if len(matched) == 1 {
		a := matched[0]
		typeStr := "Nouvelle ligne (New Route)"
		if a.AssessmentType == "1" {
			typeStr = "Modification de ligne (Route Change)"
		}

		dateStr := "N/A"
		if a.AssessmentDate != nil {
			dateStr = a.AssessmentDate.Format("2006-01-02")
		}

		var concerns []string
		if a.VisibilityProblemCheck {
			concerns = append(concerns, "Visibilité (Visibility)")
		}
		if a.HighwayStopConcernCheck {
			concerns = append(concerns, "Arrêt autoroute/voie rapide (Highway Stop)")
		}
		if a.LocationProblemCheck {
			concerns = append(concerns, "Emplacement d'embarquement (Loading Location)")
		}
		if a.UnsafeTurnaroundCheck {
			concerns = append(concerns, "Demi-tour dangereux (Unsafe Turnaround)")
		}
		if a.IntersectionCheck {
			concerns = append(concerns, "Intersection difficile (Intersection)")
		}
		if a.RoadwayCheck {
			concerns = append(concerns, "Voie inadéquate (Roadway Inadequacy)")
		}
		if a.NonweatherRiskCheck {
			concerns = append(concerns, "Risques hors météo (Non-weather Risk)")
		}
		if a.WeatherRiskCheck {
			concerns = append(concerns, "Risques météo (Weather Risk)")
		}
		if a.RouteAdjustCheck {
			concerns = append(concerns, "Ajustement d'itinéraire requis (Route Adjustment)")
		}
		if a.SafetyConcernCheck {
			concerns = append(concerns, "Alerte de sécurité générale (Safety Concern)")
		}

		concernSummary := "Aucune réserve majeure signalée (No concerns flagged)"
		if len(concerns) > 0 {
			concernSummary = strings.Join(concerns, ", ")
		}

		var reply string
		if isFr {
			reply = fmt.Sprintf("📍 **Évaluation de Sécurité de Ligne : %s**\n\n"+
				"- **Identifiant** : `%s`\n"+
				"- **Ligne** : `%s` (%s)\n"+
				"- **Commission scolaire** : %s · École : %s\n"+
				"- **Type d'évaluation** : **%s**\n"+
				"- **Date** : `%s`\n"+
				"- **Évaluateur / Conducteur** : **%s**\n"+
				"- **Alertes de sécurité signalées** : %s\n",
				a.RouteID, a.ID, a.RouteID, typeStr, a.SchoolBoard, a.School, typeStr, dateStr, a.ConductedByDriver, concernSummary)

			if a.Summary != "" {
				reply += fmt.Sprintf("- **Synthèse & Remarques** : %s\n", a.Summary)
			}
		} else {
			reply = fmt.Sprintf("📍 **Route Safety Assessment Details: %s**\n\n"+
				"- **ID**: `%s`\n"+
				"- **Route**: `%s` (%s)\n"+
				"- **School Board**: %s · School: %s\n"+
				"- **Assessment Type**: **%s**\n"+
				"- **Date**: `%s`\n"+
				"- **Evaluator / Driver**: **%s**\n"+
				"- **Safety Concerns Flagged**: %s\n",
				a.RouteID, a.ID, a.RouteID, typeStr, a.SchoolBoard, a.School, typeStr, dateStr, a.ConductedByDriver, concernSummary)

			if a.Summary != "" {
				reply += fmt.Sprintf("- **Summary & Notes**: %s\n", a.Summary)
			}
		}

		card := &models.AIActionCard{
			Type:  "route_assessment_details",
			Title: fmt.Sprintf("Assessment: %s", a.RouteID),
			Data: map[string]interface{}{
				"id":                a.ID,
				"routeId":           a.RouteID,
				"schoolBoard":       a.SchoolBoard,
				"school":            a.School,
				"assessmentType":    a.AssessmentType,
				"assessmentDate":    dateStr,
				"conductedByDriver": a.ConductedByDriver,
				"concerns":          concerns,
				"summary":           a.Summary,
			},
		}

		return reply, card, nil
	}

	// Multiple matches list
	items := make([]map[string]interface{}, 0, len(matched))
	var lines []string
	if isFr {
		lines = []string{fmt.Sprintf("Trouvé **%d** évaluations de ligne :", len(matched))}
		for i, a := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... et %d autres évaluations.", len(matched)-6))
				break
			}
			dateStr := "N/A"
			if a.AssessmentDate != nil {
				dateStr = a.AssessmentDate.Format("2006-01-02")
			}
			lines = append(lines, fmt.Sprintf("- **Ligne `%s`** : Date `%s` · Évaluateur : **%s** · Commission : %s",
				a.RouteID, dateStr, a.ConductedByDriver, a.SchoolBoard))
			items = append(items, map[string]interface{}{
				"id":             a.ID,
				"routeId":        a.RouteID,
				"schoolBoard":    a.SchoolBoard,
				"assessmentDate": dateStr,
			})
		}
	} else {
		lines = []string{fmt.Sprintf("Found **%d** route assessments:", len(matched))}
		for i, a := range matched {
			if i >= 6 {
				lines = append(lines, fmt.Sprintf("... and %d more assessments.", len(matched)-6))
				break
			}
			dateStr := "N/A"
			if a.AssessmentDate != nil {
				dateStr = a.AssessmentDate.Format("2006-01-02")
			}
			lines = append(lines, fmt.Sprintf("- **Route `%s`**: Date `%s` · Evaluator: **%s** · Board: %s",
				a.RouteID, dateStr, a.ConductedByDriver, a.SchoolBoard))
			items = append(items, map[string]interface{}{
				"id":             a.ID,
				"routeId":        a.RouteID,
				"schoolBoard":    a.SchoolBoard,
				"assessmentDate": dateStr,
			})
		}
	}

	card := &models.AIActionCard{
		Type:  "route_assessment_summary",
		Title: fmt.Sprintf("Route Assessments (%d)", len(matched)),
		Data: map[string]interface{}{
			"count": len(matched),
			"items": items,
		},
	}

	return strings.Join(lines, "\n"), card, nil
}



