package services

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const bambooEmployeeFields = "firstName,lastName,preferredName,displayName,status,hireDate,jobTitle,employeeNumber,customNumberofChildrenonRoute,customFirstAidExpiry,customFirstAidCompletion,customPoliceCheckIssued"

var webhookKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{12,128}$`)

var (
	ErrBadWebhookKey         = errors.New("bad request")
	ErrInvalidWebhookPayload = errors.New("Invalid payload")
)

// BambooWebhookPayload matches the BambooHR employee-change webhook body.
type BambooWebhookPayload struct {
	Employees []BambooWebhookEmployee `json:"employees"`
}

// BambooWebhookEmployee is one changed employee in a webhook delivery.
type BambooWebhookEmployee struct {
	ID            string   `json:"id"`
	Action        string   `json:"action"`
	ChangedFields []string `json:"changedFields"`
}

// BambooWebhookEvent is the stored dry-run result. Contact fields are not kept.
type BambooWebhookEvent struct {
	ReceivedAt     string   `json:"receivedAt" firestore:"receivedAt"`
	EmployeeID     string   `json:"employeeId" firestore:"employeeId"`
	Action         string   `json:"action" firestore:"action"`
	ChangedFields  []string `json:"changedFields" firestore:"changedFields"`
	DisplayName    string   `json:"displayName,omitempty" firestore:"displayName,omitempty"`
	JobTitle       string   `json:"jobTitle,omitempty" firestore:"jobTitle,omitempty"`
	Status         string   `json:"status,omitempty" firestore:"status,omitempty"`
	EmployeeNumber string   `json:"employeeNumber,omitempty" firestore:"employeeNumber,omitempty"`
	Note           string   `json:"note,omitempty" firestore:"note,omitempty"`
	Persisted      bool     `json:"persisted" firestore:"persisted"`
}

// BambooWebhookResult is returned to the webhook caller. Nothing is written to employees.
type BambooWebhookResult struct {
	OK        bool                 `json:"ok"`
	Persisted bool                 `json:"persisted"`
	Received  int                  `json:"received"`
	Results   []BambooWebhookEvent `json:"results"`
}

func normalizeWebhookKey(raw string) (string, error) {
	key := strings.TrimSpace(raw)
	if !webhookKeyPattern.MatchString(key) {
		return "", fmt.Errorf("webhook key must be 12 to 128 letters, numbers, _ or -")
	}
	return key, nil
}

func webhookKeyMatches(got, want string) bool {
	if strings.TrimSpace(want) == "" || strings.TrimSpace(got) == "" {
		return false
	}
	sumGot := sha256.Sum256([]byte(got))
	sumWant := sha256.Sum256([]byte(want))
	return subtle.ConstantTimeCompare(sumGot[:], sumWant[:]) == 1
}

// ReceiveWebhook checks the path key, reads each employee from BambooHR, and does not save them.
func (s *BambooHRService) ReceiveWebhook(ctx context.Context, apiKey string, payload *BambooWebhookPayload) (*BambooWebhookResult, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !webhookKeyMatches(apiKey, secret.WebhookKey) {
		return nil, ErrBadWebhookKey
	}
	if payload == nil || payload.Employees == nil {
		return nil, ErrInvalidWebhookPayload
	}

	now := time.Now().UTC().Format(time.RFC3339)
	events := make([]BambooWebhookEvent, 0, len(payload.Employees))
	for _, employee := range payload.Employees {
		events = append(events, s.readWebhookEmployee(ctx, secret, now, employee))
	}
	if err := s.store.AppendWebhookEvents(ctx, events); err != nil {
		return nil, err
	}
	return &BambooWebhookResult{
		OK:        true,
		Persisted: false,
		Received:  len(events),
		Results:   events,
	}, nil
}

func (s *BambooHRService) ListWebhookEvents(ctx context.Context) ([]BambooWebhookEvent, error) {
	events, err := s.store.ListWebhookEvents(ctx)
	if err != nil {
		return nil, err
	}
	if events == nil {
		events = []BambooWebhookEvent{}
	}
	return events, nil
}

func (s *BambooHRService) readWebhookEmployee(ctx context.Context, secret bambooSecret, receivedAt string, employee BambooWebhookEmployee) BambooWebhookEvent {
	event := BambooWebhookEvent{
		ReceivedAt:    receivedAt,
		EmployeeID:    strings.TrimSpace(employee.ID),
		Action:        strings.TrimSpace(employee.Action),
		ChangedFields: limitStrings(employee.ChangedFields, 20),
		Persisted:     false,
	}
	bambooID, err := strconv.Atoi(event.EmployeeID)
	if err != nil || bambooID <= 0 {
		event.Note = "Invalid employee ID"
		return event
	}
	if strings.TrimSpace(secret.APIKey) == "" || secret.CompanyDomain == "" {
		event.Note = "BambooHR API key is not configured"
		return event
	}

	rawURL := s.baseURL(secret.CompanyDomain) + "/employees/" + url.PathEscape(strconv.Itoa(bambooID)) + "/?fields=" + url.QueryEscape(bambooEmployeeFields)
	payload, err := s.getJSON(ctx, rawURL, secret.APIKey)
	if err != nil {
		event.Note = err.Error()
		return event
	}
	row, ok := payload.(map[string]any)
	if !ok {
		event.Note = "BambooHR employee response could not be read"
		return event
	}
	event.DisplayName = displayName(row)
	event.JobTitle = stringField(row, "jobTitle")
	event.Status = stringField(row, "status")
	event.EmployeeNumber = stringField(row, "employeeNumber")
	event.Note = "Read from BambooHR. Not written to the dispatch database."
	return event
}

func limitStrings(values []string, max int) []string {
	if len(values) == 0 {
		return nil
	}
	if len(values) > max {
		values = values[:max]
	}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if len(value) > 80 {
			value = value[:80]
		}
		out = append(out, value)
	}
	return out
}
