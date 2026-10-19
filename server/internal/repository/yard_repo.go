package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
)

var (
	ErrYardNotFound = errors.New("yard not found")
)

type YardRepository interface {
	ListYards(ctx context.Context) ([]*models.Yard, error)
	GetYardByID(ctx context.Context, id string) (*models.Yard, error)
	CreateYard(ctx context.Context, req *models.CreateYardRequest) (*models.Yard, error)
	UpdateYard(ctx context.Context, id string, req *models.UpdateYardRequest) (*models.Yard, error)
	DeleteYard(ctx context.Context, id string) error
	AssignRoute(ctx context.Context, yardID int, yardName string, routeID string) error
	UnassignRoute(ctx context.Context, routeID string) error
	AssignSchool(ctx context.Context, yardID int, yardName string, schoolID string) ([]string, error)
	UnassignSchool(ctx context.Context, schoolID string) ([]string, error)
	GetStats(ctx context.Context) (*models.YardStats, error)
}

type FirestoreYardRepository struct {
	client     *firestore.Client
	coll       string
	routesColl string
	schoolColl string
	shiftsColl string
}

func NewFirestoreYardRepository(client *firestore.Client) *FirestoreYardRepository {
	repo := &FirestoreYardRepository{
		client:     client,
		coll:       "yards",
		routesColl: "routes",
		schoolColl: "schools",
		shiftsColl: "route_shifts",
	}
	repo.ensureInitialSeeds(context.Background())
	return repo
}

func (r *FirestoreYardRepository) ensureInitialSeeds(ctx context.Context) {
	if r.client == nil {
		return
	}
	snap, err := r.client.Collection(r.coll).Limit(1).Documents(ctx).Next()
	if err == nil && snap != nil {
		return // Already seeded
	}

	now := time.Now().UTC()
	defaultYards := []*models.Yard{
		{
			ID:                 "YARD-1",
			YardID:             1,
			Name:               "Yard 1",
			SupervisorName:     "Supervisor1 Williams",
			SupervisorPhone:    "613-555-0145",
			SupervisorEmail:    "supervisor1.williams@ottawaschoolbus.ca",
			SupervisorAltName:  "—",
			IsActive:           true,
			CreatedAt:          now,
			UpdatedAt:          now,
		},
		{
			ID:                 "YARD-2",
			YardID:             2,
			Name:               "yard2",
			SupervisorName:     "Supervisor2 Williams",
			SupervisorPhone:    "613-555-0188",
			SupervisorEmail:    "supervisor2.williams@ottawaschoolbus.ca",
			SupervisorAltName:  "—",
			IsActive:           true,
			CreatedAt:          now,
			UpdatedAt:          now,
		},
		{
			ID:                 "YARD-3",
			YardID:             3,
			Name:               "yard3",
			SupervisorName:     "Supervisor3 Williams",
			SupervisorPhone:    "613-555-0192",
			SupervisorEmail:    "supervisor3.williams@ottawaschoolbus.ca",
			SupervisorAltName:  "—",
			IsActive:           true,
			CreatedAt:          now,
			UpdatedAt:          now,
		},
		{
			ID:                 "YARD-4",
			YardID:             4,
			Name:               "HQ-Central",
			SupervisorName:     "Alex Morgan",
			SupervisorPhone:    "613-555-0100",
			SupervisorEmail:    "alex.morgan@ottawaschoolbus.ca",
			SupervisorAltName:  "—",
			IsActive:           true,
			CreatedAt:          now,
			UpdatedAt:          now,
		},
	}

	batch := r.client.Batch()
	for _, y := range defaultYards {
		docRef := r.client.Collection(r.coll).Doc(y.ID)
		batch.Set(docRef, y)
	}
	_, _ = batch.Commit(ctx)
}

func (r *FirestoreYardRepository) ListYards(ctx context.Context) ([]*models.Yard, error) {
	iter := r.client.Collection(r.coll).OrderBy("yardId", firestore.Asc).Documents(ctx)
	defer iter.Stop()

	var result []*models.Yard
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var yard models.Yard
		if err := doc.DataTo(&yard); err != nil {
			continue
		}
		if yard.ID == "" {
			yard.ID = doc.Ref.ID
		}
		result = append(result, &yard)
	}
	return result, nil
}

func (r *FirestoreYardRepository) GetYardByID(ctx context.Context, id string) (*models.Yard, error) {
	doc, err := r.client.Collection(r.coll).Doc(id).Get(ctx)
	if err == nil && doc.Exists() {
		var yard models.Yard
		if err := doc.DataTo(&yard); err == nil {
			yard.ID = doc.Ref.ID
			return &yard, nil
		}
	}

	// Try query by yardId int
	if intID, err := strconv.Atoi(id); err == nil {
		iter := r.client.Collection(r.coll).Where("yardId", "==", intID).Limit(1).Documents(ctx)
		defer iter.Stop()
		d, err := iter.Next()
		if err == nil {
			var yard models.Yard
			if err := d.DataTo(&yard); err == nil {
				yard.ID = d.Ref.ID
				return &yard, nil
			}
		}
	}

	// Try query by name
	iter := r.client.Collection(r.coll).Where("name", "==", id).Limit(1).Documents(ctx)
	defer iter.Stop()
	d, err := iter.Next()
	if err == nil {
		var yard models.Yard
		if err := d.DataTo(&yard); err == nil {
			yard.ID = d.Ref.ID
			return &yard, nil
		}
	}

	return nil, ErrYardNotFound
}

func (r *FirestoreYardRepository) CreateYard(ctx context.Context, req *models.CreateYardRequest) (*models.Yard, error) {
	yards, _ := r.ListYards(ctx)
	maxID := 0
	for _, y := range yards {
		if y.YardID > maxID {
			maxID = y.YardID
		}
	}
	newYardID := maxID + 1

	now := time.Now().UTC()
	docID := fmt.Sprintf("YARD-%d", newYardID)
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	yard := &models.Yard{
		ID:                 docID,
		YardID:             newYardID,
		Name:               strings.TrimSpace(req.Name),
		SupervisorID:       req.SupervisorID,
		SupervisorName:     strings.TrimSpace(req.SupervisorName),
		SupervisorPhone:    strings.TrimSpace(req.SupervisorPhone),
		SupervisorEmail:    strings.TrimSpace(req.SupervisorEmail),
		SupervisorAltID:    req.SupervisorAltID,
		SupervisorAltName:  strings.TrimSpace(req.SupervisorAltName),
		SupervisorAltPhone: strings.TrimSpace(req.SupervisorAltPhone),
		SupervisorAltEmail: strings.TrimSpace(req.SupervisorAltEmail),
		IsActive:           isActive,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	_, err := r.client.Collection(r.coll).Doc(docID).Set(ctx, yard)
	if err != nil {
		return nil, err
	}
	return yard, nil
}

func (r *FirestoreYardRepository) UpdateYard(ctx context.Context, id string, req *models.UpdateYardRequest) (*models.Yard, error) {
	yard, err := r.GetYardByID(ctx, id)
	if err != nil {
		return nil, err
	}

	updates := []firestore.Update{
		{Path: "updatedAt", Value: time.Now().UTC()},
	}

	if req.Name != nil {
		yard.Name = strings.TrimSpace(*req.Name)
		updates = append(updates, firestore.Update{Path: "name", Value: yard.Name})
	}
	if req.SupervisorID != nil {
		yard.SupervisorID = req.SupervisorID
		updates = append(updates, firestore.Update{Path: "supervisorId", Value: yard.SupervisorID})
	}
	if req.SupervisorName != nil {
		yard.SupervisorName = strings.TrimSpace(*req.SupervisorName)
		updates = append(updates, firestore.Update{Path: "supervisorName", Value: yard.SupervisorName})
	}
	if req.SupervisorPhone != nil {
		yard.SupervisorPhone = strings.TrimSpace(*req.SupervisorPhone)
		updates = append(updates, firestore.Update{Path: "supervisorPhone", Value: yard.SupervisorPhone})
	}
	if req.SupervisorEmail != nil {
		yard.SupervisorEmail = strings.TrimSpace(*req.SupervisorEmail)
		updates = append(updates, firestore.Update{Path: "supervisorEmail", Value: yard.SupervisorEmail})
	}
	if req.SupervisorAltID != nil {
		yard.SupervisorAltID = req.SupervisorAltID
		updates = append(updates, firestore.Update{Path: "supervisorAltId", Value: yard.SupervisorAltID})
	}
	if req.SupervisorAltName != nil {
		yard.SupervisorAltName = strings.TrimSpace(*req.SupervisorAltName)
		updates = append(updates, firestore.Update{Path: "supervisorAltName", Value: yard.SupervisorAltName})
	}
	if req.SupervisorAltPhone != nil {
		yard.SupervisorAltPhone = strings.TrimSpace(*req.SupervisorAltPhone)
		updates = append(updates, firestore.Update{Path: "supervisorAltPhone", Value: yard.SupervisorAltPhone})
	}
	if req.SupervisorAltEmail != nil {
		yard.SupervisorAltEmail = strings.TrimSpace(*req.SupervisorAltEmail)
		updates = append(updates, firestore.Update{Path: "supervisorAltEmail", Value: yard.SupervisorAltEmail})
	}
	if req.IsActive != nil {
		yard.IsActive = *req.IsActive
		updates = append(updates, firestore.Update{Path: "isActive", Value: yard.IsActive})
	}

	_, err = r.client.Collection(r.coll).Doc(yard.ID).Update(ctx, updates)
	if err != nil {
		return nil, err
	}
	yard.UpdatedAt = time.Now().UTC()
	return yard, nil
}

func (r *FirestoreYardRepository) DeleteYard(ctx context.Context, id string) error {
	yard, err := r.GetYardByID(ctx, id)
	if err != nil {
		return err
	}
	_, err = r.client.Collection(r.coll).Doc(yard.ID).Delete(ctx)
	return err
}

func (r *FirestoreYardRepository) AssignRoute(ctx context.Context, yardID int, yardName string, routeID string) error {
	updates := []firestore.Update{
		{Path: "yardId", Value: yardID},
		{Path: "yardName", Value: yardName},
		{Path: "updatedAt", Value: time.Now().UTC()},
	}
	_, err := r.client.Collection(r.routesColl).Doc(routeID).Update(ctx, updates)
	return err
}

func (r *FirestoreYardRepository) UnassignRoute(ctx context.Context, routeID string) error {
	updates := []firestore.Update{
		{Path: "yardId", Value: 0},
		{Path: "yardName", Value: ""},
		{Path: "updatedAt", Value: time.Now().UTC()},
	}
	_, err := r.client.Collection(r.routesColl).Doc(routeID).Update(ctx, updates)
	return err
}

func (r *FirestoreYardRepository) AssignSchool(ctx context.Context, yardID int, yardName string, schoolID string) ([]string, error) {
	targetYardName := strings.TrimSpace(yardName)
	if targetYardName == "" && yardID > 0 {
		if yard, err := r.GetYardByID(ctx, strconv.Itoa(yardID)); err == nil && yard != nil {
			targetYardName = yard.Name
		} else {
			targetYardName = fmt.Sprintf("Yard %d", yardID)
		}
	}

	var schoolDoc *firestore.DocumentSnapshot
	targetSchoolID := 0
	targetSchoolName := ""

	if doc, err := r.client.Collection(r.schoolColl).Doc(schoolID).Get(ctx); err == nil && doc.Exists() {
		schoolDoc = doc
	} else if sid, err := strconv.Atoi(schoolID); err == nil {
		iter := r.client.Collection(r.schoolColl).Where("schoolId", "==", sid).Limit(1).Documents(ctx)
		defer iter.Stop()
		if doc, err := iter.Next(); err == nil && doc != nil && doc.Exists() {
			schoolDoc = doc
		}
	}

	if schoolDoc == nil {
		iter := r.client.Collection(r.schoolColl).Where("schoolName", "==", schoolID).Limit(1).Documents(ctx)
		defer iter.Stop()
		if doc, err := iter.Next(); err == nil && doc != nil && doc.Exists() {
			schoolDoc = doc
		}
	}

	if schoolDoc == nil {
		return nil, errors.New("school not found")
	}

	var schoolData models.School
	if err := schoolDoc.DataTo(&schoolData); err == nil {
		targetSchoolID = schoolData.SchoolID
		targetSchoolName = schoolData.SchoolName
	}

	affectedMap := make(map[string]bool)

	// Scan route_shifts for stops matching target school
	shiftIter := r.client.Collection(r.shiftsColl).Documents(ctx)
	defer shiftIter.Stop()
	for {
		sDoc, err := shiftIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var shift models.BusRouteShift
		if err := sDoc.DataTo(&shift); err != nil {
			continue
		}
		matched := false
		for _, stop := range shift.Stops {
			if (stop.SchoolID != nil && *stop.SchoolID == targetSchoolID && targetSchoolID > 0) ||
				(targetSchoolName != "" && strings.EqualFold(strings.TrimSpace(stop.SchoolName), strings.TrimSpace(targetSchoolName))) {
				matched = true
				break
			}
		}
		if matched {
			rtID := shift.RouteID
			if rtID == "" {
				rtID = sDoc.Ref.ID
			}
			if rtID != "" {
				affectedMap[rtID] = true
			}
		}
	}

	// Also scan routes collection for routeName matching target school name
	routeIter := r.client.Collection(r.routesColl).Documents(ctx)
	defer routeIter.Stop()
	for {
		rDoc, err := routeIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var rt models.BusRoute
		if err := rDoc.DataTo(&rt); err != nil {
			continue
		}
		rtID := rDoc.Ref.ID
		if rt.ID != "" {
			rtID = rt.ID
		}
		if targetSchoolName != "" && strings.Contains(strings.ToLower(rt.RouteName), strings.ToLower(targetSchoolName)) {
			affectedMap[rtID] = true
		}
	}

	// Atomic batch commit for school and all affected routes
	batch := r.client.Batch()
	now := time.Now().UTC()
	batch.Update(schoolDoc.Ref, []firestore.Update{
		{Path: "yardId", Value: yardID},
		{Path: "updatedAt", Value: now},
	})

	var affectedList []string
	for rtID := range affectedMap {
		affectedList = append(affectedList, rtID)
		batch.Update(r.client.Collection(r.routesColl).Doc(rtID), []firestore.Update{
			{Path: "yardId", Value: yardID},
			{Path: "yardName", Value: targetYardName},
			{Path: "updatedAt", Value: now},
		})
	}

	if _, err := batch.Commit(ctx); err != nil {
		return nil, err
	}

	return affectedList, nil
}

func (r *FirestoreYardRepository) UnassignSchool(ctx context.Context, schoolID string) ([]string, error) {
	var schoolDoc *firestore.DocumentSnapshot
	targetSchoolID := 0
	targetSchoolName := ""

	if doc, err := r.client.Collection(r.schoolColl).Doc(schoolID).Get(ctx); err == nil && doc.Exists() {
		schoolDoc = doc
	} else if sid, err := strconv.Atoi(schoolID); err == nil {
		iter := r.client.Collection(r.schoolColl).Where("schoolId", "==", sid).Limit(1).Documents(ctx)
		defer iter.Stop()
		if doc, err := iter.Next(); err == nil && doc != nil && doc.Exists() {
			schoolDoc = doc
		}
	}

	if schoolDoc == nil {
		iter := r.client.Collection(r.schoolColl).Where("schoolName", "==", schoolID).Limit(1).Documents(ctx)
		defer iter.Stop()
		if doc, err := iter.Next(); err == nil && doc != nil && doc.Exists() {
			schoolDoc = doc
		}
	}

	if schoolDoc == nil {
		return nil, errors.New("school not found")
	}

	var schoolData models.School
	if err := schoolDoc.DataTo(&schoolData); err == nil {
		targetSchoolID = schoolData.SchoolID
		targetSchoolName = schoolData.SchoolName
	}

	affectedMap := make(map[string]bool)

	// Scan route_shifts for stops matching target school
	shiftIter := r.client.Collection(r.shiftsColl).Documents(ctx)
	defer shiftIter.Stop()
	for {
		sDoc, err := shiftIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var shift models.BusRouteShift
		if err := sDoc.DataTo(&shift); err != nil {
			continue
		}
		matched := false
		for _, stop := range shift.Stops {
			if (stop.SchoolID != nil && *stop.SchoolID == targetSchoolID && targetSchoolID > 0) ||
				(targetSchoolName != "" && strings.EqualFold(strings.TrimSpace(stop.SchoolName), strings.TrimSpace(targetSchoolName))) {
				matched = true
				break
			}
		}
		if matched {
			rtID := shift.RouteID
			if rtID == "" {
				rtID = sDoc.Ref.ID
			}
			if rtID != "" {
				affectedMap[rtID] = true
			}
		}
	}

	// Also scan routes collection for routeName matching target school name
	routeIter := r.client.Collection(r.routesColl).Documents(ctx)
	defer routeIter.Stop()
	for {
		rDoc, err := routeIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var rt models.BusRoute
		if err := rDoc.DataTo(&rt); err != nil {
			continue
		}
		rtID := rDoc.Ref.ID
		if rt.ID != "" {
			rtID = rt.ID
		}
		if targetSchoolName != "" && strings.Contains(strings.ToLower(rt.RouteName), strings.ToLower(targetSchoolName)) {
			affectedMap[rtID] = true
		}
	}

	batch := r.client.Batch()
	now := time.Now().UTC()
	batch.Update(schoolDoc.Ref, []firestore.Update{
		{Path: "yardId", Value: nil},
		{Path: "updatedAt", Value: now},
	})

	var affectedList []string
	for rtID := range affectedMap {
		affectedList = append(affectedList, rtID)
		batch.Update(r.client.Collection(r.routesColl).Doc(rtID), []firestore.Update{
			{Path: "yardId", Value: 0},
			{Path: "yardName", Value: ""},
			{Path: "updatedAt", Value: now},
		})
	}

	if _, err := batch.Commit(ctx); err != nil {
		return nil, err
	}

	return affectedList, nil
}

func (r *FirestoreYardRepository) GetStats(ctx context.Context) (*models.YardStats, error) {
	yards, err := r.ListYards(ctx)
	if err != nil {
		return nil, err
	}
	stats := &models.YardStats{
		TotalYards: len(yards),
	}
	for _, y := range yards {
		if y.IsActive {
			stats.ActiveYards++
		}
	}
	return stats, nil
}

// In-Memory Repository for local offline testing
type MemoryYardRepository struct {
	mu    sync.RWMutex
	yards map[string]*models.Yard
}

func NewMemoryYardRepository() *MemoryYardRepository {
	now := time.Now().UTC()
	repo := &MemoryYardRepository{
		yards: make(map[string]*models.Yard),
	}
	repo.yards["YARD-1"] = &models.Yard{
		ID:              "YARD-1",
		YardID:          1,
		Name:            "Yard 1",
		SupervisorName:  "Supervisor1 Williams",
		IsActive:        true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	repo.yards["YARD-2"] = &models.Yard{
		ID:              "YARD-2",
		YardID:          2,
		Name:            "yard2",
		SupervisorName:  "Supervisor2 Williams",
		IsActive:        true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	repo.yards["YARD-3"] = &models.Yard{
		ID:              "YARD-3",
		YardID:          3,
		Name:            "yard3",
		SupervisorName:  "Supervisor3 Williams",
		IsActive:        true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	repo.yards["YARD-4"] = &models.Yard{
		ID:              "YARD-4",
		YardID:          4,
		Name:            "HQ-Central",
		SupervisorName:  "Alex Morgan",
		IsActive:        true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	return repo
}

func (m *MemoryYardRepository) ListYards(ctx context.Context) ([]*models.Yard, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var list []*models.Yard
	for _, y := range m.yards {
		list = append(list, y)
	}
	return list, nil
}

func (m *MemoryYardRepository) GetYardByID(ctx context.Context, id string) (*models.Yard, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if y, ok := m.yards[id]; ok {
		return y, nil
	}
	for _, y := range m.yards {
		if y.Name == id || strconv.Itoa(y.YardID) == id {
			return y, nil
		}
	}
	return nil, ErrYardNotFound
}

func (m *MemoryYardRepository) CreateYard(ctx context.Context, req *models.CreateYardRequest) (*models.Yard, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	newID := len(m.yards) + 1
	docID := fmt.Sprintf("YARD-%d", newID)
	now := time.Now().UTC()
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	y := &models.Yard{
		ID:                 docID,
		YardID:             newID,
		Name:               req.Name,
		SupervisorName:     req.SupervisorName,
		SupervisorPhone:    req.SupervisorPhone,
		SupervisorEmail:    req.SupervisorEmail,
		SupervisorAltName:  req.SupervisorAltName,
		SupervisorAltPhone: req.SupervisorAltPhone,
		SupervisorAltEmail: req.SupervisorAltEmail,
		IsActive:           isActive,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	m.yards[docID] = y
	return y, nil
}

func (m *MemoryYardRepository) UpdateYard(ctx context.Context, id string, req *models.UpdateYardRequest) (*models.Yard, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	y, ok := m.yards[id]
	if !ok {
		for _, cur := range m.yards {
			if cur.Name == id || strconv.Itoa(cur.YardID) == id {
				y = cur
				break
			}
		}
	}
	if y == nil {
		return nil, ErrYardNotFound
	}
	if req.Name != nil {
		y.Name = *req.Name
	}
	if req.SupervisorName != nil {
		y.SupervisorName = *req.SupervisorName
	}
	if req.SupervisorPhone != nil {
		y.SupervisorPhone = *req.SupervisorPhone
	}
	if req.SupervisorEmail != nil {
		y.SupervisorEmail = *req.SupervisorEmail
	}
	if req.SupervisorAltName != nil {
		y.SupervisorAltName = *req.SupervisorAltName
	}
	if req.SupervisorAltPhone != nil {
		y.SupervisorAltPhone = *req.SupervisorAltPhone
	}
	if req.SupervisorAltEmail != nil {
		y.SupervisorAltEmail = *req.SupervisorAltEmail
	}
	if req.IsActive != nil {
		y.IsActive = *req.IsActive
	}
	y.UpdatedAt = time.Now().UTC()
	return y, nil
}

func (m *MemoryYardRepository) DeleteYard(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.yards, id)
	return nil
}

func (m *MemoryYardRepository) AssignRoute(ctx context.Context, yardID int, yardName string, routeID string) error {
	return nil
}

func (m *MemoryYardRepository) UnassignRoute(ctx context.Context, routeID string) error {
	return nil
}

func (m *MemoryYardRepository) AssignSchool(ctx context.Context, yardID int, yardName string, schoolID string) ([]string, error) {
	return []string{}, nil
}

func (m *MemoryYardRepository) UnassignSchool(ctx context.Context, schoolID string) ([]string, error) {
	return []string{}, nil
}

func (m *MemoryYardRepository) GetStats(ctx context.Context) (*models.YardStats, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	stats := &models.YardStats{
		TotalYards: len(m.yards),
	}
	for _, y := range m.yards {
		if y.IsActive {
			stats.ActiveYards++
		}
	}
	return stats, nil
}
