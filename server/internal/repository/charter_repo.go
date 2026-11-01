package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

var (
	ErrCharterClientNotFound = errors.New("charter client not found")
	ErrCharterTripNotFound   = errors.New("charter trip not found")
)

// CharterRepository stores charter clients, trips, and a read model of route openings.
// Documents stay as maps so nested stops and assignments round-trip with the web client.
type CharterRepository interface {
	ListClients(ctx context.Context) ([]map[string]interface{}, error)
	GetClient(ctx context.Context, id string) (map[string]interface{}, error)
	CreateClient(ctx context.Context, doc map[string]interface{}) (map[string]interface{}, error)
	UpdateClient(ctx context.Context, id string, patch map[string]interface{}) (map[string]interface{}, error)
	DeleteClient(ctx context.Context, id string) error

	ListTrips(ctx context.Context, date string) ([]map[string]interface{}, error)
	GetTrip(ctx context.Context, id string) (map[string]interface{}, error)
	CreateTrip(ctx context.Context, doc map[string]interface{}) (map[string]interface{}, error)
	UpdateTrip(ctx context.Context, id string, patch map[string]interface{}) (map[string]interface{}, error)
	DeleteTrip(ctx context.Context, id string) error

	ListRouteOpenings(ctx context.Context) ([]map[string]interface{}, error)
}

type FirestoreCharterRepository struct {
	client *firestore.Client
}

func NewFirestoreCharterRepository(client *firestore.Client) *FirestoreCharterRepository {
	return &FirestoreCharterRepository{client: client}
}

func (r *FirestoreCharterRepository) ListClients(ctx context.Context) ([]map[string]interface{}, error) {
	docs, err := listCollection(ctx, r.client, "charter_clients")
	if err != nil {
		return nil, err
	}
	sort.Slice(docs, func(i, j int) bool {
		return strings.ToLower(docString(docs[i], "name")) < strings.ToLower(docString(docs[j], "name"))
	})
	return docs, nil
}

func (r *FirestoreCharterRepository) GetClient(ctx context.Context, id string) (map[string]interface{}, error) {
	return getCollectionDoc(ctx, r.client, "charter_clients", id, ErrCharterClientNotFound)
}

func (r *FirestoreCharterRepository) CreateClient(ctx context.Context, doc map[string]interface{}) (map[string]interface{}, error) {
	return createCollectionDoc(ctx, r.client, "charter_clients", "client", doc)
}

func (r *FirestoreCharterRepository) UpdateClient(ctx context.Context, id string, patch map[string]interface{}) (map[string]interface{}, error) {
	return updateCollectionDoc(ctx, r.client, "charter_clients", id, patch, ErrCharterClientNotFound)
}

func (r *FirestoreCharterRepository) DeleteClient(ctx context.Context, id string) error {
	return deleteCollectionDoc(ctx, r.client, "charter_clients", id, ErrCharterClientNotFound)
}

func (r *FirestoreCharterRepository) ListTrips(ctx context.Context, date string) ([]map[string]interface{}, error) {
	docs, err := listCollection(ctx, r.client, "charter_trips")
	if err != nil {
		return nil, err
	}
	return filterAndSortTrips(docs, date), nil
}

func (r *FirestoreCharterRepository) GetTrip(ctx context.Context, id string) (map[string]interface{}, error) {
	return getCollectionDoc(ctx, r.client, "charter_trips", id, ErrCharterTripNotFound)
}

func (r *FirestoreCharterRepository) CreateTrip(ctx context.Context, doc map[string]interface{}) (map[string]interface{}, error) {
	return createCollectionDoc(ctx, r.client, "charter_trips", "trip", doc)
}

func (r *FirestoreCharterRepository) UpdateTrip(ctx context.Context, id string, patch map[string]interface{}) (map[string]interface{}, error) {
	return updateCollectionDoc(ctx, r.client, "charter_trips", id, patch, ErrCharterTripNotFound)
}

func (r *FirestoreCharterRepository) DeleteTrip(ctx context.Context, id string) error {
	return deleteCollectionDoc(ctx, r.client, "charter_trips", id, ErrCharterTripNotFound)
}

func (r *FirestoreCharterRepository) ListRouteOpenings(ctx context.Context) ([]map[string]interface{}, error) {
	docs, err := listCollection(ctx, r.client, "route_openings")
	if err != nil {
		return nil, err
	}
	sort.Slice(docs, func(i, j int) bool {
		return docString(docs[i], "createdAt") > docString(docs[j], "createdAt")
	})
	return docs, nil
}

func listCollection(ctx context.Context, client *firestore.Client, name string) ([]map[string]interface{}, error) {
	if client == nil {
		return nil, errors.New("firestore client is nil")
	}
	iter := client.Collection(name).Documents(ctx)
	defer iter.Stop()
	out := make([]map[string]interface{}, 0)
	for {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		out = append(out, docFromSnapshot(snap))
	}
	return out, nil
}

func getCollectionDoc(ctx context.Context, client *firestore.Client, coll, id string, notFound error) (map[string]interface{}, error) {
	if strings.TrimSpace(id) == "" {
		return nil, notFound
	}
	snap, err := client.Collection(coll).Doc(id).Get(ctx)
	if err != nil {
		return nil, notFound
	}
	return docFromSnapshot(snap), nil
}

func createCollectionDoc(ctx context.Context, client *firestore.Client, coll, prefix string, doc map[string]interface{}) (map[string]interface{}, error) {
	prepared := prepareNewDoc(doc, prefix)
	id := docString(prepared, "id")
	if _, err := client.Collection(coll).Doc(id).Set(ctx, prepared); err != nil {
		return nil, err
	}
	return cloneDoc(prepared), nil
}

func updateCollectionDoc(ctx context.Context, client *firestore.Client, coll, id string, patch map[string]interface{}, notFound error) (map[string]interface{}, error) {
	ref := client.Collection(coll).Doc(id)
	snap, err := ref.Get(ctx)
	if err != nil {
		return nil, notFound
	}
	merged := mergeDoc(docFromSnapshot(snap), patch)
	if _, err := ref.Set(ctx, merged); err != nil {
		return nil, err
	}
	return cloneDoc(merged), nil
}

func deleteCollectionDoc(ctx context.Context, client *firestore.Client, coll, id string, notFound error) error {
	ref := client.Collection(coll).Doc(id)
	if _, err := ref.Get(ctx); err != nil {
		return notFound
	}
	_, err := ref.Delete(ctx)
	return err
}

type MemoryCharterRepository struct {
	mu       sync.Mutex
	clients  map[string]map[string]interface{}
	trips    map[string]map[string]interface{}
	openings map[string]map[string]interface{}
}

func NewMemoryCharterRepository() *MemoryCharterRepository {
	return &MemoryCharterRepository{
		clients:  map[string]map[string]interface{}{},
		trips:    map[string]map[string]interface{}{},
		openings: map[string]map[string]interface{}{},
	}
}

func (r *MemoryCharterRepository) ListClients(ctx context.Context) ([]map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]map[string]interface{}, 0, len(r.clients))
	for _, doc := range r.clients {
		out = append(out, cloneDoc(doc))
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(docString(out[i], "name")) < strings.ToLower(docString(out[j], "name"))
	})
	return out, nil
}

func (r *MemoryCharterRepository) GetClient(ctx context.Context, id string) (map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	doc, ok := r.clients[id]
	if !ok {
		return nil, ErrCharterClientNotFound
	}
	return cloneDoc(doc), nil
}

func (r *MemoryCharterRepository) CreateClient(ctx context.Context, doc map[string]interface{}) (map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	prepared := prepareNewDoc(doc, "client")
	id := docString(prepared, "id")
	r.clients[id] = cloneDoc(prepared)
	return cloneDoc(prepared), nil
}

func (r *MemoryCharterRepository) UpdateClient(ctx context.Context, id string, patch map[string]interface{}) (map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	old, ok := r.clients[id]
	if !ok {
		return nil, ErrCharterClientNotFound
	}
	merged := mergeDoc(old, patch)
	r.clients[id] = cloneDoc(merged)
	return cloneDoc(merged), nil
}

func (r *MemoryCharterRepository) DeleteClient(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.clients[id]; !ok {
		return ErrCharterClientNotFound
	}
	delete(r.clients, id)
	return nil
}

func (r *MemoryCharterRepository) ListTrips(ctx context.Context, date string) ([]map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]map[string]interface{}, 0, len(r.trips))
	for _, doc := range r.trips {
		out = append(out, cloneDoc(doc))
	}
	return filterAndSortTrips(out, date), nil
}

func (r *MemoryCharterRepository) GetTrip(ctx context.Context, id string) (map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	doc, ok := r.trips[id]
	if !ok {
		return nil, ErrCharterTripNotFound
	}
	return cloneDoc(doc), nil
}

func (r *MemoryCharterRepository) CreateTrip(ctx context.Context, doc map[string]interface{}) (map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	prepared := prepareNewDoc(doc, "trip")
	id := docString(prepared, "id")
	r.trips[id] = cloneDoc(prepared)
	return cloneDoc(prepared), nil
}

func (r *MemoryCharterRepository) UpdateTrip(ctx context.Context, id string, patch map[string]interface{}) (map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	old, ok := r.trips[id]
	if !ok {
		return nil, ErrCharterTripNotFound
	}
	merged := mergeDoc(old, patch)
	r.trips[id] = cloneDoc(merged)
	return cloneDoc(merged), nil
}

func (r *MemoryCharterRepository) DeleteTrip(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.trips[id]; !ok {
		return ErrCharterTripNotFound
	}
	delete(r.trips, id)
	return nil
}

func (r *MemoryCharterRepository) ListRouteOpenings(ctx context.Context) ([]map[string]interface{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]map[string]interface{}, 0, len(r.openings))
	for _, doc := range r.openings {
		out = append(out, cloneDoc(doc))
	}
	sort.Slice(out, func(i, j int) bool {
		return docString(out[i], "createdAt") > docString(out[j], "createdAt")
	})
	return out, nil
}

func prepareNewDoc(doc map[string]interface{}, prefix string) map[string]interface{} {
	prepared := cloneDoc(doc)
	if prepared == nil {
		prepared = map[string]interface{}{}
	}
	id := strings.TrimSpace(docString(prepared, "id"))
	if id == "" {
		id = fmt.Sprintf("%s-%d", prefix, time.Now().UnixMilli())
	}
	now := time.Now().UTC().Format(time.RFC3339)
	prepared["id"] = id
	if strings.TrimSpace(docString(prepared, "createdAt")) == "" {
		prepared["createdAt"] = now
	}
	prepared["updatedAt"] = now
	return prepared
}

func mergeDoc(old map[string]interface{}, patch map[string]interface{}) map[string]interface{} {
	merged := cloneDoc(old)
	if merged == nil {
		merged = map[string]interface{}{}
	}
	for key, value := range patch {
		if key == "id" || key == "createdAt" {
			continue
		}
		merged[key] = value
	}
	if id := strings.TrimSpace(docString(old, "id")); id != "" {
		merged["id"] = id
	}
	if created := docString(old, "createdAt"); created != "" {
		merged["createdAt"] = created
	}
	merged["updatedAt"] = time.Now().UTC().Format(time.RFC3339)
	return merged
}

func filterAndSortTrips(docs []map[string]interface{}, date string) []map[string]interface{} {
	date = strings.TrimSpace(date)
	out := make([]map[string]interface{}, 0, len(docs))
	for _, doc := range docs {
		if date != "" && docString(doc, "dispatchDate") != date {
			continue
		}
		out = append(out, doc)
	}
	sort.Slice(out, func(i, j int) bool {
		return docString(out[i], "departsAt") > docString(out[j], "departsAt")
	})
	return out
}

func docFromSnapshot(snap *firestore.DocumentSnapshot) map[string]interface{} {
	data := snap.Data()
	if data == nil {
		data = map[string]interface{}{}
	}
	data["id"] = snap.Ref.ID
	return data
}

func docString(doc map[string]interface{}, key string) string {
	if doc == nil {
		return ""
	}
	value, ok := doc[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return fmt.Sprint(typed)
	}
}

func cloneDoc(in map[string]interface{}) map[string]interface{} {
	if in == nil {
		return map[string]interface{}{}
	}
	raw, err := json.Marshal(in)
	if err != nil {
		out := make(map[string]interface{}, len(in))
		for key, value := range in {
			out[key] = value
		}
		return out
	}
	var out map[string]interface{}
	if err := json.Unmarshal(raw, &out); err != nil || out == nil {
		return map[string]interface{}{}
	}
	return out
}
