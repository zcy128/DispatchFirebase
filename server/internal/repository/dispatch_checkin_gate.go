package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"google.golang.org/api/iterator"
)

// CheckInBlockedError is returned when a driver check-in would start a bus
// that is out of service or has no Schedule 5 inspection for the local day.
type CheckInBlockedError struct {
	Reason string
}

func (e *CheckInBlockedError) Error() string {
	if e == nil {
		return ""
	}
	return e.Reason
}

// VehicleServiceHoldReason reports why a fleet status cannot leave the yard.
// An unknown vehicle is not treated as out of service.
func VehicleServiceHoldReason(status string, active bool, unit string) string {
	unit = strings.TrimSpace(unit)
	if !active {
		return fmt.Sprintf("Check-in is blocked because bus %s is out of service.", unit)
	}
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "maintenance", "out of service", "in inspection", "periodic inspection", "defective", "under repair":
		return fmt.Sprintf("Check-in is blocked because bus %s is %s.", unit, strings.TrimSpace(status))
	default:
		return ""
	}
}

func (r *FirestoreDispatchRepository) rejectDriverCheckIn(ctx context.Context, unitNumber string) error {
	unit := strings.TrimSpace(unitNumber)
	if unit == "" {
		return &CheckInBlockedError{Reason: "Check-in is blocked because this run has no bus assigned."}
	}

	found, status, active, err := r.lookupVehicleService(ctx, unit)
	if err != nil {
		return err
	}
	if found {
		if reason := VehicleServiceHoldReason(status, active, unit); reason != "" {
			return &CheckInBlockedError{Reason: reason}
		}
	}

	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		loc = time.UTC
	}
	date := time.Now().In(loc).Format("2006-01-02")
	inspection, err := r.GetPreTripInspectionToday(ctx, unit, date)
	if err != nil {
		return err
	}
	if inspection == nil {
		return &CheckInBlockedError{
			Reason: fmt.Sprintf("Check-in is blocked until the Schedule 5 pre-trip inspection is complete for bus %s.", unit),
		}
	}
	return nil
}

func (r *FirestoreDispatchRepository) lookupVehicleService(ctx context.Context, unit string) (bool, string, bool, error) {
	iter := r.client.Collection(r.vehicleColl).Where("unitNumber", "==", unit).Limit(1).Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return false, "", true, nil
	}
	if err != nil {
		return false, "", true, err
	}
	data := doc.Data()
	status, _ := data["status"].(string)
	active := true
	if raw, ok := data["active"]; ok {
		if value, ok := raw.(bool); ok {
			active = value
		}
	}
	return true, status, active, nil
}
