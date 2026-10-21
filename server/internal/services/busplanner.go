package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	busplannerDefaultBase     = "https://school.mybusplanner.ca"
	busplannerDefaultOperator = "4S"
	busplannerMaxSyncTimes    = 8
	busplannerPreviewLimit    = 8
	busplannerMaxPages        = 300
)

// BusPlannerSettings is the admin-facing view. The password is never included.
type BusPlannerSettings struct {
	Enabled              bool     `json:"enabled"`
	BaseURL              string   `json:"baseUrl"`
	Username             string   `json:"username"`
	PasswordConfigured   bool     `json:"passwordConfigured"`
	OperatorID           string   `json:"operatorId"`
	SyncTimes            []string `json:"syncTimes"`
	LastSyncAt           string   `json:"lastSyncAt,omitempty"`
	LastRouteCount       int      `json:"lastRouteCount"`
	LastRunCount         int      `json:"lastRunCount"`
	LastSchoolCount      int      `json:"lastSchoolCount"`
	LastStopCount        int      `json:"lastStopCount"`
	LastStudentStopCount int      `json:"lastStudentStopCount"`
	LastStudentCount     int      `json:"lastStudentCount"`
	UpdatedAt            string   `json:"updatedAt,omitempty"`
}

// BusPlannerSave is the write payload. An empty password keeps the stored password.
type BusPlannerSave struct {
	Enabled    bool     `json:"enabled"`
	BaseURL    string   `json:"baseUrl"`
	Username   string   `json:"username"`
	Password   string   `json:"password"`
	OperatorID string   `json:"operatorId"`
	SyncTimes  []string `json:"syncTimes"`
}

// BusPlannerSyncReport describes a staging write. Live dispatch records are not changed.
type BusPlannerSyncReport struct {
	Persisted        bool     `json:"persisted"`
	StagingOnly      bool     `json:"stagingOnly"`
	LiveUpdated      bool     `json:"liveUpdated"`
	RouteCount       int      `json:"routeCount"`
	RunCount         int      `json:"runCount"`
	SchoolCount      int      `json:"schoolCount"`
	StopCount        int      `json:"stopCount"`
	StudentStopCount int      `json:"studentStopCount"`
	StudentCount     int      `json:"studentCount"`
	Preview          []string `json:"preview"`
	SyncedAt         string   `json:"syncedAt"`
	Message          string   `json:"message"`
}

type busplannerSecret struct {
	Enabled              bool     `json:"-" firestore:"enabled"`
	BaseURL              string   `json:"-" firestore:"baseUrl"`
	Username             string   `json:"-" firestore:"username"`
	Password             string   `json:"-" firestore:"password"`
	OperatorID           string   `json:"-" firestore:"operatorId"`
	SyncTimes            []string `json:"-" firestore:"syncTimes"`
	CompletedSlots       []string `json:"-" firestore:"completedSlots"`
	LastSyncAt           string   `json:"-" firestore:"lastSyncAt"`
	LastRouteCount       int      `json:"-" firestore:"lastRouteCount"`
	LastRunCount         int      `json:"-" firestore:"lastRunCount"`
	LastSchoolCount      int      `json:"-" firestore:"lastSchoolCount"`
	LastStopCount        int      `json:"-" firestore:"lastStopCount"`
	LastStudentStopCount int      `json:"-" firestore:"lastStudentStopCount"`
	LastStudentCount     int      `json:"-" firestore:"lastStudentCount"`
	LastStagingSimWeek   string   `json:"-" firestore:"lastStagingSimWeek"`
	UpdatedAt            string   `json:"-" firestore:"updatedAt"`
}

func (s busplannerSecret) public() BusPlannerSettings {
	times := append([]string(nil), s.SyncTimes...)
	if times == nil {
		times = []string{}
	}
	base := strings.TrimSpace(s.BaseURL)
	if base == "" {
		base = busplannerDefaultBase
	}
	return BusPlannerSettings{
		Enabled:              s.Enabled,
		BaseURL:              base,
		Username:             s.Username,
		PasswordConfigured:   strings.TrimSpace(s.Password) != "",
		OperatorID:           s.OperatorID,
		SyncTimes:            times,
		LastSyncAt:           s.LastSyncAt,
		LastRouteCount:       s.LastRouteCount,
		LastRunCount:         s.LastRunCount,
		LastSchoolCount:      s.LastSchoolCount,
		LastStopCount:        s.LastStopCount,
		LastStudentStopCount: s.LastStudentStopCount,
		LastStudentCount:     s.LastStudentCount,
		UpdatedAt:            s.UpdatedAt,
	}
}

func (s busplannerSecret) ready() bool {
	return strings.TrimSpace(s.Username) != "" && strings.TrimSpace(s.Password) != "" && strings.TrimSpace(s.BaseURL) != ""
}

// BusPlannerService reads BusPlanner into staging. Live routes change only when a
// staging shift is copied, manually or at 09:00 America/Toronto on the day before
// its effective date.
type BusPlannerService struct {
	store  busplannerStore
	client *http.Client
	live   stagingLiveStore
	now    func() time.Time

	mu             sync.Mutex
	running        bool
	publishing     bool
	simulating     bool
	allowSim       bool
	lastPublishDay string
	token          string
	tokenUtil      time.Time
}

func NewBusPlannerService(store busplannerStore) *BusPlannerService {
	return &BusPlannerService{
		store:  store,
		client: &http.Client{Timeout: 45 * time.Second},
		now:    time.Now,
	}
}

// SetLiveStore enables copying staging shifts into the live route collections.
func (s *BusPlannerService) SetLiveStore(live stagingLiveStore) {
	s.live = live
}

// AllowStagingSimulation turns on the weekly five-route sample while BusPlanner sync is off.
func (s *BusPlannerService) AllowStagingSimulation(allow bool) {
	s.allowSim = allow
}

func (s *BusPlannerService) clock() time.Time {
	if s.now != nil {
		return s.now()
	}
	return time.Now()
}

func (s *BusPlannerService) GetSettings(ctx context.Context) (BusPlannerSettings, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return BusPlannerSettings{}, err
	}
	return secret.public(), nil
}

func (s *BusPlannerService) SaveSettings(ctx context.Context, in BusPlannerSave) (BusPlannerSettings, error) {
	base, err := normalizeBusPlannerBase(in.BaseURL)
	if err != nil {
		return BusPlannerSettings{}, err
	}
	operator := strings.TrimSpace(in.OperatorID)
	if operator == "" {
		operator = busplannerDefaultOperator
	}
	times, err := normalizeBusPlannerTimes(in.SyncTimes)
	if err != nil {
		return BusPlannerSettings{}, err
	}
	current, err := s.store.Load(ctx)
	if err != nil {
		return BusPlannerSettings{}, err
	}
	next := current
	next.Enabled = in.Enabled
	next.BaseURL = base
	next.Username = strings.TrimSpace(in.Username)
	next.OperatorID = operator
	next.SyncTimes = times
	next.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if strings.TrimSpace(in.Password) != "" {
		next.Password = strings.TrimSpace(in.Password)
	}
	if in.Enabled {
		if next.Username == "" || strings.TrimSpace(next.Password) == "" {
			return BusPlannerSettings{}, fmt.Errorf("username and password are required when sync is enabled")
		}
		if len(next.SyncTimes) == 0 {
			return BusPlannerSettings{}, fmt.Errorf("at least one sync time is required when sync is enabled")
		}
	}
	if err := s.store.Save(ctx, next); err != nil {
		return BusPlannerSettings{}, err
	}
	return next.public(), nil
}

func (s *BusPlannerService) SyncNow(ctx context.Context) (*BusPlannerSyncReport, error) {
	now := time.Now().In(busplannerLocation())
	secret, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	return s.syncIntoStaging(ctx, now, dueSlots(secret.SyncTimes, now))
}

func (s *BusPlannerService) RunScheduledSync(ctx context.Context) {
	s.runScheduledSyncAt(ctx, time.Now().In(busplannerLocation()))
}

func (s *BusPlannerService) runScheduledSyncAt(ctx context.Context, now time.Time) {
	secret, err := s.store.Load(ctx)
	if err != nil || !secret.Enabled || !secret.ready() {
		return
	}
	due := dueSlots(secret.SyncTimes, now)
	pending := make([]string, 0, len(due))
	today := now.Format("2006-01-02")
	done := map[string]struct{}{}
	for _, slot := range secret.CompletedSlots {
		done[slot] = struct{}{}
	}
	for _, slot := range due {
		if _, ok := done[today+" "+slot]; !ok {
			pending = append(pending, slot)
		}
	}
	if len(pending) == 0 {
		return
	}
	if _, err := s.syncIntoStaging(ctx, now, pending); err != nil {
		log.Printf("[BUSPLANNER] scheduled sync failed: %s", err.Error())
	}
}

func dueSlots(times []string, now time.Time) []string {
	clock := now.Format("15:04")
	var due []string
	for _, slot := range times {
		if clock >= slot {
			due = append(due, slot)
		}
	}
	return due
}

func (s *BusPlannerService) syncIntoStaging(ctx context.Context, now time.Time, markSlots []string) (*BusPlannerSyncReport, error) {
	s.mu.Lock()
	if s.running || s.simulating {
		s.mu.Unlock()
		return nil, fmt.Errorf("BusPlanner sync is already running")
	}
	s.running = true
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	secret, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !secret.Enabled {
		return nil, fmt.Errorf("BusPlanner sync is turned off")
	}
	if !secret.ready() {
		return nil, fmt.Errorf("BusPlanner username and password are required")
	}

	token, err := s.accessToken(ctx, secret)
	if err != nil {
		return nil, err
	}
	operator := secret.OperatorID
	if operator == "" {
		operator = busplannerDefaultOperator
	}
	updated := now.UTC().Format(time.RFC3339)

	routes, err := s.getList(ctx, secret.BaseURL, token, "/Rest/api/Route/GetAll?packageSize=800")
	if err != nil {
		return nil, fmt.Errorf("routes: %w", err)
	}
	routeDocs := map[string]map[string]any{}
	routeIDs := map[string]struct{}{}
	var preview []string
	for _, row := range routes {
		routeID := bpString(row, "RouteID")
		op := bpString(row, "OperatorID")
		if routeID == "" || !strings.EqualFold(op, operator) {
			continue
		}
		id := stageDocID(routeID)
		if id == "" {
			continue
		}
		routeIDs[routeID] = struct{}{}
		routeDocs[id] = map[string]any{
			"routeId":      routeID,
			"routeName":    bpString(row, "Description"),
			"operatorId":   op,
			"vehicleId":    bpString(row, "VehicleID"),
			"createdDate":  bpString(row, "CreatedDate"),
			"modifiedDate": bpString(row, "ModifiedDate"),
			"active":       true,
			"updatedAt":    updated,
			"source":       "busplanner",
		}
		if len(preview) < busplannerPreviewLimit {
			preview = append(preview, routeID)
		}
	}
	if err := s.store.ReplaceStage(ctx, stageRoutes, routeDocs); err != nil {
		return nil, err
	}

	runs, err := s.getList(ctx, secret.BaseURL, token, "/Rest/api/Run/GetAll?packageSize=8000&includeRunPoints=false")
	if err != nil {
		return nil, fmt.Errorf("runs: %w", err)
	}
	runDocs := map[string]map[string]any{}
	for _, row := range runs {
		routeID := bpString(row, "RouteID")
		runID := strings.TrimSpace(bpString(row, "RunID"))
		if runID == "" {
			continue
		}
		if _, ok := routeIDs[routeID]; !ok || bpExplicitFalse(row, "Active") {
			continue
		}
		id := stageDocID(runID)
		if id == "" {
			continue
		}
		runDocs[id] = map[string]any{
			"runId":              runID,
			"routeId":            "CBE-" + routeID,
			"active":             bpBool(row, "Active"),
			"effectiveDate":      bpString(row, "EffectiveDate"),
			"retireDate":         bpString(row, "RetireDate"),
			"instruction":        bpString(row, "Instruction"),
			"componentId":        bpString(row, "ComponentID"),
			"description":        bpString(row, "Description"),
			"runType":            bpString(row, "Type"),
			"componentVariation": bpString(row, "ComponentVariation"),
			"runVariation":       bpString(row, "RunVariation"),
			"distance":           bpString(row, "Distance"),
			"startTime":          bpString(row, "StartTime"),
			"endTime":            bpString(row, "EndTime"),
			"runOrder":           bpString(row, "RunOrder"),
			"updatedAt":          updated,
			"source":             "busplanner",
		}
	}
	if err := s.store.ReplaceStage(ctx, stageRuns, runDocs); err != nil {
		return nil, err
	}

	schools, err := s.getList(ctx, secret.BaseURL, token, "/Rest/api/School")
	if err != nil {
		return nil, fmt.Errorf("schools: %w", err)
	}
	schoolDocs := map[string]map[string]any{}
	for _, row := range schools {
		schoolID := bpString(row, "SchoolId")
		if schoolID == "" {
			continue
		}
		id := stageDocID(schoolID)
		if id == "" {
			continue
		}
		address := bpMap(row, "Address")
		latLong := bpMap(address, "LatLong")
		schoolDocs[id] = map[string]any{
			"schoolId":         schoolID,
			"schoolGuid":       bpString(row, "SchoolGuid"),
			"name":             bpString(row, "Name"),
			"transportAddress": bpString(row, "TransportAddress"),
			"postalCode":       bpString(address, "PostalCode"),
			"amBellTime":       bpString(row, "AMBellTime"),
			"pmBellTime":       bpString(row, "PMBellTime"),
			"latitude":         bpString(latLong, "Latitude"),
			"longitude":        bpString(latLong, "Longitude"),
			"schoolBoardName":  "CBE",
			"active":           true,
			"updatedAt":        updated,
			"source":           "busplanner",
		}
	}
	if err := s.store.ReplaceStage(ctx, stageSchools, schoolDocs); err != nil {
		return nil, err
	}

	year := now.Year()
	stopDocs := map[string]map[string]any{}
	stopIDs := map[string]struct{}{}
	for _, path := range []string{"/Rest/api/BusStop/GetSchoolStops", "/Rest/api/BusStop/GetHomeStops"} {
		pages, err := s.getPages(ctx, secret.BaseURL, token, path+"?packageSize=300", "lastStopGuid", "BusStopGuid")
		if err != nil {
			return nil, fmt.Errorf("stops: %w", err)
		}
		for _, row := range pages {
			routeID := bpString(row, "RouteID")
			if _, ok := routeIDs[routeID]; !ok {
				continue
			}
			info := bpMap(row, "BasicInformation")
			stopTime := bpString(info, "Time")
			if y := yearOf(stopTime); y > 0 && y < year {
				continue
			}
			stopID := bpString(info, "BusStopID")
			if stopID == "" || bpExplicitFalse(info, "Active") {
				continue
			}
			freq := ""
			if frequency := bpMap(info, "Frequency"); frequency != nil {
				freq = bpString(frequency, "FrequencyString")
			}
			id := stageDocID(stopID, freq)
			if id == "" {
				continue
			}
			latLong := bpMap(row, "LatLong")
			stopIDs[stopID] = struct{}{}
			stopDocs[id] = map[string]any{
				"busStopId":     stopID,
				"busStopGuid":   bpString(info, "BusStopGuid"),
				"routeId":       routeID,
				"runId":         bpString(info, "RunID"),
				"active":        bpBool(info, "Active"),
				"stopType":      bpString(info, "StopType"),
				"stopTime":      stopTime,
				"position":      bpString(info, "Position"),
				"description":   bpString(info, "Description"),
				"instruction":   bpString(info, "Instruction"),
				"effectiveDate": bpString(info, "EffectiveDate"),
				"retireDate":    bpString(info, "RetireDate"),
				"frequency":     freq,
				"stopOrder":     bpString(info, "Order"),
				"latitude":      bpString(latLong, "Latitude"),
				"longitude":     bpString(latLong, "Longitude"),
				"updatedAt":     updated,
				"source":        "busplanner",
			}
		}
	}
	if err := s.store.ReplaceStage(ctx, stageStops, stopDocs); err != nil {
		return nil, err
	}

	studentStops, err := s.getPages(ctx, secret.BaseURL, token, "/Rest/api/StudentStop/Get?packageSize=4000", "lastStudentGuid", "StudentGuid")
	if err != nil {
		return nil, fmt.Errorf("student stops: %w", err)
	}
	studentStopDocs := map[string]map[string]any{}
	studentGuids := map[string]struct{}{}
	for _, row := range studentStops {
		stopID := bpString(row, "BusStopID")
		studentID := bpString(row, "StudentID")
		if stopID == "" || studentID == "" {
			continue
		}
		if _, ok := stopIDs[stopID]; !ok {
			continue
		}
		guid := bpString(row, "StudentGuid")
		id := stageDocID(stopID, studentID)
		if id == "" {
			continue
		}
		if guid != "" && !isZeroGUID(guid) {
			studentGuids[guid] = struct{}{}
		}
		studentStopDocs[id] = map[string]any{
			"busStopId":   stopID,
			"studentId":   studentID,
			"busStopGuid": bpString(row, "BusStopGuid"),
			"studentGuid": guid,
			"active":      true,
			"updatedAt":   updated,
			"source":      "busplanner",
		}
	}
	if err := s.store.ReplaceStage(ctx, stageStudentStops, studentStopDocs); err != nil {
		return nil, err
	}

	studentDocs := map[string]map[string]any{}
	for guid := range studentGuids {
		path := "/Rest/api/Student/Get?StudentGuid=" + url.QueryEscape(guid)
		body, status, err := s.get(ctx, secret.BaseURL, token, path)
		if err != nil || status < 200 || status >= 300 || len(strings.TrimSpace(string(body))) < 3 {
			continue
		}
		var row map[string]any
		if err := json.Unmarshal(body, &row); err != nil {
			continue
		}
		id := stageDocID(guid)
		if id == "" {
			continue
		}
		studentDocs[id] = map[string]any{
			"studentGuid":              guid,
			"studentId":                bpString(row, "Id"),
			"firstName":                bpString(row, "FirstName"),
			"lastName":                 bpString(row, "LastName"),
			"districtId":               bpString(row, "DistrictId"),
			"schoolId":                 bpString(row, "SchoolId"),
			"grade":                    bpString(row, "Grade"),
			"gender":                   bpString(row, "Gender"),
			"birthDate":                bpString(row, "BirthDate"),
			"alternateId":              bpString(row, "AlternateId"),
			"eligibility":              bpString(row, "Eligibility"),
			"travelCode":               bpString(row, "TravelCode"),
			"seatType":                 bpString(row, "SeatType"),
			"instructions":             bpString(row, "Instructions"),
			"phone":                    bpString(row, "Phone"),
			"alert":                    bpString(row, "Alert"),
			"metAtBus":                 bpString(row, "MetAtBus"),
			"specialNeeds":             bpString(row, "SpecialNeeds"),
			"medicalNumber":            bpString(row, "MedicalNumber"),
			"medicalDetail":            bpString(row, "MedicalDetail"),
			"distanceToSchoolInMetres": bpString(row, "DistanceToSchoolInMetres"),
			"scheduleType":             bpString(row, "ScheduleType"),
			"specialEd":                bpString(row, "SpecialEd"),
			"active":                   true,
			"updatedAt":                updated,
			"source":                   "busplanner",
		}
	}
	if err := s.store.ReplaceStage(ctx, stageStudents, studentDocs); err != nil {
		return nil, err
	}

	current, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	today := now.Format("2006-01-02")
	slots := make([]string, 0, len(markSlots))
	for _, slot := range current.CompletedSlots {
		if strings.HasPrefix(slot, today+" ") {
			slots = append(slots, slot)
		}
	}
	for _, slot := range markSlots {
		key := today + " " + slot
		if !containsString(slots, key) {
			slots = append(slots, key)
		}
	}
	current.CompletedSlots = slots
	current.LastSyncAt = updated
	current.LastRouteCount = len(routeDocs)
	current.LastRunCount = len(runDocs)
	current.LastSchoolCount = len(schoolDocs)
	current.LastStopCount = len(stopDocs)
	current.LastStudentStopCount = len(studentStopDocs)
	current.LastStudentCount = len(studentDocs)
	if err := s.store.Save(ctx, current); err != nil {
		return nil, err
	}

	report := &BusPlannerSyncReport{
		Persisted:        true,
		StagingOnly:      true,
		LiveUpdated:      false,
		RouteCount:       len(routeDocs),
		RunCount:         len(runDocs),
		SchoolCount:      len(schoolDocs),
		StopCount:        len(stopDocs),
		StudentStopCount: len(studentStopDocs),
		StudentCount:     len(studentDocs),
		Preview:          preview,
		SyncedAt:         updated,
		Message: fmt.Sprintf(
			"Saved %d routes, %d runs, %d schools, %d stops, %d student stops, and %d students to BusPlanner staging. Live routes, schools, and students were not changed.",
			len(routeDocs), len(runDocs), len(schoolDocs), len(stopDocs), len(studentStopDocs), len(studentDocs),
		),
	}
	log.Printf("[BUSPLANNER] %s", report.Message)
	return report, nil
}

func (s *BusPlannerService) accessToken(ctx context.Context, secret busplannerSecret) (string, error) {
	s.mu.Lock()
	if s.token != "" && time.Now().Before(s.tokenUtil) {
		token := s.token
		s.mu.Unlock()
		return token, nil
	}
	s.mu.Unlock()

	form := url.Values{}
	form.Set("grant_type", "password")
	form.Set("username", secret.Username)
	form.Set("password", secret.Password)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(secret.BaseURL, "/")+"/Rest/Token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("BusPlanner token request failed")
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("BusPlanner token request returned %d", resp.StatusCode)
	}
	var parsed struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil || strings.TrimSpace(parsed.AccessToken) == "" {
		return "", fmt.Errorf("BusPlanner token response was empty")
	}
	ttl := time.Duration(parsed.ExpiresIn) * time.Second
	if ttl <= 0 || ttl > time.Hour {
		ttl = 50 * time.Minute
	}
	s.mu.Lock()
	s.token = parsed.AccessToken
	s.tokenUtil = time.Now().Add(ttl - time.Minute)
	s.mu.Unlock()
	return parsed.AccessToken, nil
}

func (s *BusPlannerService) getList(ctx context.Context, base, token, path string) ([]map[string]any, error) {
	body, status, err := s.get(ctx, base, token, path)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("status %d", status)
	}
	return decodeList(body), nil
}

func (s *BusPlannerService) getPages(ctx context.Context, base, token, first, cursorQuery, guidField string) ([]map[string]any, error) {
	var all []map[string]any
	last := "00000000-0000-0000-0000-000000000000"
	for page := 0; page < busplannerMaxPages; page++ {
		path := first + "&" + cursorQuery + "=" + url.QueryEscape(last)
		body, status, err := s.get(ctx, base, token, path)
		if err != nil {
			return nil, err
		}
		if status < 200 || status >= 300 {
			return nil, fmt.Errorf("status %d", status)
		}
		if len(strings.TrimSpace(string(body))) < 3 {
			break
		}
		rows := decodeList(body)
		if len(rows) == 0 {
			break
		}
		next := last
		for _, row := range rows {
			all = append(all, row)
			info := bpMap(row, "BasicInformation")
			guid := bpString(info, guidField)
			if guid == "" {
				guid = bpString(row, guidField)
			}
			if guid != "" {
				next = guid
			}
		}
		if next == last {
			break
		}
		last = next
	}
	return all, nil
}

func (s *BusPlannerService) get(ctx context.Context, base, token, path string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+path, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return body, resp.StatusCode, nil
}

func decodeList(body []byte) []map[string]any {
	var rows []map[string]any
	if err := json.Unmarshal(body, &rows); err == nil {
		return rows
	}
	var one map[string]any
	if err := json.Unmarshal(body, &one); err == nil && one != nil {
		return []map[string]any{one}
	}
	return nil
}

func bpMap(m map[string]any, key string) map[string]any {
	raw := bpLookup(m, key)
	switch v := raw.(type) {
	case map[string]any:
		return v
	default:
		return nil
	}
}

func bpString(m map[string]any, key string) string {
	raw := bpLookup(m, key)
	if raw == nil {
		return ""
	}
	switch v := raw.(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		if v == float64(int64(v)) {
			return fmt.Sprintf("%d", int64(v))
		}
		return strings.TrimSpace(fmt.Sprint(v))
	case bool:
		if v {
			return "true"
		}
		return "false"
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func bpExplicitFalse(m map[string]any, key string) bool {
	if bpLookup(m, key) == nil {
		return false
	}
	return !bpBool(m, key)
}

func bpBool(m map[string]any, key string) bool {
	raw := bpLookup(m, key)
	switch v := raw.(type) {
	case bool:
		return v
	case string:
		return strings.EqualFold(v, "true") || v == "1"
	case float64:
		return v != 0
	default:
		return false
	}
}

func bpLookup(m map[string]any, key string) any {
	if m == nil || key == "" {
		return nil
	}
	if v, ok := m[key]; ok && v != nil {
		return v
	}
	for mk, mv := range m {
		if strings.EqualFold(mk, key) && mv != nil {
			return mv
		}
	}
	return nil
}

func stageDocID(parts ...string) string {
	raw := strings.Join(parts, "_")
	var b strings.Builder
	for _, r := range raw {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	id := strings.Trim(b.String(), "_")
	if id == "" {
		return ""
	}
	if len(id) > 500 {
		id = id[:500]
	}
	return id
}

func isZeroGUID(v string) bool {
	compact := strings.ReplaceAll(strings.TrimSpace(v), "-", "")
	return compact == "" || strings.Trim(compact, "0") == ""
}

func yearOf(raw string) int {
	raw = strings.TrimSpace(raw)
	if len(raw) < 4 {
		return 0
	}
	layouts := []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02"}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t.Year()
		}
	}
	if len(raw) >= 4 {
		var y int
		if _, err := fmt.Sscanf(raw[:4], "%d", &y); err == nil && y > 1900 && y < 3000 {
			return y
		}
	}
	return 0
}

func normalizeBusPlannerBase(raw string) (string, error) {
	base := strings.TrimSpace(raw)
	if base == "" {
		return busplannerDefaultBase, nil
	}
	if !strings.HasPrefix(strings.ToLower(base), "https://") && !strings.HasPrefix(strings.ToLower(base), "http://") {
		return "", fmt.Errorf("base URL must start with https://")
	}
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return "", fmt.Errorf("base URL is not valid")
	}
	return strings.TrimRight(base, "/"), nil
}

func normalizeBusPlannerTimes(in []string) ([]string, error) {
	if len(in) > busplannerMaxSyncTimes {
		return nil, fmt.Errorf("at most %d sync times are allowed", busplannerMaxSyncTimes)
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, raw := range in {
		clock, err := normalizeBusPlannerClock(raw)
		if err != nil {
			return nil, err
		}
		if _, ok := seen[clock]; ok {
			continue
		}
		seen[clock] = struct{}{}
		out = append(out, clock)
	}
	sort.Strings(out)
	return out, nil
}

func normalizeBusPlannerClock(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("sync time is required")
	}
	t, err := time.Parse("15:04", raw)
	if err != nil {
		return "", fmt.Errorf("sync time must be HH:MM")
	}
	return t.Format("15:04"), nil
}

func busplannerLocation() *time.Location {
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		return time.FixedZone("EDT", -4*3600)
	}
	return loc
}

func containsString(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}
