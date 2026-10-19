package repository

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
	"log"
)

var (
	ErrPayrollRateNotFound = errors.New("payroll rate not found")
)

type PayrollRepository interface {
	List(ctx context.Context) ([]*models.BusRoutePayrollRate, error)
	GetByID(ctx context.Context, id string) (*models.BusRoutePayrollRate, error)
	GetCustomRates(ctx context.Context) ([]*models.BusRoutePayrollRate, error)
	GetSchoolBoardBaseRates(ctx context.Context, boards []*models.SchoolBoard) ([]*models.SchoolBoardBaseRatesDTO, error)
	Create(ctx context.Context, rate *models.BusRoutePayrollRate) (*models.BusRoutePayrollRate, error)
	Update(ctx context.Context, rate *models.BusRoutePayrollRate) (*models.BusRoutePayrollRate, error)
	Delete(ctx context.Context, id string) error
	ResolveRate(ctx context.Context, req *models.RateCalculationRequest) (*models.RateCalculationResponse, error)
}

// -------------------------------------------------------------
// Firestore Implementation
// -------------------------------------------------------------

type FirestorePayrollRepository struct {
	client *firestore.Client
	coll   string
}

func NewFirestorePayrollRepository(client *firestore.Client) *FirestorePayrollRepository {
	return &FirestorePayrollRepository{
		client: client,
		coll:   "busroute_payroll_rates",
	}
}

func (r *FirestorePayrollRepository) List(ctx context.Context) ([]*models.BusRoutePayrollRate, error) {
	iter := r.client.Collection(r.coll).Documents(ctx)
	defer iter.Stop()

	var result []*models.BusRoutePayrollRate
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rate models.BusRoutePayrollRate
		if err := doc.DataTo(&rate); err != nil {
			continue
		}
		if rate.ID == "" {
			rate.ID = doc.Ref.ID
		}
		result = append(result, &rate)
	}

	if len(result) == 0 {
		return GetDefaultPayrollRates(), nil
	}
	return result, nil
}

func (r *FirestorePayrollRepository) GetByID(ctx context.Context, id string) (*models.BusRoutePayrollRate, error) {
	doc, err := r.client.Collection(r.coll).Doc(id).Get(ctx)
	if err != nil {
		return nil, ErrPayrollRateNotFound
	}
	var rate models.BusRoutePayrollRate
	if err := doc.DataTo(&rate); err != nil {
		return nil, err
	}
	if rate.ID == "" {
		rate.ID = doc.Ref.ID
	}
	return &rate, nil
}

func (r *FirestorePayrollRepository) GetCustomRates(ctx context.Context) ([]*models.BusRoutePayrollRate, error) {
	all, err := r.List(ctx)
	if err != nil {
		return nil, err
	}
	var custom []*models.BusRoutePayrollRate
	for _, r := range all {
		if r.RouteID != nil || r.ShiftID != nil || r.EmployeeID != nil || (r.WeekDays != "" && r.WeekDays != "Weekdays" && r.WeekDays != "MTWRF") {
			custom = append(custom, r)
		}
	}
	return custom, nil
}

func (r *FirestorePayrollRepository) GetSchoolBoardBaseRates(ctx context.Context, boards []*models.SchoolBoard) ([]*models.SchoolBoardBaseRatesDTO, error) {
	all, err := r.List(ctx)
	if err != nil {
		return nil, err
	}
	return AggregateSchoolBoardBaseRates(boards, all), nil
}

func (r *FirestorePayrollRepository) Create(ctx context.Context, rate *models.BusRoutePayrollRate) (*models.BusRoutePayrollRate, error) {
	if rate.ID == "" {
		rate.ID = fmt.Sprintf("PR-%d", time.Now().UnixNano()/1000000)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	rate.CreatedAt = now
	rate.UpdatedAt = now

	_, err := r.client.Collection(r.coll).Doc(rate.ID).Set(ctx, rate)
	if err != nil {
		return nil, err
	}
	return rate, nil
}

func (r *FirestorePayrollRepository) Update(ctx context.Context, rate *models.BusRoutePayrollRate) (*models.BusRoutePayrollRate, error) {
	rate.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if rate.CreatedAt == nil || rate.CreatedAt == "" {
		if existing, err := r.GetByID(ctx, rate.ID); err == nil && existing != nil && existing.CreatedAt != nil {
			rate.CreatedAt = existing.CreatedAt
		} else {
			rate.CreatedAt = rate.UpdatedAt
		}
	}
	_, err := r.client.Collection(r.coll).Doc(rate.ID).Set(ctx, rate)
	if err != nil {
		log.Printf("[ERROR] Firestore Update Set failed for rate %s: %v", rate.ID, err)
		return nil, err
	}
	return rate, nil
}

func (r *FirestorePayrollRepository) Delete(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.coll).Doc(id).Delete(ctx)
	return err
}

func (r *FirestorePayrollRepository) ResolveRate(ctx context.Context, req *models.RateCalculationRequest) (*models.RateCalculationResponse, error) {
	all, err := r.List(ctx)
	if err != nil {
		return nil, err
	}
	return EvaluateRateHierarchy(all, req), nil
}

// -------------------------------------------------------------
// In-Memory Fallback Implementation
// -------------------------------------------------------------

type MemoryPayrollRepository struct {
	mu    sync.RWMutex
	rates map[string]*models.BusRoutePayrollRate
}

func NewMemoryPayrollRepository() *MemoryPayrollRepository {
	repo := &MemoryPayrollRepository{
		rates: make(map[string]*models.BusRoutePayrollRate),
	}
	defaults := GetDefaultPayrollRates()
	for _, rate := range defaults {
		repo.rates[rate.ID] = rate
	}
	return repo
}

func (m *MemoryPayrollRepository) List(ctx context.Context) ([]*models.BusRoutePayrollRate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.BusRoutePayrollRate, 0, len(m.rates))
	for _, r := range m.rates {
		res = append(res, r)
	}
	sort.Slice(res, func(i, j int) bool {
		return res[i].ID < res[j].ID
	})
	return res, nil
}

func (m *MemoryPayrollRepository) GetByID(ctx context.Context, id string) (*models.BusRoutePayrollRate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if r, ok := m.rates[id]; ok {
		return r, nil
	}
	return nil, ErrPayrollRateNotFound
}

func (m *MemoryPayrollRepository) GetCustomRates(ctx context.Context) ([]*models.BusRoutePayrollRate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var custom []*models.BusRoutePayrollRate
	for _, r := range m.rates {
		if r.RouteID != nil || r.ShiftID != nil || r.EmployeeID != nil || (r.WeekDays != "" && r.WeekDays != "Weekdays" && r.WeekDays != "MTWRF") {
			custom = append(custom, r)
		}
	}
	sort.Slice(custom, func(i, j int) bool {
		return custom[i].ID < custom[j].ID
	})
	return custom, nil
}

func (m *MemoryPayrollRepository) GetSchoolBoardBaseRates(ctx context.Context, boards []*models.SchoolBoard) ([]*models.SchoolBoardBaseRatesDTO, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	all := make([]*models.BusRoutePayrollRate, 0, len(m.rates))
	for _, r := range m.rates {
		all = append(all, r)
	}
	return AggregateSchoolBoardBaseRates(boards, all), nil
}

func (m *MemoryPayrollRepository) Create(ctx context.Context, rate *models.BusRoutePayrollRate) (*models.BusRoutePayrollRate, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if rate.NumericID == 0 {
		rate.NumericID = len(m.rates) + 100
	}
	if rate.ID == "" {
		rate.ID = "PR-" + strconv.Itoa(rate.NumericID)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	rate.CreatedAt = now
	rate.UpdatedAt = now
	m.rates[rate.ID] = rate
	return rate, nil
}

func (m *MemoryPayrollRepository) Update(ctx context.Context, rate *models.BusRoutePayrollRate) (*models.BusRoutePayrollRate, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rate.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	m.rates[rate.ID] = rate
	return rate, nil
}

func (m *MemoryPayrollRepository) Delete(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rates, id)
	return nil
}

func (m *MemoryPayrollRepository) ResolveRate(ctx context.Context, req *models.RateCalculationRequest) (*models.RateCalculationResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	all := make([]*models.BusRoutePayrollRate, 0, len(m.rates))
	for _, r := range m.rates {
		all = append(all, r)
	}
	return EvaluateRateHierarchy(all, req), nil
}

// -------------------------------------------------------------
// Helper Calculation & Aggregation Functions
// -------------------------------------------------------------

func ptrFloat(v float64) *float64 {
	return &v
}

func ptrInt(v int) *int {
	return &v
}

func isDateActive(targetDate, effDate string, retDate *string) bool {
	if targetDate == "" {
		targetDate = time.Now().Format("2006-01-02")
	}
	if effDate != "" && effDate > targetDate {
		return false
	}
	if retDate != nil && *retDate != "" && *retDate < targetDate {
		return false
	}
	return true
}

func getDayLetter(dateStr string) rune {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return 0
	}
	switch t.Weekday() {
	case time.Monday:
		return 'M'
	case time.Tuesday:
		return 'T'
	case time.Wednesday:
		return 'W'
	case time.Thursday:
		return 'R'
	case time.Friday:
		return 'F'
	default:
		return 0
	}
}

func matchesWeekday(targetDate, weekDays string) bool {
	if weekDays == "" || weekDays == "Weekdays" || weekDays == "MTWRF" || weekDays == "ALL" {
		return true
	}
	letter := getDayLetter(targetDate)
	if letter == 0 {
		return true
	}
	return strings.ContainsRune(strings.ToUpper(weekDays), letter)
}

func AggregateSchoolBoardBaseRates(boards []*models.SchoolBoard, rates []*models.BusRoutePayrollRate) []*models.SchoolBoardBaseRatesDTO {
	result := make([]*models.SchoolBoardBaseRatesDTO, 0, len(boards))

	// Find base rates: RouteID == nil && ShiftID == nil && EmployeeID == nil
	for _, b := range boards {
		dto := &models.SchoolBoardBaseRatesDTO{
			SchoolBoardID:   b.SchoolBoardID,
			SchoolBoardName: b.SchoolBoardName,
			SchoolBoardCode: b.SchoolBoardCode,
		}

		for _, r := range rates {
			if r.SchoolBoardID != b.SchoolBoardID {
				continue
			}
			// Only base rates (no route, no shift, no employee override)
			if r.RouteID != nil || r.ShiftID != nil || r.EmployeeID != nil {
				continue
			}

			jobTitle := strings.ToLower(strings.TrimSpace(r.JobTitle))
			shiftType := strings.ToUpper(strings.TrimSpace(r.ShiftType))

			shiftRate := models.SchoolBoardShiftRate{
				RateID:        r.ID,
				PayRate:       r.PayRate,
				EiHours:       r.EiHours,
				EffectiveDate: r.EffectiveDate,
				RetireDate:    r.RetireDate,
			}

			if jobTitle == "driver" || jobTitle == "" {
				switch shiftType {
				case "AM":
					dto.Driver.AM = shiftRate
				case "MIDDAY", "NOON":
					dto.Driver.Midday = shiftRate
				case "PM":
					dto.Driver.PM = shiftRate
				default:
					dto.Driver.All = shiftRate
				}
			} else if jobTitle == "attendant" {
				switch shiftType {
				case "AM":
					dto.Attendant.AM = shiftRate
				case "MIDDAY", "NOON":
					dto.Attendant.Midday = shiftRate
				case "PM":
					dto.Attendant.PM = shiftRate
				default:
					dto.Attendant.All = shiftRate
				}
			}
		}

		result = append(result, dto)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].SchoolBoardName < result[j].SchoolBoardName
	})

	return result
}

// EvaluateRateHierarchy implements the 4-tier rate resolution hierarchy:
// Tier 1: Route / Shift + Employee specific match
// Tier 2: Employee General Override
// Tier 3: Route / Shift General Override
// Tier 4: School Board Baseline (by JobTitle + ShiftType)
func EvaluateRateHierarchy(rates []*models.BusRoutePayrollRate, req *models.RateCalculationRequest) *models.RateCalculationResponse {
	targetDate := req.Date
	if targetDate == "" {
		targetDate = time.Now().Format("2006-01-02")
	}
	reqJob := strings.ToLower(strings.TrimSpace(req.JobTitle))
	reqShift := strings.ToUpper(strings.TrimSpace(req.ShiftType))

	// Filter rates active on date and matching weekday (MTWRF)
	var activeRates []*models.BusRoutePayrollRate
	for _, r := range rates {
		if isDateActive(targetDate, r.EffectiveDate, r.RetireDate) && matchesWeekday(targetDate, r.WeekDays) {
			activeRates = append(activeRates, r)
		}
	}

	// 1. Tier 1: Route/Shift + Employee specific match
	if req.EmployeeID != nil && (req.RouteID != nil || req.ShiftID != nil) {
		for _, r := range activeRates {
			if r.EmployeeID != nil && *r.EmployeeID == *req.EmployeeID {
				routeMatch := req.RouteID != nil && r.RouteID != nil && *r.RouteID == *req.RouteID
				shiftMatch := req.ShiftID != nil && r.ShiftID != nil && *r.ShiftID == *req.ShiftID
				if routeMatch || shiftMatch {
					// Check optional shiftType & jobTitle matching
					if (r.JobTitle == "" || strings.ToLower(r.JobTitle) == reqJob) &&
						(r.ShiftType == "" || strings.ToUpper(r.ShiftType) == reqShift) {
						var pay, ei float64
						if r.PayRate != nil {
							pay = *r.PayRate
						}
						if r.EiHours != nil {
							ei = *r.EiHours
						}
						return &models.RateCalculationResponse{
							MatchedTier:     1,
							MatchedRuleDesc: fmt.Sprintf("Tier 1: Route/Shift #%v + Employee #%v Specific Override", *req.RouteID, *req.EmployeeID),
							PayRate:         pay,
							EiHours:         ei,
							AppliedRate:     r,
						}
					}
				}
			}
		}
	}

	// 2. Tier 2: Employee General Override (Employee set, Route and Shift null)
	if req.EmployeeID != nil {
		for _, r := range activeRates {
			if r.EmployeeID != nil && *r.EmployeeID == *req.EmployeeID && r.RouteID == nil && r.ShiftID == nil {
				if (r.JobTitle == "" || strings.ToLower(r.JobTitle) == reqJob) &&
					(r.ShiftType == "" || strings.ToUpper(r.ShiftType) == reqShift) {
					var pay, ei float64
					if r.PayRate != nil {
						pay = *r.PayRate
					}
					if r.EiHours != nil {
						ei = *r.EiHours
					}
					return &models.RateCalculationResponse{
						MatchedTier:     2,
						MatchedRuleDesc: fmt.Sprintf("Tier 2: Employee #%v General Rate Override", *req.EmployeeID),
						PayRate:         pay,
						EiHours:         ei,
						AppliedRate:     r,
					}
				}
			}
		}
	}

	// 3. Tier 3: Route / Shift General Override (Route/Shift set, Employee null)
	if req.RouteID != nil || req.ShiftID != nil {
		for _, r := range activeRates {
			if r.EmployeeID == nil {
				routeMatch := req.RouteID != nil && r.RouteID != nil && *r.RouteID == *req.RouteID
				shiftMatch := req.ShiftID != nil && r.ShiftID != nil && *r.ShiftID == *req.ShiftID
				if routeMatch || shiftMatch {
					if (r.JobTitle == "" || strings.ToLower(r.JobTitle) == reqJob) &&
						(r.ShiftType == "" || strings.ToUpper(r.ShiftType) == reqShift) {
						var pay, ei float64
						if r.PayRate != nil {
							pay = *r.PayRate
						}
						if r.EiHours != nil {
							ei = *r.EiHours
						}
						return &models.RateCalculationResponse{
							MatchedTier:     3,
							MatchedRuleDesc: fmt.Sprintf("Tier 3: Route/Shift General Override"),
							PayRate:         pay,
							EiHours:         ei,
							AppliedRate:     r,
						}
					}
				}
			}
		}
	}

	// 4. Tier 4: School Board Baseline
	if req.SchoolBoardID > 0 {
		var fallbackRate *models.BusRoutePayrollRate
		for _, r := range activeRates {
			if r.SchoolBoardID == req.SchoolBoardID && r.RouteID == nil && r.ShiftID == nil && r.EmployeeID == nil {
				rJob := strings.ToLower(strings.TrimSpace(r.JobTitle))
				rShift := strings.ToUpper(strings.TrimSpace(r.ShiftType))

				if rJob == reqJob || rJob == "" {
					if rShift == reqShift {
						var pay, ei float64
						if r.PayRate != nil {
							pay = *r.PayRate
						}
						if r.EiHours != nil {
							ei = *r.EiHours
						}
						return &models.RateCalculationResponse{
							MatchedTier:     4,
							MatchedRuleDesc: fmt.Sprintf("Tier 4: School Board #%d Base Rate (%s %s)", req.SchoolBoardID, strings.ToUpper(reqJob), reqShift),
							PayRate:         pay,
							EiHours:         ei,
							AppliedRate:     r,
						}
					}
					if rShift == "" || rShift == "ALL" {
						fallbackRate = r
					}
				}
			}
		}

		if fallbackRate != nil {
			var pay, ei float64
			if fallbackRate.PayRate != nil {
				pay = *fallbackRate.PayRate
			}
			if fallbackRate.EiHours != nil {
				ei = *fallbackRate.EiHours
			}
			return &models.RateCalculationResponse{
				MatchedTier:     4,
				MatchedRuleDesc: fmt.Sprintf("Tier 4: School Board #%d Default Base Rate (%s)", req.SchoolBoardID, strings.ToUpper(reqJob)),
				PayRate:         pay,
				EiHours:         ei,
				AppliedRate:     fallbackRate,
			}
		}
	}

	// Default fallback if nothing configured
	defaultPay := 35.0
	defaultEi := 2.5
	if reqJob == "attendant" {
		defaultPay = 24.0
	}
	return &models.RateCalculationResponse{
		MatchedTier:     0,
		MatchedRuleDesc: "Default System Baseline (No rule matched)",
		PayRate:         defaultPay,
		EiHours:         defaultEi,
		AppliedRate:     nil,
	}
}

// GetDefaultPayrollRates provides initial seeded rates
func GetDefaultPayrollRates() []*models.BusRoutePayrollRate {
	effDate := "2026-09-01"

	return []*models.BusRoutePayrollRate{
		// OCDSB (5) - Driver Base Rates
		{
			ID:              "PR-BASE-5-DRV-AM",
			NumericID:       1,
			SchoolBoardID:   5,
			SchoolBoardName: "Ottawa-Carleton District School Board",
			SchoolBoardCode: "OCDSB",
			JobTitle:        "driver",
			ShiftType:       "AM",
			PayRate:         ptrFloat(42.50),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
			Notes:           "OCDSB Standard Driver AM Shift Base",
		},
		{
			ID:              "PR-BASE-5-DRV-MID",
			NumericID:       2,
			SchoolBoardID:   5,
			SchoolBoardName: "Ottawa-Carleton District School Board",
			SchoolBoardCode: "OCDSB",
			JobTitle:        "driver",
			ShiftType:       "MIDDAY",
			PayRate:         ptrFloat(38.00),
			EiHours:         ptrFloat(2.00),
			EffectiveDate:   effDate,
			Notes:           "OCDSB Standard Driver Midday Shift Base",
		},
		{
			ID:              "PR-BASE-5-DRV-PM",
			NumericID:       3,
			SchoolBoardID:   5,
			SchoolBoardName: "Ottawa-Carleton District School Board",
			SchoolBoardCode: "OCDSB",
			JobTitle:        "driver",
			ShiftType:       "PM",
			PayRate:         ptrFloat(42.50),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
			Notes:           "OCDSB Standard Driver PM Shift Base",
		},

		// OCDSB (5) - Attendant Base Rates
		{
			ID:              "PR-BASE-5-ATT-AM",
			NumericID:       4,
			SchoolBoardID:   5,
			SchoolBoardName: "Ottawa-Carleton District School Board",
			SchoolBoardCode: "OCDSB",
			JobTitle:        "attendant",
			ShiftType:       "AM",
			PayRate:         ptrFloat(28.00),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
			Notes:           "OCDSB Standard Attendant AM Shift Base",
		},
		{
			ID:              "PR-BASE-5-ATT-MID",
			NumericID:       5,
			SchoolBoardID:   5,
			SchoolBoardName: "Ottawa-Carleton District School Board",
			SchoolBoardCode: "OCDSB",
			JobTitle:        "attendant",
			ShiftType:       "MIDDAY",
			PayRate:         ptrFloat(25.00),
			EiHours:         ptrFloat(2.00),
			EffectiveDate:   effDate,
			Notes:           "OCDSB Standard Attendant Midday Shift Base",
		},
		{
			ID:              "PR-BASE-5-ATT-PM",
			NumericID:       6,
			SchoolBoardID:   5,
			SchoolBoardName: "Ottawa-Carleton District School Board",
			SchoolBoardCode: "OCDSB",
			JobTitle:        "attendant",
			ShiftType:       "PM",
			PayRate:         ptrFloat(28.00),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
			Notes:           "OCDSB Standard Attendant PM Shift Base",
		},

		// OCSB (6) - Driver Base Rates
		{
			ID:              "PR-BASE-6-DRV-AM",
			NumericID:       7,
			SchoolBoardID:   6,
			SchoolBoardName: "Ottawa Catholic School Board",
			SchoolBoardCode: "OCSB",
			JobTitle:        "driver",
			ShiftType:       "AM",
			PayRate:         ptrFloat(44.00),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
			Notes:           "OCSB Standard Driver AM Shift Base",
		},
		{
			ID:              "PR-BASE-6-DRV-MID",
			NumericID:       8,
			SchoolBoardID:   6,
			SchoolBoardName: "Ottawa Catholic School Board",
			SchoolBoardCode: "OCSB",
			JobTitle:        "driver",
			ShiftType:       "MIDDAY",
			PayRate:         ptrFloat(39.50),
			EiHours:         ptrFloat(2.00),
			EffectiveDate:   effDate,
			Notes:           "OCSB Standard Driver Midday Shift Base",
		},
		{
			ID:              "PR-BASE-6-DRV-PM",
			NumericID:       9,
			SchoolBoardID:   6,
			SchoolBoardName: "Ottawa Catholic School Board",
			SchoolBoardCode: "OCSB",
			JobTitle:        "driver",
			ShiftType:       "PM",
			PayRate:         ptrFloat(44.00),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
			Notes:           "OCSB Standard Driver PM Shift Base",
		},

		// OCSB (6) - Attendant Base Rates
		{
			ID:              "PR-BASE-6-ATT-AM",
			NumericID:       10,
			SchoolBoardID:   6,
			SchoolBoardName: "Ottawa Catholic School Board",
			SchoolBoardCode: "OCSB",
			JobTitle:        "attendant",
			ShiftType:       "AM",
			PayRate:         ptrFloat(29.00),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
			Notes:           "OCSB Standard Attendant AM Shift Base",
		},
		{
			ID:              "PR-BASE-6-ATT-MID",
			NumericID:       11,
			SchoolBoardID:   6,
			SchoolBoardName: "Ottawa Catholic School Board",
			SchoolBoardCode: "OCSB",
			JobTitle:        "attendant",
			ShiftType:       "MIDDAY",
			PayRate:         ptrFloat(26.00),
			EiHours:         ptrFloat(2.00),
			EffectiveDate:   effDate,
			Notes:           "OCSB Standard Attendant Midday Shift Base",
		},
		{
			ID:              "PR-BASE-6-ATT-PM",
			NumericID:       12,
			SchoolBoardID:   6,
			SchoolBoardName: "Ottawa Catholic School Board",
			SchoolBoardCode: "OCSB",
			JobTitle:        "attendant",
			ShiftType:       "PM",
			PayRate:         ptrFloat(29.00),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
			Notes:           "OCSB Standard Attendant PM Shift Base",
		},

		// CEPEO (7) - Driver & Attendant Base Rates
		{
			ID:              "PR-BASE-7-DRV-AM",
			NumericID:       13,
			SchoolBoardID:   7,
			SchoolBoardName: "Conseil des ecoles publiques de l Est de l Ontario",
			SchoolBoardCode: "CEPEO",
			JobTitle:        "driver",
			ShiftType:       "AM",
			PayRate:         ptrFloat(43.00),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
		},
		{
			ID:              "PR-BASE-7-DRV-PM",
			NumericID:       14,
			SchoolBoardID:   7,
			SchoolBoardName: "Conseil des ecoles publiques de l Est de l Ontario",
			SchoolBoardCode: "CEPEO",
			JobTitle:        "driver",
			ShiftType:       "PM",
			PayRate:         ptrFloat(43.00),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
		},
		{
			ID:              "PR-BASE-7-ATT-AM",
			NumericID:       15,
			SchoolBoardID:   7,
			SchoolBoardName: "Conseil des ecoles publiques de l Est de l Ontario",
			SchoolBoardCode: "CEPEO",
			JobTitle:        "attendant",
			ShiftType:       "AM",
			PayRate:         ptrFloat(28.50),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
		},
		{
			ID:              "PR-BASE-7-ATT-PM",
			NumericID:       16,
			SchoolBoardID:   7,
			SchoolBoardName: "Conseil des ecoles publiques de l Est de l Ontario",
			SchoolBoardCode: "CEPEO",
			JobTitle:        "attendant",
			ShiftType:       "PM",
			PayRate:         ptrFloat(28.50),
			EiHours:         ptrFloat(2.50),
			EffectiveDate:   effDate,
		},

		// Sample Custom Overrides:
		// 1. Tier 3 Custom Override: Route 101 special high-density route rate
		{
			ID:              "PR-CUST-RT101",
			NumericID:       101,
			SchoolBoardID:   5,
			SchoolBoardName: "Ottawa-Carleton District School Board",
			SchoolBoardCode: "OCDSB",
			RouteID:         ptrInt(101),
			RouteNo:         "101",
			RouteName:       "Route 101 - St. Laurent Area",
			JobTitle:        "driver",
			ShiftType:       "AM",
			PayRate:         ptrFloat(48.50),
			EiHours:         ptrFloat(2.75),
			EffectiveDate:   effDate,
			Notes:           "Route 101 high-density complex transit route override",
		},
		// 2. Tier 2 Custom Override: Employee 2001 (David Miller) Special Universal Driver Rate
		{
			ID:            "PR-CUST-EMP2001",
			NumericID:     102,
			SchoolBoardID: 5,
			EmployeeID:    ptrInt(2001),
			EmployeeName:  "David Miller",
			JobTitle:      "driver",
			PayRate:       ptrFloat(52.00),
			EiHours:       ptrFloat(2.50),
			EffectiveDate: effDate,
			Notes:         "Senior veteran driver universal override across all routes",
		},
		// 3. Tier 1 Custom Override: Route 102 + Sarah Connor specific assignment
		{
			ID:              "PR-CUST-RT102-EMP2002",
			NumericID:       103,
			SchoolBoardID:   6,
			SchoolBoardName: "Ottawa Catholic School Board",
			SchoolBoardCode: "OCSB",
			RouteID:         ptrInt(102),
			RouteNo:         "102",
			RouteName:       "Route 102 - Kanata Express",
			EmployeeID:      ptrInt(2002),
			EmployeeName:    "Sarah Connor",
			JobTitle:        "driver",
			ShiftType:       "AM",
			PayRate:         ptrFloat(55.00),
			EiHours:         ptrFloat(3.00),
			EffectiveDate:   effDate,
			Notes:           "Special arrangement only active when Sarah Connor drives Route 102",
		},
	}
}
