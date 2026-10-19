package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
)

type PayrollHandler struct {
	payrollRepo repository.PayrollRepository
	boardRepo   repository.SchoolBoardRepository
	routeRepo   repository.RouteRepository
	empRepo     repository.EmployeeRepository
}

func NewPayrollHandler(
	payrollRepo repository.PayrollRepository,
	boardRepo repository.SchoolBoardRepository,
	routeRepo repository.RouteRepository,
	empRepo repository.EmployeeRepository,
) *PayrollHandler {
	return &PayrollHandler{
		payrollRepo: payrollRepo,
		boardRepo:   boardRepo,
		routeRepo:   routeRepo,
		empRepo:     empRepo,
	}
}

// List returns all payroll rates
// GET /api/payroll-rates
func (h *PayrollHandler) List(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	rates, err := h.payrollRepo.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch payroll rates"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(rates)
}

// GetSchoolBoardBaseRates returns aggregated base rates for all school boards
// GET /api/payroll-rates/school-boards
func (h *PayrollHandler) GetSchoolBoardBaseRates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	boards, err := h.boardRepo.ListBoards(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch school boards"}`, http.StatusInternalServerError)
		return
	}

	res, err := h.payrollRepo.GetSchoolBoardBaseRates(r.Context(), boards)
	if err != nil {
		http.Error(w, `{"error":"failed to aggregate board base rates"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(res)
}

// GetCustomRates returns all custom/override rates
// GET /api/payroll-rates/custom
func (h *PayrollHandler) GetCustomRates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	rates, err := h.payrollRepo.GetCustomRates(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch custom payroll rates"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(rates)
}

// GetLookups returns boards, routes, employees, jobTitles, and shiftTypes
// GET /api/payroll-rates/lookups
func (h *PayrollHandler) GetLookups(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	boards, _ := h.boardRepo.ListBoards(r.Context())
	routes, _ := h.routeRepo.ListRoutes(r.Context(), repository.RouteFilter{})
	employees, _ := h.empRepo.List(r.Context(), repository.EmployeeFilter{})

	type SimpleBoard struct {
		SchoolBoardID   int    `json:"schoolBoardId"`
		SchoolBoardName string `json:"schoolBoardName"`
		SchoolBoardCode string `json:"schoolBoardCode"`
	}
	type SimpleShift struct {
		ShiftID   int    `json:"shiftId"`
		ShiftType string `json:"shiftType"`
	}
	type SimpleRoute struct {
		BusRouteID int           `json:"busRouteId"`
		RouteNo    string        `json:"routeNo"`
		RouteName  string        `json:"routeName"`
		Shifts     []SimpleShift `json:"shifts"`
	}
	type SimpleEmp struct {
		EmployeeID int    `json:"employeeId"`
		FirstName  string `json:"firstName"`
		LastName   string `json:"lastName"`
		JobPosition string `json:"jobPosition"`
	}

	var boardList []SimpleBoard
	for _, b := range boards {
		boardList = append(boardList, SimpleBoard{
			SchoolBoardID:   b.SchoolBoardID,
			SchoolBoardName: b.SchoolBoardName,
			SchoolBoardCode: b.SchoolBoardCode,
		})
	}

	var routeList []SimpleRoute
	for _, rt := range routes {
		shifts, _ := h.routeRepo.ListShiftsByRoute(r.Context(), rt.ID)
		var sList []SimpleShift
		for _, s := range shifts {
			sList = append(sList, SimpleShift{
				ShiftID:   s.ShiftID,
				ShiftType: s.ShiftType,
			})
		}
		routeList = append(routeList, SimpleRoute{
			BusRouteID: rt.BusRouteId,
			RouteNo:    rt.RouteNo,
			RouteName:  rt.RouteName,
			Shifts:     sList,
		})
	}

	var empList []SimpleEmp
	for _, e := range employees {
		empNum, _ := strconv.Atoi(strings.TrimPrefix(e.EmployeeNumber, "EMP-"))
		if empNum == 0 {
			empNum = 1000
		}
		empList = append(empList, SimpleEmp{
			EmployeeID:  empNum,
			FirstName:   e.FirstName,
			LastName:    e.LastName,
			JobPosition: e.JobPosition,
		})
	}

	jobTitles := []map[string]interface{}{
		{"id": 1, "name": "driver", "displayName": "Driver"},
		{"id": 2, "name": "attendant", "displayName": "Attendant"},
		{"id": 3, "name": "lpn", "displayName": "LPN"},
	}

	shiftTypes := []map[string]interface{}{
		{"id": 1, "name": "AM", "displayName": "AM"},
		{"id": 2, "name": "MIDDAY", "displayName": "MIDDAY / NOON"},
		{"id": 3, "name": "PM", "displayName": "PM"},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"schoolBoards": boardList,
		"routes":       routeList,
		"employees":    empList,
		"jobTitles":    jobTitles,
		"shiftTypes":   shiftTypes,
	})
}

// GetByID returns a rate by ID
// GET /api/payroll-rates/{id}
func (h *PayrollHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	rate, err := h.payrollRepo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"rate not found"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(rate)
}

// Create creates a new payroll rate
// POST /api/payroll-rates
func (h *PayrollHandler) Create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var rate models.BusRoutePayrollRate
	if err := json.NewDecoder(r.Body).Decode(&rate); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if rate.SchoolBoardID <= 0 {
		http.Error(w, `{"error":"schoolBoardId is required"}`, http.StatusBadRequest)
		return
	}

	created, err := h.payrollRepo.Create(r.Context(), &rate)
	if err != nil {
		http.Error(w, `{"error":"failed to create payroll rate"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// Update updates an existing payroll rate
// PUT /api/payroll-rates/{id}
func (h *PayrollHandler) Update(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var rate models.BusRoutePayrollRate
	if err := json.NewDecoder(r.Body).Decode(&rate); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}
	rate.ID = id

	updated, err := h.payrollRepo.Update(r.Context(), &rate)
	if err != nil {
		log.Printf("[ERROR] update payroll rate %s failed: %v", id, err)
		http.Error(w, fmt.Sprintf(`{"error":"failed to update payroll rate: %v"}`, err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// Delete removes a payroll rate
// DELETE /api/payroll-rates/{id}
func (h *PayrollHandler) Delete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	if err := h.payrollRepo.Delete(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete payroll rate"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "rate deleted successfully", "id": id})
}

// Calculate resolves rate priority hierarchy
// POST /api/payroll-rates/calculate
func (h *PayrollHandler) Calculate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.RateCalculationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid calculation request"}`, http.StatusBadRequest)
		return
	}

	resp, err := h.payrollRepo.ResolveRate(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to calculate rate"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(resp)
}
