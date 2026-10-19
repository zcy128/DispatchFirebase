package repository

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
)

var (
	ErrStudentNotFound = errors.New("student not found")
	ErrStudentConflict = errors.New("student number already exists")
)

type StudentFilter struct {
	Search       string
	SchoolID     int
	Grade        string
	Route        string
	MetatBusOnly bool
	ActiveOnly   *bool
}

type StudentRepository interface {
	List(ctx context.Context, filter StudentFilter) ([]*models.Student, error)
	GetByID(ctx context.Context, id string) (*models.Student, error)
	GetByStudentNo(ctx context.Context, sno string) (*models.Student, error)
	Create(ctx context.Context, s *models.Student) error
	Update(ctx context.Context, s *models.Student) error
	Delete(ctx context.Context, id string) error
	Count(ctx context.Context) (int, error)
	FindStudentsByContact(ctx context.Context, contact string) ([]*models.Student, error)
}

type FirestoreStudentRepository struct {
	client *firestore.Client
	coll   string
}

func NewFirestoreStudentRepository(client *firestore.Client) *FirestoreStudentRepository {
	return &FirestoreStudentRepository{
		client: client,
		coll:   "students",
	}
}

func (r *FirestoreStudentRepository) List(ctx context.Context, filter StudentFilter) ([]*models.Student, error) {
	query := r.client.Collection(r.coll).Query

	if filter.ActiveOnly != nil && *filter.ActiveOnly {
		query = query.Where("active", "==", true)
	}
	if filter.SchoolID > 0 {
		query = query.Where("schoolId", "==", filter.SchoolID)
	}
	if filter.Grade != "" {
		query = query.Where("grade", "==", filter.Grade)
	}
	if filter.MetatBusOnly {
		query = query.Where("metatBus", "==", true)
	}

	iter := query.Documents(ctx)
	defer iter.Stop()

	var result []*models.Student
	searchLower := strings.ToLower(strings.TrimSpace(filter.Search))
	routeFilter := strings.ToLower(strings.TrimSpace(filter.Route))

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		var s models.Student
		if err := doc.DataTo(&s); err != nil {
			continue
		}
		s.ID = doc.Ref.ID
		s.ComputeComputedFields()

		// Route filter in memory
		if routeFilter != "" && !strings.Contains(strings.ToLower(s.Routes), routeFilter) {
			continue
		}

		// Search filter in memory
		if searchLower != "" {
			matches := strings.Contains(strings.ToLower(s.FullName), searchLower) ||
				strings.Contains(strings.ToLower(s.StudentNo), searchLower) ||
				strings.Contains(strings.ToLower(s.SchoolName), searchLower) ||
				strings.Contains(strings.ToLower(s.StudentPhone), searchLower) ||
				strings.Contains(strings.ToLower(s.StudentAddress), searchLower)
			if !matches {
				continue
			}
		}

		result = append(result, &s)
	}
	return result, nil
}

func (r *FirestoreStudentRepository) GetByID(ctx context.Context, id string) (*models.Student, error) {
	doc, err := r.client.Collection(r.coll).Doc(id).Get(ctx)
	if err != nil {
		return nil, ErrStudentNotFound
	}
	var s models.Student
	if err := doc.DataTo(&s); err != nil {
		return nil, err
	}
	s.ID = doc.Ref.ID
	s.ComputeComputedFields()
	return &s, nil
}

func (r *FirestoreStudentRepository) GetByStudentNo(ctx context.Context, sno string) (*models.Student, error) {
	iter := r.client.Collection(r.coll).Where("studentNo", "==", sno).Limit(1).Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, ErrStudentNotFound
	}
	if err != nil {
		return nil, err
	}

	var s models.Student
	if err := doc.DataTo(&s); err != nil {
		return nil, err
	}
	s.ID = doc.Ref.ID
	s.ComputeComputedFields()
	return &s, nil
}

func (r *FirestoreStudentRepository) Create(ctx context.Context, s *models.Student) error {
	existing, _ := r.GetByStudentNo(ctx, s.StudentNo)
	if existing != nil {
		return ErrStudentConflict
	}

	s.CreatedAt = time.Now()
	s.UpdatedAt = time.Now()
	s.ComputeComputedFields()

	docRef := r.client.Collection(r.coll).Doc(s.ID)
	if s.ID == "" {
		docRef = r.client.Collection(r.coll).NewDoc()
		s.ID = docRef.ID
	}

	_, err := docRef.Set(ctx, s)
	return err
}

func (r *FirestoreStudentRepository) Update(ctx context.Context, s *models.Student) error {
	s.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	existing, err := r.GetByID(ctx, s.ID)
	if err == nil && existing != nil {
		if s.StudentNo == "" {
			s.StudentNo = existing.StudentNo
		}
		if s.FirstName == "" {
			s.FirstName = existing.FirstName
		}
		if s.LastName == "" {
			s.LastName = existing.LastName
		}
		if s.SchoolName == "" {
			s.SchoolName = existing.SchoolName
		}
		if s.SchoolID == 0 {
			s.SchoolID = existing.SchoolID
		}
		if s.Grade == "" {
			s.Grade = existing.Grade
		}
		if s.Routes == "" {
			s.Routes = existing.Routes
		}
		if s.StudentPhone == "" {
			s.StudentPhone = existing.StudentPhone
		}
		if s.StudentAddress == "" {
			s.StudentAddress = existing.StudentAddress
		}
		if len(s.Stops) == 0 && len(existing.Stops) > 0 {
			s.Stops = existing.Stops
		}
		if len(s.Contacts) == 0 && len(existing.Contacts) > 0 {
			s.Contacts = existing.Contacts
		}
		if s.CreatedAt == nil {
			s.CreatedAt = existing.CreatedAt
		}
	}

	s.ComputeComputedFields()

	_, err = r.client.Collection(r.coll).Doc(s.ID).Set(ctx, s)
	return err
}

func (r *FirestoreStudentRepository) Delete(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.coll).Doc(id).Delete(ctx)
	return err
}

func (r *FirestoreStudentRepository) Count(ctx context.Context) (int, error) {
	snaps, err := r.client.Collection(r.coll).Documents(ctx).GetAll()
	if err != nil {
		return 0, err
	}
	return len(snaps), nil
}

func (r *FirestoreStudentRepository) FindStudentsByContact(ctx context.Context, contact string) ([]*models.Student, error) {
	all, err := r.List(ctx, StudentFilter{})
	if err != nil {
		return nil, err
	}
	var matched []*models.Student
	for _, s := range all {
		if matchesContact(s, contact) {
			matched = append(matched, s)
		}
	}
	return matched, nil
}

// Memory fallback
type MemoryStudentRepository struct {
	mu       sync.RWMutex
	students map[string]*models.Student
}

func NewMemoryStudentRepository() *MemoryStudentRepository {
	return &MemoryStudentRepository{
		students: make(map[string]*models.Student),
	}
}

func (m *MemoryStudentRepository) List(ctx context.Context, filter StudentFilter) ([]*models.Student, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var res []*models.Student
	for _, s := range m.students {
		res = append(res, s)
	}
	return res, nil
}

func (m *MemoryStudentRepository) GetByID(ctx context.Context, id string) (*models.Student, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if s, ok := m.students[id]; ok {
		return s, nil
	}
	return nil, ErrStudentNotFound
}

func (m *MemoryStudentRepository) GetByStudentNo(ctx context.Context, sno string) (*models.Student, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, s := range m.students {
		if s.StudentNo == sno {
			return s, nil
		}
	}
	return nil, ErrStudentNotFound
}

func (m *MemoryStudentRepository) Create(ctx context.Context, s *models.Student) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.students[s.ID] = s
	return nil
}

func (m *MemoryStudentRepository) Update(ctx context.Context, s *models.Student) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.students[s.ID] = s
	return nil
}

func (m *MemoryStudentRepository) Delete(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.students, id)
	return nil
}

func (m *MemoryStudentRepository) Count(ctx context.Context) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.students), nil
}

func (m *MemoryStudentRepository) FindStudentsByContact(ctx context.Context, contact string) ([]*models.Student, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var matched []*models.Student
	for _, s := range m.students {
		if matchesContact(s, contact) {
			matched = append(matched, s)
		}
	}
	return matched, nil
}

func matchesContact(s *models.Student, contact string) bool {
	cleanContact := strings.TrimSpace(contact)
	if cleanContact == "" || s == nil {
		return false
	}

	isEmail := strings.Contains(cleanContact, "@")
	if isEmail {
		targetEmail := strings.ToLower(cleanContact)
		for _, c := range s.Contacts {
			if strings.ToLower(strings.TrimSpace(c.Email)) == targetEmail {
				return true
			}
		}
		return false
	}

	// Phone comparison: normalize to digits only
	targetDigits := extractDigits(cleanContact)
	if len(targetDigits) < 7 {
		return false
	}
	// Take last 10 digits for NA numbers (ignoring country code +1)
	if len(targetDigits) > 10 {
		targetDigits = targetDigits[len(targetDigits)-10:]
	}

	// Check student phone
	if len(s.StudentPhone) > 0 {
		sDigits := extractDigits(s.StudentPhone)
		if len(sDigits) > 10 {
			sDigits = sDigits[len(sDigits)-10:]
		}
		if sDigits == targetDigits {
			return true
		}
	}

	// Check emergency phone
	if len(s.StudentEmergencyPhone) > 0 {
		eDigits := extractDigits(s.StudentEmergencyPhone)
		if len(eDigits) > 10 {
			eDigits = eDigits[len(eDigits)-10:]
		}
		if eDigits == targetDigits {
			return true
		}
	}

	// Check student contacts
	for _, c := range s.Contacts {
		for _, p := range []string{c.MobilePhone, c.HomePhone, c.WorkPhone} {
			if len(p) > 0 {
				pDigits := extractDigits(p)
				if len(pDigits) > 10 {
					pDigits = pDigits[len(pDigits)-10:]
				}
				if pDigits == targetDigits {
					return true
				}
			}
		}
	}

	return false
}

func extractDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
