package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
		if h.authClient != nil {
			existingUser, err := h.authClient.GetUserByEmail(ctx, req.Email)
			if err != nil || existingUser == nil {
				params := (&firebaseAuth.UserToCreate{}).
					Email(req.Email).
					Password(req.Password).
					DisplayName(adminEmp.FullName).
					EmailVerified(true)
				u, createErr := h.authClient.CreateUser(ctx, params)
				if createErr == nil && u != nil {
					_ = h.authClient.SetCustomUserClaims(ctx, u.UID, map[string]interface{}{
						"role":       "admin",
						"employeeId": "EMP-ADMIN-001",
					})
					adminEmp.FirebaseUID = u.UID
					_ = h.repo.Update(ctx, adminEmp)
				}
			}
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(SetupAdminResponse{
			Message:    "Admin account verified in master database",
			UID:        adminEmp.FirebaseUID,
			Email:      adminEmp.WorkEmail,
			EmployeeID: adminEmp.ID,
			Employee:   adminEmp,
		})
		return
	}

	var uid string

	if h.authClient != nil {
		// Create or fetch Firebase Auth user
		existingUser, err := h.authClient.GetUserByEmail(ctx, req.Email)
		if err == nil && existingUser != nil {
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
			"found":          true,
			"username":       emp.Username,
			"authEmail":      authEmail,
			"fullName":       emp.FullName,
			"role":           emp.Role,
			"employeeNumber": emp.EmployeeNumber,
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

type LoginRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Success bool           `json:"success"`
	Token   string         `json:"token"`
	User    *auth.AuthUser `json:"user"`
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
		fbUser, err := h.verifyPasswordWithFirebaseREST(ctx, loginEmail, password)
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
				UID:        "mock-admin-uid-001",
				Email:      loginEmail,
				Username:   "admin",
				FullName:   "System Admin",
				Role:       "admin",
				EmployeeID: "EMP-ADMIN-001",
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
			if verifiedUser.UID == "" {
				verifiedUser.UID = "mock-uid-" + emp.Username
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

	// 3. Sync Firebase Custom Claims if Firebase Admin client is active and user has a real UID
	if h.authClient != nil && resolvedUser.UID != "" && !strings.HasPrefix(resolvedUser.UID, "mock-") {
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
		if genErr == nil {
			token = generatedToken
		} else {
			token = "mock-token-" + resolvedUser.Username
		}
	}

	json.NewEncoder(w).Encode(LoginResponse{
		Success: true,
		Token:   token,
		User:    resolvedUser,
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
		fbUser, err := h.verifyPasswordWithFirebaseREST(ctx, loginEmail, password)
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
				UID:        "mock-admin-uid-001",
				Email:      loginEmail,
				Username:   "admin",
				FullName:   "System Admin",
				Role:       "admin",
				EmployeeID: "EMP-ADMIN-001",
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
			if verifiedUser.UID == "" {
				verifiedUser.UID = "mock-uid-" + emp.Username
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

const DefaultCloudRunAPIURL = "https://dispatch-api-kv7qum3dca-nn.a.run.app"

// resolveRequestBaseURL determines the public API server URL from Config or defaults to the Cloud Run API URL.
func resolveRequestBaseURL(_ *http.Request, cfg *config.Config) string {
	if cfg != nil && cfg.AppBaseURL != "" && cfg.AppBaseURL != "http://localhost:8080" {
		return strings.TrimRight(cfg.AppBaseURL, "/")
	}
	return DefaultCloudRunAPIURL
}

func (h *AuthHandler) verifyPasswordWithFirebaseREST(ctx context.Context, email, password string) (*auth.AuthUser, error) {
	url := fmt.Sprintf("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=%s", h.cfg.FirebaseWebAPIKey)
	payload, _ := json.Marshal(map[string]interface{}{
		"email":             email,
		"password":          password,
		"returnSecureToken": true,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("firebase sign-in rejected credentials")
	}

	var result struct {
		LocalID      string `json:"localId"`
		Email        string `json:"email"`
		DisplayName  string `json:"displayName"`
		IDToken      string `json:"idToken"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
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

	return user, nil
}
