package services

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

const zonarTraceMaxRange = 24 * time.Hour

// ZonarTracePoint is one fix from a Zonar path read. It is not stored.
type ZonarTracePoint struct {
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	ObservedAt string  `json:"observedAt"`
	SpeedKmh   float64 `json:"speedKmh"`
	Heading    int     `json:"heading"`
}

// ZonarTrace is a vehicle path read live from Zonar.
type ZonarTrace struct {
	VehicleID  int               `json:"vehicleId"`
	UnitNumber string            `json:"unitNumber"`
	AssetID    int               `json:"assetId"`
	Persisted  bool              `json:"persisted"`
	Points     []ZonarTracePoint `json:"points"`
}

// ZonarIdleStop is one idle interval. It is not stored.
type ZonarIdleStop struct {
	Lat             float64 `json:"lat"`
	Lng             float64 `json:"lng"`
	StartTime       string  `json:"startTime"`
	EndTime         string  `json:"endTime"`
	DurationSeconds int     `json:"durationSeconds"`
}

// ZonarIdleReport is the idle list for one vehicle. It is not stored.
type ZonarIdleReport struct {
	VehicleID  int             `json:"vehicleId"`
	UnitNumber string          `json:"unitNumber"`
	Persisted  bool            `json:"persisted"`
	Stops      []ZonarIdleStop `json:"stops"`
}

// SyncEnabled reports whether the settings switch allows Zonar reads.
func (s *ZonarService) SyncEnabled(ctx context.Context) (bool, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return false, err
	}
	return secret.Enabled, nil
}

// VehicleTrace reads a path from Zonar for a fleet vehicle id. The result is not saved.
func (s *ZonarService) VehicleTrace(ctx context.Context, vehicleID, startRaw, endRaw string) (*ZonarTrace, error) {
	vehicle, secret, start, end, err := s.prepareLiveRead(ctx, vehicleID, startRaw, endRaw)
	if err != nil {
		return nil, err
	}
	body, err := s.getZonar(ctx, secret, url.Values{
		"action":    {"showposition"},
		"operation": {"path"},
		"format":    {"xml"},
		"version":   {"2"},
		"logvers":   {"3"},
		"reqtype":   {"dbid"},
		"target":    {strconv.Itoa(vehicle.ZonarAssetID)},
		"starttime": {strconv.FormatInt(start.UTC().Unix(), 10)},
		"endtime":   {strconv.FormatInt(end.UTC().Unix(), 10)},
	})
	if err != nil {
		return nil, err
	}
	points := parseZonarPath(body, ottawaLocation())
	if points == nil {
		points = []ZonarTracePoint{}
	}
	return &ZonarTrace{
		VehicleID:  vehicle.VehicleID,
		UnitNumber: vehicle.UnitNumber,
		AssetID:    vehicle.ZonarAssetID,
		Persisted:  false,
		Points:     points,
	}, nil
}

// VehicleIdles reads idle stops from Zonar for a fleet vehicle id. The result is not saved.
func (s *ZonarService) VehicleIdles(ctx context.Context, vehicleID, startRaw, endRaw string) (*ZonarIdleReport, error) {
	vehicle, secret, start, end, err := s.prepareLiveRead(ctx, vehicleID, startRaw, endRaw)
	if err != nil {
		return nil, err
	}
	body, err := s.getZonar(ctx, secret, url.Values{
		"action":       {"showposition"},
		"operation":    {"idlestopallidle"},
		"format":       {"xml"},
		"idletimecomp": {"<"},
		"idletime":     {"0:30:00"},
		"reqtype":      {"dbid"},
		"target":       {strconv.Itoa(vehicle.ZonarAssetID)},
		"fromdate":     {strconv.FormatInt(start.UTC().Unix(), 10)},
		"todate":       {strconv.FormatInt(end.UTC().Unix(), 10)},
	})
	if err != nil {
		return nil, err
	}
	stops := parseZonarIdles(body, ottawaLocation())
	if stops == nil {
		stops = []ZonarIdleStop{}
	}
	return &ZonarIdleReport{
		VehicleID:  vehicle.VehicleID,
		UnitNumber: vehicle.UnitNumber,
		Persisted:  false,
		Stops:      stops,
	}, nil
}

func (s *ZonarService) prepareLiveRead(ctx context.Context, vehicleID, startRaw, endRaw string) (*models.Vehicle, zonarSecret, time.Time, time.Time, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return nil, zonarSecret{}, time.Time{}, time.Time{}, err
	}
	if !secret.Enabled {
		return nil, zonarSecret{}, time.Time{}, time.Time{}, fmt.Errorf("Zonar sync is turned off")
	}
	if !secret.ready() {
		return nil, zonarSecret{}, time.Time{}, time.Time{}, fmt.Errorf("Zonar password is not configured")
	}
	vehicle, err := s.vehicleByID(ctx, vehicleID)
	if err != nil {
		return nil, zonarSecret{}, time.Time{}, time.Time{}, err
	}
	if vehicle.ZonarAssetID == 0 {
		return nil, zonarSecret{}, time.Time{}, time.Time{}, fmt.Errorf("vehicle has no Zonar asset")
	}
	start, end, err := traceWindow(startRaw, endRaw, ottawaLocation())
	if err != nil {
		return nil, zonarSecret{}, time.Time{}, time.Time{}, err
	}
	return vehicle, secret, start, end, nil
}

func (s *ZonarService) vehicleByID(ctx context.Context, id string) (*models.Vehicle, error) {
	id = strings.TrimSpace(id)
	if id == "" || id == "0" {
		return nil, fmt.Errorf("vehicle id is required")
	}
	if s.vehicles == nil {
		return nil, fmt.Errorf("vehicle store is not configured")
	}
	if vehicle, err := s.vehicles.GetVehicleByID(ctx, id); err == nil && vehicle != nil {
		return vehicle, nil
	}
	vehicles, err := s.vehicles.ListVehicles(ctx, repository.VehicleFilter{})
	if err != nil {
		return nil, err
	}
	for _, vehicle := range vehicles {
		if strconv.Itoa(vehicle.VehicleID) == id {
			return vehicle, nil
		}
	}
	return nil, fmt.Errorf("vehicle not found")
}

func (s *ZonarService) getZonar(ctx context.Context, secret zonarSecret, query url.Values) ([]byte, error) {
	query.Set("customer", secret.Customer)
	query.Set("username", secret.Username)
	query.Set("password", secret.Password)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.endpoint+"?"+query.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Zonar Systems API-Test 8.2.1")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Zonar returned %d", resp.StatusCode)
	}
	return body, nil
}

func traceWindow(startRaw, endRaw string, loc *time.Location) (time.Time, time.Time, error) {
	start, err := parseTraceBound(startRaw, loc)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("start and end are required")
	}
	end, err := parseTraceBound(endRaw, loc)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("start and end are required")
	}
	if !end.After(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("end must be after start")
	}
	if end.Sub(start) > zonarTraceMaxRange {
		return time.Time{}, time.Time{}, fmt.Errorf("trace range must be 24 hours or less")
	}
	return start, end, nil
}

func parseTraceBound(raw string, loc *time.Location) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, fmt.Errorf("empty")
	}
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed, nil
	}
	for _, layout := range []string{"2006-01-02T15:04", "2006-01-02 15:04", "2006-01-02T15:04:05", "2006-01-02 15:04:05"} {
		if parsed, err := time.ParseInLocation(layout, raw, loc); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid time")
}

type pathEventXML struct {
	Lat     string `xml:"lat,attr"`
	Long    string `xml:"long,attr"`
	Time    string `xml:"time,attr"`
	Speed   string `xml:"speed,attr"`
	Heading string `xml:"heading,attr"`
}

type idleEventXML struct {
	From    string `xml:"from,attr"`
	To      string `xml:"to,attr"`
	LatLong string `xml:"latlong,attr"`
}

func parseZonarPath(data []byte, loc *time.Location) []ZonarTracePoint {
	points := make([]ZonarTracePoint, 0)
	dec := xml.NewDecoder(bytes.NewReader(data))
	for {
		token, err := dec.Token()
		if err != nil {
			break
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "event" {
			continue
		}
		var event pathEventXML
		if err := dec.DecodeElement(&event, &start); err != nil {
			continue
		}
		lat, latOK := strconv.ParseFloat(strings.TrimSpace(event.Lat), 64)
		lng, lngOK := strconv.ParseFloat(strings.TrimSpace(event.Long), 64)
		observed, timeOK := parseTraceBound(event.Time, time.UTC)
		if latOK != nil || lngOK != nil || timeOK != nil {
			continue
		}
		speed, _ := strconv.ParseFloat(strings.TrimSpace(event.Speed), 64)
		points = append(points, ZonarTracePoint{
			Lat:        lat,
			Lng:        lng,
			ObservedAt: observed.In(loc).Format(time.RFC3339),
			SpeedKmh:   speed,
			Heading:    zonarHeadingDegrees(event.Heading),
		})
	}
	return points
}

func parseZonarIdles(data []byte, loc *time.Location) []ZonarIdleStop {
	stops := make([]ZonarIdleStop, 0)
	dec := xml.NewDecoder(bytes.NewReader(data))
	epoch := time.Unix(0, 0).UTC()
	for {
		token, err := dec.Token()
		if err != nil {
			break
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "event" {
			continue
		}
		var event idleEventXML
		if err := dec.DecodeElement(&event, &start); err != nil {
			continue
		}
		fromSec, fromOK := strconv.ParseInt(strings.TrimSpace(event.From), 10, 64)
		toSec, toOK := strconv.ParseInt(strings.TrimSpace(event.To), 10, 64)
		parts := strings.Split(event.LatLong, ",")
		if fromOK != nil || toOK != nil || len(parts) != 2 {
			continue
		}
		lat, latOK := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
		lng, lngOK := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		if latOK != nil || lngOK != nil || toSec < fromSec {
			continue
		}
		startAt := epoch.Add(time.Duration(fromSec) * time.Second).In(loc)
		endAt := epoch.Add(time.Duration(toSec) * time.Second).In(loc)
		stops = append(stops, ZonarIdleStop{
			Lat:             lat,
			Lng:             lng,
			StartTime:       startAt.Format(time.RFC3339),
			EndTime:         endAt.Format(time.RFC3339),
			DurationSeconds: int(toSec - fromSec),
		})
	}
	return stops
}

func zonarHeadingDegrees(heading string) int {
	dRet := 0
	switch strings.ToUpper(strings.TrimSpace(heading)) {
	case "E":
		dRet = 0
	case "NEE":
		dRet = 22
	case "NE":
		dRet = 45
	case "NNE":
		dRet = 67
	case "N":
		dRet = 90
	case "NNW":
		dRet = 112
	case "NW":
		dRet = 135
	case "NWW":
		dRet = 157
	case "W":
		dRet = 180
	case "SWW":
		dRet = 202
	case "SW":
		dRet = 225
	case "SSW":
		dRet = 247
	case "S":
		dRet = 270
	case "SSE":
		dRet = 292
	case "SE":
		dRet = 315
	case "SEE":
		dRet = 337
	}
	return 360 - (dRet - 90)
}
