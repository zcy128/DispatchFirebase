package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const bambooPreviewLimit = 8

var companyDomainPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

// BambooHRSettings is the admin-facing view. The API key is never included.
type BambooHRSettings struct {
	Enabled              bool   `json:"enabled"`
	CompanyDomain        string `json:"companyDomain"`
	APIKeyConfigured     bool   `json:"apiKeyConfigured"`
	WebhookKeyConfigured bool   `json:"webhookKeyConfigured"`
	DailySyncTime        string `json:"dailySyncTime"`
	LastDailySyncAt      string `json:"lastDailySyncAt,omitempty"`
	LastDailySyncCount   int    `json:"lastDailySyncCount"`
	UpdatedAt            string `json:"updatedAt,omitempty"`
}

// BambooHRSave is the write payload. An empty APIKey keeps the stored key.
type BambooHRSave struct {
	Enabled         bool   `json:"enabled"`
	CompanyDomain   string `json:"companyDomain"`
	APIKey          string `json:"apiKey"`
	ClearAPIKey     bool   `json:"clearApiKey"`
	WebhookKey      string `json:"webhookKey"`
	ClearWebhookKey bool   `json:"clearWebhookKey"`
	DailySyncTime   string `json:"dailySyncTime"`
}

// BambooHRPreview is a directory row that would be considered for sync.
// Contact fields from BambooHR are intentionally omitted.
type BambooHRPreview struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	JobTitle    string `json:"jobTitle"`
	Status      string `json:"status"`
}

// BambooHRTestReport is a dry run. It never writes employees into dispatch storage.
type BambooHRTestReport struct {
	DryRun         bool              `json:"dryRun"`
	Persisted      bool              `json:"persisted"`
	CompanyDomain  string            `json:"companyDomain"`
	FieldCount     int               `json:"fieldCount"`
	UserCount      int               `json:"userCount"`
	DirectoryCount int               `json:"directoryCount"`
	MatchedCount   int               `json:"matchedCount"`
	Preview        []BambooHRPreview `json:"preview"`
	Message        string            `json:"message"`
}

type bambooSecret struct {
	Enabled            bool   `json:"-" firestore:"enabled"`
	CompanyDomain      string `json:"-" firestore:"companyDomain"`
	APIKey             string `json:"-" firestore:"apiKey"`
	WebhookKey         string `json:"-" firestore:"webhookKey"`
	DailySyncTime      string `json:"-" firestore:"dailySyncTime"`
	LastDailySyncDate  string `json:"-" firestore:"lastDailySyncDate"`
	LastDailySyncAt    string `json:"-" firestore:"lastDailySyncAt"`
	LastDailySyncCount int    `json:"-" firestore:"lastDailySyncCount"`
	UpdatedAt          string `json:"-" firestore:"updatedAt"`
}

func (s bambooSecret) public() BambooHRSettings {
	return BambooHRSettings{
		Enabled:              s.Enabled,
		CompanyDomain:        s.CompanyDomain,
		APIKeyConfigured:     strings.TrimSpace(s.APIKey) != "",
		WebhookKeyConfigured: strings.TrimSpace(s.WebhookKey) != "",
		DailySyncTime:        normalizeStoredDailySyncTime(s.DailySyncTime),
		LastDailySyncAt:      s.LastDailySyncAt,
		LastDailySyncCount:   s.LastDailySyncCount,
		UpdatedAt:            s.UpdatedAt,
	}
}

// NormalizeCompanyDomain accepts a subdomain or a host and returns the BambooHR subdomain.
func NormalizeCompanyDomain(raw string) (string, error) {
	domain := strings.ToLower(strings.TrimSpace(raw))
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimSuffix(domain, "/")
	domain = strings.TrimSuffix(domain, ".bamboohr.com")
	if i := strings.Index(domain, "."); i >= 0 {
		domain = domain[:i]
	}
	if domain == "" {
		return "", nil
	}
	if !companyDomainPattern.MatchString(domain) {
		return "", fmt.Errorf("company domain must be a BambooHR subdomain")
	}
	return domain, nil
}

// BambooHRService reads BambooHR account metadata and the employee directory.
// TestSync does not write those employees into the dispatch database.
type BambooHRService struct {
	store   bambooSecretStore
	client  *http.Client
	baseURL func(companyDomain string) string
}

func NewBambooHRService(store bambooSecretStore) *BambooHRService {
	return &BambooHRService{
		store:  store,
		client: &http.Client{Timeout: 20 * time.Second},
		baseURL: func(companyDomain string) string {
			return "https://api.bamboohr.com/api/gateway.php/" + url.PathEscape(companyDomain) + "/v1"
		},
	}
}

func (s *BambooHRService) GetSettings(ctx context.Context) (BambooHRSettings, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return BambooHRSettings{}, err
	}
	return secret.public(), nil
}

func (s *BambooHRService) SaveSettings(ctx context.Context, in BambooHRSave) (BambooHRSettings, error) {
	domain, err := NormalizeCompanyDomain(in.CompanyDomain)
	if err != nil {
		return BambooHRSettings{}, err
	}
	if in.Enabled && domain == "" {
		return BambooHRSettings{}, fmt.Errorf("company domain is required when sync is enabled")
	}

	current, err := s.store.Load(ctx)
	if err != nil {
		return BambooHRSettings{}, err
	}
	next := current
	next.Enabled = in.Enabled
	next.CompanyDomain = domain
	next.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if in.ClearAPIKey {
		next.APIKey = ""
	} else if strings.TrimSpace(in.APIKey) != "" {
		next.APIKey = strings.TrimSpace(in.APIKey)
	}
	if in.ClearWebhookKey {
		next.WebhookKey = ""
	} else if strings.TrimSpace(in.WebhookKey) != "" {
		webhookKey, err := normalizeWebhookKey(in.WebhookKey)
		if err != nil {
			return BambooHRSettings{}, err
		}
		next.WebhookKey = webhookKey
	}
	dailySyncTime, err := normalizeDailySyncTime(in.DailySyncTime)
	if err != nil {
		return BambooHRSettings{}, err
	}
	next.DailySyncTime = dailySyncTime
	if err := s.store.Save(ctx, next); err != nil {
		return BambooHRSettings{}, err
	}
	return next.public(), nil
}

func (s *BambooHRService) TestSync(ctx context.Context) (*BambooHRTestReport, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !secret.Enabled {
		return nil, fmt.Errorf("BambooHR sync is turned off")
	}
	if strings.TrimSpace(secret.APIKey) == "" {
		return nil, fmt.Errorf("BambooHR API key is not configured")
	}
	if secret.CompanyDomain == "" {
		return nil, fmt.Errorf("BambooHR company domain is not configured")
	}

	base := s.baseURL(secret.CompanyDomain)
	fields, err := s.getJSON(ctx, base+"/meta/fields", secret.APIKey)
	if err != nil {
		return nil, err
	}
	users, err := s.getJSON(ctx, base+"/meta/users", secret.APIKey)
	if err != nil {
		return nil, err
	}
	directory, err := s.getJSON(ctx, base+"/employees/directory", secret.APIKey)
	if err != nil {
		return nil, err
	}

	report := &BambooHRTestReport{
		DryRun:        true,
		Persisted:     false,
		CompanyDomain: secret.CompanyDomain,
		FieldCount:    countFields(fields),
		UserCount:     countUsers(users),
		Preview:       []BambooHRPreview{},
		Message:       "Dry run only. No employees were written to the dispatch database.",
	}
	employees := directoryEmployees(directory)
	report.DirectoryCount = len(employees)
	report.MatchedCount = len(employees)
	for _, emp := range employees {
		if len(report.Preview) >= bambooPreviewLimit {
			break
		}
		report.Preview = append(report.Preview, BambooHRPreview{
			ID:          stringField(emp, "id"),
			DisplayName: displayName(emp),
			JobTitle:    stringField(emp, "jobTitle"),
			Status:      stringField(emp, "status"),
		})
	}
	return report, nil
}

// BambooHRManualSync is an on-demand directory read. Employees are not written.
type BambooHRManualSync struct {
	Persisted      bool   `json:"persisted"`
	DirectoryCount int    `json:"directoryCount"`
	SyncedAt       string `json:"syncedAt"`
	Message        string `json:"message"`
}

// SyncNow reads the full directory immediately and records it as today's sync.
// It does not write employees into the dispatch database.
func (s *BambooHRService) SyncNow(ctx context.Context) (*BambooHRManualSync, error) {
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		loc = time.FixedZone("EDT", -4*3600)
	}
	return s.syncDirectory(ctx, time.Now().In(loc))
}

// RunScheduledSync reads the full BambooHR directory once per day at the configured Ottawa time.
// It does not write employees into the dispatch database.
func (s *BambooHRService) RunScheduledSync(ctx context.Context) {
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		loc = time.FixedZone("EDT", -4*3600)
	}
	s.runScheduledSyncAt(ctx, time.Now().In(loc))
}

func (s *BambooHRService) runScheduledSyncAt(ctx context.Context, now time.Time) {
	secret, err := s.store.Load(ctx)
	if err != nil || !secret.Enabled || strings.TrimSpace(secret.APIKey) == "" || secret.CompanyDomain == "" {
		return
	}
	syncTime := normalizeStoredDailySyncTime(secret.DailySyncTime)
	if now.Format("15:04") < syncTime {
		return
	}
	today := now.Format("2006-01-02")
	if secret.LastDailySyncDate == today {
		return
	}
	_, _ = s.syncDirectory(ctx, now)
}

func (s *BambooHRService) syncDirectory(ctx context.Context, now time.Time) (*BambooHRManualSync, error) {
	secret, err := s.store.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !secret.Enabled {
		return nil, fmt.Errorf("BambooHR sync is turned off")
	}
	if strings.TrimSpace(secret.APIKey) == "" {
		return nil, fmt.Errorf("BambooHR API key is not configured")
	}
	if secret.CompanyDomain == "" {
		return nil, fmt.Errorf("BambooHR company domain is not configured")
	}
	directory, err := s.getJSON(ctx, s.baseURL(secret.CompanyDomain)+"/employees/directory", secret.APIKey)
	if err != nil {
		return nil, err
	}
	employees := directoryEmployees(directory)
	secret.LastDailySyncDate = now.Format("2006-01-02")
	secret.LastDailySyncAt = now.Format(time.RFC3339)
	secret.LastDailySyncCount = len(employees)
	secret.DailySyncTime = normalizeStoredDailySyncTime(secret.DailySyncTime)
	if err := s.store.Save(ctx, secret); err != nil {
		return nil, err
	}
	note := fmt.Sprintf("Read %d employees from BambooHR. Not written to the dispatch database.", len(employees))
	_ = s.store.AppendWebhookEvents(ctx, []BambooWebhookEvent{{
		ReceivedAt: secret.LastDailySyncAt,
		Action:     "DailySync",
		Note:       note,
		Persisted:  false,
	}})
	return &BambooHRManualSync{
		Persisted:      false,
		DirectoryCount: len(employees),
		SyncedAt:       secret.LastDailySyncAt,
		Message:        note,
	}, nil
}

func (s *BambooHRService) getJSON(ctx context.Context, rawURL, apiKey string) (any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(apiKey+":x")))

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("BambooHR request failed")
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("BambooHR returned HTTP %d: %s", resp.StatusCode, redactBody(string(body), apiKey))
	}
	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("BambooHR returned a response that could not be read")
	}
	return payload, nil
}

func redactBody(body, apiKey string) string {
	if apiKey != "" {
		body = strings.ReplaceAll(body, apiKey, "[redacted]")
	}
	body = strings.TrimSpace(body)
	if len(body) > 180 {
		body = body[:180]
	}
	return body
}

func countFields(payload any) int {
	list, ok := payload.([]any)
	if !ok {
		return 0
	}
	return len(list)
}

func countUsers(payload any) int {
	switch typed := payload.(type) {
	case map[string]any:
		if users, ok := typed["users"].([]any); ok {
			return len(users)
		}
		return len(typed)
	case []any:
		return len(typed)
	default:
		return 0
	}
}

func directoryEmployees(payload any) []map[string]any {
	root, ok := payload.(map[string]any)
	if !ok {
		return nil
	}
	raw, ok := root["employees"].([]any)
	if !ok {
		return nil
	}
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		if row, ok := item.(map[string]any); ok {
			out = append(out, row)
		}
	}
	return out
}

func stringField(row map[string]any, key string) string {
	value, _ := row[key].(string)
	return strings.TrimSpace(value)
}

func displayName(row map[string]any) string {
	if name := stringField(row, "displayName"); name != "" {
		return name
	}
	return strings.TrimSpace(stringField(row, "firstName") + " " + stringField(row, "lastName"))
}

func normalizeStoredDailySyncTime(raw string) string {
	parsed, err := normalizeDailySyncTime(raw)
	if err != nil {
		return "02:00"
	}
	return parsed
}

func normalizeDailySyncTime(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "02:00", nil
	}
	parsed, err := time.Parse("15:04", raw)
	if err != nil {
		return "", fmt.Errorf("daily sync time must be HH:MM")
	}
	return parsed.Format("15:04"), nil
}
