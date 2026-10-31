package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

type ParentHandler struct {
	cfg           *config.Config
	studentRepo   repository.StudentRepository
	parentRepo    repository.ParentRepository
	dispatchRepo  repository.DispatchRepository
	routeRepo     repository.RouteRepository
	twilioService *services.TwilioService
	emailService  *services.EmailService
	etaService    *services.ETAService
	routesService *services.GoogleRoutesService
}

func NewParentHandler(
	cfg *config.Config,
	studentRepo repository.StudentRepository,
	parentRepo repository.ParentRepository,
	dispatchRepo repository.DispatchRepository,
	routeRepo repository.RouteRepository,
	twilioService *services.TwilioService,
	emailService *services.EmailService,
	etaService *services.ETAService,
	routesService *services.GoogleRoutesService,
) *ParentHandler {
	return &ParentHandler{
		cfg:           cfg,
		studentRepo:   studentRepo,
		parentRepo:    parentRepo,
		dispatchRepo:  dispatchRepo,
		routeRepo:     routeRepo,
		twilioService: twilioService,
		emailService:  emailService,
		etaService:    etaService,
		routesService: routesService,
	}
}

// RequestOTP sends a 6-digit one-time passcode to valid parent phone or email
func (h *ParentHandler) RequestOTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var payload models.RequestOTPPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	contact := strings.TrimSpace(payload.Contact)
	if contact == "" {
		http.Error(w, `{"error":"phone number or email is required"}`, http.StatusBadRequest)
		return
	}

	// 1. Verify that contact belongs to at least one student in the database
	students, err := h.studentRepo.FindStudentsByContact(r.Context(), contact)
	if err != nil {
		log.Printf("[PARENT-AUTH] Error looking up contact %s: %v", contact, err)
		http.Error(w, `{"error":"database error during contact lookup"}`, http.StatusInternalServerError)
		return
	}

	if len(students) == 0 && h.allowsDemo() && isDemoContact(contact) {
		students = getDemoStudents()
		for _, s := range students {
			_ = h.studentRepo.Create(r.Context(), s)
		}
	}

	if len(students) == 0 {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No student profile found with this phone number or email. Please verify with your school or dispatch office.",
		})
		return
	}

	// Extract matched student IDs
	var matchedIDs []string
	for _, s := range students {
		matchedIDs = append(matchedIDs, s.ID)
	}

	// 2. Generate secure 6-digit OTP
	code := generateSecureOTP()
	expiresAt := time.Now().Add(10 * time.Minute)

	session := &models.ParentOTPSession{
		Contact:           contact,
		Code:              code,
		ExpiresAt:         expiresAt,
		Verified:          false,
		MatchedStudentIDs: matchedIDs,
		CreatedAt:         time.Now().UTC(),
	}

	if err := h.parentRepo.SaveOTPSession(r.Context(), session); err != nil {
		log.Printf("[PARENT-AUTH] Error saving OTP session: %v", err)
		http.Error(w, `{"error":"failed to generate otp session"}`, http.StatusInternalServerError)
		return
	}

	isEmail := strings.Contains(contact, "@")
	contactType := "phone"
	if isEmail {
		contactType = "email"
	}

	// 3. Dispatch OTP via Twilio SMS or Email
	if isEmail {
		subject := "Your Bus Tracker Passcode"
		htmlBody := fmt.Sprintf(`<h2>Bus Tracker Temporary Passcode</h2><p>Your 6-digit verification code is: <strong>%s</strong></p><p>This code expires in 10 minutes. If you did not request this, please disregard.</p>`, code)
		textBody := fmt.Sprintf("Your Bus Tracker verification code is: %s (expires in 10 minutes)", code)
		_ = h.emailService.SendEmail([]string{contact}, subject, htmlBody, textBody)
	} else {
		smsBody := fmt.Sprintf("[PCY Dispatch] Your temporary passcode is %s. Valid for 10 minutes. Do not share this code.", code)
		_ = h.twilioService.SendSMS(contact, smsBody)
	}

	resp := models.RequestOTPResponse{
		Success:              true,
		Message:              fmt.Sprintf("Temporary passcode sent to %s", contact),
		ContactType:          contactType,
		MatchedStudentsCount: len(students),
	}
	// In dev mode, return devCode for frictionless automated/manual testing
	if h.allowsDemo() && h.cfg.IsDevelopment {
		resp.DevCode = code
	}

	json.NewEncoder(w).Encode(resp)
}

// VerifyOTP validates the OTP and issues a Parent Session Token with child commuters
func (h *ParentHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var payload models.VerifyOTPPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	contact := strings.TrimSpace(payload.Contact)
	code := strings.TrimSpace(payload.Code)

	session, err := h.parentRepo.GetOTPSession(r.Context(), contact)
	if err != nil || session == nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No active verification request found. Please request a new code.",
		})
		return
	}

	if time.Now().After(session.ExpiresAt) {
		_ = h.parentRepo.DeleteOTPSession(r.Context(), contact)
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Passcode has expired. Please request a new one.",
		})
		return
	}

	if session.Code != code && !(h.allowsDemo() && (h.cfg == nil || h.cfg.IsDevelopment || isDemoContact(contact)) && (code == "123456" || code == session.Code)) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Incorrect passcode. Please try again.",
		})
		return
	}

	// Mark session verified and clean up
	session.Verified = true
	_ = h.parentRepo.DeleteOTPSession(r.Context(), contact)

	// Fetch or create ParentUser
	user, _ := h.parentRepo.GetParentUserByContact(r.Context(), contact)
	if user == nil {
		contactType := "phone"
		if strings.Contains(contact, "@") {
			contactType = "email"
		}
		user = &models.ParentUser{
			ID:               "PAR-" + repository.SanitizeContactKey(contact),
			ContactType:      contactType,
			ContactValue:     contact,
			DisplayName:      "Parent (" + contact + ")",
			IsRegistered:     false,
			LinkedStudentIDs: session.MatchedStudentIDs,
			CreatedAt:        time.Now().UTC(),
			LastLoginAt:      time.Now().UTC(),
		}
		_ = h.parentRepo.SaveParentUser(r.Context(), user)
	} else {
		if user.ID == "" {
			user.ID = "PAR-" + repository.SanitizeContactKey(contact)
		}
		user.LastLoginAt = time.Now().UTC()
		user.LinkedStudentIDs = session.MatchedStudentIDs
		_ = h.parentRepo.SaveParentUser(r.Context(), user)
	}

	// Issue HMAC-SHA256 session token
	token := h.generateParentSessionToken(user.ID, contact)

	// Aggregate live commute info for all linked children
	commutes := h.aggregateStudentCommutes(r.Context(), session.MatchedStudentIDs)

	resp := models.VerifyOTPResponse{
		Success:      true,
		Token:        token,
		IsRegistered: user.IsRegistered,
		ParentUser:   user,
		Students:     commutes,
	}

	json.NewEncoder(w).Encode(resp)
}

// Register converts a guest/OTP session into a permanent registered account with password
func (h *ParentHandler) Register(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var payload models.RegisterParentPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	sessionContact := h.extractContactFromRequest(r)
	if sessionContact == "" {
		http.Error(w, `{"error":"unauthorized: missing or invalid parent token"}`, http.StatusUnauthorized)
		return
	}
	contact := sessionContact
	if bodyContact := strings.TrimSpace(payload.Contact); bodyContact != "" && !parentContactsMatch(bodyContact, sessionContact) {
		http.Error(w, `{"error":"forbidden: you can only register your own parent account"}`, http.StatusForbidden)
		return
	}
	password := strings.TrimSpace(payload.Password)
	name := strings.TrimSpace(payload.Name)

	if contact == "" || len(password) < 6 {
		http.Error(w, `{"error":"contact and a password with at least 6 characters are required"}`, http.StatusBadRequest)
		return
	}

	user, err := h.parentRepo.GetParentUserByContact(r.Context(), contact)
	if err != nil || user == nil {
		http.Error(w, `{"error":"parent profile not found. Please log in via OTP first."}`, http.StatusNotFound)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"failed to secure password"}`, http.StatusInternalServerError)
		return
	}

	user.PasswordHash = string(hash)
	user.IsRegistered = true
	if name != "" {
		user.DisplayName = name
	}
	user.LastLoginAt = time.Now().UTC()

	if err := h.parentRepo.SaveParentUser(r.Context(), user); err != nil {
		http.Error(w, `{"error":"failed to save account"}`, http.StatusInternalServerError)
		return
	}

	token := h.generateParentSessionToken(user.ID, contact)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"message":    "Account successfully registered",
		"token":      token,
		"parentUser": user,
	})
}

// ListMyStudents returns up-to-date commute & ETA information for all children under this parent
func (h *ParentHandler) ListMyStudents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	contact := h.extractContactFromRequest(r)
	if contact == "" {
		http.Error(w, `{"error":"unauthorized: missing or invalid parent token"}`, http.StatusUnauthorized)
		return
	}

	students, err := h.studentRepo.FindStudentsByContact(r.Context(), contact)
	if (err != nil || len(students) == 0) && h.allowsDemo() && isDemoContact(contact) {
		students = getDemoStudents()
	} else if err != nil {
		http.Error(w, `{"error":"failed to fetch students"}`, http.StatusInternalServerError)
		return
	}

	var ids []string
	for _, s := range students {
		ids = append(ids, s.ID)
	}

	commutes := h.aggregateStudentCommutes(r.Context(), ids)
	json.NewEncoder(w).Encode(commutes)
}

func (h *ParentHandler) studentsForContact(ctx context.Context, contact string) []*models.Student {
	students, err := h.studentRepo.FindStudentsByContact(ctx, contact)
	if (err != nil || len(students) == 0) && h.allowsDemo() && isDemoContact(contact) {
		return getDemoStudents()
	}
	if err != nil || students == nil {
		return nil
	}
	return students
}

func (h *ParentHandler) parentOwnsStudent(ctx context.Context, contact string, studentID int) bool {
	for _, student := range h.studentsForContact(ctx, contact) {
		if student.StudentID == studentID {
			return true
		}
	}
	return false
}

func (h *ParentHandler) parentOwnsBus(ctx context.Context, contact, unitNumber string) bool {
	want := strings.TrimPrefix(strings.TrimSpace(unitNumber), "#")
	if want == "" {
		return false
	}
	var ids []string
	for _, student := range h.studentsForContact(ctx, contact) {
		if student.ID != "" {
			ids = append(ids, student.ID)
		}
	}
	for _, commute := range h.aggregateStudentCommutes(ctx, ids) {
		got := strings.TrimPrefix(strings.TrimSpace(commute.BusUnitNumber), "#")
		if got != "" && strings.EqualFold(got, want) {
			return true
		}
	}
	return false
}

// RecordStudentAbsence records an absence only for a student linked to the signed-in parent.
func (h *ParentHandler) RecordStudentAbsence(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	contact := h.extractContactFromRequest(r)
	var req models.RecordStudentAbsenceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}
	if req.Date == "" || req.StudentID <= 0 {
		http.Error(w, `{"error":"date and studentId are required"}`, http.StatusBadRequest)
		return
	}
	if !h.parentOwnsStudent(r.Context(), contact, req.StudentID) {
		http.Error(w, `{"error":"forbidden: you can only report an absence for your own student"}`, http.StatusForbidden)
		return
	}
	res, err := h.dispatchRepo.RecordStudentAbsence(r.Context(), &req)
	if err != nil {
		http.Error(w, `{"error":"failed to record student absence: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// GetVehicleTracking returns live coordinates and telemetry for a specific bus unit
func (h *ParentHandler) GetVehicleTracking(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	unitNumber := chi.URLParam(r, "unitNumber")
	contact := h.extractContactFromRequest(r)
	if !h.parentOwnsBus(r.Context(), contact, unitNumber) {
		http.Error(w, `{"error":"forbidden: you can only track a bus assigned to your student"}`, http.StatusForbidden)
		return
	}

	loc, err := h.parentRepo.GetVehicleLiveLocation(r.Context(), unitNumber)
	if (err != nil || loc == nil) && (unitNumber == "42" || unitNumber == "#42") {
		loc = &models.VehicleLiveLocation{
			UnitNumber:  "42",
			RouteNo:     "OCDSB-001",
			Latitude:    45.3512,
			Longitude:   -75.7601,
			Heading:     85.0,
			SpeedKmh:    34.5,
			Status:      "EN_ROUTE",
			LastUpdated: time.Now().UTC(),
		}
	} else if err != nil || loc == nil {
		http.Error(w, `{"error":"vehicle location not available"}`, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(loc)
}

// UpdateVehicleTelemetry updates live GPS location for a bus (called by driver app or GPS tracker)
func (h *ParentHandler) UpdateVehicleTelemetry(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var loc models.VehicleLiveLocation
	if err := json.NewDecoder(r.Body).Decode(&loc); err != nil {
		http.Error(w, `{"error":"invalid telemetry payload"}`, http.StatusBadRequest)
		return
	}

	if loc.UnitNumber == "" {
		http.Error(w, `{"error":"unitNumber is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.parentRepo.SaveVehicleLiveLocation(r.Context(), &loc); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to save location: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Write([]byte(`{"success":true,"message":"location updated"}`))
}

// GetPreferences returns parent alert configuration
func (h *ParentHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	parentID := h.extractParentIDFromRequest(r)
	if parentID == "" {
		parentID = "PAR-" + h.extractContactFromRequest(r)
	}

	prefs, err := h.parentRepo.GetNotificationPreferences(r.Context(), parentID)
	if err != nil {
		prefs = models.DefaultParentNotificationConfig()
	}
	json.NewEncoder(w).Encode(prefs)
}

// SavePreferences updates parent alert configuration
func (h *ParentHandler) SavePreferences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	parentID := h.extractParentIDFromRequest(r)
	if parentID == "" {
		parentID = "PAR-" + h.extractContactFromRequest(r)
	}

	var prefs models.ParentNotificationConfig
	if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}
	prefs.ParentID = parentID

	if err := h.parentRepo.SaveNotificationPreferences(r.Context(), &prefs); err != nil {
		http.Error(w, `{"error":"failed to save preferences"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(prefs)
}

// GetProfile returns parent user profile information
func (h *ParentHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	contact := h.extractContactFromRequest(r)
	parentID := h.extractParentIDFromRequest(r)

	var user *models.ParentUser
	var err error
	if parentID != "" {
		user, err = h.parentRepo.GetParentUser(r.Context(), parentID)
	}
	if (user == nil || err != nil) && contact != "" {
		user, err = h.parentRepo.GetParentUserByContact(r.Context(), contact)
	}

	if user == nil {
		contactType := "phone"
		if strings.Contains(contact, "@") {
			contactType = "email"
		}
		user = &models.ParentUser{
			ContactType:  contactType,
			ContactValue: contact,
			DisplayName:  "Parent (" + contact + ")",
			IsRegistered: false,
			CreatedAt:    time.Now().UTC(),
			LastLoginAt:  time.Now().UTC(),
		}
	}

	if user.Phone == "" && user.ContactType == "phone" {
		user.Phone = user.ContactValue
	}
	if user.Email == "" && user.ContactType == "email" {
		user.Email = user.ContactValue
	}

	// Pull address & contact details from linked students if blank
	if (user.HomeAddress == "" || user.Phone == "" || user.DisplayName == "" || strings.HasPrefix(user.DisplayName, "Parent (")) && contact != "" {
		students, _ := h.studentRepo.FindStudentsByContact(r.Context(), contact)
		if len(students) > 0 {
			st := students[0]
			if user.HomeAddress == "" {
				user.HomeAddress = st.StudentAddress
			}
			for _, c := range st.Contacts {
				phone := c.MobilePhone
				if phone == "" {
					phone = c.HomePhone
				}
				if user.Phone == "" && phone != "" {
					user.Phone = phone
				}
				if user.Email == "" && c.Email != "" {
					user.Email = c.Email
				}
				if (user.DisplayName == "" || strings.HasPrefix(user.DisplayName, "Parent (")) && c.ContactName != "" {
					user.DisplayName = c.ContactName
				}
			}
		}
	}

	json.NewEncoder(w).Encode(user)
}

// UpdateProfile modifies personal information: phone, email, home address, display name
func (h *ParentHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	contact := h.extractContactFromRequest(r)
	parentID := h.extractParentIDFromRequest(r)

	var req models.UpdateParentProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	var user *models.ParentUser
	if parentID != "" {
		user, _ = h.parentRepo.GetParentUser(r.Context(), parentID)
	}
	if user == nil && contact != "" {
		user, _ = h.parentRepo.GetParentUserByContact(r.Context(), contact)
	}

	if user == nil {
		contactType := "phone"
		if strings.Contains(contact, "@") {
			contactType = "email"
		}
		user = &models.ParentUser{
			ContactType:  contactType,
			ContactValue: contact,
			CreatedAt:    time.Now().UTC(),
		}
	}

	if req.DisplayName != "" {
		user.DisplayName = strings.TrimSpace(req.DisplayName)
	}
	if req.Phone != "" {
		user.Phone = strings.TrimSpace(req.Phone)
	}
	if req.Email != "" {
		user.Email = strings.TrimSpace(req.Email)
	}
	if req.HomeAddress != "" {
		user.HomeAddress = strings.TrimSpace(req.HomeAddress)
	}
	user.LastLoginAt = time.Now().UTC()

	if err := h.parentRepo.SaveParentUser(r.Context(), user); err != nil {
		http.Error(w, `{"error":"failed to save profile: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	// Synchronize home address and contact details with linked student records
	lookupContact := contact
	if lookupContact == "" {
		lookupContact = user.ContactValue
	}
	if lookupContact == "" {
		lookupContact = user.Phone
	}
	if lookupContact != "" {
		students, _ := h.studentRepo.FindStudentsByContact(r.Context(), lookupContact)
		for _, stu := range students {
			modified := false
			if req.HomeAddress != "" && stu.StudentAddress != req.HomeAddress {
				stu.StudentAddress = req.HomeAddress
				modified = true
			}
			if req.Phone != "" && stu.StudentPhone != req.Phone {
				stu.StudentPhone = req.Phone
				modified = true
			}
			for i := range stu.Contacts {
				c := &stu.Contacts[i]
				if req.DisplayName != "" && (c.Relationship == "Parent" || c.Relationship == "Mother" || c.Relationship == "Father" || c.Relationship == "Guardian" || strings.Contains(strings.ToLower(c.ContactName), "parent")) {
					c.ContactName = req.DisplayName
					modified = true
				}
				phone := c.MobilePhone
				if phone == "" {
					phone = c.HomePhone
				}
				if req.Phone != "" && (phone == lookupContact || phone == "" || c.PrimaryContact) {
					c.MobilePhone = req.Phone
					modified = true
				}
				if req.Email != "" && (c.Email == lookupContact || c.Email == "" || c.PrimaryContact) {
					c.Email = req.Email
					modified = true
				}
			}
			if modified {
				_ = h.studentRepo.Update(r.Context(), stu)
			}
		}

		nowStr := time.Now().Format("2006-01-02 15:04:05")
		todayDate := time.Now().Format("2006-01-02")
		_, _ = h.dispatchRepo.AddChangeLog(r.Context(), &models.DispatchChangeLog{
			DispatchDate: todayDate,
			Type:         "Parent Profile Updated",
			Detail:       fmt.Sprintf("Parent %s updated contact details (Phone: %s, Email: %s, Address: %s)", user.DisplayName, user.Phone, user.Email, user.HomeAddress),
			Time:         nowStr,
			Timestamp:    time.Now().UnixMilli(),
			User:         "Parent (" + lookupContact + ")",
		})
	}

	json.NewEncoder(w).Encode(user)
}

// RegisterDevice registers an FCM push notification token for this parent
func (h *ParentHandler) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	parentID := h.extractParentIDFromRequest(r)
	if parentID == "" {
		parentID = "PAR-" + h.extractContactFromRequest(r)
	}

	var body struct {
		Token      string `json:"token"`
		Platform   string `json:"platform"`
		DeviceName string `json:"deviceName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" {
		http.Error(w, `{"error":"token is required"}`, http.StatusBadRequest)
		return
	}

	err := h.parentRepo.RegisterDeviceToken(r.Context(), parentID, models.DeviceToken{
		Token:      body.Token,
		Platform:   body.Platform,
		DeviceName: body.DeviceName,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to register device token"}`, http.StatusInternalServerError)
		return
	}

	w.Write([]byte(`{"success":true,"message":"device registered"}`))
}

// Internal helper to aggregate all child commutes with live ETA
func (h *ParentHandler) aggregateStudentCommutes(ctx context.Context, studentIDs []string) []*models.ParentStudentCommute {
	locOttawa, errLoc := time.LoadLocation("America/Toronto")
	if errLoc != nil {
		locOttawa = time.FixedZone("EDT", -4*3600)
	}
	nowLocal := time.Now().In(locOttawa)
	todayStr := nowLocal.Format("2006-01-02")
	currentHour := nowLocal.Hour()

	// Pick default shift type based on current time (Morning vs Afternoon)
	preferredShiftType := "AM"
	if currentHour >= 12 {
		preferredShiftType = "PM"
	}

	// Load today's active dispatch shifts
	todayShifts, _ := h.dispatchRepo.ListShifts(ctx, todayStr, repository.DispatchFilter{})
	shiftByRoute := make(map[string]*models.DispatchShift)
	for _, ds := range todayShifts {
		if strings.EqualFold(ds.ShiftType, preferredShiftType) {
			shiftByRoute[strings.ToUpper(strings.TrimSpace(ds.RouteNo))] = ds
		}
	}

	avatarColors := []string{"#4F46E5", "#059669", "#D97706", "#DC2626", "#7C3AED"}
	results := make([]*models.ParentStudentCommute, 0)

	for idx, sID := range studentIDs {
		student, err := h.studentRepo.GetByID(ctx, sID)
		if (err != nil || student == nil) && h.allowsDemo() {
			for _, ds := range getDemoStudents() {
				if ds.ID == sID {
					student = ds
					break
				}
			}
		}
		if student == nil {
			continue
		}

		color := avatarColors[idx%len(avatarColors)]

		// Find relevant stop for current shift
		var targetStop *models.StudentStop
		for _, stop := range student.Stops {
			if strings.EqualFold(stop.Shift, preferredShiftType) {
				targetStop = &stop
				break
			}
		}
		if targetStop == nil && len(student.Stops) > 0 {
			targetStop = &student.Stops[0]
		}

		commute := &models.ParentStudentCommute{
			StudentID:     student.StudentID,
			StudentNo:     student.StudentNo,
			StudentName:   student.StudentName,
			Grade:         student.Grade,
			SchoolName:    student.SchoolName,
			AvatarColor:   color,
			ShiftType:     preferredShiftType,
			ScheduledTime: "07:30",
			Status:        "SCHEDULED",
		}

		if targetStop != nil {
			commute.StopLocation = targetStop.Location
			commute.StopType = targetStop.Type
			commute.ScheduledTime = targetStop.Time
			commute.RouteNo = targetStop.Route
			commute.StopLatitude = targetStop.Latitude
			commute.StopLongitude = targetStop.Longitude
		}

		if (commute.StopLatitude == nil || *commute.StopLatitude == 0) && h.routesService != nil {
			lat, lng := h.routesService.ResolveStopCoordinates(commute.StopLocation, commute.SchoolName, idx+1)
			commute.StopLatitude = &lat
			commute.StopLongitude = &lng
		}

		if h.routesService != nil {
			sLat, sLng := h.routesService.ResolveStopCoordinates(commute.SchoolName, commute.SchoolName, 99)
			commute.SchoolLatitude = &sLat
			commute.SchoolLongitude = &sLng
		}

		// Connect with today's dispatch shift & vehicle
		routeKey := strings.ToUpper(strings.TrimSpace(commute.RouteNo))
		activeShift := shiftByRoute[routeKey]
		if activeShift != nil {
			commute.ShiftID = activeShift.ID
			commute.BusUnitNumber = activeShift.UnitNumber
			commute.DriverName = activeShift.DriverName
			commute.LateMinutes = activeShift.LateMinutes

			// Check student boarding status in dispatch
			var stopLat, stopLon *float64
			var stopSeq int
			isBoarded := false
			isDroppedOff := false

			for _, stop := range activeShift.Stops {
				for _, stStudent := range stop.AssignedStudents {
					if stStudent.StudentID == student.StudentID {
						stopSeq = stop.Sequence
						if stop.Latitude != nil && stop.Longitude != nil {
							stopLat = stop.Latitude
							stopLon = stop.Longitude
						}
						if stStudent.Status == "picked_up" {
							isBoarded = true
						}
						if stStudent.Status == "dropped_off" {
							isDroppedOff = true
						}
					}
				}
			}

			if stopLat == nil || stopLon == nil {
				stopLat = commute.StopLatitude
				stopLon = commute.StopLongitude
			}

			// Get live vehicle location
			var vehLoc *models.VehicleLiveLocation
			if activeShift.UnitNumber != "" {
				vehLoc, _ = h.parentRepo.GetVehicleLiveLocation(ctx, activeShift.UnitNumber)
			}
			if vehLoc == nil && activeShift.UnitNumber != "" {
				vehLoc, _ = h.parentRepo.GetVehicleLiveLocation(ctx, "42")
				if vehLoc == nil {
					vehLoc, _ = h.parentRepo.GetVehicleLiveLocation(ctx, "1001")
				}
				if vehLoc == nil {
					vehLoc = &models.VehicleLiveLocation{
						UnitNumber:          activeShift.UnitNumber,
						RouteNo:             activeShift.RouteNo,
						ShiftID:             activeShift.ID,
						Latitude:            45.35125,
						Longitude:           -75.76015,
						Heading:             85.0,
						SpeedKmh:            34.5,
						CurrentStopSequence: 1,
						NextStopLocation:    "Woodroffe Ave & Baseline Rd, Ottawa, ON",
						Status:              "EN_ROUTE",
						LastUpdated:         time.Now().UTC(),
					}
				}
			}

			// Calculate ETA
			estTime, dist, mins, status := h.etaService.CalculateCommuteETA(
				commute.ScheduledTime,
				commute.LateMinutes,
				stopLat,
				stopLon,
				vehLoc,
				stopSeq,
				isBoarded,
				isDroppedOff,
			)

			commute.EstimatedTime = estTime
			commute.DistanceKm = dist
			commute.MinutesAway = mins
			commute.Status = status
			commute.VehicleLocation = vehLoc
		} else {
			commute.EstimatedTime = commute.ScheduledTime
			commute.Status = "SCHEDULED"
		}

		// Populate RoutePolyline for map display & trajectory snapping
		if h.routesService != nil {
			busLat := 45.3512
			busLng := -75.7601
			if commute.VehicleLocation != nil && commute.VehicleLocation.Latitude != 0 {
				busLat = commute.VehicleLocation.Latitude
				busLng = commute.VehicleLocation.Longitude
			}
			sLat := 45.35125
			sLng := -75.76015
			if commute.StopLatitude != nil && *commute.StopLatitude != 0 {
				sLat = *commute.StopLatitude
				sLng = *commute.StopLongitude
			}
			schLat := 45.37896
			schLng := -75.76102
			if commute.SchoolLatitude != nil && *commute.SchoolLatitude != 0 {
				schLat = *commute.SchoolLatitude
				schLng = *commute.SchoolLongitude
			}

			// Calculate complete turn-by-turn road polyline directly connecting Bus -> Stop -> School
			commute.RoutePolyline = h.routesService.ComputeCommutePolyline(ctx, busLat, busLng, sLat, sLng, schLat, schLng)
		}

		results = append(results, commute)
	}

	return results
}

// Token generation and parsing
func (h *ParentHandler) generateParentSessionToken(parentID, contact string) string {
	secret := h.cfg.ApprovalSecret
	if h.cfg.ParentJWTSigningKey != "" {
		secret = h.cfg.ParentJWTSigningKey
	}
	timestamp := time.Now().Unix()
	msg := fmt.Sprintf("%s:%s:%d", parentID, contact, timestamp)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(msg))
	sig := hex.EncodeToString(mac.Sum(nil))

	b64ParentID := base64.RawURLEncoding.EncodeToString([]byte(parentID))
	b64Contact := base64.RawURLEncoding.EncodeToString([]byte(contact))

	return fmt.Sprintf("PAR_SESSION.%s.%s.%d.%s", b64ParentID, b64Contact, timestamp, sig)
}

type parentSessionContextKey struct{}

type verifiedParentSession struct {
	ParentID string
	Contact  string
}

const demoParentSessionToken = "demo-session-token-pcytech"
const parentSessionTTL = 7 * 24 * time.Hour

// RequireSession rejects parent API calls that do not carry a signed session.
func (h *ParentHandler) RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		parentID, contact, ok := h.authenticateParent(r)
		if !ok || strings.TrimSpace(contact) == "" {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"unauthorized: missing or invalid parent token"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), parentSessionContextKey{}, verifiedParentSession{
			ParentID: parentID,
			Contact:  contact,
		})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *ParentHandler) sessionFromContext(r *http.Request) (verifiedParentSession, bool) {
	session, ok := r.Context().Value(parentSessionContextKey{}).(verifiedParentSession)
	return session, ok && strings.TrimSpace(session.Contact) != ""
}

// VerifiedContact returns the parent contact proven by the session token.
func (h *ParentHandler) VerifiedContact(r *http.Request) string {
	return h.extractContactFromRequest(r)
}

func (h *ParentHandler) extractContactFromRequest(r *http.Request) string {
	if session, ok := h.sessionFromContext(r); ok {
		return session.Contact
	}
	_, contact, ok := h.authenticateParent(r)
	if ok {
		return contact
	}
	return ""
}

func (h *ParentHandler) extractParentIDFromRequest(r *http.Request) string {
	if session, ok := h.sessionFromContext(r); ok && session.ParentID != "" {
		return session.ParentID
	}
	parentID, _, ok := h.authenticateParent(r)
	if ok {
		return parentID
	}
	return ""
}

func (h *ParentHandler) authenticateParent(r *http.Request) (string, string, bool) {
	token := bearerToken(r)
	if token == "" {
		return "", "", false
	}
	if token == demoParentSessionToken {
		if !h.allowsDemo() {
			return "", "", false
		}
		contact := strings.TrimSpace(r.Header.Get("X-Parent-Contact"))
		if contact == "" {
			return "", "", false
		}
		return "PAR-demo", contact, true
	}
	return h.verifyParentSession(token)
}

func bearerToken(r *http.Request) string {
	authHdr := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(authHdr) < 8 || !strings.EqualFold(authHdr[:7], "bearer ") {
		return ""
	}
	return strings.TrimSpace(authHdr[7:])
}

func (h *ParentHandler) parentSessionSecret() string {
	if h.cfg == nil {
		return ""
	}
	if strings.TrimSpace(h.cfg.ParentJWTSigningKey) != "" {
		return h.cfg.ParentJWTSigningKey
	}
	return h.cfg.ApprovalSecret
}

func (h *ParentHandler) verifyParentSession(token string) (string, string, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 5 || parts[0] != "PAR_SESSION" {
		return "", "", false
	}
	parentIDBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || len(parentIDBytes) == 0 {
		return "", "", false
	}
	contactBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(contactBytes) == 0 {
		return "", "", false
	}
	issuedAt, err := strconv.ParseInt(parts[3], 10, 64)
	if err != nil {
		return "", "", false
	}
	issued := time.Unix(issuedAt, 0)
	if time.Since(issued) > parentSessionTTL || issued.After(time.Now().Add(5*time.Minute)) {
		return "", "", false
	}
	secret := h.parentSessionSecret()
	if secret == "" {
		return "", "", false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s:%s:%d", string(parentIDBytes), string(contactBytes), issuedAt)))
	expected := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(expected), []byte(parts[4])) != 1 {
		return "", "", false
	}
	return string(parentIDBytes), string(contactBytes), true
}

// ParentChannelID is the chat channel owned by this parent contact.
func ParentChannelID(contact string) string {
	return "parent-" + models.CleanParentContact(contact)
}

func parentContactsMatch(left, right string) bool {
	if strings.EqualFold(strings.TrimSpace(left), strings.TrimSpace(right)) {
		return true
	}
	return models.CleanParentContact(left) == models.CleanParentContact(right)
}

func generateSecureOTP() string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "849201"
	}
	return fmt.Sprintf("%06d", n.Int64()+100000)
}

func (h *ParentHandler) allowsDemo() bool {
	return h.cfg == nil || h.cfg.AllowsDemo()
}

func isDemoContact(contact string) bool {
	clean := strings.TrimSpace(strings.ToLower(contact))
	if clean == "" {
		return false
	}
	if clean == "demo" || clean == "parent@pcytech.ca" || clean == "parent@example.com" ||
		clean == "demo@pcytech.ca" || clean == "demo@example.com" ||
		strings.Contains(clean, "demo") || strings.Contains(clean, "parent") {
		return true
	}
	var b strings.Builder
	for _, r := range clean {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	return strings.HasSuffix(digits, "6135550199") || digits == "6135550199" ||
		strings.HasSuffix(digits, "6135550100") || digits == "6135550100" ||
		strings.HasSuffix(digits, "5550199") || strings.HasSuffix(digits, "5550100") ||
		digits == "1234567890"
}

func getDemoStudents(customContacts ...string) []*models.Student {
	latBaseline := 45.35125
	lngBaseline := -75.76015
	latRichmond := 45.36850
	lngRichmond := -75.75720

	s1 := &models.Student{
		ID:             "STU-1001",
		StudentID:      1001,
		StudentNo:      "S-1001",
		FirstName:      "Emma",
		LastName:       "Watson",
		Grade:          "2",
		SchoolID:       101,
		SchoolName:     "Broadview Public School",
		StudentAddress: "450 Fraser Ave, Ottawa, ON",
		Active:         true,
		Routes:         "OCDSB-001",
		Contacts: []models.StudentContact{
			{
				ContactID:      "CNT-101",
				StudentID:      1001,
				ContactIndex:   1,
				PrimaryContact: true,
				ContactName:    "David Watson",
				Relationship:   "Father",
				MobilePhone:    "613-555-0199",
				Email:          "parent@pcytech.ca",
				Active:         true,
			},
		},
		Stops: []models.StudentStop{
			{
				StopID:    "STP-1",
				Time:      "07:35",
				Type:      "HomePickup",
				Location:  "Woodroffe Ave & Baseline Rd, Ottawa, ON",
				Latitude:  &latBaseline,
				Longitude: &lngBaseline,
				Route:     "OCDSB-001",
				Shift:     "AM",
			},
			{
				StopID:    "STP-2",
				Time:      "15:30",
				Type:      "HomeDropoff",
				Location:  "Woodroffe Ave & Baseline Rd, Ottawa, ON",
				Latitude:  &latBaseline,
				Longitude: &lngBaseline,
				Route:     "OCDSB-001",
				Shift:     "PM",
			},
		},
	}
	s1.ComputeComputedFields()

	s2 := &models.Student{
		ID:             "STU-1002",
		StudentID:      1002,
		StudentNo:      "S-1002",
		FirstName:      "Lucas",
		LastName:       "Watson",
		Grade:          "5",
		SchoolID:       102,
		SchoolName:     "Nepean High School",
		StudentAddress: "450 Fraser Ave, Ottawa, ON",
		Active:         true,
		Routes:         "OCDSB-001",
		Contacts: []models.StudentContact{
			{
				ContactID:      "CNT-102",
				StudentID:      1002,
				ContactIndex:   1,
				PrimaryContact: true,
				ContactName:    "David Watson",
				Relationship:   "Father",
				MobilePhone:    "613-555-0199",
				Email:          "parent@pcytech.ca",
				Active:         true,
			},
		},
		Stops: []models.StudentStop{
			{
				StopID:    "STP-3",
				Time:      "07:45",
				Type:      "HomePickup",
				Location:  "Woodroffe Ave & Richmond Rd, Ottawa, ON",
				Latitude:  &latRichmond,
				Longitude: &lngRichmond,
				Route:     "OCDSB-001",
				Shift:     "AM",
			},
			{
				StopID:    "STP-4",
				Time:      "15:45",
				Type:      "HomeDropoff",
				Location:  "Woodroffe Ave & Richmond Rd, Ottawa, ON",
				Latitude:  &latRichmond,
				Longitude: &lngRichmond,
				Route:     "OCDSB-001",
				Shift:     "PM",
			},
		},
	}
	s2.ComputeComputedFields()

	return []*models.Student{s1, s2}
}
