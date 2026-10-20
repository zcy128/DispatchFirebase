package handlers

import (
	"encoding/json"
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
	var emp *models.Employee

	if authUser.EmployeeID != "" {
		emp, _ = h.repo.GetByEmployeeNumber(ctx, authUser.EmployeeID)
	}
	if emp == nil && authUser.UID != "" {
		emp, _ = h.repo.GetByFirebaseUID(ctx, authUser.UID)
	}

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
