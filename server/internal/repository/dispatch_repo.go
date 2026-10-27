package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"math/rand"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/bigquery"
	"cloud.google.com/go/firestore"
	"dispatch-server/internal/models"
	"google.golang.org/api/iterator"
)

var (
	ErrDispatchShiftNotFound = errors.New("dispatch shift not found")
)

type DispatchFilter struct {
	Search        string
	RouteFilter   string
	DriverFilter  string
	StopFilter    string
	VehicleFilter string
	ShiftType     string
	Health        string
	NeedsAttention *bool
}

// TimeOffFilter contains criteria for querying time off requests with BigQuery cold archive support
type TimeOffFilter struct {
	EmployeeID     string
	Status         string
	Date           string
	StartDate      string
	EndDate        string
	IncludeArchive bool
	OnlyArchive    bool
	FullArchive    bool
}

type DispatchRepository interface {
	CreateDay(ctx context.Context, date string, routeNoFilter []string) (*models.CreateDispatchDayResult, error)
	DeleteDay(ctx context.Context, date string) error
	ListShifts(ctx context.Context, date string, filter DispatchFilter) ([]*models.DispatchShift, error)
	GetShiftByID(ctx context.Context, id string) (*models.DispatchShift, error)
	UpdateShift(ctx context.Context, id string, req *models.UpdateDispatchShiftRequest) (*models.DispatchShift, error)
	RecordStopArrival(ctx context.Context, shiftID string, stopID int, arrivalTime string) (*models.DispatchShift, error)
	CheckInDriver(ctx context.Context, shiftID string, req *models.DriverCheckInRequest) (*models.DispatchShift, error)
	MarkDriverReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error
	MarkAttendantReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error
	MarkPretripReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error
	UpdateStudentStatus(ctx context.Context, shiftID string, stopID int, studentID int, isPresent *bool, pickupTime *string, dropoffTime *string, actualArrivalTime *string, status *string, dropoffStatus *string, absenceReason *string, reportedBy *string) (*models.DispatchShift, error)
	RecordStudentAbsence(ctx context.Context, req *models.RecordStudentAbsenceRequest) (*models.RecordStudentAbsenceResponse, error)
	ListStudentAbsences(ctx context.Context, filter models.ListStudentAbsencesFilter) ([]*models.StudentAbsenceRecord, error)
	CancelStudentAbsence(ctx context.Context, id string, cancelledBy string) error
	SplitShift(ctx context.Context, shiftID string, req *models.SplitDispatchShiftRequest) ([]*models.DispatchShift, error)
	GetPayrollSettings(ctx context.Context) (*models.DispatchPayrollSettings, error)
	SavePayrollSettings(ctx context.Context, settings *models.DispatchPayrollSettings) (*models.DispatchPayrollSettings, error)
	GetCheckInReminderSettings(ctx context.Context) (*models.CheckInReminderSettings, error)
	SaveCheckInReminderSettings(ctx context.Context, settings *models.CheckInReminderSettings) (*models.CheckInReminderSettings, error)
	GetSimulationSettings(ctx context.Context) (*models.SimulationSettings, error)
	SaveSimulationSettings(ctx context.Context, settings *models.SimulationSettings) (*models.SimulationSettings, error)
	RunSimulationForDate(ctx context.Context, date string, forceOverwrite bool) (*models.SimulationRunResult, error)
	AddChangeLog(ctx context.Context, log *models.DispatchChangeLog) (*models.DispatchChangeLog, error)
	ListChangeLogs(ctx context.Context, date string) ([]*models.DispatchChangeLog, error)
	ListSystemAuditLogs(ctx context.Context, collectionName string, startDate, endDate string) ([]map[string]interface{}, error)
	GenerateDispatchPayroll(ctx context.Context, shiftID string, role string, checkInTime string) (*models.DispatchPayrollRecord, error)
	DeleteDispatchPayroll(ctx context.Context, shiftID string, role string) error
	ListDispatchPayrolls(ctx context.Context, date string) ([]*models.DispatchPayrollRecord, error)
	CheckOutCrew(ctx context.Context, shiftID string, req *models.CrewCheckOutRequest) (*models.DispatchShift, error)
	ApproveDispatchPayroll(ctx context.Context, payrollID string, req *models.ApproveDispatchPayrollRequest) (*models.DispatchPayrollRecord, error)
	RejectDispatchPayroll(ctx context.Context, payrollID string, req *models.RejectDispatchPayrollRequest) (*models.DispatchPayrollRecord, error)
	SyncToPayrollLog(ctx context.Context, payrollRecord *models.DispatchPayrollRecord) (*models.PayrollDepartmentLogRecord, error)
	RemoveFromPayrollLog(ctx context.Context, dispatchPayrollID string) error
	SyncCleanPayrollsForDate(ctx context.Context, date string) (int, error)
	ListPayrollDepartmentLogs(ctx context.Context, date string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error)
	ListPayrollDepartmentLogsRange(ctx context.Context, startDate string, endDate string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error)
	UpdatePayrollDepartmentLog(ctx context.Context, logID string, req *models.UpdatePayrollDepartmentLogRequest) (*models.PayrollDepartmentLogRecord, error)
	ListTemporaryAssignments(ctx context.Context, routeID string, date string, status string) ([]*models.TemporaryAssignment, error)
	GetTemporaryAssignmentByID(ctx context.Context, id string) (*models.TemporaryAssignment, error)
	CreateTemporaryAssignment(ctx context.Context, req *models.CreateTemporaryAssignmentRequest) (*models.TemporaryAssignment, error)
	UpdateTemporaryAssignment(ctx context.Context, id string, req *models.UpdateTemporaryAssignmentRequest) (*models.TemporaryAssignment, error)
	DeleteTemporaryAssignment(ctx context.Context, id string) error
	ListTimeOffRequests(ctx context.Context, employeeID string, status string, date string) ([]*models.TimeOffRequest, error)
	ListTimeOffRequestsFiltered(ctx context.Context, filter TimeOffFilter) ([]*models.TimeOffRequest, error)
	GetTimeOffRequestByID(ctx context.Context, id string) (*models.TimeOffRequest, error)
	CreateTimeOffRequest(ctx context.Context, req *models.CreateTimeOffRequestPayload) (*models.TimeOffRequest, error)
	UpdateTimeOffRequest(ctx context.Context, id string, req *models.UpdateTimeOffRequestPayload) (*models.TimeOffRequest, error)
	ApproveTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error)
	RejectTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error)
	CancelTimeOffRequest(ctx context.Context, id string, userID string) (*models.TimeOffRequest, error)
	DeleteTimeOffRequest(ctx context.Context, id string) error

	// Training Courses & Types
	ListTrainingCourses(ctx context.Context, status string, trainingType string, date string) ([]*models.TrainingCourse, error)
	GetTrainingCourseByID(ctx context.Context, id string) (*models.TrainingCourse, error)
	CreateTrainingCourse(ctx context.Context, req *models.CreateTrainingCoursePayload) (*models.TrainingCourse, error)
	UpdateTrainingCourse(ctx context.Context, id string, req *models.UpdateTrainingCoursePayload) (*models.TrainingCourse, error)
	PublishTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error)
	CancelTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error)
	CompleteTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error)
	DeleteTrainingCourse(ctx context.Context, id string) error
	RegisterAttendee(ctx context.Context, courseID string, req *models.RegisterAttendeePayload) (*models.TrainingCourse, error)
	UpdateAttendeeStatus(ctx context.Context, courseID string, registrationID string, req *models.UpdateAttendeeStatusPayload) (*models.TrainingCourse, error)
	CancelRegistration(ctx context.Context, courseID string, registrationID string) (*models.TrainingCourse, error)

	ListTrainingTypes(ctx context.Context) ([]*models.TrainingType, error)
	CreateTrainingType(ctx context.Context, t *models.TrainingType) (*models.TrainingType, error)
	UpdateTrainingType(ctx context.Context, id string, t *models.TrainingType) (*models.TrainingType, error)

	// Pre-Trip Inspections
	CreatePreTripInspection(ctx context.Context, req *models.CreatePreTripInspectionPayload) (*models.PreTripInspection, error)
	GetPreTripInspectionToday(ctx context.Context, vehicleUnit string, date string) (*models.PreTripInspection, error)
	ListPreTripInspections(ctx context.Context, date string, vehicleUnit string) ([]*models.PreTripInspection, error)

	// Vehicle Defect Reports
	CreateDefectReport(ctx context.Context, req *models.CreateDefectReportPayload) (*models.VehicleDefectReport, error)
	GetDefectReportByID(ctx context.Context, id string) (*models.VehicleDefectReport, error)
	ListDefectReports(ctx context.Context, vehicleUnit string, status string, driverID string) ([]*models.VehicleDefectReport, error)
	UpdateDefectAssessment(ctx context.Context, id string, req *models.UpdateDefectAssessmentPayload) (*models.VehicleDefectReport, error)
	UpdateDefectStatus(ctx context.Context, id string, status string) (*models.VehicleDefectReport, error)

	// Student Incident Reports
	CreateStudentIncident(ctx context.Context, req *models.CreateStudentIncidentPayload) (*models.StudentIncident, error)
	GetStudentIncidentByID(ctx context.Context, id string) (*models.StudentIncident, error)
	ListStudentIncidents(ctx context.Context, studentID int, routeNo string, driverID string, status string, needsFollowUp bool) ([]*models.StudentIncident, error)
	UpdateStudentIncidentOfficeFollowUp(ctx context.Context, id string, req *models.UpdateIncidentOfficeFollowUpPayload) (*models.StudentIncident, error)
	UpdateStudentIncidentStatus(ctx context.Context, id string, status string) (*models.StudentIncident, error)

	// Expense Reimbursements
	ListExpenseCategories(ctx context.Context) ([]*models.ExpenseCategory, error)
	CreateExpenseClaim(ctx context.Context, req *models.CreateExpenseClaimPayload) (*models.ExpenseReimbursement, error)
	GetExpenseClaimByID(ctx context.Context, id string) (*models.ExpenseReimbursement, error)
	ListExpenseClaims(ctx context.Context, employeeID string, status string) ([]*models.ExpenseReimbursement, error)
	ReviewExpenseClaim(ctx context.Context, id string, req *models.ReviewExpenseClaimPayload) (*models.ExpenseReimbursement, error)
	CancelExpenseClaim(ctx context.Context, id string, employeeID string) (*models.ExpenseReimbursement, error)

	// Hazard & Near-Miss Reports
	CreateHazardReport(ctx context.Context, req *models.CreateHazardReportPayload) (*models.HazardReport, error)
	GetHazardReportByID(ctx context.Context, id string) (*models.HazardReport, error)
	ListHazardReports(ctx context.Context, reportedByEmployeeID string, statusInt *int, officeHazardType string) ([]*models.HazardReport, error)
	UpdateHazardReportOffice(ctx context.Context, id string, req *models.UpdateHazardReportOfficePayload) (*models.HazardReport, error)

	// Route Assessments
	CreateRouteAssessment(ctx context.Context, req *models.CreateRouteAssessmentPayload) (*models.RouteAssessment, error)
	GetRouteAssessmentByID(ctx context.Context, id string) (*models.RouteAssessment, error)
	ListRouteAssessments(ctx context.Context, routeID string, employeeID string, statusInt *int, assessmentType string) ([]*models.RouteAssessment, error)
	UpdateRouteAssessmentOffice(ctx context.Context, id string, req *models.UpdateRouteAssessmentOfficePayload) (*models.RouteAssessment, error)
	UpdateRouteAssessment(ctx context.Context, id string, req *models.UpdateRouteAssessmentPayload) (*models.RouteAssessment, error)
	DeleteRouteAssessment(ctx context.Context, id string) error

	// Vehicle Sign-Outs / Handovers
	CreateVehicleSignout(ctx context.Context, req *models.CreateVehicleSignoutPayload) (*models.VehicleSignout, error)
	GetVehicleSignoutByID(ctx context.Context, id string) (*models.VehicleSignout, error)
	ListVehicleSignouts(ctx context.Context, unitNumber, employeeID string, isSignIn *bool, startDate, endDate string) ([]*models.VehicleSignout, error)
	UpdateVehicleSignout(ctx context.Context, id string, req *models.UpdateVehicleSignoutPayload) (*models.VehicleSignout, error)
	DeleteVehicleSignout(ctx context.Context, id string) error
}

type FirestoreDispatchRepository struct {
	client                  *firestore.Client
	bqClient                *bigquery.Client
	projectID               string
	bqDataset               string
	coldDays                int
	dispatchColl            string
	routeColl               string
	shiftColl               string
	calendarColl            string
	payrollSettingsColl     string
	logColl                 string
	dispatchPayrollColl     string
	payrollLogColl          string
	temporaryAssignmentColl string
	timeOffColl             string
	trainingCoursesColl     string
	trainingTypesColl       string
	pretripColl             string
	defectColl              string
	studentIncidentColl     string
	expenseReimbursementColl string
	expenseCategoryColl      string
	hazardReportColl        string
	routeAssessmentColl     string
	vehicleSignoutColl      string
	vehicleColl             string
}

func NewFirestoreDispatchRepository(client *firestore.Client) *FirestoreDispatchRepository {
	return &FirestoreDispatchRepository{
		client:                   client,
		coldDays:                 60,
		bqDataset:                "firestore_export",
		dispatchColl:             "dispatch_shifts",
		routeColl:                "routes",
		shiftColl:                "route_shifts",
		calendarColl:             "calendars",
		payrollSettingsColl:      "dispatch_payroll_settings",
		logColl:                  "dispatch_change_logs",
		dispatchPayrollColl:      "dispatch_payrolls",
		payrollLogColl:           "payroll_logs",
		temporaryAssignmentColl:  "temporary_assignments",
		timeOffColl:              "time_off_requests",
		trainingCoursesColl:      "training_courses",
		trainingTypesColl:        "training_types",
		pretripColl:              "pretrip_inspections",
		defectColl:               "vehicle_defects",
		studentIncidentColl:      "student_incidents",
		expenseReimbursementColl: "expense_reimbursements",
		expenseCategoryColl:      "expense_categories",
		hazardReportColl:         "hazard_reports",
		routeAssessmentColl:      "route_assessments",
		vehicleSignoutColl:       "vehicle_signouts",
		vehicleColl:              "vehicles",
	}
}

// WithBigQuery configures BigQuery cold storage support for historical queries
func (r *FirestoreDispatchRepository) WithBigQuery(bqClient *bigquery.Client, projectID, bqDataset string, coldDays int) *FirestoreDispatchRepository {
	r.bqClient = bqClient
	r.projectID = projectID
	if bqDataset != "" {
		r.bqDataset = bqDataset
	}
	if coldDays > 0 {
		r.coldDays = coldDays
	}
	return r
}

// isColdDate checks if target date is older than configured coldDays retention
func (r *FirestoreDispatchRepository) isColdDate(dateStr string) bool {
	if dateStr == "" || r.bqClient == nil {
		return false
	}
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return false
	}
	days := r.coldDays
	if days <= 0 {
		days = 60
	}
	cutoff := time.Now().AddDate(0, 0, -days)
	return t.Before(cutoff)
}

// isLogColdDate checks if target date is older than 7 days retention for app logs
func (r *FirestoreDispatchRepository) isLogColdDate(dateStr string) bool {
	if dateStr == "" || r.bqClient == nil {
		return false
	}
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return false
	}
	cutoff := time.Now().AddDate(0, 0, -7)
	return t.Before(cutoff)
}

// isTimeOffColdDate checks if target date is older than 30 days retention for time-off requests
func (r *FirestoreDispatchRepository) isTimeOffColdDate(dateStr string) bool {
	if dateStr == "" || r.bqClient == nil {
		return false
	}
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return false
	}
	cutoff := time.Now().AddDate(0, 0, -30)
	return t.Before(cutoff)
}

// Helper to check if a temporary assignment is active on a given date
func isTemporaryAssignmentActiveOnDate(date string, ta *models.TemporaryAssignment) bool {
	if ta.Status != "" && ta.Status != "active" {
		return false
	}
	if len(ta.SpecificDates) > 0 {
		for _, d := range ta.SpecificDates {
			if d == date {
				return true
			}
		}
		return false
	}
	if ta.StartDate != "" && date < ta.StartDate {
		return false
	}
	if ta.EndDate != "" && date > ta.EndDate {
		return false
	}
	return true
}

type routeOpeningAwardDoc struct {
	ID                    string `firestore:"id"`
	RouteID               string `firestore:"routeId"`
	RouteNo               string `firestore:"routeNo"`
	PostingType           string `firestore:"postingType"`
	ShiftType             string `firestore:"shiftType"`
	EffectiveStartDate    string `firestore:"effectiveStartDate"`
	Status                string `firestore:"status"`
	AwardedDriverID       string `firestore:"awardedDriverId"`
	AwardedDriverName     string `firestore:"awardedDriverName"`
	AwardedDriverPhone    string `firestore:"awardedDriverPhone"`
	AwardedAttendantID    string `firestore:"awardedAttendantId"`
	AwardedAttendantName  string `firestore:"awardedAttendantName"`
	AwardedAttendantPhone string `firestore:"awardedAttendantPhone"`
	CrewAppliedToRoute    bool   `firestore:"crewAppliedToRoute"`
}

// Helper to find all matching temporary assignments for a given route and shift
func findMatchingTemporaryAssignments(assignments []*models.TemporaryAssignment, routeID, routeNo, shiftType, shiftID string) []*models.TemporaryAssignment {
	upperShift := strings.ToUpper(strings.TrimSpace(shiftType))
	var matched []*models.TemporaryAssignment
	for _, ta := range assignments {
		routeMatch := (ta.RouteID != "" && (ta.RouteID == routeID || "RT-"+ta.RouteID == routeID)) ||
			(ta.RouteNo != "" && strings.EqualFold(strings.TrimSpace(ta.RouteNo), strings.TrimSpace(routeNo)))
		if !routeMatch {
			continue
		}
		if ta.BusRouteShiftID != "" && shiftID != "" && ta.BusRouteShiftID == shiftID {
			matched = append(matched, ta)
			continue
		}
		taShift := strings.ToUpper(strings.TrimSpace(ta.ShiftType))
		if taShift == "" || taShift == "ALL" || taShift == upperShift {
			matched = append(matched, ta)
		}
	}
	return matched
}

// Helper to find matching permanent route opening awards effective on or before target date
func findMatchingPermanentOpenings(openings []*routeOpeningAwardDoc, routeID, routeNo, shiftType string) []*routeOpeningAwardDoc {
	upperShift := strings.ToUpper(strings.TrimSpace(shiftType))
	var matched []*routeOpeningAwardDoc
	for _, op := range openings {
		routeMatch := (op.RouteID != "" && (op.RouteID == routeID || "RT-"+op.RouteID == routeID)) ||
			(op.RouteNo != "" && strings.EqualFold(strings.TrimSpace(op.RouteNo), strings.TrimSpace(routeNo)))
		if !routeMatch {
			continue
		}
		opShift := strings.ToUpper(strings.TrimSpace(op.ShiftType))
		if opShift == "" || opShift == "ALL" || opShift == upperShift {
			matched = append(matched, op)
		}
	}
	return matched
}

// Helper to determine weekday character code
func getWeekdayCode(dateStr string) (string, error) {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return "", err
	}
	switch t.Weekday() {
	case time.Monday:
		return "M", nil
	case time.Tuesday:
		return "T", nil
	case time.Wednesday:
		return "W", nil
	case time.Thursday:
		return "R", nil
	case time.Friday:
		return "F", nil
	default:
		return "", nil // Weekend
	}
}

// Helper to calculate minutes between two HH:MM strings
func calculateMinutesDiff(actual, scheduled string) int {
	actualParts := strings.Split(actual, ":")
	schedParts := strings.Split(scheduled, ":")
	if len(actualParts) < 2 || len(schedParts) < 2 {
		return 0
	}
	aH, _ := strconv.Atoi(actualParts[0])
	aM, _ := strconv.Atoi(actualParts[1])
	sH, _ := strconv.Atoi(schedParts[0])
	sM, _ := strconv.Atoi(schedParts[1])

	diff := (aH*60 + aM) - (sH*60 + sM)
	if diff < 0 {
		return 0
	}
	return diff
}

// Helper to subtract minutes from HH:MM string (e.g. 60 mins before 07:30 -> 06:30)
func subtractMinutesFromTime(tStr string, mins int) string {
	if len(tStr) < 5 {
		return tStr
	}
	parts := strings.Split(tStr, ":")
	if len(parts) < 2 {
		return tStr
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return tStr
	}
	total := h*60 + m - mins
	if total < 0 {
		total += 24 * 60
	}
	return fmt.Sprintf("%02d:%02d", (total/60)%24, total%60)
}

func (r *FirestoreDispatchRepository) CreateDay(ctx context.Context, date string, routeNoFilter []string) (*models.CreateDispatchDayResult, error) {
	weekdayCode, err := getWeekdayCode(date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %v", err)
	}
	if weekdayCode == "" {
		return &models.CreateDispatchDayResult{
			Date:    date,
			Created: 0,
			Message: "The selected date is on a weekend with no regular school shifts scheduled.",
		}, nil
	}

	// 1. Fetch Calendar events to identify closed schools / boards (holiday, PD day, break)
	closedSchools := make(map[int]bool)
	closedBoards := make(map[int]bool)

	calIter := r.client.Collection(r.calendarColl).Documents(ctx)
	for {
		doc, err := calIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var cal models.SchoolCalendar
		if err := doc.DataTo(&cal); err != nil {
			continue
		}
		for _, evt := range cal.Events {
			if evt.Type == models.EventTypeHoliday || evt.Type == models.EventTypePDDay || evt.Type == models.EventTypeBreak {
				isApplicable := false
				if evt.EndDate != "" {
					if date >= evt.StartDate && date <= evt.EndDate {
						isApplicable = true
					}
				} else {
					if date == evt.StartDate {
						isApplicable = true
					}
				}

				if isApplicable {
					if cal.SchoolID != nil && *cal.SchoolID > 0 {
						closedSchools[*cal.SchoolID] = true
					} else if cal.BoardID > 0 {
						closedBoards[cal.BoardID] = true
					}
				}
			}
		}
	}
	calIter.Stop()

	// 2. Pre-check existing dispatch shifts for target date
	existingIter := r.client.Collection(r.dispatchColl).Where("dispatchDate", "==", date).Documents(ctx)
	existingIDs := make(map[string]bool)
	for {
		doc, err := existingIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		existingIDs[doc.Ref.ID] = true
	}
	existingIter.Stop()

	// 2.5 Query active temporary assignments covering target date
	var activeTempAssignments []*models.TemporaryAssignment
	taIter := r.client.Collection(r.temporaryAssignmentColl).Where("status", "==", "active").Documents(ctx)
	for {
		doc, err := taIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var ta models.TemporaryAssignment
		if err := doc.DataTo(&ta); err == nil {
			if ta.ID == "" {
				ta.ID = doc.Ref.ID
			}
			if isTemporaryAssignmentActiveOnDate(date, &ta) {
				activeTempAssignments = append(activeTempAssignments, &ta)
			}
		}
	}
	taIter.Stop()

	// 2.6 Query awarded permanent route openings effective on or before target date (or today)
	var effectivePermOpenings []*routeOpeningAwardDoc
	todayStr := time.Now().Format("2006-01-02")
	nowIso := time.Now().UTC().Format(time.RFC3339)
	roIter := r.client.Collection("route_openings").Where("status", "==", "awarded").Documents(ctx)
	for {
		doc, err := roIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var op routeOpeningAwardDoc
		if err := doc.DataTo(&op); err == nil {
			if op.ID == "" {
				op.ID = doc.Ref.ID
			}
			if op.PostingType != "permanent" {
				continue
			}
			// If effectiveStartDate <= todayStr and not yet applied to route/route_shifts, apply it automatically
			if !op.CrewAppliedToRoute && (op.EffectiveStartDate == "" || op.EffectiveStartDate <= todayStr) {
				r.applyPermanentOpeningToRouteFirestore(ctx, &op, nowIso)
			}
			if op.EffectiveStartDate == "" || op.EffectiveStartDate <= date {
				effectivePermOpenings = append(effectivePermOpenings, &op)
			}
		}
	}
	roIter.Stop()

	// 3. Query active bus routes
	routeQuery := r.client.Collection(r.routeColl).Where("active", "==", true)
	routeIter := routeQuery.Documents(ctx)
	defer routeIter.Stop()

	var candidateRoutes []*models.BusRoute
	routeFilterSet := make(map[string]bool)
	for _, rf := range routeNoFilter {
		if strings.TrimSpace(rf) != "" {
			routeFilterSet[strings.ToUpper(strings.TrimSpace(rf))] = true
		}
	}

	for {
		doc, err := routeIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rt models.BusRoute
		if err := doc.DataTo(&rt); err != nil {
			continue
		}
		rt.ID = doc.Ref.ID

		if len(routeFilterSet) > 0 && !routeFilterSet[strings.ToUpper(rt.RouteNo)] {
			continue
		}
		candidateRoutes = append(candidateRoutes, &rt)
	}

	createdCount := 0
	skippedExisting := 0
	eligibleCount := 0
	now := time.Now().UTC().Format(time.RFC3339)

	// 3b. Build unavailable vehicles map for target date (active Vehicle Defects & Periodic Inspections)
	unavailableVehicles := r.getUnavailableVehiclesForDate(ctx, date)

	// 4. Process each candidate route
	for _, rt := range candidateRoutes {
		// Fetch operational shifts for route
		shiftIter := r.client.Collection(r.shiftColl).Where("routeId", "==", rt.ID).Documents(ctx)
		var validShifts []*models.BusRouteShift

		for {
			sDoc, sErr := shiftIter.Next()
			if sErr == iterator.Done {
				break
			}
			if sErr != nil {
				break
			}
			var s models.BusRouteShift
			if err := sDoc.DataTo(&s); err != nil {
				continue
			}
			s.ID = sDoc.Ref.ID

			// Active check
			if s.Active != nil && !*s.Active {
				continue
			}
			// Shift date range check
			if s.EffectiveDate != nil && *s.EffectiveDate != "" && date < *s.EffectiveDate {
				continue
			}
			if s.RetireDate != nil && *s.RetireDate != "" && date > *s.RetireDate {
				continue
			}
			// Day of week check (RunDays contains weekdayCode e.g. "F")
			if s.RunDays != "" && !strings.Contains(strings.ToUpper(s.RunDays), weekdayCode) {
				continue
			}

			// Filter stops on shift
			var activeStops []models.RouteStop
			for _, st := range s.Stops {
				// Stop date check
				if st.EffectiveDate != nil && *st.EffectiveDate != "" && date < *st.EffectiveDate {
					continue
				}
				if st.RetireDate != nil && *st.RetireDate != "" && date > *st.RetireDate {
					continue
				}
				// Stop school closed check
				if st.SchoolID != nil && closedSchools[*st.SchoolID] {
					continue
				}
				if rt.SchoolBoardID > 0 && closedBoards[rt.SchoolBoardID] && (st.SchoolID == nil || closedSchools[*st.SchoolID]) {
					continue
				}

				// Filter students whose school is closed
				var activeStudents []models.StopStudent
				for _, stu := range st.AssignedStudents {
					activeStudents = append(activeStudents, stu)
				}
				st.AssignedStudents = activeStudents

				activeStops = append(activeStops, st)
			}

			if len(activeStops) > 0 {
				s.Stops = activeStops
				validShifts = append(validShifts, &s)
			}
		}
		shiftIter.Stop()

		if len(validShifts) == 0 {
			continue
		}

		autoMarryup := rt.AutoMarryup == nil || *rt.AutoMarryup

		if autoMarryup {
			// Group shifts by shiftType (e.g. "AM", "PM")
			shiftsByType := make(map[string][]*models.BusRouteShift)
			for _, s := range validShifts {
				st := strings.ToUpper(strings.TrimSpace(s.ShiftType))
				shiftsByType[st] = append(shiftsByType[st], s)
			}

			for shiftType, sGroup := range shiftsByType {
				eligibleCount++
				dispatchID := fmt.Sprintf("DS-%s-%s-%s", date, rt.RouteNo, shiftType)
				primaryShift := sGroup[0]

				if existingIDs[dispatchID] {
					r.syncExistingDispatchWithCoversAndOpenings(ctx, dispatchID, rt.ID, rt.RouteNo, shiftType, primaryShift.ID, effectivePermOpenings, activeTempAssignments, unavailableVehicles, now)
					skippedExisting++
					continue
				}

				// Combine and sort stops
				var allStops []models.DispatchShiftStop
				var mergedIDs []string

				for _, s := range sGroup {
					mergedIDs = append(mergedIDs, s.ID)
					for _, st := range s.Stops {
						var students []models.DispatchShiftStopStudent
						for _, stu := range st.AssignedStudents {
							students = append(students, models.DispatchShiftStopStudent{
								StudentID:   stu.StudentID,
								StudentNo:   stu.StudentNo,
								StudentName: stu.StudentName,
								SchoolName:  stu.SchoolName,
							})
						}

						allStops = append(allStops, models.DispatchShiftStop{
							StopID:           st.StopID,
							StopLocation:     st.StopLocation,
							StopScheduleTime: st.PullawayTime,
							StopType:         st.StopType,
							SchoolID:         st.SchoolID,
							SchoolName:       st.SchoolName,
							AssignedStudents: students,
						})
					}
				}

				// Sort stops chronologically by schedule time
				sort.SliceStable(allStops, func(i, j int) bool {
					return allStops[i].StopScheduleTime < allStops[j].StopScheduleTime
				})
				for i := range allStops {
					allStops[i].Sequence = i + 1
				}

				// Determine crew
				driverID := primaryShift.DriverID
				driverName := primaryShift.DriverName
				driverPhone := primaryShift.DriverPhone
				vehicleID := primaryShift.VehicleID
				unitNumber := primaryShift.UnitNumber
				plateNumber := primaryShift.PlateNumber
				attendantID := primaryShift.AttendantID
				attendantName := primaryShift.AttendantName
				attendantPhone := primaryShift.AttendantPhone

				if driverName == "" {
					driverID = rt.DriverID
					driverName = rt.DriverName
					driverPhone = rt.DriverPhone
				}
				if unitNumber == "" {
					vehicleID = rt.VehicleID
					unitNumber = rt.UnitNumber
					plateNumber = rt.PlateNumber
				}
				if attendantName == "" {
					attendantID = rt.AttendantID
					attendantName = rt.AttendantName
					attendantPhone = rt.AttendantPhone
				}

				// Priority 2: Apply awarded permanent route openings effective on or before target date
				for _, op := range findMatchingPermanentOpenings(effectivePermOpenings, rt.ID, rt.RouteNo, shiftType) {
					if op.AwardedDriverName != "" {
						driverID = op.AwardedDriverID
						driverName = op.AwardedDriverName
						if op.AwardedDriverPhone != "" {
							driverPhone = op.AwardedDriverPhone
						}
					}
					if op.AwardedAttendantName != "" {
						attendantID = op.AwardedAttendantID
						attendantName = op.AwardedAttendantName
						if op.AwardedAttendantPhone != "" {
							attendantPhone = op.AwardedAttendantPhone
						}
					}
				}

				// Priority 1: Check temporary assignments for this date (highest priority override)
				isTempDriver := false
				isTempAttendant := false
				isTempVehicle := false
				tempAssignmentID := ""

				for _, ta := range findMatchingTemporaryAssignments(activeTempAssignments, rt.ID, rt.RouteNo, shiftType, primaryShift.ID) {
					tempAssignmentID = ta.ID
					if ta.TemporaryDriverName != "" {
						driverID = ta.TemporaryDriverID
						driverName = ta.TemporaryDriverName
						driverPhone = ta.TemporaryDriverPhone
						isTempDriver = true
					}
					if ta.TemporaryAttendantName != "" {
						attendantID = ta.TemporaryAttendantID
						attendantName = ta.TemporaryAttendantName
						attendantPhone = ta.TemporaryAttendantPhone
						isTempAttendant = true
					}
					if ta.TemporaryUnitNumber != "" {
						vehicleID = ta.TemporaryVehicleID
						unitNumber = ta.TemporaryUnitNumber
						plateNumber = ta.TemporaryPlateNumber
						isTempVehicle = true
					}
				}

				// Exclude vehicles undergoing Vehicle Defect repair or Periodic Inspection on this date
				if isVehicleUnavailableInMap(unavailableVehicles, unitNumber, vehicleID) {
					vehicleID = 0
					unitNumber = ""
					plateNumber = ""
					isTempVehicle = false
				}

				health := models.HealthGreen
				if driverName == "" || unitNumber == "" {
					health = models.HealthRed
				}

				firstTime := ""
				lastTime := ""
				if len(allStops) > 0 {
					firstTime = allStops[0].StopScheduleTime
					lastTime = allStops[len(allStops)-1].StopScheduleTime
				}

				ds := models.DispatchShift{
					ID:                    dispatchID,
					DispatchDate:          date,
					RouteID:               rt.ID,
					RouteNo:               rt.RouteNo,
					RouteName:             rt.RouteName,
					ShiftType:             shiftType,
					BusRouteShiftID:       primaryShift.ID,
					MergedShiftIDs:        mergedIDs,
					DriverID:              driverID,
					DriverName:            driverName,
					DriverPhone:           driverPhone,
					VehicleID:             vehicleID,
					UnitNumber:            unitNumber,
					PlateNumber:           plateNumber,
					AttendantID:           attendantID,
					AttendantName:         attendantName,
					AttendantPhone:        attendantPhone,
					IsTemporaryDriver:     isTempDriver,
					IsTemporaryAttendant:  isTempAttendant,
					IsTemporaryVehicle:    isTempVehicle,
					TemporaryAssignmentID: tempAssignmentID,
					YardID:          rt.YardID,
					YardName:        rt.YardName,
					SchoolBoardID:   rt.SchoolBoardID,
					SchoolBoardCode: rt.SchoolBoardCode,
					FirstStopTime:   firstTime,
					LastStopTime:    lastTime,
					TotalStops:      len(allStops),
					CompletedStops:  0,
					LateMinutes:     0,
					Health:               health,
					IsDryRun:             false,
					ScheduledCheckInTime: subtractMinutesFromTime(firstTime, 60),
					IsDriverCheckedIn:    false,
					Stops:                allStops,
					CreatedAt:            now,
					UpdatedAt:            now,
				}
				ds.AssignedEmployeeIds = ds.ComputeAssignedEmployeeIds()

				if _, err := r.client.Collection(r.dispatchColl).Doc(dispatchID).Set(ctx, ds); err == nil {
					createdCount++
				}
			}
		} else {
			// Separate dispatch shift per route shift
			for _, s := range validShifts {
				eligibleCount++
				dispatchID := fmt.Sprintf("DS-%s-%s", date, s.ID)

				if existingIDs[dispatchID] {
					r.syncExistingDispatchWithCoversAndOpenings(ctx, dispatchID, rt.ID, rt.RouteNo, s.ShiftType, s.ID, effectivePermOpenings, activeTempAssignments, unavailableVehicles, now)
					skippedExisting++
					continue
				}

				var allStops []models.DispatchShiftStop
				for _, st := range s.Stops {
					var students []models.DispatchShiftStopStudent
					for _, stu := range st.AssignedStudents {
						students = append(students, models.DispatchShiftStopStudent{
							StudentID:   stu.StudentID,
							StudentNo:   stu.StudentNo,
							StudentName: stu.StudentName,
							SchoolName:  stu.SchoolName,
						})
					}

					allStops = append(allStops, models.DispatchShiftStop{
						StopID:           st.StopID,
						Sequence:         st.Sequence,
						StopLocation:     st.StopLocation,
						StopScheduleTime: st.PullawayTime,
						StopType:         st.StopType,
						SchoolID:         st.SchoolID,
						SchoolName:       st.SchoolName,
						AssignedStudents: students,
					})
				}

				driverID := s.DriverID
				driverName := s.DriverName
				driverPhone := s.DriverPhone
				vehicleID := s.VehicleID
				unitNumber := s.UnitNumber
				plateNumber := s.PlateNumber
				attendantID := s.AttendantID
				attendantName := s.AttendantName
				attendantPhone := s.AttendantPhone

				if driverName == "" {
					driverID = rt.DriverID
					driverName = rt.DriverName
					driverPhone = rt.DriverPhone
				}
				if unitNumber == "" {
					vehicleID = rt.VehicleID
					unitNumber = rt.UnitNumber
					plateNumber = rt.PlateNumber
				}
				if attendantName == "" {
					attendantID = rt.AttendantID
					attendantName = rt.AttendantName
					attendantPhone = rt.AttendantPhone
				}

				// Priority 2: Apply awarded permanent route openings effective on or before target date
				for _, op := range findMatchingPermanentOpenings(effectivePermOpenings, rt.ID, rt.RouteNo, s.ShiftType) {
					if op.AwardedDriverName != "" {
						driverID = op.AwardedDriverID
						driverName = op.AwardedDriverName
						if op.AwardedDriverPhone != "" {
							driverPhone = op.AwardedDriverPhone
						}
					}
					if op.AwardedAttendantName != "" {
						attendantID = op.AwardedAttendantID
						attendantName = op.AwardedAttendantName
						if op.AwardedAttendantPhone != "" {
							attendantPhone = op.AwardedAttendantPhone
						}
					}
				}

				// Priority 1: Check temporary assignments for this date (highest priority override)
				isTempDriver := false
				isTempAttendant := false
				isTempVehicle := false
				tempAssignmentID := ""

				for _, ta := range findMatchingTemporaryAssignments(activeTempAssignments, rt.ID, rt.RouteNo, s.ShiftType, s.ID) {
					tempAssignmentID = ta.ID
					if ta.TemporaryDriverName != "" {
						driverID = ta.TemporaryDriverID
						driverName = ta.TemporaryDriverName
						driverPhone = ta.TemporaryDriverPhone
						isTempDriver = true
					}
					if ta.TemporaryAttendantName != "" {
						attendantID = ta.TemporaryAttendantID
						attendantName = ta.TemporaryAttendantName
						attendantPhone = ta.TemporaryAttendantPhone
						isTempAttendant = true
					}
					if ta.TemporaryUnitNumber != "" {
						vehicleID = ta.TemporaryVehicleID
						unitNumber = ta.TemporaryUnitNumber
						plateNumber = ta.TemporaryPlateNumber
						isTempVehicle = true
					}
				}

				// Exclude vehicles undergoing Vehicle Defect repair or Periodic Inspection on this date
				if isVehicleUnavailableInMap(unavailableVehicles, unitNumber, vehicleID) {
					vehicleID = 0
					unitNumber = ""
					plateNumber = ""
					isTempVehicle = false
				}

				health := models.HealthGreen
				if driverName == "" || unitNumber == "" {
					health = models.HealthRed
				}

				firstTime := ""
				lastTime := ""
				if len(allStops) > 0 {
					firstTime = allStops[0].StopScheduleTime
					lastTime = allStops[len(allStops)-1].StopScheduleTime
				}

				ds := models.DispatchShift{
					ID:                    dispatchID,
					DispatchDate:          date,
					RouteID:               rt.ID,
					RouteNo:               rt.RouteNo,
					RouteName:             rt.RouteName,
					ShiftType:             s.ShiftType,
					BusRouteShiftID:       s.ID,
					DriverID:              driverID,
					DriverName:            driverName,
					DriverPhone:           driverPhone,
					VehicleID:             vehicleID,
					UnitNumber:            unitNumber,
					PlateNumber:           plateNumber,
					AttendantID:           attendantID,
					AttendantName:         attendantName,
					AttendantPhone:        attendantPhone,
					IsTemporaryDriver:     isTempDriver,
					IsTemporaryAttendant:  isTempAttendant,
					IsTemporaryVehicle:    isTempVehicle,
					TemporaryAssignmentID: tempAssignmentID,
					YardID:          rt.YardID,
					YardName:        rt.YardName,
					SchoolBoardID:   rt.SchoolBoardID,
					SchoolBoardCode: rt.SchoolBoardCode,
					FirstStopTime:   firstTime,
					LastStopTime:    lastTime,
					TotalStops:      len(allStops),
					CompletedStops:  0,
					LateMinutes:     0,
					Health:               health,
					IsDryRun:             false,
					ScheduledCheckInTime: subtractMinutesFromTime(firstTime, 60),
					IsDriverCheckedIn:    false,
					Stops:                allStops,
					CreatedAt:            now,
					UpdatedAt:            now,
				}
				ds.AssignedEmployeeIds = ds.ComputeAssignedEmployeeIds()

				if _, err := r.client.Collection(r.dispatchColl).Doc(dispatchID).Set(ctx, ds); err == nil {
					createdCount++
				}
			}
		}
	}

	msg := fmt.Sprintf("Created %d dispatch shifts for %s (%d skipped existing).", createdCount, date, skippedExisting)
	if createdCount == 0 && skippedExisting == 0 {
		msg = fmt.Sprintf("No active route shifts were eligible for dispatch on %s.", date)
	}

	return &models.CreateDispatchDayResult{
		Date:            date,
		Created:         createdCount,
		Eligible:        eligibleCount,
		SkippedExisting: skippedExisting,
		Message:         msg,
	}, nil
}

// isVehicleUnavailableInMap checks if a vehicle's unitNumber or vehicleID is marked unavailable in the map.
func isVehicleUnavailableInMap(unavailable map[string]bool, unitNumber string, vehicleID int) bool {
	if len(unavailable) == 0 {
		return false
	}
	u := strings.ToUpper(strings.TrimSpace(unitNumber))
	if u != "" && unavailable["UNIT:"+u] {
		return true
	}
	if vehicleID > 0 && unavailable[fmt.Sprintf("ID:%d", vehicleID)] {
		return true
	}
	return false
}

// getUnavailableVehiclesForDate queries vehicle_defects, vehicle_inspections, and preventive_maintenance_records
// to identify vehicles that must be excluded from dispatch shifts on target date.
func (r *FirestoreDispatchRepository) getUnavailableVehiclesForDate(ctx context.Context, date string) map[string]bool {
	unavailable := make(map[string]bool)
	if date == "" {
		return unavailable
	}

	// 1. Check active Vehicle Defect Reports
	defectIter := r.client.Collection(r.defectColl).Documents(ctx)
	for {
		doc, err := defectIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var d models.VehicleDefectReport
		if err := doc.DataTo(&d); err != nil {
			continue
		}
		if d.NoDefectsFound || strings.EqualFold(d.Status, "resolved") {
			continue
		}
		startDate := d.ReportDate
		endDate := ""
		if d.Assessment != nil {
			if d.Assessment.EstimatedStartDate != "" {
				startDate = d.Assessment.EstimatedStartDate
			}
			if d.Assessment.ActualCompletionDate != "" {
				endDate = d.Assessment.ActualCompletionDate
			} else if d.Assessment.EstimatedCompletionDate != "" {
				endDate = d.Assessment.EstimatedCompletionDate
			}
		}
		isActiveOnDate := true
		if startDate != "" && endDate != "" {
			isActiveOnDate = date >= startDate && date <= endDate
		} else if startDate != "" {
			isActiveOnDate = date >= startDate
		}
		if isActiveOnDate {
			u := strings.ToUpper(strings.TrimSpace(d.VehicleUnitNumber))
			if u != "" {
				unavailable["UNIT:"+u] = true
			}
			if d.VehicleID > 0 {
				unavailable[fmt.Sprintf("ID:%d", d.VehicleID)] = true
			}
		}
	}
	defectIter.Stop()

	// 2. Check Periodic Sticker Inspections (vehicle_inspections)
	inspIter := r.client.Collection("vehicle_inspections").Documents(ctx)
	for {
		doc, err := inspIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		data := doc.Data()
		status, _ := data["inspectionStatus"].(string)
		if strings.EqualFold(status, "completed") {
			continue
		}
		inspDate, _ := data["inspectionDate"].(string)
		schedDate, _ := data["scheduledInspectionDate"].(string)
		isInInsp := strings.EqualFold(status, "in_inspection")
		if isInInsp || inspDate == date || schedDate == date {
			if unitStr, ok := data["vehicleUnit"].(string); ok {
				u := strings.ToUpper(strings.TrimSpace(unitStr))
				if u != "" {
					unavailable["UNIT:"+u] = true
				}
			}
			if vid, ok := data["vehicleId"].(int64); ok && vid > 0 {
				unavailable[fmt.Sprintf("ID:%d", vid)] = true
			}
		}
	}
	inspIter.Stop()

	// 3. Check Periodic Preventive Maintenance Records (preventive_maintenance_records)
	pmIter := r.client.Collection("preventive_maintenance_records").Documents(ctx)
	for {
		doc, err := pmIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		data := doc.Data()
		status, _ := data["maintenanceStatus"].(string)
		if strings.EqualFold(status, "completed") {
			continue
		}
		svcDate, _ := data["serviceDate"].(string)
		schedDate, _ := data["scheduledServiceDate"].(string)
		isInProg := strings.EqualFold(status, "in_progress")
		if isInProg || svcDate == date || schedDate == date {
			if unitStr, ok := data["vehicleUnit"].(string); ok {
				u := strings.ToUpper(strings.TrimSpace(unitStr))
				if u != "" {
					unavailable["UNIT:"+u] = true
				}
			}
			if vid, ok := data["vehicleId"].(int64); ok && vid > 0 {
				unavailable[fmt.Sprintf("ID:%d", vid)] = true
			}
		}
	}
	pmIter.Stop()

	return unavailable
}

// applyPermanentOpeningToRouteFirestore applies an awarded permanent route opening's crew
// to routes and route_shifts once effectiveStartDate has arrived, preserving existing vehicle & other crew fields.
func (r *FirestoreDispatchRepository) applyPermanentOpeningToRouteFirestore(ctx context.Context, op *routeOpeningAwardDoc, nowIso string) {
	if op == nil || op.PostingType != "permanent" {
		return
	}
	hasDriver := op.AwardedDriverName != "" || op.AwardedDriverID != ""
	hasAttendant := op.AwardedAttendantName != "" || op.AwardedAttendantID != ""
	if !hasDriver && !hasAttendant {
		return
	}

	routeDocID := op.RouteID
	var routeRef *firestore.DocumentRef
	if routeDocID != "" {
		ref := r.client.Collection(r.routeColl).Doc(routeDocID)
		if snap, err := ref.Get(ctx); err == nil && snap.Exists() {
			routeRef = ref
		} else if !strings.HasPrefix(routeDocID, "RT-") {
			altRef := r.client.Collection(r.routeColl).Doc("RT-" + routeDocID)
			if altSnap, altErr := altRef.Get(ctx); altErr == nil && altSnap.Exists() {
				routeRef = altRef
				routeDocID = altRef.ID
			}
		}
	}
	if routeRef == nil && op.RouteNo != "" {
		iter := r.client.Collection(r.routeColl).Where("routeNo", "==", op.RouteNo).Limit(1).Documents(ctx)
		if doc, err := iter.Next(); err == nil && doc != nil {
			routeRef = doc.Ref
			routeDocID = doc.Ref.ID
		}
		iter.Stop()
	}

	targetShift := strings.ToUpper(strings.TrimSpace(op.ShiftType))
	isAllShifts := targetShift == "" || targetShift == "ALL"

	if routeRef != nil && isAllShifts {
		var routeUpdates []firestore.Update
		if hasDriver {
			routeUpdates = append(routeUpdates,
				firestore.Update{Path: "driverId", Value: op.AwardedDriverID},
				firestore.Update{Path: "driverName", Value: op.AwardedDriverName},
				firestore.Update{Path: "driverPhone", Value: op.AwardedDriverPhone},
			)
		}
		if hasAttendant {
			routeUpdates = append(routeUpdates,
				firestore.Update{Path: "attendantId", Value: op.AwardedAttendantID},
				firestore.Update{Path: "attendantName", Value: op.AwardedAttendantName},
				firestore.Update{Path: "attendantPhone", Value: op.AwardedAttendantPhone},
			)
		}
		routeUpdates = append(routeUpdates, firestore.Update{Path: "updatedAt", Value: nowIso})
		_, _ = routeRef.Update(ctx, routeUpdates)
	}

	// Update matching route_shifts
	if routeDocID != "" {
		sIter := r.client.Collection(r.shiftColl).Where("routeId", "==", routeDocID).Documents(ctx)
		for {
			sDoc, err := sIter.Next()
			if err == iterator.Done || err != nil {
				break
			}
			var sh models.BusRouteShift
			if err := sDoc.DataTo(&sh); err != nil {
				continue
			}
			sType := strings.ToUpper(strings.TrimSpace(sh.ShiftType))
			if isAllShifts || sType == targetShift {
				var shUpdates []firestore.Update
				if hasDriver {
					shUpdates = append(shUpdates,
						firestore.Update{Path: "driverId", Value: op.AwardedDriverID},
						firestore.Update{Path: "driverName", Value: op.AwardedDriverName},
						firestore.Update{Path: "driverPhone", Value: op.AwardedDriverPhone},
					)
				}
				if hasAttendant {
					shUpdates = append(shUpdates,
						firestore.Update{Path: "attendantId", Value: op.AwardedAttendantID},
						firestore.Update{Path: "attendantName", Value: op.AwardedAttendantName},
						firestore.Update{Path: "attendantPhone", Value: op.AwardedAttendantPhone},
					)
				}
				if !isAllShifts {
					shUpdates = append(shUpdates, firestore.Update{Path: "isCustomCrew", Value: true})
				}
				shUpdates = append(shUpdates, firestore.Update{Path: "updatedAt", Value: nowIso})
				_, _ = sDoc.Ref.Update(ctx, shUpdates)
			}
		}
		sIter.Stop()
	}

	// Mark crewAppliedToRoute = true on route_openings document
	if op.ID != "" {
		_, _ = r.client.Collection("route_openings").Doc(op.ID).Update(ctx, []firestore.Update{
			{Path: "crewAppliedToRoute", Value: true},
			{Path: "crewAppliedAt", Value: nowIso},
			{Path: "updatedAt", Value: nowIso},
		})
		op.CrewAppliedToRoute = true
	}
}

// syncExistingDispatchWithCoversAndOpenings updates an already-existing dispatch shift on target date
// if there are effective permanent openings, active temporary assignments, or vehicle exclusions for that route/shift.
func (r *FirestoreDispatchRepository) syncExistingDispatchWithCoversAndOpenings(
	ctx context.Context,
	dispatchID, routeID, routeNo, shiftType, busRouteShiftID string,
	effectivePermOpenings []*routeOpeningAwardDoc,
	activeTempAssignments []*models.TemporaryAssignment,
	unavailableVehicles map[string]bool,
	nowIso string,
) {
	matchedPerm := findMatchingPermanentOpenings(effectivePermOpenings, routeID, routeNo, shiftType)
	matchedTemp := findMatchingTemporaryAssignments(activeTempAssignments, routeID, routeNo, shiftType, busRouteShiftID)
	if len(matchedPerm) == 0 && len(matchedTemp) == 0 && len(unavailableVehicles) == 0 {
		return
	}

	docRef := r.client.Collection(r.dispatchColl).Doc(dispatchID)
	snap, err := docRef.Get(ctx)
	if err != nil || !snap.Exists() {
		return
	}
	var ds models.DispatchShift
	if err := snap.DataTo(&ds); err != nil {
		return
	}

	var updates []firestore.Update
	finalDriverName := ds.DriverName
	finalUnitNumber := ds.UnitNumber
	finalVehicleID := ds.VehicleID

	// Apply permanent openings if not overridden by temporary cover
	for _, op := range matchedPerm {
		if op.AwardedDriverName != "" && !ds.IsTemporaryDriver {
			updates = append(updates,
				firestore.Update{Path: "driverId", Value: op.AwardedDriverID},
				firestore.Update{Path: "driverName", Value: op.AwardedDriverName},
				firestore.Update{Path: "driverPhone", Value: op.AwardedDriverPhone},
			)
			finalDriverName = op.AwardedDriverName
		}
		if op.AwardedAttendantName != "" && !ds.IsTemporaryAttendant {
			updates = append(updates,
				firestore.Update{Path: "attendantId", Value: op.AwardedAttendantID},
				firestore.Update{Path: "attendantName", Value: op.AwardedAttendantName},
				firestore.Update{Path: "attendantPhone", Value: op.AwardedAttendantPhone},
			)
		}
	}

	// Apply temporary assignments (highest priority)
	for _, ta := range matchedTemp {
		updates = append(updates, firestore.Update{Path: "temporaryAssignmentId", Value: ta.ID})
		if ta.TemporaryDriverName != "" {
			updates = append(updates,
				firestore.Update{Path: "driverId", Value: ta.TemporaryDriverID},
				firestore.Update{Path: "driverName", Value: ta.TemporaryDriverName},
				firestore.Update{Path: "driverPhone", Value: ta.TemporaryDriverPhone},
				firestore.Update{Path: "isTemporaryDriver", Value: true},
			)
			finalDriverName = ta.TemporaryDriverName
		}
		if ta.TemporaryAttendantName != "" {
			updates = append(updates,
				firestore.Update{Path: "attendantId", Value: ta.TemporaryAttendantID},
				firestore.Update{Path: "attendantName", Value: ta.TemporaryAttendantName},
				firestore.Update{Path: "attendantPhone", Value: ta.TemporaryAttendantPhone},
				firestore.Update{Path: "isTemporaryAttendant", Value: true},
			)
		}
		if ta.TemporaryUnitNumber != "" {
			updates = append(updates,
				firestore.Update{Path: "vehicleId", Value: ta.TemporaryVehicleID},
				firestore.Update{Path: "unitNumber", Value: ta.TemporaryUnitNumber},
				firestore.Update{Path: "plateNumber", Value: ta.TemporaryPlateNumber},
				firestore.Update{Path: "isTemporaryVehicle", Value: true},
			)
			finalUnitNumber = ta.TemporaryUnitNumber
			finalVehicleID = ta.TemporaryVehicleID
		}
	}

	// Exclude vehicle if it is in Vehicle Defect or Periodic Inspection on this date
	if isVehicleUnavailableInMap(unavailableVehicles, finalUnitNumber, finalVehicleID) {
		updates = append(updates,
			firestore.Update{Path: "vehicleId", Value: 0},
			firestore.Update{Path: "unitNumber", Value: ""},
			firestore.Update{Path: "plateNumber", Value: ""},
			firestore.Update{Path: "isTemporaryVehicle", Value: false},
			firestore.Update{Path: "health", Value: models.HealthRed},
		)
		finalUnitNumber = ""
	}

	if len(updates) > 0 {
		if finalDriverName != "" && finalUnitNumber != "" && ds.Health == models.HealthRed {
			updates = append(updates, firestore.Update{Path: "health", Value: models.HealthGreen})
		}
		updates = append(updates, firestore.Update{Path: "updatedAt", Value: nowIso})
		_, _ = docRef.Update(ctx, updates)
	}
}

func (r *FirestoreDispatchRepository) DeleteDay(ctx context.Context, date string) error {
	iter := r.client.Collection(r.dispatchColl).Where("dispatchDate", "==", date).Documents(ctx)
	defer iter.Stop()

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return err
		}
		doc.Ref.Delete(ctx)
	}

	// Also purge confirmed dispatch payrolls for this date
	payrollIter := r.client.Collection(r.dispatchPayrollColl).Where("dispatchDate", "==", date).Documents(ctx)
	defer payrollIter.Stop()
	for {
		doc, err := payrollIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		doc.Ref.Delete(ctx)
	}

	// Also purge finance payroll logs for this date
	logIter := r.client.Collection(r.payrollLogColl).Where("dispatchDate", "==", date).Documents(ctx)
	defer logIter.Stop()
	for {
		doc, err := logIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		doc.Ref.Delete(ctx)
	}

	return nil
}

func matchesDispatchFilter(ds *models.DispatchShift, filter DispatchFilter) bool {
	routeLower := strings.ToLower(strings.TrimSpace(filter.RouteFilter))
	driverLower := strings.ToLower(strings.TrimSpace(filter.DriverFilter))
	stopLower := strings.ToLower(strings.TrimSpace(filter.StopFilter))
	vehicleLower := strings.ToLower(strings.TrimSpace(filter.VehicleFilter))
	searchLower := strings.ToLower(strings.TrimSpace(filter.Search))

	if routeLower != "" && !strings.Contains(strings.ToLower(ds.RouteNo), routeLower) && !strings.Contains(strings.ToLower(ds.RouteName), routeLower) {
		return false
	}
	if driverLower != "" && !strings.Contains(strings.ToLower(ds.DriverName), driverLower) {
		return false
	}
	if vehicleLower != "" && !strings.Contains(strings.ToLower(ds.UnitNumber), vehicleLower) {
		return false
	}
	if filter.ShiftType != "" && !strings.EqualFold(ds.ShiftType, filter.ShiftType) {
		return false
	}
	if filter.NeedsAttention != nil && *filter.NeedsAttention {
		if ds.Health == models.HealthGreen {
			return false
		}
	}

	if stopLower != "" {
		matchedStop := false
		for _, st := range ds.Stops {
			if strings.Contains(strings.ToLower(st.StopLocation), stopLower) || strings.Contains(strings.ToLower(st.SchoolName), stopLower) {
				matchedStop = true
				break
			}
		}
		if !matchedStop {
			return false
		}
	}

	if searchLower != "" {
		matched := strings.Contains(strings.ToLower(ds.RouteNo), searchLower) ||
			strings.Contains(strings.ToLower(ds.RouteName), searchLower) ||
			strings.Contains(strings.ToLower(ds.DriverName), searchLower) ||
			strings.Contains(strings.ToLower(ds.UnitNumber), searchLower)
		if !matched {
			return false
		}
	}

	return true
}

func (r *FirestoreDispatchRepository) listShiftsFromFirestore(ctx context.Context, date string, filter DispatchFilter) ([]*models.DispatchShift, error) {
	query := r.client.Collection(r.dispatchColl).Where("dispatchDate", "==", date)
	iter := query.Documents(ctx)
	defer iter.Stop()

	results := make([]*models.DispatchShift, 0)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		var ds models.DispatchShift
		if err := doc.DataTo(&ds); err != nil {
			continue
		}
		ds.ID = doc.Ref.ID

		if matchesDispatchFilter(&ds, filter) {
			results = append(results, &ds)
		}
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) listShiftsFromBigQuery(ctx context.Context, date string, filter DispatchFilter) ([]*models.DispatchShift, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE dispatch_date = @date",
		r.projectID, r.bqDataset, r.dispatchColl)

	q := r.bqClient.Query(querySQL)
	q.Parameters = []bigquery.QueryParameter{
		{Name: "date", Value: date},
	}

	it, err := q.Read(ctx)
	if err != nil {
		// Fallback to _raw_latest in case Firebase extension was used
		querySQL = fmt.Sprintf("SELECT document_id AS id, data FROM `%s.%s.%s_raw_latest` WHERE JSON_VALUE(data, '$.dispatchDate') = @date",
			r.projectID, r.bqDataset, r.dispatchColl)
		q = r.bqClient.Query(querySQL)
		q.Parameters = []bigquery.QueryParameter{{Name: "date", Value: date}}
		it, err = q.Read(ctx)
		if err != nil {
			log.Printf("[BIGQUERY] ListShifts query error: %v", err)
			return nil, err
		}
	}

	results := make([]*models.DispatchShift, 0)
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("[BIGQUERY] ListShifts row decode error: %v", err)
			return nil, err
		}

		var ds models.DispatchShift
		if err := json.Unmarshal([]byte(row.Data), &ds); err != nil {
			continue
		}
		if ds.ID == "" {
			ds.ID = row.ID
		}

		if matchesDispatchFilter(&ds, filter) {
			results = append(results, &ds)
		}
	}

	return results, nil
}

func (r *FirestoreDispatchRepository) getShiftByIDFromBigQuery(ctx context.Context, id string) (*models.DispatchShift, error) {
	if r.bqClient == nil {
		return nil, ErrDispatchShiftNotFound
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE id = @id LIMIT 1",
		r.projectID, r.bqDataset, r.dispatchColl)

	q := r.bqClient.Query(querySQL)
	q.Parameters = []bigquery.QueryParameter{
		{Name: "id", Value: id},
	}

	it, err := q.Read(ctx)
	if err != nil {
		// Fallback to _raw_latest
		querySQL = fmt.Sprintf("SELECT document_id AS id, data FROM `%s.%s.%s_raw_latest` WHERE document_id = @id LIMIT 1",
			r.projectID, r.bqDataset, r.dispatchColl)
		q = r.bqClient.Query(querySQL)
		q.Parameters = []bigquery.QueryParameter{{Name: "id", Value: id}}
		it, err = q.Read(ctx)
		if err != nil {
			log.Printf("[BIGQUERY] GetShiftByID query error: %v", err)
			return nil, ErrDispatchShiftNotFound
		}
	}

	var row struct {
		ID   string `bigquery:"id"`
		Data string `bigquery:"data"`
	}
	err = it.Next(&row)
	if err != nil {
		return nil, ErrDispatchShiftNotFound
	}

	var ds models.DispatchShift
	if err := json.Unmarshal([]byte(row.Data), &ds); err != nil {
		return nil, err
	}
	if ds.ID == "" {
		ds.ID = row.ID
	}
	return &ds, nil
}

func (r *FirestoreDispatchRepository) ListShifts(ctx context.Context, date string, filter DispatchFilter) ([]*models.DispatchShift, error) {
	var results []*models.DispatchShift
	var err error

	// If date is cold (e.g. > 60 days old) and BigQuery is configured, query BigQuery first
	if r.isColdDate(date) {
		results, err = r.listShiftsFromBigQuery(ctx, date, filter)
		if err == nil && len(results) > 0 {
			r.sortShifts(results)
			return results, nil
		}
	}

	// Query Firestore
	results, err = r.listShiftsFromFirestore(ctx, date, filter)
	if err != nil {
		return nil, err
	}

	// Fallback to BigQuery if Firestore returned no records (e.g. archived)
	if len(results) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listShiftsFromBigQuery(ctx, date, filter); bqErr == nil && len(bqRes) > 0 {
			results = bqRes
		}
	}

	r.sortShifts(results)
	return results, nil
}

func (r *FirestoreDispatchRepository) sortShifts(results []*models.DispatchShift) {
	sort.SliceStable(results, func(i, j int) bool {
		if results[i].RouteNo == results[j].RouteNo {
			return results[i].ShiftType < results[j].ShiftType
		}
		return results[i].RouteNo < results[j].RouteNo
	})
}

func (r *FirestoreDispatchRepository) GetShiftByID(ctx context.Context, id string) (*models.DispatchShift, error) {
	doc, err := r.client.Collection(r.dispatchColl).Doc(id).Get(ctx)
	if err == nil {
		var ds models.DispatchShift
		if err := doc.DataTo(&ds); err == nil {
			ds.ID = doc.Ref.ID
			return &ds, nil
		}
	}

	// Fallback to BigQuery cold storage if not in Firestore
	if r.bqClient != nil {
		if bqShift, bqErr := r.getShiftByIDFromBigQuery(ctx, id); bqErr == nil {
			return bqShift, nil
		}
	}

	return nil, ErrDispatchShiftNotFound
}

func (r *FirestoreDispatchRepository) UpdateShift(ctx context.Context, id string, req *models.UpdateDispatchShiftRequest) (*models.DispatchShift, error) {
	docRef := r.client.Collection(r.dispatchColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, ErrDispatchShiftNotFound
	}

	var ds models.DispatchShift
	if err := snap.DataTo(&ds); err != nil {
		return nil, err
	}
	ds.ID = docRef.ID

	oldDriverID := ds.DriverID
	oldDriverName := ds.DriverName
	oldAttendantID := ds.AttendantID
	oldAttendantName := ds.AttendantName

	now := time.Now().UTC().Format(time.RFC3339)
	updates := []firestore.Update{
		{Path: "updatedAt", Value: now},
	}

	if req.DriverID != nil {
		updates = append(updates, firestore.Update{Path: "driverId", Value: *req.DriverID})
		ds.DriverID = *req.DriverID
	}
	if req.DriverName != nil {
		updates = append(updates, firestore.Update{Path: "driverName", Value: *req.DriverName})
		ds.DriverName = *req.DriverName
	}
	if req.DriverPhone != nil {
		updates = append(updates, firestore.Update{Path: "driverPhone", Value: *req.DriverPhone})
		ds.DriverPhone = *req.DriverPhone
	}
	if req.VehicleID != nil {
		updates = append(updates, firestore.Update{Path: "vehicleId", Value: *req.VehicleID})
		ds.VehicleID = *req.VehicleID
	}
	if req.UnitNumber != nil {
		updates = append(updates, firestore.Update{Path: "unitNumber", Value: *req.UnitNumber})
		ds.UnitNumber = *req.UnitNumber
	}
	if req.PlateNumber != nil {
		updates = append(updates, firestore.Update{Path: "plateNumber", Value: *req.PlateNumber})
		ds.PlateNumber = *req.PlateNumber
	}
	if req.AttendantID != nil {
		updates = append(updates, firestore.Update{Path: "attendantId", Value: *req.AttendantID})
		ds.AttendantID = *req.AttendantID
	}
	if req.AttendantName != nil {
		updates = append(updates, firestore.Update{Path: "attendantName", Value: *req.AttendantName})
		ds.AttendantName = *req.AttendantName
	}
	if req.AttendantPhone != nil {
		updates = append(updates, firestore.Update{Path: "attendantPhone", Value: *req.AttendantPhone})
		ds.AttendantPhone = *req.AttendantPhone
	}
	if req.DispatchComments != nil {
		updates = append(updates, firestore.Update{Path: "dispatchComments", Value: *req.DispatchComments})
		ds.DispatchComments = *req.DispatchComments
	}
	if req.IsDryRun != nil {
		updates = append(updates, firestore.Update{Path: "isDryRun", Value: *req.IsDryRun})
		ds.IsDryRun = *req.IsDryRun
	}
	if req.DriverPayOption != nil {
		updates = append(updates, firestore.Update{Path: "driverPayOption", Value: *req.DriverPayOption})
		ds.DriverPayOption = *req.DriverPayOption
	}
	if req.DriverPayAmount != nil {
		updates = append(updates, firestore.Update{Path: "driverPayAmount", Value: *req.DriverPayAmount})
		ds.DriverPayAmount = req.DriverPayAmount
	}
	if req.DriverEiHours != nil {
		updates = append(updates, firestore.Update{Path: "driverEiHours", Value: *req.DriverEiHours})
		ds.DriverEiHours = req.DriverEiHours
	}
	if req.AttendantPayOption != nil {
		updates = append(updates, firestore.Update{Path: "attendantPayOption", Value: *req.AttendantPayOption})
		ds.AttendantPayOption = *req.AttendantPayOption
	}
	if req.AttendantPayAmount != nil {
		updates = append(updates, firestore.Update{Path: "attendantPayAmount", Value: *req.AttendantPayAmount})
		ds.AttendantPayAmount = req.AttendantPayAmount
	}
	if req.AttendantEiHours != nil {
		updates = append(updates, firestore.Update{Path: "attendantEiHours", Value: *req.AttendantEiHours})
		ds.AttendantEiHours = req.AttendantEiHours
	}
	if req.NurseID != nil {
		updates = append(updates, firestore.Update{Path: "nurseId", Value: *req.NurseID})
		ds.NurseID = *req.NurseID
	}
	if req.NurseName != nil {
		updates = append(updates, firestore.Update{Path: "nurseName", Value: *req.NurseName})
		ds.NurseName = *req.NurseName
	}
	if req.NursePhone != nil {
		updates = append(updates, firestore.Update{Path: "nursePhone", Value: *req.NursePhone})
		ds.NursePhone = *req.NursePhone
	}
	if req.NursePayOption != nil {
		updates = append(updates, firestore.Update{Path: "nursePayOption", Value: *req.NursePayOption})
		ds.NursePayOption = *req.NursePayOption
	}
	if req.NursePayAmount != nil {
		updates = append(updates, firestore.Update{Path: "nursePayAmount", Value: *req.NursePayAmount})
		ds.NursePayAmount = req.NursePayAmount
	}
	if req.NurseEiHours != nil {
		updates = append(updates, firestore.Update{Path: "nurseEiHours", Value: *req.NurseEiHours})
		ds.NurseEiHours = req.NurseEiHours
	}
	if req.PayrollComments != nil {
		updates = append(updates, firestore.Update{Path: "payrollComments", Value: *req.PayrollComments})
		ds.PayrollComments = *req.PayrollComments
	}
	if req.ScheduledCheckInTime != nil {
		updates = append(updates, firestore.Update{Path: "scheduledCheckInTime", Value: *req.ScheduledCheckInTime})
		ds.ScheduledCheckInTime = *req.ScheduledCheckInTime
	}
	if req.DriverCheckedInAt != nil {
		if *req.DriverCheckedInAt == "" {
			updates = append(updates, firestore.Update{Path: "driverCheckedInAt", Value: firestore.Delete})
			ds.DriverCheckedInAt = nil
		} else {
			updates = append(updates, firestore.Update{Path: "driverCheckedInAt", Value: *req.DriverCheckedInAt})
			ds.DriverCheckedInAt = req.DriverCheckedInAt
		}
	}
	if req.IsDriverCheckedIn != nil {
		updates = append(updates, firestore.Update{Path: "isDriverCheckedIn", Value: *req.IsDriverCheckedIn})
		ds.IsDriverCheckedIn = *req.IsDriverCheckedIn
		if !*req.IsDriverCheckedIn {
			updates = append(updates, firestore.Update{Path: "driverCheckedInAt", Value: firestore.Delete})
			ds.DriverCheckedInAt = nil
		}
	}
	if req.DriverCheckedOutAt != nil {
		if *req.DriverCheckedOutAt == "" {
			updates = append(updates, firestore.Update{Path: "driverCheckedOutAt", Value: firestore.Delete})
			ds.DriverCheckedOutAt = nil
		} else {
			updates = append(updates, firestore.Update{Path: "driverCheckedOutAt", Value: *req.DriverCheckedOutAt})
			ds.DriverCheckedOutAt = req.DriverCheckedOutAt
		}
	}
	if req.IsDriverCheckedOut != nil {
		updates = append(updates, firestore.Update{Path: "isDriverCheckedOut", Value: *req.IsDriverCheckedOut})
		ds.IsDriverCheckedOut = *req.IsDriverCheckedOut
		if !*req.IsDriverCheckedOut {
			updates = append(updates, firestore.Update{Path: "driverCheckedOutAt", Value: firestore.Delete})
			ds.DriverCheckedOutAt = nil
		}
	}
	if req.DriverCheckoutComments != nil {
		updates = append(updates, firestore.Update{Path: "driverCheckoutComments", Value: *req.DriverCheckoutComments})
		ds.DriverCheckoutComments = *req.DriverCheckoutComments
	}
	if req.AttendantCheckedInAt != nil {
		if *req.AttendantCheckedInAt == "" {
			updates = append(updates, firestore.Update{Path: "attendantCheckedInAt", Value: firestore.Delete})
			ds.AttendantCheckedInAt = nil
		} else {
			updates = append(updates, firestore.Update{Path: "attendantCheckedInAt", Value: *req.AttendantCheckedInAt})
			ds.AttendantCheckedInAt = req.AttendantCheckedInAt
		}
	}
	if req.IsAttendantCheckedIn != nil {
		updates = append(updates, firestore.Update{Path: "isAttendantCheckedIn", Value: *req.IsAttendantCheckedIn})
		ds.IsAttendantCheckedIn = *req.IsAttendantCheckedIn
		if !*req.IsAttendantCheckedIn {
			updates = append(updates, firestore.Update{Path: "attendantCheckedInAt", Value: firestore.Delete})
			ds.AttendantCheckedInAt = nil
		}
	}
	if req.AttendantCheckedOutAt != nil {
		if *req.AttendantCheckedOutAt == "" {
			updates = append(updates, firestore.Update{Path: "attendantCheckedOutAt", Value: firestore.Delete})
			ds.AttendantCheckedOutAt = nil
		} else {
			updates = append(updates, firestore.Update{Path: "attendantCheckedOutAt", Value: *req.AttendantCheckedOutAt})
			ds.AttendantCheckedOutAt = req.AttendantCheckedOutAt
		}
	}
	if req.IsAttendantCheckedOut != nil {
		updates = append(updates, firestore.Update{Path: "isAttendantCheckedOut", Value: *req.IsAttendantCheckedOut})
		ds.IsAttendantCheckedOut = *req.IsAttendantCheckedOut
		if !*req.IsAttendantCheckedOut {
			updates = append(updates, firestore.Update{Path: "attendantCheckedOutAt", Value: firestore.Delete})
			ds.AttendantCheckedOutAt = nil
		}
	}
	if req.AttendantCheckoutComments != nil {
		updates = append(updates, firestore.Update{Path: "attendantCheckoutComments", Value: *req.AttendantCheckoutComments})
		ds.AttendantCheckoutComments = *req.AttendantCheckoutComments
	}
	if req.ParentNotifications != nil {
		updates = append(updates, firestore.Update{Path: "parentNotifications", Value: *req.ParentNotifications})
		ds.ParentNotifications = *req.ParentNotifications
	}
	if req.Notes != nil {
		updates = append(updates, firestore.Update{Path: "notes", Value: *req.Notes})
		ds.DispatchComments = *req.Notes
	}

	// Recompute health
	health := models.HealthGreen
	if ds.DriverName == "" || ds.UnitNumber == "" {
		health = models.HealthRed
	} else if ds.LateMinutes >= 15 {
		health = models.HealthRed
	} else if ds.LateMinutes > 0 {
		health = models.HealthYellow
	}
	updates = append(updates, firestore.Update{Path: "health", Value: health})
	ds.Health = health

	empIds := ds.ComputeAssignedEmployeeIds()
	updates = append(updates, firestore.Update{Path: "assignedEmployeeIds", Value: empIds})
	ds.AssignedEmployeeIds = empIds

	// Crew change detection: If driver changed, delete previous driver payroll
	driverChanged := (req.DriverID != nil && *req.DriverID != oldDriverID) || (req.DriverName != nil && *req.DriverName != oldDriverName)
	if driverChanged {
		_ = r.DeleteDispatchPayroll(ctx, id, "driver")
		if req.IsDriverCheckedIn == nil {
			ds.IsDriverCheckedIn = false
			ds.DriverCheckedInAt = nil
			updates = append(updates,
				firestore.Update{Path: "isDriverCheckedIn", Value: false},
				firestore.Update{Path: "driverCheckedInAt", Value: firestore.Delete},
			)
		}
	}

	// Crew change detection: If attendant changed, delete previous attendant payroll
	attendantChanged := (req.AttendantID != nil && *req.AttendantID != oldAttendantID) || (req.AttendantName != nil && *req.AttendantName != oldAttendantName)
	if attendantChanged {
		_ = r.DeleteDispatchPayroll(ctx, id, "attendant")
		if req.IsAttendantCheckedIn == nil {
			ds.IsAttendantCheckedIn = false
			ds.AttendantCheckedInAt = nil
			updates = append(updates,
				firestore.Update{Path: "isAttendantCheckedIn", Value: false},
				firestore.Update{Path: "attendantCheckedInAt", Value: firestore.Delete},
			)
		}
	}

	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, err
	}

	// Check-in status changes or override updates for Driver
	if req.IsDriverCheckedIn != nil {
		if *req.IsDriverCheckedIn {
			timeStr := time.Now().Format("15:04")
			if ds.DriverCheckedInAt != nil && *ds.DriverCheckedInAt != "" {
				timeStr = *ds.DriverCheckedInAt
			}
			_, _ = r.GenerateDispatchPayroll(ctx, id, "driver", timeStr)
		} else {
			_ = r.DeleteDispatchPayroll(ctx, id, "driver")
		}
	} else if ds.IsDriverCheckedIn && (req.DriverPayOption != nil || req.DriverPayAmount != nil || req.DriverEiHours != nil) {
		timeStr := time.Now().Format("15:04")
		if ds.DriverCheckedInAt != nil && *ds.DriverCheckedInAt != "" {
			timeStr = *ds.DriverCheckedInAt
		}
		_, _ = r.GenerateDispatchPayroll(ctx, id, "driver", timeStr)
	}

	// Check-in status changes or override updates for Attendant
	if req.IsAttendantCheckedIn != nil {
		if *req.IsAttendantCheckedIn {
			timeStr := time.Now().Format("15:04")
			if ds.AttendantCheckedInAt != nil && *ds.AttendantCheckedInAt != "" {
				timeStr = *ds.AttendantCheckedInAt
			}
			_, _ = r.GenerateDispatchPayroll(ctx, id, "attendant", timeStr)
		} else {
			_ = r.DeleteDispatchPayroll(ctx, id, "attendant")
		}
	} else if ds.IsAttendantCheckedIn && (req.AttendantPayOption != nil || req.AttendantPayAmount != nil || req.AttendantEiHours != nil) {
		timeStr := time.Now().Format("15:04")
		if ds.AttendantCheckedInAt != nil && *ds.AttendantCheckedInAt != "" {
			timeStr = *ds.AttendantCheckedInAt
		}
		_, _ = r.GenerateDispatchPayroll(ctx, id, "attendant", timeStr)
	}

	return &ds, nil
}

func (r *FirestoreDispatchRepository) RecordStopArrival(ctx context.Context, shiftID string, stopID int, arrivalTime string) (*models.DispatchShift, error) {
	docRef := r.client.Collection(r.dispatchColl).Doc(shiftID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, ErrDispatchShiftNotFound
	}

	var ds models.DispatchShift
	if err := snap.DataTo(&ds); err != nil {
		return nil, err
	}
	ds.ID = docRef.ID

	completed := 0
	maxLate := 0

	for i := range ds.Stops {
		st := &ds.Stops[i]
		if st.StopID == stopID {
			st.StopArrivalTime = &arrivalTime
			st.ActualArrivalTime = &arrivalTime
			st.MinutesLate = calculateMinutesDiff(arrivalTime, st.StopScheduleTime)
		}

		if (st.StopArrivalTime != nil && *st.StopArrivalTime != "") || (st.ActualArrivalTime != nil && *st.ActualArrivalTime != "") {
			completed++
			if st.MinutesLate > maxLate {
				maxLate = st.MinutesLate
			}
		}
	}

	ds.CompletedStops = completed
	ds.LateMinutes = maxLate

	if len(ds.Stops) > 0 {
		ds.FirstStopActual = ds.Stops[0].StopArrivalTime
		ds.LastStopActual = ds.Stops[len(ds.Stops)-1].StopArrivalTime
	}

	// Update health
	if ds.DriverName == "" || ds.UnitNumber == "" {
		ds.Health = models.HealthRed
	} else if ds.LateMinutes >= 15 {
		ds.Health = models.HealthRed
	} else if ds.LateMinutes > 0 {
		ds.Health = models.HealthYellow
	} else {
		ds.Health = models.HealthGreen
	}

	now := time.Now().UTC().Format(time.RFC3339)
	updates := []firestore.Update{
		{Path: "stops", Value: ds.Stops},
		{Path: "completedStops", Value: ds.CompletedStops},
		{Path: "lateMinutes", Value: ds.LateMinutes},
		{Path: "firstStopActual", Value: ds.FirstStopActual},
		{Path: "lastStopActual", Value: ds.LastStopActual},
		{Path: "health", Value: ds.Health},
		{Path: "updatedAt", Value: now},
	}

	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, err
	}

	return &ds, nil
}

func (r *FirestoreDispatchRepository) CheckInDriver(ctx context.Context, shiftID string, req *models.DriverCheckInRequest) (*models.DispatchShift, error) {
	docRef := r.client.Collection(r.dispatchColl).Doc(shiftID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, ErrDispatchShiftNotFound
	}

	var ds models.DispatchShift
	if err := snap.DataTo(&ds); err != nil {
		return nil, err
	}
	ds.ID = docRef.ID

	now := time.Now().UTC().Format(time.RFC3339)
	var updates []firestore.Update

	if req != nil && req.Undo {
		ds.IsDriverCheckedIn = false
		ds.DriverCheckedInAt = nil
		updates = append(updates,
			firestore.Update{Path: "isDriverCheckedIn", Value: false},
			firestore.Update{Path: "driverCheckedInAt", Value: firestore.Delete},
			firestore.Update{Path: "updatedAt", Value: now},
		)
	} else {
		checkInTime := time.Now().Format("15:04")
		if req != nil && req.CheckInTime != nil && *req.CheckInTime != "" {
			checkInTime = *req.CheckInTime
		}
		ds.IsDriverCheckedIn = true
		ds.DriverCheckedInAt = &checkInTime
		updates = append(updates,
			firestore.Update{Path: "isDriverCheckedIn", Value: true},
			firestore.Update{Path: "driverCheckedInAt", Value: checkInTime},
			firestore.Update{Path: "updatedAt", Value: now},
		)
	}

	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, err
	}

	if req != nil && req.Undo {
		_ = r.DeleteDispatchPayroll(ctx, shiftID, "driver")
	} else if ds.DriverID != "" || ds.DriverName != "" {
		checkInTime := time.Now().Format("15:04")
		if ds.DriverCheckedInAt != nil && *ds.DriverCheckedInAt != "" {
			checkInTime = *ds.DriverCheckedInAt
		}
		_, _ = r.GenerateDispatchPayroll(ctx, shiftID, "driver", checkInTime)
	}

	return &ds, nil
}

func (r *FirestoreDispatchRepository) MarkDriverReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error {
	docRef := r.client.Collection(r.dispatchColl).Doc(shiftID)
	_, err := docRef.Update(ctx, []firestore.Update{
		{Path: "driverReminderSentAt", Value: sentAt},
		{Path: "updatedAt", Value: time.Now().UTC().Format(time.RFC3339)},
	})
	return err
}

func (r *FirestoreDispatchRepository) MarkAttendantReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error {
	docRef := r.client.Collection(r.dispatchColl).Doc(shiftID)
	_, err := docRef.Update(ctx, []firestore.Update{
		{Path: "attendantReminderSentAt", Value: sentAt},
		{Path: "updatedAt", Value: time.Now().UTC().Format(time.RFC3339)},
	})
	return err
}

func (r *FirestoreDispatchRepository) MarkPretripReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error {
	docRef := r.client.Collection(r.dispatchColl).Doc(shiftID)
	_, err := docRef.Update(ctx, []firestore.Update{
		{Path: "pretripReminderSentAt", Value: sentAt},
		{Path: "updatedAt", Value: time.Now().UTC().Format(time.RFC3339)},
	})
	return err
}

func (r *FirestoreDispatchRepository) UpdateStudentStatus(ctx context.Context, shiftID string, stopID int, studentID int, isPresent *bool, pickupTime *string, dropoffTime *string, actualArrivalTime *string, status *string, dropoffStatus *string, absenceReason *string, reportedBy *string) (*models.DispatchShift, error) {
	docRef := r.client.Collection(r.dispatchColl).Doc(shiftID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, ErrDispatchShiftNotFound
	}

	var ds models.DispatchShift
	if err := snap.DataTo(&ds); err != nil {
		return nil, err
	}
	ds.ID = docRef.ID

	applyStudentUpdate := func(stu *models.DispatchShiftStopStudent) {
		if isPresent != nil {
			stu.IsPresent = isPresent
		}
		if pickupTime != nil && *pickupTime != "" {
			stu.PickupTime = pickupTime
		}
		if dropoffTime != nil && *dropoffTime != "" {
			stu.DropoffTime = dropoffTime
		}
		if dropoffStatus != nil && *dropoffStatus != "" {
			stu.DropoffStatus = *dropoffStatus
		}
		if status != nil && *status != "" {
			stu.Status = *status
			if *status == "dropped_off" {
				t := true
				stu.IsPresent = &t
				stu.DropoffStatus = "dropped_off"
				if stu.DropoffTime == nil || *stu.DropoffTime == "" {
					nowTime := time.Now().Format("15:04")
					stu.DropoffTime = &nowTime
				}
				if stu.PickupTime == nil || *stu.PickupTime == "" {
					nowTime := time.Now().Format("15:04")
					stu.PickupTime = &nowTime
				}
			} else if *status == "picked_up" {
				t := true
				stu.IsPresent = &t
			} else if *status == "absent" || *status == "no_show" {
				f := false
				stu.IsPresent = &f
			}
		} else if isPresent != nil {
			if *isPresent {
				stu.Status = "picked_up"
			} else {
				stu.Status = "absent"
			}
		}
		if absenceReason != nil {
			stu.AbsenceReason = *absenceReason
		}
		if stu.Status == "absent" {
			stu.AbsenceReportedAt = time.Now().Format("2006-01-02 15:04:05")
			if reportedBy != nil && *reportedBy != "" {
				stu.AbsenceReportedBy = *reportedBy
			}
		}
	}

	studentUpdatedCount := 0
	for i := range ds.Stops {
		st := &ds.Stops[i]
		if st.StopID == stopID {
			for j := range st.AssignedStudents {
				stu := &st.AssignedStudents[j]
				if stu.StudentID == studentID {
					applyStudentUpdate(stu)
					studentUpdatedCount++
				}
			}

			shouldRecordArrival := false
			arrTime := ""
			if actualArrivalTime != nil && *actualArrivalTime != "" {
				shouldRecordArrival = true
				arrTime = *actualArrivalTime
			} else if pickupTime != nil && *pickupTime != "" {
				shouldRecordArrival = true
				arrTime = *pickupTime
			} else if dropoffTime != nil && *dropoffTime != "" {
				shouldRecordArrival = true
				arrTime = *dropoffTime
			} else if (status != nil && *status == "dropped_off") || (dropoffStatus != nil && *dropoffStatus == "dropped_off") {
				shouldRecordArrival = true
				arrTime = time.Now().Format("15:04")
			} else if isPresent != nil && *isPresent {
				shouldRecordArrival = true
				arrTime = time.Now().Format("15:04")
			} else if (status != nil && (*status == "absent" || *status == "no_show")) || (isPresent != nil && !*isPresent) {
				// Driver marking student absent/no-show implies driver arrived at this stop
				if reportedBy == nil || *reportedBy == "driver" || *reportedBy == "" {
					shouldRecordArrival = true
					arrTime = time.Now().Format("15:04")
				}
			}

			if shouldRecordArrival {
				if (st.StopArrivalTime == nil || *st.StopArrivalTime == "") && (st.ActualArrivalTime == nil || *st.ActualArrivalTime == "") {
					st.StopArrivalTime = &arrTime
					st.ActualArrivalTime = &arrTime
					st.MinutesLate = calculateMinutesDiff(arrTime, st.StopScheduleTime)
				}
			}
		}
	}

	// Fallback/cross-stop update: If student was not found on stopID (e.g. stopID is a school stop where students are aggregated from home stops),
	// search and update the student in any stop across the entire shift:
	if studentUpdatedCount == 0 {
		for i := range ds.Stops {
			st := &ds.Stops[i]
			for j := range st.AssignedStudents {
				stu := &st.AssignedStudents[j]
				if stu.StudentID == studentID {
					applyStudentUpdate(stu)
					studentUpdatedCount++
				}
			}
		}
	}

	completed := 0
	maxLate := 0
	for _, st := range ds.Stops {
		if (st.StopArrivalTime != nil && *st.StopArrivalTime != "") || (st.ActualArrivalTime != nil && *st.ActualArrivalTime != "") {
			completed++
			if st.MinutesLate > maxLate {
				maxLate = st.MinutesLate
			}
		}
	}
	ds.CompletedStops = completed
	ds.LateMinutes = maxLate
	if len(ds.Stops) > 0 {
		ds.FirstStopActual = ds.Stops[0].StopArrivalTime
		ds.LastStopActual = ds.Stops[len(ds.Stops)-1].StopArrivalTime
	}

	// Update health
	if ds.DriverName == "" || ds.UnitNumber == "" {
		ds.Health = models.HealthRed
	} else if ds.LateMinutes >= 15 {
		ds.Health = models.HealthRed
	} else if ds.LateMinutes > 0 {
		ds.Health = models.HealthYellow
	} else {
		ds.Health = models.HealthGreen
	}

	now := time.Now().UTC().Format(time.RFC3339)
	updates := []firestore.Update{
		{Path: "stops", Value: ds.Stops},
		{Path: "completedStops", Value: ds.CompletedStops},
		{Path: "lateMinutes", Value: ds.LateMinutes},
		{Path: "health", Value: ds.Health},
		{Path: "firstStopActual", Value: ds.FirstStopActual},
		{Path: "lastStopActual", Value: ds.LastStopActual},
		{Path: "updatedAt", Value: now},
	}

	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, err
	}

	return &ds, nil
}

func (r *FirestoreDispatchRepository) RecordStudentAbsence(ctx context.Context, req *models.RecordStudentAbsenceRequest) (*models.RecordStudentAbsenceResponse, error) {
	if req.Date == "" || req.StudentID <= 0 {
		return nil, errors.New("date and studentId are required")
	}

	shifts, err := r.ListShifts(ctx, req.Date, DispatchFilter{})
	if err != nil {
		return nil, err
	}
	if len(shifts) == 0 {
		// Automatically generate shifts for this day if not seeded yet
		if _, err := r.CreateDay(ctx, req.Date, nil); err == nil {
			shifts, _ = r.ListShifts(ctx, req.Date, DispatchFilter{})
		}
	}

	var affectedShifts []string
	studentName := ""
	nowStr := time.Now().Format("2006-01-02 15:04:05")
	f := false

	for _, s := range shifts {
		// Check if student belongs to this shift
		hasStudentInShift := false
		for _, st := range s.Stops {
			for _, stu := range st.AssignedStudents {
				if stu.StudentID == req.StudentID {
					hasStudentInShift = true
					break
				}
			}
			if hasStudentInShift {
				break
			}
		}

		if req.RouteNo != "" && s.RouteNo != req.RouteNo && !hasStudentInShift {
			continue
		}
		if req.ShiftType != "" && strings.ToUpper(req.ShiftType) != "ALL" && !strings.EqualFold(s.ShiftType, req.ShiftType) {
			continue
		}

		shiftModified := false
		for i := range s.Stops {
			st := &s.Stops[i]
			for j := range st.AssignedStudents {
				stu := &st.AssignedStudents[j]
				if stu.StudentID == req.StudentID {
					studentName = stu.StudentName
					stu.Status = "absent"
					stu.IsPresent = &f
					stu.AbsenceReason = req.Reason
					stu.AbsenceReportedAt = nowStr
					if req.ReportedBy != "" {
						stu.AbsenceReportedBy = req.ReportedBy
					}
					shiftModified = true
				}
			}
		}

		if shiftModified {
			docRef := r.client.Collection(r.dispatchColl).Doc(s.ID)
			now := time.Now().UTC().Format(time.RFC3339)
			updates := []firestore.Update{
				{Path: "stops", Value: s.Stops},
				{Path: "updatedAt", Value: now},
			}
			if _, err := docRef.Update(ctx, updates); err == nil {
				affectedShifts = append(affectedShifts, s.ID)
			}
		}
	}

	if studentName == "" && req.StudentName != "" {
		studentName = req.StudentName
	}

	reportedBy := req.ReportedBy
	if reportedBy == "" {
		reportedBy = "Dispatcher"
	}

	if len(affectedShifts) > 0 {
		_, _ = r.AddChangeLog(ctx, &models.DispatchChangeLog{
			DispatchDate: req.Date,
			Type:         "Student Absence Logged",
			Detail:       fmt.Sprintf("Student %s (ID: %d) marked absent for %s (%s). Reason: %s", studentName, req.StudentID, req.Date, req.ShiftType, req.Reason),
			Time:         nowStr,
			Timestamp:    time.Now().UnixMilli(),
			User:         reportedBy,
		})
	}

	absenceID := fmt.Sprintf("ABS-%s-%d", req.Date, req.StudentID)
	rec := models.StudentAbsenceRecord{
		ID:             absenceID,
		Date:           req.Date,
		StudentID:      req.StudentID,
		StudentName:    studentName,
		SchoolName:     req.SchoolName,
		RouteNo:        req.RouteNo,
		ShiftType:      req.ShiftType,
		Reason:         req.Reason,
		ReportedBy:     reportedBy,
		ReportedAt:     nowStr,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		Status:         "ACTIVE",
		AffectedShifts: affectedShifts,
	}
	_, _ = r.client.Collection("student_absences").Doc(absenceID).Set(ctx, rec)

	return &models.RecordStudentAbsenceResponse{
		Date:          req.Date,
		StudentID:     req.StudentID,
		StudentName:   studentName,
		Reason:        req.Reason,
		AffectedShifts: affectedShifts,
		Count:         len(affectedShifts),
	}, nil
}

func (r *FirestoreDispatchRepository) ListStudentAbsences(ctx context.Context, filter models.ListStudentAbsencesFilter) ([]*models.StudentAbsenceRecord, error) {
	var results []*models.StudentAbsenceRecord
	seen := make(map[string]bool)

	// 1. Query dedicated student_absences collection
	q := r.client.Collection("student_absences").Query
	if filter.StartDate != "" {
		q = q.Where("date", ">=", filter.StartDate)
	}
	if filter.EndDate != "" {
		q = q.Where("date", "<=", filter.EndDate)
	}

	docs, err := q.Documents(ctx).GetAll()
	if err == nil {
		for _, d := range docs {
			var rec models.StudentAbsenceRecord
			if err := d.DataTo(&rec); err == nil {
				if rec.Status == "CANCELLED" {
					continue
				}
				if filter.StudentID > 0 && rec.StudentID != filter.StudentID {
					continue
				}
				if filter.RouteNo != "" && rec.RouteNo != "" && rec.RouteNo != filter.RouteNo {
					continue
				}
				if filter.ShiftType != "" && filter.ShiftType != "ALL" && rec.ShiftType != "ALL" && !strings.EqualFold(rec.ShiftType, filter.ShiftType) {
					continue
				}
				key := fmt.Sprintf("%s-%d", rec.Date, rec.StudentID)
				seen[key] = true
				results = append(results, &rec)
			}
		}
	}

	// 2. Also inspect dispatch shifts for the date range to catch any absences marked on stops
	if filter.StartDate != "" && filter.EndDate != "" {
		shiftsQuery := r.client.Collection(r.dispatchColl).Query.
			Where("dispatchDate", ">=", filter.StartDate).
			Where("dispatchDate", "<=", filter.EndDate)
		shiftDocs, _ := shiftsQuery.Documents(ctx).GetAll()
		for _, sd := range shiftDocs {
			var s models.DispatchShift
			if err := sd.DataTo(&s); err != nil {
				continue
			}
			if filter.RouteNo != "" && s.RouteNo != filter.RouteNo {
				continue
			}
			for _, st := range s.Stops {
				for _, stu := range st.AssignedStudents {
					if strings.EqualFold(stu.Status, "absent") {
						if filter.StudentID > 0 && stu.StudentID != filter.StudentID {
							continue
						}
						key := fmt.Sprintf("%s-%d", s.DispatchDate, stu.StudentID)
						if !seen[key] {
							seen[key] = true
							results = append(results, &models.StudentAbsenceRecord{
								ID:             fmt.Sprintf("ABS-%s-%d", s.DispatchDate, stu.StudentID),
								Date:           s.DispatchDate,
								StudentID:      stu.StudentID,
								StudentNo:      stu.StudentNo,
								StudentName:    stu.StudentName,
								SchoolName:     stu.SchoolName,
								RouteNo:        s.RouteNo,
								ShiftType:      s.ShiftType,
								Reason:         stu.AbsenceReason,
								ReportedBy:     stu.AbsenceReportedBy,
								ReportedAt:     stu.AbsenceReportedAt,
								Status:         "ACTIVE",
								AffectedShifts: []string{s.ID},
							})
						}
					}
				}
			}
		}
	}

	// Sort by date ascending
	sort.Slice(results, func(i, j int) bool {
		if results[i].Date != results[j].Date {
			return results[i].Date < results[j].Date
		}
		return results[i].StudentName < results[j].StudentName
	})

	return results, nil
}

func (r *FirestoreDispatchRepository) CancelStudentAbsence(ctx context.Context, id string, cancelledBy string) error {
	docRef := r.client.Collection("student_absences").Doc(id)
	doc, err := docRef.Get(ctx)
	var rec models.StudentAbsenceRecord
	if err == nil {
		_ = doc.DataTo(&rec)
		_, _ = docRef.Delete(ctx)
	}

	if rec.Date != "" && rec.StudentID > 0 {
		shifts, _ := r.ListShifts(ctx, rec.Date, DispatchFilter{})
		for _, s := range shifts {
			shiftModified := false
			for i := range s.Stops {
				st := &s.Stops[i]
				for j := range st.AssignedStudents {
					stu := &st.AssignedStudents[j]
					if stu.StudentID == rec.StudentID && strings.EqualFold(stu.Status, "absent") {
						stu.Status = "scheduled"
						stu.AbsenceReason = ""
						shiftModified = true
					}
				}
			}
			if shiftModified {
				sRef := r.client.Collection(r.dispatchColl).Doc(s.ID)
				_, _ = sRef.Update(ctx, []firestore.Update{
					{Path: "stops", Value: s.Stops},
					{Path: "updatedAt", Value: time.Now().UTC().Format(time.RFC3339)},
				})
			}
		}

		nowStr := time.Now().Format("2006-01-02 15:04:05")
		_, _ = r.AddChangeLog(ctx, &models.DispatchChangeLog{
			DispatchDate: rec.Date,
			Type:         "Student Absence Cancelled",
			Detail:       fmt.Sprintf("Student %s (ID: %d) absence cancelled for %s. Restored to normal rider.", rec.StudentName, rec.StudentID, rec.Date),
			Time:         nowStr,
			Timestamp:    time.Now().UnixMilli(),
			User:         cancelledBy,
		})
	}

	return nil
}

func isSchoolStopType(stopType string) bool {
	t := strings.ToLower(strings.TrimSpace(stopType))
	return strings.Contains(t, "school") && !strings.Contains(t, "home") && !strings.Contains(t, "corner") && !strings.Contains(t, "yard")
}

// buildSplitPartitionStops partitions stops for a split shift, ensuring relevant home stops and
// destination school stops are included, with assigned students accurately reflecting the partition.
func buildSplitPartitionStops(origStops []models.DispatchShiftStop, studentIDs []int) []models.DispatchShiftStop {
	type studentInfo struct {
		student models.DispatchShiftStopStudent
		school  string
	}
	studentLookup := make(map[int]studentInfo)
	var schoolStopsInOrig []models.DispatchShiftStop

	for _, st := range origStops {
		isSchool := isSchoolStopType(st.StopType)
		if isSchool {
			schoolStopsInOrig = append(schoolStopsInOrig, st)
		}
		for _, stu := range st.AssignedStudents {
			sch := strings.TrimSpace(stu.SchoolName)
			if sch == "" && isSchool {
				sch = strings.TrimSpace(st.SchoolName)
			}
			existing, exists := studentLookup[stu.StudentID]
			if !exists || (existing.school == "" && sch != "") {
				stuCopy := stu
				if stuCopy.SchoolName == "" && sch != "" {
					stuCopy.SchoolName = sch
				}
				studentLookup[stu.StudentID] = studentInfo{
					student: stuCopy,
					school:  sch,
				}
			}
		}
	}

	partStudentSet := make(map[int]bool)
	for _, sID := range studentIDs {
		partStudentSet[sID] = true
	}

	var partStops []models.DispatchShiftStop
	for _, st := range origStops {
		isSchool := isSchoolStopType(st.StopType)

		if isSchool {
			schName := strings.ToLower(strings.TrimSpace(st.SchoolName))
			var schoolStudents []models.DispatchShiftStopStudent
			seenStu := make(map[int]bool)

			// 1. Students in this partition whose school matches this stop
			for _, sID := range studentIDs {
				info, ok := studentLookup[sID]
				if ok {
					stuSch := strings.ToLower(strings.TrimSpace(info.school))
					if schName != "" && stuSch != "" && (schName == stuSch || strings.Contains(schName, stuSch) || strings.Contains(stuSch, schName)) {
						if !seenStu[sID] {
							seenStu[sID] = true
							schoolStudents = append(schoolStudents, info.student)
						}
					}
				}
			}

			// 2. Students explicitly assigned to this original school stop
			for _, stu := range st.AssignedStudents {
				if partStudentSet[stu.StudentID] && !seenStu[stu.StudentID] {
					seenStu[stu.StudentID] = true
					schoolStudents = append(schoolStudents, stu)
				}
			}

			// 3. Fallback: if only 1 school stop exists in original shift
			if len(schoolStudents) == 0 && len(schoolStopsInOrig) == 1 && len(studentIDs) > 0 {
				for _, sID := range studentIDs {
					if info, ok := studentLookup[sID]; ok && !seenStu[sID] {
						seenStu[sID] = true
						schoolStudents = append(schoolStudents, info.student)
					}
				}
			}

			// If students attending this school belong to this split shift, clone the school stop with them
			if len(schoolStudents) > 0 {
				clone := st
				clone.AssignedStudents = schoolStudents
				partStops = append(partStops, clone)
			}
		} else {
			// Home pickup/dropoff stop
			var matchingStudents []models.DispatchShiftStopStudent
			for _, stu := range st.AssignedStudents {
				if partStudentSet[stu.StudentID] {
					matchingStudents = append(matchingStudents, stu)
				}
			}
			if len(matchingStudents) > 0 {
				clone := st
				clone.AssignedStudents = matchingStudents
				partStops = append(partStops, clone)
			}
		}
	}

	sort.Slice(partStops, func(i, j int) bool {
		return partStops[i].StopScheduleTime < partStops[j].StopScheduleTime
	})
	for i := range partStops {
		partStops[i].Sequence = i + 1
	}

	return partStops
}

func (r *FirestoreDispatchRepository) SplitShift(ctx context.Context, shiftID string, req *models.SplitDispatchShiftRequest) ([]*models.DispatchShift, error) {
	if req == nil || len(req.Parts) < 2 {
		return nil, errors.New("at least two split parts are required")
	}

	origShift, err := r.GetShiftByID(ctx, shiftID)
	if err != nil {
		return nil, err
	}

	defaultSuffixes := []string{"A", "B", "C", "D", "E", "F", "G", "H"}
	baseRouteNo := origShift.RouteNo
	for _, suf := range defaultSuffixes {
		if strings.HasSuffix(baseRouteNo, "-"+suf) {
			baseRouteNo = strings.TrimSuffix(baseRouteNo, "-"+suf)
			break
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	var resultingShifts []*models.DispatchShift

	for pIdx, part := range req.Parts {
		suffix := part.RouteSuffix
		if suffix == "" {
			if pIdx < len(defaultSuffixes) {
				suffix = defaultSuffixes[pIdx]
			} else {
				suffix = strconv.Itoa(pIdx + 1)
			}
		}

		routeNo := part.RouteNo
		if routeNo == "" {
			routeNo = fmt.Sprintf("%s-%s", baseRouteNo, suffix)
		}

		partStops := buildSplitPartitionStops(origShift.Stops, part.StudentIDs)

		firstTime := "--:--"
		lastTime := "--:--"
		if len(partStops) > 0 {
			firstTime = partStops[0].StopScheduleTime
			lastTime = partStops[len(partStops)-1].StopScheduleTime
		}

		completedStops := 0
		for _, st := range partStops {
			if st.ActualArrivalTime != nil || st.StopArrivalTime != nil {
				completedStops++
			}
		}

		health := models.HealthGreen
		if part.DriverName == "" || part.UnitNumber == "" {
			health = models.HealthYellow
		}

		targetShiftID := origShift.ID
		if pIdx > 0 {
			targetShiftID = fmt.Sprintf("DS-%s-%s-%s", origShift.DispatchDate, routeNo, origShift.ShiftType)
		}

		driverID := part.DriverID
		driverName := part.DriverName
		driverPhone := part.DriverPhone
		vehID := part.VehicleID
		unitNo := part.UnitNumber
		plateNo := part.PlateNumber
		attID := part.AttendantID
		attName := part.AttendantName
		attPhone := part.AttendantPhone

		if pIdx == 0 {
			if driverName == "" {
				driverID = origShift.DriverID
				driverName = origShift.DriverName
				driverPhone = origShift.DriverPhone
			}
			if unitNo == "" {
				vehID = origShift.VehicleID
				unitNo = origShift.UnitNumber
				plateNo = origShift.PlateNumber
			}
			if attName == "" {
				attID = origShift.AttendantID
				attName = origShift.AttendantName
				attPhone = origShift.AttendantPhone
			}
		}

		shiftObj := &models.DispatchShift{
			ID:               targetShiftID,
			DispatchDate:     origShift.DispatchDate,
			RouteID:          origShift.RouteID,
			RouteNo:          routeNo,
			RouteName:        origShift.RouteName,
			ShiftType:        origShift.ShiftType,
			BusRouteShiftID:  origShift.BusRouteShiftID,
			MergedShiftIDs:   origShift.MergedShiftIDs,
			DriverID:         driverID,
			DriverName:       driverName,
			DriverPhone:      driverPhone,
			VehicleID:        vehID,
			UnitNumber:       unitNo,
			PlateNumber:      plateNo,
			AttendantID:      attID,
			AttendantName:    attName,
			AttendantPhone:   attPhone,
			YardID:           origShift.YardID,
			YardName:         origShift.YardName,
			SchoolBoardID:    origShift.SchoolBoardID,
			SchoolBoardCode:  origShift.SchoolBoardCode,
			FirstStopTime:    firstTime,
			LastStopTime:     lastTime,
			TotalStops:       len(partStops),
			CompletedStops:   completedStops,
			LateMinutes:      0,
			Health:           health,
			IsDryRun:         origShift.IsDryRun,
			DispatchComments: fmt.Sprintf("Split shift (Part %s) from %s", suffix, origShift.RouteNo),
			Stops:            partStops,
			CreatedAt:        origShift.CreatedAt,
			UpdatedAt:        now,
		}

		if _, err := r.client.Collection(r.dispatchColl).Doc(shiftObj.ID).Set(ctx, shiftObj); err != nil {
			return nil, fmt.Errorf("failed to save split shift %s: %v", shiftObj.ID, err)
		}

		resultingShifts = append(resultingShifts, shiftObj)
	}

	return resultingShifts, nil
}

func (r *FirestoreDispatchRepository) GetPayrollSettings(ctx context.Context) (*models.DispatchPayrollSettings, error) {
	docRef := r.client.Collection(r.payrollSettingsColl).Doc("default_rates")
	snap, err := docRef.Get(ctx)
	if err != nil {
		return models.DefaultDispatchPayrollSettings(), nil
	}
	var settings models.DispatchPayrollSettings
	if err := snap.DataTo(&settings); err != nil {
		return models.DefaultDispatchPayrollSettings(), nil
	}
	return &settings, nil
}

func (r *FirestoreDispatchRepository) SavePayrollSettings(ctx context.Context, settings *models.DispatchPayrollSettings) (*models.DispatchPayrollSettings, error) {
	if settings == nil {
		settings = models.DefaultDispatchPayrollSettings()
	}
	settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	docRef := r.client.Collection(r.payrollSettingsColl).Doc("default_rates")
	if _, err := docRef.Set(ctx, settings); err != nil {
		return nil, fmt.Errorf("failed to save dispatch payroll settings: %w", err)
	}
	return settings, nil
}

func (r *FirestoreDispatchRepository) GetCheckInReminderSettings(ctx context.Context) (*models.CheckInReminderSettings, error) {
	docRef := r.client.Collection("system_settings").Doc("checkin_reminder")
	snap, err := docRef.Get(ctx)
	if err != nil {
		return models.DefaultCheckInReminderSettings(), nil
	}
	var settings models.CheckInReminderSettings
	if err := snap.DataTo(&settings); err != nil {
		return models.DefaultCheckInReminderSettings(), nil
	}
	if settings.ReminderGraceMinutes <= 0 {
		settings.ReminderGraceMinutes = 20
	}
	if settings.PretripReminderGraceMinutes <= 0 {
		settings.PretripReminderGraceMinutes = 60
	}
	return &settings, nil
}

func (r *FirestoreDispatchRepository) SaveCheckInReminderSettings(ctx context.Context, settings *models.CheckInReminderSettings) (*models.CheckInReminderSettings, error) {
	if settings == nil {
		settings = models.DefaultCheckInReminderSettings()
	}
	if settings.ReminderGraceMinutes <= 0 {
		settings.ReminderGraceMinutes = 20
	}
	if settings.PretripReminderGraceMinutes <= 0 {
		settings.PretripReminderGraceMinutes = 60
	}
	if settings.ReminderWindowStart == "" {
		settings.ReminderWindowStart = "06:00"
	}
	if settings.ReminderWindowEnd == "" {
		settings.ReminderWindowEnd = "18:00"
	}
	settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	docRef := r.client.Collection("system_settings").Doc("checkin_reminder")
	if _, err := docRef.Set(ctx, settings); err != nil {
		return nil, fmt.Errorf("failed to save check-in reminder settings: %w", err)
	}
	return settings, nil
}

// FormatDispatchLogTime formats a time into "2006-01-02 3:04:05 a.m./p.m." with correct 12-hour AM/PM period
func FormatDispatchLogTime(t time.Time) string {
	ampm := "a.m."
	if t.Hour() >= 12 {
		ampm = "p.m."
	}
	return fmt.Sprintf("%s %s", t.Format("2006-01-02 3:04:05"), ampm)
}

func (r *FirestoreDispatchRepository) AddChangeLog(ctx context.Context, log *models.DispatchChangeLog) (*models.DispatchChangeLog, error) {
	if log == nil {
		return nil, errors.New("change log cannot be nil")
	}
	if log.ID == "" {
		log.ID = fmt.Sprintf("LOG-%d", time.Now().UnixNano())
	}
	if log.Timestamp == 0 {
		log.Timestamp = time.Now().UnixMilli()
	}
	if log.Time == "" {
		log.Time = FormatDispatchLogTime(time.Now())
	}
	if log.User == "" {
		log.User = "Dispatcher"
	}
	log.CreatedAt = time.Now().UTC().Format(time.RFC3339)

	docRef := r.client.Collection(r.logColl).Doc(log.ID)
	if _, err := docRef.Set(ctx, log); err != nil {
		return nil, fmt.Errorf("failed to save change log: %w", err)
	}
	return log, nil
}

func (r *FirestoreDispatchRepository) listChangeLogsFromFirestore(ctx context.Context, date string) ([]*models.DispatchChangeLog, error) {
	q := r.client.Collection(r.logColl).Where("dispatchDate", "==", date)
	iter := q.Documents(ctx)
	defer iter.Stop()

	logs := make([]*models.DispatchChangeLog, 0)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var entry models.DispatchChangeLog
		if err := doc.DataTo(&entry); err != nil {
			continue
		}
		entry.ID = doc.Ref.ID
		logs = append(logs, &entry)
	}
	return logs, nil
}

func (r *FirestoreDispatchRepository) listChangeLogsFromBigQuery(ctx context.Context, date string) ([]*models.DispatchChangeLog, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE dispatch_date = @date",
		r.projectID, r.bqDataset, r.logColl)
	q := r.bqClient.Query(querySQL)
	q.Parameters = []bigquery.QueryParameter{{Name: "date", Value: date}}

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var logs []*models.DispatchChangeLog
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var entry models.DispatchChangeLog
		if err := json.Unmarshal([]byte(row.Data), &entry); err == nil {
			if entry.ID == "" {
				entry.ID = row.ID
			}
			logs = append(logs, &entry)
		}
	}
	return logs, nil
}

func (r *FirestoreDispatchRepository) ListChangeLogs(ctx context.Context, date string) ([]*models.DispatchChangeLog, error) {
	var logs []*models.DispatchChangeLog
	var err error

	if r.isLogColdDate(date) {
		logs, err = r.listChangeLogsFromBigQuery(ctx, date)
		if err == nil && len(logs) > 0 {
			sort.Slice(logs, func(i, j int) bool {
				return logs[i].Timestamp > logs[j].Timestamp
			})
			return logs, nil
		}
	}

	logs, err = r.listChangeLogsFromFirestore(ctx, date)
	if err != nil {
		return nil, err
	}

	if len(logs) == 0 && r.bqClient != nil {
		if bqLogs, bqErr := r.listChangeLogsFromBigQuery(ctx, date); bqErr == nil && len(bqLogs) > 0 {
			logs = bqLogs
		}
	}

	sort.Slice(logs, func(i, j int) bool {
		return logs[i].Timestamp > logs[j].Timestamp
	})
	return logs, nil
}

func (r *FirestoreDispatchRepository) ListSystemAuditLogs(ctx context.Context, collectionName string, startDate, endDate string) ([]map[string]interface{}, error) {
	validCollections := map[string]bool{
		"dispatch_change_logs":    true,
		"route_change_logs":       true,
		"entity_operation_logs":   true,
		"payroll_operation_logs":  true,
		"operational_safety_logs": true,
	}
	if !validCollections[collectionName] {
		return nil, fmt.Errorf("invalid system audit log collection: %s", collectionName)
	}

	// If cold date, query BigQuery first
	if startDate != "" && r.isLogColdDate(startDate) {
		results, err := r.listSystemAuditLogsFromBigQuery(ctx, collectionName, startDate, endDate)
		if err == nil && len(results) > 0 {
			return results, nil
		}
	}

	// Query Firestore
	results, err := r.listSystemAuditLogsFromFirestore(ctx, collectionName, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Fallback to BigQuery if empty
	if len(results) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listSystemAuditLogsFromBigQuery(ctx, collectionName, startDate, endDate); bqErr == nil && len(bqRes) > 0 {
			results = bqRes
		}
	}

	return results, nil
}

func (r *FirestoreDispatchRepository) listSystemAuditLogsFromFirestore(ctx context.Context, collectionName, startDate, endDate string) ([]map[string]interface{}, error) {
	q := r.client.Collection(collectionName).Query
	dateField := "timestamp"
	if collectionName == "dispatch_change_logs" {
		dateField = "dispatchDate"
	}

	if dateField == "timestamp" {
		if startDate != "" {
			q = q.Where("timestamp", ">=", startDate+"T00:00:00")
		}
		if endDate != "" {
			q = q.Where("timestamp", "<=", endDate+"T23:59:59.999Z")
		}
	} else {
		if startDate != "" {
			q = q.Where(dateField, ">=", startDate)
		}
		if endDate != "" {
			q = q.Where(dateField, "<=", endDate)
		}
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	var list []map[string]interface{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		data := doc.Data()
		data["id"] = doc.Ref.ID
		list = append(list, data)
	}
	return list, nil
}

func (r *FirestoreDispatchRepository) listSystemAuditLogsFromBigQuery(ctx context.Context, collectionName, startDate, endDate string) ([]map[string]interface{}, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE 1=1",
		r.projectID, r.bqDataset, collectionName)
	var params []bigquery.QueryParameter

	if startDate != "" {
		querySQL += " AND dispatch_date >= @startDate"
		params = append(params, bigquery.QueryParameter{Name: "startDate", Value: startDate})
	}
	if endDate != "" {
		querySQL += " AND dispatch_date <= @endDate"
		params = append(params, bigquery.QueryParameter{Name: "endDate", Value: endDate})
	}

	q := r.bqClient.Query(querySQL)
	q.Parameters = params

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var list []map[string]interface{}
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var item map[string]interface{}
		if err := json.Unmarshal([]byte(row.Data), &item); err == nil {
			if item["id"] == nil || item["id"] == "" {
				item["id"] = row.ID
			}
			list = append(list, item)
		}
	}
	return list, nil
}

func (r *FirestoreDispatchRepository) resolveRateForRole(ctx context.Context, ds *models.DispatchShift, role string) (payOption string, payRate float64, eiHours float64, rateSource string, desc string) {
	settings, _ := r.GetPayrollSettings(ctx)
	if settings == nil {
		settings = models.DefaultDispatchPayrollSettings()
	}

	// Tier 1: Check Manual Override from Dispatch Shift
	if role == "driver" {
		if ds.DriverPayOption != "" {
			switch ds.DriverPayOption {
			case "PD":
				return "PD", settings.Driver.PartialPayRate, settings.Driver.DefaultEiHours, "override_pd", "Manual Override: Partial Day (PD)"
			case "DD":
				return "DD", settings.Driver.DoublePartialPayRate, settings.Driver.DefaultEiHours, "override_dd", "Manual Override: Double Partial (DD)"
			case "NP":
				return "NP", settings.Driver.NoPayRate, settings.Driver.NoPayEiHours, "override_np", "Manual Override: No Pay (NP)"
			case "F":
				rate := 0.0
				ei := 0.0
				if ds.DriverPayAmount != nil {
					rate = *ds.DriverPayAmount
				}
				if ds.DriverEiHours != nil {
					ei = *ds.DriverEiHours
				}
				return "F", rate, ei, "override_custom", "Manual Override: Fixed Custom Rate (F)"
			}
		}
	} else if role == "attendant" {
		if ds.AttendantPayOption != "" {
			switch ds.AttendantPayOption {
			case "PD":
				return "PD", settings.Attendant.PartialPayRate, settings.Attendant.DefaultEiHours, "override_pd", "Manual Override: Partial Day (PD)"
			case "DD":
				return "DD", settings.Attendant.DoublePartialPayRate, settings.Attendant.DefaultEiHours, "override_dd", "Manual Override: Double Partial (DD)"
			case "NP":
				return "NP", settings.Attendant.NoPayRate, settings.Attendant.NoPayEiHours, "override_np", "Manual Override: No Pay (NP)"
			case "F":
				rate := 0.0
				ei := 0.0
				if ds.AttendantPayAmount != nil {
					rate = *ds.AttendantPayAmount
				}
				if ds.AttendantEiHours != nil {
					ei = *ds.AttendantEiHours
				}
				return "F", rate, ei, "override_custom", "Manual Override: Fixed Custom Rate (F)"
			}
		}
	}

	// Tier 2: Check Route Shift Assigned Rate in busroute_payroll_rates
	if r.client != nil {
		iter := r.client.Collection("busroute_payroll_rates").
			Where("routeNo", "==", ds.RouteNo).
			Where("jobTitle", "==", role).
			Documents(ctx)
		defer iter.Stop()

		var bestMatch *models.BusRoutePayrollRate
		for {
			doc, err := iter.Next()
			if err != nil {
				break
			}
			var pr models.BusRoutePayrollRate
			if err := doc.DataTo(&pr); err == nil {
				if strings.EqualFold(pr.ShiftType, ds.ShiftType) {
					bestMatch = &pr
					break
				}
				if pr.ShiftType == "All" || pr.ShiftType == "" {
					bestMatch = &pr
				}
			}
		}

		if bestMatch != nil && bestMatch.PayRate != nil {
			ei := 0.0
			if bestMatch.EiHours != nil {
				ei = *bestMatch.EiHours
			}
			return "STANDARD", *bestMatch.PayRate, ei, "route_shift_rate", fmt.Sprintf("Route Shift Rate (%s - %s)", ds.RouteNo, ds.ShiftType)
		}
	}

	// Tier 3: School Board Base Rate / System Default
	if role == "driver" {
		return "STANDARD", settings.Driver.PartialPayRate, settings.Driver.DefaultEiHours, "board_base_rate", "School Board Base Rate (Driver)"
	}
	return "STANDARD", settings.Attendant.PartialPayRate, settings.Attendant.DefaultEiHours, "board_base_rate", "School Board Base Rate (Attendant)"
}

func (r *FirestoreDispatchRepository) GenerateDispatchPayroll(ctx context.Context, shiftID string, role string, checkInTime string) (*models.DispatchPayrollRecord, error) {
	ds, err := r.GetShiftByID(ctx, shiftID)
	if err != nil {
		return nil, err
	}

	empID := ""
	empName := ""
	if role == "driver" {
		empID = ds.DriverID
		empName = ds.DriverName
	} else if role == "attendant" {
		empID = ds.AttendantID
		empName = ds.AttendantName
	}

	if empID == "" && empName == "" {
		return nil, fmt.Errorf("no %s assigned to shift %s", role, shiftID)
	}

	if checkInTime == "" {
		if role == "driver" && ds.DriverCheckedInAt != nil && *ds.DriverCheckedInAt != "" {
			checkInTime = *ds.DriverCheckedInAt
		} else if role == "attendant" && ds.AttendantCheckedInAt != nil && *ds.AttendantCheckedInAt != "" {
			checkInTime = *ds.AttendantCheckedInAt
		} else {
			checkInTime = time.Now().Format("15:04")
		}
	}

	payOption, payRate, eiHours, rateSource, rateDesc := r.resolveRateForRole(ctx, ds, role)
	now := time.Now().UTC().Format(time.RFC3339)
	payrollID := fmt.Sprintf("DP-%s-%s", shiftID, role)

	// Check existing check-out state on shift
	isCheckedOut := false
	checkOutTime := ""
	hasComments := false
	comments := ds.PayrollComments

	if role == "driver" {
		if ds.IsDriverCheckedOut {
			isCheckedOut = true
			if ds.DriverCheckedOutAt != nil {
				checkOutTime = *ds.DriverCheckedOutAt
			}
			if ds.DriverCheckoutComments != "" {
				comments = ds.DriverCheckoutComments
			}
		}
	} else if role == "attendant" {
		if ds.IsAttendantCheckedOut {
			isCheckedOut = true
			if ds.AttendantCheckedOutAt != nil {
				checkOutTime = *ds.AttendantCheckedOutAt
			}
			if ds.AttendantCheckoutComments != "" {
				comments = ds.AttendantCheckoutComments
			}
		}
	}

	if strings.TrimSpace(comments) != "" {
		hasComments = true
	}

	status := "pending_checkout"
	syncedToFinance := false

	if isCheckedOut {
		if hasComments {
			status = "pending_approval"
		} else {
			status = "approved"
		}
	}

	record := models.DispatchPayrollRecord{
		ID:              payrollID,
		DispatchDate:    ds.DispatchDate,
		ShiftID:         ds.ID,
		RouteNo:         ds.RouteNo,
		RouteName:       ds.RouteName,
		ShiftType:       ds.ShiftType,
		SchoolBoardID:   ds.SchoolBoardID,
		SchoolBoardCode: ds.SchoolBoardCode,
		EmployeeID:      empID,
		EmployeeName:    empName,
		Role:            role,
		VehicleID:       ds.VehicleID,
		UnitNumber:      ds.UnitNumber,
		CheckInTime:     checkInTime,
		CheckOutTime:    checkOutTime,
		HasComments:     hasComments,
		PayOption:       payOption,
		PayRate:         payRate,
		EiHours:         eiHours,
		RateSource:      rateSource,
		RateDescription: rateDesc,
		PayrollComments: comments,
		Status:          status,
		SyncedToFinance: syncedToFinance,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	// Auto-sync to Finance if clean (no comments / not pending approval) and rate > 0
	needsDispatchApproval := record.Status == "pending_approval" || record.HasComments || (strings.TrimSpace(record.PayrollComments) != "")
	if !needsDispatchApproval && record.PayRate > 0 {
		_, _ = r.SyncToPayrollLog(ctx, &record)
		record.SyncedToFinance = true
	}

	if r.client != nil {
		if _, err := r.client.Collection(r.dispatchPayrollColl).Doc(payrollID).Set(ctx, record); err != nil {
			return nil, err
		}
	}

	return &record, nil
}

func (r *FirestoreDispatchRepository) DeleteDispatchPayroll(ctx context.Context, shiftID string, role string) error {
	payrollID := fmt.Sprintf("DP-%s-%s", shiftID, role)
	if r.client != nil {
		_, err := r.client.Collection(r.dispatchPayrollColl).Doc(payrollID).Delete(ctx)
		_ = r.RemoveFromPayrollLog(ctx, payrollID)
		return err
	}
	return nil
}

func (r *FirestoreDispatchRepository) listDispatchPayrollsFromFirestore(ctx context.Context, date string) ([]*models.DispatchPayrollRecord, error) {
	if r.client == nil {
		return []*models.DispatchPayrollRecord{}, nil
	}
	q := r.client.Collection(r.dispatchPayrollColl).Where("dispatchDate", "==", date)
	iter := q.Documents(ctx)
	defer iter.Stop()

	list := make([]*models.DispatchPayrollRecord, 0)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.DispatchPayrollRecord
		if err := doc.DataTo(&rec); err == nil {
			if rec.ID == "" {
				rec.ID = doc.Ref.ID
			}
			list = append(list, &rec)
		}
	}
	return list, nil
}

func (r *FirestoreDispatchRepository) listDispatchPayrollsFromBigQuery(ctx context.Context, date string) ([]*models.DispatchPayrollRecord, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE dispatch_date = @date",
		r.projectID, r.bqDataset, r.dispatchPayrollColl)

	q := r.bqClient.Query(querySQL)
	q.Parameters = []bigquery.QueryParameter{
		{Name: "date", Value: date},
	}

	it, err := q.Read(ctx)
	if err != nil {
		// Fallback to _raw_latest in case Firebase extension was used
		querySQL = fmt.Sprintf("SELECT document_id AS id, data FROM `%s.%s.%s_raw_latest` WHERE JSON_VALUE(data, '$.dispatchDate') = @date",
			r.projectID, r.bqDataset, r.dispatchPayrollColl)
		q = r.bqClient.Query(querySQL)
		q.Parameters = []bigquery.QueryParameter{{Name: "date", Value: date}}
		it, err = q.Read(ctx)
		if err != nil {
			log.Printf("[BIGQUERY] ListDispatchPayrolls query error: %v", err)
			return nil, err
		}
	}

	list := make([]*models.DispatchPayrollRecord, 0)
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("[BIGQUERY] ListDispatchPayrolls row decode error: %v", err)
			return nil, err
		}

		var rec models.DispatchPayrollRecord
		if err := json.Unmarshal([]byte(row.Data), &rec); err == nil {
			if rec.ID == "" {
				rec.ID = row.ID
			}
			list = append(list, &rec)
		}
	}

	return list, nil
}

func (r *FirestoreDispatchRepository) ListDispatchPayrolls(ctx context.Context, date string) ([]*models.DispatchPayrollRecord, error) {
	var list []*models.DispatchPayrollRecord
	var err error

	// Check if date is cold (e.g. > 60 days old)
	if r.isColdDate(date) {
		list, err = r.listDispatchPayrollsFromBigQuery(ctx, date)
		if err == nil && len(list) > 0 {
			r.sortDispatchPayrolls(list)
			return list, nil
		}
	}

	// Query Firestore
	list, err = r.listDispatchPayrollsFromFirestore(ctx, date)
	if err != nil {
		return nil, err
	}

	// Fallback to BigQuery if Firestore empty
	if len(list) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listDispatchPayrollsFromBigQuery(ctx, date); bqErr == nil && len(bqRes) > 0 {
			list = bqRes
		}
	}

	r.sortDispatchPayrolls(list)
	return list, nil
}

func (r *FirestoreDispatchRepository) sortDispatchPayrolls(list []*models.DispatchPayrollRecord) {
	sort.Slice(list, func(i, j int) bool {
		if list[i].RouteNo != list[j].RouteNo {
			return list[i].RouteNo < list[j].RouteNo
		}
		return list[i].Role < list[j].Role
	})
}

func (r *FirestoreDispatchRepository) CheckOutCrew(ctx context.Context, shiftID string, req *models.CrewCheckOutRequest) (*models.DispatchShift, error) {
	docRef := r.client.Collection(r.dispatchColl).Doc(shiftID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, ErrDispatchShiftNotFound
	}
	var ds models.DispatchShift
	if err := snap.DataTo(&ds); err != nil {
		return nil, err
	}
	ds.ID = docRef.ID

	now := time.Now().UTC().Format(time.RFC3339)
	var updates []firestore.Update
	updates = append(updates, firestore.Update{Path: "updatedAt", Value: now})

	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role != "attendant" {
		role = "driver"
	}

	timeStr := time.Now().Format("15:04")
	if req.CheckOutTime != nil && *req.CheckOutTime != "" {
		timeStr = *req.CheckOutTime
	}

	comments := ""
	if req.PayrollComments != nil {
		comments = strings.TrimSpace(*req.PayrollComments)
	}

	if req.Undo {
		if role == "driver" {
			ds.IsDriverCheckedOut = false
			ds.DriverCheckedOutAt = nil
			ds.DriverCheckoutComments = ""
			updates = append(updates,
				firestore.Update{Path: "isDriverCheckedOut", Value: false},
				firestore.Update{Path: "driverCheckedOutAt", Value: firestore.Delete},
				firestore.Update{Path: "driverCheckoutComments", Value: firestore.Delete},
			)
		} else {
			ds.IsAttendantCheckedOut = false
			ds.AttendantCheckedOutAt = nil
			ds.AttendantCheckoutComments = ""
			updates = append(updates,
				firestore.Update{Path: "isAttendantCheckedOut", Value: false},
				firestore.Update{Path: "attendantCheckedOutAt", Value: firestore.Delete},
				firestore.Update{Path: "attendantCheckoutComments", Value: firestore.Delete},
			)
		}

		if _, err := docRef.Update(ctx, updates); err != nil {
			return nil, err
		}

		payrollID := fmt.Sprintf("DP-%s-%s", shiftID, role)
		pRef := r.client.Collection(r.dispatchPayrollColl).Doc(payrollID)
		_, _ = pRef.Update(ctx, []firestore.Update{
			{Path: "checkOutTime", Value: firestore.Delete},
			{Path: "hasComments", Value: false},
			{Path: "status", Value: "pending_checkout"},
			{Path: "syncedToFinance", Value: false},
			{Path: "updatedAt", Value: now},
		})
		_ = r.RemoveFromPayrollLog(ctx, payrollID)
		return &ds, nil
	}

	if role == "driver" {
		ds.IsDriverCheckedOut = true
		ds.DriverCheckedOutAt = &timeStr
		ds.DriverCheckoutComments = comments
		updates = append(updates,
			firestore.Update{Path: "isDriverCheckedOut", Value: true},
			firestore.Update{Path: "driverCheckedOutAt", Value: timeStr},
			firestore.Update{Path: "driverCheckoutComments", Value: comments},
		)
	} else {
		ds.IsAttendantCheckedOut = true
		ds.AttendantCheckedOutAt = &timeStr
		ds.AttendantCheckoutComments = comments
		updates = append(updates,
			firestore.Update{Path: "isAttendantCheckedOut", Value: true},
			firestore.Update{Path: "attendantCheckedOutAt", Value: timeStr},
			firestore.Update{Path: "attendantCheckoutComments", Value: comments},
		)
	}

	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, err
	}

	payrollID := fmt.Sprintf("DP-%s-%s", shiftID, role)
	pRef := r.client.Collection(r.dispatchPayrollColl).Doc(payrollID)
	pSnap, pErr := pRef.Get(ctx)
	if pErr == nil && pSnap.Exists() {
		var pRec models.DispatchPayrollRecord
		if err := pSnap.DataTo(&pRec); err == nil {
			pRec.CheckOutTime = timeStr
			if comments != "" {
				pRec.HasComments = true
				pRec.PayrollComments = comments
				pRec.Status = "pending_approval"
				pRec.SyncedToFinance = false
				_ = r.RemoveFromPayrollLog(ctx, payrollID)
			} else {
				pRec.HasComments = false
				pRec.Status = "approved"
				if pRec.PayRate > 0 {
					_, _ = r.SyncToPayrollLog(ctx, &pRec)
					pRec.SyncedToFinance = true
				} else {
					pRec.SyncedToFinance = false
					_ = r.RemoveFromPayrollLog(ctx, payrollID)
				}
			}
			pRec.UpdatedAt = now
			_, _ = pRef.Set(ctx, pRec)
		}
	} else {
		pRec, gErr := r.GenerateDispatchPayroll(ctx, shiftID, role, "")
		if gErr == nil && pRec != nil {
			pRec.CheckOutTime = timeStr
			if comments != "" {
				pRec.HasComments = true
				pRec.PayrollComments = comments
				pRec.Status = "pending_approval"
				pRec.SyncedToFinance = false
			} else {
				pRec.HasComments = false
				pRec.Status = "approved"
				if pRec.PayRate > 0 {
					_, _ = r.SyncToPayrollLog(ctx, pRec)
					pRec.SyncedToFinance = true
				}
			}
			pRec.UpdatedAt = now
			_, _ = pRef.Set(ctx, pRec)
		}
	}

	return &ds, nil
}

func (r *FirestoreDispatchRepository) ApproveDispatchPayroll(ctx context.Context, payrollID string, req *models.ApproveDispatchPayrollRequest) (*models.DispatchPayrollRecord, error) {
	docRef := r.client.Collection(r.dispatchPayrollColl).Doc(payrollID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("dispatch payroll record not found: %s", payrollID)
	}
	var rec models.DispatchPayrollRecord
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID

	if req.PayRate != nil {
		rec.PayRate = *req.PayRate
	}
	if req.EiHours != nil {
		rec.EiHours = *req.EiHours
	}
	if req.PayOption != nil && *req.PayOption != "" {
		rec.PayOption = *req.PayOption
	}
	if req.PayrollComments != nil {
		rec.PayrollComments = *req.PayrollComments
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	rec.Status = "approved"
	approver := "Dispatcher"
	if req.ApprovedBy != "" {
		approver = req.ApprovedBy
	}
	rec.ApprovedBy = &approver
	rec.ApprovedAt = &now
	rec.UpdatedBy = &approver
	rec.RejectedBy = nil
	rec.RejectedAt = nil
	rec.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if rec.PayRate > 0 {
		_, _ = r.SyncToPayrollLog(ctx, &rec)
		rec.SyncedToFinance = true
	} else {
		_ = r.RemoveFromPayrollLog(ctx, payrollID)
		rec.SyncedToFinance = false
	}

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) RejectDispatchPayroll(ctx context.Context, payrollID string, req *models.RejectDispatchPayrollRequest) (*models.DispatchPayrollRecord, error) {
	docRef := r.client.Collection(r.dispatchPayrollColl).Doc(payrollID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("dispatch payroll record not found: %s", payrollID)
	}
	var rec models.DispatchPayrollRecord
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID

	now := time.Now().Format("2006-01-02 15:04:05")
	rec.Status = "rejected"
	rejector := "Dispatcher"
	if req.RejectedBy != "" {
		rejector = req.RejectedBy
	}
	rec.RejectedBy = &rejector
	rec.RejectedAt = &now
	rec.UpdatedBy = &rejector
	rec.ApprovedBy = nil
	rec.ApprovedAt = nil
	rec.SyncedToFinance = false
	rec.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	_ = r.RemoveFromPayrollLog(ctx, payrollID)

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) SyncToPayrollLog(ctx context.Context, p *models.DispatchPayrollRecord) (*models.PayrollDepartmentLogRecord, error) {
	needsDispatchApproval := p.Status == "pending_approval" || p.HasComments || (strings.TrimSpace(p.PayrollComments) != "")
	if p.PayRate <= 0 || needsDispatchApproval {
		_ = r.RemoveFromPayrollLog(ctx, p.ID)
		return nil, nil
	}

	logID := fmt.Sprintf("PL-%s-%s", p.ShiftID, p.Role)
	docRef := r.client.Collection(r.payrollLogColl).Doc(logID)
	now := time.Now().UTC().Format(time.RFC3339)

	snap, err := docRef.Get(ctx)
	var logRec models.PayrollDepartmentLogRecord
	if err == nil && snap.Exists() {
		_ = snap.DataTo(&logRec)
		logRec.ID = logID
		logRec.DispatchPayrollID = p.ID
		logRec.DispatchDate = p.DispatchDate
		logRec.ShiftID = p.ShiftID
		logRec.RouteNo = p.RouteNo
		logRec.RouteName = p.RouteName
		logRec.ShiftType = p.ShiftType
		logRec.SchoolBoardCode = p.SchoolBoardCode
		logRec.EmployeeID = p.EmployeeID
		logRec.EmployeeName = p.EmployeeName
		logRec.Role = p.Role
		logRec.UnitNumber = p.UnitNumber
		logRec.CheckInTime = p.CheckInTime
		logRec.CheckOutTime = p.CheckOutTime
		logRec.PayOption = p.PayOption
		logRec.OriginalPayRate = p.PayRate
		logRec.PayAmount = p.PayRate
		logRec.OriginalEiHours = p.EiHours
		logRec.EiHours = p.EiHours
		logRec.RateSource = p.RateSource
		logRec.RateDescription = p.RateDescription
		logRec.DispatcherComments = p.PayrollComments
		logRec.IsCharter = p.IsCharter
		logRec.CharterTripID = p.CharterTripID
		logRec.CharterAssignmentID = p.CharterAssignmentID
		logRec.ClientName = p.ClientName
		logRec.Status = "approved"
		logRec.UpdatedAt = now
		if p.ApprovedBy != nil {
			logRec.ApprovedBy = *p.ApprovedBy
			logRec.UpdatedBy = *p.ApprovedBy
		}
		if p.ApprovedAt != nil {
			logRec.ApprovedAt = *p.ApprovedAt
		}
	} else {
		logRec = models.PayrollDepartmentLogRecord{
			ID:                  logID,
			DispatchPayrollID:   p.ID,
			DispatchDate:        p.DispatchDate,
			ShiftID:             p.ShiftID,
			RouteNo:             p.RouteNo,
			RouteName:           p.RouteName,
			ShiftType:           p.ShiftType,
			SchoolBoardCode:     p.SchoolBoardCode,
			EmployeeID:          p.EmployeeID,
			EmployeeName:        p.EmployeeName,
			Role:                p.Role,
			UnitNumber:          p.UnitNumber,
			CheckInTime:         p.CheckInTime,
			CheckOutTime:        p.CheckOutTime,
			PayOption:           p.PayOption,
			OriginalPayRate:     p.PayRate,
			PayAmount:           p.PayRate,
			OriginalEiHours:     p.EiHours,
			EiHours:             p.EiHours,
			RateSource:          p.RateSource,
			RateDescription:     p.RateDescription,
			DispatcherComments:  p.PayrollComments,
			IsCharter:           p.IsCharter,
			CharterTripID:       p.CharterTripID,
			CharterAssignmentID: p.CharterAssignmentID,
			ClientName:          p.ClientName,
			Status:              "approved",
			SyncedAt:            now,
			UpdatedAt:           now,
		}
		if p.ApprovedBy != nil {
			logRec.ApprovedBy = *p.ApprovedBy
			logRec.UpdatedBy = *p.ApprovedBy
		}
		if p.ApprovedAt != nil {
			logRec.ApprovedAt = *p.ApprovedAt
		}
	}

	if _, err := docRef.Set(ctx, logRec); err != nil {
		return nil, err
	}
	return &logRec, nil
}

func (r *FirestoreDispatchRepository) RemoveFromPayrollLog(ctx context.Context, dispatchPayrollID string) error {
	logID := strings.Replace(dispatchPayrollID, "DP-", "PL-", 1)
	_, err := r.client.Collection(r.payrollLogColl).Doc(logID).Delete(ctx)
	return err
}

func (r *FirestoreDispatchRepository) SyncCleanPayrollsForDate(ctx context.Context, date string) (int, error) {
	if date == "" || r.client == nil {
		return 0, nil
	}

	payrolls, err := r.ListDispatchPayrolls(ctx, date)
	if err != nil {
		return 0, err
	}

	syncedCount := 0
	for _, p := range payrolls {
		if p == nil {
			continue
		}
		needsApproval := p.Status == "pending_approval" || p.HasComments || (strings.TrimSpace(p.PayrollComments) != "")
		if !needsApproval && p.PayRate > 0 {
			_, syncErr := r.SyncToPayrollLog(ctx, p)
			if syncErr == nil {
				syncedCount++
				if !p.SyncedToFinance {
					p.SyncedToFinance = true
					p.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
					_, _ = r.client.Collection(r.dispatchPayrollColl).Doc(p.ID).Set(ctx, p)
				}
			}
		}
	}
	return syncedCount, nil
}

func (r *FirestoreDispatchRepository) listPayrollDepartmentLogsFromFirestore(ctx context.Context, date string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error) {
	if r.client == nil {
		return []*models.PayrollDepartmentLogRecord{}, nil
	}
	var q firestore.Query = r.client.Collection(r.payrollLogColl).Query
	if date != "" {
		q = q.Where("dispatchDate", "==", date)
	}
	if status != "" && status != "all" {
		q = q.Where("status", "==", status)
	}
	if employeeID != "" && employeeID != "all" {
		q = q.Where("employeeId", "==", employeeID)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	list := make([]*models.PayrollDepartmentLogRecord, 0)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.PayrollDepartmentLogRecord
		if err := doc.DataTo(&rec); err == nil {
			if rec.ID == "" {
				rec.ID = doc.Ref.ID
			}
			list = append(list, &rec)
		}
	}
	return list, nil
}

func (r *FirestoreDispatchRepository) listPayrollDepartmentLogsFromBigQuery(ctx context.Context, date string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE 1=1",
		r.projectID, r.bqDataset, r.payrollLogColl)
	var params []bigquery.QueryParameter

	if date != "" {
		querySQL += " AND dispatch_date = @date"
		params = append(params, bigquery.QueryParameter{Name: "date", Value: date})
	}
	if status != "" && status != "all" {
		querySQL += " AND JSON_VALUE(data, '$.status') = @status"
		params = append(params, bigquery.QueryParameter{Name: "status", Value: status})
	}
	if employeeID != "" && employeeID != "all" {
		querySQL += " AND JSON_VALUE(data, '$.employeeId') = @employeeId"
		params = append(params, bigquery.QueryParameter{Name: "employeeId", Value: employeeID})
	}

	q := r.bqClient.Query(querySQL)
	q.Parameters = params

	it, err := q.Read(ctx)
	if err != nil {
		// Fallback to _raw_latest in case Firebase extension was used
		querySQL = fmt.Sprintf("SELECT document_id AS id, data FROM `%s.%s.%s_raw_latest` WHERE 1=1",
			r.projectID, r.bqDataset, r.payrollLogColl)
		params = nil
		if date != "" {
			querySQL += " AND JSON_VALUE(data, '$.dispatchDate') = @date"
			params = append(params, bigquery.QueryParameter{Name: "date", Value: date})
		}
		if status != "" && status != "all" {
			querySQL += " AND JSON_VALUE(data, '$.status') = @status"
			params = append(params, bigquery.QueryParameter{Name: "status", Value: status})
		}
		if employeeID != "" && employeeID != "all" {
			querySQL += " AND JSON_VALUE(data, '$.employeeId') = @employeeId"
			params = append(params, bigquery.QueryParameter{Name: "employeeId", Value: employeeID})
		}
		q = r.bqClient.Query(querySQL)
		q.Parameters = params
		it, err = q.Read(ctx)
		if err != nil {
			log.Printf("[BIGQUERY] ListPayrollDepartmentLogs query error: %v", err)
			return nil, err
		}
	}

	list := make([]*models.PayrollDepartmentLogRecord, 0)
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("[BIGQUERY] ListPayrollDepartmentLogs row decode error: %v", err)
			return nil, err
		}

		var rec models.PayrollDepartmentLogRecord
		if err := json.Unmarshal([]byte(row.Data), &rec); err == nil {
			if rec.ID == "" {
				rec.ID = row.ID
			}
			list = append(list, &rec)
		}
	}

	return list, nil
}

func (r *FirestoreDispatchRepository) ListPayrollDepartmentLogs(ctx context.Context, date string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error) {
	var list []*models.PayrollDepartmentLogRecord
	var err error

	// If date is provided and cold, query BigQuery first
	if date != "" && r.isColdDate(date) {
		list, err = r.listPayrollDepartmentLogsFromBigQuery(ctx, date, status, employeeID)
		if err == nil && len(list) > 0 {
			r.sortPayrollDepartmentLogs(list)
			return list, nil
		}
	}

	// Auto-sync clean dispatch payrolls if it's hot active data
	if date != "" && !r.isColdDate(date) {
		_, _ = r.SyncCleanPayrollsForDate(ctx, date)
	}

	// Query Firestore
	list, err = r.listPayrollDepartmentLogsFromFirestore(ctx, date, status, employeeID)
	if err != nil {
		return nil, err
	}

	// Fallback to BigQuery if specific date requested and Firestore returned empty
	if date != "" && len(list) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listPayrollDepartmentLogsFromBigQuery(ctx, date, status, employeeID); bqErr == nil && len(bqRes) > 0 {
			list = bqRes
		}
	}

	r.sortPayrollDepartmentLogs(list)
	return list, nil
}

func (r *FirestoreDispatchRepository) listPayrollDepartmentLogsRangeFromFirestore(ctx context.Context, startDate string, endDate string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error) {
	if r.client == nil {
		return []*models.PayrollDepartmentLogRecord{}, nil
	}
	var q firestore.Query = r.client.Collection(r.payrollLogColl).Query
	if startDate != "" {
		q = q.Where("dispatchDate", ">=", startDate)
	}
	if endDate != "" {
		q = q.Where("dispatchDate", "<=", endDate)
	}
	if status != "" && status != "all" {
		q = q.Where("status", "==", status)
	}
	if employeeID != "" && employeeID != "all" {
		q = q.Where("employeeId", "==", employeeID)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	list := make([]*models.PayrollDepartmentLogRecord, 0)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.PayrollDepartmentLogRecord
		if err := doc.DataTo(&rec); err == nil {
			if rec.ID == "" {
				rec.ID = doc.Ref.ID
			}
			list = append(list, &rec)
		}
	}
	return list, nil
}

func (r *FirestoreDispatchRepository) listPayrollDepartmentLogsRangeFromBigQuery(ctx context.Context, startDate string, endDate string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE 1=1",
		r.projectID, r.bqDataset, r.payrollLogColl)
	var params []bigquery.QueryParameter

	if startDate != "" && endDate != "" {
		querySQL += " AND SAFE_CAST(dispatch_date AS DATE) BETWEEN @startDate AND @endDate"
		params = append(params, bigquery.QueryParameter{Name: "startDate", Value: startDate})
		params = append(params, bigquery.QueryParameter{Name: "endDate", Value: endDate})
	} else if startDate != "" {
		querySQL += " AND SAFE_CAST(dispatch_date AS DATE) >= @startDate"
		params = append(params, bigquery.QueryParameter{Name: "startDate", Value: startDate})
	} else if endDate != "" {
		querySQL += " AND SAFE_CAST(dispatch_date AS DATE) <= @endDate"
		params = append(params, bigquery.QueryParameter{Name: "endDate", Value: endDate})
	}

	if status != "" && status != "all" {
		querySQL += " AND JSON_VALUE(data, '$.status') = @status"
		params = append(params, bigquery.QueryParameter{Name: "status", Value: status})
	}
	if employeeID != "" && employeeID != "all" {
		querySQL += " AND JSON_VALUE(data, '$.employeeId') = @employeeId"
		params = append(params, bigquery.QueryParameter{Name: "employeeId", Value: employeeID})
	}

	q := r.bqClient.Query(querySQL)
	q.Parameters = params

	it, err := q.Read(ctx)
	if err != nil {
		// Fallback to JSON_VALUE on data if partition column dispatch_date query encounters issues
		querySQL = fmt.Sprintf("SELECT document_id AS id, data FROM `%s.%s.%s_raw_latest` WHERE 1=1",
			r.projectID, r.bqDataset, r.payrollLogColl)
		params = nil
		if startDate != "" && endDate != "" {
			querySQL += " AND JSON_VALUE(data, '$.dispatchDate') BETWEEN @startDate AND @endDate"
			params = append(params, bigquery.QueryParameter{Name: "startDate", Value: startDate})
			params = append(params, bigquery.QueryParameter{Name: "endDate", Value: endDate})
		}
		if status != "" && status != "all" {
			querySQL += " AND JSON_VALUE(data, '$.status') = @status"
			params = append(params, bigquery.QueryParameter{Name: "status", Value: status})
		}
		if employeeID != "" && employeeID != "all" {
			querySQL += " AND JSON_VALUE(data, '$.employeeId') = @employeeId"
			params = append(params, bigquery.QueryParameter{Name: "employeeId", Value: employeeID})
		}
		q = r.bqClient.Query(querySQL)
		q.Parameters = params
		it, err = q.Read(ctx)
		if err != nil {
			log.Printf("[BIGQUERY] ListPayrollDepartmentLogsRange query error: %v", err)
			return nil, err
		}
	}

	list := make([]*models.PayrollDepartmentLogRecord, 0)
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("[BIGQUERY] ListPayrollDepartmentLogsRange row decode error: %v", err)
			return nil, err
		}

		var rec models.PayrollDepartmentLogRecord
		if err := json.Unmarshal([]byte(row.Data), &rec); err == nil {
			if rec.ID == "" {
				rec.ID = row.ID
			}
			list = append(list, &rec)
		}
	}

	return list, nil
}

func (r *FirestoreDispatchRepository) ListPayrollDepartmentLogsRange(ctx context.Context, startDate string, endDate string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error) {
	var list []*models.PayrollDepartmentLogRecord
	var err error

	// If startDate is cold (> 60 days) or cold retention met, query BigQuery first
	if startDate != "" && r.isColdDate(startDate) && r.bqClient != nil {
		list, err = r.listPayrollDepartmentLogsRangeFromBigQuery(ctx, startDate, endDate, status, employeeID)
		if err == nil && len(list) > 0 {
			r.sortPayrollDepartmentLogs(list)
			return list, nil
		}
	}

	// Query Firestore with date range
	list, err = r.listPayrollDepartmentLogsRangeFromFirestore(ctx, startDate, endDate, status, employeeID)
	if err != nil {
		return nil, err
	}

	// Fallback to BigQuery if Firestore returned empty and bqClient is initialized
	if len(list) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listPayrollDepartmentLogsRangeFromBigQuery(ctx, startDate, endDate, status, employeeID); bqErr == nil && len(bqRes) > 0 {
			list = bqRes
		}
	}

	r.sortPayrollDepartmentLogs(list)
	return list, nil
}

func (r *FirestoreDispatchRepository) sortPayrollDepartmentLogs(list []*models.PayrollDepartmentLogRecord) {
	sort.Slice(list, func(i, j int) bool {
		if list[i].DispatchDate != list[j].DispatchDate {
			return list[i].DispatchDate > list[j].DispatchDate
		}
		if list[i].RouteNo != list[j].RouteNo {
			return list[i].RouteNo < list[j].RouteNo
		}
		return list[i].Role < list[j].Role
	})
}

func (r *FirestoreDispatchRepository) UpdatePayrollDepartmentLog(ctx context.Context, logID string, req *models.UpdatePayrollDepartmentLogRequest) (*models.PayrollDepartmentLogRecord, error) {
	docRef := r.client.Collection(r.payrollLogColl).Doc(logID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("payroll log record not found: %s", logID)
	}
	var rec models.PayrollDepartmentLogRecord
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID

	if req.PayAmount != nil {
		rec.PayAmount = *req.PayAmount
	}
	if req.EiHours != nil {
		rec.EiHours = *req.EiHours
	}
	if req.PayrollNotes != nil {
		rec.PayrollNotes = *req.PayrollNotes
	}
	if req.Status != nil && *req.Status != "" {
		rec.Status = *req.Status
	}
	if req.UpdatedBy != "" {
		rec.UpdatedBy = req.UpdatedBy
	}
	rec.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) ListTemporaryAssignments(ctx context.Context, routeID string, date string, status string) ([]*models.TemporaryAssignment, error) {
	if r.client == nil {
		return []*models.TemporaryAssignment{}, nil
	}
	var q firestore.Query = r.client.Collection(r.temporaryAssignmentColl).Query
	if status != "" && status != "all" {
		q = q.Where("status", "==", status)
	}
	if routeID != "" && routeID != "all" {
		q = q.Where("routeId", "==", routeID)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	list := make([]*models.TemporaryAssignment, 0)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.TemporaryAssignment
		if err := doc.DataTo(&rec); err == nil {
			if rec.ID == "" {
				rec.ID = doc.Ref.ID
			}
			if date != "" {
				if !isTemporaryAssignmentActiveOnDate(date, &rec) {
					continue
				}
			}
			list = append(list, &rec)
		}
	}

	sort.Slice(list, func(i, j int) bool {
		if list[i].StartDate != list[j].StartDate {
			return list[i].StartDate > list[j].StartDate
		}
		return list[i].RouteNo < list[j].RouteNo
	})

	return list, nil
}

func (r *FirestoreDispatchRepository) GetTemporaryAssignmentByID(ctx context.Context, id string) (*models.TemporaryAssignment, error) {
	docRef := r.client.Collection(r.temporaryAssignmentColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("temporary assignment not found: %s", id)
	}
	var rec models.TemporaryAssignment
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) CreateTemporaryAssignment(ctx context.Context, req *models.CreateTemporaryAssignmentRequest) (*models.TemporaryAssignment, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	id := fmt.Sprintf("TA-%d", time.Now().UnixNano()/1000000)

	status := "active"
	endDate := req.EndDate
	if endDate == "" {
		endDate = req.StartDate
	}

	shiftType := "ALL"
	if req.ShiftType != "" {
		shiftType = req.ShiftType
	}

	rec := models.TemporaryAssignment{
		ID:                      id,
		RouteID:                 req.RouteID,
		RouteNo:                 req.RouteNo,
		RouteName:               req.RouteName,
		ShiftType:               shiftType,
		BusRouteShiftID:         req.BusRouteShiftID,
		StartDate:               req.StartDate,
		EndDate:                 endDate,
		SpecificDates:           req.SpecificDates,
		OriginalDriverID:        req.OriginalDriverID,
		OriginalDriverName:      req.OriginalDriverName,
		TemporaryDriverID:       req.TemporaryDriverID,
		TemporaryDriverName:     req.TemporaryDriverName,
		TemporaryDriverPhone:    req.TemporaryDriverPhone,
		OriginalAttendantID:     req.OriginalAttendantID,
		OriginalAttendantName:   req.OriginalAttendantName,
		TemporaryAttendantID:    req.TemporaryAttendantID,
		TemporaryAttendantName:  req.TemporaryAttendantName,
		TemporaryAttendantPhone: req.TemporaryAttendantPhone,
		TemporaryVehicleID:      req.TemporaryVehicleID,
		TemporaryUnitNumber:     req.TemporaryUnitNumber,
		TemporaryPlateNumber:    req.TemporaryPlateNumber,
		Reason:                  req.Reason,
		Notes:                   req.Notes,
		Status:                  status,
		CreatedBy:               req.CreatedBy,
		CreatedAt:               now,
		UpdatedAt:               now,
	}

	if _, err := r.client.Collection(r.temporaryAssignmentColl).Doc(id).Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) UpdateTemporaryAssignment(ctx context.Context, id string, req *models.UpdateTemporaryAssignmentRequest) (*models.TemporaryAssignment, error) {
	docRef := r.client.Collection(r.temporaryAssignmentColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("temporary assignment not found: %s", id)
	}
	var rec models.TemporaryAssignment
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID

	if req.ShiftType != nil && *req.ShiftType != "" {
		rec.ShiftType = *req.ShiftType
	}
	if req.StartDate != nil && *req.StartDate != "" {
		rec.StartDate = *req.StartDate
	}
	if req.EndDate != nil && *req.EndDate != "" {
		rec.EndDate = *req.EndDate
	}
	if req.SpecificDates != nil {
		rec.SpecificDates = req.SpecificDates
	}
	if req.TemporaryDriverID != nil {
		rec.TemporaryDriverID = *req.TemporaryDriverID
	}
	if req.TemporaryDriverName != nil {
		rec.TemporaryDriverName = *req.TemporaryDriverName
	}
	if req.TemporaryDriverPhone != nil {
		rec.TemporaryDriverPhone = *req.TemporaryDriverPhone
	}
	if req.TemporaryAttendantID != nil {
		rec.TemporaryAttendantID = *req.TemporaryAttendantID
	}
	if req.TemporaryAttendantName != nil {
		rec.TemporaryAttendantName = *req.TemporaryAttendantName
	}
	if req.TemporaryAttendantPhone != nil {
		rec.TemporaryAttendantPhone = *req.TemporaryAttendantPhone
	}
	if req.TemporaryVehicleID != nil {
		rec.TemporaryVehicleID = *req.TemporaryVehicleID
	}
	if req.TemporaryUnitNumber != nil {
		rec.TemporaryUnitNumber = *req.TemporaryUnitNumber
	}
	if req.TemporaryPlateNumber != nil {
		rec.TemporaryPlateNumber = *req.TemporaryPlateNumber
	}
	if req.Reason != nil {
		rec.Reason = *req.Reason
	}
	if req.Notes != nil {
		rec.Notes = *req.Notes
	}
	if req.Status != nil && *req.Status != "" {
		rec.Status = *req.Status
	}
	rec.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) DeleteTemporaryAssignment(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.temporaryAssignmentColl).Doc(id).Delete(ctx)
	return err
}

// ── Time Off Requests (Firestore) ──────────────────────────────────────────

func (r *FirestoreDispatchRepository) ListTimeOffRequests(ctx context.Context, employeeID string, status string, date string) ([]*models.TimeOffRequest, error) {
	return r.ListTimeOffRequestsFiltered(ctx, TimeOffFilter{
		EmployeeID: employeeID,
		Status:     status,
		Date:       date,
	})
}

func (r *FirestoreDispatchRepository) ListTimeOffRequestsFiltered(ctx context.Context, filter TimeOffFilter) ([]*models.TimeOffRequest, error) {
	if r.client == nil {
		return make([]*models.TimeOffRequest, 0), nil
	}

	// 1. If explicit onlyArchive is set, query BigQuery cold storage directly
	if filter.OnlyArchive && r.bqClient != nil {
		return r.listTimeOffRequestsFromBigQueryFiltered(ctx, filter)
	}

	// 2. If single date is specified and it's cold (> 30 days past), query BigQuery first (Dispatch method)
	if filter.Date != "" && r.isTimeOffColdDate(filter.Date) && r.bqClient != nil {
		bqList, err := r.listTimeOffRequestsFromBigQueryFiltered(ctx, filter)
		if err == nil && len(bqList) > 0 {
			return bqList, nil
		}
	}

	// 3. If date range is entirely cold (endDate is < 30 days ago), query BigQuery first
	if filter.EndDate != "" && r.isTimeOffColdDate(filter.EndDate) && r.bqClient != nil {
		bqList, err := r.listTimeOffRequestsFromBigQueryFiltered(ctx, filter)
		if err == nil && len(bqList) > 0 {
			return bqList, nil
		}
	}

	// 4. Query Firestore hot collection
	var q firestore.Query = r.client.Collection(r.timeOffColl).Query
	if filter.Status != "" && filter.Status != "all" {
		q = q.Where("status", "==", filter.Status)
	}
	if filter.EmployeeID != "" && filter.EmployeeID != "all" {
		q = q.Where("employeeId", "==", filter.EmployeeID)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	list := make([]*models.TimeOffRequest, 0)
	seenIDs := make(map[string]bool)

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.TimeOffRequest
		if err := doc.DataTo(&rec); err == nil {
			if rec.ID == "" {
				rec.ID = doc.Ref.ID
			}
			if filter.Date != "" {
				if rec.StartDate != "" && filter.Date < rec.StartDate {
					continue
				}
				if rec.EndDate != "" && filter.Date > rec.EndDate {
					continue
				}
			}
			if filter.StartDate != "" && rec.EndDate != "" && rec.EndDate < filter.StartDate {
				continue
			}
			if filter.EndDate != "" && rec.StartDate != "" && rec.StartDate > filter.EndDate {
				continue
			}
			seenIDs[rec.ID] = true
			list = append(list, &rec)
		}
	}

	// 5. Fallback or Archive Inclusion (Dispatch method)
	// If includeArchive is true OR if Firestore returned 0 records and BigQuery is configured
	shouldQueryBQ := (filter.IncludeArchive || len(list) == 0) && r.bqClient != nil
	if shouldQueryBQ {
		if bqRes, bqErr := r.listTimeOffRequestsFromBigQueryFiltered(ctx, filter); bqErr == nil && len(bqRes) > 0 {
			for _, bqRec := range bqRes {
				if !seenIDs[bqRec.ID] {
					seenIDs[bqRec.ID] = true
					list = append(list, bqRec)
				}
			}
		}
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})
	return list, nil
}

func (r *FirestoreDispatchRepository) listTimeOffRequestsFromBigQuery(ctx context.Context, employeeID string, status string, date string) ([]*models.TimeOffRequest, error) {
	return r.listTimeOffRequestsFromBigQueryFiltered(ctx, TimeOffFilter{
		EmployeeID: employeeID,
		Status:     status,
		Date:       date,
	})
}

func (r *FirestoreDispatchRepository) listTimeOffRequestsFromBigQueryFiltered(ctx context.Context, filter TimeOffFilter) ([]*models.TimeOffRequest, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE 1=1",
		r.projectID, r.bqDataset, r.timeOffColl)
	var params []bigquery.QueryParameter

	if filter.EmployeeID != "" && filter.EmployeeID != "all" {
		querySQL += " AND JSON_VALUE(data, '$.employeeId') = @employeeId"
		params = append(params, bigquery.QueryParameter{Name: "employeeId", Value: filter.EmployeeID})
	}
	if filter.Status != "" && filter.Status != "all" {
		querySQL += " AND JSON_VALUE(data, '$.status') = @status"
		params = append(params, bigquery.QueryParameter{Name: "status", Value: filter.Status})
	}
	if filter.Date != "" {
		querySQL += " AND JSON_VALUE(data, '$.startDate') <= @date AND JSON_VALUE(data, '$.endDate') >= @date"
		params = append(params, bigquery.QueryParameter{Name: "date", Value: filter.Date})
	}
	if filter.StartDate != "" {
		querySQL += " AND JSON_VALUE(data, '$.endDate') >= @startDate"
		params = append(params, bigquery.QueryParameter{Name: "startDate", Value: filter.StartDate})
	} else if filter.Date == "" && !filter.FullArchive {
		// By default, only retrieve cold records within past 1 year (rolling 365 days)
		oneYearAgo := time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
		querySQL += " AND JSON_VALUE(data, '$.endDate') >= @defaultOneYearCutoff"
		params = append(params, bigquery.QueryParameter{Name: "defaultOneYearCutoff", Value: oneYearAgo})
	}
	if filter.EndDate != "" {
		querySQL += " AND JSON_VALUE(data, '$.startDate') <= @endDate"
		params = append(params, bigquery.QueryParameter{Name: "endDate", Value: filter.EndDate})
	}

	querySQL += " ORDER BY dispatch_date DESC LIMIT 1000"

	q := r.bqClient.Query(querySQL)
	q.Parameters = params

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var results []*models.TimeOffRequest
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.TimeOffRequest
		if err := json.Unmarshal([]byte(row.Data), &rec); err == nil {
			if rec.ID == "" {
				rec.ID = row.ID
			}
			rec.IsArchivedToBigQuery = true
			rec.BigQueryDataset = r.bqDataset
			rec.BigQueryTable = r.timeOffColl
			results = append(results, &rec)
		}
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) GetTimeOffRequestByID(ctx context.Context, id string) (*models.TimeOffRequest, error) {
	docRef := r.client.Collection(r.timeOffColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		// Fallback to BigQuery if archived
		if r.bqClient != nil {
			if bqRec, bqErr := r.getTimeOffRequestByIDFromBigQuery(ctx, id); bqErr == nil && bqRec != nil {
				return bqRec, nil
			}
		}
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	var rec models.TimeOffRequest
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) getTimeOffRequestByIDFromBigQuery(ctx context.Context, id string) (*models.TimeOffRequest, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE id = @id LIMIT 1",
		r.projectID, r.bqDataset, r.timeOffColl)
	q := r.bqClient.Query(querySQL)
	q.Parameters = []bigquery.QueryParameter{
		{Name: "id", Value: id},
	}

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var row struct {
		ID   string `bigquery:"id"`
		Data string `bigquery:"data"`
	}
	err = it.Next(&row)
	if err != nil {
		return nil, err
	}

	var rec models.TimeOffRequest
	if err := json.Unmarshal([]byte(row.Data), &rec); err != nil {
		return nil, err
	}
	if rec.ID == "" {
		rec.ID = row.ID
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) CreateTimeOffRequest(ctx context.Context, req *models.CreateTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	id := fmt.Sprintf("TOR-%d", time.Now().UnixMilli())
	now := time.Now().UTC()

	shiftType := req.ShiftType
	if shiftType == "" {
		shiftType = "ALL"
	}

	rec := models.TimeOffRequest{
		ID:                id,
		EmployeeID:        req.EmployeeID,
		EmployeeNumber:    req.EmployeeNumber,
		EmployeeName:      req.EmployeeName,
		LeaveType:         req.LeaveType,
		StartDate:         req.StartDate,
		EndDate:           req.EndDate,
		ShiftType:         shiftType,
		Comments:          req.Comments,
		Status:            models.TimeOffStatusPending,
		RequestedByUserID: req.RequestedByUserID,
		RequestedByName:   req.RequestedByName,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if _, err := r.client.Collection(r.timeOffColl).Doc(id).Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) UpdateTimeOffRequest(ctx context.Context, id string, req *models.UpdateTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	docRef := r.client.Collection(r.timeOffColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	var rec models.TimeOffRequest
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID

	if rec.Status != models.TimeOffStatusPending {
		return nil, fmt.Errorf("cannot modify a request that has already been %s", rec.Status)
	}

	if req.LeaveType != "" {
		rec.LeaveType = req.LeaveType
	}
	if req.StartDate != "" {
		rec.StartDate = req.StartDate
	}
	if req.EndDate != "" {
		rec.EndDate = req.EndDate
	}
	if req.ShiftType != "" {
		rec.ShiftType = req.ShiftType
	}
	if req.Comments != "" {
		rec.Comments = req.Comments
	}
	rec.UpdatedAt = time.Now().UTC()

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) ApproveTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	docRef := r.client.Collection(r.timeOffColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	var rec models.TimeOffRequest
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID

	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusApproved
	rec.ApprovedByUserID = req.ReviewerUserID
	rec.ApprovedByName = req.ReviewerName
	rec.ApprovedAt = &now
	rec.ApprovalNotes = req.ApprovalNotes
	if len(req.NotifiedChannels) > 0 {
		rec.NotifiedChannels = req.NotifiedChannels
		rec.NotifiedAt = &now
	}
	rec.UpdatedAt = now

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) RejectTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	docRef := r.client.Collection(r.timeOffColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	var rec models.TimeOffRequest
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID

	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusRejected
	rec.ApprovedByUserID = req.ReviewerUserID
	rec.ApprovedByName = req.ReviewerName
	rec.ApprovedAt = &now
	rec.ApprovalNotes = req.ApprovalNotes
	if len(req.NotifiedChannels) > 0 {
		rec.NotifiedChannels = req.NotifiedChannels
		rec.NotifiedAt = &now
	}
	rec.UpdatedAt = now

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) CancelTimeOffRequest(ctx context.Context, id string, userID string) (*models.TimeOffRequest, error) {
	docRef := r.client.Collection(r.timeOffColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	var rec models.TimeOffRequest
	if err := snap.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = docRef.ID

	if rec.Status != models.TimeOffStatusPending {
		return nil, fmt.Errorf("only pending requests can be cancelled")
	}

	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusCancelled
	rec.UpdatedAt = now

	if _, err := docRef.Set(ctx, rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) DeleteTimeOffRequest(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.timeOffColl).Doc(id).Delete(ctx)
	return err
}

// DefaultTrainingTypes provides built-in training catalog courses
func DefaultTrainingTypes() []*models.TrainingType {
	now := time.Now().UTC()
	return []*models.TrainingType{
		{
			ID:               "TT-DEF-DRV",
			Code:             "DEF-DRV",
			Name:             "Defensive Driving & Winter Operations",
			Category:         "safety",
			DefaultHours:     4.0,
			DefaultPayAmount: 100.0,
			ValidityMonths:   24,
			RequiredForRoles: []string{"driver"},
			Description:      "Winter driving techniques, skidding prevention, mirror checks, and space management.",
			IsActive:         true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			ID:               "TT-FIRST-AID",
			Code:             "FIRST-AID",
			Name:             "Standard First Aid & CPR/AED",
			Category:         "first_aid",
			DefaultHours:     6.0,
			DefaultPayAmount: 150.0,
			ValidityMonths:   36,
			RequiredForRoles: []string{"driver", "attendant"},
			Description:      "Emergency scene management, adult/child CPR, AED operation, and wound dressing.",
			IsActive:         true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			ID:               "TT-WHEELCHAIR",
			Code:             "WHEELCHAIR",
			Name:             "Wheelchair Lift & 4-Point Securement",
			Category:         "technical",
			DefaultHours:     3.0,
			DefaultPayAmount: 75.0,
			ValidityMonths:   24,
			RequiredForRoles: []string{"driver", "attendant"},
			Description:      "Safe hydraulic lift operations, Q'Straint tie-down protocol, occupant lap/shoulder belts.",
			IsActive:         true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			ID:               "TT-STUDENT-MGMT",
			Code:             "STUDENT-MGMT",
			Name:             "Student Behavior Management & Anti-Bullying",
			Category:         "compliance",
			DefaultHours:     3.0,
			DefaultPayAmount: 75.0,
			ValidityMonths:   12,
			RequiredForRoles: []string{"driver", "attendant"},
			Description:      "De-escalation tactics, positive reinforcement, conflict resolution, and incident reporting.",
			IsActive:         true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			ID:               "TT-EV-SAFETY",
			Code:             "EV-SAFETY",
			Name:             "Electric School Bus Safety & Pre-Trip",
			Category:         "technical",
			DefaultHours:     2.5,
			DefaultPayAmount: 65.0,
			ValidityMonths:   12,
			RequiredForRoles: []string{"driver"},
			Description:      "High-voltage manual service disconnect, regenerative braking, depot charging, emergency shutdown.",
			IsActive:         true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
	}
}

func (r *FirestoreDispatchRepository) ListTrainingCourses(ctx context.Context, status string, trainingType string, date string) ([]*models.TrainingCourse, error) {
	docs, err := r.client.Collection(r.trainingCoursesColl).Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	res := make([]*models.TrainingCourse, 0, len(docs))
	for _, doc := range docs {
		var c models.TrainingCourse
		if err := doc.DataTo(&c); err != nil {
			continue
		}
		c.ID = doc.Ref.ID

		if status != "" && status != "all" && string(c.Status) != status {
			continue
		}
		if trainingType != "" && trainingType != "all" && c.TrainingTypeID != trainingType {
			continue
		}
		if date != "" && c.StartDate != date {
			continue
		}
		if c.Registrations == nil {
			c.Registrations = []models.TrainingRegistration{}
		}
		c.RegisteredCount = len(c.Registrations)
		res = append(res, &c)
	}

	sort.Slice(res, func(i, j int) bool {
		if res[i].StartDate != res[j].StartDate {
			return res[i].StartDate > res[j].StartDate
		}
		return res[i].CreatedAt.After(res[j].CreatedAt)
	})

	return res, nil
}

func (r *FirestoreDispatchRepository) GetTrainingCourseByID(ctx context.Context, id string) (*models.TrainingCourse, error) {
	docRef := r.client.Collection(r.trainingCoursesColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	var c models.TrainingCourse
	if err := snap.DataTo(&c); err != nil {
		return nil, err
	}
	c.ID = docRef.ID
	if c.Registrations == nil {
		c.Registrations = []models.TrainingRegistration{}
	}
	c.RegisteredCount = len(c.Registrations)
	return &c, nil
}

func (r *FirestoreDispatchRepository) CreateTrainingCourse(ctx context.Context, req *models.CreateTrainingCoursePayload) (*models.TrainingCourse, error) {
	id := fmt.Sprintf("TC-%d", time.Now().UnixMilli())
	now := time.Now().UTC()

	status := models.TrainingCourseStatusDraft
	if req.Status == string(models.TrainingCourseStatusPublished) {
		status = models.TrainingCourseStatusPublished
	}

	c := models.TrainingCourse{
		ID:               id,
		Title:            req.Title,
		TrainingTypeID:   req.TrainingTypeID,
		TrainingTypeName: req.TrainingTypeName,
		InstructorName:   req.InstructorName,
		Location:         req.Location,
		YardID:           req.YardID,
		YardName:         req.YardName,
		StartDate:        req.StartDate,
		StartTime:        req.StartTime,
		EndTime:          req.EndTime,
		Hours:            req.Hours,
		PayAmount:        req.PayAmount,
		MaxSeats:         req.MaxSeats,
		RegisteredCount:  0,
		Status:           status,
		EligibleRoles:    req.EligibleRoles,
		Description:      req.Description,
		Registrations:    []models.TrainingRegistration{},
		CreatedByUserID:  req.CreatedByUserID,
		CreatedByName:    req.CreatedByName,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if _, err := r.client.Collection(r.trainingCoursesColl).Doc(id).Set(ctx, c); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *FirestoreDispatchRepository) UpdateTrainingCourse(ctx context.Context, id string, req *models.UpdateTrainingCoursePayload) (*models.TrainingCourse, error) {
	docRef := r.client.Collection(r.trainingCoursesColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	var c models.TrainingCourse
	if err := snap.DataTo(&c); err != nil {
		return nil, err
	}
	c.ID = docRef.ID

	if req.Title != "" {
		c.Title = req.Title
	}
	if req.TrainingTypeID != "" {
		c.TrainingTypeID = req.TrainingTypeID
	}
	if req.TrainingTypeName != "" {
		c.TrainingTypeName = req.TrainingTypeName
	}
	if req.InstructorName != "" {
		c.InstructorName = req.InstructorName
	}
	if req.Location != "" {
		c.Location = req.Location
	}
	if req.YardID != "" {
		c.YardID = req.YardID
	}
	if req.YardName != "" {
		c.YardName = req.YardName
	}
	if req.StartDate != "" {
		c.StartDate = req.StartDate
	}
	if req.StartTime != "" {
		c.StartTime = req.StartTime
	}
	if req.EndTime != "" {
		c.EndTime = req.EndTime
	}
	if req.Hours != nil {
		c.Hours = *req.Hours
	}
	if req.PayAmount != nil {
		c.PayAmount = *req.PayAmount
	}
	if req.MaxSeats != nil {
		c.MaxSeats = *req.MaxSeats
	}
	if len(req.EligibleRoles) > 0 {
		c.EligibleRoles = req.EligibleRoles
	}
	if req.Description != "" {
		c.Description = req.Description
	}
	if req.Status != "" {
		c.Status = models.TrainingCourseStatus(req.Status)
	}
	c.UpdatedAt = time.Now().UTC()

	if _, err := docRef.Set(ctx, c); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *FirestoreDispatchRepository) PublishTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error) {
	docRef := r.client.Collection(r.trainingCoursesColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	var c models.TrainingCourse
	if err := snap.DataTo(&c); err != nil {
		return nil, err
	}
	c.ID = docRef.ID
	c.Status = models.TrainingCourseStatusPublished
	c.UpdatedAt = time.Now().UTC()

	if _, err := docRef.Set(ctx, c); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *FirestoreDispatchRepository) CancelTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error) {
	docRef := r.client.Collection(r.trainingCoursesColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	var c models.TrainingCourse
	if err := snap.DataTo(&c); err != nil {
		return nil, err
	}
	c.ID = docRef.ID
	c.Status = models.TrainingCourseStatusCancelled
	c.UpdatedAt = time.Now().UTC()

	if _, err := docRef.Set(ctx, c); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *FirestoreDispatchRepository) CompleteTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error) {
	docRef := r.client.Collection(r.trainingCoursesColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	var c models.TrainingCourse
	if err := snap.DataTo(&c); err != nil {
		return nil, err
	}
	c.ID = docRef.ID
	c.Status = models.TrainingCourseStatusCompleted
	c.UpdatedAt = time.Now().UTC()

	if _, err := docRef.Set(ctx, c); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *FirestoreDispatchRepository) DeleteTrainingCourse(ctx context.Context, id string) error {
	_, err := r.client.Collection(r.trainingCoursesColl).Doc(id).Delete(ctx)
	return err
}

func (r *FirestoreDispatchRepository) RegisterAttendee(ctx context.Context, courseID string, req *models.RegisterAttendeePayload) (*models.TrainingCourse, error) {
	docRef := r.client.Collection(r.trainingCoursesColl).Doc(courseID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("training course not found: %s", courseID)
	}
	var c models.TrainingCourse
	if err := snap.DataTo(&c); err != nil {
		return nil, err
	}
	c.ID = docRef.ID

	if c.Registrations == nil {
		c.Registrations = []models.TrainingRegistration{}
	}

	// Check if already registered
	for _, reg := range c.Registrations {
		if reg.EmployeeID == req.EmployeeID && reg.Status != models.TrainingRegistrationStatusCancelledByUser && reg.Status != models.TrainingRegistrationStatusCancelledByAdmin {
			return nil, fmt.Errorf("employee is already registered for this course")
		}
	}

	// Check capacity
	activeCount := 0
	for _, reg := range c.Registrations {
		if reg.Status != models.TrainingRegistrationStatusCancelledByUser && reg.Status != models.TrainingRegistrationStatusCancelledByAdmin {
			activeCount++
		}
	}
	if c.MaxSeats > 0 && activeCount >= c.MaxSeats {
		return nil, fmt.Errorf("course is full (maximum %d seats reached)", c.MaxSeats)
	}

	regID := fmt.Sprintf("TR-%d-%s", time.Now().UnixMilli(), req.EmployeeID)
	now := time.Now().UTC()
	newReg := models.TrainingRegistration{
		ID:             regID,
		CourseID:       courseID,
		EmployeeID:     req.EmployeeID,
		EmployeeName:   req.EmployeeName,
		EmployeeNumber: req.EmployeeNumber,
		JobTitle:       req.JobTitle,
		Status:         models.TrainingRegistrationStatusRegistered,
		RegisteredAt:   now,
		Notes:          req.Notes,
	}

	c.Registrations = append(c.Registrations, newReg)
	c.RegisteredCount = activeCount + 1
	c.UpdatedAt = now

	if _, err := docRef.Set(ctx, c); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *FirestoreDispatchRepository) UpdateAttendeeStatus(ctx context.Context, courseID string, registrationID string, req *models.UpdateAttendeeStatusPayload) (*models.TrainingCourse, error) {
	docRef := r.client.Collection(r.trainingCoursesColl).Doc(courseID)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("training course not found: %s", courseID)
	}
	var c models.TrainingCourse
	if err := snap.DataTo(&c); err != nil {
		return nil, err
	}
	c.ID = docRef.ID

	found := false
	now := time.Now().UTC()
	for i := range c.Registrations {
		if c.Registrations[i].ID == registrationID {
			found = true
			c.Registrations[i].Status = models.TrainingRegistrationStatus(req.Status)
			if req.Status == string(models.TrainingRegistrationStatusCheckedIn) {
				c.Registrations[i].CheckedInAt = &now
			}
			if req.Status == string(models.TrainingRegistrationStatusCompleted) {
				c.Registrations[i].CompletedAt = &now
			}
			if req.Passed != nil {
				c.Registrations[i].Passed = req.Passed
			}
			if req.Score != nil {
				c.Registrations[i].Score = req.Score
			}
			if req.Notes != "" {
				c.Registrations[i].Notes = req.Notes
			}
			break
		}
	}
	if !found {
		return nil, fmt.Errorf("registration not found: %s", registrationID)
	}

	// Recount active registrations
	activeCount := 0
	for _, reg := range c.Registrations {
		if reg.Status != models.TrainingRegistrationStatusCancelledByUser && reg.Status != models.TrainingRegistrationStatusCancelledByAdmin {
			activeCount++
		}
	}
	c.RegisteredCount = activeCount
	c.UpdatedAt = now

	if _, err := docRef.Set(ctx, c); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *FirestoreDispatchRepository) CancelRegistration(ctx context.Context, courseID string, registrationID string) (*models.TrainingCourse, error) {
	return r.UpdateAttendeeStatus(ctx, courseID, registrationID, &models.UpdateAttendeeStatusPayload{
		Status: string(models.TrainingRegistrationStatusCancelledByAdmin),
	})
}

func (r *FirestoreDispatchRepository) ListTrainingTypes(ctx context.Context) ([]*models.TrainingType, error) {
	docs, err := r.client.Collection(r.trainingTypesColl).Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	if len(docs) == 0 {
		// Auto-seed defaults into Firestore
		defaults := DefaultTrainingTypes()
		for _, t := range defaults {
			r.client.Collection(r.trainingTypesColl).Doc(t.ID).Set(ctx, t)
		}
		return defaults, nil
	}

	res := make([]*models.TrainingType, 0, len(docs))
	for _, doc := range docs {
		var t models.TrainingType
		if err := doc.DataTo(&t); err != nil {
			continue
		}
		t.ID = doc.Ref.ID
		res = append(res, &t)
	}
	return res, nil
}

func (r *FirestoreDispatchRepository) CreateTrainingType(ctx context.Context, t *models.TrainingType) (*models.TrainingType, error) {
	if t.ID == "" {
		t.ID = fmt.Sprintf("TT-%d", time.Now().UnixMilli())
	}
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now
	t.IsActive = true

	if _, err := r.client.Collection(r.trainingTypesColl).Doc(t.ID).Set(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (r *FirestoreDispatchRepository) UpdateTrainingType(ctx context.Context, id string, t *models.TrainingType) (*models.TrainingType, error) {
	docRef := r.client.Collection(r.trainingTypesColl).Doc(id)
	snap, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("training type not found: %s", id)
	}
	var existing models.TrainingType
	if err := snap.DataTo(&existing); err != nil {
		return nil, err
	}
	existing.ID = docRef.ID

	if t.Name != "" {
		existing.Name = t.Name
	}
	if t.Code != "" {
		existing.Code = t.Code
	}
	if t.Category != "" {
		existing.Category = t.Category
	}
	if t.DefaultHours > 0 {
		existing.DefaultHours = t.DefaultHours
	}
	if t.DefaultPayAmount >= 0 {
		existing.DefaultPayAmount = t.DefaultPayAmount
	}
	if t.ValidityMonths > 0 {
		existing.ValidityMonths = t.ValidityMonths
	}
	if len(t.RequiredForRoles) > 0 {
		existing.RequiredForRoles = t.RequiredForRoles
	}
	if t.Description != "" {
		existing.Description = t.Description
	}
	existing.IsActive = t.IsActive
	existing.UpdatedAt = time.Now().UTC()

	if _, err := docRef.Set(ctx, existing); err != nil {
		return nil, err
	}
	return &existing, nil
}

// Memory fallback implementation
type MemoryDispatchRepository struct {
	mu                   sync.RWMutex
	shifts               map[string]*models.DispatchShift
	changeLogs           []*models.DispatchChangeLog
	payrollSettings      *models.DispatchPayrollSettings
	payrolls             map[string]*models.DispatchPayrollRecord
	payrollLogs          map[string]*models.PayrollDepartmentLogRecord
	temporaryAssignments map[string]*models.TemporaryAssignment
	timeOffRequests      map[string]*models.TimeOffRequest
	trainingCourses      map[string]*models.TrainingCourse
	trainingTypes        map[string]*models.TrainingType
	pretripInspections   map[string]*models.PreTripInspection
	defectReports        map[string]*models.VehicleDefectReport
	studentIncidents     map[string]*models.StudentIncident
	expenseCategories    map[string]*models.ExpenseCategory
	expenseClaims        map[string]*models.ExpenseReimbursement
	hazardReports        map[string]*models.HazardReport
	routeAssessments     map[string]*models.RouteAssessment
	vehicleSignouts      map[string]*models.VehicleSignout
	vehicleOdometers        map[string]int
	checkInReminderSettings *models.CheckInReminderSettings
	simulationSettings      *models.SimulationSettings
	absences                map[string]*models.StudentAbsenceRecord
}

func NewMemoryDispatchRepository() *MemoryDispatchRepository {
	repo := &MemoryDispatchRepository{
		shifts:                  make(map[string]*models.DispatchShift),
		changeLogs:              make([]*models.DispatchChangeLog, 0),
		payrollSettings:         models.DefaultDispatchPayrollSettings(),
		payrolls:                make(map[string]*models.DispatchPayrollRecord),
		payrollLogs:             make(map[string]*models.PayrollDepartmentLogRecord),
		temporaryAssignments:    make(map[string]*models.TemporaryAssignment),
		timeOffRequests:         make(map[string]*models.TimeOffRequest),
		trainingCourses:         make(map[string]*models.TrainingCourse),
		trainingTypes:           make(map[string]*models.TrainingType),
		pretripInspections:      make(map[string]*models.PreTripInspection),
		defectReports:           make(map[string]*models.VehicleDefectReport),
		studentIncidents:        make(map[string]*models.StudentIncident),
		expenseCategories:       make(map[string]*models.ExpenseCategory),
		expenseClaims:           make(map[string]*models.ExpenseReimbursement),
		hazardReports:           make(map[string]*models.HazardReport),
		routeAssessments:        make(map[string]*models.RouteAssessment),
		vehicleSignouts:         make(map[string]*models.VehicleSignout),
		vehicleOdometers:        make(map[string]int),
		checkInReminderSettings: models.DefaultCheckInReminderSettings(),
		simulationSettings:      models.DefaultSimulationSettings(),
		absences:                make(map[string]*models.StudentAbsenceRecord),
	}
	for _, cat := range defaultExpenseCategories() {
		repo.expenseCategories[cat.Code] = cat
	}
	seedDefaultVehicleSignouts(repo)
	return repo
}

func defaultExpenseCategories() []*models.ExpenseCategory {
	return []*models.ExpenseCategory{
		{ID: "cat-fuel", Code: "fuel", DisplayName: "Fuel / Gas", SortOrder: 1, Active: true},
		{ID: "cat-parking", Code: "parking", DisplayName: "Parking & Tolls", SortOrder: 2, Active: true},
		{ID: "cat-maintenance", Code: "maintenance", DisplayName: "Supplies & Minor Maintenance", SortOrder: 3, Active: true},
		{ID: "cat-cleaning", Code: "cleaning", DisplayName: "Vehicle Cleaning", SortOrder: 4, Active: true},
		{ID: "cat-meals", Code: "meals", DisplayName: "Meal Allowance", SortOrder: 5, Active: true},
		{ID: "cat-other", Code: "other", DisplayName: "Other Expense", SortOrder: 6, Active: true},
	}
}

func (m *MemoryDispatchRepository) GetCheckInReminderSettings(ctx context.Context) (*models.CheckInReminderSettings, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.checkInReminderSettings == nil {
		return models.DefaultCheckInReminderSettings(), nil
	}
	if m.checkInReminderSettings.ReminderGraceMinutes <= 0 {
		m.checkInReminderSettings.ReminderGraceMinutes = 20
	}
	if m.checkInReminderSettings.PretripReminderGraceMinutes <= 0 {
		m.checkInReminderSettings.PretripReminderGraceMinutes = 60
	}
	return m.checkInReminderSettings, nil
}

func (m *MemoryDispatchRepository) SaveCheckInReminderSettings(ctx context.Context, settings *models.CheckInReminderSettings) (*models.CheckInReminderSettings, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if settings == nil {
		settings = models.DefaultCheckInReminderSettings()
	}
	if settings.ReminderGraceMinutes <= 0 {
		settings.ReminderGraceMinutes = 20
	}
	if settings.PretripReminderGraceMinutes <= 0 {
		settings.PretripReminderGraceMinutes = 60
	}
	settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	m.checkInReminderSettings = settings
	return settings, nil
}

func (m *MemoryDispatchRepository) GetPayrollSettings(ctx context.Context) (*models.DispatchPayrollSettings, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.payrollSettings == nil {
		return models.DefaultDispatchPayrollSettings(), nil
	}
	return m.payrollSettings, nil
}

func (m *MemoryDispatchRepository) SavePayrollSettings(ctx context.Context, settings *models.DispatchPayrollSettings) (*models.DispatchPayrollSettings, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if settings == nil {
		settings = models.DefaultDispatchPayrollSettings()
	}
	settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	m.payrollSettings = settings
	return settings, nil
}

func (m *MemoryDispatchRepository) CreateDay(ctx context.Context, date string, routeNoFilter []string) (*models.CreateDispatchDayResult, error) {
	return &models.CreateDispatchDayResult{Date: date, Created: 0, Message: "Memory fallback mode"}, nil
}

func (m *MemoryDispatchRepository) DeleteDay(ctx context.Context, date string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, s := range m.shifts {
		if s.DispatchDate == date {
			delete(m.shifts, id)
		}
	}
	for id, p := range m.payrolls {
		if p.DispatchDate == date {
			delete(m.payrolls, id)
		}
	}
	for id, l := range m.payrollLogs {
		if l.DispatchDate == date {
			delete(m.payrollLogs, id)
		}
	}
	return nil
}

func (m *MemoryDispatchRepository) AddShift(shift *models.DispatchShift) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.shifts[shift.ID] = shift
}

func (m *MemoryDispatchRepository) ListShifts(ctx context.Context, date string, filter DispatchFilter) ([]*models.DispatchShift, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.DispatchShift, 0)
	for _, s := range m.shifts {
		if s.DispatchDate == date {
			res = append(res, s)
		}
	}
	return res, nil
}

func (m *MemoryDispatchRepository) GetShiftByID(ctx context.Context, id string) (*models.DispatchShift, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if s, ok := m.shifts[id]; ok {
		return s, nil
	}
	return nil, ErrDispatchShiftNotFound
}

func (m *MemoryDispatchRepository) UpdateShift(ctx context.Context, id string, req *models.UpdateDispatchShiftRequest) (*models.DispatchShift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[id]
	if !ok {
		return nil, ErrDispatchShiftNotFound
	}
	if req.DriverID != nil {
		s.DriverID = *req.DriverID
	}
	if req.DriverName != nil {
		s.DriverName = *req.DriverName
	}
	if req.DriverPhone != nil {
		s.DriverPhone = *req.DriverPhone
	}
	if req.VehicleID != nil {
		s.VehicleID = *req.VehicleID
	}
	if req.UnitNumber != nil {
		s.UnitNumber = *req.UnitNumber
	}
	if req.PlateNumber != nil {
		s.PlateNumber = *req.PlateNumber
	}
	if req.AttendantID != nil {
		s.AttendantID = *req.AttendantID
	}
	if req.AttendantName != nil {
		s.AttendantName = *req.AttendantName
	}
	if req.AttendantPhone != nil {
		s.AttendantPhone = *req.AttendantPhone
	}
	if req.DispatchComments != nil {
		s.DispatchComments = *req.DispatchComments
	}
	if req.IsDryRun != nil {
		s.IsDryRun = *req.IsDryRun
	}
	if req.DriverPayOption != nil {
		s.DriverPayOption = *req.DriverPayOption
	}
	if req.DriverPayAmount != nil {
		s.DriverPayAmount = req.DriverPayAmount
	}
	if req.DriverEiHours != nil {
		s.DriverEiHours = req.DriverEiHours
	}
	if req.AttendantPayOption != nil {
		s.AttendantPayOption = *req.AttendantPayOption
	}
	if req.AttendantPayAmount != nil {
		s.AttendantPayAmount = req.AttendantPayAmount
	}
	if req.AttendantEiHours != nil {
		s.AttendantEiHours = req.AttendantEiHours
	}
	if req.NurseID != nil {
		s.NurseID = *req.NurseID
	}
	if req.NurseName != nil {
		s.NurseName = *req.NurseName
	}
	if req.NursePhone != nil {
		s.NursePhone = *req.NursePhone
	}
	if req.NursePayOption != nil {
		s.NursePayOption = *req.NursePayOption
	}
	if req.NursePayAmount != nil {
		s.NursePayAmount = req.NursePayAmount
	}
	if req.NurseEiHours != nil {
		s.NurseEiHours = req.NurseEiHours
	}
	if req.PayrollComments != nil {
		s.PayrollComments = *req.PayrollComments
	}
	if req.ScheduledCheckInTime != nil {
		s.ScheduledCheckInTime = *req.ScheduledCheckInTime
	}
	if req.DriverCheckedInAt != nil {
		s.DriverCheckedInAt = req.DriverCheckedInAt
	}
	if req.IsDriverCheckedIn != nil {
		s.IsDriverCheckedIn = *req.IsDriverCheckedIn
	}
	if req.AttendantCheckedInAt != nil {
		s.AttendantCheckedInAt = req.AttendantCheckedInAt
	}
	if req.IsAttendantCheckedIn != nil {
		s.IsAttendantCheckedIn = *req.IsAttendantCheckedIn
	}
	if req.ParentNotifications != nil {
		s.ParentNotifications = *req.ParentNotifications
	}
	if req.Notes != nil {
		s.DispatchComments = *req.Notes
	}
	return s, nil
}

func (m *MemoryDispatchRepository) CheckInDriver(ctx context.Context, shiftID string, req *models.DriverCheckInRequest) (*models.DispatchShift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[shiftID]
	if !ok {
		return nil, ErrDispatchShiftNotFound
	}
	if req != nil && req.Undo {
		s.IsDriverCheckedIn = false
		s.DriverCheckedInAt = nil
	} else {
		checkInTime := time.Now().Format("15:04")
		if req != nil && req.CheckInTime != nil && *req.CheckInTime != "" {
			checkInTime = *req.CheckInTime
		}
		s.IsDriverCheckedIn = true
		s.DriverCheckedInAt = &checkInTime
	}
	return s, nil
}

func (m *MemoryDispatchRepository) MarkDriverReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[shiftID]
	if !ok {
		return ErrDispatchShiftNotFound
	}
	s.DriverReminderSentAt = &sentAt
	return nil
}

func (m *MemoryDispatchRepository) MarkAttendantReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[shiftID]
	if !ok {
		return ErrDispatchShiftNotFound
	}
	s.AttendantReminderSentAt = &sentAt
	return nil
}

func (m *MemoryDispatchRepository) MarkPretripReminderSent(ctx context.Context, shiftID string, sentAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[shiftID]
	if !ok {
		return ErrDispatchShiftNotFound
	}
	s.PretripReminderSentAt = &sentAt
	return nil
}

func (m *MemoryDispatchRepository) RecordStopArrival(ctx context.Context, shiftID string, stopID int, arrivalTime string) (*models.DispatchShift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[shiftID]
	if !ok {
		return nil, ErrDispatchShiftNotFound
	}
	for i := range s.Stops {
		if s.Stops[i].StopID == stopID {
			s.Stops[i].StopArrivalTime = &arrivalTime
			s.Stops[i].ActualArrivalTime = &arrivalTime
		}
	}
	s.CompletedStops++
	return s, nil
}

func (m *MemoryDispatchRepository) UpdateStudentStatus(ctx context.Context, shiftID string, stopID int, studentID int, isPresent *bool, pickupTime *string, dropoffTime *string, actualArrivalTime *string, status *string, dropoffStatus *string, absenceReason *string, reportedBy *string) (*models.DispatchShift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[shiftID]
	if !ok {
		return nil, ErrDispatchShiftNotFound
	}

	applyStudentUpdate := func(stu *models.DispatchShiftStopStudent) {
		if isPresent != nil {
			stu.IsPresent = isPresent
		}
		if pickupTime != nil && *pickupTime != "" {
			stu.PickupTime = pickupTime
		}
		if dropoffTime != nil && *dropoffTime != "" {
			stu.DropoffTime = dropoffTime
		}
		if dropoffStatus != nil && *dropoffStatus != "" {
			stu.DropoffStatus = *dropoffStatus
		}
		if status != nil && *status != "" {
			stu.Status = *status
			if *status == "dropped_off" {
				t := true
				stu.IsPresent = &t
				stu.DropoffStatus = "dropped_off"
				if stu.DropoffTime == nil || *stu.DropoffTime == "" {
					nowTime := time.Now().Format("15:04")
					stu.DropoffTime = &nowTime
				}
				if stu.PickupTime == nil || *stu.PickupTime == "" {
					nowTime := time.Now().Format("15:04")
					stu.PickupTime = &nowTime
				}
			} else if *status == "picked_up" {
				t := true
				stu.IsPresent = &t
			} else if *status == "absent" || *status == "no_show" {
				f := false
				stu.IsPresent = &f
			}
		} else if isPresent != nil {
			if *isPresent {
				stu.Status = "picked_up"
			} else {
				stu.Status = "absent"
			}
		}
		if absenceReason != nil {
			stu.AbsenceReason = *absenceReason
		}
		if stu.Status == "absent" {
			stu.AbsenceReportedAt = time.Now().Format("2006-01-02 15:04:05")
			if reportedBy != nil && *reportedBy != "" {
				stu.AbsenceReportedBy = *reportedBy
			}
		}
	}

	studentUpdatedCount := 0
	for i := range s.Stops {
		st := &s.Stops[i]
		if st.StopID == stopID {
			for j := range st.AssignedStudents {
				stu := &st.AssignedStudents[j]
				if stu.StudentID == studentID {
					applyStudentUpdate(stu)
					studentUpdatedCount++
				}
			}

			shouldRecordArrival := false
			arrTime := ""
			if actualArrivalTime != nil && *actualArrivalTime != "" {
				shouldRecordArrival = true
				arrTime = *actualArrivalTime
			} else if pickupTime != nil && *pickupTime != "" {
				shouldRecordArrival = true
				arrTime = *pickupTime
			} else if dropoffTime != nil && *dropoffTime != "" {
				shouldRecordArrival = true
				arrTime = *dropoffTime
			} else if (status != nil && *status == "dropped_off") || (dropoffStatus != nil && *dropoffStatus == "dropped_off") {
				shouldRecordArrival = true
				arrTime = time.Now().Format("15:04")
			} else if isPresent != nil && *isPresent {
				shouldRecordArrival = true
				arrTime = time.Now().Format("15:04")
			} else if (status != nil && (*status == "absent" || *status == "no_show")) || (isPresent != nil && !*isPresent) {
				// Driver marking student absent/no-show implies driver arrived at this stop
				if reportedBy == nil || *reportedBy == "driver" || *reportedBy == "" {
					shouldRecordArrival = true
					arrTime = time.Now().Format("15:04")
				}
			}

			if shouldRecordArrival {
				if (st.StopArrivalTime == nil || *st.StopArrivalTime == "") && (st.ActualArrivalTime == nil || *st.ActualArrivalTime == "") {
					st.StopArrivalTime = &arrTime
					st.ActualArrivalTime = &arrTime
					st.MinutesLate = calculateMinutesDiff(arrTime, st.StopScheduleTime)
				}
			}
		}
	}

	// Fallback/cross-stop update: If student was not found on stopID (e.g. stopID is a school stop where students are aggregated from home stops),
	// search and update the student in any stop across the entire shift:
	if studentUpdatedCount == 0 {
		for i := range s.Stops {
			st := &s.Stops[i]
			for j := range st.AssignedStudents {
				stu := &st.AssignedStudents[j]
				if stu.StudentID == studentID {
					applyStudentUpdate(stu)
					studentUpdatedCount++
				}
			}
		}
	}

	completed := 0
	maxLate := 0
	for _, st := range s.Stops {
		if (st.StopArrivalTime != nil && *st.StopArrivalTime != "") || (st.ActualArrivalTime != nil && *st.ActualArrivalTime != "") {
			completed++
			if st.MinutesLate > maxLate {
				maxLate = st.MinutesLate
			}
		}
	}
	s.CompletedStops = completed
	s.LateMinutes = maxLate
	if len(s.Stops) > 0 {
		s.FirstStopActual = s.Stops[0].StopArrivalTime
		s.LastStopActual = s.Stops[len(s.Stops)-1].StopArrivalTime
	}
	return s, nil
}

func (m *MemoryDispatchRepository) RecordStudentAbsence(ctx context.Context, req *models.RecordStudentAbsenceRequest) (*models.RecordStudentAbsenceResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if req.Date == "" || req.StudentID <= 0 {
		return nil, errors.New("date and studentId are required")
	}

	var affectedShifts []string
	studentName := ""
	nowStr := time.Now().Format("2006-01-02 15:04:05")
	f := false

	for _, s := range m.shifts {
		if s.DispatchDate != req.Date {
			continue
		}
		// Check if student belongs to this shift
		hasStudentInShift := false
		for _, st := range s.Stops {
			for _, stu := range st.AssignedStudents {
				if stu.StudentID == req.StudentID {
					hasStudentInShift = true
					break
				}
			}
			if hasStudentInShift {
				break
			}
		}

		if req.RouteNo != "" && s.RouteNo != req.RouteNo && !hasStudentInShift {
			continue
		}
		if req.ShiftType != "" && strings.ToUpper(req.ShiftType) != "ALL" && !strings.EqualFold(s.ShiftType, req.ShiftType) {
			continue
		}

		shiftModified := false
		for i := range s.Stops {
			st := &s.Stops[i]
			for j := range st.AssignedStudents {
				stu := &st.AssignedStudents[j]
				if stu.StudentID == req.StudentID {
					studentName = stu.StudentName
					stu.Status = "absent"
					stu.IsPresent = &f
					stu.AbsenceReason = req.Reason
					stu.AbsenceReportedAt = nowStr
					if req.ReportedBy != "" {
						stu.AbsenceReportedBy = req.ReportedBy
					}
					shiftModified = true
				}
			}
		}

		if shiftModified {
			affectedShifts = append(affectedShifts, s.ID)
		}
	}

	if studentName == "" && req.StudentName != "" {
		studentName = req.StudentName
	}

	reportedBy := req.ReportedBy
	if reportedBy == "" {
		reportedBy = "Dispatcher"
	}

	absenceID := fmt.Sprintf("ABS-%s-%d", req.Date, req.StudentID)
	rec := &models.StudentAbsenceRecord{
		ID:             absenceID,
		Date:           req.Date,
		StudentID:      req.StudentID,
		StudentName:    studentName,
		SchoolName:     req.SchoolName,
		RouteNo:        req.RouteNo,
		ShiftType:      req.ShiftType,
		Reason:         req.Reason,
		ReportedBy:     reportedBy,
		ReportedAt:     nowStr,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		Status:         "ACTIVE",
		AffectedShifts: affectedShifts,
	}
	m.absences[absenceID] = rec

	return &models.RecordStudentAbsenceResponse{
		Date:          req.Date,
		StudentID:     req.StudentID,
		StudentName:   studentName,
		Reason:        req.Reason,
		AffectedShifts: affectedShifts,
		Count:         len(affectedShifts),
	}, nil
}

func (m *MemoryDispatchRepository) ListStudentAbsences(ctx context.Context, filter models.ListStudentAbsencesFilter) ([]*models.StudentAbsenceRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []*models.StudentAbsenceRecord
	seen := make(map[string]bool)

	for _, rec := range m.absences {
		if rec.Status == "CANCELLED" {
			continue
		}
		if filter.StartDate != "" && rec.Date < filter.StartDate {
			continue
		}
		if filter.EndDate != "" && rec.Date > filter.EndDate {
			continue
		}
		if filter.StudentID > 0 && rec.StudentID != filter.StudentID {
			continue
		}
		if filter.RouteNo != "" && rec.RouteNo != "" && rec.RouteNo != filter.RouteNo {
			continue
		}
		if filter.ShiftType != "" && filter.ShiftType != "ALL" && rec.ShiftType != "ALL" && !strings.EqualFold(rec.ShiftType, filter.ShiftType) {
			continue
		}
		key := fmt.Sprintf("%s-%d", rec.Date, rec.StudentID)
		seen[key] = true
		results = append(results, rec)
	}

	// Also inspect shifts in memory for any student marked absent
	for _, s := range m.shifts {
		if filter.StartDate != "" && s.DispatchDate < filter.StartDate {
			continue
		}
		if filter.EndDate != "" && s.DispatchDate > filter.EndDate {
			continue
		}
		if filter.RouteNo != "" && s.RouteNo != filter.RouteNo {
			continue
		}
		for _, st := range s.Stops {
			for _, stu := range st.AssignedStudents {
				if strings.EqualFold(stu.Status, "absent") {
					if filter.StudentID > 0 && stu.StudentID != filter.StudentID {
						continue
					}
					key := fmt.Sprintf("%s-%d", s.DispatchDate, stu.StudentID)
					if !seen[key] {
						seen[key] = true
						results = append(results, &models.StudentAbsenceRecord{
							ID:             fmt.Sprintf("ABS-%s-%d", s.DispatchDate, stu.StudentID),
							Date:           s.DispatchDate,
							StudentID:      stu.StudentID,
							StudentNo:      stu.StudentNo,
							StudentName:    stu.StudentName,
							SchoolName:     stu.SchoolName,
							RouteNo:        s.RouteNo,
							ShiftType:      s.ShiftType,
							Reason:         stu.AbsenceReason,
							ReportedBy:     stu.AbsenceReportedBy,
							ReportedAt:     stu.AbsenceReportedAt,
							Status:         "ACTIVE",
							AffectedShifts: []string{s.ID},
						})
					}
				}
			}
		}
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].Date != results[j].Date {
			return results[i].Date < results[j].Date
		}
		return results[i].StudentName < results[j].StudentName
	})

	return results, nil
}

func (m *MemoryDispatchRepository) CancelStudentAbsence(ctx context.Context, id string, cancelledBy string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.absences[id]
	if ok {
		delete(m.absences, id)
	}

	date := ""
	studentID := 0
	studentName := ""
	if rec != nil {
		date = rec.Date
		studentID = rec.StudentID
		studentName = rec.StudentName
	}

	if date != "" && studentID > 0 {
		for _, s := range m.shifts {
			if s.DispatchDate == date {
				for i := range s.Stops {
					st := &s.Stops[i]
					for j := range st.AssignedStudents {
						stu := &st.AssignedStudents[j]
						if stu.StudentID == studentID && strings.EqualFold(stu.Status, "absent") {
							stu.Status = "scheduled"
							stu.AbsenceReason = ""
						}
					}
				}
			}
		}

		nowStr := time.Now().Format("2006-01-02 15:04:05")
		m.changeLogs = append(m.changeLogs, &models.DispatchChangeLog{
			DispatchDate: date,
			Type:         "Student Absence Cancelled",
			Detail:       fmt.Sprintf("Student %s (ID: %d) absence cancelled for %s. Restored to normal rider.", studentName, studentID, date),
			Time:         nowStr,
			Timestamp:    time.Now().UnixMilli(),
			User:         cancelledBy,
		})
	}

	return nil
}

func (m *MemoryDispatchRepository) SplitShift(ctx context.Context, shiftID string, req *models.SplitDispatchShiftRequest) ([]*models.DispatchShift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	origShift, ok := m.shifts[shiftID]
	if !ok {
		return nil, ErrDispatchShiftNotFound
	}

	if req == nil || len(req.Parts) < 2 {
		return nil, errors.New("at least two split parts are required")
	}

	defaultSuffixes := []string{"A", "B", "C", "D", "E", "F", "G", "H"}
	baseRouteNo := origShift.RouteNo
	for _, suf := range defaultSuffixes {
		if strings.HasSuffix(baseRouteNo, "-"+suf) {
			baseRouteNo = strings.TrimSuffix(baseRouteNo, "-"+suf)
			break
		}
	}

	var results []*models.DispatchShift
	now := time.Now().UTC().Format(time.RFC3339)

	for pIdx, part := range req.Parts {
		suffix := part.RouteSuffix
		if suffix == "" && pIdx < len(defaultSuffixes) {
			suffix = defaultSuffixes[pIdx]
		}
		routeNo := part.RouteNo
		if routeNo == "" {
			routeNo = fmt.Sprintf("%s-%s", baseRouteNo, suffix)
		}

		targetShiftID := origShift.ID
		if pIdx > 0 {
			targetShiftID = fmt.Sprintf("DS-%s-%s-%s", origShift.DispatchDate, routeNo, origShift.ShiftType)
		}

		partStops := buildSplitPartitionStops(origShift.Stops, part.StudentIDs)
		firstTime := "--:--"
		lastTime := "--:--"
		if len(partStops) > 0 {
			firstTime = partStops[0].StopScheduleTime
			lastTime = partStops[len(partStops)-1].StopScheduleTime
		}

		completedStops := 0
		for _, st := range partStops {
			if st.ActualArrivalTime != nil || st.StopArrivalTime != nil {
				completedStops++
			}
		}

		clone := *origShift
		clone.ID = targetShiftID
		clone.RouteNo = routeNo
		clone.DriverID = part.DriverID
		clone.DriverName = part.DriverName
		clone.DriverPhone = part.DriverPhone
		clone.VehicleID = part.VehicleID
		clone.UnitNumber = part.UnitNumber
		clone.PlateNumber = part.PlateNumber
		clone.AttendantID = part.AttendantID
		clone.AttendantName = part.AttendantName
		clone.AttendantPhone = part.AttendantPhone
		clone.Stops = partStops
		clone.FirstStopTime = firstTime
		clone.LastStopTime = lastTime
		clone.TotalStops = len(partStops)
		clone.CompletedStops = completedStops
		clone.UpdatedAt = now

		m.shifts[clone.ID] = &clone
		results = append(results, &clone)
	}

	return results, nil
}

func (m *MemoryDispatchRepository) AddChangeLog(ctx context.Context, log *models.DispatchChangeLog) (*models.DispatchChangeLog, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if log == nil {
		return nil, errors.New("change log cannot be nil")
	}
	if log.ID == "" {
		log.ID = fmt.Sprintf("LOG-%d", time.Now().UnixNano())
	}
	if log.Timestamp == 0 {
		log.Timestamp = time.Now().UnixMilli()
	}
	if log.Time == "" {
		log.Time = FormatDispatchLogTime(time.Now())
	}
	if log.User == "" {
		log.User = "Dispatcher"
	}
	log.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	m.changeLogs = append(m.changeLogs, log)
	return log, nil
}

func (m *MemoryDispatchRepository) ListChangeLogs(ctx context.Context, date string) ([]*models.DispatchChangeLog, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.DispatchChangeLog, 0)
	for _, l := range m.changeLogs {
		if l.DispatchDate == date {
			res = append(res, l)
		}
	}
	sort.Slice(res, func(i, j int) bool {
		return res[i].Timestamp > res[j].Timestamp
	})
	return res, nil
}

func (m *MemoryDispatchRepository) ListSystemAuditLogs(ctx context.Context, collectionName string, startDate, endDate string) ([]map[string]interface{}, error) {
	return []map[string]interface{}{}, nil
}

func (m *MemoryDispatchRepository) GenerateDispatchPayroll(ctx context.Context, shiftID string, role string, checkInTime string) (*models.DispatchPayrollRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	ds, ok := m.shifts[shiftID]
	if !ok {
		return nil, ErrDispatchShiftNotFound
	}

	empID := ""
	empName := ""
	if role == "driver" {
		empID = ds.DriverID
		empName = ds.DriverName
	} else if role == "attendant" {
		empID = ds.AttendantID
		empName = ds.AttendantName
	}

	if empID == "" && empName == "" {
		return nil, fmt.Errorf("no %s assigned to shift %s", role, shiftID)
	}

	if checkInTime == "" {
		if role == "driver" && ds.DriverCheckedInAt != nil && *ds.DriverCheckedInAt != "" {
			checkInTime = *ds.DriverCheckedInAt
		} else if role == "attendant" && ds.AttendantCheckedInAt != nil && *ds.AttendantCheckedInAt != "" {
			checkInTime = *ds.AttendantCheckedInAt
		} else {
			checkInTime = time.Now().Format("15:04")
		}
	}

	payOption := "STANDARD"
	payRate := 25.0
	eiHours := 3.0
	rateSource := "board_base_rate"
	desc := "Standard Rate"

	settings := m.payrollSettings
	if settings == nil {
		settings = models.DefaultDispatchPayrollSettings()
	}

	if role == "driver" {
		payRate = settings.Driver.PartialPayRate
		eiHours = settings.Driver.DefaultEiHours
		if ds.DriverPayOption != "" {
			switch ds.DriverPayOption {
			case "PD":
				payOption = "PD"
				payRate = settings.Driver.PartialPayRate
				eiHours = settings.Driver.DefaultEiHours
				rateSource = "override_pd"
				desc = "Manual Override: Partial Day (PD)"
			case "DD":
				payOption = "DD"
				payRate = settings.Driver.DoublePartialPayRate
				eiHours = settings.Driver.DefaultEiHours
				rateSource = "override_dd"
				desc = "Manual Override: Double Partial (DD)"
			case "NP":
				payOption = "NP"
				payRate = 0
				eiHours = 0
				rateSource = "override_np"
				desc = "Manual Override: No Pay (NP)"
			case "F":
				payOption = "F"
				if ds.DriverPayAmount != nil {
					payRate = *ds.DriverPayAmount
				}
				if ds.DriverEiHours != nil {
					eiHours = *ds.DriverEiHours
				}
				rateSource = "override_custom"
				desc = "Manual Override: Fixed Custom Rate (F)"
			}
		}
	} else if role == "attendant" {
		payRate = settings.Attendant.PartialPayRate
		eiHours = settings.Attendant.DefaultEiHours
		if ds.AttendantPayOption != "" {
			switch ds.AttendantPayOption {
			case "PD":
				payOption = "PD"
				payRate = settings.Attendant.PartialPayRate
				eiHours = settings.Attendant.DefaultEiHours
				rateSource = "override_pd"
				desc = "Manual Override: Partial Day (PD)"
			case "DD":
				payOption = "DD"
				payRate = settings.Attendant.DoublePartialPayRate
				eiHours = settings.Attendant.DefaultEiHours
				rateSource = "override_dd"
				desc = "Manual Override: Double Partial (DD)"
			case "NP":
				payOption = "NP"
				payRate = 0
				eiHours = 0
				rateSource = "override_np"
				desc = "Manual Override: No Pay (NP)"
			case "F":
				payOption = "F"
				if ds.AttendantPayAmount != nil {
					payRate = *ds.AttendantPayAmount
				}
				if ds.AttendantEiHours != nil {
					eiHours = *ds.AttendantEiHours
				}
				rateSource = "override_custom"
				desc = "Manual Override: Fixed Custom Rate (F)"
			}
		}
	}

	payrollID := fmt.Sprintf("DP-%s-%s", shiftID, role)
	now := time.Now().UTC().Format(time.RFC3339)
	rec := &models.DispatchPayrollRecord{
		ID:              payrollID,
		DispatchDate:    ds.DispatchDate,
		ShiftID:         ds.ID,
		RouteNo:         ds.RouteNo,
		RouteName:       ds.RouteName,
		ShiftType:       ds.ShiftType,
		SchoolBoardID:   ds.SchoolBoardID,
		SchoolBoardCode: ds.SchoolBoardCode,
		EmployeeID:      empID,
		EmployeeName:    empName,
		Role:            role,
		VehicleID:       ds.VehicleID,
		UnitNumber:      ds.UnitNumber,
		CheckInTime:     checkInTime,
		PayOption:       payOption,
		PayRate:         payRate,
		EiHours:         eiHours,
		RateSource:      rateSource,
		RateDescription: desc,
		PayrollComments: ds.PayrollComments,
		Status:          "approved",
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	m.payrolls[payrollID] = rec
	return rec, nil
}

func (m *MemoryDispatchRepository) DeleteDispatchPayroll(ctx context.Context, shiftID string, role string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	payrollID := fmt.Sprintf("DP-%s-%s", shiftID, role)
	delete(m.payrolls, payrollID)
	_ = m.RemoveFromPayrollLog(ctx, payrollID)
	return nil
}

func (m *MemoryDispatchRepository) ListDispatchPayrolls(ctx context.Context, date string) ([]*models.DispatchPayrollRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.DispatchPayrollRecord, 0)
	for _, p := range m.payrolls {
		if p.DispatchDate == date {
			res = append(res, p)
		}
	}
	sort.Slice(res, func(i, j int) bool {
		if res[i].RouteNo != res[j].RouteNo {
			return res[i].RouteNo < res[j].RouteNo
		}
		return res[i].Role < res[j].Role
	})
	return res, nil
}

func (m *MemoryDispatchRepository) CheckOutCrew(ctx context.Context, shiftID string, req *models.CrewCheckOutRequest) (*models.DispatchShift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	ds, ok := m.shifts[shiftID]
	if !ok {
		return nil, ErrDispatchShiftNotFound
	}
	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role != "attendant" {
		role = "driver"
	}
	timeStr := time.Now().Format("15:04")
	if req.CheckOutTime != nil && *req.CheckOutTime != "" {
		timeStr = *req.CheckOutTime
	}
	comments := ""
	if req.PayrollComments != nil {
		comments = strings.TrimSpace(*req.PayrollComments)
	}

	payrollID := fmt.Sprintf("DP-%s-%s", shiftID, role)

	if req.Undo {
		if role == "driver" {
			ds.IsDriverCheckedOut = false
			ds.DriverCheckedOutAt = nil
			ds.DriverCheckoutComments = ""
		} else {
			ds.IsAttendantCheckedOut = false
			ds.AttendantCheckedOutAt = nil
			ds.AttendantCheckoutComments = ""
		}
		if p, exists := m.payrolls[payrollID]; exists {
			p.CheckOutTime = ""
			p.HasComments = false
			p.Status = "pending_checkout"
			p.SyncedToFinance = false
		}
		delete(m.payrollLogs, strings.Replace(payrollID, "DP-", "PL-", 1))
		return ds, nil
	}

	if role == "driver" {
		ds.IsDriverCheckedOut = true
		ds.DriverCheckedOutAt = &timeStr
		ds.DriverCheckoutComments = comments
	} else {
		ds.IsAttendantCheckedOut = true
		ds.AttendantCheckedOutAt = &timeStr
		ds.AttendantCheckoutComments = comments
	}

	if p, exists := m.payrolls[payrollID]; exists {
		p.CheckOutTime = timeStr
		if comments != "" {
			p.HasComments = true
			p.PayrollComments = comments
			p.Status = "pending_approval"
			p.SyncedToFinance = false
			delete(m.payrollLogs, strings.Replace(payrollID, "DP-", "PL-", 1))
		} else {
			p.HasComments = false
			p.Status = "approved"
			if p.PayRate > 0 {
				_, _ = m.syncToPayrollLogLocked(p)
				p.SyncedToFinance = true
			} else {
				p.SyncedToFinance = false
			}
		}
	}
	return ds, nil
}

func (m *MemoryDispatchRepository) ApproveDispatchPayroll(ctx context.Context, payrollID string, req *models.ApproveDispatchPayrollRequest) (*models.DispatchPayrollRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.payrolls[payrollID]
	if !ok {
		return nil, fmt.Errorf("dispatch payroll not found: %s", payrollID)
	}
	if req.PayRate != nil {
		p.PayRate = *req.PayRate
	}
	if req.EiHours != nil {
		p.EiHours = *req.EiHours
	}
	if req.PayOption != nil && *req.PayOption != "" {
		p.PayOption = *req.PayOption
	}
	if req.PayrollComments != nil {
		p.PayrollComments = *req.PayrollComments
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	p.Status = "approved"
	approver := "Dispatcher"
	if req.ApprovedBy != "" {
		approver = req.ApprovedBy
	}
	p.ApprovedBy = &approver
	p.ApprovedAt = &now
	p.UpdatedBy = &approver
	p.RejectedBy = nil
	p.RejectedAt = nil

	if p.PayRate > 0 {
		_, _ = m.syncToPayrollLogLocked(p)
		p.SyncedToFinance = true
	} else {
		delete(m.payrollLogs, strings.Replace(payrollID, "DP-", "PL-", 1))
		p.SyncedToFinance = false
	}
	return p, nil
}

func (m *MemoryDispatchRepository) RejectDispatchPayroll(ctx context.Context, payrollID string, req *models.RejectDispatchPayrollRequest) (*models.DispatchPayrollRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.payrolls[payrollID]
	if !ok {
		return nil, fmt.Errorf("dispatch payroll not found: %s", payrollID)
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	p.Status = "rejected"
	rejector := "Dispatcher"
	if req.RejectedBy != "" {
		rejector = req.RejectedBy
	}
	p.RejectedBy = &rejector
	p.RejectedAt = &now
	p.UpdatedBy = &rejector
	p.ApprovedBy = nil
	p.ApprovedAt = nil
	p.SyncedToFinance = false

	delete(m.payrollLogs, strings.Replace(payrollID, "DP-", "PL-", 1))
	return p, nil
}

func (m *MemoryDispatchRepository) syncToPayrollLogLocked(p *models.DispatchPayrollRecord) (*models.PayrollDepartmentLogRecord, error) {
	needsDispatchApproval := p.Status == "pending_approval" || p.HasComments || (strings.TrimSpace(p.PayrollComments) != "")
	if p.PayRate <= 0 || needsDispatchApproval {
		delete(m.payrollLogs, strings.Replace(p.ID, "DP-", "PL-", 1))
		return nil, nil
	}
	logID := fmt.Sprintf("PL-%s-%s", p.ShiftID, p.Role)
	now := time.Now().UTC().Format(time.RFC3339)
	existing, ok := m.payrollLogs[logID]
	if ok {
		existing.OriginalPayRate = p.PayRate
		existing.PayAmount = p.PayRate
		existing.OriginalEiHours = p.EiHours
		existing.EiHours = p.EiHours
		existing.DispatcherComments = p.PayrollComments
		existing.Status = "approved"
		if p.ApprovedBy != nil {
			existing.ApprovedBy = *p.ApprovedBy
			existing.UpdatedBy = *p.ApprovedBy
		}
		if p.ApprovedAt != nil {
			existing.ApprovedAt = *p.ApprovedAt
		}
		existing.UpdatedAt = now
		return existing, nil
	}
	approver := ""
	if p.ApprovedBy != nil {
		approver = *p.ApprovedBy
	}
	approvedAt := ""
	if p.ApprovedAt != nil {
		approvedAt = *p.ApprovedAt
	}
	rec := &models.PayrollDepartmentLogRecord{
		ID:                 logID,
		DispatchPayrollID:  p.ID,
		DispatchDate:       p.DispatchDate,
		ShiftID:            p.ShiftID,
		RouteNo:            p.RouteNo,
		RouteName:          p.RouteName,
		ShiftType:          p.ShiftType,
		SchoolBoardCode:    p.SchoolBoardCode,
		EmployeeID:         p.EmployeeID,
		EmployeeName:       p.EmployeeName,
		Role:               p.Role,
		UnitNumber:         p.UnitNumber,
		CheckInTime:        p.CheckInTime,
		CheckOutTime:       p.CheckOutTime,
		PayOption:          p.PayOption,
		OriginalPayRate:    p.PayRate,
		PayAmount:          p.PayRate,
		OriginalEiHours:    p.EiHours,
		EiHours:            p.EiHours,
		RateSource:         p.RateSource,
		RateDescription:    p.RateDescription,
		DispatcherComments: p.PayrollComments,
		Status:             "approved",
		ApprovedBy:         approver,
		ApprovedAt:         approvedAt,
		UpdatedBy:          approver,
		SyncedAt:           now,
		UpdatedAt:          now,
	}
	m.payrollLogs[logID] = rec
	return rec, nil
}

func (m *MemoryDispatchRepository) SyncToPayrollLog(ctx context.Context, p *models.DispatchPayrollRecord) (*models.PayrollDepartmentLogRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.syncToPayrollLogLocked(p)
}

func (m *MemoryDispatchRepository) RemoveFromPayrollLog(ctx context.Context, dispatchPayrollID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	logID := strings.Replace(dispatchPayrollID, "DP-", "PL-", 1)
	delete(m.payrollLogs, logID)
	return nil
}

func (m *MemoryDispatchRepository) SyncCleanPayrollsForDate(ctx context.Context, date string) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	count := 0
	for _, p := range m.payrolls {
		if p.DispatchDate != date {
			continue
		}
		needsApproval := p.Status == "pending_approval" || p.HasComments || (strings.TrimSpace(p.PayrollComments) != "")
		if !needsApproval && p.PayRate > 0 {
			_, err := m.syncToPayrollLogLocked(p)
			if err == nil {
				count++
				p.SyncedToFinance = true
			}
		}
	}
	return count, nil
}

func (m *MemoryDispatchRepository) ListPayrollDepartmentLogs(ctx context.Context, date string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.PayrollDepartmentLogRecord, 0)
	for _, l := range m.payrollLogs {
		if date != "" && l.DispatchDate != date {
			continue
		}
		if status != "" && status != "all" && l.Status != status {
			continue
		}
		if employeeID != "" && employeeID != "all" && l.EmployeeID != employeeID {
			continue
		}
		res = append(res, l)
	}
	sort.Slice(res, func(i, j int) bool {
		if res[i].DispatchDate != res[j].DispatchDate {
			return res[i].DispatchDate > res[j].DispatchDate
		}
		if res[i].RouteNo != res[j].RouteNo {
			return res[i].RouteNo < res[j].RouteNo
		}
		return res[i].Role < res[j].Role
	})
	return res, nil
}

func (m *MemoryDispatchRepository) ListPayrollDepartmentLogsRange(ctx context.Context, startDate string, endDate string, status string, employeeID string) ([]*models.PayrollDepartmentLogRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.PayrollDepartmentLogRecord, 0)
	for _, l := range m.payrollLogs {
		if startDate != "" && l.DispatchDate < startDate {
			continue
		}
		if endDate != "" && l.DispatchDate > endDate {
			continue
		}
		if status != "" && status != "all" && l.Status != status {
			continue
		}
		if employeeID != "" && employeeID != "all" && l.EmployeeID != employeeID {
			continue
		}
		res = append(res, l)
	}
	sort.Slice(res, func(i, j int) bool {
		if res[i].DispatchDate != res[j].DispatchDate {
			return res[i].DispatchDate > res[j].DispatchDate
		}
		if res[i].RouteNo != res[j].RouteNo {
			return res[i].RouteNo < res[j].RouteNo
		}
		return res[i].Role < res[j].Role
	})
	return res, nil
}

func (m *MemoryDispatchRepository) UpdatePayrollDepartmentLog(ctx context.Context, logID string, req *models.UpdatePayrollDepartmentLogRequest) (*models.PayrollDepartmentLogRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.payrollLogs[logID]
	if !ok {
		return nil, fmt.Errorf("payroll log not found: %s", logID)
	}
	if req.PayAmount != nil {
		rec.PayAmount = *req.PayAmount
	}
	if req.EiHours != nil {
		rec.EiHours = *req.EiHours
	}
	if req.PayrollNotes != nil {
		rec.PayrollNotes = *req.PayrollNotes
	}
	if req.Status != nil && *req.Status != "" {
		rec.Status = *req.Status
	}
	if req.UpdatedBy != "" {
		rec.UpdatedBy = req.UpdatedBy
	}
	rec.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return rec, nil
}

func (m *MemoryDispatchRepository) ListTemporaryAssignments(ctx context.Context, routeID string, date string, status string) ([]*models.TemporaryAssignment, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*models.TemporaryAssignment, 0)
	for _, ta := range m.temporaryAssignments {
		if status != "" && status != "all" && ta.Status != status {
			continue
		}
		if routeID != "" && routeID != "all" && ta.RouteID != routeID {
			continue
		}
		if date != "" {
			if !isTemporaryAssignmentActiveOnDate(date, ta) {
				continue
			}
		}
		res = append(res, ta)
	}
	sort.Slice(res, func(i, j int) bool {
		if res[i].StartDate != res[j].StartDate {
			return res[i].StartDate > res[j].StartDate
		}
		return res[i].RouteNo < res[j].RouteNo
	})
	return res, nil
}

func (m *MemoryDispatchRepository) GetTemporaryAssignmentByID(ctx context.Context, id string) (*models.TemporaryAssignment, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if ta, ok := m.temporaryAssignments[id]; ok {
		return ta, nil
	}
	return nil, fmt.Errorf("temporary assignment not found: %s", id)
}

func (m *MemoryDispatchRepository) CreateTemporaryAssignment(ctx context.Context, req *models.CreateTemporaryAssignmentRequest) (*models.TemporaryAssignment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now().UTC().Format(time.RFC3339)
	id := fmt.Sprintf("TA-%d", time.Now().UnixNano()/1000000)

	status := "active"
	endDate := req.EndDate
	if endDate == "" {
		endDate = req.StartDate
	}

	shiftType := "ALL"
	if req.ShiftType != "" {
		shiftType = req.ShiftType
	}

	rec := &models.TemporaryAssignment{
		ID:                      id,
		RouteID:                 req.RouteID,
		RouteNo:                 req.RouteNo,
		RouteName:               req.RouteName,
		ShiftType:               shiftType,
		BusRouteShiftID:         req.BusRouteShiftID,
		StartDate:               req.StartDate,
		EndDate:                 endDate,
		SpecificDates:           req.SpecificDates,
		OriginalDriverID:        req.OriginalDriverID,
		OriginalDriverName:      req.OriginalDriverName,
		TemporaryDriverID:       req.TemporaryDriverID,
		TemporaryDriverName:     req.TemporaryDriverName,
		TemporaryDriverPhone:    req.TemporaryDriverPhone,
		OriginalAttendantID:     req.OriginalAttendantID,
		OriginalAttendantName:   req.OriginalAttendantName,
		TemporaryAttendantID:    req.TemporaryAttendantID,
		TemporaryAttendantName:  req.TemporaryAttendantName,
		TemporaryAttendantPhone: req.TemporaryAttendantPhone,
		TemporaryVehicleID:      req.TemporaryVehicleID,
		TemporaryUnitNumber:     req.TemporaryUnitNumber,
		TemporaryPlateNumber:    req.TemporaryPlateNumber,
		Reason:                  req.Reason,
		Notes:                   req.Notes,
		Status:                  status,
		CreatedBy:               req.CreatedBy,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	m.temporaryAssignments[id] = rec
	return rec, nil
}

func (m *MemoryDispatchRepository) UpdateTemporaryAssignment(ctx context.Context, id string, req *models.UpdateTemporaryAssignmentRequest) (*models.TemporaryAssignment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.temporaryAssignments[id]
	if !ok {
		return nil, fmt.Errorf("temporary assignment not found: %s", id)
	}
	if req.ShiftType != nil && *req.ShiftType != "" {
		rec.ShiftType = *req.ShiftType
	}
	if req.StartDate != nil && *req.StartDate != "" {
		rec.StartDate = *req.StartDate
	}
	if req.EndDate != nil && *req.EndDate != "" {
		rec.EndDate = *req.EndDate
	}
	if req.SpecificDates != nil {
		rec.SpecificDates = req.SpecificDates
	}
	if req.TemporaryDriverID != nil {
		rec.TemporaryDriverID = *req.TemporaryDriverID
	}
	if req.TemporaryDriverName != nil {
		rec.TemporaryDriverName = *req.TemporaryDriverName
	}
	if req.TemporaryDriverPhone != nil {
		rec.TemporaryDriverPhone = *req.TemporaryDriverPhone
	}
	if req.TemporaryAttendantID != nil {
		rec.TemporaryAttendantID = *req.TemporaryAttendantID
	}
	if req.TemporaryAttendantName != nil {
		rec.TemporaryAttendantName = *req.TemporaryAttendantName
	}
	if req.TemporaryAttendantPhone != nil {
		rec.TemporaryAttendantPhone = *req.TemporaryAttendantPhone
	}
	if req.TemporaryVehicleID != nil {
		rec.TemporaryVehicleID = *req.TemporaryVehicleID
	}
	if req.TemporaryUnitNumber != nil {
		rec.TemporaryUnitNumber = *req.TemporaryUnitNumber
	}
	if req.TemporaryPlateNumber != nil {
		rec.TemporaryPlateNumber = *req.TemporaryPlateNumber
	}
	if req.Reason != nil {
		rec.Reason = *req.Reason
	}
	if req.Notes != nil {
		rec.Notes = *req.Notes
	}
	if req.Status != nil && *req.Status != "" {
		rec.Status = *req.Status
	}
	rec.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return rec, nil
}

func (m *MemoryDispatchRepository) DeleteTemporaryAssignment(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.temporaryAssignments, id)
	return nil
}

// ── Time Off Requests (Memory) ─────────────────────────────────────────────

func (m *MemoryDispatchRepository) ListTimeOffRequests(ctx context.Context, employeeID string, status string, date string) ([]*models.TimeOffRequest, error) {
	return m.ListTimeOffRequestsFiltered(ctx, TimeOffFilter{
		EmployeeID: employeeID,
		Status:     status,
		Date:       date,
	})
}

func (m *MemoryDispatchRepository) ListTimeOffRequestsFiltered(ctx context.Context, filter TimeOffFilter) ([]*models.TimeOffRequest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	res := make([]*models.TimeOffRequest, 0)
	for _, tor := range m.timeOffRequests {
		if filter.Status != "" && filter.Status != "all" && string(tor.Status) != filter.Status {
			continue
		}
		if filter.EmployeeID != "" && filter.EmployeeID != "all" && tor.EmployeeID != filter.EmployeeID {
			continue
		}
		if filter.Date != "" {
			if tor.StartDate != "" && filter.Date < tor.StartDate {
				continue
			}
			if tor.EndDate != "" && filter.Date > tor.EndDate {
				continue
			}
		}
		if filter.StartDate != "" && tor.EndDate != "" && tor.EndDate < filter.StartDate {
			continue
		}
		if filter.EndDate != "" && tor.StartDate != "" && tor.StartDate > filter.EndDate {
			continue
		}
		res = append(res, tor)
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].CreatedAt.After(res[j].CreatedAt)
	})
	return res, nil
}

func (m *MemoryDispatchRepository) GetTimeOffRequestByID(ctx context.Context, id string) (*models.TimeOffRequest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tor, ok := m.timeOffRequests[id]
	if !ok {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}
	return tor, nil
}

func (m *MemoryDispatchRepository) CreateTimeOffRequest(ctx context.Context, req *models.CreateTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := fmt.Sprintf("TOR-%d", time.Now().UnixMilli())
	now := time.Now().UTC()

	shiftType := req.ShiftType
	if shiftType == "" {
		shiftType = "ALL"
	}

	rec := &models.TimeOffRequest{
		ID:                id,
		EmployeeID:        req.EmployeeID,
		EmployeeNumber:    req.EmployeeNumber,
		EmployeeName:      req.EmployeeName,
		LeaveType:         req.LeaveType,
		StartDate:         req.StartDate,
		EndDate:           req.EndDate,
		ShiftType:         shiftType,
		Comments:          req.Comments,
		Status:            models.TimeOffStatusPending,
		RequestedByUserID: req.RequestedByUserID,
		RequestedByName:   req.RequestedByName,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	m.timeOffRequests[id] = rec
	return rec, nil
}

func (m *MemoryDispatchRepository) UpdateTimeOffRequest(ctx context.Context, id string, req *models.UpdateTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.timeOffRequests[id]
	if !ok {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}

	if rec.Status != models.TimeOffStatusPending {
		return nil, fmt.Errorf("cannot modify a request that has already been %s", rec.Status)
	}

	if req.LeaveType != "" {
		rec.LeaveType = req.LeaveType
	}
	if req.StartDate != "" {
		rec.StartDate = req.StartDate
	}
	if req.EndDate != "" {
		rec.EndDate = req.EndDate
	}
	if req.ShiftType != "" {
		rec.ShiftType = req.ShiftType
	}
	if req.Comments != "" {
		rec.Comments = req.Comments
	}
	rec.UpdatedAt = time.Now().UTC()

	return rec, nil
}

func (m *MemoryDispatchRepository) ApproveTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.timeOffRequests[id]
	if !ok {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}

	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusApproved
	rec.ApprovedByUserID = req.ReviewerUserID
	rec.ApprovedByName = req.ReviewerName
	rec.ApprovedAt = &now
	rec.ApprovalNotes = req.ApprovalNotes
	if len(req.NotifiedChannels) > 0 {
		rec.NotifiedChannels = req.NotifiedChannels
		rec.NotifiedAt = &now
	}
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) RejectTimeOffRequest(ctx context.Context, id string, req *models.ReviewTimeOffRequestPayload) (*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.timeOffRequests[id]
	if !ok {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}

	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusRejected
	rec.ApprovedByUserID = req.ReviewerUserID
	rec.ApprovedByName = req.ReviewerName
	rec.ApprovedAt = &now
	rec.ApprovalNotes = req.ApprovalNotes
	if len(req.NotifiedChannels) > 0 {
		rec.NotifiedChannels = req.NotifiedChannels
		rec.NotifiedAt = &now
	}
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) CancelTimeOffRequest(ctx context.Context, id string, userID string) (*models.TimeOffRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.timeOffRequests[id]
	if !ok {
		return nil, fmt.Errorf("time off request not found: %s", id)
	}

	if rec.Status != models.TimeOffStatusPending {
		return nil, fmt.Errorf("only pending requests can be cancelled")
	}

	now := time.Now().UTC()
	rec.Status = models.TimeOffStatusCancelled
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) DeleteTimeOffRequest(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.timeOffRequests, id)
	return nil
}

func (m *MemoryDispatchRepository) ListTrainingCourses(ctx context.Context, status string, trainingType string, date string) ([]*models.TrainingCourse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	res := make([]*models.TrainingCourse, 0, len(m.trainingCourses))
	for _, c := range m.trainingCourses {
		if status != "" && status != "all" && string(c.Status) != status {
			continue
		}
		if trainingType != "" && trainingType != "all" && c.TrainingTypeID != trainingType {
			continue
		}
		if date != "" && c.StartDate != date {
			continue
		}
		res = append(res, c)
	}

	sort.Slice(res, func(i, j int) bool {
		if res[i].StartDate != res[j].StartDate {
			return res[i].StartDate > res[j].StartDate
		}
		return res[i].CreatedAt.After(res[j].CreatedAt)
	})

	return res, nil
}

func (m *MemoryDispatchRepository) GetTrainingCourseByID(ctx context.Context, id string) (*models.TrainingCourse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	c, ok := m.trainingCourses[id]
	if !ok {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	return c, nil
}

func (m *MemoryDispatchRepository) CreateTrainingCourse(ctx context.Context, req *models.CreateTrainingCoursePayload) (*models.TrainingCourse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := fmt.Sprintf("TC-%d", time.Now().UnixMilli())
	now := time.Now().UTC()

	status := models.TrainingCourseStatusDraft
	if req.Status == string(models.TrainingCourseStatusPublished) {
		status = models.TrainingCourseStatusPublished
	}

	c := &models.TrainingCourse{
		ID:               id,
		Title:            req.Title,
		TrainingTypeID:   req.TrainingTypeID,
		TrainingTypeName: req.TrainingTypeName,
		InstructorName:   req.InstructorName,
		Location:         req.Location,
		YardID:           req.YardID,
		YardName:         req.YardName,
		StartDate:        req.StartDate,
		StartTime:        req.StartTime,
		EndTime:          req.EndTime,
		Hours:            req.Hours,
		PayAmount:        req.PayAmount,
		MaxSeats:         req.MaxSeats,
		RegisteredCount:  0,
		Status:           status,
		EligibleRoles:    req.EligibleRoles,
		Description:      req.Description,
		Registrations:    []models.TrainingRegistration{},
		CreatedByUserID:  req.CreatedByUserID,
		CreatedByName:    req.CreatedByName,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	m.trainingCourses[id] = c
	return c, nil
}

func (m *MemoryDispatchRepository) UpdateTrainingCourse(ctx context.Context, id string, req *models.UpdateTrainingCoursePayload) (*models.TrainingCourse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	c, ok := m.trainingCourses[id]
	if !ok {
		return nil, fmt.Errorf("training course not found: %s", id)
	}

	if req.Title != "" {
		c.Title = req.Title
	}
	if req.TrainingTypeID != "" {
		c.TrainingTypeID = req.TrainingTypeID
	}
	if req.TrainingTypeName != "" {
		c.TrainingTypeName = req.TrainingTypeName
	}
	if req.InstructorName != "" {
		c.InstructorName = req.InstructorName
	}
	if req.Location != "" {
		c.Location = req.Location
	}
	if req.YardID != "" {
		c.YardID = req.YardID
	}
	if req.YardName != "" {
		c.YardName = req.YardName
	}
	if req.StartDate != "" {
		c.StartDate = req.StartDate
	}
	if req.StartTime != "" {
		c.StartTime = req.StartTime
	}
	if req.EndTime != "" {
		c.EndTime = req.EndTime
	}
	if req.Hours != nil {
		c.Hours = *req.Hours
	}
	if req.PayAmount != nil {
		c.PayAmount = *req.PayAmount
	}
	if req.MaxSeats != nil {
		c.MaxSeats = *req.MaxSeats
	}
	if len(req.EligibleRoles) > 0 {
		c.EligibleRoles = req.EligibleRoles
	}
	if req.Description != "" {
		c.Description = req.Description
	}
	if req.Status != "" {
		c.Status = models.TrainingCourseStatus(req.Status)
	}
	c.UpdatedAt = time.Now().UTC()

	return c, nil
}

func (m *MemoryDispatchRepository) PublishTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	c, ok := m.trainingCourses[id]
	if !ok {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	c.Status = models.TrainingCourseStatusPublished
	c.UpdatedAt = time.Now().UTC()
	return c, nil
}

func (m *MemoryDispatchRepository) CancelTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	c, ok := m.trainingCourses[id]
	if !ok {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	c.Status = models.TrainingCourseStatusCancelled
	c.UpdatedAt = time.Now().UTC()
	return c, nil
}

func (m *MemoryDispatchRepository) CompleteTrainingCourse(ctx context.Context, id string) (*models.TrainingCourse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	c, ok := m.trainingCourses[id]
	if !ok {
		return nil, fmt.Errorf("training course not found: %s", id)
	}
	c.Status = models.TrainingCourseStatusCompleted
	c.UpdatedAt = time.Now().UTC()
	return c, nil
}

func (m *MemoryDispatchRepository) DeleteTrainingCourse(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.trainingCourses, id)
	return nil
}

func (m *MemoryDispatchRepository) RegisterAttendee(ctx context.Context, courseID string, req *models.RegisterAttendeePayload) (*models.TrainingCourse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	c, ok := m.trainingCourses[courseID]
	if !ok {
		return nil, fmt.Errorf("training course not found: %s", courseID)
	}

	for _, reg := range c.Registrations {
		if reg.EmployeeID == req.EmployeeID && reg.Status != models.TrainingRegistrationStatusCancelledByUser && reg.Status != models.TrainingRegistrationStatusCancelledByAdmin {
			return nil, fmt.Errorf("employee is already registered for this course")
		}
	}

	activeCount := 0
	for _, reg := range c.Registrations {
		if reg.Status != models.TrainingRegistrationStatusCancelledByUser && reg.Status != models.TrainingRegistrationStatusCancelledByAdmin {
			activeCount++
		}
	}
	if c.MaxSeats > 0 && activeCount >= c.MaxSeats {
		return nil, fmt.Errorf("course is full (maximum %d seats reached)", c.MaxSeats)
	}

	regID := fmt.Sprintf("TR-%d-%s", time.Now().UnixMilli(), req.EmployeeID)
	now := time.Now().UTC()
	newReg := models.TrainingRegistration{
		ID:             regID,
		CourseID:       courseID,
		EmployeeID:     req.EmployeeID,
		EmployeeName:   req.EmployeeName,
		EmployeeNumber: req.EmployeeNumber,
		JobTitle:       req.JobTitle,
		Status:         models.TrainingRegistrationStatusRegistered,
		RegisteredAt:   now,
		Notes:          req.Notes,
	}

	c.Registrations = append(c.Registrations, newReg)
	c.RegisteredCount = activeCount + 1
	c.UpdatedAt = now

	return c, nil
}

func (m *MemoryDispatchRepository) UpdateAttendeeStatus(ctx context.Context, courseID string, registrationID string, req *models.UpdateAttendeeStatusPayload) (*models.TrainingCourse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	c, ok := m.trainingCourses[courseID]
	if !ok {
		return nil, fmt.Errorf("training course not found: %s", courseID)
	}

	found := false
	now := time.Now().UTC()
	for i := range c.Registrations {
		if c.Registrations[i].ID == registrationID {
			found = true
			c.Registrations[i].Status = models.TrainingRegistrationStatus(req.Status)
			if req.Status == string(models.TrainingRegistrationStatusCheckedIn) {
				c.Registrations[i].CheckedInAt = &now
			}
			if req.Status == string(models.TrainingRegistrationStatusCompleted) {
				c.Registrations[i].CompletedAt = &now
			}
			if req.Passed != nil {
				c.Registrations[i].Passed = req.Passed
			}
			if req.Score != nil {
				c.Registrations[i].Score = req.Score
			}
			if req.Notes != "" {
				c.Registrations[i].Notes = req.Notes
			}
			break
		}
	}
	if !found {
		return nil, fmt.Errorf("registration not found: %s", registrationID)
	}

	activeCount := 0
	for _, reg := range c.Registrations {
		if reg.Status != models.TrainingRegistrationStatusCancelledByUser && reg.Status != models.TrainingRegistrationStatusCancelledByAdmin {
			activeCount++
		}
	}
	c.RegisteredCount = activeCount
	c.UpdatedAt = now

	return c, nil
}

func (m *MemoryDispatchRepository) CancelRegistration(ctx context.Context, courseID string, registrationID string) (*models.TrainingCourse, error) {
	return m.UpdateAttendeeStatus(ctx, courseID, registrationID, &models.UpdateAttendeeStatusPayload{
		Status: string(models.TrainingRegistrationStatusCancelledByAdmin),
	})
}

func (m *MemoryDispatchRepository) ListTrainingTypes(ctx context.Context) ([]*models.TrainingType, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.trainingTypes) == 0 {
		m.mu.RUnlock()
		m.mu.Lock()
		if len(m.trainingTypes) == 0 {
			for _, t := range DefaultTrainingTypes() {
				m.trainingTypes[t.ID] = t
			}
		}
		m.mu.Unlock()
		m.mu.RLock()
	}

	res := make([]*models.TrainingType, 0, len(m.trainingTypes))
	for _, t := range m.trainingTypes {
		res = append(res, t)
	}
	return res, nil
}

func (m *MemoryDispatchRepository) CreateTrainingType(ctx context.Context, t *models.TrainingType) (*models.TrainingType, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if t.ID == "" {
		t.ID = fmt.Sprintf("TT-%d", time.Now().UnixMilli())
	}
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now
	t.IsActive = true

	m.trainingTypes[t.ID] = t
	return t, nil
}

func (m *MemoryDispatchRepository) UpdateTrainingType(ctx context.Context, id string, t *models.TrainingType) (*models.TrainingType, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.trainingTypes[id]
	if !ok {
		return nil, fmt.Errorf("training type not found: %s", id)
	}

	if t.Name != "" {
		existing.Name = t.Name
	}
	if t.Code != "" {
		existing.Code = t.Code
	}
	if t.Category != "" {
		existing.Category = t.Category
	}
	if t.DefaultHours > 0 {
		existing.DefaultHours = t.DefaultHours
	}
	if t.DefaultPayAmount >= 0 {
		existing.DefaultPayAmount = t.DefaultPayAmount
	}
	if t.ValidityMonths > 0 {
		existing.ValidityMonths = t.ValidityMonths
	}
	if len(t.RequiredForRoles) > 0 {
		existing.RequiredForRoles = t.RequiredForRoles
	}
	if t.Description != "" {
		existing.Description = t.Description
	}
	existing.IsActive = t.IsActive
	existing.UpdatedAt = time.Now().UTC()

	return existing, nil
}




// ─── Firestore: Pre-Trip Inspections ───────────────────────────────────────

func (r *FirestoreDispatchRepository) CreatePreTripInspection(ctx context.Context, req *models.CreatePreTripInspectionPayload) (*models.PreTripInspection, error) {
	now := time.Now().UTC()

	// Look up vehicle to validate odometer and prepare sync
	var vehicleDoc *firestore.DocumentSnapshot
	if req.VehicleUnit != "" {
		iter := r.client.Collection(r.vehicleColl).Where("unitNumber", "==", req.VehicleUnit).Limit(1).Documents(ctx)
		defer iter.Stop()
		doc, err := iter.Next()
		if err == nil {
			vehicleDoc = doc
		} else {
			if directDoc, errDirect := r.client.Collection(r.vehicleColl).Doc(req.VehicleUnit).Get(ctx); errDirect == nil {
				vehicleDoc = directDoc
			}
		}
	}

	if vehicleDoc != nil {
		var veh models.Vehicle
		if err := vehicleDoc.DataTo(&veh); err == nil {
			if veh.Odometer > 0 && req.Odometer < veh.Odometer {
				return nil, fmt.Errorf("new odometer (%d) cannot be less than current vehicle odometer (%d)", req.Odometer, veh.Odometer)
			}
		}
	}

	docRef := r.client.Collection(r.pretripColl).NewDoc()

	// Compute overallStatus from items
	overall := "passed"
	for _, item := range req.Items {
		if item.Status == "major_defect" {
			overall = "failed_major_defects"
			break
		}
		if item.Status == "minor_defect" {
			overall = "passed_with_minor_defects"
		}
	}

	record := &models.PreTripInspection{
		ID:             docRef.ID,
		VehicleUnit:    req.VehicleUnit,
		VehicleID:      req.VehicleID,
		VehiclePlate:   req.VehiclePlate,
		InspectionDate: req.InspectionDate,
		InspectionTime: req.InspectionTime,
		InspectorID:    req.InspectorID,
		InspectorName:  req.InspectorName,
		Odometer:       req.Odometer,
		OverallStatus:  overall,
		Items:          req.Items,
		DefectNotes:    req.DefectNotes,
		SignatureName:  req.SignatureName,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if _, err := docRef.Set(ctx, record); err != nil {
		return nil, fmt.Errorf("create pretrip inspection: %w", err)
	}

	// Synchronize odometer to vehicle record in Firestore
	if vehicleDoc != nil && req.Odometer > 0 {
		_, _ = vehicleDoc.Ref.Update(ctx, []firestore.Update{
			{Path: "odometer", Value: req.Odometer},
			{Path: "updatedAt", Value: now},
		})
	}

	return record, nil
}

func (r *FirestoreDispatchRepository) GetPreTripInspectionToday(ctx context.Context, vehicleUnit string, date string) (*models.PreTripInspection, error) {
	iter := r.client.Collection(r.pretripColl).
		Where("vehicleUnit", "==", vehicleUnit).
		Where("inspectionDate", "==", date).
		Limit(1).
		Documents(ctx)
	defer iter.Stop()

	doc, err := iter.Next()
	if err == iterator.Done {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get pretrip inspection today: %w", err)
	}

	var rec models.PreTripInspection
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = doc.Ref.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) listPreTripInspectionsFromFirestore(ctx context.Context, date string, vehicleUnit string) ([]*models.PreTripInspection, error) {
	q := r.client.Collection(r.pretripColl).Query
	if date != "" {
		q = q.Where("inspectionDate", "==", date)
	}
	if vehicleUnit != "" {
		q = q.Where("vehicleUnit", "==", vehicleUnit)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	var results []*models.PreTripInspection
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("list pretrip inspections: %w", err)
		}
		var rec models.PreTripInspection
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		rec.ID = doc.Ref.ID
		results = append(results, &rec)
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) listPreTripInspectionsFromBigQuery(ctx context.Context, date string, vehicleUnit string) ([]*models.PreTripInspection, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE 1=1",
		r.projectID, r.bqDataset, r.pretripColl)
	var params []bigquery.QueryParameter

	if date != "" {
		querySQL += " AND dispatch_date = @date"
		params = append(params, bigquery.QueryParameter{Name: "date", Value: date})
	}
	if vehicleUnit != "" {
		querySQL += " AND JSON_VALUE(data, '$.vehicleUnit') = @vehicleUnit"
		params = append(params, bigquery.QueryParameter{Name: "vehicleUnit", Value: vehicleUnit})
	}

	q := r.bqClient.Query(querySQL)
	q.Parameters = params

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var results []*models.PreTripInspection
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.PreTripInspection
		if err := json.Unmarshal([]byte(row.Data), &rec); err == nil {
			if rec.ID == "" {
				rec.ID = row.ID
			}
			results = append(results, &rec)
		}
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) ListPreTripInspections(ctx context.Context, date string, vehicleUnit string) ([]*models.PreTripInspection, error) {
	var results []*models.PreTripInspection
	var err error

	if date != "" && r.isLogColdDate(date) {
		results, err = r.listPreTripInspectionsFromBigQuery(ctx, date, vehicleUnit)
		if err == nil && len(results) > 0 {
			return results, nil
		}
	}

	results, err = r.listPreTripInspectionsFromFirestore(ctx, date, vehicleUnit)
	if err != nil {
		return nil, err
	}

	if len(results) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listPreTripInspectionsFromBigQuery(ctx, date, vehicleUnit); bqErr == nil && len(bqRes) > 0 {
			results = bqRes
		}
	}

	return results, nil
}

// ─── Memory: Pre-Trip Inspections ──────────────────────────────────────────

func (m *MemoryDispatchRepository) CreatePreTripInspection(ctx context.Context, req *models.CreatePreTripInspectionPayload) (*models.PreTripInspection, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.vehicleOdometers == nil {
		m.vehicleOdometers = make(map[string]int)
	}
	if req.VehicleUnit != "" {
		currOdo := m.vehicleOdometers[req.VehicleUnit]
		if currOdo > 0 && req.Odometer < currOdo {
			return nil, fmt.Errorf("new odometer (%d) cannot be less than current vehicle odometer (%d)", req.Odometer, currOdo)
		}
		if req.Odometer > 0 {
			m.vehicleOdometers[req.VehicleUnit] = req.Odometer
		}
	}

	now := time.Now().UTC()
	id := fmt.Sprintf("pretrip-%d", now.UnixNano())

	overall := "passed"
	for _, item := range req.Items {
		if item.Status == "major_defect" {
			overall = "failed_major_defects"
			break
		}
		if item.Status == "minor_defect" {
			overall = "passed_with_minor_defects"
		}
	}

	record := &models.PreTripInspection{
		ID:             id,
		VehicleUnit:    req.VehicleUnit,
		VehicleID:      req.VehicleID,
		VehiclePlate:   req.VehiclePlate,
		InspectionDate: req.InspectionDate,
		InspectionTime: req.InspectionTime,
		InspectorID:    req.InspectorID,
		InspectorName:  req.InspectorName,
		Odometer:       req.Odometer,
		OverallStatus:  overall,
		Items:          req.Items,
		DefectNotes:    req.DefectNotes,
		SignatureName:  req.SignatureName,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	m.pretripInspections[id] = record
	return record, nil
}

func (m *MemoryDispatchRepository) GetPreTripInspectionToday(ctx context.Context, vehicleUnit string, date string) (*models.PreTripInspection, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, rec := range m.pretripInspections {
		if rec.VehicleUnit == vehicleUnit && rec.InspectionDate == date {
			return rec, nil
		}
	}
	return nil, nil
}

func (m *MemoryDispatchRepository) ListPreTripInspections(ctx context.Context, date string, vehicleUnit string) ([]*models.PreTripInspection, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var results []*models.PreTripInspection
	for _, rec := range m.pretripInspections {
		if date != "" && rec.InspectionDate != date {
			continue
		}
		if vehicleUnit != "" && rec.VehicleUnit != vehicleUnit {
			continue
		}
		results = append(results, rec)
	}
	return results, nil
}

// ─── Firestore: Vehicle Defect Reports ─────────────────────────────────────

func (r *FirestoreDispatchRepository) removeUnavailableVehicleFromDispatches(ctx context.Context, unitNumber string, vehicleID int, startDate, endDate string) {
	u := strings.ToUpper(strings.TrimSpace(unitNumber))
	if u == "" && vehicleID <= 0 {
		return
	}
	if startDate == "" {
		startDate = time.Now().UTC().Format("2006-01-02")
	}

	iter := r.client.Collection(r.dispatchColl).Where("dispatchDate", ">=", startDate).Documents(ctx)
	defer iter.Stop()

	nowIso := time.Now().UTC().Format(time.RFC3339)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var ds models.DispatchShift
		if err := doc.DataTo(&ds); err != nil {
			continue
		}
		if endDate != "" && ds.DispatchDate > endDate {
			continue
		}
		matchesUnit := u != "" && strings.ToUpper(strings.TrimSpace(ds.UnitNumber)) == u
		matchesID := vehicleID > 0 && ds.VehicleID == vehicleID
		if matchesUnit || matchesID {
			_, _ = doc.Ref.Update(ctx, []firestore.Update{
				{Path: "vehicleId", Value: 0},
				{Path: "unitNumber", Value: ""},
				{Path: "plateNumber", Value: ""},
				{Path: "isTemporaryVehicle", Value: false},
				{Path: "health", Value: models.HealthRed},
				{Path: "updatedAt", Value: nowIso},
			})
		}
	}
}

func (r *FirestoreDispatchRepository) CreateDefectReport(ctx context.Context, req *models.CreateDefectReportPayload) (*models.VehicleDefectReport, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.defectColl).NewDoc()

	record := &models.VehicleDefectReport{
		ID:                docRef.ID,
		VehicleID:         req.VehicleID,
		VehicleUnitNumber: req.VehicleUnitNumber,
		Odometer:          req.Odometer,
		ReportedByUserID:  req.ReportedByUserID,
		ReportedByName:    req.ReportedByName,
		ReportDate:        req.ReportDate,
		ReportTime:        req.ReportTime,
		Items:             req.Items,
		DefectNotes:       req.DefectNotes,
		NoDefectsFound:    req.NoDefectsFound,
		ConfirmedAccurate: req.ConfirmedAccurate,
		Status:            "submitted",
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if _, err := docRef.Set(ctx, record); err != nil {
		return nil, fmt.Errorf("create defect report: %w", err)
	}

	if !req.NoDefectsFound {
		r.removeUnavailableVehicleFromDispatches(ctx, req.VehicleUnitNumber, req.VehicleID, req.ReportDate, "")
	}

	return record, nil
}

func (r *FirestoreDispatchRepository) GetDefectReportByID(ctx context.Context, id string) (*models.VehicleDefectReport, error) {
	doc, err := r.client.Collection(r.defectColl).Doc(id).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get defect report %s: %w", id, err)
	}
	var rec models.VehicleDefectReport
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = doc.Ref.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) listDefectReportsFromFirestore(ctx context.Context, vehicleUnit string, status string, driverID string) ([]*models.VehicleDefectReport, error) {
	q := r.client.Collection(r.defectColl).Query
	if vehicleUnit != "" {
		q = q.Where("vehicleUnitNumber", "==", vehicleUnit)
	}
	if status != "" {
		q = q.Where("status", "==", status)
	}
	if driverID != "" {
		q = q.Where("reportedByUserId", "==", driverID)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	var results []*models.VehicleDefectReport
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("list defect reports: %w", err)
		}
		var rec models.VehicleDefectReport
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		rec.ID = doc.Ref.ID
		results = append(results, &rec)
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) listDefectReportsFromBigQuery(ctx context.Context, vehicleUnit string, status string, driverID string) ([]*models.VehicleDefectReport, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE 1=1",
		r.projectID, r.bqDataset, r.defectColl)
	var params []bigquery.QueryParameter

	if vehicleUnit != "" {
		querySQL += " AND JSON_VALUE(data, '$.vehicleUnitNumber') = @vehicleUnit"
		params = append(params, bigquery.QueryParameter{Name: "vehicleUnit", Value: vehicleUnit})
	}
	if status != "" {
		querySQL += " AND JSON_VALUE(data, '$.status') = @status"
		params = append(params, bigquery.QueryParameter{Name: "status", Value: status})
	}
	if driverID != "" {
		querySQL += " AND JSON_VALUE(data, '$.reportedByUserId') = @driverId"
		params = append(params, bigquery.QueryParameter{Name: "driverId", Value: driverID})
	}

	q := r.bqClient.Query(querySQL)
	q.Parameters = params

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var results []*models.VehicleDefectReport
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.VehicleDefectReport
		if err := json.Unmarshal([]byte(row.Data), &rec); err == nil {
			if rec.ID == "" {
				rec.ID = row.ID
			}
			results = append(results, &rec)
		}
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) ListDefectReports(ctx context.Context, vehicleUnit string, status string, driverID string) ([]*models.VehicleDefectReport, error) {
	results, err := r.listDefectReportsFromFirestore(ctx, vehicleUnit, status, driverID)
	if err != nil {
		return nil, err
	}

	if len(results) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listDefectReportsFromBigQuery(ctx, vehicleUnit, status, driverID); bqErr == nil && len(bqRes) > 0 {
			results = bqRes
		}
	}

	return results, nil
}

func (r *FirestoreDispatchRepository) UpdateDefectAssessment(ctx context.Context, id string, req *models.UpdateDefectAssessmentPayload) (*models.VehicleDefectReport, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.defectColl).Doc(id)

	doc, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get defect report for assessment %s: %w", id, err)
	}

	var rec models.VehicleDefectReport
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = doc.Ref.ID

	if rec.Assessment == nil {
		rec.Assessment = &models.DefectAssessment{}
	}
	rec.Assessment.AssessedBy = req.AssessedBy
	rec.Assessment.AssessedAt = &now
	rec.Assessment.AssessmentNotes = req.AssessmentNotes
	rec.Assessment.RepairLocation = req.RepairLocation
	rec.Assessment.EstimatedRepairDays = req.EstimatedRepairDays
	rec.Assessment.EstimatedStartDate = req.EstimatedStartDate
	rec.Assessment.EstimatedCompletionDate = req.EstimatedCompletionDate
	rec.Assessment.ActualCompletionDate = req.ActualCompletionDate
	rec.Assessment.RepairCost = req.RepairCost
	rec.Assessment.MechanicNotes = req.MechanicNotes
	if req.ResolvedBy != "" {
		rec.Assessment.ResolvedBy = req.ResolvedBy
		rec.Assessment.ResolvedAt = &now
	}

	newStatus := req.Status
	if newStatus == "" {
		newStatus = "under_assessment"
	}
	rec.Status = newStatus
	rec.UpdatedAt = now

	if _, err := docRef.Set(ctx, &rec); err != nil {
		return nil, fmt.Errorf("update defect report assessment %s: %w", id, err)
	}

	if !rec.NoDefectsFound && !strings.EqualFold(newStatus, "resolved") {
		startDate := rec.ReportDate
		if req.EstimatedStartDate != "" {
			startDate = req.EstimatedStartDate
		}
		endDate := req.EstimatedCompletionDate
		if req.ActualCompletionDate != "" {
			endDate = req.ActualCompletionDate
		}
		r.removeUnavailableVehicleFromDispatches(ctx, rec.VehicleUnitNumber, rec.VehicleID, startDate, endDate)
	}

	return &rec, nil
}

func (r *FirestoreDispatchRepository) UpdateDefectStatus(ctx context.Context, id string, status string) (*models.VehicleDefectReport, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.defectColl).Doc(id)

	updates := []firestore.Update{
		{Path: "status", Value: status},
		{Path: "updatedAt", Value: now},
	}
	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, fmt.Errorf("update defect report status %s: %w", id, err)
	}

	return r.GetDefectReportByID(ctx, id)
}

// ─── Memory: Vehicle Defect Reports ────────────────────────────────────────

func (m *MemoryDispatchRepository) CreateDefectReport(ctx context.Context, req *models.CreateDefectReportPayload) (*models.VehicleDefectReport, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	id := fmt.Sprintf("defect-%d", now.UnixNano())

	record := &models.VehicleDefectReport{
		ID:                id,
		VehicleID:         req.VehicleID,
		VehicleUnitNumber: req.VehicleUnitNumber,
		Odometer:          req.Odometer,
		ReportedByUserID:  req.ReportedByUserID,
		ReportedByName:    req.ReportedByName,
		ReportDate:        req.ReportDate,
		ReportTime:        req.ReportTime,
		Items:             req.Items,
		DefectNotes:       req.DefectNotes,
		NoDefectsFound:    req.NoDefectsFound,
		ConfirmedAccurate: req.ConfirmedAccurate,
		Status:            "submitted",
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	m.defectReports[id] = record
	return record, nil
}

func (m *MemoryDispatchRepository) GetDefectReportByID(ctx context.Context, id string) (*models.VehicleDefectReport, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rec, ok := m.defectReports[id]
	if !ok {
		return nil, fmt.Errorf("defect report not found: %s", id)
	}
	return rec, nil
}

func (m *MemoryDispatchRepository) ListDefectReports(ctx context.Context, vehicleUnit string, status string, driverID string) ([]*models.VehicleDefectReport, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []*models.VehicleDefectReport
	for _, rec := range m.defectReports {
		if vehicleUnit != "" && rec.VehicleUnitNumber != vehicleUnit {
			continue
		}
		if status != "" && rec.Status != status {
			continue
		}
		if driverID != "" && rec.ReportedByUserID != driverID {
			continue
		}
		results = append(results, rec)
	}
	return results, nil
}

func (m *MemoryDispatchRepository) UpdateDefectAssessment(ctx context.Context, id string, req *models.UpdateDefectAssessmentPayload) (*models.VehicleDefectReport, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.defectReports[id]
	if !ok {
		return nil, fmt.Errorf("defect report not found: %s", id)
	}

	now := time.Now().UTC()
	if rec.Assessment == nil {
		rec.Assessment = &models.DefectAssessment{}
	}
	rec.Assessment.AssessedBy = req.AssessedBy
	rec.Assessment.AssessedAt = &now
	rec.Assessment.AssessmentNotes = req.AssessmentNotes
	rec.Assessment.RepairLocation = req.RepairLocation
	rec.Assessment.EstimatedRepairDays = req.EstimatedRepairDays
	rec.Assessment.EstimatedStartDate = req.EstimatedStartDate
	rec.Assessment.EstimatedCompletionDate = req.EstimatedCompletionDate
	rec.Assessment.ActualCompletionDate = req.ActualCompletionDate
	rec.Assessment.RepairCost = req.RepairCost
	rec.Assessment.MechanicNotes = req.MechanicNotes
	if req.ResolvedBy != "" {
		rec.Assessment.ResolvedBy = req.ResolvedBy
		rec.Assessment.ResolvedAt = &now
	}

	newStatus := req.Status
	if newStatus == "" {
		newStatus = "under_assessment"
	}
	rec.Status = newStatus
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) UpdateDefectStatus(ctx context.Context, id string, status string) (*models.VehicleDefectReport, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.defectReports[id]
	if !ok {
		return nil, fmt.Errorf("defect report not found: %s", id)
	}
	now := time.Now().UTC()
	rec.Status = status
	rec.UpdatedAt = now
	return rec, nil
}

// ─── Firestore: Student Incident Reports ────────────────────────────────────

func (r *FirestoreDispatchRepository) CreateStudentIncident(ctx context.Context, req *models.CreateStudentIncidentPayload) (*models.StudentIncident, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.studentIncidentColl).NewDoc()

	status := "submitted"
	record := &models.StudentIncident{
		ID:                         docRef.ID,
		IncidentDate:               req.IncidentDate,
		IncidentTime:               req.IncidentTime,
		StudentID:                  req.StudentID,
		StudentNo:                  req.StudentNo,
		StudentName:                req.StudentName,
		Grade:                      req.Grade,
		SchoolID:                   req.SchoolID,
		SchoolName:                 req.SchoolName,
		RouteID:                    req.RouteID,
		RouteNo:                    req.RouteNo,
		RouteName:                  req.RouteName,
		ShiftType:                  req.ShiftType,
		DriverID:                   req.DriverID,
		DriverName:                 req.DriverName,
		Location:                   req.Location,
		IncidentTypes:              req.IncidentTypes,
		TypeOther:                  req.TypeOther,
		Description:                req.Description,
		OtherStudentsInvolved:      req.OtherStudentsInvolved,
		Witnesses:                  req.Witnesses,
		ImmediateActionTaken:       req.ImmediateActionTaken,
		StudentRemovedFromBus:      req.StudentRemovedFromBus,
		FirstAidRequired:           req.FirstAidRequired,
		ParentsNotified:            req.ParentsNotified,
		ParentsNotificationDetail: req.ParentsNotificationDetail,
		Status:                     status,
		CreatedAt:                  now,
		UpdatedAt:                  now,
	}

	if _, err := docRef.Set(ctx, record); err != nil {
		return nil, fmt.Errorf("create student incident: %w", err)
	}
	return record, nil
}

func (r *FirestoreDispatchRepository) GetStudentIncidentByID(ctx context.Context, id string) (*models.StudentIncident, error) {
	doc, err := r.client.Collection(r.studentIncidentColl).Doc(id).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get student incident %s: %w", id, err)
	}
	var rec models.StudentIncident
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = doc.Ref.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) listStudentIncidentsFromFirestore(ctx context.Context, studentID int, routeNo string, driverID string, status string, needsFollowUp bool) ([]*models.StudentIncident, error) {
	q := r.client.Collection(r.studentIncidentColl).Query
	if studentID > 0 {
		q = q.Where("studentId", "==", studentID)
	}
	if routeNo != "" {
		q = q.Where("routeNo", "==", routeNo)
	}
	if driverID != "" {
		q = q.Where("driverId", "==", driverID)
	}
	if status != "" {
		q = q.Where("status", "==", status)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	var results []*models.StudentIncident
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("list student incidents: %w", err)
		}
		var rec models.StudentIncident
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		rec.ID = doc.Ref.ID
		if needsFollowUp {
			if rec.OfficeFollowUp != nil && rec.OfficeFollowUp.IsOfficeLocked {
				continue
			}
			if rec.Status == "closed" {
				continue
			}
		}
		results = append(results, &rec)
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) listStudentIncidentsFromBigQuery(ctx context.Context, studentID int, routeNo string, driverID string, status string, needsFollowUp bool) ([]*models.StudentIncident, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE 1=1",
		r.projectID, r.bqDataset, r.studentIncidentColl)
	var params []bigquery.QueryParameter

	if studentID > 0 {
		querySQL += " AND CAST(JSON_VALUE(data, '$.studentId') AS INT64) = @studentId"
		params = append(params, bigquery.QueryParameter{Name: "studentId", Value: studentID})
	}
	if routeNo != "" {
		querySQL += " AND JSON_VALUE(data, '$.routeNo') = @routeNo"
		params = append(params, bigquery.QueryParameter{Name: "routeNo", Value: routeNo})
	}
	if driverID != "" {
		querySQL += " AND JSON_VALUE(data, '$.driverId') = @driverId"
		params = append(params, bigquery.QueryParameter{Name: "driverId", Value: driverID})
	}
	if status != "" {
		querySQL += " AND JSON_VALUE(data, '$.status') = @status"
		params = append(params, bigquery.QueryParameter{Name: "status", Value: status})
	}

	q := r.bqClient.Query(querySQL)
	q.Parameters = params

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var results []*models.StudentIncident
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.StudentIncident
		if err := json.Unmarshal([]byte(row.Data), &rec); err == nil {
			if rec.ID == "" {
				rec.ID = row.ID
			}
			if needsFollowUp {
				if rec.OfficeFollowUp != nil && rec.OfficeFollowUp.IsOfficeLocked {
					continue
				}
				if rec.Status == "closed" {
					continue
				}
			}
			results = append(results, &rec)
		}
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) ListStudentIncidents(ctx context.Context, studentID int, routeNo string, driverID string, status string, needsFollowUp bool) ([]*models.StudentIncident, error) {
	results, err := r.listStudentIncidentsFromFirestore(ctx, studentID, routeNo, driverID, status, needsFollowUp)
	if err != nil {
		return nil, err
	}

	if len(results) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listStudentIncidentsFromBigQuery(ctx, studentID, routeNo, driverID, status, needsFollowUp); bqErr == nil && len(bqRes) > 0 {
			results = bqRes
		}
	}

	return results, nil
}

func (r *FirestoreDispatchRepository) UpdateStudentIncidentOfficeFollowUp(ctx context.Context, id string, req *models.UpdateIncidentOfficeFollowUpPayload) (*models.StudentIncident, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.studentIncidentColl).Doc(id)

	doc, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get student incident %s: %w", id, err)
	}

	var rec models.StudentIncident
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = doc.Ref.ID

	if rec.OfficeFollowUp == nil {
		rec.OfficeFollowUp = &models.IncidentOfficeFollowUp{}
	}
	rec.OfficeFollowUp.ReviewedDate = req.ReviewedDate
	rec.OfficeFollowUp.AdministratorName = req.AdministratorName
	rec.OfficeFollowUp.DisciplinaryActions = req.DisciplinaryActions
	rec.OfficeFollowUp.DisciplinaryOther = req.DisciplinaryOther
	rec.OfficeFollowUp.OfficeNotes = req.OfficeNotes
	rec.OfficeFollowUp.IsOfficeLocked = req.IsOfficeLocked
	rec.OfficeFollowUp.ReviewedAt = &now

	if req.Status != "" {
		rec.Status = req.Status
	}
	rec.UpdatedAt = now

	if _, err := docRef.Set(ctx, &rec); err != nil {
		return nil, fmt.Errorf("update student incident office follow up %s: %w", id, err)
	}
	return &rec, nil
}

func (r *FirestoreDispatchRepository) UpdateStudentIncidentStatus(ctx context.Context, id string, status string) (*models.StudentIncident, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.studentIncidentColl).Doc(id)

	updates := []firestore.Update{
		{Path: "status", Value: status},
		{Path: "updatedAt", Value: now},
	}
	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, fmt.Errorf("update student incident status %s: %w", id, err)
	}
	return r.GetStudentIncidentByID(ctx, id)
}

// ─── Firestore: Expense Reimbursements ─────────────────────────────────────

func (r *FirestoreDispatchRepository) ListExpenseCategories(ctx context.Context) ([]*models.ExpenseCategory, error) {
	iter := r.client.Collection(r.expenseCategoryColl).Where("active", "==", true).Documents(ctx)
	defer iter.Stop()

	var results []*models.ExpenseCategory
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		var cat models.ExpenseCategory
		if err := doc.DataTo(&cat); err == nil {
			cat.ID = doc.Ref.ID
			results = append(results, &cat)
		}
	}
	if len(results) == 0 {
		return defaultExpenseCategories(), nil
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].SortOrder < results[j].SortOrder
	})
	return results, nil
}

func (r *FirestoreDispatchRepository) CreateExpenseClaim(ctx context.Context, req *models.CreateExpenseClaimPayload) (*models.ExpenseReimbursement, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.expenseReimbursementColl).NewDoc()

	total := 0.0
	lines := make([]models.ExpenseReimbursementLine, 0, len(req.Lines))
	for i, l := range req.Lines {
		sortOrder := l.SortOrder
		if sortOrder == 0 {
			sortOrder = i + 1
		}
		line := models.ExpenseReimbursementLine{
			ID:                  fmt.Sprintf("%s-line-%d", docRef.ID, i+1),
			CategoryCode:        l.CategoryCode,
			CategoryDisplayName: l.CategoryDisplayName,
			Amount:              l.Amount,
			Note:                l.Note,
			SortOrder:           sortOrder,
		}
		total += l.Amount
		lines = append(lines, line)
	}

	record := &models.ExpenseReimbursement{
		ID:             docRef.ID,
		EmployeeID:     req.EmployeeID,
		EmployeeName:   req.EmployeeName,
		ClaimDate:      req.ClaimDate,
		RouteNo:        req.RouteNo,
		TotalAmount:    total,
		Lines:          lines,
		AttachmentURLs: req.AttachmentURLs,
		Status:         "pending",
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if _, err := docRef.Set(ctx, record); err != nil {
		return nil, fmt.Errorf("create expense claim: %w", err)
	}
	return record, nil
}

func (r *FirestoreDispatchRepository) GetExpenseClaimByID(ctx context.Context, id string) (*models.ExpenseReimbursement, error) {
	docRef := r.client.Collection(r.expenseReimbursementColl).Doc(id)
	doc, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get expense claim %s: %w", id, err)
	}
	var rec models.ExpenseReimbursement
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = doc.Ref.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) ListExpenseClaims(ctx context.Context, employeeID string, status string) ([]*models.ExpenseReimbursement, error) {
	q := r.client.Collection(r.expenseReimbursementColl).Query
	if employeeID != "" {
		q = q.Where("employeeId", "==", employeeID)
	}
	if status != "" {
		q = q.Where("status", "==", status)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	var results []*models.ExpenseReimbursement
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("list expense claims: %w", err)
		}
		var rec models.ExpenseReimbursement
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		rec.ID = doc.Ref.ID
		results = append(results, &rec)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.After(results[j].CreatedAt)
	})

	return results, nil
}

func (r *FirestoreDispatchRepository) ReviewExpenseClaim(ctx context.Context, id string, req *models.ReviewExpenseClaimPayload) (*models.ExpenseReimbursement, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.expenseReimbursementColl).Doc(id)

	updates := []firestore.Update{
		{Path: "status", Value: req.Status},
		{Path: "approvalNotes", Value: req.ApprovalNotes},
		{Path: "approvedByName", Value: req.ApprovedByName},
		{Path: "approvedAt", Value: &now},
		{Path: "updatedAt", Value: now},
	}

	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, fmt.Errorf("review expense claim %s: %w", id, err)
	}
	return r.GetExpenseClaimByID(ctx, id)
}

func (r *FirestoreDispatchRepository) CancelExpenseClaim(ctx context.Context, id string, employeeID string) (*models.ExpenseReimbursement, error) {
	docRef := r.client.Collection(r.expenseReimbursementColl).Doc(id)
	doc, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get expense claim %s: %w", id, err)
	}
	var rec models.ExpenseReimbursement
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	if employeeID != "" && rec.EmployeeID != "" && rec.EmployeeID != employeeID {
		return nil, errors.New("unauthorized: cannot cancel claim belonging to another driver")
	}
	if rec.Status != "pending" {
		return nil, fmt.Errorf("cannot cancel claim with status '%s'; only pending claims can be cancelled", rec.Status)
	}

	now := time.Now().UTC()
	updates := []firestore.Update{
		{Path: "status", Value: "cancelled"},
		{Path: "updatedAt", Value: now},
	}
	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, fmt.Errorf("cancel expense claim %s: %w", id, err)
	}
	return r.GetExpenseClaimByID(ctx, id)
}

// ─── Firestore: Hazard & Near-Miss Reports ─────────────────────────────────

func hazardStatusStr(statusInt int) string {
	switch statusInt {
	case 1:
		return "Investigating"
	case 2:
		return "Resolved"
	default:
		return "Open"
	}
}

func (r *FirestoreDispatchRepository) CreateHazardReport(ctx context.Context, req *models.CreateHazardReportPayload) (*models.HazardReport, error) {
	now := time.Now().UTC()
	docRef := r.client.Collection(r.hazardReportColl).NewDoc()

	statusInt := 0
	statusStr := "Open"

	record := &models.HazardReport{
		ID:                   docRef.ID,
		ReportedBy:           req.ReportedBy,
		ReportedByEmployeeID: req.ReportedByEmployeeID,
		PersonInvolved:       req.PersonInvolved,
		UnitID:               req.UnitID,
		UnitNumber:           req.UnitNumber,
		RouteID:              req.RouteID,
		RouteName:            req.RouteName,
		Phone:                req.Phone,
		Supervisor:           req.Supervisor,
		EventTime:            req.EventTime,
		EventLocation:        req.EventLocation,
		Witnesses:            req.Witnesses,
		EventDescription:     req.EventDescription,
		TrippingHazard:       req.TrippingHazard,
		TrafficHazard:        req.TrafficHazard,
		EquipmentHazard:      req.EquipmentHazard,
		PerformanceHazard:    req.PerformanceHazard,
		SnowHazard:           req.SnowHazard,
		SpillHazard:          req.SpillHazard,
		OtherHazard:          req.OtherHazard,
		UnsafeAction:         req.UnsafeAction,
		UnsafeCondition:      req.UnsafeCondition,
		HappenedtoMe:         req.HappenedtoMe,
		HappenedtoSomeone:    req.HappenedtoSomeone,
		Ofanarea:             req.Ofanarea,
		OfEquipment:          req.OfEquipment,
		Suggestion:           req.Suggestion,
		StatusInt:            statusInt,
		StatusStr:            statusStr,
		AttachmentURLs:       req.AttachmentURLs,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if _, err := docRef.Set(ctx, record); err != nil {
		return nil, fmt.Errorf("create hazard report: %w", err)
	}
	return record, nil
}

func (r *FirestoreDispatchRepository) GetHazardReportByID(ctx context.Context, id string) (*models.HazardReport, error) {
	docRef := r.client.Collection(r.hazardReportColl).Doc(id)
	doc, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get hazard report %s: %w", id, err)
	}
	var rec models.HazardReport
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	rec.ID = doc.Ref.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) listHazardReportsFromFirestore(ctx context.Context, reportedByEmployeeID string, statusInt *int, officeHazardType string) ([]*models.HazardReport, error) {
	q := r.client.Collection(r.hazardReportColl).Query
	if reportedByEmployeeID != "" {
		q = q.Where("reportedByEmployeeId", "==", reportedByEmployeeID)
	}
	if statusInt != nil {
		q = q.Where("statusInt", "==", *statusInt)
	}
	if officeHazardType != "" && officeHazardType != "all" && officeHazardType != "All" {
		q = q.Where("officeHazardType", "==", officeHazardType)
	}

	iter := q.Documents(ctx)
	defer iter.Stop()

	var results []*models.HazardReport
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("list hazard reports: %w", err)
		}
		var rec models.HazardReport
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		rec.ID = doc.Ref.ID
		results = append(results, &rec)
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) listHazardReportsFromBigQuery(ctx context.Context, reportedByEmployeeID string, statusInt *int, officeHazardType string) ([]*models.HazardReport, error) {
	if r.bqClient == nil {
		return nil, errors.New("bigquery client not initialized")
	}

	querySQL := fmt.Sprintf("SELECT id, data FROM `%s.%s.%s` WHERE 1=1",
		r.projectID, r.bqDataset, r.hazardReportColl)
	var params []bigquery.QueryParameter

	if reportedByEmployeeID != "" {
		querySQL += " AND JSON_VALUE(data, '$.reportedByEmployeeId') = @repEmpId"
		params = append(params, bigquery.QueryParameter{Name: "repEmpId", Value: reportedByEmployeeID})
	}
	if statusInt != nil {
		querySQL += " AND CAST(JSON_VALUE(data, '$.statusInt') AS INT64) = @statusInt"
		params = append(params, bigquery.QueryParameter{Name: "statusInt", Value: *statusInt})
	}
	if officeHazardType != "" && officeHazardType != "all" && officeHazardType != "All" {
		querySQL += " AND JSON_VALUE(data, '$.officeHazardType') = @hazardType"
		params = append(params, bigquery.QueryParameter{Name: "hazardType", Value: officeHazardType})
	}

	q := r.bqClient.Query(querySQL)
	q.Parameters = params

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var results []*models.HazardReport
	for {
		var row struct {
			ID   string `bigquery:"id"`
			Data string `bigquery:"data"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var rec models.HazardReport
		if err := json.Unmarshal([]byte(row.Data), &rec); err == nil {
			if rec.ID == "" {
				rec.ID = row.ID
			}
			results = append(results, &rec)
		}
	}
	return results, nil
}

func (r *FirestoreDispatchRepository) ListHazardReports(ctx context.Context, reportedByEmployeeID string, statusInt *int, officeHazardType string) ([]*models.HazardReport, error) {
	results, err := r.listHazardReportsFromFirestore(ctx, reportedByEmployeeID, statusInt, officeHazardType)
	if err != nil {
		return nil, err
	}

	if len(results) == 0 && r.bqClient != nil {
		if bqRes, bqErr := r.listHazardReportsFromBigQuery(ctx, reportedByEmployeeID, statusInt, officeHazardType); bqErr == nil && len(bqRes) > 0 {
			results = bqRes
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.After(results[j].CreatedAt)
	})
	return results, nil
}

func (r *FirestoreDispatchRepository) UpdateHazardReportOffice(ctx context.Context, id string, req *models.UpdateHazardReportOfficePayload) (*models.HazardReport, error) {
	docRef := r.client.Collection(r.hazardReportColl).Doc(id)
	now := time.Now().UTC()

	statusInt := req.StatusInt
	isCompleted := req.IsCompleted
	if isCompleted && statusInt < 2 {
		statusInt = 2
	} else if statusInt == 2 {
		isCompleted = true
	}
	statusStr := hazardStatusStr(statusInt)

	updates := []firestore.Update{
		{Path: "moderate", Value: req.Moderate},
		{Path: "serious", Value: req.Serious},
		{Path: "minor", Value: req.Minor},
		{Path: "probableRecurrence", Value: req.ProbableRecurrence},
		{Path: "occasional", Value: req.Occasional},
		{Path: "rare", Value: req.Rare},
		{Path: "suggestion", Value: req.Suggestion},
		{Path: "actionTaken", Value: req.ActionTaken},
		{Path: "assignedTo", Value: req.AssignedTo},
		{Path: "isCompleted", Value: isCompleted},
		{Path: "officeHazardType", Value: req.OfficeHazardType},
		{Path: "employeeIdError", Value: req.EmployeeIDError},
		{Path: "employeeNameError", Value: req.EmployeeNameError},
		{Path: "statusInt", Value: statusInt},
		{Path: "statusStr", Value: statusStr},
		{Path: "updatedAt", Value: now},
	}
	if req.SafetySignedBy != "" {
		updates = append(updates, firestore.Update{Path: "safetySignedBy", Value: req.SafetySignedBy})
		updates = append(updates, firestore.Update{Path: "safetySignedDate", Value: now})
	}

	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, fmt.Errorf("update hazard report %s: %w", id, err)
	}
	return r.GetHazardReportByID(ctx, id)
}

func calcRouteAssessmentStatus(isCompleted bool, isSubmitted bool) (int, string) {
	if isSubmitted {
		return 3, "Submitted"
	}
	if isCompleted {
		return 2, "Completed"
	}
	return 0, "Working"
}

func (r *FirestoreDispatchRepository) CreateRouteAssessment(ctx context.Context, req *models.CreateRouteAssessmentPayload) (*models.RouteAssessment, error) {
	docRef := r.client.Collection(r.routeAssessmentColl).NewDoc()
	now := time.Now().UTC()

	statusInt, statusStr := calcRouteAssessmentStatus(req.IsCompleted, req.IsSubmitted)

	assessmentDate := req.AssessmentDate
	if assessmentDate == nil {
		assessmentDate = &now
	}

	record := &models.RouteAssessment{
		ID:                      docRef.ID,
		AssessmentType:          req.AssessmentType,
		RouteID:                 req.RouteID,
		SchoolBoardID:           req.SchoolBoardID,
		SchoolBoard:             req.SchoolBoard,
		SchoolID:                req.SchoolID,
		School:                  req.School,
		SchoolYear:              req.SchoolYear,
		AssessmentDate:          assessmentDate,
		ConductedByDriver:       req.ConductedByDriver,
		ConductedByOperator:     req.ConductedByOperator,
		ConductedByEmployeeID:   req.ConductedByEmployeeID,
		DriverEmail:             req.DriverEmail,
		DriverPhone:             req.DriverPhone,
		Summary:                 req.Summary,
		VisibilityProblemCheck:  req.VisibilityProblemCheck,
		VisibilityProblem:       req.VisibilityProblem,
		HighwayStopConcernCheck: req.HighwayStopConcernCheck,
		HighwayStopConcern:      req.HighwayStopConcern,
		LocationProblemCheck:    req.LocationProblemCheck,
		LocationProblem:         req.LocationProblem,
		UnsafeTurnaroundCheck:   req.UnsafeTurnaroundCheck,
		UnsafeTurnaround:        req.UnsafeTurnaround,
		IntersectionCheck:       req.IntersectionCheck,
		Intersection:            req.Intersection,
		RoadwayCheck:            req.RoadwayCheck,
		Roadway:                 req.Roadway,
		NonweatherRiskCheck:     req.NonweatherRiskCheck,
		NonweatherRisk:          req.NonweatherRisk,
		WeatherRiskCheck:        req.WeatherRiskCheck,
		WeatherRisk:             req.WeatherRisk,
		CompanyPolicyCheck:      req.CompanyPolicyCheck,
		CompanyPolicyFamiliar:   req.CompanyPolicyFamiliar,
		RouteAdjustCheck:        req.RouteAdjustCheck,
		RouteAdjust:             req.RouteAdjust,
		SafetyConcernCheck:      req.SafetyConcernCheck,
		SafetyConcern:           req.SafetyConcern,
		AssignedTo:              req.AssignedTo,
		IsCompleted:             req.IsCompleted,
		IsSubmitted:             req.IsSubmitted,
		StatusInt:               statusInt,
		StatusStr:               statusStr,
		AttachmentURLs:          req.AttachmentURLs,
		CreatedAt:               now,
		UpdatedAt:               now,
	}

	if _, err := docRef.Set(ctx, record); err != nil {
		return nil, fmt.Errorf("create route assessment in firestore: %w", err)
	}
	return record, nil
}

func (r *FirestoreDispatchRepository) GetRouteAssessmentByID(ctx context.Context, id string) (*models.RouteAssessment, error) {
	docSnap, err := r.client.Collection(r.routeAssessmentColl).Doc(id).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get route assessment %s: %w", id, err)
	}
	var rec models.RouteAssessment
	if err := docSnap.DataTo(&rec); err != nil {
		return nil, fmt.Errorf("unmarshal route assessment %s: %w", id, err)
	}
	rec.ID = docSnap.Ref.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) ListRouteAssessments(ctx context.Context, routeID string, employeeID string, statusInt *int, assessmentType string) ([]*models.RouteAssessment, error) {
	iter := r.client.Collection(r.routeAssessmentColl).Documents(ctx)
	var results []*models.RouteAssessment
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("iterate route assessments: %w", err)
		}
		var rec models.RouteAssessment
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		rec.ID = doc.Ref.ID

		if routeID != "" && rec.RouteID != routeID {
			continue
		}
		if employeeID != "" && rec.ConductedByEmployeeID != employeeID {
			continue
		}
		if statusInt != nil && rec.StatusInt != *statusInt {
			continue
		}
		if assessmentType != "" && assessmentType != "all" && rec.AssessmentType != assessmentType {
			continue
		}
		results = append(results, &rec)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.After(results[j].CreatedAt)
	})
	return results, nil
}

func (r *FirestoreDispatchRepository) UpdateRouteAssessmentOffice(ctx context.Context, id string, req *models.UpdateRouteAssessmentOfficePayload) (*models.RouteAssessment, error) {
	current, err := r.GetRouteAssessmentByID(ctx, id)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	updates := []firestore.Update{
		{Path: "updatedAt", Value: now},
	}

	isCompleted := current.IsCompleted
	isSubmitted := current.IsSubmitted

	if req.AssignedTo != nil {
		updates = append(updates, firestore.Update{Path: "assignedTo", Value: *req.AssignedTo})
	}
	if req.IsCompleted != nil {
		isCompleted = *req.IsCompleted
		updates = append(updates, firestore.Update{Path: "isCompleted", Value: isCompleted})
	}
	if req.IsSubmitted != nil {
		isSubmitted = *req.IsSubmitted
		updates = append(updates, firestore.Update{Path: "isSubmitted", Value: isSubmitted})
	}

	statusInt, statusStr := calcRouteAssessmentStatus(isCompleted, isSubmitted)
	updates = append(updates, firestore.Update{Path: "statusInt", Value: statusInt})
	updates = append(updates, firestore.Update{Path: "statusStr", Value: statusStr})

	docRef := r.client.Collection(r.routeAssessmentColl).Doc(id)
	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, fmt.Errorf("update route assessment office %s: %w", id, err)
	}
	return r.GetRouteAssessmentByID(ctx, id)
}

func (r *FirestoreDispatchRepository) UpdateRouteAssessment(ctx context.Context, id string, req *models.UpdateRouteAssessmentPayload) (*models.RouteAssessment, error) {
	current, err := r.GetRouteAssessmentByID(ctx, id)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	updates := []firestore.Update{
		{Path: "updatedAt", Value: now},
	}

	if req.AssessmentType != nil {
		updates = append(updates, firestore.Update{Path: "assessmentType", Value: *req.AssessmentType})
	}
	if req.RouteID != nil {
		updates = append(updates, firestore.Update{Path: "routeId", Value: *req.RouteID})
	}
	if req.SchoolBoard != nil {
		updates = append(updates, firestore.Update{Path: "schoolBoard", Value: *req.SchoolBoard})
	}
	if req.School != nil {
		updates = append(updates, firestore.Update{Path: "school", Value: *req.School})
	}
	if req.SchoolYear != nil {
		updates = append(updates, firestore.Update{Path: "schoolYear", Value: *req.SchoolYear})
	}
	if req.AssessmentDate != nil {
		updates = append(updates, firestore.Update{Path: "assessmentDate", Value: req.AssessmentDate})
	}
	if req.Summary != nil {
		updates = append(updates, firestore.Update{Path: "summary", Value: *req.Summary})
	}
	if req.VisibilityProblemCheck != nil {
		updates = append(updates, firestore.Update{Path: "visibilityProblemCheck", Value: *req.VisibilityProblemCheck})
	}
	if req.VisibilityProblem != nil {
		updates = append(updates, firestore.Update{Path: "visibilityProblem", Value: *req.VisibilityProblem})
	}
	if req.HighwayStopConcernCheck != nil {
		updates = append(updates, firestore.Update{Path: "highwayStopConcernCheck", Value: *req.HighwayStopConcernCheck})
	}
	if req.HighwayStopConcern != nil {
		updates = append(updates, firestore.Update{Path: "highwayStopConcern", Value: *req.HighwayStopConcern})
	}
	if req.LocationProblemCheck != nil {
		updates = append(updates, firestore.Update{Path: "locationProblemCheck", Value: *req.LocationProblemCheck})
	}
	if req.LocationProblem != nil {
		updates = append(updates, firestore.Update{Path: "locationProblem", Value: *req.LocationProblem})
	}
	if req.UnsafeTurnaroundCheck != nil {
		updates = append(updates, firestore.Update{Path: "unsafeTurnaroundCheck", Value: *req.UnsafeTurnaroundCheck})
	}
	if req.UnsafeTurnaround != nil {
		updates = append(updates, firestore.Update{Path: "unsafeTurnaround", Value: *req.UnsafeTurnaround})
	}
	if req.IntersectionCheck != nil {
		updates = append(updates, firestore.Update{Path: "intersectionCheck", Value: *req.IntersectionCheck})
	}
	if req.Intersection != nil {
		updates = append(updates, firestore.Update{Path: "intersection", Value: *req.Intersection})
	}
	if req.RoadwayCheck != nil {
		updates = append(updates, firestore.Update{Path: "roadwayCheck", Value: *req.RoadwayCheck})
	}
	if req.Roadway != nil {
		updates = append(updates, firestore.Update{Path: "roadway", Value: *req.Roadway})
	}
	if req.NonweatherRiskCheck != nil {
		updates = append(updates, firestore.Update{Path: "nonweatherRiskCheck", Value: *req.NonweatherRiskCheck})
	}
	if req.NonweatherRisk != nil {
		updates = append(updates, firestore.Update{Path: "nonweatherRisk", Value: *req.NonweatherRisk})
	}
	if req.WeatherRiskCheck != nil {
		updates = append(updates, firestore.Update{Path: "weatherRiskCheck", Value: *req.WeatherRiskCheck})
	}
	if req.WeatherRisk != nil {
		updates = append(updates, firestore.Update{Path: "weatherRisk", Value: *req.WeatherRisk})
	}
	if req.CompanyPolicyCheck != nil {
		updates = append(updates, firestore.Update{Path: "companyPolicyCheck", Value: *req.CompanyPolicyCheck})
	}
	if req.CompanyPolicyFamiliar != nil {
		updates = append(updates, firestore.Update{Path: "companyPolicyFamiliar", Value: *req.CompanyPolicyFamiliar})
	}
	if req.RouteAdjustCheck != nil {
		updates = append(updates, firestore.Update{Path: "routeAdjustCheck", Value: *req.RouteAdjustCheck})
	}
	if req.RouteAdjust != nil {
		updates = append(updates, firestore.Update{Path: "routeAdjust", Value: *req.RouteAdjust})
	}
	if req.SafetyConcernCheck != nil {
		updates = append(updates, firestore.Update{Path: "safetyConcernCheck", Value: *req.SafetyConcernCheck})
	}
	if req.SafetyConcern != nil {
		updates = append(updates, firestore.Update{Path: "safetyConcern", Value: *req.SafetyConcern})
	}
	if req.AssignedTo != nil {
		updates = append(updates, firestore.Update{Path: "assignedTo", Value: *req.AssignedTo})
	}
	if req.AttachmentURLs != nil {
		updates = append(updates, firestore.Update{Path: "attachmentUrls", Value: req.AttachmentURLs})
	}

	isCompleted := current.IsCompleted
	if req.IsCompleted != nil {
		isCompleted = *req.IsCompleted
		updates = append(updates, firestore.Update{Path: "isCompleted", Value: isCompleted})
	}
	isSubmitted := current.IsSubmitted
	if req.IsSubmitted != nil {
		isSubmitted = *req.IsSubmitted
		updates = append(updates, firestore.Update{Path: "isSubmitted", Value: isSubmitted})
	}

	statusInt, statusStr := calcRouteAssessmentStatus(isCompleted, isSubmitted)
	updates = append(updates, firestore.Update{Path: "statusInt", Value: statusInt})
	updates = append(updates, firestore.Update{Path: "statusStr", Value: statusStr})

	docRef := r.client.Collection(r.routeAssessmentColl).Doc(id)
	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, fmt.Errorf("update route assessment %s: %w", id, err)
	}
	return r.GetRouteAssessmentByID(ctx, id)
}

func (r *FirestoreDispatchRepository) DeleteRouteAssessment(ctx context.Context, id string) error {
	docRef := r.client.Collection(r.routeAssessmentColl).Doc(id)
	if _, err := docRef.Delete(ctx); err != nil {
		return fmt.Errorf("delete route assessment %s: %w", id, err)
	}
	return nil
}

// ─── Firestore: Vehicle Sign-Outs / Handovers ────────────────────────────────

func (r *FirestoreDispatchRepository) CreateVehicleSignout(ctx context.Context, req *models.CreateVehicleSignoutPayload) (*models.VehicleSignout, error) {
	docRef := r.client.Collection(r.vehicleSignoutColl).NewDoc()
	now := time.Now().UTC()

	signDate := req.SignDate
	if signDate == "" {
		signDate = now.Format("2006-01-02")
	}

	attachments := req.Attachments
	if attachments == nil {
		attachments = []models.VehicleSignoutAttachment{}
	}

	record := &models.VehicleSignout{
		ID:                           docRef.ID,
		IsSignIn:                     req.IsSignIn,
		SignDate:                     signDate,
		VehicleType:                  req.VehicleType,
		EmployeeID:                   req.EmployeeID,
		EmployeeName:                 req.EmployeeName,
		RouteID:                      req.RouteID,
		RouteName:                    req.RouteName,
		CellPhone:                    req.CellPhone,
		DriverLicenseClass:           req.DriverLicenseClass,
		DriverLicenseCondition:       req.DriverLicenseCondition,
		UnitID:                       req.UnitID,
		UnitNumber:                   req.UnitNumber,
		Odometer:                     req.Odometer,
		LicensePlate:                 req.LicensePlate,
		CVIPDate:                     req.CVIPDate,
		UnitYear:                     req.UnitYear,
		UnitMaker:                    req.UnitMaker,
		UnitModel:                    req.UnitModel,
		UnitColor:                    req.UnitColor,
		FuelLevelID:                  req.FuelLevelID,
		FuelLevelDescription:         req.FuelLevelDescription,
		FuelTypeID:                   req.FuelTypeID,
		FuelTypeDescription:          req.FuelTypeDescription,
		DocRegistrationSignIn:        req.DocRegistrationSignIn,
		DocInsuranceSignIn:           req.DocInsuranceSignIn,
		DocSafetyFitnessSignIn:       req.DocSafetyFitnessSignIn,
		DocCollisionReportSignIn:     req.DocCollisionReportSignIn,
		DocScheduleMaintenanceSignIn: req.DocScheduleMaintenanceSignIn,
		DocSDSSignIn:                 req.DocSDSSignIn,
		CheckFireExtinguisher:        req.CheckFireExtinguisher,
		CheckFirstAidKit:             req.CheckFirstAidKit,
		CheckTriangles:               req.CheckTriangles,
		CheckQstraints:               req.CheckQstraints,
		CheckSeatBeltCutter:          req.CheckSeatBeltCutter,
		CheckBroom:                   req.CheckBroom,
		CheckSnowbrush:               req.CheckSnowbrush,
		CheckCleankit:                req.CheckCleankit,
		AcknowledgeCheck:             req.AcknowledgeCheck,
		ConditionKey:                 req.ConditionKey,
		ConditionComments:            req.ConditionComments,
		ParkingAddress:               req.ParkingAddress,
		FireHallLocation:             req.FireHallLocation,
		DriverSignature:              req.DriverSignature,
		DriverSignDate:               req.DriverSignDate,
		FleetDepartmentSignature:     req.FleetDepartmentSignature,
		FleetDepartmentSignDate:      req.FleetDepartmentSignDate,
		Attachments:                  attachments,
		CreatedBy:                    req.CreatedBy,
		CreatedAt:                    now,
		UpdatedAt:                    now,
	}

	if _, err := docRef.Set(ctx, record); err != nil {
		return nil, fmt.Errorf("create vehicle signout in firestore: %w", err)
	}
	return record, nil
}

func (r *FirestoreDispatchRepository) GetVehicleSignoutByID(ctx context.Context, id string) (*models.VehicleSignout, error) {
	docSnap, err := r.client.Collection(r.vehicleSignoutColl).Doc(id).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get vehicle signout %s: %w", id, err)
	}
	var rec models.VehicleSignout
	if err := docSnap.DataTo(&rec); err != nil {
		return nil, fmt.Errorf("deserialize vehicle signout: %w", err)
	}
	rec.ID = docSnap.Ref.ID
	return &rec, nil
}

func (r *FirestoreDispatchRepository) ListVehicleSignouts(ctx context.Context, unitNumber, employeeID string, isSignIn *bool, startDate, endDate string) ([]*models.VehicleSignout, error) {
	iter := r.client.Collection(r.vehicleSignoutColl).Documents(ctx)
	var results []*models.VehicleSignout
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("iterate vehicle signouts: %w", err)
		}
		var rec models.VehicleSignout
		if err := doc.DataTo(&rec); err != nil {
			continue
		}
		rec.ID = doc.Ref.ID

		if unitNumber != "" && !strings.EqualFold(rec.UnitNumber, unitNumber) {
			continue
		}
		if employeeID != "" && rec.EmployeeID != employeeID {
			continue
		}
		if isSignIn != nil && rec.IsSignIn != *isSignIn {
			continue
		}
		if startDate != "" && rec.SignDate < startDate {
			continue
		}
		if endDate != "" && rec.SignDate > endDate {
			continue
		}
		results = append(results, &rec)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.After(results[j].CreatedAt)
	})
	return results, nil
}

func (r *FirestoreDispatchRepository) UpdateVehicleSignout(ctx context.Context, id string, req *models.UpdateVehicleSignoutPayload) (*models.VehicleSignout, error) {
	now := time.Now().UTC()
	updates := []firestore.Update{
		{Path: "updatedAt", Value: now},
	}

	if req.IsSignIn != nil {
		updates = append(updates, firestore.Update{Path: "isSignIn", Value: *req.IsSignIn})
	}
	if req.SignDate != "" {
		updates = append(updates, firestore.Update{Path: "signDate", Value: req.SignDate})
	}
	if req.VehicleType != nil {
		updates = append(updates, firestore.Update{Path: "vehicleType", Value: *req.VehicleType})
	}
	if req.EmployeeID != "" {
		updates = append(updates, firestore.Update{Path: "employeeId", Value: req.EmployeeID})
	}
	if req.EmployeeName != "" {
		updates = append(updates, firestore.Update{Path: "employeeName", Value: req.EmployeeName})
	}
	if req.RouteID != "" {
		updates = append(updates, firestore.Update{Path: "routeId", Value: req.RouteID})
	}
	if req.RouteName != "" {
		updates = append(updates, firestore.Update{Path: "routeName", Value: req.RouteName})
	}
	if req.CellPhone != "" {
		updates = append(updates, firestore.Update{Path: "cellPhone", Value: req.CellPhone})
	}
	if req.DriverLicenseClass != "" {
		updates = append(updates, firestore.Update{Path: "driverLicenseClass", Value: req.DriverLicenseClass})
	}
	if req.DriverLicenseCondition != "" {
		updates = append(updates, firestore.Update{Path: "driverLicenseCondition", Value: req.DriverLicenseCondition})
	}
	if req.UnitID != nil {
		updates = append(updates, firestore.Update{Path: "unitId", Value: *req.UnitID})
	}
	if req.UnitNumber != "" {
		updates = append(updates, firestore.Update{Path: "unitNumber", Value: req.UnitNumber})
	}
	if req.Odometer != nil {
		updates = append(updates, firestore.Update{Path: "odometer", Value: *req.Odometer})
	}
	if req.LicensePlate != "" {
		updates = append(updates, firestore.Update{Path: "licensePlate", Value: req.LicensePlate})
	}
	if req.CVIPDate != "" {
		updates = append(updates, firestore.Update{Path: "cvipDate", Value: req.CVIPDate})
	}
	if req.UnitYear != nil {
		updates = append(updates, firestore.Update{Path: "unitYear", Value: *req.UnitYear})
	}
	if req.UnitMaker != "" {
		updates = append(updates, firestore.Update{Path: "unitMaker", Value: req.UnitMaker})
	}
	if req.UnitModel != "" {
		updates = append(updates, firestore.Update{Path: "unitModel", Value: req.UnitModel})
	}
	if req.UnitColor != "" {
		updates = append(updates, firestore.Update{Path: "unitColor", Value: req.UnitColor})
	}
	if req.FuelLevelID != nil {
		updates = append(updates, firestore.Update{Path: "fuelLevelId", Value: *req.FuelLevelID})
	}
	if req.FuelLevelDescription != "" {
		updates = append(updates, firestore.Update{Path: "fuelLevelDescription", Value: req.FuelLevelDescription})
	}
	if req.FuelTypeID != nil {
		updates = append(updates, firestore.Update{Path: "fuelTypeId", Value: *req.FuelTypeID})
	}
	if req.FuelTypeDescription != "" {
		updates = append(updates, firestore.Update{Path: "fuelTypeDescription", Value: req.FuelTypeDescription})
	}
	if req.DocRegistrationSignIn != nil {
		updates = append(updates, firestore.Update{Path: "docRegistrationSignIn", Value: *req.DocRegistrationSignIn})
	}
	if req.DocInsuranceSignIn != nil {
		updates = append(updates, firestore.Update{Path: "docInsuranceSignIn", Value: *req.DocInsuranceSignIn})
	}
	if req.DocSafetyFitnessSignIn != nil {
		updates = append(updates, firestore.Update{Path: "docSafetyFitnessSignIn", Value: *req.DocSafetyFitnessSignIn})
	}
	if req.DocCollisionReportSignIn != nil {
		updates = append(updates, firestore.Update{Path: "docCollisionReportSignIn", Value: *req.DocCollisionReportSignIn})
	}
	if req.DocScheduleMaintenanceSignIn != nil {
		updates = append(updates, firestore.Update{Path: "docScheduleMaintenanceSignIn", Value: *req.DocScheduleMaintenanceSignIn})
	}
	if req.DocSDSSignIn != nil {
		updates = append(updates, firestore.Update{Path: "docSdsSignIn", Value: *req.DocSDSSignIn})
	}
	if req.CheckFireExtinguisher != nil {
		updates = append(updates, firestore.Update{Path: "checkFireExtinguisher", Value: *req.CheckFireExtinguisher})
	}
	if req.CheckFirstAidKit != nil {
		updates = append(updates, firestore.Update{Path: "checkFirstAidKit", Value: *req.CheckFirstAidKit})
	}
	if req.CheckTriangles != nil {
		updates = append(updates, firestore.Update{Path: "checkTriangles", Value: *req.CheckTriangles})
	}
	if req.CheckQstraints != nil {
		updates = append(updates, firestore.Update{Path: "checkQstraints", Value: *req.CheckQstraints})
	}
	if req.CheckSeatBeltCutter != nil {
		updates = append(updates, firestore.Update{Path: "checkSeatBeltCutter", Value: *req.CheckSeatBeltCutter})
	}
	if req.CheckBroom != nil {
		updates = append(updates, firestore.Update{Path: "checkBroom", Value: *req.CheckBroom})
	}
	if req.CheckSnowbrush != nil {
		updates = append(updates, firestore.Update{Path: "checkSnowbrush", Value: *req.CheckSnowbrush})
	}
	if req.CheckCleankit != nil {
		updates = append(updates, firestore.Update{Path: "checkCleankit", Value: *req.CheckCleankit})
	}
	if req.AcknowledgeCheck != nil {
		updates = append(updates, firestore.Update{Path: "acknowledgeCheck", Value: *req.AcknowledgeCheck})
	}
	if req.ConditionKey != "" {
		updates = append(updates, firestore.Update{Path: "conditionKey", Value: req.ConditionKey})
	}
	if req.ConditionComments != "" {
		updates = append(updates, firestore.Update{Path: "conditionComments", Value: req.ConditionComments})
	}
	if req.ParkingAddress != "" {
		updates = append(updates, firestore.Update{Path: "parkingAddress", Value: req.ParkingAddress})
	}
	if req.FireHallLocation != "" {
		updates = append(updates, firestore.Update{Path: "fireHallLocation", Value: req.FireHallLocation})
	}
	if req.DriverSignature != "" {
		updates = append(updates, firestore.Update{Path: "driverSignature", Value: req.DriverSignature})
	}
	if req.DriverSignDate != "" {
		updates = append(updates, firestore.Update{Path: "driverSignDate", Value: req.DriverSignDate})
	}
	if req.FleetDepartmentSignature != "" {
		updates = append(updates, firestore.Update{Path: "fleetDepartmentSignature", Value: req.FleetDepartmentSignature})
	}
	if req.FleetDepartmentSignDate != "" {
		updates = append(updates, firestore.Update{Path: "fleetDepartmentSignDate", Value: req.FleetDepartmentSignDate})
	}
	if req.Attachments != nil {
		updates = append(updates, firestore.Update{Path: "attachments", Value: req.Attachments})
	}

	docRef := r.client.Collection(r.vehicleSignoutColl).Doc(id)
	if _, err := docRef.Update(ctx, updates); err != nil {
		return nil, fmt.Errorf("update vehicle signout %s: %w", id, err)
	}
	return r.GetVehicleSignoutByID(ctx, id)
}

func (r *FirestoreDispatchRepository) DeleteVehicleSignout(ctx context.Context, id string) error {
	docRef := r.client.Collection(r.vehicleSignoutColl).Doc(id)
	if _, err := docRef.Delete(ctx); err != nil {
		return fmt.Errorf("delete vehicle signout %s: %w", id, err)
	}
	return nil
}

// ─── Memory: Student Incident Reports ───────────────────────────────────────

func (m *MemoryDispatchRepository) CreateStudentIncident(ctx context.Context, req *models.CreateStudentIncidentPayload) (*models.StudentIncident, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	id := fmt.Sprintf("incident-%d", now.UnixNano())

	status := "submitted"
	record := &models.StudentIncident{
		ID:                         id,
		IncidentDate:               req.IncidentDate,
		IncidentTime:               req.IncidentTime,
		StudentID:                  req.StudentID,
		StudentNo:                  req.StudentNo,
		StudentName:                req.StudentName,
		Grade:                      req.Grade,
		SchoolID:                   req.SchoolID,
		SchoolName:                 req.SchoolName,
		RouteID:                    req.RouteID,
		RouteNo:                    req.RouteNo,
		RouteName:                  req.RouteName,
		ShiftType:                  req.ShiftType,
		DriverID:                   req.DriverID,
		DriverName:                 req.DriverName,
		Location:                   req.Location,
		IncidentTypes:              req.IncidentTypes,
		TypeOther:                  req.TypeOther,
		Description:                req.Description,
		OtherStudentsInvolved:      req.OtherStudentsInvolved,
		Witnesses:                  req.Witnesses,
		ImmediateActionTaken:       req.ImmediateActionTaken,
		StudentRemovedFromBus:      req.StudentRemovedFromBus,
		FirstAidRequired:           req.FirstAidRequired,
		ParentsNotified:            req.ParentsNotified,
		ParentsNotificationDetail: req.ParentsNotificationDetail,
		Status:                     status,
		CreatedAt:                  now,
		UpdatedAt:                  now,
	}

	m.studentIncidents[id] = record
	return record, nil
}

func (m *MemoryDispatchRepository) GetStudentIncidentByID(ctx context.Context, id string) (*models.StudentIncident, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rec, ok := m.studentIncidents[id]
	if !ok {
		return nil, fmt.Errorf("student incident not found: %s", id)
	}
	return rec, nil
}

func (m *MemoryDispatchRepository) ListStudentIncidents(ctx context.Context, studentID int, routeNo string, driverID string, status string, needsFollowUp bool) ([]*models.StudentIncident, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []*models.StudentIncident
	for _, rec := range m.studentIncidents {
		if studentID > 0 && rec.StudentID != studentID {
			continue
		}
		if routeNo != "" && rec.RouteNo != routeNo {
			continue
		}
		if driverID != "" && rec.DriverID != driverID {
			continue
		}
		if status != "" && rec.Status != status {
			continue
		}
		if needsFollowUp {
			if rec.OfficeFollowUp != nil && rec.OfficeFollowUp.IsOfficeLocked {
				continue
			}
			if rec.Status == "closed" {
				continue
			}
		}
		results = append(results, rec)
	}
	return results, nil
}

func (m *MemoryDispatchRepository) UpdateStudentIncidentOfficeFollowUp(ctx context.Context, id string, req *models.UpdateIncidentOfficeFollowUpPayload) (*models.StudentIncident, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.studentIncidents[id]
	if !ok {
		return nil, fmt.Errorf("student incident not found: %s", id)
	}

	now := time.Now().UTC()
	if rec.OfficeFollowUp == nil {
		rec.OfficeFollowUp = &models.IncidentOfficeFollowUp{}
	}
	rec.OfficeFollowUp.ReviewedDate = req.ReviewedDate
	rec.OfficeFollowUp.AdministratorName = req.AdministratorName
	rec.OfficeFollowUp.DisciplinaryActions = req.DisciplinaryActions
	rec.OfficeFollowUp.DisciplinaryOther = req.DisciplinaryOther
	rec.OfficeFollowUp.OfficeNotes = req.OfficeNotes
	rec.OfficeFollowUp.IsOfficeLocked = req.IsOfficeLocked
	rec.OfficeFollowUp.ReviewedAt = &now

	if req.Status != "" {
		rec.Status = req.Status
	}
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) UpdateStudentIncidentStatus(ctx context.Context, id string, status string) (*models.StudentIncident, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.studentIncidents[id]
	if !ok {
		return nil, fmt.Errorf("student incident not found: %s", id)
	}
	now := time.Now().UTC()
	rec.Status = status
	rec.UpdatedAt = now
	return rec, nil
}

// ─── Memory: Expense Reimbursements ─────────────────────────────────────────

func (m *MemoryDispatchRepository) ListExpenseCategories(ctx context.Context) ([]*models.ExpenseCategory, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []*models.ExpenseCategory
	for _, cat := range m.expenseCategories {
		if cat.Active {
			results = append(results, cat)
		}
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].SortOrder < results[j].SortOrder
	})
	return results, nil
}

func (m *MemoryDispatchRepository) CreateExpenseClaim(ctx context.Context, req *models.CreateExpenseClaimPayload) (*models.ExpenseReimbursement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	id := fmt.Sprintf("claim-%d", now.UnixNano())

	total := 0.0
	lines := make([]models.ExpenseReimbursementLine, 0, len(req.Lines))
	for i, l := range req.Lines {
		sortOrder := l.SortOrder
		if sortOrder == 0 {
			sortOrder = i + 1
		}
		line := models.ExpenseReimbursementLine{
			ID:                  fmt.Sprintf("%s-line-%d", id, i+1),
			CategoryCode:        l.CategoryCode,
			CategoryDisplayName: l.CategoryDisplayName,
			Amount:              l.Amount,
			Note:                l.Note,
			SortOrder:           sortOrder,
		}
		total += l.Amount
		lines = append(lines, line)
	}

	record := &models.ExpenseReimbursement{
		ID:             id,
		EmployeeID:     req.EmployeeID,
		EmployeeName:   req.EmployeeName,
		ClaimDate:      req.ClaimDate,
		RouteNo:        req.RouteNo,
		TotalAmount:    total,
		Lines:          lines,
		AttachmentURLs: req.AttachmentURLs,
		Status:         "pending",
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	m.expenseClaims[id] = record
	return record, nil
}

func (m *MemoryDispatchRepository) GetExpenseClaimByID(ctx context.Context, id string) (*models.ExpenseReimbursement, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rec, ok := m.expenseClaims[id]
	if !ok {
		return nil, fmt.Errorf("expense claim not found: %s", id)
	}
	return rec, nil
}

func (m *MemoryDispatchRepository) ListExpenseClaims(ctx context.Context, employeeID string, status string) ([]*models.ExpenseReimbursement, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []*models.ExpenseReimbursement
	for _, rec := range m.expenseClaims {
		if employeeID != "" && rec.EmployeeID != employeeID {
			continue
		}
		if status != "" && rec.Status != status {
			continue
		}
		results = append(results, rec)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.After(results[j].CreatedAt)
	})

	return results, nil
}

func (m *MemoryDispatchRepository) ReviewExpenseClaim(ctx context.Context, id string, req *models.ReviewExpenseClaimPayload) (*models.ExpenseReimbursement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.expenseClaims[id]
	if !ok {
		return nil, fmt.Errorf("expense claim not found: %s", id)
	}

	now := time.Now().UTC()
	rec.Status = req.Status
	rec.ApprovalNotes = req.ApprovalNotes
	rec.ApprovedByName = req.ApprovedByName
	rec.ApprovedAt = &now
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) CancelExpenseClaim(ctx context.Context, id string, employeeID string) (*models.ExpenseReimbursement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.expenseClaims[id]
	if !ok {
		return nil, fmt.Errorf("expense claim not found: %s", id)
	}

	if employeeID != "" && rec.EmployeeID != "" && rec.EmployeeID != employeeID {
		return nil, errors.New("unauthorized: cannot cancel claim belonging to another driver")
	}
	if rec.Status != "pending" {
		return nil, fmt.Errorf("cannot cancel claim with status '%s'; only pending claims can be cancelled", rec.Status)
	}

	now := time.Now().UTC()
	rec.Status = "cancelled"
	rec.UpdatedAt = now

	return rec, nil
}

// ─── Memory: Hazard & Near-Miss Reports ────────────────────────────────────

func (m *MemoryDispatchRepository) CreateHazardReport(ctx context.Context, req *models.CreateHazardReportPayload) (*models.HazardReport, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	id := fmt.Sprintf("hazard-%d", now.UnixNano())

	statusInt := 0
	statusStr := "Open"

	rec := &models.HazardReport{
		ID:                   id,
		ReportedBy:           req.ReportedBy,
		ReportedByEmployeeID: req.ReportedByEmployeeID,
		PersonInvolved:       req.PersonInvolved,
		UnitID:               req.UnitID,
		UnitNumber:           req.UnitNumber,
		RouteID:              req.RouteID,
		RouteName:            req.RouteName,
		Phone:                req.Phone,
		Supervisor:           req.Supervisor,
		EventTime:            req.EventTime,
		EventLocation:        req.EventLocation,
		Witnesses:            req.Witnesses,
		EventDescription:     req.EventDescription,
		TrippingHazard:       req.TrippingHazard,
		TrafficHazard:        req.TrafficHazard,
		EquipmentHazard:      req.EquipmentHazard,
		PerformanceHazard:    req.PerformanceHazard,
		SnowHazard:           req.SnowHazard,
		SpillHazard:          req.SpillHazard,
		OtherHazard:          req.OtherHazard,
		UnsafeAction:         req.UnsafeAction,
		UnsafeCondition:      req.UnsafeCondition,
		HappenedtoMe:         req.HappenedtoMe,
		HappenedtoSomeone:    req.HappenedtoSomeone,
		Ofanarea:             req.Ofanarea,
		OfEquipment:          req.OfEquipment,
		Suggestion:           req.Suggestion,
		StatusInt:            statusInt,
		StatusStr:            statusStr,
		AttachmentURLs:       req.AttachmentURLs,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	m.hazardReports[id] = rec
	return rec, nil
}

func (m *MemoryDispatchRepository) GetHazardReportByID(ctx context.Context, id string) (*models.HazardReport, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rec, ok := m.hazardReports[id]
	if !ok {
		return nil, fmt.Errorf("hazard report not found: %s", id)
	}
	return rec, nil
}

func (m *MemoryDispatchRepository) ListHazardReports(ctx context.Context, reportedByEmployeeID string, statusInt *int, officeHazardType string) ([]*models.HazardReport, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []*models.HazardReport
	for _, rec := range m.hazardReports {
		if reportedByEmployeeID != "" && rec.ReportedByEmployeeID != reportedByEmployeeID {
			continue
		}
		if statusInt != nil && rec.StatusInt != *statusInt {
			continue
		}
		if officeHazardType != "" && officeHazardType != "all" && officeHazardType != "All" && rec.OfficeHazardType != officeHazardType {
			continue
		}
		results = append(results, rec)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.After(results[j].CreatedAt)
	})
	return results, nil
}

func (m *MemoryDispatchRepository) UpdateHazardReportOffice(ctx context.Context, id string, req *models.UpdateHazardReportOfficePayload) (*models.HazardReport, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.hazardReports[id]
	if !ok {
		return nil, fmt.Errorf("hazard report not found: %s", id)
	}

	now := time.Now().UTC()
	statusInt := req.StatusInt
	isCompleted := req.IsCompleted
	if isCompleted && statusInt < 2 {
		statusInt = 2
	} else if statusInt == 2 {
		isCompleted = true
	}
	statusStr := hazardStatusStr(statusInt)

	rec.Moderate = req.Moderate
	rec.Serious = req.Serious
	rec.Minor = req.Minor
	rec.ProbableRecurrence = req.ProbableRecurrence
	rec.Occasional = req.Occasional
	rec.Rare = req.Rare
	rec.Suggestion = req.Suggestion
	rec.ActionTaken = req.ActionTaken
	rec.AssignedTo = req.AssignedTo
	rec.IsCompleted = isCompleted
	rec.OfficeHazardType = req.OfficeHazardType
	rec.EmployeeIDError = req.EmployeeIDError
	rec.EmployeeNameError = req.EmployeeNameError
	rec.StatusInt = statusInt
	rec.StatusStr = statusStr
	rec.UpdatedAt = now
	if req.SafetySignedBy != "" {
		rec.SafetySignedBy = req.SafetySignedBy
		rec.SafetySignedDate = &now
	}

	return rec, nil
}

func (m *MemoryDispatchRepository) CreateRouteAssessment(ctx context.Context, req *models.CreateRouteAssessmentPayload) (*models.RouteAssessment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	id := fmt.Sprintf("ra-%d", now.UnixNano())
	statusInt, statusStr := calcRouteAssessmentStatus(req.IsCompleted, req.IsSubmitted)

	assessmentDate := req.AssessmentDate
	if assessmentDate == nil {
		assessmentDate = &now
	}

	rec := &models.RouteAssessment{
		ID:                      id,
		AssessmentType:          req.AssessmentType,
		RouteID:                 req.RouteID,
		SchoolBoardID:           req.SchoolBoardID,
		SchoolBoard:             req.SchoolBoard,
		SchoolID:                req.SchoolID,
		School:                  req.School,
		SchoolYear:              req.SchoolYear,
		AssessmentDate:          assessmentDate,
		ConductedByDriver:       req.ConductedByDriver,
		ConductedByOperator:     req.ConductedByOperator,
		ConductedByEmployeeID:   req.ConductedByEmployeeID,
		DriverEmail:             req.DriverEmail,
		DriverPhone:             req.DriverPhone,
		Summary:                 req.Summary,
		VisibilityProblemCheck:  req.VisibilityProblemCheck,
		VisibilityProblem:       req.VisibilityProblem,
		HighwayStopConcernCheck: req.HighwayStopConcernCheck,
		HighwayStopConcern:      req.HighwayStopConcern,
		LocationProblemCheck:    req.LocationProblemCheck,
		LocationProblem:         req.LocationProblem,
		UnsafeTurnaroundCheck:   req.UnsafeTurnaroundCheck,
		UnsafeTurnaround:        req.UnsafeTurnaround,
		IntersectionCheck:       req.IntersectionCheck,
		Intersection:            req.Intersection,
		RoadwayCheck:            req.RoadwayCheck,
		Roadway:                 req.Roadway,
		NonweatherRiskCheck:     req.NonweatherRiskCheck,
		NonweatherRisk:          req.NonweatherRisk,
		WeatherRiskCheck:        req.WeatherRiskCheck,
		WeatherRisk:             req.WeatherRisk,
		CompanyPolicyCheck:      req.CompanyPolicyCheck,
		CompanyPolicyFamiliar:   req.CompanyPolicyFamiliar,
		RouteAdjustCheck:        req.RouteAdjustCheck,
		RouteAdjust:             req.RouteAdjust,
		SafetyConcernCheck:      req.SafetyConcernCheck,
		SafetyConcern:           req.SafetyConcern,
		AssignedTo:              req.AssignedTo,
		IsCompleted:             req.IsCompleted,
		IsSubmitted:             req.IsSubmitted,
		StatusInt:               statusInt,
		StatusStr:               statusStr,
		AttachmentURLs:          req.AttachmentURLs,
		CreatedAt:               now,
		UpdatedAt:               now,
	}

	m.routeAssessments[id] = rec
	return rec, nil
}

func (m *MemoryDispatchRepository) GetRouteAssessmentByID(ctx context.Context, id string) (*models.RouteAssessment, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rec, ok := m.routeAssessments[id]
	if !ok {
		return nil, fmt.Errorf("route assessment not found: %s", id)
	}
	return rec, nil
}

func (m *MemoryDispatchRepository) ListRouteAssessments(ctx context.Context, routeID string, employeeID string, statusInt *int, assessmentType string) ([]*models.RouteAssessment, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []*models.RouteAssessment
	for _, rec := range m.routeAssessments {
		if routeID != "" && rec.RouteID != routeID {
			continue
		}
		if employeeID != "" && rec.ConductedByEmployeeID != employeeID {
			continue
		}
		if statusInt != nil && rec.StatusInt != *statusInt {
			continue
		}
		if assessmentType != "" && assessmentType != "all" && rec.AssessmentType != assessmentType {
			continue
		}
		results = append(results, rec)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.After(results[j].CreatedAt)
	})
	return results, nil
}

func (m *MemoryDispatchRepository) UpdateRouteAssessmentOffice(ctx context.Context, id string, req *models.UpdateRouteAssessmentOfficePayload) (*models.RouteAssessment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.routeAssessments[id]
	if !ok {
		return nil, fmt.Errorf("route assessment not found: %s", id)
	}

	now := time.Now().UTC()
	if req.AssignedTo != nil {
		rec.AssignedTo = *req.AssignedTo
	}
	if req.IsCompleted != nil {
		rec.IsCompleted = *req.IsCompleted
	}
	if req.IsSubmitted != nil {
		rec.IsSubmitted = *req.IsSubmitted
	}

	statusInt, statusStr := calcRouteAssessmentStatus(rec.IsCompleted, rec.IsSubmitted)
	rec.StatusInt = statusInt
	rec.StatusStr = statusStr
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) UpdateRouteAssessment(ctx context.Context, id string, req *models.UpdateRouteAssessmentPayload) (*models.RouteAssessment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.routeAssessments[id]
	if !ok {
		return nil, fmt.Errorf("route assessment not found: %s", id)
	}

	now := time.Now().UTC()
	if req.AssessmentType != nil {
		rec.AssessmentType = *req.AssessmentType
	}
	if req.RouteID != nil {
		rec.RouteID = *req.RouteID
	}
	if req.SchoolBoard != nil {
		rec.SchoolBoard = *req.SchoolBoard
	}
	if req.School != nil {
		rec.School = *req.School
	}
	if req.SchoolYear != nil {
		rec.SchoolYear = *req.SchoolYear
	}
	if req.AssessmentDate != nil {
		rec.AssessmentDate = req.AssessmentDate
	}
	if req.Summary != nil {
		rec.Summary = *req.Summary
	}
	if req.VisibilityProblemCheck != nil {
		rec.VisibilityProblemCheck = *req.VisibilityProblemCheck
	}
	if req.VisibilityProblem != nil {
		rec.VisibilityProblem = *req.VisibilityProblem
	}
	if req.HighwayStopConcernCheck != nil {
		rec.HighwayStopConcernCheck = *req.HighwayStopConcernCheck
	}
	if req.HighwayStopConcern != nil {
		rec.HighwayStopConcern = *req.HighwayStopConcern
	}
	if req.LocationProblemCheck != nil {
		rec.LocationProblemCheck = *req.LocationProblemCheck
	}
	if req.LocationProblem != nil {
		rec.LocationProblem = *req.LocationProblem
	}
	if req.UnsafeTurnaroundCheck != nil {
		rec.UnsafeTurnaroundCheck = *req.UnsafeTurnaroundCheck
	}
	if req.UnsafeTurnaround != nil {
		rec.UnsafeTurnaround = *req.UnsafeTurnaround
	}
	if req.IntersectionCheck != nil {
		rec.IntersectionCheck = *req.IntersectionCheck
	}
	if req.Intersection != nil {
		rec.Intersection = *req.Intersection
	}
	if req.RoadwayCheck != nil {
		rec.RoadwayCheck = *req.RoadwayCheck
	}
	if req.Roadway != nil {
		rec.Roadway = *req.Roadway
	}
	if req.NonweatherRiskCheck != nil {
		rec.NonweatherRiskCheck = *req.NonweatherRiskCheck
	}
	if req.NonweatherRisk != nil {
		rec.NonweatherRisk = *req.NonweatherRisk
	}
	if req.WeatherRiskCheck != nil {
		rec.WeatherRiskCheck = *req.WeatherRiskCheck
	}
	if req.WeatherRisk != nil {
		rec.WeatherRisk = *req.WeatherRisk
	}
	if req.CompanyPolicyCheck != nil {
		rec.CompanyPolicyCheck = *req.CompanyPolicyCheck
	}
	if req.CompanyPolicyFamiliar != nil {
		rec.CompanyPolicyFamiliar = *req.CompanyPolicyFamiliar
	}
	if req.RouteAdjustCheck != nil {
		rec.RouteAdjustCheck = *req.RouteAdjustCheck
	}
	if req.RouteAdjust != nil {
		rec.RouteAdjust = *req.RouteAdjust
	}
	if req.SafetyConcernCheck != nil {
		rec.SafetyConcernCheck = *req.SafetyConcernCheck
	}
	if req.SafetyConcern != nil {
		rec.SafetyConcern = *req.SafetyConcern
	}
	if req.AssignedTo != nil {
		rec.AssignedTo = *req.AssignedTo
	}
	if req.IsCompleted != nil {
		rec.IsCompleted = *req.IsCompleted
	}
	if req.IsSubmitted != nil {
		rec.IsSubmitted = *req.IsSubmitted
	}
	if req.AttachmentURLs != nil {
		rec.AttachmentURLs = req.AttachmentURLs
	}

	statusInt, statusStr := calcRouteAssessmentStatus(rec.IsCompleted, rec.IsSubmitted)
	rec.StatusInt = statusInt
	rec.StatusStr = statusStr
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) DeleteRouteAssessment(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.routeAssessments[id]; !ok {
		return fmt.Errorf("route assessment not found: %s", id)
	}
	delete(m.routeAssessments, id)
	return nil
}

// ─── Memory: Vehicle Sign-Outs / Handovers ───────────────────────────────────

func seedDefaultVehicleSignouts(m *MemoryDispatchRepository) {
	now := time.Now().UTC()
	yesterday := now.AddDate(0, 0, -1)

	demo1 := &models.VehicleSignout{
		ID:                            "vso-1001",
		IsSignIn:                      false, // Sign Out
		SignDate:                      yesterday.Format("2006-01-02"),
		VehicleType:                   0, // Bus
		EmployeeID:                    "EMP-1002",
		EmployeeName:                  "John Smith",
		RouteID:                       "101",
		RouteName:                     "Route 101 - North Valley",
		CellPhone:                     "4035550192",
		DriverLicenseClass:            "Class 2-S",
		DriverLicenseCondition:        "None",
		UnitID:                        101,
		UnitNumber:                    "101",
		Odometer:                      45230.5,
		LicensePlate:                  "BUS-101",
		CVIPDate:                      "2026-11-30",
		UnitYear:                      2022,
		UnitMaker:                     "Thomas Built",
		UnitModel:                     "Saf-T-Liner C2",
		UnitColor:                     "Yellow",
		FuelLevelID:                   4,
		FuelLevelDescription:          "Full",
		FuelTypeID:                    1,
		FuelTypeDescription:           "Diesel",
		DocRegistrationSignIn:         true,
		DocInsuranceSignIn:            true,
		DocSafetyFitnessSignIn:        true,
		DocCollisionReportSignIn:      true,
		DocScheduleMaintenanceSignIn:  true,
		DocSDSSignIn:                  true,
		CheckFireExtinguisher:         true,
		CheckFirstAidKit:              true,
		CheckTriangles:                true,
		CheckQstraints:                true,
		CheckSeatBeltCutter:           true,
		CheckBroom:                    true,
		CheckSnowbrush:                true,
		CheckCleankit:                 true,
		AcknowledgeCheck:              true,
		ConditionKey:                  "",
		ConditionComments:             "Vehicle in pristine condition, ready for route.",
		ParkingAddress:                "45 Valleyview Cres NW, Calgary AB",
		FireHallLocation:              "Fire Station 17 - 3700 32 Ave NW",
		DriverSignature:               "John Smith",
		DriverSignDate:                yesterday.Format("2006-01-02"),
		FleetDepartmentSignature:      "Fleet Lead Marcus",
		FleetDepartmentSignDate:       yesterday.Format("2006-01-02"),
		Attachments:                   []models.VehicleSignoutAttachment{},
		CreatedBy:                     "Fleet Lead Marcus",
		CreatedAt:                     yesterday,
		UpdatedAt:                     yesterday,
	}

	demo2 := &models.VehicleSignout{
		ID:                            "vso-1002",
		IsSignIn:                      true, // Sign In (returned)
		SignDate:                      now.Format("2006-01-02"),
		VehicleType:                   1, // Van
		EmployeeID:                    "EMP-1003",
		EmployeeName:                  "Sarah Jenkins",
		RouteID:                       "VAN-04",
		RouteName:                     "Special Needs Special Run",
		CellPhone:                     "4035558831",
		DriverLicenseClass:            "Class 4",
		DriverLicenseCondition:        "Corrective Lenses",
		UnitID:                        202,
		UnitNumber:                    "202",
		Odometer:                      32890.0,
		LicensePlate:                  "VAN-202",
		CVIPDate:                      "2026-10-15",
		UnitYear:                      2023,
		UnitMaker:                     "Ford",
		UnitModel:                     "Transit 350",
		UnitColor:                     "White",
		FuelLevelID:                   3,
		FuelLevelDescription:          "3/4 Full",
		FuelTypeID:                    2,
		FuelTypeDescription:           "Gasoline",
		DocRegistrationSignIn:         true,
		DocInsuranceSignIn:            true,
		DocSafetyFitnessSignIn:        true,
		DocCollisionReportSignIn:      true,
		DocScheduleMaintenanceSignIn:  true,
		DocSDSSignIn:                  true,
		CheckFireExtinguisher:         true,
		CheckFirstAidKit:              true,
		CheckTriangles:                true,
		CheckQstraints:                true,
		CheckSeatBeltCutter:           true,
		CheckBroom:                    true,
		CheckSnowbrush:                true,
		CheckCleankit:                 true,
		AcknowledgeCheck:              true,
		ConditionKey:                  "S",
		ConditionComments:             "Minor cosmetic scrape on lower right passenger bumper during parking.",
		ParkingAddress:                "East Yard - Bay 14",
		FireHallLocation:              "Station 4 - 1990 McKnight Blvd",
		DriverSignature:               "Sarah Jenkins",
		DriverSignDate:                now.Format("2006-01-02"),
		FleetDepartmentSignature:      "Fleet Inspector David",
		FleetDepartmentSignDate:       now.Format("2006-01-02"),
		Attachments:                   []models.VehicleSignoutAttachment{},
		CreatedBy:                     "Fleet Inspector David",
		CreatedAt:                     now,
		UpdatedAt:                     now,
	}

	m.vehicleSignouts[demo1.ID] = demo1
	m.vehicleSignouts[demo2.ID] = demo2
}

func (m *MemoryDispatchRepository) CreateVehicleSignout(ctx context.Context, req *models.CreateVehicleSignoutPayload) (*models.VehicleSignout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	id := fmt.Sprintf("vso-%d", now.UnixNano())

	signDate := req.SignDate
	if signDate == "" {
		signDate = now.Format("2006-01-02")
	}

	attachments := req.Attachments
	if attachments == nil {
		attachments = []models.VehicleSignoutAttachment{}
	}

	rec := &models.VehicleSignout{
		ID:                            id,
		IsSignIn:                      req.IsSignIn,
		SignDate:                      signDate,
		VehicleType:                   req.VehicleType,
		EmployeeID:                    req.EmployeeID,
		EmployeeName:                  req.EmployeeName,
		RouteID:                       req.RouteID,
		RouteName:                     req.RouteName,
		CellPhone:                     req.CellPhone,
		DriverLicenseClass:            req.DriverLicenseClass,
		DriverLicenseCondition:        req.DriverLicenseCondition,
		UnitID:                        req.UnitID,
		UnitNumber:                    req.UnitNumber,
		Odometer:                      req.Odometer,
		LicensePlate:                  req.LicensePlate,
		CVIPDate:                      req.CVIPDate,
		UnitYear:                      req.UnitYear,
		UnitMaker:                     req.UnitMaker,
		UnitModel:                     req.UnitModel,
		UnitColor:                     req.UnitColor,
		FuelLevelID:                   req.FuelLevelID,
		FuelLevelDescription:          req.FuelLevelDescription,
		FuelTypeID:                    req.FuelTypeID,
		FuelTypeDescription:           req.FuelTypeDescription,
		DocRegistrationSignIn:         req.DocRegistrationSignIn,
		DocInsuranceSignIn:            req.DocInsuranceSignIn,
		DocSafetyFitnessSignIn:        req.DocSafetyFitnessSignIn,
		DocCollisionReportSignIn:      req.DocCollisionReportSignIn,
		DocScheduleMaintenanceSignIn:  req.DocScheduleMaintenanceSignIn,
		DocSDSSignIn:                  req.DocSDSSignIn,
		CheckFireExtinguisher:         req.CheckFireExtinguisher,
		CheckFirstAidKit:              req.CheckFirstAidKit,
		CheckTriangles:                req.CheckTriangles,
		CheckQstraints:                req.CheckQstraints,
		CheckSeatBeltCutter:           req.CheckSeatBeltCutter,
		CheckBroom:                    req.CheckBroom,
		CheckSnowbrush:                req.CheckSnowbrush,
		CheckCleankit:                 req.CheckCleankit,
		AcknowledgeCheck:              req.AcknowledgeCheck,
		ConditionKey:                  req.ConditionKey,
		ConditionComments:             req.ConditionComments,
		ParkingAddress:                req.ParkingAddress,
		FireHallLocation:              req.FireHallLocation,
		DriverSignature:               req.DriverSignature,
		DriverSignDate:                req.DriverSignDate,
		FleetDepartmentSignature:      req.FleetDepartmentSignature,
		FleetDepartmentSignDate:       req.FleetDepartmentSignDate,
		Attachments:                   attachments,
		CreatedBy:                     req.CreatedBy,
		CreatedAt:                     now,
		UpdatedAt:                     now,
	}

	m.vehicleSignouts[id] = rec
	return rec, nil
}

func (m *MemoryDispatchRepository) GetVehicleSignoutByID(ctx context.Context, id string) (*models.VehicleSignout, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rec, ok := m.vehicleSignouts[id]
	if !ok {
		return nil, fmt.Errorf("vehicle signout not found: %s", id)
	}
	return rec, nil
}

func (m *MemoryDispatchRepository) ListVehicleSignouts(ctx context.Context, unitNumber, employeeID string, isSignIn *bool, startDate, endDate string) ([]*models.VehicleSignout, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var list []*models.VehicleSignout
	for _, rec := range m.vehicleSignouts {
		if unitNumber != "" && !strings.EqualFold(rec.UnitNumber, unitNumber) {
			continue
		}
		if employeeID != "" && rec.EmployeeID != employeeID {
			continue
		}
		if isSignIn != nil && rec.IsSignIn != *isSignIn {
			continue
		}
		if startDate != "" && rec.SignDate < startDate {
			continue
		}
		if endDate != "" && rec.SignDate > endDate {
			continue
		}
		list = append(list, rec)
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})
	return list, nil
}

func (m *MemoryDispatchRepository) UpdateVehicleSignout(ctx context.Context, id string, req *models.UpdateVehicleSignoutPayload) (*models.VehicleSignout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rec, ok := m.vehicleSignouts[id]
	if !ok {
		return nil, fmt.Errorf("vehicle signout not found: %s", id)
	}

	now := time.Now().UTC()
	if req.IsSignIn != nil {
		rec.IsSignIn = *req.IsSignIn
	}
	if req.SignDate != "" {
		rec.SignDate = req.SignDate
	}
	if req.VehicleType != nil {
		rec.VehicleType = *req.VehicleType
	}
	if req.EmployeeID != "" {
		rec.EmployeeID = req.EmployeeID
	}
	if req.EmployeeName != "" {
		rec.EmployeeName = req.EmployeeName
	}
	if req.RouteID != "" {
		rec.RouteID = req.RouteID
	}
	if req.RouteName != "" {
		rec.RouteName = req.RouteName
	}
	if req.CellPhone != "" {
		rec.CellPhone = req.CellPhone
	}
	if req.DriverLicenseClass != "" {
		rec.DriverLicenseClass = req.DriverLicenseClass
	}
	if req.DriverLicenseCondition != "" {
		rec.DriverLicenseCondition = req.DriverLicenseCondition
	}
	if req.UnitID != nil {
		rec.UnitID = *req.UnitID
	}
	if req.UnitNumber != "" {
		rec.UnitNumber = req.UnitNumber
	}
	if req.Odometer != nil {
		rec.Odometer = *req.Odometer
	}
	if req.LicensePlate != "" {
		rec.LicensePlate = req.LicensePlate
	}
	if req.CVIPDate != "" {
		rec.CVIPDate = req.CVIPDate
	}
	if req.UnitYear != nil {
		rec.UnitYear = *req.UnitYear
	}
	if req.UnitMaker != "" {
		rec.UnitMaker = req.UnitMaker
	}
	if req.UnitModel != "" {
		rec.UnitModel = req.UnitModel
	}
	if req.UnitColor != "" {
		rec.UnitColor = req.UnitColor
	}
	if req.FuelLevelID != nil {
		rec.FuelLevelID = *req.FuelLevelID
	}
	if req.FuelLevelDescription != "" {
		rec.FuelLevelDescription = req.FuelLevelDescription
	}
	if req.FuelTypeID != nil {
		rec.FuelTypeID = *req.FuelTypeID
	}
	if req.FuelTypeDescription != "" {
		rec.FuelTypeDescription = req.FuelTypeDescription
	}
	if req.DocRegistrationSignIn != nil {
		rec.DocRegistrationSignIn = *req.DocRegistrationSignIn
	}
	if req.DocInsuranceSignIn != nil {
		rec.DocInsuranceSignIn = *req.DocInsuranceSignIn
	}
	if req.DocSafetyFitnessSignIn != nil {
		rec.DocSafetyFitnessSignIn = *req.DocSafetyFitnessSignIn
	}
	if req.DocCollisionReportSignIn != nil {
		rec.DocCollisionReportSignIn = *req.DocCollisionReportSignIn
	}
	if req.DocScheduleMaintenanceSignIn != nil {
		rec.DocScheduleMaintenanceSignIn = *req.DocScheduleMaintenanceSignIn
	}
	if req.DocSDSSignIn != nil {
		rec.DocSDSSignIn = *req.DocSDSSignIn
	}
	if req.CheckFireExtinguisher != nil {
		rec.CheckFireExtinguisher = *req.CheckFireExtinguisher
	}
	if req.CheckFirstAidKit != nil {
		rec.CheckFirstAidKit = *req.CheckFirstAidKit
	}
	if req.CheckTriangles != nil {
		rec.CheckTriangles = *req.CheckTriangles
	}
	if req.CheckQstraints != nil {
		rec.CheckQstraints = *req.CheckQstraints
	}
	if req.CheckSeatBeltCutter != nil {
		rec.CheckSeatBeltCutter = *req.CheckSeatBeltCutter
	}
	if req.CheckBroom != nil {
		rec.CheckBroom = *req.CheckBroom
	}
	if req.CheckSnowbrush != nil {
		rec.CheckSnowbrush = *req.CheckSnowbrush
	}
	if req.CheckCleankit != nil {
		rec.CheckCleankit = *req.CheckCleankit
	}
	if req.AcknowledgeCheck != nil {
		rec.AcknowledgeCheck = *req.AcknowledgeCheck
	}
	if req.ConditionKey != "" {
		rec.ConditionKey = req.ConditionKey
	}
	if req.ConditionComments != "" {
		rec.ConditionComments = req.ConditionComments
	}
	if req.ParkingAddress != "" {
		rec.ParkingAddress = req.ParkingAddress
	}
	if req.FireHallLocation != "" {
		rec.FireHallLocation = req.FireHallLocation
	}
	if req.DriverSignature != "" {
		rec.DriverSignature = req.DriverSignature
	}
	if req.DriverSignDate != "" {
		rec.DriverSignDate = req.DriverSignDate
	}
	if req.FleetDepartmentSignature != "" {
		rec.FleetDepartmentSignature = req.FleetDepartmentSignature
	}
	if req.FleetDepartmentSignDate != "" {
		rec.FleetDepartmentSignDate = req.FleetDepartmentSignDate
	}
	if req.Attachments != nil {
		rec.Attachments = req.Attachments
	}
	rec.UpdatedAt = now

	return rec, nil
}

func (m *MemoryDispatchRepository) DeleteVehicleSignout(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.vehicleSignouts[id]; !ok {
		return fmt.Errorf("vehicle signout not found: %s", id)
	}
	delete(m.vehicleSignouts, id)
	return nil
}

// ─── Operations Simulation Settings & Execution ────────────────────────────

func normalizeSimulationSettings(s *models.SimulationSettings) *models.SimulationSettings {
	if s == nil {
		s = models.DefaultSimulationSettings()
	}
	if strings.TrimSpace(s.AutoGenerateTime) == "" {
		s.AutoGenerateTime = "14:00"
	}
	if s.CheckInWindowMinutes <= 0 {
		s.CheckInWindowMinutes = 30
	}
	if s.StudentPickupWindowMinutes <= 0 {
		s.StudentPickupWindowMinutes = 15
	}
	if s.StudentAbsentRate <= 0 || s.StudentAbsentRate > 100 {
		s.StudentAbsentRate = 10
	}
	if s.PretripWindowMinutes <= 0 {
		s.PretripWindowMinutes = 30
	}
	return s
}

func simAddMinutesToHHMM(baseHHMM string, addMins int) string {
	cleaned := strings.TrimSpace(baseHHMM)
	parts := strings.Split(cleaned, ":")
	if len(parts) < 2 {
		h := 7
		m := addMins
		total := h*60 + m
		return fmt.Sprintf("%02d:%02d", (total/60)%24, total%60)
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return cleaned
	}
	total := h*60 + m + addMins
	if total < 0 {
		total = 0
	}
	return fmt.Sprintf("%02d:%02d", (total/60)%24, total%60)
}

func buildSimulatedPretripItems() map[string]models.PreTripInspectionItem {
	defs := []models.PreTripInspectionItem{
		{Code: "AIR_BRAKE_01", Title: "Air compressor build-up time", Category: "Air Brake System", Status: "pass"},
		{Code: "AIR_BRAKE_02", Title: "Governor cut-in and cut-out pressure", Category: "Air Brake System", Status: "pass"},
		{Code: "AIR_BRAKE_03", Title: "Air loss rate (applied & released)", Category: "Air Brake System", Status: "pass"},
		{Code: "AIR_BRAKE_04", Title: "Low air pressure warning device", Category: "Air Brake System", Status: "pass"},
		{Code: "AIR_BRAKE_05", Title: "Tractor protection / spring brakes", Category: "Air Brake System", Status: "pass"},
		{Code: "HYD_BRAKE_01", Title: "Brake pedal reserve & fade check", Category: "Hydraulic Brakes", Status: "pass"},
		{Code: "HYD_BRAKE_02", Title: "Vacuum / hydraulic assist & warning system", Category: "Hydraulic Brakes", Status: "pass"},
		{Code: "HYD_BRAKE_03", Title: "Master cylinder fluid level & leaks", Category: "Hydraulic Brakes", Status: "pass"},
		{Code: "PARK_BRAKE_01", Title: "Parking brake hold test", Category: "Parking Brake", Status: "pass"},
		{Code: "PARK_BRAKE_02", Title: "Parking brake release mechanism", Category: "Parking Brake", Status: "pass"},
		{Code: "STEERING_01", Title: "Steering wheel free play / lash", Category: "Steering", Status: "pass"},
		{Code: "STEERING_02", Title: "Power steering fluid & belts", Category: "Steering", Status: "pass"},
		{Code: "STEERING_03", Title: "Steering column & linkage security", Category: "Steering", Status: "pass"},
		{Code: "STEERING_04", Title: "Front axle & kingpins visual check", Category: "Steering", Status: "pass"},
		{Code: "TIRES_01", Title: "Front tire tread depth & inflation", Category: "Tires, Wheels & Suspension", Status: "pass"},
		{Code: "TIRES_02", Title: "Rear tire tread depth & inflation", Category: "Tires, Wheels & Suspension", Status: "pass"},
		{Code: "TIRES_03", Title: "Wheel lugs, studs & rims condition", Category: "Tires, Wheels & Suspension", Status: "pass"},
		{Code: "TIRES_04", Title: "Hub oil seals & wheel bearings", Category: "Tires, Wheels & Suspension", Status: "pass"},
		{Code: "TIRES_05", Title: "Leaf springs, U-bolts & air bags", Category: "Tires, Wheels & Suspension", Status: "pass"},
		{Code: "EXHAUST_01", Title: "Exhaust system leaks & mounting", Category: "Exhaust & Fuel", Status: "pass"},
		{Code: "EXHAUST_02", Title: "Tailpipe clear of passenger compartment", Category: "Exhaust & Fuel", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "FUEL_01", Title: "Fuel tank cap, cage & mounting straps", Category: "Exhaust & Fuel", Status: "pass"},
		{Code: "FUEL_02", Title: "No fuel leaks under vehicle", Category: "Exhaust & Fuel", Status: "pass"},
		{Code: "LAMPS_01", Title: "Headlights (high & low beam)", Category: "Lighting & Signals", Status: "pass"},
		{Code: "LAMPS_02", Title: "Turn signals & 4-way hazard flashers", Category: "Lighting & Signals", Status: "pass"},
		{Code: "LAMPS_03", Title: "Tail lights, brake lights & backup lights", Category: "Lighting & Signals", Status: "pass"},
		{Code: "LAMPS_04", Title: "Clearance, marker & ID lights", Category: "Lighting & Signals", Status: "pass"},
		{Code: "LAMPS_05", Title: "Alternating overhead amber warning lights", Category: "Lighting & Signals", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "LAMPS_06", Title: "Alternating overhead red warning lights", Category: "Lighting & Signals", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "STOP_ARM_01", Title: "Stop arm extension & flashing lights", Category: "School Bus Safety Devices", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "STOP_ARM_02", Title: "Pedestrian crossing arm operation", Category: "School Bus Safety Devices", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "STOP_ARM_03", Title: "Service door & entrance handrail", Category: "School Bus Safety Devices", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "VIS_01", Title: "Windshield condition & wipers/washers", Category: "Visibility & Mirrors", Status: "pass"},
		{Code: "VIS_02", Title: "Defroster & heater fan operation", Category: "Visibility & Mirrors", Status: "pass"},
		{Code: "VIS_03", Title: "West Coast flat & convex mirrors", Category: "Visibility & Mirrors", Status: "pass"},
		{Code: "VIS_04", Title: "Cross-view (crossover) pedestrian mirrors", Category: "Visibility & Mirrors", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "VIS_05", Title: "Interior student observation mirror", Category: "Visibility & Mirrors", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "EMER_01", Title: "Rear/roof/window emergency exits & buzzers", Category: "Emergency Equipment", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "EMER_02", Title: "Fire extinguisher charged & secured", Category: "Emergency Equipment", Status: "pass"},
		{Code: "EMER_03", Title: "First aid kit, flares/triangles & belt cutter", Category: "Emergency Equipment", Status: "pass"},
		{Code: "SAFETY_01", Title: "Driver seat & seat belt latch", Category: "Interior & Compartment", Status: "pass"},
		{Code: "SAFETY_02", Title: "Passenger seats & cushions secure", Category: "Interior & Compartment", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "SAFETY_03", Title: "Aisle & floor clear of hazards", Category: "Interior & Compartment", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "SAFETY_04", Title: "Wheelchair lift & Q-Straint tie-downs", Category: "Interior & Compartment", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "COMP_01", Title: "Horn & backup alarm operation", Category: "Instruments & Exterior", Status: "pass"},
		{Code: "COMP_02", Title: "Dash gauges & warning indicators", Category: "Instruments & Exterior", Status: "pass"},
		{Code: "COMP_03", Title: "Two-way radio / communication device", Category: "Instruments & Exterior", Status: "pass"},
		{Code: "COMP_04", Title: "Child Check-Mate / sleeping child alarm", Category: "Instruments & Exterior", IsSchoolBusSpecific: true, Status: "pass"},
		{Code: "COMP_05", Title: "Body panels, bumpers & reflectors", Category: "Instruments & Exterior", Status: "pass"},
		{Code: "COMP_06", Title: "Registration, insurance & CVOR documents", Category: "Instruments & Exterior", Status: "pass"},
		{Code: "COMP_07", Title: "Hood latch & engine fluid levels", Category: "Instruments & Exterior", Status: "pass"},
	}
	items := make(map[string]models.PreTripInspectionItem, len(defs))
	for _, d := range defs {
		items[d.Code] = d
	}
	return items
}

func (r *FirestoreDispatchRepository) GetSimulationSettings(ctx context.Context) (*models.SimulationSettings, error) {
	docRef := r.client.Collection("system_settings").Doc("simulation")
	snap, err := docRef.Get(ctx)
	if err != nil {
		return models.DefaultSimulationSettings(), nil
	}
	var settings models.SimulationSettings
	if err := snap.DataTo(&settings); err != nil {
		return models.DefaultSimulationSettings(), nil
	}
	return normalizeSimulationSettings(&settings), nil
}

func (r *FirestoreDispatchRepository) SaveSimulationSettings(ctx context.Context, settings *models.SimulationSettings) (*models.SimulationSettings, error) {
	settings = normalizeSimulationSettings(settings)
	settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	docRef := r.client.Collection("system_settings").Doc("simulation")
	if _, err := docRef.Set(ctx, settings); err != nil {
		return nil, fmt.Errorf("failed to save simulation settings: %w", err)
	}
	return settings, nil
}

func (m *MemoryDispatchRepository) GetSimulationSettings(ctx context.Context) (*models.SimulationSettings, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.simulationSettings == nil {
		return models.DefaultSimulationSettings(), nil
	}
	cp := *m.simulationSettings
	return normalizeSimulationSettings(&cp), nil
}

func (m *MemoryDispatchRepository) SaveSimulationSettings(ctx context.Context, settings *models.SimulationSettings) (*models.SimulationSettings, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	settings = normalizeSimulationSettings(settings)
	settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	cp := *settings
	m.simulationSettings = &cp
	return settings, nil
}

func (r *FirestoreDispatchRepository) RunSimulationForDate(ctx context.Context, date string, forceOverwrite bool) (*models.SimulationRunResult, error) {
	return executeSimulationForDate(ctx, r, date, forceOverwrite, func(ctx context.Context, shift *models.DispatchShift) error {
		shift.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		_, err := r.client.Collection(r.dispatchColl).Doc(shift.ID).Set(ctx, shift)
		return err
	}, func(ctx context.Context, vehicleUnit string) int {
		if vehicleUnit == "" {
			return 45200
		}
		iter := r.client.Collection(r.vehicleColl).Where("unitNumber", "==", vehicleUnit).Limit(1).Documents(ctx)
		defer iter.Stop()
		if doc, err := iter.Next(); err == nil {
			var veh models.Vehicle
			if err := doc.DataTo(&veh); err == nil && veh.Odometer > 0 {
				return veh.Odometer
			}
		}
		if directDoc, errDirect := r.client.Collection(r.vehicleColl).Doc(vehicleUnit).Get(ctx); errDirect == nil {
			var veh models.Vehicle
			if err := directDoc.DataTo(&veh); err == nil && veh.Odometer > 0 {
				return veh.Odometer
			}
		}
		return 45200
	})
}

func (m *MemoryDispatchRepository) RunSimulationForDate(ctx context.Context, date string, forceOverwrite bool) (*models.SimulationRunResult, error) {
	return executeSimulationForDate(ctx, m, date, forceOverwrite, func(ctx context.Context, shift *models.DispatchShift) error {
		m.mu.Lock()
		defer m.mu.Unlock()
		shift.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		m.shifts[shift.ID] = shift
		return nil
	}, func(ctx context.Context, vehicleUnit string) int {
		m.mu.RLock()
		defer m.mu.RUnlock()
		if odo, ok := m.vehicleOdometers[vehicleUnit]; ok && odo > 0 {
			return odo
		}
		return 45200
	})
}

func executeSimulationForDate(
	ctx context.Context,
	repo DispatchRepository,
	date string,
	forceOverwrite bool,
	persistShift func(ctx context.Context, shift *models.DispatchShift) error,
	getBaseOdometer func(ctx context.Context, vehicleUnit string) int,
) (*models.SimulationRunResult, error) {
	loc, errLoc := time.LoadLocation("America/Toronto")
	if errLoc != nil {
		loc = time.FixedZone("EDT", -4*3600)
	}
	nowOttawa := time.Now().In(loc)
	if strings.TrimSpace(date) == "" {
		date = nowOttawa.Format("2006-01-02")
	}

	simSettings, _ := repo.GetSimulationSettings(ctx)
	simSettings = normalizeSimulationSettings(simSettings)

	// 1. Ensure dispatches exist for the target date
	dispatchesCreated := 0
	if createRes, errCreate := repo.CreateDay(ctx, date, nil); errCreate == nil && createRes != nil {
		dispatchesCreated = createRes.Created
	}

	shifts, err := repo.ListShifts(ctx, date, DispatchFilter{})
	if err != nil {
		return nil, fmt.Errorf("failed to list shifts for simulation on %s: %w", date, err)
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	// 2. Collect all student ride keys across shifts on this date to enforce exact 10% absent ratio
	type studentRideKey struct {
		shiftID string
		stuKey  string
	}
	var allRideKeys []studentRideKey
	seenRideKeys := make(map[string]bool)

	for _, shift := range shifts {
		for stopIdx, st := range shift.Stops {
			for stuIdx, stu := range st.AssignedStudents {
				var sKey string
				if stu.StudentID > 0 {
					sKey = fmt.Sprintf("ID:%d", stu.StudentID)
				} else if stu.StudentNo != "" {
					sKey = fmt.Sprintf("NO:%s", stu.StudentNo)
				} else {
					sKey = fmt.Sprintf("STOP:%d:%d:%s", stopIdx, stuIdx, stu.StudentName)
				}
				composite := shift.ID + "|" + sKey
				if !seenRideKeys[composite] {
					seenRideKeys[composite] = true
					allRideKeys = append(allRideKeys, studentRideKey{
						shiftID: shift.ID,
						stuKey:  sKey,
					})
				}
			}
		}
	}

	totalStudentRiders := len(allRideKeys)
	targetAbsentCount := int(math.Round(float64(totalStudentRiders) * float64(simSettings.StudentAbsentRate) / 100.0))
	if totalStudentRiders >= 5 && targetAbsentCount == 0 && simSettings.StudentAbsentRate > 0 {
		targetAbsentCount = 1
	}

	// Shuffle ride keys and pick the first targetAbsentCount as absent
	perm := rng.Perm(totalStudentRiders)
	absentCompositeMap := make(map[string]bool, targetAbsentCount)
	for i := 0; i < targetAbsentCount && i < len(perm); i++ {
		rk := allRideKeys[perm[i]]
		absentCompositeMap[rk.shiftID+"|"+rk.stuKey] = true
	}

	// Pre-load existing pre-trip inspections for the target date
	existingPretrips, _ := repo.ListPreTripInspections(ctx, date, "")
	inspectedUnits := make(map[string]bool)
	for _, ins := range existingPretrips {
		if ins.VehicleUnit != "" {
			inspectedUnits[strings.ToUpper(strings.TrimSpace(ins.VehicleUnit))] = true
		}
	}

	driversCheckedIn := 0
	attendantsCheckedIn := 0
	pretripsCreated := 0
	absentCountActual := 0
	presentCountActual := 0

	checkInWin := simSettings.CheckInWindowMinutes
	pickupWin := simSettings.StudentPickupWindowMinutes
	pretripWin := simSettings.PretripWindowMinutes

	for _, shift := range shifts {
		effectiveCheckIn := shift.GetEffectiveCheckInTime()
		if effectiveCheckIn == "" {
			if strings.EqualFold(shift.ShiftType, "PM") {
				effectiveCheckIn = "13:30"
			} else {
				effectiveCheckIn = "06:30"
			}
		}
		if shift.ScheduledCheckInTime == "" {
			shift.ScheduledCheckInTime = effectiveCheckIn
		}

		// A. Driver Auto Check-In within [effectiveCheckIn, effectiveCheckIn + 30m]
		if shift.DriverID != "" || shift.DriverName != "" {
			if forceOverwrite || !shift.IsDriverCheckedIn || shift.DriverCheckedInAt == nil || *shift.DriverCheckedInAt == "" {
				offset := rng.Intn(checkInWin + 1)
				ciTime := simAddMinutesToHHMM(effectiveCheckIn, offset)
				shift.IsDriverCheckedIn = true
				shift.DriverCheckedInAt = &ciTime
			}
			if shift.IsDriverCheckedIn {
				driversCheckedIn++
			}
		}

		// B. Attendant Auto Check-In within [effectiveCheckIn, effectiveCheckIn + 30m]
		if shift.AttendantID != "" || shift.AttendantName != "" {
			if forceOverwrite || !shift.IsAttendantCheckedIn || shift.AttendantCheckedInAt == nil || *shift.AttendantCheckedInAt == "" {
				offset := rng.Intn(checkInWin + 1)
				ciTime := simAddMinutesToHHMM(effectiveCheckIn, offset)
				shift.IsAttendantCheckedIn = true
				shift.AttendantCheckedInAt = &ciTime
			}
			if shift.IsAttendantCheckedIn {
				attendantsCheckedIn++
			}
		}

		// C. Stops & Student Pickup/Dropoff Times within [scheduledTime, scheduledTime + 15m] & 10% Absent Rate
		completedStops := 0
		maxLate := 0
		countedShiftStu := make(map[string]bool)

		for stopIdx := range shift.Stops {
			st := &shift.Stops[stopIdx]
			schedTime := st.StopScheduleTime
			if schedTime == "" || schedTime == "--:--" {
				if shift.FirstStopTime != "" && shift.FirstStopTime != "--:--" {
					schedTime = simAddMinutesToHHMM(shift.FirstStopTime, stopIdx*8)
				} else if strings.EqualFold(shift.ShiftType, "PM") {
					schedTime = simAddMinutesToHHMM("14:30", stopIdx*8)
				} else {
					schedTime = simAddMinutesToHHMM("07:30", stopIdx*8)
				}
				st.StopScheduleTime = schedTime
			}

			stopOffset := rng.Intn(pickupWin + 1)
			stopArr := simAddMinutesToHHMM(schedTime, stopOffset)
			st.StopArrivalTime = &stopArr
			st.ActualArrivalTime = &stopArr
			st.MinutesLate = stopOffset
			completedStops++
			if stopOffset > maxLate {
				maxLate = stopOffset
			}

			for stuIdx := range st.AssignedStudents {
				stu := &st.AssignedStudents[stuIdx]
				var sKey string
				if stu.StudentID > 0 {
					sKey = fmt.Sprintf("ID:%d", stu.StudentID)
				} else if stu.StudentNo != "" {
					sKey = fmt.Sprintf("NO:%s", stu.StudentNo)
				} else {
					sKey = fmt.Sprintf("STOP:%d:%d:%s", stopIdx, stuIdx, stu.StudentName)
				}
				composite := shift.ID + "|" + sKey
				isAbsent := absentCompositeMap[composite]

				if isAbsent {
					f := false
					stu.IsPresent = &f
					stu.Status = "absent"
					stu.DropoffStatus = ""
					stu.PickupTime = nil
					stu.DropoffTime = nil
					stu.AbsenceReason = "Simulated Absence (10% Auto-Simulation)"
					stu.AbsenceReportedAt = fmt.Sprintf("%s %s:00", date, effectiveCheckIn)
					stu.AbsenceReportedBy = "driver"
					if !countedShiftStu[composite] {
						countedShiftStu[composite] = true
						absentCountActual++
					}
				} else {
					t := true
					stuOffset := rng.Intn(pickupWin + 1)
					stuTime := simAddMinutesToHHMM(schedTime, stuOffset)
					stu.IsPresent = &t
					stu.Status = "picked_up"
					stu.PickupTime = &stuTime
					stu.DropoffStatus = "dropped_off"
					stu.DropoffTime = &stuTime
					stu.AbsenceReason = ""
					stu.AbsenceReportedAt = ""
					stu.AbsenceReportedBy = ""
					if !countedShiftStu[composite] {
						countedShiftStu[composite] = true
						presentCountActual++
					}
				}
			}
		}

		shift.CompletedStops = completedStops
		shift.TotalStops = len(shift.Stops)
		shift.LateMinutes = maxLate
		if len(shift.Stops) > 0 {
			shift.FirstStopActual = shift.Stops[0].StopArrivalTime
			shift.LastStopActual = shift.Stops[len(shift.Stops)-1].StopArrivalTime
		}

		if shift.DriverName == "" || shift.UnitNumber == "" {
			shift.Health = models.HealthRed
		} else if shift.LateMinutes >= 15 {
			shift.Health = models.HealthRed
		} else if shift.LateMinutes > 0 {
			shift.Health = models.HealthYellow
		} else {
			shift.Health = models.HealthGreen
		}

		_ = persistShift(ctx, shift)

		if shift.IsDriverCheckedIn && (shift.DriverID != "" || shift.DriverName != "") {
			ciTime := effectiveCheckIn
			if shift.DriverCheckedInAt != nil && *shift.DriverCheckedInAt != "" {
				ciTime = *shift.DriverCheckedInAt
			}
			_, _ = repo.GenerateDispatchPayroll(ctx, shift.ID, "driver", ciTime)
		}
		if shift.IsAttendantCheckedIn && (shift.AttendantID != "" || shift.AttendantName != "") {
			ciTime := effectiveCheckIn
			if shift.AttendantCheckedInAt != nil && *shift.AttendantCheckedInAt != "" {
				ciTime = *shift.AttendantCheckedInAt
			}
			_, _ = repo.GenerateDispatchPayroll(ctx, shift.ID, "attendant", ciTime)
		}

		// D. Vehicle Pre-Trip Inspection Checklist within [effectiveCheckIn, effectiveCheckIn + 30m]
		unitStr := strings.TrimSpace(shift.UnitNumber)
		if unitStr == "" && shift.VehicleID > 0 {
			unitStr = fmt.Sprintf("UNIT-%d", shift.VehicleID)
		}
		if unitStr != "" {
			unitKey := strings.ToUpper(unitStr)
			if !inspectedUnits[unitKey] {
				pretripOffset := rng.Intn(pretripWin + 1)
				inspTime := simAddMinutesToHHMM(effectiveCheckIn, pretripOffset)
				inspectorID := shift.DriverID
				if inspectorID == "" {
					inspectorID = "SIM-DRIVER"
				}
				inspectorName := shift.DriverName
				if inspectorName == "" {
					inspectorName = "Simulated Driver"
				}
				baseOdo := getBaseOdometer(ctx, unitStr)
				newOdo := baseOdo + 12 + rng.Intn(35)

				_, errPt := repo.CreatePreTripInspection(ctx, &models.CreatePreTripInspectionPayload{
					VehicleUnit:    unitStr,
					VehicleID:      shift.VehicleID,
					VehiclePlate:   shift.PlateNumber,
					InspectionDate: date,
					InspectionTime: inspTime,
					InspectorID:    inspectorID,
					InspectorName:  inspectorName,
					Odometer:       newOdo,
					Items:          buildSimulatedPretripItems(),
					DefectNotes:    "Auto-generated by Dispatch Operations Simulation (All Schedule 5 items passed)",
					SignatureName:  inspectorName,
				})
				if errPt == nil {
					inspectedUnits[unitKey] = true
					pretripsCreated++
				}
			}
		}
	}

	totalEvalStudents := absentCountActual + presentCountActual
	absentRatePct := 0.0
	if totalEvalStudents > 0 {
		absentRatePct = math.Round((float64(absentCountActual)/float64(totalEvalStudents))*1000.0) / 10.0
	}

	// Build candidate pools from shifts (with realistic Ottawa fallbacks)
	type simEmployeeCandidate struct {
		ID    string
		Name  string
		Role  string
		Email string
		Phone string
	}
	type simVehicleCandidate struct {
		ID    int
		Unit  string
		Plate string
	}
	type simRouteCandidate struct {
		RouteID   string
		RouteNo   string
		RouteName string
		ShiftType string
		DriverID  string
		Driver    string
		Unit      string
		VehicleID int
	}
	type simStudentCandidate struct {
		StudentID   int
		StudentNo   string
		StudentName string
		SchoolName  string
		RouteID     string
		RouteNo     string
		RouteName   string
		ShiftType   string
		DriverID    string
		DriverName  string
		StopAddress string
	}

	empPool := make([]simEmployeeCandidate, 0)
	seenEmp := make(map[string]bool)
	vehPool := make([]simVehicleCandidate, 0)
	seenVeh := make(map[string]bool)
	routePool := make([]simRouteCandidate, 0)
	seenRoute := make(map[string]bool)
	stuPool := make([]simStudentCandidate, 0)
	seenStu := make(map[string]bool)

	for _, sh := range shifts {
		if sh.DriverID != "" || sh.DriverName != "" {
			eID := sh.DriverID
			if eID == "" {
				eID = "DRV-" + strings.ReplaceAll(strings.ToUpper(sh.DriverName), " ", "-")
			}
			if !seenEmp[eID] {
				seenEmp[eID] = true
				empPool = append(empPool, simEmployeeCandidate{
					ID:    eID,
					Name:  sh.DriverName,
					Role:  "driver",
					Email: strings.ToLower(strings.ReplaceAll(sh.DriverName, " ", ".")) + "@ottawabus.ca",
					Phone: "613-555-0142",
				})
			}
		}
		if sh.AttendantID != "" || sh.AttendantName != "" {
			aID := sh.AttendantID
			if aID == "" {
				aID = "ATT-" + strings.ReplaceAll(strings.ToUpper(sh.AttendantName), " ", "-")
			}
			if !seenEmp[aID] {
				seenEmp[aID] = true
				empPool = append(empPool, simEmployeeCandidate{
					ID:    aID,
					Name:  sh.AttendantName,
					Role:  "attendant",
					Email: strings.ToLower(strings.ReplaceAll(sh.AttendantName, " ", ".")) + "@ottawabus.ca",
					Phone: "613-555-0188",
				})
			}
		}
		if sh.UnitNumber != "" {
			uKey := strings.ToUpper(strings.TrimSpace(sh.UnitNumber))
			if !seenVeh[uKey] {
				seenVeh[uKey] = true
				plate := sh.PlateNumber
				if plate == "" {
					plate = fmt.Sprintf("ON-%d", 1000+len(vehPool))
				}
				vehPool = append(vehPool, simVehicleCandidate{
					ID:    sh.VehicleID,
					Unit:  sh.UnitNumber,
					Plate: plate,
				})
			}
		}
		if sh.RouteNo != "" && !seenRoute[sh.RouteNo] {
			seenRoute[sh.RouteNo] = true
			routePool = append(routePool, simRouteCandidate{
				RouteID:   sh.RouteID,
				RouteNo:   sh.RouteNo,
				RouteName: sh.RouteName,
				ShiftType: sh.ShiftType,
				DriverID:  sh.DriverID,
				Driver:    sh.DriverName,
				Unit:      sh.UnitNumber,
				VehicleID: sh.VehicleID,
			})
		}
		for _, st := range sh.Stops {
			for _, stu := range st.AssignedStudents {
				sKey := fmt.Sprintf("%d-%s", stu.StudentID, stu.StudentName)
				if stu.StudentName != "" && !seenStu[sKey] {
					seenStu[sKey] = true
					schName := stu.SchoolName
					if schName == "" {
						schName = st.SchoolName
					}
					if schName == "" {
						schName = sh.RouteName
					}
					stopAddr := st.StopLocation
					if stopAddr == "" {
						stopAddr = "Ottawa Route Stop"
					}
					stuPool = append(stuPool, simStudentCandidate{
						StudentID:   stu.StudentID,
						StudentNo:   stu.StudentNo,
						StudentName: stu.StudentName,
						SchoolName:  schName,
						RouteID:     sh.RouteID,
						RouteNo:     sh.RouteNo,
						RouteName:   sh.RouteName,
						ShiftType:   sh.ShiftType,
						DriverID:    sh.DriverID,
						DriverName:  sh.DriverName,
						StopAddress: stopAddr,
					})
				}
			}
		}
	}

	if len(empPool) == 0 {
		empPool = []simEmployeeCandidate{
			{ID: "EMP-DRV-101", Name: "Marc Tremblay", Role: "driver", Email: "marc.tremblay@ottawabus.ca", Phone: "613-555-0111"},
			{ID: "EMP-DRV-102", Name: "Sarah Jenkins", Role: "driver", Email: "sarah.jenkins@ottawabus.ca", Phone: "613-555-0112"},
			{ID: "EMP-DRV-103", Name: "Jean-Luc Picard", Role: "driver", Email: "jeanluc.picard@ottawabus.ca", Phone: "613-555-0113"},
			{ID: "EMP-ATT-201", Name: "Claire Boucher", Role: "attendant", Email: "claire.boucher@ottawabus.ca", Phone: "613-555-0114"},
			{ID: "EMP-DRV-104", Name: "David Morrison", Role: "driver", Email: "david.morrison@ottawabus.ca", Phone: "613-555-0115"},
			{ID: "EMP-DRV-105", Name: "Nadia El-Amin", Role: "driver", Email: "nadia.elamin@ottawabus.ca", Phone: "613-555-0116"},
		}
	}
	if len(vehPool) == 0 {
		vehPool = []simVehicleCandidate{
			{ID: 101, Unit: "BUS-201", Plate: "ON-84920"},
			{ID: 102, Unit: "BUS-204", Plate: "ON-84924"},
			{ID: 103, Unit: "BUS-308", Plate: "ON-91205"},
			{ID: 104, Unit: "VAN-112", Plate: "ON-77341"},
		}
	}
	if len(routePool) == 0 {
		routePool = []simRouteCandidate{
			{RouteID: "RT-101", RouteNo: "OCDSB-101", RouteName: "Kanata North Express", ShiftType: "AM", DriverID: empPool[0].ID, Driver: empPool[0].Name, Unit: vehPool[0].Unit, VehicleID: vehPool[0].ID},
			{RouteID: "RT-202", RouteNo: "CEPEO-202", RouteName: "Orleans Corridor", ShiftType: "PM", DriverID: empPool[len(empPool)-1].ID, Driver: empPool[len(empPool)-1].Name, Unit: vehPool[len(vehPool)-1].Unit, VehicleID: vehPool[len(vehPool)-1].ID},
		}
	}
	if len(stuPool) == 0 {
		stuPool = []simStudentCandidate{
			{StudentID: 501, StudentNo: "STU-501", StudentName: "Lucas Gauthier", SchoolName: "Franco-Cite High School", RouteID: routePool[0].RouteID, RouteNo: routePool[0].RouteNo, RouteName: routePool[0].RouteName, ShiftType: "AM", DriverID: routePool[0].DriverID, DriverName: routePool[0].Driver, StopAddress: "420 Bank St, Ottawa, ON"},
			{StudentID: 502, StudentNo: "STU-502", StudentName: "Emma MacDonald", SchoolName: "Glebe Collegiate Institute", RouteID: routePool[0].RouteID, RouteNo: routePool[0].RouteNo, RouteName: routePool[0].RouteName, ShiftType: "PM", DriverID: routePool[0].DriverID, DriverName: routePool[0].Driver, StopAddress: "185 Bronson Ave, Ottawa, ON"},
			{StudentID: 503, StudentNo: "STU-503", StudentName: "Noah Leblanc", SchoolName: "Beatrice-Desloges School", RouteID: routePool[len(routePool)-1].RouteID, RouteNo: routePool[len(routePool)-1].RouteNo, RouteName: routePool[len(routePool)-1].RouteName, ShiftType: "AM", DriverID: routePool[len(routePool)-1].DriverID, DriverName: routePool[len(routePool)-1].Driver, StopAddress: "1990 Tenth Line Rd, Orleans, ON"},
			{StudentID: 504, StudentNo: "STU-504", StudentName: "Chloe Chen", SchoolName: "Earl of March Secondary", RouteID: routePool[0].RouteID, RouteNo: routePool[0].RouteNo, RouteName: routePool[0].RouteName, ShiftType: "PM", DriverID: routePool[0].DriverID, DriverName: routePool[0].Driver, StopAddress: "4 The Pkwy, Kanata, ON"},
		}
	}

	targetDateParsed, errDateParse := time.ParseInLocation("2006-01-02", date, loc)
	if errDateParse != nil {
		targetDateParsed = nowOttawa
	}
	twoDaysAgoStr := targetDateParsed.AddDate(0, 0, -2).Format("2006-01-02")

	// E. Daily 1 to 3 Time-Off Requests, with 75% automatically approved
	existingTimeOff, _ := repo.ListTimeOffRequests(ctx, "", "", date)
	targetTimeOffCount := 1 + rng.Intn(3) // 1..3
	timeOffCreated := len(existingTimeOff)
	timeOffApproved := 0
	for _, to := range existingTimeOff {
		if to.Status == models.TimeOffStatusApproved {
			timeOffApproved++
		}
	}
	if timeOffCreated == 0 {
		leaveTypes := []models.LeaveType{
			models.LeaveTypeSickLeave,
			models.LeaveTypePersonalDays,
			models.LeaveTypeVacation,
		}
		shiftScopes := []string{"ALL", "AM", "PM"}
		leaveReasons := []string{
			"Medical / dental appointment scheduled in Ottawa (Auto-Sim)",
			"Family obligation requiring personal leave (Auto-Sim)",
			"Seasonal flu recovery day (Auto-Sim)",
		}
		empPerm := rng.Perm(len(empPool))
		for i := 0; i < targetTimeOffCount; i++ {
			emp := empPool[empPerm[i%len(empPerm)]]
			createdTO, errTO := repo.CreateTimeOffRequest(ctx, &models.CreateTimeOffRequestPayload{
				EmployeeID:        emp.ID,
				EmployeeName:      emp.Name,
				LeaveType:         leaveTypes[rng.Intn(len(leaveTypes))],
				StartDate:         date,
				EndDate:           date,
				ShiftType:         shiftScopes[rng.Intn(len(shiftScopes))],
				Comments:          leaveReasons[i%len(leaveReasons)],
				RequestedByUserID: emp.ID,
				RequestedByName:   emp.Name,
			})
			if errTO == nil && createdTO != nil {
				timeOffCreated++
				// 75% auto-approval probability
				if rng.Intn(100) < 75 {
					if _, errApp := repo.ApproveTimeOffRequest(ctx, createdTO.ID, &models.ReviewTimeOffRequestPayload{
						ReviewerUserID: "EMP-ADMIN-001",
						ReviewerName:   "HR Auto-Simulation",
						ApprovalNotes:  "Automatically approved by simulation engine (75% approval policy)",
					}); errApp == nil {
						timeOffApproved++
					}
				}
			}
		}
	}

	// F. Daily 1 to 3 Vehicle Defect Reports, and resolve all reports >= 2 days old
	allDefects, _ := repo.ListDefectReports(ctx, "", "", "")
	hasTwoDaysAgoDefects := false
	defectsForDate := 0
	for _, d := range allDefects {
		if d.ReportDate == date {
			defectsForDate++
		}
		if d.ReportDate != "" && d.ReportDate <= twoDaysAgoStr {
			hasTwoDaysAgoDefects = true
		}
	}

	buildSimDefectItems := func(defectIdx int) ([]models.DefectItem, string) {
		defectScenarios := []struct {
			code  string
			name  string
			cat   string
			notes string
		}{
			{code: "LIGHTS_MARKER", name: "Clearance & Amber Marker Lights", cat: "Daily Check", notes: "Right rear amber clearance lamp intermittent flicker (Auto-Sim)"},
			{code: "HEATER_DEFROST", name: "Heater & Windshield Defroster Blower", cat: "Daily Check", notes: "Auxiliary cabin heater fan noisy on high speed setting (Auto-Sim)"},
			{code: "MIRROR_CROSS", name: "Left Crossover Pedestrian Mirror", cat: "Daily Check", notes: "Mirror bracket vibration above 60 km/h; requires torque adjustment (Auto-Sim)"},
			{code: "DOOR_SEAL", name: "Passenger Service Door Weather Seal", cat: "Periodic Check", notes: "Lower rubber weather strip slightly worn near entrance stepwell (Auto-Sim)"},
		}
		chosen := defectScenarios[defectIdx%len(defectScenarios)]
		items := []models.DefectItem{
			{ID: "BRAKES_SYS", Name: "Service & Parking Brake System", Category: "Daily Check", Status: "ok"},
			{ID: "STEERING_SYS", Name: "Steering Linkage & Power Assist", Category: "Daily Check", Status: "ok"},
			{ID: "TIRES_LUGS", Name: "Tires, Tread Depth & Wheel Lugs", Category: "Daily Check", Status: "ok"},
			{ID: chosen.code, Name: chosen.name, Category: chosen.cat, Status: "defect", Notes: chosen.notes},
			{ID: "STOP_ARM", Name: "Stop Arm & Overhead Flashing Lights", Category: "Daily Check", Status: "ok"},
			{ID: "EMERG_EXITS", Name: "Emergency Exits & Warning Buzzers", Category: "Daily Check", Status: "ok"},
		}
		return items, chosen.notes
	}

	// Seed 2-days-ago defect reports if none existed yet so 2-day completion is immediately demonstrable
	if !hasTwoDaysAgoDefects {
		seedDefectCount := 1 + rng.Intn(2)
		for i := 0; i < seedDefectCount; i++ {
			veh := vehPool[i%len(vehPool)]
			emp := empPool[i%len(empPool)]
			items, note := buildSimDefectItems(i)
			if seeded, errSeed := repo.CreateDefectReport(ctx, &models.CreateDefectReportPayload{
				VehicleID:         veh.ID,
				VehicleUnitNumber: veh.Unit,
				Odometer:          getBaseOdometer(ctx, veh.Unit) - 85 + i*15,
				ReportedByUserID:  emp.ID,
				ReportedByName:    emp.Name,
				ReportDate:        twoDaysAgoStr,
				ReportTime:        fmt.Sprintf("07:%02d", 15+i*12),
				Items:             items,
				DefectNotes:       note,
				NoDefectsFound:    false,
				ConfirmedAccurate: true,
			}); errSeed == nil && seeded != nil {
				allDefects = append(allDefects, seeded)
			}
		}
	}

	defectsResolved := 0
	for _, d := range allDefects {
		if d.ReportDate != "" && d.ReportDate <= twoDaysAgoStr && d.Status != "resolved" {
			if _, errRes := repo.UpdateDefectAssessment(ctx, d.ID, &models.UpdateDefectAssessmentPayload{
				Status:                  "resolved",
				AssessedBy:              "Fleet Maintenance Supervisor",
				AssessmentNotes:         "Inspected and repaired within 2-day fleet maintenance SLA (Auto-Sim)",
				RepairLocation:          "Ottawa Central Fleet Garage",
				EstimatedRepairDays:     2,
				EstimatedStartDate:      d.ReportDate,
				EstimatedCompletionDate: date,
				ActualCompletionDate:    date,
				RepairCost:              float64(145 + rng.Intn(320)),
				MechanicNotes:           "Replaced defective component, verified operation, and cleared vehicle for service.",
				ResolvedBy:              "Lead Fleet Technician",
			}); errRes == nil {
				defectsResolved++
			}
		}
	}

	targetDefectsToday := 1 + rng.Intn(3) // 1..3
	defectsCreated := defectsForDate
	if defectsCreated == 0 {
		for i := 0; i < targetDefectsToday; i++ {
			veh := vehPool[(i+rng.Intn(len(vehPool)))%len(vehPool)]
			emp := empPool[(i+rng.Intn(len(empPool)))%len(empPool)]
			items, note := buildSimDefectItems(i + rng.Intn(4))
			if _, errDef := repo.CreateDefectReport(ctx, &models.CreateDefectReportPayload{
				VehicleID:         veh.ID,
				VehicleUnitNumber: veh.Unit,
				Odometer:          getBaseOdometer(ctx, veh.Unit) + 20 + i*11,
				ReportedByUserID:  emp.ID,
				ReportedByName:    emp.Name,
				ReportDate:        date,
				ReportTime:        fmt.Sprintf("%02d:%02d", 7+rng.Intn(8), 10+rng.Intn(45)),
				Items:             items,
				DefectNotes:       note,
				NoDefectsFound:    false,
				ConfirmedAccurate: true,
			}); errDef == nil {
				defectsCreated++
			}
		}
	}

	// G. Daily 2 to 4 Student Incident Reports, and mark all incidents >= 2 days old as closed
	allIncidents, _ := repo.ListStudentIncidents(ctx, 0, "", "", "", false)
	hasTwoDaysAgoIncidents := false
	incidentsForDate := 0
	for _, inc := range allIncidents {
		if inc.IncidentDate == date {
			incidentsForDate++
		}
		if inc.IncidentDate != "" && inc.IncidentDate <= twoDaysAgoStr {
			hasTwoDaysAgoIncidents = true
		}
	}

	incidentTemplates := []struct {
		types       []string
		description string
		action      string
		grade       string
	}{
		{
			types:       []string{"Out of Seat / Standing in Motion"},
			description: "Student stood up in the center aisle while bus was approaching stop intersection (Auto-Sim).",
			action:      "Driver safely pulled over, reminded student of seating safety rules, and notified school.",
			grade:       "Grade 5",
		},
		{
			types:       []string{"Loud / Disruptive Conduct"},
			description: "Loud shouting and throwing paper in rear seats distracting driver at railway crossing (Auto-Sim).",
			action:      "Assigned front row seat for remainder of route and logged incident for principal review.",
			grade:       "Grade 7",
		},
		{
			types:       []string{"Peer Conflict / Verbal Altercation"},
			description: "Verbal disagreement between two students over seating arrangement during afternoon run (Auto-Sim).",
			action:      "Separated students into different rows and informed receiving school staff upon arrival.",
			grade:       "Grade 6",
		},
		{
			types:       []string{"Refusal to Follow Safety Instructions"},
			description: "Student refused to keep backpack clear of emergency exit aisle despite repeated reminders (Auto-Sim).",
			action:      "Cleared aisle before departure and contacted parent/guardian via dispatch.",
			grade:       "Grade 8",
		},
	}

	if !hasTwoDaysAgoIncidents {
		for i := 0; i < 2; i++ {
			stu := stuPool[i%len(stuPool)]
			tpl := incidentTemplates[i%len(incidentTemplates)]
			if seededInc, errSeedInc := repo.CreateStudentIncident(ctx, &models.CreateStudentIncidentPayload{
				IncidentDate:              twoDaysAgoStr,
				IncidentTime:              fmt.Sprintf("08:%02d", 10+i*14),
				StudentID:                 stu.StudentID,
				StudentNo:                 stu.StudentNo,
				StudentName:               stu.StudentName,
				Grade:                     tpl.grade,
				SchoolName:                stu.SchoolName,
				RouteNo:                   stu.RouteNo,
				RouteName:                 stu.RouteName,
				ShiftType:                 stu.ShiftType,
				DriverID:                  stu.DriverID,
				DriverName:                stu.DriverName,
				Location:                  stu.StopAddress,
				IncidentTypes:             tpl.types,
				Description:               tpl.description,
				ImmediateActionTaken:      tpl.action,
				StudentRemovedFromBus:     false,
				FirstAidRequired:          false,
				ParentsNotified:           true,
				ParentsNotificationDetail: "Parent contacted by phone by dispatch coordinator",
			}); errSeedInc == nil && seededInc != nil {
				allIncidents = append(allIncidents, seededInc)
			}
		}
	}

	incidentsResolved := 0
	for _, inc := range allIncidents {
		if inc.IncidentDate != "" && inc.IncidentDate <= twoDaysAgoStr && inc.Status != "closed" {
			if _, errClose := repo.UpdateStudentIncidentOfficeFollowUp(ctx, inc.ID, &models.UpdateIncidentOfficeFollowUpPayload{
				ReviewedDate:        date,
				AdministratorName:   "Student Safety & Operations Office",
				DisciplinaryActions: []string{"Parent Contacted", "School Principal Notified", "Seating Plan Updated"},
				OfficeNotes:         "Completed 2-day safety review with school administration and parents; case closed (Auto-Sim).",
				IsOfficeLocked:      true,
				Status:              "closed",
			}); errClose == nil {
				incidentsResolved++
			}
		}
	}

	targetIncidentsToday := 2 + rng.Intn(3) // 2..4
	incidentsCreated := incidentsForDate
	if incidentsCreated == 0 {
		for i := 0; i < targetIncidentsToday; i++ {
			stu := stuPool[(i+rng.Intn(len(stuPool)))%len(stuPool)]
			tpl := incidentTemplates[(i+rng.Intn(len(incidentTemplates)))%len(incidentTemplates)]
			if _, errInc := repo.CreateStudentIncident(ctx, &models.CreateStudentIncidentPayload{
				IncidentDate:              date,
				IncidentTime:              fmt.Sprintf("%02d:%02d", 7+rng.Intn(8), 10+rng.Intn(45)),
				StudentID:                 stu.StudentID,
				StudentNo:                 stu.StudentNo,
				StudentName:               stu.StudentName,
				Grade:                     tpl.grade,
				SchoolName:                stu.SchoolName,
				RouteNo:                   stu.RouteNo,
				RouteName:                 stu.RouteName,
				ShiftType:                 stu.ShiftType,
				DriverID:                  stu.DriverID,
				DriverName:                stu.DriverName,
				Location:                  stu.StopAddress,
				IncidentTypes:             tpl.types,
				Description:               tpl.description,
				ImmediateActionTaken:      tpl.action,
				StudentRemovedFromBus:     false,
				FirstAidRequired:          false,
				ParentsNotified:           true,
				ParentsNotificationDetail: "Dispatch notified parent/guardian on file",
			}); errInc == nil {
				incidentsCreated++
			}
		}
	}

	// H. Daily 1 to 2 Route Assessment Reports and 1 to 2 Hazard Reports
	allRouteAssessments, _ := repo.ListRouteAssessments(ctx, "", "", nil, "")
	routeAssessmentsForDate := 0
	for _, ra := range allRouteAssessments {
		if ra.AssessmentDate != nil && ra.AssessmentDate.In(loc).Format("2006-01-02") == date {
			routeAssessmentsForDate++
		}
	}
	targetRouteAssessments := 1 + rng.Intn(2) // 1..2
	routeAssessmentsCreated := routeAssessmentsForDate
	if routeAssessmentsCreated == 0 {
		boards := []string{"OCDSB", "OCSB", "CEPEO", "CECCE"}
		for i := 0; i < targetRouteAssessments; i++ {
			rt := routePool[(i+rng.Intn(len(routePool)))%len(routePool)]
			emp := empPool[(i+rng.Intn(len(empPool)))%len(empPool)]
			assessTime := targetDateParsed.Add(time.Duration(9+i*2)*time.Hour + 30*time.Minute)
			if _, errRA := repo.CreateRouteAssessment(ctx, &models.CreateRouteAssessmentPayload{
				AssessmentType:         "Driver",
				RouteID:                rt.RouteNo,
				SchoolBoard:            boards[i%len(boards)],
				School:                 rt.RouteName,
				SchoolYear:             "2026-2027",
				AssessmentDate:         &assessTime,
				ConductedByDriver:      emp.Name,
				ConductedByEmployeeID:  emp.ID,
				DriverEmail:            emp.Email,
				DriverPhone:            emp.Phone,
				Summary:                fmt.Sprintf("Routine safety and stop timing assessment for route %s on %s (Auto-Sim).", rt.RouteNo, date),
				VisibilityProblemCheck: false,
				IntersectionCheck:      true,
				Intersection:           "Morning traffic queue observed at arterial turn; allow +2 minutes buffer.",
				RoadwayCheck:           true,
				Roadway:                "Construction lane narrowing near school zone; signage clearly visible.",
				CompanyPolicyCheck:     true,
				CompanyPolicyFamiliar:  true,
				RouteAdjustCheck:       false,
				SafetyConcernCheck:     false,
				AssignedTo:             "Route Planning Office",
				IsCompleted:            true,
				IsSubmitted:            true,
			}); errRA == nil {
				routeAssessmentsCreated++
			}
		}
	}

	allHazards, _ := repo.ListHazardReports(ctx, "", nil, "")
	hazardsForDate := 0
	for _, hz := range allHazards {
		if strings.HasPrefix(hz.EventTime, date) {
			hazardsForDate++
		}
	}
	targetHazards := 1 + rng.Intn(2) // 1..2
	hazardReportsCreated := hazardsForDate
	if hazardReportsCreated == 0 {
		hazardLocations := []string{
			"Baseline Rd & Woodroffe Ave, Ottawa, ON",
			"Innes Rd & Tenth Line Rd, Orleans, ON",
			"March Rd & Campeau Dr, Kanata, ON",
			"Bank St & Heron Rd, Ottawa, ON",
		}
		hazardDescs := []string{
			"Overhanging tree branches partially obscuring overhead flashing amber sign visibility near stop (Auto-Sim).",
			"Temporary road construction cones narrowing school loading zone entrance (Auto-Sim).",
			"Untreated surface water accumulation near pedestrian crosswalk at morning pickup stop (Auto-Sim).",
		}
		for i := 0; i < targetHazards; i++ {
			rt := routePool[(i+rng.Intn(len(routePool)))%len(routePool)]
			emp := empPool[(i+rng.Intn(len(empPool)))%len(empPool)]
			if _, errHZ := repo.CreateHazardReport(ctx, &models.CreateHazardReportPayload{
				ReportedBy:           emp.Name,
				ReportedByEmployeeID: emp.ID,
				PersonInvolved:       "None (Preventive Hazard Report)",
				UnitID:               strconv.Itoa(rt.VehicleID),
				UnitNumber:           rt.Unit,
				RouteID:              rt.RouteNo,
				RouteName:            rt.RouteName,
				Phone:                emp.Phone,
				Supervisor:           "Ottawa Safety Supervisor",
				EventTime:            fmt.Sprintf("%s %02d:%02d", date, 7+rng.Intn(8), 10+rng.Intn(45)),
				EventLocation:        hazardLocations[(i+rng.Intn(len(hazardLocations)))%len(hazardLocations)],
				Witnesses:            "Dispatch Operations Log",
				EventDescription:     hazardDescs[(i+rng.Intn(len(hazardDescs)))%len(hazardDescs)],
				TrafficHazard:        true,
				UnsafeCondition:      true,
				Ofanarea:             true,
				Suggestion:           "Coordinate with municipal road services / school board facility team for clearance.",
			}); errHZ == nil {
				hazardReportsCreated++
			}
		}
	}

	// I. Daily 2 to 6 Expense Reimbursement Claims, and mark all claims >= 2 days old as approved
	allExpenses, _ := repo.ListExpenseClaims(ctx, "", "")
	hasTwoDaysAgoExpenses := false
	expensesForDate := 0
	for _, ex := range allExpenses {
		if ex.ClaimDate == date {
			expensesForDate++
		}
		if ex.ClaimDate != "" && ex.ClaimDate <= twoDaysAgoStr {
			hasTwoDaysAgoExpenses = true
		}
	}

	expenseLineTemplates := []models.ExpenseReimbursementLinePayload{
		{CategoryCode: "FUEL", CategoryDisplayName: "Emergency Route Fuel Top-Up", Amount: 68.50, Note: "Diesel refill during extended charter detour (Auto-Sim)", SortOrder: 1},
		{CategoryCode: "WASH", CategoryDisplayName: "Exterior & Interior Bus Sanitization", Amount: 34.00, Note: "Scheduled fleet wash and interior cleaning (Auto-Sim)", SortOrder: 1},
		{CategoryCode: "SUPPLIES", CategoryDisplayName: "Windshield Washer Fluid & Safety Supplies", Amount: 22.75, Note: "Heavy-duty washer fluid replenish (Auto-Sim)", SortOrder: 1},
		{CategoryCode: "PARKING", CategoryDisplayName: "School Event Staging / Parking Fee", Amount: 18.00, Note: "Downtown museum field trip staging permit (Auto-Sim)", SortOrder: 1},
		{CategoryCode: "TOLL", CategoryDisplayName: "Highway / Bridge Operational Fee", Amount: 14.25, Note: "Inter-municipal route transfer fee (Auto-Sim)", SortOrder: 1},
	}

	if !hasTwoDaysAgoExpenses {
		seedExpCount := 2 + rng.Intn(2)
		for i := 0; i < seedExpCount; i++ {
			emp := empPool[i%len(empPool)]
			rt := routePool[i%len(routePool)]
			lineTpl := expenseLineTemplates[i%len(expenseLineTemplates)]
			if seededEx, errSeedEx := repo.CreateExpenseClaim(ctx, &models.CreateExpenseClaimPayload{
				EmployeeID:   emp.ID,
				EmployeeName: emp.Name,
				ClaimDate:    twoDaysAgoStr,
				RouteNo:      rt.RouteNo,
				Lines:        []models.ExpenseReimbursementLinePayload{lineTpl},
			}); errSeedEx == nil && seededEx != nil {
				allExpenses = append(allExpenses, seededEx)
			}
		}
	}

	expensesApproved := 0
	for _, ex := range allExpenses {
		if ex.ClaimDate != "" && ex.ClaimDate <= twoDaysAgoStr && ex.Status == "pending" {
			if _, errRev := repo.ReviewExpenseClaim(ctx, ex.ID, &models.ReviewExpenseClaimPayload{
				Status:         "approved",
				ApprovalNotes:  "Automatically verified and approved after 2-day processing period (Auto-Sim)",
				ApprovedByName: "Finance & Payroll Office",
			}); errRev == nil {
				expensesApproved++
			}
		}
	}

	targetExpensesToday := 2 + rng.Intn(5) // 2..6
	expensesCreated := expensesForDate
	if expensesCreated == 0 {
		for i := 0; i < targetExpensesToday; i++ {
			emp := empPool[(i+rng.Intn(len(empPool)))%len(empPool)]
			rt := routePool[(i+rng.Intn(len(routePool)))%len(routePool)]
			lineTpl := expenseLineTemplates[(i+rng.Intn(len(expenseLineTemplates)))%len(expenseLineTemplates)]
			if _, errEx := repo.CreateExpenseClaim(ctx, &models.CreateExpenseClaimPayload{
				EmployeeID:   emp.ID,
				EmployeeName: emp.Name,
				ClaimDate:    date,
				RouteNo:      rt.RouteNo,
				Lines:        []models.ExpenseReimbursementLinePayload{lineTpl},
			}); errEx == nil {
				expensesCreated++
			}
		}
	}

	// J. Daily 2 to 3 Vehicle Handover / Sign-Out Reports
	existingSignouts, _ := repo.ListVehicleSignouts(ctx, "", "", nil, date, date)
	targetSignouts := 2 + rng.Intn(2) // 2..3
	vehicleSignoutsCreated := len(existingSignouts)
	if vehicleSignoutsCreated == 0 {
		for i := 0; i < targetSignouts; i++ {
			veh := vehPool[(i+rng.Intn(len(vehPool)))%len(vehPool)]
			emp := empPool[(i+rng.Intn(len(empPool)))%len(empPool)]
			rt := routePool[(i+rng.Intn(len(routePool)))%len(routePool)]
			odo := float64(getBaseOdometer(ctx, veh.Unit) + 15 + i*18)
			if _, errSO := repo.CreateVehicleSignout(ctx, &models.CreateVehicleSignoutPayload{
				IsSignIn:                     i%2 == 1,
				SignDate:                     date,
				VehicleType:                  1,
				EmployeeID:                   emp.ID,
				EmployeeName:                 emp.Name,
				RouteID:                      rt.RouteID,
				RouteName:                    rt.RouteNo,
				CellPhone:                    emp.Phone,
				DriverLicenseClass:           "B",
				DriverLicenseCondition:       "Z",
				UnitID:                       veh.ID,
				UnitNumber:                   veh.Unit,
				Odometer:                     odo,
				LicensePlate:                 veh.Plate,
				CVIPDate:                     "2027-03-31",
				UnitYear:                     2023,
				UnitMaker:                    "Thomas Built",
				UnitModel:                    "Saf-T-Liner C2",
				UnitColor:                    "School Bus Yellow",
				FuelLevelID:                  4,
				FuelLevelDescription:         "Full",
				FuelTypeID:                   1,
				FuelTypeDescription:          "Diesel",
				DocRegistrationSignIn:        true,
				DocInsuranceSignIn:           true,
				DocSafetyFitnessSignIn:       true,
				DocCollisionReportSignIn:     true,
				DocScheduleMaintenanceSignIn: true,
				DocSDSSignIn:                 true,
				CheckFireExtinguisher:        true,
				CheckFirstAidKit:             true,
				CheckTriangles:               true,
				CheckQstraints:               true,
				CheckSeatBeltCutter:          true,
				CheckBroom:                   true,
				CheckSnowbrush:               true,
				CheckCleankit:                true,
				AcknowledgeCheck:             true,
				ConditionKey:                 "good",
				ConditionComments:            "Vehicle handover completed in clean and roadworthy condition (Auto-Sim).",
				ParkingAddress:               "Ottawa Central Yard - 1400 St. Laurent Blvd",
				FireHallLocation:             "Station 36 - Ottawa Fire Services",
				DriverSignature:              emp.Name,
				DriverSignDate:               date,
				FleetDepartmentSignature:     "Ottawa Fleet Operations",
				FleetDepartmentSignDate:      date,
				CreatedBy:                    "system-simulation",
			}); errSO == nil {
				vehicleSignoutsCreated++
			}
		}
	}

	executedAt := nowOttawa.Format("2006-01-02 15:04:05 MST")
	simSettings.LastSimulatedDate = date
	simSettings.LastRunAt = executedAt
	_, _ = repo.SaveSimulationSettings(ctx, simSettings)

	return &models.SimulationRunResult{
		Date:                    date,
		DispatchesCreated:       dispatchesCreated,
		TotalShifts:             len(shifts),
		DriversCheckedIn:        driversCheckedIn,
		AttendantsCheckedIn:     attendantsCheckedIn,
		TotalStudents:           totalEvalStudents,
		AbsentStudents:          absentCountActual,
		PresentStudents:         presentCountActual,
		AbsentRatePercent:       absentRatePct,
		PretripsCreated:         pretripsCreated,
		TimeOffCreated:          timeOffCreated,
		TimeOffApproved:         timeOffApproved,
		DefectsCreated:          defectsCreated,
		DefectsResolved:         defectsResolved,
		IncidentsCreated:        incidentsCreated,
		IncidentsResolved:       incidentsResolved,
		RouteAssessmentsCreated: routeAssessmentsCreated,
		HazardReportsCreated:    hazardReportsCreated,
		ExpensesCreated:         expensesCreated,
		ExpensesApproved:        expensesApproved,
		VehicleSignoutsCreated:  vehicleSignoutsCreated,
		ExecutedAt:              executedAt,
		Message:                 fmt.Sprintf("Simulation completed for %s: %d shifts, %d drivers & %d attendants checked in, %d/%d students absent (%.1f%%), %d pre-trips, %d time-off (%d approved), %d defects (%d resolved), %d incidents (%d closed), %d assessments, %d hazards, %d expenses (%d approved), %d handovers.", date, len(shifts), driversCheckedIn, attendantsCheckedIn, absentCountActual, totalEvalStudents, absentRatePct, pretripsCreated, timeOffCreated, timeOffApproved, defectsCreated, defectsResolved, incidentsCreated, incidentsResolved, routeAssessmentsCreated, hazardReportsCreated, expensesCreated, expensesApproved, vehicleSignoutsCreated),
	}, nil
}

