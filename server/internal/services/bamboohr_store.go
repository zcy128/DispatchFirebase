package services

import (
	"context"
	"sync"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	bambooSecretCollection = "bamboohr_secrets"
	bambooSecretDocument   = "settings"
	bambooWebhookDocument  = "webhook_events"
	bambooWebhookLimit     = 20
)

type bambooSecretStore interface {
	Load(ctx context.Context) (bambooSecret, error)
	Save(ctx context.Context, secret bambooSecret) error
	AppendWebhookEvents(ctx context.Context, events []BambooWebhookEvent) error
	ListWebhookEvents(ctx context.Context) ([]BambooWebhookEvent, error)
}

// BambooHRStore keeps the API key in a server-only Firestore document.
// Browser clients are denied by firestore.rules. When Firestore is unavailable,
// the key stays in process memory and is still never returned by the API.
type BambooHRStore struct {
	client *firestore.Client
	mu     sync.Mutex
	mem    bambooSecret
	hasMem bool
	events []BambooWebhookEvent
}

func NewBambooHRStore(client *firestore.Client) *BambooHRStore {
	return &BambooHRStore{client: client}
}

func (s *BambooHRStore) Load(ctx context.Context) (bambooSecret, error) {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		if !s.hasMem {
			return bambooSecret{}, nil
		}
		return s.mem, nil
	}
	doc, err := s.client.Collection(bambooSecretCollection).Doc(bambooSecretDocument).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return bambooSecret{}, nil
		}
		return bambooSecret{}, err
	}
	var secret bambooSecret
	if err := doc.DataTo(&secret); err != nil {
		return bambooSecret{}, err
	}
	return secret, nil
}

func (s *BambooHRStore) Save(ctx context.Context, secret bambooSecret) error {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.mem = secret
		s.hasMem = true
		return nil
	}
	_, err := s.client.Collection(bambooSecretCollection).Doc(bambooSecretDocument).Set(ctx, secret)
	return err
}

func (s *BambooHRStore) AppendWebhookEvents(ctx context.Context, events []BambooWebhookEvent) error {
	if len(events) == 0 {
		return nil
	}
	current, err := s.ListWebhookEvents(ctx)
	if err != nil {
		return err
	}
	combined := append(events, current...)
	if len(combined) > bambooWebhookLimit {
		combined = combined[:bambooWebhookLimit]
	}
	if s.client == nil {
		s.mu.Lock()
		s.events = combined
		s.mu.Unlock()
		return nil
	}
	_, err = s.client.Collection(bambooSecretCollection).Doc(bambooWebhookDocument).Set(ctx, map[string]any{
		"events": combined,
	})
	return err
}

func (s *BambooHRStore) ListWebhookEvents(ctx context.Context) ([]BambooWebhookEvent, error) {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		out := append([]BambooWebhookEvent(nil), s.events...)
		return out, nil
	}
	doc, err := s.client.Collection(bambooSecretCollection).Doc(bambooWebhookDocument).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil
		}
		return nil, err
	}
	var stored struct {
		Events []BambooWebhookEvent `firestore:"events"`
	}
	if err := doc.DataTo(&stored); err != nil {
		return nil, err
	}
	return stored.Events, nil
}
