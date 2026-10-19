package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	_ "github.com/go-sql-driver/mysql"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"

	"dispatch-server/internal/config"
	"dispatch-server/internal/models"
)

func main() {
	fmt.Println("============================================================")
	fmt.Println(" MySQL -> Cloud Firestore Employee Sync Tool")
	fmt.Println("============================================================")

	ctx := context.Background()
	cfg := config.LoadConfig()

	// 1. Connect to MySQL
	db, sourceInfo, err := connectMySQL()
	if err != nil {
		log.Fatalf("[FATAL] Could not connect to any MySQL database: %v", err)
	}
	defer db.Close()
	fmt.Printf("[OK] Connected to MySQL database (%s)\n", sourceInfo)

	// 2. Connect to Cloud Firestore
	saPath := config.ResolveCredentialsPath()
	if saPath == "" {
		log.Fatalf("[FATAL] No Google service account credentials JSON found!")
	}
	fmt.Printf("[OK] Loading Firestore credentials: %s (Project: %s)\n", saPath, cfg.ProjectID)

	opt := option.WithCredentialsFile(saPath)
	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.ProjectID}, opt)
	if err != nil {
		log.Fatalf("[FATAL] Firebase App initialization error: %v", err)
	}

	var fsClient *firestore.Client
	fsClient, err = app.Firestore(ctx)
	if err != nil {
		log.Fatalf("[FATAL] Firestore client error: %v", err)
	}
	defer fsClient.Close()

	// 3. Read Related Data from MySQL
	fmt.Println("\n[1/3] Reading licenses, contacts, and photos from MySQL...")
	licensesMap, err := loadLicenses(db)
	if err != nil {
		log.Fatalf("Error loading licenses: %v", err)
	}
	fmt.Printf("      Loaded %d active driver licenses.\n", len(licensesMap))

	contactsMap, err := loadContacts(db)
	if err != nil {
		log.Fatalf("Error loading contacts: %v", err)
	}
	fmt.Printf("      Loaded contacts for %d employees.\n", len(contactsMap))

	photosMap, err := loadPhotos(db)
	if err != nil {
		log.Fatalf("Error loading photos: %v", err)
	}
	fmt.Printf("      Loaded %d avatar photos.\n", len(photosMap))

	// 4. Read Master Employees from MySQL
	fmt.Println("\n[2/3] Reading master employee records from MySQL...")
	employees, err := loadEmployees(db, licensesMap, contactsMap, photosMap)
	if err != nil {
		log.Fatalf("Error loading employees: %v", err)
	}
	fmt.Printf("      Extracted %d employee profiles from MySQL.\n", len(employees))

	// 5. Batch Upsert to Cloud Firestore
	fmt.Println("\n[3/3] Synchronizing all employees to Cloud Firestore 'employees' collection...")
	batch := fsClient.Batch()
	coll := fsClient.Collection("employees")

	now := time.Now()
	for _, emp := range employees {
		emp.UpdatedAt = now
		if emp.CreatedAt.IsZero() {
			emp.CreatedAt = now
		}
		docRef := coll.Doc(emp.ID)
		batch.Set(docRef, emp)
	}

	writeResults, err := batch.Commit(ctx)
	if err != nil {
		log.Fatalf("[FATAL] Firestore batch write failed: %v", err)
	}

	fmt.Printf("\n[SUCCESS] Successfully committed %d records to Firestore! (Commit timestamp: %v)\n", len(writeResults), time.Now().Format(time.RFC3339))
	fmt.Println("------------------------------------------------------------")
	fmt.Printf("  Master Database: Firestore Collection 'employees'\n")
	fmt.Printf("  Synced Employees: %d\n", len(employees))
	fmt.Printf("  Real-time listeners (onSnapshot) will receive immediate updates.\n")
	fmt.Println("============================================================")
}

func connectMySQL() (*sql.DB, string, error) {
	// Try Remote first
	remoteDSN := "devuser:Zcy!750319@tcp(68.233.125.145:3306)/dispatch?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := sql.Open("mysql", remoteDSN)
	if err == nil {
		db.SetConnMaxLifetime(time.Minute * 3)
		if pingErr := db.Ping(); pingErr == nil {
			return db, "Remote 68.233.125.145:3306 (dispatch)", nil
		}
		db.Close()
	}

	// Fallback to Local
	localDSN := "root:Zhang!750319@tcp(localhost:3306)/dispatch?charset=utf8mb4&parseTime=True&loc=Local"
	dbLocal, err := sql.Open("mysql", localDSN)
	if err == nil {
		if pingErr := dbLocal.Ping(); pingErr == nil {
			return dbLocal, "Localhost:3306 (dispatch)", nil
		}
		dbLocal.Close()
	}

	return nil, "", fmt.Errorf("remote and local connection failed: %v", err)
}

func loadLicenses(db *sql.DB) (map[int]*models.DriverLicense, error) {
	rows, err := db.Query(`
		SELECT DriverLicenseId, LicenseID, ExpirationDate, LicenseClass, LicenseCondition, MVID, IssuedDate, EmployeeId 
		FROM driver_license 
		WHERE EmployeeId IS NOT NULL
		ORDER BY ExpirationDate DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[int]*models.DriverLicense)
	for rows.Next() {
		var (
			dlID       int
			licID      sql.NullString
			expDate    sql.NullTime
			licClass   sql.NullString
			licCond    sql.NullString
			mvid       sql.NullString
			issuedDate sql.NullTime
			empID      int
		)
		if err := rows.Scan(&dlID, &licID, &expDate, &licClass, &licCond, &mvid, &issuedDate, &empID); err != nil {
			return nil, err
		}

		// Keep the newest license for each employee
		if _, exists := res[empID]; !exists {
			var issuedPtr *time.Time
			if issuedDate.Valid {
				t := issuedDate.Time
				issuedPtr = &t
			}
			var exp time.Time
			if expDate.Valid {
				exp = expDate.Time
			}

			res[empID] = &models.DriverLicense{
				LicenseID:        licID.String,
				ExpirationDate:   exp,
				LicenseClass:     licClass.String,
				LicenseCondition: licCond.String,
				MVID:             mvid.String,
				IssuedDate:       issuedPtr,
			}
		}
	}
	return res, nil
}

func loadContacts(db *sql.DB) (map[int][]models.EmployeeContact, error) {
	rows, err := db.Query(`
		SELECT EmployeeContactId, EmployeeId, PrimaryContact, ContactName, Relationship, MobilePhone, HomePhone, WorkPhone, Street, City, PostalCode, Email, Active 
		FROM employee_contact 
		WHERE EmployeeId IS NOT NULL 
		ORDER BY PrimaryContact DESC, EmployeeContactId ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[int][]models.EmployeeContact)
	for rows.Next() {
		var (
			cid          int
			empID        int
			primary      bool
			cname        sql.NullString
			rel          sql.NullString
			mobile       sql.NullString
			home         sql.NullString
			work         sql.NullString
			street       sql.NullString
			city         sql.NullString
			postal       sql.NullString
			email        sql.NullString
			active       bool
		)
		if err := rows.Scan(&cid, &empID, &primary, &cname, &rel, &mobile, &home, &work, &street, &city, &postal, &email, &active); err != nil {
			return nil, err
		}

		contact := models.EmployeeContact{
			ContactID:      fmt.Sprintf("%d", cid),
			PrimaryContact: primary,
			ContactName:    cname.String,
			Relationship:   rel.String,
			MobilePhone:    mobile.String,
			HomePhone:      home.String,
			WorkPhone:      work.String,
			Street:         street.String,
			City:           city.String,
			PostalCode:     postal.String,
			Email:          email.String,
			Active:         active,
		}
		res[empID] = append(res[empID], contact)
	}
	return res, nil
}

func loadPhotos(db *sql.DB) (map[int]*models.EmployeePhoto, error) {
	rows, err := db.Query(`
		SELECT EmployeeId, PhotoUrl, photo, MimeType, Width, Height, UpdatedAt 
		FROM employee_photo 
		WHERE EmployeeId IS NOT NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[int]*models.EmployeePhoto)
	for rows.Next() {
		var (
			empID     int
			photoURL  sql.NullString
			photoBlob []byte
			mime      sql.NullString
			w         sql.NullInt32
			h         sql.NullInt32
			upd       sql.NullTime
		)
		if err := rows.Scan(&empID, &photoURL, &photoBlob, &mime, &w, &h, &upd); err != nil {
			return nil, err
		}

		url := photoURL.String
		mimeType := mime.String
		if mimeType == "" {
			mimeType = "image/png"
		}

		if len(photoBlob) > 0 {
			url = fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(photoBlob))
		}

		var updTime time.Time
		if upd.Valid {
			updTime = upd.Time
		}

		res[empID] = &models.EmployeePhoto{
			PhotoURL:  url,
			MimeType:  mimeType,
			Width:     int(w.Int32),
			Height:    int(h.Int32),
			UpdatedAt: updTime,
		}
	}
	return res, nil
}

func loadEmployees(
	db *sql.DB,
	licMap map[int]*models.DriverLicense,
	conMap map[int][]models.EmployeeContact,
	phoMap map[int]*models.EmployeePhoto,
) ([]*models.Employee, error) {
	rows, err := db.Query(`
		SELECT EmployeeId, FirstName, LastName, MiddleName, EmployeeNumber, MobilePhone, WorkPhonePhone, HomePhone, PersonalEmail, WorkEmail, JobPosition, DateHired, IsActive, PersonalAddress, Lat, Lng, YardId 
		FROM employee 
		ORDER BY EmployeeId ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*models.Employee
	for rows.Next() {
		var (
			empID      int
			first      sql.NullString
			last       sql.NullString
			mid        sql.NullString
			empNum     sql.NullString
			mob        sql.NullString
			workPh     sql.NullString
			homePh     sql.NullString
			perEmail   sql.NullString
			workEmail  sql.NullString
			pos        sql.NullString
			dateHired  sql.NullTime
			isActive   bool
			address    sql.NullString
			lat        sql.NullFloat64
			lng        sql.NullFloat64
			yardID     sql.NullInt32
		)

		if err := rows.Scan(
			&empID, &first, &last, &mid, &empNum, &mob, &workPh, &homePh,
			&perEmail, &workEmail, &pos, &dateHired, &isActive, &address,
			&lat, &lng, &yardID,
		); err != nil {
			return nil, err
		}

		// Document ID convention: EMP-{EmployeeNumber}
		numStr := strings.TrimSpace(empNum.String)
		if numStr == "" {
			numStr = fmt.Sprintf("%03d", empID)
		}
		docID := fmt.Sprintf("EMP-%s", numStr)

		var hiredPtr *time.Time
		if dateHired.Valid {
			t := dateHired.Time
			hiredPtr = &t
		}

		var latPtr, lngPtr *float64
		if lat.Valid {
			l := lat.Float64
			latPtr = &l
		}
		if lng.Valid {
			l := lng.Float64
			lngPtr = &l
		}

		// Yard ID name mapping
		yardStr := "HQ-Central"
		if yardID.Valid {
			yardStr = fmt.Sprintf("Yard-%d", yardID.Int32)
		}

		// Role mapping based on JobPosition
		posStr := strings.TrimSpace(pos.String)
		role := "driver"
		switch strings.ToLower(posStr) {
		case "supervisor":
			role = "supervisor"
		case "office":
			role = "dispatcher"
		case "attendant":
			role = "staff"
		default:
			role = "driver"
		}

		emp := &models.Employee{
			ID:               docID,
			EmployeeID:       empID,
			EmployeeNumber:   numStr,
			FirstName:        strings.TrimSpace(first.String),
			LastName:         strings.TrimSpace(last.String),
			MiddleName:       strings.TrimSpace(mid.String),
			MobilePhone:      strings.TrimSpace(mob.String),
			WorkPhonePhone:   strings.TrimSpace(workPh.String),
			HomePhone:        strings.TrimSpace(homePh.String),
			PersonalEmail:    strings.TrimSpace(perEmail.String),
			WorkEmail:        strings.TrimSpace(workEmail.String),
			JobPosition:      posStr,
			DateHired:        hiredPtr,
			IsActive:         isActive,
			PersonalAddress:  strings.TrimSpace(address.String),
			Lat:              latPtr,
			Lng:              lngPtr,
			YardID:           yardStr,
			Role:             role,
			DriverLicense:    licMap[empID],
			EmployeeContacts: conMap[empID],
			EmployeePhoto:    phoMap[empID],
		}

		emp.ComputeComputedFields()
		result = append(result, emp)
	}

	return result, nil
}
