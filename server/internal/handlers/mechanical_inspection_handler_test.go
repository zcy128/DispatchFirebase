package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"dispatch-server/internal/auth"
	"github.com/go-chi/chi/v5"
)

func TestMechanicalInspectionMemoryCRUD(t *testing.T) {
	handler := NewMechanicalInspectionHandler(nil)
	user := &auth.AuthUser{Role: "admin", EmployeeID: "EMP-ADMIN-001"}

	saveBody := []byte(`{"id":"INSP-QA-209906","unitNumber":"QA9901","inspectionDate":"2099-06-01","inspectionStatus":"completed","stickerMonth":"2099-12"}`)
	saveReq := requestWithUser(http.MethodPost, "/api/fleet/mechanical-inspections", saveBody, user)
	saveRes := httptest.NewRecorder()
	handler.SaveInspection(saveRes, saveReq)
	if saveRes.Code != http.StatusCreated {
		t.Fatalf("save status %d body %s", saveRes.Code, saveRes.Body.String())
	}

	listReq := requestWithUser(http.MethodGet, "/api/fleet/mechanical-inspections", nil, user)
	listRes := httptest.NewRecorder()
	handler.ListInspections(listRes, listReq)
	if listRes.Code != http.StatusOK {
		t.Fatalf("list status %d", listRes.Code)
	}
	var listed []map[string]interface{}
	if err := json.Unmarshal(listRes.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 || listed[0]["vehicleUnit"] != "QA9901" {
		t.Fatalf("listed %#v", listed)
	}

	emptyReq := requestWithUser(http.MethodPost, "/api/fleet/mechanical-inspections", []byte(`{"unitNumber":""}`), user)
	emptyRes := httptest.NewRecorder()
	handler.SaveInspection(emptyRes, emptyReq)
	if emptyRes.Code != http.StatusBadRequest {
		t.Fatalf("empty status %d", emptyRes.Code)
	}

	deleteReq := requestWithUser(http.MethodDelete, "/api/fleet/mechanical-inspections/INSP-QA-209906", nil, user)
	routeCtx := chi.NewRouteContext()
	routeCtx.URLParams.Add("id", "INSP-QA-209906")
	deleteReq = deleteReq.WithContext(context.WithValue(deleteReq.Context(), chi.RouteCtxKey, routeCtx))
	deleteRes := httptest.NewRecorder()
	handler.DeleteInspection(deleteRes, deleteReq)
	if deleteRes.Code != http.StatusOK {
		t.Fatalf("delete status %d", deleteRes.Code)
	}

	listRes = httptest.NewRecorder()
	handler.ListInspections(listRes, listReq)
	if err := json.Unmarshal(listRes.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed) != 0 {
		t.Fatalf("expected empty list, got %#v", listed)
	}
}

func TestMechanicalInspectionForbiddenWithoutUser(t *testing.T) {
	handler := NewMechanicalInspectionHandler(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/fleet/mechanical-inspections", nil)
	res := httptest.NewRecorder()
	handler.ListInspections(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("status %d", res.Code)
	}
}

func requestWithUser(method, target string, body []byte, user *auth.AuthUser) *http.Request {
	req := httptest.NewRequest(method, target, bytes.NewReader(body))
	return req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, user))
}
