package services

import (
	"context"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	zonarPreviewLimit     = 8
	zonarBusyStartHour    = 6
	zonarBusyEndHour      = 18
	defaultBusyInterval   = 1
	defaultIdleInterval   = 10
	maxBusyIntervalMinute = 60
	maxIdleIntervalMinute = 180
	defaultZonarEndpoint  = "https://omi.zonarsystems.net/interface.php"
)

var zonarAccountPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// ZonarSettings is the admin-facing view. The password is never included.
type ZonarSettings struct {
	Enabled               bool   `json:"enabled"`
	RouteSyncEnabled      bool   `json:"routeSyncEnabled"`
	Customer              string `json:"customer"`
	Username              string `json:"username"`
	PasswordConfigured    bool   `json:"passwordConfigured"`
	BusyIntervalMinutes   int    `json:"busyIntervalMinutes"`
	IdleIntervalMinutes   int    `json:"idleIntervalMinutes"`
	BusyWindow            string `json:"busyWindow"`
	GpsSerialSyncTime     string `json:"gpsSerialSyncTime"`
	LastSyncAt            string `json:"lastSyncAt,omitempty"`
	LastSyncCount         int    `json:"lastSyncCount"`
	LastSyncMode          string `json:"lastSyncMode,omitempty"`
	LastGpsSerialSyncAt   string `json:"lastGpsSerialSyncAt,omitempty"`
	LastGpsSerialCount    int    `json:"lastGpsSerialCount"`
	LastRoutePreviewAt    string `json:"lastRoutePreviewAt,omitempty"`
	LastRoutePreviewCount int    `json:"lastRoutePreviewCount"`
	UpdatedAt             string `json:"updatedAt,omitempty"`
}

// ZonarSave is the write payload. An empty Password keeps the stored password.
type ZonarSave struct {
	Enabled             bool   `json:"enabled"`
	RouteSyncEnabled    bool   `json:"routeSyncEnabled"`
	Customer            string `json:"customer"`
	Username            string `json:"username"`
	Password            string `json:"password"`
	ClearPassword       bool   `json:"clearPassword"`
	BusyIntervalMinutes int    `json:"busyIntervalMinutes"`
	IdleIntervalMinutes int    `json:"idleIntervalMinutes"`
	GpsSerialSyncTime   string `json:"gpsSerialSyncTime"`
}

// ZonarPreview is one current position. Street addresses are omitted.
type ZonarPreview struct {
	ID         string  `json:"id"`
	Fleet      string  `json:"fleet"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	ObservedAt string  `json:"observedAt"`
	Power      string  `json:"power,omitempty"`
}

// ZonarTestReport is a dry run. Positions are not written into dispatch storage.
type ZonarTestReport struct {
	DryRun          bool           `json:"dryRun"`
	Persisted       bool           `json:"persisted"`
	Customer        string         `json:"customer"`
	Mode            string         `json:"mode"`
	IntervalMinutes int            `json:"intervalMinutes"`
	AssetCount      int            `json:"assetCount"`
	LocatedCount    int            `json:"locatedCount"`
	Preview         []ZonarPreview `json:"preview"`
	Message         string         `json:"message"`
}

// ZonarSerialReport is the result of copying Zonar GPS serials onto fleet vehicles.
type ZonarSerialReport struct {
	Persisted      bool     `json:"persisted"`
	AssetCount     int      `json:"assetCount"`
	UpdatedCount   int      `json:"updatedCount"`
	ClearedCount   int      `json:"clearedCount"`
	UnmatchedCount int      `json:"unmatchedCount"`
	Unmatched      []string `json:"unmatched"`
	Message        string   `json:"message"`
}

// ZonarRoutePreview is one route number that would be written to Zonar exsid.
type ZonarRoutePreview struct {
	UnitNumber string `json:"unitNumber"`
	AssetID    int    `json:"assetId"`
	Fleet      string `json:"fleet"`
	RouteNo    string `json:"routeNo"`
	Location   string `json:"location"`
}

// ZonarRouteWriteReport describes a route write-back that was not sent.
type ZonarRouteWriteReport struct {
	Persisted    bool                `json:"persisted"`
	SentToZonar  bool                `json:"sentToZonar"`
	VehicleCount int                 `json:"vehicleCount"`
	WithRoute    int                 `json:"withRoute"`
	Preview      []ZonarRoutePreview `json:"preview"`
	Message      string              `json:"message"`
}

type zonarSecret struct {
	Enabled               bool   `json:"-" firestore:"enabled"`
	RouteSyncEnabled      bool   `json:"-" firestore:"routeSyncEnabled"`
	Customer              string `json:"-" firestore:"customer"`
	Username              string `json:"-" firestore:"username"`
	Password              string `json:"-" firestore:"password"`
	BusyIntervalMinutes   int    `json:"-" firestore:"busyIntervalMinutes"`
	IdleIntervalMinutes   int    `json:"-" firestore:"idleIntervalMinutes"`
	LastSyncAt            string `json:"-" firestore:"lastSyncAt"`
	LastSyncCount         int    `json:"-" firestore:"lastSyncCount"`
	LastSyncMode          string `json:"-" firestore:"lastSyncMode"`
	GpsSerialSyncTime     string `json:"-" firestore:"gpsSerialSyncTime"`
	LastGpsSerialSyncDate string `json:"-" firestore:"lastGpsSerialSyncDate"`
	LastGpsSerialSyncAt   string `json:"-" firestore:"lastGpsSerialSyncAt"`
	LastGpsSerialCount    int    `json:"-" firestore:"lastGpsSerialCount"`
	LastRoutePreviewDate  string `json:"-" firestore:"lastRoutePreviewDate"`
	LastRoutePreviewAt    string `json:"-" firestore:"lastRoutePreviewAt"`
	LastRoutePreviewCount int    `json:"-" firestore:"lastRoutePreviewCount"`
	UpdatedAt             string `json:"-" firestore:"updatedAt"`
}

func (s zonarSecret) public() ZonarSettings {
	busy := storedInterval(s.BusyIntervalMinutes, defaultBusyInterval, maxBusyIntervalMinute)
	idle := storedInterval(s.IdleIntervalMinutes, defaultIdleInterval, maxIdleIntervalMinute)
	return ZonarSettings{
		Enabled:               s.Enabled,
		RouteSyncEnabled:      s.RouteSyncEnabled,
		Customer:              s.Customer,
		Username:              s.Username,
		PasswordConfigured:    strings.TrimSpace(s.Password) != "",
		BusyIntervalMinutes:   busy,
		IdleIntervalMinutes:   idle,
		BusyWindow:            "weekdays 06:00-18:00 America/Toronto",
		GpsSerialSyncTime:     storedClock(s.GpsSerialSyncTime, "03:00"),
		LastSyncAt:            s.LastSyncAt,
		LastSyncCount:         s.LastSyncCount,
		LastSyncMode:          s.LastSyncMode,
		LastGpsSerialSyncAt:   s.LastGpsSerialSyncAt,
		LastGpsSerialCount:    s.LastGpsSerialCount,
		LastRoutePreviewAt:    s.LastRoutePreviewAt,
		LastRoutePreviewCount: s.LastRoutePreviewCount,
		UpdatedAt:             s.UpdatedAt,
	}
}

func (s zonarSecret) ready() bool {
	return strings.TrimSpace(s.Password) != "" && s.Customer != "" && s.Username != ""
}

// ZonarService reads current GPS positions from Zonar.
// Reads are not written into the dispatch database.
type ZonarService struct {
	store    zonarSecretStore
	vehicles repository.VehicleRepository
	routes   func(ctx context.Context, day string) (map[string]string, error)
	client   *http.Client
	endpoint string
}

func NewZonarService(store zonarSecretStore) *ZonarService {
	return &ZonarService{
		store:    store,
		client:   &http.Client{Timeout: 30 * time.Second},
		endpoint: defaultZonarEndpoint,
	}
}

// UseVehicles supplies the fleet records that receive a GPS serial once per day.
func (s *ZonarService) UseVehicles(vehicles repository.VehicleRepository) {
	s.vehicles = vehicles
}

// UseRoutes supplies today's unit-to-route map. The route write-back never calls Zonar.
func (s *ZonarService) UseRoutes(lookup func(ctx context.Context, day string) (map[string]string, error)) {
	s.routes = lookup
}

func (s *ZonarService) GetSettings(ctx context.Context) (ZonarSettings, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return ZonarSettings{}, err
	}
	return secret.public(), nil
}

func (s *ZonarService) SaveSettings(ctx context.Context, in ZonarSave) (ZonarSettings, error) {
	customer := strings.TrimSpace(in.Customer)
	username := strings.TrimSpace(in.Username)
	if customer != "" && !zonarAccountPattern.MatchString(customer) {
		return ZonarSettings{}, fmt.Errorf("customer must be letters, numbers, _ or -")
	}
	if username != "" && !zonarAccountPattern.MatchString(username) {
		return ZonarSettings{}, fmt.Errorf("username must be letters, numbers, _ or -")
	}
	busy, err := normalizeInterval(in.BusyIntervalMinutes, defaultBusyInterval, maxBusyIntervalMinute)
	if err != nil {
		return ZonarSettings{}, fmt.Errorf("busy interval must be 1 to %d minutes", maxBusyIntervalMinute)
	}
	idle, err := normalizeInterval(in.IdleIntervalMinutes, defaultIdleInterval, maxIdleIntervalMinute)
	if err != nil {
		return ZonarSettings{}, fmt.Errorf("idle interval must be 1 to %d minutes", maxIdleIntervalMinute)
	}
	serialTime, err := clockTime(in.GpsSerialSyncTime, "03:00")
	if err != nil {
		return ZonarSettings{}, fmt.Errorf("GPS serial sync time must be HH:MM")
	}
	if in.Enabled && (customer == "" || username == "") {
		return ZonarSettings{}, fmt.Errorf("customer and username are required when sync is enabled")
	}

	current, err := s.store.Load(ctx)
	if err != nil {
		return ZonarSettings{}, err
	}
	next := current
	next.Enabled = in.Enabled
	next.RouteSyncEnabled = in.RouteSyncEnabled
	next.Customer = customer
	next.Username = username
	next.BusyIntervalMinutes = busy
	next.IdleIntervalMinutes = idle
	next.GpsSerialSyncTime = serialTime
	next.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if in.ClearPassword {
		next.Password = ""
	} else if strings.TrimSpace(in.Password) != "" {
		next.Password = strings.TrimSpace(in.Password)
	}
	if in.Enabled && strings.TrimSpace(next.Password) == "" {
		return ZonarSettings{}, fmt.Errorf("Zonar password is required when sync is enabled")
	}
	if err := s.store.Save(ctx, next); err != nil {
		return ZonarSettings{}, err
	}
	return next.public(), nil
}

// TestSync reads current positions once. It does not write them into dispatch storage.
func (s *ZonarService) TestSync(ctx context.Context) (*ZonarTestReport, error) {
	loc := ottawaLocation()
	return s.readCurrent(ctx, time.Now().In(loc), true)
}

// RunScheduledSync reads current positions on the busy or idle interval.
// Weekday 06:00-18:00 Ottawa time uses the busy interval. Evenings and weekends use the idle interval.
// Positions are not written into the dispatch database.
func (s *ZonarService) RunScheduledSync(ctx context.Context) {
	s.runScheduledSyncAt(ctx, time.Now().In(ottawaLocation()))
}

func (s *ZonarService) runScheduledSyncAt(ctx context.Context, now time.Time) {
	secret, err := s.store.Load(ctx)
	if err != nil || !secret.Enabled || !secret.ready() {
		return
	}
	interval, _ := scheduleFor(now, secret)
	if secret.LastSyncAt != "" {
		last, parseErr := time.Parse(time.RFC3339, secret.LastSyncAt)
		if parseErr == nil && now.Sub(last) < interval {
			return
		}
	}
	_, _ = s.readCurrent(ctx, now, true)
}

// SyncSerials copies each active Zonar asset GPS serial onto the matching fleet vehicle.
// It runs on demand. The daily scheduler also calls it once per Ottawa day.
func (s *ZonarService) SyncSerials(ctx context.Context) (*ZonarSerialReport, error) {
	return s.syncSerials(ctx, time.Now().In(ottawaLocation()), true)
}

// RunScheduledSerialSync copies GPS serials once per day at the configured Ottawa time.
func (s *ZonarService) RunScheduledSerialSync(ctx context.Context) {
	s.runScheduledSerialSyncAt(ctx, time.Now().In(ottawaLocation()))
}

func (s *ZonarService) runScheduledSerialSyncAt(ctx context.Context, now time.Time) {
	secret, err := s.store.Load(ctx)
	if err != nil || !secret.Enabled || !secret.ready() || s.vehicles == nil {
		return
	}
	syncTime := storedClock(secret.GpsSerialSyncTime, "03:00")
	if now.Format("15:04") < syncTime {
		return
	}
	if secret.LastGpsSerialSyncDate == now.Format("2006-01-02") {
		return
	}
	_, _ = s.syncSerials(ctx, now, true)
}

// RunScheduledRoutePreview prepares route numbers for Zonar on the same daily clock as the GPS serial sync.
// It does not send those numbers to Zonar.
func (s *ZonarService) RunScheduledRoutePreview(ctx context.Context) {
	s.runScheduledRoutePreviewAt(ctx, time.Now().In(ottawaLocation()))
}

func (s *ZonarService) runScheduledRoutePreviewAt(ctx context.Context, now time.Time) {
	secret, err := s.store.Load(ctx)
	if err != nil || !secret.RouteSyncEnabled || s.vehicles == nil {
		return
	}
	syncTime := storedClock(secret.GpsSerialSyncTime, "03:00")
	if now.Format("15:04") < syncTime {
		return
	}
	if secret.LastRoutePreviewDate == now.Format("2006-01-02") {
		return
	}
	_, _ = s.previewRouteWriteBack(ctx, now, true)
}

// PreviewRouteWriteBack builds the route numbers that SyncUnitInfoToZona would send as exsid.
// Nothing is posted to Zonar.
func (s *ZonarService) PreviewRouteWriteBack(ctx context.Context) (*ZonarRouteWriteReport, error) {
	return s.previewRouteWriteBack(ctx, time.Now().In(ottawaLocation()), true)
}

func (s *ZonarService) previewRouteWriteBack(ctx context.Context, now time.Time, record bool) (*ZonarRouteWriteReport, error) {
	if s.vehicles == nil {
		return nil, fmt.Errorf("vehicle store is not configured")
	}
	current, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !current.RouteSyncEnabled {
		return nil, fmt.Errorf("route sync to Zonar is turned off")
	}
	vehicles, err := s.vehicles.ListVehicles(ctx, repository.VehicleFilter{})
	if err != nil {
		return nil, err
	}
	day := now.Format("2006-01-02")
	routes := map[string]string{}
	if s.routes != nil {
		found, err := s.routes(ctx, day)
		if err != nil {
			return nil, err
		}
		if found != nil {
			routes = found
		}
	}
	rows := make([]ZonarRoutePreview, 0)
	withRoute := 0
	for _, vehicle := range vehicles {
		if !vehicle.Active || vehicle.ZonarAssetID == 0 || strings.TrimSpace(vehicle.ZonarFleet) == "" {
			continue
		}
		routeNo := routes[models.NormalizeFleetUnit(vehicle.UnitNumber)]
		if routeNo == "" {
			routeNo = strings.ToUpper(strings.TrimSpace(vehicle.AssignedRouteNo))
		}
		if routeNo != "" {
			withRoute++
		}
		rows = append(rows, ZonarRoutePreview{
			UnitNumber: vehicle.UnitNumber,
			AssetID:    vehicle.ZonarAssetID,
			Fleet:      vehicle.ZonarFleet,
			RouteNo:    routeNo,
			Location:   zonarLocationForRoute(routeNo),
		})
	}
	preview := rows
	if len(preview) > 12 {
		preview = preview[:12]
	}
	report := &ZonarRouteWriteReport{
		Persisted:    false,
		SentToZonar:  false,
		VehicleCount: len(rows),
		WithRoute:    withRoute,
		Preview:      preview,
		Message:      fmt.Sprintf("Prepared %d route numbers for Zonar. Nothing was sent.", withRoute),
	}
	if record {
		secret, err := s.store.Load(ctx)
		if err != nil {
			return nil, err
		}
		secret.LastRoutePreviewDate = day
		secret.LastRoutePreviewAt = now.UTC().Format(time.RFC3339)
		secret.LastRoutePreviewCount = withRoute
		if err := s.store.Save(ctx, secret); err != nil {
			return nil, err
		}
	}
	return report, nil
}

func zonarLocationForRoute(routeNo string) string {
	route := strings.ToUpper(strings.TrimSpace(routeNo))
	switch {
	case strings.Contains(route, "CBE"):
		return "CBE"
	case strings.Contains(route, "CCSD"):
		return "CCSD"
	case strings.Contains(route, "PRO"):
		return "PROVIDENCE"
	case strings.Contains(route, "PAC"):
		return "PACEKIDS"
	case strings.Contains(route, "OFF"):
		return "Office"
	case strings.Contains(route, "PRI"), strings.Contains(route, "PDD"):
		return "PRIVATE"
	default:
		return "Office"
	}
}

func (s *ZonarService) syncSerials(ctx context.Context, now time.Time, record bool) (*ZonarSerialReport, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !secret.ready() {
		return nil, fmt.Errorf("Zonar password is not configured")
	}
	if s.vehicles == nil {
		return nil, fmt.Errorf("vehicle store is not configured")
	}
	assets, err := s.fetchAssets(ctx, secret)
	if err != nil {
		return nil, err
	}
	vehicles, err := s.vehicles.ListVehicles(ctx, repository.VehicleFilter{})
	if err != nil {
		return nil, err
	}
	activeIDs := map[int]bool{}
	updated := 0
	unmatched := []string{}
	for _, asset := range assets {
		activeIDs[asset.ID] = true
		vehicle := matchZonarVehicle(vehicles, asset.Fleet)
		if vehicle == nil {
			unmatched = append(unmatched, asset.Fleet)
			continue
		}
		if vehicle.ZonarFleet == asset.Fleet && vehicle.ZonarAssetID == asset.ID && vehicle.GpsSerial == asset.GPS {
			continue
		}
		if _, err := s.vehicles.UpdateVehicle(ctx, vehicle.ID, map[string]interface{}{
			"zonarFleet":   asset.Fleet,
			"zonarAssetId": asset.ID,
			"gpsSerial":    asset.GPS,
		}); err != nil {
			return nil, err
		}
		vehicle.ZonarFleet = asset.Fleet
		vehicle.ZonarAssetID = asset.ID
		vehicle.GpsSerial = asset.GPS
		updated++
	}
	cleared := 0
	for _, vehicle := range vehicles {
		if !vehicle.Active || vehicle.ZonarAssetID == 0 || activeIDs[vehicle.ZonarAssetID] {
			continue
		}
		if _, err := s.vehicles.UpdateVehicle(ctx, vehicle.ID, map[string]interface{}{
			"zonarAssetId": 0,
		}); err != nil {
			return nil, err
		}
		vehicle.ZonarAssetID = 0
		cleared++
	}
	shown := unmatched
	if len(shown) > 12 {
		shown = shown[:12]
	}
	withSerial := 0
	for _, vehicle := range vehicles {
		if strings.TrimSpace(vehicle.GpsSerial) != "" {
			withSerial++
		}
	}
	report := &ZonarSerialReport{
		Persisted:      true,
		AssetCount:     len(assets),
		UpdatedCount:   updated,
		ClearedCount:   cleared,
		UnmatchedCount: len(unmatched),
		Unmatched:      shown,
		Message:        fmt.Sprintf("Updated %d GPS serials. Cleared %d stale asset ids. %d Zonar vehicles were not in the fleet.", updated, cleared, len(unmatched)),
	}
	if record {
		secret.LastGpsSerialSyncDate = now.Format("2006-01-02")
		secret.LastGpsSerialSyncAt = now.UTC().Format(time.RFC3339)
		secret.LastGpsSerialCount = withSerial
		if err := s.store.Save(ctx, secret); err != nil {
			return nil, err
		}
	}
	return report, nil
}

func matchZonarVehicle(vehicles []*models.Vehicle, fleet string) *models.Vehicle {
	stripped := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(fleet)), "4s-")
	for _, vehicle := range vehicles {
		if strings.ToLower(strings.TrimSpace(vehicle.UnitNumber)) == stripped {
			return vehicle
		}
	}
	normalized := models.NormalizeFleetUnit(fleet)
	if normalized == "" {
		return nil
	}
	for _, vehicle := range vehicles {
		if models.NormalizeFleetUnit(vehicle.UnitNumber) == normalized {
			return vehicle
		}
	}
	return nil
}

func (s *ZonarService) readCurrent(ctx context.Context, now time.Time, record bool) (*ZonarTestReport, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !secret.Enabled {
		return nil, fmt.Errorf("Zonar sync is turned off")
	}
	if !secret.ready() {
		return nil, fmt.Errorf("Zonar password is not configured")
	}
	interval, mode := scheduleFor(now, secret)
	positions, assetCount, err := s.fetchPositions(ctx, secret)
	if err != nil {
		return nil, err
	}
	report := &ZonarTestReport{
		DryRun:          false,
		Persisted:       true,
		Customer:        secret.Customer,
		Mode:            mode,
		IntervalMinutes: int(interval / time.Minute),
		AssetCount:      assetCount,
		LocatedCount:    len(positions),
		Preview:         previewPositions(positions),
		Message:         fmt.Sprintf("Saved %d current positions. Each vehicle keeps only its latest fix.", len(positions)),
	}
	if record {
		secret.LastSyncAt = now.UTC().Format(time.RFC3339)
		secret.LastSyncCount = report.LocatedCount
		secret.LastSyncMode = mode
		if err := s.store.Save(ctx, secret); err != nil {
			return nil, err
		}
	}
	return report, nil
}

func (s *ZonarService) GetCurrent(ctx context.Context, unitNumber string) (*models.GpsCurrentPosition, error) {
	return s.store.GetCurrent(ctx, unitNumber)
}

func (s *ZonarService) fetchPositions(ctx context.Context, secret zonarSecret) ([]models.GpsCurrentPosition, int, error) {
	query := url.Values{}
	query.Set("customer", secret.Customer)
	query.Set("username", secret.Username)
	query.Set("password", secret.Password)
	query.Set("action", "showposition")
	query.Set("operation", "current")
	query.Set("format", "xml")
	query.Set("version", "2")
	query.Set("logvers", "3.6")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.endpoint+"?"+query.Encode(), nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", "Zonar Systems API-Test 8.2.1")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("Zonar request failed")
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, 0, fmt.Errorf("Zonar response could not be read")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, 0, fmt.Errorf("Zonar returned HTTP %d", resp.StatusCode)
	}
	var doc zonarCurrentLocations
	if err := xml.Unmarshal(body, &doc); err != nil {
		return nil, 0, fmt.Errorf("Zonar response was not a position list")
	}
	preview := make([]models.GpsCurrentPosition, 0, len(doc.Assets))
	seen := map[string]int{}
	now := time.Now().UTC()
	for _, asset := range doc.Assets {
		lat, latErr := strconv.ParseFloat(strings.TrimSpace(asset.Lat), 64)
		lng, lngErr := strconv.ParseFloat(strings.TrimSpace(asset.Long), 64)
		epoch, timeErr := strconv.ParseInt(strings.TrimSpace(asset.Time), 10, 64)
		if latErr != nil || lngErr != nil || timeErr != nil {
			continue
		}
		unit := models.NormalizeFleetUnit(asset.Fleet)
		if unit == "" {
			unit = "ASSET-" + strings.TrimSpace(asset.ID)
		}
		heading, _ := strconv.ParseFloat(strings.TrimSpace(asset.Heading), 64)
		speed, _ := strconv.ParseFloat(strings.TrimSpace(asset.Speed), 64)
		row := models.GpsCurrentPosition{
			AssetID:    strings.TrimSpace(asset.ID),
			UnitNumber: unit,
			Fleet:      strings.TrimSpace(asset.Fleet),
			Latitude:   lat,
			Longitude:  lng,
			Heading:    heading,
			SpeedKmh:   speed,
			Power:      strings.TrimSpace(asset.Power),
			Address:    strings.TrimSpace(asset.Address),
			ObservedAt: time.Unix(epoch, 0).UTC(),
			UpdatedAt:  now,
		}
		if idx, ok := seen[unit]; ok {
			preview[idx] = row
			continue
		}
		seen[unit] = len(preview)
		preview = append(preview, row)
	}
	if err := s.store.SaveCurrent(ctx, preview); err != nil {
		return nil, 0, err
	}
	return preview, len(doc.Assets), nil
}

func previewPositions(rows []models.GpsCurrentPosition) []ZonarPreview {
	out := make([]ZonarPreview, 0, len(rows))
	for _, row := range rows {
		if len(out) >= zonarPreviewLimit {
			break
		}
		out = append(out, ZonarPreview{
			ID:         row.AssetID,
			Fleet:      row.Fleet,
			Latitude:   row.Latitude,
			Longitude:  row.Longitude,
			ObservedAt: row.ObservedAt.UTC().Format(time.RFC3339),
			Power:      row.Power,
		})
	}
	return out
}

type zonarCurrentLocations struct {
	XMLName xml.Name     `xml:"currentlocations"`
	Assets  []zonarAsset `xml:"asset"`
}

type zonarAsset struct {
	ID      string `xml:"id,attr"`
	Fleet   string `xml:"fleet,attr"`
	Lat     string `xml:"lat"`
	Long    string `xml:"long"`
	Time    string `xml:"time"`
	Power   string `xml:"power"`
	Heading string `xml:"heading"`
	Speed   string `xml:"speed"`
	Address string `xml:"address"`
}

func scheduleFor(now time.Time, secret zonarSecret) (time.Duration, string) {
	local := now.In(ottawaLocation())
	busy := storedInterval(secret.BusyIntervalMinutes, defaultBusyInterval, maxBusyIntervalMinute)
	idle := storedInterval(secret.IdleIntervalMinutes, defaultIdleInterval, maxIdleIntervalMinute)
	weekday := local.Weekday()
	if weekday != time.Saturday && weekday != time.Sunday && local.Hour() >= zonarBusyStartHour && local.Hour() < zonarBusyEndHour {
		return time.Duration(busy) * time.Minute, "busy"
	}
	return time.Duration(idle) * time.Minute, "idle"
}

func (s *ZonarService) fetchAssets(ctx context.Context, secret zonarSecret) ([]zonarDevice, error) {
	query := url.Values{}
	query.Set("customer", secret.Customer)
	query.Set("username", secret.Username)
	query.Set("password", secret.Password)
	query.Set("action", "showopen")
	query.Set("operation", "showassets")
	query.Set("format", "xml")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.endpoint+"?"+query.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Zonar Systems API-Test 8.2.1")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Zonar request failed")
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, fmt.Errorf("Zonar response could not be read")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Zonar returned HTTP %d", resp.StatusCode)
	}
	var doc zonarAssetList
	if err := xml.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("Zonar response was not an asset list")
	}
	out := make([]zonarDevice, 0, len(doc.Assets))
	for _, asset := range doc.Assets {
		asset.Fleet = strings.TrimSpace(asset.Fleet)
		asset.GPS = strings.TrimSpace(asset.GPS)
		if asset.Status != 1 || asset.Fleet == "" || asset.GPS == "" || asset.ID == 0 {
			continue
		}
		out = append(out, asset)
	}
	return out, nil
}

type zonarAssetList struct {
	XMLName xml.Name      `xml:"assetlist"`
	Assets  []zonarDevice `xml:"asset"`
}

type zonarDevice struct {
	ID     int    `xml:"id,attr"`
	Fleet  string `xml:"fleet"`
	GPS    string `xml:"gps"`
	Status int    `xml:"status"`
}

func clockTime(raw, fallback string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback, nil
	}
	parsed, err := time.Parse("15:04", raw)
	if err != nil {
		return "", err
	}
	return parsed.Format("15:04"), nil
}

func storedClock(raw, fallback string) string {
	parsed, err := clockTime(raw, fallback)
	if err != nil {
		return fallback
	}
	return parsed
}

func ottawaLocation() *time.Location {
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		return time.FixedZone("EDT", -4*3600)
	}
	return loc
}

func normalizeInterval(raw, fallback, max int) (int, error) {
	if raw == 0 {
		return fallback, nil
	}
	if raw < 1 || raw > max {
		return 0, fmt.Errorf("out of range")
	}
	return raw, nil
}

func storedInterval(raw, fallback, max int) int {
	parsed, err := normalizeInterval(raw, fallback, max)
	if err != nil {
		return fallback
	}
	return parsed
}
