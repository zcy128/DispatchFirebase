package services

import (
	"context"
	"sync"

	"cloud.google.com/go/firestore"

	"dispatch-server/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	zonarSecretCollection = "zonar_secrets"
	zonarSecretDocument   = "settings"
)

type zonarSecretStore interface {
	Load(ctx context.Context) (zonarSecret, error)
	Save(ctx context.Context, secret zonarSecret) error
	SaveCurrent(ctx context.Context, rows []models.GpsCurrentPosition) error
	GetCurrent(ctx context.Context, unitNumber string) (*models.GpsCurrentPosition, error)
}

// ZonarStore keeps the Zonar password in a server-only Firestore document.
// Browser clients are denied by firestore.rules. When Firestore is unavailable,
// the password stays in process memory and is still never returned by the API.
type ZonarStore struct {
	client  *firestore.Client
	mu      sync.Mutex
	mem     zonarSecret
	hasMem  bool
	current map[string]models.GpsCurrentPosition
}

func NewZonarStore(client *firestore.Client) *ZonarStore {
	return &ZonarStore{client: client}
}

func (s *ZonarStore) Load(ctx context.Context) (zonarSecret, error) {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		if !s.hasMem {
			return zonarSecret{}, nil
		}
		return s.mem, nil
	}
	doc, err := s.client.Collection(zonarSecretCollection).Doc(zonarSecretDocument).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return zonarSecret{}, nil
		}
		return zonarSecret{}, err
	}
	var secret zonarSecret
	if err := doc.DataTo(&secret); err != nil {
		return zonarSecret{}, err
	}
	return secret, nil
}

func (s *ZonarStore) Save(ctx context.Context, secret zonarSecret) error {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.mem = secret
		s.hasMem = true
		return nil
	}
	_, err := s.client.Collection(zonarSecretCollection).Doc(zonarSecretDocument).Set(ctx, secret)
	return err
}

// SaveCurrent replaces the latest row for each vehicle. It does not append history.
func (s *ZonarStore) SaveCurrent(ctx context.Context, rows []models.GpsCurrentPosition) error {
	if len(rows) == 0 {
		return nil
	}
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.current == nil {
			s.current = map[string]models.GpsCurrentPosition{}
		}
		for _, row := range rows {
			if row.UnitNumber == "" {
				continue
			}
			s.current[row.UnitNumber] = row
		}
		return nil
	}
	col := s.client.Collection(models.GpsCurrentCollection)
	batch := s.client.Batch()
	pending := 0
	for _, row := range rows {
		if row.UnitNumber == "" {
			continue
		}
		batch.Set(col.Doc(row.UnitNumber), row)
		pending++
		if pending == 400 {
			if _, err := batch.Commit(ctx); err != nil {
				return err
			}
			batch = s.client.Batch()
			pending = 0
		}
	}
	if pending == 0 {
		return nil
	}
	_, err := batch.Commit(ctx)
	return err
}

func (s *ZonarStore) GetCurrent(ctx context.Context, unitNumber string) (*models.GpsCurrentPosition, error) {
	unit := models.NormalizeFleetUnit(unitNumber)
	if unit == "" {
		return nil, nil
	}
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		row, ok := s.current[unit]
		if !ok {
			return nil, nil
		}
		return &row, nil
	}
	snap, err := s.client.Collection(models.GpsCurrentCollection).Doc(unit).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil
		}
		return nil, err
	}
	var row models.GpsCurrentPosition
	if err := snap.DataTo(&row); err != nil {
		return nil, err
	}
	return &row, nil
}
