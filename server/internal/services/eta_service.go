package services

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"dispatch-server/internal/models"
)

type ETAService struct{}

func NewETAService() *ETAService {
	return &ETAService{}
}

// CalculateHaversineDistance returns straight-line distance in kilometers
func (s *ETAService) CalculateHaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKm = 6371.0

	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)

	rLat1 := lat1 * (math.Pi / 180.0)
	rLat2 := lat2 * (math.Pi / 180.0)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(rLat1)*math.Cos(rLat2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return math.Round(earthRadiusKm*c*100) / 100
}

// EstimateTravelMinutes estimates transit minutes based on distance and average urban bus speed (30 km/h)
func (s *ETAService) EstimateTravelMinutes(distanceKm float64, interveningStops int) int {
	if distanceKm <= 0.05 {
		return 0
	}
	// Average speed in suburban/city traffic: ~28 km/h -> ~2.14 mins per km
	driveMins := distanceKm * 2.14
	// Stop dwell time (boarding/alighting): ~1.5 mins per intermediate stop
	dwellMins := float64(interveningStops) * 1.5
	total := int(math.Ceil(driveMins + dwellMins))
	if total < 1 {
		total = 1
	}
	return total
}

// CalculateCommuteETA computes dynamic arrival time, distance, and status
func (s *ETAService) CalculateCommuteETA(
	schedTime string,
	lateMinutes int,
	stopLat, stopLon *float64,
	vehLoc *models.VehicleLiveLocation,
	stopSeq int,
	isBoarded bool,
	isDroppedOff bool,
) (estimatedTime string, distanceKm *float64, minutesAway *int, status string) {
	if isDroppedOff {
		return schedTime, nil, nil, "DROPPED_OFF"
	}
	if isBoarded {
		return schedTime, nil, nil, "BOARDED"
	}

	// Default estimated time is scheduled time adjusted by known dispatch lateMinutes
	estimatedTime = AddMinutesToTimeString(schedTime, lateMinutes)

	// If no real-time telemetry is available, return schedule-based status
	if vehLoc == nil || vehLoc.Latitude == 0 || vehLoc.Longitude == 0 {
		if lateMinutes >= 10 {
			status = "DELAYED"
		} else {
			status = "SCHEDULED"
		}
		return
	}

	// Calculate distance if stop coordinates are present
	if stopLat != nil && stopLon != nil && *stopLat != 0 && *stopLon != 0 {
		dist := s.CalculateHaversineDistance(vehLoc.Latitude, vehLoc.Longitude, *stopLat, *stopLon)
		distanceKm = &dist

		intervening := stopSeq - vehLoc.CurrentStopSequence
		if intervening < 0 {
			intervening = 0
		}
		mins := s.EstimateTravelMinutes(dist, intervening)
		minutesAway = &mins

		// Format estimated arrival clock time
		now := time.Now()
		locTime := now.Add(time.Duration(mins) * time.Minute)
		estimatedTime = locTime.Format("15:04")

		if mins <= 5 || dist <= 1.0 {
			status = "APPROACHING"
		} else if lateMinutes >= 10 {
			status = "DELAYED"
		} else {
			status = "EN_ROUTE"
		}
		return
	}

	// Fallback when coordinates are missing
	if lateMinutes >= 10 {
		status = "DELAYED"
	} else if vehLoc.Status != "" {
		status = vehLoc.Status
	} else {
		status = "EN_ROUTE"
	}
	return
}

// AddMinutesToTimeString adds or subtracts minutes from HH:MM time string
func AddMinutesToTimeString(tStr string, mins int) string {
	if len(tStr) < 5 {
		return tStr
	}
	parts := strings.Split(tStr, ":")
	if len(parts) < 2 {
		return tStr
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return tStr
	}
	total := h*60 + m + mins
	if total < 0 {
		total = 0
	}
	return fmt.Sprintf("%02d:%02d", (total/60)%24, total%60)
}
