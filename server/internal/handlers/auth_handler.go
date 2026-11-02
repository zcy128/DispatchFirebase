package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	firebaseAuth "firebase.google.com/go/v4/auth"
)

type AuthHandler struct {
	repo       repository.EmployeeRepository
	authClient *firebaseAuth.Client
	cfg        *config.Config
}

var firebaseAuthHTTPClient = &http.Client{Timeout: 10 * time.Second}

func NewAuthHandler(repo repository.EmployeeRepository, authClient *firebaseAuth.Client, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		repo:       repo,
		authClient: authClient,
		cfg:        cfg,
	}
}

// ResolveEmployeeAuthUser enriches AuthUser with the latest Employee role, active status, and pagePermissions from the database.
func (h *AuthHandler) ResolveEmployeeAuthUser(ctx context.Context, user *auth.AuthUser) (*auth.AuthUser, error) {
	if user == nil {
		return nil, nil
	}

	cloned := *user
	if h.repo != nil {
		emp := h.findEmployeeForUser(ctx, user)
		if emp != nil {
			if !emp.IsActive {
				return nil, errors.New("employee account is deactivated")
			}
			if emp.Role != "" {
				cloned.Role = emp.Role
			}
			if emp.EmployeeNumber != "" {
				cloned.EmployeeID = emp.EmployeeNumber
			} else if emp.ID != "" && cloned.EmployeeID == "" {
				cloned.EmployeeID = emp.ID
			}
			if emp.Username != "" {
				cloned.Username = emp.Username
			}
			if emp.FullName != "" {
				cloned.FullName = emp.FullName
			}
			if emp.WorkEmail != "" && cloned.Email == "" {
				cloned.Email = emp.WorkEmail
			}
			if emp.YardID != "" {
				cloned.YardID = emp.YardID
			}
			if emp.PagePermissions != nil {
				cloned.PagePermissions = emp.PagePermissions
			}
		}
	}

	// Compute diff overrides against role factory defaults
	cloned.Overrides = auth.ComputeOverrides(cloned.Role, cloned.PagePermissions)
	if cloned.Overrides == nil {
		cloned.Overrides = make(map[string]string)
	}

	return &cloned, nil
}

func (h *AuthHandler) findEmployeeForUser(ctx context.Context, user *auth.AuthUser) *models.Employee {
	if user == nil || h.repo == nil {
		return nil
	}
	var emp *models.Employee
	if user.EmployeeID != "" {
		emp, _ = h.repo.GetByEmployeeNumber(ctx, user.EmployeeID)
		if emp == nil {
			emp, _ = h.repo.GetByID(ctx, user.EmployeeID)
		}
	}
	if emp == nil && user.UID != "" {
		emp, _ = h.repo.GetByFirebaseUID(ctx, user.UID)
	}
	if emp == nil && user.Username != "" {
		emp, _ = h.repo.GetByUsername(ctx, user.Username)
	}
	if emp == nil && user.Email != "" {
		if idx := strings.Index(user.Email, "@"); idx > 0 {
			uname := strings.ToLower(strings.TrimSpace(user.Email[:idx]))
			emp, _ = h.repo.GetByUsername(ctx, uname)
		}
	}
	return emp
}

type SetupAdminRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	MobilePhone string `json:"mobilePhone"`
}

type SetupAdminResponse struct {
	Message    string           `json:"message"`
	UID        string           `json:"uid"`
	Email      string           `json:"email"`
	EmployeeID string           `json:"employeeId"`
	Employee   *models.Employee `json:"employee"`
}

// SetupAdmin creates the initial system administrator in Firebase Auth & Firestore
func (h *AuthHandler) SetupAdmin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req SetupAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Use defaults if body empty
		req.Email = h.cfg.AdminEmail
		req.Password = h.cfg.AdminPassword
		req.FirstName = "System"
		req.LastName = "Admin"
		req.MobilePhone = "613-555-0100"
	}

	if req.Email == "" {
		req.Email = h.cfg.AdminEmail
	}
	if req.Password == "" {
		req.Password = h.cfg.AdminPassword
	}
	if req.FirstName == "" {
		req.FirstName = "System"
	}
	if req.LastName == "" {
		req.LastName = "Admin"
	}

	ctx := r.Context()

	// Check if admin already exists
	adminEmp, _ := h.repo.GetByEmployeeNumber(ctx, "EMP-ADMIN-001")
	if adminEmp != nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Admin account already exists",
		})
		return
	}

	var uid string

	if h.authClient != nil {
		// Create or fetch Firebase Auth user
		existingUser, err := h.authClient.GetUserByEmail(ctx, req.Email)
		if err == nil && existingUser != nil {
			if h.cfg == nil || !strings.EqualFold(existingUser.Email, h.cfg.AdminEmail) {
				http.Error(w, `{"error":"an account with this email already exists"}`, http.StatusConflict)
				return
			}
			uid = existingUser.UID
		} else {
			params := (&firebaseAuth.UserToCreate{}).
				Email(req.Email).
				Password(req.Password).
				DisplayName(req.FirstName + " " + req.LastName).
				PhoneNumber(req.MobilePhone).
				EmailVerified(true)

			u, err := h.authClient.CreateUser(ctx, params)
			if err != nil {
				http.Error(w, `{"error":"failed to create firebase auth user: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
			uid = u.UID
		}

		// Set custom claims for admin role
		claims := map[string]interface{}{
			"role":       "admin",
			"employeeId": "EMP-ADMIN-001",
		}
		if err := h.authClient.SetCustomUserClaims(ctx, uid, claims); err != nil {
			http.Error(w, `{"error":"failed to set admin claims: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	} else {
		// Mock uid for local development without Firebase service account
		uid = "mock-admin-uid-001"
	}

	// Create Employee record in master database
	now := time.Now()
	newAdmin := &models.Employee{
		EmployeeNumber:  "EMP-ADMIN-001",
		FirstName:       req.FirstName,
		LastName:        req.LastName,
		WorkEmail:       req.Email,
		MobilePhone:     req.MobilePhone,
		JobPosition:     "Operations Director & System Admin",
		DateHired:       &now,
		IsActive:        true,
		PersonalAddress: "100 Fleet Operations Blvd, Suite 200",
		YardID:          "HQ-Central",
		FirebaseUID:     uid,
		Role:            "admin",
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	newAdmin.ComputeComputedFields()

	if err := h.repo.Create(ctx, newAdmin); err != nil {
		http.Error(w, `{"error":"failed to create admin employee record: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(SetupAdminResponse{
		Message:    "Admin account and employee master record successfully provisioned",
		UID:        uid,
		Email:      req.Email,
		EmployeeID: newAdmin.ID,
		Employee:   newAdmin,
	})
}

// Me returns the profile of the authenticated user and their linked employee data
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	authUser := auth.GetUser(r.Context())
	if authUser == nil {
		http.Error(w, `{"error":"unauthenticated"}`, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	emp := h.findEmployeeForUser(ctx, authUser)

	response := map[string]interface{}{
		"user":     authUser,
		"employee": emp,
	}

	json.NewEncoder(w).Encode(response)
}

const (
	AuthEmailDomain        = "@dispatch.pcy.ca"
	DefaultInitialPassword = "Dispatch2026!"
)

type SyncedEmployeeInfo struct {
	ID                string `json:"id"`
	EmployeeNumber    string `json:"employeeNumber"`
	FullName          string `json:"fullName"`
	Username          string `json:"username"`
	AuthEmail         string `json:"authEmail"`
	FirebaseUID       string `json:"firebaseUid"`
	Role              string `json:"role"`
	Status            string `json:"status"` // "created", "updated", "existing"
	TemporaryPassword string `json:"temporaryPassword,omitempty"`
}

// SyncEmployeeUsers generates usernames and Firebase Auth user accounts for all employees
func (h *AuthHandler) SyncEmployeeUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ctx := r.Context()

	employees, err := h.repo.List(ctx, repository.EmployeeFilter{})
	if err != nil {
		http.Error(w, `{"error":"failed to list employees: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	var syncedList []SyncedEmployeeInfo

	for _, emp := range employees {
		// 1. Ensure username
		if emp.Username == "" {
			emp.Username = models.GenerateUsername(emp.FirstName, emp.LastName)
		}
		if emp.Username == "" {
			emp.Username = "emp" + emp.EmployeeNumber
		}

		authEmail := emp.Username + AuthEmailDomain
		if emp.WorkEmail == "" {
			emp.WorkEmail = authEmail
		}
		if emp.Role == "" {
			emp.Role = "driver"
		}

		status := "existing"
		var temporaryPassword string

		// 2. Firebase Auth Account Provisioning
		if h.authClient != nil {
			var uid string
			existingUser, err := h.authClient.GetUserByEmail(ctx, authEmail)
			if err == nil && existingUser != nil {
				uid = existingUser.UID
				status = "updated"
			} else {
				initialPassword := provisionPassword(h.cfg == nil || h.cfg.AllowsDemo())
				// Create new user in Firebase Auth
				params := (&firebaseAuth.UserToCreate{}).
					Email(authEmail).
					Password(initialPassword).
					DisplayName(emp.FullName).
					EmailVerified(true)
				if emp.MobilePhone != "" && strings.HasPrefix(emp.MobilePhone, "+") {
					params.PhoneNumber(emp.MobilePhone)
				}

				newUser, createErr := h.authClient.CreateUser(ctx, params)
				if createErr == nil && newUser != nil {
					uid = newUser.UID
					status = "created"
					if h.cfg != nil && !h.cfg.AllowsDemo() {
						temporaryPassword = initialPassword
					}
				} else if newUser != nil {
					uid = newUser.UID
				}
			}

			if uid != "" {
				// Ensure custom claims
				_ = h.authClient.SetCustomUserClaims(ctx, uid, map[string]interface{}{
					"role":       emp.Role,
					"employeeId": emp.EmployeeNumber,
					"username":   emp.Username,
				})
				emp.FirebaseUID = uid
			}
		} else {
			if emp.FirebaseUID == "" {
				emp.FirebaseUID = "mock-uid-" + emp.Username
				status = "mock-provisioned"
			}
		}

		// 3. Update employee master record in database
		emp.ComputeComputedFields()
		_ = h.repo.Update(ctx, emp)

		syncedList = append(syncedList, SyncedEmployeeInfo{
			ID:                emp.ID,
			EmployeeNumber:    emp.EmployeeNumber,
			FullName:          emp.FullName,
			Username:          emp.Username,
			AuthEmail:         authEmail,
			FirebaseUID:       emp.FirebaseUID,
			Role:              emp.Role,
			Status:            status,
			TemporaryPassword: temporaryPassword,
		})
	}

	payload := map[string]interface{}{
		"message":         "Employee accounts synced successfully",
		"authEmailDomain": AuthEmailDomain,
		"totalEmployees":  len(employees),
		"synced":          syncedList,
	}
	if h.cfg == nil || h.cfg.AllowsDemo() {
		payload["defaultPassword"] = DefaultInitialPassword
	}
	json.NewEncoder(w).Encode(payload)
}

// ResolveUsername takes a username (e.g. driver1d) and returns the corresponding auth login details
func (h *AuthHandler) ResolveUsername(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	username := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("username")))
	if username == "" {
		http.Error(w, `{"error":"username query parameter is required"}`, http.StatusBadRequest)
		return
	}

	authEmail := username + AuthEmailDomain
	emp, err := h.repo.GetByUsername(r.Context(), username)
	if err == nil && emp != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"found":     true,
			"username":  emp.Username,
			"authEmail": authEmail,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"found":     false,
		"username":  username,
		"authEmail": authEmail,
	})
}

type IssueMCPTokenRequest struct {
	TTLDays int `json:"ttlDays,omitempty"`
}

type IssueMCPTokenResponse struct {
	Token      string         `json:"token"`
	ExpiresAt  string         `json:"expiresAt"`
	TTLDays    int            `json:"ttlDays"`
	User       *auth.AuthUser `json:"user"`
	ServerURL  string         `json:"serverUrl"`
	MCPHttpURL string         `json:"mcpHttpUrl"`
}

// IssueMCPToken generates a signed Personal Access Token (dsp_mcp_...) for the currently logged-in user.
func (h *AuthHandler) IssueMCPToken(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	authUser := auth.GetUser(r.Context())
	if authUser == nil {
		http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
		return
	}

	resolvedUser, err := h.ResolveEmployeeAuthUser(r.Context(), authUser)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusForbidden)
		return
	}

	var req IssueMCPTokenRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	ttlDays := req.TTLDays
	if ttlDays <= 0 || ttlDays > 365 {
		ttlDays = 30
	}

	secret := ""
	if h.cfg != nil {
		secret = h.cfg.MCPTokenSecret
	}
	baseURL := resolveRequestBaseURL(r, h.cfg)

	token, exp, err := auth.GenerateMCPToken(secret, resolvedUser, time.Duration(ttlDays)*24*time.Hour)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(IssueMCPTokenResponse{
		Token:      token,
		ExpiresAt:  exp.Format(time.RFC3339),
		TTLDays:    ttlDays,
		User:       resolvedUser,
		ServerURL:  baseURL,
		MCPHttpURL: baseURL + "/api/mcp",
	})
}

type ForgotPasswordRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
}

// ForgotPassword sends a Firebase password-reset email for a staff username or email.
// A missing account still returns success so the response does not reveal who is registered.
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Enter your staff ID or email."}`, http.StatusBadRequest)
		return
	}

	identifier := strings.ToLower(strings.TrimSpace(req.Username))
	if identifier == "" {
		identifier = strings.ToLower(strings.TrimSpace(req.Email))
	}
	if identifier == "" {
		http.Error(w, `{"error":"Enter your staff ID or email."}`, http.StatusBadRequest)
		return
	}

	loginEmail := identifier
	if !strings.Contains(identifier, "@") {
		loginEmail = identifier + AuthEmailDomain
	}

	if h.cfg == nil || strings.TrimSpace(h.cfg.FirebaseWebAPIKey) == "" {
		http.Error(w, `{"error":"Password reset is not configured on this server."}`, http.StatusServiceUnavailable)
		return
	}

	if err := h.sendPasswordResetEmail(r.Context(), loginEmail); err != nil {
		if errors.Is(err, errPasswordResetNotFound) {
			writeForgotPasswordAccepted(w)
			return
		}
		http.Error(w, `{"error":"Could not send the password reset email. Try again or contact dispatch."}`, http.StatusBadGateway)
		return
	}

	writeForgotPasswordAccepted(w)
}

func writeForgotPasswordAccepted(w http.ResponseWriter) {
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "If an account exists for that staff ID, a reset link has been sent to the registered email.",
	})
}

var errPasswordResetNotFound = errors.New("password reset account not found")

func (h *AuthHandler) sendPasswordResetEmail(ctx context.Context, email string) error {
	url := fmt.Sprintf("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=%s", h.cfg.FirebaseWebAPIKey)
	payload, _ := json.Marshal(map[string]string{
		"requestType": "PASSWORD_RESET",
		"email":       email,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := firebaseAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}

	var result struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&result)
	message := strings.ToUpper(result.Error.Message)
	if strings.Contains(message, "EMAIL_NOT_FOUND") || strings.Contains(message, "USER_NOT_FOUND") {
		return errPasswordResetNotFound
	}
	return fmt.Errorf("firebase password reset status %d: %s", resp.StatusCode, result.Error.Message)
}

type LoginRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Success             bool           `json:"success"`
	Token               string         `json:"token"`
	User                *auth.AuthUser `json:"user"`
	FirebaseCustomToken string         `json:"firebaseCustomToken,omitempty"`
}

// firebaseCustomClaims are copied onto the Firebase ID token so Firestore rules
// can read request.auth.token.role / employeeId / ovr after signInWithCustomToken.
func firebaseCustomClaims(user *auth.AuthUser) map[string]interface{} {
	claims := map[string]interface{}{}
	if user == nil {
		return claims
	}
	if user.Role != "" {
		claims["role"] = user.Role
	}
	if user.EmployeeID != "" {
		claims["employeeId"] = user.EmployeeID
	}
	if user.Username != "" {
		claims["username"] = user.Username
	}
	if user.Email != "" {
		claims["email"] = user.Email
	}
	if user.YardID != "" {
		claims["yardId"] = user.YardID
	}
	if len(user.Overrides) > 0 {
		ovr := make(map[string]interface{}, len(user.Overrides))
		for key, value := range user.Overrides {
			ovr[key] = value
		}
		claims["ovr"] = ovr
	}
	return claims
}

func isSyntheticUID(uid string) bool {
	uid = strings.TrimSpace(uid)
	return uid == "" || strings.HasPrefix(uid, "mock-")
}

func firebaseAuthEmails(user *auth.AuthUser, emp *models.Employee) []string {
	seen := map[string]struct{}{}
	var emails []string
	add := func(email string) {
		email = strings.ToLower(strings.TrimSpace(email))
		if email == "" || !strings.Contains(email, "@") {
			return
		}
		if _, ok := seen[email]; ok {
			return
		}
		seen[email] = struct{}{}
		emails = append(emails, email)
	}
	if user != nil && strings.HasSuffix(strings.ToLower(strings.TrimSpace(user.Email)), AuthEmailDomain) {
		add(user.Email)
	}
	if emp != nil && emp.Username != "" {
		add(emp.Username + AuthEmailDomain)
	}
	if user != nil && user.Username != "" {
		add(user.Username + AuthEmailDomain)
	}
	if emp != nil {
		add(emp.WorkEmail)
	}
	if user != nil {
		add(user.Email)
	}
	return emails
}

func (h *AuthHandler) issueFirebaseCustomToken(ctx context.Context, user *auth.AuthUser) (string, error) {
	if h.authClient == nil || user == nil || isSyntheticUID(user.UID) {
		return "", errors.New("firebase auth client unavailable")
	}
	return h.authClient.CustomTokenWithClaims(ctx, user.UID, firebaseCustomClaims(user))
}

// bindRealFirebaseUser replaces a synthetic demo uid with the employee's Firebase Auth account.
// The account is reused when it already exists and created from the employee's login email otherwise.
func (h *AuthHandler) bindRealFirebaseUser(ctx context.Context, user *auth.AuthUser) error {
	if h.authClient == nil || user == nil {
		return nil
	}
	emp := h.findEmployeeForUser(ctx, user)
	record, err := h.lookupFirebaseUser(ctx, user, emp)
	if err != nil {
		return err
	}
	if record == nil {
		emails := firebaseAuthEmails(user, emp)
		if len(emails) == 0 {
			return errors.New("employee has no email for a firebase account")
		}
		displayName := strings.TrimSpace(user.FullName)
		if emp != nil && strings.TrimSpace(emp.FullName) != "" {
			displayName = strings.TrimSpace(emp.FullName)
		}
		params := (&firebaseAuth.UserToCreate{}).
			Email(emails[0]).
			Password(provisionPassword(h.cfg == nil || h.cfg.AllowsDemo())).
			EmailVerified(true)
		if displayName != "" {
			params.DisplayName(displayName)
		}
		created, createErr := h.authClient.CreateUser(ctx, params)
		if createErr != nil {
			if existing, lookupErr := h.authClient.GetUserByEmail(ctx, emails[0]); lookupErr == nil && existing != nil {
				record = existing
			} else {
				return createErr
			}
		} else {
			record = created
		}
	}
	if record == nil || strings.TrimSpace(record.UID) == "" {
		return errors.New("firebase account was not created")
	}

	previousUID := user.UID
	user.UID = record.UID
	if record.Email != "" {
		user.Email = record.Email
	}
	if emp != nil {
		if emp.FullName != "" {
			user.FullName = emp.FullName
		}
		if emp.Username != "" {
			user.Username = emp.Username
		} else if user.Username != "" {
			emp.Username = user.Username
		}
		if emp.EmployeeNumber != "" {
			user.EmployeeID = emp.EmployeeNumber
		}
		if emp.Role != "" {
			user.Role = emp.Role
		}
		if emp.YardID != "" {
			user.YardID = emp.YardID
		}
		if emp.ID != "" && emp.FirebaseUID != record.UID {
			emp.FirebaseUID = record.UID
			if updateErr := h.repo.Update(ctx, emp); updateErr != nil {
				log.Printf("persist firebase uid: %v", updateErr)
			}
		}
	}
	if name := strings.TrimSpace(user.FullName); name != "" && record.DisplayName != name {
		_, _ = h.authClient.UpdateUser(ctx, record.UID, (&firebaseAuth.UserToUpdate{}).DisplayName(name))
	}
	h.deleteSyntheticFirebaseUser(ctx, previousUID, record.UID)
	h.deleteSyntheticFirebaseUser(ctx, "mock-admin-uid-001", record.UID)
	return nil
}

func (h *AuthHandler) deleteSyntheticFirebaseUser(ctx context.Context, uid string, keepUID string) {
	if h.authClient == nil || strings.TrimSpace(uid) == "" || !isSyntheticUID(uid) || uid == keepUID {
		return
	}
	if err := h.authClient.DeleteUser(ctx, uid); err != nil && !firebaseAuth.IsUserNotFound(err) {
		log.Printf("remove synthetic firebase user %s: %v", uid, err)
	}
}

func (h *AuthHandler) lookupFirebaseUser(ctx context.Context, user *auth.AuthUser, emp *models.Employee) (*firebaseAuth.UserRecord, error) {
	if emp != nil && !isSyntheticUID(emp.FirebaseUID) {
		record, err := h.authClient.GetUser(ctx, emp.FirebaseUID)
		if err == nil && record != nil {
			return record, nil
		}
	}
	if user != nil && !isSyntheticUID(user.UID) {
		record, err := h.authClient.GetUser(ctx, user.UID)
		if err == nil && record != nil {
			return record, nil
		}
	}
	var lastErr error
	for _, email := range firebaseAuthEmails(user, emp) {
		record, err := h.authClient.GetUserByEmail(ctx, email)
		if err == nil && record != nil {
			return record, nil
		}
		if err != nil {
			lastErr = err
		}
	}
	if lastErr != nil && !firebaseAuth.IsUserNotFound(lastErr) {
		return nil, lastErr
	}
	return nil, nil
}

// FirebaseToken exchanges an already-authenticated API session for a Firebase custom token.
// The browser uses it to restore request.auth so Firestore listeners are not denied.
func (h *AuthHandler) FirebaseToken(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	user := auth.GetUser(r.Context())
	if user == nil || (strings.TrimSpace(user.UID) == "" && strings.TrimSpace(user.EmployeeID) == "" && strings.TrimSpace(user.Email) == "") {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	if err := h.bindRealFirebaseUser(r.Context(), user); err != nil {
		log.Printf("bind firebase user: %v", err)
		http.Error(w, `{"error":"firebase session unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	customToken, err := h.issueFirebaseCustomToken(r.Context(), user)
	if err != nil {
		log.Printf("firebase custom token: %v", err)
		http.Error(w, `{"error":"firebase session unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"customToken": customToken})
}

// Login authenticates a user by username/email + password and returns their profile with role and allowed modules.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid login payload"}`, http.StatusBadRequest)
		return
	}

	identifier := strings.ToLower(strings.TrimSpace(req.Username))
	if identifier == "" {
		identifier = strings.ToLower(strings.TrimSpace(req.Email))
	}
	password := req.Password
	if identifier == "" || password == "" {
		http.Error(w, `{"error":"username and password are required"}`, http.StatusBadRequest)
		return
	}

	loginEmail := identifier
	usernamePart := identifier
	if !strings.Contains(identifier, "@") {
		loginEmail = identifier + AuthEmailDomain
	} else if idx := strings.Index(identifier, "@"); idx > 0 {
		usernamePart = identifier[:idx]
	}

	ctx := r.Context()
	var verifiedUser *auth.AuthUser
	var idToken string

	// 1. If Firebase Web API Key is configured, verify password against Firebase Identity Toolkit
	if h.cfg != nil && h.cfg.FirebaseWebAPIKey != "" {
		fbUser, firebaseIDToken, err := h.verifyPasswordWithFirebaseREST(ctx, loginEmail, password)
		if err == nil && fbUser != nil {
			verifiedUser = fbUser
			idToken = firebaseIDToken
		} else if !h.cfg.AllowsDemo() {
			http.Error(w, `{"error":"invalid username or password"}`, http.StatusUnauthorized)
			return
		}
	}

	// 2. Demo/Local fallback password verification if not yet verified
	if verifiedUser == nil {
		if h.cfg != nil && !h.cfg.AllowsDemo() {
			http.Error(w, `{"error":"invalid username or password"}`, http.StatusUnauthorized)
			return
		}

		// Demo mode credential check
		validDemoPass := password == DefaultInitialPassword ||
			password == "Admin@Dispatch2026!" ||
			password == "demo" ||
			password == "password" ||
			(h.cfg != nil && h.cfg.AdminPassword != "" && password == h.cfg.AdminPassword)
		if !validDemoPass {
			http.Error(w, `{"error":"invalid username or password"}`, http.StatusUnauthorized)
			return
		}

		if usernamePart == "admin" || loginEmail == "admin@dispatch.local" || (h.cfg != nil && strings.EqualFold(loginEmail, h.cfg.AdminEmail)) {
			verifiedUser = &auth.AuthUser{
				Email:      loginEmail,
				Username:   "admin",
				Role:       "admin",
				EmployeeID: "EMP-ADMIN-001",
			}
			if h.repo != nil {
				if emp, _ := h.repo.GetByEmployeeNumber(ctx, "EMP-ADMIN-001"); emp != nil {
					verifiedUser.FullName = emp.FullName
					verifiedUser.YardID = emp.YardID
					verifiedUser.PagePermissions = emp.PagePermissions
					if emp.Username != "" {
						verifiedUser.Username = emp.Username
					}
					if emp.Role != "" {
						verifiedUser.Role = emp.Role
					}
					if !isSyntheticUID(emp.FirebaseUID) {
						verifiedUser.UID = emp.FirebaseUID
					}
				}
			}
		} else if h.repo != nil {
			emp, _ := h.repo.GetByUsername(ctx, usernamePart)
			if emp == nil {
				emp, _ = h.repo.GetByEmployeeNumber(ctx, strings.ToUpper(usernamePart))
			}
			if emp == nil {
				emp, _ = h.repo.GetByID(ctx, usernamePart)
			}
			if emp == nil {
				http.Error(w, `{"error":"user account not found"}`, http.StatusUnauthorized)
				return
			}
			if !emp.IsActive {
				http.Error(w, `{"error":"employee account is deactivated"}`, http.StatusForbidden)
				return
			}
			verifiedUser = &auth.AuthUser{
				UID:             emp.FirebaseUID,
				Email:           emp.WorkEmail,
				Username:        emp.Username,
				FullName:        emp.FullName,
				Role:            emp.Role,
				EmployeeID:      emp.EmployeeNumber,
				YardID:          emp.YardID,
				PagePermissions: emp.PagePermissions,
			}
			if isSyntheticUID(verifiedUser.UID) {
				verifiedUser.UID = ""
			}
		}
	}

	if verifiedUser == nil {
		http.Error(w, `{"error":"authentication failed"}`, http.StatusUnauthorized)
		return
	}

	resolvedUser, err := h.ResolveEmployeeAuthUser(ctx, verifiedUser)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusForbidden)
		return
	}
	if bindErr := h.bindRealFirebaseUser(ctx, resolvedUser); bindErr != nil {
		log.Printf("bind firebase user: %v", bindErr)
	}

	// 3. Sync Firebase Custom Claims if Firebase Admin client is active and user has a real UID
	if h.authClient != nil && !isSyntheticUID(resolvedUser.UID) {
		claims := map[string]interface{}{
			"role":       resolvedUser.Role,
			"employeeId": resolvedUser.EmployeeID,
			"username":   resolvedUser.Username,
			"yardId":     resolvedUser.YardID,
			"ovr":        resolvedUser.Overrides,
		}
		_ = h.authClient.SetCustomUserClaims(ctx, resolvedUser.UID, claims)
	}

	// 4. Generate Auth Token
	secret := ""
	if h.cfg != nil {
		secret = h.cfg.MCPTokenSecret
	}
	token := idToken
	if token == "" {
		generatedToken, _, genErr := auth.GenerateMCPToken(secret, resolvedUser, 30*24*time.Hour)
		if genErr != nil {
			http.Error(w, `{"error":"failed to generate access token"}`, http.StatusInternalServerError)
			return
		}
		token = generatedToken
	}

	firebaseCustomToken, tokenErr := h.issueFirebaseCustomToken(ctx, resolvedUser)
	if tokenErr != nil {
		log.Printf("firebase custom token: %v", tokenErr)
	}

	json.NewEncoder(w).Encode(LoginResponse{
		Success:             true,
		Token:               token,
		User:                resolvedUser,
		FirebaseCustomToken: firebaseCustomToken,
	})
}

type LoginMCPRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	TTLDays  int    `json:"ttlDays,omitempty"`
}

// LoginMCP authenticates a user by username/email + password and returns a signed MCP token.
func (h *AuthHandler) LoginMCP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req LoginMCPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid login payload"}`, http.StatusBadRequest)
		return
	}

	identifier := strings.ToLower(strings.TrimSpace(req.Username))
	password := req.Password
	if identifier == "" || password == "" {
		http.Error(w, `{"error":"username and password are required"}`, http.StatusBadRequest)
		return
	}

	loginEmail := identifier
	usernamePart := identifier
	if !strings.Contains(identifier, "@") {
		loginEmail = identifier + AuthEmailDomain
	} else if idx := strings.Index(identifier, "@"); idx > 0 {
		usernamePart = identifier[:idx]
	}

	ctx := r.Context()
	var verifiedUser *auth.AuthUser

	// 1. If Firebase Web API Key is configured, verify password against Firebase Identity Toolkit
	if h.cfg != nil && h.cfg.FirebaseWebAPIKey != "" {
		fbUser, _, err := h.verifyPasswordWithFirebaseREST(ctx, loginEmail, password)
		if err == nil && fbUser != nil {
			verifiedUser = fbUser
		} else if !h.cfg.AllowsDemo() {
			http.Error(w, `{"error":"invalid username or password"}`, http.StatusUnauthorized)
			return
		}
	}

	// 2. Demo/Local fallback password verification if not yet verified
	if verifiedUser == nil {
		if h.cfg != nil && !h.cfg.AllowsDemo() {
			http.Error(w, `{"error":"FIREBASE_WEB_API_KEY is required for direct password login in production; please generate an MCP token from the Web Settings page"}`, http.StatusServiceUnavailable)
			return
		}

		// Demo mode credential check
		validDemoPass := password == DefaultInitialPassword ||
			password == "Admin@Dispatch2026!" ||
			(h.cfg != nil && h.cfg.AdminPassword != "" && password == h.cfg.AdminPassword)
		if !validDemoPass {
			http.Error(w, `{"error":"invalid username or password"}`, http.StatusUnauthorized)
			return
		}

		if usernamePart == "admin" || loginEmail == "admin@dispatch.local" || (h.cfg != nil && strings.EqualFold(loginEmail, h.cfg.AdminEmail)) {
			verifiedUser = &auth.AuthUser{
				Email:      loginEmail,
				Username:   "admin",
				Role:       "admin",
				EmployeeID: "EMP-ADMIN-001",
			}
			if h.repo != nil {
				if emp, _ := h.repo.GetByEmployeeNumber(ctx, "EMP-ADMIN-001"); emp != nil {
					verifiedUser.FullName = emp.FullName
					verifiedUser.YardID = emp.YardID
					verifiedUser.PagePermissions = emp.PagePermissions
					if emp.Username != "" {
						verifiedUser.Username = emp.Username
					}
					if emp.Role != "" {
						verifiedUser.Role = emp.Role
					}
					if !isSyntheticUID(emp.FirebaseUID) {
						verifiedUser.UID = emp.FirebaseUID
					}
				}
			}
		} else if h.repo != nil {
			emp, _ := h.repo.GetByUsername(ctx, usernamePart)
			if emp == nil {
				emp, _ = h.repo.GetByEmployeeNumber(ctx, strings.ToUpper(usernamePart))
			}
			if emp == nil {
				http.Error(w, `{"error":"user account not found"}`, http.StatusUnauthorized)
				return
			}
			if !emp.IsActive {
				http.Error(w, `{"error":"employee account is deactivated"}`, http.StatusForbidden)
				return
			}
			verifiedUser = &auth.AuthUser{
				UID:             emp.FirebaseUID,
				Email:           emp.WorkEmail,
				Username:        emp.Username,
				FullName:        emp.FullName,
				Role:            emp.Role,
				EmployeeID:      emp.EmployeeNumber,
				PagePermissions: emp.PagePermissions,
			}
			if isSyntheticUID(verifiedUser.UID) {
				verifiedUser.UID = ""
			}
		}
	}

	if verifiedUser == nil {
		http.Error(w, `{"error":"authentication failed"}`, http.StatusUnauthorized)
		return
	}

	resolvedUser, err := h.ResolveEmployeeAuthUser(ctx, verifiedUser)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusForbidden)
		return
	}
	if bindErr := h.bindRealFirebaseUser(ctx, resolvedUser); bindErr != nil {
		log.Printf("bind firebase user: %v", bindErr)
	}

	ttlDays := req.TTLDays
	if ttlDays <= 0 || ttlDays > 365 {
		ttlDays = 30
	}

	secret := ""
	if h.cfg != nil {
		secret = h.cfg.MCPTokenSecret
	}
	baseURL := resolveRequestBaseURL(r, h.cfg)

	token, exp, err := auth.GenerateMCPToken(secret, resolvedUser, time.Duration(ttlDays)*24*time.Hour)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(IssueMCPTokenResponse{
		Token:      token,
		ExpiresAt:  exp.Format(time.RFC3339),
		TTLDays:    ttlDays,
		User:       resolvedUser,
		ServerURL:  baseURL,
		MCPHttpURL: baseURL + "/api/mcp",
	})
}

const DefaultCloudRunAPIURL = "https://dispatch-api-337919645491.northamerica-northeast1.run.app"

// resolveRequestBaseURL determines the public API server URL from Config or defaults to the Cloud Run API URL.
func resolveRequestBaseURL(_ *http.Request, cfg *config.Config) string {
	if cfg != nil && cfg.AppBaseURL != "" && cfg.AppBaseURL != "http://localhost:8080" {
		return strings.TrimRight(cfg.AppBaseURL, "/")
	}
	return DefaultCloudRunAPIURL
}

func (h *AuthHandler) verifyPasswordWithFirebaseREST(ctx context.Context, email, password string) (*auth.AuthUser, string, error) {
	url := fmt.Sprintf("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=%s", h.cfg.FirebaseWebAPIKey)
	payload, _ := json.Marshal(map[string]interface{}{
		"email":             email,
		"password":          password,
		"returnSecureToken": true,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := firebaseAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", errors.New("firebase sign-in rejected credentials")
	}

	var result struct {
		LocalID     string `json:"localId"`
		Email       string `json:"email"`
		DisplayName string `json:"displayName"`
		IDToken     string `json:"idToken"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", err
	}

	user := &auth.AuthUser{
		UID:      result.LocalID,
		Email:    result.Email,
		FullName: result.DisplayName,
		Role:     "staff",
	}

	// If Firebase Admin client is available, verify token to extract custom claims
	if h.authClient != nil && result.IDToken != "" {
		if tok, err := h.authClient.VerifyIDToken(ctx, result.IDToken); err == nil && tok != nil {
			if r, ok := tok.Claims["role"].(string); ok && r != "" {
				user.Role = r
			}
			if e, ok := tok.Claims["employeeId"].(string); ok && e != "" {
				user.EmployeeID = e
			}
			if u, ok := tok.Claims["username"].(string); ok && u != "" {
				user.Username = u
			}
		}
	}

	return user, result.IDToken, nil
}
