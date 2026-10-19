package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port              string
	ProjectID         string
	AllowedOrigins    string
	AdminEmail        string
	AdminPassword     string
	IsDevelopment     bool
	BigQueryDataset   string
	BigQueryColdDays  int
	AdminAPISecret    string

	// Amazon SES / SNS Inbound & Outbound Email settings
	HRNotificationEmail     string
	SystemNotificationEmail string
	DispatchForwardEmail    string
	PayrollForwardEmail     string
	AdminForwardEmail       string
	EmailRoutesMap          map[string][]string
	SMTPHost                string
	SMTPPort                int
	SMTPUsername            string
	SMTPPassword            string
	SMTPFrom                string
	AppBaseURL              string
	ApprovalSecret          string

	// Twilio & Parent App Settings
	TwilioAccountSID     string
	TwilioAuthToken      string
	TwilioFromNumber     string
	ParentAppBaseURL     string
	ParentJWTSigningKey  string

	// Google Maps Routes API (Server-side only, never leaked to clients)
	GoogleMapsAPIKey string
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	projectID := os.Getenv("GCP_PROJECT_ID")
	if projectID == "" {
		projectID = os.Getenv("FIREBASE_PROJECT_ID")
	}
	if projectID == "" {
		projectID = "schoolbusdispatchapp"
	}

	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "*"
	}

	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@example.com"
	}

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "dev_admin_password_change_in_production"
	}

	adminAPISecret := os.Getenv("ADMIN_API_SECRET")
	if adminAPISecret == "" {
		adminAPISecret = os.Getenv("ARCHIVE_ADMIN_SECRET")
	}

	bqDataset := os.Getenv("BIGQUERY_DATASET")
	if bqDataset == "" {
		bqDataset = "firestore_export"
	}

	bqColdDays := 60
	if daysStr := os.Getenv("BIGQUERY_COLD_DAYS"); daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
			bqColdDays = d
		}
	}

	env := os.Getenv("ENV")

	hrEmail := os.Getenv("HR_NOTIFICATION_EMAIL")
	if hrEmail == "" {
		hrEmail = "hr@example.com"
	}

	sysEmail := os.Getenv("SYSTEM_NOTIFICATION_EMAIL")
	if sysEmail == "" {
		sysEmail = "noreply@example.com"
	}

	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := 587
	if pStr := os.Getenv("SMTP_PORT"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			smtpPort = p
		}
	}

	smtpUser := os.Getenv("SMTP_USERNAME")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	smtpFrom := os.Getenv("SMTP_FROM")
	if smtpFrom == "" {
		smtpFrom = sysEmail
	}

	appBaseURL := os.Getenv("APP_BASE_URL")
	if appBaseURL == "" {
		appBaseURL = "http://localhost:8080"
	}

	approvalSecret := os.Getenv("APPROVAL_SECRET")
	if approvalSecret == "" {
		approvalSecret = "DevApprovalSecretChangeInProduction"
	}

	dispatchEmail := os.Getenv("DISPATCH_FORWARD_EMAIL")
	if dispatchEmail == "" {
		dispatchEmail = "dispatch@example.com"
	}

	payrollEmail := os.Getenv("PAYROLL_FORWARD_EMAIL")
	if payrollEmail == "" {
		payrollEmail = "payroll@example.com"
	}

	adminForwardEmail := os.Getenv("ADMIN_FORWARD_EMAIL")
	if adminForwardEmail == "" {
		adminForwardEmail = hrEmail
	}

	routesMap := parseEmailRoutesMap(os.Getenv("EMAIL_ROUTES_MAP"))

	return &Config{
		Port:                    port,
		ProjectID:               projectID,
		AllowedOrigins:          allowedOrigins,
		AdminEmail:              adminEmail,
		AdminPassword:           adminPassword,
		IsDevelopment:           env == "development" || env == "",
		BigQueryDataset:         bqDataset,
		BigQueryColdDays:        bqColdDays,
		AdminAPISecret:          adminAPISecret,
		HRNotificationEmail:     hrEmail,
		SystemNotificationEmail: sysEmail,
		DispatchForwardEmail:    dispatchEmail,
		PayrollForwardEmail:     payrollEmail,
		AdminForwardEmail:       adminForwardEmail,
		EmailRoutesMap:          routesMap,
		SMTPHost:                smtpHost,
		SMTPPort:                smtpPort,
		SMTPUsername:            smtpUser,
		SMTPPassword:            smtpPass,
		SMTPFrom:                smtpFrom,
		AppBaseURL:              appBaseURL,
		ApprovalSecret:          approvalSecret,
		TwilioAccountSID:        os.Getenv("TWILIO_ACCOUNT_SID"),
		TwilioAuthToken:         os.Getenv("TWILIO_AUTH_TOKEN"),
		TwilioFromNumber:        os.Getenv("TWILIO_FROM_NUMBER"),
		ParentAppBaseURL:        os.Getenv("PARENT_APP_BASE_URL"),
		ParentJWTSigningKey:     os.Getenv("PARENT_JWT_SIGNING_KEY"),
		GoogleMapsAPIKey:        getEnvFallback("GOOGLE_MAPS_API_KEY", "GOOGLE_ROUTES_API_KEY"),
	}
}

func getEnvFallback(keys ...string) string {
	for _, k := range keys {
		if val := strings.TrimSpace(os.Getenv(k)); val != "" {
			return val
		}
	}
	return ""
}

// GetForwardTargets returns the target forwarding emails for a specific recipient mailbox
func (c *Config) GetForwardTargets(mailbox string) []string {
	cleanMailbox := strings.ToLower(strings.TrimSpace(mailbox))

	// Check if explicit custom route is configured in EMAIL_ROUTES_MAP
	if targets, exists := c.EmailRoutesMap[cleanMailbox]; exists && len(targets) > 0 {
		return targets
	}

	// Dynamic defaults based on mailbox prefix
	if strings.Contains(cleanMailbox, "leave") || strings.Contains(cleanMailbox, "timeoff") {
		return splitEmails(c.HRNotificationEmail)
	}
	if strings.Contains(cleanMailbox, "dispatch") {
		return splitEmails(c.DispatchForwardEmail)
	}
	if strings.Contains(cleanMailbox, "payroll") {
		return splitEmails(c.PayrollForwardEmail)
	}

	// Default fallback to Admin/HR
	if c.AdminForwardEmail != "" {
		return splitEmails(c.AdminForwardEmail)
	}
	return splitEmails(c.HRNotificationEmail)
}

func splitEmails(s string) []string {
	var list []string
	for _, item := range strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == ';' }) {
		if clean := strings.TrimSpace(item); clean != "" {
			list = append(list, clean)
		}
	}
	return list
}

// parseEmailRoutesMap parses strings formatted as "mbox1=tgt1,tgt2;mbox2=tgt3"
func parseEmailRoutesMap(raw string) map[string][]string {
	result := make(map[string][]string)
	if strings.TrimSpace(raw) == "" {
		return result
	}

	entries := strings.Split(raw, ";")
	for _, entry := range entries {
		parts := strings.SplitN(entry, "=", 2)
		if len(parts) == 2 {
			k := strings.ToLower(strings.TrimSpace(parts[0]))
			var targets []string
			for _, t := range strings.Split(parts[1], ",") {
				if ct := strings.TrimSpace(t); ct != "" {
					targets = append(targets, ct)
				}
			}
			if len(targets) > 0 {
				result[k] = targets
			}
		}
	}
	return result
}

// ResolveCredentialsPath searches for Google Application Credentials in env or nearby files
func ResolveCredentialsPath() string {
	if envPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"); envPath != "" {
		if fileExists(envPath) {
			return envPath
		}
	}

	candidates := []string{
		"serviceAccountKey.json",
		"../serviceAccountKey.json",
		"credentials.json",
		"../credentials.json",
	}

	for _, path := range candidates {
		if fileExists(path) {
			return path
		}
	}

	return ""
}

func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

