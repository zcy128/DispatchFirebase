package services

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"dispatch-server/internal/models"
)

func TestShiftEffectiveDecemberFirstAppliesNovemberThirtiethAtNine(t *testing.T) {
	window, ok := stagingApplyWindow("2026-12-01")
	if !ok {
		t.Fatal("expected apply window")
	}
	if window.ApplyDate != "2026-11-30" || window.ApplyTime != "09:00" {
		t.Fatalf("window = %+v", window)
	}
	loc := busplannerLocation()
	before := time.Date(2026, 11, 30, 8, 59, 0, 0, loc)
	atNine := time.Date(2026, 11, 30, 9, 0, 0, 0, loc)
	effectiveDay := time.Date(2026, 12, 1, 10, 0, 0, 0, loc)
	dayAfter := time.Date(2026, 12, 2, 9, 0, 0, 0, loc)
	if shiftDue("2026-12-01", before) || !shiftDue("2026-12-01", atNine) || !shiftDue("2026-12-01", effectiveDay) || shiftDue("2026-12-01", dayAfter) {
		t.Fatalf("due window mismatch before=%v at=%v day=%v after=%v", shiftDue("2026-12-01", before), shiftDue("2026-12-01", atNine), shiftDue("2026-12-01", effectiveDay), shiftDue("2026-12-01", dayAfter))
	}
}

func TestWeekendBeforeEffectiveDateMovesApplyToFridayMorning(t *testing.T) {
	monday, ok := stagingApplyWindow("2026-11-30")
	if !ok || monday.ApplyDate != "2026-11-27" || monday.ApplyTime != "09:00" {
		t.Fatalf("monday window = %+v ok=%v", monday, ok)
	}
	sunday, ok := stagingApplyWindow("2026-11-29")
	if !ok || sunday.ApplyDate != "2026-11-27" {
		t.Fatalf("sunday window = %+v ok=%v", sunday, ok)
	}
	saturday, ok := stagingApplyWindow("2026-11-28")
	if !ok || saturday.ApplyDate != "2026-11-27" {
		t.Fatalf("saturday window = %+v ok=%v", saturday, ok)
	}
	if dayBefore("2026-11-30") != "2026-11-29" {
		t.Fatalf("retire date = %s", dayBefore("2026-11-30"))
	}
	loc := busplannerLocation()
	thursday := time.Date(2026, 11, 26, 9, 0, 0, 0, loc)
	fridayBefore := time.Date(2026, 11, 27, 8, 59, 0, 0, loc)
	fridayAt := time.Date(2026, 11, 27, 9, 0, 0, 0, loc)
	saturdayMorning := time.Date(2026, 11, 28, 10, 0, 0, 0, loc)
	if shiftDue("2026-11-30", thursday) || shiftDue("2026-11-30", fridayBefore) || !shiftDue("2026-11-30", fridayAt) || !shiftDue("2026-11-30", saturdayMorning) {
		t.Fatalf("friday window mismatch thu=%v before=%v at=%v sat=%v", shiftDue("2026-11-30", thursday), shiftDue("2026-11-30", fridayBefore), shiftDue("2026-11-30", fridayAt), shiftDue("2026-11-30", saturdayMorning))
	}
}

func TestCopyStagingRouteKeepsCrewAndStagesFutureShift(t *testing.T) {
	store := NewBusPlannerStore(nil)
	seedStagingRoute(t, store)
	live := newMemoryLive()
	live.routes["CBE-100"] = &models.BusRoute{
		ID: "RT-100", RouteNo: "CBE-100", RouteName: "North", DriverName: "Pat Driver", UnitNumber: "12",
	}
	live.shifts["RT-100"] = []*models.BusRouteShift{{
		ID: "SHIFT-100-AM", ShiftID: 100, RouteID: "RT-100", RouteNo: "CBE-100", ShiftType: "AM",
		RunDays: "MTWRF", DriverName: "Pat Driver", IsCustomCrew: true, UnitNumber: "12",
		Stops: []models.RouteStop{{StopID: 1, Sequence: 1, StopLocation: "Old stop", PullawayTime: "07:00"}},
	}}
	svc := NewBusPlannerService(store)
	svc.SetLiveStore(live)
	loc := busplannerLocation()
	svc.now = func() time.Time { return time.Date(2026, 11, 1, 12, 0, 0, 0, loc) }

	report, err := svc.CopyStagingRoute(context.Background(), "100")
	if err != nil {
		t.Fatal(err)
	}
	if report.ShiftCount != 2 || report.StopCount != 1 || report.Created || !report.CrewPreserved {
		t.Fatalf("report = %+v", report)
	}
	route := live.routes["CBE-100"]
	if route.DriverName != "Pat Driver" || route.UnitNumber != "12" {
		t.Fatalf("route crew changed: %+v", route)
	}
	if len(live.shifts["RT-100"]) != 3 {
		t.Fatalf("shifts = %d", len(live.shifts["RT-100"]))
	}
	var future, current *models.BusRouteShift
	for _, shift := range live.shifts["RT-100"] {
		if shift.BusplannerRunID == "100A" {
			future = shift
		}
		if shift.ID == "SHIFT-100-AM" {
			current = shift
		}
	}
	if future == nil || future.EffectiveDate == nil || *future.EffectiveDate != "2026-12-01" {
		t.Fatalf("future shift = %+v", future)
	}
	if future.DriverName != "Pat Driver" || !future.IsCustomCrew {
		t.Fatalf("future crew = %+v", future)
	}
	if len(future.Stops) != 1 || future.Stops[0].StopLocation != "Home Ada" || len(future.Stops[0].AssignedStudents) != 1 || future.Stops[0].AssignedStudents[0].StudentName != "Ada Kept" {
		t.Fatalf("future stops = %+v", future.Stops)
	}
	if current == nil || current.RetireDate == nil || *current.RetireDate != "2026-11-30" || current.Stops[0].StopLocation != "Old stop" {
		t.Fatalf("current shift = %+v", current)
	}
	raw := future.Stops[0].AssignedStudents[0].StudentName + future.DriverName
	if strings.Contains(raw, "clinic-note") {
		t.Fatal("medical detail was copied")
	}

	again, err := svc.CopyStagingRoute(context.Background(), "100")
	if err != nil {
		t.Fatal(err)
	}
	if again.ShiftCount != 2 || len(live.shifts["RT-100"]) != 3 {
		t.Fatalf("second copy duplicated shifts: %+v len=%d", again, len(live.shifts["RT-100"]))
	}
}

func TestScheduledPublishStaysOffWhenSyncIsDisabled(t *testing.T) {
	store := NewBusPlannerStore(nil)
	seedStagingRoute(t, store)
	live := newMemoryLive()
	svc := NewBusPlannerService(store)
	svc.SetLiveStore(live)
	loc := busplannerLocation()
	svc.now = func() time.Time { return time.Date(2026, 11, 30, 9, 0, 0, 0, loc) }
	svc.RunScheduledPublish(context.Background())
	if len(live.routes) != 0 {
		t.Fatal("disabled sync published a live route")
	}
}

func TestScheduledPublishCopiesOnlyTheShiftDueThatMorning(t *testing.T) {
	store := NewBusPlannerStore(nil)
	seedStagingRoute(t, store)
	if err := store.Save(context.Background(), busplannerSecret{Enabled: true, Username: "user", Password: "not-sent", BaseURL: "https://example.test"}); err != nil {
		t.Fatal(err)
	}
	live := newMemoryLive()
	svc := NewBusPlannerService(store)
	svc.SetLiveStore(live)
	loc := busplannerLocation()
	svc.now = func() time.Time { return time.Date(2026, 11, 30, 8, 59, 0, 0, loc) }
	svc.RunScheduledPublish(context.Background())
	if len(live.routes) != 0 {
		t.Fatal("publish ran before 09:00")
	}
	svc.now = func() time.Time { return time.Date(2026, 11, 30, 9, 0, 0, 0, loc) }
	svc.RunScheduledPublish(context.Background())
	route := live.routes["CBE-100"]
	if route == nil {
		t.Fatal("expected live route")
	}
	if len(live.shifts[route.ID]) != 1 || live.shifts[route.ID][0].BusplannerRunID != "100A" {
		t.Fatalf("shifts = %+v", live.shifts[route.ID])
	}
	svc.RunScheduledPublish(context.Background())
	if len(live.shifts[route.ID]) != 1 {
		t.Fatalf("second publish duplicated shifts: %d", len(live.shifts[route.ID]))
	}
}

func seedStagingRoute(t *testing.T, store *BusPlannerStore) {
	t.Helper()
	mustStage(t, store, stageRoutes, map[string]map[string]any{
		"100": {"routeId": "100", "routeName": "North", "operatorId": "4S", "active": true},
	})
	mustStage(t, store, stageRuns, map[string]map[string]any{
		"100A": {"runId": "100A", "routeId": "CBE-100", "active": true, "componentId": "AM", "description": "Morning", "effectiveDate": "2026-12-01"},
		"100P": {"runId": "100P", "routeId": "CBE-100", "active": true, "componentId": "PM", "description": "Later", "effectiveDate": "2027-03-01"},
	})
	mustStage(t, store, stageStops, map[string]map[string]any{
		"8": {"busStopId": "8", "runId": "100A", "routeId": "100", "active": true, "description": "Home Ada", "stopTime": "2026-12-01T07:40:00", "stopType": "0", "stopOrder": "1", "frequency": "MTWRF"},
	})
	mustStage(t, store, stageStudentStops, map[string]map[string]any{
		"8_77": {"busStopId": "8", "studentId": "77", "studentGuid": "guid-ada", "active": true},
	})
	mustStage(t, store, stageStudents, map[string]map[string]any{
		"guid-ada": {"studentGuid": "guid-ada", "studentId": "77", "firstName": "Ada", "lastName": "Kept", "schoolId": "S1", "grade": "3", "medicalDetail": "clinic-note"},
	})
	mustStage(t, store, stageSchools, map[string]map[string]any{
		"S1": {"schoolId": "S1", "name": "North School"},
	})
}

type memoryLive struct {
	routes map[string]*models.BusRoute
	shifts map[string][]*models.BusRouteShift
}

func newMemoryLive() *memoryLive {
	return &memoryLive{
		routes: map[string]*models.BusRoute{},
		shifts: map[string][]*models.BusRouteShift{},
	}
}

func (m *memoryLive) FindRouteByNo(_ context.Context, routeNo string) (*models.BusRoute, error) {
	route := m.routes[routeNo]
	if route == nil {
		return nil, nil
	}
	copied := *route
	return &copied, nil
}

func (m *memoryLive) ListShifts(_ context.Context, routeID string) ([]*models.BusRouteShift, error) {
	var out []*models.BusRouteShift
	for _, shift := range m.shifts[routeID] {
		copied := *shift
		out = append(out, &copied)
	}
	return out, nil
}

func (m *memoryLive) CreateRoute(_ context.Context, route *models.BusRoute) error {
	copied := *route
	m.routes[route.RouteNo] = &copied
	return nil
}

func (m *memoryLive) UpdateRoutePattern(_ context.Context, route *models.BusRoute) error {
	current := m.routes[route.RouteNo]
	if current == nil {
		return m.CreateRoute(context.Background(), route)
	}
	current.RouteName = route.RouteName
	current.Active = route.Active
	current.Shifts = route.Shifts
	current.TotalStops = route.TotalStops
	current.TotalStudents = route.TotalStudents
	current.UpdatedAt = route.UpdatedAt
	return nil
}

func (m *memoryLive) CreateShift(_ context.Context, shift *models.BusRouteShift) error {
	copied := *shift
	m.shifts[shift.RouteID] = append(m.shifts[shift.RouteID], &copied)
	return nil
}

func (m *memoryLive) UpdateShiftPattern(_ context.Context, shift *models.BusRouteShift) error {
	list := m.shifts[shift.RouteID]
	for i, existing := range list {
		if existing.ID != shift.ID {
			continue
		}
		next := *shift
		next.DriverID = existing.DriverID
		next.DriverName = existing.DriverName
		next.DriverPhone = existing.DriverPhone
		next.VehicleID = existing.VehicleID
		next.UnitNumber = existing.UnitNumber
		next.PlateNumber = existing.PlateNumber
		next.AttendantID = existing.AttendantID
		next.AttendantName = existing.AttendantName
		next.AttendantPhone = existing.AttendantPhone
		next.IsCustomCrew = existing.IsCustomCrew
		list[i] = &next
		m.shifts[shift.RouteID] = list
		return nil
	}
	return ErrShiftPatternMissing
}

var ErrShiftPatternMissing = errors.New("shift not found")
