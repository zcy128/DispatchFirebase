package services

import (
	"context"
	"sort"
	"strings"
	"time"
)

// StagingRouteView is a read-only route built from BusPlanner staging.
// It has shifts, stops, and students, and no crew assignment.
type StagingRouteView struct {
	ID            string               `json:"id"`
	RouteNo       string               `json:"routeNo"`
	RouteName     string               `json:"routeName"`
	OperatorID    string               `json:"operatorId"`
	Active        bool                 `json:"active"`
	Simulated     bool                 `json:"simulated,omitempty"`
	TotalStops    int                  `json:"totalStops"`
	TotalStudents int                  `json:"totalStudents"`
	ApplyWindows  []StagingApplyWindow `json:"applyWindows,omitempty"`
	Shifts        []StagingShiftView   `json:"shifts"`
}

// StagingShiftView is one BusPlanner run shown as a shift.
type StagingShiftView struct {
	ID            string            `json:"id"`
	ShiftType     string            `json:"shiftType"`
	RunDays       string            `json:"runDays"`
	Description   string            `json:"description"`
	Schools       string            `json:"schools"`
	Instruction   string            `json:"instruction"`
	EffectiveDate string            `json:"effectiveDate,omitempty"`
	ApplyDate     string            `json:"applyDate,omitempty"`
	ApplyTime     string            `json:"applyTime,omitempty"`
	RetireDate    string            `json:"retireDate,omitempty"`
	FirstStopTime string            `json:"firstStopTime"`
	LastStopTime  string            `json:"lastStopTime"`
	StopCount     int               `json:"stopCount"`
	StudentCount  int               `json:"studentCount"`
	Stops         []StagingStopView `json:"stops"`
}

// StagingStopView is one staged stop and the students who use it.
type StagingStopView struct {
	ID          string               `json:"id"`
	Sequence    int                  `json:"sequence"`
	Location    string               `json:"location"`
	Time        string               `json:"time"`
	StopType    string               `json:"stopType"`
	Instruction string               `json:"instruction,omitempty"`
	Latitude    string               `json:"latitude,omitempty"`
	Longitude   string               `json:"longitude,omitempty"`
	Students    []StagingStudentView `json:"students"`
}

// StagingStudentView is the rider shown on a staging stop. Medical fields are omitted.
type StagingStudentView struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Grade      string `json:"grade,omitempty"`
	SchoolName string `json:"schoolName,omitempty"`
}

// StagingRouteList is the payload for the staging route page.
type StagingRouteList struct {
	Routes        []StagingRouteView `json:"routes"`
	TotalRoutes   int                `json:"totalRoutes"`
	TotalShifts   int                `json:"totalShifts"`
	TotalStops    int                `json:"totalStops"`
	TotalStudents int                `json:"totalStudents"`
}

type stagingStudentRow struct {
	id         string
	name       string
	grade      string
	schoolID   string
	schoolName string
}

// ListStagingRoutes joins staged routes, runs, stops, and students.
// It does not read or write live route assignments.
func (s *BusPlannerService) ListStagingRoutes(ctx context.Context) (*StagingRouteList, error) {
	routes, err := s.store.ListStage(ctx, stageRoutes)
	if err != nil {
		return nil, err
	}
	runs, err := s.store.ListStage(ctx, stageRuns)
	if err != nil {
		return nil, err
	}
	stops, err := s.store.ListStage(ctx, stageStops)
	if err != nil {
		return nil, err
	}
	links, err := s.store.ListStage(ctx, stageStudentStops)
	if err != nil {
		return nil, err
	}
	students, err := s.store.ListStage(ctx, stageStudents)
	if err != nil {
		return nil, err
	}
	schools, err := s.store.ListStage(ctx, stageSchools)
	if err != nil {
		return nil, err
	}

	schoolNames := map[string]string{}
	for _, school := range schools {
		id := bpString(school, "schoolId")
		if id == "" {
			continue
		}
		schoolNames[id] = bpString(school, "name")
	}

	riders := map[string]stagingStudentRow{}
	for _, student := range students {
		guid := bpString(student, "studentGuid")
		if guid == "" {
			continue
		}
		schoolID := bpString(student, "schoolId")
		name := strings.TrimSpace(bpString(student, "firstName") + " " + bpString(student, "lastName"))
		if name == "" {
			name = bpString(student, "studentId")
		}
		riders[strings.ToLower(guid)] = stagingStudentRow{
			id:         bpString(student, "studentId"),
			name:       name,
			grade:      bpString(student, "grade"),
			schoolID:   schoolID,
			schoolName: schoolNames[schoolID],
		}
	}

	studentsByStop := map[string][]StagingStudentView{}
	for _, link := range links {
		if bpExplicitFalse(link, "active") {
			continue
		}
		stopID := bpString(link, "busStopId")
		guid := strings.ToLower(bpString(link, "studentGuid"))
		if stopID == "" {
			continue
		}
		rider, ok := riders[guid]
		view := StagingStudentView{ID: bpString(link, "studentId"), Name: bpString(link, "studentId")}
		if ok {
			if rider.id != "" {
				view.ID = rider.id
			}
			view.Name = rider.name
			view.Grade = rider.grade
			view.SchoolName = rider.schoolName
		}
		studentsByStop[stopID] = append(studentsByStop[stopID], view)
	}
	for stopID := range studentsByStop {
		sort.Slice(studentsByStop[stopID], func(i, j int) bool {
			return studentsByStop[stopID][i].Name < studentsByStop[stopID][j].Name
		})
	}

	stopsByRun := map[string][]StagingStopView{}
	daysByRun := map[string][]string{}
	for _, stop := range stops {
		if bpExplicitFalse(stop, "active") {
			continue
		}
		runID := bpString(stop, "runId")
		stopID := bpString(stop, "busStopId")
		if runID == "" || stopID == "" {
			continue
		}
		seq := 0
		if raw := bpString(stop, "stopOrder"); raw != "" {
			seq = atoiLoose(raw)
		}
		ridersOnStop := studentsByStop[stopID]
		if ridersOnStop == nil {
			ridersOnStop = []StagingStudentView{}
		}
		runKey := strings.ToLower(runID)
		if freq := bpString(stop, "frequency"); freq != "" {
			daysByRun[runKey] = append(daysByRun[runKey], freq)
		}
		stopsByRun[runKey] = append(stopsByRun[runKey], StagingStopView{
			ID:          stopID,
			Sequence:    seq,
			Location:    firstNonEmpty(bpString(stop, "description"), bpString(stop, "position"), stopID),
			Time:        clockOf(bpString(stop, "stopTime")),
			StopType:    stopTypeLabel(bpString(stop, "stopType")),
			Instruction: bpString(stop, "instruction"),
			Latitude:    bpString(stop, "latitude"),
			Longitude:   bpString(stop, "longitude"),
			Students:    ridersOnStop,
		})
	}

	runsByRoute := map[string][]StagingShiftView{}
	for _, run := range runs {
		if bpExplicitFalse(run, "active") {
			continue
		}
		routeKey := stagingRouteKey(bpString(run, "routeId"))
		runID := bpString(run, "runId")
		if routeKey == "" || runID == "" {
			continue
		}
		runStops := stopsByRun[strings.ToLower(runID)]
		if runStops == nil {
			runStops = []StagingStopView{}
		}
		sort.Slice(runStops, func(i, j int) bool {
			if runStops[i].Sequence != runStops[j].Sequence && runStops[i].Sequence > 0 && runStops[j].Sequence > 0 {
				return runStops[i].Sequence < runStops[j].Sequence
			}
			if runStops[i].Time != runStops[j].Time {
				return runStops[i].Time < runStops[j].Time
			}
			return runStops[i].ID < runStops[j].ID
		})
		for i := range runStops {
			if runStops[i].Sequence == 0 {
				runStops[i].Sequence = i + 1
			}
		}
		seenStudents := map[string]struct{}{}
		schoolSet := []string{}
		seenSchools := map[string]struct{}{}
		var times []string
		for _, stop := range runStops {
			if stop.Time != "" {
				times = append(times, stop.Time)
			}
			for _, student := range stop.Students {
				seenStudents[student.ID+"|"+student.Name] = struct{}{}
				if student.SchoolName != "" {
					if _, ok := seenSchools[student.SchoolName]; !ok {
						seenSchools[student.SchoolName] = struct{}{}
						schoolSet = append(schoolSet, student.SchoolName)
					}
				}
			}
		}
		sort.Strings(times)
		first, last := "", ""
		if len(times) > 0 {
			first = times[0]
			last = times[len(times)-1]
		}
		if first == "" {
			first = clockOf(bpString(run, "startTime"))
		}
		if last == "" {
			last = clockOf(bpString(run, "endTime"))
		}
		days := runDaysFrom(daysByRun[strings.ToLower(runID)])
		runsByRoute[routeKey] = append(runsByRoute[routeKey], StagingShiftView{
			ID:            runID,
			ShiftType:     stagingShiftType(run),
			RunDays:       days,
			Description:   bpString(run, "description"),
			Schools:       strings.Join(schoolSet, ", "),
			Instruction:   bpString(run, "instruction"),
			EffectiveDate: dateOnly(bpString(run, "effectiveDate")),
			RetireDate:    dateOnly(bpString(run, "retireDate")),
			FirstStopTime: first,
			LastStopTime:  last,
			StopCount:     len(runStops),
			StudentCount:  len(seenStudents),
			Stops:         runStops,
		})
	}

	list := &StagingRouteList{Routes: []StagingRouteView{}}
	uniqueStudents := map[string]struct{}{}
	for _, route := range routes {
		if bpExplicitFalse(route, "active") {
			continue
		}
		routeID := bpString(route, "routeId")
		if routeID == "" {
			continue
		}
		shifts := runsByRoute[routeID]
		if shifts == nil {
			shifts = []StagingShiftView{}
		}
		sort.Slice(shifts, func(i, j int) bool {
			oi, oj := shiftOrder(shifts[i].ShiftType), shiftOrder(shifts[j].ShiftType)
			if oi != oj {
				return oi < oj
			}
			return shifts[i].ID < shifts[j].ID
		})
		stopCount := 0
		routeStudents := map[string]struct{}{}
		for _, shift := range shifts {
			stopCount += shift.StopCount
			for _, stop := range shift.Stops {
				for _, student := range stop.Students {
					key := student.ID + "|" + student.Name
					routeStudents[key] = struct{}{}
					uniqueStudents[key] = struct{}{}
				}
			}
		}
		list.TotalShifts += len(shifts)
		list.TotalStops += stopCount
		routeNo := "CBE-" + routeID
		simulated := strings.HasPrefix(strings.ToUpper(routeID), "SIM") || strings.EqualFold(bpString(route, "source"), "simulation")
		if simulated {
			routeNo = routeID
		}
		view := StagingRouteView{
			ID:            routeID,
			RouteNo:       routeNo,
			RouteName:     bpString(route, "routeName"),
			OperatorID:    bpString(route, "operatorId"),
			Active:        true,
			Simulated:     simulated,
			TotalStops:    stopCount,
			TotalStudents: len(routeStudents),
			Shifts:        shifts,
		}
		attachApplyWindows(&view)
		list.Routes = append(list.Routes, view)
	}
	sort.Slice(list.Routes, func(i, j int) bool {
		return list.Routes[i].RouteNo < list.Routes[j].RouteNo
	})
	list.TotalRoutes = len(list.Routes)
	list.TotalStudents = len(uniqueStudents)
	return list, nil
}

func stagingRouteKey(routeID string) string {
	routeID = strings.TrimSpace(routeID)
	routeID = strings.TrimPrefix(strings.ToUpper(routeID), "CBE-")
	return routeID
}

func stagingShiftType(run map[string]any) string {
	blob := strings.ToUpper(bpString(run, "componentId") + " " + bpString(run, "runType") + " " + bpString(run, "description"))
	if strings.Contains(blob, "NOON") || strings.Contains(blob, "MID") {
		return "Midday"
	}
	if strings.Contains(blob, "PM") {
		return "PM"
	}
	return "AM"
}

func shiftOrder(shiftType string) int {
	switch strings.ToUpper(shiftType) {
	case "AM":
		return 1
	case "MIDDAY":
		return 2
	case "PM":
		return 3
	default:
		return 4
	}
}

func stopTypeLabel(raw string) string {
	switch strings.TrimSpace(raw) {
	case "0", "1":
		return "Home"
	case "2", "3":
		return "School"
	case "":
		return "Stop"
	default:
		return raw
	}
}

func runDaysFrom(freqs []string) string {
	seen := map[string]struct{}{}
	var out []string
	for _, freq := range freqs {
		freq = strings.TrimSpace(freq)
		if freq == "" {
			continue
		}
		if _, ok := seen[freq]; ok {
			continue
		}
		seen[freq] = struct{}{}
		out = append(out, freq)
	}
	if len(out) == 0 {
		return "MTWRF"
	}
	return strings.Join(out, ", ")
}

func clockOf(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	layouts := []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "15:04:05", "15:04"}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t.Format("15:04")
		}
	}
	if len(raw) >= 16 && raw[10] == 'T' {
		return raw[11:16]
	}
	if len(raw) >= 5 && raw[2] == ':' {
		return raw[:5]
	}
	return raw
}

func dateOnly(raw string) string {
	raw = strings.TrimSpace(raw)
	if len(raw) >= 10 {
		return raw[:10]
	}
	return raw
}

func atoiLoose(raw string) int {
	n := 0
	for _, r := range raw {
		if r < '0' || r > '9' {
			break
		}
		n = n*10 + int(r-'0')
	}
	return n
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
