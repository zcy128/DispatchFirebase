package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"github.com/go-chi/chi/v5"
)

type EmployeeHandler struct {
	repo       repository.EmployeeRepository
	authClient *firebaseAuth.Client
	allowDemo  bool
}

func callerCanManageEmployees(r *http.Request) bool {
	user := auth.GetUser(r.Context())
	if user == nil {
		return false
	}
	effective, _, _, _, _ := auth.ComputeEffectivePermissions(user.Role, user.PagePermissions)
	return effective["employees"] == "readwrite"
}

func callerMayChangeAdminAccount(r *http.Request, existing *models.Employee) bool {
	if existing == nil {
		return false
	}
	protected := strings.EqualFold(existing.Role, "admin") ||
		existing.EmployeeNumber == "EMP-ADMIN-001" ||
		existing.ID == "EMP-ADMIN-001"
	if !protected {
		return true
	}
	caller := auth.GetUser(r.Context())
	return caller != nil && strings.EqualFold(caller.Role, "admin")
}

func NewEmployeeHandler(repo repository.EmployeeRepository, authClient *firebaseAuth.Client, allowDemo bool) *EmployeeHandler {
	return &EmployeeHandler{repo: repo, authClient: authClient, allowDemo: allowDemo}
}

// List returns a filtered list of employees
func (h *EmployeeHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	query := r.URL.Query()
	search := query.Get("search")
	jobPos := query.Get("jobPosition")
	yardID := query.Get("yardId")
	licenseDue := query.Get("licenseDue") == "true"

	var activeOnly *bool
	if a := query.Get("activeOnly"); a != "" {
		val := a == "true" || a == "1"
		activeOnly = &val
	}

	filter := repository.EmployeeFilter{
		Search:      search,
		JobPosition: jobPos,
		YardID:      yardID,
		ActiveOnly:  activeOnly,
		LicenseDue:  licenseDue,
	}

	employees, err := h.repo.List(r.Context(), filter)
	if err != nil {
		http.Error(w, `{"error":"failed to list employees: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	if employees == nil {
		employees = []*models.Employee{}
	}

	json.NewEncoder(w).Encode(employees)
}

// Get returns single employee details
func (h *EmployeeHandler) Get(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	emp, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		// Fallback try by EmployeeNumber
		emp, err = h.repo.GetByEmployeeNumber(r.Context(), id)
		if err != nil {
			http.Error(w, `{"error":"employee not found"}`, http.StatusNotFound)
			return
		}
	}

	json.NewEncoder(w).Encode(emp)
}

// Create inserts a new employee into the master database
func (h *EmployeeHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !callerCanManageEmployees(r) {
		http.Error(w, `{"error":"forbidden: employee write permission required"}`, http.StatusForbidden)
		return
	}

	var emp models.Employee
	if err := json.NewDecoder(r.Body).Decode(&emp); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(emp.FirstName) == "" || strings.TrimSpace(emp.LastName) == "" {
		http.Error(w, `{"error":"firstName and lastName are required"}`, http.StatusBadRequest)
		return
	}
	if strings.EqualFold(strings.TrimSpace(emp.Role), "admin") {
		caller := auth.GetUser(r.Context())
		if caller == nil || !strings.EqualFold(caller.Role, "admin") {
			http.Error(w, `{"error":"forbidden: only an admin can create an admin account"}`, http.StatusForbidden)
			return
		}
	}

	// Auto-generate employeeNumber if blank
	if strings.TrimSpace(emp.EmployeeNumber) == "" {
		emp.EmployeeNumber = "EMP-" + strconv.FormatInt(time.Now().Unix()%100000, 10)
	}

	if emp.JobPosition == "" {
		emp.JobPosition = "School Bus Driver"
	}

	emp.ComputeComputedFields()

	temporaryPassword := ""
	// Automatically provision Firebase Auth user account for employee
	if h.authClient != nil {
		authEmail := emp.Username + "@dispatch.pcy.ca"
		initialPassword := provisionPassword(h.allowDemo)
		params := (&firebaseAuth.UserToCreate{}).
			Email(authEmail).
			Password(initialPassword).
			DisplayName(emp.FullName).
			EmailVerified(true)
		if u, err := h.authClient.CreateUser(r.Context(), params); err == nil && u != nil {
			if !h.allowDemo {
				temporaryPassword = initialPassword
			}
			_ = h.authClient.SetCustomUserClaims(r.Context(), u.UID, map[string]interface{}{
				"role":       emp.Role,
				"employeeId": emp.EmployeeNumber,
				"username":   emp.Username,
			})
			emp.FirebaseUID = u.UID
		}
	}

	if err := h.repo.Create(r.Context(), &emp); err != nil {
		if err == repository.ErrConflict {
			http.Error(w, `{"error":"employee number already exists"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to create employee: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if temporaryPassword == "" {
		json.NewEncoder(w).Encode(emp)
		return
	}
	json.NewEncoder(w).Encode(struct {
		*models.Employee
		TemporaryPassword string `json:"temporaryPassword,omitempty"`
	}{Employee: &emp, TemporaryPassword: temporaryPassword})
}

// Update modifies an existing employee
func (h *EmployeeHandler) Update(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !callerCanManageEmployees(r) {
		http.Error(w, `{"error":"forbidden: employee write permission required"}`, http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")

	existing, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		existing, err = h.repo.GetByEmployeeNumber(r.Context(), id)
		if err != nil {
			http.Error(w, `{"error":"employee not found"}`, http.StatusNotFound)
			return
		}
	}
	if !callerMayChangeAdminAccount(r, existing) {
		http.Error(w, `{"error":"forbidden: only an admin can modify an administrator account"}`, http.StatusForbidden)
		return
	}

	var raw map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	setString := func(key string, dest *string) {
		value, ok := raw[key]
		if !ok {
			return
		}
		var text string
		if json.Unmarshal(value, &text) == nil {
			*dest = strings.TrimSpace(text)
		}
	}
	setString("firstName", &existing.FirstName)
	setString("lastName", &existing.LastName)
	setString("middleName", &existing.MiddleName)
	if _, ok := raw["username"]; ok {
		setString("username", &existing.Username)
		existing.Username = strings.ToLower(existing.Username)
	}
	setString("employeeNumber", &existing.EmployeeNumber)
	setString("mobilePhone", &existing.MobilePhone)
	setString("workPhonePhone", &existing.WorkPhonePhone)
	if _, ok := raw["workPhone"]; ok {
		setString("workPhone", &existing.WorkPhonePhone)
	}
	setString("homePhone", &existing.HomePhone)
	setString("personalEmail", &existing.PersonalEmail)
	setString("workEmail", &existing.WorkEmail)
	setString("jobPosition", &existing.JobPosition)
	setString("personalAddress", &existing.PersonalAddress)
	setString("yardId", &existing.YardID)
	if value, ok := raw["dateHired"]; ok && string(value) != "null" {
		var hired time.Time
		if json.Unmarshal(value, &hired) == nil {
			existing.DateHired = &hired
		}
	}
	if value, ok := raw["isActive"]; ok {
		var active bool
		if json.Unmarshal(value, &active) == nil {
			existing.IsActive = active
		}
	}
	if value, ok := raw["hasCoveredAsDriver"]; ok {
		var covered bool
		if json.Unmarshal(value, &covered) == nil {
			existing.HasCoveredAsDriver = covered
		}
	}
	if value, ok := raw["hasCoveredAsAttendant"]; ok {
		var covered bool
		if json.Unmarshal(value, &covered) == nil {
			existing.HasCoveredAsAttendant = covered
		}
	}
	if value, ok := raw["lat"]; ok && string(value) != "null" {
		var lat float64
		if json.Unmarshal(value, &lat) == nil {
			existing.Lat = &lat
		}
	}
	if value, ok := raw["lng"]; ok && string(value) != "null" {
		var lng float64
		if json.Unmarshal(value, &lng) == nil {
			existing.Lng = &lng
		}
	}
	if value, ok := raw["driverLicense"]; ok && string(value) != "null" {
		var license models.DriverLicense
		if json.Unmarshal(value, &license) == nil {
			existing.DriverLicense = &license
		}
	}
	if value, ok := raw["employeeContacts"]; ok {
		var contacts []models.EmployeeContact
		if json.Unmarshal(value, &contacts) == nil {
			existing.EmployeeContacts = contacts
		}
	}
	if value, ok := raw["employeePhoto"]; ok && string(value) != "null" {
		var photo models.EmployeePhoto
		if json.Unmarshal(value, &photo) == nil {
			existing.EmployeePhoto = &photo
		}
	}
	if value, ok := raw["role"]; ok {
		var role string
		if json.Unmarshal(value, &role) == nil && strings.TrimSpace(role) != "" && !strings.EqualFold(role, existing.Role) {
			role = strings.TrimSpace(role)
			caller := auth.GetUser(r.Context())
			if strings.EqualFold(role, "admin") && (caller == nil || !strings.EqualFold(caller.Role, "admin")) {
				http.Error(w, `{"error":"forbidden: only an admin can grant the admin role"}`, http.StatusForbidden)
				return
			}
			existing.Role = role
		}
	}
	if value, ok := raw["pagePermissions"]; ok {
		caller := auth.GetUser(r.Context())
		if caller == nil || !strings.EqualFold(caller.Role, "admin") {
			http.Error(w, `{"error":"forbidden: only an admin can change page permissions"}`, http.StatusForbidden)
			return
		}
		var permissions map[string]string
		if json.Unmarshal(value, &permissions) == nil {
			existing.PagePermissions = permissions
		}
	}

	existing.ComputeComputedFields()

	// Keep Firebase Auth custom claims in sync
	if h.authClient != nil && existing.FirebaseUID != "" {
		claims := map[string]interface{}{
			"role":       existing.Role,
			"employeeId": existing.EmployeeNumber,
			"username":   existing.Username,
			"yardId":     existing.YardID,
		}
		_ = h.authClient.SetCustomUserClaims(r.Context(), existing.FirebaseUID, claims)
	}

	if err := h.repo.Update(r.Context(), existing); err != nil {
		http.Error(w, `{"error":"failed to update employee: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(existing)
}

// Delete removes an employee record
func (h *EmployeeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !callerCanManageEmployees(r) {
		http.Error(w, `{"error":"forbidden: employee write permission required"}`, http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")

	existing, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		existing, err = h.repo.GetByEmployeeNumber(r.Context(), id)
		if err != nil {
			http.Error(w, `{"error":"employee not found"}`, http.StatusNotFound)
			return
		}
	}
	if !callerMayChangeAdminAccount(r, existing) {
		http.Error(w, `{"error":"forbidden: only an admin can delete an administrator account"}`, http.StatusForbidden)
		return
	}

	if err := h.repo.Delete(r.Context(), existing.ID); err != nil {
		http.Error(w, `{"error":"failed to delete employee: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"message": "employee deleted successfully",
		"id":      existing.ID,
	})
}

// Stats returns office operational metrics
func (h *EmployeeHandler) Stats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	all, err := h.repo.List(r.Context(), repository.EmployeeFilter{})
	if err != nil {
		http.Error(w, `{"error":"failed to fetch stats"}`, http.StatusInternalServerError)
		return
	}

	now := time.Now()
	threshold30Days := now.AddDate(0, 0, 30)

	total := len(all)
	activeCount := 0
	driverCount := 0
	licenseExpiringCount := 0
	yardDistribution := make(map[string]int)

	for _, e := range all {
		if e.IsActive {
			activeCount++
		}
		if strings.Contains(strings.ToLower(e.JobPosition), "driver") {
			driverCount++
		}
		if e.DriverLicense != nil && !e.DriverLicense.ExpirationDate.IsZero() {
			if e.DriverLicense.ExpirationDate.Before(threshold30Days) {
				licenseExpiringCount++
			}
		}
		yard := e.YardID
		if yard == "" {
			yard = "Unassigned"
		}
		yardDistribution[yard]++
	}

	stats := map[string]interface{}{
		"totalEmployees":      total,
		"activeEmployees":     activeCount,
		"totalDrivers":        driverCount,
		"licenseExpiringSoon": licenseExpiringCount,
		"yardDistribution":    yardDistribution,
		"timestamp":           time.Now(),
	}

	json.NewEncoder(w).Encode(stats)
}
