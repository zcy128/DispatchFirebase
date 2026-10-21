package services

import (
	"context"
	"sync"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	busplannerSecretCollection = "busplanner_secrets"
	busplannerSecretDocument   = "settings"
	busplannerStageBatch       = 400
)

const (
	stageRoutes       = "busplanner_staging_routes"
	stageRuns         = "busplanner_staging_runs"
	stageSchools      = "busplanner_staging_schools"
	stageStops        = "busplanner_staging_stops"
	stageStudentStops = "busplanner_staging_student_stops"
	stageStudents     = "busplanner_staging_students"
)

type busplannerStore interface {
	Load(ctx context.Context) (busplannerSecret, error)
	Save(ctx context.Context, secret busplannerSecret) error
	ReplaceStage(ctx context.Context, collection string, docs map[string]map[string]any) error
	ListStage(ctx context.Context, collection string) ([]map[string]any, error)
	StageDoc(ctx context.Context, collection, id string) (map[string]any, bool)
}

// BusPlannerStore keeps the BusPlanner password in a server-only document and
// writes pulled records into staging collections. Live route, school, and
// student collections are never updated here.
type BusPlannerStore struct {
	client *firestore.Client
	mu     sync.Mutex
	mem    busplannerSecret
	hasMem bool
	stage  map[string]map[string]map[string]any
}

func NewBusPlannerStore(client *firestore.Client) *BusPlannerStore {
	return &BusPlannerStore{
		client: client,
		stage:  map[string]map[string]map[string]any{},
	}
}

func (s *BusPlannerStore) Load(ctx context.Context) (busplannerSecret, error) {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		if !s.hasMem {
			return busplannerSecret{}, nil
		}
		return s.mem, nil
	}
	doc, err := s.client.Collection(busplannerSecretCollection).Doc(busplannerSecretDocument).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return busplannerSecret{}, nil
		}
		return busplannerSecret{}, err
	}
	var secret busplannerSecret
	if err := doc.DataTo(&secret); err != nil {
		return busplannerSecret{}, err
	}
	return secret, nil
}

func (s *BusPlannerStore) Save(ctx context.Context, secret busplannerSecret) error {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.mem = secret
		s.hasMem = true
		return nil
	}
	_, err := s.client.Collection(busplannerSecretCollection).Doc(busplannerSecretDocument).Set(ctx, secret)
	return err
}

func (s *BusPlannerStore) ReplaceStage(ctx context.Context, collection string, docs map[string]map[string]any) error {
	if docs == nil {
		docs = map[string]map[string]any{}
	}
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		copied := make(map[string]map[string]any, len(docs))
		for id, doc := range docs {
			row := make(map[string]any, len(doc))
			for k, v := range doc {
				row[k] = v
			}
			copied[id] = row
		}
		s.stage[collection] = copied
		return nil
	}

	col := s.client.Collection(collection)
	existing := map[string]struct{}{}
	iter := col.Documents(ctx)
	defer iter.Stop()
	for {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return err
		}
		existing[snap.Ref.ID] = struct{}{}
	}

	batch := s.client.Batch()
	ops := 0
	flush := func() error {
		if ops == 0 {
			return nil
		}
		_, err := batch.Commit(ctx)
		batch = s.client.Batch()
		ops = 0
		return err
	}
	for id, doc := range docs {
		batch.Set(col.Doc(id), doc)
		ops++
		delete(existing, id)
		if ops >= busplannerStageBatch {
			if err := flush(); err != nil {
				return err
			}
		}
	}
	for id := range existing {
		batch.Delete(col.Doc(id))
		ops++
		if ops >= busplannerStageBatch {
			if err := flush(); err != nil {
				return err
			}
		}
	}
	return flush()
}

func (s *BusPlannerStore) ListStage(ctx context.Context, collection string) ([]map[string]any, error) {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		rows := s.stage[collection]
		out := make([]map[string]any, 0, len(rows))
		for _, row := range rows {
			copied := make(map[string]any, len(row))
			for k, v := range row {
				copied[k] = v
			}
			out = append(out, copied)
		}
		return out, nil
	}
	iter := s.client.Collection(collection).Documents(ctx)
	defer iter.Stop()
	var out []map[string]any
	for {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		out = append(out, snap.Data())
	}
	return out, nil
}

func (s *BusPlannerStore) StageDoc(ctx context.Context, collection, id string) (map[string]any, bool) {
	if s.client == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		row, ok := s.stage[collection][id]
		if !ok {
			return nil, false
		}
		copied := make(map[string]any, len(row))
		for k, v := range row {
			copied[k] = v
		}
		return copied, true
	}
	snap, err := s.client.Collection(collection).Doc(id).Get(ctx)
	if err != nil {
		return nil, false
	}
	return snap.Data(), true
}
