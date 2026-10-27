package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/bigquery"
	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	firebaseAuth "firebase.google.com/go/v4/auth"
	firebaseMessaging "firebase.google.com/go/v4/messaging"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"google.golang.org/api/option"

	"dispatch-server/internal/archiver"
	"dispatch-server/internal/auth"
	"dispatch-server/internal/config"
	"dispatch-server/internal/handlers"
	"dispatch-server/internal/mcp"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"dispatch-server/internal/services"
)

func main() {
	cfg := config.LoadConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("[INIT] %v", err)
	}
	ctx := context.Background()

	log.Printf("[INIT] Starting Dispatch API Server on port :%s", cfg.Port)
	log.Printf("[INIT] Project ID: %s, AppMode: %s, DevMode: %v", cfg.ProjectID, cfg.AppMode, cfg.IsDevelopment)

	var fsClient *firestore.Client
	var bqClient *bigquery.Client
	var authClient *firebaseAuth.Client
	var fcmClient *firebaseMessaging.Client
	var repo repository.EmployeeRepository
	var schoolRepo repository.SchoolRepository
	var schoolBoardRepo repository.SchoolBoardRepository
	var studentRepo repository.StudentRepository
	var routeRepo repository.RouteRepository
	var vehicleRepo repository.VehicleRepository
	var calendarRepo repository.CalendarRepository
	var payrollRepo repository.PayrollRepository
	var yardRepo repository.YardRepository
	var dispatchRepo repository.DispatchRepository
	var parentRepo repository.ParentRepository

	var app *firebase.App
	var err error

	saPath := config.ResolveCredentialsPath()
	if saPath != "" {
		log.Printf("[INIT] Initializing Firebase with credentials from: %s", saPath)
		opt := option.WithCredentialsFile(saPath)
		app, err = firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.ProjectID}, opt)
	} else {
		log.Printf("[INIT] No service account key file found. Attempting Application Default Credentials (ADC) for project: %s", cfg.ProjectID)
		app, err = firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.ProjectID})
	}

	if err == nil {
		authClient, _ = app.Auth(ctx)
		var errFcm error
		fcmClient, errFcm = app.Messaging(ctx)
		if errFcm != nil {
			log.Printf("[WARN] Failed to initialize Firebase Cloud Messaging client: %v", errFcm)
		} else {
			log.Println("[INIT] Connected to Firebase Cloud Messaging (FCM) successfully.")
		}
		fsClient, err = app.Firestore(ctx)
		if err == nil {
			defer fsClient.Close()
			repo = repository.NewFirestoreEmployeeRepository(fsClient)
			schoolRepo = repository.NewFirestoreSchoolRepository(fsClient)
			schoolBoardRepo = repository.NewFirestoreSchoolBoardRepository(fsClient)
			studentRepo = repository.NewFirestoreStudentRepository(fsClient)
			routeRepo = repository.NewFirestoreRouteRepository(fsClient)
			vehicleRepo = repository.NewFirestoreVehicleRepository(fsClient)
			calendarRepo = repository.NewFirestoreCalendarRepository(fsClient)
			payrollRepo = repository.NewFirestorePayrollRepository(fsClient)
			yardRepo = repository.NewFirestoreYardRepository(fsClient)
			parentRepo = repository.NewFirestoreParentRepository(fsClient)

			if saPath != "" {
				bqClient, _ = bigquery.NewClient(ctx, cfg.ProjectID, option.WithCredentialsFile(saPath))
			} else {
				bqClient, _ = bigquery.NewClient(ctx, cfg.ProjectID)
			}
			if bqClient != nil {
				defer bqClient.Close()
				log.Printf("[INIT] Connected to Google Cloud BigQuery successfully (Dataset: %s, Cold retention: %d days).", cfg.BigQueryDataset, cfg.BigQueryColdDays)
			}

			fsDispatchRepo := repository.NewFirestoreDispatchRepository(fsClient)
			if bqClient != nil {
				fsDispatchRepo.WithBigQuery(bqClient, cfg.ProjectID, cfg.BigQueryDataset, cfg.BigQueryColdDays)
			}
			dispatchRepo = fsDispatchRepo
			log.Println("[INIT] Connected to Google Cloud Firestore successfully.")
		} else {
			log.Printf("[WARN] Failed to connect to Firestore via ADC: %v", err)
		}
	} else {
		log.Printf("[WARN] Failed to initialize Firebase App via ADC: %v", err)
	}

	if fsClient == nil {
		if !cfg.AllowsDemo() {
			log.Fatal("[INIT] Production mode requires Firestore. Refusing to start on the in-memory demo database.")
		}
		log.Println("[INIT] Using in-memory fallback repository.")
		memRepo := repository.NewMemoryEmployeeRepository()
		seedMemoryData(ctx, memRepo)
		repo = memRepo
		schoolRepo = repository.NewMemorySchoolRepository()
		schoolBoardRepo = repository.NewMemorySchoolBoardRepository()
		studentRepo = repository.NewMemoryStudentRepository()
		routeRepo = repository.NewMemoryRouteRepository()
		vehicleRepo = repository.NewInMemoryVehicleRepository()
		calendarRepo = repository.NewMemoryCalendarRepository()
		payrollRepo = repository.NewMemoryPayrollRepository()
		yardRepo = repository.NewMemoryYardRepository()
		dispatchRepo = repository.NewMemoryDispatchRepository()
		parentRepo = repository.NewMemoryParentRepository()
		seedMemoryParentAndStudentData(ctx, studentRepo, parentRepo, dispatchRepo)
	}

	// Router setup
	r := chi.NewRouter()

	// Middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS for frontend React app and Flutter driver app
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-User-Role", "X-Admin-Secret", "X-User-Id", "X-Parent-Contact"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Auth, Employee, School, Student, Route & Vehicle handlers
	authHandler := handlers.NewAuthHandler(repo, authClient, cfg)
	authenticator := auth.NewAuthenticator(authClient, cfg.AllowsDemo()).
		WithMCPTokenSecret(cfg.MCPTokenSecret).
		WithUserResolver(authHandler.ResolveEmployeeAuthUser)
	empHandler := handlers.NewEmployeeHandler(repo, authClient, cfg.AllowsDemo())
	schoolHandler := handlers.NewSchoolHandler(schoolRepo, schoolBoardRepo)
	studentHandler := handlers.NewStudentHandler(studentRepo)
	routeHandler := handlers.NewRouteHandler(routeRepo)
	vehicleHandler := handlers.NewVehicleHandler(vehicleRepo)
	calendarHandler := handlers.NewCalendarHandler(calendarRepo)
	payrollHandler := handlers.NewPayrollHandler(payrollRepo, schoolBoardRepo, routeRepo, repo)
	yardHandler := handlers.NewYardHandler(yardRepo)
	dispatchHandler := handlers.NewDispatchHandler(dispatchRepo, cfg.AllowsDemo())
	bambooSvc := services.NewBambooHRService(services.NewBambooHRStore(fsClient))
	bambooHandler := handlers.NewBambooHRHandler(bambooSvc)
	zonarSvc := services.NewZonarService(services.NewZonarStore(fsClient))
	busplannerSvc := services.NewBusPlannerService(services.NewBusPlannerStore(fsClient))
	if fsClient != nil {
		busplannerSvc.SetLiveStore(services.NewFirestoreStagingLive(fsClient))
	}
	busplannerSvc.AllowStagingSimulation(cfg.AllowsDemo())
	busplannerHandler := handlers.NewBusPlannerHandler(busplannerSvc)
	zonarSvc.UseVehicles(vehicleRepo)
	zonarSvc.UseRoutes(func(ctx context.Context, day string) (map[string]string, error) {
		shifts, err := dispatchRepo.ListShifts(ctx, day, repository.DispatchFilter{})
		if err != nil {
			return nil, err
		}
		routes := map[string]string{}
		for _, shift := range shifts {
			unit := models.NormalizeFleetUnit(shift.UnitNumber)
			routeNo := strings.ToUpper(strings.TrimSpace(shift.RouteNo))
			if unit == "" || routeNo == "" {
				continue
			}
			if _, exists := routes[unit]; !exists {
				routes[unit] = routeNo
			}
		}
		return routes, nil
	})
	zonarHandler := handlers.NewZonarHandler(zonarSvc)

	var chatRepo repository.ChatRepository
	if fsClient != nil {
		chatRepo = repository.NewFirestoreChatRepository(fsClient, fcmClient, repo, dispatchRepo, routeRepo, yardRepo)
		_ = chatRepo.EnsureDefaultChannels(ctx)
	} else {
		chatRepo = repository.NewMemoryChatRepository(repo, dispatchRepo)
	}
	chatHandler := handlers.NewChatHandler(chatRepo, repo)

	aiToolService := services.NewAIToolService(dispatchRepo, repo, routeRepo, vehicleRepo, payrollRepo, studentRepo)
	aiService := services.NewAIService(aiToolService)
	aiHandler := handlers.NewAIHandler(aiService)
	mcpServer := mcp.NewServer(aiToolService, dispatchRepo, repo)
	mcpHandler := handlers.NewMCPHandler(mcpServer)

	// Amazon SES & SNS Inbound/Outbound Email services for time-off requests
	emailService := services.NewEmailService(cfg)
	inboundEmailService := services.NewInboundEmailService(cfg, dispatchRepo, repo, emailService)
	snsWebhookHandler := handlers.NewSNSWebhookHandler(cfg, inboundEmailService, emailService, dispatchRepo, repo)

	// Parent App, Google Maps Routes & Twilio SMS Services and Handlers
	twilioService := services.NewTwilioService(cfg)
	etaService := services.NewETAService()
	googleRoutesService := services.NewGoogleRoutesService(cfg)
	parentHandler := handlers.NewParentHandler(cfg, studentRepo, parentRepo, dispatchRepo, routeRepo, twilioService, emailService, etaService, googleRoutesService)
	twilioWebhookHandler := handlers.NewTwilioWebhookHandler(cfg, studentRepo, dispatchRepo, parentRepo, twilioService, etaService)

	// Health check for Cloud Run
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","mode":"%s","time":"%s"}`, cfg.AppMode, time.Now().Format(time.RFC3339))
	})

	// Demo keeps these open for the public walkthrough. Production requires the admin secret.
	if cfg.AllowsDemo() {
		r.Post("/api/auth/setup-admin", authHandler.SetupAdmin)
		r.Post("/api/auth/sync-employee-users", authHandler.SyncEmployeeUsers)
	} else {
		r.With(adminSecretMiddleware(cfg.AdminAPISecret)).Post("/api/auth/setup-admin", authHandler.SetupAdmin)
		r.With(adminSecretMiddleware(cfg.AdminAPISecret)).Post("/api/auth/sync-employee-users", authHandler.SyncEmployeeUsers)
	}
	r.Get("/api/auth/resolve-username", authHandler.ResolveUsername)
	r.Post("/api/auth/login", authHandler.Login)
	r.Post("/api/public/auth/login", authHandler.Login)
	r.Post("/api/auth/mcp-login", authHandler.LoginMCP)

	// File uploads & static file serving
	_ = handlers.EnsureUploadDir()
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(handlers.UploadDir))))
	r.Post("/api/upload", handlers.UploadFileHandler)
	r.Post("/api/public/upload", handlers.UploadFileHandler)

	// Device Registration for FCM Push Notifications
	r.Post("/api/public/devices/register", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var body struct {
			EmployeeID string `json:"employeeId"`
			Token      string `json:"token"`
			Platform   string `json:"platform"`
			DeviceName string `json:"deviceName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(body.EmployeeID) == "" || strings.TrimSpace(body.Token) == "" {
			http.Error(w, `{"error":"employeeId and token are required"}`, http.StatusBadRequest)
			return
		}
		if body.Platform == "" {
			body.Platform = "unknown"
		}

		err := repo.RegisterDeviceToken(r.Context(), strings.TrimSpace(body.EmployeeID), models.DeviceToken{
			Token:      strings.TrimSpace(body.Token),
			Platform:   body.Platform,
			DeviceName: body.DeviceName,
		})
		if err != nil {
			log.Printf("[FCM] Failed to register device token for employee %s: %v", body.EmployeeID, err)
			http.Error(w, fmt.Sprintf(`{"error":"failed to register device token: %v"}`, err), http.StatusInternalServerError)
			return
		}
		log.Printf("[FCM] Registered device token for employee %s (%s, %s)", body.EmployeeID, body.Platform, body.DeviceName)
		w.Write([]byte(`{"success":true,"message":"device token registered successfully"}`))
	})

	// Amazon SES & SNS Inbound Email Webhook & One-Click HR Actions
	r.Post("/api/integrations/sns/inbound-email", snsWebhookHandler.HandleSNSInboundEmail)
	r.Get("/api/public/timeoff/quick-action", snsWebhookHandler.HandleQuickAction)

	// Twilio Two-Way Inbound SMS Webhook
	r.Post("/api/integrations/twilio/sms-inbound", twilioWebhookHandler.HandleTwilioInboundSMS)

	// BambooHR employee-change webhook. The path key is not the BambooHR API key.
	r.Post("/api/bamboohr/webhook/{apikey}", bambooHandler.ReceiveWebhook)

	// Parent App API Routes
	r.Route("/api/parent", func(parentRouter chi.Router) {
		parentRouter.Post("/auth/request-otp", parentHandler.RequestOTP)
		parentRouter.Post("/auth/verify-otp", parentHandler.VerifyOTP)
		parentRouter.Post("/auth/register", parentHandler.Register)
		parentRouter.Get("/students", parentHandler.ListMyStudents)
		parentRouter.Get("/bus-tracking/{unitNumber}", parentHandler.GetVehicleTracking)
		parentRouter.Get("/preferences", parentHandler.GetPreferences)
		parentRouter.Put("/preferences", parentHandler.SavePreferences)
		parentRouter.Post("/devices/register", parentHandler.RegisterDevice)
		parentRouter.Post("/absence", dispatchHandler.RecordStudentAbsence)
		parentRouter.Get("/profile", parentHandler.GetProfile)
		parentRouter.Put("/profile", parentHandler.UpdateProfile)
	})
	r.Post("/api/public/bus-tracking/telemetry", parentHandler.UpdateVehicleTelemetry)

	// Protected Routes (Or dev bypass)
	r.Group(func(protected chi.Router) {
		protected.Use(authenticator.Middleware)

		// Auth info
		protected.Get("/api/auth/me", authHandler.Me)

		// Employee routes
		protected.Get("/api/employees", empHandler.List)
		protected.Get("/api/employees/stats", empHandler.Stats)
		protected.Get("/api/employees/{id}", empHandler.Get)
		protected.Post("/api/employees", empHandler.Create)
		protected.Put("/api/employees/{id}", empHandler.Update)
		protected.Delete("/api/employees/{id}", empHandler.Delete)

		// School routes
		protected.Get("/api/schools", schoolHandler.List)
		protected.Get("/api/schools/{id}", schoolHandler.GetByID)
		protected.Post("/api/schools", schoolHandler.Create)
		protected.Put("/api/schools/{id}", schoolHandler.Update)
		protected.Delete("/api/schools/{id}", schoolHandler.Delete)

		// School Board routes
		protected.Get("/api/school-boards", schoolHandler.ListBoards)
		protected.Post("/api/school-boards", schoolHandler.CreateBoard)
		protected.Put("/api/school-boards/{id}", schoolHandler.UpdateBoard)
		protected.Delete("/api/school-boards/{id}", schoolHandler.DeleteBoard)

		// Student routes
		protected.Get("/api/students", studentHandler.List)
		protected.Get("/api/students/stats", studentHandler.Stats)
		protected.Get("/api/students/{id}", studentHandler.GetByID)
		protected.Post("/api/students", studentHandler.Create)
		protected.Put("/api/students/{id}", studentHandler.Update)
		protected.Delete("/api/students/{id}", studentHandler.Delete)

		// Route & Shift routes
		protected.Get("/api/routes", routeHandler.ListRoutes)
		protected.Get("/api/routes/stats", routeHandler.Stats)
		protected.Get("/api/routes/{id}", routeHandler.GetRoute)
		protected.Get("/api/routes/{id}/shifts", routeHandler.ListRouteShifts)
		protected.Get("/api/shifts/{id}", routeHandler.GetShift)
		protected.Put("/api/shifts/{id}", routeHandler.UpdateShift)
		protected.Put("/api/routes/{id}", routeHandler.UpdateRoute)
		protected.Put("/api/routes/{id}/crew", routeHandler.AssignCrew)

		// Vehicle Fleet routes
		protected.Get("/api/vehicles", vehicleHandler.ListVehicles)
		protected.Get("/api/vehicles/stats", vehicleHandler.GetStats)
		protected.Get("/api/vehicles/{id}", vehicleHandler.GetVehicle)
		protected.Post("/api/vehicles", vehicleHandler.CreateVehicle)
		protected.Put("/api/vehicles/{id}", vehicleHandler.UpdateVehicle)
		protected.Delete("/api/vehicles/{id}", vehicleHandler.DeleteVehicle)

		// School Calendar routes
		protected.Get("/api/calendars", calendarHandler.Get)
		protected.Post("/api/calendars", calendarHandler.Save)
		protected.Put("/api/calendars/{id}", calendarHandler.Save)
		protected.Delete("/api/calendars/school", calendarHandler.DeleteSchoolCustom)
		protected.Get("/api/calendars/all", calendarHandler.List)

		// Payroll Base Rates & Custom Overrides
		protected.Get("/api/payroll-rates", payrollHandler.List)
		protected.Get("/api/payroll-rates/school-boards", payrollHandler.GetSchoolBoardBaseRates)
		protected.Get("/api/payroll-rates/custom", payrollHandler.GetCustomRates)
		protected.Get("/api/payroll-rates/lookups", payrollHandler.GetLookups)
		protected.Get("/api/payroll-rates/{id}", payrollHandler.GetByID)
		protected.Post("/api/payroll-rates", payrollHandler.Create)
		protected.Put("/api/payroll-rates/{id}", payrollHandler.Update)
		protected.Delete("/api/payroll-rates/{id}", payrollHandler.Delete)
		protected.Post("/api/payroll-rates/calculate", payrollHandler.Calculate)

		// Yard routes
		protected.Get("/api/yards", yardHandler.List)
		protected.Get("/api/yards/stats", yardHandler.Stats)
		protected.Get("/api/yards/{id}", yardHandler.GetByID)
		protected.Post("/api/yards", yardHandler.Create)
		protected.Put("/api/yards/{id}", yardHandler.Update)
		protected.Delete("/api/yards/{id}", yardHandler.Delete)
		protected.Post("/api/yards/assign-route", yardHandler.AssignRoute)
		protected.Post("/api/yards/unassign-route/{routeId}", yardHandler.UnassignRoute)
		protected.Post("/api/yards/assign-school", yardHandler.AssignSchool)
		protected.Post("/api/yards/unassign-school/{schoolId}", yardHandler.UnassignSchool)

		// Dispatch Workbench routes
		protected.Post("/api/dispatch/create-day", dispatchHandler.CreateDay)
		protected.Delete("/api/dispatch/delete-day", dispatchHandler.DeleteDay)
		protected.Get("/api/dispatch/shifts", dispatchHandler.ListShifts)
		protected.Get("/api/dispatch/shifts/{id}", dispatchHandler.GetShift)
		protected.Put("/api/dispatch/shifts/{id}", dispatchHandler.UpdateShift)
		protected.Post("/api/dispatch/shifts/{id}/split", dispatchHandler.SplitShift)
		protected.Put("/api/dispatch/shifts/{id}/stops/{stopId}/arrive", dispatchHandler.RecordStopArrival)
		protected.Put("/api/dispatch/shifts/{id}/stops/{stopId}/students/{studentId}", dispatchHandler.UpdateStudentStatus)
		protected.Post("/api/dispatch/students/absence", dispatchHandler.RecordStudentAbsence)
		protected.Get("/api/dispatch/students/absences", dispatchHandler.ListStudentAbsences)
		protected.Delete("/api/dispatch/students/absences/{id}", dispatchHandler.CancelStudentAbsence)
		protected.Put("/api/dispatch/shifts/{id}/check-in", dispatchHandler.CheckInDriver)
		protected.Get("/api/dispatch/payroll-settings", dispatchHandler.GetPayrollSettings)
		protected.Put("/api/dispatch/payroll-settings", dispatchHandler.SavePayrollSettings)
		protected.Get("/api/dispatch/check-in-reminder-settings", dispatchHandler.GetCheckInReminderSettings)
		protected.Put("/api/dispatch/check-in-reminder-settings", dispatchHandler.SaveCheckInReminderSettings)
		protected.Get("/api/dispatch/simulation-settings", dispatchHandler.GetSimulationSettings)
		protected.Put("/api/dispatch/simulation-settings", dispatchHandler.SaveSimulationSettings)
		protected.Post("/api/dispatch/simulation/run", dispatchHandler.RunSimulation)
		protected.Get("/api/busplanner/staging/routes", busplannerHandler.ListStagingRoutes)
		protected.Post("/api/busplanner/staging/routes/{id}/copy", busplannerHandler.CopyStagingRoute)
		protected.With(auth.RequireRole("admin")).Get("/api/busplanner/settings", busplannerHandler.GetSettings)
		protected.With(auth.RequireRole("admin")).Put("/api/busplanner/settings", busplannerHandler.SaveSettings)
		protected.With(auth.RequireRole("admin")).Post("/api/busplanner/sync", busplannerHandler.SyncNow)
		protected.With(auth.RequireRole("admin")).Get("/api/bamboohr/settings", bambooHandler.GetSettings)
		protected.With(auth.RequireRole("admin")).Put("/api/bamboohr/settings", bambooHandler.SaveSettings)
		protected.With(auth.RequireRole("admin")).Post("/api/bamboohr/test", bambooHandler.TestSync)
		protected.With(auth.RequireRole("admin")).Post("/api/bamboohr/sync", bambooHandler.SyncNow)
		protected.With(auth.RequireRole("admin")).Get("/api/bamboohr/webhook-events", bambooHandler.ListWebhookEvents)
		protected.With(auth.RequireRole("admin")).Get("/api/zonar/settings", zonarHandler.GetSettings)
		protected.With(auth.RequireRole("admin")).Put("/api/zonar/settings", zonarHandler.SaveSettings)
		protected.With(auth.RequireRole("admin")).Post("/api/zonar/test", zonarHandler.TestSync)
		protected.With(auth.RequireRole("admin")).Post("/api/zonar/sync-serials", zonarHandler.SyncSerials)
		protected.With(auth.RequireRole("admin")).Post("/api/zonar/route-preview", zonarHandler.PreviewRouteWriteBack)
		protected.With(auth.RequireRole("admin")).Get("/api/zonar/positions/{unitNumber}", zonarHandler.GetPosition)
		protected.Get("/api/zonar/enabled", zonarHandler.GetSyncEnabled)
		protected.Get("/api/zonar/vehicles/{vehicleId}/trace", zonarHandler.GetVehicleTrace)
		protected.Get("/api/zonar/vehicles/{vehicleId}/idles", zonarHandler.GetVehicleIdles)
		protected.Get("/api/dispatch/change-logs", dispatchHandler.ListChangeLogs)
		protected.Post("/api/dispatch/change-logs", dispatchHandler.CreateChangeLog)
		protected.Get("/api/dispatch/audit-logs", dispatchHandler.ListSystemAuditLogs)
		protected.Get("/api/dispatch/route-change-logs", dispatchHandler.ListSystemAuditLogs)
		protected.Get("/api/dispatch/entity-operation-logs", dispatchHandler.ListSystemAuditLogs)
		protected.Get("/api/dispatch/payroll-operation-logs", dispatchHandler.ListSystemAuditLogs)
		protected.Get("/api/dispatch/operational-safety-logs", dispatchHandler.ListSystemAuditLogs)
		protected.Get("/api/dispatch/payrolls", dispatchHandler.ListDispatchPayrolls)
		protected.Post("/api/dispatch/payrolls/generate", dispatchHandler.GenerateDispatchPayroll)
		protected.Delete("/api/dispatch/payrolls/{shiftId}/{role}", dispatchHandler.DeleteDispatchPayroll)
		protected.Post("/api/dispatch/shifts/{id}/check-out", dispatchHandler.CheckOutCrew)
		protected.Post("/api/dispatch/payrolls/{id}/approve", dispatchHandler.ApproveDispatchPayroll)
		protected.Post("/api/dispatch/payrolls/{id}/reject", dispatchHandler.RejectDispatchPayroll)
		protected.Get("/api/dispatch/payroll-logs", dispatchHandler.ListPayrollDepartmentLogs)
		protected.Put("/api/dispatch/payroll-logs/{id}", dispatchHandler.UpdatePayrollDepartmentLog)
		protected.Get("/api/dispatch/temporary-assignments", dispatchHandler.ListTemporaryAssignments)
		protected.Get("/api/dispatch/temporary-assignments/{id}", dispatchHandler.GetTemporaryAssignmentByID)
		protected.Post("/api/dispatch/temporary-assignments", dispatchHandler.CreateTemporaryAssignment)
		protected.Put("/api/dispatch/temporary-assignments/{id}", dispatchHandler.UpdateTemporaryAssignment)
		protected.Delete("/api/dispatch/temporary-assignments/{id}", dispatchHandler.DeleteTemporaryAssignment)
		protected.Get("/api/dispatch/time-off-requests", dispatchHandler.ListTimeOffRequests)
		protected.Get("/api/dispatch/time-off-requests/{id}", dispatchHandler.GetTimeOffRequestByID)
		protected.Post("/api/dispatch/time-off-requests", dispatchHandler.CreateTimeOffRequest)
		protected.Put("/api/dispatch/time-off-requests/{id}", dispatchHandler.UpdateTimeOffRequest)
		protected.Post("/api/dispatch/time-off-requests/{id}/approve", dispatchHandler.ApproveTimeOffRequest)
		protected.Post("/api/dispatch/time-off-requests/{id}/reject", dispatchHandler.RejectTimeOffRequest)
		protected.Post("/api/dispatch/time-off-requests/{id}/cancel", dispatchHandler.CancelTimeOffRequest)
		protected.Delete("/api/dispatch/time-off-requests/{id}", dispatchHandler.DeleteTimeOffRequest)

		// Training Courses & Types
		protected.Get("/api/dispatch/training/courses", dispatchHandler.ListTrainingCourses)
		protected.Get("/api/dispatch/training/courses/{id}", dispatchHandler.GetTrainingCourseByID)
		protected.Post("/api/dispatch/training/courses", dispatchHandler.CreateTrainingCourse)
		protected.Put("/api/dispatch/training/courses/{id}", dispatchHandler.UpdateTrainingCourse)
		protected.Post("/api/dispatch/training/courses/{id}/publish", dispatchHandler.PublishTrainingCourse)
		protected.Post("/api/dispatch/training/courses/{id}/cancel", dispatchHandler.CancelTrainingCourse)
		protected.Post("/api/dispatch/training/courses/{id}/complete", dispatchHandler.CompleteTrainingCourse)
		protected.Delete("/api/dispatch/training/courses/{id}", dispatchHandler.DeleteTrainingCourse)
		protected.Post("/api/dispatch/training/courses/{id}/attendees", dispatchHandler.RegisterAttendee)
		protected.Put("/api/dispatch/training/courses/{id}/attendees/{regId}", dispatchHandler.UpdateAttendeeStatus)
		protected.Delete("/api/dispatch/training/courses/{id}/attendees/{regId}", dispatchHandler.CancelRegistration)
		protected.Get("/api/dispatch/training/types", dispatchHandler.ListTrainingTypes)
		protected.Post("/api/dispatch/training/types", dispatchHandler.CreateTrainingType)
		protected.Put("/api/dispatch/training/types/{id}", dispatchHandler.UpdateTrainingType)

		// Pre-Trip Inspections
		protected.Post("/api/dispatch/pretrip-inspections", dispatchHandler.CreatePreTripInspection)
		protected.Get("/api/dispatch/pretrip-inspections/today/{vehicleUnit}", dispatchHandler.GetPreTripInspectionToday)
		protected.Get("/api/dispatch/pretrip-inspections", dispatchHandler.ListPreTripInspections)

		// Vehicle Defect Reports
		protected.Post("/api/dispatch/vehicle-defects", dispatchHandler.CreateDefectReport)
		protected.Get("/api/dispatch/vehicle-defects/{id}", dispatchHandler.GetDefectReport)
		protected.Get("/api/dispatch/vehicle-defects", dispatchHandler.ListDefectReports)
		protected.Patch("/api/dispatch/vehicle-defects/{id}/assessment", dispatchHandler.UpdateDefectAssessment)
		protected.Patch("/api/dispatch/vehicle-defects/{id}/status", dispatchHandler.UpdateDefectStatus)

		// Student Incident Reports
		protected.Post("/api/dispatch/student-incidents", dispatchHandler.CreateStudentIncident)
		protected.Get("/api/dispatch/student-incidents/{id}", dispatchHandler.GetStudentIncident)
		protected.Get("/api/dispatch/student-incidents", dispatchHandler.ListStudentIncidents)
		protected.Patch("/api/dispatch/student-incidents/{id}/office-review", dispatchHandler.UpdateStudentIncidentOfficeFollowUp)
		protected.Patch("/api/dispatch/student-incidents/{id}/status", dispatchHandler.UpdateStudentIncidentStatus)

		// Expense Reimbursements
		protected.Get("/api/dispatch/expense-categories", dispatchHandler.ListExpenseCategories)
		protected.Post("/api/dispatch/expense-reimbursements", dispatchHandler.CreateExpenseClaim)
		protected.Get("/api/dispatch/expense-reimbursements/{id}", dispatchHandler.GetExpenseClaim)
		protected.Get("/api/dispatch/expense-reimbursements", dispatchHandler.ListExpenseClaims)
		protected.Post("/api/dispatch/expense-reimbursements/{id}/review", dispatchHandler.ReviewExpenseClaim)
		protected.Post("/api/dispatch/expense-reimbursements/{id}/cancel", dispatchHandler.CancelExpenseClaim)

		// Hazard & Near-Miss Reports
		protected.Post("/api/dispatch/hazard-reports", dispatchHandler.CreateHazardReport)
		protected.Get("/api/dispatch/hazard-reports/{id}", dispatchHandler.GetHazardReport)
		protected.Get("/api/dispatch/hazard-reports", dispatchHandler.ListHazardReports)
		protected.Patch("/api/dispatch/hazard-reports/{id}/office-evaluation", dispatchHandler.UpdateHazardReportOffice)

		// Route Assessments
		protected.Post("/api/dispatch/route-assessments", dispatchHandler.CreateRouteAssessment)
		protected.Get("/api/dispatch/route-assessments/{id}", dispatchHandler.GetRouteAssessment)
		protected.Get("/api/dispatch/route-assessments", dispatchHandler.ListRouteAssessments)
		protected.Patch("/api/dispatch/route-assessments/{id}/office", dispatchHandler.UpdateRouteAssessmentOffice)
		protected.Put("/api/dispatch/route-assessments/{id}", dispatchHandler.UpdateRouteAssessment)
		protected.Delete("/api/dispatch/route-assessments/{id}", dispatchHandler.DeleteRouteAssessment)

		// Vehicle Sign-Outs / Handovers (Fleet role only)
		protected.Post("/api/dispatch/vehicle-signouts", dispatchHandler.CreateVehicleSignout)
		protected.Get("/api/dispatch/vehicle-signouts/{id}", dispatchHandler.GetVehicleSignout)
		protected.Get("/api/dispatch/vehicle-signouts", dispatchHandler.ListVehicleSignouts)
		protected.Put("/api/dispatch/vehicle-signouts/{id}", dispatchHandler.UpdateVehicleSignout)
		protected.Delete("/api/dispatch/vehicle-signouts/{id}", dispatchHandler.DeleteVehicleSignout)

		// Chat & Messaging routes
		protected.Get("/api/chat/channels", chatHandler.ListChannels)
		protected.Get("/api/chat/channels/{id}", chatHandler.GetChannel)
		protected.Post("/api/chat/channels/direct", chatHandler.CreateOrGetDirectChannel)
		protected.Post("/api/chat/channels/parent", chatHandler.CreateOrGetParentChannel)
		protected.Get("/api/chat/channels/{id}/messages", chatHandler.ListMessages)
		protected.Post("/api/chat/channels/{id}/messages", chatHandler.SendMessage)
		protected.Get("/api/chat/contacts", chatHandler.ListContacts)
		protected.Get("/api/chat/display-name", chatHandler.GetMyDisplayName)

		// AI Dispatch Copilot routes
		protected.Post("/api/ai/chat", aiHandler.ProcessChat)
		protected.Get("/api/ai/status", aiHandler.GetStatus)

		// MCP Server & Personal Access Token routes (Authenticated & RBAC enforced on API server)
		protected.Post("/api/auth/mcp-token", authHandler.IssueMCPToken)
		protected.Get("/api/mcp", mcpHandler.HandleHTTP)
		protected.Post("/api/mcp", mcpHandler.HandleHTTP)
		protected.Get("/api/mcp/sse", mcpHandler.HandleSSE)
		protected.Post("/api/mcp/message", mcpHandler.HandleSSEMessage)
	})

	// Public fallback for read-only preview in dev mode if requested
	r.Group(func(publicDev chi.Router) {
		publicDev.Get("/api/public/employees", empHandler.List)
		publicDev.Get("/api/public/employees/stats", empHandler.Stats)
		publicDev.Get("/api/public/schools", schoolHandler.List)
		publicDev.Get("/api/public/students", studentHandler.List)
		publicDev.Get("/api/public/students/stats", studentHandler.Stats)
		publicDev.Get("/api/public/routes", routeHandler.ListRoutes)
		publicDev.Get("/api/public/routes/stats", routeHandler.Stats)
		publicDev.Get("/api/public/routes/{id}", routeHandler.GetRoute)
		publicDev.Get("/api/public/routes/{id}/shifts", routeHandler.ListRouteShifts)
		publicDev.Put("/api/public/shifts/{id}", routeHandler.UpdateShift)
		publicDev.Put("/api/public/routes/{id}", routeHandler.UpdateRoute)
		publicDev.Get("/api/public/vehicles", vehicleHandler.ListVehicles)
		publicDev.Get("/api/public/vehicles/stats", vehicleHandler.GetStats)
		publicDev.Get("/api/public/vehicles/{id}", vehicleHandler.GetVehicle)

		// School Calendar public routes
		publicDev.Get("/api/public/calendars", calendarHandler.Get)
		publicDev.Post("/api/public/calendars", calendarHandler.Save)
		publicDev.Put("/api/public/calendars/{id}", calendarHandler.Save)
		publicDev.Delete("/api/public/calendars/school", calendarHandler.DeleteSchoolCustom)
		publicDev.Get("/api/public/calendars/all", calendarHandler.List)

		// Payroll Base Rates public dev routes
		publicDev.Get("/api/public/payroll-rates", payrollHandler.List)
		publicDev.Get("/api/public/payroll-rates/school-boards", payrollHandler.GetSchoolBoardBaseRates)
		publicDev.Get("/api/public/payroll-rates/custom", payrollHandler.GetCustomRates)
		publicDev.Get("/api/public/payroll-rates/lookups", payrollHandler.GetLookups)
		publicDev.Get("/api/public/payroll-rates/{id}", payrollHandler.GetByID)
		publicDev.Post("/api/public/payroll-rates", payrollHandler.Create)
		publicDev.Put("/api/public/payroll-rates/{id}", payrollHandler.Update)
		publicDev.Delete("/api/public/payroll-rates/{id}", payrollHandler.Delete)
		publicDev.Post("/api/public/payroll-rates/calculate", payrollHandler.Calculate)

		// Yard public dev routes
		publicDev.Get("/api/public/yards", yardHandler.List)
		publicDev.Get("/api/public/yards/stats", yardHandler.Stats)
		publicDev.Get("/api/public/yards/{id}", yardHandler.GetByID)
		publicDev.Post("/api/public/yards", yardHandler.Create)
		publicDev.Put("/api/public/yards/{id}", yardHandler.Update)
		publicDev.Delete("/api/public/yards/{id}", yardHandler.Delete)
		publicDev.Post("/api/public/yards/assign-route", yardHandler.AssignRoute)
		publicDev.Post("/api/public/yards/unassign-route/{routeId}", yardHandler.UnassignRoute)
		publicDev.Post("/api/public/yards/assign-school", yardHandler.AssignSchool)
		publicDev.Post("/api/public/yards/unassign-school/{schoolId}", yardHandler.UnassignSchool)

		// Dispatch Workbench public dev routes
		publicDev.Post("/api/public/dispatch/create-day", dispatchHandler.CreateDay)
		publicDev.Delete("/api/public/dispatch/delete-day", dispatchHandler.DeleteDay)
		publicDev.Get("/api/public/dispatch/shifts", dispatchHandler.ListShifts)
		publicDev.Get("/api/public/dispatch/shifts/{id}", dispatchHandler.GetShift)
		publicDev.Put("/api/public/dispatch/shifts/{id}", dispatchHandler.UpdateShift)
		publicDev.Post("/api/public/dispatch/shifts/{id}/split", dispatchHandler.SplitShift)
		publicDev.Put("/api/public/dispatch/shifts/{id}/stops/{stopId}/arrive", dispatchHandler.RecordStopArrival)
		publicDev.Put("/api/public/dispatch/shifts/{id}/stops/{stopId}/students/{studentId}", dispatchHandler.UpdateStudentStatus)
		publicDev.Post("/api/public/dispatch/students/absence", dispatchHandler.RecordStudentAbsence)
		publicDev.Get("/api/public/dispatch/students/absences", dispatchHandler.ListStudentAbsences)
		publicDev.Delete("/api/public/dispatch/students/absences/{id}", dispatchHandler.CancelStudentAbsence)
		publicDev.Put("/api/public/dispatch/shifts/{id}/check-in", dispatchHandler.CheckInDriver)
		publicDev.Get("/api/public/dispatch/payroll-settings", dispatchHandler.GetPayrollSettings)
		publicDev.Put("/api/public/dispatch/payroll-settings", dispatchHandler.SavePayrollSettings)
		publicDev.Get("/api/public/dispatch/check-in-reminder-settings", dispatchHandler.GetCheckInReminderSettings)
		publicDev.Put("/api/public/dispatch/check-in-reminder-settings", dispatchHandler.SaveCheckInReminderSettings)
		publicDev.Get("/api/public/dispatch/simulation-settings", dispatchHandler.GetSimulationSettings)
		publicDev.Put("/api/public/dispatch/simulation-settings", dispatchHandler.SaveSimulationSettings)
		publicDev.Post("/api/public/dispatch/simulation/run", dispatchHandler.RunSimulation)
		publicDev.Get("/api/public/dispatch/change-logs", dispatchHandler.ListChangeLogs)
		publicDev.Post("/api/public/dispatch/change-logs", dispatchHandler.CreateChangeLog)
		publicDev.Get("/api/public/dispatch/audit-logs", dispatchHandler.ListSystemAuditLogs)
		publicDev.Get("/api/public/dispatch/route-change-logs", dispatchHandler.ListSystemAuditLogs)
		publicDev.Get("/api/public/dispatch/entity-operation-logs", dispatchHandler.ListSystemAuditLogs)
		publicDev.Get("/api/public/dispatch/payroll-operation-logs", dispatchHandler.ListSystemAuditLogs)
		publicDev.Get("/api/public/dispatch/operational-safety-logs", dispatchHandler.ListSystemAuditLogs)
		publicDev.Get("/api/public/dispatch/payrolls", dispatchHandler.ListDispatchPayrolls)
		publicDev.Post("/api/public/dispatch/payrolls/generate", dispatchHandler.GenerateDispatchPayroll)
		publicDev.Delete("/api/public/dispatch/payrolls/{shiftId}/{role}", dispatchHandler.DeleteDispatchPayroll)
		publicDev.Post("/api/public/dispatch/shifts/{id}/check-out", dispatchHandler.CheckOutCrew)
		publicDev.Post("/api/public/dispatch/payrolls/{id}/approve", dispatchHandler.ApproveDispatchPayroll)
		publicDev.Post("/api/public/dispatch/payrolls/{id}/reject", dispatchHandler.RejectDispatchPayroll)
		publicDev.Get("/api/public/dispatch/payroll-logs", dispatchHandler.ListPayrollDepartmentLogs)
		publicDev.Put("/api/public/dispatch/payroll-logs/{id}", dispatchHandler.UpdatePayrollDepartmentLog)
		publicDev.Get("/api/public/dispatch/temporary-assignments", dispatchHandler.ListTemporaryAssignments)
		publicDev.Get("/api/public/dispatch/temporary-assignments/{id}", dispatchHandler.GetTemporaryAssignmentByID)
		publicDev.Post("/api/public/dispatch/temporary-assignments", dispatchHandler.CreateTemporaryAssignment)
		publicDev.Put("/api/public/dispatch/temporary-assignments/{id}", dispatchHandler.UpdateTemporaryAssignment)
		publicDev.Delete("/api/public/dispatch/temporary-assignments/{id}", dispatchHandler.DeleteTemporaryAssignment)
		publicDev.Get("/api/public/dispatch/time-off-requests", dispatchHandler.ListTimeOffRequests)
		publicDev.Get("/api/public/dispatch/time-off-requests/{id}", dispatchHandler.GetTimeOffRequestByID)
		publicDev.Post("/api/public/dispatch/time-off-requests", dispatchHandler.CreateTimeOffRequest)
		publicDev.Put("/api/public/dispatch/time-off-requests/{id}", dispatchHandler.UpdateTimeOffRequest)
		publicDev.Post("/api/public/dispatch/time-off-requests/{id}/approve", dispatchHandler.ApproveTimeOffRequest)
		publicDev.Post("/api/public/dispatch/time-off-requests/{id}/reject", dispatchHandler.RejectTimeOffRequest)
		publicDev.Post("/api/public/dispatch/time-off-requests/{id}/cancel", dispatchHandler.CancelTimeOffRequest)
		publicDev.Delete("/api/public/dispatch/time-off-requests/{id}", dispatchHandler.DeleteTimeOffRequest)

		// Training Courses & Types (Public dev preview)
		publicDev.Get("/api/public/dispatch/training/courses", dispatchHandler.ListTrainingCourses)
		publicDev.Get("/api/public/dispatch/training/courses/{id}", dispatchHandler.GetTrainingCourseByID)
		publicDev.Post("/api/public/dispatch/training/courses", dispatchHandler.CreateTrainingCourse)
		publicDev.Put("/api/public/dispatch/training/courses/{id}", dispatchHandler.UpdateTrainingCourse)
		publicDev.Post("/api/public/dispatch/training/courses/{id}/publish", dispatchHandler.PublishTrainingCourse)
		publicDev.Post("/api/public/dispatch/training/courses/{id}/cancel", dispatchHandler.CancelTrainingCourse)
		publicDev.Post("/api/public/dispatch/training/courses/{id}/complete", dispatchHandler.CompleteTrainingCourse)
		publicDev.Delete("/api/public/dispatch/training/courses/{id}", dispatchHandler.DeleteTrainingCourse)
		publicDev.Post("/api/public/dispatch/training/courses/{id}/attendees", dispatchHandler.RegisterAttendee)
		publicDev.Put("/api/public/dispatch/training/courses/{id}/attendees/{regId}", dispatchHandler.UpdateAttendeeStatus)
		publicDev.Delete("/api/public/dispatch/training/courses/{id}/attendees/{regId}", dispatchHandler.CancelRegistration)
		publicDev.Get("/api/public/dispatch/training/types", dispatchHandler.ListTrainingTypes)
		publicDev.Post("/api/public/dispatch/training/types", dispatchHandler.CreateTrainingType)
		publicDev.Put("/api/public/dispatch/training/types/{id}", dispatchHandler.UpdateTrainingType)

		// Pre-Trip Inspections (Public dev preview)
		publicDev.Post("/api/public/dispatch/pretrip-inspections", dispatchHandler.CreatePreTripInspection)
		publicDev.Get("/api/public/dispatch/pretrip-inspections/today/{vehicleUnit}", dispatchHandler.GetPreTripInspectionToday)
		publicDev.Get("/api/public/dispatch/pretrip-inspections", dispatchHandler.ListPreTripInspections)

		// Vehicle Defect Reports (Public dev preview)
		publicDev.Post("/api/public/dispatch/vehicle-defects", dispatchHandler.CreateDefectReport)
		publicDev.Get("/api/public/dispatch/vehicle-defects/{id}", dispatchHandler.GetDefectReport)
		publicDev.Get("/api/public/dispatch/vehicle-defects", dispatchHandler.ListDefectReports)
		publicDev.Patch("/api/public/dispatch/vehicle-defects/{id}/assessment", dispatchHandler.UpdateDefectAssessment)
		publicDev.Patch("/api/public/dispatch/vehicle-defects/{id}/status", dispatchHandler.UpdateDefectStatus)

		// Student Incident Reports (Public dev preview)
		publicDev.Post("/api/public/dispatch/student-incidents", dispatchHandler.CreateStudentIncident)
		publicDev.Get("/api/public/dispatch/student-incidents/{id}", dispatchHandler.GetStudentIncident)
		publicDev.Get("/api/public/dispatch/student-incidents", dispatchHandler.ListStudentIncidents)
		publicDev.Patch("/api/public/dispatch/student-incidents/{id}/office-review", dispatchHandler.UpdateStudentIncidentOfficeFollowUp)
		publicDev.Patch("/api/public/dispatch/student-incidents/{id}/status", dispatchHandler.UpdateStudentIncidentStatus)

		// Expense Reimbursements (Public dev preview)
		publicDev.Get("/api/public/dispatch/expense-categories", dispatchHandler.ListExpenseCategories)
		publicDev.Post("/api/public/dispatch/expense-reimbursements", dispatchHandler.CreateExpenseClaim)
		publicDev.Get("/api/public/dispatch/expense-reimbursements/{id}", dispatchHandler.GetExpenseClaim)
		publicDev.Get("/api/public/dispatch/expense-reimbursements", dispatchHandler.ListExpenseClaims)
		publicDev.Post("/api/public/dispatch/expense-reimbursements/{id}/review", dispatchHandler.ReviewExpenseClaim)
		publicDev.Post("/api/public/dispatch/expense-reimbursements/{id}/cancel", dispatchHandler.CancelExpenseClaim)

		// Hazard & Near-Miss Reports (Public dev preview)
		publicDev.Post("/api/public/dispatch/hazard-reports", dispatchHandler.CreateHazardReport)
		publicDev.Get("/api/public/dispatch/hazard-reports/{id}", dispatchHandler.GetHazardReport)
		publicDev.Get("/api/public/dispatch/hazard-reports", dispatchHandler.ListHazardReports)
		publicDev.Patch("/api/public/dispatch/hazard-reports/{id}/office-evaluation", dispatchHandler.UpdateHazardReportOffice)

		// Route Assessments (Public dev preview)
		publicDev.Post("/api/public/dispatch/route-assessments", dispatchHandler.CreateRouteAssessment)
		publicDev.Get("/api/public/dispatch/route-assessments/{id}", dispatchHandler.GetRouteAssessment)
		publicDev.Get("/api/public/dispatch/route-assessments", dispatchHandler.ListRouteAssessments)
		publicDev.Patch("/api/public/dispatch/route-assessments/{id}/office", dispatchHandler.UpdateRouteAssessmentOffice)
		publicDev.Put("/api/public/dispatch/route-assessments/{id}", dispatchHandler.UpdateRouteAssessment)
		publicDev.Delete("/api/public/dispatch/route-assessments/{id}", dispatchHandler.DeleteRouteAssessment)

		// Vehicle Sign-Outs / Handovers (Public dev preview - role checked)
		publicDev.Post("/api/public/dispatch/vehicle-signouts", dispatchHandler.CreateVehicleSignout)
		publicDev.Get("/api/public/dispatch/vehicle-signouts/{id}", dispatchHandler.GetVehicleSignout)
		publicDev.Get("/api/public/dispatch/vehicle-signouts", dispatchHandler.ListVehicleSignouts)
		publicDev.Put("/api/public/dispatch/vehicle-signouts/{id}", dispatchHandler.UpdateVehicleSignout)
		publicDev.Delete("/api/public/dispatch/vehicle-signouts/{id}", dispatchHandler.DeleteVehicleSignout)

		// Public dev fallback for chat
		publicDev.Get("/api/public/chat/channels", chatHandler.ListChannels)
		publicDev.Get("/api/public/chat/channels/{id}", chatHandler.GetChannel)
		publicDev.Post("/api/public/chat/channels/direct", chatHandler.CreateOrGetDirectChannel)
		publicDev.Post("/api/public/chat/channels/parent", chatHandler.CreateOrGetParentChannel)
		publicDev.Get("/api/public/chat/channels/{id}/messages", chatHandler.ListMessages)
		publicDev.Post("/api/public/chat/channels/{id}/messages", chatHandler.SendMessage)
		publicDev.Get("/api/public/chat/contacts", chatHandler.ListContacts)
		publicDev.Get("/api/public/chat/display-name", chatHandler.GetMyDisplayName)

		// Public dev fallback for AI Dispatch Copilot
		publicDev.Post("/api/public/ai/chat", aiHandler.ProcessChat)
		publicDev.Get("/api/public/ai/status", aiHandler.GetStatus)
	})

	// Admin BigQuery Archive & Maintenance Endpoints (Protected by X-Admin-Secret)
	if fsClient != nil && bqClient != nil {
		arc := archiver.NewArchiver(fsClient, bqClient, cfg.ProjectID, cfg.BigQueryDataset)
		go func() {
			if err := arc.EnsureTables(context.Background()); err != nil {
				log.Printf("[ARCHIVER] Warning: EnsureTables background check: %v", err)
			}
		}()

		r.Group(func(adminRoute chi.Router) {
			adminRoute.Use(adminSecretMiddleware(cfg.AdminAPISecret))

			adminRoute.Post("/api/admin/archive/sync", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				dateStr := r.URL.Query().Get("date")
				if dateStr != "" {
					if err := arc.SyncDate(r.Context(), dateStr); err != nil {
						http.Error(w, fmt.Sprintf(`{"error":"sync date failed: %v"}`, err), http.StatusInternalServerError)
						return
					}
					w.Write([]byte(`{"success":true,"message":"synced date ` + dateStr + `"}`))
					return
				}
				daysStr := r.URL.Query().Get("days")
				days := 35
				if daysStr != "" {
					if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
						days = d
					}
				}
				go func() {
					_ = arc.SyncRolling(context.Background(), days)
				}()
				w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"rolling sync initiated for past %d days"}`, days)))
			})

			adminRoute.Post("/api/admin/archive/cleanup", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				daysStr := r.URL.Query().Get("days")
				days := 90
				if daysStr != "" {
					if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
						days = d
					}
				}
				if err := arc.CleanupFirestore(r.Context(), days); err != nil {
					http.Error(w, fmt.Sprintf(`{"error":"cleanup failed: %v"}`, err), http.StatusInternalServerError)
					return
				}
				w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"cleaned up Firestore documents older than %d days"}`, days)))
			})

			adminRoute.Post("/api/admin/archive/sync-logs", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				go func() {
					if err := arc.SyncWeeklyLogs(context.Background()); err != nil {
						log.Printf("[ARCHIVER] SyncWeeklyLogs background job error: %v", err)
					}
				}()
				w.Write([]byte(`{"success":true,"message":"weekly sync for operational logs initiated"}`))
			})

			adminRoute.Post("/api/admin/archive/sync-all", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				daysStr := r.URL.Query().Get("days")
				days := 35
				if daysStr != "" {
					if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
						days = d
					}
				}
				go func() {
					ctx := context.Background()
					log.Printf("[ARCHIVER] Starting unified BigQuery sync-all (rolling %d days + weekly logs)...", days)
					if err := arc.SyncRolling(ctx, days); err != nil {
						log.Printf("[ARCHIVER] SyncRolling error in sync-all: %v", err)
					} else {
						log.Printf("[ARCHIVER] SyncRolling completed successfully.")
					}
					if err := arc.SyncWeeklyLogs(ctx); err != nil {
						log.Printf("[ARCHIVER] SyncWeeklyLogs error in sync-all: %v", err)
					} else {
						log.Printf("[ARCHIVER] SyncWeeklyLogs completed successfully.")
					}
					log.Printf("[ARCHIVER] Unified BigQuery sync-all finished.")
				}()
				w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"unified sync initiated for past %d days and operational logs"}`, days)))
			})

			adminRoute.Post("/api/admin/archive/cleanup-logs", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				daysStr := r.URL.Query().Get("days")
				days := 7
				if daysStr != "" {
					if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
						days = d
					}
				}
				if err := arc.CleanupLogsFirestore(r.Context(), days); err != nil {
					http.Error(w, fmt.Sprintf(`{"error":"cleanup logs failed: %v"}`, err), http.StatusInternalServerError)
					return
				}
				w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"cleaned up Firestore operational logs older than %d days"}`, days)))
			})

			adminRoute.Post("/api/admin/archive/sync-annual", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				from := r.URL.Query().Get("from")
				to := r.URL.Query().Get("to")
				if from == "" || to == "" {
					http.Error(w, `{"error":"from and to date parameters are required (YYYY-MM-DD)"}`, http.StatusBadRequest)
					return
				}
				go func() {
					if err := arc.SyncAnnualIncidents(context.Background(), from, to); err != nil {
						log.Printf("[ARCHIVER] SyncAnnualIncidents background error: %v", err)
					}
				}()
				w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"school year incidents sync initiated from %s to %s"}`, from, to)))
			})
		})
	}

	// Operational Scheduler & Admin Maintenance Endpoints (Protected by X-Admin-Secret)
	r.Group(func(adminRoute chi.Router) {
		adminRoute.Use(adminSecretMiddleware(cfg.AdminAPISecret))

		// Crew Late Check-in Reminders (Scheduled Mon-Fri 6:00-18:00 every minute)
		adminRoute.Post("/api/admin/shifts/check-in-reminders", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")

			reminderSettings, errSet := dispatchRepo.GetCheckInReminderSettings(r.Context())
			if errSet != nil || reminderSettings == nil {
				reminderSettings = models.DefaultCheckInReminderSettings()
			}

			if !reminderSettings.Enabled {
				w.Write([]byte(`{"success":true,"message":"crew check-in reminders disabled in settings","checked":0,"driverRemindersSent":0,"attendantRemindersSent":0}`))
				return
			}

			graceMinutes := reminderSettings.ReminderGraceMinutes
			if graceMinutes <= 0 {
				graceMinutes = 20
			}

			pretripGraceMinutes := reminderSettings.PretripReminderGraceMinutes
			if pretripGraceMinutes <= 0 {
				pretripGraceMinutes = 60
			}

			loc, errLoc := time.LoadLocation("America/Toronto")
			if errLoc != nil {
				loc = time.FixedZone("EDT", -4*3600)
			}
			nowLocal := time.Now().In(loc)

			targetDate := r.URL.Query().Get("date")
			if targetDate == "" {
				targetDate = nowLocal.Format("2006-01-02")
			}

			force := r.URL.Query().Get("force") == "true"
			if !force && r.URL.Query().Get("date") == "" {
				wd := nowLocal.Weekday()
				if wd == time.Sunday || wd == time.Saturday {
					w.Write([]byte(`{"success":true,"message":"weekend, skipping reminders","checked":0,"driverRemindersSent":0,"attendantRemindersSent":0,"pretripRemindersSent":0}`))
					return
				}
			}

			currentTimeStr := nowLocal.Format("15:04")
			if timeOverride := r.URL.Query().Get("time"); timeOverride != "" {
				currentTimeStr = timeOverride
			}

			if !force && r.URL.Query().Get("time") == "" {
				startStr := reminderSettings.ReminderWindowStart
				if startStr == "" {
					startStr = "06:00"
				}
				endStr := reminderSettings.ReminderWindowEnd
				if endStr == "" {
					endStr = "18:00"
				}
				if currentTimeStr < startStr || currentTimeStr >= endStr {
					w.Write([]byte(fmt.Sprintf(`{"success":true,"message":"outside operational reminder window (%s-%s)","checked":0,"driverRemindersSent":0,"attendantRemindersSent":0,"pretripRemindersSent":0}`, startStr, endStr)))
					return
				}
			}

			shifts, err := dispatchRepo.ListShifts(r.Context(), targetDate, repository.DispatchFilter{})
			if err != nil {
				log.Printf("[REMINDER] Error listing shifts for date %s: %v", targetDate, err)
				http.Error(w, fmt.Sprintf(`{"error":"failed to list shifts: %v"}`, err), http.StatusInternalServerError)
				return
			}

			// Pre-load inspections for the date to evaluate pretrip completion
			inspections, _ := dispatchRepo.ListPreTripInspections(r.Context(), targetDate, "")
			inspectedUnits := make(map[string]bool)
			inspectedDrivers := make(map[string]bool)
			for _, ins := range inspections {
				if ins.VehicleUnit != "" {
					inspectedUnits[strings.TrimSpace(strings.ToUpper(ins.VehicleUnit))] = true
				}
				if ins.InspectorID != "" {
					inspectedDrivers[strings.TrimSpace(ins.InspectorID)] = true
				}
			}

			driverRemindersSent := 0
			attendantRemindersSent := 0
			pretripRemindersSent := 0
			checkedCount := len(shifts)

			for _, shift := range shifts {
				// 1. Evaluate Driver Late Check-in
				if shift.DriverID != "" && !shift.IsDriverCheckedIn && (shift.DriverCheckedInAt == nil || *shift.DriverCheckedInAt == "") && shift.DriverReminderSentAt == nil {
					effectiveCheckIn := shift.GetEffectiveCheckInTime()
					if effectiveCheckIn != "" {
						lateThreshold := addMinutesToTime(effectiveCheckIn, graceMinutes)
						if currentTimeStr >= lateThreshold {
							emp, err := repo.GetByID(r.Context(), shift.DriverID)
							if err != nil {
								emp, _ = repo.GetByEmployeeNumber(r.Context(), shift.DriverID)
							}
							if emp != nil && emp.IsActive {
								// Send FCM push notification if driver has registered devices
								if fcmClient != nil && len(emp.Devices) > 0 {
									var tokens []string
									for _, dev := range emp.Devices {
										if dev.Token != "" {
											tokens = append(tokens, dev.Token)
										}
									}
									if len(tokens) > 0 {
										bodyText := fmt.Sprintf("Hi %s, your check-in for Route %s (%s) was scheduled for %s. Please check in now.", emp.FirstName, shift.RouteNo, shift.ShiftType, effectiveCheckIn)
										resp, sendErr := fcmClient.SendEachForMulticast(r.Context(), &firebaseMessaging.MulticastMessage{
											Tokens: tokens,
											Notification: &firebaseMessaging.Notification{
												Title: "Late Check-in Reminder",
												Body:  bodyText,
											},
											Data: map[string]string{
												"type":        "late_checkin_reminder",
												"shiftId":     shift.ID,
												"routeNo":     shift.RouteNo,
												"shiftType":   shift.ShiftType,
												"role":        "driver",
												"checkInTime": effectiveCheckIn,
											},
										})
										if sendErr != nil {
											log.Printf("[FCM] Error sending multicast to driver %s: %v", emp.EmployeeNumber, sendErr)
										} else {
											var deadTokens []string
											for idx, r := range resp.Responses {
												if !r.Success && r.Error != nil && firebaseMessaging.IsRegistrationTokenNotRegistered(r.Error) {
													deadTokens = append(deadTokens, tokens[idx])
												}
											}
											if len(deadTokens) > 0 {
												_ = repo.RemoveDeviceTokens(r.Context(), emp.ID, deadTokens)
												log.Printf("[FCM] Pruned %d dead tokens for driver %s", len(deadTokens), emp.EmployeeNumber)
											}
										}
									}
								}
								// Record idempotency timestamp immediately
								_ = dispatchRepo.MarkDriverReminderSent(r.Context(), shift.ID, time.Now().UTC())
								driverRemindersSent++
								log.Printf("[REMINDER] Sent late check-in reminder to driver %s for shift %s (scheduled: %s, late: %s)", shift.DriverName, shift.ID, effectiveCheckIn, lateThreshold)
							}
						}
					}
				}

				// 2. Evaluate Attendant Late Check-in
				if shift.AttendantID != "" && !shift.IsAttendantCheckedIn && (shift.AttendantCheckedInAt == nil || *shift.AttendantCheckedInAt == "") && shift.AttendantReminderSentAt == nil {
					effectiveCheckIn := shift.GetEffectiveCheckInTime()
					if effectiveCheckIn != "" {
						lateThreshold := addMinutesToTime(effectiveCheckIn, graceMinutes)
						if currentTimeStr >= lateThreshold {
							emp, err := repo.GetByID(r.Context(), shift.AttendantID)
							if err != nil {
								emp, _ = repo.GetByEmployeeNumber(r.Context(), shift.AttendantID)
							}
							if emp != nil && emp.IsActive {
								if fcmClient != nil && len(emp.Devices) > 0 {
									var tokens []string
									for _, dev := range emp.Devices {
										if dev.Token != "" {
											tokens = append(tokens, dev.Token)
										}
									}
									if len(tokens) > 0 {
										bodyText := fmt.Sprintf("Hi %s, your check-in for Route %s (%s) was scheduled for %s. Please check in now.", emp.FirstName, shift.RouteNo, shift.ShiftType, effectiveCheckIn)
										resp, sendErr := fcmClient.SendEachForMulticast(r.Context(), &firebaseMessaging.MulticastMessage{
											Tokens: tokens,
											Notification: &firebaseMessaging.Notification{
												Title: "Late Check-in Reminder",
												Body:  bodyText,
											},
											Data: map[string]string{
												"type":        "late_checkin_reminder",
												"shiftId":     shift.ID,
												"routeNo":     shift.RouteNo,
												"shiftType":   shift.ShiftType,
												"role":        "attendant",
												"checkInTime": effectiveCheckIn,
											},
										})
										if sendErr != nil {
											log.Printf("[FCM] Error sending multicast to attendant %s: %v", emp.EmployeeNumber, sendErr)
										} else {
											var deadTokens []string
											for idx, r := range resp.Responses {
												if !r.Success && r.Error != nil && firebaseMessaging.IsRegistrationTokenNotRegistered(r.Error) {
													deadTokens = append(deadTokens, tokens[idx])
												}
											}
											if len(deadTokens) > 0 {
												_ = repo.RemoveDeviceTokens(r.Context(), emp.ID, deadTokens)
												log.Printf("[FCM] Pruned %d dead tokens for attendant %s", len(deadTokens), emp.EmployeeNumber)
											}
										}
									}
								}
								_ = dispatchRepo.MarkAttendantReminderSent(r.Context(), shift.ID, time.Now().UTC())
								attendantRemindersSent++
								log.Printf("[REMINDER] Sent late check-in reminder to attendant %s for shift %s (scheduled: %s, late: %s)", shift.AttendantName, shift.ID, effectiveCheckIn, lateThreshold)
							}
						}
					}
				}

				// 3. Evaluate Driver Late Pre-trip Inspection (Vehicle Pre-trip Reminder)
				vehicleUnit := strings.TrimSpace(shift.UnitNumber)
				hasVehicle := vehicleUnit != "" || shift.VehicleID > 0
				if shift.DriverID != "" && hasVehicle && shift.PretripReminderSentAt == nil {
					effectiveCheckIn := shift.GetEffectiveCheckInTime()
					if effectiveCheckIn != "" {
						pretripThreshold := addMinutesToTime(effectiveCheckIn, pretripGraceMinutes)
						if currentTimeStr >= pretripThreshold {
							unitKey := strings.ToUpper(vehicleUnit)
							driverKey := strings.TrimSpace(shift.DriverID)
							isInspected := (unitKey != "" && inspectedUnits[unitKey]) || (driverKey != "" && inspectedDrivers[driverKey])
							if !isInspected {
								emp, err := repo.GetByID(r.Context(), shift.DriverID)
								if err != nil {
									emp, _ = repo.GetByEmployeeNumber(r.Context(), shift.DriverID)
								}
								if emp != nil && emp.IsActive {
									if fcmClient != nil && len(emp.Devices) > 0 {
										var tokens []string
										for _, dev := range emp.Devices {
											if dev.Token != "" {
												tokens = append(tokens, dev.Token)
											}
										}
										if len(tokens) > 0 {
											vehDisplay := vehicleUnit
											if vehDisplay == "" && shift.VehicleID > 0 {
												vehDisplay = fmt.Sprintf("#%d", shift.VehicleID)
											}
											bodyText := fmt.Sprintf("Hi %s, your pre-trip inspection for vehicle %s (Route %s) is overdue. Please complete and submit your inspection now.", emp.FirstName, vehDisplay, shift.RouteNo)
											resp, sendErr := fcmClient.SendEachForMulticast(r.Context(), &firebaseMessaging.MulticastMessage{
												Tokens: tokens,
												Notification: &firebaseMessaging.Notification{
													Title: "Pre-trip Inspection Reminder",
													Body:  bodyText,
												},
												Data: map[string]string{
													"type":        "pretrip_inspection_reminder",
													"shiftId":     shift.ID,
													"routeNo":     shift.RouteNo,
													"shiftType":   shift.ShiftType,
													"vehicleUnit": vehDisplay,
													"role":        "driver",
													"checkInTime": effectiveCheckIn,
												},
											})
											if sendErr != nil {
												log.Printf("[FCM] Error sending pretrip reminder to driver %s: %v", emp.EmployeeNumber, sendErr)
											} else {
												var deadTokens []string
												for idx, r := range resp.Responses {
													if !r.Success && r.Error != nil && firebaseMessaging.IsRegistrationTokenNotRegistered(r.Error) {
														deadTokens = append(deadTokens, tokens[idx])
													}
												}
												if len(deadTokens) > 0 {
													_ = repo.RemoveDeviceTokens(r.Context(), emp.ID, deadTokens)
													log.Printf("[FCM] Pruned %d dead tokens for driver %s", len(deadTokens), emp.EmployeeNumber)
												}
											}
										}
									}
									_ = dispatchRepo.MarkPretripReminderSent(r.Context(), shift.ID, time.Now().UTC())
									pretripRemindersSent++
									log.Printf("[REMINDER] Sent late pretrip inspection reminder to driver %s for shift %s (vehicle: %s, check-in: %s, threshold: %s)", shift.DriverName, shift.ID, vehicleUnit, effectiveCheckIn, pretripThreshold)
								}
							}
						}
					}
				}
			}

			w.Write([]byte(fmt.Sprintf(`{"success":true,"date":"%s","currentTime":"%s","checkInGraceMinutes":%d,"pretripGraceMinutes":%d,"checked":%d,"driverRemindersSent":%d,"attendantRemindersSent":%d,"pretripRemindersSent":%d}`,
				targetDate, currentTimeStr, graceMinutes, pretripGraceMinutes, checkedCount, driverRemindersSent, attendantRemindersSent, pretripRemindersSent)))
		})
	})

	// Background Operations Simulation Scheduler (demo deployments only).
	if cfg.AllowsDemo() {
		go func() {
			checkAndRunSimulation := func() {
				bgCtx := context.Background()
				simSettings, err := dispatchRepo.GetSimulationSettings(bgCtx)
				if err != nil || simSettings == nil || !simSettings.Enabled {
					return
				}
				loc, errLoc := time.LoadLocation("America/Toronto")
				if errLoc != nil {
					loc = time.FixedZone("EDT", -4*3600)
				}
				nowOttawa := time.Now().In(loc)
				todayStr := nowOttawa.Format("2006-01-02")

				// 1. Ensure today's dispatches & simulation data are populated if not yet simulated today
				if simSettings.LastSimulatedDate != todayStr {
					log.Printf("[SIMULATION] Running automated operations simulation for today (%s)...", todayStr)
					if res, errSim := dispatchRepo.RunSimulationForDate(bgCtx, todayStr, false); errSim == nil && res != nil {
						log.Printf("[SIMULATION] %s", res.Message)
					}
				}

				// 2. At or after 14:00 (2:00 PM Ottawa time), automatically generate & simulate tomorrow's dispatches
				autoGenTime := simSettings.AutoGenerateTime
				if autoGenTime == "" {
					autoGenTime = "14:00"
				}
				currentTimeHHMM := nowOttawa.Format("15:04")
				tomorrowStr := nowOttawa.AddDate(0, 0, 1).Format("2006-01-02")
				if currentTimeHHMM >= autoGenTime && simSettings.LastAutoGeneratedForDate != tomorrowStr {
					log.Printf("[SIMULATION] Ottawa time is %s (>= %s). Auto-generating & simulating next day (%s)...", currentTimeHHMM, autoGenTime, tomorrowStr)
					if res, errSim := dispatchRepo.RunSimulationForDate(bgCtx, tomorrowStr, false); errSim == nil && res != nil {
						log.Printf("[SIMULATION] Next-day auto-generation complete: %s", res.Message)
						latestSettings, _ := dispatchRepo.GetSimulationSettings(bgCtx)
						if latestSettings != nil {
							latestSettings.LastAutoGeneratedForDate = tomorrowStr
							_, _ = dispatchRepo.SaveSimulationSettings(bgCtx, latestSettings)
						}
					}
				}
			}

			// Initial check shortly after startup
			time.Sleep(2 * time.Second)
			checkAndRunSimulation()

			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for range ticker.C {
				checkAndRunSimulation()
			}
		}()
	} else {
		log.Println("[INIT] Production mode: operations simulation scheduler is off.")
	}

	// BambooHR daily directory read. It does not write employees into dispatch storage.
	go func() {
		run := func() { bambooSvc.RunScheduledSync(context.Background()) }
		time.Sleep(2 * time.Second)
		run()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			run()
		}
	}()

	// BusPlanner pull writes staging only. While sync is enabled, a shift is copied
	// into the live route at 09:00 America/Toronto on the day before its effective date.
	go func() {
		run := func() {
			busplannerSvc.RunScheduledSync(context.Background())
			busplannerSvc.RunScheduledStagingSimulation(context.Background())
			busplannerSvc.RunScheduledPublish(context.Background())
		}
		time.Sleep(2 * time.Second)
		run()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			run()
		}
	}()

	// Zonar current-position read. Busy weekdays poll on the short interval; evenings and weekends use the idle interval.
	// Positions are not written into dispatch storage.
	go func() {
		run := func() {
			zonarSvc.RunScheduledSync(context.Background())
			zonarSvc.RunScheduledSerialSync(context.Background())
			zonarSvc.RunScheduledRoutePreview(context.Background())
		}
		time.Sleep(2 * time.Second)
		run()
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			run()
		}
	}()

	addr := ":" + cfg.Port
	log.Printf("[READY] Dispatch API Server listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("[FATAL] Server terminated: %v", err)
	}
}

func addMinutesToTime(tStr string, mins int) string {
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
	total := h*60 + m + mins
	return fmt.Sprintf("%02d:%02d", (total/60)%24, total%60)
}

// adminSecretMiddleware verifies X-Admin-Secret header or ?secret= query parameter.
func adminSecretMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			provided := r.Header.Get("X-Admin-Secret")
			if provided == "" {
				provided = r.URL.Query().Get("secret")
			}
			if secret != "" && (provided == "" || provided != secret) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized: invalid or missing X-Admin-Secret header"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

func seedMemoryData(ctx context.Context, repo repository.EmployeeRepository) {
	now := time.Now()
	hiredDate := now.AddDate(-2, -4, 0)
	expiringSoon := now.AddDate(0, 0, 15)
	validLong := now.AddDate(2, 5, 0)
	lat := 45.4215
	lng := -75.6972

	// Seed Admin
	admin := &models.Employee{
		EmployeeNumber:  "EMP-ADMIN-001",
		FirstName:       "Alex",
		LastName:        "Morgan",
		MiddleName:      "J",
		JobPosition:     "Operations Director & System Admin",
		WorkEmail:       "admin@dispatch.local",
		PersonalEmail:   "alex.morgan.personal@example.com",
		WorkPhonePhone:  "613-555-0100",
		MobilePhone:     "613-555-0101",
		DateHired:       &hiredDate,
		IsActive:        true,
		PersonalAddress: "100 Fleet Operations Blvd, Suite 200, Ottawa, ON",
		Lat:             &lat,
		Lng:             &lng,
		YardID:          "HQ-Central",
		FirebaseUID:     "mock-admin-uid-001",
		Role:            "admin",
		EmployeeContacts: []models.EmployeeContact{
			{
				ContactID:      "EC-ADMIN-1",
				PrimaryContact: true,
				ContactName:    "Sarah Morgan",
				Relationship:   "Spouse",
				MobilePhone:    "613-555-0102",
				Active:         true,
			},
		},
	}
	admin.ComputeComputedFields()
	_ = repo.Create(ctx, admin)

	// Seed Driver 1 (License Expiring Soon)
	driver1 := &models.Employee{
		EmployeeNumber:  "EMP-2001",
		FirstName:       "David",
		LastName:        "Miller",
		JobPosition:     "Senior School Bus Driver",
		PersonalEmail:   "david.m.driver@gmail.com",
		MobilePhone:     "613-555-0401",
		WorkPhonePhone:  "613-555-0400",
		DateHired:       &hiredDate,
		IsActive:        true,
		PersonalAddress: "45 Meadowlands Dr, Nepean, ON",
		YardID:          "Yard-West",
		Role:            "driver",
		DriverLicense: &models.DriverLicense{
			LicenseID:        "M1234-56789-01234",
			ExpirationDate:   expiringSoon,
			LicenseClass:     "Class B with Z",
			LicenseCondition: "Corrective Lenses",
			MVID:             "MVID-99812",
		},
		EmployeeContacts: []models.EmployeeContact{
			{
				ContactID:      "EC-2001-1",
				PrimaryContact: true,
				ContactName:    "Rachel Miller",
				Relationship:   "Spouse",
				MobilePhone:    "613-555-0405",
				Active:         true,
			},
		},
	}
	driver1.ComputeComputedFields()
	_ = repo.Create(ctx, driver1)

	// Seed Driver 2
	driver2 := &models.Employee{
		EmployeeNumber:  "EMP-2002",
		FirstName:       "Emily",
		LastName:        "Zhang",
		JobPosition:     "School Bus Driver",
		PersonalEmail:   "emily.zhang92@example.com",
		MobilePhone:     "613-555-0501",
		DateHired:       &hiredDate,
		IsActive:        true,
		PersonalAddress: "1280 Baseline Rd, Ottawa, ON",
		YardID:          "Yard-East",
		Role:            "driver",
		DriverLicense: &models.DriverLicense{
			LicenseID:      "Z9876-54321-12345",
			ExpirationDate: validLong,
			LicenseClass:   "Class B",
		},
	}
	driver2.ComputeComputedFields()
	_ = repo.Create(ctx, driver2)

	// Seed Dispatcher
	dispatcher := &models.Employee{
		EmployeeNumber:  "EMP-1002",
		FirstName:       "Sarah",
		LastName:        "Connor",
		JobPosition:     "Head Dispatcher",
		WorkEmail:       "sarah.c@dispatch.local",
		WorkPhonePhone:  "613-555-0201",
		MobilePhone:     "613-555-0202",
		DateHired:       &hiredDate,
		IsActive:        true,
		PersonalAddress: "245 Bank St, Ottawa, ON",
		YardID:          "HQ-Central",
		Role:            "dispatcher",
	}
	dispatcher.ComputeComputedFields()
	_ = repo.Create(ctx, dispatcher)

	// Seed Yard Supervisor
	supervisor := &models.Employee{
		EmployeeNumber:  "EMP-1003",
		FirstName:       "Marcus",
		LastName:        "Vance",
		JobPosition:     "Yard Supervisor",
		WorkEmail:       "marcus.v@dispatch.local",
		WorkPhonePhone:  "613-555-0301",
		MobilePhone:     "613-555-0302",
		DateHired:       &hiredDate,
		IsActive:        true,
		PersonalAddress: "780 Industrial Ave, Ottawa, ON",
		YardID:          "Yard-East",
		Role:            "supervisor",
	}
	supervisor.ComputeComputedFields()
	_ = repo.Create(ctx, supervisor)
}

func seedMemoryParentAndStudentData(
	ctx context.Context,
	studentRepo repository.StudentRepository,
	parentRepo repository.ParentRepository,
	dispatchRepo repository.DispatchRepository,
) {
	latBaseline := 45.35125
	lngBaseline := -75.76015
	latRichmond := 45.36850
	lngRichmond := -75.75720
	latBroadview := 45.37896
	lngBroadview := -75.76102
	latNepean := 45.38552
	lngNepean := -75.75485

	// Seed Student 1: Emma Watson
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
	_ = studentRepo.Create(ctx, s1)

	// Seed Student 2: Lucas Watson (Sibling, same parent phone 613-555-0199)
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
	_ = studentRepo.Create(ctx, s2)

	// Seed Bus telemetry for #42 and #1001 near Baseline Rd
	for _, unit := range []string{"42", "1001"} {
		_ = parentRepo.SaveVehicleLiveLocation(ctx, &models.VehicleLiveLocation{
			UnitNumber:          unit,
			RouteNo:             "OCDSB-001",
			ShiftID:             "DS-MOCK-ACTIVE",
			Latitude:            latBaseline,
			Longitude:           lngBaseline,
			Heading:             85.0,
			SpeedKmh:            34.5,
			CurrentStopSequence: 1,
			NextStopLocation:    "Woodroffe Ave & Baseline Rd, Ottawa, ON",
			Status:              "EN_ROUTE",
			LastUpdated:         time.Now().UTC(),
		})
	}

	// Seed today's active dispatch shifts (both AM and PM) for OCDSB-001
	locOttawa, _ := time.LoadLocation("America/Toronto")
	todayStr := time.Now().In(locOttawa).Format("2006-01-02")
	if memDispatch, ok := dispatchRepo.(*repository.MemoryDispatchRepository); ok {
		// Morning Shift (AM)
		memDispatch.AddShift(&models.DispatchShift{
			ID:           fmt.Sprintf("DS-%s-OCDSB-001-AM", todayStr),
			DispatchDate: todayStr,
			RouteNo:      "OCDSB-001",
			RouteName:    "Westboro / Nepean Shuttle",
			ShiftType:    "AM",
			DriverID:     "EMP-2001",
			DriverName:   "Michael Ross",
			VehicleID:    42,
			UnitNumber:   "42",
			PlateNumber:  "BUS-4242",
			Health:       models.HealthGreen,
			LateMinutes:  0,
			Stops: []models.DispatchShiftStop{
				{
					StopID:           1,
					Sequence:         1,
					StopLocation:     "Woodroffe Ave & Baseline Rd, Ottawa, ON",
					StopScheduleTime: "07:35",
					StopType:         "HomePickup",
					Latitude:         &latBaseline,
					Longitude:        &lngBaseline,
					AssignedStudents: []models.DispatchShiftStopStudent{
						{
							StudentID:   1001,
							StudentNo:   "S-1001",
							StudentName: "Emma Watson",
							Status:      "pending",
						},
					},
				},
				{
					StopID:           2,
					Sequence:         2,
					StopLocation:     "Woodroffe Ave & Richmond Rd, Ottawa, ON",
					StopScheduleTime: "07:45",
					StopType:         "HomePickup",
					Latitude:         &latRichmond,
					Longitude:        &lngRichmond,
					AssignedStudents: []models.DispatchShiftStopStudent{
						{
							StudentID:   1002,
							StudentNo:   "S-1002",
							StudentName: "Lucas Watson",
							Status:      "pending",
						},
					},
				},
				{
					StopID:           3,
					Sequence:         3,
					StopLocation:     "535 Broadview Ave, Ottawa, ON",
					StopScheduleTime: "08:00",
					StopType:         "SchoolDropoff",
					SchoolID:         func() *int { id := 101; return &id }(),
					SchoolName:       "Broadview Public School",
					Latitude:         &latBroadview,
					Longitude:        &lngBroadview,
				},
				{
					StopID:           4,
					Sequence:         4,
					StopLocation:     "574 Broadview Ave, Ottawa, ON",
					StopScheduleTime: "08:10",
					StopType:         "SchoolDropoff",
					SchoolID:         func() *int { id := 102; return &id }(),
					SchoolName:       "Nepean High School",
					Latitude:         &latNepean,
					Longitude:        &lngNepean,
				},
			},
		})

		// Afternoon Shift (PM)
		memDispatch.AddShift(&models.DispatchShift{
			ID:           fmt.Sprintf("DS-%s-OCDSB-001-PM", todayStr),
			DispatchDate: todayStr,
			RouteNo:      "OCDSB-001",
			RouteName:    "Westboro / Nepean Shuttle",
			ShiftType:    "PM",
			DriverID:     "EMP-2001",
			DriverName:   "Michael Ross",
			VehicleID:    42,
			UnitNumber:   "42",
			PlateNumber:  "BUS-4242",
			Health:       models.HealthGreen,
			LateMinutes:  0,
			Stops: []models.DispatchShiftStop{
				{
					StopID:           1,
					Sequence:         1,
					StopLocation:     "535 Broadview Ave, Ottawa, ON",
					StopScheduleTime: "15:20",
					StopType:         "SchoolPickup",
					SchoolID:         func() *int { id := 101; return &id }(),
					SchoolName:       "Broadview Public School",
					Latitude:         &latBroadview,
					Longitude:        &lngBroadview,
					AssignedStudents: []models.DispatchShiftStopStudent{
						{
							StudentID:   1001,
							StudentNo:   "S-1001",
							StudentName: "Emma Watson",
							Status:      "pending",
						},
					},
				},
				{
					StopID:           2,
					Sequence:         2,
					StopLocation:     "574 Broadview Ave, Ottawa, ON",
					StopScheduleTime: "15:30",
					StopType:         "SchoolPickup",
					SchoolID:         func() *int { id := 102; return &id }(),
					SchoolName:       "Nepean High School",
					Latitude:         &latNepean,
					Longitude:        &lngNepean,
					AssignedStudents: []models.DispatchShiftStopStudent{
						{
							StudentID:   1002,
							StudentNo:   "S-1002",
							StudentName: "Lucas Watson",
							Status:      "pending",
						},
					},
				},
				{
					StopID:           3,
					Sequence:         3,
					StopLocation:     "Woodroffe Ave & Richmond Rd, Ottawa, ON",
					StopScheduleTime: "15:45",
					StopType:         "HomeDropoff",
					Latitude:         &latRichmond,
					Longitude:        &lngRichmond,
					AssignedStudents: []models.DispatchShiftStopStudent{
						{
							StudentID:   1002,
							StudentNo:   "S-1002",
							StudentName: "Lucas Watson",
							Status:      "pending",
						},
					},
				},
				{
					StopID:           4,
					Sequence:         4,
					StopLocation:     "Woodroffe Ave & Baseline Rd, Ottawa, ON",
					StopScheduleTime: "15:55",
					StopType:         "HomeDropoff",
					Latitude:         &latBaseline,
					Longitude:        &lngBaseline,
					AssignedStudents: []models.DispatchShiftStopStudent{
						{
							StudentID:   1001,
							StudentNo:   "S-1001",
							StudentName: "Emma Watson",
							Status:      "pending",
						},
					},
				},
			},
		})
	}
	log.Println("[INIT] Seeded test students (Emma & Lucas Watson) and OCDSB-001 AM/PM dispatch shifts.")
}
