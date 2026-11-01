package repository

import (
	"context"
	"testing"

	"dispatch-server/internal/models"
)

func TestMemoryVehicleUpdateKeepsInspectionFields(t *testing.T) {
	repo := NewInMemoryVehicleRepository()
	created, err := repo.CreateVehicle(context.Background(), &models.Vehicle{
		UnitNumber:              "QA9901",
		PlateNumber:             "QA-9901",
		LastInspectionDate:      "2026-11-01",
		NextInspectionDue:       "2027-05-01",
		HasInVehicleCertificate: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.LastInspectionDate != "2026-11-01" || created.NextInspectionDue != "2027-05-01" {
		t.Fatalf("create dropped inspection dates: %+v", created)
	}

	updated, err := repo.UpdateVehicle(context.Background(), created.ID, map[string]interface{}{
		"plateNumber":                     "QA-9901B",
		"lastInspectionDate":              "2026-11-01",
		"nextInspectionDue":               "2027-05-01",
		"inspectionCertificateNumber":     "DOC-ON-10882",
		"inspectionStickerNumber":         "STK-2026-901",
		"hasInVehicleCertificate":         false,
		"hasDetailedMeasurementsArchived": true,
		"hasProofOfRepairsAttached":       true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.PlateNumber != "QA-9901B" ||
		updated.LastInspectionDate != "2026-11-01" ||
		updated.NextInspectionDue != "2027-05-01" ||
		updated.InspectionCertificateNumber != "DOC-ON-10882" ||
		updated.InspectionStickerNumber != "STK-2026-901" ||
		updated.HasInVehicleCertificate ||
		!updated.HasDetailedMeasurementsArchived ||
		!updated.HasProofOfRepairsAttached {
		t.Fatalf("update dropped inspection fields: %+v", updated)
	}
}
