package services

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestListStagingRoutesJoinsShiftStopAndStudent(t *testing.T) {
	store := NewBusPlannerStore(nil)
	ctx := context.Background()
	mustStage(t, store, stageRoutes, map[string]map[string]any{
		"100": {"routeId": "100", "routeName": "North", "operatorId": "4S", "active": true, "vehicleId": "V1"},
	})
	mustStage(t, store, stageRuns, map[string]map[string]any{
		"100A": {"runId": "100A", "routeId": "CBE-100", "active": true, "componentId": "AM", "description": "Morning", "effectiveDate": "2026-09-01"},
		"100P": {"runId": "100P", "routeId": "CBE-100", "active": true, "componentId": "PM", "description": "Afternoon"},
	})
	mustStage(t, store, stageStops, map[string]map[string]any{
		"9": {"busStopId": "9", "runId": "100A", "routeId": "100", "active": true, "description": "North School", "stopTime": "2026-10-21T08:10:00", "stopType": "2", "stopOrder": "2", "frequency": "MTWRF"},
		"8": {"busStopId": "8", "runId": "100A", "routeId": "100", "active": true, "description": "Home Ada", "stopTime": "2026-10-21T07:40:00", "stopType": "0", "stopOrder": "1", "frequency": "MTWRF"},
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

	svc := NewBusPlannerService(store)
	list, err := svc.ListStagingRoutes(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if list.TotalRoutes != 1 || list.TotalShifts != 2 || list.TotalStops != 2 || list.TotalStudents != 1 {
		t.Fatalf("counts = %+v", list)
	}
	route := list.Routes[0]
	if route.RouteNo != "CBE-100" || len(route.Shifts) != 2 || route.Shifts[0].ShiftType != "AM" {
		t.Fatalf("route = %+v", route)
	}
	am := route.Shifts[0]
	if am.RunDays != "MTWRF" || am.StopCount != 2 || am.Stops[0].Location != "Home Ada" || am.Stops[0].Time != "07:40" {
		t.Fatalf("am shift = %+v", am)
	}
	if len(am.Stops[0].Students) != 1 || am.Stops[0].Students[0].Name != "Ada Kept" || am.Stops[0].Students[0].SchoolName != "North School" {
		t.Fatalf("students = %+v", am.Stops[0].Students)
	}
	if am.Schools != "North School" {
		t.Fatalf("schools = %q", am.Schools)
	}
	raw, _ := json.Marshal(list)
	if strings.Contains(string(raw), "clinic-note") || strings.Contains(string(raw), "driverName") || strings.Contains(string(raw), "\"vehicleId\"") {
		t.Fatalf("staging view exposed assignment or medical data: %s", raw)
	}
}

func mustStage(t *testing.T, store *BusPlannerStore, collection string, docs map[string]map[string]any) {
	t.Helper()
	if err := store.ReplaceStage(context.Background(), collection, docs); err != nil {
		t.Fatal(err)
	}
}
