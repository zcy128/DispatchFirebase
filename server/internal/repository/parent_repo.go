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
	ErrParentNotFound     = errors.New("parent user not found")
	ErrOTPNotFound        = errors.New("otp session not found or expired")
	ErrVehicleLocNotFound = errors.New("vehicle location not found")
)

type ParentRepository interface {
	SaveOTPSession(ctx context.Context, session *models.ParentOTPSession) error
	GetOTPSession(ctx context.Context, contact string) (*models.ParentOTPSession, error)
	DeleteOTPSession(ctx context.Context, contact string) error

	GetParentUser(ctx context.Context, id string) (*models.ParentUser, error)
	GetParentUserByContact(ctx context.Context, contact string) (*models.ParentUser, error)
	SaveParentUser(ctx context.Context, user *models.ParentUser) error

	GetNotificationPreferences(ctx context.Context, parentID string) (*models.ParentNotificationConfig, error)
	SaveNotificationPreferences(ctx context.Context, config *models.ParentNotificationConfig) error

	GetVehicleLiveLocation(ctx context.Context, unitNumber string) (*models.VehicleLiveLocation, error)
	ListVehicleLiveLocations(ctx context.Context) ([]*models.VehicleLiveLocation, error)
	SaveVehicleLiveLocation(ctx context.Context, loc *models.VehicleLiveLocation) error

	RegisterDeviceToken(ctx context.Context, parentID string, token models.DeviceToken) error
}

type FirestoreParentRepository struct {
	client   *firestore.Client
	otpColl  string
	userColl string
	prefColl string
	locColl  string
}

func NewFirestoreParentRepository(client *firestore.Client) *FirestoreParentRepository {
	return &FirestoreParentRepository{
		client:   client,
		otpColl:  "parent_otp_sessions",
		userColl: "parent_users",
		prefColl: "parent_preferences",
		locColl:  "vehicle_locations",
	}
}

func (r *FirestoreParentRepository) SaveOTPSession(ctx context.Context, session *models.ParentOTPSession) error {
	docKey := sanitizeContactKey(session.Contact)
	_, err := r.client.Collection(r.otpColl).Doc(docKey).Set(ctx, session)
	return err
}

func (r *FirestoreParentRepository) GetOTPSession(ctx context.Context, contact string) (*models.ParentOTPSession, error) {
	docKey := sanitizeContactKey(contact)
	snap, err := r.client.Collection(r.otpColl).Doc(docKey).Get(ctx)
	if err != nil {
		return nil, ErrOTPNotFound
	}
	var session models.ParentOTPSession
	if err := snap.DataTo(&session); err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *FirestoreParentRepository) DeleteOTPSession(ctx context.Context, contact string) error {
	docKey := sanitizeContactKey(contact)
	_, err := r.client.Collection(r.otpColl).Doc(docKey).Delete(ctx)
	return err
}

func (r *FirestoreParentRepository) GetParentUser(ctx context.Context, id string) (*models.ParentUser, error) {
	snap, err := r.client.Collection(r.userColl).Doc(id).Get(ctx)
	if err != nil {
		return nil, ErrParentNotFound
	}
	var u models.ParentUser
	if err := snap.DataTo(&u); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *FirestoreParentRepository) GetParentUserByContact(ctx context.Context, contact string) (*models.ParentUser, error) {
	docKey := "PAR-" + sanitizeContactKey(contact)
	return r.GetParentUser(ctx, docKey)
}

func (r *FirestoreParentRepository) SaveParentUser(ctx context.Context, user *models.ParentUser) error {
	if user.ID == "" {
		user.ID = "PAR-" + sanitizeContactKey(user.ContactValue)
	}
	_, err := r.client.Collection(r.userColl).Doc(user.ID).Set(ctx, user)
	return err
}

func (r *FirestoreParentRepository) GetNotificationPreferences(ctx context.Context, parentID string) (*models.ParentNotificationConfig, error) {
	snap, err := r.client.Collection(r.prefColl).Doc(parentID).Get(ctx)
	if err != nil {
		return models.DefaultParentNotificationConfig(), nil
	}
	var pref models.ParentNotificationConfig
	if err := snap.DataTo(&pref); err != nil {
		return models.DefaultParentNotificationConfig(), nil
	}
	return &pref, nil
}

func (r *FirestoreParentRepository) SaveNotificationPreferences(ctx context.Context, config *models.ParentNotificationConfig) error {
	config.UpdatedAt = time.Now().UTC()
	_, err := r.client.Collection(r.prefColl).Doc(config.ParentID).Set(ctx, config)
	return err
}

func (r *FirestoreParentRepository) GetVehicleLiveLocation(ctx context.Context, unitNumber string) (*models.VehicleLiveLocation, error) {
	if live := r.gpsLive(ctx, unitNumber); live != nil {
		return live, nil
	}
	snap, err := r.client.Collection(r.locColl).Doc(strings.ToUpper(strings.TrimSpace(unitNumber))).Get(ctx)
	if err != nil {
		return nil, ErrVehicleLocNotFound
	}
	var loc models.VehicleLiveLocation
	if err := snap.DataTo(&loc); err != nil {
		return nil, err
	}
	return &loc, nil
}

func (r *FirestoreParentRepository) gpsLive(ctx context.Context, unitNumber string) *models.VehicleLiveLocation {
	unit := models.NormalizeFleetUnit(unitNumber)
	if unit == "" {
		return nil
	}
	snap, err := r.client.Collection(models.GpsCurrentCollection).Doc(unit).Get(ctx)
	if err != nil {
		return nil
	}
	var pos models.GpsCurrentPosition
	if err := snap.DataTo(&pos); err != nil {
		return nil
	}
	return pos.LiveLocation()
}

func (r *FirestoreParentRepository) ListVehicleLiveLocations(ctx context.Context) ([]*models.VehicleLiveLocation, error) {
	current := map[string]*models.VehicleLiveLocation{}
	gpsIter := r.client.Collection(models.GpsCurrentCollection).Documents(ctx)
	for {
		doc, err := gpsIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var pos models.GpsCurrentPosition
		if err := doc.DataTo(&pos); err == nil {
			current[models.NormalizeFleetUnit(pos.UnitNumber)] = pos.LiveLocation()
		}
	}
	gpsIter.Stop()

	iter := r.client.Collection(r.locColl).Documents(ctx)
	defer iter.Stop()

	var list []*models.VehicleLiveLocation
	seen := map[string]bool{}
	for _, live := range current {
		list = append(list, live)
		seen[models.NormalizeFleetUnit(live.UnitNumber)] = true
	}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var loc models.VehicleLiveLocation
		if err := doc.DataTo(&loc); err != nil {
			continue
		}
		if seen[models.NormalizeFleetUnit(loc.UnitNumber)] {
			continue
		}
		list = append(list, &loc)
	}
	return list, nil
}

func (r *FirestoreParentRepository) SaveVehicleLiveLocation(ctx context.Context, loc *models.VehicleLiveLocation) error {
	loc.UnitNumber = strings.ToUpper(strings.TrimSpace(loc.UnitNumber))
	loc.LastUpdated = time.Now().UTC()
	_, err := r.client.Collection(r.locColl).Doc(loc.UnitNumber).Set(ctx, loc)
	return err
}

func (r *FirestoreParentRepository) RegisterDeviceToken(ctx context.Context, parentID string, token models.DeviceToken) error {
	u, err := r.GetParentUser(ctx, parentID)
	if err != nil {
		// create minimal parent record
		u = &models.ParentUser{
			ID:          parentID,
			CreatedAt:   time.Now().UTC(),
			LastLoginAt: time.Now().UTC(),
		}
	}

	exists := false
	for i, d := range u.DeviceTokens {
		if d.Token == token.Token {
			u.DeviceTokens[i] = token
			exists = true
			break
		}
	}
	if !exists {
		u.DeviceTokens = append(u.DeviceTokens, token)
	}
	return r.SaveParentUser(ctx, u)
}

// Memory fallback implementation
type MemoryParentRepository struct {
	mu          sync.RWMutex
	sessions    map[string]*models.ParentOTPSession
	users       map[string]*models.ParentUser
	preferences map[string]*models.ParentNotificationConfig
	locations   map[string]*models.VehicleLiveLocation
}

func NewMemoryParentRepository() *MemoryParentRepository {
	return &MemoryParentRepository{
		sessions:    make(map[string]*models.ParentOTPSession),
		users:       make(map[string]*models.ParentUser),
		preferences: make(map[string]*models.ParentNotificationConfig),
		locations:   make(map[string]*models.VehicleLiveLocation),
	}
}

func (m *MemoryParentRepository) SaveOTPSession(ctx context.Context, session *models.ParentOTPSession) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := sanitizeContactKey(session.Contact)
	m.sessions[key] = session
	return nil
}

func (m *MemoryParentRepository) GetOTPSession(ctx context.Context, contact string) (*models.ParentOTPSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	key := sanitizeContactKey(contact)
	s, ok := m.sessions[key]
	if !ok {
		return nil, ErrOTPNotFound
	}
	return s, nil
}

func (m *MemoryParentRepository) DeleteOTPSession(ctx context.Context, contact string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := sanitizeContactKey(contact)
	delete(m.sessions, key)
	return nil
}

func (m *MemoryParentRepository) GetParentUser(ctx context.Context, id string) (*models.ParentUser, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	u, ok := m.users[id]
	if !ok {
		return nil, ErrParentNotFound
	}
	return u, nil
}

func (m *MemoryParentRepository) GetParentUserByContact(ctx context.Context, contact string) (*models.ParentUser, error) {
	docKey := "PAR-" + sanitizeContactKey(contact)
	return m.GetParentUser(ctx, docKey)
}

func (m *MemoryParentRepository) SaveParentUser(ctx context.Context, user *models.ParentUser) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if user.ID == "" {
		user.ID = "PAR-" + sanitizeContactKey(user.ContactValue)
	}
	m.users[user.ID] = user
	return nil
}

func (m *MemoryParentRepository) GetNotificationPreferences(ctx context.Context, parentID string) (*models.ParentNotificationConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if p, ok := m.preferences[parentID]; ok {
		return p, nil
	}
	return models.DefaultParentNotificationConfig(), nil
}

func (m *MemoryParentRepository) SaveNotificationPreferences(ctx context.Context, config *models.ParentNotificationConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	config.UpdatedAt = time.Now().UTC()
	m.preferences[config.ParentID] = config
	return nil
}

func (m *MemoryParentRepository) GetVehicleLiveLocation(ctx context.Context, unitNumber string) (*models.VehicleLiveLocation, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	key := strings.ToUpper(strings.TrimSpace(unitNumber))
	loc, ok := m.locations[key]
	if !ok {
		return nil, ErrVehicleLocNotFound
	}
	return loc, nil
}

func (m *MemoryParentRepository) ListVehicleLiveLocations(ctx context.Context) ([]*models.VehicleLiveLocation, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var list []*models.VehicleLiveLocation
	for _, l := range m.locations {
		list = append(list, l)
	}
	return list, nil
}

func (m *MemoryParentRepository) SaveVehicleLiveLocation(ctx context.Context, loc *models.VehicleLiveLocation) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := strings.ToUpper(strings.TrimSpace(loc.UnitNumber))
	loc.UnitNumber = key
	loc.LastUpdated = time.Now().UTC()
	m.locations[key] = loc
	return nil
}

func (m *MemoryParentRepository) RegisterDeviceToken(ctx context.Context, parentID string, token models.DeviceToken) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[parentID]
	if !ok {
		u = &models.ParentUser{
			ID:          parentID,
			CreatedAt:   time.Now().UTC(),
			LastLoginAt: time.Now().UTC(),
		}
		m.users[parentID] = u
	}
	exists := false
	for i, d := range u.DeviceTokens {
		if d.Token == token.Token {
			u.DeviceTokens[i] = token
			exists = true
			break
		}
	}
	if !exists {
		u.DeviceTokens = append(u.DeviceTokens, token)
	}
	return nil
}

func sanitizeContactKey(c string) string {
	clean := strings.TrimSpace(c)
	clean = strings.ReplaceAll(clean, "+", "")
	clean = strings.ReplaceAll(clean, "@", "_at_")
	clean = strings.ReplaceAll(clean, ".", "_")
	clean = strings.ReplaceAll(clean, " ", "")
	clean = strings.ReplaceAll(clean, "-", "")
	clean = strings.ReplaceAll(clean, "(", "")
	clean = strings.ReplaceAll(clean, ")", "")
	return clean
}
