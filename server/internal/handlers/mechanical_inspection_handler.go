package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"dispatch-server/internal/auth"
	"github.com/go-chi/chi/v5"
	"google.golang.org/api/iterator"
)

const (
	vehicleInspectionCollection     = "vehicle_inspections"
	preventiveMaintenanceCollection = "preventive_maintenance_records"
)

// MechanicalInspectionHandler stores semi-annual inspections and preventive
// maintenance records through the Admin SDK. Client Firestore rules do not
// expose these collections.
type MechanicalInspectionHandler struct {
	client *firestore.Client

	mu          sync.Mutex
	inspections map[string]map[string]interface{}
	pmRecords   map[string]map[string]interface{}
}

func NewMechanicalInspectionHandler(client *firestore.Client) *MechanicalInspectionHandler {
	return &MechanicalInspectionHandler{
		client:      client,
		inspections: map[string]map[string]interface{}{},
		pmRecords:   map[string]map[string]interface{}{},
	}
}

func (h *MechanicalInspectionHandler) ListInspections(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, vehicleInspectionCollection, h.inspections)
}

func (h *MechanicalInspectionHandler) SaveInspection(w http.ResponseWriter, r *http.Request) {
	h.save(w, r, vehicleInspectionCollection, h.inspections, "inspectionDate")
}

func (h *MechanicalInspectionHandler) DeleteInspection(w http.ResponseWriter, r *http.Request) {
	h.remove(w, r, vehicleInspectionCollection, h.inspections)
}

func (h *MechanicalInspectionHandler) ListPMRecords(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, preventiveMaintenanceCollection, h.pmRecords)
}

func (h *MechanicalInspectionHandler) SavePMRecord(w http.ResponseWriter, r *http.Request) {
	h.save(w, r, preventiveMaintenanceCollection, h.pmRecords, "serviceDate")
}

func (h *MechanicalInspectionHandler) DeletePMRecord(w http.ResponseWriter, r *http.Request) {
	h.remove(w, r, preventiveMaintenanceCollection, h.pmRecords)
}

func (h *MechanicalInspectionHandler) list(w http.ResponseWriter, r *http.Request, collection string, memory map[string]map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if !h.allow(w, r, false) {
		return
	}
	records, err := h.readAll(r.Context(), collection, memory)
	if err != nil {
		http.Error(w, `{"error":"failed to list records"}`, http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(records)
}

func (h *MechanicalInspectionHandler) save(w http.ResponseWriter, r *http.Request, collection string, memory map[string]map[string]interface{}, dateField string) {
	w.Header().Set("Content-Type", "application/json")
	if !h.allow(w, r, true) {
		return
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}
	payload = stripNilValues(payload)

	unit := strings.TrimSpace(stringField(payload, "unitNumber"))
	if unit == "" {
		http.Error(w, `{"error":"unitNumber is required"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(stringField(payload, dateField)) == "" {
		http.Error(w, `{"error":"`+dateField+` is required"}`, http.StatusBadRequest)
		return
	}

	id := strings.TrimSpace(stringField(payload, "id"))
	if id == "" {
		id = collectionPrefix(collection) + "-" + unit + "-" + time.Now().UTC().Format("20060102150405")
	}
	if !validMechanicalDocID(id) {
		http.Error(w, `{"error":"invalid record id"}`, http.StatusBadRequest)
		return
	}

	payload["id"] = id
	payload["unitNumber"] = unit
	if strings.TrimSpace(stringField(payload, "vehicleUnit")) == "" {
		payload["vehicleUnit"] = unit
	}
	if _, ok := payload["attachments"]; !ok {
		payload["attachments"] = []interface{}{}
	}
	if strings.TrimSpace(stringField(payload, "updatedAt")) == "" {
		payload["updatedAt"] = time.Now().UTC().Format(time.RFC3339)
	}
	if strings.TrimSpace(stringField(payload, "createdAt")) == "" {
		payload["createdAt"] = payload["updatedAt"]
	}

	if err := h.write(r.Context(), collection, memory, id, payload); err != nil {
		http.Error(w, `{"error":"failed to save record"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(payload)
}

func (h *MechanicalInspectionHandler) remove(w http.ResponseWriter, r *http.Request, collection string, memory map[string]map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if !h.allow(w, r, true) {
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if !validMechanicalDocID(id) {
		http.Error(w, `{"error":"invalid record id"}`, http.StatusBadRequest)
		return
	}
	if err := h.delete(r.Context(), collection, memory, id); err != nil {
		http.Error(w, `{"error":"failed to delete record"}`, http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *MechanicalInspectionHandler) allow(w http.ResponseWriter, r *http.Request, write bool) bool {
	user := auth.GetUser(r.Context())
	if user == nil || !user.HasModulePermission("vehicle_inspections", write) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return false
	}
	return true
}

func (h *MechanicalInspectionHandler) readAll(ctx context.Context, collection string, memory map[string]map[string]interface{}) ([]map[string]interface{}, error) {
	if h.client == nil {
		h.mu.Lock()
		defer h.mu.Unlock()
		out := make([]map[string]interface{}, 0, len(memory))
		for _, record := range memory {
			out = append(out, cloneMechanicalRecord(record))
		}
		return out, nil
	}

	iter := h.client.Collection(collection).Documents(ctx)
	defer iter.Stop()
	out := make([]map[string]interface{}, 0)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		data := doc.Data()
		if data == nil {
			data = map[string]interface{}{}
		}
		data["id"] = doc.Ref.ID
		if _, ok := data["attachments"]; !ok {
			data["attachments"] = []interface{}{}
		}
		out = append(out, data)
	}
	return out, nil
}

func (h *MechanicalInspectionHandler) write(ctx context.Context, collection string, memory map[string]map[string]interface{}, id string, payload map[string]interface{}) error {
	if h.client == nil {
		h.mu.Lock()
		defer h.mu.Unlock()
		memory[id] = cloneMechanicalRecord(payload)
		return nil
	}
	_, err := h.client.Collection(collection).Doc(id).Set(ctx, payload)
	return err
}

func (h *MechanicalInspectionHandler) delete(ctx context.Context, collection string, memory map[string]map[string]interface{}, id string) error {
	if h.client == nil {
		h.mu.Lock()
		defer h.mu.Unlock()
		delete(memory, id)
		return nil
	}
	_, err := h.client.Collection(collection).Doc(id).Delete(ctx)
	return err
}

func collectionPrefix(collection string) string {
	if collection == preventiveMaintenanceCollection {
		return "PM"
	}
	return "INSP"
}

func validMechanicalDocID(id string) bool {
	if id == "" || len(id) > 180 {
		return false
	}
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			continue
		}
		return false
	}
	return true
}

func stringField(payload map[string]interface{}, key string) string {
	value, _ := payload[key].(string)
	return value
}

func stripNilValues(payload map[string]interface{}) map[string]interface{} {
	cleaned, _ := stripNil(payload).(map[string]interface{})
	if cleaned == nil {
		return map[string]interface{}{}
	}
	return cleaned
}

func stripNil(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		for key, child := range typed {
			if child == nil {
				continue
			}
			out[key] = stripNil(child)
		}
		return out
	case []interface{}:
		out := make([]interface{}, 0, len(typed))
		for _, child := range typed {
			if child == nil {
				continue
			}
			out = append(out, stripNil(child))
		}
		return out
	default:
		return value
	}
}

func cloneMechanicalRecord(record map[string]interface{}) map[string]interface{} {
	raw, err := json.Marshal(record)
	if err != nil {
		return map[string]interface{}{}
	}
	var cloned map[string]interface{}
	if err := json.Unmarshal(raw, &cloned); err != nil {
		return map[string]interface{}{}
	}
	return cloned
}
