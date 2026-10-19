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
	ErrRouteNotFound = errors.New("route not found")
	ErrShiftNotFound = errors.New("shift not found")
)

type RouteFilter struct {
	Search  string
	YardID  int
	BoardID int
	Active  *bool
}

type RouteRepository interface {
	ListRoutes(ctx context.Context, filter RouteFilter) ([]*models.BusRoute, error)
	GetRouteByID(ctx context.Context, id string) (*models.BusRoute, error)
	GetRouteByNo(ctx context.Context, routeNo string) (*models.BusRoute, error)
	ListShiftsByRoute(ctx context.Context, routeID string) ([]*models.BusRouteShift, error)
	GetShiftByID(ctx context.Context, id string) (*models.BusRouteShift, error)
	CountRoutes(ctx context.Context) (int, error)
	CountShifts(ctx context.Context) (int, error)
	AssignCrew(ctx context.Context, routeID string, req *models.AssignRouteCrewRequest) (*models.BusRoute, error)
	UpdateRoute(ctx context.Context, id string, req *models.UpdateRouteRequest) (*models.BusRoute, error)
	UpdateShift(ctx context.Context, id string, req *models.UpdateShiftRequest) (*models.BusRouteShift, error)
}

type FirestoreRouteRepository struct {
	client    *firestore.Client
	routeColl string
	shiftColl string
}

func NewFirestoreRouteRepository(client *firestore.Client) *FirestoreRouteRepository {
	return &FirestoreRouteRepository{
		client:    client,
		routeColl: "routes",
		shiftColl: "route_shifts",
	}
}

func (r *FirestoreRouteRepository) ListRoutes(ctx context.Context, filter RouteFilter) ([]*models.BusRoute, error) {
	query := r.client.Collection(r.routeColl).Query

	if filter.Active != nil && *filter.Active {
		query = query.Where("active", "==", true)
	}
	if filter.YardID > 0 {
		query = query.Where("yardId", "==", filter.YardID)
	}
	if filter.BoardID > 0 {
		query = query.Where("schoolBoardId", "==", filter.BoardID)
	}

	iter := query.OrderBy("routeNo", firestore.Asc).Documents(ctx)
	defer iter.Stop()

	var result []*models.BusRoute
	searchLower := strings.ToLower(strings.TrimSpace(filter.Search))

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		var rt models.BusRoute
		if err := doc.DataTo(&rt); err != nil {
			continue
		}
		rt.ID = doc.Ref.ID
		if rt.AutoMarryup == nil {
			defaultTrue := true
			rt.AutoMarryup = &defaultTrue
		}

		if searchLower != "" {
			matches := strings.Contains(strings.ToLower(rt.RouteNo), searchLower) ||
				strings.Contains(strings.ToLower(rt.RouteName), searchLower) ||
				strings.Contains(strings.ToLower(rt.DriverName), searchLower) ||
				strings.Contains(strings.ToLower(rt.UnitNumber), searchLower) ||
				strings.Contains(strings.ToLower(rt.YardName), searchLower)
			if !matches {
				continue
			}
		}

		result = append(result, &rt)
	}

	return result, nil
}

func (r *FirestoreRouteRepository) GetRouteByID(ctx context.Context, id string) (*models.BusRoute, error) {
	docRef := r.client.Collection(r.routeColl).Doc(id)
	doc, err := docRef.Get(ctx)
	if err != nil && !strings.HasPrefix(id, "RT-") {
		docRef = r.client.Collection(r.routeColl).Doc("RT-" + id)
		doc, err = docRef.Get(ctx)
	}
	if err != nil {
		return nil, ErrRouteNotFound
	}
	var rt models.BusRoute
	if err := doc.DataTo(&rt); err != nil {
		return nil, err
	}
	rt.ID = doc.Ref.ID
	if rt.AutoMarryup == nil {
		defaultTrue := true
		rt.AutoMarryup = &defaultTrue
	}
	return &rt, nil
}

func (r *FirestoreRouteRepository) GetRouteByNo(ctx context.Context, routeNo string) (*models.BusRoute, error) {
	iter := r.client.Collection(r.routeColl).Where("routeNo", "==", routeNo).Limit(1).Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, ErrRouteNotFound
	}
	if err != nil {
		return nil, err
	}

	var rt models.BusRoute
	if err := doc.DataTo(&rt); err != nil {
		return nil, err
	}
	rt.ID = doc.Ref.ID
	if rt.AutoMarryup == nil {
		defaultTrue := true
		rt.AutoMarryup = &defaultTrue
	}
	return &rt, nil
}

func (r *FirestoreRouteRepository) ListShiftsByRoute(ctx context.Context, routeID string) ([]*models.BusRouteShift, error) {
	iter := r.client.Collection(r.shiftColl).Where("routeId", "==", routeID).Documents(ctx)
	defer iter.Stop()

	var result []*models.BusRouteShift
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		var s models.BusRouteShift
		if err := doc.DataTo(&s); err != nil {
			continue
		}
		s.ID = doc.Ref.ID
		result = append(result, &s)
	}

	// Sort AM before PM in memory
	if len(result) > 1 && result[0].ShiftType == "PM" && result[1].ShiftType == "AM" {
		result[0], result[1] = result[1], result[0]
	}

	// Also verify and sync parent route document if shifts are out of sync
	if len(result) > 0 {
		go func(shifts []*models.BusRouteShift, rid string) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			r.syncRouteShifts(bgCtx, rid, shifts)
		}(result, routeID)
	}

	return result, nil
}

func (r *FirestoreRouteRepository) syncRouteShifts(ctx context.Context, routeID string, shifts []*models.BusRouteShift) {
	if (routeID == "" && (len(shifts) == 0 || shifts[0].RouteNo == "")) || len(shifts) == 0 {
		return
	}
	var routeDocRef *firestore.DocumentRef
	var routeDoc *firestore.DocumentSnapshot

	if routeID != "" {
		routeDocRef = r.client.Collection(r.routeColl).Doc(routeID)
		docSnap, err := routeDocRef.Get(ctx)
		if err == nil && docSnap.Exists() {
			routeDoc = docSnap
		} else if !strings.HasPrefix(routeID, "RT-") {
			altRef := r.client.Collection(r.routeColl).Doc("RT-" + routeID)
			altSnap, altErr := altRef.Get(ctx)
			if altErr == nil && altSnap.Exists() {
				routeDocRef = altRef
				routeDoc = altSnap
			}
		}
	}

	if (routeDoc == nil || !routeDoc.Exists()) && len(shifts) > 0 && shifts[0].RouteNo != "" {
		iter := r.client.Collection(r.routeColl).Where("routeNo", "==", shifts[0].RouteNo).Limit(1).Documents(ctx)
		docSnap, iterErr := iter.Next()
		if iterErr == nil && docSnap != nil && docSnap.Exists() {
			routeDocRef = docSnap.Ref
			routeDoc = docSnap
		}
		iter.Stop()
	}

	if routeDoc == nil || !routeDoc.Exists() || routeDocRef == nil {
		return
	}

	var rt models.BusRoute
	if err := routeDoc.DataTo(&rt); err != nil {
		return
	}

	changed := false
	for _, sh := range shifts {
		found := false
		for i := range rt.Shifts {
			if strings.EqualFold(rt.Shifts[i].ShiftType, sh.ShiftType) || (sh.ShiftID > 0 && rt.Shifts[i].ShiftID == sh.ShiftID) {
				if rt.Shifts[i].RunDays != sh.RunDays {
					rt.Shifts[i].RunDays = sh.RunDays
					changed = true
				}
				if sh.FirstStopTime != "" && rt.Shifts[i].FirstStopTime != sh.FirstStopTime {
					rt.Shifts[i].FirstStopTime = sh.FirstStopTime
					changed = true
				}
				if sh.LastStopTime != "" && rt.Shifts[i].LastStopTime != sh.LastStopTime {
					rt.Shifts[i].LastStopTime = sh.LastStopTime
					changed = true
				}
				if len(sh.Stops) > 0 && rt.Shifts[i].StopCount != len(sh.Stops) {
					rt.Shifts[i].StopCount = len(sh.Stops)
					changed = true
				}
				found = true
				break
			}
		}
		if !found {
			rt.Shifts = append(rt.Shifts, models.ShiftSummary{
				ShiftID:       sh.ShiftID,
				ShiftType:     sh.ShiftType,
				RunDays:       sh.RunDays,
				FirstStopTime: sh.FirstStopTime,
				LastStopTime:  sh.LastStopTime,
				StopCount:     len(sh.Stops),
			})
			changed = true
		}
	}

	if changed {
		now := time.Now().UTC().Format(time.RFC3339)
		_, _ = routeDocRef.Update(ctx, []firestore.Update{
			{Path: "shifts", Value: rt.Shifts},
			{Path: "updatedAt", Value: now},
		})
	}
}

func (r *FirestoreRouteRepository) GetShiftByID(ctx context.Context, id string) (*models.BusRouteShift, error) {
	doc, err := r.client.Collection(r.shiftColl).Doc(id).Get(ctx)
	if err != nil {
		return nil, ErrShiftNotFound
	}
	var s models.BusRouteShift
	if err := doc.DataTo(&s); err != nil {
		return nil, err
	}
	s.ID = doc.Ref.ID
	return &s, nil
}

func (r *FirestoreRouteRepository) UpdateShift(ctx context.Context, id string, req *models.UpdateShiftRequest) (*models.BusRouteShift, error) {
	docRef := r.client.Collection(r.shiftColl).Doc(id)
	now := time.Now().UTC().Format(time.RFC3339)

	updates := []firestore.Update{
		{Path: "updatedAt", Value: now},
	}

	if req.Stops != nil {
		stops := *req.Stops
		updates = append(updates, firestore.Update{Path: "stops", Value: stops})
		if len(stops) > 0 {
			updates = append(updates, firestore.Update{Path: "firstStopTime", Value: stops[0].PullawayTime})
			updates = append(updates, firestore.Update{Path: "lastStopTime", Value: stops[len(stops)-1].PullawayTime})
		}
	}
	if req.Active != nil {
		updates = append(updates, firestore.Update{Path: "active", Value: *req.Active})
	}
	if req.RunDays != nil {
		updates = append(updates, firestore.Update{Path: "runDays", Value: *req.RunDays})
	}
	if req.EffectiveDate != nil {
		updates = append(updates, firestore.Update{Path: "effectiveDate", Value: *req.EffectiveDate})
	}
	if req.RetireDate != nil {
		updates = append(updates, firestore.Update{Path: "retireDate", Value: *req.RetireDate})
	}

	_, err := docRef.Update(ctx, updates)
	if err != nil {
		return nil, err
	}

	updatedShift, err := r.GetShiftByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Immediately sync the parent route document's embedded shifts
	r.syncRouteShifts(ctx, updatedShift.RouteID, []*models.BusRouteShift{updatedShift})

	return updatedShift, nil
}

func (r *FirestoreRouteRepository) CountRoutes(ctx context.Context) (int, error) {
	snaps, err := r.client.Collection(r.routeColl).Documents(ctx).GetAll()
	if err != nil {
		return 0, err
	}
	return len(snaps), nil
}

func (r *FirestoreRouteRepository) CountShifts(ctx context.Context) (int, error) {
	snaps, err := r.client.Collection(r.shiftColl).Documents(ctx).GetAll()
	if err != nil {
		return 0, err
	}
	return len(snaps), nil
}

func (r *FirestoreRouteRepository) AssignCrew(ctx context.Context, routeID string, req *models.AssignRouteCrewRequest) (*models.BusRoute, error) {
	routeDocRef := r.client.Collection(r.routeColl).Doc(routeID)
	routeSnap, err := routeDocRef.Get(ctx)
	if err != nil {
		return nil, ErrRouteNotFound
	}
	var rt models.BusRoute
	if err := routeSnap.DataTo(&rt); err != nil {
		return nil, err
	}
	rt.ID = routeSnap.Ref.ID

	now := time.Now()
	updates := []firestore.Update{
		{Path: "driverId", Value: req.DriverID},
		{Path: "driverName", Value: req.DriverName},
		{Path: "driverPhone", Value: req.DriverPhone},
		{Path: "vehicleId", Value: req.VehicleID},
		{Path: "unitNumber", Value: req.UnitNumber},
		{Path: "plateNumber", Value: req.PlateNumber},
		{Path: "attendantId", Value: req.AttendantID},
		{Path: "attendantName", Value: req.AttendantName},
		{Path: "attendantPhone", Value: req.AttendantPhone},
		{Path: "updatedAt", Value: now},
	}

	if _, err := routeDocRef.Update(ctx, updates); err != nil {
		return nil, err
	}

	rt.DriverID = req.DriverID
	rt.DriverName = req.DriverName
	rt.DriverPhone = req.DriverPhone
	rt.VehicleID = req.VehicleID
	rt.UnitNumber = req.UnitNumber
	rt.PlateNumber = req.PlateNumber
	rt.AttendantID = req.AttendantID
	rt.AttendantName = req.AttendantName
	rt.AttendantPhone = req.AttendantPhone
	rt.UpdatedAt = now

	// Update route_shifts
	shiftIter := r.client.Collection(r.shiftColl).Where("routeId", "==", routeID).Documents(ctx)
	overridesMap := make(map[string]models.ShiftCrewOverride)
	for _, o := range req.ShiftOverrides {
		overridesMap[o.ShiftID] = o
	}

	for {
		doc, err := shiftIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		sID := doc.Ref.ID

		var sUpdates []firestore.Update
		if req.IsCustomCrew {
			if o, ok := overridesMap[sID]; ok {
				sUpdates = []firestore.Update{
					{Path: "isCustomCrew", Value: true},
					{Path: "driverId", Value: o.DriverID},
					{Path: "driverName", Value: o.DriverName},
					{Path: "driverPhone", Value: o.DriverPhone},
					{Path: "vehicleId", Value: o.VehicleID},
					{Path: "unitNumber", Value: o.UnitNumber},
					{Path: "plateNumber", Value: o.PlateNumber},
					{Path: "attendantId", Value: o.AttendantID},
					{Path: "attendantName", Value: o.AttendantName},
					{Path: "attendantPhone", Value: o.AttendantPhone},
					{Path: "updatedAt", Value: now},
				}
			} else {
				sUpdates = []firestore.Update{
					{Path: "isCustomCrew", Value: false},
					{Path: "driverId", Value: req.DriverID},
					{Path: "driverName", Value: req.DriverName},
					{Path: "driverPhone", Value: req.DriverPhone},
					{Path: "vehicleId", Value: req.VehicleID},
					{Path: "unitNumber", Value: req.UnitNumber},
					{Path: "plateNumber", Value: req.PlateNumber},
					{Path: "attendantId", Value: req.AttendantID},
					{Path: "attendantName", Value: req.AttendantName},
					{Path: "attendantPhone", Value: req.AttendantPhone},
					{Path: "updatedAt", Value: now},
				}
			}
		} else {
			sUpdates = []firestore.Update{
				{Path: "isCustomCrew", Value: false},
				{Path: "driverId", Value: req.DriverID},
				{Path: "driverName", Value: req.DriverName},
				{Path: "driverPhone", Value: req.DriverPhone},
				{Path: "vehicleId", Value: req.VehicleID},
				{Path: "unitNumber", Value: req.UnitNumber},
				{Path: "plateNumber", Value: req.PlateNumber},
				{Path: "attendantId", Value: req.AttendantID},
				{Path: "attendantName", Value: req.AttendantName},
				{Path: "attendantPhone", Value: req.AttendantPhone},
				{Path: "updatedAt", Value: now},
			}
		}
		doc.Ref.Update(ctx, sUpdates)
	}

	// Update vehicles collection with assignedRouteId / assignedRouteNo
	if req.UnitNumber != "" {
		vIter := r.client.Collection("vehicles").Where("unitNumber", "==", req.UnitNumber).Limit(1).Documents(ctx)
		vDoc, err := vIter.Next()
		if err == nil && vDoc != nil {
			vDoc.Ref.Update(ctx, []firestore.Update{
				{Path: "assignedRouteId", Value: routeID},
				{Path: "assignedRouteNo", Value: rt.RouteNo},
				{Path: "assignedRouteName", Value: rt.RouteName},
				{Path: "driverId", Value: req.DriverID},
				{Path: "driverName", Value: req.DriverName},
				{Path: "driverPhone", Value: req.DriverPhone},
				{Path: "status", Value: "In Service"},
				{Path: "updatedAt", Value: now},
			})
		}
	}

	return &rt, nil
}

func (r *FirestoreRouteRepository) UpdateRoute(ctx context.Context, id string, req *models.UpdateRouteRequest) (*models.BusRoute, error) {
	docRef := r.client.Collection(r.routeColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil && !strings.HasPrefix(id, "RT-") {
		docRef = r.client.Collection(r.routeColl).Doc("RT-" + id)
		snap, err = docRef.Get(ctx)
	}
	if err != nil {
		return nil, ErrRouteNotFound
	}

	var rt models.BusRoute
	if err := snap.DataTo(&rt); err != nil {
		return nil, err
	}
	rt.ID = docRef.ID

	now := time.Now().UTC().Format(time.RFC3339)
	updates := []firestore.Update{
		{Path: "updatedAt", Value: now},
	}

	if req.AutoMarryup != nil {
		updates = append(updates, firestore.Update{Path: "autoMarryup", Value: *req.AutoMarryup})
		rt.AutoMarryup = req.AutoMarryup
	}
	if req.RouteNo != nil && strings.TrimSpace(*req.RouteNo) != "" {
		trimmedNo := strings.TrimSpace(*req.RouteNo)
		updates = append(updates, firestore.Update{Path: "routeNo", Value: trimmedNo})
		rt.RouteNo = trimmedNo
	}
	if req.RouteName != nil {
		trimmedName := strings.TrimSpace(*req.RouteName)
		updates = append(updates, firestore.Update{Path: "routeName", Value: trimmedName})
		rt.RouteName = trimmedName
	}
	if req.Instructions != nil {
		trimmedInst := strings.TrimSpace(*req.Instructions)
		updates = append(updates, firestore.Update{Path: "instructions", Value: trimmedInst})
		rt.Instructions = trimmedInst
	}
	if req.Active != nil {
		updates = append(updates, firestore.Update{Path: "active", Value: *req.Active})
		rt.Active = *req.Active
	}
	if req.SchoolBoardID != nil {
		updates = append(updates, firestore.Update{Path: "schoolBoardId", Value: *req.SchoolBoardID})
		rt.SchoolBoardID = *req.SchoolBoardID
	}
	if req.YardID != nil {
		updates = append(updates, firestore.Update{Path: "yardId", Value: *req.YardID})
		rt.YardID = *req.YardID
	}
	if req.YardName != nil {
		trimmedYard := strings.TrimSpace(*req.YardName)
		updates = append(updates, firestore.Update{Path: "yardName", Value: trimmedYard})
		rt.YardName = trimmedYard
	}

	if len(updates) > 1 {
		if _, err := docRef.Update(ctx, updates); err != nil {
			return nil, err
		}
	}

	if rt.AutoMarryup == nil {
		defaultTrue := true
		rt.AutoMarryup = &defaultTrue
	}

	return &rt, nil
}

// Memory fallback
type MemoryRouteRepository struct {
	mu     sync.RWMutex
	routes map[string]*models.BusRoute
	shifts map[string]*models.BusRouteShift
}

func NewMemoryRouteRepository() *MemoryRouteRepository {
	return &MemoryRouteRepository{
		routes: make(map[string]*models.BusRoute),
		shifts: make(map[string]*models.BusRouteShift),
	}
}

func (m *MemoryRouteRepository) ListRoutes(ctx context.Context, filter RouteFilter) ([]*models.BusRoute, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.BusRoute, 0, len(m.routes))
	for _, rt := range m.routes {
		res = append(res, rt)
	}
	return res, nil
}

func (m *MemoryRouteRepository) GetRouteByID(ctx context.Context, id string) (*models.BusRoute, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if rt, ok := m.routes[id]; ok {
		return rt, nil
	}
	return nil, ErrRouteNotFound
}

func (m *MemoryRouteRepository) GetRouteByNo(ctx context.Context, routeNo string) (*models.BusRoute, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, rt := range m.routes {
		if rt.RouteNo == routeNo {
			return rt, nil
		}
	}
	return nil, ErrRouteNotFound
}

func (m *MemoryRouteRepository) ListShiftsByRoute(ctx context.Context, routeID string) ([]*models.BusRouteShift, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var res []*models.BusRouteShift
	for _, s := range m.shifts {
		if s.RouteID == routeID {
			res = append(res, s)
		}
	}
	return res, nil
}

func (m *MemoryRouteRepository) GetShiftByID(ctx context.Context, id string) (*models.BusRouteShift, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if s, ok := m.shifts[id]; ok {
		return s, nil
	}
	return nil, ErrShiftNotFound
}

func (m *MemoryRouteRepository) CountRoutes(ctx context.Context) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.routes), nil
}

func (m *MemoryRouteRepository) CountShifts(ctx context.Context) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.shifts), nil
}

func (m *MemoryRouteRepository) AssignCrew(ctx context.Context, routeID string, req *models.AssignRouteCrewRequest) (*models.BusRoute, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rt, ok := m.routes[routeID]
	if !ok {
		return nil, ErrRouteNotFound
	}
	rt.DriverID = req.DriverID
	rt.DriverName = req.DriverName
	rt.DriverPhone = req.DriverPhone
	rt.VehicleID = req.VehicleID
	rt.UnitNumber = req.UnitNumber
	rt.PlateNumber = req.PlateNumber
	rt.AttendantID = req.AttendantID
	rt.AttendantName = req.AttendantName
	rt.AttendantPhone = req.AttendantPhone
	rt.UpdatedAt = time.Now()
	return rt, nil
}

func (m *MemoryRouteRepository) UpdateRoute(ctx context.Context, id string, req *models.UpdateRouteRequest) (*models.BusRoute, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rt, ok := m.routes[id]
	if !ok {
		return nil, ErrRouteNotFound
	}
	if req.AutoMarryup != nil {
		rt.AutoMarryup = req.AutoMarryup
	}
	if req.RouteNo != nil && strings.TrimSpace(*req.RouteNo) != "" {
		rt.RouteNo = strings.TrimSpace(*req.RouteNo)
	}
	if req.RouteName != nil {
		rt.RouteName = strings.TrimSpace(*req.RouteName)
	}
	if req.Instructions != nil {
		rt.Instructions = strings.TrimSpace(*req.Instructions)
	}
	if req.Active != nil {
		rt.Active = *req.Active
	}
	if req.SchoolBoardID != nil {
		rt.SchoolBoardID = *req.SchoolBoardID
	}
	if req.YardID != nil {
		rt.YardID = *req.YardID
	}
	if req.YardName != nil {
		rt.YardName = strings.TrimSpace(*req.YardName)
	}
	rt.UpdatedAt = time.Now()
	return rt, nil
}

func (m *MemoryRouteRepository) UpdateShift(ctx context.Context, id string, req *models.UpdateShiftRequest) (*models.BusRouteShift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[id]
	if !ok {
		return nil, ErrShiftNotFound
	}
	if req.Stops != nil {
		s.Stops = *req.Stops
		if len(s.Stops) > 0 {
			s.FirstStopTime = s.Stops[0].PullawayTime
			s.LastStopTime = s.Stops[len(s.Stops)-1].PullawayTime
		}
	}
	if req.Active != nil {
		s.Active = req.Active
	}
	if req.RunDays != nil {
		s.RunDays = *req.RunDays
	}
	if req.EffectiveDate != nil {
		s.EffectiveDate = req.EffectiveDate
	}
	if req.RetireDate != nil {
		s.RetireDate = req.RetireDate
	}
	s.UpdatedAt = time.Now()

	// Also sync to parent route's embedded Shifts
	routeKey := s.RouteID
	if routeKey == "" {
		for rId, rObj := range m.routes {
			if rObj.RouteNo == s.RouteNo {
				routeKey = rId
				break
			}
		}
	}
	if routeKey != "" {
		if rt, ok := m.routes[routeKey]; ok {
			found := false
			for i := range rt.Shifts {
				if strings.EqualFold(rt.Shifts[i].ShiftType, s.ShiftType) || (s.ShiftID > 0 && rt.Shifts[i].ShiftID == s.ShiftID) {
					rt.Shifts[i].RunDays = s.RunDays
					if s.FirstStopTime != "" {
						rt.Shifts[i].FirstStopTime = s.FirstStopTime
					}
					if s.LastStopTime != "" {
						rt.Shifts[i].LastStopTime = s.LastStopTime
					}
					if len(s.Stops) > 0 {
						rt.Shifts[i].StopCount = len(s.Stops)
					}
					found = true
					break
				}
			}
			if !found {
				rt.Shifts = append(rt.Shifts, models.ShiftSummary{
					ShiftID:       s.ShiftID,
					ShiftType:     s.ShiftType,
					RunDays:       s.RunDays,
					FirstStopTime: s.FirstStopTime,
					LastStopTime:  s.LastStopTime,
					StopCount:     len(s.Stops),
				})
			}
			rt.UpdatedAt = time.Now()
		}
	}

	return s, nil
}
