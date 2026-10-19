package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
)

var (
	ErrSchoolNotFound      = errors.New("school not found")
	ErrSchoolBoardNotFound = errors.New("school board not found")
)

type SchoolRepository interface {
	List(ctx context.Context) ([]*models.School, error)
	GetByID(ctx context.Context, id string) (*models.School, error)
	GetBySchoolID(ctx context.Context, sid int) (*models.School, error)
	Create(ctx context.Context, s *models.School) (*models.School, error)
	Update(ctx context.Context, s *models.School) (*models.School, error)
	Delete(ctx context.Context, id string) error
	Count(ctx context.Context) (int, error)
}

type SchoolBoardRepository interface {
	ListBoards(ctx context.Context) ([]*models.SchoolBoard, error)
	GetBoardByID(ctx context.Context, id string) (*models.SchoolBoard, error)
	CreateBoard(ctx context.Context, b *models.SchoolBoard) (*models.SchoolBoard, error)
	UpdateBoard(ctx context.Context, b *models.SchoolBoard) (*models.SchoolBoard, error)
	DeleteBoard(ctx context.Context, id string) error
}

type FirestoreSchoolRepository struct {
	client *firestore.Client
	coll   string
}

func NewFirestoreSchoolRepository(client *firestore.Client) *FirestoreSchoolRepository {
	return &FirestoreSchoolRepository{
		client: client,
		coll:   "schools",
	}
}

func (r *FirestoreSchoolRepository) List(ctx context.Context) ([]*models.School, error) {
	iter := r.client.Collection(r.coll).OrderBy("schoolName", firestore.Asc).Documents(ctx)
	defer iter.Stop()

	var result []*models.School
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		var s models.School
		if err := doc.DataTo(&s); err != nil {
			continue
		}
		s.ID = doc.Ref.ID
		result = append(result, &s)
	}
	return result, nil
}

func (r *FirestoreSchoolRepository) GetByID(ctx context.Context, id string) (*models.School, error) {
	doc, err := r.client.Collection(r.coll).Doc(id).Get(ctx)
	if err != nil {
		return nil, ErrSchoolNotFound
	}
	var s models.School
	if err := doc.DataTo(&s); err != nil {
		return nil, err
	}
	s.ID = doc.Ref.ID
	return &s, nil
}

func (r *FirestoreSchoolRepository) GetBySchoolID(ctx context.Context, sid int) (*models.School, error) {
	iter := r.client.Collection(r.coll).Where("schoolId", "==", sid).Limit(1).Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, ErrSchoolNotFound
	}
	if err != nil {
		return nil, err
	}

	var s models.School
	if err := doc.DataTo(&s); err != nil {
		return nil, err
	}
	s.ID = doc.Ref.ID
	return &s, nil
}

func (r *FirestoreSchoolRepository) Create(ctx context.Context, s *models.School) (*models.School, error) {
	now := time.Now()
	s.CreatedAt = now
	s.UpdatedAt = now

	if s.SchoolID == 0 {
		count, _ := r.Count(ctx)
		s.SchoolID = count + 1
	}

	if s.ID == "" {
		s.ID = fmt.Sprintf("SCH-%03d", s.SchoolID)
	}

	_, err := r.client.Collection(r.coll).Doc(s.ID).Set(ctx, s)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *FirestoreSchoolRepository) Update(ctx context.Context, s *models.School) (*models.School, error) {
	s.UpdatedAt = time.Now()
	_, err := r.client.Collection(r.coll).Doc(s.ID).Set(ctx, s)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *FirestoreSchoolRepository) Delete(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.coll).Doc(id).Delete(ctx)
	return err
}

func (r *FirestoreSchoolRepository) Count(ctx context.Context) (int, error) {
	snaps, err := r.client.Collection(r.coll).Documents(ctx).GetAll()
	if err != nil {
		return 0, err
	}
	return len(snaps), nil
}

// FirestoreSchoolBoardRepository manages the school_boards collection
type FirestoreSchoolBoardRepository struct {
	client *firestore.Client
	coll   string
}

func NewFirestoreSchoolBoardRepository(client *firestore.Client) *FirestoreSchoolBoardRepository {
	return &FirestoreSchoolBoardRepository{
		client: client,
		coll:   "school_boards",
	}
}

func (r *FirestoreSchoolBoardRepository) ListBoards(ctx context.Context) ([]*models.SchoolBoard, error) {
	iter := r.client.Collection(r.coll).OrderBy("schoolBoardName", firestore.Asc).Documents(ctx)
	defer iter.Stop()

	var result []*models.SchoolBoard
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		var b models.SchoolBoard
		if err := doc.DataTo(&b); err != nil {
			continue
		}
		b.ID = doc.Ref.ID
		result = append(result, &b)
	}
	return result, nil
}

func (r *FirestoreSchoolBoardRepository) GetBoardByID(ctx context.Context, id string) (*models.SchoolBoard, error) {
	doc, err := r.client.Collection(r.coll).Doc(id).Get(ctx)
	if err != nil {
		return nil, ErrSchoolBoardNotFound
	}
	var b models.SchoolBoard
	if err := doc.DataTo(&b); err != nil {
		return nil, err
	}
	b.ID = doc.Ref.ID
	return &b, nil
}

func (r *FirestoreSchoolBoardRepository) CreateBoard(ctx context.Context, b *models.SchoolBoard) (*models.SchoolBoard, error) {
	if b.SchoolBoardID == 0 {
		snaps, _ := r.client.Collection(r.coll).Documents(ctx).GetAll()
		b.SchoolBoardID = len(snaps) + 1
	}
	if b.ID == "" {
		b.ID = fmt.Sprintf("BOARD-%02d", b.SchoolBoardID)
	}
	_, err := r.client.Collection(r.coll).Doc(b.ID).Set(ctx, b)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (r *FirestoreSchoolBoardRepository) UpdateBoard(ctx context.Context, b *models.SchoolBoard) (*models.SchoolBoard, error) {
	if b.ID == "" {
		b.ID = fmt.Sprintf("BOARD-%02d", b.SchoolBoardID)
	}
	_, err := r.client.Collection(r.coll).Doc(b.ID).Set(ctx, b)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (r *FirestoreSchoolBoardRepository) DeleteBoard(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.coll).Doc(id).Delete(ctx)
	return err
}

// Memory fallback
type MemorySchoolRepository struct {
	mu      sync.RWMutex
	schools map[string]*models.School
}

func NewMemorySchoolRepository() *MemorySchoolRepository {
	return &MemorySchoolRepository{
		schools: make(map[string]*models.School),
	}
}

func (m *MemorySchoolRepository) List(ctx context.Context) ([]*models.School, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.School, 0, len(m.schools))
	for _, s := range m.schools {
		res = append(res, s)
	}
	return res, nil
}

func (m *MemorySchoolRepository) GetByID(ctx context.Context, id string) (*models.School, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if s, ok := m.schools[id]; ok {
		return s, nil
	}
	return nil, ErrSchoolNotFound
}

func (m *MemorySchoolRepository) GetBySchoolID(ctx context.Context, sid int) (*models.School, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, s := range m.schools {
		if s.SchoolID == sid {
			return s, nil
		}
	}
	return nil, ErrSchoolNotFound
}

func (m *MemorySchoolRepository) Create(ctx context.Context, s *models.School) (*models.School, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s.SchoolID == 0 {
		s.SchoolID = len(m.schools) + 1
	}
	if s.ID == "" {
		s.ID = "SCH-" + strconv.Itoa(s.SchoolID)
	}
	s.CreatedAt = time.Now()
	s.UpdatedAt = time.Now()
	m.schools[s.ID] = s
	return s, nil
}

func (m *MemorySchoolRepository) Update(ctx context.Context, s *models.School) (*models.School, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s.UpdatedAt = time.Now()
	m.schools[s.ID] = s
	return s, nil
}

func (m *MemorySchoolRepository) Delete(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.schools, id)
	return nil
}

func (m *MemorySchoolRepository) Count(ctx context.Context) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.schools), nil
}

// MemorySchoolBoardRepository
type MemorySchoolBoardRepository struct {
	mu     sync.RWMutex
	boards map[string]*models.SchoolBoard
}

func NewMemorySchoolBoardRepository() *MemorySchoolBoardRepository {
	repo := &MemorySchoolBoardRepository{
		boards: make(map[string]*models.SchoolBoard),
	}
	// Seed standard boards
	repo.boards["BOARD-05"] = &models.SchoolBoard{ID: "BOARD-05", SchoolBoardID: 5, SchoolBoardCode: "OCDSB", SchoolBoardName: "Ottawa-Carleton District School Board"}
	repo.boards["BOARD-06"] = &models.SchoolBoard{ID: "BOARD-06", SchoolBoardID: 6, SchoolBoardCode: "OCSB", SchoolBoardName: "Ottawa Catholic School Board"}
	repo.boards["BOARD-07"] = &models.SchoolBoard{ID: "BOARD-07", SchoolBoardID: 7, SchoolBoardCode: "CEPEO", SchoolBoardName: "Conseil des ecoles publiques de l Est de l Ontario"}
	return repo
}

func (m *MemorySchoolBoardRepository) ListBoards(ctx context.Context) ([]*models.SchoolBoard, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.SchoolBoard, 0, len(m.boards))
	for _, b := range m.boards {
		res = append(res, b)
	}
	return res, nil
}

func (m *MemorySchoolBoardRepository) GetBoardByID(ctx context.Context, id string) (*models.SchoolBoard, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if b, ok := m.boards[id]; ok {
		return b, nil
	}
	return nil, ErrSchoolBoardNotFound
}

func (m *MemorySchoolBoardRepository) CreateBoard(ctx context.Context, b *models.SchoolBoard) (*models.SchoolBoard, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if b.SchoolBoardID == 0 {
		b.SchoolBoardID = len(m.boards) + 1
	}
	if b.ID == "" {
		b.ID = fmt.Sprintf("BOARD-%02d", b.SchoolBoardID)
	}
	m.boards[b.ID] = b
	return b, nil
}

func (m *MemorySchoolBoardRepository) UpdateBoard(ctx context.Context, b *models.SchoolBoard) (*models.SchoolBoard, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.boards[b.ID] = b
	return b, nil
}

func (m *MemorySchoolBoardRepository) DeleteBoard(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.boards, id)
	return nil
}
