package services

import (
	"context"
	"fmt"
	"log"
	"time"
)

const simulatedStagingRoutes = 5

type simRider struct {
	id    string
	first string
	last  string
	grade string
}

type simRouteSpec struct {
	id       string
	name     string
	school   string
	schoolID string
	lat      string
	lng      string
	riders   []simRider
}

// RunScheduledStagingSimulation replaces staging with five sample routes once
// each ISO week. It runs only in demo mode, and only while BusPlanner sync is off,
// so a real sync is never overwritten. Monday before 09:00 Ottawa time waits.
func (s *BusPlannerService) RunScheduledStagingSimulation(ctx context.Context) {
	if s == nil || !s.allowSim {
		return
	}
	secret, err := s.store.Load(ctx)
	if err != nil || secret.Enabled {
		return
	}
	now := s.clock().In(busplannerLocation())
	if !stagingSimDue(now) {
		return
	}
	week := stagingSimWeek(now) + ":2"
	if secret.LastStagingSimWeek == week {
		return
	}
	s.mu.Lock()
	if s.running || s.simulating {
		s.mu.Unlock()
		return
	}
	s.simulating = true
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		s.simulating = false
		s.mu.Unlock()
	}()

	if err := s.writeSimulatedStaging(ctx, now); err != nil {
		log.Printf("[BUSPLANNER] weekly staging sample failed: %v", err)
		return
	}
	secret.LastStagingSimWeek = week
	secret.UpdatedAt = now.UTC().Format(time.RFC3339)
	if err := s.store.Save(ctx, secret); err != nil {
		log.Printf("[BUSPLANNER] weekly staging sample was written but the week marker was not saved: %v", err)
		return
	}
	log.Printf("[BUSPLANNER] Saved %d simulated staging routes for %s. Live routes were not changed.", simulatedStagingRoutes, week)
}

func (s *BusPlannerService) writeSimulatedStaging(ctx context.Context, now time.Time) error {
	effective := nextMonday(now)
	updated := now.UTC().Format(time.RFC3339)
	routes := map[string]map[string]any{}
	runs := map[string]map[string]any{}
	schools := map[string]map[string]any{}
	stops := map[string]map[string]any{}
	links := map[string]map[string]any{}
	students := map[string]map[string]any{}

	for _, spec := range simulatedRouteCatalog() {
		routes[stageDocID(spec.id)] = map[string]any{
			"routeId":    spec.id,
			"routeName":  spec.name,
			"operatorId": busplannerDefaultOperator,
			"active":     true,
			"updatedAt":  updated,
			"source":     "simulation",
		}
		schools[stageDocID(spec.schoolID)] = map[string]any{
			"schoolId":        spec.schoolID,
			"name":            spec.school,
			"latitude":        spec.lat,
			"longitude":       spec.lng,
			"schoolBoardName": "CBE",
			"active":          true,
			"updatedAt":       updated,
			"source":          "simulation",
		}
		for _, rider := range spec.riders {
			guid := "sim-" + rider.id
			students[stageDocID(guid)] = map[string]any{
				"studentGuid": guid,
				"studentId":   rider.id,
				"firstName":   rider.first,
				"lastName":    rider.last,
				"schoolId":    spec.schoolID,
				"grade":       rider.grade,
				"active":      true,
				"updatedAt":   updated,
				"source":      "simulation",
			}
		}
		for _, shift := range []struct {
			suffix    string
			component string
			label     string
			times     []string
		}{
			{"AM", "AM", "Morning", []string{"07:20", "07:35", "08:05"}},
			{"PM", "PM", "PM", []string{"15:10", "15:30", "15:45"}},
		} {
			runID := spec.id + "-" + shift.suffix
			runs[stageDocID(runID)] = map[string]any{
				"runId":         runID,
				"routeId":       spec.id,
				"active":        true,
				"effectiveDate": effective,
				"componentId":   shift.component,
				"description":   spec.name + " " + shift.label,
				"updatedAt":     updated,
				"source":        "simulation",
			}
			stopPlans := []struct {
				seq      string
				kind     string
				name     string
				riderIdx int
			}{
				{"1", "0", spec.name + " home A", 0},
				{"2", "0", spec.name + " home B", 1},
				{"3", "2", spec.school, -1},
			}
			if shift.suffix == "PM" {
				stopPlans = []struct {
					seq      string
					kind     string
					name     string
					riderIdx int
				}{
					{"1", "2", spec.school, -1},
					{"2", "0", spec.name + " home B", 1},
					{"3", "0", spec.name + " home A", 0},
				}
			}
			for i, stop := range stopPlans {
				stopID := runID + "-" + stop.seq
				stops[stageDocID(stopID, "MTWRF")] = map[string]any{
					"busStopId":   stopID,
					"routeId":     spec.id,
					"runId":       runID,
					"active":      true,
					"stopType":    stop.kind,
					"stopTime":    effective + "T" + shift.times[i] + ":00",
					"description": stop.name,
					"frequency":   "MTWRF",
					"stopOrder":   stop.seq,
					"latitude":    spec.lat,
					"longitude":   spec.lng,
					"updatedAt":   updated,
					"source":      "simulation",
				}
				if stop.riderIdx < 0 || stop.riderIdx >= len(spec.riders) {
					continue
				}
				rider := spec.riders[stop.riderIdx]
				links[stageDocID(stopID, rider.id)] = map[string]any{
					"busStopId":   stopID,
					"studentId":   rider.id,
					"studentGuid": "sim-" + rider.id,
					"active":      true,
					"updatedAt":   updated,
					"source":      "simulation",
				}
			}
		}
	}

	for collection, docs := range map[string]map[string]map[string]any{
		stageRoutes:       routes,
		stageRuns:         runs,
		stageSchools:      schools,
		stageStops:        stops,
		stageStudentStops: links,
		stageStudents:     students,
	} {
		if err := s.store.ReplaceStage(ctx, collection, docs); err != nil {
			return err
		}
	}
	if len(routes) != simulatedStagingRoutes {
		return fmt.Errorf("simulated staging route count = %d", len(routes))
	}
	return nil
}

func simulatedRouteCatalog() []simRouteSpec {
	return []simRouteSpec{
		{id: "SIM1", name: "North Hill", school: "North Hill School", schoolID: "SIM-S1", lat: "51.074", lng: "-114.089", riders: []simRider{{"SIM1A", "Ada", "North", "4"}, {"SIM1B", "Ben", "North", "2"}}},
		{id: "SIM2", name: "Riverbend", school: "Riverbend School", schoolID: "SIM-S2", lat: "50.974", lng: "-114.015", riders: []simRider{{"SIM2A", "Cora", "River", "5"}, {"SIM2B", "Drew", "River", "3"}}},
		{id: "SIM3", name: "Acadia", school: "Acadia School", schoolID: "SIM-S3", lat: "50.970", lng: "-114.056", riders: []simRider{{"SIM3A", "Eden", "Acadia", "1"}, {"SIM3B", "Finn", "Acadia", "6"}}},
		{id: "SIM4", name: "Brentwood", school: "Brentwood School", schoolID: "SIM-S4", lat: "51.096", lng: "-114.128", riders: []simRider{{"SIM4A", "Greta", "Brent", "3"}, {"SIM4B", "Hugo", "Brent", "4"}}},
		{id: "SIM5", name: "Lakeview", school: "Lakeview School", schoolID: "SIM-S5", lat: "51.008", lng: "-114.103", riders: []simRider{{"SIM5A", "Iris", "Lake", "2"}, {"SIM5B", "Jules", "Lake", "5"}}},
	}
}

func stagingSimDue(now time.Time) bool {
	if now.Weekday() == time.Monday && now.Format("15:04") < stagingPublishTime {
		return false
	}
	return true
}

func stagingSimWeek(now time.Time) string {
	year, week := now.ISOWeek()
	return fmt.Sprintf("%04d-W%02d", year, week)
}

func nextMonday(now time.Time) string {
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	days := (int(time.Monday) - int(day.Weekday()) + 7) % 7
	if days == 0 {
		days = 7
	}
	return day.AddDate(0, 0, days).Format("2006-01-02")
}
