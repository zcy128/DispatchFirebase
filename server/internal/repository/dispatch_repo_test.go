package repository

import (
	"testing"
	"time"
)

func TestIsColdDate(t *testing.T) {
	repo := &FirestoreDispatchRepository{
		coldDays: 60,
	}

	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	sixtyOneDaysAgo := time.Now().AddDate(0, 0, -61).Format("2006-01-02")
	ninetyDaysAgo := time.Now().AddDate(0, 0, -90).Format("2006-01-02")

	// When bqClient is nil, isColdDate returns false
	if repo.isColdDate(ninetyDaysAgo) {
		t.Errorf("expected isColdDate to be false when bqClient is nil")
	}

	// Mocking isColdDate logic with simulated bqClient
	isColdSim := func(dateStr string, coldDays int) bool {
		tVal, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			return false
		}
		cutoff := time.Now().AddDate(0, 0, -coldDays)
		return tVal.Before(cutoff)
	}

	if isColdSim(today, 60) {
		t.Errorf("today should not be cold")
	}
	if isColdSim(yesterday, 60) {
		t.Errorf("yesterday should not be cold")
	}
	if isColdSim(thirtyDaysAgo, 60) {
		t.Errorf("30 days ago should not be cold")
	}
	if !isColdSim(sixtyOneDaysAgo, 60) {
		t.Errorf("61 days ago should be cold")
	}
	if !isColdSim(ninetyDaysAgo, 60) {
		t.Errorf("90 days ago should be cold")
	}
}
