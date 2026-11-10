package repository

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"

	"dispatch-server/internal/models"
)

var digitsOnlyRegex = regexp.MustCompile(`\D`)

// NormalizePhone extracts the essential digits (last 10 digits for North America)
// so that formats like "+1 (613) 555-0100", "613-555-0100", and "6135550100" match.
func NormalizePhone(phone string) string {
	digits := digitsOnlyRegex.ReplaceAllString(phone, "")
	if len(digits) > 10 {
		return digits[len(digits)-10:]
	}
	return digits
}

type SMSRepository interface {
	Save(ctx context.Context, msg *models.SMSMessage) error
	ListForPhoneAndDate(ctx context.Context, phone string, dateStr string) ([]*models.SMSMessage, error)
}

// -----------------------------------------------------------------------------
// FirestoreSMSRepository
// -----------------------------------------------------------------------------

type FirestoreSMSRepository struct {
	client *firestore.Client
	coll   string
}

func NewFirestoreSMSRepository(client *firestore.Client) *FirestoreSMSRepository {
	return &FirestoreSMSRepository{
		client: client,
		coll:   "sms_messages",
	}
}

func (r *FirestoreSMSRepository) Save(ctx context.Context, msg *models.SMSMessage) error {
	if r.client == nil {
		return fmt.Errorf("firestore client is nil")
	}
	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = time.Now().UTC()
	}
	if msg.DateStr == "" {
		msg.DateStr = msg.CreatedAt.Format("2006-01-02")
	}
	if msg.NormalizedPhone == "" {
		target := msg.ToPhone
		if msg.Direction == "inbound" {
			target = msg.FromPhone
		}
		msg.NormalizedPhone = NormalizePhone(target)
	}

	docRef := r.client.Collection(r.coll).NewDoc()
	msg.ID = docRef.ID
	_, err := docRef.Set(ctx, msg)
	return err
}

func (r *FirestoreSMSRepository) ListForPhoneAndDate(ctx context.Context, phone string, dateStr string) ([]*models.SMSMessage, error) {
	if r.client == nil {
		return nil, fmt.Errorf("firestore client is nil")
	}

	normPhone := NormalizePhone(phone)
	if dateStr == "" {
		dateStr = time.Now().UTC().Format("2006-01-02")
	}

	// Query by dateStr to stay within partition boundaries
	query := r.client.Collection(r.coll).Where("dateStr", "==", dateStr)
	if normPhone != "" {
		query = query.Where("normalizedPhone", "==", normPhone)
	}

	iter := query.Documents(ctx)
	defer iter.Stop()

	var results []*models.SMSMessage
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var msg models.SMSMessage
		if err := doc.DataTo(&msg); err != nil {
			continue
		}
		msg.ID = doc.Ref.ID
		results = append(results, &msg)
	}

	// Sort chronologically ascending
	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.Before(results[j].CreatedAt)
	})

	return results, nil
}

// -----------------------------------------------------------------------------
// MemorySMSRepository (for dev, test, and fallback simulation)
// -----------------------------------------------------------------------------

type MemorySMSRepository struct {
	mu       sync.RWMutex
	messages []*models.SMSMessage
}

func NewMemorySMSRepository() *MemorySMSRepository {
	return &MemorySMSRepository{
		messages: make([]*models.SMSMessage, 0),
	}
}

func (m *MemorySMSRepository) Save(_ context.Context, msg *models.SMSMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if msg.ID == "" {
		msg.ID = fmt.Sprintf("sms-%d", time.Now().UnixNano())
	}
	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = time.Now().UTC()
	}
	if msg.DateStr == "" {
		msg.DateStr = msg.CreatedAt.Format("2006-01-02")
	}
	if msg.NormalizedPhone == "" {
		target := msg.ToPhone
		if msg.Direction == "inbound" {
			target = msg.FromPhone
		}
		msg.NormalizedPhone = NormalizePhone(target)
	}

	// Clone to prevent mutating pointer
	cloned := *msg
	m.messages = append(m.messages, &cloned)
	return nil
}

func (m *MemorySMSRepository) ListForPhoneAndDate(_ context.Context, phone string, dateStr string) ([]*models.SMSMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	normPhone := NormalizePhone(phone)
	if dateStr == "" {
		dateStr = time.Now().UTC().Format("2006-01-02")
	}

	var results []*models.SMSMessage
	for _, msg := range m.messages {
		if msg.DateStr != dateStr {
			continue
		}
		if normPhone != "" {
			targetNorm := msg.NormalizedPhone
			if targetNorm == "" {
				if msg.Direction == "inbound" {
					targetNorm = NormalizePhone(msg.FromPhone)
				} else {
					targetNorm = NormalizePhone(msg.ToPhone)
				}
			}
			if targetNorm != normPhone {
				continue
			}
		}
		cloned := *msg
		results = append(results, &cloned)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.Before(results[j].CreatedAt)
	})

	return results, nil
}
