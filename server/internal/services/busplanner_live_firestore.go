package services

import (
	"context"
	"strings"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// FirestoreStagingLive writes staging shift patterns into routes and route_shifts.
// Updates touch the pattern only, so an existing driver, vehicle, or attendant stays.
type FirestoreStagingLive struct {
	client    *firestore.Client
	routeColl string
	shiftColl string
}

func NewFirestoreStagingLive(client *firestore.Client) *FirestoreStagingLive {
	return &FirestoreStagingLive{
		client:    client,
		routeColl: "routes",
		shiftColl: "route_shifts",
	}
}

func (s *FirestoreStagingLive) FindRouteByNo(ctx context.Context, routeNo string) (*models.BusRoute, error) {
	if s.client == nil || strings.TrimSpace(routeNo) == "" {
		return nil, nil
	}
	iter := s.client.Collection(s.routeColl).Where("routeNo", "==", routeNo).Limit(1).Documents(ctx)
	defer iter.Stop()
	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var route models.BusRoute
	if err := doc.DataTo(&route); err != nil {
		return nil, err
	}
	route.ID = doc.Ref.ID
	return &route, nil
}

func (s *FirestoreStagingLive) ListShifts(ctx context.Context, routeID string) ([]*models.BusRouteShift, error) {
	if s.client == nil || routeID == "" {
		return nil, nil
	}
	iter := s.client.Collection(s.shiftColl).Where("routeId", "==", routeID).Documents(ctx)
	defer iter.Stop()
	var shifts []*models.BusRouteShift
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var shift models.BusRouteShift
		if err := doc.DataTo(&shift); err != nil {
			continue
		}
		shift.ID = doc.Ref.ID
		shifts = append(shifts, &shift)
	}
	return shifts, nil
}

func (s *FirestoreStagingLive) CreateRoute(ctx context.Context, route *models.BusRoute) error {
	if route == nil || route.ID == "" {
		return ErrLiveRoutesUnavailable
	}
	_, err := s.client.Collection(s.routeColl).Doc(route.ID).Set(ctx, route)
	return err
}

func (s *FirestoreStagingLive) UpdateRoutePattern(ctx context.Context, route *models.BusRoute) error {
	if route == nil || route.ID == "" {
		return ErrLiveRoutesUnavailable
	}
	_, err := s.client.Collection(s.routeColl).Doc(route.ID).Update(ctx, []firestore.Update{
		{Path: "routeName", Value: route.RouteName},
		{Path: "active", Value: route.Active},
		{Path: "shifts", Value: route.Shifts},
		{Path: "totalStops", Value: route.TotalStops},
		{Path: "totalStudents", Value: route.TotalStudents},
		{Path: "updatedAt", Value: route.UpdatedAt},
	})
	if status.Code(err) == codes.NotFound {
		return s.CreateRoute(ctx, route)
	}
	return err
}

func (s *FirestoreStagingLive) CreateShift(ctx context.Context, shift *models.BusRouteShift) error {
	if shift == nil || shift.ID == "" {
		return ErrLiveRoutesUnavailable
	}
	_, err := s.client.Collection(s.shiftColl).Doc(shift.ID).Set(ctx, shift)
	return err
}

func (s *FirestoreStagingLive) UpdateShiftPattern(ctx context.Context, shift *models.BusRouteShift) error {
	if shift == nil || shift.ID == "" {
		return ErrLiveRoutesUnavailable
	}
	stops := shift.Stops
	if stops == nil {
		stops = []models.RouteStop{}
	}
	_, err := s.client.Collection(s.shiftColl).Doc(shift.ID).Update(ctx, []firestore.Update{
		{Path: "routeId", Value: shift.RouteID},
		{Path: "routeNo", Value: shift.RouteNo},
		{Path: "routeName", Value: shift.RouteName},
		{Path: "shiftType", Value: shift.ShiftType},
		{Path: "runDays", Value: shift.RunDays},
		{Path: "busplannerRunId", Value: shift.BusplannerRunID},
		{Path: "active", Value: shift.Active},
		{Path: "effectiveDate", Value: dateOrEmpty(shift.EffectiveDate)},
		{Path: "retireDate", Value: dateOrEmpty(shift.RetireDate)},
		{Path: "firstStopTime", Value: shift.FirstStopTime},
		{Path: "lastStopTime", Value: shift.LastStopTime},
		{Path: "stops", Value: stops},
		{Path: "updatedAt", Value: shift.UpdatedAt},
	})
	if status.Code(err) == codes.NotFound {
		return s.CreateShift(ctx, shift)
	}
	return err
}

func dateOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
