package repository

import (
	"strings"
	"testing"
)

func TestVehicleServiceHoldReason(t *testing.T) {
	if got := VehicleServiceHoldReason("In Service", true, "1001"); got != "" {
		t.Fatalf("in service bus was blocked: %s", got)
	}
	if got := VehicleServiceHoldReason("Spare", true, "1001"); got != "" {
		t.Fatalf("spare bus was blocked: %s", got)
	}
	got := VehicleServiceHoldReason("Out of Service", true, "42")
	if !strings.Contains(got, "42") || !strings.Contains(got, "Out of Service") {
		t.Fatalf("status hold = %q", got)
	}
	got = VehicleServiceHoldReason("In Service", false, "42")
	if !strings.Contains(got, "42") || !strings.Contains(got, "out of service") {
		t.Fatalf("inactive hold = %q", got)
	}
}

func TestPreTripOperationBlockReason(t *testing.T) {
	if got := PreTripOperationBlockReason("1001", "passed"); got != "" {
		t.Fatalf("passed inspection was blocked: %s", got)
	}
	if got := PreTripOperationBlockReason("1001", "passed_with_minor_defects"); got != "" {
		t.Fatalf("minor-defect inspection was blocked: %s", got)
	}
	if got := PreTripOperationBlockReason("1001", ""); got != "" {
		t.Fatalf("legacy inspection was blocked: %s", got)
	}
	got := PreTripOperationBlockReason("42", "failed_major_defects")
	if !strings.Contains(got, "42") || !strings.Contains(got, "major defect") {
		t.Fatalf("major-defect hold = %q", got)
	}
}
