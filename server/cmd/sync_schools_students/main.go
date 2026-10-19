package main

import (
	"context"
	"database/sql"
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
	fmt.Println(" MySQL -> Cloud Firestore School & Student Sync Tool")
	fmt.Println("============================================================")

	ctx := context.Background()
	cfg := config.LoadConfig()

	// 1. Connect to MySQL
	db, sourceInfo, err := connectMySQL()
	if err != nil {
		log.Fatalf("[FATAL] Could not connect to MySQL: %v", err)
	}
	defer db.Close()
	fmt.Printf("[OK] Connected to MySQL (%s)\n", sourceInfo)

	// 2. Connect to Cloud Firestore
	saPath := config.ResolveCredentialsPath()
	if saPath == "" {
		log.Fatalf("[FATAL] No service account credentials JSON found!")
	}
	fmt.Printf("[OK] Firestore credentials: %s (Project: %s)\n", saPath, cfg.ProjectID)

	opt := option.WithCredentialsFile(saPath)
	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: cfg.ProjectID}, opt)
	if err != nil {
		log.Fatalf("[FATAL] Firebase App error: %v", err)
	}

	var fsClient *firestore.Client
	fsClient, err = app.Firestore(ctx)
	if err != nil {
		log.Fatalf("[FATAL] Firestore client error: %v", err)
	}
	defer fsClient.Close()

	// 3. Sync Schools & Boards
	fmt.Println("\n[1/3] Loading and synchronizing 30 Schools from MySQL...")
	schools, schoolsMap, err := syncSchools(ctx, db, fsClient)
	if err != nil {
		log.Fatalf("[FATAL] Failed to sync schools: %v", err)
	}
	fmt.Printf("      Successfully synchronized %d schools to collection 'schools'.\n", len(schools))

	// 4. Load Contacts & Route Assignments
	fmt.Println("\n[2/3] Reading student contacts and bus route assignments...")
	contactsMap, err := loadStudentContacts(db)
	if err != nil {
		log.Fatalf("[FATAL] Failed to load student contacts: %v", err)
	}
	fmt.Printf("      Loaded contacts for %d students.\n", len(contactsMap))

	routesMap, err := loadStudentRoutes(db)
	if err != nil {
		log.Fatalf("[FATAL] Failed to load student routes: %v", err)
	}
	fmt.Printf("      Loaded route assignments for %d students.\n", len(routesMap))

	// 5. Sync Students
	fmt.Println("\n[3/3] Synchronizing 301 Students to collection 'students'...")
	studentCount, err := syncStudents(ctx, db, fsClient, schoolsMap, contactsMap, routesMap)
	if err != nil {
		log.Fatalf("[FATAL] Failed to sync students: %v", err)
	}

	fmt.Printf("\n[SUCCESS] Completed sync at %s!\n", time.Now().Format(time.RFC3339))
	fmt.Println("------------------------------------------------------------")
	fmt.Printf("  Schools Collection:  %d records\n", len(schools))
	fmt.Printf("  Students Collection: %d records\n", studentCount)
	fmt.Println("  Data consistency: School details managed centrally in 'schools'.")
	fmt.Println("============================================================")
}

func connectMySQL() (*sql.DB, string, error) {
	// Remote first
	remoteDSN := "devuser:Zcy!750319@tcp(68.233.125.145:3306)/dispatch?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := sql.Open("mysql", remoteDSN)
	if err == nil {
		db.SetConnMaxLifetime(time.Minute * 3)
		if pingErr := db.Ping(); pingErr == nil {
			return db, "Remote 68.233.125.145:3306", nil
		}
		db.Close()
	}

	// Localhost fallback
	localDSN := "root:Zhang!750319@tcp(localhost:3306)/dispatch?charset=utf8mb4&parseTime=True&loc=Local"
	dbLocal, err := sql.Open("mysql", localDSN)
	if err == nil {
		if pingErr := dbLocal.Ping(); pingErr == nil {
			return dbLocal, "Localhost:3306", nil
		}
		dbLocal.Close()
	}

	return nil, "", fmt.Errorf("could not connect to remote or local MySQL: %v", err)
}

func syncSchools(ctx context.Context, db *sql.DB, fs *firestore.Client) ([]*models.School, map[int]*models.School, error) {
	// Count students per school
	counts := make(map[int]int)
	cRows, err := db.Query("SELECT SchoolId, COUNT(*) FROM student GROUP BY SchoolId")
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var sid, cnt int
			if err := cRows.Scan(&sid, &cnt); err == nil {
				counts[sid] = cnt
			}
		}
	}

	rows, err := db.Query(`
		SELECT 
			s.SchoolId, s.SchoolName, s.SchoolAddress, s.SchoolPhone, s.SchoolFax,
			s.GpsLatitude, s.GpsLongitude, s.StartTime, s.DismissalTime,
			s.EarlyDismissalDay, s.EarlyDismissalTime,
			s.ContactPerson, s.ContactPersonCellPhone, s.ContactPersonEmail,
			s.SchoolNotes, s.ParkingNotes, s.SchoolBoardId,
			b.SchoolBoardName, b.SchoolBoardCode, s.IsActive, s.YardId
		FROM school s
		LEFT JOIN school_board b ON s.SchoolBoardId = b.SchoolBoardId
		ORDER BY s.SchoolId ASC
	`)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var list []*models.School
	sMap := make(map[int]*models.School)
	batch := fs.Batch()
	coll := fs.Collection("schools")
	now := time.Now()

	for rows.Next() {
		var (
			sid            int
			sname          sql.NullString
			addr           sql.NullString
			phone          sql.NullString
			fax            sql.NullString
			lat            sql.NullFloat64
			lng            sql.NullFloat64
			startTime      sql.NullString
			dismissalTime  sql.NullString
			earlyDay       sql.NullString
			earlyTime      sql.NullString
			contact        sql.NullString
			contactCell    sql.NullString
			contactEmail   sql.NullString
			notes          sql.NullString
			parking        sql.NullString
			boardID        sql.NullInt32
			boardName      sql.NullString
			boardCode      sql.NullString
			isActive       bool
			yardID         sql.NullInt32
		)

		if err := rows.Scan(
			&sid, &sname, &addr, &phone, &fax,
			&lat, &lng, &startTime, &dismissalTime,
			&earlyDay, &earlyTime,
			&contact, &contactCell, &contactEmail,
			&notes, &parking, &boardID,
			&boardName, &boardCode, &isActive, &yardID,
		); err != nil {
			return nil, nil, err
		}

		docID := fmt.Sprintf("SCH-%03d", sid)

		var latPtr, lngPtr *float64
		if lat.Valid {
			v := lat.Float64
			latPtr = &v
		}
		if lng.Valid {
			v := lng.Float64
			lngPtr = &v
		}

		var yardPtr *int
		if yardID.Valid {
			y := int(yardID.Int32)
			yardPtr = &y
		}

		sch := &models.School{
			ID:                     docID,
			SchoolID:               sid,
			SchoolName:             strings.TrimSpace(sname.String),
			SchoolAddress:          strings.TrimSpace(addr.String),
			SchoolPhone:            strings.TrimSpace(phone.String),
			SchoolFax:              strings.TrimSpace(fax.String),
			GpsLatitude:            latPtr,
			GpsLongitude:           lngPtr,
			StartTime:              formatTime(startTime.String),
			DismissalTime:          formatTime(dismissalTime.String),
			EarlyDismissalDay:      strings.TrimSpace(earlyDay.String),
			EarlyDismissalTime:     formatTime(earlyTime.String),
			ContactPerson:          strings.TrimSpace(contact.String),
			ContactPersonCellPhone: strings.TrimSpace(contactCell.String),
			ContactPersonEmail:     strings.TrimSpace(contactEmail.String),
			SchoolNotes:            strings.TrimSpace(notes.String),
			ParkingNotes:           strings.TrimSpace(parking.String),
			SchoolBoardID:          int(boardID.Int32),
			SchoolBoardName:        strings.TrimSpace(boardName.String),
			SchoolBoardCode:        strings.TrimSpace(boardCode.String),
			IsActive:               isActive,
			StudentNum:             counts[sid],
			YardID:                 yardPtr,
			CreatedAt:              now,
			UpdatedAt:              now,
		}

		list = append(list, sch)
		sMap[sid] = sch

		docRef := coll.Doc(docID)
		batch.Set(docRef, sch)
	}

	if _, err := batch.Commit(ctx); err != nil {
		return nil, nil, err
	}

	return list, sMap, nil
}

func loadStudentContacts(db *sql.DB) (map[int][]models.StudentContact, error) {
	rows, err := db.Query(`
		SELECT ContactId, StudentId, ContactIndex, PrimaryContact, ContactName, Relationship, MobilePhone, HomePhone, WorkPhone, Address, Email, Active 
		FROM student_contact 
		ORDER BY ContactIndex ASC, ContactId ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[int][]models.StudentContact)
	for rows.Next() {
		var (
			cid      int
			sid      int
			cidx     sql.NullInt32
			primary  bool
			cname    sql.NullString
			rel      sql.NullString
			mobile   sql.NullString
			home     sql.NullString
			work     sql.NullString
			address  sql.NullString
			email    sql.NullString
			active   bool
		)
		if err := rows.Scan(&cid, &sid, &cidx, &primary, &cname, &rel, &mobile, &home, &work, &address, &email, &active); err != nil {
			return nil, err
		}

		contact := models.StudentContact{
			ContactID:      fmt.Sprintf("%d", cid),
			StudentID:      sid,
			ContactIndex:   int(cidx.Int32),
			PrimaryContact: primary,
			ContactName:    strings.TrimSpace(cname.String),
			Relationship:   strings.TrimSpace(rel.String),
			MobilePhone:    strings.TrimSpace(mobile.String),
			HomePhone:      strings.TrimSpace(home.String),
			WorkPhone:      strings.TrimSpace(work.String),
			Address:        strings.TrimSpace(address.String),
			Email:          strings.TrimSpace(email.String),
			Active:         active,
		}
		res[sid] = append(res[sid], contact)
	}
	return res, nil
}

func loadStudentRoutes(db *sql.DB) (map[int]string, error) {
	rows, err := db.Query(`
		SELECT s.StudentId, GROUP_CONCAT(DISTINCT br.RouteNo ORDER BY br.RouteNo SEPARATOR ', ') AS AssignedRoutes
		FROM busroute_shift_stop_student s
		JOIN busroute_shift_stop bss ON s.BusRouteShiftStopId = bss.StopId
		JOIN busroute_shift bs ON bss.ShiftId = bs.ShiftId
		JOIN busroute br ON bs.BusRouteId = br.BusRouteId
		GROUP BY s.StudentId
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[int]string)
	for rows.Next() {
		var sid int
		var routes sql.NullString
		if err := rows.Scan(&sid, &routes); err != nil {
			return nil, err
		}
		if routes.Valid {
			res[sid] = strings.TrimSpace(routes.String)
		}
	}
	return res, nil
}

func syncStudents(
	ctx context.Context,
	db *sql.DB,
	fs *firestore.Client,
	schoolsMap map[int]*models.School,
	contactsMap map[int][]models.StudentContact,
	routesMap map[int]string,
) (int, error) {
	rows, err := db.Query(`
		SELECT 
			StudentId, StudentNo, FirstName, LastName, StudentAddress, StudentPhone, 
			Gender, BirthDate, Grade, Active, MetatBus, StudentEmergencyAddress, 
			StudentEmergencyPhone, StudentDispatchNotes, StudentSchoolNotes, Equipments, SchoolId 
		FROM student 
		ORDER BY StudentId ASC
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var students []*models.Student
	now := time.Now()

	for rows.Next() {
		var (
			sid          int
			sno          sql.NullString
			first        sql.NullString
			last         sql.NullString
			address      sql.NullString
			phone        sql.NullString
			gender       sql.NullString
			birthDate    sql.NullTime
			grade        sql.NullString
			active       bool
			metatBus     bool
			emerAddress  sql.NullString
			emerPhone    sql.NullString
			dispNotes    sql.NullString
			schNotes     sql.NullString
			equipments   sql.NullString
			schoolID     int
		)

		if err := rows.Scan(
			&sid, &sno, &first, &last, &address, &phone,
			&gender, &birthDate, &grade, &active, &metatBus,
			&emerAddress, &emerPhone, &dispNotes, &schNotes,
			&equipments, &schoolID,
		); err != nil {
			return 0, err
		}

		snoStr := strings.TrimSpace(sno.String)
		if snoStr == "" {
			snoStr = fmt.Sprintf("%04d", sid)
		}
		docID := fmt.Sprintf("STU-%s", snoStr)

		var birthPtr *time.Time
		if birthDate.Valid {
			t := birthDate.Time
			birthPtr = &t
		}

		// Denormalized school name for rapid searching
		schName := ""
		if sch, exists := schoolsMap[schoolID]; exists {
			schName = sch.SchoolName
		}

		student := &models.Student{
			ID:                      docID,
			StudentID:               sid,
			StudentNo:               snoStr,
			FirstName:               strings.TrimSpace(first.String),
			LastName:                strings.TrimSpace(last.String),
			StudentAddress:          strings.TrimSpace(address.String),
			StudentPhone:            strings.TrimSpace(phone.String),
			Gender:                  strings.TrimSpace(gender.String),
			BirthDate:               birthPtr,
			Grade:                   strings.TrimSpace(grade.String),
			Active:                  active,
			MetatBus:                metatBus,
			StudentEmergencyAddress: strings.TrimSpace(emerAddress.String),
			StudentEmergencyPhone:   strings.TrimSpace(emerPhone.String),
			StudentDispatchNotes:    strings.TrimSpace(dispNotes.String),
			StudentSchoolNotes:      strings.TrimSpace(schNotes.String),
			Equipments:              strings.TrimSpace(equipments.String),
			SchoolID:                schoolID,
			SchoolName:              schName,
			Routes:                  routesMap[sid],
			Contacts:                contactsMap[sid],
			CreatedAt:               now,
			UpdatedAt:               now,
		}

		student.ComputeComputedFields()
		students = append(students, student)
	}

	// Firestore writes in batches (max 500 per batch)
	coll := fs.Collection("students")
	batchSize := 400
	total := len(students)

	for i := 0; i < total; i += batchSize {
		end := i + batchSize
		if end > total {
			end = total
		}

		batch := fs.Batch()
		for _, s := range students[i:end] {
			docRef := coll.Doc(s.ID)
			batch.Set(docRef, s)
		}

		if _, err := batch.Commit(ctx); err != nil {
			return i, fmt.Errorf("failed committing batch [%d:%d]: %w", i, end, err)
		}
		fmt.Printf("      Committed student batch [%d/%d]...\n", end, total)
	}

	return total, nil
}

func formatTime(t string) string {
	t = strings.TrimSpace(t)
	if t == "" {
		return ""
	}
	parts := strings.Split(t, ":")
	if len(parts) >= 2 {
		return fmt.Sprintf("%02s:%02s", parts[0], parts[1])
	}
	return t
}
