package repository

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
)

var (
	ErrNotFound = errors.New("employee not found")
	ErrConflict = errors.New("employee number already exists")
)

type EmployeeFilter struct {
	Search      string
	JobPosition string
	YardID      string
	ActiveOnly  *bool
	LicenseDue  bool // driver license expiring within 30 days
}

type EmployeeRepository interface {
	List(ctx context.Context, filter EmployeeFilter) ([]*models.Employee, error)
	GetByID(ctx context.Context, id string) (*models.Employee, error)
	GetByEmployeeNumber(ctx context.Context, empNum string) (*models.Employee, error)
	GetByUsername(ctx context.Context, username string) (*models.Employee, error)
	GetByFirebaseUID(ctx context.Context, uid string) (*models.Employee, error)
	Create(ctx context.Context, emp *models.Employee) error
	Update(ctx context.Context, emp *models.Employee) error
	Delete(ctx context.Context, id string) error
	Count(ctx context.Context) (int, error)
	RegisterDeviceToken(ctx context.Context, employeeID string, token models.DeviceToken) error
	RemoveDeviceTokens(ctx context.Context, employeeID string, deadTokens []string) error
}

// ── Firestore Implementation ──────────────────────────────────────────────────

type FirestoreEmployeeRepository struct {
	client *firestore.Client
	coll   string
}

func NewFirestoreEmployeeRepository(client *firestore.Client) *FirestoreEmployeeRepository {
	return &FirestoreEmployeeRepository{
		client: client,
		coll:   "employees",
	}
}

func (r *FirestoreEmployeeRepository) List(ctx context.Context, filter EmployeeFilter) ([]*models.Employee, error) {
	query := r.client.Collection(r.coll).Query

	if filter.ActiveOnly != nil && *filter.ActiveOnly {
		query = query.Where("isActive", "==", true)
	}
	if filter.YardID != "" {
		query = query.Where("yardId", "==", filter.YardID)
	}
	if filter.JobPosition != "" {
		query = query.Where("jobPosition", "==", filter.JobPosition)
	}

	iter := query.Documents(ctx)
	defer iter.Stop()

	var result []*models.Employee
	term := strings.ToLower(strings.TrimSpace(filter.Search))
	now := time.Now()
	threshold := now.AddDate(0, 0, 30)

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		var emp models.Employee
		if err := doc.DataTo(&emp); err != nil {
			continue
		}
		emp.ID = doc.Ref.ID
		emp.ComputeComputedFields()

		// Search term filter
		if term != "" {
			nameMatch := strings.Contains(strings.ToLower(emp.FullName), term)
			numMatch := strings.Contains(strings.ToLower(emp.EmployeeNumber), term)
			posMatch := strings.Contains(strings.ToLower(emp.JobPosition), term)
			phoneMatch := strings.Contains(emp.MobilePhone, term) || strings.Contains(emp.WorkPhonePhone, term)
			if !nameMatch && !numMatch && !posMatch && !phoneMatch {
				continue
			}
		}

		// License due filter
		if filter.LicenseDue {
			if emp.DriverLicense == nil || emp.DriverLicense.ExpirationDate.IsZero() {
				continue
			}
			if emp.DriverLicense.ExpirationDate.After(threshold) {
				continue
			}
		}

		result = append(result, &emp)
	}

	return result, nil
}

func (r *FirestoreEmployeeRepository) GetByID(ctx context.Context, id string) (*models.Employee, error) {
	doc, err := r.client.Collection(r.coll).Doc(id).Get(ctx)
	if err != nil {
		return nil, ErrNotFound
	}

	var emp models.Employee
	if err := doc.DataTo(&emp); err != nil {
		return nil, err
	}
	emp.ID = doc.Ref.ID
	emp.ComputeComputedFields()
	return &emp, nil
}

func (r *FirestoreEmployeeRepository) GetByEmployeeNumber(ctx context.Context, empNum string) (*models.Employee, error) {
	iter := r.client.Collection(r.coll).Where("employeeNumber", "==", empNum).Limit(1).Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var emp models.Employee
	if err := doc.DataTo(&emp); err != nil {
		return nil, err
	}
	emp.ID = doc.Ref.ID
	emp.ComputeComputedFields()
	return &emp, nil
}

func (r *FirestoreEmployeeRepository) GetByUsername(ctx context.Context, username string) (*models.Employee, error) {
	iter := r.client.Collection(r.coll).Where("username", "==", strings.ToLower(username)).Limit(1).Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var emp models.Employee
	if err := doc.DataTo(&emp); err != nil {
		return nil, err
	}
	emp.ID = doc.Ref.ID
	emp.ComputeComputedFields()
	return &emp, nil
}

func (r *FirestoreEmployeeRepository) GetByFirebaseUID(ctx context.Context, uid string) (*models.Employee, error) {
	iter := r.client.Collection(r.coll).Where("firebaseUid", "==", uid).Limit(1).Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var emp models.Employee
	if err := doc.DataTo(&emp); err != nil {
		return nil, err
	}
	emp.ID = doc.Ref.ID
	emp.ComputeComputedFields()
	return &emp, nil
}

func (r *FirestoreEmployeeRepository) Create(ctx context.Context, emp *models.Employee) error {
	existing, _ := r.GetByEmployeeNumber(ctx, emp.EmployeeNumber)
	if existing != nil {
		return ErrConflict
	}

	emp.CreatedAt = time.Now()
	emp.UpdatedAt = time.Now()
	emp.ComputeComputedFields()

	docRef := r.client.Collection(r.coll).NewDoc()
	emp.ID = docRef.ID

	_, err := docRef.Set(ctx, emp)
	return err
}

func (r *FirestoreEmployeeRepository) Update(ctx context.Context, emp *models.Employee) error {
	emp.UpdatedAt = time.Now()
	emp.ComputeComputedFields()

	_, err := r.client.Collection(r.coll).Doc(emp.ID).Set(ctx, emp)
	return err
}

func (r *FirestoreEmployeeRepository) Delete(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.coll).Doc(id).Delete(ctx)
	return err
}

func (r *FirestoreEmployeeRepository) Count(ctx context.Context) (int, error) {
	snaps, err := r.client.Collection(r.coll).Documents(ctx).GetAll()
	if err != nil {
		return 0, err
	}
	return len(snaps), nil
}

func (r *FirestoreEmployeeRepository) RegisterDeviceToken(ctx context.Context, employeeID string, token models.DeviceToken) error {
	docRef := r.client.Collection(r.coll).Doc(employeeID)
	doc, err := docRef.Get(ctx)
	if err != nil {
		emp, err2 := r.GetByEmployeeNumber(ctx, employeeID)
		if err2 != nil {
			emp, err3 := r.GetByUsername(ctx, employeeID)
			if err3 != nil {
				return ErrNotFound
			}
			docRef = r.client.Collection(r.coll).Doc(emp.ID)
		} else {
			docRef = r.client.Collection(r.coll).Doc(emp.ID)
		}
		doc, err = docRef.Get(ctx)
		if err != nil {
			return ErrNotFound
		}
	}

	var emp models.Employee
	if err := doc.DataTo(&emp); err != nil {
		return err
	}

	now := time.Now().UTC()
	token.LastActiveAt = now
	found := false
	var updatedDevices []models.DeviceToken
	for _, d := range emp.Devices {
		if d.Token == token.Token {
			d.Platform = token.Platform
			d.DeviceName = token.DeviceName
			d.LastActiveAt = now
			found = true
		}
		updatedDevices = append(updatedDevices, d)
	}
	if !found {
		updatedDevices = append(updatedDevices, token)
	}

	// Keep max 3 devices, sorted by LastActiveAt desc
	if len(updatedDevices) > 3 {
		sort.Slice(updatedDevices, func(i, j int) bool {
			return updatedDevices[i].LastActiveAt.After(updatedDevices[j].LastActiveAt)
		})
		updatedDevices = updatedDevices[:3]
	}

	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "devices", Value: updatedDevices},
		{Path: "updatedAt", Value: now},
	})
	return err
}

func (r *FirestoreEmployeeRepository) RemoveDeviceTokens(ctx context.Context, employeeID string, deadTokens []string) error {
	if len(deadTokens) == 0 {
		return nil
	}
	deadSet := make(map[string]bool)
	for _, dt := range deadTokens {
		deadSet[dt] = true
	}

	docRef := r.client.Collection(r.coll).Doc(employeeID)
	doc, err := docRef.Get(ctx)
	if err != nil {
		emp, err2 := r.GetByEmployeeNumber(ctx, employeeID)
		if err2 != nil {
			return ErrNotFound
		}
		docRef = r.client.Collection(r.coll).Doc(emp.ID)
		doc, err = docRef.Get(ctx)
		if err != nil {
			return ErrNotFound
		}
	}

	var emp models.Employee
	if err := doc.DataTo(&emp); err != nil {
		return err
	}

	var remaining []models.DeviceToken
	for _, d := range emp.Devices {
		if !deadSet[d.Token] {
			remaining = append(remaining, d)
		}
	}

	now := time.Now().UTC()
	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "devices", Value: remaining},
		{Path: "updatedAt", Value: now},
	})
	return err
}

// ── Memory Implementation (For Local Development / Fallback) ──────────────────

type MemoryEmployeeRepository struct {
	mu        sync.RWMutex
	employees map[string]*models.Employee
}

func NewMemoryEmployeeRepository() *MemoryEmployeeRepository {
	return &MemoryEmployeeRepository{
		employees: make(map[string]*models.Employee),
	}
}

func (m *MemoryEmployeeRepository) List(ctx context.Context, filter EmployeeFilter) ([]*models.Employee, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*models.Employee
	term := strings.ToLower(strings.TrimSpace(filter.Search))
	now := time.Now()
	threshold := now.AddDate(0, 0, 30)

	for _, emp := range m.employees {
		if filter.ActiveOnly != nil && *filter.ActiveOnly && !emp.IsActive {
			continue
		}
		if filter.YardID != "" && emp.YardID != filter.YardID {
			continue
		}
		if filter.JobPosition != "" && !strings.EqualFold(emp.JobPosition, filter.JobPosition) {
			continue
		}
		if term != "" {
			nameMatch := strings.Contains(strings.ToLower(emp.FullName), term)
			numMatch := strings.Contains(strings.ToLower(emp.EmployeeNumber), term)
			posMatch := strings.Contains(strings.ToLower(emp.JobPosition), term)
			phoneMatch := strings.Contains(emp.MobilePhone, term) || strings.Contains(emp.WorkPhonePhone, term)
			if !nameMatch && !numMatch && !posMatch && !phoneMatch {
				continue
			}
		}
		if filter.LicenseDue {
			if emp.DriverLicense == nil || emp.DriverLicense.ExpirationDate.IsZero() {
				continue
			}
			if emp.DriverLicense.ExpirationDate.After(threshold) {
				continue
			}
		}
		result = append(result, emp)
	}

	return result, nil
}

func (m *MemoryEmployeeRepository) GetByID(ctx context.Context, id string) (*models.Employee, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	emp, ok := m.employees[id]
	if !ok {
		return nil, ErrNotFound
	}
	return emp, nil
}

func (m *MemoryEmployeeRepository) GetByEmployeeNumber(ctx context.Context, empNum string) (*models.Employee, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, emp := range m.employees {
		if strings.EqualFold(emp.EmployeeNumber, empNum) {
			return emp, nil
		}
	}
	return nil, ErrNotFound
}

func (m *MemoryEmployeeRepository) GetByUsername(ctx context.Context, username string) (*models.Employee, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, emp := range m.employees {
		if strings.EqualFold(emp.Username, username) {
			return emp, nil
		}
	}
	return nil, ErrNotFound
}

func (m *MemoryEmployeeRepository) GetByFirebaseUID(ctx context.Context, uid string) (*models.Employee, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, emp := range m.employees {
		if emp.FirebaseUID == uid {
			return emp, nil
		}
	}
	return nil, ErrNotFound
}

func (m *MemoryEmployeeRepository) Create(ctx context.Context, emp *models.Employee) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, existing := range m.employees {
		if strings.EqualFold(existing.EmployeeNumber, emp.EmployeeNumber) {
			return ErrConflict
		}
	}

	if emp.ID == "" {
		if emp.EmployeeNumber != "" {
			emp.ID = emp.EmployeeNumber
		} else {
			emp.ID = "EMP-" + time.Now().Format("20060102150405.000000")
		}
	}
	emp.CreatedAt = time.Now()
	emp.UpdatedAt = time.Now()
	emp.ComputeComputedFields()

	m.employees[emp.ID] = emp
	return nil
}

func (m *MemoryEmployeeRepository) Update(ctx context.Context, emp *models.Employee) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.employees[emp.ID]; !ok {
		return ErrNotFound
	}

	emp.UpdatedAt = time.Now()
	emp.ComputeComputedFields()
	m.employees[emp.ID] = emp
	return nil
}

func (m *MemoryEmployeeRepository) Delete(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.employees[id]; !ok {
		return ErrNotFound
	}
	delete(m.employees, id)
	return nil
}

func (m *MemoryEmployeeRepository) Count(ctx context.Context) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.employees), nil
}

func (m *MemoryEmployeeRepository) RegisterDeviceToken(ctx context.Context, employeeID string, token models.DeviceToken) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var emp *models.Employee
	for _, e := range m.employees {
		if e.ID == employeeID || strings.EqualFold(e.EmployeeNumber, employeeID) || strings.EqualFold(e.Username, employeeID) {
			emp = e
			break
		}
	}
	if emp == nil {
		return ErrNotFound
	}

	now := time.Now().UTC()
	token.LastActiveAt = now
	found := false
	var updatedDevices []models.DeviceToken
	for _, d := range emp.Devices {
		if d.Token == token.Token {
			d.Platform = token.Platform
			d.DeviceName = token.DeviceName
			d.LastActiveAt = now
			found = true
		}
		updatedDevices = append(updatedDevices, d)
	}
	if !found {
		updatedDevices = append(updatedDevices, token)
	}

	if len(updatedDevices) > 3 {
		sort.Slice(updatedDevices, func(i, j int) bool {
			return updatedDevices[i].LastActiveAt.After(updatedDevices[j].LastActiveAt)
		})
		updatedDevices = updatedDevices[:3]
	}

	emp.Devices = updatedDevices
	emp.UpdatedAt = now
	return nil
}

func (m *MemoryEmployeeRepository) RemoveDeviceTokens(ctx context.Context, employeeID string, deadTokens []string) error {
	if len(deadTokens) == 0 {
		return nil
	}
	deadSet := make(map[string]bool)
	for _, dt := range deadTokens {
		deadSet[dt] = true
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	var emp *models.Employee
	for _, e := range m.employees {
		if e.ID == employeeID || strings.EqualFold(e.EmployeeNumber, employeeID) || strings.EqualFold(e.Username, employeeID) {
			emp = e
			break
		}
	}
	if emp == nil {
		return ErrNotFound
	}

	var remaining []models.DeviceToken
	for _, d := range emp.Devices {
		if !deadSet[d.Token] {
			remaining = append(remaining, d)
		}
	}
	emp.Devices = remaining
	emp.UpdatedAt = time.Now().UTC()
	return nil
}
