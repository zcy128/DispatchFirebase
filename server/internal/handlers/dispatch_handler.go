package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dispatch-server/internal/auth"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"github.com/go-chi/chi/v5"
)

type DispatchHandler struct {
	repo      repository.DispatchRepository
	allowDemo bool
}

func NewDispatchHandler(repo repository.DispatchRepository, allowDemo bool) *DispatchHandler {
	return &DispatchHandler{repo: repo, allowDemo: allowDemo}
}

func (h *DispatchHandler) rejectSimulation(w http.ResponseWriter) bool {
	if h.allowDemo {
		return false
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte(`{"error":"operations simulation is disabled when APP_MODE=production"}`))
	return true
}

// CreateDay creates daily dispatch shifts for target date
func (h *DispatchHandler) CreateDay(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.CreateDispatchDayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Fallback to query param date if empty body
		dateStr := r.URL.Query().Get("date")
		if dateStr != "" {
			req.Date = dateStr
		} else {
			http.Error(w, `{"error":"missing date parameter"}`, http.StatusBadRequest)
			return
		}
	}

	if req.Date == "" {
		http.Error(w, `{"error":"date is required (YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}

	result, err := h.repo.CreateDay(r.Context(), req.Date, req.RouteNoFilter)
	if err != nil {
		http.Error(w, `{"error":"failed to generate daily dispatch: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

// DeleteDay deletes all dispatch shifts for a specific date
func (h *DispatchHandler) DeleteDay(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	date := r.URL.Query().Get("date")
	if date == "" {
		http.Error(w, `{"error":"date parameter is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteDay(r.Context(), date); err != nil {
		http.Error(w, `{"error":"failed to delete dispatch day: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Dispatch day cleared successfully for " + date,
	})
}

// ListShifts returns all dispatch shifts for a specific date with filters
func (h *DispatchHandler) ListShifts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	q := r.URL.Query()
	date := q.Get("date")
	if date == "" {
		http.Error(w, `{"error":"date parameter is required"}`, http.StatusBadRequest)
		return
	}

	filter := repository.DispatchFilter{
		Search:        q.Get("search"),
		RouteFilter:   q.Get("route"),
		DriverFilter:  q.Get("driver"),
		StopFilter:    q.Get("stop"),
		VehicleFilter: q.Get("vehicle"),
		ShiftType:     q.Get("shiftType"),
		Health:        q.Get("health"),
	}

	if naStr := q.Get("needsAttention"); naStr == "true" {
		b := true
		filter.NeedsAttention = &b
	}

	shifts, err := h.repo.ListShifts(r.Context(), date, filter)
	if err != nil {
		http.Error(w, `{"error":"failed to list dispatch shifts: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(shifts)
}

// GetShift returns a single dispatch shift by ID
func (h *DispatchHandler) GetShift(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	shift, err := h.repo.GetShiftByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"dispatch shift not found"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(shift)
}

// UpdateShift updates crew, vehicle, or comments on a dispatch shift
func (h *DispatchHandler) UpdateShift(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")

	var req models.UpdateDispatchShiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateShift(r.Context(), id, &req)
	if err != nil {
		if err == repository.ErrDispatchShiftNotFound {
			http.Error(w, `{"error":"dispatch shift not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to update dispatch shift: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// SyncCleanPayrollsForDate explicitly triggers synchronization of routine/clean dispatch payrolls to the finance log for a given date
func (h *DispatchHandler) SyncCleanPayrollsForDate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req struct {
		Date string `json:"date"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	date := req.Date
	if date == "" {
		date = r.URL.Query().Get("date")
	}
	if date == "" {
		http.Error(w, `{"error":"date is required"}`, http.StatusBadRequest)
		return
	}

	count, err := h.repo.SyncCleanPayrollsForDate(r.Context(), date)
	if err != nil {
		http.Error(w, `{"error":"failed to sync clean payrolls: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"date":    date,
		"synced":  count,
	})
}

// RecordStopArrival records stop arrival time and recalculates lateness
func (h *DispatchHandler) RecordStopArrival(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	shiftID := chi.URLParam(r, "id")
	stopIDStr := chi.URLParam(r, "stopId")

	stopID, err := strconv.Atoi(stopIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid stopId"}`, http.StatusBadRequest)
		return
	}

	var req models.RecordArrivalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid arrival request"}`, http.StatusBadRequest)
		return
	}

	timeVal := req.ArrivalTime
	if timeVal == "" {
		timeVal = req.ActualArrivalTime
	}

	updated, err := h.repo.RecordStopArrival(r.Context(), shiftID, stopID, timeVal)
	if err != nil {
		if err == repository.ErrDispatchShiftNotFound {
			http.Error(w, `{"error":"dispatch shift not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to record stop arrival: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// UpdateStudentStatus updates attendance and pickup time for a student at a stop
func (h *DispatchHandler) UpdateStudentStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	shiftID := chi.URLParam(r, "id")
	stopIDStr := chi.URLParam(r, "stopId")
	studentIDStr := chi.URLParam(r, "studentId")

	stopID, err := strconv.Atoi(stopIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid stopId"}`, http.StatusBadRequest)
		return
	}
	studentID, err := strconv.Atoi(studentIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid studentId"}`, http.StatusBadRequest)
		return
	}

	var payload struct {
		IsPresent         *bool   `json:"isPresent"`
		PickupTime        *string `json:"pickupTime"`
		DropoffTime       *string `json:"dropoffTime"`
		ActualArrivalTime *string `json:"actualArrivalTime"`
		Status            *string `json:"status"`
		DropoffStatus     *string `json:"dropoffStatus"`
		AbsenceReason     *string `json:"absenceReason"`
		ReportedBy        *string `json:"reportedBy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if (payload.Status != nil && *payload.Status == "dropped_off") || (payload.DropoffStatus != nil && *payload.DropoffStatus == "dropped_off") {
		t := true
		payload.IsPresent = &t
	} else if payload.IsPresent == nil && payload.Status != nil {
		if *payload.Status == "picked_up" {
			t := true
			payload.IsPresent = &t
		} else if *payload.Status == "absent" || *payload.Status == "no_show" {
			f := false
			payload.IsPresent = &f
		}
	}

	updated, err := h.repo.UpdateStudentStatus(r.Context(), shiftID, stopID, studentID, payload.IsPresent, payload.PickupTime, payload.DropoffTime, payload.ActualArrivalTime, payload.Status, payload.DropoffStatus, payload.AbsenceReason, payload.ReportedBy)
	if err != nil {
		http.Error(w, `{"error":"failed to update student status"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// RecordStudentAbsence logs a student absence for today, tomorrow, or a specific date across runs
func (h *DispatchHandler) RecordStudentAbsence(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.RecordStudentAbsenceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Date == "" || req.StudentID <= 0 {
		http.Error(w, `{"error":"date and studentId are required"}`, http.StatusBadRequest)
		return
	}

	res, err := h.repo.RecordStudentAbsence(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to record student absence: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(res)
}

// ListStudentAbsences returns student absences across a date range (defaults to next 2 weeks)
func (h *DispatchHandler) ListStudentAbsences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	if startDate == "" {
		startDate = time.Now().Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().AddDate(0, 0, 14).Format("2006-01-02")
	}

	studentID, _ := strconv.Atoi(r.URL.Query().Get("studentId"))
	routeNo := r.URL.Query().Get("routeNo")
	shiftType := r.URL.Query().Get("shiftType")

	filter := models.ListStudentAbsencesFilter{
		StartDate: startDate,
		EndDate:   endDate,
		StudentID: studentID,
		RouteNo:   routeNo,
		ShiftType: shiftType,
	}

	res, err := h.repo.ListStudentAbsences(r.Context(), filter)
	if err != nil {
		http.Error(w, `{"error":"failed to list student absences: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	if res == nil {
		res = make([]*models.StudentAbsenceRecord, 0)
	}

	json.NewEncoder(w).Encode(res)
}

// CancelStudentAbsence cancels or deletes an absence entry and restores rider status
func (h *DispatchHandler) CancelStudentAbsence(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	user := r.Header.Get("X-User-Id")
	if user == "" {
		user = "Dispatcher"
	}

	err := h.repo.CancelStudentAbsence(r.Context(), id, user)
	if err != nil {
		http.Error(w, `{"error":"failed to cancel student absence: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Write([]byte(`{"success":true,"id":"` + id + `"}`))
}

// SplitShift partitions a dispatch shift into two or more separate shifts
func (h *DispatchHandler) SplitShift(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	shiftID := chi.URLParam(r, "id")
	if shiftID == "" {
		http.Error(w, `{"error":"shift id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.SplitDispatchShiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if len(req.Parts) < 2 {
		http.Error(w, `{"error":"at least two split parts are required"}`, http.StatusBadRequest)
		return
	}

	results, err := h.repo.SplitShift(r.Context(), shiftID, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to split shift: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(results)
}

// GetPayrollSettings returns global dispatch payroll defaults
func (h *DispatchHandler) GetPayrollSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	settings, err := h.repo.GetPayrollSettings(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to get dispatch payroll settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(settings)
}

// SavePayrollSettings updates global dispatch payroll defaults
func (h *DispatchHandler) SavePayrollSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var settings models.DispatchPayrollSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	saved, err := h.repo.SavePayrollSettings(r.Context(), &settings)
	if err != nil {
		http.Error(w, `{"error":"failed to save dispatch payroll settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(saved)
}

// GetCheckInReminderSettings returns crew check-in FCM reminder configuration
func (h *DispatchHandler) GetCheckInReminderSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	settings, err := h.repo.GetCheckInReminderSettings(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to get check-in reminder settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(settings)
}

// SaveCheckInReminderSettings updates crew check-in FCM reminder configuration
func (h *DispatchHandler) SaveCheckInReminderSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var settings models.CheckInReminderSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	saved, err := h.repo.SaveCheckInReminderSettings(r.Context(), &settings)
	if err != nil {
		http.Error(w, `{"error":"failed to save check-in reminder settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(saved)
}

// GetSimulationSettings returns the automated operations simulation settings
func (h *DispatchHandler) GetSimulationSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	settings, err := h.repo.GetSimulationSettings(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to get simulation settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if !h.allowDemo && settings != nil {
		settings.Enabled = false
	}
	json.NewEncoder(w).Encode(settings)
}

// SaveSimulationSettings updates the automated operations simulation settings
func (h *DispatchHandler) SaveSimulationSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.rejectSimulation(w) {
		return
	}
	var settings models.SimulationSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	existing, _ := h.repo.GetSimulationSettings(r.Context())
	if existing != nil {
		if settings.LastAutoGeneratedForDate == "" {
			settings.LastAutoGeneratedForDate = existing.LastAutoGeneratedForDate
		}
		if settings.LastSimulatedDate == "" {
			settings.LastSimulatedDate = existing.LastSimulatedDate
		}
		if settings.LastRunAt == "" {
			settings.LastRunAt = existing.LastRunAt
		}
	}

	saved, err := h.repo.SaveSimulationSettings(r.Context(), &settings)
	if err != nil {
		http.Error(w, `{"error":"failed to save simulation settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	// If simulation is enabled, immediately ensure today (and tomorrow if >= 14:00 Ottawa time) are simulated
	if saved.Enabled {
		go func() {
			bgCtx := context.Background()
			loc, errLoc := time.LoadLocation("America/Toronto")
			if errLoc != nil {
				loc = time.FixedZone("EDT", -4*3600)
			}
			nowOttawa := time.Now().In(loc)
			todayStr := nowOttawa.Format("2006-01-02")
			_, _ = h.repo.RunSimulationForDate(bgCtx, todayStr, false)

			autoTime := saved.AutoGenerateTime
			if autoTime == "" {
				autoTime = "14:00"
			}
			if nowOttawa.Format("15:04") >= autoTime {
				tomorrowStr := nowOttawa.AddDate(0, 0, 1).Format("2006-01-02")
				if _, errSim := h.repo.RunSimulationForDate(bgCtx, tomorrowStr, false); errSim == nil {
					curr, _ := h.repo.GetSimulationSettings(bgCtx)
					if curr != nil {
						curr.LastAutoGeneratedForDate = tomorrowStr
						_, _ = h.repo.SaveSimulationSettings(bgCtx, curr)
					}
				}
			}
		}()
	}

	json.NewEncoder(w).Encode(saved)
}

// RunSimulation executes the operations simulation on demand for a specified date (or today Ottawa time)
func (h *DispatchHandler) RunSimulation(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.rejectSimulation(w) {
		return
	}
	var req models.RunSimulationRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	if qDate := r.URL.Query().Get("date"); qDate != "" && req.Date == "" {
		req.Date = qDate
	}
	if r.URL.Query().Get("force") == "true" {
		req.ForceOverwrite = true
	}

	res, err := h.repo.RunSimulationForDate(r.Context(), req.Date, req.ForceOverwrite)
	if err != nil {
		http.Error(w, `{"error":"failed to run simulation: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// CheckInDriver logs or reverts driver check-in for a dispatch shift
func (h *DispatchHandler) CheckInDriver(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	shiftID := chi.URLParam(r, "id")
	if shiftID == "" {
		http.Error(w, `{"error":"shift id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.DriverCheckInRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	updated, err := h.repo.CheckInDriver(r.Context(), shiftID, &req)
	if err != nil {
		if err == repository.ErrDispatchShiftNotFound {
			http.Error(w, `{"error":"dispatch shift not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to check in driver: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// ListChangeLogs returns audit change logs for a given dispatch date
func (h *DispatchHandler) ListChangeLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	date := r.URL.Query().Get("date")
	if date == "" {
		http.Error(w, `{"error":"date parameter is required (YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}

	routeNo := r.URL.Query().Get("routeNo")
	employee := r.URL.Query().Get("employee")
	scope := r.URL.Query().Get("scope")
	logs, err := h.repo.ListChangeLogsFiltered(r.Context(), date, routeNo, employee, scope)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch change logs: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = make([]*models.DispatchChangeLog, 0)
	}
	json.NewEncoder(w).Encode(logs)
}

// ListSystemAuditLogs returns system audit logs for route, entity, payroll, safety or dispatch
func (h *DispatchHandler) ListSystemAuditLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	col := r.URL.Query().Get("collection")
	if col == "" {
		// Default or infer from path
		path := r.URL.Path
		switch {
		case strings.Contains(path, "route-change-logs"):
			col = "route_change_logs"
		case strings.Contains(path, "entity-operation-logs"):
			col = "entity_operation_logs"
		case strings.Contains(path, "payroll-operation-logs"):
			col = "payroll_operation_logs"
		case strings.Contains(path, "operational-safety-logs"):
			col = "operational_safety_logs"
		default:
			col = "dispatch_change_logs"
		}
	}

	startDate := r.URL.Query().Get("startDate")
	if startDate == "" {
		startDate = r.URL.Query().Get("date")
	}
	endDate := r.URL.Query().Get("endDate")
	if endDate == "" {
		endDate = startDate
	}

	logs, err := h.repo.ListSystemAuditLogs(r.Context(), col, startDate, endDate)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to fetch audit logs: %v"}`, err), http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = make([]map[string]interface{}, 0)
	}
	json.NewEncoder(w).Encode(logs)
}

// CreateChangeLog manually records an audit change log
func (h *DispatchHandler) CreateChangeLog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var log models.DispatchChangeLog
	if err := json.NewDecoder(r.Body).Decode(&log); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if log.DispatchDate == "" {
		http.Error(w, `{"error":"dispatchDate is required (YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}

	saved, err := h.repo.AddChangeLog(r.Context(), &log)
	if err != nil {
		http.Error(w, `{"error":"failed to save change log: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(saved)
}

// ListDispatchPayrolls returns confirmed dispatch payroll liabilities for a given date
func (h *DispatchHandler) ListDispatchPayrolls(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	date := r.URL.Query().Get("date")
	if date == "" {
		http.Error(w, `{"error":"date parameter is required (YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}

	records, err := h.repo.ListDispatchPayrolls(r.Context(), date)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch dispatch payrolls: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = make([]*models.DispatchPayrollRecord, 0)
	}
	json.NewEncoder(w).Encode(records)
}

// GenerateDispatchPayroll manually triggers or creates a dispatch payroll record
func (h *DispatchHandler) GenerateDispatchPayroll(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.GenerateDispatchPayrollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.ShiftID == "" || req.Role == "" {
		http.Error(w, `{"error":"shiftId and role ('driver' or 'attendant') are required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.GenerateDispatchPayroll(r.Context(), req.ShiftID, req.Role, req.CheckInTime)
	if err != nil {
		http.Error(w, `{"error":"failed to generate dispatch payroll: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// DeleteDispatchPayroll deletes a confirmed dispatch payroll record for a shift role
func (h *DispatchHandler) DeleteDispatchPayroll(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	shiftID := chi.URLParam(r, "shiftId")
	role := chi.URLParam(r, "role")

	if shiftID == "" || role == "" {
		http.Error(w, `{"error":"shiftId and role are required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteDispatchPayroll(r.Context(), shiftID, role); err != nil {
		http.Error(w, `{"error":"failed to delete dispatch payroll: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// CheckOutCrew logs or reverts driver or attendant check-out for a dispatch shift
func (h *DispatchHandler) CheckOutCrew(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	shiftID := chi.URLParam(r, "id")
	if shiftID == "" {
		http.Error(w, `{"error":"shift id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.CrewCheckOutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.CheckOutCrew(r.Context(), shiftID, &req)
	if err != nil {
		if err == repository.ErrDispatchShiftNotFound {
			http.Error(w, `{"error":"dispatch shift not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to process crew checkout: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// ApproveDispatchPayroll approves a dispatch payroll record and syncs to finance
func (h *DispatchHandler) ApproveDispatchPayroll(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"payroll id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.ApproveDispatchPayrollRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	updated, err := h.repo.ApproveDispatchPayroll(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to approve dispatch payroll: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// RejectDispatchPayroll rejects a dispatch payroll record
func (h *DispatchHandler) RejectDispatchPayroll(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"payroll id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.RejectDispatchPayrollRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	updated, err := h.repo.RejectDispatchPayroll(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to reject dispatch payroll: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// ListPayrollDepartmentLogs lists synced records in the finance payroll log
func (h *DispatchHandler) ListPayrollDepartmentLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	date := r.URL.Query().Get("date")
	status := r.URL.Query().Get("status")
	employeeID := r.URL.Query().Get("employeeId")
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")

	var logs []*models.PayrollDepartmentLogRecord
	var err error

	if startDate != "" && endDate != "" {
		logs, err = h.repo.ListPayrollDepartmentLogsRange(r.Context(), startDate, endDate, status, employeeID)
	} else {
		logs, err = h.repo.ListPayrollDepartmentLogs(r.Context(), date, status, employeeID)
	}

	if err != nil {
		http.Error(w, `{"error":"failed to list payroll department logs: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(logs)
}

// UpdatePayrollDepartmentLog allows payroll staff to update hours, rate, or notes in the finance log
func (h *DispatchHandler) UpdatePayrollDepartmentLog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"log id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdatePayrollDepartmentLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdatePayrollDepartmentLog(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update payroll department log: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// ListTemporaryAssignments lists scheduled temporary crew assignments with optional filters
func (h *DispatchHandler) ListTemporaryAssignments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	routeID := r.URL.Query().Get("routeId")
	date := r.URL.Query().Get("date")
	status := r.URL.Query().Get("status")

	list, err := h.repo.ListTemporaryAssignments(r.Context(), routeID, date, status)
	if err != nil {
		http.Error(w, `{"error":"failed to list temporary assignments: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(list)
}

// GetTemporaryAssignmentByID retrieves a specific temporary assignment by ID
func (h *DispatchHandler) GetTemporaryAssignmentByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"assignment id is required"}`, http.StatusBadRequest)
		return
	}

	assignment, err := h.repo.GetTemporaryAssignmentByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"temporary assignment not found: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(assignment)
}

// CreateTemporaryAssignment creates a new temporary assignment for a route/shift
func (h *DispatchHandler) CreateTemporaryAssignment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.CreateTemporaryAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.RouteID == "" || req.RouteNo == "" {
		http.Error(w, `{"error":"routeId and routeNo are required"}`, http.StatusBadRequest)
		return
	}
	if req.StartDate == "" {
		http.Error(w, `{"error":"startDate is required"}`, http.StatusBadRequest)
		return
	}

	created, err := h.repo.CreateTemporaryAssignment(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create temporary assignment: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// UpdateTemporaryAssignment modifies an existing temporary assignment
func (h *DispatchHandler) UpdateTemporaryAssignment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"assignment id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateTemporaryAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateTemporaryAssignment(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update temporary assignment: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// DeleteTemporaryAssignment removes a temporary assignment
func (h *DispatchHandler) DeleteTemporaryAssignment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"assignment id is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteTemporaryAssignment(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete temporary assignment: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "id": id})
}

// ── Time Off Request HTTP Handlers ─────────────────────────────────────────

// ListTimeOffRequests returns all time off requests with optional filters
func (h *DispatchHandler) ListTimeOffRequests(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	employeeID := r.URL.Query().Get("employeeId")
	status := r.URL.Query().Get("status")
	date := r.URL.Query().Get("date")

	list, err := h.repo.ListTimeOffRequestsFiltered(r.Context(), repository.TimeOffFilter{
		EmployeeID:     employeeID,
		Status:         status,
		Date:           date,
		StartDate:      r.URL.Query().Get("startDate"),
		EndDate:        r.URL.Query().Get("endDate"),
		IncludeArchive: r.URL.Query().Get("includeArchive") == "true" || r.URL.Query().Get("archive") == "true",
		OnlyArchive:    r.URL.Query().Get("onlyArchive") == "true",
		FullArchive:    r.URL.Query().Get("fullArchive") == "true",
	})
	if err != nil {
		http.Error(w, `{"error":"failed to list time off requests: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = make([]*models.TimeOffRequest, 0)
	}

	json.NewEncoder(w).Encode(list)
}

// GetTimeOffRequestByID returns a single time off request
func (h *DispatchHandler) GetTimeOffRequestByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	rec, err := h.repo.GetTimeOffRequestByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(rec)
}

// CreateTimeOffRequest creates a new time off request (all users)
func (h *DispatchHandler) CreateTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.CreateTimeOffRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.EmployeeID == "" {
		http.Error(w, `{"error":"employeeId is required"}`, http.StatusBadRequest)
		return
	}
	if req.StartDate == "" || req.EndDate == "" {
		http.Error(w, `{"error":"startDate and endDate are required"}`, http.StatusBadRequest)
		return
	}

	created, err := h.repo.CreateTimeOffRequest(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create time off request: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// UpdateTimeOffRequest updates a pending time off request
func (h *DispatchHandler) UpdateTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateTimeOffRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateTimeOffRequest(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update time off request: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// ApproveTimeOffRequest approves a time off request (HR/Admin only)
func (h *DispatchHandler) ApproveTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.ReviewTimeOffRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.ApproveTimeOffRequest(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to approve time off request: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// RejectTimeOffRequest rejects a time off request (HR/Admin only)
func (h *DispatchHandler) RejectTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.ReviewTimeOffRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.RejectTimeOffRequest(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to reject time off request: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// CancelTimeOffRequest cancels a time off request by requester or HR/Admin
func (h *DispatchHandler) CancelTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		UserID string `json:"userId"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	updated, err := h.repo.CancelTimeOffRequest(r.Context(), id, body.UserID)
	if err != nil {
		http.Error(w, `{"error":"failed to cancel time off request: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(updated)
}

// DeleteTimeOffRequest removes a time off request (HR/Admin only)
func (h *DispatchHandler) DeleteTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteTimeOffRequest(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete time off request: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "id": id})
}

// ListTrainingCourses returns all training courses with optional filters
func (h *DispatchHandler) ListTrainingCourses(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	status := r.URL.Query().Get("status")
	trainingType := r.URL.Query().Get("trainingType")
	date := r.URL.Query().Get("date")

	list, err := h.repo.ListTrainingCourses(r.Context(), status, trainingType, date)
	if err != nil {
		http.Error(w, `{"error":"failed to list training courses: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(list)
}

// GetTrainingCourseByID returns a specific course by ID
func (h *DispatchHandler) GetTrainingCourseByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	c, err := h.repo.GetTrainingCourseByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"failed to get training course: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(c)
}

// CreateTrainingCourse creates a new training course session
func (h *DispatchHandler) CreateTrainingCourse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req models.CreateTrainingCoursePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	created, err := h.repo.CreateTrainingCourse(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create training course: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// UpdateTrainingCourse updates a training course
func (h *DispatchHandler) UpdateTrainingCourse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateTrainingCoursePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateTrainingCourse(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update training course: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// PublishTrainingCourse changes status to published
func (h *DispatchHandler) PublishTrainingCourse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.PublishTrainingCourse(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"failed to publish training course: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// CancelTrainingCourse changes status to cancelled
func (h *DispatchHandler) CancelTrainingCourse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.CancelTrainingCourse(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"failed to cancel training course: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// CompleteTrainingCourse changes status to completed
func (h *DispatchHandler) CompleteTrainingCourse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.CompleteTrainingCourse(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"failed to complete training course: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// DeleteTrainingCourse permanently deletes a course
func (h *DispatchHandler) DeleteTrainingCourse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteTrainingCourse(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete training course: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "id": id})
}

// RegisterAttendee registers an employee for a training course
func (h *DispatchHandler) RegisterAttendee(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.RegisterAttendeePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.RegisterAttendee(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to register attendee: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// UpdateAttendeeStatus updates attendee status, check-in, score, or notes
func (h *DispatchHandler) UpdateAttendeeStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	regID := chi.URLParam(r, "regId")
	if id == "" || regID == "" {
		http.Error(w, `{"error":"id and regId are required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateAttendeeStatusPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateAttendeeStatus(r.Context(), id, regID, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update attendee status: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// CancelRegistration cancels an attendee's registration
func (h *DispatchHandler) CancelRegistration(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	regID := chi.URLParam(r, "regId")
	if id == "" || regID == "" {
		http.Error(w, `{"error":"id and regId are required"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.CancelRegistration(r.Context(), id, regID)
	if err != nil {
		http.Error(w, `{"error":"failed to cancel registration: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// ListTrainingTypes returns all training types
func (h *DispatchHandler) ListTrainingTypes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	list, err := h.repo.ListTrainingTypes(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to list training types: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(list)
}

// CreateTrainingType adds a new training category
func (h *DispatchHandler) CreateTrainingType(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var t models.TrainingType
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	created, err := h.repo.CreateTrainingType(r.Context(), &t)
	if err != nil {
		http.Error(w, `{"error":"failed to create training type: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// UpdateTrainingType updates an existing training type
func (h *DispatchHandler) UpdateTrainingType(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var t models.TrainingType
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.repo.UpdateTrainingType(r.Context(), id, &t)
	if err != nil {
		http.Error(w, `{"error":"failed to update training type: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(updated)
}

// ─── Pre-Trip Inspections ───────────────────────────────────────────────────

// CreatePreTripInspection submits a new daily vehicle pre-trip inspection.
func (h *DispatchHandler) CreatePreTripInspection(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.CreatePreTripInspectionPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.VehicleUnit == "" {
		http.Error(w, `{"error":"vehicleUnit is required"}`, http.StatusBadRequest)
		return
	}
	if req.InspectionDate == "" {
		http.Error(w, `{"error":"inspectionDate is required (YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}
	if req.InspectorID == "" {
		http.Error(w, `{"error":"inspectorId is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.CreatePreTripInspection(r.Context(), &req)
	if err != nil {
		if strings.Contains(err.Error(), "odometer") {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
			return
		}
		http.Error(w, `{"error":"failed to create pretrip inspection: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// GetPreTripInspectionToday returns today's inspection for a specific vehicle (nil if none).
func (h *DispatchHandler) GetPreTripInspectionToday(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vehicleUnit := chi.URLParam(r, "vehicleUnit")
	date := r.URL.Query().Get("date")
	if date == "" {
		http.Error(w, `{"error":"date query param is required (YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.GetPreTripInspectionToday(r.Context(), vehicleUnit, date)
	if err != nil {
		http.Error(w, `{"error":"failed to get pretrip inspection: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if record == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"found": false, "inspection": nil})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"found": true, "inspection": record})
}

// ListPreTripInspections lists inspections, optionally filtered by date and/or vehicleUnit.
func (h *DispatchHandler) ListPreTripInspections(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	date := r.URL.Query().Get("date")
	vehicleUnit := r.URL.Query().Get("vehicleUnit")

	records, err := h.repo.ListPreTripInspections(r.Context(), date, vehicleUnit)
	if err != nil {
		http.Error(w, `{"error":"failed to list pretrip inspections: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = []*models.PreTripInspection{}
	}
	json.NewEncoder(w).Encode(records)
}

// ─── Vehicle Defect Reports ────────────────────────────────────────────────

// CreateDefectReport submits a new vehicle defect report from a driver.
func (h *DispatchHandler) CreateDefectReport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.CreateDefectReportPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.VehicleUnitNumber == "" {
		http.Error(w, `{"error":"vehicleUnitNumber is required"}`, http.StatusBadRequest)
		return
	}
	if req.ReportedByUserID == "" {
		http.Error(w, `{"error":"reportedByUserId is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.CreateDefectReport(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create defect report: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// GetDefectReport returns a single defect report by ID.
func (h *DispatchHandler) GetDefectReport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.GetDefectReportByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"failed to get defect report: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ListDefectReports lists defect reports with optional vehicle, status, and driver filters.
func (h *DispatchHandler) ListDefectReports(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vehicleUnit := r.URL.Query().Get("vehicleUnit")
	status := r.URL.Query().Get("status")
	driverID := r.URL.Query().Get("driverId")
	timeRange := r.URL.Query().Get("timeRange")
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	query := r.URL.Query().Get("query")
	if query == "" {
		query = r.URL.Query().Get("search")
	}

	records, err := h.repo.ListDefectReportsFiltered(r.Context(), repository.DefectFilter{
		VehicleUnit: vehicleUnit,
		Status:      status,
		DriverID:    driverID,
		Query:       query,
		TimeRange:   timeRange,
		StartDate:   startDate,
		EndDate:     endDate,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to list defect reports: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = []*models.VehicleDefectReport{}
	}
	json.NewEncoder(w).Encode(records)
}

// UpdateDefectAssessment saves the fleet assessment, repair schedule, or resolution details.
func (h *DispatchHandler) UpdateDefectAssessment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateDefectAssessmentPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.UpdateDefectAssessment(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update defect assessment: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// UpdateDefectStatus updates the status lifecycle of a defect report.
func (h *DispatchHandler) UpdateDefectStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if req.Status == "" {
		http.Error(w, `{"error":"status is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.UpdateDefectStatus(r.Context(), id, req.Status)
	if err != nil {
		http.Error(w, `{"error":"failed to update defect status: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ─── Student Incident Handlers ──────────────────────────────────────────────

// CreateStudentIncident submits a new student incident report.
func (h *DispatchHandler) CreateStudentIncident(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.CreateStudentIncidentPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.StudentName == "" || req.DriverID == "" {
		http.Error(w, `{"error":"studentName and driverId are required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.CreateStudentIncident(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create student incident: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// GetStudentIncident returns a single student incident report by ID.
func (h *DispatchHandler) GetStudentIncident(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.GetStudentIncidentByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"student incident not found: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ListStudentIncidents lists student incident reports with optional query filters.
func (h *DispatchHandler) ListStudentIncidents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	studentIDStr := r.URL.Query().Get("studentId")
	studentID := 0
	if studentIDStr != "" {
		if val, err := strconv.Atoi(studentIDStr); err == nil {
			studentID = val
		}
	}

	routeNo := r.URL.Query().Get("routeNo")
	driverID := r.URL.Query().Get("driverId")
	status := r.URL.Query().Get("status")
	needsFollowUp := r.URL.Query().Get("needsFollowUp") == "true"
	timeRange := r.URL.Query().Get("timeRange")
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	studentNo := r.URL.Query().Get("studentNo")
	studentName := r.URL.Query().Get("studentName")
	query := r.URL.Query().Get("query")
	if query == "" {
		query = r.URL.Query().Get("search")
	}

	records, err := h.repo.ListStudentIncidentsFiltered(r.Context(), repository.StudentIncidentFilter{
		StudentID:     studentID,
		StudentNo:     studentNo,
		StudentName:   studentName,
		RouteNo:       routeNo,
		DriverID:      driverID,
		Status:        status,
		NeedsFollowUp: needsFollowUp,
		Query:         query,
		TimeRange:     timeRange,
		StartDate:     startDate,
		EndDate:       endDate,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to list student incidents: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = []*models.StudentIncident{}
	}
	json.NewEncoder(w).Encode(records)
}

// UpdateStudentIncidentOfficeFollowUp updates office review notes, disciplinary actions, and status.
func (h *DispatchHandler) UpdateStudentIncidentOfficeFollowUp(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateIncidentOfficeFollowUpPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.UpdateStudentIncidentOfficeFollowUp(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update student incident office follow up: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// UpdateStudentIncidentStatus updates the status of a student incident report.
func (h *DispatchHandler) UpdateStudentIncidentStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateStudentIncidentStatusPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if req.Status == "" {
		http.Error(w, `{"error":"status is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.UpdateStudentIncidentStatus(r.Context(), id, req.Status)
	if err != nil {
		http.Error(w, `{"error":"failed to update student incident status: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ─── Expense Reimbursements ────────────────────────────────────────────────

// ListExpenseCategories returns active expense categories.
func (h *DispatchHandler) ListExpenseCategories(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	categories, err := h.repo.ListExpenseCategories(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to list expense categories: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if categories == nil {
		categories = []*models.ExpenseCategory{}
	}
	json.NewEncoder(w).Encode(categories)
}

// CreateExpenseClaim submits a new driver expense claim.
func (h *DispatchHandler) CreateExpenseClaim(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.CreateExpenseClaimPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if req.EmployeeID == "" {
		http.Error(w, `{"error":"employeeId is required"}`, http.StatusBadRequest)
		return
	}
	if len(req.Lines) == 0 {
		http.Error(w, `{"error":"at least one expense line is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.CreateExpenseClaim(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create expense claim: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// GetExpenseClaim fetches a single expense claim by ID.
func (h *DispatchHandler) GetExpenseClaim(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.GetExpenseClaimByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"expense claim not found: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ListExpenseClaims lists expense claims with optional employeeId, status, routeNo, query, and timeRange filters.
func (h *DispatchHandler) ListExpenseClaims(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	employeeID := r.URL.Query().Get("employeeId")
	status := r.URL.Query().Get("status")
	routeNo := r.URL.Query().Get("routeNo")
	timeRange := r.URL.Query().Get("timeRange")
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	query := r.URL.Query().Get("query")
	if query == "" {
		query = r.URL.Query().Get("search")
	}

	records, err := h.repo.ListExpenseClaimsFiltered(r.Context(), repository.ExpenseClaimFilter{
		EmployeeID: employeeID,
		Status:     status,
		RouteNo:    routeNo,
		Query:      query,
		TimeRange:  timeRange,
		StartDate:  startDate,
		EndDate:    endDate,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to list expense claims: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = []*models.ExpenseReimbursement{}
	}
	json.NewEncoder(w).Encode(records)
}

// ReviewExpenseClaim reviews (approves or rejects) an expense claim.
func (h *DispatchHandler) ReviewExpenseClaim(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.ReviewExpenseClaimPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if req.Status != "approved" && req.Status != "rejected" {
		http.Error(w, `{"error":"status must be 'approved' or 'rejected'"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.ReviewExpenseClaim(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to review expense claim: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// CancelExpenseClaim allows a driver to cancel a pending expense claim.
func (h *DispatchHandler) CancelExpenseClaim(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.CancelExpenseClaimPayload
	// req body is optional
	_ = json.NewDecoder(r.Body).Decode(&req)

	record, err := h.repo.CancelExpenseClaim(r.Context(), id, req.EmployeeID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ─── Hazard & Near-Miss Reports Handlers ───────────────────────────────────

// CreateHazardReport submits a new hazard or near-miss report.
func (h *DispatchHandler) CreateHazardReport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.CreateHazardReportPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.ReportedBy) == "" {
		req.ReportedBy = "Driver / Crew"
	}
	if strings.TrimSpace(req.EventDescription) == "" {
		http.Error(w, `{"error":"eventDescription is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.CreateHazardReport(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create hazard report: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// GetHazardReport retrieves a single hazard report by ID.
func (h *DispatchHandler) GetHazardReport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.GetHazardReportByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"hazard report not found: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ListHazardReports lists hazard reports with optional employeeId, status, and officeHazardType filters.
func (h *DispatchHandler) ListHazardReports(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	employeeID := r.URL.Query().Get("employeeId")
	statusStr := r.URL.Query().Get("status")
	officeHazardType := r.URL.Query().Get("officeHazardType")
	unitNumber := r.URL.Query().Get("unitNumber")
	routeID := r.URL.Query().Get("routeId")
	timeRange := r.URL.Query().Get("timeRange")
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	query := r.URL.Query().Get("query")
	if query == "" {
		query = r.URL.Query().Get("search")
	}

	var statusInt *int
	if statusStr != "" && statusStr != "all" && statusStr != "All" {
		if val, err := strconv.Atoi(statusStr); err == nil {
			statusInt = &val
		} else {
			switch strings.ToLower(statusStr) {
			case "open":
				v := 0
				statusInt = &v
			case "investigating", "under_investigation":
				v := 1
				statusInt = &v
			case "resolved", "completed":
				v := 2
				statusInt = &v
			}
		}
	}

	records, err := h.repo.ListHazardReportsFiltered(r.Context(), repository.HazardReportFilter{
		ReportedByEmployeeID: employeeID,
		UnitNumber:           unitNumber,
		RouteID:              routeID,
		StatusInt:            statusInt,
		OfficeHazardType:     officeHazardType,
		Query:                query,
		TimeRange:            timeRange,
		StartDate:            startDate,
		EndDate:              endDate,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to list hazard reports: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = []*models.HazardReport{}
	}
	json.NewEncoder(w).Encode(records)
}

// UpdateHazardReportOffice handles office / safety risk potential evaluation updates.
func (h *DispatchHandler) UpdateHazardReportOffice(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateHazardReportOfficePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.UpdateHazardReportOffice(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update hazard report: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ─── Route Assessment Handlers ──────────────────────────────────────────────

// CreateRouteAssessment creates a new route assessment checklist.
func (h *DispatchHandler) CreateRouteAssessment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.CreateRouteAssessmentPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.RouteID) == "" {
		req.RouteID = "General"
	}
	if strings.TrimSpace(req.ConductedByDriver) == "" {
		req.ConductedByDriver = "Driver"
	}

	record, err := h.repo.CreateRouteAssessment(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create route assessment: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// GetRouteAssessment retrieves a single route assessment by ID.
func (h *DispatchHandler) GetRouteAssessment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.GetRouteAssessmentByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"route assessment not found: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ListRouteAssessments lists route assessments with optional routeId, employeeId, status, and assessmentType filters.
func (h *DispatchHandler) ListRouteAssessments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	routeID := r.URL.Query().Get("routeId")
	employeeID := r.URL.Query().Get("employeeId")
	statusStr := r.URL.Query().Get("status")
	assessmentType := r.URL.Query().Get("assessmentType")
	timeRange := r.URL.Query().Get("timeRange")
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	query := r.URL.Query().Get("query")
	if query == "" {
		query = r.URL.Query().Get("search")
	}

	var statusInt *int
	if statusStr != "" && statusStr != "all" && statusStr != "All" {
		if val, err := strconv.Atoi(statusStr); err == nil {
			statusInt = &val
		} else {
			switch strings.ToLower(statusStr) {
			case "working", "draft", "open":
				v := 0
				statusInt = &v
			case "completed":
				v := 2
				statusInt = &v
			case "submitted":
				v := 3
				statusInt = &v
			}
		}
	}

	records, err := h.repo.ListRouteAssessmentsFiltered(r.Context(), repository.RouteAssessmentFilter{
		RouteID:               routeID,
		ConductedByEmployeeID: employeeID,
		StatusInt:             statusInt,
		AssessmentType:        assessmentType,
		Query:                 query,
		TimeRange:             timeRange,
		StartDate:             startDate,
		EndDate:               endDate,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to list route assessments: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = []*models.RouteAssessment{}
	}
	json.NewEncoder(w).Encode(records)
}

// UpdateRouteAssessmentOffice updates only the Office section (Assigned To, Completed, Submitted).
func (h *DispatchHandler) UpdateRouteAssessmentOffice(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateRouteAssessmentOfficePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.UpdateRouteAssessmentOffice(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update route assessment office: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// UpdateRouteAssessment updates the route assessment fields.
func (h *DispatchHandler) UpdateRouteAssessment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateRouteAssessmentPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.UpdateRouteAssessment(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update route assessment: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// DeleteRouteAssessment deletes a route assessment.
func (h *DispatchHandler) DeleteRouteAssessment(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteRouteAssessment(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete route assessment: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *DispatchHandler) checkFleetRole(w http.ResponseWriter, r *http.Request) bool {
	user := auth.GetUser(r.Context())
	if user != nil {
		if strings.EqualFold(user.Role, "fleet") || strings.EqualFold(user.Role, "admin") {
			return true
		}
	}

	roleHdr := r.Header.Get("X-User-Role")
	if roleHdr == "" {
		roleHdr = r.URL.Query().Get("role")
	}
	if roleHdr == "" {
		roleHdr = r.URL.Query().Get("userRole")
	}
	if strings.EqualFold(roleHdr, "fleet") || strings.EqualFold(roleHdr, "admin") {
		return true
	}

	http.Error(w, `{"error":"forbidden: only users with the fleet role can create or view vehicle handover records"}`, http.StatusForbidden)
	return false
}

// ─── Vehicle Sign-Out / Handover Handlers ────────────────────────────────────

// CreateVehicleSignout creates a new vehicle handover / signout record.
func (h *DispatchHandler) CreateVehicleSignout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !h.checkFleetRole(w, r) {
		return
	}

	var req models.CreateVehicleSignoutPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.UnitNumber) == "" {
		http.Error(w, `{"error":"unitNumber is required"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.EmployeeName) == "" {
		req.EmployeeName = "Assigned Driver"
	}

	user := auth.GetUser(r.Context())
	if req.CreatedBy == "" && user != nil {
		req.CreatedBy = user.Email
	}

	record, err := h.repo.CreateVehicleSignout(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to create vehicle signout: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// GetVehicleSignout retrieves a vehicle signout record by ID.
func (h *DispatchHandler) GetVehicleSignout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !h.checkFleetRole(w, r) {
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.GetVehicleSignoutByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"vehicle signout not found: `+err.Error()+`"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// ListVehicleSignouts lists vehicle handover records with optional filters.
func (h *DispatchHandler) ListVehicleSignouts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !h.checkFleetRole(w, r) {
		return
	}

	unitNumber := r.URL.Query().Get("unitNumber")
	employeeID := r.URL.Query().Get("employeeId")
	isSignInStr := r.URL.Query().Get("isSignIn")
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	timeRange := r.URL.Query().Get("timeRange")
	query := r.URL.Query().Get("query")
	if query == "" {
		query = r.URL.Query().Get("search")
	}

	var isSignIn *bool
	if isSignInStr != "" && isSignInStr != "all" {
		if b, err := strconv.ParseBool(isSignInStr); err == nil {
			isSignIn = &b
		}
	}

	records, err := h.repo.ListVehicleSignoutsFiltered(r.Context(), repository.VehicleSignoutFilter{
		UnitNumber: unitNumber,
		EmployeeID: employeeID,
		IsSignIn:   isSignIn,
		Query:      query,
		TimeRange:  timeRange,
		StartDate:  startDate,
		EndDate:    endDate,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to list vehicle signouts: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = []*models.VehicleSignout{}
	}
	json.NewEncoder(w).Encode(records)
}

// UpdateVehicleSignout updates an existing vehicle handover record.
func (h *DispatchHandler) UpdateVehicleSignout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !h.checkFleetRole(w, r) {
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateVehicleSignoutPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	record, err := h.repo.UpdateVehicleSignout(r.Context(), id, &req)
	if err != nil {
		http.Error(w, `{"error":"failed to update vehicle signout: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(record)
}

// DeleteVehicleSignout deletes a vehicle handover record.
func (h *DispatchHandler) DeleteVehicleSignout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !h.checkFleetRole(w, r) {
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteVehicleSignout(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete vehicle signout: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
