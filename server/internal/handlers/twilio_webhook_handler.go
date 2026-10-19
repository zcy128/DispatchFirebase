package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

type TwilioWebhookHandler struct {
	cfg           *config.Config
	studentRepo   repository.StudentRepository
	dispatchRepo  repository.DispatchRepository
	parentRepo    repository.ParentRepository
	twilioService *services.TwilioService
	etaService    *services.ETAService
}

func NewTwilioWebhookHandler(
	cfg *config.Config,
	studentRepo repository.StudentRepository,
	dispatchRepo repository.DispatchRepository,
	parentRepo repository.ParentRepository,
	twilioService *services.TwilioService,
	etaService *services.ETAService,
) *TwilioWebhookHandler {
	return &TwilioWebhookHandler{
		cfg:           cfg,
		studentRepo:   studentRepo,
		dispatchRepo:  dispatchRepo,
		parentRepo:    parentRepo,
		twilioService: twilioService,
		etaService:    etaService,
	}
}

// HandleTwilioInboundSMS processes incoming SMS sent from parents to the Twilio number
func (h *TwilioWebhookHandler) HandleTwilioInboundSMS(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		log.Printf("[TWILIO-WEBHOOK] Error parsing form: %v", err)
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	fromPhone := strings.TrimSpace(r.FormValue("From"))
	smsBody := strings.TrimSpace(r.FormValue("Body"))
	msgSid := r.FormValue("MessageSid")

	log.Printf("[TWILIO-INBOUND] Received SMS from %s (SID: %s): '%s'", fromPhone, msgSid, smsBody)

	replyText := h.generateReplyForParent(r.Context(), fromPhone, smsBody)

	twimlXML := h.twilioService.GenerateTwiMLResponse(replyText)
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(twimlXML))
}

func (h *TwilioWebhookHandler) generateReplyForParent(ctx context.Context, fromPhone, rawBody string) string {
	if fromPhone == "" {
		return "Unable to determine sender phone number."
	}

	// 1. Find linked students by phone
	students, err := h.studentRepo.FindStudentsByContact(ctx, fromPhone)
	if err != nil || len(students) == 0 {
		return "[PCY Dispatch] This phone number is not registered with any student in our bus system. Please contact your school or dispatch office."
	}

	// Determine current Ottawa time for AM / PM shift
	loc, errLoc := time.LoadLocation("America/Toronto")
	if errLoc != nil {
		loc = time.FixedZone("EDT", -4*3600)
	}
	now := time.Now().In(loc)
	todayStr := now.Format("2006-01-02")
	shiftType := "AM"
	if now.Hour() >= 12 {
		shiftType = "PM"
	}

	// Load today's active shifts
	shifts, _ := h.dispatchRepo.ListShifts(ctx, todayStr, repository.DispatchFilter{})
	shiftMap := make(map[string]*models.DispatchShift)
	for _, s := range shifts {
		if strings.EqualFold(s.ShiftType, shiftType) {
			shiftMap[strings.ToUpper(strings.TrimSpace(s.RouteNo))] = s
		}
	}

	cleanInput := strings.ToUpper(strings.TrimSpace(rawBody))

	// If parent has exactly 1 student
	if len(students) == 1 {
		return h.formatSingleStudentETA(ctx, students[0], shiftType, shiftMap)
	}

	// If parent has multiple students and texted a selection digit (e.g., '1', '2')
	if num, err := strconv.Atoi(cleanInput); err == nil && num >= 1 && num <= len(students) {
		selected := students[num-1]
		return fmt.Sprintf("[Student #%d]\n%s", num, h.formatSingleStudentETA(ctx, selected, shiftType, shiftMap))
	}

	// Multi-student summary reply
	var lines []string
	lines = append(lines, fmt.Sprintf("[PCY Dispatch] %d students linked to this phone (%s Run):", len(students), shiftType))

	for i, s := range students {
		brief := h.formatBriefStudentStatus(ctx, s, shiftType, shiftMap)
		lines = append(lines, fmt.Sprintf("%d. %s: %s", i+1, s.FirstName, brief))
	}

	lines = append(lines, "Reply '1' or '2' for detailed live updates.")
	return strings.Join(lines, "\n")
}

func (h *TwilioWebhookHandler) formatSingleStudentETA(
	ctx context.Context,
	student *models.Student,
	shiftType string,
	shiftMap map[string]*models.DispatchShift,
) string {
	// Find relevant stop
	var targetStop *models.StudentStop
	for _, st := range student.Stops {
		if strings.EqualFold(st.Shift, shiftType) {
			targetStop = &st
			break
		}
	}
	if targetStop == nil && len(student.Stops) > 0 {
		targetStop = &student.Stops[0]
	}

	routeNo := "TBD"
	schedTime := "07:30"
	stopLoc := "Designated Stop"
	if targetStop != nil {
		if targetStop.Route != "" {
			routeNo = targetStop.Route
		}
		if targetStop.Time != "" {
			schedTime = targetStop.Time
		}
		if targetStop.Location != "" {
			stopLoc = targetStop.Location
		}
	}

	ds, hasShift := shiftMap[strings.ToUpper(strings.TrimSpace(routeNo))]
	busUnit := "TBD"
	lateMins := 0
	if hasShift && ds != nil {
		if ds.UnitNumber != "" {
			busUnit = "#" + ds.UnitNumber
		}
		lateMins = ds.LateMinutes
	}

	// Live location & ETA calculation
	var vehLoc *models.VehicleLiveLocation
	if hasShift && ds != nil && ds.UnitNumber != "" {
		vehLoc, _ = h.parentRepo.GetVehicleLiveLocation(ctx, ds.UnitNumber)
	}

	estTime, dist, mins, status := h.etaService.CalculateCommuteETA(
		schedTime,
		lateMins,
		nil,
		nil,
		vehLoc,
		1,
		false,
		false,
	)

	statusDesc := "On Time"
	if lateMins > 0 {
		statusDesc = fmt.Sprintf("Delayed %d min(s)", lateMins)
	}
	if status == "APPROACHING" {
		statusDesc = "Approaching stop"
	} else if status == "BOARDED" {
		statusDesc = "Student Boarded"
	}

	extra := ""
	if mins != nil && *mins > 0 {
		extra = fmt.Sprintf(" (~%d mins away)", *mins)
	} else if dist != nil && *dist > 0 {
		extra = fmt.Sprintf(" (~%.1f km away)", *dist)
	}

	trackURL := h.cfg.ParentAppBaseURL
	if trackURL == "" {
		trackURL = "https://parent.pcytech.ca"
	}

	return fmt.Sprintf("[PCY Dispatch]\nStudent: %s (%s)\nBus: %s (Route %s)\nStatus: %s\nStop: %s\nSched: %s | ETA: %s%s\nTrack live: %s",
		student.StudentName, student.Grade, busUnit, routeNo, statusDesc, stopLoc, schedTime, estTime, extra, trackURL)
}

func (h *TwilioWebhookHandler) formatBriefStudentStatus(
	ctx context.Context,
	student *models.Student,
	shiftType string,
	shiftMap map[string]*models.DispatchShift,
) string {
	var targetStop *models.StudentStop
	for _, st := range student.Stops {
		if strings.EqualFold(st.Shift, shiftType) {
			targetStop = &st
			break
		}
	}
	if targetStop == nil && len(student.Stops) > 0 {
		targetStop = &student.Stops[0]
	}

	routeNo := "TBD"
	schedTime := "07:30"
	if targetStop != nil {
		routeNo = targetStop.Route
		if targetStop.Time != "" {
			schedTime = targetStop.Time
		}
	}

	ds, hasShift := shiftMap[strings.ToUpper(strings.TrimSpace(routeNo))]
	busUnit := "Bus"
	lateMins := 0
	if hasShift && ds != nil {
		if ds.UnitNumber != "" {
			busUnit = "Bus #" + ds.UnitNumber
		}
		lateMins = ds.LateMinutes
	}

	estTime := services.AddMinutesToTimeString(schedTime, lateMins)
	if lateMins > 0 {
		return fmt.Sprintf("%s, ETA %s (+%dm delay)", busUnit, estTime, lateMins)
	}
	return fmt.Sprintf("%s, ETA %s (On time)", busUnit, estTime)
}
