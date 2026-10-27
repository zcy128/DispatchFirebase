package models

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// DispatchHealth indicates the operational health status of a dispatch shift
type DispatchHealth string

const (
	HealthGreen  DispatchHealth = "green"  // On track, all crew assigned, on time
	HealthYellow DispatchHealth = "yellow" // Minor delay (< 15 mins)
	HealthRed    DispatchHealth = "red"    // Critical delay (>= 15 mins) or unassigned crew
)

// DispatchShiftStopStudent represents a student rider tracked at a specific dispatch stop
type DispatchShiftStopStudent struct {
	StudentID        int     `json:"studentId" firestore:"studentId"`
	StudentNo        string  `json:"studentNo" firestore:"studentNo"`
	StudentName      string  `json:"studentName" firestore:"studentName"`
	SchoolName       string  `json:"schoolName,omitempty" firestore:"schoolName,omitempty"`
	Status              string  `json:"status,omitempty" firestore:"status,omitempty"`
	IsPresent           *bool   `json:"isPresent,omitempty" firestore:"isPresent,omitempty"`
	PickupTime          *string `json:"pickupTime,omitempty" firestore:"pickupTime,omitempty"` // "07:34"
	DropoffStatus       string  `json:"dropoffStatus,omitempty" firestore:"dropoffStatus,omitempty"`
	DropoffTime         *string `json:"dropoffTime,omitempty" firestore:"dropoffTime,omitempty"` // "15:20"
	AbsenceReason       string  `json:"absenceReason,omitempty" firestore:"absenceReason,omitempty"`
	AbsenceReportedAt   string  `json:"absenceReportedAt,omitempty" firestore:"absenceReportedAt,omitempty"`
	AbsenceReportedBy   string  `json:"absenceReportedBy,omitempty" firestore:"absenceReportedBy,omitempty"`
}

// DispatchShiftStop represents an ordered stop within a daily dispatch shift
type DispatchShiftStop struct {
	StopID           int                        `json:"stopId" firestore:"stopId"`
	Sequence         int                        `json:"sequence" firestore:"sequence"`
	StopLocation     string                     `json:"stopLocation" firestore:"stopLocation"`
	StopScheduleTime  string                     `json:"stopScheduleTime" firestore:"stopScheduleTime"` // e.g. "07:30"
	StopArrivalTime   *string                    `json:"stopArrivalTime,omitempty" firestore:"stopArrivalTime,omitempty"` // e.g. "07:37"
	ActualArrivalTime *string                    `json:"actualArrivalTime,omitempty" firestore:"actualArrivalTime,omitempty"` // e.g. "07:37"
	StopType          string                     `json:"stopType" firestore:"stopType"`
	Latitude         *float64                   `json:"latitude,omitempty" firestore:"latitude,omitempty"`
	Longitude        *float64                   `json:"longitude,omitempty" firestore:"longitude,omitempty"`
	SchoolID         *int                       `json:"schoolId,omitempty" firestore:"schoolId,omitempty"`
	SchoolName       string                     `json:"schoolName,omitempty" firestore:"schoolName,omitempty"`
	SchoolPhone      string                     `json:"schoolPhone,omitempty" firestore:"schoolPhone,omitempty"`
	MinutesLate      int                        `json:"minutesLate" firestore:"minutesLate"`
	Comments         string                     `json:"comments,omitempty" firestore:"comments,omitempty"`
	AssignedStudents []DispatchShiftStopStudent `json:"assignedStudents,omitempty" firestore:"assignedStudents,omitempty"`
}

// DispatchShift represents the daily operational dispatch run (Collection: dispatch_shifts)
type DispatchShift struct {
	ID                 string              `json:"id" firestore:"id"`                               // DS-{date}-{routeNo}-{shiftType}
	DispatchDate       string              `json:"dispatchDate" firestore:"dispatchDate"`           // YYYY-MM-DD
	RouteID            string              `json:"routeId" firestore:"routeId"`                     // RT-{BusRouteId}
	RouteNo            string              `json:"routeNo" firestore:"routeNo"`                     // e.g. "CEPEO-021"
	RouteName          string              `json:"routeName" firestore:"routeName"`
	ShiftType          string              `json:"shiftType" firestore:"shiftType"`                 // "AM", "PM", "Midday"
	BusRouteShiftID    string              `json:"busRouteShiftId" firestore:"busRouteShiftId"`     // Primary route shift ID
	MergedShiftIDs     []string            `json:"mergedShiftIds,omitempty" firestore:"mergedShiftIds,omitempty"` // Multi-shift marryup IDs
	DriverID           string              `json:"driverId,omitempty" firestore:"driverId,omitempty"`
	DriverName         string              `json:"driverName,omitempty" firestore:"driverName,omitempty"`
	DriverPhone        string              `json:"driverPhone,omitempty" firestore:"driverPhone,omitempty"`
	VehicleID          int                 `json:"vehicleId,omitempty" firestore:"vehicleId,omitempty"`
	UnitNumber         string              `json:"unitNumber,omitempty" firestore:"unitNumber,omitempty"`
	PlateNumber        string              `json:"plateNumber,omitempty" firestore:"plateNumber,omitempty"`
	AttendantID        string              `json:"attendantId,omitempty" firestore:"attendantId,omitempty"`
	AttendantName      string              `json:"attendantName,omitempty" firestore:"attendantName,omitempty"`
	AttendantPhone     string              `json:"attendantPhone,omitempty" firestore:"attendantPhone,omitempty"`
	IsTemporaryDriver  bool                `json:"isTemporaryDriver,omitempty" firestore:"isTemporaryDriver,omitempty"`
	IsTemporaryAttendant bool              `json:"isTemporaryAttendant,omitempty" firestore:"isTemporaryAttendant,omitempty"`
	IsTemporaryVehicle bool                `json:"isTemporaryVehicle,omitempty" firestore:"isTemporaryVehicle,omitempty"`
	TemporaryAssignmentID string           `json:"temporaryAssignmentId,omitempty" firestore:"temporaryAssignmentId,omitempty"`
	YardID             int                 `json:"yardId" firestore:"yardId"`
	YardName           string              `json:"yardName" firestore:"yardName"`
	SchoolBoardID      int                 `json:"schoolBoardId" firestore:"schoolBoardId"`
	SchoolBoardCode    string              `json:"schoolBoardCode" firestore:"schoolBoardCode"`
	FirstStopTime      string              `json:"firstStopTime" firestore:"firstStopTime"`
	FirstStopActual    *string             `json:"firstStopActual,omitempty" firestore:"firstStopActual,omitempty"`
	LastStopTime       string              `json:"lastStopTime" firestore:"lastStopTime"`
	LastStopActual     *string             `json:"lastStopActual,omitempty" firestore:"lastStopActual,omitempty"`
	TotalStops         int                 `json:"totalStops" firestore:"totalStops"`
	CompletedStops     int                 `json:"completedStops" firestore:"completedStops"`
	LateMinutes        int                 `json:"lateMinutes" firestore:"lateMinutes"`
	Health             DispatchHealth      `json:"health" firestore:"health"` // "green", "yellow", "red"
	IsDryRun           bool                `json:"isDryRun" firestore:"isDryRun"`
	DispatchComments   string              `json:"dispatchComments,omitempty" firestore:"dispatchComments,omitempty"`
	// Crew Payroll Overrides & Comments (matching Dispatch Payroll Comment)
	DriverPayOption    string              `json:"driverPayOption,omitempty" firestore:"driverPayOption,omitempty"`       // "PD", "DD", "NP", "F"
	DriverPayAmount    *float64            `json:"driverPayAmount,omitempty" firestore:"driverPayAmount,omitempty"`
	DriverEiHours      *float64            `json:"driverEiHours,omitempty" firestore:"driverEiHours,omitempty"`
	AttendantPayOption string              `json:"attendantPayOption,omitempty" firestore:"attendantPayOption,omitempty"` // "PD", "DD", "NP", "F"
	AttendantPayAmount *float64            `json:"attendantPayAmount,omitempty" firestore:"attendantPayAmount,omitempty"`
	AttendantEiHours   *float64            `json:"attendantEiHours,omitempty" firestore:"attendantEiHours,omitempty"`
	NurseID            string              `json:"nurseId,omitempty" firestore:"nurseId,omitempty"`
	NurseName          string              `json:"nurseName,omitempty" firestore:"nurseName,omitempty"`
	NursePhone         string              `json:"nursePhone,omitempty" firestore:"nursePhone,omitempty"`
	NursePayOption     string              `json:"nursePayOption,omitempty" firestore:"nursePayOption,omitempty"`         // "PD", "DD", "NP", "F"
	NursePayAmount     *float64            `json:"nursePayAmount,omitempty" firestore:"nursePayAmount,omitempty"`
	NurseEiHours       *float64            `json:"nurseEiHours,omitempty" firestore:"nurseEiHours,omitempty"`
	PayrollComments    string              `json:"payrollComments,omitempty" firestore:"payrollComments,omitempty"`
	// Driver Check-In/Out tracking
	ScheduledCheckInTime string              `json:"scheduledCheckInTime,omitempty" firestore:"scheduledCheckInTime,omitempty"` // e.g. "06:30" (60 mins prior to firstStopTime)
	DriverCheckedInAt    *string             `json:"driverCheckedInAt,omitempty" firestore:"driverCheckedInAt,omitempty"`       // e.g. "06:28"
	IsDriverCheckedIn    bool                `json:"isDriverCheckedIn" firestore:"isDriverCheckedIn"`
	DriverCheckedOutAt   *string             `json:"driverCheckedOutAt,omitempty" firestore:"driverCheckedOutAt,omitempty"`     // e.g. "08:45"
	IsDriverCheckedOut   bool                `json:"isDriverCheckedOut" firestore:"isDriverCheckedOut"`
	DriverCheckoutComments string            `json:"driverCheckoutComments,omitempty" firestore:"driverCheckoutComments,omitempty"`
	// Attendant Check-In/Out tracking
	AttendantCheckedInAt *string             `json:"attendantCheckedInAt,omitempty" firestore:"attendantCheckedInAt,omitempty"`
	IsAttendantCheckedIn bool                `json:"isAttendantCheckedIn" firestore:"isAttendantCheckedIn"`
	AttendantCheckedOutAt *string            `json:"attendantCheckedOutAt,omitempty" firestore:"attendantCheckedOutAt,omitempty"`
	IsAttendantCheckedOut bool               `json:"isAttendantCheckedOut" firestore:"isAttendantCheckedOut"`
	AttendantCheckoutComments string         `json:"attendantCheckoutComments,omitempty" firestore:"attendantCheckoutComments,omitempty"`
	DriverReminderSentAt    *time.Time       `json:"driverReminderSentAt,omitempty" firestore:"driverReminderSentAt,omitempty"`
	AttendantReminderSentAt *time.Time       `json:"attendantReminderSentAt,omitempty" firestore:"attendantReminderSentAt,omitempty"`
	PretripReminderSentAt   *time.Time       `json:"pretripReminderSentAt,omitempty" firestore:"pretripReminderSentAt,omitempty"`
	ParentNotifications  []SentParentNotificationRecord `json:"parentNotifications,omitempty" firestore:"parentNotifications,omitempty"`
	Stops              []DispatchShiftStop `json:"stops" firestore:"stops"`
	AssignedEmployeeIds []string           `json:"assignedEmployeeIds,omitempty" firestore:"assignedEmployeeIds,omitempty"`
	CreatedAt          interface{}         `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	UpdatedAt          interface{}         `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// ComputeAssignedEmployeeIds returns normalized driver and attendant identifiers for index-level filtering
func (s *DispatchShift) ComputeAssignedEmployeeIds() []string {
	seen := make(map[string]bool)
	var list []string
	add := func(v string) {
		t := strings.TrimSpace(v)
		if t == "" {
			return
		}
		low := strings.ToLower(t)
		if low == "0" || low == "tbd" || low == "unassigned" || low == "non assigné" {
			return
		}
		if !seen[t] {
			seen[t] = true
			list = append(list, t)
		}
		if !seen[low] {
			seen[low] = true
			list = append(list, low)
		}
	}
	add(s.DriverID)
	add(s.DriverName)
	add(s.AttendantID)
	add(s.AttendantName)
	return list
}

// SentParentNotificationRecord defines a dispatched alert sent to parents
type SentParentNotificationRecord struct {
	ID                string   `json:"id" firestore:"id"`
	Timestamp         string   `json:"timestamp" firestore:"timestamp"`
	TimeStr           string   `json:"timeStr" firestore:"timeStr"`
	ReasonCategory    string   `json:"reasonCategory" firestore:"reasonCategory"`
	ReasonLabel       string   `json:"reasonLabel" firestore:"reasonLabel"`
	DelayMinutes      int      `json:"delayMinutes" firestore:"delayMinutes"`
	MessageText       string   `json:"messageText" firestore:"messageText"`
	Channels          []string `json:"channels" firestore:"channels"`
	RecipientsCount   int      `json:"recipientsCount" firestore:"recipientsCount"`
	RecipientsSummary string   `json:"recipientsSummary,omitempty" firestore:"recipientsSummary,omitempty"`
	Scope             string   `json:"scope" firestore:"scope"`
	StopID            *int     `json:"stopId,omitempty" firestore:"stopId,omitempty"`
	StopSequence      *int     `json:"stopSequence,omitempty" firestore:"stopSequence,omitempty"`
	StopLocation      string   `json:"stopLocation,omitempty" firestore:"stopLocation,omitempty"`
}

// CreateDispatchDayRequest is payload for generating daily dispatch sheets
type CreateDispatchDayRequest struct {
	Date          string   `json:"date"` // YYYY-MM-DD
	RouteNoFilter []string `json:"routeNoFilter,omitempty"`
}

// CreateDispatchDayResult reports stats of generation
type CreateDispatchDayResult struct {
	Date            string `json:"date"`
	Created         int    `json:"created"`
	Eligible        int    `json:"eligible"`
	SkippedExisting int    `json:"skippedExisting"`
	Message         string `json:"message"`
}

// RecordArrivalRequest payload for updating stop arrival
type RecordArrivalRequest struct {
	ArrivalTime       string `json:"arrivalTime"`       // "07:37"
	ActualArrivalTime string `json:"actualArrivalTime"` // "07:37"
}

// DriverCheckInRequest payload for logging or reverting driver check-in
type DriverCheckInRequest struct {
	CheckInTime *string `json:"checkInTime,omitempty"` // "06:30"
	Undo        bool    `json:"undo,omitempty"`
}

// UpdateDispatchShiftRequest payload for editing dispatch shift
type UpdateDispatchShiftRequest struct {
	DriverID             *string  `json:"driverId,omitempty"`
	DriverName           *string  `json:"driverName,omitempty"`
	DriverPhone          *string  `json:"driverPhone,omitempty"`
	VehicleID            *int     `json:"vehicleId,omitempty"`
	UnitNumber           *string  `json:"unitNumber,omitempty"`
	PlateNumber          *string  `json:"plateNumber,omitempty"`
	AttendantID          *string  `json:"attendantId,omitempty"`
	AttendantName        *string  `json:"attendantName,omitempty"`
	AttendantPhone       *string  `json:"attendantPhone,omitempty"`
	DispatchComments     *string  `json:"dispatchComments,omitempty"`
	IsDryRun             *bool    `json:"isDryRun,omitempty"`
	DriverPayOption      *string  `json:"driverPayOption,omitempty"`
	DriverPayAmount      *float64 `json:"driverPayAmount,omitempty"`
	DriverEiHours        *float64 `json:"driverEiHours,omitempty"`
	AttendantPayOption   *string  `json:"attendantPayOption,omitempty"`
	AttendantPayAmount   *float64 `json:"attendantPayAmount,omitempty"`
	AttendantEiHours     *float64 `json:"attendantEiHours,omitempty"`
	NurseID              *string  `json:"nurseId,omitempty"`
	NurseName            *string  `json:"nurseName,omitempty"`
	NursePhone           *string  `json:"nursePhone,omitempty"`
	NursePayOption       *string  `json:"nursePayOption,omitempty"`
	NursePayAmount       *float64 `json:"nursePayAmount,omitempty"`
	NurseEiHours         *float64 `json:"nurseEiHours,omitempty"`
	PayrollComments      *string  `json:"payrollComments,omitempty"`
	ScheduledCheckInTime *string                         `json:"scheduledCheckInTime,omitempty"`
	DriverCheckedInAt    *string                         `json:"driverCheckedInAt,omitempty"`
	IsDriverCheckedIn    *bool                           `json:"isDriverCheckedIn,omitempty"`
	DriverCheckedOutAt   *string                         `json:"driverCheckedOutAt,omitempty"`
	IsDriverCheckedOut   *bool                           `json:"isDriverCheckedOut,omitempty"`
	DriverCheckoutComments *string                       `json:"driverCheckoutComments,omitempty"`
	AttendantCheckedInAt *string                         `json:"attendantCheckedInAt,omitempty"`
	IsAttendantCheckedIn *bool                           `json:"isAttendantCheckedIn,omitempty"`
	AttendantCheckedOutAt *string                        `json:"attendantCheckedOutAt,omitempty"`
	IsAttendantCheckedOut *bool                          `json:"isAttendantCheckedOut,omitempty"`
	AttendantCheckoutComments *string                    `json:"attendantCheckoutComments,omitempty"`
	DriverReminderSentAt    *time.Time                      `json:"driverReminderSentAt,omitempty"`
	AttendantReminderSentAt *time.Time                      `json:"attendantReminderSentAt,omitempty"`
	ParentNotifications  *[]SentParentNotificationRecord `json:"parentNotifications,omitempty"`
	Notes                *string                         `json:"notes,omitempty"`
}

// GetEffectiveCheckInTime returns the scheduled check-in time (e.g. "06:30"),
// falling back to 60 minutes before firstStopTime if scheduledCheckInTime is empty.
func (s *DispatchShift) GetEffectiveCheckInTime() string {
	if s.ScheduledCheckInTime != "" {
		return s.ScheduledCheckInTime
	}
	if s.FirstStopTime != "" && len(s.FirstStopTime) >= 5 {
		parts := strings.Split(s.FirstStopTime, ":")
		if len(parts) >= 2 {
			h, err1 := strconv.Atoi(parts[0])
			m, err2 := strconv.Atoi(parts[1])
			if err1 == nil && err2 == nil {
				total := h*60 + m - 60
				if total < 0 {
					total += 24 * 60
				}
				return fmt.Sprintf("%02d:%02d", (total/60)%24, total%60)
			}
		}
	}
	return ""
}

// SplitShiftPart defines each split partition of a dispatch shift
type SplitShiftPart struct {
	RouteSuffix    string `json:"routeSuffix"` // e.g. "A", "B", "C"
	RouteNo        string `json:"routeNo"`     // e.g. "OCSB-050-A", "OCSB-050-B"
	DriverID       string `json:"driverId"`
	DriverName     string `json:"driverName"`
	DriverPhone    string `json:"driverPhone"`
	VehicleID      int    `json:"vehicleId"`
	UnitNumber     string `json:"unitNumber"`
	PlateNumber    string `json:"plateNumber"`
	AttendantID    string `json:"attendantId"`
	AttendantName  string `json:"attendantName"`
	AttendantPhone string `json:"attendantPhone"`
	StudentIDs     []int  `json:"studentIds"`
}

// SplitDispatchShiftRequest payload for splitting a dispatch shift into multiple shifts
type SplitDispatchShiftRequest struct {
	Parts []SplitShiftPart `json:"parts"`
}

// DispatchChangeLog defines a persistent audit record for any operational change in the dispatch system
type DispatchChangeLog struct {
	ID           string      `json:"id" firestore:"id"`
	DispatchDate string      `json:"dispatchDate" firestore:"dispatchDate"` // YYYY-MM-DD
	ShiftID      string      `json:"shiftId,omitempty" firestore:"shiftId,omitempty"`
	RouteNo      string      `json:"routeNo" firestore:"routeNo"`
	ShiftType    string      `json:"shiftType" firestore:"shiftType"` // "AM", "PM", "Midday"
	Type         string      `json:"type" firestore:"type"`           // "Assignment Updated", "TCS Check-in/out", "Dispatch Comments", etc.
	Detail       string      `json:"detail" firestore:"detail"`
	Time         string      `json:"time" firestore:"time"`           // e.g. "2026-04-01 7:48:37 p.m." or ISO
	Timestamp    int64       `json:"timestamp" firestore:"timestamp"` // epoch ms for deterministic sort
	User         string      `json:"user" firestore:"user"`
	CreatedAt    interface{} `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
}

// RecordStudentAbsenceRequest represents a dispatcher request to mark a student absent across shifts
type RecordStudentAbsenceRequest struct {
	Date        string `json:"date"`                 // e.g. "2026-09-30" or "2026-10-01"
	StudentID   int    `json:"studentId"`            // e.g. 209
	StudentName string `json:"studentName,omitempty"` // optional e.g. "Emma Thompson"
	SchoolName  string `json:"schoolName,omitempty"`  // optional e.g. "Westboro Academy"
	RouteNo     string `json:"routeNo,omitempty"`    // optional e.g. "CEPEO-021"
	ShiftType   string `json:"shiftType,omitempty"`  // "ALL" (default), "AM", "PM"
	Reason      string `json:"reason"`               // e.g. "Parent called: Flu/Sick"
	ReportedBy  string `json:"reportedBy,omitempty"` // e.g. "Parent (613-555-0199)"
}

// RecordStudentAbsenceResponse provides confirmation of shifts updated with absence
type RecordStudentAbsenceResponse struct {
	Date          string   `json:"date"`
	StudentID     int      `json:"studentId"`
	StudentName   string   `json:"studentName"`
	Reason        string   `json:"reason"`
	AffectedShifts []string `json:"affectedShifts"`
	Count         int      `json:"count"`
}

// StudentAbsenceRecord represents an individual logged student absence entry
type StudentAbsenceRecord struct {
	ID             string   `json:"id" firestore:"id"`
	Date           string   `json:"date" firestore:"date"` // YYYY-MM-DD
	StudentID      int      `json:"studentId" firestore:"studentId"`
	StudentNo      string   `json:"studentNo,omitempty" firestore:"studentNo,omitempty"`
	StudentName    string   `json:"studentName" firestore:"studentName"`
	SchoolName     string   `json:"schoolName,omitempty" firestore:"schoolName,omitempty"`
	RouteNo        string   `json:"routeNo,omitempty" firestore:"routeNo,omitempty"`
	ShiftType      string   `json:"shiftType,omitempty" firestore:"shiftType,omitempty"` // "ALL", "AM", "PM"
	Reason         string   `json:"reason" firestore:"reason"`
	ReportedBy     string   `json:"reportedBy,omitempty" firestore:"reportedBy,omitempty"`
	ReportedAt     string   `json:"reportedAt,omitempty" firestore:"reportedAt,omitempty"`
	CreatedAt      string   `json:"createdAt,omitempty" firestore:"createdAt,omitempty"`
	Status         string   `json:"status" firestore:"status"` // "ACTIVE", "CANCELLED"
	AffectedShifts []string `json:"affectedShifts,omitempty" firestore:"affectedShifts,omitempty"`
}

// ListStudentAbsencesFilter defines date range and criteria for querying absences
type ListStudentAbsencesFilter struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	StudentID int    `json:"studentId,omitempty"`
	RouteNo   string `json:"routeNo,omitempty"`
	ShiftType string `json:"shiftType,omitempty"`
}

// CheckInReminderSettings defines configuration for late check-in reminders via FCM
type CheckInReminderSettings struct {
	ReminderGraceMinutes        int    `json:"reminderGraceMinutes" firestore:"reminderGraceMinutes"`               // default: 20
	PretripReminderGraceMinutes int    `json:"pretripReminderGraceMinutes" firestore:"pretripReminderGraceMinutes"` // default: 60
	Enabled                     bool   `json:"enabled" firestore:"enabled"`                                         // default: true
	ReminderWindowStart         string `json:"reminderWindowStart" firestore:"reminderWindowStart"`                 // default: "06:00"
	ReminderWindowEnd           string `json:"reminderWindowEnd" firestore:"reminderWindowEnd"`                     // default: "18:00"
	UpdatedAt                   string `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
	UpdatedBy                   string `json:"updatedBy,omitempty" firestore:"updatedBy,omitempty"`
}

func DefaultCheckInReminderSettings() *CheckInReminderSettings {
	return &CheckInReminderSettings{
		ReminderGraceMinutes:        20,
		PretripReminderGraceMinutes: 60,
		Enabled:                     true,
		ReminderWindowStart:         "06:00",
		ReminderWindowEnd:           "18:00",
		UpdatedAt:                   time.Now().UTC().Format(time.RFC3339),
		UpdatedBy:                   "system",
	}
}

// SimulationSettings defines system-wide automated operations simulation settings
type SimulationSettings struct {
	Enabled                    bool   `json:"enabled" firestore:"enabled"`                                       // Master switch for simulation mode
	AutoGenerateTime           string `json:"autoGenerateTime" firestore:"autoGenerateTime"`                     // Default: "14:00" (2:00 PM Ottawa time)
	CheckInWindowMinutes       int    `json:"checkInWindowMinutes" firestore:"checkInWindowMinutes"`             // Default: 30 (+0..30 min of scheduled check-in)
	StudentPickupWindowMinutes int    `json:"studentPickupWindowMinutes" firestore:"studentPickupWindowMinutes"` // Default: 15 (+0..15 min of scheduled stop time)
	StudentAbsentRate          int    `json:"studentAbsentRate" firestore:"studentAbsentRate"`                   // Default: 10 (10% absent ratio)
	PretripWindowMinutes       int    `json:"pretripWindowMinutes" firestore:"pretripWindowMinutes"`             // Default: 30 (+0..30 min of scheduled check-in)
	LastAutoGeneratedForDate   string `json:"lastAutoGeneratedForDate,omitempty" firestore:"lastAutoGeneratedForDate,omitempty"`
	LastSimulatedDate          string `json:"lastSimulatedDate,omitempty" firestore:"lastSimulatedDate,omitempty"`
	LastRunAt                  string `json:"lastRunAt,omitempty" firestore:"lastRunAt,omitempty"`
	UpdatedAt                  string `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
	UpdatedBy                  string `json:"updatedBy,omitempty" firestore:"updatedBy,omitempty"`
}

func DefaultSimulationSettings() *SimulationSettings {
	return &SimulationSettings{
		Enabled:                    false,
		AutoGenerateTime:           "14:00",
		CheckInWindowMinutes:       30,
		StudentPickupWindowMinutes: 15,
		StudentAbsentRate:          10,
		PretripWindowMinutes:       30,
		UpdatedAt:                  time.Now().UTC().Format(time.RFC3339),
		UpdatedBy:                  "system",
	}
}

// RunSimulationRequest represents a manual or scheduled trigger to run simulation for a date
type RunSimulationRequest struct {
	Date           string `json:"date"`           // YYYY-MM-DD (defaults to today Ottawa time if empty)
	ForceOverwrite bool   `json:"forceOverwrite"` // If true, re-randomizes already checked-in / simulated records
}

// SimulationRunResult summarizes the outcome of running simulation for a given date
type SimulationRunResult struct {
	Date                    string  `json:"date"`
	DispatchesCreated       int     `json:"dispatchesCreated"`
	TotalShifts             int     `json:"totalShifts"`
	DriversCheckedIn        int     `json:"driversCheckedIn"`
	AttendantsCheckedIn     int     `json:"attendantsCheckedIn"`
	TotalStudents           int     `json:"totalStudents"`
	AbsentStudents          int     `json:"absentStudents"`
	PresentStudents         int     `json:"presentStudents"`
	AbsentRatePercent       float64 `json:"absentRatePercent"`
	PretripsCreated         int     `json:"pretripsCreated"`
	TimeOffCreated          int     `json:"timeOffCreated"`
	TimeOffApproved         int     `json:"timeOffApproved"`
	DefectsCreated          int     `json:"defectsCreated"`
	DefectsResolved         int     `json:"defectsResolved"`
	IncidentsCreated        int     `json:"incidentsCreated"`
	IncidentsResolved       int     `json:"incidentsResolved"`
	RouteAssessmentsCreated int     `json:"routeAssessmentsCreated"`
	HazardReportsCreated    int     `json:"hazardReportsCreated"`
	ExpensesCreated         int     `json:"expensesCreated"`
	ExpensesApproved        int     `json:"expensesApproved"`
	VehicleSignoutsCreated  int     `json:"vehicleSignoutsCreated"`
	ExecutedAt              string  `json:"executedAt"`
	Message                 string  `json:"message"`
}

