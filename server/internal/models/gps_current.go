package models

import (
	"strings"
	"time"
)

const GpsCurrentCollection = "gps_current"

// GpsCurrentPosition is the latest Zonar fix for one vehicle.
// The document id is the normalized unit number, so a new sync replaces the row
// instead of keeping a history.
type GpsCurrentPosition struct {
	AssetID    string    `json:"assetId" firestore:"assetId"`
	UnitNumber string    `json:"unitNumber" firestore:"unitNumber"`
	Fleet      string    `json:"fleet" firestore:"fleet"`
	Latitude   float64   `json:"latitude" firestore:"latitude"`
	Longitude  float64   `json:"longitude" firestore:"longitude"`
	Heading    float64   `json:"heading" firestore:"heading"`
	SpeedKmh   float64   `json:"speedKmh" firestore:"speedKmh"`
	Power      string    `json:"power,omitempty" firestore:"power,omitempty"`
	Address    string    `json:"address,omitempty" firestore:"address,omitempty"`
	ObservedAt time.Time `json:"observedAt" firestore:"observedAt"`
	UpdatedAt  time.Time `json:"updatedAt" firestore:"updatedAt"`
}

// NormalizeFleetUnit turns a Zonar fleet name or a dispatch unit into one lookup key.
// "4S-1003 D" and "#1003" both become "1003".
func NormalizeFleetUnit(raw string) string {
	s := strings.ToUpper(strings.TrimSpace(raw))
	s = strings.TrimPrefix(s, "4S-")
	s = strings.TrimPrefix(s, "#")
	s = strings.TrimSpace(s)
	if i := strings.IndexAny(s, " \t"); i > 0 {
		s = s[:i]
	}
	return s
}

// LiveLocation is the shape already used by parent tracking and dispatch lookups.
func (p GpsCurrentPosition) LiveLocation() *VehicleLiveLocation {
	status := "EN_ROUTE"
	if strings.EqualFold(p.Power, "off") {
		status = "STOPPED"
	}
	updated := p.ObservedAt
	if updated.IsZero() {
		updated = p.UpdatedAt
	}
	return &VehicleLiveLocation{
		UnitNumber:       p.UnitNumber,
		Latitude:         p.Latitude,
		Longitude:        p.Longitude,
		Heading:          p.Heading,
		SpeedKmh:         p.SpeedKmh,
		LastUpdated:      updated,
		NextStopLocation: p.Address,
		Status:           status,
	}
}
