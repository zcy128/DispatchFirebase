package repository

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
)

var (
	ErrVehicleNotFound = errors.New("vehicle not found")
)

type VehicleFilter struct {
	Search   string
	UnitType string
	FuelType string
	YardName string
	Active   *bool
}

type VehicleRepository interface {
	ListVehicles(ctx context.Context, filter VehicleFilter) ([]*models.Vehicle, error)
	GetVehicleByID(ctx context.Context, id string) (*models.Vehicle, error)
	GetVehicleByUnitNumber(ctx context.Context, unitNumber string) (*models.Vehicle, error)
	CreateVehicle(ctx context.Context, vehicle *models.Vehicle) (*models.Vehicle, error)
	UpdateVehicle(ctx context.Context, id string, updates map[string]interface{}) (*models.Vehicle, error)
	DeleteVehicle(ctx context.Context, id string) error
	GetStats(ctx context.Context) (*models.VehicleStats, error)
	Count(ctx context.Context) (int, error)
}

type FirestoreVehicleRepository struct {
	client *firestore.Client
	coll   string
}

func NewFirestoreVehicleRepository(client *firestore.Client) *FirestoreVehicleRepository {
	return &FirestoreVehicleRepository{
		client: client,
		coll:   "vehicles",
	}
}

func (r *FirestoreVehicleRepository) ListVehicles(ctx context.Context, filter VehicleFilter) ([]*models.Vehicle, error) {
	query := r.client.Collection(r.coll).Query

	if filter.Active != nil {
		query = query.Where("active", "==", *filter.Active)
	}
	if filter.UnitType != "" && filter.UnitType != "ALL" {
		query = query.Where("unitType", "==", filter.UnitType)
	}
	if filter.FuelType != "" && filter.FuelType != "ALL" {
		query = query.Where("fuelType", "==", filter.FuelType)
	}

	iter := query.Documents(ctx)
	defer iter.Stop()

	var vehicles []*models.Vehicle
	searchTerm := strings.ToLower(strings.TrimSpace(filter.Search))

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		var v models.Vehicle
		if err := doc.DataTo(&v); err != nil {
			continue
		}
		v.ID = doc.Ref.ID

		if filter.YardName != "" && filter.YardName != "ALL" && !strings.EqualFold(v.YardName, filter.YardName) {
			continue
		}

		if searchTerm != "" {
			matchUnit := strings.Contains(strings.ToLower(v.UnitNumber), searchTerm)
			matchPlate := strings.Contains(strings.ToLower(v.PlateNumber), searchTerm)
			matchVin := strings.Contains(strings.ToLower(v.Vin), searchTerm)
			matchMfr := strings.Contains(strings.ToLower(v.Manufacturer), searchTerm)
			matchModel := strings.Contains(strings.ToLower(v.Model), searchTerm)
			matchDriver := strings.Contains(strings.ToLower(v.DriverName), searchTerm)
			matchRoute := strings.Contains(strings.ToLower(v.AssignedRouteNo), searchTerm)
			if !matchUnit && !matchPlate && !matchVin && !matchMfr && !matchModel && !matchDriver && !matchRoute {
				continue
			}
		}

		vehicles = append(vehicles, &v)
	}

	return vehicles, nil
}

func (r *FirestoreVehicleRepository) GetVehicleByID(ctx context.Context, id string) (*models.Vehicle, error) {
	doc, err := r.client.Collection(r.coll).Doc(id).Get(ctx)
	if err != nil {
		return nil, ErrVehicleNotFound
	}

	var v models.Vehicle
	if err := doc.DataTo(&v); err != nil {
		return nil, err
	}
	v.ID = doc.Ref.ID
	return &v, nil
}

func (r *FirestoreVehicleRepository) GetVehicleByUnitNumber(ctx context.Context, unitNumber string) (*models.Vehicle, error) {
	iter := r.client.Collection(r.coll).Where("unitNumber", "==", unitNumber).Limit(1).Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, ErrVehicleNotFound
	}
	if err != nil {
		return nil, err
	}

	var v models.Vehicle
	if err := doc.DataTo(&v); err != nil {
		return nil, err
	}
	v.ID = doc.Ref.ID
	return &v, nil
}

func (r *FirestoreVehicleRepository) CreateVehicle(ctx context.Context, v *models.Vehicle) (*models.Vehicle, error) {
	if v.ID == "" {
		v.ID = "VEH-" + v.UnitNumber
	}
	v.CreatedAt = time.Now()
	v.UpdatedAt = time.Now()

	_, err := r.client.Collection(r.coll).Doc(v.ID).Set(ctx, v)
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (r *FirestoreVehicleRepository) UpdateVehicle(ctx context.Context, id string, updates map[string]interface{}) (*models.Vehicle, error) {
	docRef := r.client.Collection(r.coll).Doc(id)
	doc, err := docRef.Get(ctx)
	if err != nil {
		return nil, ErrVehicleNotFound
	}
	var existing models.Vehicle
	if err := doc.DataTo(&existing); err != nil {
		return nil, err
	}

	var firestoreUpdates []firestore.Update
	for k, val := range updates {
		if k == "id" || k == "vehicleId" {
			continue
		}
		firestoreUpdates = append(firestoreUpdates, firestore.Update{
			Path:  k,
			Value: val,
		})
	}
	firestoreUpdates = append(firestoreUpdates, firestore.Update{
		Path:  "updatedAt",
		Value: time.Now(),
	})

	if _, err := docRef.Update(ctx, firestoreUpdates); err != nil {
		return nil, err
	}

	updatedDoc, err := docRef.Get(ctx)
	if err != nil {
		return nil, err
	}
	var updated models.Vehicle
	if err := updatedDoc.DataTo(&updated); err != nil {
		return nil, err
	}
	updated.ID = updatedDoc.Ref.ID
	return &updated, nil
}

func (r *FirestoreVehicleRepository) DeleteVehicle(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.coll).Doc(id).Delete(ctx)
	return err
}

func (r *FirestoreVehicleRepository) GetStats(ctx context.Context) (*models.VehicleStats, error) {
	list, err := r.ListVehicles(ctx, VehicleFilter{})
	if err != nil {
		return nil, err
	}

	stats := &models.VehicleStats{
		TotalVehicles:    len(list),
		TypeDistribution: make(map[string]int),
		FuelDistribution: make(map[string]int),
		YardDistribution: make(map[string]int),
	}

	for _, v := range list {
		if v.Active {
			stats.ActiveVehicles++
		}
		if v.AssignedRouteID != "" {
			stats.AssignedToRoutes++
		} else {
			stats.SpareVehicles++
		}
		if v.WheelchairCap > 0 {
			stats.WheelchairAccessible++
		}

		if v.UnitType != "" {
			stats.TypeDistribution[v.UnitType]++
		}
		if v.FuelType != "" {
			stats.FuelDistribution[v.FuelType]++
		}
		if v.YardName != "" {
			stats.YardDistribution[v.YardName]++
		}
	}

	return stats, nil
}

func (r *FirestoreVehicleRepository) Count(ctx context.Context) (int, error) {
	list, err := r.ListVehicles(ctx, VehicleFilter{})
	if err != nil {
		return 0, err
	}
	return len(list), nil
}

// InMemoryVehicleRepository for development fallback
type InMemoryVehicleRepository struct {
	mu       sync.RWMutex
	vehicles map[string]*models.Vehicle
}

func NewInMemoryVehicleRepository() *InMemoryVehicleRepository {
	return &InMemoryVehicleRepository{
		vehicles: make(map[string]*models.Vehicle),
	}
}

func (r *InMemoryVehicleRepository) ListVehicles(_ context.Context, filter VehicleFilter) ([]*models.Vehicle, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*models.Vehicle
	searchTerm := strings.ToLower(strings.TrimSpace(filter.Search))

	for _, v := range r.vehicles {
		if filter.Active != nil && v.Active != *filter.Active {
			continue
		}
		if filter.UnitType != "" && filter.UnitType != "ALL" && !strings.EqualFold(v.UnitType, filter.UnitType) {
			continue
		}
		if filter.FuelType != "" && filter.FuelType != "ALL" && !strings.EqualFold(v.FuelType, filter.FuelType) {
			continue
		}
		if filter.YardName != "" && filter.YardName != "ALL" && !strings.EqualFold(v.YardName, filter.YardName) {
			continue
		}

		if searchTerm != "" {
			matchUnit := strings.Contains(strings.ToLower(v.UnitNumber), searchTerm)
			matchPlate := strings.Contains(strings.ToLower(v.PlateNumber), searchTerm)
			matchMfr := strings.Contains(strings.ToLower(v.Manufacturer), searchTerm)
			matchDriver := strings.Contains(strings.ToLower(v.DriverName), searchTerm)
			matchRoute := strings.Contains(strings.ToLower(v.AssignedRouteNo), searchTerm)
			if !matchUnit && !matchPlate && !matchMfr && !matchDriver && !matchRoute {
				continue
			}
		}

		result = append(result, v)
	}

	return result, nil
}

func (r *InMemoryVehicleRepository) GetVehicleByID(_ context.Context, id string) (*models.Vehicle, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	v, ok := r.vehicles[id]
	if !ok {
		return nil, ErrVehicleNotFound
	}
	return v, nil
}

func (r *InMemoryVehicleRepository) GetVehicleByUnitNumber(_ context.Context, unitNumber string) (*models.Vehicle, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, v := range r.vehicles {
		if v.UnitNumber == unitNumber {
			return v, nil
		}
	}
	return nil, ErrVehicleNotFound
}

func (r *InMemoryVehicleRepository) GetStats(ctx context.Context) (*models.VehicleStats, error) {
	list, err := r.ListVehicles(ctx, VehicleFilter{})
	if err != nil {
		return nil, err
	}

	stats := &models.VehicleStats{
		TotalVehicles:    len(list),
		TypeDistribution: make(map[string]int),
		FuelDistribution: make(map[string]int),
		YardDistribution: make(map[string]int),
	}

	for _, v := range list {
		if v.Active {
			stats.ActiveVehicles++
		}
		if v.AssignedRouteID != "" {
			stats.AssignedToRoutes++
		} else {
			stats.SpareVehicles++
		}
		if v.WheelchairCap > 0 {
			stats.WheelchairAccessible++
		}

		if v.UnitType != "" {
			stats.TypeDistribution[v.UnitType]++
		}
		if v.FuelType != "" {
			stats.FuelDistribution[v.FuelType]++
		}
		if v.YardName != "" {
			stats.YardDistribution[v.YardName]++
		}
	}

	return stats, nil
}

func (r *InMemoryVehicleRepository) CreateVehicle(_ context.Context, v *models.Vehicle) (*models.Vehicle, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if v.ID == "" {
		v.ID = "VEH-" + v.UnitNumber
	}
	v.CreatedAt = time.Now()
	v.UpdatedAt = time.Now()
	r.vehicles[v.ID] = v
	return v, nil
}

func (r *InMemoryVehicleRepository) UpdateVehicle(_ context.Context, id string, updates map[string]interface{}) (*models.Vehicle, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	v, ok := r.vehicles[id]
	if !ok {
		return nil, ErrVehicleNotFound
	}

	if val, ok := updates["unitNumber"].(string); ok {
		v.UnitNumber = val
	}
	if val, ok := updates["plateNumber"].(string); ok {
		v.PlateNumber = val
	}
	if val, ok := updates["vin"].(string); ok {
		v.Vin = val
	}
	if val, ok := updates["manufacturer"].(string); ok {
		v.Manufacturer = val
	}
	if val, ok := updates["model"].(string); ok {
		v.Model = val
	}
	if val, ok := updates["unitType"].(string); ok {
		v.UnitType = val
	}
	if val, ok := updates["status"].(string); ok {
		v.Status = val
	}
	if val, ok := updates["yardName"].(string); ok {
		v.YardName = val
	}
	if val, ok := updates["fuelType"].(string); ok {
		v.FuelType = val
	}
	if val, ok := updates["licenseExpiry"].(string); ok {
		v.LicenseExpiry = val
	}
	if val, ok := updates["notes"].(string); ok {
		v.Notes = val
	}
	if val, ok := updates["active"].(bool); ok {
		v.Active = val
	}
	v.UpdatedAt = time.Now()
	return v, nil
}

func (r *InMemoryVehicleRepository) DeleteVehicle(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.vehicles[id]; !ok {
		return ErrVehicleNotFound
	}
	delete(r.vehicles, id)
	return nil
}

func (r *InMemoryVehicleRepository) Count(_ context.Context) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.vehicles), nil
}
