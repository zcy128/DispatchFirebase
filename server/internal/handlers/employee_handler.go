package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	firebaseAuth "firebase.google.com/go/v4/auth"
	"github.com/go-chi/chi/v5"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type EmployeeHandler struct {
	repo       repository.EmployeeRepository
	authClient *firebaseAuth.Client
}

func NewEmployeeHandler(repo repository.EmployeeRepository, authClient *firebaseAuth.Client) *EmployeeHandler {
	return &EmployeeHandler{repo: repo, authClient: authClient}
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

	var emp models.Employee
	if err := json.NewDecoder(r.Body).Decode(&emp); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(emp.FirstName) == "" || strings.TrimSpace(emp.LastName) == "" {
		http.Error(w, `{"error":"firstName and lastName are required"}`, http.StatusBadRequest)
		return
	}

	// Auto-generate employeeNumber if blank
	if strings.TrimSpace(emp.EmployeeNumber) == "" {
		emp.EmployeeNumber = "EMP-" + strconv.FormatInt(time.Now().Unix()%100000, 10)
	}

	if emp.JobPosition == "" {
		emp.JobPosition = "School Bus Driver"
	}

	emp.ComputeComputedFields()

	// Automatically provision Firebase Auth user account for employee
	if h.authClient != nil {
		authEmail := emp.Username + "@dispatch.pcy.ca"
		params := (&firebaseAuth.UserToCreate{}).
			Email(authEmail).
			Password("Dispatch2026!").
			DisplayName(emp.FullName).
			EmailVerified(true)
		if u, err := h.authClient.CreateUser(r.Context(), params); err == nil && u != nil {
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
	json.NewEncoder(w).Encode(emp)
}

// Update modifies an existing employee
func (h *EmployeeHandler) Update(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	existing, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		existing, err = h.repo.GetByEmployeeNumber(r.Context(), id)
		if err != nil {
			http.Error(w, `{"error":"employee not found"}`, http.StatusNotFound)
			return
		}
	}

	var req models.Employee
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	// Update fields
	if req.FirstName != "" {
		existing.FirstName = strings.TrimSpace(req.FirstName)
	}
	if req.LastName != "" {
		existing.LastName = strings.TrimSpace(req.LastName)
	}
	// MiddleName can be updated or cleared
	existing.MiddleName = strings.TrimSpace(req.MiddleName)

	if req.Username != "" {
		existing.Username = strings.ToLower(strings.TrimSpace(req.Username))
	}

	if req.EmployeeNumber != "" {
		existing.EmployeeNumber = strings.TrimSpace(req.EmployeeNumber)
	}
	existing.MobilePhone = strings.TrimSpace(req.MobilePhone)
	existing.WorkPhonePhone = strings.TrimSpace(req.WorkPhonePhone)
	existing.HomePhone = strings.TrimSpace(req.HomePhone)
	existing.PersonalEmail = strings.TrimSpace(req.PersonalEmail)
	existing.WorkEmail = strings.TrimSpace(req.WorkEmail)
	if req.JobPosition != "" {
		existing.JobPosition = strings.TrimSpace(req.JobPosition)
	}
	if req.DateHired != nil {
		existing.DateHired = req.DateHired
	}
	existing.IsActive = req.IsActive
	existing.PersonalAddress = strings.TrimSpace(req.PersonalAddress)
	if req.Lat != nil {
		existing.Lat = req.Lat
	}
	if req.Lng != nil {
		existing.Lng = req.Lng
	}
	if req.YardID != "" {
		existing.YardID = req.YardID
	}
	if req.DriverLicense != nil {
		existing.DriverLicense = req.DriverLicense
	}
	if req.EmployeeContacts != nil {
		existing.EmployeeContacts = req.EmployeeContacts
	}
	if req.EmployeePhoto != nil {
		existing.EmployeePhoto = req.EmployeePhoto
	}
	if req.Role != "" {
		existing.Role = req.Role
	}
	if req.PagePermissions != nil {
		existing.PagePermissions = req.PagePermissions
	}

	existing.ComputeComputedFields()

	// Keep Firebase Auth custom claims in sync
	if h.authClient != nil && existing.FirebaseUID != "" {
		claims := map[string]interface{}{
			"role":            existing.Role,
			"employeeId":      existing.EmployeeNumber,
			"username":        existing.Username,
			"yardId":          existing.YardID,
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
	id := chi.URLParam(r, "id")

	existing, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		existing, err = h.repo.GetByEmployeeNumber(r.Context(), id)
		if err != nil {
			http.Error(w, `{"error":"employee not found"}`, http.StatusNotFound)
			return
		}
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
		"totalEmployees":       total,
		"activeEmployees":      activeCount,
		"totalDrivers":         driverCount,
		"licenseExpiringSoon":  licenseExpiringCount,
		"yardDistribution":     yardDistribution,
		"timestamp":            time.Now(),
	}

	json.NewEncoder(w).Encode(stats)
}
