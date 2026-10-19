package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
	"dispatch-server/internal/repository"
	"google.golang.org/api/option"
)

func main() {
	fmt.Println("==================================================")
	fmt.Println(" Dispatch Database Initializer & Admin Seed Tool ")
	fmt.Println("==================================================")

	ctx := context.Background()
	cfg := config.LoadConfig()

	var fsClient *firestore.Client
	var authClient *firebaseAuth.Client
	var repo repository.EmployeeRepository

	saPath := config.ResolveCredentialsPath()
	if saPath != "" {
		fmt.Printf("Using Google Application Credentials from %s\n", saPath)
		opt := option.WithCredentialsFile(saPath)
		app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.ProjectID}, opt)
		if err != nil {
			log.Fatalf("Error initializing Firebase App: %v", err)
		}

		authClient, err = app.Auth(ctx)
		if err != nil {
			log.Printf("Warning: Could not initialize Firebase Auth: %v\n", err)
		}

		fsClient, err = app.Firestore(ctx)
		if err != nil {
			log.Fatalf("Error initializing Firestore: %v", err)
		}
		defer fsClient.Close()
		repo = repository.NewFirestoreEmployeeRepository(fsClient)
	} else {
		fmt.Println("No GOOGLE_APPLICATION_CREDENTIALS detected or file missing.")
		fmt.Println("Running in local simulation / standalone verification mode.")
		repo = repository.NewMemoryEmployeeRepository()
	}

	// 1. Seed Admin Account & Employee
	seedAdmin(ctx, repo, authClient, cfg)

	// 2. Seed Initial Employee Master Records
	seedInitialEmployees(ctx, repo)

	count, _ := repo.Count(ctx)
	fmt.Printf("\n[SUCCESS] Seeding complete! Total employees in master database: %d\n", count)
}

func seedAdmin(ctx context.Context, repo repository.EmployeeRepository, authClient *firebaseAuth.Client, cfg *config.Config) {
	fmt.Println("\n[1/2] Creating/Verifying System Admin Account...")

	existing, _ := repo.GetByEmployeeNumber(ctx, "EMP-ADMIN-001")
	if existing != nil {
		fmt.Printf("Admin record already exists: %s (%s)\n", existing.FullName, existing.WorkEmail)
		return
	}

	var uid string = "admin-uid-initial"
	if authClient != nil {
		u, err := authClient.GetUserByEmail(ctx, cfg.AdminEmail)
		if err == nil && u != nil {
			uid = u.UID
			fmt.Printf("Found existing Firebase Auth user: %s (UID: %s)\n", cfg.AdminEmail, uid)
		} else {
			params := (&firebaseAuth.UserToCreate{}).
				Email(cfg.AdminEmail).
				Password(cfg.AdminPassword).
				DisplayName("System Administrator").
				EmailVerified(true)
			newUser, err := authClient.CreateUser(ctx, params)
			if err != nil {
				log.Printf("Notice: Firebase Auth create user error: %v\n", err)
			} else {
				uid = newUser.UID
				fmt.Printf("Created Firebase Auth Admin: %s (UID: %s)\n", cfg.AdminEmail, uid)
			}
		}

		// Set Admin claims
		claims := map[string]interface{}{
			"role":       "admin",
			"employeeId": "EMP-ADMIN-001",
		}
		if err := authClient.SetCustomUserClaims(ctx, uid, claims); err != nil {
			log.Printf("Notice: Could not set custom claims: %v\n", err)
		} else {
			fmt.Println("Successfully assigned 'admin' custom claim in Firebase Auth.")
		}
	} else {
		fmt.Printf("Created simulated Admin Auth user: %s (UID: %s)\n", cfg.AdminEmail, uid)
	}

	now := time.Now()
	dateHired := now.AddDate(-3, 0, 0)
	lat := 45.4215
	lng := -75.6972

	adminEmployee := &models.Employee{
		EmployeeNumber:  "EMP-ADMIN-001",
		FirstName:       "Alex",
		LastName:        "Morgan",
		MiddleName:      "J",
		JobPosition:     "Operations Director & System Admin",
		WorkEmail:       cfg.AdminEmail,
		PersonalEmail:   "alex.morgan.personal@example.com",
		WorkPhonePhone:  "613-555-0100",
		MobilePhone:     "613-555-0101",
		DateHired:       &dateHired,
		IsActive:        true,
		PersonalAddress: "100 Fleet Operations Blvd, Suite 200, Ottawa, ON",
		Lat:             &lat,
		Lng:             &lng,
		YardID:          "HQ-Central",
		FirebaseUID:     uid,
		Role:            "admin",
		CreatedAt:       now,
		UpdatedAt:       now,
		EmployeeContacts: []models.EmployeeContact{
			{
				ContactID:      "EC-ADMIN-1",
				PrimaryContact: true,
				ContactName:    "Sarah Morgan",
				Relationship:   "Spouse",
				MobilePhone:    "613-555-0102",
				Email:          "sarah.morgan@example.com",
				Active:         true,
			},
		},
	}
	adminEmployee.ComputeComputedFields()

	if err := repo.Create(ctx, adminEmployee); err != nil {
		log.Printf("Failed to create admin in database: %v\n", err)
	} else {
		fmt.Printf("[OK] Admin Master Employee record created: %s [%s]\n", adminEmployee.FullName, adminEmployee.EmployeeNumber)
	}
}

func seedInitialEmployees(ctx context.Context, repo repository.EmployeeRepository) {
	fmt.Println("\n[2/2] Seeding Initial Employee Master Records (Office & Drivers)...")

	now := time.Now()
	// License dates
	expiringSoon := now.AddDate(0, 0, 15) // expires in 15 days (alert test)
	validLong := now.AddDate(2, 5, 0)     // valid for 2.5 years
	issued2YearsAgo := now.AddDate(-2, 0, 0)

	hired2021 := now.AddDate(-4, -2, 0)
	hired2022 := now.AddDate(-3, -1, 0)
	hired2023 := now.AddDate(-2, -5, 0)
	hired2024 := now.AddDate(-1, -1, 0)

	latOttawa := 45.4111
	lngOttawa := -75.6981

	samples := []*models.Employee{
		{
			EmployeeNumber:  "EMP-1002",
			FirstName:       "Sarah",
			LastName:        "Connor",
			JobPosition:     "Head Dispatcher",
			WorkEmail:       "sarah.c@dispatch.local",
			WorkPhonePhone:  "613-555-0201",
			MobilePhone:     "613-555-0202",
			DateHired:       &hired2021,
			IsActive:        true,
			PersonalAddress: "245 Bank St, Ottawa, ON",
			YardID:          "HQ-Central",
			Role:            "dispatcher",
			Lat:             &latOttawa,
			Lng:             &lngOttawa,
			EmployeeContacts: []models.EmployeeContact{
				{
					ContactID:      "EC-1002-1",
					PrimaryContact: true,
					ContactName:    "John Connor",
					Relationship:   "Son",
					MobilePhone:    "613-555-0203",
					Active:         true,
				},
			},
		},
		{
			EmployeeNumber:  "EMP-1003",
			FirstName:       "Marcus",
			LastName:        "Vance",
			JobPosition:     "Yard Supervisor",
			WorkEmail:       "marcus.v@dispatch.local",
			WorkPhonePhone:  "613-555-0301",
			MobilePhone:     "613-555-0302",
			DateHired:       &hired2022,
			IsActive:        true,
			PersonalAddress: "780 Industrial Ave, Ottawa, ON",
			YardID:          "Yard-East",
			Role:            "supervisor",
			EmployeeContacts: []models.EmployeeContact{
				{
					ContactID:      "EC-1003-1",
					PrimaryContact: true,
					ContactName:    "Elena Vance",
					Relationship:   "Spouse",
					MobilePhone:    "613-555-0303",
					Active:         true,
				},
			},
		},
		{
			EmployeeNumber:  "EMP-2001",
			FirstName:       "David",
			LastName:        "Miller",
			MiddleName:      "Robert",
			JobPosition:     "Senior School Bus Driver",
			PersonalEmail:   "david.m.driver@gmail.com",
			MobilePhone:     "613-555-0401",
			DateHired:       &hired2022,
			IsActive:        true,
			PersonalAddress: "45 Meadowlands Dr, Nepean, ON",
			YardID:          "Yard-West",
			Role:            "driver",
			DriverLicense: &models.DriverLicense{
				LicenseID:        "M1234-56789-01234",
				ExpirationDate:   expiringSoon, // ALERT: Expiring in 15 days!
				LicenseClass:     "Class B with Z Air Brake",
				LicenseCondition: "Corrective Lenses",
				MVID:             "MVID-99812",
				IssuedDate:       &issued2YearsAgo,
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
		},
		{
			EmployeeNumber:  "EMP-2002",
			FirstName:       "Emily",
			LastName:        "Zhang",
			JobPosition:     "School Bus Driver",
			PersonalEmail:   "emily.zhang92@example.com",
			MobilePhone:     "613-555-0501",
			DateHired:       &hired2023,
			IsActive:        true,
			PersonalAddress: "1280 Baseline Rd, Ottawa, ON",
			YardID:          "Yard-East",
			Role:            "driver",
			DriverLicense: &models.DriverLicense{
				LicenseID:        "Z9876-54321-12345",
				ExpirationDate:   validLong,
				LicenseClass:     "Class B",
				LicenseCondition: "None",
				MVID:             "MVID-88741",
				IssuedDate:       &issued2YearsAgo,
			},
		},
		{
			EmployeeNumber:  "EMP-2003",
			FirstName:       "James",
			LastName:        "Wilson",
			JobPosition:     "School Bus Driver",
			PersonalEmail:   "jwilson.transit@example.com",
			MobilePhone:     "613-555-0601",
			DateHired:       &hired2024,
			IsActive:        true,
			PersonalAddress: "320 St. Laurent Blvd, Ottawa, ON",
			YardID:          "Yard-East",
			Role:            "driver",
			DriverLicense: &models.DriverLicense{
				LicenseID:        "W5544-33221-99887",
				ExpirationDate:   validLong,
				LicenseClass:     "Class B with Z",
				LicenseCondition: "None",
				MVID:             "MVID-77631",
			},
		},
		{
			EmployeeNumber:  "EMP-2004",
			FirstName:       "Robert",
			LastName:        "Taylor",
			JobPosition:     "Fleet Mechanic & Relief Driver",
			PersonalEmail:   "robert.taylor@example.com",
			MobilePhone:     "613-555-0701",
			DateHired:       &hired2021,
			IsActive:        true,
			PersonalAddress: "950 Merivale Rd, Ottawa, ON",
			YardID:          "Yard-West",
			Role:            "staff",
			DriverLicense: &models.DriverLicense{
				LicenseID:        "T1122-33445-55667",
				ExpirationDate:   validLong,
				LicenseClass:     "Class CZ",
				MVID:             "MVID-66521",
			},
		},
	}

	for _, emp := range samples {
		emp.CreatedAt = now
		emp.UpdatedAt = now
		emp.ComputeComputedFields()

		if err := repo.Create(ctx, emp); err != nil {
			log.Printf("Skip creating %s (%s): %v\n", emp.FullName, emp.EmployeeNumber, err)
		} else {
			fmt.Printf("[OK] Seeded employee: %s - %s [%s]\n", emp.FullName, emp.JobPosition, emp.EmployeeNumber)
		}
	}
}

func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}
