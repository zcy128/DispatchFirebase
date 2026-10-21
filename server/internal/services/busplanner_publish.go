package services

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"log"
	"strconv"
	"strings"
	"time"

	"dispatch-server/internal/models"
)

const stagingPublishTime = "09:00"

var (
	ErrStagingRouteNotFound  = errors.New("staging route not found")
	ErrStagingRouteEmpty     = errors.New("staging route has no shifts")
	ErrLiveRoutesUnavailable = errors.New("live routes are not available")
)

// StagingApplyWindow is the morning before an effective date, 09:00 America/Toronto.
// An effective date of 2026-12-01 is applied on 2026-11-30 at 09:00.
type StagingApplyWindow struct {
	EffectiveDate string `json:"effectiveDate"`
	ApplyDate     string `json:"applyDate"`
	ApplyTime     string `json:"applyTime"`
}

// StagingCopyReport is the result of copying one staging route into live routes.
type StagingCopyReport struct {
	RouteID       string `json:"routeId"`
	RouteNo       string `json:"routeNo"`
	LiveRouteID   string `json:"liveRouteId"`
	Created       bool   `json:"created"`
	ShiftCount    int    `json:"shiftCount"`
	StopCount     int    `json:"stopCount"`
	StudentCount  int    `json:"studentCount"`
	CrewPreserved bool   `json:"crewPreserved"`
	Message       string `json:"message"`
}

// stagingLiveStore reads and writes live routes without changing crew fields on update.
type stagingLiveStore interface {
	FindRouteByNo(ctx context.Context, routeNo string) (*models.BusRoute, error)
	ListShifts(ctx context.Context, routeID string) ([]*models.BusRouteShift, error)
	CreateRoute(ctx context.Context, route *models.BusRoute) error
	UpdateRoutePattern(ctx context.Context, route *models.BusRoute) error
	CreateShift(ctx context.Context, shift *models.BusRouteShift) error
	UpdateShiftPattern(ctx context.Context, shift *models.BusRouteShift) error
}

func attachApplyWindows(route *StagingRouteView) {
	if route == nil {
		return
	}
	seen := map[string]StagingApplyWindow{}
	var keys []string
	for i := range route.Shifts {
		window, ok := stagingApplyWindow(route.Shifts[i].EffectiveDate)
		if !ok {
			continue
		}
		route.Shifts[i].ApplyDate = window.ApplyDate
		route.Shifts[i].ApplyTime = window.ApplyTime
		if _, exists := seen[window.EffectiveDate]; exists {
			continue
		}
		seen[window.EffectiveDate] = window
		keys = append(keys, window.EffectiveDate)
	}
	sortStrings(keys)
	for _, key := range keys {
		route.ApplyWindows = append(route.ApplyWindows, seen[key])
	}
}

func sortStrings(values []string) {
	for i := 1; i < len(values); i++ {
		for j := i; j > 0 && values[j] < values[j-1]; j-- {
			values[j], values[j-1] = values[j-1], values[j]
		}
	}
}

func stagingApplyWindow(effective string) (StagingApplyWindow, bool) {
	effective = strings.TrimSpace(effective)
	if len(effective) < 10 {
		return StagingApplyWindow{}, false
	}
	effective = effective[:10]
	day, err := time.Parse("2006-01-02", effective)
	if err != nil {
		return StagingApplyWindow{}, false
	}
	apply := day.AddDate(0, 0, -1)
	switch apply.Weekday() {
	case time.Saturday:
		apply = apply.AddDate(0, 0, -1)
	case time.Sunday:
		apply = apply.AddDate(0, 0, -2)
	}
	return StagingApplyWindow{
		EffectiveDate: effective,
		ApplyDate:     apply.Format("2006-01-02"),
		ApplyTime:     stagingPublishTime,
	}, true
}

func stagingApplyInstant(effective string, loc *time.Location) (time.Time, bool) {
	window, ok := stagingApplyWindow(effective)
	if !ok {
		return time.Time{}, false
	}
	day, err := time.ParseInLocation("2006-01-02", window.ApplyDate, loc)
	if err != nil {
		return time.Time{}, false
	}
	return time.Date(day.Year(), day.Month(), day.Day(), 9, 0, 0, 0, loc), true
}

// shiftDue is true from 09:00 Ottawa on the apply date through the effective
// date. The apply date is the day before the effective date, or the Friday
// before when that day falls on a weekend.
func shiftDue(effective string, now time.Time) bool {
	window, ok := stagingApplyWindow(effective)
	if !ok {
		return false
	}
	loc := busplannerLocation()
	local := now.In(loc)
	today := local.Format("2006-01-02")
	if today < window.ApplyDate || today > window.EffectiveDate {
		return false
	}
	if today == window.ApplyDate {
		at, ok := stagingApplyInstant(effective, loc)
		if !ok || local.Before(at) {
			return false
		}
	}
	return true
}

// CopyStagingRoute copies every staging shift, stop, and stop student for one
// route into the live route. Existing crew on the route and its shifts is kept.
func (s *BusPlannerService) CopyStagingRoute(ctx context.Context, routeID string) (*StagingCopyReport, error) {
	route, err := s.findStagingRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}
	report, err := s.copyRoute(ctx, route, false, s.clock())
	if err != nil {
		return nil, err
	}
	if report == nil {
		return nil, ErrStagingRouteEmpty
	}
	return report, nil
}

// RunScheduledPublish copies shifts whose effective date is tomorrow once
// Ottawa time reaches 09:00. It also catches up later that day and on the
// effective date if the process was down at 09:00. It does nothing while
// BusPlanner sync is turned off.
func (s *BusPlannerService) RunScheduledPublish(ctx context.Context) {
	if s.live == nil {
		return
	}
	secret, err := s.store.Load(ctx)
	if err != nil || !secret.Enabled {
		return
	}
	loc := busplannerLocation()
	now := s.clock().In(loc)
	if now.Format("15:04") < stagingPublishTime {
		return
	}
	day := now.Format("2006-01-02")
	s.mu.Lock()
	if s.publishing || s.lastPublishDay == day {
		s.mu.Unlock()
		return
	}
	s.publishing = true
	s.mu.Unlock()

	failed := false
	defer func() {
		s.mu.Lock()
		s.publishing = false
		if !failed {
			s.lastPublishDay = day
		}
		s.mu.Unlock()
	}()

	list, err := s.ListStagingRoutes(ctx)
	if err != nil {
		failed = true
		log.Printf("[BUSPLANNER] staging publish skipped: %v", err)
		return
	}
	for _, route := range list.Routes {
		if route.Simulated {
			continue
		}
		report, err := s.copyRoute(ctx, &route, true, s.clock())
		if err != nil {
			failed = true
			log.Printf("[BUSPLANNER] staging publish failed for %s: %v", route.RouteNo, err)
			continue
		}
		if report != nil && report.ShiftCount > 0 {
			log.Printf("[BUSPLANNER] %s", report.Message)
		}
	}
}

func (s *BusPlannerService) findStagingRoute(ctx context.Context, raw string) (*StagingRouteView, error) {
	list, err := s.ListStagingRoutes(ctx)
	if err != nil {
		return nil, err
	}
	key := stagingRouteKey(raw)
	needle := strings.TrimSpace(raw)
	for i := range list.Routes {
		route := &list.Routes[i]
		if stagingRouteKey(route.ID) == key || strings.EqualFold(route.RouteNo, needle) {
			return route, nil
		}
	}
	return nil, ErrStagingRouteNotFound
}

func (s *BusPlannerService) copyRoute(ctx context.Context, route *StagingRouteView, dueOnly bool, now time.Time) (*StagingCopyReport, error) {
	if s.live == nil {
		return nil, ErrLiveRoutesUnavailable
	}
	if route == nil {
		return nil, ErrStagingRouteNotFound
	}
	loc := busplannerLocation()
	today := now.In(loc).Format("2006-01-02")
	var selected []StagingShiftView
	for _, shift := range route.Shifts {
		if dueOnly && !shiftDue(shift.EffectiveDate, now) {
			continue
		}
		selected = append(selected, shift)
	}
	if len(selected) == 0 {
		if dueOnly {
			return nil, nil
		}
		return nil, ErrStagingRouteEmpty
	}

	existing, err := s.live.FindRouteByNo(ctx, route.RouteNo)
	if err != nil {
		return nil, err
	}
	created := existing == nil
	liveRoute := &models.BusRoute{}
	if existing != nil {
		copied := *existing
		liveRoute = &copied
	} else {
		liveRoute.ID = "RT-" + sanitizeDoc(route.RouteNo)
		liveRoute.RouteNo = route.RouteNo
		liveRoute.BusRouteId = atoiLoose(route.ID)
		liveRoute.SchoolBoardCode = "CBE"
		liveRoute.Active = true
		liveRoute.CreatedAt = now.UTC().Format(time.RFC3339)
	}
	if strings.TrimSpace(liveRoute.RouteName) == "" {
		liveRoute.RouteName = route.RouteName
	}
	if strings.TrimSpace(liveRoute.SchoolBoardCode) == "" {
		liveRoute.SchoolBoardCode = "CBE"
	}

	var shifts []*models.BusRouteShift
	if !created {
		shifts, err = s.live.ListShifts(ctx, liveRoute.ID)
		if err != nil {
			return nil, err
		}
	}

	crewPreserved := strings.TrimSpace(liveRoute.DriverName) != "" || strings.TrimSpace(liveRoute.UnitNumber) != "" || strings.TrimSpace(liveRoute.AttendantName) != ""
	stopCount := 0
	students := map[string]struct{}{}
	for _, stagingShift := range selected {
		future := stagingShift.EffectiveDate != "" && stagingShift.EffectiveDate > today
		docID := liveShiftDocID(route.RouteNo, stagingShift.ID, stagingShift.EffectiveDate, future)
		target, source := matchLiveShift(shifts, stagingShift, docID, future)
		built := buildLiveShift(liveRoute, stagingShift, docID)
		if target != nil {
			built.ID = target.ID
			built.ShiftID = target.ShiftID
			built.CreatedAt = target.CreatedAt
			keepShiftCrew(target, built)
			if err := s.live.UpdateShiftPattern(ctx, built); err != nil {
				return nil, err
			}
			replaceShift(shifts, built)
		} else {
			if source != nil {
				keepShiftCrew(source, built)
				crewPreserved = crewPreserved || strings.TrimSpace(source.DriverName) != "" || strings.TrimSpace(source.UnitNumber) != "" || strings.TrimSpace(source.AttendantName) != ""
			}
			built.CreatedAt = now.UTC().Format(time.RFC3339)
			if err := s.live.CreateShift(ctx, built); err != nil {
				return nil, err
			}
			shifts = append(shifts, built)
		}
		if future && source != nil && source.ID != built.ID {
			retire := dayBefore(stagingShift.EffectiveDate)
			if retire != "" && shouldRetire(source, retire) {
				retired := *source
				retired.RetireDate = &retire
				if err := s.live.UpdateShiftPattern(ctx, &retired); err != nil {
					return nil, err
				}
				replaceShift(shifts, &retired)
			}
		}
		stopCount += len(built.Stops)
		for _, stop := range built.Stops {
			for _, student := range stop.AssignedStudents {
				students[student.StudentNo+"|"+student.StudentName] = struct{}{}
			}
		}
	}

	summaries, totalStops, totalStudents := summarizeLiveShifts(shifts)
	liveRoute.Shifts = summaries
	liveRoute.TotalStops = totalStops
	liveRoute.TotalStudents = totalStudents
	liveRoute.Active = true
	liveRoute.UpdatedAt = now.UTC().Format(time.RFC3339)
	if created {
		if err := s.live.CreateRoute(ctx, liveRoute); err != nil {
			return nil, err
		}
	} else if err := s.live.UpdateRoutePattern(ctx, liveRoute); err != nil {
		return nil, err
	}

	report := &StagingCopyReport{
		RouteID:       route.ID,
		RouteNo:       route.RouteNo,
		LiveRouteID:   liveRoute.ID,
		Created:       created,
		ShiftCount:    len(selected),
		StopCount:     stopCount,
		StudentCount:  len(students),
		CrewPreserved: crewPreserved,
		Message: fmt.Sprintf(
			"Copied %d shifts, %d stops, and %d students from %s into the live route. Crew assignments were left unchanged.",
			len(selected), stopCount, len(students), route.RouteNo,
		),
	}
	return report, nil
}

func matchLiveShift(shifts []*models.BusRouteShift, staging StagingShiftView, docID string, future bool) (target, source *models.BusRouteShift) {
	var sameRun []*models.BusRouteShift
	var legacy []*models.BusRouteShift
	for _, shift := range shifts {
		if shift == nil {
			continue
		}
		if shift.ID == docID || strings.EqualFold(shift.BusplannerRunID, staging.ID) {
			sameRun = append(sameRun, shift)
		}
		if strings.TrimSpace(shift.BusplannerRunID) == "" && strings.EqualFold(shift.ShiftType, staging.ShiftType) {
			legacy = append(legacy, shift)
		}
	}
	if future {
		for _, shift := range sameRun {
			if shift.ID == docID || dateValue(shift.EffectiveDate) == staging.EffectiveDate {
				target = shift
				break
			}
		}
		for _, shift := range sameRun {
			if target != nil && shift.ID == target.ID {
				continue
			}
			if dateValue(shift.EffectiveDate) == "" || dateValue(shift.EffectiveDate) < staging.EffectiveDate {
				source = shift
				break
			}
		}
		if source == nil && len(legacy) == 1 && (target == nil || legacy[0].ID != target.ID) {
			source = legacy[0]
		}
		return target, source
	}
	for _, shift := range sameRun {
		target = shift
		break
	}
	if target == nil && len(legacy) == 1 {
		target = legacy[0]
	}
	return target, nil
}

func buildLiveShift(route *models.BusRoute, staging StagingShiftView, docID string) *models.BusRouteShift {
	active := true
	stops := make([]models.RouteStop, 0, len(staging.Stops))
	for _, stop := range staging.Stops {
		stopID := atoiLoose(stop.ID)
		if stopID == 0 {
			stopID = stop.Sequence
		}
		students := make([]models.StopStudent, 0, len(stop.Students))
		schoolName := ""
		for _, student := range stop.Students {
			name := strings.TrimSpace(student.Name)
			if name == "" {
				name = student.ID
			}
			students = append(students, models.StopStudent{
				StudentID:   atoiLoose(student.ID),
				StudentNo:   student.ID,
				StudentName: name,
				SchoolName:  student.SchoolName,
			})
			if schoolName == "" {
				schoolName = student.SchoolName
			}
		}
		stopType := liveStopType(stop.StopType)
		if stopType == "SchoolDropoff" && schoolName == "" {
			schoolName = stop.Location
		}
		built := models.RouteStop{
			StopID:           stopID,
			Sequence:         stop.Sequence,
			StopLocation:     stop.Location,
			PullawayTime:     stop.Time,
			StopType:         stopType,
			Latitude:         floatPtr(stop.Latitude),
			Longitude:        floatPtr(stop.Longitude),
			SchoolName:       schoolName,
			Instruction:      stop.Instruction,
			RunDays:          staging.RunDays,
			EffectiveDate:    stringPtr(staging.EffectiveDate),
			RetireDate:       stringPtr(staging.RetireDate),
			AssignedStudents: students,
		}
		stops = append(stops, built)
	}
	return &models.BusRouteShift{
		ID:              docID,
		ShiftID:         stableShiftID(staging.ID),
		RouteID:         route.ID,
		RouteNo:         route.RouteNo,
		RouteName:       route.RouteName,
		ShiftType:       staging.ShiftType,
		RunDays:         staging.RunDays,
		BusplannerRunID: staging.ID,
		Active:          &active,
		EffectiveDate:   stringPtr(staging.EffectiveDate),
		RetireDate:      stringPtr(staging.RetireDate),
		FirstStopTime:   staging.FirstStopTime,
		LastStopTime:    staging.LastStopTime,
		Stops:           stops,
		UpdatedAt:       time.Now().UTC().Format(time.RFC3339),
	}
}

func keepShiftCrew(from, to *models.BusRouteShift) {
	if from == nil || to == nil {
		return
	}
	to.IsCustomCrew = from.IsCustomCrew
	to.DriverID = from.DriverID
	to.DriverName = from.DriverName
	to.DriverPhone = from.DriverPhone
	to.VehicleID = from.VehicleID
	to.UnitNumber = from.UnitNumber
	to.PlateNumber = from.PlateNumber
	to.AttendantID = from.AttendantID
	to.AttendantName = from.AttendantName
	to.AttendantPhone = from.AttendantPhone
}

func shouldRetire(shift *models.BusRouteShift, retire string) bool {
	if shift == nil || retire == "" {
		return false
	}
	current := dateValue(shift.RetireDate)
	if current != "" && current <= retire {
		return false
	}
	effective := dateValue(shift.EffectiveDate)
	if effective != "" && effective > retire {
		return false
	}
	return current != retire
}

func replaceShift(shifts []*models.BusRouteShift, next *models.BusRouteShift) {
	for i, shift := range shifts {
		if shift != nil && shift.ID == next.ID {
			shifts[i] = next
			return
		}
	}
}

func summarizeLiveShifts(shifts []*models.BusRouteShift) ([]models.ShiftSummary, int, int) {
	ordered := append([]*models.BusRouteShift(nil), shifts...)
	for i := 1; i < len(ordered); i++ {
		for j := i; j > 0 && shiftSortBefore(ordered[j], ordered[j-1]); j-- {
			ordered[j], ordered[j-1] = ordered[j-1], ordered[j]
		}
	}
	summaries := make([]models.ShiftSummary, 0, len(ordered))
	totalStops := 0
	students := map[string]struct{}{}
	for _, shift := range ordered {
		if shift == nil {
			continue
		}
		studentCount := 0
		seen := map[string]struct{}{}
		for _, stop := range shift.Stops {
			for _, student := range stop.AssignedStudents {
				key := student.StudentNo + "|" + student.StudentName
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				students[key] = struct{}{}
				studentCount++
			}
		}
		totalStops += len(shift.Stops)
		summaries = append(summaries, models.ShiftSummary{
			ShiftID:       shift.ShiftID,
			ShiftType:     shift.ShiftType,
			RunDays:       shift.RunDays,
			FirstStopTime: shift.FirstStopTime,
			LastStopTime:  shift.LastStopTime,
			StopCount:     len(shift.Stops),
			StudentCount:  studentCount,
		})
	}
	return summaries, totalStops, len(students)
}

func shiftSortBefore(a, b *models.BusRouteShift) bool {
	if a == nil || b == nil {
		return a != nil
	}
	oa, ob := shiftOrder(a.ShiftType), shiftOrder(b.ShiftType)
	if oa != ob {
		return oa < ob
	}
	return a.ID < b.ID
}

func liveShiftDocID(routeNo, runID, effective string, future bool) string {
	id := "BP-" + sanitizeDoc(routeNo) + "-" + sanitizeDoc(runID)
	if future && strings.TrimSpace(effective) != "" {
		id += "-" + sanitizeDoc(effective)
	}
	return id
}

func sanitizeDoc(raw string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(raw) {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return "x"
	}
	return b.String()
}

func stableShiftID(runID string) int {
	hash := fnv.New32a()
	_, _ = hash.Write([]byte(strings.ToLower(strings.TrimSpace(runID))))
	n := int(hash.Sum32() & 0x7fffffff)
	if n == 0 {
		return 1
	}
	return n
}

func liveStopType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "home", "0", "1":
		return "HomePickup"
	case "school", "2", "3":
		return "SchoolDropoff"
	case "":
		return "Stop"
	default:
		return raw
	}
}

func dayBefore(effective string) string {
	effective = strings.TrimSpace(effective)
	if len(effective) < 10 {
		return ""
	}
	day, err := time.Parse("2006-01-02", effective[:10])
	if err != nil {
		return ""
	}
	return day.AddDate(0, 0, -1).Format("2006-01-02")
}

func dateValue(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func stringPtr(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func floatPtr(raw string) *float64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return nil
	}
	return &parsed
}
